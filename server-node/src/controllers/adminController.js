/**
 * Admin API controller
 */
const EndpointService = require('../services/EndpointService');
const EventService = require('../services/EventService');
const NormalizedEventService = require('../services/NormalizedEventService');
const AuditLogService = require('../services/AuditLogService');
const AlertService = require('../services/AlertService');
const ResponseActionService = require('../services/ResponseActionService');
const DashboardService = require('../services/DashboardService');
const MsspService = require('../services/MsspService');
const SavedViewService = require('../services/SavedViewService');
const AnomalyService = require('../services/AnomalyService');
const SiemExportService = require('../services/SiemExportService');
const HostGroupService = require('../services/HostGroupService');
const HuntService = require('../services/HuntService');
const SensorHealthService = require('../services/SensorHealthService');
const DetectionSuppressionService = require('../services/DetectionSuppressionService');
const PlaybookService = require('../services/PlaybookService');
const ProcessTimelineService = require('../services/ProcessTimelineService');
const ComplianceService = require('../services/ComplianceService');
const db = require('../utils/db');
const DetectionRuleService = require('../services/DetectionRuleService');

async function dashboardSummary(req, res, next) {
  try {
    const summary = await DashboardService.getSummary(req.tenantId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function listEndpoints(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    if (req.query.hostGroupId != null && req.query.hostGroupId !== '') {
      filters.hostGroupId = req.query.hostGroupId;
    }
    const endpoints = await EndpointService.list(filters);
    res.json(endpoints);
  } catch (err) {
    next(err);
  }
}

async function getEndpoint(req, res, next) {
  try {
    const { id } = req.params;
    const endpoint = await EndpointService.getById(id, req.tenantId);
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    res.json(endpoint);
  } catch (err) {
    next(err);
  }
}

async function getEndpointMetrics(req, res, next) {
  try {
    const { id } = req.params;
    const endpoint = await EndpointService.getById(id, req.tenantId);
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    const limit = Math.min(parseInt(req.query.limit) || 100, 500);
    const metrics = await EndpointService.getMetrics(id, limit);
    res.json({ endpoint_id: parseInt(id), metrics });
  } catch (err) {
    next(err);
  }
}

async function msspOverview(req, res, next) {
  try {
    const overview = await MsspService.getOverview(req.tenantId);
    res.json(overview);
  } catch (err) {
    next(err);
  }
}

async function deleteEndpoint(req, res, next) {
  try {
    const { id } = req.params;
    const endpoint = await EndpointService.getById(id, req.tenantId);
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    const deleted = await EndpointService.deleteById(id, req.tenantId);
    if (!deleted) {
      return res.status(500).json({ error: 'Failed to delete endpoint' });
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function patchEndpoint(req, res, next) {
  try {
    const updated = await EndpointService.patch(req.params.id, req.body || {}, req.tenantId);
    if (!updated) return res.status(404).json({ error: 'Endpoint not found' });
    res.json(updated);
  } catch (err) {
    if (err.message && /Invalid|not in tenant/i.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function listHostGroups(req, res, next) {
  try {
    const groups = await HostGroupService.list(req.tenantId);
    res.json(groups);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    next(err);
  }
}

async function createHostGroup(req, res, next) {
  try {
    const { name, description } = req.body || {};
    const id = await HostGroupService.create({
      name,
      description,
      tenantId: req.tenantId,
    });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function updateHostGroup(req, res, next) {
  try {
    const ok = await HostGroupService.update(req.params.id, req.body || {}, req.tenantId);
    if (!ok) return res.status(404).json({ error: 'Host group not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function deleteHostGroup(req, res, next) {
  try {
    const ok = await HostGroupService.remove(req.params.id, req.tenantId);
    if (!ok) return res.status(404).json({ error: 'Host group not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function listHuntQueries(req, res, next) {
  try {
    const rows = await HuntService.list();
    res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    next(err);
  }
}

async function createHuntQuery(req, res, next) {
  try {
    const { name, query_params } = req.body || {};
    const id = await HuntService.create({
      name,
      query_params,
      created_by: req.user?.username || null,
    });
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function deleteHuntQuery(req, res, next) {
  try {
    const ok = await HuntService.remove(req.params.id);
    if (!ok) return res.status(404).json({ error: 'Hunt not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function runHuntQuery(req, res, next) {
  try {
    const result = await HuntService.runHunt(req.params.id, req.tenantId);
    if (!result) return res.status(404).json({ error: 'Hunt not found' });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function runHuntAdhoc(req, res, next) {
  try {
    const result = await HuntService.runAdhoc(req.body || {}, req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function runXdrHunt(req, res, next) {
  try {
    const result = await HuntService.runXdrAdhoc(req.body || {}, req.tenantId);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getSensorHealth(req, res, next) {
  try {
    const data = await SensorHealthService.getHealth(req.tenantId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function listEvents(req, res, next) {
  try {
    const filters = req.query;
    const events = await EventService.list(filters);
    const total = await EventService.count(filters);
    res.json({ events, total });
  } catch (err) {
    next(err);
  }
}

async function getEvent(req, res, next) {
  try {
    const { id } = req.params;
    const event = await EventService.getById(id);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (err) {
    next(err);
  }
}

async function listNormalizedEvents(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    const events = await NormalizedEventService.list(filters);
    const total = await NormalizedEventService.count(filters);
    const summary = await NormalizedEventService.getSummary();
    res.json({ events, total, summary });
  } catch (err) {
    next(err);
  }
}

async function getNormalizedEvent(req, res, next) {
  try {
    const { id } = req.params;
    const event = await NormalizedEventService.getById(id);
    if (!event) {
      return res.status(404).json({ error: 'Normalized event not found' });
    }
    const linkedAlerts = await NormalizedEventService.getLinkedAlerts(id);
    res.json({ ...event, linkedAlerts });
  } catch (err) {
    next(err);
  }
}

async function listAuditLogs(req, res, next) {
  try {
    const logs = await AuditLogService.list(req.query);
    res.json(logs);
  } catch (err) {
    next(err);
  }
}

async function listAlerts(req, res, next) {
  try {
    const filters = { ...req.query };
    if (req.tenantId != null) filters.tenantId = req.tenantId;
    const alerts = await AlertService.list(filters);
    const summary = await AlertService.getSummary(req.tenantId);
    res.json({ alerts, summary });
  } catch (err) {
    next(err);
  }
}

async function getAlertsSummary(req, res, next) {
  try {
    const summary = await AlertService.getSummary(req.tenantId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
}

async function getAlert(req, res, next) {
  try {
    const alert = await AlertService.getById(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    res.json(alert);
  } catch (err) {
    next(err);
  }
}

async function updateAlertStatus(req, res, next) {
  try {
    const { id } = req.params;
    const { status, assigned_to } = req.body || {};
    await AlertService.updateStatus(id, status, assigned_to);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function patchAlert(req, res, next) {
  try {
    const body = { ...(req.body || {}) };
    body.updated_by = req.user?.username || null;
    if (body.suppression_reason != null && String(body.suppression_reason).trim()) {
      body.suppressed_by = body.suppressed_by ?? req.user?.username ?? null;
    }
    const updated = await AlertService.patch(req.params.id, body, req.tenantId);
    if (!updated) return res.status(404).json({ error: 'Alert not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function listAlertQualityEvents(req, res, next) {
  try {
    const alert = await AlertService.getById(req.params.id);
    if (!alert) return res.status(404).json({ error: 'Alert not found' });
    const rows = await AlertService.listQualityEvents(req.params.id, Number(req.query.limit || 50));
    res.json(rows);
  } catch (err) {
    next(err);
  }
}

async function submitAlertDisposition(req, res, next) {
  try {
    const { id } = req.params;
    const {
      analyst_disposition,
      disposition_reason,
      analyst_confidence,
      quality_tags,
      status,
      assigned_to,
      assigned_team,
    } = req.body || {};

    const patchBody = {
      analyst_disposition,
      disposition_reason,
      analyst_confidence,
      quality_tags,
      status,
      assigned_to,
      assigned_team,
      updated_by: req.user?.username || null,
    };
    const updated = await AlertService.patch(id, patchBody, req.tenantId);
    if (!updated) return res.status(404).json({ error: 'Alert not found' });
    res.json(updated);
  } catch (err) {
    next(err);
  }
}

async function addAlertNote(req, res, next) {
  try {
    const { id } = req.params;
    const { note } = req.body || {};
    await AlertService.addNote(id, req.user?.username || 'unknown', note);
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function getAlertNotes(req, res, next) {
  try {
    const notes = await AlertService.getNotes(req.params.id);
    res.json(notes);
  } catch (err) {
    next(err);
  }
}

async function createResponseAction(req, res, next) {
  try {
    const { id } = req.params;
    const { action_type, parameters } = req.body || {};
    const actionId = await ResponseActionService.create(
      id,
      action_type,
      parameters,
      req.user?.username || 'unknown',
      req.tenantId
    );
    res.status(201).json({ id: actionId });
  } catch (err) {
    next(err);
  }
}

async function listResponseActions(req, res, next) {
  try {
    const actions = await ResponseActionService.listForEndpoint(req.params.id);
    res.json(actions);
  } catch (err) {
    next(err);
  }
}

async function listDetectionRules(req, res, next) {
  try {
    const rules = await db.query('SELECT * FROM detection_rules ORDER BY name');
    res.json(rules);
  } catch (err) {
    next(err);
  }
}

async function getDetectionRule(req, res, next) {
  try {
    const rule = await DetectionRuleService.getById(req.params.id);
    if (!rule) return res.status(404).json({ error: 'Rule not found' });
    res.json(rule);
  } catch (err) {
    next(err);
  }
}

async function createDetectionRule(req, res, next) {
  try {
    const rule = await DetectionRuleService.create(req.body || {});
    res.status(201).json(rule);
  } catch (err) {
    if (err.message?.includes('required') || err.message?.includes('invalid') || err.message?.includes('must')) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function updateDetectionRule(req, res, next) {
  try {
    const { id } = req.params;
    const { enabled } = req.body || {};
    if (enabled !== undefined) {
      await db.query('UPDATE detection_rules SET enabled = ? WHERE id = ?', [enabled ? 1 : 0, id]);
    }
    const rule = await db.queryOne('SELECT * FROM detection_rules WHERE id = ?', [id]);
    res.json(rule);
  } catch (err) {
    next(err);
  }
}

async function listSavedViews(req, res, next) {
  try {
    const userId = req.user?.userId;
    const views = await SavedViewService.list(userId, req.query.page);
    res.json(views);
  } catch (err) {
    next(err);
  }
}

async function createSavedView(req, res, next) {
  try {
    const userId = req.user?.userId;
    const id = await SavedViewService.create(userId, req.body);
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function deleteSavedView(req, res, next) {
  try {
    const userId = req.user?.userId;
    const ok = await SavedViewService.remove(userId, req.params.id);
    if (!ok) return res.status(404).json({ error: 'Saved view not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function getAnomalies(req, res, next) {
  try {
    const data = await AnomalyService.getRareProcessPaths(req.query);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

async function exportSiemAlerts(req, res, next) {
  try {
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="ironshield-alerts.ndjson"');
    await SiemExportService.streamAlertsNdjson(res, { ...req.query, tenantId: req.tenantId });
    res.end();
  } catch (err) {
    next(err);
  }
}

async function listSuppressions(req, res, next) {
  try {
    const rows = await DetectionSuppressionService.list(req.tenantId);
    res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    next(err);
  }
}

async function createSuppression(req, res, next) {
  try {
    const id = await DetectionSuppressionService.create(req.body || {}, req.user?.username, req.tenantId);
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function patchSuppression(req, res, next) {
  try {
    const ok = await DetectionSuppressionService.update(req.params.id, req.body || {}, req.tenantId);
    if (!ok) return res.status(404).json({ error: 'Suppression not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function deleteSuppression(req, res, next) {
  try {
    const ok = await DetectionSuppressionService.remove(req.params.id, req.tenantId);
    if (!ok) return res.status(404).json({ error: 'Suppression not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function listPlaybooks(req, res, next) {
  try {
    const rows = await PlaybookService.list(req.tenantId);
    res.json(rows);
  } catch (err) {
    if (err.code === 'ER_NO_SUCH_TABLE') return res.json([]);
    next(err);
  }
}

async function createPlaybook(req, res, next) {
  try {
    const id = await PlaybookService.create(req.body || {}, req.user?.username, req.tenantId);
    res.status(201).json({ id });
  } catch (err) {
    next(err);
  }
}

async function deletePlaybook(req, res, next) {
  try {
    const ok = await PlaybookService.remove(req.params.id, req.tenantId);
    if (!ok) return res.status(404).json({ error: 'Playbook not found' });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function runPlaybook(req, res, next) {
  try {
    const { endpoint_id } = req.body || {};
    if (!endpoint_id) return res.status(400).json({ error: 'endpoint_id required' });
    const result = await PlaybookService.execute(
      req.params.id,
      parseInt(endpoint_id, 10),
      req.user?.username || 'unknown',
      req.tenantId
    );
    res.json(result);
  } catch (err) {
    if (err.message && /not found|scope|Invalid/i.test(err.message)) {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function getProcessTimeline(req, res, next) {
  try {
    const endpoint = await EndpointService.getById(req.params.id, req.tenantId);
    if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' });
    const events = await ProcessTimelineService.getTimeline(req.params.id, req.query, req.tenantId);
    res.json({ endpoint_id: parseInt(req.params.id, 10), events });
  } catch (err) {
    next(err);
  }
}

async function getComplianceSummary(req, res, next) {
  try {
    const data = await ComplianceService.summary(req.tenantId);
    res.json(data);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  dashboardSummary,
  listEndpoints,
  getEndpoint,
  patchEndpoint,
  getEndpointMetrics,
  msspOverview,
  deleteEndpoint,
  listHostGroups,
  createHostGroup,
  updateHostGroup,
  deleteHostGroup,
  listHuntQueries,
  createHuntQuery,
  deleteHuntQuery,
  runHuntQuery,
  runHuntAdhoc,
  runXdrHunt,
  getSensorHealth,
  listSuppressions,
  createSuppression,
  patchSuppression,
  deleteSuppression,
  listPlaybooks,
  createPlaybook,
  deletePlaybook,
  runPlaybook,
  getProcessTimeline,
  getComplianceSummary,
  listEvents,
  getEvent,
  listAuditLogs,
  listAlerts,
  getAlertsSummary,
  getAlert,
  updateAlertStatus,
  patchAlert,
  listAlertQualityEvents,
  submitAlertDisposition,
  addAlertNote,
  getAlertNotes,
  listSavedViews,
  createSavedView,
  deleteSavedView,
  getAnomalies,
  exportSiemAlerts,
  createResponseAction,
  listResponseActions,
  listDetectionRules,
  getDetectionRule,
  createDetectionRule,
  updateDetectionRule,
  listNormalizedEvents,
  getNormalizedEvent,
};
