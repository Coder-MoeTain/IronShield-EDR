const db = require('../utils/db');

async function getXdrEventById(id) {
  return db.queryOne('SELECT * FROM xdr_events WHERE id = ?', [id]);
}

module.exports = { getXdrEventById };

