import { CountRow, StatsRepository } from '../repositories/stats-repository'

function tally(rows: CountRow[], initial: Record<string, number>, nullKey?: string) {
  const result = { ...initial }
  rows.forEach((row) => {
    const key = row.key ?? nullKey
    if (key) result[key] = row.count
  })
  return result
}

export class StatsService {
  constructor(private stats: StatsRepository) {}

  async getStats() {
    const [statusRows, categoryRows, priorityRows] = await Promise.all([
      this.stats.countByStatus(),
      this.stats.countByCategory(),
      this.stats.countByPriority(),
    ])
    return {
      byStatus: tally(statusRows, { open: 0, in_progress: 0, resolved: 0 }),
      byCategory: tally(categoryRows, { billing: 0, technical: 0, account: 0, other: 0, untriaged: 0 }, 'untriaged'),
      byPriority: tally(priorityRows, { low: 0, medium: 0, high: 0, urgent: 0, untriaged: 0 }, 'untriaged'),
    }
  }
}
