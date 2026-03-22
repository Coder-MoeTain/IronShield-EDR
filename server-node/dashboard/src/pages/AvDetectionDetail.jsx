import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import { falconSeverityClass } from '../utils/falconUi';
import styles from './AvOverview.module.css';

export default function AvDetectionDetail() {
  const { id } = useParams();
  const { api } = useAuth();
  const [detection, setDetection] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api(`/api/admin/av/detections/${id}`)
      .then((r) => r.json())
      .then(setDetection)
      .catch(() => setDetection(null))
      .finally(() => setLoading(false));
  }, [id, api]);

  if (loading) return <PageShell loading loadingLabel="Loading detection…" />;
  if (!detection) {
    return (
      <PageShell kicker="Antivirus" title="Detection not found" description="This detection may have been removed or the ID is invalid.">
        <div className={styles.error}>Detection not found</div>
      </PageShell>
    );
  }

  const rawDetails = typeof detection.raw_details_json === 'string'
    ? (() => { try { return JSON.parse(detection.raw_details_json); } catch { return null; } })()
    : detection.raw_details_json;

  return (
    <PageShell
      kicker="Malware detection"
      title={detection.detection_name || 'Detection'}
      description={detection.file_path || detection.file_name || 'File-based threat finding.'}
      actions={(
        <>
          <Link to="/av/detections" className="falcon-btn falcon-btn-ghost">← Detections</Link>
          <span className={falconSeverityClass(detection.severity)}>{detection.severity || '—'}</span>
          {detection.detection_type && <span className="falcon-sev falcon-sev-info">{detection.detection_type}</span>}
        </>
      )}
    >
      <div className={styles.container}>
        <div className={styles.grid}>
          <div className={styles.card}>
            <h3>File</h3>
            <dl>
              <dt>Path</dt>
              <dd className={styles.mono} style={{ wordBreak: 'break-all' }}>{detection.file_path || '-'}</dd>
              <dt>Name</dt>
              <dd className={styles.mono}>{detection.file_name || '-'}</dd>
              <dt>SHA256</dt>
              <dd className={styles.mono} title={detection.sha256}>{detection.sha256 || '-'}</dd>
              <dt>Size</dt>
              <dd>{detection.file_size != null ? `${(detection.file_size / 1024).toFixed(1)} KB` : '-'}</dd>
              <dt>Signer</dt>
              <dd>{detection.signer_status || '-'}</dd>
            </dl>
          </div>
          <div className={styles.card}>
            <h3>Detection</h3>
            <dl>
              <dt>Endpoint</dt>
              <dd><Link to={`/endpoints/${detection.endpoint_id}`}>{detection.hostname || detection.endpoint_id}</Link></dd>
              <dt>Family</dt>
              <dd>{detection.family || '-'}</dd>
              <dt>Disposition</dt>
              <dd>{detection.disposition || '-'}</dd>
              <dt>Score</dt>
              <dd>{detection.score ?? '-'}</dd>
              <dt>Scan time</dt>
              <dd>{detection.scan_time ? new Date(detection.scan_time).toLocaleString() : '-'}</dd>
            </dl>
          </div>
        </div>
        {rawDetails && Object.keys(rawDetails).length > 0 && (
          <div className={styles.card} style={{ marginTop: '1rem' }}>
            <h3>Detection details</h3>
            <pre className={styles.pre}>{JSON.stringify(rawDetails, null, 2)}</pre>
            {rawDetails.heuristic_rules && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>Heuristic rules matched</h4>
                <ul style={{ margin: 0, paddingLeft: '1.25rem' }}>
                  {rawDetails.heuristic_rules.map((r, i) => (
                    <li key={i}><code>{r.name}</code> +{r.score}</li>
                  ))}
                </ul>
              </div>
            )}
            {rawDetails.pe_sections && rawDetails.pe_sections.length > 0 && (
              <div style={{ marginTop: '1rem' }}>
                <h4 style={{ fontSize: '0.85rem', marginBottom: '0.5rem' }}>PE sections</h4>
                <span className={styles.mono}>{rawDetails.pe_sections.join(', ')}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </PageShell>
  );
}
