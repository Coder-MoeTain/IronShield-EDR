import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
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
  const [searchParams] = useSearchParams();
  const { api } = useAuth();
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState([]);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    status: searchParams.get('status') || '',
    severity: searchParams.get('severity') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    limit: 100,
    offset: 0,
  });
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkStatus, setBulkStatus] = useState('');
  const [assignTo, setAssignTo] = useState('');

  const fetchData = () => {
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
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const severityClass = (s) => {
    if (s === 'critical') return styles.critical;
    if (s === 'high') return styles.high;
    if (s === 'medium') return styles.medium;
    return styles.low;
  };

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
    for (const id of selectedIds) {
      await api(`/api/admin/alerts/${id}/status`, {
        method: 'POST',
        body: JSON.stringify({ status: bulkStatus, assigned_to: assignTo || undefined }),
      });
    }
    setSelectedIds(new Set());
    setBulkStatus('');
    fetchData();
  };

  const quickAssign = async (id, status) => {
    await api(`/api/admin/alerts/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status: status || undefined }),
    });
    fetchData();
  };

  const s = summary || {};

  if (loading && alerts.length === 0) return <div className={styles.loading}>Loading alert queue...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>⚠</span> Alert Queue
        </h1>
        <button onClick={fetchData} className={styles.refreshBtn}>↻ Refresh</button>
      </div>

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

      <div className={styles.filters}>
        <select
          value={filters.status}
          onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, offset: 0 }))}
        >
          <option value="">All statuses</option>
          <option value="new">New</option>
          <option value="investigating">Investigating</option>
          <option value="closed">Closed</option>
          <option value="false_positive">False Positive</option>
        </select>
        <select
          value={filters.severity}
          onChange={(e) => setFilters((f) => ({ ...f, severity: e.target.value, offset: 0 }))}
        >
          <option value="">All severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
        <input
          type="date"
          value={filters.dateFrom}
          onChange={(e) => setFilters((f) => ({ ...f, dateFrom: e.target.value, offset: 0 }))}
          placeholder="From"
        />
        <input
          type="date"
          value={filters.dateTo}
          onChange={(e) => setFilters((f) => ({ ...f, dateTo: e.target.value, offset: 0 }))}
          placeholder="To"
        />
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
                  <span className={`${styles.badge} ${styles.severityBadge} ${severityClass(a.severity)}`}>
                    {a.severity}
                  </span>
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
        {alerts.length === 0 && <div className={styles.empty}>No alerts match your filters.</div>}
      </div>

      <div className={styles.pagination}>
        <button
          onClick={() => setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
          disabled={filters.offset === 0}
        >
          ← Previous
        </button>
        <span>
          {filters.offset + 1}–{Math.min(filters.offset + filters.limit, filters.offset + alerts.length)} of{' '}
          {summary?.total ?? alerts.length}
        </span>
        <button
          onClick={() => setFilters((f) => ({ ...f, offset: f.offset + f.limit }))}
          disabled={alerts.length < filters.limit}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
