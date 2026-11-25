import { Router } from 'express'
import type { Services } from '../../container'
import { asyncHandler } from '../errors'
import { currentUser, requireAuth } from '../middlewares/auth'

export default function attachmentRoutes({ attachments }: Services) {
  const router = Router()

  router.get(
    '/:id/download',
    requireAuth,
    asyncHandler(async (req, res) => {
      const { attachment, filePath } = await attachments.getForDownload(currentUser(req), req.params.id)
      const asciiName = attachment.originalName.replace(/[^\x20-\x7e]/g, '_').replace(/"/g, '')
      res.setHeader('Content-Type', attachment.mimeType)
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${asciiName}"; filename*=UTF-8''${encodeURIComponent(attachment.originalName)}`,
      )
      res.sendFile(filePath)
    }),
  )

  return router
}
