import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconEmptyState from '../components/FalconEmptyState';
import PermissionGate from '../components/PermissionGate';
import { falconSeverityClass } from '../utils/falconUi';
import styles from './WebUrlProtection.module.css';

function fmtTime(iso) {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function WebUrlProtection() {
  const { api } = useAuth();
  const [loading, setLoading] = useState(true);
  const [blocklist, setBlocklist] = useState(null);
  const [destinations, setDestinations] = useState([]);
  const [hours, setHours] = useState(24);
  const [deleting, setDeleting] = useState(null);

  const fetchBlocklist = useCallback(() => {
    return api('/api/admin/web/url-blocklist')
      .then((r) => (r.ok ? r.json() : null))
      .then(setBlocklist)
      .catch(() => setBlocklist(null));
  }, [api]);

  const fetchDestinations = useCallback(() => {
    const params = new URLSearchParams({ hours: String(hours), limit: '150' });
    return api(`/api/admin/network/web-destinations?${params}`)
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => setDestinations(Array.isArray(d) ? d : []))
      .catch(() => setDestinations([]));
  }, [api, hours]);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.all([fetchBlocklist(), fetchDestinations()]).finally(() => setLoading(false));
  }, [fetchBlocklist, fetchDestinations]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    fetchDestinations();
  }, [hours, fetchDestinations]);

  const deleteIoc = async (id) => {
    setDeleting(id);
    try {
      await api(`/api/admin/iocs/${id}`, { method: 'DELETE' });
      await fetchBlocklist();
    } finally {
      setDeleting(null);
    }
  };

  const iocs = blocklist?.iocs || [];
  const domains = blocklist?.domains || [];
  const policyOn = blocklist?.enabled !== false;

  return (
    <PageShell
      kicker="Intel"
      title="Web & URL protection"
      description="Manage domain and URL IOCs that agents sinkhole in the Windows hosts file, and review top outbound HTTP/S destinations seen in agent network telemetry."
      actions={
        <div className={styles.actions}>
          <Link to="/iocs?type=url&add=1" className="falcon-btn falcon-btn-primary">
            Add URL / domain IOC
          </Link>
          <Link to="/av/policies" className="falcon-btn falcon-btn-ghost">
            AV policies
          </Link>
          <button type="button" className="falcon-btn falcon-btn-ghost" onClick={refresh}>
            Refresh
          </button>
        </div>
      }
    >
      <div className={styles.container}>
        <div className={styles.metrics}>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Policy (hosts sinkhole)</span>
            <span className={`${styles.badge} ${policyOn ? styles.badgeOn : styles.badgeOff}`}>
              {policyOn ? 'Enabled' : 'Disabled'}
            </span>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Blocklist version</span>
            <strong className={styles.metricValue}>{blocklist?.version || '—'}</strong>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>Distinct blocked domains</span>
            <strong className={styles.metricValue}>{loading ? '…' : domains.length}</strong>
          </div>
          <div className={styles.metricCard}>
            <span className={styles.metricLabel}>URL/domain IOC rows</span>
            <strong className={styles.metricValue}>{loading ? '…' : iocs.length}</strong>
          </div>
        </div>

        <div className={styles.grid}>
          <div className={styles.panel}>
            <h2>URL &amp; domain indicators</h2>
            <p className={styles.hint}>
              These IOCs drive the agent blocklist. Domains derived from URL indicators are merged by hostname. Edit entries on
              the{' '}
              <Link to="/iocs">IOC watchlist</Link> or add here.
            </p>
            <div className={styles.tableWrap}>
              {loading && iocs.length === 0 ? (
                <FalconEmptyState title="Loading…" description="" />
              ) : iocs.length === 0 ? (
                <FalconEmptyState
                  title="No domain or URL IOCs"
                  description="Add indicators with type domain or URL to block malicious or phishing sites on managed Windows agents."
                />
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Value</th>
                      <th>Severity</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {iocs.map((row) => (
                      <tr key={row.id}>
                        <td className={styles.mono}>{row.ioc_type}</td>
                        <td className={styles.mono} title={row.ioc_value}>
                          {row.ioc_value?.length > 64 ? `${row.ioc_value.slice(0, 64)}…` : row.ioc_value}
                        </td>
                        <td>
                          <span className={falconSeverityClass(row.severity)}>{row.severity || '—'}</span>
                        </td>
                        <td>
                          <PermissionGate permission="rules:write">
                            <button
                              type="button"
                              className="falcon-btn falcon-btn-ghost"
                              disabled={deleting === row.id}
                              onClick={() => deleteIoc(row.id)}
                            >
                              {deleting === row.id ? '…' : 'Remove'}
                            </button>
                          </PermissionGate>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className={styles.panel}>
            <h2>Effective sinkhole domains</h2>
            <p className={styles.hint}>
              Hostnames the agent resolves to <span className={styles.mono}>127.0.0.1</span> when policy and elevation allow.
              Your management server host is never blocked.
            </p>
            <div className={styles.tableWrap}>
              {domains.length === 0 ? (
                <FalconEmptyState
                  title="No derived domains yet"
                  description="Add domain or URL IOCs, or adjust values so they parse to a valid hostname."
                />
              ) : (
                <table className={styles.table}>
                  <thead>
                    <tr>
                      <th>Domain</th>
                    </tr>
                  </thead>
                  <tbody>
                    {domains.map((d) => (
                      <tr key={d}>
                        <td className={styles.mono}>{d}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        <div className={styles.panel}>
          <h2>Top web destinations (agent telemetry)</h2>
          <p className={styles.hint}>
            Aggregated outbound connections on common web ports. Destinations show as <strong>URLs</strong> (scheme + host + port
            when non-default). Hostnames come from <strong>reverse DNS (PTR)</strong> when the resolver returns a name; otherwise
            the IP is shown inside the URL. Path and query are not available from this telemetry.
          </p>
          <div className={styles.toolbar}>
            <label>
              Time window
              <select value={hours} onChange={(e) => setHours(Number(e.target.value))}>
                <option value={1}>1 hour</option>
                <option value={6}>6 hours</option>
                <option value={24}>24 hours</option>
                <option value={168}>7 days</option>
              </select>
            </label>
            <Link to="/network" className="falcon-btn falcon-btn-ghost">
              Full network activity
            </Link>
          </div>
          <div className={styles.tableWrap}>
            {destinations.length === 0 ? (
              <FalconEmptyState
                title="No web port telemetry in this window"
                description="Ensure agents are online and sending network connections. Data appears as endpoints browse or use HTTPS."
              />
            ) : (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Destination (URL)</th>
                    <th>Connections</th>
                    <th>Hosts</th>
                    <th>Last seen</th>
                  </tr>
                </thead>
                <tbody>
                  {destinations.map((r, idx) => {
                    const url = r.destination_url || '';
                    const tip = [r.remote_address, r.remote_port, r.protocol, r.resolved_hostname ? `PTR ${r.resolved_hostname}` : null]
                      .filter(Boolean)
                      .join(' · ');
                    return (
                      <tr key={`${r.remote_address}-${r.remote_port}-${r.protocol}-${idx}`}>
                        <td className={styles.destCell}>
                          <span className={styles.mono} title={tip}>
                            {url || `${r.remote_address}:${r.remote_port}`}
                          </span>
                        </td>
                        <td>{r.connection_count ?? '—'}</td>
                        <td>{r.endpoint_count ?? '—'}</td>
                        <td>{fmtTime(r.last_seen)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
    </PageShell>
  );
}
