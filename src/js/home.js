/* ---------- Home: Beginner Home (S2b, prototype A): which card to show and Rani’s words. Pure: no DOM, no network. ---------- */
(function (root, factory) {
  var H = factory();
  if (typeof module === 'object' && module.exports) module.exports = H; else root.Home = H;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  /* D42: a new lesson's headline and line (signed copy). */
  var PAIRS = {
    rules: ['Today you’ll learn how the pieces move.', 'Each piece has its own way. I’ll show you every one.'],
    special: ['Today: castling and other special moves.', 'And the ways a game can end in a draw.'],
    board: ['Today you’ll learn to find any square.', 'Every square has a name. Soon you’ll know them all.'],
    values: ['Today: what each piece is worth.', 'Then you’ll spot free pieces and keep yours safe.'],
    mate: ['Today you’ll learn check and checkmate.', 'Checkmate wins the game. Let’s spot it in one move.'],
    opening: ['Today: how to start a game well.', 'Bring your pieces out and keep your king safe.'],
    blunder: ['Today: one quick check before every move.', 'It stops most lost pieces.']
  };
  /* Decorative piece on the Continue card (aria-hidden in the app). */
  var ICON = { rules: 'n', special: 'r', board: 'p', values: 'q', mate: 'k', opening: 'b', blunder: 'n' };
  var FOUNDATIONS = 1;
  /* D49: Rani's question before a lesson game would drop an unfinished game (signed copy). */
  var ASK = { text: 'You have a game going. Finish it first?', back: 'Back to my game', go: 'Start the lesson game' };

  function startIndex(units, start) { for (var i = 0; i < units.length; i++) if (units[i].id === start) return i; return 0; }
  /* D45: Foundations lessons (course level 1) at or after the start point, in course order. An unknown start counts from the first unit. */
  function foundations(units, start) {
    var from = startIndex(units, start);
    return units.filter(function (u, i) { return i >= from && u.level === FOUNDATIONS; });
  }

  /* D46: the first unfinished Foundations lesson, then D30's "Beat Rani’s practice partner", then Keep practising (D39).
     hasWin: the same test as D30 (a win against Rani’s practice partner or stronger). */
  function state(p, units, unitDone, unitStarted, nextPart, hasWin) {
    var list = foundations(units || [], p && p.start), m = list.length, done = list.filter(unitDone).length;
    for (var i = 0; i < m; i++) {
      var u = list[i];
      if (!unitDone(u)) return { kind: 'lesson', unit: u, n: i + 1, m: m, done: done, part: nextPart(u), started: !!unitStarted(u) };
    }
    return { kind: hasWin ? 'practice' : 'beat', m: m, done: done };
  }

  /* D49: on Beginner Home, Continue asks first when its next part is a lesson game and a game is unfinished. */
  function askFirst(s, ongoing) {
    return !!(ongoing && s && s.kind === 'lesson' && s.part === 'apply' && s.unit && s.unit.apply && s.unit.apply.type === 'game');
  }

  /* coach: 'rani' | 'gaja' (D48: Gaja says "Rani’s practice partner" where Rani says "my practice partner").
     ongoing: an unfinished game (D44). go / alt name the action the app wires to the main and second button. */
  function lines(s, coach, ongoing) {
    var partner = coach === 'gaja' ? 'Rani’s practice partner' : 'my practice partner';
    var back = { second: 'Back to my game', alt: 'back' }, play = { second: 'Just play a game', alt: 'game' }, two = ongoing ? back : play;
    if (s.kind === 'beat') {
      return { head: 'You finished every Foundations lesson!', line: 'Now beat ' + partner + '.', kicker: 'Next step', title: 'Beat Rani’s practice partner',
        bar: null, button: ongoing ? 'Back to my game' : 'Play now', go: ongoing ? 'back' : 'game', second: null, alt: null, icon: 'k', zone: 'play' };
    }
    if (s.kind === 'practice') {
      return { head: 'You know the basics now.', line: 'Keep practising, or move up to Improver any time in Settings.', kicker: 'Practice', title: 'Puzzles at your level',
        bar: null, button: 'Start 10 puzzles', go: 'puzzles', second: two.second, alt: two.alt, icon: 'n', zone: 'train' };
    }
    var u = s.unit, say;
    if (s.part === 'practice') say = ['Now let’s practise.', 'A few quick ones on the board.'];
    else if (s.part === 'apply') say = ['Now try it in a real game.', 'You’ll play ' + partner + '.'];
    else say = PAIRS[u.id] || [u.title, '']; /* every Foundations lesson has a pair today; a future one shows its title */
    return { head: say[0], line: say[1], kicker: 'Lesson ' + s.n + ' of ' + s.m, title: u.title,
      bar: { done: s.done, m: s.m, text: s.done + ' of ' + s.m + ' lessons done' },
      button: s.started ? 'Continue' : 'Start lesson', go: askFirst(s, ongoing) ? 'ask' : 'part', second: two.second, alt: two.alt, icon: ICON[u.id] || 'p', zone: 'learn' };
  }

  /* D43: the streak chip shows from 1 day. */
  function streak(n) {
    n = Math.floor(+n || 0); if (n < 1) return null;
    var t = n + (n === 1 ? ' day' : ' days');
    return { text: t, label: 'Streak: ' + t };
  }

  return { foundations: foundations, state: state, lines: lines, streak: streak, askFirst: askFirst, PAIRS: PAIRS, ASK: ASK };
});
