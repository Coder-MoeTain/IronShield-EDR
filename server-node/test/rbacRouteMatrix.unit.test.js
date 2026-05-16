const test = require('node:test');
const assert = require('node:assert/strict');

const { ROLE_PERMISSION_DEFAULTS, hasAnyPermission } = require('../src/constants/permissions');

const MATRIX = [
  { role: 'read_only', perms: ['alerts:read'], need: ['alerts:read'], ok: true },
  { role: 'read_only', perms: ['alerts:read'], need: ['actions:write'], ok: false },
  { role: 'analyst', perms: ROLE_PERMISSION_DEFAULTS.analyst, need: ['alerts:write'], ok: true },
  { role: 'tenant_admin', perms: ROLE_PERMISSION_DEFAULTS.tenant_admin, need: ['tenants:read'], ok: true },
  { role: 'super_admin', perms: ['*'], need: ['audit:read'], ok: true },
];

for (const row of MATRIX) {
  test(`RBAC matrix ${row.role} ${row.need.join('+')} => ${row.ok}`, () => {
    assert.equal(hasAnyPermission(row.perms, row.need), row.ok);
  });
}
