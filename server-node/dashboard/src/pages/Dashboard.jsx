import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Dashboard.module.css';

function timeAgo(date) {
  const d = new Date(date);
  const now = new Date();
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function Dashboard() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchData = () => {
    setLoading(true);
    setError(null);
    api('/api/admin/dashboard/summary')
      .then((r) => r.json())
      .then((data) => {
        setSummary(data);
        setError(null);
      })
      .catch((err) => {
        setSummary(null);
        setError(err?.message || 'Failed to load dashboard');
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  if (loading && !summary) return <div className={styles.loading}>Loading dashboard...</div>;
  if (error && !summary) return (
    <div className={styles.error}>
      <p>{error}</p>
      <button onClick={fetchData} className={styles.refreshBtn}>Retry</button>
    </div>
  );

  const ep = summary?.endpoints || {};
  const alertSum = summary?.alertSummary || {};
  const inv = summary?.investigations || {};
  const recentAlerts = summary?.recentAlerts || [];
  const recentInvestigations = summary?.recentInvestigations || [];
  const eventTypes = summary?.eventTypes || [];

  const severityClass = (s) => {
    if (s === 'critical') return styles.critical;
    if (s === 'high') return styles.high;
    if (s === 'medium') return styles.medium;
    return styles.low;
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>🛡</span> Security Overview
        </h1>
        <button onClick={fetchData} className={styles.refreshBtn}>↻ Refresh</button>
      </div>

      <div className={styles.kpiRow}>
        <div
          className={styles.kpiCard}
          onClick={() => navigate('/endpoints')}
        >
          <span className={styles.kpiValue}>{ep.total ?? 0}</span>
          <span className={styles.kpiLabel}>Endpoints</span>
        </div>
        <div
          className={`${styles.kpiCard} ${styles.kpiOnline}`}
          onClick={() => navigate('/endpoints')}
        >
          <span className={styles.kpiValue}>{ep.online ?? 0}</span>
          <span className={styles.kpiLabel}>Online</span>
        </div>
        <div
          className={`${styles.kpiCard} ${styles.kpiOffline}`}
          onClick={() => navigate('/endpoints')}
        >
          <span className={styles.kpiValue}>{ep.offline ?? 0}</span>
          <span className={styles.kpiLabel}>Offline</span>
        </div>
        <div
          className={styles.kpiCard}
          onClick={() => navigate('/events')}
        >
          <span className={styles.kpiValue}>{summary?.eventsToday ?? 0}</span>
          <span className={styles.kpiLabel}>Events Today</span>
        </div>
        <div
          className={`${styles.kpiCard} ${styles.kpiAlerts}`}
          onClick={() => navigate('/alerts')}
        >
          <span className={styles.kpiValue}>{alertSum.new ?? 0}</span>
          <span className={styles.kpiLabel}>New Alerts</span>
        </div>
        <div
          className={`${styles.kpiCard} ${styles.kpiCritical}`}
          onClick={() => navigate('/alerts?severity=critical')}
        >
          <span className={styles.kpiValue}>{alertSum.critical ?? 0}</span>
          <span className={styles.kpiLabel}>Critical</span>
        </div>
        <div
          className={styles.kpiCard}
          onClick={() => navigate('/investigations')}
        >
          <span className={styles.kpiValue}>{inv.open ?? 0}</span>
          <span className={styles.kpiLabel}>Open Cases</span>
        </div>
        <div
          className={`${styles.kpiCard} ${styles.kpiSuspect}`}
          onClick={() => navigate('/process-monitor?suspectOnly=true')}
        >
          <span className={styles.kpiValue}>{summary?.suspectCount24h ?? 0}</span>
          <span className={styles.kpiLabel}>Suspect (24h)</span>
        </div>
      </div>

      <div className={styles.grid3}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Recent Alerts</h2>
            <Link to="/alerts" className={styles.panelLink}>View all →</Link>
          </div>
          <div className={styles.tableWrap}>
            {recentAlerts.length > 0 ? (
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>Alert</th>
                    <th>Endpoint</th>
                    <th>Severity</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentAlerts.map((a) => (
                    <tr
                      key={a.id}
                      onClick={() => navigate(`/alerts/${a.id}`)}
                      className={styles.clickRow}
                    >
                      <td className={styles.timeCell}>{timeAgo(a.first_seen)}</td>
                      <td className={styles.titleCell}>
                        <span title={a.description}>
                          {(a.title || '').length > 50 ? a.title.slice(0, 50) + '…' : a.title}
                        </span>
                      </td>
                      <td>
                        <Link to={`/endpoints/${a.endpoint_id}`} onClick={(e) => e.stopPropagation()}>
                          {a.hostname}
                        </Link>
                      </td>
                      <td>
                        <span className={`${styles.badge} ${severityClass(a.severity)}`}>
                          {a.severity}
                        </span>
                      </td>
                      <td>
                        <span className={styles.statusBadge}>{a.status}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className={styles.empty}>
                No recent alerts. <Link to="/alerts">View alert queue</Link>
              </div>
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Event Activity</h2>
            <Link to="/events" className={styles.panelLink}>View events →</Link>
          </div>
          <div className={styles.eventTypes}>
            {eventTypes.length > 0 ? (
              eventTypes.map((row) => (
                <div
                  key={row.type}
                  className={styles.eventTypeRow}
                  onClick={() => navigate(`/events?eventType=${encodeURIComponent(row.type)}`)}
                >
                  <span className={styles.eventTypeName}>{row.type || 'unknown'}</span>
                  <span className={styles.eventTypeCount}>{row.count?.toLocaleString()}</span>
                </div>
              ))
            ) : (
              <div className={styles.empty}>No event data</div>
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Open Investigations</h2>
            <Link to="/investigations" className={styles.panelLink}>View all →</Link>
          </div>
          <div className={styles.investigationList}>
            {recentInvestigations.length > 0 ? (
              recentInvestigations.map((inv) => (
                <div
                  key={inv.id}
                  className={styles.invRow}
                  onClick={() => navigate(`/investigations/${inv.id}`)}
                >
                  <span className={styles.invTitle}>{inv.title || inv.case_id}</span>
                  <span className={styles.invMeta}>{inv.hostname || '-'} · {inv.status}</span>
                </div>
              ))
            ) : (
              <div className={styles.empty}>No open investigations</div>
            )}
          </div>
        </div>
      </div>

      <div className={styles.quickActions}>
        <h3>Quick Actions</h3>
        <div className={styles.actionGrid}>
          <Link to="/process-monitor" className={styles.actionCard}>
            <span className={styles.actionIcon}>◉</span>
            <span>Process Monitor</span>
          </Link>
          <Link to="/network" className={styles.actionCard}>
            <span className={styles.actionIcon}>🌐</span>
            <span>Network</span>
          </Link>
          <Link to="/alerts" className={styles.actionCard}>
            <span className={styles.actionIcon}>⚠</span>
            <span>Alert Queue</span>
          </Link>
          <Link to="/events" className={styles.actionCard}>
            <span className={styles.actionIcon}>◈</span>
            <span>Events</span>
          </Link>
          <Link to="/investigations" className={styles.actionCard}>
            <span className={styles.actionIcon}>📋</span>
            <span>Investigations</span>
          </Link>
          <Link to="/incidents" className={styles.actionCard}>
            <span className={styles.actionIcon}>🔥</span>
            <span>Incidents</span>
          </Link>
          <Link to="/risk" className={styles.actionCard}>
            <span className={styles.actionIcon}>📊</span>
            <span>Risk</span>
          </Link>
          <Link to="/iocs" className={styles.actionCard}>
            <span className={styles.actionIcon}>🎯</span>
            <span>IOCs</span>
          </Link>
          <Link to="/endpoints" className={styles.actionCard}>
            <span className={styles.actionIcon}>🖥</span>
            <span>Endpoints</span>
          </Link>
          <Link to="/triage" className={styles.actionCard}>
            <span className={styles.actionIcon}>🔍</span>
            <span>Triage</span>
          </Link>
          <Link to="/detection-rules" className={styles.actionCard}>
            <span className={styles.actionIcon}>📜</span>
            <span>Detection Rules</span>
          </Link>
          <Link to="/policies" className={styles.actionCard}>
            <span className={styles.actionIcon}>⚙</span>
            <span>Policies</span>
          </Link>
        </div>
      </div>

      <div className={styles.footer}>
        <span>
          {summary?.triagePending > 0 && (
            <Link to="/triage">
              {summary.triagePending} triage request(s) pending
            </Link>
          )}
        </span>
      </div>
    </div>
  );
}
