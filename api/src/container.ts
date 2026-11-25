// Composição da aplicação: liga configuração, repositórios, integrações e serviços.
// A camada HTTP recebe os serviços prontos e nunca importa repositórios (gate G4).
import { env } from './config/env'
import { createAiClient } from './integrations/ai-client'
import { attachmentRepository } from './repositories/attachment-repository'
import { healthRepository } from './repositories/health-repository'
import { replyRepository } from './repositories/reply-repository'
import { statsRepository } from './repositories/stats-repository'
import { ticketRepository } from './repositories/ticket-repository'
import { userRepository } from './repositories/user-repository'
import { AttachmentService } from './services/attachment-service'
import { AuthService } from './services/auth-service'
import { HealthService } from './services/health-service'
import { StatsService } from './services/stats-service'
import { SuggestionService } from './services/suggestion-service'
import { TicketService } from './services/ticket-service'
import { TriageService } from './services/triage-service'

const ai = createAiClient({ mode: env.AI_MODE, apiKey: env.OPENAI_API_KEY })

export function buildServices() {
  const tickets = new TicketService(ticketRepository, replyRepository)
  return {
    auth: new AuthService(userRepository),
    tickets,
    attachments: new AttachmentService(attachmentRepository, tickets, env.UPLOAD_DIR),
    suggestions: new SuggestionService(tickets, userRepository, ai),
    stats: new StatsService(statsRepository),
    health: new HealthService(healthRepository),
  }
}

export type Services = ReturnType<typeof buildServices>

export function buildTriageService() {
  return new TriageService(ticketRepository, ai)
}
