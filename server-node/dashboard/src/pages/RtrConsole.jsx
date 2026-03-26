import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from '../components/PageShell';
import RtrHostPanel from '../components/RtrHostPanel';
import styles from './RtrConsole.module.css';

export default function RtrConsole() {
  const { api } = useAuth();
  const [endpoints, setEndpoints] = useState([]);

  useEffect(() => {
    api('/api/admin/endpoints?limit=200')
      .then((r) => r.json())
      .then((d) => setEndpoints(Array.isArray(d) ? d : []))
      .catch(() => setEndpoints([]));
  }, [api]);

  return (
    <PageShell
      kicker="Respond"
      title="Real Time Response (RTR)"
      description="Allowlisted remote shell — not full CrowdStrike RTR. Commands: whoami, hostname, ipconfig, ver, systeminfo, netstat, route, arp, getmac, echo."
      actions={
        <Link to="/policies" className="falcon-btn falcon-btn-ghost">
          Policies → allow rtr_shell
        </Link>
      }
    >
      <RtrHostPanel showHostPicker endpoints={endpoints} endpointId="" />
      <p className={styles.muted} style={{ marginTop: '1rem' }}>
        Tip: open a host from <Link to="/endpoints">Endpoints</Link> for RTR pre-scoped to that machine.
      </p>
    </PageShell>
  );
}
