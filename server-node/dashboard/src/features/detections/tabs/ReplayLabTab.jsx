import React, { useState } from 'react';
import { useAuth } from '../../../context/AuthContext';

export default function ReplayLabTab() {
  const { api } = useAuth();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [pack, setPack] = useState('');
  const [rule, setRule] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [report, setReport] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const run = async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await api('/api/v1/detections/replay', {
        method: 'POST',
        body: JSON.stringify({
          date_from: from || undefined,
          date_to: to || undefined,
          pack_id: pack || undefined,
          rule_id: rule || undefined,
          dry_run: dryRun,
        }),
      });
      if (!r.ok) throw new Error('Replay failed');
      const data = await r.json();
      setReport(data.report);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="console-replay-lab">
      <p className="muted">Dry-run replay of normalized events against the current rule pack.</p>
      <section className="form-grid" style={{ display: 'grid', gap: '0.75rem', maxWidth: 480 }}>
        <label>
          From
          <input type="datetime-local" value={from} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label>
          To
          <input type="datetime-local" value={to} onChange={(e) => setTo(e.target.value)} />
        </label>
        <label>
          Pack ID
          <input value={pack} onChange={(e) => setPack(e.target.value)} placeholder="windows-core" />
        </label>
        <label>
          Rule ID
          <input value={rule} onChange={(e) => setRule(e.target.value)} placeholder="IRN-WIN-0001" />
        </label>
        <label>
          <input type="checkbox" checked={dryRun} onChange={(e) => setDryRun(e.target.checked)} /> Dry run
        </label>
        <button type="button" className="btn-primary" onClick={run} disabled={loading}>
          {loading ? 'Running…' : 'Run replay'}
        </button>
      </section>
      {error && <p className="error">{error}</p>}
      {report && (
        <pre className="mono" style={{ marginTop: '1rem', maxHeight: 400, overflow: 'auto' }}>
          {JSON.stringify(report, null, 2)}
        </pre>
      )}
    </section>
  );
}
