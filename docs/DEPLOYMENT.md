# IronShield EDR — Deployment

**See also:** [deployment-production.md](deployment-production.md), [deployment/production.md](deployment/production.md), [docker-compose.prod.yml](../docker-compose.prod.yml)

## Quick start (development)

```bash
docker compose -f docker-compose.dev.yml up -d
cd server-node && npm ci && npm run migrate && npm run seed
cd dashboard && npm ci && npm run build
cd ../server-node && npm run dev
```

## Production checklist

1. Set `NODE_ENV=production`, `TLS_ENABLED=true`, `AGENT_MTLS_REQUIRED=true`, `AGENT_REQUEST_SIGNING_REQUIRED=true`, `AGENT_KEY_PEPPER`, `RESPONSE_COMMAND_SIGNING_REQUIRED=true`
2. Configure `CORS_ORIGINS` (no wildcard), `METRICS_TOKEN`, strong `JWT_SECRET`
3. Use Redis for nonce replay (`AGENT_NONCE_STORE=redis`, `REDIS_URL`)
4. Run `npm run migrate` and `npm run audit:verify`
5. Set agent `RequireSignedResponseCommands: true` in config after enrollment
6. Review [PROFESSIONAL_UPGRADE_AUDIT.md](PROFESSIONAL_UPGRADE_AUDIT.md) acceptance criteria

## Health endpoints

| Path | Purpose |
|------|---------|
| `/healthz` | Liveness |
| `/readyz` | Readiness (DB/Redis) |
| `/metrics` | Prometheus (token required in prod) |
