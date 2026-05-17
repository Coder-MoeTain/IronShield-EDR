/**
 * Base repository with mandatory tenant scope helpers.
 */
const db = require('../utils/db');
const TenantContextService = require('../services/TenantContextService');

class BaseTenantRepository {
  scopeFromReq(req) {
    return TenantContextService.fromRequest(req);
  }

  tenantClause(scope, column = 'tenant_id') {
    return TenantContextService.sqlFilter(scope, column);
  }

  assertRow(scope, row, column = 'tenant_id') {
    TenantContextService.assertTenantAccess(scope, row?.[column] ?? row?.tenantId);
    return row;
  }

  async query(sql, params = []) {
    return db.query(sql, params);
  }

  async queryOne(sql, params = []) {
    return db.queryOne(sql, params);
  }
}

module.exports = BaseTenantRepository;
