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

test('sync pages: "more" is set and games sharing the last time are left for the next call', async () => {
  const s = setup({ syncMax: 3 });
  const ids = [];
  for (let i = 0; i < 5; i++) {
    if (i !== 3) s.clock.t += 10; // games 2 and 3 share a time
    ids.push((await s.call(A, { op: 'invite', col: 'w' })).games[0].id);
  }
  const p1 = await s.call(A, { op: 'sync', since: 0 });
  assert.equal(p1.more, true);
  assert.deepEqual(p1.games.map((g) => g.id), ids.slice(0, 2));
  const p2 = await s.call(A, { op: 'sync', since: p1.games[p1.games.length - 1].t });
  assert.deepEqual(p2.games.map((g) => g.id), ids.slice(2));
  assert.equal(p2.more, false);
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
  assert.deepEqual(Object.keys(view).sort(), ['dl', 'draw', 'exp', 'id', 'me', 'moves', 'opp', 'res', 'st', 't', 'v']);
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
