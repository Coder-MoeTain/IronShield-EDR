# Falcon-class capabilities in IronShield (self-hosted)

IronShield is **not** CrowdStrike Falcon. This document maps **similar workflows** implemented in-repo for evaluation and enterprise prototypes.

| Area | Falcon-style expectation | IronShield implementation |
|------|--------------------------|---------------------------|
| **Sensor management** | Host list, groups, health, pending update | Hosts UI, **host groups** (`host_groups`, `npm run migrate-cs-parity`), **Sensor health** (pending sensor update KPI), **Phase 6** heartbeat telemetry (`npm run migrate-phase6-agent-update-telemetry`), **Enterprise → Agent releases** |
| **Detections** | Queue, assign, SLA, suppress | Detections list/detail, PATCH alerts, saved views, SIEM NDJSON export |
| **Custom IOA / detection rules** | Rule library, enable/disable, MITRE | **Detection rules** page: Falcon-style table, filters, summary, **New / View / Edit**, API create+full PATCH (`DetectionRuleService`) |
| **Response** | Contain, RTR-like actions | Network containment, lift, kill, triage, EDR quarantine, block IP/hash, allowlisted `run_script` |
| **Hunting** | Search telemetry | **Hunting** page: ad-hoc + saved hunts over `normalized_events` (`hunt_queries` / `hunt_results`, schema-phase4) |
| **Network activity** | Explore connections / destinations | **Network** page: KPI summary API, time window + endpoint filters, scope badges (RFC1918 / external), connection search, logs bundle (`crowdstrike-network-activity.md`) |
| **Intel** | IOCs, feeds | IOC watchlist + matching, manual/hash block |
| **NGAV** | Malware prevention | AV module (signatures, quarantine, policies); **Phase 7** heartbeat NGAV telemetry (bundle, realtime, prevention, **signature count**) + host **NGAV** column (`migrate-phase7-ngav-telemetry`), **Malware prevention** strip on host detail |
| **Multi-tenant** | CID / MSSP | Tenants, **agent `tenant_slug` enrollment** (`npm run migrate-phase5-endpoints-tenant`), host list/detail **Tenant (CID)** column, MSSP overview, RBAC hooks |
| **Sensor policy** | EDR policy assignment | **Phase 8** heartbeat `edr_policy_id` / last sync (`migrate-phase8-edr-policy-sync`), agent API **`policy_name`**, **Policy** column + **Sensor policy (EDR)** strip on host detail |
| **Policy drift** | Assignment vs effective policy | **Phase 9** `policy_compliance_status` + policy names (`assigned_policy_id` vs `edr_policy_id`), **All hosts** marker, **Sensor health** KPI |
| **Host lifecycle** | First / last seen | **Phase 10** **Host timeline** strip (`created_at`, `last_heartbeat_at`, days enrolled) |
| **Analytics** | Cloud ML, graph | Rule engine, correlation, **rare process paths** API, **Detection analytics** page (heuristic risk + chart), **Threat graph** (host↔alert) |
| **RTR** | Interactive shell | **RTR** page + **`rtr_shell`** allowlisted commands (`migrate-falcon-ui-pack`) |
| **Roadmap placeholders** | Identity, ASM, Overwatch, deep prevention UI | **Advanced** menu → roadmap pages + docs (`falcon-advanced-ui.md`) |

## Migrations

- **Host groups:** `cd server-node && npm run migrate-cs-parity`
- **Hunts:** ensure `schema-phase4.sql` applied (`hunt_queries`, `hunt_results`)
- **Telemetry filters:** DNS/command-line columns: `migrate-parity-phases.sql` (or bundled `schema.sql` on fresh install)

## Legal

CrowdStrike® and Falcon™ are trademarks of CrowdStrike, Inc. This project is independent and for educational / operational prototyping only.
