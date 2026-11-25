import { z } from 'zod'

// Único lugar da API que lê process.env (gate G5). Os padrões reproduzem o comportamento
// original; endereços fixos (gate G11) também só podem aparecer em config/.

// Variável vazia no .env (ex.: OPENAI_API_KEY=) vale como não definida.
const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess((v) => (v === '' ? undefined : v), schema)

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  NODE_ENV: optional(z.enum(['development', 'test', 'production']).default('development')),
  PORT: optional(z.coerce.number().int().positive().default(4000)),
  JWT_SECRET: optional(z.string().min(1).default('dev-secret')),
  AI_MODE: optional(z.string().default('fake')),
  OPENAI_API_KEY: optional(z.string().optional()),
  UPLOAD_DIR: optional(z.string().min(1).default('/tmp/balcao/uploads')),
  TRIAGE_INTERVAL_MS: optional(z.coerce.number().int().positive().default(2000)),
  CORS_ORIGIN: optional(z.string().min(1).default('http://localhost:5173')),
})

export const env = schema.parse(process.env)
