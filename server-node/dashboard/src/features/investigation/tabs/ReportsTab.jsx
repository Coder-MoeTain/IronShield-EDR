import React, { useEffect, useState } from 'react';
import { useAuth } from '../../../context/AuthContext';
import PageShell from '../../../components/PageShell';
import { readApiJson } from '../../../utils/apiEnvelope';

const PLATFORM_TYPES = [
  { id: 'daily_soc_summary', label: 'Daily SOC summary' },
  { id: 'weekly_security_posture', label: 'Weekly security posture' },
  { id: 'endpoint_health', label: 'Endpoint health' },
  { id: 'incident_report', label: 'Incident report' },
  { id: 'alert_trend', label: 'Alert trend' },
  { id: 'mitre_coverage', label: 'MITRE coverage' },
  { id: 'audit_activity', label: 'Audit activity' },
  { id: 'tenant_executive', label: 'Tenant executive' },
];

const SOFTWARE_TYPES = [
  { id: 'vulnerable', label: 'Vulnerable software' },
  { id: 'critical-risk', label: 'Critical software risk' },
  { id: 'endpoint-inventory', label: 'Endpoint software inventory' },
  { id: 'blocked', label: 'Blocked software' },
  { id: 'remediation-status', label: 'Remediation status' },
  { id: 'accepted-risk', label: 'Accepted risk' },
];

export default function Reports() {
  const { api } = useAuth();
  const [jobs, setJobs] = useState([]);
  const [reportType, setReportType] = useState('daily_soc_summary');
  const [format, setFormat] = useState('json');
  const [category, setCategory] = useState('platform');

  const load = async () => {
    try {
      const res = await api('/api/admin/reports');
      if (!res.ok) return setJobs([]);
      const { data } = await readApiJson(res);
      setJobs(Array.isArray(data) ? data : data?.jobs || []);
    } catch {
      setJobs([]);
    }
  };

  useEffect(() => {
    load();
  }, [api]);

  const generate = async () => {
    const type = reportType;
    if (SOFTWARE_TYPES.some((s) => s.id === type)) {
      const res = await api(`/api/software/reports/${type}?format=${format}`);
      if (res.ok && format === 'json') {
        const { data } = await readApiJson(res);
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = `software-${type}.json`;
        a.click();
      } else if (res.ok) {
        window.open(`/api/software/reports/${type}?format=${format}`, '_blank');
      }
      return;
    }
    await api('/api/admin/reports', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ report_type: type, format }),
    });
    load();
  };

  const types = category === 'software' ? SOFTWARE_TYPES : PLATFORM_TYPES;

  return (
    <PageShell title="Reports" kicker="Compliance">
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1rem', flexWrap: 'wrap' }}>
        <select value={category} onChange={(e) => { setCategory(e.target.value); setReportType(e.target.value === 'software' ? 'vulnerable' : 'daily_soc_summary'); }}>
          <option value="platform">Platform SOC</option>
          <option value="software">Software risk</option>
        </select>
        <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
          {types.map((t) => (
            <option key={t.id} value={t.id}>{t.label}</option>
          ))}
        </select>
        <select value={format} onChange={(e) => setFormat(e.target.value)}>
          <option value="json">JSON</option>
          <option value="html">HTML</option>
          <option value="pdf">PDF (HTML)</option>
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
