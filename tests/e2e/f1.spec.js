// E2E for the flow rework: slice F1 (end cards with a next step, Continue card on Improver and Club Home) and slice F2 (tip slot).
// Run: F1_VP=412 node tests/e2e/f1.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// F1_VP: 360 | 412 | 1280. F1_SHOTS=<dir> saves screenshots. F1_ONLY=<regex> runs matching cases.
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
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }].filter((v) => !process.env.F1_VP || String(v.width) === process.env.F1_VP);
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
// Fool's mate: the player (White) is mated.
const LOST = { sans: ['f3', 'e5', 'g4', 'Qh4#'], user: 'w', level: 3, ann: {}, notes: {}, tags: {}, fb: null, opp: null, evalW: 0, t: NOW };
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
    return { kids, tops, prim: Array.from(panel.querySelectorAll('.btn.primary')).filter(on).length, heroBtns: hero.querySelectorAll('button').length, hero: hero.innerText };
  }, HOME_ORDER);
  assert.deepEqual(m.kids, HOME_ORDER, why + ': Continue card first, then today’s cards in today’s order');
  for (let i = 1; i < m.tops.length; i++) assert.ok(m.tops[i] > m.tops[i - 1], why + ': ' + HOME_ORDER[i] + ' below ' + HOME_ORDER[i - 1]);
  assert.equal(m.prim, 1, why + ': exactly one primary button on Home');
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
    assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll('#panel-coach .btn.primary')).filter((e) => e.offsetParent !== null).length), 1, 'one primary button on Beginner Home');
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
    cardRules(c, vp, 'won game');
    await underBoard(page, vp, 'won game');
    assert.equal(await page.locator('#banner').count(), 0, 'the box over the board is gone');
    await shot(page, vp, 'game-win', '#gameEnd');
    // keyboard reaches the main button, and it opens the review
    await page.locator('#gameEnd .ec-main').focus(); await page.keyboard.press('Enter');
    assert.equal(await st(page, 'mode'), 'review');
    assert.equal((await card(page, '#gameEnd')).shown, false, 'opening the review at the last move shows no card yet');
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
    assert.equal(c.title, 'Checkmate'); assert.equal(c.text, 'The engine wins this one. Review it to find the turning point.');
    assert.equal(c.main, 'Review this game'); assert.deepEqual(c.small, ['New game', 'Home']);
    cardRules(c, vp, 'lost game'); await underBoard(page, vp, 'lost game');
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
    cardRules(c, vp, 'lesson game passed'); await underBoard(page, vp, 'lesson game passed');
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
    cardRules(c, vp, 'lesson game not passed'); beginnerWords(c, 'lesson game not passed'); await underBoard(page, vp, 'lesson game not passed');
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
    assert.equal((await card(page, '#gameEnd')).shown, false, 'no card at the start of the review');
    for (let i = 0; i < 4; i++) { await page.locator('#navNext').click(); await page.waitForFunction((n) => window.__coach.st.rv.ply === n && !!window.__coach.st.rv.notes[n - 1], i + 1, { timeout: 30000 }); }
    let c = await card(page, '#gameEnd');
    assert.equal(c.title, 'That’s the whole game.'); assert.equal(c.line, 'Pins and skewers'); assert.equal(c.main, 'Start lesson'); assert.deepEqual(c.small, ['New game', 'Home']);
    cardRules(c, vp, 'review finished');
    await page.locator('#tab-coach').click();
    const h = await cont(page);
    assert.equal(h.title, c.line); assert.equal(h.button, c.main, 'the same step Home’s Continue card names');
    await page.locator('#tab-play').click();
    await shot(page, vp, 'review-finished', '#gameEnd');
    await page.locator('#navPrev').click();
    assert.equal((await card(page, '#gameEnd')).shown, false, 'stepping back hides the card');
    await page.locator('#navLast').click();
    await page.locator('#gameEnd .ec-main').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    assert.equal(await page.evaluate(() => window.__coach.st.ls.unit.id), 'pin');
    await page.context().close();
    // New game and Home leave the review
    page = await seeded(vp, improver({ course: done('fork'), games: [PAST()] }), { tab: 'progress' });
    await page.locator('#history [data-review]').first().click(); await page.locator('#navLast').click();
    await page.locator('#gameEnd .ec-small', { hasText: 'Home' }).click();
    assert.equal(await st(page, 'tab'), 'coach'); assert.equal(await st(page, 'mode'), 'play');
    await page.locator('#tab-progress').click();
    await page.locator('#history [data-review]').first().click(); await page.locator('#navLast').click();
    await page.locator('#gameEnd .ec-small', { hasText: 'New game' }).click();
    assert.equal(await st(page, 'mode'), 'play'); assert.equal(await st(page, 'tab'), 'play');
    await page.context().close();
    // A Beginner (all tabs open): the step is Beginner Home's, in plain words; an unfinished game is not "the whole game"
    page = await seeded(vp, prof({ unlockAll: true, course: done(...FOUND), levelOfferT: NOW, games: [PAST({ level: 0 })] }), { tab: 'progress', game: GAME_OPEN });
    await page.locator('#tab-play').click();
    await page.locator('#reviewBtn').click();
    await page.locator('#navPrev').click(); await page.locator('#navNext').click();
    assert.equal((await card(page, '#gameEnd')).shown, false, 'a game still going has no "whole game" card');
    await page.locator('#modeExit').click();
    await page.locator('#tab-progress').click();
    await page.locator('#history [data-review]').first().click(); await page.locator('#navLast').click();
    c = await card(page, '#gameEnd');
    assert.equal(c.title, 'That’s the whole game.'); assert.equal(c.line, 'Beat Rani’s practice partner'); assert.equal(c.main, 'Back to my game'); assert.deepEqual(c.small, ['New game', 'Home']);
    cardRules(c, vp, 'Beginner review finished'); beginnerWords(c, 'Beginner review finished');
    await page.locator('#gameEnd .ec-main').click();
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
    assert.equal(await page.evaluate(() => Array.from(document.querySelectorAll('#panel-path .btn.primary')).filter((e) => e.offsetParent !== null).length), 1, 'one main button on the screen');
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
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && s.rated && !s.finished && s.i === 0; });
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
    // one theme: 10 more of the same theme
    page = await seeded(vp, improver({ course: done('fork') }), { tab: 'train' });
    await page.locator('#themeList [data-theme="fork"]').click();
    await page.waitForFunction(() => window.__coach.st.ses && /Forks/.test(window.__coach.st.ses.title));
    await jump(page, 9); await lastPuzzle(page);
    c = await card(page, '#sessionCard');
    assert.equal(c.main, '10 more puzzles'); assert.deepEqual(c.small, ['Home']);
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
