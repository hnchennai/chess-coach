// Store screenshots for the Play listing (docs/specs/play-listing.product.md, P-D6).
// Takes 8 real app screens from the built www/ at 360 x 640 (x2.5), then frames each one with its caption at 1080 x 1920.
// Also makes the feature graphic (1024 x 500) from the 3D board shot, and the 512 x 512 icon from assets/icon.png, one folder up.
// Run: node tools/store-shots.js [outDir]   (needs Playwright with Chromium on NODE_PATH; default outDir store/screenshots)
// RAW=1 keeps the unframed screens as raw-NN.png next to them. ONLY=<regex> runs matching shots.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const H = require('../tests/e2e/g2.spec.js');

const WWW = path.resolve(__dirname, '../www');
const OUT = path.resolve(process.argv[2] || path.join(__dirname, '../store/screenshots'));
const PORT = 8000 + Math.floor(Math.random() * 900), ORIGIN = 'http://127.0.0.1:' + PORT;
const VP = { width: 360, height: 640 }, DPR = 2.5; // 900 x 1600 screen inside the 1080 x 1920 frame
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2' };
const { prof, improver, club, game, done, played, NOW, DAY, PKEY, GKEY, TKEY, SANS22 } = H;
const K3D = 'suresh-chess-coach.view3d', SKEY = 'suresh-chess-coach.pieces';

function serve() {
  const srv = http.createServer((req, res) => {
    const f = path.join(WWW, path.normalize(decodeURIComponent(req.url.split('?')[0])));
    if (!f.startsWith(WWW + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(f, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(data); });
  });
  return new Promise((r) => srv.listen(PORT, '127.0.0.1', () => r(srv)));
}
function seed([keys, vals]) { if (sessionStorage.getItem('seeded')) return; keys.forEach((k, i) => { if (vals[i] != null) localStorage.setItem(k, typeof vals[i] === 'string' ? vals[i] : JSON.stringify(vals[i])); }); sessionStorage.setItem('seeded', '1'); }

let browser;
async function open(p, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: VP, deviceScaleFactor: DPR });
  await ctx.addInitScript(seed, [[PKEY, GKEY, SKEY, K3D], [p, o.game || null, o.set ? JSON.stringify(o.set) : null, o.v3d ? 'true' : null]]);
  const page = await ctx.newPage();
  page.errors = [];
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.goto(ORIGIN + '/index.html');
  await page.waitForFunction(() => window.__coach && window.Placement);
  await page.evaluate(() => document.fonts.ready);
  return page;
}
const tab = (page, t) => page.locator('#tab-' + t).click();
const wait = (page, ms) => page.waitForTimeout(ms || 400);
const top = (page) => page.evaluate(() => window.scrollTo(0, 0));
const resumeGame = async (page) => { await page.locator('#resumeHome .rs-go').click(); await H.idle(page); };

// A Beginner on day three, two Foundations units done.
const beginner = () => prof({ course: done('board', 'values'), days: played(1, 2), levelT: NOW - 3 * DAY, rating: 650 });
const pastGames = () => [
  { id: 'g1', d: NOW - 3 * DAY, r: 'W', user: 'w', level: 2, acc: 78, counts: {}, tags: { hung: 1 }, sans: SANS22.concat(['Ng3', 'Qd7']), ann: {} },
  { id: 'g2', d: NOW - 2 * DAY, r: 'L', user: 'b', level: 3, acc: 64, counts: {}, tags: { hung: 2, missedWin: 1 }, sans: ['e4', 'c5', 'Nf3', 'd6'], ann: {} },
  { id: 'g3', d: NOW - DAY, r: 'W', user: 'w', level: 3, acc: 82, counts: {}, tags: {}, sans: ['d4', 'd5', 'c4', 'e6'], ann: {} }
];
// 40 answered puzzles, most solved, so Progress has theme results.
const solved = () => Object.fromEntries(Array.from({ length: 40 }, (_, i) => ['m' + i, { n: 1, ok: i % 4 ? 1 : 0, t: NOW - (1 + i % 5) * DAY }]));

const SHOTS = [
  ['01', 'Start from zero with Rani', async () => {
    const page = await open(beginner(), { tab: 'coach' }); await wait(page, 800); return page;
  }],
  ['02', 'Short lessons in plain words', async () => {
    const page = await open(beginner(), { tab: 'path' });
    await page.evaluate(() => window.__coach.startPart('mate', 'learn')); await wait(page);
    await page.locator('#navNext').click(); await wait(page, 600); return page;
  }],
  ['03', '353 puzzles with free hints', async () => {
    const page = await open(improver({ course: done('fork', 'pin'), days: played(1, 2, 3) }), { tab: 'train' });
    await page.evaluate(() => window.__coach.trainStart('rated')); await H.idle(page); await wait(page, 600);
    await page.locator('#hintBtn').click(); await wait(page, 300); await page.locator('#hintBtn').click(); await wait(page, 800); await top(page); await wait(page); return page;
  }],
  ['04', 'Play a partner at your level', async () => {
    const page = await open(club({ games: pastGames() }), { game: game(SANS22, { level: 3 }), v3d: true });
    await resumeGame(page); await wait(page, 3000); await top(page); return page;
  }],
  ['05', 'Review every game', async () => {
    const page = await open(club({ games: pastGames() }));
    await tab(page, 'progress'); await wait(page);
    await page.locator('#history .hrow button').first().click(); await wait(page, 600);
    for (let i = 0; i < 14; i++) await page.locator('#navNext').click();
    await wait(page, 800); await top(page); return page;
  }],
  ['06', 'Pick your piece set', async () => {
    const page = await open(improver({ theme: 'heroes', days: played(1, 2, 3) }), { set: 'heroes', game: game(SANS22, { level: 2 }) });
    await resumeGame(page); await wait(page);
    await page.locator('#board .sq[data-sq="g1"]').click(); await wait(page, 600); await top(page); return page;
  }],
  ['07', 'Start at the right level', async () => {
    const page = await open(null, {}); await wait(page, 800);
    if (!(await page.evaluate(() => window.Placement.isOpen()))) await page.evaluate(() => window.__coach.openPlacement());
    await wait(page, 800); return page;
  }],
  ['08', 'See how far you have come', async () => {
    const page = await open(club({ games: pastGames(), puz: solved(), rating: 1340, course: done('board', 'values', 'mate', 'opening', 'blunder', 'fork', 'pin', 'disc', 'patterns', 'check2'), days: played(1, 2, 3, 4, 5, 6, 8, 9) }));
    await tab(page, 'progress'); await wait(page, 800); return page;
  }]
];

function frameHtml(img, caption) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;width:1080px;height:1920px;overflow:hidden}' +
    'body{background:#1f6b4a;font-family:"IBM Plex Sans",system-ui,sans-serif;display:flex;flex-direction:column;align-items:center}' +
    '.cap{height:320px;display:flex;align-items:center;justify-content:center;text-align:center;color:#fffaf0;font-family:"Bodoni Moda",Georgia,serif;font-weight:700;font-size:76px;line-height:1.1;padding:0 70px;box-sizing:border-box;width:100%}' +
    '.ph{width:900px;height:1600px;border-radius:48px 48px 0 0;overflow:hidden;box-shadow:0 0 0 10px #174f37}' +
    '.ph img{display:block;width:900px;height:1600px}' +
    '</style>' + FONTS + '</head><body><div class="cap">' + caption + '</div><div class="ph"><img src="' + img + '"></div></body></html>';
}
let FONTS = '';
function featureHtml(icon, board) {
  return '<!doctype html><html><head><meta charset="utf-8"><style>' +
    'html,body{margin:0;width:1024px;height:500px;overflow:hidden}' +
    'body{background:#1f6b4a;position:relative;font-family:"IBM Plex Sans",system-ui,sans-serif;color:#fffaf0}' +
    '.l{position:absolute;left:64px;top:0;bottom:0;width:470px;display:flex;flex-direction:column;justify-content:center}' +
    '.l img{width:132px;height:132px;border-radius:30px;box-shadow:0 6px 18px rgba(0,0,0,.25);margin-bottom:28px}' +
    'h1{margin:0;font-family:"Bodoni Moda",Georgia,serif;font-weight:700;font-size:76px;line-height:1}' +
    'p{margin:16px 0 0;font-size:34px;font-weight:500;color:#e3efe7}' +
    '.r{position:absolute;right:0;top:0;width:500px;height:500px;overflow:hidden;-webkit-mask-image:linear-gradient(90deg,transparent 0,#000 90px)}' +
    '.r img{display:block;width:500px;height:500px;object-fit:cover}' +
    '</style>' + FONTS + '</head><body><div class="l"><img src="' + icon + '"><h1>Chess Coach</h1><p>Learn with Rani</p></div><div class="r"><img src="' + board + '"></div></body></html>';
}
async function still(html, size, file) {
  const ctx = await browser.newContext({ viewport: size, deviceScaleFactor: 1 });
  const pg = await ctx.newPage();
  await pg.setContent(html, { waitUntil: 'load' });
  await pg.evaluate(() => document.fonts.ready);
  await pg.screenshot({ path: file, type: 'png' });
  await ctx.close();
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  // The frame uses the app's own fonts: the same @font-face rules the app uses (local files once bundled, else Google Fonts).
  const head = fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
  const ff = head.match(/@font-face[^}]*}/g);
  FONTS = ff ? '<base href="' + ORIGIN + '/"><style>' + ff.join('\n') + '</style>' : (head.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]*>/) || [''])[0];
  const srv = await serve();
  browser = await chromium.launch();
  let bad = 0, board = null;
  try {
    for (const [n, cap, fn] of SHOTS) {
      if (ONLY && !ONLY.test(n + ' ' + cap)) continue;
      let page;
      try {
        page = await fn();
        const raw = await page.screenshot({ type: 'png' });
        if (process.env.RAW) fs.writeFileSync(path.join(OUT, 'raw-' + n + '.png'), raw);
        if (n === '04') board = await page.screenshot({ type: 'png', clip: { x: 0, y: 108, width: 360, height: 360 } });
        await still(frameHtml('data:image/png;base64,' + raw.toString('base64'), cap), { width: 1080, height: 1920 }, path.join(OUT, n + '.png'));
        console.log('ok   ' + n + ' ' + cap + (page.errors.length ? '  page errors: ' + JSON.stringify(page.errors) : ''));
        if (page.errors.length) bad++;
      } catch (e) { bad++; console.log('FAIL ' + n + ' ' + cap + ': ' + String(e.message).split('\n')[0]); }
      finally { if (page) await page.context().close(); }
    }
    const up = path.dirname(OUT), icon = fs.readFileSync(path.join(__dirname, '../assets/icon.png'));
    // The icon: the app's own 1024 x 1024 icon at 512 x 512.
    await still('<!doctype html><style>html,body{margin:0}img{display:block;width:512px;height:512px}</style><img src="data:image/png;base64,' + icon.toString('base64') + '">', { width: 512, height: 512 }, path.join(up, 'icon-512.png'));
    console.log('ok   icon-512.png');
    if (board) { await still(featureHtml('data:image/png;base64,' + icon.toString('base64'), 'data:image/png;base64,' + board.toString('base64')), { width: 1024, height: 500 }, path.join(up, 'feature-graphic.png')); console.log('ok   feature-graphic.png'); }
  } finally { await browser.close(); srv.close(); }
  process.exit(bad ? 1 : 0);
})();
