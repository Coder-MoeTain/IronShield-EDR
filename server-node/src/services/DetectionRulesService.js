/**
 * Detection rules service - enterprise multi-tenant
 * Rules with tenant_id NULL are global (apply to all tenants)
 */
const db = require('../utils/db');
const { validateConditions } = require('./DetectionRuleService');

function parseAndValidateConditions(raw) {
  if (raw == null) return {};
  const o = typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
  if (Object.keys(o).length === 0) return {};
  return validateConditions(o);
}

async function list(tenantId) {
  try {
    let sql = 'SELECT dr.*, t.name as tenant_name FROM detection_rules dr LEFT JOIN tenants t ON t.id = dr.tenant_id WHERE 1=1';
    const params = [];
    if (tenantId != null) {
      sql += ' AND (dr.tenant_id = ? OR dr.tenant_id IS NULL)';
      params.push(tenantId);
    }
    sql += ' ORDER BY COALESCE(dr.tenant_id, 999999) ASC, dr.name';
    return db.query(sql, params);
  } catch (err) {
    if (err.message?.includes('tenant_id') || err.code === 'ER_BAD_FIELD_ERROR') {
      return db.query('SELECT *, NULL as tenant_name FROM detection_rules ORDER BY name');
    }
    throw err;
  }
}

async function getById(id, tenantId) {
  const rule = await db.queryOne('SELECT * FROM detection_rules WHERE id = ?', [id]);
  if (!rule) return null;
  if (tenantId != null && rule.tenant_id != null && rule.tenant_id !== tenantId) {
    return null;
  }
  return rule;
}

async function create(data, tenantId) {
  const { name, title, description, enabled, severity, conditions, mitre_tactic, mitre_technique } = data || {};
  if (!name || !title) throw new Error('name and title required');
  const condObj = parseAndValidateConditions(conditions);
  const cond = JSON.stringify(condObj);
  try {
    const result = await db.execute(
      `INSERT INTO detection_rules (tenant_id, name, title, description, enabled, severity, conditions, mitre_tactic, mitre_technique)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        tenantId ?? null,
        String(name).substring(0, 128),
        String(title).substring(0, 255),
        description ? String(description).substring(0, 4096) : null,
        enabled !== false ? 1 : 0,
        ['low', 'medium', 'high', 'critical'].includes(severity) ? severity : 'medium',
        cond,
        mitre_tactic ? String(mitre_tactic).substring(0, 128) : null,
        mitre_technique ? String(mitre_technique).substring(0, 128) : null,
      ]
    );
    return result.insertId;
  } catch (err) {
    if (err.message?.includes('tenant_id') || err.code === 'ER_BAD_FIELD_ERROR') {
      const result = await db.execute(
        `INSERT INTO detection_rules (name, title, description, enabled, severity, conditions, mitre_tactic, mitre_technique)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          String(name).substring(0, 128),
          String(title).substring(0, 255),
          description ? String(description).substring(0, 4096) : null,
          enabled !== false ? 1 : 0,
          ['low', 'medium', 'high', 'critical'].includes(severity) ? severity : 'medium',
          cond,
          mitre_tactic ? String(mitre_tactic).substring(0, 128) : null,
          mitre_technique ? String(mitre_technique).substring(0, 128) : null,
        ]
      );
      return result.insertId;
    }
    throw err;
  }
}

async function update(id, data, tenantId) {
  const rule = await getById(id, tenantId);
  if (!rule) return null;

  const updates = [];
  const params = [];
  const { title, description, enabled, severity, conditions, mitre_tactic, mitre_technique } = data || {};

  if (title !== undefined) { updates.push('title = ?'); params.push(String(title).substring(0, 255)); }
  if (description !== undefined) { updates.push('description = ?'); params.push(description ? String(description).substring(0, 4096) : null); }
  if (enabled !== undefined) { updates.push('enabled = ?'); params.push(enabled ? 1 : 0); }
  if (severity !== undefined) { updates.push('severity = ?'); params.push(['low', 'medium', 'high', 'critical'].includes(severity) ? severity : 'medium'); }
  if (conditions !== undefined) {
    updates.push('conditions = ?');
    params.push(JSON.stringify(parseAndValidateConditions(conditions)));
  }
  if (mitre_tactic !== undefined) { updates.push('mitre_tactic = ?'); params.push(mitre_tactic ? String(mitre_tactic).substring(0, 128) : null); }
  if (mitre_technique !== undefined) { updates.push('mitre_technique = ?'); params.push(mitre_technique ? String(mitre_technique).substring(0, 128) : null); }

  if (updates.length === 0) return rule;

  params.push(id);
  await db.execute(`UPDATE detection_rules SET ${updates.join(', ')} WHERE id = ?`, params);
  return db.queryOne('SELECT * FROM detection_rules WHERE id = ?', [id]);
}

async function remove(id, tenantId) {
  const rule = await getById(id, tenantId);
  if (!rule) return false;
  await db.execute('DELETE FROM detection_rules WHERE id = ?', [id]);
  return true;
}

module.exports = { list, getById, create, update, remove };
