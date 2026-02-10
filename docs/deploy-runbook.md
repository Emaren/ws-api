# ws-api deploy runbook

Updated: 2026-02-10

## Scope

This runbook covers production pull/restart/smoke for `ws-api` on hel1.

## Preconditions

- Repo path: `/var/www/wheatandstone/ws-api`
- Service: `wheatandstone-api.service`
- Branch policy: `main` only

## Deploy sequence

```bash
cd /var/www/wheatandstone/ws-api
git fetch --prune origin
git checkout main
git pull --ff-only origin main
npm ci
npm run build
sudo systemctl restart wheatandstone-api
sudo systemctl --no-pager --full status wheatandstone-api
```

## Smoke checks

```bash
cd /var/www/wheatandstone/ws-api
BASE_URL=http://127.0.0.1:3310 PUBLIC_URL=https://api.wheatandstone.ca npm run smoke:http
```

Expected:

- `/health` returns `200` with `"status":"ok"`
- `/ready` returns `200` with `"status":"ready"`
- `/api/contract` returns `200`

## Parity verification

Compare commit hashes for local MBP, GitHub `origin/main`, and VPS working tree:

```bash
git rev-parse HEAD
git rev-parse origin/main
```

If hashes differ, stop and reconcile before further deploy steps.

## Recovery

If smoke fails:

```bash
sudo journalctl -u wheatandstone-api -n 200 --no-pager
sudo systemctl restart wheatandstone-api
```

If failure persists, roll back to the last known-good commit and restart service.
