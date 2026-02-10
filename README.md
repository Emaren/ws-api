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
- `CORS_ORIGINS` optional comma-separated allowlist
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
- Route-level authorization policies are not yet enforced per domain
- No automated CI pipeline yet (local scripts exist)

## Baseline documentation

- `docs/baseline-audit.md`
- `docs/repo-health.md`
