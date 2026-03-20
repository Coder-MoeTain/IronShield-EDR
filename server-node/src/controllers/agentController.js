/**
 * Agent API controller
 */
const AgentRegistrationService = require('../services/AgentRegistrationService');
const HeartbeatService = require('../services/HeartbeatService');
const EventIngestionService = require('../services/EventIngestionService');
const EndpointService = require('../services/EndpointService');
const ResponseActionService = require('../services/ResponseActionService');
const AgentUpdateService = require('../services/AgentUpdateService');
const logger = require('../utils/logger');

async function register(req, res, next) {
  try {
    const { body } = req.validated;
    const token = req.headers['x-registration-token'] || body?.registration_token;
    const result = await AgentRegistrationService.register(body, token);
    res.status(201).json(result);
  } catch (err) {
    logger.warn({ err: err.message }, 'Registration failed');
    if (err.message === 'Invalid registration token') {
      return res.status(403).json({ error: err.message });
    }
    if (err.message === 'Hostname is required') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function heartbeat(req, res, next) {
  try {
    // Use raw body to ensure connections array is preserved (Zod may strip/transform)
    const body = req.body || req.validated?.body || {};
    const result = await HeartbeatService.processHeartbeat(req.agentKey, body);
    res.json(result);
  } catch (err) {
    if (err.message === 'Unknown agent key') {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
}

async function networkConnections(req, res, next) {
  try {
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) return res.status(401).json({ error: 'Unknown agent key' });

    const body = req.body || {};
    const connections = Array.isArray(body.connections) ? body.connections : (Array.isArray(body) ? body : []);
    const NetworkService = require('../services/NetworkService');

    for (const c of connections.slice(0, 150)) {
      try {
        const local = c.local_address ?? c.local?.address ?? null;
        const localPort = c.local_port ?? c.local?.port ?? null;
        const remote = c.remote_address ?? c.remote?.address ?? null;
        const remotePort = c.remote_port ?? c.remote?.port ?? null;
        if (remote && remote !== '0.0.0.0') {
          await NetworkService.upsertConnection(endpoint.id, {
            local_address: local,
            local_port: localPort,
            remote_address: remote,
            remote_port: remotePort ?? 0,
            protocol: c.protocol || 'TCP',
            state: c.state ?? null,
            process_name: c.process_name ?? null,
            process_path: c.process_path ?? null,
          });
        }
      } catch (e) {
        // ignore per-connection errors
      }
    }
    res.json({ ok: true, count: Math.min(connections.length, 150) });
  } catch (err) {
    next(err);
  }
}

async function eventsBatch(req, res, next) {
  try {
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) {
      return res.status(401).json({ error: 'Unknown agent key' });
    }

    const body = req.body || {};
    const events = Array.isArray(body.events) ? body.events : (Array.isArray(body) ? body : []);
    const result = await EventIngestionService.ingestBatch(endpoint.id, events);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function getPendingActions(req, res, next) {
  try {
    const actions = await ResponseActionService.getPendingForAgent(req.agentKey);
    res.json({ actions });
  } catch (err) {
    next(err);
  }
}

async function submitActionResult(req, res, next) {
  try {
    const { id } = req.params;
    const body = req.body || {};
    const endpoint = await EndpointService.getByAgentKey(req.agentKey);
    if (!endpoint) {
      return res.status(401).json({ error: 'Unknown agent key' });
    }

    const actions = await ResponseActionService.getPendingForAgent(req.agentKey);
    const action = actions.find((a) => String(a.id) === String(id));
    if (!action) {
      return res.status(404).json({ error: 'Action not found' });
    }

    if (body.success) {
      await ResponseActionService.complete(id, body.message || 'Completed', body.result);
    } else {
      await ResponseActionService.fail(id, body.message || 'Failed');
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function checkUpdate(req, res, next) {
  try {
    const currentVersion = req.query.version || req.headers['x-agent-version'] || '1.0.0';
    const result = await AgentUpdateService.checkUpdate(currentVersion);
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  register,
  heartbeat,
  eventsBatch,
  networkConnections,
  getPendingActions,
  submitActionResult,
  checkUpdate,
};
