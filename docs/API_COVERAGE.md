# API coverage matrix — compact console

Maps each compact UI tab to backend API, OpenAPI path, and automated test.

## Console BFF (`/api/v1/console/*`)

| Module | BFF endpoint | OpenAPI | Test |
|--------|--------------|---------|------|
| Overview | `GET /api/v1/console/overview` | `openapi.json` | `npm run test:openapi` |
| Endpoints | `GET /api/v1/console/endpoints` | yes | openapi coverage |
| Endpoint detail | `GET /api/v1/console/endpoints/:id` | yes | openapi coverage |
| Detections | `GET /api/v1/console/detections` | yes | openapi coverage |
| Investigation | `GET /api/v1/console/investigation` | yes | openapi coverage |
| Response | `GET /api/v1/console/response` | yes | openapi coverage |
| Hunting | `GET /api/v1/console/hunting` | yes | openapi coverage |
| Protection | `GET /api/v1/console/protection` | yes | openapi coverage |
| Admin | `GET /api/v1/console/admin` | yes | openapi coverage |

## Overview tabs

| Tab | Primary API | OpenAPI | Test |
|-----|-------------|---------|------|
| Executive Summary | BFF overview + `GET /api/v1/admin/dashboard/summary` | admin | e2e smoke |
| SOC Operations | `GET /api/v1/admin/xdr/summary` | admin | — |
| Endpoint Health | `GET /api/v1/admin/sensors/health` | admin | — |
| Detection Analytics | `GET /api/v1/admin/analytics/detections-summary` | admin | — |
| System Health | `GET /api/v1/admin/system/health` | admin | — |
| Tenant Overview | `GET /api/v1/admin/mssp/overview` | admin | — |
| Production readiness | `GET /api/v1/admin/platform/production-readiness` | admin | unit (service) |

## Detections tabs

| Tab | Primary API | OpenAPI | Test |
|-----|-------------|---------|------|
| Triage Queue | `GET /api/v1/admin/soc/triage` | admin | — |
| Alerts | `GET /api/v1/admin/alerts` | admin | — |
| Detection Rules | `GET /api/v1/admin/detection-rules` | admin | — |
| MITRE Coverage | `GET /api/v1/admin/mitre/coverage` | admin | — |
| XDR Detections | `GET /api/v1/admin/xdr/detections` | admin | — |
| Suppressions | `GET /api/v1/admin/suppressions` | admin | — |
| Detection Analytics | `GET /api/v1/admin/analytics/detections-summary` | admin | — |
| Quality | `GET /api/v1/admin/analytics/detection-quality` | admin | dashboard vitest |

## Endpoints

| Tab | Primary API | Test |
|-----|-------------|------|
| All endpoints | `GET /api/v1/admin/endpoints` | — |
| Telemetry quality | `GET /api/v1/admin/platform/telemetry-quality` | BFF + admin |

## Investigation

| Tab | Primary API | Test |
|-----|-------------|------|
| Threat Graph | `GET /api/v1/admin/threat-graph` + entity graph tables | — |

## Global search / Command Center

| Feature | API | Test |
|---------|-----|------|
| Ctrl+K search | `GET /api/v1/admin/search/global` | manual |

## Detection-as-code

| Check | Command |
|-------|---------|
| Rule validation | `npm run detections:validate` |
| Rule unit tests | `npm run detections:test` |

## CI enforcement

```bash
cd server-node
npm run test:openapi    # includes console BFF routes
npm run detections:test
cd dashboard && npm test
```

Update this matrix when adding tabs or APIs.
