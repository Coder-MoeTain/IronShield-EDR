const config = require('../config');

function requireMfaCompliant(req, res, next) {
  if (!config.auth?.enforceMfaAllAdmins) return next();
  if (req.user?.role === 'super_admin' && req.user?.mfaCompliant) return next();
  if (req.user?.mfaCompliant) return next();
  return res.status(403).json({
    error: 'MFA enrollment required by organization policy',
    code: 'mfa_policy_block',
  });
}

module.exports = { requireMfaCompliant };

