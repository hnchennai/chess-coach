/* ---------- Brain: Stockfish 19 in a worker, with the built-in engine as fallback ---------- */
var Brain = (function () {
  var MATE = 100000;
  var w = null, state = 'off', queue = [], cur = null, listeners = [], readyCbs = [];
  function setState(s) { state = s; listeners.forEach(function (f) { try { f(s); } catch (e) {} }); }
  function init(path) {
    if (w || state === 'loading') return;
    setState('loading');
    var timer = setTimeout(function () { if (state === 'loading') fail(); }, 10000);
    try {
      w = new Worker(path || 'sf/stockfish.js');
      w.onmessage = function (e) { onLine(String(e.data)); };
      w.onerror = function () { clearTimeout(timer); fail(); };
      send('uci');
      expect(/^uciok/, function () { send('setoption name Hash value 16'); send('isready'); expect(/^readyok/, function () { clearTimeout(timer); setState('ready'); pump(); }); });
    } catch (e) { clearTimeout(timer); fail(); }
  }
  function fail() {
    try { if (w) w.terminate(); } catch (e) {}
    w = null; setState('failed');
    var q = queue; queue = []; if (cur) { q.unshift(cur); cur = null; }
    q.forEach(function (job) { job.fallback(); });
  }
  var waitRe = null, waitCb = null, lines = [];
  function expect(re, cb) { waitRe = re; waitCb = cb; }
  function send(s) { if (w) w.postMessage(s); }
  function onLine(ln) {
    lines.push(ln);
    if (waitRe && waitRe.test(ln)) { var cb = waitCb, got = lines; waitRe = null; waitCb = null; lines = []; cb(got); }
  }
  function parse(got) {
    var best = {};
    got.forEach(function (l) {
      var m = l.match(/ depth (\d+) .*?multipv (\d+) score (cp|mate) (-?\d+).*? pv (.+)$/);
      if (!m) return;
      var d = +m[1], k = +m[2];
      if (!best[k] || d >= best[k].d) best[k] = { d: d, t: m[3], v: +m[4], pv: m[5].trim().split(' ') };
    });
    return Object.keys(best).sort(function (a, b) { return a - b; }).map(function (k) {
      var b = best[k];
      return { uci: b.pv[0], pv: b.pv, depth: b.d, mate: b.t === 'mate' ? b.v : null, score: b.t === 'mate' ? (b.v > 0 ? MATE - b.v : -MATE - b.v) : b.v };
    });
  }
  function pump() {
    if (cur || state !== 'ready' || !queue.length) return;
    cur = queue.shift();
    cur.run();
  }
  function finish(job, val) { if (cur === job) cur = null; job.resolve(val); pump(); }

  /* Built-in engine fallback (synchronous, weaker) */
  function fbAnalyse(fen, opts) {
    var res = Eng.analyze(fen, Math.min(opts.fbDepth || 3, 4), opts.fbMs || 1500);
    return res.slice(0, opts.multipv || 1).map(function (x) { return { uci: x.key, pv: [x.key], depth: 3, mate: x.score > MATE - 500 ? Math.ceil((MATE - x.score) / 2) : x.score < -MATE + 500 ? -Math.ceil((MATE + x.score) / 2) : null, score: x.score }; });
  }

  /* analyse(fen, {depth, multipv, movetime}) -> Promise<[lines]> ; scores from side to move */
  function analyse(fen, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var job = {
        resolve: resolve,
        fallback: function () { setTimeout(function () { resolve(fbAnalyse(fen, opts)); }, 0); },
        run: function () {
          send('setoption name UCI_LimitStrength value false'); send('setoption name Skill Level value 20');
          send('setoption name MultiPV value ' + (opts.multipv || 1));
          send('position fen ' + fen);
          send('go ' + (opts.movetime ? 'movetime ' + opts.movetime : 'depth ' + (opts.depth || 12)));
          expect(/^bestmove/, function (got) { var r = parse(got); if (!r.length) { var bm = (got[got.length - 1] || '').split(' ')[1]; if (bm && bm !== '(none)') r = [{ uci: bm, pv: [bm], score: 0, mate: null }]; } finish(job, r); });
        }
      };
      if (state === 'ready') { queue.push(job); pump(); }
      else if (state === 'loading') queue.push(job);
      else job.fallback();
    });
  }
  /* play(fen, {elo, skill, depth, movetime}) -> Promise<uci> */
  function play(fen, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var job = {
        resolve: resolve,
        fallback: function () { setTimeout(function () { var b = Eng.best(fen, opts.fbDepth || 5, 1800); resolve(b ? b.key : null); }, 0); },
        run: function () {
          send('setoption name MultiPV value 1');
          if (opts.elo) { send('setoption name UCI_LimitStrength value true'); send('setoption name UCI_Elo value ' + opts.elo); }
          else { send('setoption name UCI_LimitStrength value false'); send('setoption name Skill Level value ' + (opts.skill == null ? 20 : opts.skill)); }
          send('position fen ' + fen);
          send('go ' + (opts.depth ? 'depth ' + opts.depth : 'movetime ' + (opts.movetime || 600)));
          expect(/^bestmove/, function (got) { var bm = (got[got.length - 1] || '').split(' ')[1]; finish(job, bm && bm !== '(none)' ? bm : null); });
        }
      };
      if (state === 'ready') { queue.push(job); pump(); }
      else if (state === 'loading') queue.push(job);
      else job.fallback();
    });
  }
  return {
    init: init, analyse: analyse, play: play, MATE: MATE,
    state: function () { return state; }, strong: function () { return state === 'ready'; },
    onState: function (f) { listeners.push(f); }
  };
})();
