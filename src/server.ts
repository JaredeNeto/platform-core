import Fastify from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyRateLimit from '@fastify/rate-limit'
import './observability/tracer.js'

import { logger } from './observability/logger.js'
import { errorHandler } from './middleware/errorHandler.js'
import { authRoutes } from './routes/auth.js'
import { resourceRoutes } from './routes/resource.js'

async function buildServer() {
  const app = Fastify({
    logger: false,
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  })

  // --- Plugins ---

  await app.register(fastifyJwt, {
    secret: process.env.JWT_SECRET ?? 'fallback-secret-not-for-production',
  })

  await app.register(fastifyRateLimit, {
    max: Number(process.env.RATE_LIMIT_MAX ?? 100),
    timeWindow: Number(process.env.RATE_LIMIT_WINDOW_MS ?? 60_000),
    errorResponseBuilder: (_request, context) => ({
      error: 'rate_limit_exceeded',
      message: `Too many requests. Retry after ${context.after}`,
    }),
  })

  // --- Error handler ---
  app.setErrorHandler(errorHandler)

  // --- Health endpoints ---

  app.get('/health', async () => ({
    status: 'ok',
    timestamp: new Date().toISOString(),
  }))

  app.get('/ready', async (_request, reply) => {
    // Em produção: verificar conexões com DB, cache, dependências externas
    // Por ora, o servidor estar de pé já é suficiente
    return reply.status(200).send({
      status: 'ready',
      checks: {
        server: 'ok',
      },
    })
  })

  // --- Routes ---
  await app.register(authRoutes)
  await app.register(resourceRoutes)

  // --- Request logging ---

  app.addHook('onRequest', async (request) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
      },
      'Incoming request'
    )
  })

  app.addHook('onResponse', async (request, reply) => {
    logger.info(
      {
        requestId: request.id,
        method: request.method,
        url: request.url,
        statusCode: reply.statusCode,
        responseTime: reply.elapsedTime,
      },
      'Request completed'
    )
  })

  return app
}

async function main() {
  const app = await buildServer()
  const port = Number(process.env.PORT ?? 3000)

  try {
    await app.listen({ port, host: '0.0.0.0' })
    logger.info({ port }, 'Server started')
  } catch (err) {
    logger.error({ err }, 'Failed to start server')
    process.exit(1)
  }

  // Graceful shutdown — crítico em ambientes containerizados
  // Kubernetes manda SIGTERM antes de matar o pod
  // Sem isso, requisições em andamento são abortadas abruptamente
  const shutdown = async (signal: string) => {
    logger.info({ signal }, 'Shutdown signal received')
    await app.close()
    logger.info('Server closed gracefully')
    process.exit(0)
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'))
  process.on('SIGINT', () => shutdown('SIGINT'))
}

main()
