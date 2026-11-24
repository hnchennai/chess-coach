'use strict';
// resign (tech spec section 6; FC-D11).
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, startGame, fails, DAY } = require('./helpers');

const A = 'uid-alice-000000000001'; // challenger, White
const B = 'uid-bob-00000000000002'; // Black
const C = 'uid-carol-000000000003';

test('resign ends the game: the friend wins, push "over" to the friend only, kept 30 days', async () => {
  const s = setup();
  const g = await startGame(s, A, B);
  s.clock.t += 1000;
  const r = await s.call(A, { op: 'resign', g });
  const v = r.games[0];
  assert.equal(r.now, s.clock.t);
  assert.equal(v.id, g);
  assert.equal(v.st, 'over');
  assert.deepEqual(v.res, { r: 'b', why: 'resign' });
  assert.equal(v.dl, null);
  assert.equal(v.v, 3);
  assert.deepEqual(s.pushes, [{ to: B, t: 'over', g }]);
  const doc = s.store.get('games', g);
  assert.equal(doc.st, 'over');
  assert.equal(doc.rem, null);
  assert.equal(doc.draw, null);
  assert.equal(doc.t, s.clock.t);
  assert.equal(doc.expireAt, s.clock.t + 30 * DAY);
});

test('either player can resign on either turn', async () => {
  const s = setup();
  const g = await startGame(s, A, B);
  const r = await s.call(B, { op: 'resign', g }); // White to move, Black resigns
  assert.deepEqual(r.games[0].res, { r: 'w', why: 'resign' });
  assert.equal(r.games[0].me, 'b');
  assert.deepEqual(s.pushes, [{ to: A, t: 'over', g }]);
});

test('resign: a stranger or an unknown game is not-found; a waiting invite is "turn"; a finished game is "over"', async () => {
  const s = setup();
  const g = await startGame(s, A, B);
  await fails(s.call(C, { op: 'resign', g }), 'not-found');
  await fails(s.call(A, { op: 'resign', g: 'ZZZZZZZZZZZZZZZZZZZZ' }), 'not-found');
  const inv = await s.call(A, { op: 'invite', col: 'r' });
  const e1 = await fails(s.call(A, { op: 'resign', g: inv.games[0].id }), 'failed-precondition', 'turn');
  assert.equal(e1.details.games[0].st, 'invited');
  await s.call(A, { op: 'resign', g });
  s.pushes.length = 0;
  const e2 = await fails(s.call(B, { op: 'resign', g }), 'failed-precondition', 'over');
  assert.deepEqual(e2.details.games[0].res, { r: 'b', why: 'resign' });
  assert.deepEqual(s.pushes, []);
});

test('resign after the side to move ran out of time: the game ends on time instead ("late")', async () => {
  const s = setup();
  const g = await startGame(s, A, B);
  await s.call(A, { op: 'move', g, ply: 0, from: 'e2', to: 'e4' });
  s.pushes.length = 0;
  s.clock.t = s.store.get('games', g).dl + 1; // Black (to move) is late
  const e = await fails(s.call(A, { op: 'resign', g }), 'failed-precondition', 'late');
  assert.deepEqual(e.details.games[0].res, { r: 'w', why: 'time' }, 'White wins on time, not by resigning');
  assert.deepEqual(s.store.get('games', g).res, { r: 'w', why: 'time' });
  assert.deepEqual(s.pushes, [{ to: B, t: 'over', g }]);
});
