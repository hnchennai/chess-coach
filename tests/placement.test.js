// Unit tests for the pure parts of www/js/placement.js (puzzle choice and first-move check)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const Placement = require('../www/js/placement.js');
global.window = {};
eval(fs.readFileSync(path.join(__dirname, '../www/js/puzzles.js'), 'utf8'));
const BANK = global.window.PUZZLE_BANK;

test('Know-the-moves: 5 puzzles, 500-1100, hanging/mateIn1/fork, easy to hard', () => {
  const ps = Placement.pick(BANK, 'knows', 'install-a:1');
  assert.equal(ps.length, 5);
  for (const p of ps) {
    assert.ok(p.rating >= 500 && p.rating <= 1100, 'rating ' + p.rating);
    assert.ok(p.themes.some((t) => ['hanging', 'mateIn1', 'fork'].includes(t)), p.themes.join());
  }
  assert.deepEqual(ps.map((p) => p.rating), ps.map((p) => p.rating).slice().sort((a, b) => a - b));
  assert.equal(new Set(ps.map((p) => p.id)).size, 5);
});

test('Play-often: 6 puzzles, 700-1700, adds pin/skewer/mateIn2; Try Club: 2 from 1500-1800', () => {
  const ps = Placement.pick(BANK, 'often', 'install-a:1');
  assert.equal(ps.length, 6);
  for (const p of ps) assert.ok(p.rating >= 700 && p.rating <= 1700);
  const cl = Placement.pick(BANK, 'club', 'install-a:1');
  assert.equal(cl.length, 2);
  for (const p of cl) assert.ok(p.rating >= 1500 && p.rating <= 1800);
});

test('Seeded by install id + attempt: same seed same puzzles, retakes differ', () => {
  const ids = (s) => Placement.pick(BANK, 'knows', s).map((p) => p.id).join();
  assert.equal(ids('install-a:1'), ids('install-a:1'));
  assert.notEqual(ids('install-a:1'), ids('install-a:2'));
  assert.notEqual(ids('install-a:1'), ids('install-b:1'));
});

test('Try Club avoids puzzles already shown', () => {
  const first = Placement.pick(BANK, 'club', 's');
  const again = Placement.pick(BANK, 'club', 's', first.map((p) => p.id));
  assert.ok(again.every((p) => !first.some((q) => q.id === p.id)));
});

test('First move correct = correct; a mating move also counts', () => {
  const p = { sol: ['e2e4', 'e7e5'] };
  assert.equal(Placement.isCorrect(p, 'e2e4'), true);
  assert.equal(Placement.isCorrect(p, 'd2d4'), false);
  assert.equal(Placement.isCorrect(p, 'd2d4', true), true);
  assert.equal(Placement.isCorrect({ sol: ['a7a8q'] }, 'a7a8'), true, 'promotion defaults to queen');
  assert.equal(Placement.isCorrect({ sol: ['a7a8n'] }, 'a7a8q'), false);
});

test('Rani asks in plain words, by theme', () => {
  assert.match(Placement.ask({ themes: ['mateIn1'] }), /checkmate in one/);
  assert.match(Placement.ask({ themes: ['hanging'] }), /win a piece for free/);
  assert.match(Placement.ask({ themes: ['fork', 'check'] }), /two pieces at once/);
  for (const t of ['mateIn1', 'mateIn2', 'fork', 'hanging', 'pin', 'skewer']) assert.doesNotMatch(Placement.ask({ themes: [t] }), /—/);
});
