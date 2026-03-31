import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import PageShell from './PageShell';

/**
 * Block enterprise-only routes at the UI layer (API RBAC remains authoritative).
 */
export default function SocRouteGuard({ children, allow }) {
  const { user } = useAuth();
  if (allow(user)) return children;
  return (
    <PageShell
      kicker="Access"
      title="Not available"
      description="Your role does not include this area. Contact an administrator if you need access."
    >
      <Link to="/" className="falcon-btn falcon-btn-primary" style={{ marginTop: '0.75rem', display: 'inline-block' }}>
        Back to dashboard
      </Link>
    </PageShell>
  );
}
