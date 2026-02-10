# ws-api contract (v2b baseline)

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

Legacy aliases preserved:

- `POST /api/register`
- `POST /login`

## Domain routes

- Users: `GET /users`, `PATCH /users/:id/role`
- Articles: `GET /articles`, `POST /articles`
- Businesses: `GET /businesses`, `POST /businesses`
- Inventory: `GET /inventory/items`, `POST /inventory/items`
- Notifications: `GET /notifications/jobs`, `POST /notifications/jobs`
- Billing: `GET /billing/customers`, `POST /billing/customers`
- Rewards: `GET /rewards/ledger`, `POST /rewards/ledger`

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
