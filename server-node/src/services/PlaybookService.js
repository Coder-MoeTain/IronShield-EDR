/**
 * Response playbooks — ordered sequences of response actions (remediation lite)
 */
const db = require('../utils/db');
const ResponseActionService = require('./ResponseActionService');

const ALLOWED_PLAYBOOK_ACTIONS = new Set([
  'kill_process',
  'request_heartbeat',
  'collect_triage',
  'isolate_host',
  'simulate_isolation',
  'lift_isolation',
  'quarantine_file',
  'block_ip',
  'run_script',
  'mark_investigating',
  'rtr_shell',
  'delete_schtask',
  'delete_run_key',
  'delete_path',
]);

function validateSteps(steps) {
  if (!Array.isArray(steps) || steps.length === 0) throw new Error('Playbook has no steps');
  for (const [i, step] of steps.entries()) {
    if (!step?.action_type) throw new Error(`Step ${i + 1}: action_type required`);
    if (!ALLOWED_PLAYBOOK_ACTIONS.has(step.action_type)) {
      throw new Error(`Step ${i + 1}: unsupported action_type ${step.action_type}`);
    }
  }
}

async function list(tenantId = null) {
  let sql = 'SELECT * FROM response_playbooks WHERE 1=1';
  const params = [];
  if (tenantId != null) {
    sql += ' AND (tenant_id IS NULL OR tenant_id = ?)';
    params.push(tenantId);
  }
  sql += ' ORDER BY name ASC';
  try {
    return await db.query(sql, params);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return [];
    throw err;
  }
}

async function getById(id) {
  return db.queryOne('SELECT * FROM response_playbooks WHERE id = ?', [id]);
}

async function create(body, createdBy, tenantId) {
  const name = body?.name;
  const steps = body?.steps ?? body?.steps_json;
  if (!name || !String(name).trim()) throw new Error('name required');
  if (!steps) throw new Error('steps required (array of { action_type, parameters })');
  const parsedSteps = typeof steps === 'string' ? JSON.parse(steps) : steps;
  validateSteps(parsedSteps);
  const stepsJson = JSON.stringify(parsedSteps);
  const result = await db.execute(
    `INSERT INTO response_playbooks (tenant_id, name, description, steps_json, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [
      tenantId ?? null,
      String(name).substring(0, 128),
      body.description ? String(body.description).substring(0, 512) : null,
      stepsJson,
      createdBy || null,
    ]
  );
  return result.insertId;
}

async function remove(id, tenantId) {
  const row = await getById(id);
  if (!row) return false;
  if (tenantId != null && row.tenant_id != null && row.tenant_id !== tenantId) return false;
  await db.execute('DELETE FROM response_playbooks WHERE id = ?', [id]);
  return true;
}

/**
 * Queue each step as a response action on the endpoint (agent executes in order).
 */
async function execute(playbookId, endpointId, requestedBy, tenantId = null) {
  const pb = await getById(playbookId);
  if (!pb) throw new Error('Playbook not found');
  if (tenantId != null && pb.tenant_id != null && pb.tenant_id !== tenantId) {
    throw new Error('Playbook not in tenant scope');
  }
  const ep = await db.queryOne('SELECT id, tenant_id FROM endpoints WHERE id = ?', [endpointId]);
  if (!ep) throw new Error('Endpoint not found');
  if (tenantId != null && ep.tenant_id != null && ep.tenant_id !== tenantId) {
    throw new Error('Endpoint not in tenant scope');
  }

  let steps = pb.steps_json;
  if (typeof steps === 'string') {
    try {
      steps = JSON.parse(steps);
    } catch {
      throw new Error('Invalid playbook steps_json');
    }
  }
  validateSteps(steps);

  const actionIds = [];
  for (const step of steps) {
    if (!step?.action_type) throw new Error('Each step needs action_type');
    const aid = await ResponseActionService.create(
      endpointId,
      step.action_type,
      step.parameters || {},
      requestedBy,
      tenantId
    );
    actionIds.push(aid);
  }
  return { playbook_id: playbookId, endpoint_id: endpointId, action_ids: actionIds };
}

module.exports = { list, getById, create, remove, execute, validateSteps, ALLOWED_PLAYBOOK_ACTIONS };
