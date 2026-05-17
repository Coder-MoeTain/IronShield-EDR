/**
 * Detection rule versioning and review workflow.
 */
const db = require('../../utils/db');

async function ensureTables() {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS detection_rule_reviews (
      id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
      rule_id VARCHAR(64) NOT NULL,
      version VARCHAR(32) NOT NULL,
      reviewer_id BIGINT UNSIGNED NULL,
      decision ENUM('approved','rejected','pending') NOT NULL DEFAULT 'pending',
      comments TEXT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_reviews_rule (rule_id, version)
    ) ENGINE=InnoDB
  `);
}

async function createVersion(ruleId, ruleJson, meta = {}) {
  await ensureTables();
  const version = meta.version || ruleJson.version || '1.0.0';
  const ins = await db.execute(
    `INSERT INTO detection_rule_versions (rule_id, tenant_id, version, definition_json, created_by)
     VALUES (?, ?, ?, ?, ?)`,
    [
      meta.db_rule_id || 0,
      meta.tenant_id || null,
      version,
      JSON.stringify(ruleJson),
      meta.changed_by || null,
    ]
  );
  return { version_id: ins?.insertId, version };
}

async function submitForReview(ruleId, version, authorId) {
  await ensureTables();
  await db.execute(
    `INSERT INTO detection_rule_reviews (rule_id, version, reviewer_id, decision, comments)
     VALUES (?, ?, NULL, 'pending', ?)`,
    [ruleId, version, `Submitted by user ${authorId}`]
  );
  return { status: 'pending_review' };
}

async function approve(ruleId, version, reviewerId, comments, authorId) {
  if (String(reviewerId) === String(authorId)) {
    const err = new Error('Author cannot approve own stable rule change');
    err.code = 'SEPARATION_OF_DUTIES';
    throw err;
  }
  await db.execute(
    `INSERT INTO detection_rule_reviews (rule_id, version, reviewer_id, decision, comments)
     VALUES (?, ?, ?, 'approved', ?)`,
    [ruleId, version, reviewerId, comments || null]
  );
  return { status: 'approved' };
}

async function reject(ruleId, version, reviewerId, comments) {
  await db.execute(
    `INSERT INTO detection_rule_reviews (rule_id, version, reviewer_id, decision, comments)
     VALUES (?, ?, ?, 'rejected', ?)`,
    [ruleId, version, reviewerId, comments || null]
  );
  return { status: 'rejected' };
}

async function listVersions(ruleId) {
  const rows = await db.query(
    `SELECT id, rule_id, tenant_id, version, created_by, created_at
     FROM detection_rule_versions
     WHERE rule_id = ? OR definition_json LIKE ?
     ORDER BY created_at DESC LIMIT 50`,
    [ruleId, `%"id":"${ruleId}"%`]
  ).catch(() => []);
  return rows;
}

async function getVersion(versionId) {
  const rows = await db.query('SELECT * FROM detection_rule_versions WHERE id = ?', [versionId]);
  const row = rows?.[0];
  if (!row) return null;
  if (typeof row.definition_json === 'string') {
    try {
      row.definition_json = JSON.parse(row.definition_json);
    } catch {
      /* keep raw */
    }
  }
  return row;
}

function shallowDiff(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const changes = [];
  for (const key of keys) {
    const a = before?.[key];
    const b = after?.[key];
    if (JSON.stringify(a) !== JSON.stringify(b)) {
      changes.push({ field: key, before: a, after: b });
    }
  }
  return changes;
}

async function diffVersions(ruleId, fromVersionId, toVersionId) {
  const fromRow = await getVersion(fromVersionId);
  const toRow = toVersionId ? await getVersion(toVersionId) : null;
  if (!fromRow) {
    const err = new Error('Source version not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const fromDef = fromRow.definition_json || {};
  let toDef = toRow?.definition_json;
  if (!toDef) {
    const DetectionRuleRepository = require('../../repositories/DetectionRuleRepository');
    const current = await DetectionRuleRepository.getById(ruleId);
    toDef = current || {};
  }
  return {
    rule_id: ruleId,
    from_version_id: fromVersionId,
    to_version_id: toVersionId || null,
    changes: shallowDiff(fromDef, toDef),
  };
}

async function rollback(ruleId, versionId, actor) {
  const row = await getVersion(versionId);
  if (!row) {
    const err = new Error('Version not found');
    err.code = 'NOT_FOUND';
    throw err;
  }
  const definition = row.definition_json || {};
  const snapshot = await createVersion(ruleId, definition, {
    version: definition.version || row.version,
    changed_by: actor,
    tenant_id: row.tenant_id,
  });
  return { rolled_back_to: versionId, snapshot };
}

async function listPendingReviews(tenantId = null) {
  await ensureTables();
  const params = [];
  let sql = `SELECT * FROM detection_rule_reviews WHERE decision = 'pending'`;
  if (tenantId != null) {
    sql += ` AND rule_id IN (
      SELECT rule_id FROM detection_rule_versions WHERE tenant_id = ?
    )`;
    params.push(tenantId);
  }
  sql += ' ORDER BY created_at ASC';
  return db.query(sql, params);
}

module.exports = {
  createVersion,
  submitForReview,
  approve,
  reject,
  listVersions,
  getVersion,
  diffVersions,
  rollback,
  listPendingReviews,
  ensureTables,
};
