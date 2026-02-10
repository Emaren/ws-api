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

Compatibility routes preserved:

- `POST /login`
- `POST /api/register`
- `GET /health`
- `GET /api/health`

## Persistence strategy

Repositories are isolated behind interfaces so moving from memory to Prisma/Postgres can be done module-by-module without changing controller/service contracts.

## Next backend step

Replace in-memory repository implementations with Prisma-backed implementations while preserving the same service interfaces.
