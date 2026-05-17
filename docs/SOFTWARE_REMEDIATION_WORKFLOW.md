# Software Remediation Workflow

Remediation actions coordinate admin intent with agent-delivered user notifications and inventory refresh requests.

## Action types

| Type | Description |
|------|-------------|
| `notify_update` | User notification to patch software |
| `notify_uninstall` | User notification to remove software |
| `block_execution` | Creates/links block policy |
| `unblock_execution` | Removes block for inventory item |
| `accept_risk` | Documents risk acceptance with expiry |
| `refresh_inventory` | Requests agent full/delta scan |

## Status lifecycle

`requested` → `pending_agent` → `delivered` → `acknowledged` → `completed` (or `failed`, `cancelled`, `expired`).

## APIs

| Endpoint | Permission |
|----------|------------|
| `POST /api/v1/software/inventory/:id/notify-update` | `software:notify` |
| `POST /api/v1/software/inventory/:id/notify-uninstall` | `software:notify` |
| `POST /api/v1/software/inventory/:id/block` | `software:block` |
| `POST /api/v1/software/inventory/:id/unblock` | `software:unblock` |
| `POST /api/v1/software/inventory/:id/accept-risk` | `software:accept_risk` |
| `POST /api/v1/software/inventory/:id/refresh` | `software:manage` |
| `POST /api/v1/software/inventory/:id/create-incident` | `software:manage` or `alerts:write` |
| `GET /api/v1/software/remediation-actions` | `software:view` |

All responses use the standard envelope: `{ success, data, requestId }`.

## Accept risk

Requires `reason` in body. Optional `until` datetime sets `accepted_risk_until` on `endpoint_software_risk`.

## User notifications

Pending notifications are included in agent policy poll. User acknowledgment via `POST /api/v1/agent/software-notification-result`.

## Dashboard

Protection → Software Risk provides modals for notify update/uninstall, block (with reason + approver), and accept risk. Software detail drawer shows remediation timeline per inventory item.
