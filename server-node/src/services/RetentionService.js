/**
 * Retention and archival - purges/archives old data per policy
 */
const db = require('../utils/db');
const logger = require('../utils/logger');

const TABLE_CONFIG = {
  raw_events: { dateColumn: 'created_at', linkTable: null },
  endpoint_heartbeats: { dateColumn: 'received_at', linkTable: null },
  normalized_events: { dateColumn: 'created_at', linkTable: null },
  audit_logs: { dateColumn: 'created_at', linkTable: null },
};

async function getPolicies(tenantId = null) {
  let sql = 'SELECT * FROM retention_policies WHERE 1=1';
  const params = [];
  if (tenantId != null) {
    sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
    params.push(tenantId);
  }
  sql += ' ORDER BY table_name, name';
  return db.query(sql, params);
}

async function createPolicy(data, tenantId = null) {
  const { name, table_name, retain_days = 90, archive_enabled = false } = data || {};
  if (!name || !table_name) throw new Error('name and table_name required');
  const validTables = Object.keys(TABLE_CONFIG);
  if (!validTables.includes(table_name)) throw new Error(`table_name must be one of: ${validTables.join(', ')}`);
  const result = await db.execute(
    'INSERT INTO retention_policies (tenant_id, name, table_name, retain_days, archive_enabled) VALUES (?, ?, ?, ?, ?)',
    [tenantId, name, table_name, Math.max(1, parseInt(retain_days) || 90), !!archive_enabled]
  );
  return result.insertId;
}

async function updatePolicy(id, data, tenantId = null) {
  const existing = await db.queryOne('SELECT * FROM retention_policies WHERE id = ?', [id]);
  if (!existing) return null;
  if (tenantId != null && existing.tenant_id != null && existing.tenant_id !== tenantId) return null;
  const { name, table_name, retain_days, archive_enabled } = data || {};
  const updates = [];
  const params = [];
  if (name !== undefined) { updates.push('name = ?'); params.push(name); }
  if (table_name !== undefined) {
    if (!Object.keys(TABLE_CONFIG).includes(table_name)) throw new Error('Invalid table_name');
    updates.push('table_name = ?'); params.push(table_name);
  }
  if (retain_days !== undefined) { updates.push('retain_days = ?'); params.push(Math.max(1, parseInt(retain_days) || 90)); }
  if (archive_enabled !== undefined) { updates.push('archive_enabled = ?'); params.push(!!archive_enabled); }
  if (updates.length === 0) return existing.id;
  params.push(id);
  await db.execute(`UPDATE retention_policies SET ${updates.join(', ')} WHERE id = ?`, params);
  return id;
}

async function deletePolicy(id, tenantId = null) {
  let sql = 'DELETE FROM retention_policies WHERE id = ?';
  const params = [id];
  if (tenantId != null) {
    sql = 'DELETE rp FROM retention_policies rp WHERE rp.id = ? AND (rp.tenant_id = ? OR rp.tenant_id IS NULL)';
    params.push(tenantId);
  }
  const result = await db.execute(sql, params);
  return result.affectedRows > 0;
}

async function runPolicy(policy) {
  const cfg = TABLE_CONFIG[policy.table_name];
  if (!cfg) {
    logger.warn({ table: policy.table_name }, 'Unknown table for retention');
    return { deleted: 0 };
  }

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - policy.retain_days);

  let sql;
  let params;

  if (policy.tenant_id != null && (policy.table_name === 'raw_events' || policy.table_name === 'normalized_events')) {
    const alias = policy.table_name === 'raw_events' ? 'r' : 'n';
    sql = `DELETE ${alias} FROM ${policy.table_name} ${alias}
           JOIN endpoints e ON e.id = ${alias}.endpoint_id
           WHERE ${alias}.${cfg.dateColumn} < ? AND e.tenant_id = ?`;
    params = [cutoff, policy.tenant_id];
  } else {
    sql = `DELETE FROM ${policy.table_name} WHERE ${cfg.dateColumn} < ?`;
    params = [cutoff];
  }

  const result = await db.execute(sql, params);
  await db.execute(
    'UPDATE retention_policies SET last_run_at = NOW() WHERE id = ?',
    [policy.id]
  );
  return { deleted: result?.affectedRows ?? 0 };
}

async function runAllPolicies(tenantId = null) {
  const policies = await getPolicies(tenantId);
  let totalDeleted = 0;
  for (const p of policies) {
    try {
      const { deleted } = await runPolicy(p);
      totalDeleted += deleted;
      logger.info({ policyId: p.id, table: p.table_name, deleted }, 'Retention run');
    } catch (err) {
      logger.warn({ err: err.message, policyId: p.id }, 'Retention policy failed');
    }
  }
  return { totalDeleted };
}

module.exports = { getPolicies, createPolicy, updatePolicy, deletePolicy, runPolicy, runAllPolicies };
