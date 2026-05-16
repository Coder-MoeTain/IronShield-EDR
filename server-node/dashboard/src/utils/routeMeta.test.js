import { describe, it, expect } from 'vitest';
import { getBreadcrumbs, getDocumentTitle } from './routeMeta';

describe('getBreadcrumbs', () => {
  it('root is Overview', () => {
    expect(getBreadcrumbs('/')).toEqual([{ label: 'Overview', to: '/overview' }]);
  });

  it('maps compact console overview', () => {
    const c = getBreadcrumbs('/overview');
    expect(c.some((x) => x.label === 'Overview')).toBe(true);
  });

  it('maps legacy network to breadcrumbs', () => {
    const c = getBreadcrumbs('/network');
    expect(c.some((x) => x.label === 'Network')).toBe(true);
  });

  it('maps detections alert detail', () => {
    const c = getBreadcrumbs('/detections/alerts/42');
    expect(c.some((x) => x.label === 'Detections')).toBe(true);
    expect(c.some((x) => x.label === 'Alert #42')).toBe(true);
  });

  it('maps endpoint detail with numeric id', () => {
    const c = getBreadcrumbs('/endpoints/42');
    expect(c[0].label).toBe('Overview');
    expect(c.some((x) => x.to === '/endpoints/42')).toBe(true);
  });
});

describe('getDocumentTitle', () => {
  it('includes app name for home', () => {
    const t = getDocumentTitle('/');
    expect(t).toMatch(/IronShield/i);
    expect(t).toMatch(/Overview/i);
  });
});
