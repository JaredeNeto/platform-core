import Fastify from 'fastify'
import { logger } from './observability/logger.js'

async function buildServer() {
  const app = Fastify({
    logger: false, // Usamos pino diretamente para controle de structured logging
    genReqId: () => crypto.randomUUID(),
    trustProxy: true,
  })

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
