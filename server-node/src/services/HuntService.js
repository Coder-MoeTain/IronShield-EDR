/**
 * Threat hunting — saved hunts over normalized telemetry (Falcon-style hunt-lite)
 */
const db = require('../utils/db');
const NormalizedEventService = require('./NormalizedEventService');

function parseParams(raw) {
  if (raw == null) return {};
  if (typeof raw === 'object') return raw;
  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

async function list() {
  return db.query('SELECT * FROM hunt_queries ORDER BY created_at DESC LIMIT 100');
}

async function create({ name, query_params, created_by }) {
  if (!name || !String(name).trim()) throw new Error('name required');
  const qp = query_params && typeof query_params === 'object' ? query_params : {};
  const result = await db.execute(
    'INSERT INTO hunt_queries (name, query_params, created_by) VALUES (?, ?, ?)',
    [String(name).trim().substring(0, 128), JSON.stringify(qp), created_by || null]
  );
  return result.insertId;
}

async function remove(id) {
  const r = await db.execute('DELETE FROM hunt_queries WHERE id = ?', [id]);
  return r.affectedRows > 0;
}

async function runHunt(id, tenantId = null) {
  const hunt = await db.queryOne('SELECT * FROM hunt_queries WHERE id = ?', [id]);
  if (!hunt) return null;
  const params = parseParams(hunt.query_params);
  const limit = Math.min(parseInt(params.limit, 10) || 100, 500);
  const filters = {
    ...params,
    limit,
    offset: 0,
    tenantId,
  };
  const rows = await NormalizedEventService.list(filters);
  const total = await NormalizedEventService.count(filters);
  await db.execute(
    'INSERT INTO hunt_results (hunt_id, result_data, result_count) VALUES (?, ?, ?)',
    [id, JSON.stringify({ rows, total, ran_at: new Date().toISOString() }), total]
  );
  return { hunt_id: id, hunt_name: hunt.name, total, rows, result_count: total };
}

async function runAdhoc(query_params, tenantId = null) {
  const params = query_params && typeof query_params === 'object' ? query_params : {};
  const limit = Math.min(parseInt(params.limit, 10) || 100, 500);
  const filters = { ...params, limit, offset: 0, tenantId };
  const rows = await NormalizedEventService.list(filters);
  const total = await NormalizedEventService.count(filters);
  return { total, rows, result_count: total };
}

async function runXdrAdhoc(query_params, tenantId = null) {
  const q = query_params && typeof query_params === 'object' ? query_params : {};
  const limit = Math.min(parseInt(q.limit, 10) || 100, 500);
  const offset = Math.max(parseInt(q.offset, 10) || 0, 0);
  const params = [];
  let where = ' WHERE 1=1';
  if (tenantId != null) {
    where += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    params.push(tenantId);
  }
  if (q.source) {
    where += ' AND source = ?';
    params.push(String(q.source));
  }
  if (q.event_type) {
    where += ' AND event_type = ?';
    params.push(String(q.event_type));
  }
  if (q.endpoint_id) {
    where += ' AND endpoint_id = ?';
    params.push(parseInt(q.endpoint_id, 10));
  }
  if (q.q) {
    const like = `%${String(q.q).trim()}%`;
    where += ' AND (command_line LIKE ? OR process_name LIKE ? OR dns_query LIKE ? OR file_path LIKE ?)';
    params.push(like, like, like, like);
  }
  const rows = await db.query(
    `SELECT * FROM xdr_events ${where} ORDER BY timestamp DESC LIMIT ? OFFSET ?`,
    [...params, limit, offset]
  );
  const countRow = await db.queryOne(
    `SELECT COUNT(*) AS c FROM xdr_events ${where}`,
    params
  );
  return { total: Number(countRow?.c || 0), rows, result_count: Number(countRow?.c || 0) };
}

module.exports = { list, create, remove, runHunt, runAdhoc, runXdrAdhoc };
