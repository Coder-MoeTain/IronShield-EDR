/**
 * Incident service - correlated alerts
 */
const db = require('../../utils/db');
const crypto = require('crypto');

function generateIncidentId() {
  return 'INC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function list(filters = {}) {
  let where = 'WHERE 1=1';
  const params = [];
  if (filters.status) {
    where += ' AND i.status = ?';
    params.push(filters.status);
  }
  if (filters.severity) {
    where += ' AND i.severity = ?';
    params.push(filters.severity);
  }
  if (String(filters.sla_breached || '') === 'true') {
    where += " AND i.due_at IS NOT NULL AND i.due_at < NOW() AND i.status IN ('open','investigating')";
  }
  if (filters.owner) {
    where += ' AND i.owner_username = ?';
    params.push(filters.owner);
  }

  const limit = Math.min(parseInt(String(filters.limit), 10) || 50, 200);
  const offset = Math.max(parseInt(String(filters.offset), 10) || 0, 0);

  const from = `
    FROM incidents i
    LEFT JOIN endpoints e ON e.id = i.endpoint_id
  `;
  const countRows = await db.query(`SELECT COUNT(*) AS c ${from} ${where}`, params);
  const total = Number(countRows?.[0]?.c ?? 0);

  const sql = `
    SELECT i.*, e.hostname
    ${from}
    ${where}
    ORDER BY i.updated_at DESC LIMIT ? OFFSET ?
  `;
  const rows = await db.query(sql, [...params, limit, offset]);
  return { rows, total };
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
  let xdr_events = [];
  try {
    xdr_events = await db.query(
      `SELECT xe.* FROM xdr_events xe
       JOIN incident_xdr_event_links ixl ON ixl.xdr_event_id = xe.id
       WHERE ixl.incident_id = ?
       ORDER BY xe.timestamp ASC
       LIMIT 500`,
      [id]
    );
  } catch (_) {
    xdr_events = [];
  }
  return { ...incident, alerts, xdr_events };
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

async function linkXdrEvent(incidentId, xdrEventId) {
  await db.execute(
    'INSERT IGNORE INTO incident_xdr_event_links (incident_id, xdr_event_id) VALUES (?, ?)',
    [incidentId, xdrEventId]
  );
}

async function updateStatus(id, status) {
  if (status === 'investigating') {
    await db.execute(
      'UPDATE incidents SET status = ?, first_ack_at = COALESCE(first_ack_at, NOW()) WHERE id = ?',
      [status, id]
    );
    return;
  }
  if (status === 'resolved') {
    await db.execute('UPDATE incidents SET status = ?, resolved_at = NOW() WHERE id = ?', [status, id]);
    return;
  }
  if (status === 'closed') {
    await db.execute('UPDATE incidents SET status = ?, closed_at = NOW() WHERE id = ?', [status, id]);
    return;
  }
  await db.execute('UPDATE incidents SET status = ? WHERE id = ?', [status, id]);
}

async function updateWorkflow(id, patch = {}) {
  const sets = [];
  const params = [];
  if (patch.status) {
    sets.push('status = ?');
    params.push(patch.status);
    if (patch.status === 'investigating') sets.push('first_ack_at = COALESCE(first_ack_at, NOW())');
    if (patch.status === 'resolved') sets.push('resolved_at = NOW()');
    if (patch.status === 'closed') sets.push('closed_at = NOW()');
  }
  if (patch.owner_user_id !== undefined) {
    sets.push('owner_user_id = ?');
    params.push(patch.owner_user_id || null);
  }
  if (patch.owner_username !== undefined) {
    sets.push('owner_username = ?');
    params.push(patch.owner_username || null);
  }
  if (patch.sla_minutes !== undefined) {
    sets.push('sla_minutes = ?');
    params.push(patch.sla_minutes || 240);
  }
  if (patch.due_at !== undefined) {
    sets.push('due_at = ?');
    params.push(patch.due_at || null);
  }
  if (sets.length === 0) return;
  params.push(id);
  await db.execute(`UPDATE incidents SET ${sets.join(', ')} WHERE id = ?`, params);
}

async function listEvidence(incidentId) {
  return db.query(
    'SELECT * FROM incident_evidence WHERE incident_id = ? ORDER BY collected_at DESC LIMIT 200',
    [incidentId]
  );
}

async function addEvidence(incidentId, evidence) {
  const result = await db.execute(
    `INSERT INTO incident_evidence
      (incident_id, evidence_type, storage_uri, sha256, size_bytes, collected_by, custody_note)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      incidentId,
      evidence.evidence_type || 'other',
      evidence.storage_uri,
      evidence.sha256 || null,
      evidence.size_bytes || null,
      evidence.collected_by,
      evidence.custody_note || null,
    ]
  );
  return result.insertId;
}

module.exports = { list, getById, create, linkAlert, linkXdrEvent, updateStatus, updateWorkflow, listEvidence, addEvidence };
