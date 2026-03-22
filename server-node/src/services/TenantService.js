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

async function getEffectiveTenantId(user, overrideTenantId = null) {
  if (overrideTenantId != null) return parseInt(overrideTenantId, 10) || null;
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

async function list() {
  return db.query('SELECT id, name, slug, is_active, created_at FROM tenants ORDER BY name');
}

async function getById(id) {
  return db.queryOne('SELECT id, name, slug, is_active, created_at, updated_at FROM tenants WHERE id = ?', [id]);
}

async function create(data) {
  const { name, slug } = data || {};
  if (!name) throw new Error('name required');
  const rawSlug = slug || name;
  const s = String(rawSlug).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'tenant';
  const result = await db.execute(
    'INSERT INTO tenants (name, slug) VALUES (?, ?)',
    [name, s]
  );
  return result.insertId;
}

async function update(id, data) {
  const existing = await getById(id);
  if (!existing) return null;
  const { name, slug, is_active } = data || {};
  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (slug !== undefined) { updates.push('slug = ?'); params.push(String(slug).toLowerCase().replace(/[^a-z0-9-]/g, '-')); }
  if (is_active !== undefined) { updates.push('is_active = ?'); params.push(!!is_active); }
  if (updates.length === 0) return id;
  params.push(id);
  await db.execute(`UPDATE tenants SET ${updates.join(', ')} WHERE id = ?`, params);
  return id;
}

async function deleteById(id) {
  const existing = await getById(id);
  if (!existing) return false;
  await db.execute('DELETE FROM tenants WHERE id = ?', [id]);
  return true;
}

async function getEndpointCount(tenantId) {
  const [row] = await db.query('SELECT COUNT(*) as count FROM endpoints WHERE tenant_id = ?', [tenantId]);
  return row?.count ?? 0;
}

/** Normalize slug for lookup (matches create() rules). */
function normalizeTenantSlug(raw) {
  if (raw == null || raw === '') return '';
  const s = String(raw).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  return s || '';
}

/**
 * Resolve tenant id by slug, or null if not found / inactive.
 * @param {string} slug
 */
async function getTenantIdBySlug(slug) {
  const s = normalizeTenantSlug(slug);
  if (!s) return null;
  const row = await db.queryOne(
    'SELECT id FROM tenants WHERE slug = ? AND is_active = 1',
    [s]
  );
  return row?.id ?? null;
}

module.exports = {
  getDefaultTenant,
  getTenantIdsForUser,
  getEffectiveTenantId,
  getTenantFilter,
  list,
  getById,
  create,
  update,
  deleteById,
  getEndpointCount,
  getTenantIdBySlug,
  normalizeTenantSlug,
  DEFAULT_TENANT_ID,
};
