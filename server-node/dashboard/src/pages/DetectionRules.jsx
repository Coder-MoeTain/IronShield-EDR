import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconTableShell from '../components/FalconTableShell';
import FalconEmptyState from '../components/FalconEmptyState';
import Suppressions from './Suppressions';
import { falconSeverityClass } from '../utils/falconUi';
import { asJsonListOrKeyed } from '../utils/apiJson';
import styles from './DetectionRules.module.css';

function numOrNull(v) {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export default function DetectionRules() {
  const { api } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'suppressions' ? 'suppressions' : 'rules';

  const [rules, setRules] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [bulkWorking, setBulkWorking] = useState(false);

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

  useEffect(() => {
    setSelected(new Set());
  }, [q, severity, enabled]);

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

  const toggleSelect = (ruleId) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(ruleId)) next.delete(ruleId);
      else next.add(ruleId);
      return next;
    });
  };

  const selectAllVisible = () => {
    if (rules.length === 0) return;
    setSelected(new Set(rules.map((r) => r.id)));
  };

  const clearSelection = () => setSelected(new Set());

  const setBulkEnabled = async (enabledNext) => {
    const ids = [...selected];
    if (ids.length === 0) return;
    setBulkWorking(true);
    try {
      for (const id of ids) {
        const res = await api(`/api/admin/detection-rules/${id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ enabled: enabledNext }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error || `Failed on rule ${id}`);
      }
      clearSelection();
      fetchRules();
    } catch (e) {
      console.error(e);
    } finally {
      setBulkWorking(false);
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
  const totalInDb = numOrNull(s.total);

  const stats = useMemo(() => {
    const med = numOrNull(s.medium);
    const low = numOrNull(s.low);
    return [
      { label: 'Total rules (database)', value: numOrNull(s.total) ?? '—' },
      { label: 'Enabled (database)', value: numOrNull(s.enabled_count) ?? '—' },
      { label: 'Critical', value: numOrNull(s.critical) ?? '—' },
      { label: 'High', value: numOrNull(s.high) ?? '—' },
      {
        label: 'Medium / Low',
        value: med != null && low != null ? `${med} / ${low}` : '—',
      },
    ];
  }, [s]);

  const visibleRules = rules.length;
  const activeFilterCount = [q, severity, enabled].filter(Boolean).length;
  const visibleEnabledCount = rules.filter((r) => r.enabled).length;
  const visibleCriticalCount = rules.filter((r) => r.severity === 'critical').length;

  return (
    <PageShell
      kicker="Detection"
      title="Custom IOA rules"
      description="Define conditions (ANDed) for the server detection engine. Enabled rules are pushed to agents for local evaluation; matching rules appear as agent_rule_matches on telemetry. Use suppressions to reduce noise."
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

          {!loading && (
            <p className={styles.listContext} role="status">
              {totalInDb != null ? (
                <>
                  Showing <strong>{visibleRules}</strong> of <strong>{totalInDb}</strong> rules in this table
                  {activeFilterCount > 0
                    ? ' (filters applied)'
                    : visibleRules === totalInDb
                      ? ' — all rules in the database'
                      : ''}
                  .
                </>
              ) : (
                <>
                  Showing <strong>{visibleRules}</strong> rules (database totals unavailable).
                </>
              )}
            </p>
          )}

          <div className={styles.overviewStrip}>
            <div className={styles.overviewItem}>
              <span className={styles.overviewLabel}>Rows listed</span>
              <strong className={styles.overviewValue}>{visibleRules}</strong>
            </div>
            <div className={styles.overviewItem}>
              <span className={styles.overviewLabel}>Visible enabled</span>
              <strong className={styles.overviewValue}>{visibleEnabledCount}</strong>
            </div>
            <div className={styles.overviewItem}>
              <span className={styles.overviewLabel}>Visible critical</span>
              <strong className={styles.overviewValue}>{visibleCriticalCount}</strong>
            </div>
            <div className={styles.overviewItem}>
              <span className={styles.overviewLabel}>Active filters</span>
              <strong className={styles.overviewValue}>{activeFilterCount}</strong>
            </div>
          </div>

          <FalconTableShell
            toolbar={
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
                <button type="button" className="falcon-btn falcon-btn-ghost" onClick={selectAllVisible} disabled={rules.length === 0}>
                  Select visible
                </button>
                <button type="button" className="falcon-btn falcon-btn-ghost" onClick={clearSelection} disabled={selected.size === 0}>
                  Clear selection ({selected.size})
                </button>
                <button
                  type="button"
                  className="falcon-btn falcon-btn-ghost"
                  onClick={() => setBulkEnabled(true)}
                  disabled={selected.size === 0 || bulkWorking}
                >
                  {bulkWorking ? '…' : 'Enable selected'}
                </button>
                <button
                  type="button"
                  className="falcon-btn falcon-btn-ghost"
                  onClick={() => setBulkEnabled(false)}
                  disabled={selected.size === 0 || bulkWorking}
                >
                  {bulkWorking ? '…' : 'Disable selected'}
                </button>
                <button
                  type="button"
                  className="falcon-btn falcon-btn-ghost"
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.delete('q');
                    next.delete('severity');
                    next.delete('enabled');
                    setSearchParams(next, { replace: true });
                  }}
                  disabled={!q && !severity && !enabled}
                >
                  Clear filters
                </button>
              </div>
            }
          >
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th className={styles.checkCol} aria-label="Select">
                      <input
                        type="checkbox"
                        checked={rules.length > 0 && selected.size === rules.length}
                        onChange={() => (selected.size === rules.length ? clearSelection() : selectAllVisible())}
                      />
                    </th>
                    <th>Status</th>
                    <th>Rule ID</th>
                    <th>Title</th>
                    <th>Severity</th>
                    <th>MITRE</th>
                    <th>Description</th>
                    <th>Updated</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {rules.map((r) => (
                    <tr key={r.id}>
                      <td className={styles.checkCol}>
                        <input
                          type="checkbox"
                          checked={selected.has(r.id)}
                          onChange={() => toggleSelect(r.id)}
                          aria-label={`Select ${r.name}`}
                        />
                      </td>
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
                      <td className={styles.descCell} title={r.description || ''}>
                        {r.description ? r.description.slice(0, 72) : '—'}
                        {r.description && r.description.length > 72 ? '…' : ''}
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
              {rules.length === 0 && (
                <FalconEmptyState
                  title="No detection rules match filters"
                  description="Clear search or filters, or create a new rule from the toolbar."
                />
              )}
            </div>
          </FalconTableShell>
        </>
      )}
    </PageShell>
  );
}
