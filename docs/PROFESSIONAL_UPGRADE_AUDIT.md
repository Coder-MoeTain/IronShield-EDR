# IronShield EDR — Professional Upgrade Audit

**Repository:** [Coder-MoeTain/IronShield-EDR](https://github.com/Coder-MoeTain/IronShield-EDR)  
**Audit date:** 2026-05-17  
**Auditor role:** Enterprise EDR/XDR architecture baseline (defensive, authorized operations only)  
**Purpose:** Implementation checklist for production-grade IronShield upgrade. Use with [FEATURE_STATUS.md](FEATURE_STATUS.md) and [FINAL_10_10_READINESS_AUDIT.md](FINAL_10_10_READINESS_AUDIT.md).

**Current estimated production readiness:** **88 / 100** (Enterprise pilot)  
**Target:** **90+** after mandatory agent-trust production defaults, full envelope adoption, and detection fixture depth.

---

## Executive summary

IronShield-EDR is a **mature defensive EDR/XDR foundation**, not greenfield. The platform ships an 8-page SOC console, dual `/api` + `/api/v1` routing, console BFF, 52 IRN-WIN detection rules, Software Risk Management, agent DPAPI/HMAC/mTLS hooks, RBAC, tenant middleware, audit hash chain, production readiness scoring, and multi-job CI.

**Strengths:** Software risk end-to-end, detection-as-code tooling, console BFF contracts, OpenAPI coverage automation, formal migration runner, comprehensive permission constants.

**Top gaps for 10/10:**
1. **Architecture:** Target `src/modules/{auth,agents,...}` and `src/repositories/*` not fully realized — logic lives in 65+ services with 2 repositories.
2. **Tenant isolation:** `tenantQuery.js` helpers exist but are **not used** in services — isolation is ad-hoc SQL.
3. **Agent trust:** Signing/mTLS/unsigned commands are **env-gated**; production must fail closed.
4. **API envelope:** Middleware covers API mounts; dashboard still uses raw `.json()` in most tabs.
5. **Detection fixtures:** Only a subset of stable rules have benign/malicious/noisy fixtures.
6. **Documentation:** Several spec docs missing or duplicated (`security-model.md` vs `SECURITY_MODEL.md`).

---

## Feature status table

| # | Feature | Current status | Current files | Missing items | Required implementation | Priority | Test command | Documentation link |
|---|---------|----------------|---------------|---------------|-------------------------|----------|--------------|-------------------|
| 1 | Compact 8-page console | **Implemented** | `dashboard/src/routes/routeMap.jsx`, `features/{overview,endpoints,detections,investigation,response,hunting,protection,admin}/`, `utils/consoleNav.js` | Deep tab data still from `/admin/*` on some tabs | Migrate remaining tab loads to BFF or `/api/v1` + envelope | Medium | `npm run test:dashboard-tabs` (dashboard) | [ARCHITECTURE.md](ARCHITECTURE.md), [API_COVERAGE.md](API_COVERAGE.md) |
| 2 | Route-map frontend architecture | **Implemented** | `routeMap.jsx`, `App.jsx`, `consoleNav.js` | `src/pages/*` legacy re-exports remain | Keep single route map; deprecate `pages/` over time | Low | `npm run test:dashboard-tabs` | [ARCHITECTURE.md](ARCHITECTURE.md) |
| 3 | Legacy redirects | **Implemented** | `routes/legacyRedirects.js`, `RedirectPreserve.jsx`, `LegacyRedirects.jsx`, `LegacyRuleRedirects.jsx` | — | Maintain catalog on route changes | Low | `npm run test:legacy-redirects` | [API_COVERAGE.md](API_COVERAGE.md) |
| 4 | Console BFF APIs | **Implemented** | `routes/consoleRoutes.js`, `controllers/consoleController.js`, `services/ConsoleBffService.js` | Tab-level aggregation for heavy modules | Extend BFF payloads; reduce direct admin calls | Medium | `npm run test:console-bff` | [API_COVERAGE.md](API_COVERAGE.md) |
| 5 | `/api/v1` routing | **Implemented** | `src/app.js` (`API_PREFIXES`), all route modules | Dedicated `reports`/`integrations`/`audit` route files (today under admin) | Optional split route modules per target architecture | Medium | `npm run test:openapi` | [API_COVERAGE.md](API_COVERAGE.md), [api.md](api.md) |
| 6 | Standard API response envelope | **Partial** | `middleware/envelopeResponse.js`, `utils/apiResponse.js`, `utils/controllerEnvelope.js` | Health/metrics raw; some admin paths; dashboard partial adoption | Envelope all JSON APIs or document exceptions in API_COVERAGE | **Critical** | `npm run test:envelope` | [API_COVERAGE.md](API_COVERAGE.md) |
| 7 | RBAC and role permissions | **Partial** | `constants/permissions.js`, `middleware/rbac.js`, `migrations/20260521120000_rbac_matrix_extend.js` | Legacy permission strings on `adminRoutes`; route-level matrix tests | Unify canonical matrix; guard all admin routes; sync seed/OpenAPI/dashboard | **Critical** | `npm run test:rbac`, `npm run test:permissions` | [SECURITY_MODEL.md](SECURITY_MODEL.md) |
| 8 | Tenant isolation | **Partial** | `middleware/tenantMiddleware.js`, `requireTenantContext.js`, `utils/tenantQuery.js` | `tenantQuery` unused in services; events join-only tenant | Mandate tenant helpers in all scoped repositories/services | **Critical** | `npm run test:tenant-isolation` | [SECURITY_MODEL.md](SECURITY_MODEL.md) |
| 9 | Agent enrollment and trust | **Implemented** | `AgentRegistrationService.js`, `EnrollmentTokenService.js`, `enrollmentTokenController.js` | One-time token UX polish | Short-lived tenant-scoped tokens; enrollment audit | High | Agent registration tests | [SECURITY_MODEL.md](SECURITY_MODEL.md), [security/agent-mtls-enrollment.md](security/agent-mtls-enrollment.md) |
| 10 | Agent key hashing | **Implemented** | `utils/agentKeyHash.js`, `AgentKeyService.js`, migration agent-key-lifecycle | Plaintext key fallback in `auth.js` | Remove plaintext fallback in production; rotation UI | **Critical** | `test/agentKeyHash.unit.test.js` | [SECURITY_MODEL.md](SECURITY_MODEL.md) |
| 11 | DPAPI secret storage | **Implemented** (agent) | `agent-csharp/.../SecretProtector.cs`, `SecretStore.cs`, `ConfigService.cs` | Auto-migrate legacy plaintext on upgrade | Migrate plaintext → DPAPI on agent save | High | `npm run test:agent-software` | [SECURITY_MODEL.md](SECURITY_MODEL.md), [SOFTWARE_INVENTORY_AGENT.md](SOFTWARE_INVENTORY_AGENT.md) |
| 12 | Signed agent requests | **Partial** | `middleware/auth.js`, `agent-csharp/Transport/AgentRequestSigner.cs` | Not required by default in dev | `AGENT_REQUEST_SIGNING_REQUIRED=true` in prod compose | **Critical** | `test/agentNonce.replay.unit.test.js` | [SECURITY_MODEL.md](SECURITY_MODEL.md) |
| 13 | Nonce replay protection | **Implemented** | `services/AgentNonceService.js` | In-memory fallback acceptable only in dev | Redis/MySQL required in prod multi-instance | **Critical** | `test/agentNonce.replay.unit.test.js` | [enterprise-hardening.md](enterprise-hardening.md) |
| 14 | mTLS certificate binding | **Partial** | `middleware/agentCertBinding.js`, `index.js` (HTTPS requestCert) | Optional by default; trust UI partial | `AGENT_MTLS_REQUIRED=true`; cert mismatch audit | **Critical** | `test/endpointCompliance.unit.test.js` | [security/agent-mtls-enrollment.md](security/agent-mtls-enrollment.md) |
| 15 | Signed response commands | **Partial** | `services/ResponseCommandSigner.js`, `ResponseCommandVerifier.cs` | Unsigned commands still execute when signature empty | Reject unsigned in production (`RESPONSE_COMMAND_SIGNING_REQUIRED`) | **Critical** | `test/responseCommandSigner.unit.test.js` | [response-actions.md](response-actions.md) |
| 16 | Detection engineering | **Implemented** | `server-node/detections/`, `src/modules/detections/*`, `detectionRoutes.js` | XDR rule pack placeholder; `detections/xdr/` thin | Expand XDR packs; Sigma import draft-only workflow UI | High | `npm run detections:validate`, `npm run test:detections` | [DETECTION_ENGINEERING.md](DETECTION_ENGINEERING.md) |
| 17 | MITRE coverage | **Implemented** | `mitreCoverageService.js`, `detections/tools/coverageReport.js`, `MitreCoverageTab.jsx` | — | Keep rules mapped on publish | Medium | `npm run detections:coverage` | [DETECTION_ENGINEERING.md](DETECTION_ENGINEERING.md) |
| 18 | Detection quality | **Implemented** | `detectionQualityService.js`, `DetectionQualityTab.jsx` | Noisy-rule auto-disable | Alert on sustained FP rate | Medium | Dashboard vitest | [API_COVERAGE.md](API_COVERAGE.md) |
| 19 | Alert explainability | **Implemented** | `alertExplainabilityService.js`, `riskScoringService.js`, alert detail UI | XDR/IOC alert types depth | Ensure all alert sources populate why-fired | Medium | Manual + detection tests | [DETECTION_ENGINEERING.md](DETECTION_ENGINEERING.md) |
| 20 | Alert deduplication | **Implemented** | `alertDeduplicationService.js`, `AlertService.js` | — | Tune correlation windows | Low | Detection replay | — |
| 21 | Suppression lifecycle | **Partial** | `suppressionService.js`, `SuppressionsTab.jsx` | Expiry approval workflow | Approval + expiry enforcement | Medium | API integration tests | [DETECTION_ENGINEERING.md](DETECTION_ENGINEERING.md) |
| 22 | Incident workflow | **Partial** | `modules/incidents/incidentService.js`, `IncidentDetailTab.jsx` | Full lifecycle UI (Containment→Recovery) | Timeline, linked software risk, threat graph depth | High | Incident integration tests | [API_COVERAGE.md](API_COVERAGE.md) |
| 23 | Response approvals | **Implemented** | `ResponseActionService.js`, `middleware/sod.js`, response tabs | SoD on all high-risk types parity with software | Extend SoD matrix tests for software block | High | SoD unit tests | [response-actions.md](response-actions.md) |
| 24 | RTR safety | **Implemented** | `rtrController.js`, `RtrConsoleTab.jsx`, migrations falcon-ui-pack | — | Document emergency disable; allowlist tests in CI | High | RTR allowlist tests | [falcon-advanced-ui.md](falcon-advanced-ui.md) (historical) |
| 25 | Software Risk Management | **Implemented** | `routes/softwareRoutes.js`, `modules/software/*`, `SoftwareRiskTab.jsx` | Live NVD feed adapter | Scheduled CVE import; AppLocker N/A v1 | Medium | `npm run test:software`, `test:software-ui` | [SOFTWARE_RISK_MANAGEMENT.md](SOFTWARE_RISK_MANAGEMENT.md) |
| 26 | Installed software inventory | **Implemented** | `SoftwareInventoryCollector.cs`, `softwareInventoryService.js`, `EndpointSoftwareTab.jsx` | — | Delta upload tuning | Low | `npm run test:agent-software` | [SOFTWARE_INVENTORY_AGENT.md](SOFTWARE_INVENTORY_AGENT.md) |
| 27 | Vulnerability scoring | **Implemented** | `softwareRiskService.js`, `softwareVulnerabilityService.js` | Global CVE table not tenant-scoped (by design) | Document global vs tenant scope | Medium | `npm run test:software` | [SOFTWARE_RISK_MANAGEMENT.md](SOFTWARE_RISK_MANAGEMENT.md) |
| 28 | Software notify/update/uninstall | **Implemented** | `softwareRemediationService.js`, `SoftwareActionModals.jsx` | Delivery receipt UI depth | Agent notification result polling UI | Low | `npm run test:software-ui` | [SOFTWARE_REMEDIATION_WORKFLOW.md](SOFTWARE_REMEDIATION_WORKFLOW.md) |
| 29 | Software block/unblock workflow | **Implemented** | `softwareBlockPolicyService.js`, `softwareBlockSafety.js`, block lifecycle migration | OS-level enforcement limits | Policy sync metrics on endpoint trust | High | `npm run test:software` | [SOFTWARE_BLOCK_POLICY.md](SOFTWARE_BLOCK_POLICY.md) |
| 30 | Reports | **Implemented** | `reportsController.js`, `ReportService.js`, `softwareReportService.js`, Reports tabs | Native PDF engine | Optional PDF; expiring download links everywhere | Medium | Report export tests | [API_COVERAGE.md](API_COVERAGE.md) |
| 31 | Integrations | **Implemented** | `integrationsController.js`, `integrations/providers.js`, Admin integrations tab | Limited provider set | Additional SIEM providers | Low | Manual | [enterprise-hardening.md](enterprise-hardening.md) |
| 32 | Audit hash chain | **Implemented** | `AuditLogService.js`, `audit-verify-cli.js`, `auditVerifyController.js` | Scheduled verify job in prod | Cron `npm run audit:verify` | High | `npm run audit:verify` | [SECURITY_MODEL.md](SECURITY_MODEL.md) |
| 33 | OpenAPI coverage | **Implemented** | `openapi/openapi.json`, `scripts/sync-openapi-*.js`, `validate-openapi-coverage.js` | Semantic schema depth for all bodies | Envelope schemas on all documented routes | High | `npm run test:openapi` | [API_COVERAGE.md](API_COVERAGE.md) |
| 34 | Migration system | **Implemented** | `scripts/migrate.js`, `scripts/lib/migrateRunner.js`, `migrations/manifest.js` | 40+ legacy `migrate-*` npm scripts | CI `migrate:validate`; deprecate duplicate scripts in README | High | `npm run migrate:validate` | [MIGRATION_POLICY.md](MIGRATION_POLICY.md) |
| 35 | Docker dev/prod deployment | **Implemented** | `docker-compose.yml`, `docker-compose.dev.yml`, `docker-compose.prod.yml`, `server-node/Dockerfile` | TLS termination external; agent not containerized | Document prod secret checklist | Medium | Manual compose up | [deployment-production.md](deployment-production.md) |
| 36 | Production readiness score | **Implemented** | `ProductionReadinessService.js`, `ProductionReadinessPanel.jsx` | Score cap when critical checks fail (verify strictness) | Cap 90+ when signing/mTLS/pepper off in production NODE_ENV | **Critical** | `test/productionReadiness.v2.unit.test.js` | [PRODUCTION_READINESS.md](PRODUCTION_READINESS.md) |
| 37 | Tests and CI | **Partial** | `.github/workflows/ci.yml`, `codeql.yml`, `dependency-review.yml` | `test:envelope`, `test:rbac`, `test:tenant-isolation` not all in CI | Add gates for envelope, rbac, tenant, docs:status-check | **Critical** | `npm test` (server-node), dashboard `npm test`, agent `dotnet test` | README Testing section |
| 38 | README and documentation consistency | **Partial** | `README.md`, `docs/FEATURE_STATUS.md`, `docs:status-check` script | Falcon wording in historical docs; UPGRADE_AUDIT stale rows | IronShield branding; align counts (52 rules) | High | `npm run docs:status-check` | [FEATURE_STATUS.md](FEATURE_STATUS.md) |
| 39 | Branding consistency | **Partial** | README uses IronShield | `falcon-*` doc filenames and `/falcon/:area` route | Rename or mark historical docs deprecated | Low | Manual review | [FEATURE_STATUS.md](FEATURE_STATUS.md) |
| 40 | Security/supply-chain hardening | **Partial** | `codeql.yml`, `dependency-review.yml`, `npm run sbom`, `security-assurance.js` | Agent release signing in CI; dotnet scan in CI | SBOM on release; signed agent artifacts | High | `npm run security-assurance` | [security/supply-chain.md](security/supply-chain.md) |

---

## Target architecture gap analysis

### Backend modules (target vs actual)

| Target module | Status | Current location |
|---------------|--------|------------------|
| `modules/auth/` | **Missing** | `routes/authRoutes.js`, `services/AuthService.js` |
| `modules/agents/` | **Missing** | `routes/agentRoutes.js`, `services/Agent*`, `controllers/agentController.js` |
| `modules/endpoints/` | **Partial** | `services/EndpointService.js` |
| `modules/console/` | **Partial** | `services/ConsoleBffService.js` |
| `modules/detections/` | **Implemented** | `src/modules/detections/*` |
| `modules/alerts/` | **Missing** | `services/AlertService.js` |
| `modules/incidents/` | **Implemented** | `src/modules/incidents/incidentService.js` |
| `modules/response/` | **Missing** | `services/ResponseActionService.js`, controllers |
| `modules/software/` | **Implemented** | `src/modules/software/*` |
| `modules/hunting/` | **Missing** | Admin hunt routes + services |
| `modules/protection/` | **Partial** | `modules/antivirus/*`, `modules/platform/*` |
| `modules/audit/` | **Missing** | `services/AuditLogService.js` |
| `modules/integrations/` | **Missing** | `integrationsController.js` |
| `modules/reports/` | **Missing** | `reportsController.js`, `ReportService.js` |
| `modules/system/` | **Partial** | `platformController.js`, health in `app.js` |
| `modules/tenants/` | **Missing** | `services/TenantService.js` |
| `modules/users/` | **Missing** | Admin user routes |

### Repositories (target vs actual)

| Target repository | Status |
|-------------------|--------|
| `EndpointRepository.js` | **Missing** — use `EndpointService` SQL |
| `AlertRepository.js` | **Missing** — use `AlertService` |
| `IncidentRepository.js` | **Missing** — use `incidentService` |
| `EventRepository.js` | **Missing** — use ingest/normalization services |
| `DetectionRuleRepository.js` | **Implemented** |
| `SoftwareRepository.js` | **Missing** — use `modules/software/*` |
| `AuditRepository.js` | **Missing** — use `AuditLogService` |
| `TenantRepository.js` | **Missing** — use `TenantService` |
| `UserRepository.js` | **Missing** — admin user SQL |
| `AlertEvidenceRepository.js` | **Implemented** |

### Shared services (target vs actual)

| Target service | Status |
|----------------|--------|
| `AuditService.js` | **Partial** — `AuditLogService.js` exists |
| `TenantContextService.js` | **Partial** — middleware only |
| `PermissionService.js` | **Partial** — `rbac.js` + `permissions.js` |
| `ResponseEnvelopeService.js` | **Implemented** — `apiResponse.js` + envelope middleware |
| `OpenApiCoverageService.js` | **Partial** — scripts, not a service class |
| `ProductionReadinessService.js` | **Implemented** |

### Frontend target (target vs actual)

| Target | Status |
|--------|--------|
| `app/`, `routes/`, `features/*` | **Implemented** (features under `src/features/`) |
| `components/console`, `data`, `evidence`, `layout`, `security`, `status` | **Partial** — flat `components/` |
| `services/` API client layer | **Missing** — `utils/apiEnvelope.js` only |
| Reusable `ConsolePage`, `KpiStrip`, `FilterBar`, etc. | **Implemented** |

---

## Detection engineering inventory

| Item | Status | Path |
|------|--------|------|
| Rule schema | Implemented | `server-node/detections/schemas/rule.schema.json` |
| Test schema | Implemented | `server-node/detections/schemas/test.schema.json` |
| Pack schema | Implemented | `server-node/detections/schemas/pack.schema.json` |
| Windows MITRE tactics (11) | Implemented | `detections/windows/{execution,...}/` — **52** IRN-WIN rules |
| XDR packs | Partial | `detections/xdr/` placeholder |
| Fixtures benign/malicious/noisy | Partial | `detections/tests/fixtures/` — subset of stable rules |
| Tools validate/lint/test/replay/coverage | Implemented | `detections/tools/*.js` |
| npm scripts | Implemented | `detections:validate`, `lint`, `test`, `replay`, `coverage`, `docs`, `index`, `import-sigma` |

---

## Software Risk Management inventory

| Capability | API | UI | Agent | Tests |
|------------|-----|-----|-------|-------|
| Inventory | `GET /api/v1/software/inventory` | Protection → Installed Software | `POST .../software-inventory` | `test:software` |
| Vulnerabilities | CRUD `/software/vulnerabilities` | Vulnerability Database tab | — | `test:software` |
| Block policies | CRUD + approve | Block Policies tab | `GET .../software-policies` | SoD in `softwareBlockSafety` |
| Notify/update/uninstall | POST inventory actions | Modals | notification result | `test:software-ui` |
| Reports (6 types) | `GET /software/reports/:type` | Reports sub-tab | — | `test:software` |
| Protected processes | — | — | `SoftwareBlockEnforcer.cs` | `test:agent-software` |

---

## Agent trust checklist

| Control | Server | Agent | Prod default |
|---------|--------|-------|--------------|
| Enrollment token | Yes | Yes | Tenant-scoped |
| Key hashing + pepper | Yes | N/A | Required in prod |
| HMAC signing | Yes | Yes | **Opt-in** → must be required |
| Nonce replay (Redis/MySQL) | Yes | Yes | Redis in prod |
| mTLS binding | Yes | Yes | **Opt-in** → must be required |
| DPAPI secrets | N/A | Yes | Windows only |
| Signed commands | Yes | Yes (partial) | **Unsigned allowed** → reject in prod |
| Trust UI | Partial | N/A | `AgentTrustPanel.jsx` |

---

## Documentation inventory

| Document (spec) | Exists | Notes |
|-----------------|--------|-------|
| README.md | Yes | IronShield branding |
| FEATURE_STATUS.md | Yes | SSOT |
| PROFESSIONAL_UPGRADE_AUDIT.md | Yes | This file |
| API_COVERAGE.md | Yes | |
| ARCHITECTURE.md | Yes | |
| SECURITY_MODEL.md | Yes | Duplicate `security-model.md` |
| DEPLOYMENT.md | Partial | `deployment-production.md` |
| MIGRATION_POLICY.md | Yes | |
| DETECTION_* | Yes | |
| SOFTWARE_* | Yes | |
| RESPONSE_ACTIONS.md | Partial | `response-actions.md` |
| AUDIT_AND_COMPLIANCE.md | Partial | In SECURITY_MODEL |
| PRODUCTION_READINESS.md | Partial | In README + FINAL audit |
| MITRE_COVERAGE.md | Partial | In DETECTION_ENGINEERING |

---

## Recommended implementation phases

### Phase A — Critical security (P0)
1. Production fail-closed: signing, mTLS, pepper, unsigned command rejection
2. Readiness score cap below 90 when critical checks fail
3. Remove agent key plaintext fallback in production `auth.js`
4. CI gates: `test:envelope`, `test:rbac`, `test:tenant-isolation`

### Phase B — API & tenancy (P1)
1. `TenantContextService` + use `tenantQuery` in all scoped services
2. Repository scaffolds with mandatory `tenant_id` filters
3. Dashboard `readApiJson` adoption across feature tabs
4. OpenAPI envelope schemas for all route groups

### Phase C — Detection & incidents (P1)
1. Fixtures for all stable IRN-WIN rules
2. Suppression expiry approval workflow
3. Incident lifecycle UI depth

### Phase D — Architecture polish (P2)
1. Reorganize routes into target `modules/*` folders (incremental)
2. BFF tab aggregation
3. Rename/deprecate Falcon historical docs

---

## Verification matrix

Run from `server-node/`:

```bash
npm run docs:status-check
npm run test:envelope
npm run test:rbac
npm run test:permissions
npm run test:tenant-isolation
npm run test:console-bff
npm run test:openapi
npm run test:software
npm run test:agent-software
npm run test:software-ui
npm run test:detections
npm run detections:validate
npm run detections:lint
npm run detections:test
npm run detections:coverage
npm run audit:verify
npm run migrate:validate
cd dashboard && npm test && npm run build
cd ../agent-csharp && dotnet test
```

---

## Acceptance mapping (spec section 21)

| # | Criterion | Audit status |
|---|-----------|--------------|
| 1 | Audit report created | **Done** (this document) |
| 2 | README/docs consistent | Partial — run `docs:status-check` |
| 3 | Compact console | Implemented |
| 4 | `/api/v1` complete | Implemented |
| 5 | API envelope universal | Partial |
| 6 | RBAC matrix unified | Partial |
| 7 | Tenant isolation tests pass | Implemented (tests pass; code depth partial) |
| 8–12 | Agent trust hardened | Partial — production defaults |
| 13–15 | Detection + explainability | Implemented / partial fixtures |
| 16–19 | Software risk complete | Implemented |
| 20–22 | Response/RTR/reports | Implemented / partial prod defaults |
| 23 | Readiness score strict | Partial |
| 24–25 | OpenAPI + migrations | Implemented |
| 26–28 | Build/test/CI | Partial CI gates |
| 29–30 | Branding + safety | Implemented (defensive only) |

---

*This audit is the authoritative upgrade checklist. Update row status as gaps close; link PRs to feature numbers.*
