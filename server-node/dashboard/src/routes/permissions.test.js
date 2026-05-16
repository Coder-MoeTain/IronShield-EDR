import { describe, it, expect } from 'vitest';
import {
  canAccessAdminRoute,
  canAccessResponseRoute,
  canRunResponseActions,
  canSeeRbac,
  canSeeTenantSwitcher,
} from './permissions';

describe('route permissions', () => {
  it('viewer cannot see response actions', () => {
    expect(canAccessResponseRoute({ role: 'viewer' }, [])).toBe(false);
    expect(canRunResponseActions({ role: 'viewer' }, [])).toBe(false);
  });

  it('analyst cannot see RBAC admin', () => {
    expect(canSeeRbac({ role: 'analyst' })).toBe(false);
    expect(canAccessAdminRoute({ role: 'analyst' })).toBe(true);
  });

  it('auditor can access admin for audit but not response', () => {
    expect(canAccessAdminRoute({ role: 'auditor' })).toBe(true);
    expect(canAccessResponseRoute({ role: 'auditor' }, ['audit:view'])).toBe(false);
  });

  it('tenant admin cannot use tenant switcher', () => {
    expect(canSeeTenantSwitcher({ role: 'tenant_admin' })).toBe(false);
    expect(canSeeTenantSwitcher({ role: 'super_admin' })).toBe(true);
  });

  it('super admin can use tenant switcher', () => {
    expect(canSeeTenantSwitcher({ role: 'super_admin' })).toBe(true);
  });
});
