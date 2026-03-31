/**
 * Captures PNG screenshots for the repo README.
 *
 * Prerequisite: Vite dev server (proxies /api to backend). From repo root:
 *   cd server-node/dashboard && npm run dev
 *
 * Mock mode (no DB/login — recommended for docs):
 *   node scripts/capture-readme-screenshots.mjs
 *
 * Live mode (real admin UI against your stack):
 *   set README_CAPTURE_MODE=live
 *   set README_CAPTURE_USERNAME=admin
 *   set README_CAPTURE_PASSWORD=***
 *   node scripts/capture-readme-screenshots.mjs
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { pathToFileURL } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = join(__dirname, '..', '..', '..');
const outDir = join(repoRoot, 'docs', 'images');
const base = process.env.README_CAPTURE_URL || 'http://localhost:5173';
const mode = (process.env.README_CAPTURE_MODE || 'mock').toLowerCase();
const username = process.env.README_CAPTURE_USERNAME;
const password = process.env.README_CAPTURE_PASSWORD;

mkdirSync(outDir, { recursive: true });

function makeJwt() {
  const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64url');
  const exp = Math.floor(Date.now() / 1000) + 7200;
  const payload = Buffer.from(JSON.stringify({ sub: 'readme-capture', exp })).toString('base64url');
  return `${header}.${payload}.sig`;
}

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
  alertSummary: { critical: 0, high: 1, medium: 2, low: 0, new: 1 },
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
  detection_rules_enabled: 12,
  ingest_async_queue: false,
  kafka_ingest: false,
  tamper_high_hosts: 0,
  notes: [],
};

function mockEndpoint(id) {
  const now = new Date().toISOString();
  const created = new Date(Date.now() - 45 * 86400000).toISOString();
  return {
    id,
    hostname: 'WIN-DEMO-01',
    status: 'online',
    agent_version: '1.4.2',
    ip_address: '192.168.50.120',
    mac_address: '00-1A-2B-3C-4D-5E',
    os_version: 'Windows 11 Pro 23H2',
    logged_in_user: 'CORP\\\\analyst',
    tenant_slug: 'acme',
    tenant_name: 'Acme Corp',
    last_heartbeat_at: now,
    created_at: created,
    policy_status: 'normal',
    policy_compliance_status: 'matched',
    cpu_percent: 14,
    ram_percent: 62,
    disk_percent: 71,
    sensor_operational_status: 'ok',
    sensor_queue_depth: 0,
    sensor_uptime_seconds: 172800,
    host_isolation_active: false,
    agent_update_status: 'up_to_date',
    available_agent_version: '1.4.2',
    last_agent_update_check_at: now,
    assigned_policy_id: 1,
    assigned_policy_name: 'Standard workstation',
    edr_policy_id: 1,
    edr_policy_name: 'Standard workstation',
    last_edr_policy_sync_at: now,
    av_ngav_prevention_status: 'active',
    av_ngav_realtime_enabled: true,
    av_ngav_bundle_version: '2026.03.15',
    av_ngav_signature_count: 4200000,
    av_ngav_sync_status: 'synced',
    tamper_signals_json: JSON.stringify({
      sensor_mode: 'full',
      kernel_driver_present: true,
      tamper_risk: 'low',
      windows_service_status: 'Running',
      windows_service_name: 'IronShieldAgent',
      service_stop_events_24h: 0,
      agent_binary_path: 'C:\\\\Program Files\\\\IronShield\\\\agent.exe',
      agent_binary_sha256: 'a'.repeat(64),
    }),
    host_inventory_at: now,
    host_listening_ports_json: JSON.stringify([
      { protocol: 'TCP', local_address: '0.0.0.0', local_port: 135 },
      { protocol: 'TCP', local_address: '0.0.0.0', local_port: 445 },
    ]),
    host_hidden_c_json: '[]',
    host_disk_usage_json: JSON.stringify([
      { mount: 'C:\\\\', volume_label: 'OS', total_gb: 476.2, used_gb: 312.4, free_gb: 163.8, used_percent: 66 },
    ]),
    host_shared_folders_json: '[]',
  };
}

const MOCK_ENDPOINT_LIST = [mockEndpoint(10), { ...mockEndpoint(11), id: 11, hostname: 'SRV-DC-02', status: 'offline' }];

const MOCK_NETWORK_SUMMARY = {
  total_connections: 128,
  unique_remote_ips: 42,
  hosts_with_activity: 3,
  outgoing_destinations: 24,
};

async function installScreenshotMocks(page) {
  await page.route('**/api/**', async (route) => {
    const req = route.request();
    const url = req.url();
    const method = req.method();
    const u = new URL(url);
    const path = u.pathname;

    if (method !== 'GET' && method !== 'HEAD' && method !== 'POST') {
      return route.continue();
    }

    const json = (body, status = 200) =>
      route.fulfill({
        status,
        contentType: 'application/json',
        body: JSON.stringify(body),
      });

    if (path === '/api/auth/me') {
      return json({
        permissions: ['*'],
        user: { id: 1, username: 'admin', role: 'admin' },
      });
    }

    if (path === '/api/admin/dashboard/summary') {
      return json(MOCK_SUMMARY);
    }

    if (path === '/api/admin/soc/readiness') {
      return json(MOCK_SOC);
    }

    if (path === '/api/admin/dashboard/cyber-news') {
      return json({ items: [], warnings: [] });
    }

    if (path === '/api/admin/dashboard/http-map') {
      return json({ connections: [] });
    }

    if (path === '/api/admin/tenants') {
      return json([]);
    }

    if (path === '/api/admin/policies') {
      return json([{ id: 1, name: 'Standard workstation', mode: 'enforce' }]);
    }

    if (path === '/api/admin/host-groups') {
      return json([{ id: 1, name: 'Workstations' }]);
    }

    if (path === '/api/admin/playbooks') {
      return json([]);
    }

    if (path === '/api/admin/detection-rules') {
      return json({
        rules: [],
        summary: { total: 0, enabled_count: 0 },
      });
    }

    const tl = path.match(/^\/api\/admin\/endpoints\/(\d+)\/process-timeline$/);
    if (tl) {
      return json({
        events: [
          {
            id: 1,
            timestamp: new Date().toISOString(),
            event_type: 'ProcessRollup',
            process_name: 'explorer.exe',
            process_id: 1234,
            parent_process_name: 'userinit.exe',
          },
        ],
      });
    }

    const m = path.match(/^\/api\/admin\/endpoints\/(\d+)(?:\/(.+))?$/);
    if (m) {
      const id = parseInt(m[1], 10);
      const sub = m[2];
      if (!sub) {
        return json(mockEndpoint(id));
      }
      if (sub === 'metrics') {
        return json({
          metrics: [{ cpu_percent: 14, ram_percent: 62, disk_percent: 71, network_rx_mbps: 0.2, network_tx_mbps: 0.1 }],
        });
      }
      if (sub === 'actions') {
        return json([]);
      }
    }

    if (path === '/api/admin/endpoints') {
      return json(MOCK_ENDPOINT_LIST);
    }

    if (path.startsWith('/api/admin/network/')) {
      if (path.includes('/summary')) return json(MOCK_NETWORK_SUMMARY);
      if (path.includes('/traffic')) return json({ series: [] });
      if (path.includes('/outgoing-ips')) return json({ ips: [] });
      if (path.includes('/connections')) return json([]);
      if (path.includes('/logs')) return json({ logs: [] });
      return json({});
    }

    return json({});
  });
}

async function setMockSession(page) {
  const token = makeJwt();
  const user = JSON.stringify({ id: 1, username: 'admin', role: 'admin' });
  await page.addInitScript(
    ([t, u]) => {
      localStorage.setItem('edr_token', t);
      localStorage.setItem('edr_user', u);
    },
    [token, user]
  );
}

async function captureMock(browser) {
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(outDir, 'login.png'), type: 'png' });

  await page.close();

  const dash = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await setMockSession(dash);
  await installScreenshotMocks(dash);
  await dash.goto(`${base}/`, { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 600));
  await dash.screenshot({ path: join(outDir, 'dashboard.png'), type: 'png' });

  await dash.setViewportSize({ width: 1400, height: 420 });
  await new Promise((r) => setTimeout(r, 300));
  await dash.screenshot({ path: join(outDir, 'banner.png'), type: 'png' });

  await dash.setViewportSize({ width: 1280, height: 720 });
  await dash.goto(`${base}/endpoints`, { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 400));
  await dash.screenshot({ path: join(outDir, 'hosts.png'), type: 'png' });

  await dash.goto(`${base}/endpoints/10`, { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 500));
  await dash.screenshot({ path: join(outDir, 'host-detail.png'), type: 'png' });

  await dash.goto(`${base}/network`, { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 500));
  await dash.screenshot({ path: join(outDir, 'network-activity.png'), type: 'png' });

  await dash.goto(`${base}/detection-rules`, { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 400));
  await dash.screenshot({ path: join(outDir, 'detection-rules.png'), type: 'png' });

  await dash.close();

  const arch = join(repoRoot, 'assets', 'architecture.svg');
  const archPage = await browser.newPage({ viewport: { width: 720, height: 520 } });
  await archPage.goto(pathToFileURL(arch).href, { waitUntil: 'load' });
  await archPage.screenshot({ path: join(outDir, 'architecture.png'), type: 'png' });
  await archPage.close();

  console.log('Mock capture complete. PNGs in', outDir);
}

async function captureLive(browser) {
  if (!username || !password) {
    throw new Error('README_CAPTURE_MODE=live requires README_CAPTURE_USERNAME and README_CAPTURE_PASSWORD.');
  }
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(outDir, 'login.png'), type: 'png' });

  await page.fill('input[placeholder="Username"]', username);
  await page.fill('input[placeholder="Password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 20000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState('networkidle');
  await new Promise((r) => setTimeout(r, 800));

  await page.screenshot({ path: join(outDir, 'dashboard.png'), type: 'png' });

  await page.setViewportSize({ width: 1400, height: 420 });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: join(outDir, 'banner.png'), type: 'png' });

  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${base}/endpoints`, { waitUntil: 'networkidle' });
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: join(outDir, 'hosts.png'), type: 'png' });

  await page.goto(`${base}/endpoints/10`, { waitUntil: 'networkidle' }).catch(() => {});
  await new Promise((r) => setTimeout(r, 600));
  await page.screenshot({ path: join(outDir, 'host-detail.png'), type: 'png' });

  await page.goto(`${base}/network`, { waitUntil: 'networkidle' }).catch(() => {});
  await new Promise((r) => setTimeout(r, 500));
  await page.screenshot({ path: join(outDir, 'network-activity.png'), type: 'png' });

  await page.goto(`${base}/detection-rules`, { waitUntil: 'networkidle' }).catch(() => {});
  await new Promise((r) => setTimeout(r, 400));
  await page.screenshot({ path: join(outDir, 'detection-rules.png'), type: 'png' });

  await page.close();

  const arch = join(repoRoot, 'assets', 'architecture.svg');
  const archPage = await browser.newPage({ viewport: { width: 720, height: 520 } });
  await archPage.goto(pathToFileURL(arch).href, { waitUntil: 'load' });
  await archPage.screenshot({ path: join(outDir, 'architecture.png'), type: 'png' });
  await archPage.close();

  console.log('Live capture complete. PNGs in', outDir);
}

const browser = await chromium.launch();
try {
  if (mode === 'live') {
    await captureLive(browser);
  } else {
    await captureMock(browser);
  }
} finally {
  await browser.close();
}
