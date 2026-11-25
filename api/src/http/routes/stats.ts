import { Router } from 'express'
import type { Services } from '../../container'
import { requireAuth, requireRole } from '../middlewares/auth'

export default function statsRoutes({ stats }: Services) {
  const router = Router()

  router.get('/', requireAuth, requireRole('admin'), async (_req, res, next) => {
    try {
      res.json(await stats.getStats())
    } catch (err) {
      next(err)
    }
  })

  return router
}
