import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { useConfirm } from '../context/ConfirmContext';
import styles from './RunbookWorkflowPanel.module.css';

/**
 * SOAR-style: run ordered playbooks against the alert’s endpoint from the alert view.
 */
export default function RunbookWorkflowPanel({ endpointId, hostname }) {
  const { api } = useAuth();
  const { addToast } = useToast();
  const { confirm } = useConfirm();
  const [playbooks, setPlaybooks] = useState([]);
  const [running, setRunning] = useState(null);

  useEffect(() => {
    api('/api/admin/playbooks')
      .then((r) => r.json())
      .then((d) => setPlaybooks(Array.isArray(d) ? d : []))
      .catch(() => setPlaybooks([]));
  }, [api]);

  const runPlaybook = async (pb) => {
    if (!endpointId) {
      addToast({ variant: 'error', message: 'No endpoint linked to this alert.' });
      return;
    }
    if (
      !(await confirm({
        title: 'Run playbook',
        message: `Queue playbook “${pb.name}” on ${hostname || 'host'}? Response actions will execute on the agent.`,
        confirmLabel: 'Run',
        danger: false,
      }))
    )
      return;
    setRunning(pb.id);
    try {
      const r = await api(`/api/admin/playbooks/${pb.id}/run`, {
        method: 'POST',
        body: JSON.stringify({ endpoint_id: parseInt(String(endpointId), 10) }),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(j.error || `HTTP ${r.status}`);
      addToast({
        variant: 'success',
        message: `Queued ${(j.action_ids || []).length || 0} response action(s).`,
      });
    } catch (e) {
      addToast({ variant: 'error', message: e.message || 'Run failed' });
    } finally {
      setRunning(null);
    }
  };

  return (
    <section className={styles.panel} aria-labelledby="runbook-workflow-h">
      <h3 id="runbook-workflow-h" className={styles.heading}>
        Response playbooks
      </h3>
      <p className={styles.hint}>
        Run stored workflows (heartbeat, triage collection, etc.) on this host — same engine as{' '}
        <Link to="/triage?tab=playbooks">Triage → Playbooks</Link>.
      </p>
      {playbooks.length === 0 ? (
        <p className={styles.empty}>No playbooks defined yet.</p>
      ) : (
        <ul className={styles.list}>
          {playbooks.map((pb) => (
            <li key={pb.id} className={styles.item}>
              <div>
                <strong>{pb.name}</strong>
                {pb.description ? <span className={styles.desc}> — {pb.description}</span> : null}
              </div>
              <button
                type="button"
                className="falcon-btn falcon-btn-primary"
                disabled={running != null || !endpointId}
                onClick={() => runPlaybook(pb)}
              >
                {running === pb.id ? 'Queuing…' : 'Run on host'}
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
