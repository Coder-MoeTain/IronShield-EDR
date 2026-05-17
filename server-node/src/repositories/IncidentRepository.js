const BaseTenantRepository = require('./BaseTenantRepository');
const db = require('../utils/db');

class IncidentRepository extends BaseTenantRepository {
  async findById(id, scope) {
    const tenant = this.tenantClause(scope, 'i.tenant_id');
    const row = await db.queryOne(
      `SELECT i.* FROM incidents i WHERE i.id = ? AND ${tenant.sql}`,
      [id, ...tenant.params]
    );
    if (row) this.assertRow(scope, row, 'tenant_id');
    return row;
  }
}

module.exports = new IncidentRepository();
