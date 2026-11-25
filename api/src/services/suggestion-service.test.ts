import { describe, expect, it } from 'vitest'
import { SuggestionService } from './suggestion-service'
import { AppError } from '../domain/errors'
import { CurrentUser, Ticket, User } from '../domain/ticket'
import { createAiClient } from '../integrations/ai-client'

const ticket = { id: 't1', customerId: 'c1', title: 'Erro no login', description: 'Não entra de jeito nenhum' } as Ticket
const tickets = {
  getById: async (_user: CurrentUser, id: string) => {
    if (id !== ticket.id) throw new AppError(404, 'not_found', 'Chamado não encontrado')
    return ticket
  },
}
const users = { findById: async (id: string) => (id === 'c1' ? ({ id, name: 'Maria' } as User) : null) }
const agent: CurrentUser = { id: 'a1', role: 'agent' }

describe('SuggestionService', () => {
  const service = new SuggestionService(tickets, users, createAiClient({ mode: 'fake' }))

  it('cliente não pede sugestão', async () => {
    await expect(service.suggestReply({ id: 'c1', role: 'customer' }, 't1')).rejects.toMatchObject({
      status: 403,
      code: 'forbidden',
    })
  })

  it('sugere a resposta com o nome do cliente', async () => {
    expect(await service.suggestReply(agent, 't1')).toEqual({
      suggestion: 'Olá, Maria! Recebemos o seu chamado "Erro no login" e a nossa equipe já está analisando.',
    })
  })

  it('usa "cliente" quando o cliente não existe mais', async () => {
    const semCliente = new SuggestionService(tickets, { findById: async () => null }, createAiClient())
    const result = await semCliente.suggestReply(agent, 't1')
    expect(result.suggestion).toContain('Olá, cliente!')
  })

  it('404 para chamado inexistente', async () => {
    await expect(service.suggestReply(agent, 'x')).rejects.toMatchObject({ status: 404 })
  })
})
