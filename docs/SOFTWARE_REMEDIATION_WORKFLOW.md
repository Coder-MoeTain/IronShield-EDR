# Software Remediation Workflow

## Status lifecycle

`open` → `notified` → `acknowledged` → `blocked` / `updated` / `uninstalled` / `accepted_risk` → `closed`

Mapped to `software_remediation_actions.status`: `requested`, `pending_agent`, `delivered`, `acknowledged`, `completed`, `failed`, `cancelled`, `expired`.

## Actions

| API | Purpose |
|-----|---------|
| `POST .../notify-update` | User notification to update |
| `POST .../notify-uninstall` | User notification to uninstall |
| `POST .../block` | Create block policy + mark blocked |
| `POST .../unblock` | Remove block flag |
| `POST .../accept-risk` | Accept risk with optional expiry |
| `POST .../refresh` | Request inventory rescan |

## Verification

After user acknowledges “I updated”, agent rescans on next inventory cycle; backend compares version against vulnerability `fixed_version` and updates risk automatically.

User responses: `POST /api/v1/agent/software-notification-result`.
