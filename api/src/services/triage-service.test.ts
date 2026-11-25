import { describe, expect, it } from 'vitest'
import { TriageService } from './triage-service'
import { Ticket } from '../domain/ticket'
import { createAiClient } from '../integrations/ai-client'
import { TicketUpdate } from '../repositories/ticket-repository'

function ticket(id: string, title: string, description: string): Ticket {
  const now = new Date()
  return {
    id,
    title,
    description,
    status: 'open',
    category: null,
    priority: null,
    triageStatus: 'pending',
    customerId: 'c1',
    assigneeId: null,
    createdAt: now,
    updatedAt: now,
  }
}

function fakeQueue(items: Ticket[]) {
  return {
    items,
    findPendingTriage: async (limit: number) => items.filter((t) => t.triageStatus === 'pending').slice(0, limit),
    update: async (id: string, data: TicketUpdate) => {
      const t = items.find((x) => x.id === id)!
      Object.assign(t, data)
      return t
    },
  }
}

describe('TriageService', () => {
  it('classifica a fatura urgente como financeiro/urgente', async () => {
    const queue = fakeQueue([ticket('t1', 'Fatura em dobro, urgente', 'Paguei duas vezes a mesma fatura.')])
    const service = new TriageService(queue, createAiClient(), () => {})
    expect(await service.runOnce()).toBe(1)
    expect(queue.items[0]).toMatchObject({ category: 'billing', priority: 'urgent', triageStatus: 'done' })
  })

  it('marca falha quando a IA falha', async () => {
    const queue = fakeQueue([ticket('t2', 'Teste [falha-ia]', 'qualquer descrição aqui')])
    const logs: string[] = []
    const service = new TriageService(queue, createAiClient(), (m) => logs.push(m))
    await service.runOnce()
    expect(queue.items[0].triageStatus).toBe('failed')
    expect(logs[0]).toContain('falha na triagem do chamado t2')
  })

  it('processa no máximo 10 por rodada', async () => {
    const items = Array.from({ length: 12 }, (_, i) => ticket(`t${i}`, 'Dúvida', 'Como faço para exportar?'))
    const service = new TriageService(fakeQueue(items), createAiClient(), () => {})
    expect(await service.runOnce()).toBe(10)
    expect(await service.runOnce()).toBe(2)
  })
})
