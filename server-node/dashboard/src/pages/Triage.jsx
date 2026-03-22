import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import Playbooks from './Playbooks';
import styles from './Alerts.module.css';

export default function Triage() {
  const { api } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const tab = searchParams.get('tab') === 'playbooks' ? 'playbooks' : 'requests';
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [results, setResults] = useState(null);

  useEffect(() => {
    api('/api/admin/triage?limit=50')
      .then((r) => r.json())
      .then(setItems)
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [api]);

  const viewResult = async (id) => {
    const r = await api(`/api/admin/triage/${id}`);
    const data = await r.json();
    setSelected(id);
    setResults(data.results || []);
  };

  const setTab = (next) => {
    if (next === 'requests') setSearchParams({});
    else setSearchParams({ tab: 'playbooks' });
  };

  return (
    <PageShell
      kicker="Respond"
      title="Triage & playbooks"
      description="Review live collection requests from agents, or define and run ordered response action chains."
    >
      <div className="ui-segmented" role="tablist" aria-label="Triage sections">
        <button type="button" role="tab" aria-selected={tab === 'requests'} onClick={() => setTab('requests')}>
          Requests
        </button>
        <button type="button" role="tab" aria-selected={tab === 'playbooks'} onClick={() => setTab('playbooks')}>
          Playbooks
        </button>
      </div>

      {tab === 'playbooks' ? (
        <Playbooks embedded />
      ) : loading ? (
        <div className="ui-loading" role="status">
          Loading triage
        </div>
      ) : (
        <>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Endpoint</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {items.map((t) => (
                  <tr key={t.id}>
                    <td className="mono">{t.id}</td>
                    <td>
                      <Link to={`/endpoints/${t.endpoint_id}`}>{t.hostname}</Link>
                    </td>
                    <td>{t.request_type}</td>
                    <td>
                      <span className={styles.status}>{t.status}</span>
                    </td>
                    <td className="mono">{new Date(t.created_at).toLocaleString()}</td>
                    <td>
                      <button className={styles.link} onClick={() => viewResult(t.id)}>
                        View Result
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {items.length === 0 && <p className={styles.empty}>No triage requests.</p>}
          </div>
          {selected && results && results.length > 0 && (
            <div className={styles.card} style={{ marginTop: 16 }}>
              <h3>Triage Result</h3>
              <pre style={{ maxHeight: 400, overflow: 'auto', fontSize: 12 }}>
                {JSON.stringify(
                  typeof results[0]?.result_json === 'string'
                    ? JSON.parse(results[0].result_json)
                    : results[0]?.result_json || results[0],
                  null,
                  2
                )}
              </pre>
            </div>
          )}
        </>
      )}
    </PageShell>
  );
}
