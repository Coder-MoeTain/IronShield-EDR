/**
 * Detection rule test framework — fixtures and expected outcomes.
 */
const fs = require('fs');
const path = require('path');
const EventNormalizationService = require('../../services/EventNormalizationService');
const { loadRulesFromDisk, loadTestCases, DETECTIONS_ROOT } = require('./ruleLoader');
const detectionEngine = require('./detectionEngine');
const { buildExplanation } = require('./alertExplainabilityService');

function normalizeFixtureEvent(evt, endpointId = 1) {
  const payload = { ...evt, endpoint_id: evt.endpoint?.id || endpointId };
  return EventNormalizationService.normalize({
    endpoint_id: payload.endpoint_id,
    event_type: evt.event_type,
    timestamp: evt.event_time || evt.timestamp || new Date().toISOString(),
    raw_event_json: payload,
  });
}

function evaluateTestCase(testCase, rules) {
  const failures = [];
  const hits = [];
  for (const evt of testCase.events || []) {
    const norm = normalizeFixtureEvent(evt);
    const eventHits = detectionEngine.evaluate(norm, rules);
    hits.push(...eventHits);
  }

  const hitRuleIds = [...new Set(hits.map((h) => h.rule_id))];

  for (const exp of testCase.expected_alerts || []) {
    if (!hitRuleIds.includes(exp.rule_id)) {
      failures.push(`Expected alert for rule ${exp.rule_id} but none fired`);
      continue;
    }
    const match = hits.find((h) => h.rule_id === exp.rule_id);
    if (exp.severity && match.severity !== exp.severity) {
      failures.push(`Rule ${exp.rule_id}: expected severity ${exp.severity}, got ${match.severity}`);
    }
    const explanation = buildExplanation(match.rule, match.matched_conditions);
    if (exp.require_explanation && !explanation.matched_conditions?.length) {
      failures.push(`Rule ${exp.rule_id}: missing explanation matched_conditions`);
    }
    if (exp.risk_score_min != null && explanation.risk_score < exp.risk_score_min) {
      failures.push(`Rule ${exp.rule_id}: risk_score below min ${exp.risk_score_min}`);
    }
    if (exp.risk_score_max != null && explanation.risk_score > exp.risk_score_max) {
      failures.push(`Rule ${exp.rule_id}: risk_score above max ${exp.risk_score_max}`);
    }
    if (exp.mitre_technique) {
      const techs = explanation.mitre?.techniques || [];
      if (!techs.includes(exp.mitre_technique)) {
        failures.push(`Rule ${exp.rule_id}: expected MITRE ${exp.mitre_technique}`);
      }
    }
  }

  if (testCase.expected_no_alerts && hitRuleIds.length) {
    failures.push(`Expected no alerts but got: ${hitRuleIds.join(', ')}`);
  }

  for (const id of testCase.must_not_match || []) {
    if (hitRuleIds.includes(id)) failures.push(`Rule ${id} should not have matched`);
  }
  for (const id of testCase.must_match || []) {
    if (!hitRuleIds.includes(id)) failures.push(`Rule ${id} should have matched`);
  }

  return { ok: failures.length === 0, failures, hits };
}

function runAllTests(opts = {}) {
  const rules = loadRulesFromDisk(opts);
  const cases = loadTestCases();
  const legacyDir = path.join(DETECTIONS_ROOT, 'tests', 'fixtures');
  const legacyExpected = path.join(DETECTIONS_ROOT, 'tests', 'expected');

  let failed = 0;
  let passed = 0;
  const results = [];

  for (const tc of cases) {
    if (tc.events) {
      const r = evaluateTestCase(tc, rules);
      results.push({ id: tc.id || path.basename(tc._file), ...r });
      if (r.ok) passed += 1;
      else failed += 1;
      continue;
    }
  }

  if (fs.existsSync(legacyDir)) {
    for (const file of fs.readdirSync(legacyDir).filter((f) => f.endsWith('.json'))) {
      const full = path.join(legacyDir, file);
      const raw = JSON.parse(fs.readFileSync(full, 'utf8'));
      if (raw.events) continue;
      const norm = EventNormalizationService.normalize({
        endpoint_id: raw.endpoint_id || 1,
        event_type: raw.event_type,
        timestamp: raw.timestamp || new Date().toISOString(),
        raw_event_json: raw,
      });
      const hitIds = detectionEngine.evaluate(norm, rules).map((h) => h.rule_id);
      const expPath = path.join(legacyExpected, file);
      const expected = fs.existsSync(expPath)
        ? JSON.parse(fs.readFileSync(expPath, 'utf8'))
        : { must_match: [] };
      const caseFailures = [];
      for (const id of expected.must_match || []) {
        if (!hitIds.includes(id)) caseFailures.push(`expected ${id}`);
      }
      for (const id of expected.must_not_match || []) {
        if (hitIds.includes(id)) caseFailures.push(`did not expect ${id}`);
      }
      const ok = caseFailures.length === 0;
      results.push({ id: file, ok, failures: caseFailures });
      if (ok) passed += 1;
      else failed += 1;
    }
  }

  return { ok: failed === 0, passed, failed, total: passed + failed, results };
}

module.exports = { runAllTests, evaluateTestCase, normalizeFixtureEvent };
