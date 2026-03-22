import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './Risk.module.css';

export default function Risk() {
  const { api } = useAuth();
  const [list, setList] = useState([]);
  const [loading, setLoading] = useState(true);

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

  if (loading) return <PageShell loading loadingLabel="Loading risk scores…" />;

  return (
    <PageShell
      kicker="Intel"
      title="Endpoint risk"
      description="Risk scores based on alert severity and count (new + investigating)."
    >
    <div className={styles.container}>
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
            {list.map((row, idx) => (
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
        {list.length === 0 && (
          <div className={styles.empty}>
            No risk scores yet. Risk is calculated when alerts are created.
          </div>
        )}
      </div>
    </div>
    </PageShell>
  );
}
