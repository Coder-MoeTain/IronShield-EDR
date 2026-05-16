const test = require('node:test');
const assert = require('node:assert/strict');

process.env.AGENT_NONCE_STORE = 'memory';
const AgentNonceService = require('../src/services/AgentNonceService');

test('replay is blocked for duplicate nonce (memory store)', async () => {
  const endpointId = 1;
  const nonce = 'ts:abc123nonce';
  const expiresAt = new Date(Date.now() + 300000);

  const first = await AgentNonceService.reserve(endpointId, nonce, expiresAt);
  assert.equal(first.ok, true);

  const second = await AgentNonceService.reserve(endpointId, nonce, expiresAt);
  assert.equal(second.ok, false);
  assert.equal(second.reason, 'replay');
});

test('different nonces are accepted', async () => {
  const endpointId = 2;
  const expiresAt = new Date(Date.now() + 300000);
  const a = await AgentNonceService.reserve(endpointId, 'n1', expiresAt);
  const b = await AgentNonceService.reserve(endpointId, 'n2', expiresAt);
  assert.equal(a.ok, true);
  assert.equal(b.ok, true);
});
