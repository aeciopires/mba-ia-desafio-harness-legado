import { prisma } from './prisma'

export type CountRow = { key: string | null; count: number }

export interface StatsRepository {
  countByStatus(): Promise<CountRow[]>
  countByCategory(): Promise<CountRow[]>
  countByPriority(): Promise<CountRow[]>
}

class PrismaStatsRepository implements StatsRepository {
  async countByStatus() {
    const rows = await prisma.ticket.groupBy({ by: ['status'], _count: { _all: true } })
    return rows.map((r) => ({ key: r.status, count: r._count._all }))
  }

  async countByCategory() {
    const rows = await prisma.ticket.groupBy({ by: ['category'], _count: { _all: true } })
    return rows.map((r) => ({ key: r.category, count: r._count._all }))
  }

  async countByPriority() {
    const rows = await prisma.ticket.groupBy({ by: ['priority'], _count: { _all: true } })
    return rows.map((r) => ({ key: r.priority, count: r._count._all }))
  }
}

export const statsRepository = new PrismaStatsRepository()
