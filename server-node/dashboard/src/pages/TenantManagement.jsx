import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useConfirm } from '../context/ConfirmContext';
import PageShell from '../components/PageShell';
import styles from './TenantManagement.module.css';

export default function TenantManagement() {
  const { api, user, setSelectedTenantId } = useAuth();
  const navigate = useNavigate();
  const [tenants, setTenants] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', isError: false });
  const [modal, setModal] = useState(null);
  const [editing, setEditing] = useState(null);

  const fetchTenants = () =>
    api('/api/admin/tenants')
      .then((r) => r.json())
      .then(setTenants)
      .catch(() => setTenants([]));

  useEffect(() => {
    setLoading(true);
    fetchTenants().finally(() => setLoading(false));
  }, []);

  const createTenant = async (name, slug) => {
    setMsg({ text: '', isError: false });
    try {
      const r = await api('/api/admin/tenants', {
        method: 'POST',
        body: JSON.stringify({ name, slug: slug || name.toLowerCase().replace(/\s+/g, '-') }),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      setMsg({ text: 'Tenant created', isError: false });
      setModal(null);
      fetchTenants();
    } catch (e) {
      setMsg({ text: 'Failed: ' + (e.message || 'Unknown error'), isError: true });
    }
  };

  const updateTenant = async (id, data) => {
    setMsg({ text: '', isError: false });
    try {
      const r = await api(`/api/admin/tenants/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(data),
      });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      setMsg({ text: 'Tenant updated', isError: false });
      setEditing(null);
      fetchTenants();
    } catch (e) {
      setMsg({ text: 'Failed: ' + (e.message || 'Unknown error'), isError: true });
    }
  };

  const deleteTenant = async (id) => {
    if (
      !(await confirm({
        title: 'Delete tenant',
        message: 'Delete this tenant? Endpoints and data may be affected.',
        danger: true,
        confirmLabel: 'Delete',
      }))
    )
      return;
    setMsg({ text: '', isError: false });
    try {
      const r = await api(`/api/admin/tenants/${id}`, { method: 'DELETE' });
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || `HTTP ${r.status}`);
      setMsg({ text: 'Tenant deleted', isError: false });
      fetchTenants();
    } catch (e) {
      setMsg({ text: 'Failed: ' + (e.message || 'Unknown error'), isError: true });
    }
  };

  const canManage = user?.role === 'super_admin';

  if (loading && tenants.length === 0) {
    return <PageShell loading loadingLabel="Loading tenants…" />;
  }

  return (
    <PageShell
      kicker="Enterprise"
      title="Tenant management"
      description="Multi-tenant scope, endpoint counts, and admin actions (super admin)."
      actions={
        canManage ? (
          <button
            type="button"
            className="falcon-btn falcon-btn-primary"
            onClick={() => setModal({ type: 'create' })}
          >
            + Add tenant
          </button>
        ) : null
      }
    >
    <div className={styles.container}>
      {msg.text && (
        <div className={`${styles.msg} ${msg.isError ? styles.msgError : ''}`}>{msg.text}</div>
      )}

      <div className={styles.section}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Name</th>
                <th>Slug</th>
                <th>Endpoints</th>
                <th>Status</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {tenants.map((t) => (
                <tr key={t.id}>
                  <td>{editing?.id === t.id ? (
                    <input
                      className={styles.input}
                      value={editing.name}
                      onChange={(e) => setEditing((x) => ({ ...x, name: e.target.value }))}
                    />
                  ) : (
                    t.name
                  )}</td>
                  <td className={styles.mono}>
                    {editing?.id === t.id ? (
                      <input
                        className={styles.input}
                        value={editing.slug}
                        onChange={(e) => setEditing((x) => ({ ...x, slug: e.target.value }))}
                      />
                    ) : (
                      t.slug
                    )}
                  </td>
                  <td>
                    <button
                      type="button"
                      className={styles.linkBtn}
                      onClick={() => {
                        if (user?.role === 'super_admin') setSelectedTenantId(t.id);
                        navigate('/endpoints');
                      }}
                    >
                      {t.endpoint_count ?? 0}
                    </button>
                  </td>
                  <td>
                    <span className={`${styles.badge} ${t.is_active ? styles.badgeActive : styles.badgeInactive}`}>
                      {t.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  {canManage && (
                    <td>
                      {editing?.id === t.id ? (
                        <>
                          <button
                            type="button"
                            className={styles.btnSmall}
                            onClick={() => updateTenant(t.id, { name: editing.name, slug: editing.slug })}
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            className={styles.btnSmallSecondary}
                            onClick={() => setEditing(null)}
                          >
                            Cancel
                          </button>
                        </>
                      ) : (
                        <>
                          <button
                            type="button"
                            className={styles.btnSmall}
                            onClick={() => setEditing({ id: t.id, name: t.name, slug: t.slug })}
                          >
                            Edit
                          </button>
                          {t.id !== 1 && (
                            <button
                              type="button"
                              className={styles.btnSmallDanger}
                              onClick={() => deleteTenant(t.id)}
                            >
                              Delete
                            </button>
                          )}
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {tenants.length === 0 && (
            <div className={styles.empty}>
              No tenants. Run schema-phase5.sql and migrate-phase6.js. {canManage && 'Add a tenant to get started.'}
            </div>
          )}
        </div>
      </div>

      {modal?.type === 'create' && (
        <div className={styles.modalOverlay} onClick={() => setModal(null)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <h3>Add Tenant</h3>
            <CreateTenantForm
              onClose={() => setModal(null)}
              onSubmit={(name, slug) => createTenant(name, slug)}
            />
          </div>
        </div>
      )}
    </div>
    </PageShell>
  );
}

function CreateTenantForm({ onClose, onSubmit }) {
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit(name, slug || name.toLowerCase().replace(/\s+/g, '-'));
  };

  const handleNameChange = (v) => {
    setName(v);
    if (!slug) setSlug(v.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, ''));
  };

  return (
    <form onSubmit={handleSubmit} className={styles.modalForm}>
      <label>
        Name
        <input
          className={styles.input}
          value={name}
          onChange={(e) => handleNameChange(e.target.value)}
          placeholder="e.g. Acme Corp"
          required
        />
      </label>
      <label>
        Slug
        <input
          className={styles.input}
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="e.g. acme-corp"
        />
      </label>
      <div className={styles.modalActions}>
        <button type="button" className={styles.btnSecondary} onClick={onClose}>
          Cancel
        </button>
        <button type="submit" className={styles.btnPrimary}>
          Create
        </button>
      </div>
    </form>
  );
}
