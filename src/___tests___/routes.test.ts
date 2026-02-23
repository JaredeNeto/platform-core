import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import Fastify, { FastifyInstance } from 'fastify'
import fastifyJwt from '@fastify/jwt'
import fastifyRateLimit from '@fastify/rate-limit'
import { authRoutes } from '../routes/auth.js'
import { resourceRoutes } from '../routes/resource.js'
import { errorHandler } from '../middleware/errorHandler.js'

// Cria uma instância de teste isolada — sem import do tracer OTel
// O tracer usa monkey-patching global e não deve ser inicializado em testes
async function buildTestServer(): Promise<FastifyInstance> {
  const app = Fastify({ logger: false })

  await app.register(fastifyJwt, { secret: 'test-secret' })
  await app.register(fastifyRateLimit, { max: 1000, timeWindow: 60_000 })

  app.setErrorHandler(errorHandler)
  app.get('/health', async () => ({ status: 'ok' }))

  await app.register(authRoutes)
  await app.register(resourceRoutes)

  await app.ready()
  return app
}

describe('Health', () => {
  let app: FastifyInstance

  beforeAll(async () => { app = await buildTestServer() })
  afterAll(async () => { await app.close() })

  it('GET /health returns 200', async () => {
    const res = await app.inject({ method: 'GET', url: '/health' })
    expect(res.statusCode).toBe(200)
    expect(res.json()).toMatchObject({ status: 'ok' })
  })
})

describe('Auth', () => {
  let app: FastifyInstance

  beforeAll(async () => { app = await buildTestServer() })
  afterAll(async () => { await app.close() })

  it('POST /auth/token with valid credentials returns token', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: {
        clientId: 'client-demo',
        clientSecret: 'demo-secret-123',
        scope: ['resources:read'],
      },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.tokenType).toBe('Bearer')
    expect(body.accessToken).toBeDefined()
    expect(body.scope).toEqual(['resources:read'])
  })

  it('POST /auth/token with invalid credentials returns 401', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: {
        clientId: 'client-demo',
        clientSecret: 'wrong-secret',
        scope: ['resources:read'],
      },
    })

    expect(res.statusCode).toBe(401)
    expect(res.json().error).toBe('unauthorized')
  })

  it('POST /auth/token with invalid scope returns 403', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: {
        clientId: 'client-demo',
        clientSecret: 'demo-secret-123',
        scope: ['admin:delete'],
      },
    })

    expect(res.statusCode).toBe(403)
    expect(res.json().error).toBe('forbidden')
  })

  it('POST /auth/token with missing fields returns 400 with details', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: { clientId: 'client-demo' },
    })

    expect(res.statusCode).toBe(400)
    const body = res.json()
    expect(body.error).toBe('validation_error')
    expect(body.details).toHaveLength(2) // clientSecret e scope
  })
})

describe('Resources', () => {
  let app: FastifyInstance
  let token: string

  beforeAll(async () => {
    app = await buildTestServer()

    const res = await app.inject({
      method: 'POST',
      url: '/auth/token',
      payload: {
        clientId: 'client-demo',
        clientSecret: 'demo-secret-123',
        scope: ['resources:read'],
      },
    })

    token = res.json().accessToken
  })

  afterAll(async () => { await app.close() })

  it('GET /api/resources without token returns 401', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/resources' })
    expect(res.statusCode).toBe(401)
  })

  it('GET /api/resources with valid token returns paginated list', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/resources?page=1&pageSize=10',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.data).toHaveLength(10)
    expect(body.total).toBe(42)
    expect(body.page).toBe(1)
    expect(body.pageSize).toBe(10)
  })

  it('GET /api/resources with invalid pagination returns 400', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/resources?page=0',
      headers: { authorization: `Bearer ${token}` },
    })

    expect(res.statusCode).toBe(400)
    expect(res.json().error).toBe('validation_error')
  })
})