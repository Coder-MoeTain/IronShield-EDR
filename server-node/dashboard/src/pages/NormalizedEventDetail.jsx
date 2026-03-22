import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './NormalizedEventDetail.module.css';

export default function NormalizedEventDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [jsonExpanded, setJsonExpanded] = useState(false);

  useEffect(() => {
    api(`/api/admin/normalized-events/${id}`)
      .then((r) => r.json())
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [id]);

  const doAction = async (action) => {
    if (!event) return;
    try {
      if (action === 'investigate') {
        const r = await api('/api/admin/investigations', {
          method: 'POST',
          body: JSON.stringify({
            title: `Event ${id}: ${event.process_name || 'Unknown'} on ${event.endpoint_hostname}`,
            description: `Process: ${event.process_name}\nPath: ${event.process_path}\nUser: ${event.username}\nCommand: ${event.command_line || '-'}`,
            endpoint_id: event.endpoint_id,
          }),
        });
        const { id: caseId } = await r.json();
        navigate(`/investigations/${caseId}`);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const copyJson = () => {
    const raw = typeof event?.raw_event_json === 'object'
      ? event.raw_event_json
      : (() => { try { return JSON.parse(event?.raw_event_json || '{}'); } catch { return {}; } })();
    navigator.clipboard.writeText(JSON.stringify(raw, null, 2));
  };

  if (loading) return <div className={styles.loading}>Loading event...</div>;
  if (!event) return <div className={styles.error}>Event not found</div>;

  const raw = typeof event.raw_event_json === 'object'
    ? event.raw_event_json
    : (typeof event.raw_event_json === 'string' ? (() => { try { return JSON.parse(event.raw_event_json || '{}'); } catch { return {}; } })() : {});

  const linkedAlerts = event.linkedAlerts || [];

  return (
    <PageShell
      kicker="Explore"
      title={`Event #${event.id}`}
      description={`${event.event_type || 'Event'} · ${event.hostname || event.endpoint_hostname || ''}`}
      actions={
        <>
          <Link to="/events" className="falcon-btn falcon-btn-ghost">
            ← Events
          </Link>
          <Link to={`/endpoints/${event.endpoint_id}`} className="falcon-btn falcon-btn-ghost">
            Endpoint
          </Link>
          <Link to={`/endpoints/${event.endpoint_id}/process-tree`} className="falcon-btn falcon-btn-ghost">
            Process tree
          </Link>
          <button type="button" onClick={() => doAction('investigate')} className="falcon-btn falcon-btn-primary">
            Create investigation
          </button>
        </>
      }
    >
    <div className={styles.container}>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>Event Summary</h3>
          <dl>
            <dt>Timestamp</dt>
            <dd>{new Date(event.timestamp).toLocaleString()}</dd>
            <dt>Hostname</dt>
            <dd>
              <Link to={`/endpoints/${event.endpoint_id}`}>{event.hostname || event.endpoint_hostname || '-'}</Link>
            </dd>
            <dt>Event Type</dt>
            <dd><span className={styles.typeBadge}>{event.event_type || '-'}</span></dd>
            <dt>Event Source</dt>
            <dd>{event.event_source || '-'}</dd>
            <dt>Process</dt>
            <dd className={styles.processName}>{event.process_name || '-'}</dd>
            <dt>Process Path</dt>
            <dd className={`mono ${styles.mono}`}>{event.process_path || '-'}</dd>
            <dt>Process ID</dt>
            <dd>{event.process_id ?? '-'}</dd>
            <dt>Parent Process</dt>
            <dd>{event.parent_process_name || '-'} <span className={styles.muted}>(PID: {event.parent_process_id ?? '-'})</span></dd>
            <dt>Username</dt>
            <dd>{event.username || '-'}</dd>
            <dt>Command Line</dt>
            <dd className={`mono ${styles.cmdLine}`}>{event.command_line || '-'}</dd>
          </dl>
        </div>

        <div className={styles.card}>
          <h3>Linked Alerts</h3>
          {linkedAlerts.length > 0 ? (
            <ul className={styles.alertList}>
              {linkedAlerts.map((a) => (
                <li key={a.id}>
                  <Link to={`/alerts/${a.id}`} className={styles.alertLink}>
                    <span className={`${styles.severityBadge} ${styles[a.severity] || ''}`}>{a.severity}</span>
                    {a.title}
                  </Link>
                  <span className={styles.alertMeta}>
                    {new Date(a.first_seen).toLocaleString()} · {a.status}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.empty}>No alerts linked to this event.</p>
          )}
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardHeader}>
          <h3>Raw JSON</h3>
          <div className={styles.cardActions}>
            <button onClick={copyJson} className={styles.smallBtn}>Copy</button>
            <button onClick={() => setJsonExpanded(!jsonExpanded)} className={styles.smallBtn}>
              {jsonExpanded ? 'Collapse' : 'Expand'}
            </button>
          </div>
        </div>
        <pre className={`${styles.json} ${jsonExpanded ? styles.jsonExpanded : ''}`}>
          {JSON.stringify(raw, null, 2)}
        </pre>
      </div>
    </div>
    </PageShell>
  );
}
