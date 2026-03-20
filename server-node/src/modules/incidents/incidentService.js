/**
 * Incident service - correlated alerts
 */
const db = require('../../utils/db');
const crypto = require('crypto');

function generateIncidentId() {
  return 'INC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function list(filters = {}) {
  let sql = `
    SELECT i.*, e.hostname
    FROM incidents i
    LEFT JOIN endpoints e ON e.id = i.endpoint_id
    WHERE 1=1
  `;
  const params = [];
  if (filters.status) {
    sql += ' AND i.status = ?';
    params.push(filters.status);
  }
  if (filters.severity) {
    sql += ' AND i.severity = ?';
    params.push(filters.severity);
  }
  sql += ' ORDER BY i.updated_at DESC LIMIT ? OFFSET ?';
  params.push(Math.min(filters.limit || 50, 200), filters.offset || 0);
  return db.query(sql, params);
}

async function getById(id) {
  const incident = await db.queryOne(
    'SELECT i.*, e.hostname, e.ip_address FROM incidents i LEFT JOIN endpoints e ON e.id = i.endpoint_id WHERE i.id = ?',
    [id]
  );
  if (!incident) return null;
  const alerts = await db.query(
    `SELECT a.* FROM alerts a
     JOIN incident_alert_links ial ON ial.alert_id = a.id
     WHERE ial.incident_id = ?`,
    [id]
  );
  return { ...incident, alerts };
}

async function create(data) {
  const incidentId = generateIncidentId();
  const result = await db.execute(
    `INSERT INTO incidents (incident_id, title, description, severity, status, correlation_type, endpoint_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      incidentId,
      data.title || 'Correlated Incident',
      data.description,
      data.severity || 'medium',
      data.status || 'open',
      data.correlation_type,
      data.endpoint_id,
    ]
  );
  return { id: result.insertId, incident_id: incidentId };
}

async function linkAlert(incidentId, alertId) {
  await db.execute(
    'INSERT IGNORE INTO incident_alert_links (incident_id, alert_id) VALUES (?, ?)',
    [incidentId, alertId]
  );
}

async function updateStatus(id, status) {
  await db.execute('UPDATE incidents SET status = ? WHERE id = ?', [status, id]);
}

module.exports = { list, getById, create, linkAlert, updateStatus };
