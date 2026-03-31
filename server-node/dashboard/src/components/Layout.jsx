import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlobalSearch from './GlobalSearch';
import RouteDocumentTitle from './RouteDocumentTitle';
import RouteAnnouncer from './RouteAnnouncer';
import SessionExpiryBanner from './SessionExpiryBanner';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import TenantSwitcher from './TenantSwitcher';
import ThemeToggle from './ThemeToggle';
import { useProfessionalView } from './ProfessionalViewToggle';
import {
  IconActivity,
  IconDetections,
  IconHosts,
  IconExplore,
  IconRules,
  IconRespond,
  IconConfig,
  IconShield,
  IconTerminal,
  IconNetwork,
  IconIntel,
  IconGraph,
  IconEnterprise,
} from './NavIcons';
import styles from './Layout.module.css';
import { filterEnterpriseNavChildren } from '../utils/socRoles';

const MENU_ITEMS = [
  { to: '/alerts', Icon: IconDetections, label: 'Alerts' },
  {
    label: 'Endpoints',
    Icon: IconHosts,
    children: [
      { to: '/endpoints', Icon: IconHosts, label: 'All endpoints' },
      { to: '/host-groups', Icon: IconHosts, label: 'Host groups' },
      { to: '/sensor-health', Icon: IconHosts, label: 'Sensor health' },
      { to: '/network', Icon: IconNetwork, label: 'Network' },
      { to: '/hunting', Icon: IconExplore, label: 'Hunting' },
    ],
  },
  {
    label: 'Events',
    Icon: IconExplore,
    children: [
      { to: '/events', Icon: IconExplore, label: 'Events' },
      { to: '/normalized-events', Icon: IconExplore, label: 'Normalized' },
      { to: '/raw-events', Icon: IconExplore, label: 'Raw' },
      { to: '/process-monitor', Icon: IconExplore, label: 'Process monitor' },
    ],
  },
  {
    label: 'Analytics',
    Icon: IconGraph,
    children: [
      { to: '/analytics-detections', Icon: IconGraph, label: 'Detection analytics' },
      { to: '/threat-graph', Icon: IconGraph, label: 'Threat graph' },
      { to: '/agent-network-map', Icon: IconNetwork, label: 'Agent network map' },
    ],
  },
  {
    label: 'XDR',
    Icon: IconExplore,
    children: [
      { to: '/xdr', Icon: IconExplore, label: 'Overview' },
      { to: '/xdr/events', Icon: IconExplore, label: 'XDR events' },
      { to: '/xdr/detections', Icon: IconDetections, label: 'XDR detections' },
      { to: '/xdr/realtime', Icon: IconActivity, label: 'Live stream' },
    ],
  },
  {
    label: 'Rules',
    Icon: IconRules,
    children: [{ to: '/detection-rules', Icon: IconRules, label: 'Detection rules' }],
  },
  {
    label: 'Threat Intel',
    Icon: IconIntel,
    children: [
      { to: '/risk', Icon: IconIntel, label: 'Risk' },
      { to: '/iocs', Icon: IconIntel, label: 'IOCs' },
      { to: '/web-url-protection', Icon: IconShield, label: 'Web URL protection' },
    ],
  },
  {
    label: 'Respond',
    Icon: IconRespond,
    children: [
      { to: '/investigations', Icon: IconRespond, label: 'Investigations' },
      { to: '/incidents', Icon: IconRespond, label: 'Incidents' },
      { to: '/triage', Icon: IconRespond, label: 'Triage' },
      { to: '/respond/approvals', Icon: IconRespond, label: 'Approvals' },
      { to: '/rtr', Icon: IconTerminal, label: 'RTR' },
    ],
  },
  {
    label: 'Configuration',
    Icon: IconConfig,
    children: [
      { to: '/policies', Icon: IconConfig, label: 'Policies' },
      { to: '/audit-logs', Icon: IconConfig, label: 'Audit logs' },
      { to: '/protection', Icon: IconShield, label: 'Protection capabilities' },
    ],
  },
  {
    label: 'Enterprise',
    Icon: IconEnterprise,
    children: [
      { to: '/enterprise', Icon: IconEnterprise, label: 'Settings' },
      { to: '/tenants', Icon: IconEnterprise, label: 'Tenants' },
      { to: '/mssp', Icon: IconEnterprise, label: 'MSSP console' },
      { to: '/rbac', Icon: IconConfig, label: 'RBAC' },
    ],
  },
  {
    label: 'Antivirus',
    Icon: IconShield,
    children: [
      { to: '/av', Icon: IconShield, label: 'Overview' },
      { to: '/av/detections', Icon: IconShield, label: 'Detections' },
      { to: '/av/quarantine', Icon: IconShield, label: 'Quarantine' },
      { to: '/av/scan-tasks', Icon: IconShield, label: 'Scan tasks' },
      { to: '/av/policies', Icon: IconShield, label: 'Policies' },
      { to: '/av/signatures', Icon: IconShield, label: 'Signatures' },
      { to: '/av/malware-alerts', Icon: IconShield, label: 'Malware alerts' },
      { to: '/av/reputation', Icon: IconShield, label: 'File reputation' },
    ],
  },
];

function NavMenuItem({ item, user }) {
  const location = useLocation();
  const children =
    item.label === 'Enterprise' && item.children ? filterEnterpriseNavChildren(item.children, user) : item.children;

  const paths = children?.map((c) => c.to) ?? [];
  const isActive = paths.some((p) => location.pathname === p || location.pathname.startsWith(`${p}/`));
  const [expanded, setExpanded] = useState(isActive);
  const GroupIcon = item.Icon;

  useEffect(() => {
    if (isActive && !expanded) setExpanded(true);
  }, [isActive]);

  if (item.to) {
    const ItemIcon = item.Icon;
    return (
      <div className={styles.navItem}>
        <NavLink
          to={item.to}
          end={item.end}
          className={({ isActive: active }) => (active ? styles.navActive : '')}
        >
          <span className={styles.navIcon}>{ItemIcon ? <ItemIcon /> : null}</span>
          {item.label}
        </NavLink>
      </div>
    );
  }

  if (!children || children.length === 0) {
    return null;
  }

  return (
    <div className={styles.navItem}>
    <div className={`${styles.navGroup} ${expanded ? styles.navGroupExpanded : ''}`}>
      <button
        type="button"
        className={`${styles.navGroupBtn} ${isActive ? styles.navGroupActive : ''}`}
        onClick={() => setExpanded((e) => !e)}
      >
        <span className={styles.navIcon}>{GroupIcon ? <GroupIcon /> : null}</span>
        {item.label}
        <span className={styles.navChevron}>{expanded ? '▾' : '▸'}</span>
      </button>
      <div className={styles.navSubmenu}>
        {children.map((child) => {
          const ChildIcon = child.Icon;
          return (
            <NavLink
              key={child.to}
              to={child.to}
              end={child.to === '/av' || child.to === '/protection' || child.to === '/xdr'}
              className={({ isActive: childActive }) =>
                `${styles.navSubItem} ${childActive ? styles.navActive : ''}`
              }
            >
              <span className={styles.navIcon}>{ChildIcon ? <ChildIcon /> : null}</span>
              {child.label}
            </NavLink>
          );
        })}
      </div>
    </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [professionalView] = useProfessionalView();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={`${styles.layout} ${professionalView ? styles.layoutProfessional : ''}`}>
      <RouteDocumentTitle />
      <a href="#main-content" className="falcon-skip-link">
        Skip to main content
      </a>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark} aria-hidden>
            <IconShield />
          </span>
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>IronShield</span>
            <span className={styles.logoSub}>Full EDR</span>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Primary">
          <div className={styles.navDashboardTop}>
            <NavLink
              to="/"
              end
              className={({ isActive }) => (isActive ? styles.navActive : '')}
            >
              <span className={styles.navIcon}>
                <IconActivity />
              </span>
              Dashboard
            </NavLink>
          </div>
          {MENU_ITEMS.map((item) => (
            <NavMenuItem key={item.label || item.to} item={item} user={user} />
          ))}
        </nav>
        <div className={styles.user}>
          <span className={styles.userName}>{user?.username}</span>
          <span className={styles.userRole}>{user?.role}</span>
          <button type="button" onClick={handleLogout} className={styles.logout}>
            Sign out
          </button>
        </div>
      </aside>
      <main id="main-content" className={styles.main} tabIndex={-1} aria-label="Workspace">
        <RouteAnnouncer />
        <div className={styles.mainHeader}>
          <TenantSwitcher />
          <GlobalSearch />
          <ThemeToggle />
        </div>
        <SessionExpiryBanner />
        <div className={styles.content} data-workspace>
          <RouteErrorBoundary key={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </div>
      </main>
    </div>
  );
}
