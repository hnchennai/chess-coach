/* ---------- Flow (F1): the one next step. Which end card follows a game, a lesson step or a puzzle set, and the Continue
   card on Improver and Club Home. Pure: no DOM, no network. Copy is the signed copy in docs/specs/flow-rework.product.md. ---------- */
(function (root, factory) {
  var F = factory();
  if (typeof module === 'object' && module.exports) module.exports = F; else root.Flow = F;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var COPY = {
    home: 'Home', practice: 'Start practice', lessonGame: 'Play the lesson game', nextLesson: 'Start next lesson', more: '10 more puzzles', daily: 'Today’s puzzle', tryAgain: 'Try again', keep: 'Keep playing',
    review: 'Review this game', newGame: 'New game', again: 'Go again', cont: 'Continue', startLesson: 'Start lesson', play: 'Play now', puzzles: 'Start 10 puzzles', back: 'Resume game',
    toPractice: 'Next: practise it.', toGame: 'Next: play it in a real game.', toStep: 'Next: one more step.', nextIs: 'Next lesson: ', whole: 'That’s the whole game.',
    kicker: 'Continue', lessonOf: 'Continue · Lesson ', reach: 'Puzzles to reach ', sharp: 'Keep sharp: puzzles at your level',
    /* G2a (board-screens.product.md, "New wording") */
    close: 'Close', resumeGame: 'Resume game', resumeLesson: 'Resume lesson', resumePuzzles: 'Resume puzzles', resumeDrill: 'Resume drill',
    move: 'Move ', yourTurn: ', your turn', engineTurn: ', engine to move', recent: 'Recent games',
    /* G-D36 (fix round 1) */
    ended: 'Your game ended', seeEnd: 'See the end', reviewShort: 'Review',
    /* G2b fix round 2: the result card's line for a loss (G-D28: a Beginner never reads "engine") */
    engineWins: 'Checkmate. Engine wins.', partnerWins: 'Checkmate. Rani\u2019s partner wins.'
  };
  /* go names the action the app wires to a button: review, newgame, home, nextlesson (the next lesson's next part), tryagain
     (the lesson game again), again (the same step again), part (the lesson's next part), more (10 more puzzles), step (the
     Continue card's step), after (Beginner Home's step once Foundations is done). */
  function b(label, go) { return { label: label, go: go }; }
  var HOME = b(COPY.home, 'home'), REVIEW = b(COPY.review, 'review'), NEW = b(COPY.newGame, 'newgame'), AGAIN = b(COPY.again, 'again');

  /* The lesson's next unfinished part, in the signed words (F-D23): 'practice' | 'game' | any other task. */
  function partStep(nextPart) {
    if (nextPart === 'practice') return { line: COPY.toPractice, main: b(COPY.practice, 'part') };
    if (nextPart === 'game') return { line: COPY.toGame, main: b(COPY.lessonGame, 'part') };
    return { line: COPY.toStep, main: b(COPY.cont, 'part') };
  }
  /* After a game (the card under the board). c.goal: null (a normal game) | 'done' | 'failed' (a lesson game's task).
     c.nextPart: another part of the same lesson is still undone (F-D23). c.next: { title } = the next lesson, or null. */
  function afterGame(c) {
    c = c || {};
    if (c.goal === 'failed') return { line: null, main: b(COPY.tryAgain, 'tryagain'), small: [REVIEW, HOME] };
    if (c.goal === 'done' && c.nextPart) { var p = partStep(c.nextPart); return { line: p.line, main: p.main, small: [REVIEW, HOME] }; }
    if (c.goal === 'done' && c.next) return { line: COPY.nextIs + c.next.title, main: b(COPY.nextLesson, 'nextlesson'), small: [REVIEW, HOME] };
    return { line: null, main: REVIEW, small: [NEW, HOME] };
  }
  /* F-D18: a lesson game's goal decided before the game ends (the goal card on Play). Passed: the next step, small
     "Keep playing". Failed: "Try again", small "Keep playing". main is null when a passed goal has no lesson to go to. */
  function goalCard(c) {
    c = c || {};
    var keep = [b(COPY.keep, 'keep')];
    if (c.goal === 'failed') return { line: null, main: b(COPY.tryAgain, 'tryagain'), small: keep };
    if (c.goal !== 'done') return null;
    if (c.nextPart) { var p = partStep(c.nextPart); return { line: p.line, main: p.main, small: keep }; }
    if (c.next) return { line: COPY.nextIs + c.next.title, main: b(COPY.nextLesson, 'nextlesson'), small: keep };
    return { line: null, main: null, small: keep };
  }
  /* The last move of a finished game's review. step: the Continue card's { title, button, lesson } (F-D29: a lesson is
     named with its signed label). */
  function afterReview(step) {
    /* F-D33: with the "Next lesson: <title>" line, the button reads "Start next lesson", as on the other end cards */
    return { title: COPY.whole, line: (step.lesson ? COPY.nextIs : '') + step.title, main: b(step.lesson ? COPY.nextLesson : step.button, 'step'), small: [NEW, HOME] };
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
    if (c.nextPart) { var p = partStep(c.nextPart); return { line: p.line, main: p.main, small: small }; }
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

  /* ---------- G2a: the board screen on phones (docs/specs/board-screens.product.md). On the one-column layout the tabs are
     full pages with no board, and a game, lesson, set, drill or review opens the board screen. Wide screens (board left,
     panel right) never have one. s.scr: 'tabs' | 'act', kept in memory by the app at every width. ---------- */
  function actOpen(s) { return !!s && s.wide === false && s.scr === 'act'; }
  /* G-D3, G-D8: the bottom tabs are hidden on the board screen and come back whenever an end card is on it. */
  function tabsHidden(s) { return actOpen(s) && !s.end; }
  /* No dead end: the board screen is only kept while the selected tab is the activity's own tab, or the Learn end card is
     up (the board is back on the game by then, the tab is still Learn). Anything else falls back to the tab page. */
  function keepsScreen(s) { return !!s && (s.tab === s.zoneTab || (!!s.learnEnd && s.tab === 'path')); }
  /* THE RULE FOR "A BOARD IS IN USE" (criterion 7, G-D11). Phones: only while the board screen is open with no end card on
     it; a saved game or a lesson the player has closed does not count. Wide: the board is always on screen, so today's rule
     (F-D4): a lesson, review, unfinished set or unfinished game. The level check counts everywhere. A missing fact means yes.
     s: { wide, open (the board screen), end (an end card is up), busy (wide's rule), check (the level check is open) } */
  function inUse(s) {
    if (!s || typeof s !== 'object' || typeof s.wide !== 'boolean') return true;
    if (s.check !== false) return true;
    if (s.wide) return s.busy !== false;
    if (typeof s.open !== 'boolean' || typeof s.end !== 'boolean') return true;
    return s.open && !s.end;
  }
  /* THE SLOT RULE (criterion 7): the one function that decides the tip slot, and through it the ad banner (ads.js mayShow
     needs this to say yes first). place: 'home' | 'progress' | 'game' | 'learn' | 'step' (the three end cards).
     s.day: the first-day rule allows it (F-D5). s.inUse: inUse() above. Unknown facts mean no slot.
     Phones (G-D11): never while the board is in use; a closed, saved game hides nothing; an end card also needs the board
     on screen not to be a game in progress (s.live). Wide keeps F-D17 and F-D32:
     Home and Progress while nothing is in use, an end card while no game is unfinished. */
  var SLOT_PLACES = { home: 'page', progress: 'page', game: 'card', learn: 'card', step: 'card' };
  function slotOk(s) {
    if (!s || typeof s !== 'object' || s.day !== true || typeof s.inUse !== 'boolean' || typeof s.wide !== 'boolean') return false;
    var k = SLOT_PLACES[s.place]; if (!k) return false;
    if (k === 'page') return !s.inUse;
    if (s.wide) return s.gameOn === false;
    /* Fix round 1: an end card has no slot while the board on the screen is a game in progress (s.live: the Learn end card,
       where the board is back on the player's unfinished game). The fact must be known. */
    return !s.inUse && s.live === false;
  }
  /* G-D22: the Resume game card's line. n: the move number the game is on. */
  function resumeLine(n, yourTurn) { n = Math.floor(+n) || 0; return COPY.move + (n < 1 ? 1 : n) + (yourTurn ? COPY.yourTurn : COPY.engineTurn); }
  /* G-D5, G-D26: kind: 'game' | 'lesson' | a set's kind. The board drill, the piece drill, an opening drill and an endgame
     drill read "Resume drill"; puzzles and Safe or blunder read "Resume puzzles". */
  function resumeTitle(kind) {
    if (kind === 'game') return COPY.resumeGame;
    if (kind === 'lesson') return COPY.resumeLesson;
    return kind === 'drill' || kind === 'book' || kind === 'squares' || kind === 'reach' ? COPY.resumeDrill : COPY.resumePuzzles;
  }
  /* G-D25: on a phone the app always opens on Home. Wide: the stored tab, except Learn, as before. has(tab): the tab exists. */
  function startTab(stored, wide, has) { return wide && stored && stored !== 'path' && has(stored) ? stored : 'coach'; }
  /* G2d (G-D33): the pieces and the view the app starts with. A player who never chose gets the classic pieces on the flat
     board. A choice is kept: the set picked on this device (s.pieces), else the one the profile carries (s.theme, a restored
     save); the 3D view only on a saved yes (s.v3d). has(id): the set exists. */
  function firstLook(s, has) {
    s = s || {};
    var ok = function (id) { return typeof id === 'string' && !!has(id); };
    return { theme: ok(s.pieces) ? s.pieces : ok(s.theme) ? s.theme : 'classic', v3d: s.v3d === true };
  }
  /* G-D4, G-D23: the tab Close lands on. s: { mode, zoneTab, learnEnd, past (a past game's review), from (the tab a past
     game was opened on) } */
  function closeTab(s) {
    if (s.mode === 'review') return s.past && s.from === 'progress' ? 'progress' : 'play';
    return s.learnEnd ? 'path' : s.zoneTab;
  }

  /* Fix round 1 (G-D20's wording: "a set or drill on Train"): a drill started from Train's list belongs to Train (it closes
     to Train, and its Resume card is there). Started anywhere else it stays with its lesson, on Learn (null). G-D35 (G2b fix
     round 1): at every width, since what waits on a tab now survives on wide screens too. */
  function drillZone(from) { return from === 'train' ? 'train' : null; }
  /* Home's Continue card resumes a lesson that is waiting, at its step, instead of starting it again.
     c: the card's { go, unit (id), part }. w: the waiting lesson { unit (id), part: 'learn' } or null. */
  function resumesLesson(c, w) { return !!(c && w && c.go === 'part' && c.unit === w.unit && c.part === w.part); }
  /* The room an end card keeps free at the bottom for a banner that is on its way (ads criterion 5): the banner's reported
     height, else 64, plus the gap above the fixed tab bar. s: { expected, h, fixedTabs } */
  function bannerRoom(s) {
    if (!s || !s.expected) return 0;
    return Math.ceil(+s.h > 0 ? +s.h : 64) + (s.fixedTabs ? 8 : 0);
  }

  /* ---------- G2b: one thing waits per tab, and it is saved on the device (G-D19, G-D20). A game waits on Play (it is saved on
     every move, as before). A lesson, or a drill started from Learn, waits on Learn; a set or drill waits on Train. What waits
     is one small entry of plain data, the same in memory (parked) and in local storage, so a parked item and a restart
     come back through the same code. A review and the level check are never saved. ---------- */
  var RESUME_KEY = 'suresh-chess-coach.resume.v1', RESUME_V = 1;
  var SET_KINDS = { puzzles: 1, safety: 1, squares: 1, reach: 1, book: 1, drill: 1 };
  function isInt(n, lo, hi) { return typeof n === 'number' && isFinite(n) && Math.floor(n) === n && n >= lo && n <= hi; }
  /* G-D20, G-D35: what happens to the lesson or set on the board when something else opens, at every width (G-D35 replaced
     D50 on wide screens too). s: { live: 'learn' | 'train' | null (the tab of what is on the board), over (it is finished),
     to: 'play' | 'learn' | 'train' }. 'park': it waits on its own tab. 'end': it is over or replaced (a new activity on the
     same tab wins, with no question). 'none': nothing was there. */
  function onOpen(s) {
    if (!s || !s.live) return 'none';
    return s.over || s.to === s.live ? 'end' : 'park';
  }
  /* The words of a place (G-D30), from live state or from an entry. */
  function lessonLine(i, n) { return 'Lesson · step ' + (i + 1) + ' of ' + n; }
  /* D1: the daily puzzle (an entry's day mark, or a live set's opts) reads as itself, not "Puzzle 1 of 1" */
  function setLine(s) { if (s.daily || (s.opts && s.opts.daily)) return COPY.daily; return s.kind === 'drill' ? 'Endgame drill' : (s.kind === 'puzzles' ? 'Puzzle ' : '') + (s.finished ? s.count : Math.min(s.i + 1, s.count)) + ' of ' + s.count; }
  /* The entry for what is on the board, built from plain facts. a: { over, lesson: { unit, i } } or { over, set: { kind,
     title, unit, part, count, pass, rated, theme, review, i, right, wrong, counted, items, drill: { fen, moves }, daily } }.
     items: puzzle ids dealt so far (all of them for a fixed set), [id, 0 | 1] pairs for Safe or blunder, opening line ids.
     counted: the current item's result is already in the score (and in the profile), so it is never counted twice. */
  function entryOf(a) {
    if (!a || a.over) return null;
    if (a.lesson) return { k: 'lesson', unit: a.lesson.unit, i: a.lesson.i };
    var s = a.set; if (!s) return null;
    var e = { k: 'set', kind: s.kind, title: s.title, unit: s.unit || null, part: s.part || null, count: s.count, pass: s.pass == null ? null : s.pass, rated: !!s.rated,
      theme: s.theme || null, review: !!s.review, i: s.i, right: s.right, wrong: s.wrong, counted: !!s.counted, items: (s.items || []).slice() };
    if (s.kind === 'drill' && s.drill) e.drill = { fen: s.drill.fen, moves: s.drill.moves };
    if (s.daily) e.daily = s.daily; /* D1: the daily puzzle (a 1-puzzle set): the day it was dealt; other sets keep their saved shape */
    /* round 2: the counted item's own outcome (true: solved or right, false: missed), so it comes back as it ended */
    if (e.counted) e.ok = s.ok === true ? true : s.ok === false ? false : null;
    return e;
  }
  /* THE CHECK OF A SAVED ENTRY (G-D19: fail safe). zone: the tab it waits on. f: the facts of this app and this player:
     unit(id) -> null or { title, steps, practice: a set kind or null, apply: 'drill' | 'book' | null }, puzzle(id), quiz(id)
     (a Safe or blunder puzzle), book(id), fen(text) (a position that can be played), trainOpen (the player can open Train).
     Anything unknown, out of range or no longer in the course or the puzzle bank says no; nothing is ever thrown. */
  function entryOk(zone, e, f) { try { return checkEntry(zone, e, f); } catch (x) { return false; } }
  function checkEntry(zone, e, f) {
    if ((zone !== 'learn' && zone !== 'train') || !e || typeof e !== 'object' || Array.isArray(e) || !f) return false;
    if (zone === 'train' && f.trainOpen !== true) return false;
    if (e.unit != null && typeof e.unit !== 'string') return false;
    var u = e.unit == null ? null : f.unit(e.unit);
    if (e.unit != null && !u) return false;
    if (e.k === 'lesson') return zone === 'learn' && !!u && isInt(e.i, 0, u.steps - 1);
    if (e.k !== 'set' || !SET_KINDS.hasOwnProperty(e.kind)) return false;
    var kind = e.kind, it = e.items, n, j;
    if (typeof e.title !== 'string' || !e.title || e.title.length > 120) return false;
    if (!isInt(e.count, 1, 60) || !isInt(e.i, 0, e.count - 1) || !isInt(e.right, 0, 60) || !isInt(e.wrong, 0, 60)) return false;
    if (e.pass != null && !isInt(e.pass, 0, e.count)) return false;
    if (typeof e.counted !== 'boolean' || typeof e.rated !== 'boolean' || typeof e.review !== 'boolean' || !Array.isArray(it)) return false;
    /* fix round 1: one result per item played, plus the current one once it is counted; never more than the set has */
    if (e.right + e.wrong !== e.i + (e.counted ? 1 : 0) || e.right + e.wrong > e.count) return false;
    if (e.counted && typeof e.ok !== 'boolean') return false; /* round 2: a counted item carries its outcome */
    if (e.theme != null && typeof e.theme !== 'string') return false;
    if (kind !== 'puzzles' && (e.rated || e.theme || e.review)) return false;
    /* D1: the daily puzzle: one puzzle, on Train, never rated (it picks nothing), themed, a review or a lesson part */
    if (e.daily != null && !(typeof e.daily === 'string' && /^\d{4}-\d{1,2}-\d{1,2}$/.test(e.daily))) return false;
    if (e.daily && (kind !== 'puzzles' || e.count !== 1 || e.unit != null || e.rated || e.theme || e.review)) return false;
    if (u) {
      /* a part of a lesson: the lesson must still have that part, of that kind. It waits on Learn; only a drill started
         from Train's list waits on Train */
      if ((e.part === 'practice' ? u.practice : e.part === 'apply' ? u.apply : null) !== kind) return false;
      if (zone === 'train' && kind !== 'drill') return false;
      if (e.rated || e.theme || e.review) return false;
    } else if (zone !== 'train' || e.part != null || kind === 'squares' || kind === 'reach' || kind === 'drill') return false;
    n = it.length;
    if (kind === 'puzzles') {
      if (n < e.i + 1 || n > e.count || (!e.rated && n !== e.count)) return false;
      for (j = 0; j < n; j++) if (typeof it[j] !== 'string' || !f.puzzle(it[j])) return false;
      return true;
    }
    if (kind === 'safety') {
      if (n !== e.count) return false;
      for (j = 0; j < n; j++) if (!Array.isArray(it[j]) || it[j].length !== 2 || typeof it[j][0] !== 'string' || (it[j][1] !== 0 && it[j][1] !== 1) || !f.quiz(it[j][0])) return false;
      return true;
    }
    if (kind === 'book') {
      if (n !== e.count) return false;
      for (j = 0; j < n; j++) if (typeof it[j] !== 'string' || !f.book(it[j])) return false;
      return true;
    }
    if (n) return false;
    if (kind === 'drill') return e.count === 1 && !!e.drill && typeof e.drill === 'object' && typeof e.drill.fen === 'string' && isInt(e.drill.moves, 0, 500) && !!f.fen(e.drill.fen);
    return true; /* the board drill and the piece drill deal a new item each time */
  }
  /* What goes into local storage: { v: 1, learn: entry | null, train: entry | null }, or null (the key is removed) when
     nothing waits. w: { learn, train } */
  function writeResume(w) {
    if (!w || (!w.learn && !w.train)) return null;
    return { v: RESUME_V, learn: w.learn || null, train: w.train || null };
  }
  /* What comes back from local storage: only entries that pass the check, rebuilt from their known fields. Another version,
     junk, or a bad entry gives null for that tab, silently. */
  function readResume(raw, f) {
    var out = { learn: null, train: null };
    if (!raw || typeof raw !== 'object' || raw.v !== RESUME_V) return out;
    ['learn', 'train'].forEach(function (z) {
      var e = raw[z];
      if (!entryOk(z, e, f)) return;
      out[z] = e.k === 'lesson' ? entryOf({ lesson: e }) : entryOf({ set: e });
    });
    return out;
  }
  /* The Resume card for an entry: { kind (for resumeTitle), kick (the small line above), line }. null: no card. */
  function resumeCard(e, f) {
    if (!e) return null;
    if (e.k === 'lesson') { var u = f && f.unit(e.unit); return u ? { kind: 'lesson', kick: u.title, line: lessonLine(e.i, u.steps) } : null; }
    return e.k === 'set' ? { kind: e.kind, kick: e.title, line: setLine(e) } : null;
  }
  /* What waits on Learn as a lesson's part, for Home's Continue card and Today's Learn step (resumesLesson, G-D37): the
     lesson itself, its practice set or its task (a drill or the opening lines). kind: for resumeTitle. e: Learn's entry. */
  function waitingPart(e) {
    if (!e) return null;
    if (e.k === 'lesson') return { unit: e.unit, part: 'learn', kind: 'lesson' };
    return e.k === 'set' && e.unit && (e.part === 'practice' || e.part === 'apply') ? { unit: e.unit, part: e.part, kind: e.kind } : null;
  }

  /* ---------- G-D36 (fix round 1): a game that ended while it was closed. Its result card stands first on Play and Home, in
     the Resume game card's place, until the player opens it (either button) or starts a new game. The flag lives in the
     saved game itself (unseen), so it survives a restart with no new key. ---------- */
  /* The game ends now: is it on screen? Phones: only on the board screen, as the game. Wide: when the game is the one on the
     board. s: { wide, mode, scr }. Unknown facts mean not on screen (the card is the safe side: it only offers the end). */
  function endsUnseen(s) {
    if (!s || typeof s.wide !== 'boolean') return true;
    return s.mode !== 'play' || (!s.wide && s.scr !== 'act');
  }
  /* The card. s: { over, unseen, wide, line (the end card's own result line) }. Wide: none (the finished game is on the
     board there, as today). go: 'seeend' (the board screen at the final position, with the game's end card) | 'review'. */
  /* Round 2: the card's line says who won. A loss: "Checkmate. Engine wins." (a Beginner: Rani's partner); a win or a draw:
     the end card's own title. s: { r: 'W' | 'L' | 'D', title, plain } */
  function endedLine(s) {
    if (!s) return '';
    return s.r === 'L' ? (s.plain ? COPY.partnerWins : COPY.engineWins) : s.title || '';
  }
  function endedCard(s) {
    if (!s || !s.over || !s.unseen || s.wide !== false) return null;
    return { title: COPY.ended, line: s.line || '', main: b(COPY.seeEnd, 'seeend'), small: [b(COPY.reviewShort, 'review')] };
  }

  /* ---------- G2c: the phone's back button (G-D38 to G-D40). What one press does, first match wins, at every width.
     s: { settings (the Settings sheet is open), check (the level check is open), note (a note from Rani is up), wide, scr
     ('tabs' | 'act'), tab }. Only true counts as open. 'settings' | 'check' | 'note': do what that one's Esc does ('check'
     consumes the press even when Esc does nothing there). 'close': the board screen's Close (phones only, so wide screens
     never end or park what is on the board, G-D39). 'home': Home, as a tab tap. 'leave': the app goes to the background. */
  function backStep(s) {
    if (!s || typeof s !== 'object') return 'leave';
    if (s.settings === true) return 'settings';
    if (s.check === true) return 'check';
    if (s.note === true) return 'note';
    if (actOpen(s)) return 'close';
    return s.tab !== 'coach' ? 'home' : 'leave';
  }

  return { RESUME_KEY: RESUME_KEY, backStep: backStep, onOpen: onOpen, entryOf: entryOf, entryOk: entryOk, writeResume: writeResume, readResume: readResume, resumeCard: resumeCard, waitingPart: waitingPart, endsUnseen: endsUnseen, endedCard: endedCard, endedLine: endedLine, lessonLine: lessonLine, setLine: setLine,
    firstLook: firstLook, drillZone: drillZone, resumesLesson: resumesLesson, bannerRoom: bannerRoom, actOpen: actOpen, tabsHidden: tabsHidden, keepsScreen: keepsScreen, inUse: inUse, slotOk: slotOk, resumeLine: resumeLine, resumeTitle: resumeTitle, startTab: startTab, closeTab: closeTab,
    afterGame: afterGame, goalCard: goalCard, afterReview: afterReview, afterStep: afterStep, cont: cont, asks: asks, COPY: COPY };
});
