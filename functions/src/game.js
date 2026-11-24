'use strict';
// Friend game rules on chess.js 0.10.3 (the same library and version as the app).
// Pure: no Firebase, no clock, no randomness. Tech spec section 6 (move) and section 7 (600-ply cap).
const { Chess } = require('chess.js');

const DAY_MS = 24 * 60 * 60 * 1000;
const MOVE_MS = 3 * DAY_MS; // FC-D6: 3 days per move
const REMIND_MS = DAY_MS; // reminder when 1 day is left
const MAX_PLY = 600; // rate limit: a game ends as a draw at 600 plies
const PROMOS = ['q', 'r', 'b', 'n'];

function other(c) {
  return c === 'w' ? 'b' : 'w';
}

function turnOf(sans) {
  return sans.length % 2 === 0 ? 'w' : 'b';
}

// Rebuild the position from the stored SAN list. A list that does not replay is corrupt data.
function replay(sans) {
  const c = new Chess();
  for (const san of sans) {
    if (!c.move(san)) throw new Error('bad move list at ' + san);
  }
  return c;
}

// How the game ended after the last move, or null. nPly is the length of the move list after the move.
function endOf(c, nPly) {
  if (c.in_checkmate()) return { r: other(c.turn()), why: 'mate' };
  if (c.in_stalemate()) return { r: 'd', why: 'stalemate' };
  if (c.insufficient_material()) return { r: 'd', why: 'material' };
  if (c.in_threefold_repetition()) return { r: 'd', why: 'repetition' };
  if (Number(c.fen().split(' ')[4]) >= 100) return { r: 'd', why: 'fifty' };
  if (nPly >= MAX_PLY) return { r: 'd', why: 'cap' };
  return null;
}

// Try one move on the position after sans. chess.js would ignore a promotion piece on a normal move;
// the server is strict and rejects it.
function tryMove(c, mv) {
  const piece = c.get(mv.from);
  const lastRank = mv.to[1] === '8' || mv.to[1] === '1';
  const isPromo = !!piece && piece.type === 'p' && lastRank;
  if (mv.promo !== undefined && (!isPromo || !PROMOS.includes(mv.promo))) return null;
  const arg = { from: mv.from, to: mv.to };
  if (mv.promo !== undefined) arg.promotion = mv.promo;
  return c.move(arg);
}

// Play {from, to, promo?} after the SAN list. Returns { ok: false } for an illegal move (including the wrong side's piece),
// else { ok: true, san, fen, end } where end is null or { r: 'w'|'b'|'d', why }.
function play(sans, mv) {
  const c = replay(sans);
  const m = tryMove(c, mv);
  if (!m) return { ok: false };
  return { ok: true, san: m.san, fen: c.fen(), end: endOf(c, sans.length + 1) };
}

// An offline resend: the move for ply was already stored and is the same move.
function isResend(sans, ply, mv) {
  if (sans.length !== ply + 1) return false;
  const c = replay(sans.slice(0, ply));
  const m = tryMove(c, mv);
  return !!m && m.san === sans[ply];
}

// How many moves side c has made in a game of n plies (White plays plies 0, 2, 4 ...)
function ownMoves(c, n) {
  return c === 'w' ? Math.ceil(n / 2) : Math.floor(n / 2);
}

function deadlines(now) {
  const dl = now + MOVE_MS;
  return { dl, rem: dl - REMIND_MS };
}

function isLate(dl, now) {
  return now > dl;
}

module.exports = {
  DAY_MS, MOVE_MS, REMIND_MS, MAX_PLY,
  other, turnOf, ownMoves, replay, endOf, play, isResend, deadlines, isLate,
};
