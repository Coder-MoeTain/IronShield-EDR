/**
 * Client-side role hints for nav visibility (server RBAC remains authoritative).
 * admin_users.role: super_admin | analyst | viewer (see database schema).
 */

export function isSuperAdmin(user) {
  return user?.role === 'super_admin';
}

/** MSSP, multi-tenant ops */
export function canSeeMsspAndTenants(user) {
  return user?.role === 'super_admin';
}

/** RBAC management screen */
export function canSeeRbacAdmin(user) {
  return user?.role === 'super_admin';
}

/** Enterprise settings (org config) */
export function canSeeEnterpriseSettings(user) {
  const r = user?.role;
  return r === 'super_admin' || r === 'admin' || r === 'analyst';
}

/** Destructive / tenant-wide write UIs */
export function isReadOnlyViewer(user) {
  return user?.role === 'viewer';
}

/** Filter Enterprise nav children by role */
export function filterEnterpriseNavChildren(children, user) {
  if (!Array.isArray(children)) return children;
  return children.filter((c) => {
    if (c.to === '/tenants' && !canSeeMsspAndTenants(user)) return false;
    if (c.to === '/rbac' && !canSeeRbacAdmin(user)) return false;
    if (c.to === '/mssp' && !canSeeMsspAndTenants(user)) return false;
    if (c.to === '/enterprise' && !canSeeEnterpriseSettings(user)) return false;
    return true;
  });
}
