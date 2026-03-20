/**
 * Investigation case service
 */
const db = require('../../utils/db');
const crypto = require('crypto');

function generateCaseId() {
  return 'INV-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function list(filters = {}) {
  let sql = `
    SELECT c.*, e.hostname
    FROM investigation_cases c
    LEFT JOIN endpoints e ON e.id = c.endpoint_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.status) {
    sql += ' AND c.status = ?';
    params.push(filters.status);
  }
  if (filters.endpointId) {
    sql += ' AND c.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.assignedTo) {
    sql += ' AND c.assigned_to = ?';
    params.push(filters.assignedTo);
  }

  sql += ' ORDER BY c.updated_at DESC LIMIT ? OFFSET ?';
  params.push(Math.min(filters.limit || 50, 200), filters.offset || 0);

  return db.query(sql, params);
}

async function getById(id) {
  return db.queryOne(
    `SELECT c.*, e.hostname, e.ip_address
     FROM investigation_cases c
     LEFT JOIN endpoints e ON e.id = c.endpoint_id
     WHERE c.id = ?`,
    [id]
  );
}

async function getByCaseId(caseId) {
  return db.queryOne('SELECT * FROM investigation_cases WHERE case_id = ?', [caseId]);
}

async function create(caseData) {
  const caseId = generateCaseId();
  const result = await db.execute(
    `INSERT INTO investigation_cases (case_id, title, description, endpoint_id, created_by, assigned_to, severity, status, related_alert_ids)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      caseId,
      caseData.title,
      caseData.description,
      caseData.endpoint_id,
      caseData.created_by,
      caseData.assigned_to,
      caseData.severity || 'medium',
      caseData.status || 'open',
      caseData.related_alert_ids ? JSON.stringify(caseData.related_alert_ids) : null,
    ]
  );
  return { id: result.insertId, case_id: caseId };
}

async function update(id, updates) {
  const fields = [];
  const values = [];
  const allowed = ['title', 'description', 'assigned_to', 'severity', 'status', 'related_alert_ids'];
  for (const key of allowed) {
    if (updates[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(key === 'related_alert_ids' ? JSON.stringify(updates[key]) : updates[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.execute(`UPDATE investigation_cases SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function addNote(caseId, author, note) {
  await db.execute(
    'INSERT INTO investigation_case_notes (case_id, author, note) VALUES (?, ?, ?)',
    [caseId, author, note]
  );
}

async function getNotes(caseId) {
  return db.query('SELECT * FROM investigation_case_notes WHERE case_id = ? ORDER BY created_at DESC', [caseId]);
}

async function addArtifact(caseId, artifactType, artifactId, artifactData) {
  await db.execute(
    'INSERT INTO investigation_artifacts (case_id, artifact_type, artifact_id, artifact_data) VALUES (?, ?, ?, ?)',
    [caseId, artifactType, artifactId, artifactData ? JSON.stringify(artifactData) : null]
  );
}

async function getArtifacts(caseId) {
  return db.query('SELECT * FROM investigation_artifacts WHERE case_id = ? ORDER BY created_at', [caseId]);
}

module.exports = {
  list,
  getById,
  getByCaseId,
  create,
  update,
  addNote,
  getNotes,
  addArtifact,
  getArtifacts,
};
