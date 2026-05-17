# Software Risk Management

IronShield Software Risk Management provides SOC visibility into installed endpoint software, vulnerability scoring, remediation workflows, and policy-based execution controls.

## Overview

- **Agent** collects installed programs from Windows registry uninstall keys (HKLM, WOW6432, HKCU).
- **Backend** stores tenant-scoped inventory, matches vulnerabilities, calculates risk scores, and tracks remediation.
- **Dashboard** — Protection → Software Risk; Endpoint Detail → Installed Software; Overview KPI for vulnerable software count.

## Data flow

1. Agent scans registry on startup and every 24 hours (configurable).
2. Agent uploads delta via `POST /api/v1/agent/software-inventory`.
3. Backend upserts `endpoint_software_inventory` and recalculates `endpoint_software_risk`.
4. Admin views/filters inventory and triggers notify/block/accept-risk actions.
5. Agent polls `GET /api/v1/agent/software-policies` for block policies and pending user notifications.

## RBAC

Permissions: `software:view`, `software:manage`, `software:vulnerability:manage`, `software:notify`, `software:block`, `software:unblock`, `software:accept_risk`, `software:export`, `software:policy:manage`.

High-risk block policies require manager approval (cannot self-approve).

## Audit

All inventory uploads, vulnerability changes, notifications, blocks, and exports are written to `audit_logs`.

## Limitations

- Version matching is best-effort semantic comparison; ambiguous versions are flagged “needs review”.
- Block enforcement is agent-side process termination for matching launches — not AppLocker/WDAC in v1.
- Vulnerability data is local DB + manual/demo import; NVD/OSV integration is future work.

See also: `SOFTWARE_INVENTORY_AGENT.md`, `SOFTWARE_BLOCK_POLICY.md`, `SOFTWARE_REMEDIATION_WORKFLOW.md`.
