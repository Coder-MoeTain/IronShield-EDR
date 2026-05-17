import React, { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../../context/AuthContext';
import { apiPath } from '../../../utils/apiPath';
import { readApiJson } from '../../../utils/apiEnvelope';
import DetailDrawer from '../../../components/DetailDrawer';
import {
  NotifyUpdateModal,
  NotifyUninstallModal,
  BlockModal,
  AcceptRiskModal,
} from '../../../components/software/SoftwareActionModals';
import styles from './EndpointSoftwareTab.module.css';

function riskTags(row) {
  const tags = [];
  if (row.risk_level === 'critical') tags.push('Critical CVE');
  if (row.risk_level === 'high') tags.push('High CVE');
  if (row.known_exploit_count > 0) tags.push('Known Exploited');
  if (row.outdated) tags.push('Outdated');
  if (row.unsupported) tags.push('Unsupported');
  if (row.blocked) tags.push('Blocked');
  if (row.accepted_risk) tags.push('Accepted Risk');
  if (row.recommended_action === 'update') tags.push('Update Required');
  if (row.recommended_action === 'uninstall') tags.push('Uninstall Required');
  return tags;
}

export default function EndpointSoftwareTab() {
  const { id } = useParams();
  const { api } = useAuth();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState({});
  const [msg, setMsg] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api(apiPath(`/api/software/inventory?endpoint_id=${id}&limit=500`));
      if (!res.ok) throw new Error('load failed');
      const { data } = await readApiJson(res);
      setRows(data?.inventory || []);
    } catch {
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [api, id]);

  useEffect(() => {
    load();
  }, [load]);

  const postAction = async (rowId, action, body = {}) => {
    setMsg('');
    try {
      const res = await api(apiPath(`/api/software/inventory/${rowId}/${action}`), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const errJson = await res.json().catch(() => ({}));
        throw new Error(errJson?.error?.message || `Failed (${res.status})`);
      }
      setMsg(`${action} completed`);
      setModal(null);
      load();
    } catch (e) {
      setMsg(e.message);
    }
  };

  const vulnerable = rows.filter((r) => (r.risk_score || 0) >= 61).length;
  const blocked = rows.filter((r) => r.blocked).length;

  return (
    <div className={styles.wrap}>
      <div className={styles.toolbar}>
        <button type="button" onClick={load}>Refresh list</button>
        <button type="button" onClick={() => rows[0] && postAction(rows[0].id, 'refresh')} disabled={!rows.length}>
          Request agent inventory scan
        </button>
      </div>
      <div className={styles.kpis}>
        <span>Installed: <strong>{rows.length}</strong></span>
        <span>Vulnerable: <strong>{vulnerable}</strong></span>
        <span>Blocked: <strong>{blocked}</strong></span>
      </div>
      {msg && <p className={styles.msg}>{msg}</p>}
      {loading ? <p>Loading software inventory…</p> : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Software</th>
              <th>Vendor</th>
              <th>Version</th>
              <th>Risk</th>
              <th>Tags</th>
              <th>CVEs</th>
              <th>Blocked</th>
              <th>Last seen</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td>{r.vendor || '—'}</td>
                <td>{r.version || '—'}</td>
                <td><span className={styles[`risk_${r.risk_level}`]}>{r.risk_score ?? 0}</span></td>
                <td className={styles.tags}>{riskTags(r).join(', ') || '—'}</td>
                <td>{r.vulnerability_count ?? 0}</td>
                <td>{r.blocked ? 'Yes' : 'No'}</td>
                <td>{r.last_seen_at || '—'}</td>
                <td className={styles.actions}>
                  <button type="button" onClick={() => setSelected(r)}>Detail</button>
                  <button type="button" onClick={() => { setSelected(r); setModal('notify-update'); setForm({}); }}>Update</button>
                  <button type="button" onClick={() => { setSelected(r); setModal('notify-uninstall'); setForm({}); }}>Uninstall</button>
                  {r.blocked ? (
                    <button type="button" onClick={() => postAction(r.id, 'unblock')}>Unblock</button>
                  ) : (
                    <button type="button" onClick={() => { setSelected(r); setModal('block'); setForm({}); }}>Block</button>
                  )}
                  <button type="button" onClick={() => { setSelected(r); setModal('accept-risk'); setForm({}); }}>Accept</button>
                  <button type="button" onClick={() => postAction(r.id, 'create-incident')}>Incident</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <DetailDrawer open={!!selected && !modal} title={selected?.name} onClose={() => setSelected(null)}>
        {selected && (
          <div>
            <p><strong>Vendor:</strong> {selected.vendor}</p>
            <p><strong>Version:</strong> {selected.version}</p>
            <p><strong>Risk:</strong> {selected.risk_score}/100 ({selected.risk_level})</p>
            <p>{selected.reason || 'No risk explanation.'}</p>
            <p><strong>Last seen:</strong> {selected.last_seen_at}</p>
          </div>
        )}
      </DetailDrawer>

      <NotifyUpdateModal
        open={modal === 'notify-update' && !!selected}
        selected={selected}
        form={form}
        setForm={setForm}
        onClose={() => setModal(null)}
        onSubmit={() => postAction(selected.id, 'notify-update', { title: form.title, message: form.message })}
      />
      <NotifyUninstallModal
        open={modal === 'notify-uninstall' && !!selected}
        selected={selected}
        form={form}
        setForm={setForm}
        onClose={() => setModal(null)}
        onSubmit={() => postAction(selected.id, 'notify-uninstall', { title: form.title, message: form.message })}
      />
      <BlockModal
        open={modal === 'block' && !!selected}
        selected={selected}
        form={form}
        setForm={setForm}
        onClose={() => setModal(null)}
        onSubmit={() =>
          postAction(selected.id, 'block', {
            reason: form.reason,
            approved_by: form.approved_by || undefined,
            expires_at: form.expires_at || undefined,
          })
        }
      />
      <AcceptRiskModal
        open={modal === 'accept-risk' && !!selected}
        selected={selected}
        form={form}
        setForm={setForm}
        onClose={() => setModal(null)}
        onSubmit={() => postAction(selected.id, 'accept-risk', { reason: form.reason, until: form.until })}
      />
    </div>
  );
}
