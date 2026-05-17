/**
 * Software inventory tenant isolation (mocked DB).
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const db = require('../src/utils/db');
const SoftwareInventoryService = require('../src/modules/software/softwareInventoryService');

test('SoftwareInventoryService.list scopes by tenant_id', async () => {
  const queries = [];
  const orig = db.query;
  db.query = async (sql, params) => {
    queries.push({ sql, params });
    return [];
  };
  try {
    await SoftwareInventoryService.listInventory({ tenantId: 99, limit: 10 });
    const q = queries.find((x) => x.sql.includes('endpoint_software_inventory'));
    assert.ok(q, 'expected inventory query');
    assert.ok(q.sql.includes('tenant_id = ?'), 'expected tenant filter');
    assert.ok(q.params.includes(99));
  } finally {
    db.query = orig;
  }
});

test('SoftwareInventoryService.getById scopes by tenant', async () => {
  const queries = [];
  const origQuery = db.query;
  db.query = async (sql, params) => {
    queries.push({ sql, params });
    return [];
  };
  try {
    const row = await SoftwareInventoryService.getById(5, 7);
    assert.equal(row, null);
    assert.ok(queries.length >= 1);
    assert.ok(queries[0].sql.includes('tenant_id = ?'));
    assert.deepEqual(queries[0].params, [5, 7]);
  } finally {
    db.query = origQuery;
  }
});
