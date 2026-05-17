# Detection Rule Schema

Professional rules require all fields defined in `server-node/detections/schemas/rule.schema.json`.

Legacy rules (`IRN-WIN-####` without category code) remain supported with reduced validation until migrated.

Key fields: `logic` (all/any/not + operators), `explain`, `mitre`, `tests`, `false_positives`, `response_guidance`, `risk_score`, `confidence`.

Severity risk ranges: informational 0–20, low 21–40, medium 41–60, high 61–80, critical 81–100.
