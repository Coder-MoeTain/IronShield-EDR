#!/usr/bin/env node
/** Unlock admin account after failed login lockout */
require('dotenv').config();
const db = require('../src/utils/db');

async function main() {
  const username = process.env.ADMIN_USERNAME || 'admin';
  const result = await db.execute(
    'UPDATE admin_users SET failed_login_attempts = 0, locked_until = NULL WHERE username = ?',
    [username]
  );
  const affected = result?.affectedRows ?? result?.[0]?.affectedRows ?? 0;
  console.log(`Unlocked user "${username}" (${affected} row(s))`);
  await db.closePool?.().catch(() => {});
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
