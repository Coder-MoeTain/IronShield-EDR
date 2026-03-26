const test = require('node:test');
const assert = require('node:assert/strict');

const { requireTenantContext } = require('../src/middleware/requireTenantContext');

function mkRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(obj) {
      this.body = obj;
      return this;
    },
  };
}

test('requireTenantContext allows super_admin without tenantId', async () => {
  const req = { user: { role: 'super_admin' }, tenantId: null };
  const res = mkRes();
  let called = false;
  requireTenantContext(req, res, () => {
    called = true;
  });
  assert.equal(called, true);
});

test('requireTenantContext blocks non-super_admin when tenantId missing', async () => {
  const req = { user: { role: 'analyst' }, tenantId: null };
  const res = mkRes();
  let called = false;
  requireTenantContext(req, res, () => {
    called = true;
  });
  assert.equal(called, false);
  assert.equal(res.statusCode, 403);
});

