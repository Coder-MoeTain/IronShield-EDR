# API coverage matrix — compact console

Maps compact UI tabs to backend APIs and automated tests.

**Status:** `implemented` | `partial` | `planned` | `deprecated`

**Test commands:**

| Command | Scope |
|---------|--------|
| `npm run test:console-bff` | BFF routes + payload contract |
| `npm run test:dashboard-tabs` | Tab → API route mapping |
| `npm run test:permissions` | Admin/report RBAC helpers |
| `npm run test:legacy-redirects` | Legacy URL redirects |
| `npm run test:command-center` | Global search API |
| `npm run test:openapi` | OpenAPI sync + coverage |
| `npm run detections:test` | Detection-as-code pack |

---

## Console BFF routes

| Module | Endpoint | Status | Test |
|--------|----------|--------|------|
| Overview | `GET /api/v1/console/overview` | implemented | `npm run test:console-bff` |
| Endpoints | `GET /api/v1/console/endpoints` | implemented | `npm run test:console-bff` |
| Endpoint detail | `GET /api/v1/console/endpoints/:id` | implemented | `npm run test:console-bff` |
| Detections | `GET /api/v1/console/detections` | implemented | `npm run test:console-bff` |
| Investigation | `GET /api/v1/console/investigation` | implemented | `npm run test:console-bff` |
| Response | `GET /api/v1/console/response` | implemented | `npm run test:console-bff` |
| Hunting | `GET /api/v1/console/hunting` | implemented | `npm run test:console-bff` |
| Protection | `GET /api/v1/console/protection` | implemented | `npm run test:console-bff` |
| Admin | `GET /api/v1/console/admin` | implemented | `npm run test:console-bff` |

Envelope: `{ success, data, requestId }` — `data` includes `meta`, `tabs`, `kpis`, `health`, `permissions`, and `recent` where applicable.

---

## Overview tabs

| Tab | Primary API | Status | Test |
|-----|-------------|--------|------|
| Executive Summary | `GET /api/v1/admin/dashboard/summary` | implemented | e2e smoke |
| SOC Operations | `GET /api/v1/admin/xdr/summary` | implemented | `npm run test:dashboard-tabs` |
| Endpoint Health | `GET /api/v1/admin/sensors/health` | implemented | `npm run test:dashboard-tabs` |
| Detection Analytics | `GET /api/v1/admin/analytics/detections-summary` | implemented | `npm run test:dashboard-tabs` |
| System Health | `GET /api/v1/admin/system/health` | implemented | `npm test` (readiness v2) |
| Tenant Overview | `GET /api/v1/admin/mssp/overview` | implemented | manual |
| Production readiness | `GET /api/v1/admin/platform/production-readiness` | implemented | `productionReadiness.v2.unit.test.js` |

---

## Endpoints tabs

| Tab | Primary API | Status | Test |
|-----|-------------|--------|------|
| All endpoints | `GET /api/v1/admin/endpoints` | implemented | `npm run test:dashboard-tabs` |
| Host groups | `GET /api/v1/admin/host-groups` | implemented | manual |
| Timeline / processes / network | endpoint-scoped admin APIs | implemented | manual |
| Telemetry quality | `GET /api/v1/admin/platform/telemetry-quality` | implemented | BFF endpoints module |

---

## Detections tabs

| Tab | Primary API | Status | Test |
|-----|-------------|--------|------|
| Triage Queue | `GET /api/v1/admin/soc/triage` | implemented | `npm run test:dashboard-tabs` |
| Alerts | `GET /api/v1/admin/alerts` | implemented | `npm run test:dashboard-tabs` |
| Detection Rules | `GET /api/v1/admin/detection-rules` | implemented | `npm run test:dashboard-tabs` |
| MITRE Coverage | `GET /api/v1/admin/mitre/coverage` | implemented | `mitreCoverage.unit.test.js` |
| XDR Detections | `GET /api/v1/admin/xdr/detections` | implemented | `npm run test:dashboard-tabs` |
| Suppressions | `GET /api/v1/admin/suppressions` | implemented | `npm run test:dashboard-tabs` |
| Detection Analytics | `GET /api/v1/admin/analytics/detections-summary` | implemented | manual |
| Quality | `GET /api/v1/admin/analytics/detection-quality` | implemented | dashboard vitest |

---

## Investigation tabs

| Tab | Primary API | Status | Test |
|-----|-------------|--------|------|
| Incidents | `GET /api/v1/admin/incidents` | implemented | manual |
| Cases | `GET /api/v1/admin/investigations` | implemented | manual |
| Threat Graph | `GET /api/v1/admin/threat-graph` | implemented | `npm run test:dashboard-tabs` |
| Reports (case) | investigation report routes | partial | manual |

---

## Response tabs

| Tab | Primary API | Status | Test |
|-----|-------------|--------|------|
| Approvals | `GET /api/v1/admin/response-actions/approvals/pending` | implemented | manual |
| RTR | `GET /api/v1/admin/rtr/sessions` | implemented | `npm run test:legacy-redirects` |
| Playbooks | `GET /api/v1/admin/response-playbooks` | implemented | manual |
| Quarantine | AV quarantine admin APIs | implemented | manual |

---

## Hunting tabs

| Tab | Primary API | Status | Test |
|-----|-------------|--------|------|
| Events | `GET /api/v1/admin/events` | implemented | `npm run test:legacy-redirects` |
| Raw / normalized | raw & normalized event APIs | implemented | manual |
| XDR events | `GET /api/v1/admin/xdr/events` | implemented | `npm run test:legacy-redirects` |
| IOCs | `GET /api/v1/admin/iocs` | implemented | manual |
| Network | `GET /api/v1/admin/network/summary` | implemented | manual |

---

## Protection tabs

| Tab | Primary API | Status | Test |
|-----|-------------|--------|------|
| Overview | `GET /api/v1/admin/av/dashboard` | implemented | manual |
| Detections | `GET /api/v1/admin/av/detections` | implemented | manual |
| Quarantine | `GET /api/v1/admin/av/quarantine` | implemented | `npm run test:legacy-redirects` |
| Policies / signatures / scans | `/api/v1/admin/av/*` | implemented | manual |

---

## Admin tabs

| Tab | Primary API | Status | Test |
|-----|-------------|--------|------|
| Settings | `GET/PATCH /api/v1/admin/settings` | implemented | `npm run test:permissions` |
| Tenants | `GET /api/v1/admin/tenants` | implemented | `npm run test:permissions` |
| RBAC | `GET /api/v1/admin/rbac/*` | implemented | `rbacRouteMatrix.unit.test.js` |
| Integrations | webhook / SIEM routes | implemented | `npm run test:permissions` |
| Audit | `GET /api/v1/admin/audit-logs` | implemented | `npm run audit:verify` |
| Reports | `GET /api/v1/admin/reports` | implemented | `npm run test:permissions` |
| System Health | `GET /api/v1/admin/system/health` | implemented | readiness v2 |

Report permissions: `report:view`, `report:create`, `report:export`, `report:delete` — auditors have **view** only.

---

## Command Center

| Feature | API | Status | Test |
|---------|-----|--------|------|
| Global search (Ctrl+K) | `GET /api/v1/admin/search/global` | implemented | `npm run test:command-center` |
| Workspace preferences | localStorage + optional server sync | partial | manual |

---

## Missing coverage

| Area | Gap | Priority |
|------|-----|----------|
| Tab E2E with live API | Most tabs lack Playwright tests against a running backend | medium |
| BFF adoption in UI | Overview uses BFF; many tabs still call admin APIs directly | low |
| Report permissions in DB seed | `report:*` permissions may need DB seed for custom roles | medium |
| Workspace preferences API | Server `PATCH /users/me/preferences` optional / partial | low |
| Investigation / response tab API matrix tests | Only Threat Graph in `test:dashboard-tabs` | medium |
| Protection / hunting full matrix | Manual coverage only | low |
| Live tenant isolation in CI | Requires `RUN_DB_TESTS=true` | medium |

---

## CI enforcement

```bash
cd server-node
npm run docs:status-check
npm run test:console-bff
npm run test:dashboard-tabs
npm run test:permissions
npm run test:legacy-redirects
npm run test:command-center
npm run test:openapi
npm run detections:test
npm test
cd dashboard && npm run build
```
