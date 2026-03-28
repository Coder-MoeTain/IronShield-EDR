# Enterprise hardening (baseline)

This project includes an enterprise-ready *baseline* of security and reliability controls. Some items are implemented in code; others are deployment controls you must enforce (TLS, secrets, least-privilege DB, etc.).

## Security hardening

### Secrets management (Vault / KMS)

- Store secrets outside git.
- Inject secrets via environment variables (recommended) or a secrets manager.

Key secrets:
- `JWT_SECRET`
- `AGENT_REGISTRATION_TOKEN` (break-glass only; prefer per-tenant enrollment tokens)
- `DB_PASSWORD`
- `XDR_INGEST_KEY`
- `METRICS_TOKEN`

### TLS everywhere

- Terminate TLS at a reverse proxy (Nginx/Traefik/Caddy) and forward to the Node API.
- Set `TRUST_PROXY=true` so the API logs correct client IPs.

### Strict CORS posture

Set `CORS_ORIGINS` to an allowlist (comma-separated).

Example:

```bash
CORS_ORIGINS=https://edr.example.com,https://soc.example.com
```

If `CORS_ORIGINS` is empty, the backend allows **same-origin** browser requests only (other origins are blocked).

### Token rotation

- Rotate `JWT_SECRET` periodically.
- **Zero-downtime rotation**: set `JWT_SECRET` to the new key and set `JWT_SECRET_PREVIOUS` to the old key. New tokens are signed with the current secret; existing tokens signed with the previous key remain valid until they expire. Remove `JWT_SECRET_PREVIOUS` after the longest token TTL has passed.

### Least-privilege DB users

Run the app using a DB user that can:
- `SELECT/INSERT/UPDATE` on app tables
- **No** `DROP DATABASE`, **no** global privileges

Run migrations with a separate privileged user if desired.

## Audit / compliance

### Immutable audit logs (implemented)

The backend writes an immutable admin action trail into `audit_logs` on **every** `/api/admin/*` request.

Migration:

```bash
cd server-node
npm run migrate-audit-logs
```

Notes:
- Audit logging is **best-effort** (it will not break requests if DB insert fails).
- If the database insert fails, a line is appended to an NDJSON spill file (default `server-node/artifacts/audit-failures.ndjson`, or `AUDIT_FAILURE_LOG_PATH`) for replay and evidence recovery.
- Admin API audit entries include `requestId` (see **Request correlation** below).
- Sensitive fields are redacted (passwords/tokens/secrets).

### Request correlation

- Every HTTP response includes `X-Request-ID` (or propagates an incoming `X-Request-ID` / `X-Correlation-ID`).
- JSON error bodies include `requestId` when available for SOC/IR correlation with logs.

### Retention guarantees

Use the built-in retention policy system:
- Configure under **Enterprise → Retention Policies**
- Run retention jobs on a schedule (cron / worker)

## Reliability / operations

### Health checks (implemented)

- `GET /healthz` — liveness
- `GET /readyz` — readiness (checks DB)

### Metrics (Prometheus) (implemented)

- `GET /metrics`
- Protect with `METRICS_TOKEN` (sent via `X-Metrics-Token` header or `?token=` query)

Env:

```bash
METRICS_ENABLED=true
METRICS_TOKEN=change-me
```

### Migrations discipline (implemented)

Run all migrations consistently:

```bash
cd server-node
npm run migrate-all
```

See `server-node/MIGRATIONS.md`.

### Rate limits (implemented baseline)

Global API limits:
- `/api/agent`
- `/api/auth`
- `/api/admin`
- `/api/ingest`

Optional per-tenant limit:

```bash
ENABLE_TENANT_RATE_LIMIT=true
TENANT_RPM=600
```

## Endpoint trust model (next steps)

Not fully implemented yet:
- **mTLS** agent → server identity
- **certificate pinning**
- tamper protection
- full replay protection (idempotency is implemented via agent batch IDs; durable queue is delete-on-ack)
- SSO/OIDC/SAML for admin login
- full OTA update install/rollback

## CI/CD and security scanning (implemented baseline)

GitHub Actions workflows:
- `.github/workflows/ci.yml` — backend syntax check + dashboard build
- `.github/workflows/codeql.yml` — CodeQL JS analysis

## Threat model, control mapping, and assurance (substitute artifacts)

For a structured **threat model workbook**, **NIST-style control mapping**, and a **continuous assurance** program (dependency audit + tests + review checklist), see [docs/security/README.md](security/README.md). Run `npm run security-assurance` from `server-node` for automated checks.

