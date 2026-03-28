/**
 * Playwright route handlers — mock admin APIs so smoke tests run without a backend.
 */

/** JWT the dashboard client accepts (must decode in browser `jwt.js` — include numeric `exp`). */
function makePlaywrightJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 7200;
  const payload = Buffer.from(
    JSON.stringify({ sub: 'playwright-smoke', exp })
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

const MOCK_JWT = makePlaywrightJwt();

const MOCK_SUMMARY = {
  eventsTotal: 42,
  eventsToday: 3,
  suspectCount24h: 0,
  triagePending: 0,
  responseActionsPending: 0,
  openIncidents: 0,
  auditEvents24h: 0,
  eventsOverTime: [],
  alertsOverTime: [],
  eventTypes: [],
  eventSources: [],
  endpoints: { online: 2, offline: 1, total: 3 },
  alertSummary: { critical: 0, high: 0, medium: 0, low: 0, new: 0 },
  investigations: { open: 0 },
  alertsByStatus: [],
  endpointsByPolicy: [],
  recentAlerts: [],
  recentInvestigations: [],
};

const MOCK_SOC = {
  generated_at: new Date().toISOString(),
  endpoints_total: 3,
  endpoints_online_15m: 2,
  alerts_open: 1,
  detection_rules_enabled: 7,
  ingest_async_queue: false,
  kafka_ingest: false,
  tamper_high_hosts: 0,
  notes: [],
};

/**
 * @param {import('@playwright/test').Page} page
 */
async function installDashboardApiMocks(page) {
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
      return route.continue();
    }

    if (url.includes('/api/auth/me')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          permissions: ['*'],
          user: { id: 1, username: 'smoke', role: 'admin' },
        }),
      });
    }

    if (url.includes('/api/admin/dashboard/summary')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SUMMARY),
      });
    }

    if (url.includes('/api/admin/soc/readiness')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(MOCK_SOC),
      });
    }

    if (url.includes('/api/admin/dashboard/cyber-news')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ items: [], warnings: [] }),
      });
    }

    if (url.includes('/api/admin/endpoints')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    if (url.includes('/api/admin/dashboard/http-map')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ connections: [] }),
      });
    }

    if (url.includes('/api/admin/tenants')) {
      return route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    }

    return route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{}',
    });
  });
}

module.exports = { MOCK_JWT, installDashboardApiMocks };
