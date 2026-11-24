'use strict';
// The scheduled jobs' core (tech spec section 6): tick (time-outs, 1-day reminders, invite expiry) and daily
// (idle ID clean-up), on the in-memory store with an injected clock and a push recorder.
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, startGame, fails, strings, DAY } = require('./helpers');
const { makeAuthDeleter } = require('../src/jobs');

const A = 'uid-alice-000000000001'; // challenger, White
const B = 'uid-bob-00000000000002'; // Black
const C = 'uid-carol-000000000003';

const byTo = (ps) => ps.slice().sort((x, y) => (x.to + x.t).localeCompare(y.to + y.t));

test('scenario 5: tick ends an active game on time when the deadline has passed; the side to move loses; push "over" to both', async () => {
  const s = setup();
  const g = await startGame(s, A, B);
  await s.call(A, { op: 'move', g, ply: 0, from: 'e2', to: 'e4' });
  s.pushes.length = 0;
  const dl = s.store.get('games', g).dl;
  s.clock.t = dl; // on the deadline Black is still in time (as for move)
  let r = await s.jobs.tick();
  assert.equal(s.store.get('games', g).st, 'active');
  assert.equal(r.time, 0);
  s.clock.t = dl + 1;
  s.pushes.length = 0; // (the reminder was due too)
  r = await s.jobs.tick();
  assert.equal(r.time, 1);
  const doc = s.store.get('games', g);
  assert.equal(doc.st, 'over');
  assert.deepEqual(doc.res, { r: 'w', why: 'time' });
  assert.equal(doc.dl, null);
  assert.equal(doc.rem, null);
  assert.equal(doc.t, s.clock.t);
  assert.equal(doc.v, 4);
  assert.equal(doc.expireAt, s.clock.t + 30 * DAY);
  assert.deepEqual(byTo(s.pushes), [{ to: A, t: 'over', g }, { to: B, t: 'over', g }]);
  // Both phones see the result
  assert.deepEqual((await s.call(A, { op: 'sync', since: 0 })).games[0].res, { r: 'w', why: 'time' });
  assert.deepEqual((await s.call(B, { op: 'sync', since: 0 })).games[0].res, { r: 'w', why: 'time' });
  s.pushes.length = 0;
  assert.equal((await s.jobs.tick()).time, 0);
  assert.deepEqual(s.pushes, []);
});

test('FC-D6: tick sends one "remind" push to the side to move when 1 day is left, then clears rem', async () => {
  const s = setup();
  const g = await startGame(s, A, B);
  const before = s.store.get('games', g);
  s.clock.t = before.rem - 1;
  await s.jobs.tick();
  assert.deepEqual(s.pushes, []);
  s.clock.t = before.rem;
  const r = await s.jobs.tick();
  assert.equal(r.remind, 1);
  assert.deepEqual(s.pushes, [{ to: A, t: 'remind', g }], 'White is to move');
  const doc = s.store.get('games', g);
  assert.equal(doc.rem, null);
  assert.equal(doc.v, before.v, 'not a change the players see: v and t stay');
  assert.equal(doc.t, before.t);
  s.clock.t += 1000;
  await s.jobs.tick();
  assert.equal(s.pushes.length, 1, 'only one reminder per move');
  // the next move sets a new reminder, for the other side
  await s.call(A, { op: 'move', g, ply: 0, from: 'e2', to: 'e4' });
  s.pushes.length = 0;
  s.clock.t = s.store.get('games', g).rem;
  await s.jobs.tick();
  assert.deepEqual(s.pushes, [{ to: B, t: 'remind', g }]);
});

test('a game already late gets "over", not a reminder', async () => {
  const s = setup();
  const g = await startGame(s, A, B);
  s.clock.t = s.store.get('games', g).dl + 1;
  const r = await s.jobs.tick();
  assert.equal(r.time, 1);
  assert.equal(r.remind, 0);
  assert.ok(s.pushes.every((p) => p.t === 'over'));
});

test('tick re-checks inside the transaction: a move that lands between the query and the change wins', async () => {
  const s = setup();
  const g = await startGame(s, A, B);
  s.clock.t = s.store.get('games', g).dl + 1;
  const due = s.store.due.bind(s.store);
  s.store.due = async (...a) => {
    const rows = await due(...a);
    const doc = s.store.get('games', g);
    if (rows.length && doc.st === 'active') {
      // the move commits now, with a new deadline and reminder (as if it arrived just in time)
      s.store.put('games', g, { ...doc, moves: ['e4'], dl: s.clock.t + 3 * DAY, rem: s.clock.t + 2 * DAY, v: doc.v + 1 });
    }
    return rows;
  };
  const r = await s.jobs.tick();
  assert.equal(r.time, 0);
  assert.equal(r.remind, 0);
  assert.equal(s.store.get('games', g).st, 'active');
  assert.deepEqual(s.pushes, []);
});

test('tick ends invites past their 7 days as expired (no push), so they stop counting toward the 10 open games', async () => {
  const s = setup();
  const ids = [];
  for (let i = 0; i < 10; i++) ids.push((await s.call(A, { op: 'invite', col: 'r' })).games[0].id);
  const exp = s.store.get('games', ids[0]).expireAt;
  s.clock.t = exp; // on the expiry time the invite is still good (as for peek and accept)
  assert.equal((await s.jobs.tick()).expired, 0);
  s.clock.t = exp + 1;
  await fails(s.call(A, { op: 'invite', col: 'r' }), 'failed-precondition', 'full');
  const r = await s.jobs.tick();
  assert.equal(r.expired, 10);
  for (const id of ids) {
    const g = s.store.get('games', id);
    assert.equal(g.st, 'over');
    assert.deepEqual(g.res, { r: null, why: 'expired' });
    assert.equal(g.code, null);
    assert.equal(g.expireAt, s.clock.t + 30 * DAY);
  }
  assert.deepEqual(s.pushes, []);
  await s.call(A, { op: 'invite', col: 'r' });
  // The owner sees it ended; the old code still says expired
  const sa = await s.call(A, { op: 'sync', since: 0 });
  assert.ok(sa.games.filter((x) => ids.includes(x.id)).every((x) => x.res.why === 'expired' && x.code === null));
});

test('an invite accepted just before tick runs is not expired by it', async () => {
  const s = setup();
  const inv = await s.call(A, { op: 'invite', col: 'w' });
  const g = inv.games[0].id;
  s.clock.t = s.store.get('games', g).expireAt + 1;
  const due = s.store.due.bind(s.store);
  s.store.due = async (...a) => {
    const rows = await due(...a);
    const doc = s.store.get('games', g);
    if (rows.length && doc.st === 'invited') s.store.put('games', g, { ...doc, st: 'active', uids: [A, B], b: B, expireAt: null, dl: s.clock.t + 3 * DAY, rem: s.clock.t + 2 * DAY });
    return rows;
  };
  assert.equal((await s.jobs.tick()).expired, 0);
  assert.equal(s.store.get('games', g).st, 'active');
});

test('a run is bounded: pages of "page" games, at most "max" changes per kind; the rest is done next run', async () => {
  const s = setup({ page: 4, max: 10 });
  const ids = [];
  for (let i = 0; i < 13; i++) ids.push(await startGame(s, 'uid-white-' + String(i).padStart(12, '0'), 'uid-black-' + String(i).padStart(12, '0')));
  s.clock.t += 4 * DAY;
  const r1 = await s.jobs.tick();
  assert.equal(r1.time, 10);
  assert.equal(r1.more, true);
  assert.equal(ids.filter((id) => s.store.get('games', id).st === 'over').length, 10);
  const r2 = await s.jobs.tick();
  assert.equal(r2.time, 3);
  assert.equal(r2.more, false);
  assert.ok(ids.every((id) => s.store.get('games', id).st === 'over'));
});

test('paging moves past games it leaves alone (no endless loop on a game that is due but not changed)', async () => {
  const s = setup({ page: 2, max: 50 });
  const ids = [];
  for (let i = 0; i < 5; i++) ids.push(await startGame(s, A, B));
  s.clock.t += 4 * DAY;
  // a game whose stored deadline says due, but the re-check says in time: never changed, must be skipped
  const due = s.store.due.bind(s.store);
  let calls = 0;
  s.store.due = async (...a) => {
    calls++;
    return due(...a);
  };
  const realTx = s.store.tx.bind(s.store);
  s.store.tx = async (fn) => realTx(async (t) => {
    const game = t.game;
    t.game = async (id) => {
      const g = await game(id);
      return id === ids[0] && g ? { ...g, dl: s.clock.t + DAY } : g;
    };
    return fn(t);
  });
  const r = await s.jobs.tick();
  assert.equal(r.time, 4);
  assert.ok(calls < 20, 'bounded number of queries: ' + calls);
});

test('a failing push never stops the run, and logs carry no uid or token', async () => {
  const s = setup({ push: async () => { throw new Error('push failed for ' + A); } });
  const g1 = await startGame(s, A, B);
  const g2 = await startGame(s, C, B);
  s.clock.t += 4 * DAY;
  const r = await s.jobs.tick();
  assert.equal(r.time, 2);
  assert.equal(s.store.get('games', g1).st, 'over');
  assert.equal(s.store.get('games', g2).st, 'over');
  assert.ok(s.logs.length >= 1);
  const text = JSON.stringify(s.logs);
  for (const u of [A, B, C]) assert.ok(!text.includes(u), text);
});

// An open game for uid that tick leaves alone (no deadline due)
function openGame(s, id, uid) {
  s.store.put('games', id, { uids: [uid, 'uid-zed-00000000000009'], st: 'active', moves: [], dl: null, rem: null, t: 1, v: 2 });
}

test('daily deletes user docs not seen for 60 days with no open game, and their Auth users', async () => {
  const s = setup();
  await s.call(A, { op: 'hello', tok: 'push-token-A' }); // idle, nothing open
  await s.call(B, { op: 'hello' }); // idle, but a game is open
  openGame(s, 'openGameForBobAAAAAA', B);
  s.clock.t += DAY;
  await s.call(C, { op: 'hello' }); // seen a day later
  const seenA = s.store.get('users', A).seen;
  s.clock.t = seenA + 60 * DAY; // exactly 60 days: kept
  let r = await s.jobs.daily();
  assert.equal(r.deleted, 0);
  s.clock.t = seenA + 60 * DAY + 1;
  r = await s.jobs.daily();
  assert.equal(r.deleted, 1);
  assert.equal(s.store.get('users', A), undefined);
  assert.ok(s.store.get('users', B), 'an open game keeps the ID');
  assert.ok(s.store.get('users', C), 'seen less than 60 days ago');
  assert.deepEqual(s.authDeleted, [A]);
  assert.ok(!JSON.stringify(s.logs).includes(A));
});

test('daily re-checks inside the transaction: a player seen again just now is kept', async () => {
  const s = setup();
  await s.call(A, { op: 'hello' });
  s.clock.t += 61 * DAY;
  const idle = s.store.idleUsers.bind(s.store);
  s.store.idleUsers = async (...a) => {
    const rows = await idle(...a);
    s.store.put('users', A, { ...s.store.get('users', A), seen: s.clock.t });
    return rows;
  };
  const r = await s.jobs.daily();
  assert.equal(r.deleted, 0);
  assert.ok(s.store.get('users', A));
  assert.deepEqual(s.authDeleted, []);
});

test('daily is bounded per run ("max" users looked at) and moves past kept users', async () => {
  const s = setup({ page: 3, max: 5 });
  const uids = [];
  for (let i = 0; i < 8; i++) {
    const u = 'uid-idle-' + String(i).padStart(13, '0');
    uids.push(u);
    await s.call(u, { op: 'hello' });
  }
  // the first two have an open game
  openGame(s, 'openGameIdle0AAAAAAA', uids[0]);
  openGame(s, 'openGameIdle1AAAAAAA', uids[1]);
  s.clock.t += 61 * DAY;
  const r1 = await s.jobs.daily(); // looks at 0 to 4
  assert.deepEqual([r1.deleted, r1.more], [3, true]);
  const r2 = await s.jobs.daily(); // 0, 1 (kept), 5, 6, 7
  assert.deepEqual([r2.deleted, r2.more], [3, true]);
  const r3 = await s.jobs.daily(); // 0, 1
  assert.deepEqual([r3.deleted, r3.more], [0, false]);
  assert.ok(s.store.get('users', uids[0]));
  assert.ok(s.store.get('users', uids[1]));
  for (const u of uids.slice(2)) assert.equal(s.store.get('users', u), undefined);
  assert.equal(s.authDeleted.length, 6);
  assert.ok(!strings(s.logs).some((x) => x.includes('uid-idle')));
});

test('the Auth deleter treats "user not found" as done and passes other errors on', async () => {
  const gone = makeAuthDeleter({ deleteUser: async () => { const e = new Error('no user'); e.code = 'auth/user-not-found'; throw e; } });
  await gone('u1');
  const down = makeAuthDeleter({ deleteUser: async () => { const e = new Error('down'); e.code = 'auth/internal-error'; throw e; } });
  await assert.rejects(down('u1'), /down/);
  const seen = [];
  await makeAuthDeleter({ deleteUser: async (u) => { seen.push(u); } })('u2');
  assert.deepEqual(seen, ['u2']);
});
