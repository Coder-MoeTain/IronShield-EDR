# XDR detection pack (placeholder)

Cross-platform XDR correlation rules will live in this directory. The compact console **Hunting → XDR events** and **Detections → XDR** tabs consume normalized XDR events from the platform ingest pipeline.

## Current status

- Windows execution rules ship under `detections/windows/` (52 `IRN-WIN-*` rules).
- Replay fixtures for Windows rules are under `detections/tests/fixtures/`.
- This folder reserves namespace for future multi-source XDR rules (cloud, identity, network) without colliding with `IRN-WIN-*`.

## Adding XDR rules (future)

1. Add JSON rule files here following the same schema as `detections/windows/**/*.json`.
2. Run `npm run detections:validate` and `npm run detections:test`.
3. Register data sources in the detection engineering UI (**Data Sources** tab).
