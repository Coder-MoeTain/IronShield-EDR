const db = require('../utils/db');

class UserRepository {
  async findById(id) {
    return db.queryOne('SELECT * FROM admin_users WHERE id = ?', [id]);
  }

  async findByEmail(email) {
    return db.queryOne('SELECT * FROM admin_users WHERE email = ?', [email]);
  }
}

module.exports = new UserRepository();
