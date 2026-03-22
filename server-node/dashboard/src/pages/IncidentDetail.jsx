import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './IncidentDetail.module.css';

export default function IncidentDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [incident, setIncident] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusUpdating, setStatusUpdating] = useState(false);

  useEffect(() => {
    api(`/api/admin/incidents/${id}`)
      .then((r) => r.json())
      .then(setIncident)
      .catch(() => setIncident(null))
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (newStatus) => {
    setStatusUpdating(true);
    try {
      await api(`/api/admin/incidents/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: newStatus }),
      });
      setIncident((i) => (i ? { ...i, status: newStatus } : null));
    } finally {
      setStatusUpdating(false);
    }
  };

  if (loading) return <PageShell loading loadingLabel="Loading incident…" />;
  if (!incident) {
    return (
      <PageShell kicker="Respond" title="Incident">
        <div className={styles.error}>Incident not found</div>
      </PageShell>
    );
  }

  const severityClass =
    incident.severity === 'critical' ? styles.critical :
    incident.severity === 'high' ? styles.high :
    incident.severity === 'medium' ? styles.medium : styles.low;

  return (
    <PageShell
      kicker="Respond"
      title={`${incident.incident_id} – ${incident.title}`}
      actions={
        <>
          <Link to="/incidents" className="falcon-btn falcon-btn-ghost">
            ← Incidents
          </Link>
          {incident.status === 'open' && (
            <button type="button" onClick={() => updateStatus('investigating')} disabled={statusUpdating} className="falcon-btn falcon-btn-primary">
              Start investigating
            </button>
          )}
          {incident.status === 'investigating' && (
            <button type="button" onClick={() => updateStatus('resolved')} disabled={statusUpdating} className="falcon-btn falcon-btn-primary">
              Resolve
            </button>
          )}
          {incident.status !== 'closed' && (
            <button type="button" onClick={() => updateStatus('closed')} disabled={statusUpdating} className="falcon-btn falcon-btn-ghost">
              Close
            </button>
          )}
        </>
      }
    >
    <div className={styles.container}>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>Details</h3>
          <dl>
            <dt>Status</dt>
            <dd>{incident.status}</dd>
            <dt>Severity</dt>
            <dd><span className={`${styles.badge} ${severityClass}`}>{incident.severity}</span></dd>
            <dt>Correlation</dt>
            <dd className={styles.mono}>{incident.correlation_type || '-'}</dd>
            <dt>Endpoint</dt>
            <dd>
              {incident.endpoint_id ? (
                <Link to={`/endpoints/${incident.endpoint_id}`}>{incident.hostname || `Endpoint ${incident.endpoint_id}`}</Link>
              ) : (
                '-'
              )}
            </dd>
            <dt>Created</dt>
            <dd>{new Date(incident.created_at).toLocaleString()}</dd>
            <dt>Updated</dt>
            <dd>{new Date(incident.updated_at).toLocaleString()}</dd>
          </dl>
          {incident.description && (
            <>
              <h3>Description</h3>
              <p className={styles.description}>{incident.description}</p>
            </>
          )}
        </div>

        <div className={styles.card}>
          <h3>Linked Alerts ({incident.alerts?.length || 0})</h3>
          {incident.alerts?.length > 0 ? (
            <ul className={styles.alertList}>
              {incident.alerts.map((a) => (
                <li key={a.id}>
                  <Link to={`/alerts/${a.id}`}>
                    <span className={`${styles.severityBadge} ${styles[a.severity] || ''}`}>{a.severity}</span>
                    {a.title}
                  </Link>
                  <span className={styles.alertMeta}>{new Date(a.first_seen).toLocaleString()}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No linked alerts</p>
          )}
        </div>
      </div>
    </div>
    </PageShell>
  );
}
