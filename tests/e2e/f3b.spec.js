// E2E for slice F3b: the ad banner and consent (docs/specs/ads.product.md, A-D1 to A-D18).
// The native ads plugin is replaced by a fake window.Capacitor.Plugins.AdMob that records every call and can fire the
// plugin's events. No request ever goes to Google: the runner fails a case if anything leaves the page's origin.
// Run: F3B_VP=412 node tests/e2e/f3b.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// F3B_VP: 360 | 412 | 1280 | 915 (a phone held sideways, 915x412: the LAND case only). F3B_SHOTS=<dir> saves screenshots. F3B_ONLY=<regex> runs matching cases.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const assert = require('assert/strict');
const path = require('path');

const WWW = path.resolve(process.env.F3B_WWW || path.join(__dirname, '../../www'));
const PORT = 8000 + Math.floor(Math.random() * 900);
const ORIGIN = 'http://127.0.0.1:' + PORT;
const URL = ORIGIN + '/index.html';
const SHOTS = process.env.F3B_SHOTS || '';
const PKEY = 'suresh-chess-coach.profile.v1', GKEY = 'suresh-chess-coach.v1', TKEY = 'suresh-chess-coach.tab';
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }, { width: 915, height: 412 }].filter((v) => !process.env.F3B_VP || String(v.width) === process.env.F3B_VP);
const ONLY = process.env.F3B_ONLY ? new RegExp(process.env.F3B_ONLY) : null;
const NOW = Date.now(), DAY = 86400000;
const REAL = 'ca-app-pub-1437334216467981/6215501975', TEST = 'ca-app-pub-3940256099942544/9214589741';
const POLICY = 'https://hnchennai.github.io/privacy.html';
const FOUND = ['rules', 'special', 'board', 'values', 'mate', 'opening', 'blunder'];
const BH = 64; // the fake banner's height in dp (an adaptive banner on a phone is 50 to 90)

let browser, results = [], failures = 0;

const DONE = { learn: 1, practice: 1, apply: 1 };
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, Object.assign({}, DONE)]));
const dkey = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const played = (...backs) => Object.fromEntries(backs.map((b) => [dkey(b), { puz: 0, games: 1, course: 0, solved: 0 }]));
// A player on their second day or later (the default): the level was set yesterday and yesterday has a record.
function prof(o) {
  return Object.assign({ v: 5, level: 'beginner', levelT: NOW - DAY, placed: 'check', start: 'rules', rating: 600, rn: 0, games: [], puz: {}, course: {}, days: played(1), reviewed: [], t: NOW - DAY, theme: null, showAll: false, unlockAll: false, provisional: false, pgsDeclined: false, levelOfferT: 0 }, o);
}
const improver = (o) => prof(Object.assign({ level: 'improver', start: 'fork', rating: 1000 }, o));
const club = (o) => prof(Object.assign({ level: 'club', start: 'kq', rating: 1300, days: played(1, 2, 3, 4), levelT: NOW - 4 * DAY }, o));
// A player on their first day: every record is from today.
const dayOne = (o) => Object.assign({ levelT: NOW - 1000, t: NOW - 1000, days: played(0) }, o);
// 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6: White mates with Qxf7.
const MATE1 = { sans: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'], user: 'w', level: 1, ann: {}, notes: {}, tags: {}, fb: null, opp: null, evalW: 0, flipped: false, recorded: false, goal: null, t: NOW - 60000 };

function seedFn([pk, p, gk, g, tk, tab]) {
  if (sessionStorage.getItem('seeded')) return;
  if (p) localStorage.setItem(pk, JSON.stringify(p));
  if (g) localStorage.setItem(gk, JSON.stringify(g));
  if (tab) localStorage.setItem(tk, JSON.stringify(tab));
  sessionStorage.setItem('seeded', '1');
}
// The fake plugin, as the native bridge exposes it: window.Capacitor.Plugins.AdMob, promise methods, addListener(name, cb).
// cfg: status / form / can / privacy (Google's consent answers), formCan (canRequestAds after the form), holdConsent / holdForm
// (the answer waits for window.__ad.release.consent() / .form()), offline (the consent call fails), fill (false: no ad), h, web.
function fakeFn(cfg) {
  const A = window.__ad = { calls: [], ls: {}, shown: false, opts: null, release: {}, cards: [], cfg: Object.assign({ status: 'NOT_REQUIRED', form: false, can: true, privacy: 'NOT_REQUIRED', formCan: true, holdConsent: false, holdForm: false, offline: false, fill: true, h: 64, web: false }, cfg || {}) };
  const C = A.cfg, snap = () => { const c = window.__coach, s = c && c.st; return { mode: s ? s.mode : null, tab: s ? s.tab : null }; };
  const rec = (m, a) => A.calls.push(Object.assign({ m, a: a === undefined ? null : JSON.parse(JSON.stringify(a)), t: performance.now() }, snap()));
  const fire = (n, d) => (A.ls[n] || []).slice().forEach((f) => f(d));
  const info = () => ({ status: C.status, isConsentFormAvailable: C.form, canRequestAds: C.can, privacyOptionsRequirementStatus: C.privacy });
  const hold = (k) => new Promise((r) => { A.release[k] = r; });
  const size = () => fire('bannerAdSizeChanged', A.shown ? { width: Math.min(window.innerWidth, 728), height: C.h } : { width: 0, height: 0 });
  A.fire = fire;
  const P = {
    addListener(n, f) { rec('addListener', n); (A.ls[n] = A.ls[n] || []).push(f); return Promise.resolve({ remove() {} }); },
    requestConsentInfo(o) { rec('requestConsentInfo', o); if (C.offline) return Promise.reject(new Error('Network error')); return (C.holdConsent ? hold('consent') : Promise.resolve()).then(info); },
    showConsentForm() { rec('showConsentForm'); return (C.holdForm ? hold('form') : Promise.resolve()).then(() => { C.status = 'OBTAINED'; C.can = C.formCan; const i = info(); delete i.isConsentFormAvailable; return i; }); },
    showPrivacyOptionsForm() { rec('showPrivacyOptionsForm'); return Promise.resolve(); },
    initialize(o) { rec('initialize', o); return Promise.resolve(); },
    showBanner(o) {
      rec('showBanner', o); A.opts = o;
      setTimeout(() => { if (C.fill) { A.shown = true; size(); fire('bannerAdLoaded', {}); } else { A.shown = false; size(); fire('bannerAdFailedToLoad', { code: 2, message: 'Network error' }); } }, 30);
      return Promise.resolve();
    },
    hideBanner() { rec('hideBanner'); A.shown = false; setTimeout(size, 0); return Promise.resolve(); },
    resumeBanner() { rec('resumeBanner'); A.shown = true; setTimeout(size, 0); return Promise.resolve(); },
    removeBanner() { rec('removeBanner'); A.shown = false; setTimeout(size, 0); return Promise.resolve(); }
  };
  if (!C.web) window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { AdMob: P } };
  // When an end card (with its buttons) comes on screen: the time, for the 1 second rule.
  const IDS = ['gameEnd', 'learnEnd', 'sessionCard'], on = {};
  const scan = () => IDS.forEach((id) => { const e = document.getElementById(id), v = !!e && !e.hidden && !!e.querySelector('.ec-main') && e.offsetParent !== null; if (v && !on[id]) A.cards.push({ id, t: performance.now() }); on[id] = v; });
  document.addEventListener('DOMContentLoaded', () => { new MutationObserver(scan).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] }); scan(); });
}
async function newPage(vp, p, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.addInitScript(seedFn, [PKEY, p, GKEY, o.game || null, TKEY, o.tab || null]);
  await ctx.addInitScript(fakeFn, o.ads || {});
  const page = await ctx.newPage();
  if (process.env.F3B_TIMEOUT) { page.setDefaultTimeout(+process.env.F3B_TIMEOUT); page.setDefaultNavigationTimeout(60000); }
  page.errors = []; page.outside = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message/.test(m.text())) page.errors.push(m.type() + ': ' + m.text()); }); // headless WebGL's own performance notes aside
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ORIGIN + '/') && !/^(data|blob|about):/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u)) page.outside.push(u); });
  await page.goto(URL);
  try { await page.waitForFunction(() => window.__coach && window.Placement); }
  catch (e) { throw new Error('app did not start: ' + e.message.split('\n')[0] + ' | page errors: ' + JSON.stringify(page.errors)); }
  return page;
}
const st = (page, k) => page.evaluate((key) => window.__coach.st[key], k);
const vis = (page, sel) => page.locator(sel).first().isVisible();
const calls = (page) => page.evaluate(() => window.__ad.calls);
const names = async (page, withListeners) => (await calls(page)).map((c) => c.m).filter((m) => withListeners || m !== 'addListener');
const shown = (page) => page.evaluate(() => window.__ad.shown);
const waitShown = (page, yes) => page.waitForFunction((y) => window.__ad.shown === y, yes !== false, { timeout: 8000 });
const pad = (page) => page.evaluate(() => { const e = document.getElementById('adPad'); return e && !e.hidden ? e.getBoundingClientRect().height : 0; });
const waitPad = (page, h) => page.waitForFunction((x) => { const e = document.getElementById('adPad'); return (e && !e.hidden ? e.getBoundingClientRect().height : 0) === x; }, h, { timeout: 8000 });
const wide = (page) => page.evaluate(() => getComputedStyle(document.querySelector('.app')).gridTemplateColumns.split(' ').length > 1);
const fixedTabs = (page) => page.evaluate(() => getComputedStyle(document.querySelector('.tabs')).position === 'fixed');
const slotSel = async (page, sel) => ((await wide(page)) ? '#slotStrip' : sel);
const shot = async (page, vp, name) => { if (!SHOTS) return; await page.waitForTimeout(200); await page.screenshot({ path: path.join(SHOTS, vp.width + '_' + name + '.png') }); };
// Does `act` (run in the page) hide the banner before the next frame is drawn? Returns what the page saw one frame later.
const frameAfter = (page, act, arg) => page.evaluate(async ([src, a]) => {
  const n0 = window.__ad.calls.length, t0 = performance.now();
  (0, eval)('(' + src + ')')(a);
  const sync = { shown: window.__ad.shown, pad: !document.getElementById('adPad').hidden };
  await new Promise((r) => requestAnimationFrame(r));
  const after = window.__ad.calls.slice(n0).map((c) => c.m);
  return { sync, shown: window.__ad.shown, pad: !document.getElementById('adPad').hidden, calls: after, ms: performance.now() - t0 };
}, [act.toString(), arg]);
function hiddenInAFrame(r, why) {
  assert.equal(r.sync.shown, false, why + ': the banner is told to hide in the same step, before the screen changes');
  assert.equal(r.shown, false, why + ': hidden within one frame');
  assert.ok(r.calls.includes('hideBanner'), why + ': hideBanner was called: ' + JSON.stringify(r.calls));
  assert.ok(!r.calls.includes('showBanner') && !r.calls.includes('resumeBanner'), why + ': nothing shows it again: ' + JSON.stringify(r.calls));
  assert.equal(r.pad, false, why + ': the page padding goes with it (no gap)');
}
// Where the banner is on screen: a strip of height h, `margin` above the bottom edge.
const bannerBox = (page) => page.evaluate(() => { const o = window.__ad.opts, h = window.__ad.cfg.h; return { top: window.innerHeight - o.margin - h, bottom: window.innerHeight - o.margin, margin: o.margin, h }; });
// Criterion 5: with the page scrolled to its end, nothing a player reads or taps is under the banner, and no tab is.
async function nothingCovered(page, why) {
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight)); await page.waitForTimeout(120);
  const b = await bannerBox(page);
  const r = await page.evaluate((box) => {
    // on screen for real: not in a hidden panel, and not inside a closed <details> (a folded course level)
    const on = (e) => (e.offsetParent !== null || getComputedStyle(e).position === 'fixed') && e.checkVisibility({ checkVisibilityCSS: true });
    // the part of an element a player can see: its box, cut by every scrolling or clipping box it sits in
    const seen = (e) => { const q = e.getBoundingClientRect(); let top = q.top, bottom = q.bottom; for (let p = e.parentElement; p && p !== document.documentElement; p = p.parentElement) { if (getComputedStyle(p).overflowY !== 'visible') { const c = p.getBoundingClientRect(); top = Math.max(top, c.top); bottom = Math.min(bottom, c.bottom); } } return { top, bottom }; };
    const hit = (e) => { const q = seen(e); return q.bottom - q.top > 0.5 && q.bottom > box.top + 0.5 && q.top < box.bottom - 0.5 ? (e.id || e.className || e.tagName) + ' ' + Math.round(q.top) + '-' + Math.round(q.bottom) : null; };
    const main = document.querySelector('.wrap');
    const els = Array.from(main.querySelectorAll('button, a, .tipslot, .credit, .tab, h2, h3, p')).filter(on);
    return { covered: els.map(hit).filter(Boolean), tabs: document.querySelector('.tabs').getBoundingClientRect().top, atEnd: Math.abs(window.scrollY + window.innerHeight - document.documentElement.scrollHeight) < 1 };
  }, b);
  assert.equal(r.atEnd, true, why + ': scrolled to the end');
  assert.deepEqual(r.covered, [], why + ': nothing is under the banner (banner ' + Math.round(b.top) + '-' + Math.round(b.bottom) + ')');
  if (await fixedTabs(page)) assert.ok(Math.abs(r.tabs - b.bottom) < 0.5, why + ': the banner sits on top of the tab bar (' + b.bottom + ' / ' + r.tabs + ')');
  else assert.equal(b.margin, 0, why + ': no fixed tab bar, the banner is at the very bottom');
  await page.evaluate(() => window.scrollTo(0, 0));
}
// The request rules that hold for every call in every case (A-D5, A-D8, scenario 11).
function requestRules(cs, why) {
  cs.filter((c) => c.m === 'showBanner').forEach((c) => {
    assert.equal(c.a.adId, TEST, why + ': Google’s sample unit'); assert.equal(c.a.npa, true, why + ': non-personalised'); assert.equal(c.a.isTesting, true, why);
    assert.equal(c.a.position, 'BOTTOM_CENTER', why); assert.equal(c.a.adSize, 'ADAPTIVE_BANNER', why);
  });
  cs.filter((c) => c.m === 'initialize').forEach((c) => assert.deepEqual(c.a, { maxAdContentRating: 'ParentalGuidance' }, why + ': PG ceiling'));
  assert.ok(!JSON.stringify(cs).includes(REAL), why + ': the real ad unit is never used');
  const firstAd = cs.findIndex((c) => c.m === 'showBanner'), init = cs.findIndex((c) => c.m === 'initialize'), consent = cs.findIndex((c) => c.m === 'requestConsentInfo');
  if (cs.length) assert.equal(cs[0].m, 'requestConsentInfo', why + ': the consent check is the first plugin call');
  if (init >= 0) assert.ok(consent >= 0 && consent < init, why + ': consent before the SDK starts');
  if (firstAd >= 0) assert.ok(init >= 0 && init < firstAd, why + ': the SDK starts before the first ad request');
  if (firstAd >= 0) ['bannerAdSizeChanged', 'bannerAdLoaded', 'bannerAdFailedToLoad'].forEach((n) => { const i = cs.findIndex((c) => c.m === 'addListener' && c.a === n); assert.ok(i >= 0 && i < firstAd, why + ': listens for ' + n + ' before the first ad request'); });
  assert.equal(cs.filter((c) => c.m === 'initialize').length <= 1, true, why + ': the SDK starts once');
  // A-D3: nothing brings the banner on screen while a lesson or a review is open
  cs.filter((c) => c.m === 'showBanner' || c.m === 'resumeBanner' || c.m === 'showConsentForm').forEach((c) => assert.ok(c.mode !== 'lesson' && c.mode !== 'review', why + ': ' + c.m + ' during a ' + c.mode));
}
async function finishLesson(page) {
  await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
  for (let i = 0; i < 12 && (await st(page, 'mode')) === 'lesson'; i++) await page.locator('#navNext').click();
  assert.notEqual(await st(page, 'mode'), 'lesson');
}
async function escNote(page) { if (await vis(page, '#raniNote')) { await page.keyboard.press('Escape'); await page.waitForFunction(() => document.getElementById('raniNote').hidden); } }

const cases = [
  ['S1 / criterion 2: on the first day the app makes no ads plugin call and no network request, all day', async (vp) => {
    const page = await newPage(vp, improver(dayOne({ unlockAll: true })), { ads: { status: 'REQUIRED', form: true, can: false, privacy: 'REQUIRED' } });
    await page.waitForTimeout(600);
    await page.locator('#tab-progress').click(); await page.locator('#tab-path').click(); await page.locator('#tab-coach').click();
    await page.locator('#settingsBtn').click();
    assert.equal(await vis(page, '#settingsSheet [data-act="privacy"]'), true, '"Privacy policy" is there on day one');
    assert.equal(await vis(page, '#settingsSheet [data-act="privchoices"]'), false, 'no "Privacy choices": nothing was asked of Google');
    await page.locator('[data-act="settingsclose"]').click();
    await page.setViewportSize({ width: vp.height, height: vp.width }); await page.setViewportSize(vp);
    await page.waitForTimeout(1300);
    assert.deepEqual(await names(page, true), [], 'zero plugin calls');
    assert.equal(await pad(page), 0); assert.equal(await vis(page, '.tipslot'), false, 'no tip slot on day one either (F-D5)');
    // a reload later the same day: still nothing
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement); await page.waitForTimeout(700);
    assert.deepEqual(await names(page, true), [], 'zero plugin calls after a restart on day one');
    return page;
  }],
  ['S1b / A-D11: a new install (no level yet, the level check is open) makes no plugin call', async (vp) => {
    const page = await newPage(vp, null, {});
    await page.waitForFunction(() => window.Placement.isOpen()); await page.waitForTimeout(700);
    assert.deepEqual(await names(page, true), []);
    return page;
  }],
  ['S2 / criteria 1, 4, 5: second day, Beginner Home: a banner above the tab bar, the tip still in the page, Continue on the first screen', async (vp) => {
    const page = await newPage(vp, prof());
    await waitShown(page); await waitPad(page, BH);
    const cs = await calls(page);
    assert.deepEqual(cs.map((c) => c.m).filter((m) => m !== 'addListener'), ['requestConsentInfo', 'initialize', 'showBanner'], 'call order; no consent form outside Europe');
    requestRules(cs, 'Home');
    const phone = await fixedTabs(page);
    assert.equal(cs.find((c) => c.m === 'showBanner').a.margin, phone ? 56 : 0, 'A-D16: above the tab bar on phones, at the very bottom otherwise');
    const sel = await slotSel(page, '#homeSlot');
    assert.equal(await vis(page, sel), true, 'A-D2: Rani’s tip is still in the page');
    assert.match(await page.locator(sel).getAttribute('aria-label'), /^Rani’s tip: /);
    assert.equal(await page.evaluate(() => document.querySelectorAll('.tipslot:not([hidden])').length), 1, 'one tip, as before');
    const b = await bannerBox(page);
    const go = await page.evaluate(() => { const q = document.querySelector('#bhome .bh-go').getBoundingClientRect(); return { top: q.top, bottom: q.bottom, y: window.scrollY }; });
    if (vp.width === 412) assert.ok(go.y === 0 && go.top >= 0 && go.bottom <= b.top + 0.5, 'Continue is on the first screen above the banner at 412x915 (' + Math.round(go.bottom) + ' of ' + Math.round(b.top) + ')');
    await shot(page, vp, 'home_banner');
    await nothingCovered(page, 'Beginner Home');
    // A-D14: only the bottom of the page grew
    assert.equal(await page.evaluate(() => { const p = document.getElementById('adPad'), w = document.querySelector('.wrap'); return p.parentElement === w && !p.nextElementSibling && p.getBoundingClientRect().height; }), BH, 'the padding is the last thing in the page');
    return page;
  }],
  ['S3 / criterion 3: leaving Home hides the banner within a frame; it stays hidden through a lesson until its end card, then waits 1 second', async (vp) => {
    const page = await newPage(vp, prof());
    await waitShown(page); await waitPad(page, BH);
    hiddenInAFrame(await frameAfter(page, () => document.getElementById('tab-path').click()), 'tapping Learn');
    await page.locator('#tab-coach').click(); await waitShown(page); await waitPad(page, BH);
    assert.equal((await names(page)).filter((m) => m === 'showBanner').length, 1, 'coming back resumes the same banner: one ad request so far');
    hiddenInAFrame(await frameAfter(page, () => document.querySelector('#bhome .bh-go').click()), 'opening a lesson from Home');
    assert.equal(await st(page, 'mode'), 'lesson');
    const n0 = (await calls(page)).length;
    await page.locator('#navNext').click(); await page.waitForTimeout(1200);
    assert.equal(await shown(page), false, 'still hidden a second into the lesson');
    await finishLesson(page);
    await page.waitForFunction(() => window.__ad.cards.some((c) => c.id === 'learnEnd'));
    assert.equal(await shown(page), false, 'the end card comes first');
    await waitShown(page);
    const cs = await calls(page), card = (await page.evaluate(() => window.__ad.cards)).filter((c) => c.id === 'learnEnd').pop();
    const during = cs.slice(n0).filter((c) => c.m !== 'hideBanner');
    assert.equal(during.length, 1, 'one call since the lesson began: ' + JSON.stringify(during.map((c) => c.m)));
    assert.equal(during[0].m, 'resumeBanner');
    assert.ok(during[0].t - card.t >= 1000, 'criterion 6: no earlier than 1000ms after the card (' + Math.round(during[0].t - card.t) + 'ms)');
    assert.ok(during[0].t - card.t < 2500, 'and not much later (' + Math.round(during[0].t - card.t) + 'ms)');
    await waitPad(page, BH); requestRules(cs, 'lesson');
    await shot(page, vp, 'learn_end_banner');
    await nothingCovered(page, 'Learn end card');
    return page;
  }],
  ['S4, S5 / criterion 6: a finished game shows its end card at once and the banner at least 1 second later, clear of the board; a new game hides it straight away', async (vp) => {
    const page = await newPage(vp, club({ games: [] }), { game: MATE1, tab: 'play' });
    await page.waitForFunction(() => !window.__coach.st.busy); await page.waitForTimeout(700);
    assert.deepEqual(await names(page, true), [], 'A-D7: a game is going, so nothing ads-related has started (no consent check during an activity)');
    await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => window.__ad.cards.some((c) => c.id === 'gameEnd'), null, { timeout: 30000 });
    assert.equal(await shown(page), false, 'the card shows at once, without the banner');
    await page.waitForTimeout(500); assert.equal(await shown(page), false, 'not yet at half a second');
    await waitShown(page); await waitPad(page, BH);
    const cs = await calls(page), card = (await page.evaluate(() => window.__ad.cards)).filter((c) => c.id === 'gameEnd').pop(), sb = cs.find((c) => c.m === 'showBanner');
    assert.ok(sb.t - card.t >= 1000, 'no earlier than 1000ms after the card (' + Math.round(sb.t - card.t) + 'ms)');
    requestRules(cs, 'game end');
    const b = await bannerBox(page), board = await page.evaluate(() => { const q = document.getElementById('board').getBoundingClientRect(); return { top: q.top, bottom: q.bottom }; });
    assert.ok(board.bottom <= b.top || board.top >= b.bottom, 'the banner does not touch the board (board ' + Math.round(board.top) + '-' + Math.round(board.bottom) + ', banner ' + b.top + '-' + b.bottom + ')');
    assert.equal(b.margin, (await fixedTabs(page)) ? 56 : 0, 'A-D16: one strip at the bottom of the screen');
    await shot(page, vp, 'game_end_banner');
    await nothingCovered(page, 'game end card');
    hiddenInAFrame(await frameAfter(page, () => document.querySelector('#gameEnd [data-act="again"]').click()), 'New game from the end card');
    await page.waitForTimeout(1300); assert.equal(await shown(page), false, 'and it stays hidden in the new game');
    return page;
  }],
  ['S6 / criterion 7: offline on day three: the tip, no strip, no gap, no error', async (vp) => {
    const page = await newPage(vp, prof({ days: played(1, 2) }), { ads: { offline: true } });
    await page.waitForTimeout(1500);
    assert.deepEqual(await names(page), ['requestConsentInfo'], 'the consent check failed, so nothing else is asked');
    assert.equal(await shown(page), false); assert.equal(await pad(page), 0, 'no reserved space');
    assert.equal(await vis(page, await slotSel(page, '#homeSlot')), true, 'the tip is there');
    const h0 = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.locator('#tab-path').click(); await page.locator('#tab-coach').click(); await page.waitForTimeout(400);
    assert.deepEqual(await names(page), ['requestConsentInfo'], 'no retry storm while offline');
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), h0, 'the page is as tall as before');
    // back online: the start-up runs again and the banner comes
    await page.evaluate(() => { window.__ad.cfg.offline = false; window.dispatchEvent(new Event('online')); });
    await waitShown(page); await waitPad(page, BH);
    return page;
  }],
  ['S6b / criterion 7: no ad available: no strip, no reserved space, no console error', async (vp) => {
    const page = await newPage(vp, prof(), { ads: { fill: false } });
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'showBanner')); await page.waitForTimeout(600);
    assert.equal(await shown(page), false); assert.equal(await pad(page), 0, 'no reserved space');
    assert.equal(await vis(page, await slotSel(page, '#homeSlot')), true, 'the tip is there');
    await page.locator('#tab-path').click(); await page.locator('#tab-coach').click(); await page.waitForTimeout(500);
    assert.equal((await names(page)).filter((m) => m === 'showBanner').length, 1, 'no second request right away');
    assert.equal(await pad(page), 0);
    return page;
  }],
  ['S7 / criterion 8: Europe: the consent form shows once before any ad request; the SDK and the banner wait for the answer', async (vp) => {
    const page = await newPage(vp, prof(), { ads: { status: 'REQUIRED', form: true, can: false, privacy: 'REQUIRED', holdForm: true } });
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'showConsentForm')); await page.waitForTimeout(900);
    assert.deepEqual(await names(page, true), ['requestConsentInfo', 'showConsentForm'], 'nothing else until the form is answered: no SDK start, no ad request');
    assert.equal(await shown(page), false); assert.equal(await pad(page), 0);
    await page.evaluate(() => window.__ad.release.form());
    await waitShown(page); await waitPad(page, BH);
    const cs = await calls(page);
    assert.deepEqual(cs.map((c) => c.m).filter((m) => m !== 'addListener'), ['requestConsentInfo', 'showConsentForm', 'initialize', 'showBanner']);
    requestRules(cs, 'Europe');
    // S8: "Privacy choices" is in Settings and reopens Google's form
    await page.locator('#settingsBtn').click();
    assert.equal(await vis(page, '#settingsSheet [data-act="privchoices"]'), true);
    assert.equal((await page.locator('#settingsSheet [data-act="privchoices"]').innerText()).trim(), 'Privacy choices');
    assert.equal((await page.locator('#settingsSheet [data-act="privacy"]').innerText()).trim(), 'Privacy policy');
    await page.locator('#settingsSheet [data-act="privchoices"]').click();
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'showPrivacyOptionsForm'));
    await page.waitForTimeout(300);
    assert.equal((await names(page)).filter((m) => m === 'showConsentForm').length, 1, 'the consent form itself showed once');
    return page;
  }],
  ['S7b: Europe, consent refused and Google allows no ads: the app works as normal, with no banner and no ad request', async (vp) => {
    const page = await newPage(vp, prof(), { ads: { status: 'REQUIRED', form: true, can: false, privacy: 'REQUIRED', formCan: false } });
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'showConsentForm')); await page.waitForTimeout(900);
    assert.deepEqual(await names(page, true), ['requestConsentInfo', 'showConsentForm'], 'no SDK start and no ad request');
    assert.equal(await pad(page), 0); assert.equal(await vis(page, await slotSel(page, '#homeSlot')), true, 'the tip is there');
    await page.locator('#bhome .bh-go').click(); await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    await page.locator('#settingsBtn').click();
    assert.equal(await vis(page, '#settingsSheet [data-act="privchoices"]'), true, 'he can change his mind in Settings');
    return page;
  }],
  ['C8 / criterion 8: the consent form never opens during an activity: it waits for the lesson to end', async (vp) => {
    const page = await newPage(vp, prof(), { ads: { status: 'REQUIRED', form: true, can: false, privacy: 'REQUIRED', holdConsent: true } });
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'requestConsentInfo'));
    await page.locator('#bhome .bh-go').click(); await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    await page.evaluate(() => window.__ad.release.consent()); // Google answers while the lesson is open
    await page.locator('#navNext').click(); await page.waitForTimeout(600);
    assert.deepEqual(await names(page, true), ['requestConsentInfo'], 'no form over the lesson');
    await finishLesson(page);
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'showConsentForm'));
    const f = (await calls(page)).find((c) => c.m === 'showConsentForm');
    assert.notEqual(f.mode, 'lesson', 'the form opened after the lesson');
    await waitShown(page); requestRules(await calls(page), 'late form');
    return page;
  }],
  ['S8, S9 / criteria 3, 9: Settings has "Privacy policy" and no "Privacy choices" outside Europe; the banner hides while Settings is open', async (vp) => {
    const page = await newPage(vp, improver({ unlockAll: true }));
    await waitShown(page); await waitPad(page, BH);
    hiddenInAFrame(await frameAfter(page, () => document.getElementById('settingsBtn').click()), 'opening Settings');
    const rows = await page.evaluate(() => {
      const a = document.querySelector('#settingsSheet [data-act="privacy"]'), c = document.querySelector('#settingsSheet [data-act="privchoices"]'), q = a.getBoundingClientRect();
      return { text: a.textContent.trim(), href: a.getAttribute('href'), target: a.target, rel: a.rel, tag: a.tagName, h: q.height, w: q.width, choicesHidden: c.hidden || c.offsetParent === null, choicesText: c.textContent.trim(), last: !!a.closest('.sheet-panel > :last-child') };
    });
    assert.equal(rows.text, 'Privacy policy'); assert.equal(rows.href, POLICY); assert.equal(rows.tag, 'A'); assert.equal(rows.target, '_blank', 'opens outside the app'); assert.match(rows.rel, /noopener/);
    assert.ok(rows.h >= 44 && rows.w >= 44, '44px target: ' + rows.h); assert.equal(rows.choicesHidden, true, 'no "Privacy choices" where Google reports no choice'); assert.equal(rows.choicesText, 'Privacy choices');
    assert.equal(rows.last, true, 'the rows are the last card in Settings');
    // the keyboard reaches the row inside the sheet (focus stays trapped in the dialog)
    const order = []; for (let i = 0; i < 40 && order.filter((x) => x === 'settingsclose').length < 2; i++) { await page.keyboard.press('Tab'); order.push(await page.evaluate(() => { const a = document.activeElement; return (a.dataset && a.dataset.act) || a.id || a.tagName; })); }
    assert.ok(order.includes('privacy'), 'Tab reaches "Privacy policy": ' + order.join(','));
    assert.ok(order.every((x) => x !== 'BODY' && !/^tab-/.test(x)), 'focus stays in the sheet: ' + order.join(','));
    await shot(page, vp, 'settings_privacy');
    await page.waitForTimeout(1200); assert.equal(await shown(page), false, 'hidden for as long as the sheet is open');
    await page.keyboard.press('Escape'); await waitShown(page); await waitPad(page, BH);
    assert.equal((await names(page)).filter((m) => m === 'showBanner').length, 1, 'the same banner comes back: no new ad request');
    // the level check is a full-screen sheet too
    hiddenInAFrame(await frameAfter(page, () => window.__coach.openPlacement(true)), 'opening the level check');
    await page.locator('#placement .pl-x').first().click(); await page.waitForFunction(() => !window.Placement.isOpen());
    await escNote(page); await waitShown(page);
    return page;
  }],
  ['S9b / A-D12: the level-up offer keeps the banner away until it is answered', async (vp) => {
    const page = await newPage(vp, prof({ course: done(...FOUND), levelT: NOW - 8 * DAY, days: played(1, 8) }));
    await page.waitForFunction(() => !document.getElementById('raniNote').hidden && !!document.querySelector('#raniNote [data-act="offerno"]'));
    await page.waitForTimeout(900);
    assert.equal(await shown(page), false, 'no banner under the offer'); assert.equal(await pad(page), 0);
    await page.locator('#raniNote [data-act="offerno"]').click(); await page.waitForTimeout(300);
    assert.equal(await shown(page), false, 'Rani’s answer is still on screen');
    await page.locator('#raniNote [data-act="notedone"]').click();
    await waitShown(page); await waitPad(page, BH);
    // a note that arrives while the banner is showing hides it at once
    hiddenInAFrame(await frameAfter(page, () => document.getElementById('settingsBtn').click()), 'a sheet over the banner');
    await page.keyboard.press('Escape'); await waitShown(page);
    requestRules(await calls(page), 'offer');
    return page;
  }],
  ['C5 / criterion 5: Progress with the banner: the tip, the credits and every button stay clear of it', async (vp) => {
    const page = await newPage(vp, improver({ unlockAll: true }), { tab: 'progress' });
    await waitShown(page); await waitPad(page, BH);
    assert.equal(await vis(page, await slotSel(page, '#progSlot')), true, 'the tip is still on Progress');
    await nothingCovered(page, 'Progress');
    const credit = await page.locator('#panel-progress .credit').allInnerTexts();
    assert.ok(credit.join(' ').includes('LICENSE-EXCEPTION'), 'criterion 14: the credit names the exception');
    assert.ok(credit.join(' ').includes('Analysis by Stockfish 19'), 'the Stockfish credit stays');
    await shot(page, vp, 'progress_banner');
    // Home to Progress and back: both are slot screens, the banner stays
    const n0 = (await calls(page)).length;
    await page.locator('#tab-coach').click(); await page.waitForTimeout(300);
    assert.equal(await shown(page), true); assert.deepEqual((await calls(page)).slice(n0).map((c) => c.m), [], 'no plugin call between two slot screens');
    await nothingCovered(page, 'Improver Home');
    return page;
  }],
  ['S10 / criterion 3: turning the phone sideways hides the banner; upright again it returns', async (vp) => {
    const page = await newPage(vp, prof());
    await waitShown(page); await waitPad(page, BH);
    await page.setViewportSize({ width: 915, height: 412 });
    await waitShown(page, false); await waitPad(page, 0);
    const go = await page.evaluate(() => { const q = document.querySelector('#bhome .bh-go').getBoundingClientRect(); return { top: q.top, bottom: q.bottom, h: window.innerHeight }; });
    assert.ok(go.top >= 0 && go.bottom <= go.h + 0.5, 'Continue is on the first screen sideways');
    await page.waitForTimeout(1200); assert.equal(await shown(page), false);
    await page.setViewportSize(vp); await waitShown(page); await waitPad(page, BH);
    // 499px tall is still too short; 500 is enough
    await page.setViewportSize({ width: vp.width, height: 499 }); await waitShown(page, false);
    await page.setViewportSize({ width: vp.width, height: 500 }); await waitShown(page);
    return page;
  }],
  ['LAND / S10: a phone held sideways (915x412) gets no banner at all, and Continue is on the first screen', async (vp) => {
    const page = await newPage({ width: 915, height: 412 }, prof());
    await page.waitForTimeout(1500);
    const n = await names(page);
    assert.ok(!n.includes('showBanner') && !n.includes('resumeBanner'), 'no ad request sideways: ' + n.join(','));
    assert.equal(await pad(page), 0);
    const go = await page.evaluate(() => { const q = document.querySelector('#bhome .bh-go').getBoundingClientRect(); return { top: q.top, bottom: q.bottom, h: window.innerHeight, y: window.scrollY }; });
    assert.ok(go.y === 0 && go.top >= 0 && go.bottom <= go.h + 0.5, 'Continue is on the first screen');
    return page;
  }],
  ['S12 / criterion 11: the web version: no plugin, nothing ads-related runs, the same screens as today', async (vp) => {
    const page = await newPage(vp, prof(), { ads: { web: true } });
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => typeof window.Capacitor), 'undefined');
    assert.deepEqual(await names(page, true), []);
    assert.equal(await page.evaluate(() => window.__coach.ads().state), 'off');
    assert.equal(await pad(page), 0); assert.equal(await vis(page, await slotSel(page, '#homeSlot')), true, 'the tip, as today');
    await page.locator('#bhome .bh-go').click(); await finishLesson(page); await page.waitForTimeout(1300);
    assert.equal(await pad(page), 0);
    await page.locator('#settingsBtn').click();
    assert.equal(await vis(page, '#settingsSheet [data-act="privacy"]'), true, '"Privacy policy" is for everyone');
    assert.equal(await vis(page, '#settingsSheet [data-act="privchoices"]'), false);
    return page;
  }],
  ['S12b: a Capacitor object that is not the native app (or has no ads plugin) changes nothing', async (vp) => {
    const page = await newPage(vp, prof(), { ads: {} });
    await page.evaluate(() => { window.__ad.calls.length = 0; });
    const ctx = page.context(); await ctx.addInitScript(() => { window.Capacitor.isNativePlatform = () => false; });
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement); await page.waitForTimeout(1200);
    assert.deepEqual(await names(page, true), [], 'not native: no call');
    assert.equal(await page.evaluate(() => window.__coach.ads().state), 'off');
    return page;
  }]
];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.nnue': 'application/octet-stream' };
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
      if ((vp.width === 915) !== /^LAND/.test(name)) continue; // 915x412 (a phone held sideways) runs the LAND case only
      const label = vp.width + 'x' + vp.height + ' ' + name;
      let page;
      try {
        page = await fn(vp);
        assert.deepEqual(page.errors, [], 'console errors or warnings');
        assert.deepEqual(page.outside, [], 'no request leaves the page origin');
        assert.ok(!JSON.stringify(await calls(page)).includes(REAL), 'the real ad unit is never used');
        results.push('ok   ' + label);
      } catch (e) {
        failures++; results.push('FAIL ' + label + '\n     ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n     ') + (process.env.F3B_STACK ? '\n' + e.stack : ''));
      } finally { if (page) await page.context().close(); }
    }
  } finally { await browser.close(); srv.close(); }
  console.log(results.join('\n'));
  console.log('\n' + (results.length - failures) + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})();
