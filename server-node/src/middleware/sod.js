const db = require('../utils/db');

const DEFAULT_SOD_MATRIX = {
  response_action_approve: { allowedRoles: ['analyst', 'super_admin'], disallowRequesterOnResponseAction: true },
  response_action_reject: { allowedRoles: ['analyst', 'super_admin'], disallowRequesterOnResponseAction: true },
  agent_key_rotate: { allowedRoles: ['super_admin'] },
  agent_key_revoke: { allowedRoles: ['super_admin'] },
  rbac_set_user_roles: { allowedRoles: ['super_admin'] },
  retention_run: { allowedRoles: ['super_admin'] },
  tenant_delete: { allowedRoles: ['super_admin'] },
};

function roleAllowed(role, allowed) {
  if (!Array.isArray(allowed) || allowed.length === 0) return true;
  return allowed.includes(role);
}

function requireSoD(options = {}) {
  return async (req, res, next) => {
    try {
      const user = req.user || {};
      const role = user.role || 'viewer';
      if (!roleAllowed(role, options.allowedRoles)) {
        return res.status(403).json({ error: 'SoD policy denied for this role' });
      }

      if (options.disallowRequesterOnResponseAction && req.params?.id) {
        const row = await db.queryOne('SELECT requested_by FROM response_actions WHERE id = ? LIMIT 1', [req.params.id]);
        if (row?.requested_by && String(row.requested_by).toLowerCase() === String(user.username || '').toLowerCase()) {
          return res.status(403).json({ error: 'SoD policy: requester cannot approve/reject their own action' });
        }
      }

      return next();
    } catch (err) {
      return next(err);
    }
  };
}

module.exports = { requireSoD, DEFAULT_SOD_MATRIX };

