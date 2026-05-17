const db = require('../utils/db');

class TenantRepository {
  async findById(id) {
    return db.queryOne('SELECT * FROM tenants WHERE id = ?', [id]);
  }

  async findBySlug(slug) {
    return db.queryOne('SELECT * FROM tenants WHERE slug = ?', [slug]);
  }
}

module.exports = new TenantRepository();
