/**
 * Phase 5 XDR: link incidents to canonical xdr_events.
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
  if (!(await tableExists('incident_xdr_event_links'))) {
    await db.execute(`
      CREATE TABLE incident_xdr_event_links (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        incident_id BIGINT UNSIGNED NOT NULL,
        xdr_event_id BIGINT UNSIGNED NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uniq_inc_xdr (incident_id, xdr_event_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Created incident_xdr_event_links');
  }

  await safe('CREATE INDEX idx_inc_xdr_incident ON incident_xdr_event_links (incident_id)');
  await safe('CREATE INDEX idx_inc_xdr_event ON incident_xdr_event_links (xdr_event_id)');

  console.log('XDR incident link migration complete');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

