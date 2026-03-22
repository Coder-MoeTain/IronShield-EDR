# CrowdStrike Falcon–class UI — Phase 10 (Host timeline)

Phase 10 adds **host lifecycle visibility** on the endpoint detail page — aligned with Falcon **first seen / last seen** style context (self-hosted, using enrollment + heartbeats).

## Data (no extra migration)

- **First seen** — `endpoints.created_at` (registration / first row insert).
- **Last activity** — `endpoints.last_heartbeat_at` (last successful sensor check-in).
- **Time in console** — approximate days since `created_at`.

## Dashboard

| Area | Changes |
|------|---------|
| **Host detail** | **Host timeline** strip above sensor/containment sections |

## Verification

1. Open any host detail — **First seen** and **Last activity** should populate.
2. Compare **Last activity** with the **Last Heartbeat** column on **All hosts** (same underlying field).

## Notes

This is **not** CrowdStrike’s cloud “first seen globally” — it reflects **this deployment’s** enrollment time.

CrowdStrike® / Falcon™ are trademarks of CrowdStrike, Inc. This project is independent.

See also: [Phase 9 — Policy compliance](crowdstrike-ui-phase9.md).
