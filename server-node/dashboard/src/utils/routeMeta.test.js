import { describe, it, expect } from 'vitest';
import { getBreadcrumbs, getDocumentTitle } from './routeMeta';

describe('getBreadcrumbs', () => {
  it('root is Activity only', () => {
    expect(getBreadcrumbs('/')).toEqual([{ label: 'Activity', to: '/' }]);
  });

  it('maps network activity', () => {
    const c = getBreadcrumbs('/network');
    expect(c.some((x) => x.label === 'Network activity')).toBe(true);
  });

  it('maps web URL protection', () => {
    const c = getBreadcrumbs('/web-url-protection');
    expect(c.some((x) => x.label === 'Web & URL protection')).toBe(true);
  });

  it('maps endpoint detail with numeric id', () => {
    const c = getBreadcrumbs('/endpoints/42');
    expect(c[0].label).toBe('Activity');
    expect(c.some((x) => x.to === '/endpoints/42')).toBe(true);
  });
});

describe('getDocumentTitle', () => {
  it('includes app name for home', () => {
    const t = getDocumentTitle('/');
    expect(t).toMatch(/IronShield/i);
    expect(t).toMatch(/Activity/i);
  });
});
