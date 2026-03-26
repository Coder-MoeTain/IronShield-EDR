/**
 * User-saved filter views (detections / hosts)
 */
const db = require('../utils/db');

async function list(userId, page) {
  if (!userId) return [];
  let sql = 'SELECT id, name, page, filters_json, created_at FROM user_saved_views WHERE user_id = ?';
  const params = [userId];
  if (page) {
    sql += ' AND page = ?';
    params.push(page);
  }
  sql += ' ORDER BY updated_at DESC LIMIT 50';
  try {
    return await db.query(sql, params);
  } catch (e) {
    // Allow dashboard to work even when migration hasn't been run yet.
    if (e?.code === 'ER_NO_SUCH_TABLE') return [];
    throw e;
  }
}

async function create(userId, body) {
  if (!userId) throw new Error('user required');
  const { name, page, filters } = body || {};
  if (!name || !page) throw new Error('name and page required');
  const filtersJson = typeof filters === 'object' ? JSON.stringify(filters) : filters || '{}';
  try {
    const result = await db.execute(
      'INSERT INTO user_saved_views (user_id, name, page, filters_json) VALUES (?, ?, ?, ?)',
      [userId, String(name).substring(0, 128), String(page).substring(0, 64), filtersJson]
    );
    return result.insertId;
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') throw new Error('Saved views not initialized. Run migrate-user-saved-views.');
    throw e;
  }
}

async function remove(userId, id) {
  try {
    const r = await db.execute('DELETE FROM user_saved_views WHERE id = ? AND user_id = ?', [id, userId]);
    return r.affectedRows > 0;
  } catch (e) {
    if (e?.code === 'ER_NO_SUCH_TABLE') return false;
    throw e;
  }
}

module.exports = { list, create, remove };
