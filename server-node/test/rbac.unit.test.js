/**
 * RBAC: permission resolution for legacy roles when DB role tables are empty.
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/utils/db');
const rbacPath = require.resolve('../src/middleware/rbac');

test('getUserPermissions(super_admin) returns wildcard', async () => {
  delete require.cache[rbacPath];
  const { getUserPermissions } = require('../src/middleware/rbac');
  const perms = await getUserPermissions(1, 'super_admin', null);
  assert.ok(perms.includes('*'));
});

test('getUserPermissions(viewer) legacy has no write perms', async () => {
  const orig = db.query;
  db.query = async () => [];
  delete require.cache[rbacPath];
  const { getUserPermissions } = require('../src/middleware/rbac');
  try {
    const perms = await getUserPermissions(99, 'viewer', null);
    assert.ok(!perms.includes('actions:write'));
    assert.ok(!perms.includes('*'));
  } finally {
    db.query = orig;
    delete require.cache[rbacPath];
  }
});

test('getUserPermissions(analyst) legacy includes actions:write', async () => {
  const orig = db.query;
  db.query = async () => [];
  delete require.cache[rbacPath];
  const { getUserPermissions } = require('../src/middleware/rbac');
  try {
    const perms = await getUserPermissions(2, 'analyst', null);
    assert.ok(perms.includes('actions:write'));
  } finally {
    db.query = orig;
    delete require.cache[rbacPath];
  }
});

test('requirePermission denies when user missing', async () => {
  delete require.cache[rbacPath];
  const { requirePermission } = require('../src/middleware/rbac');
  const mw = requirePermission('actions:write');
  const req = {};
  const res = {
    statusCode: 0,
    status(c) {
      this.statusCode = c;
      return this;
    },
    json(o) {
      this.body = o;
      return this;
    },
  };
  let nextCalled = false;
  await mw(req, res, () => {
    nextCalled = true;
  });
  assert.equal(nextCalled, false);
  assert.equal(res.statusCode, 401);
});
