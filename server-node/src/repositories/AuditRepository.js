const BaseTenantRepository = require('./BaseTenantRepository');
const db = require('../utils/db');

class AuditRepository extends BaseTenantRepository {
  async list(scope, { limit = 100, offset = 0 } = {}) {
    const tenant = this.tenantClause(scope, 'tenant_id');
    return db.query(
      `SELECT * FROM audit_logs WHERE ${tenant.sql} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...tenant.params, limit, offset]
    );
  }
}

module.exports = new AuditRepository();
