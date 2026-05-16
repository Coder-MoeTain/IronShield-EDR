import { describe, it, expect } from 'vitest';
import { LEGACY_REDIRECT_ROUTES } from './legacyRedirects';

function findLegacy(path) {
  return LEGACY_REDIRECT_ROUTES.find((r) => r.path === path);
}

describe('legacy redirects', () => {
  it('/alerts -> /detections?tab=alerts', () => {
    const r = findLegacy('alerts');
    expect(r?.type).toBe('preserve');
    expect(r?.to).toBe('/detections');
    expect(r?.defaultTab).toBe('alerts');
  });

  it('/events -> /hunting?tab=events', () => {
    const r = findLegacy('events');
    expect(r?.to).toBe('/hunting');
    expect(r?.defaultTab).toBe('events');
  });

  it('/av/quarantine -> /protection?tab=quarantine', () => {
    const r = findLegacy('av/quarantine');
    expect(r?.to).toBe('/protection');
    expect(r?.defaultTab).toBe('quarantine');
  });

  it('/rtr -> /response?tab=rtr', () => {
    const r = findLegacy('rtr');
    expect(r?.to).toBe('/response');
    expect(r?.defaultTab).toBe('rtr');
  });

  it('/audit-logs -> /admin?tab=audit', () => {
    const r = findLegacy('audit-logs');
    expect(r?.to).toBe('/admin');
    expect(r?.defaultTab).toBe('audit');
  });
});
