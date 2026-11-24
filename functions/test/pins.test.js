'use strict';
// Exact versions only (no ^ or ~), Node 22, and what npm installed is what package.json pins.
const test = require('node:test');
const assert = require('node:assert/strict');
const { problems } = require('../scripts/check-pins');

test('the real package.json and node_modules pass', () => {
  assert.deepEqual(problems(require('../package.json'), (n) => require(`../node_modules/${n}/package.json`).version), []);
});

test('ranges, tags and a wrong installed version are caught', () => {
  const pkg = { engines: { node: '>=22' }, dependencies: { a: '^1.0.0', b: '~2.0.0', c: '3.0.0' }, devDependencies: { d: 'latest' } };
  const got = problems(pkg, (n) => (n === 'c' ? '3.0.1' : '1.0.0'));
  assert.equal(got.length, 5, got.join('\n'));
});
