/**
 * Tenant-safe query helpers (Phase 1).
 * Use for repository/service layers to enforce MSSP isolation.
 */

const { ROLES } = require('../constants/permissions');

/**
 * Resolve tenant scope from an authenticated admin request.
 * @returns {{ unrestricted: boolean, tenantId: number|null }}
 */
function resolveTenantScope(req) {
  const role = req?.user?.role;
  const tenantId = req?.tenantId ?? req?.user?.tenantId ?? null;

  if (role === ROLES.SUPER_ADMIN || role === 'super_admin') {
    if (tenantId == null) {
      return { unrestricted: true, tenantId: null };
    }
    return { unrestricted: false, tenantId: Number(tenantId) };
  }

  if (tenantId == null) {
    const err = new Error('Tenant context required');
    err.code = 'TENANT_CONTEXT_REQUIRED';
    err.statusCode = 403;
    throw err;
  }

  return { unrestricted: false, tenantId: Number(tenantId) };
}

/**
 * SQL fragment for tenant filtering on a column (default endpoints.tenant_id).
 */
function tenantWhereClause(scope, column = 'tenant_id') {
  if (scope.unrestricted) {
    return { sql: '1=1', params: [] };
  }
  return { sql: `${column} = ?`, params: [scope.tenantId] };
}

/**
 * AND-combine an existing WHERE with tenant scope.
 */
function appendTenantFilter(existingWhere, scope, column = 'tenant_id') {
  const tenant = tenantWhereClause(scope, column);
  if (!existingWhere || existingWhere.trim() === '') {
    return { where: `WHERE ${tenant.sql}`, params: [...tenant.params] };
  }
  return {
    where: `${existingWhere} AND ${tenant.sql}`,
    params: [...tenant.params],
  };
}

/**
 * Ensure a resource row belongs to the active tenant (throws 403 HttpError-style object).
 */
function assertTenantAccess(scope, resourceTenantId) {
  if (scope.unrestricted) return true;
  const rid = resourceTenantId == null ? null : Number(resourceTenantId);
  if (rid !== scope.tenantId) {
    const err = new Error('Access denied for this tenant');
    err.code = 'PERMISSION_DENIED';
    err.statusCode = 403;
    throw err;
  }
  return true;
}

/**
 * Merge tenant into a filters object used by services (e.g. listEndpoints).
 */
function mergeTenantFilter(filters, req) {
  const scope = resolveTenantScope(req);
  const next = { ...(filters || {}) };
  if (!scope.unrestricted) {
    next.tenantId = scope.tenantId;
  }
  return { filters: next, scope };
}

/**
 * Bind tenant_id on INSERT payloads when scope is restricted.
 */
function withTenantId(scope, row) {
  if (scope.unrestricted) return { ...row };
  return { ...row, tenant_id: scope.tenantId, tenantId: scope.tenantId };
}

module.exports = {
  resolveTenantScope,
  tenantWhereClause,
  appendTenantFilter,
  assertTenantAccess,
  mergeTenantFilter,
  withTenantId,
};
