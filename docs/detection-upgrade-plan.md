# Detection Upgrade Plan (Execution-Ready)

This plan prioritizes improvements that increase true-positive quality while reducing analyst noise. It is mapped directly to existing IronShield services and routes so implementation can start immediately.

## Objectives and Success Metrics

- Improve precision (fewer noisy alerts) without reducing recall on high-risk behavior.
- Increase detection context quality (MITRE, confidence, narrative, entity links).
- Reduce mean-time-to-triage by surfacing higher quality severity and risk signals.

Track these weekly:

- Precision by rule (`true_positive / total_fired`)
- False-positive rate by rule and by tenant
- High/critical closure SLA
- Median time-to-first-analyst-action
- Coverage by MITRE tactic/technique

## Phase 0: Baseline and Instrumentation (1-2 days)

### 0.1 Add detection quality telemetry

- Extend alert lifecycle telemetry in `server-node/src/services/AlertService.js`
  - capture closure reason (`true_positive`, `false_positive`, `benign_admin_activity`, `duplicate`, `test`)
  - capture analyst confidence and optional notes
- Persist quality counters in a new table (suggestion: `detection_quality_events`).

### 0.2 Build baseline analytics endpoint

- Extend `server-node/src/services/AnalyticsMlService.js`
  - per-rule fire count
  - per-rule FP/TP ratio
  - per-MITRE technique coverage
- Add endpoint under existing analytics pattern in `server-node/src/routes/adminRoutes.js`
  - e.g., `GET /api/admin/analytics/detection-quality`.

### 0.3 UI scorecard for rule quality

- Add a new panel on analytics pages:
  - `server-node/dashboard/src/pages/AnalyticsDetections.jsx`
  - `server-node/dashboard/src/pages/DetectionRules.jsx`
- Show top noisy rules and top high-signal rules.

## Phase 1: Quick Detection Quality Wins (this week)

### 1.1 Risk scoring v2 (signal fusion)

Current risk is severity*confidence heuristic. Upgrade to weighted fusion:

- `severity_weight`
- `rule_confidence`
- `entity_reputation` (hash/IP/domain)
- `prevalence_penalty` (common activity downweighted)
- `behavior_chain_bonus` (multi-step suspicious chain)

Implement in:

- `server-node/src/services/AnalyticsMlService.js` (analytics risk views)
- `server-node/src/services/DetectionEngineService.js` (score at generation time)
- `server-node/src/services/ThreatIntelMatchService.js` (intel weight input)

### 1.2 Dynamic thresholding by tenant/host profile

- Add per-tenant tuning policy in `server-node/src/modules/policies/policyService.js`
- Apply threshold during detection in:
  - `server-node/src/services/DetectionEngineService.js`
  - `server-node/src/xdr/xdrDetectionService.js`

### 1.3 Noise controls with automatic expiry

- Extend suppression logic in `server-node/src/services/DetectionSuppressionService.js`
  - scoped suppressions (tenant, endpoint, user, process path, rule)
  - mandatory expiry (`expires_at`)
  - reason + author audit

## Phase 2: Behavior Chains and Correlation (2-3 weeks)

### 2.1 Sequence detections

Add chain rules for high-value TTPs:

- Office -> script interpreter -> encoded command
- script interpreter -> credential access utility -> outbound connection
- unsigned binary in temp/user profile -> persistence artifact

Implement in:

- `server-node/src/services/CorrelationService.js`
- `server-node/src/services/DetectionRulesService.js` (rule schema support for sequence windows)
- `server-node/src/services/NormalizedEventService.js` (query windows and parent-child joins)

### 2.2 Time-window and entity-join correlation

- Add correlation windows (5m/15m/1h)
- Join by `endpoint_id`, `process_guid`, `parent_process_guid`, user SID/account
- Emit one aggregated incident-grade alert instead of many low-context alerts.

Implement in:

- `server-node/src/modules/incidents/incidentService.js`
- `server-node/src/services/CorrelationService.js`

### 2.3 Analyst-facing chain visibility

- Improve visualization in:
  - `server-node/dashboard/src/pages/ThreatGraph.jsx`
  - `server-node/dashboard/src/pages/IncidentDetail.jsx`
  - `server-node/dashboard/src/pages/AlertDetail.jsx`
- Show chain timeline, predecessors/successors, and confidence contributions.

## Phase 3: Baselines and Anomaly Layer (2-4 weeks)

### 3.1 Host behavioral baselines

Create daily profiles:

- frequent parent-child process pairs
- normal destination ports/domains
- normal interactive logon window

Implement in:

- `server-node/src/services/AnomalyService.js`
- `server-node/src/services/EventIngestionService.js` (feature extraction)

### 3.2 Outlier scoring

- score events against baseline (rare pair, rare commandline entropy, rare destination)
- use anomaly score as additive signal to risk score.

Implement in:

- `server-node/src/services/DetectionEngineService.js`
- `server-node/src/services/AnalyticsMlService.js`

## Phase 4: Detection Engineering Program (continuous)

### 4.1 MITRE coverage management

- Add matrix endpoints and scorecards:
  - tactic coverage %
  - technique coverage %
  - high-priority ATT&CK gaps
- Integrate with existing rule management:
  - `server-node/src/controllers/detectionRulesController.js`
  - `server-node/src/services/DetectionRuleService.js`

### 4.2 Detection testing harness

- Create replay tests for known benign and malicious telemetry patterns.
- Gate rule changes in CI with pass/fail expectations.

Suggested placement:

- `server-node/tests/detection/` (new)
- CI workflow under `.github/workflows/`

### 4.3 Auto-tuning loop

- nightly job to suggest:
  - lowering score threshold for under-detecting rules
  - raising threshold for high-noise rules
  - suppression recommendations with expiry

Implement with:

- `server-node/src/services/AnalyticsMlService.js`
- scheduled task in `server-node/src/index.js`

## Data Model Changes (Suggested)

Add migrations for:

- `detection_quality_events` (alert_id, rule_id, analyst_disposition, reason, created_at)
- `detection_baselines` (entity_key, feature_name, mean, stddev, sample_count, updated_at)
- `detection_score_breakdown` (alert_id, component, weight, value)
- suppression expiry and scope columns in suppression table(s)

Use existing migration pattern in `database/` and npm migrate scripts in `server-node/package.json`.

## Immediate Backlog (Top 10 Tasks)

1. Add analyst disposition fields on alert close/update.
2. Add detection quality analytics endpoint and dashboard widgets.
3. Implement risk score v2 with score breakdown output.
4. Add suppression expiry enforcement in query + write paths.
5. Add sequence-rule schema support (window + ordered predicates).
6. Implement first 3 behavior-chain detections.
7. Correlate related alerts into single incident-grade signal.
8. Add MITRE coverage card to Detection Analytics page.
9. Add detection replay tests for critical rules.
10. Add nightly tuning report (read-only recommendations).

## Rollout Strategy

- Week 1: Phase 0 + Phase 1.1/1.3 in shadow mode (compute scores, keep current severity finalization).
- Week 2: Enable risk score v2 for 20% tenants; compare precision/recall metrics.
- Week 3: Enable behavior-chain detections with alert deduplication.
- Week 4+: Start baseline anomalies and auto-tuning recommendations.

## Guardrails

- Never auto-close high/critical alerts.
- Require human approval for suppression creation on high/critical rules.
- Keep full score breakdown in alert metadata for explainability.
- Maintain tenant isolation for all quality and baseline computations.

