/**
 * Enterprise guard: require tenant context for non-super_admin users.
 */
const { ERROR_CODES, sendErrorFromReq } = require('../utils/apiResponse');
const { ROLES } = require('../constants/permissions');

function requireTenantContext(req, res, next) {
  if (!req.user) {
    return sendErrorFromReq(
      res,
      req,
      ERROR_CODES.AUTHENTICATION_REQUIRED,
      'Authentication required',
      401
    );
  }
  if (req.user.role === ROLES.SUPER_ADMIN || req.user.role === 'super_admin') {
    return next();
  }
  if (req.tenantId == null) {
    return sendErrorFromReq(
      res,
      req,
      ERROR_CODES.TENANT_CONTEXT_REQUIRED,
      'Tenant context required',
      403
    );
  }
  return next();
}

module.exports = { requireTenantContext };
