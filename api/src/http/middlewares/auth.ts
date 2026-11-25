import { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../../config/env'
import { AppError } from '../../domain/errors'
import { CurrentUser, Role } from '../../domain/ticket'

type AuthenticatedRequest = Request & { user?: CurrentUser }

export function signToken(user: { id: string; role: string }) {
  return jwt.sign({ sub: user.id, role: user.role }, env.JWT_SECRET, { expiresIn: '8h' })
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'unauthorized', message: 'Token ausente' })
  }
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as jwt.JwtPayload
    ;(req as AuthenticatedRequest).user = { id: payload.sub as string, role: payload.role as Role }
    next()
  } catch {
    return res.status(401).json({ error: 'unauthorized', message: 'Token inválido' })
  }
}

export function requireRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const user = (req as AuthenticatedRequest).user
    if (!user || !roles.includes(user.role)) {
      return res.status(403).json({ error: 'forbidden', message: 'Sem permissão' })
    }
    next()
  }
}

/** Usuário autenticado por requireAuth. */
export function currentUser(req: Request): CurrentUser {
  const user = (req as AuthenticatedRequest).user
  if (!user) throw new AppError(401, 'unauthorized', 'Token ausente')
  return user
}
