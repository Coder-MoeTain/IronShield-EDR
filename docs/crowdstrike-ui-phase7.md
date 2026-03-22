# CrowdStrike Falcon–class UI — Phase 7 (NGAV / Malware prevention)

Phase 7 exposes **on-host malware prevention** state in the console (Falcon **NGAV**-style signals): **signature bundle**, **realtime on/off**, and **prevention health** (active vs monitor-only vs degraded).

## Agent (C#)

- After each AV policy + signature load cycle, the agent caches:
  - Signature **bundle version** (from `/api/agent/av/signatures/version`)
  - **Realtime** flag from the assigned AV policy
  - Signature **count** (0 ⇒ degraded prevention)
- Every **heartbeat** may include:
  - `av_signature_bundle`
  - `av_realtime_enabled`
  - `av_prevention_status` — `active` | `monitor_only` | `degraded`
  - `av_signature_count` — loaded definition count (Falcon-style “signatures” visibility)

Until the first successful AV poll completes, NGAV fields are omitted from the heartbeat.

## Server

1. **Schema** — `av_update_status` must exist (`schema-antivirus.sql`). Add Phase 7 columns:

   ```bash
   cd server-node && npm run migrate-phase7-ngav-telemetry
   ```

2. **Heartbeat** — merges NGAV fields into `av_update_status` (upsert).

3. **API** — host list and host detail **LEFT JOIN** `av_update_status` and expose:
   - `av_ngav_bundle_version`, `av_ngav_sync_status`, `av_ngav_realtime_enabled`, `av_ngav_prevention_status`, `av_ngav_signature_count`, `av_ngav_last_checked_at`

## Dashboard

| Area | Changes |
|------|---------|
| **All hosts** | **NGAV** column (Active / Monitor / Degraded); **Tenant (CID)** header aligned with body |
| **Host detail** | **Malware prevention (NGAV)** strip + links to detections / NGAV overview |
| **Sensor health** | KPI **NGAV prevention degraded** |

## Verification

1. Apply antivirus schema + Phase 7 migration.
2. Enroll an agent with AV policy; confirm **NGAV** populates after heartbeats.
3. Compare with **Prevention &gt; Malware** routes under `/av/*`.

## Notes

CrowdStrike® / Falcon™ are trademarks of CrowdStrike, Inc. This project is independent.

See also: [Phase 6 — sensor updates](crowdstrike-ui-phase6.md), [Phase 8 — EDR sensor policy](crowdstrike-ui-phase8.md).
