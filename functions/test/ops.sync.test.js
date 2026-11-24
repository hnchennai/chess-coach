'use strict';
// sync, and what is stored and returned (tech spec sections 5 and 6; product criterion 5, FC-D5).
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, strings } = require('./helpers');

const A = 'uid-alice-000000000001';
const B = 'uid-bob-00000000000002';
const C = 'uid-carol-000000000003';

test('sync returns only games of mine changed after "since", with the server time', async () => {
  const s = setup();
  const g1 = await s.call(A, { op: 'invite', col: 'w' });
  s.clock.t += 10;
  const g2 = await s.call(A, { op: 'invite', col: 'b' });
  await s.call(C, { op: 'invite', col: 'w' }); // not mine
  const all = await s.call(A, { op: 'sync', since: 0 });
  assert.equal(all.now, s.clock.t);
  assert.deepEqual(all.games.map((g) => g.id), [g1.games[0].id, g2.games[0].id]);
  assert.equal(all.more, false);
  const t1 = g1.games[0].t;
  const later = await s.call(A, { op: 'sync', since: t1 });
  assert.deepEqual(later.games.map((g) => g.id), [g2.games[0].id]);
  s.clock.t += 10;
  await s.call(B, { op: 'accept', code: g1.code });
  const after = await s.call(A, { op: 'sync', since: all.games[1].t });
  assert.deepEqual(after.games.map((g) => g.id), [g1.games[0].id]);
  assert.equal(after.games[0].st, 'active');
  const none = await s.call(A, { op: 'sync', since: s.clock.t });
  assert.deepEqual(none.games, []);
});

test('answers never carry a uid, and the view has only the documented fields', async () => {
  const s = setup();
  const answers = [];
  const inv = await s.call(A, { op: 'invite', col: 'w' });
  answers.push(inv, await s.call(B, { op: 'peek', code: inv.code }));
  answers.push(await s.call(B, { op: 'accept', code: inv.code }));
  answers.push(await s.call(A, { op: 'move', g: inv.games[0].id, ply: 0, from: 'e2', to: 'e4' }));
  answers.push(await s.call(A, { op: 'sync', since: 0 }), await s.call(B, { op: 'sync', since: 0 }));
  answers.push(await s.call(A, { op: 'hello', tok: 'push-token-A' }));
  for (const a of answers) {
    for (const str of strings(a)) {
      assert.ok(!str.includes(A) && !str.includes(B), 'uid leaked: ' + str);
      assert.notEqual(str, 'push-token-A');
    }
  }
  const view = answers[4].games[0];
  assert.deepEqual(Object.keys(view).sort(), ['code', 'dl', 'draw', 'exp', 'id', 'me', 'moves', 'opp', 'res', 'st', 't', 'v']);
});

test('criterion 5: the server stores no names or free text, only ids, codes, tokens, moves and fixed values', async () => {
  const s = setup();
  await s.call(A, { op: 'hello', tok: 'push-token-A' });
  await s.call(B, { op: 'hello', tok: 'push-token-B' });
  const i1 = await s.call(A, { op: 'invite', col: 'r' });
  const i2 = await s.call(A, { op: 'invite', col: 'w' });
  await s.call(B, { op: 'accept', code: i1.code });
  await s.call(A, { op: 'cancel', g: i2.games[0].id });
  const g = i1.games[0].id;
  const white = s.store.get('games', g).w;
  const black = white === A ? B : A;
  await s.call(white, { op: 'move', g, ply: 0, from: 'g1', to: 'f3' });
  await s.call(black, { op: 'move', g, ply: 1, from: 'g8', to: 'f6' });
  const known = new Set([A, B, 'push-token-A', 'push-token-B', i1.code, i1.games[0].id, i2.games[0].id,
    'w', 'b', 'r', 'd', 'invited', 'active', 'over', 'expired', 'Nf3', 'Nf6']);
  const fen = /^[rnbqkpRNBQKP1-8/]+ [wb] [KQkq-]+ [a-h1-8-]+ \d+ \d+$/;
  const day = /^\d{4}-\d{2}-\d{2}$/;
  for (const str of strings(s.store.dump())) {
    assert.ok(known.has(str) || fen.test(str) || day.test(str), 'unexpected stored string: ' + str);
  }
});

// Fix round 1, fix 1: the sync cursor. t comes from the clock before the transaction, so t order is not commit order.
const LAG = 120000;

function seedGame(s, id, uid, t, extra = {}) {
  s.store.put('games', id, {
    uids: [uid, 'uid-other-0000000000009'], w: uid, b: 'uid-other-0000000000009', by: uid, col: 'w', st: 'active',
    moves: [], fen: 'x', dl: t + 1, rem: null, draw: null, drawPly: { w: -1, b: -1 }, res: null, v: 2, t0: t, t,
    expireAt: null, code: null, ...extra,
  });
}

test('sync returns next = now - 2 minutes; a game written with an older t that commits after a sync comes in the next sync', async () => {
  const s = setup();
  s.clock.t += 10 * 60 * 1000;
  const r1 = await s.call(A, { op: 'sync', since: 0 });
  assert.equal(r1.now, s.clock.t);
  assert.equal(r1.next, s.clock.t - LAG);
  assert.equal(r1.more, false);
  // a slow transaction took its time 5 s before that sync and committed just after it
  seedGame(s, 'lateCommitGameAAAAAA', A, r1.now - 5000);
  s.clock.t += 1000;
  const r2 = await s.call(A, { op: 'sync', since: r1.next });
  assert.deepEqual(r2.games.map((g) => g.id), ['lateCommitGameAAAAAA']);
});

test('a game repeated in two answers is the same game (the client keeps the higher v)', async () => {
  const s = setup();
  const inv = await s.call(A, { op: 'invite', col: 'w' });
  const r1 = await s.call(A, { op: 'sync', since: 0 });
  const r2 = await s.call(A, { op: 'sync', since: r1.next });
  assert.deepEqual(r2.games, r1.games);
  assert.equal(r2.games[0].id, inv.games[0].id);
});

test('paging with "more" never loses a game, including games that share a time, and always ends', async () => {
  const s = setup({ syncMax: 3 });
  const want = [];
  for (let i = 0; i < 11; i++) {
    const id = ('pageGame' + String(i).padStart(2, '0')).padEnd(20, 'A');
    seedGame(s, id, A, s.clock.t - 300000 + Math.floor(i / 2) * 40000); // pairs share a time, some inside the last 2 min
    want.push(id);
  }
  const got = new Set();
  let since = 0;
  let calls = 0;
  for (;;) {
    const r = await s.call(A, { op: 'sync', since });
    r.games.forEach((g) => got.add(g.id));
    assert.ok(r.next >= 0);
    since = r.next;
    if (!r.more) break;
    assert.ok(++calls < 20, 'paging must end');
  }
  assert.deepEqual([...got].sort(), want.sort());
});

test('fix 2: at most 25 games per sync answer', async () => {
  const s = setup();
  for (let i = 0; i < 30; i++) seedGame(s, ('many' + String(i).padStart(2, '0')).padEnd(20, 'B'), A, s.clock.t - 1000000 + i);
  const r = await s.call(A, { op: 'sync', since: 0 });
  assert.equal(r.games.length, 25);
  assert.equal(r.more, true);
});

test('fix 3: seen is written at most every 6 hours unless the op writes the user anyway', async () => {
  const s = setup();
  const userWrites = () => s.store.writeLog.filter(([c, id]) => c === 'users' && id === A).length;
  await s.call(A, { op: 'sync', since: 0 });
  await s.call(A, { op: 'sync', since: 0 });
  assert.equal(userWrites(), 1, 'two syncs in a row write the user doc once');
  s.clock.t += 6 * 60 * 60 * 1000 - 1;
  await s.call(A, { op: 'sync', since: 0 });
  assert.equal(userWrites(), 1);
  s.clock.t += 1;
  await s.call(A, { op: 'sync', since: 0 });
  assert.equal(userWrites(), 2, 'after 6 hours seen is written again');
  assert.equal(s.store.get('users', A).seen, s.clock.t);
  await s.call(A, { op: 'invite', col: 'w' });
  assert.equal(userWrites(), 3, 'invite writes the user (invite count) anyway');
  await s.call(A, { op: 'hello', tok: 'tok-new' });
  assert.equal(userWrites(), 4, 'a new token is written at once');
  assert.equal(s.store.get('users', A).tok, 'tok-new');
});

test('fix 6: only the owner sees the code of an invited game, so a lost invite answer can be recovered', async () => {
  const s = setup();
  const inv = await s.call(A, { op: 'invite', col: 'w' });
  assert.equal(inv.games[0].code, inv.code);
  const sa = await s.call(A, { op: 'sync', since: 0 }); // as if the invite answer was lost
  assert.equal(sa.games[0].code, inv.code);
  const acc = await s.call(B, { op: 'accept', code: inv.code });
  assert.equal(acc.games[0].code, null);
  const sa2 = await s.call(A, { op: 'sync', since: 0 });
  assert.equal(sa2.games[0].code, null, 'no code once accepted');
  assert.equal(s.store.get('games', inv.games[0].id).code, null);
  const i2 = await s.call(A, { op: 'invite', col: 'b' });
  const c = await s.call(A, { op: 'cancel', g: i2.games[0].id });
  assert.equal(c.games[0].code, null);
  assert.equal(s.store.get('invites', i2.code), undefined, 'cancel still deletes the invite');
  const sc = await s.call(C, { op: 'sync', since: 0 });
  assert.deepEqual(sc.games, [], 'nobody else ever sees an invited game or its code');
});

test('paging ends even when more than one page of games changed in the last 2 minutes', async () => {
  const s = setup({ syncMax: 3 });
  const want = [];
  for (let i = 0; i < 8; i++) {
    const id = ('recent' + i).padEnd(20, 'C');
    seedGame(s, id, A, s.clock.t - 60000 + i * 1000);
    want.push(id);
  }
  const got = new Set();
  let since = 0;
  for (let calls = 0; ; calls++) {
    assert.ok(calls < 20, 'paging must end');
    const r = await s.call(A, { op: 'sync', since });
    r.games.forEach((g) => got.add(g.id));
    since = r.next;
    if (!r.more) break;
  }
  assert.deepEqual([...got].sort(), want.sort());
  assert.equal(since, s.clock.t - LAG, 'the final cursor goes back to now - 2 minutes');
});
