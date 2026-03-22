# CrowdStrike Falcon–class UI — Phase 6 (sensor updates & enterprise)

Phase 6 ties **agent release management** (already in **Enterprise → Enterprise settings → Agent releases**) to **live host visibility**: which sensors report a **newer build available**, matching Falcon-style “pending sensor update” signals.

## Agent (C#)

- **`UpdateCheckService`** records the last successful check against `GET /api/agent/update/check` and the **up_to_date / update_available** outcome.
- First check runs **~45s** after startup; then **every 24 hours** (same as before).
- Every **heartbeat** includes (when known):
  - `agent_update_status` — `up_to_date` | `update_available` | `unknown`
  - `available_agent_version` — target version when an update is available
  - `last_agent_update_check_utc` — ISO 8601 UTC timestamp of the last successful check

## Server

1. **DB** — add columns on `endpoints`:

   ```bash
   cd server-node && npm run migrate-phase6-agent-update-telemetry
   ```

2. **Heartbeat** — persists `agent_update_status`, `available_agent_version`, `last_agent_update_check_at` (with fallbacks if older schemas are present).

3. **Current release** — set `is_current` on a row in **`agent_releases`** (Enterprise settings) so `/api/agent/update/check` can offer a version newer than the running agent.

## Dashboard

| Area | Changes |
|------|---------|
| **Host detail** | **Sensor updates** strip: status, available version, last check |
| **All hosts** | **Sensor** column prioritizes an **Update** badge when `update_available` |
| **Sensor health** | KPI **Pending sensor update** (count of hosts with `agent_update_status = 'update_available'`) |

## Verification

1. Run migration (above).
2. Create an **Agent release** with a version **>** agent `1.0.0` and mark **current**.
3. Wait for the agent’s first update check (~45s) and the next heartbeat; confirm **Host detail** and **Sensor health** show pending update.

## Notes

This does **not** auto-install MSI binaries on the endpoint (Falcon uses managed rollout + installers). The console shows **compliance**; deployment is via your package pipeline.

See also: [Phase 5 — tenant enrollment](crowdstrike-ui-phase5.md), [Phase 7 — NGAV](crowdstrike-ui-phase7.md).
