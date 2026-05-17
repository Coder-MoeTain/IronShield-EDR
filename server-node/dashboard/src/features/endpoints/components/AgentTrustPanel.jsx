import React from 'react';
import styles from '../tabs/EndpointDetailTab.module.css';

function fmtDate(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function StatusBadge({ ok, label }) {
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '0.15rem 0.5rem',
        borderRadius: 4,
        fontSize: '0.75rem',
        fontWeight: 600,
        background: ok ? 'var(--success-bg, #e8f5e9)' : 'var(--warning-bg, #fff3e0)',
        color: ok ? 'var(--success-text, #2e7d32)' : 'var(--warning-text, #e65100)',
      }}
    >
      {label}
    </span>
  );
}

/** Agent trust & compliance panel for Endpoint Detail. */
export default function AgentTrustPanel({ endpoint }) {
  if (!endpoint) return null;

  const trust = endpoint.trust || {};
  const compliance = endpoint.compliance || {};

  const signingOk = trust.request_signing_required
    ? !trust.agent_key_revoked
    : true;
  const mtlsOk = trust.mtls_required ? !!trust.cert_fingerprint : true;

  return (
    <div className={styles.grid}>
      <div className={styles.card}>
        <h3>Trust status</h3>
        <dl>
          <dt>Compliance</dt>
          <dd>
            {compliance.status || '—'}
            {compliance.score != null ? ` (${compliance.score}%)` : ''}
          </dd>
          <dt>Request signing</dt>
          <dd>
            <StatusBadge
              ok={signingOk}
              label={
                trust.request_signing_required
                  ? signingOk
                    ? 'Required · OK'
                    : 'Required · issue'
                  : 'Optional (dev)'
              }
            />
          </dd>
          <dt>mTLS</dt>
          <dd>
            <StatusBadge
              ok={mtlsOk}
              label={
                trust.mtls_required
                  ? mtlsOk
                    ? 'Required · bound'
                    : 'Required · not bound'
                  : 'Optional'
              }
            />
          </dd>
          <dt>DPAPI secret</dt>
          <dd>
            {endpoint.agent_key_hash
              ? 'Server stores hashed key only'
              : endpoint.agent_key
                ? 'Legacy plaintext key (rotate)'
                : '—'}
          </dd>
          <dt>Tamper</dt>
          <dd>{trust.tamper_status || endpoint.tamper_status || 'unknown'}</dd>
        </dl>
      </div>

      <div className={styles.card}>
        <h3>Credentials & certificate</h3>
        <dl>
          <dt>Key age</dt>
          <dd>
            {trust.agent_key_age_days != null
              ? `${trust.agent_key_age_days} day(s)`
              : '—'}
            {endpoint.agent_key_created_at
              ? ` · since ${fmtDate(endpoint.agent_key_created_at)}`
              : ''}
          </dd>
          <dt>Key rotation / revoke</dt>
          <dd>
            {trust.agent_key_revoked || endpoint.agent_key_revoked_at
              ? `Revoked ${fmtDate(endpoint.agent_key_revoked_at)}`
              : endpoint.agent_key_rotated_at
                ? `Rotated ${fmtDate(endpoint.agent_key_rotated_at)}`
                : 'Active'}
          </dd>
          <dt>Cert fingerprint</dt>
          <dd className="mono">
            {trust.cert_fingerprint
              ? String(trust.cert_fingerprint).slice(0, 32)
              : 'Not bound'}
          </dd>
          <dt>Cert expiry</dt>
          <dd>{fmtDate(trust.cert_expires_at || endpoint.cert_not_after)}</dd>
          <dt>Cert revoked</dt>
          <dd>{trust.cert_revoked || endpoint.cert_revoked_at ? 'Yes' : 'No'}</dd>
        </dl>
      </div>

      <div className={styles.card}>
        <h3>Operational</h3>
        <dl>
          <dt>Auth failures</dt>
          <dd>{trust.auth_failure_count ?? endpoint.agent_auth_failure_count ?? 0}</dd>
          <dt>Last replay failure</dt>
          <dd>{fmtDate(trust.last_replay_failure_at || endpoint.last_replay_failure_at)}</dd>
          <dt>Last auth failure</dt>
          <dd>{fmtDate(endpoint.last_auth_failure_at)}</dd>
          <dt>Policy version</dt>
          <dd>{trust.policy_version || endpoint.policy_version || '—'}</dd>
          <dt>Agent version</dt>
          <dd>{trust.agent_version || endpoint.agent_version || '—'}</dd>
          <dt>Queue depth</dt>
          <dd>
            {endpoint.queue_depth != null
              ? endpoint.queue_depth.toLocaleString()
              : endpoint.agent_queue_depth != null
                ? endpoint.agent_queue_depth.toLocaleString()
                : '—'}
          </dd>
        </dl>
      </div>
    </div>
  );
}
