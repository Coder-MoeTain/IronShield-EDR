import React from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import CommandPalette from './CommandPalette';
import RouteDocumentTitle from './RouteDocumentTitle';
import RouteAnnouncer from './RouteAnnouncer';
import SessionExpiryBanner from './SessionExpiryBanner';
import { RouteErrorBoundary } from './RouteErrorBoundary';
import TenantSwitcher from './TenantSwitcher';
import ThemeToggle from './ThemeToggle';
import MockModeBanner from './MockModeBanner';
import ConsoleModeToggle, { useConsoleUiMode } from './ConsoleModeToggle';
import { useProfessionalView } from './ProfessionalViewToggle';
import { IconShield, IconLogout, IconChevronLeft, NavIcon } from './NavIcons';
import styles from './Layout.module.css';
import { getConsoleNavItems } from '../utils/consoleNav';

const SIDEBAR_COLLAPSED_KEY = 'ironshield-sidebar-collapsed';

function readSidebarCollapsed() {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === '1';
  } catch {
    return false;
  }
}

function writeSidebarCollapsed(collapsed) {
  try {
    localStorage.setItem(SIDEBAR_COLLAPSED_KEY, collapsed ? '1' : '0');
  } catch {
    /* ignore */
  }
}

function NavLinkItem({ item, collapsed }) {
  return (
    <NavLink
      to={item.path}
      end={item.end}
      title={collapsed ? item.label : undefined}
      className={({ isActive }) => (isActive ? styles.navActive : '')}
    >
      {item.icon ? <NavIcon name={item.icon} className={styles.navIcon} /> : null}
      <span className={styles.navLabel}>{item.label}</span>
    </NavLink>
  );
}

export default function Layout() {
  const { user, logout, permissions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [professionalView] = useProfessionalView();
  const [uiMode] = useConsoleUiMode();
  const [collapsed, setCollapsed] = React.useState(readSidebarCollapsed);
  const navItems = getConsoleNavItems(user, permissions, uiMode);

  const overviewItem = navItems.find((item) => item.path === '/overview');
  const workspaceItems = navItems.filter((item) => item.path !== '/overview');

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev;
      writeSidebarCollapsed(next);
      return next;
    });
  };

  return (
    <div className={`${styles.layout} ${professionalView ? styles.layoutProfessional : ''}`}>
      <RouteDocumentTitle />
      <a href="#main-content" className="falcon-skip-link">
        Skip to main content
      </a>
      <aside
        className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ''}`}
        aria-label="Application navigation"
      >
        <div className={styles.logo}>
          <span className={styles.logoMark} aria-hidden>
            <IconShield />
          </span>
          {!collapsed ? (
            <div className={styles.logoText}>
              <span className={styles.logoTitle}>IronShield</span>
              <span className={styles.logoSub}>EDR / XDR</span>
            </div>
          ) : null}
          <button
            type="button"
            className={styles.collapseBtn}
            onClick={toggleCollapsed}
            aria-expanded={!collapsed}
            aria-label={collapsed ? 'Expand navigation' : 'Collapse navigation'}
            title={collapsed ? 'Expand navigation' : 'Collapse navigation'}
          >
            <IconChevronLeft />
          </button>
        </div>
        <nav className={styles.nav} aria-label="Primary">
          {overviewItem ? (
            <div className={styles.navDashboardTop}>
              <div className={styles.navItem}>
                <NavLinkItem item={overviewItem} collapsed={collapsed} />
              </div>
            </div>
          ) : null}
          {workspaceItems.length > 0 ? (
            <>
              {!collapsed ? <div className={styles.navSectionLabel}>Operations</div> : null}
              {workspaceItems.map((item) => (
                <div key={item.path} className={styles.navItem}>
                  <NavLinkItem item={item} collapsed={collapsed} />
                </div>
              ))}
            </>
          ) : null}
        </nav>
        <ConsoleModeToggle collapsed={collapsed} />
        <div className={styles.user}>
          {!collapsed ? (
            <>
              <span className={styles.userName}>{user?.username}</span>
              <span className={styles.userRole}>{user?.role}</span>
            </>
          ) : (
            <span className={styles.userAvatar} title={user?.username} aria-hidden>
              {(user?.username || '?').charAt(0).toUpperCase()}
            </span>
          )}
          <button
            type="button"
            onClick={handleLogout}
            className={styles.logout}
            title="Sign out"
          >
            <span className={styles.logoutIcon} aria-hidden>
              <IconLogout />
            </span>
            {!collapsed ? <span>Sign out</span> : null}
          </button>
        </div>
      </aside>
      <main id="main-content" className={styles.main} tabIndex={-1} aria-label="Workspace">
        <RouteAnnouncer />
        <div className={styles.mainHeader}>
          <TenantSwitcher />
          <CommandPalette />
          <ThemeToggle />
        </div>
        <SessionExpiryBanner />
        <MockModeBanner />
        <div className={styles.content} data-workspace>
          <RouteErrorBoundary key={location.pathname}>
            <Outlet />
          </RouteErrorBoundary>
        </div>
      </main>
    </div>
  );
}
