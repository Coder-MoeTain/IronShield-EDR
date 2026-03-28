import React, { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import RunbookWorkflowPanel from '../components/RunbookWorkflowPanel';
import { falconSeverityClass } from '../utils/falconUi';
import styles from './AlertDetail.module.css';

function toDatetimeLocal(v) {
  if (!v) return '';
  const d = new Date(v);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function AlertDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { api, hasPermission } = useAuth();
  const [alert, setAlert] = useState(null);
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionMsg, setActionMsg] = useState('');
  const [suppressionReason, setSuppressionReason] = useState('');
  const [qualityEvents, setQualityEvents] = useState([]);
  const [disposition, setDisposition] = useState('');
  const [dispositionReason, setDispositionReason] = useState('');
  const [analystConfidence, setAnalystConfidence] = useState('');
  const [qualityTags, setQualityTags] = useState('');

  const fetchAlert = () => api(`/api/admin/alerts/${id}`).then((r) => r.json());
  const fetchNotes = () => api(`/api/admin/alerts/${id}/notes`).then((r) => r.json());
  const fetchQualityEvents = () => api(`/api/admin/alerts/${id}/quality-events?limit=20`).then((r) => r.json());

  const patchAlert = async (body) => {
    const r = await api(`/api/admin/alerts/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${r.status}`);
    }
    return r.json();
  };

  useEffect(() => {
    Promise.all([fetchAlert(), fetchNotes(), fetchQualityEvents()])
      .then(([a, n, q]) => {
        setAlert(a);
        setNotes(n || []);
        setQualityEvents(Array.isArray(q) ? q : []);
        const latest = Array.isArray(q) && q.length ? q[0] : null;
        if (latest?.analyst_disposition) setDisposition(latest.analyst_disposition);
        if (latest?.disposition_reason) setDispositionReason(latest.disposition_reason);
        if (latest?.analyst_confidence != null) setAnalystConfidence(String(Math.round(Number(latest.analyst_confidence) * 100)));
        if (latest?.quality_tags_json) {
          const parsed = Array.isArray(latest.quality_tags_json)
            ? latest.quality_tags_json
            : typeof latest.quality_tags_json === 'string'
              ? JSON.parse(latest.quality_tags_json || '[]')
              : [];
          setQualityTags(Array.isArray(parsed) ? parsed.join(', ') : '');
        }
      })
      .catch(() => setAlert(null))
      .finally(() => setLoading(false));
  }, [id]);

  const updateStatus = async (newStatus) => {
    const updated = await patchAlert({ status: newStatus });
    setAlert(updated);
  };

  const markSuppressed = async () => {
    if (!suppressionReason.trim()) {
      setActionMsg('Enter a suppression reason');
      return;
    }
    try {
      const updated = await patchAlert({ suppression_reason: suppressionReason.trim() });
      setAlert(updated);
      setSuppressionReason('');
      setActionMsg('Marked false positive');
    } catch (e) {
      setActionMsg(e.message || 'Suppress failed');
    }
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

  const submitDisposition = async () => {
    try {
      const confidence = analystConfidence === '' ? null : Math.min(100, Math.max(0, Number(analystConfidence)));
      const body = {
        analyst_disposition: disposition || null,
        disposition_reason: dispositionReason.trim() || null,
        analyst_confidence: confidence == null || Number.isNaN(confidence) ? null : confidence / 100,
        quality_tags: qualityTags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };
      const r = await api(`/api/admin/alerts/${id}/disposition`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const updated = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(updated.error || `HTTP ${r.status}`);
      setAlert(updated);
      const q = await fetchQualityEvents();
      setQualityEvents(Array.isArray(q) ? q : []);
      setActionMsg('Disposition updated');
    } catch (e) {
      setActionMsg('Failed: ' + (e.message || 'Unknown error'));
    }
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
          body: JSON.stringify({ action_type: 'isolate_host' }),
        });
        setActionMsg('Host isolation queued');
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

  if (loading) return <PageShell loading loadingLabel="Loading alert…" />;
  if (!alert) {
    return (
      <PageShell kicker="Detections" title="Alert">
        <div className={styles.error}>Alert not found</div>
      </PageShell>
    );
  }

  const statusClass =
    alert.status === 'new'
      ? styles.statusNew
      : alert.status === 'investigating'
        ? styles.statusInvestigating
        : alert.status === 'closed'
          ? styles.statusClosed
          : styles.statusFalsePositive;

  return (
    <PageShell
      kicker="Detections"
      title={alert.title}
      description={
        alert.description && alert.description.length > 220
          ? `${alert.description.slice(0, 220)}…`
          : alert.description || undefined
      }
      actions={
        <Link to="/alerts" className="falcon-btn falcon-btn-ghost">
          ← Detections
        </Link>
      }
    >
    <div className={styles.container}>
      <div className={styles.header} style={{ borderBottom: 'none', paddingBottom: 0 }}>
        <div className={styles.headerMain}>
          <div className={styles.headerBadges}>
            <span className={falconSeverityClass(alert.severity)}>{alert.severity}</span>
            <span className={`${styles.statusBadge} ${statusClass}`}>{alert.status}</span>
            {alert.mitre_technique && (
              <span className={styles.mitreBadge} title={alert.mitre_tactic}>
                {alert.mitre_technique}
              </span>
            )}
            {alert.confidence != null && (
              <span className={styles.confBadge}>{Math.round(alert.confidence * 100)}% conf</span>
            )}
            {alert.risk_score != null && alert.risk_score !== '' && (
              <span className={styles.confBadge} title="Heuristic risk (severity × confidence)">
                Risk {Math.round(Number(alert.risk_score))}
              </span>
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

      {hasPermission('actions:write') && alert.endpoint_id != null && (
        <RunbookWorkflowPanel endpointId={alert.endpoint_id} hostname={alert.hostname} />
      )}

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
            <dt>Team</dt>
            <dd>{alert.assigned_team || '—'}</dd>
            <dt>SLA due</dt>
            <dd>
              {alert.due_at ? new Date(alert.due_at).toLocaleString() : '—'}
              {alert.sla_breached_at && (
                <span className={styles.slaBreached}> (breached)</span>
              )}
            </dd>
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
              defaultValue={alert.assigned_to || ''}
              key={`assign-${alert.id}-${alert.assigned_to}`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (alert.assigned_to || '')) {
                  patchAlert({ assigned_to: v || null }).then(setAlert).catch(() => {});
                }
              }}
            />
          </div>
          <div className={styles.assigned}>
            <label>Team</label>
            <input
              type="text"
              placeholder="e.g. IR-1"
              defaultValue={alert.assigned_team || ''}
              key={`team-${alert.id}-${alert.assigned_team}`}
              onBlur={(e) => {
                const v = e.target.value.trim();
                if (v !== (alert.assigned_team || '')) {
                  patchAlert({ assigned_team: v || null }).then(setAlert).catch(() => {});
                }
              }}
            />
          </div>
          <div className={styles.assigned}>
            <label>SLA due (local time)</label>
            <input
              type="datetime-local"
              defaultValue={toDatetimeLocal(alert.due_at)}
              key={`due-${alert.id}-${alert.due_at}`}
              onBlur={(e) => {
                const v = e.target.value;
                const iso = v ? new Date(v).toISOString() : null;
                const prev = alert.due_at ? new Date(alert.due_at).toISOString() : null;
                if (iso !== prev) {
                  patchAlert({ due_at: iso }).then(setAlert).catch(() => {});
                }
              }}
            />
          </div>
          <div className={styles.assigned}>
            <label>SLA window (minutes from triage)</label>
            <input
              type="number"
              min={0}
              placeholder="240"
              defaultValue={alert.sla_minutes != null ? alert.sla_minutes : ''}
              key={`slam-${alert.id}-${alert.sla_minutes}`}
              onBlur={(e) => {
                const raw = e.target.value.trim();
                const n = raw === '' ? null : parseInt(raw, 10);
                if (n !== null && Number.isNaN(n)) return;
                if (n !== alert.sla_minutes) {
                  patchAlert({ sla_minutes: n }).then(setAlert).catch(() => {});
                }
              }}
            />
          </div>
          {alert.status === 'false_positive' && alert.suppression_reason && (
            <div className={styles.suppressionMeta}>
              <strong>Suppression:</strong> {alert.suppression_reason}
              {alert.suppressed_by && <span> — {alert.suppressed_by}</span>}
              {alert.suppressed_at && (
                <span className={styles.suppressionWhen}>
                  {' '}
                  · {new Date(alert.suppressed_at).toLocaleString()}
                </span>
              )}
            </div>
          )}
          <div className={styles.suppressBox}>
            <label>False positive — reason (sets status + audit)</label>
            <textarea
              value={suppressionReason}
              onChange={(e) => setSuppressionReason(e.target.value)}
              rows={2}
              placeholder="Why this is benign / duplicate / expected…"
            />
            <button type="button" className={styles.btnSecondary} onClick={markSuppressed}>
              Mark false positive
            </button>
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

          <div className={styles.dispositionBox}>
            <label>Analyst disposition</label>
            <select value={disposition} onChange={(e) => setDisposition(e.target.value)}>
              <option value="">Not set</option>
              <option value="true_positive">True positive</option>
              <option value="false_positive">False positive</option>
              <option value="benign_admin_activity">Benign admin activity</option>
              <option value="duplicate">Duplicate</option>
              <option value="test">Test / simulation</option>
            </select>
            <label>Disposition reason</label>
            <textarea
              value={dispositionReason}
              onChange={(e) => setDispositionReason(e.target.value)}
              rows={2}
              placeholder="Reason to improve rule precision and tuning..."
            />
            <div className={styles.dispositionRow}>
              <div>
                <label>Analyst confidence (0-100)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={analystConfidence}
                  onChange={(e) => setAnalystConfidence(e.target.value)}
                  placeholder="e.g. 80"
                />
              </div>
              <div>
                <label>Quality tags (comma separated)</label>
                <input
                  type="text"
                  value={qualityTags}
                  onChange={(e) => setQualityTags(e.target.value)}
                  placeholder="noisy, script, admin-tooling"
                />
              </div>
            </div>
            <button type="button" className={styles.btnSecondary} onClick={submitDisposition}>
              Save disposition feedback
            </button>
          </div>

          <h3 className={styles.notesTitle}>Detection quality history</h3>
          {qualityEvents.length > 0 ? (
            <ul className={styles.notesList}>
              {qualityEvents.map((q) => (
                <li key={q.id} className={styles.noteItem}>
                  <span className={styles.noteMeta}>
                    {q.created_by || 'system'} · {new Date(q.created_at).toLocaleString()}
                  </span>
                  <p>
                    {(q.event_type || 'event').replace(/_/g, ' ')}
                    {q.analyst_disposition ? ` · ${q.analyst_disposition.replace(/_/g, ' ')}` : ''}
                    {q.analyst_confidence != null ? ` · conf ${Math.round(Number(q.analyst_confidence) * 100)}%` : ''}
                  </p>
                  {q.disposition_reason ? <p>{q.disposition_reason}</p> : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className={styles.noNotes}>No quality events yet.</p>
          )}

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
    </PageShell>
  );
}
