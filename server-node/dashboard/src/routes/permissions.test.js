import { describe, it, expect } from 'vitest';
import {
  canAccessAdminShell,
  canAccessResponseRoute,
  canRunResponseActions,
  canAccessAuditTab,
  canAccessIntegrationsTab,
  canAccessRbacTab,
  canAccessReportsTab,
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

  it('viewer can open admin shell but not dangerous tabs', () => {
    expect(canAccessAdminShell({ role: 'viewer' })).toBe(true);
    expect(canAccessAuditTab({ role: 'viewer' })).toBe(true);
    expect(canAccessSystemHealthTab({ role: 'viewer' })).toBe(true);
    expect(canAccessTenantsTab({ role: 'viewer' })).toBe(false);
    expect(canAccessRbacTab({ role: 'viewer' })).toBe(false);
    expect(canAccessUsersTab({ role: 'viewer' })).toBe(false);
    expect(canAccessSettingsTab({ role: 'viewer' })).toBe(false);
    expect(canAccessIntegrationsTab({ role: 'viewer' })).toBe(false);
    expect(canAccessReportsTab({ role: 'viewer' })).toBe(false);
  });

  it('auditor can access audit and system health only among write tabs', () => {
    expect(canAccessAdminShell({ role: 'auditor' })).toBe(true);
    expect(canAccessAuditTab({ role: 'auditor' })).toBe(true);
    expect(canAccessSystemHealthTab({ role: 'auditor' })).toBe(true);
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
    expect(canAccessReportsTab({ role: 'analyst' })).toBe(true);
    expect(canAccessIntegrationsTab({ role: 'analyst' })).toBe(true);
  });

  it('tenant_admin can access tenants context but not global RBAC', () => {
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
    expect(canAccessReportsTab(user)).toBe(true);
    expect(canAccessIntegrationsTab(user)).toBe(true);
    expect(canSeeTenantSwitcher(user)).toBe(true);
  });
});
