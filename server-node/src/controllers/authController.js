/**
 * Auth controller
 */
const AuthService = require('../services/AuthService');
const AuditLogService = require('../services/AuditLogService');

async function login(req, res, next) {
  try {
    const { username, password } = req.validated?.body || req.body;
    const result = await AuthService.login(username, password);

    await AuditLogService.log({
      username: result.user.username,
      action: 'login',
      resourceType: 'auth',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.json(result);
  } catch (err) {
    if (err.message === 'Invalid credentials') {
      return res.status(401).json({ error: err.message });
    }
    next(err);
  }
}

module.exports = { login };
