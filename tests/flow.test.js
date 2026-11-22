// Unit tests for www/js/flow.js: which end card to show after a game, a lesson step or a puzzle set, and the Continue card
// for Improver and Club Home (flow rework, slice F1). Run: node --test tests/flow.test.js
// Every row of the two end-card tables and the Continue card table in docs/specs/flow-rework.product.md has a test.
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../www/js/flow.js');

const labels = (list) => list.map((b) => b.label);
const gos = (list) => list.map((b) => b.go);
const NEXT = { title: 'Pins and skewers' };

/* ---------- After a game ---------- */
test('Game row 1: normal game, any result: Review this game, small New game and Home', () => {
  const c = F.afterGame({ goal: null, next: NEXT });
  assert.equal(c.line, null);
  assert.deepEqual(c.main, { label: 'Review this game', go: 'review' });
  assert.deepEqual(labels(c.small), ['New game', 'Home']); assert.deepEqual(gos(c.small), ['newgame', 'home']);
});
test('Game row 2: lesson game, task passed: Next lesson line, Start next lesson, small Review this game and Home', () => {
  const c = F.afterGame({ goal: 'done', next: NEXT });
  assert.equal(c.line, 'Next lesson: Pins and skewers');
  assert.deepEqual(c.main, { label: 'Start next lesson', go: 'nextlesson' });
  assert.deepEqual(labels(c.small), ['Review this game', 'Home']); assert.deepEqual(gos(c.small), ['review', 'home']);
});
test('Game row 3: lesson game, task passed, no lesson left at the level: as a normal game', () => {
  const c = F.afterGame({ goal: 'done', next: null });
  assert.equal(c.line, null);
  assert.deepEqual(c.main, { label: 'Review this game', go: 'review' });
  assert.deepEqual(labels(c.small), ['New game', 'Home']);
});
test('Game row 4: lesson game, task not passed: Try again, small Review this game and Home, never the next lesson', () => {
  const c = F.afterGame({ goal: 'failed', next: NEXT });
  assert.equal(c.line, null, 'not passing never offers the next step');
  assert.deepEqual(c.main, { label: 'Try again', go: 'tryagain' });
  assert.deepEqual(labels(c.small), ['Review this game', 'Home']);
  assert.ok(!JSON.stringify(c).includes('Pins and skewers'));
});
test('Game row 5: review finished: "That’s the whole game.", the Continue card’s step, small New game and Home', () => {
  const c = F.afterReview({ title: 'Pins and skewers', button: 'Continue', lesson: true });
  assert.equal(c.title, 'That’s the whole game.');
  assert.equal(c.line, 'Next lesson: Pins and skewers');
  assert.deepEqual(c.main, { label: 'Start next lesson', go: 'step' });
  assert.deepEqual(labels(c.small), ['New game', 'Home']); assert.deepEqual(gos(c.small), ['newgame', 'home']);
});

/* ---------- After a lesson step or puzzle set ---------- */
test('Step row 1: practice passed, game task next: Play the lesson game, small Go again and Home', () => {
  const c = F.afterStep({ unit: true, from: 'session', passed: true, nextPart: 'game', next: NEXT });
  assert.equal(c.line, 'Next: play it in a real game.');
  assert.deepEqual(c.main, { label: 'Play the lesson game', go: 'part' });
  assert.deepEqual(labels(c.small), ['Go again', 'Home']); assert.deepEqual(gos(c.small), ['again', 'home']);
});
test('Step row 2: practice passed, drill or other task next: Continue', () => {
  for (const np of ['drill', 'other', 'learn', 'book']) {
    const c = F.afterStep({ unit: true, from: 'session', passed: true, nextPart: np, next: NEXT });
    assert.equal(c.line, 'Next: one more step.', np);
    assert.deepEqual(c.main, { label: 'Continue', go: 'part' }, np);
    assert.deepEqual(labels(c.small), ['Go again', 'Home'], np);
  }
});
test('Step row 3: Learn part finished, practice next: Start practice, small Home only', () => {
  const c = F.afterStep({ unit: true, from: 'learn', passed: true, nextPart: 'practice', next: NEXT });
  assert.equal(c.line, 'Next: practise it.');
  assert.deepEqual(c.main, { label: 'Start practice', go: 'part' });
  assert.deepEqual(labels(c.small), ['Home']);
});
test('Learn part finished, game or drill next: the same next-step words, small Home only', () => {
  let c = F.afterStep({ unit: true, from: 'learn', passed: true, nextPart: 'game', next: NEXT });
  assert.equal(c.line, 'Next: play it in a real game.'); assert.deepEqual(c.main, { label: 'Play the lesson game', go: 'part' }); assert.deepEqual(labels(c.small), ['Home']);
  c = F.afterStep({ unit: true, from: 'learn', passed: true, nextPart: 'drill', next: NEXT });
  assert.equal(c.line, 'Next: one more step.'); assert.deepEqual(c.main, { label: 'Continue', go: 'part' }); assert.deepEqual(labels(c.small), ['Home']);
});
test('Step row 4: last part passed, another lesson at the level: Next lesson line, Start next lesson, small Go again and Home', () => {
  for (const from of ['session', 'learn']) {
    const c = F.afterStep({ unit: true, from, passed: true, nextPart: null, next: NEXT });
    assert.equal(c.line, 'Next lesson: Pins and skewers');
    assert.deepEqual(c.main, { label: 'Start next lesson', go: 'nextlesson' });
    assert.deepEqual(labels(c.small), ['Go again', 'Home']);
  }
});
test('Step row 5: last part passed, no lesson left: main Home, small Go again', () => {
  const c = F.afterStep({ unit: true, from: 'session', passed: true, nextPart: null, next: null });
  assert.equal(c.line, null);
  assert.deepEqual(c.main, { label: 'Home', go: 'home' });
  assert.deepEqual(labels(c.small), ['Go again']);
});
test('Step row 5, Beginner with Foundations done: follows Beginner Home (Play now or Start 10 puzzles), small Go again and Home', () => {
  let c = F.afterStep({ unit: true, from: 'session', passed: true, nextPart: null, next: null, after: { button: 'Play now', go: 'game' } });
  assert.equal(c.line, null); assert.deepEqual(c.main, { label: 'Play now', go: 'after' }); assert.deepEqual(labels(c.small), ['Go again', 'Home']);
  c = F.afterStep({ unit: true, from: 'session', passed: true, nextPart: null, next: null, after: { button: 'Start 10 puzzles', go: 'puzzles' } });
  assert.deepEqual(c.main, { label: 'Start 10 puzzles', go: 'after' });
});
test('Step row 6: not passed: Go again, small Home, never a next step (whatever comes next)', () => {
  for (const np of ['game', 'drill', 'practice', null]) {
    const c = F.afterStep({ unit: true, from: 'session', passed: false, nextPart: np, next: NEXT, after: { button: 'Play now', go: 'game' } });
    assert.equal(c.line, null);
    assert.deepEqual(c.main, { label: 'Go again', go: 'again' });
    assert.deepEqual(labels(c.small), ['Home']);
    assert.ok(!/next|Play/i.test(JSON.stringify(c)), 'no next step when not passed');
  }
});
test('Step row 7: puzzle set from Train: 10 more puzzles, small Home', () => {
  const c = F.afterStep({ unit: false, set: 'puzzles', passed: true });
  assert.equal(c.line, null);
  assert.deepEqual(c.main, { label: '10 more puzzles', go: 'more' });
  assert.deepEqual(labels(c.small), ['Home']);
});
test('Step row 8: review of missed puzzles finished: main Home, no small buttons', () => {
  const c = F.afterStep({ unit: false, set: 'review', passed: true });
  assert.equal(c.line, null);
  assert.deepEqual(c.main, { label: 'Home', go: 'home' });
  assert.deepEqual(c.small, []);
});
test('Another Train set (Safe or blunder?, an opening drill): Go again stays the main button, small Home', () => {
  const c = F.afterStep({ unit: false, set: 'other', passed: true });
  assert.deepEqual(c.main, { label: 'Go again', go: 'again' }); assert.deepEqual(labels(c.small), ['Home']);
});
test('F-D11: every end card has a Home button, and exactly one main button', () => {
  const cards = [F.afterGame({ goal: null }), F.afterGame({ goal: 'done', next: NEXT }), F.afterGame({ goal: 'failed' }), F.afterReview({ title: 't', button: 'Continue' })];
  for (const unit of [true, false]) for (const passed of [true, false]) for (const np of ['game', 'drill', 'practice', null]) for (const next of [NEXT, null]) for (const set of ['puzzles', 'review', 'other'])
    cards.push(F.afterStep({ unit, from: 'session', passed, nextPart: np, next, set }));
  for (const c of cards) {
    assert.ok(c.main && c.main.label && c.main.go);
    assert.ok([c.main].concat(c.small).some((b) => b.label === 'Home' && b.go === 'home'), JSON.stringify(c));
  }
});

/* ---------- Continue card, Improver and Club Home ---------- */
test('Continue card: a lesson part: "Continue · Lesson N of M", the lesson title, a bar, Start lesson or Continue', () => {
  let c = F.cont({ kind: 'lesson', title: 'Pins and skewers', n: 3, m: 8, done: 2, started: false }, false);
  assert.equal(c.kicker, 'Continue · Lesson 3 of 8'); assert.equal(c.title, 'Pins and skewers'); assert.equal(c.button, 'Start lesson');
  assert.deepEqual(c.bar, { done: 2, m: 8, text: '2 of 8 lessons done' }); assert.equal(c.go, 'part'); assert.equal(c.zone, 'learn');
  c = F.cont({ kind: 'lesson', title: 'Pins and skewers', n: 3, m: 8, done: 2, started: true }, true);
  assert.equal(c.button, 'Continue');
});
test('Continue card: rated puzzles to reach the stage target', () => {
  const c = F.cont({ kind: 'puzzles', target: 1200 }, false);
  assert.equal(c.kicker, 'Continue'); assert.equal(c.title, 'Puzzles to reach 1200'); assert.equal(c.button, 'Start 10 puzzles'); assert.equal(c.bar, null); assert.equal(c.go, 'next');
});
test('Continue card: beat the stage opponent: Play now, or Resume game with an unfinished game', () => {
  let c = F.cont({ kind: 'beat', name: 'Improver' }, false);
  assert.equal(c.kicker, 'Continue'); assert.equal(c.title, 'Beat the Improver engine'); assert.equal(c.button, 'Play now'); assert.equal(c.go, 'next'); assert.equal(c.bar, null);
  c = F.cont({ kind: 'beat', name: 'Improver' }, true);
  assert.equal(c.button, 'Resume game'); assert.equal(c.go, 'back');
});
test('Continue card: roadmap finished: Keep sharp: rated puzzles, Start 10 puzzles', () => {
  const c = F.cont({ kind: 'sharp' }, false);
  assert.equal(c.kicker, 'Continue'); assert.equal(c.title, 'Keep sharp: rated puzzles'); assert.equal(c.button, 'Start 10 puzzles'); assert.equal(c.go, 'next'); assert.equal(c.bar, null);
});
test('D49: a main button that starts a lesson game asks first while a game is unfinished', () => {
  assert.equal(F.asks('apply', 'game', true), true);
  assert.equal(F.asks('apply', 'game', false), false, 'no game going');
  assert.equal(F.asks('apply', 'drill', true), false, 'a drill does not drop the game');
  assert.equal(F.asks('practice', 'game', true), false); assert.equal(F.asks('learn', 'game', true), false);
});
test('No em dash and no straight apostrophe in any copy', () => {
  const all = JSON.stringify([F.afterGame({ goal: 'done', next: NEXT }), F.afterGame({ goal: 'failed' }), F.afterReview({ title: 't', button: 'b' }), F.COPY]);
  assert.ok(!/—/.test(all)); assert.ok(!/'/.test(all));
});

/* ---------- Fix round 1: F-D18, F-D23, F-D29 ---------- */
test('F-D23: lesson game passed while another part of the same lesson is undone names that part, never "Next lesson: <same lesson>"', () => {
  let c = F.afterGame({ goal: 'done', nextPart: 'practice', next: { title: 'Opening principles' } });
  assert.equal(c.line, 'Next: practise it.'); assert.deepEqual(c.main, { label: 'Start practice', go: 'part' }); assert.deepEqual(labels(c.small), ['Review this game', 'Home']);
  c = F.afterGame({ goal: 'done', nextPart: 'other', next: NEXT });
  assert.equal(c.line, 'Next: one more step.'); assert.deepEqual(c.main, { label: 'Continue', go: 'part' });
  c = F.afterGame({ goal: 'done', nextPart: 'game', next: NEXT });
  assert.equal(c.line, 'Next: play it in a real game.'); assert.deepEqual(c.main, { label: 'Play the lesson game', go: 'part' });
  assert.ok(!JSON.stringify(F.afterGame({ goal: 'done', nextPart: 'practice', next: NEXT })).includes('Next lesson'));
  assert.deepEqual(F.afterGame({ goal: 'failed', nextPart: 'practice', next: NEXT }).main, { label: 'Try again', go: 'tryagain' }, 'not passed: still Try again');
});
test('F-D18: a lesson game’s goal decided before the game ends: next-step buttons and Keep playing', () => {
  let c = F.goalCard({ goal: 'done', nextPart: null, next: NEXT });
  assert.equal(c.line, 'Next lesson: Pins and skewers'); assert.deepEqual(c.main, { label: 'Start next lesson', go: 'nextlesson' }); assert.deepEqual(c.small, [{ label: 'Keep playing', go: 'keep' }]);
  c = F.goalCard({ goal: 'done', nextPart: 'practice', next: NEXT });
  assert.equal(c.line, 'Next: practise it.'); assert.deepEqual(c.main, { label: 'Start practice', go: 'part' }); assert.deepEqual(labels(c.small), ['Keep playing']);
  c = F.goalCard({ goal: 'failed', nextPart: null, next: NEXT });
  assert.equal(c.line, null); assert.deepEqual(c.main, { label: 'Try again', go: 'tryagain' }); assert.deepEqual(labels(c.small), ['Keep playing']);
  c = F.goalCard({ goal: 'done', nextPart: null, next: null });
  assert.equal(c.line, null); assert.equal(c.main, null, 'no lesson left: nothing to start'); assert.deepEqual(labels(c.small), ['Keep playing']);
  assert.equal(F.goalCard({ goal: 'active' }), null, 'no buttons while the goal is open');
  for (const g of ['done', 'failed']) assert.ok(!/Back to the course/.test(JSON.stringify(F.goalCard({ goal: g, next: NEXT }))));
});
test('F-D29: the review-finished card labels the step: "Next lesson: <title>" for a lesson, else the Continue card’s title', () => {
  assert.equal(F.afterReview({ title: 'Pins and skewers', button: 'Start lesson', lesson: true }).line, 'Next lesson: Pins and skewers');
  assert.equal(F.afterReview({ title: 'Puzzles to reach 1200', button: 'Start 10 puzzles', lesson: false }).line, 'Puzzles to reach 1200');
  assert.equal(F.afterReview({ title: 'Beat Rani’s practice partner', button: 'Play now' }).line, 'Beat Rani’s practice partner');
});

test('F-D33: the review card’s button reads "Start next lesson" when its line is "Next lesson: <title>"', () => {
  for (const button of ['Start lesson', 'Continue']) assert.deepEqual(F.afterReview({ title: 'Forks', button, lesson: true }).main, { label: 'Start next lesson', go: 'step' });
  assert.deepEqual(F.afterReview({ title: 'Puzzles to reach 1200', button: 'Start 10 puzzles', lesson: false }).main, { label: 'Start 10 puzzles', go: 'step' });
});

/* ---------- G2a: the board screen on phones (docs/specs/board-screens.product.md, G-D1 to G-D12, G-D21 to G-D26) ---------- */
test('G2a: the board screen is open only on phones, and only when the screen state says so (G-D2, G-D10)', () => {
  assert.equal(F.actOpen({ wide: false, scr: 'act' }), true);
  assert.equal(F.actOpen({ wide: false, scr: 'tabs' }), false);
  assert.equal(F.actOpen({ wide: true, scr: 'act' }), false, 'wide screens never have a board screen');
  assert.equal(F.actOpen({ wide: true, scr: 'tabs' }), false);
  assert.equal(F.actOpen({}), false);
  assert.equal(F.actOpen(), false);
});

test('G2a: the tabs are hidden while the board screen is open, and back whenever an end card is up (G-D3, G-D8)', () => {
  assert.equal(F.tabsHidden({ wide: false, scr: 'act', end: false }), true);
  assert.equal(F.tabsHidden({ wide: false, scr: 'act', end: true }), false);
  assert.equal(F.tabsHidden({ wide: false, scr: 'tabs', end: false }), false);
  assert.equal(F.tabsHidden({ wide: false, scr: 'tabs', end: true }), false);
  for (const scr of ['act', 'tabs']) for (const end of [true, false]) assert.equal(F.tabsHidden({ wide: true, scr, end }), false, 'wide: never hidden');
});

test('G2a: the board screen stays open only on its activity’s own tab, or under a Learn end card (no dead end)', () => {
  assert.equal(F.keepsScreen({ tab: 'play', zoneTab: 'play', learnEnd: false }), true);
  assert.equal(F.keepsScreen({ tab: 'train', zoneTab: 'train', learnEnd: false }), true);
  assert.equal(F.keepsScreen({ tab: 'path', zoneTab: 'path', learnEnd: false }), true);
  assert.equal(F.keepsScreen({ tab: 'path', zoneTab: 'play', learnEnd: true }), true, 'the Learn end card: the board is back on the game');
  assert.equal(F.keepsScreen({ tab: 'path', zoneTab: 'play', learnEnd: false }), false);
  assert.equal(F.keepsScreen({ tab: 'coach', zoneTab: 'play', learnEnd: false }), false);
  assert.equal(F.keepsScreen({ tab: 'progress', zoneTab: 'play', learnEnd: true }), false);
});

test('Criterion 7: one function says whether the board is in use. Phones: only while the board screen is open with no end card', () => {
  // phones: a saved, closed game or a closed lesson does not count (G-D11)
  assert.equal(F.inUse({ wide: false, open: false, end: false, busy: true, check: false }), false);
  assert.equal(F.inUse({ wide: false, open: true, end: false, busy: true, check: false }), true);
  assert.equal(F.inUse({ wide: false, open: true, end: false, busy: false, check: false }), true, 'a fresh board with no move still counts (A-D19)');
  assert.equal(F.inUse({ wide: false, open: true, end: true, busy: true, check: false }), false, 'an end card: the activity is over');
  // wide: today's rule, unchanged (F-D4, F-D17)
  assert.equal(F.inUse({ wide: true, open: false, end: false, busy: true, check: false }), true);
  assert.equal(F.inUse({ wide: true, open: true, end: true, busy: true, check: false }), true);
  assert.equal(F.inUse({ wide: true, open: true, end: false, busy: false, check: false }), false);
  // the level check counts everywhere
  for (const wide of [true, false]) assert.equal(F.inUse({ wide, open: false, end: false, busy: false, check: true }), true);
  // a missing fact fails closed
  assert.equal(F.inUse(), true);
  assert.equal(F.inUse({ wide: false }), true);
  assert.equal(F.inUse({ wide: false, open: false, end: false, check: false }), false);
});

test('Criterion 7: one function decides the tip slot (and so the banner): never while the board screen is open', () => {
  const places = ['home', 'progress', 'game', 'learn', 'step'];
  // the first-day rule holds everywhere (F-D5)
  for (const place of places) for (const wide of [true, false]) assert.equal(F.slotOk({ place, day: false, inUse: false, wide, gameOn: false }), false, place);
  // Home and Progress: never while the board is in use
  for (const place of ['home', 'progress']) for (const wide of [true, false]) {
    assert.equal(F.slotOk({ place, day: true, inUse: true, wide, gameOn: false }), false);
    assert.equal(F.slotOk({ place, day: true, inUse: false, wide, gameOn: false }), true);
  }
  // phones (G-D11): a saved, closed game no longer hides the slot on Home, Progress or end cards
  assert.equal(F.slotOk({ place: 'home', day: true, inUse: false, wide: false, gameOn: true }), true);
  assert.equal(F.slotOk({ place: 'progress', day: true, inUse: false, wide: false, gameOn: true }), true);
  for (const place of ['game', 'learn', 'step']) assert.equal(F.slotOk({ place, day: true, inUse: false, wide: false, gameOn: true, live: false }), true, place);
  // an end card's slot never shows under a board screen that is still in use (no end card up)
  for (const place of ['game', 'learn', 'step']) assert.equal(F.slotOk({ place, day: true, inUse: true, wide: false, gameOn: false, live: false }), false, place);
  // wide keeps F-D32: an end card has no slot while a game is unfinished
  for (const place of ['game', 'learn', 'step']) {
    assert.equal(F.slotOk({ place, day: true, inUse: true, wide: true, gameOn: true }), false, place);
    assert.equal(F.slotOk({ place, day: true, inUse: false, wide: true, gameOn: false }), true, place);
    assert.equal(F.slotOk({ place, day: true, inUse: true, wide: true, gameOn: false }), true, place + ': wide end cards ask only about the game, as before');
  }
  // unknown facts fail closed
  assert.equal(F.slotOk(), false);
  assert.equal(F.slotOk({ place: 'home', day: true }), false);
  assert.equal(F.slotOk({ place: 'nowhere', day: true, inUse: false, wide: false, gameOn: false }), false);
});

test('G-D22: the Resume game card’s line, with the real move number and whose turn it is', () => {
  assert.equal(F.resumeLine(12, true), 'Move 12, your turn');
  assert.equal(F.resumeLine(12, false), 'Move 12, engine to move');
  assert.equal(F.resumeLine(1, false), 'Move 1, engine to move');
  assert.equal(F.resumeLine(2, true), 'Move 2, your turn');
  assert.equal(F.resumeLine(0, true), 'Move 1, your turn', 'never a move 0');
  for (const t of [F.resumeLine(7, true), F.resumeLine(7, false)]) assert.ok(!/—/.test(t));
});

test('G-D5, G-D26: the Resume card’s title for each kind of activity', () => {
  assert.equal(F.resumeTitle('game'), 'Resume game');
  assert.equal(F.resumeTitle('lesson'), 'Resume lesson');
  for (const k of ['puzzles', 'safety']) assert.equal(F.resumeTitle(k), 'Resume puzzles', k);
  for (const k of ['drill', 'book', 'squares', 'reach']) assert.equal(F.resumeTitle(k), 'Resume drill', k);
  assert.equal(F.COPY.recent, 'Recent games');
  assert.equal(F.COPY.close, 'Close');
});

test('G-D25: on a phone the app always opens on Home; wide screens open as before', () => {
  const has = (t) => ['coach', 'path', 'train', 'play', 'progress'].includes(t);
  for (const t of ['coach', 'path', 'train', 'play', 'progress', null, 'bogus']) assert.equal(F.startTab(t, false, has), 'coach', String(t));
  assert.equal(F.startTab('play', true, has), 'play');
  assert.equal(F.startTab('train', true, has), 'train');
  assert.equal(F.startTab('progress', true, has), 'progress');
  assert.equal(F.startTab('path', true, has), 'coach', 'Learn was never restored');
  assert.equal(F.startTab(null, true, has), 'coach');
  assert.equal(F.startTab('bogus', true, has), 'coach');
});

test('G-D4, G-D23: where Close lands', () => {
  assert.equal(F.closeTab({ mode: 'play', zoneTab: 'play' }), 'play');
  assert.equal(F.closeTab({ mode: 'lesson', zoneTab: 'path' }), 'path');
  assert.equal(F.closeTab({ mode: 'puzzle', zoneTab: 'train' }), 'train');
  assert.equal(F.closeTab({ mode: 'puzzle', zoneTab: 'path' }), 'path', 'a lesson’s practice set belongs to Learn');
  assert.equal(F.closeTab({ mode: 'play', zoneTab: 'play', learnEnd: true }), 'path', 'the Learn end card');
  assert.equal(F.closeTab({ mode: 'review', zoneTab: 'play', past: true, from: 'progress' }), 'progress', 'a past game opened on Progress');
  assert.equal(F.closeTab({ mode: 'review', zoneTab: 'play', past: true, from: 'play' }), 'play', 'a past game opened from Recent games on Play');
  assert.equal(F.closeTab({ mode: 'review', zoneTab: 'play', past: false, from: 'play' }), 'play', 'a review opened from a game’s end card');
  assert.equal(F.closeTab({ mode: 'review', zoneTab: 'play', past: false, from: 'progress' }), 'play');
});

/* ---------- G2a fix round 1 ---------- */
test('Fix 1: on a phone an end card has no slot (so no banner) while the board on screen is a game in progress', () => {
  // the Learn end card: the board under it is back on the player's game
  assert.equal(F.slotOk({ place: 'learn', day: true, inUse: false, wide: false, gameOn: true, live: true }), false, 'an unfinished game is on the board');
  assert.equal(F.slotOk({ place: 'learn', day: true, inUse: false, wide: false, gameOn: false, live: false }), true, 'no moves, or the game is over');
  // a set's end card: the board shows the last puzzle, the saved game is closed (G-D11)
  assert.equal(F.slotOk({ place: 'step', day: true, inUse: false, wide: false, gameOn: true, live: false }), true);
  for (const place of ['game', 'learn', 'step']) assert.equal(F.slotOk({ place, day: true, inUse: false, wide: false, gameOn: true, live: true }), false, place);
  // the fact must be known: a missing one means no slot
  for (const place of ['game', 'learn', 'step']) assert.equal(F.slotOk({ place, day: true, inUse: false, wide: false, gameOn: false }), false, place + ': unknown fails closed');
  // Home and Progress have no board on a phone, and wide screens keep their own rule: the fact is not asked there
  assert.equal(F.slotOk({ place: 'home', day: true, inUse: false, wide: false, gameOn: true }), true);
  assert.equal(F.slotOk({ place: 'learn', day: true, inUse: false, wide: true, gameOn: false }), true);
  assert.equal(F.slotOk({ place: 'learn', day: true, inUse: false, wide: true, gameOn: true, live: true }), false, 'wide: F-D32, as before');
});

test('Fix 5: the old "Back to my game" reads "Resume game" on the Continue card', () => {
  assert.equal(F.COPY.back, 'Resume game');
  assert.equal(F.cont({ kind: 'beat', name: 'Club' }, true).button, 'Resume game');
  assert.equal(F.cont({ kind: 'beat', name: 'Club' }, false).button, 'Play now');
});

test('Fix 6: on a phone a drill belongs to the tab it was started from', () => {
  assert.equal(F.drillZone('train', false), 'train');
  assert.equal(F.drillZone('learn', false), null, 'from Learn (or Home, or an end card): the lesson’s own zone');
  assert.equal(F.drillZone(undefined, false), null);
  assert.equal(F.drillZone('train', true), null, 'wide screens: as before');
});

test('Fix 7: the Continue card resumes a lesson that is waiting at its step', () => {
  const w = { unit: 'fork', part: 'learn' };
  assert.equal(F.resumesLesson({ go: 'part', unit: 'fork', part: 'learn' }, w), true);
  assert.equal(F.resumesLesson({ go: 'ask', unit: 'fork', part: 'learn' }, w), false);
  assert.equal(F.resumesLesson({ go: 'part', unit: 'pin', part: 'learn' }, w), false, 'another lesson');
  assert.equal(F.resumesLesson({ go: 'part', unit: 'fork', part: 'practice' }, w), false, 'another part of it');
  assert.equal(F.resumesLesson({ go: 'part', unit: 'fork', part: 'learn' }, null), false, 'nothing is waiting');
});

test('Fix 2: the room an end card keeps free for the banner: its reported height, else 64, plus the gap above fixed tabs', () => {
  assert.equal(F.bannerRoom({ expected: true, h: 0, fixedTabs: true }), 72);
  assert.equal(F.bannerRoom({ expected: true, h: 58, fixedTabs: true }), 66);
  assert.equal(F.bannerRoom({ expected: true, h: 58.2, fixedTabs: false }), 59);
  assert.equal(F.bannerRoom({ expected: false, h: 58, fixedTabs: true }), 0, 'no banner is coming: nothing is kept free');
  assert.equal(F.bannerRoom(), 0);
});
