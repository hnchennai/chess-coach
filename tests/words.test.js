// Unit tests for www/js/words.js: the last move in plain words (S2a, D17). Run: node --test tests/words.test.js
// Moves come from the real chess.js 0.10.3 the app ships, so flags (castling, en passant, promotion) are the real ones.
const test = require('node:test');
const assert = require('node:assert/strict');
const W = require('../www/js/words.js');
const { Chess } = require('../www/vendor/chess.js');

// Plays `san` from `fen` and returns the chess.js verbose move.
function mv(fen, san) { const g = new Chess(fen); const m = g.move(san); assert.ok(m, 'legal move ' + san + ' in ' + fen); return m; }
const both = (m) => [W.say(m, false), W.say(m, true)];

test('a knight move', () => {
  assert.deepEqual(both(mv('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'Nf3')), ['Rani’s partner moved a knight.', 'You moved a knight.']);
});

test('a pawn move (one or two squares)', () => {
  const want = ['Rani’s partner moved a pawn forward.', 'You moved a pawn forward.'];
  assert.deepEqual(both(mv('rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'e4')), want);
  assert.deepEqual(both(mv('rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1', 'e6')), want);
});

test('bishop and rook moves', () => {
  assert.deepEqual(both(mv('4k3/8/8/8/8/8/8/2B1K2R w - - 0 1', 'Bd2')), ['Rani’s partner moved a bishop.', 'You moved a bishop.']);
  assert.deepEqual(both(mv('4k3/8/8/8/8/8/8/2B1K2R w - - 0 1', 'Rh2')), ['Rani’s partner moved a rook.', 'You moved a rook.']);
});

test('king and queen (only one each): the king / your king, the queen / your queen', () => {
  assert.deepEqual(both(mv('4k3/8/8/8/8/8/8/3QK3 w - - 0 1', 'Kf2')), ['Rani’s partner moved the king.', 'You moved your king.']);
  assert.deepEqual(both(mv('4k3/8/8/8/8/8/8/3QK3 w - - 0 1', 'Qd2')), ['Rani’s partner moved the queen.', 'You moved your queen.']);
});

test('a capture: took your bishop / took a bishop', () => {
  assert.deepEqual(both(mv('4k3/8/8/3b4/8/8/8/3RK3 w - - 0 1', 'Rxd5')), ['Rani’s partner took your bishop.', 'You took a bishop.']);
});

test('castling, both sides', () => {
  const want = ['Rani’s partner castled to keep the king safe.', 'You castled to keep your king safe.'];
  assert.deepEqual(both(mv('r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'O-O')), want);
  assert.deepEqual(both(mv('r3k2r/8/8/8/8/8/8/R3K2R b KQkq - 0 1', 'O-O-O')), want);
});

test('promotion to a queen', () => {
  assert.deepEqual(both(mv('8/1P5k/8/8/8/8/8/4K3 w - - 0 1', 'b8=Q')), ['Rani’s partner turned a pawn into a queen.', 'You turned a pawn into a queen.']);
});

test('underpromotion names the piece', () => {
  assert.deepEqual(both(mv('8/1P5k/8/8/8/8/8/4K3 w - - 0 1', 'b8=N')), ['Rani’s partner turned a pawn into a knight.', 'You turned a pawn into a knight.']);
  assert.equal(W.say(mv('8/1P5k/8/8/8/8/8/4K3 w - - 0 1', 'b8=R'), true), 'You turned a pawn into a rook.');
});

test('capture plus promotion', () => {
  assert.deepEqual(both(mv('r6k/1P6/8/8/8/8/8/4K3 w - - 0 1', 'bxa8=Q+')), ['Rani’s partner took your rook and turned a pawn into a queen. Check!', 'You took a rook and turned a pawn into a queen. Check!']);
  assert.deepEqual(both(mv('r7/1P5k/8/8/8/8/8/4K3 w - - 0 1', 'bxa8=Q')), ['Rani’s partner took your rook and turned a pawn into a queen.', 'You took a rook and turned a pawn into a queen.']);
});

test('en passant is a pawn capture', () => {
  const m = mv('4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', 'exd6');
  assert.equal(m.flags, 'e');
  assert.deepEqual(both(m), ['Rani’s partner took your pawn.', 'You took a pawn.']);
});

test('check adds " Check!" at the end', () => {
  assert.deepEqual(both(mv('4k3/8/8/8/8/8/8/R3K3 w - - 0 1', 'Ra8+')), ['Rani’s partner moved a rook. Check!', 'You moved a rook. Check!']);
  // S2a scenario 2: the partner takes your bishop with check.
  assert.equal(W.say(mv('4k3/8/8/8/q7/8/2B5/4K3 b - - 0 1', 'Qxc2'), false), 'Rani’s partner took your bishop.');
  assert.equal(W.say(mv('4k3/8/8/q7/8/8/3B4/4K3 b - - 0 1', 'Qxd2+'), false), 'Rani’s partner took your bishop. Check!');
});

test('checkmate replaces the sentence', () => {
  const m = mv('6k1/5ppp/8/8/8/8/8/3R2K1 w - - 0 1', 'Rd8#');
  assert.equal(W.say(m, false), 'Checkmate. Rani’s partner won.');
  assert.equal(W.say(m, true), 'Checkmate. You won!');
});

test('no move gives an empty string; no em dash in any sentence', () => {
  assert.equal(W.say(null, true), '');
  const fens = [['rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1', 'Nf3'], ['r3k2r/8/8/8/8/8/8/R3K2R w KQkq - 0 1', 'O-O'], ['r6k/1P6/8/8/8/8/8/4K3 w - - 0 1', 'bxa8=Q+']];
  for (const [f, s] of fens) for (const t of both(mv(f, s))) assert.ok(!/—/.test(t), t);
  assert.equal(W.PARTNER, 'Rani’s practice partner');
});
