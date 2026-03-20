import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './Events.module.css';

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

function eventTypeClass(type) {
  if (!type) return '';
  const t = (type || '').toLowerCase();
  if (t.includes('process') || t.includes('create')) return styles.typeProcess;
  if (t.includes('network') || t.includes('connect')) return styles.typeNetwork;
  if (t.includes('file') || t.includes('write')) return styles.typeFile;
  if (t.includes('registry')) return styles.typeRegistry;
  if (t.includes('logon') || t.includes('auth')) return styles.typeAuth;
  return styles.typeOther;
}

const truncate = (s, len = 45) => {
  if (!s) return '-';
  return s.length > len ? s.slice(0, len) + '…' : s;
};

export default function Events() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    endpointId: searchParams.get('endpointId') || '',
    hostname: searchParams.get('hostname') || '',
    eventType: searchParams.get('eventType') || '',
    eventSource: searchParams.get('eventSource') || '',
    username: '',
    processName: '',
    dateFrom: '',
    dateTo: '',
    limit: 100,
    offset: 0,
  });
  const [endpoints, setEndpoints] = useState([]);

  const fetchData = () => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => {
      if (v !== '' && v !== undefined) params.set(k, v);
    });
    setLoading(true);
    api(`/api/admin/normalized-events?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events || []);
        setTotal(data.total ?? 0);
        setSummary(data.summary || null);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  useEffect(() => {
    api('/api/admin/endpoints?limit=200')
      .then((r) => r.json())
      .then((d) => setEndpoints(Array.isArray(d) ? d : (d?.endpoints || [])))
      .catch(() => setEndpoints([]));
  }, []);

  const s = summary || {};

  if (loading && events.length === 0) return <div className={styles.loading}>Loading events...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>
          <span className={styles.titleIcon}>◈</span> Events
        </h1>
        <div className={styles.headerActions}>
          <Link to="/raw-events" className={styles.rawLink}>Raw Events</Link>
          <button onClick={fetchData} className={styles.refreshBtn}>↻ Refresh</button>
        </div>
      </div>

      <div className={styles.statsBar}>
        <div
          className={`${styles.statCard} ${styles.statToday}`}
          onClick={() => setFilters((f) => ({
            ...f,
            dateFrom: new Date().toISOString().slice(0, 10),
            dateTo: new Date().toISOString().slice(0, 10),
            offset: 0,
          }))}
        >
          <span className={styles.statValue}>{s.today ?? 0}</span>
          <span className={styles.statLabel}>Today</span>
        </div>
        <div className={styles.statCard}>
          <span className={styles.statValue}>{s.total ?? 0}</span>
          <span className={styles.statLabel}>Total</span>
        </div>
        {s.byType?.slice(0, 4).map((row) => (
          <div
            key={row.type}
            className={styles.statCard}
            onClick={() => setFilters((f) => ({ ...f, eventType: row.type, offset: 0 }))}
          >
            <span className={styles.statValue}>{row.count}</span>
            <span className={styles.statLabel}>{truncate(row.type || 'unknown', 12)}</span>
          </div>
        ))}
      </div>

      <div className={styles.filters}>
        <select
          value={filters.endpointId}
          onChange={(e) => setFilters((f) => ({ ...f, endpointId: e.target.value, offset: 0 }))}
        >
          <option value="">All endpoints</option>
          {endpoints.map((ep) => (
            <option key={ep.id} value={ep.id}>{ep.hostname || `Endpoint ${ep.id}`}</option>
          ))}
        </select>
        <input
          placeholder="Hostname"
          value={filters.hostname}
          onChange={(e) => setFilters((f) => ({ ...f, hostname: e.target.value, offset: 0 }))}
        />
        <input
          placeholder="Event type"
          value={filters.eventType}
          onChange={(e) => setFilters((f) => ({ ...f, eventType: e.target.value, offset: 0 }))}
        />
        <input
          placeholder="Event source"
          value={filters.eventSource}
          onChange={(e) => setFilters((f) => ({ ...f, eventSource: e.target.value, offset: 0 }))}
        />
        <input
          placeholder="Process"
          value={filters.processName}
          onChange={(e) => setFilters((f) => ({ ...f, processName: e.target.value, offset: 0 }))}
        />
        <input
          placeholder="User"
          value={filters.username}
          onChange={(e) => setFilters((f) => ({ ...f, username: e.target.value, offset: 0 }))}
        />
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

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Host</th>
              <th>Type</th>
              <th>Source</th>
              <th>Process</th>
              <th>User</th>
              <th>Parent</th>
              <th>Command</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {events.map((evt) => (
              <tr
                key={evt.id}
                className={styles.eventRow}
                onClick={() => navigate(`/normalized-events/${evt.id}`)}
              >
                <td className={styles.timeCell}>
                  <span className={styles.timeAgo}>{timeAgo(evt.timestamp)}</span>
                  <span className={styles.timeFull}>{new Date(evt.timestamp).toLocaleString()}</span>
                </td>
                <td>
                  <Link to={`/endpoints/${evt.endpoint_id}`} onClick={(e) => e.stopPropagation()}>
                    {evt.hostname || evt.endpoint_hostname || '-'}
                  </Link>
                </td>
                <td>
                  <span className={`${styles.typeBadge} ${eventTypeClass(evt.event_type)}`}>
                    {evt.event_type || '-'}
                  </span>
                </td>
                <td className={styles.sourceCell}>{evt.event_source || '-'}</td>
                <td className={styles.processCell}>
                  <span className={styles.processName}>{evt.process_name || '-'}</span>
                </td>
                <td>{evt.username || '-'}</td>
                <td className={styles.parentCell}>{evt.parent_process_name || '-'}</td>
                <td className={`${styles.cmdCell} mono`} title={evt.command_line}>
                  {truncate(evt.command_line, 35)}
                </td>
                <td className={styles.actionsCell} onClick={(e) => e.stopPropagation()}>
                  <button
                    className={styles.quickBtn}
                    onClick={() => navigate(`/normalized-events/${evt.id}`)}
                  >
                    Details
                  </button>
                  <Link
                    to={`/endpoints/${evt.endpoint_id}/process-tree`}
                    className={styles.quickBtn}
                  >
                    Tree
                  </Link>
                  <Link to={`/endpoints/${evt.endpoint_id}`} className={styles.quickBtn}>
                    Endpoint
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && <div className={styles.empty}>No events match your filters.</div>}
      </div>

      <div className={styles.pagination}>
        <button
          onClick={() => setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
          disabled={filters.offset === 0}
        >
          ← Previous
        </button>
        <span>
          {filters.offset + 1}–{Math.min(filters.offset + events.length, filters.offset + filters.limit)} of {total}
        </span>
        <button
          onClick={() => setFilters((f) => ({ ...f, offset: f.offset + f.limit }))}
          disabled={events.length < filters.limit}
        >
          Next →
        </button>
      </div>
    </div>
  );
}
