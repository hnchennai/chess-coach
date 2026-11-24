'use strict';
// Game rules for friend challenges (tech spec section 6, move; section 12, unit tests).
const test = require('node:test');
const assert = require('node:assert/strict');
const { Chess } = require('chess.js');
const game = require('../src/game');

const DAY = 24 * 60 * 60 * 1000;

test('a legal first move gives its SAN, the new FEN and no end', () => {
  const r = game.play([], { from: 'e2', to: 'e4' });
  assert.equal(r.ok, true);
  assert.equal(r.san, 'e4');
  assert.match(r.fen, /^rnbqkbnr\/pppppppp\/8\/8\/4P3\/8\/PPPP1PPP\/RNBQKBNR b /);
  assert.equal(r.end, null);
});

test('an illegal move is rejected', () => {
  assert.equal(game.play([], { from: 'e2', to: 'e5' }).ok, false);
  assert.equal(game.play([], { from: 'a1', to: 'a3' }).ok, false);
  assert.equal(game.play(['e4'], { from: 'e4', to: 'e6' }).ok, false);
});

test('moving the other side\'s piece (wrong turn) is rejected', () => {
  // White to move: a black pawn cannot move
  assert.equal(game.play([], { from: 'e7', to: 'e5' }).ok, false);
  // Black to move: a white pawn cannot move
  assert.equal(game.play(['e4'], { from: 'd2', to: 'd4' }).ok, false);
});

test('turnOf says whose move it is from the ply count', () => {
  assert.equal(game.turnOf([]), 'w');
  assert.equal(game.turnOf(['e4']), 'b');
  assert.equal(game.turnOf(['e4', 'e5']), 'w');
});

// a position where White pushes a pawn to the last rank: 1. a4 b5 2. axb5 a6 3. bxa6 Bb7 4. axb7 Nc6
const PROMO = ['a4', 'b5', 'axb5', 'a6', 'bxa6', 'Bb7', 'axb7', 'Nc6'];

test('promotion: needs a piece, takes any of q r b n, and gives the right SAN', () => {
  assert.equal(game.play(PROMO, { from: 'b7', to: 'a8' }).ok, false, 'no promotion piece');
  assert.equal(game.play(PROMO, { from: 'b7', to: 'a8', promo: 'k' }).ok, false, 'king is not a promotion');
  const q = game.play(PROMO, { from: 'b7', to: 'a8', promo: 'q' });
  assert.equal(q.ok, true);
  assert.equal(q.san, 'bxa8=Q');
  assert.equal(game.play(PROMO, { from: 'b7', to: 'a8', promo: 'n' }).san, 'bxa8=N');
});

test('a promotion piece on a move that is not a promotion is rejected', () => {
  assert.equal(game.play([], { from: 'e2', to: 'e4', promo: 'q' }).ok, false);
});

test('checkmate ends the game, the mover wins', () => {
  const r = game.play(['f3', 'e5', 'g4'], { from: 'd8', to: 'h4' });
  assert.equal(r.ok, true);
  assert.equal(r.san, 'Qh4#');
  assert.deepEqual(r.end, { r: 'b', why: 'mate' });
});

test('stalemate ends the game as a draw', () => {
  // Sam Loyd's 10-move stalemate
  const sans = ['e3', 'a5', 'Qh5', 'Ra6', 'Qxa5', 'h5', 'h4', 'Rah6', 'Qxc7', 'f6', 'Qxd7+', 'Kf7',
    'Qxb7', 'Qd3', 'Qxb8', 'Qh7', 'Qxc8', 'Kg6'];
  const r = game.play(sans, { from: 'c8', to: 'e6' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.end, { r: 'd', why: 'stalemate' });
});

test('threefold repetition ends the game as a draw', () => {
  const sans = ['Nf3', 'Nf6', 'Ng1', 'Ng8', 'Nf3', 'Nf6', 'Ng1'];
  const r = game.play(sans, { from: 'f6', to: 'g8' });
  assert.equal(r.ok, true);
  assert.deepEqual(r.end, { r: 'd', why: 'repetition' });
  // one ply earlier is only a twofold repetition
  assert.equal(game.play(sans.slice(0, 6), { from: 'f3', to: 'g1' }).end, null);
});

test('the fifty-move rule ends the game as a draw', () => {
  const c = new Chess('4k3/8/8/8/8/8/R7/4K3 w - - 99 80');
  c.move({ from: 'a2', to: 'a3' });
  assert.deepEqual(game.endOf(c, 10), { r: 'd', why: 'fifty' });
  const d = new Chess('4k3/8/8/8/8/8/R7/4K3 w - - 98 80');
  d.move({ from: 'a2', to: 'a3' });
  assert.equal(game.endOf(d, 10), null);
});

test('too few pieces (insufficient material) ends the game as a draw', () => {
  const c = new Chess('4k3/8/8/8/8/8/3r4/4KB2 w - - 0 60');
  c.move({ from: 'e1', to: 'd2' }); // king takes the last rook: K+B v K
  assert.deepEqual(game.endOf(c, 10), { r: 'd', why: 'material' });
});

test('mate wins over the 600-ply cap; the cap makes a draw', () => {
  assert.equal(game.MAX_PLY, 600);
  const open = new Chess();
  open.move('e4');
  assert.equal(game.endOf(open, 599), null);
  assert.deepEqual(game.endOf(open, 600), { r: 'd', why: 'cap' });
  const mate = new Chess();
  ['f3', 'e5', 'g4', 'Qh4#'].forEach((m) => mate.move(m));
  assert.deepEqual(game.endOf(mate, 600), { r: 'b', why: 'mate' });
});

test('replay rebuilds the position from the SAN list, and throws on a broken list', () => {
  const c = game.replay(['e4', 'e5', 'Nf3']);
  assert.equal(c.turn(), 'b');
  assert.equal(c.history().length, 3);
  assert.throws(() => game.replay(['e4', 'e4']), /bad move list/);
  assert.throws(() => game.replay(['Ke2x']), /bad move list/);
});

test('isResend: the same move sent again for the same ply is a resend', () => {
  const sans = ['e4', 'e5'];
  assert.equal(game.isResend(sans, 1, { from: 'e7', to: 'e5' }), true);
  assert.equal(game.isResend(sans, 1, { from: 'd7', to: 'd5' }), false, 'different move at that ply');
  assert.equal(game.isResend(sans, 0, { from: 'e2', to: 'e4' }), false, 'not the last move');
  assert.equal(game.isResend(sans, 2, { from: 'g1', to: 'f3' }), false, 'a new ply is not a resend');
  assert.equal(game.isResend([], 0, { from: 'e2', to: 'e4' }), false);
});

test('isResend matches a promotion only with the same piece', () => {
  const sans = PROMO.concat(['bxa8=Q']);
  assert.equal(game.isResend(sans, 8, { from: 'b7', to: 'a8', promo: 'q' }), true);
  assert.equal(game.isResend(sans, 8, { from: 'b7', to: 'a8', promo: 'n' }), false);
});

test('deadlines: 3 days per move, reminder 1 day before', () => {
  assert.equal(game.MOVE_MS, 3 * DAY);
  const now = 1_700_000_000_000;
  assert.deepEqual(game.deadlines(now), { dl: now + 3 * DAY, rem: now + 2 * DAY });
});

test('isLate: on the deadline is in time, one millisecond after is late', () => {
  const dl = 1_700_000_000_000;
  assert.equal(game.isLate(dl, dl - 1), false);
  assert.equal(game.isLate(dl, dl), false);
  assert.equal(game.isLate(dl, dl + 1), true);
});

test('loser and winner helpers', () => {
  assert.equal(game.other('w'), 'b');
  assert.equal(game.other('b'), 'w');
});
