import { FastifyInstance } from 'fastify'
import { TokenRequestSchema, TokenResponse } from '../contracts/auth.js'
import { logger } from '../observability/logger.js'

// Simulated credential store — in production: DB lookup com hash bcrypt
const VALID_CLIENTS: Record<string, { secret: string; allowedScopes: string[] }> = {
  'client-demo': {
    secret: 'demo-secret-123',
    allowedScopes: ['resources:read', 'resources:write'],
  },
}

export async function authRoutes(app: FastifyInstance): Promise<void> {
  app.post<{ Body: unknown }>('/auth/token', async (request, reply) => {
    const parsed = TokenRequestSchema.safeParse(request.body)

    if (!parsed.success) {
      return reply.status(400).send({
        error: 'validation_error',
        message: 'Invalid request body',
        details: parsed.error.issues,
      })
    }

    const { clientId, clientSecret, scope } = parsed.data
    const client = VALID_CLIENTS[clientId]

    if (!client || client.secret !== clientSecret) {
      logger.warn({ clientId }, 'Invalid client credentials')
      return reply.status(401).send({
        error: 'unauthorized',
        message: 'Invalid client credentials',
      })
    }

    const invalidScopes = scope.filter((s) => !client.allowedScopes.includes(s))
    if (invalidScopes.length > 0) {
      return reply.status(403).send({
        error: 'forbidden',
        message: `Scopes not allowed for this client: ${invalidScopes.join(', ')}`,
      })
    }

    const token = app.jwt.sign({ sub: clientId, scope }, { expiresIn: '1h' })

    logger.info({ clientId, scope }, 'Token issued')

    const response: TokenResponse = {
      accessToken: token,
      tokenType: 'Bearer',
      expiresIn: 3600,
      scope,
    }

    return reply.status(200).send(response)
  })
}