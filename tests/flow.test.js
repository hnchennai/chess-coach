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
  assert.deepEqual(c.main, { label: 'Continue', go: 'step' });
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
test('Continue card: beat the stage opponent: Play now, or Back to my game with an unfinished game', () => {
  let c = F.cont({ kind: 'beat', name: 'Improver' }, false);
  assert.equal(c.kicker, 'Continue'); assert.equal(c.title, 'Beat the Improver engine'); assert.equal(c.button, 'Play now'); assert.equal(c.go, 'next'); assert.equal(c.bar, null);
  c = F.cont({ kind: 'beat', name: 'Improver' }, true);
  assert.equal(c.button, 'Back to my game'); assert.equal(c.go, 'back');
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
