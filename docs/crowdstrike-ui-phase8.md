# CrowdStrike Falcon–class UI — Phase 8 (EDR sensor policy sync)

Phase 8 surfaces **which sensor policy** the endpoint is running under and **when it last synced** — similar to Falcon **sensor policy** / assignment visibility on the host.

## Agent (C#)

- Caches **`policy_id`** and **last successful fetch time** whenever **`GET /api/agent/policy`** succeeds (`ApplyEndpointPolicy`).
- **Initial fetch** ~4s after startup (in addition to the triage poll loop) so the first heartbeats can include policy telemetry.
- **`GET /api/agent/policy`** response includes **`policy_name`** (human-readable) alongside numeric `policy_id` (agent may log or display locally).
- Heartbeat JSON (when sync has occurred at least once):
  - `edr_policy_id`
  - `last_edr_policy_sync_utc` (ISO 8601 UTC)

## Server

1. **DB** — columns on `endpoints`:

   ```bash
   cd server-node && npm run migrate-phase8-edr-policy-sync
   ```

2. **Heartbeat** — persists `edr_policy_id` and `last_edr_policy_sync_at` (with layered fallbacks if older migrations are missing).

3. **API** — values are returned on host list and host detail (`SELECT e.*` includes them).

## Dashboard

| Area | Changes |
|------|---------|
| **All hosts** | **Policy** column (EDR policy id) |
| **Host detail** | **Sensor policy (EDR)** strip: policy id + last sync |

## Verification

1. Run migration (above).
2. Ensure an agent policy exists and is assigned to the endpoint (existing policy module).
3. After agent heartbeat, confirm **Policy** and **Sensor policy** strip populate.

## Notes

CrowdStrike® / Falcon™ are trademarks of CrowdStrike, Inc. This project is independent.

See also: [Phase 7 — NGAV](crowdstrike-ui-phase7.md).
