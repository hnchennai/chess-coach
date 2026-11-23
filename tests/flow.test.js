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
  assert.equal(F.drillZone('train', true), 'train', 'G-D35: wide screens too (what waits on Train survives there now)');
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

/* ---------- G2d (G-D33): the pieces and the view a player starts with ---------- */
test('G-D33: a player who never chose pieces or a view starts with the classic pieces on the flat board', () => {
  const has = (id) => ['classic', 'heroes', 'ramayana'].indexOf(id) > -1;
  assert.deepEqual(F.firstLook({ pieces: null, theme: null, v3d: null }, has), { theme: 'classic', v3d: false }, 'a fresh install');
  assert.deepEqual(F.firstLook({}, has), { theme: 'classic', v3d: false }, 'nothing saved at all');
  assert.deepEqual(F.firstLook(null, has), { theme: 'classic', v3d: false });
  assert.deepEqual(F.firstLook({ pieces: 'gone', theme: 'also-gone', v3d: 'true' }, has), { theme: 'classic', v3d: false }, 'a set that no longer exists, a view that is not a plain yes');
});
test('G-D33: a saved choice is kept: the set picked on this device, else the one in the profile; 3D only on a saved yes', () => {
  const has = (id) => ['classic', 'heroes', 'ramayana'].indexOf(id) > -1;
  assert.deepEqual(F.firstLook({ pieces: 'ramayana', theme: null, v3d: true }, has), { theme: 'ramayana', v3d: true });
  assert.deepEqual(F.firstLook({ pieces: 'heroes', theme: 'ramayana', v3d: false }, has), { theme: 'heroes', v3d: false }, 'this device’s choice first');
  assert.deepEqual(F.firstLook({ pieces: null, theme: 'ramayana', v3d: null }, has), { theme: 'ramayana', v3d: false }, 'a restored profile carries the choice');
  assert.deepEqual(F.firstLook({ pieces: 'classic', theme: 'ramayana', v3d: null }, has), { theme: 'classic', v3d: false }, 'classic, chosen, stays classic');
  assert.deepEqual(F.firstLook({ pieces: 'gone', theme: 'heroes', v3d: true }, has), { theme: 'heroes', v3d: true });
});

/* ---------- G2b: one thing waits per tab, saved on the device (G-D19, G-D20) ---------- */
// The facts the app hands over: a small course, a small puzzle bank, two opening lines.
const UNITS_F = {
  board: { title: 'The board', steps: 4, practice: 'squares', apply: null },
  values: { title: 'What pieces are worth', steps: 5, practice: 'puzzles', apply: null },
  blunder: { title: 'The blunder check', steps: 5, practice: 'safety', apply: null },
  kq: { title: 'King and queen mate', steps: 5, practice: null, apply: 'drill' },
  rep: { title: 'Your repertoire', steps: 3, practice: null, apply: 'book' },
  moves: { title: 'How pieces move', steps: 6, practice: 'reach', apply: null }
};
const facts = (o) => Object.assign({
  unit: (id) => UNITS_F[id] || null, puzzle: (id) => /^m\d+$/.test(id), quiz: (id) => /^m[0-4]$/.test(id), book: (id) => id === 'italian' || id === 'london',
  fen: (s) => typeof s === 'string' && /^\S+ [wb] /.test(s), trainOpen: true
}, o);
const LESSON = { k: 'lesson', unit: 'kq', i: 1 };
const setE = (o) => Object.assign({ k: 'set', kind: 'puzzles', title: 'Rated puzzles', unit: null, part: null, count: 10, pass: null, rated: true, theme: null, review: false, i: 2, right: 1, wrong: 1, counted: false, items: ['m1', 'm2', 'm3'] }, o);
const DRILL = setE({ kind: 'drill', title: 'King and queen mate', unit: 'kq', part: 'apply', count: 1, rated: false, i: 0, right: 0, wrong: 0, items: [], drill: { fen: '8/8/8/4k3/8/8/8/KQ6 b - - 1 1', moves: 1 } });

test('G-D20: what happens to the lesson or set on the board when something else opens', () => {
  // phones: another tab's activity, or the game, parks it; its Resume card stays
  assert.equal(F.onOpen({ wide: false, live: 'learn', over: false, to: 'play' }), 'park', 'opening the game over a lesson');
  assert.equal(F.onOpen({ wide: false, live: 'train', over: false, to: 'play' }), 'park', 'opening the game over a set');
  assert.equal(F.onOpen({ wide: false, live: 'learn', over: false, to: 'train' }), 'park');
  assert.equal(F.onOpen({ wide: false, live: 'train', over: false, to: 'learn' }), 'park');
  // a new activity on the same tab replaces it, with no question
  assert.equal(F.onOpen({ wide: false, live: 'learn', over: false, to: 'learn' }), 'end');
  assert.equal(F.onOpen({ wide: false, live: 'train', over: false, to: 'train' }), 'end');
  // what is finished is over, never parked
  assert.equal(F.onOpen({ wide: false, live: 'train', over: true, to: 'play' }), 'end');
  // nothing on the board
  assert.equal(F.onOpen({ wide: false, live: null, over: false, to: 'play' }), 'none');
  assert.equal(F.onOpen(null), 'none');
  // G-D35 (fix round 1): wide screens follow the same rule; D50 is gone at every width
  for (const live of ['learn', 'train']) {
    assert.equal(F.onOpen({ wide: true, live, over: false, to: 'play' }), 'park', 'wide: the game opens over ' + live);
    assert.equal(F.onOpen({ wide: true, live, over: false, to: live }), 'end', 'wide: the newest on its own tab wins');
    assert.equal(F.onOpen({ wide: true, live, over: true, to: 'play' }), 'end', 'wide: what is finished is over');
  }
  assert.equal(F.onOpen({ wide: true, live: 'learn', over: false, to: 'train' }), 'park');
  assert.equal(F.onOpen({ wide: true, live: 'train', over: false, to: 'learn' }), 'park');
});

test('G-D19: what is saved for a lesson, a set and a drill (and nothing for what is over)', () => {
  assert.deepEqual(F.entryOf({ lesson: { unit: 'kq', i: 1 } }), LESSON);
  assert.equal(F.entryOf({}), null); assert.equal(F.entryOf(null), null);
  assert.equal(F.entryOf({ over: true, set: setE() }), null, 'a finished set is not saved');
  const e = F.entryOf({ set: { kind: 'puzzles', title: 'Rated puzzles', count: 10, rated: true, i: 2, right: 1, wrong: 1, counted: true, ok: false, items: ['m1', 'm2', 'm3'], extra: 'x' } });
  assert.deepEqual(e, setE({ counted: true, ok: false }));
  // round 2, item 4: the counted item's own outcome is kept (only while it is counted)
  assert.equal(F.entryOf({ set: setE({ counted: true, ok: true }) }).ok, true);
  assert.equal('ok' in F.entryOf({ set: setE({ counted: false, ok: true }) }), false, 'nothing to keep before it is answered');
  assert.equal('extra' in e, false, 'only the known fields');
  assert.deepEqual(F.entryOf({ set: DRILL }), DRILL);
  assert.equal('drill' in F.entryOf({ set: setE() }), false);
  // it is plain data: it survives the trip through storage unchanged
  assert.deepEqual(JSON.parse(JSON.stringify(F.entryOf({ set: DRILL }))), DRILL);
});

test('G-D19: the saved key holds one entry per tab, and nothing at all when nothing waits', () => {
  assert.equal(F.RESUME_KEY, 'suresh-chess-coach.resume.v1');
  assert.equal(F.writeResume({ learn: null, train: null }), null);
  assert.equal(F.writeResume(null), null);
  assert.deepEqual(F.writeResume({ learn: LESSON, train: null }), { v: 1, learn: LESSON, train: null });
  assert.deepEqual(F.writeResume({ learn: LESSON, train: setE() }), { v: 1, learn: LESSON, train: setE() });
  const back = F.readResume(JSON.parse(JSON.stringify(F.writeResume({ learn: LESSON, train: DRILL }))), facts());
  assert.deepEqual(back, { learn: LESSON, train: DRILL });
});

test('G-D19: a good saved entry is accepted, for every kind', () => {
  const f = facts();
  assert.equal(F.entryOk('learn', LESSON, f), true);
  assert.equal(F.entryOk('train', setE(), f), true, 'rated puzzles');
  assert.equal(F.entryOk('train', setE({ rated: false, theme: 'fork', title: 'Theme: Forks', count: 3 }), f), true, 'a themed set');
  assert.equal(F.entryOk('train', setE({ rated: false, review: true, count: 3 }), f), true, 'missed puzzles');
  assert.equal(F.entryOk('learn', setE({ rated: false, unit: 'values', part: 'practice', pass: 2, count: 3 }), f), true, 'a lesson’s practice puzzles');
  assert.equal(F.entryOk('train', setE({ kind: 'safety', rated: false, count: 3, items: [['m1', 1], ['m2', 0], ['m3', 1]] }), f), true, 'Safe or blunder');
  assert.equal(F.entryOk('learn', setE({ kind: 'safety', rated: false, unit: 'blunder', part: 'practice', pass: 2, count: 3, items: [['m1', 1], ['m2', 0], ['m3', 1]] }), f), true);
  assert.equal(F.entryOk('learn', setE({ kind: 'squares', rated: false, unit: 'board', part: 'practice', count: 12, pass: 10, items: [] }), f), true);
  assert.equal(F.entryOk('learn', setE({ kind: 'reach', rated: false, unit: 'moves', part: 'practice', count: 6, pass: 5, items: [] }), f), true);
  assert.equal(F.entryOk('train', setE({ kind: 'book', rated: false, title: 'Opening drill', count: 1, i: 0, right: 0, wrong: 0, items: ['italian'] }), f), true);
  assert.equal(F.entryOk('learn', setE({ kind: 'book', rated: false, unit: 'rep', part: 'apply', count: 2, pass: 2, i: 1, wrong: 0, items: ['italian', 'london'] }), f), true);
  assert.equal(F.entryOk('learn', DRILL, f), true, 'a drill as the lesson’s task');
  assert.equal(F.entryOk('train', DRILL, f), true, 'the same drill from Train’s list');
  // fix round 1: the counts add up: the items played, plus the current one once it is counted
  assert.equal(F.entryOk('train', setE({ right: 2, wrong: 1, counted: true, ok: true }), f), true, 'the current puzzle is already counted');
  assert.equal(F.entryOk('train', setE({ i: 0, right: 0, wrong: 0 }), f), true, 'the first puzzle, nothing counted');
  assert.equal(F.entryOk('train', setE({ i: 0, right: 1, wrong: 0, counted: true, ok: true }), f), true);
  assert.equal(F.entryOk('train', setE({ kind: 'book', rated: false, title: 'Opening drill', count: 1, i: 0, right: 0, wrong: 1, counted: true, ok: false, items: ['italian'] }), f), true, 'the last line, scored');
  assert.equal(F.entryOk('train', setE({ kind: 'safety', rated: false, count: 3, i: 1, right: 1, wrong: 1, counted: true, ok: false, items: [['m1', 1], ['m2', 0], ['m3', 1]] }), f), true, 'an answered question');
});

test('G-D19 fails safe: a corrupt, stale or unknown entry is dropped (no error, no card)', () => {
  const f = facts(), bad = (zone, e, why) => assert.equal(F.entryOk(zone, e, f), false, why);
  // not an entry at all
  for (const x of [null, undefined, 0, 'lesson', [], {}, { k: 'game' }, { k: 'review' }, { k: 'placement' }]) bad('learn', x, JSON.stringify(x));
  bad('play', LESSON, 'no such slot'); bad('train', LESSON, 'a lesson waits on Learn only');
  // the course changed
  bad('learn', { k: 'lesson', unit: 'gone', i: 0 }, 'the unit is gone');
  bad('learn', { k: 'lesson', unit: 'kq', i: 5 }, 'the lesson has fewer steps now');
  bad('learn', { k: 'lesson', unit: 'kq', i: -1 }); bad('learn', { k: 'lesson', unit: 'kq', i: 1.5 }); bad('learn', { k: 'lesson', unit: 'kq', i: '1' }); bad('learn', { k: 'lesson', unit: 7, i: 1 });
  bad('learn', setE({ rated: false, unit: 'kq', part: 'practice', count: 3 }), 'the lesson has no practice part any more');
  bad('learn', setE({ rated: false, unit: 'board', part: 'practice', count: 3 }), 'its practice is another kind now');
  bad('learn', setE({ kind: 'drill', unit: 'values', part: 'apply', count: 1, i: 0, right: 0, wrong: 0, rated: false, items: [], drill: DRILL.drill }), 'its task is not a drill');
  // the puzzle bank changed
  bad('train', setE({ items: ['m1', 'zz9', 'm3'] }), 'a puzzle id is gone');
  bad('train', setE({ kind: 'safety', rated: false, count: 3, items: [['m1', 1], ['m9', 0], ['m3', 1]] }), 'not a Safe or blunder puzzle any more');
  bad('train', setE({ kind: 'book', rated: false, count: 1, i: 0, right: 0, wrong: 0, items: ['gone'] }), 'the opening line is gone');
  // broken numbers and shapes
  bad('train', setE({ i: 10 }), 'past the end'); bad('train', setE({ i: -1 })); bad('train', setE({ count: 0 })); bad('train', setE({ count: 1000 }));
  bad('train', setE({ right: 9 }), 'more results than puzzles played'); bad('train', setE({ wrong: -1 })); bad('train', setE({ right: 'a' }));
  bad('train', setE({ items: ['m1'] }), 'the current puzzle is missing'); bad('train', setE({ items: 'm1,m2,m3' })); bad('train', setE({ items: [1, 2, 3] }));
  bad('train', setE({ rated: false }), 'a fixed set must carry all its puzzles');
  bad('train', setE({ title: '' })); bad('train', setE({ title: 5 })); bad('train', setE({ kind: 'quizshow' })); bad('train', setE({ counted: 'yes' })); bad('train', setE({ pass: 99 }));
  bad('train', setE({ kind: 'safety', rated: false, count: 3, items: [['m1', 2], ['m2', 0], ['m3', 1]] }));
  bad('train', setE({ kind: 'squares', rated: false, items: [] }), 'the board drill is a lesson’s practice, never Train’s');
  bad('learn', setE(), 'Learn only holds a lesson’s own parts');
  bad('train', setE({ rated: false, unit: 'values', part: 'practice', pass: 2, count: 3 }), 'a lesson’s practice waits on Learn');
  bad('learn', Object.assign({}, DRILL, { drill: null }), 'a drill needs its position');
  bad('learn', Object.assign({}, DRILL, { drill: { fen: 'nonsense', moves: 1 } }));
  bad('learn', Object.assign({}, DRILL, { drill: { fen: DRILL.drill.fen, moves: -3 } }));
  // fix round 1: the score must be exactly the items played so far, plus the current one when it is already counted
  bad('train', setE({ right: 2, wrong: 1 }), 'three results for two items played');
  bad('train', setE({ right: 0, wrong: 1 }), 'a result is missing');
  bad('train', setE({ right: 1, wrong: 1, counted: true, ok: true }), 'counted, but its result is not in the score');
  bad('train', setE({ right: 2, wrong: 1, counted: true }), 'round 2: counted, but its own outcome is missing');
  bad('train', setE({ right: 2, wrong: 1, counted: true, ok: 'yes' }), 'an outcome that is not solved or missed');
  bad('train', setE({ right: 2, wrong: 0, counted: false, i: 1 }), 'the current item is not counted, but its result is');
  bad('train', setE({ kind: 'book', rated: false, title: 'Opening drill', count: 1, i: 0, right: 1, wrong: 1, counted: true, ok: true, items: ['italian'] }), 'more results than the set has items');
  bad('learn', Object.assign({}, DRILL, { right: 1 }), 'a drill still going has no result yet');
  // a function that throws inside the facts must not escape either
  assert.equal(F.entryOk('learn', LESSON, facts({ unit: () => { throw new Error('boom'); } })), false);
  assert.equal(F.entryOk('learn', LESSON, null), false);
});

test('G-D19: Train’s entry is dropped while the player cannot open Train (another level’s content)', () => {
  assert.equal(F.entryOk('train', setE(), facts({ trainOpen: false })), false);
  assert.equal(F.entryOk('train', DRILL, facts({ trainOpen: false })), false);
  assert.equal(F.entryOk('learn', LESSON, facts({ trainOpen: false })), true, 'Learn is always open');
  assert.equal(F.entryOk('train', setE(), facts({ trainOpen: undefined })), false, 'unknown fails closed');
});

test('G-D19: reading the saved key: wrong version, junk, or one bad entry never breaks the other', () => {
  const f = facts(), none = { learn: null, train: null };
  for (const raw of [null, undefined, 'x', 7, [], {}, { v: 2, learn: LESSON }, { v: '1', learn: LESSON }, { learn: LESSON }]) assert.deepEqual(F.readResume(raw, f), none, JSON.stringify(raw));
  assert.deepEqual(F.readResume({ v: 1, learn: LESSON, train: setE() }, f), { learn: LESSON, train: setE() });
  assert.deepEqual(F.readResume({ v: 1, learn: { k: 'lesson', unit: 'gone', i: 0 }, train: setE() }, f), { learn: null, train: setE() }, 'the stale lesson is dropped, the set is kept');
  assert.deepEqual(F.readResume({ v: 1, learn: LESSON, train: setE({ items: ['zz'] }) }, f), { learn: LESSON, train: null });
  assert.deepEqual(F.readResume({ v: 1, learn: LESSON, train: setE() }, facts({ trainOpen: false })), { learn: LESSON, train: null });
  // unknown fields never come back into memory
  const got = F.readResume({ v: 1, learn: Object.assign({ evil: '<b>' }, LESSON), train: null, more: 1 }, f);
  assert.deepEqual(got, { learn: LESSON, train: null });
  assert.doesNotThrow(() => F.readResume({ v: 1, learn: LESSON }, null));
  assert.deepEqual(F.readResume({ v: 1, learn: LESSON }, null), none);
});

test('G-D30: the Resume card reads the same from a saved entry as from the live one', () => {
  const f = facts();
  assert.equal(F.lessonLine(1, 5), 'Lesson · step 2 of 5');
  assert.equal(F.setLine({ kind: 'puzzles', i: 2, count: 10 }), 'Puzzle 3 of 10');
  assert.equal(F.setLine({ kind: 'puzzles', i: 9, count: 10, finished: true }), 'Puzzle 10 of 10');
  assert.equal(F.setLine({ kind: 'safety', i: 0, count: 10 }), '1 of 10');
  assert.equal(F.setLine({ kind: 'drill', i: 0, count: 1 }), 'Endgame drill');
  assert.deepEqual(F.resumeCard(LESSON, f), { kind: 'lesson', kick: 'King and queen mate', line: 'Lesson · step 2 of 5' });
  assert.deepEqual(F.resumeCard(setE(), f), { kind: 'puzzles', kick: 'Rated puzzles', line: 'Puzzle 3 of 10' });
  assert.deepEqual(F.resumeCard(DRILL, f), { kind: 'drill', kick: 'King and queen mate', line: 'Endgame drill' });
  assert.equal(F.resumeTitle(F.resumeCard(LESSON, f).kind), 'Resume lesson');
  assert.equal(F.resumeTitle(F.resumeCard(setE(), f).kind), 'Resume puzzles');
  assert.equal(F.resumeTitle(F.resumeCard(DRILL, f).kind), 'Resume drill');
  assert.equal(F.resumeCard(null, f), null);
  assert.equal(F.resumeCard({ k: 'lesson', unit: 'gone', i: 0 }, f), null, 'no card for a lesson that is gone');
  // Home's Continue card and Today's Learn step: the waiting lesson, live or saved (fix round 1: or its practice or task)
  assert.deepEqual(F.waitingPart(LESSON), { unit: 'kq', part: 'learn', kind: 'lesson' });
  assert.equal(F.waitingPart(setE()), null); assert.equal(F.waitingPart(null), null);
  assert.equal(F.resumesLesson({ go: 'part', unit: 'kq', part: 'learn' }, F.waitingPart(LESSON)), true);
});

test('G-D37: Home’s Continue card and Today’s Learn step resume the lesson, its practice set or its drill that waits', () => {
  const prac = setE({ rated: false, unit: 'values', part: 'practice', pass: 2, count: 3 });
  const sq = setE({ kind: 'squares', rated: false, unit: 'board', part: 'practice', count: 12, pass: 10, items: [] });
  const book = setE({ kind: 'book', rated: false, unit: 'rep', part: 'apply', count: 2, pass: 2, i: 1, wrong: 0, items: ['italian', 'london'] });
  assert.deepEqual(F.waitingPart(prac), { unit: 'values', part: 'practice', kind: 'puzzles' });
  assert.deepEqual(F.waitingPart(sq), { unit: 'board', part: 'practice', kind: 'squares' });
  assert.deepEqual(F.waitingPart(DRILL), { unit: 'kq', part: 'apply', kind: 'drill' });
  assert.deepEqual(F.waitingPart(book), { unit: 'rep', part: 'apply', kind: 'book' });
  // the button's words are the Resume card's own
  assert.equal(F.resumeTitle(F.waitingPart(prac).kind), 'Resume puzzles');
  assert.equal(F.resumeTitle(F.waitingPart(sq).kind), 'Resume drill');
  assert.equal(F.resumeTitle(F.waitingPart(DRILL).kind), 'Resume drill');
  assert.equal(F.resumeTitle(F.waitingPart(LESSON).kind), 'Resume lesson');
  // the same unit and part only: anything else replaces it, with no question (G-D20)
  assert.equal(F.resumesLesson({ go: 'part', unit: 'values', part: 'practice' }, F.waitingPart(prac)), true);
  assert.equal(F.resumesLesson({ go: 'part', unit: 'kq', part: 'apply' }, F.waitingPart(DRILL)), true);
  assert.equal(F.resumesLesson({ go: 'part', unit: 'values', part: 'learn' }, F.waitingPart(prac)), false, 'another part of the same lesson');
  assert.equal(F.resumesLesson({ go: 'part', unit: 'fork', part: 'practice' }, F.waitingPart(prac)), false, 'another lesson');
  assert.equal(F.resumesLesson({ go: 'next', unit: 'values', part: 'practice' }, F.waitingPart(prac)), false, 'not a lesson step');
  // a set that is not a lesson's part never stands for one
  assert.equal(F.waitingPart(setE({ kind: 'safety', rated: false, count: 3, items: [['m1', 1], ['m2', 0], ['m3', 1]] })), null);
  assert.equal(F.waitingPart({ k: 'set', kind: 'puzzles', unit: 'values', part: 'review' }), null, 'an unknown part');
});

/* ---------- G-D36: a game that ended while it was closed ---------- */
test('G-D36: a game that ends while it is not on screen is marked unseen; one that ends on screen is not', () => {
  // phones: on screen = the game on the board screen
  assert.equal(F.endsUnseen({ wide: false, mode: 'play', scr: 'act' }), false, 'the player is watching it');
  assert.equal(F.endsUnseen({ wide: false, mode: 'play', scr: 'tabs' }), true, 'closed: the player is on a tab page');
  assert.equal(F.endsUnseen({ wide: false, mode: 'lesson', scr: 'act' }), true, 'a lesson is on the board');
  assert.equal(F.endsUnseen({ wide: false, mode: 'review', scr: 'act' }), true);
  // wide: the board always shows something; the game is on screen when it is the one on the board
  assert.equal(F.endsUnseen({ wide: true, mode: 'play', scr: 'tabs' }), false);
  assert.equal(F.endsUnseen({ wide: true, mode: 'puzzle', scr: 'act' }), true);
  assert.equal(F.endsUnseen(null), true, 'unknown: the card is the safe side');
});
test('G-D36 (round 2): the result line says who won; a Beginner never reads "engine"', () => {
  assert.equal(F.endedLine({ r: 'W', title: 'Checkmate. You win!', plain: false }), 'Checkmate. You win!');
  assert.equal(F.endedLine({ r: 'L', title: 'Checkmate', plain: false }), 'Checkmate. Engine wins.');
  assert.equal(F.endedLine({ r: 'L', title: 'Checkmate', plain: true }), 'Checkmate. Rani\u2019s partner wins.');
  assert.equal(F.endedLine({ r: 'D', title: 'Stalemate', plain: false }), 'Stalemate', 'a draw: the end card’s own title');
  assert.equal(F.endedLine({ r: 'D', title: 'Draw', plain: true }), 'Draw');
  assert.equal(F.endedLine(null), '');
});
test('G-D36: the result card: "Your game ended", the end card’s own result line, "See the end" and "Review"', () => {
  const c = F.endedCard({ over: true, unseen: true, wide: false, line: 'Checkmate' });
  assert.deepEqual(c, { title: 'Your game ended', line: 'Checkmate', main: { label: 'See the end', go: 'seeend' }, small: [{ label: 'Review', go: 'review' }] });
  assert.equal(F.endedCard({ over: true, unseen: false, wide: false, line: 'Draw' }), null, 'seen: no card');
  assert.equal(F.endedCard({ over: false, unseen: true, wide: false, line: '' }), null, 'a game going on has the Resume game card instead');
  assert.equal(F.endedCard({ over: true, unseen: true, wide: true, line: 'Draw' }), null, 'wide: the finished game is on the board, as today');
  assert.equal(F.endedCard(null), null);
  for (const w of [c.title, c.main.label, c.small[0].label]) assert.ok(w.indexOf('—') === -1, 'no em dash');
});

/* ---------- G2c: the phone's back button (G-D38 to G-D40). One pure decision, first match wins, every width. ---------- */
test('G-D40: the back button order, first match wins', () => {
  const base = { settings: false, check: false, note: false, wide: false, scr: 'tabs', tab: 'coach' };
  const S = (o) => F.backStep(Object.assign({}, base, o));
  // 1. Settings beats everything else that could be open at the same time
  assert.equal(S({ settings: true, check: true, note: true, scr: 'act', tab: 'play' }), 'settings');
  // 2. the level check beats a note, the board screen and the tabs
  assert.equal(S({ check: true, note: true, scr: 'act', tab: 'play' }), 'check');
  assert.equal(S({ check: true }), 'check', 'on Home too: never leave the app from the level check');
  // 3. a note from Rani beats the board screen and the tabs
  assert.equal(S({ note: true, scr: 'act', tab: 'play' }), 'note');
  assert.equal(S({ note: true }), 'note', 'on Home too');
  // 4. phones, the board screen open (with or without an end card): Close
  for (const tab of ['play', 'path', 'train', 'progress', 'coach']) assert.equal(S({ scr: 'act', tab }), 'close', tab);
  // 5. G-D38: a tab other than Home opens Home
  for (const tab of ['path', 'train', 'play', 'progress']) assert.equal(S({ tab }), 'home', tab);
  // 6. Home: leave (the app stays in memory)
  assert.equal(S({}), 'leave');
});
test('G-D39: wide screens never close, end or park what is on the board: a sheet or a note, else the tab rule', () => {
  const W = (o) => F.backStep(Object.assign({ settings: false, check: false, note: false, wide: true, scr: 'act', tab: 'path' }, o));
  assert.equal(W({}), 'home', 'a lesson on the board, back on Learn: Home, not Close');
  assert.equal(W({ tab: 'play' }), 'home');
  assert.equal(W({ tab: 'coach' }), 'leave');
  assert.equal(W({ scr: 'tabs', tab: 'train' }), 'home');
  assert.equal(W({ settings: true }), 'settings');
  assert.equal(W({ check: true }), 'check');
  assert.equal(W({ note: true }), 'note');
  for (const tab of ['coach', 'path', 'train', 'play', 'progress']) assert.notEqual(W({ tab }), 'close', tab);
});
test('G-D40: the facts are read strictly; a missing width never opens Close, and nothing throws', () => {
  assert.equal(F.backStep({ scr: 'act', tab: 'play' }), 'home', 'unknown width: not the board screen');
  assert.equal(F.backStep({ settings: 1, tab: 'coach' }), 'leave', 'only true counts');
  assert.equal(F.backStep(null), 'leave');
  assert.equal(F.backStep(undefined), 'leave');
  assert.equal(F.backStep({ tab: 'coach', wide: false, scr: 'act' }), 'close');
});
