/**
 * Auth controller
 */
const AuthService = require('../services/AuthService');
const AuditLogService = require('../services/AuditLogService');

async function login(req, res, next) {
  try {
    const { username, password, mfa_code } = req.validated?.body || req.body;
    const result = await AuthService.login(username, password, mfa_code);

    await AuditLogService.log({
      username: result.user.username,
      action: 'login',
      resourceType: 'auth',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(result);
  } catch (err) {
    const attemptedUser = req.validated?.body?.username || req.body?.username || 'unknown';
    await AuditLogService.log({
      username: attemptedUser,
      action: 'login_failed',
      resourceType: 'auth',
      details: { reason: err.message || 'error' },
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    }).catch(() => {});
    if (err.message === 'Account temporarily locked') {
      return res.status(423).json({ error: err.message });
    }
    if (err.message === 'Invalid credentials') {
      return res.status(401).json({ error: err.message });
    }
    if (err.message === 'MFA enrollment required') {
      return res.status(403).json({ error: err.message, mfa_enrollment_required: true });
    }
    if (err.message === 'MFA required') {
      return res.status(401).json({ error: err.message, mfa_required: true });
    }
    next(err);
  }
}

async function mfaStatus(req, res, next) {
  try {
    const s = await AuthService.mfaStatus(req.user.userId);
    res.json(s);
  } catch (err) {
    next(err);
  }
}

async function beginMfaSetup(req, res, next) {
  try {
    const result = await AuthService.beginMfaSetup(req.user.userId, req.user.username);
    await AuditLogService.log({
      userId: req.user.userId,
      username: req.user.username,
      action: 'mfa_setup_started',
      resourceType: 'auth',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json(result);
  } catch (err) {
    next(err);
  }
}

async function enableMfa(req, res, next) {
  try {
    await AuthService.enableMfa(req.user.userId, req.validated?.body?.code || req.body?.code);
    await AuditLogService.log({
      userId: req.user.userId,
      username: req.user.username,
      action: 'mfa_enabled',
      resourceType: 'auth',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.message === 'Invalid MFA code' || err.message === 'MFA setup not started') {
      return res.status(400).json({ error: err.message });
    }
    next(err);
  }
}

async function disableMfa(req, res, next) {
  try {
    await AuthService.disableMfa(req.user.userId, req.validated?.body?.code || req.body?.code);
    await AuditLogService.log({
      userId: req.user.userId,
      username: req.user.username,
      action: 'mfa_disabled',
      resourceType: 'auth',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true });
  } catch (err) {
    if (err.message === 'Invalid MFA code') return res.status(400).json({ error: err.message });
    next(err);
  }
}

async function revokeMySessions(req, res, next) {
  try {
    await AuthService.revokeSessions(req.user.userId);
    await AuditLogService.log({
      userId: req.user.userId,
      username: req.user.username,
      action: 'session_revoke_self',
      resourceType: 'auth',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function revokeUserSessions(req, res, next) {
  try {
    const targetUserId = parseInt(req.params.id, 10);
    if (!Number.isFinite(targetUserId) || targetUserId < 1) return res.status(400).json({ error: 'Invalid user id' });
    await AuthService.revokeSessions(targetUserId);
    await AuditLogService.log({
      userId: req.user.userId,
      username: req.user.username,
      action: 'session_revoke_user',
      resourceType: 'admin_user',
      resourceId: String(targetUserId),
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
}

async function securityPolicy(req, res, next) {
  try {
    res.json(await AuthService.getSecurityPolicy());
  } catch (err) {
    next(err);
  }
}

module.exports = { login, mfaStatus, beginMfaSetup, enableMfa, disableMfa, revokeMySessions, revokeUserSessions, securityPolicy };
