# Legacy manual SQL migrations

IronShield now uses the formal migration runner as the **supported** upgrade path:

```bash
cd server-node
npm run migrate
npm run migrate:status
npm run seed
```

Use this document only when you must apply historical SQL files manually (brownfield DBs, air-gapped restores, or debugging).

## Fresh install (Docker — recommended)

```bash
cp .env.example .env
docker compose -f docker-compose.dev.yml up --build
docker exec -it edr-backend-dev npm run migrate
docker exec -it edr-backend-dev npm run seed
```

## Manual MySQL (legacy)

If you cannot run `npm run migrate`, apply files in order on an empty database:

1. `database/schema.sql`
2. `database/schema-phase3.sql` … `schema-phase6.sql`
3. Phase-specific files listed in the original README (network, antivirus, parity, etc.)

Then run idempotent JS migrations from `server-node` only when a specific feature requires them, for example:

```bash
npm run migrate-phase5-endpoints-tenant
npm run migrate-falcon-ui-pack
npm run migrate-xdr-events
```

Prefer `npm run migrate` — it records applied versions in `schema_migrations` and avoids double-apply mistakes.

## Deprecated scripts

Individual `npm run migrate-*` aliases remain for backward compatibility but are **deprecated** in favor of `npm run migrate`. Do not use `migrate-all` for new environments.
