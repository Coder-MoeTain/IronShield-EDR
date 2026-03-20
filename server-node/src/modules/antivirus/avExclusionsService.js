/**
 * Antivirus exclusions service - path, hash, process, signer, extension
 */
const db = require('../../utils/db');

async function list(filters = {}) {
  let sql = 'SELECT * FROM av_exclusions WHERE 1=1';
  const params = [];
  if (filters.tenantId != null) {
    sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    params.push(filters.tenantId);
  }
  if (filters.exclusionType) {
    sql += ' AND exclusion_type = ?';
    params.push(filters.exclusionType);
  }
  if (filters.policyId != null) {
    sql += ' AND (policy_id = ? OR policy_id IS NULL)';
    params.push(filters.policyId);
  }
  sql += ' ORDER BY exclusion_type, value';
  const limit = Math.min(parseInt(filters.limit) || 100, 500);
  sql += ' LIMIT ?';
  params.push(limit);
  return db.query(sql, params);
}

async function getById(id) {
  return db.queryOne('SELECT * FROM av_exclusions WHERE id = ?', [id]);
}

async function create(data, tenantId = null, createdBy = 'system') {
  const result = await db.execute(
    `INSERT INTO av_exclusions (tenant_id, exclusion_type, value, reason, policy_id, created_by, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId,
      data.exclusion_type || 'path',
      data.value || '',
      data.reason || null,
      data.policy_id || null,
      createdBy,
      data.expires_at || null,
    ]
  );
  return result.insertId;
}

async function update(id, data) {
  await db.execute(
    `UPDATE av_exclusions SET
      exclusion_type = COALESCE(?, exclusion_type),
      value = COALESCE(?, value),
      reason = COALESCE(?, reason),
      policy_id = COALESCE(?, policy_id),
      expires_at = COALESCE(?, expires_at)
    WHERE id = ?`,
    [
      data.exclusion_type,
      data.value,
      data.reason,
      data.policy_id,
      data.expires_at,
      id,
    ]
  );
  return getById(id);
}

async function remove(id) {
  await db.execute('DELETE FROM av_exclusions WHERE id = ?', [id]);
  return true;
}

async function getActiveForPolicy(policyId, tenantId = null) {
  let sql = `SELECT * FROM av_exclusions
    WHERE (policy_id = ? OR policy_id IS NULL)
    AND (expires_at IS NULL OR expires_at > NOW())`;
  const params = [policyId];
  if (tenantId != null) {
    sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    params.push(tenantId);
  }
  return db.query(sql, params);
}

module.exports = {
  list,
  getById,
  create,
  update,
  remove,
  getActiveForPolicy,
};
