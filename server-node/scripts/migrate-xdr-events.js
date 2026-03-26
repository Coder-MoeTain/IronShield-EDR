/**
 * Phase 2 XDR: create canonical xdr_events table (normalized, multi-source).
 * Idempotent: safe to run multiple times.
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

async function columnExists(table, col) {
  const rows = await db.query(
    `SELECT COUNT(*) AS c FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ? AND column_name = ?`,
    [table, col]
  );
  return Number(rows?.[0]?.c || 0) > 0;
}

async function addColumn(table, col, def) {
  if (await columnExists(table, col)) return;
  await db.execute(`ALTER TABLE \`${table}\` ADD COLUMN \`${col}\` ${def}`);
  console.log(`Added ${table}.${col}`);
}

async function ensureIndexes() {
  // MySQL doesn't have easy IF NOT EXISTS for indexes across versions; keep it minimal here.
  // If an index exists, ignore error.
  const safeIdx = async (sql) => {
    try {
      await db.execute(sql);
    } catch (_) {}
  };
  await safeIdx('CREATE INDEX idx_xdr_events_tenant_ts ON xdr_events (tenant_id, timestamp)');
  await safeIdx('CREATE INDEX idx_xdr_events_type_ts ON xdr_events (tenant_id, event_type, timestamp)');
  await safeIdx('CREATE INDEX idx_xdr_events_endpoint_ts ON xdr_events (tenant_id, endpoint_id, timestamp)');
  await safeIdx('CREATE INDEX idx_xdr_events_hash ON xdr_events (tenant_id, file_hash_sha256)');
  await safeIdx('CREATE INDEX idx_xdr_events_dstip ON xdr_events (tenant_id, destination_ip, timestamp)');
}

async function main() {
  const exists = await tableExists('xdr_events');
  if (!exists) {
    await db.execute(`
      CREATE TABLE xdr_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        tenant_id INT NULL,
        endpoint_id INT NULL,
        event_id VARCHAR(128) NULL,
        timestamp DATETIME NOT NULL,
        source VARCHAR(32) NOT NULL,
        event_type VARCHAR(64) NULL,
        user_name VARCHAR(255) NULL,
        host_name VARCHAR(255) NULL,
        process_name VARCHAR(255) NULL,
        process_path VARCHAR(1024) NULL,
        process_id INT NULL,
        parent_process_id INT NULL,
        parent_process_name VARCHAR(255) NULL,
        command_line TEXT NULL,
        file_path VARCHAR(1024) NULL,
        file_hash_sha256 VARCHAR(64) NULL,
        registry_key VARCHAR(1024) NULL,
        registry_value_name VARCHAR(512) NULL,
        source_ip VARCHAR(64) NULL,
        destination_ip VARCHAR(64) NULL,
        destination_port INT NULL,
        protocol VARCHAR(16) NULL,
        dns_query VARCHAR(1024) NULL,
        action VARCHAR(64) NULL,
        metadata_json JSON NULL,
        raw_json JSON NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);
    console.log('Created xdr_events');
  }

  // forward-compat columns (safe defaults)
  await addColumn('xdr_events', 'ingest_id', 'VARCHAR(64) NULL');
  await addColumn('xdr_events', 'severity', 'VARCHAR(16) NULL');
  await addColumn('xdr_events', 'risk_score', 'INT NULL');

  await ensureIndexes();
  console.log('xdr_events migration complete');
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });

