const IocMatchingService = require('../services/IocMatchingService');
const db = require('../utils/db');

async function listIocs(req, res, next) {
  try {
    const type = req.query.type ? String(req.query.type) : null;
    let sql = 'SELECT * FROM ioc_watchlist WHERE 1=1';
    const params = [];
    if (req.tenantId != null) {
      sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
      params.push(req.tenantId);
    }
    if (type) {
      sql += ' AND ioc_type = ?';
      params.push(type);
    }
    sql += ' ORDER BY created_at DESC LIMIT 500';
    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function addIoc(req, res, next) {
  try {
    const { ioc_type, ioc_value, description, severity } = req.body || {};
    await IocMatchingService.addIoc(ioc_type, ioc_value, description, req.tenantId, severity || 'high');
    res.status(201).json({ ok: true });
  } catch (e) {
    res.status(400).json({ error: e.message || 'Invalid IOC' });
  }
}

module.exports = { listIocs, addIoc };

