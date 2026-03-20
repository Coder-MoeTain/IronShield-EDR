import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './EndpointDetail.module.css';

function TreeNode({ node, depth = 0 }) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;

  return (
    <div style={{ marginLeft: depth * 16 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '4px 0',
          borderBottom: '1px solid #eee',
        }}
      >
        {hasChildren && (
          <button onClick={() => setExpanded(!expanded)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
            {expanded ? '▼' : '▶'}
          </button>
        )}
        {!hasChildren && <span style={{ width: 16 }} />}
        <span className="mono" style={{ fontWeight: 600 }}>{node.name || node.process_name || 'unknown'}</span>
        <span className="mono" style={{ fontSize: 12, color: '#666' }}>PID {node.pid || node.id}</span>
        {node.username && <span style={{ fontSize: 12 }}>({node.username})</span>}
      </div>
      {expanded && hasChildren && node.children.map((c) => (
        <TreeNode key={c.pid || c.id} node={c} depth={depth + 1} />
      ))}
    </div>
  );
}

export default function ProcessTree() {
  const { endpointId } = useParams();
  const { api } = useAuth();
  const [tree, setTree] = useState(null);
  const [loading, setLoading] = useState(true);
  const [since, setSince] = useState('');

  useEffect(() => {
    const params = since ? `?since=${encodeURIComponent(since)}` : '';
    api(`/api/admin/process-tree/${endpointId}${params}`)
      .then((r) => r.json())
      .then(setTree)
      .catch(() => setTree(null))
      .finally(() => setLoading(false));
  }, [endpointId, since]);

  if (loading) return <div className={styles.loading}>Loading...</div>;
  if (!tree) return <div className={styles.error}>Failed to load process tree</div>;

  return (
    <div>
      <div className={styles.header}>
        <Link to={`/endpoints/${endpointId}`} className={styles.back}>← Endpoint</Link>
        <h1 className={styles.title}>Process Tree</h1>
      </div>
      <div style={{ marginBottom: 16 }}>
        <label>Since (optional): </label>
        <input
          type="datetime-local"
          value={since}
          onChange={(e) => setSince(e.target.value)}
          style={{ marginRight: 8 }}
        />
      </div>
      <div className={styles.card}>
        <h3>Process Hierarchy</h3>
        {tree.roots?.length > 0 ? (
          tree.roots.map((r) => <TreeNode key={r.pid || r.id} node={r} />)
        ) : (
          <p>No process_create events found. Ensure events are being collected and normalized.</p>
        )}
      </div>
    </div>
  );
}
