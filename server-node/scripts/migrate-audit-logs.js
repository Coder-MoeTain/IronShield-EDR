/**
 * Migration: audit_logs (immutable audit trail)
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function run() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INT AUTO_INCREMENT PRIMARY KEY,
      user_id INT NULL,
      username VARCHAR(128) NULL,
      action VARCHAR(128) NOT NULL,
      resource_type VARCHAR(64) NULL,
      resource_id VARCHAR(64) NULL,
      details JSON NULL,
      ip_address VARCHAR(45) NULL,
      user_agent VARCHAR(512) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      INDEX idx_created (created_at),
      INDEX idx_user_created (user_id, created_at),
      INDEX idx_action_created (action, created_at)
    )
  `);
  // eslint-disable-next-line no-console
  console.log('OK: audit_logs');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

