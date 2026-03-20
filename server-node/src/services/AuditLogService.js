/**
 * Audit log service
 */
const db = require('../utils/db');

async function log(payload) {
  const {
    userId,
    username,
    action,
    resourceType,
    resourceId,
    details,
    ipAddress,
    userAgent,
  } = payload;

  await db.query(
    `INSERT INTO audit_logs (user_id, username, action, resource_type, resource_id, details, ip_address, user_agent)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      userId || null,
      username ? String(username).substring(0, 128) : null,
      String(action).substring(0, 128),
      resourceType ? String(resourceType).substring(0, 64) : null,
      resourceId ? String(resourceId).substring(0, 64) : null,
      details ? JSON.stringify(details) : null,
      ipAddress ? String(ipAddress).substring(0, 45) : null,
      userAgent ? String(userAgent).substring(0, 512) : null,
    ]
  );
}

async function list(filters = {}) {
  let sql = 'SELECT * FROM audit_logs WHERE 1=1';
  const params = [];

  if (filters.userId) {
    sql += ' AND user_id = ?';
    params.push(filters.userId);
  }
  if (filters.action) {
    sql += ' AND action LIKE ?';
    params.push(`%${filters.action}%`);
  }

  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(Math.min(filters.limit || 100, 500), filters.offset || 0);

  return db.query(sql, params);
}

module.exports = { log, list };
