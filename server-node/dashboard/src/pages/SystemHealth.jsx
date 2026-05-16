import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';

export default function SystemHealth() {
  const { api } = useAuth();
  const [health, setHealth] = useState(null);

  useEffect(() => {
    api('/api/admin/system/health')
      .then((r) => r.json())
      .then(setHealth)
      .catch(() => setHealth(null));
  }, [api]);

  return (
    <PageShell title="System Health" kicker="Operations">
      {!health ? (
        <p>Loading…</p>
      ) : (
        <div className="health-grid" style={{ display: 'grid', gap: '1rem' }}>
          <div className="card">
            <h3>API</h3>
            <p>{health.api}</p>
          </div>
          <div className="card">
            <h3>Readiness</h3>
            <pre>{JSON.stringify(health.readiness, null, 2)}</pre>
          </div>
          <div className="card">
            <h3>Queue</h3>
            <pre>{JSON.stringify(health.queue, null, 2)}</pre>
          </div>
          <div className="card">
            <h3>Endpoints</h3>
            <p>
              Online {health.endpoints?.online ?? 0} / {health.endpoints?.total ?? 0}
            </p>
          </div>
          <div className="card">
            <h3>Timestamp</h3>
            <p>{health.timestamp}</p>
          </div>
        </div>
      )}
    </PageShell>
  );
}
