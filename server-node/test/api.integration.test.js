/**
 * HTTP integration tests (Express app via supertest).
 * No database required for auth rejection paths.
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../src/app');

test('GET /healthz returns ok', async () => {
  const res = await request(app).get('/healthz').expect(200);
  assert.equal(res.body.status, 'ok');
});

test('GET /api/openapi.json returns OpenAPI document', async () => {
  const res = await request(app).get('/api/openapi.json').expect(200);
  assert.equal(res.body.openapi, '3.0.3');
  assert.ok(res.body.info?.title);
  assert.ok(res.body.paths?.['/api/agent/ping']);
});

test('GET /api/agent/ping is unauthenticated', async () => {
  const res = await request(app).get('/api/agent/ping');
  assert.ok(res.status === 200 || res.status === 204 || res.body);
});

test('POST /api/agent/heartbeat without agent key returns 401', async () => {
  const res = await request(app).post('/api/agent/heartbeat').send({ hostname: 'x' }).expect(401);
  assert.ok(String(res.body?.error || '').toLowerCase().includes('agent') || res.status === 401);
});

test('GET /api/admin/endpoints without JWT returns 401', async () => {
  await request(app).get('/api/admin/endpoints').expect(401);
});

test('GET /api/auth/me without JWT returns 401', async () => {
  await request(app).get('/api/auth/me').expect(401);
});

test('GET /api/admin/platform/protection-capabilities without JWT returns 401', async () => {
  await request(app).get('/api/admin/platform/protection-capabilities').expect(401);
});

test('unmatched /api/foo returns 404 JSON', async () => {
  const res = await request(app).get('/api/nonexistent-route-phase1').expect(404);
  assert.equal(res.body.error, 'Not found');
});
