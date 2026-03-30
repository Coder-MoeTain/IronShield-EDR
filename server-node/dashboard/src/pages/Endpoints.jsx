import React, { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import { useToast } from '../context/ToastContext';
import PageShell from '../components/PageShell';
import FalconEmptyState from '../components/FalconEmptyState';
import PermissionGate from '../components/PermissionGate';
import { asJsonList } from '../utils/apiJson';
import { endpointSensorListDisplay } from '../utils/sensorUi';
import styles from './Endpoints.module.css';

const SENSOR_CLASS = {
  sensorUpdatePending: styles.sensorUpdatePending,
  sensorContain: styles.sensorContain,
  sensorDegraded: styles.sensorDegraded,
  sensorQueue: styles.sensorQueue,
  sensorOk: styles.sensorOk,
};

function HostSensorCell({ ep }) {
  const d = endpointSensorListDisplay(ep);
  const cls = d.className ? SENSOR_CLASS[d.className] : null;
  if (!cls) {
    return <span title={d.title}>{d.text}</span>;
  }
  return (
    <span className={cls} title={d.title}>
      {d.text}
    </span>
  );
}

export default function Endpoints() {
  const { api } = useAuth();
  const { confirm } = useConfirm();
  const { addToast } = useToast();
  const [searchParams] = useSearchParams();
  const statusFilter = searchParams.get('status') || '';
  const [endpoints, setEndpoints] = useState([]);
  const [hostGroups, setHostGroups] = useState([]);
  const [hostGroupFilter, setHostGroupFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState(null);

  useEffect(() => {
    api('/api/admin/host-groups')
      .then((r) => asJsonList(r))
      .then(setHostGroups)
      .catch(() => setHostGroups([]));
  }, [api]);

  const fetchEndpoints = () => {
    const params = new URLSearchParams();
    if (hostGroupFilter) params.set('hostGroupId', hostGroupFilter);
    if (statusFilter) params.set('status', statusFilter);
    const q = params.toString() ? `?${params.toString()}` : '';
    api(`/api/admin/endpoints${q}`)
      .then((r) => asJsonList(r))
      .then(setEndpoints)
      .catch(() => setEndpoints([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    setLoading(true);
    fetchEndpoints();
  }, [api, hostGroupFilter, statusFilter]);

  const handleDelete = async (ep) => {
    if (
      !(await confirm({
        title: 'Delete endpoint',
        message: `Delete "${ep.hostname}"? This removes associated data for this host.`,
        danger: true,
        confirmLabel: 'Delete',
      }))
    )
      return;
    setDeleting(ep.id);
    try {
      const res = await api(`/api/admin/endpoints/${ep.id}`, { method: 'DELETE' });
      const errBody = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(errBody.error || `Delete failed (${res.status})`);
      }
      fetchEndpoints();
    } catch (e) {
      addToast({ variant: 'error', message: e.message || 'Failed to delete endpoint' });
    } finally {
      setDeleting(null);
    }
  };

  const statusClass = (s) => {
    if (s === 'online') return styles.statusOnline;
    if (s === 'offline') return styles.statusOffline;
    return styles.statusUnknown;
  };

  if (loading) {
    return <PageShell loading loadingLabel="Loading hosts" />;
  }

  return (
    <PageShell
      kicker="Hosts"
      title="All hosts"
      description="Managed endpoints — last seen, health, and containment state."
    >
      {statusFilter ? (
        <div className={styles.filterBanner} role="status">
          Showing hosts with status <strong>{statusFilter}</strong>
          <Link to="/endpoints" className={styles.filterBannerClear}>
            Clear filter
          </Link>
        </div>
      ) : null}
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Hostname</th>
              <th>Tenant (CID)</th>
              <th>Group</th>
              <th>IP</th>
              <th>User</th>
              <th>OS</th>
              <th>CPU</th>
              <th>RAM</th>
              <th>Disk</th>
              <th>Sensor</th>
              <th>NGAV</th>
              <th>Policy</th>
              <th>Status</th>
              <th>Last Heartbeat</th>
              <th className={styles.actionsHead} aria-label="Actions" />
            </tr>
          </thead>
          <tbody>
            {endpoints.map((ep) => (
              <tr key={ep.id}>
                <td className={styles.hostname}>{ep.hostname}</td>
                <td className={styles.tenantCell} title={ep.tenant_name || ''}>
                  {ep.tenant_slug ? (
                    <span className={styles.tenantSlug}>{ep.tenant_slug}</span>
                  ) : (
                    '—'
                  )}
                </td>
                <td>{ep.host_group_name || '—'}</td>
                <td className="mono">{ep.ip_address || '-'}</td>
                <td>{ep.logged_in_user || '-'}</td>
                <td className={styles.os}>{ep.os_version ? ep.os_version.substring(0, 40) + '...' : '-'}</td>
                <td>{ep.cpu_percent != null ? `${ep.cpu_percent}%` : '-'}</td>
                <td>{ep.ram_percent != null ? `${ep.ram_percent}%` : '-'}</td>
                <td>{ep.disk_percent != null ? `${ep.disk_percent}%` : '-'}</td>
                <td className={styles.sensorCell}>
                  <HostSensorCell ep={ep} />
                </td>
                <td className={styles.ngavCell}>
                  {(ep.av_ngav_prevention_status || '').toLowerCase() === 'degraded' ? (
                    <span
                      className={styles.ngavDegraded}
                      title={
                        ep.av_ngav_signature_count != null && ep.av_ngav_signature_count !== ''
                          ? `${Number(ep.av_ngav_signature_count).toLocaleString()} signatures · No realtime or empty defs`
                          : 'No signatures or NGAV unhealthy'
                      }
                    >
                      Degraded
                    </span>
                  ) : (ep.av_ngav_prevention_status || '').toLowerCase() === 'active' ? (
                    <span
                      className={styles.ngavActive}
                      title={
                        ep.av_ngav_signature_count != null && ep.av_ngav_signature_count !== ''
                          ? `${Number(ep.av_ngav_signature_count).toLocaleString()} signatures · Realtime prevention`
                          : 'Realtime prevention enabled'
                      }
                    >
                      Active
                    </span>
                  ) : (ep.av_ngav_prevention_status || '').toLowerCase() === 'monitor_only' ? (
                    <span
                      className={styles.ngavMonitor}
                      title={
                        ep.av_ngav_signature_count != null && ep.av_ngav_signature_count !== ''
                          ? `${Number(ep.av_ngav_signature_count).toLocaleString()} signatures · Monitor-only`
                          : 'Scan without realtime blocking'
                      }
                    >
                      Monitor
                    </span>
                  ) : (
                    '—'
                  )}
                </td>
                <td className={styles.policyCell} title={
                  (ep.policy_compliance_status || '').toLowerCase() === 'mismatch'
                    ? `Mismatch: assigned ${ep.assigned_policy_id ?? '—'} vs sensor ${ep.edr_policy_id ?? '—'}`
                    : ep.edr_policy_name
                      ? `Sensor policy: ${ep.edr_policy_name}`
                      : 'EDR policy id from last heartbeat'
                }>
                  <span className="mono" style={{ fontSize: '0.8rem' }}>
                    {ep.edr_policy_id != null && ep.edr_policy_id !== '' ? ep.edr_policy_id : '—'}
                  </span>
                  {(ep.policy_compliance_status || '').toLowerCase() === 'mismatch' ? (
                    <span className={styles.policyMismatchMark} aria-label="Policy mismatch">!</span>
                  ) : null}
                </td>
                <td>
                  <span className={`${styles.badge} ${statusClass(ep.status)}`}>
                    {ep.status || 'unknown'}
                  </span>
                </td>
                <td className="mono">
                  {ep.last_heartbeat_at
                    ? new Date(ep.last_heartbeat_at).toLocaleString()
                    : '-'}
                </td>
                <td className={styles.actionsCell}>
                  <Link to={`/endpoints/${ep.id}`} className={styles.viewLink}>View</Link>
                  {' '}
                  <PermissionGate permission="actions:write">
                    <button
                      type="button"
                      className={styles.deleteBtn}
                      onClick={() => handleDelete(ep)}
                      disabled={deleting === ep.id}
                      title="Delete endpoint"
                    >
                      {deleting === ep.id ? '…' : 'Delete'}
                    </button>
                  </PermissionGate>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {endpoints.length === 0 && (
          <FalconEmptyState
            icon="🖥"
            title="No hosts registered"
            description="Agents appear here after enrollment. Verify the server URL in the agent config and that the agent can reach the API."
          />
        )}
      </div>
    </PageShell>
  );
}

