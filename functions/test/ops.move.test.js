'use strict';
// move (tech spec section 6; product scenarios 4, 5 and 6, criteria 2 and 3, FC-D6, FC-D11, FC-D13).
const test = require('node:test');
const assert = require('node:assert/strict');
const { setup, fails, DAY } = require('./helpers');

const A = 'uid-alice-000000000001'; // challenger, White
const B = 'uid-bob-00000000000002'; // Black
const C = 'uid-carol-000000000003';

async function started() {
  const s = setup();
  const inv = await s.call(A, { op: 'invite', col: 'w' });
  await s.call(B, { op: 'accept', code: inv.code });
  s.pushes.length = 0;
  s.g = inv.games[0].id;
  s.mv = (uid, ply, from, to, promo) => {
    const d = { op: 'move', g: s.g, ply, from, to };
    if (promo) d.promo = promo;
    return s.call(uid, d);
  };
  return s;
}

test('scenario 4: moves both ways; each move pushes "move" to the opponent and sets a new deadline', async () => {
  const s = await started();
  s.clock.t += 1000;
  const r1 = await s.mv(A, 0, 'e2', 'e4');
  assert.deepEqual(r1.games[0].moves, ['e4']);
  assert.equal(r1.games[0].me, 'w');
  assert.equal(r1.games[0].dl, s.clock.t + 3 * DAY);
  assert.equal(r1.games[0].v, 3);
  assert.deepEqual(s.pushes, [{ to: B, t: 'move', g: s.g }]);
  s.clock.t += DAY;
  const r2 = await s.mv(B, 1, 'e7', 'e5');
  assert.deepEqual(r2.games[0].moves, ['e4', 'e5']);
  assert.equal(r2.games[0].me, 'b');
  assert.deepEqual(s.pushes[1], { to: A, t: 'move', g: s.g });
  const g = s.store.get('games', s.g);
  assert.equal(g.dl, s.clock.t + 3 * DAY);
  assert.equal(g.rem, s.clock.t + 2 * DAY);
  assert.match(g.fen, /^rnbqkbnr\/pppp1ppp\/8\/4p3\/4P3\/8\/PPPP1PPP\/RNBQKBNR w /);
  // criterion 3: both sides see the same moves
  const sa = await s.call(A, { op: 'sync', since: 0 });
  const sb = await s.call(B, { op: 'sync', since: 0 });
  assert.deepEqual(sa.games[0].moves, sb.games[0].moves);
  assert.equal(sa.games[0].v, sb.games[0].v);
});

test('scenario 6: an illegal move is rejected and the game does not change', async () => {
  const s = await started();
  const before = JSON.stringify(s.store.get('games', s.g));
  const e = await fails(s.mv(A, 0, 'e2', 'e5'), 'failed-precondition', 'illegal');
  assert.equal(e.details.games[0].v, 2);
  await fails(s.mv(A, 0, 'e7', 'e5'), 'failed-precondition', 'illegal'); // Black's pawn on White's turn
  assert.equal(JSON.stringify(s.store.get('games', s.g)), before);
  assert.deepEqual(s.pushes, []);
});

test('scenario 6: a move out of turn is rejected "turn" and the game does not change', async () => {
  const s = await started();
  const before = JSON.stringify(s.store.get('games', s.g));
  await fails(s.mv(B, 0, 'e7', 'e5'), 'failed-precondition', 'turn');
  await s.mv(A, 0, 'e2', 'e4');
  await fails(s.mv(A, 1, 'd2', 'd4'), 'failed-precondition', 'turn');
  await fails(s.mv(B, 0, 'e7', 'e5'), 'failed-precondition', 'turn'); // stale ply
  await fails(s.mv(B, 2, 'e7', 'e5'), 'failed-precondition', 'turn'); // ply from the future
  assert.notEqual(JSON.stringify(s.store.get('games', s.g)), before);
  assert.deepEqual(s.store.get('games', s.g).moves, ['e4']);
});

test('only the two players can move; a game still waiting for a friend has no turn yet', async () => {
  const s = await started();
  await fails(s.mv(C, 0, 'e2', 'e4'), 'not-found');
  await fails(s.call(A, { op: 'move', g: 'ZZZZZZZZZZZZZZZZZZZZ', ply: 0, from: 'e2', to: 'e4' }), 'not-found');
  const inv = await s.call(A, { op: 'invite', col: 'w' });
  await fails(s.call(A, { op: 'move', g: inv.games[0].id, ply: 0, from: 'e2', to: 'e4' }), 'failed-precondition', 'turn');
});

test('FC-D13: the same move sent again for the same ply (offline resend) is ok and changes nothing', async () => {
  const s = await started();
  const r1 = await s.mv(A, 0, 'e2', 'e4');
  const r2 = await s.mv(A, 0, 'e2', 'e4');
  assert.deepEqual(r2.games[0], r1.games[0]);
  assert.equal(s.pushes.length, 1, 'no second push');
  await fails(s.mv(A, 0, 'd2', 'd4'), 'failed-precondition', 'turn'); // a different move at that ply
});

test('criterion 2 and scenario 5: within 3 days is in time; a move after the deadline loses on time, committed', async () => {
  const s = await started();
  const dl = s.store.get('games', s.g).dl;
  s.clock.t = dl;
  await s.mv(A, 0, 'e2', 'e4');
  s.pushes.length = 0;
  s.clock.t = s.store.get('games', s.g).dl + 1;
  const e = await fails(s.mv(B, 1, 'e7', 'e5'), 'failed-precondition', 'late');
  const v = e.details.games[0];
  assert.equal(v.st, 'over');
  assert.deepEqual(v.res, { r: 'w', why: 'time' });
  assert.deepEqual(v.moves, ['e4'], 'the late move is not played');
  const g = s.store.get('games', s.g);
  assert.equal(g.st, 'over');
  assert.deepEqual(g.res, { r: 'w', why: 'time' });
  assert.equal(g.dl, null);
  assert.equal(g.rem, null);
  assert.equal(g.expireAt, s.clock.t + 30 * DAY);
  assert.deepEqual(s.pushes, [{ to: A, t: 'over', g: s.g }]);
  await fails(s.mv(B, 1, 'e7', 'e5'), 'failed-precondition', 'over');
});

test('checkmate ends the game: result, push "over", later moves fail "over", a resend of the mate is ok', async () => {
  const s = await started();
  await s.mv(A, 0, 'f2', 'f3');
  await s.mv(B, 1, 'e7', 'e5');
  await s.mv(A, 2, 'g2', 'g4');
  s.pushes.length = 0;
  const r = await s.mv(B, 3, 'd8', 'h4');
  const v = r.games[0];
  assert.equal(v.st, 'over');
  assert.deepEqual(v.res, { r: 'b', why: 'mate' });
  assert.equal(v.dl, null);
  assert.deepEqual(s.pushes, [{ to: A, t: 'over', g: s.g }]);
  assert.equal(s.store.get('games', s.g).expireAt, s.clock.t + 30 * DAY);
  await fails(s.mv(A, 4, 'e1', 'f2'), 'failed-precondition', 'over');
  const again = await s.mv(B, 3, 'd8', 'h4');
  assert.deepEqual(again.games[0], v);
});

test('promotion through the op', async () => {
  const s = await started();
  const line = [['a2', 'a4'], ['b7', 'b5'], ['a4', 'b5'], ['a7', 'a6'], ['b5', 'a6'], ['c8', 'b7'], ['a6', 'b7'], ['b8', 'c6']];
  for (let i = 0; i < line.length; i++) await s.mv(i % 2 ? B : A, i, line[i][0], line[i][1]);
  await fails(s.mv(A, 8, 'b7', 'a8'), 'failed-precondition', 'illegal');
  const r = await s.mv(A, 8, 'b7', 'a8', 'n');
  assert.equal(r.games[0].moves[8], 'bxa8=N');
});

test('moving clears a draw offer made to the mover', async () => {
  const s = await started();
  await s.mv(A, 0, 'e2', 'e4');
  const raw = s.store.get('games', s.g);
  s.store.put('games', s.g, { ...raw, draw: 'w' }); // White offered (draw op is FC2)
  await s.mv(B, 1, 'e7', 'e5');
  assert.equal(s.store.get('games', s.g).draw, null);
});

test('a failing push never fails the move', async () => {
  const s = setup({ push: async () => { throw new Error('fcm down'); } });
  const inv = await s.call(A, { op: 'invite', col: 'w' });
  await s.call(B, { op: 'accept', code: inv.code });
  const r = await s.call(A, { op: 'move', g: inv.games[0].id, ply: 0, from: 'e2', to: 'e4' });
  assert.deepEqual(r.games[0].moves, ['e4']);
  assert.ok(s.logs.length >= 1);
});
