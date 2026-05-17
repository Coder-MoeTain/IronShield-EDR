# Database migration policy

## Official path

**All new environments and upgrades must use:**

```bash
cd server-node
npm run migrate          # apply pending migrations
npm run migrate:status   # inspect applied versions
npm run migrate:rollback # roll back last batch (when supported)
npm run seed             # optional demo data
```

Docker:

```bash
docker exec -it edr-backend-dev npm run migrate
docker exec -it edr-backend-dev npm run seed
```

## Legacy SQL files

Files under `database/*.sql` are **reference-only** for brownfield installs and historical context. They are **not** the supported upgrade path for new deployments.

- Use [legacy-migrations.md](legacy-migrations.md) only when `npm run migrate` cannot run.
- Do not add new schema changes as raw SQL-only files without a JS migration.

## New schema changes

1. Add an idempotent JS migration under `server-node/scripts/migrations/` (or the path used by `scripts/migrate.js`).
2. Register it in the migration runner manifest.
3. Implement **rollback** when the change is reversible (drop column, drop table, etc.).
4. Update `npm run migrate:status` output and document breaking changes in release notes.

## Deprecated

- `npm run migrate-all` — use `npm run migrate`.
- Individual `npm run migrate-*` aliases — kept for emergencies; do not use for greenfield installs.

## CI

Pull requests that change schema must include a migration and pass:

```bash
npm run migrate:validate
npm test
```
