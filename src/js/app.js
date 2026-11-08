/* ---------- Suresh's Chess Coach v4: course + coach ---------- */
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
    theme: 'classic', mode: 'play', tab: 'path', user: 'w', level: 2, flipped: false,
    ann: {}, notes: {}, tags: {}, sel: null, arrows: [], hls: [], hintLvl: 0,
    busy: false, evalW: 0, fb: null, opp: null, think: null, over: false, bannerOff: false,
    recorded: false, t: 0, goal: null, rv: null, pz: null, ses: null, ls: null, dr: null, bk: null, sq: null, qz: null, unitOpen: null, confirmNew: false
  };
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
    ['yours and the engine’s.', 'yours and Rani’s partner’s.'],
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
    if (tipFor && !tipFor.isConnected) hideTip();
    if (st.builtFor !== orientWhite()) buildGrid();
    var g = viewGame(), hist = g.history({ verbose: true }), last = hist[hist.length - 1], targets = {}, checkSq = null;
    if (st.sel && interactive()) g.moves({ square: st.sel, verbose: true }).forEach(function (m) { targets[m.to] = m.captured ? 'cap' : 'q'; });
    if (g.in_check()) piecesOf(g, g.turn()).forEach(function (p) { if (p.type === 'k') checkSq = p.sq; });
    $('board').classList.toggle('nocoord', st.mode === 'squares');
    Object.keys(sqEls).forEach(function (s) {
      var el = sqEls[s], p = g.get(s), pc = el.querySelector('.pc');
      var tok = p && st.mode !== 'squares' ? Avatar.piece(st.theme, p.color, p.type) : null, pk = p ? (tok ? 't' : 'g') + p.color + p.type + st.theme : '';
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
    renderStrip();
    if (st.v3d && window.Board3D) sync3d(g, last, targets, checkSq);
    renderArrows(); renderEval(); renderCaps(g); renderMode(); renderPlayPanel(); renderMoves(); renderBanner(); renderSession(); releaseOffer();
    var u = viewUser(), pl = plain();
    $('oppLevel').textContent = pl ? '' : st.mode === 'play' ? OPP[st.level].name + ' · ' + (st.level === 8 ? 'max' : '~' + OPP[st.level].elo) : st.mode === 'review' && OPP[st.rv.level] ? OPP[st.rv.level].name : '';
    $('oppName').textContent = pl && (st.mode === 'play' || st.mode === 'review' || st.mode === 'drill') ? partnerName() : { play: 'Engine', review: 'Engine', puzzle: 'Puzzle', lesson: 'Lesson', drill: 'Stockfish', book: 'Opening book', squares: 'Board drill', quiz: 'Safe or blunder?', reach: 'Piece drill', placement: 'Level check' }[st.mode] || '';
    $('youSwatch').style.background = u === 'w' ? '#FBF8F1' : '#1E1915';
    $('oppSwatch').style.background = u === 'w' ? '#1E1915' : '#FBF8F1';
    $('thinking').hidden = !st.busy;
    var hint = $('hintBtn'), canHint = st.mode === 'play' || st.mode === 'puzzle' || st.mode === 'drill' || st.mode === 'book';
    hint.hidden = !canHint; hint.disabled = !interactive();
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
  /* ---------- 3D view ---------- */
  var b3host = null, K3D = 'suresh-chess-coach.view3d';
  function sync3d(g, last, targets, checkSq) {
    var pos = [], ok = [];
    if (st.mode !== 'squares') for (var f = 0; f < 8; f++) for (var r = 1; r <= 8; r++) { var s = FILES[f] + r, p = g.get(s); if (p) pos.push({ sq: s, color: p.color, type: p.type }); }
    if (st.flash && st.flash.ok) ok.push(st.flash.sq);
    if (st.mode === 'reach' && st.rc) ok = ok.concat(st.rc.found);
    Board3D.sync({ pos: pos, theme: st.theme, white: orientWhite(), last: last ? { from: last.from, to: last.to } : null, sel: st.pv ? null : st.sel, targets: targets, check: checkSq, hls: st.pv ? st.pv.hl : st.hls, arrows: st.pv ? st.pv.arrows : st.arrows, ok: ok, bad: st.mode === 'reach' && st.rc ? st.rc.bad : null, coords: st.mode !== 'squares' });
  }
  function set3d(v, quiet) {
    st.v3d = v; if (!quiet) lsSet(K3D, v);
    var btn = $('v3dBtn'); btn.setAttribute('aria-pressed', String(v)); btn.textContent = v ? '2D view' : '3D view';
    $('board').classList.toggle('is3d', v);
    if (!v) { Board3D.disable(); if (b3host) b3host.hidden = true; render(); return; }
    if (!b3host) { b3host = document.createElement('div'); b3host.className = 'b3d'; $('board').insertBefore(b3host, $('banner')); }
    b3host.hidden = false; b3host.classList.add('loading');
    Board3D.enable(b3host, { onTap: function (s) { press(s); } }).then(function () { b3host.classList.remove('loading'); render(); })
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
    var z = zoneOf();
    $('board').setAttribute('data-zone', z); document.body.setAttribute('data-zone', z);
    ['path', 'train', 'play'].forEach(function (t) { $('tab-' + t).classList.toggle('live', ZTAB[z] === t); });
    ['path', 'train', 'play'].forEach(function (t) {
      var el = $('znote-' + t); if (!el) return;
      var pz = t === 'path' ? 'learn' : t;
      if (z === 'play' || pz === z) { el.hidden = true; return; }
      el.hidden = false; el.className = 'znote z-' + z;
      el.innerHTML = '<p><span class="ztag">' + ZNAME[z] + '</span> The board is on <b>' + esc(zoneLabel()) + '</b>.' + (t === 'play' ? ' Your game is paused and saved.' : '') + '</p><div class="row2">' +
        (t === 'play' ? '<button class="btn primary" type="button" data-act="close">\u25B6 Back to my game</button><button class="btn" type="button" data-zgo="' + ZTAB[z] + '">Continue ' + ZNAME[z] + '</button>'
          : '<button class="btn primary" type="button" data-zgo="' + ZTAB[z] + '">Continue ' + ZNAME[z] + '</button><button class="btn" type="button" data-act="close">Stop, back to my game</button>') + '</div>';
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
    $('modeExit').textContent = st.mode === 'review' ? (st.rv.past ? 'Close review' : 'Back to my game') : 'Back to my game'; $('modeExit').dataset.zone = z;
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
      if (!rv.ply) { setVerdict({ cls: 'info', sym: '♙', title: 'Start of the game', eyebrow: 'Review', text: 'Tap Next to step through. Every move is explained, yours and the engine’s.' + (pl ? '' : ' Tap a move in the list to jump there, or ask the coach for a game summary.') }); setOpp(null); return; }
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
    c.innerHTML = '<p class="eyebrow">Course goal · ' + esc(UNIT[gl.unit] ? UNIT[gl.unit].title : '') + '</p><p>' + status + esc(gl.text) + '</p><div class="gstat">' + (gl.progress || '') + '</div>' +
      (gl.status !== 'active' ? '<div style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap"><button class="btn sm" type="button" data-unit="' + gl.unit + '">Back to the course</button>' + (gl.status === 'failed' ? '<button class="btn sm primary" type="button" data-apply="' + gl.unit + '">Try again</button>' : '') + '</div>' : '');
  }
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
  function renderBanner() {
    var b = $('banner');
    if (st.mode !== 'play') { b.hidden = true; return; }
    var r = result(G, st.user); st.over = !!r;
    if (!r || st.bannerOff) { b.hidden = true; return; }
    b.hidden = false; $('bannerTitle').textContent = speak(r.title); $('bannerText').textContent = speak(r.text);
    $('bannerBtns').innerHTML = '<button class="btn primary sm" type="button" data-act="review">Review this game</button><button class="btn sm" type="button" data-act="again">New game</button>';
  }

  /* ---------- game flow ---------- */
  function resetHints() { st.hintLvl = 0; st.hls = []; st.arrows = []; }
  function userMove(from, to) {
    if (!interactive()) return;
    if (st.mode === 'puzzle') return puzzleMove(from, to);
    if (st.mode === 'drill') return drillMove(from, to);
    if (st.mode === 'book') return bookMove(from, to);
    if (st.mode === 'placement') return placementMove(from, to);
    var fenBefore = G.fen(), mv = G.move({ from: from, to: to, promotion: 'q' });
    if (!mv) return;
    st.sel = null; resetHints(); st.busy = true; st.bannerOff = false; st.opp = null; st.think = null; st.confirmNew = false;
    var words = Words.say(mv, true);
    st.fb = { cls: 'info', sym: '♙', title: 'Checking your move…', mv: 'You played ' + mv.san, words: words };
    render();
    var ply = G.history().length - 1;
    gradeUserMove(fenBefore, mv, gameAt(G.history(), ply + 1), st.user).then(function (n) {
      st.notes[ply] = n; st.ann[ply] = n.cls; if (n.tag) st.tags[ply] = n.tag; st.evalW = n.ev;
      st.fb = { cls: n.cls, sym: CLS[n.cls].sym, title: CLS[n.cls].title, mv: 'You played ' + mv.san, words: words, text: n.text, tip: n.tip };
    }).catch(function () { st.fb = { cls: 'info', sym: '♙', title: 'Move played', mv: mv.san, words: words }; }).then(function () {
      checkGoal(); save();
      if (G.game_over()) { st.busy = false; finishGame(); render(); return; }
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
  function engineTurn() {
    st.busy = true; render();
    var fen = G.fen();
    engineChoose(fen).then(function (uci) {
      if (G.fen() !== fen) return;
      var m = uci && findMove(G, uci); if (!m) m = G.moves({ verbose: true })[0];
      if (!m) { st.busy = false; render(); return; }
      var gBefore = new Chess(fen);
      G.move({ from: m.from, to: m.to, promotion: m.promotion || 'q' });
      st.arrows = [{ from: m.from, to: m.to, color: 'var(--c-blund)' }];
      if (G.history().length === 1) st.fb = { cls: 'info', sym: '♙', title: 'Your move', mv: 'You play Black', noSan: true, text: 'Answer in the center and get a knight out.', tip: '<b>First 10 moves:</b> center pawns, knights and bishops out, then castle.' };
      render();
      if (G.game_over()) { finishGame(); st.busy = false; save(); render(); return; }
      return analyseForUser().then(function (res) {
        var why;
        try { why = explainEngineMove(gBefore, m, G, st.user, res.th); } catch (e) { why = [{ c: '', h: cap1(describe(m, 'its')) + '.' }]; }
        var ply = G.history().length - 1;
        st.notes[ply] = { side: 'e', why: why, ev: st.evalW };
        st.opp = { san: m.san, why: why };
        st.busy = false; save(); render();
      });
    }).catch(function () { st.busy = false; render(); });
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
    st.sel = null; resetHints(); st.bannerOff = false; st.recorded = false; st.opp = null;
    var prev = st.notes[n - 1]; st.evalW = prev && typeof prev.ev === 'number' ? prev.ev : 0;
    if (prev && prev.side === 'e') st.opp = { san: G.history()[n - 1], why: prev.why };
    if (st.goal && st.goal.status === 'failed' && st.goal.type !== 'win') st.goal.status = 'active';
    st.fb = { cls: 'info', sym: '♙', title: 'Taken back', text: 'Your move again. Check their threats first, then your checks and captures.' };
    st.think = null; render();
    analyseForUser().then(function () { save(); render(); });
  }
  function newGame(force, opts) {
    opts = opts || {};
    if (!force && st.mode === 'play' && G.history().length > 2 && !G.game_over() && !st.confirmNew) { st.confirmNew = true; $('newConfirm').hidden = false; switchTab('play'); return; }
    $('newConfirm').hidden = true; st.confirmNew = false;
    clearSession(); st.mode = 'play'; st.rv = null;
    var c = opts.color || $('colorSel').value; if (c === 'r') c = Math.random() < 0.5 ? 'w' : 'b';
    /* D19: a Beginner's "New game" always plays Rani's practice partner (the Beginner bot); lesson tasks pass their own level. */
    st.user = c; st.level = opts.level || (plain() ? Profile.LEVELS.beginner.opp : +$('levelSel').value); $('levelSel').value = String(st.level);
    st.goal = opts.goal || null;
    G.reset(); st.ann = {}; st.notes = {}; st.tags = {}; st.sel = null; resetHints(); st.evalW = 20; st.flipped = false; st.over = false; st.bannerOff = false; st.recorded = false; st.opp = null; st.think = null;
    st.fb = st.user === 'w'
      ? { cls: 'info', sym: '♙', title: 'Your move', mv: 'You play White', noSan: true, text: 'Grab the center. ' + mvcSan(START_FEN, 'e4') + ' or ' + mvcSan(START_FEN, 'd4') + ' are the classic first moves. Tap a piece to see where it can go.', tip: '<b>First 10 moves:</b> center pawns, knights and bishops out, then castle.' }
      : { cls: 'info', sym: '♙', title: 'Engine to move', mv: 'You play Black', noSan: true };
    checkGoal(); save(); switchTab('play'); render();
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
    st.busy = true; render();
    getBest.then(function (t) {
      st.busy = false;
      if (!t || !t.best) { render(); return; }
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
    var s = summarize(st.ann, st.tags, st.user, G.history());
    prof.games.unshift({ id: 'g' + Date.now(), d: Date.now(), r: r.r, user: st.user, level: st.level, acc: s.acc, counts: s.counts, tags: s.tags, sans: G.history(), ann: st.ann });
    prof.games = prof.games.slice(0, 30); dayRec().games++;
    st.think = null; saveProfile();
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
    clearSession();
    var past = !!src, sans = past ? src.sans : G.history(), notes = past ? {} : JSON.parse(JSON.stringify(st.notes));
    var ann = past ? JSON.parse(JSON.stringify(src.ann || {})) : JSON.parse(JSON.stringify(st.ann)), user = past ? src.user : st.user, s = summarize(ann, {}, user);
    st.mode = 'review'; st.sel = null; resetHints();
    st.rv = { id: past ? src.id : null, sans: sans, notes: notes, ann: ann, user: user, level: past ? src.level : st.level, past: past, ply: past ? 0 : sans.length, acc: s.acc, counts: s.counts, g: null };
    switchTab('play'); gotoPly(st.rv.ply);
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
  function clearSession() { st.ses = null; st.pz = null; st.qz = null; st.sq = null; st.dr = null; st.bk = null; st.ls = null; st.rc = null; st.flash = null; }
  function exitMode(toGame) {
    var from = st.mode, unit = st.ses && st.ses.unit;
    clearSession(); st.mode = 'play'; st.rv = null; st.sel = null; resetHints();
    var last = G.history({ verbose: true }).slice(-1)[0];
    if (last && last.color !== st.user) st.arrows = [{ from: last.from, to: last.to, color: 'var(--c-blund)' }];
    if (toGame) switchTab('play');
    else if (from === 'lesson' || unit) { st.unitOpen = unit || st.unitOpen; switchTab('path'); }
    else if (st.tab === 'train') renderTrain();
    render();
  }
  function renderSession() {
    var c = $('sessionCard'), s = st.ses;
    if (!s) { c.hidden = true; return; }
    c.hidden = false;
    var home = $('panel-' + ZTAB[zoneOf()]); if (home && c.parentNode !== home) home.insertBefore(c, home.firstChild);
    var shown = s.finished ? s.count : Math.min(s.i + 1, s.count), pct = Math.round(100 * (s.finished ? 1 : s.i / Math.max(1, s.count)));
    var head = '<p class="eyebrow">' + esc(s.title) + '</p><div class="meta"><span>' + (s.kind === 'drill' ? 'Endgame drill' : shown + ' of ' + s.count) + '</span><span>✓ ' + s.right + ' · ✗ ' + s.wrong + (s.rated && !plain() ? ' · rating ' + Math.round(prof.rating) : '') + '</span></div><div class="bar2"><i style="width:' + pct + '%"></i></div>';
    var msg = s.msg || {}, body = '';
    if (s.finished) {
      var passed = s.pass == null || s.right >= s.pass;
      body = '<div class="sesav">' + Avatar.coach(passed ? 'proud' : 'worried', 52) + '</div><h3>' + (passed ? 'Session complete' : 'Almost there') + '</h3><p>' + s.right + ' of ' + s.count + ' correct' + (s.pass != null ? (passed ? '. Passed! This step is done.' : '. You need ' + s.pass + ' to pass. Have another go.') : '.') + '</p>' +
        '<div class="row2">' + (s.unit ? '<button class="btn primary" type="button" data-unit="' + s.unit + '">Back to the course</button>' : '') + '<button class="btn" type="button" data-again="1">Go again</button><button class="btn" type="button" data-act="close">Close</button></div>';
    } else {
      var mt = (plain() && msg.titlePlain) || msg.title; /* D24: no notation in a Beginner's quiz title */
      body = '<div class="sesav">' + Avatar.coach(msgMood(msg), 52) + '</div>' + (mt ? '<h3>' + esc(speak(mt)) + '</h3>' : '') + (msg.mv && !plain() ? '<p class="mono">' + figs(esc(msg.mv)) + '</p>' : '') + (msg.text ? '<p>' + speak(msg.text) + '</p>' : '') + (msg.tip ? '<p class="tip" style="margin-top:10px">' + speak(msg.tip) + '</p>' : '') +
        (s.canNext ? '<div class="row2"><button class="btn primary" type="button" data-act="next">Next ›</button>' + (s.canRetry ? '<button class="btn" type="button" data-act="retry">Try again</button>' : '') + '</div>' : '') + (s.after || '');
    }
    if (c._h !== head + body) { c._h = head + body; c.innerHTML = head + body; }
  }
  function startSession(kind, opts) {
    clearSession(); st.rv = null; st.flipped = false;
    st.ses = { kind: kind, title: opts.title, count: opts.count || 10, pass: opts.pass, unit: opts.unit || null, part: opts.part || null, rated: !!opts.rated, i: 0, right: 0, wrong: 0, items: opts.items || [], opts: opts, msg: null };
    switchTab(opts.unit ? 'path' : 'train');
    nextItem(true);
  }
  function nextItem(first) {
    var s = st.ses; if (!s) return;
    if (!first) s.i++;
    resetHints(); st.sel = null; st.flash = null; s.canNext = false; s.canRetry = false; s.msg = null; s.after = null;
    if (s.i >= s.count) return finishSession();
    if (s.kind === 'puzzles') { var p = s.opts.pick ? s.opts.pick(s) : s.items[s.i]; if (!p) { s.count = s.i; return finishSession(); } s.items[s.i] = p; startPuzzle(p); }
    else if (s.kind === 'safety') { if (!s.items[s.i]) { s.count = s.i; return finishSession(); } startQuiz(s.items[s.i]); }
    else if (s.kind === 'squares') startSquare();
    else if (s.kind === 'reach') startReach();
    else if (s.kind === 'book') startBook(s.items[s.i]);
  }
  function finishSession() {
    var s = st.ses; s.finished = true;
    if (s.unit && s.part && (s.pass == null || s.right >= s.pass)) markUnit(s.unit, s.part);
    saveProfile(); render();
  }
  function markUnit(id, part) {
    var wasOpen = unlockedByLessons(), wasComplete = Profile.levelComplete(prof, UNITS, unitDone);
    var c = prof.course[id] || (prof.course[id] = {});
    if (!c[part]) { c[part] = Date.now(); dayRec().course++; }
    saveProfile();
    /* S2a: the unlock note shows on the real false-to-true flip only (Show everything never counts), once, for Beginners. */
    if (prof.level === 'beginner' && !wasOpen && unlockedByLessons()) showNote('New: Train and Progress. Practise with puzzles and see how you’re doing.', 'unlock');
    /* D21: the lesson part that completes the level brings the offer at once, whatever levelOfferT says. */
    if (!wasComplete && Profile.levelComplete(prof, UNITS, unitDone)) lessonOffer();
    applyTabs(); renderPath(); if (st.tab === 'coach') renderCoach();
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
      var r = prof.rating, band = 120, pool = [];
      while (!pool.length && band < 1600) { pool = PZ.filter(function (p) { return !p.hand && !used[p.id] && !(prof.puz[p.id] && prof.puz[p.id].ok) && Math.abs(p.rating - r) <= band; }); band += 120; }
      if (!pool.length) pool = PZ.filter(function (p) { return !used[p.id]; });
      return pool[Math.floor(Math.random() * pool.length)];
    };
  }
  function dueList() { var now = Date.now(); return PZ.filter(function (p) { var r = prof.puz[p.id]; return r && r.due && r.due <= now && r.box < 2 && r.n > r.ok - 1 && (r.n - r.ok) > 0; }); }
  function startPuzzle(p) {
    st.mode = 'puzzle';
    var g = new Chess(p.pre && p.last ? p.pre : p.fen), side = new Chess(p.fen).turn();
    st.pz = { p: p, g: g, side: side, step: 0, done: false, wait: !!(p.pre && p.last), counted: false };
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
      if (!P.counted) { P.counted = true; s.right++; recordPuzzle(P.p, true); }
      s.msg = { title: alt ? 'Solved (another way!)' : 'Solved!', text: puzzleLesson(P.p) };
      s.canNext = true; render(); return;
    }
    P.step++;
    var reply = P.p.sol[P.step]; P.wait = true;
    s.msg = { title: 'Good, keep going', text: 'Right idea. Now see what they do.' }; render();
    var go = reply === '*' ? Brain.play(P.g.fen(), { skill: 20, movetime: 300, fbDepth: 4 }) : Promise.resolve(reply);
    go.then(function (u) {
      return wait(450).then(function () {
        var m = u && findMove(P.g, u); if (m) { P.g.move(m); st.arrows = [{ from: m.from, to: m.to, color: 'var(--c-blund)' }]; }
        P.step++; P.wait = false;
        s.msg = { title: 'Your move again', mv: m ? 'They played ' + m.san : '', text: 'Finish it.' }; render();
      });
    });
  }
  function puzzleFail(mv, want) {
    var P = st.pz, s = st.ses;
    if (!P.counted) { P.counted = true; s.wrong++; recordPuzzle(P.p, false); }
    P.wait = true; render();
    setTimeout(function () {
      P.g.undo(); var wm = findMove(P.g, want);
      st.arrows = wm ? [{ from: wm.from, to: wm.to, color: 'var(--c-best)' }] : [];
      P.done = true; P.wait = false;
      s.msg = { title: 'Not quite', mv: 'You played ' + mv.san, text: (wm ? 'The winning move was ' + mvc(wm) + '. ' : '') + puzzleLesson(P.p), tip: 'This puzzle comes back in your review list tomorrow.' };
      s.canNext = true; s.canRetry = true; render();
    }, 600);
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
  function startQuiz(it) {
    st.mode = 'quiz';
    var g = new Chess(it.p.pre), mv = findMove(g, it.blunder ? it.p.last : it.p.preBest);
    st.qz = { it: it, g: g, side: g.turn(), mv: mv, answered: false };
    st.arrows = mv ? [{ from: mv.from, to: mv.to, color: 'var(--accent)' }] : [];
    st.ses.msg = { title: (g.turn() === 'w' ? 'White' : 'Black') + ' wants to play ' + (mv ? mv.san : '?'), titlePlain: (g.turn() === 'w' ? 'White' : 'Black') + ' wants to play this move.', text: 'Is it <b>safe</b>, or a <b>blunder</b>? Do your blunder check: what can the other side do after this move?' };
    render();
  }
  function answerQuiz(sayBlunder) {
    var q = st.qz, s = st.ses; if (!q || q.answered || !q.mv) return;
    q.answered = true;
    var right = sayBlunder === q.it.blunder; if (right) s.right++; else s.wrong++;
    var p = q.it.p, d = dayRec(); d.puz++; if (right) d.solved++;
    if (q.it.blunder) {
      var qf = q.g.fen(); q.g.move(q.mv); var ref = findMove(q.g, p.sol[0]);
      st.arrows = ref ? [{ from: ref.from, to: ref.to, color: 'var(--c-blund)' }] : [];
      s.msg = { title: right ? 'Correct, it’s a blunder' : 'It’s a blunder', mv: q.mv.san + '?  ' + (ref ? ref.san + '!' : ''), text: 'After ' + mvc(q.mv, qf) + ', the reply ' + mvc(ref) + ' wins. ' + puzzleLesson(p) };
    } else {
      s.msg = { title: right ? 'Correct, it’s safe' : 'Actually, it’s safe', mv: q.mv.san, text: 'This is Stockfish’s top choice here. Nothing hangs and there’s no trick against it.' };
    }
    s.canNext = true; saveProfile(); render();
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
    if (ok) s.right++; else s.wrong++;
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
      R.done = true; var ok = R.misses <= 1; if (ok) s.right++; else s.wrong++;
      s.msg = { title: ok ? 'All ' + R.targets.length + ' found!' : 'Found them, with ' + R.misses + ' wrong taps', text: R.misses > 1 ? 'Try to see the whole pattern before tapping. Next one:' : '' };
      render(); setTimeout(function () { if (st.ses === s) nextItem(); }, 1100); return;
    }
    s.msg = { title: left + ' more to find', text: R.misses ? R.misses + ' wrong tap' + (R.misses === 1 ? '' : 's') + ' so far.' : 'Keep going.' };
    render();
  }

  /* drills (endgames) */
  function startDrill(unitId, d) {
    clearSession(); st.rv = null; st.flipped = false;
    var g = new Chess(d.fen);
    st.mode = 'drill';
    st.dr = { g: g, side: g.turn(), goal: d.goal, limit: d.limit, moves: 0, done: false, unit: unitId, name: UNIT[unitId] ? UNIT[unitId].title : 'Endgame drill', ev: null };
    st.ses = { kind: 'drill', title: st.dr.name, count: 1, i: 0, right: 0, wrong: 0, items: [], unit: unitId, msg: { title: 'Your move', text: esc(d.text || '') + ' Stuck? Hint shows Stockfish’s idea.' } };
    switchTab(tabOpen('train') ? 'train' : 'path'); render();
  }
  function drillMove(from, to) {
    var D = st.dr, g = D.g, mv = g.move({ from: from, to: to, promotion: 'q' }); if (!mv) return;
    st.sel = null; resetHints(); D.moves++;
    if (drillCheck()) return;
    st.busy = true; render();
    Brain.play(g.fen(), { skill: 20, movetime: 350, fbDepth: 5 }).then(function (u) {
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
    s.after = '<div class="row2"><button class="btn primary" type="button" data-drill="' + D.unit + '">Try again</button><button class="btn" type="button" data-unit="' + D.unit + '">Back to the course</button></div>';
    render(); return true;
  }

  /* opening book */
  function startBook(line) {
    st.mode = 'book';
    st.bk = { line: line, g: new Chess(), side: line.side, ply: 0, mistakes: 0, done: false, wait: false };
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
      g.undo(); var w = g.move(want); g.undo(); B.wait = false;
      st.arrows = [{ from: w.from, to: w.to, color: 'var(--c-best)' }];
      s.msg = { title: 'Not the book move', mv: 'You played ' + mv.san, text: 'The repertoire move is ' + mvc(w) + ': it ' + describe(w, 'your') + '. Play it to continue.' };
      render();
    }, 500);
  }
  function bookHintData() { var B = st.bk, g = new Chess(B.g.fen()), m = g.move(B.line.moves[B.ply]); return m ? { best: { from: m.from, to: m.to, san: m.san, why: describe(m, 'your') }, theme: { idea: 'Think about the plan of this opening: ' + (B.side === 'w' ? 'center, develop, castle.' : 'match the center, develop, castle.') } } : null; }
  function bookDone() {
    var B = st.bk, s = st.ses; B.done = true;
    if (B.mistakes === 0) s.right++; else s.wrong++;
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
    clearSession(); st.rv = null; st.flipped = false;
    st.mode = 'lesson'; st.ls = { unit: UNIT[id], i: 0, g: null, side: 'w' };
    switchTab('path'); showLessonStep();
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
    if (d > 0 && L.i === L.unit.lesson.length - 1) { var id = L.unit.id; markUnit(id, 'learn'); clearSession(); st.mode = 'play'; resetHints(); st.unitOpen = id; render(); renderPath(); return; }
    L.i = Math.max(0, Math.min(L.unit.lesson.length - 1, L.i + d)); showLessonStep();
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
    var lv = $('levels'), uv = $('unitView');
    if (st.mode === 'lesson' && st.ls) {
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
        unitParts(u).map(function (k, i) { return '<div class="step3' + (c[k] ? ' done' : '') + '"><span class="n">' + (c[k] ? '✓' : i + 1) + '</span><div><b>' + PART_NAME[k] + '</b><small>' + esc(partDesc(u, k)) + '</small></div><button class="btn sm' + (!c[k] && nextPart(u) === k ? ' primary' : '') + '" type="button" data-part="' + k + '" data-u="' + u.id + '">' + (c[k] ? 'Redo' : 'Start') + '</button></div>'; }).join('') +
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
    var steps = [
      { z: 'learn', n: 1, h: 'Learn', done: !!d.course, t: nx ? nx.title : 'Course complete', s: nx ? PART_NAME[k] + ': ' + partDesc(nx, k) : 'Keep sharp with puzzles and games.', b: nx ? 'Start lesson' : 'Open course', act: nx ? 'data-part="' + k + '" data-u="' + nx.id + '"' : 'data-zgo="path"' },
      { z: 'train', n: 2, h: 'Train', done: d.puz >= 10, t: due ? 'Review ' + due + ' missed puzzle' + (due === 1 ? '' : 's') : pl ? '10 puzzles' : '10 rated puzzles', s: Math.min(d.puz, 10) + ' of 10 today.' + (pl ? '' : ' Puzzle rating ' + Math.round(prof.rating) + '.'), b: 'Start training', act: due ? 'data-train="review"' : 'data-train="rated"' },
      { z: 'play', n: 3, h: 'Play', done: d.games >= 1, t: 'One full game', s: 'Use what you learned against ' + (pl ? partnerName() + '.' : OPP[recLevel()].name + ' (~' + OPP[recLevel()].elo + ').'), b: G.history().length && !G.game_over() ? 'Back to my game' : 'Play a game', act: G.history().length && !G.game_over() ? 'data-act="close"' : 'data-act="recgame"' }
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
    var el = $('coachStrip'), t = '', x = '', mood = 'neutral', pl = plain();
    if (st.mode === 'play') {
      var f = st.fb || {}; t = f.title || ''; x = f.text || (pl ? f.words || (f.noSan ? f.mv : '') : f.mv) || '';
      mood = f.mood || (f.cls && f.cls !== 'info' ? Avatar.moodFor(f.cls) : /Hint/.test(t) ? 'think' : 'neutral');
      if (pl) {
        /* D17: a Beginner's strip says the partner's last move in plain words, first so it stays in view. */
        var pw = !st.busy ? partnerWords() : '', why = st.opp && st.opp.why.length ? st.opp.why[st.opp.why.length - 1].h : '';
        if (pw) x = pw + (why ? ' ' + why : '') + (x ? ' ' + x : '');
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
    else if (st.ses && st.ses.finished) { t = 'Session complete'; x = st.ses.right + ' of ' + st.ses.count + ' correct.'; mood = 'proud'; }
    else if (st.ses && st.ses.msg) { t = (pl && st.ses.msg.titlePlain) || st.ses.msg.title || ''; x = st.ses.msg.text || (pl ? '' : st.ses.msg.mv) || ''; mood = msgMood(st.ses.msg); }
    if (st.busy) mood = 'think';
    t = speak(t); x = speak(x);
    var key = mood + t + x + Coach3D.get();
    if (el.dataset.k === key) return; el.dataset.k = key;
    el.innerHTML = t || x ? Avatar.coach(mood, 46) + '<div class="bub"><b>' + esc(stripText(t)) + '</b><span>' + chipText(x) + '</span></div>' : '';
  }
  function setTheme(id) {
    if (!Avatar.SETS[id]) return;
    st.theme = id; lsSet('suresh-chess-coach.pieces', id); prof.theme = id; saveProfile(); decorateChips(true);
    render(); renderLook();
  }
  function renderLook() {
    var el = $('lookCard'); if (!el) return;
    var groups = [], by = {};
    Object.keys(Avatar.SETS).forEach(function (id) { var gname = Avatar.SETS[id].group || 'More'; if (!by[gname]) { by[gname] = []; groups.push(gname); } by[gname].push(id); });
    var ORDER = ['Classic', 'Indian epics', 'Indian history', 'Fables', 'World myths', 'Fantasy']; groups.sort(function (x, y) { var i = ORDER.indexOf(x), j = ORDER.indexOf(y); return (i < 0 ? 99 : i) - (j < 0 ? 99 : j); });
    var cc = Coach3D.get();
    el.innerHTML = '<p class="eyebrow">Choose your coach</p><div class="sets coachpick">' + [['rani', 'Queen Rani', '3D animated queen. Reacts to every move.'], ['gaja', 'Coach Gaja', 'Flat elephant drawing. Lighter on old phones.']].map(function (o) { return '<button class="setbtn' + (cc === o[0] ? ' on' : '') + '" type="button" data-coach="' + o[0] + '" aria-pressed="' + (cc === o[0]) + '"><b>' + o[1] + '</b><small>' + o[2] + '</small></button>'; }).join('') + '</div><p class="eyebrow" style="margin-top:14px">Choose your pieces</p>' + groups.map(function (gname) {
      return '<p class="setgrp">' + esc(gname) + '</p><div class="sets">' + by[gname].map(function (id) {
        var S = Avatar.SETS[id], pv = ['k', 'q', 'n'].map(function (t) { var tk = Avatar.piece(id, 'w', t); return '<span>' + (tk || GLYPH[t] + VS) + '</span>'; }).join('') + '<span>' + (Avatar.piece(id, 'b', 'k') || GLYPH.k + VS) + '</span>';
        return '<button class="setbtn' + (st.theme === id ? ' on' : '') + '" type="button" data-set="' + id + '" aria-pressed="' + (st.theme === id) + '"><div class="pv">' + pv + '</div><b>' + esc(S.name) + '</b><small>' + esc(S.note) + '</small></button>';
      }).join('') + '</div>';
    }).join('') + '<p class="setnote">Every piece keeps a chess symbol in its corner, so you always know what it is. Hover over a piece (or long-press on a phone) to see its character.</p>';
  }


  /* ---------- level: check, Settings controls, Rani's note ---------- */
  var KINSTALL = 'suresh-chess-coach.install', KCHECKS = 'suresh-chess-coach.checks', boardHome = null;
  function installId() { var id = lsGet(KINSTALL); if (!id) { id = Date.now().toString(36) + Math.random().toString(36).slice(2, 8); lsSet(KINSTALL, id); } return id; }
  /* CSS hides by level (eval strip, engine pill, Moves card, opponent picker); JS does the tabs and the numbers inside text. */
  function applyLevel() {
    var de = document.documentElement;
    if (prof.level) de.dataset.level = prof.level; else delete de.dataset.level;
    if (prof.showAll) de.dataset.showall = '1'; else delete de.dataset.showall;
    applyTabs();
  }
  /* S2a tab unlock: a Beginner sees Home, Learn and Play until 3 units from the start point are fully done (or Show everything). */
  function tabsLocked() { return prof.level === 'beginner' && !Profile.unlockDone(prof, UNITS, unitDone); }
  function tabOpen(t) { return !((t === 'train' || t === 'progress') && tabsLocked()); }
  function unlockedByLessons() { return Profile.unlockDone(Object.assign({}, prof, { showAll: false }), UNITS, unitDone); }
  function applyTabs() {
    var lock = tabsLocked();
    ['train', 'progress'].forEach(function (t) { $('tab-' + t).hidden = lock; });
    if (lock && !tabOpen(st.tab)) switchTab('coach');
  }
  /* A level, Show everything or merged profile change re-renders every visible screen at once (mid-game too). */
  function refreshUI() {
    applyLevel(); dropStaleOffers();
    render();
    if (st.tab === 'coach') renderCoach(); else if (st.tab === 'path') renderPath(); else if (st.tab === 'train') renderTrain(); else if (st.tab === 'progress') renderProgress();
  }
  /* A re-render after a cloud pull keeps the player's place: focus goes back to the same control, and the scroll stays. */
  function focusKey(a) {
    if (!a || a === document.body || !window.CSS || !CSS.escape) return null;
    if (a.id) return '#' + CSS.escape(a.id);
    var ks = Object.keys(a.dataset || {}).filter(function (k) { return k !== 'dc' && k !== 'k'; });
    return ks.length ? a.tagName.toLowerCase() + ks.map(function (k) { return '[data-' + k.replace(/[A-Z]/g, function (c) { return '-' + c.toLowerCase(); }) + '="' + CSS.escape(a.dataset[k]) + '"]'; }).join('') : null;
  }
  function keepFocus(fn) {
    var a = document.activeElement, key = focusKey(a), x = window.scrollX, y = window.scrollY;
    fn();
    if (key && !a.isConnected) { var b = document.querySelector(key); if (b && b.offsetParent !== null) try { b.focus({ preventScroll: true }); } catch (e) {} }
    if (window.scrollX !== x || window.scrollY !== y) window.scrollTo(x, y);
  }
  function focusTab() { var b = $('tab-' + st.tab); if (b && b.offsetParent !== null) try { b.focus({ preventScroll: true }); } catch (e) {} }
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
      if (st.mode !== 'placement') st.plPrev = { mode: st.mode, flipped: st.flipped, arrows: st.arrows, hls: st.hls, flash: st.flash };
      st.mode = 'placement'; st.flipped = false; st.sel = null; st.flash = null; resetHints();
      var g = new Chess(p.fen);
      st.pl = { p: p, g: g, side: g.turn(), done: false, cb: cb };
      render();
    },
    endBoard: function () {
      if (boardHome) { boardHome.parent.insertBefore(boardHome.el, boardHome.next && boardHome.next.parentNode === boardHome.parent ? boardHome.next : null); boardHome = null; }
      if (st.mode === 'placement') { var pv = st.plPrev || { mode: 'play' }; st.mode = pv.mode; st.flipped = !!pv.flipped; st.arrows = pv.arrows || []; st.hls = pv.hls || []; st.flash = pv.flash || null; }
      st.pl = null; st.plPrev = null; st.sel = null; render();
    },
    finish: function (r) {
      /* Sync safety: only the first-launch check on a device that never finished a cloud load is provisional. */
      prof = Profile.setLevel(prof, r.level, { start: r.start, placed: r.placed, provisional: !r.retake && !lsGet(KSEEN), units: UNITS });
      saveProfile(); refreshUI();
      if (r.skippedFirst) showNote('You’re starting as a Beginner. You can take the check again in Settings.', 'level');
      afterLevel(); focusTab(); /* never leave focus on the page body */
      startOfferCheck();
    },
    cancel: function () { var a = document.activeElement; if (!a || a === document.body) focusTab(); startOfferCheck(); }
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
    setOpener = document.activeElement; renderLevelCard();
    sh.hidden = false; document.documentElement.classList.add('sheet-open');
    var pn = sh.querySelector('.sheet-panel'); if (pn) pn.focus({ preventScroll: true });
  }
  function closeSettings(noFocus) {
    var sh = $('settingsSheet'); if (!sh || sh.hidden) return;
    sh.hidden = true; document.documentElement.classList.remove('sheet-open');
    var back = setOpener && setOpener.isConnected && setOpener.offsetParent !== null ? setOpener : $('settingsBtn');
    if (!noFocus && back) back.focus(); setOpener = null;
  }
  function trapTab(box, e) {
    var f = Array.prototype.filter.call(box.querySelectorAll('button:not([disabled]), [tabindex="0"], select, input'), function (x) { return x.offsetParent !== null; });
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
    if (!n) { el.hidden = true; el.innerHTML = ''; el.className = 'raninote'; return; }
    var offer = n.kind === 'offer';
    el.className = 'raninote' + (offer ? ' offer' : '');
    el.innerHTML = '<div class="rn-av">' + Avatar.coach(offer ? 'proud' : 'happy', 46) + '</div><p>' + esc(n.text) + '</p>' +
      (offer ? '<div class="rn-btns"><button class="btn sm primary" type="button" data-act="offeryes">Yes, move me up</button><button class="btn sm" type="button" data-act="offerno">Not yet</button></div>'
        : '<button class="btn sm" type="button" data-act="notedone">OK</button>');
    el.hidden = false;
  }
  function nextNote() {
    var el = $('raniNote'), had = !!(el && el.contains(document.activeElement));
    noteCur = noteQ.shift() || null; drawNote();
    if (had) { var b = noteCur && el.querySelector('button'); if (b) b.focus(); else focusTab(); }
  }
  function hideNote() { nextNote(); }

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
    if (st.tab === 'coach') return false;
    return st.mode === 'lesson' || st.mode === 'review' || !!(st.ses && !st.ses.finished) || (st.mode === 'play' && st.tab === 'play' && G.history().length > 0 && !G.game_over());
  }
  function releaseOffer() {
    if (!heldOffer.start && !heldOffer.lesson) return;
    if (Placement.isOpen() || inActivity()) return;
    var ok = (heldOffer.lesson && heldOffer.lesson === prof.level && Profile.levelComplete(prof, UNITS, unitDone)) || (heldOffer.start && Profile.offerDue(prof, Date.now(), UNITS, unitDone));
    heldOffer = { start: false, lesson: null };
    if (ok) offerLevelUp();
  }

  /* ---------- Coach home: the roadmap ---------- */
  var RM = COURSE.ROADMAP;
  function bestWinLevel() { var m = 0; prof.games.forEach(function (g) { if (g.r === 'W' && g.level > m) m = g.level; }); return m; }
  function stageMiles(S) {
    /* D20/D31: in the player's starting stage, lessons before their start point are skipped, not required */
    var from = RM.indexOf(S) === firstStage() ? startPos() : 0;
    var us = UNITS.filter(function (u, i) { return i >= from && u.level === S.level; }), done = us.filter(unitDone).length;
    var out = [
      { t: 'Finish the Level ' + S.level + ' course units', v: done + '/' + us.length, ok: done === us.length },
      { t: 'Puzzle rating ' + S.target + '+', v: Math.round(prof.rating) + '', ok: prof.rating >= S.target, rt: true },
      { t: plain() ? 'Beat Rani’s practice partner' : 'Beat the ' + OPP[S.beat].name + ' engine (~' + OPP[S.beat].elo + ')', v: bestWinLevel() >= S.beat ? 'done' : 'not yet', ok: bestWinLevel() >= S.beat }
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
    if (us.length) { var u = us[0], k = nextPart(u); return { label: PART_NAME[k] + ': ' + u.title, sub: partDesc(u, k), go: function () { st.unitOpen = u.id; startPart(u.id, k); } }; }
    var nx = nextUnit();
    if (!plain() && prof.rating < S.target) return { label: 'Rated puzzles to reach ' + S.target, sub: 'Your rating is ' + Math.round(prof.rating) + '. Ten puzzles a day moves it fastest.', go: function () { trainStart('rated'); } };
    if (bestWinLevel() < S.beat) return { label: plain() ? 'Beat Rani’s practice partner' : 'Beat the ' + OPP[S.beat].name + ' engine', sub: 'Play slowly, blunder-check every move, and review the game after.', go: function () { newGame(false, { level: S.beat }); } };
    if (nx) { var k2 = nextPart(nx); return { label: PART_NAME[k2] + ': ' + nx.title, sub: partDesc(nx, k2), go: function () { st.unitOpen = nx.id; startPart(nx.id, k2); } }; }
    return { label: 'Keep sharp: rated puzzles', sub: 'You’ve finished the roadmap. Keep playing stronger opponents.', go: function () { trainStart('rated'); } };
  }
  var _next = null;
  function goNext() { if (_next) _next.go(); }
  function renderCoach() {
    var S = currentStage(), miles = stageMiles(S), done = miles.filter(function (m) { return m.ok; }).length, pl = plain(), fs = RM[firstStage()].stage;
    _next = nextAction(S);
    $('stageHero').innerHTML = '<div class="herorow">' + Avatar.coach(done ? 'happy' : 'neutral', 64) + '<div><p class="eyebrow">' + esc(Avatar.coachName()) + ' \u00B7 Stage ' + S.stage + ' of 6</p><h3>' + esc(S.name) + '</h3></div></div><p>' + esc(S.why) + '</p>' +
      '<div class="mbar"><i style="width:' + Math.round(100 * done / miles.length) + '%"></i></div><div class="meta"><span>' + done + ' of ' + miles.length + ' milestones</span>' + (pl ? '' : '<span>Rating band ' + esc(S.band) + '</span>') + '</div>' +
      '<button class="btn" type="button" data-go="next">Next step: ' + esc(_next.label) + ' ›</button><p style="margin-top:8px;font-size:13px;opacity:.85">' + esc(_next.sub) + '</p>';
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
    if (kind === 'review') { var d = shuffle(dueList()).slice(0, 10); if (!d.length) return; return startSession('puzzles', { title: 'Review missed puzzles', count: d.length, items: d }); }
    if (kind === 'safety') { var it = safetyItems(10, prof.rating > 1300); return startSession('safety', { title: 'Safe or blunder?', count: it.length, items: it }); }
  }

  /* ---------- Progress tab ---------- */
  function renderProgress() {
    var gs = prof.games, w = gs.filter(function (g) { return g.r === 'W'; }).length, l = gs.filter(function (g) { return g.r === 'L'; }).length, d = gs.length - w - l, pl = plain();
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
    $('history').innerHTML = gs.length ? '<div class="hist">' + gs.slice(0, 12).map(function (g, i) {
      var ds = new Date(g.d).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
      return '<div class="hrow"><span class="res ' + g.r + '">' + { W: 'Won', L: 'Lost', D: 'Draw' }[g.r] + '</span><div>' + ds + ' · ' + (pl ? partnerName() : OPP[g.level] ? OPP[g.level].name : '') + ' · ' + (g.user === 'w' ? 'White' : 'Black') + '<small>' + Math.ceil(g.sans.length / 2) + ' moves' + (g.acc != null && !pl ? ' · accuracy ' + g.acc + '%' : '') + '</small></div><button class="btn sm" type="button" data-review="' + i + '">Review</button></div>';
    }).join('') + '</div>' : '<p class="empty-note">No finished games yet. Your games show up here with a full review.</p>';
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
    st.tab = name;
    ['coach', 'path', 'play', 'train', 'progress'].forEach(function (t) { $('tab-' + t).setAttribute('aria-selected', t === name ? 'true' : 'false'); $('panel-' + t).hidden = t !== name; });
    if (name === 'progress') renderProgress();
    if (name === 'train') renderTrain();
    if (name === 'path') renderPath();
    if (name === 'coach') renderCoach();
    lsSet('suresh-chess-coach.tab', name);
    renderZones(); releaseOffer();
  }

  /* ---------- persistence ---------- */
  /* Sync safety: no push until this session's first pull has finished (merged, or cloud confirmed empty). */
  var cloud = { game: null, prof: null, gt: null, pt: null, ready: false, busy: null, tries: 0, retry: null }, KSEEN = 'suresh-chess-coach.cloudSeen', RETRY = [2000, 5000, 15000, 60000];
  function snapshot() { return { sans: G.history(), user: st.user, level: st.level, ann: st.ann, notes: st.notes, tags: st.tags, fb: st.fb, opp: st.opp, evalW: st.evalW, flipped: st.flipped, recorded: st.recorded, goal: st.goal, t: st.t || 0 }; }
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
    st.fb = saved.fb || null; st.opp = saved.opp || null; st.evalW = saved.evalW || 0; st.flipped = !!saved.flipped; st.recorded = !!saved.recorded; st.t = saved.t || 0; st.goal = saved.goal || null;
    st.sel = null; resetHints(); st.bannerOff = false;
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
    if (st.mode === 'reach') { tapReach(s); return false; }
    if (!interactive()) return false;
    if (st.sel && st.sel !== s && canMove(st.sel, s)) { userMove(st.sel, s); return false; }
    if (ownPiece(s)) { st.sel = s; render(); return true; }
    st.sel = null; render(); return false;
  }
  gridEl.addEventListener('pointerdown', function (e) {
    var el = e.target.closest('.sq'); if (!el) return;
    var s = el.dataset.sq, started = press(s);
    if (started && st.sel === s) {
      var size = el.getBoundingClientRect().width, p = viewGame().get(s), pc = el.querySelector('.pc'), g = document.createElement('div');
      g.className = 'ghost'; var gt = Avatar.piece(st.theme, p.color, p.type); g.innerHTML = gt ? '<span class="tokw" style="width:' + (size * 0.94) + 'px;height:' + (size * 0.94) + 'px">' + gt + '</span>' : '<span class="pc ' + p.color + '" style="font-size:' + (size * 0.83) + 'px">' + GLYPH[p.type] + VS + '</span>';
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
    if (st.mode === 'review') { if (e.key === 'ArrowLeft') { gotoPly(st.rv.ply - 1); e.preventDefault(); } if (e.key === 'ArrowRight') { gotoPly(st.rv.ply + 1); e.preventDefault(); } }
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
    st.pv = { g: g, arrows: [{ from: d.from, to: d.to, color: '#3b82c4' }], hl: [d.to], sticky: sticky, src: b, label: (plain() ? d.lab || b.getAttribute('aria-label') : b.title.split(':')[0]) + (nm ? ' (' + nm + ')' : '') + (g ? ', from the position it was played in' : '') + (sticky ? ' \u00B7 tap the board to go back' : '') };
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
  $('banner').addEventListener('click', function (e) { if (!e.target.closest('button')) { st.bannerOff = true; render(); } });
  $('modeExit').addEventListener('click', function () { if (st.mode === 'play') switchTab('train'); else exitMode(st.mode !== 'review' || !st.rv.past); });
  $('navFirst').addEventListener('click', function () { if (st.mode === 'review') gotoPly(0); });
  $('navPrev').addEventListener('click', function () { if (st.mode === 'review') gotoPly(st.rv.ply - 1); else if (st.mode === 'lesson') lessonNav(-1); });
  $('navNext').addEventListener('click', function () { if (st.mode === 'review') gotoPly(st.rv.ply + 1); else if (st.mode === 'lesson') lessonNav(1); });
  $('navLast').addEventListener('click', function () { if (st.mode === 'review') gotoPly(st.rv.sans.length); });
  $('qSafe').addEventListener('click', function () { answerQuiz(false); });
  $('qBlunder').addEventListener('click', function () { answerQuiz(true); });
  $('moves').addEventListener('click', function (e) {
    var td = e.target.closest('td[data-ply]'); if (!td) return;
    if (st.mode !== 'review') enterReview(null);
    gotoPly(+td.dataset.ply);
  });
  document.querySelector('.tabs').addEventListener('click', function (e) { var b = e.target.closest('.tab'); if (b) switchTab(b.dataset.tab); });
  document.addEventListener('click', function (e) {
    if (e.target && e.target.id === 'settingsSheet') { closeSettings(); return; }
    var t = e.target.closest('button'); if (!t || t.closest('.tabs')) return;
    var d = t.dataset;
    if (d.unit) { if (st.mode !== 'play' && st.mode !== 'review') { clearSession(); st.mode = 'play'; resetHints(); } st.unitOpen = d.unit; switchTab('path'); render(); return; }
    if (d.part) { st.unitOpen = d.u; startPart(d.u, d.part); return; }
    if (d.zgo) { switchTab(d.zgo); return; }
    if (d.coach) { Coach3D.set(d.coach); $('coachAv').dataset.k = ''; $('coachStrip').dataset.k = ''; var sc = $('sessionCard'); if (sc) sc._h = ''; renderCoach(); render(); return; }
    if (d.act === 'units') { st.unitOpen = null; renderPath(); return; }
    if (d.act === 'recgame') { newGame(false, { level: plain() ? Profile.LEVELS.beginner.opp : recLevel() }); return; }
    if (d.act === 'review') { enterReview(null); return; }
    if (d.act === 'again') { st.bannerOff = true; newGame(true); return; }
    if (d.act === 'next') { nextItem(); return; }
    if (d.act === 'retry') { retryPuzzle(); return; }
    if (d.act === 'close') { exitMode(true); return; }
    if (d.again) { var s = st.ses; if (s && s.unit && s.part) startPart(s.unit, s.part); else if (s && s.rated) trainStart('rated'); else if (s && s.kind === 'safety') trainStart('safety'); else exitMode(); return; }
    if (d.train) { trainStart(d.train); return; }
    if (d.theme) { var items = pickPuzzles([d.theme], 0, 3000, 10); startSession('puzzles', { title: 'Theme: ' + (THEMES[d.theme] || d.theme), count: items.length, items: items }); return; }
    if (d.book) { var line = COURSE.BOOK.filter(function (b) { return b.id === d.book; })[0]; startSession('book', { title: 'Opening drill', count: 1, items: [line] }); return; }
    if (d.drill) { var u = UNIT[d.drill]; if (u) startDrill(u.id, u.apply); return; }
    if (d.apply) { startPart(d.apply, 'apply'); return; }
    if (t.hasAttribute('data-review')) { var g = prof.games[+d.review]; if (g) enterReview(g); return; }
    if (d.lnav) { lessonNav(+d.lnav); return; }
    if (d.stage) { st.stageView = +d.stage; renderCoach(); var sc = $('stageCard'); if (sc && sc.scrollIntoView) sc.scrollIntoView({ behavior: 'smooth', block: 'start' }); return; }
    if (d.go === 'next') { goNext(); return; }
    if (d.set) { setTheme(d.set); return; }
    if (d.lvset) { chooseLevel(d.lvset); return; }
    if (d.act === 'recheck') { closeSettings(); openPlacement(true); return; }
    if (d.act === 'showall') { prof.showAll = !prof.showAll; saveProfile(); refreshUI(); renderLevelCard('[data-act="showall"]'); return; }
    if (d.act === 'settings') { openSettings(); return; }
    if (d.act === 'settingsclose') { closeSettings(); return; }
    if (d.act === 'notedone') { hideNote(); return; }
    if (d.act === 'offeryes') { answerOffer(true); return; }
    if (d.act === 'offerno') { answerOffer(false); return; }
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
    var th = lsGet('suresh-chess-coach.pieces'); if (th && Avatar.SETS[th]) st.theme = th;
    var raw = lsGet(PSTORE), p = Profile.migrate(raw); if (p) prof = p;
    if (raw && (+raw.v || 0) < Profile.V && prof.placed === 'derived') { lsSet(PSTORE, prof); showNote('You’re set as ' + Profile.LEVELS[prof.level].name + '. Change it any time in Settings.', 'level'); }
    applyLevel();
    Brain.onState(function (s) { enginePill(s); if (s === 'ready' && st.mode === 'play' && G.turn() === st.user && !G.game_over() && !st.busy) analyseForUser().then(render); });
    Brain.init('sf/stockfish.js'); enginePill(Brain.state());
    buildGrid();
    var saved = data && data.sans ? data : lsGet(STORE);
    if (!applySaved(saved)) { G.reset(); st.user = 'w'; st.level = recLevel(); $('levelSel').value = String(st.level); st.fb = { cls: 'info', sym: '♙', title: 'Ready when you are', text: 'Start with today’s plan on Home, or make a move to play.' }; }
    var tab = lsGet('suresh-chess-coach.tab'); switchTab(tab && $('panel-' + tab) && tab !== 'path' ? tab : 'coach');
    render(); resumeGame();
    if (lsGet(K3D) === true) set3d(true, true);
    if (Profile.needsCheck(prof)) openPlacement(false);
    initCloud();
  }
  if (window.claude && window.claude.hot && window.claude.hot.snapshot) { try { window.claude.hot.snapshot(snapshot); } catch (e) {} }
  window.claude && window.claude.hot && window.claude.hot.ready ? window.claude.hot.ready(start) : start((window.claude && window.claude.hot && window.claude.hot.data) || {});
  window.__coach = { st: st, getProf: function () { return prof; }, PZ: PZ, startPart: startPart, trainStart: trainStart, openPlacement: openPlacement, nextUnit: nextUnit, hist: function () { return G.history(); }, openSettings: openSettings };
})();
