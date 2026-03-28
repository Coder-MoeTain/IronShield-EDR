import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import PageShell from '../components/PageShell';
import FalconEmptyState from '../components/FalconEmptyState';
import styles from './SensorHealth.module.css';

function computeFleetHealth(d) {
  const total = d.total_endpoints || 0;
  if (total === 0) {
    return {
      score: null,
      tone: 'neutral',
      label: 'No data',
      hint: 'Enroll agents to measure fleet-wide sensor posture.',
    };
  }
  const off = d.offline || 0;
  const st = d.stale_heartbeat_24h || 0;
  const pend = d.pending_sensor_update || 0;
  const ngav = d.ngav_prevention_degraded || 0;
  const pol = d.policy_mismatch || 0;
  const deduction =
    (off / total) * 0.38 +
    (st / total) * 0.28 +
    (pend / total) * 0.1 +
    (ngav / total) * 0.12 +
    (pol / total) * 0.12;
  const score = Math.max(0, Math.min(100, Math.round(100 - deduction * 100)));
  let tone = 'good';
  let label = 'Excellent';
  if (score < 55) {
    tone = 'poor';
    label = 'At risk';
  } else if (score < 75) {
    tone = 'fair';
    label = 'Needs attention';
  } else if (score < 90) {
    tone = 'fair';
    label = 'Good';
  } else {
    tone = 'good';
    label = 'Excellent';
  }
  const hint =
    score >= 90
      ? 'Connectivity and policy signals look strong across the fleet.'
      : 'Use the KPIs and tables below to prioritize remediation.';
  return { score, tone, label, hint };
}

function badgeClass(tone, stylesObj) {
  if (tone === 'good') return stylesObj.badgeGood;
  if (tone === 'fair') return stylesObj.badgeFair;
  if (tone === 'poor') return stylesObj.badgePoor;
  return stylesObj.badgeNeutral;
}

function exportSensorHealthCsv(data) {
  const lines = [];
  lines.push('Metric,Value');
  lines.push(`total_endpoints,${data.total_endpoints ?? ''}`);
  lines.push(`stale_heartbeat_24h,${data.stale_heartbeat_24h ?? ''}`);
  lines.push(`offline,${data.offline ?? ''}`);
  lines.push(`pending_sensor_update,${data.pending_sensor_update ?? ''}`);
  lines.push(`ngav_prevention_degraded,${data.ngav_prevention_degraded ?? ''}`);
  lines.push(`policy_mismatch,${data.policy_mismatch ?? ''}`);
  lines.push('');
  lines.push('status,count');
  (data.by_status || []).forEach((r) => {
    lines.push(`"${String(r.status || 'unknown').replace(/"/g, '""')}",${r.count ?? 0}`);
  });
  lines.push('');
  lines.push('agent_version,count');
  (data.by_agent_version || []).forEach((r) => {
    lines.push(`"${String(r.agent_version || '').replace(/"/g, '""')}",${r.count ?? 0}`);
  });
  const blob = new Blob([`\ufeff${lines.join('\n')}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `sensor-health-${new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

function SortHeader({ label, sortKey, activeKey, dir, onSort }) {
  const active = activeKey === sortKey;
  const arrow = active ? (dir === 'asc' ? '↑' : '↓') : '';
  return (
    <th scope="col">
      <button type="button" className={styles.sortBtn} onClick={() => onSort(sortKey)}>
        {label}
        {arrow ? ` ${arrow}` : ''}
      </button>
    </th>
  );
}

export default function SensorHealth() {
  const { api } = useAuth();
  const { addToast } = useToast();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastFetchedAt, setLastFetchedAt] = useState(null);
  const [autoRefreshSec, setAutoRefreshSec] = useState(0);
  const [versionQuery, setVersionQuery] = useState('');
  const [statusSort, setStatusSort] = useState({ key: 'count', dir: 'desc' });
  const [versionSort, setVersionSort] = useState({ key: 'count', dir: 'desc' });

  const load = useCallback(async () => {
    const res = await api('/api/admin/sensors/health');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const json = await res.json();
    setData(json);
    setLastFetchedAt(new Date());
  }, [api]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load()
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [load]);

  useEffect(() => {
    if (autoRefreshSec <= 0) return undefined;
    const id = setInterval(() => {
      setRefreshing(true);
      load()
        .catch(() => setData(null))
        .finally(() => setRefreshing(false));
    }, autoRefreshSec * 1000);
    return () => clearInterval(id);
  }, [autoRefreshSec, load]);

  const handleRefresh = () => {
    setRefreshing(true);
    load()
      .then(() => addToast({ variant: 'success', message: 'Sensor health refreshed' }))
      .catch(() => {
        setData(null);
        addToast({ variant: 'error', message: 'Could not refresh sensor health' });
      })
      .finally(() => setRefreshing(false));
  };

  const health = useMemo(() => (data ? computeFleetHealth(data) : null), [data]);

  const sortedStatus = useMemo(() => {
    const rows = [...(data?.by_status || [])];
    const { key, dir } = statusSort;
    rows.sort((a, b) => {
      let cmp = 0;
      if (key === 'count') cmp = (a.count || 0) - (b.count || 0);
      else cmp = String(a.status || '').localeCompare(String(b.status || ''));
      return dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data, statusSort]);

  const sortedVersions = useMemo(() => {
    const q = versionQuery.trim().toLowerCase();
    let rows = [...(data?.by_agent_version || [])];
    if (q) rows = rows.filter((r) => String(r.agent_version || '').toLowerCase().includes(q));
    const { key, dir } = versionSort;
    rows.sort((a, b) => {
      let cmp = 0;
      if (key === 'count') cmp = (a.count || 0) - (b.count || 0);
      else cmp = String(a.agent_version || '').localeCompare(String(b.agent_version || ''));
      return dir === 'asc' ? cmp : -cmp;
    });
    return rows;
  }, [data, versionSort, versionQuery]);

  const totalForPct = data?.total_endpoints || 0;

  const toggleSort = (table, key) => {
    if (table === 'status') {
      setStatusSort((prev) =>
        prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
      );
    } else {
      setVersionSort((prev) =>
        prev.key === key ? { key, dir: prev.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'desc' }
      );
    }
  };

  if (loading) return <PageShell loading loadingLabel="Loading sensor health…" />;
  if (!data) {
    return (
      <PageShell kicker="Hosts" title="Sensor health" description="Fleet connectivity, versions, and management signals.">
        <div className={styles.loading}>Could not load sensor health.</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      kicker="Hosts"
      title="Sensor health"
      description="Fleet posture: connectivity, agent version spread, pending updates, NGAV, and policy alignment — similar to Falcon host management signals."
    >
      <div className={styles.toolbar}>
        <div className={styles.toolbarLeft}>
          <button
            type="button"
            className={`${styles.btn} ${styles.btnPrimary}`}
            onClick={handleRefresh}
            disabled={refreshing}
          >
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
          <span className={styles.lastUpdated}>
            {lastFetchedAt
              ? `Last updated ${lastFetchedAt.toLocaleTimeString()}`
              : '—'}
            {refreshing ? ' · updating…' : ''}
          </span>
        </div>
        <div className={styles.toolbarRight}>
          <label>
            <span className={styles.toolbarLabel}>Auto-refresh</span>
            <select
              className={styles.select}
              value={autoRefreshSec}
              onChange={(e) => setAutoRefreshSec(Number(e.target.value))}
              aria-label="Auto-refresh interval"
            >
              <option value={0}>Off</option>
              <option value={30}>30s</option>
              <option value={60}>1 min</option>
              <option value={300}>5 min</option>
            </select>
          </label>
          <button
            type="button"
            className={styles.btn}
            onClick={() => {
              exportSensorHealthCsv(data);
              addToast({ variant: 'success', message: 'Exported CSV' });
            }}
          >
            Export CSV
          </button>
        </div>
      </div>

      <div className={styles.hero}>
        <div className={styles.scoreCard} data-tone={health.tone}>
          <div className={styles.scoreLabel}>Fleet health index</div>
          {health.score != null ? (
            <>
              <div className={styles.scoreValue}>{health.score}</div>
              <span className={`${styles.scoreBadge} ${badgeClass(health.tone, styles)}`}>{health.label}</span>
            </>
          ) : (
            <>
              <div className={styles.scoreValue}>—</div>
              <span className={`${styles.scoreBadge} ${styles.badgeNeutral}`}>{health.label}</span>
            </>
          )}
          <p className={styles.scoreHint}>{health.hint}</p>
        </div>
        <div className={styles.kpiGrid}>
          <Link className={styles.kpi} to="/endpoints" title="Open all hosts">
            <div className={styles.kpiValue}>{data.total_endpoints}</div>
            <div className={styles.kpiTitle}>Total hosts</div>
            <div className={styles.kpiHint}>Registered endpoints</div>
          </Link>
          <Link
            className={`${styles.kpi} ${data.stale_heartbeat_24h > 0 ? styles.kpiWarn : ''}`}
            to="/endpoints"
            title="Review last-seen on the host list"
          >
            <div className={styles.kpiValue}>{data.stale_heartbeat_24h}</div>
            <div className={styles.kpiTitle}>Stale heartbeat (24h)</div>
            <div className={styles.kpiHint}>No heartbeat in 24h</div>
          </Link>
          <Link
            className={`${styles.kpi} ${data.offline > 0 ? styles.kpiDanger : styles.kpiOk}`}
            to="/endpoints?status=offline"
            title="Hosts marked offline"
          >
            <div className={styles.kpiValue}>{data.offline}</div>
            <div className={styles.kpiTitle}>Offline</div>
            <div className={styles.kpiHint}>Filter: status offline</div>
          </Link>
          <Link
            className={`${styles.kpi} ${(data.pending_sensor_update ?? 0) > 0 ? styles.kpiWarn : ''}`}
            to="/endpoints"
            title="Hosts with update_available on next poll"
          >
            <div className={styles.kpiValue}>{data.pending_sensor_update ?? 0}</div>
            <div className={styles.kpiTitle}>Pending sensor update</div>
            <div className={styles.kpiHint}>Agent update available</div>
          </Link>
          <Link
            className={`${styles.kpi} ${(data.ngav_prevention_degraded ?? 0) > 0 ? styles.kpiWarn : ''}`}
            to="/endpoints"
            title="NGAV prevention not fully active"
          >
            <div className={styles.kpiValue}>{data.ngav_prevention_degraded ?? 0}</div>
            <div className={styles.kpiTitle}>NGAV prevention degraded</div>
            <div className={styles.kpiHint}>Check signatures / realtime</div>
          </Link>
          <Link
            className={`${styles.kpi} ${(data.policy_mismatch ?? 0) > 0 ? styles.kpiWarn : ''}`}
            to="/endpoints"
            title="Assigned policy id ≠ sensor policy id"
          >
            <div className={styles.kpiValue}>{data.policy_mismatch ?? 0}</div>
            <div className={styles.kpiTitle}>Policy mismatch</div>
            <div className={styles.kpiHint}>Console vs sensor</div>
          </Link>
        </div>
      </div>

      <section className={styles.section} aria-labelledby="sh-status-heading">
        <div className={styles.sectionHead}>
          <h2 id="sh-status-heading" className={styles.sectionTitle}>
            By status
          </h2>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <SortHeader
                  label="Status"
                  sortKey="status"
                  activeKey={statusSort.key}
                  dir={statusSort.dir}
                  onSort={(key) => toggleSort('status', key)}
                />
                <SortHeader
                  label="Count"
                  sortKey="count"
                  activeKey={statusSort.key}
                  dir={statusSort.dir}
                  onSort={(key) => toggleSort('status', key)}
                />
                <th scope="col" className={styles.pct}>
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedStatus.length === 0 ? (
                <tr>
                  <td colSpan={3}>
                    <div className={styles.empty}>No status rows</div>
                  </td>
                </tr>
              ) : (
                sortedStatus.map((r) => {
                  const pct = totalForPct ? Math.round(((r.count || 0) / totalForPct) * 1000) / 10 : 0;
                  return (
                    <tr key={r.status || 'unknown'}>
                      <td>{r.status || 'unknown'}</td>
                      <td className={styles.mono}>{r.count}</td>
                      <td className={styles.barCell}>
                        <span className={styles.pct}>{pct}%</span>
                        <div className={styles.barTrack} role="presentation">
                          <div className={styles.barFill} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sh-version-heading">
        <div className={styles.sectionHead}>
          <h2 id="sh-version-heading" className={styles.sectionTitle}>
            Agent versions
          </h2>
          <input
            type="search"
            className={styles.searchInput}
            placeholder="Filter versions…"
            value={versionQuery}
            onChange={(e) => setVersionQuery(e.target.value)}
            aria-label="Filter agent versions"
          />
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <SortHeader
                  label="Version"
                  sortKey="agent_version"
                  activeKey={versionSort.key}
                  dir={versionSort.dir}
                  onSort={(key) => toggleSort('version', key)}
                />
                <SortHeader
                  label="Hosts"
                  sortKey="count"
                  activeKey={versionSort.key}
                  dir={versionSort.dir}
                  onSort={(key) => toggleSort('version', key)}
                />
                <th scope="col" className={styles.pct}>
                  Share
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedVersions.length === 0 ? (
                <tr>
                  <td colSpan={3}>
                    {versionQuery.trim() ? (
                      <div className={styles.empty}>No versions match “{versionQuery.trim()}”</div>
                    ) : (
                      <FalconEmptyState
                        icon="📦"
                        title="No version data"
                        description="Agent versions appear after hosts enroll and send heartbeats."
                      />
                    )}
                  </td>
                </tr>
              ) : (
                sortedVersions.map((r) => {
                  const pct = totalForPct ? Math.round(((r.count || 0) / totalForPct) * 1000) / 10 : 0;
                  return (
                    <tr key={r.agent_version}>
                      <td className={styles.mono}>{r.agent_version}</td>
                      <td className={styles.mono}>{r.count}</td>
                      <td className={styles.barCell}>
                        <span className={styles.pct}>{pct}%</span>
                        <div className={styles.barTrack} role="presentation">
                          <div className={styles.barFill} style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.footerLinks}>
        <Link to="/endpoints">View all hosts →</Link>
        <Link to="/host-groups">Host groups →</Link>
      </div>
    </PageShell>
  );
}
