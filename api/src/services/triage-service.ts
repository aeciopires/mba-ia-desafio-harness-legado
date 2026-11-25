import { AiClient } from '../integrations/ai-client'
import { TriageQueue } from '../repositories/ticket-repository'

const BATCH_SIZE = 10

export type TriageLogger = (message: string) => void

export class TriageService {
  constructor(
    private queue: TriageQueue,
    private ai: Pick<AiClient, 'classifyTicket'>,
    private log: TriageLogger = console.log,
  ) {}

  /** Classifica os chamados pendentes mais antigos. Falha da IA marca o chamado como "failed". */
  async runOnce() {
    const tickets = await this.queue.findPendingTriage(BATCH_SIZE)
    for (const ticket of tickets) {
      try {
        const result = await this.ai.classifyTicket(ticket)
        await this.queue.update(ticket.id, { category: result.category, priority: result.priority, triageStatus: 'done' })
        this.log(`chamado ${ticket.id} triado: ${result.category}/${result.priority}`)
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err)
        this.log(`falha na triagem do chamado ${ticket.id}: ${message}`)
        await this.queue.update(ticket.id, { triageStatus: 'failed' })
      }
    }
    return tickets.length
  }
}
