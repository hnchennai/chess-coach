'use strict';
// hello, invite, peek, accept, cancel (tech spec section 6; product scenarios 1 and 2, criterion 1, FC-D9, FC-D12, FC-D18).
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, fails, DAY, T0, sha12 } = require('./helpers');

const A = 'uid-alice-000000000001';
const B = 'uid-bob-00000000000002';
const C = 'uid-carol-000000000003';
const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]{10}$/;

test('hello creates the user, stores the push token and returns the server time', async () => {
  const { call, store, clock } = setup();
  const r = await call(A, { op: 'hello', tok: 'tok-1' });
  assert.deepEqual(r, { now: clock.t });
  assert.equal(store.get('users', A).tok, 'tok-1');
  assert.equal(store.get('users', A).seen, clock.t);
  const seen0 = clock.t;
  clock.t += 1000;
  await call(A, { op: 'hello' });
  assert.equal(store.get('users', A).tok, 'tok-1', 'hello without tok keeps the token');
  assert.equal(store.get('users', A).seen, seen0, 'seen is not rewritten within 6 hours (fix 3)');
  await call(A, { op: 'hello', tok: null });
  assert.equal(store.get('users', A).tok, null, 'tok null clears it');
});

test('every op creates the user doc on first use, even when it fails; seen then waits 6 hours', async () => {
  const { call, store, clock } = setup();
  const { code } = await call(A, { op: 'invite', col: 'w' });
  const tA = clock.t;
  clock.t += 5;
  await call(B, { op: 'peek', code });
  assert.equal(store.get('users', B).seen, clock.t);
  clock.t += 5;
  await fails(call(C, { op: 'peek', code: '0000000000' }), 'not-found');
  assert.equal(store.get('users', C).seen, clock.t, 'a failing op still creates the user');
  clock.t += 5;
  await fails(call(A, { op: 'peek', code }), 'failed-precondition', 'own');
  assert.equal(store.get('users', A).seen, tA, 'not rewritten 15 ms later');
  clock.t = tA + 6 * 60 * 60 * 1000;
  await fails(call(A, { op: 'peek', code }), 'failed-precondition', 'own');
  assert.equal(store.get('users', A).seen, clock.t, 'rewritten after 6 hours, even by a failing op');
});

test('scenario 1: invite creates one invited game and a 10-character code that expires in 7 days', async () => {
  const { call, store, clock } = setup();
  const r = await call(A, { op: 'invite', col: 'r' });
  assert.match(r.code, CROCKFORD);
  assert.equal(r.now, clock.t);
  assert.equal(r.games.length, 1);
  const v = r.games[0];
  assert.match(v.id, /^[A-Za-z0-9]{20}$/);
  assert.notEqual(v.id, r.code);
  assert.deepEqual(v, { id: v.id, me: 'r', opp: null, st: 'invited', moves: [], dl: null, draw: null, res: null, v: 1, t: clock.t, exp: clock.t + 7 * DAY, code: r.code });
  const g = store.get('games', v.id);
  assert.equal(g.st, 'invited');
  assert.deepEqual(g.uids, [A, null]);
  assert.equal(g.by, A);
  assert.equal(g.col, 'r');
  assert.equal(g.expireAt, clock.t + 7 * DAY);
  const inv = store.get('invites', r.code);
  assert.deepEqual(inv, { g: v.id, by: A, exp: clock.t + 7 * DAY, expireAt: clock.t + 7 * DAY });
  assert.equal(store.count('games'), 1);
});

test('invite as White or Black shows that colour', async () => {
  const { call } = setup();
  assert.equal((await call(A, { op: 'invite', col: 'w' })).games[0].me, 'w');
  assert.equal((await call(A, { op: 'invite', col: 'b' })).games[0].me, 'b');
});

test('codes come from the random source, use the Crockford alphabet and differ every time', async () => {
  const { call } = setup();
  const codes = new Set();
  for (let i = 0; i < 10; i++) codes.add((await call(A, { op: 'invite', col: 'w' })).code);
  assert.equal(codes.size, 10);
  for (const c of codes) assert.match(c, CROCKFORD);
});

test('FC-D12: at most 10 open games; the 11th invite fails "full"; cancel frees a slot (FC-D18)', async () => {
  const { call } = setup();
  const ids = [];
  for (let i = 0; i < 10; i++) ids.push((await call(A, { op: 'invite', col: 'w' })).games[0].id);
  await fails(call(A, { op: 'invite', col: 'w' }), 'failed-precondition', 'full');
  const c = await call(A, { op: 'cancel', g: ids[0] });
  assert.equal(c.games[0].st, 'over');
  assert.deepEqual(c.games[0].res, { r: null, why: 'expired' });
  await call(A, { op: 'invite', col: 'w' });
});

test('20 invites a day per ID; the 21st fails "limit"; the next day (IST) it works again', async () => {
  const { call, clock } = setup();
  for (let i = 0; i < 20; i++) {
    const r = await call(A, { op: 'invite', col: 'b' });
    await call(A, { op: 'cancel', g: r.games[0].id }); // keep under the 10 open games
  }
  await fails(call(A, { op: 'invite', col: 'b' }), 'failed-precondition', 'limit');
  // T0 is 11:30 IST; 12.5 hours later it is the next day in India
  clock.t = T0 + 12.5 * 60 * 60 * 1000;
  await call(A, { op: 'invite', col: 'b' });
});

test('peek shows the acceptor\'s colour and the expiry, and changes nothing', async () => {
  const { call, store } = setup();
  const w = await call(A, { op: 'invite', col: 'w' });
  const b = await call(A, { op: 'invite', col: 'b' });
  const r = await call(A, { op: 'invite', col: 'r' });
  const pw = await call(B, { op: 'peek', code: w.code });
  assert.deepEqual(pw, { now: pw.now, col: 'b', exp: w.games[0].exp });
  assert.equal((await call(B, { op: 'peek', code: b.code })).col, 'w');
  assert.equal((await call(B, { op: 'peek', code: r.code })).col, 'r');
  assert.equal(store.get('games', w.games[0].id).st, 'invited');
});

test('peek and accept: unknown code is not-found, own invite is "own", expired is "expired"', async () => {
  const { call, clock } = setup();
  await fails(call(B, { op: 'peek', code: '0123456789' }), 'not-found');
  await fails(call(B, { op: 'accept', code: '0123456789' }), 'not-found');
  const { code } = await call(A, { op: 'invite', col: 'w' });
  await fails(call(A, { op: 'peek', code }), 'failed-precondition', 'own');
  await fails(call(A, { op: 'accept', code }), 'failed-precondition', 'own');
  clock.t += 7 * DAY; // exactly at expiry it still works
  await call(B, { op: 'peek', code });
  clock.t += 1;
  await fails(call(B, { op: 'peek', code }), 'failed-precondition', 'expired');
  await fails(call(B, { op: 'accept', code }), 'failed-precondition', 'expired');
});

test('scenario 2 and criterion 1: accept starts the game once; a second accept fails "used"', async () => {
  const { call, store, clock } = setup();
  const inv = await call(A, { op: 'invite', col: 'w' });
  const id = inv.games[0].id;
  clock.t += 60 * 1000;
  const r = await call(B, { op: 'accept', code: inv.code });
  assert.equal(r.games.length, 1);
  const v = r.games[0];
  assert.equal(v.id, id);
  assert.equal(v.me, 'b');
  assert.equal(v.st, 'active');
  assert.equal(v.opp, sha12(A, B));
  assert.equal(v.dl, clock.t + 3 * DAY);
  assert.equal(v.exp, null);
  assert.equal(v.v, 2);
  const g = store.get('games', id);
  assert.deepEqual(g.uids, [A, B]);
  assert.equal(g.w, A);
  assert.equal(g.b, B);
  assert.equal(g.dl, clock.t + 3 * DAY);
  assert.equal(g.rem, clock.t + 2 * DAY);
  assert.equal(g.expireAt, null);
  assert.equal(store.count('games'), 1, 'exactly one game');
  await fails(call(C, { op: 'peek', code: inv.code }), 'failed-precondition', 'used');
  await fails(call(C, { op: 'accept', code: inv.code }), 'failed-precondition', 'used');
  await fails(call(B, { op: 'accept', code: inv.code }), 'failed-precondition', 'used');
  assert.equal(store.get('games', id).uids[1], B, 'the game did not change');
});

test('accept pushes "move" to White only when White is the challenger', async () => {
  const s1 = setup();
  const i1 = await s1.call(A, { op: 'invite', col: 'w' });
  await s1.call(B, { op: 'accept', code: i1.code });
  assert.deepEqual(s1.pushes, [{ to: A, t: 'move', g: i1.games[0].id }]);
  const s2 = setup();
  const i2 = await s2.call(A, { op: 'invite', col: 'b' });
  await s2.call(B, { op: 'accept', code: i2.code });
  assert.deepEqual(s2.pushes, []);
});

test('random colours come from the random source: both outcomes happen', async () => {
  const seen = new Set();
  for (let i = 0; i < 12; i++) {
    const s = setup({ seed: 'colour-' + i });
    const inv = await s.call(A, { op: 'invite', col: 'r' });
    const r = await s.call(B, { op: 'accept', code: inv.code });
    seen.add(r.games[0].me);
    const g = s.store.get('games', inv.games[0].id);
    assert.ok((g.w === A && g.b === B) || (g.w === B && g.b === A));
  }
  assert.deepEqual([...seen].sort(), ['b', 'w']);
});

test('accept fails "full" when the acceptor already has 10 open games', async () => {
  const { call } = setup();
  for (let i = 0; i < 10; i++) await call(B, { op: 'invite', col: 'w' });
  const { code } = await call(A, { op: 'invite', col: 'w' });
  await fails(call(B, { op: 'accept', code }), 'failed-precondition', 'full');
  await call(C, { op: 'accept', code });
});

test('cancel: only my own invited game; an accepted game is "used"; a cancelled code is gone', async () => {
  const { call, store } = setup();
  const i1 = await call(A, { op: 'invite', col: 'w' });
  await fails(call(B, { op: 'cancel', g: i1.games[0].id }), 'not-found');
  await fails(call(A, { op: 'cancel', g: 'ZZZZZZZZZZZZZZZZZZZZ' }), 'not-found');
  const c = await call(A, { op: 'cancel', g: i1.games[0].id });
  assert.equal(c.games[0].st, 'over');
  assert.equal(c.games[0].exp, null);
  assert.equal(store.get('invites', i1.code), undefined, 'invite deleted');
  await fails(call(B, { op: 'peek', code: i1.code }), 'not-found');
  await fails(call(A, { op: 'cancel', g: i1.games[0].id }), 'failed-precondition', 'over');
  const i2 = await call(A, { op: 'invite', col: 'w' });
  await call(B, { op: 'accept', code: i2.code });
  await fails(call(A, { op: 'cancel', g: i2.games[0].id }), 'failed-precondition', 'used');
  await fails(call(B, { op: 'cancel', g: i2.games[0].id }), 'not-found');
});

test('opp is the first 12 hex of sha256(oppUid:myUid): different on each side, stable per pair', async () => {
  const { call } = setup();
  const i1 = await call(A, { op: 'invite', col: 'w' });
  const rb = await call(B, { op: 'accept', code: i1.code });
  const i2 = await call(B, { op: 'invite', col: 'w' });
  const ra = await call(A, { op: 'accept', code: i2.code });
  assert.equal(rb.games[0].opp, sha12(A, B));
  assert.equal(ra.games[0].opp, sha12(B, A));
  assert.notEqual(sha12(A, B), sha12(B, A));
  const sa = await call(A, { op: 'sync', since: 0 });
  assert.deepEqual(sa.games.map((g) => g.opp), [sha12(B, A), sha12(B, A)]);
});

test('an invite whose game already ended as expired (FC2 tick) says "expired", not "used"', async () => {
  const { call, store } = setup();
  const inv = await call(A, { op: 'invite', col: 'w' });
  const id = inv.games[0].id;
  store.put('games', id, { ...store.get('games', id), st: 'over', res: { r: null, why: 'expired' } });
  await fails(call(B, { op: 'peek', code: inv.code }), 'failed-precondition', 'expired');
  await fails(call(B, { op: 'accept', code: inv.code }), 'failed-precondition', 'expired');
});
