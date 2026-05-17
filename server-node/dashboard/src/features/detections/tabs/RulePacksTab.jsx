import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import FalconTableShell from '../../../components/FalconTableShell';
import FalconEmptyState from '../../../components/FalconEmptyState';
import LoadingState from '../../../components/LoadingState';
import ErrorState from '../../../components/ErrorState';

export default function RulePacksTab() {
  const { api } = useAuth();
  const [packs, setPacks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = () => {
    setLoading(true);
    api('/api/v1/detections/rule-packs')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed to load packs'))))
      .then((d) => setPacks(d.packs || []))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [api]);

  const toggle = async (packId, enabled) => {
    await api(`/api/v1/detections/rule-packs/${packId}/enable`, {
      method: 'POST',
      body: JSON.stringify({ enabled }),
    });
    load();
  };

  if (loading) return <LoadingState label="Rule packs" />;
  if (error) return <ErrorState message={error} onRetry={load} />;

  return (
    <FalconTableShell>
      {packs.length === 0 ? (
        <FalconEmptyState title="No rule packs" message="Sync detection packs from server-node/detections/packs." />
      ) : (
        <table className="falcon-table">
          <thead>
            <tr>
              <th>Pack</th>
              <th>Platform</th>
              <th>Rules</th>
              <th>Version</th>
              <th>Default</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {packs.map((p) => (
              <tr key={p.id}>
                <td>
                  <strong>{p.name}</strong>
                  <div className="muted">{p.description}</div>
                </td>
                <td>{p.platform}</td>
                <td>{(p.pack_json?.rules || p.rules_detail || []).length}</td>
                <td>{p.version}</td>
                <td>{p.enabled_by_default ? 'Yes' : 'No'}</td>
                <td>
                  <button type="button" className="btn-link" onClick={() => toggle(p.id, true)}>
                    Enable
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </FalconTableShell>
  );
}
