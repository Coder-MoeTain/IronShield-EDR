/**
 * Phase 4 API - Incidents, Risk, IOC
 */
const IncidentService = require('../modules/incidents/incidentService');
const RiskService = require('../modules/risk/riskService');
const db = require('../utils/db');

async function listIncidents(req, res, next) {
  try {
    const incidents = await IncidentService.list(req.query);
    res.json(incidents);
  } catch (err) {
    next(err);
  }
}

async function getIncident(req, res, next) {
  try {
    const inc = await IncidentService.getById(req.params.id);
    if (!inc) return res.status(404).json({ error: 'Incident not found' });
    res.json(inc);
  } catch (err) {
    next(err);
  }
}

async function updateIncidentStatus(req, res, next) {
  try {
    const { status } = req.body || {};
    if (!status) return res.status(400).json({ error: 'status required' });
    await IncidentService.updateStatus(req.params.id, status);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function getEndpointRisk(req, res, next) {
  try {
    const risk = await RiskService.getEndpointRisk(req.params.id);
    res.json(risk);
  } catch (err) {
    next(err);
  }
}

async function getRiskList(req, res, next) {
  try {
    const list = await RiskService.getEndpointRiskList(req.query.limit || 20);
    res.json(list);
  } catch (err) {
    next(err);
  }
}

async function listIocs(req, res, next) {
  try {
    let sql = 'SELECT * FROM ioc_watchlist WHERE is_active = 1';
    const params = [];
    if (req.tenantId != null) {
      sql += ' AND (tenant_id = ? OR tenant_id IS NULL)';
      params.push(req.tenantId);
    }
    sql += ' ORDER BY created_at DESC LIMIT 100';
    const rows = await db.query(sql, params);
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function createIoc(req, res, next) {
  try {
    const { ioc_type, ioc_value, description, severity } = req.body || {};
    if (!ioc_type || !ioc_value) return res.status(400).json({ error: 'ioc_type and ioc_value required' });
    const validTypes = ['hash', 'ip', 'domain', 'path', 'url'];
    if (!validTypes.includes(ioc_type)) return res.status(400).json({ error: 'Invalid ioc_type' });
    const tenantId = req.tenantId ?? null;
    let result;
    try {
      result = await db.execute(
        'INSERT INTO ioc_watchlist (tenant_id, ioc_type, ioc_value, description, severity) VALUES (?, ?, ?, ?, ?)',
        [tenantId, ioc_type, String(ioc_value).trim(), description || null, severity || 'medium']
      );
    } catch (err) {
      if (err.code === 'ER_BAD_FIELD_ERROR' && err.message?.includes('tenant_id')) {
        result = await db.execute(
          'INSERT INTO ioc_watchlist (ioc_type, ioc_value, description, severity) VALUES (?, ?, ?, ?)',
          [ioc_type, String(ioc_value).trim(), description || null, severity || 'medium']
        );
      } else throw err;
    }
    const IocMatchingService = require('../services/IocMatchingService');
    IocMatchingService.invalidateCache();
    res.status(201).json({ id: result.insertId });
  } catch (err) {
    next(err);
  }
}

async function deleteIoc(req, res, next) {
  try {
    await db.execute('DELETE FROM ioc_watchlist WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function getIocMatches(req, res, next) {
  try {
    const matches = await db.query(
      `SELECT m.*, i.ioc_type, i.ioc_value, i.description, i.severity, e.hostname
       FROM ioc_matches m
       JOIN ioc_watchlist i ON i.id = m.ioc_id
       LEFT JOIN endpoints e ON e.id = m.endpoint_id
       ORDER BY m.matched_at DESC
       LIMIT 100`
    );
    res.json(matches || []);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  listIncidents,
  getIncident,
  updateIncidentStatus,
  getEndpointRisk,
  getRiskList,
  listIocs,
  createIoc,
  deleteIoc,
  getIocMatches,
};
