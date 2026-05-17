import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import LoadingState from '../../../components/LoadingState';
import ErrorState from '../../../components/ErrorState';

export default function DataSourceCoverageTab() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api('/api/v1/detections/data-source-coverage')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed'))))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [api]);

  if (loading) return <LoadingState label="Data source coverage" />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  const sources = data?.data_sources || [];

  return (
    <div className="console-ds-coverage">
      <p className="muted">Telemetry source availability and rules depending on each data source.</p>
      <table className="falcon-table">
        <thead>
          <tr>
            <th>Data source</th>
            <th>Endpoints reporting</th>
            <th>Rules depending</th>
          </tr>
        </thead>
        <tbody>
          {sources.map((s) => (
            <tr key={s.data_source}>
              <td><code>{s.data_source}</code></td>
              <td>{s.endpoints_reporting} / {s.endpoints_total || '—'}</td>
              <td>{s.rule_count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
