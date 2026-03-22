# IronShield EDR — Technical Analysis & CrowdStrike Falcon Parity Roadmap

> **Disclaimer:** CrowdStrike Falcon® is a commercial cloud-native platform. This document maps **IronShield** to *similar capability areas* for product planning—not a feature-for-feature clone. Trademarks belong to their owners.

---

## 1. Project snapshot

| Layer | Technology | Role |
|-------|------------|------|
| **Agent** | C# .NET 8 (`EDR.Agent.Service`) | Registration, heartbeat, collectors (process, Windows Event Log, Sysmon, network), local queue, command polling, triage, AV submodule, **host isolation** (Windows Firewall rules via `HostIsolationService`) |
| **Backend** | Node.js + Express | REST APIs: agent ingest, admin SOC UI, auth/JWT, RBAC, multi-tenant hooks, detection pipeline hooks, AV module |
| **Database** | MySQL 8+ | Phased schema: core events/alerts, phase 3–6 (investigations, policies, tenants, network tables, AV) |
| **Dashboard** | React (Vite) | Falcon-inspired shell: Activity, Detections, Hosts, Explore, Respond, Intel, Enterprise, Next-gen AV |

**Data path (simplified):**  
`Collectors → raw_events → normalization → normalized_events → DetectionEngineService (rules) → alerts → (optional) CorrelationService → incidents`

---

## 2. What IronShield already does well

- **Multi-source telemetry (Windows):** Process, EVTX, Sysmon-style, network connections; heartbeat + metrics path.
- **Detection engine:** DB-driven rules with JSON conditions (Sigma-like keys: process, parent, encoded PowerShell, paths, etc.).
- **SOC workflows:** Alerts with status/notes, investigations, incidents (time-window correlation), triage requests, process tree, process monitor “suspect” heuristics.
- **Response:** Kill process (taskkill), heartbeat on demand, triage collection, **network containment** (isolate / lift) with real firewall rules when elevated, policy flags on endpoints.
- **AV module:** Signatures, heuristics, quarantine, scan tasks, policies, file reputation hooks—closer to “NGAV” than many open EDRs.
- **Enterprise:** RBAC, tenants, MSSP overview API/page, audit logs, global search.
- **UI direction:** Dense SOC layout, detection-centric naming, dark default theme.

---

## 3. CrowdStrike Falcon — capability areas vs IronShield

Below, **CS** = typical Falcon umbrella (EDR + NGAV + cloud management). **Gap** = what’s missing or immature in IronShield.

| Falcon-style pillar | CrowdStrike-like expectation | IronShield today | Gap severity |
|---------------------|------------------------------|------------------|--------------|
| **Sensor & platform** | Kernel/driver sensor, tamper protection, single lightweight agent | User-mode agent, no driver, no tamper | **High** |
| **Telemetry depth** | Full EDR event set (file, registry, DNS, inject, etc.), optional script control | Process + EVTX + Sysmon + network; normalized schema is narrower | **High** |
| **Cloud analytics** | Behavioral ML, threat graph, managed hunting | Rule engine + heuristics; no ML graph | **High** |
| **IOCs & intel** | CrowdStrike Intel, automated IOC feeds | IOC matching service + manual/watchlist style | **Medium** |
| **Prevention** | NGAV + exploit blocking + device control | AV module + detection; limited prevention story | **Medium–High** |
| **Response** | Real-time RTR, network containment, host isolation, bulk actions | RTR-like shell **not** present; containment exists; scripted response limited | **High** |
| **Identity** | Okta/Azure AD posture, identity protection | Not in scope of repo | **N/A** |
| **Exposure / ASM** | Attack surface | Not present | **Low** (optional) |
| **XDR / SIEM** | LogScale, third-party integrations | API + webhooks partial (notifications) | **Medium** |
| **Multi-tenant & MSSP** | Host groups, CID, strict RBAC | Tenants + MSSP page; good foundation | **Medium** |
| **UI/UX** | Detections workflow, assignment, SLA, saved views | Detections/hosts pages; less workflow polish | **Medium** |

---

## 4. Architectural gaps (technical)

### 4.1 Agent

- No **kernel driver** / minifilter → no file/registry/DNS telemetry at parity with top-tier EDR.
- **Tamper protection:** service can be stopped; no self-defense or WDAC integration.
- **Script control** (PowerShell Constrained Language, etc.) not implemented.
- **Offline resilience:** local queue exists; no signed update channel or attestation.

### 4.2 Backend

- Detection is **synchronous rule eval** on normalized rows—no streaming analytics or multi-stage pipelines.
- **Correlation** is time-window + endpoint clustering—no graph or entity linking.
- **Scale:** single Node process; no sharded workers or Kafka-style pipeline documented.
- **API:** REST only; no streaming API for live response.

### 4.3 Data model

- `normalized_events` is rich but not as wide as OpenTelemetry/ECS/OCSF for everything (registry, module loads, DNS answers, etc.).
- **Alert lifecycle** lacks assignment queues, SLA timers, detection “suppression” rules at scale.

### 4.4 “RTR-equivalent”

CrowdStrike **Real Time Response** is a major differentiator: shell on host, file ops, registry, run script. IronShield has **discrete actions** (kill, triage, isolate) but **not** an interactive session or full file/registry browser over API.

---

## 5. Prioritized upgrade roadmap (practical)

### Phase A — High value, achievable in-repo

1. **Detection quality**
   - Expand `normalized_events` + collectors for **DNS queries**, **registry** (selected keys), **image loads** (if Sysmon available).
   - Rule conditions: MITRE technique ID on alerts; saved **suppression** / false-positive workflow (status + reason + scope).

2. **Response**
   - **File quarantine from EDR path** (not only AV): server action → agent moves file + hash report.
   - **Block hash / block IP** response actions → firewall or `netsh` / WFP helper consistent with `HostIsolationService`.
   - **Run script** (signed script allowlist) as a controlled “mini-RTR” step.

3. **Operations**
   - **Assignment + state machine** on alerts (owner, team, due date, SLA fields).
   - **Saved filters / views** on Detections and Hosts (URL params + user prefs table).

4. **Observability**
   - Structured audit for every response action and admin view filter by endpoint/user.

### Phase B — Platform hardening

- Agent: **service hardening** (recovery options, delayed restart), optional **WDAC** policy doc for high-security deployments.
- Backend: **worker queue** (BullMQ/Redis) for heavy detection and correlation jobs.
- **Rate limits** per tenant; **data retention** policies per tenant (already partially there).

### Phase C — Advanced (larger investment)

- **Behavioral models:** anomaly scoring on process trees / rare paths (even simple baselines per host group).
- **Streaming or batch export** to SIEM (S3, Azure Event Hub, syslog).
- **Linux/macOS sensors** (new agents)—only if product scope expands.

---

## 6. What *not* to copy blindly

- **Cloud-only dependency:** Falcon assumes CS cloud; IronShield is **self-hosted**—keep air-gap friendliness.
- **Legal/compliance:** Don’t ship vendor telemetry; document what data leaves the endpoint.

---

## 7. Suggested next 3 concrete tickets

1. **Alert assignment model:** DB columns + API + Detections UI (assignee, team, due date).
2. **EDR file quarantine response:** new `action_type`, agent handler, audit trail.
3. **DNS (or Sysmon Event ID 3) normalization** + one new detection rule template for DNS tunneling / suspicious resolver.

---

## 8. File map (quick reference)

| Area | Key paths |
|------|-----------|
| Agent entry | `agent-csharp/src/EDR.Agent.Service/AgentWorker.cs` |
| Isolation | `agent-csharp/src/EDR.Agent.Core/Response/HostIsolationService.cs` |
| Detection | `server-node/src/services/DetectionEngineService.js` |
| Correlation | `server-node/src/services/CorrelationService.js` |
| Admin API | `server-node/src/routes/adminRoutes.js` |
| Dashboard shell | `server-node/dashboard/src/components/Layout.jsx` |
| Schema | `database/schema.sql`, `schema-phase3.sql` … `schema-antivirus.sql` |

---

## 9. Implementation status (in-repo)

| Roadmap bucket | Status | Notes |
|----------------|--------|--------|
| **Phase A — Detection** DNS/registry/image columns + rule keys | Implemented | `migrate-parity-phases.sql`, `EventNormalizationService`, `DetectionEngineService` |
| **Phase A — Response** quarantine, block IP/hash, run script | Implemented | C# handlers + `ResponseActionService` (`block_hash` server-side IOC) |
| **Phase A — Operations** assignment, SLA fields, saved views | Implemented | `AlertService.patch`, Detections UI + URL sync, `user_saved_views` |
| **Phase A — Audit** response actions | Existing `AuditLogService` usage on create action |
| **Phase B — Hardening** service recovery / WDAC | Partial | Optional `docs/wdac-hardening.md`; agent service recovery not automated in-repo |
| **Phase B — Workers / rate limits** | Partial | BullMQ present; `tenantRateLimit` middleware + `tenant_api_limits` table |
| **Phase B — Retention** | Existing | Phase 6 retention policies |
| **Phase C — Anomalies** | Implemented | `GET /api/admin/analytics/rare-paths` (`AnomalyService`) |
| **Phase C — SIEM export** | Implemented | `GET /api/admin/export/siem-alerts` (NDJSON) |
| **Host groups / sensor health / hunt UI** | Implemented | `host_groups`, Sensor Health + Hunting pages, `GET /api/admin/sensors/health` |
| **Linux/macOS agents** | Out of scope | — |

*Last updated: parity phases pass — use this as a living backlog; adjust priorities with your threat model and deployment constraints.*
