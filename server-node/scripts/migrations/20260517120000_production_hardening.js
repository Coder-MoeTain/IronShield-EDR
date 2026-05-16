/**
 * Production hardening: agent_key_hash, cert binding, alert explainability columns.
 */
const {
  withConnection,
  addColumnIfMissing,
  addIndexIfMissing,
} = require('../lib/migrationHelpers');
const crypto = require('crypto');

function hashWithPepper(raw, pepper) {
  return crypto.createHmac('sha256', pepper).update(String(raw), 'utf8').digest('hex');
}

async function up() {
  const pepper = process.env.AGENT_KEY_PEPPER || 'migration-pepper-change-in-production';

  await withConnection(async (conn, database) => {
    await addColumnIfMissing(
      conn,
      database,
      'endpoints',
      'agent_key_hash',
      'ALTER TABLE endpoints ADD COLUMN agent_key_hash VARCHAR(64) NULL'
    );
    await addIndexIfMissing(
      conn,
      database,
      'endpoints',
      'idx_endpoint_agent_key_hash',
      'CREATE UNIQUE INDEX idx_endpoint_agent_key_hash ON endpoints (agent_key_hash)'
    );

    const certCols = [
      ['cert_fingerprint', 'ALTER TABLE endpoints ADD COLUMN cert_fingerprint VARCHAR(128) NULL'],
      ['cert_subject', 'ALTER TABLE endpoints ADD COLUMN cert_subject VARCHAR(512) NULL'],
      ['cert_issued_at', 'ALTER TABLE endpoints ADD COLUMN cert_issued_at DATETIME NULL'],
      ['cert_expires_at', 'ALTER TABLE endpoints ADD COLUMN cert_expires_at DATETIME NULL'],
      ['cert_revoked_at', 'ALTER TABLE endpoints ADD COLUMN cert_revoked_at DATETIME NULL'],
    ];
    for (const [col, ddl] of certCols) {
      await addColumnIfMissing(conn, database, 'endpoints', col, ddl);
    }

    await addColumnIfMissing(
      conn,
      database,
      'alerts',
      'detection_score_breakdown',
      'ALTER TABLE alerts ADD COLUMN detection_score_breakdown JSON NULL'
    );

    const [rows] = await conn.query(
      'SELECT id, agent_key FROM endpoints WHERE agent_key IS NOT NULL AND agent_key != "" AND (agent_key_hash IS NULL OR agent_key_hash = "")'
    );
    for (const row of rows) {
      const h = hashWithPepper(row.agent_key, pepper);
      await conn.query('UPDATE endpoints SET agent_key_hash = ? WHERE id = ?', [h, row.id]);
    }

    try {
      await conn.query('ALTER TABLE endpoints MODIFY agent_key VARCHAR(64) NULL');
    } catch {
      /* optional */
    }
  });
}

async function down() {
  await withConnection(async (conn) => {
    const drops = [
      'ALTER TABLE alerts DROP COLUMN detection_score_breakdown',
      'ALTER TABLE endpoints DROP COLUMN cert_revoked_at',
      'ALTER TABLE endpoints DROP COLUMN cert_expires_at',
      'ALTER TABLE endpoints DROP COLUMN cert_issued_at',
      'ALTER TABLE endpoints DROP COLUMN cert_subject',
      'ALTER TABLE endpoints DROP COLUMN cert_fingerprint',
      'ALTER TABLE endpoints DROP COLUMN agent_key_hash',
    ];
    for (const sql of drops) {
      try {
        await conn.query(sql);
      } catch {
        /* column may not exist */
      }
    }
  });
}

module.exports = { up, down };
