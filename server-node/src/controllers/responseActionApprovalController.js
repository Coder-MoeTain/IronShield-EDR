/**
 * SOC approvals for response actions
 */
const ResponseActionService = require('../services/ResponseActionService');
const AuditLogService = require('../services/AuditLogService');

async function listPending(req, res, next) {
  try {
    const rows = await ResponseActionService.listPendingApprovals(req.tenantId, 200);
    res.json(rows);
  } catch (e) {
    next(e);
  }
}

async function approve(req, res, next) {
  try {
    const id = req.params.id;
    const user = req.user?.username || 'unknown';
    await ResponseActionService.approve(id, user, { requireTwoPerson: true });
    await AuditLogService.log({
      userId: req.user?.userId,
      username: user,
      action: 'response_action_approve',
      resourceType: 'response_action',
      resourceId: String(id),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message || '').includes('Two-person rule')) return res.status(403).json({ error: e.message });
    if (String(e.message || '').includes('pending approval')) return res.status(409).json({ error: e.message });
    next(e);
  }
}

async function reject(req, res, next) {
  try {
    const id = req.params.id;
    const user = req.user?.username || 'unknown';
    const { reason } = req.body || {};
    await ResponseActionService.reject(id, user, reason);
    await AuditLogService.log({
      userId: req.user?.userId,
      username: user,
      action: 'response_action_reject',
      resourceType: 'response_action',
      resourceId: String(id),
      details: { reason: reason || null },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true });
  } catch (e) {
    if (String(e.message || '').includes('pending approval')) return res.status(409).json({ error: e.message });
    next(e);
  }
}

module.exports = { listPending, approve, reject };

