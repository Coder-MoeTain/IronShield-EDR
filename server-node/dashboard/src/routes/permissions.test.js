import { describe, it, expect } from 'vitest';
import {
  canAccessAdminShell,
  canAccessResponseRoute,
  canRunResponseActions,
  canAccessAuditTab,
  canAccessIntegrationsTab,
  canAccessRbacTab,
  canAccessReportsTab,
  canViewReports,
  canCreateReports,
  canExportReports,
  canDeleteReports,
  canAccessSettingsTab,
  canAccessSystemHealthTab,
  canAccessTenantsTab,
  canAccessUsersTab,
  canSeeTenantSwitcher,
} from './permissions';

describe('route permissions', () => {
  it('viewer cannot see response actions', () => {
    expect(canAccessResponseRoute({ role: 'viewer' }, [])).toBe(false);
    expect(canRunResponseActions({ role: 'viewer' }, [])).toBe(false);
  });

  it('viewer can view reports but not create or export', () => {
    expect(canAccessAdminShell({ role: 'viewer' })).toBe(true);
    expect(canViewReports({ role: 'viewer' }, [])).toBe(true);
    expect(canAccessReportsTab({ role: 'viewer' }, [])).toBe(true);
    expect(canCreateReports({ role: 'viewer' }, [])).toBe(false);
    expect(canExportReports({ role: 'viewer' }, [])).toBe(false);
    expect(canAccessTenantsTab({ role: 'viewer' })).toBe(false);
    expect(canAccessSettingsTab({ role: 'viewer' })).toBe(false);
  });

  it('auditor can view reports and audit but not modify admin', () => {
    expect(canAccessAdminShell({ role: 'auditor' })).toBe(true);
    expect(canViewReports({ role: 'auditor' }, ['report:view'])).toBe(true);
    expect(canAccessReportsTab({ role: 'auditor' }, [])).toBe(true);
    expect(canCreateReports({ role: 'auditor' }, [])).toBe(false);
    expect(canDeleteReports({ role: 'auditor' }, [])).toBe(false);
    expect(canAccessTenantsTab({ role: 'auditor' })).toBe(false);
    expect(canAccessRbacTab({ role: 'auditor' })).toBe(false);
    expect(canAccessSettingsTab({ role: 'auditor' })).toBe(false);
    expect(canAccessIntegrationsTab({ role: 'auditor' })).toBe(false);
    expect(canAccessResponseRoute({ role: 'auditor' }, ['audit:view'])).toBe(false);
  });

  it('analyst cannot manage tenants, RBAC, or settings', () => {
    expect(canAccessAdminShell({ role: 'analyst' })).toBe(true);
    expect(canAccessTenantsTab({ role: 'analyst' })).toBe(false);
    expect(canAccessRbacTab({ role: 'analyst' })).toBe(false);
    expect(canAccessSettingsTab({ role: 'analyst' })).toBe(false);
    expect(canViewReports({ role: 'analyst' }, [])).toBe(true);
  });

  it('tenant_admin cannot use tenant switcher or global RBAC', () => {
    expect(canAccessAdminShell({ role: 'tenant_admin' })).toBe(true);
    expect(canAccessTenantsTab({ role: 'tenant_admin' })).toBe(false);
    expect(canAccessRbacTab({ role: 'tenant_admin' })).toBe(false);
    expect(canAccessUsersTab({ role: 'tenant_admin' })).toBe(true);
    expect(canSeeTenantSwitcher({ role: 'tenant_admin' })).toBe(false);
  });

  it('super_admin has full admin tabs', () => {
    const user = { role: 'super_admin' };
    expect(canAccessTenantsTab(user)).toBe(true);
    expect(canAccessRbacTab(user)).toBe(true);
    expect(canAccessSettingsTab(user)).toBe(true);
    expect(canViewReports(user, ['*'])).toBe(true);
    expect(canDeleteReports(user, ['*'])).toBe(true);
    expect(canSeeTenantSwitcher(user)).toBe(true);
  });
});
