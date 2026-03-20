import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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

  useEffect(() => {
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
  }, [id]);

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

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!endpoint) return <div className={styles.error}>Endpoint not found</div>;

  return (
    <div>
      <div className={styles.header}>
        <Link to="/endpoints" className={styles.back}>← Endpoints</Link>
        <h1 className={styles.title}>{endpoint.hostname}</h1>
        <span className={`${styles.badge} ${endpoint.status === 'online' ? styles.online : styles.offline}`}>
          {endpoint.status}
        </span>
      </div>
      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>System Info</h3>
          <dl>
            <dt>Hostname</dt>
            <dd>{endpoint.hostname}</dd>
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
          {((metricsOverride?.cpu_percent ?? endpoint.cpu_percent) == null || (metricsOverride?.ram_percent ?? endpoint.ram_percent) == null) && (
            <div className={styles.metricsActions}>
              <button
                type="button"
                className={styles.simulateBtn}
                onClick={async () => {
                  setActionMsg('');
                  try {
                    const res = await api(`/api/admin/endpoints/${id}/test-metrics`, {
                      method: 'POST',
                      body: JSON.stringify({ cpu_percent: 42, ram_percent: 68, disk_percent: 55 }),
                    });
                    if (!res.ok) {
                      const err = await res.json().catch(() => ({}));
                      throw new Error(err.error || `Failed (${res.status})`);
                    }
                    const r = await api(`/api/admin/endpoints/${id}`);
                    const ep = await r.json();
                    setEndpoint(ep);
                    setMetricsOverride(null);
                    setActionMsg('Metrics updated');
                    setTimeout(() => setActionMsg(''), 3000);
                  } catch (e) {
                    setActionMsg(e.message || 'Failed');
                  }
                }}
              >
                Simulate metrics
              </button>
              <span className={styles.metricsHint}>Click to add sample data · Agent sends real data on heartbeat</span>
            </div>
          )}
        </div>
      </div>
      <div className={styles.section}>
        <h3>Response Actions</h3>
        <div className={styles.actionForm}>
          <select value={actionType} onChange={(e) => setActionType(e.target.value)}>
            <option value="request_heartbeat">Request Heartbeat</option>
            <option value="kill_process">Kill Process</option>
            <option value="simulate_isolation">Simulate Isolation</option>
            <option value="mark_investigating">Mark Investigating</option>
            <option value="collect_triage">Collect Triage</option>
          </select>
          {actionType === 'kill_process' && (
            <input type="number" placeholder="Process ID" value={processId} onChange={(e) => setProcessId(e.target.value)} />
          )}
          <button onClick={async () => {
            const params = actionType === 'kill_process' && processId ? { process_id: parseInt(processId) } : undefined;
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
    </div>
  );
}
