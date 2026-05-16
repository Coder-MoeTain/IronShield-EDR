const test = require('node:test');
const assert = require('node:assert/strict');

const { computeCompliance } = require('../src/services/EndpointComplianceService');

test('compliant endpoint scores high', () => {
  const r = computeCompliance({
    status: 'online',
    last_heartbeat_at: new Date().toISOString(),
    agent_version: '1.0.0',
    agent_key_revoked_at: null,
    av_ngav_realtime_enabled: 1,
    edr_policy_id: 1,
    tamper_status: 'ok',
    policy_compliance_status: 'matched',
    cert_fingerprint: 'abc',
  });
  assert.ok(r.score >= 50);
  assert.ok(['compliant', 'partial', 'non_compliant', 'unknown'].includes(r.status));
});

test('missing endpoint returns unknown', () => {
  const r = computeCompliance(null);
  assert.equal(r.status, 'unknown');
  assert.equal(r.score, 0);
});
