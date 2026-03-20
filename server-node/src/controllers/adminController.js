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
const db = require('../utils/db');

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

async function setEndpointTestMetrics(req, res, next) {
  try {
    const { id } = req.params;
    const endpoint = await EndpointService.getById(id, req.tenantId);
    if (!endpoint) {
      return res.status(404).json({ error: 'Endpoint not found' });
    }
    const { cpu_percent, ram_percent, disk_percent } = req.body || {};
    const c = cpu_percent ?? null;
    const r = ram_percent ?? null;
    const d = disk_percent ?? null;

    // Update endpoints table (if columns exist)
    try {
      await db.query(
        `UPDATE endpoints SET cpu_percent = COALESCE(?, cpu_percent), ram_percent = COALESCE(?, ram_percent), disk_percent = COALESCE(?, disk_percent) WHERE id = ?`,
        [c, r, d, id]
      );
    } catch (e) {
      // Columns may not exist - run: mysql < database/schema-endpoint-metrics.sql
    }

    // Insert into endpoint_metrics so metrics history and getById fallback work
    try {
      await db.execute(
        `INSERT INTO endpoint_metrics (endpoint_id, cpu_percent, ram_percent, disk_percent) VALUES (?, ?, ?, ?)`,
        [id, c, r, d]
      );
    } catch (e) {
      // Table may not exist
    }

    res.json({ ok: true, message: 'Test metrics updated. Refresh the page.' });
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
    const filters = req.query;
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
      req.user?.username || 'unknown'
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

module.exports = {
  dashboardSummary,
  listEndpoints,
  getEndpoint,
  getEndpointMetrics,
  setEndpointTestMetrics,
  deleteEndpoint,
  listEvents,
  getEvent,
  listAuditLogs,
  listAlerts,
  getAlertsSummary,
  getAlert,
  updateAlertStatus,
  addAlertNote,
  getAlertNotes,
  createResponseAction,
  listResponseActions,
  listDetectionRules,
  updateDetectionRule,
  listNormalizedEvents,
  getNormalizedEvent,
};
