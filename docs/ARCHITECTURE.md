# IronShield EDR — Architecture

IronShield is a defensive EDR/XDR platform: Windows agent → Node.js API → MySQL storage → React SOC dashboard.

## Telemetry pipeline

1. Agent collectors emit raw events with stable `event_id` (idempotent ingest).
2. `POST /api/agent/events/batch` → `EventIngestionService.ingestBatch`.
3. When Redis is available and `INGEST_QUEUE_FIRST=true` (default in compose), BullMQ worker normalizes and detects.
4. `EventNormalizationService` writes `normalized_events`; `DetectionEngineService` + `DetectionCodeEngine` evaluate rules.
5. `AlertService` creates alerts with `risk_score` and `evidence_summary` (why fired).

## Agent trust

- Enrollment tokens may be single-use (`single_use`, `consumed_at`).
- Request signing: HMAC headers (`X-Agent-Timestamp`, `X-Agent-Nonce`, `X-Agent-Signature`, `X-Agent-Body-Sha256`); nonces in MySQL `agent_nonces`.
- Agent secrets: Windows DPAPI (`AgentKeyProtected`) on the endpoint.
- Response commands: HMAC signed with per-endpoint `agent_key`; agent verifies before execution.

## API surfaces

| Prefix | Consumers |
|--------|-----------|
| `/api/auth` | SOC users (JWT) |
| `/api/agent` | Windows agent |
| `/api/admin` | Dashboard (JWT + RBAC + tenant) |
| `/api/v1/*` | Versioned alias to `/api/*` (same routes, standard envelope on admin/auth/detections/software/console) |
| `/api/v1/console/*` | Dashboard BFF aggregates for 8-page console |
| `/api/v1/software/*` | Software Risk Management (inventory, vulns, block policies, reports) |

## Detection-as-code

Rules live under `server-node/detections/windows/{tactic}/IRN-WIN-*.json` (**52** rules in the current pack; Phase 5 initially shipped **31**). CI runs `npm run detections:validate`, `detections:lint`, and `detections:test`. MITRE coverage: `GET /api/v1/admin/mitre/coverage`.

## Operations

- System health: `GET /api/admin/system/health`
- MITRE matrix: `GET /api/admin/mitre/coverage`
- Reports: `POST /api/admin/reports` → expiring download links
- Integrations: webhook / Splunk HEC providers

See `docs/SECURITY_MODEL.md` and `docs/deployment/` for deployment and trust boundaries.
