/**
 * Bootstrap schema_migrations table.
 */
const { withConnection, tableExists } = require('../lib/migrationHelpers');

async function up() {
  await withConnection(async (conn, database) => {
    if (await tableExists(conn, database, 'schema_migrations')) return;
    await conn.query(`
      CREATE TABLE schema_migrations (
        id VARCHAR(128) NOT NULL PRIMARY KEY,
        batch INT UNSIGNED NOT NULL,
        description VARCHAR(255) NULL,
        applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_batch (batch),
        INDEX idx_applied (applied_at)
      ) ENGINE=InnoDB
    `);
  });
}

async function down() {
  await withConnection(async (conn) => {
    await conn.query('DROP TABLE IF EXISTS schema_migrations');
  });
}

module.exports = { up, down };
