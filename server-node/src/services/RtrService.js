/**
 * Real Time Response (RTR) — hardened allowlisted shell via response_actions.
 * Disabled by default; requires tenant + endpoint policy; audited transcripts.
 */
const db = require('../utils/db');
const config = require('../config');
const ResponseActionService = require('./ResponseActionService');
const EndpointService = require('./EndpointService');
const AuditLogService = require('./AuditLogService');

const DANGEROUS = /[|&;<>$\n\r\x00`]/;
const HIGH_RISK = new Set(['systeminfo', 'netstat']);
const MAX_OUTPUT = config.rtr?.maxOutputBytes ?? 65536;
const SESSION_TTL_MS = (config.rtr?.sessionTimeoutMinutes ?? 30) * 60 * 1000;
const COMMAND_TIMEOUT_MS = (config.rtr?.commandTimeoutSeconds ?? 120) * 1000;

function isRtrGloballyEnabled() {
  return config.rtr?.enabled === true;
}

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
  return { ok: true, text: t, base, highRisk: HIGH_RISK.has(base) };
}

async function assertRtrAllowed(endpointId, tenantId) {
  if (!isRtrGloballyEnabled()) {
    throw Object.assign(new Error('RTR is disabled on this server'), { statusCode: 403, code: 'RTR_DISABLED' });
  }

  const ep = await EndpointService.getById(endpointId, tenantId);
  if (!ep) throw new Error('Endpoint not found');

  if (ep.rtr_allowed !== 1 && ep.rtr_allowed !== true) {
    throw Object.assign(new Error('RTR not enabled for this endpoint'), { statusCode: 403, code: 'RTR_ENDPOINT_DISABLED' });
  }

  if (tenantId != null) {
    const tenant = await db.queryOne(
      'SELECT rtr_enabled, rtr_emergency_disabled FROM tenants WHERE id = ? LIMIT 1',
      [tenantId]
    );
    if (tenant?.rtr_emergency_disabled === 1 || tenant?.rtr_emergency_disabled === true) {
      throw Object.assign(new Error('RTR emergency-disabled for tenant'), {
        statusCode: 403,
        code: 'RTR_EMERGENCY_DISABLED',
      });
    }
    if (tenant && tenant.rtr_enabled !== 1 && tenant.rtr_enabled !== true) {
      throw Object.assign(new Error('RTR not enabled for tenant'), { statusCode: 403, code: 'RTR_TENANT_DISABLED' });
    }
  }

  return ep;
}

async function assertEndpointTenant(endpointId, tenantId) {
  return assertRtrAllowed(endpointId, tenantId);
}

async function appendTranscript(sessionId, entry) {
  try {
    const row = await db.queryOne('SELECT transcript_json FROM rtr_sessions WHERE id = ?', [sessionId]);
    let arr = [];
    if (row?.transcript_json) {
      arr = typeof row.transcript_json === 'string' ? JSON.parse(row.transcript_json) : row.transcript_json;
      if (!Array.isArray(arr)) arr = [];
    }
    arr.push({ ...entry, at: new Date().toISOString() });
    await db.execute('UPDATE rtr_sessions SET transcript_json = ? WHERE id = ?', [
      JSON.stringify(arr.slice(-500)),
      sessionId,
    ]);
  } catch {
    /* optional column */
  }
}

async function createSession(endpointId, createdBy, tenantId) {
  await assertRtrAllowed(endpointId, tenantId);
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const r = await db.execute(
    `INSERT INTO rtr_sessions (endpoint_id, created_by, status, expires_at) VALUES (?, ?, 'active', ?)`,
    [endpointId, createdBy || 'admin', expiresAt]
  );
  const id = r.insertId;
  const sessionId = typeof id === 'bigint' ? Number(id) : id;
  await AuditLogService.log({
    username: createdBy || 'admin',
    action: 'rtr.session_created',
    resourceType: 'rtr_session',
    resourceId: String(sessionId),
    details: { endpoint_id: endpointId, tenant_id: tenantId },
  });
  await appendTranscript(sessionId, { type: 'session_start', actor: createdBy });
  return sessionId;
}

async function closeSession(sessionId, tenantId, actor = 'admin') {
  const row = await db.queryOne(
    `SELECT s.id FROM rtr_sessions s
     JOIN endpoints e ON e.id = s.endpoint_id
     WHERE s.id = ? ${tenantId != null ? 'AND e.tenant_id = ?' : ''}`,
    tenantId != null ? [sessionId, tenantId] : [sessionId]
  );
  if (!row) throw new Error('Session not found');
  await db.execute(`UPDATE rtr_sessions SET status = 'closed', closed_at = NOW() WHERE id = ?`, [sessionId]);
  await appendTranscript(sessionId, { type: 'session_close', actor });
  await AuditLogService.log({
    username: actor,
    action: 'rtr.session_closed',
    resourceType: 'rtr_session',
    resourceId: String(sessionId),
  });
}

async function queueCommand(sessionId, command, requestedBy, tenantId, options = {}) {
  const session = await db.queryOne(
    `SELECT s.*, e.id AS ep_id, e.tenant_id FROM rtr_sessions s
     JOIN endpoints e ON e.id = s.endpoint_id
     WHERE s.id = ? AND s.status = 'active' ${tenantId != null ? 'AND e.tenant_id = ?' : ''}`,
    tenantId != null ? [sessionId, tenantId] : [sessionId]
  );
  if (!session) throw new Error('Active session not found');

  if (session.expires_at && new Date(session.expires_at).getTime() < Date.now()) {
    await db.execute(`UPDATE rtr_sessions SET status = 'expired', closed_at = NOW() WHERE id = ?`, [sessionId]);
    throw Object.assign(new Error('RTR session expired'), { statusCode: 410, code: 'RTR_SESSION_EXPIRED' });
  }

  await assertRtrAllowed(session.endpoint_id, tenantId ?? session.tenant_id);

  const v = validateCommand(command);
  if (!v.ok) {
    const ins = await db.execute(
      `INSERT INTO rtr_session_commands (session_id, command_text, status, error_message, completed_at, approval_status)
       VALUES (?, ?, 'rejected', ?, NOW(), 'rejected')`,
      [sessionId, String(command).substring(0, 512), v.error]
    );
    await appendTranscript(sessionId, { type: 'command_rejected', command, error: v.error, actor: requestedBy });
    return { command_id: ins.insertId, status: 'rejected', error: v.error };
  }

  const needsApproval = v.highRisk && !options.approved;
  const approvalStatus = needsApproval ? 'pending_approval' : options.approved ? 'approved' : 'auto';

  if (needsApproval) {
    const ins = await db.execute(
      `INSERT INTO rtr_session_commands (session_id, command_text, status, approval_status)
       VALUES (?, ?, 'pending_approval', 'pending_approval')`,
      [sessionId, v.text]
    );
    await AuditLogService.log({
      username: requestedBy || 'admin',
      action: 'rtr.command_pending_approval',
      resourceType: 'rtr_session',
      resourceId: String(sessionId),
      details: { command: v.text },
    });
    return {
      command_id: ins.insertId,
      status: 'pending_approval',
      requires_approval: true,
      message: 'High-risk command requires approval',
    };
  }

  const ins = await db.execute(
    `INSERT INTO rtr_session_commands (session_id, command_text, status, approval_status) VALUES (?, ?, 'pending', ?)`,
    [sessionId, v.text, approvalStatus]
  );
  const commandId = ins.insertId;

  const actionId = await ResponseActionService.create(
    session.endpoint_id,
    'rtr_shell',
    {
      rtr_command_id: commandId,
      command: v.text,
      timeout_ms: COMMAND_TIMEOUT_MS,
    },
    requestedBy || 'admin',
    tenantId ?? session.tenant_id
  );

  await db.execute(`UPDATE rtr_session_commands SET response_action_id = ? WHERE id = ?`, [actionId, commandId]);
  await appendTranscript(sessionId, { type: 'command_queued', command: v.text, actor: requestedBy });
  await AuditLogService.log({
    username: requestedBy || 'admin',
    action: 'rtr.command_queued',
    resourceType: 'rtr_session',
    resourceId: String(sessionId),
    details: { command: v.text, command_id: commandId },
  });

  return { command_id: commandId, response_action_id: actionId, status: 'pending' };
}

async function approveCommand(commandId, approver, tenantId) {
  const cmd = await db.queryOne(
    `SELECT c.*, s.endpoint_id, s.id AS session_id, e.tenant_id FROM rtr_session_commands c
     JOIN rtr_sessions s ON s.id = c.session_id
     JOIN endpoints e ON e.id = s.endpoint_id
     WHERE c.id = ? AND c.approval_status = 'pending_approval'
     ${tenantId != null ? 'AND e.tenant_id = ?' : ''}`,
    tenantId != null ? [commandId, tenantId] : [commandId]
  );
  if (!cmd) throw new Error('Command not found or not pending approval');

  await db.execute(
    `UPDATE rtr_session_commands SET approval_status = 'approved', status = 'pending' WHERE id = ?`,
    [commandId]
  );
  await AuditLogService.log({
    username: approver,
    action: 'rtr.command_approved',
    resourceType: 'rtr_command',
    resourceId: String(commandId),
  });

  const actionId = await ResponseActionService.create(
    cmd.endpoint_id,
    'rtr_shell',
    { rtr_command_id: commandId, command: cmd.command_text, timeout_ms: COMMAND_TIMEOUT_MS },
    approver || 'admin',
    tenantId ?? cmd.tenant_id
  );
  await db.execute(`UPDATE rtr_session_commands SET response_action_id = ? WHERE id = ?`, [
    actionId,
    commandId,
  ]);
  await appendTranscript(cmd.session_id, { type: 'command_approved', command_id: commandId, actor: approver });
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

  let truncated = 0;
  if (success) {
    let stdout = result?.stdout != null ? String(result.stdout) : '';
    let stderr = result?.stderr != null ? String(result.stderr) : '';
    if (stdout.length > MAX_OUTPUT) {
      stdout = stdout.substring(0, MAX_OUTPUT);
      truncated = 1;
    }
    if (stderr.length > MAX_OUTPUT) {
      stderr = stderr.substring(0, MAX_OUTPUT);
      truncated = 1;
    }
    const exitCode = result?.exit_code != null ? Number(result.exit_code) : null;
    await db.execute(
      `UPDATE rtr_session_commands SET status = 'completed', stdout = ?, stderr = ?, exit_code = ?,
       output_truncated = ?, completed_at = NOW() WHERE id = ?`,
      [stdout, stderr, exitCode, truncated, cmdId]
    );
    const sess = await db.queryOne('SELECT session_id FROM rtr_session_commands WHERE id = ?', [cmdId]);
    if (sess) {
      await appendTranscript(sess.session_id, {
        type: 'command_completed',
        command_id: cmdId,
        exit_code: exitCode,
        truncated: !!truncated,
      });
    }
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
    `SELECT id, command_text, status, stdout, stderr, exit_code, error_message, approval_status,
            output_truncated, created_at, completed_at
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
  isRtrGloballyEnabled,
  createSession,
  closeSession,
  queueCommand,
  approveCommand,
  completeFromAgent,
  listCommands,
  getSession,
};
