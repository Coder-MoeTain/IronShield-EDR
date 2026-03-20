import React, { useEffect, useState } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './RawEvents.module.css';

export default function RawEvents() {
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

    api(`/api/admin/events?${params}`)
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
      limit: 50,
      offset: 0,
    });
  };

  const nextPage = () => setFilters((f) => ({ ...f, offset: f.offset + f.limit }));
  const prevPage = () => setFilters((f) => ({ ...f, offset: Math.max(0, f.offset - f.limit) }));

  if (loading && events.length === 0) return <div className={styles.loading}>Loading...</div>;

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Link to="/events" className={styles.back}>← Back to Events</Link>
        <h1 className={styles.title}>Raw Events</h1>
      </div>
      <form onSubmit={handleFilter} className={styles.filters}>
        <input name="hostname" placeholder="Hostname" defaultValue={filters.hostname} />
        <input name="eventType" placeholder="Event type" defaultValue={filters.eventType} />
        <input name="endpointId" placeholder="Endpoint ID" defaultValue={filters.endpointId} />
        <input name="username" placeholder="Username" defaultValue={filters.username} />
        <input name="processName" placeholder="Process name" defaultValue={filters.processName} />
        <input name="dateFrom" type="date" placeholder="From" defaultValue={filters.dateFrom} />
        <input name="dateTo" type="date" placeholder="To" defaultValue={filters.dateTo} />
        <button type="submit">Filter</button>
      </form>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Time</th>
              <th>Hostname</th>
              <th>Type</th>
              <th>Source</th>
              <th>Process</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {events.map((evt) => (
              <tr key={evt.id}>
                <td className="mono">{new Date(evt.timestamp).toLocaleString()}</td>
                <td>{evt.hostname || evt.endpoint_hostname || '-'}</td>
                <td><span className={styles.type}>{evt.event_type || '-'}</span></td>
                <td>{evt.event_source || '-'}</td>
                <td className={styles.process}>
                  {(() => {
                    const r = evt.raw_event_json;
                    if (!r) return '-';
                    const obj = typeof r === 'string' ? (() => { try { return JSON.parse(r); } catch { return {}; } })() : r;
                    return obj.process_name || obj.ProcessName || '-';
                  })()}
                </td>
                <td>
                  <Link to={`/raw-events/${evt.id}`} className={styles.viewLink}>Details</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {events.length === 0 && <p className={styles.empty}>No events found.</p>}
      </div>
      <div className={styles.pagination}>
        <button onClick={prevPage} disabled={filters.offset === 0}>Previous</button>
        <span>
          {filters.offset + 1}-{Math.min(filters.offset + filters.limit, total)} of {total}
        </span>
        <button onClick={nextPage} disabled={filters.offset + filters.limit >= total}>Next</button>
      </div>
    </div>
  );
}
