/**
 * mTLS client certificate fingerprint binding for agent endpoints.
 */
const crypto = require('crypto');
const db = require('../utils/db');
const config = require('../config');
const AuditLogService = require('../services/AuditLogService');
const logger = require('../utils/logger');

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
    return {
      subject: cert.subject?.CN || JSON.stringify(cert.subject),
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
    return { ok: false, reason: 'cert_revoked' };
  }

  const bound = endpointRow.cert_fingerprint ? String(endpointRow.cert_fingerprint).toLowerCase() : null;

  if (!bound) {
    const meta = certMetaFromReq(req);
    await db.execute(
      `UPDATE endpoints SET cert_fingerprint = ?, cert_subject = ?, cert_issued_at = ?, cert_expires_at = ?
       WHERE id = ? AND cert_fingerprint IS NULL`,
      [fp, meta.subject || null, meta.issued_at, meta.expires_at, endpointRow.id]
    );
    await AuditLogService.log({
      username: 'system',
      action: 'agent.cert_bound',
      resourceType: 'endpoint',
      resourceId: String(endpointRow.id),
      details: { fingerprint: fp },
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
