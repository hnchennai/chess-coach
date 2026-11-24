'use strict';
// The real callable on the emulators (Auth, Firestore, Functions), called over HTTP like the app.
// Product scenarios 1, 2, 4 and 6; criteria 1, 2, 3 and 5. Time-based rules (late, expiry) are unit tested
// with an injected clock (test/ops.*.test.js); here the clock is real.
const test = require('node:test');
const assert = require('node:assert/strict');
const { signUp, call, ok, err, PROJECT } = require('./client');

function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

function noUid(answer, ...uids) {
  for (const s of strings(answer)) for (const u of uids) assert.ok(!s.includes(u), 'uid in an answer: ' + s);
}

test('no ID token: UNAUTHENTICATED', async () => {
  const e = await err(null, { op: 'hello' }, 'UNAUTHENTICATED');
  assert.ok(e);
});

test('bad input: INVALID_ARGUMENT (unknown field, unknown op)', async () => {
  const a = await signUp();
  await err(a.token, { op: 'hello', name: 'Priya' }, 'INVALID_ARGUMENT');
  await err(a.token, { op: 'resign', g: 'abcdefghijABCDEFGHIJ' }, 'INVALID_ARGUMENT');
});

test('hello returns the server time', async () => {
  const a = await signUp();
  const r = await ok(a.token, { op: 'hello', tok: 'emulator-push-token' });
  assert.ok(Math.abs(r.now - Date.now()) < 60 * 1000);
});

test('full game flow: invite, peek, accept, moves both ways, illegal and out-of-turn rejected, sync', async () => {
  const a = await signUp();
  const b = await signUp();
  const c = await signUp();
  const answers = [];

  // Scenario 1: invite as White
  const inv = await ok(a.token, { op: 'invite', col: 'w' });
  answers.push(inv);
  assert.match(inv.code, /^[0-9A-HJKMNP-TV-Z]{10}$/);
  const g = inv.games[0].id;
  assert.equal(inv.games[0].st, 'invited');
  assert.equal(inv.games[0].me, 'w');

  // Own invite cannot be peeked or accepted
  await err(a.token, { op: 'peek', code: inv.code }, 'FAILED_PRECONDITION', 'own');
  await err(a.token, { op: 'accept', code: inv.code }, 'FAILED_PRECONDITION', 'own');

  // Scenario 2: peek then accept
  const pk = await ok(b.token, { op: 'peek', code: inv.code });
  answers.push(pk);
  assert.equal(pk.col, 'b');
  assert.equal(pk.exp, inv.games[0].exp);
  const acc = await ok(b.token, { op: 'accept', code: inv.code });
  answers.push(acc);
  assert.equal(acc.games[0].id, g);
  assert.equal(acc.games[0].st, 'active');
  assert.equal(acc.games[0].me, 'b');
  assert.match(acc.games[0].opp, /^[0-9a-f]{12}$/);

  // Criterion 1: used once
  await err(c.token, { op: 'peek', code: inv.code }, 'FAILED_PRECONDITION', 'used');
  await err(c.token, { op: 'accept', code: inv.code }, 'FAILED_PRECONDITION', 'used');

  // Scenario 6: out of turn and illegal moves change nothing
  await err(b.token, { op: 'move', g, ply: 0, from: 'e7', to: 'e5' }, 'FAILED_PRECONDITION', 'turn');
  const ill = await err(a.token, { op: 'move', g, ply: 0, from: 'e2', to: 'e5' }, 'FAILED_PRECONDITION', 'illegal');
  assert.equal(ill.details.games[0].v, 2);
  await err(c.token, { op: 'move', g, ply: 0, from: 'e2', to: 'e4' }, 'NOT_FOUND');

  // Scenario 4: moves both ways
  const m1 = await ok(a.token, { op: 'move', g, ply: 0, from: 'e2', to: 'e4' });
  answers.push(m1);
  assert.deepEqual(m1.games[0].moves, ['e4']);
  await err(a.token, { op: 'move', g, ply: 1, from: 'd2', to: 'd4' }, 'FAILED_PRECONDITION', 'turn');
  const m2 = await ok(b.token, { op: 'move', g, ply: 1, from: 'e7', to: 'e5' });
  answers.push(m2);
  assert.deepEqual(m2.games[0].moves, ['e4', 'e5']);

  // Offline resend of the same move is ok and changes nothing
  const again = await ok(b.token, { op: 'move', g, ply: 1, from: 'e7', to: 'e5' });
  assert.equal(again.games[0].v, m2.games[0].v);

  // Criterion 3: both players see the same game
  const sa = await ok(a.token, { op: 'sync', since: 0 });
  const sb = await ok(b.token, { op: 'sync', since: 0 });
  answers.push(sa, sb);
  assert.deepEqual(sa.games.map((x) => x.id), [g]);
  assert.deepEqual(sa.games[0].moves, sb.games[0].moves);
  assert.equal(sa.games[0].v, sb.games[0].v);
  assert.equal(sa.games[0].me, 'w');
  assert.equal(sb.games[0].me, 'b');
  // Only changed games
  const none = await ok(a.token, { op: 'sync', since: sa.games[0].t });
  assert.deepEqual(none.games, []);
  // A stranger sees nothing
  assert.deepEqual((await ok(c.token, { op: 'sync', since: 0 })).games, []);

  for (const x of answers) noUid(x, a.uid, b.uid);
});

test('10 open games at most (count query in a transaction); cancel frees a slot', async () => {
  const a = await signUp();
  const ids = [];
  for (let i = 0; i < 10; i++) ids.push((await ok(a.token, { op: 'invite', col: 'r' })).games[0].id);
  await err(a.token, { op: 'invite', col: 'r' }, 'FAILED_PRECONDITION', 'full');
  const c = await ok(a.token, { op: 'cancel', g: ids[0] });
  assert.deepEqual(c.games[0].res, { r: null, why: 'expired' });
  await ok(a.token, { op: 'invite', col: 'r' });
});

test('stored data: expireAt is a Firestore Timestamp (for TTL), no names, uids only in the server copy', async () => {
  const { initializeApp, getApps } = require('firebase-admin/app');
  const { getFirestore, Timestamp } = require('firebase-admin/firestore');
  if (!getApps().length) initializeApp({ projectId: PROJECT });
  const db = getFirestore();
  const a = await signUp();
  const inv = await ok(a.token, { op: 'invite', col: 'b' });
  const gs = await db.collection('games').doc(inv.games[0].id).get();
  assert.ok(gs.exists);
  assert.ok(gs.get('expireAt') instanceof Timestamp);
  assert.equal(gs.get('expireAt').toMillis(), inv.games[0].exp);
  assert.deepEqual(gs.get('uids'), [a.uid, null]);
  const is = await db.collection('invites').doc(inv.code).get();
  assert.ok(is.get('expireAt') instanceof Timestamp);
  const us = await db.collection('users').doc(a.uid).get();
  assert.deepEqual(Object.keys(us.data()).sort(), ['inv', 'seen', 'tok']);
});

test('the callable answers HTTP like the documented protocol: result wrapper and error status', async () => {
  const a = await signUp();
  const r = await call(a.token, { op: 'sync', since: 0 });
  assert.equal(r.http, 200);
  assert.ok(r.result && Array.isArray(r.result.games));
  const e = await call(a.token, { op: 'peek', code: '0000000000' });
  assert.equal(e.http, 404);
  assert.equal(e.error.status, 'NOT_FOUND');
});
