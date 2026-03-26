# HA/DR Backup and Recovery Runbook

## Scope
- MySQL primary data store (`edr_platform`)
- Backend configuration (`server-node/.env`, TLS certs, release artifacts)
- Dashboard static build (`server-node/public`)

## RPO / RTO targets
- **RPO**: 15 minutes (binlog-based)
- **RTO**: 60 minutes (restore + service validation)

## Backup schedule
- Full DB dump every 24h
- Binlog archival every 5m
- Config/artifact snapshot every 24h

## Backup execution (Windows)
1. Run `server-node/scripts/backup-db.ps1`
2. Verify generated `.sql.gz` and `.sha256`
3. Copy artifacts to immutable/offsite storage

## Restore execution
1. Provision clean MySQL instance
2. Run `server-node/scripts/restore-db.ps1` with selected backup file
3. Deploy backend `.env` + TLS material
4. Start backend and confirm:
   - `/healthz` returns `ok`
   - `/readyz` returns `ready`
   - Login + API smoke checks pass

## Failure drill (monthly)
1. Pick random backup from prior week
2. Restore to isolated DR environment
3. Run smoke checks:
   - Auth login
   - List endpoints
   - List incidents
   - Post response approval action
4. Record:
   - Start/end timestamps
   - RTO achieved
   - Any data loss observed (RPO)
   - Corrective actions

## Security controls
- Encrypt backups at rest
- Store checksum and signature for each backup
- Restrict restore credentials to break-glass operators
- Enforce two-person approval for production restore

