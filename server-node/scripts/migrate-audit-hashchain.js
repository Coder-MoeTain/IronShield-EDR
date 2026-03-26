/**
 * Migration: audit_logs hash chain fields
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function addColumnIfMissing(col, ddl) {
  const rows = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND COLUMN_NAME = ? LIMIT 1`,
    [col]
  );
  if (rows && rows.length > 0) return;
  await db.execute(ddl);
}

async function addIndexIfMissing(indexName, ddl) {
  const rows = await db.query(
    `SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'audit_logs' AND INDEX_NAME = ? LIMIT 1`,
    [indexName]
  );
  if (rows && rows.length > 0) return;
  await db.execute(ddl);
}

async function run() {
  await addColumnIfMissing(
    'prev_hash',
    `ALTER TABLE audit_logs ADD COLUMN prev_hash VARCHAR(64) NULL AFTER user_agent`
  );
  await addColumnIfMissing(
    'entry_hash',
    `ALTER TABLE audit_logs ADD COLUMN entry_hash VARCHAR(64) NULL AFTER prev_hash`
  );

  await addIndexIfMissing('idx_entry_hash', `CREATE INDEX idx_entry_hash ON audit_logs(entry_hash)`);

  // eslint-disable-next-line no-console
  console.log('OK: audit_logs hashchain columns');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

