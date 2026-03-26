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
  const [workflowSaving, setWorkflowSaving] = useState(false);
  const [evidenceSaving, setEvidenceSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [evidenceRows, setEvidenceRows] = useState([]);
  const [workflow, setWorkflow] = useState({
    owner_username: '',
    sla_minutes: 240,
    due_at: '',
  });
  const [newEvidence, setNewEvidence] = useState({
    evidence_type: 'other',
    storage_uri: '',
    sha256: '',
    size_bytes: '',
    custody_note: '',
  });

  useEffect(() => {
    api(`/api/admin/incidents/${id}`)
      .then((r) => r.json())
      .then((data) => {
        setIncident(data);
        setWorkflow({
          owner_username: data?.owner_username || '',
          sla_minutes: data?.sla_minutes || 240,
          due_at: data?.due_at ? new Date(data.due_at).toISOString().slice(0, 16) : '',
        });
      })
      .catch(() => setIncident(null))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    api(`/api/admin/incidents/${id}/evidence`)
      .then((r) => r.json())
      .then((rows) => setEvidenceRows(Array.isArray(rows) ? rows : []))
      .catch(() => setEvidenceRows([]));
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

  const saveWorkflow = async () => {
    setWorkflowSaving(true);
    setMsg('');
    try {
      const payload = {
        owner_username: workflow.owner_username || null,
        sla_minutes: Number(workflow.sla_minutes || 240),
        due_at: workflow.due_at ? new Date(workflow.due_at).toISOString().slice(0, 19).replace('T', ' ') : null,
      };
      const r = await api(`/api/admin/incidents/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      setIncident((prev) =>
        prev
          ? {
              ...prev,
              owner_username: payload.owner_username,
              sla_minutes: payload.sla_minutes,
              due_at: payload.due_at,
            }
          : prev
      );
      setMsg('Workflow saved');
    } catch (e) {
      setMsg('Failed to save workflow: ' + (e.message || 'Unknown error'));
    } finally {
      setWorkflowSaving(false);
    }
  };

  const addEvidence = async () => {
    if (!newEvidence.storage_uri.trim()) return;
    setEvidenceSaving(true);
    setMsg('');
    try {
      const r = await api(`/api/admin/incidents/${id}/evidence`, {
        method: 'POST',
        body: JSON.stringify({
          evidence_type: newEvidence.evidence_type,
          storage_uri: newEvidence.storage_uri.trim(),
          sha256: newEvidence.sha256.trim() || null,
          size_bytes: newEvidence.size_bytes ? Number(newEvidence.size_bytes) : null,
          custody_note: newEvidence.custody_note.trim() || null,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      const refreshed = await api(`/api/admin/incidents/${id}/evidence`).then((x) => x.json()).catch(() => []);
      setEvidenceRows(Array.isArray(refreshed) ? refreshed : []);
      setNewEvidence({ evidence_type: 'other', storage_uri: '', sha256: '', size_bytes: '', custody_note: '' });
      setMsg('Evidence added');
    } catch (e) {
      setMsg('Failed to add evidence: ' + (e.message || 'Unknown error'));
    } finally {
      setEvidenceSaving(false);
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
      description={msg || undefined}
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
            <dt>Owner</dt>
            <dd>{incident.owner_username || '-'}</dd>
            <dt>SLA</dt>
            <dd>{incident.sla_minutes || 240} minutes</dd>
            <dt>Due</dt>
            <dd>{incident.due_at ? new Date(incident.due_at).toLocaleString() : '-'}</dd>
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

        <div className={styles.card}>
          <h3>Case workflow</h3>
          <div className={styles.workflowForm}>
            <label>
              Owner username
              <input
                value={workflow.owner_username}
                onChange={(e) => setWorkflow((x) => ({ ...x, owner_username: e.target.value }))}
                placeholder="analyst-1"
              />
            </label>
            <label>
              SLA minutes
              <input
                type="number"
                min="1"
                value={workflow.sla_minutes}
                onChange={(e) => setWorkflow((x) => ({ ...x, sla_minutes: e.target.value }))}
              />
            </label>
            <label>
              Due at
              <input
                type="datetime-local"
                value={workflow.due_at}
                onChange={(e) => setWorkflow((x) => ({ ...x, due_at: e.target.value }))}
              />
            </label>
            <button type="button" className="falcon-btn falcon-btn-primary" disabled={workflowSaving} onClick={saveWorkflow}>
              Save workflow
            </button>
          </div>
        </div>

        <div className={styles.card}>
          <h3>Evidence chain-of-custody</h3>
          <div className={styles.workflowForm}>
            <label>
              Type
              <select
                value={newEvidence.evidence_type}
                onChange={(e) => setNewEvidence((x) => ({ ...x, evidence_type: e.target.value }))}
              >
                <option value="other">other</option>
                <option value="file">file</option>
                <option value="log">log</option>
                <option value="memory_dump">memory_dump</option>
                <option value="network_capture">network_capture</option>
              </select>
            </label>
            <label>
              Storage URI
              <input
                value={newEvidence.storage_uri}
                onChange={(e) => setNewEvidence((x) => ({ ...x, storage_uri: e.target.value }))}
                placeholder="s3://forensics-bucket/inc-123/memdump.bin"
              />
            </label>
            <label>
              SHA256
              <input
                value={newEvidence.sha256}
                onChange={(e) => setNewEvidence((x) => ({ ...x, sha256: e.target.value }))}
                placeholder="64-char hash"
              />
            </label>
            <label>
              Size bytes
              <input
                type="number"
                min="0"
                value={newEvidence.size_bytes}
                onChange={(e) => setNewEvidence((x) => ({ ...x, size_bytes: e.target.value }))}
              />
            </label>
            <label>
              Custody note
              <input
                value={newEvidence.custody_note}
                onChange={(e) => setNewEvidence((x) => ({ ...x, custody_note: e.target.value }))}
                placeholder="Collected from host via triage bundle"
              />
            </label>
            <button type="button" className="falcon-btn falcon-btn-primary" disabled={evidenceSaving} onClick={addEvidence}>
              Add evidence
            </button>
          </div>

          <div className={styles.evidenceTableWrap}>
            <table className={styles.evidenceTable}>
              <thead>
                <tr>
                  <th>Collected</th>
                  <th>Type</th>
                  <th>Collector</th>
                  <th>SHA256</th>
                  <th>URI</th>
                </tr>
              </thead>
              <tbody>
                {evidenceRows.map((e) => (
                  <tr key={e.id}>
                    <td>{new Date(e.collected_at).toLocaleString()}</td>
                    <td className={styles.mono}>{e.evidence_type}</td>
                    <td>{e.collected_by}</td>
                    <td className={styles.mono}>{e.sha256 || '-'}</td>
                    <td className={styles.mono}>{e.storage_uri}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {evidenceRows.length === 0 && <p className={styles.empty}>No evidence entries yet.</p>}
          </div>
        </div>
      </div>
    </div>
    </PageShell>
  );
}
