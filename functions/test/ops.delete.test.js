'use strict';
// deleteMe (tech spec section 6; FC-D16, FC-D17, scenario 10, criterion 9).
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, startGame, fails, strings, sha12, DAY } = require('./helpers');

const A = 'uid-alice-000000000001'; // the player who deletes
const B = 'uid-bob-00000000000002';
const C = 'uid-carol-000000000003';
const D = 'uid-dave-0000000000004';

// A's world: a waiting invite, an active game as White vs B, an active game as Black vs C, a finished game vs B,
// an accepted (used) invite, plus a game between B and C that has nothing to do with A.
async function world() {
  const s = setup();
  await s.call(A, { op: 'hello', tok: 'push-token-A' });
  const waiting = await s.call(A, { op: 'invite', col: 'r' });
  const gAB = await startGame(s, A, B, 'w');
  const gCA = await startGame(s, C, A, 'w'); // C is White, A Black
  const gDone = await startGame(s, A, B, 'b');
  await s.call(B, { op: 'resign', g: gDone }); // A won this one
  const gBC = await startGame(s, B, C, 'w');
  await s.call(A, { op: 'draw', g: gAB, a: 'offer' });
  s.pushes.length = 0;
  return { s, waiting, gWait: waiting.games[0].id, gAB, gCA, gDone, gBC };
}

test('scenario 10: open games end for the friends as abandoned (friend wins), invites end expired, pushes "over" to friends', async () => {
  const w = await world();
  const { s } = w;
  s.clock.t += 1000;
  const r = await s.call(A, { op: 'deleteMe' });
  assert.deepEqual(r, { now: s.clock.t });

  const ab = s.store.get('games', w.gAB);
  assert.equal(ab.st, 'over');
  assert.deepEqual(ab.res, { r: 'b', why: 'abandoned' }, 'B (Black) wins');
  assert.equal(ab.draw, null);
  assert.equal(ab.dl, null);
  assert.equal(ab.rem, null);
  assert.equal(ab.expireAt, s.clock.t + 30 * DAY);
  assert.deepEqual(s.store.get('games', w.gCA).res, { r: 'w', why: 'abandoned' }, 'C (White) wins');
  const wait = s.store.get('games', w.gWait);
  assert.equal(wait.st, 'over');
  assert.deepEqual(wait.res, { r: null, why: 'expired' });
  assert.equal(wait.code, null);
  assert.deepEqual(s.store.get('games', w.gDone).res, { r: 'b', why: 'resign' }, 'a finished game keeps its result');
  assert.equal(s.store.get('games', w.gBC).st, 'active', 'other games are untouched');

  const pushes = s.pushes.slice().sort((x, y) => x.to.localeCompare(y.to));
  assert.deepEqual(pushes, [{ to: B, t: 'over', g: w.gAB }, { to: C, t: 'over', g: w.gCA }]);
});

test('criterion 9: the uid is gone from every game, the invites and the user doc are deleted, the Auth user too', async () => {
  const w = await world();
  const { s } = w;
  await s.call(A, { op: 'deleteMe' });
  for (const id of [w.gWait, w.gAB, w.gCA, w.gDone]) {
    const g = s.store.get('games', id);
    assert.ok(g.uids.includes('x'), id);
    assert.ok(!g.uids.includes(A));
    assert.notEqual(g.w, A);
    assert.notEqual(g.b, A);
    assert.notEqual(g.by, A);
  }
  assert.deepEqual(s.store.get('games', w.gAB).uids, ['x', B]);
  assert.equal(s.store.get('games', w.gAB).w, 'x');
  assert.equal(s.store.get('games', w.gAB).by, 'x');
  assert.equal(s.store.get('games', w.gCA).b, 'x');
  assert.equal(s.store.get('invites', w.waiting.code), undefined, 'the waiting invite is deleted');
  assert.deepEqual(s.store.get('users', A), { gone: true, expireAt: s.clock.t + 2 * 3600 * 1000 },
    'the user doc (and its push token) is replaced by a tombstone that holds nothing and expires in 2 hours');
  assert.deepEqual(s.authDeleted, [A]);
  const all = strings(s.store.dump());
  assert.ok(!all.includes(A), 'the uid is nowhere');
  assert.ok(!all.includes('push-token-A'), 'the token is nowhere');
  assert.ok(!all.some((x) => x.includes(sha12(B, A)) || x.includes(sha12(C, A))), 'no key of A\'s own view is kept');
});

test('the friend keeps the same opponent key for the game (so the record per friend still adds up)', async () => {
  const w = await world();
  const { s } = w;
  const before = (await s.call(B, { op: 'sync', since: 0 })).games.find((x) => x.id === w.gAB);
  assert.equal(before.opp, sha12(A, B));
  await s.call(A, { op: 'deleteMe' });
  const after = (await s.call(B, { op: 'sync', since: 0 })).games.find((x) => x.id === w.gAB);
  assert.equal(after.opp, before.opp);
  assert.equal(after.me, 'b');
  assert.deepEqual(after.res, { r: 'b', why: 'abandoned' });
  assert.ok(after.v > before.v);
  const done = (await s.call(B, { op: 'sync', since: 0 })).games.find((x) => x.id === w.gDone);
  assert.equal(done.opp, sha12(A, B));
  // When the friend deletes too, nobody is left in the game and no key is kept
  await s.call(B, { op: 'deleteMe' });
  const g = s.store.get('games', w.gAB);
  assert.deepEqual(g.uids, ['x', 'x']);
  assert.equal(g.oppx, null);
});

test('the friend\'s open games count drops (an abandoned game is over); their later moves in it fail "over"', async () => {
  const w = await world();
  const { s } = w;
  await s.call(A, { op: 'deleteMe' });
  await fails(s.call(B, { op: 'move', g: w.gAB, ply: 0, from: 'e7', to: 'e5' }), 'failed-precondition', 'over');
  await fails(s.call(B, { op: 'draw', g: w.gAB, a: 'accept' }), 'failed-precondition', 'over');
  await fails(s.call(D, { op: 'accept', code: w.waiting.code }), 'not-found');
});

test('deleteMe is safe to run again, and works for a player with no data', async () => {
  const w = await world();
  const { s } = w;
  await s.call(A, { op: 'deleteMe' });
  const snap = JSON.stringify(s.store.dump());
  s.pushes.length = 0;
  await s.call(A, { op: 'deleteMe' });
  assert.equal(JSON.stringify(s.store.dump()), snap);
  assert.deepEqual(s.pushes, []);
  assert.deepEqual(s.authDeleted, [A, A]);
  await s.call(D, { op: 'deleteMe' });
  assert.equal(s.store.get('users', D).gone, true);
  assert.deepEqual(s.authDeleted, [A, A, D]);
});

test('many games are handled in pages, each page in its own transaction', async () => {
  const s = setup({ deletePage: 3 });
  const ids = [];
  for (let i = 0; i < 4; i++) ids.push(await startGame(s, A, B));
  for (let i = 0; i < 4; i++) ids.push((await s.call(A, { op: 'invite', col: 'w' })).games[0].id);
  s.pushes.length = 0;
  await s.call(A, { op: 'deleteMe' });
  for (const id of ids) assert.equal(s.store.get('games', id).st, 'over');
  assert.equal(s.pushes.length, 4);
  assert.ok(!strings(s.store.dump()).includes(A));
});

test('the Auth user is deleted last: if a step before it fails, the Auth user stays so the player can try again', async () => {
  const w = await world();
  const { s } = w;
  const orig = s.store.tx.bind(s.store);
  let n = 0;
  s.store.tx = async (fn) => {
    if (++n === 2) throw new Error('unavailable');
    return orig(fn);
  };
  await assert.rejects(s.call(A, { op: 'deleteMe' }));
  assert.deepEqual(s.authDeleted, []);
  s.store.tx = orig;
  await s.call(A, { op: 'deleteMe' });
  assert.deepEqual(s.authDeleted, [A]);
  assert.ok(!strings(s.store.dump()).includes(A));
});

test('deleteMe takes no fields', async () => {
  const s = setup();
  await fails(s.call(A, { op: 'deleteMe', g: 'abcdefghijABCDEFGHIJ' }), 'invalid-argument');
  await fails(s.call(A, { op: 'deleteMe', why: 'bye' }), 'invalid-argument');
});

// Fix round 1, fix 1: the ID token stays valid for up to an hour after the Auth user is deleted. A tombstone
// makes every later op fail without bringing any data back.
test('fix 1: after deleteMe every op fails not-found and writes nothing (late sync, resend, hello with a token, invite)', async () => {
  const w = await world();
  const { s } = w;
  await s.call(A, { op: 'deleteMe' });
  const snap = JSON.stringify(s.store.dump());
  const writes = s.store.writeLog.length;
  s.pushes.length = 0;
  for (const data of [
    { op: 'sync', since: 0 }, { op: 'hello', tok: 'push-token-A2' }, { op: 'hello' }, { op: 'invite', col: 'w' },
    { op: 'move', g: w.gAB, ply: 0, from: 'e2', to: 'e4' }, { op: 'resign', g: w.gCA }, { op: 'draw', g: w.gAB, a: 'offer' },
    { op: 'cancel', g: w.gWait }, { op: 'peek', code: w.waiting.code }, { op: 'accept', code: w.waiting.code },
  ]) {
    await fails(s.call(A, data), 'not-found');
  }
  assert.equal(JSON.stringify(s.store.dump()), snap);
  assert.equal(s.store.writeLog.length, writes);
  assert.deepEqual(s.pushes, []);
});

test('fix 1: an invite that runs at the same time as deleteMe leaves no game holding the uid', async () => {
  for (const order of ['invite first', 'deleteMe first']) {
    const s = setup();
    await s.call(A, { op: 'hello' });
    s.store.commitBarrier(2); // both read the user doc before either commits; the first at the barrier commits first
    let inv;
    let del;
    if (order === 'invite first') {
      inv = s.call(A, { op: 'invite', col: 'w' });
      await new Promise((r) => setImmediate(r)); // the invite is now waiting at the barrier
      del = s.call(A, { op: 'deleteMe' });
    } else {
      del = s.call(A, { op: 'deleteMe' });
      inv = s.call(A, { op: 'invite', col: 'w' });
    }
    const [ri, rd] = await Promise.allSettled([inv, del]);
    assert.equal(rd.status, 'fulfilled', order);
    assert.equal(ri.status, order === 'invite first' ? 'fulfilled' : 'rejected', order);
    assert.ok(!strings(s.store.dump()).includes(A), order);
    for (const g of Object.values(s.store.dump().games)) assert.ok(!g.uids.includes(A));
    if (ri.status === 'rejected') assert.equal(ri.reason.status, 'not-found');
    assert.equal(s.store.get('users', A).gone, true);
  }
});

test('fix 1: deleteMe again on a tombstone (a client retry) finishes the clean-up and answers ok', async () => {
  const w = await world();
  const { s } = w;
  // A first try that stopped after the tombstone (the games step failed)
  const orig = s.store.tx.bind(s.store);
  let n = 0;
  s.store.tx = async (fn) => {
    if (++n === 2) throw new Error('unavailable');
    return orig(fn);
  };
  await assert.rejects(s.call(A, { op: 'deleteMe' }));
  s.store.tx = orig;
  assert.equal(s.store.get('users', A).gone, true);
  await fails(s.call(A, { op: 'sync', since: 0 }), 'not-found');
  s.clock.t += 1000;
  const r = await s.call(A, { op: 'deleteMe' });
  assert.deepEqual(r, { now: s.clock.t });
  assert.ok(!strings(s.store.dump()).includes(A));
  assert.deepEqual(s.store.get('games', w.gAB).res, { r: 'b', why: 'abandoned' });
  assert.deepEqual(s.authDeleted, [A]);
});

// Fix round 1, fix 5: a game already past its deadline ends on time, as tick and the ops would end it
test('fix 5: deleteMe on a game past its deadline: the side to move loses on time (both sides)', async () => {
  for (const moverDeletes of [true, false]) {
    const s = setup();
    const g = await startGame(s, A, B);
    await s.call(A, { op: 'move', g, ply: 0, from: 'e2', to: 'e4' }); // Black (B) to move
    s.pushes.length = 0;
    s.clock.t = s.store.get('games', g).dl + 1;
    const leaver = moverDeletes ? B : A;
    const friend = moverDeletes ? A : B;
    await s.call(leaver, { op: 'deleteMe' });
    assert.deepEqual(s.store.get('games', g).res, { r: 'w', why: 'time' }, 'Black was to move and ran out of time');
    assert.deepEqual(s.pushes, [{ to: friend, t: 'over', g }]);
  }
});
