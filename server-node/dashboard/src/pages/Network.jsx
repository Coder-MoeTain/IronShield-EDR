import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Network.module.css';

function timeAgo(date) {
  if (!date) return '-';
  const d = new Date(date);
  const now = new Date();
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function Network() {
  const { api } = useAuth();
  const [searchParams] = useSearchParams();
  const [traffic, setTraffic] = useState([]);
  const [outgoingIps, setOutgoingIps] = useState([]);
  const [connections, setConnections] = useState([]);
  const [events, setEvents] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('connections');
  const [endpointId, setEndpointId] = useState(searchParams.get('endpointId') || '');
  const [hours, setHours] = useState(24);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchTraffic = () => {
    const params = new URLSearchParams({ hours });
    if (endpointId) params.set('endpointId', endpointId);
    api(`/api/admin/network/traffic?${params}`)
      .then((r) => r.json())
      .then(setTraffic)
      .catch(() => setTraffic([]));
  };

  const fetchOutgoingIps = () => {
    const params = new URLSearchParams({ hours });
    if (endpointId) params.set('endpointId', endpointId);
    api(`/api/admin/network/outgoing-ips?${params}`)
      .then((r) => r.json())
      .then(setOutgoingIps)
      .catch(() => setOutgoingIps([]));
  };

  const fetchConnections = () => {
    const params = new URLSearchParams({ limit: 100 });
    if (endpointId) params.set('endpointId', endpointId);
    api(`/api/admin/network/connections?${params}`)
      .then((r) => r.json())
      .then(setConnections)
      .catch(() => setConnections([]));
  };

  const fetchLogs = () => {
    const params = new URLSearchParams({ limit: 100 });
    if (endpointId) params.set('endpointId', endpointId);
    api(`/api/admin/network/logs?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setConnections(data.connections || []);
        setEvents(data.events || []);
      })
      .catch(() => {
        setConnections([]);
        setEvents([]);
      });
  };

  const fetchAll = () => {
    setLoading(true);
    Promise.all([
      fetchTraffic(),
      fetchOutgoingIps(),
      fetchConnections(),
    ]).finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchAll();
  }, [endpointId, hours]);

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, endpointId]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchAll, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, endpointId, hours]);

  useEffect(() => {
    api('/api/admin/endpoints?limit=200')
      .then((r) => r.json())
      .then((d) => setEndpoints(Array.isArray(d) ? d : (d?.endpoints || [])))
      .catch(() => setEndpoints([]));
  }, []);

  const totalConnections = traffic.reduce((s, t) => s + (t.total_connections || 0), 0);
  const uniqueIps = traffic.reduce((s, t) => s + (t.unique_ips || 0), 0);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>🌐</span> Network
        </h1>
        <div className={styles.controls}>
          <label className={styles.autoRefresh}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Live refresh
          </label>
          <select value={endpointId} onChange={(e) => setEndpointId(e.target.value)} className={styles.select}>
            <option value="">All endpoints</option>
            {endpoints.map((e) => (
              <option key={e.id} value={e.id}>{e.hostname}</option>
            ))}
          </select>
          <select value={hours} onChange={(e) => setHours(Number(e.target.value))} className={styles.select}>
            <option value={1}>Last 1h</option>
            <option value={6}>Last 6h</option>
            <option value={24}>Last 24h</option>
            <option value={168}>Last 7d</option>
          </select>
          <button onClick={fetchAll} className={styles.refreshBtn}>Refresh</button>
        </div>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalConnections}</span>
          <span className={styles.statLabel}>Total connections</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{uniqueIps}</span>
          <span className={styles.statLabel}>Unique IPs</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{traffic.length}</span>
          <span className={styles.statLabel}>Endpoints</span>
        </div>
      </div>

      <div className={styles.tabs}>
        <button className={activeTab === 'connections' ? styles.tabActive : ''} onClick={() => setActiveTab('connections')}>
          Connections
        </button>
        <button className={activeTab === 'outgoing' ? styles.tabActive : ''} onClick={() => setActiveTab('outgoing')}>
          Outgoing IPs
        </button>
        <button className={activeTab === 'traffic' ? styles.tabActive : ''} onClick={() => setActiveTab('traffic')}>
          Traffic by endpoint
        </button>
        <button className={activeTab === 'logs' ? styles.tabActive : ''} onClick={() => setActiveTab('logs')}>
          Network logs
        </button>
      </div>

      {loading && <div className={styles.loading}>Loading...</div>}

      {activeTab === 'connections' && !loading && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Local</th>
                <th>Remote</th>
                <th>Protocol</th>
                <th>Process</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {connections.length === 0 && <tr><td colSpan={6} className={styles.empty}>No connections</td></tr>}
              {connections.map((c) => (
                <tr key={c.id}>
                  <td><Link to={`/endpoints/${c.endpoint_id}`} className={styles.link}>{c.hostname || c.endpoint_id}</Link></td>
                  <td className={styles.mono}>{c.local_address || '-'}:{c.local_port || '-'}</td>
                  <td className={styles.mono}>{c.remote_address}:{c.remote_port}</td>
                  <td>{c.protocol || 'TCP'}</td>
                  <td>{c.process_name || '-'}</td>
                  <td className={styles.timeCell}>{timeAgo(c.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'outgoing' && !loading && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Remote IP</th>
                <th>Port</th>
                <th>Protocol</th>
                <th>Endpoint</th>
                <th>Process</th>
                <th>Connections</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {outgoingIps.length === 0 && <tr><td colSpan={7} className={styles.empty}>No outgoing IPs</td></tr>}
              {outgoingIps.map((r, i) => (
                <tr key={i}>
                  <td className={styles.mono}>{r.remote_address}</td>
                  <td>{r.remote_port}</td>
                  <td>{r.protocol || 'TCP'}</td>
                  <td><Link to={`/endpoints/${r.endpoint_id}`} className={styles.link}>{r.hostname}</Link></td>
                  <td>{r.process_name || '-'}</td>
                  <td>{r.conn_count}</td>
                  <td className={styles.timeCell}>{timeAgo(r.last_seen)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'traffic' && !loading && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Unique IPs</th>
                <th>Total connections</th>
                <th>Last activity</th>
              </tr>
            </thead>
            <tbody>
              {traffic.length === 0 && <tr><td colSpan={4} className={styles.empty}>No traffic data</td></tr>}
              {traffic.map((t) => (
                <tr key={t.endpoint_id}>
                  <td><Link to={`/endpoints/${t.endpoint_id}`} className={styles.link}>{t.hostname}</Link></td>
                  <td>{t.unique_ips}</td>
                  <td>{t.total_connections}</td>
                  <td className={styles.timeCell}>{timeAgo(t.last_activity)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {activeTab === 'logs' && !loading && (
        <div className={styles.logsSection}>
          <h3>Connection events</h3>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Endpoint</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Process</th>
                </tr>
              </thead>
              <tbody>
                {connections.length === 0 && events.length === 0 && <tr><td colSpan={5} className={styles.empty}>No network logs</td></tr>}
                {connections.slice(0, 50).map((c) => (
                  <tr key={c.id}>
                    <td>{c.last_seen ? new Date(c.last_seen).toLocaleString() : '-'}</td>
                    <td><Link to={`/endpoints/${c.endpoint_id}`} className={styles.link}>{c.hostname}</Link></td>
                    <td className={styles.mono}>{c.local_address}:{c.local_port}</td>
                    <td className={styles.mono}>{c.remote_address}:{c.remote_port}</td>
                    <td>{c.process_name || '-'}</td>
                  </tr>
                ))}
                {events.map((e) => (
                  <tr key={e.id}>
                    <td>{e.timestamp ? new Date(e.timestamp).toLocaleString() : '-'}</td>
                    <td><Link to={`/endpoints/${e.endpoint_id}`} className={styles.link}>{e.endpoint_hostname || e.hostname}</Link></td>
                    <td className={styles.mono}>{e.source_ip || '-'}</td>
                    <td className={styles.mono}>{e.destination_ip || '-'}:{e.destination_port || '-'}</td>
                    <td>{e.process_name || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
