/**
 * Admin RBAC management (roles/permissions/user role assignments).
 */
const db = require('../utils/db');

const LEGACY_ROLE_PERMISSIONS = {
  super_admin: ['*'],
  admin: ['actions:write', 'alerts:write', 'rules:write', 'audit:read', 'xdr:read', 'xdr:write', 'manage_integrations'],
  analyst: ['actions:write', 'alerts:write', 'rules:write', 'audit:read', 'xdr:read'],
  viewer: [],
};

function isMissingTableError(err) {
  return ['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR'].includes(String(err?.code || ''));
}

async function listRoles() {
  try {
    return await db.query('SELECT id, name, description, created_at FROM roles ORDER BY name');
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    return Object.keys(LEGACY_ROLE_PERMISSIONS).map((name, idx) => ({
      id: idx + 1,
      name,
      description: 'Legacy built-in role',
      created_at: null,
    }));
  }
}

async function listPermissions() {
  try {
    return await db.query('SELECT id, name, description FROM permissions ORDER BY name');
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    const names = Array.from(new Set(Object.values(LEGACY_ROLE_PERMISSIONS).flat())).sort();
    return names.map((name, idx) => ({
      id: idx + 1,
      name,
      description: 'Legacy inferred permission',
    }));
  }
}

async function listAdminUsers(tenantId = null) {
  // tenantId filters by admin_users.tenant_id (primary tenant) OR user_roles tenant assignments.
  if (tenantId == null) {
    return db.query('SELECT id, username, email, role, tenant_id, is_active, last_login_at FROM admin_users ORDER BY id DESC LIMIT 500');
  }
  try {
    const rows = await db.query(
      `
        SELECT DISTINCT u.id, u.username, u.email, u.role, u.tenant_id, u.is_active, u.last_login_at
        FROM admin_users u
        LEFT JOIN user_roles ur ON ur.user_id = u.id
        WHERE u.tenant_id = ? OR ur.tenant_id = ?
        ORDER BY u.id DESC
        LIMIT 500
      `,
      [tenantId, tenantId]
    );
    return rows;
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    return db.query(
      'SELECT id, username, email, role, tenant_id, is_active, last_login_at FROM admin_users WHERE tenant_id = ? ORDER BY id DESC LIMIT 500',
      [tenantId]
    );
  }
}

async function getUserRoles(userId) {
  try {
    const rows = await db.query(
      `
        SELECT ur.user_id, ur.tenant_id, r.name AS role_name
        FROM user_roles ur
        JOIN roles r ON r.id = ur.role_id
        WHERE ur.user_id = ?
        ORDER BY r.name
      `,
      [userId]
    );
    return rows;
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    const user = await db.queryOne('SELECT id, role FROM admin_users WHERE id = ? LIMIT 1', [userId]);
    if (!user) return [];
    return [{ user_id: user.id, tenant_id: null, role_name: user.role || 'viewer' }];
  }
}

async function setUserRoles({ userId, tenantId = null, roleNames = [] }) {
  if (!userId) throw new Error('userId required');
  if (!Array.isArray(roleNames)) throw new Error('roleNames must be array');

  const names = [...new Set(roleNames.map((r) => String(r).trim()).filter(Boolean))];
  try {
    // Resolve role ids
    const roles = names.length
      ? await db.query(`SELECT id, name FROM roles WHERE name IN (${names.map(() => '?').join(',')})`, names)
      : [];
    const byName = new Map(roles.map((r) => [r.name, r.id]));
    for (const n of names) {
      if (!byName.has(n)) throw new Error(`Unknown role: ${n}`);
    }

    // Delete existing for that tenant scope (NULL means global roles)
    await db.execute(
      'DELETE FROM user_roles WHERE user_id = ? AND (tenant_id <=> ?)',
      [userId, tenantId]
    );

    for (const n of names) {
      await db.execute(
        'INSERT INTO user_roles (user_id, role_id, tenant_id) VALUES (?, ?, ?)',
        [userId, byName.get(n), tenantId]
      );
    }
    return true;
  } catch (err) {
    if (!isMissingTableError(err)) throw err;
    const role = names[0] || 'viewer';
    if (!Object.prototype.hasOwnProperty.call(LEGACY_ROLE_PERMISSIONS, role)) {
      throw new Error(`Unknown role: ${role}`);
    }
    await db.execute('UPDATE admin_users SET role = ? WHERE id = ?', [role, userId]);
    return true;
  }
}

module.exports = {
  listRoles,
  listPermissions,
  listAdminUsers,
  getUserRoles,
  setUserRoles,
};

