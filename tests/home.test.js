// Unit tests for www/js/home.js: Beginner Home (S2b, prototype A) state and copy. Run: node --test tests/home.test.js
// Uses the real course order (course.js + roadmap.js), so the Foundations list is the one the app shows.
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const fs = require('fs');
const path = require('path');
const H = require('../www/js/home.js');

const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['course', 'roadmap']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../www/js/' + f + '.js'), 'utf8'), ctx);
const UNITS = vm.runInContext('COURSE', ctx).UNITS;

// The app's course helpers, over a plain course map (same rules as app.js unitParts/unitDone/unitStarted/nextPart).
const parts = (u) => ['learn'].concat(u.practice ? ['practice'] : [], u.apply ? ['apply'] : []);
function helpers(course) {
  const c = (u) => course[u.id] || {};
  return {
    done: (u) => parts(u).every((k) => c(u)[k]),
    started: (u) => parts(u).some((k) => c(u)[k]),
    next: (u) => parts(u).filter((k) => !c(u)[k])[0]
  };
}
const ALL = { learn: 1, practice: 1, apply: 1 };
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, Object.assign({}, ALL)]));
const FOUND = ['rules', 'special', 'board', 'values', 'mate', 'opening', 'blunder'];
function state(start, course, win) { const h = helpers(course); return H.state({ start, course }, UNITS, h.done, h.started, h.next, !!win); }

test('Foundations list: level 1 units at or after the start, in course order', () => {
  const ids = (start) => Array.from(H.foundations(UNITS, start), (u) => u.id); /* the course lives in a vm context: copy into this realm */
  assert.deepEqual(ids('rules'), FOUND);
  assert.deepEqual(ids('board'), FOUND.slice(2));
  assert.deepEqual(ids(null), FOUND, 'no start = from the first unit');
  assert.deepEqual(ids('nope'), FOUND, 'unknown start = from the first unit (as Profile.nextUnit)');
  assert.deepEqual(ids('fork'), [], 'a start after Foundations: nothing to count');
});

test('Scenario 1: new Beginner at rules: Lesson 1 of 7, empty bar, Start lesson, Just play a game', () => {
  const s = state('rules', {});
  assert.equal(s.kind, 'lesson'); assert.equal(s.unit.id, 'rules'); assert.equal(s.n, 1); assert.equal(s.m, 7); assert.equal(s.done, 0);
  assert.equal(s.part, 'learn'); assert.equal(s.started, false);
  const l = H.lines(s, 'rani', false);
  assert.equal(l.head, 'Today you’ll learn how the pieces move.');
  assert.equal(l.line, 'Each piece has its own way. I’ll show you every one.');
  assert.equal(l.kicker, 'Lesson 1 of 7'); assert.equal(l.title, 'How the pieces move');
  assert.deepEqual(l.bar, { done: 0, m: 7, text: '0 of 7 lessons done' });
  assert.equal(l.button, 'Start lesson'); assert.equal(l.go, 'part');
  assert.equal(l.second, 'Just play a game'); assert.equal(l.alt, 'game');
});

test('Scenario 2: 3 lessons done and the Learn part of values: Lesson 4 of 7, bar 3 of 7, practise next, Continue', () => {
  const s = state('rules', Object.assign(done('rules', 'special', 'board'), { values: { learn: 1 } }));
  assert.equal(s.unit.id, 'values'); assert.equal(s.n, 4); assert.equal(s.m, 7); assert.equal(s.done, 3); assert.equal(s.part, 'practice'); assert.equal(s.started, true);
  const l = H.lines(s, 'rani', false);
  assert.equal(l.head, 'Now let’s practise.'); assert.equal(l.line, 'A few quick ones on the board.');
  assert.equal(l.kicker, 'Lesson 4 of 7'); assert.equal(l.title, 'Piece values and free pieces');
  assert.equal(l.bar.text, '3 of 7 lessons done');
  assert.equal(l.button, 'Continue');
});

test('Scenario 3 / D45: Karthik (start board) finished it: Lesson 2 of 5, Piece values and free pieces', () => {
  const s = state('board', done('board'));
  assert.equal(s.n, 2); assert.equal(s.m, 5); assert.equal(s.done, 1);
  const l = H.lines(s, 'rani', false);
  assert.equal(l.kicker, 'Lesson 2 of 5'); assert.equal(l.title, 'Piece values and free pieces');
  assert.equal(l.bar.text, '1 of 5 lessons done');
  assert.equal(l.head, 'Today: what each piece is worth.'); assert.equal(l.button, 'Start lesson');
  assert.equal(H.lines(state('board', {}), 'rani', false).kicker, 'Lesson 1 of 5', 'Karthik on day one');
});

test('Lessons before the start point never count (D31, D45)', () => {
  const s = state('board', done('rules', 'special'));
  assert.equal(s.unit.id, 'board'); assert.equal(s.done, 0); assert.equal(s.m, 5);
});

test('Game task next: "Now try it in a real game." with my practice partner; Gaja says Rani’s (D48)', () => {
  const s = state('rules', Object.assign(done('rules', 'special', 'board', 'values', 'mate'), { opening: { learn: 1 } }));
  assert.equal(s.unit.id, 'opening'); assert.equal(s.part, 'apply'); assert.equal(s.n, 6);
  let l = H.lines(s, 'rani', false);
  assert.equal(l.head, 'Now try it in a real game.'); assert.equal(l.line, 'You’ll play my practice partner.'); assert.equal(l.button, 'Continue');
  l = H.lines(s, 'gaja', false);
  assert.equal(l.head, 'Now try it in a real game.'); assert.equal(l.line, 'You’ll play Rani’s practice partner.');
});

test('Every new-lesson pair, character for character', () => {
  const PAIRS = {
    rules: ['Today you’ll learn how the pieces move.', 'Each piece has its own way. I’ll show you every one.'],
    special: ['Today: castling and other special moves.', 'And the ways a game can end in a draw.'],
    board: ['Today you’ll learn to find any square.', 'Every square has a name. Soon you’ll know them all.'],
    values: ['Today: what each piece is worth.', 'Then you’ll spot free pieces and keep yours safe.'],
    mate: ['Today you’ll learn check and checkmate.', 'Checkmate wins the game. Let’s spot it in one move.'],
    opening: ['Today: how to start a game well.', 'Bring your pieces out and keep your king safe.'],
    blunder: ['Today: one quick check before every move.', 'It stops most lost pieces.']
  };
  FOUND.forEach((id, i) => {
    const s = state('rules', done(...FOUND.slice(0, i)));
    assert.equal(s.unit.id, id); assert.equal(s.n, i + 1); assert.equal(s.done, i);
    for (const coach of ['rani', 'gaja']) {
      const l = H.lines(s, coach, false);
      assert.deepEqual([l.head, l.line], PAIRS[id], id + ' (' + coach + ')');
      assert.equal(l.button, 'Start lesson');
    }
  });
});

test('A lesson whose Learn part is next but another part is done reads its pair and says Continue', () => {
  const s = state('rules', Object.assign(done('rules', 'special'), { board: { practice: 1 } }));
  assert.equal(s.part, 'learn'); assert.equal(s.started, true);
  const l = H.lines(s, 'rani', false);
  assert.equal(l.head, 'Today you’ll learn to find any square.'); assert.equal(l.button, 'Continue');
});

test('First unfinished lesson wins even when a later one is done; the bar counts every done lesson', () => {
  const s = state('rules', done('special', 'board'));
  assert.equal(s.unit.id, 'rules'); assert.equal(s.n, 1); assert.equal(s.done, 2);
  assert.equal(H.lines(s, 'rani', false).bar.text, '2 of 7 lessons done');
});

test('Scenario 5 / D47: Foundations done, partner not beaten: Next step, Beat Rani’s practice partner, Play now, no second button', () => {
  const s = state('rules', done(...FOUND), false);
  assert.equal(s.kind, 'beat'); assert.equal(s.m, 7); assert.equal(s.done, 7);
  let l = H.lines(s, 'rani', false);
  assert.equal(l.head, 'You finished every Foundations lesson!'); assert.equal(l.line, 'Now beat my practice partner.');
  assert.equal(l.kicker, 'Next step'); assert.equal(l.title, 'Beat Rani’s practice partner');
  assert.equal(l.bar, null, 'no bar'); assert.equal(l.button, 'Play now'); assert.equal(l.go, 'game');
  assert.equal(l.second, null); assert.equal(l.alt, null);
  l = H.lines(s, 'rani', true);
  assert.equal(l.button, 'Back to my game', 'an unfinished game: back to it'); assert.equal(l.go, 'back'); assert.equal(l.second, null);
  assert.equal(H.lines(s, 'gaja', false).line, 'Now beat Rani’s practice partner.', 'D48');
  assert.equal(H.lines(s, 'gaja', false).head, 'You finished every Foundations lesson!');
});

test('Scenario 6 / D39: Foundations done and the partner beaten: Practice, Puzzles at your level, Start 10 puzzles', () => {
  const s = state('board', done(...FOUND.slice(2)), true);
  assert.equal(s.kind, 'practice');
  for (const coach of ['rani', 'gaja']) {
    const l = H.lines(s, coach, false);
    assert.equal(l.head, 'You know the basics now.'); assert.equal(l.line, 'Keep practising, or move up to Improver any time in Settings.');
    assert.equal(l.kicker, 'Practice'); assert.equal(l.title, 'Puzzles at your level'); assert.equal(l.bar, null);
    assert.equal(l.button, 'Start 10 puzzles'); assert.equal(l.go, 'puzzles');
    assert.equal(l.second, 'Just play a game'); assert.equal(l.alt, 'game');
  }
  assert.equal(H.lines(s, 'rani', true).second, 'Back to my game');
  assert.equal(H.lines(s, 'rani', true).alt, 'back');
});

test('D39: Home never points a Beginner at a Tactics lesson, even with Tactics started', () => {
  const s = state('rules', Object.assign(done(...FOUND), { fork: { learn: 1 } }), true);
  assert.equal(s.kind, 'practice');
  const t = JSON.stringify(H.lines(s, 'rani', false));
  assert.ok(!/Forks|Tactics/.test(t), t);
});

test('A win without Foundations done still shows the next lesson', () => {
  assert.equal(state('rules', {}, true).kind, 'lesson');
});

test('D44: second button follows an unfinished game in the lesson state', () => {
  const s = state('rules', {});
  assert.deepEqual([H.lines(s, 'rani', true).second, H.lines(s, 'rani', true).alt], ['Back to my game', 'back']);
  assert.equal(H.lines(s, 'rani', true).button, 'Start lesson', 'the card itself does not change');
});

test('Card icon and tint: a piece per lesson, Learn tint for lessons, Play for the partner, Train for practice', () => {
  const PIECES = 'kqrbnp';
  FOUND.forEach((id, i) => {
    const l = H.lines(state('rules', done(...FOUND.slice(0, i))), 'rani', false);
    assert.ok(PIECES.includes(l.icon) && l.icon.length === 1, id + ': ' + l.icon); assert.equal(l.zone, 'learn');
  });
  assert.equal(H.lines(state('rules', done(...FOUND)), 'rani', false).zone, 'play');
  assert.equal(H.lines(state('rules', done(...FOUND), true), 'rani', false).zone, 'train');
});

test('D43: streak chip from 1 day, hidden at 0', () => {
  assert.equal(H.streak(0), null);
  assert.equal(H.streak(-1), null);
  assert.deepEqual(H.streak(1), { text: '1 day', label: 'Streak: 1 day' });
  assert.deepEqual(H.streak(3), { text: '3 days', label: 'Streak: 3 days' });
});

test('An unknown Foundations lesson (a future course unit) falls back to its title, never undefined', () => {
  const units = [{ id: 'zz', level: 1, title: 'Brand new lesson', lesson: [{}] }];
  const s = H.state({ start: 'zz', course: {} }, units, () => false, () => false, () => 'learn', false);
  const l = H.lines(s, 'rani', false);
  assert.equal(l.head, 'Brand new lesson'); assert.equal(l.line, ''); assert.equal(l.title, 'Brand new lesson');
});

test('All copy: no em dashes, curly apostrophes only, no jargon (L8)', () => {
  const all = [];
  const add = (s, coach, on) => { const l = H.lines(s, coach, on); all.push(l.head, l.line, l.kicker, l.title, l.button, l.second || '', l.bar ? l.bar.text : ''); };
  FOUND.forEach((id, i) => { const c = done(...FOUND.slice(0, i)); for (const coach of ['rani', 'gaja']) for (const on of [false, true]) add(state('rules', c), coach, on); });
  for (const coach of ['rani', 'gaja']) for (const on of [false, true]) {
    add(state('rules', Object.assign(done('rules'), { special: {} , board: { learn: 1 } })), coach, on);
    add(state('rules', Object.assign(done(...FOUND.slice(0, 5)), { opening: { learn: 1 } })), coach, on);
    add(state('rules', done(...FOUND)), coach, on); add(state('rules', done(...FOUND), true), coach, on);
  }
  const t = all.join('\n');
  assert.ok(!/—|–/.test(t), 'no em or en dash');
  assert.ok(!/'/.test(t), 'curly apostrophes only');
  assert.ok(!/stockfish|engine|rated|rating|accuracy|eval|~\s?\d|\d+%/i.test(t), 'no jargon: ' + (t.match(/stockfish|engine|rated|rating|accuracy|eval|~\s?\d|\d+%/i) || [])[0]);
  assert.ok(!/(^|[^\w])([KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8]|O-O)/.test(t), 'no notation');
});

test('F5: every Foundations lesson in the real course has its signed pair (no silent title-only fallback)', () => {
  const ids = Array.from(UNITS.filter((u) => u.level === 1), (u) => u.id);
  assert.ok(ids.length >= 7, 'Foundations lessons found: ' + ids);
  for (const id of ids) {
    assert.ok(Array.isArray(H.PAIRS[id]) && H.PAIRS[id].length === 2 && H.PAIRS[id].every((s) => typeof s === 'string' && s.length > 5), id + ' has a headline and a line');
  }
});

test('D49: the ask-first note copy, exactly', () => {
  assert.deepEqual(H.ASK, { text: 'You have a game going. Finish it first?', back: 'Back to my game', go: 'Start the lesson game' });
  assert.ok(!/—|'/.test(Object.values(H.ASK).join(' ')), 'no em dash, curly apostrophes only');
});

test('D49: Continue asks first only for a lesson game with an unfinished game going', () => {
  const opening = state('rules', Object.assign(done(...FOUND.slice(0, 5)), { opening: { learn: 1 } }));
  const blunder = state('rules', Object.assign(done(...FOUND.slice(0, 6)), { blunder: { learn: 1, practice: 1 } }));
  for (const s of [opening, blunder]) {
    assert.equal(s.part, 'apply', s.unit.id + ': game task next');
    assert.equal(H.askFirst(s, true), true, s.unit.id + ': asks with a game going');
    assert.equal(H.askFirst(s, false), false, s.unit.id + ': no game going, no question');
    const l = H.lines(s, 'rani', true);
    assert.equal(l.go, 'ask'); assert.equal(l.button, 'Continue', 'the card itself does not change');
    assert.equal(H.lines(s, 'rani', false).go, 'part');
  }
  const practice = state('rules', Object.assign(done(...FOUND.slice(0, 6)), { blunder: { learn: 1 } }));
  assert.equal(practice.part, 'practice');
  assert.equal(H.askFirst(practice, true), false, 'a practice part never asks');
  assert.equal(H.lines(practice, 'rani', true).go, 'part');
  assert.equal(H.askFirst(state('rules', {}), true), false, 'a Learn part never asks');
  assert.equal(H.askFirst(state('rules', done(...FOUND)), true), false, 'the Beat card has Back to my game itself');
  assert.equal(H.askFirst(state('rules', done(...FOUND), true), true), false, 'Keep practising never asks');
});
