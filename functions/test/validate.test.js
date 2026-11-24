'use strict';
// Every op needs auth and validates data strictly: unknown fields, wrong types or long strings fail (tech spec section 6).
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, fails } = require('./helpers');

const A = 'uid-alice-000000000001';
const GID = 'abcdefghijABCDEFGHIJ';

test('every op needs a signed-in caller', async () => {
  const { call } = setup();
  for (const data of [{ op: 'hello' }, { op: 'invite', col: 'w' }, { op: 'sync', since: 0 }]) {
    await fails(call(null, data), 'unauthenticated');
  }
});

test('the request must be an object with a known op', async () => {
  const { call } = setup();
  for (const data of [null, undefined, 'hello', 42, [], ['hello'], {}, { op: 'nope' }, { op: 7 },
    { op: 'resign', g: GID }, { op: 'draw', g: GID, a: 'offer' }, { op: 'deleteMe' }, { op: '__proto__' },
    { op: 'toString' }]) {
    await fails(call(A, data), 'invalid-argument');
  }
});

test('unknown fields fail, so names or free text can never reach the server', async () => {
  const { call } = setup();
  await fails(call(A, { op: 'hello', name: 'Priya' }), 'invalid-argument');
  await fails(call(A, { op: 'invite', col: 'w', msg: 'Play with me' }), 'invalid-argument');
  await fails(call(A, { op: 'accept', code: 'ABCDEFGHJK', nick: 'Ravi' }), 'invalid-argument');
  await fails(call(A, { op: 'move', g: GID, ply: 0, from: 'e2', to: 'e4', note: 'hi' }), 'invalid-argument');
  await fails(call(A, { op: 'sync', since: 0, x: 1 }), 'invalid-argument');
  await fails(call(A, { op: 'cancel', g: GID, why: 'oops' }), 'invalid-argument');
});

test('wrong types and missing required fields fail', async () => {
  const { call } = setup();
  const bad = [
    { op: 'hello', tok: 5 },
    { op: 'hello', tok: '' },
    { op: 'hello', tok: ['x'] },
    { op: 'invite' },
    { op: 'invite', col: 'white' },
    { op: 'invite', col: null },
    { op: 'peek' },
    { op: 'peek', code: 'abcdefghjk' }, // lower case
    { op: 'peek', code: 'ABCDEFGHIK' }, // I is not Crockford
    { op: 'peek', code: 'ABCDEFGHJ' }, // 9 chars
    { op: 'accept', code: 1234567890 },
    { op: 'move', g: GID, ply: 0, from: 'e2' },
    { op: 'move', g: GID, ply: -1, from: 'e2', to: 'e4' },
    { op: 'move', g: GID, ply: 1.5, from: 'e2', to: 'e4' },
    { op: 'move', g: GID, ply: '0', from: 'e2', to: 'e4' },
    { op: 'move', g: GID, ply: 600, from: 'e2', to: 'e4' },
    { op: 'move', g: GID, ply: 0, from: 'e9', to: 'e4' },
    { op: 'move', g: GID, ply: 0, from: 'E2', to: 'e4' },
    { op: 'move', g: GID, ply: 0, from: 'e2', to: 'e4', promo: null },
    { op: 'move', g: GID, ply: 0, from: 'e2', to: 'e4', promo: 'Q' },
    { op: 'move', g: 'short', ply: 0, from: 'e2', to: 'e4' },
    { op: 'move', g: 'abcdefghij/BCDEFGHIJ', ply: 0, from: 'e2', to: 'e4' },
    { op: 'sync' },
    { op: 'sync', since: -1 },
    { op: 'sync', since: 1.5 },
    { op: 'sync', since: '0' },
    { op: 'cancel' },
    { op: 'cancel', g: 12 },
  ];
  for (const data of bad) await fails(call(A, data), 'invalid-argument', undefined);
});

test('long strings fail: a push token over 4 KB, a long game id', async () => {
  const { call } = setup();
  await fails(call(A, { op: 'hello', tok: 'x'.repeat(4097) }), 'invalid-argument');
  await fails(call(A, { op: 'cancel', g: 'a'.repeat(5000) }), 'invalid-argument');
  const ok = await call(A, { op: 'hello', tok: 'x'.repeat(4096) });
  assert.equal(typeof ok.now, 'number');
});

test('a failed validation writes nothing', async () => {
  const { call, store } = setup();
  await fails(call(A, { op: 'invite', col: 'x' }), 'invalid-argument');
  assert.equal(store.size(), 0);
});
