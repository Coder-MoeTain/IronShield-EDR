/**
 * Internal MSSP operations — tenant-scoped health and queue visibility for SOC analysts.
 */
const db = require('../utils/db');

/**
 * @param {number|null} tenantId - null = all tenants (global MSSP view)
 */
async function getOverview(tenantId = null) {
  const tenantFilter = tenantId != null ? 'AND e.tenant_id = ?' : '';
  const tenantParams = tenantId != null ? [tenantId] : [];

  const [tenantRows, triageRow, invGlobalRow] = await Promise.all([
    tenantId != null
      ? db.query(
          `SELECT
            t.id,
            t.name,
            t.slug,
            t.is_active,
            (SELECT COUNT(*) FROM endpoints e WHERE e.tenant_id = t.id) AS endpoint_count,
            (SELECT COALESCE(SUM(CASE WHEN e.last_heartbeat_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
              AND e.status NOT IN ('offline', 'isolated') THEN 1 ELSE 0 END), 0)
             FROM endpoints e WHERE e.tenant_id = t.id) AS online_count,
            (SELECT COUNT(*) FROM alerts a
              INNER JOIN endpoints e2 ON e2.id = a.endpoint_id
              WHERE e2.tenant_id = t.id
              AND a.status IN ('new', 'open', 'investigating')) AS open_alerts,
            (SELECT COUNT(*) FROM investigation_cases c
              INNER JOIN endpoints e3 ON e3.id = c.endpoint_id
              WHERE e3.tenant_id = t.id
              AND c.status IN ('open', 'investigating')) AS open_investigations
           FROM tenants t
           WHERE t.id = ?`,
          [tenantId]
        )
      : db.query(
          `SELECT
            t.id,
            t.name,
            t.slug,
            t.is_active,
            (SELECT COUNT(*) FROM endpoints e WHERE e.tenant_id = t.id) AS endpoint_count,
            (SELECT COALESCE(SUM(CASE WHEN e.last_heartbeat_at >= DATE_SUB(NOW(), INTERVAL 5 MINUTE)
              AND e.status NOT IN ('offline', 'isolated') THEN 1 ELSE 0 END), 0)
             FROM endpoints e WHERE e.tenant_id = t.id) AS online_count,
            (SELECT COUNT(*) FROM alerts a
              INNER JOIN endpoints e2 ON e2.id = a.endpoint_id
              WHERE e2.tenant_id = t.id
              AND a.status IN ('new', 'open', 'investigating')) AS open_alerts,
            (SELECT COUNT(*) FROM investigation_cases c
              INNER JOIN endpoints e3 ON e3.id = c.endpoint_id
              WHERE e3.tenant_id = t.id
              AND c.status IN ('open', 'investigating')) AS open_investigations
           FROM tenants t
           WHERE t.is_active = 1
           ORDER BY t.name ASC`
        ),
    db.queryOne(
      `SELECT COUNT(*) AS count FROM triage_requests tr
       INNER JOIN endpoints e ON e.id = tr.endpoint_id
       WHERE tr.status IN ('pending', 'in_progress') ${tenantFilter}`,
      tenantParams
    ).catch(() => ({ count: 0 })),
    db.queryOne(
      `SELECT COUNT(*) AS count FROM investigation_cases
       WHERE status IN ('open', 'investigating')`
    ).catch(() => ({ count: 0 })),
  ]);

  const tenants = Array.isArray(tenantRows) ? tenantRows : [];
  const scope = tenantId != null ? 'tenant' : 'global';

  return {
    scope,
    tenants,
    triage_pending: Number(triageRow?.count ?? 0),
    investigations_open_global: Number(invGlobalRow?.count ?? 0),
  };
}

module.exports = { getOverview };
