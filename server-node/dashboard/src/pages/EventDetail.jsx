import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './EventDetail.module.css';

export default function EventDetail() {
  const { id } = useParams();
  const { api } = useAuth();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/api/admin/events/${id}`)
      .then((r) => r.json())
      .then(setEvent)
      .catch(() => setEvent(null))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <PageShell loading loadingLabel="Loading event…" />;
  if (!event) {
    return (
      <PageShell kicker="Explore" title="Raw event">
        <div className={styles.error}>Event not found</div>
      </PageShell>
    );
  }

  const raw = (() => {
    const r = event.raw_event_json;
    if (!r) return {};
    if (typeof r === 'object') return r;
    try { return JSON.parse(r || '{}'); } catch { return {}; }
  })();

  return (
    <PageShell
      kicker="Explore"
      title={`Raw event #${event.id}`}
      description="Full payload and summary fields for this ingested event."
      actions={<Link to="/raw-events" className="falcon-btn falcon-btn-ghost">← Raw events</Link>}
    >
      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>Summary</h3>
          <dl>
            <dt>Timestamp</dt>
            <dd>{new Date(event.timestamp).toLocaleString()}</dd>
            <dt>Hostname</dt>
            <dd>{event.hostname || event.endpoint_hostname || '-'}</dd>
            <dt>Event Type</dt>
            <dd className="mono">{event.event_type || '-'}</dd>
            <dt>Event Source</dt>
            <dd>{event.event_source || '-'}</dd>
            <dt>Process</dt>
            <dd>{raw.process_name || raw.ProcessName || '-'}</dd>
            <dt>Process ID</dt>
            <dd>{raw.process_id ?? raw.ProcessId ?? '-'}</dd>
            <dt>Username</dt>
            <dd>{raw.username || raw.Username || '-'}</dd>
          </dl>
        </div>
        <div className={styles.card}>
          <h3>Raw JSON</h3>
          <pre className={styles.json}>
            {JSON.stringify(raw, null, 2)}
          </pre>
        </div>
      </div>
    </PageShell>
  );
}
