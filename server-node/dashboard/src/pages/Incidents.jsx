import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconTableShell from '../components/FalconTableShell';
import FalconEmptyState from '../components/FalconEmptyState';
import FalconPagination from '../components/FalconPagination';
import { falconSeverityClass } from '../utils/falconUi';
import { asJsonListWithTotal } from '../utils/apiJson';
import styles from './Incidents.module.css';

function timeAgo(date) {
  const d = new Date(date);
  const now = new Date();
  const sec = Math.floor((now - d) / 1000);
  if (sec < 60) return 'Just now';
  if (sec < 3600) return `${Math.floor(sec / 60)}m ago`;
  if (sec < 86400) return `${Math.floor(sec / 3600)}h ago`;
  return d.toLocaleDateString();
}

export default function Incidents() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [incidents, setIncidents] = useState([]);
  const [listTotal, setListTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({ status: '', severity: '', sla_breached: '', limit: 50, offset: 0 });

  const fetchData = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== undefined) params.set(k, v);
    });
    setLoading(true);
    api(`/api/admin/incidents?${params}`)
      .then((r) => asJsonListWithTotal(r, 'incidents'))
      .then(({ list, total }) => {
        setIncidents(list);
        setListTotal(total);
      })
      .catch(() => {
        setIncidents([]);
        setListTotal(0);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const statusClass = (s) => {
    if (s === 'open') return styles.statusOpen;
    if (s === 'investigating') return styles.statusInvestigating;
    if (s === 'resolved') return styles.statusResolved;
    return styles.statusClosed;
  };

  const updateStatus = async (id, status) => {
    await api(`/api/admin/incidents/${id}/status`, {
      method: 'POST',
      body: JSON.stringify({ status }),
    });
    fetchData();
  };

  if (loading && incidents.length === 0) return <PageShell loading loadingLabel="Loading incidents…" />;

  return (
    <PageShell
      kicker="Respond"
      title="Incidents"
      description="Correlated alert groups — triage, change status, and drill into details."
      actions={
        <button type="button" onClick={fetchData} className="falcon-btn falcon-btn-ghost">
          ↻ Refresh
        </button>
      }
    >
    <div className={styles.container}>
      <FalconTableShell
        toolbar={(
          <div className={`${styles.filters} falcon-filter-bar`}>
            <select
              value={filters.status}
              onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value, offset: 0 }))}
            >
              <option value="">All statuses</option>
              <option value="open">Open</option>
              <option value="investigating">Investigating</option>
              <option value="resolved">Resolved</option>
              <option value="closed">Closed</option>
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
            <select
              value={filters.sla_breached}
              onChange={(e) => setFilters((f) => ({ ...f, sla_breached: e.target.value, offset: 0 }))}
            >
              <option value="">All SLA states</option>
              <option value="true">SLA breached</option>
            </select>
          </div>
        )}
        footer={(
          <FalconPagination
            offset={filters.offset}
            limit={filters.limit}
            total={listTotal}
            pageItemCount={incidents.length}
            onPrev={() => setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
            onNext={() => setFilters((f) => ({ ...f, offset: f.offset + f.limit }))}
            onLimitChange={(newLimit) => setFilters((f) => ({ ...f, limit: newLimit, offset: 0 }))}
            pageSizeOptions={[25, 50, 100]}
          />
        )}
      >
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Time</th>
              <th>Title</th>
              <th>Endpoint</th>
              <th>Severity</th>
              <th>Status</th>
              <th>Owner</th>
              <th>Due</th>
              <th>Correlation</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {incidents.map((inc) => (
              <tr
                key={inc.id}
                className={styles.row}
                onClick={() => navigate(`/incidents/${inc.id}`)}
              >
                <td className={styles.mono}>{inc.incident_id}</td>
                <td className={styles.timeCell}>
                  <span>{timeAgo(inc.updated_at)}</span>
                  <span className={styles.timeFull}>{new Date(inc.updated_at).toLocaleString()}</span>
                </td>
                <td className={styles.titleCell}>{inc.title}</td>
                <td>
                  {inc.endpoint_id ? (
                    <Link to={`/endpoints/${inc.endpoint_id}`} onClick={(e) => e.stopPropagation()}>
                      {inc.hostname || `Endpoint ${inc.endpoint_id}`}
                    </Link>
                  ) : (
                    '-'
                  )}
                </td>
                <td>
                  <span className={falconSeverityClass(inc.severity)}>{inc.severity}</span>
                </td>
                <td>
                  <span className={`${styles.statusBadge} ${statusClass(inc.status)}`}>{inc.status}</span>
                </td>
                <td className={styles.mono}>{inc.owner_username || '-'}</td>
                <td className={styles.timeCell}>
                  {inc.due_at ? (
                    <>
                      <span>{timeAgo(inc.due_at)}</span>
                      <span className={styles.timeFull}>{new Date(inc.due_at).toLocaleString()}</span>
                    </>
                  ) : (
                    '-'
                  )}
                </td>
                <td className={styles.mono}>{inc.correlation_type || '-'}</td>
                <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                  {inc.status === 'open' && (
                    <button className={styles.quickBtn} onClick={() => updateStatus(inc.id, 'investigating')}>
                      Investigate
                    </button>
                  )}
                  {inc.status !== 'closed' && (
                    <button className={styles.quickBtn} onClick={() => updateStatus(inc.id, 'closed')}>
                      Close
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {incidents.length === 0 && (
          <FalconEmptyState
            title="No incidents found"
            description="Incidents appear when correlated alert groups are created. Adjust status or severity filters."
          />
        )}
      </div>
      </FalconTableShell>
    </div>
    </PageShell>
  );
}
