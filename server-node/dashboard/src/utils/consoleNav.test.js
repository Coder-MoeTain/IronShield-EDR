import { describe, it, expect } from 'vitest';
import { getConsoleNavItems, CONSOLE_UI_MODES } from './consoleNav';
import { WORKSPACE_MODES } from './workspaceMode';

describe('getConsoleNavItems', () => {
  it('simple mode shows core analyst pages', () => {
    const items = getConsoleNavItems({ role: 'analyst' }, [], CONSOLE_UI_MODES.SIMPLE);
    const paths = items.map((i) => i.path);
    expect(paths).toContain('/overview');
    expect(paths).toContain('/detections');
    expect(paths).not.toContain('/response');
  });

  it('advanced mode includes response for analysts', () => {
    const items = getConsoleNavItems({ role: 'analyst' }, ['response:view'], CONSOLE_UI_MODES.ADVANCED);
    expect(items.map((i) => i.path)).toContain('/response');
  });

  it('admin mode limits to overview and admin', () => {
    const items = getConsoleNavItems({ role: 'super_admin' }, ['*'], CONSOLE_UI_MODES.ADMIN);
    const paths = items.map((i) => i.path);
    expect(paths).toEqual(['/overview', '/admin']);
  });

  it('mssp mode shows tenant-focused nav for super admin', () => {
    const items = getConsoleNavItems({ role: 'super_admin' }, ['*'], WORKSPACE_MODES.MSSP);
    const paths = items.map((i) => i.path);
    expect(paths).toContain('/overview');
    expect(paths).toContain('/admin');
    expect(paths).not.toContain('/hunting');
  });
});
