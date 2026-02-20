import pino from 'pino'

// pino-pretty é usado apenas via `npm run dev` (fora do Docker)
// Dentro do container, logs saem como JSON estruturado — correto para produção
export const logger = pino({
  level: process.env.LOG_LEVEL ?? 'info',
  base: {
    service: process.env.OTEL_SERVICE_NAME ?? 'platform-core',
    env: process.env.NODE_ENV ?? 'development',
  },
  redact: {
    paths: ['req.headers.authorization', '*.password', '*.token'],
    censor: '[REDACTED]',
  },
})
