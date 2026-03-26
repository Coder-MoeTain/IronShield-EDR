/**
 * Admin controls for agent keys (revoke/rotate).
 */
const EndpointService = require('../services/EndpointService');
const AgentKeyService = require('../services/AgentKeyService');
const AuditLogService = require('../services/AuditLogService');

async function rotateEndpointKey(req, res, next) {
  try {
    const endpointId = parseInt(req.params.id, 10);
    if (!endpointId) return res.status(400).json({ error: 'endpoint id required' });

    const endpoint = await EndpointService.getById(endpointId, req.tenantId);
    if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' });

    const { agentKey } = await AgentKeyService.rotate(endpointId);
    await AuditLogService.log({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'agent_key_rotate',
      resourceType: 'endpoint',
      resourceId: String(endpointId),
      details: { endpoint_id: endpointId },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ agent_key: agentKey });
  } catch (e) {
    next(e);
  }
}

async function revokeEndpointKey(req, res, next) {
  try {
    const endpointId = parseInt(req.params.id, 10);
    if (!endpointId) return res.status(400).json({ error: 'endpoint id required' });

    const endpoint = await EndpointService.getById(endpointId, req.tenantId);
    if (!endpoint) return res.status(404).json({ error: 'Endpoint not found' });

    const ok = await AgentKeyService.revokeByEndpointId(endpointId);
    await AuditLogService.log({
      userId: req.user?.userId,
      username: req.user?.username,
      action: 'agent_key_revoke',
      resourceType: 'endpoint',
      resourceId: String(endpointId),
      details: { endpoint_id: endpointId, ok },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok });
  } catch (e) {
    next(e);
  }
}

module.exports = { rotateEndpointKey, revokeEndpointKey };

