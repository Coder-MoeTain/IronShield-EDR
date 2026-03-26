import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './Risk.module.css';

export default function Risk() {
  const { api } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');

  useEffect(() => {
    api('/api/admin/risk/endpoints?limit=50')
      .then((r) => r.json())
      .then((rows) => {
        const seen = new Set();
        const filtered = (rows || []).filter((r) => {
          if (seen.has(r.endpoint_id)) return false;
          seen.add(r.endpoint_id);
          return true;
        });
        setList(filtered);
      })
      .catch(() => setList([]))
      .finally(() => setLoading(false));
  }, []);

  const riskClass = (score) => {
    if (score >= 70) return styles.critical;
    if (score >= 40) return styles.high;
    if (score >= 20) return styles.medium;
    return styles.low;
  };

  const filtered = list.filter((row) => {
    const name = (row.hostname || `endpoint ${row.endpoint_id || ''}`).toLowerCase();
    const score = String(row.risk_score ?? 0);
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return name.includes(q) || score.includes(q);
  });

  const summary = filtered.reduce(
    (acc, row) => {
      const score = row.risk_score || 0;
      acc.total += 1;
      acc.scoreSum += score;
      if (score >= 70) acc.critical += 1;
      else if (score >= 40) acc.high += 1;
      else if (score >= 20) acc.medium += 1;
      else acc.low += 1;
      return acc;
    },
    { total: 0, scoreSum: 0, critical: 0, high: 0, medium: 0, low: 0 }
  );

  const avgScore = summary.total ? Math.round(summary.scoreSum / summary.total) : 0;

  if (loading) return <PageShell loading loadingLabel="Loading risk scores…" />;

  return (
    <PageShell
      kicker="Intel"
      title="Endpoint risk"
      description="Prioritize endpoints by weighted alert risk score (new + investigating)."
    >
    <div className={styles.container}>
      <div className={styles.controls}>
        <input
          className={styles.search}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search endpoint or score"
          aria-label="Search endpoint risk"
        />
      </div>
      <div className={styles.metrics}>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Endpoints in scope</span>
          <strong className={styles.metricValue}>{summary.total}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Average risk score</span>
          <strong className={styles.metricValue}>{avgScore}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>Critical risk</span>
          <strong className={styles.metricValue}>{summary.critical}</strong>
        </div>
        <div className={styles.metricCard}>
          <span className={styles.metricLabel}>High risk</span>
          <strong className={styles.metricValue}>{summary.high}</strong>
        </div>
      </div>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rank</th>
              <th>Endpoint</th>
              <th>Risk Score</th>
              <th>Last Calculated</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((row, idx) => (
              <tr key={row.endpoint_id} className={styles.row}>
                <td>{idx + 1}</td>
                <td>
                  <Link to={`/endpoints/${row.endpoint_id}`}>{row.hostname || `Endpoint ${row.endpoint_id}`}</Link>
                </td>
                <td>
                  <span className={`${styles.scoreBadge} ${riskClass(row.risk_score || 0)}`}>
                    {row.risk_score ?? 0}
                  </span>
                </td>
                <td>{row.calculated_at ? new Date(row.calculated_at).toLocaleString() : '-'}</td>
                <td>
                  <Link to={`/alerts?endpointId=${row.endpoint_id}`} className={styles.link}>View Alerts</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className={styles.empty}>
            No matching risk rows. Risk is calculated when alerts are created.
          </div>
        )}
      </div>
    </div>
    </PageShell>
  );
}
