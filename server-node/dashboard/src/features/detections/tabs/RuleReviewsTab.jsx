import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import LoadingState from '../../../components/LoadingState';

export default function RuleReviewsTab() {
  const { api } = useAuth();
  const [rules, setRules] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api('/api/v1/detections/rules')
      .then((r) => (r.ok ? r.json() : { rules: [] }))
      .then((d) => setRules((d.rules || []).filter((r) => r.status === 'experimental' || r.status === 'test')))
      .finally(() => setLoading(false));
  }, [api]);

  if (loading) return <LoadingState label="Rule reviews" />;

  return (
    <section>
      <p className="muted">Rules pending review or in test status. Stable changes require approver separation of duties.</p>
      <table className="falcon-table">
        <thead>
          <tr>
            <th>Rule</th>
            <th>Status</th>
            <th>Version</th>
            <th>Severity</th>
          </tr>
        </thead>
        <tbody>
          {rules.map((r) => (
            <tr key={r.id}>
              <td>{r.name}<br /><code>{r.id}</code></td>
              <td>{r.status}</td>
              <td>{r.version}</td>
              <td>{r.severity}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
