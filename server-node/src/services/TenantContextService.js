/**
 * Tenant context facade — use in services/repositories for MSSP isolation.
 */
const tenantQuery = require('../utils/tenantQuery');

module.exports = {
  ...tenantQuery,
  fromRequest(req) {
    return tenantQuery.resolveTenantScope(req);
  },
  sqlFilter(scope, column = 'tenant_id') {
    return tenantQuery.tenantWhereClause(scope, column);
  },
};
