/**
 * Incident service — correlated alerts, lifecycle workflow, tenant isolation.
 */
const db = require('../../utils/db');
const crypto = require('crypto');

const LIFECYCLE_PHASES = [
  'new',
  'triage',
  'investigation',
  'containment',
  'eradication',
  'recovery',
  'closed',
];

function generateIncidentId() {
  return 'INC-' + crypto.randomBytes(4).toString('hex').toUpperCase();
}

async function addTimeline(incidentId, eventType, message, actor = null, metadata = null) {
  try {
    await db.execute(
      `INSERT INTO incident_timeline (incident_id, event_type, message, actor, metadata_json)
       VALUES (?, ?, ?, ?, ?)`,
      [
        incidentId,
        eventType,
        message,
        actor,
        metadata ? JSON.stringify(metadata) : null,
      ]
    );
  } catch (err) {
    if (!['ER_NO_SUCH_TABLE', 'ER_BAD_TABLE_ERROR'].includes(String(err?.code || ''))) throw err;
  }
}

async function list(filters = {}) {
  let where = 'WHERE 1=1';
  const params = [];
  if (filters.tenantId != null) {
    where += ' AND (i.tenant_id = ? OR (i.tenant_id IS NULL AND e.tenant_id = ?))';
    params.push(filters.tenantId, filters.tenantId);
  }
  if (filters.status) {
    where += ' AND i.status = ?';
    params.push(filters.status);
  }
  if (filters.lifecycle_phase) {
    where += ' AND i.lifecycle_phase = ?';
    params.push(filters.lifecycle_phase);
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

async function getById(id, tenantId = null) {
  let sql = `
    SELECT i.*, e.hostname, e.ip_address, e.tenant_id AS endpoint_tenant_id
    FROM incidents i
    LEFT JOIN endpoints e ON e.id = i.endpoint_id
    WHERE i.id = ?
  `;
  const params = [id];
  if (tenantId != null) {
    sql += ' AND (i.tenant_id = ? OR (i.tenant_id IS NULL AND e.tenant_id = ?))';
    params.push(tenantId, tenantId);
  }
  const incident = await db.queryOne(sql, params);
  if (!incident) return null;

  const alerts = await db.query(
    `SELECT a.* FROM alerts a
     JOIN incident_alert_links ial ON ial.alert_id = a.id
     WHERE ial.incident_id = ?`,
    [id]
  );

  let timeline = [];
  let notes = [];
  try {
    timeline = await db.query(
      'SELECT * FROM incident_timeline WHERE incident_id = ? ORDER BY created_at ASC',
      [id]
    );
  } catch {
    timeline = [];
  }
  try {
    notes = await db.query(
      'SELECT * FROM incident_notes WHERE incident_id = ? ORDER BY created_at ASC',
      [id]
    );
  } catch {
    notes = [];
  }

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
  } catch {
    xdr_events = [];
  }
  return { ...incident, alerts, timeline, notes, xdr_events };
}

async function create(data) {
  const incidentId = generateIncidentId();
  const phase = data.lifecycle_phase || 'triage';
  let result;
  try {
    result = await db.execute(
      `INSERT INTO incidents (incident_id, title, description, severity, status, lifecycle_phase, correlation_type, endpoint_id, tenant_id)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        incidentId,
        data.title || 'Correlated Incident',
        data.description,
        data.severity || 'medium',
        data.status || 'open',
        phase,
        data.correlation_type,
        data.endpoint_id,
        data.tenant_id ?? null,
      ]
    );
  } catch (err) {
    if (err.code !== 'ER_BAD_FIELD_ERROR') throw err;
    result = await db.execute(
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
  }
  const id = result.insertId;
  await addTimeline(id, 'created', 'Incident created', data.created_by || 'system', { incident_id: incidentId });
  return { id, incident_id: incidentId };
}

async function linkAlert(incidentId, alertId, actor = null) {
  await db.execute(
    'INSERT IGNORE INTO incident_alert_links (incident_id, alert_id) VALUES (?, ?)',
    [incidentId, alertId]
  );
  await addTimeline(incidentId, 'alert_linked', `Alert #${alertId} linked`, actor);
}

async function linkXdrEvent(incidentId, xdrEventId) {
  await db.execute(
    'INSERT IGNORE INTO incident_xdr_event_links (incident_id, xdr_event_id) VALUES (?, ?)',
    [incidentId, xdrEventId]
  );
}

async function addNote(incidentId, body, author, tenantId = null) {
  const inc = await getById(incidentId, tenantId);
  if (!inc) throw new Error('Incident not found');
  const r = await db.execute(
    'INSERT INTO incident_notes (incident_id, author, body) VALUES (?, ?, ?)',
    [incidentId, author || 'analyst', String(body).substring(0, 16000)]
  );
  await addTimeline(incidentId, 'note_added', 'Analyst note added', author);
  return r.insertId;
}

async function setLifecyclePhase(id, phase, actor = null, tenantId = null) {
  if (!LIFECYCLE_PHASES.includes(phase)) {
    throw new Error(`Invalid lifecycle phase: ${phase}`);
  }
  const inc = await getById(id, tenantId);
  if (!inc) throw new Error('Incident not found');
  const statusMap = {
    triage: 'open',
    investigation: 'investigating',
    containment: 'investigating',
    eradication: 'investigating',
    recovery: 'resolved',
    closed: 'closed',
  };
  await db.execute('UPDATE incidents SET lifecycle_phase = ?, status = ? WHERE id = ?', [
    phase,
    statusMap[phase] || inc.status,
    id,
  ]);
  if (phase === 'closed') {
    await db.execute('UPDATE incidents SET closed_at = NOW() WHERE id = ?', [id]);
  }
  if (phase === 'recovery') {
    await db.execute('UPDATE incidents SET resolved_at = NOW() WHERE id = ?', [id]);
  }
  await addTimeline(id, 'lifecycle', `Phase → ${phase}`, actor, { phase });
}

async function updateStatus(id, status) {
  if (status === 'investigating') {
    await db.execute(
      'UPDATE incidents SET status = ?, lifecycle_phase = COALESCE(lifecycle_phase, "investigation"), first_ack_at = COALESCE(first_ack_at, NOW()) WHERE id = ?',
      [status, id]
    );
    return;
  }
  if (status === 'resolved') {
    await db.execute(
      'UPDATE incidents SET status = ?, lifecycle_phase = "recovery", resolved_at = NOW() WHERE id = ?',
      [status, id]
    );
    return;
  }
  if (status === 'closed') {
    await db.execute(
      'UPDATE incidents SET status = ?, lifecycle_phase = "closed", closed_at = NOW() WHERE id = ?',
      [status, id]
    );
    return;
  }
  await db.execute('UPDATE incidents SET status = ? WHERE id = ?', [status, id]);
}

async function updateWorkflow(id, patch = {}, tenantId = null) {
  const inc = await getById(id, tenantId);
  if (!inc) throw new Error('Incident not found');
  const sets = [];
  const params = [];
  if (patch.status) {
    sets.push('status = ?');
    params.push(patch.status);
    if (patch.status === 'investigating') sets.push('first_ack_at = COALESCE(first_ack_at, NOW())');
    if (patch.status === 'resolved') sets.push('resolved_at = NOW()');
    if (patch.status === 'closed') sets.push('closed_at = NOW()');
  }
  if (patch.lifecycle_phase) {
    sets.push('lifecycle_phase = ?');
    params.push(patch.lifecycle_phase);
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

async function exportIncident(id, format = 'json', tenantId = null) {
  const data = await getById(id, tenantId);
  if (!data) return null;
  if (format === 'json') {
    return JSON.stringify(data, null, 2);
  }
  if (format === 'html') {
    const esc = (s) =>
      String(s ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${esc(data.incident_id)}</title></head><body>
<h1>${esc(data.title)}</h1>
<p><strong>ID:</strong> ${esc(data.incident_id)} · <strong>Phase:</strong> ${esc(data.lifecycle_phase)} · <strong>Severity:</strong> ${esc(data.severity)}</p>
<h2>Alerts (${data.alerts?.length || 0})</h2>
<ul>${(data.alerts || []).map((a) => `<li>#${a.id} ${esc(a.title)} (${esc(a.severity)})</li>`).join('')}</ul>
<h2>Timeline</h2>
<ul>${(data.timeline || []).map((t) => `<li>${esc(t.created_at)} — ${esc(t.event_type)}: ${esc(t.message)}</li>`).join('')}</ul>
<h2>Notes</h2>
${(data.notes || []).map((n) => `<p><strong>${esc(n.author)}</strong> (${esc(n.created_at)}): ${esc(n.body)}</p>`).join('')}
</body></html>`;
  }
  return JSON.stringify(data);
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

/** Link endpoint software inventory to an incident (evidence + timeline). */
async function linkSoftwareInventory(incidentId, softwareInventoryId, actor = null, meta = {}) {
  const inv = await db.queryOne(
    `SELECT esi.id, esi.name, esi.version, esi.vendor, esi.endpoint_id, e.hostname
     FROM endpoint_software_inventory esi
     LEFT JOIN endpoints e ON e.id = esi.endpoint_id
     WHERE esi.id = ?`,
    [softwareInventoryId]
  );
  if (!inv) return null;

  const storageUri = `software://inventory/${softwareInventoryId}`;
  let evidenceId = null;
  try {
    evidenceId = await addEvidence(incidentId, {
      evidence_type: 'software_inventory',
      storage_uri: storageUri,
      collected_by: actor || 'system',
      custody_note: `Software risk: ${inv.name} ${inv.version || ''} on ${inv.hostname || inv.endpoint_id}`,
    });
  } catch {
    /* evidence table optional on older schemas */
  }

  await addTimeline(
    incidentId,
    'software_linked',
    `Software inventory linked: ${inv.name} ${inv.version || ''}`,
    actor,
    {
      software_inventory_id: softwareInventoryId,
      endpoint_id: inv.endpoint_id,
      ...meta,
    }
  );

  return { software_inventory_id: softwareInventoryId, evidence_id: evidenceId, inventory: inv };
}

module.exports = {
  LIFECYCLE_PHASES,
  list,
  getById,
  create,
  linkAlert,
  linkXdrEvent,
  addNote,
  setLifecyclePhase,
  updateStatus,
  updateWorkflow,
  exportIncident,
  listEvidence,
  addEvidence,
  addTimeline,
  linkSoftwareInventory,
};
