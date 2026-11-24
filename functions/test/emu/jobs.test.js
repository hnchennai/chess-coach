'use strict';
// The scheduled jobs' core (src/jobs.js) against the Firestore and Auth emulators, with an injected clock: games
// are made over HTTP like the app makes them, then tick and daily run as the deployed functions run them (FsStore,
// the real push sender with a recording fake in place of FCM, the real Auth deleter). This checks the Firestore
// queries and cursors the jobs use. The emulator does not enforce composite indexes, so it does not check them:
// that is a step after the first deploy (functions/README.md). It moves the clock days ahead, so it ends or deletes other test
// files' leftovers too; every check below looks only at this file's own games and players.
const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getFirestore, Timestamp } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');
const { signUp, ok, PROJECT, requireEmulators } = require('./client');
const { FsStore } = require('../../src/fsstore');
const { makeJobs, makeAuthDeleter, makeAuthLastActive } = require('../../src/jobs');
const { makePushSender } = require('../../src/push');

const DAY = 24 * 60 * 60 * 1000;

requireEmulators();
if (!getApps().length) initializeApp({ projectId: PROJECT });
const db = getFirestore();
test.after(async () => {
  await db.terminate();
});

const sent = [];
const logs = [];
const store = new FsStore(db);
const clock = { t: Date.now() };
const jobs = makeJobs({
  store,
  now: () => clock.t,
  push: makePushSender({ store, messaging: { send: async (m) => { sent.push(m); return 'fake'; } }, log: (...a) => logs.push(a) }),
  log: (...a) => logs.push(a),
  deleteAuthUser: makeAuthDeleter(getAuth()),
  authLastActive: makeAuthLastActive(getAuth()),
});

// Messages sent for one game: [token, type]
const sentFor = (g) => sent.filter((m) => m.data.g === g).map((m) => [m.token, m.data.t]);

async function started() {
  const a = await signUp();
  const b = await signUp();
  await ok(a.token, { op: 'hello', tok: 'emu-token-' + a.uid });
  await ok(b.token, { op: 'hello', tok: 'emu-token-' + b.uid });
  const inv = await ok(a.token, { op: 'invite', col: 'w' });
  await ok(b.token, { op: 'accept', code: inv.code });
  return { a, b, g: inv.games[0].id };
}

let remindGame;
let timeGame;
let waiting;

test('setup: an active game, a game with a move, and a waiting invite', async () => {
  remindGame = await started();
  timeGame = await started();
  await ok(timeGame.a.token, { op: 'move', g: timeGame.g, ply: 0, from: 'e2', to: 'e4' });
  const w = await signUp();
  waiting = { w, inv: await ok(w.token, { op: 'invite', col: 'b' }) };
});

test('tick, 2.5 days on: one "remind" push to the side to move, with the stored token; rem cleared', async () => {
  clock.t = Date.now() + 2.5 * DAY;
  await jobs.tick();
  const g = remindGame.g;
  assert.deepEqual(sentFor(g), [['emu-token-' + remindGame.a.uid, 'remind']], 'White is to move');
  assert.deepEqual(sentFor(timeGame.g), [['emu-token-' + timeGame.b.uid, 'remind']], 'Black is to move');
  const doc = await db.collection('games').doc(g).get();
  assert.equal(doc.get('rem'), null);
  assert.equal(doc.get('st'), 'active');
  const m = sent.find((x) => x.data.g === g);
  assert.deepEqual(m.android, { priority: 'high', notification: { channelId: 'friend', tag: g } });
  await jobs.tick();
  assert.equal(sentFor(g).length, 1, 'only once');
});

test('tick, 4 days on: games past the deadline end on time, the side to move loses, "over" to both', async () => {
  clock.t = Date.now() + 4 * DAY;
  await jobs.tick();
  const doc = await db.collection('games').doc(timeGame.g).get();
  assert.equal(doc.get('st'), 'over');
  assert.deepEqual(doc.get('res'), { r: 'w', why: 'time' });
  assert.equal(doc.get('dl'), null);
  assert.ok(doc.get('expireAt') instanceof Timestamp);
  assert.equal(doc.get('expireAt').toMillis(), clock.t + 30 * DAY);
  assert.deepEqual(sentFor(timeGame.g).slice(1).map((x) => x[1]).sort(), ['over', 'over']);
  assert.deepEqual((await db.collection('games').doc(remindGame.g).get()).get('res'), { r: 'b', why: 'time' });
  // Both players see it
  const sa = await ok(timeGame.a.token, { op: 'sync', since: 0 });
  assert.deepEqual(sa.games.find((x) => x.id === timeGame.g).res, { r: 'w', why: 'time' });
});

test('tick, 8 days on: the waiting invite ends expired and frees its slot; no push', async () => {
  clock.t = Date.now() + 8 * DAY;
  await jobs.tick();
  const doc = await db.collection('games').doc(waiting.inv.games[0].id).get();
  assert.equal(doc.get('st'), 'over');
  assert.deepEqual(doc.get('res'), { r: null, why: 'expired' });
  assert.equal(doc.get('code'), null);
  assert.deepEqual(sentFor(waiting.inv.games[0].id), []);
  const s = await ok(waiting.w.token, { op: 'sync', since: 0 });
  assert.equal(s.games.find((x) => x.id === waiting.inv.games[0].id).st, 'over');
});

test('a dead token is removed from the user doc', async () => {
  const p = await signUp();
  await ok(p.token, { op: 'hello', tok: 'emu-dead-token' });
  const push = makePushSender({
    store,
    messaging: { send: async () => { const e = new Error('gone'); e.code = 'messaging/registration-token-not-registered'; throw e; } },
    log: () => {},
  });
  assert.equal(await push({ to: p.uid, t: 'move', g: 'abcdefghijABCDEFGHIJ' }), false);
  assert.equal((await db.collection('users').doc(p.uid).get()).get('tok'), null);
});

test('daily, 61 days on: an idle ID with no open game is deleted with its Auth user; one with an open game stays', async () => {
  const idle = await signUp();
  await ok(idle.token, { op: 'hello' });
  const busy = await signUp();
  const inv = await ok(busy.token, { op: 'invite', col: 'w' });
  // keep busy's game open past the clock jump (as if the friend kept it alive)
  await db.collection('games').doc(inv.games[0].id).update({ st: 'active', expireAt: null });
  clock.t = Date.now() + 61 * DAY;
  const r = await jobs.daily();
  assert.ok(r.deleted >= 1);
  assert.equal((await db.collection('users').doc(idle.uid).get()).exists, false);
  await assert.rejects(getAuth().getUser(idle.uid), (e) => e.code === 'auth/user-not-found');
  assert.equal((await db.collection('users').doc(busy.uid).get()).exists, true);
  assert.ok((await getAuth().getUser(busy.uid)).uid);
});

test('daily finishes a deleteMe that stopped after the tombstone (round 2 fix 1)', async () => {
  const p = await signUp();
  const q = await signUp();
  const inv = await ok(p.token, { op: 'invite', col: 'w' });
  await ok(q.token, { op: 'accept', code: inv.code });
  const waiting = await ok(p.token, { op: 'invite', col: 'r' });
  // what a deleteMe that failed right after its first step leaves behind
  await db.collection('users').doc(p.uid).set({ gone: true, at: Date.now() });
  clock.t = Date.now() + 2 * 60 * 60 * 1000;
  const r = await jobs.daily();
  assert.ok(r.finished >= 1);
  assert.equal((await db.collection('games').where('uids', 'array-contains', p.uid).get()).size, 0);
  assert.deepEqual((await db.collection('games').doc(inv.games[0].id).get()).get('res'), { r: 'b', why: 'abandoned' });
  assert.equal((await db.collection('invites').doc(waiting.code).get()).exists, false);
  await assert.rejects(getAuth().getUser(p.uid), (e) => e.code === 'auth/user-not-found');
  const tomb = (await db.collection('users').doc(p.uid).get()).data();
  assert.deepEqual(Object.keys(tomb).sort(), ['expireAt', 'gone']);
  assert.ok(tomb.expireAt instanceof Timestamp);
});

test('job logs carry no uid or token', () => {
  const text = JSON.stringify(logs);
  for (const x of [remindGame, timeGame]) {
    for (const u of [x.a.uid, x.b.uid]) {
      assert.ok(!text.includes(u), text);
    }
  }
  assert.ok(!text.includes('emu-token-'), text);
});
