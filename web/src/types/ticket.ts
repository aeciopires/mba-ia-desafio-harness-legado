// Tipos de domínio usados pelo front. São uma cópia dos literais da API: o front não
// importa nada de api/ (gate G8), nem só tipos. Se a API mudar um literal, mude aqui também.
export type Role = 'customer' | 'agent' | 'admin'

export type TicketStatus = 'open' | 'in_progress' | 'resolved'

export type TicketCategory = 'billing' | 'technical' | 'account' | 'other'

export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent'

export type TriageStatus = 'pending' | 'done' | 'failed'
