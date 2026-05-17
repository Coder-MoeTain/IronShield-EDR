# Software Risk Management

IronShield Software Risk Management provides enterprise SOC visibility into installed endpoint software, vulnerability scoring, remediation workflows, policy-based execution controls, and exportable compliance reports.

## Overview

- **Agent** collects installed programs from Windows registry uninstall keys (HKLM, WOW6432, HKCU). Never uses `Win32_Product`.
- **Backend** stores tenant-scoped inventory, matches vulnerabilities, calculates risk scores, tracks remediation with audited lifecycle, and enforces block safety policies.
- **Dashboard** — Protection → Software Risk (summary, inventory, vulnerable software, block policies, remediation, reports, vulnerability DB); Endpoint Detail → Installed Software.

## API envelope

All `/api/v1/software/*` and agent software routes return:

```json
{ "success": true, "data": { ... }, "requestId": "..." }
```

Errors: `{ "success": false, "error": { "code", "message", "details?" }, "requestId" }`.

Legacy bare JSON responses are no longer returned from software controllers; the dashboard parses the envelope via `apiEnvelope.js` with legacy fallback for transitional proxies.

## Data flow

1. Agent scans registry on startup and every 24 hours (configurable).
2. Agent uploads delta via `POST /api/v1/agent/software-inventory`.
3. Backend upserts `endpoint_software_inventory` and recalculates `endpoint_software_risk`.
4. Admin views/filters inventory and triggers notify/block/accept-risk/refresh/create-incident actions through modals.
5. Agent polls `GET /api/v1/agent/software-policies` for block policies, protected process allowlist, and pending notifications.

## RBAC

Permissions: `software:view`, `software:manage`, `software:vulnerability:manage`, `software:notify`, `software:block`, `software:unblock`, `software:accept_risk`, `software:export`, `software:policy:manage`.

High-risk block policies require a **separate approver** (segregation of duties — requester cannot approve).

## Block lifecycle

Block policies progress through: `requested` → `pending_approval` → `approved` → `active` (or `failed`, `expired`, `cancelled`, `rolled_back`). Every transition is audited.

## Reports

Export via Protection → Software Risk → Reports or `GET /api/v1/software/reports/:type?format=json|csv|html`:

| Type | Description |
|------|-------------|
| `vulnerable` | Software with risk score ≥ 61 |
| `critical-risk` | Critical risk level only |
| `endpoint-inventory` | Full inventory (optional `endpoint_id`) |
| `blocked` | Blocked software + active policies |
| `remediation-status` | Remediation action history |
| `accepted-risk` | Accepted risk exceptions |

## Audit

Inventory uploads, vulnerability changes, notifications, blocks, lifecycle transitions, emergency unblock, and exports are written to `audit_logs`.

## Testing

```bash
cd server-node
npm run test:software
npm run test:software-ui
npm run test:agent-software
npm run test:openapi
```

## Limitations

- Version matching is best-effort semantic comparison; ambiguous versions are flagged `needs_review`.
- Block enforcement is agent-side process termination — not AppLocker/WDAC in v1.
- Vulnerability data is local DB + JSON/CSV import; NVD/OSV feed adapter is future work. Demo CVEs must use `CVE-DEMO-*` prefix.

See also: `SOFTWARE_INVENTORY_AGENT.md`, `SOFTWARE_BLOCK_POLICY.md`, `SOFTWARE_REMEDIATION_WORKFLOW.md`.
