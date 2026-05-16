# Production deployment

## Compose

Use `docker-compose.prod.yml` with strong secrets (never commit `.env`):

```bash
export JWT_SECRET=$(openssl rand -hex 32)
export AGENT_REGISTRATION_TOKEN=$(openssl rand -hex 24)
export MYSQL_ROOT_PASSWORD=...
export MYSQL_PASSWORD=...
export METRICS_TOKEN=$(openssl rand -hex 16)
export XDR_INGEST_KEY=$(openssl rand -hex 24)

docker compose -f docker-compose.prod.yml up -d --build
docker exec edr-backend npm run migrate
```

## Hardening checklist

- [ ] TLS termination (reverse proxy or `TLS_ENABLED`)
- [ ] `AGENT_REQUEST_SIGNING_REQUIRED=true`
- [ ] `AGENT_NONCE_STORE=mysql`
- [ ] Redis password / private network
- [ ] Restrict MySQL port to application subnet
- [ ] Enable MFA for all SOC admins
- [ ] Configure `METRICS_TOKEN` and scrape `/metrics` privately
- [ ] Run `npm run audit:verify` on schedule
- [ ] Agent: DPAPI key storage + optional mTLS (`docs/security/agent-mtls-enrollment.md`)

## Worker scaling

Scale `worker` service replicas when Redis queue depth grows. Kafka is optional (`KAFKA_ENABLED=true`) for high-volume XDR feeds.

## Backups

Follow `docs/ha-dr-runbook.md` for MySQL backups and DR evidence exports.
