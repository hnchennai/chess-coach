/* ---------- Search engine: 0x88 board, alpha-beta + quiescence ---------- */
var Eng = (function () {
  var P = 1, N = 2, B = 3, R = 4, Q = 5, K = 6;
  var VAL = [0, 100, 320, 330, 500, 900, 0];
  var T = {
    1: [[0,0,0,0,0,0,0,0],[50,50,50,50,50,50,50,50],[10,10,20,30,30,20,10,10],[5,5,10,25,25,10,5,5],[0,0,0,20,20,0,0,0],[5,-5,-10,0,0,-10,-5,5],[5,10,10,-20,-20,10,10,5],[0,0,0,0,0,0,0,0]],
    2: [[-50,-40,-30,-30,-30,-30,-40,-50],[-40,-20,0,0,0,0,-20,-40],[-30,0,10,15,15,10,0,-30],[-30,5,15,20,20,15,5,-30],[-30,0,15,20,20,15,0,-30],[-30,5,10,15,15,10,5,-30],[-40,-20,0,5,5,0,-20,-40],[-50,-40,-30,-30,-30,-30,-40,-50]],
    3: [[-20,-10,-10,-10,-10,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,10,10,5,0,-10],[-10,5,5,10,10,5,5,-10],[-10,0,10,10,10,10,0,-10],[-10,10,10,10,10,10,10,-10],[-10,5,0,0,0,0,5,-10],[-20,-10,-10,-10,-10,-10,-10,-20]],
    4: [[0,0,0,0,0,0,0,0],[5,10,10,10,10,10,10,5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[-5,0,0,0,0,0,0,-5],[0,0,0,5,5,0,0,0]],
    5: [[-20,-10,-10,-5,-5,-10,-10,-20],[-10,0,0,0,0,0,0,-10],[-10,0,5,5,5,5,0,-10],[-5,0,5,5,5,5,0,-5],[0,0,5,5,5,5,0,-5],[-10,5,5,5,5,5,0,-10],[-10,0,5,0,0,0,0,-10],[-20,-10,-10,-5,-5,-10,-10,-20]],
    6: [[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-30,-40,-40,-50,-50,-40,-40,-30],[-20,-30,-30,-40,-40,-30,-30,-20],[-10,-20,-20,-20,-20,-20,-20,-10],[20,20,0,0,0,0,20,20],[20,30,10,0,0,10,30,20]],
    7: [[-50,-40,-30,-20,-20,-30,-40,-50],[-30,-20,-10,0,0,-10,-20,-30],[-30,-10,20,30,30,20,-10,-30],[-30,-10,30,40,40,30,-10,-30],[-30,-10,30,40,40,30,-10,-30],[-30,-10,20,30,30,20,-10,-30],[-30,-30,0,0,0,0,-30,-30],[-50,-30,-30,-30,-30,-30,-30,-50]]
  };
  var ND = [-33, -31, -18, -14, 14, 18, 31, 33], KD = [-17, -16, -15, -1, 1, 15, 16, 17];
  var BD = [-17, -15, 15, 17], RD = [-16, -1, 1, 16];
  var MATE = 100000, INF = 1e9;
  var bd = new Array(128), side = 1, castle = 0, ep = -1;
  var CM = new Array(128); for (var i = 0; i < 128; i++) CM[i] = 15;
  CM[116] = 15 & ~3; CM[119] = 15 & ~1; CM[112] = 15 & ~2; CM[4] = 15 & ~12; CM[7] = 15 & ~4; CM[0] = 15 & ~8;
  var FCH = { p: P, n: N, b: B, r: R, q: Q, k: K };

  function name(sq) { return 'abcdefgh'[sq & 7] + (8 - (sq >> 4)); }
  function load(fen) {
    var f = fen.split(' ');
    for (var i = 0; i < 128; i++) bd[i] = 0;
    var rows = f[0].split('/');
    for (var r = 0; r < 8; r++) {
      var c = 0;
      for (var j = 0; j < rows[r].length; j++) {
        var ch = rows[r][j];
        if (ch >= '1' && ch <= '8') c += +ch;
        else { var lo = ch.toLowerCase(); bd[r * 16 + c] = (ch === lo ? -1 : 1) * FCH[lo]; c++; }
      }
    }
    side = f[1] === 'w' ? 1 : -1;
    castle = 0;
    if (f[2].indexOf('K') > -1) castle |= 1; if (f[2].indexOf('Q') > -1) castle |= 2;
    if (f[2].indexOf('k') > -1) castle |= 4; if (f[2].indexOf('q') > -1) castle |= 8;
    ep = -1;
    if (f[3] && f[3] !== '-') ep = (8 - +f[3][1]) * 16 + (f[3].charCodeAt(0) - 97);
  }

  function attacked(sq, by) {
    var i, t, p;
    // pawns
    var pd = by === 1 ? 16 : -16; // attacker pawn sits "behind" relative to its movement
    t = sq + pd - 1; if (!(t & 0x88) && bd[t] === by * P) return true;
    t = sq + pd + 1; if (!(t & 0x88) && bd[t] === by * P) return true;
    for (i = 0; i < 8; i++) { t = sq + ND[i]; if (!(t & 0x88) && bd[t] === by * N) return true; }
    for (i = 0; i < 8; i++) { t = sq + KD[i]; if (!(t & 0x88) && bd[t] === by * K) return true; }
    for (i = 0; i < 4; i++) {
      t = sq + BD[i];
      while (!(t & 0x88)) { p = bd[t]; if (p) { if (p === by * B || p === by * Q) return true; break; } t += BD[i]; }
      t = sq + RD[i];
      while (!(t & 0x88)) { p = bd[t]; if (p) { if (p === by * R || p === by * Q) return true; break; } t += RD[i]; }
    }
    return false;
  }

  function gen(capsOnly) {
    var ms = [], s = side, sq, p, a, t, i, d;
    function add(f, to, flag, promo) { ms.push({ f: f, t: to, p: Math.abs(bd[f]), c: Math.abs(bd[to]) || (flag === 2 ? P : 0), fl: flag || 0, pr: promo || 0 }); }
    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = bd[sq]; if (!p || (p > 0) !== (s > 0)) continue;
      a = Math.abs(p);
      if (a === P) {
        var dir = s === 1 ? -16 : 16, startRow = s === 1 ? 6 : 1, promoRow = s === 1 ? 0 : 7;
        t = sq + dir;
        if (!(t & 0x88) && !bd[t]) {
          if ((t >> 4) === promoRow) { add(sq, t, 0, Q); if (!capsOnly) add(sq, t, 0, N); }
          else if (!capsOnly) {
            add(sq, t);
            if ((sq >> 4) === startRow && !bd[t + dir]) add(sq, t + dir, 1);
          }
        }
        for (i = -1; i <= 1; i += 2) {
          t = sq + dir + i; if (t & 0x88) continue;
          if (bd[t] && (bd[t] > 0) !== (s > 0)) {
            if ((t >> 4) === promoRow) { add(sq, t, 0, Q); if (!capsOnly) add(sq, t, 0, N); } else add(sq, t);
          } else if (t === ep) add(sq, t, 2);
        }
      } else if (a === N || a === K) {
        var D = a === N ? ND : KD;
        for (i = 0; i < 8; i++) {
          t = sq + D[i]; if (t & 0x88) continue;
          if (!bd[t]) { if (!capsOnly) add(sq, t); } else if ((bd[t] > 0) !== (s > 0)) add(sq, t);
        }
        if (a === K && !capsOnly) {
          if (s === 1 && sq === 116) {
            if ((castle & 1) && !bd[117] && !bd[118] && bd[119] === R && !attacked(116, -1) && !attacked(117, -1) && !attacked(118, -1)) add(116, 118, 3);
            if ((castle & 2) && !bd[115] && !bd[114] && !bd[113] && bd[112] === R && !attacked(116, -1) && !attacked(115, -1) && !attacked(114, -1)) add(116, 114, 4);
          } else if (s === -1 && sq === 4) {
            if ((castle & 4) && !bd[5] && !bd[6] && bd[7] === -R && !attacked(4, 1) && !attacked(5, 1) && !attacked(6, 1)) add(4, 6, 3);
            if ((castle & 8) && !bd[3] && !bd[2] && !bd[1] && bd[0] === -R && !attacked(4, 1) && !attacked(3, 1) && !attacked(2, 1)) add(4, 2, 4);
          }
        }
      } else {
        var dirs = a === B ? BD : a === R ? RD : KD;
        for (i = 0; i < dirs.length; i++) {
          d = dirs[i]; t = sq + d;
          while (!(t & 0x88)) {
            if (!bd[t]) { if (!capsOnly) add(sq, t); }
            else { if ((bd[t] > 0) !== (s > 0)) add(sq, t); break; }
            t += d;
          }
        }
      }
    }
    return ms;
  }

  var stack = [];
  function make(m) {
    stack.push([bd[m.t], castle, ep, m.fl === 2 ? bd[m.t + (side === 1 ? 16 : -16)] : 0]);
    var pc = bd[m.f];
    bd[m.t] = m.pr ? side * m.pr : pc; bd[m.f] = 0;
    if (m.fl === 2) bd[m.t + (side === 1 ? 16 : -16)] = 0;
    else if (m.fl === 3) { bd[m.t - 1] = bd[m.t + 1]; bd[m.t + 1] = 0; }
    else if (m.fl === 4) { bd[m.t + 1] = bd[m.t - 2]; bd[m.t - 2] = 0; }
    ep = m.fl === 1 ? (m.f + m.t) >> 1 : -1;
    castle &= CM[m.f] & CM[m.t];
    side = -side;
    // legality: own king not attacked
    var ks = -1, kp = -side * K;
    for (var s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } if (bd[s] === kp) { ks = s; break; } }
    return !attacked(ks, side);
  }
  function unmake(m) {
    var u = stack.pop();
    side = -side;
    bd[m.f] = m.pr ? side * P : bd[m.t]; bd[m.t] = u[0];
    if (m.fl === 2) bd[m.t + (side === 1 ? 16 : -16)] = u[3];
    else if (m.fl === 3) { bd[m.t + 1] = bd[m.t - 1]; bd[m.t - 1] = 0; }
    else if (m.fl === 4) { bd[m.t - 2] = bd[m.t + 1]; bd[m.t + 1] = 0; }
    castle = u[1]; ep = u[2];
  }
  function inCheck() {
    for (var s = 0; s < 128; s++) { if (s & 0x88) { s += 7; continue; } if (bd[s] === side * K) return attacked(s, -side); }
    return false;
  }

  function evalWhite() {
    var s = 0, npmW = 0, npmB = 0, q = 0, sq, p, a;
    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = bd[sq]; if (!p) continue; a = Math.abs(p);
      if (a === Q) q++;
      if (a !== P && a !== K) { if (p > 0) npmW += VAL[a]; else npmB += VAL[a]; }
    }
    var eg = q === 0 || (npmW <= 1300 && npmB <= 1300);
    for (sq = 0; sq < 128; sq++) {
      if (sq & 0x88) { sq += 7; continue; }
      p = bd[sq]; if (!p) continue; a = Math.abs(p);
      var tb = T[a === K && eg ? 7 : a], r = sq >> 4, c = sq & 7;
      if (p > 0) s += VAL[a] + tb[r][c]; else s -= VAL[a] + tb[7 - r][c];
    }
    return s;
  }

  function order(ms) {
    for (var i = 0; i < ms.length; i++) { var m = ms[i]; m.k = (m.c ? 10 * VAL[m.c] - VAL[m.p] + 1000 : 0) + (m.pr === Q ? 900 : 0); }
    ms.sort(function (a, b) { return b.k - a.k; });
    return ms;
  }

  var nodes = 0, deadline = 0, abort = false;
  function tick() { if ((++nodes & 2047) === 0 && Date.now() > deadline) abort = true; }

  function quiesce(alpha, beta, qd) {
    tick();
    var stand = evalWhite() * side;
    if (stand >= beta) return beta;
    if (stand > alpha) alpha = stand;
    if (qd <= 0) return alpha;
    var ms = order(gen(true));
    for (var i = 0; i < ms.length; i++) {
      if (!make(ms[i])) { unmake(ms[i]); continue; }
      var sc = -quiesce(-beta, -alpha, qd - 1);
      unmake(ms[i]);
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    return alpha;
  }

  function negamax(depth, alpha, beta, ply) {
    tick(); if (abort) return 0;
    if (depth <= 0) return quiesce(alpha, beta, 6);
    var ms = order(gen(false)), legal = 0;
    for (var i = 0; i < ms.length; i++) {
      if (!make(ms[i])) { unmake(ms[i]); continue; }
      legal++;
      var sc = -negamax(depth - 1, -beta, -alpha, ply + 1);
      unmake(ms[i]);
      if (sc >= beta) return beta;
      if (sc > alpha) alpha = sc;
    }
    if (!legal) return inCheck() ? -MATE + ply : 0;
    return alpha;
  }

  function rootMoves() {
    var ms = order(gen(false)), out = [];
    for (var i = 0; i < ms.length; i++) { var ok = make(ms[i]); unmake(ms[i]); if (ok) out.push(ms[i]); }
    return out;
  }
  function key(m) { return name(m.f) + name(m.t) + (m.pr ? 'nbrq'[m.pr - 2] : ''); }

  /* Exact score for every legal move, best first. Scores are from the mover's view. */
  function analyze(fen, depth, budget) {
    load(fen); nodes = 0; abort = false; deadline = Date.now() + (budget || 2000);
    var ms = rootMoves(), res = [];
    for (var d = 1; d <= depth; d++) {
      var cur = [];
      for (var i = 0; i < ms.length; i++) {
        make(ms[i]); var sc = -negamax(d - 1, -INF, INF, 1); unmake(ms[i]);
        if (abort) break;
        cur.push({ key: key(ms[i]), score: sc });
      }
      if (abort) break;
      res = cur;
    }
    res.sort(function (a, b) { return b.score - a.score; });
    return res;
  }

  /* Best move under a time budget with iterative deepening. */
  function best(fen, maxDepth, budget) {
    load(fen); nodes = 0; abort = false; deadline = Date.now() + (budget || 1500);
    var ms = rootMoves(); if (!ms.length) return null;
    var res = { key: key(ms[0]), score: 0, depth: 0 };
    for (var d = 1; d <= maxDepth; d++) {
      var alpha = -INF, bm = null;
      for (var i = 0; i < ms.length; i++) {
        make(ms[i]); var sc = -negamax(d - 1, -INF, -alpha, 1); unmake(ms[i]);
        if (abort) break;
        if (sc > alpha) { alpha = sc; bm = ms[i]; }
      }
      if (abort || !bm) break;
      res = { key: key(bm), score: alpha, depth: d };
      ms.splice(ms.indexOf(bm), 1); ms.unshift(bm);
      if (Math.abs(alpha) > MATE - 200) break;
    }
    return res;
  }

  function perftR(d){ if(!d) return 1; var ms=gen(false),n=0; for(var i=0;i<ms.length;i++){ if(make(ms[i])) n+=perftR(d-1); unmake(ms[i]); } return n; }
  function perft(fen,d){ load(fen); return perftR(d); }
  function staticEval(fen) { load(fen); return evalWhite(); }

  return { perft: perft, analyze: analyze, best: best, staticEval: staticEval, MATE: MATE, VAL: { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 } };
})();
if (typeof module !== 'undefined') module.exports = Eng;
