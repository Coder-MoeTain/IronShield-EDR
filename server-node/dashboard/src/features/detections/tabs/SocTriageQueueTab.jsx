import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import PageShell from '../../../components/PageShell';
import { falconSeverityClass } from '../../../utils/falconUi';
import styles from './SocTriageQueueTab.module.css';

export default function SocTriageQueue() {
  const { api } = useAuth();
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = new URLSearchParams({
      status: 'open',
      limit: '100',
      sort: 'risk_score',
      order: 'desc',
    });
    api(`/api/admin/alerts?${q}`)
      .then((r) => r.json())
      .then((rows) => setAlerts(Array.isArray(rows) ? rows : rows?.items || []))
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [api]);

  return (
    <PageShell
      kicker="SOC"
      title="Triage queue"
      description="Open alerts prioritized by risk score for analyst review."
    >
      {loading ? (
        <p>Loading…</p>
      ) : alerts.length === 0 ? (
        <p className="muted">No open alerts in queue.</p>
      ) : (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Risk</th>
                <th>Severity</th>
                <th>Alert</th>
                <th>Host</th>
                <th>MITRE</th>
                <th>Updated</th>
              </tr>
            </thead>
            <tbody>
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td>{a.risk_score != null ? Math.round(Number(a.risk_score)) : '—'}</td>
                  <td>
                    <span className={falconSeverityClass(a.severity)}>{a.severity}</span>
                  </td>
                  <td>
                    <Link to={`/alerts/${a.id}`}>{a.title}</Link>
                  </td>
                  <td>{a.hostname || a.endpoint_id}</td>
                  <td>{a.mitre_technique || '—'}</td>
                  <td>{a.updated_at ? new Date(a.updated_at).toLocaleString() : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </PageShell>
  );
}
