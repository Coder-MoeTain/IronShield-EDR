/**
 * RTR admin API — hardened allowlisted remote commands.
 */
const RtrService = require('../services/RtrService');
const { ERROR_CODES, sendErrorFromReq } = require('../utils/apiResponse');

async function createSession(req, res, next) {
  try {
    const { endpoint_id: endpointId } = req.body || {};
    if (!endpointId) {
      return sendErrorFromReq(res, req, ERROR_CODES.VALIDATION_ERROR, 'endpoint_id required', 400);
    }
    const id = await RtrService.createSession(
      parseInt(endpointId, 10),
      req.user?.username || 'admin',
      req.tenantId
    );
    res.status(201).json({ id, rtr_enabled: RtrService.isRtrGloballyEnabled() });
  } catch (e) {
    if (e.statusCode) {
      return sendErrorFromReq(res, req, ERROR_CODES.PERMISSION_DENIED, e.message, e.statusCode, {
        code: e.code,
      });
    }
    next(e);
  }
}

async function closeSession(req, res, next) {
  try {
    await RtrService.closeSession(req.params.id, req.tenantId, req.user?.username);
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
    if (e.statusCode) {
      return sendErrorFromReq(res, req, ERROR_CODES.PERMISSION_DENIED, e.message, e.statusCode, {
        code: e.code,
      });
    }
    next(e);
  }
}

async function approveCommand(req, res, next) {
  try {
    const out = await RtrService.approveCommand(
      req.params.commandId,
      req.user?.username || 'admin',
      req.tenantId
    );
    res.json(out);
  } catch (e) {
    next(e);
  }
}

async function getSession(req, res, next) {
  try {
    const s = await RtrService.getSession(req.params.id, req.tenantId);
    if (!s) return sendErrorFromReq(res, req, ERROR_CODES.NOT_FOUND, 'Session not found', 404);
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
  approveCommand,
  getSession,
  listCommands,
};
