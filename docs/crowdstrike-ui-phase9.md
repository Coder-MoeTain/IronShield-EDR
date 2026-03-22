# CrowdStrike Falcon–class UI — Phase 9 (Policy compliance / drift)

Phase 9 surfaces **whether the sensor is running the same EDR policy the console assigned** — similar to Falcon **policy assignment** vs **effective policy** visibility.

## Server

- **`endpoints.assigned_policy_id`** — set when an admin assigns a policy (`POST /api/admin/endpoints/:id/assign-policy`, Phase 3).
- **`endpoints.edr_policy_id`** — last policy id **reported by the agent** via heartbeat (from `GET /api/agent/policy`).
- **Computed field** `policy_compliance_status`:
  - `unknown` — sensor has not reported `edr_policy_id` yet
  - `matched` — assignment matches sensor (or no assignment row but sensor matches default behavior)
  - `mismatch` — `assigned_policy_id` and `edr_policy_id` both set and **different**

- **API** — host list and detail join `endpoint_policies` for:
  - `assigned_policy_name`
  - `edr_policy_name` (running / sensor policy)

## Dashboard

| Area | Changes |
|------|---------|
| **All hosts** | **Policy** column shows sensor policy id; **!** marker when `mismatch` |
| **Host detail** | **Sensor policy (EDR)** strip: **Compliance**, **Assigned (console)**, **Sensor (running)** |
| **Sensor health** | KPI **Policy mismatch (console vs sensor)** |

## Verification

1. Assign a policy to a host; wait for heartbeats — **Compliance** should be **MATCHED**.
2. Change assignment in console without agent poll yet (or simulate different ids) — **MISMATCH** and Sensor health count increase.

## Notes

CrowdStrike® / Falcon™ are trademarks of CrowdStrike, Inc. This project is independent.

See also: [Phase 8 — EDR sensor policy](crowdstrike-ui-phase8.md), [Phase 10 — Host timeline](crowdstrike-ui-phase10.md).
