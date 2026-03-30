#!/usr/bin/env node
/**
 * Runs all *.test.js under server-node/test (recursive). Cross-platform.
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

const testDir = path.join(root, 'test');
const files = findTestFiles(testDir);
if (files.length === 0) {
  console.warn('[warn] no *.test.js under test/');
  process.exit(0);
}
const q = files.map((f) => `"${f}"`).join(' ');
execSync(`node --test ${q}`, { stdio: 'inherit', cwd: root, shell: true });
