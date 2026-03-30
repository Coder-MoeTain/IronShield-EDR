import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlobalSearch from './GlobalSearch';
import Breadcrumbs from './Breadcrumbs';
import RouteDocumentTitle from './RouteDocumentTitle';
import RouteAnnouncer from './RouteAnnouncer';
import SessionExpiryBanner from './SessionExpiryBanner';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import KeyboardShortcutsHelp from './KeyboardShortcutsHelp';
import TenantSwitcher from './TenantSwitcher';
import ThemeToggle from './ThemeToggle';
import ProfessionalViewToggle, { useProfessionalView } from './ProfessionalViewToggle';
import {
  IconActivity,
  IconDetections,
  IconHosts,
  IconNetwork,
  IconExplore,
  IconRules,
  IconRespond,
  IconIntel,
  IconConfig,
  IconEnterprise,
  IconShield,
  IconTerminal,
  IconGraph,
} from './NavIcons';
import styles from './Layout.module.css';
import { filterEnterpriseNavChildren } from '../utils/socRoles';

/** Falcon-style IA: activity-first, detections, hosts, explore, respond, intel. */
const MENU_ITEMS = [
  { to: '/', end: true, Icon: IconActivity, label: 'Activity' },
  { to: '/alerts', Icon: IconDetections, label: 'Detections' },
  {
    label: 'Hosts',
    Icon: IconHosts,
    children: [
      { to: '/endpoints', Icon: IconHosts, label: 'All hosts' },
      { to: '/sensor-health', Icon: IconHosts, label: 'Sensor health' },
      { to: '/host-groups', Icon: IconHosts, label: 'Host groups' },
      { to: '/network', Icon: IconNetwork, label: 'Network activity' },
    ],
  },
  {
    label: 'Explore',
    Icon: IconExplore,
    children: [
      { to: '/events', Icon: IconExplore, label: 'Events' },
      { to: '/normalized-events', Icon: IconExplore, label: 'Normalized events' },
      { to: '/raw-events', Icon: IconExplore, label: 'Raw events' },
      { to: '/process-monitor', Icon: IconExplore, label: 'Process monitor' },
      { to: '/hunting', Icon: IconExplore, label: 'Hunting' },
      { to: '/xdr/events', Icon: IconExplore, label: 'XDR events' },
      { to: '/xdr/detections', Icon: IconExplore, label: 'XDR detections' },
      { to: '/xdr/realtime', Icon: IconActivity, label: 'XDR realtime' },
    ],
  },
  {
    label: 'Detection',
    Icon: IconRules,
    children: [{ to: '/detection-rules', Icon: IconRules, label: 'Custom IOA rules' }],
  },
  {
    label: 'Respond',
    Icon: IconRespond,
    children: [
      { to: '/investigations', Icon: IconRespond, label: 'Investigations' },
      { to: '/incidents', Icon: IconRespond, label: 'Incidents' },
      { to: '/triage', Icon: IconRespond, label: 'Triage' },
      { to: '/respond/approvals', Icon: IconRespond, label: 'Approvals' },
      { to: '/rtr', Icon: IconTerminal, label: 'Real Time Response' },
    ],
  },
  {
    label: 'Advanced',
    Icon: IconGraph,
    children: [
      { to: '/threat-graph', Icon: IconGraph, label: 'Threat graph' },
      { to: '/agent-network-map', Icon: IconNetwork, label: 'Agent network map' },
      { to: '/analytics-detections', Icon: IconExplore, label: 'Detection analytics' },
      { to: '/falcon/identity', Icon: IconIntel, label: 'Identity / Zero Trust' },
      { to: '/falcon/exposure', Icon: IconNetwork, label: 'Exposure / attack surface' },
      { to: '/falcon/managed-hunting', Icon: IconExplore, label: 'Managed hunting / Overwatch' },
      { to: '/falcon/prevention-deep', Icon: IconShield, label: 'Deep prevention' },
      { to: '/falcon/integrations', Icon: IconEnterprise, label: 'Integrations / XDR fabric' },
    ],
  },
  {
    label: 'Intel',
    Icon: IconIntel,
    children: [
      { to: '/risk', Icon: IconIntel, label: 'Endpoint risk' },
      { to: '/web-url-protection', Icon: IconIntel, label: 'Web & URL' },
      { to: '/iocs', Icon: IconIntel, label: 'IOC watchlist' },
    ],
  },
  {
    label: 'Configuration',
    Icon: IconConfig,
    children: [
      { to: '/policies', Icon: IconConfig, label: 'Policies' },
      { to: '/audit-logs', Icon: IconConfig, label: 'Audit & activity' },
    ],
  },
  {
    label: 'Enterprise',
    Icon: IconEnterprise,
    children: [
      { to: '/mssp', Icon: IconEnterprise, label: 'MSSP operations' },
      { to: '/enterprise', Icon: IconEnterprise, label: 'Settings' },
      { to: '/tenants', Icon: IconEnterprise, label: 'Tenants' },
      { to: '/rbac', Icon: IconEnterprise, label: 'RBAC' },
    ],
  },
  {
    label: 'Next-gen AV',
    Icon: IconShield,
    children: [
      { to: '/protection', Icon: IconShield, label: 'Protection features' },
      { to: '/av', Icon: IconShield, label: 'Overview' },
      { to: '/av/detections', Icon: IconShield, label: 'Malware detections' },
      { to: '/av/quarantine', Icon: IconShield, label: 'Quarantine' },
      { to: '/av/scan-tasks', Icon: IconShield, label: 'Scan tasks' },
      { to: '/av/policies', Icon: IconShield, label: 'AV policies' },
      { to: '/av/signatures', Icon: IconShield, label: 'Signatures' },
      { to: '/av/malware-alerts', Icon: IconShield, label: 'Malware alerts' },
      { to: '/av/reputation', Icon: IconShield, label: 'Reputation' },
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
  const [professionalView, setProfessionalView] = useProfessionalView();

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
            <span className={styles.logoSub}>Security operations center</span>
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
          <KeyboardShortcutsHelp />
          <ProfessionalViewToggle professionalView={professionalView} onToggle={setProfessionalView} />
          <ThemeToggle />
        </div>
        <SessionExpiryBanner />
        <div className={styles.content} data-workspace>
          <Breadcrumbs />
          <RouteErrorBoundary key={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </div>
      </main>
    </div>
  );
}
