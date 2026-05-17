/**
 * Canonical tab → primary API mapping for coverage tests.
 */
export const TAB_API_ROUTES = {
  'overview.executive': { method: 'GET', path: '/api/v1/admin/dashboard/summary' },
  'overview.soc': { method: 'GET', path: '/api/v1/admin/xdr/summary' },
  'overview.endpoint-health': { method: 'GET', path: '/api/v1/admin/sensors/health' },
  'overview.detection-analytics': { method: 'GET', path: '/api/v1/admin/analytics/detections-summary' },
  'endpoints.list': { method: 'GET', path: '/api/v1/admin/endpoints' },
  'detections.triage': { method: 'GET', path: '/api/v1/admin/soc/triage' },
  'detections.alerts': { method: 'GET', path: '/api/v1/admin/alerts' },
  'detections.rules': { method: 'GET', path: '/api/v1/admin/detection-rules' },
  'detections.mitre': { method: 'GET', path: '/api/v1/admin/mitre/coverage' },
  'detections.xdr': { method: 'GET', path: '/api/v1/admin/xdr/detections' },
  'detections.suppressions': { method: 'GET', path: '/api/v1/admin/suppressions' },
  'investigation.graph': { method: 'GET', path: '/api/v1/admin/threat-graph' },
  'command-center.search': { method: 'GET', path: '/api/v1/admin/search/global' },
};

export const CONSOLE_BFF_ROUTES = [
  '/api/v1/console/overview',
  '/api/v1/console/endpoints',
  '/api/v1/console/detections',
  '/api/v1/console/investigation',
  '/api/v1/console/response',
  '/api/v1/console/hunting',
  '/api/v1/console/protection',
  '/api/v1/console/admin',
];
