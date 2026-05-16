/**
 * mTLS client certificate fingerprint binding for agent endpoints.
 */
const crypto = require('crypto');
const db = require('../utils/db');
const config = require('../config');
const AuditLogService = require('../services/AuditLogService');

function fingerprintFromReq(req) {
  try {
    const cert = req.socket?.getPeerCertificate?.(false);
    if (!cert || !cert.raw) return null;
    return crypto.createHash('sha256').update(cert.raw).digest('hex').toLowerCase();
  } catch {
    return null;
  }
}

function certMetaFromReq(req) {
  try {
    const cert = req.socket?.getPeerCertificate?.(false);
    if (!cert || !cert.subject) return {};
    const issuer =
      cert.issuer?.CN ||
      cert.issuer?.O ||
      (typeof cert.issuer === 'object' ? JSON.stringify(cert.issuer) : String(cert.issuer || ''));
    return {
      subject: cert.subject?.CN || JSON.stringify(cert.subject),
      issuer: issuer.substring(0, 512),
      not_before: cert.valid_from ? new Date(cert.valid_from) : null,
      not_after: cert.valid_to ? new Date(cert.valid_to) : null,
      issued_at: cert.valid_from || null,
      expires_at: cert.valid_to || null,
    };
  } catch {
    return {};
  }
}

async function verifyAgentCertificate(req, endpointRow) {
  if (!config.tls?.agentMtlsRequired) return { ok: true, mode: 'optional' };

  const fp = fingerprintFromReq(req);
  if (!fp) {
    return { ok: false, reason: 'missing_client_cert' };
  }

  if (endpointRow.cert_revoked_at) {
    await AuditLogService.log({
      username: 'system',
      action: 'agent.cert_revoked_rejected',
      resourceType: 'endpoint',
      resourceId: String(endpointRow.id),
    });
    return { ok: false, reason: 'cert_revoked' };
  }

  const bound = (
    endpointRow.cert_fingerprint_sha256 ||
    endpointRow.cert_fingerprint ||
    ''
  )
    .toString()
    .toLowerCase();

  if (!bound) {
    const meta = certMetaFromReq(req);
    await db.execute(
      `UPDATE endpoints SET
         cert_fingerprint = ?, cert_fingerprint_sha256 = ?, cert_subject = ?, cert_issuer = ?,
         cert_not_before = ?, cert_not_after = ?, cert_issued_at = ?, cert_expires_at = ?, cert_bound_at = NOW()
       WHERE id = ? AND (cert_fingerprint IS NULL OR cert_fingerprint = '')`,
      [
        fp,
        fp,
        meta.subject || null,
        meta.issuer || null,
        meta.not_before,
        meta.not_after,
        meta.issued_at,
        meta.expires_at,
        endpointRow.id,
      ]
    );
    await AuditLogService.log({
      username: 'system',
      action: 'agent.cert_bound',
      resourceType: 'endpoint',
      resourceId: String(endpointRow.id),
      details: { fingerprint_sha256: fp, subject: meta.subject },
    });
    return { ok: true, mode: 'bound' };
  }

  if (bound !== fp) {
    await AuditLogService.log({
      username: 'system',
      action: 'agent.cert_mismatch',
      resourceType: 'endpoint',
      resourceId: String(endpointRow.id),
      details: { expected: bound, received: fp },
    });
    return { ok: false, reason: 'cert_fingerprint_mismatch' };
  }

  return { ok: true, mode: 'verified' };
}

module.exports = { fingerprintFromReq, certMetaFromReq, verifyAgentCertificate };
