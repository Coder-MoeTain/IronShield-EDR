import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import PageShell from '../../../components/PageShell';

export default function MitreCoverage() {
  const { api } = useAuth();
  const [data, setData] = useState(null);

  useEffect(() => {
    api('/api/admin/mitre/coverage')
      .then((r) => r.json())
      .then(setData)
      .catch(() => setData(null));
  }, [api]);

  if (!data) {
    return <PageShell title="MITRE ATT&CK Coverage" loading loadingLabel="Loading coverage…" />;
  }

  return (
    <PageShell title="MITRE ATT&CK Coverage" kicker="Detections">
      <p>
        Coverage: <strong>{data.summary?.coverage_pct ?? 0}%</strong> tactics ·{' '}
        <strong>{data.summary?.total_techniques ?? 0}</strong> techniques mapped
      </p>
      <div className="mitre-matrix">
        {(data.tactics || []).map((t) => (
          <section key={t.tactic} style={{ marginBottom: '1.5rem' }}>
            <h3>{t.tactic}</h3>
            {t.techniques?.length === 0 ? (
              <p className="muted">No rules mapped</p>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Technique</th>
                    <th>Rules</th>
                    <th>Alerts</th>
                  </tr>
                </thead>
                <tbody>
                  {t.techniques.map((x) => (
                    <tr key={x.technique}>
                      <td>{x.technique}</td>
                      <td>{x.rule_count}</td>
                      <td>{x.alert_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </section>
        ))}
      </div>
    </PageShell>
  );
}
