/**
 * Shared Redis client for nonce replay protection and queue metrics.
 */
const Redis = require('ioredis');
const config = require('../config');
const logger = require('../utils/logger');

let client = null;

function isConfigured() {
  return !!(config.redis?.url || process.env.REDIS_URL || process.env.REDIS_HOST);
}

function getRedis() {
  if (!isConfigured()) return null;
  if (client) return client;
  try {
    if (config.redis?.url) {
      client = new Redis(config.redis.url, { maxRetriesPerRequest: 2, lazyConnect: true });
    } else {
      client = new Redis({
        host: config.redis.host || 'localhost',
        port: config.redis.port || 6379,
        password: config.redis.password || undefined,
        maxRetriesPerRequest: 2,
        lazyConnect: true,
      });
    }
    client.on('error', (err) => logger.debug({ err: err.message }, 'Redis client error'));
    return client;
  } catch (err) {
    logger.warn({ err: err.message }, 'Redis client init failed');
    return null;
  }
}

async function ping() {
  const r = getRedis();
  if (!r) return { ok: false, reason: 'not_configured' };
  try {
    if (r.status !== 'ready') await r.connect();
    const pong = await r.ping();
    return { ok: pong === 'PONG' };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

module.exports = { getRedis, isConfigured, ping };
