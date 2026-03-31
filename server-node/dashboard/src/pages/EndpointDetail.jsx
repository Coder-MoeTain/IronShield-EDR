import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import RtrHostPanel from '../components/RtrHostPanel';
import styles from './EndpointDetail.module.css';

const MAIN_TABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'sensor', label: 'Sensor & policies' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'response', label: 'Response' },
];

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
  const [mainTab, setMainTab] = useState('overview');

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
  }, [id, api]);

  useEffect(() => {
    api('/api/admin/policies')
      .then((r) => r.json())
      .then(setPolicies)
      .catch(() => setPolicies([]));
  }, [api]);

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

  const fetchNetwork = useCallback(() => {
    if (!id) return;
    setNetworkLoading(true);
    api(`/api/admin/network/connections?endpointId=${id}&limit=50`)
      .then((r) => r.json())
      .then(setNetworkConnections)
      .catch(() => setNetworkConnections([]))
      .finally(() => setNetworkLoading(false));
  }, [api, id]);

  useEffect(() => {
    fetchNetwork();
    const interval = setInterval(fetchNetwork, 15000);
    return () => clearInterval(interval);
  }, [fetchNetwork]);

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
      <PageShell kicker="Hosts" title="Host not found" description="This host may have been removed or the ID is invalid.">
        <div className={styles.error}>Host not found</div>
      </PageShell>
    );
  }

  const tamper = safeJson(endpoint.tamper_signals_json);
  const enrolledDays =
    endpoint.created_at
      ? Math.max(0, Math.floor((Date.now() - new Date(endpoint.created_at).getTime()) / (86400 * 1000)))
      : null;

  const pageDescription = [
    endpoint.agent_version ? `Agent ${endpoint.agent_version}` : null,
    endpoint.ip_address || null,
    endpoint.tenant_slug ? `CID ${endpoint.tenant_slug}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <PageShell
      kicker="Hosts"
      title={endpoint.hostname}
      description={pageDescription || '—'}
      actions={(
        <>
          <Link to="/endpoints" className="falcon-btn falcon-btn-ghost">← Hosts</Link>
          <Link to="/rtr" className="falcon-btn falcon-btn-ghost" title="Remote shell console">
            RTR
          </Link>
          <span className={`${styles.badge} ${endpoint.status === 'online' ? styles.online : styles.offline}`}>
            {endpoint.status}
          </span>
        </>
      )}
    >
      <div className={styles.tabBar}>
        <div className="ui-segmented" role="tablist" aria-label="Host sections">
          {MAIN_TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={mainTab === t.id}
              onClick={() => setMainTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {mainTab === 'overview' && (
        <div className={styles.tabPanel} role="tabpanel">
          <div className={styles.kpiRow}>
            <div className={styles.kpiChip}>
              <span className={styles.kpiChipLabel}>Last heartbeat</span>
              <span className={styles.kpiChipValue}>
                {endpoint.last_heartbeat_at ? new Date(endpoint.last_heartbeat_at).toLocaleString() : '—'}
              </span>
            </div>
            <div className={styles.kpiChip}>
              <span className={styles.kpiChipLabel}>First seen</span>
              <span className={styles.kpiChipValue}>
                {endpoint.created_at ? new Date(endpoint.created_at).toLocaleString() : '—'}
              </span>
            </div>
            <div className={styles.kpiChip}>
              <span className={styles.kpiChipLabel}>Managed</span>
              <span className={styles.kpiChipValue}>
                {enrolledDays != null ? `${enrolledDays}d` : '—'}
              </span>
            </div>
            <div className={styles.kpiChip}>
              <span className={styles.kpiChipLabel}>Sensor</span>
              <span className={styles.kpiChipValue}>
                {opStatus ? opStatus.toUpperCase() : '—'}
              </span>
            </div>
            <div className={styles.kpiChip}>
              <span className={styles.kpiChipLabel}>Queue</span>
              <span className={styles.kpiChipValue}>
                {queueDepth != null ? queueDepth.toLocaleString() : '—'}
              </span>
            </div>
          </div>

          <div className={styles.grid}>
            <div className={styles.card}>
              <h3>System</h3>
              <dl>
                <dt>Hostname</dt>
                <dd>{endpoint.hostname}</dd>
                <dt>Tenant</dt>
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
                <dt>OS</dt>
                <dd>{endpoint.os_version || '—'}</dd>
                <dt>User</dt>
                <dd>{endpoint.logged_in_user || '—'}</dd>
                <dt>IP / MAC</dt>
                <dd className="mono">
                  {endpoint.ip_address || '—'}
                  {endpoint.mac_address ? ` · ${endpoint.mac_address}` : ''}
                </dd>
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
              <h3>Health</h3>
              <dl>
                <dt>Containment</dt>
                <dd>
                  {endpoint.host_isolation_active === true || endpoint.host_isolation_active === 1 ? (
                    <span className={styles.containBadge}>Active</span>
                  ) : endpoint.host_isolation_active === false || endpoint.host_isolation_active === 0 ? (
                    <span className={styles.sensorMuted}>Off</span>
                  ) : (
                    '—'
                  )}
                </dd>
                <dt>Policy</dt>
                <dd>{endpoint.policy_status || 'normal'}</dd>
                <dt>Compliance</dt>
                <dd>
                  <span
                    className={
                      (endpoint.policy_compliance_status || '').toLowerCase() === 'mismatch'
                        ? styles.sensorUpdatePending
                        : (endpoint.policy_compliance_status || '').toLowerCase() === 'matched'
                          ? styles.sensorOk
                          : styles.sensorMuted
                    }
                  >
                    {(endpoint.policy_compliance_status || 'unknown').replace(/_/g, ' ')}
                  </span>
                </dd>
                <dt>Prevention</dt>
                <dd>
                  <span
                    className={
                      (endpoint.av_ngav_prevention_status || '').toLowerCase() === 'degraded'
                        ? styles.sensorUpdatePending
                        : (endpoint.av_ngav_prevention_status || '').toLowerCase() === 'active'
                          ? styles.sensorOk
                          : styles.sensorMuted
                    }
                  >
                    {(endpoint.av_ngav_prevention_status || 'unknown').replace(/_/g, ' ')}
                  </span>
                </dd>
              </dl>
            </div>
            <div className={styles.card}>
              <h3>Resources</h3>
              <dl>
                <dt>CPU</dt>
                <dd>
                  {(metricsOverride?.cpu_percent ?? endpoint.cpu_percent) != null
                    ? `${metricsOverride?.cpu_percent ?? endpoint.cpu_percent}%`
                    : '—'}
                </dd>
                <dt>RAM</dt>
                <dd>
                  {(metricsOverride?.ram_percent ?? endpoint.ram_percent) != null
                    ? `${metricsOverride?.ram_percent ?? endpoint.ram_percent}%`
                    : '—'}
                </dd>
                <dt>Disk</dt>
                <dd>
                  {(metricsOverride?.disk_percent ?? endpoint.disk_percent) != null
                    ? `${metricsOverride?.disk_percent ?? endpoint.disk_percent}%`
                    : '—'}
                </dd>
                <dt>Net RX / TX</dt>
                <dd>
                  {(metricsOverride?.network_rx_mbps) != null || (metricsOverride?.network_tx_mbps) != null
                    ? `${metricsOverride?.network_rx_mbps ?? '—'} / ${metricsOverride?.network_tx_mbps ?? '—'} Mbps`
                    : '—'}
                </dd>
              </dl>
            </div>
          </div>

          <div className={styles.quickLinks}>
            <Link to={`/events?endpointId=${id}`} className={styles.link}>Events</Link>
            <Link to={`/endpoints/${id}/process-tree`} className={styles.link}>Process tree</Link>
            <Link to={`/network?endpointId=${id}`} className={styles.link}>Network map</Link>
            <Link to="/av/detections" className={styles.link}>Malware detections</Link>
          </div>
        </div>
      )}

      {mainTab === 'sensor' && (
        <div className={styles.tabPanel} role="tabpanel">
          <p className={styles.sectionTitle}>Sensor &amp; containment</p>
          <section className={styles.sensorStrip} aria-label="Sensor and containment">
            <div className={styles.sensorStripInner}>
              <div className={styles.sensorItem}>
                <span className={styles.sensorLabel}>Operational status</span>
                <span
                  className={`${styles.sensorValue} ${
                    opStatus === 'degraded'
                      ? styles.sensorDegraded
                      : opStatus === 'ok'
                        ? styles.sensorOk
                        : styles.sensorMuted
                  }`}
                >
                  {opStatus ? opStatus.toUpperCase() : '—'}
                </span>
              </div>
              <div className={styles.sensorItem}>
                <span className={styles.sensorLabel}>Event queue</span>
                <span className={styles.sensorValue}>
                  {queueDepth != null ? queueDepth.toLocaleString() : '—'}
                </span>
              </div>
              <div className={styles.sensorItem}>
                <span className={styles.sensorLabel}>Agent uptime</span>
                <span className={styles.sensorValue}>{formatUptime(endpoint.sensor_uptime_seconds)}</span>
              </div>
              <div className={styles.sensorItem}>
                <span className={styles.sensorLabel}>Containment</span>
                {endpoint.host_isolation_active === true || endpoint.host_isolation_active === 1 ? (
                  <span className={styles.containBadge}>Active</span>
                ) : endpoint.host_isolation_active === false || endpoint.host_isolation_active === 0 ? (
                  <span className={`${styles.sensorValue} ${styles.sensorMuted}`}>Off</span>
                ) : (
                  <span className={`${styles.sensorValue} ${styles.sensorMuted}`}>—</span>
                )}
              </div>
            </div>
          </section>

          <p className={styles.sectionTitle}>Tamper &amp; integrity</p>
          <section className={styles.sensorStrip} aria-label="Tamper and integrity">
            <div className={styles.sensorStripInner}>
              <div className={styles.sensorItem}>
                <span className={styles.sensorLabel}>Sensor mode</span>
                <span className={styles.sensorValue}>{tamper?.sensor_mode || '—'}</span>
              </div>
              <div className={styles.sensorItem}>
                <span className={styles.sensorLabel}>Kernel driver</span>
                <span className={styles.sensorValue}>
                  {tamper?.kernel_driver_present === true
                    ? 'Yes'
                    : tamper?.kernel_driver_present === false
                      ? 'No'
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
                <span className={styles.sensorLabel}>SCM stop (24h)</span>
                <span className={styles.sensorValue}>
                  {tamper?.service_stop_events_24h != null ? String(tamper.service_stop_events_24h) : '—'}
                </span>
              </div>
            </div>
            {tamper?.agent_binary_path ? (
              <div style={{ marginTop: '0.75rem' }}>
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
              </div>
            ) : null}
          </section>

          <p className={styles.sectionTitle}>Updates</p>
          <section className={styles.sensorStrip} aria-label="Sensor updates">
            <div className={styles.sensorStripInner}>
              <div className={styles.sensorItem}>
                <span className={styles.sensorLabel}>Status</span>
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
                <span className={`${styles.sensorValue} mono`}>{endpoint.available_agent_version || '—'}</span>
              </div>
              <div className={styles.sensorItem}>
                <span className={styles.sensorLabel}>Last check (UTC)</span>
                <span className={styles.sensorValue}>
                  {endpoint.last_agent_update_check_at
                    ? new Date(endpoint.last_agent_update_check_at).toLocaleString()
                    : '—'}
                </span>
              </div>
            </div>
          </section>

          <p className={styles.sectionTitle}>EDR policy</p>
          <section className={styles.sensorStrip} aria-label="EDR sensor policy">
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
                <span className={styles.sensorLabel}>Last sync (UTC)</span>
                <span className={styles.sensorValue}>
                  {endpoint.last_edr_policy_sync_at
                    ? new Date(endpoint.last_edr_policy_sync_at).toLocaleString()
                    : '—'}
                </span>
              </div>
            </div>
          </section>

          <p className={styles.sectionTitle}>Malware prevention (NGAV)</p>
          <section className={styles.sensorStrip} aria-label="Malware prevention">
            <div className={styles.sensorStripInner}>
              <div className={styles.sensorItem}>
                <span className={styles.sensorLabel}>Prevention</span>
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
                <span className={styles.sensorLabel}>Realtime</span>
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
                <span className={styles.sensorLabel}>Sync</span>
                <span className={styles.sensorValue}>{endpoint.av_ngav_sync_status || '—'}</span>
              </div>
            </div>
          </section>
        </div>
      )}

      {mainTab === 'inventory' && (
        <div className={styles.tabPanel} role="tabpanel">
          <div className={styles.section}>
            <h3>Activity (8h)</h3>
            <div className={styles.networkTableWrap} style={{ maxHeight: 280, overflow: 'auto' }}>
              {timeline.length === 0 ? (
                <p className={styles.empty}>No events in this window.</p>
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

          <div className={styles.section}>
            <h3>Listening ports</h3>
            <p className={styles.containHint}>
              {endpoint.host_inventory_at ? (
                <span className={styles.mono}>Inventory: {fmtTs(endpoint.host_inventory_at)}</span>
              ) : null}
            </p>
            <div className={styles.networkTableWrap}>
              {parseInventoryArray(endpoint.host_listening_ports_json).length === 0 ? (
                <p className={styles.empty}>No data yet.</p>
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

          <div className={styles.section}>
            <h3>Hidden paths (C:)</h3>
            <p className={styles.containHint}>
              {endpoint.host_inventory_at ? (
                <span className={styles.mono}>Inventory: {fmtTs(endpoint.host_inventory_at)}</span>
              ) : null}
            </p>
            <div className={styles.networkTableWrap}>
              {parseInventoryArray(endpoint.host_hidden_c_json).length === 0 ? (
                <p className={styles.empty}>No paths reported.</p>
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

          <div className={styles.section}>
            <h3>Disk usage</h3>
            <p className={styles.containHint}>
              {endpoint.host_inventory_at ? (
                <span className={styles.mono}>Inventory: {fmtTs(endpoint.host_inventory_at)}</span>
              ) : null}
            </p>
            <div className={styles.networkTableWrap}>
              {parseInventoryArray(endpoint.host_disk_usage_json).length === 0 ? (
                <p className={styles.empty}>No disk inventory.</p>
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
            <h3>SMB shares</h3>
            <div className={styles.networkTableWrap}>
              {parseInventoryArray(endpoint.host_shared_folders_json).length === 0 ? (
                <p className={styles.empty}>No share data.</p>
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
            <h3>Network connections</h3>
            <div className={styles.networkHeader}>
              <span className={styles.networkHint}>Updates every 15s</span>
              <button type="button" onClick={fetchNetwork} disabled={networkLoading} className={styles.refreshBtn}>
                {networkLoading ? '…' : 'Refresh'}
              </button>
              <Link to={`/network?endpointId=${id}`} className={styles.link}>Open network view</Link>
            </div>
            <div className={styles.networkTableWrap}>
              {networkConnections.length === 0 && !networkLoading ? (
                <p className={styles.empty}>No connections. Run triage (network) to capture.</p>
              ) : (
                <table className={styles.networkTable}>
                  <thead>
                    <tr>
                      <th>Local</th>
                      <th>Remote</th>
                      <th>Protocol</th>
                      <th>Process</th>
                      <th>Seen</th>
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
        </div>
      )}

      {mainTab === 'response' && (
        <div className={styles.tabPanel} role="tabpanel">
          <div className={styles.section}>
            <h3>Remote shell (RTR)</h3>
            <p className={styles.containHint}>
              Requires <span className="mono">rtr_shell</span> in the policy allowlist.{' '}
              <Link to="/rtr">Global RTR</Link>
            </p>
            <RtrHostPanel endpointId={String(id)} hostname={endpoint.hostname} />
          </div>

          <div className={styles.section}>
            <h3>Response actions</h3>
            <p className={styles.containHint}>
              Containment uses host firewall rules. Run the agent with sufficient privileges.
            </p>
            <div className={styles.actionForm}>
              <select value={actionType} onChange={(e) => setActionType(e.target.value)}>
                <option value="request_heartbeat">Request heartbeat</option>
                <option value="kill_process">Kill process</option>
                <option value="shutdown_agent">Shutdown agent</option>
                <option value="rtr_shell">RTR command</option>
                <option value="isolate_host">Network containment</option>
                <option value="lift_isolation">Lift containment</option>
                <option value="mark_investigating">Mark investigating</option>
                <option value="collect_triage">Collect triage</option>
                <option value="quarantine_file">Quarantine file</option>
                <option value="block_ip">Block outbound IP</option>
                <option value="block_hash">Block file hash</option>
                <option value="run_script">Run script</option>
              </select>
              {actionType === 'kill_process' && (
                <input type="number" placeholder="PID" value={processId} onChange={(e) => setProcessId(e.target.value)} />
              )}
              {actionType === 'rtr_shell' && (
                <input
                  type="text"
                  placeholder="Command"
                  value={processId}
                  onChange={(e) => setProcessId(e.target.value)}
                  className="mono"
                  style={{ minWidth: '260px' }}
                />
              )}
              {(actionType === 'quarantine_file' || actionType === 'run_script') && (
                <input
                  type="text"
                  placeholder={actionType === 'quarantine_file' ? 'Full path' : 'Script path'}
                  value={processId}
                  onChange={(e) => setProcessId(e.target.value)}
                  className="mono"
                  style={{ minWidth: '240px' }}
                />
              )}
              {actionType === 'block_ip' && (
                <input type="text" placeholder="IP" value={processId} onChange={(e) => setProcessId(e.target.value)} className="mono" />
              )}
              {actionType === 'block_hash' && (
                <input type="text" placeholder="SHA256" value={processId} onChange={(e) => setProcessId(e.target.value)} className="mono" style={{ minWidth: '280px' }} />
              )}
              <button
                type="button"
                onClick={async () => {
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
                    setActionMsg('Queued');
                    const list = await api(`/api/admin/endpoints/${id}/actions`);
                    setActions(await list.json());
                  } else setActionMsg('Failed');
                }}
              >
                Queue
              </button>
            </div>
            {actionMsg ? <p className={styles.msg}>{actionMsg}</p> : null}
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
                          {isOpen ? 'Hide' : 'Details'}
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
              <button
                type="button"
                onClick={async () => {
                  if (!assignPolicyId) return;
                  const res = await api(`/api/admin/endpoints/${id}/assign-policy`, {
                    method: 'POST',
                    body: JSON.stringify({ policy_id: parseInt(assignPolicyId, 10) }),
                  });
                  if (res.ok) setActionMsg('Policy assigned');
                  else setActionMsg('Failed');
                }}
              >
                Assign
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <h3>Triage</h3>
            <div className={styles.actionForm}>
              <select value={triageType} onChange={(e) => setTriageType(e.target.value)}>
                <option value="full">Full</option>
                <option value="processes">Processes</option>
                <option value="services">Services</option>
                <option value="startup">Startup</option>
                <option value="network">Network</option>
                <option value="software">Software</option>
                <option value="users">Users</option>
                <option value="scheduled_tasks">Scheduled tasks</option>
              </select>
              <button
                type="button"
                onClick={async () => {
                  const res = await api(`/api/admin/endpoints/${id}/triage-request`, {
                    method: 'POST',
                    body: JSON.stringify({ request_type: triageType }),
                  });
                  if (res.ok) setActionMsg('Triage requested');
                  else setActionMsg('Failed');
                }}
              >
                Request
              </button>
            </div>
          </div>

          <div className={styles.section}>
            <h3>Playbook</h3>
            <p className={styles.containHint}>
              <Link to="/triage?tab=playbooks">Manage playbooks</Link>
            </p>
            <div className={styles.actionForm}>
              <select value={pbId} onChange={(e) => setPbId(e.target.value)}>
                <option value="">Select…</option>
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
                Run
              </button>
            </div>
          </div>
        </div>
      )}
    </PageShell>
  );
}
