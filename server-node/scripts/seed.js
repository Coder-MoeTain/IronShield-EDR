#!/usr/bin/env node
/**
 * Seed baseline SOC data: default tenant, RBAC permissions, optional admin user.
 *
 *   npm run seed
 *
 * Requires migrations (npm run migrate). For admin user also set ADMIN_PASSWORD (14+ chars).
 */
require('dotenv').config();
const { withConnection, ensureDefaultTenant } = require('./lib/migrationHelpers');
const enterpriseSeed = require('./migrations/20260516120100_phase2_enterprise_permissions');

async function seedTenants(conn) {
  const defaultId = await ensureDefaultTenant(conn);
  const demoSlug = process.env.SEED_DEMO_TENANT_SLUG || 'demo-tenant-b';
  const demoName = process.env.SEED_DEMO_TENANT_NAME || 'Demo Tenant B';
  await conn.query(
    `INSERT INTO tenants (name, slug, is_active)
     SELECT ?, ?, TRUE FROM DUAL
     WHERE NOT EXISTS (SELECT 1 FROM tenants WHERE slug = ? LIMIT 1)`,
    [demoName, demoSlug, demoSlug]
  );
  const [demoRows] = await conn.query('SELECT id FROM tenants WHERE slug = ? LIMIT 1', [demoSlug]);
  return { defaultTenantId: defaultId, demoTenantId: demoRows[0]?.id ?? null };
}

async function main() {
  console.log('\n▶ Seeding baseline data…\n');

  await withConnection(async (conn) => {
    const tenants = await seedTenants(conn);
    console.log(`  tenants: default=${tenants.defaultTenantId} demo=${tenants.demoTenantId}`);
  });

  await enterpriseSeed.up();
  console.log('  enterprise permissions: OK');

  if (process.env.ADMIN_PASSWORD) {
    const { spawnSync } = require('child_process');
    const path = require('path');
    const r = spawnSync(process.execPath, [path.join(__dirname, 'create-admin.js')], {
      cwd: path.join(__dirname, '..'),
      stdio: 'inherit',
      env: process.env,
    });
    if (r.status !== 0) {
      throw new Error('create-admin failed');
    }
  } else {
    console.log('  admin user: skipped (set ADMIN_PASSWORD to create)');
  }

  console.log('\n✓ Seed complete.\n');
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
