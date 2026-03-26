/**
 * Create (or reset) an admin user with an explicitly provided password.
 *
 * Required env:
 * - DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME
 * - ADMIN_PASSWORD
 *
 * Optional env:
 * - ADMIN_USERNAME (default: admin)
 * - ADMIN_EMAIL (default: admin@your-org.example)
 * - ADMIN_ROLE (default: super_admin)
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

function requiredEnv(name) {
  const v = process.env[name];
  if (v === undefined || v === null || String(v).trim() === '') {
    throw new Error(`Missing required env var: ${name}`);
  }
  return String(v);
}

async function main() {
  const dbConfig = {
    host: requiredEnv('DB_HOST'),
    port: parseInt(requiredEnv('DB_PORT'), 10),
    user: requiredEnv('DB_USER'),
    password: process.env.DB_PASSWORD ?? '',
    database: requiredEnv('DB_NAME'),
  };

  const username = (process.env.ADMIN_USERNAME || 'admin').trim();
  const email = (process.env.ADMIN_EMAIL || 'admin@your-org.example').trim();
  const role = (process.env.ADMIN_ROLE || 'super_admin').trim();
  const password = requiredEnv('ADMIN_PASSWORD');
  if (password.length < 14) {
    throw new Error('ADMIN_PASSWORD must be at least 14 characters');
  }

  const hash = await bcrypt.hash(password, 12);
  const conn = await mysql.createConnection(dbConfig);
  try {
    await conn.execute(
      `INSERT INTO admin_users (username, password_hash, email, role)
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash), email = VALUES(email), role = VALUES(role)`,
      [username, hash, email, role]
    );
  } finally {
    await conn.end();
  }

  // Do not print credentials.
  console.log(`Admin user ensured: ${username}`);
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});

