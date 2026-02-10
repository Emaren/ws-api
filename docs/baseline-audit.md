# ws-api baseline audit (2026-02-10)

This document captures the current state of `ws-api` before backend hardening.

## 1) Architecture snapshot

`ws-api` is currently a minimal Express service with a single runtime file:

- `src/index.ts`

Exposed routes:

- `GET /` basic service heartbeat
- `GET /health` uptime/status
- `GET /ping` status probe
- `POST /login` checks credentials against in-memory array
- `POST /api/register` writes to in-memory array

There is no database integration yet, no persistent users, and no token/session issuance.

## 2) Script inventory

From `package.json`:

- `dev`: `tsx src/index.ts`

Current guardrail scripts missing:

- no `build`
- no `start`
- no `lint`
- no `test`
- no `typecheck`

## 3) Environment variable matrix

Currently observed:

- `PORT` (optional, defaults to `3012`)
- `SERVICE_NAME` (optional, defaults to `ws-api`)

No DB/auth/queue/provider env variables are wired yet.

## 4) Risk list (current)

High:

- User credentials are stored in plain text in memory.
- User data is non-persistent (process restart erases all users).
- No authentication token/session model despite `POST /login`.

Medium:

- No request validation layer.
- No rate limiting or brute-force protections.
- CORS is globally enabled with default permissive behavior.
- No structured error handling/logging middleware.

Low:

- Runtime shape diverges from expected production backend architecture (Prisma/Postgres/RBAC/API modules).

## 5) Missing guardrails

Security and auth:

- Password hashing (bcrypt/argon2)
- Session/JWT issuance and verification
- RBAC/authorization middleware
- Security middleware (`helmet`, strict CORS allowlist, rate limiting)

Reliability and quality:

- Persistent data model + migrations (Prisma/Postgres)
- Input validation schemas (zod/valibot)
- Unit/integration tests and CI checks
- `build`, `start`, `lint`, `typecheck`, `test` scripts

Operations:

- Structured logs + request IDs
- Error taxonomy and centralized error handler
- Health/readiness split suitable for deploy orchestration

## 6) Immediate documentation baseline

Reference docs:

- `README.md` (current setup + env + scripts)
- `docs/baseline-audit.md` (this current-state audit)
