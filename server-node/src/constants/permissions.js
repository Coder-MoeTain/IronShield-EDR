/**
 * Enterprise permission matrix (Phase 1).
 * Routes may still reference legacy names; use hasPermission() for checks.
 */

const PERMISSIONS = Object.freeze({
  DASHBOARD_VIEW: 'dashboard:view',
  ENDPOINT_VIEW: 'endpoint:view',
  ENDPOINT_MANAGE: 'endpoint:manage',
  ALERT_VIEW: 'alert:view',
  ALERT_TRIAGE: 'alert:triage',
  INCIDENT_VIEW: 'incident:view',
  INCIDENT_MANAGE: 'incident:manage',
  DETECTION_VIEW: 'detection:view',
  DETECTION_MANAGE: 'detection:manage',
  RESPONSE_VIEW: 'response:view',
  RESPONSE_REQUEST: 'response:request',
  RESPONSE_APPROVE: 'response:approve',
  RESPONSE_EXECUTE: 'response:execute',
  HUNTING_VIEW: 'hunting:view',
  HUNTING_RUN: 'hunting:run',
  IOC_VIEW: 'ioc:view',
  IOC_MANAGE: 'ioc:manage',
  TENANT_VIEW: 'tenant:view',
  TENANT_MANAGE: 'tenant:manage',
  USER_VIEW: 'user:view',
  USER_MANAGE: 'user:manage',
  AUDIT_VIEW: 'audit:view',
  SYSTEM_ADMIN: 'system:admin',
});

const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  TENANT_ADMIN: 'tenant_admin',
  SOC_MANAGER: 'soc_manager',
  SENIOR_ANALYST: 'senior_analyst',
  ANALYST: 'analyst',
  READ_ONLY: 'read_only',
  AUDITOR: 'auditor',
});

/** Default enterprise role → permissions (DB may override via role_permissions). */
const ROLE_PERMISSION_DEFAULTS = Object.freeze({
  [ROLES.SUPER_ADMIN]: ['*'],
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
    PERMISSIONS.TENANT_VIEW,
    PERMISSIONS.USER_VIEW,
    PERMISSIONS.USER_MANAGE,
    PERMISSIONS.AUDIT_VIEW,
  ],
  [ROLES.SOC_MANAGER]: [
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
    PERMISSIONS.AUDIT_VIEW,
  ],
  [ROLES.SENIOR_ANALYST]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ENDPOINT_VIEW,
    PERMISSIONS.ALERT_VIEW,
    PERMISSIONS.ALERT_TRIAGE,
    PERMISSIONS.INCIDENT_VIEW,
    PERMISSIONS.INCIDENT_MANAGE,
    PERMISSIONS.DETECTION_VIEW,
    PERMISSIONS.RESPONSE_VIEW,
    PERMISSIONS.RESPONSE_REQUEST,
    PERMISSIONS.RESPONSE_EXECUTE,
    PERMISSIONS.HUNTING_VIEW,
    PERMISSIONS.HUNTING_RUN,
    PERMISSIONS.IOC_VIEW,
  ],
  [ROLES.ANALYST]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ENDPOINT_VIEW,
    PERMISSIONS.ALERT_VIEW,
    PERMISSIONS.ALERT_TRIAGE,
    PERMISSIONS.INCIDENT_VIEW,
    PERMISSIONS.DETECTION_VIEW,
    PERMISSIONS.RESPONSE_VIEW,
    PERMISSIONS.RESPONSE_REQUEST,
    PERMISSIONS.HUNTING_VIEW,
    PERMISSIONS.IOC_VIEW,
  ],
  [ROLES.READ_ONLY]: [
    PERMISSIONS.DASHBOARD_VIEW,
    PERMISSIONS.ENDPOINT_VIEW,
    PERMISSIONS.ALERT_VIEW,
    PERMISSIONS.INCIDENT_VIEW,
    PERMISSIONS.DETECTION_VIEW,
    PERMISSIONS.RESPONSE_VIEW,
    PERMISSIONS.HUNTING_VIEW,
    PERMISSIONS.IOC_VIEW,
  ],
  [ROLES.AUDITOR]: [PERMISSIONS.AUDIT_VIEW, PERMISSIONS.DASHBOARD_VIEW],
});

/**
 * Legacy route middleware names → enterprise permissions that satisfy the check.
 */
const LEGACY_ROUTE_PERMISSION_EXPANSION = Object.freeze({
  'actions:write': [
    PERMISSIONS.RESPONSE_REQUEST,
    PERMISSIONS.RESPONSE_EXECUTE,
    PERMISSIONS.ENDPOINT_MANAGE,
  ],
  'alerts:write': [PERMISSIONS.ALERT_TRIAGE],
  'rules:write': [PERMISSIONS.DETECTION_MANAGE],
  'audit:read': [PERMISSIONS.AUDIT_VIEW],
  'xdr:read': [PERMISSIONS.HUNTING_VIEW],
  'xdr:write': [PERMISSIONS.HUNTING_RUN, PERMISSIONS.IOC_MANAGE],
  manage_integrations: [PERMISSIONS.TENANT_MANAGE, PERMISSIONS.SYSTEM_ADMIN],
  manage_tenants: [PERMISSIONS.TENANT_MANAGE],
  manage_users: [PERMISSIONS.USER_MANAGE],
});

/** DB seed names (schema-phase5) → enterprise permissions. */
const DB_PERMISSION_EXPANSION = Object.freeze({
  view_endpoints: [PERMISSIONS.ENDPOINT_VIEW],
  view_alerts: [PERMISSIONS.ALERT_VIEW],
  manage_alerts: [PERMISSIONS.ALERT_TRIAGE],
  manage_incidents: [PERMISSIONS.INCIDENT_MANAGE],
  execute_response: [PERMISSIONS.RESPONSE_EXECUTE, PERMISSIONS.RESPONSE_REQUEST],
  manage_policies: [PERMISSIONS.ENDPOINT_MANAGE],
  manage_users: [PERMISSIONS.USER_MANAGE],
  export_data: [PERMISSIONS.AUDIT_VIEW],
  manage_iocs: [PERMISSIONS.IOC_MANAGE],
  manage_integrations: [PERMISSIONS.TENANT_MANAGE],
  view_audit: [PERMISSIONS.AUDIT_VIEW],
  manage_tenants: [PERMISSIONS.TENANT_MANAGE],
});

function expandPermissionAliases(permission) {
  const out = new Set([permission]);
  const legacy = LEGACY_ROUTE_PERMISSION_EXPANSION[permission];
  if (legacy) legacy.forEach((p) => out.add(p));
  const db = DB_PERMISSION_EXPANSION[permission];
  if (db) db.forEach((p) => out.add(p));
  return out;
}

/**
 * True if userPerms grants `required` (supports *, legacy, and DB permission names).
 */
function hasPermission(userPerms, required) {
  if (!Array.isArray(userPerms) || !required) return false;
  if (userPerms.includes('*')) return true;

  const userExpanded = new Set();
  for (const p of userPerms) {
    expandPermissionAliases(p).forEach((x) => userExpanded.add(x));
    userExpanded.add(p);
  }

  const requiredExpanded = expandPermissionAliases(required);
  if (userExpanded.has(required)) return true;
  for (const r of requiredExpanded) {
    if (userExpanded.has(r)) return true;
  }

  for (const [legacyKey, modernList] of Object.entries(LEGACY_ROUTE_PERMISSION_EXPANSION)) {
    if (legacyKey === required || modernList.includes(required)) {
      if (userPerms.includes(legacyKey)) return true;
      if (modernList.some((m) => userExpanded.has(m))) return true;
    }
  }

  return false;
}

function hasAnyPermission(userPerms, requiredList) {
  return requiredList.some((r) => hasPermission(userPerms, r));
}

module.exports = {
  PERMISSIONS,
  ROLES,
  ROLE_PERMISSION_DEFAULTS,
  LEGACY_ROUTE_PERMISSION_EXPANSION,
  DB_PERMISSION_EXPANSION,
  expandPermissionAliases,
  hasPermission,
  hasAnyPermission,
};
