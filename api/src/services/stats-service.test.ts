import { describe, expect, it } from 'vitest'
import { StatsService } from './stats-service'

describe('StatsService', () => {
  it('preenche zeros e agrupa sem triagem', async () => {
    const service = new StatsService({
      countByStatus: async () => [{ key: 'open', count: 3 }],
      countByCategory: async () => [
        { key: 'billing', count: 2 },
        { key: null, count: 1 },
      ],
      countByPriority: async () => [{ key: null, count: 3 }],
    })
    expect(await service.getStats()).toEqual({
      byStatus: { open: 3, in_progress: 0, resolved: 0 },
      byCategory: { billing: 2, technical: 0, account: 0, other: 0, untriaged: 1 },
      byPriority: { low: 0, medium: 0, high: 0, urgent: 0, untriaged: 3 },
    })
  })

  it('mantém a ordem das chaves', async () => {
    const service = new StatsService({
      countByStatus: async () => [],
      countByCategory: async () => [],
      countByPriority: async () => [],
    })
    const stats = await service.getStats()
    expect(Object.keys(stats.byStatus)).toEqual(['open', 'in_progress', 'resolved'])
    expect(Object.keys(stats.byCategory)).toEqual(['billing', 'technical', 'account', 'other', 'untriaged'])
  })
})
