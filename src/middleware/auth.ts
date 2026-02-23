import { FastifyRequest, FastifyReply } from 'fastify'
import { JwtPayloadSchema } from '../contracts/auth.js'
import { logger } from '../observability/logger.js'
import { trace, SpanStatusCode } from '@opentelemetry/api'

export function requireScope(...requiredScopes: string[]) {
  return async function scopeGuard(
    request: FastifyRequest,
    reply: FastifyReply
  ): Promise<void> {
    // Pega o span ativo criado automaticamente pelo OTel para este request
    const span = trace.getActiveSpan()

    try {
      await request.jwtVerify()

      const parsed = JwtPayloadSchema.safeParse(request.user)

      if (!parsed.success) {
        logger.warn({ requestId: request.id }, 'Invalid JWT payload shape')
        span?.setStatus({ code: SpanStatusCode.ERROR, message: 'invalid_token' })
        return reply.status(401).send({
          error: 'unauthorized',
          message: 'Invalid token payload',
        })
      }

      const { scope, sub } = parsed.data
      const hasScope = requiredScopes.every((s) => scope.includes(s))

      // Enriquece o span com contexto de autenticação
      // Esses atributos aparecem no trace — útil para filtrar por usuário ou scope no Datadog
      span?.setAttributes({
        'auth.subject': sub,
        'auth.scopes': scope.join(' '),
        'auth.required_scopes': requiredScopes.join(' '),
        'auth.authorized': hasScope,
      })

      if (!hasScope) {
        logger.warn(
          { requestId: request.id, sub, scope, requiredScopes },
          'Insufficient scope'
        )
        span?.setStatus({ code: SpanStatusCode.ERROR, message: 'insufficient_scope' })
        return reply.status(403).send({
          error: 'forbidden',
          message: `Required scopes: ${requiredScopes.join(', ')}`,
        })
      }

      request.authPayload = parsed.data
    } catch (err) {
      logger.warn({ requestId: request.id, err }, 'JWT verification failed')
      span?.setStatus({ code: SpanStatusCode.ERROR, message: 'jwt_verification_failed' })
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