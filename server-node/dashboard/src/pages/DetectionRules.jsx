import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import Suppressions from './Suppressions';
import { falconSeverityClass } from '../utils/falconUi';
import { asJsonListOrKeyed } from '../utils/apiJson';
import styles from './DetectionRules.module.css';

export default function DetectionRules() {
  const { api } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'suppressions' ? 'suppressions' : 'rules';

  const [rules, setRules] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);

  const q = searchParams.get('q') || '';
  const severity = searchParams.get('severity') || '';
  const enabled = searchParams.get('enabled') || '';

  const fetchRules = useCallback(() => {
    setLoading(true);
    const p = new URLSearchParams();
    if (q) p.set('q', q);
    if (severity) p.set('severity', severity);
    if (enabled) p.set('enabled', enabled);
    api(`/api/admin/detection-rules?${p}`)
      .then((r) => asJsonListOrKeyed(r, 'rules'))
      .then(({ list, summary }) => {
        setRules(list);
        setSummary(summary);
      })
      .catch(() => {
        setRules([]);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [api, q, severity, enabled]);

  useEffect(() => {
    if (tab === 'rules') fetchRules();
  }, [tab, fetchRules]);

  const setFilter = (key, value) => {
    const next = new URLSearchParams(searchParams);
    if (value === '' || value == null) next.delete(key);
    else next.set(key, value);
    if (key !== 'tab') next.delete('offset');
    setSearchParams(next, { replace: true });
  };

  const toggleRule = async (rule) => {
    setToggling(rule.id);
    try {
      const res = await api(`/api/admin/detection-rules/${rule.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !rule.enabled }),
      });
      const updated = await res.json();
      if (!res.ok) throw new Error(updated.error || 'Failed');
      setRules((prev) => prev.map((r) => (r.id === rule.id ? updated : r)));
      fetchRules();
    } catch (e) {
      console.error(e);
    } finally {
      setToggling(null);
    }
  };

  const setTab = (next) => {
    if (next === 'rules') {
      const n = new URLSearchParams(searchParams);
      n.delete('tab');
      setSearchParams(n, { replace: true });
    } else setSearchParams({ tab: 'suppressions' }, { replace: true });
  };

  const s = summary || {};
  const stats = useMemo(
    () => [
      { label: 'Total rules', value: s.total ?? '—' },
      { label: 'Enabled', value: s.enabled_count ?? '—' },
      { label: 'Critical', value: s.critical ?? '—' },
      { label: 'High', value: s.high ?? '—' },
      { label: 'Medium / Low', value: `${s.medium ?? 0} / ${s.low ?? 0}` },
    ],
    [s]
  );

  return (
    <PageShell
      kicker="Detection"
      title="Custom IOA rules"
      description="Falcon-style detection definitions: sensor evaluates normalized events against JSON conditions (Sigma-like). Manage suppressions separately to reduce noise."
      actions={
        tab === 'rules' ? (
          <Link to="/detection-rules/new" className="falcon-btn">
            + New rule
          </Link>
        ) : null
      }
    >
      <div className="ui-segmented" role="tablist" aria-label="Detection rules sections">
        <button type="button" role="tab" aria-selected={tab === 'rules'} onClick={() => setTab('rules')}>
          Rules
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'suppressions'}
          onClick={() => setTab('suppressions')}
        >
          Suppressions
        </button>
      </div>

      {tab === 'suppressions' ? (
        <Suppressions embedded />
      ) : loading && rules.length === 0 ? (
        <div className="ui-loading" role="status">
          Loading rules
        </div>
      ) : (
        <>
          <div className={styles.statsStrip}>
            {stats.map((x) => (
              <div key={x.label} className={styles.statCard}>
                <span className={styles.statValue}>{x.value}</span>
                <span className={styles.statLabel}>{x.label}</span>
              </div>
            ))}
          </div>

          <div className={styles.toolbar}>
            <input
              type="search"
              className={styles.search}
              placeholder="Search name, title, description…"
              value={q}
              onChange={(e) => setFilter('q', e.target.value)}
              aria-label="Search rules"
            />
            <select value={severity} onChange={(e) => setFilter('severity', e.target.value)}>
              <option value="">All severities</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select value={enabled} onChange={(e) => setFilter('enabled', e.target.value)}>
              <option value="">All states</option>
              <option value="true">Enabled only</option>
              <option value="false">Disabled only</option>
            </select>
            <button type="button" className="falcon-btn falcon-btn-ghost" onClick={fetchRules}>
              ↻ Refresh
            </button>
          </div>

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Status</th>
                  <th>Rule ID</th>
                  <th>Title</th>
                  <th>Severity</th>
                  <th>MITRE</th>
                  <th>Updated</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {rules.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button
                        type="button"
                        className={`${styles.togglePill} ${r.enabled ? styles.on : styles.off}`}
                        onClick={() => toggleRule(r)}
                        disabled={toggling === r.id}
                        title={r.enabled ? 'Disable' : 'Enable'}
                      >
                        {toggling === r.id ? '…' : r.enabled ? 'On' : 'Off'}
                      </button>
                    </td>
                    <td className={`mono ${styles.ruleId}`}>{r.name}</td>
                    <td>
                      <Link to={`/detection-rules/${r.id}`} className={styles.titleLink}>
                        {r.title}
                      </Link>
                    </td>
                    <td>
                      <span className={falconSeverityClass(r.severity)}>{r.severity}</span>
                    </td>
                    <td className={styles.mitreCell}>
                      {r.mitre_technique ? (
                        <span title={r.mitre_tactic || ''}>{r.mitre_technique}</span>
                      ) : (
                        '—'
                      )}
                    </td>
                    <td className={styles.timeCell}>
                      {r.updated_at ? new Date(r.updated_at).toLocaleString() : '—'}
                    </td>
                    <td className={styles.rowActions}>
                      <Link to={`/detection-rules/${r.id}`} className={styles.linkBtn}>
                        View
                      </Link>
                      <Link to={`/detection-rules/${r.id}/edit`} className={styles.linkBtn}>
                        Edit
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {rules.length === 0 && <p className={styles.empty}>No detection rules match filters.</p>}
        </>
      )}
    </PageShell>
  );
}
