import { describe, expect, it } from 'vitest'
import { HealthService } from './health-service'

describe('HealthService', () => {
  it('responde ok quando o banco responde', async () => {
    const service = new HealthService({ ping: async () => {} })
    expect(await service.check()).toEqual({ status: 'ok', db: 'ok' })
  })

  it('propaga a falha do banco', async () => {
    const service = new HealthService({
      ping: async () => {
        throw new Error('banco fora')
      },
    })
    await expect(service.check()).rejects.toThrow('banco fora')
  })
})
