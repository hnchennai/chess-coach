/* ---------- Profile: player level, data shape (v5), migrate and merge. Pure: no DOM, no network. ---------- */
(function (root, factory) {
  var P = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = P; else root.Profile = P;
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';
  var V = 5;
  /* One table, used everywhere (product spec "Levels"). opp = index into the app's OPP list. */
  var LEVELS = {
    beginner: { id: 'beginner', name: 'Beginner', min: 0, max: 800, rating: 600, opp: 1, courseLevel: 1, who: 'Never played, or know little more than the moves.' },
    improver: { id: 'improver', name: 'Improver', min: 800, max: 1200, rating: 1000, opp: 3, courseLevel: 2, who: 'Know the rules and play casually.' },
    club: { id: 'club', name: 'Club', min: 1200, max: Infinity, rating: 1300, opp: 4, courseLevel: 3, who: 'Play often and know tactics.' }
  };
  var ORDER = ['beginner', 'improver', 'club'];
  /* Puzzles per path in the level check. */
  var COUNT = { never: 0, skip: 0, knows: 5, often: 6, club: 2 };
  /* Used only when no course list is passed or injected (ids match course.js + roadmap.js). */
  var FALLBACK_START = { rules: 'rules', board: 'board', improver: 'fork', club: 'kq' };

  function courseUnits(units) { return units || (root && root.COURSE && root.COURSE.UNITS) || null; }
  function clone(x) { return x == null ? x : JSON.parse(JSON.stringify(x)); }
  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function hasProgress(p) {
    if ((p.games || []).length || (p.reviewed || []).length || (p.rn || 0) > 0) return true;
    if (isObj(p.puz) && Object.keys(p.puz).length) return true;
    var c = isObj(p.course) ? p.course : {};
    return Object.keys(c).some(function (id) { var u = c[id]; return isObj(u) && Object.keys(u).some(function (k) { return !!u[k]; }); });
  }

  function levelFromRating(r) { r = +r || 0; return r < LEVELS.beginner.max ? 'beginner' : r < LEVELS.improver.max ? 'improver' : 'club'; }

  function startUnit(level, knowsMoves, units) {
    if (level === 'beginner') return knowsMoves ? FALLBACK_START.board : FALLBACK_START.rules;
    var L = LEVELS[level]; if (!L) return null;
    var us = courseUnits(units);
    if (us) for (var i = 0; i < us.length; i++) if (us[i].level === L.courseLevel) return us[i].id;
    return FALLBACK_START[level];
  }

  function puzzleCount(path) { return COUNT[path] || 0; }

  /* Product AC3 + AC4. path: 'never' | 'skip' (skip at the first question) | 'knows' | 'often'.
     r: array of booleans (main puzzles, in order) or { main, skipped, club, clubSkipped }. */
  function scoreLevel(path, r, opts) {
    r = Array.isArray(r) ? { main: r } : (r || {});
    var units = opts && opts.units, main = r.main || [], right = main.filter(Boolean).length, level, offerClub = false;
    if (path === 'never') return { level: 'beginner', start: startUnit('beginner', false, units), knowsMoves: false, offerClub: false, right: 0, total: 0 };
    if (path === 'skip') return { level: 'beginner', start: startUnit('beginner', true, units), knowsMoves: true, offerClub: false, right: 0, total: 0 };
    if (r.skipped) level = right >= 3 ? 'improver' : 'beginner';
    else if (path === 'often') level = right >= 5 ? 'club' : right >= 3 ? 'improver' : 'beginner';
    else {
      level = right >= 3 ? 'improver' : 'beginner';
      offerClub = right === COUNT.knows && main.length === COUNT.knows;
      if (offerClub && r.club) {
        var clubRight = r.club.filter(Boolean).length;
        if (clubRight >= 1) level = 'club';
      }
    }
    return { level: level, start: startUnit(level, true, units), knowsMoves: true, offerClub: offerClub, right: right, total: main.length };
  }

  function blank() {
    return { v: V, games: [], puz: {}, rating: 800, rn: 0, course: {}, days: {}, reviewed: [], t: 0, theme: null,
      level: null, levelT: 0, placed: null, start: null, showAll: false, unlockAll: false, provisional: false, pgsDeclined: false, levelOfferT: 0 };
  }

  /* Any saved shape -> v5. Never drops a field it does not know. null stays null (nothing saved). */
  function migrate(p) {
    if (!p || typeof p !== 'object') return null;
    var o = blank(), src = clone(p);
    Object.keys(src).forEach(function (k) { if (src[k] !== undefined) o[k] = src[k]; });
    o.games = Array.isArray(o.games) ? o.games : []; o.reviewed = Array.isArray(o.reviewed) ? o.reviewed : [];
    o.puz = isObj(o.puz) ? o.puz : {}; o.course = isObj(o.course) ? o.course : {}; o.days = isObj(o.days) ? o.days : {};
    o.rating = +o.rating || 800; o.rn = +o.rn || 0; o.t = +o.t || 0; o.theme = o.theme || null;
    o.showAll = !!o.showAll; o.unlockAll = !!o.unlockAll; o.provisional = !!o.provisional; o.pgsDeclined = !!o.pgsDeclined;
    o.levelT = +o.levelT || 0; o.levelOfferT = +o.levelOfferT || 0;
    if (!LEVELS[o.level]) o.level = null;
    if ((+p.v || 0) < V && !o.level && hasProgress(o)) {
      o.level = levelFromRating(o.rating); o.levelT = 0; o.placed = 'derived'; o.start = 'rules'; o.unlockAll = true; o.provisional = false;
    }
    o.v = Math.max(+p.v || 0, V);
    return o;
  }

  function needsCheck(p) { return !p || !p.level; }

  /* Sets a level (check result, Settings or result-screen choice). Never marks or clears a lesson. */
  function setLevel(p, level, opts) {
    opts = opts || {};
    var o = migrate(p || {});
    if (!LEVELS[level]) return o;
    o.level = level; o.levelT = opts.now != null ? opts.now : Date.now(); o.placed = opts.placed || 'chosen';
    o.start = opts.start || startUnit(level, !!opts.knowsMoves, opts.units);
    o.provisional = !!opts.provisional;
    if (!o.rn) o.rating = LEVELS[level].rating;
    return o;
  }

  function partsOf(u) { var p = ['learn']; if (u.practice) p.push('practice'); if (u.apply) p.push('apply'); return p; }
  function defaultDone(p) { return function (u) { var c = (p.course || {})[u.id] || {}; return partsOf(u).every(function (k) { return !!c[k]; }); }; }
  function startIndex(p, us) { if (!p || !p.start) return 0; for (var i = 0; i < us.length; i++) if (us[i].id === p.start) return i; return 0; }

  /* First unfinished unit at or after the start point. */
  function nextUnit(p, units, unitDone) {
    var us = courseUnits(units) || [], done = unitDone || defaultDone(p);
    for (var i = startIndex(p, us); i < us.length; i++) if (!done(us[i])) return us[i];
    return null;
  }

  /* Beginner tab unlock: 3 fully done units at or after start, or unlockAll, or showAll. */
  function unlockDone(p, units, unitDone) {
    if (!p) return false;
    if (p.unlockAll || p.showAll) return true;
    var us = courseUnits(units) || [], done = unitDone || defaultDone(p), n = 0;
    for (var i = startIndex(p, us); i < us.length; i++) if (done(us[i])) n++;
    return n >= 3;
  }

  /* Level-up offer (D13, D20): Beginner or Improver, and every unit of their course level at or after the start point is fully done.
     Club is never complete. A level with no units after the start point is not complete (nothing to offer on). */
  function levelComplete(p, units, unitDone) {
    if (!p || (p.level !== 'beginner' && p.level !== 'improver')) return false;
    var us = courseUnits(units) || [], done = unitDone || defaultDone(p), cl = LEVELS[p.level].courseLevel, n = 0;
    for (var i = startIndex(p, us); i < us.length; i++) {
      if (us[i].level !== cl) continue;
      n++; if (!done(us[i])) return false;
    }
    return n > 0;
  }
  /* R2-8: when the level was completed: the latest part time among the counted units (markUnit stores Date.now()); 0 if not complete. */
  function levelDoneAt(p, units, unitDone) {
    if (!levelComplete(p, units, unitDone)) return 0;
    var us = courseUnits(units) || [], cl = LEVELS[p.level].courseLevel, t = 0;
    for (var i = startIndex(p, us); i < us.length; i++) {
      if (us[i].level !== cl) continue;
      var c = (p.course || {})[us[i].id] || {};
      partsOf(us[i]).forEach(function (k) { t = Math.max(t, +c[k] || 0); });
    }
    return t;
  }
  /* The level was completed after the last offer answer and the last level change: offer at the next settled start,
     even if the session that completed it ended before the offer could show. */
  function lessonOfferDue(p, units, unitDone) {
    var t = levelDoneAt(p, units, unitDone);
    return t > 0 && t > Math.max(+p.levelOfferT || 0, +p.levelT || 0);
  }
  var WEEK = 7 * 86400000;
  /* D21: at app start, offer again once 7 days have passed since "Not yet" or since the last level change. */
  function offerDue(p, now, units, unitDone) {
    if (!levelComplete(p, units, unitDone)) return false;
    return (+now || 0) - Math.max(+p.levelOfferT || 0, +p.levelT || 0) >= WEEK;
  }

  /* Merge two copies (device + cloud). Unions never remove; see tech spec "merge()". Inputs are not changed. */
  function merge(local, cloud) {
    var a = migrate(local) || blank();
    var b = migrate(cloud);
    if (!b) return a;
    var o = clone(a), byId = {};
    Object.keys(b).forEach(function (k) { if (!(k in o)) o[k] = clone(b[k]); });
    a.games.concat(b.games).forEach(function (g) { if (isObj(g) && g.id != null && !byId[g.id]) byId[g.id] = g; });
    o.games = Object.keys(byId).map(function (k) { return byId[k]; }).sort(function (x, y) { return (y.d || 0) - (x.d || 0); }).slice(0, 30);
    Object.keys(o.puz).forEach(function (id) { if (!isObj(o.puz[id])) delete o.puz[id]; });
    Object.keys(b.puz).forEach(function (id) { var x = o.puz[id], y = b.puz[id]; if (isObj(y) && (!x || (+y.n || 0) > (+x.n || 0))) o.puz[id] = clone(y); });
    Object.keys(o.course).forEach(function (id) { if (!isObj(o.course[id])) delete o.course[id]; });
    Object.keys(b.course).forEach(function (id) { var y = b.course[id]; if (!isObj(y)) return; var x = o.course[id] || (o.course[id] = {}); Object.keys(y).forEach(function (k) { if (!x[k]) x[k] = y[k]; }); });
    Object.keys(o.days).forEach(function (k) { if (!isObj(o.days[k])) delete o.days[k]; });
    Object.keys(b.days).forEach(function (k) { var x = o.days[k], y = b.days[k]; if (!isObj(y)) return; if (!x) o.days[k] = clone(y); else Object.keys(y).forEach(function (f) { x[f] = Math.max(+x[f] || 0, +y[f] || 0); }); });
    o.reviewed = o.reviewed.filter(function (r) { return r != null; });
    b.reviewed.forEach(function (r) { if (r != null && o.reviewed.indexOf(r) === -1) o.reviewed.push(r); });
    var bNewer = (b.t || 0) > (a.t || 0);
    if (b.rn > a.rn || (b.rn === a.rn && bNewer)) { o.rating = b.rating; o.rn = b.rn; }
    if (bNewer) { o.showAll = b.showAll; if (b.theme) o.theme = b.theme; }
    if (!o.theme && b.theme) o.theme = b.theme;
    var takeCloud = false;
    if (b.level) {
      if (!a.level) takeCloud = true;
      else if (a.provisional && b.placed !== 'derived') takeCloud = true;
      else if (b.levelT > a.levelT) takeCloud = true;
    }
    if (takeCloud) { o.level = b.level; o.levelT = b.levelT; o.placed = b.placed; o.start = b.start; }
    /* Sync safety: a derived (v4) copy's unlockAll does not override a local non-derived level. */
    var bUnlock = b.unlockAll && !(b.placed === 'derived' && a.level && a.placed !== 'derived');
    o.unlockAll = !!(a.unlockAll || bUnlock);
    o.levelOfferT = Math.max(a.levelOfferT, b.levelOfferT);
    o.pgsDeclined = a.pgsDeclined;
    o.provisional = false;
    o.t = Math.max(a.t || 0, b.t || 0);
    o.v = Math.max(a.v, b.v, V);
    return o;
  }

  return { V: V, LEVELS: LEVELS, ORDER: ORDER, levelFromRating: levelFromRating, startUnit: startUnit, puzzleCount: puzzleCount, scoreLevel: scoreLevel,
    migrate: migrate, needsCheck: needsCheck, setLevel: setLevel, nextUnit: nextUnit, unlockDone: unlockDone, levelComplete: levelComplete, offerDue: offerDue, levelDoneAt: levelDoneAt, lessonOfferDue: lessonOfferDue, merge: merge, blank: blank };
});
