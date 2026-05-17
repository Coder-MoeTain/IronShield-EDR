const BaseTenantRepository = require('./BaseTenantRepository');
const db = require('../utils/db');

class AlertRepository extends BaseTenantRepository {
  async findById(id, scope) {
    const tenant = this.tenantClause(scope, 'a.tenant_id');
    const row = await db.queryOne(
      `SELECT a.* FROM alerts a WHERE a.id = ? AND ${tenant.sql}`,
      [id, ...tenant.params]
    );
    if (row) this.assertRow(scope, row, 'tenant_id');
    return row;
  }
}

module.exports = new AlertRepository();
