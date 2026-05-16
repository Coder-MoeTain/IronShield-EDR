import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';

export default function Integrations() {
  const { api, hasPermission } = useAuth();
  const [rows, setRows] = useState([]);
  const [type, setType] = useState('webhook');
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [msg, setMsg] = useState('');

  const load = () =>
    api('/api/admin/integrations')
      .then((r) => r.json())
      .then((d) => setRows(Array.isArray(d) ? d : []))
      .catch(() => setRows([]));

  useEffect(() => {
    load();
  }, [api]);

  const create = async (e) => {
    e.preventDefault();
    setMsg('');
    const r = await api('/api/admin/integrations', {
      method: 'POST',
      body: JSON.stringify({ type, name, config: { url } }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      setMsg(err.error || 'Create failed');
      return;
    }
    setName('');
    setUrl('');
    setMsg('Integration created');
    load();
  };

  const test = async (id) => {
    const r = await api(`/api/admin/integrations/${id}/test`, { method: 'POST' });
    const body = await r.json().catch(() => ({}));
    setMsg(r.ok ? `Test OK: ${JSON.stringify(body)}` : body.error || 'Test failed');
  };

  return (
    <PageShell title="Integrations" kicker="Enterprise">
      <p className="muted">Webhook and SIEM export providers (defensive telemetry only).</p>
      {msg && <p>{msg}</p>}
      {hasPermission('manage_integrations') && (
        <form onSubmit={create} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="webhook">Webhook</option>
            <option value="splunk_hec">Splunk HEC</option>
          </select>
          <input placeholder="Name" value={name} onChange={(e) => setName(e.target.value)} required />
          <input placeholder="URL / HEC endpoint" value={url} onChange={(e) => setUrl(e.target.value)} style={{ minWidth: 240 }} />
          <button type="submit" className="falcon-btn falcon-btn-primary">
            Add
          </button>
        </form>
      )}
      <table className="data-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Type</th>
            <th>Enabled</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.id}>
              <td>{row.name}</td>
              <td>{row.type}</td>
              <td>{row.enabled ? 'Yes' : 'No'}</td>
              <td>
                <button type="button" className="falcon-btn falcon-btn-ghost" onClick={() => test(row.id)}>
                  Test
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
