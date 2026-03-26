import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import { asJsonList } from '../utils/apiJson';
import styles from './Policies.module.css';

export default function Policies() {
  const { api } = useAuth();
  const [policies, setPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [modeFilter, setModeFilter] = useState('all');

  useEffect(() => {
    api('/api/admin/policies')
      .then((r) => asJsonList(r))
      .then(setPolicies)
      .catch(() => setPolicies([]))
      .finally(() => setLoading(false));
  }, []);

  const modeNormalized = (mode) => String(mode || '').trim().toLowerCase();
  const filteredPolicies = policies.filter((p) => {
    const name = String(p.name || '').toLowerCase();
    const mode = modeNormalized(p.mode);
    const q = query.trim().toLowerCase();
    const queryMatch = !q || name.includes(q) || String(p.id || '').includes(q);
    const modeMatch = modeFilter === 'all' || mode === modeFilter;
    return queryMatch && modeMatch;
  });

  const defaultCount = policies.filter((p) => Boolean(p.is_default)).length;
  const monitorCount = policies.filter((p) => modeNormalized(p.mode) === 'monitor').length;
  const protectCount = policies.filter((p) => modeNormalized(p.mode) === 'protect').length;

  if (loading) return <PageShell loading loadingLabel="Loading policies…" />;

  return (
    <PageShell
      kicker="Configuration"
      title="Endpoint policies"
      description="Telemetry cadence, batching behavior, and enforcement mode applied to endpoint fleets."
    >
      <div className={styles.container}>
        <div className={styles.statsGrid}>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Total policies</div>
            <div className={styles.statValue}>{policies.length}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Default policies</div>
            <div className={styles.statValue}>{defaultCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Protect mode</div>
            <div className={styles.statValue}>{protectCount}</div>
          </div>
          <div className={styles.statCard}>
            <div className={styles.statLabel}>Monitor mode</div>
            <div className={styles.statValue}>{monitorCount}</div>
          </div>
        </div>

        <div className={styles.toolbar}>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search by policy name or ID"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <select
            className={styles.select}
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
          >
            <option value="all">All modes</option>
            <option value="protect">Protect</option>
            <option value="monitor">Monitor</option>
          </select>
          <div className={styles.resultsMeta}>
            Showing {filteredPolicies.length} of {policies.length}
          </div>
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Policy</th>
                <th>Mode</th>
                <th>Telemetry (s)</th>
                <th>Batch size</th>
                <th>Heartbeat (min)</th>
                <th>Default</th>
              </tr>
            </thead>
            <tbody>
              {filteredPolicies.map((p) => {
                const mode = modeNormalized(p.mode);
                const modeClass =
                  mode === 'monitor'
                    ? styles.modeMonitor
                    : mode === 'protect'
                      ? styles.modeProtect
                      : styles.modeOther;

                return (
                  <tr key={p.id}>
                    <td className={styles.nameCell}>{p.name || `Policy #${p.id}`}</td>
                    <td>
                      <span className={`${styles.badge} ${modeClass}`}>{p.mode || 'unknown'}</span>
                    </td>
                    <td>{p.telemetry_interval_seconds ?? '—'}</td>
                    <td>{p.batch_upload_size ?? '—'}</td>
                    <td>{p.heartbeat_interval_minutes ?? '—'}</td>
                    <td>
                      {p.is_default ? (
                        <span className={`${styles.badge} ${styles.defaultBadge}`}>Default</span>
                      ) : (
                        <span className={styles.muted}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && policies.length === 0 && (
            <p className={styles.empty}>No endpoint policies found. Seed policy data to configure fleet behavior.</p>
          )}
          {!loading && policies.length > 0 && filteredPolicies.length === 0 && (
            <p className={styles.empty}>No policies match the current search/filter.</p>
          )}
        </div>
      </div>
    </PageShell>
  );
}
