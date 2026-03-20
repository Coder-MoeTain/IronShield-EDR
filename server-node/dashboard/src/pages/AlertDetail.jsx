import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AlertDetail.module.css';

export default function AlertDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api } = useAuth();
  const [alert, setAlert] = useState(null);
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');

  const fetchAlert = () => api(`/api/admin/alerts/${id}`).then((r) => r.json());
  const fetchNotes = () => api(`/api/admin/alerts/${id}/notes`).then((r) => r.json());

  useEffect(() => {
    Promise.all([fetchAlert(), fetchNotes()])
      .then(([a, n]) => {
        setAlert(a);
        setNotes(n || []);
      })
      .catch(() => setAlert(null))
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (newStatus) => {
    await api(`/api/admin/alerts/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: newStatus, assigned_to: alert?.assigned_to }),
    });
    setAlert((a) => (a ? { ...a, status: newStatus } : null));
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await api(`/api/admin/alerts/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note: note.trim() }),
    });
    setNote('');
    const n = await fetchNotes();
    setNotes(n || []);
  };

  const doAction = async (action) => {
    if (!alert) return;
    setActionMsg('');
    try {
      if (action === 'triage') {
        await api(`/api/admin/endpoints/${alert.endpoint_id}/triage-request`, {
          method: 'POST',
          body: JSON.stringify({ request_type: 'full' }),
        });
        setActionMsg('Triage requested');
      } else if (action === 'isolate') {
        await api(`/api/admin/endpoints/${alert.endpoint_id}/actions`, {
          method: 'POST',
          body: JSON.stringify({ action_type: 'simulate_isolation' }),
        });
        setActionMsg('Isolation simulated');
      } else if (action === 'investigate') {
        const r = await api('/api/admin/investigations', {
          method: 'POST',
          body: JSON.stringify({
            title: `Alert ${id}: ${alert.title}`,
            description: alert.description || '',
            endpoint_id: alert.endpoint_id,
          }),
        });
        const { id: caseId } = await r.json();
        setActionMsg('Investigation created');
        navigate(`/investigations/${caseId}`);
      }
    } catch (e) {
      setActionMsg('Failed: ' + (e.message || 'Unknown error'));
    }
  };

  if (loading) return <div className={styles.loading}>Loading alert...</div>;
  if (!alert) return <div className={styles.error}>Alert not found</div>;

  const severityClass =
    alert.severity === 'critical'
      ? styles.critical
      : alert.severity === 'high'
        ? styles.high
        : alert.severity === 'medium'
          ? styles.medium
          : styles.low;

  const statusClass =
    alert.status === 'new'
      ? styles.statusNew
      : alert.status === 'investigating'
        ? styles.statusInvestigating
        : alert.status === 'closed'
          ? styles.statusClosed
          : styles.statusFalsePositive;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/alerts" className={styles.back}>
          ← Alert Queue
        </Link>
        <div className={styles.headerMain}>
          <h1 className={styles.title}>{alert.title}</h1>
          <div className={styles.headerBadges}>
            <span className={`${styles.badge} ${styles.severityBadge} ${severityClass}`}>{alert.severity}</span>
            <span className={`${styles.statusBadge} ${statusClass}`}>{alert.status}</span>
            {alert.mitre_technique && (
              <span className={styles.mitreBadge} title={alert.mitre_tactic}>
                {alert.mitre_technique}
              </span>
            )}
            {alert.confidence != null && (
              <span className={styles.confBadge}>{Math.round(alert.confidence * 100)}% conf</span>
            )}
          </div>
        </div>
      </div>

      <div className={styles.quickActions}>
        <span className={styles.quickLabel}>Quick actions:</span>
        <button className={styles.quickActionBtn} onClick={() => doAction('triage')}>
          Collect Triage
        </button>
        <button className={styles.quickActionBtn} onClick={() => doAction('isolate')}>
          Isolate Host
        </button>
        <button className={styles.quickActionBtn} onClick={() => doAction('investigate')}>
          Create Investigation
        </button>
        <Link to={`/endpoints/${alert.endpoint_id}`} className={styles.quickActionBtn}>
          View Endpoint
        </Link>
        <Link to={`/process-monitor?endpointId=${alert.endpoint_id}`} className={styles.quickActionBtn}>
          Process Monitor
        </Link>
        {actionMsg && <span className={styles.actionMsg}>{actionMsg}</span>}
      </div>

      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>Details</h3>
          <dl>
            <dt>Endpoint</dt>
            <dd>
              <Link to={`/endpoints/${alert.endpoint_id}`}>{alert.hostname}</Link>
              {alert.ip_address && <span className={styles.ip}> ({alert.ip_address})</span>}
            </dd>
            <dt>Assigned To</dt>
            <dd>{alert.assigned_to || '—'}</dd>
            <dt>First Seen</dt>
            <dd>{new Date(alert.first_seen).toLocaleString()}</dd>
            <dt>Last Seen</dt>
            <dd>{new Date(alert.last_seen).toLocaleString()}</dd>
            <dt>Description</dt>
            <dd>{alert.description || '—'}</dd>
            <dt>MITRE ATT&CK</dt>
            <dd>
              {alert.mitre_tactic && <span className={styles.mitreTactic}>{alert.mitre_tactic}</span>}
              {alert.mitre_technique && (
                <span className={styles.mitreTechnique}> → {alert.mitre_technique}</span>
              )}
              {!alert.mitre_tactic && !alert.mitre_technique && '—'}
            </dd>
          </dl>
        </div>

        <div className={styles.card}>
          <h3>Status & Assignment</h3>
          <div className={styles.assigned}>
            <label>Assigned to</label>
            <input
              type="text"
              placeholder="Analyst name"
              defaultValue={alert.assigned_to}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== alert.assigned_to) {
                  api(`/api/admin/alerts/${id}/status`, {
                    method: 'POST',
                    body: JSON.stringify({ status: alert.status, assigned_to: v || null }),
                  }).then(() => setAlert((a) => (a ? { ...a, assigned_to: v || null } : null)));
                }
              }}
            />
          </div>
          <div className={styles.statusActions}>
            <label>Status</label>
            <div className={styles.statusBtns}>
              {['new', 'investigating', 'closed', 'false_positive'].map((s) => (
                <button
                  key={s}
                  className={alert.status === s ? styles.active : ''}
                  onClick={() => updateStatus(s)}
                >
                  {s.replace('_', ' ')}
                </button>
              ))}
            </div>
          </div>

          <h3 className={styles.notesTitle}>Investigation Notes</h3>
          {notes.length > 0 ? (
            <ul className={styles.notesList}>
              {notes.map((n) => (
                <li key={n.id} className={styles.noteItem}>
                  <span className={styles.noteMeta}>
                    {n.author} · {new Date(n.created_at).toLocaleString()}
                  </span>
                  <p>{n.note}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.noNotes}>No notes yet.</p>
          )}
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Add investigation note..."
            rows={3}
          />
          <button onClick={addNote} className={styles.btn}>
            Add Note
          </button>
        </div>
      </div>
    </div>
  );
}
