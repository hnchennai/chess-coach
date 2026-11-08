// Mines tactical puzzles from weak-engine games, verified by Stockfish 19 lite.
// usage: node miner.js <seed> <games> <out.jsonl>
global.Chess = require('chess.js').Chess;
const E = require('./engine.js'), Tac = require('./tactics.js');
const { spawn } = require('child_process');
const fs = require('fs');
const SF_PATH = __dirname + '/../sf/package/bin/stockfish-19-lite-single.js';

let seed = +process.argv[2] || 1;
function rnd() { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }

class SF {
  constructor() {
    this.p = spawn('node', [SF_PATH]); this.buf = ''; this.waiters = [];
    this.p.stdout.on('data', d => { this.buf += d; let i; while ((i = this.buf.indexOf('\n')) >= 0) { const ln = this.buf.slice(0, i).trim(); this.buf = this.buf.slice(i + 1); this.onLine(ln); } });
    this.lines = [];
  }
  onLine(ln) { this.lines.push(ln); const w = this.waiters[0]; if (w && w.test(ln)) { this.waiters.shift(); w.res(this.lines); this.lines = []; } }
  send(s) { this.p.stdin.write(s + '\n'); }
  wait(re) { return new Promise(res => this.waiters.push({ test: l => re.test(l), res })); }
  async init() { this.send('uci'); await this.wait(/^uciok/); this.send('setoption name Hash value 32'); this.send('isready'); await this.wait(/^readyok/); }
  async analyse(fen, depth, multipv) {
    this.send('setoption name MultiPV value ' + multipv); this.send('position fen ' + fen); this.send('go depth ' + depth);
    const lines = await this.wait(/^bestmove/);
    const best = {};
    lines.forEach(l => {
      const m = l.match(/ depth (\d+) .*multipv (\d+) score (cp|mate) (-?\d+).* pv (.+)$/); if (!m) return;
      const d = +m[1], k = +m[2]; if (!best[k] || d >= best[k].d) best[k] = { d, type: m[3], v: +m[4], pv: m[5].split(' ') };
    });
    return Object.keys(best).sort((a, b) => a - b).map(k => { const b = best[k]; return { score: b.type === 'mate' ? (b.v > 0 ? 100000 - b.v : -100000 - b.v) : b.v, mate: b.type === 'mate' ? b.v : null, pv: b.pv }; });
  }
}
function uciMove(g, u) { return g.move({ from: u.slice(0, 2), to: u.slice(2, 4), promotion: u[4] || 'q' }); }

const OPENINGS = [
  ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4'], ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5'], ['d4', 'd5', 'c4', 'e6'], ['e4', 'c5', 'Nf3', 'd6'], ['e4', 'e6', 'd4', 'd5'],
  ['d4', 'Nf6', 'c4', 'g6'], ['e4', 'c6', 'd4', 'd5'], ['c4', 'e5', 'Nc3'], ['Nf3', 'd5', 'g3'], ['e4', 'd5', 'exd5', 'Qxd5'], ['d4', 'd5', 'Bf4', 'Nf6'],
  ['e4', 'e5', 'Nf3', 'Nf6'], ['e4', 'e5', 'f4'], ['d4', 'f5'], ['e4', 'g6', 'd4', 'Bg7'], ['e4', 'e5', 'Nc3', 'Nf6']
];

function pickMove(g, strength) {
  const fen = g.fen();
  const res = E.analyze(fen, strength, 400);
  if (!res.length) return null;
  const r = rnd();
  let pool;
  if (r < 0.18) pool = res.slice(0, Math.min(8, res.length));
  else if (r < 0.45) pool = res.filter(x => x.score >= res[0].score - 120);
  else pool = res.filter(x => x.score >= res[0].score - 30);
  const pick = pool[Math.floor(rnd() * pool.length)];
  return g.moves({ verbose: true }).find(m => m.from + m.to + (m.promotion || '') === pick.key);
}

function difficulty(fen, first, userMoves, mate) {
  let found = 0;
  for (const d of [1, 2, 3]) { const b = E.best(fen, d, 800); if (b && b.key.slice(0, 4) === first.slice(0, 4)) { found = d; break; } }
  let r = found === 1 ? 800 : found === 2 ? 1100 : found === 3 ? 1400 : 1700;
  r += (userMoves - 1) * 150;
  if (mate === 1) r = Math.min(r, 950);
  if (mate === 2) r = Math.max(r, 1200);
  if (mate >= 3) r = Math.max(r, 1500);
  return r + Math.round((rnd() - 0.5) * 120);
}

(async () => {
  const games = +process.argv[3] || 10, out = process.argv[4] || 'puzzles.jsonl';
  const sf = new SF(); await sf.init();
  let found = 0;
  for (let gi = 0; gi < games; gi++) {
    const g = new Chess(); const op = OPENINGS[Math.floor(rnd() * OPENINGS.length)];
    const len = 2 + Math.floor(rnd() * (op.length - 1)); op.slice(0, len).forEach(m => g.move(m));
    const strW = rnd() < 0.5 ? 1 : 2, strB = rnd() < 0.5 ? 1 : 2;
    let prev = await sf.analyse(g.fen(), 11, 2), lastPuzzlePly = -10;
    while (!g.game_over() && g.history().length < 130) {
      const m = pickMove(g, g.turn() === 'w' ? strW : strB); if (!m) break;
      const prevBest = prev[0] ? prev[0].score : 0, preFen = g.fen(), preBest = prev[0] ? prev[0].pv[0] : null;
      g.move(m);
      if (g.game_over()) break;
      const a = await sf.analyse(g.fen(), 12, 2);
      prev = a;
      const best = a[0], second = a[1];
      if (!best) continue;
      const before = -prevBest; // eval for side to move before opponent's move
      const ply = g.history().length;
      if (ply - lastPuzzlePly < 6) continue;
      const isMate = best.mate && best.mate > 0 && best.mate <= 3;
      const uniqueMate = isMate && (!second || !(second.mate && second.mate > 0 && second.mate <= best.mate));
      const winning = !best.mate && best.score >= 250 && best.score <= 1500 && (!second || second.score <= best.score - 200 && !(second.mate > 0));
      if (!(uniqueMate || winning) || before > 100) continue;
      const fen = g.fen(), gp = new Chess(fen);
      let sol = [], userMoves = 0;
      if (isMate) { sol = best.pv.slice(0, best.mate * 2 - 1); userMoves = best.mate; }
      else {
        sol = [best.pv[0]]; userMoves = 1;
        const f0 = uciMove(new Chess(fen), best.pv[0]);
        if (f0 && !f0.captured && !f0.promotion && best.pv.length >= 3) {
          const g2 = new Chess(fen); uciMove(g2, best.pv[0]); uciMove(g2, best.pv[1]);
          const a2 = await sf.analyse(g2.fen(), 12, 2);
          if (a2[0] && a2[0].pv[0] === best.pv[2] && (!a2[1] || a2[1].score <= a2[0].score - 150) && a2[0].score >= 200) { sol = best.pv.slice(0, 3); userMoves = 2; }
        }
      }
      // validate the line plays legally
      const gv = new Chess(fen); let ok = true; for (const u of sol) if (!uciMove(gv, u)) { ok = false; break; }
      if (!ok) continue;
      const first = uciMove(new Chess(fen), sol[0]);
      const themes = Tac.themesOf(new Chess(fen), first, { mate: isMate ? best.mate : 0 });
      if (!themes.length) themes.push('advantage');
      if (!isMate && sol.length === 1 && !first.captured && !first.promotion) continue; // quiet one-movers are poor puzzles
      const rating = difficulty(fen, sol[0], userMoves, isMate ? best.mate : 0);
      const rec = { fen, pre: preFen, preBest, last: m.from + m.to + (m.promotion || ''), sol, themes, rating, ev: best.mate ? 'M' + best.mate : best.score };
      fs.appendFileSync(out, JSON.stringify(rec) + '\n'); found++; lastPuzzlePly = ply;
    }
    process.stderr.write('game ' + (gi + 1) + ' puzzles ' + found + '\n');
  }
  sf.send('quit'); process.exit(0);
})();
