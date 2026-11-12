/* ---------- Tips (F2): the tip slot's two lists, its label and the first-day rule. Pure: no DOM, no network, no storage.
   The lists are signed copy (docs/specs/flow-rework.product.md). Beginner tips have no notation, numbers or engine words. ---------- */
(function (root, factory) {
  var T = factory();
  if (typeof module === 'object' && module.exports) module.exports = T; else root.Tips = T;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var BEGINNER = [
    'Before you move, look at what their last move attacks.',
    'Castle early. A king in the middle is easy to attack.',
    'Bring out your knights and bishops before your queen.',
    'A free piece is one nobody guards. Take it.',
    'Before you let go of a piece, check it is safe on its new square.',
    'Pawns can’t move back. Push them with care.',
    'Two pieces attacking one square beat one piece guarding it.',
    'When you are ahead, swap pieces. The game gets simpler.'
  ];
  var OTHER = [
    'Checks, captures, threats. Look at them in that order, every move.',
    'A knight on the edge covers fewer squares. Keep it near the middle.',
    'Two attacks at once win a piece. Look for forks every move.',
    'Rooks belong on open files. Put one there before your opponent does.',
    'A pinned piece is a poor guard. Count it out.',
    'In the endgame, the king is a fighting piece. Bring it to the middle.',
    'Passed pawns must be pushed. Put a rook behind them.',
    'After every game, find the one move where it turned.'
  ];

  /* F-D13: the Beginner list for level 'beginner' (Show everything does not change it) and before a level is set. */
  function list(level) { return level === 'improver' || level === 'club' ? OTHER : BEGINNER; }
  /* One tip. rnd: a number from 0 to 1 (the app passes none and gets a random tip). */
  function pick(level, rnd) {
    var l = list(level), r = typeof rnd === 'number' && rnd >= 0 ? rnd : Math.random();
    return l[Math.min(l.length - 1, Math.floor(r * l.length))];
  }
  /* F-D14: the label names the chosen coach. */
  function label(coach) { return coach === 'gaja' ? 'Gaja’s tip' : 'Rani’s tip'; }
  /* What a screen reader hears: "Rani’s tip: <text>". */
  function aria(coach, text) { return label(coach) + ': ' + text; }

  /* The app's day key: local date, month 1-based, no padding (as dkey() in app.js). */
  function dayKey(t) { var d = new Date(t); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  /* F-D5: the first day is the earliest day the app has a record for. It is still the first day while every record the
     profile holds is from today: its day list, the time the level was set, games, lesson parts and the last save. One record
     from any other day (earlier, or "later" after the clock was set back) means the player is past day one. No profile field
     is added, and the profile is never changed. p.days is trimmed to 60 days by the app; any day in it is enough. */
  function firstDay(p, now) {
    if (!p || typeof p !== 'object') return true;
    var t0 = +now; if (!(t0 > 0)) t0 = Date.now();
    var today = dayKey(t0), other = false;
    function stamp(t) { t = +t; if (t > 1e11 && dayKey(t) !== today) other = true; } /* a real time, not a flag like 1 or true */
    function obj(x) { return !!x && typeof x === 'object'; }
    if (obj(p.days)) Object.keys(p.days).forEach(function (k) { if (k !== today) other = true; });
    stamp(p.levelT); stamp(p.t);
    if (Array.isArray(p.games)) p.games.forEach(function (g) { if (obj(g)) stamp(g.d); });
    if (obj(p.course)) Object.keys(p.course).forEach(function (id) { var c = p.course[id]; if (obj(c)) Object.keys(c).forEach(function (k) { stamp(c[k]); }); });
    return !other;
  }

  return { BEGINNER: BEGINNER, OTHER: OTHER, list: list, pick: pick, label: label, aria: aria, firstDay: firstDay, dayKey: dayKey };
});
