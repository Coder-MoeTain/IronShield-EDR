import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconTableShell from '../components/FalconTableShell';
import FalconEmptyState from '../components/FalconEmptyState';
import FalconPagination from '../components/FalconPagination';
import styles from './AuditLogs.module.css';

export default function AuditLogs() {
  const { api } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 500);
  const offset = Math.max(parseInt(searchParams.get('offset') || '0', 10) || 0, 0);
  const actionFilter = searchParams.get('action') || '';

  const setPaging = useCallback(
    (next) => {
      const p = new URLSearchParams(searchParams);
      if (next.limit != null) p.set('limit', String(next.limit));
      if (next.offset != null) p.set('offset', String(next.offset));
      if (next.action !== undefined) {
        if (next.action) p.set('action', next.action);
        else p.delete('action');
      }
      setSearchParams(p, { replace: true });
    },
    [searchParams, setSearchParams]
  );

  const fetchLogs = useCallback(() => {
    setLoading(true);
    const q = new URLSearchParams();
    q.set('limit', String(limit));
    q.set('offset', String(offset));
    if (actionFilter.trim()) q.set('action', actionFilter.trim());
    api(`/api/admin/audit-logs?${q}`)
      .then(async (r) => {
        const data = await r.json();
        if (!r.ok) throw new Error(data?.error || 'Failed');
        const list = Array.isArray(data.logs) ? data.logs : Array.isArray(data) ? data : [];
        setLogs(list);
        setTotal(typeof data.total === 'number' ? data.total : list.length);
      })
      .catch(() => {
        setLogs([]);
        setTotal(0);
      })
      .finally(() => setLoading(false));
  }, [api, limit, offset, actionFilter]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const filterBar = useMemo(
    () => (
      <div className={`${styles.toolbar} falcon-filter-bar`}>
        <input
          type="search"
          placeholder="Filter by action…"
          value={actionFilter}
          onChange={(e) => setPaging({ action: e.target.value, offset: 0 })}
          aria-label="Filter audit actions"
        />
        <button type="button" className="falcon-btn falcon-btn-ghost" onClick={fetchLogs}>
          ↻ Refresh
        </button>
        <button
          type="button"
          className="falcon-btn falcon-btn-ghost"
          onClick={() => setPaging({ action: '', offset: 0 })}
          disabled={!actionFilter}
        >
          Clear
        </button>
      </div>
    ),
    [actionFilter, fetchLogs, setPaging]
  );

  if (loading && logs.length === 0) {
    return <PageShell loading loadingLabel="Loading audit logs…" />;
  }

  return (
    <PageShell
      kicker="Configuration"
      title="Audit & activity"
      description="Administrator and API actions for compliance review."
    >
      <div className={styles.container}>
        <FalconTableShell
          toolbar={filterBar}
          footer={
            <FalconPagination
              offset={offset}
              limit={limit}
              total={total}
              pageItemCount={logs.length}
              onPrev={() => setPaging({ offset: Math.max(0, offset - limit) })}
              onNext={() => setPaging({ offset: offset + limit })}
              onLimitChange={(newLimit) => setPaging({ limit: newLimit, offset: 0 })}
              pageSizeOptions={[25, 50, 100]}
            />
          }
        >
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Time</th>
                  <th>User</th>
                  <th>Action</th>
                  <th>Resource</th>
                  <th>IP</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id}>
                    <td className="mono">{new Date(l.created_at).toLocaleString()}</td>
                    <td>{l.username || '-'}</td>
                    <td>{l.action}</td>
                    <td>{l.resource_type || '-'}</td>
                    <td className="mono">{l.ip_address || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {logs.length === 0 && (
              <FalconEmptyState
                title="No audit entries in this range"
                description="Adjust the action filter or page through older entries."
              />
            )}
          </div>
        </FalconTableShell>
      </div>
    </PageShell>
  );
}
