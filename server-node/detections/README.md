# IronShield Detection-as-Code

Defensive Windows detection rules (`IRN-WIN-*`) for telemetry analysis.

## Layout

```
detections/
  windows/
    execution/
    persistence/
    defense_evasion/
    ...
  tests/
    fixtures/
    expected/
```

## Commands

```bash
cd server-node
npm run detections:validate
npm run detections:test
npm run detections:replay
```

Rules with `status: deprecated` are skipped. Set `DETECTIONS_INCLUDE_EXPERIMENTAL=true` to include experimental rules at runtime.
