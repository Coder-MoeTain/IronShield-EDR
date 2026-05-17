const BaseTenantRepository = require('./BaseTenantRepository');
const db = require('../utils/db');
const TenantContextService = require('../services/TenantContextService');

class EndpointRepository extends BaseTenantRepository {
  async findById(id, scope) {
    const tenant = this.tenantClause(scope, 'e.tenant_id');
    const row = await db.queryOne(
      `SELECT e.* FROM endpoints e WHERE e.id = ? AND ${tenant.sql}`,
      [id, ...tenant.params]
    );
    if (row) this.assertRow(scope, row, 'tenant_id');
    return row;
  }

  async list(scope, { limit = 100, offset = 0 } = {}) {
    const tenant = this.tenantClause(scope, 'tenant_id');
    return db.query(
      `SELECT * FROM endpoints WHERE ${tenant.sql} ORDER BY last_seen_at DESC LIMIT ? OFFSET ?`,
      [...tenant.params, limit, offset]
    );
  }
}

module.exports = new EndpointRepository();
