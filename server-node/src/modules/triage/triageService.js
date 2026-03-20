/**
 * Triage request and result service
 */
const db = require('../../utils/db');
const NetworkService = require('../../services/NetworkService');

async function createRequest(endpointId, requestType, requestedBy, alertId = null, caseId = null) {
  const result = await db.execute(
    `INSERT INTO triage_requests (endpoint_id, request_type, requested_by, alert_id, case_id, status)
     VALUES (?, ?, ?, ?, ?, 'pending')`,
    [endpointId, requestType || 'full', requestedBy, alertId, caseId]
  );
  return result.insertId;
}

async function getPendingForEndpoint(endpointId) {
  return db.query(
    'SELECT * FROM triage_requests WHERE endpoint_id = ? AND status IN ("pending", "in_progress") ORDER BY created_at',
    [endpointId]
  );
}

async function getById(id) {
  return db.queryOne(
    `SELECT t.*, e.hostname
     FROM triage_requests t
     JOIN endpoints e ON e.id = t.endpoint_id
     WHERE t.id = ?`,
    [id]
  );
}

async function list(filters = {}) {
  let sql = `
    SELECT t.*, e.hostname
    FROM triage_requests t
    JOIN endpoints e ON e.id = t.endpoint_id
    WHERE 1=1
  `;
  const params = [];

  if (filters.endpointId) {
    sql += ' AND t.endpoint_id = ?';
    params.push(filters.endpointId);
  }
  if (filters.status) {
    sql += ' AND t.status = ?';
    params.push(filters.status);
  }

  sql += ' ORDER BY t.created_at DESC LIMIT ? OFFSET ?';
  params.push(Math.min(filters.limit || 50, 200), filters.offset || 0);

  return db.query(sql, params);
}

function parseAddrPort(s) {
  if (!s || typeof s !== 'string') return { address: null, port: null };
  const idx = s.lastIndexOf(':');
  if (idx < 0) return { address: s, port: null };
  return { address: s.slice(0, idx), port: parseInt(s.slice(idx + 1), 10) || null };
}

async function saveResult(triageRequestId, resultJson) {
  await db.execute(
    'INSERT INTO triage_results (triage_request_id, result_json) VALUES (?, ?)',
    [triageRequestId, JSON.stringify(resultJson)]
  );
  await db.execute(
    "UPDATE triage_requests SET status = 'completed', completed_at = NOW() WHERE id = ?",
    [triageRequestId]
  );

  // Save network connections from triage result to network_connections
  const req = await db.queryOne('SELECT endpoint_id FROM triage_requests WHERE id = ?', [triageRequestId]);
  if (req?.endpoint_id && resultJson?.network && Array.isArray(resultJson.network)) {
    for (const conn of resultJson.network.slice(0, 150)) {
      try {
        const local = parseAddrPort(conn.local);
        const remote = parseAddrPort(conn.remote);
        if (remote.address && remote.address !== '0.0.0.0') {
          await NetworkService.upsertConnection(req.endpoint_id, {
            local_address: local.address,
            local_port: local.port,
            remote_address: remote.address,
            remote_port: remote.port,
            protocol: 'TCP',
            state: conn.state || null,
          });
        }
      } catch (e) {
        // ignore per-connection errors
      }
    }
  }
}

async function markFailed(triageRequestId, reason) {
  await db.execute(
    "UPDATE triage_requests SET status = 'failed', completed_at = NOW() WHERE id = ?",
    [triageRequestId]
  );
}

async function getResult(triageRequestId) {
  return db.queryOne(
    'SELECT * FROM triage_results WHERE triage_request_id = ? ORDER BY received_at DESC LIMIT 1',
    [triageRequestId]
  );
}

async function getResultsForRequest(id) {
  return db.query('SELECT * FROM triage_results WHERE triage_request_id = ? ORDER BY received_at', [id]);
}

module.exports = {
  createRequest,
  getPendingForEndpoint,
  getById,
  list,
  saveResult,
  markFailed,
  getResult,
  getResultsForRequest,
};
