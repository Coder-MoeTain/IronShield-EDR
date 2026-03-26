/**
 * Endpoint policy service
 */
const db = require('../../utils/db');

async function list() {
  try {
    return await db.query('SELECT * FROM endpoint_policies ORDER BY name');
  } catch (err) {
    if (err && err.code === 'ER_BAD_FIELD_ERROR') {
      return db.query('SELECT * FROM endpoint_policies ORDER BY id');
    }
    throw err;
  }
}

async function getById(id) {
  return db.queryOne('SELECT * FROM endpoint_policies WHERE id = ?', [id]);
}

async function getDefault() {
  return db.queryOne('SELECT * FROM endpoint_policies WHERE is_default = 1 LIMIT 1');
}

async function create(policy) {
  const result = await db.execute(
    `INSERT INTO endpoint_policies (name, mode, description, telemetry_interval_seconds, batch_upload_size,
     heartbeat_interval_minutes, poll_interval_seconds, allowed_response_actions, allowed_triage_modules,
     detection_sensitivity, isolation_behavior, is_default)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      policy.name,
      policy.mode || 'monitor_and_alert',
      policy.description,
      policy.telemetry_interval_seconds ?? 30,
      policy.batch_upload_size ?? 100,
      policy.heartbeat_interval_minutes ?? 5,
      policy.poll_interval_seconds ?? 60,
      policy.allowed_response_actions ? JSON.stringify(policy.allowed_response_actions) : null,
      policy.allowed_triage_modules ? JSON.stringify(policy.allowed_triage_modules) : null,
      policy.detection_sensitivity || 'medium',
      policy.isolation_behavior || 'log_only',
      policy.is_default ? 1 : 0,
    ]
  );
  return result.insertId;
}

async function update(id, policy) {
  const fields = [];
  const values = [];
  const allowed = ['name', 'mode', 'description', 'telemetry_interval_seconds', 'batch_upload_size',
    'heartbeat_interval_minutes', 'poll_interval_seconds', 'allowed_response_actions', 'allowed_triage_modules',
    'detection_sensitivity', 'isolation_behavior', 'is_default'];
  for (const key of allowed) {
    if (policy[key] !== undefined) {
      fields.push(`${key} = ?`);
      values.push(key.includes('_actions') || key.includes('_modules') ? JSON.stringify(policy[key]) : policy[key]);
    }
  }
  if (fields.length === 0) return;
  values.push(id);
  await db.execute(`UPDATE endpoint_policies SET ${fields.join(', ')} WHERE id = ?`, values);
}

async function getForEndpoint(endpointId) {
  const assignment = await db.queryOne(
    'SELECT p.* FROM endpoint_policy_assignments a JOIN endpoint_policies p ON p.id = a.policy_id WHERE a.endpoint_id = ?',
    [endpointId]
  );
  if (assignment) return assignment;
  return getDefault();
}

async function assignPolicy(endpointId, policyId, assignedBy) {
  const prev = await db.queryOne('SELECT policy_id FROM endpoint_policy_assignments WHERE endpoint_id = ?', [endpointId]);
  await db.execute(
    `INSERT INTO endpoint_policy_assignments (endpoint_id, policy_id, assigned_by)
     VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE policy_id = VALUES(policy_id), assigned_by = VALUES(assigned_by)`,
    [endpointId, policyId, assignedBy]
  );
  await db.execute(
    'INSERT INTO endpoint_policy_history (endpoint_id, policy_id, previous_policy_id, changed_by) VALUES (?, ?, ?, ?)',
    [endpointId, policyId, prev?.policy_id || null, assignedBy]
  );
  await db.execute('UPDATE endpoints SET assigned_policy_id = ? WHERE id = ?', [policyId, endpointId]);
}

async function getAssignment(endpointId) {
  return db.queryOne(
    'SELECT a.*, p.name as policy_name, p.mode FROM endpoint_policy_assignments a JOIN endpoint_policies p ON p.id = a.policy_id WHERE a.endpoint_id = ?',
    [endpointId]
  );
}

module.exports = {
  list,
  getById,
  getDefault,
  getForEndpoint,
  create,
  update,
  assignPolicy,
  getAssignment,
};
