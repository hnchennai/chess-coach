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
const GAP = 8; // dp between the banner and the tab bar on phones

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
// The same game after Qxf7#: finished and already recorded.
const MATE_DONE = Object.assign({}, MATE1, { sans: MATE1.sans.concat(['Qxf7#']), recorded: true });

// The fake plugin, as the native bridge exposes it: window.Capacitor.Plugins.AdMob, promise methods, addListener(name, cb).
// It behaves like the real one where that matters: hideBanner rejects before a banner exists, resumeBanner reports the
// banner's size even when no ad has loaded yet, a failed load removes the banner, showBanner on an existing banner moves it.
// cfg: status / form / can / privacy (Google's consent answers), formCan (canRequestAds after the form), holdConsent / holdForm /
// slow (the answer, the form or the ad waits for window.__ad.release.consent() / .form() / .load()), offline (the consent call
// fails), fill (false: no ad), resumeFails, h (banner height), web (no Capacitor at all).
function fakeFn(cfg) {
  const A = window.__ad = { calls: [], ls: {}, view: false, visible: false, loaded: false, opts: null, release: {}, cards: [], cfg: Object.assign({ status: 'NOT_REQUIRED', form: false, can: true, privacy: 'NOT_REQUIRED', formCan: true, holdConsent: false, holdForm: false, slow: false, offline: false, fill: true, resumeFails: false, h: 64, web: false }, cfg || {}) };
  Object.defineProperty(A, 'shown', { get() { return A.view && A.visible && A.loaded; } }); // an ad the player can see
  const C = A.cfg, snap = () => { const c = window.__coach, s = c && c.st; return { mode: s ? s.mode : null, tab: s ? s.tab : null }; };
  const rec = (m, a) => A.calls.push(Object.assign({ m, a: a === undefined ? null : JSON.parse(JSON.stringify(a)), t: performance.now() }, snap()));
  const fire = (n, d) => (A.ls[n] || []).slice().forEach((f) => f(d));
  const info = () => ({ status: C.status, isConsentFormAvailable: C.form, canRequestAds: C.can, privacyOptionsRequirementStatus: C.privacy });
  const hold = (k) => new Promise((r) => { A.release[k] = r; });
  const size = (on) => fire('bannerAdSizeChanged', on ? { width: Math.min(window.innerWidth, 728), height: C.h } : { width: 0, height: 0 });
  A.fire = fire;
  const P = {
    addListener(n, f) { rec('addListener', n); (A.ls[n] = A.ls[n] || []).push(f); return Promise.resolve({ remove() {} }); },
    requestConsentInfo(o) { rec('requestConsentInfo', o); if (C.offline) return Promise.reject(new Error('Network error')); return (C.holdConsent ? hold('consent') : Promise.resolve()).then(info); },
    showConsentForm() { rec('showConsentForm'); return (C.holdForm ? hold('form') : Promise.resolve()).then(() => { C.status = 'OBTAINED'; C.can = C.formCan; const i = info(); delete i.isConsentFormAvailable; return i; }); },
    showPrivacyOptionsForm() { rec('showPrivacyOptionsForm'); return Promise.resolve(); },
    initialize(o) { rec('initialize', o); return Promise.resolve(); },
    showBanner(o) {
      rec('showBanner', o); A.opts = o;
      if (A.view) return Promise.resolve(); // an existing banner is moved: same ad, no new request, nothing fired
      A.view = true; A.visible = true; A.loaded = false;
      (C.slow ? hold('load') : new Promise((r) => setTimeout(r, 30))).then(() => {
        if (!A.view) return;
        if (C.fill) { A.loaded = true; size(true); fire('bannerAdLoaded', {}); } else { A.view = false; A.visible = false; size(false); fire('bannerAdFailedToLoad', { code: 3, message: 'No fill' }); }
      });
      return Promise.resolve();
    },
    hideBanner() { rec('hideBanner'); if (!A.view) return Promise.reject(new Error('You tried to hide a banner that was never shown')); A.visible = false; setTimeout(() => size(false), 0); return Promise.resolve(); },
    resumeBanner() { rec('resumeBanner'); if (C.resumeFails) return Promise.reject(new Error('resume failed')); if (A.view) { A.visible = true; setTimeout(() => size(true), 0); } return Promise.resolve(); },
    removeBanner() { rec('removeBanner'); A.view = false; A.visible = false; A.loaded = false; setTimeout(() => size(false), 0); return Promise.resolve(); }
  };
  if (!C.web) window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { AdMob: P } };
  // When an end card (with its buttons) comes on screen: the time, for the 1 second rule.
  const IDS = ['gameEnd', 'learnEnd', 'sessionCard', 'reviewEnd'], on = {};
  const scan = () => IDS.forEach((id) => { const e = document.getElementById(id), v = !!e && !e.hidden && !!e.querySelector('.ec-main') && e.offsetParent !== null; if (v && !on[id]) A.cards.push({ id, t: performance.now() }); on[id] = v; });
  document.addEventListener('DOMContentLoaded', () => { new MutationObserver(scan).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['hidden'] }); scan(); });
}
// The app's clock, moved forward by what sessionStorage 'clock' holds (ms): "the next day" for a restart in the same test.
function clockFn() { const off = +sessionStorage.getItem('clock') || 0; if (off) { const N = Date.now.bind(Date); Date.now = () => N() + off; } }
// o: { game, tab, ads (the fake's cfg), fakeTimers (Playwright's clock, so a test can jump a minute ahead) }
// A-D19: on Home the banner never shares the screen with the board. Wide screens show the board beside every Home (Beginner
// too), so there the cases that need a banner on a slot screen use Progress.
const W = (vp) => vp.width > 860;
const slotTab = (vp) => (W(vp) ? 'progress' : 'coach');
const slotId = (vp) => (W(vp) ? '#progSlot' : '#homeSlot');
// A Beginner has no Progress tab unless Show everything is on, so the wide cases turn it on (the rules are the same either way).
const bprof = (vp, o) => prof(Object.assign(W(vp) ? { showAll: true } : {}, o));
const startOn = (vp, o) => Object.assign(W(vp) ? { tab: 'progress' } : {}, o);
async function newPage(vp, p, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.addInitScript(seedFn, [PKEY, p, GKEY, o.game || null, TKEY, o.tab || null]);
  await ctx.addInitScript(clockFn);
  await ctx.addInitScript(fakeFn, o.ads || {});
  const page = await ctx.newPage();
  if (o.fakeTimers) await page.clock.install();
  if (process.env.F3B_TIMEOUT) { page.setDefaultTimeout(+process.env.F3B_TIMEOUT); page.setDefaultNavigationTimeout(60000); }
  page.errors = []; page.outside = []; page.reqs = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message/.test(m.text())) page.errors.push(m.type() + ': ' + m.text()); }); // headless WebGL's own performance notes aside
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('request', (r) => { const u = r.url(); page.reqs.push(u); if (!u.startsWith(ORIGIN + '/') && !/^(data|blob|about):/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u)) page.outside.push(u); });
  await page.goto(URL);
  try { await page.waitForFunction(() => window.__coach && window.Placement); }
  catch (e) { throw new Error('app did not start: ' + e.message.split('\n')[0] + ' | page errors: ' + JSON.stringify(page.errors)); }
  return page;
}
const st = (page, k) => page.evaluate((key) => window.__coach.st[key], k);
const vis = (page, sel) => page.locator(sel).first().isVisible();
const calls = (page) => page.evaluate(() => window.__ad.calls);
const names = async (page, withListeners) => (await calls(page)).map((c) => c.m).filter((m) => withListeners || m !== 'addListener');
const count = async (page, m) => (await calls(page)).filter((c) => c.m === m).length;
const shown = (page) => page.evaluate(() => window.__ad.shown);
const now = (page) => page.evaluate(() => performance.now());
const waitShown = (page, yes) => page.waitForFunction((y) => window.__ad.shown === y, yes !== false, { timeout: 8000 });
const padNow = (page) => page.evaluate(() => { const e = document.getElementById('adPad'); return e && !e.hidden ? e.getBoundingClientRect().height : 0; });
const wide = (page) => page.evaluate(() => getComputedStyle(document.querySelector('.app')).gridTemplateColumns.split(' ').length > 1);
const fixedTabs = (page) => page.evaluate(() => getComputedStyle(document.querySelector('.tabs')).position === 'fixed');
// A-D14 and fix 5: the page padding is the banner's height, plus the 8dp gap above the tab bar on phones.
const padWant = async (page) => BH + ((await fixedTabs(page)) ? GAP : 0);
const waitPad = async (page, h) => { const x = h === undefined ? await padWant(page) : h; return page.waitForFunction((y) => { const e = document.getElementById('adPad'); return (e && !e.hidden ? e.getBoundingClientRect().height : 0) === y; }, x, { timeout: 8000 }); };
const marginWant = async (page) => ((await fixedTabs(page)) ? 56 + GAP : 0);
const slotSel = async (page, sel) => ((await wide(page)) ? '#slotStrip' : sel);
const shot = async (page, vp, name) => { if (!SHOTS) return; await page.waitForTimeout(200); await page.screenshot({ path: path.join(SHOTS, vp.width + '_' + name + '.png') }); };
// The banner on screen with its padding, as every case that needs "the banner is showing" starts.
const ready = async (page) => { await waitShown(page); await waitPad(page); };
// Does `act` (run in the page) hide the banner before the next frame is drawn? Returns what the page saw one frame later.
const frameAfter = (page, act, arg) => page.evaluate(async ([src, a]) => {
  const n0 = window.__ad.calls.length, t0 = performance.now();
  (0, eval)('(' + src + ')')(a);
  const sync = { shown: window.__ad.shown, pad: !document.getElementById('adPad').hidden };
  await new Promise((r) => requestAnimationFrame(r));
  const after = window.__ad.calls.slice(n0).map((c) => c.m);
  return { sync, shown: window.__ad.shown, pad: !document.getElementById('adPad').hidden, calls: after, t0, ms: performance.now() - t0 };
}, [act.toString(), arg]);
function hiddenInAFrame(r, why) {
  assert.equal(r.sync.shown, false, why + ': the banner is told to hide in the same step, before the screen changes');
  assert.equal(r.shown, false, why + ': hidden within one frame');
  assert.ok(r.calls.includes('hideBanner'), why + ': hideBanner was called: ' + JSON.stringify(r.calls));
  assert.ok(!r.calls.includes('showBanner') && !r.calls.includes('resumeBanner'), why + ': nothing shows it again: ' + JSON.stringify(r.calls));
  assert.equal(r.pad, false, why + ': the page padding goes with it (no gap)');
  return r.t0;
}
// Fix 5 (accidental taps): the banner came back with one call, no sooner than 1000ms after `since` (a time in the page's clock:
// the tap that brought the screen, or the moment its card was drawn). n0: how many plugin calls there were before.
async function backAfterDelay(page, n0, since, why, how) {
  await waitShown(page);
  const cs = (await calls(page)).slice(n0).filter((c) => c.m !== 'hideBanner');
  assert.deepEqual(cs.map((c) => c.m), [how || 'resumeBanner'], why + ': one call brings it back');
  assert.ok(cs[0].t - since >= 1000, why + ': no sooner than 1000ms (' + Math.round(cs[0].t - since) + 'ms)');
  assert.ok(cs[0].t - since < 3000, why + ': and not much later (' + Math.round(cs[0].t - since) + 'ms)');
  await waitPad(page);
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
  if (await fixedTabs(page)) assert.ok(Math.abs(r.tabs - b.bottom - GAP) < 0.5, why + ': an 8dp gap between the banner and the tab bar (' + b.bottom + ' / ' + r.tabs + ')');
  else assert.equal(b.margin, 0, why + ': no fixed tab bar, the banner is at the very bottom');
  await page.evaluate(() => window.scrollTo(0, 0));
}
// The request rules that hold for every call in every case (A-D5, A-D8, scenario 11).
function requestRules(cs, why) {
  cs.filter((c) => c.m === 'showBanner').forEach((c) => {
    assert.equal(c.a.adId, TEST, why + ': Google’s sample unit'); assert.equal(c.a.npa, true, why + ': non-personalised'); assert.equal(c.a.isTesting, true, why);
    assert.equal(c.a.position, 'BOTTOM_CENTER', why); assert.equal(c.a.adSize, 'ADAPTIVE_BANNER', why);
    assert.ok(c.a.margin === 0 || c.a.margin === 56 + GAP, why + ': margin ' + c.a.margin);
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
  cs.filter((c) => c.m === 'showBanner' || c.m === 'resumeBanner').forEach((c) => assert.ok(c.mode !== 'lesson' && c.mode !== 'review', why + ': ' + c.m + ' during a ' + c.mode));
  // fix 5: the first ad request is at least 1000ms after the app's start-up (the consent check is made as the app starts)
  if (firstAd >= 0) assert.ok(cs[firstAd].t - cs[consent].t >= 1000, why + ': the first banner no sooner than 1000ms after the first screen (' + Math.round(cs[firstAd].t - cs[consent].t) + 'ms)');
}
async function finishLesson(page) {
  await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
  for (let i = 0; i < 12 && (await st(page, 'mode')) === 'lesson'; i++) await page.locator('#navNext').click();
  assert.notEqual(await st(page, 'mode'), 'lesson');
}
async function escNote(page) { if (await vis(page, '#raniNote')) { await page.keyboard.press('Escape'); await page.waitForFunction(() => document.getElementById('raniNote').hidden); } }
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
// A whole puzzle set, shortened: jump to its last puzzle, solve it, tap Next. The set's end card follows.
async function playSet(page) {
  await page.evaluate(() => window.__coach.trainStart('rated'));
  await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.pz);
  await page.evaluate(() => { const s = window.__coach.st.ses; s.i = s.count - 1; s.right = s.count - 1; s.wrong = 0; });
  await solvePuzzle(page);
  await page.locator('#sessionCard [data-act="next"]').click();
  await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished);
}
// Nothing brings the banner on for a second and a half, and it is not on screen.
async function staysAway(page, why) {
  const n0 = (await calls(page)).length;
  await page.waitForTimeout(1600);
  assert.equal(await shown(page), false, why + ': no banner');
  assert.deepEqual((await calls(page)).slice(n0).map((c) => c.m).filter((m) => m !== 'hideBanner'), [], why + ': no plugin call');
  assert.equal(await padNow(page), 0, why + ': no padding');
}

const cases = [
  ['S1 / criterion 2: on the first day the app makes no ads plugin call and no network request, all day, and none after midnight until the next app start', async (vp) => {
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
    assert.equal(await padNow(page), 0); assert.equal(await vis(page, '.tipslot'), false, 'no tip slot on day one either (F-D5)');
    // a restart later the same day: still nothing
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement); await page.waitForTimeout(700);
    assert.deepEqual(await names(page, true), [], 'zero plugin calls after a restart on day one');
    // the app stays open over midnight: the tip may come, the ads start-up does not (A-D7: it runs at app start only)
    await page.evaluate((d) => { const N = Date.now.bind(Date); Date.now = () => N() + d; }, DAY);
    await page.locator('#tab-progress').click(); await page.locator('#tab-coach').click();
    await page.evaluate(() => { window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => window.__coach.getProf().level), 'improver');
    assert.deepEqual(await names(page, true), [], 'zero plugin calls after midnight in the same session');
    assert.equal(await padNow(page), 0);
    // the next app start, on day two: now the start-up runs
    await page.evaluate((d) => sessionStorage.setItem('clock', String(d)), DAY);
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'showConsentForm'));
    assert.equal((await calls(page))[0].m, 'requestConsentInfo', 'day two, at app start');
    return page;
  }],
  ['S1b / A-D11: a new install (no level yet, the level check is open) makes no plugin call', async (vp) => {
    const page = await newPage(vp, null, {});
    await page.waitForFunction(() => window.Placement.isOpen()); await page.waitForTimeout(700);
    assert.deepEqual(await names(page, true), []);
    return page;
  }],
  ['S2 / criteria 1, 4, 5: second day, Beginner Home: a banner above the tab bar after a second, the tip still in the page, Continue on the first screen', async (vp) => {
    const page = await newPage(vp, bprof(vp), startOn(vp));
    assert.ok(page.reqs.some((u) => u === ORIGIN + '/js/ads.js'), 'A-D9: inside the Android app the ads rules are loaded');
    assert.equal(await page.evaluate(() => typeof window.Ads), 'object');
    await ready(page);
    const cs = await calls(page);
    assert.deepEqual(cs.map((c) => c.m).filter((m) => m !== 'addListener'), ['requestConsentInfo', 'initialize', 'showBanner'], 'call order; no consent form outside Europe');
    requestRules(cs, 'Home');
    const phone = await fixedTabs(page);
    assert.equal(cs.find((c) => c.m === 'showBanner').a.margin, phone ? 64 : 0, 'A-D16: above the tab bar with an 8dp gap on phones, at the very bottom otherwise');
    assert.equal(await padNow(page), phone ? BH + 8 : BH, 'A-D14: the padding is the banner, plus the gap on phones');
    const sel = await slotSel(page, slotId(vp));
    assert.equal(await vis(page, sel), true, 'A-D2: Rani’s tip is still in the page');
    assert.match(await page.locator(sel).getAttribute('aria-label'), /^Rani’s tip: /);
    assert.equal(await page.evaluate(() => document.querySelectorAll('.tipslot:not([hidden])').length), 1, 'one tip, as before');
    const b = await bannerBox(page);
    const go = W(vp) ? null : await page.evaluate(() => { const q = document.querySelector('#bhome .bh-go').getBoundingClientRect(); return { top: q.top, bottom: q.bottom, y: window.scrollY }; });
    if (vp.width === 412) assert.ok(go.y === 0 && go.top >= 0 && go.bottom <= b.top + 0.5, 'Continue is on the first screen above the banner at 412x915 (' + Math.round(go.bottom) + ' of ' + Math.round(b.top) + ')');
    await shot(page, vp, 'home_banner');
    await nothingCovered(page, 'Beginner Home');
    // A-D14: only the bottom of the page grew
    assert.equal(await page.evaluate(() => { const p = document.getElementById('adPad'), w = document.querySelector('.wrap'); return p.parentElement === w && !p.nextElementSibling; }), true, 'the padding is the last thing in the page');
    return page;
  }],
  ['S3 / criterion 3: leaving Home hides the banner within a frame; it stays hidden through a lesson until its end card, then waits 1 second', async (vp) => {
    const page = await newPage(vp, bprof(vp), startOn(vp));
    await ready(page);
    hiddenInAFrame(await frameAfter(page, () => document.getElementById('tab-path').click()), 'tapping Learn');
    let n0 = (await calls(page)).length, t0 = await now(page);
    await page.locator('#tab-' + slotTab(vp)).click();
    await backAfterDelay(page, n0, t0, 'back on the slot screen');
    assert.equal(await count(page, 'showBanner'), 1, 'coming back resumes the same banner: one ad request so far');
    if (W(vp)) { // A-D19: wide Home has the board beside it, so going there hides the banner; the lesson starts from a Home with none
      hiddenInAFrame(await frameAfter(page, () => document.getElementById('tab-coach').click()), 'Progress to a Home with the board');
      await staysAway(page, 'wide Beginner Home, the board beside it');
      await page.evaluate(() => window.__coach.startPart('rules', 'learn'));
    } else hiddenInAFrame(await frameAfter(page, () => document.querySelector('#bhome .bh-go').click()), 'opening a lesson from Home');
    assert.equal(await st(page, 'mode'), 'lesson');
    n0 = (await calls(page)).length;
    await page.locator('#navNext').click(); await page.waitForTimeout(1200);
    assert.equal(await shown(page), false, 'still hidden a second into the lesson');
    await finishLesson(page);
    await page.waitForFunction(() => window.__ad.cards.some((c) => c.id === 'learnEnd'));
    assert.equal(await shown(page), false, 'the end card comes first');
    const card = (await page.evaluate(() => window.__ad.cards)).filter((c) => c.id === 'learnEnd').pop();
    await backAfterDelay(page, n0, card.t, 'criterion 6, the Learn end card');
    requestRules(await calls(page), 'lesson');
    await shot(page, vp, 'learn_end_banner');
    await nothingCovered(page, 'Learn end card');
    return page;
  }],
  ['S4, S5 / criterion 6: a finished game’s end card shows at once and the banner at least 1 second later, clear of the board; a new game hides it straight away', async (vp) => {
    const page = await newPage(vp, club({ games: [] }), { game: MATE_DONE, tab: 'progress' }); // A-D19: Club Home is the board screen, so the banner starts on Progress
    await ready(page);
    const r = await frameAfter(page, () => document.getElementById('tab-play').click());
    hiddenInAFrame(r, 'going to the end card');
    await page.waitForFunction(() => window.__ad.cards.some((c) => c.id === 'gameEnd'));
    assert.equal(await shown(page), false, 'the card shows at once, without the banner');
    await page.waitForTimeout(500); assert.equal(await shown(page), false, 'not yet at half a second');
    const card = (await page.evaluate(() => window.__ad.cards)).filter((c) => c.id === 'gameEnd').pop(), n0 = (await calls(page)).findIndex((c) => c.t >= r.t0);
    await backAfterDelay(page, n0, card.t, 'the game end card');
    requestRules(await calls(page), 'game end');
    const b = await bannerBox(page), board = await page.evaluate(() => { const q = document.getElementById('board').getBoundingClientRect(); return { top: q.top, bottom: q.bottom }; });
    assert.ok(board.bottom <= b.top || board.top >= b.bottom, 'the banner does not touch the board (board ' + Math.round(board.top) + '-' + Math.round(board.bottom) + ', banner ' + b.top + '-' + b.bottom + ')');
    assert.equal(b.margin, await marginWant(page), 'A-D16: one strip at the bottom of the screen');
    await shot(page, vp, 'game_end_banner');
    await nothingCovered(page, 'game end card');
    hiddenInAFrame(await frameAfter(page, () => document.querySelector('#gameEnd [data-act="again"]').click()), 'New game from the end card');
    await staysAway(page, 'in the new game');
    return page;
  }],
  ['F-D17: the review of a finished game has no banner, and neither has its last card', async (vp) => {
    const page = await newPage(vp, club({ games: [] }), { game: MATE_DONE, tab: 'play' });
    await ready(page);
    hiddenInAFrame(await frameAfter(page, () => document.querySelector('#gameEnd [data-act="review"]').click()), 'opening the review');
    assert.equal(await st(page, 'mode'), 'review');
    await page.locator('#navPrev').click(); await page.locator('#navNext').click();
    await page.waitForFunction(() => !document.getElementById('reviewEnd').hidden);
    await staysAway(page, 'the review-finished card');
    requestRules(await calls(page), 'review');
    return page;
  }],
  ['F-D32: a puzzle set’s end card gets the banner after a second; with a game unfinished, the set’s end card and a Learn end card get none', async (vp) => {
    const page = await newPage(vp, improver({ unlockAll: true }), { tab: 'progress' });
    await ready(page);
    // 1. no game: the set's end card, then the banner
    let n0 = (await calls(page)).length;
    await playSet(page);
    await page.waitForFunction(() => window.__ad.cards.some((c) => c.id === 'sessionCard'));
    let card = (await page.evaluate(() => window.__ad.cards)).filter((c) => c.id === 'sessionCard').pop();
    assert.equal(await shown(page), false, 'the card first');
    const during = (await calls(page)).slice(n0).filter((c) => c.m !== 'hideBanner');
    assert.deepEqual(during.map((c) => c.m), [], 'nothing showed the banner during the set');
    await backAfterDelay(page, n0, card.t, 'the set’s end card');
    await nothingCovered(page, 'puzzle set end card');
    // 2. a game is going (one move played): no banner on a set's end card
    await page.locator('#sessionCard [data-act="home"]').click(); await page.locator('#tab-play').click();
    await page.locator('#board .sq[data-sq="e2"]').click(); await page.locator('#board .sq[data-sq="e4"]').click();
    await page.waitForFunction(() => window.__coach.hist().length >= 1);
    await playSet(page);
    await page.waitForFunction(() => window.__ad.cards.filter((c) => c.id === 'sessionCard').length >= 2);
    assert.equal(await page.evaluate(() => window.__coach.hist().length >= 1), true, 'the game is still going');
    await staysAway(page, 'a set’s end card while a game is unfinished');
    // 3. the same for a Learn end card
    await page.evaluate(() => window.__coach.startPart('fork', 'learn'));
    await finishLesson(page);
    await page.waitForFunction(() => window.__ad.cards.some((c) => c.id === 'learnEnd'));
    await staysAway(page, 'a Learn end card while a game is unfinished');
    assert.equal(await vis(page, '#learnEnd .tipslot'), false, 'and no tip slot there either: the banner follows the slot');
    requestRules(await calls(page), 'F-D32');
    return page;
  }],
  ['S6 / criterion 7: offline on day three: the tip, no strip, no gap, no error, and no ads for this session', async (vp) => {
    const page = await newPage(vp, prof({ days: played(1, 2) }), { ads: { offline: true } });
    await page.waitForTimeout(1500);
    assert.deepEqual(await names(page), ['requestConsentInfo'], 'the consent check failed, so nothing else is asked');
    assert.equal(await shown(page), false); assert.equal(await padNow(page), 0, 'no reserved space');
    assert.equal(await vis(page, await slotSel(page, '#homeSlot')), true, 'the tip is there');
    const h0 = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.locator('#tab-path').click(); await page.locator('#tab-coach').click();
    // back online in the same session: fail closed, the next app start asks again
    await page.evaluate(() => { window.__ad.cfg.offline = false; window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(1500);
    assert.deepEqual(await names(page, true), ['requestConsentInfo'], 'no retry in this session');
    assert.equal(await page.evaluate(() => window.__coach.ads().state), 'off');
    assert.equal(await page.evaluate(() => document.documentElement.scrollHeight), h0, 'the page is as tall as before');
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    await page.evaluate(() => { window.__ad.cfg.offline = false; }); // (the fake starts offline again on reload; this start already failed)
    return page;
  }],
  ['S6b / criterion 7: no ad available: no strip, no reserved space, no console error; one retry a minute later while Home stays open', async (vp) => {
    const page = await newPage(vp, bprof(vp), startOn(vp, { ads: { fill: false }, fakeTimers: true }));
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'showBanner')); await page.waitForTimeout(600);
    assert.equal(await shown(page), false); assert.equal(await padNow(page), 0, 'no reserved space');
    assert.equal(await page.evaluate(() => window.__coach.ads().banner), 'none');
    assert.equal(await vis(page, await slotSel(page, slotId(vp))), true, 'the tip is there');
    await page.waitForTimeout(1500);
    assert.equal(await count(page, 'showBanner'), 1, 'no second request right away');
    // leaving the screen clears the retry: a minute on Learn asks for nothing
    await page.locator('#tab-path').click();
    await page.clock.fastForward(61000); await page.waitForTimeout(200);
    assert.equal(await count(page, 'showBanner'), 1, 'no request away from a slot screen');
    // back on the slot screen (the minute has passed): after the usual second, one new request; it fails again
    await page.locator('#tab-' + slotTab(vp)).click();
    await page.waitForFunction(() => window.__ad.calls.filter((c) => c.m === 'showBanner').length === 2);
    await page.waitForTimeout(300);
    assert.equal(await padNow(page), 0);
    // Home stays open and idle: one check a minute later, and now an ad is there
    await page.clock.fastForward(30000); await page.waitForTimeout(200);
    assert.equal(await count(page, 'showBanner'), 2, 'nothing at half a minute');
    await page.evaluate(() => { window.__ad.cfg.fill = true; });
    await page.clock.fastForward(31000);
    await ready(page);
    assert.equal(await count(page, 'showBanner'), 3, 'one retry, a minute after the failed load');
    requestRules(await calls(page), 'retry');
    return page;
  }],
  ['Fix 6, 10: a banner that cannot be brought back is removed (page and native agree); an empty strip never reserves padding', async (vp) => {
    // 10: the ad is slow to load. Hiding and resuming the empty banner must not pad the page.
    const page = await newPage(vp, improver({ unlockAll: true }), { ads: { slow: true }, tab: 'progress' });
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'showBanner')); await page.waitForTimeout(200);
    assert.equal(await padNow(page), 0, 'no ad yet, no padding');
    await page.locator('#settingsBtn').click(); await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'resumeBanner')); await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__ad.visible && !window.__ad.loaded), true, 'the empty banner is back on screen and reported its size');
    assert.equal(await padNow(page), 0, 'still no padding over an empty strip');
    await page.evaluate(() => window.__ad.release.load());
    await ready(page);
    // 6: resumeBanner fails. The app removes the banner and does not pretend it is there.
    await page.evaluate(() => { window.__ad.cfg.resumeFails = true; });
    await page.locator('#settingsBtn').click(); await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'removeBanner'));
    await page.waitForTimeout(300);
    assert.equal(await page.evaluate(() => window.__coach.ads().banner), 'none'); assert.equal(await page.evaluate(() => window.__ad.view), false, 'gone natively too');
    assert.equal(await padNow(page), 0, 'no gap');
    assert.equal(await count(page, 'showBanner'), 1, 'and no new request straight away');
    return page;
  }],
  ['S7 / criterion 8: Europe: the consent form shows once at app start, before any ad request; the SDK and the banner wait for the answer', async (vp) => {
    const page = await newPage(vp, bprof(vp), startOn(vp, { ads: { status: 'REQUIRED', form: true, can: false, privacy: 'REQUIRED', holdForm: true } }));
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'showConsentForm')); await page.waitForTimeout(1500);
    assert.deepEqual(await names(page, true), ['requestConsentInfo', 'showConsentForm'], 'nothing else until the form is answered: no SDK start, no ad request');
    assert.equal(await shown(page), false); assert.equal(await padNow(page), 0);
    await page.evaluate(() => window.__ad.release.form());
    await ready(page);
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
    assert.equal(await count(page, 'showConsentForm'), 1, 'the consent form itself showed once');
    return page;
  }],
  ['S7b: Europe, consent refused and Google allows no ads: the app works as normal, with no banner and no ad request', async (vp) => {
    const page = await newPage(vp, prof(), { ads: { status: 'REQUIRED', form: true, can: false, privacy: 'REQUIRED', formCan: false } });
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'showConsentForm')); await page.waitForTimeout(1500);
    assert.deepEqual(await names(page, true), ['requestConsentInfo', 'showConsentForm'], 'no SDK start and no ad request');
    assert.equal(await padNow(page), 0); assert.equal(await vis(page, await slotSel(page, '#homeSlot')), true, 'the tip is there');
    await page.locator('#bhome .bh-go').click(); await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    await page.locator('#settingsBtn').click();
    assert.equal(await vis(page, '#settingsSheet [data-act="privchoices"]'), true, 'he can change his mind in Settings');
    return page;
  }],
  ['C8a / A-D7: the app starts in an unfinished game on day two, outside Europe: one consent check, no form, and the banner comes on the end card after the game', async (vp) => {
    const page = await newPage(vp, club({ games: [] }), { game: MATE1, tab: 'play' });
    await page.waitForFunction(() => !window.__coach.st.busy); await page.waitForTimeout(1500);
    assert.deepEqual(await names(page), ['requestConsentInfo', 'initialize'], 'the consent check at app start; no form; no ad request while the game is going');
    assert.equal(await shown(page), false); assert.equal(await padNow(page), 0);
    await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => window.__ad.cards.some((c) => c.id === 'gameEnd'), null, { timeout: 30000 });
    assert.equal(await shown(page), false, 'the card first');
    const card = (await page.evaluate(() => window.__ad.cards)).filter((c) => c.id === 'gameEnd').pop();
    await backAfterDelay(page, 2 + 3, card.t, 'the end card of the game the app started in', 'showBanner'); // 2 calls and 3 listeners before
    const cs = await calls(page);
    assert.equal(cs.filter((c) => c.m === 'requestConsentInfo').length, 1, 'the consent check ran once');
    assert.equal(cs.filter((c) => c.m === 'showConsentForm').length, 0);
    requestRules(cs, 'started in a game');
    return page;
  }],
  ['C8b / criterion 8: Europe, a form is required, and the player opens a lesson before Google answers: no form and no ads in this session; the next app start shows the form', async (vp) => {
    const page = await newPage(vp, bprof(vp), { ads: { status: 'REQUIRED', form: true, can: false, privacy: 'REQUIRED', holdConsent: true } });
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'requestConsentInfo'));
    if (W(vp)) await page.evaluate(() => window.__coach.startPart('rules', 'learn')); else await page.locator('#bhome .bh-go').click(); await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    await page.evaluate(() => window.__ad.release.consent()); // Google answers while the lesson is open
    await page.locator('#navNext').click(); await page.waitForTimeout(600);
    assert.deepEqual(await names(page, true), ['requestConsentInfo'], 'no form over the lesson');
    await finishLesson(page);
    await page.waitForFunction(() => window.__ad.cards.some((c) => c.id === 'learnEnd'));
    await page.waitForTimeout(1600);
    await page.locator('#learnEnd [data-act="home"]').click(); await page.locator('#tab-coach').click();
    await page.evaluate(() => { window.dispatchEvent(new Event('online')); document.dispatchEvent(new Event('visibilitychange')); window.dispatchEvent(new Event('resize')); });
    await page.waitForTimeout(1600);
    assert.deepEqual(await names(page, true), ['requestConsentInfo'], 'the form is never shown later in the session; no SDK start, no ad request');
    assert.equal(await padNow(page), 0); assert.equal(await vis(page, await slotSel(page, '#homeSlot')), true, 'the tip is there as usual');
    await page.locator('#settingsBtn').click();
    assert.equal(await vis(page, '#settingsSheet [data-act="privchoices"]'), true, 'Google says a choice applies, so the row is there');
    await page.locator('[data-act="settingsclose"]').click();
    // the next app start, nothing open: the form comes first
    await page.evaluate(() => { window.__ad.calls.length = 0; });
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    await page.waitForFunction(() => window.__ad.release.consent); await page.evaluate(() => window.__ad.release.consent());
    await page.waitForFunction(() => window.__ad.calls.some((c) => c.m === 'showConsentForm'));
    if (W(vp)) await page.locator('#tab-progress').click(); // A-D19: wide Home has the board
    await ready(page); requestRules(await calls(page), 'next start');
    return page;
  }],
  ['C8c / A-D17: Europe, consent given earlier, the app starts in an unfinished game: "Privacy choices" is there, no form, and the banner comes after the game', async (vp) => {
    const page = await newPage(vp, club({ games: [] }), { game: MATE1, tab: 'play', ads: { status: 'OBTAINED', form: true, can: true, privacy: 'REQUIRED' } });
    await page.waitForFunction(() => !window.__coach.st.busy); await page.waitForTimeout(1500);
    assert.deepEqual(await names(page), ['requestConsentInfo', 'initialize'], 'no form: consent is already there');
    await page.locator('#settingsBtn').click();
    assert.equal(await vis(page, '#settingsSheet [data-act="privchoices"]'), true, 'the row is there in a session that started in a game');
    await page.locator('[data-act="settingsclose"]').click();
    assert.equal(await shown(page), false, 'no banner while the game is going');
    await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => window.__ad.cards.some((c) => c.id === 'gameEnd'), null, { timeout: 30000 });
    const card = (await page.evaluate(() => window.__ad.cards)).filter((c) => c.id === 'gameEnd').pop();
    await backAfterDelay(page, 2 + 3, card.t, 'the end card', 'showBanner');
    const cs = await calls(page);
    assert.equal(cs.filter((c) => c.m === 'showConsentForm').length, 0); requestRules(cs, 'consent given earlier');
    return page;
  }],
  ['C8d / criterion 8: Europe, a form is required, and the app starts in an unfinished game: the check runs, no form, no ads this session, the row is there', async (vp) => {
    const page = await newPage(vp, club({ games: [] }), { game: MATE1, tab: 'play', ads: { status: 'REQUIRED', form: true, can: false, privacy: 'REQUIRED' } });
    await page.waitForFunction(() => !window.__coach.st.busy); await page.waitForTimeout(1200);
    assert.deepEqual(await names(page, true), ['requestConsentInfo'], 'the check, and nothing else: no form over the game');
    await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => window.__ad.cards.some((c) => c.id === 'gameEnd'), null, { timeout: 30000 });
    await page.waitForTimeout(1600);
    await page.locator('#gameEnd [data-act="home"]').click(); await page.waitForTimeout(1500);
    assert.deepEqual(await names(page, true), ['requestConsentInfo'], 'no form later, no SDK start, no ad request');
    assert.equal(await padNow(page), 0);
    await page.locator('#settingsBtn').click();
    assert.equal(await vis(page, '#settingsSheet [data-act="privchoices"]'), true);
    return page;
  }],
  ['S8, S9 / criteria 3, 9: Settings has "Privacy policy" and no "Privacy choices" outside Europe; the banner hides while Settings is open and returns a second after it closes', async (vp) => {
    const page = await newPage(vp, improver({ unlockAll: true }), { tab: 'progress' });
    await ready(page);
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
    let n0 = (await calls(page)).length, t0 = await now(page);
    await page.keyboard.press('Escape');
    await backAfterDelay(page, n0, t0, 'after Settings closes');
    assert.equal(await count(page, 'showBanner'), 1, 'the same banner comes back: no new ad request');
    // the level check is a full-screen sheet too
    hiddenInAFrame(await frameAfter(page, () => window.__coach.openPlacement(true)), 'opening the level check');
    await page.locator('#placement .pl-x').first().click(); await page.waitForFunction(() => !window.Placement.isOpen());
    await escNote(page); await waitShown(page);
    return page;
  }],
  ['S9b / A-D12: the level-up offer keeps the banner away until it is answered; a note that arrives over the banner hides it within a frame', async (vp) => {
    const page = await newPage(vp, bprof(vp, { course: done(...FOUND), levelT: NOW - 8 * DAY, days: played(1, 8) }), startOn(vp));
    await page.waitForFunction(() => !document.getElementById('raniNote').hidden && !!document.querySelector('#raniNote [data-act="offerno"]'));
    await page.waitForTimeout(1500);
    assert.equal(await shown(page), false, 'no banner under the offer'); assert.equal(await padNow(page), 0);
    assert.ok(!(await names(page)).includes('showBanner'), 'and no ad request under it');
    await page.locator('#raniNote [data-act="offerno"]').click(); await page.waitForTimeout(300);
    assert.equal(await shown(page), false, 'Rani’s answer is still on screen');
    let n0 = (await calls(page)).length, t0 = await now(page);
    await page.locator('#raniNote [data-act="notedone"]').click();
    await backAfterDelay(page, n0, t0, 'after the note closes', 'showBanner');
    // a note arrives while the banner is showing
    hiddenInAFrame(await frameAfter(page, () => window.__coach.note('Welcome back, I restored your level.')), 'a note from Rani over the banner');
    assert.equal(await vis(page, '#raniNote'), true);
    await page.waitForTimeout(1200); assert.equal(await shown(page), false, 'hidden for as long as the note is up');
    n0 = (await calls(page)).length; t0 = await now(page);
    await page.locator('#raniNote [data-act="notedone"]').click();
    await backAfterDelay(page, n0, t0, 'after that note closes');
    requestRules(await calls(page), 'offer');
    return page;
  }],
  ['C5 / criterion 5: Progress with the banner: the tip, the credits and every button stay clear of it; each new screen waits a second', async (vp) => {
    const page = await newPage(vp, improver({ unlockAll: true }), { tab: 'progress' });
    await ready(page);
    assert.equal(await vis(page, await slotSel(page, '#progSlot')), true, 'the tip is still on Progress');
    await nothingCovered(page, 'Progress');
    const credit = await page.locator('#panel-progress .credit').allInnerTexts();
    assert.ok(credit.join(' ').includes('LICENSE-EXCEPTION'), 'criterion 14: the credit names the exception');
    assert.ok(credit.join(' ').includes('Analysis by Stockfish 19'), 'the Stockfish credit stays');
    await shot(page, vp, 'progress_banner');
    // A-D19: Improver Home is the board screen. A fresh board with no move still gets no banner; Rani's tip stays.
    hiddenInAFrame(await frameAfter(page, () => document.getElementById('tab-coach').click()), 'Progress to Home');
    assert.equal(await page.evaluate(() => window.__coach.hist().length), 0, 'no move has been made');
    assert.equal(await page.evaluate(() => document.querySelector('.boardcol').getClientRects().length > 0), true, 'the board is on screen');
    await staysAway(page, 'Improver Home with a fresh board');
    assert.equal(await vis(page, await slotSel(page, '#homeSlot')), true, 'the tip is still on Home');
    // back to Progress: a new screen under the finger, so the banner comes back a second later
    const n0 = (await calls(page)).length, t0 = await now(page);
    await page.locator('#tab-progress').click();
    await backAfterDelay(page, n0, t0, 'back on Progress');
    requestRules(await calls(page), 'Progress');
    return page;
  }],
  ['S10 / criterion 3: turning the phone sideways hides the banner within a frame; upright again it returns', async (vp) => {
    const page = await newPage(vp, bprof(vp), startOn(vp));
    await ready(page);
    // what the page sees one frame after the resize
    const watch = () => page.evaluate(() => { window.__rz = new Promise((res) => window.addEventListener('resize', () => { const n = window.__ad.calls.length; requestAnimationFrame(() => res({ shown: window.__ad.shown, pad: !document.getElementById('adPad').hidden, last: window.__ad.calls.slice(-1)[0].m, n })); }, { once: true })); });
    await watch(); await page.setViewportSize({ width: 915, height: 412 });
    let z = await page.evaluate(() => window.__rz);
    assert.deepEqual({ shown: z.shown, pad: z.pad, last: z.last }, { shown: false, pad: false, last: 'hideBanner' }, 'sideways: hidden one frame after the resize');
    const go = W(vp) ? null : await page.evaluate(() => { const q = document.querySelector('#bhome .bh-go').getBoundingClientRect(); return { top: q.top, bottom: q.bottom, h: window.innerHeight }; });
    if (!W(vp)) assert.ok(go.top >= 0 && go.bottom <= go.h + 0.5, 'Continue is on the first screen sideways');
    await staysAway(page, 'sideways');
    let n0 = (await calls(page)).length, t0 = await now(page);
    await page.setViewportSize(vp);
    await backAfterDelay(page, n0, t0, 'upright again');
    // 499px tall is still too short; 500 is enough
    await watch(); await page.setViewportSize({ width: vp.width, height: 499 });
    z = await page.evaluate(() => window.__rz);
    assert.deepEqual({ shown: z.shown, last: z.last }, { shown: false, last: 'hideBanner' }, '499px: hidden one frame after the resize');
    await page.setViewportSize({ width: vp.width, height: 500 }); await waitShown(page);
    return page;
  }],
  ['MOVE / A-D16: the layout changes between phone and wide: the same banner moves (new margin), with no new ad', async (vp) => {
    const page = await newPage(vp, improver({ unlockAll: true }), { tab: 'progress' });
    await ready(page);
    const phone = await fixedTabs(page), other = phone ? { width: 1280, height: 900 } : { width: 412, height: 915 };
    assert.equal((await calls(page)).filter((c) => c.m === 'showBanner').pop().a.margin, phone ? 64 : 0);
    await page.setViewportSize(other);
    await page.waitForFunction((m) => { const s = window.__ad.calls.filter((c) => c.m === 'showBanner'); return s.length === 2 && s[1].a.margin === m; }, phone ? 0 : 64);
    await ready(page);
    assert.equal(await fixedTabs(page), !phone, 'the layout really changed');
    assert.equal(await padNow(page), phone ? BH : BH + 8, 'the padding follows the new place');
    const cs = await calls(page), sb = cs.filter((c) => c.m === 'showBanner');
    assert.deepEqual([sb[0].a.adId, sb[0].a.npa, sb[0].a.isTesting, sb[0].a.adSize], [sb[1].a.adId, sb[1].a.npa, sb[1].a.isTesting, sb[1].a.adSize], 'the same request options, so the plugin keeps the ad');
    assert.equal(cs.filter((c) => c.m === 'removeBanner').length, 0, 'the banner was moved, not thrown away');
    assert.equal(await vis(page, await slotSel(page, '#progSlot')), true, 'the tip moved with the layout (strip on wide, in the page on phones)');
    await nothingCovered(page, 'after the move');
    requestRules(cs, 'move');
    return page;
  }],
  ['LAND / S10: a phone held sideways (915x412) gets no banner at all, and Continue is on the first screen', async (vp) => {
    const page = await newPage({ width: 915, height: 412 }, prof());
    await page.waitForTimeout(1800);
    const n = await names(page);
    assert.ok(!n.includes('showBanner') && !n.includes('resumeBanner'), 'no ad request sideways: ' + n.join(','));
    assert.equal(await padNow(page), 0);
    const go = await page.evaluate(() => { const q = document.querySelector('#bhome .bh-go').getBoundingClientRect(); return { top: q.top, bottom: q.bottom, h: window.innerHeight, y: window.scrollY }; });
    assert.ok(go.y === 0 && go.top >= 0 && go.bottom <= go.h + 0.5, 'Continue is on the first screen');
    return page;
  }],
  ['S12 / criterion 11, A-D9: the web version loads no ads code: no request for ads.js, no window.Ads, the same screens as today', async (vp) => {
    const page = await newPage(vp, prof(), { ads: { web: true } });
    await page.waitForTimeout(1300);
    assert.equal(await page.evaluate(() => typeof window.Capacitor), 'undefined');
    assert.deepEqual(page.reqs.filter((u) => /ads/i.test(u.slice(ORIGIN.length))), [], 'no request for ads.js (or anything named ads)');
    assert.equal(await page.evaluate(() => typeof window.Ads), 'undefined', 'no ads code in the page');
    assert.deepEqual(await names(page, true), []);
    assert.equal(await page.evaluate(() => window.__coach.ads().state), 'off');
    assert.equal(await padNow(page), 0); assert.equal(await vis(page, await slotSel(page, '#homeSlot')), true, 'the tip, as today');
    await page.locator('#bhome .bh-go').click(); await finishLesson(page); await page.waitForTimeout(1300);
    assert.equal(await padNow(page), 0);
    await page.locator('#settingsBtn').click();
    assert.equal(await vis(page, '#settingsSheet [data-act="privacy"]'), true, '"Privacy policy" is for everyone');
    assert.equal(await vis(page, '#settingsSheet [data-act="privchoices"]'), false);
    await page.locator('[data-act="settingsclose"]').click();
    await page.setViewportSize({ width: vp.height, height: vp.width }); await page.setViewportSize(vp); await page.waitForTimeout(300);
    assert.deepEqual(page.reqs.filter((u) => /ads/i.test(u.slice(ORIGIN.length))), [], 'still none');
    return page;
  }],
  ['S12b: a Capacitor object that is not the native app (or has no ads plugin) changes nothing', async (vp) => {
    const page = await newPage(vp, prof(), { ads: {} });
    await page.evaluate(() => { window.__ad.calls.length = 0; });
    const ctx = page.context(); await ctx.addInitScript(() => { window.Capacitor.isNativePlatform = () => false; });
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement); await page.waitForTimeout(1500);
    assert.deepEqual(await names(page, true), [], 'not native: no call');
    assert.equal(await page.evaluate(() => window.__coach.ads().state), 'off');
    await ctx.addInitScript(() => { delete window.Capacitor.Plugins.AdMob; });
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement); await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => window.__coach.ads().state), 'off', 'no ads plugin: off');
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
