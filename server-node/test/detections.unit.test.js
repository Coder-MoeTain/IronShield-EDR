const { describe, it } = require('node:test');
const assert = require('node:assert');
const detectionEngine = require('../src/modules/detections/detectionEngine');
const { validateRules } = require('../src/modules/detections/ruleValidator');
const { computeRiskScore, computeConfidence } = require('../src/modules/detections/riskScoringService');
const { runAllTests } = require('../src/modules/detections/ruleTester');
const { buildFingerprint } = require('../src/modules/detections/alertDeduplicationService');

describe('detectionEngine operators', () => {
  const norm = {
    event_type: 'process_start',
    process_name: 'powershell.exe',
    command_line: 'powershell -enc ABC',
    raw_event_json: {},
  };

  it('matches regex and contains', () => {
    const logic = {
      all: [
        { field: 'process_name', op: 'contains', value: 'powershell' },
        { field: 'command_line', op: 'contains', value: '-enc' },
      ],
    };
    assert.strictEqual(detectionEngine.evalLogic(logic, norm), true);
  });

  it('evaluates not logic', () => {
    const logic = { not: { field: 'process_name', op: 'contains', value: 'cmd' } };
    assert.strictEqual(detectionEngine.evalLogic(logic, norm), true);
  });
});

describe('riskScoringService', () => {
  it('clamps risk score 0-100', () => {
    const { risk_score } = computeRiskScore({ ioc_match: true, correlated_alert_chain: true }, { severity: 'critical', risk_score: 95 });
    assert.ok(risk_score >= 0 && risk_score <= 100);
  });

  it('computes confidence', () => {
    const { confidence } = computeConfidence(
      [{ matched: true, operator: 'regex', field: 'process.command_line' }],
      { confidence: 80, status: 'stable' }
    );
    assert.ok(confidence > 0 && confidence <= 1);
  });
});

describe('rule validation', () => {
  it('validates rule pack without fatal errors', () => {
    const result = validateRules();
    assert.ok(result.stats.total > 0);
  });
});

describe('detection tests', () => {
  it('runs fixture tests', () => {
    const result = runAllTests();
    assert.ok(result.total > 0, 'expected at least one test case');
  });
});

describe('alert fingerprint', () => {
  it('builds stable fingerprint hash', () => {
    const a = buildFingerprint({ rule_id: 'IRN-WIN-0001', endpoint_id: 1, title: 'Test' }, { process_name: 'powershell.exe' });
    const b = buildFingerprint({ rule_id: 'IRN-WIN-0001', endpoint_id: 1, title: 'Test' }, { process_name: 'powershell.exe' });
    assert.strictEqual(a, b);
  });
});
