/**
 * Phase 7: store auto-response decisions for idempotency.
 */
require('dotenv').config();
const db = require('../src/utils/db');

async function tableExists(name) {
  const rows = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = ?`,
    [name]
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function main() {
  if (!(await tableExists('xdr_autoresponse'))) {
    await db.execute(`
      CREATE TABLE xdr_autoresponse (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        detection_id BIGINT UNSIGNED NOT NULL,
        action_ids JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_detection (detection_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Created xdr_autoresponse');
  }
  console.log('xdr_autoresponse migration complete');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

