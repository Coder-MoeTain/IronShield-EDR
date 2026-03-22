import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconTableShell from '../components/FalconTableShell';
import FalconEmptyState from '../components/FalconEmptyState';
import FalconPagination from '../components/FalconPagination';
import styles from './Events.module.css';

export default function NormalizedEvents() {
  const [searchParams] = useSearchParams();
  const { api } = useAuth();
  const [events, setEvents] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    hostname: searchParams.get('hostname') || '',
    eventType: searchParams.get('eventType') || '',
    endpointId: searchParams.get('endpointId') || '',
    username: searchParams.get('username') || '',
    processName: searchParams.get('processName') || '',
    dateFrom: searchParams.get('dateFrom') || '',
    dateTo: searchParams.get('dateTo') || '',
    limit: 50,
    offset: 0,
  });

  useEffect(() => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => v && params.set(k, v));

    api(`/api/admin/normalized-events?${params}`)
      .then((r) => r.json())
      .then((data) => {
        setEvents(data.events || []);
        setTotal(data.total ?? 0);
      })
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [filters]);

  const handleFilter = (e) => {
    e.preventDefault();
    const form = e.target;
    setFilters({
      hostname: form.hostname?.value || '',
      eventType: form.eventType?.value || '',
      endpointId: form.endpointId?.value || '',
      username: form.username?.value || '',
      processName: form.processName?.value || '',
      dateFrom: form.dateFrom?.value || '',
      dateTo: form.dateTo?.value || '',
      limit: filters.limit,
      offset: 0,
    });
  };

  if (loading && events.length === 0) return <PageShell loading loadingLabel="Loading events…" />;

  const filterForm = (
    <form onSubmit={handleFilter} className={`${styles.filters} falcon-filter-bar`}>
      <input name="hostname" placeholder="Hostname" defaultValue={filters.hostname} />
      <input name="eventType" placeholder="Event type" defaultValue={filters.eventType} />
      <input name="endpointId" placeholder="Endpoint ID" defaultValue={filters.endpointId} />
      <input name="username" placeholder="Username" defaultValue={filters.username} />
      <input name="processName" placeholder="Process name" defaultValue={filters.processName} />
      <input name="dateFrom" type="date" placeholder="From" defaultValue={filters.dateFrom} />
      <input name="dateTo" type="date" placeholder="To" defaultValue={filters.dateTo} />
      <button type="submit" className="falcon-btn falcon-btn-primary">
        Filter
      </button>
    </form>
  );

  return (
    <PageShell
      kicker="Explore"
      title="Normalized events"
      description="Filter normalized telemetry (alternate view to the main Events explorer)."
    >
      <FalconTableShell
        toolbar={filterForm}
        footer={(
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
        )}
      >
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Hostname</th>
                <th>Type</th>
                <th>Process</th>
                <th>User</th>
                <th>Parent</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {events.map((evt) => (
                <tr key={evt.id}>
                  <td className="mono">{new Date(evt.timestamp).toLocaleString()}</td>
                  <td>{evt.hostname || evt.endpoint_hostname || '-'}</td>
                  <td><span className={styles.type}>{evt.event_type || '-'}</span></td>
                  <td className={styles.process}>{evt.process_name || '-'}</td>
                  <td>{evt.username || '-'}</td>
                  <td>{evt.parent_process_name || '-'}</td>
                  <td>
                    <Link to={`/normalized-events/${evt.id}`} className={styles.viewLink}>Details</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {events.length === 0 && (
            <FalconEmptyState
              title="No normalized events found"
              description="Try clearing hostname or type filters, or check the main Events page for the same query."
            />
          )}
        </div>
      </FalconTableShell>
    </PageShell>
  );
}
