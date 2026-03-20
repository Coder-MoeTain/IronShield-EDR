/**
 * Seed admin user with bcrypt-hashed password
 * Run: npm run seed-admin
 * Default: admin / ChangeMe123!
 */
require('dotenv').config();
const bcrypt = require('bcrypt');
const mysql = require('mysql2/promise');

const config = {
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '3306', 10),
  user: process.env.DB_USER || 'edr_user',
  password: process.env.DB_PASSWORD !== undefined ? process.env.DB_PASSWORD : 'edr_password',
  database: process.env.DB_NAME || 'edr_platform',
};

const DEFAULT_PASSWORD = 'ChangeMe123!';

async function main() {
  const hash = await bcrypt.hash(DEFAULT_PASSWORD, 10);
  const conn = await mysql.createConnection(config);

  await conn.execute(
    `INSERT INTO admin_users (username, password_hash, email, role)
     VALUES (?, ?, 'admin@edr.local', 'super_admin')
     ON DUPLICATE KEY UPDATE password_hash = VALUES(password_hash)`,
    ['admin', hash]
  );

  console.log('Admin user seeded: admin / ChangeMe123!');
  console.log('IMPORTANT: Change this password immediately after first login!');
  await conn.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
