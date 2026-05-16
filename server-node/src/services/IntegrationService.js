const db = require('../utils/db');
const providers = require('../integrations/providers');
const AuditLogService = require('./AuditLogService');

function redactConfig(config) {
  const c = { ...config };
  for (const k of ['secret', 'token', 'password', 'api_key']) {
    if (c[k]) c[k] = '***';
  }
  return c;
}

async function list(tenantId = null) {
  let sql = 'SELECT id, tenant_id, type, name, enabled, created_at, updated_at FROM integrations WHERE 1=1';
  const params = [];
  if (tenantId != null) {
    sql += ' AND (tenant_id IS NULL OR tenant_id = ?)';
    params.push(tenantId);
  }
  return db.query(sql, params).catch(() => []);
}

async function create({ tenantId, type, name, config, actor }) {
  const r = await db.execute(
    `INSERT INTO integrations (tenant_id, type, name, config_json, enabled) VALUES (?, ?, ?, ?, 1)`,
    [tenantId, type, name, JSON.stringify(config)]
  );
  await AuditLogService.log({
    username: actor,
    action: 'integration.create',
    resourceType: 'integration',
    resourceId: String(r.insertId),
    details: { type, name, config: redactConfig(config) },
  });
  return r.insertId;
}

async function test(id, tenantId = null) {
  const row = await getById(id, tenantId);
  if (!row) throw new Error('Integration not found');
  const config = typeof row.config_json === 'string' ? JSON.parse(row.config_json) : row.config_json;
  return providers.dispatch(row.type, config, { test: true, ts: new Date().toISOString() });
}

async function getById(id, tenantId = null) {
  let sql = 'SELECT * FROM integrations WHERE id = ?';
  const params = [id];
  if (tenantId != null) {
    sql += ' AND (tenant_id IS NULL OR tenant_id = ?)';
    params.push(tenantId);
  }
  return db.queryOne(sql, params);
}

async function exportAlert(alert, endpoint, tenantId = null) {
  const rows = await list(tenantId);
  for (const row of rows) {
    if (!row.enabled) continue;
    const full = await getById(row.id, tenantId);
    const config = typeof full.config_json === 'string' ? JSON.parse(full.config_json) : full.config_json;
    try {
      await providers.dispatch(row.type, config, { alert, endpoint });
    } catch (err) {
      /* log and continue */
    }
  }
}

module.exports = { list, create, test, getById, exportAlert, redactConfig };
