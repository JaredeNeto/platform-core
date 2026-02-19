# platform-core

> A production-inspired platform service demonstrating shared infrastructure patterns: API gateway, authentication middleware, inter-service contracts, and observability instrumentation.

Built to reflect real platform engineering challenges in high-traffic environments — not a tutorial project.

---

## What this demonstrates

| Pattern | Implementation |
|---|---|
| API Gateway | Fastify with rate limiting, request routing, and response normalization |
| Auth Middleware | JWT validation layer with scope-based access control |
| Shared Contracts | Zod schemas as the single source of truth for request/response shapes |
| Observability | OpenTelemetry traces, structured logging, and health/readiness endpoints |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│                  platform-core                  │
│                                                 │
│  ┌─────────────┐     ┌──────────────────────┐   │
│  │ API Gateway │────▶│   Auth Middleware     │   │
│  │ rate limit  │     │   JWT + scopes        │   │
│  └──────┬──────┘     └──────────┬───────────┘   │
│         │                       │               │
│         ▼                       ▼               │
│  ┌─────────────────────────────────────────┐    │
│  │            Route Handlers               │    │
│  │     validated against Zod contracts     │    │
│  └─────────────────────────────────────────┘    │
│         │                                       │
│         ▼                                       │
│  ┌─────────────────────────────────────────┐    │
│  │         OpenTelemetry Instrumentation   │    │
│  │     traces · structured logs · metrics  │    │
│  └─────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘
```

---

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Fastify
- **Validation:** Zod
- **Observability:** OpenTelemetry SDK + OTLP exporter
- **Auth:** JWT (jose)
- **Containerization:** Docker + Docker Compose

---

## Getting started

**Prerequisites:** Docker and Docker Compose installed.

```bash
git clone https://github.com/jaredeneto/platform-core.git
cd platform-core

cp .env.example .env

docker-compose up
```

The service will be available at `http://localhost:3000`.

### Endpoints

```
GET  /health         → liveness check
GET  /ready          → readiness check (dependencies)
POST /auth/token     → issues a JWT for testing
GET  /api/resource   → protected route (requires Bearer token)
```

---

## Project structure

```
src/
├── contracts/          # Zod schemas — shared source of truth
│   ├── auth.ts
│   └── resource.ts
├── middleware/
│   ├── auth.ts         # JWT validation + scope enforcement
│   ├── rateLimit.ts    # Rate limiting per client/IP
│   └── errorHandler.ts # Normalized error responses
├── routes/
│   ├── auth.ts
│   └── resource.ts
├── observability/
│   ├── tracer.ts       # OpenTelemetry setup
│   └── logger.ts       # Structured JSON logging
└── server.ts           # Fastify bootstrap
```

---

## Architectural decisions

### Zod as the contract layer
Validation schemas live in `src/contracts/` and are imported by both route handlers and middleware. This enforces a single source of truth for data shapes — the same pattern used in platform teams where multiple squads consume shared APIs.

**Tradeoff:** adds a compile-time dependency on Zod across all consumers. In a real multi-repo setup, this would be published as a versioned internal package.

### OpenTelemetry over vendor-specific SDKs
The observability layer uses the OTel SDK with an OTLP exporter, keeping the instrumentation vendor-neutral. In production, you'd point the exporter to Datadog, Grafana, or any OTLP-compatible backend without changing application code.

**Tradeoff:** slightly more setup than using a vendor SDK directly, but eliminates lock-in.

### Fastify over Express
Chosen for its schema-first design, built-in serialization, and lower overhead. In high-traffic platform services, the performance delta matters.

---

## What I'd do differently in production

- Publish Zod contracts as a versioned internal package (npm private registry or Artifactory)
- Add a service mesh layer (Envoy/Istio) to offload rate limiting and mTLS from application code
- Replace local JWT issuance with an actual identity provider (Keycloak, Auth0)
- Add structured error codes aligned with RFC 7807 (Problem Details)
- Configure OpenTelemetry sampling strategy based on SLO error budget

---

## Author

**Jarede Neto** · Senior Backend Engineer  
[LinkedIn](https://www.linkedin.com/in/jaredeneto/) · Available for remote contracts in USD
