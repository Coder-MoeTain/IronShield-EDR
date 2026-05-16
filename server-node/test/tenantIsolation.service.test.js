/**
 * Tenant isolation — service-layer SQL guards (mocked DB).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/utils/db');
const AlertService = require('../src/services/AlertService');
const EndpointService = require('../src/services/EndpointService');
const { assertTenantAccess } = require('../src/utils/tenantQuery');

test('AlertService.list adds tenant filter when tenantId set', async () => {
  const queries = [];
  const orig = db.query;
  db.query = async (sql, params) => {
    queries.push({ sql, params });
    return [];
  };
  try {
    await AlertService.list({ tenantId: 42, limit: 10 });
    const q = queries.find((x) => x.sql.includes('FROM alerts'));
    assert.ok(q, 'expected alerts query');
    assert.ok(q.sql.includes('e.tenant_id = ?'), 'expected tenant join filter');
    assert.ok(q.params.includes(42));
  } finally {
    db.query = orig;
  }
});

test('EndpointService.getById scopes by tenant', async () => {
  const queries = [];
  const orig = db.queryOne;
  db.queryOne = async (sql, params) => {
    queries.push({ sql, params });
    return null;
  };
  try {
    await EndpointService.getById(99, 7);
    assert.equal(queries.length, 1);
    assert.ok(queries[0].sql.includes('tenant_id = ?'));
    assert.deepEqual(queries[0].params, [99, 7]);
  } finally {
    db.queryOne = orig;
  }
});

test('assertTenantAccess blocks cross-tenant resource', () => {
  assert.throws(
    () => assertTenantAccess({ unrestricted: false, tenantId: 1 }, 2),
    (e) => e.code === 'PERMISSION_DENIED'
  );
});

test('assertTenantAccess allows same tenant', () => {
  assert.equal(assertTenantAccess({ unrestricted: false, tenantId: 5 }, 5), true);
});
