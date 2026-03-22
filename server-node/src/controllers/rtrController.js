/**
 * RTR admin API
 */
const RtrService = require('../services/RtrService');

async function createSession(req, res, next) {
  try {
    const { endpoint_id: endpointId } = req.body || {};
    if (!endpointId) return res.status(400).json({ error: 'endpoint_id required' });
    const id = await RtrService.createSession(
      parseInt(endpointId, 10),
      req.user?.username || 'admin',
      req.tenantId
    );
    res.status(201).json({ id });
  } catch (e) {
    next(e);
  }
}

async function closeSession(req, res, next) {
  try {
    await RtrService.closeSession(req.params.id, req.tenantId);
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
}

async function postCommand(req, res, next) {
  try {
    const { command } = req.body || {};
    const out = await RtrService.queueCommand(
      req.params.id,
      command,
      req.user?.username || 'admin',
      req.tenantId
    );
    res.status(201).json(out);
  } catch (e) {
    next(e);
  }
}

async function getSession(req, res, next) {
  try {
    const s = await RtrService.getSession(req.params.id, req.tenantId);
    if (!s) return res.status(404).json({ error: 'Not found' });
    res.json(s);
  } catch (e) {
    next(e);
  }
}

async function listCommands(req, res, next) {
  try {
    const rows = await RtrService.listCommands(req.params.id, req.tenantId);
    res.json({ commands: rows });
  } catch (e) {
    next(e);
  }
}

module.exports = {
  createSession,
  closeSession,
  postCommand,
  getSession,
  listCommands,
};
