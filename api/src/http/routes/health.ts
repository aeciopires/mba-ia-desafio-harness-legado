import { Router } from 'express'
import type { Services } from '../../container'

export default function healthRoutes({ health }: Services) {
  const router = Router()

  router.get('/', async (_req, res) => {
    try {
      res.json(await health.check())
    } catch (err) {
      console.log('health: banco fora', err)
      res.status(503).json({ error: 'db_unavailable', message: 'Banco de dados não responde' })
    }
  })

  return router
}
