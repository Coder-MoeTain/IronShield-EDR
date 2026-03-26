import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
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

/** Falcon-style: classify remote IP for badge (IPv4-focused; unknown → —) */
function ipScopeLabel(addr) {
  if (!addr || typeof addr !== 'string') return null;
  const a = addr.replace(/^::ffff:/i, '');
  if (a === '::1' || a.startsWith('127.')) return 'loopback';
  const m = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(a);
  if (!m) return null;
  const o = m.slice(1, 5).map((x) => parseInt(x, 10));
  if (o.some((n) => n > 255)) return null;
  const [b1, b2] = o;
  if (b1 === 10) return 'private';
  if (b1 === 172 && b2 >= 16 && b2 <= 31) return 'private';
  if (b1 === 192 && b2 === 168) return 'private';
  if (b1 === 100 && b2 >= 64 && b2 <= 127) return 'private';
  return 'public';
}

const emptyKpi = () => ({
  total_connections: 0,
  unique_remote_ips: 0,
  hosts_with_activity: 0,
  outgoing_destinations: 0,
});

export default function Network() {
  const { api } = useAuth();
  const [searchParams] = useSearchParams();
  const [kpi, setKpi] = useState(emptyKpi);
  const [bandwidth, setBandwidth] = useState({ rx: null, tx: null, at: null });
  const [traffic, setTraffic] = useState([]);
  const [outgoingIps, setOutgoingIps] = useState([]);
  const [connections, setConnections] = useState([]);
  const [logConnections, setLogConnections] = useState([]);
  const [events, setEvents] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('connections');
  const [endpointId, setEndpointId] = useState(searchParams.get('endpointId') || '');
  const [hours, setHours] = useState(24);
  const [autoRefresh, setAutoRefresh] = useState(true);
  /** Hide loopback remotes (::1, 127.0.0.1, ::ffff:127.0.0.1) from API results */
  const [excludeLocalhost, setExcludeLocalhost] = useState(true);
  const [remoteAddress, setRemoteAddress] = useState('');
  const [processFilter, setProcessFilter] = useState('');
  const remoteRef = useRef(remoteAddress);
  const processRef = useRef(processFilter);
  remoteRef.current = remoteAddress;
  processRef.current = processFilter;

  const parseJsonArray = async (r) => {
    if (!r.ok) return [];
    const data = await r.json().catch(() => null);
    return Array.isArray(data) ? data : [];
  };

  const commonQuery = useCallback(() => {
    const params = new URLSearchParams({ hours: String(hours) });
    if (endpointId) params.set('endpointId', endpointId);
    if (excludeLocalhost) params.set('excludeLocalhost', '1');
    return params;
  }, [hours, endpointId, excludeLocalhost]);

  const fetchSummary = useCallback(() => {
    const params = commonQuery();
    return api(`/api/admin/network/summary?${params}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && typeof d === 'object') setKpi({ ...emptyKpi(), ...d });
        else setKpi(emptyKpi());
      })
      .catch(() => setKpi(emptyKpi()));
  }, [api, commonQuery]);

  const fetchTraffic = useCallback(() => {
    const params = commonQuery();
    return api(`/api/admin/network/traffic?${params}`)
      .then(parseJsonArray)
      .then(setTraffic)
      .catch(() => setTraffic([]));
  }, [api, commonQuery]);

  const fetchOutgoingIps = useCallback(() => {
    const params = commonQuery();
    return api(`/api/admin/network/outgoing-ips?${params}`)
      .then(parseJsonArray)
      .then(setOutgoingIps)
      .catch(() => setOutgoingIps([]));
  }, [api, commonQuery]);

  const fetchConnections = useCallback(() => {
    const params = new URLSearchParams({ limit: '100', hours: String(hours) });
    if (endpointId) params.set('endpointId', endpointId);
    if (excludeLocalhost) params.set('excludeLocalhost', '1');
    const ra = remoteRef.current.trim();
    const pn = processRef.current.trim();
    if (ra) params.set('remoteAddress', ra);
    if (pn) params.set('processName', pn);
    return api(`/api/admin/network/connections?${params}`)
      .then(parseJsonArray)
      .then(setConnections)
      .catch(() => setConnections([]));
  }, [api, hours, endpointId, excludeLocalhost]);

  const fetchLogs = useCallback(() => {
    const params = new URLSearchParams({ limit: '100', hours: String(hours) });
    if (endpointId) params.set('endpointId', endpointId);
    if (excludeLocalhost) params.set('excludeLocalhost', '1');
    return api(`/api/admin/network/logs?${params}`)
      .then(async (r) => {
        if (!r.ok) {
          setLogConnections([]);
          setEvents([]);
          return;
        }
        const data = await r.json().catch(() => ({}));
        const conns = data.connections;
        const evs = data.events;
        setLogConnections(Array.isArray(conns) ? conns : []);
        setEvents(Array.isArray(evs) ? evs : []);
      })
      .catch(() => {
        setLogConnections([]);
        setEvents([]);
      });
  }, [api, hours, endpointId, excludeLocalhost]);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([
      fetchSummary(),
      fetchTraffic(),
      fetchOutgoingIps(),
      fetchConnections(),
    ]).finally(() => setLoading(false));
  }, [fetchSummary, fetchTraffic, fetchOutgoingIps, fetchConnections]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  useEffect(() => {
    if (activeTab === 'logs') fetchLogs();
  }, [activeTab, fetchLogs]);

  useEffect(() => {
    if (!autoRefresh) return;
    const id = setInterval(fetchAll, 15000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchAll]);

  useEffect(() => {
    api('/api/admin/endpoints?limit=200')
      .then((r) => r.json())
      .then((d) => setEndpoints(Array.isArray(d) ? d : d?.endpoints || []))
      .catch(() => setEndpoints([]));
  }, [api]);

  useEffect(() => {
    if (!endpointId) {
      setBandwidth({ rx: null, tx: null, at: null });
      return;
    }
    api(`/api/admin/endpoints/${endpointId}/metrics?limit=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        const m = d?.metrics?.[0];
        if (!m) {
          setBandwidth({ rx: null, tx: null, at: null });
          return;
        }
        setBandwidth({
          rx: m.network_rx_mbps ?? null,
          tx: m.network_tx_mbps ?? null,
          at: m.collected_at ?? null,
        });
      })
      .catch(() => setBandwidth({ rx: null, tx: null, at: null }));
  }, [api, endpointId]);

  const trafficRows = useMemo(
    () => (Array.isArray(traffic) ? traffic : []),
    [traffic]
  );
  const outgoingRows = useMemo(
    () => (Array.isArray(outgoingIps) ? outgoingIps : []),
    [outgoingIps]
  );
  const connectionRows = useMemo(
    () => (Array.isArray(connections) ? connections : []),
    [connections]
  );
  const eventRows = useMemo(() => (Array.isArray(events) ? events : []), [events]);
  const logConnRows = useMemo(
    () => (Array.isArray(logConnections) ? logConnections : []),
    [logConnections]
  );

  const fallbackTotal = trafficRows.reduce((s, t) => s + Number(t.total_connections || 0), 0);
  const fallbackUniqueIps = trafficRows.reduce((s, t) => s + Number(t.unique_ips || 0), 0);

  const totalConnections = kpi.total_connections || fallbackTotal;
  const uniqueRemoteIps = kpi.unique_remote_ips || fallbackUniqueIps;
  const hostsWithActivity = kpi.hosts_with_activity || trafficRows.length;
  const outgoingDestinations = kpi.outgoing_destinations || outgoingRows.length;

  return (
    <PageShell
      kicker="Explore"
      title="Network activity"
      description="Live connections, destinations, and traffic by host — filter by time window, endpoint, remote IP, and process. Aligns with Falcon-style network exploration (dense tables, scope badges, IOC follow-up)."
      actions={
        <>
          <label className={styles.autoRefresh}>
            <input type="checkbox" checked={autoRefresh} onChange={(e) => setAutoRefresh(e.target.checked)} />
            Live refresh
          </label>
          <label className={styles.autoRefresh}>
            <input type="checkbox" checked={excludeLocalhost} onChange={(e) => setExcludeLocalhost(e.target.checked)} />
            Exclude localhost
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
          <button type="button" onClick={fetchAll} className="falcon-btn falcon-btn-ghost">
            Refresh
          </button>
          <Link to="/iocs" className="falcon-btn falcon-btn-ghost">
            IOC watchlist
          </Link>
        </>
      }
    >
    <div className={styles.container}>
      <div className={styles.filterBar}>
        <input
          type="search"
          className={styles.filterInput}
          placeholder="Remote IP contains…"
          value={remoteAddress}
          onChange={(e) => setRemoteAddress(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchConnections()}
        />
        <input
          type="search"
          className={styles.filterInput}
          placeholder="Process name contains…"
          value={processFilter}
          onChange={(e) => setProcessFilter(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && fetchConnections()}
        />
        <button type="button" className={styles.filterApply} onClick={fetchConnections}>
          Apply to connections
        </button>
      </div>

      <div className={styles.statsBar}>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{totalConnections.toLocaleString()}</span>
          <span className={styles.statLabel}>Connections (window)</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{uniqueRemoteIps.toLocaleString()}</span>
          <span className={styles.statLabel}>Unique remote IPs</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{outgoingDestinations.toLocaleString()}</span>
          <span className={styles.statLabel}>Outgoing destinations</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{hostsWithActivity.toLocaleString()}</span>
          <span className={styles.statLabel}>Hosts with activity</span>
        </div>
        {endpointId ? (
          <div className={styles.statCard}>
            <span className={styles.statValue}>
              {bandwidth.rx != null ? `${bandwidth.rx}` : '—'} / {bandwidth.tx != null ? `${bandwidth.tx}` : '—'}
            </span>
            <span className={styles.statLabel}>
              Bandwidth RX/TX Mbps {bandwidth.at ? `· ${timeAgo(bandwidth.at)}` : ''}
            </span>
          </div>
        ) : null}
      </div>

      <div className={styles.tabs} role="tablist">
        <button type="button" role="tab" aria-selected={activeTab === 'connections'} className={activeTab === 'connections' ? styles.tabActive : ''} onClick={() => setActiveTab('connections')}>
          Connections
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'outgoing'} className={activeTab === 'outgoing' ? styles.tabActive : ''} onClick={() => setActiveTab('outgoing')}>
          Outgoing IPs
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'traffic'} className={activeTab === 'traffic' ? styles.tabActive : ''} onClick={() => setActiveTab('traffic')}>
          Traffic by endpoint
        </button>
        <button type="button" role="tab" aria-selected={activeTab === 'logs'} className={activeTab === 'logs' ? styles.tabActive : ''} onClick={() => setActiveTab('logs')}>
          Network logs
        </button>
      </div>

      {loading && <div className={styles.loading}>Loading…</div>}

      {activeTab === 'connections' && !loading && (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Endpoint</th>
                <th>Local</th>
                <th>Remote</th>
                <th>Scope</th>
                <th>Protocol</th>
                <th>Process</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {connectionRows.length === 0 && <tr><td colSpan={7} className={styles.empty}>No connections</td></tr>}
              {connectionRows.map((c) => {
                const scope = ipScopeLabel(c.remote_address);
                return (
                  <tr key={c.id}>
                    <td><Link to={`/endpoints/${c.endpoint_id}`} className={styles.link}>{c.hostname || c.endpoint_id}</Link></td>
                    <td className={styles.mono}>{c.local_address || '-'}:{c.local_port ?? '-'}</td>
                    <td className={styles.mono}>{c.remote_address}:{c.remote_port}</td>
                    <td>
                      {scope && (
                        <span className={`${styles.scopeBadge} ${styles[`scope_${scope}`] || ''}`}>
                          {scope === 'private' ? 'RFC1918' : scope === 'public' ? 'External' : scope === 'loopback' ? 'Loopback' : scope}
                        </span>
                      )}
                      {!scope && <span className={styles.muted}>—</span>}
                    </td>
                    <td>{c.protocol || 'TCP'}</td>
                    <td>{c.process_name || '-'}</td>
                    <td className={styles.timeCell}>{timeAgo(c.last_seen)}</td>
                  </tr>
                );
              })}
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
                <th>Scope</th>
                <th>Port</th>
                <th>Protocol</th>
                <th>Endpoint</th>
                <th>Process</th>
                <th>Connections</th>
                <th>Last seen</th>
              </tr>
            </thead>
            <tbody>
              {outgoingRows.length === 0 && <tr><td colSpan={8} className={styles.empty}>No outgoing IPs</td></tr>}
              {outgoingRows.map((r, i) => {
                const scope = ipScopeLabel(r.remote_address);
                return (
                  <tr key={`${r.remote_address}-${r.remote_port}-${r.endpoint_id}-${i}`}>
                    <td className={styles.mono}>{r.remote_address}</td>
                    <td>
                      {scope && (
                        <span className={`${styles.scopeBadge} ${styles[`scope_${scope}`] || ''}`}>
                          {scope === 'private' ? 'RFC1918' : scope === 'public' ? 'External' : scope === 'loopback' ? 'Loopback' : scope}
                        </span>
                      )}
                      {!scope && <span className={styles.muted}>—</span>}
                    </td>
                    <td>{r.remote_port}</td>
                    <td>{r.protocol || 'TCP'}</td>
                    <td><Link to={`/endpoints/${r.endpoint_id}`} className={styles.link}>{r.hostname}</Link></td>
                    <td>{r.process_name || '-'}</td>
                    <td>{r.conn_count}</td>
                    <td className={styles.timeCell}>{timeAgo(r.last_seen)}</td>
                  </tr>
                );
              })}
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
              {trafficRows.length === 0 && <tr><td colSpan={4} className={styles.empty}>No traffic data</td></tr>}
              {trafficRows.map((t) => (
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
          <h3 className={styles.logsHeading}>Connection events &amp; normalized network events</h3>
          <p className={styles.logsHint}>Uses the same time window and filters as the toolbar (endpoint, exclude localhost).</p>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>Endpoint</th>
                  <th>Source</th>
                  <th>Destination</th>
                  <th>Scope</th>
                  <th>Process</th>
                </tr>
              </thead>
              <tbody>
                {logConnRows.length === 0 && eventRows.length === 0 && <tr><td colSpan={6} className={styles.empty}>No network logs</td></tr>}
                {logConnRows.slice(0, 50).map((c) => {
                  const scope = ipScopeLabel(c.remote_address);
                  return (
                    <tr key={c.id}>
                      <td>{c.last_seen ? new Date(c.last_seen).toLocaleString() : '-'}</td>
                      <td><Link to={`/endpoints/${c.endpoint_id}`} className={styles.link}>{c.hostname}</Link></td>
                      <td className={styles.mono}>{c.local_address}:{c.local_port ?? '-'}</td>
                      <td className={styles.mono}>{c.remote_address}:{c.remote_port}</td>
                      <td>
                        {scope && (
                          <span className={`${styles.scopeBadge} ${styles[`scope_${scope}`] || ''}`}>
                            {scope === 'private' ? 'RFC1918' : scope === 'public' ? 'External' : scope === 'loopback' ? 'Loopback' : scope}
                          </span>
                        )}
                        {!scope && <span className={styles.muted}>—</span>}
                      </td>
                      <td>{c.process_name || '-'}</td>
                    </tr>
                  );
                })}
                {eventRows.map((e) => {
                  const scope = ipScopeLabel(e.destination_ip);
                  return (
                    <tr key={e.id}>
                      <td>{e.timestamp ? new Date(e.timestamp).toLocaleString() : '-'}</td>
                      <td><Link to={`/endpoints/${e.endpoint_id}`} className={styles.link}>{e.endpoint_hostname || e.hostname}</Link></td>
                      <td className={styles.mono}>{e.source_ip || '-'}</td>
                      <td className={styles.mono}>{e.destination_ip || '-'}:{e.destination_port ?? '-'}</td>
                      <td>
                        {scope && (
                          <span className={`${styles.scopeBadge} ${styles[`scope_${scope}`] || ''}`}>
                            {scope === 'private' ? 'RFC1918' : scope === 'public' ? 'External' : scope === 'loopback' ? 'Loopback' : scope}
                          </span>
                        )}
                        {!scope && <span className={styles.muted}>—</span>}
                      </td>
                      <td>{e.process_name || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
    </PageShell>
  );
}
