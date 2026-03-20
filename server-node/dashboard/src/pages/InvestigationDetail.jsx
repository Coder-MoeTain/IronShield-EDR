import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './AlertDetail.module.css';

export default function InvestigationDetail() {
  const { id } = useParams();
  const { api } = useAuth();
  const [case_, setCase] = useState(null);
  const [notes, setNotes] = useState([]);
  const [note, setNote] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCase = () => api(`/api/admin/investigations/${id}`).then((r) => r.json());
    const fetchNotes = () => api(`/api/admin/investigations/${id}/notes`).then((r) => r.json());
    Promise.all([fetchCase(), fetchNotes()])
      .then(([c, n]) => {
        setCase(c);
        setNotes(n || []);
      })
      .catch(() => setCase(null))
      .finally(() => setLoading(false));
  }, [id]);

  const addNote = async () => {
    if (!note.trim()) return;
    await api(`/api/admin/investigations/${id}/notes`, {
      method: 'POST',
      body: JSON.stringify({ note: note.trim() }),
    });
    setNote('');
    const n = await api(`/api/admin/investigations/${id}/notes`).then((r) => r.json());
    setNotes(n || []);
  };

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!case_) return <div className={styles.error}>Investigation not found</div>;

  const severityClass = case_.severity === 'critical' ? styles.critical : case_.severity === 'high' ? styles.high : styles.medium;

  return (
    <div>
      <div className={styles.header}>
        <Link to="/investigations" className={styles.back}>← Investigations</Link>
        <h1 className={styles.title}>{case_.case_id} – {case_.title}</h1>
        <span className={`${styles.badge} ${severityClass}`}>{case_.severity}</span>
        <span className={styles.status}>{case_.status}</span>
      </div>
      <div className={styles.grid}>
        <div className={styles.card}>
          <h3>Details</h3>
          <dl>
            <dt>Endpoint</dt>
            <dd>{case_.hostname ? <Link to={`/endpoints/${case_.endpoint_id}`}>{case_.hostname}</Link> : '-'}</dd>
            <dt>Created By</dt>
            <dd>{case_.created_by}</dd>
            <dt>Assigned To</dt>
            <dd>{case_.assigned_to || '-'}</dd>
            <dt>Created</dt>
            <dd>{new Date(case_.created_at).toLocaleString()}</dd>
            <dt>Description</dt>
            <dd>{case_.description || '-'}</dd>
          </dl>
        </div>
        <div className={styles.card}>
          <h3>Case Notes</h3>
          <textarea placeholder="Add note..." value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          <button onClick={addNote}>Add Note</button>
          <ul style={{ marginTop: 12, listStyle: 'none', padding: 0 }}>
            {notes.map((n) => (
              <li key={n.id} style={{ padding: '8px 0', borderBottom: '1px solid #eee' }}>
                <strong>{n.author}</strong> {new Date(n.created_at).toLocaleString()}
                <p style={{ margin: '4px 0 0' }}>{n.note}</p>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
