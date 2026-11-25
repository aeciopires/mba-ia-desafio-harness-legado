import { execFileSync } from 'node:child_process'
import path from 'node:path'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { cleanDatabase, prisma } from './helpers'

const API_DIR = path.resolve(__dirname, '../..')

function runSeed() {
  return execFileSync(path.join(API_DIR, 'node_modules/.bin/tsx'), ['prisma/seed.ts'], {
    cwd: API_DIR,
    env: { ...process.env, DATABASE_URL: process.env.DATABASE_URL },
    encoding: 'utf8',
  })
}

describe('seed', () => {
  beforeAll(async () => {
    await cleanDatabase()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('roda duas vezes no mesmo banco sem falhar nem duplicar (make up repetido)', async () => {
    expect(runSeed()).toContain('seed ok')
    expect(runSeed()).toContain('seed ok')

    const users = await prisma.user.findMany({ orderBy: { email: 'asc' } })
    expect(users.map((u) => [u.email, u.role])).toEqual([
      ['admin@balcao.dev', 'admin'],
      ['agente@balcao.dev', 'agent'],
      ['cliente@balcao.dev', 'customer'],
    ])
    expect(await prisma.ticket.count()).toBe(3)
    expect(await prisma.reply.count()).toBe(3)
  })
})
