# IronShield EDR — Enterprise Upgrade Audit

**Repository:** [Coder-MoeTain/IronShield-EDR](https://github.com/Coder-MoeTain/IronShield-EDR)  
**Audit date:** 2026-05-16  
**Scope:** Full-stack defensive EDR/XDR platform (Windows agent, Node.js API, MySQL, React SOC dashboard, Docker Compose)  
**Purpose:** Baseline for phased upgrade toward production-grade enterprise EDR without offensive capabilities.

---

## Executive summary

IronShield is already a **substantial, feature-rich defensive EDR foundation**—not a greenfield project. It ships multi-tenant RBAC, MFA/SSO hooks, audit hash chaining, agent request signing, enrollment tokens, BullMQ/Redis workers, optional Kafka, XDR event store, NGAV module, Falcon-style UI phases, response approvals, RTR (controlled), hunting, and CI (backend tests, agent .NET tests, dashboard Vitest/Playwright).

**May 2026 polish:** Compact 8-page console, `/api/v1` + console BFF, `npm run migrate`, tab-specific admin RBAC, production readiness score, workspace preferences, and aligned documentation (`docs/API_COVERAGE.md`, `npm run docs:status-check`).

Remaining gaps are mainly **depth and hardening**: full BFF adoption in every tab (many still call admin APIs directly), DPAPI agent secrets in all deployments, mandatory mTLS in production, and expanded automated tab-level API tests.

**Recommended approach:** Phases 1–9 delivered; continue incremental polish with backward compatibility via `legacyRedirects.js` and thin `src/pages` re-exports.

---

## 1. Current architecture

### 1.1 Logical topology (as deployed today)

```
┌──────────────────────┐     HTTPS (+ optional mTLS)      ┌─────────────────────────────┐
│  Windows Agent       │ ───────────────────────────────► │  Node.js Express (app.js)   │
│  EDR.Agent.Service   │     X-Agent-* signed requests    │  Port 3000/3001             │
│  (.NET 8)            │     Agent-Key header             │                             │
└──────────┬───────────┘                                  └──────────┬──────────────────┘
           │ Collectors: Process, WinEvent, Network, Sysmon          │
           │ AV module, RTR executor, triage, command poll           │
           │                                                         │
           │                              ┌──────────────────────────┼──────────────────────────┐
           │                              ▼                          ▼                          ▼
           │                    ┌─────────────────┐        ┌─────────────────┐        ┌─────────────────┐
           │                    │ MySQL 8         │        │ Redis (opt.)    │        │ Kafka (opt.)    │
           │                    │ raw_events      │        │ BullMQ worker   │        │ xdr.raw.*       │
           │                    │ normalized_*    │        │ EventIngestion  │        │ Kafka workers   │
           │                    │ alerts, etc.    │        └─────────────────┘        └─────────────────┘
           │                    └─────────────────┘
           │                              │
           │                              ▼
           │                    ┌─────────────────┐     WebSocket /ws
           └───────────────────►│ React Dashboard │◄── (XDR realtime)
                                │ Vite → public/  │
                                └─────────────────┘
```

### 1.2 Code layout

| Area | Path | Notes |
|------|------|--------|
| Backend entry | `server-node/src/index.js`, `app.js` | Express; static `public/` for built dashboard |
| Routes | `server-node/src/routes/` | `agentRoutes`, `adminRoutes`, `authRoutes`, `ingestRoutes` |
| Services | `server-node/src/services/` | 40+ services (ingest, detection, alerts, audit, tenant, etc.) |
| Partial modules | `server-node/src/modules/` | investigations, incidents, antivirus, policies, triage, risk, search, processMonitor, platform |
| Workers | `server-node/src/worker.js`, `workers/` | BullMQ + Kafka normalized/raw workers |
| XDR | `server-node/src/xdr/` | Store, mapper, detection, autoresponse |
| Agent | `agent-csharp/src/` | `EDR.Agent.Service`, `EDR.Agent.Core`, `EDR.Agent.Updater` |
| DB | `database/*.sql` + `server-node/scripts/migrate-*.js` | **Dual migration model** (SQL files + idempotent JS migrations) |
| Dashboard | `server-node/dashboard/src/` | React 18, lazy routes, Falcon-style nav |
| API contract | `server-node/openapi/openapi.json` | Served at `GET /api/openapi.json` |
| CI | `.github/workflows/ci.yml` | Backend tests, OpenAPI validate, detection replay, agent build/test, dashboard build/e2e |
| Compose | `docker-compose.yml` | mysql, redis, kafka, backend, worker |

### 1.3 Data flow (telemetry → alert)

1. Agent `POST /api/agent/events/batch` → `agentController.eventsBatch` → `EventIngestionService.ingestBatch` (optional queue).
2. Worker or inline path: `raw_events` → `EventNormalizationService.normalize` → `normalized_events`.
3. `DetectionEngineService` evaluates DB-backed `detection_rules` + IOC matching.
4. `AlertService` creates/updates alerts; correlation interval via `CORRELATION_INTERVAL_MS`.
5. Optional: events published to Kafka topics; XDR pipeline via `ingestRoutes` + `xdrStore`.

### 1.4 Target architecture gap

Target calls for explicit **Agent Ingestion API → Queue → Normalizer Worker → Detection Worker → Storage** service boundaries under `server-node/src/modules/{auth,tenants,endpoints,ingestion,telemetry,detections,...}`. Today, boundaries exist as **services + optional workers**, not as isolated deployable modules. Kafka/Redis are present but not mandatory for local dev.

---

## 2. Current API modules

### 2.1 Route prefixes

| Prefix | Status | Auth | Primary capabilities |
|--------|--------|------|----------------------|
| `/api/v1/*` | **implemented** | Same as legacy | Mirrors `/api/*` for versioned clients |
| `/api/v1/console/*` | **implemented** | JWT + RBAC | BFF aggregates for 8-page dashboard |
| `/api/auth` | **implemented** | Public / JWT | Login, refresh, MFA, OIDC/SAML hooks, `/me` |
| `/api/agent` | **implemented** | Agent-Key + HMAC nonces | Register, heartbeat, events, AV, policy, RTR |
| `/api/admin` | **implemented** | JWT + RBAC + tenant | Full SOC/admin surface |
| `/api/ingest` | **implemented** | XDR ingest key | External XDR ingestion |
| `/health`, `/healthz`, `/readyz`, `/metrics` | **implemented** | Mixed | Liveness, readiness, Prometheus |

### 2.2 Notable admin endpoints (representative)

- **SOC:** `/api/admin/dashboard/summary`, `/alerts`, `/alerts/:id`, `/incidents`, `/investigations`, `/process-monitor`, `/search/global`
- **Network:** `/api/admin/network/{summary,connections,outgoing-ips,traffic,logs}`
- **Response:** `/api/admin/endpoints/:id/actions`, `/response-actions/approvals/pending`, approve/deny routes
- **Enterprise:** `/api/admin/tenants/:tenantId/enrollment-tokens`, `/rbac/*`, `/compliance/summary`, `/soc/readiness`
- **XDR:** `/api/admin/xdr/{events,detections,summary,iocs,ip-feeds}`
- **RTR:** `/api/admin/rtr/sessions` (controlled remote commands — high risk)
- **Audit:** `/api/admin/audit-logs`, `/audit-logs/verify`

### 2.3 API gaps vs target spec

| Requirement | Status |
|-------------|--------|
| `/api/v1/*` versioning | **implemented** |
| Console BFF envelope | **implemented** — `{ success, data, requestId }` on `/api/v1/console/*` |
| Standard envelope on all admin routes | **partial** |
| Zod validation on all inputs | **partial** |
| OpenAPI coverage | **implemented** — `npm run test:openapi` |
| Repository/service layer everywhere | **partial** |

---

## 3. Current database tables

### 3.1 Core schema (`database/schema.sql` + phases)

| Table | Purpose |
|-------|---------|
| `admin_users` | SOC users (legacy `role` ENUM + RBAC tables) |
| `endpoints` | Registered agents; sensor/update/policy fields |
| `endpoint_heartbeats` | Heartbeat history |
| `raw_events` | Agent JSON payloads |
| `normalized_events` | Normalized columns + `raw_event_json` |
| `detection_rules` | JSON `conditions`, MITRE fields |
| `alerts` | Status, SLA, assignment, suppression |
| `alert_notes` | Analyst notes |
| `response_actions` | Kill, isolate, triage, quarantine, run_script, etc. |
| `endpoint_policies` | Per-endpoint policy status (also extended in phase3 migrations) |
| `audit_logs` | Admin actions (+ `prev_hash`, `entry_hash` via migration) |
| `user_saved_views` | Saved filters |

### 3.2 Phase / migration tables (selected)

| Source | Tables |
|--------|--------|
| `schema-phase3.sql` / migrations | `endpoint_policy_assignments`, `investigation_cases`, `triage_requests`, `process_trees`, `saved_searches`, `endpoint_risk_scores` |
| `schema-phase4.sql` | `incidents`, `incident_alert_links`, `hunt_queries`, `ioc_watchlist`, `ioc_matches`, `anomaly_scores` |
| `schema-phase5.sql` | `tenants`, `roles`, `permissions`, `role_permissions`, `user_roles`, `notifications`, `webhooks`, `api_keys` |
| `schema-phase6.sql` | `notification_channels`, `retention_policies`, `agent_releases` |
| `schema-network.sql` | `network_connections` |
| `schema-antivirus.sql` | `av_*`, `malware_alerts` |
| `migrate-falcon-ui-pack.sql` | `rtr_sessions`, `rtr_session_commands` |
| `migrate-enrollment-tokens.js` | `tenant_enrollment_tokens` |
| `migrate-agent-batch-dedupe.js` | `agent_event_batches` |
| `migrate-agent-event-idempotency.js` | `agent_event_ids` |
| `migrate-xdr-*.js` | `xdr_events`, `xdr_detections`, `xdr_ip_blacklist_feeds`, `xdr_autoresponse`, links |
| `migrate-capabilities-v2.js` | `detection_suppressions`, `response_playbooks` |
| `migrate-cs-parity.js` | `host_groups` |
| `schema-endpoint-metrics.sql` | `endpoint_metrics` |

### 3.3 Target tables not present or incomplete

| Target table | Status |
|--------------|--------|
| `endpoint_groups` | **Partial** — `host_groups` exists (Falcon parity naming) |
| `endpoint_health` | **Partial** — columns on `endpoints` + `endpoint_metrics` |
| `agent_keys` (lifecycle) | **Partial** — `agent_key` on endpoints + migrate scripts |
| `agent_nonces` (DB-backed replay) | **implemented** — MySQL/Redis via migration + config |
| `normalized_events` as canonical UUID model | **Partial** — relational columns, no unified `event_id` UUID schema |
| `detection_rule_versions` | **Missing** |
| `alert_evidence`, `alert_dispositions` | **Partial** — disposition API exists; dedicated tables unclear |
| `incident_timeline`, `incident_notes` | **Partial** — incidents module; verify timeline persistence |
| `approved_scripts` | **Missing** — script allowlist via agent config + policy only |
| `siem_exports`, `integrations` (framework) | **Partial** — webhooks, `SiemPushService`, SIEM export route |
| `system_jobs` | **Missing** |
| `audit_exports` | **Missing** |

### 3.4 Schema technical debt

- `database/schema.sql` defines `INDEX idx_endpoint_tenant (tenant_id)` on `endpoints` **before** `tenant_id` column exists in that file — fresh installs require `migrate-phase5-endpoints-tenant` (documented in README but easy to miss).
- **40+** separate `npm run migrate-*` scripts vs single `npm run migrate` / rollback / status (target spec).
- Tenant scoping: `tenant_id` on AV/detection_rules/endpoints (via migration) but **not consistently** on `raw_events`, `normalized_events`, `alerts` in base schema — tenant isolation relies heavily on endpoint joins.

---

## 4. Dashboard — compact console (May 2026)

**Stack:** React 18, Vite, `routeMap.jsx` + `legacyRedirects.js`, 8 primary modules under `src/features/*`.

| Route | Module | Status | Notes |
|-------|--------|--------|-------|
| `/overview` | Overview | **implemented** | Executive, SOC, health, tenant tabs; production readiness panel |
| `/endpoints`, `/endpoints/:id` | Endpoints | **implemented** | List, groups, timeline, network, map |
| `/detections` | Detections | **implemented** | Triage, alerts, rules, MITRE, XDR, quality |
| `/investigation` | Investigation | **implemented** | Incidents, cases, graph, reports |
| `/response` | Response | **implemented** | Approvals, RTR, playbooks, quarantine |
| `/hunting` | Hunting | **implemented** | Events, IOCs, XDR realtime, network |
| `/protection` | Protection | **implemented** | NGAV policies, quarantine, signatures |
| `/admin` | Administration | **implemented** | Tab-specific RBAC (settings, tenants, audit, …) |

Legacy paths (`/alerts`, `/mitre`, `/audit-logs`, …) **redirect** to compact routes with `?tab=`.

`src/pages` retains **Login**, **NotFound**, and thin re-exports — see `dashboard/src/pages/DEPRECATED.md`.

### 4.1 Feature status vs target spec

| Target capability | Status |
|-------------------|--------|
| SOC Triage Queue tab | **implemented** — `/detections?tab=triage` |
| Alert “why fired” / evidence | **partial** — alert detail + risk fields |
| Host timeline | **implemented** — endpoint detail tab |
| MITRE coverage UI | **implemented** — `/detections?tab=mitre` |
| Reports (JSON/HTML jobs) | **implemented** — `/admin?tab=reports` |
| Integrations admin | **implemented** — `/admin?tab=integrations` |
| System health + production readiness | **implemented** — overview + admin system-health |
| Workspace modes (Simple / Advanced / Admin / MSSP / Auditor) | **implemented** — `workspaceMode.js` + preferences |
| Console BFF per module | **implemented** — `GET /api/v1/console/*` |

---

## 5. Current agent capabilities

### 5.1 Collectors (`agent-csharp/src/EDR.Agent.Core/Collectors/`)

| Collector | Telemetry |
|-----------|-----------|
| `ProcessCollector` | Process start/stop, PID, parent, path, command line, user, hash (where available) |
| `WindowsEventCollector` | Security/operational Windows Event Log subsets |
| `NetworkCollector` | Connections (local/remote IP/port, protocol, process) |
| `SysmonCollector` | Sysmon-enriched events when available |

**Not present as dedicated collectors:** file system watcher telemetry (beyond AV), registry telemetry collector, dedicated PowerShell script-block collector (some signal via process/cmdline/events).

### 5.2 Agent platform features

| Feature | Implementation |
|---------|----------------|
| Registration | `RegistrationToken` + optional `TenantSlug`; server `EnrollmentTokenService` |
| Identity | `AgentKey` in config; rotate via API |
| Request signing | `AgentRequestSigner` — HMAC-SHA256 over method, path, timestamp, nonce, body hash |
| Heartbeat | Rich payload: versions, queue depth, CPU/RAM, tamper signals, NGAV status |
| Offline queue | Local queue with depth reported in heartbeat |
| Response | Command polling, kill, isolate, triage, quarantine, `ScriptRunner` with path/SHA allowlist |
| RTR | `RtrShellExecutor` — **controlled but high risk** |
| AV/NGAV | Full submodule (scan, quarantine, signatures, web URL protection) |
| Updates | `EDR.Agent.Updater` + server `AgentUpdateService` |
| Tamper | Server-side alerts from agent-reported `tamper_risk` (HeartbeatService) |

### 5.3 Agent gaps vs target spec

| Requirement | Status |
|-------------|--------|
| Windows DPAPI for secrets | **Missing** — `config.json` plain text + env overrides (`ConfigService.cs`) |
| Client certificates / mTLS | **Config flags exist** (`RequireHttps`, server TLS settings); agent cert enrollment not fully documented in-repo |
| Per-request endpoint_id in signature payload | **Partial** — signing uses agent key; endpoint binding via Agent-Key lookup |
| DB/Redis-backed nonce store | **Missing** on server for multi-instance |
| Dedicated tamper module (binary integrity, config file watch) | **Partial** — server interprets heartbeat fields |
| Bounded encrypted offline queue | **Partial** — queue depth reported; encryption not verified |
| Policy-driven enable/disable per telemetry module | **Partial** — `EndpointPolicy` model; module health reporting incomplete |

### 5.4 Agent tests

`agent-csharp/tests/EDR.Agent.Core.Tests/` — contract tests (heartbeat, registration), heuristics, signature matcher, web URL writer. **No dedicated enrollment/signing integration tests** against live API in CI (Windows agent job builds/tests core only).

---

## 6. Current security controls

### 6.1 Implemented (verified in code)

| Control | Location / notes |
|---------|------------------|
| JWT auth + refresh | `AuthService`, `jwtVerify` with `JWT_SECRET_PREVIOUS` rotation |
| MFA (TOTP) | `otplib`, `mfaPolicy` middleware |
| Account lockout | `AUTH_MAX_FAILED_LOGINS`, `AUTH_LOCK_MINUTES` |
| RBAC | `roles`/`permissions` tables + `middleware/rbac.js` with legacy fallback |
| SoD | `middleware/sod.js` for sensitive actions (e.g. agent key revoke) |
| Tenant context | `requireTenantContext`, JWT `tenantId`, enrollment tokens |
| Helmet, CORS allowlist, rate limits | `app.js` |
| Request ID | `middleware/requestId.js`, `X-Request-ID` |
| Structured logging | `pino` via `utils/logger.js` |
| Agent request signing + replay cache | `middleware/auth.js` (in-memory nonces) |
| Audit logging + hash chain | `AuditLogService` — `prev_hash`, `entry_hash`; verify endpoint |
| Audit archive HMAC | Optional NDJSON archive + `AUDIT_ARCHIVE_HMAC_KEY` |
| Response approval workflow | `response_action_approvals` migration columns + UI queue |
| Script allowlist | Agent `ScriptAllowlistPrefixes` / `ScriptAllowlistSha256` |
| Security assurance CI | `npm run security-assurance`, control mapping in `docs/security/` |
| CodeQL + dependency review | `.github/workflows/codeql.yml`, `dependency-review.yml` |
| Prometheus metrics | `/metrics` with optional token |
| XDR ingest key | Separate from agent channel |

### 6.2 RBAC permission model (actual vs target)

**Database seeds** (`schema-phase5.sql`): `view_endpoints`, `view_alerts`, `manage_alerts`, `manage_incidents`, `execute_response`, `manage_policies`, `manage_users`, `export_data`, `manage_iocs`, `manage_integrations`, `view_audit`, `manage_tenants`.

**Route middleware** often uses legacy strings: `actions:write`, `alerts:write`, `rules:write`, `audit:read`, `xdr:read`, `xdr:write`, `manage_integrations`, `manage_tenants`, `*`.

**Target spec** defines granular permissions (`dashboard:view`, `endpoint:view`, `response:approve`, etc.) and roles (`super_admin`, `tenant_admin`, `soc_manager`, `senior_analyst`, `analyst`, `read_only`, `auditor`). **Migration needed** to align names, seed matrix, and update all `requireAnyPermission` call sites.

### 6.3 Security gaps

| Gap | Risk |
|-----|------|
| Zod config validation at boot | Weak secrets may start in dev; production fail-fast incomplete |
| Agent signing optional by default | `AGENT_REQUEST_SIGNING_REQUIRED` not true by default |
| In-memory nonce cache | Breaks replay protection with horizontal scale |
| Plaintext agent secrets on disk | Credential theft from host |
| RTR surface | Misconfiguration → unrestricted remote execution |
| API response envelope inconsistency | Harder for SOAR integration |
| Tenant isolation tests | Limited — `tenantService.security.test.js`, `requireTenantContext.test.js`; need cross-tenant data tests for alerts/events |

---

## 7. Current missing features (prioritized)

### P0 — Production blockers

1. Unified **`npm run migrate` / `migrate:status` / `migrate:rollback` / `seed`** (replace 40+ scripts).
2. **`/api/v1`** with compatibility shims.
3. **Canonical event model** + normalizer schema (UUID `event_id`, tenant_id on all event tables).
4. **Professional permission matrix** aligned across DB, API, dashboard.
5. **Detection-as-code** — `server-node/detections/` tree, `detections:validate|test|replay`, CI gate.
6. **MITRE coverage API + dashboard page**.
7. **DPAPI** + agent secret handling documentation.
8. **Production Docker** — `docker-compose.dev.yml`, `docker-compose.prod.yml`, `.env.example.*`.
9. **Reports module** (SOC summary, incident export, audit report).
10. **“Why fired” alert evidence** structured for UI/SOAR.

### P1 — Enterprise completeness

1. DB-backed `agent_nonces` (or Redis) for replay protection.
2. `approved_scripts` table + versioning (tenant-scoped).
3. `detection_rule_versions` + rule test fixtures in CI.
4. OpenSearch/ClickHouse adapter (optional) for high-volume search.
5. Integration provider interface (Splunk HEC, Elastic, Sentinel JSON, syslog).
6. Full incident timeline/notes tables + PDF/HTML export.
7. Dedicated host timeline page + process tree UX upgrades.
8. `npm run audit:verify` CLI wrapping existing verify endpoint.
9. Tenant isolation integration test suite (tenant A ≠ tenant B for alerts, events, incidents).
10. ESLint/Prettier + `.editorconfig` repo-wide.

### P2 — Scale and polish

1. Microservice extraction behind module boundaries (optional).
2. MinIO cold archive for telemetry.
3. SBOM + signed agent release artifacts (partial: `agent_releases`, signature migration exists).
4. IP allowlist for admin API.
5. Full `docs/deployment/*` pack per spec.

---

## 8. High-risk areas

| Area | Concern | Mitigation already in place | Required hardening |
|------|---------|----------------------------|-------------------|
| **RTR** (`/api/admin/rtr/*`, `RtrShellExecutor`) | Remote command execution | RBAC `actions:write`, sessions, audit | Pre-approved commands only; kill switch; stricter than generic `actions:write` |
| **run_script** response action | Arbitrary code if misconfigured | Path + SHA allowlist on agent | Server-side `approved_scripts` table; mandatory approval |
| **kill_process** | Denial of service / break-glass abuse | Policy + approval for high-risk types | Protected process list; dual approval |
| **isolate_host** | Business outage | Approval workflow | Expiry + auto-lift + audit |
| **AGENT_REGISTRATION_TOKEN** | Mass rogue enrollment | Per-tenant enrollment tokens preferred | Disable platform token in prod; one-time tokens |
| **Plaintext config.json** | Secret leak | Env override | DPAPI + ACL hardening |
| **Kafka/Redis plaintext in compose** | Wiretap in shared networks | Dev only | TLS for prod compose |
| **Legacy signing optional** | Request forgery | HMAC available | Default `AGENT_REQUEST_SIGNING_REQUIRED=true` in prod |
| **XDR ingest key** | Data poisoning | Separate key | Rate limit + schema validation |
| **Dependency supply chain** | Vulnerable packages | `npm audit` in CI, CodeQL | SBOM, pinned lockfiles |

**Explicit non-goals (per project safety rules):** No stealth, persistence abuse, credential theft modules, AV bypass, kernel rootkits, or unrestricted shells.

---

## 9. Technical debt

| Item | Impact | Suggested fix |
|------|--------|---------------|
| 40+ ad-hoc migrations | Drift between environments | Single `migrations/` table + runner; fold SQL into versioned files |
| `schema.sql` tenant_id index bug | Fresh install failures | Fix base schema or document single bootstrap path |
| Controllers + services without repositories | Hard to test tenant queries | `repositories/` + `withTenant(conn, tenantId)` helper |
| Dual permission vocabularies | RBAC bugs | One `permissions.js` constants module |
| Non-standard API JSON | SOAR friction | Response middleware wrapping success/error |
| Detection rules only in DB | No GitOps for detections | Sync `detections/` → DB on deploy |
| In-memory agent nonce cache | Scale + restart replay window | Redis or MySQL TTL table |
| README migration list | Operator error | Point to `npm run migrate` only |
| Built assets in `server-node/public/` | Stale UI when serving from API port | Document dev vs prod paths (already partial) |
| Falcon parity docs vs enterprise spec | Confusion | Merge into `docs/ARCHITECTURE.md` + `ROADMAP.md` |

---

## 10. Recommended upgrade phases

Aligned with the upgrade specification (Section 23). Each phase should land with tests + docs updates.

### Phase 1 — Foundation (current sprint)

- [x] **This audit** (`docs/UPGRADE_AUDIT.md`)
- [x] `src/config/schema.js` + `src/config/index.js` — Zod validate env; fail on weak secrets in production
- [x] `src/utils/apiResponse.js` — standard envelope + `HttpError`; wired into errorHandler, validate, auth, rbac
- [x] `src/constants/permissions.js` — enterprise permission matrix + legacy/DB aliases
- [x] `src/utils/tenantQuery.js` — safe tenant scoping helpers
- [x] `/api/v1` mount with legacy `/api/*` aliases (OpenAPI on both paths)

### Phase 2 — Data layer

- [x] Formal migration runner (`npm run migrate`, `migrate:status`, `migrate:rollback`, `seed`) — `schema_migrations` table + manifest
- [x] Add missing columns/tables: `tenant_id` on `raw_events` / `normalized_events` / `alerts`; `agent_nonces`, `approved_scripts`, `detection_rule_versions`
- [x] Tenant isolation tests — `tenantIsolation.service.test.js` (mocked); `tenantIsolation.integration.test.js` with `RUN_DB_TESTS=true`

### Phase 3 — Agent trust

- [x] DPAPI secret store for `AgentKey` / tokens (`SecretProtector`, `AgentKeyProtected`)
- [x] Enrollment: one-time token consumption audit (`EnrollmentTokenService`, migration)
- [x] Default prod signing + MySQL nonces (`AgentNonceService`, config defaults)
- [x] mTLS docs + optional client cert enrollment path (`docs/security/agent-mtls-enrollment.md`)
- [x] Expanded agent health + tamper fields in canonical events (`canonicalEvent.js` host/sensor fields)

### Phase 4 — Telemetry pipeline

- [x] Canonical event JSON schema (Zod) (`server-node/src/schemas/canonicalEvent.js`)
- [x] Normalizer + idempotency by `event_id` (`EventIngestionService`, `agent_event_ids`)
- [x] Queue-first ingestion default in compose (`INGEST_QUEUE_FIRST`, `docker-compose.dev.yml`)

### Phase 5 — Detection engine

- [x] `server-node/detections/` layout + fixtures
- [x] `npm run detections:validate|test|replay`
- [x] IRN-WIN-* rule pack (**52** defensive rules in current pack; Phase 5 shipped **31** via `generate-detection-as-code-pack.js`)
- [x] Software Risk Management (inventory, CVE scoring, block policies, remediation, reports) — see `docs/SOFTWARE_RISK_MANAGEMENT.md`
- [x] MITRE coverage API + dashboard (`MitreCoverageService`, `/mitre`)

### Phase 6 — SOC workflows

- [x] Alert extensions (`risk_score`, `evidence_summary`, `why_fired`, disposition)
- [x] Incident workspace (existing module + evidence API)
- [x] Response lifecycle columns (`lifecycle_status`, `expires_at` migration)
- [x] Signed response commands (`ResponseCommandSigner`, agent verifier)

### Phase 7 — Dashboard

- [x] SOC triage queue (`/soc/triage`), alert “why fired”, MITRE page
- [x] Host timeline (`/hosts/:id/timeline`)
- [x] System health + integrations nav
- [x] Mock mode banner (`VITE_DEMO_MODE=true`)

### Phase 8 — Integrations & reports

- [x] Integration providers (webhook, Splunk HEC) + admin UI
- [x] Report jobs (JSON/HTML) with audit + download routes

### Phase 9 — DevSecOps & deployment

- [x] `docker-compose.dev.yml` / `docker-compose.prod.yml`
- [x] `docs/deployment/*`, `ARCHITECTURE.md`, `SECURITY_MODEL.md`
- [x] `.editorconfig`; `npm run lint` placeholder (ESLint in CI follow-up)
- [x] Tests: `responseCommandSigner`, `mitreCoverage` unit tests; existing CI detection validate

---

## Appendix A — File inventory (audit scope)

| Path | Role |
|------|------|
| `README.md` | Quick start, feature list, migration commands |
| `docker-compose.yml` | MySQL, Redis, Kafka, backend, worker |
| `database/` | 22 SQL/migration files |
| `server-node/src/` | ~139 JS source files |
| `server-node/dashboard/src/` | ~108 JSX/JS dashboard files |
| `agent-csharp/` | Service + Core + Updater + tests |
| `docs/` | 18 markdown docs (+ `docs/security/`) |
| `.github/workflows/` | ci.yml, codeql, dependency-review, dr-drill |

## Appendix B — Acceptance criteria mapping (spec Section 24)

| # | Criterion | Current state |
|---|-----------|---------------|
| 1 | Docker Compose local run | **Works** (mysql + redis + kafka + backend + worker) |
| 2 | Backend starts | **Yes** (requires env vars via `requiredEnv`) |
| 3 | Dashboard builds | **Yes** (CI + `npm run build-dashboard`) |
| 4 | MySQL migrations | **Partial** — `migrate-all` exists, not `migrate` |
| 5 | Seed admin login | **Yes** — `npm run create-admin` |
| 6 | Tenant isolation | **Partial** — needs automated cross-tenant tests |
| 7–9 | Agent enroll / heartbeat / telemetry | **Yes** (manual/E2E) |
| 10–12 | Detection → alerts → triage | **Yes** (DB rules + Alerts UI) |
| 13 | Incident from alert | **Partial** — incidents module exists |
| 14–15 | Response request + approval | **Yes** — approvals UI + migration |
| 16–17 | Audit + hash verify | **Yes** — `audit-logs/verify` |
| 18 | MITRE coverage page | **Yes** (`/mitre`) |
| 19 | API docs | **Partial** — OpenAPI JSON |
| 20–21 | Tests + CI | **Yes** — see `ci.yml` |
| 22 | No secrets in git | **Verify** — `.env.example` only (ongoing discipline) |
| 23 | Production docs | **Yes** — `docs/deployment/production.md`, `SECURITY_MODEL.md` |

## Appendix C — Commands reference (today vs target)

| Action | Today | Target |
|--------|-------|--------|
| Migrate | `cd server-node && npm run migrate-all` (deprecated alias) | `npm run migrate` |
| Migrate status / rollback | — | `npm run migrate:status` / `npm run migrate:rollback` |
| Seed | `npm run create-admin` + SQL `seed.sql` | `npm run seed` (+ `ADMIN_PASSWORD` for admin) |
| DB integration tests | — | `RUN_DB_TESTS=true npm test` |
| Detections CI | `npm run run-detection-replay` | `npm run detections:test` |
| Audit verify | GET `/api/admin/audit-logs/verify` | + `npm run audit:verify` |
| Docker dev | `docker-compose up` | `docker compose -f docker-compose.dev.yml up --build` |

---

*This document is the Phase 1 baseline for the enterprise upgrade program. Update it at the end of each phase to reflect delivered changes and revised gaps.*
