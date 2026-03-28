/**
 * Liveness / readiness probes — DB required; Redis ping only when async ingest is enabled (QueueService).
 */
const Redis = require('ioredis');
const db = require('./db');
const config = require('../config');
const QueueService = require('../services/QueueService');

async function checkMysql() {
  await db.query('SELECT 1');
}

function redisOptionsFromEnv() {
  if (config.redis?.url) {
    return config.redis.url;
  }
  return {
    host: config.redis.host,
    port: config.redis.port,
    password: config.redis.password,
    connectTimeout: 2500,
    maxRetriesPerRequest: 1,
    lazyConnect: true,
  };
}

async function checkRedisIfConfigured() {
  if (!QueueService.isEnabled()) {
    return { configured: false, ok: true };
  }

  try {
    const opts = redisOptionsFromEnv();
    const client =
      typeof opts === 'string'
        ? new Redis(opts, { connectTimeout: 2500, maxRetriesPerRequest: 1 })
        : new Redis(opts);
    try {
      const pong = await client.ping();
      return { configured: true, ok: pong === 'PONG' };
    } finally {
      try {
        await client.quit();
      } catch (_) {
        try {
          client.disconnect();
        } catch (_) {
          /* ignore */
        }
      }
    }
  } catch {
    return { configured: true, ok: false };
  }
}

/**
 * Enforce /readyz semantics: Redis must answer PING when the async queue is enabled.
 * @param {{ configured: boolean, ok: boolean }} redis
 */
function assertRedisReadyForQueue(redis) {
  if (redis.configured && !redis.ok) {
    const err = new Error('redis_ping_failed');
    err.code = 'REDIS_DOWN';
    throw err;
  }
}

/**
 * @returns {{ mysql: true, redis: { configured: boolean, ok: boolean } }}
 */
async function readiness() {
  await checkMysql();
  const redis = await checkRedisIfConfigured();
  assertRedisReadyForQueue(redis);
  return { mysql: true, redis };
}

module.exports = {
  checkMysql,
  checkRedisIfConfigured,
  assertRedisReadyForQueue,
  readiness,
};
