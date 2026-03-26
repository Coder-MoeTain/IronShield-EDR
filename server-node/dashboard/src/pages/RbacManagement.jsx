import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import FalconTableShell from '../components/FalconTableShell';
import { asJsonList } from '../utils/apiJson';
import styles from './RbacManagement.module.css';

function uniq(arr) {
  return Array.from(new Set((arr || []).filter(Boolean)));
}

export default function RbacManagement() {
  const { api, user, selectedTenantId } = useAuth();
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', isError: false });

  const [users, setUsers] = useState([]);
  const [roles, setRoles] = useState([]);

  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedScope, setSelectedScope] = useState('current'); // current | global
  const [userRoles, setUserRoles] = useState([]);
  const [saving, setSaving] = useState(false);

  const effectiveTenantId = useMemo(() => {
    if (selectedScope === 'global') return null;
    // For non-super-admin, req.tenantId is enforced server-side; for super_admin, current tenant is selectedTenantId.
    return user?.role === 'super_admin' ? selectedTenantId : 'server';
  }, [selectedScope, user?.role, selectedTenantId]);

  const fetchAll = useCallback(async () => {
    const [u, r] = await Promise.all([api('/api/admin/rbac/users').then(asJsonList), api('/api/admin/rbac/roles').then(asJsonList)]);
    setUsers(u);
    setRoles(r);
  }, [api]);

  const fetchRolesForUser = useCallback(
    async (uid) => {
      if (!uid) return;
      const r = await api(`/api/admin/rbac/users/${uid}/roles`);
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setUserRoles(Array.isArray(data) ? data : data.roles || []);
    },
    [api]
  );

  useEffect(() => {
    setLoading(true);
    fetchAll()
      .catch(() => {
        setUsers([]);
        setRoles([]);
      })
      .finally(() => setLoading(false));
  }, [fetchAll]);

  useEffect(() => {
    if (!selectedUserId && users.length > 0) setSelectedUserId(users[0].id);
  }, [users, selectedUserId]);

  useEffect(() => {
    setMsg({ text: '', isError: false });
    if (selectedUserId) {
      fetchRolesForUser(selectedUserId).catch((e) => setMsg({ text: 'Failed: ' + (e.message || 'Unknown error'), isError: true }));
    } else {
      setUserRoles([]);
    }
  }, [selectedUserId, fetchRolesForUser]);

  const displayedRoleNames = useMemo(() => roles.map((x) => x.name).filter(Boolean), [roles]);
  const assignedRoleNames = useMemo(() => uniq(userRoles.map((x) => x.role_name || x.name || x.role)), [userRoles]);

  const toggleRole = (name) => {
    setUserRoles((prev) => {
      const current = uniq(prev.map((x) => x.role_name || x.name || x.role));
      const next = current.includes(name) ? current.filter((n) => n !== name) : [...current, name];
      return next.map((n) => ({ role_name: n }));
    });
  };

  const save = async () => {
    if (!selectedUserId) return;
    setSaving(true);
    setMsg({ text: '', isError: false });
    try {
      const tenant_id =
        selectedScope === 'global' ? null : user?.role === 'super_admin' ? selectedTenantId : undefined;
      const role_names = uniq(userRoles.map((x) => x.role_name || x.name || x.role));
      const r = await api(`/api/admin/rbac/users/${selectedUserId}/roles`, {
        method: 'POST',
        body: JSON.stringify({ tenant_id, role_names }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.error || `HTTP ${r.status}`);
      setMsg({ text: 'Roles updated', isError: false });
      await fetchRolesForUser(selectedUserId);
    } catch (e) {
      setMsg({ text: 'Failed: ' + (e.message || 'Unknown error'), isError: true });
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageShell loading loadingLabel="Loading RBAC…" />;

  return (
    <PageShell
      kicker="Enterprise"
      title="RBAC"
      description="Manage admin users and role assignments. Server enforces tenant scope and permissions."
      actions={
        <div className={styles.actions}>
          <button type="button" className="falcon-btn" onClick={() => fetchAll().catch(() => {})}>
            Refresh
          </button>
          <button
            type="button"
            className="falcon-btn falcon-btn-primary"
            disabled={saving || !selectedUserId}
            onClick={save}
          >
            Save changes
          </button>
        </div>
      }
    >
      <div className={styles.container}>
        {msg.text && <div className={`${styles.msg} ${msg.isError ? styles.msgError : ''}`}>{msg.text}</div>}

        <div className={styles.grid}>
          <FalconTableShell
            toolbar={
              <div className={styles.toolbar}>
                <label className={styles.label}>
                  User
                  <select
                    className={styles.select}
                    value={selectedUserId ?? ''}
                    onChange={(e) => setSelectedUserId(e.target.value ? parseInt(e.target.value, 10) : null)}
                  >
                    {users.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.username} ({u.role || 'n/a'})
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.label}>
                  Scope
                  <select className={styles.select} value={selectedScope} onChange={(e) => setSelectedScope(e.target.value)}>
                    <option value="current">Current tenant</option>
                    <option value="global">Global</option>
                  </select>
                </label>

                <div className={styles.hint}>
                  Effective tenant: <span className="mono">{effectiveTenantId === null ? 'global' : String(effectiveTenantId)}</span>
                </div>
              </div>
            }
          >
            <div className={styles.rolesPanel}>
              <div className={styles.rolesHeader}>Roles</div>
              <div className={styles.rolesList}>
                {displayedRoleNames.map((name) => (
                  <label key={name} className={styles.roleItem}>
                    <input
                      type="checkbox"
                      checked={assignedRoleNames.includes(name)}
                      onChange={() => toggleRole(name)}
                    />
                    <span className={styles.roleName}>{name}</span>
                  </label>
                ))}
              </div>
              {displayedRoleNames.length === 0 && <div className={styles.empty}>No roles defined.</div>}
            </div>
          </FalconTableShell>

          <div className={styles.usersPanel}>
            <div className={styles.usersHeader}>Admin users</div>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th>Username</th>
                    <th>Email</th>
                    <th>Built-in role</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr
                      key={u.id}
                      className={u.id === selectedUserId ? styles.rowActive : ''}
                      onClick={() => setSelectedUserId(u.id)}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) => (e.key === 'Enter' ? setSelectedUserId(u.id) : null)}
                    >
                      <td className="mono">{u.username}</td>
                      <td>{u.email || '-'}</td>
                      <td className="mono">{u.role || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {users.length === 0 && <p className={styles.empty}>No admin users.</p>}
            </div>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

