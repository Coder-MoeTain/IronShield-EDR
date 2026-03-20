/**
 * Multi-tenancy service - tenant resolution and scoping
 */
const db = require('../utils/db');

const DEFAULT_TENANT_ID = 1;

async function getDefaultTenant() {
  const row = await db.queryOne('SELECT id FROM tenants WHERE slug = ? OR id = 1 LIMIT 1', ['default']);
  return row?.id ?? DEFAULT_TENANT_ID;
}

async function getTenantIdsForUser(userId) {
  const user = await db.queryOne('SELECT tenant_id FROM admin_users WHERE id = ?', [userId]);
  if (user?.tenant_id) return [user.tenant_id];
  const roleRows = await db.query(
    'SELECT tenant_id FROM user_roles WHERE user_id = ?',
    [userId]
  );
  const ids = roleRows.map((r) => r.tenant_id).filter(Boolean);
  return ids.length > 0 ? [...new Set(ids)] : null;
}

async function getEffectiveTenantId(user) {
  if (!user) return null;
  if (user.role === 'super_admin') return null;
  if (user.tenantId) return user.tenantId;
  const userRow = await db.queryOne('SELECT tenant_id FROM admin_users WHERE id = ?', [user.userId]);
  return userRow?.tenant_id ?? null;
}

function getTenantFilter(tenantId) {
  if (!tenantId) return { sql: '', params: [] };
  return { sql: ' AND e.tenant_id = ?', params: [tenantId] };
}

module.exports = {
  getDefaultTenant,
  getTenantIdsForUser,
  getEffectiveTenantId,
  getTenantFilter,
  DEFAULT_TENANT_ID,
};
