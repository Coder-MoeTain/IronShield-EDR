import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { apiPath } from '../../../utils/apiPath';
import DataTable from '../../../components/DataTable';
import KpiStrip from '../../../components/KpiStrip';
import LoadingState from '../../../components/LoadingState';
import ErrorState from '../../../components/ErrorState';

export default function DetectionQualityTab() {
  const { api } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api(apiPath('/api/admin/analytics/detection-quality'))
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error('Failed'))))
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [api]);

  if (loading) return <LoadingState label="Detection quality metrics" />;
  if (error) return <ErrorState message={error} onRetry={() => window.location.reload()} />;

  const kpis = data?.kpis || {};
  return (
    <div className="console-quality-tab">
      <KpiStrip
        items={[
          { id: 'fb', label: 'Analyst feedback', value: kpis.total_feedback },
          { id: 'tp', label: 'True positive', value: kpis.true_positive, tone: 'ok' },
          { id: 'fp', label: 'False positive', value: kpis.false_positive, tone: 'warn' },
          { id: 'conf', label: 'Avg confidence', value: kpis.avg_analyst_confidence },
        ]}
      />
      <DataTable>
        <h3>Noisy rules (high FP rate)</h3>
        <table className="ui-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>FP count</th>
              <th>Feedback</th>
              <th>FP rate</th>
            </tr>
          </thead>
          <tbody>
            {(data?.noisy_rules || []).map((r) => (
              <tr key={r.rule_id}>
                <td>{r.rule_name}</td>
                <td>{r.fp_count}</td>
                <td>{r.total_feedback}</td>
                <td>{r.fp_rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <h3 style={{ marginTop: '1.5rem' }}>High-signal rules</h3>
        <table className="ui-table">
          <thead>
            <tr>
              <th>Rule</th>
              <th>TP count</th>
              <th>TP rate</th>
            </tr>
          </thead>
          <tbody>
            {(data?.high_signal_rules || []).map((r) => (
              <tr key={r.rule_id}>
                <td>{r.rule_name}</td>
                <td>{r.tp_count}</td>
                <td>{r.tp_rate}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </DataTable>
      <p className="ui-muted" style={{ marginTop: '1rem' }}>
        Rules without MITRE mapping and detection test coverage are flagged in CI via{' '}
        <code>npm run detections:validate</code> and <code>npm run detections:test</code>.
      </p>
    </div>
  );
}
