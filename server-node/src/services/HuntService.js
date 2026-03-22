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

module.exports = { list, create, remove, runHunt, runAdhoc };
