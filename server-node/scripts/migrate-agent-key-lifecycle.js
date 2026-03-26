/**
 * Migration: agent key lifecycle fields on endpoints
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function addColumnIfMissing(col, ddl) {
  const rows = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'endpoints' AND COLUMN_NAME = ? LIMIT 1`,
    [col]
  );
  if (rows && rows.length > 0) return;
  await db.execute(ddl);
}

async function run() {
  await addColumnIfMissing(
    'agent_key_created_at',
    `ALTER TABLE endpoints ADD COLUMN agent_key_created_at DATETIME NULL AFTER agent_key`
  );
  await addColumnIfMissing(
    'agent_key_expires_at',
    `ALTER TABLE endpoints ADD COLUMN agent_key_expires_at DATETIME NULL AFTER agent_key_created_at`
  );
  await addColumnIfMissing(
    'agent_key_revoked_at',
    `ALTER TABLE endpoints ADD COLUMN agent_key_revoked_at DATETIME NULL AFTER agent_key_expires_at`
  );
  await addColumnIfMissing(
    'agent_key_rotated_at',
    `ALTER TABLE endpoints ADD COLUMN agent_key_rotated_at DATETIME NULL AFTER agent_key_revoked_at`
  );
  await addColumnIfMissing(
    'prev_agent_key_hash',
    `ALTER TABLE endpoints ADD COLUMN prev_agent_key_hash VARCHAR(64) NULL AFTER agent_key_rotated_at`
  );

  // Backfill created_at for existing endpoints if missing.
  await db.execute(
    `UPDATE endpoints
     SET agent_key_created_at = COALESCE(agent_key_created_at, created_at, NOW())
     WHERE agent_key_created_at IS NULL`
  );

  // eslint-disable-next-line no-console
  console.log('OK: endpoints agent key lifecycle');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

