/**
 * Migration: tenant enrollment tokens (agent bootstrap per-tenant)
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function run() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS tenant_enrollment_tokens (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      tenant_id INT UNSIGNED NOT NULL,
      name VARCHAR(128) NOT NULL,
      token_hash VARCHAR(64) NOT NULL,
      created_by VARCHAR(128) NULL,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at DATETIME NULL,
      revoked_at DATETIME NULL,
      last_used_at DATETIME NULL,
      UNIQUE KEY uk_token_hash (token_hash),
      INDEX idx_tenant_created (tenant_id, created_at),
      INDEX idx_tenant_active (tenant_id, revoked_at, expires_at)
    ) ENGINE=InnoDB;
  `);

  // eslint-disable-next-line no-console
  console.log('OK: tenant_enrollment_tokens');
  process.exit(0);
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

