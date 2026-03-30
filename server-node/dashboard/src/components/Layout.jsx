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
} from './NavIcons';
import styles from './Layout.module.css';
import { filterEnterpriseNavChildren } from '../utils/socRoles';

const MENU_ITEMS = [
  { to: '/', end: true, Icon: IconActivity, label: 'Dashboard' },
  { to: '/alerts', Icon: IconDetections, label: 'Alerts' },
  {
    label: 'Endpoints',
    Icon: IconHosts,
    children: [
      { to: '/endpoints', Icon: IconHosts, label: 'All endpoints' },
      { to: '/host-groups', Icon: IconHosts, label: 'Host groups' },
      { to: '/sensor-health', Icon: IconHosts, label: 'Sensor health' },
    ],
  },
  {
    label: 'Events',
    Icon: IconExplore,
    children: [
      { to: '/events', Icon: IconExplore, label: 'Events' },
      { to: '/normalized-events', Icon: IconExplore, label: 'Normalized' },
      { to: '/raw-events', Icon: IconExplore, label: 'Raw' },
      { to: '/process-monitor', Icon: IconExplore, label: 'Process' },
    ],
  },
  {
    label: 'Rules',
    Icon: IconRules,
    children: [{ to: '/detection-rules', Icon: IconRules, label: 'Detection rules' }],
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
    ],
  },
  {
    label: 'Antivirus',
    Icon: IconShield,
    children: [
      { to: '/av', Icon: IconShield, label: 'Overview' },
      { to: '/av/detections', Icon: IconShield, label: 'Detections' },
      { to: '/av/quarantine', Icon: IconShield, label: 'Quarantine' },
      { to: '/av/policies', Icon: IconShield, label: 'Policies' },
      { to: '/av/signatures', Icon: IconShield, label: 'Signatures' },
    ],
  },
];

function NavMenuItem({ item, user }) {
  const location = useLocation();
  const children =
    item.label === 'Enterprise' && item.children ? filterEnterpriseNavChildren(item.children, user) : item.children;
  if (item.label === 'Enterprise' && (!children || children.length === 0)) {
    return null;
  }
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
              end={child.to === '/av' || child.to === '/protection'}
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
      {!professionalView && (
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <span className={styles.logoMark} aria-hidden>
            <IconShield />
          </span>
          <div className={styles.logoText}>
            <span className={styles.logoTitle}>IronShield</span>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Primary">
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
      )}
      <main id="main-content" className={styles.main} tabIndex={-1} aria-label="Workspace">
        <RouteAnnouncer />
        <div className={styles.mainHeader}>
          <TenantSwitcher />
          {professionalView && (
            <nav className={styles.proQuickNav} aria-label="Quick navigation">
              <NavLink
                to="/"
                end
                className={({ isActive }) => `${styles.proQuickLink} ${isActive ? styles.proQuickLinkActive : ''}`}
              >
                Activity
              </NavLink>
              <NavLink
                to="/alerts"
                className={({ isActive }) => `${styles.proQuickLink} ${isActive ? styles.proQuickLinkActive : ''}`}
              >
                Detections
              </NavLink>
              <NavLink
                to="/endpoints"
                className={({ isActive }) => `${styles.proQuickLink} ${isActive ? styles.proQuickLinkActive : ''}`}
              >
                Hosts
              </NavLink>
              <NavLink
                to="/events"
                className={({ isActive }) => `${styles.proQuickLink} ${isActive ? styles.proQuickLinkActive : ''}`}
              >
                Events
              </NavLink>
            </nav>
          )}
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
