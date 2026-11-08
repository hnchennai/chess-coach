/* ---------- Tactics: board geometry and theme detection (works with chess.js) ---------- */
var Tac = (function () {
  var FILES = 'abcdefgh', VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 100 };
  var KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  var KG = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  var ORTH = [[1, 0], [-1, 0], [0, 1], [0, -1]], DIAG = [[1, 1], [1, -1], [-1, 1], [-1, -1]];
  function opp(c) { return c === 'w' ? 'b' : 'w'; }
  function sqOf(f, r) { return FILES[f] + (r + 1); }
  function fr(sq) { return [sq.charCodeAt(0) - 97, +sq[1] - 1]; }
  function on(f, r) { return f >= 0 && f < 8 && r >= 0 && r < 8; }

  function attackersOf(g, sq, color) {
    var out = [], c = fr(sq), f = c[0], r = c[1], i, p, s, ff, rr;
    var pr = color === 'w' ? r - 1 : r + 1;
    for (i = -1; i <= 1; i += 2) if (on(f + i, pr)) { s = sqOf(f + i, pr); p = g.get(s); if (p && p.color === color && p.type === 'p') out.push({ sq: s, type: 'p' }); }
    for (i = 0; i < 8; i++) { ff = f + KN[i][0]; rr = r + KN[i][1]; if (on(ff, rr)) { s = sqOf(ff, rr); p = g.get(s); if (p && p.color === color && p.type === 'n') out.push({ sq: s, type: 'n' }); } }
    for (i = 0; i < 8; i++) { ff = f + KG[i][0]; rr = r + KG[i][1]; if (on(ff, rr)) { s = sqOf(ff, rr); p = g.get(s); if (p && p.color === color && p.type === 'k') out.push({ sq: s, type: 'k' }); } }
    [[ORTH, 'r'], [DIAG, 'b']].forEach(function (set) {
      set[0].forEach(function (d) {
        ff = f + d[0]; rr = r + d[1];
        while (on(ff, rr)) {
          s = sqOf(ff, rr); p = g.get(s);
          if (p) { if (p.color === color && (p.type === set[1] || p.type === 'q')) out.push({ sq: s, type: p.type }); break; }
          ff += d[0]; rr += d[1];
        }
      });
    });
    return out;
  }
  function piecesOf(g, color) {
    var out = [];
    for (var f = 0; f < 8; f++) for (var r = 0; r < 8; r++) { var s = sqOf(f, r), p = g.get(s); if (p && p.color === color) out.push({ sq: s, type: p.type }); }
    return out;
  }
  function targetsOf(g, from) {
    var me = g.get(from); if (!me) return [];
    return piecesOf(g, opp(me.color)).filter(function (t) { return attackersOf(g, t.sq, me.color).some(function (a) { return a.sq === from; }); });
  }
  function hanging(g, color) {
    return piecesOf(g, color).filter(function (pc) {
      if (pc.type === 'k') return false;
      var atk = attackersOf(g, pc.sq, opp(color)); if (!atk.length) return false;
      var def = attackersOf(g, pc.sq, color);
      var minA = Math.min.apply(null, atk.map(function (a) { return VAL[a.type]; }));
      return !def.length || minA < VAL[pc.type];
    });
  }
  // lines from a slider: returns [{first, second}] enemy pieces in a row on each ray
  function rays(g, from) {
    var me = g.get(from); if (!me) return [];
    var dirs = me.type === 'r' ? ORTH : me.type === 'b' ? DIAG : me.type === 'q' ? ORTH.concat(DIAG) : [];
    var c = fr(from), out = [];
    dirs.forEach(function (d) {
      var ff = c[0] + d[0], rr = c[1] + d[1], seen = [];
      while (on(ff, rr) && seen.length < 2) { var s = sqOf(ff, rr), p = g.get(s); if (p) { seen.push({ sq: s, type: p.type, color: p.color }); } ff += d[0]; rr += d[1]; }
      if (seen.length === 2 && seen[0].color !== me.color && seen[1].color !== me.color) out.push({ first: seen[0], second: seen[1] });
    });
    return out;
  }
  // themes for the first move of a winning line. g: position before the move. m: chess.js verbose move. line: array of SAN/verbose moves following
  function themesOf(g0, m, info) {
    var C = typeof Chess !== "undefined" ? Chess : g0.constructor, g = new C(g0.fen()), me = m.color, them = opp(me), th = [];
    var preHang = hanging(g, them).map(function (h) { return h.sq; });
    g.move(m);
    if (info && info.mate) {
      th.push('mate', 'mateIn' + Math.min(info.mate, 4));
      if (info.mate === 1) {
        var k = piecesOf(g, them).filter(function (p) { return p.type === 'k'; })[0];
        if (k && (k.sq[1] === '1' || k.sq[1] === '8') && (m.piece === 'r' || m.piece === 'q') && m.to[1] === k.sq[1]) th.push('backRank');
        if (m.piece === 'n') th.push('smothered');
      }
    }
    if (m.promotion) th.push('promotion');
    if (m.captured && preHang.indexOf(m.to) > -1) th.push('hanging');
    var hits = targetsOf(g, m.to).filter(function (t) { return t.type === 'k' || VAL[t.type] > VAL[m.piece] || !attackersOf(g, t.sq, them).length; });
    if (hits.length >= 2 && !(info && info.mate === 1)) th.push('fork');
    rays(g, m.to).forEach(function (r) {
      if (r.first.type === 'k' || (VAL[r.first.type] > VAL[r.second.type] && r.first.type !== 'p')) { if (r.second.type !== 'p' && VAL[r.second.type] >= 3) th.push('skewer'); }
      else if (VAL[r.second.type] > VAL[r.first.type] && (r.second.type === 'k' || r.second.type === 'q' || r.second.type === 'r')) th.push('pin');
    });
    // discovered: another of my pieces now attacks the enemy king or queen that it didn't before
    var before = new C(g0.fen());
    piecesOf(g, them).filter(function (p) { return p.type === 'k' || p.type === 'q' || p.type === 'r'; }).forEach(function (t) {
      var nowA = attackersOf(g, t.sq, me).filter(function (a) { return a.sq !== m.to; }).map(function (a) { return a.sq; });
      var wasA = attackersOf(before, t.sq, me).map(function (a) { return a.sq; });
      if (nowA.some(function (s) { return wasA.indexOf(s) === -1; })) th.push(t.type === 'k' ? 'discoveredCheck' : 'discovered');
    });
    if (g.in_check() && th.indexOf('mate') === -1) th.push('check');
    if (m.flags.indexOf('c') > -1 && VAL[m.captured] < VAL[m.piece] && m.piece !== 'p' && th.indexOf('mate') === -1) th.push('sacrifice');
    if (th.indexOf('mate') > -1) th = th.filter(function (x) { return /^(mate|mateIn\d|backRank|smothered|sacrifice|promotion)$/.test(x); });
    return th.filter(function (x, i, a) { return a.indexOf(x) === i; });
  }
  var api = { VAL: VAL, opp: opp, sqOf: sqOf, fr: fr, attackersOf: attackersOf, piecesOf: piecesOf, targetsOf: targetsOf, hanging: hanging, rays: rays, themesOf: themesOf };
  return api;
})();
if (typeof module !== 'undefined') module.exports = Tac;
