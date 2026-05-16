/**
 * Seed enterprise permission names (alongside legacy DB permissions).
 */
const { withConnection } = require('../lib/migrationHelpers');
const { PERMISSIONS, ROLES } = require('../../src/constants/permissions');

const ENTERPRISE_PERMISSIONS = Object.values(PERMISSIONS);

const ROLE_ENTERPRISE_MAP = {
  [ROLES.TENANT_ADMIN]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ENDPOINT_VIEW,
    PERMISSIONS.ENDPOINT_MANAGE,
    PERMISSIONS.ALERT_VIEW,
    PERMISSIONS.ALERT_TRIAGE,
    PERMISSIONS.INCIDENT_VIEW,
    PERMISSIONS.INCIDENT_MANAGE,
    PERMISSIONS.DETECTION_VIEW,
    PERMISSIONS.DETECTION_MANAGE,
    PERMISSIONS.RESPONSE_VIEW,
    PERMISSIONS.RESPONSE_REQUEST,
    PERMISSIONS.RESPONSE_APPROVE,
    PERMISSIONS.RESPONSE_EXECUTE,
    PERMISSIONS.HUNTING_VIEW,
    PERMISSIONS.HUNTING_RUN,
    PERMISSIONS.IOC_VIEW,
    PERMISSIONS.IOC_MANAGE,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
  ],
  [ROLES.SOC_MANAGER]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ENDPOINT_VIEW,
    PERMISSIONS.ALERT_VIEW,
    PERMISSIONS.ALERT_TRIAGE,
    PERMISSIONS.INCIDENT_MANAGE,
    PERMISSIONS.RESPONSE_APPROVE,
    PERMISSIONS.HUNTING_RUN,
    PERMISSIONS.AUDIT_VIEW,
  ],
  [ROLES.ANALYST]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ENDPOINT_VIEW,
    PERMISSIONS.ALERT_VIEW,
    PERMISSIONS.ALERT_TRIAGE,
    PERMISSIONS.RESPONSE_REQUEST,
    PERMISSIONS.HUNTING_VIEW,
  ],
  [ROLES.READ_ONLY]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ENDPOINT_VIEW,
    PERMISSIONS.ALERT_VIEW,
    PERMISSIONS.INCIDENT_VIEW,
  ],
  [ROLES.AUDITOR]: [PERMISSIONS.AUDIT_VIEW, PERMISSIONS.DASHBOARD_VIEW],
};

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
      console.warn('RBAC tables missing; skip enterprise permission seed');
      return;
    }

    for (const name of ENTERPRISE_PERMISSIONS) {
      await ensurePermission(conn, name);
    }

    for (const [roleName, perms] of Object.entries(ROLE_ENTERPRISE_MAP)) {
      const roleId = await ensureRole(conn, roleName, `Enterprise ${roleName}`);
      if (!roleId) continue;
      for (const perm of perms) {
        const permId = await ensurePermission(conn, perm);
        if (permId) await linkRolePermission(conn, roleId, permId);
      }
    }

    const superRoleId = await ensureRole(conn, ROLES.SUPER_ADMIN, 'Platform super administrator');
    if (superRoleId) {
      for (const perm of ENTERPRISE_PERMISSIONS) {
        const permId = await ensurePermission(conn, perm);
        if (permId) await linkRolePermission(conn, superRoleId, permId);
      }
    }
  });
}

async function down() {
  await withConnection(async (conn) => {
    if (ENTERPRISE_PERMISSIONS.length === 0) return;
    const placeholders = ENTERPRISE_PERMISSIONS.map(() => '?').join(',');
    await conn.query(
      `DELETE rp FROM role_permissions rp
       INNER JOIN permissions p ON p.id = rp.permission_id
       WHERE p.name IN (${placeholders})`,
      ENTERPRISE_PERMISSIONS
    );
    await conn.query(`DELETE FROM permissions WHERE name IN (${placeholders})`, ENTERPRISE_PERMISSIONS);
  });
}

module.exports = { up, down };
