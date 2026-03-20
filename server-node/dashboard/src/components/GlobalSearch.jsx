import React, { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './GlobalSearch.module.css';

export default function GlobalSearch() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const search = useCallback(async () => {
    if (!query.trim() || query.length < 2) return;
    setLoading(true);
    try {
      const r = await api(`/api/admin/search/global?q=${encodeURIComponent(query)}&limit=10`);
      const data = await r.json();
      setResults(data);
      setOpen(true);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [query, api]);

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') search();
  };

  const goTo = (path) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <div className={styles.wrapper}>
      <div className={styles.inputWrap}>
        <input
          type="search"
          placeholder="Search endpoints, alerts, events, hashes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => results && setOpen(true)}
          className={styles.input}
        />
        <button onClick={search} disabled={loading || query.length < 2}>Search</button>
      </div>
      {open && results && (
        <div className={styles.results}>
          {results.endpoints?.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Endpoints</div>
              {results.endpoints.map((e) => (
                <div key={e.id} className={styles.item} onClick={() => goTo(`/endpoints/${e.id}`)}>
                  {e.hostname} <span className="mono">{e.ip_address}</span>
                </div>
              ))}
            </div>
          )}
          {results.alerts?.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Alerts</div>
              {results.alerts.map((a) => (
                <div key={a.id} className={styles.item} onClick={() => goTo(`/alerts/${a.id}`)}>
                  {a.title} – {a.hostname}
                </div>
              ))}
            </div>
          )}
          {results.events?.length > 0 && (
            <div className={styles.section}>
              <div className={styles.sectionTitle}>Events</div>
              {results.events.map((e) => (
                <div key={e.id} className={styles.item} onClick={() => goTo(`/normalized-events/${e.id}`)}>
                  {e.process_name} – {e.hostname}
                </div>
              ))}
            </div>
          )}
          {results.endpoints?.length === 0 && results.alerts?.length === 0 && results.events?.length === 0 && (
            <div className={styles.empty}>No results</div>
          )}
          <button className={styles.close} onClick={() => setOpen(false)}>Close</button>
        </div>
      )}
    </div>
  );
}
