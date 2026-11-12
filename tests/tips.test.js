// Unit tests for www/js/tips.js: the tip slot's two lists, the label and the first-day rule (flow rework, slice F2).
// Run: node --test tests/tips.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const T = require('../www/js/tips.js');

// The lists signed off in docs/specs/flow-rework.product.md, character for character.
const BEGINNER = [
  'Before you move, look at what their last move attacks.',
  'Castle early. A king in the middle is easy to attack.',
  'Bring out your knights and bishops before your queen.',
  'A free piece is one nobody guards. Take it.',
  'Before you let go of a piece, check it is safe on its new square.',
  'Pawns can’t move back. Push them with care.',
  'Two pieces attacking one square beat one piece guarding it.',
  'When you are ahead, swap pieces. The game gets simpler.'
];
const OTHER = [
  'Checks, captures, threats. Look at them in that order, every move.',
  'A knight on the edge covers fewer squares. Keep it near the middle.',
  'Two attacks at once win a piece. Look for forks every move.',
  'Rooks belong on open files. Put one there before your opponent does.',
  'A pinned piece is a poor guard. Count it out.',
  'In the endgame, the king is a fighting piece. Bring it to the middle.',
  'Passed pawns must be pushed. Put a rook behind them.',
  'After every game, find the one move where it turned.'
];
const DAY = 86400000;
// Local dates, so the tests do not depend on the machine's time zone.
const at = (y, m, d, h) => new Date(y, m - 1, d, h == null ? 12 : h).getTime();
const key = (y, m, d) => y + '-' + m + '-' + d; // the app's dkey(): local date, month 1-based, no padding
const TODAY = at(2026, 11, 12, 10);

test('The two lists are the signed lists, character for character', () => {
  assert.deepEqual(Array.from(T.BEGINNER), BEGINNER);
  assert.deepEqual(Array.from(T.OTHER), OTHER);
});
test('The lists in the approved spec file are the same lists', () => {
  const fs = require('fs'), path = require('path'), f = path.join(__dirname, '../docs/specs/flow-rework.product.md');
  if (!fs.existsSync(f)) return; // the spec is not shipped with every checkout
  const md = fs.readFileSync(f, 'utf8'), sec = md.slice(md.indexOf('### Tips'), md.indexOf('## New copy'));
  const lists = sec.split('Improver and Club:').map((part) => part.split('\n').filter((l) => /^\d+\. /.test(l)).map((l) => l.replace(/^\d+\. /, '').trim()));
  assert.deepEqual(lists[0], Array.from(T.BEGINNER)); assert.deepEqual(lists[1], Array.from(T.OTHER));
});
test('AC9: no Beginner tip has notation, a number or an engine name', () => {
  const SAN = /(^|[^\w-])([KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x?[a-h]?[1-8]\b|O-O)/;
  for (const t of T.BEGINNER) {
    assert.ok(!SAN.test(t), 'notation: ' + t);
    assert.ok(!/\d/.test(t), 'a number (ratings are numbers): ' + t);
    assert.ok(!/stockfish|engine|rating|rated|elo\b|eval/i.test(t), 'engine or rating words: ' + t);
  }
});
test('AC9: no tip or label has an em dash or a straight apostrophe; every tip is short (two lines at most)', () => {
  for (const t of T.BEGINNER.concat(T.OTHER, [T.label('rani'), T.label('gaja')])) {
    assert.ok(!/[—–]/.test(t), 'dash: ' + t); assert.ok(!/'/.test(t), 'straight apostrophe: ' + t);
    assert.ok(t.length <= 70, 'short: ' + t);
  }
});
test('F-D13: Beginner tips for level beginner (Show everything does not matter); the other list for Improver and Club', () => {
  assert.equal(T.list('beginner'), T.BEGINNER);
  assert.equal(T.list('improver'), T.OTHER); assert.equal(T.list('club'), T.OTHER);
  assert.equal(T.list(null), T.BEGINNER, 'no level yet: the plain list');
});
test('pick: one tip of the level’s list, every tip can come up, the same number gives the same tip', () => {
  const seen = new Set();
  for (let i = 0; i < 8; i++) { const t = T.pick('beginner', (i + 0.5) / 8); assert.ok(BEGINNER.includes(t)); seen.add(t); }
  assert.equal(seen.size, 8);
  assert.equal(T.pick('club', 0), OTHER[0]); assert.equal(T.pick('club', 0.9999), OTHER[7]); assert.equal(T.pick('club', 1), OTHER[7], 'never past the end');
  assert.equal(T.pick('improver', 0.4), T.pick('improver', 0.4));
  assert.ok(BEGINNER.includes(T.pick('beginner')), 'a random pick without a number');
});
test('F-D14: the label names the chosen coach', () => {
  assert.equal(T.label('rani'), 'Rani’s tip'); assert.equal(T.label('gaja'), 'Gaja’s tip'); assert.equal(T.label(undefined), 'Rani’s tip');
  assert.equal(T.aria('gaja', BEGINNER[0]), 'Gaja’s tip: Before you move, look at what their last move attacks.');
});

/* ---------- F-D5: the first-day rule ---------- */
test('First day: no record at all, or records from today only', () => {
  assert.equal(T.firstDay(null, TODAY), true);
  assert.equal(T.firstDay({}, TODAY), true);
  assert.equal(T.firstDay({ days: {}, games: [], course: {}, levelT: 0, t: 0 }, TODAY), true);
  const p = { days: { [key(2026, 11, 12)]: { puz: 3, games: 1, course: 1, solved: 2 } }, levelT: at(2026, 11, 12, 8), t: at(2026, 11, 12, 9),
    games: [{ id: 'g1', d: at(2026, 11, 12, 9) }], course: { rules: { learn: at(2026, 11, 12, 8), practice: at(2026, 11, 12, 9) } } };
  assert.equal(T.firstDay(p, TODAY), true, 'a busy first day is still the first day');
  assert.equal(T.firstDay(p, at(2026, 11, 12, 23)), true, 'until midnight');
});
test('From the next calendar day the slot shows (Scenario 10)', () => {
  const p = { days: { [key(2026, 11, 12)]: { puz: 0, games: 0, course: 0, solved: 0 } }, levelT: at(2026, 11, 12, 23), t: at(2026, 11, 12, 23), games: [], course: {} };
  assert.equal(T.firstDay(p, at(2026, 11, 13, 0)), false, 'just after midnight is the next calendar day');
  assert.equal(T.firstDay(p, at(2026, 11, 13, 9)), false);
  // today has its own record too (the app adds one when it opens)
  p.days[key(2026, 11, 13)] = { puz: 0, games: 0, course: 0, solved: 0 }; p.t = at(2026, 11, 13, 9);
  assert.equal(T.firstDay(p, at(2026, 11, 13, 9)), false);
});
test('Any one earlier record is enough: a day, the level time, a game, a lesson part or the last save', () => {
  const today = { [key(2026, 11, 12)]: { puz: 0, games: 0, course: 0, solved: 0 } };
  assert.equal(T.firstDay({ days: Object.assign({ [key(2026, 9, 1)]: {} }, today) }, TODAY), false, 'an earlier day');
  assert.equal(T.firstDay({ days: today, levelT: TODAY - DAY }, TODAY), false, 'the level was set yesterday');
  assert.equal(T.firstDay({ days: today, games: [{ id: 'g', d: TODAY - 3 * DAY }] }, TODAY), false, 'a game from an earlier day');
  assert.equal(T.firstDay({ days: today, course: { rules: { learn: TODAY - 40 * DAY } } }, TODAY), false, 'a lesson part from an earlier day');
  assert.equal(T.firstDay({ days: today, t: TODAY - DAY }, TODAY), false, 'saved yesterday');
  assert.equal(T.firstDay({ days: today, course: { rules: { learn: 1, practice: true } }, levelT: 0 }, TODAY), true, 'a part marked without a time is not a date');
});
test('A player updated from an older version (days trimmed to 60, level derived) is past day one', () => {
  const days = {}; for (let i = 1; i <= 60; i++) { const d = new Date(TODAY - i * DAY); days[key(d.getFullYear(), d.getMonth() + 1, d.getDate())] = { puz: 1, games: 0, course: 0, solved: 1 }; }
  assert.equal(T.firstDay({ days, levelT: 0, placed: 'derived', t: TODAY - DAY }, TODAY), false);
});
test('AC7: a clock set backwards never throws and never brings the first day back', () => {
  const p = { days: { [key(2026, 11, 12)]: {}, [key(2026, 11, 11)]: {} }, levelT: at(2026, 11, 11), t: at(2026, 11, 12), games: [{ id: 'g', d: at(2026, 11, 12) }], course: {} };
  assert.equal(T.firstDay(p, at(2026, 11, 1)), false, 'records "in the future" are still earlier use');
  assert.equal(T.firstDay(p, at(2020, 1, 1)), false);
  for (const junk of [{ days: null, games: null, course: null }, { days: 'x', games: [null, 3, {}], course: { a: null, b: 5 } }, { levelT: 'abc', t: NaN }]) assert.doesNotThrow(() => T.firstDay(junk, TODAY));
  assert.doesNotThrow(() => T.firstDay(p, NaN));
  assert.equal(typeof T.firstDay(p), 'boolean', 'no time given: now');
});
test('AC11: the rule reads the profile and never changes it (no new field)', () => {
  const p = { v: 5, days: { [key(2026, 11, 12)]: { puz: 1 } }, levelT: TODAY, t: TODAY, games: [], course: {} }, copy = JSON.stringify(p);
  T.firstDay(p, TODAY); T.firstDay(p, TODAY + DAY);
  assert.equal(JSON.stringify(p), copy);
});
