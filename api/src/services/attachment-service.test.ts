import fs from 'fs'
import os from 'os'
import path from 'path'
import { afterAll, describe, expect, it } from 'vitest'
import { AttachmentService } from './attachment-service'
import { AppError } from '../domain/errors'
import { Attachment, CurrentUser, Ticket } from '../domain/ticket'
import { AttachmentRepository } from '../repositories/attachment-repository'

const ticket = { id: 't1', customerId: 'c1' } as Ticket

const fakeTicketService = {
  getById: async (user: CurrentUser, id: string) => {
    if (id !== ticket.id || (user.role === 'customer' && user.id !== ticket.customerId)) {
      throw new AppError(404, 'not_found', 'Chamado não encontrado')
    }
    return ticket
  },
}

const stored: Attachment[] = []
const fakeAttachments: AttachmentRepository = {
  create: async (data) => {
    const attachment = { id: `att${stored.length + 1}`, createdAt: new Date(), ...data }
    stored.push(attachment)
    return attachment
  },
  findById: async (id) => stored.find((a) => a.id === id) || null,
}

const uploadDir = fs.mkdtempSync(path.join(os.tmpdir(), 'balcao-anexos-'))
const customer: CurrentUser = { id: 'c1', role: 'customer' }

function file(size: number, mimeType: string, originalName: string) {
  return { size, mimeType, originalName, buffer: Buffer.alloc(Math.min(size, 16)) }
}

describe('AttachmentService', () => {
  const service = new AttachmentService(fakeAttachments, fakeTicketService, uploadDir)

  afterAll(() => fs.rmSync(uploadDir, { recursive: true, force: true }))

  it('exige arquivo', async () => {
    await expect(service.upload(customer, 't1', undefined)).rejects.toMatchObject({ status: 422 })
  })

  it('recusa arquivo maior que 5 MB', async () => {
    await expect(service.upload(customer, 't1', file(5 * 1024 * 1024 + 1, 'text/plain', 'a.txt'))).rejects.toMatchObject({
      status: 413,
      code: 'file_too_large',
    })
  })

  it('recusa tipo não suportado', async () => {
    await expect(service.upload(customer, 't1', file(10, 'image/gif', 'a.gif'))).rejects.toMatchObject({
      status: 415,
      code: 'unsupported_type',
    })
  })

  it('não deixa outro cliente enviar', async () => {
    await expect(service.upload({ id: 'c2', role: 'customer' }, 't1', undefined)).rejects.toMatchObject({ status: 404 })
  })

  it('grava o arquivo na pasta de anexos configurada', async () => {
    const attachment = await service.upload(customer, 't1', file(10, 'text/plain', 'nota.txt'))
    expect(attachment.storedName.endsWith('.txt')).toBe(true)
    expect(fs.existsSync(path.join(uploadDir, attachment.storedName))).toBe(true)
    const download = await service.getForDownload(customer, attachment.id)
    expect(download.filePath).toBe(path.join(uploadDir, attachment.storedName))
  })

  it('esconde o anexo de outro cliente', async () => {
    const attachment = await service.upload(customer, 't1', file(10, 'text/plain', 'nota.txt'))
    await expect(service.getForDownload({ id: 'c2', role: 'customer' }, attachment.id)).rejects.toMatchObject({ status: 404 })
  })
})
