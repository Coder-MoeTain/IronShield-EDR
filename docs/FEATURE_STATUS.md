# IronShield EDR — Feature Status

**Last updated:** 2026-05-17  
**Purpose:** Single source of truth for feature implementation status. Use with [FINAL_10_10_READINESS_AUDIT.md](FINAL_10_10_READINESS_AUDIT.md).

**Status values:** `implemented` · `partial` · `planned` · `deprecated`

---

| Feature | Status | Route / API | UI location | Tests | Docs | Notes |
|---------|--------|-------------|-------------|-------|------|-------|
| Compact 8-page console | implemented | `/overview` … `/admin` | Sidebar modules | `test:dashboard-tabs`, Playwright | README, ARCHITECTURE | 56 legacy redirects |
| Console BFF | implemented | `GET /api/v1/console/*` | All module pages (KPIs) | `test:console-bff` | API_COVERAGE | Tabs may still call admin APIs |
| API v1 alias | implemented | `/api/v1/*` mirrors `/api/*` | — | `test:openapi` | README, api.md | Dual mount in `app.js` |
| Standard API envelope | implemented | All `/api` and `/api/v1` groups | `apiEnvelope.js` | `test:envelope` | API_COVERAGE | Agent unwraps `data` in HttpTransport |
| Detection rule versions | implemented | `GET /detections/rules/:id/versions` | Detections module | `test:detections` | DETECTION_ENGINEERING | DB table `detection_rule_versions` |
| Detection rule rollback | implemented | `POST /detections/rules/:id/rollback` | — | `test:detections` | DETECTION_ENGINEERING | Version snapshot |
| Detection rule diff | implemented | `GET /detections/rules/:id/diff` | — | `test:detections` | DETECTION_ENGINEERING | Query `from_version_id` |
| Detection rule reviews | implemented | `GET /detections/rule-reviews` | — | `test:detections` | DETECTION_ENGINEERING | Pending queue |
| Sigma import (draft) | implemented | `POST /detections/import-sigma` | — | `test:detections` | DETECTION_ENGINEERING | Never auto-enables |
| Endpoint installed software | implemented | `GET /api/v1/software/inventory?endpoint_id=` | Endpoints → Installed Software | `test:software-ui` | SOFTWARE_RISK_MANAGEMENT | Block/notify actions |
| RBAC permission matrix | partial | JWT + `requirePermission` | `PermissionGate`, tab guards | `test:rbac`, `test:permissions` | SECURITY_MODEL | Extend detection_engineer roles |
| Tenant isolation | implemented | `req.tenantId` on scoped routes | Tenant switcher (super_admin) | `test:tenant-isolation` | SECURITY_MODEL | Events join via endpoint |
| Agent key hashing | implemented | Agent register/rotate | Endpoint trust (partial UI) | `agentKeyHash.unit.test.js` | SECURITY_MODEL | `AGENT_KEY_PEPPER` in prod |
| DPAPI secrets | implemented | — | — | `test:agent-software` | SECURITY_MODEL | `AgentKeyProtected` in config |
| Request signing | implemented | `X-Agent-*` headers | — | `agentNonce.replay` | SECURITY_MODEL | Required in prod default |
| Nonce replay store | implemented | Redis / MySQL | — | `agentNonce.replay` | enterprise-hardening | No in-memory in prod |
| mTLS cert binding | partial | TLS + cert fingerprint | Endpoint detail (partial) | `endpointCompliance` | agent-mtls-enrollment | `AGENT_MTLS_REQUIRED` opt-in |
| Signed response commands | implemented | Response action dispatch | Response approvals | `responseCommandSigner` | response-actions.md | Unsigned compat in dev |
| Detection-as-code (52 rules) | implemented | `/api/v1/detections/*` | Detections module | `detections:*`, `test:detections` | DETECTION_ENGINEERING | Phase 5 shipped 31; pack now 52 |
| MITRE coverage | implemented | `GET /api/v1/admin/mitre/coverage` | `/detections?tab=mitre` | `mitreCoverage`, `detections:coverage` | DETECTION_ENGINEERING | — |
| Detection quality | implemented | Analytics APIs | `/detections?tab=quality` | Dashboard vitest | API_COVERAGE | — |
| Alert explainability | implemented | Alert detail API | Alert detail tab | Manual | DETECTION_ENGINEERING | `evidence_summary`, risk score |
| Alert deduplication | implemented | Alert create/update | — | Detection replay | — | Fingerprint fields |
| Suppressions | partial | Admin suppression routes | `/detections?tab=suppressions` | Manual | DETECTION_ENGINEERING | Expiry approval TBD |
| Incident workflow | partial | `/api/v1/admin/incidents` | `/investigation?tab=incidents` | Manual | API_COVERAGE | Lifecycle depth |
| Response approvals | implemented | `/response-actions/approvals` | `/response?tab=approvals` | Unit (SoD) | response-actions.md | High-risk SoD |
| RTR | implemented | `/api/v1/admin/rtr/*` | `/response?tab=rtr` | `test:legacy-redirects` | falcon-advanced-ui | Disabled by default |
| Software Risk Management | implemented | `/api/v1/software/*` | `/protection?tab=software-risk` | `test:software*` | SOFTWARE_RISK_MANAGEMENT | README section |
| Software inventory (agent) | implemented | `POST /api/v1/agent/software-inventory` | Endpoint → Installed Software | `test:agent-software` | SOFTWARE_INVENTORY_AGENT | Registry-based |
| Vulnerability scoring | implemented | Software risk APIs | Software Risk tabs | `test:software` | SOFTWARE_RISK_MANAGEMENT | Import + local DB |
| Software block policy | implemented | Block policy APIs | Block Policies tab | `test:software` | SOFTWARE_BLOCK_POLICY | SoD + protected processes |
| Software notifications | implemented | Remediation APIs | Modals | `test:software-ui` | SOFTWARE_REMEDIATION_WORKFLOW | — |
| Platform reports (8) | implemented | `POST /api/v1/admin/reports` | Admin → Reports | Manual | API_COVERAGE | JSON/CSV/HTML |
| Software reports (6) | implemented | `GET /api/v1/software/reports/:type` | Software Risk → Reports | `test:software` | SOFTWARE_RISK_MANAGEMENT | — |
| Integrations | implemented | Webhook, Splunk HEC | Admin → Integrations | Manual | enterprise-hardening | — |
| Audit hash chain | implemented | `/audit-logs/verify` | Admin → Audit | `audit:verify` | SECURITY_MODEL | — |
| OpenAPI | implemented | `/api/v1/openapi.json` | — | `test:openapi` | API_COVERAGE | Sync scripts |
| Migrations (`npm run migrate`) | implemented | CLI | — | `migrateRunner.unit` | MIGRATION_POLICY | `migrate-all` deprecated |
| Docker dev/prod | implemented | Compose files | — | Manual | deployment/ | — |
| Production readiness | implemented | `GET .../production-readiness` | Overview, Admin health | `productionReadiness.v2` | README | Score 0–100 |
| Global search (Ctrl+K) | implemented | `GET /api/v1/admin/search/global` | Command center | `test:command-center` | — | — |
| Workspace modes | implemented | User prefs API | Console mode toggle | Manual | — | Simple/Advanced/Admin/MSSP/Auditor |
| Legacy SQL migrations | deprecated | `database/*.sql` | — | — | legacy-migrations.md | Use `npm run migrate` |
| Falcon parity docs | deprecated | — | — | — | falcon-parity-features.md | Historical; use IronShield docs |

---

## Verification commands

```bash
cd server-node
npm run docs:status-check
npm run test:openapi
npm run test:envelope
npm run test:rbac
npm run test:tenant-isolation
npm run test:software
npm run detections:validate
npm run migrate:validate
```
