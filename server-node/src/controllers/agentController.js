/**
 * Agent API controller
 */
const AgentRegistrationService = require('../services/AgentRegistrationService');
const HeartbeatService = require('../services/HeartbeatService');
const EventIngestionService = require('../services/EventIngestionService');
const EndpointService = require('../services/EndpointService');
const ResponseActionService = require('../services/ResponseActionService');
const RtrService = require('../services/RtrService');
const AgentUpdateService = require('../services/AgentUpdateService');
const AgentKeyService = require('../services/AgentKeyService');
const db = require('../utils/db');
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
    if (err.message === 'Unknown tenant slug') {
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
    const endpointId = req.endpointId || (await EndpointService.getByAgentKey(req.agentKey))?.id;
    if (!endpointId) return res.status(401).json({ error: 'Unknown agent key' });

    const body = req.body || {};
    const events = Array.isArray(body.events) ? body.events : (Array.isArray(body) ? body : []);
    const batchId = body.batch_id || body.batchId || null;
    const result = await EventIngestionService.ingestBatch(endpointId, events, { batchId });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function rotateKey(req, res, next) {
  try {
    if (!req.endpointId) return res.status(401).json({ error: 'Unknown agent key' });
    const { agentKey } = await AgentKeyService.rotate(req.endpointId);
    res.json({ agent_key: agentKey });
  } catch (e) {
    next(e);
  }
}

function normalizeActionRowForAgent(row) {
  if (!row) return row;
  const out = { ...row };
  if (typeof out.id === 'bigint') out.id = Number(out.id);
  let p = out.parameters;
  if (p == null) return out;
  if (Buffer.isBuffer(p)) {
    try {
      p = JSON.parse(p.toString('utf8'));
    } catch {
      p = null;
    }
  } else if (typeof p === 'string') {
    try {
      p = JSON.parse(p);
    } catch {
      /* leave string if not valid JSON */
    }
  }
  out.parameters = p;
  return out;
}

async function getPendingActions(req, res, next) {
  try {
    const actions = await ResponseActionService.getPendingForAgent(req.agentKey);
    res.json({ actions: actions.map(normalizeActionRowForAgent) });
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

    const fullAction = await db.queryOne('SELECT * FROM response_actions WHERE id = ?', [id]);

    if (body.success) {
      if (fullAction?.action_type === 'rtr_shell') {
        await RtrService.completeFromAgent(fullAction, true, body.result);
      }
      await ResponseActionService.complete(id, body.message || 'Completed', body.result);
      if (action.action_type === 'lift_isolation') {
        await ResponseActionService.clearHostIsolationOnEndpoint(endpoint.id);
      }
    } else {
      if (fullAction?.action_type === 'rtr_shell') {
        await RtrService.completeFromAgent(fullAction, false, { message: body.message });
      }
      await ResponseActionService.fail(id, body.message || 'Failed');
    }
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

/** Unauthenticated connectivity check for agents / load balancers (no API key). */
function ping(req, res) {
  res.json({
    ok: true,
    service: 'ironshield-edr-agent-api',
    time: new Date().toISOString(),
  });
}

async function checkUpdate(req, res, next) {
  try {
    const currentVersion = req.query.version || req.headers['x-agent-version'] || '1.0.0';
    // authAgentValidated attaches tenantId; ring is stored on endpoint.
    const ringRow = req.endpointId
      ? await db.queryOne('SELECT update_ring FROM endpoints WHERE id = ? LIMIT 1', [req.endpointId])
      : null;
    const ring = ringRow?.update_ring || 'stable';
    const result = await AgentUpdateService.checkUpdate(currentVersion, { tenantId: req.tenantId ?? null, ring });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

module.exports = {
  ping,
  register,
  heartbeat,
  eventsBatch,
  networkConnections,
  getPendingActions,
  submitActionResult,
  checkUpdate,
  rotateKey,
};
