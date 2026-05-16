const test = require('node:test');
const assert = require('node:assert/strict');
const {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSION_DEFAULTS,
  hasPermission,
  hasAnyPermission,
} = require('../src/constants/permissions');

test('ROLE_PERMISSION_DEFAULTS includes super_admin wildcard', () => {
  assert.deepEqual(ROLE_PERMISSION_DEFAULTS[ROLES.SUPER_ADMIN], ['*']);
});

test('analyst role includes alert triage', () => {
  assert.ok(ROLE_PERMISSION_DEFAULTS[ROLES.ANALYST].includes(PERMISSIONS.ALERT_TRIAGE));
});

test('legacy DB permission view_endpoints grants endpoint:view', () => {
  assert.equal(hasPermission(['view_endpoints'], PERMISSIONS.ENDPOINT_VIEW), true);
});

test('legacy route permission actions:write grants response:request', () => {
  assert.equal(hasPermission(['actions:write'], PERMISSIONS.RESPONSE_REQUEST), true);
});

test('hasAnyPermission accepts wildcard', () => {
  assert.equal(hasAnyPermission(['*'], [PERMISSIONS.SYSTEM_ADMIN]), true);
});

test('unrelated permission is denied', () => {
  assert.equal(hasPermission(['alert:view'], PERMISSIONS.USER_MANAGE), false);
});
