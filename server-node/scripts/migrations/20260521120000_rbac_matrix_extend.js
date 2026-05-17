/**
 * Sync full enterprise RBAC matrix (roles + permissions) from constants.
 */
const { withConnection } = require('../lib/migrationHelpers');
const { PERMISSIONS, ROLES, ROLE_PERMISSION_DEFAULTS } = require('../../src/constants/permissions');

async function ensurePermission(conn, name) {
  await conn.query('INSERT IGNORE INTO permissions (name) VALUES (?)', [name]);
  const [rows] = await conn.query('SELECT id FROM permissions WHERE name = ? LIMIT 1', [name]);
  return rows[0]?.id;
}

async function ensureRole(conn, name, description) {
  await conn.query('INSERT IGNORE INTO roles (name, description) VALUES (?, ?)', [name, description]);
  const [rows] = await conn.query('SELECT id FROM roles WHERE name = ? LIMIT 1', [name]);
  return rows[0]?.id;
}

async function linkRolePermission(conn, roleId, permissionId) {
  await conn.query('INSERT IGNORE INTO role_permissions (role_id, permission_id) VALUES (?, ?)', [
    roleId,
    permissionId,
  ]);
}

async function up() {
  await withConnection(async (conn) => {
    const [tables] = await conn.query(
      `SELECT TABLE_NAME FROM information_schema.TABLES
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN ('permissions','roles','role_permissions')`
    );
    if (tables.length < 3) {
      console.warn('RBAC tables missing; skip rbac_matrix_extend');
      return;
    }

    for (const name of Object.values(PERMISSIONS)) {
      await ensurePermission(conn, name);
    }

    for (const [roleName, perms] of Object.entries(ROLE_PERMISSION_DEFAULTS)) {
      const roleId = await ensureRole(conn, roleName, `Enterprise ${roleName}`);
      if (!roleId) continue;
      if (perms.includes('*')) {
        for (const p of Object.values(PERMISSIONS)) {
          const permId = await ensurePermission(conn, p);
          if (permId) await linkRolePermission(conn, roleId, permId);
        }
        continue;
      }
      for (const perm of perms) {
        const permId = await ensurePermission(conn, perm);
        if (permId) await linkRolePermission(conn, roleId, permId);
      }
    }

    const superRoleId = await ensureRole(conn, ROLES.SUPER_ADMIN, 'Platform super administrator');
    if (superRoleId) {
      for (const p of Object.values(PERMISSIONS)) {
        const permId = await ensurePermission(conn, p);
        if (permId) await linkRolePermission(conn, superRoleId, permId);
      }
    }
  });
}

async function down() {
  /* permissions remain; unlink only new role links if needed — no-op for safety */
}

module.exports = { up, down };
