import { z } from 'zod'

export const TokenRequestSchema = z.object({
  clientId: z.string().min(1, 'clientId is required'),
  clientSecret: z.string().min(8, 'clientSecret must be at least 8 characters'),
  scope: z.array(z.string()).min(1, 'at least one scope is required'),
})

export const TokenResponseSchema = z.object({
  accessToken: z.string(),
  tokenType: z.literal('Bearer'),
  expiresIn: z.number(),
  scope: z.array(z.string()),
})

export const JwtPayloadSchema = z.object({
  sub: z.string(),
  scope: z.array(z.string()),
  iat: z.number(),
  exp: z.number(),
})

export type TokenRequest = z.infer<typeof TokenRequestSchema>
export type TokenResponse = z.infer<typeof TokenResponseSchema>
export type JwtPayload = z.infer<typeof JwtPayloadSchema>