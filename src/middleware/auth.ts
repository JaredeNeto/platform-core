import { FastifyRequest, FastifyReply } from 'fastify'
import { JwtPayloadSchema } from '../contracts/auth.js'
import { logger } from '../observability/logger.js'

export function requireScope(...requiredScopes: string[]) {
  return async function scopeGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    try {
      await request.jwtVerify()

      const parsed = JwtPayloadSchema.safeParse(request.user)

      if (!parsed.success) {
        logger.warn({ requestId: request.id }, 'Invalid JWT payload shape')
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Invalid token payload',
        })
      }

      const { scope, sub } = parsed.data
      const hasScope = requiredScopes.every((s) => scope.includes(s))

      if (!hasScope) {
        logger.warn(
          { requestId: request.id, sub, scope, requiredScopes },
          'Insufficient scope'
        )
        return reply.status(403).send({
          error: 'forbidden',
          message: `Required scopes: ${requiredScopes.join(', ')}`,
        })
      }

      request.authPayload = parsed.data
    } catch (err) {
      logger.warn({ requestId: request.id, err }, 'JWT verification failed')
      return reply.status(401).send({
        error: 'unauthorized',
        message: 'Invalid or expired token',
      })
    }
  }
}

// Estende a tipagem do Fastify para incluir o payload do JWT
declare module 'fastify' {
  interface FastifyRequest {
    authPayload?: import('../contracts/auth.js').JwtPayload
  }
}