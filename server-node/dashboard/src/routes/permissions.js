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

export function canAccessAdminRoute(user) {
  if (!user) return false;
  return (
    canSeeEnterpriseSettings(user) ||
    canSeeMsspAndTenants(user) ||
    canSeeRbacAdmin(user) ||
    isAuditorRole(user) ||
    user.role === 'viewer'
  );
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
