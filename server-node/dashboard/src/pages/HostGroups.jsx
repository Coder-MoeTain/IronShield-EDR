import React, { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import styles from './Endpoints.module.css';

export default function HostGroups() {
  const { api } = useAuth();
  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');

  const load = () => {
    setLoading(true);
    api('/api/admin/host-groups')
      .then((r) => r.json())
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, [api]);

  const create = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;
    await api('/api/admin/host-groups', {
      method: 'POST',
      body: JSON.stringify({ name: name.trim(), description: description.trim() || null }),
    });
    setName('');
    setDescription('');
    load();
  };

  const remove = async (id) => {
    if (!window.confirm('Delete this host group? Endpoints will be unassigned.')) return;
    await api(`/api/admin/host-groups/${id}`, { method: 'DELETE' });
    load();
  };

  if (loading && groups.length === 0) {
    return <PageShell loading loadingLabel="Loading host groups…" />;
  }

  return (
    <PageShell
      kicker="Configuration"
      title="Host groups"
      description="Organize sensors into Falcon-style groups for filtering, reporting, and future policy scoping."
    >
      <form onSubmit={create} className={styles.pageHead} style={{ flexWrap: 'wrap', gap: '0.5rem' }}>
        <input
          placeholder="Group name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', minWidth: 200 }}
        />
        <input
          placeholder="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ padding: '0.5rem 0.75rem', flex: 1, minWidth: 200 }}
        />
        <button type="submit" className="falcon-btn falcon-btn-primary">
          Add group
        </button>
      </form>

      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Name</th>
              <th>Description</th>
              <th>Created</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {groups.map((g) => (
              <tr key={g.id}>
                <td className={styles.hostname}>{g.name}</td>
                <td>{g.description || '—'}</td>
                <td className="mono">{g.created_at ? new Date(g.created_at).toLocaleString() : '—'}</td>
                <td>
                  <button type="button" className={styles.deleteBtn} onClick={() => remove(g.id)}>
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {groups.length === 0 && <p className={styles.pageSub}>No host groups yet. Run DB migration if API errors: npm run migrate-cs-parity</p>}
      </div>
    </PageShell>
  );
}
