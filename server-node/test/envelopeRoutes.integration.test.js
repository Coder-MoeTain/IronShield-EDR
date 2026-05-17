const test = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { app } = require('../src/app');

test('GET /api/agent/ping returns standard envelope', async () => {
  const res = await request(app).get('/api/agent/ping').expect(200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data);
  assert.ok(res.body.requestId);
  assert.equal(res.body.data.ok, true);
});

test('GET /api/v1/agent/ping mirrors envelope', async () => {
  const res = await request(app).get('/api/v1/agent/ping').expect(200);
  assert.equal(res.body.success, true);
  assert.ok(res.body.data?.ok);
});

test('POST /api/v1/ingest/web without key returns enveloped error', async () => {
  const res = await request(app).post('/api/v1/ingest/web').send({}).expect(401);
  assert.equal(res.body.success, false);
  assert.ok(res.body.error?.code || res.body.error?.message);
});
