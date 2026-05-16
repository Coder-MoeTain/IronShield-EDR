#!/usr/bin/env node
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const EventNormalizationService = require('../src/services/EventNormalizationService');
const DetectionCodeEngine = require('../src/services/DetectionCodeEngine');

const fixturesDir = path.join(__dirname, '../detections/tests/fixtures');
const expectedDir = path.join(__dirname, '../detections/tests/expected');

function main() {
  let failed = 0;
  const files = fs.readdirSync(fixturesDir).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const raw = JSON.parse(fs.readFileSync(path.join(fixturesDir, file), 'utf8'));
    const norm = EventNormalizationService.normalize({
      endpoint_id: raw.endpoint_id || 1,
      event_type: raw.event_type,
      timestamp: raw.timestamp || new Date().toISOString(),
      raw_event_json: raw,
    });
    const hits = DetectionCodeEngine.evaluate(norm).map((h) => h.rule_id);
    const expPath = path.join(expectedDir, file);
    const expected = fs.existsSync(expPath)
      ? JSON.parse(fs.readFileSync(expPath, 'utf8'))
      : { must_match: [] };
    for (const id of expected.must_match || []) {
      if (!hits.includes(id)) {
        console.error(`FAIL ${file}: expected ${id}, got [${hits.join(', ')}]`);
        failed += 1;
      }
    }
    for (const id of expected.must_not_match || []) {
      if (hits.includes(id)) {
        console.error(`FAIL ${file}: did not expect ${id}`);
        failed += 1;
      }
    }
    if (failed === 0) console.log(`OK ${file}`);
  }
  process.exit(failed > 0 ? 1 : 0);
}

main();
