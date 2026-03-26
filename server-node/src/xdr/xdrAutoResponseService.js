const db = require('../utils/db');
const ResponseActionService = require('../services/ResponseActionService');
const logger = require('../utils/logger');

/**
 * Phase 7 baseline auto-response:
 * - if a detection is critical/high and risk_score >= threshold, queue isolate_host and/or block_ip.
 * - This is opt-in via env flags to avoid surprising behavior.
 */
const DEFAULT_THRESHOLD = 85;

async function getRecentHighRisk(limit = 50) {
  return db.query(
    `SELECT d.*, xe.destination_ip, xe.endpoint_id AS ep_id
     FROM xdr_detections d
     JOIN xdr_events xe ON xe.id = d.xdr_event_id
     WHERE d.risk_score >= ?
     ORDER BY d.id DESC
     LIMIT ?`,
    [parseInt(process.env.XDR_AUTORESP_THRESHOLD || String(DEFAULT_THRESHOLD), 10), limit]
  );
}

async function alreadyResponded(xdrDetectionId) {
  try {
    const r = await db.queryOne('SELECT id FROM xdr_autoresponse WHERE detection_id = ?', [xdrDetectionId]);
    return !!r;
  } catch {
    return false;
  }
}

async function markResponded(xdrDetectionId, actionIds) {
  try {
    await db.execute(
      'INSERT INTO xdr_autoresponse (detection_id, action_ids) VALUES (?, ?)',
      [xdrDetectionId, JSON.stringify(actionIds || [])]
    );
  } catch (_) {}
}

async function runOnce() {
  if (process.env.XDR_AUTORESPONSE_ENABLED !== 'true') return { ok: false, reason: 'disabled' };
  const rows = await getRecentHighRisk(80);
  let queued = 0;
  for (const d of rows) {
    if (!d.ep_id) continue;
    if (await alreadyResponded(d.id)) continue;
    const actionIds = [];
    try {
      if (process.env.XDR_AUTORESP_ISOLATE === 'true') {
        const id = await ResponseActionService.create(d.ep_id, 'isolate_host', null, 'xdr-autoresponse', d.tenant_id);
        actionIds.push(id);
      }
      if (process.env.XDR_AUTORESP_BLOCK_IP === 'true' && d.destination_ip) {
        const id = await ResponseActionService.create(
          d.ep_id,
          'block_ip',
          { ip: d.destination_ip },
          'xdr-autoresponse',
          d.tenant_id
        );
        actionIds.push(id);
      }
      await markResponded(d.id, actionIds);
      queued += actionIds.length;
    } catch (e) {
      logger.warn({ err: e.message, detectionId: d.id }, 'Auto-response failed');
    }
  }
  return { ok: true, queued };
}

module.exports = { runOnce };

