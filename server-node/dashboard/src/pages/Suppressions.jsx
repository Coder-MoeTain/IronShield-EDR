import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import PageShell from '../components/PageShell';
import { asJsonList } from '../utils/apiJson';
import styles from './Endpoints.module.css';

/** @param {{ embedded?: boolean }} props — When true, hide standalone page chrome (use inside Detection Rules). */
export default function Suppressions({ embedded = false }) {
  const { api } = useAuth();
  const { confirm } = useConfirm();
  const [rows, setRows] = useState([]);
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({
    rule_id: '',
    endpoint_id: '',
    hostname_pattern: '',
    process_path_pattern: '',
    title_contains: '',
    comment: '',
    expires_at: '',
  });

  const load = () => {
    setLoading(true);
    Promise.all([api('/api/admin/suppressions'), api('/api/admin/detection-rules')])
      .then(async ([rs, rr]) => {
        setRows(await asJsonList(rs));
        setRules(await asJsonList(rr, 'rules'));
      })
      .catch(() => {
        setRows([]);
        setRules([]);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [api]);

  const create = async (e) => {
    e.preventDefault();
    const body = {
      rule_id: form.rule_id ? parseInt(form.rule_id, 10) : null,
      endpoint_id: form.endpoint_id ? parseInt(form.endpoint_id, 10) : null,
      hostname_pattern: form.hostname_pattern || null,
      process_path_pattern: form.process_path_pattern || null,
      title_contains: form.title_contains || null,
      comment: form.comment || null,
      expires_at: form.expires_at || null,
    };
    await api('/api/admin/suppressions', { method: 'POST', body: JSON.stringify(body) });
    setForm({
      rule_id: '',
      endpoint_id: '',
      hostname_pattern: '',
      process_path_pattern: '',
      title_contains: '',
      comment: '',
      expires_at: '',
    });
    load();
  };

  const toggle = async (id, enabled) => {
    await api(`/api/admin/suppressions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ enabled: !enabled }),
    });
    load();
  };

  const remove = async (id) => {
    if (
      !(await confirm({
        title: 'Delete suppression',
        message: 'Remove this suppression rule?',
        danger: true,
        confirmLabel: 'Delete',
      }))
    )
      return;
    await api(`/api/admin/suppressions/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading && rows.length === 0) {
    if (embedded) return <div className={styles.loading}>Loading suppressions…</div>;
    return <PageShell loading loadingLabel="Loading suppressions…" />;
  }

  const body = (
    <>
      <form onSubmit={create} className={styles.tableWrap} style={{ padding: '1rem', marginBottom: '1rem' }}>
        <h2 className={styles.title} style={{ fontSize: '0.95rem', marginBottom: '0.75rem' }}>
          Add suppression
        </h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '0.5rem' }}>
          <select value={form.rule_id} onChange={(e) => setForm((f) => ({ ...f, rule_id: e.target.value }))}>
            <option value="">All rules (global)</option>
            {rules.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <input
            placeholder="Endpoint ID (optional)"
            value={form.endpoint_id}
            onChange={(e) => setForm((f) => ({ ...f, endpoint_id: e.target.value }))}
          />
          <input
            placeholder="Hostname pattern"
            value={form.hostname_pattern}
            onChange={(e) => setForm((f) => ({ ...f, hostname_pattern: e.target.value }))}
          />
          <input
            placeholder="Process path pattern"
            value={form.process_path_pattern}
            onChange={(e) => setForm((f) => ({ ...f, process_path_pattern: e.target.value }))}
          />
          <input
            placeholder="Rule title contains"
            value={form.title_contains}
            onChange={(e) => setForm((f) => ({ ...f, title_contains: e.target.value }))}
          />
          <input type="datetime-local" value={form.expires_at} onChange={(e) => setForm((f) => ({ ...f, expires_at: e.target.value }))} />
          <input placeholder="Comment" value={form.comment} onChange={(e) => setForm((f) => ({ ...f, comment: e.target.value }))} />
        </div>
        <button type="submit" className="falcon-btn falcon-btn-primary" style={{ marginTop: '0.75rem' }}>
          Save suppression
        </button>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Rule</th>
              <th>Endpoint</th>
              <th>Patterns</th>
              <th>Expires</th>
              <th>On</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td>{s.rule_id || 'all'}</td>
                <td>{s.endpoint_id || '—'}</td>
                <td style={{ fontSize: '0.8rem', maxWidth: 280 }}>
                  {[s.hostname_pattern, s.process_path_pattern, s.title_contains].filter(Boolean).join(' · ') || '—'}
                </td>
                <td className="mono">{s.expires_at ? new Date(s.expires_at).toLocaleString() : 'never'}</td>
                <td>{s.enabled ? 'yes' : 'no'}</td>
                <td>
                  <button type="button" className={styles.viewLink} onClick={() => toggle(s.id, s.enabled)}>
                    Toggle
                  </button>{' '}
                  <button type="button" className={styles.deleteBtn} onClick={() => remove(s.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {rows.length === 0 && <p className={styles.pageSub}>No suppressions or table not migrated.</p>}
      </div>
    </>
  );

  if (embedded) return <div>{body}</div>;

  return (
    <PageShell
      kicker="Configuration"
      title="Suppressions"
      description="Suppress new alerts when patterns match (rule, host, path, title). Requires: npm run migrate-capabilities-v2"
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

