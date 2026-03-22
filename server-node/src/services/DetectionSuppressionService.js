/**
 * Detection suppression — filter alerts before they are created (Falcon-style tuning)
 */
const db = require('../utils/db');

async function getTenantIdForEndpoint(endpointId) {
  try {
    const row = await db.queryOne('SELECT tenant_id FROM endpoints WHERE id = ?', [endpointId]);
    return row?.tenant_id ?? null;
  } catch {
    return null;
  }
}

/** Loose "LIKE %x%" match: pattern may include % wildcards */
function matchesPattern(haystack, pattern) {
  if (pattern == null || pattern === '') return true;
  const h = String(haystack || '').toLowerCase();
  const p = String(pattern).toLowerCase();
  if (p.includes('%')) {
    const parts = p.split('%').map((x) => x.trim()).filter(Boolean);
    if (parts.length === 0) return true;
    return parts.every((part) => h.includes(part));
  }
  return h.includes(p);
}

/**
 * Returns true if this (event, rule) pair should not generate an alert.
 */
async function isSuppressed(normalizedEvent, rule, tenantId = null) {
  try {
    const rows = await db.query(
      `SELECT * FROM detection_suppressions
       WHERE enabled = 1
         AND (expires_at IS NULL OR expires_at > NOW())
         AND (tenant_id IS NULL OR tenant_id <=> ?)
         AND (rule_id IS NULL OR rule_id = ?)
         AND (endpoint_id IS NULL OR endpoint_id = ?)`,
      [tenantId, rule.id, normalizedEvent.endpoint_id]
    );
    if (!rows?.length) return false;

    const host = normalizedEvent.hostname || '';
    const path = normalizedEvent.process_path || '';
    const title = rule.title || '';

    for (const s of rows) {
      if (!matchesPattern(host, s.hostname_pattern)) continue;
      if (!matchesPattern(path, s.process_path_pattern)) continue;
      if (s.title_contains && !String(title).toLowerCase().includes(String(s.title_contains).toLowerCase())) {
        continue;
      }
      return true;
    }
    return false;
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return false;
    throw err;
  }
}

async function list(tenantId = null) {
  let sql = 'SELECT * FROM detection_suppressions WHERE 1=1';
  const params = [];
  if (tenantId != null) {
    sql += ' AND (tenant_id IS NULL OR tenant_id = ?)';
    params.push(tenantId);
  }
  sql += ' ORDER BY created_at DESC LIMIT 200';
  return db.query(sql, params);
}

async function create(body, createdBy, tenantId) {
  const {
    rule_id,
    endpoint_id,
    hostname_pattern,
    process_path_pattern,
    title_contains,
    comment,
    expires_at,
  } = body || {};
  const result = await db.execute(
    `INSERT INTO detection_suppressions
     (tenant_id, rule_id, endpoint_id, hostname_pattern, process_path_pattern, title_contains, comment, expires_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      tenantId ?? null,
      rule_id ?? null,
      endpoint_id ?? null,
      hostname_pattern || null,
      process_path_pattern || null,
      title_contains || null,
      comment || null,
      expires_at || null,
      createdBy || null,
    ]
  );
  return result.insertId;
}

async function update(id, body, tenantId) {
  const row = await db.queryOne('SELECT * FROM detection_suppressions WHERE id = ?', [id]);
  if (!row) return false;
  if (tenantId != null && row.tenant_id != null && row.tenant_id !== tenantId) return false;

  const hostname_pattern = body.hostname_pattern !== undefined ? body.hostname_pattern : row.hostname_pattern;
  const process_path_pattern =
    body.process_path_pattern !== undefined ? body.process_path_pattern : row.process_path_pattern;
  const title_contains = body.title_contains !== undefined ? body.title_contains : row.title_contains;
  const comment = body.comment !== undefined ? body.comment : row.comment;
  const expires_at = body.expires_at !== undefined ? body.expires_at : row.expires_at;
  const enabled = body.enabled !== undefined ? (body.enabled ? 1 : 0) : row.enabled;

  await db.query(
    `UPDATE detection_suppressions SET
       hostname_pattern = ?, process_path_pattern = ?, title_contains = ?, comment = ?,
       expires_at = ?, enabled = ?
     WHERE id = ?`,
    [hostname_pattern, process_path_pattern, title_contains, comment, expires_at, enabled, id]
  );
  return true;
}

async function remove(id, tenantId) {
  const row = await db.queryOne('SELECT * FROM detection_suppressions WHERE id = ?', [id]);
  if (!row) return false;
  if (tenantId != null && row.tenant_id != null && row.tenant_id !== tenantId) return false;
  await db.execute('DELETE FROM detection_suppressions WHERE id = ?', [id]);
  return true;
}

module.exports = {
  getTenantIdForEndpoint,
  isSuppressed,
  list,
  create,
  update,
  remove,
};
