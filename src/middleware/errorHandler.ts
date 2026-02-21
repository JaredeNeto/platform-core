import { FastifyError, FastifyRequest, FastifyReply } from 'fastify'
import { ZodError } from 'zod'
import { logger } from '../observability/logger.js'

interface ErrorResponse {
  error: string
  message: string
  details?: unknown
  requestId?: string
}

export function errorHandler(
  error: FastifyError | Error,
  request: FastifyRequest,
  reply: FastifyReply
): void {
  const requestId = request.id

  // Zod validation errors → 400
  if (error instanceof ZodError) {
    logger.warn({ requestId, issues: error.issues }, 'Validation error')

    const response: ErrorResponse = {
      error: 'validation_error',
      message: 'Request validation failed',
      details: error.issues.map((i) => ({
        path: i.path.join('.'),
        message: i.message,
      })),
      requestId,
    }

    reply.status(400).send(response)
    return
  }

  const statusCode = (error as FastifyError).statusCode ?? 500

  if (statusCode < 500) {
    logger.warn({ requestId, statusCode, message: error.message }, 'Client error')
  } else {
    logger.error({ requestId, statusCode, err: error }, 'Unhandled server error')
  }

  const response: ErrorResponse = {
    error: statusCode >= 500 ? 'internal_server_error' : 'request_error',
    message: statusCode >= 500 ? 'An unexpected error occurred' : error.message,
    requestId,
  }

  reply.status(statusCode).send(response)
}