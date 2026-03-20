import React, { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import GlobalSearch from './GlobalSearch';
import styles from './Layout.module.css';

const MENU_ITEMS = [
  { to: '/', end: true, icon: '📊', label: 'Dashboard' },
  {
    label: 'Assets',
    icon: '🖥',
    children: [
      { to: '/endpoints', icon: '🖥', label: 'Endpoints' },
      { to: '/network', icon: '🌐', label: 'Network' },
    ],
  },
  {
    label: 'Events',
    icon: '◈',
    children: [
      { to: '/events', icon: '◈', label: 'Events' },
      { to: '/raw-events', icon: '📄', label: 'Raw Events' },
      { to: '/process-monitor', icon: '◉', label: 'Process Monitor' },
    ],
  },
  {
    label: 'Detection',
    icon: '⚠',
    children: [
      { to: '/alerts', icon: '⚠', label: 'Alerts' },
      { to: '/detection-rules', icon: '📜', label: 'Rules' },
    ],
  },
  {
    label: 'Response',
    icon: '🔍',
    children: [
      { to: '/investigations', icon: '🔍', label: 'Investigations' },
      { to: '/incidents', icon: '🔥', label: 'Incidents' },
      { to: '/triage', icon: '🔬', label: 'Triage' },
    ],
  },
  {
    label: 'Threat Intel',
    icon: '🎯',
    children: [
      { to: '/risk', icon: '📊', label: 'Risk' },
      { to: '/iocs', icon: '🎯', label: 'IOCs' },
    ],
  },
  {
    label: 'Configuration',
    icon: '⚙',
    children: [
      { to: '/policies', icon: '⚙', label: 'Policies' },
      { to: '/audit-logs', icon: '📋', label: 'Audit' },
    ],
  },
  {
    label: 'Antivirus',
    icon: '🛡',
    children: [
      { to: '/av', icon: '🛡', label: 'Overview' },
      { to: '/av/detections', icon: '📋', label: 'Detections' },
      { to: '/av/quarantine', icon: '📦', label: 'Quarantine' },
      { to: '/av/scan-tasks', icon: '🔍', label: 'Scan Tasks' },
      { to: '/av/policies', icon: '📜', label: 'Policies' },
      { to: '/av/signatures', icon: '✍', label: 'Signatures' },
      { to: '/av/malware-alerts', icon: '⚠', label: 'Malware Alerts' },
      { to: '/av/reputation', icon: '⭐', label: 'Reputation' },
    ],
  },
];

function NavMenuItem({ item }) {
  const location = useLocation();
  const paths = item.children?.map((c) => c.to) ?? [];
  const isActive = paths.some((p) => location.pathname === p || location.pathname.startsWith(p + '/'));
  const [expanded, setExpanded] = useState(isActive);

  useEffect(() => {
    if (isActive && !expanded) setExpanded(true);
  }, [isActive]);

  if (item.to) {
    return (
      <NavLink
        to={item.to}
        end={item.end}
        className={({ isActive: active }) => (active ? styles.navActive : '')}
      >
        <span className={styles.navIcon}>{item.icon}</span>
        {item.label}
      </NavLink>
    );
  }

  return (
    <div className={`${styles.navGroup} ${expanded ? styles.navGroupExpanded : ''}`}>
      <button
        type="button"
        className={`${styles.navGroupBtn} ${isActive ? styles.navGroupActive : ''}`}
        onClick={() => setExpanded((e) => !e)}
      >
        <span className={styles.navIcon}>{item.icon}</span>
        {item.label}
        <span className={styles.navChevron}>{expanded ? '▾' : '▸'}</span>
      </button>
      <div className={styles.navSubmenu}>
        {item.children.map((child) => (
          <NavLink
            key={child.to}
            to={child.to}
            end={child.to === '/av'}
            className={({ isActive: childActive }) =>
              `${styles.navSubItem} ${childActive ? styles.navActive : ''}`
            }
          >
            <span className={styles.navIcon}>{child.icon}</span>
            {child.label}
          </NavLink>
        ))}
      </div>
    </div>
  );
}

export default function Layout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className={styles.layout}>
      <aside className={styles.sidebar}>
        <div className={styles.logo}>
          <img src="/logo.svg" alt="IronShield EDR" className={styles.logoImg} />
          <span>IronShield EDR</span>
        </div>
        <nav className={styles.nav}>
          {MENU_ITEMS.map((item) => (
            <div key={item.label || item.to} className={styles.navItem}>
              <NavMenuItem item={item} />
            </div>
          ))}
        </nav>
        <div className={styles.user}>
          <span className={styles.userName}>{user?.username}</span>
          <span className={styles.userRole}>{user?.role}</span>
          <button onClick={handleLogout} className={styles.logout}>Logout</button>
        </div>
      </aside>
      <main className={styles.main}>
        <div className={styles.mainHeader}>
          <GlobalSearch />
        </div>
        <Outlet />
      </main>
    </div>
  );
}
