const test = require('node:test');
const assert = require('node:assert/strict');

const { assertRedisReadyForQueue } = require('../src/utils/healthChecks');

test('assertRedisReadyForQueue passes when queue Redis is not configured', () => {
  assertRedisReadyForQueue({ configured: false, ok: true });
});

test('assertRedisReadyForQueue passes when Redis is configured and healthy', () => {
  assertRedisReadyForQueue({ configured: true, ok: true });
});

test('assertRedisReadyForQueue throws REDIS_DOWN when Redis is configured but ping failed', () => {
  assert.throws(
    () => assertRedisReadyForQueue({ configured: true, ok: false }),
    (err) => err.code === 'REDIS_DOWN' && /redis_ping_failed/.test(err.message)
  );
});
