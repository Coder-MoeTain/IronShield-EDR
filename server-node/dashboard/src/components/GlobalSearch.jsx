import React, { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './GlobalSearch.module.css';

export default function GlobalSearch() {
  const { api } = useAuth();
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const listRef = useRef(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);

  const flatItems = useMemo(() => {
    if (!results) return [];
    const out = [];
    (results.endpoints || []).forEach((e) => {
      out.push({
        category: 'Endpoints',
        key: `ep-${e.id}`,
        path: `/endpoints/${e.id}`,
        label: e.hostname || 'Host',
        sub: e.ip_address ? String(e.ip_address) : '',
      });
    });
    (results.alerts || []).forEach((a) => {
      out.push({
        category: 'Alerts',
        key: `al-${a.id}`,
        path: `/alerts/${a.id}`,
        label: a.title || 'Alert',
        sub: a.hostname || '',
      });
    });
    (results.events || []).forEach((e) => {
      out.push({
        category: 'Events',
        key: `ev-${e.id}`,
        path: `/normalized-events/${e.id}`,
        label: e.process_name || 'Event',
        sub: e.hostname || '',
      });
    });
    return out;
  }, [results]);

  const search = useCallback(async () => {
    if (!query.trim() || query.length < 2) return;
    setLoading(true);
    setActiveIndex(-1);
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

  useEffect(() => {
    const onKey = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        inputRef.current?.focus();
        inputRef.current?.select?.();
      }
      if (e.key === 'Escape' && open) {
        e.preventDefault();
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setActiveIndex(-1);
      }
    };
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const el = document.getElementById(`global-search-opt-${activeIndex}`);
    el?.scrollIntoView?.({ block: 'nearest' });
  }, [activeIndex, open]);

  const goTo = useCallback(
    (path) => {
      setOpen(false);
      setActiveIndex(-1);
      navigate(path);
    },
    [navigate]
  );

  const handleInputKeyDown = (e) => {
    const n = flatItems.length;
    if (n === 0) {
      if (e.key === 'Enter') search();
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => (i < 0 ? 0 : (i + 1) % n));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (!open) setOpen(true);
      setActiveIndex((i) => (i <= 0 ? n - 1 : i - 1));
      return;
    }
    if (e.key === 'Enter') {
      e.preventDefault();
      if (open && activeIndex >= 0 && flatItems[activeIndex]) {
        goTo(flatItems[activeIndex].path);
      } else {
        search();
      }
      return;
    }
    if (e.key === 'Home' && open) {
      e.preventDefault();
      setActiveIndex(0);
    }
    if (e.key === 'End' && open) {
      e.preventDefault();
      setActiveIndex(n - 1);
    }
  };

  const listboxId = 'global-search-results';

  return (
    <div className={styles.wrapper} ref={wrapRef}>
      <div className={styles.inputWrap}>
        <input
          ref={inputRef}
          id="global-search-input"
          type="search"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open && !!results}
          aria-controls={listboxId}
          aria-activedescendant={open && activeIndex >= 0 ? `global-search-opt-${activeIndex}` : undefined}
          aria-haspopup="listbox"
          placeholder="Search hosts, alerts, events… (Ctrl+K)"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setActiveIndex(-1);
          }}
          onKeyDown={handleInputKeyDown}
          onFocus={() => results && setOpen(true)}
          className={styles.input}
          autoComplete="off"
          aria-label="Global search"
        />
        <button type="button" onClick={search} disabled={loading || query.length < 2} className={styles.searchBtn}>
          Search
        </button>
      </div>
      {open && results && (
        <div className={styles.results} role="region" aria-label="Search results">
          {flatItems.length > 0 ? (
            <div ref={listRef} id={listboxId} className={styles.listbox} role="listbox">
              {flatItems.map((item, idx) => (
                <div
                  key={item.key}
                  id={`global-search-opt-${idx}`}
                  role="option"
                  aria-selected={activeIndex === idx}
                  className={`${styles.item} ${activeIndex === idx ? styles.itemActive : ''}`}
                  onMouseDown={(ev) => ev.preventDefault()}
                  onClick={() => goTo(item.path)}
                  onMouseEnter={() => setActiveIndex(idx)}
                >
                  <span className={styles.itemCat}>{item.category}</span>
                  <span className={styles.itemMain}>{item.label}</span>
                  {item.sub ? <span className={`${styles.itemSub} mono`}> {item.sub}</span> : null}
                </div>
              ))}
            </div>
          ) : (
            <div className={styles.empty} role="status">
              No results
            </div>
          )}
          <button
            type="button"
            className={styles.close}
            onClick={() => {
              setOpen(false);
              setActiveIndex(-1);
            }}
          >
            Close
          </button>
        </div>
      )}
    </div>
  );
}
