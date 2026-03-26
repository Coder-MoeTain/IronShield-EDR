## Migrations (production discipline)

This repo uses **idempotent Node.js migration scripts** under `server-node/scripts/`.

### Recommended (one command)

From `server-node/`:

```bash
npm run migrate-all
```

### Notes

- **Idempotent**: scripts use `CREATE TABLE IF NOT EXISTS` / safe `ALTER TABLE` patterns.
- **Ordering matters**: `migrate-all` runs migrations in a consistent order to avoid FK issues.
- **Existing environments**: prefer `migrate-all` after pulling updates (same way you’d run migrations in a real product release).

