const test = require('node:test');
const assert = require('node:assert/strict');
const {
  resolveTenantScope,
  tenantWhereClause,
  assertTenantAccess,
  mergeTenantFilter,
} = require('../src/utils/tenantQuery');

test('super_admin without tenantId is unrestricted', () => {
  const scope = resolveTenantScope({ user: { role: 'super_admin' }, tenantId: null });
  assert.equal(scope.unrestricted, true);
  assert.equal(scope.tenantId, null);
});

test('super_admin with tenantId is scoped', () => {
  const scope = resolveTenantScope({ user: { role: 'super_admin' }, tenantId: 5 });
  assert.equal(scope.unrestricted, false);
  assert.equal(scope.tenantId, 5);
});

test('analyst without tenantId throws', () => {
  assert.throws(
    () => resolveTenantScope({ user: { role: 'analyst' }, tenantId: null }),
    (e) => e.code === 'TENANT_CONTEXT_REQUIRED'
  );
});

test('tenantWhereClause for scoped tenant', () => {
  const { sql, params } = tenantWhereClause({ unrestricted: false, tenantId: 3 });
  assert.match(sql, /tenant_id = \?/);
  assert.deepEqual(params, [3]);
});

test('assertTenantAccess denies cross-tenant', () => {
  assert.throws(
    () => assertTenantAccess({ unrestricted: false, tenantId: 1 }, 2),
    (e) => e.code === 'PERMISSION_DENIED'
  );
});

test('mergeTenantFilter adds tenantId for analyst', () => {
  const { filters, scope } = mergeTenantFilter({ status: 'open' }, {
    user: { role: 'analyst' },
    tenantId: 7,
  });
  assert.equal(filters.tenantId, 7);
  assert.equal(scope.unrestricted, false);
});
