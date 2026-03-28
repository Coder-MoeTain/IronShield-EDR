import { useState, useEffect, useCallback } from 'react';

/**
 * Persist visible table columns per table id (browser localStorage, SOC layout memory).
 */
export function useTableColumnPreferences(tableId, defaults) {
  const key = `ironshield:table-cols:${tableId}`;

  const [visible, setVisible] = useState(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return { ...defaults };
      const parsed = JSON.parse(raw);
      return { ...defaults, ...parsed };
    } catch {
      return { ...defaults };
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(visible));
    } catch {
      /* ignore quota */
    }
  }, [key, visible]);

  const toggle = useCallback((col) => {
    setVisible((v) => {
      const next = { ...v, [col]: !v[col] };
      if (!Object.values(next).some(Boolean)) return v;
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    setVisible({ ...defaults });
  }, [defaults]);

  return { visible, setVisible, toggle, reset };
}
