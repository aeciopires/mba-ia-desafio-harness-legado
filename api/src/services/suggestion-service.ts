import { AppError } from '../domain/errors'
import { CurrentUser } from '../domain/ticket'
import { AiClient } from '../integrations/ai-client'
import { UserRepository } from '../repositories/user-repository'
import { TicketService } from './ticket-service'

export class SuggestionService {
  constructor(
    private tickets: Pick<TicketService, 'getById'>,
    private users: Pick<UserRepository, 'findById'>,
    private ai: Pick<AiClient, 'suggestReply'>,
  ) {}

  async suggestReply(user: CurrentUser, ticketId: string) {
    if (user.role === 'customer') {
      throw new AppError(403, 'forbidden', 'Só atendentes e admins podem pedir sugestão')
    }
    const ticket = await this.tickets.getById(user, ticketId)
    const customer = await this.users.findById(ticket.customerId)
    const customerName = customer ? customer.name : 'cliente'
    const suggestion = await this.ai.suggestReply({ customerName, title: ticket.title, description: ticket.description })
    return { suggestion }
  }
}
