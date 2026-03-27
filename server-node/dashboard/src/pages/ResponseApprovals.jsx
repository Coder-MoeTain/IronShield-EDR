import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconTableShell from '../components/FalconTableShell';
import { asJsonList } from '../utils/apiJson';
import styles from './ResponseApprovals.module.css';

function safeJson(v) {
  try {
    if (v == null) return '';
    if (typeof v === 'string') return v;
    return JSON.stringify(v);
  } catch {
    return '';
  }
}

export default function ResponseApprovals() {
  const { api, user } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', isError: false });
  const [busyId, setBusyId] = useState(null);

  const canAct = useMemo(() => {
    // Match server-side SoD role guard for approve/reject (adminRoutes + sod.js).
    const role = String(user?.role || '').toLowerCase();
    return role === 'admin' || role === 'analyst' || role === 'super_admin';
  }, [user?.role]);

  const isOwnRequest = useCallback(
    (row) => {
      const requestedBy = String(row?.requested_by || row?.created_by || '').toLowerCase();
      const me = String(user?.username || '').toLowerCase();
      return Boolean(requestedBy && me && requestedBy === me);
    },
    [user?.username]
  );

  const fetchPending = useCallback(async () => {
    const r = await api('/api/admin/response-actions/approvals/pending');
    const list = await asJsonList(r);
    setRows(list);
  }, [api]);

  useEffect(() => {
    setLoading(true);
    fetchPending()
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [fetchPending]);

  const act = async (id, action) => {
    const row = rows.find((x) => String(x.id) === String(id));
    if (!canAct) {
      setMsg({ text: 'Approval requires admin, analyst, or super_admin role.', isError: true });
      return;
    }
    if (row && isOwnRequest(row)) {
      setMsg({ text: 'Two-person rule: requester cannot approve/reject their own action.', isError: true });
      return;
    }
    setMsg({ text: '', isError: false });
    setBusyId(id);
    try {
      let body = '{}';
      if (action === 'reject') {
        const reason = window.prompt('Reject reason (optional):', '');
        if (reason === null) return;
        body = JSON.stringify({ reason });
      }
      const r = await api(`/api/admin/response-actions/${id}/${action}`, {
        method: 'POST',
        body,
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || `HTTP ${r.status}`);
      }
      setMsg({ text: action === 'approve' ? 'Approved' : 'Rejected', isError: false });
      await fetchPending();
    } catch (e) {
      setMsg({ text: 'Failed: ' + (e.message || 'Unknown error'), isError: true });
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <PageShell loading loadingLabel="Loading approvals…" />;

  return (
    <PageShell
      kicker="Respond"
      title="Approvals"
      description="Two-person control for high-impact response actions. Review, approve, or reject pending actions."
      actions={
        <button type="button" className="falcon-btn" onClick={() => fetchPending().catch(() => {})}>
          Refresh
        </button>
      }
    >
      <div className={styles.container}>
        {msg.text && <div className={`${styles.msg} ${msg.isError ? styles.msgError : ''}`}>{msg.text}</div>}

        <FalconTableShell>
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Requested</th>
                  <th>Host</th>
                  <th>Action</th>
                  <th>Requested by</th>
                  <th>Params</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id}>
                    <td className="mono">{r.created_at ? new Date(r.created_at).toLocaleString() : '-'}</td>
                    <td>{r.hostname || r.endpoint_hostname || '-'}</td>
                    <td className={styles.actionType}>{r.action_type || r.type || '-'}</td>
                    <td className="mono">{r.requested_by || r.created_by || '-'}</td>
                    <td className={styles.paramsCell}>
                      <details>
                        <summary className={styles.paramsSummary}>View</summary>
                        <pre className={styles.params}>{safeJson(r.parameters || r.params || r.details)}</pre>
                      </details>
                    </td>
                    <td>
                      <span className={styles.statusPill}>{r.status || 'pending'}</span>
                    </td>
                    <td className={styles.actions}>
                      {(() => {
                        const own = isOwnRequest(r);
                        const blocked = !canAct || own;
                        const reason = !canAct
                          ? 'Requires admin, analyst, or super_admin role'
                          : own
                            ? 'Two-person rule: requester cannot approve/reject own action'
                            : '';
                        return (
                          <>
                      <button
                        type="button"
                        className="falcon-btn falcon-btn-primary"
                        disabled={busyId === r.id || blocked}
                        title={reason}
                        onClick={() => act(r.id, 'approve')}
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        className="falcon-btn"
                        disabled={busyId === r.id || blocked}
                        title={reason}
                        onClick={() => act(r.id, 'reject')}
                      >
                        Reject
                      </button>
                          </>
                        );
                      })()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {rows.length === 0 && <p className={styles.empty}>No pending approvals.</p>}
          </div>
        </FalconTableShell>
      </div>
    </PageShell>
  );
}

