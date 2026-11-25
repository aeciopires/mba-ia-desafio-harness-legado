import { Router } from 'express'
import multer from 'multer'
import type { Services } from '../../container'
import { Reply, Ticket } from '../../domain/ticket'
import { asyncHandler } from '../errors'
import { currentUser, requireAuth } from '../middlewares/auth'

const upload = multer({ storage: multer.memoryStorage() })

function toTicketJson(t: Ticket) {
  return {
    id: t.id,
    title: t.title,
    description: t.description,
    status: t.status,
    category: t.category,
    priority: t.priority,
    triageStatus: t.triageStatus,
    customerId: t.customerId,
    assigneeId: t.assigneeId,
    createdAt: t.createdAt.toISOString(),
    updatedAt: t.updatedAt.toISOString(),
  }
}

function toReplyJson(r: Reply) {
  return {
    id: r.id,
    ticketId: r.ticketId,
    authorId: r.authorId,
    body: r.body,
    createdAt: r.createdAt.toISOString(),
    author: r.author,
  }
}

export default function ticketRoutes({ tickets, attachments, suggestions }: Services) {
  const router = Router()

  router.use(requireAuth)

  router.get(
    '/',
    asyncHandler(async (req, res) => {
      const result = await tickets.list(currentUser(req), req.query as { status?: string; page?: string })
      res.json({ ...result, items: result.items.map(toTicketJson) })
    }),
  )

  router.post(
    '/',
    asyncHandler(async (req, res) => {
      const ticket = await tickets.create(currentUser(req), req.body)
      res.status(201).json(toTicketJson(ticket))
    }),
  )

  router.get(
    '/:id',
    asyncHandler(async (req, res) => {
      const ticket = await tickets.getDetails(currentUser(req), req.params.id)
      res.json({
        ...toTicketJson(ticket),
        replies: ticket.replies.map(toReplyJson),
        attachments: ticket.attachments,
      })
    }),
  )

  router.post(
    '/:id/assign',
    asyncHandler(async (req, res) => {
      const ticket = await tickets.assign(currentUser(req), req.params.id)
      res.json(toTicketJson(ticket))
    }),
  )

  router.post(
    '/:id/resolve',
    asyncHandler(async (req, res) => {
      const ticket = await tickets.resolve(currentUser(req), req.params.id)
      res.json(toTicketJson(ticket))
    }),
  )

  router.post(
    '/:id/replies',
    asyncHandler(async (req, res) => {
      const reply = await tickets.addReply(currentUser(req), req.params.id, req.body)
      res.status(201).json(toReplyJson(reply))
    }),
  )

  router.post(
    '/:id/attachments',
    upload.single('file'),
    asyncHandler(async (req, res) => {
      const file = req.file
        ? { originalName: req.file.originalname, mimeType: req.file.mimetype, size: req.file.size, buffer: req.file.buffer }
        : undefined
      const attachment = await attachments.upload(currentUser(req), req.params.id, file)
      res.status(201).json(attachment)
    }),
  )

  router.post(
    '/:id/suggest-reply',
    asyncHandler(async (req, res) => {
      res.json(await suggestions.suggestReply(currentUser(req), req.params.id))
    }),
  )

  return router
}
