# WheatAndStone `ws-api`

Backend API repository for WheatAndStone.

## Current state

`ws-api` is a minimal Express + TypeScript service used as a scaffold.
It currently provides basic health and placeholder auth/register endpoints, but it is not yet the production source of truth for content/auth/business flows.

## Tech stack

- Node.js + Express 5
- TypeScript
- `tsx` for runtime execution in development

## Project layout

- `src/index.ts` main server entrypoint and all routes
- `docs/baseline-audit.md` current architecture, risk, and guardrail assessment

## Environment variables

- `PORT` optional, default `3012`
- `SERVICE_NAME` optional, default `ws-api`

## Scripts

- `npm run dev` start API with `tsx`

## Known gaps (summary)

- No persistent database integration
- No password hashing or token/session auth
- No RBAC or route authorization
- No lint/test/build/typecheck scripts

## Baseline documentation

- `docs/baseline-audit.md`
