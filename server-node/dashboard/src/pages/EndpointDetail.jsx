import React, { useCallback, useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './EndpointDetail.module.css';

export default function EndpointDetail() {
  const { id } = useParams();
  const { api } = useAuth();
  const [endpoint, setEndpoint] = useState(null);
  const [actions, setActions] = useState([]);
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

  if (loading) return <PageShell loading loadingLabel="Loading host…" />;
  if (!endpoint) {
    return (
      <PageShell kicker="Hosts" title="Endpoint not found" description="This host may have been removed or the ID is invalid.">
        <div className={styles.error}>Endpoint not found</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      kicker="Hosts"
      title={endpoint.hostname}
      description={`Agent ${endpoint.agent_version || '—'} · ${endpoint.ip_address || 'no IP'}`}
      actions={(
        <>
          <Link to="/endpoints" className="falcon-btn falcon-btn-ghost">← Endpoints</Link>
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
          </dl>
          {(metricsOverride?.cpu_percent ?? endpoint.cpu_percent) == null &&
            (metricsOverride?.ram_percent ?? endpoint.ram_percent) == null && (
            <p className={styles.metricsHint}>Metrics appear when the agent reports heartbeat telemetry.</p>
          )}
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
            <option value="kill_process">Kill Process</option>
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
          {actions.slice(0, 10).map((a) => (
            <div key={a.id} className={styles.actionItem}>
              <span>{a.action_type}</span>
              <span className={styles.actionStatus}>{a.status}</span>
              <span>{new Date(a.created_at).toLocaleString()}</span>
            </div>
          ))}
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
