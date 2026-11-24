/* ---------- Chess Coach v4: course + coach ---------- */
(function () {
  'use strict';
  var G = new Chess();
  var MATE = 100000, MW = MATE - 500;
  var GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' }, VS = '︎';
  var PNAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };
  var VAL = Tac.VAL, FILES = 'abcdefgh';
  var attackersOf = Tac.attackersOf, piecesOf = Tac.piecesOf, targetsOf = Tac.targetsOf, hanging = Tac.hanging, sqOf = Tac.sqOf, fr = Tac.fr;
  var OPP = [null,
    { name: 'Beginner', elo: 400 }, { name: 'Casual', elo: 700 }, { name: 'Improver', elo: 1000 }, { name: 'Club', elo: 1320 },
    { name: 'Strong club', elo: 1600 }, { name: 'Expert', elo: 2000 }, { name: 'Master', elo: 2500 }, { name: 'Stockfish', elo: 3000 }];
  var CLS = {
    best: { sym: '!', title: 'Best move', acc: 100 }, good: { sym: '✓', title: 'Good move', acc: 90 },
    inacc: { sym: '?!', title: 'Inaccuracy', acc: 60 }, mist: { sym: '?', title: 'Mistake', acc: 30 }, blund: { sym: '??', title: 'Blunder', acc: 0 }
  };
  var THEMES = {
    hanging: 'Free pieces', mateIn1: 'Mate in 1', mateIn2: 'Mate in 2', mateIn3: 'Mate in 3', fork: 'Forks', pin: 'Pins', skewer: 'Skewers',
    discovered: 'Discovered attacks', discoveredCheck: 'Discovered check', backRank: 'Back-rank mate', sacrifice: 'Sacrifices', promotion: 'Promotion', advantage: 'Win material'
  };
  var STORE = 'suresh-chess-coach.v1', PSTORE = 'suresh-chess-coach.profile.v1', DAY = 86400000;
  var UNITS = COURSE.UNITS, UNIT = {}; UNITS.forEach(function (u) { UNIT[u.id] = u; });

  /* ---------- puzzle bank ---------- */
  var PZ = [], PZ_BY = {};
  (window.PUZZLE_BANK || []).forEach(function (p, i) {
    var o = { id: 'm' + (p.i != null ? p.i : i), fen: p.f, sol: p.s.split(' '), themes: p.t.split(','), rating: p.r, pre: p.p || null, last: p.l || null, preBest: p.b || null };
    PZ.push(o);
  });
  COURSE.PUZ.forEach(function (p) { var o = JSON.parse(JSON.stringify(p)); o.hand = true; PZ.push(o); });
  PZ.forEach(function (p) { PZ_BY[p.id] = p; });

  /* ---------- state ---------- */
  var st = {
    theme: 'classic', mode: 'play', tab: 'path', user: 'w', level: 2, gf: false, af: false,
    ann: {}, notes: {}, tags: {}, sel: null, arrows: [], hls: [], hintLvl: 0,
    gb: false, ab: false, evalW: 0, fb: null, opp: null, think: null, over: false,
    recorded: false, t: 0, goal: null, rv: null, pz: null, ses: null, ls: null, dr: null, bk: null, sq: null, qz: null, unitOpen: null, confirmNew: false, nm: null,
    scr: 'tabs', rvFrom: null, /* G2a: 'tabs' (a tab page) or 'act' (the board screen); memory only, never stored. Wide screens ignore it. */
    park: { learn: null, train: null }, /* G2b: what waits on Learn and on Train while something else is on the board (Flow entries) */
    unseen: false, fbPre: null /* fix round 1: the game ended while it was not on screen (G-D36, saved with the game); the game's coach line before its first hint */
  };
  /* G2b: two things can be waiting for the engine at once: the game (st.gb: its move check and the engine's reply go on while
     the game is closed) and the lesson, set or drill on the board (st.ab). st.busy is the one the board on screen cares about,
     so a game's late reply never freezes a puzzle, and a puzzle's never freezes the game. */
  Object.defineProperty(st, 'busy', { enumerable: true,
    get: function () { return st.mode === 'play' ? st.gb : st.ab; },
    set: function (v) { if (st.mode === 'play') st.gb = !!v; else st.ab = !!v; } });
  /* Fix round 1: the same for Flip. The game keeps its own (st.gf, saved with the game); a lesson, set, drill or the level check
     uses another (st.af), so the game comes back the way the player turned it. A review shows the game's side. */
  Object.defineProperty(st, 'flipped', { enumerable: true,
    get: function () { return st.mode === 'play' || st.mode === 'review' ? st.gf : st.af; },
    set: function (v) { if (st.mode === 'play' || st.mode === 'review') st.gf = !!v; else st.af = !!v; } });
  var boardId = 0; /* goes up whenever the board changes hands (clearSession): a late reply for the old one finds a new number */
  var prof = Profile.blank();
  var $ = function (id) { return document.getElementById(id); };
  /* Beginner interface (S2a): no ratings, eval, notation or opponent picker, unless "Show everything" is on. */
  function plain() { return prof.level === 'beginner' && !prof.showAll; }
  function partnerName() { return Words.PARTNER; }
  /* D23: Beginners never read "Stockfish" or "the engine": the opponent is Rani’s partner and the analysis is Rani ("I").
     Applied where text is shown, so notes saved before a level change read right too. Improver and Club are unchanged. */
  var PLAIN_WORDS = [
    ['Exactly what Stockfish would play.', 'Exactly the move I’d play.'],
    ['Stockfish slightly preferred ', 'I slightly preferred '],
    ['This is Stockfish’s top choice here.', 'This is the best move here.'],
    ['The engine wins this one.', 'Rani’s partner wins this one.'],
    ['Engine to move', 'Rani’s partner to move'],
    ['Great finish. Review it, then try a stronger opponent.', 'Great finish. Review it.'],
    ['Stuck? Hint shows Stockfish’s idea.', 'Stuck? Hint shows my idea.'],
    [' moves against Stockfish.', ' moves against Rani’s partner.'],
    ['pieces left where the engine could take them', 'pieces left where Rani’s partner could take them'],
    ['The engine has found mating attacks against you.', 'Rani’s partner has found mating attacks against you.']
  ];
  function speak(s) { s = s == null ? '' : String(s); if (!plain()) return s; PLAIN_WORDS.forEach(function (p) { s = s.split(p[0]).join(p[1]); }); return s; }
  var gridEl = $('grid'), sqEls = {};

  /* ---------- helpers ---------- */
  function keyOf(m) { return m.from + m.to + (m.promotion || ''); }
  function uciEq(a, b) { return !!(a && b) && a.slice(0, 4) === b.slice(0, 4) && (a[4] || 'q') === (b[4] || 'q'); }
  function findMove(g, key) { if (!key) return null; var ms = g.moves({ verbose: true }); for (var i = 0; i < ms.length; i++) if (uciEq(keyOf(ms[i]), key)) return ms[i]; return null; }
  function opp(c) { return c === 'w' ? 'b' : 'w'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function mono(s) { return '<span class="mono">' + esc(s) + '</span>'; }
  /* ---------- visual moves: a piece icon + square, tap to see it on the board ---------- */
  var START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  function mvc(m, fen) {
    if (!m || !m.san) return '';
    var c = m.color || (fen ? fen.split(' ')[1] : 'w');
    var dest = /O-O-O/.test(m.san) ? 'castles long' : /O-O/.test(m.san) ? 'castles' : (m.captured ? '\u00D7' : '') + m.to + (m.promotion ? '=' + m.promotion.toUpperCase() : '');
    var sfx = m.san.indexOf('#') > -1 ? '#' : m.san.indexOf('+') > -1 ? '+' : '';
    var lab = (c === 'w' ? 'White ' : 'Black ') + PNAME[m.piece] + (m.captured ? ' takes on ' : ' to ') + m.to;
    return '<button type="button" class="mvc" data-from="' + m.from + '" data-to="' + m.to + '" data-p="' + m.piece + '" data-c="' + c + '" data-san="' + esc(m.san) + '" data-lab="' + esc(lab) + '"' + (fen ? ' data-fen="' + esc(fen) + '"' : '') + ' title="' + esc(m.san + ': ' + lab + '. Tap to see it on the board.') + '" aria-label="' + esc(lab + ' (' + m.san + ')') + '"><span class="mvi"></span><span class="mvt">' + esc(dest + sfx) + '</span></button>';
  }
  function mvcSan(fen, san) { var g = new Chess(fen), m = g.move(san); return m ? mvc(m, fen) : mono(san); }
  function mline(fen, pv, n) {
    var g = new Chess(), out = [], ucis = []; if (!g.load(fen)) return '';
    for (var i = 0; i < Math.min(n, pv.length); i++) { var f = g.fen(), m = findMove(g, pv[i]); if (!m) break; var mm = g.move(m); out.push(mvc(mm, f)); ucis.push(pv[i]); }
    if (!out.length) return '';
    return '<span class="mline">' + out.join('<span class="mvs" aria-hidden="true">\u203A</span>') + '<button type="button" class="mvplay" data-fen="' + esc(fen) + '" data-pv="' + ucis.join(' ') + '">\u25B6 Watch</button></span>';
  }
  function figs(s) {
    return String(s).replace(/(^|[^\w-])(O-O-O|O-O|[KQRBN]?[a-h]?[1-8]?x?[a-h][1-8](?:=[QRBN])?)([+#]?)(?![\w-])/g, function (all, pre, core, sfx) {
      var shown = core.replace(/^([KQRBN])/, function (p) { return '<span class="fig">' + GLYPH[p.toLowerCase()] + VS + '</span>'; });
      return pre + '<span class="san" tabindex="0" data-san="' + core + sfx + '">' + shown + sfx + '</span>';
    });
  }
  /* ---------- notation decoder: explains any move like Nxb6+ ---------- */
  var PN = { k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' };
  function decodeSan(san) {
    var sfx = /#$/.test(san) ? '#' : /\+$/.test(san) ? '+' : '', core = san.replace(/[+#]$/, ''), parts = [], title, to = null, piece = 'p';
    if (/^O-O-O$/.test(core)) { piece = 'k'; title = 'Castles queenside (the long side)'; parts.push(['O-O-O', 'Three O’s: the king moves two squares toward the a-file rook, and that rook jumps over to the king’s other side.']); }
    else if (/^O-O$/.test(core)) { piece = 'k'; title = 'Castles kingside (the short side)'; parts.push(['O-O', 'Two O’s: the king moves two squares toward the h-file rook, and that rook jumps over to f1 (or f8).']); }
    else {
      var m = /^([KQRBN])?([a-h])?([1-8])?(x)?([a-h][1-8])(?:=([QRBN]))?$/.exec(core);
      if (!m) return null;
      piece = m[1] ? m[1].toLowerCase() : 'p'; to = m[5];
      if (m[1]) parts.push([m[1], 'Capital letter = the piece: ' + { K: 'King', Q: 'Queen', R: 'Rook', B: 'Bishop', N: 'Knight (N, because K is the king)' }[m[1]] + '.']);
      else parts.push([m[2] && m[4] ? m[2] : '\u2013', m[2] && m[4] ? 'No capital letter = a pawn. The ' + m[2] + ' says it comes from the ' + m[2] + '-file (column).' : 'No capital letter = a pawn moves.']);
      if (m[1] && (m[2] || m[3])) parts.push([(m[2] || '') + (m[3] || ''), 'Two ' + PN[piece] + 's could go there, so this says which one: the one on the ' + (m[2] ? m[2] + '-file' : '') + (m[3] ? (m[2] ? ', ' : '') + 'rank ' + m[3] : '') + '.']);
      if (m[4]) parts.push(['x', 'x = takes (captures) the piece standing there.']);
      parts.push([m[5], 'The square it lands on: column ' + m[5][0] + ', row ' + m[5][1] + '.']);
      if (m[6]) parts.push(['=' + m[6], 'The pawn reached the last row and becomes a ' + PN[m[6].toLowerCase()] + '.']);
      title = (piece === 'p' ? 'Pawn' : PN[piece][0].toUpperCase() + PN[piece].slice(1)) + (m[4] ? ' takes on ' : ' to ') + m[5] + (m[6] ? ', becomes a ' + PN[m[6].toLowerCase()] : '');
    }
    if (sfx === '+') parts.push(['+', '+ = check: it attacks the king.']);
    if (sfx === '#') parts.push(['#', '# = checkmate: the king can’t escape. Game over.']);
    return { title: title, parts: parts, to: to, piece: piece };
  }
  function miniBoard(to, from) {
    var c = '', i, f, r;
    for (r = 7; r >= 0; r--) for (f = 0; f < 8; f++) {
      var sq = FILES[f] + (r + 1), dark = (f + r) % 2 === 0, onF = to && to[0] === FILES[f], onR = to && +to[1] === r + 1;
      c += '<rect x="' + (f * 10 + 10) + '" y="' + ((7 - r) * 10) + '" width="10" height="10" fill="' + (sq === to ? '#2f9e5b' : sq === from ? '#f2c94c' : dark ? '#b58863' : '#f0d9b5') + '"' + (sq !== to && sq !== from && (onF || onR) ? ' opacity=".6"' : '') + '/>';
    }
    for (i = 0; i < 8; i++) {
      c += '<text x="' + (i * 10 + 15) + '" y="89" font-size="7" text-anchor="middle" fill="currentColor"' + (to && to[0] === FILES[i] ? ' font-weight="700"' : ' opacity=".6"') + '>' + FILES[i] + '</text>';
      c += '<text x="5" y="' + ((7 - i) * 10 + 7.5) + '" font-size="7" text-anchor="middle" fill="currentColor"' + (to && +to[1] === i + 1 ? ' font-weight="700"' : ' opacity=".6"') + '>' + (i + 1) + '</text>';
    }
    if (from && to) { var a = fr(from), b = fr(to); c += '<line x1="' + (a[0] * 10 + 15) + '" y1="' + ((7 - a[1]) * 10 + 5) + '" x2="' + (b[0] * 10 + 15) + '" y2="' + ((7 - b[1]) * 10 + 5) + '" stroke="#1c4a78" stroke-width="2" stroke-linecap="round" opacity=".85"/>'; }
    return '<svg class="mini" viewBox="0 0 90 92" aria-hidden="true">' + c + '</svg>';
  }
  var tipEl = null, tipFor = null, tipSticky = false;
  function showTip(el, sticky) {
    if (plain() && el.classList.contains('mvc')) return; /* the "how to read it" tip is notation: Beginners only get the board preview */
    var san = el.dataset.san || (el.getAttribute('aria-label') || '').replace(/^.*\(([^)]+)\)$/, '$1'), D = decodeSan(san);
    if (!D) return;
    if (!tipEl) { tipEl = document.createElement('div'); tipEl.className = 'santip'; tipEl.setAttribute('role', 'tooltip'); document.body.appendChild(tipEl); }
    var c = el.dataset.c || (el.dataset.side) || 'w', ic = Avatar.piece(st.theme, c, D.piece);
    tipEl.innerHTML = '<div class="th"><span class="tic">' + (ic || '<span class="mvg ' + c + '">' + GLYPH[D.piece] + VS + '</span>') + '</span><div><small>How to read <b class="mono">' + esc(san) + '</b></small><b>' + esc(D.title) + '</b></div></div>' +
      '<div class="tb">' + (D.to ? miniBoard(D.to, el.dataset.from) : '') + '<ul>' + D.parts.map(function (p) { return '<li><code>' + esc(p[0]) + '</code><span>' + esc(p[1]) + '</span></li>'; }).join('') + '</ul></div>' +
      (sticky ? '<p class="tf">Tap anywhere to close.</p>' : '');
    tipEl.hidden = false; tipFor = el; tipSticky = !!sticky;
    var r = el.getBoundingClientRect(), w = Math.min(320, window.innerWidth - 16); tipEl.style.width = w + 'px';
    var h = tipEl.offsetHeight, x = Math.max(8, Math.min(window.innerWidth - w - 8, r.left + r.width / 2 - w / 2)), y = r.bottom + 8;
    if (y + h > window.innerHeight - 8 && r.top - h - 8 > 8) y = r.top - h - 8;
    tipEl.style.left = (x + window.scrollX) + 'px'; tipEl.style.top = (y + window.scrollY) + 'px';
  }
  function hideTip() { if (tipEl) tipEl.hidden = true; tipFor = null; tipSticky = false; }

  function cap1(s) { return s.charAt(0).toUpperCase() + s.slice(1); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function gameAt(sans, ply) { var g = new Chess(); for (var i = 0; i < ply && i < sans.length; i++) g.move(sans[i]); return g; }
  function flipFen(fen) { var p = fen.split(' '); p[1] = p[1] === 'w' ? 'b' : 'w'; p[3] = '-'; return p.join(' '); }
  function fullmove(g) { return +g.fen().split(' ')[5]; }
  function dkey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function dayRec() { var k = dkey(new Date()); if (!prof.days[k]) prof.days[k] = { puz: 0, games: 0, course: 0, solved: 0 }; return prof.days[k]; }
  function shuffle(a) { for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)), t = a[i]; a[i] = a[j]; a[j] = t; } return a; }
  function pvSan(fen, pv, n) { var g = new Chess(fen), out = []; for (var i = 0; i < Math.min(n, pv.length); i++) { var m = findMove(g, pv[i]); if (!m) break; g.move(m); out.push(m.san); } return out.join(' '); }
  function wait(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  /* ---------- position knowledge ---------- */
  function material(g) {
    var m = { w: 0, b: 0, npm: { w: 0, b: 0 }, q: 0 };
    g.board().forEach(function (row) { row.forEach(function (p) { if (!p || p.type === 'k') return; m[p.color] += VAL[p.type]; if (p.type !== 'p') m.npm[p.color] += VAL[p.type]; if (p.type === 'q') m.q++; }); });
    return m;
  }
  function devState(g, color) {
    var back = color === 'w' ? '1' : '8';
    var hist = g.history({ verbose: true }).filter(function (m) { return m.color === color; });
    function still(f, t) { var p = g.get(f + back); return p && p.type === t && p.color === color; }
    return {
      knights: !still('b', 'n') && !still('g', 'n'), bishops: !still('c', 'b') && !still('f', 'b'),
      center: hist.some(function (m) { return m.piece === 'p' && (m.from[0] === 'd' || m.from[0] === 'e'); }),
      castled: hist.some(function (m) { return m.flags.indexOf('k') > -1 || m.flags.indexOf('q') > -1; }),
      minors: ['b', 'g'].filter(function (f) { return !still(f, 'n'); }).length + ['c', 'f'].filter(function (f) { return !still(f, 'b'); }).length,
      moves: hist
    };
  }
  function phaseOf(g, color) {
    var m = material(g), fm = fullmove(g);
    if ((m.q === 0 && m.npm.w + m.npm.b <= 20) || (m.npm.w <= 13 && m.npm.b <= 13)) return 'endgame';
    return fm <= 12 && devState(g, color).minors < 4 ? 'opening' : 'middlegame';
  }
  function isPassed(g, sq, color) {
    var c = fr(sq), dir = color === 'w' ? 1 : -1;
    for (var f = c[0] - 1; f <= c[0] + 1; f++) { if (f < 0 || f > 7) continue; for (var r = c[1] + dir; r >= 0 && r < 8; r += dir) { var p = g.get(sqOf(f, r)); if (p && p.type === 'p' && p.color !== color) return false; } }
    return true;
  }
  function describe(m, who) {
    var r = [], san = m.san, back = m.color === 'w' ? '1' : '8';
    if (san.indexOf('#') > -1) return 'delivers checkmate';
    if (m.flags.indexOf('k') > -1 || m.flags.indexOf('q') > -1) r.push('castles ' + who + ' king to safety');
    else if (m.promotion) r.push('promotes a pawn to a queen');
    if (m.captured) r.push('takes the ' + PNAME[m.captured] + ' on ' + m.to);
    if (san.indexOf('+') > -1) r.push('gives check');
    if (!r.length) {
      if ((m.piece === 'n' || m.piece === 'b') && m.from[1] === back) r.push('develops ' + who + ' ' + PNAME[m.piece]);
      else if (m.piece === 'p' && ['d4', 'e4', 'd5', 'e5', 'c4', 'c5', 'f4', 'f5'].indexOf(m.to) > -1) r.push('claims space in the center');
      else if (m.piece === 'r' && m.from[1] === back && m.to[1] === back) r.push('brings a rook toward the middle');
      else if (m.piece === 'p') r.push('pushes a pawn forward');
      else if (m.piece === 'k') r.push('moves the king');
      else r.push('repositions ' + who + ' ' + PNAME[m.piece]);
    }
    return r.slice(0, 2).join(' and ');
  }

  /* threat: what the side not to move would play with a free move */
  function threatOf(g, userBest) {
    if (g.in_check() || g.game_over()) return Promise.resolve(null);
    var f = flipFen(g.fen()), g2 = new Chess();
    if (!g2.load(f)) return Promise.resolve(null);
    return Brain.analyse(f, { depth: 10, multipv: 1, fbDepth: 3, fbMs: 500 }).then(function (a) {
      var t = a[0]; if (!t) return null;
      var m = findMove(g2, t.uci); if (!m) return null;
      var base = userBest != null ? -userBest : 0;
      if (!(t.score > MW) && t.score - base < 150) return null;
      g2.move(m);
      return { san: m.san, from: m.from, to: m.to, captured: m.captured, piece: m.piece, color: m.color, mate: t.score > MW, mateNow: g2.in_checkmate() };
    }).catch(function () { return null; });
  }

  function explainEngineMove(gBefore, m, gAfter, userColor, th) {
    var why = [], used = {};
    var castle = m.flags.indexOf('k') > -1 || m.flags.indexOf('q') > -1;
    if (gAfter.in_checkmate()) return [{ c: 'threat', h: 'Checkmate. Your king is attacked and has no escape.' }];
    if (castle) why.push({ c: '', h: 'Castles. Its king goes to safety and a rook comes toward the center.' });
    else if (m.captured) {
      var defs = attackersOf(gBefore, m.to, userColor);
      if (!defs.length) why.push({ c: 'threat', h: 'Takes your ' + PNAME[m.captured] + ' on ' + m.to + '. Nothing was defending it, so it was free.' });
      else if (VAL[m.captured] > VAL[m.piece]) why.push({ c: 'threat', h: 'Wins material: gives a ' + PNAME[m.piece] + ' to take your ' + PNAME[m.captured] + ' on ' + m.to + '.' });
      else {
        var recap = gAfter.moves({ verbose: true }).filter(function (x) { return x.to === m.to && x.captured; });
        why.push({ c: '', h: 'Trades on ' + m.to + ': takes your ' + PNAME[m.captured] + '.' + (recap.length ? ' You can take back with ' + mvc(recap[0], gAfter.fen()) + '.' : '') });
      }
    } else why.push({ c: '', h: cap1(describe(m, 'its')) + '.' });
    if (gAfter.in_check()) why.push({ c: 'threat', h: 'It’s check. Get out of check first: move the king, block the line, or capture the checking piece.' });
    var hits = targetsOf(gAfter, m.to).filter(function (t) { return t.type !== 'k' && (VAL[t.type] > VAL[m.piece] || !attackersOf(gAfter, t.sq, userColor).length); });
    if (hits.length >= 2) {
      why.push({ c: 'threat', h: 'Double attack! Its ' + PNAME[m.piece] + ' hits your ' + hits.slice(0, 2).map(function (t) { return PNAME[t.type] + ' on ' + t.sq; }).join(' and ') + '. Save the bigger one, or find a counter-threat.' });
      hits.forEach(function (t) { used[t.sq] = 1; });
    } else if (hits.length === 1) {
      var t1 = hits[0], undef = !attackersOf(gAfter, t1.sq, userColor).length;
      why.push({ c: 'threat', h: 'Now attacks your ' + PNAME[t1.type] + ' on ' + t1.sq + (undef ? ', which has no defender.' : ', and it is worth more than the attacker.') });
      used[t1.sq] = 1;
    }
    Tac.rays(gAfter, m.to).forEach(function (r) {
      if (r.first.color === userColor && r.second.color === userColor && (r.second.type === 'k' || VAL[r.second.type] > VAL[r.first.type]) && !used[r.first.sq] && r.first.type !== 'p') {
        why.push({ c: 'threat', h: 'Pin: your ' + PNAME[r.first.type] + ' on ' + r.first.sq + ' is pinned to your ' + PNAME[r.second.type] + '. Moving it would expose the ' + PNAME[r.second.type] + '.' }); used[r.first.sq] = 1;
      }
    });
    hanging(gAfter, userColor).filter(function (h) { return !used[h.sq]; }).slice(0, 2).forEach(function (h) {
      why.push({ c: 'threat', h: 'Watch your ' + PNAME[h.type] + ' on ' + h.sq + '. It can be taken and isn’t defended well enough.' }); used[h.sq] = 1;
    });
    if (th && !used[th.to]) {
      if (th.mateNow) why.push({ c: 'threat', h: 'Threat: ' + mvc(th) + ' would be checkmate next move. Stop it now.' });
      else if (th.mate) why.push({ c: 'threat', h: 'Threat: it is building a mating attack, starting with ' + mvc(th) + '.' });
      else if (th.captured) why.push({ c: 'threat', h: 'Threat: ' + mvc(th) + ' next, winning your ' + PNAME[th.captured] + ' on ' + th.to + '.' });
      else why.push({ c: 'threat', h: 'Threat: it wants to play ' + mvc(th) + ' next.' });
    }
    if (!why.some(function (w) { return w.c === 'threat'; })) {
      var ph = phaseOf(gAfter, opp(userColor));
      why.push({ c: 'good', h: ph === 'opening' ? 'No direct threat. It’s developing, so keep developing too and get castled.'
        : ph === 'endgame' ? 'No direct threat. In the endgame, activate your king and push your passed pawns.'
        : 'No direct threat. You have a free move: improve your worst piece or start an attack.' });
    }
    return why;
  }

  function openingTip(g, mv, color) {
    var d = devState(g, color), fm = Math.ceil(g.history().length / 2), prev = d.moves[d.moves.length - 2];
    var castle = mv.flags.indexOf('k') > -1 || mv.flags.indexOf('q') > -1;
    if (fm > 14) return null;
    if (castle) return { tag: null, h: '<b>Good habit.</b> Castling early keeps your king safe and links your rooks.' };
    if (mv.piece === 'q' && fm <= 6 && d.minors < 2) return { tag: 'earlyQueen', h: '<b>Careful with the queen.</b> Out this early it gets chased by smaller pieces. Knights and bishops first.' };
    if (mv.piece === 'k') return { tag: 'kingWalk', h: '<b>King walk.</b> Moving the king gives up castling. Keep it home until you castle.' };
    if (mv.piece === 'r' && !d.castled && fm <= 12) return { tag: 'kingWalk', h: '<b>Rook moved before castling.</b> That rook can no longer castle. Castle first, then use the rooks.' };
    if (prev && prev.to === mv.from && !mv.captured && mv.piece !== 'p' && fm <= 8) return { tag: null, h: '<b>Same piece twice.</b> In the opening, bring a new piece into play each move.' };
    if (mv.piece === 'p' && 'abgh'.indexOf(mv.from[0]) > -1 && !mv.captured && fm <= 6) return { tag: null, h: '<b>Edge pawn.</b> Flank pawn moves don’t help much early. Center pawns and minor pieces first.' };
    if (fm >= 8 && !d.castled) { var k = g.get(color === 'w' ? 'e1' : 'e8'); if (k && k.type === 'k') return { tag: 'noCastle', h: '<b>King still in the middle.</b> Look to castle in the next move or two.' }; }
    return null;
  }

  function gradeUserMove(fenBefore, mv, gAfter, color) {
    var D = 12;
    return Brain.analyse(fenBefore, { depth: D, multipv: 3, fbDepth: 3 }).then(function (a) {
      var best = a[0] || { score: 0, uci: keyOf(mv) }, hit = a.filter(function (x) { return uciEq(x.uci, keyOf(mv)); })[0];
      var after = null;
      var p = gAfter.in_checkmate() ? Promise.resolve(MATE - 1) : gAfter.game_over() ? Promise.resolve(0)
        : Brain.analyse(gAfter.fen(), { depth: D - 1, multipv: 1, fbDepth: 2 }).then(function (b) { after = b; return hit ? hit.score : (b[0] ? -b[0].score : best.score); });
      return p.then(function (mine) {
        var loss = best.score - mine, cls;
        var missedMate = best.score > MW && mine <= MW, allowsMate = mine < -MW && best.score >= -MW;
        if (loss <= 20 || (best.score > MW && mine > MW)) cls = 'best';
        else if (allowsMate) cls = 'blund';
        else if (missedMate) cls = mine > 300 ? 'inacc' : 'mist';
        else if (loss <= 60) cls = 'good';
        else if (loss <= 130) cls = 'inacc';
        else if (loss <= 300) cls = 'mist';
        else cls = 'blund';
        if (best.score > 600 && mine > 400 && (cls === 'mist' || cls === 'blund')) cls = 'inacc';
        if (best.score < -600 && mine < -600 && cls === 'blund') cls = 'mist';
        var gB = new Chess(fenBefore), bm = findMove(gB, best.uci);
        var rm = after && after[0] ? findMove(gAfter, after[0].uci) : null, threat = '';
        if (cls !== 'best' && cls !== 'good' && rm) {
          if (rm.san.indexOf('#') > -1) threat = 'It allows checkmate with ' + mvc(rm, gAfter.fen()) + '.';
          else if (rm.captured && cls !== 'inacc') threat = 'It lets them play ' + mvc(rm, gAfter.fen()) + ', taking your ' + PNAME[rm.captured] + ' on ' + rm.to + '.';
          else if (allowsMate) threat = 'It walks into a mating attack, starting with ' + mvc(rm, gAfter.fen()) + '.';
          else if (cls !== 'inacc' && after[0].pv) threat = 'Their best reply is ' + mvc(rm, gAfter.fen()) + '. Their plan: ' + mline(gAfter.fen(), after[0].pv, 4);
        }
        var better = bm ? 'Better was ' + mvc(bm, fenBefore) + ', which ' + describe(bm, 'your') + '.' + (best.pv && best.pv.length > 2 ? ' The line: ' + mline(fenBefore, best.pv, 5) : '') : '';
        var text;
        if (cls === 'best') text = 'This ' + describe(mv, 'your') + '. Exactly what Stockfish would play.';
        else if (cls === 'good') text = 'Solid. This ' + describe(mv, 'your') + '. Stockfish slightly preferred ' + mvc(bm, fenBefore) + '.';
        else if (missedMate) text = 'You had a forced checkmate! ' + mvc(bm, fenBefore) + ' starts it.';
        else if (cls === 'inacc') text = 'Playable, but there was something better. ' + (threat ? threat + ' ' : '') + better;
        else text = (threat ? threat + ' ' : 'This gives away material or position. ') + better + ' Tap Take back to try again.';
        var tag = null;
        if (cls === 'mist' || cls === 'blund' || missedMate) {
          if (allowsMate) tag = 'allowedMate'; else if (missedMate) tag = 'missedMate';
          else if (rm && rm.captured) tag = 'hung'; else if (bm && bm.captured) tag = 'missedWin'; else tag = 'plan';
        }
        var ot = openingTip(gAfter, mv, color), tip = ot ? ot.h : '';
        if (ot && ot.tag && !tag) tag = ot.tag;
        if (!tip && (cls === 'mist' || cls === 'blund')) tip = tag === 'hung' ? '<b>Blunder check.</b> Before you move, look at the square your piece lands on. Can they take it for free?'
          : tag === 'missedWin' ? '<b>Captures first.</b> Every move, scan for pieces you can take. Free material wins games.'
          : '<b>Blunder check.</b> Ask: what does their next move attack? Look at checks, captures and threats.';
        return { side: 'u', cls: cls, san: mv.san, text: text, tip: tip, tag: tag, ev: color === 'w' ? mine : -mine, best: bm && cls !== 'best' ? { from: bm.from, to: bm.to, san: bm.san } : null };
      });
    });
  }

  function thinkFor(g, color, lines, th) {
    var ms = g.moves({ verbose: true }), best = lines[0], bm = best && findMove(g, best.uci);
    var checks = ms.filter(function (m) { return /[+#]/.test(m.san); }).length, caps = ms.filter(function (m) { return m.captured; }).length;
    var mine = hanging(g, color), dangers = mine.length + (th && !mine.some(function (h) { return h.sq === th.to; }) ? 1 : 0);
    var theme = { idea: 'No tactics right now. Improve your worst piece: which one is doing the least?', key: 'improve' };
    if (bm) {
      var gT = new Chess(g.fen()); gT.move(bm);
      var forkHits = targetsOf(gT, bm.to).filter(function (t) { return t.type === 'k' || VAL[t.type] > VAL[bm.piece] || !attackersOf(gT, t.sq, opp(color)).length; });
      var savedSq = mine.map(function (h) { return h.sq; });
      var thm = Tac.themesOf(g, bm, { mate: best.mate && best.mate > 0 ? best.mate : 0 });
      if (bm.san.indexOf('#') > -1) theme = { key: 'mate', idea: 'There is a <b>checkmate in one</b>! Go through every check you have.' };
      else if (best.score > MW) theme = { key: 'mating', idea: 'You have a <b>forced checkmate</b>' + (best.mate ? ' (mate in ' + best.mate + ')' : '') + '. Start with checks and keep the king boxed in.' };
      else if (g.in_check()) theme = { key: 'check', idea: 'You’re in check. Move the king, block, or capture the checking piece. Pick the one that leaves you safest.' };
      else if (savedSq.indexOf(bm.from) > -1) theme = { key: 'save', idea: 'Your <b>' + PNAME[bm.piece] + ' on ' + bm.from + '</b> is in danger. Move it to a safe square where it still does something.' };
      else if (bm.captured && !attackersOf(g, bm.to, opp(color)).length) theme = { key: 'free', idea: 'Something is <b>free to take</b>. Look at every capture you have.' };
      else if (bm.captured && VAL[bm.captured] > VAL[bm.piece]) theme = { key: 'winx', idea: 'You can <b>win material</b> with a capture. Take with a cheaper piece than the one you capture.' };
      else if (forkHits.length >= 2) theme = { key: 'fork', idea: 'Look for a <b>double attack</b>: one move that hits two targets at once' + (bm.piece === 'n' ? ', maybe with a knight.' : '.') };
      else if (thm.indexOf('pin') > -1 || thm.indexOf('skewer') > -1) theme = { key: 'line', idea: 'Two of their pieces are on the <b>same line</b>. Can a bishop, rook or queen pin or skewer them?' };
      else if (thm.indexOf('discovered') > -1 || thm.indexOf('discoveredCheck') > -1) theme = { key: 'disc', idea: 'One of your pieces is <b>blocking another</b>. Move it with a threat and unleash the one behind.' };
      else if (th) theme = { key: 'defend', idea: 'They have a <b>threat</b>: ' + mvc(th) + '. Deal with it first: move, defend, or block.' };
      else if (forkHits.length === 1 && VAL[forkHits[0].type] >= 5 && forkHits[0].type !== 'k') theme = { key: 'attack', idea: 'Attack a <b>big piece</b>. Hitting their ' + PNAME[forkHits[0].type] + ' with a smaller piece gains time.' };
      else if (bm.san.indexOf('+') > -1) theme = { key: 'check', idea: 'A <b>check</b> works well here. Checks force a reply, so you gain time.' };
      else if (bm.flags.indexOf('k') > -1 || bm.flags.indexOf('q') > -1) theme = { key: 'castle', idea: 'Get your <b>king safe</b>. Castling is a strong idea right now.' };
      else if ((bm.piece === 'n' || bm.piece === 'b') && bm.from[1] === (color === 'w' ? '1' : '8')) theme = { key: 'develop', idea: 'Bring <b>another piece</b> into the game. Which knight or bishop is still at home?' };
    }
    return { lines: lines, best: bm ? { from: bm.from, to: bm.to, san: bm.san, why: describe(bm, 'your') } : null, score: best ? best.score : 0,
      checks: checks, caps: caps, dangers: dangers, threat: th, theme: theme, plan: planFor(g, color) };
  }
  function planFor(g, color) {
    var ph = phaseOf(g, color), m = material(g), diff = m[color] - m[opp(color)], out = [];
    if (ph === 'opening') {
      var d = devState(g, color);
      if (!d.center) out.push('Put a pawn in the center (e4/d4 or e5/d5).');
      if (!d.knights) out.push('Get both knights out, toward the center.');
      if (!d.bishops) out.push('Develop your bishops onto open diagonals.');
      if (!d.castled) out.push('Castle to keep your king safe.');
      if (!out.length) out.push('Development is done. Connect your rooks and look for a plan.');
    } else if (ph === 'middlegame') {
      if (diff >= 2) out.push('You’re ahead by ' + diff + '. Trade pieces (not pawns) and keep it simple.');
      else if (diff <= -2) out.push('You’re behind by ' + (-diff) + '. Avoid trades, keep pieces on, and look for tactics.');
      var open = [];
      for (var f = 0; f < 8; f++) { var hasP = false; for (var r = 0; r < 8; r++) { var p = g.get(sqOf(f, r)); if (p && p.type === 'p') hasP = true; } if (!hasP) open.push(FILES[f]); }
      var rooks = piecesOf(g, color).filter(function (p) { return p.type === 'r'; });
      var idle = open.filter(function (f) { return !rooks.some(function (r) { return r.sq[0] === f; }); });
      if (rooks.length && idle.length) out.push('The ' + idle[0] + '-file is open. A rook there would be strong.');
      var k = piecesOf(g, color).filter(function (p) { return p.type === 'k'; })[0];
      if (k && 'def'.indexOf(k.sq[0]) > -1 && !devState(g, color).castled) out.push('Your king is still in the center. Castle or tuck it away soon.');
      if (out.length < 2) out.push('Attack where you have more pieces, and aim at their weakest point.');
    } else {
      out.push('Bring your king toward the center. In the endgame it’s a fighter.');
      var passed = piecesOf(g, color).filter(function (p) { return p.type === 'p' && isPassed(g, p.sq, color); });
      if (passed.length) out.push('Your pawn on ' + passed[0].sq + ' is passed. Push it, with your king or rook behind it.');
      if (diff >= 2) out.push('You’re ahead. Trade pieces to reach a simple winning ending.');
      else if (diff <= -2) out.push('You’re behind. Keep pieces active and stop their pawns.');
    }
    return { phase: ph, items: out.slice(0, 3) };
  }

  /* ---------- views ---------- */
  var EMPTY = (function () { var g = new Chess(); g.clear(); return g; })();
  function viewGame() {
    if (st.pv && st.pv.g) return st.pv.g;
    switch (st.mode) {
      case 'puzzle': return st.pz.g; case 'review': return st.rv.g; case 'lesson': return st.ls.g;
      case 'drill': return st.dr.g; case 'book': return st.bk.g; case 'squares': return EMPTY; case 'quiz': return st.qz.g; case 'reach': return st.rc.g; case 'placement': return st.pl.g;
      default: return G;
    }
  }
  function viewUser() {
    switch (st.mode) {
      case 'puzzle': return st.pz.side; case 'review': return st.rv.user; case 'lesson': return st.ls.side;
      case 'drill': return st.dr.side; case 'book': return st.bk.side; case 'squares': return st.sq.side; case 'quiz': return st.qz.side; case 'reach': return 'w'; case 'placement': return st.pl.side;
      default: return st.user;
    }
  }
  function orientWhite() { return (viewUser() === 'w') !== st.flipped; }
  function interactive() {
    if (st.busy || st.pv) return false;
    var g = viewGame();
    switch (st.mode) {
      case 'play': return !g.game_over() && g.turn() === st.user;
      case 'puzzle': return !st.pz.done && !st.pz.wait && g.turn() === st.pz.side;
      case 'drill': return !st.dr.done && g.turn() === st.dr.side;
      case 'book': return !st.bk.done && !st.bk.wait && g.turn() === st.bk.side;
      case 'placement': return !st.pl.done && g.turn() === st.pl.side;
      default: return false;
    }
  }

  /* ---------- board ---------- */
  function sqName(row, col) { return orientWhite() ? FILES[col] + (8 - row) : FILES[7 - col] + (row + 1); }
  function buildGrid() {
    gridEl.innerHTML = ''; sqEls = {};
    for (var r = 0; r < 8; r++) for (var c = 0; c < 8; c++) {
      var s = sqName(r, c), el = document.createElement('div'), x = fr(s);
      el.className = 'sq ' + ((x[0] + x[1]) % 2 === 0 ? 'd' : 'l');
      el.dataset.sq = s; el.tabIndex = 0; el.setAttribute('role', 'button');
      el.innerHTML = (c === 0 ? '<span class="coord r">' + s[1] + '</span>' : '') + (r === 7 ? '<span class="coord f">' + s[0] + '</span>' : '') + '<span class="pc"></span>';
      gridEl.appendChild(el); sqEls[s] = el;
    }
    st.builtFor = orientWhite();
  }
  function disp(s) { var x = fr(s); return orientWhite() ? [x[0] + 0.5, 7 - x[1] + 0.5] : [7 - x[0] + 0.5, x[1] + 0.5]; }

  function render() {
    scrHold = false; fixScreen();
    /* Fix round 1: the game's hint count goes back to 0 when another activity takes the board (or at a restart); its words on
       the coach line go back with it, to what they were before the first hint */
    if (st.mode === 'play' && !st.hintLvl && st.fb && /^Hint [123]:/.test(st.fb.title || '')) { st.fb = st.fbPre || null; st.fbPre = null; }
    if (tipFor && !tipFor.isConnected) hideTip();
    if (st.builtFor !== orientWhite()) buildGrid();
    var g = viewGame(), hist = g.history({ verbose: true }), last = hist[hist.length - 1], targets = {}, checkSq = null;
    if (st.sel && interactive()) g.moves({ square: st.sel, verbose: true }).forEach(function (m) { targets[m.to] = m.captured ? 'cap' : 'q'; });
    if (g.in_check()) piecesOf(g, g.turn()).forEach(function (p) { if (p.type === 'k') checkSq = p.sq; });
    $('board').classList.toggle('nocoord', st.mode === 'squares');
    Object.keys(sqEls).forEach(function (s) {
      var el = sqEls[s], p = g.get(s), pc = el.querySelector('.pc');
      var tg = tagsOn(), tok = p && st.mode !== 'squares' ? Avatar.piece(st.theme, p.color, p.type, tg) : null, pk = p ? (tok ? (tg ? 't' : 'u') : 'g') + p.color + p.type + st.theme : '';
      if (pc.dataset.k !== pk) { pc.dataset.k = pk; if (tok) pc.innerHTML = tok; else pc.textContent = p ? GLYPH[p.type] + VS : ''; }
      pc.className = 'pc' + (p ? ' ' + p.color : '') + (tok ? ' themed' : '');
      el.classList.toggle('last', !!last && (last.from === s || last.to === s));
      el.classList.toggle('sel', !st.pv && st.sel === s);
      el.classList.toggle('tgt', !!targets[s]);
      el.classList.toggle('cap', targets[s] === 'cap');
      el.classList.toggle('check', checkSq === s);
      el.classList.toggle('hl', (st.pv ? st.pv.hl : st.hls).indexOf(s) > -1);
      el.classList.toggle('ok', !!(st.flash && st.flash.sq === s && st.flash.ok) || (st.mode === 'reach' && st.rc && st.rc.found.indexOf(s) > -1));
      el.classList.toggle('bad', !!(st.mode === 'reach' && st.rc && st.rc.bad === s));
      var nm = p ? Avatar.label(st.theme, p.color, p.type) : null;
      el.setAttribute('aria-label', s + (p ? ' ' + (p.color === 'w' ? 'white ' : 'black ') + PNAME[p.type] + (nm ? ' (' + nm + ')' : '') : ''));
      el.title = nm ? nm + ' (' + PNAME[p.type] + ')' : '';
    });
    var pt = $('pvTag'); pt.hidden = !st.pv; if (st.pv) pt.textContent = st.pv.label;
    renderStrip(); renderName();
    if (st.v3d && window.Board3D) sync3d(g, last, targets, checkSq);
    renderArrows(); renderEval(); renderCaps(g); renderMode(); renderPlayPanel(); renderMoves(); renderEnd(); renderSession(); syncScreen(); renderSlots(); releaseOffer();
    syncResume(); /* G2b (G-D19): every change of place is drawn through here, so it is saved in the same step */
    if (st.tab === 'coach') { if (plain()) renderBHome(); else renderCont(); } /* AC8: a game that starts or ends next to Home (desktop) shows at once */
    var u = viewUser(), pl = plain();
    $('oppLevel').textContent = pl ? '' : st.mode === 'play' ? OPP[st.level].name + ' · ' + (st.level === 8 ? 'max' : '~' + OPP[st.level].elo) : st.mode === 'review' && OPP[st.rv.level] ? OPP[st.rv.level].name : '';
    $('oppName').textContent = pl && (st.mode === 'play' || st.mode === 'review' || st.mode === 'drill') ? partnerName() : { play: 'Engine', review: 'Engine', puzzle: 'Puzzle', lesson: 'Lesson', drill: 'Stockfish', book: 'Opening book', squares: 'Board drill', quiz: 'Safe or blunder?', reach: 'Piece drill', placement: 'Level check' }[st.mode] || '';
    $('youSwatch').style.background = u === 'w' ? '#FBF8F1' : '#1E1915';
    $('oppSwatch').style.background = u === 'w' ? '#1E1915' : '#FBF8F1';
    $('thinking').hidden = !st.busy;
    var hint = $('hintBtn'), canHint = st.mode === 'play' || st.mode === 'puzzle' || st.mode === 'drill' || st.mode === 'book';
    hint.hidden = !canHint; hint.disabled = !interactive(); renderHint();
    hint.textContent = st.hintLvl >= 3 ? 'Hint shown' : 'Hint ' + (st.hintLvl + 1) + ' of 3';
    $('undoBtn').hidden = st.mode !== 'play';
    $('undoBtn').disabled = st.busy || !G.history({ verbose: true }).some(function (m) { return m.color === st.user; });
    $('reviewBtn').hidden = st.mode !== 'play';
    $('reviewBtn').disabled = st.busy || !G.history().length;
    $('playControls').hidden = !canHint;
    $('navControls').hidden = st.mode !== 'review' && st.mode !== 'lesson';
    $('quizControls').hidden = !(st.mode === 'quiz' && st.qz && !st.qz.answered);
    if (st.mode === 'lesson') { $('navFirst').hidden = $('navLast').hidden = true; $('navPrev').disabled = st.ls.i === 0; $('navNext').textContent = st.ls.i === st.ls.unit.lesson.length - 1 ? 'Finish ✓' : 'Next ›'; $('navPos').textContent = (st.ls.i + 1) + ' / ' + st.ls.unit.lesson.length; }
    else { $('navFirst').hidden = $('navLast').hidden = false; $('navPrev').disabled = false; $('navNext').textContent = 'Next ›'; }
  }
  /* F-D28: Hint is the filled (main) button only while a game, puzzle or drill is in progress on its own tab. On Home, and
     when an end card or a decided lesson goal holds the screen's main button, it is a plain button. */
  function hintMain() {
    if (st.mode === 'play') return st.tab === 'play' && !G.game_over() && !goalMain(); /* F-D30: a goal card with only "Keep playing" leaves Hint filled */
    return !!st.ses && !sesEnded() && st.tab === ZTAB[zoneOf()];
  }
  function renderHint() { $('hintBtn').classList.toggle('primary', hintMain()); }
  /* ---------- piece tags and the name line (G1) ---------- */
  /* G-D15: the "Piece tags" switch. On unless the player turned it off. */
  function tagsOn() { return prof.pieceTags !== false; }
  /* G-D14: a tap on a themed piece, either colour, names it in one line under the board: "Rocket: knight. Jumps in an L shape."
     The line lies over the "You" row (as the preview label lies over the row above the board), so nothing under the board
     moves when it comes or goes. Classic pieces have no emblem name and get no line. */
  /* How long it stays: until any move by either side, a new game or another activity, a tap on an empty square, or
     5 seconds after the tap. A new tap on a piece starts the 5 seconds again. */
  var NAME_MS = 5000, nameTimer = 0;
  /* The position the line was asked in. Worked out at the tap, and after that only while a line is showing. */
  function nameKey() { return st.mode + '|' + viewGame().fen(); }
  function clearName() { clearTimeout(nameTimer); nameTimer = 0; st.nm = null; renderName(); }
  function namePiece(s) {
    var p = viewGame().get(s);
    clearTimeout(nameTimer); nameTimer = 0;
    st.nm = p && Avatar.label(st.theme, p.color, p.type) ? { sq: s, color: p.color, type: p.type, key: nameKey() } : null;
    if (st.nm) nameTimer = setTimeout(clearName, NAME_MS);
    renderName();
  }
  function renderName() {
    var el = $('pieceLine'), n = st.nm, p = n && !st.pv && n.key === nameKey() ? viewGame().get(n.sq) : null;
    var t = p && p.color === n.color && p.type === n.type ? Words.nameLine(Avatar.label(st.theme, p.color, p.type), p.type) : '';
    if (!t && n) { clearTimeout(nameTimer); nameTimer = 0; st.nm = null; } /* a move was played, or the set or the activity changed */
    if (el.textContent !== t) el.textContent = t;
    el.hidden = !t;
  }
  /* ---------- 3D view ---------- */
  var b3host = null, K3D = 'suresh-chess-coach.view3d';
  function sync3d(g, last, targets, checkSq) {
    var pos = [], ok = [];
    if (st.mode !== 'squares') for (var f = 0; f < 8; f++) for (var r = 1; r <= 8; r++) { var s = FILES[f] + r, p = g.get(s); if (p) pos.push({ sq: s, color: p.color, type: p.type }); }
    if (st.flash && st.flash.ok) ok.push(st.flash.sq);
    if (st.mode === 'reach' && st.rc) ok = ok.concat(st.rc.found);
    Board3D.sync({ pos: pos, theme: st.theme, white: orientWhite(), last: last ? { from: last.from, to: last.to } : null, sel: st.pv ? null : st.sel, targets: targets, check: checkSq, hls: st.pv ? st.pv.hl : st.hls, arrows: st.pv ? st.pv.arrows : st.arrows, ok: ok, bad: st.mode === 'reach' && st.rc ? st.rc.bad : null, coords: st.mode !== 'squares', tags: tagsOn() });
  }
  function set3d(v, quiet) {
    st.v3d = v; if (!quiet) lsSet(K3D, v);
    var btn = $('v3dBtn'); btn.setAttribute('aria-pressed', String(v)); btn.textContent = v ? '2D view' : '3D view';
    $('board').classList.toggle('is3d', v);
    if (!v) { Board3D.disable(); if (b3host) b3host.hidden = true; render(); return; }
    if (!b3host) { b3host = document.createElement('div'); b3host.className = 'b3d'; $('board').appendChild(b3host); }
    b3host.hidden = false; b3host.classList.add('loading');
    /* onLost (G2a): the WebGL context was lost and did not come back: the flat board takes over, the saved choice stays */
    Board3D.enable(b3host, { onTap: function (s) { press(s); }, onLost: function () { if (st.v3d) set3d(false, true); } }).then(function () { b3host.classList.remove('loading'); render(); })
      .catch(function (e) { b3host.classList.remove('loading'); set3d(false, true); btn.textContent = '3D unavailable'; btn.title = e && e.message ? e.message : 'Could not start the 3D board.'; });
    render();
  }
  function renderArrows() {
    var svg = $('arrow'), html = '';
    (st.pv ? st.pv.arrows : st.arrows).forEach(function (a0) {
      if (!a0 || !a0.from || !a0.to || a0.from === a0.to) return;
      var a = disp(a0.from), b = disp(a0.to);
      var dx = b[0] - a[0], dy = b[1] - a[1], len = Math.sqrt(dx * dx + dy * dy), ux = dx / len, uy = dy / len;
      var hx = b[0] - ux * 0.32, hy = b[1] - uy * 0.32, w = 0.24, px = -uy, py = ux, col = a0.color || 'var(--accent)';
      html += '<line x1="' + (a[0] + ux * 0.15) + '" y1="' + (a[1] + uy * 0.15) + '" x2="' + hx + '" y2="' + hy + '" stroke="' + col + '" stroke-width="0.17" stroke-linecap="round" opacity="0.85"/>' +
        '<polygon points="' + (b[0] - ux * 0.05) + ',' + (b[1] - uy * 0.05) + ' ' + (hx + px * w) + ',' + (hy + py * w) + ' ' + (hx - px * w) + ',' + (hy - py * w) + '" fill="' + col + '" opacity="0.85"/>';
    });
    svg.innerHTML = html;
  }
  function curEval() {
    if (st.mode === 'review') { var n = st.rv.notes[st.rv.ply - 1]; return n && typeof n.ev === 'number' ? n.ev : 0; }
    if (st.mode === 'play') return st.evalW;
    if (st.mode === 'drill' && typeof st.dr.ev === 'number') return st.dr.ev;
    return null;
  }
  function renderEval() {
    var ev = curEval(), bar = $('evalbar');
    bar.style.visibility = ev == null ? 'hidden' : 'visible';
    if (ev == null) return;
    var pct = ev > MW ? 100 : ev < -MW ? 0 : 50 + 50 * (2 / (1 + Math.exp(-ev / 350)) - 1);
    pct = Math.max(3, Math.min(97, pct));
    var ow = orientWhite();
    bar.classList.toggle('flip', !ow);
    $('evalfill').style.height = pct + '%'; bar.style.setProperty('--ev', pct + '%');
    var n = $('evalnum');
    n.textContent = Math.abs(ev) > MW ? 'M' : (ev >= 0 ? '+' : '−') + (Math.abs(ev) / 100).toFixed(1);
    n.style.color = ow ? 'var(--eval-b)' : 'var(--eval-w)';
    bar.title = Math.abs(ev) < 40 ? 'About equal' : (ev > 0 ? 'White is better' : 'Black is better');
  }
  function renderCaps(g) {
    var show = st.mode === 'play' || st.mode === 'review';
    if (!show) { $('youCaps').innerHTML = ''; $('oppCaps').innerHTML = ''; return; }
    var init = { p: 8, n: 2, b: 2, r: 2, q: 1 }, cnt = { w: { p: 0, n: 0, b: 0, r: 0, q: 0 }, b: { p: 0, n: 0, b: 0, r: 0, q: 0 } }, mat = { w: 0, b: 0 };
    g.board().forEach(function (row) { row.forEach(function (p) { if (p && p.type !== 'k') { cnt[p.color][p.type]++; mat[p.color] += VAL[p.type]; } }); });
    function capsBy(c) { var o = opp(c), s = ''; ['q', 'r', 'b', 'n', 'p'].forEach(function (t) { for (var i = cnt[o][t]; i < init[t]; i++) s += GLYPH[t] + VS; }); return s; }
    var you = viewUser(), them = opp(you), diff = mat[you] - mat[them];
    $('youCaps').innerHTML = esc(capsBy(you)) + (diff > 0 ? '<span class="adv">+' + diff + '</span>' : '');
    $('oppCaps').innerHTML = esc(capsBy(them)) + (diff < 0 ? '<span class="adv">+' + (-diff) + '</span>' : '');
  }
  var ZTAB = { learn: 'path', train: 'train', play: 'play' }, ZNAME = { learn: 'Learn', train: 'Train', play: 'Play' };
  function zoneOf() {
    if (st.mode === 'play' || st.mode === 'review') return 'play';
    if (st.ses && st.ses.zone) return st.ses.zone; /* Fix round 1: on a phone a drill started from Train belongs to Train */
    if (st.mode === 'lesson' || st.mode === 'squares' || st.mode === 'reach' || (st.ses && st.ses.unit)) return 'learn';
    return 'train';
  }
  function zoneLabel() {
    var s = st.ses;
    if (st.mode === 'lesson' && st.ls) return 'Lesson: ' + st.ls.unit.title;
    if (s) return s.title + (s.finished ? ' (finished)' : s.kind === 'drill' ? '' : ', ' + Math.min(s.i + 1, s.count) + ' of ' + s.count);
    if (st.mode === 'review') return 'Reviewing a game';
    return 'Your game';
  }
  function renderZones() {
    var z = zoneOf(), ph = phone(); /* G2a: a phone's tab page has no board to point at: no live dot and no note (the Resume cards do that job) */
    $('board').setAttribute('data-zone', z); document.body.setAttribute('data-zone', z);
    ['path', 'train', 'play'].forEach(function (t) { var b = $('tab-' + t), on = ZTAB[z] === t && !ph; b.classList.toggle('live', on); if (on) b.setAttribute('aria-describedby', 'liveDesc'); else b.removeAttribute('aria-describedby'); });
    ['path', 'train', 'play'].forEach(function (t) {
      var el = $('znote-' + t); if (!el) return;
      var pz = t === 'path' ? 'learn' : t;
      if (ph || z === 'play' || pz === z) { el.hidden = true; return; }
      el.hidden = false; el.className = 'znote z-' + z;
      /* round 2, item 2: a finished game is never "paused", and is not resumed: "Your game ended." and "See the end" (G-D36) */
      var over = G.game_over(), back = over ? esc(Flow.COPY.seeEnd) : '\u25B6 Resume game';
      el.innerHTML = '<p><span class="ztag">' + ZNAME[z] + '</span> The board is on <b>' + esc(zoneLabel()) + '</b>.' + (t === 'play' ? (over ? ' ' + Flow.COPY.ended + '.' : ' Your game is paused and saved.') : '') + '</p><div class="row2">' +
        (t === 'play' ? '<button class="btn primary" type="button" data-act="close">' + back + '</button><button class="btn" type="button" data-zgo="' + ZTAB[z] + '">Continue ' + ZNAME[z] + '</button>'
          : '<button class="btn primary" type="button" data-zgo="' + ZTAB[z] + '">Continue ' + ZNAME[z] + '</button><button class="btn" type="button" data-act="close">' + back + '</button>') + '</div>';
    });
  }
  function renderMode() {
    var bar = $('modebar'), z = zoneOf();
    bar.hidden = false; bar.className = 'modebar z-' + z;
    renderZones();
    $('modeExit').hidden = false;
    if (st.mode === 'play') {
      $('modeTag').textContent = 'Play';
      $('modeText').textContent = (G.history().length ? 'Your game' : 'New game') + ' vs ' + (plain() ? partnerName() : OPP[st.level].name + ' (~' + (st.level === 8 ? 'max' : OPP[st.level].elo) + ')') + ', you play ' + (st.user === 'w' ? 'White' : 'Black');
      $('modeExit').textContent = 'Train instead'; $('modeExit').dataset.zone = 'play';
      $('modeExit').hidden = !tabOpen('train'); /* a Beginner's Train tab is still locked */
      return;
    }
    var tag = '', text = '';
    if (st.mode === 'review') {
      var rv = st.rv, c = rv.counts;
      tag = 'Review'; text = (rv.past ? 'Past game' : 'This game') + (rv.acc != null && !plain() ? ' · Accuracy ' + rv.acc + '%' : '') + (c ? ' · ' + c.blund + ' blunder' + (c.blund === 1 ? '' : 's') : '');
      $('navPos').textContent = rv.ply === 0 ? 'Start' : 'Move ' + Math.ceil(rv.ply / 2) + ' (' + rv.ply + '/' + rv.sans.length + ')';
    } else if (st.mode === 'puzzle') { tag = 'Puzzle'; text = (st.pz.side === 'w' ? 'White' : 'Black') + ' to move' + (st.pz.p.rating && !plain() ? ' · rated ' + st.pz.p.rating : ''); }
    else if (st.mode === 'lesson') { tag = 'Lesson'; text = st.ls.unit.title; }
    else if (st.mode === 'drill') { tag = 'Drill'; text = st.dr.name + ' · move ' + st.dr.moves + ' of ' + st.dr.limit; }
    else if (st.mode === 'book') { tag = 'Opening'; text = st.bk.line.name + ' · you play ' + (st.bk.side === 'w' ? 'White' : 'Black'); }
    else if (st.mode === 'squares') { tag = 'Board drill'; text = 'Tap the square I name'; }
    else if (st.mode === 'reach') { tag = 'Piece drill'; text = 'Tap every square the ' + PNAME[st.rc.type] + ' can reach'; }
    else if (st.mode === 'quiz') { tag = 'Safe or blunder?'; text = (st.qz.side === 'w' ? 'White' : 'Black') + ' to move'; }
    $('modeTag').textContent = ZNAME[z]; $('modeText').textContent = tag + (text ? ': ' + text : '');
    $('modeExit').textContent = st.mode === 'review' && st.rv.past ? 'Close review' : G.game_over() ? Flow.COPY.seeEnd : 'Resume game'; $('modeExit').dataset.zone = z; /* round 2, item 2 */
  }

  /* ---------- Play panel ---------- */
  function setVerdict(f) {
    f = f || { cls: 'info', sym: '♙', title: 'Your move' };
    $('coach').className = 'coach v-' + f.cls;
    var avm = f.mood || (f.cls === 'info' ? (/Hint/.test(f.title) ? 'think' : 'neutral') : Avatar.moodFor(f.cls)), avk = avm + Coach3D.get();
    if ($('coachAv').dataset.k !== avk) { $('coachAv').dataset.k = avk; $('coachAv').innerHTML = Avatar.coach(avm, 64); }
    $('coach').querySelector('.eyebrow').textContent = f.eyebrow || 'Your move';
    $('sym').textContent = f.sym + (f.cls === 'info' ? VS : '');
    $('vTitle').textContent = speak(f.title);
    /* Beginners never see notation: the move line is the plain sentence (or nothing when it would be a move like Nf3). */
    var vm = $('vMove'); vm.classList.toggle('words', plain());
    if (plain()) vm.textContent = f.words || (f.noSan ? f.mv || '' : '');
    else vm.innerHTML = figs(esc(f.mv || ''));
    $('vText').innerHTML = speak(f.text);
    var tip = $('vTip'); tip.hidden = !f.tip; tip.innerHTML = speak(f.tip);
  }
  /* o.label: Beginners see the move in words instead of "Why the engine played Nf6"; '' hides the line. */
  function setOpp(o) {
    var card = $('oppCard'), head = $('oppHead');
    if (!o) { card.hidden = true; return; }
    card.hidden = false;
    head.classList.toggle('words', o.label != null);
    if (o.label != null) { head.textContent = o.label; head.hidden = !o.label; }
    else { head.hidden = false; head.innerHTML = 'Why the engine played <span class="mono" id="oppMove">' + figs(esc(o.san)) + '</span>'; }
    $('oppWhy').innerHTML = o.why.map(function (w) { return '<li class="' + w.c + '">' + w.h + '</li>'; }).join('');
  }
  /* The last move of a game view in plain words: mine = the player's move. */
  function lastMove(g) { var h = g ? g.history({ verbose: true }) : []; return h[h.length - 1] || null; }
  function partnerWords() { var m = lastMove(G); return m && m.color !== st.user ? Words.say(m, false) : ''; }
  function renderPlayPanel() {
    var think = $('thinkCard'), pl = plain();
    renderGoal();
    if (st.mode === 'review') {
      var rv = st.rv, n = rv.notes[rv.ply - 1], mv = rv.sans[rv.ply - 1], lm = rv.ply ? lastMove(rv.g) : null, sw = pl && lm ? Words.say(lm, lm.color === rv.user) : '';
      think.hidden = true; $('newCard').hidden = true;
      if (!rv.ply) { setVerdict({ cls: 'info', sym: '♙', title: 'Start of the game', eyebrow: 'Review', text: pl ? 'Tap Next to step through. Every move is explained.' : 'Tap Next to step through. Every move is explained, yours and the engine’s. Tap a move in the list to jump there, or ask the coach for a game summary.' }); setOpp(null); return; }
      var isUser = (rv.ply - 1) % 2 === (rv.user === 'w' ? 0 : 1);
      if (!n) { setVerdict({ cls: 'info', sym: '♙', title: 'Analyzing…', eyebrow: 'Review', mv: mv, words: sw }); setOpp(null); return; }
      if (isUser) { setVerdict({ cls: n.cls, sym: CLS[n.cls].sym, title: CLS[n.cls].title, eyebrow: 'Your move ' + Math.ceil(rv.ply / 2), mv: 'You played ' + mv, words: sw, text: n.text, tip: n.tip }); setOpp(null); }
      else { setVerdict({ cls: 'info', sym: '♟', title: pl ? sw : 'Engine’s move', eyebrow: 'Move ' + Math.ceil(rv.ply / 2), mv: 'Engine played ' + mv, words: '', text: 'Here is what it was up to.' }); setOpp({ san: mv, why: n.why || [], label: pl ? '' : null }); }
      return;
    }
    $('newCard').hidden = false;
    var o = st.mode === 'play' ? st.opp : null;
    setVerdict(st.fb); setOpp(o && pl ? { san: o.san, why: o.why, label: partnerWords() } : o);
    think.hidden = st.mode !== 'play'; if (st.mode === 'play') renderThink();
  }
  function renderThink() {
    var t = st.think, cct = $('cct'), plan = $('plan');
    if (G.game_over()) { cct.innerHTML = ''; plan.innerHTML = '<p class="empty-note">Game over. Tap Review to walk through it with the coach.</p>'; return; }
    if (!t || G.turn() !== st.user) { cct.innerHTML = ''; plan.innerHTML = '<p class="empty-note">' + (st.busy ? 'Thinking…' : 'Waiting for your turn.') + '</p>'; return; }
    cct.innerHTML = '<div><b>' + t.checks + '</b><span>checks you have</span></div><div><b>' + t.caps + '</b><span>captures you have</span></div>' +
      '<div class="' + (t.dangers ? 'warn' : '') + '"><b>' + t.dangers + '</b><span>' + (t.dangers === 1 ? 'danger to you' : 'dangers to you') + '</span></div>';
    var phaseName = { opening: 'Opening', middlegame: 'Middlegame', endgame: 'Endgame' }[t.plan.phase], w = topWeakness();
    plan.innerHTML = '<p><span class="phase">' + phaseName + ' plan</span></p><ul>' + t.plan.items.map(function (x) { return '<li>' + x + '</li>'; }).join('') + (w ? '<li><b>Your habit to watch:</b> ' + WEAK[w].short + '</li>' : '') + '</ul>';
  }
  function renderGoal() {
    var c = $('goalCard'), gl = st.goal;
    if (!gl || st.mode !== 'play') { c.hidden = true; return; }
    c.hidden = false;
    var status = gl.status === 'done' ? '<b>Goal reached!</b> ' : gl.status === 'failed' ? '<b>Not this time.</b> ' : '';
    var h = '<p class="eyebrow">Course goal · ' + esc(UNIT[gl.unit] ? UNIT[gl.unit].title : '') + '</p><p>' + status + esc(gl.text) + '</p><div class="gstat">' + (gl.progress || '') + '</div>';
    /* F-D18: the goal is decided and the game goes on: the next step (asks first, D49: this game is unfinished), or Keep playing */
    if (goalChoice()) {
      var n = unitNext(gl.unit, gl.status === 'done'), gc = Flow.goalCard({ goal: gl.status, nextPart: n.kind, next: n.nx });
      /* F-D31: "Try again" restarts this lesson game at once (no D49 question: the game it would drop is this one) */
      h += ecButtons(gc, { tryagain: 'data-apply="' + gl.unit + '"', part: n.np ? partAttr(gl.unit, n.np) : '', nextlesson: n.nx ? partAttr(n.nx.unit.id, n.nx.part) : '', keep: 'data-act="keep"' });
    }
    if (c._h !== h) { c._h = h; c.innerHTML = h; }
    /* T3: the moment the goal is decided, the card is brought into view (as the result card: only as far as the board
       stays on screen) and read out, once, after the last move's check. Never when the app opens (the flag is saved). */
    if (goalChoice() && !st.busy && !gl.told) {
      gl.told = true;
      if (booted) { revealEnd(c); var live = $('endLive'), say = (gl.status === 'done' ? 'Goal reached! ' : 'Not this time. ') + gl.text + (gc && gc.line ? ' ' + gc.line : ''); if (live) { live.textContent = ''; setTimeout(function () { live.textContent = say; }, 60); } }
    }
  }
  function goalMain() {
    if (!goalChoice()) return false;
    var gl = st.goal, n = unitNext(gl.unit, gl.status === 'done'), gc = Flow.goalCard({ goal: gl.status, nextPart: n.kind, next: n.nx });
    return !!(gc && gc.main);
  }
  /* A lesson game's goal is decided before the game ends, and the player has not chosen Keep playing yet. */
  function goalChoice() { var gl = st.goal; return !!(gl && st.mode === 'play' && gl.status !== 'active' && !gl.kept && !G.game_over()); }
  function renderMoves() {
    var el = $('moves'), sans, ann, cur = -1;
    if (st.mode === 'review') { sans = st.rv.sans; ann = st.rv.ann || {}; cur = st.rv.ply - 1; }
    else if (st.mode === 'play') { sans = G.history(); ann = st.ann; }
    else { el.innerHTML = '<p class="empty">Moves of your current game show here.</p>'; return; }
    if (!sans.length) { el.innerHTML = '<p class="empty">No moves yet.</p>'; return; }
    var rows = '';
    function cell(i) { if (i >= sans.length) return '<td></td>'; var a = ann[i]; return '<td class="clk' + (i === cur ? ' cur' : '') + '" data-ply="' + (i + 1) + '">' + figs(esc(sans[i])) + (a ? '<span class="s ' + a + '">' + CLS[a].sym + '</span>' : '') + '</td>'; }
    for (var i = 0; i < sans.length; i += 2) rows += '<tr><td class="n">' + (i / 2 + 1) + '.</td>' + cell(i) + cell(i + 1) + '</tr>';
    el.innerHTML = '<table>' + rows + '</table>';
    var c = el.querySelector('.cur');
    if (c) el.scrollTop = Math.max(0, c.offsetTop - el.clientHeight / 2); else if (st.mode === 'play') el.scrollTop = el.scrollHeight;
  }
  function result(g, userColor) {
    if (!g.game_over()) return null;
    if (g.in_checkmate()) { var w = opp(g.turn()); return w === userColor ? { r: 'W', title: 'Checkmate. You win!', text: 'Great finish. Review it, then try a stronger opponent.' } : { r: 'L', title: 'Checkmate', text: 'The engine wins this one. Review it to find the turning point.' }; }
    if (g.in_stalemate()) return { r: 'D', title: 'Stalemate', text: 'No legal moves and no check, so it’s a draw.' };
    if (g.in_threefold_repetition()) return { r: 'D', title: 'Draw', text: 'The same position came up three times.' };
    if (g.insufficient_material()) return { r: 'D', title: 'Draw', text: 'Not enough pieces left to checkmate.' };
    return { r: 'D', title: 'Draw', text: '50 moves without a capture or pawn move.' };
  }
  /* ---------- F2: the tip slot (F-D3 to F-D6, F-D12 to F-D14). A tinted card with the coach and one tip, in four places only:
     the end card after a game, the end card after a lesson step or puzzle set, the bottom of Home, the bottom of Progress.
     No network, no ads code, nothing collected. ---------- */
  var slotTips = {}, visits = { coach: 0, progress: 0 };
  /* F-D4: a lesson, game, puzzle set, drill, review or the level check is in progress */
  function boardBusy() { return st.mode === 'lesson' || st.mode === 'review' || !!(st.ses && !st.ses.finished && !st.ses.end) || gameOn(); }
  /* G2a (G-D11): the rule itself is Flow.inUse. Wide: as above. Phones: only while the board screen is open with no end card. */
  function activityOn() { return Flow.inUse({ wide: !phone(), open: st.scr === 'act', end: endUp(), busy: boardBusy(), check: Placement.isOpen() }); }
  /* F-D5: no slot anywhere on the player's first calendar day (and none before a level is set). Home and Progress also
     drop it while an activity is in progress, so the slot never shares a screen with a board that is in use. */
  /* F-D12: one decision per screen visit: whether the slot shows (the first-day rule is read once, so midnight on day one
     never puts a slot into a card that is already open) and which tip. The same while the player stays on the card or the
     tab; a level change decides again. */
  function slotVisit(place, visit) {
    var s = slotTips[place];
    if (!s || s.visit !== visit || s.level !== prof.level) s = slotTips[place] = { visit: visit, level: prof.level, day: !!prof.level && !Tips.firstDay(prof, Date.now()), tip: null };
    return s;
  }
  /* THE ONE DECISION for the tip slot, and through adFacts for the banner. The rule is Flow.slotOk (unit tested): wide screens
     keep F-D17 and F-D32 (an end card has no slot while a game is unfinished); phones follow G-D11. */
  function slotAllowed(place, visit) {
    return Flow.slotOk({ place: place, day: slotVisit(place, visit).day, inUse: activityOn(), wide: !phone(), gameOn: gameOn(), live: st.mode === 'play' && gameOn() }); /* live: the board on screen is a game in progress */
  }
  function slotTip(place, visit) { var s = slotVisit(place, visit); return s.tip || (s.tip = Tips.pick(prof.level)); }
  /* F-D27: desktop = the board and the panel sit side by side. There the slot is one strip under both columns. */
  function wide() { var a = document.querySelector('.app'); return !!a && getComputedStyle(a).gridTemplateColumns.split(' ').length > 1; }
  /* ---------- G2a: board screens on phones (docs/specs/board-screens.tech.md). "Phone" is the one-column layout, the same
     media query as every G2 rule in the CSS, so the two can never disagree. Wide screens are untouched by all of this. ---------- */
  function phone() { return !!window.matchMedia && matchMedia('(max-width: 860px)').matches; }
  function actOpen() { return Flow.actOpen({ wide: !phone(), scr: st.scr }); }
  /* an end card is on screen: a finished game, the last move of a finished game's review, a finished set, the Learn end card */
  function endUp() { return !!(endFull || reviewDone() || sesEnded() || st.end); }
  /* Every start (a game, a lesson, a set, a drill, a review) and every Resume calls openAct() before it switches tab; the
     start's own render() then draws the screen. scrHold keeps the safety rule quiet in between (the mode is still changing). */
  var scrHold = false, scrOn = false, scrY = 0, scrTab = null, scrTop = false;
  function openAct() { if (st.scr !== 'act') { scrY = window.scrollY || 0; scrTab = st.tab; } st.scr = 'act'; scrHold = true; scrTop = true; unask(); }
  /* Fix round 2: the "Tap again to abandon it" question is only good for the next tap on the same page. Leaving Play, closing
     Settings or opening anything takes it back, so a much later single tap cannot wipe the game. Phones only. */
  function unask() { if (st.confirmNew && phone()) { st.confirmNew = false; $('newConfirm').hidden = true; } }
  /* The safety rule: the board screen is only kept on the activity's own tab (or under the Learn end card). Whatever path
     changed the tab or ended the activity, the player lands on a tab page, never on a board screen with nothing on it. */
  function fixScreen() {
    if (st.scr !== 'act' || scrHold) return;
    if (Flow.keepsScreen({ tab: st.tab, zoneTab: ZTAB[zoneOf()], learnEnd: !!st.end })) return;
    st.scr = 'tabs';
    if (phone() && st.mode === 'review') { st.rv = null; st.mode = 'play'; st.sel = null; resetHints(); } /* a review has no Resume card: it ends */
  }
  /* Writes the two root attributes the CSS reads, in the same step as the state change (criterion 2: within one frame). */
  function syncScreen() {
    var de = document.documentElement, on = actOpen(), end = on && !Flow.tabsHidden({ wide: !phone(), scr: st.scr, end: endUp() });
    if (on) de.dataset.scr = 'act'; else delete de.dataset.scr;
    if (end) de.dataset.scrend = '1'; else delete de.dataset.scrend;
    renderActBar(); renderResume();
    wasPinned = pinned(); /* G2d fix round 1: what the resize handler compares with */
    /* Fix round 2: whatever opens on the board screen starts at the top of the page (an end card's scroll is not kept) */
    if (scrTop && !scrHold) { scrTop = false; if (on && on === scrOn && window.scrollY > 0) window.scrollTo(0, 0); }
    if (on === scrOn) return;
    scrOn = on;
    if (st.tab === 'path') renderPath(); /* the lesson's step card belongs to the board screen; the course to the tab page */
    if (on) {
      window.scrollTo(0, 0);
      if (st.v3d && window.Board3D && Board3D.isOn()) Board3D.resize(); /* the first frame shown is already the right position */
      if (booted) try { $('actText').focus({ preventScroll: true }); } catch (e) {}
    } else window.scrollTo(0, st.tab === scrTab ? scrY : 0);
  }
  /* The Close bar's two lines: the activity's name, and where the player is in it. Words the app already uses. */
  function turnLine() { var t = Flow.resumeLine(fullmove(G), G.turn() === st.user); return plain() ? t.replace(Flow.COPY.engineTurn, ', Rani\u2019s partner to move') : t; } /* D23: a Beginner never reads "engine" */
  function setPlace(s) { return Flow.setLine(s); }
  function lessonPlace(L) { return Flow.lessonLine(L.i, L.unit.lesson.length); }
  function actWords() {
    var n = G.history().length, bar = $('modeText').textContent; /* the mode bar's own words (renderMode), so a phone loses nothing it said */
    if (st.mode === 'review' && st.rv) return [bar, $('navPos').textContent];
    if (st.mode === 'lesson' && st.ls) return [st.ls.unit.title, lessonPlace(st.ls)];
    if (st.ses && st.mode !== 'play') return [bar, setPlace(st.ses)];
    return [n ? 'Your game' : 'New game', G.game_over() ? Math.ceil(n / 2) + ' moves' : turnLine()];
  }
  function renderActBar() {
    if (!scrOn && !actOpen()) return;
    var w = actWords(), a = $('actName'), b = $('actPlace');
    if (a.textContent !== w[0]) a.textContent = w[0];
    if (b.textContent !== w[1]) b.textContent = w[1];
    var lab = w[0] + ', ' + w[1], t = $('actText'); if (t.getAttribute('aria-label') !== lab) t.setAttribute('aria-label', lab); /* what is read when the bar takes focus */
  }
  /* G-D5, G-D6, G-D21: the Resume cards and Play's "Recent games", on a phone's tab pages only. G2b: a lesson's or a set's
     card is drawn from what waits on its tab (waitOn): the one on the board, or the one parked or read from the device. */
  function rsHtml(kind, kick, line, zone, main) {
    var t = Flow.resumeTitle(kind);
    return '<div class="bh-tt">' + (kick ? '<p class="bh-kick">' + esc(kick) + '</p>' : '') + '<h3 class="bh-title">' + esc(t) + '</h3><p class="rs-line">' + esc(line) + '</p></div>' +
      '<button class="btn big rs-go' + (main ? ' primary' : '') + '" type="button" data-act="resume" data-z="' + zone + '">' + esc(t) + '</button>';
  }
  function rsCard(el, html) {
    if (!el) return;
    if (!html) { if (!el.hidden) el.hidden = true; return; }
    if (el._h !== html) { var keep = el.contains(document.activeElement); el._h = html; el.innerHTML = html; if (keep) { var f = el.querySelector('.rs-go'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} } }
    el.hidden = false;
  }
  function gameResume(main) { return rsHtml('game', '', turnLine(), 'play', main); }
  /* G-D36 (fix round 1): a game that ended while it was closed. Its card stands where Resume game stands, with the end card's
     own result line. "See the end" opens the board screen at the final position (as Resume game); "Review" opens the review
     as the end card's Review does. Phones only (Flow.endedCard): wide shows the finished game on the board, as before. */
  function endedCard() { var r = result(G, st.user); return Flow.endedCard({ over: !!r, unseen: st.unseen, wide: !phone(), line: r ? Flow.endedLine({ r: r.r, title: speak(r.title), plain: plain() }) : '' }); } /* round 2: the line says who won */
  function endedHtml(c, main) {
    return '<div class="bh-tt"><h3 class="bh-title">' + esc(c.title) + '</h3><p class="rs-line">' + esc(c.line) + '</p></div>' +
      '<button class="btn big rs-go' + (main ? ' primary' : '') + '" type="button" data-act="resume" data-z="play">' + esc(c.main.label) + '</button>' +
      '<button class="btn rs-rv" type="button" data-act="review">' + esc(c.small[0].label) + '</button>';
  }
  /* The game's end card is seen (it is on screen, or its review opened): the result card goes, and the saved game says so. The
     game's time stamp stays (as when it was recorded), so a merge still sees its real age. */
  function seenEnd() { if (!st.unseen) return; st.unseen = false; var snap = snapshot(); lsSet(STORE, snap); push('game', snap); }
  function renderResume() {
    var ph = phone(), page = ph && st.scr !== 'act', game = page && gameOn(), ec = page ? endedCard() : null, f = resumeFacts();
    /* G-D35: on wide screens too a lesson or set that waits has its card on its tab; there, only while it is not on the board
       (the board beside the panel shows that one) */
    function other(z) {
      var e = page ? waitOn(z) : !ph && liveZone() !== z ? st.park[z] : null, s = st.ses;
      /* round 2, item 1: a set that ended while its board screen was closed keeps its card until its end card is seen */
      if (!e && page && s && liveZone() === z && sesEnded() && s.late) e = { k: 'set', kind: s.kind, title: s.title, i: s.i, count: s.count, finished: true };
      var c = e ? Flow.resumeCard(e, f) : null; return c ? rsHtml(c.kind, c.kick, c.line, z, false) : '';
    }
    rsCard($('resumePlay'), game ? gameResume(true) : ec ? endedHtml(ec, true) : '');
    /* Play's start page has one main button: "Resume game" (or "See the end") while a game waits, otherwise "Start new game". Wide: never (unchanged). */
    $('newBtn').classList.toggle('primary', page && !game && !ec);
    /* Beginner Home draws its own, under its Continue card. No card when the Continue card's own button is already the game. */
    rsCard($('resumeHome'), plain() ? '' : game && nextAction(currentStage()).info.kind !== 'beat' ? gameResume(false) : ec ? endedHtml(ec, false) : '');
    rsCard($('resumePath'), other('learn'));
    rsCard($('resumeTrain'), other('train'));
    var rc = $('recentPlay'), gs = prof.games, pl = plain();
    if (!page || !gs.length) { if (!rc.hidden) rc.hidden = true; }
    else {
      var rh = '<div class="hist">' + gs.slice(0, 3).map(function (g, i) { return gameRow(g, i, pl); }).join('') + '</div>';
      if (rc._h !== rh) { rc._h = rh; $('recentList').innerHTML = rh; }
      rc.hidden = false;
    }
  }
  /* Resume: the board screen opens on what is waiting. The game: as "Resume game" (G2b: a lesson or set that is open is
     parked, exitMode). A lesson or set that never left the board: only the screen opens. One that is parked or was read from
     the device: what is on the board is parked in turn, and the entry is dealt again (restoreEntry). */
  function resumeAct(zone) {
    if (zone === 'play') { if (st.mode !== 'play') { exitMode(true); return; } openAct(); switchTab('play'); render(); return; }
    if (zone !== 'learn' && zone !== 'train') return;
    if (liveZone() === zone) { if (sesEnded() && !st.ses.late) { render(); return; } openAct(); switchTab(ZTAB[zone]); render(); return; } /* round 2: a set that ended while closed opens on its end card */
    var e = st.park[zone];
    if (!e) { render(); return; } /* G-D35: at every width */
    if (!Flow.entryOk(zone, e, resumeFacts())) { st.park[zone] = null; render(); return; } /* fail safe: checked again at the moment of use */
    stow(zone); restoreEntry(zone, e);
  }
  /* ---------- G2b: one thing waits per tab, saved on the device (G-D19, G-D20; the rules are in flow.js) ----------
     On the board: at most one lesson, set or drill (st.ls / st.ses), as before. Parked: st.park.learn and st.park.train, one
     plain entry each (Flow.entryOf). Local storage (Flow.RESUME_KEY) always holds what waits on the two tabs: the one on the
     board or the parked one. Outside the profile: no shape change, no migrate(), never synced. */
  /* The tab the lesson or set on the board belongs to (zoneOf without the mode, so it also holds under the level check). */
  function liveZone() { var s = st.ses; return st.ls ? 'learn' : !s ? null : s.zone || (s.unit || s.kind === 'squares' || s.kind === 'reach' ? 'learn' : 'train'); }
  /* The entry for what is on the board (null: nothing, or it is finished). */
  function liveEntry() {
    if (st.ls) return Flow.entryOf({ lesson: { unit: st.ls.unit.id, i: st.ls.i } });
    var s = st.ses; if (!s) return null;
    var o = s.opts || {}, k = s.kind;
    var items = k === 'puzzles' ? s.items.filter(Boolean).map(function (p) { return p.id; }) : k === 'safety' ? s.items.map(function (it) { return [it.p.id, it.blunder ? 1 : 0]; }) : k === 'book' ? s.items.map(function (b) { return b.id; }) : [];
    return Flow.entryOf({ over: sesEnded(), set: { kind: k, title: s.title, unit: s.unit, part: s.part, count: s.count, pass: s.pass, rated: s.rated, theme: o.theme, review: o.review, i: s.i, right: s.right, wrong: s.wrong, counted: s.cnt, ok: s.ok, items: items, daily: o.daily || null,
      drill: st.dr ? { fen: st.dr.g.fen(), moves: st.dr.moves } : null } });
  }
  function waitOn(z) { return liveZone() === z ? liveEntry() : st.park[z]; }
  /* What this app and this player can still open: the facts Flow.entryOk checks an entry against. */
  function resumeFacts() {
    var own = function (o, k) { return typeof k === 'string' && Object.prototype.hasOwnProperty.call(o, k) ? o[k] : null; };
    return {
      unit: function (id) {
        var u = own(UNIT, id); if (!u) return null;
        var p = u.practice, a = u.apply;
        return { title: u.title, steps: u.lesson.length, practice: p ? (p.type === 'squares' || p.type === 'reach' || p.type === 'safety' ? p.type : 'puzzles') : null, apply: a && (a.type === 'drill' || a.type === 'book') ? a.type : null };
      },
      puzzle: function (id) { return !!own(PZ_BY, id); },
      quiz: function (id) { var p = own(PZ_BY, id); return !!(p && p.pre && p.last && p.preBest); },
      book: function (id) { return COURSE.BOOK.some(function (b) { return b.id === id; }); },
      fen: function (f) { var g = new Chess(); return !!g.load(f) && !g.game_over(); },
      trainOpen: tabOpen('train')
    };
  }
  /* Something else takes the board (to: the tab it belongs to). The lesson or set on the board waits on its own tab, unless it
     is finished or the new one is for the same tab (the newest wins, no question). G-D35: the same on wide screens (D50 is
     gone). The caller clears the board next (clearSession). */
  function stow(to) {
    var z = liveZone();
    if (Flow.onOpen({ live: z, over: sesEnded(), to: to }) === 'park') st.park[z] = liveEntry();
    if (to === 'learn' || to === 'train') st.park[to] = null;
  }
  /* Resume from an entry: the current item is dealt again. A lesson shows its step; a puzzle, question, square, piece or
     opening line starts that item again with the score kept (and its result, if it was already counted, not counted again);
     an endgame drill keeps its position. Nothing is thawed: timers and engine replies of the old one found a new board. */
  function restoreEntry(z, e) {
    rateReset(); /* D2 (fix 3) */
    clearSession(); st.rv = null; st.af = false; st.sel = null; resetHints();
    if (e.k === 'lesson') { st.mode = 'lesson'; st.ls = { unit: UNIT[e.unit], i: e.i, g: null, side: 'w' }; openAct(); switchTab('path'); showLessonStep(); return; }
    if (e.kind === 'drill') { openDrill(e.unit, UNIT[e.unit].apply, z === 'train' ? 'train' : null, e.drill); return; }
    var items = e.kind === 'puzzles' ? e.items.map(function (id) { return PZ_BY[id]; }) : e.kind === 'safety' ? e.items.map(function (x) { return { p: PZ_BY[x[0]], blunder: !!x[1] }; })
      : e.kind === 'book' ? e.items.map(function (id) { return COURSE.BOOK.filter(function (b) { return b.id === id; })[0]; }) : [];
    var opts = { title: e.title, count: e.count, unit: e.unit, part: e.part, rated: e.rated };
    if (e.pass != null) opts.pass = e.pass;
    if (e.rated) opts.pick = ratedPick(); else if (items.length) opts.items = items;
    if (e.theme) opts.theme = e.theme;
    if (e.review) opts.review = true;
    if (e.daily) opts.daily = e.daily; /* D1: still the daily puzzle of the day it was dealt, after a Resume or a restart */
    st.ses = { kind: e.kind, title: e.title, count: e.count, pass: opts.pass, unit: e.unit || null, part: e.part || null, rated: !!e.rated, i: e.i, right: e.right, wrong: e.wrong, items: items, opts: opts, msg: null, ok: e.counted ? e.ok : null };
    openAct(); switchTab(ZTAB[z]);
    nextItem(true, e.counted);
  }
  /* The saved key follows what waits, in the same step as the change (render). Nothing waits: the key is removed. A write the
     device refuses (storage full) is not marked as done, so the next change of any kind (the next render) tries it again:
     once per change, never in a loop. */
  var resumeOn = false, resumeStr = null;
  function syncResume() {
    if (!resumeOn) return;
    var o = Flow.writeResume({ learn: waitOn('learn'), train: waitOn('train') }), str = o ? JSON.stringify(o) : '';
    if (str === resumeStr) return;
    try { if (str) localStorage.setItem(Flow.RESUME_KEY, str); else localStorage.removeItem(Flow.RESUME_KEY); resumeStr = str; } catch (e) {}
  }
  /* App start: what was waiting comes back as parked entries. Anything that does not pass the check is dropped silently. */
  function loadResume() { st.park = Flow.readResume(lsGet(Flow.RESUME_KEY), resumeFacts()); resumeOn = true; }
  /* A level change (Settings, the level check, a sign-in merge): what the player can no longer open stops waiting. */
  function checkPark() { var f = resumeFacts(); ['learn', 'train'].forEach(function (z) { if (st.park[z] && !Flow.entryOk(z, st.park[z], f)) st.park[z] = null; }); }
  /* G-D4, G-D23: Close. No question; nothing to save (a game is saved on every move, a lesson or set stays in memory).
     Lands on the activity's tab; a past game's review lands where it was opened. A review opened in the middle of a game
     goes back to that game. An end card that is up is over, so it is dropped. Returns false when there is nothing to close. */
  /* What waits on Learn as a lesson's part (the lesson, its practice set or its task: closed, parked, or read from the device),
     for Home's Continue card and Today's Learn step (G-D37). G-D35: wide screens too, where it may also be the one on the board. */
  function waitingPart() { return !phone() || st.scr !== 'act' ? Flow.waitingPart(waitOn('learn')) : null; }
  var RESUME_LESSON = 'data-act="resume" data-z="learn"';
  function closeAct() {
    if (!actOpen()) return false;
    save(); /* nothing is ever lost by Close: the game is written once more as it stands */
    if (st.mode === 'review' && st.rv && !st.rv.past && !G.game_over()) { exitMode(true); return true; }
    var to = Flow.closeTab({ mode: st.mode, zoneTab: ZTAB[zoneOf()], learnEnd: !!st.end, past: !!(st.rv && st.rv.past), from: st.rvFrom });
    leaveEnd(true);
    st.scr = 'tabs'; switchTab(to); render(); syncResume(); /* G-D19: the place is written on Close (render already did; said here on purpose) */
    var b = document.querySelector('#panel-' + to + ' .rs-go');
    if (b && b.offsetParent !== null) try { b.focus({ preventScroll: true }); } catch (e) {} else focusTab();
    return true;
  }
  /* What is over is dropped when the player leaves the board screen: a review (always, on Close), a finished set, the Learn end card. */
  function leaveEnd(closing) {
    if (st.mode === 'review' && (closing || reviewDone())) { st.rv = null; st.mode = 'play'; st.sel = null; resetHints(); var last = G.history({ verbose: true }).slice(-1)[0]; if (last && last.color !== st.user) st.arrows = [{ from: last.from, to: last.to, color: 'var(--c-blund)' }]; }
    if (sesEnded()) { clearSession(); st.mode = 'play'; st.sel = null; resetHints(); }
    st.end = null;
  }
  /* THE SLOT SEAM. renderSlot is the only code that fills a slot. Today it always shows the coach's tip. A later slice (F3)
     may put an ad in this same box, here and nowhere else, when one has loaded, and keep the tip as the fallback (offline,
     no ad). The box has one fixed height (CSS .tipslot), so whatever fills it never moves the page. */
  function renderSlot(el, place, visit) {
    if (!el) return;
    if (!place || !slotAllowed(place, visit)) { el.hidden = true; if (el._k) { el._k = ''; el.innerHTML = ''; } return; }
    var coach = Coach3D.get(), tip = slotTip(place, visit), key = coach + '|' + tip;
    el.hidden = false;
    if (el._k === key) return;
    el._k = key; el.setAttribute('role', 'note'); el.setAttribute('aria-label', Tips.aria(coach, tip));
    el.innerHTML = '<span class="ts-av" aria-hidden="true">' + Avatar.coach('happy', 46) + '</span><span class="ts-body" aria-hidden="true"><b class="ts-label">' + esc(Tips.label(coach)) + '</b><span class="ts-text">' + esc(tip) + '</span></span>';
  }
  /* An end card's slot: an empty box of the fixed height in the card's markup, filled by renderSlot. */
  function slotHost(place, visit) { return !wide() && slotAllowed(place, visit) ? '<div class="tipslot" data-slot="' + place + '"></div>' : ''; }
  /* The place whose slot the desktop strip shows: the end card on screen, or Home, or Progress. */
  function stripPlace() {
    var t = st.tab;
    if (t === 'coach') return ['home', visits.coach];
    if (t === 'progress') return ['progress', visits.progress];
    if (t === 'play') return endFull ? ['game', endFull] : null;
    var card = !phone() || st.scr === 'act'; /* G2a: on a phone an end card exists on the board screen only */
    if (t === 'path' && st.end) return card ? ['learn', st.end] : null;
    return card && sesEnded() && ZTAB[zoneOf()] === t ? ['step', st.ses] : null;
  }
  function renderSlots() {
    var w = wide(), p = w ? stripPlace() : null;
    if (st.tab === 'coach') renderSlot($('homeSlot'), w ? null : 'home', visits.coach);
    if (st.tab === 'progress') renderSlot($('progSlot'), w ? null : 'progress', visits.progress);
    renderSlot($('slotStrip'), p && p[0], p && p[1]);
    adSync(); /* F3b: the banner follows the slot, in the same step */
  }
  /* When the window turns from phone to desktop layout or back, the slot moves between its place and the strip. */
  var wasWide = null;
  /* G2d fix round 1: a phone turned upright with the sideways column scrolled would show the upright page scrolled, the board
     off the top. When the board stops being pinned on the board screen, the page starts at the top. */
  var wasPinned = false;
  function pinned() { var b = $('board'); return !!b && b.getClientRects().length > 0 && getComputedStyle(b).position === 'fixed'; }
  window.addEventListener('resize', function () { var p = pinned(); if (wasPinned && !p && actOpen() && window.scrollY > 0) window.scrollTo(0, 0); wasPinned = p; });
  window.addEventListener('resize', function () { var w = wide(); if (w === wasWide) return; wasWide = w; if (!booted) return; render(); if (st.end) renderPath(); });

  /* ---------- ADS GLUE (F3b, docs/specs/ads.product.md). The only code that talks to the native ads plugin. The rules are in
     ads.js (pure); this reads the screen's facts, asks Ads.mayShow, and shows or hides one native banner strip.
     - Android app only. On the web ads.js is not even loaded (scripts/build.sh), so window.Ads is missing, AD is null, the
       state is 'off' and nothing below runs (A-D9).
     - The start-up is decided ONCE, at app start (adBoot), from day two (A-D7, A-D11): Google is asked once whether consent is
       needed (a check that shows nothing, so it runs even if the app starts in an unfinished game). On day one, and before a
       level is set, there is no plugin call at all; an app left open over midnight stays silent until the next app start.
     - The answer sets the "Privacy choices" row for the session. If ads can already be requested (no consent needed, or given
       earlier), the SDK starts and the banner follows its normal rules. If a form is required, it is shown only if, when the
       answer arrives, no activity and no sheet, level check or question from Rani is open; otherwise there is no form and
       there are no ads in this session, and the next app start decides again. The form is never shown later in a session.
       What remains: the plugin downloads the form between our call and its display (usually well under a second), so a
       player who opens something in that moment can see the form appear over it.
     - No ad is requested until Google says ads can be requested. If the consent check fails (offline), no ads this session.
     - Hide first, show late: adSync runs inside renderSlots and wherever a sheet, a note or the level check opens or closes,
       so the banner is told to hide in the same step that changes the screen. It shows or comes back no sooner than 1 second
       after the screen or card that allows it was drawn, or after a sheet or note closed (A-D15, accidental taps).
     - Any failure (no ad, a plugin error) leaves the screen as it is without ads: no strip, no gap, nothing logged (A-D13).
     States: off | consent | form | init | ready | noads | noform (a form was due but could not be shown: no ads this session).
     Banner: none | shown | hidden. ---------- */
  var ADS = window.Ads || null;
  var AD = (function () {
    if (!ADS) return null;
    try { var C = window.Capacitor; if (!C || !C.Plugins || !C.Plugins.AdMob) return null; if (typeof C.isNativePlatform === 'function' && !C.isNativePlatform()) return null; return C.Plugins.AdMob; } catch (e) { return null; }
  })();
  var ad = { room: 0, lastH: 0, push: null, state: 'off', banner: 'none', loaded: false, margin: 0, h: 0, ok: false, place: null, visit: null, since: NaN, timer: null, retry: null, retryAt: 0, info: null, form: false, inited: false, err: '', facts: null };
  function adNow() { return window.performance && performance.now ? performance.now() : Date.now(); }
  function adNoop() {}
  /* Test builds only: the last failure, in words, for the state line in Settings (Ads.debugLine). Never shown with real ads on. */
  function adErr(step, e) { var m = ''; try { m = e && (e.message || e.error || (typeof e === 'string' ? e : JSON.stringify(e))) || ''; } catch (x) {} ad.err = step + ': ' + (m || 'failed'); }
  function adDebug() {
    var el = $('adDebug'); if (!el) return;
    var t = '';
    try { if (window.Capacitor) t = !ADS ? 'Ads test: rules file not loaded' : !AD ? 'Ads test: plugin not found' : ADS.debugLine(ad); } catch (e) {}
    el.textContent = t; el.hidden = !t;
  }
  /* One plugin call. Always a promise; a throw becomes a rejection, so no caller can leak an error. */
  function adCall(m, a) { try { var r = a === undefined ? AD[m]() : AD[m](a); return r && typeof r.then === 'function' ? r : Promise.resolve(r); } catch (e) { return Promise.reject(e); } }
  /* A-D12: a sheet, a dialog or an offer is open: Settings, the level check, any of Rani's notes, or one of Google's forms */
  function adOverlay() { var sh = $('settingsSheet'); return !!((sh && !sh.hidden) || Placement.isOpen() || noteCur || ad.form); }
  /* Criterion 1: the slot rule's own answer for the screen the player is on (the place stripPlace names, on phones too). */
  var AD_CARD = { game: 'gameEnd', learn: 'learnEnd', step: 'sessionCard' };
  /* A-D19: on Home the banner never shares the screen with the board, moved or not. The board column is hidden on Beginner Home. */
  function adBoard(place) { if (place !== 'home') return false; var b = document.querySelector('.boardcol'); return !b || b.getClientRects().length > 0; }
  function adFacts() {
    var p = stripPlace();
    /* an end card counts once it is on screen (the state changes a moment before the card is drawn) */
    if (p && AD_CARD[p[0]]) { var c = $(AD_CARD[p[0]]); if (!c || c.hidden) p = null; }
    return { place: p ? p[0] : null, visit: p ? p[1] : null, slot: !!p && slotAllowed(p[0], p[1]), native: !!AD, firstDay: Tips.firstDay(prof, Date.now()), level: prof.level || null,
      activity: activityOn(), overlay: adOverlay(), board: adBoard(p ? p[0] : null), height: window.innerHeight };
  }
  function adTabsFixed() { var t = document.querySelector('.tabs'); return !!t && getComputedStyle(t).position === 'fixed'; }
  /* A-D14: the page's bottom padding: an empty box, the last thing in the page. Only while the banner is on screen WITH an ad
     in it (a size from the plugin and a loaded ad), so an empty strip never reserves space. */
  function adPad() {
    var el = $('adPad'); if (!el) return;
    var h = Math.max(ad.banner === 'shown' && ad.loaded ? ADS.padFor(ad.h, ad.margin > 0) : 0, ad.room); /* never less than the room an end card keeps: nothing moves in the moment before the banner reports its size */ /* ad.room: kept free for a banner on its way to an end card */
    if (h > 0) { el.style.height = h + 'px'; el.hidden = false; } else if (!el.hidden) el.hidden = true;
  }
  function adHide() {
    clearTimeout(ad.retry); ad.retry = null;
    if (ad.banner === 'shown') { ad.banner = 'hidden'; adCall('hideBanner').catch(adNoop); }
    adPad();
  }
  /* No ad came: nothing on screen, no gap. While the same screen stays open, one check a minute later (a single timer). */
  function adLost(e) { if (e !== undefined) adErr('ad load', e); ad.banner = 'none'; ad.loaded = false; ad.h = 0; ad.retryAt = adNow() + 60000; ad.room = 0; adPad(); giveBack(); adSync(); } /* the room kept for it on an end card is given back */
  /* A plugin call for the banner failed: remove whatever the native side has, so the page and the native side cannot disagree. */
  function adDrop(e) { adErr('banner call', e); adCall('removeBanner').catch(adNoop); adLost(); }
  function adShow() {
    var m = ADS.marginFor(adTabsFixed());
    if (ad.banner === 'shown' && ad.margin === m) return;
    if (ad.banner === 'hidden' && ad.margin === m) { ad.banner = 'shown'; adCall('resumeBanner').catch(adDrop); return; }
    if (ad.banner === 'none') {
      var left = ad.retryAt - adNow();
      if (left > 0) { if (!ad.retry) ad.retry = setTimeout(function () { ad.retry = null; adSync(); }, left + 20); adPad(); return; }
    }
    /* a new banner, or the same one moved (the layout changed between phone and wide): the plugin keeps the ad and moves it */
    var moved = ad.banner !== 'none';
    ad.margin = m; ad.banner = 'shown'; if (!moved) { ad.loaded = false; ad.h = 0; }
    var r = adCall('showBanner', ADS.bannerOptions({ margin: m }));
    (moved ? r.then(function () { return ad.banner === 'shown' ? adCall('resumeBanner') : null; }) : r).catch(adDrop);
    adPad();
  }
  function adSync() {
    if (!AD || !booted || ad.state === 'off') return;
    var f = adFacts(), now = adNow(), ok = ADS.mayShow(f);
    if (!f.overlay) ad.facts = f; /* the last facts with no sheet open, for the test state line */
    /* Fix round 1: a phone's end card that will get the banner keeps its room from the moment the card is drawn. Not when
       no ad came (the retry wait): an empty strip never reserves space. */
    ad.room = Flow.bannerRoom({ expected: phone() && ok && ad.state === 'ready' && !!AD_CARD[f.place] && !(ad.banner === 'none' && ad.retryAt > now), h: ad.h || ad.lastH, fixedTabs: adTabsFixed() });
    /* The 1 second clock starts at the first frame after the screen that allows the banner is drawn (when the player can
       see it), and again whenever the banner becomes allowed: a new screen or card, a sheet or note closed, the phone upright. */
    if (!ok) { ad.ok = false; ad.place = null; ad.visit = null; ad.since = NaN; }
    else if (!ad.ok || f.place !== ad.place || f.visit !== ad.visit) {
      ad.ok = true; ad.place = f.place; ad.visit = f.visit; ad.since = NaN;
      var pl = f.place, vi = f.visit;
      /* two frames: the first draws the screen, the second begins once the player can see it */
      requestAnimationFrame(function () { requestAnimationFrame(function () { if (ad.ok && ad.place === pl && ad.visit === vi && isNaN(ad.since)) { ad.since = adNow(); adSync(); } }); });
    }
    var want = ad.state === 'ready' && ok, wait = want ? ADS.waitLeft(ad.since, now) : 0;
    clearTimeout(ad.timer); ad.timer = null;
    if (want && wait > 0) { want = false; if (!isNaN(ad.since)) ad.timer = setTimeout(adSync, wait); } /* no clock yet: the frame above calls back */
    if (want) adShow(); else adHide();
  }
  /* The session has no ads (the consent check failed, or a plugin error during start-up). Nothing is retried until the next app start. */
  function adFail(e) { adErr('start (' + ad.state + ')', e); ad.form = false; ad.state = 'off'; if (ad.banner === 'shown') { ad.banner = 'hidden'; adCall('hideBanner').catch(adNoop); } adPad(); }
  function adChoice() { var b = $('privChoices'); if (b) b.hidden = !ADS.hasChoice(ad.info); } /* A-D17 */
  /* A-D7, A-D11: asked once, when the app has started. A no leaves the state 'off' for the whole session. */
  function adBoot() {
    if (!AD || ad.state !== 'off' || ad.booted) return;
    ad.booted = true;
    var f = adFacts(); f.boot = true;
    if (!ADS.mayStart(f)) { ad.err = 'not started: first day or no level'; return; }
    ad.state = 'consent';
    adCall('requestConsentInfo').then(function (info) { ad.info = info || null; adChoice(); adConsent(); }).catch(adFail);
  }
  /* Google's form, only if required, and only if nothing is open at this moment (the answer has just arrived): no activity,
     no Settings, no level check, no question from Rani (an offer). A plain note from Rani does not count. Otherwise: no form
     and no ads in this session. */
  function adConsent() {
    if (!ADS.needsForm(ad.info)) { adReady(); return; }
    var sh = $('settingsSheet'), open = !!((sh && !sh.hidden) || Placement.isOpen() || (noteCur && noteCur.kind !== 'info'));
    if (!ADS.mayForm({ activity: activityOn(), overlay: open })) { ad.state = 'noform'; return; }
    ad.state = 'form'; ad.form = true;
    adCall('showConsentForm').then(function (info) {
      ad.form = false;
      if (info) ad.info = { status: info.status, isConsentFormAvailable: false, canRequestAds: info.canRequestAds, privacyOptionsRequirementStatus: info.privacyOptionsRequirementStatus };
      adChoice(); adReady();
    }).catch(adFail);
  }
  function adListen() {
    function on(name, fn) { try { var r = AD.addListener(name, fn); if (r && typeof r.catch === 'function') r.catch(adNoop); } catch (e) {} }
    /* the height the plugin reports (0 when the banner is hidden, removed or has no ad) */
    on('bannerAdSizeChanged', function (s) { ad.h = s && +s.height > 0 ? +s.height : 0; if (ad.h) ad.lastH = ad.h; adPad(); });
    on('bannerAdLoaded', function () { if (ad.banner === 'none') return; ad.loaded = true; ad.err = ''; if (ad.banner === 'hidden') adCall('hideBanner').catch(adNoop); adPad(); });
    on('bannerAdFailedToLoad', adLost);
  }
  function adReady() {
    if (!ADS.canRequest(ad.info)) { ad.err = 'Google says ads cannot be requested'; ad.state = 'noads'; adHide(); return; }
    if (ad.inited) { ad.state = 'ready'; adSync(); return; }
    ad.state = 'init'; adListen();
    adCall('initialize', ADS.initOptions()).then(function () { ad.inited = true; ad.state = 'ready'; adSync(); }).catch(adFail);
  }
  /* A-D17: "Privacy choices" reopens Google's form; afterwards Google is asked again whether ads can be requested. */
  function adChoices() {
    if (!AD || !ADS.hasChoice(ad.info) || ad.form || ad.state === 'off') return;
    ad.form = true; adSync();
    adCall('showPrivacyOptionsForm').catch(adNoop).then(function () { return adCall('requestConsentInfo'); }).then(function (info) {
      ad.form = false; ad.info = info || ad.info; adChoice();
      if (ADS.canRequest(ad.info)) { if (ad.state === 'noads') adReady(); else adSync(); return; }
      if (ad.banner !== 'none') { ad.banner = 'none'; ad.loaded = false; ad.h = 0; adCall('removeBanner').catch(adNoop); }
      if (ad.state === 'ready') ad.state = 'noads';
      adSync();
    }).catch(function () { ad.form = false; adSync(); });
  }
  /* A-D4: a turned phone or a resized window decides again at once. */
  if (AD) { window.addEventListener('resize', adSync); window.addEventListener('orientationchange', adSync); }

  /* ---------- F1: end cards. One main button (the next step), small buttons for the other choices, always a Home button.
     Flow (flow.js) decides which card; this wires each button to an action the app already has. ---------- */
  function ecBtn(b, attrs, cls) { return '<button class="btn ' + cls + '" type="button" ' + (attrs[b.go] || '') + '>' + esc(b.label) + '</button>'; }
  function ecButtons(c, attrs) {
    return (c.line ? '<p class="ec-line">' + esc(c.line) + '</p>' : '') + '<div class="ec-btns">' + (c.main ? ecBtn(c.main, attrs, 'primary big ec-main') : '') +
      (c.small.length ? '<div class="ec-smalls">' + c.small.map(function (b) { return ecBtn(b, attrs, 'ec-small'); }).join('') + '</div>' : '') + '</div>';
  }
  function partAttr(u, k) { return 'data-act="epart" data-u="' + u + '" data-k="' + k + '"'; }
  /* F-D25: one source for the next step. Every end card names the step of the Home the player sees: Beginner Home
     (plain(): Home.state, Foundations only, D39) or the full Home (nextAction; a Beginner with Show everything on too, D40). */
  function lessonAfter() {
    if (plain()) { var s = homeState(); return s.kind === 'lesson' ? { unit: s.unit, part: s.part, title: s.unit.title } : null; }
    var a = nextAction(currentStage()).info;
    return a.kind === 'lesson' ? { unit: a.unit, part: a.part, title: a.unit.title } : null;
  }
  /* Beginner Home with its Foundations lessons done: the end card follows it ("Play now" or "Start 10 puzzles"). */
  function beginnerAfter() {
    if (!plain()) return null;
    var s = homeState(); if (s.kind === 'lesson') return null;
    var L = Home.lines(s, Coach3D.get(), gameOn());
    return { button: L.button, attr: bhAttr(s)[L.go] };
  }
  /* The player's next step, as Home's Continue card names it (Beginner Home's card, or the Improver and Club card). */
  function stepCard() {
    if (plain()) { var s = homeState(), L = Home.lines(s, Coach3D.get(), gameOn()); return { title: L.title, button: L.button, attr: bhAttr(s)[L.go], lesson: s.kind === 'lesson' }; }
    var C = contCard(); return { title: C.title, button: C.button, attr: contAttr(C), lesson: C.go === 'part' };
  }
  /* What follows a passed part of lesson u: its next undone part (F-D23: np, and kind in Flow's words), else the next lesson. */
  function unitNext(u, passed) {
    var U = UNIT[u], np = U && passed ? nextPart(U) : null;
    return { np: np, kind: partKind(U, np), nx: U && passed && !np ? lessonAfter() : null };
  }
  function partKind(U, np) { return !np ? null : np === 'practice' ? 'practice' : np === 'apply' && U.apply.type === 'game' ? 'game' : 'other'; }
  /* R6: an end card that appears through the player's own action is read out (politely), and when the control that led
     to it is gone, focus goes to the card's heading. Never when the app opens, never during a drag. */
  function cardShown(el) {
    if (!booted || !el) return;
    var live = $('endLive'), parts = [];
    ['.ec-title', '.ec-text', '.ec-line'].forEach(function (q) { var e = el.querySelector(q); if (e && e.textContent) parts.push(e.textContent); });
    if (live) { live.textContent = ''; var say = parts.join(' '); setTimeout(function () { live.textContent = say; }, 60); }
    var a = document.activeElement, h = el.querySelector('.ec-title');
    if (h && !drag && (!a || a === document.body || !a.isConnected || a.offsetParent === null)) try { h.focus({ preventScroll: true }); } catch (e) {}
    rateSoon(el); /* D2 (DP-D4): right after a happy moment's end card shows */
  }
  /* The last move of a finished game's review, reached by stepping there (a review opens on the last move). */
  function reviewDone() { var rv = st.rv; return !!(st.mode === 'review' && rv && rv.stepped && rv.sans.length && rv.ply === rv.sans.length && (rv.past || G.game_over())); }
  function navTo(p) { if (st.rv) { st.rv.stepped = true; gotoPly(p); } }
  /* F-D9: the game result is a card under the board, so the final position stays in view. */
  var endFull = null; /* the finished game whose full result card (with buttons) is on screen, for the desktop slot strip */
  function renderEnd() {
    var el = $('gameEnd'), html = '', key = '', full = false;
    if (st.mode === 'play') {
      var r = result(G, st.user); st.over = !!r;
      if (r && phone() && st.scr !== 'act') r = null; /* G2a: on a phone the result card is on the board screen only */
      if (r) {
        /* The game itself is the card's identity (R1): recording it, or a cloud pull of the profile, changes nothing here. */
        key = 'g' + G.history().length + '|' + G.fen();
        var gl = st.goal, T = 'class="ec-title" tabindex="-1">' + esc(speak(r.title));
        if (st.tab !== 'play') html = '<p ' + T + '</p>'; /* F-D24: off the Play tab, one line and no buttons */
        else {
          html = '<h3 ' + T + '</h3><p class="ec-text">' + esc(speak(r.text)) + '</p>';
          /* R2: a lesson game's buttons wait until its task is decided (the last move is still being checked), so the
             main button never changes under the finger */
          full = !(gl && gl.status === 'active');
          if (full) {
            seenEnd(); /* G-D36: the player sees the game's end card: its result card goes */
            endFull = key; /* known before the slot is asked for: an end card that is up means the board is no longer in use */
            var n = gl ? unitNext(gl.unit, gl.status === 'done') : { np: null, kind: null, nx: null };
            var c = Flow.afterGame({ goal: gl ? gl.status : null, nextPart: n.kind, next: n.nx });
            html += ecButtons(c, { review: 'data-act="review"', newgame: 'data-act="again"', home: 'data-act="home"', part: n.np ? partAttr(gl.unit, n.np) : '', nextlesson: n.nx ? partAttr(n.nx.unit.id, n.nx.part) : '', tryagain: gl ? 'data-apply="' + gl.unit + '"' : '' }) +
              slotHost('game', key);
          }
        }
      }
    }
    endFull = full ? key : null;
    if (!html) { el.hidden = true; el._h = ''; el._k = ''; }
    else {
      el.classList.toggle('ec-oneline', st.tab !== 'play');
      if (el._h !== html) { el._h = html; el.innerHTML = html; }
      el.hidden = false;
      renderSlot(el.querySelector('[data-slot]'), 'game', key);
      /* Brought into view and read out once per game, when the last move's check is over (the rows above the board
         are settled by then, so the whole board stays on screen). Never when the app opens. */
      if (full && !st.busy && el._k !== key) { el._k = key; if (booted) { revealEnd(el); cardShown(el); } }
    }
    /* The last move of a finished game's review: its card sits under the Prev and Next controls (R7). No slot (F-D17). */
    var rv = $('reviewEnd'), rh = '';
    if (reviewDone()) {
      var sc = stepCard(), c2 = Flow.afterReview(sc);
      rh = '<h3 class="ec-title" tabindex="-1">' + esc(c2.title) + '</h3><p class="ec-line">' + esc(c2.line) + '</p>' +
        ecButtons({ line: null, main: c2.main, small: c2.small }, { step: sc.attr, newgame: 'data-act="rvnew"', home: 'data-act="home"' });
    }
    if (rv._h !== rh) { rv._h = rh; rv.innerHTML = rh; }
    rv.hidden = !rh;
    if (!rh) rv._k = ''; else if (!rv._k) { rv._k = 'r'; if (booted) { revealEnd(rv); cardShown(rv); } }
  }
  var booted = false, revealN = 0;
  /* Fix round 1: after "Next" on a phone's board screen (the button is under the fold) the new item starts with the board
     back at the top of the screen, just under the Close bar. */
  function boardUp() { if (actOpen() && window.scrollY > 0) window.scrollTo(0, 0); }
  /* G2a: the board screen's sticky Close bar covers the top of the page: "the whole board stays on screen" means under it */
  function barBottom() { var b = $('actBar'); return b && b.getClientRects().length ? Math.max(0, b.getBoundingClientRect().bottom) : 0; }
  /* How far the page may scroll before the board's top leaves the screen. G2d (G-D32): on a phone held sideways the board is
     pinned beside the column and cannot leave; there the limit is the card's own top, which stays under the Close bar. */
  function boardRoom(el) {
    var b = $('board');
    if (getComputedStyle(b).position === 'fixed') return Math.max(0, el.getBoundingClientRect().top - barBottom() - 8);
    return b.getBoundingClientRect().top - barBottom();
  }
  /* When the card first shows, bring it on screen if the whole board can stay on screen too (never during a drag). */
  function revealEnd(el) {
    revealN++;
    if (!window.requestAnimationFrame) return;
    requestAnimationFrame(function () { revealNow(el, true); });
  }
  /* Fix round 1 (ads criterion 5): when a banner is on its way to this end card (ad.room, set by adSync in the same step
     as the card), the card is placed as if the banner were already up: every button of the card ends above the banner's
     zone, even if the board has to give way, and the page padding is already there, so nothing moves when it arrives. */
  function revealNow(el, own) {
    var nav = document.querySelector('.tabs'); if (drag || !el.isConnected || el.hidden) return;
    var bottom = (nav && nav.getClientRects().length && getComputedStyle(nav).position === 'fixed' ? nav.getBoundingClientRect().top : window.innerHeight) - ad.room;
    var d = el.getBoundingClientRect().bottom + 8 - bottom, bt = boardRoom(el), need = 0;
    if (ad.room) { var bs = el.querySelectorAll('.ec-btns button'); for (var i = 0; i < bs.length; i++) if (bs[i].getClientRects().length) need = Math.max(need, bs[i].getBoundingClientRect().bottom - bottom); }
    /* with a banner coming: the least that puts the last button above its zone, never further (fix round 2). Without one:
       the whole card, as far as the board allows. */
    var by = ad.room ? need : d > 0 && bt >= 0 ? Math.min(d, bt) : 0;
    if (ad.room) ad.push = { el: el, y: window.scrollY, own: !!own };
    if (by <= 0) return;
    window.scrollBy({ top: by, behavior: window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  }
  /* A Learn or set end card: no scroll of its own (as before), unless a banner is coming to it. */
  /* Fix round 2: no ad came for the end card on screen: its scroll goes back to where it is without a banner. */
  function giveBack() {
    var p = ad.push; ad.push = null;
    if (!p || !p.el.isConnected || p.el.hidden || !p.el.getClientRects().length || !actOpen()) return;
    window.scrollTo(0, p.y);
    if (p.own) revealNow(p.el, true);
  }
  function clearBanner(el) { if (window.requestAnimationFrame) requestAnimationFrame(function () { if (ad.room) revealNow(el); }); }
  /* F-D7: an end card is on screen (after a lesson step or a puzzle set): its main button is the screen's one main button. */
  function sesEnded() { return !!(st.ses && (st.ses.finished || st.ses.end)); }
  /* R3: scoped to the tab the card is on, so a Learn end card never takes Train's main button away. */
  function endOn(tab) { return (tab === 'path' && !!st.end) || (sesEnded() && ZTAB[zoneOf()] === tab); }
  /* After a lesson step or puzzle set. u: the lesson's id (or null); from: 'learn' | 'session'; s: the set (or null). */
  function stepEnd(u, from, passed, s) {
    var U = u ? UNIT[u] : null, n = unitNext(u, passed), np = n.np, nx = n.nx, o = (s && s.opts) || {};
    var af = U && passed && !np && !nx ? beginnerAfter() : null;
    /* F-D26: "10 more puzzles" is for a mixed set at the player's level only; a themed set ends with Go again */
    var c = Flow.afterStep({ unit: !!U, from: from, passed: passed, nextPart: n.kind,
      next: nx, after: af, set: o.review ? 'review' : s && s.kind === 'puzzles' && !o.theme ? 'puzzles' : 'other' });
    return ecButtons(c, { home: 'data-act="home"', again: from === 'learn' ? 'data-part="learn" data-u="' + u + '"' : 'data-again="1"', part: U && np ? partAttr(u, np) : '',
      nextlesson: nx ? partAttr(nx.unit.id, nx.part) : '', after: af ? af.attr : '', more: 'data-act="more"' });
  }
  /* D49: a main button that would start a lesson game while another game is unfinished asks first. */
  function goPart(u, k) {
    var U = UNIT[u]; if (!U) return;
    if (Flow.asks(k, U.apply && U.apply.type, gameOn())) { askFirst(u); return; }
    st.unitOpen = u; startPart(u, k);
  }

  /* ---------- game flow ---------- */
  function resetHints() { st.hintLvl = 0; st.hls = []; st.arrows = []; }
  function userMove(from, to) {
    if (!interactive()) return;
    if (st.mode === 'puzzle') return puzzleMove(from, to);
    if (st.mode === 'drill') return drillMove(from, to);
    if (st.mode === 'book') return bookMove(from, to);
    if (st.mode === 'placement') return placementMove(from, to);
    var fenBefore = G.fen(), mv = G.move({ from: from, to: to, promotion: 'q' }), gid = st.gid;
    if (!mv) return;
    /* Fix round 1: a move on the board under a Learn end card (phones) is a move in the game: the end card is over in the same
       step, so the tabs, the tip and the banner go and the Close bar reads the game. */
    if (st.end && phone()) { st.end = null; if (st.scr === 'act') switchTab('play'); }
    save(); /* saved at once, before the move is graded: an app closed in that moment keeps the move */
    st.sel = null; resetHints(); st.gb = true; st.opp = null; st.think = null; st.confirmNew = false;
    var words = Words.say(mv, true);
    st.fb = { cls: 'info', sym: '♙', title: 'Checking your move…', mv: 'You played ' + mv.san, words: words };
    render();
    var ply = G.history().length - 1;
    /* gid: every step of this chain belongs to the game the move was made in. A new game started meanwhile gets nothing from it. */
    gradeUserMove(fenBefore, mv, gameAt(G.history(), ply + 1), st.user).then(function (n) {
      if (gid !== st.gid) return;
      st.notes[ply] = n; st.ann[ply] = n.cls; if (n.tag) st.tags[ply] = n.tag; st.evalW = n.ev;
      st.fb = { cls: n.cls, sym: CLS[n.cls].sym, title: CLS[n.cls].title, mv: 'You played ' + mv.san, words: words, text: n.text, tip: n.tip };
    }).catch(function () { if (gid !== st.gid) return; st.fb = { cls: 'info', sym: '♙', title: 'Move played', mv: mv.san, words: words }; }).then(function () {
      if (gid !== st.gid) return; /* a new game was started while this move was being checked */
      checkGoal(); save();
      if (G.game_over()) { st.gb = false; finishGame(); render(); return; }
      render(); engineTurn();
    });
  }
  function pickWithin(res, margin) { var top = res[0].score, pool = res.filter(function (x) { return x.score >= top - margin; }); return pool[Math.floor(Math.random() * pool.length)]; }
  function engineChoose(fen) {
    var lv = st.level;
    if (lv <= 3) return wait(250).then(function () {
      var r = lv === 1 ? pickWithin(Eng.analyze(fen, 1, 600), Math.random() < 0.15 ? 400 : 160) : lv === 2 ? pickWithin(Eng.analyze(fen, 2, 900), 45) : pickWithin(Eng.analyze(fen, 3, 1500), 15);
      return r ? r.key : null;
    });
    if (lv === 8) return Brain.play(fen, { skill: 20, movetime: 900, fbDepth: 6 });
    return Brain.play(fen, { elo: OPP[lv].elo, movetime: 500, fbDepth: lv >= 6 ? 6 : 5 });
  }
  /* G2b: the game goes on while it is closed (G-D20: a lesson or set may be on the board meanwhile). Its reply writes only
     what belongs to the game: st.gb, never the board's shared arrows unless the game is the one on the board. */
  function engineTurn() {
    st.gb = true; render();
    var fen = G.fen(), gid = st.gid;
    engineChoose(fen).then(function (uci) {
      if (gid !== st.gid || G.fen() !== fen) return;
      var m = uci && findMove(G, uci); if (!m) m = G.moves({ verbose: true })[0];
      if (!m) { st.gb = false; render(); return; }
      var gBefore = new Chess(fen);
      G.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
      if (st.mode === 'play') st.arrows = [{ from: m.from, to: m.to, color: 'var(--c-blund)' }];
      if (G.history().length === 1) st.fb = { cls: 'info', sym: '♙', title: 'Your move', mv: 'You play Black', noSan: true, text: 'Answer in the center and get a knight out.', tip: '<b>First 10 moves:</b> center pawns, knights and bishops out, then castle.' };
      render();
      if (G.game_over()) { finishGame(); st.gb = false; save(); render(); return; }
      return analyseForUser().then(function (res) {
        if (gid !== st.gid) return; /* a new game was started while the reply was being explained */
        var why;
        try { why = explainEngineMove(gBefore, m, G, st.user, res.th); } catch (e) { why = [{ c: '', h: cap1(describe(m, 'its')) + '.' }]; }
        var ply = G.history().length - 1;
        st.notes[ply] = { side: 'e', why: why, ev: st.evalW };
        st.opp = { san: m.san, why: why };
        st.gb = false; save(); render();
      });
    }).catch(function () { st.gb = false; render(); });
  }
  function analyseForUser() {
    var fen = G.fen();
    return Brain.analyse(fen, { depth: 12, multipv: 3, fbDepth: 3 }).then(function (lines) {
      if (G.fen() !== fen) return { th: null };
      var best = lines[0] ? lines[0].score : 0;
      st.evalW = st.user === 'w' ? best : -best;
      return threatOf(G, best).then(function (th) {
        if (G.fen() === fen) { try { st.think = thinkFor(G, st.user, lines, th); } catch (e) { st.think = null; } }
        return { th: th };
      });
    });
  }
  function takeBack() {
    if (st.busy || st.mode !== 'play') return;
    var h = G.history({ verbose: true });
    if (!h.some(function (m) { return m.color === st.user; })) return;
    if (G.turn() === st.user) G.undo();
    G.undo();
    var n = G.history().length;
    [st.ann, st.notes, st.tags].forEach(function (o) { Object.keys(o).forEach(function (k) { if (+k >= n) delete o[k]; }); });
    st.sel = null; resetHints(); st.recorded = false; st.opp = null;
    var prev = st.notes[n - 1]; st.evalW = prev && typeof prev.ev === 'number' ? prev.ev : 0;
    if (prev && prev.side === 'e') st.opp = { san: G.history()[n - 1], why: prev.why };
    if (st.goal && st.goal.status === 'failed' && st.goal.type !== 'win') { st.goal.status = 'active'; st.goal.kept = false; }
    st.fb = { cls: 'info', sym: '♙', title: 'Taken back', text: 'Your move again. Check their threats first, then your checks and captures.' };
    st.think = null; render();
    analyseForUser().then(function () { save(); render(); });
  }
  function newGame(force, opts) {
    opts = opts || {};
    /* Fix round 1: on a phone the question comes whatever is on the board (a closed lesson or set may be waiting over the game) */
    if (!force && (st.mode === 'play' || phone()) && G.history().length > 2 && !G.game_over() && !st.confirmNew) { st.confirmNew = true; $('newConfirm').hidden = false; st.scr = 'tabs'; switchTab('play'); return; } /* G2a: the question is on Play's start page */
    $('newConfirm').hidden = true; st.confirmNew = false; st.nm = null; /* G1: a new game clears the name line */
    rateReset(); /* D2 (fix 3) */
    stow('play'); /* G2b, G-D35: a lesson or set that is open waits on its own tab, at every width */
    clearSession(); st.mode = 'play'; st.rv = null;
    st.gid = (st.gid || 0) + 1; st.gb = false; /* the old game's engine or grading reply is dropped: the new game is playable at once */
    var c = opts.color || $('colorSel').value; if (c === 'r') c = Math.random() < 0.5 ? 'w' : 'b';
    /* D19: a Beginner's "New game" always plays Rani's practice partner (the Beginner bot); lesson tasks pass their own level. */
    st.user = c; st.level = opts.level || (plain() ? Profile.LEVELS.beginner.opp : +$('levelSel').value); $('levelSel').value = String(st.level);
    st.goal = opts.goal || null;
    G.reset(); st.ann = {}; st.notes = {}; st.tags = {}; st.sel = null; resetHints(); st.evalW = 20; st.flipped = false; st.over = false; st.recorded = false; st.opp = null; st.think = null;
    st.unseen = false; st.fbPre = null; /* G-D36: a new game ends the old game's result card */
    st.fb = st.user === 'w'
      ? { cls: 'info', sym: '♙', title: 'Your move', mv: 'You play White', noSan: true, text: 'Grab the center. ' + mvcSan(START_FEN, 'e4') + ' or ' + mvcSan(START_FEN, 'd4') + ' are the classic first moves. Tap a piece to see where it can go.', tip: '<b>First 10 moves:</b> center pawns, knights and bishops out, then castle.' }
      : { cls: 'info', sym: '♙', title: 'Engine to move', mv: 'You play Black', noSan: true };
    checkGoal(); save(); openAct(); switchTab('play'); render();
    if (st.user === 'b') engineTurn(); else analyseForUser().then(render);
  }

  /* ---------- course goals during games ---------- */
  function checkGoal() {
    var gl = st.goal; if (!gl || gl.status !== 'active') return;
    var mine = G.history({ verbose: true }).filter(function (m) { return m.color === st.user; }), r = result(G, st.user);
    if (gl.type === 'develop') {
      var d = devState(G, st.user);
      gl.progress = 'Minor pieces out: ' + d.minors + '/4 · Castled: ' + (d.castled ? 'yes' : 'no') + ' · Your moves: ' + mine.length + '/12';
      if (d.minors >= 4 && d.castled) goalDone(gl); else if (mine.length >= 12 || r) gl.status = 'failed';
    } else if (gl.type === 'noBlunder') {
      var bl = Object.keys(st.ann).filter(function (k) { return st.ann[k] === 'blund'; }).length;
      gl.progress = 'Your moves: ' + Math.min(mine.length, 20) + '/20 · Blunders: ' + bl;
      if (bl) gl.status = 'failed'; else if (mine.length >= 20 || (r && r.r !== 'L')) goalDone(gl); else if (r) gl.status = 'failed';
    } else if (gl.type === 'win') {
      gl.progress = 'Win the game to pass.';
      if (r) { if (r.r === 'W') goalDone(gl); else gl.status = 'failed'; }
    }
  }
  function goalDone(gl) { gl.status = 'done'; markUnit(gl.unit, 'apply'); }

  /* ---------- hints ---------- */
  function hint() {
    if (!interactive()) return;
    var g = viewGame();
    var getBest = st.mode === 'play' && st.think && st.think.best ? Promise.resolve(st.think)
      : st.mode === 'puzzle' ? Promise.resolve(puzzleHintData())
      : st.mode === 'book' ? Promise.resolve(bookHintData())
      : Brain.analyse(g.fen(), { depth: 14, multipv: 1, fbDepth: 4 }).then(function (a) { var m = a[0] && findMove(g, a[0].uci); return m ? { best: { from: m.from, to: m.to, san: m.san, why: describe(m, 'your') }, theme: { idea: 'Find the strongest move. Start with checks and captures.' } } : null; });
    var tok = boardId, game = st.mode === 'play';
    st.busy = true; render();
    getBest.then(function (t) {
      /* G2b: the board changed hands while the hint was worked out: it is dropped (clearSession already reset st.ab) */
      if (game) st.gb = false; else if (tok === boardId) st.ab = false;
      if (tok !== boardId || game !== (st.mode === 'play')) { render(); return; }
      if (!t || !t.best) { render(); return; }
      if (game && !st.hintLvl) st.fbPre = st.fb; /* fix round 1: what the coach line said before the first hint */
      st.hintLvl = Math.min(3, st.hintLvl + 1);
      var fb;
      if (st.hintLvl === 1) { st.arrows = []; fb = { cls: 'info', sym: '♘', title: 'Hint 1: the idea', text: t.theme.idea, tip: 'Still stuck? Tap Hint again and I’ll show you which piece to move.' }; }
      else if (st.hintLvl === 2) { st.hls = [t.best.from]; fb = { cls: 'info', sym: '♘', title: 'Hint 2: the piece', text: t.theme.idea + ' The piece to move is highlighted on ' + t.best.from + '.', tip: 'Where can it go that does the most?' }; }
      else { st.hls = []; st.arrows = [{ from: t.best.from, to: t.best.to }]; fb = { cls: 'info', sym: '♘', title: 'Hint 3: the move', mv: 'Try ' + t.best.san, text: 'The arrow shows it. ' + mvc(t.best) + ' ' + t.best.why + '. Before you play it, see if you can say why it works.' }; }
      if (st.mode === 'play') st.fb = fb; else if (st.ses) st.ses.msg = fb;
      render();
    });
  }

  /* ---------- finished games ---------- */
  function summarize(ann, tags, userColor, sans) {
    var counts = { best: 0, good: 0, inacc: 0, mist: 0, blund: 0 }, tot = 0, n = 0;
    Object.keys(ann).forEach(function (k) { var c = ann[k]; if (counts[c] == null) return; counts[c]++; tot += CLS[c].acc; n++; });
    var tg = {}; Object.keys(tags || {}).forEach(function (k) { var t = tags[k]; tg[t] = (tg[t] || 0) + 1; });
    if (sans && sans.length > 30) { var g = gameAt(sans, sans.length); if (!devState(g, userColor).castled && !tg.noCastle) tg.noCastle = 1; }
    return { counts: counts, acc: n ? Math.round(tot / n) : null, tags: tg };
  }
  function finishGame() {
    if (st.recorded) return;
    var r = result(G, st.user); if (!r) return;
    st.recorded = true; checkGoal();
    st.unseen = Flow.endsUnseen({ wide: !phone(), mode: st.mode, scr: st.scr }); /* G-D36: it ended while the player was elsewhere */
    var s = summarize(st.ann, st.tags, st.user, G.history());
    prof.games.unshift({ id: 'g' + Date.now(), d: Date.now(), r: r.r, user: st.user, level: st.level, acc: s.acc, counts: s.counts, tags: s.tags, sans: G.history(), ann: st.ann });
    prof.games = prof.games.slice(0, 30); dayRec().games++;
    if (r.r === 'W' && booted) rateHappy = true; /* D2 (DP-D4): a won game is a happy moment, asked after its end card */
    st.think = null; saveProfile();
    /* F-D19: the saved game must say it is recorded, or the next app start records it again (the player's own last move
       was saved before this ran; an app start never saved it). The game's time stamp stays, so a merge still sees its real age. */
    var snap = snapshot(); lsSet(STORE, snap); push('game', snap);
  }
  var WEAK = {
    hung: { title: 'Stop leaving pieces loose', short: 'leaving pieces undefended. Before you move, check what their pieces can take.', text: 'Most of your lost material came from pieces left where the engine could take them. Before every move ask: what does their last move attack, and is the square I’m moving to safe?', unit: 'blunder', themes: ['hanging', 'fork'] },
    missedWin: { title: 'Grab what’s free', short: 'missing free captures. Scan every capture first.', text: 'You’re missing chances to win material. Start every move by listing all your captures. Free pieces win games.', unit: 'values', themes: ['hanging', 'fork'] },
    missedMate: { title: 'Finish the game', short: 'missing checkmates. Look at every check first.', text: 'You’ve had checkmate on the board and missed it. Look at every check, every move. Checks come first because they force a reply.', unit: 'patterns', themes: ['mateIn1', 'mateIn2'] },
    allowedMate: { title: 'Guard your king', short: 'king safety. Ask what checks they have before you move.', text: 'The engine has found mating attacks against you. Castle early, keep a pawn shield, and give your king an escape square to avoid back-rank mates.', unit: 'blunder', themes: ['mateIn1', 'backRank'] },
    plan: { title: 'Move with a plan', short: 'moves without a purpose. Every move should improve a piece or stop a threat.', text: 'Some mistakes were quiet moves that didn’t do much. Ask: which of my pieces is worst, and where would it be better?', unit: 'activity', themes: ['advantage'] },
    earlyQueen: { title: 'Queen out too early', short: 'bringing the queen out early. Develop knights and bishops first.', text: 'An early queen gets chased and you fall behind in development. Knights and bishops first, queen later.', unit: 'opening', themes: [] },
    kingWalk: { title: 'Keep castling rights', short: 'moving the king or rooks before castling.', text: 'You’ve moved your king or rook before castling, which takes castling away. Clear the pieces between them and castle first.', unit: 'opening', themes: [] },
    noCastle: { title: 'Castle early', short: 'castling late. Aim to castle by move 8 to 10.', text: 'Your king stayed in the center too long. Get the knight and bishop out, then castle, usually by move 8 to 10.', unit: 'opening', themes: [] }
  };
  function weaknessCounts() {
    var tg = {};
    prof.games.slice(0, 10).forEach(function (g) { Object.keys(g.tags || {}).forEach(function (k) { tg[k] = (tg[k] || 0) + g.tags[k]; }); });
    if (!st.recorded) Object.keys(st.tags).forEach(function (k) { var t = st.tags[k]; tg[t] = (tg[t] || 0) + 1; });
    return tg;
  }
  function topWeakness() { var tg = weaknessCounts(), best = null; Object.keys(tg).forEach(function (k) { if (WEAK[k] && (!best || tg[k] > tg[best])) best = k; }); return best; }

  /* ---------- review ---------- */
  function enterReview(src) {
    rateReset(); /* D2 (fix 3): a review that finishes a lesson part sets it again for its own end card */
    stow('play'); /* G2b: as a game, a review never ends what waits on Learn or Train (G-D35: wide too) */
    if (!src) seenEnd(); /* G-D36: the review of the finished game opens its result card */
    clearSession();
    st.rvFrom = src && st.tab === 'progress' ? 'progress' : 'play'; /* G-D23: where Close goes back to */
    var past = !!src, sans = past ? src.sans : G.history(), notes = past ? {} : JSON.parse(JSON.stringify(st.notes));
    var ann = past ? JSON.parse(JSON.stringify(src.ann || {})) : JSON.parse(JSON.stringify(st.ann)), user = past ? src.user : st.user, s = summarize(ann, {}, user);
    st.mode = 'review'; st.sel = null; resetHints();
    st.rv = { id: past ? src.id : null, sans: sans, notes: notes, ann: ann, user: user, level: past ? src.level : st.level, past: past, ply: past ? 0 : sans.length, acc: s.acc, counts: s.counts, g: null };
    openAct(); switchTab('play'); gotoPly(st.rv.ply);
  }
  function gotoPly(p) {
    var rv = st.rv; p = Math.max(0, Math.min(rv.sans.length, p)); rv.ply = p;
    if (p === rv.sans.length && rv.sans.length >= 10 && (rv.past || G.game_over())) { var rid = rv.id || ('cur' + rv.sans.length + rv.sans.slice(-1)[0]); prof.reviewed = prof.reviewed || []; if (prof.reviewed.indexOf(rid) === -1) { prof.reviewed.push(rid); prof.reviewed = prof.reviewed.slice(-50); saveProfile(); checkReviews(); } }
    rv.g = gameAt(rv.sans, p); st.arrows = []; st.hls = [];
    var n = rv.notes[p - 1];
    if (p > 0 && !n) { render(); analyzePly(rv, p - 1).then(function () { if (st.mode === 'review' && st.rv === rv && rv.ply === p) gotoPly(p); }); return; }
    var lm = rv.g.history({ verbose: true }).slice(-1)[0];
    if (n && n.side === 'u' && n.best) st.arrows = [{ from: n.best.from, to: n.best.to, color: 'var(--c-best)' }];
    else if (lm && n && n.side === 'e') st.arrows = [{ from: lm.from, to: lm.to, color: 'var(--c-blund)' }];
    render();
  }
  function analyzePly(rv, i) {
    var gB = gameAt(rv.sans, i), fenB = gB.fen(), mv = gB.move(rv.sans[i]), isUser = mv.color === rv.user;
    if (isUser) return gradeUserMove(fenB, mv, gB, rv.user).then(function (n) { rv.notes[i] = n; rv.ann[i] = n.cls; }).catch(function () { rv.notes[i] = { side: 'u', cls: 'good', text: '', ev: 0 }; });
    return Brain.analyse(gB.fen(), { depth: 11, multipv: 1, fbDepth: 2 }).then(function (a) {
      var best = a[0] ? a[0].score : 0, ev = gB.turn() === 'w' ? best : -best;
      return threatOf(gB, best).then(function (th) { rv.notes[i] = { side: 'e', why: explainEngineMove(new Chess(fenB), mv, gB, rv.user, th), ev: ev }; });
    }).catch(function () { rv.notes[i] = { side: 'e', why: [], ev: 0 }; });
  }

  /* ---------- sessions ---------- */
  function clearSession() { st.nm = null; st.end = null; st.ses = null; st.pz = null; st.qz = null; st.sq = null; st.dr = null; st.bk = null; st.ls = null; st.rc = null; st.flash = null; st.ab = false; boardId++; }
  function exitMode(toGame) {
    var from = st.mode, unit = st.ses && st.ses.unit;
    if (toGame === true) stow('play'); /* G2b (G-D20, G-D35): "Resume game" keeps the open lesson or set for its Resume card, at every width */
    clearSession(); st.mode = 'play'; st.rv = null; st.sel = null; resetHints();
    var last = G.history({ verbose: true }).slice(-1)[0];
    if (last && last.color !== st.user) st.arrows = [{ from: last.from, to: last.to, color: 'var(--c-blund)' }];
    if (toGame === 'home') { st.scr = 'tabs'; switchTab('coach'); } /* F-D11: an end card's Home button */
    else if (toGame) { openAct(); switchTab('play'); }
    else if (from === 'lesson' || unit) { st.unitOpen = unit || st.unitOpen; switchTab('path'); }
    else if (st.tab === 'train') renderTrain();
    render();
  }
  function renderSession() {
    var c = $('sessionCard'), s = st.ses;
    $('ratedBtn').classList.toggle('primary', !endOn('train')); /* F-D7: Train's start button steps back while an end card shows on Train */
    if (!s) { c.hidden = true; return; }
    c.hidden = false;
    var home = $('panel-' + ZTAB[zoneOf()]); if (home && c.parentNode !== home) home.insertBefore(c, home.firstChild);
    var shown = s.finished ? s.count : Math.min(s.i + 1, s.count), pct = Math.round(100 * (s.finished ? 1 : s.i / Math.max(1, s.count)));
    var head = '<p class="eyebrow">' + esc(s.title) + '</p><div class="meta"><span>' + (s.kind === 'drill' ? 'Endgame drill' : isDaily(s) ? setPlace(s) : shown + ' of ' + s.count) + '</span><span>✓ ' + s.right + ' · ✗ ' + s.wrong + ((s.rated || isDaily(s)) && !plain() ? ' · rating ' + Math.round(prof.rating) : '') + '</span></div><div class="bar2"><i style="width:' + pct + '%"></i></div>';
    var msg = s.msg || {}, body = '';
    if (s.finished && isDaily(s)) {
      /* D1: the daily puzzle's end card says how it went, in the card's own signed words. DP-D11: "10 more puzzles", small Home */
      var dok = s.right > 0, late = typeof s.opts.daily === 'string' && s.opts.daily !== dayKey(); /* DP-D12: finished after midnight */
      body = '<div class="sesav">' + Avatar.coach(dok ? 'proud' : 'worried', 52) + '</div><h3 class="ec-title" tabindex="-1">' + esc(Daily.lines('todo').title) + '</h3><p class="ec-text">' + esc(Daily.endLine(dok, late)) + '</p>' + remindOfferHtml() +
        stepEnd(null, 'session', true, s) + slotHost('step', s);
    } else if (s.finished) {
      var passed = s.pass == null || s.right >= s.pass;
      body = '<div class="sesav">' + Avatar.coach(passed ? 'proud' : 'worried', 52) + '</div><h3 class="ec-title" tabindex="-1">' + (passed ? 'Session complete' : 'Almost there') + '</h3><p class="ec-text">' + s.right + ' of ' + s.count + ' correct' + (s.pass != null ? (passed ? '. Passed! This step is done.' : '. You need ' + s.pass + ' to pass. Have another go.') : '.') + '</p>' +
        stepEnd(s.unit && s.part ? s.unit : null, 'session', passed, s) + slotHost('step', s);
    } else {
      var mt = (plain() && msg.titlePlain) || msg.title; /* D24: no notation in a Beginner's quiz title */
      body = '<div class="sesav">' + Avatar.coach(msgMood(msg), 52) + '</div>' + (mt ? '<h3' + (s.end ? ' class="ec-title" tabindex="-1"' : '') + '>' + esc(speak(mt)) + '</h3>' : '') + (msg.mv && !plain() ? '<p class="mono">' + figs(esc(msg.mv)) + '</p>' : '') + (msg.text ? '<p>' + speak(msg.text) + '</p>' : '') + (msg.tip ? '<p class="tip" style="margin-top:10px">' + speak(msg.tip) + '</p>' : '') +
        (s.canNext ? '<div class="row2"><button class="btn primary" type="button" data-act="next">Next ›</button>' + (s.canRetry ? '<button class="btn" type="button" data-act="retry">Try again</button>' : '') + '</div>' : '') +
        (s.end ? stepEnd(s.unit, 'session', s.end.passed, s) + slotHost('step', s) : ''); /* an endgame drill that is over */
    }
    if (c._h !== head + body) { c._h = head + body; c.innerHTML = head + body; }
    if ((s.finished || s.end) && (actOpen() || !phone())) s.late = false; /* round 2: its end card is on screen */
    renderSlot(c.querySelector('[data-slot]'), 'step', s);
    if ((s.finished || s.end) && !s.told) { s.told = true; cardShown(c); clearBanner(c); }
  }
  function startSession(kind, opts) {
    stow(opts.unit ? 'learn' : 'train'); /* G2b: the newest wins on its own tab; another tab's waits (phones) */
    clearSession(); st.rv = null; st.af = false; rateReset(); /* D2 (fix 3): a happy moment belongs to its own end card */
    st.ses = { kind: kind, title: opts.title, count: opts.count || 10, pass: opts.pass, unit: opts.unit || null, part: opts.part || null, rated: !!opts.rated, i: 0, right: 0, wrong: 0, items: opts.items || [], opts: opts, msg: null };
    openAct(); switchTab(opts.unit ? 'path' : 'train');
    nextItem(true);
  }
  /* s.cnt (G2b): the current item's result is already in the score and the profile. It is saved with the set, so an item
     that is dealt again after Resume or an app restart never counts twice. counted: only with first, from a saved entry. */
  function nextItem(first, counted) {
    var s = st.ses; if (!s) return;
    if (!first) s.i++;
    /* Fix round 1 (item 4): a square or a piece drill already scored was about to move on by itself (its timer went with the
       old board): it moves on now, so it is never asked again */
    if (first && counted && (s.kind === 'squares' || s.kind === 'reach')) {
      /* round 2, item 1: the last one: the set ends now, on its own board screen with its end card (as its timer would have) */
      if (s.i + 1 >= s.count) { resetHints(); s.cnt = true; if (s.kind === 'squares') { startSquare(); st.sq.done = true; } else { startReach(); st.rc.done = true; } s.i++; return finishSession(); }
      s.i++; counted = false;
    }
    var done = !!(first && counted); /* a counted puzzle, question or opening line comes back finished, showing its result, Next ready */
    resetHints(); st.sel = null; st.flash = null; s.canNext = false; s.canRetry = false; s.msg = null; s.end = null; s.cnt = done;
    if (!done) s.ok = null; /* round 2, item 4: the counted item's own outcome (true: solved or right) */
    if (s.i >= s.count) return finishSession();
    if (!first) boardUp();
    /* a puzzle that was already dealt for this place is dealt again (Resume); a rated set picks one only for a new place */
    if (s.kind === 'puzzles') { var p = s.items[s.i] || (s.opts.pick ? s.opts.pick(s) : null); if (!p) { s.count = s.i; return finishSession(); } s.items[s.i] = p; startPuzzle(p, done); }
    else if (s.kind === 'safety') { if (!s.items[s.i]) { s.count = s.i; return finishSession(); } startQuiz(s.items[s.i], done); }
    else if (s.kind === 'squares') startSquare();
    else if (s.kind === 'reach') startReach();
    else if (s.kind === 'book') startBook(s.items[s.i], done);
  }
  function finishSession() {
    var s = st.ses; s.finished = true;
    s.late = phone() && !actOpen(); /* round 2, item 1: it ended while its board screen was closed: its card stays until its end card is seen */
    if (s.unit && s.part && (s.pass == null || s.right >= s.pass)) markUnit(s.unit, s.part);
    saveProfile(); renderPath(); render();
  }
  function markUnit(id, part) {
    var wasOpen = unlockedByLessons(), wasComplete = Profile.levelComplete(prof, UNITS, unitDone);
    var c = prof.course[id] || (prof.course[id] = {});
    if (!c[part]) { c[part] = Date.now(); dayRec().course++; if (booted) rateHappy = true; } /* D2 (DP-D4): a lesson part newly finished */
    saveProfile();
    /* S2a: the unlock note shows on the real false-to-true flip only (Show everything never counts), once, for Beginners. */
    if (prof.level === 'beginner' && !wasOpen && unlockedByLessons()) showNote('New: Train and Progress. Practise with puzzles and see how you’re doing.', 'unlock');
    /* D21: the lesson part that completes the level brings the offer at once, whatever levelOfferT says. */
    if (!wasComplete && Profile.levelComplete(prof, UNITS, unitDone)) lessonOffer();
    applyTabs(); renderPath(); if (st.tab === 'coach') renderCoach();
    if (booted) remindSync(); /* D2 (DP-D19): finishing Foundations offers the card, and with it the reminder */
  }

  /* puzzles */
  function pickPuzzles(themes, min, max, n, extra) {
    var seen = prof.puz;
    var pool = PZ.filter(function (p) { return !p.hand && p.rating >= min && p.rating <= max && (!themes || p.themes.some(function (t) { return themes.indexOf(t) > -1; })); });
    var fresh = pool.filter(function (p) { return !seen[p.id]; }), old = pool.filter(function (p) { return seen[p.id] && !(seen[p.id].ok > 0 && seen[p.id].box >= 2); });
    shuffle(fresh); shuffle(old);
    var list = (extra || []).map(function (id) { return PZ_BY[id]; }).filter(function (p) { return p && !(seen[p.id] && seen[p.id].ok); }).concat(fresh, old);
    if (list.length < n) list = list.concat(shuffle(pool.filter(function (p) { return list.indexOf(p) === -1; })));
    list = list.slice(0, n);
    list.sort(function (a, b) { return a.rating - b.rating; });
    return list;
  }
  function ratedPick() {
    return function (s) {
      var used = {}; s.items.forEach(function (p) { if (p) used[p.id] = 1; });
      var dr = prof.daily; if (dr && dr.id && dr.d === dayKey() && !dr.r) used[dr.id] = 1; /* D1: today's daily puzzle stays fresh for its one try */
      var r = prof.rating, band = 120, pool = [];
      while (!pool.length && band < 1600) { pool = PZ.filter(function (p) { return !p.hand && !used[p.id] && !(prof.puz[p.id] && prof.puz[p.id].ok) && Math.abs(p.rating - r) <= band; }); band += 120; }
      if (!pool.length) pool = PZ.filter(function (p) { return !used[p.id]; });
      return pool[Math.floor(Math.random() * pool.length)];
    };
  }
  function dueList() { var now = Date.now(); return PZ.filter(function (p) { var r = prof.puz[p.id]; return r && r.due && r.due <= now && r.box < 2 && r.n > r.ok - 1 && (r.n - r.ok) > 0; }); }
  /* done (fix round 1, item 4): the puzzle's result is already counted (a Resume or a restart before Next): it comes back
     finished, as the profile recorded it, never dealt again unsolved */
  function startPuzzle(p, done) {
    st.mode = 'puzzle';
    if (done) return puzzleShown(p);
    var g = new Chess(p.pre && p.last ? p.pre : p.fen), side = new Chess(p.fen).turn();
    st.pz = { p: p, g: g, side: side, step: 0, done: false, wait: !!(p.pre && p.last), counted: !!st.ses.cnt };
    var goal = p.themes.indexOf('mateIn1') > -1 ? 'Find the checkmate.' : p.themes.indexOf('mateIn2') > -1 ? 'Find mate in 2.' : p.themes.indexOf('mateIn3') > -1 ? 'Find the forced mate.' : 'Find the best move.';
    st.ses.msg = { title: (side === 'w' ? 'White' : 'Black') + ' to move', text: goal + (p.sol.length > 1 ? ' It takes ' + Math.ceil(p.sol.length / 2) + ' moves.' : '') + (st.pz.wait ? ' Watch their move first.' : '') };
    render();
    if (st.pz.wait) {
      var pz = st.pz;
      setTimeout(function () { if (st.pz !== pz) return; var m = findMove(g, p.last); if (m) { g.move(m); st.arrows = [{ from: m.from, to: m.to, color: 'var(--c-blund)' }]; } pz.wait = false; st.ses.msg.mv = 'They just played ' + (m ? m.san : ''); render(); }, 800);
    }
  }
  function puzzleMove(from, to) {
    var P = st.pz, g = P.g, fenB = g.fen(), mv = g.move({ from: from, to: to, promotion: 'q' });
    if (!mv) return;
    st.sel = null; resetHints(); render();
    var want = P.p.sol[P.step], isLast = P.step >= P.p.sol.length - 1;
    var exact = uciEq(keyOf(mv), want) || (P.p.alt && P.step === 0 && P.p.alt.some(function (a) { return uciEq(a, keyOf(mv)); }));
    var mateOk = g.in_checkmate();
    if (mateOk) return puzzleAdvance(true);
    if (exact) return puzzleAdvance(isLast);
    st.busy = true; render();
    Brain.analyse(fenB, { depth: 12, multipv: 1, fbDepth: 3 }).then(function (r0) {
      return Brain.analyse(g.fen(), { depth: 11, multipv: 1, fbDepth: 2 }).then(function (r1) {
        if (st.pz !== P) return; /* G2b: the set was parked or ended meanwhile: this answer is dropped, the puzzle is dealt again on Resume */
        st.busy = false;
        var best = r0[0] ? r0[0].score : 0, mine = r1[0] ? -r1[0].score : 0;
        var ok = best > MW ? mine > MW && mine >= best - 2 : (mine >= best - 60 && mine >= 200);
        if (ok) return puzzleAdvance(true, true);
        puzzleFail(mv, want);
      });
    });
  }
  function puzzleAdvance(solved, alt) {
    var P = st.pz, s = st.ses;
    if (solved) {
      P.done = true;
      if (!P.counted) { P.counted = true; s.cnt = true; s.ok = true; s.right++; if (isDaily(s)) dailyResult(s, P.p.id, true); recordPuzzle(P.p, true); }
      s.msg = { title: alt ? 'Solved (another way!)' : 'Solved!', text: puzzleLesson(P.p) };
      s.canNext = true; render(); return;
    }
    P.step++;
    var reply = P.p.sol[P.step]; P.wait = true;
    s.msg = { title: 'Good, keep going', text: 'Right idea. Now see what they do.' }; render();
    var go = reply === '*' ? Brain.play(P.g.fen(), { skill: 20, movetime: 300, fbDepth: 4 }) : Promise.resolve(reply);
    go.then(function (u) {
      return wait(450).then(function () {
        if (st.pz !== P) return; /* G2b: parked or ended during the wait: nothing is drawn on the board that took its place */
        var m = u && findMove(P.g, u); if (m) { P.g.move(m); st.arrows = [{ from: m.from, to: m.to, color: 'var(--c-blund)' }]; }
        P.step++; P.wait = false;
        s.msg = { title: 'Your move again', mv: m ? 'They played ' + m.san : '', text: 'Finish it.' }; render();
      });
    });
  }
  function puzzleFail(mv, want) {
    var P = st.pz, s = st.ses;
    if (!P.counted) { P.counted = true; s.cnt = true; s.ok = false; s.wrong++; if (isDaily(s)) dailyResult(s, P.p.id, false); recordPuzzle(P.p, false); }
    P.wait = true; render();
    setTimeout(function () {
      if (st.pz !== P) return; /* G2b */
      P.g.undo(); var wm = findMove(P.g, want);
      st.arrows = wm ? [{ from: wm.from, to: wm.to, color: 'var(--c-best)' }] : [];
      P.done = true; P.wait = false;
      s.msg = { title: 'Not quite', mv: 'You played ' + mv.san, text: (wm ? 'The winning move was ' + mvc(wm) + '. ' : '') + puzzleLesson(P.p), tip: 'This puzzle comes back in your review list tomorrow.' };
      s.canNext = true; s.canRetry = !isDaily(s); render(); /* D1: one try a day */
    }, 600);
  }
  /* A counted puzzle, finished: solved or missed as the set saved it (round 2, item 4: s.ok, not the profile's last record).
     Solved: the final position and "Solved!". Missed: the winning move shown, as after a miss, with Try again. */
  function puzzleShown(p) {
    var s = st.ses, g = new Chess(p.fen), ok = s.ok === true;
    st.pz = { p: p, g: g, side: g.turn(), step: 0, done: true, wait: false, counted: true };
    if (ok) {
      if (p.sol.indexOf('*') === -1) p.sol.forEach(function (u) { var m = findMove(g, u); if (m) g.move(m); });
      st.pz.step = p.sol.length; st.arrows = [];
      s.msg = { title: 'Solved!', text: puzzleLesson(p) };
    } else {
      var wm = findMove(g, p.sol[0]);
      st.arrows = wm ? [{ from: wm.from, to: wm.to, color: 'var(--c-best)' }] : [];
      s.msg = { title: 'Not quite', text: (wm ? 'The winning move was ' + mvc(wm) + '. ' : '') + puzzleLesson(p), tip: 'This puzzle comes back in your review list tomorrow.' };
      s.canRetry = !isDaily(s);
    }
    s.canNext = true; render();
  }
  function puzzleLesson(p) {
    var t = p.themes, line = p.sol.length > 1 && p.sol.indexOf('*') === -1 ? ' Full line: ' + mline(p.fen, p.sol, p.sol.length) : '';
    if (t.indexOf('backRank') > -1) return 'Back-rank mate: the king is trapped by its own pawns.' + line;
    if (t.indexOf('mateIn1') > -1) return 'Always check every check: one of them was mate.' + line;
    if (t.indexOf('mateIn2') > -1 || t.indexOf('mateIn3') > -1) return 'Forcing moves first: checks that leave the king fewer and fewer squares.' + line;
    if (t.indexOf('fork') > -1) return 'Fork: one piece attacking two targets.' + line;
    if (t.indexOf('pin') > -1) return 'Pin: the piece in front can’t move without exposing something bigger.' + line;
    if (t.indexOf('skewer') > -1) return 'Skewer: attack the big piece, take what’s behind it.' + line;
    if (t.indexOf('discoveredCheck') > -1 || t.indexOf('discovered') > -1) return 'Discovered attack: move one piece to unleash another.' + line;
    if (t.indexOf('hanging') > -1) return 'Free material: the piece had no defender, or not enough.' + line;
    if (t.indexOf('promotion') > -1) return 'Promotion wins: passed pawns must be pushed.' + line;
    if (t.indexOf('sacrifice') > -1) return 'A sacrifice that opens the way. Calculate forcing lines first.' + line;
    return 'The forcing move wins material.' + line;
  }
  function recordPuzzle(p, ok) {
    var r = prof.puz[p.id] || { n: 0, ok: 0, box: 0, due: 0 };
    r.n++; if (ok) { r.ok++; r.box = Math.min(5, (r.box || 0) + 1); } else r.box = 0;
    r.due = Date.now() + [1, 2, 4, 7, 14, 30][r.box] * DAY;
    prof.puz[p.id] = r;
    var exp = 1 / (1 + Math.pow(10, (p.rating - prof.rating) / 400)), K = prof.rn < 20 ? 40 : 20;
    prof.rating = Math.max(100, prof.rating + K * ((ok ? 1 : 0) - exp)); prof.rn++;
    var d = dayRec(); d.puz++; if (ok) d.solved++;
    saveProfile();
  }
  function retryPuzzle() { var s = st.ses, p = s.items[s.i]; resetHints(); s.canNext = false; s.canRetry = false; startPuzzle(p); st.pz.counted = true; }

  /* safety quiz */
  function safetyItems(n, hard) {
    var pool = PZ.filter(function (p) { return p.pre && p.last && p.preBest && !uciEq(p.preBest, p.last) && (hard ? p.rating >= 1150 : p.rating <= 1350); });
    shuffle(pool);
    var out = pool.slice(0, n).map(function (p, i) { return { p: p, blunder: i % 2 === 0 }; });
    return shuffle(out);
  }
  /* done (round 2, item 5): the question was already answered and counted: it comes back answered, its verdict shown */
  function startQuiz(it, done) {
    st.mode = 'quiz';
    var g = new Chess(it.p.pre), mv = findMove(g, it.blunder ? it.p.last : it.p.preBest);
    st.qz = { it: it, g: g, side: g.turn(), mv: mv, answered: false };
    st.arrows = mv ? [{ from: mv.from, to: mv.to, color: 'var(--accent)' }] : [];
    st.ses.msg = { title: (g.turn() === 'w' ? 'White' : 'Black') + ' wants to play ' + (mv ? mv.san : '?'), titlePlain: (g.turn() === 'w' ? 'White' : 'Black') + ' wants to play this move.', text: 'Is it <b>safe</b>, or a <b>blunder</b>? Do your blunder check: what can the other side do after this move?' };
    if (done && mv) { st.qz.answered = true; quizVerdict(st.qz, st.ses.ok === true); st.ses.canNext = true; }
    render();
  }
  function answerQuiz(sayBlunder) {
    var q = st.qz, s = st.ses; if (!q || q.answered || !q.mv) return;
    q.answered = true;
    var right = sayBlunder === q.it.blunder;
    if (!s.cnt) { s.cnt = true; s.ok = right; if (right) s.right++; else s.wrong++; var d = dayRec(); d.puz++; if (right) d.solved++; } /* G2b: an item dealt again after Resume counts once */
    quizVerdict(q, right);
    s.canNext = true; saveProfile(); render();
  }
  /* The answer's verdict on the board and the card (round 2: also for a question that comes back answered) */
  function quizVerdict(q, right) {
    var s = st.ses, p = q.it.p;
    if (q.it.blunder) {
      var qf = q.g.fen(); q.g.move(q.mv); var ref = findMove(q.g, p.sol[0]);
      st.arrows = ref ? [{ from: ref.from, to: ref.to, color: 'var(--c-blund)' }] : [];
      s.msg = { title: right ? 'Correct, it’s a blunder' : 'It’s a blunder', mv: q.mv.san + '?  ' + (ref ? ref.san + '!' : ''), text: 'After ' + mvc(q.mv, qf) + ', the reply ' + mvc(ref) + ' wins. ' + puzzleLesson(p) };
    } else {
      s.msg = { title: right ? 'Correct, it’s safe' : 'Actually, it’s safe', mv: q.mv.san, text: 'This is Stockfish’s top choice here. Nothing hangs and there’s no trick against it.' };
    }
  }

  /* squares */
  function startSquare() {
    st.mode = 'squares';
    var s = st.ses, prev = st.sq && st.sq.target, t;
    do { t = FILES[Math.floor(Math.random() * 8)] + (1 + Math.floor(Math.random() * 8)); } while (t === prev);
    st.sq = { target: t, side: s.i % 4 < 2 ? 'w' : 'b', t0: Date.now(), done: false };
    s.msg = { title: 'Tap ' + t, text: 'You’re looking from ' + (st.sq.side === 'w' ? 'White’s' : 'Black’s') + ' side. Files run ' + (st.sq.side === 'w' ? 'a to h, left to right.' : 'h to a, left to right.') };
    render();
  }
  function tapSquare(sq) {
    var q = st.sq, s = st.ses; if (!q || q.done) return;
    q.done = true; var ok = sq === q.target, secs = ((Date.now() - q.t0) / 1000).toFixed(1);
    if (!s.cnt) { s.cnt = true; s.ok = ok; if (ok) s.right++; else s.wrong++; }
    st.flash = { sq: q.target, ok: ok }; st.hls = ok ? [] : [q.target];
    s.msg = { title: ok ? 'Right! ' + secs + 's' : 'That was ' + sq, text: ok ? '' : q.target + ' is highlighted: file ' + q.target[0] + ', rank ' + q.target[1] + '.' };
    render();
    setTimeout(function () { if (st.ses === s) nextItem(); }, ok ? 650 : 1500);
  }

  /* piece reach drill */
  var REACH = ['r', 'b', 'n', 'q', 'k', 'p'];
  function startReach() {
    st.mode = 'reach';
    var s = st.ses, type = REACH[s.i % REACH.length], g, sq, targets, tries = 0;
    do {
      g = new Chess(); g.clear();
      g.put({ type: 'k', color: 'b' }, 'a8'); if (type !== 'k') g.put({ type: 'k', color: 'w' }, 'h1');
      if (type === 'p') {
        var f = 1 + Math.floor(Math.random() * 6); sq = FILES[f] + '2';
        g.put({ type: 'p', color: 'w' }, sq); g.put({ type: Math.random() < 0.5 ? 'n' : 'b', color: 'b' }, FILES[f - 1] + '3');
      } else {
        sq = FILES[1 + Math.floor(Math.random() * 6)] + (2 + Math.floor(Math.random() * 5));
        g.put({ type: type, color: 'w' }, sq);
        if (type !== 'n' && Math.random() < 0.6) { var bs = FILES[Math.floor(Math.random() * 8)] + (2 + Math.floor(Math.random() * 6)); if (!g.get(bs)) g.put({ type: 'p', color: Math.random() < 0.5 ? 'b' : 'w' }, bs); }
      }
      targets = g.moves({ square: sq, verbose: true }).map(function (m) { return m.to; });
      tries++;
    } while ((targets.indexOf('a8') > -1 || !targets.length || g.in_check()) && tries < 30);
    st.rc = { g: g, sq: sq, type: type, targets: targets, found: [], misses: 0, bad: null, done: false };
    st.hls = [sq];
    s.msg = { title: 'Tap every square the ' + PNAME[type] + ' on ' + sq + ' can reach', text: targets.length + ' squares to find.' + (type === 'p' ? ' Remember how pawns capture.' : '') + ' Pieces of its own color block it; enemy pieces can be captured.' };
    render();
  }
  function tapReach(sq) {
    var R = st.rc, s = st.ses; if (!R || R.done) return;
    if (sq === R.sq) return;
    if (R.targets.indexOf(sq) > -1) { if (R.found.indexOf(sq) === -1) R.found.push(sq); R.bad = null; }
    else { R.misses++; R.bad = sq; setTimeout(function () { if (st.rc === R) { R.bad = null; render(); } }, 600); }
    var left = R.targets.length - R.found.length;
    if (!left) {
      R.done = true; var ok = R.misses <= 1; if (!s.cnt) { s.cnt = true; s.ok = ok; if (ok) s.right++; else s.wrong++; }
      s.msg = { title: ok ? 'All ' + R.targets.length + ' found!' : 'Found them, with ' + R.misses + ' wrong taps', text: R.misses > 1 ? 'Try to see the whole pattern before tapping. Next one:' : '' };
      render(); setTimeout(function () { if (st.ses === s) nextItem(); }, 1100); return;
    }
    s.msg = { title: left + ' more to find', text: R.misses ? R.misses + ' wrong tap' + (R.misses === 1 ? '' : 's') + ' so far.' : 'Keep going.' };
    render();
  }

  /* drills (endgames) */
  function startDrill(unitId, d, from) {
    /* G2a: on a phone the board screen is on the activity's own tab: Train for a drill started from Train's list, Learn for
       one started as a lesson's task (zoneOf). */
    var dz = Flow.drillZone(from);
    stow(dz || 'learn'); /* G2b */
    clearSession(); st.rv = null; st.af = false; rateReset(); /* D2 (fix 3) */
    openDrill(unitId, d, dz, null);
  }
  /* at (G2b): a saved drill's place { fen, moves }: the same position; the engine is asked again when it is its move. */
  function openDrill(unitId, d, dz, at) {
    st.sel = null; resetHints(); /* fix round 1 (item 5): no arrow or highlight from the game or an old drill */
    var g = new Chess(at ? at.fen : d.fen);
    st.mode = 'drill';
    st.dr = { g: g, side: new Chess(d.fen).turn(), goal: d.goal, limit: d.limit, moves: at ? at.moves : 0, done: false, unit: unitId, name: UNIT[unitId] ? UNIT[unitId].title : 'Endgame drill', ev: null };
    st.ses = { kind: 'drill', title: st.dr.name, count: 1, i: 0, right: 0, wrong: 0, items: [], unit: unitId, part: 'apply', msg: { title: 'Your move', text: at && at.moves ? 'Move ' + at.moves + ' of ' + d.limit + '.' : esc(d.text || '') + ' Stuck? Hint shows Stockfish’s idea.' } };
    if (dz) st.ses.zone = dz;
    openAct(); switchTab(phone() ? ZTAB[zoneOf()] : tabOpen('train') ? 'train' : 'path'); render();
    if (g.turn() !== st.dr.side) drillReply(st.dr);
  }
  function drillMove(from, to) {
    var D = st.dr, g = D.g, mv = g.move({ from: from, to: to, promotion: 'q' }); if (!mv) return;
    st.sel = null; resetHints(); D.moves++;
    if (drillCheck()) return;
    drillReply(D);
  }
  function drillReply(D) {
    var g = D.g;
    st.busy = true; render();
    Brain.play(g.fen(), { skill: 20, movetime: 350, fbDepth: 5 }).then(function (u) {
      if (st.dr !== D) return; /* G2b: parked or ended while the engine was thinking: Resume asks again from the saved position */
      var m = u && findMove(g, u); if (m) { g.move(m); st.arrows = [{ from: m.from, to: m.to, color: 'var(--c-blund)' }]; }
      st.busy = false;
      if (!drillCheck()) { st.ses.msg = { title: 'Your move', mv: m ? 'Stockfish played ' + m.san : '', text: 'Move ' + D.moves + ' of ' + D.limit + '.' }; render(); }
      Brain.analyse(g.fen(), { depth: 10, multipv: 1, fbDepth: 2 }).then(function (a) { if (a[0] && st.dr === D) { D.ev = g.turn() === 'w' ? a[0].score : -a[0].score; renderEval(); } });
    });
  }
  function drillCheck() {
    var D = st.dr, g = D.g, s = st.ses, end = null;
    if (g.in_checkmate()) end = g.turn() !== D.side ? 'win' : 'lose';
    else if (g.game_over()) end = 'draw';
    else if (D.moves >= D.limit && g.turn() === D.side) end = D.goal === 'hold' ? ((D.ev == null || (D.side === 'w' ? D.ev : -D.ev) > -250) ? 'held' : 'limit') : 'limit';
    if (!end) return false;
    D.done = true;
    if (D.goal === 'hold' && end === 'draw') end = 'held';
    if (end === 'win' || end === 'held') { s.right = 1; markUnit(D.unit, 'apply'); s.msg = end === 'held' ? { title: 'Draw held!', text: 'You defended for ' + D.moves + ' moves against Stockfish. That is real endgame technique.' } : { title: 'Checkmate in ' + D.moves + ' moves!', text: 'Drill passed. That technique is yours now.' }; }
    else { s.wrong = 1; s.msg = { title: end === 'draw' ? (g.in_stalemate() ? 'Stalemate, a draw' : 'Draw') : end === 'limit' ? 'Out of moves' : 'Lost', text: end === 'draw' && g.in_stalemate() ? 'The king had no moves but wasn’t in check. Leave it a square until you can mate.' : 'Use Hint when you’re unsure, and follow the method from the lesson.' }; }
    s.end = { passed: end === 'win' || end === 'held' }; /* F1: the drill's end card (renderSession) */
    s.late = phone() && !actOpen(); /* round 2, item 1 */
    renderPath();
    render(); return true;
  }

  /* opening book */
  /* done (fix round 1, item 4): the line was already played and scored: it comes back complete, Next ready */
  function startBook(line, done) {
    st.mode = 'book';
    st.bk = { line: line, g: new Chess(), side: line.side, ply: 0, mistakes: 0, done: false, wait: false };
    if (done) { line.moves.forEach(function (m) { st.bk.g.move(m); }); st.bk.ply = line.moves.length; st.bk.done = true; st.ses.msg = st.ses.ok ? { title: 'Line complete, no mistakes', text: 'You know this one.' } : { title: 'Line complete' }; st.ses.canNext = true; render(); return; }
    st.ses.msg = { title: line.name, text: 'Play your moves from memory. You’re ' + (line.side === 'w' ? 'White' : 'Black') + '.' };
    render(); bookAuto();
  }
  function bookAuto() {
    var B = st.bk;
    if (B.ply >= B.line.moves.length) return bookDone();
    if (B.g.turn() !== B.side) {
      B.wait = true; render();
      setTimeout(function () { if (st.bk !== B) return; var m = B.g.move(B.line.moves[B.ply]); B.ply++; B.wait = false; st.arrows = [{ from: m.from, to: m.to, color: 'var(--c-blund)' }]; render(); bookAuto(); }, 450);
    }
  }
  function bookMove(from, to) {
    var B = st.bk, s = st.ses, want = B.line.moves[B.ply], g = B.g, mv = g.move({ from: from, to: to, promotion: 'q' });
    if (!mv) return; st.sel = null; resetHints();
    if (mv.san === want) { B.ply++; s.msg = { title: 'Book move ✓', mv: mv.san, text: cap1(describe(mv, 'your')) + '.' }; render(); bookAuto(); return; }
    B.mistakes++; B.wait = true; render();
    setTimeout(function () {
      if (st.bk !== B) return; /* G2b */
      g.undo(); var w = g.move(want); g.undo(); B.wait = false;
      st.arrows = [{ from: w.from, to: w.to, color: 'var(--c-best)' }];
      s.msg = { title: 'Not the book move', mv: 'You played ' + mv.san, text: 'The repertoire move is ' + mvc(w) + ': it ' + describe(w, 'your') + '. Play it to continue.' };
      render();
    }, 500);
  }
  function bookHintData() { var B = st.bk, g = new Chess(B.g.fen()), m = g.move(B.line.moves[B.ply]); return m ? { best: { from: m.from, to: m.to, san: m.san, why: describe(m, 'your') }, theme: { idea: 'Think about the plan of this opening: ' + (B.side === 'w' ? 'center, develop, castle.' : 'match the center, develop, castle.') } } : null; }
  function bookDone() {
    var B = st.bk, s = st.ses; B.done = true;
    if (!s.cnt) { s.cnt = true; s.ok = B.mistakes === 0; if (B.mistakes === 0) s.right++; else s.wrong++; }
    s.msg = { title: B.mistakes === 0 ? 'Line complete, no mistakes' : 'Line complete', text: B.mistakes ? B.mistakes + ' mistake' + (B.mistakes === 1 ? '' : 's') + '. Repeat it until it’s automatic.' : 'You know this one.' };
    s.canNext = true; render();
  }
  function puzzleHintData() {
    var P = st.pz, m = findMove(P.g, P.p.sol[P.step]);
    if (!m) return null;
    var t = P.p.themes, idea = t.indexOf('mateIn1') > -1 ? 'Check every check. One of them is mate.' : t.indexOf('fork') > -1 ? 'Look for a move that attacks two things.' : t.indexOf('pin') > -1 || t.indexOf('skewer') > -1 ? 'Two of their pieces are on one line.' : t.indexOf('discovered') > -1 || t.indexOf('discoveredCheck') > -1 ? 'Move a piece out of the way of another.' : t.indexOf('hanging') > -1 ? 'Something is undefended.' : 'Forcing moves first: checks, captures, threats.';
    return { best: { from: m.from, to: m.to, san: m.san, why: describe(m, 'your') }, theme: { idea: idea } };
  }

  /* ---------- lesson player ---------- */
  function startLesson(id) {
    stow('learn'); /* G2b: replaces what waits on Learn; a set on Train waits on (phones) */
    clearSession(); st.rv = null; st.af = false; rateReset(); /* D2 (fix 3): a happy moment not yet asked about ends when a new activity starts */
    st.mode = 'lesson'; st.ls = { unit: UNIT[id], i: 0, g: null, side: 'w' };
    openAct(); switchTab('path'); showLessonStep();
  }
  function showLessonStep() {
    var L = st.ls, step = L.unit.lesson[L.i];
    var g = new Chess(); g.load(step.fen); L.g = g; L.side = step.side || 'w';
    st.arrows = (step.arrows || []).map(function (a) { return { from: a[0], to: a[1] }; }); st.hls = step.hl || [];
    var la = $('lAnswer'); if (la) la.hidden = true;
    render(); renderPath();
  }
  function lessonNav(d) {
    var L = st.ls;
    if (d > 0 && L.i === L.unit.lesson.length - 1) { var id = L.unit.id; markUnit(id, 'learn'); clearSession(); st.mode = 'play'; resetHints(); st.unitOpen = null; st.end = { unit: id }; render(); renderPath(); return; } /* F1: the Learn part's end card, over the course */
    L.i = Math.max(0, Math.min(L.unit.lesson.length - 1, L.i + d)); showLessonStep(); boardUp();
  }

  /* ---------- course UI ---------- */
  function unitParts(u) { var p = ['learn']; if (u.practice) p.push('practice'); if (u.apply) p.push('apply'); return p; }
  function unitDone(u) { var c = prof.course[u.id] || {}; return unitParts(u).every(function (k) { return c[k]; }); }
  function unitStarted(u) { var c = prof.course[u.id] || {}; return unitParts(u).some(function (k) { return c[k]; }); }
  /* D29: Improver and Club Home starts at their level: the later of the stored start and their level's first unit.
     The stored start, the lessons, unlockDone and levelComplete do not change. */
  function unitIndex(id) { for (var i = 0; i < UNITS.length; i++) if (UNITS[i].id === id) return i; return -1; }
  function effStart() {
    if (prof.level !== 'improver' && prof.level !== 'club') return prof.start;
    var first = Profile.startUnit(prof.level, true, UNITS);
    return unitIndex(prof.start) >= unitIndex(first) ? prof.start : first;
  }
  function nextUnit() { return Profile.nextUnit(Object.assign({}, prof, { start: effStart() }), UNITS, unitDone); }
  function nextPart(u) { var c = prof.course[u.id] || {}; return unitParts(u).filter(function (k) { return !c[k]; })[0]; }
  var PART_NAME = { learn: 'Learn', practice: 'Practice', apply: 'Apply' };
  function partDesc(u, k) {
    if (k === 'learn') return u.lesson.length + ' short steps on the board';
    if (k === 'practice') { var p = u.practice; if (p.type === 'reach') return 'Tap every square a piece can reach \u00B7 ' + p.pass + '/' + p.count + ' to pass'; return p.type === 'squares' ? 'Name-the-square drill · ' + p.pass + '/' + p.count + ' to pass' : p.type === 'safety' ? 'Safe or blunder? · ' + p.pass + '/' + p.count + ' to pass' : p.count + ' puzzles · ' + p.pass + ' to pass'; }
    return u.apply.text;
  }
  function renderPath() {
    renderToday();
    var lv = $('levels'), uv = $('unitView'), le = $('learnEnd'), eu = st.end && UNIT[st.end.unit];
    /* F1: the Learn part of a lesson is finished: its end card, with the course open under it */
    le.hidden = !eu;
    var leh = eu ? '<div class="sesav">' + Avatar.coach('proud', 52) + '</div><p class="eyebrow">' + PART_NAME.learn + '</p><h3 class="ec-title" tabindex="-1">' + esc(eu.title) + '</h3>' + stepEnd(eu.id, 'learn', true, null) + slotHost('learn', st.end) : '';
    if (le._h !== leh) { le._h = leh; le.innerHTML = leh; }
    if (eu) renderSlot(le.querySelector('[data-slot]'), 'learn', st.end);
    renderSlots(); /* the desktop strip follows the Learn end card */
    if (eu && !st.end.told) { st.end.told = true; cardShown(le); clearBanner(le); }
    if (st.mode === 'lesson' && st.ls && !(phone() && st.scr !== 'act')) { /* G2a: a closed lesson leaves the course on Learn's page */
      var L = st.ls, step = L.unit.lesson[L.i];
      lv.hidden = true; uv.hidden = false;
      uv.innerHTML = '<div class="card lessoncard"><button class="back" type="button" data-unit="' + L.unit.id + '">‹ ' + esc(L.unit.title) + '</button>' +
        '<p class="eyebrow" style="margin-top:10px">Lesson · step ' + (L.i + 1) + ' of ' + L.unit.lesson.length + '</p><div class="ltext">' + step.text + '</div>' +
        '<div class="lessonnav"><div class="dots">' + L.unit.lesson.map(function (_, i) { return '<i class="' + (i === L.i ? 'on' : '') + '"></i>'; }).join('') + '</div>' +
        '<div style="display:flex;gap:8px"><button class="btn" type="button" data-lnav="-1"' + (L.i === 0 ? ' disabled' : '') + '>‹ Back</button><button class="btn primary" type="button" data-lnav="1">' + (L.i === L.unit.lesson.length - 1 ? 'Finish lesson ✓' : 'Next ›') + '</button></div></div></div>' +
        '';
      return;
    }
    if (st.unitOpen && UNIT[st.unitOpen]) {
      var u = UNIT[st.unitOpen], c = prof.course[u.id] || {};
      lv.hidden = true; uv.hidden = false;
      uv.innerHTML = '<div class="card unitcard"><button class="back" type="button" data-act="units">‹ All levels</button><p class="eyebrow" style="margin-top:10px">Level ' + u.level + ' · ' + esc(COURSE.LEVELS[u.level - 1].name) + '</p><h3>' + esc(u.title) + '</h3><p class="goal">Goal: ' + esc(u.goal) + '</p><div class="steps3">' +
        unitParts(u).map(function (k, i) { return '<div class="step3' + (c[k] ? ' done' : '') + '"><span class="n">' + (c[k] ? '✓' : i + 1) + '</span><div><b>' + PART_NAME[k] + '</b><small>' + esc(partDesc(u, k)) + '</small></div><button class="btn sm' + (!c[k] && nextPart(u) === k && !endOn('path') ? ' primary' : '') + '" type="button" data-part="' + k + '" data-u="' + u.id + '">' + (c[k] ? 'Redo' : 'Start') + '</button></div>'; }).join('') +
        '</div></div>';
      return;
    }
    uv.hidden = true; lv.hidden = false;
    var nx = nextUnit();
    lv.innerHTML = COURSE.LEVELS.map(function (L) {
      var us = UNITS.filter(function (u) { return u.level === L.id; }), done = us.filter(unitDone).length, open = nx ? nx.level === L.id : L.id === 5;
      return '<details class="lvl' + (done === us.length ? ' cleared' : '') + '"' + (open ? ' open' : '') + '><summary><span class="lvnum">' + (done === us.length ? '✓' : L.id) + '</span><div><h3>' + esc(L.name) + '</h3><small>' + esc(plain() ? L.band.split(' · ')[0] : L.band) + '</small></div><span class="lvpct">' + done + '/' + us.length + '</span></summary><div class="lvbody"><p>' + esc(L.blurb) + '</p><div class="units">' +
        us.map(function (u) { var cls = unitDone(u) ? 'done' : unitStarted(u) ? 'part' : ''; if (nx && nx.id === u.id) cls += ' next'; return '<button class="unitrow ' + cls + '" type="button" data-unit="' + u.id + '"><span class="st">' + (unitDone(u) ? '✓' : '') + '</span><span class="t">' + esc(u.title) + '</span><small>' + (nx && nx.id === u.id ? 'Next' : unitDone(u) ? 'Done' : '') + '</small></button>'; }).join('') +
        '</div></div></details>';
    }).join('');
  }
  function renderToday() {
    var d = dayRec(), nx = nextUnit(), due = dueList().length, el = $('today'), streak = streakDays(), pl = plain();
    var k = nx ? nextPart(nx) : null;
    var w = waitingPart(), tl = nx ? Flow.resumesLesson({ go: 'part', unit: nx.id, part: k }, w) : false; /* fix round 2: as the Continue card; G-D37: a part too */
    var tw = tabOpen('train') ? waitOn('train') : null; /* G-D37: a set or drill that waits on Train is resumed by Today's Train step */
    var steps = [
      { z: 'learn', n: 1, h: 'Learn', done: !!d.course, t: nx ? nx.title : 'Course complete', s: nx ? PART_NAME[k] + ': ' + partDesc(nx, k) : 'Keep sharp with puzzles and games.', b: tl ? Flow.resumeTitle(w.kind) : nx ? 'Start lesson' : 'Open course', act: tl ? RESUME_LESSON : nx ? 'data-part="' + k + '" data-u="' + nx.id + '"' : 'data-zgo="path"' },
      { z: 'train', n: 2, h: 'Train', done: d.puz >= 10, t: tw ? tw.title : due ? 'Review ' + due + ' missed puzzle' + (due === 1 ? '' : 's') : pl ? '10 puzzles' : '10 rated puzzles', s: Math.min(d.puz, 10) + ' of 10 today.' + (pl ? '' : ' Puzzle rating ' + Math.round(prof.rating) + '.'), b: tw ? Flow.resumeTitle(tw.kind) : 'Start training', act: tw ? 'data-act="resume" data-z="train"' : due ? 'data-train="review"' : 'data-train="rated"' },
      { z: 'play', n: 3, h: 'Play', done: d.games >= 1, t: 'One full game', s: 'Use what you learned against ' + (pl ? partnerName() + '.' : OPP[recLevel()].name + ' (~' + OPP[recLevel()].elo + ').'), b: G.history().length && !G.game_over() ? Flow.COPY.back : 'Play a game', act: G.history().length && !G.game_over() ? 'data-act="close"' : 'data-act="recgame"' }
    ].filter(function (x) { return x.z !== 'train' || tabOpen('train'); }); /* a Beginner's Train tab is still locked */
    steps.forEach(function (x, i) { x.n = i + 1; });
    var doneCount = steps.filter(function (x) { return x.done; }).length;
    el.innerHTML = '<p class="eyebrow">Today, about 20 minutes</p><h3>' + (doneCount === steps.length ? 'All done. Great work!' : tabOpen('train') ? 'Learn it, train it, then play it' : 'Learn it, then play it') + '</h3>' +
      '<div class="steps3">' + steps.map(function (x) {
        return '<div class="step3 z-' + x.z + (x.done ? ' done' : '') + '"><div class="sh"><span class="sn">' + (x.done ? '\u2713' : x.n) + '</span><b>' + x.h + '</b></div><div class="st">' + esc(x.t) + '</div><small>' + esc(x.s) + '</small><button class="btn zb" type="button" ' + x.act + '>' + esc(x.b) + '</button></div>';
      }).join('') + '</div><div class="streak"><span>Streak <b>' + streak + ' day' + (streak === 1 ? '' : 's') + '</b></span>' + (pl ? '' : '<span>Puzzle rating <b>' + Math.round(prof.rating) + '</b></span>') + '<span>Solved today <b>' + d.solved + '</b></span></div>';
  }
  function coursePct() { var parts = 0, done = 0; UNITS.forEach(function (u) { var c = prof.course[u.id] || {}; unitParts(u).forEach(function (k) { parts++; if (c[k]) done++; }); }); return Math.round(100 * done / parts); }
  function streakDays() {
    var n = 0, d = new Date();
    for (var i = 0; i < 400; i++) {
      var r = prof.days[dkey(d)], active = r && (r.puz || r.games || r.course);
      if (active) n++; else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }
  function recLevel() { var r = prof.rating; return r < 600 ? 1 : r < 850 ? 2 : r < 1150 ? 3 : r < 1450 ? 4 : r < 1800 ? 5 : r < 2200 ? 6 : 7; }
  function startPart(id, k) {
    var u = UNIT[id]; if (!u) return;
    if (k === 'learn') return startLesson(id);
    if (k === 'practice') {
      var p = u.practice;
      if (p.type === 'squares') return startSession('squares', { title: 'Name the square', count: p.count, pass: p.pass, unit: id, part: 'practice' });
      if (p.type === 'reach') return startSession('reach', { title: 'Where can it go?', count: p.count, pass: p.pass, unit: id, part: 'practice' });
      if (p.type === 'safety') { var it = safetyItems(p.count, p.hard); return startSession('safety', { title: 'Safe or blunder?', count: it.length, pass: Math.min(p.pass, it.length), unit: id, part: 'practice', items: it }); }
      var items = pickPuzzles(p.themes, p.min || 0, p.max || 3000, p.count, p.extra);
      return startSession('puzzles', { title: u.title + ': practice', count: items.length, pass: Math.min(p.pass, items.length), unit: id, part: 'practice', items: items });
    }
    var a = u.apply;
    if (a.type === 'game') return newGame(true, { level: a.level, color: 'r', goal: { type: a.goal, unit: id, text: a.text, status: 'active' } });
    if (a.type === 'drill') return startDrill(id, a);
    if (a.type === 'reviews') { checkReviews(); switchTab('progress'); return; }
    if (a.type === 'book') { var lines = shuffle(COURSE.BOOK.slice()).slice(0, 4); return startSession('book', { title: 'Opening repertoire', count: 4, pass: 3, unit: id, part: 'apply', items: lines }); }
  }

  function msgMood(m) {
    if (!m) return 'neutral'; if (m.mood) return m.mood;
    var t = (m.title || '') + ' ';
    if (/Solved|held|Checkmate in|All \d+ found|Line complete, no|Correct/.test(t)) return 'proud';
    if (/Not quite|Out of moves|Lost|Stalemate|That was|Not the book|blunder|Actually|wrong/i.test(t)) return 'worried';
    if (/Right!|Good|Book move|keep going|safe/i.test(t)) return 'happy';
    if (/Hint|Tap|wants to play|to move|more to find/.test(t)) return 'think';
    return 'neutral';
  }
  function stripText(h) { return String(h || '').replace(/<button[^>]*class="mvc"[^>]*data-p="(\w)"[^>]*>.*?<span class="mvt">([^<]*)<\/span><\/button>/g, function (_, p, t) { return GLYPH[p] + VS + t; }).replace(/<button[^>]*class="mvplay"[^>]*>.*?<\/button>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim(); }
  function chipText(h) {
    var parts = String(h || '').replace(/<span class="mline">.*?<button[^>]*class="mvplay"[^>]*>.*?<\/button><\/span>/g, '').replace(/(The line|Their plan|Full line):\s*/g, '').split(/(<button[^>]*class="mvc"[^>]*>.*?<\/button>)/);
    return parts.map(function (x, i) { return i % 2 ? x : esc(String(x).replace(/<[^>]+>/g, '').replace(/\s+/g, ' ')); }).join('').trim();
  }
  function renderStrip() {
    var el = $('coachStrip'), t = '', x = '', mood = 'neutral', pl = plain(), pw = '';
    if (st.mode === 'play') {
      var f = st.fb || {}; t = f.title || ''; x = f.text || (pl ? f.words || (f.noSan ? f.mv : '') : f.mv) || '';
      mood = f.mood || (f.cls && f.cls !== 'info' ? Avatar.moodFor(f.cls) : /Hint/.test(t) ? 'think' : 'neutral');
      if (pl) {
        /* D34: a Beginner's strip reads in order of play: your grade, your feedback, then Rani's partner's move.
           The partner's "why" stays in the coach card, so check is never said twice. */
        if (f.cls && CLS[f.cls]) t = CLS[f.cls].title + '.';
        pw = !st.busy ? partnerWords() : '';
        if (pw) x = (x ? x + ' ' : '') + pw;
      } else if (st.opp && !st.busy && st.opp.why.length) x = (x ? x + ' ' : '') + 'Engine replied ' + st.opp.san + ': ' + st.opp.why[st.opp.why.length - 1].h;
    }
    else if (st.mode === 'review' && st.rv) {
      var n = st.rv.notes[st.rv.ply - 1], lm = pl && st.rv.ply ? lastMove(st.rv.g) : null, sw = lm ? Words.say(lm, lm.color === st.rv.user) : '';
      if (n && n.side === 'u') { t = sw ? sw + ' ' + CLS[n.cls].title + '.' : CLS[n.cls].title; x = n.text; mood = Avatar.moodFor(n.cls); }
      else if (n && n.why) { t = sw || 'Engine played ' + st.rv.sans[st.rv.ply - 1]; x = n.why.length ? n.why[n.why.length - 1].h : ''; }
      else if (sw) { t = sw; x = ''; }
      else { t = 'Review'; x = 'Step through with Next.'; }
    }
    else if (st.mode === 'lesson' && st.ls) { t = st.ls.unit.title; x = st.ls.unit.lesson[st.ls.i].text; mood = 'happy'; }
    else if (st.ses && st.ses.finished) { var sok = st.ses.pass == null || st.ses.right >= st.ses.pass; t = sok ? 'Session complete' : 'Almost there'; x = st.ses.right + ' of ' + st.ses.count + ' correct.'; mood = sok ? 'proud' : 'worried'; }
    else if (st.ses && st.ses.msg) { t = (pl && st.ses.msg.titlePlain) || st.ses.msg.title || ''; x = st.ses.msg.text || (pl ? '' : st.ses.msg.mv) || ''; mood = msgMood(st.ses.msg); }
    if (st.busy) mood = 'think';
    t = speak(t); x = speak(x);
    el.classList.toggle('full', pl && st.mode === 'play'); /* D34: nothing clamped */
    var key = mood + t + x + Coach3D.get();
    if (el.dataset.k === key) return; el.dataset.k = key;
    el.innerHTML = t || x ? Avatar.coach(mood, 46) + '<div class="bub"><b>' + esc(stripText(t)) + '</b><span>' + chipText(x) + '</span></div>' : '';
    if (pl && pw) revealStrip(el);
  }
  /* N-1: on phones, once the partner's move shows in a Beginner's strip, keep the strip above the fixed nav. Only when the
     board's top stays on screen (or is already off it), never during a drag or while focus is in a panel or sheet. */
  function revealStrip(el) {
    if (!window.matchMedia || !matchMedia('(max-width: 600px)').matches || !window.requestAnimationFrame) return;
    requestAnimationFrame(function () {
      var a = document.activeElement, nav = document.querySelector('.tabs');
      if (drag || !nav || !el.isConnected || (a && a.closest && a.closest('.panel, .sheet, .placement, .raninote'))) return;
      /* G2a: with the tabs hidden (the board screen) the strip only has to clear the bottom of the screen */
      var d = el.getBoundingClientRect().bottom + 8 - (nav.getClientRects().length ? nav.getBoundingClientRect().top : window.innerHeight), bt = boardRoom(el);
      if (d <= 0 || (bt >= 0 && bt - d < 0)) return;
      window.scrollBy({ top: d, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
  }
  function setTheme(id) {
    if (!Avatar.SETS[id]) return;
    st.theme = id; lsSet('suresh-chess-coach.pieces', id); prof.theme = id; saveProfile(); decorateChips(true);
    render(); renderLook();
  }
  /* D41: the same markup on Home's card (Improver, Club, Show everything) and in Settings (every level), with no container ids.
     A re-render keeps focus on the same choice in its own container (keyboard users in the sheet). */
  var TAGSW = '<!--tagsw-->';
  function renderLook() {
    /* G1 (G-D15): the "Piece tags" switch is in Settings only (G-D7: Home's card does not change). It turns the tags on
       themed pieces on and off in both board views; the name line for a tapped piece stays either way. */
    var base = lookHtml(), sw = '<button class="switchrow tagsw" type="button" role="switch" aria-checked="' + tagsOn() + '" data-act="tags"><span><b>Piece tags</b></span><i class="sw" aria-hidden="true"></i></button>';
    [['lookCard', 'lc-'], ['lookSet', 'ls-']].forEach(function (c) {
      var el = $(c[0]); if (!el) return;
      /* the piece previews' gradient ids get a prefix per container: no duplicate ids, and a preview never paints from a
         gradient inside a hidden board or panel (D38 hides the board on Beginner Home) */
      var html = base.replace(/(id="|url\(#)tk/g, '$1' + c[1] + 'tk').replace(TAGSW, c[0] === 'lookSet' ? sw : '');
      var a = document.activeElement, keep = a && el.contains(a) && a.dataset ? (a.dataset.coach ? '[data-coach="' + a.dataset.coach + '"]' : a.dataset.set ? '[data-set="' + a.dataset.set + '"]' : a.dataset.act ? '[data-act="' + a.dataset.act + '"]' : null) : null;
      if (el._h === html) return; el._h = html; el.innerHTML = html;
      if (keep) { var f = el.querySelector(keep); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }
    });
  }
  function lookHtml() {
    var groups = [], by = {};
    Object.keys(Avatar.SETS).forEach(function (id) { var gname = Avatar.SETS[id].group || 'More'; if (!by[gname]) { by[gname] = []; groups.push(gname); } by[gname].push(id); });
    var ORDER = ['Classic', 'Indian epics', 'Indian history', 'Fables', 'World myths', 'Fantasy']; groups.sort(function (x, y) { var i = ORDER.indexOf(x), j = ORDER.indexOf(y); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
    var cc = Coach3D.get(), tg = tagsOn();
    return '<p class="eyebrow">Choose your coach</p><div class="sets coachpick">' + [['rani', 'Queen Rani', '3D animated queen. Reacts to every move.'], ['gaja', 'Coach Gaja', 'Flat elephant drawing. Lighter on old phones.']].map(function (o) { return '<button class="setbtn' + (cc === o[0] ? ' on' : '') + '" type="button" data-coach="' + o[0] + '" aria-pressed="' + (cc === o[0]) + '"><b>' + o[1] + '</b><small>' + o[2] + '</small></button>'; }).join('') + '</div><p class="eyebrow" style="margin-top:14px">Choose your pieces</p>' + TAGSW + groups.map(function (gname) {
      return '<p class="setgrp">' + esc(gname) + '</p><div class="sets">' + by[gname].map(function (id) {
        var S = Avatar.SETS[id], pv = ['k', 'q', 'n'].map(function (t) { var tk = Avatar.piece(id, 'w', t, tg); return '<span>' + (tk || GLYPH[t] + VS) + '</span>'; }).join('') + '<span>' + (Avatar.piece(id, 'b', 'k', tg) || GLYPH.k + VS) + '</span>';
        return '<button class="setbtn' + (st.theme === id ? ' on' : '') + '" type="button" data-set="' + id + '" aria-pressed="' + (st.theme === id) + '"><div class="pv">' + pv + '</div><b>' + esc(S.name) + '</b><small>' + esc(S.note) + '</small></button>';
      }).join('') + '</div>';
    }).join('') + '<p class="setnote">Every themed piece carries a small chess symbol. Tap a piece to see its name and how it moves.</p>';
  }


  /* ---------- level: check, Settings controls, Rani's note ---------- */
  var KINSTALL = 'suresh-chess-coach.install', KCHECKS = 'suresh-chess-coach.checks', boardHome = null;
  function installId() { var id = lsGet(KINSTALL); if (!id) { id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); lsSet(KINSTALL, id); } return id; }
  /* CSS hides by level (eval strip, engine pill, Moves card, opponent picker); JS does the tabs and the numbers inside text. */
  function applyLevel() {
    var de = document.documentElement;
    if (prof.level) de.dataset.level = prof.level; else delete de.dataset.level;
    if (prof.showAll) de.dataset.showall = '1'; else delete de.dataset.showall;
    syncHomeMode(); applyTabs();
  }
  /* S2a tab unlock: a Beginner sees Home, Learn and Play until 3 units from the start point are fully done (or Show everything). */
  function tabsLocked() { return prof.level === 'beginner' && !Profile.unlockDone(prof, UNITS, unitDone); }
  function tabOpen(t) { return !((t === 'train' || t === 'progress') && tabsLocked()); }
  function unlockedByLessons() { return Profile.unlockDone(Object.assign({}, prof, { showAll: false }), UNITS, unitDone); }
  function applyTabs() {
    var lock = tabsLocked();
    ['train', 'progress'].forEach(function (t) { $('tab-' + t).hidden = lock; });
    /* U-4: a live Train session ends as if the player closed it (results so far are already saved), then Home */
    if (lock && st.ses && zoneOf() === 'train') { exitMode(false); switchTab('coach'); }
    checkPark(); /* G2b: a set that waits on Train is dropped too when Train is out of reach */
    if (lock && !tabOpen(st.tab)) switchTab('coach');
  }
  /* A level, Show everything or merged profile change re-renders every visible screen at once (mid-game too). */
  function refreshUI() {
    applyLevel(); dropStaleOffers();
    $('coachStrip').dataset.k = ''; decorateChips(true); /* chips and the strip cache follow the level (D32) */
    render();
    var sh = $('settingsSheet'); if (sh && !sh.hidden) { renderLevelCard(); renderLook(); } /* an open sheet shows the merged level and switch (R2-6) */
    renderRemind(); remindSync(); /* D2 (DP-D19): the reminder follows whether the Daily puzzle card is offered */
    if (st.tab === 'coach') renderCoach(); else if (st.tab === 'path') renderPath(); else if (st.tab === 'train') renderTrain(); else if (st.tab === 'progress') renderProgress();
  }
  /* A re-render after a cloud pull keeps the player's place: focus goes back to the same control, and the scroll stays. */
  function focusKey(a) {
    if (!a || a === document.body || !window.CSS || !CSS.escape) return null;
    if (a.id) return '#' + CSS.escape(a.id);
    var ks = Object.keys(a.dataset || {}).filter(function (k) { return k !== 'dc' && k !== 'k' && k !== 'review'; }); /* data-review is an index: a merged game shifts it */
    if (a.dataset && a.dataset.review != null && !a.dataset.gid) return null;
    return ks.length ? a.tagName.toLowerCase() + ks.map(function (k) { return '[data-' + k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }) + '="' + CSS.escape(a.dataset[k]) + '"]'; }).join('') : null;
  }
  function keepFocus(fn) {
    var a = document.activeElement, key = focusKey(a), x = window.scrollX, y = window.scrollY;
    fn();
    if (key && !a.isConnected) { var b = document.querySelector(key); if (b && b.offsetParent !== null) try { b.focus({ preventScroll: true }); } catch (e) {} }
    if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
  }
  function focusTab() {
    var b = $('tab-' + st.tab); if (!b || b.offsetParent === null) b = actOpen() ? $('actText') : null; /* G2a: the tabs are hidden on the board screen */
    if (b) try { b.focus({ preventScroll: true }); } catch (e) {}
  }
  var PL_HOST = {
    coach: function (mood, size) { return Avatar.coach(mood, size); },
    bank: function () { return window.PUZZLE_BANK || []; },
    units: function () { return UNITS; },
    mountBoard: function (slot) {
      var b = $('board') || boardHome && boardHome.el; if (!b || !slot) return;
      if (!boardHome) boardHome = { el: b, parent: b.parentNode, next: b.nextSibling };
      slot.appendChild(b); render();
    },
    showPuzzle: function (p, cb) {
      if (st.mode !== 'placement') st.plPrev = { mode: st.mode, af: st.af, arrows: st.arrows, hls: st.hls, flash: st.flash };
      st.mode = 'placement'; st.af = false; st.sel = null; st.flash = null; resetHints();
      var g = new Chess(p.fen);
      st.pl = { p: p, g: g, side: g.turn(), done: false, cb: cb };
      render();
    },
    endBoard: function () {
      if (boardHome) { boardHome.parent.insertBefore(boardHome.el, boardHome.next && boardHome.next.parentNode === boardHome.parent ? boardHome.next : null); boardHome = null; }
      if (st.mode === 'placement') { var pv = st.plPrev || { mode: 'play' }; st.mode = pv.mode; st.af = !!pv.af; st.arrows = pv.arrows || []; st.hls = pv.hls || []; st.flash = pv.flash || null; }
      st.pl = null; st.plPrev = null; st.sel = null; render();
    },
    finish: function (r) {
      /* Sync safety: only the first-launch check on a device that never finished a cloud load is provisional. */
      prof = Profile.setLevel(prof, r.level, { start: r.start, placed: r.placed, provisional: !r.retake && !lsGet(KSEEN), units: UNITS });
      saveProfile(); refreshUI();
      if (r.skippedFirst) showNote('You’re starting as a Beginner. You can take the check again in Settings.', 'level');
      afterLevel(); focusTab(); /* never leave focus on the page body */
      startOfferCheck(); focusOffer();
    },
    cancel: function () { renderSlots(); var a = document.activeElement; if (!a || a === document.body) focusTab(); startOfferCheck(); focusOffer(); }
  };
  /* After the check: a Beginner goes straight into their next lesson; Improver and Club go to Home. */
  function afterLevel() {
    var u = prof.level === 'beginner' ? nextUnit() : null;
    if (u) { if (st.mode === 'review') { st.rv = null; st.mode = 'play'; } st.unitOpen = u.id; startPart(u.id, nextPart(u) || 'learn'); render(); return; }
    switchTab('coach'); render();
  }
  function openPlacement(retake) {
    if (Placement.isOpen()) return;
    var n = (+lsGet(KCHECKS) || 0) + 1; lsSet(KCHECKS, n);
    if (st.mode === 'placement') PL_HOST.endBoard();
    Placement.open(PL_HOST, { retake: !!retake, seed: installId(), attempt: n });
    renderSlots(); /* F-D4: no slot under the level check */
  }
  function placementMove(from, to) {
    var P = st.pl, mv = P.g.move({ from: from, to: to, promotion: 'q' });
    if (!mv) return;
    var mate = P.g.in_checkmate();
    P.done = true; st.sel = null; st.flash = Placement.isCorrect(P.p, keyOf(mv), mate) ? { sq: mv.to, ok: true } : null;
    render();
    P.cb(keyOf(mv), mate);
  }
  function chooseLevel(id) {
    if (!Profile.LEVELS[id] || id === prof.level) return;
    prof = Profile.setLevel(prof, id, { placed: 'chosen', provisional: false, units: UNITS });
    saveProfile(); refreshUI(); renderLevelCard('[data-lvset="' + id + '"]');
  }
  function renderLevelCard(focusSel) {
    var el = $('levelCard'); if (!el) return;
    var ae = document.activeElement, keep = focusSel || null;
    if (!keep && ae && el.contains(ae)) keep = ae.dataset.lvset ? '[data-lvset="' + ae.dataset.lvset + '"]' : ae.dataset.act ? '[data-act="' + ae.dataset.act + '"]' : null;
    var cur = prof.level, L = Profile.LEVELS[cur];
    el.innerHTML = '<p class="eyebrow" id="lvLabel">Your level</p><div class="seg" role="radiogroup" aria-labelledby="lvLabel">' + Profile.ORDER.map(function (id, i) {
      var on = id === cur, tab = on || (!cur && i === 0);
      return '<button class="segbtn' + (on ? ' on' : '') + '" type="button" role="radio" aria-checked="' + on + '" tabindex="' + (tab ? 0 : -1) + '" data-lvset="' + id + '">' + esc(Profile.LEVELS[id].name) + '</button>';
    }).join('') + '</div><p class="lvwho">' + (L ? esc(L.who) : 'Pick a level, or take the quick check.') + '</p>' +
      '<button class="linkbtn" type="button" data-act="recheck">Take the quick check again</button>' +
      '<button class="switchrow" type="button" role="switch" aria-checked="' + !!prof.showAll + '" data-act="showall"><span><b>Show everything</b><small>See all tabs, scores and move lists now</small></span><i class="sw" aria-hidden="true"></i></button>';
    if (keep) { var f = el.querySelector(keep); if (f) f.focus(); }
  }
  /* ---------- Settings sheet (gear in the header) ---------- */
  var setOpener = null;
  function openSettings() {
    var sh = $('settingsSheet'); if (!sh || !sh.hidden) return;
    setOpener = document.activeElement; renderLevelCard(); renderLook(); adDebug(); renderRemind(); remindPerm();
    sh.hidden = false; document.documentElement.classList.add('sheet-open'); adSync(); /* A-D12 */
    var pn = sh.querySelector('.sheet-panel'); if (pn) pn.focus({ preventScroll: true });
  }
  function closeSettings(noFocus) {
    var sh = $('settingsSheet'); if (!sh || sh.hidden) return;
    sh.hidden = true; document.documentElement.classList.remove('sheet-open'); unask(); adSync();
    var back = setOpener && setOpener.isConnected && setOpener.offsetParent !== null ? setOpener : $('settingsBtn');
    if (!noFocus && back) back.focus(); setOpener = null;
    if (!noFocus) focusOffer();
  }
  function trapTab(box, e) {
    var f = Array.prototype.filter.call(box.querySelectorAll('button:not([disabled]), a[href], [tabindex="0"], select, input'), function (x) { return x.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !box.contains(document.activeElement))) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && (document.activeElement === last || !box.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  }
  document.addEventListener('keydown', function (e) {
    var sh = $('settingsSheet'); if (!sh || sh.hidden) return;
    if (e.key === 'Escape') { e.preventDefault(); closeSettings(); return; }
    if (e.key === 'Tab') { trapTab(sh.querySelector('.sheet-panel'), e); return; }
    var t = e.target; if (!t || !t.dataset || !t.dataset.lvset) return;
    var d = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[e.key]; if (!d) return;
    e.preventDefault();
    var i = Profile.ORDER.indexOf(t.dataset.lvset), n = Profile.ORDER[(i + d + Profile.ORDER.length) % Profile.ORDER.length];
    chooseLevel(n); var f = $('levelCard').querySelector('[data-lvset="' + n + '"]'); if (f) f.focus();
  });
  /* ---------- Rani's notes: one at a time, the rest wait in a queue ----------
     key: a newer note with the same key replaces an older one (for example "Welcome back" replaces an outdated level note). */
  var noteQ = [], noteCur = null;
  function showNote(text, key) { queueNote({ kind: 'info', text: text, key: key || null }); }
  function queueNote(n) {
    if (n.kind === 'offer' && [noteCur].concat(noteQ).some(function (x) { return x && x.kind === 'offer' && x.from === n.from; })) return;
    if (n.key) {
      noteQ = noteQ.filter(function (x) { return x.key !== n.key; });
      if (noteCur && noteCur.key === n.key) { noteCur = n; drawNote(); return; }
    }
    noteQ.push(n);
    if (!noteCur) nextNote();
  }
  function drawNote() {
    var el = $('raniNote'), n = noteCur; if (!el) return;
    adSync(); /* A-D12: no banner under a note or an offer */
    if (!n) { el.hidden = true; el.innerHTML = ''; el.className = 'raninote'; return; }
    var offer = n.kind === 'offer', ask = n.kind === 'ask';
    el.className = 'raninote' + (offer || ask ? ' offer' : '');
    el.innerHTML = '<div class="rn-av">' + Avatar.coach(offer ? 'proud' : ask ? 'think' : 'happy', 46) + '</div><p>' + esc(n.text) + '</p>' +
      (offer ? '<div class="rn-btns"><button class="btn sm primary" type="button" data-act="offeryes">Yes, move me up</button><button class="btn sm" type="button" data-act="offerno">Not yet</button></div>'
        : ask ? '<div class="rn-btns"><button class="btn sm primary" type="button" data-act="askback">' + esc(Home.ASK.back) + '</button><button class="btn sm" type="button" data-act="askgo">' + esc(Home.ASK.go) + '</button></div>'
        : '<button class="btn sm" type="button" data-act="notedone">OK</button>');
    el.hidden = false;
    if (offer || ask) focusOffer();
  }
  /* D35: a note that asks a question takes keyboard focus, unless Settings or the level check is open (then when it closes) */
  function focusOffer() {
    var sh = $('settingsSheet'), b = $('raniNote').querySelector('[data-act="offeryes"], [data-act="askback"]');
    if (!b || !noteCur || (noteCur.kind !== 'offer' && noteCur.kind !== 'ask') || (sh && !sh.hidden) || Placement.isOpen()) return;
    try { b.focus({ preventScroll: true }); } catch (e) {}
  }
  /* D35: Esc closes Rani's note without saving anything (an offer comes back at the next app start); focus goes to the tab */
  document.addEventListener('keydown', function (e) {
    if (e.key !== 'Escape' || e.defaultPrevented || !noteCur) return;
    var sh = $('settingsSheet'); if ((sh && !sh.hidden) || Placement.isOpen()) return;
    e.preventDefault(); escNote();
  });
  /* What Esc does to a note, shared with the phone's back button (G2c, G-D40) */
  function escNote() {
    nextNote();
    var a = document.activeElement; if (!noteCur && (!a || a === document.body)) focusTab();
  }
  function nextNote() {
    var el = $('raniNote'), had = !!(el && el.contains(document.activeElement));
    noteCur = noteQ.shift() || null; drawNote();
    if (had) { var b = noteCur && el.querySelector('button'); if (b) b.focus(); else focusTab(); }
  }
  function hideNote() { nextNote(); }
  /* D49: Beginner Home's Continue on a lesson game while a game is going: Rani asks first (one question at a time, key 'ask').
     Esc closes it (keydown above) and keeps the old game; nothing is saved. Learn's Start buttons do not ask. */
  function askFirst(u) { if (UNIT[u]) queueNote({ kind: 'ask', key: 'ask', text: Home.ASK.text, u: u }); }
  function answerAsk(go) {
    var n = noteCur; if (!n || n.kind !== 'ask') return;
    noteCur = null;
    if (go) { st.unitOpen = n.u; startPart(n.u, 'apply'); } else exitMode(true);
    nextNote();
  }

  /* ---------- Level-up offer (D13, D20, D21): Rani asks; nothing changes without a tap ---------- */
  var NEXT_LEVEL = { beginner: 'improver', improver: 'club' }, offerChecked = false;
  function offerLevelUp() {
    var from = prof.level, to = NEXT_LEVEL[from]; if (!to) return;
    queueNote({ kind: 'offer', from: from, to: to, text: from === 'beginner'
      ? 'Ready for Improver? You finished every Foundations lesson. Next come forks, pins and other tactics.'
      : 'Ready for Club? You finished every Tactics lesson. Next come endgames and seeing two moves ahead.' });
  }
  /* An offer made for another level (the player changed level meanwhile) is dropped, never applied. */
  function dropStaleOffers() {
    noteQ = noteQ.filter(function (x) { return x.kind !== 'offer' || x.from === prof.level; });
    if (noteCur && noteCur.kind === 'offer' && noteCur.from !== prof.level) nextNote();
  }
  /* Sync safety: the answer is saved locally; saveProfile's push waits for this session's first cloud pull. */
  function answerOffer(yes) {
    var n = noteCur; if (!n || n.kind !== 'offer') return;
    noteCur = null;
    if (yes && prof.level === n.from) {
      prof = Profile.setLevel(prof, n.to, { placed: 'chosen', units: UNITS }); prof.unlockAll = true;
      saveProfile(); refreshUI();
      noteQ.unshift({ kind: 'info', text: n.to === 'improver' ? 'You’re an Improver now. All tabs are open.' : 'You’re Club level now.', key: 'level' });
    } else if (!yes) {
      prof.levelOfferT = Date.now(); saveProfile();
      noteQ.unshift({ kind: 'info', text: 'OK. I’ll ask again in a week. You can change it any time in Settings.' });
    }
    nextNote();
  }
  /* Sync safety for the offer (review D-1, D-2): an offer is only shown once this session's profile is settled:
     'none' = no cloud on purpose (no runtime, not signed in), 'ready' = the first pull merged. 'pending' (setting up, or the
     first pull not done yet, retrying) and 'failed' (setup error) fail closed: no offer, nothing written. */
  var cloudState = 'pending', heldOffer = { start: false, lesson: null };
  function cloudSettled() { return cloudState === 'none' || cloudState === 'ready'; }
  function settleCloud(state) {
    if (cloudSettled() || cloudState === 'failed') return;
    cloudState = state; if (!cloudSettled()) return;
    if (pendingLesson) { heldOffer.lesson = pendingLesson; pendingLesson = null; }
    startOfferCheck(); releaseOffer();
  }
  /* Lesson trigger (D21): at once when settled; otherwise remember the level that was completed, for after the merge. */
  var pendingLesson = null;
  function lessonOffer() { if (cloudSettled()) offerLevelUp(); else pendingLesson = prof.level; }
  /* Start trigger (D21): once per session, after the profile settled and when no level check is open (D-3: a check that is
     open now re-runs this when it closes). */
  function startOfferCheck() {
    if (offerChecked || !cloudSettled() || Placement.isOpen()) return;
    offerChecked = true; heldOffer.start = true; releaseOffer();
  }
  /* D-4: an offer that arrives late never pops up in the middle of a lesson, puzzle set, review or game; it waits for Home
     or for the activity to end. It is checked again when it is finally shown. */
  function inActivity() {
    if (phone()) return actOpen() && !endUp(); /* G2a: on phones, while the board screen is open without an end card */
    if (st.tab === 'coach') return false;
    return st.mode === 'lesson' || st.mode === 'review' || !!(st.ses && !st.ses.finished) || (st.mode === 'play' && st.tab === 'play' && G.history().length > 0 && !G.game_over());
  }
  function releaseOffer() {
    if (!heldOffer.start && !heldOffer.lesson) return;
    if (Placement.isOpen() || inActivity()) return;
    var ok = (heldOffer.lesson && heldOffer.lesson === prof.level && Profile.levelComplete(prof, UNITS, unitDone)) || (heldOffer.start && (Profile.offerDue(prof, Date.now(), UNITS, unitDone) || Profile.lessonOfferDue(prof, UNITS, unitDone, Date.now())));
    heldOffer = { start: false, lesson: null };
    if (ok) offerLevelUp();
  }

  /* ---------- Coach home: the roadmap ---------- */
  var RM = COURSE.ROADMAP;
  function bestWinLevel() { var m = 0; prof.games.forEach(function (g) { if (g.r === 'W' && g.level > m) m = g.level; }); return m; }
  /* R2-1: a Beginner's opponent is always Rani's practice partner (OPP 1, D19), so that is the game to win at every stage */
  function beatLevel(S) { return plain() ? Profile.LEVELS.beginner.opp : S.beat; }
  function stageMiles(S) {
    /* D20/D31: in the player's starting stage, lessons before their start point are skipped, not required */
    var from = RM.indexOf(S) === firstStage() ? startPos() : 0;
    var us = UNITS.filter(function (u, i) { return i >= from && u.level === S.level; }), done = us.filter(unitDone).length;
    var out = [
      { t: 'Finish the Level ' + S.level + ' course units', v: done + '/' + us.length, ok: done === us.length },
      { t: 'Puzzle rating ' + S.target + '+', v: Math.round(prof.rating) + '', ok: prof.rating >= S.target, rt: true },
      { t: plain() ? 'Beat Rani’s practice partner' : 'Beat the ' + OPP[S.beat].name + ' engine (~' + OPP[S.beat].elo + ')', v: bestWinLevel() >= beatLevel(S) ? 'done' : 'not yet', ok: bestWinLevel() >= beatLevel(S) }
    ].filter(function (m) { return !(m.rt && plain()); }); /* D30: a Beginner's stage has no rating goal */
    if (S.stage === 6) out.push({ t: 'Review 3 finished games with the coach', v: Math.min((prof.reviewed || []).length, 3) + '/3', ok: (prof.reviewed || []).length >= 3 });
    return out;
  }
  function stageDone(S) { return stageMiles(S).every(function (m) { return m.ok; }); }
  /* S2a: Home starts at the player's level. The first candidate stage is the start unit's (or the next unit's);
     units before the start point are never suggested. */
  function startPos() { return Math.max(0, unitIndex(effStart())); }
  function firstStage() { var u = UNIT[effStart()] || nextUnit(); for (var i = 0; u && i < RM.length; i++) if (RM[i].level === u.level) return i; return 0; }
  function currentStage() { for (var i = firstStage(); i < RM.length; i++) if (!stageDone(RM[i])) return RM[i]; return RM[RM.length - 1]; }
  function nextAction(S) {
    var from = startPos(), us = UNITS.filter(function (u, i) { return i >= from && u.level === S.level && !unitDone(u); });
    if (us.length) { var u = us[0], k = nextPart(u); return { info: { kind: 'lesson', unit: u, part: k }, label: PART_NAME[k] + ': ' + u.title, sub: partDesc(u, k), go: function () { st.unitOpen = u.id; startPart(u.id, k); } }; }
    var nx = nextUnit();
    if (!plain() && prof.rating < S.target) return { info: { kind: 'puzzles', target: S.target }, label: 'Rated puzzles to reach ' + S.target, sub: 'Your rating is ' + Math.round(prof.rating) + '. Ten puzzles a day moves it fastest.', go: function () { trainStart('rated'); } };
    if (bestWinLevel() < beatLevel(S)) return { info: { kind: 'beat', name: OPP[S.beat].name }, label: plain() ? 'Beat Rani’s practice partner' : 'Beat the ' + OPP[S.beat].name + ' engine', sub: 'Play slowly, blunder-check every move, and review the game after.', go: function () { newGame(false, { level: beatLevel(S) }); } };
    if (nx) { var k2 = nextPart(nx); return { info: { kind: 'lesson', unit: nx, part: k2 }, label: PART_NAME[k2] + ': ' + nx.title, sub: partDesc(nx, k2), go: function () { st.unitOpen = nx.id; startPart(nx.id, k2); } }; }
    return { info: { kind: 'sharp' }, label: 'Keep sharp: rated puzzles', sub: 'You’ve finished the roadmap. Keep playing stronger opponents.', go: function () { trainStart('rated'); } };
  }
  var _next = null;
  function goNext() { if (_next) _next.go(); }
  /* ---------- F1 (F-D8, F-D10): the Continue card on Improver and Club Home. It follows today's Next step exactly:
     the same nextAction result, shown as a card. Lessons count in the lesson's course level from the effective start (D29). ---------- */
  function contCard() {
    var a = nextAction(currentStage()), i = a.info; _next = a;
    if (i.kind === 'lesson') {
      var from = startPos(), us = UNITS.filter(function (x, j) { return j >= from && x.level === i.unit.level; });
      i = { kind: 'lesson', unit: i.unit, part: i.part, title: i.unit.title, n: us.indexOf(i.unit) + 1, m: us.length, done: us.filter(unitDone).length, started: unitStarted(i.unit) };
    }
    var C = Flow.cont(i, gameOn()); C.unit = i.unit || null; C.part = i.part || null;
    return C;
  }
  /* 'part' asks first for a lesson game over an unfinished game (D49); 'next' is today's Next step; 'back' opens the game. */
  function contAttr(C) { return C.go === 'part' ? partAttr(C.unit.id, C.part) : C.go === 'back' ? 'data-act="close"' : 'data-go="next"'; }
  function renderCont() {
    var el = $('contCard'), C = contCard();
    /* Fix round 1: a lesson that is waiting is resumed at its step */
    var w = waitingPart(), rl = Flow.resumesLesson({ go: C.go, unit: C.unit && C.unit.id, part: C.part }, w); /* G-D37: or its practice set or task */
    var html = '<div class="bh-row"><span class="bh-ic z-' + C.zone + '" aria-hidden="true">' + GLYPH[C.icon] + VS + '</span><div class="bh-tt"><p class="bh-kick">' + esc(C.kicker) + '</p><h3 class="bh-title" id="ccTitle">' + esc(C.title) + '</h3></div></div>' +
      (C.bar ? '<div class="bh-bar" role="progressbar" aria-labelledby="ccTitle" aria-valuemin="0" aria-valuemax="' + C.bar.m + '" aria-valuenow="' + C.bar.done + '" aria-valuetext="' + esc(C.bar.text) + '"><i style="width:' + Math.round(100 * C.bar.done / Math.max(1, C.bar.m)) + '%"></i></div>' : '') +
      '<button class="btn primary big bh-go" type="button" ' + (rl ? RESUME_LESSON : contAttr(C)) + '>' + esc(rl ? Flow.resumeTitle(w.kind) : C.button) + '</button>';
    if (el._k === html) return;
    var keep = el.contains(document.activeElement);
    el._k = html; el.innerHTML = html;
    if (keep) { var f = el.querySelector('.bh-go'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }
  }
  /* ---------- S2b: Beginner Home (prototype A): Rani, one Continue card, a second button ---------- */
  var HOME_CARDS = ['contCard', 'stageHero', 'today', 'stageCard', 'roadCard', 'lookCard', 'methodsCard'];
  /* D44: an unfinished game, the same test as Today's Play step */
  function gameOn() { return !!(G.history().length && !G.game_over()); }
  /* D46 / D39: same win test as D30 in stageMiles */
  function homeState() { return Home.state(prof, UNITS, unitDone, unitStarted, nextPart, bestWinLevel() >= Profile.LEVELS.beginner.opp); }
  /* D38: on Beginner Home the board column hides in one-column layouts (CSS, up to 860px). State is never touched. */
  function syncHomeMode() { var de = document.documentElement; if (plain() && st.tab === 'coach') de.dataset.bhome = '1'; else delete de.dataset.bhome; }
  /* The buttons reuse the app's actions: data-part (as Learn), recgame (a partner game for plain()), close (back to the game),
     data-train="rated" (as Train). Re-rendered only when something on it changes, so focus and Rani's canvas stay put. */
  function bhAttr(s) {
    var u = s.unit ? s.unit.id : '';
    return { part: u ? 'data-part="' + s.part + '" data-u="' + u + '"' : '', ask: 'data-act="bhask" data-u="' + u + '"', game: 'data-act="recgame"', back: 'data-act="close"', puzzles: 'data-train="rated"' };
  }
  function renderBHome() {
    var el = $('bhome'); if (!el || !plain()) return;
    var s = homeState(), coach = Coach3D.get(), on = gameOn(), L = Home.lines(s, coach, on), sk = Home.streak(streakDays());
    /* G-D21: on phones every Home shows the "Resume game" card under the Continue card while a game is unfinished, and
       Beginner Home's second button "Resume game" is retired (wide screens keep D44 as it is). */
    var rs = on && phone();
    if (rs && L.alt === 'back') L.second = null;
    if (rs && L.go === 'back') rs = false; /* the Continue card's own button is the game: no second button for the same action */
    var w = waitingPart(), rl = Flow.resumesLesson({ go: L.go, unit: s.unit && s.unit.id, part: s.part }, w);
    /* "Resume game" is exitMode(true): an open lesson or puzzle set waits on its tab (G-D20, G-D35 replaced D50 at every
       width). D49: a lesson game with a game going asks first. G-D36: a game that ended while closed has its result card here. */
    var ec = phone() ? endedCard() : null;
    var act = bhAttr(s);
    /* D1 (DP-D1, DP-D9): once Foundations is done, the Daily puzzle card under the main card (and "Resume game"), above the second button */
    var dp = tabOpen('train') && Daily.shows(true, s.kind) ? dailyHtml('dpbTitle') : '';
    var html = '<div class="bh-hero"><div class="bh-av">' + Avatar.coach(s.kind === 'lesson' ? 'happy' : 'proud', 112) + '</div>' +
      '<div class="bh-bub"><h2 class="bh-head">' + esc(L.head) + '</h2>' + (L.line ? '<p class="bh-line">' + esc(L.line) + '</p>' : '') + '</div>' +
      (sk ? '<p class="bh-streak" role="img" aria-label="' + esc(sk.label) + '"><svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3c2 4 5 5 5 10a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 2 3 4"/></svg>' + esc(sk.text) + '</p>' : '') + '</div>' +
      '<div class="card bh-card"><div class="bh-row"><span class="bh-ic z-' + L.zone + '" aria-hidden="true">' + GLYPH[L.icon] + VS + '</span><div class="bh-tt"><p class="bh-kick">' + esc(L.kicker) + '</p><h3 class="bh-title" id="bhTitle">' + esc(L.title) + '</h3></div></div>' +
      (L.bar ? '<div class="bh-bar" role="progressbar" aria-labelledby="bhTitle" aria-valuemin="0" aria-valuemax="' + L.bar.m + '" aria-valuenow="' + L.bar.done + '" aria-valuetext="' + esc(L.bar.text) + '"><i style="width:' + Math.round(100 * L.bar.done / Math.max(1, L.bar.m)) + '%"></i></div>' : '') +
      '<button class="btn primary big bh-go" type="button" ' + (rl ? RESUME_LESSON : act[L.go]) + '>' + esc(rl ? Flow.resumeTitle(w.kind) : L.button) + '</button></div>' +
      (rs ? '<div class="card bh-card rs-card" id="resumeBHome">' + gameResume(false) + '</div>' : ec ? '<div class="card bh-card rs-card" id="resumeBHome">' + endedHtml(ec, false) + '</div>' : '') +
      (dp ? '<div class="card bh-card dp-card" id="dailyBHome">' + dp + '</div>' : '') +
      (L.second ? '<button class="btn big bh-alt" type="button" ' + act[L.alt] + '>' + esc(L.second) + '</button>' : '');
    var key = html + '|' + coach; if (el._k === key) return;
    var a = document.activeElement, keep = a && el.contains(a) ? (a.classList.contains('bh-alt') ? '.bh-alt' : a.classList.contains('rs-go') ? '.rs-go' : a.classList.contains('dp-go') ? '.dp-go' : '.bh-go') : null;
    el._k = key; el.innerHTML = html;
    if (keep) { var f = el.querySelector(keep) || el.querySelector('.bh-go'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }
  }
  /* ---------- D1: the Daily puzzle card (docs/specs/daily-puzzle.product.md; the rules are in daily.js) ----------
     prof.daily: today's pick and its result (Daily.today, Daily.record), saved in the profile so it is the same all day.
     The puzzle is a 1-puzzle set on Train (DP-D5): it counts, waits and comes back like any set; s.opts.daily marks it (isDaily). */
  function dayKey() { return Daily.key(new Date()); }
  function isDaily(s) { return !!(s && s.opts && s.opts.daily); } /* a drill has no opts */
  /* Today's record; a new day (or a puzzle gone from the bank, or solved elsewhere first) picks a new one. Fix 1: it runs
     while Home is drawn, so it never saves the profile there: the pick is kept on the device only, with prof.t untouched
     and nothing pushed, so opening the app never makes this copy look newer before the cloud pull. It travels with the
     next real save; merge() never loses it either way. */
  function dailyRec() {
    var r = Daily.today(prof.daily, dayKey(), PZ, prof.rating, prof.puz);
    if (r !== prof.daily) { prof.daily = r; lsSet(PSTORE, prof); }
    return r;
  }
  /* The card's inside (id: its title's id). Empty when there is no puzzle to offer. */
  function dailyHtml(id) {
    var r = dailyRec(); if (!r.id) return '';
    var L = Daily.lines(Daily.state(r, dayKey()));
    return '<div class="bh-row"><span class="bh-ic z-train" aria-hidden="true">' + GLYPH.n + VS + '</span><div class="bh-tt"><p class="bh-kick">' + esc(L.kicker) + '</p><h3 class="bh-title" id="' + id + '">' + esc(L.title) + '</h3></div></div>' +
      '<p class="dp-line">' + esc(L.line) + '</p>' + (L.button ? '<button class="btn big dp-go" type="button" data-act="daily">' + esc(L.button) + '</button>' : '');
  }
  /* Improver and Club Home, and a Beginner with Show everything on (DP-D1). Beginner Home draws its own (renderBHome). */
  function renderDaily() {
    var el = $('dailyCard'), html = prof.level && !plain() && tabOpen('train') ? dailyHtml('dpTitle') : ''; /* nothing before the level check */
    el.hidden = !html;
    if (el._k === html) return;
    var keep = el.contains(document.activeElement);
    el._k = html; el.innerHTML = html;
    if (keep) { var f = el.querySelector('.dp-go') || $('contCard').querySelector('.bh-go'); if (f) try { f.focus({ preventScroll: true }); } catch (e) {} }
  }
  /* Solve it. One try a day (DP-D6): a result today leaves only the card. The daily puzzle that waits on Train (left
     mid-puzzle, or read back after a restart) comes back as it is (G2b); otherwise it starts, and the newest on Train wins. */
  function dailyStart() {
    var r = dailyRec(), p = PZ_BY[r.id];
    if (Daily.state(r, dayKey()) !== 'todo' || !p) { renderCoach(); return; }
    var w = waitOn('train');
    if (w && w.daily && w.items[0] === r.id) { resumeAct('train'); return; }
    startSession('puzzles', { title: Daily.lines('todo').kicker, count: 1, items: [p], daily: r.d }); /* the day it is dealt (DP-D12) */
  }
  /* The first result for the puzzle is its day's result (DP-D12: the day it was dealt, s.opts.daily), saved with the rated
     result that follows (recordPuzzle). */
  function dailyResult(s, id, ok) {
    var d = s.opts.daily; prof.daily = Daily.record(prof.daily, typeof d === 'string' ? d : prof.daily.d, id, ok);
    if (ok) rateHappy = true; /* D2 (DP-D4): a solved daily puzzle is a happy moment */
    remindSync(); /* D2 (AC6): today is done, so today's reminder goes */
    /* fix 2: and one already on the phone's screen. Today's only when today is now done: yesterday's daily finished
       after midnight (DP-D12) leaves today's reminder in place, since today's puzzle is still to do. */
    remindDelivered([Daily.state(prof.daily, dayKey()) !== 'todo' ? dayKey() : '', typeof d === 'string' ? d : '']);
  }
  /* Fix 3c: Home turns over at local midnight, and when the app comes back to the front (a phone that slept through it). */
  var dayTimer = null;
  function armDay() { clearTimeout(dayTimer); dayTimer = setTimeout(function () { dayTurn(); remindSync(); }, Daily.untilMidnight(new Date()) + 1000); } /* D2: and the reminders, for the new 7 days */
  /* Only when the day has turned since Home last drew its card, and keeping focus and scroll (as a cloud pull's re-render). */
  function dayTurn() { armDay(); if (st.tab === 'coach' && prof.level && prof.daily && prof.daily.d && prof.daily.d !== dayKey()) keepFocus(renderCoach); }
  function renderCoach() {
    /* D40: Beginner Home only for a Beginner with Show everything off; otherwise the full Home, as an Improver at their stage */
    var bh = plain();
    $('bhome').hidden = !bh; HOME_CARDS.forEach(function (id) { $(id).hidden = bh; });
    syncHomeMode();
    if (bh) { $('dailyCard').hidden = true; renderBHome(); return; }
    var S = currentStage(), miles = stageMiles(S), done = miles.filter(function (m) { return m.ok; }).length, pl = plain(), fs = RM[firstStage()].stage;
    renderCont(); /* F-D10: the Next step is the Continue card; the stage card keeps its text, bar and milestones */
    renderDaily();
    $('stageHero').innerHTML = '<div class="herorow">' + Avatar.coach(done ? 'happy' : 'neutral', 64) + '<div><p class="eyebrow">' + esc(Avatar.coachName()) + ' \u00B7 Stage ' + S.stage + ' of 6</p><h3>' + esc(S.name) + '</h3></div></div><p>' + esc(S.why) + '</p>' +
      '<div class="mbar"><i style="width:' + Math.round(100 * done / miles.length) + '%"></i></div><div class="meta"><span>' + done + ' of ' + miles.length + ' milestones</span>' + (pl ? '' : '<span>Rating band ' + esc(S.band) + '</span>') + '</div>';
    renderToday(); renderLook();
    var V = RM[(st.stageView || S.stage) - 1], vm = stageMiles(V), cur = V.stage === S.stage;
    var us = UNITS.filter(function (u) { return u.level === V.level; });
    $('stageCard').innerHTML = '<p class="eyebrow">' + (cur ? 'Your stage in detail' : 'Stage ' + V.stage + ' preview') + '</p><h3 style="margin:2px 0 4px;font-family:var(--f-display);font-size:22px">' + V.stage + '. ' + esc(V.name) + '</h3><p class="goal" style="margin:0;color:var(--muted)">' + (pl ? '' : esc(V.band) + ' · ') + (stageDone(V) ? 'complete' : cur ? 'in progress' : V.stage < S.stage ? 'complete' : 'coming up') + '</p>' +
      '<div class="sect"><h4>1. Theory to learn</h4><div class="unitchips">' + us.map(function (u) { return '<button class="puz' + (unitDone(u) ? ' done' : '') + '" type="button" data-unit="' + u.id + '">' + esc(u.title) + '</button>'; }).join('') + '</div></div>' +
      '<div class="sect"><h4>2. How to train at this stage</h4><ul>' + V.method.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="sect"><h4>3. Daily and weekly routine</h4><ul>' + V.routine.map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('') + '</ul></div>' +
      '<div class="sect"><h4>4. Milestones to move on</h4><div class="miles">' + vm.map(function (m) { return '<div class="mile' + (m.ok ? ' done' : '') + '"><span class="ck">' + (m.ok ? '✓' : '') + '</span><span>' + esc(m.t) + '</span><em>' + esc(m.v) + '</em></div>'; }).join('') + '</div></div>' +
      '<div class="sect"><h4>5. Outside this app</h4><ul class="reslist">' + V.resources.map(function (r) { return '<li>' + (r[1] ? '<a href="' + esc(r[1]) + '" target="_blank" rel="noopener">' + esc(r[0]) + '</a>' : esc(r[0])) + '</li>'; }).join('') + '</ul></div>';
    $('roadCard').innerHTML = '<p class="eyebrow">The road to Expert</p><div class="road">' + RM.map(function (R) {
      /* stages before the player's starting stage were skipped, not done */
      var d = stageDone(R) || (R.stage < S.stage && R.stage >= fs), c = R.stage === S.stage;
      return '<button class="roadrow' + (d ? ' done' : '') + (c ? ' cur' : '') + (V.stage === R.stage ? ' sel' : '') + '" type="button" data-stage="' + R.stage + '"><div><b>' + R.stage + '. ' + esc(R.name) + '</b>' + (pl ? '' : '<small>' + esc(R.band) + '</small>') + '</div><span class="tag2">' + (c ? 'You are here' : d ? 'Done' : '') + '</span></button>';
    }).join('') + '</div>' + (pl ? '' : '<p style="margin:12px 0 0;font-size:13px;color:var(--muted)">Ratings are rough guides on the US Chess scale, where Expert is 2000 to 2199. Most adults need a few years of steady practice to get there. Each stage is a solid step on its own.</p>');
    $('methodsCard').innerHTML = '<p class="eyebrow">The most beginner-friendly ways to learn</p><div class="methods">' + COURSE.METHODS.map(function (m) { return '<div class="method"><div><b>' + esc(m.name) + '</b><p>' + esc(m.how) + '</p><small>In this app: ' + esc(m.here) + '</small></div></div>'; }).join('') + '</div>';
  }
  function checkReviews() { if ((prof.reviewed || []).length >= 3 && UNIT.analysis && !(prof.course.analysis || {}).apply) markUnit('analysis', 'apply'); }
  /* ---------- Train tab ---------- */
  function renderTrain() {
    var counts = {}; PZ.forEach(function (p) { p.themes.forEach(function (t) { counts[t] = (counts[t] || 0) + 1; }); });
    $('themeList').innerHTML = Object.keys(THEMES).filter(function (t) { return counts[t] >= 3; }).map(function (t) { return '<button class="puz" type="button" data-theme="' + t + '">' + esc(THEMES[t]) + ' <small>' + counts[t] + '</small></button>'; }).join('');
    $('bookList').innerHTML = COURSE.BOOK.map(function (b) { return '<button class="puz" type="button" data-book="' + b.id + '">' + esc(b.name) + '</button>'; }).join('');
    $('drillList').innerHTML = UNITS.filter(function (u) { return u.apply && u.apply.type === 'drill'; }).map(function (u) { return '<button class="puz' + ((prof.course[u.id] || {}).apply ? ' done' : '') + '" type="button" data-drill="' + u.id + '">' + esc(u.title) + '</button>'; }).join('');
    var due = dueList().length, rb = $('reviewDueBtn'); rb.textContent = 'Review missed (' + due + ')'; rb.disabled = !due;
    var pl = plain(); /* S2a: a Beginner's puzzle card has no rating words */
    $('ratedHead').textContent = pl ? 'Puzzles at your level' : 'Rated puzzles';
    $('ratedLede').textContent = pl ? 'Puzzles picked for you. Solve them to get stronger.' : 'Puzzles picked at your level. Your puzzle rating goes up when you solve and down when you miss.';
    $('ratedBtn').textContent = pl ? 'Start 10 puzzles' : 'Start 10 rated puzzles';
  }
  function trainStart(kind) {
    if (kind === 'rated') return startSession('puzzles', { title: plain() ? 'Puzzles at your level' : 'Rated puzzles', count: 10, rated: true, pick: ratedPick() });
    if (kind === 'review') { var d = shuffle(dueList()).slice(0, 10); if (!d.length) return; return startSession('puzzles', { title: 'Review missed puzzles', count: d.length, items: d, review: true }); }
    if (kind === 'safety') { var it = safetyItems(10, prof.rating > 1300); return startSession('safety', { title: 'Safe or blunder?', count: it.length, items: it }); }
  }
  function themeStart(t) { var items = pickPuzzles([t], 0, 3000, 10); startSession('puzzles', { title: 'Theme: ' + (THEMES[t] || t), count: items.length, items: items, theme: t }); }

  /* ---------- Progress tab ---------- */
  function renderProgress() {
    var gs = prof.games, w = gs.filter(function (g) { return g.r === 'W'; }).length, l = gs.filter(function (g) { return g.r === 'L'; }).length, d = gs.length - w - l, pl = plain();
    $('stats').classList.toggle('n3', pl); /* no rating tile: 3 tiles in one row, no orphan */
    $('stats').innerHTML = (pl ? '' : '<div><b>' + Math.round(prof.rating) + '</b><span>puzzle rating</span></div>') + '<div><b>' + UNITS.filter(unitDone).length + '/' + UNITS.length + '</b><span>units done</span></div>' +
      '<div><b>' + w + '–' + l + '–' + d + '</b><span>games W–L–D</span></div><div><b>' + streakDays() + '</b><span>day streak</span></div>';
    var top = topWeakness(), th = themeStats(), weakTheme = Object.keys(th).filter(function (k) { return th[k].n >= 3; }).sort(function (a, b) { return th[a].pct - th[b].pct; })[0];
    var html = '';
    if (top) { var wk = WEAK[top]; html += '<h3>' + wk.title + '</h3><p>' + wk.text + '</p><div class="puzrow"><button class="puz" type="button" data-unit="' + wk.unit + '">Lesson: ' + esc(UNIT[wk.unit].title) + '</button>' + wk.themes.map(function (t) { return '<button class="puz" type="button" data-theme="' + t + '">Train: ' + esc(THEMES[t]) + '</button>'; }).join('') + '</div>'; }
    else html += '<h3>Build the blunder-check habit</h3><p>Finish a game and I’ll find your weak spot. Until then: before each move, look at what your opponent’s last move attacks.</p>';
    if (weakTheme && th[weakTheme].pct < 70) html += '<p style="margin-top:10px">Puzzles: your weakest theme is <b>' + esc(THEMES[weakTheme] || weakTheme) + '</b> (' + th[weakTheme].pct + '% solved). <button class="btn sm" type="button" data-theme="' + weakTheme + '">Train it</button></p>';
    var rl = recLevel(), recent = gs.filter(function (g) { return g.level === st.level; }).slice(0, 2);
    if (pl) { /* a Beginner always plays Rani's practice partner (D19): no opponent advice, no ratings */ }
    else if (recent.length === 2 && recent.every(function (g) { return g.r === 'W'; }) && st.level < 8) html += '<p class="tip" style="margin-top:12px">You beat ' + OPP[st.level].name + ' twice in a row. Try <b>' + OPP[st.level + 1].name + '</b> next.</p>';
    else html += '<p class="tip" style="margin-top:12px">Suggested opponent for your level: <b>' + OPP[rl].name + '</b> (~' + OPP[rl].elo + ').</p>';
    $('focus').innerHTML = speak(html);
    var keys = Object.keys(th).sort(function (a, b) { return th[b].n - th[a].n; });
    $('themeStats').innerHTML = keys.length ? keys.map(function (k) { return '<div class="thstat"><span>' + esc(THEMES[k] || k) + '</span><i><b style="width:' + th[k].pct + '%"></b></i><em>' + th[k].ok + '/' + th[k].n + '</em></div>'; }).join('') : '<p class="empty-note">Solve some puzzles and your strengths and weak spots show up here.</p>';
    $('history').innerHTML = gs.length ? '<div class="hist">' + gs.slice(0, 12).map(function (g, i) { return gameRow(g, i, pl); }).join('') + '</div>' : '<p class="empty-note">No finished games yet. Your games show up here with a full review.</p>';
    renderResume(); /* G2a: Play's "Recent games" shows the first three of the same list */
  }
  /* One finished game's row: Progress, and on phones the first three on Play (G-D6). i: its place in prof.games. */
  function gameRow(g, i, pl) {
    var ds = new Date(g.d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
    return '<div class="hrow"><span class="res ' + g.r + '">' + { W: 'Won', L: 'Lost', D: 'Draw' }[g.r] + '</span><div>' + ds + ' · ' + (pl ? partnerName() : OPP[g.level] ? OPP[g.level].name : '') + ' · ' + (g.user === 'w' ? 'White' : 'Black') + '<small>' + Math.ceil(g.sans.length / 2) + ' moves' + (g.acc != null && !pl ? ' · accuracy ' + g.acc + '%' : '') + '</small></div><button class="btn sm" type="button" data-review="' + i + '" data-gid="' + esc(String(g.id)) + '">Review</button></div>';
  }
  function themeStats() {
    var out = {};
    Object.keys(prof.puz).forEach(function (id) { var r = prof.puz[id], p = PZ_BY[id]; if (!p) return; p.themes.forEach(function (t) { if (!THEMES[t]) return; var o = out[t] || (out[t] = { n: 0, ok: 0 }); o.n += r.n; o.ok += r.ok; }); });
    Object.keys(out).forEach(function (k) { out[k].pct = out[k].n ? Math.round(100 * out[k].ok / out[k].n) : 0; });
    return out;
  }

  /* ---------- tabs ---------- */
  function switchTab(name) {
    if (!tabOpen(name) || !$('panel-' + name)) name = 'coach'; /* S2a: a Beginner's Train and Progress stay out of reach until unlocked */
    if (st.tab !== name && visits[name] != null) visits[name]++; /* F-D12: a new visit to Home or Progress picks a new tip */
    if (name !== 'play') unask();
    st.tab = name; syncHomeMode(); fixScreen();
    ['coach', 'path', 'play', 'train', 'progress'].forEach(function (t) { $('tab-' + t).setAttribute('aria-selected', t === name ? 'true' : 'false'); $('panel-' + t).hidden = t !== name; });
    if (name === 'progress') renderProgress();
    if (name === 'train') renderTrain();
    if (name === 'path') renderPath();
    if (name === 'coach') renderCoach();
    lsSet('suresh-chess-coach.tab', name);
    renderZones(); renderEnd(); syncScreen(); renderHint(); renderSlots(); releaseOffer();
  }

  /* ---------- persistence ---------- */
  /* Sync safety: no push until this session's first pull has finished (merged, or cloud confirmed empty). */
  var cloud = { game: null, prof: null, gt: null, pt: null, ready: false, busy: null, tries: 0, retry: null }, KSEEN = 'suresh-chess-coach.cloudSeen', RETRY = [2000, 5000, 15000, 60000];
  function snapshot() { return { sans: G.history(), user: st.user, level: st.level, ann: st.ann, notes: st.notes, tags: st.tags, fb: st.fb, opp: st.opp, evalW: st.evalW, flipped: st.gf, recorded: st.recorded, goal: st.goal, unseen: st.unseen, t: st.t || 0 }; }
  function save() { st.t = Date.now(); var s = snapshot(); lsSet(STORE, s); push('game', s); }
  function saveProfile() {
    prof.t = Date.now();
    Object.keys(prof.days).sort(function (a, b) { return new Date(b.replace(/-/g, '/')) - new Date(a.replace(/-/g, '/')); }).slice(60).forEach(function (k) { delete prof.days[k]; });
    lsSet(PSTORE, prof); push('prof', prof);
  }
  function syncNote(text, ok) { var el = $('sync'); el.textContent = text; el.classList.toggle('ok', !!ok); }
  function push(which, data) {
    var ref = cloud[which]; if (!ref || !cloud.ready) return;
    var tk = which === 'game' ? 'gt' : 'pt';
    clearTimeout(cloud[tk]);
    cloud[tk] = setTimeout(function () {
      ref.set(JSON.parse(JSON.stringify(data))).then(function () { syncNote('Synced to your Claude account. Open it on any device to continue.', true); })
        .catch(function (e) { syncNote(e && e.code === 'quota_exceeded' ? 'Your saved data is full. This device still has it.' : 'Couldn’t sync just now. Saved on this device.', false); });
    }, 700);
  }
  function applySaved(saved) {
    if (!saved || !saved.sans) return false;
    var g2 = new Chess(); if (!saved.sans.every(function (m) { return !!g2.move(m); })) return false;
    G.reset(); saved.sans.forEach(function (m) { G.move(m); });
    st.user = saved.user || 'w'; st.level = saved.level || 2; st.ann = saved.ann || {}; st.notes = saved.notes || {}; st.tags = saved.tags || {};
    st.fb = saved.fb || null; st.opp = saved.opp || null; st.evalW = saved.evalW || 0; st.gf = !!saved.flipped; st.recorded = !!saved.recorded; st.unseen = !!saved.unseen && G.game_over(); st.fbPre = null; st.t = saved.t || 0; st.goal = saved.goal || null;
    st.sel = null; resetHints();
    $('levelSel').value = String(st.level);
    var last = G.history({ verbose: true }).slice(-1)[0];
    if (last && last.color !== st.user) st.arrows = [{ from: last.from, to: last.to, color: 'var(--c-blund)' }];
    return true;
  }
  function resumeGame() {
    if (st.mode !== 'play') return;
    if (G.game_over()) finishGame();
    else if (G.turn() !== st.user && G.history().length) engineTurn();
    else if (G.turn() === st.user && !st.think) analyseForUser().then(render);
    render();
  }
  function afterMerge(before) {
    if (prof.theme && prof.theme !== before.theme && Avatar.SETS[prof.theme] && prof.theme !== st.theme) { st.theme = prof.theme; lsSet('suresh-chess-coach.pieces', prof.theme); }
    if (prof.level && (prof.level !== before.level || prof.levelT !== before.levelT || prof.placed !== before.placed)) {
      if (Placement.isOpen() && !before.level) { Placement.close(); var a = document.activeElement; if (!a || a === document.body) focusTab(); }
      if (!before.level || before.provisional) showNote('Welcome back, I restored your level.', 'level');
    }
  }
  function pullCloud() {
    if (!cloud.game) return Promise.resolve();
    if (cloud.busy) return cloud.busy;
    clearTimeout(cloud.retry); cloud.retry = null;
    cloud.busy = Promise.all([cloud.game.get(), cloud.prof.get()]).then(function (r) {
      var c = null, pc = null, localT = st.t || 0, pushGame = false;
      try { c = r[0].exists ? r[0].data() : null; } catch (e) { c = null; }
      pc = r[1].exists ? r[1].data() : null; /* a profile that exists but can't be read must retry, never count as empty */
      /* a bad cloud game or a render error must never block the profile merge or later syncs */
      try {
        if (c && Array.isArray(c.sans) && (c.t || 0) > localT && !st.busy && !drag && st.mode === 'play') { if (applySaved(c)) { lsSet(STORE, c); st.think = null; resumeGame(); } }
        else if ((!c || !Array.isArray(c.sans) || localT > (c.t || 0)) && G.history().length) pushGame = true;
      } catch (e) { pushGame = G.history().length > 0; }
      var before = prof;
      if (pc) prof = Profile.merge(prof, pc); /* if this throws, nothing is pushed and the pull retries */
      try { afterMerge(before); } catch (e) {}
      prof.provisional = false; lsSet(PSTORE, prof);
      cloud.ready = true; cloud.tries = 0; lsSet(KSEEN, true);
      if (pushGame) push('game', snapshot());
      push('prof', prof);
      try { keepFocus(refreshUI); } catch (e) {}
      try { settleCloud('ready'); } catch (e) {}
      syncNote('Synced to your Claude account. Open it on any device to continue.', true);
    }).catch(function () {
      syncNote('Couldn’t reach your account. Saved on this device.', false);
      if (!cloud.ready) { var ms = RETRY[Math.min(cloud.tries++, RETRY.length - 1)]; cloud.retry = setTimeout(pullCloud, ms); }
    }).then(function () { cloud.busy = null; });
    return cloud.busy;
  }
  function initCloud() {
    /* The level-up offer at app start waits until the session's profile is settled: no cloud, or the first pull merged (sync safety). */
    if (!window.claude || !window.claude.use) { syncNote('Saved on this device only.', false); settleCloud('none'); return; }
    Promise.all([window.claude.use('db'), window.claude.use('user')]).then(function (r) {
      var db = r[0], user = r[1];
      if (!db || !user) { syncNote('Saved on this device only. Sign in to Claude to sync across devices.', false); settleCloud('none'); return null; }
      return user.id().then(function (uid) {
        if (!uid) { syncNote('Saved on this device only. Sign in to Claude to sync across devices.', false); settleCloud('none'); return; }
        cloud.game = db.doc('data/users/' + uid + '/chess'); cloud.prof = db.doc('data/users/' + uid + '/profile');
        return pullCloud();
      });
    }).catch(function () { syncNote('Saved on this device only.', false); if (!cloud.game) cloudState = 'failed'; }); /* D-1: a setup error fails closed */
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') { cloud.tries = 0; pullCloud(); } });
    window.addEventListener('online', function () { cloud.tries = 0; pullCloud(); });
  }

  /* ---------- input ---------- */
  var drag = null;
  function sqFromPoint(x, y) { var el = document.elementFromPoint(x, y); el = el && el.closest ? el.closest('.sq') : null; return el ? el.dataset.sq : null; }
  function canMove(from, to) { return viewGame().moves({ square: from, verbose: true }).some(function (m) { return m.to === to; }); }
  function ownPiece(s) { var g = viewGame(), p = g.get(s); return p && p.color === g.turn(); }
  function press(s) {
    if (st.pv) { endPreview(); return false; }
    if (st.mode === 'squares') { tapSquare(s); return false; }
    namePiece(s);
    if (st.mode === 'reach') { tapReach(s); return false; }
    if (!interactive()) return false;
    if (st.sel && st.sel !== s && canMove(st.sel, s)) { st.nm = null; userMove(st.sel, s); return false; }
    if (ownPiece(s)) { st.sel = s; render(); return true; }
    st.sel = null; render(); return false;
  }
  gridEl.addEventListener('pointerdown', function (e) {
    var el = e.target.closest('.sq'); if (!el) return;
    var s = el.dataset.sq, started = press(s);
    if (started && st.sel === s) {
      var size = el.getBoundingClientRect().width, p = viewGame().get(s), pc = el.querySelector('.pc'), g = document.createElement('div');
      g.className = 'ghost'; var gt = Avatar.piece(st.theme, p.color, p.type, tagsOn()); g.innerHTML = gt ? '<span class="tokw" style="width:' + (size * 0.94) + 'px;height:' + (size * 0.94) + 'px">' + gt + '</span>' : '<span class="pc ' + p.color + '" style="font-size:' + (size * 0.83) + 'px">' + GLYPH[p.type] + VS + '</span>';
      g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; g.hidden = true; document.body.appendChild(g);
      drag = { from: s, ghost: g, pc: pc, x: e.clientX, y: e.clientY, moved: false };
      try { gridEl.setPointerCapture(e.pointerId); } catch (err) {}
    }
  });
  gridEl.addEventListener('pointermove', function (e) {
    if (!drag) return;
    if (!drag.moved && Math.abs(e.clientX - drag.x) + Math.abs(e.clientY - drag.y) > 6) { drag.moved = true; drag.ghost.hidden = false; drag.pc.classList.add('drag'); }
    drag.ghost.style.left = e.clientX + 'px'; drag.ghost.style.top = e.clientY + 'px';
  });
  function endDrag(e) {
    if (!drag) return;
    var d = drag; drag = null; d.ghost.remove(); d.pc.classList.remove('drag');
    if (!d.moved || !e) return;
    var to = sqFromPoint(e.clientX, e.clientY);
    if (to && to !== d.from && canMove(d.from, to)) userMove(d.from, to);
  }
  gridEl.addEventListener('pointerup', endDrag);
  gridEl.addEventListener('pointercancel', function () { endDrag(null); });
  gridEl.addEventListener('keydown', function (e) {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    var el = e.target.closest('.sq'); if (!el) return;
    e.preventDefault(); var s = el.dataset.sq; press(s); if (sqEls[s]) sqEls[s].focus();
  });
  document.addEventListener('keydown', function (e) {
    if (/input|select|textarea/i.test(e.target.tagName || '')) return;
    var ss = $('settingsSheet'); if ((ss && !ss.hidden) || Placement.isOpen()) return; /* arrow keys in a sheet must not move the lesson or review behind it */
    if (st.mode === 'review') { if (e.key === 'ArrowLeft') { navTo(st.rv.ply - 1); e.preventDefault(); } if (e.key === 'ArrowRight') { navTo(st.rv.ply + 1); e.preventDefault(); } }
    if (st.mode === 'lesson') { if (e.key === 'ArrowLeft') lessonNav(-1); if (e.key === 'ArrowRight') lessonNav(1); }
  });

  $('hintBtn').addEventListener('click', hint);
  $('undoBtn').addEventListener('click', takeBack);
  var pvTimer = null, pvTok = 0;
  function startPreview(b, sticky) {
    clearTimeout(pvTimer); pvTok++;
    var d = b.dataset, g = null;
    if (d.fen) { g = new Chess(); if (!g.load(d.fen)) g = null; }
    var nm = Avatar.label(st.theme, d.c, d.p);
    st.pv = { g: g, arrows: [{ from: d.from, to: d.to, color: '#3b82c4' }], hl: [d.to], sticky: sticky, src: b, label: (plain() ? d.lab || b.getAttribute('aria-label') : b.title.split(':')[0] + (nm ? ' (' + nm + ')' : '')) + (g ? ', from the position it was played in' : '') + (sticky ? ' \u00B7 tap the board to go back' : '') };
    render();
    if (sticky) pvTimer = setTimeout(endPreview, 7000);
  }
  function endPreview() { clearTimeout(pvTimer); pvTok++; if (tipSticky && tipFor && tipFor.classList.contains('mvc')) hideTip(); if (!st.pv) return; st.pv = null; render(); }
  function playLine(fen, ucis) {
    clearTimeout(pvTimer); var tok = ++pvTok, g = new Chess(); if (!g.load(fen)) return;
    var list = ucis.split(' ').filter(Boolean), i = 0;
    function arrowNext() { var nx = i < list.length ? findMove(g, list[i]) : null; st.pv.arrows = nx ? [{ from: nx.from, to: nx.to, color: '#3b82c4' }] : []; }
    st.pv = { g: g, arrows: [], hl: [], sticky: true, label: 'Watching the line \u00B7 tap the board to stop' }; arrowNext(); render();
    function stepOnce() {
      if (!st.pv || tok !== pvTok) return;
      if (i >= list.length) { st.pv.arrows = []; st.pv.label = 'End of the line \u00B7 tap the board to go back'; render(); pvTimer = setTimeout(endPreview, 9000); return; }
      var m = findMove(g, list[i++]); if (!m) { i = list.length; stepOnce(); return; }
      g.move(m); st.pv.arrows = []; render();
      pvTimer = setTimeout(function () { if (!st.pv || tok !== pvTok) return; arrowNext(); render(); pvTimer = setTimeout(stepOnce, 700); }, 650);
    }
    pvTimer = setTimeout(stepOnce, 1000);
  }
  function decorateChips(all) {
    var els = document.querySelectorAll(all ? '.mvc' : '.mvc:not([data-dc])');
    for (var i = 0; i < els.length; i++) {
      var b = els[i], d = b.dataset, ic = b.querySelector('.mvi'); if (!ic) continue;
      var tk = Avatar.piece(st.theme, d.c, d.p);
      ic.innerHTML = tk || '<span class="mvg ' + d.c + '">' + GLYPH[d.p] + VS + '</span>'; d.dc = st.theme;
      /* D32: a Beginner's chip names the move in words only; Show everything brings the notation back */
      var lab = d.lab || (d.lab = (b.getAttribute('aria-label') || '').replace(/ \([^)]*\)$/, ''));
      if (lab && d.san) { var pl = plain(); b.title = (pl ? '' : d.san + ': ') + lab + '. Tap to see it on the board.'; b.setAttribute('aria-label', pl ? lab : lab + ' (' + d.san + ')'); }
    }
  }
  if (window.MutationObserver) new MutationObserver(function () { if (document.querySelector('.mvc:not([data-dc])')) decorateChips(false); }).observe(document.body, { childList: true, subtree: true });
  document.addEventListener('pointerover', function (e) { var a = e.target.closest && e.target.closest('.san, .mvc'); if (a && e.pointerType === 'mouse' && !tipSticky && tipFor !== a) showTip(a, false); });
  document.addEventListener('pointerout', function (e) { var a = e.target.closest && e.target.closest('.san, .mvc'); if (a && e.pointerType === 'mouse' && !tipSticky && !(e.relatedTarget && a.contains(e.relatedTarget))) hideTip(); });
  /* focus coming back to the move (for example when Settings closes) keeps its sticky tip sticky */
  document.addEventListener('focusin', function (e) { var a = e.target.closest && e.target.closest('.san, .mvc'); if (a && e.target.matches(':focus-visible') && !(tipSticky && tipFor === a)) showTip(a, false); });
  document.addEventListener('focusout', function (e) { if (!tipSticky) hideTip(); });
  document.addEventListener('pointermove', function (e) { if (!tipFor || tipSticky || e.pointerType !== 'mouse') return; if (!tipFor.isConnected || !(e.target.closest && e.target.closest('.san, .mvc, .santip'))) hideTip(); });
  document.addEventListener('pointerdown', function (e) { if (tipFor && !(e.target.closest && e.target.closest('.san, .mvc, .santip'))) hideTip(); }, true);
  /* Esc already handled by a sheet on top (Settings, level check) leaves a sticky tip or preview behind it alone. */
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !e.defaultPrevented) { hideTip(); if (st.pv) endPreview(); } });
  window.addEventListener('scroll', function () { if (!tipSticky) hideTip(); }, true);
  document.addEventListener('pointerover', function (e) { var b = e.target.closest && e.target.closest('.mvc'); if (b && e.pointerType === 'mouse' && !(st.pv && st.pv.sticky)) startPreview(b, false); });
  document.addEventListener('pointermove', function (e) { if (st.pv && !st.pv.sticky && e.pointerType === 'mouse' && !(e.target.closest && e.target.closest('.mvc'))) endPreview(); });
  document.addEventListener('pointerout', function (e) { var b = e.target.closest && e.target.closest('.mvc'); if (b && e.pointerType === 'mouse' && st.pv && !st.pv.sticky && !(e.relatedTarget && b.contains(e.relatedTarget))) endPreview(); });
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.mvc, .mvplay');
    if (b && b.classList.contains('mvplay')) { e.stopPropagation(); playLine(b.dataset.fen, b.dataset.pv); return; }
    if (b) { e.stopPropagation(); if (st.pv && st.pv.sticky && st.pv.src === b) { endPreview(); hideTip(); } else { startPreview(b, true); showTip(b, true); } return; }
    var sn = e.target.closest && e.target.closest('.san');
    if (sn) { var inMoves = sn.closest('#moves'); if (!inMoves) e.stopPropagation(); if (tipSticky && tipFor === sn) hideTip(); else showTip(sn, true); if (!inMoves) return; }
    if (tipFor && !(e.target.closest && e.target.closest('.santip'))) hideTip();
    if (st.pv && !(e.target.closest && e.target.closest('#board'))) endPreview();
  }, true);
  $('v3dBtn').addEventListener('click', function () { set3d(!st.v3d); });
  $('flipBtn').addEventListener('click', function () { st.flipped = !st.flipped; render(); if (st.mode === 'play') save(); });
  $('newBtn').addEventListener('click', function () { newGame(false); });
  $('reviewBtn').addEventListener('click', function () { if (G.history().length) enterReview(null); });
  $('modeExit').addEventListener('click', function () { if (st.mode === 'play') switchTab('train'); else exitMode(st.mode !== 'review' || !st.rv.past); });
  $('navFirst').addEventListener('click', function () { if (st.mode === 'review') navTo(0); });
  $('navPrev').addEventListener('click', function () { if (st.mode === 'review') navTo(st.rv.ply - 1); else if (st.mode === 'lesson') lessonNav(-1); });
  $('navNext').addEventListener('click', function () { if (st.mode === 'review') navTo(st.rv.ply + 1); else if (st.mode === 'lesson') lessonNav(1); });
  $('navLast').addEventListener('click', function () { if (st.mode === 'review') navTo(st.rv.sans.length); });
  $('qSafe').addEventListener('click', function () { answerQuiz(false); });
  $('qBlunder').addEventListener('click', function () { answerQuiz(true); });
  $('moves').addEventListener('click', function (e) {
    var td = e.target.closest('td[data-ply]'); if (!td) return;
    if (st.mode !== 'review') enterReview(null);
    navTo(+td.dataset.ply);
  });
  document.querySelector('.tabs').addEventListener('click', function (e) {
    var b = e.target.closest('.tab'); if (!b) return;
    /* G2a (G-D8): on the board screen the tabs are only there under an end card; leaving by a tab drops what is over */
    if (actOpen()) { leaveEnd(false); st.scr = 'tabs'; switchTab(b.dataset.tab); render(); return; }
    switchTab(b.dataset.tab);
  });
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'settingsSheet') { closeSettings(); return; }
    var t = e.target.closest('button'); if (!t || t.closest('.tabs')) return;
    var d = t.dataset;
    if (d.unit) { if (!phone() && st.mode !== 'play' && st.mode !== 'review') { stow('play'); clearSession(); st.mode = 'play'; resetHints(); } /* phones: looking at a lesson's page keeps what is waiting; only starting something ends it. Wide (G-D35): the lesson or set on the board waits */ st.end = null; st.unitOpen = d.unit; switchTab('path'); render(); return; }
    if (d.part) { st.unitOpen = d.u; startPart(d.u, d.part); return; }
    if (d.zgo) { switchTab(d.zgo); return; }
    if (d.coach) { Coach3D.set(d.coach); $('coachAv').dataset.k = ''; $('coachStrip').dataset.k = ''; var sc = $('sessionCard'); if (sc) sc._h = ''; renderLook(); renderCoach(); render(); return; }
    if (d.act === 'units') { st.unitOpen = null; st.end = null; renderPath(); return; }
    if (d.act === 'keep') { if (st.goal) { st.goal.kept = true; save(); } render(); return; } /* F-D18 */
    /* F1: end card buttons */
    if (d.act === 'home') { exitMode('home'); if (!document.activeElement || document.activeElement === document.body) focusTab(); return; }
    if (d.act === 'epart') { goPart(d.u, d.k); return; }
    if (d.act === 'more') { trainStart('rated'); return; }
    if (d.act === 'daily') { dailyStart(); return; }
    if (d.act === 'rmyes' || d.act === 'rmno') { answerRemind(d.act === 'rmyes'); return; } /* D2: Rani's reminder offer */
    if (d.act === 'remind') { toggleRemind(); return; } /* D2: the Settings switch */
    if (d.act === 'rvnew') { st.mode = 'play'; st.rv = null; resetHints(); newGame(false); render(); return; }
    if (d.act === 'recgame') { newGame(false, { level: plain() ? Profile.LEVELS.beginner.opp : recLevel() }); return; }
    if (d.act === 'review') { enterReview(null); return; }
    if (d.act === 'again') { newGame(true); return; }
    if (d.act === 'next') { nextItem(); return; }
    if (d.act === 'retry') { retryPuzzle(); return; }
    if (d.act === 'close') { exitMode(true); return; }
    if (d.act === 'actclose') { closeAct(); return; }
    if (d.act === 'resume') { resumeAct(d.z); return; }
    if (d.again) { var s = st.ses; if (s && s.zone === 'train' && s.kind === 'drill' && UNIT[s.unit]) startDrill(s.unit, UNIT[s.unit].apply, 'train'); else if (s && s.unit && s.part) startPart(s.unit, s.part); else if (s && s.rated) trainStart('rated'); else if (s && s.kind === 'safety') trainStart('safety'); else if (s && s.opts && s.opts.theme) themeStart(s.opts.theme); else if (s && s.kind === 'book' && s.opts) startSession('book', s.opts); else exitMode(); return; }
    if (d.train) { trainStart(d.train); return; }
    if (d.theme) { themeStart(d.theme); return; }
    if (d.book) { var line = COURSE.BOOK.filter(function (b) { return b.id === d.book; })[0]; startSession('book', { title: 'Opening drill', count: 1, items: [line] }); return; }
    if (d.drill) { var u = UNIT[d.drill]; if (u) startDrill(u.id, u.apply, 'train'); return; }
    if (d.apply) { startPart(d.apply, 'apply'); return; }
    if (t.hasAttribute('data-review')) { var g = prof.games[+d.review]; if (g) enterReview(g); return; }
    if (d.lnav) { lessonNav(+d.lnav); return; }
    if (d.stage) { st.stageView = +d.stage; renderCoach(); var sc = $('stageCard'); if (sc && sc.scrollIntoView) sc.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (d.go === 'next') { goNext(); return; }
    if (d.set) { setTheme(d.set); return; }
    if (d.lvset) { chooseLevel(d.lvset); return; }
    if (d.act === 'recheck') { closeSettings(); openPlacement(true); return; }
    if (d.act === 'showall') { prof.showAll = !prof.showAll; saveProfile(); refreshUI(); renderLevelCard('[data-act="showall"]'); return; }
    if (d.act === 'tags') { prof.pieceTags = !tagsOn(); saveProfile(); render(); renderLook(); return; }
    if (d.act === 'settings') { openSettings(); return; }
    if (d.act === 'settingsclose') { closeSettings(); return; }
    if (d.act === 'privchoices') { adChoices(); return; }
    if (d.act === 'notedone') { hideNote(); return; }
    if (d.act === 'offeryes') { answerOffer(true); return; }
    if (d.act === 'offerno') { answerOffer(false); return; }
    if (d.act === 'bhask') { askFirst(d.u); return; }
    if (d.act === 'askback') { answerAsk(false); return; }
    if (d.act === 'askgo') { answerAsk(true); return; }
  });

  /* R6: after an end card's button hides or rebuilds its card, focus never falls to the page body: it goes to the selected tab
     (unless the action itself placed it, as Rani's question and a new card's heading do). */
  var endClick = false;
  document.addEventListener('click', function (e) { endClick = !!(e.target.closest && e.target.closest('.endcard button, #sessionCard .ec-btns button, #goalCard button')); }, true);
  document.addEventListener('click', function () {
    if (!endClick) return; endClick = false;
    var a = document.activeElement;
    if (!a || a === document.body || !a.isConnected || a.offsetParent === null) focusTab();
  });

  /* ---------- boot ---------- */
  function fillLevels() { $('levelSel').innerHTML = OPP.slice(1).map(function (o, i) { return '<option value="' + (i + 1) + '">' + o.name + (i + 1 === 8 ? ' (max)' : ' (~' + o.elo + ')') + '</option>'; }).join(''); }
  function enginePill(s) {
    var el = $('enginePill');
    el.classList.toggle('ok', s === 'ready');
    /* S2a: the state is a shape too (ring = loading, dot = ready, diamond = basic engine), never colour alone */
    el.dataset.state = s === 'ready' ? 'ready' : s === 'failed' ? 'failed' : 'loading';
    var txt = s === 'ready' ? 'Stockfish 19 ready' : s === 'failed' ? 'Basic engine' : 'Loading Stockfish…';
    el.querySelector('span').textContent = txt; el.title = s === 'failed' ? 'Basic engine (Stockfish could not load here)' : txt;
    el.setAttribute('aria-label', el.title);
  }
  function start(data) {
    fillLevels();
    var raw = lsGet(PSTORE), p = Profile.migrate(raw); if (p) prof = p;
    loadResume(); /* G-D19: a lesson, set or drill that was waiting when the app was closed or killed */
    document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'visible') dayTurn(); }); /* D1 fix 3c */
    armDay();
    /* G-D33: never chose pieces or a view: the classic pieces on the flat board. A saved choice is kept (Flow.firstLook). */
    var look = Flow.firstLook({ pieces: lsGet('suresh-chess-coach.pieces'), theme: prof.theme, v3d: lsGet(K3D) }, function (id) { return !!Avatar.SETS[id]; });
    st.theme = look.theme;
    if (raw && (+raw.v || 0) < Profile.V && prof.placed === 'derived') { lsSet(PSTORE, prof); showNote('You’re set as ' + Profile.LEVELS[prof.level].name + '. Change it any time in Settings.', 'level'); }
    applyLevel();
    Brain.onState(function (s) { enginePill(s); if (s === 'ready' && st.mode === 'play' && G.turn() === st.user && !G.game_over() && !st.busy) analyseForUser().then(render); });
    Brain.init('sf/stockfish.js'); enginePill(Brain.state());
    buildGrid();
    var saved = data && data.sans ? data : lsGet(STORE);
    if (!applySaved(saved)) { G.reset(); st.user = 'w'; st.level = recLevel(); $('levelSel').value = String(st.level); st.fb = { cls: 'info', sym: '♙', title: 'Ready when you are', text: 'Start with today’s plan on Home, or make a move to play.' }; }
    /* G-D25: on a phone the app always opens on Home (with the Resume game card when a game is unfinished), never on the board */
    var tab = lsGet('suresh-chess-coach.tab'); switchTab(Flow.startTab(tab, !phone(), function (t) { return !!$('panel-' + t); }));
    render(); resumeGame();
    if (look.v3d) set3d(true, true);
    if (Profile.needsCheck(prof)) openPlacement(false);
    booted = true;
    remindBoot(); /* D2: the reminder's tap and resume listeners, and the next 7 days of reminders (Android app only) */
    adBoot(); /* F3b: the one moment the ads start-up may begin (from day two, no activity open); on day one and on the web, nothing */
    initCloud();
  }
  /* ---------- G2c: the phone's back button (G-D38 to G-D40, board-screens.tech.md section 16). Flow.backStep decides, first
     match wins; this does it, each step with the same code as its Esc, its Close or its tab tap. Returns false only on Home
     with nothing open: the caller then puts the app in the background, as back did before. ---------- */
  function backPressed() {
    var sh = $('settingsSheet'), step = Flow.backStep({ settings: !!sh && !sh.hidden, check: Placement.isOpen(), note: !!noteCur, wide: !phone(), scr: st.scr, tab: st.tab });
    /* fix round 1: Close, Home and leaving drop a sticky move tip and a move preview, as the X or a tab tap does. A sheet or a
       note closes as its Esc does, which leaves a tip behind it alone (s2a). */
    if (step === 'close' || step === 'home' || step === 'leave') { hideTip(); if (st.pv) endPreview(); }
    switch (step) {
      case 'settings': closeSettings(); return true;
      case 'check': Placement.onEsc(); return true; /* where Esc does nothing the press is still used up: never leave from the level check */
      case 'note': escNote(); return true;
      case 'close': closeAct(); return true; /* phones only: a review opened mid-game goes back to the game (G-D27) */
      case 'home': switchTab('coach'); focusTab(); return true; /* as a tab tap; wide screens keep what is on the board (G-D39) */
      default: return false;
    }
  }
  /* The listener, only inside the Android app with the App plugin (@capacitor/app, pinned). In a browser or without the plugin
     nothing is added, so the web build is unchanged. With the plugin a listener must exist (without one the plugin swallows
     back). Every plugin call is guarded; a failure inside backPressed leaves the app, as back did before G2c. */
  (function () {
    var App = null, none = function () {};
    try { var C = window.Capacitor; if (C && typeof C.isNativePlatform === 'function' && C.isNativePlatform() && C.Plugins && C.Plugins.App) App = C.Plugins.App; } catch (e) {}
    if (!App) return;
    function leave() { try { var r = App.minimizeApp(); if (r && typeof r.catch === 'function') r.catch(none); } catch (e) {} }
    try {
      var r = App.addListener('backButton', function () { var used = false; try { used = backPressed(); } catch (e) {} if (!used) leave(); });
      if (r && typeof r.catch === 'function') r.catch(none);
    } catch (e) {}
  })();
  /* ---------- D2: the daily puzzle reminder and the Play rating ask (docs/specs/daily-puzzle.product.md; rules in remind.js) ----------
     Android app only: the plugins are reached only when Capacitor says it is the native Android app. On the web (and in an
     app without the plugin) nothing here does anything: no offer, no Settings row, no plugin call.
     The settings live on the device only (Remind.KEY), never in prof: notification permission belongs to one phone.
     Every plugin call is a promise whose failure is caught; nothing here ever throws into the UI. */
  var LN = null, IAR = null, rmNone = function () {};
  (function () {
    try {
      var C = window.Capacitor;
      if (!C || typeof C.isNativePlatform !== 'function' || !C.isNativePlatform() || typeof C.getPlatform !== 'function' || C.getPlatform() !== 'android' || !C.Plugins) return;
      LN = C.Plugins.LocalNotifications || null; IAR = C.Plugins.InAppReview || null;
    } catch (e) { LN = null; IAR = null; }
  })();
  /* a plugin call as a promise, whatever it does (returns a value, throws, or rejects) */
  function pcall(fn) { try { var r = fn(); return r && typeof r.then === 'function' ? r : Promise.resolve(r); } catch (e) { return Promise.reject(e); } }
  var rmMem = null, rmPermState = null, rmRefused = false, rmChan = null, rmBusy = null, rmAgain = false;
  function rmGet() {
    if (!rmMem) { var raw = null; try { raw = localStorage.getItem(Remind.KEY); } catch (e) {} rmMem = Remind.read(raw); }
    return { on: rmMem.on, hour: rmMem.hour, offered: rmMem.offered, rateT: rmMem.rateT };
  }
  function rmSet(o) { rmMem = Remind.read(JSON.stringify(o)); try { localStorage.setItem(Remind.KEY, JSON.stringify(rmMem)); } catch (e) {} }
  /* Notification permission: resolves true when granted. ask: request it when it is not (Android shows its own question). */
  function rmPermit(ask) {
    if (!LN) return Promise.resolve(false);
    return pcall(function () { return LN.checkPermissions(); }).then(function (p) {
      rmPermState = (p && p.display) || null;
      if (rmPermState === 'granted' || !ask) return rmPermState === 'granted';
      return pcall(function () { return LN.requestPermissions(); }).then(function (q) { rmPermState = (q && q.display) || rmPermState; return rmPermState === 'granted'; });
    }).catch(function () { return false; });
  }
  /* AC6, DP-D7: one run at a time; a call during a run runs once more after it, with the newest settings and day */
  function remindSync() {
    if (!LN) return Promise.resolve();
    if (rmBusy) { rmAgain = true; return rmBusy; }
    rmBusy = rmRun().catch(rmNone).then(function () { rmBusy = null; if (rmAgain) { rmAgain = false; return remindSync(); } });
    return rmBusy;
  }
  function rmRun() {
    return rmPermit(false).then(function (ok) {
      renderRemind();
      return rmCancelAll().then(function () {
        var s = rmGet(); if (!s.on || !ok || !dailyOffered()) return; /* AC7: off cancels all, and nothing is set; DP-D19: nor before the card is offered */
        return rmChannel().then(function () {
          var list = Remind.plan(new Date(), s.hour, Daily.state(prof.daily, dayKey()) !== 'todo'); /* today skipped once it is done */
          if (!list.length) return;
          return pcall(function () { return LN.schedule({ notifications: Remind.notifications(list) }); });
        });
      });
    });
  }
  /* every reminder still pending is this app's own: all go before the new week is set */
  function rmCancelAll() {
    return pcall(function () { return LN.getPending(); }).then(function (r) {
      var ids = ((r && r.notifications) || []).map(function (n) { return { id: n.id }; });
      if (ids.length) return pcall(function () { return LN.cancel({ notifications: ids }); });
    }).catch(rmNone);
  }
  /* Fix 2: reminders already on the phone's screen for these days (day keys) go too */
  function remindDelivered(keys) {
    if (!LN) return;
    var ids = []; keys.forEach(function (k) { var i = Remind.keyId(k); if (i && ids.indexOf(i) < 0) ids.push(i); });
    if (!ids.length) return;
    pcall(function () { return LN.removeDeliveredNotifications({ notifications: ids.map(function (i) { return { id: i, title: Remind.TITLE, body: Remind.BODY }; }) }); }).catch(rmNone);
  }
  function rmChannel() {
    if (!rmChan) rmChan = pcall(function () { return LN.createChannel(Remind.CHANNEL); }).catch(function () { rmChan = null; });
    return rmChan;
  }
  /* AC5, DP-D3: Rani's offer on the daily puzzle's end card, from the first finished one, once per phone */
  var rmOfferOn = null; /* fix 4: the end card (its set) the offer is on; it stays there until answered or the card goes */
  function remindOfferHtml() {
    var s = st.ses;
    if (!LN || !s) return '';
    if (rmOfferOn !== s) {
      if (!Remind.offerShows(true, rmGet().offered, prof.daily && prof.daily.n) || !dailyOffered()) return '';
      rmOfferOn = s; var o = rmGet(); o.offered = true; rmSet(o); /* AC5: shown once counts, answered or not */
    }
    return '<div class="rm-offer" role="group" aria-labelledby="rmOfferQ"><p id="rmOfferQ">' + esc(Remind.OFFER.line) + '</p><div class="rm-btns">' +
      '<button class="btn" type="button" data-act="rmyes">' + esc(Remind.OFFER.yes) + '</button><button class="btn" type="button" data-act="rmno">' + esc(Remind.OFFER.no) + '</button></div></div>';
  }
  /* Either answer ends the offer for good on this phone. Yes asks Android for permission; denied leaves the reminder off. */
  function answerRemind(yes) {
    if (!LN) return;
    var s = rmGet(); s.offered = true; rmSet(s); rmOfferOn = null;
    render();
    var m = document.querySelector('#sessionCard .ec-main'); if (m && m.offsetParent !== null) try { m.focus({ preventScroll: true }); } catch (e) {}
    if (yes) remindOn();
  }
  function remindOn() {
    return rmPermit(true).then(function (ok) {
      var s = rmGet();
      if (ok) { s.on = true; rmSet(s); rmRefused = false; } else rmRefused = true; /* AC7: denied leaves the switch off, with the line */
      renderRemind();
      return remindSync();
    }).catch(rmNone);
  }
  /* AC7: the Settings switch. On asks for permission when needed; off cancels every reminder. */
  function toggleRemind() {
    if (!LN) return;
    var s = rmGet();
    if (!s.on) { remindOn(); return; }
    s.on = false; rmSet(s); rmRefused = false; renderRemind(); remindSync();
  }
  function remindHour(v) {
    var h = +v; if (!LN || Remind.HOURS.indexOf(h) < 0) return;
    var s = rmGet(); if (s.hour === h) return;
    s.hour = h; rmSet(s); renderRemind(); remindSync();
  }
  /* Settings refreshes what Android says about permission each time it opens (the player may have changed it there) */
  function remindPerm() { if (LN) rmPermit(false).then(renderRemind); }
  /* The Settings row: the switch, the time (DP-D13: 17 hours, "7 pm") and, when Android blocks notifications, the line */
  function renderRemind() {
    var box = $('remindSet'); if (!box) return;
    if (!LN || !dailyOffered()) { box.hidden = true; return; } /* DP-D19: no row before the Daily puzzle card is offered */
    if (!box._built) {
      box._built = true;
      box.setAttribute('aria-labelledby', 'remindTitle'); /* fix 7: named like the other Settings sections */
      box.innerHTML = '<button class="switchrow" type="button" role="switch" aria-checked="false" data-act="remind" id="remindSw"><span><b id="remindTitle">' + esc(Remind.SETTING) + '</b></span><i class="sw" aria-hidden="true"></i></button>' +
        '<div class="rm-time"><label for="remindHour">Time</label><select id="remindHour">' + Remind.HOURS.map(function (h) { return '<option value="' + h + '">' + esc(Remind.label(h)) + '</option>'; }).join('') + '</select></div>' +
        '<p class="rm-off" id="remindOff" role="status" hidden>' + esc(Remind.DENIED) + '</p>';
      $('remindHour').addEventListener('change', function (e) { remindHour(e.target.value); });
    }
    var s = rmGet(), sel = $('remindHour'), off = $('remindOff');
    $('remindSw').setAttribute('aria-checked', String(s.on));
    if (sel.value !== String(s.hour)) sel.value = String(s.hour);
    sel.disabled = !s.on; /* fix 7: the time only matters while the reminder is on */
    off.hidden = !(rmRefused || rmPermState === 'denied' || (s.on && rmPermState && rmPermState !== 'granted'));
    box.hidden = false;
  }
  /* AC8, DP-D8: a tapped reminder opens today's daily puzzle while the card offers "Solve it"; otherwise Home */
  function dailyOffered() { return !!prof.level && tabOpen('train') && (!plain() || Daily.shows(true, homeState().kind)); }
  function remindTap() {
    try {
      closeSettings(true);
      if (Placement.isOpen()) return;
      var r = prof.level ? dailyRec() : null;
      if (r && r.id && dailyOffered() && Remind.tapTo(Daily.state(r, dayKey())) === 'daily') { dailyStart(); return; }
      if (phone() && actOpen()) closeAct();
      switchTab('coach'); render(); focusTab();
    } catch (e) {}
  }
  /* Start-up: the tap listener first (a tap that launched the app is handed over when it is added), then App's resume, then
     the next 7 days. */
  function remindBoot() {
    renderRemind();
    if (!LN) return;
    try { var r = LN.addListener('localNotificationActionPerformed', function () { remindTap(); }); if (r && typeof r.catch === 'function') r.catch(rmNone); } catch (e) {}
    try {
      var C = window.Capacitor, App = C && C.Plugins && C.Plugins.App;
      if (App) { var q = App.addListener('resume', function () { remindSync(); }); if (q && typeof q.catch === 'function') q.catch(rmNone); }
    } catch (e) {}
    remindSync();
  }
  /* AC9, DP-D4: Google's rating sheet, right after a happy moment's end card (a won game, a newly finished lesson part, a
     solved daily puzzle), from the 3rd active day, at most once every 60 days. Never with an activity in progress, never
     under a sheet, a question from Rani or the reminder offer. Never a question of our own first: Google decides whether
     its sheet shows. rateT is written before the call, so a failure never asks again the same day. */
  var rateHappy = false, rateTimer = null;
  function rateReset() { rateHappy = false; clearTimeout(rateTimer); rateTimer = null; }
  /* Fix 3: the end card itself must be a happy one: never a lost game, a failed set or drill, or a missed daily puzzle */
  function cardHappy(el) {
    if (el.id === 'gameEnd') { var r = result(G, st.user); return !!r && r.r !== 'L'; }
    if (el.id === 'sessionCard') {
      var s = st.ses; if (!s) return false;
      if (s.end) return !!s.end.passed;
      if (!s.finished) return false;
      return isDaily(s) ? s.right > 0 : s.pass == null || s.right >= s.pass;
    }
    return el.id === 'learnEnd' || el.id === 'reviewEnd'; /* a review end card counts only when it finished a lesson part (the flag) */
  }
  function rateSoon(el) {
    if (!rateHappy) return;
    var happy = cardHappy(el);
    rateReset();
    if (!IAR || !happy) return;
    rateTimer = setTimeout(function () { rateTimer = null; rateNow(el); }, 600); /* once the card has settled on screen; any new activity clears it */
  }
  /* A lesson, a review not yet at its end card or a set in progress, or a game on the board that is not over. A game that waits while a set's end card
     shows (G2b) is not in play. */
  function rateBusy() { return st.mode === 'lesson' || (st.mode === 'review' && !reviewDone()) || !!(st.ses && !st.ses.finished && !st.ses.end) || (st.mode === 'play' && !st.ses && gameOn()); }
  function rateNow(el) {
    if (!IAR || !el || !el.isConnected || el.hidden || !el.getClientRects().length) return;
    var sh = $('settingsSheet');
    if (rateBusy() || Placement.isOpen() || (sh && !sh.hidden) || (noteCur && noteCur.kind !== 'info') || document.querySelector('#sessionCard .rm-offer')) return;
    var s = rmGet(), now = Date.now();
    if (!Remind.shouldAsk(Remind.activeDays(prof.days), s.rateT, now)) return;
    s.rateT = now; rmSet(s);
    pcall(function () { return IAR.requestReview(); }).catch(rmNone);
  }
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) { try { window.claude.hot.snapshot(snapshot); } catch (e) {} }
  window.claude && window.claude.hot && window.claude.hot.ready ? window.claude.hot.ready(start) : start((window.claude && window.claude.hot && window.claude.hot.data) || {});
  window.__coach = { st: st, getProf: function () { return prof; }, PZ: PZ, startPart: startPart, trainStart: trainStart, openPlacement: openPlacement, nextUnit: nextUnit, hist: function () { return G.history(); }, openSettings: openSettings,
    ads: function () { return { state: ad.state, banner: ad.banner, h: ad.h, loaded: ad.loaded }; }, /* the ads glue's state (e2e) */
    note: function (t) { showNote(t); }, /* one of Rani's notes, as the app shows them (e2e) */
    reveals: function () { return revealN; },
    closeAct: closeAct, /* G2a: what the Close button does */ backPressed: backPressed, /* G2c: what the phone's back button does (true: used) */ /* how often an end card was scrolled into view (e2e) */
    nextLabel: function () { return nextAction(currentStage()).label; } /* today's Next step, for the e2e check that the Continue card follows it */ };
})();
