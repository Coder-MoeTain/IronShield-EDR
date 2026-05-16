/**
 * Shared helpers for SQL migrations (idempotent).
 */
const mysql = require('mysql2/promise');

function getDbConfig() {
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD ?? '',
    database: process.env.DB_NAME || 'edr_platform',
    multipleStatements: true,
  };
}

async function withConnection(fn) {
  const conn = await mysql.createConnection(getDbConfig());
  try {
    return await fn(conn, getDbConfig().database);
  } finally {
    await conn.end();
  }
}

async function tableExists(conn, database, table) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? LIMIT 1`,
    [database, table]
  );
  return rows.length > 0;
}

async function columnExists(conn, database, table, column) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND COLUMN_NAME = ? LIMIT 1`,
    [database, table, column]
  );
  return rows.length > 0;
}

async function indexExists(conn, database, table, indexName) {
  const [rows] = await conn.query(
    `SELECT 1 FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = ? AND TABLE_NAME = ? AND INDEX_NAME = ? LIMIT 1`,
    [database, table, indexName]
  );
  return rows.length > 0;
}

async function addColumnIfMissing(conn, database, table, column, ddl) {
  if (await columnExists(conn, database, table, column)) return false;
  await conn.query(ddl);
  return true;
}

async function addIndexIfMissing(conn, database, table, indexName, ddl) {
  if (await indexExists(conn, database, table, indexName)) return false;
  await conn.query(ddl);
  return true;
}

async function ensureDefaultTenant(conn) {
  await conn.query(`
    CREATE TABLE IF NOT EXISTS tenants (
      id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(128) NOT NULL,
      slug VARCHAR(64) NOT NULL UNIQUE,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      INDEX idx_tenant_slug (slug)
    ) ENGINE=InnoDB
  `);
  const [countRows] = await conn.query('SELECT COUNT(*) AS n FROM tenants');
  if (countRows[0].n === 0) {
    await conn.query(
      "INSERT INTO tenants (name, slug, is_active) VALUES ('Default', 'default', TRUE)"
    );
  }
  const [defRows] = await conn.query("SELECT id FROM tenants WHERE slug = 'default' LIMIT 1");
  return defRows[0]?.id ?? null;
}

module.exports = {
  getDbConfig,
  withConnection,
  tableExists,
  columnExists,
  indexExists,
  addColumnIfMissing,
  addIndexIfMissing,
  ensureDefaultTenant,
};
