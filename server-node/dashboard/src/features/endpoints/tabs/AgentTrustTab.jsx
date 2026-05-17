import React, { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { api } from '../../../utils/api';
import { parseApiResponse } from '../../../utils/apiEnvelope';
import AgentTrustPanel from '../components/AgentTrustPanel';
import LoadingState from '../../../components/LoadingState';
import ErrorState from '../../../components/ErrorState';

export default function AgentTrustTab() {
  const { id } = useParams();
  const [endpoint, setEndpoint] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const r = await api(`/api/v1/admin/endpoints/${id}`);
        const body = await r.json();
        const parsed = parseApiResponse(body);
        if (!r.ok || !parsed.success) {
          throw new Error(parsed.error?.message || 'Failed to load endpoint');
        }
        if (!cancelled) setEndpoint(parsed.data?.endpoint || parsed.data);
      } catch (e) {
        if (!cancelled) setError(e.message || 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) return <LoadingState message="Loading agent trust…" />;
  if (error) return <ErrorState message={error} />;
  return <AgentTrustPanel endpoint={endpoint} />;
}
