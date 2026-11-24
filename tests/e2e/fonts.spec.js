// E2E for P-D11 (docs/specs/play-listing.product.md): the fonts are bundled inside the app. The page loads Bodoni Moda,
// IBM Plex Sans, IBM Plex Mono and Noto Sans Symbols 2 from its own www/fonts/ files, and no request ever goes to any host
// other than the local server (every other request is blocked and recorded).
// Run: FONTS_VP=412 node tests/e2e/fonts.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// FONTS_VP: 360 | 412 | 1280. FONTS_SHOTS=<dir> saves a screenshot of Home and Play.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const assert = require('assert/strict');
const path = require('path');
const G = require('./g2.spec.js'); // profiles and keys only; this file has its own server and page, with no font stubs

const WWW = path.resolve(process.env.FONTS_WWW || path.join(__dirname, '../../www'));
const PORT = 8000 + Math.floor(Math.random() * 900);
const ORIGIN = 'http://127.0.0.1:' + PORT;
const SHOTS = process.env.FONTS_SHOTS || '';
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }].filter((v) => !process.env.FONTS_VP || String(v.width) === process.env.FONTS_VP);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.woff2': 'font/woff2', '.glb': 'model/gltf-binary', '.json': 'application/json' };

let browser;
async function open(vp, tab, game) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.errors = []; page.outside = []; page.local = [];
  // Only the local server may answer: anything else is recorded and blocked.
  await ctx.route('**/*', (r) => {
    const u = r.request().url();
    if (u.startsWith(ORIGIN + '/') || /^(data|blob|about):/.test(u)) { page.local.push(u); return r.continue(); }
    page.outside.push(u); return r.abort('blockedbyclient');
  });
  await ctx.addInitScript(([pk, p, gk, g, tk, t]) => {
    if (sessionStorage.getItem('seeded')) return;
    localStorage.setItem(pk, JSON.stringify(p)); if (g) localStorage.setItem(gk, JSON.stringify(g)); localStorage.setItem(tk, JSON.stringify(t));
    sessionStorage.setItem('seeded', '1');
  }, [G.PKEY, G.club(), G.GKEY, game || null, G.TKEY, tab]);
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message|WebGL context was lost/.test(m.text())) page.errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.goto(ORIGIN + '/index.html');
  await page.waitForFunction(() => window.__coach && window.Placement);
  await page.evaluate(() => document.fonts.ready);
  return page;
}

// Loads one font for the given text, then reports: the faces of that family that are loaded, whether document.fonts.check
// agrees, and whether the text is drawn with the font: the same width behind either fallback, and not the width of a fallback.
const probe = (page, font, text) => page.evaluate(async ([font, text]) => {
  await document.fonts.load(font, text);
  const fam = /"([^"]+)"/.exec(font)[1];
  const c = document.createElement('canvas').getContext('2d'), w = (f) => { c.font = f; return c.measureText(text).width; };
  const a = w(font + ', monospace'), b = w(font + ', serif'), m = w(font.replace(/"[^"]+"/, 'monospace')), s = w(font.replace(/"[^"]+"/, 'serif'));
  return { check: document.fonts.check(font, text), loaded: [...document.fonts].filter((f) => f.family.replace(/"/g, '') === fam && f.status === 'loaded').map((f) => f.weight),
    drawn: Math.abs(a - b) < 0.01 && (Math.abs(a - m) > 0.5 || Math.abs(a - s) > 0.5) };
}, [font, text]);

const FONTS = [
  ['16px "IBM Plex Sans"', 'Your move'], ['500 16px "IBM Plex Sans"', 'Resume game'], ['600 17px "IBM Plex Sans"', 'Keep practising'],
  ['700 30px "Bodoni Moda"', 'Chess Coach'], ['500 30px "Bodoni Moda"', 'Chess Coach'],
  ['12px "IBM Plex Mono"', 'Nf3 e5 1300'], ['500 12px "IBM Plex Mono"', 'Nf3 e5 1300'],
  ['30px "Noto Sans Symbols 2"', '♚♛♜♝♞♟♔♙']
];

const cases = [
  ['every font loads from the app\'s own files and draws its text', async (vp) => {
    const page = await open(vp, 'coach');
    for (const [font, text] of FONTS) {
      const r = await probe(page, font, text);
      assert.ok(r.check, 'document.fonts.check(' + font + ')');
      assert.ok(r.loaded.length > 0, font + ' has a loaded face');
      assert.ok(r.drawn, font + ' draws "' + text + '" with the font, not a fallback');
    }
    const files = page.local.filter((u) => /\.woff2$/.test(u)).map((u) => u.slice(ORIGIN.length + 1)).sort();
    for (const d of ['bodoni-moda', 'ibm-plex-sans', 'ibm-plex-mono', 'noto-sans-symbols-2']) assert.ok(files.some((f) => f.startsWith('fonts/' + d + '/')), 'a ' + d + ' file came from the local server: ' + files);
    // The piece glyphs on the board are drawn in Noto Sans Symbols 2 from the symbols file.
    assert.ok(files.includes('fonts/noto-sans-symbols-2/noto-sans-symbols-2-symbols.woff2'), 'the chess glyph file was loaded');
    return page;
  }],
  ['a game on the board: pieces, move list and headings, still nothing from another host', async (vp) => {
    const page = await open(vp, 'play', G.GAME12);
    await page.waitForTimeout(800);
    await page.evaluate(() => document.fonts.ready);
    const used = await page.evaluate(() => {
      const pc = document.querySelector('#board .pc'), h = document.querySelector('h1');
      return { pc: pc && getComputedStyle(pc).fontFamily, h1: h && getComputedStyle(h).fontFamily, pcText: pc && pc.textContent };
    });
    assert.match(used.pc || '', /^"Noto Sans Symbols 2"/, 'board pieces use Noto Sans Symbols 2');
    const r = await probe(page, '30px "Noto Sans Symbols 2"', used.pcText.replace(/︎/g, ''));
    assert.ok(r.drawn, 'the board piece glyph is drawn from the bundled font');
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'fonts-' + vp.width + '-play.png') });
    return page;
  }],
  ['Home screenshot (fonts settled)', async (vp) => {
    const page = await open(vp, 'coach');
    await page.waitForTimeout(800);
    await page.evaluate(() => document.fonts.ready);
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'fonts-' + vp.width + '-home.png') });
    return page;
  }]
];

(async () => {
  const srv = http.createServer((req, res) => {
    const f = path.join(WWW, path.normalize(decodeURIComponent(req.url.split('?')[0])));
    if (!f.startsWith(WWW + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(data);
    });
  });
  await new Promise((r) => srv.listen(PORT, '127.0.0.1', r));
  browser = await chromium.launch();
  const results = []; let failures = 0;
  try {
    for (const vp of VIEWPORTS) for (const [name, fn] of cases) {
      const label = vp.width + 'x' + vp.height + ' ' + name; let page;
      try {
        page = await fn(vp);
        assert.deepEqual(page.outside, [], 'no request goes to any host other than the local server');
        assert.deepEqual(page.errors, [], 'console errors or warnings');
        results.push('ok   ' + label);
      } catch (e) { failures++; results.push('FAIL ' + label + '\n     ' + String(e && e.message || e).split('\n').slice(0, 8).join('\n     ')); }
      finally { if (page) await page.context().close(); }
    }
  } finally { await browser.close(); srv.close(); }
  console.log(results.join('\n'));
  console.log('\n' + (results.length - failures) + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})();
