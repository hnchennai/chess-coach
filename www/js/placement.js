/* ---------- Placement: the first-launch level check (Rani, up to 8 puzzles, skippable). Offline, no AI. ---------- */
(function (root, factory) {
  var P = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = P; else root.Placement = P;
})(typeof window !== 'undefined' ? window : this, function (root) {
  'use strict';
  var Profile = root.Profile || (typeof require === 'function' ? require('./profile.js') : null);

  /* ----- puzzle choice (pure) ----- */
  var BASE = ['hanging', 'mateIn1', 'fork'], MORE = BASE.concat(['pin', 'skewer', 'mateIn2']);
  var BANDS = { knows: { min: 500, max: 1100, themes: BASE }, often: { min: 700, max: 1700, themes: MORE }, club: { min: 1500, max: 1800, themes: MORE } };
  function hash(s) { var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rng(seed) { var a = hash(seed); return function () { a = (a + 0x6D2B79F5) | 0; var t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
  function norm(p, i) { return { id: 'm' + (p.i != null ? p.i : i), fen: p.f, sol: String(p.s).split(' '), themes: String(p.t).split(','), rating: p.r }; }
  /* kind: 'knows' | 'often' | 'club'. Easy to hard: one puzzle from each equal slice of the band, sorted by rating. */
  function pick(bank, kind, seed, avoid) {
    var B = BANDS[kind], n = Profile.puzzleCount(kind); if (!B || !n) return [];
    var skip = {}; (avoid || []).forEach(function (id) { skip[id] = 1; });
    var pool = (bank || []).map(norm).filter(function (p) {
      return !skip[p.id] && p.rating >= B.min && p.rating <= B.max && p.sol.length && p.themes.some(function (t) { return B.themes.indexOf(t) > -1; });
    }).sort(function (a, b) { return a.rating - b.rating || (a.id < b.id ? -1 : 1); });
    var r = rng(seed + ':' + kind), out = [];
    for (var k = 0; k < n && pool.length; k++) {
      var lo = Math.floor(k * pool.length / n), hi = Math.max(lo + 1, Math.floor((k + 1) * pool.length / n));
      var slice = pool.slice(lo, hi).filter(function (p) { return out.indexOf(p) === -1; });
      if (!slice.length) slice = pool.filter(function (p) { return out.indexOf(p) === -1; });
      if (slice.length) out.push(slice[Math.floor(r() * slice.length)]);
    }
    return out.sort(function (a, b) { return a.rating - b.rating; });
  }
  function side(p) { return (p.fen.split(' ')[1] || 'w') === 'w' ? 'White' : 'Black'; }
  function ask(p) {
    var t = p.themes;
    if (t.indexOf('mateIn1') > -1) return 'Can you checkmate in one move?';
    if (t.indexOf('mateIn2') > -1) return 'Can you start a checkmate in two moves?';
    if (t.indexOf('fork') > -1) return 'Can you attack two pieces at once?';
    if (t.indexOf('hanging') > -1) return 'Can you win a piece for free?';
    return 'Can you find the move that wins something?';
  }
  /* First move only: the planned move, or any move that checkmates. */
  function isCorrect(p, uci, mates) { return !!mates || (!!uci && uci.slice(0, 4) === p.sol[0].slice(0, 4) && (uci[4] || 'q') === (p.sol[0][4] || 'q')); }

  /* ----- UI ----- */
  var host = null, el = null, S = null, prevFocus = null;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function an(level) { return level === 'improver' ? 'an Improver' : level === 'club' ? 'a Club player' : 'a Beginner'; }
  var X_ICON = '<svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6 L18 18 M18 6 L6 18"/></svg>';

  function open(h, opts) {
    host = h; opts = opts || {};
    el = document.getElementById('placement');
    if (!el || !Profile) return false;
    S = { retake: !!opts.retake, step: 'welcome', path: null, kind: null, items: [], i: 0, main: [], club: null, skipped: false, clubSkipped: false, res: null, choosing: false, chosen: null, attempt: opts.attempt || 0, seed: opts.seed || 'x' };
    prevFocus = document.activeElement;
    el.hidden = false; document.documentElement.classList.add('pl-open');
    draw();
    return true;
  }
  function isOpen() { return !!(el && !el.hidden); }
  function close() {
    if (!el) return;
    if (S && S.step === 'puzzle' && host) host.endBoard();
    el.hidden = true; el.innerHTML = ''; document.documentElement.classList.remove('pl-open'); S = null;
    if (prevFocus && prevFocus.focus && prevFocus.isConnected) try { prevFocus.focus(); } catch (e) {}
  }
  function focusFirst() { var f = el.querySelector('.pl-card'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }

  function draw() {
    if (!S) return;
    var h = '';
    if (S.step === 'welcome') {
      h = '<div class="pl-card pl-welcome" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="plTitle">' +
        (S.retake ? '<div class="pl-top"><span></span><button class="pl-x" type="button" data-pl="cancel" aria-label="Close">' + X_ICON + '</button></div>' : '') +
        '<div class="pl-hero">' + host.coach('happy', 112) + '</div>' +
        '<h2 id="plTitle" class="pl-h">Hi, I’m Rani</h2>' +
        '<p class="pl-lede">I’ll be your chess coach. Let’s find the right place for you to start.</p>' +
        '<p class="pl-q">Have you played chess before?</p>' +
        '<div class="pl-opts">' +
        opt('never', 'Never played', 'I’ll teach you from the very first move') +
        opt('knows', 'I know how the pieces move', '5 tiny puzzles, about a minute') +
        opt('often', 'I play often', '6 puzzles, easy to tricky') +
        '</div>' +
        '<button class="pl-link" type="button" data-pl="skip0">Skip, I’ll choose later</button></div>';
    } else if (S.step === 'puzzle') {
      var p = S.items[S.i], n = S.items.length, pct = Math.round(100 * S.i / n), fb = S.fb;
      h = '<div class="pl-card pl-puzzle" tabindex="-1" role="dialog" aria-modal="true" aria-label="Level check puzzle">' +
        '<div class="pl-top"><button class="pl-x" type="button" data-pl="skip" aria-label="Close and skip the check">' + X_ICON + '</button>' +
        '<div class="pl-prog"><span>' + (S.kind === 'club' ? 'Harder puzzle ' : '') + (S.i + 1) + ' of ' + n + '</span><i><b style="width:' + pct + '%"></b></i></div></div>' +
        '<div class="pl-bubble">' + host.coach(fb ? (fb.ok ? 'proud' : 'happy') : 'think', 46) + '<div class="bub" aria-live="polite"><b>' + esc(fb ? fb.title : 'You play ' + side(p) + '.') + '</b><span>' + esc(fb ? fb.text : ask(p)) + '</span></div></div>' +
        '<div class="pl-board" id="plBoard"></div>' +
        '<div class="pl-acts"><button class="btn" type="button" data-pl="unsure"' + (fb ? ' disabled' : '') + '>I’m not sure</button><button class="pl-link" type="button" data-pl="skip">Skip the check</button></div></div>';
    } else if (S.step === 'result') {
      var R = S.res, shown = S.chosen || R.level, total = S.main.length + (S.club ? S.club.length : 0), right = S.main.filter(Boolean).length + (S.club ? S.club.filter(Boolean).length : 0);
      h = '<div class="pl-card pl-result" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="plTitle">' +
        '<div class="pl-hero sm">' + host.coach(right >= 3 || !total ? 'proud' : 'happy', 84) + '</div>' +
        (total ? '<p class="pl-score">You solved ' + right + ' of ' + total + '.' + (right >= 3 ? ' Nice!' : '') + '</p>' : '') +
        '<h2 id="plTitle" class="pl-h">You’re starting as ' + an(shown) + '</h2>' +
        '<div class="pl-levels" role="' + (S.choosing ? 'radiogroup' : 'list') + '" aria-label="Levels">' + Profile.ORDER.map(function (id) {
          var L = Profile.LEVELS[id], me = id === shown;
          var inner = '<span class="pl-lv"><b>' + esc(L.name) + '</b><small>' + esc(L.who) + '</small></span>' + (me ? '<span class="pl-you">You</span>' : '');
          return S.choosing ? '<button class="pl-row' + (me ? ' on' : '') + '" type="button" role="radio" aria-checked="' + me + '" data-pl-level="' + id + '">' + inner + '</button>'
            : '<div class="pl-row' + (me ? ' on' : '') + '" role="listitem">' + inner + '</div>';
        }).join('') + '</div>' +
        '<p class="pl-note">' + (S.skipped || S.clubSkipped ? 'You can take the check again in Settings.' : 'You can change this any time in Settings.') + '</p>' +
        '<button class="btn primary big pl-start" type="button" data-pl="start">Start</button>' +
        (R.offerClub && !S.club && !S.choosing ? '<button class="btn big pl-club" type="button" data-pl="club">Try Club?</button>' : '') +
        (S.choosing ? '' : '<button class="pl-link" type="button" data-pl="choose">Choose a different level</button>') + '</div>';
    }
    el.innerHTML = h;
    if (S.step === 'puzzle') host.mountBoard(document.getElementById('plBoard'));
    focusFirst();
  }
  function opt(id, title, sub) {
    return '<button class="pl-opt" type="button" data-pl-path="' + id + '"><b>' + esc(title) + '</b><small>' + esc(sub) + '</small></button>';
  }

  function startPuzzles(kind) {
    var avoid = S.items.map(function (p) { return p.id; });
    S.kind = kind; S.items = pick(host.bank(), kind, S.seed + ':' + S.attempt, avoid); S.i = 0; S.fb = null;
    if (kind === 'club') S.club = [];
    if (!S.items.length) return finishRound();
    S.step = 'puzzle'; draw(); showPuzzle();
  }
  function showPuzzle() {
    var p = S.items[S.i], my = S;
    host.showPuzzle(p, function (uci, mates) { if (S === my) answer(isCorrect(p, uci, mates)); });
  }
  function answer(ok) {
    if (!S || S.fb) return;
    (S.kind === 'club' ? S.club : S.main).push(!!ok);
    S.fb = ok ? { ok: true, title: 'Yes, well spotted!', text: '' } : { ok: false, title: 'Good try.', text: 'On to the next one.' };
    draw();
    var my = S;
    setTimeout(function () { if (S === my) next(); }, ok ? 800 : 1000);
  }
  function next() {
    S.fb = null; S.i++;
    if (S.i < S.items.length) { draw(); showPuzzle(); return; }
    finishRound();
  }
  function finishRound() {
    host.endBoard();
    S.res = Profile.scoreLevel(S.path, { main: S.main, skipped: S.skipped, club: S.club, clubSkipped: S.clubSkipped }, { units: host.units() });
    S.step = 'result'; S.choosing = false; S.chosen = null; draw();
  }
  function done(placed) {
    var R = S.res, lv = S.chosen || R.level, chosen = S.chosen && S.chosen !== R.level;
    var out = { level: lv, start: chosen ? Profile.startUnit(lv, R.knowsMoves, host.units()) : R.start, placed: chosen ? 'chosen' : placed || 'check', path: S.path, right: R.right, total: R.total, retake: S.retake };
    close(); host.finish(out);
  }

  function onClick(e) {
    if (!S) return;
    var b = e.target.closest('button'); if (!b || !el.contains(b)) return;
    var d = b.dataset;
    if (d.plPath) {
      S.path = d.plPath;
      if (S.path === 'never') { S.res = Profile.scoreLevel('never', [], { units: host.units() }); S.step = 'result'; draw(); return; }
      startPuzzles(S.path);
      return;
    }
    if (d.plLevel) { S.chosen = d.plLevel; draw(); var on = el.querySelector('[data-pl-level="' + d.plLevel + '"]'); if (on) on.focus(); return; }
    switch (d.pl) {
      case 'cancel': close(); if (host.cancel) host.cancel(); return;
      case 'skip0': S.path = 'skip'; S.res = Profile.scoreLevel('skip', [], { units: host.units() }); var r = S.res; close(); host.finish({ level: r.level, start: r.start, placed: 'check', path: 'skip', right: 0, total: 0, skippedFirst: true, retake: false }); return;
      case 'unsure': answer(false); return;
      case 'skip': if (S.kind === 'club') S.clubSkipped = true; else S.skipped = true; finishRound(); return;
      case 'club': startPuzzles('club'); return;
      case 'choose': S.choosing = true; S.chosen = S.chosen || S.res.level; draw(); return;
      case 'start': done(); return;
    }
  }
  function onKey(e) {
    if (!isOpen() || !S) return;
    if (e.key === 'Escape') {
      if (S.step === 'puzzle') { e.preventDefault(); if (S.kind === 'club') S.clubSkipped = true; else S.skipped = true; finishRound(); }
      else if (S.step === 'welcome' && S.retake) { e.preventDefault(); close(); if (host.cancel) host.cancel(); }
      return;
    }
    if (e.key === 'Tab') {
      var f = Array.prototype.filter.call(el.querySelectorAll('button:not([disabled]), [tabindex="0"]'), function (x) { return x.offsetParent !== null; });
      if (!f.length) return;
      var first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  }
  if (typeof document !== 'undefined') {
    document.addEventListener('click', function (e) { if (el && el.contains(e.target)) onClick(e); });
    document.addEventListener('keydown', onKey);
  }

  /* Test hook (e2e only reads state; it never changes progress). */
  function peek() { if (!S) return null; var p = S.step === 'puzzle' ? S.items[S.i] : null; return { step: S.step, path: S.path, kind: S.kind, i: S.i, n: S.items.length, fen: p && p.fen, sol: p && p.sol[0], res: S.res, chosen: S.chosen }; }

  return { pick: pick, ask: ask, isCorrect: isCorrect, BANDS: BANDS, open: open, close: close, isOpen: isOpen, peek: peek };
});
