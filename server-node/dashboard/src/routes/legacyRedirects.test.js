import { describe, it, expect } from 'vitest';
import { LEGACY_REDIRECT_ROUTES } from './legacyRedirects';

function findLegacy(path) {
  return LEGACY_REDIRECT_ROUTES.find((r) => r.path === path);
}

const SPOT_CHECKS = [
  ['alerts', { type: 'preserve', to: '/detections', defaultTab: 'alerts' }],
  ['events', { type: 'preserve', to: '/hunting', defaultTab: 'events' }],
  ['xdr/events', { type: 'preserve', to: '/hunting', defaultTab: 'xdr-events' }],
  ['av/quarantine', { type: 'preserve', to: '/protection', defaultTab: 'quarantine' }],
  ['incidents', { type: 'preserve', to: '/investigation', defaultTab: 'incidents' }],
  ['rtr', { type: 'preserve', to: '/response', defaultTab: 'rtr' }],
  ['audit-logs', { type: 'preserve', to: '/admin', defaultTab: 'audit' }],
  ['reports', { type: 'preserve', to: '/admin', defaultTab: 'reports' }],
  ['dashboard', { type: 'navigate', to: '/overview' }],
  ['av', { type: 'navigate', to: '/protection' }],
  ['raw-events', { type: 'preserve', to: '/hunting', defaultTab: 'raw' }],
  ['detection-rules', { type: 'preserve', to: '/detections', defaultTab: 'rules' }],
  ['soc/triage', { type: 'preserve', to: '/detections', defaultTab: 'triage' }],
  ['threat-graph', { type: 'preserve', to: '/investigation', defaultTab: 'graph' }],
  ['respond/approvals', { type: 'preserve', to: '/response', defaultTab: 'approvals' }],
  ['enterprise', { type: 'preserve', to: '/admin', defaultTab: 'settings' }],
  ['policies', { type: 'preserve', to: '/protection', defaultTab: 'policies' }],
  ['risk', { type: 'preserve', to: '/overview', defaultTab: 'executive' }],
];

describe('legacy redirects catalog', () => {
  it('defines all legacy routes with unique paths', () => {
    expect(LEGACY_REDIRECT_ROUTES.length).toBeGreaterThanOrEqual(56);
    const paths = LEGACY_REDIRECT_ROUTES.map((r) => r.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  for (const def of LEGACY_REDIRECT_ROUTES) {
    it(`route "${def.path}" has valid type`, () => {
      expect(def.type).toBeTruthy();
      const legacyTypes = [
        'navigate',
        'preserve',
        'legacy-alert',
        'legacy-rule-edit',
        'legacy-rule-detail',
        'legacy-malware-alert',
        'legacy-incident',
        'legacy-case',
      ];
      expect(legacyTypes).toContain(def.type);
      if (def.type === 'navigate' || def.type === 'preserve') {
        expect(def.to).toMatch(/^\//);
      }
    });
  }
});

describe('legacy redirects spot checks', () => {
  for (const [path, expected] of SPOT_CHECKS) {
    it(`/${path} redirects correctly`, () => {
      const r = findLegacy(path);
      expect(r).toBeTruthy();
      for (const [key, value] of Object.entries(expected)) {
        expect(r[key]).toBe(value);
      }
    });
  }
});
