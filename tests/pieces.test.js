// Unit tests for slice G1 (docs/specs/board-screens.product.md, G-D13 to G-D16): the flat piece tag and the name line.
// Run: sh scripts/build.sh && node --test tests/pieces.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const W = require('../www/js/words.js');

const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['avatar', 'themes']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../www/js/' + f + '.js'), 'utf8'), ctx);
const A = vm.runInContext('Avatar', ctx);

const ROLES = ['k', 'q', 'r', 'b', 'n', 'p'];
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
const THEMED = Object.keys(A.SETS).filter((s) => s !== 'classic');
// The spec's "New wording", letter for letter.
const WORDING = {
  k: 'king. Moves one square in any direction.',
  q: 'queen. Moves any distance, straight or diagonally.',
  r: 'rook. Moves any distance in straight lines.',
  b: 'bishop. Moves any distance diagonally.',
  n: 'knight. Jumps in an L shape.',
  p: 'pawn. Moves forward, captures diagonally.'
};
const tagOf = (svg) => (/<g class="ptag" data-role="([a-z])">(.*?)<\/g>/.exec(svg) || null);
const circles = (s) => [...s.matchAll(/<circle cx="([\d.]+)" cy="([\d.]+)" r="([\d.]+)"/g)].map((m) => ({ cx: +m[1], cy: +m[2], r: +m[3] }));

test('there are themed sets to check, and classic is one of the sets', () => {
  assert.ok(THEMED.length >= 10, 'themed sets: ' + THEMED.length);
  assert.ok(A.SETS.classic);
});

// Criterion 10
test('the name line: emblem name, role and how it moves, for every set, both colours, all six roles', () => {
  let n = 0;
  for (const set of THEMED) for (const c of ['w', 'b']) for (const t of ROLES) {
    const name = A.label(set, c, t);
    assert.ok(name, set + ' ' + c + t + ' has an emblem name');
    assert.equal(W.nameLine(name, t), name + ': ' + WORDING[t], set + ' ' + c + t);
    n++;
  }
  assert.equal(n, THEMED.length * 12);
});

test('the name line: the spec’s shape, with the real Hero League names', () => {
  assert.equal(W.nameLine(A.label('heroes', 'w', 'n'), 'n'), 'Rocket: knight. Jumps in an L shape.');
  assert.equal(W.nameLine(A.label('heroes', 'w', 'b'), 'b'), 'Volt: bishop. Moves any distance diagonally.');
});

test('the name line: nothing for classic pieces, an unknown role or a missing name', () => {
  for (const c of ['w', 'b']) for (const t of ROLES) assert.equal(W.nameLine(A.label('classic', c, t), t), '');
  assert.equal(W.nameLine('Rocket', 'x'), '');
  assert.equal(W.nameLine('', 'k'), '');
  assert.equal(W.nameLine(null, 'k'), '');
});

test('the name line: no em dashes, one line, ends with a full stop', () => {
  for (const t of ROLES) {
    const s = W.nameLine('Rocket', t);
    assert.ok(!/[—–]/.test(s), s);
    assert.ok(!/\n/.test(s) && /\.$/.test(s), s);
  }
});

// Criterion 8 (flat view)
test('flat tag: every themed set has six different tags per colour, one per role, with the standard symbol', () => {
  for (const set of THEMED) for (const c of ['w', 'b']) {
    const seen = new Set();
    for (const t of ROLES) {
      const m = tagOf(A.piece(set, c, t, true));
      assert.ok(m, set + ' ' + c + t + ' has a tag');
      assert.equal(m[1], t, 'the tag carries its role');
      assert.ok(m[2].includes(GLYPH[t]), set + ' ' + c + t + ' shows the ' + t + ' symbol');
      for (const o of ROLES) if (o !== t) assert.ok(!m[2].includes(GLYPH[o]), 'and no other symbol');
      seen.add(m[2].match(/[♚-♟]/)[0]);
    }
    assert.equal(seen.size, 6, set + ' ' + c + ': six different symbols');
  }
});

test('flat tag: classic pieces have no token and so no tag', () => {
  for (const c of ['w', 'b']) for (const t of ROLES) { assert.equal(A.piece('classic', c, t, true), null); assert.equal(A.piece('classic', c, t, false), null); }
});

// Criterion 11 (flat view)
test('flat tag: tags off draws the same token with no tag and no chess symbol', () => {
  for (const set of THEMED) for (const c of ['w', 'b']) for (const t of ROLES) {
    const on = A.piece(set, c, t, true), off = A.piece(set, c, t, false);
    assert.ok(off && /^<svg class="tok"/.test(off), 'still a token');
    assert.equal(tagOf(off), null, set + ' ' + c + t + ': no tag');
    assert.ok(!/[♚-♟]/.test(off), 'no chess symbol left behind');
    assert.ok(!/class="ptag"/.test(off));
    assert.equal(on.replace(/<g class="ptag".*?<\/g>/, '').replace(/tk[a-z]+?(?=[frg]"|[frg]\))/g, 'ID'), off.replace(/tk[a-z]+?(?=[frg]"|[frg]\))/g, 'ID'), 'the emblem and the token do not change');
  }
});

test('flat tag: a call without the fourth argument keeps the tag (move chips and the notation tip need the role)', () => {
  assert.ok(tagOf(A.piece('heroes', 'w', 'n')));
});

// G-D16
test('flat tag: at least 14px across on a 360px wide board, pawns too, and inside the token', () => {
  const pxPerUnit = (360 / 8) * 0.94 / 100; // a square is 45px, the token fills 94% of it, the drawing is 100 units wide
  for (const set of THEMED) for (const c of ['w', 'b']) for (const t of ROLES) {
    const svg = A.piece(set, c, t, true), m = tagOf(svg), cs = circles(m[2]);
    assert.ok(cs.length >= 1);
    const o = cs[0];
    assert.ok(2 * o.r * pxPerUnit >= 14, set + ' ' + c + t + ': ' + (2 * o.r * pxPerUnit).toFixed(1) + 'px');
    assert.ok(o.cx + o.r <= 100 && o.cy + o.r <= 100, 'the tag stays inside the token, so it never reaches a neighbour');
    // the tag is not inside the group that shrinks a pawn
    const g = /<g transform="translate\(50 52\) scale\(\.84\)[^>]*>(.*)<\/g>(?=<g class="ptag")/.exec(svg);
    if (t === 'p') assert.ok(g && !/ptag/.test(g[1]), 'a pawn’s tag is full size');
  }
});

test('flat tag: it covers no more than a corner of the emblem', () => {
  // The emblem is drawn in a 24 unit box, scaled 2.1667 from (24,24): 24 to 76. A pawn's is shrunk to 84% around (50,52).
  const box = (t) => (t === 'p' ? { x0: 50 + (24 - 50) * 0.84, x1: 50 + (76 - 50) * 0.84, y0: 52 + (24 - 52) * 0.84, y1: 52 + (76 - 52) * 0.84 } : { x0: 24, x1: 76, y0: 24, y1: 76 });
  for (const t of ROLES) {
    const o = circles(tagOf(A.piece('heroes', 'w', t, true))[2])[0], b = box(t);
    let inside = 0, all = 0;
    for (let x = b.x0; x < b.x1; x += 0.25) for (let y = b.y0; y < b.y1; y += 0.25) { all++; if (Math.hypot(x - o.cx, y - o.cy) <= o.r) inside++; }
    assert.ok(inside / all <= 0.06, t + ': the tag covers ' + (100 * inside / all).toFixed(1) + '% of the emblem box');
    assert.ok(o.cx - o.r > (b.x0 + b.x1) / 2 && o.cy - o.r > (b.y0 + b.y1) / 2, t + ': only the bottom right corner');
  }
});

test('flat tag: the symbol is readable on both colours (contrast 4.5:1 or better against the tag)', () => {
  const lum = (h) => { const v = [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255).map((x) => (x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4))); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
  const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
  for (const set of THEMED) for (const c of ['w', 'b']) {
    const m = tagOf(A.piece(set, c, 'n', true))[2];
    const fill = /<circle[^>]* fill="(#[0-9a-fA-F]{6})"/.exec(m), ink = /<text[^>]* fill="(#[0-9a-fA-F]{6})"/.exec(m);
    assert.ok(fill && ink, set + ' ' + c + ': a plain fill and a plain symbol colour');
    assert.ok(ratio(fill[1], ink[1]) >= 4.5, set + ' ' + c + ': ' + ratio(fill[1], ink[1]).toFixed(2) + ':1');
  }
});
