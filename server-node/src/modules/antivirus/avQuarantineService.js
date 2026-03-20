/**
 * Antivirus quarantine service
 */
const db = require('../../utils/db');

async function list(filters = {}) {
  let sql = `
    SELECT q.*, e.hostname
    FROM av_quarantine_items q
    JOIN endpoints e ON e.id = q.endpoint_id
    WHERE 1=1
  `;
  const params = [];
  if (filters.endpointId) {
    sql += ' AND q.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.status) {
    sql += ' AND q.status = ?';
    params.push(filters.status);
  }
  sql += ' ORDER BY q.created_at DESC LIMIT ?';
  params.push(Math.min(parseInt(filters.limit) || 50, 200));
  return db.query(sql, params);
}

async function getById(id) {
  return db.queryOne(
    `SELECT q.*, e.hostname FROM av_quarantine_items q
     JOIN endpoints e ON e.id = q.endpoint_id WHERE q.id = ?`,
    [id]
  );
}

async function create(endpointId, data) {
  const result = await db.execute(
    `INSERT INTO av_quarantine_items (endpoint_id, original_path, quarantine_path, sha256, detection_name, quarantined_by, status)
     VALUES (?, ?, ?, ?, ?, ?, 'quarantined')`,
    [
      endpointId,
      data.original_path || '',
      data.quarantine_path || '',
      data.sha256 || null,
      data.detection_name || null,
      data.quarantined_by || 'agent',
    ]
  );
  return result.insertId;
}

async function requestRestore(id, requestedBy) {
  await db.execute(
    'UPDATE av_quarantine_items SET restore_requested_by = ?, updated_at = NOW() WHERE id = ? AND status = ?',
    [requestedBy, id, 'quarantined']
  );
  return db.queryOne('SELECT * FROM av_quarantine_items WHERE id = ?', [id]);
}

async function markRestored(id, restoredBy) {
  await db.execute(
    "UPDATE av_quarantine_items SET status = 'restored', restored_by = ?, restored_at = NOW(), updated_at = NOW() WHERE id = ?",
    [restoredBy, id]
  );
  return db.queryOne('SELECT * FROM av_quarantine_items WHERE id = ?', [id]);
}

async function markDeleted(id, deletedBy) {
  await db.execute(
    "UPDATE av_quarantine_items SET status = 'deleted', deleted_by = ?, deleted_at = NOW(), updated_at = NOW() WHERE id = ?",
    [deletedBy, id]
  );
  return db.queryOne('SELECT * FROM av_quarantine_items WHERE id = ?', [id]);
}

module.exports = {
  list,
  getById,
  create,
  requestRestore,
  markRestored,
  markDeleted,
};
