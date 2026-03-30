import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import RtrHostPanel from '../components/RtrHostPanel';
import styles from './EndpointDetail.module.css';

function formatUptime(sec) {
  if (sec == null || sec === '') return '—';
  const n = Number(sec);
  if (!Number.isFinite(n) || n < 0) return '—';
  const s = Math.floor(n);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m`;
  return `${s}s`;
}

function safeJson(v) {
  if (v == null) return null;
  if (typeof v === 'object') return v;
  if (typeof v === 'string') {
    try {
      return JSON.parse(v);
    } catch {
      return v;
    }
  }
  return v;
}

function pretty(v) {
  const j = safeJson(v);
  if (j == null) return '';
  if (typeof j === 'string') return j;
  try {
    return JSON.stringify(j, null, 2);
  } catch {
    return String(j);
  }
}

function fmtTs(v) {
  if (!v) return '—';
  try {
    return new Date(v).toLocaleString();
  } catch {
    return String(v);
  }
}

function parseInventoryArray(v) {
  const j = safeJson(v);
  return Array.isArray(j) ? j : [];
}

function shareTypeLabel(t) {
  if (t == null || t === '') return '—';
  const n = Number(t);
  if (n === 0) return 'Disk';
  if (n === 1) return 'Print';
  if (n === 3) return 'IPC';
  if (n === 2147483648) return 'Admin disk';
  return String(t);
}

function fmtGb(v) {
  if (v == null || v === '') return '—';
  const n = Number(v);
  if (!Number.isFinite(n)) return '—';
  return `${n.toFixed(2)} GB`;
}

export default function EndpointDetail() {
  const { id } = useParams();
  const { api } = useAuth();
  const [endpoint, setEndpoint] = useState(null);
  const [actions, setActions] = useState([]);
  const [expandedActionIds, setExpandedActionIds] = useState(() => new Set());
  const [loading, setLoading] = useState(true);
  const [actionType, setActionType] = useState('request_heartbeat');
  const [processId, setProcessId] = useState('');
  const [actionMsg, setActionMsg] = useState('');
  const [policies, setPolicies] = useState([]);
  const [assignPolicyId, setAssignPolicyId] = useState('');
  const [triageType, setTriageType] = useState('full');
  const [networkConnections, setNetworkConnections] = useState([]);
  const [networkLoading, setNetworkLoading] = useState(false);
  const [metricsOverride, setMetricsOverride] = useState(null);
  const [hostGroups, setHostGroups] = useState([]);
  const [playbooks, setPlaybooks] = useState([]);
  const [pbId, setPbId] = useState('');
  const [timeline, setTimeline] = useState([]);

  const loadEndpoint = useCallback(() => {
    if (!id) return;
    api(`/api/admin/endpoints/${id}`)
      .then((r) => r.json())
      .then((ep) => {
        setEndpoint(ep);
        if (ep && ep.cpu_percent == null && ep.ram_percent == null && ep.disk_percent == null) {
          api(`/api/admin/endpoints/${id}/metrics?limit=1`)
            .then((m) => m.json())
            .then((data) => {
              if (data?.metrics?.[0]) {
                setMetricsOverride(data.metrics[0]);
              }
            })
            .catch(() => {});
        }
      })
      .catch(() => setEndpoint(null))
      .finally(() => setLoading(false));
  }, [api, id]);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loadEndpoint();
  }, [id, loadEndpoint]);

  useEffect(() => {
    if (!id) return;
    const t = setInterval(() => {
      api(`/api/admin/endpoints/${id}`)
        .then((r) => r.json())
        .then(setEndpoint)
        .catch(() => {});
    }, 45000);
    return () => clearInterval(t);
  }, [id, api]);

  useEffect(() => {
    if (id) {
      api(`/api/admin/endpoints/${id}/actions`)
        .then((r) => r.json())
        .then(setActions)
        .catch(() => setActions([]));
    }
  }, [id]);

  useEffect(() => {
    api('/api/admin/policies')
      .then((r) => r.json())
      .then(setPolicies)
      .catch(() => setPolicies([]));
  }, []);

  useEffect(() => {
    api('/api/admin/host-groups')
      .then((r) => r.json())
      .then(setHostGroups)
      .catch(() => setHostGroups([]));
  }, [api]);

  useEffect(() => {
    api('/api/admin/playbooks')
      .then((r) => r.json())
      .then(setPlaybooks)
      .catch(() => setPlaybooks([]));
  }, [api]);

  useEffect(() => {
    if (!id) return;
    api(`/api/admin/endpoints/${id}/process-timeline?hours=8&limit=80`)
      .then((r) => r.json())
      .then((d) => setTimeline(d.events || []))
      .catch(() => setTimeline([]));
  }, [id, api]);

  const fetchNetwork = () => {
    if (!id) return;
    setNetworkLoading(true);
    api(`/api/admin/network/connections?endpointId=${id}&limit=50`)
      .then((r) => r.json())
      .then(setNetworkConnections)
      .catch(() => setNetworkConnections([]))
      .finally(() => setNetworkLoading(false));
  };

  useEffect(() => {
    fetchNetwork();
    const interval = setInterval(fetchNetwork, 15000);
    return () => clearInterval(interval);
  }, [id]);

  const queueDepth =
    endpoint?.sensor_queue_depth != null && endpoint.sensor_queue_depth !== ''
      ? Number(endpoint.sensor_queue_depth)
      : null;
  const opStatus = (() => {
    if (!endpoint) return null;
    const s = (endpoint.sensor_operational_status || '').toLowerCase();
    if (s === 'degraded') return 'degraded';
    if (s === 'ok' || s === 'healthy' || s === 'operational') return 'ok';
    const hb = endpoint.last_heartbeat_at ? new Date(endpoint.last_heartbeat_at).getTime() : 0;
    if (hb && Date.now() - hb < 5 * 60 * 1000) return 'ok';
    return null;
  })();

  const toggleExpanded = (actionId) => {
    setExpandedActionIds((prev) => {
      const next = new Set(prev);
      if (next.has(actionId)) next.delete(actionId);
      else next.add(actionId);
      return next;
    });
  };

  if (loading) return <PageShell loading loadingLabel="Loading host…" />;
  if (!endpoint) {
    return (
      <PageShell kicker="Hosts" title="Endpoint not found" description="This host may have been removed or the ID is invalid.">
        <div className={styles.error}>Endpoint not found</div>
      </PageShell>
    );
  }

  const tamper = safeJson(endpoint.tamper_signals_json);

  return (
    <PageShell
      kicker="Hosts"
      title={endpoint.hostname}
      description={[
        `Agent ${endpoint.agent_version || '—'} · ${endpoint.ip_address || 'no IP'}`,
        endpoint.tenant_slug ? `CID ${endpoint.tenant_slug}` : null,
      ]
        .filter(Boolean)
        .join(' · ')}
      actions={(
        <>
          <Link to="/endpoints" className="falcon-btn falcon-btn-ghost">← Endpoints</Link>
          <Link to="/rtr" className="falcon-btn falcon-btn-ghost" title="Open global RTR console">
            RTR console
          </Link>
          <span className={`${styles.badge} ${endpoint.status === 'online' ? styles.online : styles.offline}`}>
            {endpoint.status}
          </span>
        </>
      )}
    >
      <section className={styles.sensorStrip} aria-label="Host timeline">
        <div className={styles.sensorStripTitle}>Host timeline</div>
        <div className={styles.sensorStripInner}>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>First seen</span>
            <span className={styles.sensorValue}>
              {endpoint.created_at ? new Date(endpoint.created_at).toLocaleString() : '—'}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Last activity</span>
            <span className={styles.sensorValue}>
              {endpoint.last_heartbeat_at
                ? new Date(endpoint.last_heartbeat_at).toLocaleString()
                : '—'}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Time in console</span>
            <span className={styles.sensorValue}>
              {endpoint.created_at
                ? `${Math.max(
                    0,
                    Math.floor(
                      (Date.now() - new Date(endpoint.created_at).getTime()) / (86400 * 1000)
                    )
                  )} days`
                : '—'}
            </span>
          </div>
        </div>
        <p className={styles.metricsHint} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          Falcon-style host visibility: enrollment time and last sensor check-in (from heartbeats).
        </p>
      </section>

      <section className={styles.sensorStrip} aria-label="Sensor and containment">
        <div className={styles.sensorStripTitle}>Sensor &amp; containment</div>
        <div className={styles.sensorStripInner}>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Operational status</span>
            <span
              className={`${styles.sensorValue} ${
                opStatus === 'degraded' ? styles.sensorDegraded : opStatus === 'ok' ? styles.sensorOk : styles.sensorMuted
              }`}
            >
              {opStatus ? opStatus.toUpperCase() : '—'}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Event queue (backlog)</span>
            <span className={styles.sensorValue}>
              {queueDepth != null ? queueDepth.toLocaleString() : '—'}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Agent uptime</span>
            <span className={styles.sensorValue}>{formatUptime(endpoint.sensor_uptime_seconds)}</span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Network containment</span>
            {endpoint.host_isolation_active === true ||
            endpoint.host_isolation_active === 1 ? (
              <span className={styles.containBadge} title="Firewall containment rules reported active on host">
                ACTIVE
              </span>
            ) : endpoint.host_isolation_active === false ||
              endpoint.host_isolation_active === 0 ? (
              <span className={`${styles.sensorValue} ${styles.sensorMuted}`}>Not active</span>
            ) : (
              <span className={`${styles.sensorValue} ${styles.sensorMuted}`}>—</span>
            )}
          </div>
        </div>
        <p className={styles.metricsHint} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          Values refresh from agent heartbeats (this page polls every ~45s). Falcon-style backlog highlights when the sensor is under load.
        </p>
      </section>

      <section className={styles.sensorStrip} aria-label="Tamper and integrity">
        <div className={styles.sensorStripTitle}>Tamper &amp; integrity</div>
        <div className={styles.sensorStripInner}>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Sensor mode</span>
            <span className={styles.sensorValue}>{tamper?.sensor_mode || '—'}</span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Kernel driver</span>
            <span className={styles.sensorValue}>
              {tamper?.kernel_driver_present === true
                ? 'Reported yes'
                : tamper?.kernel_driver_present === false
                  ? 'No (user-mode)'
                  : '—'}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Tamper risk</span>
            <span
              className={`${styles.sensorValue} ${
                String(tamper?.tamper_risk || '').toLowerCase() === 'high'
                  ? styles.sensorDegraded
                  : String(tamper?.tamper_risk || '').toLowerCase() === 'medium'
                    ? styles.sensorUpdatePending
                    : String(tamper?.tamper_risk || '').toLowerCase() === 'low'
                      ? styles.sensorOk
                      : styles.sensorMuted
              }`}
            >
              {tamper?.tamper_risk ? String(tamper.tamper_risk).toUpperCase() : '—'}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Windows service</span>
            <span className={`${styles.sensorValue} mono`} title={tamper?.windows_service_name || ''}>
              {tamper?.windows_service_status || '—'}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>SCM stop events (24h)</span>
            <span className={styles.sensorValue}>
              {tamper?.service_stop_events_24h != null ? String(tamper.service_stop_events_24h) : '—'}
            </span>
          </div>
        </div>
        {tamper?.agent_binary_path ? (
          <p className={styles.metricsHint} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
            <span className={styles.sensorLabel} style={{ display: 'block', marginBottom: '0.25rem' }}>
              Agent binary
            </span>
            <code style={{ fontSize: '0.72rem', wordBreak: 'break-all', display: 'block' }}>
              {tamper.agent_binary_path}
            </code>
            {tamper.agent_binary_sha256 ? (
              <span className="mono" style={{ fontSize: '0.68rem', display: 'block', marginTop: '0.35rem', opacity: 0.9 }}>
                SHA-256: {tamper.agent_binary_sha256}
              </span>
            ) : null}
          </p>
        ) : null}
        <p className={styles.metricsHint} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          Integrity snapshot from the agent heartbeat (SCM service state + recent stop events). Apply{' '}
          <code className="mono">npm run migrate-tamper-signals</code> on the server if this section stays empty.
        </p>
      </section>

      <section className={styles.sensorStrip} aria-label="Sensor updates">
        <div className={styles.sensorStripTitle}>Sensor updates</div>
        <div className={styles.sensorStripInner}>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Update status</span>
            <span
              className={`${styles.sensorValue} ${
                (endpoint.agent_update_status || '').toLowerCase() === 'update_available'
                  ? styles.sensorUpdatePending
                  : (endpoint.agent_update_status || '').toLowerCase() === 'up_to_date'
                    ? styles.sensorOk
                    : styles.sensorMuted
              }`}
            >
              {(endpoint.agent_update_status || 'unknown').replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Available version</span>
            <span className={`${styles.sensorValue} mono`}>
              {endpoint.available_agent_version || '—'}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Last update check (UTC)</span>
            <span className={styles.sensorValue}>
              {endpoint.last_agent_update_check_at
                ? new Date(endpoint.last_agent_update_check_at).toLocaleString()
                : '—'}
            </span>
          </div>
        </div>
        <p className={styles.metricsHint} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          Compared to the <strong>current</strong> release published under Enterprise → Agent releases. Install updates via your software deployment process.
        </p>
      </section>

      <section className={styles.sensorStrip} aria-label="EDR sensor policy">
        <div className={styles.sensorStripTitle}>Sensor policy (EDR)</div>
        <div className={styles.sensorStripInner}>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Compliance</span>
            <span
              className={`${styles.sensorValue} ${
                (endpoint.policy_compliance_status || '').toLowerCase() === 'mismatch'
                  ? styles.sensorUpdatePending
                  : (endpoint.policy_compliance_status || '').toLowerCase() === 'matched'
                    ? styles.sensorOk
                    : styles.sensorMuted
              }`}
              title={
                (endpoint.policy_compliance_status || '').toLowerCase() === 'mismatch'
                  ? 'Console assignment differs from policy the sensor last applied'
                  : undefined
              }
            >
              {(endpoint.policy_compliance_status || 'unknown').replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Assigned (console)</span>
            <span className={`${styles.sensorValue} mono`} title={endpoint.assigned_policy_name || ''}>
              {endpoint.assigned_policy_id != null && endpoint.assigned_policy_id !== ''
                ? String(endpoint.assigned_policy_id)
                : '—'}
              {endpoint.assigned_policy_name ? (
                <span style={{ color: 'var(--text-muted)', marginLeft: '0.35rem', fontSize: '0.85em' }}>
                  ({endpoint.assigned_policy_name})
                </span>
              ) : null}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Sensor (running)</span>
            <span className={`${styles.sensorValue} mono`} title={endpoint.edr_policy_name || ''}>
              {endpoint.edr_policy_id != null && endpoint.edr_policy_id !== ''
                ? String(endpoint.edr_policy_id)
                : '—'}
              {endpoint.edr_policy_name ? (
                <span style={{ color: 'var(--text-muted)', marginLeft: '0.35rem', fontSize: '0.85em' }}>
                  ({endpoint.edr_policy_name})
                </span>
              ) : null}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Last policy sync (UTC)</span>
            <span className={styles.sensorValue}>
              {endpoint.last_edr_policy_sync_at
                ? new Date(endpoint.last_edr_policy_sync_at).toLocaleString()
                : '—'}
            </span>
          </div>
        </div>
        <p className={styles.metricsHint} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          Assignment from <strong>Policies</strong>; sensor pulls <span className="mono">/api/agent/policy</span>.{' '}
          <strong>Mismatch</strong> means the host has not yet applied the console assignment (or policy changed
          recently).
        </p>
      </section>

      <section className={styles.sensorStrip} aria-label="Malware prevention">
        <div className={styles.sensorStripTitle}>Malware prevention (NGAV)</div>
        <div className={styles.sensorStripInner}>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Prevention status</span>
            <span
              className={`${styles.sensorValue} ${
                (endpoint.av_ngav_prevention_status || '').toLowerCase() === 'degraded'
                  ? styles.sensorUpdatePending
                  : (endpoint.av_ngav_prevention_status || '').toLowerCase() === 'active'
                    ? styles.sensorOk
                    : styles.sensorMuted
              }`}
            >
              {(endpoint.av_ngav_prevention_status || 'unknown').replace(/_/g, ' ').toUpperCase()}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Realtime protection</span>
            <span className={styles.sensorValue}>
              {endpoint.av_ngav_realtime_enabled === true || endpoint.av_ngav_realtime_enabled === 1
                ? 'On'
                : endpoint.av_ngav_realtime_enabled === false || endpoint.av_ngav_realtime_enabled === 0
                  ? 'Off'
                  : '—'}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Signature bundle</span>
            <span className={`${styles.sensorValue} mono`}>{endpoint.av_ngav_bundle_version || '—'}</span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Signatures loaded</span>
            <span className={`${styles.sensorValue} mono`}>
              {endpoint.av_ngav_signature_count != null && endpoint.av_ngav_signature_count !== ''
                ? Number(endpoint.av_ngav_signature_count).toLocaleString()
                : '—'}
            </span>
          </div>
          <div className={styles.sensorItem}>
            <span className={styles.sensorLabel}>Sync status</span>
            <span className={styles.sensorValue}>{endpoint.av_ngav_sync_status || '—'}</span>
          </div>
        </div>
        <p className={styles.metricsHint} style={{ marginTop: '0.75rem', marginBottom: 0 }}>
          <Link to="/av/detections">View malware detections →</Link>
          {' · '}
          <Link to="/av">NGAV overview →</Link>
        </p>
      </section>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>System Info</h3>
          <dl>
            <dt>Hostname</dt>
            <dd>{endpoint.hostname}</dd>
            <dt>Tenant (CID)</dt>
            <dd>
              {endpoint.tenant_slug ? (
                <>
                  <span className="mono">{endpoint.tenant_slug}</span>
                  {endpoint.tenant_name ? (
                    <span style={{ color: 'var(--text-muted)', marginLeft: '0.35rem' }}>
                      ({endpoint.tenant_name})
                    </span>
                  ) : null}
                </>
              ) : (
                '—'
              )}
            </dd>
            <dt>OS Version</dt>
            <dd>{endpoint.os_version || '-'}</dd>
            <dt>Logged-in User</dt>
            <dd>{endpoint.logged_in_user || '-'}</dd>
            <dt>IP Address</dt>
            <dd className="mono">{endpoint.ip_address || '-'}</dd>
            <dt>MAC Address</dt>
            <dd className="mono">{endpoint.mac_address || '-'}</dd>
            <dt>Agent Version</dt>
            <dd>{endpoint.agent_version || '-'}</dd>
            <dt>Host group</dt>
            <dd>
              <select
                value={endpoint.host_group_id ?? ''}
                onChange={async (e) => {
                  const v = e.target.value;
                  const r = await api(`/api/admin/endpoints/${id}`, {
                    method: 'PATCH',
                    body: JSON.stringify({
                      host_group_id: v === '' ? null : parseInt(v, 10),
                    }),
                  });
                  const err = await r.json().catch(() => ({}));
                  if (!r.ok) {
                    alert(err.error || 'Update failed');
                    return;
                  }
                  setEndpoint(err);
                }}
                style={{ maxWidth: '100%', padding: '0.35rem 0.5rem' }}
              >
                <option value="">— None —</option>
                {hostGroups.map((g) => (
                  <option key={g.id} value={g.id}>
                    {g.name}
                  </option>
                ))}
              </select>
            </dd>
          </dl>
        </div>
        <div className={styles.card}>
          <h3>Status</h3>
          <dl>
            <dt>Last Heartbeat</dt>
            <dd>{endpoint.last_heartbeat_at ? new Date(endpoint.last_heartbeat_at).toLocaleString() : '-'}</dd>
            <dt>Policy Status</dt>
            <dd>{endpoint.policy_status || 'normal'}</dd>
            <dt>Created</dt>
            <dd>{endpoint.created_at ? new Date(endpoint.created_at).toLocaleString() : '-'}</dd>
          </dl>
        </div>
        <div className={styles.card}>
          <h3>Resource Metrics</h3>
          <dl>
            <dt>CPU</dt>
            <dd>{(metricsOverride?.cpu_percent ?? endpoint.cpu_percent) != null ? `${(metricsOverride?.cpu_percent ?? endpoint.cpu_percent)}%` : '-'}</dd>
            <dt>RAM</dt>
            <dd>{(metricsOverride?.ram_percent ?? endpoint.ram_percent) != null ? `${(metricsOverride?.ram_percent ?? endpoint.ram_percent)}%` : '-'}</dd>
            <dt>Disk</dt>
            <dd>{(metricsOverride?.disk_percent ?? endpoint.disk_percent) != null ? `${(metricsOverride?.disk_percent ?? endpoint.disk_percent)}%` : '-'}</dd>
            <dt>Net RX</dt>
            <dd>{(metricsOverride?.network_rx_mbps) != null ? `${metricsOverride.network_rx_mbps} Mbps` : '-'}</dd>
            <dt>Net TX</dt>
            <dd>{(metricsOverride?.network_tx_mbps) != null ? `${metricsOverride.network_tx_mbps} Mbps` : '-'}</dd>
          </dl>
          {(metricsOverride?.cpu_percent ?? endpoint.cpu_percent) == null &&
            (metricsOverride?.ram_percent ?? endpoint.ram_percent) == null && (
            <p className={styles.metricsHint}>Metrics appear when the agent reports heartbeat telemetry.</p>
          )}
        </div>
      </div>
      <div className={styles.section}>
        <h3>Real Time Response (RTR)</h3>
        <p className={styles.containHint}>
          Allowlisted remote shell on this host (same as <Link to="/rtr">Respond → RTR</Link>). Ensure the EDR policy
          includes <span className="mono">rtr_shell</span> in allowed response actions.
        </p>
        <RtrHostPanel endpointId={String(id)} hostname={endpoint.hostname} />
      </div>

      <div className={styles.section}>
        <h3>Malware remediation (dashboard)</h3>
        <p className={styles.containHint}>
          One-click response actions for the case study (WPS Update persistence + C2 IP + known payload locations).
          This queues containment + cleanup actions for the agent.
        </p>
        <div className={styles.actionForm} style={{ flexWrap: 'wrap' }}>
          <button
            type="button"
            className="falcon-btn"
            onClick={async () => {
              setActionMsg('');
              try {
                const endpointId = parseInt(id, 10);
                const queue = async (action_type, parameters) => {
                  const r = await api(`/api/admin/endpoints/${endpointId}/actions`, {
                    method: 'POST',
                    body: JSON.stringify({ action_type, parameters }),
                  });
                  const j = await r.json().catch(() => ({}));
                  if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
                  return j;
                };

                // Contain + block C2
                await queue('isolate_host');
                await queue('block_ip', { ip: '103.238.225.248' });

                // Block hashes (IOC watchlist is server-side)
                const hashes = [
                  '247FC07DE4BA8B986A57187F2CA730EEFFA9DDAA96F62BEFE41BC8AE120548A4', // wpscfgio.exe
                  '1D24C5A17275F1424B08DF7F4D9B893E38214A357E741721BB564C73858D24DB', // mfewcui.exe
                  '0A9F43D688F8D1A55F3D7DE8948CF8340A5A9065F3DD2C8A383131A80E1EC2BE', // kso.dll
                  '36299261F41E012B04F914D231C1E5007DB362F101EE6DB4ED638ACFF9697BA9', // gatewayutils.dll
                  '42258C3021E887D6191D8716CFA87CE24624BF730E4CA63A4E25B46746623846', // mfewcui.dat
                  '7D292C71613008F7BCF55564638558A4B90C83FAA2DB24F83C58E6CB132C963F', // payload
                ];
                for (const sha of hashes) {
                  await queue('block_hash', { sha256: sha });
                }

                // Quarantine known files (if present)
                const files = [
                  'C:\\Users\\Public\\office6wkDz\\wpscfgio.exe',
                  'C:\\Users\\Public\\office6wkDz\\mfewcui.exe',
                  'C:\\Users\\Public\\office6wkDz\\mfewcui.dat',
                  'C:\\Program Files (x86)\\Microsoft\\MiscrosoftSACoreCom\\kso.dll',
                  'C:\\Program Files (x86)\\Microsoft\\MiscrosoftSACoreCom\\gatewayutils.dll',
                ];
                for (const fp of files) {
                  await queue('quarantine_file', { file_path: fp });
                }

                // Remove persistence
                await queue('delete_schtask', { task_name: 'WPS Update' });
                await queue('delete_schtask', { task_name: 'HPSmart Update' }); // safe even if not present
                await queue('delete_run_key', {
                  hive: 'HKCU',
                  key_path: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
                  value_name: 'wpsUpdate',
                });
                await queue('delete_run_key', {
                  hive: 'HKCU',
                  key_path: 'SOFTWARE\\Microsoft\\Windows\\CurrentVersion\\Run',
                  value_name: 'MicrosoftSACoreCom',
                });

                // Remove folders (safeguarded allowlist on agent)
                await queue('delete_path', { path: 'C:\\Users\\Public\\office6wkDz\\' });
                await queue('delete_path', { path: 'C:\\Program Files (x86)\\Microsoft\\MiscrosoftSACoreCom\\' });

                setActionMsg('Remediation queued. Watch action status below; keep host isolated until completed.');
                const list = await api(`/api/admin/endpoints/${endpointId}/actions`);
                setActions(await list.json());
              } catch (e) {
                setActionMsg(`Remediation failed: ${e.message || 'Unknown error'}`);
              }
            }}
          >
            Remediate WPS Update malware (queue actions)
          </button>
          <button
            type="button"
            className="falcon-btn falcon-btn-ghost"
            onClick={async () => {
              try {
                const endpointId = parseInt(id, 10);
                const list = await api(`/api/admin/endpoints/${endpointId}/actions`);
                setActions(await list.json());
                setActionMsg('Actions refreshed.');
              } catch {
                setActionMsg('Failed to refresh actions');
              }
            }}
          >
            Refresh actions
          </button>
        </div>
      </div>

      <div className={styles.section}>
        <h3>Response &amp; containment</h3>
        <p className={styles.containHint}>
          <strong>Containment</strong> applies Windows Firewall rules on the host (allows C2 + DNS; blocks other outbound TCP).
          Run the agent as <span className="mono">LocalSystem</span> or Administrator. <strong>Lift</strong> removes rules after the agent completes.
        </p>
        <div className={styles.actionForm}>
          <select value={actionType} onChange={(e) => setActionType(e.target.value)}>
            <option value="request_heartbeat">Request Heartbeat</option>
            <option value="kill_process">Kill Process (tree via taskkill)</option>
            <option value="shutdown_agent">Shutdown agent process</option>
            <option value="rtr_shell">RTR shell command</option>
            <option value="isolate_host">Network containment (isolate)</option>
            <option value="lift_isolation">Lift containment</option>
            <option value="mark_investigating">Mark Investigating</option>
            <option value="collect_triage">Collect Triage</option>
            <option value="quarantine_file">Quarantine file (EDR)</option>
            <option value="block_ip">Block outbound IP (firewall)</option>
            <option value="block_hash">Block file hash (IOC watchlist)</option>
            <option value="run_script">Run allowlisted script</option>
          </select>
          {actionType === 'kill_process' && (
            <input type="number" placeholder="Process ID" value={processId} onChange={(e) => setProcessId(e.target.value)} />
          )}
          {actionType === 'rtr_shell' && (
            <input
              type="text"
              placeholder="Command (agent allowlist, e.g. whoami)"
              value={processId}
              onChange={(e) => setProcessId(e.target.value)}
              className="mono"
              style={{ minWidth: '260px' }}
            />
          )}
          {(actionType === 'quarantine_file' || actionType === 'run_script') && (
            <input type="text" placeholder={actionType === 'quarantine_file' ? 'Full file path' : 'Script path (allowlisted)'} value={processId} onChange={(e) => setProcessId(e.target.value)} className="mono" style={{ minWidth: '240px' }} />
          )}
          {actionType === 'block_ip' && (
            <input type="text" placeholder="IPv4 / IPv6" value={processId} onChange={(e) => setProcessId(e.target.value)} className="mono" />
          )}
          {actionType === 'block_hash' && (
            <input type="text" placeholder="SHA256 hex" value={processId} onChange={(e) => setProcessId(e.target.value)} className="mono" style={{ minWidth: '280px' }} />
          )}
          <button onClick={async () => {
            let params;
            if (actionType === 'kill_process' && processId) params = { process_id: parseInt(processId, 10) };
            else if (actionType === 'shutdown_agent') params = {};
            else if (actionType === 'rtr_shell' && processId) params = { command: processId.trim() };
            else if (actionType === 'quarantine_file' && processId) params = { file_path: processId };
            else if (actionType === 'block_ip' && processId) params = { ip: processId.trim() };
            else if (actionType === 'block_hash' && processId) params = { sha256: processId.trim() };
            else if (actionType === 'run_script' && processId) params = { script_path: processId };
            const res = await api(`/api/admin/endpoints/${id}/actions`, {
              method: 'POST',
              body: JSON.stringify({ action_type: actionType, parameters: params }),
            });
            if (res.ok) {
              setActionMsg('Action queued');
              const list = await api(`/api/admin/endpoints/${id}/actions`);
              setActions(await list.json());
            } else setActionMsg('Failed');
          }}>Execute</button>
        </div>
        {actionMsg && <p className={styles.msg}>{actionMsg}</p>}
        <div className={styles.actionList}>
          {actions.slice(0, 15).map((a) => {
            const isOpen = expandedActionIds.has(a.id);
            const status = String(a.status || '').toLowerCase();
            const statusClass =
              status === 'completed'
                ? styles.actionStatusOk
                : status === 'failed'
                  ? styles.actionStatusBad
                  : styles.actionStatus;
            const hasDetails =
              a.parameters != null ||
              a.result_message != null ||
              a.result_json != null ||
              a.sent_at != null ||
              a.completed_at != null ||
              a.requested_by != null;
            return (
              <div key={a.id} className={styles.actionItem}>
                <div className={styles.actionRow}>
                  <span className={styles.actionType}>
                    <span className="mono">#{a.id}</span> {a.action_type}
                  </span>
                  <span className={statusClass}>{a.status}</span>
                  <span className={styles.actionMeta}>
                    <span>Queued: <span className="mono">{fmtTs(a.created_at)}</span></span>
                    {a.sent_at ? <span>Sent: <span className="mono">{fmtTs(a.sent_at)}</span></span> : null}
                    {a.completed_at ? <span>Done: <span className="mono">{fmtTs(a.completed_at)}</span></span> : null}
                    {a.requested_by ? <span>By: <span className="mono">{a.requested_by}</span></span> : null}
                  </span>
                  {hasDetails ? (
                    <button type="button" className={styles.actionToggle} onClick={() => toggleExpanded(a.id)}>
                      {isOpen ? 'Hide details' : 'Show details'}
                    </button>
                  ) : null}
                </div>

                {hasDetails && isOpen ? (
                  <div className={styles.actionDetails}>
                    <div className={styles.actionDetailsGrid}>
                      <div className={styles.actionDetailsKey}>Parameters</div>
                      <div className={styles.actionDetailsVal}>
                        {a.parameters != null ? <pre className={styles.actionPre}>{pretty(a.parameters)}</pre> : '—'}
                      </div>

                      <div className={styles.actionDetailsKey}>Result</div>
                      <div className={styles.actionDetailsVal}>
                        {a.result_message != null && String(a.result_message).trim()
                          ? String(a.result_message)
                          : status === 'completed'
                            ? 'Completed'
                            : status === 'failed'
                              ? 'Failed'
                              : '—'}
                      </div>

                      <div className={styles.actionDetailsKey}>Output</div>
                      <div className={styles.actionDetailsVal}>
                        {a.result_json != null ? <pre className={styles.actionPre}>{pretty(a.result_json)}</pre> : '—'}
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>
      <div className={styles.section}>
        <h3>Policy Assignment</h3>
        <div className={styles.actionForm}>
          <select value={assignPolicyId} onChange={(e) => setAssignPolicyId(e.target.value)}>
            <option value="">Select policy</option>
            {policies.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.mode})</option>
            ))}
          </select>
          <button onClick={async () => {
            if (!assignPolicyId) return;
            const res = await api(`/api/admin/endpoints/${id}/assign-policy`, {
              method: 'POST',
              body: JSON.stringify({ policy_id: parseInt(assignPolicyId) }),
            });
            if (res.ok) setActionMsg('Policy assigned');
            else setActionMsg('Failed');
          }}>Assign</button>
        </div>
      </div>
      <div className={styles.section}>
        <h3>Triage Request</h3>
        <div className={styles.actionForm}>
          <select value={triageType} onChange={(e) => setTriageType(e.target.value)}>
            <option value="full">Full</option>
            <option value="processes">Processes</option>
            <option value="services">Services</option>
            <option value="startup">Startup</option>
            <option value="network">Network</option>
            <option value="software">Software</option>
            <option value="users">Users</option>
            <option value="scheduled_tasks">Scheduled Tasks</option>
          </select>
          <button onClick={async () => {
            const res = await api(`/api/admin/endpoints/${id}/triage-request`, {
              method: 'POST',
              body: JSON.stringify({ request_type: triageType }),
            });
            if (res.ok) setActionMsg('Triage requested');
            else setActionMsg('Failed');
          }}>Request Triage</button>
        </div>
      </div>
      <div className={styles.section}>
        <h3>Playbook (remediation chain)</h3>
        <p className={styles.containHint}>
          Runs a saved sequence of response actions on this host (queued for the agent in order). Configure playbooks under{' '}
          <Link to="/triage?tab=playbooks">Triage → Playbooks</Link>.
        </p>
        <div className={styles.actionForm}>
          <select value={pbId} onChange={(e) => setPbId(e.target.value)}>
            <option value="">Select playbook…</option>
            {playbooks.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={async () => {
              if (!pbId) return;
              const r = await api(`/api/admin/playbooks/${pbId}/run`, {
                method: 'POST',
                body: JSON.stringify({ endpoint_id: parseInt(id, 10) }),
              });
              const j = await r.json().catch(() => ({}));
              if (r.ok) {
                setActionMsg(`Playbook queued (${(j.action_ids || []).length} actions)`);
                const list = await api(`/api/admin/endpoints/${id}/actions`);
                setActions(await list.json());
              } else setActionMsg(j.error || 'Playbook failed');
            }}
          >
            Run playbook
          </button>
        </div>
      </div>
      <div className={styles.section}>
        <h3>Activity timeline (8h)</h3>
        <p className={styles.containHint}>Normalized events on this host — chronological chain for triage (lite graph).</p>
        <div className={styles.networkTableWrap} style={{ maxHeight: 280, overflow: 'auto' }}>
          {timeline.length === 0 ? (
            <p className={styles.empty}>No normalized events in window.</p>
          ) : (
            <table className={styles.networkTable}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Type</th>
                  <th>Process</th>
                  <th>PID</th>
                  <th>Parent</th>
                </tr>
              </thead>
              <tbody>
                {timeline.map((ev) => (
                  <tr key={ev.id}>
                    <td className={styles.mono}>{ev.timestamp ? new Date(ev.timestamp).toLocaleTimeString() : '—'}</td>
                    <td>{ev.event_type}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.process_name || '—'}</td>
                    <td>{ev.process_id ?? '—'}</td>
                    <td>{ev.parent_process_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className={styles.section} id="open-ports">
        <h3>Open ports (listening)</h3>
        <p className={styles.containHint}>
          TCP/UDP listeners from the agent heartbeat. Refreshes with endpoint poll (~45s).
          {endpoint.host_inventory_at ? (
            <span className={styles.mono}> Last inventory: {fmtTs(endpoint.host_inventory_at)}</span>
          ) : null}
        </p>
        <div className={styles.networkTableWrap}>
          {parseInventoryArray(endpoint.host_listening_ports_json).length === 0 ? (
            <p className={styles.empty}>No listening-port data yet (Windows agent sends this each heartbeat).</p>
          ) : (
            <table className={styles.networkTable}>
              <thead>
                <tr>
                  <th>Protocol</th>
                  <th>Address</th>
                  <th>Port</th>
                </tr>
              </thead>
              <tbody>
                {parseInventoryArray(endpoint.host_listening_ports_json).map((row, i) => (
                  <tr key={`${row.protocol}-${row.local_address}-${row.local_port}-${i}`}>
                    <td>{row.protocol || 'TCP'}</td>
                    <td className={styles.mono}>{row.local_address ?? '—'}</td>
                    <td className={styles.mono}>{row.local_port ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className={styles.section} id="hidden-c">
        <h3>Hidden files &amp; folders (C:)</h3>
        <p className={styles.containHint}>
          Paths on the system drive with the Hidden attribute, collected by the Windows agent (bounded scan, up to 400 entries, depth 4; large subtrees like WinSxS are skipped). Refreshed at most every 6 hours and on each successful scan via heartbeat.
          {endpoint.host_inventory_at ? (
            <span className={styles.mono}> Last inventory: {fmtTs(endpoint.host_inventory_at)}</span>
          ) : null}
        </p>
        <div className={styles.networkTableWrap}>
          {parseInventoryArray(endpoint.host_hidden_c_json).length === 0 ? (
            <p className={styles.empty}>
              No hidden paths reported yet. The Windows agent sends this list after a disk scan (at most every 6 hours per host).
            </p>
          ) : (
            <table className={styles.networkTable}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Path</th>
                </tr>
              </thead>
              <tbody>
                {parseInventoryArray(endpoint.host_hidden_c_json).map((row, i) => (
                  <tr key={`${row.path}-${i}`}>
                    <td>{row.is_directory ? 'Folder' : 'File'}</td>
                    <td className={styles.mono} style={{ maxWidth: 480, wordBreak: 'break-all' }}>
                      {row.path ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className={styles.section} id="disk-usage">
        <h3>Disk usage</h3>
        <p className={styles.containHint}>
          Per-disk space reported by the agent heartbeat.
          {endpoint.host_inventory_at ? (
            <span className={styles.mono}> Last inventory: {fmtTs(endpoint.host_inventory_at)}</span>
          ) : null}
        </p>
        <div className={styles.networkTableWrap}>
          {parseInventoryArray(endpoint.host_disk_usage_json).length === 0 ? (
            <p className={styles.empty}>No disk inventory yet.</p>
          ) : (
            <table className={styles.networkTable}>
              <thead>
                <tr>
                  <th>Mount</th>
                  <th>Label</th>
                  <th>Total</th>
                  <th>Used</th>
                  <th>Free</th>
                  <th>Used %</th>
                </tr>
              </thead>
              <tbody>
                {parseInventoryArray(endpoint.host_disk_usage_json).map((row, i) => (
                  <tr key={`${row.mount}-${i}`}>
                    <td className={styles.mono}>{row.mount ?? '—'}</td>
                    <td>{row.volume_label || '—'}</td>
                    <td>{fmtGb(row.total_gb)}</td>
                    <td>{fmtGb(row.used_gb)}</td>
                    <td>{fmtGb(row.free_gb)}</td>
                    <td>{row.used_percent != null ? `${row.used_percent}%` : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className={styles.section}>
        <h3>Shared folders (SMB)</h3>
        <p className={styles.containHint}>Win32 shares reported by the agent (same heartbeat as open ports).</p>
        <div className={styles.networkTableWrap}>
          {parseInventoryArray(endpoint.host_shared_folders_json).length === 0 ? (
            <p className={styles.empty}>No share data yet.</p>
          ) : (
            <table className={styles.networkTable}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Path</th>
                  <th>Type</th>
                  <th>Caption</th>
                </tr>
              </thead>
              <tbody>
                {parseInventoryArray(endpoint.host_shared_folders_json).map((row, i) => (
                  <tr key={`${row.name}-${i}`}>
                    <td>{row.name ?? '—'}</td>
                    <td className={styles.mono} style={{ maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {row.path ?? '—'}
                    </td>
                    <td>{shareTypeLabel(row.share_type)}</td>
                    <td>{row.caption ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className={styles.section}>
        <h3>Network Activity</h3>
        <div className={styles.networkHeader}>
          <span className={styles.networkHint}>Active connections (refreshes every 15s)</span>
          <button onClick={fetchNetwork} disabled={networkLoading} className={styles.refreshBtn}>
            {networkLoading ? 'Refreshing...' : '↻ Refresh'}
          </button>
          <Link to={`/network?endpointId=${id}`} className={styles.link}>View all →</Link>
        </div>
        <div className={styles.networkTableWrap}>
          {networkConnections.length === 0 && !networkLoading ? (
            <p className={styles.empty}>No network connections. Request triage with type &quot;Network&quot; to capture.</p>
          ) : (
            <table className={styles.networkTable}>
              <thead>
                <tr>
                  <th>Local</th>
                  <th>Remote</th>
                  <th>Protocol</th>
                  <th>Process</th>
                  <th>Last seen</th>
                </tr>
              </thead>
              <tbody>
                {networkConnections.map((c) => (
                  <tr key={c.id}>
                    <td className={styles.mono}>{c.local_address || '-'}:{c.local_port || '-'}</td>
                    <td className={styles.mono}>{c.remote_address}:{c.remote_port}</td>
                    <td>{c.protocol || 'TCP'}</td>
                    <td>{c.process_name || '-'}</td>
                    <td>{c.last_seen ? new Date(c.last_seen).toLocaleTimeString() : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
      <div className={styles.actions}>
        <Link to={`/events?endpointId=${id}`} className={styles.link}>View Events →</Link>
        <Link to={`/endpoints/${id}/process-tree`} className={styles.link}>Process Tree →</Link>
        <Link to={`/network?endpointId=${id}`} className={styles.link}>Network →</Link>
      </div>
    </PageShell>
  );
}
