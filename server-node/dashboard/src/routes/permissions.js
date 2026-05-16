/**
 * Route-level permission and role guards for the compact console.
 */
import {
  canSeeEnterpriseSettings,
  canSeeMsspAndTenants,
  canSeeRbacAdmin,
  isAuditorRole,
  isReadOnlyViewer,
} from '../utils/socRoles';

/** @deprecated use canAccessAdminShell */
export function canAccessAdminRoute(user) {
  return canAccessAdminShell(user);
}

/** May open /admin (shell); tab visibility is finer-grained below. */
export function canAccessAdminShell(user) {
  if (!user) return false;
  if (isAuditorRole(user) || isReadOnlyViewer(user)) return true;
  return (
    canSeeEnterpriseSettings(user) ||
    canSeeMsspAndTenants(user) ||
    canSeeRbacAdmin(user) ||
    user.role === 'tenant_admin' ||
    user.role === 'admin' ||
    user.role === 'super_admin'
  );
}

export function canAccessUsersTab(user) {
  if (!user || isAuditorRole(user) || isReadOnlyViewer(user)) return false;
  return canSeeRbacAdmin(user) || user.role === 'tenant_admin';
}

export function canAccessTenantsTab(user) {
  if (!user || isAuditorRole(user) || isReadOnlyViewer(user)) return false;
  return canSeeMsspAndTenants(user);
}

export function canAccessRbacTab(user) {
  if (!user || isAuditorRole(user) || isReadOnlyViewer(user)) return false;
  return canSeeRbacAdmin(user);
}

export function canAccessAuditTab(user) {
  return Boolean(user) && canAccessAdminShell(user);
}

export function canAccessReportsTab(user) {
  if (!user || isAuditorRole(user) || isReadOnlyViewer(user)) return false;
  return canSeeEnterpriseSettings(user);
}

export function canAccessSystemHealthTab(user) {
  return Boolean(user) && canAccessAdminShell(user);
}

export function canAccessSettingsTab(user) {
  if (!user || isAuditorRole(user) || isReadOnlyViewer(user)) return false;
  return user.role === 'super_admin' || user.role === 'admin';
}

export function canAccessIntegrationsTab(user) {
  if (!user || isAuditorRole(user) || isReadOnlyViewer(user)) return false;
  return canSeeEnterpriseSettings(user);
}

export function canAccessResponseRoute(user, permissions = []) {
  if (isAuditorRole(user) || isReadOnlyViewer(user)) return false;
  if (permissions.includes('*')) return true;
  return (
    permissions.includes('response:view') ||
    permissions.includes('response:request') ||
    permissions.includes('actions:write') ||
    ['analyst', 'admin', 'super_admin', 'soc_manager', 'senior_analyst', 'tenant_admin'].includes(
      user?.role
    )
  );
}

export function canRunResponseActions(user, permissions = []) {
  if (isReadOnlyViewer(user) || isAuditorRole(user)) return false;
  if (permissions.includes('*')) return true;
  return (
    permissions.includes('response:execute') ||
    permissions.includes('response:approve') ||
    permissions.includes('actions:write')
  );
}

export function canSeeRbac(user) {
  return canSeeRbacAdmin(user);
}

export function canSeeTenantSwitcher(user) {
  return user?.role === 'super_admin';
}
