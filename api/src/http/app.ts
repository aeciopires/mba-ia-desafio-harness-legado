import express from 'express'
import cors from 'cors'
import { env } from '../config/env'
import type { Services } from '../container'
import healthRoutes from './routes/health'
import authRoutes from './routes/auth'
import ticketRoutes from './routes/tickets'
import attachmentRoutes from './routes/attachments'
import statsRoutes from './routes/stats'
import { errorHandler, notFoundHandler } from './errors'

export function createApp(services: Services) {
  const app = express()

  app.use(cors({ origin: env.CORS_ORIGIN }))
  app.use(express.json())

  app.use('/api/health', healthRoutes(services))
  app.use('/api/auth', authRoutes(services))
  app.use('/api/tickets', ticketRoutes(services))
  app.use('/api/attachments', attachmentRoutes(services))
  app.use('/api/stats', statsRoutes(services))

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
