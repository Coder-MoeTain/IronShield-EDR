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
import { IconShield } from './NavIcons';
import styles from './Layout.module.css';
import { getConsoleNavItems } from '../utils/consoleNav';

export default function Layout() {
  const { user, logout, permissions } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [professionalView] = useProfessionalView();
  const [uiMode] = useConsoleUiMode();
  const navItems = getConsoleNavItems(user, permissions, uiMode);

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
            <span className={styles.logoSub}>EDR / XDR</span>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Primary">
          {navItems.map((item) => (
            <div key={item.path} className={styles.navItem}>
              <NavLink
                to={item.path}
                end={item.end}
                className={({ isActive }) => (isActive ? styles.navActive : '')}
              >
                {item.label}
              </NavLink>
            </div>
          ))}
        </nav>
        <ConsoleModeToggle />
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
