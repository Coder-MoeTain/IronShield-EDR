#!/usr/bin/env node
/**
 * Seed Phase 6 - retention policies, default agent release
 */
require('dotenv').config();
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME || 'edr_platform',
};

const retentionPolicies = [
  { name: 'Raw Events', table_name: 'raw_events', retain_days: 90 },
  { name: 'Heartbeats', table_name: 'endpoint_heartbeats', retain_days: 30 },
  { name: 'Normalized Events', table_name: 'normalized_events', retain_days: 90 },
  { name: 'Audit Logs', table_name: 'audit_logs', retain_days: 365 },
];

async function main() {
  const conn = await mysql.createConnection(config);
  try {
    for (const p of retentionPolicies) {
      const [existing] = await conn.execute(
        'SELECT 1 FROM retention_policies WHERE table_name = ?',
        [p.table_name]
      );
      if (existing.length === 0) {
        await conn.execute(
          'INSERT INTO retention_policies (name, table_name, retain_days) VALUES (?, ?, ?)',
          [p.name, p.table_name, p.retain_days]
        );
      }
    }
    const [rel] = await conn.execute('SELECT 1 FROM agent_releases WHERE version = ?', ['1.0.0']);
    if (rel.length === 0) {
      await conn.execute(
        "INSERT INTO agent_releases (version, is_current) VALUES ('1.0.0', TRUE)"
      );
    }
    console.log('Phase 6 seed complete');
  } finally {
    await conn.end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
