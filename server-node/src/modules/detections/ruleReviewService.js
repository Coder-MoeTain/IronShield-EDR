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
    `SELECT * FROM detection_rule_versions WHERE rule_id = ? OR definition_json LIKE ?
     ORDER BY created_at DESC LIMIT 50`,
    [ruleId, `%"id":"${ruleId}"%`]
  ).catch(() => []);
  return rows;
}

async function listPendingReviews(tenantId = null) {
  await ensureTables();
  return db.query(
    `SELECT * FROM detection_rule_reviews WHERE decision = 'pending' ORDER BY created_at ASC`
  );
}

module.exports = {
  createVersion,
  submitForReview,
  approve,
  reject,
  listVersions,
  listPendingReviews,
  ensureTables,
};
