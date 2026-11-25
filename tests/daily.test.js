// Unit tests for www/js/daily.js: the Daily puzzle card (docs/specs/daily-puzzle.product.md, slice D1: DP-D1, DP-D2, DP-D5,
// DP-D6, DP-D9, scenarios 1 to 4 and 9, acceptance criteria 1, 2, 4, 10). And the profile's daily record (migrate, merge).
// Run: node --test tests/daily.test.js   (after sh scripts/build.sh)
const test = require('node:test');
const assert = require('node:assert/strict');
const D = require('../www/js/daily.js');
const P = require('../www/js/profile.js');

// A small bank in the app's shape: { id, rating, hand? }.
const BANK = [
  { id: 'a', rating: 700 }, { id: 'b', rating: 1000 }, { id: 'c', rating: 1050 }, { id: 'd', rating: 1100 }, { id: 'e', rating: 1150 },
  { id: 'f', rating: 1400 }, { id: 'g', rating: 1900 }, { id: 'h1', rating: 1100, hand: true }, { id: 'h2', rating: 1100, hand: true }
];
const DAY = '2026-11-25', NEXT = '2026-11-26';

test('key: local date as the app writes prof.days keys (month 1-based, no padding)', () => {
  assert.equal(D.key(new Date(2026, 10, 25, 23, 59)), '2026-11-25');
  assert.equal(D.key(new Date(2026, 0, 5, 0, 0)), '2026-1-5');
  assert.equal(D.key(new Date(2026, 10, 26, 0, 0, 1)), '2026-11-26', 'a new key right after local midnight');
});

test('AC2 / DP-D2: picked near the puzzle rating, never a hand-made puzzle', () => {
  for (const day of ['2026-11-25', '2026-11-26', '2026-11-27', '2026-12-1', '2027-1-9']) {
    const p = D.pick(BANK, 1100, {}, day);
    assert.ok(['b', 'c', 'd', 'e'].includes(p.id), day + ': within 120 of 1100, got ' + p.id);
  }
  const far = D.pick([{ id: 'x', rating: 1900 }, { id: 'y', rating: 700 }, { id: 'h', rating: 1000, hand: true }], 1000, {}, DAY);
  assert.equal(far.id, 'y', 'the band widens until it finds one, and the closest band wins');
});

test('AC2 / DP-D2: unsolved puzzles first; solved ones only when nothing else is left', () => {
  const puz = { b: { n: 1, ok: 1 }, c: { n: 1, ok: 1 }, e: { n: 2, ok: 1 } };
  assert.equal(D.pick(BANK, 1100, puz, DAY).id, 'd', 'the one unsolved puzzle near 1100 (a missed one counts as unsolved)');
  const puz2 = { d: { n: 1, ok: 0 } };
  const all = {}; BANK.forEach((p) => { all[p.id] = { n: 1, ok: 1 }; });
  delete all.g;
  assert.equal(D.pick(BANK, 1100, all, DAY).id, 'g', 'an unsolved puzzle far away beats a solved one nearby');
  all.g = { n: 1, ok: 1 };
  const p = D.pick(BANK, 1100, all, DAY);
  assert.ok(['b', 'c', 'd', 'e'].includes(p.id), 'all solved: the nearest band again, got ' + p.id);
  assert.equal(D.pick(BANK, 1100, puz2, DAY) != null, true);
  assert.equal(D.pick([], 1000, {}, DAY), null, 'an empty bank gives nothing');
  assert.equal(D.pick([{ id: 'h', rating: 1000, hand: true }], 1000, {}, DAY), null, 'only hand-made puzzles: nothing');
});

test('AC2: the same pick for the same day and inputs (no randomness), and yesterday\'s puzzle is avoided', () => {
  const a = D.pick(BANK, 1100, {}, DAY), b = D.pick(BANK.slice().reverse(), 1100, {}, DAY);
  assert.equal(a.id, b.id, 'bank order does not matter');
  const ids = new Set(['2026-11-1', '2026-11-2', '2026-11-3', '2026-11-4', '2026-11-5', '2026-11-6', '2026-11-7', '2026-11-8'].map((d) => D.pick(BANK, 1100, {}, d).id));
  assert.ok(ids.size > 1, 'different days give different puzzles: ' + [...ids]);
  for (const d of ['2026-11-1', '2026-11-2', '2026-11-3']) {
    const y = D.pick(BANK, 1100, {}, d).id;
    assert.notEqual(D.pick(BANK, 1100, {}, d, y).id, y, 'avoid: never the same puzzle two days running');
  }
});

test('AC2 / scenario 2: today() keeps the same puzzle all day, even after a restart; a new one after midnight', () => {
  const r0 = D.today(null, DAY, BANK, 1100, {});
  assert.equal(r0.d, DAY); assert.equal(r0.r, null); assert.equal(r0.n, 0);
  assert.ok(['b', 'c', 'd', 'e'].includes(r0.id));
  const saved = JSON.parse(JSON.stringify(r0)); // through local storage
  const r1 = D.today(saved, DAY, BANK, 1500, { [r0.id]: { n: 1, ok: 0 }, zz: { n: 1, ok: 1 } });
  assert.equal(r1, saved, 'same day: the stored record, untouched (rating and results changed meanwhile; solved elsewhere: fix 2)');
  const done = Object.assign({}, r0, { r: 'solved', n: 1 });
  assert.equal(D.today(done, DAY, BANK, 1100, {}), done, 'same day, done: kept');
  const r2 = D.today(done, NEXT, BANK, 1100, {});
  assert.equal(r2.d, NEXT); assert.equal(r2.r, null, 'a new day: to do');
  assert.equal(r2.n, 1, 'the count of finished daily puzzles is kept');
  assert.notEqual(r2.id, done.id, 'not yesterday\'s puzzle');
  const gone = D.today({ d: DAY, id: 'zz', r: null, n: 2 }, DAY, BANK, 1100, {});
  assert.notEqual(gone.id, 'zz', 'a puzzle no longer in the bank is replaced');
  assert.equal(gone.n, 2);
  const goneDone = { d: DAY, id: 'zz', r: 'missed', n: 2 };
  assert.equal(D.today(goneDone, DAY, BANK, 1100, {}), goneDone, 'a result already given today stands');
});

test('AC4 / DP-D6: state is todo until a result; the result stands until local midnight', () => {
  assert.equal(D.state(null, DAY), 'todo');
  assert.equal(D.state({ d: DAY, id: 'b', r: null, n: 0 }, DAY), 'todo');
  assert.equal(D.state({ d: DAY, id: 'b', r: 'solved', n: 1 }, DAY), 'solved');
  assert.equal(D.state({ d: DAY, id: 'b', r: 'missed', n: 1 }, DAY), 'missed');
  assert.equal(D.state({ d: DAY, id: 'b', r: 'solved', n: 1 }, NEXT), 'todo', 'next day');
});

test('AC4 / DP-D6: one try per day: record() takes the first result only, for today\'s puzzle only', () => {
  const r = { d: DAY, id: 'b', r: null, n: 0 };
  const s = D.record(r, DAY, 'b', true);
  assert.deepEqual(s, { d: DAY, id: 'b', r: 'solved', n: 1 });
  assert.equal(r.r, null, 'the input is not changed');
  assert.equal(D.record(s, DAY, 'b', false), s, 'a second result the same day changes nothing');
  assert.deepEqual(D.record(r, DAY, 'b', false), { d: DAY, id: 'b', r: 'missed', n: 1 });
  assert.equal(D.record(r, DAY, 'c', true), r, 'another puzzle is not the daily puzzle');
  assert.equal(D.record(r, NEXT, 'b', true), r, 'a deal day newer than the record: nothing to record on');
  assert.equal(D.record(null, DAY, 'b', true), null);
});

test('AC1 / DP-D1 / scenario 4: who sees the card', () => {
  assert.equal(D.shows(false, null), true, 'Improver, Club, or Show everything on');
  assert.equal(D.shows(true, 'lesson'), false, 'Beginner Home before Foundations is done: one next step only');
  assert.equal(D.shows(true, 'beat'), true, 'Beginner Home: Beat Rani\'s practice partner');
  assert.equal(D.shows(true, 'practice'), true, 'Beginner Home: Keep practising');
  assert.equal(D.shows(true, undefined), false);
});

test('Wording: the card, exactly as signed, with the app\'s apostrophe and no em dash', () => {
  assert.deepEqual(D.lines('todo'), { kicker: 'Daily puzzle', title: 'Today’s puzzle', line: 'One puzzle at your level. About a minute.', button: 'Solve it' });
  assert.deepEqual(D.lines('solved'), { kicker: 'Daily puzzle', title: 'Today’s puzzle', line: 'Solved. A new one tomorrow.', button: null });
  assert.deepEqual(D.lines('missed'), { kicker: 'Daily puzzle', title: 'Today’s puzzle', line: 'Not this time. It’s in your missed puzzles. A new one tomorrow.', button: null });
  for (const k of ['todo', 'solved', 'missed']) assert.ok(!/—|–/.test(JSON.stringify(D.lines(k))), k + ': no em or en dash');
});

// ---------- AC10: the profile's daily record (migrate keeps old saves working, merge never loses progress) ----------
test('AC10: migrate adds an empty daily record to an old save and keeps everything else', () => {
  const old = { v: 5, level: 'improver', start: 'fork', rating: 1100, rn: 30, puz: { m1: { n: 1, ok: 1, box: 1, due: 5 } }, days: { '2026-11-24': { puz: 3, games: 0, course: 0, solved: 2 } }, games: [], course: {}, reviewed: [], t: 9 };
  const p = P.migrate(old);
  assert.deepEqual(p.daily, { d: null, id: null, r: null, n: 0 });
  assert.equal(p.rating, 1100); assert.equal(p.rn, 30); assert.deepEqual(p.puz, old.puz); assert.deepEqual(p.days, old.days); assert.equal(p.level, 'improver');
  assert.equal(p.v, 6, 'D1 made no version bump (a new field with a safe default, as G1\'s pieceTags); v6 is friend challenges (FC3)');
  assert.deepEqual(P.blank().daily, { d: null, id: null, r: null, n: 0 });
});

test('AC10: migrate keeps a good daily record and repairs a broken one', () => {
  const good = { d: DAY, id: 'm3', r: 'solved', n: 4 };
  assert.deepEqual(P.migrate({ v: 5, daily: good }).daily, good);
  assert.deepEqual(P.migrate({ v: 5, daily: { d: DAY, id: 'm3', r: null, n: 0 } }).daily, { d: DAY, id: 'm3', r: null, n: 0 });
  assert.deepEqual(P.migrate({ v: 5, daily: 'junk' }).daily, { d: null, id: null, r: null, n: 0 });
  assert.deepEqual(P.migrate({ v: 5, daily: { d: 7, id: {}, r: 'won', n: -3 } }).daily, { d: null, id: null, r: null, n: 0 });
  assert.deepEqual(P.migrate({ v: 5, daily: { d: DAY, id: 'm3', r: 'missed', n: '2' } }).daily, { d: DAY, id: 'm3', r: 'missed', n: 2 });
});

test('AC10: merge never loses a daily result or the count of finished daily puzzles', () => {
  const m = (a, b) => P.merge({ v: 5, daily: a }, { v: 5, daily: b }).daily;
  assert.deepEqual(m({ d: DAY, id: 'b', r: null, n: 1 }, { d: DAY, id: 'b', r: 'solved', n: 2 }), { d: DAY, id: 'b', r: 'solved', n: 2 }, 'same day: the copy with a result');
  assert.deepEqual(m({ d: DAY, id: 'b', r: 'missed', n: 3 }, { d: DAY, id: 'c', r: null, n: 1 }), { d: DAY, id: 'b', r: 'missed', n: 3 }, 'same day: the local result stays');
  assert.deepEqual(m({ d: DAY, id: 'b', r: null, n: 0 }, { d: DAY, id: 'c', r: null, n: 0 }), { d: DAY, id: 'b', r: null, n: 0 }, 'same day, no results: the device keeps its puzzle');
  assert.deepEqual(m({ d: DAY, id: 'b', r: 'solved', n: 5 }, { d: NEXT, id: 'c', r: null, n: 2 }), { d: NEXT, id: 'c', r: null, n: 5 }, 'the newer day wins; the count is the larger');
  assert.deepEqual(m({ d: '2026-12-1', id: 'b', r: null, n: 0 }, { d: '2026-11-30', id: 'c', r: 'solved', n: 1 }), { d: '2026-12-1', id: 'b', r: null, n: 1 }, 'days compare as dates, not as text');
  assert.deepEqual(m({ d: DAY, id: 'b', r: 'solved', n: 1 }, undefined), { d: DAY, id: 'b', r: 'solved', n: 1 }, 'an older cloud copy without the field changes nothing');
  assert.deepEqual(P.merge({ v: 5 }, { v: 5, daily: { d: DAY, id: 'b', r: 'solved', n: 1 } }).daily, { d: DAY, id: 'b', r: 'solved', n: 1 }, 'an older device copy takes the cloud result');
});

// ---------- fix round 1 ----------
test('Fix 2: never-tried puzzles first, so the daily is not a puzzle from the missed-review list', () => {
  const missed = { c: { n: 1, ok: 0, box: 0, due: 1 }, d: { n: 1, ok: 0, box: 0, due: 1 }, e: { n: 2, ok: 0, box: 0, due: 1 } };
  for (const day of ['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28']) assert.equal(D.pick(BANK, 1100, missed, day).id, 'b', day + ': the one never-tried puzzle near 1100');
  const tried = {}; BANK.forEach((p) => { tried[p.id] = { n: 1, ok: 0 }; });
  assert.ok(['b', 'c', 'd', 'e'].includes(D.pick(BANK, 1100, tried, DAY).id), 'all tried, none solved: an unsolved one near the rating');
  tried.b = { n: 1, ok: 1 }; tried.c = { n: 1, ok: 1 }; tried.d = { n: 1, ok: 1 }; tried.e = { n: 1, ok: 1 };
  assert.equal(D.pick(BANK, 1100, tried, DAY).id, 'f', 'an unsolved one beats a solved one');
});

test('Fix 2: the stored pick solved somewhere else before the daily was tried gives a new pick (no double count)', () => {
  const r0 = D.today(null, DAY, BANK, 1100, {});
  const r1 = D.today(r0, DAY, BANK, 1100, { [r0.id]: { n: 1, ok: 1 } });
  assert.notEqual(r1, r0); assert.notEqual(r1.id, r0.id, 'a new puzzle'); assert.equal(r1.d, DAY); assert.equal(r1.r, null); assert.equal(r1.n, r0.n);
  assert.equal(D.today(r0, DAY, BANK, 1100, { [r0.id]: { n: 1, ok: 0 } }), r0, 'missed elsewhere: it stays (it is still unsolved)');
  const done = Object.assign({}, r0, { r: 'solved', n: 1 });
  assert.equal(D.today(done, DAY, BANK, 1100, { [r0.id]: { n: 1, ok: 1 } }), done, 'solved as the daily puzzle: the result stands');
});

test('Fix 3a / DP-D12: finished after midnight: it counts for the day it was dealt, and n goes up', () => {
  const r = { d: DAY, id: 'b', r: null, n: 2 };
  assert.deepEqual(D.record(r, DAY, 'b', true), { d: DAY, id: 'b', r: 'solved', n: 3 }, 'the record still holds the dealt day: its result');
  const moved = { d: NEXT, id: 'c', r: null, n: 3 };
  assert.deepEqual(D.record(moved, DAY, 'b', false), { d: NEXT, id: 'c', r: null, n: 4 }, 'Home already moved to the new day: n only; the new day stays to do');
  assert.deepEqual(D.record({ d: '2026-12-1', id: 'c', r: null, n: 0 }, '2026-11-30', 'b', true), { d: '2026-12-1', id: 'c', r: null, n: 1 }, 'days compare as dates');
  assert.equal(D.record(moved, NEXT, 'b', true), moved, 'the new day\'s record is not this puzzle');
});

test('Fix 3a / DP-D12: the end card line, on the day and after midnight', () => {
  assert.equal(D.endLine(true, false), 'Solved. A new one tomorrow.');
  assert.equal(D.endLine(false, false), 'Not this time. It’s in your missed puzzles. A new one tomorrow.');
  assert.equal(D.endLine(true, true), 'Solved. Today’s new puzzle is on Home.');
  assert.equal(D.endLine(false, true), 'Not this time. It’s in your missed puzzles. Today’s new puzzle is on Home.');
});

test('Fix 3c: ms to the next local midnight', () => {
  assert.equal(D.untilMidnight(new Date(2026, 10, 25, 23, 59, 0)), 60000);
  assert.equal(D.untilMidnight(new Date(2026, 10, 25, 0, 0, 0)), 86400000);
});
