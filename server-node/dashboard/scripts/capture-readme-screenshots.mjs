/**
 * Captures PNGs for the repo README (run from dashboard with backend + vite up).
 * Usage: node scripts/capture-readme-screenshots.mjs
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
const username = process.env.README_CAPTURE_USERNAME;
const password = process.env.README_CAPTURE_PASSWORD;

mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch();
try {
  // Login screen
  const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
  await page.goto(`${base}/login`, { waitUntil: 'networkidle' });
  await page.screenshot({ path: join(outDir, 'login.png'), type: 'png' });

  if (!username || !password) {
    throw new Error('Set README_CAPTURE_USERNAME and README_CAPTURE_PASSWORD to capture authenticated screenshots.');
  }
  await page.fill('input[placeholder="Username"]', username);
  await page.fill('input[placeholder="Password"]', password);
  await Promise.all([
    page.waitForURL((u) => !u.pathname.includes('/login'), { timeout: 15000 }),
    page.click('button[type="submit"]'),
  ]);
  await page.waitForLoadState('networkidle');
  await new Promise((r) => setTimeout(r, 800));

  await page.screenshot({ path: join(outDir, 'dashboard.png'), type: 'png' });

  // Wide hero-style crop for README banner
  await page.setViewportSize({ width: 1400, height: 420 });
  await new Promise((r) => setTimeout(r, 300));
  await page.screenshot({ path: join(outDir, 'banner.png'), type: 'png' });

  await page.close();

  // Rasterize architecture SVG (same visual as assets/architecture.svg)
  const arch = join(repoRoot, 'assets', 'architecture.svg');
  const archPage = await browser.newPage({ viewport: { width: 720, height: 520 } });
  await archPage.goto(pathToFileURL(arch).href, { waitUntil: 'load' });
  await archPage.screenshot({ path: join(outDir, 'architecture.png'), type: 'png' });
  await archPage.close();

  console.log('Wrote PNGs to', outDir);
} finally {
  await browser.close();
}
