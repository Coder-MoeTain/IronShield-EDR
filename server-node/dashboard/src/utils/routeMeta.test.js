import { describe, it, expect } from 'vitest';
import { getBreadcrumbs, getDocumentTitle } from './routeMeta';

describe('getBreadcrumbs', () => {
  it('root is Dashboard only', () => {
    expect(getBreadcrumbs('/')).toEqual([{ label: 'Dashboard', to: '/' }]);
  });

  it('maps network', () => {
    const c = getBreadcrumbs('/network');
    expect(c.some((x) => x.label === 'Network')).toBe(true);
  });

  it('maps web URL protection', () => {
    const c = getBreadcrumbs('/web-url-protection');
    expect(c.some((x) => x.label === 'Web/URL')).toBe(true);
  });

  it('maps endpoint detail with numeric id', () => {
    const c = getBreadcrumbs('/endpoints/42');
    expect(c[0].label).toBe('Dashboard');
    expect(c.some((x) => x.to === '/endpoints/42')).toBe(true);
  });
});

describe('getDocumentTitle', () => {
  it('includes app name for home', () => {
    const t = getDocumentTitle('/');
    expect(t).toMatch(/IronShield/i);
    expect(t).toMatch(/Dashboard/i);
  });
});
