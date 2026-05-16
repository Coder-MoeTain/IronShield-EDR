# Detection engine

IronShield evaluates telemetry through two complementary paths:

1. **Database rules** — `detection_rules` table (Custom IOA UI).
2. **Detection-as-code** — JSON rules under `server-node/detections/windows/`.

## Detection-as-code layout

```
server-node/detections/
  windows/
    execution/
    persistence/
    ...
  tests/
    fixtures/
    expected/
```

## Rule schema

Each rule includes: `id`, `name`, `description`, `status`, `severity`, `risk_score`, `confidence`, `platform`, `event_types`, `mitre`, `logic`, `author`, `version`.

Logic supports `all` / `any` nesting and field operators: `eq`, `contains`, `starts_with`, `ends_with`, `regex`, `in`.

## Commands

```bash
cd server-node
npm run detections:validate
npm run detections:test
npm run detections:replay
```

## Alert explainability

When a code rule matches, the engine records `matched_fields` (field, operator, actual value, condition path) in `detection_score_breakdown` on the alert. The SOC console **Alert detail** page shows **Why this alert fired**.

## MITRE coverage

`GET /api/v1/admin/mitre/coverage` aggregates techniques from DB rules and the on-disk pack.
