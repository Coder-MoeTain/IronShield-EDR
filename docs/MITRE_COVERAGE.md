# IronShield EDR — MITRE ATT&CK Coverage

## Rule pack

**52** stable Windows rules (`IRN-WIN-*`) under `server-node/detections/windows/`, organized by tactic.

## APIs and UI

| Surface | Location |
|---------|----------|
| API | `GET /api/v1/detections/mitre-coverage` |
| Console | Detections → MITRE Coverage tab |
| CLI | `npm run detections:coverage` |

## Coverage report

The coverage tool maps rules to MITRE tactics/techniques and highlights gaps. New rules must include `mitre` mapping in `rule.schema.json` before publish.

## Related docs

- [DETECTION_ENGINEERING.md](DETECTION_ENGINEERING.md)
- [DETECTION_RULE_SCHEMA.md](DETECTION_RULE_SCHEMA.md)
