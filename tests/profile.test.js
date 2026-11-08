// Unit tests for www/js/profile.js (run: node --test tests/)
const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../www/js/profile.js');

// A cut-down copy of the real course order (ids and levels match course.js + roadmap.js).
const U = (id, level, practice, apply) => ({ id, level, practice: practice ? {} : undefined, apply: apply ? {} : undefined });
const UNITS = [
  U('rules', 1, 1), U('special', 1), U('board', 1, 1), U('values', 1, 1), U('mate', 1, 1), U('opening', 1, 0, 1), U('blunder', 1, 1, 1),
  U('fork', 2, 1), U('pin', 2, 1), U('check2', 2, 0, 1),
  U('kq', 3, 0, 1), U('kr', 3, 0, 1)
];
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, { learn: 1, practice: 1, apply: 1 }]));
const arr = (n, k) => Array.from({ length: n }, (_, i) => i < k);

test('LEVELS table matches the product spec', () => {
  assert.deepEqual(Object.keys(P.LEVELS), ['beginner', 'improver', 'club']);
  assert.equal(P.LEVELS.beginner.rating, 600);
  assert.equal(P.LEVELS.improver.rating, 1000);
  assert.equal(P.LEVELS.club.rating, 1300);
  assert.equal(P.LEVELS.beginner.max, 800);
  assert.equal(P.LEVELS.improver.min, 800);
  assert.equal(P.LEVELS.improver.max, 1200);
  assert.equal(P.LEVELS.club.min, 1200);
});

test('levelFromRating uses the bands <800, 800-1199, 1200+', () => {
  assert.equal(P.levelFromRating(0), 'beginner');
  assert.equal(P.levelFromRating(799), 'beginner');
  assert.equal(P.levelFromRating(800), 'improver');
  assert.equal(P.levelFromRating(820), 'improver');
  assert.equal(P.levelFromRating(1199.6), 'improver');
  assert.equal(P.levelFromRating(1200), 'club');
  assert.equal(P.levelFromRating(1350), 'club');
});

test('AC2: Never played = Beginner, zero puzzles, start rules', () => {
  const r = P.scoreLevel('never', [], { units: UNITS });
  assert.equal(r.level, 'beginner');
  assert.equal(r.start, 'rules');
  assert.equal(r.offerClub, false);
  assert.equal(P.puzzleCount('never'), 0);
});

test('AC3: Know-the-moves scoring, every row', () => {
  assert.equal(P.puzzleCount('knows'), 5);
  const want = ['beginner', 'beginner', 'beginner', 'improver', 'improver', 'improver'];
  for (let k = 0; k <= 5; k++) {
    const r = P.scoreLevel('knows', arr(5, k), { units: UNITS });
    assert.equal(r.level, want[k], k + ' of 5');
    assert.equal(r.start, want[k] === 'beginner' ? 'board' : 'fork', 'start for ' + k + ' of 5');
    assert.equal(r.offerClub, k === 5, 'Try Club offered only at 5 of 5');
  }
});

test('AC3/D9: Try Club? = 2 harder puzzles, 1+ correct = Club (also before a Skip), Skip with 0 right stays Improver', () => {
  const all = arr(5, 5);
  assert.equal(P.puzzleCount('club'), 2);
  assert.equal(P.scoreLevel('knows', { main: all, club: [true, true] }, { units: UNITS }).level, 'club');
  assert.equal(P.scoreLevel('knows', { main: all, club: [false, true] }, { units: UNITS }).level, 'club');
  assert.equal(P.scoreLevel('knows', { main: all, club: [true, false] }, { units: UNITS }).start, 'kq');
  assert.equal(P.scoreLevel('knows', { main: all, club: [false, false] }, { units: UNITS }).level, 'improver');
  assert.equal(P.scoreLevel('knows', { main: all, club: [], clubSkipped: true }, { units: UNITS }).level, 'improver');
  assert.equal(P.scoreLevel('knows', { main: all, club: [true], clubSkipped: true }, { units: UNITS }).level, 'club', '1 right then Skip = Club (Suresh)');
  assert.equal(P.scoreLevel('knows', { main: all, club: [false], clubSkipped: true }, { units: UNITS }).level, 'improver', '0 right then Skip = Improver');
});

test('AC3: Play-often scoring, every row', () => {
  assert.equal(P.puzzleCount('often'), 6);
  const want = ['beginner', 'beginner', 'beginner', 'improver', 'improver', 'club', 'club'];
  for (let k = 0; k <= 6; k++) {
    const r = P.scoreLevel('often', arr(6, k), { units: UNITS });
    assert.equal(r.level, want[k], k + ' of 6');
    assert.equal(r.start, { beginner: 'board', improver: 'fork', club: 'kq' }[want[k]]);
    assert.equal(r.offerClub, false);
  }
});

test('AC4: Skip at the first question = Beginner starting at board', () => {
  const r = P.scoreLevel('skip', [], { units: UNITS });
  assert.equal(r.level, 'beginner');
  assert.equal(r.start, 'board');
});

test('AC4: Skip during puzzles = level from answers so far (0-2 Beginner, 3+ Improver)', () => {
  const s = (path, main) => P.scoreLevel(path, { main, skipped: true }, { units: UNITS });
  assert.equal(s('knows', []).level, 'beginner');
  assert.equal(s('knows', [true, true]).level, 'beginner');
  assert.equal(s('knows', [true, true]).start, 'board');
  assert.equal(s('knows', [true, true, false]).level, 'beginner');
  assert.equal(s('knows', [true, true, true]).level, 'improver');
  assert.equal(s('knows', [true, true, true, true]).offerClub, false);
  assert.equal(s('often', [true, true, true, true, true]).level, 'improver', 'skip never gives Club');
  assert.equal(s('often', [false, true, true]).level, 'beginner');
});

test('AC8: start rule per level, and Beginner chosen in Settings starts at rules', () => {
  assert.equal(P.startUnit('beginner', false, UNITS), 'rules');
  assert.equal(P.startUnit('beginner', true, UNITS), 'board');
  assert.equal(P.startUnit('improver', true, UNITS), 'fork');
  assert.equal(P.startUnit('club', true, UNITS), 'kq');
  const p = P.migrate({ v: 5, level: 'club', levelT: 5, start: 'kq', placed: 'check', course: done('rules', 'fork'), rn: 3, rating: 1250 });
  const before = JSON.stringify(p.course);
  const b = P.setLevel(p, 'beginner', { now: 100, placed: 'chosen', units: UNITS });
  assert.equal(b.level, 'beginner');
  assert.equal(b.start, 'rules');
  assert.equal(b.levelT, 100);
  assert.equal(b.placed, 'chosen');
  assert.equal(JSON.stringify(b.course), before, 'no lesson marked or cleared');
  const c = P.setLevel(b, 'improver', { now: 200, placed: 'chosen', units: UNITS });
  assert.equal(c.start, 'fork');
  assert.equal(JSON.stringify(c.course), before);
});

test('AC8: nextUnit skips units before start and never marks them done', () => {
  const p = P.migrate({ v: 5, level: 'improver', start: 'fork', course: done('fork') });
  assert.equal(P.nextUnit(p, UNITS).id, 'pin');
  assert.equal(p.course.rules, undefined);
  const q = P.migrate({ v: 5, level: 'beginner', start: 'board', course: {} });
  assert.equal(P.nextUnit(q, UNITS).id, 'board');
  const r = P.migrate({ v: 5, level: 'beginner', start: 'rules', course: done('rules', 'special') });
  assert.equal(P.nextUnit(r, UNITS).id, 'board');
  const n = P.migrate({ v: 5, course: {} });
  assert.equal(P.nextUnit(n, UNITS).id, 'rules', 'no start = from the beginning');
});

test('AC9: starting rating only when there are no rated puzzles yet', () => {
  const fresh = P.migrate({});
  const a = P.setLevel(fresh, 'club', { now: 1, placed: 'check', units: UNITS });
  assert.equal(a.rating, 1300);
  const b = P.setLevel(P.migrate({ v: 5, rating: 912, rn: 4 }), 'club', { now: 1, placed: 'check', units: UNITS });
  assert.equal(b.rating, 912);
  assert.equal(b.rn, 4);
});

test('setLevel records provisional and placed', () => {
  const a = P.setLevel(P.migrate({}), 'improver', { now: 7, placed: 'check', provisional: true, units: UNITS });
  assert.equal(a.provisional, true);
  assert.equal(a.placed, 'check');
  const b = P.setLevel(P.migrate({}), 'improver', { now: 7, placed: 'check', provisional: false, units: UNITS });
  assert.equal(b.provisional, false);
});

test('migrate: null and empty', () => {
  assert.equal(P.migrate(null), null);
  const e = P.migrate({});
  assert.equal(e.v, 5);
  assert.equal(e.level, null, 'empty profile has no level, so it sees the check');
  assert.equal(e.rating, 800);
  assert.equal(e.rn, 0);
  assert.deepEqual(e.games, []);
  assert.equal(e.showAll, false);
  assert.equal(e.unlockAll, false);
  assert.equal(P.needsCheck(e), true);
});

test('migrate: v4 with rating 820 and a game = derived Improver, all tabs, start rules', () => {
  const v4 = { v: 4, games: [{ id: 'g1', d: 1, r: 'W', sans: ['e4'] }], puz: {}, rating: 820, rn: 0, course: {}, days: { '2026-1-1': { games: 1 } }, reviewed: [], t: 50, theme: 'classic' };
  const p = P.migrate(v4);
  assert.equal(p.v, 5);
  assert.equal(p.level, 'improver');
  assert.equal(p.levelT, 0);
  assert.equal(p.placed, 'derived');
  assert.equal(p.start, 'rules');
  assert.equal(p.unlockAll, true);
  assert.equal(p.provisional, false);
  assert.equal(p.rating, 820);
  assert.deepEqual(p.games, v4.games);
  assert.deepEqual(p.days, v4.days);
  assert.equal(p.theme, 'classic');
  assert.equal(p.t, 50);
  assert.equal(P.needsCheck(p), false);
});

test('migrate: v4 with rating 1350 and puzzles = derived Club', () => {
  const p = P.migrate({ v: 4, games: [], puz: { m1: { n: 2, ok: 1 } }, rating: 1350, rn: 30, course: {} });
  assert.equal(p.level, 'club');
  assert.equal(p.placed, 'derived');
  assert.equal(p.rn, 30);
  assert.deepEqual(p.puz, { m1: { n: 2, ok: 1 } });
});

test('migrate: v4 with course progress only is derived too', () => {
  const p = P.migrate({ v: 4, rating: 700, course: { rules: { learn: 1 } } });
  assert.equal(p.level, 'beginner');
  assert.equal(p.placed, 'derived');
});

test('migrate: v4 with no progress is treated as new', () => {
  const p = P.migrate({ v: 4, games: [], puz: {}, rating: 800, rn: 0, course: {}, days: {}, reviewed: [], t: 9 });
  assert.equal(p.level, null);
  assert.equal(p.placed, null);
  assert.equal(p.unlockAll, false);
  assert.equal(P.needsCheck(p), true);
});

test('migrate: v5 keeps its fields, including unknown future ones', () => {
  const v5 = { v: 5, level: 'club', levelT: 9, placed: 'check', start: 'kq', showAll: true, unlockAll: false, provisional: true, pgsDeclined: true, levelOfferT: 3, rating: 1300, rn: 0, games: [], puz: {}, course: {}, days: {}, reviewed: [], t: 4, extra: 'keep me' };
  const p = P.migrate(v5);
  for (const k of Object.keys(v5)) assert.deepEqual(p[k], v5[k], k);
  assert.notEqual(p, v5, 'returns a copy');
});

test('AC12: merge never removes a completed lesson, game or reviewed game', () => {
  const a = P.migrate({ v: 5, games: [{ id: 'g1', d: 1 }, { id: 'g2', d: 2 }], course: { rules: { learn: 1, practice: 1 }, board: { learn: 1 } }, reviewed: ['g1'], puz: { m1: { n: 1, ok: 1 } }, t: 10 });
  const b = P.migrate({ v: 5, games: [{ id: 'g3', d: 3 }, { id: 'g1', d: 1 }], course: { board: { practice: 1 }, fork: { learn: 1 } }, reviewed: ['g3'], puz: { m2: { n: 2, ok: 0 } }, t: 20 });
  for (const m of [P.merge(a, b), P.merge(b, a)]) {
    assert.deepEqual(m.games.map((g) => g.id).sort(), ['g1', 'g2', 'g3']);
    assert.deepEqual(m.course.rules, { learn: 1, practice: 1 });
    assert.deepEqual(m.course.board, { learn: 1, practice: 1 });
    assert.deepEqual(m.course.fork, { learn: 1 });
    assert.deepEqual(m.reviewed.sort(), ['g1', 'g3']);
    assert.ok(m.puz.m1 && m.puz.m2);
    assert.equal(m.v, 5);
  }
  assert.equal(JSON.stringify(a.course.board), '{"learn":1}', 'inputs are not mutated');
});

test('merge: level and start follow the newer levelT', () => {
  const a = P.migrate({ v: 5, level: 'beginner', start: 'rules', placed: 'check', levelT: 100 });
  const b = P.migrate({ v: 5, level: 'club', start: 'kq', placed: 'chosen', levelT: 200 });
  const m1 = P.merge(a, b), m2 = P.merge(b, a);
  for (const m of [m1, m2]) { assert.equal(m.level, 'club'); assert.equal(m.start, 'kq'); assert.equal(m.levelT, 200); assert.equal(m.placed, 'chosen'); }
});

test('merge: a provisional local level loses to a chosen cloud level, even an older one', () => {
  const local = P.migrate({ v: 5, level: 'beginner', start: 'board', placed: 'check', levelT: 900, provisional: true });
  const cloud = P.migrate({ v: 5, level: 'club', start: 'kq', placed: 'chosen', levelT: 100 });
  const m = P.merge(local, cloud);
  assert.equal(m.level, 'club');
  assert.equal(m.start, 'kq');
  assert.equal(m.provisional, false, 'provisional clears after a cloud load');
});

test('merge: a provisional local level beats a derived cloud level', () => {
  const local = P.migrate({ v: 5, level: 'beginner', start: 'board', placed: 'check', levelT: 900, provisional: true });
  const cloud = P.migrate({ v: 4, rating: 1300, rn: 5, puz: { m1: { n: 1, ok: 1 } } });
  assert.equal(cloud.placed, 'derived');
  const m = P.merge(local, cloud);
  assert.equal(m.level, 'beginner');
  assert.equal(m.unlockAll, false, 'a derived cloud copy does not unlock a local non-derived Beginner');
});

test('merge: unlockAll is OR between non-derived copies, and kept for a derived local level', () => {
  const lvlUp = P.migrate({ v: 5, level: 'improver', placed: 'chosen', levelT: 50, unlockAll: true });
  const other = P.migrate({ v: 5, level: 'beginner', placed: 'check', levelT: 10 });
  assert.equal(P.merge(other, lvlUp).unlockAll, true);
  assert.equal(P.merge(lvlUp, other).unlockAll, true);
  const derived = P.migrate({ v: 4, rating: 900, games: [{ id: 'g', d: 1 }] });
  assert.equal(P.merge(derived, P.migrate({ v: 4, rating: 700, rn: 2, puz: { m: { n: 1 } } })).unlockAll, true);
});

test('merge: an offline Settings pick (not provisional) beats an older cloud level', () => {
  const local = P.setLevel(P.migrate({ v: 5, level: 'beginner', placed: 'check', levelT: 10 }), 'club', { now: 5000, placed: 'chosen', units: UNITS });
  assert.equal(local.provisional, false);
  const cloud = P.migrate({ v: 5, level: 'beginner', placed: 'check', levelT: 10, start: 'board' });
  assert.equal(P.merge(local, cloud).level, 'club');
});

test('merge: game history keeps the newest 30 (AC12, confirmed)', () => {
  const g = (i) => ({ id: 'g' + i, d: i });
  const a = P.migrate({ v: 5, games: Array.from({ length: 30 }, (_, i) => g(i * 2)) });
  const b = P.migrate({ v: 5, games: Array.from({ length: 30 }, (_, i) => g(i * 2 + 1)) });
  const m = P.merge(a, b);
  assert.equal(m.games.length, 30);
  assert.deepEqual(m.games.map((x) => x.d), Array.from({ length: 30 }, (_, i) => 59 - i));
});

test('merge: skips corrupted entries instead of throwing', () => {
  const local = P.migrate({ v: 5, level: 'club', rn: 5, rating: 1300, puz: { a: { n: 1, ok: 1 }, z: null }, course: { rules: 'oops', board: { learn: 1 } }, days: { d1: null, d2: { puz: 2 } }, games: [null, { id: 'g1', d: 1 }] });
  const cloud = { v: 5, puz: { a: null, b: { n: 2, ok: 1 }, c: 'x' }, days: { d1: { puz: 1 }, d2: null, d3: 'x' }, course: { rules: { learn: 1 }, board: 'x', mate: null }, games: [{ id: 'g2', d: 2 }, 'junk'], reviewed: [null, 'r1'] };
  const m = P.merge(local, cloud);
  assert.deepEqual(m.puz.a, { n: 1, ok: 1 });
  assert.deepEqual(m.puz.b, { n: 2, ok: 1 });
  assert.deepEqual(m.course.rules, { learn: 1 });
  assert.deepEqual(m.course.board, { learn: 1 });
  assert.deepEqual(m.days.d1, { puz: 1 });
  assert.deepEqual(m.days.d2, { puz: 2 });
  assert.deepEqual(m.games.map((x) => x.id), ['g2', 'g1']);
  for (const bad of ['x', 42, null, undefined, [], true]) assert.equal(P.merge(local, bad).level, 'club', JSON.stringify(bad));
});

test('merge: keeps unknown keys from either copy and the higher v', () => {
  const a = P.migrate({ v: 5, localOnly: 1, t: 1 });
  const b = { v: 6, cloudOnly: { x: 1 }, t: 2 };
  const m = P.merge(a, b);
  assert.equal(m.localOnly, 1);
  assert.deepEqual(m.cloudOnly, { x: 1 });
  assert.equal(m.v, 6);
  assert.equal(P.migrate({ v: 7 }).v, 7, 'migrate never lowers v');
});

test('merge: no local level takes the cloud level', () => {
  const m = P.merge(P.migrate({}), P.migrate({ v: 5, level: 'improver', start: 'fork', placed: 'check', levelT: 5 }));
  assert.equal(m.level, 'improver');
  assert.equal(m.start, 'fork');
});

test('merge: rating follows more rated puzzles, tie goes to the newer copy', () => {
  const a = P.migrate({ v: 5, rating: 1000, rn: 10, t: 999 });
  const b = P.migrate({ v: 5, rating: 900, rn: 12, t: 1 });
  assert.equal(P.merge(a, b).rating, 900);
  assert.equal(P.merge(a, b).rn, 12);
  assert.equal(P.merge(b, a).rating, 900);
  const c = P.migrate({ v: 5, rating: 1111, rn: 12, t: 50 });
  assert.equal(P.merge(b, c).rating, 1111);
  assert.equal(P.merge(c, b).rating, 1111);
});

test('merge: showAll and theme follow the newer copy, pgsDeclined stays local', () => {
  const a = P.migrate({ v: 5, showAll: true, theme: 'a', t: 10, pgsDeclined: true });
  const b = P.migrate({ v: 5, showAll: false, theme: 'b', t: 20, pgsDeclined: false });
  const m = P.merge(a, b);
  assert.equal(m.showAll, false);
  assert.equal(m.theme, 'b');
  assert.equal(m.pgsDeclined, true);
  assert.equal(P.merge(b, a).pgsDeclined, false);
  assert.equal(P.merge(b, a).showAll, false, 'local copy is newer');
  assert.equal(P.merge(b, a).theme, 'b');
});

test('merge with nothing from the cloud keeps the local copy', () => {
  const a = P.migrate({ v: 5, level: 'club', rating: 1300, games: [{ id: 'g1', d: 1 }] });
  const m = P.merge(a, null);
  assert.equal(m.level, 'club');
  assert.equal(m.games.length, 1);
});

test('unlockDone: 3 fully done units at or after start', () => {
  const p = P.migrate({ v: 5, level: 'beginner', start: 'board', course: done('rules', 'special', 'board', 'values') });
  assert.equal(P.unlockDone(p, UNITS), false, 'units before start do not count');
  p.course = Object.assign(p.course, done('mate'));
  assert.equal(P.unlockDone(p, UNITS), true);
  const half = P.migrate({ v: 5, start: 'board', course: Object.assign(done('board', 'values'), { mate: { learn: 1 } }) });
  assert.equal(P.unlockDone(half, UNITS), false, 'learn only is not fully done');
  assert.equal(P.unlockDone(P.migrate({ v: 5, start: 'board', unlockAll: true }), UNITS), true);
  assert.equal(P.unlockDone(P.migrate({ v: 5, start: 'board', showAll: true }), UNITS), true);
});

// ---------- S2a: level-up offer (D20, D21) ----------
const DAY = 86400000;
test('levelComplete: Beginner from board needs board..blunder (the units before start do not count)', () => {
  const p = P.migrate({ v: 5, level: 'beginner', start: 'board', course: done('board', 'values', 'mate', 'opening') });
  assert.equal(P.levelComplete(p, UNITS), false, 'blunder not done yet');
  p.course = Object.assign(p.course, { blunder: { learn: 1, practice: 1 } });
  assert.equal(P.levelComplete(p, UNITS), false, 'blunder apply missing: all parts are needed');
  p.course.blunder.apply = 1;
  assert.equal(P.levelComplete(p, UNITS), true, 'rules and special were skipped and still complete');
  const fromRules = P.migrate({ v: 5, level: 'beginner', start: 'rules', course: done('board', 'values', 'mate', 'opening', 'blunder') });
  assert.equal(P.levelComplete(fromRules, UNITS), false, 'start rules: rules and special count');
  fromRules.course = Object.assign(fromRules.course, done('rules', 'special'));
  assert.equal(P.levelComplete(fromRules, UNITS), true);
});

test('levelComplete: Improver needs every level 2 unit; Club is never complete; no level = false', () => {
  const imp = P.migrate({ v: 5, level: 'improver', start: 'fork', course: done('fork', 'pin') });
  assert.equal(P.levelComplete(imp, UNITS), false);
  imp.course = Object.assign(imp.course, done('check2'));
  assert.equal(P.levelComplete(imp, UNITS), true);
  const club = P.migrate({ v: 5, level: 'club', start: 'kq', course: done('kq', 'kr') });
  assert.equal(P.levelComplete(club, UNITS), false, 'Club is never complete');
  assert.equal(P.levelComplete(P.migrate({ v: 5, course: done('rules', 'special', 'board', 'values', 'mate', 'opening', 'blunder') }), UNITS), false, 'no level');
  assert.equal(P.levelComplete(null, UNITS), false);
});

test('levelComplete: a derived Improver (start rules) still only needs level 2 units', () => {
  const p = P.migrate({ v: 5, level: 'improver', placed: 'derived', start: 'rules', course: done('fork', 'pin', 'check2') });
  assert.equal(P.levelComplete(p, UNITS), true);
});

test('offerDue: complete and 7 days since max(levelOfferT, levelT)', () => {
  const now = 100 * DAY;
  const base = { v: 5, level: 'beginner', start: 'board', course: done('board', 'values', 'mate', 'opening', 'blunder') };
  assert.equal(P.offerDue(P.migrate(Object.assign({}, base, { levelT: now - 8 * DAY, levelOfferT: 0 })), now, UNITS), true);
  assert.equal(P.offerDue(P.migrate(Object.assign({}, base, { levelT: now - 8 * DAY, levelOfferT: now - 6 * DAY })), now, UNITS), false, 'Not yet 6 days ago');
  assert.equal(P.offerDue(P.migrate(Object.assign({}, base, { levelT: now - 8 * DAY, levelOfferT: now - 7 * DAY })), now, UNITS), true, 'exactly 7 days');
  assert.equal(P.offerDue(P.migrate(Object.assign({}, base, { levelT: now - 2 * DAY, levelOfferT: now - 30 * DAY })), now, UNITS), false, 'level changed in Settings 2 days ago');
  assert.equal(P.offerDue(P.migrate(Object.assign({}, base, { course: done('board') , levelT: 0 })), now, UNITS), false, 'not complete');
  assert.equal(P.offerDue(P.migrate({ v: 5, level: 'club', start: 'kq', course: done('kq', 'kr'), levelT: 0 }), now, UNITS), false, 'Club never');
});
