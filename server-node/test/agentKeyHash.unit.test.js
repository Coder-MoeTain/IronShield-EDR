const test = require('node:test');
const assert = require('node:assert/strict');

process.env.AGENT_KEY_PEPPER = 'test-pepper-min-16-chars';
const { hashAgentKey, generateRawKey } = require('../src/utils/agentKeyHash');

test('hashAgentKey is deterministic', () => {
  const raw = 'abc123def456';
  assert.equal(hashAgentKey(raw), hashAgentKey(raw));
});

test('generateRawKey returns 64 hex chars', () => {
  const k = generateRawKey();
  assert.match(k, /^[a-f0-9]{64}$/);
});

test('different keys produce different hashes', () => {
  assert.notEqual(hashAgentKey('key-a'), hashAgentKey('key-b'));
});
