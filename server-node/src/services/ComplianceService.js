const db = require('../utils/db');
const config = require('../config');

async function summary(tenantId = null) {
  const tenantFilter = tenantId != null ? 'AND e.tenant_id = ?' : '';
  const tenantParams = tenantId != null ? [tenantId] : [];

  const [openAlertsRow, endpointsRow, mfaRow, auditHashRow] = await Promise.all([
    db.queryOne(
      `SELECT COUNT(*) AS c
       FROM alerts a
       JOIN endpoints e ON e.id = a.endpoint_id
       WHERE a.status IN ('new','investigating') ${tenantFilter}`,
      tenantParams
    ),
    db.queryOne(
      `SELECT COUNT(*) AS c
       FROM endpoints e
       WHERE 1=1 ${tenantId != null ? 'AND e.tenant_id = ?' : ''}`,
      tenantId != null ? [tenantId] : []
    ),
    db.queryOne(
      `SELECT COUNT(*) AS c FROM admin_users
       WHERE is_active = 1 AND mfa_enabled = 1`
    ),
    db.queryOne(
      `SELECT COUNT(*) AS c FROM audit_logs
       WHERE entry_hash IS NOT NULL AND entry_hash <> ''`
    ),
  ]);

  const controls = {
    tls_enforced_prod: !!config.security?.enforceTlsInProduction,
    mtls_enforced_prod: !!config.security?.enforceAgentMtlsInProduction,
    mfa_required_local_login: !!config.auth?.requireMfaForLocalLogin,
    mfa_required_all_admins: !!config.auth?.enforceMfaAllAdmins,
  };

  return {
    generated_at: new Date().toISOString(),
    scope: tenantId != null ? 'tenant' : 'global',
    controls,
    metrics: {
      endpoints_total: endpointsRow?.c || 0,
      alerts_open: openAlertsRow?.c || 0,
      admins_mfa_enabled: mfaRow?.c || 0,
      audit_entries_hashed: auditHashRow?.c || 0,
    },
  };
}

module.exports = { summary };

