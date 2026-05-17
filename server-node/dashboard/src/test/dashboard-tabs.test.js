import { describe, it, expect } from 'vitest';
import { TAB_API_ROUTES } from './tabApiRoutes';

const REQUIRED_TABS = [
  'overview.soc',
  'overview.endpoint-health',
  'overview.detection-analytics',
  'detections.triage',
  'detections.alerts',
  'detections.rules',
  'detections.mitre',
  'detections.xdr',
  'detections.suppressions',
  'endpoints.list',
  'investigation.graph',
];

describe('dashboard tab API coverage', () => {
  for (const key of REQUIRED_TABS) {
    it(`${key} has a primary API route`, () => {
      const route = TAB_API_ROUTES[key];
      expect(route).toBeDefined();
      expect(route.method).toBe('GET');
      expect(route.path).toMatch(/^\/api\/v1\//);
    });
  }

  it('all tab routes use /api/v1 prefix', () => {
    for (const route of Object.values(TAB_API_ROUTES)) {
      expect(route.path.startsWith('/api/v1/')).toBe(true);
    }
  });
});
