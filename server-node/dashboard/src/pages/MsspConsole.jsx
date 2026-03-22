import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './MsspConsole.module.css';

export default function MsspConsole() {
  const { api, selectedTenantId } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    setLoading(true);
    setError('');
    api('/api/admin/mssp/overview')
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message || 'Failed to load'))
      .finally(() => setLoading(false));
  }, [api, selectedTenantId]);

  if (loading) return <PageShell loading loadingLabel="Loading MSSP overview…" />;
  if (error) {
    return (
      <PageShell kicker="Enterprise" title="MSSP operations" description="Managed SOC overview per client.">
        <div className={styles.error}>{error}</div>
      </PageShell>
    );
  }
  if (!data) {
    return (
      <PageShell kicker="Enterprise" title="MSSP operations">
        <div className={styles.error}>No data</div>
      </PageShell>
    );
  }

  const tenants = data.tenants || [];
  const scopeLabel = data.scope === 'global' ? 'All clients' : 'Your tenant';

  return (
    <PageShell
      kicker="Enterprise"
      title={
        <>
          MSSP operations <span className={styles.scopeBadge}>{scopeLabel}</span>
        </>
      }
      description="Internal managed-SOC view: client health, alert backlog, and investigation load. Use Tenants and the tenant switcher to scope work per client."
    >
    <div className={styles.container}>
      <div className={styles.summaryRow}>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{data.triage_pending}</div>
          <div className={styles.summaryLabel}>Triage in progress</div>
        </div>
        <div className={styles.summaryCard}>
          <div className={styles.summaryValue}>{data.investigations_open_global}</div>
          <div className={styles.summaryLabel}>Open investigations (platform)</div>
        </div>
        <div className={styles.summaryCard}>
          <Link to="/alerts">Alert queue →</Link>
          <div className={styles.summaryLabel} style={{ marginTop: '0.5rem' }}>Review and assign</div>
        </div>
        <div className={styles.summaryCard}>
          <Link to="/investigations">Investigations →</Link>
          <div className={styles.summaryLabel} style={{ marginTop: '0.5rem' }}>Cases by endpoint</div>
        </div>
      </div>

      <h2 className={styles.title} style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>
        Clients
      </h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Client</th>
              <th>Slug</th>
              <th>Endpoints</th>
              <th>Online (est.)</th>
              <th>Open alerts</th>
              <th>Open investigations</th>
            </tr>
          </thead>
          <tbody>
            {tenants.length === 0 ? (
              <tr>
                <td colSpan={6}>No tenants in scope.</td>
              </tr>
            ) : (
              tenants.map((t) => (
                <tr key={t.id}>
                  <td>
                    <Link to={`/tenants`}>{t.name}</Link>
                  </td>
                  <td className="mono">{t.slug}</td>
                  <td>{t.endpoint_count ?? 0}</td>
                  <td>{t.online_count ?? 0}</td>
                  <td>{t.open_alerts ?? 0}</td>
                  <td>{t.open_investigations ?? 0}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
    </PageShell>
  );
}
