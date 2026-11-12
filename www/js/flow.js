/* ---------- Flow (F1): the one next step. Which end card follows a game, a lesson step or a puzzle set, and the Continue
   card on Improver and Club Home. Pure: no DOM, no network. Copy is the signed copy in docs/specs/flow-rework.product.md. ---------- */
(function (root, factory) {
  var F = factory();
  if (typeof module === 'object' && module.exports) module.exports = F; else root.Flow = F;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var COPY = {
    home: 'Home', practice: 'Start practice', lessonGame: 'Play the lesson game', nextLesson: 'Start next lesson', more: '10 more puzzles', tryAgain: 'Try again',
    review: 'Review this game', newGame: 'New game', again: 'Go again', cont: 'Continue', startLesson: 'Start lesson', play: 'Play now', puzzles: 'Start 10 puzzles', back: 'Back to my game',
    toPractice: 'Next: practise it.', toGame: 'Next: play it in a real game.', toStep: 'Next: one more step.', nextIs: 'Next lesson: ', whole: 'That’s the whole game.',
    kicker: 'Continue', lessonOf: 'Continue · Lesson ', reach: 'Puzzles to reach ', sharp: 'Keep sharp: rated puzzles'
  };
  /* go names the action the app wires to a button: review, newgame, home, nextlesson (the next lesson's next part), tryagain
     (the lesson game again), again (the same step again), part (the lesson's next part), more (10 more puzzles), step (the
     Continue card's step), after (Beginner Home's step once Foundations is done). */
  function b(label, go) { return { label: label, go: go }; }
  var HOME = b(COPY.home, 'home'), REVIEW = b(COPY.review, 'review'), NEW = b(COPY.newGame, 'newgame'), AGAIN = b(COPY.again, 'again');

  /* After a game (the card under the board). c.goal: null (a normal game) | 'done' | 'failed' (a lesson game's task).
     c.next: { title } = the next lesson at the player's level, or null. */
  function afterGame(c) {
    c = c || {};
    if (c.goal === 'failed') return { line: null, main: b(COPY.tryAgain, 'tryagain'), small: [REVIEW, HOME] };
    if (c.goal === 'done' && c.next) return { line: COPY.nextIs + c.next.title, main: b(COPY.nextLesson, 'nextlesson'), small: [REVIEW, HOME] };
    return { line: null, main: REVIEW, small: [NEW, HOME] };
  }
  /* The last move of a finished game's review. step: the Continue card's { title, button }. */
  function afterReview(step) {
    return { title: COPY.whole, line: step.title, main: b(step.button, 'step'), small: [NEW, HOME] };
  }
  /* After a lesson step or a puzzle set.
     c.unit: part of a lesson. c.from: 'learn' | 'session'. c.passed. c.nextPart: the lesson's next unfinished part
     ('practice' | 'game' | any other task) or null when the lesson is done. c.next: { title } = the next lesson at the
     player's level, or null. c.after: a Beginner whose Foundations lessons are done: Beginner Home's { button }.
     c.set (not a lesson): 'puzzles' | 'review' (missed puzzles) | 'other'. */
  function afterStep(c) {
    c = c || {};
    if (!c.unit) {
      if (c.set === 'review') return { line: null, main: HOME, small: [] };
      if (c.set === 'puzzles') return { line: null, main: b(COPY.more, 'more'), small: [HOME] };
      return { line: null, main: AGAIN, small: [HOME] };
    }
    if (!c.passed) return { line: null, main: AGAIN, small: [HOME] }; /* not passing never offers the next step */
    var small = c.from === 'learn' ? [HOME] : [AGAIN, HOME];
    if (c.nextPart === 'practice') return { line: COPY.toPractice, main: b(COPY.practice, 'part'), small: small };
    if (c.nextPart === 'game') return { line: COPY.toGame, main: b(COPY.lessonGame, 'part'), small: small };
    if (c.nextPart) return { line: COPY.toStep, main: b(COPY.cont, 'part'), small: small };
    if (c.next) return { line: COPY.nextIs + c.next.title, main: b(COPY.nextLesson, 'nextlesson'), small: [AGAIN, HOME] };
    if (c.after) return { line: null, main: b(c.after.button, 'after'), small: [AGAIN, HOME] };
    return { line: null, main: HOME, small: [AGAIN] };
  }

  /* The Continue card on Improver and Club Home (and a Beginner with Show everything on). a: today's next step:
     { kind: 'lesson', title, n, m, done, started } | { kind: 'puzzles', target } | { kind: 'beat', name } | { kind: 'sharp' }.
     go: 'part' (the lesson's next part), 'next' (today's next step, unchanged) or 'back' (to the unfinished game). */
  function cont(a, ongoing) {
    if (a.kind === 'lesson') {
      return { kicker: COPY.lessonOf + a.n + ' of ' + a.m, title: a.title, bar: { done: a.done, m: a.m, text: a.done + ' of ' + a.m + ' lessons done' },
        button: a.started ? COPY.cont : COPY.startLesson, go: 'part', icon: 'b', zone: 'learn' };
    }
    if (a.kind === 'puzzles') return { kicker: COPY.kicker, title: COPY.reach + a.target, bar: null, button: COPY.puzzles, go: 'next', icon: 'n', zone: 'train' };
    if (a.kind === 'beat') return { kicker: COPY.kicker, title: 'Beat the ' + a.name + ' engine', bar: null, button: ongoing ? COPY.back : COPY.play, go: ongoing ? 'back' : 'next', icon: 'k', zone: 'play' };
    return { kicker: COPY.kicker, title: COPY.sharp, bar: null, button: COPY.puzzles, go: 'next', icon: 'n', zone: 'train' };
  }

  /* D49: a main button that would start a lesson game while another game is unfinished asks first. */
  function asks(part, applyType, ongoing) { return !!(ongoing && part === 'apply' && applyType === 'game'); }

  return { afterGame: afterGame, afterReview: afterReview, afterStep: afterStep, cont: cont, asks: asks, COPY: COPY };
});
