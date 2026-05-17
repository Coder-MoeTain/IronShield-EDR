# Software Block Policy

Execution block policies control whether matching processes are **blocked**, **warned**, or **audit-only** when launched on endpoints.

## Safety rules (never bypass)

| Rule | Enforcement |
|------|-------------|
| Protected Windows processes | `lsass`, `csrss`, `winlogon`, `svchost`, `explorer`, etc. — rejected at policy create and skipped by agent |
| IronShield agent | Process name/path containing `IronShield` or `EDR.Agent` — always allowed |
| System paths | Patterns matching `\Windows\System32\` — rejected unless explicitly approved by super_admin |
| Dangerous wildcards | `*`, short `*.exe` patterns — require `super_admin` role |

Protected process list is returned to agents in `GET /api/v1/agent/software-policies` as `protected_processes`.

## Lifecycle

| Status | Meaning |
|--------|---------|
| `requested` | Policy created |
| `pending_approval` | High-risk; awaiting approver |
| `approved` | Approver recorded (SoD checked) |
| `active` | Enabled and pushed to agents |
| `failed` | Agent reported enforcement failure |
| `expired` | `expires_at` passed |
| `cancelled` | Admin deleted/disabled |
| `rolled_back` | Unblock or emergency unblock |

## High-risk approval

Triggers when blocking: browsers, security tools, vendor-wide rules, or short wildcard paths.

**Required:**

- `reason` (min 3 characters) on block request
- `approved_by` must be a **different** user than requester
- Optional `expires_at` for time-bound blocks

API: `POST /api/v1/software/inventory/:id/block` with body `{ "reason", "approved_by", "expires_at" }`.

Approve pending policy: `POST /api/v1/software/block-policies/:id/approve`.

## Emergency unblock

Tenant-scoped rollback for incidents: `POST /api/v1/software/emergency-unblock` with `{ "reason" }` (requires `software:unblock` or `*` permission). Disables all active block policies and clears inventory blocked flags. Fully audited.

## Agent enforcement

`SoftwareBlockEnforcer` evaluates `process_create` events against active policies. Protected processes are never terminated. Results posted to `POST /api/v1/agent/software-policy-result`.
