/**
 * Per-endpoint telemetry quality score (0–100).
 */
const db = require('../utils/db');

const SIGNALS = [
  { key: 'process', weight: 12, query: `SELECT COUNT(*) as c FROM normalized_events WHERE endpoint_id = ? AND event_type LIKE '%process%' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)` },
  { key: 'network', weight: 12, query: `SELECT COUNT(*) as c FROM normalized_events WHERE endpoint_id = ? AND event_type LIKE '%network%' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)` },
  { key: 'file', weight: 10, query: `SELECT COUNT(*) as c FROM normalized_events WHERE endpoint_id = ? AND event_type LIKE '%file%' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)` },
  { key: 'registry', weight: 8, query: `SELECT COUNT(*) as c FROM normalized_events WHERE endpoint_id = ? AND event_type LIKE '%registry%' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)` },
  { key: 'powershell', weight: 10, query: `SELECT COUNT(*) as c FROM normalized_events WHERE endpoint_id = ? AND (process_name LIKE '%powershell%' OR command_line LIKE '%powershell%') AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)` },
  { key: 'winlogs', weight: 8, query: `SELECT COUNT(*) as c FROM raw_events WHERE endpoint_id = ? AND source LIKE '%winlog%' AND created_at >= DATE_SUB(NOW(), INTERVAL 24 HOUR)` },
];

async function scoreEndpoint(endpointId) {
  const ep = await db.queryOne('SELECT * FROM endpoints WHERE id = ?', [endpointId]);
  if (!ep) return null;

  const factors = [];
  let earned = 0;
  let total = 0;

  for (const s of SIGNALS) {
    total += s.weight;
    let ok = false;
    try {
      const row = await db.queryOne(s.query, [endpointId]);
      ok = Number(row?.c || 0) > 0;
    } catch {
      ok = false;
    }
    if (ok) earned += s.weight;
    factors.push({ signal: s.key, ok, weight: s.weight });
  }

  // Heartbeat freshness (15)
  total += 15;
  const hbOk =
    ep.last_heartbeat_at &&
    new Date(ep.last_heartbeat_at) >= new Date(Date.now() - 5 * 60 * 1000);
  if (hbOk) earned += 15;
  factors.push({ signal: 'heartbeat', ok: hbOk, weight: 15 });

  // Policy sync (10)
  total += 10;
  const policyOk = ep.policy_status === 'synced' || ep.policy_status === 'ok';
  if (policyOk) earned += 10;
  factors.push({ signal: 'policy_sync', ok: policyOk, weight: 10 });

  // Queue health (8)
  total += 8;
  const queueOk = (ep.queue_size == null || ep.queue_size < 500);
  if (queueOk) earned += 8;
  factors.push({ signal: 'queue', ok: queueOk, weight: 8 });

  // Clock drift placeholder (7) — assume ok if heartbeat recent
  total += 7;
  if (hbOk) earned += 7;
  factors.push({ signal: 'clock_drift', ok: hbOk, weight: 7 });

  const score = total > 0 ? Math.round((earned / total) * 100) : 0;
  return {
    endpoint_id: endpointId,
    hostname: ep.hostname,
    score,
    factors,
    status: score >= 80 ? 'good' : score >= 50 ? 'fair' : 'poor',
  };
}

async function listScores(tenantId = null, limit = 50) {
  let sql = 'SELECT id FROM endpoints';
  const params = [];
  if (tenantId != null) {
    sql += ' WHERE tenant_id = ?';
    params.push(tenantId);
  }
  sql += ' ORDER BY last_heartbeat_at DESC LIMIT ?';
  params.push(limit);
  const rows = await db.query(sql, params);
  const scores = [];
  for (const r of rows || []) {
    const s = await scoreEndpoint(r.id);
    if (s) scores.push(s);
  }
  return scores;
}

module.exports = { scoreEndpoint, listScores };
