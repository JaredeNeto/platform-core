import { z } from 'zod'

export const ResourceResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  status: z.enum(['active', 'inactive']),
  metadata: z.record(z.string(), z.unknown()).optional(),
  createdAt: z.string().datetime(),
})

export const ResourceListResponseSchema = z.object({
  data: z.array(ResourceResponseSchema),
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().positive(),
})

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(20),
})

export type ResourceResponse = z.infer<typeof ResourceResponseSchema>
export type ResourceListResponse = z.infer<typeof ResourceListResponseSchema>
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>