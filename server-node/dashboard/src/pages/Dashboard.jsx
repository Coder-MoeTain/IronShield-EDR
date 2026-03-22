import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';
import { useAuth } from '../context/AuthContext';
import ReportSearch from '../components/ReportSearch';
import PageShell from '../components/PageShell';
import { falconSeverityClass } from '../utils/falconUi';
import styles from './Dashboard.module.css';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

/* CrowdStrike Falcon–class chart palette (dark-console contrast) */
const CHART_COLORS = {
  blue: 'rgba(94, 176, 255, 0.92)',
  blueFill: 'rgba(94, 176, 255, 0.14)',
  red: 'rgba(224, 30, 55, 0.92)',
  amber: 'rgba(251, 191, 36, 0.88)',
  green: 'rgba(52, 211, 153, 0.9)',
  cyan: 'rgba(34, 211, 238, 0.88)',
  slate: 'rgba(148, 163, 184, 0.72)',
};

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

function formatHour(h) {
  if (!h) return '';
  const d = new Date(h);
  const now = new Date();
  const diff = now - d;
  if (diff < 86400000) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit' });
}

const chartOptions = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: { display: false },
  },
  scales: {
    x: {
      grid: { display: false },
      ticks: {
        maxTicksLimit: 8,
        font: { size: 10, family: "'IBM Plex Mono', monospace" },
        color: '#8b939e',
      },
    },
    y: {
      beginAtZero: true,
      grid: { color: 'rgba(128, 128, 128, 0.18)' },
      ticks: { font: { size: 10, family: "'IBM Plex Mono', monospace" }, color: '#8b939e' },
    },
  },
};

export default function Dashboard() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [lastUpdate, setLastUpdate] = useState(null);
  const [liveIndicator, setLiveIndicator] = useState(false);
  const [searchAlerts, setSearchAlerts] = useState('');
  const [searchInvestigations, setSearchInvestigations] = useState('');
  const [searchEventTypes, setSearchEventTypes] = useState('');
  const [searchEventSources, setSearchEventSources] = useState('');

  const fetchData = useCallback(() => {
    setError(null);
    api('/api/admin/dashboard/summary')
      .then((r) => r.json())
      .then((data) => {
        setSummary(data);
        setLastUpdate(new Date());
        setError(null);
      })
      .catch((err) => {
        setError(err?.message || 'Failed to load dashboard');
        setSummary((prev) => (prev ? prev : null));
      })
      .finally(() => setLoading(false));
  }, [api]);

  useEffect(() => {
    fetchData();
  }, []);

  // Real-time polling every 30 seconds
  useEffect(() => {
    if (!summary) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [summary, fetchData]);

  // Live indicator pulse
  useEffect(() => {
    const t = setInterval(() => setLiveIndicator((v) => !v), 2000);
    return () => clearInterval(t);
  }, []);

  // Build 24h labels (fill gaps with 0)
  const eventsChartData = useMemo(() => {
    if (!summary?.eventsOverTime?.length) return null;
    const data = summary.eventsOverTime;
    const labels = data.map((r) => formatHour(r.hour));
    const values = data.map((r) => Number(r.count));
    return {
      labels,
      datasets: [
        {
          label: 'Events',
          data: values,
          borderColor: CHART_COLORS.blue,
          backgroundColor: CHART_COLORS.blueFill,
          fill: true,
          tension: 0.3,
        },
      ],
    };
  }, [summary?.eventsOverTime]);

  const alertsChartData = useMemo(() => {
    if (!summary?.alertsOverTime?.length) return null;
    const data = summary.alertsOverTime;
    const labels = data.map((r) => formatHour(r.hour));
    const values = data.map((r) => Number(r.count));
    return {
      labels,
      datasets: [
        {
          label: 'Alerts',
          data: values,
          borderColor: CHART_COLORS.red,
          backgroundColor: 'rgba(224, 30, 55, 0.14)',
          fill: true,
          tension: 0.3,
        },
      ],
    };
  }, [summary?.alertsOverTime]);

  const eventTypes = summary?.eventTypes || [];
  const eventSources = summary?.eventSources || [];

  const filterEventTypes = useMemo(() => {
    const q = searchEventTypes.trim().toLowerCase();
    if (!q) return eventTypes;
    return eventTypes.filter((t) => (t.type || '').toLowerCase().includes(q));
  }, [eventTypes, searchEventTypes]);

  const eventTypesChartData = useMemo(() => {
    const types = filterEventTypes;
    if (types.length === 0) return null;
    const colors = [CHART_COLORS.blue, CHART_COLORS.cyan, CHART_COLORS.green, CHART_COLORS.amber, CHART_COLORS.red, CHART_COLORS.slate];
    return {
      labels: types.map((t) => t.type || 'unknown'),
      datasets: [
        {
          data: types.map((t) => Number(t.count) || 0),
          backgroundColor: types.map((_, i) => colors[i % colors.length]),
          borderWidth: 0,
        },
      ],
    };
  }, [filterEventTypes]);

  const endpointChartData = useMemo(() => {
    const ep = summary?.endpoints || {};
    const online = ep.online ?? 0;
    const offline = ep.offline ?? 0;
    const total = ep.total ?? 0;
    const other = Math.max(0, total - online - offline);
    if (total === 0) return null;
    return {
      labels: ['Online', 'Offline', 'Other'],
      datasets: [
        {
          data: [online, offline, other],
          backgroundColor: [CHART_COLORS.green, CHART_COLORS.red, CHART_COLORS.slate],
          borderWidth: 0,
        },
      ],
    };
  }, [summary?.endpoints]);

  const alertSeverityChartData = useMemo(() => {
    const as = summary?.alertSummary || {};
    const critical = as.critical ?? 0;
    const high = as.high ?? 0;
    const medium = as.medium ?? 0;
    const low = as.low ?? 0;
    const newCount = as.new ?? 0;
    if (critical + high + medium + low === 0 && newCount === 0) return null;
    return {
      labels: ['Critical', 'High', 'Medium', 'Low'],
      datasets: [
        {
          data: [critical, high, medium, low],
          backgroundColor: ['#dc2626', '#d97706', '#2563eb', '#64748b'],
          borderWidth: 0,
        },
      ],
    };
  }, [summary?.alertSummary]);

  const filterAlerts = useMemo(() => {
    const list = summary?.recentAlerts || [];
    const q = searchAlerts.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (a) =>
        (a.title || '').toLowerCase().includes(q) ||
        (a.hostname || '').toLowerCase().includes(q) ||
        (a.severity || '').toLowerCase().includes(q) ||
        (a.status || '').toLowerCase().includes(q) ||
        (a.description || '').toLowerCase().includes(q)
    );
  }, [summary?.recentAlerts, searchAlerts]);

  const filterInvestigations = useMemo(() => {
    const list = summary?.recentInvestigations || [];
    const q = searchInvestigations.trim().toLowerCase();
    if (!q) return list;
    return list.filter(
      (inv) =>
        (inv.title || '').toLowerCase().includes(q) ||
        (inv.case_id || '').toLowerCase().includes(q) ||
        (inv.hostname || '').toLowerCase().includes(q) ||
        (inv.status || '').toLowerCase().includes(q)
    );
  }, [summary?.recentInvestigations, searchInvestigations]);

  const filterEventSources = useMemo(() => {
    const q = searchEventSources.trim().toLowerCase();
    if (!q) return eventSources;
    return eventSources.filter((s) => (s.source || '').toLowerCase().includes(q));
  }, [eventSources, searchEventSources]);

  if (loading && !summary)
    return (
      <div className={`${styles.loading} ui-page`}>
        <div className="ui-loading" role="status">
          Loading dashboard
        </div>
      </div>
    );
  if (error && !summary)
    return (
      <div className={styles.error}>
        <p>{error}</p>
        <button onClick={fetchData} className={styles.refreshBtn}>Retry</button>
      </div>
    );

  const ep = summary?.endpoints || {};
  const alertSum = summary?.alertSummary || {};
  const inv = summary?.investigations || {};

  return (
    <PageShell
      kicker="Overview"
      title="Activity"
      description="Console overview — sensor volume, detections, and host posture (24h windows where applicable)."
      actions={(
        <>
          {lastUpdate && (
            <span className={styles.lastUpdate} style={{ marginRight: '0.5rem' }}>
              Updated {timeAgo(lastUpdate)}
              <span className={`${styles.liveDot} ${liveIndicator ? styles.livePulse : ''}`} />
            </span>
          )}
          <button type="button" onClick={fetchData} className="falcon-btn falcon-btn-ghost" title="Refresh now">
            ↻ Refresh
          </button>
        </>
      )}
    >
    <div className={styles.container}>
      <div className={styles.statsBar}>
        <span className={styles.statsItem}>
          <strong>{(summary?.eventsTotal ?? 0).toLocaleString()}</strong> total events
        </span>
        <span className={styles.statsDivider}>·</span>
        <span className={styles.statsItem}>
          <strong>{summary?.eventsToday ?? 0}</strong> today
        </span>
        <span className={styles.statsDivider}>·</span>
        <span className={styles.statsItem}>
          <strong>{ep.online ?? 0}/{ep.total || 0}</strong> hosts online
        </span>
        <span className={styles.statsDivider}>·</span>
        <span className={styles.statsItem}>
          <strong>{inv.open ?? 0}</strong> open investigations
        </span>
      </div>

      <section className={styles.kpiRow}>
        <div className={styles.kpiCard} onClick={() => navigate('/endpoints')}>
          <span className={styles.kpiValue}>{ep.total ?? 0}</span>
          <span className={styles.kpiLabel}>Hosts</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiOnline}`} onClick={() => navigate('/endpoints')}>
          <span className={styles.kpiValue}>{ep.online ?? 0}</span>
          <span className={styles.kpiLabel}>Online</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiOffline}`} onClick={() => navigate('/endpoints')}>
          <span className={styles.kpiValue}>{ep.offline ?? 0}</span>
          <span className={styles.kpiLabel}>Offline</span>
        </div>
        <div className={styles.kpiCard} onClick={() => navigate('/events')}>
          <span className={styles.kpiValue}>{summary?.eventsToday ?? 0}</span>
          <span className={styles.kpiLabel}>Events Today</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiAlerts}`} onClick={() => navigate('/alerts')}>
          <span className={styles.kpiValue}>{alertSum.new ?? 0}</span>
          <span className={styles.kpiLabel}>New Alerts</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiCritical}`} onClick={() => navigate('/alerts?severity=critical')}>
          <span className={styles.kpiValue}>{alertSum.critical ?? 0}</span>
          <span className={styles.kpiLabel}>Critical</span>
        </div>
        <div className={styles.kpiCard} onClick={() => navigate('/investigations')}>
          <span className={styles.kpiValue}>{inv.open ?? 0}</span>
          <span className={styles.kpiLabel}>Open Cases</span>
        </div>
        <div className={`${styles.kpiCard} ${styles.kpiSuspect}`} onClick={() => navigate('/process-monitor?suspectOnly=true')}>
          <span className={styles.kpiValue}>{summary?.suspectCount24h ?? 0}</span>
          <span className={styles.kpiLabel}>Suspect (24h)</span>
        </div>
        <div className={styles.kpiCard} onClick={() => navigate('/triage')}>
          <span className={styles.kpiValue}>{summary?.triagePending ?? 0}</span>
          <span className={styles.kpiLabel}>Triage Pending</span>
        </div>
        <div className={styles.kpiCard} onClick={() => navigate('/events')}>
          <span className={styles.kpiValue}>{(summary?.eventsTotal ?? 0).toLocaleString()}</span>
          <span className={styles.kpiLabel}>Total Events</span>
        </div>
      </section>

      <section className={styles.chartsRow}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>Events (24h)</h3>
            <Link to="/events" className={styles.chartLink}>View all</Link>
          </div>
          <div className={styles.chartBody}>
            {eventsChartData ? (
              <Line data={eventsChartData} options={chartOptions} />
            ) : (
              <div className={styles.chartEmpty}>No event data in last 24h</div>
            )}
          </div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>Alerts (24h)</h3>
            <Link to="/alerts" className={styles.chartLink}>View all</Link>
          </div>
          <div className={styles.chartBody}>
            {alertsChartData ? (
              <Line data={alertsChartData} options={chartOptions} />
            ) : (
              <div className={styles.chartEmpty}>No alerts in last 24h</div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.chartsRow2}>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>Event Types</h3>
            <div className={styles.chartHeaderRight}>
              <ReportSearch value={searchEventTypes} onChange={setSearchEventTypes} placeholder="Filter types..." />
              <Link to="/events" className={styles.chartLink}>View</Link>
            </div>
          </div>
          <div className={styles.chartBodySmall}>
            {eventTypesChartData ? (
              <Doughnut
                data={eventTypesChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
                }}
              />
            ) : (
              <div className={styles.chartEmpty}>No event types</div>
            )}
          </div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>Endpoint Status</h3>
            <Link to="/endpoints" className={styles.chartLink}>View</Link>
          </div>
          <div className={styles.chartBodySmall}>
            {endpointChartData ? (
              <Doughnut
                data={endpointChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
                }}
              />
            ) : (
              <div className={styles.chartEmpty}>No endpoints</div>
            )}
          </div>
        </div>
        <div className={styles.chartCard}>
          <div className={styles.chartHeader}>
            <h3>Alerts by Severity</h3>
            <Link to="/alerts" className={styles.chartLink}>View</Link>
          </div>
          <div className={styles.chartBodySmall}>
            {alertSeverityChartData ? (
              <Doughnut
                data={alertSeverityChartData}
                options={{
                  responsive: true,
                  maintainAspectRatio: false,
                  plugins: { legend: { position: 'right', labels: { boxWidth: 12, font: { size: 11 } } } },
                }}
              />
            ) : (
              <div className={styles.chartEmpty}>No alerts</div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.grid3}>
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Recent Alerts</h2>
            <div className={styles.panelHeaderRight}>
              <ReportSearch value={searchAlerts} onChange={setSearchAlerts} placeholder="Search alerts..." />
              <Link to="/alerts" className={styles.panelLink}>View all →</Link>
            </div>
          </div>
          <div className={styles.tableWrap}>
            {filterAlerts.length > 0 ? (
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
                  {filterAlerts.map((a) => (
                    <tr key={a.id} onClick={() => navigate(`/alerts/${a.id}`)} className={styles.clickRow}>
                      <td className={styles.timeCell}>{timeAgo(a.first_seen)}</td>
                      <td className={styles.titleCell}>
                        <span title={a.description}>
                          {(a.title || '').length > 45 ? a.title.slice(0, 45) + '…' : a.title}
                        </span>
                      </td>
                      <td>
                        <Link to={`/endpoints/${a.endpoint_id}`} onClick={(e) => e.stopPropagation()}>
                          {a.hostname}
                        </Link>
                      </td>
                      <td>
                        <span className={falconSeverityClass(a.severity)}>{a.severity}</span>
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
                {searchAlerts ? 'No matching alerts.' : 'No recent alerts.'} <Link to="/alerts">View detections</Link>
              </div>
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Open Investigations</h2>
            <div className={styles.panelHeaderRight}>
              <ReportSearch value={searchInvestigations} onChange={setSearchInvestigations} placeholder="Search cases..." />
              <Link to="/investigations" className={styles.panelLink}>View all →</Link>
            </div>
          </div>
          <div className={styles.investigationList}>
            {filterInvestigations.length > 0 ? (
              filterInvestigations.map((inv) => (
                <div key={inv.id} className={styles.invRow} onClick={() => navigate(`/investigations/${inv.id}`)}>
                  <span className={styles.invTitle}>{inv.title || inv.case_id}</span>
                  <span className={styles.invMeta}>{inv.hostname || '-'} · {inv.status}</span>
                </div>
              ))
            ) : (
              <div className={styles.empty}>
                {searchInvestigations ? 'No matching investigations.' : 'No open investigations'}
              </div>
            )}
          </div>
        </div>

        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <h2>Event Sources</h2>
            <div className={styles.panelHeaderRight}>
              <ReportSearch value={searchEventSources} onChange={setSearchEventSources} placeholder="Search sources..." />
              <Link to="/events" className={styles.panelLink}>View →</Link>
            </div>
          </div>
          <div className={styles.eventSourcesList}>
            {filterEventSources.length > 0 ? (
              filterEventSources.map((row) => (
                <div
                  key={row.source}
                  className={styles.eventSourceRow}
                  onClick={() => navigate(`/events?eventSource=${encodeURIComponent(row.source)}`)}
                >
                  <span className={styles.eventSourceName}>{row.source || 'unknown'}</span>
                  <span className={styles.eventSourceCount}>{row.count?.toLocaleString()}</span>
                </div>
              ))
            ) : (
              <div className={styles.empty}>
                {searchEventSources ? 'No matching sources.' : 'No event sources'}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className={styles.quickActions}>
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
            <span>Detections</span>
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
      </section>

      {summary?.triagePending > 0 && (
        <footer className={styles.footer}>
          <Link to="/triage">{summary.triagePending} triage request(s) pending</Link>
        </footer>
      )}
    </div>
    </PageShell>
  );
}
