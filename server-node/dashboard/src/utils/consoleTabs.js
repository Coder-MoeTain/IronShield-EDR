import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * URL-synced tab state: ?tab=<id>
 * @param {string} defaultTab
 * @param {string[]} validTabs
 */
export function useConsoleTab(defaultTab, validTabs) {
  const [searchParams, setSearchParams] = useSearchParams();
  const raw = searchParams.get('tab');
  const tab = validTabs.includes(raw) ? raw : defaultTab;

  const setTab = useCallback(
    (next) => {
      const nextParams = new URLSearchParams(searchParams);
      if (next === defaultTab) nextParams.delete('tab');
      else nextParams.set('tab', next);
      setSearchParams(nextParams, { replace: true });
    },
    [searchParams, setSearchParams, defaultTab]
  );

  return [tab, setTab];
}
