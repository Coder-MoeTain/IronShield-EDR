import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import PageShell from '../components/PageShell';
import FalconTableShell from '../components/FalconTableShell';
import FalconEmptyState from '../components/FalconEmptyState';
import FalconPagination from '../components/FalconPagination';
import VirtualizedScrollList from '../components/VirtualizedScrollList';
import { useTableColumnPreferences } from '../hooks/useTableColumnPreferences';
import { falconSeverityClass } from '../utils/falconUi';
import styles from './Alerts.module.css';

const ALERT_DATA_COLS = [
  { key: 'time', label: 'Time' },
  { key: 'title', label: 'Alert' },
  { key: 'endpoint', label: 'Endpoint' },
  { key: 'severity', label: 'Severity' },
  { key: 'status', label: 'Status' },
  { key: 'mitre', label: 'MITRE' },
  { key: 'conf', label: 'Conf.' },
  {
    key: 'risk',
    label: 'Risk',
    title: 'Heuristic risk (severity × confidence) — not cloud ML',
  },
  { key: 'actions', label: 'Actions' },
];

const ALERT_COL_DEFAULTS = Object.fromEntries(ALERT_DATA_COLS.map((c) => [c.key, true]));

const ALERT_W = {
  time: 'minmax(100px, 1fr)',
  title: 'minmax(160px, 2fr)',
  endpoint: 'minmax(88px, 1fr)',
  severity: 'minmax(72px, 0.7fr)',
  status: 'minmax(88px, 0.9fr)',
  mitre: 'minmax(72px, 0.8fr)',
  conf: 'minmax(44px, 0.5fr)',
  risk: 'minmax(44px, 0.5fr)',
  actions: 'minmax(120px, 1.2fr)',
};

function timeAgo(date) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return '—';
  const now = new Date();
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  if (sec < 604800) return `${Math.floor(sec / 86400)}d ago`;
  return d.toLocaleDateString();
}

export default function Alerts() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { api } = useAuth();
  const { confirm } = useConfirm();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedViews, setSavedViews] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const { visible: colVisible, toggle: colToggle, reset: colReset } = useTableColumnPreferences(
    'detections-list',
    ALERT_COL_DEFAULTS
  );
  const activeDataCols = useMemo(() => ALERT_DATA_COLS.filter((c) => colVisible[c.key]), [colVisible]);
  const alertsGridTpl = useMemo(
    () => ['36px', ...activeDataCols.map((c) => ALERT_W[c.key])].join(' '),
    [activeDataCols]
  );

  const filters = useMemo(
    () => ({
      status: searchParams.get('status') || '',
      status_group: searchParams.get('status_group') || '',
      assigned_state: searchParams.get('assigned_state') || '',
      severity: searchParams.get('severity') || '',
      rule_id: searchParams.get('rule_id') || '',
      dateFrom: searchParams.get('dateFrom') || '',
      dateTo: searchParams.get('dateTo') || '',
      assigned_to: searchParams.get('assigned_to') || '',
      assigned_team: searchParams.get('assigned_team') || '',
      limit: parseInt(searchParams.get('limit') || '100', 10) || 100,
      offset: parseInt(searchParams.get('offset') || '0', 10) || 0,
    }),
    [searchParams]
  );

  const setFilters = useCallback(
    (updater) => {
      const base = {
        status: searchParams.get('status') || '',
        status_group: searchParams.get('status_group') || '',
        assigned_state: searchParams.get('assigned_state') || '',
        severity: searchParams.get('severity') || '',
        rule_id: searchParams.get('rule_id') || '',
        dateFrom: searchParams.get('dateFrom') || '',
        dateTo: searchParams.get('dateTo') || '',
        assigned_to: searchParams.get('assigned_to') || '',
        assigned_team: searchParams.get('assigned_team') || '',
        limit: parseInt(searchParams.get('limit') || '100', 10) || 100,
        offset: parseInt(searchParams.get('offset') || '0', 10) || 0,
      };
      const next = typeof updater === 'function' ? updater(base) : { ...base, ...updater };
      const p = new URLSearchParams();
      Object.entries(next).forEach(([k, v]) => {
        if (v !== '' && v !== undefined && v !== null) {
          if (k === 'limit' && Number(v) === 100) return;
          if (k === 'offset' && Number(v) === 0) return;
          p.set(k, String(v));
        }
      });
      setSearchParams(p, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const fetchData = useCallback(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== undefined) params.set(k, v);
    });
    setLoading(true);
    api(`/api/admin/alerts?${params}`)
      .then(async (r) => {
        let data = {};
        try {
          data = await r.json();
        } catch {
          data = {};
        }
        if (!r.ok) {
          setAlerts([]);
          setSummary(null);
          return;
        }
        const list = data.alerts;
        setAlerts(Array.isArray(list) ? list : []);
        const sum = data.summary;
        setSummary(sum != null && typeof sum === 'object' && !Array.isArray(sum) ? sum : null);
      })
      .catch(() => {
        setAlerts([]);
        setSummary(null);
      })
      .finally(() => setLoading(false));
  }, [api, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    api('/api/admin/saved-views?page=detections')
      .then(async (r) => {
        const data = await r.json().catch(() => []);
        if (!r.ok) return [];
        return Array.isArray(data) ? data : [];
      })
      .then(setSavedViews)
      .catch(() => setSavedViews([]));
  }, [api]);

  const statusClass = (s) => {
    if (s === 'new') return styles.statusNew;
    if (s === 'investigating') return styles.statusInvestigating;
    if (s === 'closed') return styles.statusClosed;
    return styles.statusFalsePositive;
  };

  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === alerts.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(alerts.map((a) => a.id)));
  };

  const bulkUpdateStatus = async () => {
    if (!bulkStatus || selectedIds.size === 0) return;
    for (const alertId of selectedIds) {
      await api(`/api/admin/alerts/${alertId}`, {
        method: 'PATCH',
        body: JSON.stringify({ status: bulkStatus, assigned_to: assignTo.trim() || null }),
      });
    }
    setSelectedIds(new Set());
    setBulkStatus('');
    fetchData();
  };

  const quickAssign = async (alertId, status) => {
    await api(`/api/admin/alerts/${alertId}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: status || undefined }),
    });
    fetchData();
  };

  const renderAlertCell = (a, key) => {
    switch (key) {
      case 'time':
        return (
          <>
            <span className={styles.timeAgo}>{timeAgo(a.first_seen)}</span>
            <span className={styles.timeFull}>
              {a.first_seen && !Number.isNaN(new Date(a.first_seen).getTime())
                ? new Date(a.first_seen).toLocaleString()
                : '—'}
            </span>
          </>
        );
      case 'title':
        return (
          <>
            <Link to={`/alerts/${a.id}`} onClick={(e) => e.stopPropagation()} className={styles.alertTitle}>
              {a.title}
            </Link>
            {a.description && (
              <div className={styles.alertDesc} title={a.description}>
                {a.description.length > 80 ? a.description.slice(0, 80) + '…' : a.description}
              </div>
            )}
          </>
        );
      case 'endpoint':
        return (
          <Link to={`/endpoints/${a.endpoint_id}`} onClick={(e) => e.stopPropagation()}>
            {a.hostname}
          </Link>
        );
      case 'severity':
        return <span className={falconSeverityClass(a.severity)}>{a.severity}</span>;
      case 'status':
        return <span className={`${styles.statusBadge} ${statusClass(a.status)}`}>{a.status}</span>;
      case 'mitre':
        return a.mitre_technique ? (
          <span className={styles.mitreBadge} title={a.mitre_tactic}>
            {a.mitre_technique}
          </span>
        ) : (
          '-'
        );
      case 'conf':
        return a.confidence != null ? `${Math.round(a.confidence * 100)}%` : '-';
      case 'risk':
        return (
          <span className="mono" title="Heuristic risk score">
            {a.risk_score != null && a.risk_score !== '' ? Math.round(Number(a.risk_score)) : '—'}
          </span>
        );
      case 'actions':
        return (
          <span className={styles.actionsInline} onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              className={styles.quickBtn}
              onClick={() => quickAssign(a.id, 'investigating')}
              title="Mark Investigating"
            >
              Investigate
            </button>
            <Link to={`/endpoints/${a.endpoint_id}`} className={styles.quickBtn}>
              Endpoint
            </Link>
            <Link to={`/investigations`} className={styles.quickBtn}>
              Cases
            </Link>
          </span>
        );
      default:
        return null;
    }
  };

  const saveCurrentView = async () => {
    const name = window.prompt('Name for this filter view');
    if (!name?.trim()) return;
    try {
      await api('/api/admin/saved-views', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          page: 'detections',
          filters: {
            status: filters.status,
            status_group: filters.status_group,
            assigned_state: filters.assigned_state,
            severity: filters.severity,
            rule_id: filters.rule_id,
            dateFrom: filters.dateFrom,
            dateTo: filters.dateTo,
            assigned_to: filters.assigned_to,
            assigned_team: filters.assigned_team,
          },
        }),
      });
      const v = await api('/api/admin/saved-views?page=detections').then((r) => r.json());
      setSavedViews(v);
    } catch {
      /* ignore */
    }
  };

  const applySavedView = (view) => {
    let f = {};
    try {
      f = typeof view.filters_json === 'string' ? JSON.parse(view.filters_json) : view.filters_json || {};
    } catch {
      return;
    }
    setFilters((base) => ({
      ...base,
      status: f.status ?? '',
      status_group: f.status_group ?? '',
      assigned_state: f.assigned_state ?? '',
      severity: f.severity ?? '',
      rule_id: f.rule_id ?? '',
      dateFrom: f.dateFrom ?? '',
      dateTo: f.dateTo ?? '',
      assigned_to: f.assigned_to ?? '',
      assigned_team: f.assigned_team ?? '',
      offset: 0,
    }));
  };

  const deleteSavedView = async (viewId, e) => {
    e.stopPropagation();
    if (
      !(await confirm({
        title: 'Delete saved view',
        message: 'Remove this saved filter set from your account?',
        danger: true,
        confirmLabel: 'Delete',
      }))
    )
      return;
    try {
      await api(`/api/admin/saved-views/${viewId}`, { method: 'DELETE' });
      setSavedViews((prev) => prev.filter((v) => v.id !== viewId));
    } catch {
      /* ignore */
    }
  };

  const exportSiemNdjson = async () => {
    try {
      const r = await api('/api/admin/export/siem-alerts');
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const blob = await r.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ironshield-alerts-${new Date().toISOString().slice(0, 10)}.ndjson`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      window.alert('Export failed (check permissions: audit:read or *)');
    }
  };

  const s = summary || {};

  if (loading && alerts.length === 0) {
    return <PageShell loading loadingLabel="Loading detections…" />;
  }

  return (
    <PageShell
      kicker="Detections"
      title="Detections"
      description="Prioritized sensor and correlation alerts — triage, assign, and contain."
      actions={
        <button type="button" onClick={fetchData} className="falcon-btn falcon-btn-ghost">
          ↻ Refresh
        </button>
      }
    >
      <div className={styles.container}>
      <FalconTableShell
        toolbar={
          <>
      <div className={styles.statsBar}>
        <div
          className={`${styles.statCard} ${styles.statNew}`}
          onClick={() => setFilters((f) => ({ ...f, status: 'new', offset: 0 }))}
        >
          <span className={styles.statValue}>{s.new ?? 0}</span>
          <span className={styles.statLabel}>New</span>
        </div>
        <div
          className={`${styles.statCard} ${styles.statInvestigating}`}
          onClick={() => setFilters((f) => ({ ...f, status: 'investigating', offset: 0 }))}
        >
          <span className={styles.statValue}>{s.investigating ?? 0}</span>
          <span className={styles.statLabel}>Investigating</span>
        </div>
        <div
          className={`${styles.statCard} ${styles.statCritical}`}
          onClick={() => setFilters((f) => ({ ...f, severity: 'critical', offset: 0 }))}
        >
          <span className={styles.statValue}>{s.critical ?? 0}</span>
          <span className={styles.statLabel}>Critical</span>
        </div>
        <div
          className={`${styles.statCard} ${styles.statHigh}`}
          onClick={() => setFilters((f) => ({ ...f, severity: 'high', offset: 0 }))}
        >
          <span className={styles.statValue}>{s.high ?? 0}</span>
          <span className={styles.statLabel}>High</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{s.total ?? 0}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
      </div>

      <div className={`${styles.filters} falcon-filter-bar`}>
        <input
          type="text"
          placeholder="Rule ID"
          value={filters.rule_id}
          onChange={(e) => setFilters({ rule_id: e.target.value, offset: 0 })}
        />
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value, status_group: '', offset: 0 })}
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="investigating">Investigating</option>
          <option value="closed">Closed</option>
          <option value="false_positive">False Positive</option>
        </select>
        <select
          value={filters.status_group}
          onChange={(e) => setFilters({ status_group: e.target.value, status: '', offset: 0 })}
        >
          <option value="">All queues</option>
          <option value="active">Active triage (new + investigating)</option>
          <option value="closed_only">Closed only (closed + false positive)</option>
        </select>
        <select
          value={filters.assigned_state}
          onChange={(e) => setFilters({ assigned_state: e.target.value, offset: 0 })}
        >
          <option value="">Any assignment</option>
          <option value="unassigned">Unassigned</option>
          <option value="assigned">Assigned</option>
        </select>
        <select
          value={filters.severity}
          onChange={(e) => setFilters({ severity: e.target.value, offset: 0 })}
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input
          type="text"
          placeholder="Assigned to"
          value={filters.assigned_to}
          onChange={(e) => setFilters({ assigned_to: e.target.value, offset: 0 })}
        />
        <input
          type="text"
          placeholder="Team"
          value={filters.assigned_team}
          onChange={(e) => setFilters({ assigned_team: e.target.value, offset: 0 })}
        />
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters({ dateFrom: e.target.value, offset: 0 })}
          placeholder="From"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => setFilters({ dateTo: e.target.value, offset: 0 })}
          placeholder="To"
        />
      </div>

      <div className={styles.savedViewsBar}>
        <span className={styles.savedViewsLabel}>Saved views</span>
        {savedViews.length > 0 && (
          <div className={styles.savedViewChips}>
            {savedViews.map((v) => (
              <span key={v.id} className={styles.savedViewChip}>
                <button type="button" className={styles.savedViewApply} onClick={() => applySavedView(v)}>
                  {v.name}
                </button>
                <button
                  type="button"
                  className={styles.savedViewDelete}
                  title="Delete"
                  onClick={(e) => deleteSavedView(v.id, e)}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}
        <button type="button" className={styles.saveViewBtn} onClick={saveCurrentView}>
          Save current filters
        </button>
        <button type="button" className={styles.siemLink} onClick={exportSiemNdjson}>
          Export NDJSON (SIEM)
        </button>
      </div>

      {selectedIds.size > 0 && (
        <div className={styles.bulkBar}>
          <span>{selectedIds.size} selected</span>
          <select value={bulkStatus} onChange={(e) => setBulkStatus(e.target.value)}>
            <option value="">Set status...</option>
            <option value="investigating">Investigating</option>
            <option value="closed">Closed</option>
            <option value="false_positive">False Positive</option>
          </select>
          <input
            type="text"
            placeholder="Assign to"
            value={assignTo}
            onChange={(e) => setAssignTo(e.target.value)}
          />
          <button onClick={bulkUpdateStatus}>Apply</button>
          <button onClick={() => setSelectedIds(new Set())}>Clear</button>
        </div>
      )}

      <div className={styles.colToolbar} role="group" aria-label="Column visibility">
        <span className={styles.colToolbarLabel}>Columns</span>
        {ALERT_DATA_COLS.map((c) => (
          <label key={c.key} className={styles.colToggle}>
            <input type="checkbox" checked={colVisible[c.key]} onChange={() => colToggle(c.key)} />
            {c.label}
          </label>
        ))}
        <button type="button" className="falcon-btn falcon-btn-ghost" onClick={colReset}>
          Reset layout
        </button>
      </div>
          </>
        }
        footer={
          <FalconPagination
            offset={filters.offset}
            limit={filters.limit}
            total={summary?.total}
            pageItemCount={alerts.length}
            onPrev={() => setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
            onNext={() => setFilters((f) => ({ ...f, offset: f.offset + f.limit }))}
            onLimitChange={(newLimit) => setFilters((f) => ({ ...f, limit: newLimit, offset: 0 }))}
            pageSizeOptions={[25, 50, 100]}
          />
        }
      >
      <div className={styles.tableWrap}>
        {alerts.length > 0 && (
          <>
            <div className={styles.alertsGridHead} style={{ gridTemplateColumns: alertsGridTpl }}>
              <div className={`${styles.alertsGridTh} ${styles.colCheck}`}>
                <input
                  type="checkbox"
                  checked={alerts.length > 0 && selectedIds.size === alerts.length}
                  onChange={toggleSelectAll}
                />
              </div>
              {activeDataCols.map((c) => (
                <div key={c.key} className={styles.alertsGridTh} title={c.title}>
                  {c.label}
                </div>
              ))}
            </div>
            <VirtualizedScrollList
              count={alerts.length}
              estimateSize={96}
              className={styles.alertsVirtualScroll}
              rowRender={(i) => {
                const a = alerts[i];
                return (
                  <div
                    key={a.id}
                    className={`${styles.alertsGridRow} ${styles.alertRow} ${a.severity === 'critical' ? styles.rowCritical : ''}`}
                    style={{ gridTemplateColumns: alertsGridTpl }}
                    onClick={() => navigate(`/alerts/${a.id}`)}
                  >
                    <div className={styles.colCheck} onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selectedIds.has(a.id)}
                        onChange={() => toggleSelect(a.id)}
                      />
                    </div>
                    {activeDataCols.map((c) => {
                      const tdClass =
                        c.key === 'time'
                          ? styles.timeCell
                          : c.key === 'title'
                            ? styles.titleCell
                            : c.key === 'mitre'
                              ? styles.mitreCell
                              : c.key === 'conf'
                                ? styles.confCell
                                : c.key === 'actions'
                                  ? styles.actionsCell
                                  : '';
                      return (
                        <div
                          key={c.key}
                          className={`${styles.alertsGridTd} ${tdClass}`.trim()}
                          onClick={c.key === 'actions' ? (e) => e.stopPropagation() : undefined}
                        >
                          {renderAlertCell(a, c.key)}
                        </div>
                      );
                    })}
                  </div>
                );
              }}
            />
          </>
        )}
        {alerts.length === 0 && (
          <FalconEmptyState
            title="No detections match your filters"
            description="Adjust status, severity, assignment, or date range — or clear filters to see more results."
          />
        )}
      </div>
      </FalconTableShell>
    </div>
    </PageShell>
  );
}
