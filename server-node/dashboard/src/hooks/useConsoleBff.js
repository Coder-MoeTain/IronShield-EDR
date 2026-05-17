import { useEffect, useState } from 'react';
import { fetchConsoleBff } from '../utils/consoleBff';

export function useConsoleBff(api, module) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetchConsoleBff(api, module)
      .then((d) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {
        if (!cancelled) setData(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [api, module]);

  return { data, loading };
}
