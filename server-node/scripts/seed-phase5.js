/**
 * Seed Phase 5 - Roles and permissions
 * Run after schema-phase5.sql
 */
const db = require('../src/utils/db');

const ROLES = [
  { name: 'platform_super_admin', description: 'Full platform access' },
  { name: 'tenant_admin', description: 'Tenant administrator' },
  { name: 'soc_manager', description: 'SOC team manager' },
  { name: 'analyst', description: 'Security analyst' },
  { name: 'responder', description: 'Response actions' },
  { name: 'viewer', description: 'Read-only access' },
  { name: 'auditor', description: 'Audit access' },
];

const PERMISSIONS = [
  'view_endpoints', 'view_alerts', 'manage_alerts', 'manage_incidents',
  'execute_response', 'manage_policies', 'manage_users', 'export_data',
  'manage_iocs', 'manage_integrations', 'view_audit', 'manage_tenants',
];

async function main() {
  for (const r of ROLES) {
    await db.execute(
      'INSERT IGNORE INTO roles (name, description) VALUES (?, ?)',
      [r.name, r.description]
    );
  }
  for (const p of PERMISSIONS) {
    await db.execute(
      'INSERT IGNORE INTO permissions (name) VALUES (?)',
      [p]
    );
  }
  console.log('Phase 5 roles and permissions seeded.');
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
