import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GeoWorldMap from './GeoWorldMap';
import styles from './DashboardHttpMap.module.css';

export default function DashboardHttpMap() {
  const { api } = useAuth();
  const [connections, setConnections] = useState([]);
  const [endpoints, setEndpoints] = useState([]);
  const [hours, setHours] = useState(24);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState(null);

  useEffect(() => {
    api('/api/admin/endpoints?limit=200')
      .then((r) => r.json())
      .then((d) => setEndpoints(Array.isArray(d) ? d : d?.endpoints || []))
      .catch(() => setEndpoints([]));
  }, [api]);

  const load = useCallback(() => {
    setErr(null);
    api(`/api/admin/dashboard/http-map?hours=${hours}`)
      .then((r) => {
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setConnections(Array.isArray(data.connections) ? data.connections : []);
      })
      .catch((e) => {
        setErr(e?.message || 'Failed to load map');
        setConnections([]);
      })
      .finally(() => setLoading(false));
  }, [api, hours]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    const id = setInterval(load, 60000);
    return () => clearInterval(id);
  }, [load]);

  return (
    <section className={styles.wrap} aria-label="HTTP and HTTPS world map from agents">
      <header className={styles.head}>
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden />
          <div>
            <h2 className={styles.title}>IronShield monitor</h2>
            <p className={styles.sub}>World map · HTTP/HTTPS traffic to hosted countries (GeoLite) · ports 80, 443, 8080…</p>
          </div>
        </div>
        <div className={styles.controls}>
          <label className={styles.hoursLabel}>
            Window
            <select
              className={styles.hoursSelect}
              value={hours}
              onChange={(e) => {
                setHours(Number(e.target.value));
                setLoading(true);
              }}
            >
              <option value={6}>6h</option>
              <option value={24}>24h</option>
              <option value={72}>72h</option>
              <option value={168}>7d</option>
            </select>
          </label>
          <button type="button" className={styles.refresh} onClick={() => { setLoading(true); load(); }} disabled={loading}>
            {loading ? '…' : '↻'}
          </button>
          <Link to="/agent-network-map" className={styles.openFull}>
            Full network map →
          </Link>
        </div>
      </header>

      {err && <p className={styles.error}>{err}</p>}

      <div className={styles.mapFrame}>
        {loading && !connections.length ? (
          <div className={styles.placeholder}>Loading telemetry…</div>
        ) : null}
        {!loading && !err && connections.length === 0 ? (
          <div className={styles.placeholder}>
            No HTTP(S) connections in this window. Agents must report <code>network_connections</code> with web ports (e.g. 443).
          </div>
        ) : null}
        {!loading && connections.length > 0 ? (
          <GeoWorldMap api={api} connections={connections} endpoints={endpoints} compact />
        ) : null}
      </div>
    </section>
  );
}
