import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './AvOverview.module.css';

export default function AvFileReputation() {
  const { api } = useAuth();
  const [sha256, setSha256] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const search = async () => {
    const hash = sha256.trim().replace(/\s/g, '');
    if (!hash || hash.length < 32) {
      setError('Enter a valid SHA256 hash (64 hex chars)');
      return;
    }
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const r = await api(`/api/admin/av/reputation?sha256=${encodeURIComponent(hash)}`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(d.error || `API error (${r.status})`);
      }
      const data = await r.json();
      setResult(data);
    } catch (e) {
      setError(e.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const repClass = (r) => {
    if (r === 'malicious') return styles.critical;
    if (r === 'suspicious') return styles.statAmber;
    return styles.low;
  };

  return (
    <PageShell
      kicker="Antivirus"
      title="File reputation"
      description="Look up verdict and prevalence for a file hash known to the platform."
    >
      <div className={styles.container}>

      <div className={styles.section}>
        <div className={styles.sectionHeader}>
          <h2>Lookup by SHA256</h2>
        </div>
        <div className={styles.modalForm} style={{ padding: '1rem 1.25rem' }}>
          <label>
            SHA256 Hash
            <input
              type="text"
              value={sha256}
              onChange={(e) => setSha256(e.target.value)}
              placeholder="e.g. 275a021bbfb6489e54d471899f7db9d1663fc695ec2fe2a2c4538aabf651fd0f"
              className={styles.input}
              style={{ fontFamily: 'ui-monospace, monospace' }}
            />
          </label>
          <div className={styles.actionForm}>
            <button className={styles.runScanBtn} onClick={search} disabled={loading}>
              {loading ? 'Searching…' : 'Search'}
            </button>
          </div>
          {error && <p className={styles.msgErr}>{error}</p>}
        </div>
      </div>

      {result && (
        <div className={styles.section}>
          <div className={styles.sectionHeader}>
            <h2>Result</h2>
            <span className={`${styles.badge} ${repClass(result.reputation)}`}>
              {result.reputation || 'unknown'}
            </span>
          </div>
          <div className={styles.grid} style={{ padding: '1rem 1.25rem' }}>
            <div className={styles.card}>
              <h3>Reputation</h3>
              <dl>
                <dt>SHA256</dt>
                <dd className={styles.mono}>{result.sha256}</dd>
                <dt>Reputation</dt>
                <dd>{result.reputation}</dd>
                <dt>Source</dt>
                <dd>{result.source || '-'}</dd>
                {result.signature_name && (
                  <>
                    <dt>Signature</dt>
                    <dd>{result.signature_name}</dd>
                  </>
                )}
                {result.family && (
                  <>
                    <dt>Family</dt>
                    <dd>{result.family}</dd>
                  </>
                )}
                {result.severity && (
                  <>
                    <dt>Severity</dt>
                    <dd>{result.severity}</dd>
                  </>
                )}
              </dl>
            </div>
            <div className={styles.card}>
              <h3>History</h3>
              <dl>
                <dt>Detection count</dt>
                <dd>{result.detection_count ?? 0}</dd>
                <dt>Affected endpoints</dt>
                <dd>{result.endpoint_count ?? 0}</dd>
                <dt>First seen</dt>
                <dd>{result.first_seen ? new Date(result.first_seen).toLocaleString() : '-'}</dd>
                <dt>Last seen</dt>
                <dd>{result.last_seen ? new Date(result.last_seen).toLocaleString() : '-'}</dd>
              </dl>
            </div>
          </div>
        </div>
      )}

      <div className={styles.quickLinks}>
        <Link to="/av" className={styles.quickLink}>AV Overview</Link>
        <Link to="/av/detections" className={styles.quickLink}>Detections</Link>
        <Link to="/av/signatures" className={styles.quickLink}>Signatures</Link>
      </div>
      </div>
    </PageShell>
  );
}
