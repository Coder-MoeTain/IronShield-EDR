/**
 * Professional suppression lifecycle — wraps detection_suppressions with audit expectations.
 */
const DetectionSuppressionService = require('../../services/DetectionSuppressionService');
const db = require('../../utils/db');

async function ensureExtendedColumns() {
  try {
    await db.execute(`
      ALTER TABLE detection_suppressions
        ADD COLUMN IF NOT EXISTS scope_type VARCHAR(32) NULL,
        ADD COLUMN IF NOT EXISTS scope_value VARCHAR(512) NULL,
        ADD COLUMN IF NOT EXISTS approved_by VARCHAR(128) NULL,
        ADD COLUMN IF NOT EXISTS matched_alert_count INT UNSIGNED NOT NULL DEFAULT 0
    `);
  } catch {
    /* columns may exist or MySQL version lacks IF NOT EXISTS on ADD */
  }
}

async function list(tenantId = null) {
  await ensureExtendedColumns();
  const rows = await DetectionSuppressionService.list(tenantId);
  const now = Date.now();
  return rows.map((r) => ({
    ...r,
    expired: r.expires_at && new Date(r.expires_at).getTime() < now,
    pending_approval: r.enabled && !r.approved_by && r.severity_impact === 'high',
  }));
}

async function disableExpired() {
  await db.execute(
    `UPDATE detection_suppressions SET enabled = 0, updated_at = NOW()
     WHERE expires_at IS NOT NULL AND expires_at < NOW() AND enabled = 1`
  ).catch(() => {});
}

module.exports = { list, disableExpired, ...DetectionSuppressionService };
