/**
 * RBAC permission facade — canonical matrix in constants/permissions.js.
 */
const {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSION_DEFAULTS,
  hasAnyPermission,
  expandPermissionAliases,
} = require('../constants/permissions');
const { getUserPermissions, requirePermission, requireAnyPermission } = require('../middleware/rbac');

module.exports = {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSION_DEFAULTS,
  hasAnyPermission,
  expandPermissionAliases,
  getUserPermissions,
  requirePermission,
  requireAnyPermission,
};
