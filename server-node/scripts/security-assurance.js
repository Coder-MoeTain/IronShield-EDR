#!/usr/bin/env node
/**
 * Continuous assurance: npm audit + security unit tests + control-mapping JSON validation.
 * Usage: npm run security-assurance [-- --strict]
 *   --strict  exit 1 if npm audit reports high or critical (production gate)
 */
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');

function findTestFiles(dir) {
  const out = [];
  if (!fs.existsSync(dir)) return out;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    const st = fs.statSync(p);
    if (st.isDirectory()) out.push(...findTestFiles(p));
    else if (name.endsWith('.test.js')) out.push(p);
  }
  return out;
}
const strict = process.argv.includes('--strict');

function run(cmd, opts = {}) {
  return execSync(cmd, {
    cwd: root,
    encoding: 'utf8',
    stdio: opts.capture ? 'pipe' : 'inherit',
    shell: true,
    ...opts,
  });
}

let exitCode = 0;

console.log('\n=== IronShield security-assurance ===\n');

// 1) control-mapping.json
const mappingPath = path.join(root, '..', 'docs', 'security', 'control-mapping.json');
try {
  const raw = fs.readFileSync(mappingPath, 'utf8');
  JSON.parse(raw);
  console.log('[ok] docs/security/control-mapping.json parses as JSON');
} catch (e) {
  console.error('[fail] control-mapping.json:', e.message);
  exitCode = 1;
}

// 2) npm audit
console.log('\n--- npm audit (server-node) ---\n');
try {
  const out = run('npm audit --json', { capture: true });
  const report = JSON.parse(out);
  const vulns = report.metadata?.vulnerabilities || {};
  const counts = {
    critical: vulns.critical || 0,
    high: vulns.high || 0,
    moderate: vulns.moderate || 0,
    low: vulns.low || 0,
    info: vulns.info || 0,
  };
  console.log(
    'Summary:',
    `critical=${counts.critical} high=${counts.high} moderate=${counts.moderate} low=${counts.low} info=${counts.info}`
  );
  if (strict && (counts.critical > 0 || counts.high > 0)) {
    console.error('[fail] --strict: high or critical vulnerabilities present');
    exitCode = 1;
  } else if (counts.critical > 0 || counts.high > 0) {
    console.warn('[warn] high/critical findings — review or use --strict in CI to block');
  }
} catch (e) {
  // npm audit exits 1 when vulns exist; still parse stdout if present
  const stderr = e.stderr ? String(e.stderr) : '';
  const stdout = e.stdout ? String(e.stdout) : '';
  const combined = stdout || stderr;
  try {
    const report = JSON.parse(combined);
    const vulns = report.metadata?.vulnerabilities || {};
    const critical = vulns.critical || 0;
    const high = vulns.high || 0;
    console.log(`Summary: critical=${critical} high=${high} ... (npm audit reported issues)`);
    if (strict && (critical > 0 || high > 0)) exitCode = 1;
  } catch {
    console.error('[fail] npm audit:', e.message || e);
    exitCode = 1;
  }
}

// 3) node --test
console.log('\n--- node --test (server-node/test) ---\n');
const testDir = path.join(root, 'test');
const testFiles = findTestFiles(testDir);
try {
  if (testFiles.length === 0) {
    console.warn('[warn] no *.test.js files under test/');
  } else {
    const q = testFiles.map((f) => `"${f}"`).join(' ');
    run(`node --test ${q}`, { stdio: 'inherit' });
  }
  console.log('\n[ok] test run completed');
} catch {
  console.error('\n[fail] tests failed');
  exitCode = 1;
}

console.log('\n=== security-assurance finished ===\n');
if (exitCode !== 0) process.exit(exitCode);
