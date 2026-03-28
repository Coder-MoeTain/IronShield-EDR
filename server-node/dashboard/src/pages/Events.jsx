import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconEmptyState from '../components/FalconEmptyState';
import FalconPagination from '../components/FalconPagination';
import VirtualizedScrollList from '../components/VirtualizedScrollList';
import { useTableColumnPreferences } from '../hooks/useTableColumnPreferences';
import styles from './Events.module.css';

const EVENT_COLS = [
  { key: 'time', label: 'Time' },
  { key: 'host', label: 'Host' },
  { key: 'type', label: 'Type' },
  { key: 'source', label: 'Source' },
  { key: 'process', label: 'Process' },
  { key: 'user', label: 'User' },
  { key: 'parent', label: 'Parent' },
  { key: 'command', label: 'Command' },
  { key: 'actions', label: 'Actions' },
];

const EVENT_DEFAULTS = Object.fromEntries(EVENT_COLS.map((c) => [c.key, true]));

const COL_W = {
  time: 'minmax(110px, 1.1fr)',
  host: 'minmax(88px, 1fr)',
  type: 'minmax(72px, 0.9fr)',
  source: 'minmax(72px, 0.9fr)',
  process: 'minmax(100px, 1fr)',
  user: 'minmax(72px, 0.8fr)',
  parent: 'minmax(72px, 0.8fr)',
  command: 'minmax(140px, 1.4fr)',
  actions: 'minmax(120px, 1fr)',
};

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
  const { visible, toggle, reset } = useTableColumnPreferences('events-list', EVENT_DEFAULTS);
  const activeCols = useMemo(() => EVENT_COLS.filter((c) => visible[c.key]), [visible]);
  const gridTpl = useMemo(() => activeCols.map((c) => COL_W[c.key]).join(' '), [activeCols]);
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

  const renderEventCell = useCallback(
    (evt, key) => {
      switch (key) {
        case 'time':
          return (
            <>
              <span className={styles.timeAgo}>{timeAgo(evt.timestamp)}</span>
              <span className={styles.timeFull}>{new Date(evt.timestamp).toLocaleString()}</span>
            </>
          );
        case 'host':
          return (
            <Link to={`/endpoints/${evt.endpoint_id}`} onClick={(e) => e.stopPropagation()}>
              {evt.hostname || evt.endpoint_hostname || '-'}
            </Link>
          );
        case 'type':
          return (
            <span className={`${styles.typeBadge} ${eventTypeClass(evt.event_type)}`}>{evt.event_type || '-'}</span>
          );
        case 'source':
          return evt.event_source || '-';
        case 'process':
          return <span className={styles.processName}>{evt.process_name || '-'}</span>;
        case 'user':
          return evt.username || '-';
        case 'parent':
          return evt.parent_process_name || '-';
        case 'command':
          return (
            <span className={`mono ${styles.cmdInline}`} title={evt.command_line}>
              {truncate(evt.command_line, 35)}
            </span>
          );
        case 'actions':
          return (
            <span className={styles.actionsInline} onClick={(e) => e.stopPropagation()}>
              <button type="button" className={styles.quickBtn} onClick={() => navigate(`/normalized-events/${evt.id}`)}>
                Details
              </button>
              <Link to={`/endpoints/${evt.endpoint_id}/process-tree`} className={styles.quickBtn}>
                Tree
              </Link>
              <Link to={`/endpoints/${evt.endpoint_id}`} className={styles.quickBtn}>
                Endpoint
              </Link>
            </span>
          );
        default:
          return null;
      }
    },
    [navigate]
  );

  if (loading && events.length === 0) {
    return <PageShell loading loadingLabel="Loading events…" />;
  }

  return (
    <PageShell
      kicker="Explore"
      title="Events"
      description="Normalized endpoint telemetry — process, network, file, and auth activity."
      actions={
        <>
          <Link to="/raw-events" className="falcon-btn falcon-btn-ghost">
            Raw events
          </Link>
          <button type="button" onClick={fetchData} className="falcon-btn falcon-btn-ghost">
            ↻ Refresh
          </button>
        </>
      }
    >
      <div className={styles.container}>

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

      <div className={`${styles.filters} falcon-filter-bar`}>
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

      <div className={styles.colToolbar} role="group" aria-label="Column visibility">
        <span className={styles.colToolbarLabel}>Columns</span>
        {EVENT_COLS.map((c) => (
          <label key={c.key} className={styles.colToggle}>
            <input type="checkbox" checked={visible[c.key]} onChange={() => toggle(c.key)} />
            {c.label}
          </label>
        ))}
        <button type="button" className="falcon-btn falcon-btn-ghost" onClick={reset}>
          Reset layout
        </button>
      </div>

      <div className={styles.tableWrap}>
        {events.length > 0 && (
          <>
            <div className={styles.eventGridHead} style={{ gridTemplateColumns: gridTpl }}>
              {activeCols.map((c) => (
                <div key={c.key} className={styles.eventGridTh}>
                  {c.label}
                </div>
              ))}
            </div>
            <VirtualizedScrollList
              count={events.length}
              estimateSize={58}
              className={styles.eventVirtualScroll}
              rowRender={(i) => {
                const evt = events[i];
                return (
                  <div
                    key={evt.id}
                    className={`${styles.eventGridRow} ${styles.eventRow}`}
                    style={{ gridTemplateColumns: gridTpl }}
                    onClick={() => navigate(`/normalized-events/${evt.id}`)}
                  >
                    {activeCols.map((c) => (
                      <div
                        key={c.key}
                        className={`${styles.eventGridTd} ${c.key === 'source' ? styles.sourceCell : ''} ${
                          c.key === 'process' ? styles.processCell : ''
                        } ${c.key === 'parent' ? styles.parentCell : ''}`}
                        onClick={c.key === 'actions' ? (e) => e.stopPropagation() : undefined}
                      >
                        {renderEventCell(evt, c.key)}
                      </div>
                    ))}
                  </div>
                );
              }}
            />
          </>
        )}
        {events.length === 0 && (
          <FalconEmptyState
            title="No events match your filters"
            description="Try clearing hostname, type, or date filters, or increase the row limit."
          />
        )}
      </div>

      <FalconPagination
        offset={filters.offset}
        limit={filters.limit}
        total={total}
        pageItemCount={events.length}
        onPrev={() => setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - f.limit) }))}
        onNext={() => setFilters((f) => ({ ...f, offset: f.offset + f.limit }))}
        onLimitChange={(newLimit) => setFilters((f) => ({ ...f, limit: newLimit, offset: 0 }))}
        pageSizeOptions={[25, 50, 100]}
      />
      </div>
    </PageShell>
  );
}
