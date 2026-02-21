import { FastifyInstance } from 'fastify'
import { randomUUID } from 'crypto'
import { requireScope } from '../middleware/auth.js'
import { PaginationQuerySchema, ResourceListResponse } from '../contracts/resource.js'

// Simulated data layer — in production: replace with DB query
function generateMockResources(count: number) {
  return Array.from({ length: count }, (_, i) => ({
    id: randomUUID(),
    name: `Resource ${i + 1}`,
    status: i % 3 === 0 ? ('inactive' as const) : ('active' as const),
    metadata: { index: i },
    createdAt: new Date(Date.now() - i * 86400000).toISOString(),
  }))
}

const MOCK_TOTAL = 42

export async function resourceRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: unknown }>(
    '/api/resources',
    { preHandler: requireScope('resources:read') },
    async (request, reply) => {
      const parsed = PaginationQuerySchema.safeParse(request.query)

      if (!parsed.success) {
        return reply.status(400).send({
          error: 'validation_error',
          message: 'Invalid query parameters',
          details: parsed.error.issues,
        })
      }

      const { page, pageSize } = parsed.data

      const data = generateMockResources(Math.min(pageSize, MOCK_TOTAL))

      const response: ResourceListResponse = {
        data,
        total: MOCK_TOTAL,
        page,
        pageSize,
      }

      return reply.status(200).send(response)
    }
  )
}