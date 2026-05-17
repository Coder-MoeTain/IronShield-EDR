const BaseTenantRepository = require('./BaseTenantRepository');
const db = require('../utils/db');

class EventRepository extends BaseTenantRepository {
  async findNormalizedById(id, scope) {
    const tenant = this.tenantClause(scope, 'e.tenant_id');
    return db.queryOne(
      `SELECT ne.* FROM normalized_events ne
       JOIN endpoints e ON e.id = ne.endpoint_id
       WHERE ne.id = ? AND ${tenant.sql}`,
      [id, ...tenant.params]
    );
  }
}

module.exports = new EventRepository();
