'use strict';
// Fix round 1, fix 7: an unexpected error is logged with its code and message only, never its stack
// (Firestore document paths in a stack can contain a uid), and the caller gets "internal".
const test = require('node:test');
const assert = require('node:assert/strict');
const { HttpsError } = require('firebase-functions/v2/https');
const { makeHandler } = require('../src/callable');
const { OpError } = require('../src/errors');

test('unexpected errors: logs code and message only, answers internal', async () => {
  const logs = [];
  const boom = new Error('5 NOT_FOUND: no entity');
  boom.code = 5;
  boom.stack = 'Error at games/uid-secret-0000000001 (fsstore.js:10)';
  const h = makeHandler(() => ({ handle: async () => { throw boom; } }), (...a) => logs.push(a));
  await assert.rejects(h({ auth: { uid: 'u' }, data: {} }), (e) => e instanceof HttpsError && e.code === 'internal' && e.message === 'internal');
  assert.equal(logs.length, 1);
  const text = JSON.stringify(logs);
  assert.ok(!text.includes('uid-secret'), text);
  assert.ok(text.includes('5 NOT_FOUND: no entity'));
  assert.ok(text.includes('5'));
});

test('op errors pass through as callable errors with their details', async () => {
  const h = makeHandler(() => ({ handle: async () => { throw new OpError('failed-precondition', 'late', { games: [] }); } }), () => {});
  await assert.rejects(h({ auth: { uid: 'u' }, data: {} }), (e) => e.code === 'failed-precondition' && e.message === 'late' && Array.isArray(e.details.games));
});
