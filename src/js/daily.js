/* ---------- Daily puzzle (docs/specs/daily-puzzle.product.md, slice D1): which day it is, today's puzzle, the card's state,
   who sees the card and its words. Pure: no DOM, no network, no clock (the app passes the day's key). ---------- */
(function (root, factory) {
  var D = factory();
  if (typeof module === 'object' && module.exports) module.exports = D; else root.Daily = D;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  /* Signed wording (spec "Wording"), in the app's apostrophe style. */
  var KICKER = 'Daily puzzle', TITLE = 'Today’s puzzle';
  var LINE = { todo: 'One puzzle at your level. About a minute.', solved: 'Solved. A new one tomorrow.', missed: 'Not this time. It’s in your missed puzzles. A new one tomorrow.' };
  /* DP-D12: finished after midnight, the end card ends with this instead of "A new one tomorrow." */
  var RESULT = { solved: 'Solved.', missed: 'Not this time. It’s in your missed puzzles.' }, TOMORROW = 'A new one tomorrow.', LATE = 'Today’s new puzzle is on Home.';
  var BAND = 120, BAND_MAX = 1600; /* as the app's rated sets (ratedPick): within 120, widening 120 at a time */

  /* The local day, as the app's prof.days keys (dkey): month 1-based, no padding. A new key at local midnight. */
  function key(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  /* A day key as a number that sorts as dates do (2026-12-1 after 2026-11-30). 0 for anything else. */
  function dayNum(k) { var m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(k || ''); return m ? +m[1] * 10000 + +m[2] * 100 + +m[3] : 0; }
  /* Fix 3c: ms from d to the next local midnight (the Home card turns over then). */
  function untilMidnight(d) { var n = new Date(d.getTime()); n.setHours(24, 0, 0, 0); return n.getTime() - d.getTime(); }

  /* A small stable hash of the day's key: the same day gives the same pick (no randomness to store or test around). */
  function hash(s) { var h = 2166136261; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rec(puz, id) { return puz && Object.prototype.hasOwnProperty.call(puz, id) ? puz[id] : null; }
  function solved(puz, id) { var r = rec(puz, id); return !!(r && r.ok > 0); }
  function tried(puz, id) { var r = rec(puz, id); return !!(r && (r.n > 0 || r.ok > 0)); }

  /* DP-D2: one puzzle near the puzzle rating, unsolved ones first, never a hand-made (course) puzzle, never `avoid`
     (yesterday's). Fix 2: never-tried ones before missed ones, so the daily is not also in the missed-review list.
     The nearest band that has any wins, tier by tier: never tried, then unsolved, then (all solved) any. */
  function pick(bank, rating, puz, day, avoid) {
    var all = (bank || []).filter(function (p) { return p && !p.hand && p.id !== avoid; });
    if (!all.length) all = (bank || []).filter(function (p) { return p && !p.hand; }); /* a bank of one: it may repeat */
    if (!all.length) return null;
    all.sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    var r = +rating || 0;
    function near(list) {
      for (var band = BAND; band < BAND_MAX + BAND; band += BAND) {
        var pool = list.filter(function (p) { return Math.abs(p.rating - r) <= band; });
        if (pool.length) return pool;
      }
      return list;
    }
    var fresh = all.filter(function (p) { return !tried(puz, p.id); }), open = all.filter(function (p) { return !solved(puz, p.id); });
    var pool = near(fresh.length ? fresh : open.length ? open : all);
    return pool[hash(String(day)) % pool.length];
  }

  function blank() { return { d: null, id: null, r: null, n: 0 }; }
  function has(bank, id) { return (bank || []).some(function (p) { return p && p.id === id && !p.hand; }); }

  /* AC2: today's record. The stored one while it is today's (and its puzzle is still in the bank, or it already has a
     result); otherwise a new pick for today, with the count of finished daily puzzles kept. Fix 2: a pick that was solved
     somewhere else before the daily was tried is picked again (it would count twice). */
  function today(rec, day, bank, rating, puz) {
    var o = rec && typeof rec === 'object' ? rec : blank();
    if (o.d === day && o.id && (o.r || (has(bank, o.id) && !solved(puz, o.id)))) return rec;
    var p = pick(bank, rating, puz, day, o.id);
    return { d: day, id: p ? p.id : null, r: null, n: +o.n || 0 };
  }

  /* AC4: 'todo' | 'solved' | 'missed'. A result is today's only. */
  function state(rec, day) {
    if (!rec || rec.d !== day) return 'todo';
    return rec.r === 'solved' || rec.r === 'missed' ? rec.r : 'todo';
  }

  /* DP-D6: one try per day. dealt: the day the puzzle was dealt (DP-D12: it counts for that day, even when it is finished
     after midnight). The first result for that day's puzzle is kept on its record. If Home already moved the record on to
     a newer day, only n goes up (the new day stays to do). Anything else returns rec unchanged.
     n counts finished daily puzzles (slice D2 shows Rani's reminder offer after the first one). */
  function record(rec, dealt, id, ok) {
    if (!rec) return rec;
    if (rec.d === dealt) return rec.id !== id || rec.r ? rec : { d: rec.d, id: rec.id, r: ok ? 'solved' : 'missed', n: (+rec.n || 0) + 1 };
    if (dayNum(dealt) && dayNum(dealt) < dayNum(rec.d)) return { d: rec.d, id: rec.id, r: rec.r, n: (+rec.n || 0) + 1 };
    return rec;
  }
  /* The end card's line: the result, then "A new one tomorrow." or, finished after midnight (late), DP-D12's line. */
  function endLine(ok, late) { return RESULT[ok ? 'solved' : 'missed'] + ' ' + (late ? LATE : TOMORROW); }

  /* DP-D1, AC1: every Home but Beginner Home; Beginner Home only once Foundations is done ('beat', 'practice'). */
  function shows(plainHome, homeKind) { return !plainHome || homeKind === 'beat' || homeKind === 'practice'; }

  function lines(s) {
    var k = LINE[s] ? s : 'todo';
    return { kicker: KICKER, title: TITLE, line: LINE[k], button: k === 'todo' ? 'Solve it' : null };
  }

  return { key: key, dayNum: dayNum, untilMidnight: untilMidnight, endLine: endLine, pick: pick, today: today, state: state, record: record, shows: shows, lines: lines, blank: blank };
});
