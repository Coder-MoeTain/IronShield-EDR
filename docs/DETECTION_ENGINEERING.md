# Detection Engineering

IronShield detection-as-code lives under `server-node/detections/`. The current Windows pack contains **52** IRN-WIN rules (`server-node/detections/windows/**/IRN-WIN-*.json`). Phase 5 initially shipped **31** rules; the pack grew with subsequent releases. Rules are versioned JSON with MITRE mapping, tests, and explainability metadata.

## Lifecycle

1. Author rule (experimental, disabled)
2. Add benign/malicious fixtures under `tests/fixtures/`
3. `npm run detections:validate` and `npm run detections:test`
4. Submit for review → approve → publish as stable

## Commands

| Command | Purpose |
|---------|---------|
| `npm run detections:validate` | Schema and CI gate validation |
| `npm run detections:lint` | Quality linter (warnings) |
| `npm run detections:test` | Fixture-based rule tests |
| `npm run detections:replay` | Historical event replay |
| `npm run detections:coverage` | MITRE and data source reports |
| `npm run detections:docs` | Generate coverage markdown |
| `npm run detections:index` | Generate RULE_INDEX.md |
| `npm run test:detections` | Unit tests |

## APIs

Tenant-scoped routes under `/api/v1/detections/*` (RBAC: `detection:view`, `detection:manage`, etc.).

See also: [DETECTION_RULE_SCHEMA.md](./DETECTION_RULE_SCHEMA.md), [DETECTION_TESTING.md](./DETECTION_TESTING.md).
