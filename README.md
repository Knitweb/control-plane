# Knitweb Control Plane

Secure, event-driven control plane for the active febuz and Knitweb repository cluster.

## First vertical slice

GitHub webhook → HMAC verification → normalized `knitweb.control.event/v1` event → durable JSONL outbox → authenticated event query.

The service is intentionally read-only toward product repositories in v0.1. It does not execute shell commands, fetch arbitrary URLs, expose secrets, or mutate GitHub state.

## Run

```bash
npm install
npm test
GITHUB_WEBHOOK_SECRET='local-secret' CONTROL_PLANE_ADMIN_TOKEN='local-admin-token' npm start
```

The health endpoint is `GET /health`. Authenticated event inspection uses `Authorization: Bearer <CONTROL_PLANE_ADMIN_TOKEN>` at `GET /api/events`.

## Security baseline

- GitHub webhook signatures are verified with HMAC-SHA256 and constant-time comparison.
- Webhook bodies are capped at 1 MiB and must be JSON.
- Event inspection requires a bearer token and bounded pagination.
- Responses disable caching, framing, MIME sniffing, and referrer leakage.
- Outbox files are created with owner-only permissions and are excluded from Git.
- Errors return generic responses without stack traces or secret material.

See `SECURITY.md` for the control-plane threat model and deferred hardening work.
