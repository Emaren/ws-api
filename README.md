# WheatAndStone `ws-api`

Backend API repository for WheatAndStone.

## Current state

`ws-api` now uses a modular domain layout with explicit controller/service/repository boundaries for:

- auth
- users
- articles
- businesses
- inventory
- notifications
- billing
- rewards (crypto-ready ledger abstraction)

Persistence is currently in-memory through repository adapters, which keeps domain boundaries stable while backend storage is upgraded in later steps.

Production plumbing now includes:

- runtime env validation with startup fail-fast
- structured JSON request logging with request ids
- centralized structured error payloads
- health/readiness endpoints
- machine-readable API contract endpoint
- RBAC enforcement with role model `OWNER/ADMIN/EDITOR/CONTRIBUTOR/USER`

## Tech stack

- Node.js + Express 5
- TypeScript
- `tsx` for runtime execution in development

## Project layout

- `src/index.ts` server entrypoint
- `src/app.ts` composition root and route mounting
- `src/modules/*` domain modules (controller/service/repository)
- `src/infrastructure/memory/*` in-memory adapter store
- `src/shared/*` shared models/errors/helpers
- `docs/baseline-audit.md` current architecture, risk, and guardrail assessment

## Environment variables

- `PORT` optional, default `3012`
- `SERVICE_NAME` optional, default `ws-api`
- `NODE_ENV` one of `development|test|production` (default `development`)
- `LOG_LEVEL` one of `debug|info|warn|error` (default `info`)
- `CORS_ORIGINS` optional comma-separated allowlist
- `CORS_ALLOW_WILDCARD_IN_PROD` optional bool, default `true`
- `AUTH_SESSION_TTL_SECONDS` optional session ttl in seconds (default `604800`)
- `BOOTSTRAP_ADMIN_EMAIL` optional bootstrap owner account email
- `BOOTSTRAP_ADMIN_PASSWORD` optional bootstrap owner account password
- `BOOTSTRAP_ADMIN_NAME` optional bootstrap owner display name

## Scripts

- `npm run dev` start API with `tsx`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run start`
- `npm run verify`

## Known gaps (summary)

- No persistent database integration yet (in-memory repositories)
- Auth token is placeholder and not production-grade
- No automated CI pipeline yet (local scripts exist)

## Operational endpoints

- `GET /health` and `GET /api/health` for liveness
- `GET /ready` and `GET /api/ready` for readiness
- `GET /api/contract` for contract metadata
- `POST /auth/login`, `POST /auth/logout`, `GET /auth/me`, `GET /auth/session` for auth session flow

## Baseline documentation

- `docs/baseline-audit.md`
- `docs/repo-health.md`
- `docs/module-architecture.md`
- `docs/api-contract.md`
