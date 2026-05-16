# API coverage matrix — compact console

Maps each compact UI tab to backend API, OpenAPI path, and automated test.

**Status:** `implemented` | `partial` | `planned` | `deprecated`

## Console BFF (`/api/v1/console/*`)

| Module | BFF endpoint | Status | Test |
|--------|--------------|--------|------|
| Overview | `GET /api/v1/console/overview` | implemented | `npm test` → `test/consoleBff.contract.test.js` |
| Endpoints | `GET /api/v1/console/endpoints` | implemented | same |
| Endpoint detail | `GET /api/v1/console/endpoints/:id` | implemented | same + openapi |
| Detections | `GET /api/v1/console/detections` | implemented | same |
| Investigation | `GET /api/v1/console/investigation` | implemented | same |
| Response | `GET /api/v1/console/response` | implemented | same |
| Hunting | `GET /api/v1/console/hunting` | implemented | same |
| Protection | `GET /api/v1/console/protection` | implemented | same |
| Admin | `GET /api/v1/console/admin` | implemented | same |

BFF envelope: `{ success, data, requestId }` where `data` includes `meta`, `tabs`, `kpis`, `health`, `permissions`, and `recent` where applicable.

## Overview tabs

| Tab | Primary API | Status | Test |
|-----|-------------|--------|------|
| Executive Summary | BFF + `GET /api/v1/admin/dashboard/summary` | implemented | `dashboard` e2e smoke |
| SOC Operations | `GET /api/v1/admin/xdr/summary` | implemented | manual |
| Endpoint Health | `GET /api/v1/admin/sensors/health` | implemented | manual |
| Detection Analytics | `GET /api/v1/admin/analytics/detections-summary` | implemented | manual |
| System Health | `GET /api/v1/admin/system/health` | implemented | BFF + `ProductionReadinessService` |
| Tenant Overview | `GET /api/v1/admin/mssp/overview` | implemented | manual |
| Production readiness | `GET /api/v1/admin/platform/production-readiness` | implemented | `npm test` (service) |

## Command Center

| Feature | API | Status | Test |
|---------|-----|--------|------|
| Global search (Ctrl+K) | `GET /api/v1/admin/search/global` | implemented | manual |
| Workspace preferences | localStorage + optional `PATCH .../users/me/preferences` | partial | `dashboard` vitest `workspacePreferences` |

## Detections tabs

| Tab | Primary API | Status | Test |
|-----|-------------|--------|------|
| Triage Queue | `GET /api/v1/admin/soc/triage` | implemented | manual |
| Alerts | `GET /api/v1/admin/alerts` | implemented | manual |
| Detection Rules | `GET /api/v1/admin/detection-rules` | implemented | manual |
| MITRE Coverage | `GET /api/v1/admin/mitre/coverage` | implemented | `npm test` → `mitreCoverage.unit.test.js` |
| XDR Detections | `GET /api/v1/admin/xdr/detections` | implemented | manual |
| Suppressions | `GET /api/v1/admin/suppressions` | implemented | manual |
| Detection Analytics | `GET /api/v1/admin/analytics/detections-summary` | implemented | manual |
| Quality | `GET /api/v1/admin/analytics/detection-quality` | implemented | dashboard vitest |

## Protection tabs

| Tab | Primary API | Status | Test |
|-----|-------------|--------|------|
| Overview | `GET /api/v1/admin/av/dashboard` | implemented | manual |
| Detections | `GET /api/v1/admin/av/detections` | implemented | manual |
| Quarantine | `GET /api/v1/admin/av/quarantine` | implemented | legacy redirect test |
| Policies / signatures / scans | `/api/v1/admin/av/*` | implemented | manual |

## Admin tabs

| Tab | Primary API | Status | Test |
|-----|-------------|--------|------|
| Settings | `GET/PATCH /api/v1/admin/settings` | implemented | `permissions.test.js` |
| Tenants | `GET /api/v1/admin/tenants` | implemented | RBAC matrix test |
| RBAC | `GET /api/v1/admin/rbac/*` | implemented | `rbacRouteMatrix.unit.test.js` |
| Integrations | webhooks / SIEM routes | implemented | manual |
| Audit | `GET /api/v1/admin/audit-logs` | implemented | `npm run audit:verify` |
| Reports | `GET /api/v1/admin/reports` | implemented | manual |
| System Health | `GET /api/v1/admin/system/health` | implemented | BFF admin module |

## Telemetry & detection quality

| Check | API / command | Status | Test |
|-------|---------------|--------|------|
| Endpoint telemetry quality | `GET /api/v1/admin/platform/telemetry-quality` | implemented | BFF endpoints module |
| Detection quality summary | BFF detections + analytics | implemented | `detections:test` |
| Production readiness score | `GET /api/v1/admin/platform/production-readiness` | implemented | `ProductionReadinessService` |

## Detection-as-code

| Check | Command | Status |
|-------|---------|--------|
| Rule validation | `npm run detections:validate` | implemented |
| Rule unit tests | `npm run detections:test` | implemented |

## CI enforcement

```bash
cd server-node
npm run docs:status-check
npm run test:openapi
npm run detections:test
npm test
cd dashboard && npm test && npm run build
```

Update this matrix when adding tabs or APIs.
