import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './Endpoints.module.css';

const EXAMPLE_STEPS = `[
  { "action_type": "request_heartbeat", "parameters": {} },
  { "action_type": "collect_triage", "parameters": { "request_type": "processes" } }
]`;

/** @param {{ embedded?: boolean }} props — When true, hide standalone page chrome (use inside Triage). */
export default function Playbooks({ embedded = false }) {
  const { api } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [stepsJson, setStepsJson] = useState(EXAMPLE_STEPS);
  const [runPb, setRunPb] = useState('');
  const [runEp, setRunEp] = useState('');

  const load = () => {
    setLoading(true);
    api('/api/admin/playbooks')
      .then((r) => r.json())
      .then(setRows)
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [api]);

  const create = async (e) => {
    e.preventDefault();
    let steps;
    try {
      steps = JSON.parse(stepsJson);
    } catch {
      window.alert('Steps must be valid JSON array');
      return;
    }
    if (!Array.isArray(steps)) {
      window.alert('Steps must be a JSON array');
      return;
    }
    await api('/api/admin/playbooks', {
      method: 'POST',
      body: JSON.stringify({ name, description, steps }),
    });
    setName('');
    setDescription('');
    setStepsJson(EXAMPLE_STEPS);
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete playbook?')) return;
    await api(`/api/admin/playbooks/${id}`, { method: 'DELETE' });
    load();
  };

  const run = async () => {
    if (!runPb || !runEp) {
      window.alert('Select playbook and enter endpoint ID');
      return;
    }
    const r = await api(`/api/admin/playbooks/${runPb}/run`, {
      method: 'POST',
      body: JSON.stringify({ endpoint_id: parseInt(runEp, 10) }),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) window.alert(j.error || 'Failed');
    else window.alert(`Queued ${(j.action_ids || []).length} actions`);
  };

  if (loading && rows.length === 0) {
    if (embedded) return <div className={styles.loading}>Loading playbooks…</div>;
    return <PageShell loading loadingLabel="Loading playbooks…" />;
  }

  const body = (
    <>
      <form onSubmit={create} className={styles.tableWrap} style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h2 className={styles.title} style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
          New playbook
        </h2>
        <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} style={{ width: '100%', maxWidth: 400, marginBottom: 8 }} />
        <input
          placeholder="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ width: '100%', maxWidth: 560, marginBottom: 8 }}
        />
        <textarea
          value={stepsJson}
          onChange={(e) => setStepsJson(e.target.value)}
          rows={8}
          style={{ width: '100%', fontFamily: 'var(--font-mono, monospace)', fontSize: '0.85rem' }}
        />
        <button type="submit" className="falcon-btn falcon-btn-primary" style={{ marginTop: 8 }}>
          Create playbook
        </button>
      </form>

      <div className={styles.tableWrap} style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h2 className={styles.title} style={{ fontSize: '0.95rem', marginBottom: '0.5rem' }}>
          Run on endpoint (test)
        </h2>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
          <select value={runPb} onChange={(e) => setRunPb(e.target.value)}>
            <option value="">Playbook…</option>
            {rows.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
          <input placeholder="Endpoint ID" value={runEp} onChange={(e) => setRunEp(e.target.value)} style={{ width: 120 }} />
          <button type="button" className="falcon-btn falcon-btn-ghost" onClick={run}>
            Run
          </button>
        </div>
      </div>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Steps</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>{p.name}</td>
                <td className="mono" style={{ fontSize: '0.75rem', maxWidth: 400, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {typeof p.steps_json === 'string' ? p.steps_json.slice(0, 120) : JSON.stringify(p.steps_json || {}).slice(0, 120)}…
                </td>
                <td>
                  <button type="button" className={styles.deleteBtn} onClick={() => remove(p.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className={styles.pageSub}>No playbooks yet.</p>}
      </div>
    </>
  );

  if (embedded) return <div>{body}</div>;

  return (
    <PageShell
      kicker="Response"
      title="Playbooks"
      description="Ordered chains of response actions (remediation). Requires: npm run migrate-capabilities-v2"
      actions={(
        <button type="button" className="falcon-btn falcon-btn-ghost" onClick={load}>
          ↻ Refresh
        </button>
      )}
    >
      {body}
    </PageShell>
  );
}
