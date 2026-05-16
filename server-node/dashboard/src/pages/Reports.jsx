import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';

export default function Reports() {
  const { api } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [reportType, setReportType] = useState('daily_soc_summary');
  const [format, setFormat] = useState('json');

  const load = () =>
    api('/api/admin/reports')
      .then((r) => r.json())
      .then((d) => setJobs(Array.isArray(d) ? d : []))
      .catch(() => setJobs([]));

  useEffect(() => {
    load();
  }, [api]);

  const generate = async () => {
    await api('/api/admin/reports', {
      method: 'POST',
      body: JSON.stringify({ report_type: reportType, format }),
    });
    load();
  };

  return (
    <PageShell title="Reports" kicker="Compliance">
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
          <option value="daily_soc_summary">Daily SOC summary</option>
          <option value="mitre_coverage">MITRE coverage</option>
          <option value="endpoint_health">Endpoint health</option>
        </select>
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="json">JSON</option>
          <option value="html">HTML</option>
        </select>
        <button type="button" className="falcon-btn falcon-btn-primary" onClick={generate}>
          Generate
        </button>
      </div>
      <table className="data-table">
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Status</th>
            <th>Created</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {jobs.map((j) => (
            <tr key={j.id}>
              <td>{j.id}</td>
              <td>{j.report_type}</td>
              <td>{j.status}</td>
              <td>{j.created_at ? new Date(j.created_at).toLocaleString() : '—'}</td>
              <td>
                {j.status === 'completed' && (
                  <a href={`/api/admin/reports/${j.id}/download`} className="falcon-btn falcon-btn-ghost">
                    Download
                  </a>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </PageShell>
  );
}
