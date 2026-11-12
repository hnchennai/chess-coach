// E2E for the flow rework: slice F1 (end cards with a next step, Continue card on Improver and Club Home) and slice F2 (tip slot).
// Run: F1_VP=412 node tests/e2e/f1.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// F1_VP: 360 | 412 | 1280 | 915 (a phone held sideways, 915x412: the LAND case only). F1_SHOTS=<dir> saves screenshots. F1_ONLY=<regex> runs matching cases.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const assert = require('assert/strict');
const path = require('path');

const WWW = path.resolve(process.env.F1_WWW || path.join(__dirname, '../../www'));
const PORT = 8000 + Math.floor(Math.random() * 900);
const ORIGIN = 'http://127.0.0.1:' + PORT;
const URL = ORIGIN + '/index.html';
const SHOTS = process.env.F1_SHOTS || '';
const PKEY = 'suresh-chess-coach.profile.v1', GKEY = 'suresh-chess-coach.v1', TKEY = 'suresh-chess-coach.tab', CKEY = 'suresh-chess-coach.coach';
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }, { width: 915, height: 412 }].filter((v) => !process.env.F1_VP || String(v.width) === process.env.F1_VP);
const ONLY = process.env.F1_ONLY ? new RegExp(process.env.F1_ONLY) : null;
const NOW = Date.now(), DAY = 86400000;
const PARTNER = 'Rani’s practice partner';
const ASK = 'You have a game going. Finish it first?';
const FOUND = ['rules', 'special', 'board', 'values', 'mate', 'opening', 'blunder'];
const TACTICS = ['fork', 'pin', 'disc', 'patterns', 'check2'];
const HOME_ORDER = ['contCard', 'stageHero', 'today', 'stageCard', 'roadCard', 'lookCard', 'methodsCard'];

let browser, results = [], failures = 0;

const DONE = { learn: 1, practice: 1, apply: 1 };
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, Object.assign({}, DONE)]));
// prof.days keys, as the app's dkey(): local date, month 1-based, no padding. n days back from today.
const dkey = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const played = (...backs) => Object.fromEntries(backs.map((b) => [dkey(b), { puz: 0, games: 1, course: 0, solved: 0 }]));
// A player on their second day or later (the default): the level was set yesterday and yesterday has a record.
function prof(o) {
  return Object.assign({ v: 5, level: 'beginner', levelT: NOW - DAY, placed: 'check', start: 'rules', rating: 600, rn: 0, games: [], puz: {}, course: {}, days: played(1), reviewed: [], t: NOW - DAY, theme: null, showAll: false, unlockAll: false, provisional: false, pgsDeclined: false, levelOfferT: 0 }, o);
}
const improver = (o) => prof(Object.assign({ level: 'improver', start: 'fork', rating: 1000 }, o));
const club = (o) => prof(Object.assign({ level: 'club', start: 'kq', rating: 1300 }, o));
const NOTE_E = { side: 'e', why: [{ c: 'good', h: 'No direct threat. It’s developing, so keep developing too and get castled.' }], ev: 30 };
const GAME_OPEN = { sans: ['e4', 'e5', 'Nf3', 'Nc6'], user: 'w', level: 1, ann: { 0: 'best', 2: 'best' }, notes: { 0: { side: 'u', cls: 'best', text: 'This claims space in the center.', ev: 30 }, 1: NOTE_E, 2: { side: 'u', cls: 'best', text: 'This develops your knight.', ev: 30 }, 3: NOTE_E }, tags: {}, fb: { cls: 'best', sym: '!', title: 'Best move', mv: 'You played Nf3', text: 'This develops your knight.' }, opp: null, evalW: 30, flipped: false, recorded: false, goal: null, t: NOW - 60000 };
// 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6: White mates with Qxf7.
const MATE1 = (o) => Object.assign({ sans: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'], user: 'w', level: 1, ann: {}, notes: {}, tags: {}, fb: null, opp: null, evalW: 0, flipped: false, recorded: false, goal: null, t: NOW - 60000 }, o);
const goal = (type, unit) => ({ type, unit, text: 'Lesson task.', status: 'active' });
// Fool's mate: the player (White) is mated. Saved as the app saves it after the partner's mating move (already recorded).
const LOST = { sans: ['f3', 'e5', 'g4', 'Qh4#'], user: 'w', level: 3, ann: {}, notes: {}, tags: {}, fb: null, opp: null, evalW: 0, recorded: true, t: NOW };
const PAST = (o) => Object.assign({ id: 'gp', d: NOW - DAY, r: 'W', user: 'b', level: 3, acc: 80, counts: {}, tags: {}, sans: ['f3', 'e5', 'g4', 'Qh4#'], ann: {} }, o);

function seedFn([pk, p, gk, g, tk, tab, ck, coach]) {
  if (sessionStorage.getItem('seeded')) return;
  if (p) localStorage.setItem(pk, JSON.stringify(p));
  if (g) localStorage.setItem(gk, JSON.stringify(g));
  if (tab) localStorage.setItem(tk, JSON.stringify(tab));
  if (coach) localStorage.setItem(ck, coach);
  sessionStorage.setItem('seeded', '1');
}
async function newPage(vp, init, extra, opts) {
  const ctx = await browser.newContext(Object.assign({ viewport: vp, deviceScaleFactor: 1 }, opts || {}));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  if (init) await ctx.addInitScript(init.fn, init.arg);
  if (extra) await ctx.addInitScript(extra.fn, extra.arg);
  const page = await ctx.newPage();
  if (process.env.F1_TIMEOUT) { page.setDefaultTimeout(+process.env.F1_TIMEOUT); page.setDefaultNavigationTimeout(60000); }
  page.errors = []; page.outside = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  // AC10: nothing leaves the page's origin (the font stylesheet in head.html was there before this slice).
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ORIGIN + '/') && !/^(data|blob|about):/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u)) page.outside.push(u); });
  await page.goto(URL);
  try { await page.waitForFunction(() => window.__coach && window.Placement); }
  catch (e) { throw new Error('app did not start: ' + e.message.split('\n')[0] + ' | page errors: ' + JSON.stringify(page.errors)); }
  return page;
}
// o: { game, tab, coach ('rani' | 'gaja'), extra (another init script), ctx (context options, e.g. colorScheme) }
const seeded = (vp, p, o) => { o = o || {}; return newPage(vp, { fn: seedFn, arg: [PKEY, p, GKEY, o.game || null, TKEY, o.tab || null, CKEY, o.coach || null] }, o.extra, o.ctx); };

const st = (page, k) => page.evaluate((key) => window.__coach.st[key], k);
const getProf = (page) => page.evaluate(() => window.__coach.getProf());
const vis = (page, sel) => page.locator(sel).first().isVisible();
const phone = (vp) => vp.width <= 600;
const shot = async (page, vp, name, sel) => {
  if (!SHOTS) return;
  await page.waitForTimeout(250);
  if (sel && /Slot|tipslot/.test(sel) && (await page.evaluate(() => getComputedStyle(document.querySelector('.app')).gridTemplateColumns.split(' ').length > 1))) sel = '#slotStrip'; // desktop: the strip (F-D27)
  if (sel) await page.locator(sel).first().scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(SHOTS, vp.width + '_' + name + '.png') });
};
const noteText = async (page) => (await page.locator('#raniNote p').innerText()).trim();
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
async function finishLesson(page) {
  await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
  for (let i = 0; i < 12 && (await st(page, 'mode')) === 'lesson'; i++) await page.locator('#navNext').click();
  assert.notEqual(await st(page, 'mode'), 'lesson');
}
// Jumps a running set to its last item with a score so far; the test then plays the last item for real.
const jump = (page, right) => page.evaluate((r) => { const s = window.__coach.st.ses; s.i = s.count - 1; s.right = r; s.wrong = s.count - 1 - r; }, right);
// Plays the last item of a puzzle set and taps Next: the set ends.
async function lastPuzzle(page) {
  await solvePuzzle(page);
  await page.locator('#sessionCard [data-act="next"]').click();
  await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished);
}
// Answers the Safe or blunder? item on the board (right or wrong on purpose) and taps Next.
async function lastQuiz(page, right) {
  await page.waitForFunction(() => window.__coach.st.mode === 'quiz' && window.__coach.st.qz && !window.__coach.st.qz.answered);
  const isBlunder = await page.evaluate(() => window.__coach.st.qz.it.blunder);
  await page.locator(isBlunder === right ? '#qBlunder' : '#qSafe').click();
  await page.locator('#sessionCard [data-act="next"]').click();
  await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished);
}
// What an end card says: the words (textContent, before any CSS text-transform), its one main button and its small buttons.
async function card(page, root) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel), on = (e) => !!e && e.offsetParent !== null;
    if (!on(el)) return { shown: false };
    const tx = (s) => { const e = el.querySelector(s); return on(e) ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    const all = (s) => Array.from(el.querySelectorAll(s)).filter(on);
    const box = (e) => { const b = e.getBoundingClientRect(); return { w: b.width, h: b.height, top: b.top, bottom: b.bottom }; };
    return { shown: true, title: tx('.ec-title'), text: tx('.ec-text'), line: tx('.ec-line'), main: tx('.ec-main'), small: all('.ec-small').map((b) => b.textContent.trim()),
      primaries: all('.btn.primary').length, mainBox: all('.ec-main').map(box)[0] || null, smallBoxes: all('.ec-small').map(box), slot: on(el.querySelector('.tipslot')),
      focusable: all('button').every((b) => b.tabIndex >= 0 && !b.disabled), all: el.innerText };
  }, root);
}
// F-D7 / F-D28: the main (primary) buttons on the whole visible screen (board column and panel).
const one = async (page, why) => { const m = await mains(page); assert.equal(m.length, 1, why + ': exactly one main button on the screen: ' + JSON.stringify(m)); };
const mains = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.btn.primary')).filter((e) => e.offsetParent !== null).map((e) => e.textContent.trim()));
// F-D7 / F-D11 / AC13: one main button (48px), small buttons 44px, every button reachable by keyboard.
function cardRules(c, vp, why) {
  assert.equal(c.shown, true, why + ': card shown');
  assert.equal(c.primaries, 1, why + ': exactly one main button');
  assert.ok(c.mainBox.h >= 48, why + ': main button 48px: ' + c.mainBox.h);
  c.smallBoxes.forEach((b, i) => assert.ok(b.h >= 44 && b.w >= 44, why + ': small button ' + c.small[i] + ' is 44px: ' + b.w + 'x' + b.h));
  assert.ok([c.main].concat(c.small).includes('Home'), why + ': a Home button');
  assert.equal(c.focusable, true, why + ': keyboard reaches every button');
  assert.ok(!/Back to the course|^Close$/m.test(c.all), why + ': no "Back to the course" or "Close": ' + c.all);
  assert.ok(!/—/.test(c.all), why + ': no em dash');
}
// A Beginner's card: no rating, notation or engine words (S2a), and never a lesson outside Foundations (D39).
const JARGON = /stockfish|engine|rated|rating|accuracy|\beval|~\s?\d|\d+\s?%|\b\d{3,4}\b/i;
const SAN = /(^|[^\w×-])([KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8]|O-O)/;
const LATER = /Forks|Pins and skewers|Discovered attacks|Mating patterns|Checkpoint/;
function beginnerWords(c, why) {
  assert.ok(!JARGON.test(c.all), why + ': jargon: ' + (c.all.match(JARGON) || [])[0]);
  assert.ok(!SAN.test(c.all), why + ': notation: ' + (c.all.match(SAN) || [])[0]);
  assert.ok(!LATER.test(c.all), why + ': a lesson outside Foundations: ' + (c.all.match(LATER) || [])[0]);
}
/* ---------- F2: the tip slot ---------- */
// The signed tips (docs/specs/flow-rework.product.md).
const BEGINNER = ['Before you move, look at what their last move attacks.', 'Castle early. A king in the middle is easy to attack.', 'Bring out your knights and bishops before your queen.', 'A free piece is one nobody guards. Take it.',
  'Before you let go of a piece, check it is safe on its new square.', 'Pawns can’t move back. Push them with care.', 'Two pieces attacking one square beat one piece guarding it.', 'When you are ahead, swap pieces. The game gets simpler.'];
const OTHER = ['Checks, captures, threats. Look at them in that order, every move.', 'A knight on the edge covers fewer squares. Keep it near the middle.', 'Two attacks at once win a piece. Look for forks every move.', 'Rooks belong on open files. Put one there before your opponent does.',
  'A pinned piece is a poor guard. Count it out.', 'In the endgame, the king is a fighting piece. Bring it to the middle.', 'Passed pawns must be pushed. Put a rook behind them.', 'After every game, find the one move where it turned.'];
// A player on their first day: the level was set today and today is the only day with a record.
const FIRST_DAY = { levelT: NOW, t: NOW, days: played(0) };
// A clock the test can move: the page's Date runs ahead (or behind) by localStorage '__clock' milliseconds, read at every use.
const CLOCK = { fn: () => {
  const RD = Date, off = () => +(localStorage.getItem('__clock') || 0);
  class D extends RD { constructor(...a) { if (a.length) super(...a); else super(RD.now() + off()); } static now() { return RD.now() + off(); } }
  window.Date = D;
}, arg: null };
// F-D27: on desktop (board left, panel right) every place's slot is the one strip under both columns.
const isWide = (page) => page.evaluate(() => getComputedStyle(document.querySelector('.app')).gridTemplateColumns.split(' ').length > 1);
const slotSel = async (page, sel) => (await isWide(page)) ? '#slotStrip' : sel;
async function slot(page, sel0) {
  const sel = await slotSel(page, sel0), wide = sel !== sel0;
  if (wide && /^#(gameEnd|sessionCard|learnEnd)/.test(sel0)) { // the strip belongs to the card on screen
    const host = sel0.split(' ')[0]; if (!(await page.evaluate((h) => { const e = document.querySelector(h); return !!e && e.offsetParent !== null && !!e.querySelector('.ec-main'); }, host))) return { shown: false };
    assert.equal(await page.locator(sel0).count(), 0, 'desktop: no slot inside the card');
  }
  if (wide) for (const id of ['homeSlot', 'progSlot']) assert.equal(await page.evaluate((i) => document.getElementById(i).offsetParent !== null, id), false, 'desktop: no slot in the panel column');
  return page.evaluate(([s, wide]) => {
    const el = document.querySelector(s), on = (e) => !!e && e.offsetParent !== null;
    if (!on(el)) return { shown: false };
    const R = (e) => e.getBoundingClientRect(), app = R(document.querySelector('.app')), bc = document.querySelector('.boardcol'), side = R(document.querySelector('.side'));
    const strip = wide ? { below: R(el).top >= Math.max(on(bc) ? R(bc).bottom : 0, side.bottom) - 0.5, full: Math.abs(R(el).left - app.left) <= 1 && Math.abs(R(el).right - app.right) <= 1 } : null;
    const sibs = Array.from(el.parentElement.children).filter(on).filter((e) => !e.classList.contains('credit'));
    return { shown: true, role: el.getAttribute('role'), aria: el.getAttribute('aria-label'), label: el.querySelector('.ts-label').textContent, text: el.querySelector('.ts-text').textContent,
      h: el.getBoundingClientRect().height, focusables: el.querySelectorAll('a, button, input, select, textarea, [tabindex]').length, tabIndex: el.tabIndex, gaja: !!el.querySelector('.ts-av svg.gaja'),
      pic: !!el.querySelector('.ts-av canvas, .ts-av svg'), inner: el.querySelector('.ts-body').getAttribute('aria-hidden'), last: wide || sibs[sibs.length - 1] === el, strip, tinted: getComputedStyle(el).backgroundColor };
  }, [sel, wide]);
}
// AC6 to AC9: the look and the words of a slot. list: the tips this player may get. coach: 'Rani' | 'Gaja'.
function slotRules(s, list, coach, why) {
  assert.equal(s.shown, true, why + ': the slot shows');
  assert.equal(s.label, coach + '’s tip', why + ': label');
  assert.ok(list.includes(s.text), why + ': one tip from the right list: ' + s.text);
  assert.equal(s.role, 'note', why + ': a note'); assert.equal(s.aria, coach + '’s tip: ' + s.text, why + ': what a screen reader hears');
  assert.equal(s.inner, 'true', why + ': the words are read once');
  assert.equal(s.focusables, 0, why + ': nothing inside takes focus'); assert.equal(s.tabIndex, -1, why + ': the slot takes no focus');
  assert.equal(s.pic, true, why + ': the coach picture');
  assert.ok(s.h >= 76, why + ': 76px or more: ' + s.h);
  if (s.strip) assert.deepEqual(s.strip, { below: true, full: true }, why + ': desktop: one full-width strip below both columns (F-D27)');
  assert.ok(!/—/.test(s.text + s.label), why + ': no em dash');
}
// How many slots are on screen.
const anySlot = (page) => page.evaluate(() => Array.from(document.querySelectorAll('.tipslot')).filter((e) => e.offsetParent !== null).length);

// The Continue card on the full Home.
async function cont(page) {
  return page.evaluate(() => {
    const el = document.getElementById('contCard'), on = (e) => !!e && e.offsetParent !== null, tx = (s) => { const e = el && el.querySelector(s); return on(e) ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    const bar = el && el.querySelector('.bh-bar'), go = el && el.querySelector('.bh-go');
    return { shown: on(el), kicker: tx('.bh-kick'), title: tx('.bh-title'), button: tx('.bh-go'), icon: on(el && el.querySelector('.bh-ic')),
      bar: on(bar) ? { text: bar.getAttribute('aria-valuetext'), now: +bar.getAttribute('aria-valuenow'), max: +bar.getAttribute('aria-valuemax') } : null,
      goH: go ? go.getBoundingClientRect().height : 0, next: window.__coach.nextLabel() };
  });
}
// F-D8 / AC2: the Continue card first, then today's cards in today's order; one primary button on Home; no "Next step" button.
async function homeRules(page, why) {
  const m = await page.evaluate((ids) => {
    const on = (e) => !!e && e.offsetParent !== null, panel = document.getElementById('panel-coach');
    const kids = Array.from(panel.children).filter(on).map((e) => e.id).filter((id) => ids.includes(id));
    const tops = ids.map((id) => document.getElementById(id).getBoundingClientRect().top);
    const hero = document.getElementById('stageHero');
    return { kids, tops, prim: Array.from(document.querySelectorAll('.btn.primary')).filter(on).length, heroBtns: hero.querySelectorAll('button').length, hero: hero.innerText };
  }, HOME_ORDER);
  assert.deepEqual(m.kids, HOME_ORDER, why + ': Continue card first, then today’s cards in today’s order');
  for (let i = 1; i < m.tops.length; i++) assert.ok(m.tops[i] > m.tops[i - 1], why + ': ' + HOME_ORDER[i] + ' below ' + HOME_ORDER[i - 1]);
  assert.equal(m.prim, 1, why + ': exactly one primary button on the whole Home screen (F-D28)');
  assert.equal(m.heroBtns, 0, why + ': the stage card has no button');
  assert.ok(!/Next step/i.test(m.hero), why + ': no "Next step" in the stage card: ' + m.hero);
  assert.ok(/Stage \d of 6/i.test(m.hero) && /milestones/.test(m.hero), why + ': the stage card keeps its text, bar and milestones');
}
// AC3: the result card is under the board, in the board column, and nothing covers the final position.
async function underBoard(page, vp, why) {
  await page.waitForTimeout(450); // the card scrolls into view
  const m = await page.evaluate(() => {
    const b = document.getElementById('board').getBoundingClientRect(), c = document.getElementById('gameEnd').getBoundingClientRect(), nav = document.querySelector('.tabs').getBoundingClientRect();
    const fixedNav = getComputedStyle(document.querySelector('.tabs')).position === 'fixed';
    const pts = [[.5, .5], [.1, .1], [.9, .1], [.1, .9], [.9, .9]].map(([x, y]) => { const e = document.elementFromPoint(b.left + b.width * x, b.top + b.height * y); return !!(e && e.closest('#grid')); });
    return { b: { top: b.top, bottom: b.bottom, left: b.left, right: b.right }, c: { top: c.top, bottom: c.bottom, left: c.left, right: c.right }, pts, banner: !!document.getElementById('banner') && document.getElementById('banner').offsetParent !== null,
      inCol: !!document.getElementById('gameEnd').closest('.boardcol'), bottom: fixedNav ? nav.top : window.innerHeight, w: window.innerWidth, sw: document.documentElement.scrollWidth };
  });
  assert.equal(m.banner, false, why + ': no box over the board');
  assert.equal(m.inCol, true, why + ': the card is in the board column');
  assert.ok(m.c.top >= m.b.bottom, why + ': the card is under the board (' + Math.round(m.c.top) + ' vs ' + Math.round(m.b.bottom) + ')');
  assert.ok(m.c.left >= 0 && m.c.right <= m.w + 0.5 && m.sw <= m.w, why + ': the card fits the screen width');
  assert.ok(m.b.top >= -0.5 && m.b.bottom <= m.bottom + 0.5, why + ': the whole board is on screen (' + Math.round(m.b.top) + ' to ' + Math.round(m.b.bottom) + ' of ' + Math.round(m.bottom) + ')');
  assert.deepEqual(m.pts, [true, true, true, true, true], why + ': nothing covers the final position');
}
async function mateInOne(page) {
  await page.locator('#tab-play').click();
  await page.waitForFunction(() => !window.__coach.st.busy);
  await page.locator('#board .sq[data-sq="h5"]').click();
  await page.locator('#board .sq[data-sq="f7"]').click();
  await page.waitForFunction(() => window.__coach.getProf().games.length >= 1 && !window.__coach.st.busy, null, { timeout: 20000 });
  await page.waitForFunction(() => { const e = document.getElementById('gameEnd'); return e && !e.hidden; });
}

const cases = [
  /* ---------- Improver and Club Home ---------- */
  ['F1-1 / Scenario 1: Improver Home starts with the Continue card for the next lesson; the stage card has no Next step button', async (vp) => {
    let page = await seeded(vp, improver({ course: done('fork') }), { tab: 'coach' });
    let c = await cont(page);
    assert.equal(c.shown, true);
    assert.equal(c.kicker, 'Continue · Lesson 2 of 5'); assert.equal(c.title, 'Pins and skewers'); assert.equal(c.button, 'Start lesson');
    assert.deepEqual(c.bar, { text: '1 of 5 lessons done', now: 1, max: 5 }); assert.equal(c.icon, true);
    assert.equal(c.next, 'Learn: Pins and skewers', 'the card names today’s Next step');
    assert.ok(c.goH >= 48, 'the main button is 48px: ' + c.goH);
    await homeRules(page, 'Improver Home');
    assert.equal(await page.locator('#contCard .bh-ic').getAttribute('aria-hidden'), 'true');
    await shot(page, vp, 'home-improver', '#contCard');
    // keyboard: the button takes focus and Enter starts the lesson
    await page.locator('#contCard .bh-go').focus();
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    assert.equal(await page.evaluate(() => window.__coach.st.ls.unit.id), 'pin');
    await page.context().close();
    // a lesson already started: Continue, and it opens the next part (practice)
    page = await seeded(vp, improver({ course: Object.assign(done('fork'), { pin: { learn: 1 } }) }), { tab: 'coach' });
    c = await cont(page);
    assert.equal(c.kicker, 'Continue · Lesson 2 of 5'); assert.equal(c.button, 'Continue'); assert.equal(c.next, 'Practice: Pins and skewers');
    await page.locator('#contCard .bh-go').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.unit === 'pin');
    assert.equal(await page.evaluate(() => window.__coach.st.ses.part), 'practice');
    await page.context().close();
    // L9: a player updated from 1.0.7 (v4 save, rating 950, start "How the pieces move") counts from their level (D29)
    page = await seeded(vp, { v: 4, rating: 950, rn: 12, games: [], puz: { m1: { n: 1, ok: 1, box: 1, due: 0 } }, course: done('rules'), days: played(3), reviewed: [], t: NOW - DAY }, { tab: 'coach' });
    c = await cont(page);
    assert.equal((await getProf(page)).level, 'improver');
    assert.equal(c.kicker, 'Continue · Lesson 1 of 5'); assert.equal(c.title, 'Forks'); assert.equal(c.button, 'Start lesson'); assert.equal(c.next, 'Learn: Forks');
    await homeRules(page, 'migrated Improver Home');
    return page;
  }],
  ['F1-2 / Scenario 2: Continue card for a puzzle goal, a game goal (and Back to my game), and a finished roadmap', async (vp) => {
    let page = await seeded(vp, improver({ course: done(...TACTICS) }), { tab: 'coach' });
    let c = await cont(page);
    assert.equal(c.kicker, 'Continue'); assert.equal(c.title, 'Puzzles to reach 1200'); assert.equal(c.button, 'Start 10 puzzles'); assert.equal(c.bar, null);
    assert.equal(c.next, 'Rated puzzles to reach 1200');
    await homeRules(page, 'puzzle goal');
    await page.locator('#contCard .bh-go').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.rated);
    await page.context().close();
    // the rating is there, the stage opponent is not beaten
    page = await seeded(vp, improver({ course: done(...TACTICS), rating: 1250, rn: 30 }), { tab: 'coach' });
    c = await cont(page);
    assert.equal(c.kicker, 'Continue'); assert.equal(c.title, 'Beat the Improver engine'); assert.equal(c.button, 'Play now'); assert.equal(c.bar, null);
    assert.equal(c.next, 'Beat the Improver engine');
    await page.locator('#contCard .bh-go').click();
    await page.waitForFunction(() => window.__coach.st.tab === 'play');
    assert.equal(await st(page, 'level'), 3, 'a game against the stage opponent'); assert.deepEqual(await page.evaluate(() => window.__coach.hist()), []);
    await page.context().close();
    // with an unfinished game: Back to my game, and the game is kept
    page = await seeded(vp, improver({ course: done(...TACTICS), rating: 1250, rn: 30 }), { tab: 'coach', game: Object.assign({}, GAME_OPEN, { level: 3 }) });
    c = await cont(page);
    assert.equal(c.title, 'Beat the Improver engine'); assert.equal(c.button, 'Back to my game');
    await homeRules(page, 'game goal with a game going');
    await page.locator('#contCard .bh-go').click();
    assert.equal(await st(page, 'tab'), 'play'); assert.deepEqual(await page.evaluate(() => window.__coach.hist()), GAME_OPEN.sans);
    await page.context().close();
    // the roadmap is finished
    const allIds = ['rules', 'special', 'board', 'values', 'mate', 'opening', 'blunder', 'fork', 'pin', 'disc', 'patterns', 'check2', 'kq', 'kr', 'kp', 'calc', 'check3', 'rep', 'activity', 'pawns', 'attack', 'check4', 'calc2', 'rook', 'defense', 'structures', 'planning', 'endtheory', 'analysis', 'tourney', 'final'];
    page = await seeded(vp, club({ course: done(...allIds), rating: 2100, rn: 300, reviewed: ['a', 'b', 'c'], games: [PAST({ level: 6 })] }), { tab: 'coach' });
    c = await cont(page);
    assert.equal(c.kicker, 'Continue'); assert.equal(c.title, 'Keep sharp: rated puzzles'); assert.equal(c.button, 'Start 10 puzzles'); assert.equal(c.next, 'Keep sharp: rated puzzles');
    await homeRules(page, 'roadmap finished');
    return page;
  }],
  ['F1-AC1: Club Home and a Beginner with Show everything on start with the Continue card; Beginner Home is unchanged', async (vp) => {
    let page = await seeded(vp, club(), { tab: 'coach' });
    let c = await cont(page);
    assert.equal(c.kicker, 'Continue · Lesson 1 of 5'); assert.equal(c.title, 'Mate with king and queen'); assert.equal(c.button, 'Start lesson'); assert.equal(c.next, 'Learn: Mate with king and queen');
    await homeRules(page, 'Club Home');
    await shot(page, vp, 'home-club', '#contCard');
    await page.context().close();
    page = await seeded(vp, prof({ showAll: true, course: done('rules') }), { tab: 'coach' });
    c = await cont(page);
    assert.equal(c.kicker, 'Continue · Lesson 2 of 7'); assert.equal(c.title, 'Special rules and draws'); assert.equal(c.next, 'Learn: Special rules and draws');
    await homeRules(page, 'Beginner with Show everything');
    await page.context().close();
    // F-D15: Beginner Home has its own card and no second Continue card
    page = await seeded(vp, prof({ course: done('rules') }), { tab: 'coach' });
    assert.equal((await cont(page)).shown, false, 'no Improver Continue card on Beginner Home');
    assert.equal((await page.locator('#bhome .bh-kick').textContent()).trim(), 'Lesson 2 of 7');
    await one(page, 'Beginner Home');
    return page;
  }],
  ['F1-D49: the Continue card asks first when its next part is a lesson game and a game is unfinished', async (vp) => {
    const page = await seeded(vp, improver({ course: Object.assign(done('fork', 'pin', 'disc', 'patterns'), { check2: { learn: 1 } }) }), { tab: 'coach', game: Object.assign({}, GAME_OPEN, { level: 3 }) });
    const c = await cont(page);
    assert.equal(c.kicker, 'Continue · Lesson 5 of 5'); assert.equal(c.button, 'Continue'); assert.equal(c.next, 'Apply: Checkpoint: tactics in a real game');
    await page.locator('#contCard .bh-go').click();
    assert.equal(await noteText(page), ASK);
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), GAME_OPEN.sans, 'the game is kept while Rani asks');
    await page.locator('#raniNote [data-act="askgo"]').click();
    await page.waitForFunction(() => window.__coach.st.goal && window.__coach.st.goal.unit === 'check2');
    assert.equal(await st(page, 'tab'), 'play');
    return page;
  }],

  /* ---------- After a game ---------- */
  ['F1-3 / Scenario 3: a won game: nothing over the board, a result card under it with Review this game, New game and Home', async (vp) => {
    const page = await seeded(vp, improver(), { tab: 'play', game: MATE1({ level: 3 }) });
    await mateInOne(page);
    const c = await card(page, '#gameEnd');
    assert.equal(c.title, 'Checkmate. You win!'); assert.equal(c.text, 'Great finish. Review it, then try a stronger opponent.'); assert.equal(c.line, null);
    assert.equal(c.main, 'Review this game'); assert.deepEqual(c.small, ['New game', 'Home']);
    cardRules(c, vp, 'won game'); await one(page, 'Play at game end');
    await underBoard(page, vp, 'won game');
    assert.equal(await page.locator('#banner').count(), 0, 'the box over the board is gone');
    await shot(page, vp, 'game-win', '#gameEnd');
    // keyboard reaches the main button, and it opens the review
    await page.locator('#gameEnd .ec-main').focus(); await page.keyboard.press('Enter');
    assert.equal(await st(page, 'mode'), 'review');
    assert.equal((await card(page, '#reviewEnd')).shown, false, 'opening the review at the last move shows no card yet');
    await page.locator('#modeExit').click();
    assert.equal((await card(page, '#gameEnd')).main, 'Review this game', 'the card is back with the game');
    await page.locator('#gameEnd .ec-small', { hasText: 'Home' }).click();
    assert.equal(await st(page, 'tab'), 'coach');
    await page.locator('#tab-play').click();
    await page.locator('#gameEnd .ec-small', { hasText: 'New game' }).click();
    await page.waitForFunction(() => window.__coach.hist().length <= 1 && !window.__coach.st.over);
    assert.equal((await card(page, '#gameEnd')).shown, false, 'a new game has no result card');
    return page;
  }],
  ['F1-3b: a lost game and a Beginner’s result card (plain words)', async (vp) => {
    let page = await seeded(vp, improver(), { tab: 'play', game: LOST });
    let c = await card(page, '#gameEnd');
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => window.scrollY), 0, 'opening the app with a finished game does not scroll the page by itself');
    assert.equal(c.title, 'Checkmate'); assert.equal(c.text, 'The engine wins this one. Review it to find the turning point.');
    assert.equal(c.main, 'Review this game'); assert.deepEqual(c.small, ['New game', 'Home']);
    cardRules(c, vp, 'lost game'); await underBoard(page, vp, 'lost game'); await one(page, 'Play, lost game');
    await shot(page, vp, 'game-loss', '#gameEnd');
    await page.context().close();
    page = await seeded(vp, prof(), { tab: 'play', game: Object.assign({}, LOST, { level: 1 }) });
    c = await card(page, '#gameEnd');
    assert.equal(c.title, 'Checkmate'); assert.equal(c.text, 'Rani’s partner wins this one. Review it to find the turning point.');
    cardRules(c, vp, 'Beginner lost game'); beginnerWords(c, 'Beginner lost game'); await underBoard(page, vp, 'Beginner lost game');
    await page.locator('#gameEnd .ec-small', { hasText: 'New game' }).click();
    await page.waitForFunction(() => window.__coach.hist().length <= 1 && !window.__coach.st.over);
    assert.equal(await st(page, 'level'), 1, 'D19: a Beginner’s new game plays Rani’s practice partner');
    return page;
  }],
  ['F1-4a: lesson game, task passed: Next lesson line and Start next lesson', async (vp) => {
    // Improver: the checkpoint game is won while Pins and skewers is still open
    let page = await seeded(vp, improver({ course: Object.assign(done('fork'), { check2: { learn: 1 } }) }), { tab: 'play', game: MATE1({ level: 3, goal: goal('win', 'check2') }) });
    await mateInOne(page);
    let c = await card(page, '#gameEnd');
    assert.equal(c.title, 'Checkmate. You win!'); assert.equal(c.text, 'Great finish. Review it, then try a stronger opponent.');
    assert.equal(c.line, 'Next lesson: Pins and skewers'); assert.equal(c.main, 'Start next lesson'); assert.deepEqual(c.small, ['Review this game', 'Home']);
    cardRules(c, vp, 'lesson game passed'); await underBoard(page, vp, 'lesson game passed'); await one(page, 'Play, lesson game passed');
    assert.equal(await page.locator('#goalCard button').count(), 0, 'the goal card has no buttons once the game is over');
    await shot(page, vp, 'game-lesson-passed', '#gameEnd');
    await page.locator('#gameEnd .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    assert.equal(await page.evaluate(() => window.__coach.st.ls.unit.id), 'pin');
    await page.context().close();
    // Beginner: the Opening principles game is passed, The blunder check is next (a Foundations lesson, D39)
    page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate'), { opening: { learn: 1 } }) }), { tab: 'play', game: MATE1({ goal: goal('noBlunder', 'opening') }) });
    await mateInOne(page);
    c = await card(page, '#gameEnd');
    assert.equal(c.text, 'Great finish. Review it.');
    assert.equal(c.line, 'Next lesson: The blunder check'); assert.equal(c.main, 'Start next lesson'); assert.deepEqual(c.small, ['Review this game', 'Home']);
    cardRules(c, vp, 'Beginner lesson game passed'); beginnerWords(c, 'Beginner lesson game passed');
    await page.locator('#gameEnd .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    assert.equal(await page.evaluate(() => window.__coach.st.ls.unit.id), 'blunder');
    return page;
  }],
  ['F1-4b: lesson game, task passed, no lesson left at the level: Review this game, New game, Home', async (vp) => {
    let page = await seeded(vp, improver({ course: Object.assign(done('fork', 'pin', 'disc', 'patterns'), { check2: { learn: 1 } }) }), { tab: 'play', game: MATE1({ level: 3, goal: goal('win', 'check2') }) });
    await mateInOne(page); await escNote(page);
    let c = await card(page, '#gameEnd');
    assert.equal(c.line, null); assert.equal(c.main, 'Review this game'); assert.deepEqual(c.small, ['New game', 'Home']);
    cardRules(c, vp, 'last Tactics lesson passed');
    await page.context().close();
    // D39: a Beginner who passes the last Foundations game is not sent to Forks
    page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate', 'opening'), { blunder: { learn: 1, practice: 1 } }) }), { tab: 'play', game: MATE1({ level: 2, goal: goal('noBlunder', 'blunder') }) });
    await mateInOne(page); await escNote(page);
    c = await card(page, '#gameEnd');
    assert.equal(c.line, null); assert.equal(c.main, 'Review this game'); assert.deepEqual(c.small, ['New game', 'Home']);
    cardRules(c, vp, 'last Foundations lesson passed'); beginnerWords(c, 'last Foundations lesson passed');
    return page;
  }],
  ['F1-4c / AC5: lesson game, task not passed: Try again, never the next lesson', async (vp) => {
    const page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate'), { opening: { learn: 1 } }) }), { tab: 'play', game: MATE1({ goal: goal('develop', 'opening') }) });
    await mateInOne(page);
    const c = await card(page, '#gameEnd');
    assert.equal(c.title, 'Checkmate. You win!'); assert.equal(c.text, 'Great finish. Review it.');
    assert.equal(c.line, null); assert.equal(c.main, 'Try again'); assert.deepEqual(c.small, ['Review this game', 'Home']);
    assert.ok(!/Next lesson|Start next lesson/.test(c.all), 'not passing never offers the next step');
    cardRules(c, vp, 'lesson game not passed'); beginnerWords(c, 'lesson game not passed'); await underBoard(page, vp, 'lesson game not passed'); await one(page, 'Play, lesson game not passed');
    assert.equal(await page.locator('#goalCard button').count(), 0);
    await page.locator('#gameEnd .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.goal && window.__coach.st.goal.status === 'active' && window.__coach.hist().length <= 1);
    assert.equal(await page.evaluate(() => window.__coach.st.goal.unit), 'opening', 'the lesson game starts again');
    return page;
  }],
  ['F1-8 / Scenario 8: the last move of a review: "That’s the whole game." and the Continue card’s step', async (vp) => {
    let page = await seeded(vp, improver({ course: done('fork'), games: [PAST()] }), { tab: 'progress' });
    await page.locator('#history [data-review]').first().click();
    assert.equal(await st(page, 'mode'), 'review');
    assert.equal((await card(page, '#reviewEnd')).shown, false, 'no card at the start of the review');
    const navY = () => page.evaluate(() => document.getElementById('navNext').getBoundingClientRect().top + window.scrollY);
    for (let i = 0; i < 4; i++) { await page.locator('#navNext').click(); await page.waitForFunction((n) => window.__coach.st.rv.ply === n && !!window.__coach.st.rv.notes[n - 1], i + 1, { timeout: 30000 }); }
    let c = await card(page, '#reviewEnd');
    const yCard = await navY(); // the same screen with and without the card
    await page.evaluate(() => { document.getElementById('reviewEnd').hidden = true; });
    assert.equal(await navY(), yCard, 'R7: the Prev and Next controls sit where they are without the card');
    await page.evaluate(() => { document.getElementById('reviewEnd').hidden = false; });
    await page.locator('#reviewEnd').scrollIntoViewIfNeeded();
    const rg = await page.evaluate(() => { const c = document.getElementById('reviewEnd').getBoundingClientRect(), n = document.getElementById('navControls').getBoundingClientRect(), t = document.querySelector('.tabs'), fixed = getComputedStyle(t).position === 'fixed';
      const m = document.querySelector('#reviewEnd .ec-main').getBoundingClientRect(), hit = document.elementFromPoint(m.left + m.width / 2, m.top + m.height / 2);
      return { under: c.top >= n.bottom, hit: !!hit && !!hit.closest('#reviewEnd .ec-main'), clear: !fixed || m.bottom <= t.getBoundingClientRect().top + 0.5 }; });
    assert.equal(rg.under, true, 'R7: the card is under the controls'); assert.ok(rg.hit && rg.clear, 'R7: the fixed nav does not cover the main button');
    assert.equal(c.title, 'That’s the whole game.'); assert.equal(c.line, 'Next lesson: Pins and skewers', 'F-D29'); assert.equal(c.main, 'Start next lesson', 'F-D33'); assert.deepEqual(c.small, ['New game', 'Home']);
    cardRules(c, vp, 'review finished');
    await page.locator('#tab-coach').click();
    const h = await cont(page);
    assert.equal('Next lesson: ' + h.title, c.line, 'the same step Home’s Continue card names'); assert.equal(h.button, 'Start lesson');
    await page.locator('#tab-play').click();
    await shot(page, vp, 'review-finished', '#reviewEnd');
    await page.locator('#navPrev').click();
    assert.equal((await card(page, '#reviewEnd')).shown, false, 'stepping back hides the card');
    await page.locator('#navLast').click();
    await page.locator('#reviewEnd .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    assert.equal(await page.evaluate(() => window.__coach.st.ls.unit.id), 'pin');
    await page.context().close();
    // New game and Home leave the review
    page = await seeded(vp, improver({ course: done('fork'), games: [PAST()] }), { tab: 'progress' });
    await page.locator('#history [data-review]').first().click(); await page.locator('#navLast').click();
    await page.locator('#reviewEnd .ec-small', { hasText: 'Home' }).click();
    assert.equal(await st(page, 'tab'), 'coach'); assert.equal(await st(page, 'mode'), 'play');
    await page.locator('#tab-progress').click();
    await page.locator('#history [data-review]').first().click(); await page.locator('#navLast').click();
    await page.locator('#reviewEnd .ec-small', { hasText: 'New game' }).click();
    assert.equal(await st(page, 'mode'), 'play'); assert.equal(await st(page, 'tab'), 'play');
    await page.context().close();
    // A Beginner (all tabs open): the step is Beginner Home's, in plain words; an unfinished game is not "the whole game"
    page = await seeded(vp, prof({ unlockAll: true, course: done(...FOUND), levelOfferT: NOW, games: [PAST({ level: 0 })] }), { tab: 'progress', game: GAME_OPEN });
    await page.locator('#tab-play').click();
    await page.locator('#reviewBtn').click();
    await page.locator('#navPrev').click(); await page.locator('#navNext').click();
    assert.equal((await card(page, '#reviewEnd')).shown, false, 'a game still going has no "whole game" card');
    await page.locator('#modeExit').click();
    await page.locator('#tab-progress').click();
    await page.locator('#history [data-review]').first().click(); await page.locator('#navLast').click();
    c = await card(page, '#reviewEnd');
    assert.equal(c.title, 'That’s the whole game.'); assert.equal(c.line, 'Beat Rani’s practice partner'); assert.equal(c.main, 'Back to my game'); assert.deepEqual(c.small, ['New game', 'Home']);
    cardRules(c, vp, 'Beginner review finished'); beginnerWords(c, 'Beginner review finished');
    await page.locator('#reviewEnd .ec-main').click();
    assert.equal(await st(page, 'mode'), 'play'); assert.deepEqual(await page.evaluate(() => window.__coach.hist()), GAME_OPEN.sans, 'the unfinished game is kept');
    return page;
  }],

  /* ---------- After a lesson step or puzzle set ---------- */
  ['F1-4 / Scenario 4: practice passed, game task next: "Next: play it in a real game." and Play the lesson game', async (vp) => {
    const page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate', 'opening'), { blunder: { learn: 1 } }) }), { tab: 'coach' });
    await page.locator('#bhome .bh-go').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.unit === 'blunder');
    await jump(page, 7); await lastQuiz(page, true);
    const c = await card(page, '#sessionCard');
    assert.equal(c.title, 'Session complete'); assert.equal(c.text, '8 of 10 correct. Passed! This step is done.');
    assert.equal(c.line, 'Next: play it in a real game.'); assert.equal(c.main, 'Play the lesson game'); assert.deepEqual(c.small, ['Go again', 'Home']);
    cardRules(c, vp, 'practice passed'); beginnerWords(c, 'practice passed');
    await one(page, 'session end, Learn');
    await shot(page, vp, 'session-passed', '#sessionCard');
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.goal && window.__coach.st.goal.unit === 'blunder' && window.__coach.st.mode === 'play');
    assert.equal(await st(page, 'tab'), 'play');
    assert.ok((await page.locator('#modeText').innerText()).includes(PARTNER), 'the lesson game is against Rani’s practice partner');
    return page;
  }],
  ['F1-5 / Scenario 5 / AC5: not passed: Go again, and no next step', async (vp) => {
    const page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate', 'opening'), { blunder: { learn: 1 } }) }), { tab: 'coach' });
    await page.evaluate(() => window.__coach.startPart('blunder', 'practice'));
    await jump(page, 4); await lastQuiz(page, false);
    const c = await card(page, '#sessionCard');
    assert.equal(c.title, 'Almost there'); assert.equal(c.text, '4 of 10 correct. You need 8 to pass. Have another go.');
    assert.equal(c.line, null); assert.equal(c.main, 'Go again'); assert.deepEqual(c.small, ['Home']);
    assert.ok(!/Next|lesson game|Start next lesson/.test(c.all), 'no next step: ' + c.all);
    cardRules(c, vp, 'not passed'); beginnerWords(c, 'not passed');
    await one(page, 'end card, Learn');
    await shot(page, vp, 'session-not-passed', '#sessionCard');
    assert.equal(((await getProf(page)).course.blunder || {}).practice, undefined, 'the step is not done');
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && s.unit === 'blunder' && !s.finished && s.i === 0; });
    return page;
  }],
  ['F1-9 / Scenario 9 / D49: Play the lesson game asks first while a game is unfinished', async (vp) => {
    const page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate', 'opening'), { blunder: { learn: 1 } }) }), { tab: 'coach', game: GAME_OPEN });
    await page.evaluate(() => window.__coach.startPart('blunder', 'practice'));
    await jump(page, 8); await lastQuiz(page, true);
    assert.equal((await card(page, '#sessionCard')).main, 'Play the lesson game');
    await page.locator('#sessionCard .ec-main').click();
    assert.equal(await noteText(page), ASK);
    assert.equal(await st(page, 'goal'), null, 'no lesson game yet');
    await page.keyboard.press('Escape');
    assert.equal(await vis(page, '#raniNote'), false, 'Esc closes the question');
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), GAME_OPEN.sans, 'Esc keeps the game');
    assert.equal((await card(page, '#sessionCard')).main, 'Play the lesson game', 'and the end card');
    await page.locator('#sessionCard .ec-main').click();
    await page.locator('#raniNote [data-act="askgo"]').click();
    await page.waitForFunction(() => window.__coach.st.goal && window.__coach.st.goal.unit === 'blunder');
    assert.ok((await page.evaluate(() => window.__coach.hist())).length <= 1, 'the lesson game starts');
    return page;
  }],
  ['F1-6 / Scenario 6: last part of Forks passed: "Next lesson: Pins and skewers" and Start next lesson', async (vp) => {
    const page = await seeded(vp, improver({ course: { fork: { learn: 1 } } }), { tab: 'coach' });
    await page.locator('#contCard .bh-go').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.unit === 'fork');
    await jump(page, 6); await lastPuzzle(page);
    const c = await card(page, '#sessionCard');
    assert.equal(c.title, 'Session complete'); assert.equal(c.text, '7 of 8 correct. Passed! This step is done.');
    assert.equal(c.line, 'Next lesson: Pins and skewers'); assert.equal(c.main, 'Start next lesson'); assert.deepEqual(c.small, ['Go again', 'Home']);
    cardRules(c, vp, 'last part passed');
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    assert.equal(await page.evaluate(() => window.__coach.st.ls.unit.id), 'pin');
    return page;
  }],
  ['F1-6b: last part passed, no lesson left: Home (Improver); a Beginner follows Beginner Home', async (vp) => {
    let page = await seeded(vp, improver({ course: Object.assign(done('fork', 'pin', 'disc', 'check2'), { patterns: { learn: 1 } }) }), { tab: 'coach' });
    await page.evaluate(() => window.__coach.startPart('patterns', 'practice'));
    await jump(page, 7); await lastPuzzle(page); await escNote(page);
    let c = await card(page, '#sessionCard');
    assert.equal(c.line, null); assert.equal(c.main, 'Home'); assert.deepEqual(c.small, ['Go again']);
    cardRules(c, vp, 'no lesson left');
    await page.locator('#sessionCard .ec-main').click();
    assert.equal(await st(page, 'tab'), 'coach'); assert.equal(await st(page, 'ses'), null, 'Home leaves the end card');
    assert.equal((await cont(page)).title, 'Puzzles to reach 1200');
    await page.context().close();
    // A Beginner whose last Foundations part is the practice: the card follows Beginner Home (D39)
    page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate', 'opening'), { blunder: { learn: 1, apply: 1 } }) }), { tab: 'coach' });
    await page.evaluate(() => window.__coach.startPart('blunder', 'practice'));
    await jump(page, 9); await lastQuiz(page, true); await escNote(page);
    c = await card(page, '#sessionCard');
    assert.equal(c.line, null); assert.equal(c.main, 'Play now'); assert.deepEqual(c.small, ['Go again', 'Home']);
    cardRules(c, vp, 'Beginner, Foundations done'); beginnerWords(c, 'Beginner, Foundations done');
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'play' && window.__coach.st.tab === 'play' && !window.__coach.st.ses);
    assert.equal(await st(page, 'level'), 1, 'a game against Rani’s practice partner'); assert.equal(await st(page, 'goal'), null);
    return page;
  }],
  ['F1-L: the Learn part finished: Start practice, Play the lesson game, or Start next lesson', async (vp) => {
    // practice next
    let page = await seeded(vp, prof(), { tab: 'coach' });
    await page.locator('#bhome .bh-go').click();
    await finishLesson(page);
    let c = await card(page, '#learnEnd');
    assert.equal(c.title, 'How the pieces move'); assert.equal(c.line, 'Next: practise it.'); assert.equal(c.main, 'Start practice'); assert.deepEqual(c.small, ['Home']);
    cardRules(c, vp, 'learn finished'); beginnerWords(c, 'learn finished');
    assert.equal(await vis(page, '#levels'), true, 'the Learn tab still shows the course');
    await one(page, 'Learn end card');
    await shot(page, vp, 'learn-finished', '#learnEnd');
    await page.locator('#learnEnd .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.unit === 'rules' && window.__coach.st.ses.part === 'practice');
    assert.equal((await card(page, '#learnEnd')).shown, false);
    await page.context().close();
    // a game task next (Opening principles has no practice)
    page = await seeded(vp, prof({ course: done('rules', 'special', 'board', 'values', 'mate') }), { tab: 'coach' });
    await page.locator('#bhome .bh-go').click();
    await finishLesson(page);
    c = await card(page, '#learnEnd');
    assert.equal(c.title, 'Opening principles'); assert.equal(c.line, 'Next: play it in a real game.'); assert.equal(c.main, 'Play the lesson game'); assert.deepEqual(c.small, ['Home']);
    cardRules(c, vp, 'learn finished, game next');
    await page.locator('#learnEnd .ec-small', { hasText: 'Home' }).click();
    assert.equal(await st(page, 'tab'), 'coach');
    await page.locator('#tab-path').click();
    assert.equal((await card(page, '#learnEnd')).shown, false, 'Home leaves the end card');
    await page.context().close();
    // the Learn part is the whole lesson (Special rules and draws): the next lesson
    page = await seeded(vp, prof({ course: done('rules') }), { tab: 'coach' });
    await page.locator('#bhome .bh-go').click();
    await finishLesson(page);
    c = await card(page, '#learnEnd');
    assert.equal(c.title, 'Special rules and draws'); assert.equal(c.line, 'Next lesson: Board and notation'); assert.equal(c.main, 'Start next lesson'); assert.deepEqual(c.small, ['Go again', 'Home']);
    cardRules(c, vp, 'learn-only lesson finished');
    await page.locator('#learnEnd .ec-small', { hasText: 'Go again' }).click();
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson' && window.__coach.st.ls.unit.id === 'special');
    await finishLesson(page);
    await page.locator('#learnEnd .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson' && window.__coach.st.ls.unit.id === 'board');
    return page;
  }],
  ['F1-7 / Scenario 7: a set of 10 puzzles from Train: 10 more puzzles and Home; missed puzzles reviewed: Home', async (vp) => {
    let page = await seeded(vp, improver({ course: done('fork') }), { tab: 'train' });
    await page.locator('#ratedBtn').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.rated);
    await jump(page, 9); await lastPuzzle(page);
    let c = await card(page, '#sessionCard');
    assert.equal(c.title, 'Session complete'); assert.equal(c.text, '10 of 10 correct.');
    assert.equal(c.line, null); assert.equal(c.main, '10 more puzzles'); assert.deepEqual(c.small, ['Home']);
    cardRules(c, vp, 'Train puzzle set');
    await one(page, 'set end, Train');
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && s.rated && !s.finished && s.i === 0; });
    assert.equal(await page.locator('#ratedBtn').evaluate((b) => b.classList.contains('primary')), true, 'Train’s start button is the main button again');
    // the review of missed puzzles
    await page.evaluate(() => { const p = window.__coach.getProf(), id = window.__coach.PZ[0].id; p.puz[id] = { n: 1, ok: 0, box: 0, due: Date.now() - 1000 }; window.__coach.trainStart('review'); });
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && s.title === 'Review missed puzzles'; });
    assert.equal(await page.evaluate(() => window.__coach.st.ses.count), 1);
    await lastPuzzle(page);
    c = await card(page, '#sessionCard');
    assert.equal(c.line, null); assert.equal(c.main, 'Home'); assert.deepEqual(c.small, []);
    cardRules(c, vp, 'missed puzzles reviewed');
    await page.locator('#sessionCard .ec-main').click();
    assert.equal(await st(page, 'tab'), 'coach'); assert.equal(await st(page, 'ses'), null);
    await page.context().close();
    // F-D26: one theme ends with Go again (the same theme)
    page = await seeded(vp, improver({ course: done('fork') }), { tab: 'train' });
    await page.locator('#themeList [data-theme="fork"]').click();
    await page.waitForFunction(() => window.__coach.st.ses && /Forks/.test(window.__coach.st.ses.title));
    await jump(page, 9); await lastPuzzle(page);
    c = await card(page, '#sessionCard');
    assert.equal(c.main, 'Go again', 'F-D26'); assert.deepEqual(c.small, ['Home']);
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && /Forks/.test(s.title) && !s.finished && s.i === 0; });
    return page;
  }],
  ['F1-D: an endgame drill that runs out of moves: Go again and Home, no "Back to the course"', async (vp) => {
    const page = await seeded(vp, club(), { tab: 'coach' });
    await page.evaluate(() => window.__coach.startPart('kq', 'apply'));
    await page.waitForFunction(() => window.__coach.st.mode === 'drill');
    await page.evaluate(() => { const d = window.__coach.st.dr; d.moves = d.limit - 1; });
    await page.locator('#board .sq[data-sq="a1"]').click(); await page.locator('#board .sq[data-sq="a2"]').click();
    await page.waitForFunction(() => window.__coach.st.dr && window.__coach.st.dr.done, null, { timeout: 20000 });
    await page.locator('#tab-path').click(); // a lesson's drill shows its card on Learn, as before
    const c = await card(page, '#sessionCard');
    assert.equal(c.title, 'Out of moves'); assert.equal(c.line, null); assert.equal(c.main, 'Go again'); assert.deepEqual(c.small, ['Home']);
    cardRules(c, vp, 'drill not passed');
    await one(page, 'end card, Learn');
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.dr && !window.__coach.st.dr.done && window.__coach.st.dr.moves === 0);
    return page;
  }],
  ['F1-dark: an end card in dark mode', async (vp) => {
    const page = await seeded(vp, improver(), { tab: 'play', game: LOST, ctx: { colorScheme: 'dark' } });
    const c = await card(page, '#gameEnd');
    cardRules(c, vp, 'dark');
    const col = await page.evaluate(() => { const e = document.getElementById('gameEnd'), cs = getComputedStyle(e); return { bg: cs.backgroundColor, ink: getComputedStyle(e.querySelector('.ec-title')).color }; });
    assert.notEqual(col.bg, 'rgb(255, 255, 255)', 'dark surface'); assert.notEqual(col.bg, col.ink);
    await shot(page, vp, 'game-loss-dark', '#gameEnd');
    return page;
  }]  ,
  ['F-D19: a game the player ends with their own move is recorded once, however often the app starts again', async (vp) => {
    const page = await seeded(vp, improver(), { tab: 'play', game: MATE1({ level: 3 }) });
    await mateInOne(page);
    const today = (p) => { const d = new Date(), r = p.days[d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate()]; return r ? r.games : 0; };
    const p1 = await getProf(page);
    assert.equal(p1.games.length, 1); assert.equal(today(p1), 1);
    for (let i = 0; i < 2; i++) {
      await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement); await page.waitForTimeout(400);
      const p = await getProf(page);
      assert.equal(p.games.length, 1, 'start ' + (i + 2) + ': the game is in the history once'); assert.equal(today(p), 1, 'start ' + (i + 2) + ': today’s game count stays');
      assert.equal(p.games[0].id, p1.games[0].id, 'the same record');
      assert.equal((await card(page, '#gameEnd')).title, 'Checkmate. You win!', 'the finished game is still on the board');
    }
    // a finished game saved by an older build (snapshot says not recorded, the history has no copy) is still recorded, once
    await page.context().close();
    const old = await seeded(vp, improver(), { tab: 'play', game: Object.assign({}, LOST, { recorded: false }) });
    assert.equal((await getProf(old)).games.length, 1, 'recorded at the first start');
    await old.reload(); await old.waitForFunction(() => window.__coach && window.Placement); await old.waitForTimeout(400);
    assert.equal((await getProf(old)).games.length, 1, 'and not again');
    return old;
  }]
  ,
  /* ---------- F2: the tip slot ---------- */
  ['F2-10 / Scenario 10 / AC7: no slot anywhere on the first day; from the next calendar day at the bottom of Home and Progress and on end cards', async (vp) => {
    // A new install: the level check, no slot
    let page = await newPage(vp, null, CLOCK);
    await page.waitForFunction(() => window.Placement.isOpen());
    assert.equal(await anySlot(page), 0, 'no slot in the level check');
    await page.context().close();
    // The first day of an Improver (level set today, today's record only)
    page = await seeded(vp, improver(FIRST_DAY), { tab: 'coach', game: LOST, extra: CLOCK });
    assert.equal((await slot(page, '#homeSlot')).shown, false, 'first day: no slot on Home');
    await shot(page, vp, 'home-first-day-no-slot', '#methodsCard');
    await page.locator('#tab-progress').click();
    assert.equal((await slot(page, '#progSlot')).shown, false, 'first day: no slot on Progress');
    await page.locator('#tab-play').click();
    assert.equal((await card(page, '#gameEnd')).main, 'Review this game'); assert.equal(await anySlot(page), 0, 'first day: no slot on the game end card');
    await page.locator('#tab-train').click(); await page.locator('#ratedBtn').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.rated);
    await jump(page, 9); await lastPuzzle(page);
    assert.equal((await card(page, '#sessionCard')).main, '10 more puzzles'); assert.equal(await anySlot(page), 0, 'first day: no slot on the set’s end card');
    await page.evaluate(() => window.__coach.startPart('fork', 'learn')); await finishLesson(page);
    assert.equal((await card(page, '#learnEnd')).main, 'Start practice'); assert.equal(await anySlot(page), 0, 'first day: no slot on the lesson step’s end card');
    for (const t of ['coach', 'path', 'play', 'train', 'progress']) { await page.locator('#tab-' + t).click(); assert.equal(await anySlot(page), 0, 'first day: no slot on ' + t); }
    const day1 = await getProf(page);
    // Tomorrow: the same phone, one calendar day later
    await page.evaluate(() => localStorage.setItem('__clock', String(86400000))); await page.reload();
    await page.waitForFunction(() => window.__coach && window.Placement);
    await page.locator('#tab-coach').click();
    let s = await slot(page, '#homeSlot');
    assert.equal(s.shown, true, 'the next day: the slot at the bottom of Home'); slotRules(s, OTHER, 'Rani', 'Home');
    assert.equal(s.last, true, 'the slot is the last thing on Home');
    await page.locator('#tab-progress').click();
    s = await slot(page, '#progSlot'); assert.equal(s.shown, true, 'the next day: the slot on Progress'); slotRules(s, OTHER, 'Rani', 'Progress');
    await page.locator('#tab-play').click();
    s = await slot(page, '#gameEnd .tipslot'); assert.equal(s.shown, true, 'the next day: the slot on the game end card'); slotRules(s, OTHER, 'Rani', 'game end');
    await page.evaluate(() => window.__coach.trainStart('rated')); await jump(page, 9); await lastPuzzle(page);
    s = await slot(page, '#sessionCard .tipslot'); assert.equal(s.shown, true, 'the next day: the slot on the set’s end card'); slotRules(s, OTHER, 'Rani', 'set end');
    await page.evaluate(() => window.__coach.startPart('pin', 'learn')); await finishLesson(page);
    s = await slot(page, '#learnEnd .tipslot'); assert.equal(s.shown, true, 'the next day: the slot on the lesson step’s end card'); slotRules(s, OTHER, 'Rani', 'lesson step end');
    // AC7: the clock set back five days: nothing breaks, nothing is lost, and the first day does not come back
    const day2 = await getProf(page);
    await page.evaluate(() => localStorage.setItem('__clock', String(-5 * 86400000))); await page.reload();
    await page.waitForFunction(() => window.__coach && window.Placement);
    const back = await getProf(page);
    assert.deepEqual(back.course, day2.course, 'lessons kept'); assert.deepEqual(back.puz, day2.puz, 'puzzles kept'); assert.equal(back.rating, day2.rating); assert.equal(back.games.length, day2.games.length);
    assert.ok(Object.keys(day1.course).every((k) => back.course[k]), 'day one’s lesson is still done');
    await page.locator('#tab-coach').click();
    assert.equal((await cont(page)).shown, true, 'Home works'); assert.equal((await slot(page, '#homeSlot')).shown, true, 'not the first day again');
    await page.locator('#tab-progress').click(); assert.ok((await page.locator('#stats').innerText()).length > 0, 'Progress works');
    return page;
  }],
  ['F2-11 / Scenario 11: a Beginner on the second day finishes a game: Rani’s tip under the buttons, a Beginner tip, and it stays the same', async (vp) => {
    let page = await seeded(vp, prof(), { tab: 'play', game: MATE1() });
    await mateInOne(page);
    const c = await card(page, '#gameEnd');
    assert.equal(c.main, 'Review this game'); assert.equal(await anySlot(page), 1);
    let s = await slot(page, '#gameEnd .tipslot');
    slotRules(s, BEGINNER, 'Rani', 'Beginner game end'); beginnerWords({ all: s.text }, 'Beginner tip');
    const gs = await slotSel(page, '#gameEnd .tipslot');
    const m = await page.evaluate((gs) => { const e = document.getElementById('gameEnd'), t = document.querySelector(gs).getBoundingClientRect(); let low = 0; e.querySelectorAll('button').forEach((b) => { low = Math.max(low, b.getBoundingClientRect().bottom); }); return { slotTop: t.top, low, mainTop: e.querySelector('.ec-main').getBoundingClientRect().top + window.scrollY }; }, gs);
    assert.ok(m.slotTop >= m.low, 'the slot is under the buttons');
    await underBoard(page, vp, 'game end with the slot');
    await shot(page, vp, 'game-win-beginner-slot', '#gameEnd');
    // it does not change while she stays on the card: re-renders (flip the board twice) and time
    await page.locator('#flipBtn').click(); await page.locator('#flipBtn').click(); await page.waitForTimeout(700);
    const s2 = await slot(page, '#gameEnd .tipslot');
    assert.equal(s2.text, s.text, 'the same tip'); assert.equal(s2.h, s.h);
    assert.equal(await page.evaluate(() => document.querySelector('#gameEnd .ec-main').getBoundingClientRect().top + window.scrollY), m.mainTop, 'AC8: nothing on the card moved');
    assert.equal(await page.evaluate(() => document.querySelectorAll('.tipslot').length - Array.from(document.querySelectorAll('.tipslot')).filter((e) => e.offsetParent === null).length), 1, 'one slot on the screen');
    await page.context().close();
    // F-D13: a Beginner with Show everything on still gets Beginner tips; an Improver gets the other list
    page = await seeded(vp, prof({ showAll: true }), { tab: 'play', game: Object.assign({}, LOST, { level: 1 }) });
    s = await slot(page, '#gameEnd .tipslot'); slotRules(s, BEGINNER, 'Rani', 'Beginner with Show everything');
    await page.locator('#tab-coach').click();
    slotRules(await slot(page, '#homeSlot'), BEGINNER, 'Rani', 'Beginner with Show everything, Home');
    assert.equal((await slot(page, '#gameEnd .tipslot')).shown, false, 'the result card’s slot is on Play only: one slot per screen');
    await page.context().close();
    page = await seeded(vp, improver(), { tab: 'play', game: LOST });
    slotRules(await slot(page, '#gameEnd .tipslot'), OTHER, 'Rani', 'Improver game end');
    return page;
  }],
  ['F2-12 / Scenario 12 / AC6: no slot on screen in the middle of a lesson, game, puzzle or review, nor in Settings or the level check', async (vp) => {
    const tabs = async (page, why) => { for (const t of ['coach', 'path', 'play', 'train', 'progress']) { await page.locator('#tab-' + t).click(); assert.equal(await anySlot(page), 0, why + ': no slot with ' + t + ' open'); } };
    // a game in progress
    let page = await seeded(vp, improver({ course: done('fork'), games: [PAST()] }), { tab: 'play', game: Object.assign({}, GAME_OPEN, { level: 3 }) });
    await tabs(page, 'game in progress');
    // a review, to its last move (the review card has no slot)
    await page.locator('#tab-progress').click(); await page.locator('#history [data-review]').first().click();
    await tabs(page, 'review'); await page.locator('#tab-play').click(); await page.locator('#navLast').click();
    assert.equal((await card(page, '#reviewEnd')).title, 'That’s the whole game.'); assert.equal(await anySlot(page), 0, 'review: no slot on its last move');
    await page.context().close();
    // a lesson, then a puzzle set (no game going, so only the activity hides the slot)
    page = await seeded(vp, improver({ course: done('fork') }), { tab: 'coach' });
    assert.equal(await anySlot(page), 1, 'Home has its slot before the lesson');
    await page.locator('#contCard .bh-go').click(); await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    await tabs(page, 'lesson');
    await page.evaluate(() => window.__coach.trainStart('rated')); await page.waitForFunction(() => window.__coach.st.mode === 'puzzle');
    await tabs(page, 'puzzle set');
    await page.evaluate(() => window.__coach.startPart('kq', 'apply')); await page.waitForFunction(() => window.__coach.st.mode === 'drill');
    await tabs(page, 'drill');
    // leaving the activity brings Home's slot back; Train's list and Learn's list never have one
    await page.locator('#tab-path').click(); await page.locator('#modeExit').click();
    await page.locator('#tab-coach').click(); assert.equal((await slot(page, '#homeSlot')).shown, true, 'the slot is back on Home');
    await page.locator('#tab-train').click(); assert.equal(await anySlot(page), 0, 'Train has no slot');
    await page.locator('#tab-path').click(); assert.equal(await anySlot(page), 0, 'Learn has no slot');
    await page.locator('#tab-play').click(); assert.equal(await anySlot(page), 0, 'Play has no slot without a finished game');
    // Settings and the level check
    await page.locator('#tab-coach').click(); await page.locator('#settingsBtn').click();
    assert.equal(await page.locator('#settingsSheet .tipslot').count(), 0, 'no slot in Settings');
    await page.keyboard.press('Escape');
    await page.evaluate(() => window.__coach.openPlacement(true)); await page.waitForFunction(() => window.Placement.isOpen());
    assert.equal(await anySlot(page), 0, 'no slot during the level check');
    return page;
  }],
  ['F2-13 / Scenario 13 / AC10: offline, the slot still shows a tip and nothing reaches for the network', async (vp) => {
    const page = await seeded(vp, improver({ course: done('fork') }), { tab: 'coach', game: LOST });
    await page.context().setOffline(true);
    await page.locator('#tab-progress').click();
    slotRules(await slot(page, '#progSlot'), OTHER, 'Rani', 'offline Progress');
    await shot(page, vp, 'progress-slot', '#progSlot');
    await page.locator('#tab-coach').click();
    slotRules(await slot(page, '#homeSlot'), OTHER, 'Rani', 'offline Home');
    await page.locator('#tab-play').click();
    slotRules(await slot(page, '#gameEnd .tipslot'), OTHER, 'Rani', 'offline game end');
    await page.waitForTimeout(500);
    assert.deepEqual(page.outside, [], 'nothing left the page origin');
    assert.equal(await page.evaluate(() => performance.getEntriesByType('resource').filter((r) => !r.name.startsWith(location.origin) && !/fonts\.(googleapis|gstatic)\.com/.test(r.name)).length), 0, 'no resource from another origin');
    return page;
  }],
  ['F2-14 / Scenario 14: with Coach Gaja the label reads "Gaja’s tip" and shows Gaja', async (vp) => {
    let page = await seeded(vp, improver({ course: done('fork') }), { tab: 'coach', coach: 'gaja' });
    let s = await slot(page, '#homeSlot');
    slotRules(s, OTHER, 'Gaja', 'Gaja Home'); assert.equal(s.gaja, true, 'Gaja’s picture');
    await page.locator('#tab-progress').click();
    slotRules(await slot(page, '#progSlot'), OTHER, 'Gaja', 'Gaja Progress');
    await shot(page, vp, 'progress-slot-gaja', '#progSlot');
    // changing the coach on Home changes the label at once and keeps the tip
    await page.locator('#tab-coach').click();
    s = await slot(page, '#homeSlot');
    await page.locator('#lookCard [data-coach="rani"]').click();
    const r = await slot(page, '#homeSlot');
    slotRules(r, OTHER, 'Rani', 'back to Rani'); assert.equal(r.text, s.text, 'the tip stays'); assert.equal(r.gaja, false);
    await page.context().close();
    page = await seeded(vp, prof(), { tab: 'coach', coach: 'gaja' });
    slotRules(await slot(page, '#homeSlot'), BEGINNER, 'Gaja', 'Gaja Beginner Home');
    return page;
  }],
  ['F2-15 / Scenario 15: Beginner Home on the second day is as in S2b, with the slot under "Just play a game" and Continue on the first screen', async (vp) => {
    const page = await seeded(vp, prof({ course: done('rules') }), { tab: 'coach' });
    const hs = await slotSel(page, '#homeSlot');
    const m = await page.evaluate((hs) => {
      const q = (s) => document.querySelector(s), box = (s) => q(s === '#homeSlot' ? hs : s).getBoundingClientRect(), nav = q('.tabs'), fixed = getComputedStyle(nav).position === 'fixed';
      return { y: window.scrollY, kick: q('#bhome .bh-kick').textContent, go: q('#bhome .bh-go').textContent, alt: q('#bhome .bh-alt').textContent, goBottom: box('#bhome .bh-go').bottom, altBottom: box('#bhome .bh-alt').bottom,
        slotTop: box('#homeSlot').top, bottom: fixed ? nav.getBoundingClientRect().top : window.innerHeight, w: window.innerWidth, slotRight: box('#homeSlot').right, slotLeft: box('#homeSlot').left,
        prim: Array.from(document.querySelectorAll('.btn.primary')).filter((e) => e.offsetParent !== null).length, cards: ['contCard', 'stageHero', 'today'].filter((id) => document.getElementById(id).offsetParent !== null) };
    }, hs);
    assert.equal(m.kick, 'Lesson 2 of 7'); assert.equal(m.go, 'Start lesson'); assert.equal(m.alt, 'Just play a game'); assert.deepEqual(m.cards, [], 'Beginner Home as in S2b');
    assert.equal(m.prim, 1, 'one primary button');
    assert.ok(m.slotTop >= m.altBottom, 'the slot is under "Just play a game"');
    assert.ok(m.y === 0 && m.goBottom <= m.bottom + 0.5, 'Continue is on the first screen (' + Math.round(m.goBottom) + ' of ' + Math.round(m.bottom) + ')');
    assert.ok(m.slotLeft >= 0 && m.slotRight <= m.w + 0.5, 'the slot fits the width');
    const s = await slot(page, '#homeSlot');
    slotRules(s, BEGINNER, 'Rani', 'Beginner Home'); beginnerWords({ all: s.text }, 'Beginner Home tip'); assert.equal(s.last, true);
    await shot(page, vp, 'home-beginner-slot', '#homeSlot');
    // with a game going, "Back to my game" replaces the second button and Home drops the slot (never beside a game in progress)
    await page.locator('#bhome .bh-alt').click(); await page.waitForFunction(() => window.__coach.st.tab === 'play');
    await page.waitForFunction(() => !window.__coach.st.busy);
    await page.locator('#board .sq[data-sq="e2"]').click(); await page.locator('#board .sq[data-sq="e4"]').click();
    await page.waitForFunction(() => window.__coach.hist().length >= 2 && !window.__coach.st.busy, null, { timeout: 20000 });
    await page.locator('#tab-coach').click();
    assert.equal((await page.locator('#bhome .bh-alt').textContent()).trim(), 'Back to my game'); assert.equal(await anySlot(page), 0);
    return page;
  }],
  ['F2-8 / AC8: the slot has one fixed height (76px or more) for every tip, nothing is cut off, and it is a note, not a control', async (vp) => {
    const page = await seeded(vp, prof({ unlockAll: true }), { tab: 'play', game: Object.assign({}, LOST, { level: 1 }) });
    const measure = (sel) => page.evaluate(([s, tips]) => {
      const el = document.querySelector(s), tx = el.querySelector('.ts-text'), keep = tx.textContent, out = [];
      for (const t of tips) { tx.textContent = t; const b = el.querySelector('.ts-body'); out.push({ t, h: el.getBoundingClientRect().height, fits: b.scrollHeight <= el.clientHeight && b.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom + 0.5 && b.getBoundingClientRect().top >= el.getBoundingClientRect().top - 0.5, lines: Math.round(tx.getBoundingClientRect().height / parseFloat(getComputedStyle(tx).lineHeight)) }); }
      tx.textContent = tips[4] + ' ' + tips[9] + ' ' + tips[4]; const b = el.querySelector('.ts-body');
      const long = { h: el.getBoundingClientRect().height, fits: b.getBoundingClientRect().bottom <= el.getBoundingClientRect().bottom + 0.5 && b.getBoundingClientRect().top >= el.getBoundingClientRect().top - 0.5, clip: getComputedStyle(el).overflowY };
      tx.textContent = keep; return { rows: out, long };
    }, [sel, BEGINNER.concat(OTHER)]);
    const places = [['#gameEnd .tipslot', 'play'], ['#homeSlot', 'coach'], ['#progSlot', 'progress']];
    for (const pl of places) { await page.locator('#tab-' + pl[1]).click(); pl[0] = await slotSel(page, pl[0]); }
    let h0 = null;
    for (const [sel, tab] of places) {
      await page.locator('#tab-' + tab).click();
      const res = await measure(sel), rows = res.rows;
      if (vp.width <= 600 || sel !== '#slotStrip') assert.ok(res.long.h > rows[0].h, sel + ': R5: the box grows for a longer text: ' + res.long.h);
      assert.ok(res.long.fits && res.long.clip !== 'hidden', sel + ': R5: a longer text (or a larger font) is never clipped');
      for (const r of rows) {
        if (h0 == null) h0 = r.h;
        assert.equal(r.h, h0, sel + ': one height for every tip and place: ' + r.t);
        assert.ok(r.fits, sel + ': the tip fits the box: ' + r.t);
        assert.ok(r.lines <= 3, sel + ': a short tip (' + r.lines + ' lines): ' + r.t);
      }
    }
    assert.ok(h0 >= 76, 'the height is 76px or more: ' + h0);
    return page;
  }]  ,
  /* ---------- Fix round 1 ---------- */
  ['FR-A / F-D18: a lesson game’s goal decided before the game ends: next-step buttons and Keep playing on the goal card', async (vp) => {
    const goalBtns = (page) => page.evaluate(() => { const g = document.getElementById('goalCard'), on = (e) => !!e && e.offsetParent !== null; return { text: g.innerText, line: on(g.querySelector('.ec-line')) ? g.querySelector('.ec-line').textContent : null,
      main: Array.from(g.querySelectorAll('.ec-main')).filter(on).map((b) => b.textContent.trim()), small: Array.from(g.querySelectorAll('.ec-small')).filter(on).map((b) => b.textContent.trim()), h: Array.from(g.querySelectorAll('button')).filter(on).map((b) => b.getBoundingClientRect().height) }; });
    // passed: the next lesson
    let page = await seeded(vp, improver({ course: Object.assign(done('fork'), { check2: { learn: 1, apply: 1 } }) }), { tab: 'play', game: Object.assign({}, GAME_OPEN, { level: 3, goal: Object.assign(goal('win', 'check2'), { status: 'done' }) }) });
    let g = await goalBtns(page);
    assert.ok(g.text.includes('Goal reached!'), g.text);
    assert.equal(g.line, 'Next lesson: Pins and skewers'); assert.deepEqual(g.main, ['Start next lesson']); assert.deepEqual(g.small, ['Keep playing']);
    assert.ok(!/Back to the course/.test(g.text), 'no "Back to the course"'); assert.ok(g.h.every((h) => h >= 44), 'buttons 44px: ' + g.h);
    const hintOn = (pg) => pg.evaluate(() => document.getElementById('hintBtn').classList.contains('primary'));
    assert.equal(await hintOn(page), false, 'the goal card holds the main button, Hint is plain'); await one(page, 'goal decided, next lesson');
    await shot(page, vp, 'goal-card-passed', '#goalCard');
    { // F-D30: no lesson left to offer: only Keep playing, and Hint keeps its filled style
      const p4 = await seeded(vp, improver({ course: done(...TACTICS) }), { tab: 'play', game: Object.assign({}, GAME_OPEN, { level: 3, goal: Object.assign(goal('win', 'check2'), { status: 'done' }) }) });
      await p4.waitForFunction(() => !window.__coach.st.busy);
      const g4 = await p4.evaluate(() => { const g = document.getElementById('goalCard'); return { main: g.querySelectorAll('.ec-main').length, small: Array.from(g.querySelectorAll('.ec-small')).map((b) => b.textContent.trim()) }; });
      assert.equal(g4.main, 0); assert.deepEqual(g4.small, ['Keep playing']);
      assert.equal(await hintOn(p4), true, 'F-D30: Hint keeps its filled style'); await one(p4, 'goal decided, nothing to start');
      assert.deepEqual(p4.errors, []); await p4.context().close();
    }
    await page.locator('#goalCard .ec-small').click();
    g = await goalBtns(page);
    assert.deepEqual(g.main.concat(g.small), [], 'Keep playing puts the buttons away'); assert.ok(g.text.includes('Goal reached!'));
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), GAME_OPEN.sans, 'and the game goes on');
    assert.notEqual(await page.evaluate(() => document.activeElement === document.body), true, 'focus is not lost');
    await page.context().close();
    page = await seeded(vp, improver({ course: Object.assign(done('fork'), { check2: { learn: 1, apply: 1 } }) }), { tab: 'play', game: Object.assign({}, GAME_OPEN, { level: 3, goal: Object.assign(goal('win', 'check2'), { status: 'done' }) }) });
    await page.locator('#goalCard .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson' && window.__coach.st.ls.unit.id === 'pin');
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), GAME_OPEN.sans, 'the game is kept');
    await page.context().close();
    // failed: Try again (at once, F-D31) and Keep playing
    page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate', 'opening'), { blunder: { learn: 1, practice: 1 } }) }), { tab: 'play', game: Object.assign({}, GAME_OPEN, { level: 2, goal: Object.assign(goal('win', 'blunder'), { status: 'failed' }) }) });
    g = await goalBtns(page);
    assert.ok(g.text.includes('Not this time.'), g.text);
    assert.equal(g.line, null); assert.deepEqual(g.main, ['Try again']); assert.deepEqual(g.small, ['Keep playing']); assert.ok(!/Back to the course|Next lesson/.test(g.text));
    await page.locator('#goalCard .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.goal && window.__coach.st.goal.status === 'active' && window.__coach.hist().length <= 1);
    assert.equal(await vis(page, '#raniNote'), false, 'F-D31: Try again restarts the lesson game at once, no question');
    assert.equal(await page.evaluate(() => window.__coach.st.goal.unit), 'blunder');
    assert.equal((await goalBtns(page)).main.length, 0, 'an open goal has no buttons');
    return page;
  }],
  ['FR-B / F-D23: lesson game passed while the practice of the same lesson is undone: "Next: practise it." and Start practice', async (vp) => {
    const page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate', 'opening'), { blunder: { learn: 1 } }) }), { tab: 'play', game: MATE1({ level: 2, goal: goal('noBlunder', 'blunder') }) });
    await mateInOne(page);
    const c = await card(page, '#gameEnd');
    assert.equal(c.line, 'Next: practise it.'); assert.equal(c.main, 'Start practice'); assert.deepEqual(c.small, ['Review this game', 'Home']);
    assert.ok(!/Next lesson/.test(c.all), 'never "Next lesson: <same lesson>": ' + c.all);
    cardRules(c, vp, 'game passed, practice undone'); beginnerWords(c, 'game passed, practice undone');
    await page.locator('#gameEnd .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.unit === 'blunder' && window.__coach.st.ses.part === 'practice');
    return page;
  }],
  ['FR-D / F-D24 / F-D28: off the Play tab a finished game shows one line and no buttons; one main button on every Home; Hint is filled only while playing', async (vp) => {
    const line = (page) => page.evaluate(() => { const e = document.getElementById('gameEnd'); return { on: e.offsetParent !== null, text: e.innerText.trim(), buttons: e.querySelectorAll('button').length, slot: e.querySelectorAll('.tipslot').length }; });
    const hint = (page) => page.evaluate(() => { const h = document.getElementById('hintBtn'); return h.offsetParent !== null && h.classList.contains('primary'); });
    for (const [who, p, title] of [['Improver', improver({ course: done('fork') }), 'Checkmate'], ['Club', club(), 'Checkmate'], ['Beginner, Show everything', prof({ showAll: true }), 'Checkmate'], ['Beginner', prof({ unlockAll: true }), 'Checkmate']]) {
      const page = await seeded(vp, p, { tab: 'coach', game: LOST });
      await one(page, who + ' Home with a finished game');
      const boardShown = await vis(page, '.boardcol');
      if (boardShown) {
        const l = await line(page);
        assert.equal(l.on, true, who + ': the result line shows under the board'); assert.equal(l.text, title, who + ': one line, the result title'); assert.equal(l.buttons, 0, who + ': no buttons'); assert.equal(l.slot, 0);
        assert.equal(await hint(page), false, who + ': Hint is a plain button on Home');
        if (who === 'Improver') await shot(page, vp, 'home-result-line', '#gameEnd');
      }
      for (const t of ['path', 'train', 'progress']) { await page.locator('#tab-' + t).click(); const l = await line(page); assert.equal(l.buttons, 0, who + ': no result buttons on ' + t); assert.equal(l.text, title); }
      await page.locator('#tab-play').click();
      const c = await card(page, '#gameEnd');
      assert.equal(c.main, 'Review this game', who + ': the full card on Play'); await one(page, who + ' Play at game end');
      assert.equal(await hint(page), false, who + ': Hint is plain at game end');
      await page.locator('#gameEnd .ec-small', { hasText: 'New game' }).click();
      await page.waitForFunction(() => window.__coach.hist().length <= 1 && !window.__coach.st.over && !window.__coach.st.busy);
      assert.equal(await hint(page), true, who + ': Hint is the main button while a game is on');
      await page.locator('#tab-coach').click();
      await one(page, who + ' Home without a finished game');
      await page.context().close();
    }
    // a puzzle in progress: Hint is filled on its own tab
    const page = await seeded(vp, improver({ course: done('fork') }), { tab: 'train' });
    await one(page, 'Train');
    await page.locator('#ratedBtn').click(); await page.waitForFunction(() => window.__coach.st.mode === 'puzzle' && !window.__coach.st.pz.wait);
    assert.equal(await hint(page), true, 'Hint is filled during a puzzle');
    return page;
  }],
  ['FR-E / F-D25: a Beginner with Show everything on: Home, a passed set’s end card and the review card name the same step', async (vp) => {
    const WIN = PAST({ id: 'gw', level: 1 });
    const page = await seeded(vp, prof({ showAll: true, rating: 950, rn: 20, levelOfferT: NOW, course: done(...FOUND), games: [WIN] }), { tab: 'coach' });
    const h = await cont(page);
    assert.equal(h.title, 'Forks', 'the full Home is on Tactics (D40)'); assert.equal(h.button, 'Start lesson'); assert.equal(h.next, 'Learn: Forks');
    await page.evaluate(() => window.__coach.startPart('blunder', 'practice'));
    await jump(page, 9); await lastQuiz(page, true); await escNote(page);
    let c = await card(page, '#sessionCard');
    assert.equal(c.line, 'Next lesson: Forks', 'the end card follows the Home she sees'); assert.equal(c.main, 'Start next lesson'); assert.deepEqual(c.small, ['Go again', 'Home']);
    await page.locator('#sessionCard .ec-small', { hasText: 'Home' }).click();
    await page.locator('#tab-progress').click(); await page.locator('#history [data-review]').first().click(); await page.locator('#navLast').click();
    c = await card(page, '#reviewEnd');
    assert.equal(c.line, 'Next lesson: Forks'); assert.equal(c.main, 'Start next lesson', 'F-D33');
    await page.locator('#reviewEnd .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson' && window.__coach.st.ls.unit.id === 'fork');
    await page.context().close();
    // Show everything off: the same player follows Beginner Home on every card (D39)
    const p2 = await seeded(vp, prof({ unlockAll: true, rating: 950, rn: 20, levelOfferT: NOW, course: done(...FOUND), games: [WIN] }), { tab: 'coach' });
    assert.equal((await p2.locator('#bhome .bh-title').textContent()).trim(), 'Puzzles at your level');
    await p2.evaluate(() => window.__coach.startPart('blunder', 'practice'));
    await jump(p2, 9); await lastQuiz(p2, true); await escNote(p2);
    c = await card(p2, '#sessionCard');
    assert.equal(c.line, null); assert.equal(c.main, 'Start 10 puzzles'); beginnerWords(c, 'Beginner, Show everything off');
    return p2;
  }],
  ['FR-R1 / FR-R2: the tip and the main button never change while the game is graded and recorded; the card scrolls into view once', async (vp) => {
    const watch = (page) => page.evaluate(() => {
      window.__seen = { tips: [], mains: [] };
      const note = () => { const t = Array.from(document.querySelectorAll('.tipslot .ts-text')).filter((e) => e.offsetParent !== null).map((e) => e.textContent)[0], m = document.querySelector('#gameEnd .ec-main');
        if (t && !window.__seen.tips.includes(t)) window.__seen.tips.push(t); if (m && m.offsetParent !== null && !window.__seen.mains.includes(m.textContent)) window.__seen.mains.push(m.textContent); };
      new MutationObserver(note).observe(document.body, { childList: true, subtree: true, characterData: true }); note();
    });
    // R1: a normal game on day two
    let page = await seeded(vp, improver(), { tab: 'play', game: MATE1({ level: 3 }) });
    await page.locator('#tab-play').click(); await page.waitForFunction(() => !window.__coach.st.busy);
    const r0 = await page.evaluate(() => window.__coach.reveals());
    await watch(page);
    await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => window.__coach.getProf().games.length >= 1 && !window.__coach.st.busy, null, { timeout: 20000 });
    await page.waitForTimeout(700);
    let seen = await page.evaluate(() => window.__seen);
    assert.equal(seen.tips.length, 1, 'R1: one tip from the first moment to after the game is recorded: ' + JSON.stringify(seen.tips));
    assert.deepEqual(seen.mains, ['Review this game']);
    assert.equal((await page.evaluate(() => window.__coach.reveals())) - r0, 1, 'R1: the card is brought into view once');
    await page.context().close();
    // R2: a lesson game: the buttons wait until the task is decided
    for (const [type, want] of [['develop', 'Try again'], ['noBlunder', 'Start next lesson']]) {
      page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate'), { opening: { learn: 1 } }) }), { tab: 'play', game: MATE1({ goal: goal(type, 'opening') }) });
      await page.locator('#tab-play').click(); await page.waitForFunction(() => !window.__coach.st.busy);
      await watch(page);
      await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
      await page.waitForFunction(() => { const e = document.getElementById('gameEnd'); return e && !e.hidden; });
      assert.equal(await page.locator('#gameEnd .ec-title').textContent(), 'Checkmate. You win!', 'the result shows at once');
      await page.waitForFunction(() => window.__coach.getProf().games.length >= 1 && !window.__coach.st.busy, null, { timeout: 20000 });
      await page.waitForTimeout(500);
      seen = await page.evaluate(() => window.__seen);
      assert.deepEqual(seen.mains, [want], 'R2: the main button never flips (' + type + ')');
      assert.equal(seen.tips.length, 1, 'R1: one tip (' + type + ')');
      await page.context().close();
    }
    return seeded(vp, improver(), { tab: 'coach' });
  }],
  ['FR-R3: the Learn end card does not take Train’s main button away', async (vp) => {
    const page = await seeded(vp, improver({ course: done('fork') }), { tab: 'coach' });
    await page.locator('#contCard .bh-go').click(); await finishLesson(page);
    assert.equal((await card(page, '#learnEnd')).main, 'Start practice'); await one(page, 'Learn end card');
    await page.locator('#tab-train').click();
    assert.equal(await page.locator('#ratedBtn').evaluate((b) => b.classList.contains('primary')), true, 'Train has its main button');
    await one(page, 'Train after a Learn end card');
    await page.locator('#tab-path').click();
    assert.equal((await card(page, '#learnEnd')).main, 'Start practice', 'the end card is still on Learn');
    await page.locator('#levels [data-unit="pin"]').click();
    assert.equal((await card(page, '#learnEnd')).shown, false);
    await page.locator('#unitView [data-act="units"]').click();
    assert.equal((await card(page, '#learnEnd')).shown, false, 'All levels shows the course without the old card');
    return page;
  }],
  ['FR-R4 / AC4: practice passed with another task next: "Next: one more step." and Continue; a passed endgame drill’s end card', async (vp) => {
    // the practice of Pins and skewers is passed before its Learn part
    let page = await seeded(vp, improver({ course: done('fork') }), { tab: 'coach' });
    await page.evaluate(() => window.__coach.startPart('pin', 'practice'));
    await jump(page, 6); await lastPuzzle(page);
    let c = await card(page, '#sessionCard');
    assert.equal(c.title, 'Session complete'); assert.equal(c.line, 'Next: one more step.'); assert.equal(c.main, 'Continue'); assert.deepEqual(c.small, ['Go again', 'Home']);
    cardRules(c, vp, 'practice passed, other task next');
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson' && window.__coach.st.ls.unit.id === 'pin');
    await page.context().close();
    // a drill won on the board (a mate in one set up in the drill)
    page = await seeded(vp, club(), { tab: 'coach' });
    await page.evaluate(() => window.__coach.startPart('kq', 'apply'));
    await page.waitForFunction(() => window.__coach.st.mode === 'drill');
    await page.evaluate(() => window.__coach.st.dr.g.load('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'));
    await page.locator('#board .sq[data-sq="f7"]').click(); await page.locator('#board .sq[data-sq="g7"]').click();
    await page.waitForFunction(() => window.__coach.st.dr && window.__coach.st.dr.done);
    await page.locator('#tab-path').click();
    c = await card(page, '#sessionCard');
    assert.ok(/^Checkmate in \d+ moves!$/.test(c.title), c.title);
    assert.equal(c.line, 'Next: one more step.', 'the Learn part of this lesson is still open (F-D23)'); assert.equal(c.main, 'Continue'); assert.deepEqual(c.small, ['Go again', 'Home']);
    cardRules(c, vp, 'drill passed'); await one(page, 'drill passed');
    assert.ok(((await getProf(page)).course.kq || {}).apply, 'the drill counts');
    await page.context().close();
    // the same drill as the lesson's last part: the next lesson
    page = await seeded(vp, club({ course: { kq: { learn: 1 } } }), { tab: 'coach' });
    await page.evaluate(() => window.__coach.startPart('kq', 'apply'));
    await page.waitForFunction(() => window.__coach.st.mode === 'drill');
    await page.evaluate(() => window.__coach.st.dr.g.load('7k/5Q2/6K1/8/8/8/8/8 w - - 0 1'));
    await page.locator('#board .sq[data-sq="f7"]').click(); await page.locator('#board .sq[data-sq="g7"]').click();
    await page.waitForFunction(() => window.__coach.st.dr && window.__coach.st.dr.done);
    await page.locator('#tab-path').click();
    c = await card(page, '#sessionCard');
    assert.equal(c.line, 'Next lesson: Mate with king and rook'); assert.equal(c.main, 'Start next lesson'); assert.deepEqual(c.small, ['Go again', 'Home']);
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson' && window.__coach.st.ls.unit.id === 'kr');
    return page;
  }],
  ['FR-R6: end cards are announced and the keyboard never loses its place (a game end and a set end)', async (vp) => {
    const active = (page) => page.evaluate(() => { const a = document.activeElement; return { body: !a || a === document.body, cls: a ? a.className : '', id: a ? a.id : '', text: a ? a.textContent.trim().slice(0, 40) : '', shown: !!a && a.offsetParent !== null }; });
    const live = (page) => page.evaluate(() => { const e = document.getElementById('endLive'); return { text: e.textContent.trim(), mode: e.getAttribute('aria-live') }; });
    // a game ended from the keyboard
    let page = await seeded(vp, improver({ course: done('fork') }), { tab: 'play', game: MATE1({ level: 3 }) });
    await page.locator('#tab-play').click(); await page.waitForFunction(() => !window.__coach.st.busy);
    assert.equal((await live(page)).text, '', 'nothing is announced when the app opens');
    await page.locator('#board .sq[data-sq="h5"]').focus(); await page.keyboard.press('Enter');
    await page.locator('#board .sq[data-sq="f7"]').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__coach.getProf().games.length >= 1 && !window.__coach.st.busy, null, { timeout: 20000 });
    await page.waitForFunction(() => document.getElementById('endLive').textContent.length > 0);
    let l = await live(page);
    assert.equal(l.mode, 'polite'); assert.ok(l.text.startsWith('Checkmate. You win!') && l.text.includes('Great finish.'), 'the result is announced: ' + l.text);
    let a = await active(page);
    assert.equal(a.body, false, 'focus stays on the board square'); assert.ok(/\bsq\b/.test(a.cls), a.cls);
    await page.locator('#gameEnd .ec-main').focus(); await page.keyboard.press('Enter'); // Review this game
    a = await active(page); assert.ok(!a.body && a.shown, 'after Review this game focus is on something visible: ' + JSON.stringify(a));
    await page.locator('#modeExit').click();
    await page.locator('#gameEnd .ec-small', { hasText: 'Home' }).focus(); await page.keyboard.press('Enter');
    a = await active(page); assert.equal(a.id, 'tab-coach', 'Home sends focus to the Home tab');
    await page.context().close();
    // a set ended from the keyboard: the Next button goes away, focus lands on the card's heading, Tab reaches the main button
    page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate', 'opening'), { blunder: { learn: 1 } }) }), { tab: 'coach' });
    await page.evaluate(() => window.__coach.startPart('blunder', 'practice'));
    await jump(page, 4);
    await page.waitForFunction(() => window.__coach.st.mode === 'quiz' && window.__coach.st.qz && !window.__coach.st.qz.answered);
    await page.locator('#qSafe').focus(); await page.keyboard.press('Enter');
    await page.locator('#sessionCard [data-act="next"]').focus(); await page.keyboard.press('Enter');
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished);
    a = await active(page);
    assert.ok(/ec-title/.test(a.cls) && a.text === 'Almost there', 'focus is on the end card’s heading: ' + JSON.stringify(a));
    await page.waitForFunction(() => document.getElementById('endLive').textContent.startsWith('Almost'));
    l = await live(page); assert.ok(l.text.startsWith('Almost there') && l.text.includes('Have another go.'), 'the set’s end is announced: ' + l.text);
    await page.keyboard.press('Tab');
    a = await active(page); assert.ok(/ec-main/.test(a.cls) && a.text === 'Go again', 'Tab reaches the main button: ' + JSON.stringify(a));
    await page.keyboard.press('Enter');
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && !s.finished && s.i === 0; });
    a = await active(page); assert.ok(!a.body && a.shown, 'after Go again focus is on something visible: ' + JSON.stringify(a));
    return page;
  }],
  ['FR-R8: midnight on day one does not put a slot into an open end card (no re-render, focus kept)', async (vp) => {
    const page = await seeded(vp, improver(FIRST_DAY), { tab: 'train', extra: CLOCK });
    await page.locator('#ratedBtn').click(); await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.rated);
    await jump(page, 9); await lastPuzzle(page);
    assert.equal((await card(page, '#sessionCard')).main, '10 more puzzles'); assert.equal(await anySlot(page), 0, 'day one: no slot');
    await page.locator('#sessionCard .ec-main').focus();
    await page.evaluate(() => { window.__mainBtn = document.querySelector('#sessionCard .ec-main'); localStorage.setItem('__clock', String(86400000)); });
    await page.locator('#flipBtn').click(); await page.locator('#flipBtn').click(); // two re-renders after "midnight"
    await page.evaluate(() => window.__mainBtn.focus());
    await page.locator('#tab-play').click(); await page.locator('#tab-train').click(); // and a tab change and back
    assert.equal(await anySlot(page), 0, 'the open card keeps its day-one look');
    assert.equal(await page.evaluate(() => window.__mainBtn.isConnected && window.__mainBtn === document.querySelector('#sessionCard .ec-main')), true, 'the card was not rebuilt');
    await page.locator('#sessionCard .ec-main').click(); // a new set, a new card: day two
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && !s.finished && s.i === 0; });
    await jump(page, 9); await lastPuzzle(page);
    assert.equal((await slot(page, '#sessionCard .tipslot')).shown, true, 'the next card, on day two, has the slot');
    return page;
  }],
  ['FR-R9: a failed set’s coach strip does not say "Session complete"', async (vp) => {
    const page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate', 'opening'), { blunder: { learn: 1 } }) }), { tab: 'coach' });
    await page.evaluate(() => window.__coach.startPart('blunder', 'practice'));
    await jump(page, 4); await lastQuiz(page, false);
    const strip = await page.evaluate(() => document.getElementById('coachStrip').textContent);
    assert.equal((await card(page, '#sessionCard')).title, 'Almost there');
    assert.ok(!/Session complete/.test(strip) && /Almost there/.test(strip), 'the strip agrees with the card: ' + strip);
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && !s.finished && s.i === 0; });
    await jump(page, 9); await lastQuiz(page, true);
    assert.ok(/Session complete/.test(await page.evaluate(() => document.getElementById('coachStrip').textContent)), 'a passed set still says Session complete');
    return page;
  }],
  ['LAND / FR-R9: an end card’s main button and Beginner Home’s Continue can be reached, and the slot never covers them (also 915x412)', async (vp) => {
    const reach = async (page, sel, why) => {
      await page.evaluate((s) => document.querySelector(s).scrollIntoView({ block: 'center' }), sel); await page.waitForTimeout(350); // as a player scrolls to it
      const m = await page.evaluate((s) => { const b = document.querySelector(s), r = b.getBoundingClientRect(), hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2), t = document.querySelector('.tabs'), fixed = getComputedStyle(t).position === 'fixed';
        const slots = Array.from(document.querySelectorAll('.tipslot')).filter((e) => e.offsetParent !== null).map((e) => e.getBoundingClientRect());
        return { hit: !!hit && (hit === b || b.contains(hit)), inView: r.top >= 0 && r.bottom <= (fixed ? t.getBoundingClientRect().top : window.innerHeight) + 0.5, h: r.height, over: slots.some((q) => !(q.bottom <= r.top || q.top >= r.bottom || q.right <= r.left || q.left >= r.right)), sw: document.documentElement.scrollWidth <= window.innerWidth }; }, sel);
      assert.ok(m.hit && m.inView, why + ': the button can be reached: ' + JSON.stringify(m)); assert.equal(m.over, false, why + ': the slot does not cover it'); assert.ok(m.h >= 44, why + ': 44px'); assert.ok(m.sw, why + ': no sideways scroll');
    };
    let page = await seeded(vp, prof({ course: done('rules') }), { tab: 'coach' });
    assert.equal(await page.evaluate(() => window.scrollY), 0);
    const first = await page.evaluate(() => { const r = document.querySelector('#bhome .bh-go').getBoundingClientRect(); return r.top >= 0 && r.bottom <= window.innerHeight; });
    assert.equal(first, true, 'Beginner Home’s Continue is on the first screen');
    await reach(page, '#bhome .bh-go', 'Beginner Home'); assert.equal(await anySlot(page), 1, 'Home has its slot');
    await page.locator('#bhome .bh-go').click(); await finishLesson(page);
    await reach(page, '#learnEnd .ec-main', 'Learn end card');
    await page.context().close();
    page = await seeded(vp, improver({ course: done('fork') }), { tab: 'play', game: LOST });
    await reach(page, '#gameEnd .ec-main', 'game end card'); assert.equal(await anySlot(page), 1);
    await page.locator('#tab-train').click(); await page.locator('#ratedBtn').click(); await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.rated);
    await jump(page, 9); await lastPuzzle(page);
    await reach(page, '#sessionCard .ec-main', 'set end card'); assert.equal(await anySlot(page), 1);
    return page;
  }],
  ['FR-G / F-D27: on desktop the slot is one strip under both columns in every place; on phones it stays in its place', async (vp) => {
    const page = await seeded(vp, improver({ course: done('fork') }), { tab: 'coach', game: LOST });
    const wide = await isWide(page);
    assert.equal(wide, vp.width > 860);
    const places = [];
    let s = await slot(page, '#homeSlot'); slotRules(s, OTHER, 'Rani', 'Home'); places.push(s.h);
    const geo = () => page.evaluate(() => { const R = (q) => document.querySelector(q).getBoundingClientRect(), s = R('#slotStrip'), a = R('.app'); return { top: s.top, cols: Math.max(R('.boardcol').bottom, R('.side').bottom), w: s.width, appW: a.width, left: s.left - a.left }; });
    const strip = async (why) => { if (!wide) return; const g = await geo(); assert.ok(g.top >= g.cols, why + ': the strip’s top is at or below the bottom of both columns (' + g.top + ' vs ' + g.cols + ')'); assert.ok(Math.abs(g.w - g.appW) <= 1 && Math.abs(g.left) <= 1, why + ': the strip is as wide as the app content (' + g.w + ' vs ' + g.appW + ')'); };
    await strip('Home');
    if (wide) await shot(page, vp, 'slot-strip-home', '#slotStrip');
    await page.locator('#tab-progress').click(); s = await slot(page, '#progSlot'); slotRules(s, OTHER, 'Rani', 'Progress'); await strip('Progress'); if (wide) await shot(page, vp, 'slot-strip-progress', '#slotStrip');
    await page.locator('#tab-play').click(); s = await slot(page, '#gameEnd .tipslot'); slotRules(s, OTHER, 'Rani', 'game end'); await strip('game end'); if (wide) await shot(page, vp, 'slot-strip-game-end', '#slotStrip');
    await page.locator('#tab-path').click(); assert.equal(await anySlot(page), 0, 'Learn: no slot');
    await page.locator('#tab-train').click(); assert.equal(await anySlot(page), 0, 'Train: no slot');
    await page.locator('#ratedBtn').click(); await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.rated);
    assert.equal(await anySlot(page), 0, 'a set in progress: no slot');
    await jump(page, 9); await lastPuzzle(page);
    s = await slot(page, '#sessionCard .tipslot'); slotRules(s, OTHER, 'Rani', 'set end'); const t1 = s.text;
    await page.locator('#flipBtn').click(); assert.equal((await slot(page, '#sessionCard .tipslot')).text, t1, 'the same tip while the card is open');
    await strip('set end');
    if (wide) await shot(page, vp, 'slot-strip-set-end', '#slotStrip');
    await page.evaluate(() => window.__coach.startPart('pin', 'learn')); await finishLesson(page);
    s = await slot(page, '#learnEnd .tipslot'); slotRules(s, OTHER, 'Rani', 'lesson step end');
    assert.equal(await anySlot(page), 1, 'one slot on the screen'); await strip('lesson step end');
    if (wide) { // turning the window narrow moves the slot back into its place, and wide again into the strip
      await page.setViewportSize({ width: 500, height: 900 });
      await page.waitForFunction(() => { const e = document.querySelector('#learnEnd .tipslot'); return e && e.offsetParent !== null; });
      assert.equal(await page.evaluate(() => document.getElementById('slotStrip').offsetParent !== null), false);
      await page.setViewportSize(vp);
      await page.waitForFunction(() => document.getElementById('slotStrip').offsetParent !== null && !document.querySelector('#learnEnd .tipslot'));
    }
    return page;
  }]
  ,
  /* ---------- Fix round 2 ---------- */
  ['T2 / F-D32: a Learn or set end card has no slot (and no desktop strip) while a game is unfinished', async (vp) => {
    const page = await seeded(vp, improver(), { tab: 'coach', game: Object.assign({}, GAME_OPEN, { level: 3 }) });
    await page.locator('#contCard .bh-go').click(); await finishLesson(page);
    assert.equal((await card(page, '#learnEnd')).main, 'Start practice');
    assert.equal(await anySlot(page), 0, 'Learn end card with a paused game: no slot');
    await page.locator('#learnEnd .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.unit === 'fork');
    await jump(page, 7); await lastPuzzle(page);
    assert.equal((await card(page, '#sessionCard')).main, 'Start next lesson');
    assert.equal(await anySlot(page), 0, 'set end card with a paused game: no slot');
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), GAME_OPEN.sans);
    return page;
  }],
  ['T3: a lesson game’s goal decided mid-game: the goal card is brought into view and announced, never when the app opens', async (vp) => {
    // 11 quiet moves each; White's 12th move runs the "develop" task out of moves
    const sans = ['a3', 'a6', 'b3', 'b6', 'c3', 'c6', 'd3', 'd6', 'e3', 'e6', 'f3', 'f6', 'g3', 'g6', 'h3', 'h6', 'Ra2', 'Ra7', 'Rb2', 'Rb7', 'Ra2', 'Ra7'];
    const page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate'), { opening: { learn: 1 } }) }), { tab: 'play', game: Object.assign({}, GAME_OPEN, { sans, ann: {}, notes: {}, fb: null, goal: goal('develop', 'opening') }) });
    await page.locator('#tab-play').click(); await page.waitForFunction(() => !window.__coach.st.busy);
    assert.equal(await page.evaluate(() => window.__coach.st.goal.status), 'active');
    assert.equal(await page.evaluate(() => document.getElementById('endLive').textContent), ''); const r0 = await page.evaluate(() => window.__coach.reveals());
    await page.locator('#board .sq[data-sq="h3"]').click(); await page.locator('#board .sq[data-sq="h4"]').click();
    await page.waitForFunction(() => window.__coach.st.goal.status === 'failed' && !window.__coach.st.busy, null, { timeout: 30000 });
    await page.waitForFunction(() => document.getElementById('endLive').textContent.startsWith('Not this time.'));
    assert.equal(await page.evaluate(() => document.querySelector('#goalCard .ec-main').textContent), 'Try again');
    assert.equal((await page.evaluate(() => window.__coach.reveals())) - r0, 1, 'the goal card is brought into view once');
    await page.waitForTimeout(500);
    const m = await page.evaluate(() => { const b = document.getElementById('board').getBoundingClientRect(), g = document.querySelector('#goalCard .ec-main').getBoundingClientRect(), t = document.querySelector('.tabs'), fixed = getComputedStyle(t).position === 'fixed';
      return { boardTop: b.top, y: window.scrollY, inView: g.bottom <= (fixed ? t.getBoundingClientRect().top : window.innerHeight) + 0.5 }; });
    assert.ok(m.boardTop >= -0.5, 'the board stays on screen: ' + m.boardTop);
    assert.ok(m.inView || m.boardTop <= 1, 'the page moved as far as the board allows: ' + JSON.stringify(m));
    // the same goal after a restart: nothing scrolls, nothing is announced
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement); await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => document.getElementById('endLive').textContent), '', 'not announced again'); assert.equal(await page.evaluate(() => window.__coach.reveals()), 0, 'no card is scrolled into view when the app opens');
    assert.equal(await page.evaluate(() => document.querySelector('#goalCard .ec-main').textContent), 'Try again', 'the choice is still there');
    return page;
  }]
];

// A small static server for www/ (as s2b).
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml' };
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
      if (vp.width === 915 && !/^LAND/.test(name)) continue; // 915x412 (a phone held sideways) runs the landscape checks only
      const label = vp.width + 'x' + vp.height + ' ' + name;
      let page;
      try {
        page = await fn(vp);
        assert.deepEqual(page.errors, [], 'console errors');
        assert.deepEqual(page.outside, [], 'no request leaves the page origin');
        results.push('ok   ' + label);
      } catch (e) {
        failures++; results.push('FAIL ' + label + '\n     ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n     ') + (process.env.F1_STACK ? '\n' + e.stack : ''));
      } finally { if (page) await page.context().close(); }
    }
  } finally { await browser.close(); srv.close(); }
  console.log(results.join('\n'));
  console.log('\n' + (results.length - failures) + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})();
