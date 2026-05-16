const healthChecks = require('../utils/healthChecks');
const db = require('../utils/db');
const QueueService = require('../services/QueueService');
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

    res.json({
      api: 'ok',
      readiness,
      queue: {
        enabled: !!QueueService.isEnabled?.() || !!config.redis?.url,
        redis: config.redis?.url ? 'configured' : 'optional',
        kafka: config.kafka?.enabled ? 'enabled' : 'disabled',
      },
      endpoints,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { getHealth };
