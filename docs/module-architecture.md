# ws-api module architecture

Updated: 2026-02-10

`ws-api` now follows a three-layer domain structure:

- `controller`: HTTP boundary (request parsing + response mapping)
- `service`: domain rules and validation
- `repository`: persistence abstraction (currently in-memory)

## Domain modules

- `auth`
- `users`
- `articles`
- `businesses`
- `inventory`
- `notifications`
- `billing`
- `rewards`

## Composition root

`src/app.ts` owns service wiring:

1. load repositories (currently in-memory)
2. construct services per domain
3. mount routers and compatibility aliases
4. apply production middleware (request context, request logging, not-found + error handling)

Notification module notes:

- Provider abstraction is channel-based (`email`, `sms`, `push`).
- Email supports live Resend delivery when configured; otherwise dev adapter is used.
- Jobs are queued and processed with retry/backoff semantics plus immutable audit logs.

Compatibility routes preserved:

- `POST /login`
- `POST /api/register`
- `GET /health`
- `GET /api/health`

Operational routes:

- `GET /ready`
- `GET /api/ready`
- `GET /api/contract`
- `POST /auth/logout`
- `GET /auth/me`
- `GET /auth/session`

## Persistence strategy

Repositories are isolated behind interfaces so moving from memory to Prisma/Postgres can be done module-by-module without changing controller/service contracts.

## Next backend step

Replace in-memory repository implementations with Prisma-backed implementations while preserving the same service interfaces.
