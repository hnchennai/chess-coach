// E2E for slice G3, polish (docs/specs/board-screens.product.md, G-D41 to G-D45, acceptance criteria 14 to 17):
//   G-D41  one "phone layout": up to 860px wide, or under 500px high whatever the width (915x412, 932x430, 844x390). The sideways
//          board screen of G-D32 applies to every phone-layout screen under 500px high. Wide: over 860px and at least 500px high.
//   G-D42  wide layout: Hint is green only while the Play tab is open; on the other tabs it looks like Take back.
//   G-D43  touch screens (pointer: coarse): every button, chip, row, picker, switch and tab is at least 44px high, icon-only
//          buttons 44px wide too. Mouse screens (pointer: fine) keep today's sizes.
//   G-D44  the move list and text links inside sentences keep their size.
//   G-D47  move chips inside Rani's sentences keep their size; the "Watch" pill is a control and gets 44px (fix round 1).
//   G-D45  reading and Tab order follow the screen: the tab bar at the bottom (up to 600px wide) comes last, else first.
// Run: G3_VP=915x412 node tests/e2e/g3.spec.js   (serves www/ itself; needs Playwright with Chromium).
// G3_VP: a size (915x412) or a width (915). G3_ONLY=<regex> runs matching cases. G3_SHOTS=<dir> saves screenshots.
// G3_RECORD=1 prints the mouse sizes and the wide geometry (used once, on the build before G3, to fill BEFORE below).
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const assert = require('assert/strict');
const path = require('path');

const WWW = path.resolve(process.env.G3_WWW || path.join(__dirname, '../../www'));
const PORT = 8000 + Math.floor(Math.random() * 900);
const ORIGIN = 'http://127.0.0.1:' + PORT;
const URL = ORIGIN + '/index.html';
const SHOTS = process.env.G3_SHOTS || '';
const RECORD = !!process.env.G3_RECORD;
const PKEY = 'suresh-chess-coach.profile.v1', GKEY = 'suresh-chess-coach.v1', TKEY = 'suresh-chess-coach.tab';
const SIZES = ['360x800', '412x915', '768x1024', '915x412', '932x430', '844x390', '1280x450', '1920x480', '1280x800', '1280x900'];
const VIEWPORTS = SIZES.filter((s) => !process.env.G3_VP || s === process.env.G3_VP || s.split('x')[0] === process.env.G3_VP)
  .map((s) => ({ width: +s.split('x')[0], height: +s.split('x')[1] }));
const ONLY = process.env.G3_ONLY ? new RegExp(process.env.G3_ONLY) : null;
const NOW = Date.now(), DAY = 86400000;
const key = (vp) => vp.width + 'x' + vp.height;
const PHONE = (vp) => vp.width <= 860 || vp.height < 500; // G-D41: the phone layout
const SIDE = (vp) => vp.height < 500;                    // G-D32 / G-D41: the sideways board screen
const TABS = ['coach', 'path', 'train', 'play', 'progress'];

// Measured on the build before G3 (8f2726b) with G3_RECORD=1 at 1280x900 with a mouse (a Club player with one finished game): [height, width] of the first visible
// control of each kind, on the screen named. "With a mouse at 1280x900 the sizes are as before."
const BEFORE_MOUSE = { 'home #settingsBtn': [44, 44], 'home .tab': [53.8, 74.8], 'home .zb': [35.5, 83], 'home #contCard .btn': [52, 366], 'home .roadrow': [61, 366],
  'home #hintBtn': [39, 96.2], 'home #undoBtn': [39, 94], 'home #v3dBtn': [32, 68.4], 'home #flipBtn': [39, 54], 'play #colorSel': [38, 178], 'play #levelSel': [38, 178], 'play #newBtn': [39, 366],
  'path .lvl > summary': [74.5, 398], 'path .unitrow': [41, 366], 'train #ratedBtn': [39, 171.1], 'train #reviewDueBtn': [39, 146.6], 'train .puz': [33.5, 114.4], 'progress #history .btn': [31.5, 65],
  'settings .segbtn': [44, 132], 'settings .setbtn': [83, 203], 'settings .switchrow': [55, 414], 'settings .linkbtn': [44, 173.9], 'settings .pl-x': [44, 44] };
// The wide layout's geometry before G3 (8f2726b), a Club player's game open from Play: [left, top, width, height].
const BEFORE_WIDE = {
  '1280x800': { board: [148, 195.5, 578, 578], tabs: [754, 100, 400, 63.8], ctl: [126, 825.5, 600, 39], coach: [754, 179.8, 400, 116.5], header: [126, 28, 1028, 54] },
  '1280x900': { board: [148, 195.5, 578, 578], tabs: [754, 100, 400, 63.8], ctl: [126, 825.5, 600, 39], coach: [754, 179.8, 400, 116.5], header: [126, 28, 1028, 54] } };

let browser, results = [], failures = 0;

const dkey = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const played = (...backs) => Object.fromEntries(backs.map((b) => [dkey(b), { puz: 0, games: 1, course: 0, solved: 0 }]));
const DONE = { learn: 1, practice: 1, apply: 1 };
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, Object.assign({}, DONE)]));
function club(o) {
  return Object.assign({ v: 5, level: 'club', levelT: NOW - 4 * DAY, placed: 'check', start: 'kq', rating: 1300, rn: 0, games: [], puz: {}, course: {}, days: played(1, 2, 3, 4), reviewed: [], t: NOW - DAY, theme: null, showAll: false, unlockAll: false, provisional: false, pgsDeclined: true, levelOfferT: 0 }, o);
}
const beginner = (o) => club(Object.assign({ level: 'beginner', start: 'rules', rating: 600, levelT: NOW - DAY, days: played(1) }, o));
// A profile saved before levels existed (v4): migrate() makes it a placed player (lesson L9: level-dependent screens).
const V4 = () => ({ v: 4, theme: null, games: [{ id: 'g1', d: NOW - 2 * DAY, r: 'W', user: 'w', level: 3, sans: ['e4', 'e5'], ann: {} }], puz: {}, rating: 1000, rn: 0, course: done('rules', 'special', 'board'), days: played(2, 3), reviewed: [], t: NOW - 2 * DAY });
const game = (sans, o) => Object.assign({ sans, user: 'w', level: 1, ann: {}, notes: {}, tags: {}, fb: null, opp: null, evalW: 0, flipped: false, recorded: false, goal: null, t: NOW - 60000 }, o);
const GAME = game(['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5']);
// 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6: White mates with Qxf7.
const MATE1 = game(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6']);
// A finished game in the history, so Progress has its Review buttons to measure.
const PAST = { id: 'gp', d: NOW - DAY, r: 'W', user: 'w', level: 3, acc: 80, counts: {}, tags: {}, sans: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'], ann: {} };
const SEEDS = () => [['club', club()], ['beginner', beginner()], ['v4', V4()]];

function seedFn([pk, p, gk, g, tk, tab]) {
  if (sessionStorage.getItem('seeded')) return;
  if (p) localStorage.setItem(pk, JSON.stringify(p));
  if (g) localStorage.setItem(gk, JSON.stringify(g));
  if (tab) localStorage.setItem(tk, JSON.stringify(tab));
  sessionStorage.setItem('seeded', '1');
}
// o: { game, tab, touch (a touch screen: pointer coarse), size (another viewport) }
async function newPage(vp, p, o) {
  o = o || {};
  const v = o.size || vp, touch = !!o.touch;
  const ctx = await browser.newContext({ viewport: v, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch && v.width <= 932 && v.width !== 768 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.addInitScript(seedFn, [PKEY, p, GKEY, o.game || null, TKEY, o.tab || null]);
  const page = await ctx.newPage();
  page.errors = []; page.outside = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message/.test(m.text())) page.errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ORIGIN + '/') && !/^(data|blob|about):/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u)) page.outside.push(u); });
  await page.goto(URL);
  try { await page.waitForFunction(() => window.__coach && window.Placement); }
  catch (e) { throw new Error('app did not start: ' + e.message.split('\n')[0] + ' | page errors: ' + JSON.stringify(page.errors)); }
  // the emulation is proven, not assumed
  const ptr = await page.evaluate(() => ({ coarse: matchMedia('(pointer: coarse)').matches, fine: matchMedia('(pointer: fine)').matches }));
  assert.deepEqual(ptr, touch ? { coarse: true, fine: false } : { coarse: false, fine: true }, 'pointer emulation');
  return page;
}
const shot = async (page, name) => { if (!SHOTS) return; await page.waitForTimeout(300); await page.screenshot({ path: path.join(SHOTS, key(page.viewportSize()) + '_' + name + '.png') }); };
const idle = (page) => page.waitForFunction(() => !window.__coach.st.busy, null, { timeout: 30000 });
const goTab = (page, t) => page.evaluate((x) => document.getElementById('tab-' + x).click(), t);
// A game opened from Play, as a player does it: "Resume game" when one waits, else "Start new game". Wide: the Play tab.
async function openGame(page) {
  await goTab(page, 'play');
  await page.evaluate(() => { const r = document.querySelector('#resumePlay .rs-go'); if (r && r.getClientRects().length) r.click(); else if (window.__coach.st.scr !== 'act') document.getElementById('newBtn').click(); });
  await idle(page);
}
// What is on screen, in one synchronous step.
const look = (page) => page.evaluate(() => {
  const on = (e) => !!e && e.getClientRects().length > 0, $ = (id) => document.getElementById(id), de = document.documentElement;
  const R = (e) => { if (!on(e)) return null; const r = e.getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; };
  return { board: on(document.querySelector('.boardcol')) && on($('board')), boardBox: R($('board')), boardPos: getComputedStyle($('board')).position,
    tabs: on(document.querySelector('.tabs')), tabsBox: R(document.querySelector('.tabs')), header: on(document.querySelector('header')), bar: on($('actBar')), barBox: R($('actBar')),
    scr: de.dataset.scr || null, end: de.dataset.scrend || null, tab: window.__coach.st.tab, cols: getComputedStyle(document.querySelector('.app')).gridTemplateColumns.split(' ').length,
    phoneMQ: matchMedia('(max-width: 860px), (max-height: 499.98px)').matches, ctl: R($('playControls')), side: R(document.querySelector('.side')),
    vw: window.innerWidth, vh: window.innerHeight, scrollY: window.scrollY, scrollW: de.scrollWidth };
});
const overlap = (a, b) => !!a && !!b && a.l < b.r - 0.5 && b.l < a.r - 0.5 && a.t < b.b - 0.5 && b.t < a.b - 0.5;

// G-D43: every visible control on the page that is under 44px high (icon-only: or narrower). G-D44 and G-D47's exceptions: the
// move list (#moves and its .san items), the move chips inside Rani's sentences (.mvc) and links inside a sentence. The board's
// squares are the board. The "Watch" pill (.mvplay) after a line of moves is a control and is checked (G-D47).
const audit = (page, where) => page.evaluate((w) => {
  const SEL = 'button, select, input:not([type="hidden"]), a[href], summary, [role="tab"], [role="switch"], [role="radio"], [role="button"], [tabindex="0"]';
  const vis = (e) => { if (!e.getClientRects().length) return false; if (getComputedStyle(e).visibility === 'hidden') return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const exempt = (e) => !!e.closest('#moves') || e.matches('.san, .sq, .mvc') || (e.matches('a') && getComputedStyle(e).display === 'inline' && !!e.closest('p, li'));
  const name = (e) => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '')) + ' "' + (e.getAttribute('aria-label') || e.textContent).replace(/\s+/g, ' ').trim().slice(0, 24) + '"';
  const bad = [], seen = []; let n = 0;
  for (const e of document.querySelectorAll(SEL)) {
    if (!vis(e) || exempt(e) || seen.some((s) => s.contains(e) && s !== e && s.matches('button, a'))) continue;
    seen.push(e); n++;
    const r = e.getBoundingClientRect(), icon = !/[A-Za-z0-9]/.test(e.textContent);
    if (r.height < 43.99 || (icon && r.width < 43.99)) bad.push(w + ': ' + name(e) + ' ' + r.height.toFixed(1) + 'h x ' + r.width.toFixed(1) + 'w');
  }
  if (n < 3) bad.push(w + ': only ' + n + ' controls found, the screen was not drawn');
  return bad;
}, where);

// The visible buttons drawn green (the accent, the Play zone's colour or the "best" green), on the whole screen. Tabs are
// navigation, not a main button, and are not counted.
const greens = (page) => page.evaluate(() => {
  const probe = (v) => { const d = document.createElement('div'); d.style.background = v; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; };
  const G = [probe('var(--accent)'), probe('var(--z-play)'), probe('var(--c-best)')];
  return [...document.querySelectorAll('button, a.btn, [role="button"]')].filter((e) => e.getClientRects().length && !e.matches('[role="tab"], .sq') && getComputedStyle(e).visibility !== 'hidden')
    .filter((e) => { const r = e.getBoundingClientRect(); return r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth; })
    .filter((e) => G.includes(getComputedStyle(e).backgroundColor)).map((e) => (e.id || e.className) + ' "' + e.textContent.trim().slice(0, 30) + '"');
});
const looks = (page, id) => page.evaluate((i) => { const s = getComputedStyle(document.getElementById(i)); return { bg: s.backgroundColor, color: s.color, border: s.borderTopColor, weight: s.fontWeight }; }, id);
const accent = (page) => page.evaluate(() => { const d = document.createElement('div'); d.style.background = 'var(--accent)'; document.body.appendChild(d); const c = getComputedStyle(d).backgroundColor; d.remove(); return c; });

// Tab from the top of the page; the stops as ids (or tag.class), until focus leaves the page or comes round again.
async function tabStops(page, n) {
  await page.evaluate(() => { if (document.activeElement) document.activeElement.blur(); window.scrollTo(0, 0); });
  const out = [];
  for (let i = 0; i < (n || 120); i++) {
    await page.keyboard.press('Tab');
    const d = await page.evaluate(() => { const a = document.activeElement; if (!a || a === document.body) return null; const p = a.closest('.panel'); return { id: a.id || (a.tagName.toLowerCase() + '.' + String(a.className).split(' ')[0]), panel: p ? p.id : null, tab: a.getAttribute('role') === 'tab' }; });
    if (!d || (out.length && d.id === out[0].id && d.id)) break;
    out.push(d);
  }
  return out;
}

// The mouse sizes this slice must not change: [screen, selector]. The first visible match on that screen.
const MOUSE_PROBES = [
  ['home', '#settingsBtn'], ['home', '.tab'], ['home', '.zb'], ['home', '#contCard .btn'], ['home', '.roadrow'], ['home', '#hintBtn'], ['home', '#undoBtn'], ['home', '#v3dBtn'], ['home', '#flipBtn'],
  ['play', '#colorSel'], ['play', '#levelSel'], ['play', '#newBtn'],
  ['path', '.lvl > summary'], ['path', '.unitrow'],
  ['train', '#ratedBtn'], ['train', '#reviewDueBtn'], ['train', '.puz'],
  ['progress', '#history .btn'],
  ['settings', '.segbtn'], ['settings', '.setbtn'], ['settings', '.switchrow'], ['settings', '.linkbtn'], ['settings', '.pl-x']
];
async function mouseSizes(page) {
  const out = {};
  for (const scr of ['home', 'play', 'path', 'train', 'progress', 'settings']) {
    if (scr === 'settings') await page.evaluate(() => window.__coach.openSettings());
    else await goTab(page, scr === 'home' ? 'coach' : scr);
    if (scr === 'path') await page.evaluate(() => document.querySelectorAll('#levels details').forEach((d) => { d.open = true; }));
    for (const [s, sel] of MOUSE_PROBES) if (s === scr) out[s + ' ' + sel] = await page.evaluate((q) => { const e = [...document.querySelectorAll(q)].find((x) => x.getClientRects().length); if (!e) return null; const r = e.getBoundingClientRect(); return [+r.height.toFixed(1), +r.width.toFixed(1)]; }, sel);
  }
  await page.evaluate(() => { const x = document.querySelector('#settingsSheet [data-act="settingsclose"]'); if (x && x.getClientRects().length) x.click(); });
  return out;
}
async function wideGeo(page) {
  await openGame(page);
  return page.evaluate(() => { const R = (q) => { const e = document.querySelector(q); if (!e || !e.getClientRects().length) return null; const r = e.getBoundingClientRect(); return [r.left, r.top, r.width, r.height].map((x) => +x.toFixed(1)); };
    return { board: R('#board'), tabs: R('.tabs'), ctl: R('#playControls'), coach: R('#coach'), header: R('header') }; });
}

const cases = [
  // ---------- criterion 14, G-D41: every screen under 500px high is the phone layout, with the sideways board screen ----------
  ['C14 sideways: the tab pages have no board; a game from Play shows the whole board under the Close bar, the rest in a column on its right', ['915x412', '932x430', '844x390', '1280x450', '1920x480'], async (vp) => {
    let page;
    for (const [who, p] of SEEDS()) {
      if (page) await page.context().close();
      page = await newPage(vp, p, { game: GAME, tab: 'play' });
      let L = await look(page);
      assert.equal(L.phoneMQ, true, who + ': the phone-layout query matches');
      assert.equal(L.tab, 'coach', who + ': G-D25, the phone layout opens on Home');
      for (const t of TABS) {
        if (!(await page.evaluate((x) => document.getElementById('tab-' + x).getClientRects().length > 0, t))) continue;
        await goTab(page, t);
        L = await look(page);
        assert.deepEqual([L.board, L.bar, L.header, L.tabs, L.cols], [false, false, true, true, 1], who + ' ' + t + ': a tab page with no board, one column, the header and the tabs');
        assert.ok(L.scrollW <= L.vw, who + ' ' + t + ': no sideways scroll');
      }
      await openGame(page);
      L = await look(page);
      assert.deepEqual([L.scr, L.board, L.bar, L.header, L.tabs], ['act', true, true, false, false], who + ': the board screen with the Close bar');
      assert.equal(L.boardPos, 'fixed', who + ': G-D32, the board is pinned on the left');
      assert.equal(L.scrollY, 0, who + ': no scrolling');
      const B = L.boardBox, bar = L.barBox;
      assert.ok(B.t >= bar.b - 1 && B.b <= L.vh + 0.5 && B.l >= 0 && B.r <= L.vw, who + ': the whole board is on screen under the Close bar: ' + JSON.stringify(B) + ' bar ' + JSON.stringify(bar));
      assert.ok(B.w >= L.vh - bar.b - 17, who + ': the board fills the height under the bar (' + B.w + ')');
      assert.ok(B.l <= 40, who + ': the board is on the left (' + B.l + ')');
      assert.ok(L.ctl && L.ctl.l >= B.r, who + ': the buttons sit in the column on its right (' + JSON.stringify(L.ctl) + ')');
      assert.ok(L.side.l >= B.r, who + ': the panel (Rani, the moves) is in the column too');
      // fix round 1: on any width the column starts right beside the board, and the Close bar spans the screen (as at 915x412)
      assert.ok(L.ctl.l - B.r <= 16 && L.side.l - B.r <= 16, who + ': no gap between the board and the column: ' + (L.ctl.l - B.r).toFixed(1) + 'px');
      assert.ok(bar.l <= 0.5 && bar.r >= L.vw - 0.5, who + ': the Close bar spans the screen: ' + JSON.stringify(bar));
      assert.ok(L.scrollW <= L.vw, who + ': no sideways scroll on the board screen');
      await shot(page, who + '_board');
    }
    // an end card brings the tabs back: in the column, never over the board (fixed tab bar up to 600px only)
    await page.context().close();
    page = await newPage(vp, club(), { game: MATE1 });
    await openGame(page);
    await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => !!document.querySelector('#gameEnd .ec-main'), null, { timeout: 30000 });
    await page.waitForTimeout(400);
    const L = await look(page);
    assert.deepEqual([L.scr, L.end, L.tabs], ['act', '1', true], 'the end card brings the tabs back');
    assert.equal(overlap(L.tabsBox, L.boardBox), false, 'the tab bar never covers the board: ' + JSON.stringify([L.tabsBox, L.boardBox]));
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    const L2 = await look(page);
    assert.equal(overlap(L2.tabsBox, L2.boardBox), false, 'nor when the column is scrolled');
    await shot(page, 'endcard');
    return page;
  }],
  ['C14 rotate: a game open on a big phone (412x915) turned sideways (915x412) stays on the board screen, board on the left, and back', ['412x915'], async (vp) => {
    const page = await newPage(vp, club(), { game: GAME, tab: 'play' });
    await openGame(page);
    const before = await page.evaluate(() => window.__coach.hist().length);
    await page.setViewportSize({ width: 915, height: 412 });
    await page.waitForFunction(() => getComputedStyle(document.getElementById('board')).position === 'fixed');
    let L = await look(page);
    assert.deepEqual([L.scr, L.board, L.bar, L.tabs, L.boardPos], ['act', true, true, false, 'fixed'], 'sideways: the sideways board screen');
    assert.ok(L.boardBox.b <= L.vh + 0.5 && L.boardBox.t >= L.barBox.b - 1, 'the whole board on screen');
    await page.setViewportSize(vp);
    await page.waitForFunction(() => getComputedStyle(document.getElementById('board')).position !== 'fixed');
    L = await look(page);
    assert.deepEqual([L.scr, L.board, L.bar, L.tabs, L.boardPos], ['act', true, true, false, 'relative'], 'upright again');
    assert.equal(await page.evaluate(() => window.__coach.hist().length), before, 'nothing lost');
    return page;
  }],
  ['C14 wide: 1280x800 and 1280x900 keep the wide layout (board beside every tab, no Close bar, the same geometry)', ['1280x800', '1280x900'], async (vp) => {
    const page = await newPage(vp, club(), { game: GAME, tab: 'play' });
    let L = await look(page);
    assert.deepEqual([L.phoneMQ, L.cols, L.tab], [false, 2, 'play'], 'wide: two columns, the stored tab');
    for (const t of TABS) { await goTab(page, t); L = await look(page); assert.deepEqual([L.board, L.bar, L.header, L.tabs, L.scr], [true, false, true, true, null], t + ': board beside the tab'); }
    const geo = await wideGeo(page);
    L = await look(page);
    assert.equal(L.scr, null, 'no board screen on wide');
    if (RECORD) console.log('BEFORE_WIDE', key(vp), JSON.stringify(geo));
    else if (BEFORE_WIDE[key(vp)]) assert.deepEqual(geo, BEFORE_WIDE[key(vp)], 'the wide geometry is as before');
    return page;
  }],
  ['C14 agree: the CSS layout and the app agree at every size (one column = phone layout = a board screen from Play)', SIZES, async (vp) => {
    const page = await newPage(vp, club(), { game: GAME, tab: 'play' });
    let L = await look(page);
    assert.equal(L.phoneMQ, PHONE(vp), 'the phone-layout query');
    assert.equal(L.cols, PHONE(vp) ? 1 : 2, 'the CSS columns follow it');
    await openGame(page);
    L = await look(page);
    assert.equal(L.scr, PHONE(vp) ? 'act' : null, 'the app opens a board screen exactly in the phone layout');
    assert.equal(L.boardPos === 'fixed', SIDE(vp), 'the pinned board exactly under 500px high');
    return page;
  }],

  // ---------- criterion 15, G-D42: one green main button on a wide screen ----------
  ['C15: Hint is green on Play and looks like Take back on Home, Learn, Train and Progress; one green button on Home', ['1280x800', '1280x900'], async (vp) => {
    let page = await newPage(vp, club(), { game: GAME, tab: 'play' });
    const acc = await accent(page);
    await goTab(page, 'play'); await idle(page);
    assert.equal((await looks(page, 'hintBtn')).bg, acc, 'Play: Hint is green');
    for (const t of ['coach', 'path', 'train', 'progress']) {
      await goTab(page, t);
      assert.deepEqual(await looks(page, 'hintBtn'), await looks(page, 'undoBtn'), t + ': Hint looks like Take back');
    }
    // a puzzle set on the wide screen: Hint is not green on Train either
    await page.evaluate(() => window.__coach.trainStart('rated'));
    await page.waitForFunction(() => { const c = window.__coach.st; return c.mode === 'puzzle' && c.pz && !c.busy; }, null, { timeout: 20000 });
    assert.equal(await page.evaluate(() => window.__coach.st.tab), 'train');
    assert.equal(await page.evaluate(() => getComputedStyle(document.getElementById('hintBtn')).display !== 'none'), true, 'Hint is shown in a puzzle');
    assert.deepEqual(await looks(page, 'hintBtn'), await looks(page, 'flipBtn'), 'Train with a puzzle set: Hint looks like the plain buttons');
    await page.context().close();
    // Home, on the whole screen: at most one green main button (a game waiting, none waiting, each level)
    for (const [who, p, g] of [['club, game', club(), GAME], ['club, no game', club(), null], ['beginner, game', beginner(), GAME], ['beginner, no game', beginner(), null], ['v4', V4(), GAME]]) {
      page = await newPage(vp, p, { game: g, tab: 'coach' });
      await goTab(page, 'coach'); await idle(page);
      const gr = await greens(page);
      assert.ok(gr.length <= 1, who + ': at most one green main button on Home, found ' + JSON.stringify(gr));
      await shot(page, 'home_' + who.replace(/\W+/g, '_'));
      if (who !== 'v4') await page.context().close();
    }
    return page;
  }],

  // ---------- criterion 16, G-D43, G-D44: 44px on touch screens, today's sizes with a mouse ----------
  ['C16 touch: every visible control on the five tabs, the board screens, Settings and the end cards is at least 44px', ['360x800', '412x915', '768x1024', '915x412', '1280x800'], async (vp) => {
    const bad = [];
    const tabsOf = async (page, who) => {
      for (const t of TABS) {
        if (!(await page.evaluate((x) => document.getElementById('tab-' + x).getClientRects().length > 0, t))) continue;
        await goTab(page, t);
        if (t === 'path') await page.evaluate(() => document.querySelectorAll('#levels details').forEach((d) => { d.open = true; }));
        bad.push(...await audit(page, who + ' ' + t));
      }
      await page.evaluate(() => window.__coach.openSettings());
      bad.push(...await audit(page, who + ' settings'));
      await page.locator('#settingsSheet [data-act="settingsclose"]').click();
    };
    let page;
    for (const [who, p] of SEEDS()) {
      if (page) await page.context().close();
      page = await newPage(vp, p, { game: GAME, tab: 'play', touch: true });
      await tabsOf(page, who);
      await openGame(page);
      bad.push(...await audit(page, who + ' game'));
    }
    // the "Watch" pill: a mistake gets "Better was ... The line: ..." with the pill after the line (Club, Rani's card)
    await page.context().close();
    page = await newPage(vp, club(), { game: GAME, tab: 'play', touch: true });
    await openGame(page);
    await page.locator('#board .sq[data-sq="c4"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => [...document.querySelectorAll('.mvplay')].some((e) => e.getClientRects().length), null, { timeout: 60000 });
    bad.push(...await audit(page, 'game after a mistake (Watch pill)'));
    if (!PHONE(vp)) { assert.deepEqual([...new Set(bad)], [], 'controls under 44px on a touch screen'); return page; } // wide: the tabs, Settings and the game
    await page.context().close();
    // Club: a lesson, its end card, a puzzle set, a game's end card
    page = await newPage(vp, club(), { game: MATE1, tab: 'play', touch: true });
    await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    bad.push(...await audit(page, 'lesson'));
    for (let i = 0; i < 12 && (await page.evaluate(() => window.__coach.st.mode)) === 'lesson'; i++) await page.locator('#navNext').click();
    await page.waitForFunction(() => { const e = document.getElementById('learnEnd'); return e && !e.hidden && e.getClientRects().length; });
    bad.push(...await audit(page, 'learn end card'));
    await page.evaluate(() => window.__coach.trainStart('rated'));
    await page.waitForFunction(() => { const c = window.__coach.st; return c.mode === 'puzzle' && c.pz && !c.busy; }, null, { timeout: 20000 });
    bad.push(...await audit(page, 'puzzle set'));
    await openGame(page);
    await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => !!document.querySelector('#gameEnd .ec-main'), null, { timeout: 30000 });
    bad.push(...await audit(page, 'game end card'));
    await shot(page, 'touch_endcard');
    assert.deepEqual([...new Set(bad)], [], 'controls under 44px on a touch screen');
    return page;
  }],
  ['C16 mouse: with a mouse at 1280x900 the sizes are as before', ['1280x900'], async (vp) => {
    const page = await newPage(vp, club({ games: [PAST] }), { game: GAME, tab: 'play' });
    const s = await mouseSizes(page);
    if (RECORD) { console.log('BEFORE_MOUSE', JSON.stringify(s)); return page; }
    assert.deepEqual(s, BEFORE_MOUSE, 'mouse sizes as before');
    return page;
  }],

  // ---------- criterion 17, G-D45: reading and Tab order follow the screen ----------
  ['C17 order: upright phone, the page first (after the Settings gear) and the five tabs last; wide as before', ['360x800', '1280x900'], async (vp) => {
    const page = await newPage(vp, club(), { game: GAME, tab: 'coach' });
    await goTab(page, 'coach');
    const stops = await tabStops(page);
    const ids = stops.map((s) => s.id), tabIdx = stops.map((s, i) => s.tab ? i : -1).filter((i) => i >= 0), panelIdx = stops.map((s, i) => s.panel ? i : -1).filter((i) => i >= 0);
    assert.equal(ids[0], 'settingsBtn', 'the first stop is the header’s Settings gear: ' + ids.slice(0, 4));
    assert.deepEqual(tabIdx.map((i) => ids[i]), TABS.map((t) => 'tab-' + t), 'the five tabs, in order');
    assert.ok(panelIdx.length > 3, 'the page has stops');
    const dom = await page.evaluate(() => { const t = document.querySelector('.tabs'), p = document.getElementById('panel-coach'); return t.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING ? 'tabs first' : 'page first'; });
    if (vp.width <= 600) {
      assert.equal(ids[1] && stops[1].panel, 'panel-coach', 'the second stop is in the page: ' + ids.slice(0, 4));
      assert.ok(Math.min(...tabIdx) > Math.max(...panelIdx), 'the tabs come after the page');
      assert.deepEqual(ids.slice(-5), TABS.map((t) => 'tab-' + t), 'the five tabs are the last stops: ' + ids.slice(-7));
      assert.equal(dom, 'page first', 'a screen reader reads the page first');
    } else {
      assert.ok(Math.max(...tabIdx) < Math.min(...panelIdx), 'wide: the tabs come before the page, as before');
      assert.equal(dom, 'tabs first', 'wide: the tab bar is read first, as before');
    }
    // ARIA tab semantics are kept
    const aria = await page.evaluate(() => { const l = document.querySelector('.tabs'); return { role: l.getAttribute('role'), tabs: [...l.querySelectorAll('[role="tab"]')].map((t) => t.id + ':' + t.getAttribute('aria-selected')), panel: document.getElementById('panel-coach').getAttribute('aria-labelledby') }; });
    assert.deepEqual(aria, { role: 'tablist', tabs: ['tab-coach:true', 'tab-path:false', 'tab-train:false', 'tab-play:false', 'tab-progress:false'], panel: 'tab-coach' });
    return page;
  }],
  ['C17 cross: turning or resizing across the breakpoint never drops focus, and the order follows', ['412x915', '1280x900'], async (vp) => {
    const page = await newPage(vp, club(), { game: GAME, tab: 'coach' });
    await goTab(page, 'coach');
    const other = vp.width <= 600 ? { width: 915, height: 412 } : { width: 360, height: 800 };
    const state = () => page.evaluate(() => { const t = document.querySelector('.tabs'), p = document.getElementById('panel-coach'); return { focus: document.activeElement && document.activeElement.id, first: t.compareDocumentPosition(p) & Node.DOCUMENT_POSITION_FOLLOWING ? 'tabs' : 'page' }; });
    await page.focus('#tab-train'); await page.keyboard.press('Enter');
    assert.equal((await state()).focus, 'tab-train');
    const order = (v) => page.waitForFunction((last) => { const t = document.querySelector('.tabs'); return (t.parentNode.lastElementChild === t) === last; }, v.width <= 600);
    for (const [v, n] of [[other, 1], [vp, 2], [other, 3]]) {
      await page.setViewportSize(v); await order(v);
      const s = await state();
      assert.equal(s.focus, 'tab-train', 'resize ' + n + ' (' + key(v) + '): focus stays on the Train tab');
      assert.equal(s.first, v.width <= 600 ? 'page' : 'tabs', 'resize ' + n + ' (' + key(v) + '): the order follows the screen');
    }
    // and focus inside the page is never touched by the move
    await page.setViewportSize(vp); await order(vp);
    await page.focus('#ratedBtn');
    await page.setViewportSize(other); await order(other);
    assert.equal((await state()).focus, 'ratedBtn');
    return page;
  }],
  ['C17 switch (fix round 1): a wide screen that drops under 500px high (and back) never drops focus to the page body', ['1280x800'], async (vp) => {
    const page = await newPage(vp, club(), { game: GAME, tab: 'play' });
    const short = { width: 1280, height: 450 };
    const settle = async (scr) => { await page.waitForFunction((s) => (document.documentElement.dataset.scr || null) === s, scr); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
    const focus = () => page.evaluate(() => { const a = document.activeElement; return { id: a && a !== document.body ? a.id : 'BODY', shown: !!a && a.getClientRects().length > 0 }; });
    // the game beside the Play tab, focus on Hint. 1280x450 is the phone layout, where Play is a start page with no board:
    // Hint is hidden, so the focus goes to the selected tab (Play), never the body; back on the wide screen it stays there
    await goTab(page, 'play'); await idle(page);
    await page.focus('#hintBtn');
    await page.setViewportSize(short); await settle(null);
    assert.deepEqual(await focus(), { id: 'tab-play', shown: true }, '1280x450 Play: Hint is hidden, so the selected tab');
    await page.setViewportSize(vp); await settle(null);
    assert.deepEqual(await focus(), { id: 'tab-play', shown: true }, '1280x800 Play again: the tab keeps it');
    // the game opened on the short screen (the board screen), focus on Hint: Hint is on screen in both layouts, so it keeps it
    await page.setViewportSize(short); await settle(null);
    await openGame(page); await settle('act');
    await page.focus('#hintBtn');
    await page.setViewportSize(vp); await settle(null);
    assert.deepEqual(await focus(), { id: 'hintBtn', shown: true }, '1280x800: still on Hint');
    await page.setViewportSize(short); await settle('act');
    assert.deepEqual(await focus(), { id: 'hintBtn', shown: true }, '1280x450 board screen again: still on Hint');
    await page.setViewportSize(vp); await settle(null);
    // Home with the game beside it, focus on Hint: the short screen's Home has no board, so focus goes to the Home tab (the
    // selected tab), never the body; back on the wide screen it stays there
    await goTab(page, 'coach'); await settle(null);
    await page.focus('#hintBtn');
    await page.setViewportSize(short); await settle(null);
    assert.deepEqual(await focus(), { id: 'tab-coach', shown: true }, '1280x450 Home: Hint is hidden, so the selected tab');
    await page.setViewportSize(vp); await settle(null);
    assert.deepEqual(await focus(), { id: 'tab-coach', shown: true }, '1280x800 Home again: the tab keeps it');
    return page;
  }],
  // fix round 2: "never drops focus" also means "never grabs it": with nothing focused, a layout switch focuses nothing
  ['C17 switch A (fix round 2): the board screen with nothing focused, turned wide and back: still nothing focused', ['412x915'], async (vp) => {
    const page = await newPage(vp, club(), { game: GAME, tab: 'play' });
    const wide = { width: 1280, height: 800 };
    const settle = async (scr) => { await page.waitForFunction((s) => (document.documentElement.dataset.scr || null) === s, scr); await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)))); };
    const active = () => page.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'BODY' : a.id || a.tagName; });
    await openGame(page); await settle('act');
    assert.equal(await active(), 'actText', 'opened by the player: the Close bar\u2019s text is read (G2a)');
    await page.evaluate(() => document.activeElement.blur());
    assert.equal(await active(), 'BODY');
    await page.setViewportSize(wide); await settle(null);
    assert.equal(await active(), 'BODY', '1280x800: nothing focused');
    await page.setViewportSize(vp); await settle('act');
    assert.equal(await active(), 'BODY', '412x915 board screen again: nothing focused');
    return page;
  }],
  ['C17 switch B (fix round 2): a mouse click that hides its button leaves nothing focused; a later layout switch does not focus anything', ['1280x800'], async (vp) => {
    const page = await newPage(vp, beginner(), { game: GAME, tab: 'coach' });
    const short = { width: 1280, height: 450 };
    const settle = async () => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    const active = () => page.evaluate(() => { const a = document.activeElement; return !a || a === document.body ? 'BODY' : a.id || a.tagName; });
    await goTab(page, 'coach'); await idle(page);
    const btn = page.locator('#panel-coach button:visible', { hasText: 'Resume game' }).first();
    await btn.click(); // a mouse click: the button is gone once the game is open
    await settle();
    assert.equal(await active(), 'BODY', 'after the click nothing is focused (the button is hidden)');
    await page.setViewportSize(short); await settle(); await settle();
    assert.equal(await active(), 'BODY', '1280x450: nothing focused');
    await page.setViewportSize(vp); await settle(); await settle();
    assert.equal(await active(), 'BODY', '1280x800 again: nothing focused');
    return page;
  }]
];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.woff2': 'font/woff2' };
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
    for (const vp of VIEWPORTS) for (const [name, sizes, fn] of cases) {
      if (!sizes.includes(key(vp)) || (ONLY && !ONLY.test(name))) continue;
      const label = key(vp) + ' ' + name;
      let page;
      try {
        page = await fn(vp);
        assert.deepEqual(page.errors, [], 'console errors or warnings');
        assert.deepEqual(page.outside, [], 'no request leaves the page origin');
        results.push('ok   ' + label);
      } catch (e) {
        failures++; results.push('FAIL ' + label + '\n     ' + String(e && e.message || e).split('\n').slice(0, +(process.env.G3_LINES || 14)).join('\n     ') + (process.env.G3_STACK ? '\n' + e.stack : ''));
        if (page && page.errors && page.errors.length) results.push('     page errors: ' + JSON.stringify(page.errors).slice(0, 400));
      } finally { if (page) await page.context().close().catch(() => {}); }
    }
  } finally { await browser.close(); srv.close(); }
  console.log(results.join('\n'));
  console.log('\n' + (results.length - failures) + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})();
