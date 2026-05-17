/**
 * Console BFF contract tests — envelope shape and module payloads.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../src/app');
const ConsoleBffService = require('../src/services/ConsoleBffService');

const BFF_PATHS = [
  '/api/v1/console/overview',
  '/api/v1/console/endpoints',
  '/api/v1/console/detections',
  '/api/v1/console/investigation',
  '/api/v1/console/response',
  '/api/v1/console/hunting',
  '/api/v1/console/protection',
  '/api/v1/console/admin',
];

function assertBffShape(data, { requireRecent = false } = {}) {
  assert.ok(data.meta, 'meta required');
  assert.ok(Array.isArray(data.tabs), 'tabs required');
  assert.ok(data.kpis, 'kpis required');
  assert.ok(data.health, 'health required');
  assert.ok(data.permissions, 'permissions required');
  if (requireRecent) assert.ok(data.recent !== undefined, 'recent expected');
}

for (const path of BFF_PATHS) {
  test(`GET ${path} without JWT returns 401`, async () => {
    const res = await request(app).get(path);
    assert.equal(res.status, 401);
    assert.equal(res.body.success, false);
  });
}

test('ConsoleBffService overview payload shape', async () => {
  const data = await ConsoleBffService.getOverview(null);
  assertBffShape(data, { requireRecent: true });
  assert.equal(data.meta.module, 'overview');
});

test('ConsoleBffService endpoints payload shape', async () => {
  const data = await ConsoleBffService.getEndpoints(null);
  assertBffShape(data, { requireRecent: true });
});

test('ConsoleBffService detections payload shape', async () => {
  const data = await ConsoleBffService.getDetections(null);
  assertBffShape(data, { requireRecent: true });
});

test('ConsoleBffService investigation payload shape', async () => {
  const data = await ConsoleBffService.getInvestigation(null);
  assertBffShape(data);
});

test('ConsoleBffService response payload shape', async () => {
  const data = await ConsoleBffService.getResponse(null);
  assertBffShape(data);
});

test('ConsoleBffService hunting payload shape', async () => {
  const data = await ConsoleBffService.getHunting(null);
  assertBffShape(data);
});

test('ConsoleBffService protection payload shape', async () => {
  const data = await ConsoleBffService.getProtection(null);
  assertBffShape(data);
});

test('ConsoleBffService admin payload shape', async () => {
  const data = await ConsoleBffService.getAdmin(null);
  assertBffShape(data);
  assert.ok(data.production_readiness, 'production_readiness on admin BFF');
});

test.after(async () => {
  const db = require('../src/utils/db');
  await db.closePool().catch(() => {});
});
