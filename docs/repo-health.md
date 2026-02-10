# ws-api repo health baseline

Updated: 2026-02-10

## Purpose

This file defines the minimum reliable checks and hygiene standards for `ws-api`.

## Required scripts

- `npm run dev`
- `npm run typecheck`
- `npm run lint`
- `npm run test`
- `npm run build`
- `npm run verify`
- `npm run ci:migrations`

## Local verification flow

Run before pushing:

```bash
npm run verify
```

`verify` runs typecheck, test, and build in sequence.

Migration gate check:

```bash
npm run ci:migrations
```

## CI workflow

- Workflow: `.github/workflows/ci.yml`
- Gate order: migrations -> lint -> test -> build
- Reporting: writes a gate status table to the GitHub Actions step summary and fails if any gate is not `PASS`.

## Environment hygiene

- Keep local secrets in `.env` only.
- Keep `.env.example` in sync with active environment usage.
- Never commit private credentials.

## Guardrail status (current)

- Typecheck: available
- Lint: currently mapped to typecheck (eslint not yet configured)
- Test: baseline harness via Node test runner
- Build: deterministic TypeScript compile output to `dist/`

## Branch hygiene

- Mainline branch: `main`
- Keep commits scoped and reversible
- Prefix commit messages with current step id (for example `1b:`)
