/**
 * Software block policy lifecycle and safety columns.
 */
const { withConnection } = require('../lib/migrationHelpers');

async function columnExists(conn, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [table, column]
  );
  return rows.length > 0;
}

async function up() {
  await withConnection(async (conn) => {
    if (!(await columnExists(conn, 'software_block_policies', 'lifecycle_status'))) {
      await conn.query(`
        ALTER TABLE software_block_policies
        ADD COLUMN lifecycle_status ENUM(
          'requested','pending_approval','approved','active','failed','expired','cancelled','rolled_back'
        ) NOT NULL DEFAULT 'active' AFTER requires_approval
      `);
    }
    if (!(await columnExists(conn, 'software_block_policies', 'block_reason'))) {
      await conn.query(`
        ALTER TABLE software_block_policies
        ADD COLUMN block_reason TEXT NULL AFTER lifecycle_status
      `);
    }
    if (!(await columnExists(conn, 'software_block_policies', 'requested_by'))) {
      await conn.query(`
        ALTER TABLE software_block_policies
        ADD COLUMN requested_by VARCHAR(128) NULL AFTER block_reason
      `);
    }
    if (!(await columnExists(conn, 'software_vulnerabilities', 'needs_review'))) {
      await conn.query(`
        ALTER TABLE software_vulnerabilities
        ADD COLUMN needs_review TINYINT(1) NOT NULL DEFAULT 0 AFTER source
      `);
    }
  });
}

async function down() {
  await withConnection(async (conn) => {
    for (const col of ['lifecycle_status', 'block_reason', 'requested_by']) {
      if (await columnExists(conn, 'software_block_policies', col)) {
        await conn.query(`ALTER TABLE software_block_policies DROP COLUMN ${col}`);
      }
    }
    if (await columnExists(conn, 'software_vulnerabilities', 'needs_review')) {
      await conn.query('ALTER TABLE software_vulnerabilities DROP COLUMN needs_review');
    }
  });
}

module.exports = { up, down };
