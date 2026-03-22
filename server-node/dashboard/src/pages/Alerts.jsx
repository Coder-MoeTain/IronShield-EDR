import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconEmptyState from '../components/FalconEmptyState';
import FalconPagination from '../components/FalconPagination';
import { falconSeverityClass } from '../utils/falconUi';
import styles from './Alerts.module.css';

function timeAgo(date) {
  const d = new Date(date);
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
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [savedViews, setSavedViews] = useState([]);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const filters = useMemo(
    () => ({
      status: searchParams.get('status') || '',
      severity: searchParams.get('severity') || '',
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
        severity: searchParams.get('severity') || '',
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
      .then((r) => r.json())
      .then((data) => {
        setAlerts(data.alerts || data || []);
        setSummary(data.summary || null);
      })
      .catch(() => setAlerts([]))
      .finally(() => setLoading(false));
  }, [api, filters]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    api('/api/admin/saved-views?page=detections')
      .then((r) => r.json())
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
            severity: filters.severity,
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
      severity: f.severity ?? '',
      dateFrom: f.dateFrom ?? '',
      dateTo: f.dateTo ?? '',
      assigned_to: f.assigned_to ?? '',
      assigned_team: f.assigned_team ?? '',
      offset: 0,
    }));
  };

  const deleteSavedView = async (viewId, e) => {
    e.stopPropagation();
    if (!window.confirm('Delete this saved view?')) return;
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
        <select
          value={filters.status}
          onChange={(e) => setFilters({ status: e.target.value, offset: 0 })}
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="investigating">Investigating</option>
          <option value="closed">Closed</option>
          <option value="false_positive">False Positive</option>
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

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.colCheck}>
                <input
                  type="checkbox"
                  checked={alerts.length > 0 && selectedIds.size === alerts.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Time</th>
              <th>Alert</th>
              <th>Endpoint</th>
              <th>Severity</th>
              <th>Status</th>
              <th>MITRE</th>
              <th>Conf.</th>
              <th title="Heuristic risk (severity × confidence) — not cloud ML">Risk</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr
                key={a.id}
                className={`${styles.alertRow} ${a.severity === 'critical' ? styles.rowCritical : ''}`}
                onClick={() => navigate(`/alerts/${a.id}`)}
              >
                <td className={styles.colCheck} onClick={(e) => e.stopPropagation()}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(a.id)}
                    onChange={() => toggleSelect(a.id)}
                  />
                </td>
                <td className={styles.timeCell}>
                  <span className={styles.timeAgo}>{timeAgo(a.first_seen)}</span>
                  <span className={styles.timeFull}>{new Date(a.first_seen).toLocaleString()}</span>
                </td>
                <td className={styles.titleCell}>
                  <Link to={`/alerts/${a.id}`} onClick={(e) => e.stopPropagation()} className={styles.alertTitle}>
                    {a.title}
                  </Link>
                  {a.description && (
                    <div className={styles.alertDesc} title={a.description}>
                      {a.description.length > 80 ? a.description.slice(0, 80) + '…' : a.description}
                    </div>
                  )}
                </td>
                <td>
                  <Link to={`/endpoints/${a.endpoint_id}`} onClick={(e) => e.stopPropagation()}>
                    {a.hostname}
                  </Link>
                </td>
                <td>
                  <span className={falconSeverityClass(a.severity)}>{a.severity}</span>
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${statusClass(a.status)}`}>{a.status}</span>
                </td>
                <td className={styles.mitreCell}>
                  {a.mitre_technique ? (
                    <span className={styles.mitreBadge} title={a.mitre_tactic}>
                      {a.mitre_technique}
                    </span>
                  ) : (
                    '-'
                  )}
                </td>
                <td className={styles.confCell}>{a.confidence != null ? `${Math.round(a.confidence * 100)}%` : '-'}</td>
                <td className="mono" title="Heuristic risk score">
                  {a.risk_score != null && a.risk_score !== '' ? Math.round(Number(a.risk_score)) : '—'}
                </td>
                <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                  <button
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
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {alerts.length === 0 && (
          <FalconEmptyState
            title="No detections match your filters"
            description="Adjust status, severity, assignment, or date range — or clear filters to see more results."
          />
        )}
      </div>

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
    </div>
    </PageShell>
  );
}
