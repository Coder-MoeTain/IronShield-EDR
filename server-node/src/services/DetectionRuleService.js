/**
 * Detection rules — CRUD + validation (Sigma-style conditions aligned with DetectionEngineService).
 */
const db = require('../utils/db');

function normalizeRuleRow(row) {
  if (!row) return row;
  let c = row.conditions;
  if (typeof c === 'string') {
    try {
      c = JSON.parse(c);
    } catch {
      c = {};
    }
  }
  return { ...row, conditions: c };
}

/** Keys supported by DetectionEngineService.evalCondition */
const ALLOWED_CONDITION_KEYS = new Set([
  'event_type',
  'process_name',
  'parent_process',
  'child_process',
  'encoded_command',
  'suspicious_params',
  'path_contains',
  'unusual_parent',
  'signed',
  'dns_query_contains',
  'dns_query_length_gt',
  'registry_key_contains',
  'image_loaded_contains',
  'command_line_entropy_gt',
  'suspicious_indicator_count_gte',
  'collector_confidence_lt',
]);

const NAME_RE = /^[a-z][a-z0-9_]{1,120}$/;

function parseConditions(raw) {
  if (raw == null) return {};
  if (typeof raw === 'string') {
    try {
      return JSON.parse(raw);
    } catch {
      throw new Error('conditions must be valid JSON');
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) return raw;
  throw new Error('conditions must be a JSON object');
}

function validateConditions(obj) {
  const o = parseConditions(obj);
  const keys = Object.keys(o);
  if (keys.length === 0) throw new Error('conditions must contain at least one key');
  for (const k of keys) {
    if (!ALLOWED_CONDITION_KEYS.has(k)) {
      throw new Error(`Unsupported condition key: ${k}. Allowed: ${[...ALLOWED_CONDITION_KEYS].sort().join(', ')}`);
    }
  }
  return o;
}

function validateName(name) {
  const n = String(name || '').trim();
  if (!NAME_RE.test(n)) {
    throw new Error('name must be snake_case: start with letter, lowercase letters, digits, underscore (2–121 chars)');
  }
  return n;
}

function validateSeverity(s) {
  const v = String(s || 'medium').toLowerCase();
  if (!['low', 'medium', 'high', 'critical'].includes(v)) throw new Error('invalid severity');
  return v;
}

async function list(filters = {}) {
  let sql = 'SELECT * FROM detection_rules WHERE 1=1';
  const params = [];
  if (filters.enabled === '1' || filters.enabled === 'true' || filters.enabled === true) {
    sql += ' AND enabled = 1';
  } else if (filters.enabled === '0' || filters.enabled === 'false' || filters.enabled === false) {
    sql += ' AND enabled = 0';
  }
  if (filters.severity) {
    sql += ' AND severity = ?';
    params.push(filters.severity);
  }
  if (filters.q) {
    const q = `%${String(filters.q).trim()}%`;
    sql += ' AND (name LIKE ? OR title LIKE ? OR description LIKE ?)';
    params.push(q, q, q);
  }
  sql += ' ORDER BY name ASC';
  const rows = await db.query(sql, params);
  return rows.map(normalizeRuleRow);
}

async function getById(id) {
  const row = await db.queryOne('SELECT * FROM detection_rules WHERE id = ?', [id]);
  return row ? normalizeRuleRow(row) : null;
}

async function create(data) {
  const name = validateName(data.name);
  const title = String(data.title || '').trim().substring(0, 255);
  if (!title) throw new Error('title required');
  const description = data.description != null ? String(data.description).substring(0, 65535) : null;
  const severity = validateSeverity(data.severity);
  const conditions = validateConditions(data.conditions);
  const mitre_tactic = data.mitre_tactic != null ? String(data.mitre_tactic).substring(0, 128) : null;
  const mitre_technique = data.mitre_technique != null ? String(data.mitre_technique).substring(0, 128) : null;
  const enabled = data.enabled === false ? 0 : 1;

  const existing = await db.queryOne('SELECT id FROM detection_rules WHERE name = ?', [name]);
  if (existing) throw new Error('rule name already exists');

  const r = await db.execute(
    `INSERT INTO detection_rules (name, title, description, enabled, severity, conditions, mitre_tactic, mitre_technique)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    [name, title, description, enabled, severity, JSON.stringify(conditions), mitre_tactic, mitre_technique]
  );
  const newId = r.insertId;
  return getById(typeof newId === 'bigint' ? Number(newId) : newId);
}

async function update(id, data) {
  const row = await getById(id);
  if (!row) return null;
  const updates = [];
  const vals = [];

  if (data.enabled !== undefined) {
    updates.push('enabled = ?');
    vals.push(data.enabled ? 1 : 0);
  }
  if (data.title !== undefined) {
    const t = String(data.title).trim().substring(0, 255);
    if (!t) throw new Error('title cannot be empty');
    updates.push('title = ?');
    vals.push(t);
  }
  if (data.description !== undefined) {
    updates.push('description = ?');
    vals.push(data.description != null ? String(data.description).substring(0, 65535) : null);
  }
  if (data.severity !== undefined) {
    updates.push('severity = ?');
    vals.push(validateSeverity(data.severity));
  }
  if (data.conditions !== undefined) {
    updates.push('conditions = ?');
    vals.push(JSON.stringify(validateConditions(data.conditions)));
  }
  if (data.mitre_tactic !== undefined) {
    updates.push('mitre_tactic = ?');
    vals.push(data.mitre_tactic != null ? String(data.mitre_tactic).substring(0, 128) : null);
  }
  if (data.mitre_technique !== undefined) {
    updates.push('mitre_technique = ?');
    vals.push(data.mitre_technique != null ? String(data.mitre_technique).substring(0, 128) : null);
  }

  if (updates.length === 0) return getById(id);

  vals.push(id);
  await db.query(`UPDATE detection_rules SET ${updates.join(', ')} WHERE id = ?`, vals);
  return getById(id);
}

function n(v) {
  if (v == null) return 0;
  if (typeof v === 'bigint') return Number(v);
  const x = Number(v);
  return Number.isFinite(x) ? x : 0;
}

async function summary() {
  const rows = await db.query(
    `SELECT
       COUNT(*) AS total,
       SUM(CASE WHEN enabled = 1 THEN 1 ELSE 0 END) AS enabled_count,
       SUM(CASE WHEN severity = 'critical' THEN 1 ELSE 0 END) AS critical,
       SUM(CASE WHEN severity = 'high' THEN 1 ELSE 0 END) AS high,
       SUM(CASE WHEN severity = 'medium' THEN 1 ELSE 0 END) AS medium,
       SUM(CASE WHEN severity = 'low' THEN 1 ELSE 0 END) AS low
     FROM detection_rules`
  );
  const r = rows[0] || {};
  return {
    total: n(r.total),
    enabled_count: n(r.enabled_count),
    critical: n(r.critical),
    high: n(r.high),
    medium: n(r.medium),
    low: n(r.low),
  };
}

module.exports = {
  ALLOWED_CONDITION_KEYS,
  list,
  getById,
  create,
  update,
  summary,
  validateConditions,
};
