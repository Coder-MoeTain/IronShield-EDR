#!/usr/bin/env node
require('dotenv').config();
const db = require('../src/utils/db');

async function main() {
  const tables = await db.query(
    "SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('permissions','roles','role_permissions','user_roles','software_block_policies')"
  );
  console.log('tables:', tables.map((t) => t.TABLE_NAME));
  const admin = await db.queryOne("SELECT id, username, role, tenant_id FROM admin_users WHERE username = 'admin'");
  console.log('admin:', admin);
  await db.closePool?.();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
