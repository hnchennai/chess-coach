'use strict';
// CI guard: every dependency in functions/package.json is an exact version (no ^, ~, ranges or tags),
// engines.node is "22", the installed copy in node_modules is exactly that version, and firebase-tools is not a
// dependency (CI and the README run it as npx firebase-tools@15.35.0).
// Usage: node scripts/check-pins.js (run after npm ci in functions/)
const path = require('node:path');

const EXACT = /^\d+\.\d+\.\d+$/;

function problems(pkg, installedVersion) {
  const out = [];
  if (!pkg.engines || pkg.engines.node !== '22') out.push(`engines.node must be "22" (found ${JSON.stringify(pkg.engines && pkg.engines.node)})`);
  for (const field of ['dependencies', 'devDependencies']) {
    for (const [name, want] of Object.entries(pkg[field] || {})) {
      if (name === 'firebase-tools') out.push(`${field}.firebase-tools must not be listed: run it as npx firebase-tools@15.35.0`);
      if (!EXACT.test(want)) {
        out.push(`${field}.${name} must be an exact version (found "${want}")`);
        continue;
      }
      let got;
      try {
        got = installedVersion(name);
      } catch (e) {
        got = 'not installed';
      }
      if (got !== want) out.push(`${name} must be exactly ${want} (installed: ${got})`);
    }
  }
  return out;
}

if (require.main === module) {
  const dir = path.join(__dirname, '..');
  const pkg = require(path.join(dir, 'package.json'));
  const bad = problems(pkg, (n) => require(path.join(dir, 'node_modules', n, 'package.json')).version);
  for (const b of bad) console.log(`::error::functions/package.json: ${b}`);
  if (bad.length) process.exit(1);
  console.log('functions/package.json: all versions exact and installed as pinned');
}

module.exports = { problems };
