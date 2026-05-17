# Detection Testing

Fixtures live in `server-node/detections/tests/fixtures/{benign,malicious,suspicious,noisy}/`.

Each test case includes `events` and `expected_alerts` or `must_match` / `must_not_match` for legacy format.

Run: `npm run detections:test`
