import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { canRunResponseActions } from '../routes/permissions';
import { apiPath } from '../utils/apiPath';
import styles from './CommandPalette.module.css';

const QUICK_ACTIONS = [
  { id: 'goto-overview', label: 'Go to Overview', path: '/overview', perm: null },
  { id: 'goto-detections', label: 'Go to Detections', path: '/detections', perm: null },
  { id: 'goto-hunting', label: 'Go to Threat Hunting', path: '/hunting', perm: 'hunting:view' },
  { id: 'goto-response', label: 'Go to Response', path: '/response', perm: 'response:view' },
];

export default function CommandPalette() {
  const { api, user, permissions, hasPermission } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const canRespond = canRunResponseActions(user, permissions);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(true);
        setTimeout(() => inputRef.current?.focus(), 0);
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const search = useCallback(async () => {
    const q = query.trim();
    if (q.length < 2) return;
    setLoading(true);
    try {
      const r = await api(apiPath(`/api/admin/search/global?q=${encodeURIComponent(q)}&limit=12`));
      const data = r.ok ? await r.json() : {};
      setResults(data);
    } catch {
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [query, api]);

  useEffect(() => {
    if (!open || query.trim().length < 2) {
      setResults(null);
      return undefined;
    }
    const t = setTimeout(search, 280);
    return () => clearTimeout(t);
  }, [query, open, search]);

  const items = useMemo(() => {
    const out = [];
    const q = query.trim().toLowerCase();

    QUICK_ACTIONS.forEach((a) => {
      if (a.perm && !hasPermission(a.perm) && !permissions.includes('*')) return;
      if (!q || a.label.toLowerCase().includes(q)) {
        out.push({ kind: 'action', ...a });
      }
    });

    if (canRespond && (!q || 'approval'.includes(q) || 'response'.includes(q))) {
      out.push({
        kind: 'action',
        id: 'response-approvals',
        label: 'Pending response approvals',
        path: '/response?tab=approvals',
      });
    }

    (results?.endpoints || []).forEach((e) => {
      out.push({
        kind: 'endpoint',
        id: `ep-${e.id}`,
        label: e.hostname || `Host ${e.id}`,
        sub: e.ip_address,
        path: `/endpoints/${e.id}`,
      });
    });
    (results?.alerts || []).forEach((a) => {
      out.push({
        kind: 'alert',
        id: `al-${a.id}`,
        label: a.title || `Alert ${a.id}`,
        sub: a.hostname,
        path: `/detections/alerts/${a.id}`,
      });
    });
    (results?.events || []).forEach((e) => {
      out.push({
        kind: 'event',
        id: `ev-${e.id}`,
        label: e.process_name || `Event ${e.id}`,
        sub: e.hostname,
        path: `/normalized-events/${e.id}`,
      });
    });
    (results?.incidents || []).forEach((i) => {
      out.push({
        kind: 'incident',
        id: `inc-${i.id}`,
        label: i.title || `Incident ${i.id}`,
        path: `/investigation/incidents/${i.id}`,
      });
    });
    (results?.iocs || []).forEach((i) => {
      out.push({
        kind: 'ioc',
        id: `ioc-${i.id}`,
        label: `${i.type}: ${i.value}`,
        path: `/hunting?tab=iocs`,
      });
    });

    return out.slice(0, 24);
  }, [results, query, hasPermission, permissions, canRespond]);

  const go = (path) => {
    setOpen(false);
    setQuery('');
    setResults(null);
    navigate(path);
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (items[activeIndex]) go(items[activeIndex].path);
    else if (query.trim().length >= 2) search();
  };

  if (!open) return null;

  return (
    <div className={styles.overlay} role="presentation" onClick={() => setOpen(false)}>
      <div
        className={styles.panel}
        role="dialog"
        aria-modal="true"
        aria-label="Command Center"
        onClick={(e) => e.stopPropagation()}
      >
        <form onSubmit={onSubmit}>
          <input
            ref={inputRef}
            className={styles.input}
            placeholder="Search hosts, alerts, hashes, IPs, domains…"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setActiveIndex((i) => Math.min(i + 1, items.length - 1));
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault();
                setActiveIndex((i) => Math.max(i - 1, 0));
              }
            }}
            autoComplete="off"
          />
        </form>
        <div className={styles.hint}>Ctrl+K · ↑↓ navigate · Enter open · Esc close</div>
        <ul className={styles.list} role="listbox">
          {loading ? <li className={styles.muted}>Searching…</li> : null}
          {!loading && items.length === 0 ? (
            <li className={styles.muted}>Type 2+ characters to search</li>
          ) : null}
          {items.map((item, idx) => (
            <li key={item.id}>
              <button
                type="button"
                role="option"
                aria-selected={idx === activeIndex}
                className={`${styles.item} ${idx === activeIndex ? styles.itemActive : ''}`}
                onMouseEnter={() => setActiveIndex(idx)}
                onClick={() => go(item.path)}
              >
                <span className={styles.kind}>{item.kind}</span>
                <span className={styles.label}>{item.label}</span>
                {item.sub ? <span className={styles.sub}>{item.sub}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
