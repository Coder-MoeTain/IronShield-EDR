/**
 * Endpoint compliance scoring for enterprise pilot readiness.
 */
const config = require('../config');

const LATEST_AGENT_VERSION = process.env.LATEST_AGENT_VERSION || null;

function scoreComponent(ok, weight) {
  return ok ? weight : 0;
}

/**
 * @returns {{ score: number, status: 'compliant'|'partial'|'non_compliant'|'unknown', factors: object[] }}
 */
function computeCompliance(endpoint) {
  if (!endpoint) {
    return { score: 0, status: 'unknown', factors: [] };
  }

  const factors = [];
  const weights = {
    online: 15,
    agent_version: 15,
    request_signing: 15,
    mtls: 15,
    ngav: 10,
    telemetry: 10,
    tamper: 10,
    policy_sync: 10,
  };

  const online =
    endpoint.status === 'online' ||
    (endpoint.last_heartbeat_at &&
      Date.now() - new Date(endpoint.last_heartbeat_at).getTime() < 15 * 60 * 1000);
  factors.push({ key: 'online', label: 'Agent online', ok: online, weight: weights.online });
  let score = scoreComponent(online, weights.online);

  let versionOk = true;
  if (LATEST_AGENT_VERSION && endpoint.agent_version) {
    versionOk = String(endpoint.agent_version).trim() === String(LATEST_AGENT_VERSION).trim();
  } else if (!endpoint.agent_version) {
    versionOk = false;
  }
  factors.push({
    key: 'agent_version',
    label: 'Latest agent version',
    ok: versionOk,
    weight: weights.agent_version,
  });
  score += scoreComponent(versionOk, weights.agent_version);

  const signingOk =
    config.agent?.requestSigningRequired !== true ||
    endpoint.agent_key_revoked_at == null;
  factors.push({
    key: 'request_signing',
    label: 'Request signing',
    ok: signingOk,
    weight: weights.request_signing,
  });
  score += scoreComponent(signingOk, weights.request_signing);

  const mtlsOk =
    !config.tls?.agentMtlsRequired ||
    !!(endpoint.cert_fingerprint_sha256 || endpoint.cert_fingerprint);
  factors.push({ key: 'mtls', label: 'mTLS certificate bound', ok: mtlsOk, weight: weights.mtls });
  score += scoreComponent(mtlsOk, weights.mtls);

  const ngavOk =
    endpoint.av_ngav_realtime_enabled === 1 ||
    endpoint.av_ngav_realtime_enabled === true ||
    endpoint.av_ngav_prevention_status === 'enabled';
  factors.push({ key: 'ngav', label: 'NGAV enabled', ok: ngavOk, weight: weights.ngav });
  score += scoreComponent(ngavOk, weights.ngav);

  const telemetryOk = !!(endpoint.sensor_telemetry_enabled ?? endpoint.edr_policy_id);
  factors.push({
    key: 'telemetry',
    label: 'Telemetry modules',
    ok: telemetryOk,
    weight: weights.telemetry,
  });
  score += scoreComponent(telemetryOk, weights.telemetry);

  const tamperOk = !endpoint.tamper_status || endpoint.tamper_status === 'ok';
  factors.push({ key: 'tamper', label: 'Tamper protection', ok: tamperOk, weight: weights.tamper });
  score += scoreComponent(tamperOk, weights.tamper);

  const policyOk = endpoint.policy_compliance_status === 'matched' || endpoint.policy_compliance_status == null;
  factors.push({
    key: 'policy_sync',
    label: 'Policy sync',
    ok: policyOk,
    weight: weights.policy_sync,
  });
  score += scoreComponent(policyOk, weights.policy_sync);

  let status = 'unknown';
  if (score >= 85) status = 'compliant';
  else if (score >= 50) status = 'partial';
  else status = 'non_compliant';

  return { score, status, factors };
}

function enrichTrustPanel(endpoint) {
  const compliance = computeCompliance(endpoint);
  const certFp = endpoint.cert_fingerprint_sha256 || endpoint.cert_fingerprint;
  return {
    ...endpoint,
    compliance,
    trust: {
      agent_key_age_days: endpoint.agent_key_created_at
        ? Math.floor((Date.now() - new Date(endpoint.agent_key_created_at)) / 86400000)
        : null,
      agent_key_expires_at: endpoint.agent_key_expires_at,
      agent_key_revoked: !!endpoint.agent_key_revoked_at,
      request_signing_required: config.agent?.requestSigningRequired === true,
      mtls_required: config.tls?.agentMtlsRequired === true,
      cert_fingerprint: certFp,
      cert_expires_at: endpoint.cert_not_after || endpoint.cert_expires_at,
      cert_bound_at: endpoint.cert_bound_at,
      cert_revoked: !!endpoint.cert_revoked_at,
      last_replay_failure_at: endpoint.last_replay_failure_at,
      auth_failure_count: endpoint.agent_auth_failure_count || 0,
      tamper_status: endpoint.tamper_status || 'unknown',
      policy_version: endpoint.policy_version,
      agent_version: endpoint.agent_version,
    },
  };
}

module.exports = { computeCompliance, enrichTrustPanel };
