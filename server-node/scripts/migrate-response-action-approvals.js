/**
 * Migration: response action approvals (SOC two-person control)
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function addColumnIfMissing(col, ddl) {
  const rows = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'response_actions' AND COLUMN_NAME = ? LIMIT 1`,
    [col]
  );
  if (rows && rows.length > 0) return;
  await db.execute(ddl);
}

async function addIndexIfMissing(indexName, ddl) {
  const rows = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'response_actions' AND INDEX_NAME = ? LIMIT 1`,
    [indexName]
  );
  if (rows && rows.length > 0) return;
  await db.execute(ddl);
}

async function run() {
  await addColumnIfMissing(
    'approval_status',
    `ALTER TABLE response_actions
     ADD COLUMN approval_status ENUM('auto','pending','approved','rejected') NOT NULL DEFAULT 'auto' AFTER requested_by`
  );
  await addColumnIfMissing(
    'approved_by',
    `ALTER TABLE response_actions ADD COLUMN approved_by VARCHAR(128) NULL AFTER approval_status`
  );
  await addColumnIfMissing(
    'approved_at',
    `ALTER TABLE response_actions ADD COLUMN approved_at DATETIME NULL AFTER approved_by`
  );
  await addColumnIfMissing(
    'rejected_by',
    `ALTER TABLE response_actions ADD COLUMN rejected_by VARCHAR(128) NULL AFTER approved_at`
  );
  await addColumnIfMissing(
    'rejected_at',
    `ALTER TABLE response_actions ADD COLUMN rejected_at DATETIME NULL AFTER rejected_by`
  );
  await addColumnIfMissing(
    'rejection_reason',
    `ALTER TABLE response_actions ADD COLUMN rejection_reason VARCHAR(512) NULL AFTER rejected_at`
  );

  await addIndexIfMissing(
    'idx_response_approval',
    `CREATE INDEX idx_response_approval ON response_actions(approval_status, created_at)`
  );

  // eslint-disable-next-line no-console
  console.log('OK: response_actions approvals');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

