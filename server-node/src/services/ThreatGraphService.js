/**
 * Lightweight "threat graph" — endpoints, alerts, and coarse links (self-hosted).
 */
const db = require('../utils/db');

async function buildGraph(tenantId, limitAlerts = 40) {
  const epSql =
    tenantId != null
      ? `SELECT id, hostname, status FROM endpoints WHERE tenant_id = ? ORDER BY last_heartbeat_at DESC LIMIT 80`
      : `SELECT id, hostname, status FROM endpoints ORDER BY last_heartbeat_at DESC LIMIT 80`;
  const epParams = tenantId != null ? [tenantId] : [];
  const endpoints = await db.query(epSql, epParams);

  const alertSql = `
    SELECT a.id, a.title, a.severity, a.endpoint_id, e.hostname
    FROM alerts a
    JOIN endpoints e ON e.id = a.endpoint_id
    WHERE 1=1 ${tenantId != null ? 'AND e.tenant_id = ?' : ''}
    ORDER BY a.last_seen DESC
    LIMIT ?
  `;
  const ap = tenantId != null ? [tenantId, limitAlerts] : [limitAlerts];
  const alerts = await db.query(alertSql, ap);

  const nodes = [];
  const nodeIds = new Set();

  for (const e of endpoints) {
    const nid = `host:${e.id}`;
    if (!nodeIds.has(nid)) {
      nodeIds.add(nid);
      nodes.push({
        id: nid,
        label: e.hostname || `Host ${e.id}`,
        type: 'host',
        meta: { endpoint_id: e.id, status: e.status },
      });
    }
  }

  const links = [];

  for (const a of alerts) {
    const hid = `host:${a.endpoint_id}`;
    if (!nodeIds.has(hid)) {
      nodeIds.add(hid);
      nodes.push({
        id: hid,
        label: a.hostname || `Host ${a.endpoint_id}`,
        type: 'host',
        meta: { endpoint_id: a.endpoint_id },
      });
    }
    const aid = `alert:${a.id}`;
    if (!nodeIds.has(aid)) {
      nodeIds.add(aid);
      nodes.push({
        id: aid,
        label: `#${a.id} ${(a.title || '').substring(0, 48)}`,
        type: 'alert',
        meta: { alert_id: a.id, severity: a.severity },
      });
    }
    links.push({
      source: hid,
      target: aid,
      label: 'detection',
    });
  }

  return { nodes, links };
}

module.exports = { buildGraph };
