# CrowdStrike Falcon–class — Detection rules (Custom IOA)

IronShield exposes **Custom IOA rules** (Falcon-style naming): a table of rules with **On/Off**, **Rule ID** (`name`), **severity**, **MITRE**, **last updated**, plus **View / Edit**, **New rule**, filters, and a **summary strip** (totals by severity / enabled count).

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/admin/detection-rules` | Query: `q`, `severity`, `enabled` — returns `{ rules, summary }` |
| GET | `/api/admin/detection-rules/:id` | Single rule (conditions parsed as JSON object) |
| POST | `/api/admin/detection-rules` | Create (`rules:write`) — body: `name`, `title`, `conditions`, optional `description`, `severity`, `mitre_*`, `enabled` |
| PATCH | `/api/admin/detection-rules/:id` | Update any field (`rules:write`) |

## Conditions

Validated keys match `DetectionEngineService` (AND logic). See `server-node/src/services/DetectionRuleService.js` (`ALLOWED_CONDITION_KEYS`).

## UI

- **Detection → Detection rules** — list + suppressions tab (unchanged).
- **`/detection-rules/new`** — create form with JSON editor + template.
- **`/detection-rules/:id`** — read-only detail + conditions block.
- **`/detection-rules/:id/edit`** — edit (cannot rename `name` after create).

## Notes

CrowdStrike® / Falcon™ are trademarks of CrowdStrike, Inc. This project is independent.
