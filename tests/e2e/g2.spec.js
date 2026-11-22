// E2E for slice G2a: board screens on phones (docs/specs/board-screens.product.md, G-D1 to G-D8, G-D10 to G-D12, G-D21 to
// G-D26; scenarios 1 to 6, 8, 13; acceptance criteria 1 to 7. Design: docs/specs/board-screens.tech.md, section 9).
// Run: G2_VP=412 node tests/e2e/g2.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// G2_VP: 360 | 412 | 1280. G2_SHOTS=<dir> saves screenshots. G2_ONLY=<regex> runs matching cases.
// Not in this slice, so not here: one thing waiting per tab and saving a lesson or set on the device (G2b), the phone's back
// button (G2c).
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const assert = require('assert/strict');
const path = require('path');

const WWW = path.resolve(process.env.G2_WWW || path.join(__dirname, '../../www'));
const PORT = 8000 + Math.floor(Math.random() * 900);
const ORIGIN = 'http://127.0.0.1:' + PORT;
const URL = ORIGIN + '/index.html';
const SHOTS = process.env.G2_SHOTS || '';
const PKEY = 'suresh-chess-coach.profile.v1', GKEY = 'suresh-chess-coach.v1', TKEY = 'suresh-chess-coach.tab', SKEY = 'suresh-chess-coach.pieces', K3D = 'suresh-chess-coach.view3d';
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }].filter((v) => !process.env.G2_VP || String(v.width) === process.env.G2_VP);
const ONLY = process.env.G2_ONLY ? new RegExp(process.env.G2_ONLY) : null;
const NOW = Date.now(), DAY = 86400000;
const PH = (vp) => vp.width <= 860; // the one-column layout: G2 applies
const TABS = ['coach', 'path', 'train', 'play', 'progress'];
const HOME_ORDER = ['contCard', 'stageHero', 'today', 'stageCard', 'roadCard', 'lookCard', 'methodsCard'];
// The spec's "New wording", letter for letter.
const WORDS = { close: 'Close', game: 'Resume game', lesson: 'Resume lesson', puzzles: 'Resume puzzles', drill: 'Resume drill', recent: 'Recent games' };

let browser, results = [], failures = 0;

const DONE = { learn: 1, practice: 1, apply: 1 };
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, Object.assign({}, DONE)]));
const dkey = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const played = (...backs) => Object.fromEntries(backs.map((b) => [dkey(b), { puz: 0, games: 1, course: 0, solved: 0 }]));
// A player on their second day or later (the default).
function prof(o) {
  return Object.assign({ v: 5, level: 'beginner', levelT: NOW - DAY, placed: 'check', start: 'rules', rating: 600, rn: 0, games: [], puz: {}, course: {}, days: played(1), reviewed: [], t: NOW - DAY, theme: null, showAll: false, unlockAll: false, provisional: false, pgsDeclined: true, levelOfferT: 0 }, o);
}
const improver = (o) => prof(Object.assign({ level: 'improver', start: 'fork', rating: 1000 }, o));
const club = (o) => prof(Object.assign({ level: 'club', start: 'kq', rating: 1300, days: played(1, 2, 3, 4), levelT: NOW - 4 * DAY }, o));
const dayOne = (o) => Object.assign({ levelT: NOW - 1000, t: NOW - 1000, days: played(0) }, o);
const game = (sans, o) => Object.assign({ sans, user: 'w', level: 1, ann: {}, notes: {}, tags: {}, fb: null, opp: null, evalW: 0, flipped: false, recorded: false, goal: null, t: NOW - 60000 }, o);
// 11 full moves: White (the player) is on move 12.
const SANS22 = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O', 'Re1', 'a6', 'Bb3', 'Ba7', 'h3', 'h6', 'Nbd2', 'Re8', 'Nf1', 'Be6'];
const GAME12 = game(SANS22);
// 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6: White mates with Qxf7.
const MATE1 = game(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6']);
const PAST = (o) => Object.assign({ id: 'gp', d: NOW - DAY, r: 'W', user: 'b', level: 3, acc: 80, counts: {}, tags: {}, sans: ['f3', 'e5', 'g4', 'Qh4#'], ann: {} }, o);

function seedFn([pk, p, gk, g, tk, tab, sk, set, k3, v3d]) {
  if (sessionStorage.getItem('seeded')) return;
  if (p) localStorage.setItem(pk, JSON.stringify(p));
  if (g) localStorage.setItem(gk, JSON.stringify(g));
  if (tab) localStorage.setItem(tk, JSON.stringify(tab));
  if (set) localStorage.setItem(sk, JSON.stringify(set));
  if (v3d) localStorage.setItem(k3, 'true');
  sessionStorage.setItem('seeded', '1');
}
// A small fake of the native ads plugin (the full one is in f3b.spec.js): enough to see when a banner is on screen.
function fakeAds() {
  const A = window.__ad = { calls: [], ls: {}, view: false, visible: false, loaded: false };
  Object.defineProperty(A, 'shown', { get() { return A.view && A.visible && A.loaded; } });
  const rec = (m) => A.calls.push({ m, t: performance.now(), scr: document.documentElement.dataset.scr || null, scrend: document.documentElement.dataset.scrend || null }); // the screen at the moment of the call
  const fire = (n, d) => (A.ls[n] || []).slice().forEach((f) => f(d));
  const size = (on) => fire('bannerAdSizeChanged', on ? { width: window.innerWidth, height: 64 } : { width: 0, height: 0 });
  const info = () => ({ status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' });
  const P = {
    addListener(n, f) { (A.ls[n] = A.ls[n] || []).push(f); return Promise.resolve({ remove() {} }); },
    requestConsentInfo() { rec('requestConsentInfo'); return Promise.resolve(info()); },
    showConsentForm() { rec('showConsentForm'); return Promise.resolve(info()); },
    showPrivacyOptionsForm() { rec('showPrivacyOptionsForm'); return Promise.resolve(); },
    initialize() { rec('initialize'); return Promise.resolve(); },
    showBanner() { rec('showBanner'); if (A.view) return Promise.resolve(); A.view = true; A.visible = true; A.loaded = false; setTimeout(() => { if (!A.view) return; A.loaded = true; size(true); fire('bannerAdLoaded', {}); }, 30); return Promise.resolve(); },
    hideBanner() { rec('hideBanner'); if (!A.view) return Promise.reject(new Error('never shown')); A.visible = false; setTimeout(() => size(false), 0); return Promise.resolve(); },
    resumeBanner() { rec('resumeBanner'); if (A.view) { A.visible = true; setTimeout(() => size(true), 0); } return Promise.resolve(); },
    removeBanner() { rec('removeBanner'); A.view = false; A.visible = false; A.loaded = false; setTimeout(() => size(false), 0); return Promise.resolve(); }
  };
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { AdMob: P } };
}
// o: { game, tab, set, v3d, ads (true: the fake ads plugin), size (another viewport) }
async function newPage(vp, p, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: o.size || vp, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.addInitScript(seedFn, [PKEY, p, GKEY, o.game || null, TKEY, o.tab || null, SKEY, o.set || null, K3D, !!o.v3d]);
  if (o.ads) await ctx.addInitScript(fakeAds);
  const page = await ctx.newPage();
  if (process.env.G2_TIMEOUT) { page.setDefaultTimeout(+process.env.G2_TIMEOUT); page.setDefaultNavigationTimeout(60000); }
  page.errors = []; page.outside = []; page.dialogs = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message|WebGL context was lost|THREE\.WebGLRenderer: Context (Lost|Restored)/.test(m.text())) page.errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => page.errors.push(process.env.G2_STACK ? String(e.stack) : String(e)));
  page.on('dialog', (d) => { page.dialogs.push(d.message()); d.dismiss().catch(() => {}); });
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ORIGIN + '/') && !/^(data|blob|about):/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u)) page.outside.push(u); });
  await page.goto(URL);
  try { await page.waitForFunction(() => window.__coach && window.Placement); }
  catch (e) { throw new Error('app did not start: ' + e.message.split('\n')[0] + ' | page errors: ' + JSON.stringify(page.errors)); }
  return page;
}
const shot = async (page, vp, name) => { if (!SHOTS) return; await page.waitForTimeout(300); await page.screenshot({ path: path.join(SHOTS, (page.viewportSize().width) + '_' + name + '.png') }); };
const st = (page, k) => page.evaluate((key) => window.__coach.st[key], k);
const hist = (page) => page.evaluate(() => window.__coach.hist());
const savedGame = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), GKEY);
const idle = (page) => page.waitForFunction(() => !window.__coach.st.busy, null, { timeout: 30000 });
// What is on screen, measured in one synchronous step.
const look = (page) => page.evaluate(() => {
  const on = (e) => !!e && e.getClientRects().length > 0, $ = (id) => document.getElementById(id), de = document.documentElement, c = window.__coach.st;
  const b = $('board').getBoundingClientRect(), bar = $('actBar'), panels = [...document.querySelectorAll('.panel')].filter(on).map((p) => p.id.replace('panel-', ''));
  return { board: on(document.querySelector('.boardcol')) && on($('board')), boardBox: { top: b.top, left: b.left, right: b.right, bottom: b.bottom, w: b.width, h: b.height }, tabs: on(document.querySelector('.tabs')), header: on(document.querySelector('header')),
    bar: on(bar), modebar: on($('modebar')), scr: de.dataset.scr || null, end: de.dataset.scrend || null, stScr: c.scr, tab: c.tab, mode: c.mode, panels, vw: window.innerWidth, vh: window.innerHeight, scrollY: window.scrollY, scrollW: de.scrollWidth };
});
const bar = (page) => page.evaluate(() => {
  const $ = (id) => document.getElementById(id), b = $('actBar'); if (!b.getClientRects().length) return null;
  const box = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, right: r.right }; };
  return { box: box(b), position: getComputedStyle(b).position, name: $('actName').textContent, place: $('actPlace').textContent, close: Object.assign(box($('actClose')), { label: $('actClose').getAttribute('aria-label'), text: $('actClose').textContent.trim() }),
    gear: Object.assign(box($('actGear')), { label: $('actGear').getAttribute('aria-label') }), order: [...b.children].map((e) => e.id) };
});
// A Resume card, as the player sees it (null when it is not on screen).
const resume = (page, id) => page.evaluate((i) => {
  const e = document.getElementById(i); if (!e || !e.getClientRects().length) return null;
  const b = e.querySelector('.rs-go'), k = e.querySelector('.bh-kick'), r = b.getBoundingClientRect();
  return { title: e.querySelector('.bh-title').textContent, line: e.querySelector('.rs-line').textContent, kick: k ? k.textContent : null, button: b.textContent, h: r.height, w: r.width, primary: b.classList.contains('primary'), top: e.getBoundingClientRect().top };
}, id);
const visibleIds = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => e.getClientRects().length > 0).map((e) => e.id), sel);
const text = (page) => page.evaluate(() => document.body.innerText);
const goTab = async (page, t) => { await page.locator('#tab-' + t).click(); };
const closeX = (page) => page.locator('#actClose').click();
const move = async (page, from, to) => {
  const n = (await hist(page)).length;
  await page.locator('#board .sq[data-sq="' + from + '"]').click();
  await page.locator('#board .sq[data-sq="' + to + '"]').click();
  await page.waitForFunction((k) => window.__coach.hist().length > k, n);
};
async function solvePuzzle(page) {
  for (let i = 0; i < 12; i++) {
    await page.waitForFunction(() => { const z = window.__coach.st.pz; return z && (z.done || (!z.wait && !window.__coach.st.busy)); }, null, { timeout: 20000 });
    const z = await page.evaluate(() => { const p = window.__coach.st.pz; return { done: p.done, step: p.step, mv: p.p.sol[p.step] }; });
    if (z.done) return;
    await page.locator('#board .sq[data-sq="' + z.mv.slice(0, 2) + '"]').click();
    await page.locator('#board .sq[data-sq="' + z.mv.slice(2, 4) + '"]').click();
    await page.waitForFunction((s) => { const p = window.__coach.st.pz; return p.done || p.step !== s; }, z.step, { timeout: 20000 });
  }
  throw new Error('puzzle not solved');
}
async function finishLesson(page) {
  await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
  for (let i = 0; i < 12 && (await st(page, 'mode')) === 'lesson'; i++) await page.locator('#navNext').click();
  assert.notEqual(await st(page, 'mode'), 'lesson');
}
const endCard = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s), on = (e) => !!e && e.getClientRects().length > 0; if (!on(el)) return { shown: false };
  const tx = (q) => { const e = el.querySelector(q); return on(e) ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  return { shown: true, title: tx('.ec-title'), line: tx('.ec-line'), main: tx('.ec-main'), small: [...el.querySelectorAll('.ec-small')].filter(on).map((b) => b.textContent.trim()), slot: on(el.querySelector('.tipslot')),
    top: el.getBoundingClientRect().top, boardBottom: document.getElementById('board').getBoundingClientRect().bottom };
}, sel);
const wait3d = (page) => page.waitForFunction(() => { const b = document.getElementById('v3dBtn'); return /2D view/.test(b.textContent) && !document.querySelector('.b3d.loading') && window.Board3D && window.Board3D.debug && window.Board3D.debug.ready(); }, null, { timeout: 30000 });
const adShown = (page) => page.evaluate(() => window.__ad.shown);
const slotOn = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0 && !!e.textContent.trim(); }, sel);

const cases = [
  // ---------- criterion 1, scenario 1, G-D1 ----------
  ['C1: with no activity open, none of the five tabs shows the board (three levels); the tab bar is there', async (vp) => {
    let page;
    for (const [name, p] of [['beginner', prof({ showAll: false })], ['beginner, all tabs', prof({ unlockAll: true, course: done('rules', 'special', 'board') })], ['improver', improver()], ['club', club()]]) {
      if (page) await page.context().close();
      page = await newPage(vp, p, { game: GAME12, tab: 'play' });
      const tabs = await visibleIds(page, '.tabs .tab');
      assert.ok(tabs.length >= 3, name + ': tabs ' + tabs);
      for (const id of tabs) {
        await page.locator('#' + id).click();
        const L = await look(page);
        assert.equal(L.tabs, true, name + ' ' + id + ': the tab bar is on screen');
        assert.deepEqual(L.panels, [id.replace('tab-', '')], name + ' ' + id + ': its own page');
        if (PH(vp)) {
          assert.equal(L.board, false, name + ' ' + id + ': no board');
          assert.equal(L.bar, false, name + ' ' + id + ': no Close bar');
          assert.equal(L.header, true, name + ' ' + id + ': the header with the gear');
          assert.deepEqual(await visibleIds(page, '#goalCard, #coach, #oppCard, #thinkCard, #movesCard, #sessionCard, .znote, #modebar'), [], name + ' ' + id + ': no card of an open activity');
          assert.ok(L.scrollW <= L.vw, name + ' ' + id + ': no sideways scroll');
        } else assert.equal(L.board, true, name + ' ' + id + ': wide keeps the board beside every tab');
      }
      if (name === 'club') { await goTab(page, 'path'); await shot(page, vp, 'learn'); await goTab(page, 'train'); await shot(page, vp, 'train'); await goTab(page, 'progress'); await shot(page, vp, 'progress'); }
    }
    return page;
  }],
  // ---------- scenario 2, G-D7, G-D12 ----------
  ['S2: Club Home opens with the Continue card first, today’s cards in order and no board; the tip follows the first-day rule', async (vp) => {
    let page = await newPage(vp, club(), { tab: 'play' });
    let L = await look(page);
    if (!PH(vp)) { assert.equal(L.tab, 'play', 'wide: the stored tab, as before'); assert.equal(L.board, true); return page; }
    assert.equal(L.tab, 'coach', 'G-D25: opens on Home, whatever tab it was closed on');
    assert.equal(L.board, false);
    assert.deepEqual((await visibleIds(page, '#panel-coach > *')).filter((id) => id !== 'homeSlot'), HOME_ORDER, 'F-D8 order, nothing new without a game');
    assert.equal(await slotOn(page, '#homeSlot'), true, 'day two: the tip at the bottom of Home');
    assert.equal(await resume(page, 'resumeHome'), null, 'no game: no Resume card');
    await shot(page, vp, 'home_club');
    await page.context().close();
    page = await newPage(vp, club(dayOne()), {});
    assert.equal((await look(page)).board, false);
    assert.equal(await slotOn(page, '#homeSlot'), false, 'first day: no tip');
    return page;
  }],
  // ---------- scenario 3, criterion 2, G-D2, G-D3, G-D24 ----------
  ['S3: Play, "Start new game": the board fills the screen, tabs and header gone, Close at the top left, in the same frame', async (vp) => {
    const page = await newPage(vp, club(), {});
    await goTab(page, 'play');
    if (PH(vp)) {
      assert.deepEqual(await visibleIds(page, '#panel-play > *'), ['newCard'], 'Play is a start page: New game only (no game, no finished games)');
      await shot(page, vp, 'play_empty');
    }
    // the tap and the measurement in one synchronous step: nothing is painted in between
    const L = await page.evaluate(() => {
      document.getElementById('newBtn').click();
      const on = (e) => !!e && e.getClientRects().length > 0, de = document.documentElement;
      return { board: on(document.getElementById('board')), tabs: on(document.querySelector('.tabs')), header: on(document.querySelector('header')), bar: on(document.getElementById('actBar')), scr: de.dataset.scr || null, mode: window.__coach.st.mode, tab: window.__coach.st.tab };
    });
    if (!PH(vp)) { assert.deepEqual(L, { board: true, tabs: true, header: true, bar: false, scr: null, mode: 'play', tab: 'play' }, 'wide: as before, no board screen'); return page; }
    assert.deepEqual(L, { board: true, tabs: false, header: false, bar: true, scr: 'act', mode: 'play', tab: 'play' });
    const B = await bar(page), K = await look(page);
    assert.deepEqual(B.order, ['actClose', 'actText', 'actGear'], 'Close, the name, the gear');
    assert.equal(B.close.label, WORDS.close); assert.equal(B.close.text, '', 'the button shows an X, no words');
    assert.ok(B.close.x < 24 && B.close.y < 24, 'Close is at the top left: ' + JSON.stringify(B.close));
    assert.ok(B.gear.right > K.vw - 24 && B.gear.y < 24, 'G-D24: the gear at the top right');
    for (const b of [B.close, B.gear]) assert.ok(b.w >= 44 && b.h >= 44, 'at least 44px: ' + JSON.stringify(b));
    assert.equal(B.gear.label, 'Settings');
    assert.equal(B.position, 'sticky');
    assert.equal(B.name, 'New game'); assert.equal(B.place, 'Move 1, your turn');
    assert.ok(K.boardBox.left <= 1 && K.boardBox.right >= K.vw - 1 || vp.width > 600, 'the board is as wide as the screen');
    assert.ok(K.boardBox.bottom <= K.vh, 'the whole board is on the first screen');
    assert.deepEqual(await visibleIds(page, '#newCard, .rs-card, #recentPlay, #modebar, .znote'), [], 'no menus under the board');
    assert.ok(K.scrollW <= K.vw, 'no sideways scroll');
    await shot(page, vp, 'board_game_new');
    // G-D24: Settings opens over the game without closing it
    await page.locator('#actGear').click();
    assert.equal(await page.locator('#settingsSheet').isVisible(), true);
    assert.equal(await page.locator('#lookSet [data-act="tags"]').isVisible(), true, 'pieces, 3D and Piece tags are reachable');
    await page.keyboard.press('Escape');
    assert.equal((await look(page)).scr, 'act', 'still on the board screen');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'actGear', 'focus back on the gear');
    // the bar stays reachable when the player scrolls down to the Moves card
    await page.evaluate(() => window.scrollTo(0, 600)); await page.waitForTimeout(100);
    const B2 = await bar(page);
    assert.ok(Math.abs(B2.box.y) <= 1 && B2.close.y >= 0 && B2.close.y < 24, 'sticky: Close stays at the top: ' + JSON.stringify(B2.box));
    return page;
  }],
  // ---------- scenario 4, criteria 2, 3, 4, G-D4, G-D5, G-D6, G-D22 ----------
  ['S4: on move 12, Close lands on Play at once; "Resume game" says "Move 12, your turn" on Play and on Home; it brings back the same position', async (vp) => {
    const page = await newPage(vp, improver({ games: [PAST({ id: 'a' })] }), { game: GAME12, tab: 'play' });
    if (!PH(vp)) {
      assert.deepEqual(await visibleIds(page, '.rs-card, #recentPlay, #actBar'), [], 'wide: no Resume card, no Recent games, no Close bar');
      return page;
    }
    // Home: the card under the Continue card
    const H = await resume(page, 'resumeHome');
    assert.deepEqual([H.title, H.line, H.button], [WORDS.game, 'Move 12, your turn', WORDS.game]);
    assert.ok(H.h >= 44, 'the button is at least 44px high');
    assert.deepEqual((await visibleIds(page, '#panel-coach > *')).slice(0, 2), ['contCard', 'resumeHome'], 'G-D5: under the Continue card');
    assert.equal(H.primary, false, 'Continue stays Home’s one main button');
    await shot(page, vp, 'home_improver_game');
    // Play: the start page, Resume first
    await goTab(page, 'play');
    assert.deepEqual(await visibleIds(page, '#panel-play > *'), ['resumePlay', 'newCard', 'recentPlay'], 'G-D6: Resume game, New game, Recent games');
    const P = await resume(page, 'resumePlay');
    assert.deepEqual([P.title, P.line, P.button], [WORDS.game, 'Move 12, your turn', WORDS.game]);
    assert.ok(P.h >= 44);
    assert.equal(await page.locator('#recentPlay .eyebrow').innerText().then((t) => t.toLowerCase()), WORDS.recent.toLowerCase());
    assert.equal(await page.locator('#recentPlay .eyebrow').evaluate((e) => e.textContent), WORDS.recent);
    assert.equal(await page.locator('#newCard #newBtn').innerText(), 'Start new game');
    await shot(page, vp, 'play_game');
    // Resume: the same position, in the same frame
    const before = await hist(page);
    const R = await page.evaluate(() => { document.querySelector('#resumePlay .rs-go').click(); const on = (e) => e.getClientRects().length > 0; return { board: on(document.getElementById('board')), tabs: on(document.querySelector('.tabs')), scr: document.documentElement.dataset.scr || null }; });
    assert.deepEqual(R, { board: true, tabs: false, scr: 'act' });
    assert.deepEqual(await hist(page), SANS22);
    const B = await bar(page);
    assert.equal(B.name, 'Your game'); assert.equal(B.place, 'Move 12, your turn');
    assert.equal(await page.evaluate(() => document.querySelector('#board .sq[data-sq="e6"] .pc').classList.contains('b')), true, 'the bishop is on e6, as it was left');
    await shot(page, vp, 'board_game');
    // a move, then Close: no question, nothing lost, Play at once
    await move(page, 'a2', 'a4'); await idle(page);
    const played = await hist(page);
    assert.ok(played.length >= 24 && played[22] === 'a4', 'the move and the reply: ' + played.slice(22));
    const C = await page.evaluate(() => { document.getElementById('actClose').click(); const on = (e) => e.getClientRects().length > 0, c = window.__coach.st; return { board: on(document.querySelector('.boardcol')), tabs: on(document.querySelector('.tabs')), bar: on(document.getElementById('actBar')), scr: document.documentElement.dataset.scr || null, tab: c.tab, sheet: !document.getElementById('settingsSheet').hidden, note: !document.getElementById('raniNote').hidden }; });
    assert.deepEqual(C, { board: false, tabs: true, bar: false, scr: null, tab: 'play', sheet: false, note: false }, 'G-D4: Play at once, no question');
    assert.deepEqual(page.dialogs, [], 'no dialog');
    assert.deepEqual(await hist(page), played, 'criterion 3: no move lost');
    assert.deepEqual((await savedGame(page)).sans, played, 'and it is saved');
    assert.equal((await resume(page, 'resumePlay')).line, 'Move 13, your turn', 'the real move number');
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('rs-go')), true, 'focus is on the Resume button');
    await goTab(page, 'coach');
    assert.equal((await resume(page, 'resumeHome')).line, 'Move 13, your turn', 'Home shows the same card');
    await page.locator('#resumeHome .rs-go').click();
    assert.deepEqual(await hist(page), played); assert.equal((await look(page)).scr, 'act');
    assert.equal(before.length, 22);
    return page;
  }],
  // ---------- scenario 5, G-D25 ----------
  ['S5: the app closed in mid-game opens on Home with the Resume game card, not on the board', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    let L = await look(page);
    if (!PH(vp)) { assert.equal(L.tab, 'play', 'wide: starts on the stored Play tab, in the game'); assert.equal(L.board, true); assert.equal(L.bar, false); return page; }
    assert.deepEqual([L.tab, L.board, L.scr, L.tabs], ['coach', false, null, true]);
    assert.equal((await resume(page, 'resumeHome')).line, 'Move 12, your turn');
    // every stored tab opens Home on a phone
    for (const t of ['train', 'progress', 'path']) {
      await page.evaluate(([k, v]) => localStorage.setItem(k, JSON.stringify(v)), [TKEY, t]);
      await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
      L = await look(page);
      assert.deepEqual([L.tab, L.board], ['coach', false], 'stored ' + t);
    }
    assert.deepEqual(await hist(page), SANS22, 'the game is where it was left');
    return page;
  }],
  // ---------- scenario 13, criteria 3, 4, G-D22 ----------
  ['S13: closed by the system while the engine was to move: no move is lost, the engine replies, the card’s line is right', async (vp) => {
    const sans = SANS22.concat(['a4']);
    const page = await newPage(vp, club(), { game: game(sans), tab: 'play' });
    await page.waitForFunction(() => window.__coach.hist().length === 24 && !window.__coach.st.busy, null, { timeout: 30000 });
    const h = await hist(page);
    assert.deepEqual(h.slice(0, 23), sans, 'nothing lost');
    if (!PH(vp)) return page;
    assert.equal((await look(page)).tab, 'coach');
    assert.equal((await resume(page, 'resumeHome')).line, 'Move 13, your turn');
    // while the engine is still thinking the line says so (the engine is held back here)
    await page.locator('#resumeHome .rs-go').click();
    await page.evaluate(() => { window.__coach.st.level = 5; window.Brain.play = () => new Promise((r) => { window.__go = r; }); });
    await page.locator('#board .sq[data-sq="h3"]').click(); await page.locator('#board .sq[data-sq="h4"]').click();
    await page.waitForFunction(() => typeof window.__go === 'function', null, { timeout: 30000 });
    assert.equal((await bar(page)).place, 'Move 13, engine to move');
    await closeX(page);
    assert.equal((await resume(page, 'resumePlay')).line, 'Move 13, engine to move');
    assert.equal((await hist(page)).length, 25, 'Close lost nothing');
    await page.evaluate(() => { const g = new window.Chess(); window.__coach.hist().forEach((m) => g.move(m)); const m = g.moves({ verbose: true })[0]; window.__go(m.from + m.to + (m.promotion || '')); });
    await page.waitForFunction(() => window.__coach.hist().length === 26 && !window.__coach.st.busy, null, { timeout: 30000 });
    assert.equal((await resume(page, 'resumePlay')).line, 'Move 14, your turn', 'the reply came while the game was closed');
    assert.equal((await savedGame(page)).sans.length, 26);
    return page;
  }],
  // ---------- scenario 6, criterion 5, G-D8 ----------
  ['S6: a lesson from Learn to its last step: the end card under the board, the tabs back; its main button starts the next part', async (vp) => {
    const page = await newPage(vp, prof(), {});
    await goTab(page, 'path');
    await page.locator('#levels .unitrow[data-unit="rules"]').click();
    if (PH(vp)) await shot(page, vp, 'learn_unit');
    await page.locator('#unitView [data-part="learn"]').click();
    let L = await look(page);
    if (PH(vp)) {
      assert.deepEqual([L.board, L.tabs, L.bar, L.scr, L.tab], [true, false, true, 'act', 'path']);
      const B = await bar(page);
      assert.equal(B.name, 'How the pieces move'); assert.match(B.place, /^Lesson · step 1 of \d+$/);
      assert.deepEqual(await visibleIds(page, '#levels, #unitView .unitcard, .rs-card'), [], 'the course is not under the board');
      assert.equal(await page.locator('#unitView .lessoncard').isVisible(), true, 'the lesson’s step card is');
      await shot(page, vp, 'board_lesson');
    }
    await finishLesson(page);
    L = await look(page);
    const c = await endCard(page, '#learnEnd');
    assert.equal(c.shown, true);
    assert.equal(c.title, 'How the pieces move'); assert.equal(c.main, 'Start practice'); assert.deepEqual(c.small, ['Home']); assert.equal(c.line, 'Next: practise it.');
    assert.equal(L.tabs, true, 'the tabs are back with the end card');
    if (PH(vp)) {
      assert.deepEqual([L.board, L.bar, L.scr, L.end], [true, true, 'act', '1']);
      assert.ok(c.top >= c.boardBottom, 'the end card is under the board');
      assert.equal(c.slot, true, 'G-D11: the tip shows on the end card (day two)');
      await shot(page, vp, 'end_lesson');
    }
    await page.locator('#learnEnd .ec-main').click();
    await page.waitForFunction(() => !!window.__coach.st.ses);
    L = await look(page);
    if (PH(vp)) assert.deepEqual([L.board, L.tabs, L.scr, L.end, L.tab], [true, false, 'act', null, 'path'], 'the next part: tabs hidden again');
    return page;
  }],
  // ---------- criterion 5: every end card keeps F1's rules, on the board screen, with the tab bar ----------
  ['C5: the game, set and review end cards on the board screen: F1’s titles and buttons, and the tab bar every time', async (vp) => {
    const page = await newPage(vp, club({ games: [] }), { game: MATE1, tab: 'play' });
    if (PH(vp)) { await goTab(page, 'play'); await page.locator('#resumePlay .rs-go').click(); }
    await idle(page);
    await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => !!document.querySelector('#gameEnd .ec-main'), null, { timeout: 30000 });
    let c = await endCard(page, '#gameEnd'), L = await look(page);
    assert.deepEqual([c.title, c.main, c.small], ['Checkmate. You win!', 'Review this game', ['New game', 'Home']]);
    assert.equal(L.tabs, true, 'game end: the tab bar is visible');
    if (PH(vp)) {
      assert.deepEqual([L.board, L.bar, L.scr, L.end], [true, true, 'act', '1']);
      assert.ok(c.top >= c.boardBottom);
      await page.waitForTimeout(500);
      await shot(page, vp, 'end_game_tabs');
      const B = await bar(page); assert.equal(B.name, 'Your game'); assert.equal(B.place, '4 moves');
    }
    // Review this game: a review opens; on its last move (stepped to) the review card, with the tabs
    await page.locator('#gameEnd .ec-main').click();
    L = await look(page);
    assert.equal(L.mode, 'review');
    if (PH(vp)) { assert.deepEqual([L.board, L.tabs, L.scr], [true, false, 'act'], 'a review in progress hides the tabs'); assert.match((await bar(page)).name, /^Review: This game/); await shot(page, vp, 'board_review'); }
    await page.locator('#navPrev').click(); await page.locator('#navNext').click();
    await page.waitForFunction(() => !document.getElementById('reviewEnd').hidden);
    c = await endCard(page, '#reviewEnd'); L = await look(page);
    assert.equal(c.title, 'That’s the whole game.'); assert.deepEqual(c.small, ['New game', 'Home']); assert.ok(c.main);
    assert.equal(L.tabs, true, 'review end: the tab bar is visible');
    if (PH(vp)) {
      await page.locator('#navPrev').click();
      assert.equal((await look(page)).tabs, false, 'stepping back from the last move hides them again');
      await page.locator('#navNext').click();
      assert.equal((await look(page)).tabs, true);
      // G-D23: a review opened from a game’s end card closes to Play
      await closeX(page);
      L = await look(page);
      assert.deepEqual([L.tab, L.board, L.mode], ['play', false, 'play']);
      assert.equal(await resume(page, 'resumePlay'), null, 'a finished game has no Resume card');
      assert.deepEqual(await visibleIds(page, '#panel-play > *'), ['newCard', 'recentPlay']);
    }
    // a puzzle set's end card
    await page.evaluate(() => window.__coach.trainStart('rated'));
    await page.evaluate(() => { const s = window.__coach.st.ses; s.count = s.i + 1; });
    await solvePuzzle(page);
    await page.locator('#sessionCard [data-act="next"]').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished);
    c = await endCard(page, '#sessionCard'); L = await look(page);
    assert.deepEqual([c.title, c.main, c.small], ['Session complete', '10 more puzzles', ['Home']]);
    assert.equal(L.tabs, true, 'set end: the tab bar is visible');
    if (PH(vp)) {
      assert.deepEqual([L.board, L.scr, L.end, L.tab], [true, 'act', '1', 'train']);
      // leaving by a tab drops the finished set
      await goTab(page, 'coach');
      L = await look(page);
      assert.deepEqual([L.tab, L.board, L.scr], ['coach', false, null]);
      assert.equal(await st(page, 'ses'), null, 'the finished set is over');
      await goTab(page, 'train');
      assert.equal(await resume(page, 'resumeTrain'), null, 'nothing to resume');
    }
    return page;
  }],
  // ---------- criteria 2, 3, G-D5: a puzzle set closes and resumes ----------
  ['C3: Close in a puzzle set: Train at once, "Resume puzzles" first, the same puzzle number and score; a result is never lost', async (vp) => {
    const page = await newPage(vp, club(), {});
    await goTab(page, 'train');
    await page.locator('#ratedBtn').click();
    await solvePuzzle(page);
    const solved = await page.evaluate(() => Object.keys(window.__coach.getProf().puz).length);
    assert.equal(solved, 1, 'the result was saved when it was answered');
    await page.locator('#sessionCard [data-act="next"]').click();
    await page.waitForFunction(() => window.__coach.st.ses.i === 1 && window.__coach.st.pz && !window.__coach.st.pz.done);
    if (!PH(vp)) { assert.equal((await look(page)).bar, false); return page; }
    let B = await bar(page);
    assert.equal(B.place, 'Puzzle 2 of 10'); assert.match(B.name, /^Puzzle: (White|Black) to move/);
    await shot(page, vp, 'board_puzzles');
    const pid = await page.evaluate(() => window.__coach.st.pz.p.id);
    await closeX(page);
    let L = await look(page);
    assert.deepEqual([L.tab, L.board, L.tabs, L.scr], ['train', false, true, null]);
    assert.equal((await visibleIds(page, '#panel-train > *'))[0], 'resumeTrain', 'first on Train');
    const R = await resume(page, 'resumeTrain');
    assert.deepEqual([R.title, R.button, R.line], [WORDS.puzzles, WORDS.puzzles, 'Puzzle 2 of 10']);
    assert.ok(R.h >= 44);
    await shot(page, vp, 'train_resume');
    assert.equal(await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('suresh-chess-coach.profile.v1')).puz).length), 1, 'the answered puzzle is still saved');
    // the other tabs have no card for it
    await goTab(page, 'path'); assert.equal(await resume(page, 'resumePath'), null);
    await goTab(page, 'train');
    await page.locator('#resumeTrain .rs-go').click();
    L = await look(page);
    assert.deepEqual([L.board, L.tabs, L.scr, L.tab], [true, false, 'act', 'train']);
    assert.equal(await page.evaluate(() => window.__coach.st.pz.p.id), pid, 'the same puzzle');
    assert.deepEqual(await page.evaluate(() => { const s = window.__coach.st.ses; return [s.i, s.right, s.wrong]; }), [1, 1, 0], 'the same number and score');
    // Close during the wait for the puzzle's reply: resume is never frozen
    const multi = await page.evaluate(() => window.__coach.st.pz.p.sol.length > 1);
    const z = await page.evaluate(() => window.__coach.st.pz.p.sol[0]);
    await page.locator('#board .sq[data-sq="' + z.slice(0, 2) + '"]').click(); await page.locator('#board .sq[data-sq="' + z.slice(2, 4) + '"]').click();
    await closeX(page);
    await page.waitForTimeout(multi ? 1600 : 300);
    await page.locator('#resumeTrain .rs-go').click();
    await solvePuzzle(page);
    assert.equal(await page.evaluate(() => window.__coach.st.pz.done), true, 'the puzzle went on and could be finished');
    assert.deepEqual(await page.evaluate(() => { const s = window.__coach.st.ses; return [s.i, s.right]; }), [1, 2]);
    // until G2b: opening the game still ends the open set, as today (D50)
    return page;
  }],
  // ---------- G-D5, G-D26: Resume lesson, Resume drill ----------
  ['G-D5: Close in a lesson keeps the step: "Resume lesson" first on Learn. A drill’s card reads "Resume drill"', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
    await page.locator('#navNext').click();
    if (!PH(vp)) { assert.equal(await st(page, 'tab'), 'path'); assert.deepEqual(await visibleIds(page, '.rs-card, #actBar'), []); return page; }
    assert.match((await bar(page)).place, /^Lesson · step 2 of \d+$/);
    await closeX(page);
    let L = await look(page);
    assert.deepEqual([L.tab, L.board, L.tabs], ['path', false, true]);
    assert.equal((await visibleIds(page, '#panel-path > *'))[0], 'resumePath', 'first on Learn');
    let R = await resume(page, 'resumePath');
    assert.deepEqual([R.title, R.button], [WORDS.lesson, WORDS.lesson]); assert.match(R.line, /^Lesson · step 2 of \d+$/); assert.ok(R.h >= 44);
    assert.equal(await page.locator('#unitView .lessoncard').isVisible(), false, 'the step card is not on Learn’s page');
    assert.equal(await page.locator('#levels').isVisible(), true, 'the course is');
    await shot(page, vp, 'learn_resume');
    // Play and Home still show the game's card: both wait
    await goTab(page, 'play'); assert.equal((await resume(page, 'resumePlay')).title, WORDS.game);
    await goTab(page, 'path');
    await page.locator('#resumePath .rs-go').click();
    L = await look(page);
    assert.deepEqual([L.board, L.scr, L.mode], [true, 'act', 'lesson']);
    assert.equal(await page.evaluate(() => window.__coach.st.ls.i), 1, 'criterion 3: the same step');
    // until G2b, opening the game ends the open lesson, exactly as "Back to my game" does today (D50)
    await closeX(page); await goTab(page, 'play');
    await page.locator('#resumePlay .rs-go').click();
    L = await look(page);
    assert.deepEqual([L.mode, L.scr, L.tab], ['play', 'act', 'play']);
    assert.deepEqual(await hist(page), SANS22);
    await closeX(page); await goTab(page, 'path');
    assert.equal(await resume(page, 'resumePath'), null, 'the lesson ended (G2b will keep it)');
    // a drill from Train's list (fix round 1: it belongs to Train; the Fix 6 case has the rest)
    await goTab(page, 'train');
    await page.locator('#drillList [data-drill]').first().click();
    await idle(page);
    L = await look(page);
    assert.deepEqual([L.board, L.scr, L.tab, L.mode], [true, 'act', 'train', 'drill']);
    assert.match((await bar(page)).name, /^Drill: .+ · move 0 of \d+$/); assert.equal((await bar(page)).place, 'Endgame drill');
    await closeX(page);
    R = await resume(page, 'resumeTrain');
    assert.deepEqual([R.title, R.button], [WORDS.drill, WORDS.drill]);
    await page.locator('#bookList [data-book]').first().click();
    await closeX(page);
    assert.equal((await resume(page, 'resumeTrain')).title, WORDS.drill, 'an opening drill too');
    await page.locator('#panel-train [data-train="safety"]').click();
    await closeX(page);
    assert.equal((await resume(page, 'resumeTrain')).title, WORDS.puzzles, 'Safe or blunder reads Resume puzzles');
    return page;
  }],
  // ---------- criterion 4, G-D6, G-D23 ----------
  ['C4: a finished game has no Resume card; "Recent games" shows at most three; a past game’s review closes to where it was opened', async (vp) => {
    const games = ['a', 'b', 'c', 'd', 'e'].map((id, i) => PAST({ id, d: NOW - (i + 1) * DAY }));
    const page = await newPage(vp, club({ games }), { game: game(['f3', 'e5', 'g4', 'Qh4#'], { recorded: true }), tab: 'play' });
    if (!PH(vp)) { assert.deepEqual(await visibleIds(page, '.rs-card, #recentPlay'), []); return page; }
    assert.equal(await resume(page, 'resumeHome'), null, 'Home: no card for a finished game');
    assert.ok(!/Resume game/.test(await text(page)));
    await goTab(page, 'play');
    assert.equal(await resume(page, 'resumePlay'), null);
    assert.deepEqual(await visibleIds(page, '#panel-play > *'), ['newCard', 'recentPlay']);
    assert.equal(await page.locator('#recentPlay .hrow').count(), 3, 'the last three');
    assert.deepEqual(await page.locator('#recentPlay [data-review]').evaluateAll((bs) => bs.map((b) => b.dataset.gid)), ['a', 'b', 'c']);
    for (const h of await page.locator('#recentPlay [data-review]').evaluateAll((bs) => bs.map((b) => b.getBoundingClientRect().height))) assert.ok(h >= 44, 'a Review button is ' + h + 'px high');
    await shot(page, vp, 'play_recent');
    // from Play: Close goes back to Play
    await page.locator('#recentPlay [data-review]').nth(1).click();
    let L = await look(page);
    assert.deepEqual([L.mode, L.board, L.tabs, L.scr], ['review', true, false, 'act']);
    assert.equal(await page.evaluate(() => window.__coach.st.rv.id), 'b');
    assert.match((await bar(page)).name, /^Review: Past game · \d+ blunders?$/, 'the review’s own line, as the mode bar says it on wide screens');
    await closeX(page);
    L = await look(page);
    assert.deepEqual([L.tab, L.board, L.mode], ['play', false, 'play']);
    // from Progress: the full list is there, and Close goes back to Progress
    await goTab(page, 'progress');
    assert.equal(await page.locator('#history .hrow').count(), 5, 'the full list stays on Progress');
    await page.locator('#history [data-review]').nth(3).click();
    L = await look(page);
    assert.deepEqual([L.mode, L.tab, L.scr], ['review', 'play', 'act']);
    await closeX(page);
    L = await look(page);
    assert.deepEqual([L.tab, L.board, L.mode, L.tabs], ['progress', false, 'play', true], 'G-D23: back on Progress');
    return page;
  }],
  // ---------- G-D21 ----------
  ['G-D21: every level’s Home shows "Resume game" under the Continue card; Beginner Home’s "Back to my game" button is retired', async (vp) => {
    const page = await newPage(vp, prof(), { game: game(['e4', 'e5', 'Nf3', 'Nc6'], { level: 1 }) });
    const alt = await page.locator('#bhome .bh-alt').count();
    if (!PH(vp)) {
      assert.equal(await page.locator('#bhome .bh-alt').innerText(), 'Back to my game', 'wide: D44 as it is');
      assert.equal(await page.locator('#bhome .rs-card').count(), 0);
      return page;
    }
    assert.equal(alt, 0, 'no second button while a game is going');
    assert.ok(!/Back to my game/.test(await page.locator('#bhome').innerText()));
    const R = await resume(page, 'resumeBHome');
    assert.deepEqual([R.title, R.line, R.button], [WORDS.game, 'Move 3, your turn', WORDS.game]);
    assert.ok(R.h >= 44);
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#bhome > *')].map((e) => e.className.split(' ').slice(0, 3).join(' '))), ['bh-hero', 'card bh-card', 'card bh-card rs-card'], 'Rani, the Continue card, then Resume game');
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.btn.primary')].filter((e) => e.getClientRects().length > 0).length), 1, 'Continue is still the one main button');
    assert.equal((await look(page)).board, false);
    await shot(page, vp, 'home_beginner_game');
    await page.locator('#resumeBHome .rs-go').click();
    let L = await look(page);
    assert.deepEqual([L.board, L.scr, L.tab, L.tabs], [true, 'act', 'play', false]);
    assert.deepEqual(await hist(page), ['e4', 'e5', 'Nf3', 'Nc6']);
    // with no game going Beginner Home is as it was
    await closeX(page);
    await page.evaluate((k) => localStorage.removeItem(k), GKEY);
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    assert.equal(await page.locator('#bhome .bh-alt').innerText(), 'Just play a game');
    assert.equal(await page.locator('#bhome .rs-card').count(), 0);
    await shot(page, vp, 'home_beginner');
    return page;
  }],
  // ---------- scenario 8, criterion 6, G-D10 ----------
  ['S8: 1280 wide: board left, panel right, no Close bar, no Resume or Recent cards; the notes and "Train instead" as today', async (vp) => {
    if (PH(vp)) return newPage(vp, club(), {});
    const page = await newPage(vp, club({ games: [PAST()] }), { game: GAME12, tab: 'play' });
    let L = await look(page);
    assert.deepEqual([L.tab, L.board, L.tabs, L.header, L.bar, L.modebar, L.scr], ['play', true, true, true, false, true, null]);
    const cols = await page.evaluate(() => { const b = document.querySelector('.boardcol').getBoundingClientRect(), s = document.querySelector('.side').getBoundingClientRect(); return { b: b.right, s: s.left }; });
    assert.ok(cols.b < cols.s, 'the board is left of the panel');
    assert.deepEqual(await visibleIds(page, '.rs-card, #recentPlay, #actBar'), []);
    assert.equal(await page.locator('#modeExit').innerText(), 'Train instead');
    assert.equal(await page.evaluate(() => document.getElementById('tab-play').classList.contains('live')), true, 'the live dot');
    await shot(page, vp, 'play');
    await page.evaluate(() => window.__coach.trainStart('rated'));
    L = await look(page);
    assert.deepEqual([L.scr, L.bar, L.tabs, L.header], [null, false, true, true], 'an activity opens no board screen');
    await goTab(page, 'play');
    assert.equal(await page.locator('#znote-play').isVisible(), true, 'the note that the board is on Train');
    assert.equal(await page.locator('#modeExit').innerText(), 'Back to my game');
    await goTab(page, 'coach');
    assert.equal(await page.locator('#contCard').isVisible(), true);
    await page.locator('#modeExit').click();
    await shot(page, vp, 'home');
    return page;
  }],
  // ---------- criterion 7, G-D11, G-D12 ----------
  ['C7: the tip and the banner never show while the board screen is open; a saved, closed game no longer hides them', async (vp) => {
    const page = await newPage(vp, club({ games: [PAST()] }), { game: GAME12, tab: 'progress', ads: true });
    if (!PH(vp)) {
      // wide keeps the strict rule (F-D17): an unfinished game hides the slot on Progress, and there is no banner
      await page.waitForTimeout(1500);
      assert.equal(await slotOn(page, '#slotStrip'), false, 'wide: no slot while a game is unfinished');
      assert.equal(await adShown(page), false);
      return page;
    }
    // Home, every level, with a saved game: the tip, and the banner after its second (G-D12)
    assert.equal((await look(page)).tab, 'coach');
    assert.equal(await slotOn(page, '#homeSlot'), true, 'Home: the tip shows with a saved, closed game');
    await page.waitForFunction(() => window.__ad.shown, null, { timeout: 5000 });
    await goTab(page, 'progress');
    assert.equal(await slotOn(page, '#progSlot'), true, 'Progress too');
    await page.waitForFunction(() => window.__ad.shown, null, { timeout: 5000 });
    // opening the board screen takes both away in the same step
    await goTab(page, 'play');
    const R = await page.evaluate(() => { document.querySelector('#resumePlay .rs-go').click(); return { visible: window.__ad.visible, calls: window.__ad.calls.map((c) => c.m).slice(-1)[0] }; });
    assert.equal(R.visible, false, 'the banner is told to hide as the board screen opens: ' + R.calls);
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(200); assert.equal(await adShown(page), false, 'no banner on the board screen'); assert.deepEqual(await visibleIds(page, '.tipslot'), [], 'no tip on the board screen'); }
    // a fresh board with no move counts too (A-D19)
    await closeX(page);
    await page.evaluate(() => { document.getElementById('newBtn').click(); document.getElementById('newBtn').click(); });
    assert.equal((await hist(page)).length, 0);
    await page.waitForTimeout(1400);
    assert.equal(await adShown(page), false, 'no banner over a fresh board'); assert.deepEqual(await visibleIds(page, '.tipslot'), []);
    // Close: Play has no slot; Home has, and the banner waits one second
    await closeX(page);
    assert.deepEqual(await visibleIds(page, '.tipslot'), [], 'Play has no tip slot');
    await page.waitForTimeout(1300); assert.equal(await adShown(page), false, 'and no banner');
    await goTab(page, 'coach');
    const t0 = Date.now();
    assert.equal(await adShown(page), false, 'not at once');
    await page.waitForFunction(() => window.__ad.shown, null, { timeout: 5000 });
    assert.ok(Date.now() - t0 >= 900, 'the banner waited about a second: ' + (Date.now() - t0));
    // every banner call that showed one was made on a tab page or under an end card
    const bad = await page.evaluate(() => window.__ad.calls.filter((c) => (c.m === 'showBanner' || c.m === 'resumeBanner') && c.scr && !c.scrend).length);
    assert.equal(bad, 0);
    return page;
  }],
  ['C7: on an end card the tip and the banner show, with a saved game too (G-D11); never on the first day', async (vp) => {
    // a set's end card with an unfinished game saved and closed: wide keeps F-D32 (no slot), phones show it.
    // (A Learn end card is different: the board under it is the game itself. See the Fix 1 case.)
    let page = await newPage(vp, club(), { game: GAME12, tab: 'progress', ads: true });
    await page.evaluate(() => window.__coach.trainStart('rated'));
    await page.evaluate(() => { const s = window.__coach.st.ses; s.count = s.i + 1; });
    await solvePuzzle(page); await page.locator('#sessionCard [data-act="next"]').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished);
    await page.waitForTimeout(1500);
    assert.equal((await endCard(page, '#sessionCard')).shown, true);
    if (PH(vp)) {
      assert.equal(await slotOn(page, '#sessionCard .tipslot'), true, 'the tip is on the end card');
      await page.waitForFunction(() => window.__ad.shown, null, { timeout: 5000 });
      assert.equal((await look(page)).tabs, true);
    } else {
      assert.equal(await slotOn(page, '#slotStrip'), false, 'wide: F-D32 as it is');
      assert.equal(await adShown(page), false);
    }
    await page.context().close();
    page = await newPage(vp, club(dayOne()), { game: GAME12, tab: 'progress', ads: true });
    await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
    await finishLesson(page);
    await page.waitForTimeout(1500);
    assert.deepEqual(await visibleIds(page, '.tipslot'), [], 'first day: no tip anywhere');
    assert.equal(await page.evaluate(() => window.__ad.calls.length), 0, 'and no ads call at all');
    return page;
  }],
  // ---------- criterion 2 with the 3D board (tech doc, section 4) ----------
  ['3D: the same canvas and context across ten open and close rounds; the position is right; a lost context recovers or falls back to flat', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play', v3d: true });
    if (PH(vp)) { await goTab(page, 'play'); await page.locator('#resumePlay .rs-go').click(); }
    await wait3d(page);
    await page.evaluate(() => { window.__cv = window.Board3D.debug.context().canvas; window.__gl = window.__cv.getContext('webgl2') || window.__cv.getContext('webgl'); window.__lost = 0; window.__cv.addEventListener('webglcontextlost', () => window.__lost++); });
    if (PH(vp)) {
      for (let i = 0; i < 10; i++) {
        await closeX(page);
        assert.equal((await look(page)).board, false);
        await page.locator('#resumePlay .rs-go').click();
        const same = await page.evaluate(() => { const c = window.Board3D.debug.context(); return c.canvas === window.__cv && c.canvas.isConnected && c.canvas.getClientRects().length > 0 && !window.__gl.isContextLost() && c.lostN === 0 && window.__lost === 0; });
        assert.equal(same, true, 'round ' + (i + 1) + ': the same canvas, the context alive');
      }
      // a move made while the board was hidden is on the 3D board when it shows
      await closeX(page);
      await page.evaluate(() => { document.getElementById('newBtn').click(); document.getElementById('newBtn').click(); });
      await page.waitForFunction(() => window.Board3D.debug.ready() && window.Board3D.debug.idle(), null, { timeout: 15000 });
      const tags = await page.evaluate(() => window.Board3D.debug.info());
      assert.ok(tags.w > 0 && tags.h > 0, 'the canvas has its size again');
      assert.equal(await page.evaluate(() => window.Board3D.debug.context().canvas === window.__cv), true);
    }
    // forced context loss, then the browser gives it back: the 3D board is built again and draws, nothing breaks
    await page.evaluate(() => { window.__ext = window.__gl.getExtension('WEBGL_lose_context'); window.__ext.loseContext(); });
    await page.waitForFunction(() => window.Board3D.debug.context().lostN === 1);
    assert.equal(await page.evaluate(() => window.Board3D.debug.context().lost), true);
    assert.equal(await st(page, 'v3d'), true, 'the page waits: still the 3D view');
    await page.evaluate(() => window.__ext.restoreContext());
    await page.waitForFunction(() => window.Board3D.debug.context().restoredN === 1 && !window.Board3D.debug.context().lost, null, { timeout: 10000 });
    await page.waitForFunction(() => window.Board3D.debug.ready() && window.Board3D.debug.idle(), null, { timeout: 15000 });
    assert.equal(await st(page, 'v3d'), true, 'still the 3D view');
    assert.equal(await page.evaluate(() => { const c = window.Board3D.debug.context(), i = window.Board3D.debug.info(); return c.has && c.canvas.isConnected && c.canvas.getClientRects().length > 0 && i.calls > 0 && i.w > 0 && document.querySelectorAll('.b3dcanvas').length === 1; }), true, 'one canvas, and it drew again');
    assert.equal(await page.evaluate(() => window.Board3D.debug.tags().length), 0, 'the classic set, as before (no tags)');
    await page.evaluate(() => { window.__cv = window.Board3D.debug.context().canvas; window.__gl = window.__cv.getContext('webgl2') || window.__cv.getContext('webgl'); window.__ext = window.__gl.getExtension('WEBGL_lose_context'); });
    // lost for good: the flat board takes over, and the page lives
    await page.evaluate(() => window.__ext.loseContext());
    await page.waitForFunction(() => window.__coach.st.v3d === false, null, { timeout: 10000 });
    assert.equal(await page.locator('#grid').isVisible(), true, 'the flat board');
    assert.equal(await page.evaluate(() => /3D view/.test(document.getElementById('v3dBtn').textContent)), true);
    assert.equal(await page.evaluate(() => localStorage.getItem('suresh-chess-coach.view3d')), 'true', 'the saved choice is kept');
    await page.locator('#board .sq[data-sq="e2"]').click(); await page.locator('#board .sq[data-sq="e4"]').click();
    await page.waitForFunction(() => window.__coach.hist().length >= 1);
    // and "3D view" builds a fresh one
    await idle(page);
    await page.locator('#v3dBtn').click();
    await wait3d(page);
    assert.equal(await page.evaluate(() => { const c = window.Board3D.debug.context(); return c.has && c.canvas !== window.__cv && c.canvas.isConnected; }), true, 'a new canvas');
    return page;
  }],
  // ---------- focus and touch targets ----------
  ['Focus: the bar’s text on open, the Resume button on Close, never the page body; the keyboard reaches Close', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    if (!PH(vp)) return page;
    await goTab(page, 'play');
    await page.locator('#resumePlay .rs-go').focus(); await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'actText', 'open: the activity’s name and place');
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => document.activeElement.id), 'actClose', 'Close is the control just before it');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('rs-go') && !!document.activeElement.closest('#resumePlay')), true, 'Close: the Resume button on the landing tab');
    // with no card to land on: the selected tab
    await page.locator('#tab-train').click(); await page.locator('#ratedBtn').click();
    await page.evaluate(() => { const s = window.__coach.st.ses; s.count = 1; });
    await solvePuzzle(page); await page.locator('#sessionCard [data-act="next"]').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished);
    await closeX(page);
    assert.equal(await page.evaluate(() => document.activeElement.id), 'tab-train');
    // an end card's main button that starts the next activity never leaves focus on the body
    await page.locator('#ratedBtn').click();
    await page.evaluate(() => { const s = window.__coach.st.ses; s.count = 1; });
    await solvePuzzle(page); await page.locator('#sessionCard [data-act="next"]').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished);
    await page.locator('#sessionCard .ec-main').click();
    assert.notEqual(await page.evaluate(() => document.activeElement === document.body), true);
    // hidden tabs are out of the tab order
    assert.equal(await page.evaluate(() => [...document.querySelectorAll('.tab')].some((t) => t.getClientRects().length > 0)), false);
    return page;
  }],
  // ---------- a phone held sideways, up to 860px wide ----------
  ['780x360: the tab pages have no board; on the board screen the whole board fits the height', async (vp) => {
    if (vp.width !== 412) return newPage(vp, club(), {});
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play', size: { width: 780, height: 360 } });
    let L = await look(page);
    assert.deepEqual([L.tab, L.board, L.tabs], ['coach', false, true]);
    for (const t of TABS) { await goTab(page, t); assert.equal((await look(page)).board, false, t); }
    await goTab(page, 'play'); await page.locator('#resumePlay .rs-go').click();
    L = await look(page);
    const B = await bar(page);
    assert.deepEqual([L.board, L.tabs, L.scr], [true, false, 'act']);
    assert.ok(L.boardBox.top >= B.box.y + B.box.h - 1 && L.boardBox.bottom <= L.vh, 'the whole board is visible under the Close bar: ' + JSON.stringify(L.boardBox));
    assert.ok(L.boardBox.w >= 230, 'and still a usable size: ' + L.boardBox.w);
    assert.ok(Math.abs((L.boardBox.left + L.boardBox.right) / 2 - L.vw / 2) < 20, 'centred');
    await shot(page, vp, 'board_game_780x360');
    return page;
  }],
  // ---------- resize between phone and wide ----------
  ['Resize 412 to 1280 and back with the screen open, closed and on an end card: nothing lost, no dead end', async (vp) => {
    if (vp.width !== 412) return newPage(vp, club(), {});
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    const wide = { width: 1280, height: 900 }, sizes = async (fn) => { await page.setViewportSize(wide); await page.waitForTimeout(150); await fn(await look(page)); await page.setViewportSize(vp); await page.waitForTimeout(150); };
    // closed (Home)
    await sizes((L) => { assert.deepEqual([L.board, L.tabs, L.header, L.bar, L.scr], [true, true, true, false, null]); });
    let L = await look(page);
    assert.deepEqual([L.board, L.tabs, L.tab], [false, true, 'coach']);
    // open (the game)
    await goTab(page, 'play'); await page.locator('#resumePlay .rs-go').click();
    await sizes((W) => { assert.deepEqual([W.board, W.tabs, W.header, W.bar, W.scr, W.tab], [true, true, true, false, null, 'play']); });
    L = await look(page);
    assert.deepEqual([L.board, L.tabs, L.bar, L.scr], [true, false, true, 'act'], 'back on the board screen');
    assert.deepEqual(await hist(page), SANS22);
    // wide, then another tab, then narrow: a tab page, never a board screen with nothing on it
    await page.setViewportSize(wide); await page.waitForTimeout(150);
    await goTab(page, 'progress');
    await page.setViewportSize(vp); await page.waitForTimeout(150);
    L = await look(page);
    assert.deepEqual([L.tab, L.board, L.tabs, L.scr], ['progress', false, true, null]);
    // an end card
    await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
    await finishLesson(page);
    await sizes((W) => { assert.deepEqual([W.board, W.tabs, W.bar], [true, true, false]); });
    L = await look(page);
    assert.deepEqual([L.board, L.tabs, L.bar, L.end], [true, true, true, '1']);
    assert.equal((await endCard(page, '#learnEnd')).shown, true);
    assert.deepEqual(await hist(page), SANS22, 'the game was never touched');
    return page;
  }],
  // ---------- criterion 13 for this slice ----------
  ['Wording: the new words are the spec’s, letter for letter; no em dash; a Beginner never reads "engine"', async (vp) => {
    const page = await newPage(vp, prof({ unlockAll: true }), { game: game(SANS22.concat(['a4'])), tab: 'play' });
    const src = ['flow.js', 'app.js'].map((f) => fs.readFileSync(path.join(WWW, 'js', f), 'utf8')).join('\n') + fs.readFileSync(path.join(WWW, 'index.html'), 'utf8');
    const C = await page.evaluate(() => window.Flow.COPY);
    assert.deepEqual([C.close, C.resumeGame, C.resumeLesson, C.resumePuzzles, C.resumeDrill, C.recent], ['Close', 'Resume game', 'Resume lesson', 'Resume puzzles', 'Resume drill', 'Recent games']);
    assert.equal(await page.evaluate(() => window.Flow.resumeLine(12, true)), 'Move 12, your turn');
    assert.equal(await page.evaluate(() => window.Flow.resumeLine(12, false)), 'Move 12, engine to move');
    for (const s of Object.values(C)) assert.ok(!/—/.test(s), 'no em dash: ' + s);
    assert.ok(!/—/.test(src.slice(src.indexOf('G2a'))), 'no em dash in the G2a code and markup');
    if (!PH(vp)) return page;
    // the bar's second line is watched while the partner is to move
    await page.waitForFunction(() => window.__coach.hist().length === 24 && !window.__coach.st.busy, null, { timeout: 30000 });
    await page.locator('#resumeBHome .rs-go').click();
    const lines = await page.evaluate(() => new Promise((res) => {
      const seen = new Set(), mo = new MutationObserver(() => seen.add(document.getElementById('actPlace').textContent));
      mo.observe(document.getElementById('actPlace'), { childList: true, characterData: true, subtree: true });
      const a = document.querySelector('#board .sq[data-sq="h3"]'), b = document.querySelector('#board .sq[data-sq="h4"]');
      const tapSq = (el) => { const r = el.getBoundingClientRect(), o = { bubbles: true, pointerId: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); };
      tapSq(a); tapSq(b);
      const t = setInterval(() => { if (window.__coach.hist().length >= 26 && !window.__coach.st.busy) { clearInterval(t); mo.disconnect(); res([...seen]); } }, 50);
    }));
    assert.ok(lines.includes('Move 13, Rani’s partner to move'), 'the Beginner’s line: ' + JSON.stringify(lines));
    assert.ok(!lines.some((l) => /engine/i.test(l)), JSON.stringify(lines));
    return page;
  }],
  // ---------- fix round 1 (.crew/g2a-fix-round-1.md) ----------
  ['Fix 1: a Learn end card over the unfinished game has no tip and no banner; a move on that board ends the end card in the same step', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'progress', ads: true });
    if (PH(vp)) await page.waitForFunction(() => window.__ad.shown, null, { timeout: 5000 }); // Home: the banner is up (G-D12)
    await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
    await finishLesson(page);
    assert.equal((await endCard(page, '#learnEnd')).shown, true);
    if (!PH(vp)) { await page.waitForTimeout(1500); assert.equal(await slotOn(page, '#slotStrip'), false, 'wide: F-D32'); assert.equal(await adShown(page), false); return page; }
    let L = await look(page);
    assert.deepEqual([L.board, L.tabs, L.end, L.tab, L.mode], [true, true, '1', 'path', 'play'], 'the end card is up, over the game');
    const n0 = await page.evaluate(() => window.__ad.calls.length);
    for (let i = 0; i < 8; i++) { await page.waitForTimeout(200); assert.equal(await adShown(page), false, 'no banner over a game in progress'); assert.deepEqual(await visibleIds(page, '.tipslot'), [], 'and no tip'); }
    assert.deepEqual(await page.evaluate((n) => window.__ad.calls.slice(n).map((c) => c.m).filter((m) => m !== 'hideBanner'), n0), [], 'nothing asked for the banner');
    let B = await bar(page);
    assert.deepEqual([B.name, B.place], ['Your game', 'Move 12, your turn'], 'the bar names what the board shows, not the lesson');
    // a move on that board: everything of the end card goes in the same step
    const R = await page.evaluate(() => {
      const tapSq = (s) => { const el = document.querySelector('.sq[data-sq="' + s + '"]'), r = el.getBoundingClientRect(), o = { bubbles: true, pointerId: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); };
      tapSq('a2'); tapSq('a4');
      const on = (e) => !!e && e.getClientRects().length > 0, de = document.documentElement, c = window.__coach.st;
      return { end: de.dataset.scrend || null, scr: de.dataset.scr || null, tabs: on(document.querySelector('.tabs')), card: on(document.getElementById('learnEnd')), tab: c.tab, stEnd: c.end || null, tips: [...document.querySelectorAll('.tipslot')].filter(on).length,
        ad: window.__ad.visible, name: document.getElementById('actName').textContent, place: document.getElementById('actPlace').textContent, last: window.__coach.hist().slice(-1)[0] };
    });
    assert.deepEqual(R, { end: null, scr: 'act', tabs: false, card: false, tab: 'play', stEnd: null, tips: 0, ad: false, name: 'Your game', place: 'Move 12, engine to move', last: 'a4' });
    await idle(page);
    // a set's end card: the saved game is closed and the board shows the last puzzle, so G-D11 gives the tip and the banner
    await page.evaluate(() => window.__coach.trainStart('rated'));
    await page.evaluate(() => { const s = window.__coach.st.ses; s.count = s.i + 1; });
    await solvePuzzle(page); await page.locator('#sessionCard [data-act="next"]').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished);
    assert.equal(await slotOn(page, '#sessionCard .tipslot'), true, 'a set’s end card with a saved game has the tip');
    await page.waitForFunction(() => window.__ad.shown, null, { timeout: 5000 });
    assert.ok((await hist(page)).length >= 23, 'the game is still there');
    return page;
  }],
  ['Fix 2: the banner never covers an end card’s buttons: the card is placed for it when it appears, and nothing moves when it arrives', async (vp) => {
    if (!PH(vp)) return newPage(vp, club(), {});
    const measure = (page, sel) => page.evaluate((s) => {
      const fixed = getComputedStyle(document.querySelector('.tabs')).position === 'fixed', margin = fixed ? 64 : 0, zone = { top: window.innerHeight - margin - 64, bottom: window.innerHeight - margin };
      const btns = [...document.querySelectorAll(s + ' button')].filter((b) => b.getClientRects().length > 0).map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.trim(), top: r.top, bottom: r.bottom }; });
      const pad = document.getElementById('adPad');
      return { zone, btns, y: window.scrollY, pad: pad.hidden ? 0 : pad.getBoundingClientRect().height, shown: window.__ad.shown };
    }, sel);
    const check = async (page, sel, why) => {
      await page.waitForTimeout(600); // the card's own scroll
      const a = await measure(page, sel);
      assert.equal(a.shown, false, why + ': measured before the banner is up');
      assert.ok(a.btns.length >= 2, why + ': buttons measured');
      for (const b of a.btns) assert.ok(b.top >= 0 && b.bottom <= a.zone.top + 0.5, why + ': "' + b.t + '" is above the banner’s zone (' + Math.round(b.bottom) + ' vs ' + a.zone.top + ')');
      assert.equal(a.pad, 72, why + ': the page padding is already there');
      await page.waitForFunction(() => window.__ad.shown, null, { timeout: 5000 }); await page.waitForTimeout(300);
      const b = await measure(page, sel);
      assert.equal(b.y, a.y, why + ': the page did not move when the banner came'); assert.equal(b.pad, a.pad, why + ': nor did the padding change');
      assert.deepEqual(b.btns, a.btns, why + ': every button is where it was');
    };
    let page = await newPage(vp, club({ games: [] }), { game: MATE1, ads: true });
    await page.waitForFunction(() => window.__ad.shown, null, { timeout: 5000 });
    await goTab(page, 'play'); await page.locator('#resumePlay .rs-go').click(); await idle(page);
    await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => !!document.querySelector('#gameEnd .ec-main') && !window.__coach.st.busy, null, { timeout: 30000 });
    await check(page, '#gameEnd', 'game end card');
    assert.deepEqual(page.errors, []); await page.context().close();
    page = await newPage(vp, club(), { ads: true });
    await page.waitForFunction(() => window.__ad.shown, null, { timeout: 5000 });
    await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
    await finishLesson(page);
    await check(page, '#learnEnd', 'Learn end card');
    return page;
  }],
  ['Fix 3, 10: "Start new game" asks whenever an unfinished game has moves, also with a lesson waiting; a new game started while the engine thinks is playable', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    if (!PH(vp)) return page;
    await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
    await closeX(page); await goTab(page, 'play');
    await page.locator('#newBtn').click();
    assert.equal(await page.locator('#newConfirm').isVisible(), true, 'the question: "Tap again to abandon it"');
    assert.equal(await page.locator('#newConfirm').innerText(), "Your current game isn't finished. Tap again to abandon it.");
    let L = await look(page);
    assert.deepEqual([L.board, L.tab], [false, 'play']); assert.deepEqual(await hist(page), SANS22, 'nothing was abandoned');
    assert.equal(await st(page, 'mode'), 'lesson', 'and the waiting lesson is still there');
    // Resume instead: the engine is held back in the middle of its move, then a new game is started
    await page.locator('#resumePlay .rs-go').click();
    await page.evaluate(() => { window.__coach.st.level = 5; window.Brain.play = () => new Promise((r) => { window.__go = r; }); });
    await page.locator('#board .sq[data-sq="h3"]').click(); await page.locator('#board .sq[data-sq="h4"]').click();
    await page.waitForFunction(() => typeof window.__go === 'function' && window.__coach.st.busy, null, { timeout: 30000 });
    await closeX(page);
    await page.locator('#newBtn').click(); assert.equal(await page.locator('#newConfirm').isVisible(), true);
    await page.locator('#newBtn').click();
    L = await look(page);
    assert.deepEqual([L.board, L.scr, L.mode], [true, 'act', 'play']); assert.deepEqual(await hist(page), []);
    assert.equal(await st(page, 'busy'), false, 'the new game is not waiting for the old game’s engine');
    await page.locator('#board .sq[data-sq="e2"]').click(); await page.locator('#board .sq[data-sq="e4"]').click();
    await page.waitForFunction(() => window.__coach.hist()[0] === 'e4', null, { timeout: 5000 });
    await page.evaluate(() => window.__go('a7a6')); await page.waitForTimeout(300); // the old game's reply arrives late: it is dropped
    assert.equal((await hist(page))[0], 'e4'); assert.ok(!(await hist(page)).includes('a6'));
    return page;
  }],
  ['Fix 4: a waiting lesson survives browsing (a unit page, All levels, Train’s lists); only starting another activity ends it', async (vp) => {
    const page = await newPage(vp, club(), {});
    if (!PH(vp)) return page;
    await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
    await page.locator('#navNext').click();
    assert.equal(await page.locator('#unitView .lessoncard').isVisible(), true);
    assert.equal(await page.locator('#unitView .lessoncard .back').isVisible(), false, 'the step card’s own back button is not on the board screen: Close replaces it');
    await closeX(page);
    const waiting = async (why) => { assert.equal(await st(page, 'mode'), 'lesson', why); assert.equal(await page.evaluate(() => window.__coach.st.ls.i), 1, why + ': the step'); };
    if (await page.locator('#unitView [data-act="units"]').isVisible()) await page.locator('#unitView [data-act="units"]').click();
    await waiting('All levels');
    await page.locator('#levels [data-unit="kr"]').click();
    assert.equal(await page.locator('#unitView .unitcard').isVisible(), true, 'the other lesson’s page');
    await waiting('another lesson’s page'); assert.equal((await resume(page, 'resumePath')).title, WORDS.lesson);
    await page.locator('#unitView [data-act="units"]').click(); await waiting('All levels again');
    await goTab(page, 'train'); await goTab(page, 'progress'); await goTab(page, 'path'); await waiting('the other tabs');
    await page.locator('#resumePath .rs-go').click();
    assert.equal((await look(page)).scr, 'act'); await waiting('resumed');
    await closeX(page);
    await page.locator('#levels [data-unit="kr"]').click(); await page.locator('#unitView [data-part="learn"]').click();
    assert.equal(await page.evaluate(() => window.__coach.st.ls.unit.id + window.__coach.st.ls.i), 'kr0', 'starting another lesson ends the waiting one (until G2b)');
    return page;
  }],
  ['Fix 5: "Back to my game" reads "Resume game" (Continue card, Today, Rani’s question); no separate Resume card when Continue is the game', async (vp) => {
    const FOUND = ['rules', 'special', 'board', 'values', 'mate', 'opening', 'blunder'], TACTICS = ['fork', 'pin', 'disc', 'patterns', 'check2'];
    const open4 = game(['e4', 'e5', 'Nf3', 'Nc6']);
    const count = (page, sel, t) => page.evaluate(([s, x]) => [...document.querySelectorAll(s)].filter((b) => b.getClientRects().length > 0 && b.textContent.trim() === x).length, [sel, t]);
    // a Beginner past Foundations with a game going: the Continue card is the game
    let page = await newPage(vp, prof({ course: done(...FOUND), levelOfferT: NOW }), { game: open4 });
    assert.equal(await page.locator('#bhome .bh-title').first().innerText(), 'Beat Rani’s practice partner');
    assert.equal(await page.locator('#bhome .bh-go').innerText(), 'Resume game');
    assert.equal(await count(page, '#panel-coach button', 'Resume game'), 1, 'one button for the one action');
    assert.equal(await page.locator('#bhome .rs-card').count(), 0); assert.equal(await page.locator('#bhome .bh-alt').count(), 0);
    assert.ok(!/Back to my game/.test(await page.locator('#panel-coach').innerText()));
    await page.locator('#bhome .bh-go').click();
    assert.deepEqual(await hist(page), open4.sans); assert.equal(await st(page, 'tab'), 'play');
    if (PH(vp)) assert.equal((await look(page)).scr, 'act');
    assert.deepEqual(page.errors, []); await page.context().close();
    // an Improver whose next step is to beat the stage opponent, with a game going
    page = await newPage(vp, improver({ course: done(...TACTICS), rating: 1250, rn: 30 }), { game: Object.assign({}, open4, { level: 3 }), tab: 'coach' });
    assert.equal(await page.locator('#contCard .bh-go').innerText(), 'Resume game');
    assert.equal(await page.locator('#today .step3.z-play .zb').innerText(), 'Resume game', 'Today’s Play step');
    assert.equal(await page.locator('#resumeHome').isVisible(), false, 'no separate Resume card');
    assert.ok(!/Back to my game/.test(await page.locator('#panel-coach').innerText()));
    assert.equal(await count(page, '#panel-coach .btn.primary', 'Resume game'), 1);
    await page.locator('#today .step3.z-play .zb').click();
    assert.deepEqual(await hist(page), open4.sans); assert.equal(await st(page, 'tab'), 'play');
    assert.deepEqual(page.errors, []); await page.context().close();
    // Rani's question before a lesson game
    page = await newPage(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate'), { opening: { learn: NOW - DAY } }) }), { game: open4 });
    await page.locator('#bhome .bh-go').click();
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal((await page.locator('#raniNote [data-act="askback"]').innerText()).trim(), 'Resume game');
    await page.locator('#raniNote [data-act="askback"]').click();
    assert.deepEqual(await hist(page), open4.sans); assert.equal(await st(page, 'tab'), 'play');
    return page;
  }],
  ['Fix 6: a drill started from Train closes to Train with "Resume drill" first there; started as a lesson’s task it stays with Learn', async (vp) => {
    const page = await newPage(vp, club(), {});
    if (!PH(vp)) return page;
    await goTab(page, 'train');
    await page.locator('#drillList [data-drill]').first().click(); await idle(page);
    let L = await look(page);
    assert.deepEqual([L.board, L.scr, L.tab, L.mode], [true, 'act', 'train', 'drill']);
    assert.equal(await page.locator('#sessionCard').isVisible(), true, 'the drill’s card is under the board');
    await closeX(page);
    L = await look(page); assert.deepEqual([L.tab, L.board], ['train', false]);
    assert.equal((await visibleIds(page, '#panel-train > *'))[0], 'resumeTrain');
    assert.equal((await resume(page, 'resumeTrain')).title, WORDS.drill);
    await goTab(page, 'path'); assert.equal(await resume(page, 'resumePath'), null, 'nothing waits on Learn');
    await goTab(page, 'train'); await page.locator('#resumeTrain .rs-go').click();
    L = await look(page); assert.deepEqual([L.scr, L.tab, L.mode], ['act', 'train', 'drill']);
    // out of moves, then "Go again": still Train's drill
    await page.evaluate(() => { const d = window.__coach.st.dr; d.moves = d.limit - 1; });
    await page.locator('#board .sq[data-sq="a1"]').click(); await page.locator('#board .sq[data-sq="a2"]').click();
    await page.waitForFunction(() => window.__coach.st.dr && window.__coach.st.dr.done, null, { timeout: 20000 });
    L = await look(page); assert.deepEqual([L.tab, L.tabs, L.end], ['train', true, '1'], 'its end card is on Train’s board screen');
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.dr && !window.__coach.st.dr.done);
    assert.equal((await look(page)).tab, 'train');
    // the same drill as the lesson's task
    await page.evaluate(() => window.__coach.startPart('kq', 'apply')); await idle(page);
    L = await look(page); assert.deepEqual([L.scr, L.tab, L.mode], ['act', 'path', 'drill']);
    await closeX(page);
    assert.equal((await look(page)).tab, 'path'); assert.equal((await resume(page, 'resumePath')).title, WORDS.drill);
    await goTab(page, 'train'); assert.equal(await resume(page, 'resumeTrain'), null);
    return page;
  }],
  ['Fix 7: Home’s Continue button for a lesson that is waiting reads "Resume lesson" and resumes it at its step (Beginner and Improver)', async (vp) => {
    let page;
    for (const [who, p, sel, first] of [['Improver', improver(), '#contCard .bh-go', 'Start lesson'], ['Beginner', prof(), '#bhome .bh-go', 'Start lesson']]) {
      if (page) { assert.deepEqual(page.errors, []); await page.context().close(); }
      page = await newPage(vp, p, {});
      if (!PH(vp)) continue;
      assert.equal(await page.locator(sel).innerText(), first, who);
      await page.locator(sel).click(); await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
      await page.locator('#navNext').click(); await page.locator('#navNext').click();
      await closeX(page); await goTab(page, 'coach');
      assert.equal(await page.locator(sel).innerText(), WORDS.lesson, who + ': the button reads Resume lesson');
      const R = await page.evaluate((s) => { document.querySelector(s).click(); return { scr: document.documentElement.dataset.scr || null, i: window.__coach.st.ls ? window.__coach.st.ls.i : null, tab: window.__coach.st.tab }; }, sel);
      assert.deepEqual(R, { scr: 'act', i: 2, tab: 'path' }, who + ': the same step');
      await finishLesson(page); await page.locator('#learnEnd .ec-small', { hasText: 'Home' }).click();
      assert.notEqual(await page.locator(sel).innerText(), WORDS.lesson, who + ': nothing waits after the lesson');
    }
    return page;
  }],
  ['Fix 8: a move is saved the moment it is made, and Close saves once more', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    if (PH(vp)) { await goTab(page, 'play'); await page.locator('#resumePlay .rs-go').click(); }
    await idle(page);
    const saved = await page.evaluate((k) => {
      const tapSq = (s) => { const el = document.querySelector('.sq[data-sq="' + s + '"]'), r = el.getBoundingClientRect(), o = { bubbles: true, pointerId: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); };
      tapSq('a2'); tapSq('a4');
      return JSON.parse(localStorage.getItem(k)).sans; // read in the same step as the tap: before the move is graded
    }, GKEY);
    assert.deepEqual(saved, SANS22.concat(['a4']), 'in storage at once');
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    assert.deepEqual((await hist(page)).slice(0, 23), SANS22.concat(['a4']), 'reloaded at once: the move is there');
    await page.waitForFunction(() => window.__coach.hist().length === 24 && !window.__coach.st.busy, null, { timeout: 30000 });
    if (!PH(vp)) return page;
    await page.locator('#resumeHome .rs-go').click();
    const t0 = (await savedGame(page)).t; await page.waitForTimeout(20);
    await closeX(page);
    const g = await savedGame(page);
    assert.ok(g.t > t0, 'Close wrote the game again'); assert.equal(g.sans.length, 24);
    return page;
  }],
  ['Fix 9: after "Next" on the board screen the board is back at the top, just under the Close bar (a puzzle set, a lesson)', async (vp) => {
    const page = await newPage(vp, club(), { size: { width: vp.width, height: 640 } }); // a short phone, so the Next button is under the fold
    if (!PH(vp)) return page;
    const top = () => page.evaluate(() => ({ y: window.scrollY, board: document.getElementById('board').getBoundingClientRect().top, bar: document.getElementById('actBar').getBoundingClientRect().bottom }));
    await goTab(page, 'train'); await page.locator('#ratedBtn').click();
    await solvePuzzle(page);
    await page.evaluate(() => window.scrollTo(0, 260)); await page.waitForTimeout(100);
    assert.ok((await top()).y > 100, 'scrolled down to the Next button: ' + (await top()).y);
    await page.locator('#sessionCard [data-act="next"]').click();
    let T = await top();
    assert.equal(T.y, 0, 'a new puzzle starts at the top'); assert.ok(T.board >= T.bar - 0.5, 'the whole board is under the bar');
    await closeX(page);
    await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
    await page.evaluate(() => window.scrollTo(0, 260)); await page.waitForTimeout(100);
    assert.ok((await top()).y > 100);
    await page.locator('#unitView [data-lnav="1"]').click();
    T = await top();
    assert.equal(T.y, 0, 'the next lesson step starts at the top'); assert.ok(T.board >= T.bar - 0.5);
    return page;
  }],
  ['Fix 11: the Close bar is flush at 700px wide and is a heading with a label; a lesson, a set and a review open in the same frame', async (vp) => {
    const page = await newPage(vp, club({ games: [PAST()] }), { game: GAME12, tab: 'play', size: vp.width === 412 ? { width: 700, height: 900 } : null });
    if (!PH(vp)) return page;
    const openNow = (sel) => page.evaluate((s) => { document.querySelector(s).click(); const on = (e) => !!e && e.getClientRects().length > 0, c = window.__coach.st; return { board: on(document.getElementById('board')), tabs: on(document.querySelector('.tabs')), header: on(document.querySelector('header')), bar: on(document.getElementById('actBar')), scr: document.documentElement.dataset.scr || null, mode: c.mode, tab: c.tab }; }, sel);
    const OPEN = { board: true, tabs: false, header: false, bar: true, scr: 'act' };
    // a review, from Play's Recent games
    await goTab(page, 'play');
    assert.deepEqual(await openNow('#recentPlay [data-review]'), Object.assign({ mode: 'review', tab: 'play' }, OPEN), 'a review');
    const B = await bar(page), L = await look(page);
    assert.ok(Math.abs(B.box.y) <= 0.5 && Math.abs(B.box.x) <= 0.5 && Math.abs(B.box.x + B.box.w - L.vw) <= 0.5, 'the bar is flush with the top and both sides: ' + JSON.stringify(B.box));
    const A = await page.evaluate(() => { const n = document.getElementById('actName'), t = document.getElementById('actText'); return { role: n.getAttribute('role'), level: n.getAttribute('aria-level'), label: t.getAttribute('aria-label'), name: n.textContent, place: document.getElementById('actPlace').textContent, focus: document.activeElement.id }; });
    assert.deepEqual([A.role, A.level], ['heading', '1']);
    assert.equal(A.label, A.name + ', ' + A.place, 'what is read when the bar takes focus'); assert.ok(A.name.length > 0 && A.place.length > 0); assert.equal(A.focus, 'actText');
    await closeX(page);
    // a set
    await goTab(page, 'train');
    assert.deepEqual(await openNow('#ratedBtn'), Object.assign({ mode: 'puzzle', tab: 'train' }, OPEN), 'a puzzle set');
    await closeX(page);
    // a lesson
    await goTab(page, 'path'); await page.locator('#levels [data-unit="kq"]').click();
    assert.deepEqual(await openNow('#unitView [data-part="learn"]'), Object.assign({ mode: 'lesson', tab: 'path' }, OPEN), 'a lesson');
    assert.equal(await page.evaluate(() => document.getElementById('actText').getAttribute('aria-label')), await page.evaluate(() => document.getElementById('actName').textContent + ', ' + document.getElementById('actPlace').textContent));
    return page;
  }],
  ['Fix 11: taps on the 3D board are ignored while its WebGL context is lost, and work again when it is drawn again', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play', v3d: true });
    if (PH(vp)) { await goTab(page, 'play'); await page.locator('#resumePlay .rs-go').click(); }
    await wait3d(page); await idle(page);
    await page.evaluate(() => window.Board3D.debug.tap('a2'));
    assert.equal(await st(page, 'sel'), 'a2', 'a tap selects a piece');
    await page.evaluate(() => { const cv = window.Board3D.debug.context().canvas, gl = cv.getContext('webgl2') || cv.getContext('webgl'); window.__ext = gl.getExtension('WEBGL_lose_context'); window.__ext.loseContext(); window.Board3D.debug.tap('b2'); });
    assert.equal(await st(page, 'sel'), 'a2', 'ignored at once, before the lost event');
    await page.waitForFunction(() => window.Board3D.debug.context().lostN === 1);
    await page.evaluate(() => { window.Board3D.debug.tap('b2'); window.Board3D.debug.tap('a4'); });
    assert.equal(await st(page, 'sel'), 'a2', 'ignored while lost'); assert.deepEqual(await hist(page), SANS22, 'and no move was made on a stale picture');
    await page.evaluate(() => window.__ext.restoreContext());
    await page.waitForFunction(() => window.Board3D.debug.context().restoredN === 1 && window.Board3D.debug.ready() && window.Board3D.debug.idle(), null, { timeout: 15000 });
    await page.evaluate(() => window.Board3D.debug.tap('b2'));
    assert.equal(await st(page, 'sel'), 'b2', 'taps work again');
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
        failures++; results.push('FAIL ' + label + '\n     ' + String(e && e.message || e).split('\n').slice(0, 8).join('\n     ') + (process.env.G2_STACK ? '\n' + e.stack : ''));
        if (page && page.errors && page.errors.length) results.push('     page errors: ' + JSON.stringify(page.errors).slice(0, 400));
      } finally { if (page) await page.context().close(); }
    }
  } finally { await browser.close(); srv.close(); }
  console.log(results.join('\n'));
  console.log('\n' + (results.length - failures) + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})();
