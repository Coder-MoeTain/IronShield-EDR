import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './Endpoints.module.css';

export default function SensorHealth() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/admin/sensors/health')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [api]);

  if (loading) return <PageShell loading loadingLabel="Loading sensor health…" />;
  if (!data) {
    return (
      <PageShell kicker="Hosts" title="Sensor health" description="Could not load sensor metrics.">
        <div className={styles.loading}>Could not load sensor health.</div>
      </PageShell>
    );
  }

  return (
    <PageShell
      kicker="Hosts"
      title="Sensor health"
      description="Connectivity and agent version distribution — similar to Falcon host management signals."
    >
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap', marginBottom: '1.25rem' }}>
        <div className={styles.tableWrap} style={{ padding: '1rem', minWidth: 140 }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>{data.total_endpoints}</div>
          <div className={styles.pageSub}>Total hosts</div>
        </div>
        <div className={styles.tableWrap} style={{ padding: '1rem', minWidth: 140 }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-amber)' }}>{data.stale_heartbeat_24h}</div>
          <div className={styles.pageSub}>Stale heartbeat (24h)</div>
        </div>
        <div className={styles.tableWrap} style={{ padding: '1rem', minWidth: 140 }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-red)' }}>{data.offline}</div>
          <div className={styles.pageSub}>Offline</div>
        </div>
        <div className={styles.tableWrap} style={{ padding: '1rem', minWidth: 160 }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
            {data.pending_sensor_update ?? 0}
          </div>
          <div className={styles.pageSub}>Pending sensor update</div>
        </div>
        <div className={styles.tableWrap} style={{ padding: '1rem', minWidth: 180 }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#b45309' }}>
            {data.ngav_prevention_degraded ?? 0}
          </div>
          <div className={styles.pageSub}>NGAV prevention degraded</div>
        </div>
        <div className={styles.tableWrap} style={{ padding: '1rem', minWidth: 200 }}>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--accent-amber)' }}>
            {data.policy_mismatch ?? 0}
          </div>
          <div className={styles.pageSub}>Policy mismatch (console vs sensor)</div>
        </div>
      </div>

      <h2 className={styles.title} style={{ fontSize: '1rem', marginBottom: '0.5rem' }}>
        By status
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Status</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {(data.by_status || []).map((r) => (
              <tr key={r.status || 'unknown'}>
                <td>{r.status || 'unknown'}</td>
                <td className="mono">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2 className={styles.title} style={{ fontSize: '1rem', margin: '1.25rem 0 0.5rem' }}>
        Agent versions
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Version</th>
              <th>Count</th>
            </tr>
          </thead>
          <tbody>
            {(data.by_agent_version || []).map((r) => (
              <tr key={r.agent_version}>
                <td className="mono">{r.agent_version}</td>
                <td className="mono">{r.count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={styles.pageSub} style={{ marginTop: '1rem' }}>
        <Link to="/endpoints">View all hosts →</Link>
      </p>
    </PageShell>
  );
}
