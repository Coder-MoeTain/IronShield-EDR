const BaseTenantRepository = require('./BaseTenantRepository');
const db = require('../utils/db');

class SoftwareRepository extends BaseTenantRepository {
  async findInventoryById(id, scope) {
    const tenant = this.tenantClause(scope, 'esi.tenant_id');
    const row = await db.queryOne(
      `SELECT esi.* FROM endpoint_software_inventory esi WHERE esi.id = ? AND ${tenant.sql}`,
      [id, ...tenant.params]
    );
    if (row) this.assertRow(scope, row, 'tenant_id');
    return row;
  }
}

module.exports = new SoftwareRepository();
