# Production deployment

See also [deployment/production.md](deployment/production.md) and [enterprise-hardening.md](enterprise-hardening.md).

## Required environment (production)

| Variable | Requirement |
|----------|-------------|
| `JWT_SECRET` | ≥32 characters, not a known weak value |
| `AGENT_REGISTRATION_TOKEN` | ≥24 characters (break-glass; prefer enrollment tokens) |
| `AGENT_KEY_PEPPER` | ≥16 characters — hashes agent keys at rest |
| `DB_PASSWORD` | Non-empty |
| `TLS_ENABLED` | `true` (unless `ENFORCE_TLS_IN_PRODUCTION=false`) |
| `AGENT_MTLS_REQUIRED` | `true` (unless `ENFORCE_AGENT_MTLS_IN_PRODUCTION=false`) |
| `CORS_ORIGINS` | Explicit allowlist — no `*` |
| `METRICS_TOKEN` | Required when metrics enabled |
| `REDIS_URL` | Recommended for queue + nonce replay (`AGENT_NONCE_STORE=redis`) |

## Deploy

```bash
docker compose -f docker-compose.prod.yml up -d --build
docker exec edr-backend npm run migrate
```

## Post-deploy checks

```bash
curl -s https://your-host/healthz
curl -s https://your-host/readyz
cd server-node && npm run audit:verify
```

## Agent rollout

1. Issue single-use enrollment token per host.
2. Agent registers → receives raw `agent_key` once → stores via DPAPI.
3. Enable `AGENT_REQUEST_SIGNING_REQUIRED=true` after agents support signing.
4. Bind mTLS client certificates (`AGENT_MTLS_REQUIRED=true`).
