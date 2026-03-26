/**
 * Replay detection rules against fixture events for regression checks.
 * Usage:
 *   node scripts/detection-replay.js --events scripts/fixtures/detection-events.json --rules scripts/fixtures/detection-rules.json
 */
const fs = require('fs');
const path = require('path');
const DetectionEngineService = require('../src/services/DetectionEngineService');

function getArg(name, fallback) {
  const idx = process.argv.indexOf(`--${name}`);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

function loadJson(filePath) {
  const p = path.resolve(process.cwd(), filePath);
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

async function run() {
  const eventsPath = getArg('events', 'scripts/fixtures/detection-events.json');
  const rulesPath = getArg('rules', 'scripts/fixtures/detection-rules.json');
  const expectMatchesRaw = getArg('expect-matches', null);
  const expectMatches = expectMatchesRaw == null ? null : parseInt(expectMatchesRaw, 10);
  const events = loadJson(eventsPath);
  const rules = loadJson(rulesPath);

  let matches = 0;
  const report = [];
  for (const evt of events) {
    for (const rule of rules) {
      if (DetectionEngineService.matchesRule(rule, evt)) {
        matches++;
        report.push({ event: evt.event_type || 'unknown', rule: rule.name || rule.title || 'unnamed' });
      }
    }
  }
  const result = { events: events.length, rules: rules.length, matches, report };
  const outDir = path.resolve(process.cwd(), 'artifacts');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'detection-replay.json');
  fs.writeFileSync(outFile, `${JSON.stringify(result, null, 2)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  console.log(JSON.stringify(result, null, 2));
  if (Number.isInteger(expectMatches) && matches !== expectMatches) {
    throw new Error(`Detection replay mismatch: expected ${expectMatches}, got ${matches}`);
  }
}

run().catch((e) => {
  // eslint-disable-next-line no-console
  console.error(e);
  process.exit(1);
});

