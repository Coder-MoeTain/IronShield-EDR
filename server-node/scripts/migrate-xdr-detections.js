/**
 * Phase 4 XDR: create xdr_detections table for detections generated from xdr_events.
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

async function safe(sql) {
  try {
    await db.execute(sql);
  } catch (_) {}
}

async function main() {
  if (!(await tableExists('xdr_detections'))) {
    await db.execute(`
      CREATE TABLE xdr_detections (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id INT NULL,
        endpoint_id INT NULL,
        xdr_event_id BIGINT UNSIGNED NOT NULL,
        detector VARCHAR(32) NOT NULL,
        rule_id BIGINT NULL,
        prediction VARCHAR(32) NOT NULL,
        confidence DOUBLE NULL,
        risk_score INT NULL,
        severity VARCHAR(16) NULL,
        title VARCHAR(255) NULL,
        details_json JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Created xdr_detections');
  }

  await safe('CREATE INDEX idx_xdr_det_event ON xdr_detections (xdr_event_id)');
  await safe('CREATE INDEX idx_xdr_det_tenant_ts ON xdr_detections (tenant_id, created_at)');
  await safe('CREATE INDEX idx_xdr_det_endpoint_ts ON xdr_detections (tenant_id, endpoint_id, created_at)');

  console.log('xdr_detections migration complete');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

