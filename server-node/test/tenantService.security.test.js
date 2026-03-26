const test = require('node:test');
const assert = require('node:assert/strict');

const TenantService = require('../src/services/TenantService');

test('tenant override rejects non-super-admin users', async () => {
  await assert.rejects(
    () => TenantService.getEffectiveTenantId({ role: 'analyst', tenantId: 7, userId: 1 }, '2'),
    /only allowed for super_admin/i
  );
});

test('tenant override ignores invalid tenant id value', async () => {
  const tenantId = await TenantService.getEffectiveTenantId({ role: 'super_admin', userId: 1 }, 'not-a-number');
  assert.equal(tenantId, null);
});

