const healthChecks = require('../utils/healthChecks');
const db = require('../utils/db');
const QueueService = require('../services/QueueService');
const redisClient = require('../utils/redisClient');
const config = require('../config');

async function getHealth(req, res, next) {
  try {
    let readiness = { status: 'unknown' };
    try {
      readiness = await healthChecks.readiness();
    } catch (e) {
      readiness = { status: 'not_ready', error: e.message };
    }

    const [endpoints] = await Promise.all([
      db.queryOne(
        `SELECT
          COUNT(*) AS total,
          SUM(CASE WHEN last_heartbeat_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE) THEN 1 ELSE 0 END) AS online
         FROM endpoints
         ${req.tenantId != null ? 'WHERE tenant_id = ?' : ''}`,
        req.tenantId != null ? [req.tenantId] : []
      ).catch(() => ({ total: 0, online: 0 })),
    ]);

    const redis = await redisClient.ping();
    let queueDepth = null;
    if (redis.ok) {
      try {
        const r = redisClient.getRedis();
        if (r) queueDepth = await r.llen('bull:edr-event-processing:wait').catch(() => null);
      } catch {
        queueDepth = null;
      }
    }

    res.json({
      api: 'ok',
      readiness,
      database: readiness?.checks?.mysql || readiness,
      redis,
      queue: {
        enabled: !!QueueService.isEnabled?.() || !!config.redis?.url,
        redis: config.redis?.url ? 'configured' : 'optional',
        kafka: config.kafka?.enabled ? 'enabled' : 'disabled',
        depth: queueDepth,
      },
      endpoints,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHealth };
