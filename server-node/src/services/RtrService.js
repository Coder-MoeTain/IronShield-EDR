/**
 * Real Time Response (RTR) lite — allowlisted shell via response_actions (self-hosted).
 */
const db = require('../utils/db');
const ResponseActionService = require('./ResponseActionService');
const EndpointService = require('./EndpointService');

const DANGEROUS = /[|&;<>$\n\r\x00`]/;

/** Same family as agent RtrShellExecutor — first token must be in this set. */
function validateCommand(cmd) {
  const t = String(cmd || '').trim();
  if (!t || t.length > 480) return { ok: false, error: 'Invalid command length' };
  if (DANGEROUS.test(t)) return { ok: false, error: 'Characters not allowed in RTR command' };
  const first = t.split(/\s+/)[0].toLowerCase().replace(/^cmd\.exe$/i, '');
  const base = first.includes('\\') ? first.split(/[/\\]/).pop() : first;
  const allow = new Set([
    'whoami',
    'hostname',
    'ipconfig',
    'ver',
    'systeminfo',
    'netstat',
    'route',
    'arp',
    'getmac',
    'echo',
  ]);
  if (!allow.has(base)) return { ok: false, error: `Command not in allowlist: ${base}` };
  return { ok: true, text: t };
}

async function assertEndpointTenant(endpointId, tenantId) {
  const ep = await EndpointService.getById(endpointId, tenantId);
  if (!ep) throw new Error('Endpoint not found');
  return ep;
}

async function createSession(endpointId, createdBy, tenantId) {
  await assertEndpointTenant(endpointId, tenantId);
  const r = await db.execute(
    `INSERT INTO rtr_sessions (endpoint_id, created_by, status) VALUES (?, ?, 'active')`,
    [endpointId, createdBy || 'admin']
  );
  const id = r.insertId;
  return typeof id === 'bigint' ? Number(id) : id;
}

async function closeSession(sessionId, tenantId) {
  const row = await db.queryOne(
    `SELECT s.id FROM rtr_sessions s
     JOIN endpoints e ON e.id = s.endpoint_id
     WHERE s.id = ? ${tenantId != null ? 'AND e.tenant_id = ?' : ''}`,
    tenantId != null ? [sessionId, tenantId] : [sessionId]
  );
  if (!row) throw new Error('Session not found');
  await db.execute(`UPDATE rtr_sessions SET status = 'closed', closed_at = NOW() WHERE id = ?`, [sessionId]);
}

async function queueCommand(sessionId, command, requestedBy, tenantId) {
  const session = await db.queryOne(
    `SELECT s.*, e.id AS ep_id FROM rtr_sessions s
     JOIN endpoints e ON e.id = s.endpoint_id
     WHERE s.id = ? AND s.status = 'active' ${tenantId != null ? 'AND e.tenant_id = ?' : ''}`,
    tenantId != null ? [sessionId, tenantId] : [sessionId]
  );
  if (!session) throw new Error('Active session not found');

  const v = validateCommand(command);
  if (!v.ok) {
    const ins = await db.execute(
      `INSERT INTO rtr_session_commands (session_id, command_text, status, error_message, completed_at)
       VALUES (?, ?, 'rejected', ?, NOW())`,
      [sessionId, String(command).substring(0, 512), v.error]
    );
    return { command_id: ins.insertId, status: 'rejected', error: v.error };
  }

  const ins = await db.execute(
    `INSERT INTO rtr_session_commands (session_id, command_text, status) VALUES (?, ?, 'pending')`,
    [sessionId, v.text]
  );
  const commandId = ins.insertId;

  const actionId = await ResponseActionService.create(
    session.endpoint_id,
    'rtr_shell',
    { rtr_command_id: commandId, command: v.text },
    requestedBy || 'admin',
    tenantId
  );

  await db.execute(`UPDATE rtr_session_commands SET response_action_id = ? WHERE id = ?`, [actionId, commandId]);

  return { command_id: commandId, response_action_id: actionId, status: 'pending' };
}

async function completeFromAgent(actionRow, success, result) {
  if (actionRow.action_type !== 'rtr_shell') return;
  let params = actionRow.parameters;
  if (typeof params === 'string') {
    try {
      params = JSON.parse(params);
    } catch {
      params = {};
    }
  }
  const cmdId = params?.rtr_command_id;
  if (!cmdId) return;

  if (success) {
    const stdout = result?.stdout != null ? String(result.stdout) : '';
    const stderr = result?.stderr != null ? String(result.stderr) : '';
    const exitCode = result?.exit_code != null ? Number(result.exit_code) : null;
    await db.execute(
      `UPDATE rtr_session_commands SET status = 'completed', stdout = ?, stderr = ?, exit_code = ?, completed_at = NOW()
       WHERE id = ?`,
      [stdout.substring(0, 65535), stderr.substring(0, 65535), exitCode, cmdId]
    );
  } else {
    await db.execute(
      `UPDATE rtr_session_commands SET status = 'failed', error_message = ?, completed_at = NOW() WHERE id = ?`,
      [String(result?.message || 'failed').substring(0, 512), cmdId]
    );
  }
}

async function listCommands(sessionId, tenantId) {
  const session = await db.queryOne(
    `SELECT s.id FROM rtr_sessions s
     JOIN endpoints e ON e.id = s.endpoint_id
     WHERE s.id = ? ${tenantId != null ? 'AND e.tenant_id = ?' : ''}`,
    tenantId != null ? [sessionId, tenantId] : [sessionId]
  );
  if (!session) return [];
  return db.query(
    `SELECT id, command_text, status, stdout, stderr, exit_code, error_message, created_at, completed_at
     FROM rtr_session_commands WHERE session_id = ? ORDER BY id ASC`,
    [sessionId]
  );
}

async function getSession(sessionId, tenantId) {
  return db.queryOne(
    `SELECT s.*, e.hostname FROM rtr_sessions s
     JOIN endpoints e ON e.id = s.endpoint_id
     WHERE s.id = ? ${tenantId != null ? 'AND e.tenant_id = ?' : ''}`,
    tenantId != null ? [sessionId, tenantId] : [sessionId]
  );
}

module.exports = {
  validateCommand,
  createSession,
  closeSession,
  queueCommand,
  completeFromAgent,
  listCommands,
  getSession,
};
