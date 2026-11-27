// E2E for slice G2d (docs/specs/board-screens.product.md, G-D32 to G-D34):
//   G-D32  a phone held sideways (up to 860px wide, under 500px high): the board on the left, filling the height under the
//          Close bar; everything else in a column on its right that scrolls while the board stays put.
//   G-D33  a player who never chose pieces or a view starts with the classic pieces on the flat board.
//   G-D34  the name on screen is "Chess Coach".
// Run: G2D_VP=844 node tests/e2e/g2d.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// G2D_VP (the width): 568 | 780 | 844 | 860 | 915 (sideways phones; 915x412 since G-D41), 1280 (wide: unchanged), 360 | 412 (upright: unchanged).
// G2D_SHOTS=<dir> saves screenshots. G2D_ONLY=<regex> runs matching cases.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const assert = require('assert/strict');
const path = require('path');

const WWW = path.resolve(process.env.G2D_WWW || path.join(__dirname, '../../www'));
const PORT = 9000 + Math.floor(Math.random() * 900);
const ORIGIN = 'http://127.0.0.1:' + PORT;
const URL = ORIGIN + '/index.html';
const SHOTS = process.env.G2D_SHOTS || '';
const PKEY = 'suresh-chess-coach.profile.v1', GKEY = 'suresh-chess-coach.v1', TKEY = 'suresh-chess-coach.tab', SKEY = 'suresh-chess-coach.pieces', K3D = 'suresh-chess-coach.view3d';
const ALL = [{ width: 568, height: 320 }, { width: 780, height: 360 }, { width: 844, height: 390 }, { width: 860, height: 400 }, { width: 915, height: 412 }, { width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }];
const VIEWPORTS = ALL.filter((v) => !process.env.G2D_VP || String(v.width) === process.env.G2D_VP);
const ONLY = process.env.G2D_ONLY ? new RegExp(process.env.G2D_ONLY) : null;
const NOW = Date.now(), DAY = 86400000;
const PH = (vp) => vp.width <= 860 || vp.height < 500;  // the one-column layout: the board screen exists (G-D41)
const SIDE = (vp) => vp.height < 500;                   // G-D32, widened by G-D41: a phone held sideways, whatever its width
// The board, the buttons and the eval strip as they were before G2d (measured on main 415dd04, a Club player's game, flat
// board, [left, top, width, height]). "Upright phones and anything wider than 860px must not change at all."
const BEFORE = {
  '360x800': { board: [0, 108, 360, 360], evalbar: [0, 103, 360, 5], ctl: [16, 516, 328, 86], bar: [0, 0, 360, 57] },
  '412x915': { board: [0, 108, 412, 412], evalbar: [0, 103, 412, 5], ctl: [16, 568, 380, 39], bar: [0, 0, 412, 57] },
  '1280x900': { board: [148, 195.5, 578, 578], evalbar: [126, 195.5, 14, 578], ctl: [126, 825.5, 600, 39], bar: null }
};

let browser, results = [], failures = 0;

const dkey = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const played = (...backs) => Object.fromEntries(backs.map((b) => [dkey(b), { puz: 0, games: 1, course: 0, solved: 0 }]));
function prof(o) {
  return Object.assign({ v: 5, level: 'club', levelT: NOW - 4 * DAY, placed: 'check', start: 'kq', rating: 1300, rn: 0, games: [], puz: {}, course: {}, days: played(1, 2, 3, 4), reviewed: [], t: NOW - DAY, theme: null, showAll: false, unlockAll: false, provisional: false, pgsDeclined: true, levelOfferT: 0 }, o);
}
const game = (sans, o) => Object.assign({ sans, user: 'w', level: 1, ann: {}, notes: {}, tags: {}, fb: null, opp: null, evalW: 0, flipped: false, recorded: false, goal: null, t: NOW - 60000 }, o);
const GAME = game(['e4', 'e5', 'Nf3', 'Nc6']);
// 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6: White mates with Qxf7.
const MATE1 = game(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6']);

function seedFn([pk, p, gk, g, tk, tab, sk, set, k3, v3d]) {
  if (sessionStorage.getItem('seeded')) return;
  if (p) localStorage.setItem(pk, JSON.stringify(p));
  if (g) localStorage.setItem(gk, JSON.stringify(g));
  if (tab) localStorage.setItem(tk, JSON.stringify(tab));
  if (set) localStorage.setItem(sk, JSON.stringify(set));
  if (v3d) localStorage.setItem(k3, 'true');
  sessionStorage.setItem('seeded', '1');
}
// A small fake of the native ads plugin (as in g2.spec.js): enough to see when a banner is on screen.
function fakeAds() {
  const A = window.__ad = { calls: [], ls: {}, view: false, visible: false, loaded: false };
  Object.defineProperty(A, 'shown', { get() { return A.view && A.visible && A.loaded; } });
  const fire = (n, d) => (A.ls[n] || []).slice().forEach((f) => f(d));
  const size = (on) => fire('bannerAdSizeChanged', on ? { width: window.innerWidth, height: 64 } : { width: 0, height: 0 });
  const info = () => ({ status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' });
  const P = {
    addListener(n, f) { (A.ls[n] = A.ls[n] || []).push(f); return Promise.resolve({ remove() {} }); },
    requestConsentInfo() { return Promise.resolve(info()); }, showConsentForm() { return Promise.resolve(info()); }, showPrivacyOptionsForm() { return Promise.resolve(); }, initialize() { return Promise.resolve(); },
    showBanner() { A.calls.push('showBanner'); if (A.view) return Promise.resolve(); A.view = true; A.visible = true; A.loaded = false; setTimeout(() => { if (!A.view) return; A.loaded = true; size(true); fire('bannerAdLoaded', {}); }, 30); return Promise.resolve(); },
    hideBanner() { if (!A.view) return Promise.reject(new Error('never shown')); A.visible = false; setTimeout(() => size(false), 0); return Promise.resolve(); },
    resumeBanner() { if (A.view) setTimeout(() => { A.visible = true; size(true); }, 0); return Promise.resolve(); },
    removeBanner() { A.view = false; A.visible = false; A.loaded = false; setTimeout(() => size(false), 0); return Promise.resolve(); }
  };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { AdMob: P } };
}
// o: { game, tab, set, v3d, ads (true: the fake ads plugin) }. p: the saved profile, or null for an install with nothing saved at all.
async function newPage(vp, p, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.addInitScript(seedFn, [PKEY, p, GKEY, o.game || null, TKEY, o.tab || null, SKEY, o.set || null, K3D, !!o.v3d]);
  if (o.ads) await ctx.addInitScript(fakeAds);
  const page = await ctx.newPage();
  page.errors = []; page.outside = []; page.dialogs = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message|WebGL context was lost|THREE\.WebGLRenderer: Context (Lost|Restored)/.test(m.text())) page.errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('dialog', (d) => { page.dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ORIGIN + '/') && !/^(data|blob|about):/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u)) page.outside.push(u); });
  await page.goto(URL);
  try { await page.waitForFunction(() => window.__coach && window.Placement); }
  catch (e) { throw new Error('app did not start: ' + e.message.split('\n')[0] + ' | page errors: ' + JSON.stringify(page.errors)); }
  return page;
}
const shot = async (page, name) => { if (!SHOTS) return; await page.waitForTimeout(400); const v = page.viewportSize(); await page.screenshot({ path: path.join(SHOTS, v.width + 'x' + v.height + '_' + name + '.png') }); };
const st = (page, k) => page.evaluate((key) => window.__coach.st[key], k);
// Every box in one synchronous step: { l, t, r, b, w, h } or null when the element is not drawn.
const boxes = (page, map) => page.evaluate((m) => {
  const out = {};
  for (const k in m) { const e = document.querySelector(m[k]); if (!e || !e.getClientRects().length) { out[k] = null; continue; } const r = e.getBoundingClientRect(); out[k] = { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }
  const de = document.documentElement;
  out.page = { vw: window.innerWidth, vh: window.innerHeight, scrollY: window.scrollY, scrollW: de.scrollWidth, scrollH: de.scrollHeight, scr: de.dataset.scr || null, end: de.dataset.scrend || null, tab: window.__coach.st.tab };
  return out;
}, map);
const arr = (b) => b && [b.l, b.t, b.w, b.h].map((x) => Math.round(x * 10) / 10);
const BASE = { board: '#board', bar: '#actBar', header: 'header', tabs: '.tabs', evalbar: '#evalbar', opp: '.boardcol .player', you: '.boardcol .player ~ .player', ctl: '#playControls', nav: '#navControls', coach: '#coach', moves: '#movesCard', think: '#thinkCard',
  gameEnd: '#gameEnd', lesson: '#unitView .lessoncard', session: '#sessionCard', strip: '#coachStrip', close: '#actClose' };
const idle = (page) => page.waitForFunction(() => !window.__coach.st.busy, null, { timeout: 30000 });
// The board screen with the saved game on it (a phone opens on Home; a wide screen already shows the board).
async function toGame(page, vp) {
  if (!PH(vp)) return;
  await page.locator('#tab-play').click();
  await page.locator('#resumePlay .rs-go').click();
  await page.waitForFunction(() => document.documentElement.dataset.scr === 'act');
}
const wait3d = (page) => page.waitForFunction(() => { const b = document.getElementById('v3dBtn'); return /2D view/.test(b.textContent) && !document.querySelector('.b3d.loading') && window.Board3D && window.Board3D.debug && window.Board3D.debug.ready(); }, null, { timeout: 30000 });
// The 3D picture: its box on screen, its drawing buffer, and whether it is still the canvas of the first look.
const canvas3d = (page) => page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => {
  const cv = document.querySelector('#board .b3dcanvas'), r = cv.getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect();
  res({ w: r.width, h: r.height, l: r.left, t: r.top, bw: cv.width, bh: cv.height, board: { w: b.width, h: b.height, l: b.left, t: b.top }, same: window.__cv ? cv === window.__cv : null, lost: (cv.getContext('webgl2') || cv.getContext('webgl')).isContextLost(), ready: window.Board3D.debug.ready() });
}))));

// G-D32, measured: the board on the left under the Close bar, as tall as the screen allows, and nothing beside it hidden by it.
async function sideways(page, vp, what, right) {
  const B = await boxes(page, BASE), tag = vp.width + 'x' + vp.height + ' ' + what + ': ';
  assert.ok(B.board && B.bar, tag + 'the board and the Close bar are on screen');
  assert.equal(B.header, null, tag + 'no header');
  assert.ok(Math.abs(B.board.w - B.board.h) < 0.6, tag + 'the board is square ' + arr(B.board));
  assert.ok(B.bar.t === 0 && B.board.t >= B.bar.b, tag + 'the board starts under the Close bar ' + arr(B.board));
  assert.ok(B.board.b <= B.page.vh + 0.5, tag + 'the whole board is on screen ' + arr(B.board));
  assert.ok(B.board.l >= 0 && B.board.l <= 40, tag + 'the board is on the left ' + arr(B.board));
  assert.ok(B.board.w <= 0.6 * B.page.vw + 0.5, tag + 'never wider than 60 percent of the screen');
  const fill = Math.min(B.page.vh - B.bar.b - 16, 0.6 * B.page.vw);
  assert.ok(B.board.w >= fill - 0.5, tag + 'the board fills the height under the bar: ' + B.board.w + ' of ' + (B.page.vh - B.bar.b));
  assert.ok(B.close.w >= 44 && B.close.h >= 44, tag + 'Close is still 44px');
  for (const k of right) {
    assert.ok(B[k], tag + k + ' is on the page');
    assert.ok(B[k].l >= B.board.r, tag + k + ' is in the column on the right of the board ' + arr(B[k]) + ' vs board right ' + B.board.r);
    assert.ok(B[k].r <= B.page.vw + 0.5 && B[k].w >= 150, tag + k + ' fits the column ' + arr(B[k]));
  }
  assert.ok(B.page.scrollW <= B.page.vw, tag + 'no sideways scroll');
  return B;
}
// The right column scrolls (the page under the sticky bar); the board and the bar stay where they are.
async function staysPut(page, vp, what, mover) {
  const tag = vp.width + 'x' + vp.height + ' ' + what + ': ', A = await boxes(page, BASE);
  assert.ok(A.page.scrollH > A.page.vh + 40, tag + 'there is something to scroll to');
  const by = Math.min(160, A.page.scrollH - A.page.vh);
  await page.evaluate((y) => window.scrollTo(0, y), by);
  const Z = await boxes(page, BASE);
  assert.equal(Z.page.scrollY, by);
  assert.deepEqual(arr(Z.board), arr(A.board), tag + 'the board stays put while the column scrolls');
  assert.deepEqual(arr(Z.bar), arr(A.bar), tag + 'the Close bar stays put');
  assert.ok(Math.abs((A[mover].t - Z[mover].t) - by) < 1, tag + 'the column moved by the scroll');
  await page.evaluate(() => window.scrollTo(0, 0));
}

const cases = [
  // ---------- G-D32 ----------
  ['G-D32 game: sideways the board is on the left under the Close bar and everything else is in a scrolling column on its right; other sizes are as before', async (vp) => {
    const page = await newPage(vp, prof(), { game: GAME, tab: 'play' });
    await toGame(page, vp); await idle(page);
    if (!SIDE(vp)) {
      const B = await boxes(page, BASE), was = BEFORE[vp.width + 'x' + vp.height];
      for (const k of ['board', 'evalbar', 'ctl', 'bar']) assert.deepEqual(arr(B[k]), was[k], vp.width + 'x' + vp.height + ' ' + k + ' is where it was before G2d');
      assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('board')).position), 'relative', 'the board is in the page flow');
      await shot(page, 'game_flat');
      return page;
    }
    const B = await sideways(page, vp, 'game', ['opp', 'you', 'ctl', 'coach', 'think', 'moves', 'evalbar']);
    if (vp.width === 844) assert.ok(B.board.w >= 320, '844x390: the board was 272px, now ' + B.board.w);
    assert.ok(B.evalbar.h <= 8 && B.evalbar.w > 150, 'the eval strip is a thin strip in the column ' + arr(B.evalbar));
    assert.ok(B.opp.t < B.you.t && B.you.t < B.ctl.t && B.ctl.t < B.coach.t, 'the opponent line, the You line, the buttons, then Rani’s card');
    await staysPut(page, vp, 'game', 'ctl');
    // a move still lands on the square that was tapped
    await page.locator('#board .sq[data-sq="d2"]').click(); await page.locator('#board .sq[data-sq="d4"]').click();
    await page.waitForFunction(() => window.__coach.hist().length >= 5);
    await idle(page);
    await sideways(page, vp, 'game after a move', ['opp', 'you', 'ctl', 'coach']);
    await shot(page, 'sideways_game_flat');
    // the name line of a tapped themed piece is in the column too
    await page.locator('#actGear').click(); await page.locator('#lookSet [data-set="heroes"]').click(); await page.locator('[data-act="settingsclose"]').click();
    await page.locator('#board .sq[data-sq="b1"]').click();
    const N = await boxes(page, { board: '#board', line: '#pieceLine' });
    assert.ok(N.line && N.line.l >= N.board.r, 'the piece name line is on the right of the board ');
    return page;
  }],
  ['G-D32 turning the phone: flat and 3D boards follow the screen both ways, the 3D picture is resized, not rebuilt', async (vp) => {
    if (!PH(vp)) { const page = await newPage(vp, prof(), { game: GAME, tab: 'play' }); return page; }
    // from a sideways size: upright and back. From an upright size: sideways (844x390) and back.
    const other = SIDE(vp) ? { width: vp.height, height: vp.width } : { width: 844, height: 390 };
    const upright = (size) => size.height > size.width;
    const check = async (page, size, what, threeD) => {
      await page.waitForFunction((w) => window.innerWidth === w, size.width);
      if (upright(size)) {
        const B = await boxes(page, BASE);
        assert.deepEqual([B.board.l, B.board.w, B.board.h], [0, size.width, size.width], what + ': upright, the board is edge to edge again');
        assert.ok(B.ctl.t >= B.board.b && B.ctl.l < 40, what + ': the buttons are under the board');
      } else await sideways(page, size, what, ['opp', 'you', 'ctl']);
      if (!threeD) return;
      await page.waitForFunction(() => { const cv = document.querySelector('#board .b3dcanvas'), b = document.getElementById('board').getBoundingClientRect(); return cv && Math.abs(cv.width - Math.round(b.width)) <= 1; }, null, { timeout: 5000 }).catch(() => {});
      const C = await canvas3d(page);
      assert.equal(C.same, true, what + ': the same canvas (no rebuild)');
      assert.equal(C.lost, false, what + ': the WebGL context is alive');
      assert.equal(C.ready, true, what + ': the position is drawn');
      assert.ok(Math.abs(C.w - C.board.w) < 1 && Math.abs(C.h - C.board.h) < 1 && Math.abs(C.l - C.board.l) < 1 && Math.abs(C.t - C.board.t) < 1, what + ': the picture covers the board ' + JSON.stringify(C));
      assert.ok(Math.abs(C.bw - Math.round(C.board.w)) <= 1 && Math.abs(C.bh - Math.round(C.board.h)) <= 1, what + ': the drawing is sized for the board, not stretched ' + JSON.stringify(C));
    };
    let page = await newPage(vp, prof(), { game: GAME, tab: 'play' });
    await toGame(page, vp); await idle(page);
    await page.setViewportSize(other); await check(page, other, 'flat, turned', false);
    await page.setViewportSize(vp); await check(page, vp, 'flat, turned back', false);
    await page.context().close();
    page = await newPage(vp, prof(), { game: GAME, tab: 'play', v3d: true });
    await toGame(page, vp); await wait3d(page); await idle(page);
    await page.evaluate(() => { window.__cv = document.querySelector('#board .b3dcanvas'); });
    await check(page, vp, '3D', true);
    if (SIDE(vp)) await shot(page, 'sideways_game_3d');
    await page.setViewportSize(other); await check(page, other, '3D, turned', true);
    if (!SIDE(vp)) await shot(page, 'sideways_game_3d_after_turn');
    await page.setViewportSize(vp); await check(page, vp, '3D, turned back', true);
    // a tap on the 3D board still plays the move it points at
    return page;
  }],
  ['G-D32 lesson and puzzle: the step card and the puzzle card are in the right column; the board stays put', async (vp) => {
    const page = await newPage(vp, prof(), { tab: 'coach' });
    if (!SIDE(vp)) return page;
    await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    let B = await sideways(page, vp, 'lesson', ['lesson', 'nav']);
    assert.ok(B.nav.t < B.page.vh, 'Prev and Next are on the first screen');
    await shot(page, 'sideways_lesson');
    await page.locator('#navNext').click();
    await sideways(page, vp, 'lesson, step 2', ['lesson', 'nav']);
    await page.locator('#actClose').click();
    assert.equal((await boxes(page, BASE)).board, null, 'Close: the tab page, no board');
    await page.evaluate(() => window.__coach.trainStart('rated'));
    await page.waitForFunction(() => window.__coach.st.mode === 'puzzle' && window.__coach.st.pz);
    B = await sideways(page, vp, 'puzzle', ['session', 'ctl']);
    assert.ok(B.session.t < B.page.vh, 'the puzzle card starts on the first screen');
    await shot(page, 'sideways_puzzle');
    return page;
  }],
  ['G-D32 end card: it is in the right column, on screen, and the tabs are back and can be tapped', async (vp) => {
    const page = await newPage(vp, prof(), { game: MATE1, tab: 'play' });
    if (!SIDE(vp)) return page;
    await toGame(page, vp); await idle(page);
    await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => { const e = document.getElementById('gameEnd'); return e && !e.hidden && document.documentElement.dataset.scrend; });
    await page.waitForTimeout(900); // the card's own scroll into view
    const B = await sideways(page, vp, 'end card', ['gameEnd', 'tabs']);
    assert.equal(B.page.end, '1', 'G-D8: an end card brings the tabs back');
    const btn = await boxes(page, { main: '#gameEnd .ec-main', board: '#board', tabs: '.tabs' });
    assert.ok(btn.main && btn.main.t >= B.bar.b - 0.5 && btn.main.b <= B.page.vh + 0.5, 'the end card’s main button is on screen ' + arr(btn.main));
    assert.ok(btn.main.h >= 44, 'and 44px high');
    await shot(page, 'sideways_end_card');
    // the tabs can be reached (by scrolling the column if they are not on screen) and work
    await page.locator('#tab-coach').scrollIntoViewIfNeeded();
    const T = await boxes(page, { tab: '#tab-coach', board: '#board', bar: '#actBar' });
    assert.ok(T.tab.l >= T.board.r && T.tab.b <= B.page.vh + 0.5 && (T.tab.t >= T.bar.b - 0.5 || T.tab.t >= T.bar.b - 0.5), 'the Home tab is on screen beside the board, not under the bar ' + arr(T.tab));
    assert.ok(T.tab.h >= 44, 'a tab is 44px high');
    await page.locator('#tab-coach').click();
    const Z = await boxes(page, BASE);
    assert.equal(Z.page.scr, null, 'a tab tap leaves the board screen');
    assert.equal(Z.page.tab, 'coach');
    assert.equal(Z.board, null);
    assert.ok(Z.tabs && Z.header, 'the tab page: header and tabs');
    return page;
  }],
  // ---------- fix round 1 ----------
  ['Fix 1: the sideways layout is for screens under 500px high only; at exactly 500px (where a banner is allowed) the board is not pinned', async (vp) => {
    if (vp.width !== 780) return newPage(vp, prof(), {});
    const mate = async (size) => {
      const page = await newPage(size, prof(), { game: MATE1, tab: 'play', ads: true });
      await toGame(page, size); await idle(page);
      const pos = await page.evaluate(() => getComputedStyle(document.getElementById('board')).position);
      await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
      await page.waitForFunction(() => { const e = document.getElementById('gameEnd'); return e && !e.hidden && document.documentElement.dataset.scrend; });
      await page.waitForTimeout(2500); // the banner's one second, and its load
      const R = await page.evaluate(() => { const p = document.getElementById('adPad'); return { shown: window.__ad.shown, asked: window.__ad.calls.length, pad: !p.hidden && p.getBoundingClientRect().height > 0, room: window.__coach.ads().h }; });
      return { page, pos, R };
    };
    const low = await mate({ width: 780, height: 499 });
    assert.equal(low.pos, 'fixed', '780x499: sideways, the board is pinned');
    await sideways(low.page, { width: 780, height: 499 }, 'end card at 499', ['gameEnd']);
    assert.deepEqual(low.R, { shown: false, asked: 0, pad: false, room: 0 }, '780x499: no banner, and no room kept for one');
    assert.deepEqual(low.page.errors, []);
    await low.page.context().close();
    const at = await mate({ width: 780, height: 500 });
    assert.equal(at.pos, 'relative', '780x500: the upright layout, the board is in the page and nothing is pinned');
    assert.equal(at.R.shown, true, '780x500: the banner is allowed on the end card (A-D4), and no pinned board is under it');
    assert.equal(await at.page.evaluate(() => getComputedStyle(document.getElementById('board')).position), 'relative');
    return at.page;
  }],
  ['Fix 2: turning the phone upright with the column scrolled starts the upright board screen at the top', async (vp) => {
    const page = await newPage(vp, prof(), { game: GAME, tab: 'play' });
    if (!SIDE(vp)) return page;
    await toGame(page, vp); await idle(page);
    await page.evaluate(() => window.scrollTo(0, 400));
    assert.ok(await page.evaluate(() => window.scrollY) > 100, 'the column is scrolled');
    await page.setViewportSize({ width: vp.height, height: vp.width });
    await page.waitForFunction((w) => window.innerWidth === w, vp.height);
    await page.waitForTimeout(300);
    const B = await boxes(page, BASE);
    assert.equal(B.page.scrollY, 0, 'upright: the page is back at the top');
    assert.ok(B.board.t >= B.bar.b && B.board.b <= B.page.vh, 'the whole board is on screen under the Close bar ' + arr(B.board));
    // the other way keeps the player's place: upright scrolled, then sideways, the board is pinned and on screen anyway
    await page.evaluate(() => window.scrollTo(0, 300));
    await page.setViewportSize(vp); await page.waitForFunction((w) => window.innerWidth === w, vp.width);
    await sideways(page, vp, 'turned sideways from a scrolled page', ['ctl']);
    return page;
  }],
  // ---------- G-D33 ----------
  ['G-D33 first time: nothing saved means the classic pieces on the flat board; Rani is still the coach; a saved choice is kept', async (vp) => {
    // 1. an install with nothing saved at all
    let page = await newPage(vp, null, {});
    await page.waitForFunction(() => window.Placement.isOpen());
    assert.ok(await page.evaluate(() => !!document.querySelector('#placement .pl-hero canvas, #placement .pl-hero svg')), 'Rani greets the player on the first screen');
    assert.match(await page.evaluate(() => document.querySelector('#placement').innerText), /Rani/);
    await shot(page, 'fresh_first_screen');
    await page.locator('[data-pl="skip0"]').click();
    await page.waitForFunction(() => !window.Placement.isOpen());
    await shot(page, 'fresh_home');
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), SKEY), null, 'no pieces were ever chosen');
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), K3D), null, 'no view was ever chosen');
    assert.equal(await page.evaluate(() => window.__coach.getProf().theme), null);
    // the first board the player sees
    if (PH(vp)) { await page.evaluate(() => document.getElementById('newBtn').click()); await page.waitForFunction(() => document.documentElement.dataset.scr === 'act'); }
    const first = await page.evaluate(() => {
      const b = document.getElementById('board'), pcs = [...b.querySelectorAll('.sq .pc')].filter((e) => e.innerHTML !== '');
      return { theme: window.__coach.st.theme, v3d: !!window.__coach.st.v3d, is3d: b.classList.contains('is3d'), canvas: !!b.querySelector('canvas'), drawn: b.getClientRects().length > 0, pieces: pcs.length, themed: b.querySelectorAll('.pc.themed, .pc svg').length, glyphs: pcs.filter((e) => !e.children.length).length,
        btn: document.getElementById('v3dBtn').textContent, pressed: document.getElementById('v3dBtn').getAttribute('aria-pressed') };
    });
    assert.deepEqual(first, { theme: 'classic', v3d: false, is3d: false, canvas: false, drawn: true, pieces: 32, themed: 0, glyphs: 32, btn: '3D view', pressed: 'false' }, 'the first board: classic pieces, flat');
    await shot(page, 'fresh_first_board');
    // Settings still offers the themed sets and shows Classic as the one in use
    await page.evaluate(() => window.__coach.openSettings());
    const sets = await page.evaluate(() => [...document.querySelectorAll('#lookSet [data-set]')].map((b) => [b.dataset.set, b.getAttribute('aria-pressed')]));
    assert.ok(sets.length >= 3 && sets.some((s) => s[0] === 'ramayana') && sets.some((s) => s[0] === 'heroes'), 'the themed sets stay in Settings ' + JSON.stringify(sets));
    assert.deepEqual(sets.filter((s) => s[1] === 'true').map((s) => s[0]), ['classic'], 'Classic is the set in use');
    assert.ok(await page.evaluate(() => !!document.querySelector('#lookSet canvas.q3d, #lookSet .coachpick, #lookSet [data-coach]')), 'the coach choice is still there');
    await page.context().close();
    // 2. a player who chose a themed set and the 3D view keeps both
    page = await newPage(vp, prof({ theme: 'ramayana' }), { game: GAME, tab: 'play', set: 'ramayana', v3d: true });
    await toGame(page, vp); await wait3d(page);
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.theme, window.__coach.st.v3d, document.getElementById('board').classList.contains('is3d')]), ['ramayana', true, true], 'a saved choice is kept');
    await page.context().close();
    // 3. a chosen set that only the profile remembers (a restored save) is kept too; the view stays flat without a saved yes
    page = await newPage(vp, prof({ theme: 'heroes' }), { game: GAME, tab: 'play' });
    await toGame(page, vp);
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.theme, !!window.__coach.st.v3d, document.querySelectorAll('#board .pc.themed').length === 32]), ['heroes', false, true], 'the profile’s set is used');
    await page.context().close();
    // 4. Classic, chosen, is not overruled by an older themed choice in the profile
    page = await newPage(vp, prof({ theme: 'heroes' }), { game: GAME, tab: 'play', set: 'classic' });
    await toGame(page, vp);
    assert.equal(await st(page, 'theme'), 'classic');
    return page;
  }],
  // ---------- G-D34 ----------
  ['G-D34 the name: the header and the page title read "Chess Coach"; saved data keeps its keys', async (vp) => {
    const page = await newPage(vp, prof(), { game: GAME, tab: 'coach' });
    assert.equal(await page.title(), 'Chess Coach');
    assert.equal(await page.evaluate(() => document.querySelector('header h1').textContent), 'Chess Coach');
    assert.ok(await page.evaluate(() => document.querySelector('header h1').getClientRects().length > 0), 'the header is on screen on Home');
    for (const t of ['coach', 'path', 'train', 'play', 'progress']) {
      await page.locator('#tab-' + t).click();
      assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /Suresh/, t + ': the old name is nowhere on the page');
    }
    await page.evaluate(() => window.__coach.openSettings());
    assert.doesNotMatch(await page.evaluate(() => document.body.innerText), /Suresh/, 'Settings');
    const keys = await page.evaluate(() => Object.keys(localStorage));
    assert.ok(keys.length >= 3 && keys.every((k) => k.startsWith('suresh-chess-coach.')), 'saved data keeps its keys ' + keys);
    assert.deepEqual(await page.evaluate((k) => JSON.parse(localStorage.getItem(k)).sans, GKEY), GAME.sans, 'the saved game is untouched');
    await page.evaluate(() => document.querySelector('[data-act="settingsclose"]').click());
    await page.locator('#tab-coach').click();
    await shot(page, 'header_name');
    return page;
  }]
];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream' };
function serve() {
  const srv = http.createServer((req, res) => {
    const f = path.join(WWW, path.normalize(decodeURIComponent(req.url.split('?')[0])));
    if (!f.startsWith(WWW + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(data);
    });
  });
  return new Promise((r) => srv.listen(PORT, '127.0.0.1', () => r(srv)));
}

(async () => {
  const srv = await serve();
  browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) for (const [name, fn] of cases) {
      if (ONLY && !ONLY.test(name)) continue;
      const label = vp.width + 'x' + vp.height + ' ' + name;
      let page;
      try {
        page = await fn(vp);
        assert.deepEqual(page.errors, [], 'console errors or warnings');
        assert.deepEqual(page.outside, [], 'no request leaves the page origin');
        assert.deepEqual(page.dialogs, [], 'no dialog was ever opened');
        results.push('ok   ' + label);
      } catch (e) {
        failures++; results.push('FAIL ' + label + '\n     ' + String(e && e.message || e).split('\n').slice(0, 8).join('\n     '));
        if (page && page.errors && page.errors.length) results.push('     page errors: ' + JSON.stringify(page.errors).slice(0, 400));
      } finally { if (page) await page.context().close().catch(() => {}); }
    }
  } finally { await browser.close(); srv.close(); }
  console.log(results.join('\n'));
  console.log('\n' + (results.length - failures) + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})();
