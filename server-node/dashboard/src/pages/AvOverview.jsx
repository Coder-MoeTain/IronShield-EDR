import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import { falconSeverityClass } from '../utils/falconUi';
import styles from './AvOverview.module.css';

export default function AvOverview() {
  const { api } = useAuth();
  const [summary, setSummary] = useState(null);
  const [detections, setDetections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [endpoints, setEndpoints] = useState([]);
  const [runScanOpen, setRunScanOpen] = useState(false);
  const [runScanEndpoint, setRunScanEndpoint] = useState('');
  const [runScanTarget, setRunScanTarget] = useState('');
  const [runScanCreating, setRunScanCreating] = useState(false);
  const [runScanMsg, setRunScanMsg] = useState('');

  const [apiError, setApiError] = useState(null);

  const load = async () => {
    setLoading(true);
    setApiError(null);
    try {
      const [sumRes, detRes] = await Promise.all([
        api('/api/admin/av/dashboard/summary'),
        api('/api/admin/av/detections?limit=10'),
      ]);
      if (!sumRes.ok || !detRes.ok) {
        const failed = !sumRes.ok ? sumRes : detRes;
        const err = await failed.json().catch(() => ({}));
        throw new Error(err.error || `API error (${failed.status})`);
      }
      const sumData = await sumRes.json();
      const detData = await detRes.json();
      setSummary(sumData);
      setDetections(Array.isArray(detData) ? detData : (detData.results || []));
    } catch (e) {
      setSummary(null);
      setDetections([]);
      setApiError(e.message || 'Failed to load. Ensure backend is running: cd server-node && npm start');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [api]);

  useEffect(() => {
    if (runScanOpen) {
      api('/api/admin/endpoints')
        .then((r) => r.json())
        .then((d) => setEndpoints(Array.isArray(d) ? d : (d.endpoints || [])))
        .catch(() => setEndpoints([]));
    }
  }, [runScanOpen, api]);

  const runScan = async () => {
    if (!runScanEndpoint) {
      setRunScanMsg('Select an endpoint');
      return;
    }
    setRunScanCreating(true);
    setRunScanMsg('');
    try {
      await api('/api/admin/av/scan-task', {
        method: 'POST',
        body: JSON.stringify({
          endpointId: parseInt(runScanEndpoint),
          target_path: runScanTarget.trim() || null,
        }),
      });
      setRunScanMsg('Scan task created. Agent will pick it up shortly.');
      setRunScanEndpoint('');
      setRunScanTarget('');
      load();
      setTimeout(() => { setRunScanOpen(false); setRunScanMsg(''); }, 2000);
    } catch (e) {
      setRunScanMsg(e.message || 'Failed to create scan task');
    } finally {
      setRunScanCreating(false);
    }
  };

  if (loading && !summary) {
    return <PageShell loading loadingLabel="Loading antivirus overview…" />;
  }

  if (apiError) {
    return (
      <PageShell kicker="Antivirus" title="Antivirus overview" description="Summary of detections, quarantine, and scan activity.">
        <div className={styles.container}>
          <div className={styles.apiError}>
            <p>{apiError}</p>
            <button type="button" className="falcon-btn falcon-btn-primary" onClick={load}>Retry</button>
          </div>
        </div>
      </PageShell>
    );
  }

  const hasData = (summary?.total_detections ?? 0) > 0 || (summary?.quarantined_count ?? 0) > 0;

  return (
    <PageShell
      kicker="Antivirus"
      title="Antivirus overview"
      description="Detections, quarantine volume, pending scans, and recent activity."
      actions={(
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
          <button type="button" className="falcon-btn falcon-btn-primary" onClick={() => setRunScanOpen(true)}>
            Run scan
          </button>
          <button type="button" className="falcon-btn falcon-btn-ghost" onClick={load} disabled={loading}>
            {loading ? '…' : 'Refresh'}
          </button>
        </div>
      )}
    >
    <div className={styles.container}>
      {!hasData && (
        <div className={styles.emptyBanner}>
          <p>{summary ? 'No malware detections yet. Add test data to preview the UI, or run a scan on an endpoint.' : ''}</p>
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              className={styles.runScanBtn}
              onClick={async () => {
                setRunScanMsg('');
                try {
                  const r = await api('/api/admin/av/seed-test-data', { method: 'POST' });
                  const d = await r.json().catch(() => ({}));
                  if (r.ok) {
                    setRunScanMsg('Test data added');
                    load();
                    setTimeout(() => setRunScanMsg(''), 3000);
                  } else {
                    setRunScanMsg(d.error || 'Failed');
                  }
                } catch (e) {
                  setRunScanMsg(e.message || 'Failed');
                }
              }}
            >
              Add test data
            </button>
            <button className={styles.refreshBtn} onClick={() => setRunScanOpen(true)}>Run Scan</button>
            {runScanMsg && <span className={runScanMsg.includes('added') ? styles.msgOk : styles.msgErr}>{runScanMsg}</span>}
          </div>
        </div>
      )}

      {runScanOpen && (
        <div className={styles.modalOverlay} onClick={() => !runScanCreating && setRunScanOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Run Antivirus Scan</h3>
            <p className={styles.modalHint}>Create a scan task. The agent will pick it up on its next poll.</p>
            <div className={styles.modalForm}>
              <label>
                Endpoint
                <select value={runScanEndpoint} onChange={(e) => setRunScanEndpoint(e.target.value)} className={styles.select}>
                  <option value="">Select endpoint…</option>
                  {endpoints.map((e) => (
                    <option key={e.id} value={e.id}>{e.hostname || e.id}</option>
                  ))}
                </select>
              </label>
              <label>
                Target path (optional)
                <input
                  type="text"
                  value={runScanTarget}
                  onChange={(e) => setRunScanTarget(e.target.value)}
                  placeholder="C:\Users\...\Downloads"
                  className={styles.input}
                />
              </label>
            </div>
            {runScanMsg && <p className={runScanMsg.includes('created') ? styles.msgOk : styles.msgErr}>{runScanMsg}</p>}
            <div className={styles.modalActions}>
              <button onClick={runScan} disabled={runScanCreating} className={styles.runScanBtn}>
                {runScanCreating ? 'Creating…' : 'Create Scan Task'}
              </button>
              <button onClick={() => setRunScanOpen(false)} disabled={runScanCreating} className={styles.cancelBtn}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className={styles.statsBar}>
        <Link to="/av/detections" className={styles.statCard}>
          <span className={`${styles.statValue} ${styles.statCritical}`}>
            {summary?.detections_today ?? 0}
          </span>
          <span className={styles.statLabel}>Detections Today</span>
        </Link>
        <Link to="/av/quarantine" className={styles.statCard}>
          <span className={`${styles.statValue} ${styles.statAmber}`}>
            {summary?.quarantined_count ?? 0}
          </span>
          <span className={styles.statLabel}>Quarantined</span>
        </Link>
        <Link to="/av/detections" className={styles.statCard}>
          <span className={styles.statValue}>{summary?.total_detections ?? 0}</span>
          <span className={styles.statLabel}>Total Detections</span>
        </Link>
        <Link to="/endpoints" className={styles.statCard}>
          <span className={`${styles.statValue} ${summary?.infected_endpoints ? styles.statCritical : ''}`}>
            {summary?.infected_endpoints ?? 0}
          </span>
          <span className={styles.statLabel}>Infected Endpoints (7d)</span>
        </Link>
        <Link to="/av/scan-tasks" className={styles.statCard}>
          <span className={`${styles.statValue} ${styles.statBlue}`}>
            {summary?.pending_tasks ?? 0}
          </span>
          <span className={styles.statLabel}>Pending Tasks</span>
        </Link>
        <Link to="/av/malware-alerts" className={styles.statCard}>
          <span className={`${styles.statValue} ${summary?.pending_review ? styles.statAmber : ''}`}>
            {summary?.pending_review ?? 0}
          </span>
          <span className={styles.statLabel}>Pending Review</span>
        </Link>
      </div>

      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Recent Detections</h2>
          <Link to="/av/detections" className={styles.link}>View all</Link>
        </div>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Time</th>
                <th>Endpoint</th>
                <th>File</th>
                <th>Detection</th>
                <th>Severity</th>
              </tr>
            </thead>
            <tbody>
              {detections.length === 0 ? (
                <tr><td colSpan={5} className={styles.empty}>No detections. Run a scan from the button above.</td></tr>
              ) : (
                detections.map((d) => (
                  <tr key={d.id}>
                    <td>{d.scan_time ? new Date(d.scan_time).toLocaleString() : '-'}</td>
                    <td>
                      {d.endpoint_id ? (
                        <Link to={`/endpoints/${d.endpoint_id}`}>{d.hostname || d.endpoint_id}</Link>
                      ) : (
                        d.hostname || d.endpoint_id || '-'
                      )}
                    </td>
                    <td>
                      <Link to={`/av/detections/${d.id}`} className={styles.link}>
                        {d.file_name || d.file_path || '-'}
                      </Link>
                    </td>
                    <td>{d.detection_name || '-'}</td>
                    <td>
                      <span className={falconSeverityClass(d.severity)}>
                        {d.severity || 'medium'}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className={styles.quickLinks}>
        <Link to="/av/detections" className={styles.quickLink}>Detections</Link>
        <Link to="/av/quarantine" className={styles.quickLink}>Quarantine</Link>
        <Link to="/av/malware-alerts" className={styles.quickLink}>Malware Alerts</Link>
        <Link to="/av/scan-tasks" className={styles.quickLink}>Scan Tasks</Link>
        <Link to="/av/policies" className={styles.quickLink}>Policies</Link>
        <Link to="/av/signatures" className={styles.quickLink}>Signatures</Link>
        <Link to="/av/reputation" className={styles.quickLink}>File Reputation</Link>
      </div>
    </div>
    </PageShell>
  );
}
