'use strict';
// draw: offer, accept, decline (tech spec section 6; FC-D11, scenario 7). One offer per own move (drawPly).
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, startGame, fails, DAY } = require('./helpers');

const A = 'uid-alice-000000000001'; // challenger, White
const B = 'uid-bob-00000000000002'; // Black
const C = 'uid-carol-000000000003';

async function started() {
  const s = setup();
  s.g = await startGame(s, A, B);
  s.draw = (uid, a) => s.call(uid, { op: 'draw', g: s.g, a });
  s.mv = (uid, ply, from, to) => s.call(uid, { op: 'move', g: s.g, ply, from, to });
  return s;
}

test('scenario 7: an offer shows to both, pushes "draw" to the friend; decline goes on without a push', async () => {
  const s = await started();
  s.clock.t += 1000;
  const r = await s.draw(A, 'offer');
  assert.equal(r.games[0].draw, 'w');
  assert.equal(r.games[0].st, 'active');
  assert.equal(r.games[0].v, 3);
  assert.deepEqual(s.pushes, [{ to: B, t: 'draw', g: s.g }]);
  const doc = s.store.get('games', s.g);
  assert.equal(doc.t, s.clock.t);
  assert.deepEqual(doc.drawPly, { w: 0, b: -1 });
  const dl = doc.dl;
  const sb = await s.call(B, { op: 'sync', since: 0 });
  assert.equal(sb.games[0].draw, 'w', 'Priya sees the offer');
  s.clock.t += 1000;
  const d = await s.draw(B, 'decline');
  assert.equal(d.games[0].draw, null);
  assert.equal(d.games[0].st, 'active');
  assert.equal(d.games[0].v, 4);
  assert.equal(s.store.get('games', s.g).dl, dl, 'the clock is not changed by draw actions');
  assert.equal(s.pushes.length, 1, 'no push for a decline');
  await s.mv(A, 0, 'e2', 'e4'); // the game goes on
});

test('accept ends the game as an agreed draw and pushes "over" to the one who offered', async () => {
  const s = await started();
  await s.mv(A, 0, 'e2', 'e4');
  await s.draw(B, 'offer'); // Black offers on Black's turn
  s.pushes.length = 0;
  s.clock.t += 5000;
  const r = await s.draw(A, 'accept');
  const v = r.games[0];
  assert.equal(v.st, 'over');
  assert.deepEqual(v.res, { r: 'd', why: 'agreed' });
  assert.equal(v.draw, null);
  assert.equal(v.dl, null);
  assert.deepEqual(s.pushes, [{ to: B, t: 'over', g: s.g }]);
  assert.equal(s.store.get('games', s.g).expireAt, s.clock.t + 30 * DAY);
  await fails(s.draw(A, 'accept'), 'failed-precondition', 'over');
  await fails(s.draw(B, 'offer'), 'failed-precondition', 'over');
});

test('one offer per own move: a second offer needs a move of your own in between', async () => {
  const s = await started();
  await s.draw(A, 'offer');
  await fails(s.draw(A, 'offer'), 'failed-precondition', 'draw'); // already open
  await s.draw(B, 'decline');
  await fails(s.draw(A, 'offer'), 'failed-precondition', 'draw'); // no own move since
  await s.mv(A, 0, 'e2', 'e4');
  await s.draw(A, 'offer'); // after White's own move: allowed
  assert.deepEqual(s.store.get('games', s.g).drawPly, { w: 1, b: -1 });
  // Black: offers on White's turn count too; the opponent's moves do not open a new offer
  await s.draw(B, 'decline');
  await s.mv(B, 1, 'e7', 'e5');
  await s.draw(B, 'offer');
  await s.draw(A, 'decline');
  await s.mv(A, 2, 'g1', 'f3');
  await fails(s.draw(B, 'offer'), 'failed-precondition', 'draw'); // White moved, Black did not
  await s.mv(B, 3, 'b8', 'c6');
  await s.draw(B, 'offer');
});

test('a move clears an offer made to the mover, not one made by the mover', async () => {
  const s = await started();
  await s.draw(A, 'offer'); // White offers, then moves: the offer stays for Black
  await s.mv(A, 0, 'e2', 'e4');
  assert.equal(s.store.get('games', s.g).draw, 'w');
  await s.mv(B, 1, 'e7', 'e5'); // Black moves instead of answering: declined
  assert.equal(s.store.get('games', s.g).draw, null);
  await fails(s.draw(B, 'accept'), 'failed-precondition', 'draw');
});

test('accept or decline need an open offer from the friend; your own offer cannot be answered by you', async () => {
  const s = await started();
  await fails(s.draw(B, 'accept'), 'failed-precondition', 'draw');
  await fails(s.draw(B, 'decline'), 'failed-precondition', 'draw');
  await s.draw(A, 'offer');
  const e = await fails(s.draw(A, 'accept'), 'failed-precondition', 'draw');
  assert.equal(e.details.games[0].draw, 'w');
  await fails(s.draw(A, 'decline'), 'failed-precondition', 'draw');
  await fails(s.draw(B, 'offer'), 'failed-precondition', 'draw'); // an offer is already open
});

test('draw: a stranger is not-found; a waiting invite is "turn"', async () => {
  const s = await started();
  await fails(s.draw(C, 'offer'), 'not-found');
  const inv = await s.call(A, { op: 'invite', col: 'w' });
  await fails(s.call(A, { op: 'draw', g: inv.games[0].id, a: 'offer' }), 'failed-precondition', 'turn');
});

test('a draw action after the side to move ran out of time ends the game on time ("late")', async () => {
  const s = await started();
  s.clock.t = s.store.get('games', s.g).dl + 1; // White (to move) is late
  const e = await fails(s.draw(B, 'offer'), 'failed-precondition', 'late');
  assert.deepEqual(e.details.games[0].res, { r: 'b', why: 'time' });
  assert.deepEqual(s.pushes, [{ to: A, t: 'over', g: s.g }]);
});
