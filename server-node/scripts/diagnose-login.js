#!/usr/bin/env node
require('dotenv').config();
const bcrypt = require('bcrypt');
const db = require('../src/utils/db');

async function main() {
  const row = await db.queryOne(
    `SELECT id, username, is_active, failed_login_attempts, locked_until, password_hash, mfa_enabled
     FROM admin_users WHERE username = 'admin'`
  );
  if (!row) {
    console.log('NO admin user — run: ADMIN_PASSWORD="YourPassword14chars!" npm run create-admin');
    process.exit(1);
  }
  console.log('admin user:', {
    id: row.id,
    is_active: row.is_active,
    failed_login_attempts: row.failed_login_attempts,
    locked_until: row.locked_until,
    mfa_enabled: row.mfa_enabled,
    has_password_hash: !!row.password_hash,
  });
  for (const pwd of ['ChangeMe123!00', 'ChangeMe123!']) {
    const ok = row.password_hash && (await bcrypt.compare(pwd, row.password_hash));
    console.log(`  password "${pwd}": ${ok ? 'MATCH' : 'no'}`);
  }
  await db.closePool?.().catch(() => {});
}

main().catch((e) => {
  console.error(e.message || e);
  process.exit(1);
});
