/**
 * Phase 4 API - Incidents, Risk, IOC
 */
const IncidentService = require('../modules/incidents/incidentService');
const RiskService = require('../modules/risk/riskService');
const AuditLogService = require('../services/AuditLogService');
const db = require('../utils/db');
const { ERROR_CODES, sendErrorFromReq } = require('../utils/apiResponse');

async function listIncidents(req, res, next) {
  try {
    const { rows, total } = await IncidentService.list({
      ...req.query,
      tenantId: req.tenantId,
    });
    res.json({ incidents: rows, total });
  } catch (err) {
    next(err);
  }
}

async function getIncident(req, res, next) {
  try {
    const inc = await IncidentService.getById(req.params.id, req.tenantId);
    if (!inc) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Incident not found', 404);
    res.json(inc);
  } catch (err) {
    next(err);
  }
}

async function updateIncidentStatus(req, res, next) {
  try {
    const { status } = req.body || {};
    if (!status) return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, 'status required', 400);
    const inc = await IncidentService.getById(req.params.id, req.tenantId);
    if (!inc) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Incident not found', 404);
    await IncidentService.updateStatus(req.params.id, status);
    await AuditLogService.log({
      username: req.user?.username,
      action: 'incident.status_updated',
      resourceType: 'incident',
      resourceId: String(req.params.id),
      details: { status },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function updateIncidentWorkflow(req, res, next) {
  try {
    const { status, lifecycle_phase, owner_username, owner_user_id, sla_minutes, due_at } = req.body || {};
    if (sla_minutes !== undefined && (!Number.isFinite(Number(sla_minutes)) || Number(sla_minutes) < 1)) {
      return sendErrorFromReq(
        res,
        req,
        ERROR_CODES.VALIDATION_ERROR,
        'sla_minutes must be a positive number',
        400
      );
    }
    if (lifecycle_phase) {
      await IncidentService.setLifecyclePhase(
        req.params.id,
        lifecycle_phase,
        req.user?.username,
        req.tenantId
      );
    }
    await IncidentService.updateWorkflow(
      req.params.id,
      {
        status,
        owner_username,
        owner_user_id,
        sla_minutes: sla_minutes === undefined ? undefined : Number(sla_minutes),
        due_at: due_at || null,
      },
      req.tenantId
    );
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function addIncidentNote(req, res, next) {
  try {
    const { body } = req.body || {};
    if (!body) return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, 'body required', 400);
    const id = await IncidentService.addNote(
      req.params.id,
      body,
      req.user?.username,
      req.tenantId
    );
    await AuditLogService.log({
      username: req.user?.username,
      action: 'incident.note_added',
      resourceType: 'incident',
      resourceId: String(req.params.id),
    });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function exportIncident(req, res, next) {
  try {
    const format = String(req.query.format || 'json').toLowerCase();
    const payload = await IncidentService.exportIncident(req.params.id, format, req.tenantId);
    if (!payload) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Incident not found', 404);
    if (format === 'html') {
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      return res.send(payload);
    }
    if (format === 'pdf') {
      return sendErrorFromReq(
        res,
        req,
        ERROR_CODES.VALIDATION_ERROR,
        'PDF export not configured; use format=json or format=html',
        501
      );
    }
    res.setHeader('Content-Type', 'application/json');
    res.send(payload);
  } catch (err) {
    next(err);
  }
}

async function listIncidentEvidence(req, res, next) {
  try {
    res.json(await IncidentService.listEvidence(req.params.id));
  } catch (err) {
    if (String(err.message || '').includes("doesn't exist")) return res.json([]);
    next(err);
  }
}

async function addIncidentEvidence(req, res, next) {
  try {
    const { evidence_type, storage_uri, sha256, size_bytes, custody_note } = req.body || {};
    if (!storage_uri) {
      return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, 'storage_uri required', 400);
    }
    const evidenceId = await IncidentService.addEvidence(req.params.id, {
      evidence_type,
      storage_uri,
      sha256,
      size_bytes,
      custody_note,
      collected_by: req.user?.username || 'unknown',
    });
    res.status(201).json({ id: evidenceId });
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
  updateIncidentWorkflow,
  addIncidentNote,
  exportIncident,
  listIncidentEvidence,
  addIncidentEvidence,
  getEndpointRisk,
  getRiskList,
  listIocs,
  createIoc,
  deleteIoc,
  getIocMatches,
};
