# ws-api contract (v13b push fallback)

Updated: 2026-02-10

This contract describes the current modular API baseline and reliability endpoints.

## Runtime/ops endpoints

- `GET /` service identity
- `GET /ping` lightweight liveness probe
- `GET /health` liveness + module counters
- `GET /api/health` liveness alias
- `GET /ready` readiness checks
- `GET /api/ready` readiness alias
- `GET /api/contract` machine-readable contract payload

## Auth

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout` (requires `Authorization: Bearer <accessToken>`)
- `GET /auth/me` (requires bearer token)
- `GET /auth/session` (requires bearer token)

Legacy aliases preserved:

- `POST /api/register`
- `POST /login`
- `POST /logout`
- `GET /me`
- `GET /session`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/auth/session`

## Domain routes

- Users: `GET /users`, `PATCH /users/:id/role`
- Articles:
- `GET /articles` public published list; authenticated editorial roles get role-aware draft/review visibility
- `GET /articles/:slug` published public; draft/review/archived only for owner/staff
- `POST /articles` create article with `draft/review/published/archived` lifecycle rules
- `PATCH /articles/:slug` update content + lifecycle transition
- `DELETE /articles/:slug` delete with ownership and role checks
- Businesses: `GET /businesses`, `POST /businesses`
- Inventory: `GET /inventory/items`, `POST /inventory/items`
- Notifications:
- `GET /notifications/jobs`
- `POST /notifications/jobs`
- `POST /notifications/jobs/process`
- `POST /notifications/jobs/:id/retry`
- `GET /notifications/audit`
- `GET /notifications/jobs/:id/audit`
- push jobs support `webpush:<base64url(subscription-json)>` direct audiences
- push failures can queue metadata-configured fallback email/SMS jobs
- Billing: `GET /billing/customers`, `POST /billing/customers`
- Rewards:
- `GET /rewards/rules`
- `GET /rewards/ledger`
- `POST /rewards/accrual`
- `POST /rewards/ledger` (owner/admin manual grant)
- `GET /rewards/report` (owner/admin)
- `GET /rewards/export` (owner/admin, json/csv)
- `POST /rewards/export/mark` (owner/admin)
- `POST /rewards/export/settle` (owner/admin)

## Article lifecycle

- Statuses: `DRAFT`, `REVIEW`, `PUBLISHED`, `ARCHIVED`
- Contributors can only transition own articles between `DRAFT <-> REVIEW`
- Owner/Admin/Editor can apply full lifecycle transitions:
- `DRAFT -> REVIEW|ARCHIVED`
- `REVIEW -> DRAFT|PUBLISHED|ARCHIVED`
- `PUBLISHED -> ARCHIVED`
- `ARCHIVED -> DRAFT`

## RBAC role model

- `OWNER`
- `ADMIN`
- `EDITOR`
- `CONTRIBUTOR`
- `USER`

Legacy compatibility:

- `STONEHOLDER` is normalized to `USER`.

## Error format

Errors are returned as:

```json
{
  "error": {
    "message": "...",
    "statusCode": 400,
    "requestId": "..."
  }
}
```

## Logging

Every request emits a structured JSON log line with:

- `event=http_request`
- `requestId`
- `method`
- `path`
- `statusCode`
- `durationMs`

Set `LOG_LEVEL` (`debug|info|warn|error`) to control log output.
