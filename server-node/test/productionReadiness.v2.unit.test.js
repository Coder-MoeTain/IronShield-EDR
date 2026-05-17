const test = require('node:test');
const assert = require('node:assert/strict');
const ProductionReadinessService = require('../src/services/ProductionReadinessService');

test('getScore returns v2 shape with categories and fix_next', async () => {
  const data = await ProductionReadinessService.getScore();
  assert.equal(data.version, 2);
  assert.ok(Array.isArray(data.categories));
  assert.ok(data.categories.length >= 5);
  assert.ok(Array.isArray(data.fix_next));
  assert.ok(typeof data.score === 'number');
  for (const cat of data.categories) {
    assert.ok(cat.label);
    assert.ok(Array.isArray(cat.checks));
  }
});

test.after(async () => {
  const db = require('../src/utils/db');
  await db.closePool().catch(() => {});
});
