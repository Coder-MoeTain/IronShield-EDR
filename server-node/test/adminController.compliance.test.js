const test = require('node:test');
const assert = require('node:assert/strict');

const adminController = require('../src/controllers/adminController');
const ComplianceService = require('../src/services/ComplianceService');

function mkRes() {
  return {
    code: 200,
    body: null,
    status(c) {
      this.code = c;
      return this;
    },
    json(v) {
      this.body = v;
      return this;
    },
  };
}

test('getComplianceSummary returns service payload', async () => {
  const original = ComplianceService.summary;
  ComplianceService.summary = async (tenantId) => ({ scope: tenantId != null ? 'tenant' : 'global', ok: true });
  try {
    const req = { tenantId: 9 };
    const res = mkRes();
    let calledErr = null;
    await adminController.getComplianceSummary(req, res, (e) => {
      calledErr = e;
    });
    assert.equal(calledErr, null);
    assert.equal(res.body.ok, true);
    assert.equal(res.body.scope, 'tenant');
  } finally {
    ComplianceService.summary = original;
  }
});

