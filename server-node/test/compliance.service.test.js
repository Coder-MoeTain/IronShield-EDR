const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/utils/db');
const ComplianceService = require('../src/services/ComplianceService');

test('compliance summary returns expected shape and metrics', async () => {
  const originalQueryOne = db.queryOne;
  let call = 0;
  db.queryOne = async () => {
    call++;
    if (call === 1) return { c: 11 };
    if (call === 2) return { c: 22 };
    if (call === 3) return { c: 7 };
    return { c: 33 };
  };
  try {
    const out = await ComplianceService.summary(null);
    assert.equal(out.scope, 'global');
    assert.equal(out.metrics.alerts_open, 11);
    assert.equal(out.metrics.endpoints_total, 22);
    assert.equal(out.metrics.admins_mfa_enabled, 7);
    assert.equal(out.metrics.audit_entries_hashed, 33);
    assert.equal(typeof out.generated_at, 'string');
  } finally {
    db.queryOne = originalQueryOne;
  }
});

