/**
 * Build a lightweight compliance evidence artifact from local signals.
 * Produces artifacts/compliance-evidence.json
 */
const fs = require('fs');
const path = require('path');
const config = require('../src/config');

function safeReadJson(p) {
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function latestDrEvidence() {
  const dir = path.resolve(process.cwd(), 'backups', 'dr-evidence');
  if (!fs.existsSync(dir)) return null;
  const files = fs.readdirSync(dir).filter((f) => f.endsWith('.json')).sort();
  if (files.length === 0) return null;
  const latest = path.join(dir, files[files.length - 1]);
  return { file: latest, data: safeReadJson(latest) };
}

function latestDetectionReplay() {
  const p = path.resolve(process.cwd(), 'artifacts', 'detection-replay.json');
  if (!fs.existsSync(p)) return null;
  return { file: p, data: safeReadJson(p) };
}

function countTests() {
  const testDir = path.resolve(process.cwd(), 'test');
  if (!fs.existsSync(testDir)) return 0;
  return fs.readdirSync(testDir).filter((f) => f.endsWith('.test.js')).length;
}

function run() {
  const outDir = path.resolve(process.cwd(), 'artifacts');
  fs.mkdirSync(outDir, { recursive: true });
  const dr = latestDrEvidence();
  const replay = latestDetectionReplay();
  const evidence = {
    generated_at: new Date().toISOString(),
    controls: {
      tls_enforced_prod: !!config.security?.enforceTlsInProduction,
      mtls_enforced_prod: !!config.security?.enforceAgentMtlsInProduction,
      mfa_required_local_login: !!config.auth?.requireMfaForLocalLogin,
      mfa_required_all_admins: !!config.auth?.enforceMfaAllAdmins,
    },
    quality: {
      test_files: countTests(),
      detection_replay_script: fs.existsSync(path.resolve(process.cwd(), 'scripts', 'detection-replay.js')),
      dr_drill_script: fs.existsSync(path.resolve(process.cwd(), 'scripts', 'run-dr-drill.ps1')),
      detection_replay_matches: replay?.data?.matches ?? null,
    },
    dr_latest: dr?.data || null,
    dr_evidence_file: dr?.file || null,
    detection_replay_latest: replay?.data || null,
    detection_replay_file: replay?.file || null,
  };
  const out = path.join(outDir, 'compliance-evidence.json');
  fs.writeFileSync(out, `${JSON.stringify(evidence, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(`Compliance evidence written: ${out}`);
}

run();

