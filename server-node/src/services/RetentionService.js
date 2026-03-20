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
  return db.query(sql, params);
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

module.exports = { getPolicies, runPolicy, runAllPolicies };
