# Security

## Current controls

- Verify every GitHub webhook using `X-Hub-Signature-256` before parsing or storing it.
- Keep webhook secrets and admin tokens in runtime secret storage, never in GitHub Issues, logs, or source files.
- Keep the service bound to localhost until it is placed behind an authenticated TLS edge.
- Keep the outbox outside the repository and restrict it to owner read/write permissions.
- Treat all webhook payloads and adapter responses as untrusted data.
- Do not add arbitrary outbound URL fetching or shell execution to adapters.

## Security backlog

- Replace the local bearer token with GitHub App installation authentication and short-lived operator sessions.
- Add replay-window checks and a durable delivery ledger for webhook deliveries.
- Add rate limiting and trusted-host enforcement at the deployment edge.
- Add schema validation for each adapter payload and reject unknown high-risk fields.
- Add dependency scanning, secret scanning, CodeQL, and signed release provenance in CI.
- Add authorization tests for every future state-changing endpoint.

The requested `alert-fix-71` branch was not found in the checked-out repositories or accessible `febuz` remotes; it remains a tracked security-workstream input until its owning repository is identified.
