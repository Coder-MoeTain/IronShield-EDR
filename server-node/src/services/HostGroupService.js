/**
 * Host groups — Falcon-style sensor grouping for policies and reporting
 */
const db = require('../utils/db');

async function list(tenantId = null) {
  let sql = 'SELECT * FROM host_groups WHERE 1=1';
  const params = [];
  if (tenantId != null) {
    sql += ' AND (tenant_id IS NULL OR tenant_id = ?)';
    params.push(tenantId);
  }
  sql += ' ORDER BY name ASC';
  return db.query(sql, params);
}

async function getById(id) {
  return db.queryOne('SELECT * FROM host_groups WHERE id = ?', [id]);
}

async function create({ name, description, tenantId }) {
  if (!name || !String(name).trim()) throw new Error('name required');
  const result = await db.execute(
    'INSERT INTO host_groups (tenant_id, name, description) VALUES (?, ?, ?)',
    [tenantId ?? null, String(name).trim().substring(0, 128), description ? String(description).substring(0, 512) : null]
  );
  return result.insertId;
}

async function update(id, { name, description }, tenantId) {
  const row = await getById(id);
  if (!row) return false;
  if (tenantId != null && row.tenant_id != null && row.tenant_id !== tenantId) return false;
  const n = name !== undefined ? String(name).trim().substring(0, 128) : row.name;
  const d =
    description !== undefined ? (description ? String(description).substring(0, 512) : null) : row.description;
  await db.query('UPDATE host_groups SET name = ?, description = ? WHERE id = ?', [n, d, id]);
  return true;
}

async function remove(id, tenantId) {
  const row = await getById(id);
  if (!row) return false;
  if (tenantId != null && row.tenant_id != null && row.tenant_id !== tenantId) return false;
  await db.execute('DELETE FROM host_groups WHERE id = ?', [id]);
  return true;
}

module.exports = { list, getById, create, update, remove };
