import React, { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';

export default function HostTimeline() {
  const { endpointId: routeId } = useParams();
  const [searchParams] = useSearchParams();
  const { api } = useAuth();
  const endpointId = routeId || searchParams.get('endpointId');
  const [events, setEvents] = useState([]);
  const [hostname, setHostname] = useState('');

  useEffect(() => {
    if (!endpointId) return;
    api(`/api/admin/endpoints/${endpointId}`)
      .then((r) => r.json())
      .then((ep) => setHostname(ep?.hostname || `Endpoint ${endpointId}`))
      .catch(() => setHostname(`Endpoint ${endpointId}`));

    api(`/api/admin/endpoints/${endpointId}/process-timeline?hours=24&limit=200`)
      .then((r) => r.json())
      .then((data) => setEvents(Array.isArray(data) ? data : data?.events || []))
      .catch(() => setEvents([]));
  }, [api, endpointId]);

  if (!endpointId) {
    return (
      <PageShell title="Host timeline" kicker="Investigate">
        <p>Select an endpoint from <Link to="/endpoints">Endpoints</Link>.</p>
      </PageShell>
    );
  }

  return (
    <PageShell title={`Timeline — ${hostname}`} kicker="Investigate">
      <p className="muted">Process and telemetry timeline (last 24h).</p>
      <div className="table-wrap">
        <table className="data-table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Process</th>
              <th>Parent</th>
              <th>Command line</th>
            </tr>
          </thead>
          <tbody>
            {events.length === 0 ? (
              <tr>
                <td colSpan={4}>No timeline events.</td>
              </tr>
            ) : (
              events.map((e, i) => (
                <tr key={e.id || i}>
                  <td>{e.timestamp ? new Date(e.timestamp).toLocaleString() : '—'}</td>
                  <td>{e.process_name || '—'}</td>
                  <td>{e.parent_process_name || '—'}</td>
                  <td className="mono" style={{ maxWidth: 420, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {e.command_line || e.powershell_command || '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </PageShell>
  );
}
