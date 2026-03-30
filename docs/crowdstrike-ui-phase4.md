# CrowdStrike Falcon–class UI — Phase 4 (sensor telemetry)

Phase 4 adds **Falcon-style sensor visibility** on the host detail page and host list: **operational status**, **event queue backlog**, **agent process uptime**, and **network containment** state reported by the Windows agent on every heartbeat.

## Agent (C#)

The agent enriches `HeartbeatPayload` with:

| JSON field | Meaning |
|------------|---------|
| `queue_depth` | Events waiting in the local offline queue |
| `process_uptime_seconds` | Agent process uptime |
| `host_isolation_active` | Whether Windows Firewall containment rules from IronShield are active |
| `sensor_operational_status` | `ok` or `degraded` (e.g. when backlog exceeds threshold) |

## Server

1. Run migration (adds columns on `endpoints`):

   ```bash
   cd server-node && npm run migrate-sensor-telemetry
   ```

   Or apply `database/migrate-sensor-telemetry.sql` manually (not idempotent; prefer the npm script).

2. Heartbeat API accepts the new optional fields (`src/schemas/agentSchemas.js`).

3. `HeartbeatService` persists to `sensor_queue_depth`, `sensor_uptime_seconds`, `host_isolation_active`, `sensor_operational_status`. If columns are missing, it falls back to the legacy heartbeat update and logs a warning.

## Dashboard

| Page | Changes |
|------|---------|
| **Host detail** (`EndpointDetail.jsx`) | **Sensor & containment** strip: operational status, backlog, uptime, containment |
| **All hosts** (`Endpoints.jsx`) | **Sensor** column via `endpointSensorListDisplay()` (`dashboard/src/utils/sensorUi.js`): Update pending → Contained → Degraded → `Q:n` when backlog is positive → **OK** (healthy / online) |

The detail page polls the endpoint every ~45s so the strip updates without a full reload.

## Verification

- `cd server-node/dashboard && npm run build` and `npm test` (includes `sensorUi.test.js` for host-list Sensor column logic).
- `cd server-node && npm test` — `test/heartbeatSchema.telemetry.test.js` asserts Zod accepts Phase 4 heartbeat fields.
- `dotnet test` on `EDR.Agent.Core.Tests` — heartbeat JSON includes `queue_depth`, `process_uptime_seconds`, `host_isolation_active`, `sensor_operational_status`.
- After DB migration, register an agent and confirm `endpoints` columns update on heartbeat (`npm run migrate-sensor-telemetry` if needed).

## Notes

Same disclaimer as Phase 1–3: UX parity for SOC workflows, not a commercial Falcon clone.

See also: [Phase 3](crowdstrike-ui-phase3.md).
