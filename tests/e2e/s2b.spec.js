// E2E for slice S2b (Beginner Home, prototype A: Rani, one Continue card, a second button; board hidden on phones).
// Run: S2B_VP=412 node tests/e2e/s2b.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// S2B_VP: 360 | 412 | 1280 | 915 (a phone held sideways, 915x412). S2B_SHOTS=<dir> saves screenshots. S2B_ONLY=<regex> runs matching cases.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const assert = require('assert/strict');
const path = require('path');

const WWW = path.resolve(process.env.S2B_WWW || path.join(__dirname, '../../www'));
const PORT = 8000 + Math.floor(Math.random() * 900);
const URL = 'http://127.0.0.1:' + PORT + '/index.html';
const SHOTS = process.env.S2B_SHOTS || '';
const PKEY = 'suresh-chess-coach.profile.v1', GKEY = 'suresh-chess-coach.v1', TKEY = 'suresh-chess-coach.tab', CKEY = 'suresh-chess-coach.coach';
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }, { width: 915, height: 412 }].filter((v) => !process.env.S2B_VP || String(v.width) === process.env.S2B_VP);
const ONLY = process.env.S2B_ONLY ? new RegExp(process.env.S2B_ONLY) : null;
const NOW = Date.now(), DAY = 86400000;
const PARTNER = 'Rani’s practice partner';
const ASK = 'You have a game going. Finish it first?';
const OFFER_B = 'Ready for Improver? You finished every Foundations lesson. Next come forks, pins and other tactics.';
const BEFORE = require('./s2b-home-before.json'); // Improver and Club Home text from the build before S2b (AC11, AC12)
// F1 (F-D8, F-D10): the Continue card now comes first and the stage card lost its "Next step" button and sub line.
// F2 (F-D3): the tip slot is new at the bottom. Everything else on Improver and Club Home is still the text from before S2b:
// compare without those parts.
const beforeText = (key) => BEFORE[key].replace(/\nNext step: [^\n]* ›\n\n[^\n]*/, '');
async function homeText(page) {
  assert.ok(/^Continue/.test((await page.locator('#contCard .bh-kick').textContent()).trim()), 'the Continue card has its kicker');
  assert.equal(await page.locator('#contCard button').count(), 1, 'and one button');
  // F2 (F-D3): the tip slot is new at the bottom of Home; it is a note with the coach's label, one tip and no button
  const slot = page.locator('#homeSlot');
  if (await slot.isVisible()) { assert.ok(/^(Rani|Gaja)’s tip: .+/.test(await slot.getAttribute('aria-label'))); assert.equal(await slot.locator('button, a').count(), 0); }
  return page.evaluate(() => {
    const c = document.getElementById('contCard'), s = document.getElementById('homeSlot'), sh = s.hidden; c.hidden = true; s.hidden = true;
    const t = document.getElementById('panel-coach').innerText; c.hidden = false; s.hidden = sh; return t;
  });
}
const HOME_CARDS = ['#stageHero', '#today', '#stageCard', '#roadCard', '#lookCard', '#methodsCard'];
const FOUND = ['rules', 'special', 'board', 'values', 'mate', 'opening', 'blunder'];

let browser, results = [], failures = 0;

const DONE = { learn: 1, practice: 1, apply: 1 };
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, Object.assign({}, DONE)]));
function prof(o) {
  return Object.assign({ v: 5, level: 'beginner', levelT: NOW - DAY, placed: 'check', start: 'rules', rating: 600, rn: 0, games: [], puz: {}, course: {}, days: {}, reviewed: [], t: NOW - DAY, theme: null, showAll: false, unlockAll: false, provisional: false, pgsDeclined: false, levelOfferT: 0 }, o);
}
// prof.days keys, as the app's dkey(): local date, month 1-based, no padding. n days back from today.
const dkey = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const played = (...backs) => Object.fromEntries(backs.map((b) => [dkey(b), { puz: 0, games: 1, course: 0, solved: 0 }]));
const WIN1 = { id: 'gw', d: NOW - DAY, r: 'W', user: 'b', level: 1, acc: 80, counts: {}, tags: {}, sans: ['f3', 'e5', 'g4', 'Qh4#'], ann: {} };
const NOTE_E = { side: 'e', why: [{ c: 'good', h: 'No direct threat. It’s developing, so keep developing too and get castled.' }], ev: 30 };
const GAME_OPEN = { sans: ['e4', 'e5', 'Nf3', 'Nc6'], user: 'w', level: 1, ann: { 0: 'best', 2: 'best' }, notes: { 0: { side: 'u', cls: 'best', text: 'This claims space in the center.', ev: 30 }, 1: NOTE_E, 2: { side: 'u', cls: 'best', text: 'This develops your knight.', ev: 30 }, 3: NOTE_E }, tags: {}, fb: { cls: 'best', sym: '!', title: 'Best move', mv: 'You played Nf3', text: 'This develops your knight.' }, opp: { san: 'Nc6', why: NOTE_E.why }, evalW: 30, flipped: false, recorded: false, goal: null, t: NOW - 60000 };
// 1. e4 e5 2. Bc4 Nc6 3. Qh5 Nf6: White mates with Qxf7.
const GAME_MATE1 = { sans: ['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6'], user: 'w', level: 1, ann: {}, notes: {}, tags: {}, fb: null, opp: null, evalW: 0, flipped: false, recorded: false, goal: null, t: NOW - 60000 };

function seedFn([pk, p, gk, g, tk, tab, ck, coach]) {
  if (sessionStorage.getItem('seeded')) return;
  localStorage.setItem(pk, JSON.stringify(p));
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
  if (process.env.S2B_TIMEOUT) { page.setDefaultTimeout(+process.env.S2B_TIMEOUT); page.setDefaultNavigationTimeout(60000); }
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.goto(URL);
  try { await page.waitForFunction(() => window.__coach && window.Placement); }
  catch (e) { throw new Error('app did not start: ' + e.message.split('\n')[0] + ' | page errors: ' + JSON.stringify(page.errors)); }
  return page;
}
// o: { game, tab, coach ('rani' | 'gaja'), extra (another init script), ctx (context options, e.g. colorScheme) }
const seeded = (vp, p, o) => { o = o || {}; return newPage(vp, { fn: seedFn, arg: [PKEY, p, GKEY, o.game || null, TKEY, o.tab || null, CKEY, o.coach || null] }, o.extra, o.ctx); };
// Same stand-in for the Claude account runtime as s1/s2a (window.claude), so the cloud path runs offline.
function cloudMock(arg) {
  if (sessionStorage.getItem('cloudMockSeeded')) { const c = JSON.parse(sessionStorage.getItem('cloudMock')); window.__cloud = c; arg = Object.assign({}, arg, { hold: false }); }
  else { sessionStorage.setItem('cloudMockSeeded', '1'); window.__cloud = { prof: arg.prof, game: null, sets: [], gets: 0 }; }
  let release; const gate = new Promise((r) => { release = r; }); window.__release = release; if (!arg.hold) release();
  const keep = () => sessionStorage.setItem('cloudMock', JSON.stringify(window.__cloud));
  const doc = (k) => ({
    get: () => gate.then(() => new Promise((res) => setTimeout(() => { window.__cloud.gets++; res({ exists: !!window.__cloud[k], data: () => JSON.parse(JSON.stringify(window.__cloud[k])) }); }, 0))),
    set: (d) => { window.__cloud[k] = JSON.parse(JSON.stringify(d)); window.__cloud.sets.push({ k, at: Date.now() }); keep(); return Promise.resolve(); }
  });
  window.claude = { use: (n) => Promise.resolve(n === 'db' ? { doc: (p) => doc(/profile$/.test(p) ? 'prof' : 'game') } : { id: () => Promise.resolve('u1') }) };
}

const getProf = (page) => page.evaluate(() => window.__coach.getProf());
const st = (page, k) => page.evaluate((key) => window.__coach.st[key], k);
const vis = (page, sel) => page.locator(sel).first().isVisible();
const phone = (vp) => vp.width <= 600;
// Beginner Home has no board: one-column layouts (D38, up to 860px wide) and short screens (D51, height 500px or less).
const oneCol = (vp) => vp.width <= 860 || vp.height <= 500;
const shot = async (page, vp, name) => { if (SHOTS) { await page.waitForTimeout(150); await page.screenshot({ path: path.join(SHOTS, vp.width + '_' + name + '.png') }); } };
const noteText = async (page) => (await page.locator('#raniNote p').innerText()).trim();
async function closeNote(page) { if (await vis(page, '#raniNote')) await page.locator('#raniNote [data-act="notedone"]').click(); }
async function tabsShown(page) { return page.evaluate(() => ['coach', 'path', 'play', 'train', 'progress'].filter((t) => { const b = document.getElementById('tab-' + t); return b && b.offsetParent !== null; })); }
// Plays a puzzle's solution on the board (the player's moves; the app plays the replies).
async function solvePuzzle(page) {
  for (let i = 0; i < 12; i++) {
    await page.waitForFunction(() => { const z = window.__coach.st.pz; return z && (z.done || (!z.wait && !window.__coach.st.busy)); }, null, { timeout: 20000 });
    const z = await page.evaluate(() => { const p = window.__coach.st.pz; return { done: p.done, step: p.step, mv: p.p.sol[p.step] }; });
    if (z.done) return;
    assert.ok(/^[a-h][1-8][a-h][1-8]/.test(z.mv), 'a player move in the solution: ' + z.mv);
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
// What the Beginner Home block says (textContent: the words, before any CSS text-transform).
async function block(page) {
  return page.evaluate(() => {
    const b = document.getElementById('bhome'), q = (s) => b && b.querySelector(s), tx = (s) => { const e = q(s); return e && e.offsetParent !== null ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    const bar = q('.bh-bar');
    return {
      shown: !!b && b.offsetParent !== null, head: tx('.bh-head'), line: tx('.bh-line'), kicker: tx('.bh-kick'), title: tx('.bh-title'),
      button: tx('.bh-go'), second: tx('.bh-alt'), chip: tx('.bh-streak'), chipLabel: q('.bh-streak') ? q('.bh-streak').getAttribute('aria-label') : null,
      bar: bar && bar.offsetParent !== null ? { text: bar.getAttribute('aria-valuetext'), now: +bar.getAttribute('aria-valuenow'), max: +bar.getAttribute('aria-valuemax'), fill: bar.querySelector('i').style.width } : null,
      text: b ? b.innerText : ''
    };
  });
}
// AC9 (L8): no rating number, "~N", rated, accuracy %, eval, notation, Stockfish or engine on Beginner Home.
const JARGON = /stockfish|engine|rated|rating|accuracy|\beval|~\s?\d|\d+\s?%|\b\d{3,4}\b/i;
const SAN = /(^|[^\w×-])([KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8]|O-O)/;
async function noJargon(page, why) {
  const t = (await block(page)).text;
  assert.ok(t.length > 10, why + ': block has text');
  assert.ok(!JARGON.test(t), why + ': jargon on Beginner Home: ' + (t.match(JARGON) || [])[0]);
  assert.ok(!SAN.test(t), why + ': notation on Beginner Home: ' + (t.match(SAN) || [])[0]);
  assert.ok(!/—/.test(t), why + ': no em dash');
}
// AC1 + AC2: Beginner Home shows the block, hides the full Home cards; the board column only hides in one-column layouts.
async function beginnerHome(page, vp, why) {
  assert.equal(await st(page, 'tab'), 'coach', why + ': on Home');
  assert.equal((await block(page)).shown, true, why + ': Beginner Home block shown');
  for (const s of HOME_CARDS) assert.equal(await vis(page, s), false, why + ': ' + s + ' hidden');
  assert.equal(await vis(page, '.boardcol'), !oneCol(vp), why + ': board column ' + (oneCol(vp) ? 'hidden' : 'shown') + ' at ' + vp.width);
  await noJargon(page, why);
}
async function fullHome(page, vp, why, look) {
  assert.equal((await block(page)).shown, false, why + ': Beginner Home block hidden');
  for (const s of HOME_CARDS) assert.equal(await vis(page, s), true, why + ': ' + s + ' shown');
  assert.equal(await vis(page, '.boardcol'), true, why + ': board shown');
}
// AC10: on phones every part of the block, both buttons included, is on the first screen above the fixed nav.
async function fitsFirstScreen(page, vp, why) {
  await page.evaluate(() => window.scrollTo(0, 0));
  const r = await page.evaluate(() => {
    const nav = document.querySelector('.tabs').getBoundingClientRect(), out = [];
    document.querySelectorAll('#bhome .bh-av, #bhome .bh-bub, #bhome .bh-streak, #bhome .bh-card, #bhome .bh-go, #bhome .bh-alt').forEach((e) => {
      if (e.offsetParent === null) return; const b = e.getBoundingClientRect(); out.push({ c: e.className, top: b.top, bottom: b.bottom, left: b.left, right: b.right });
    });
    return { nav: nav.top, items: out, w: window.innerWidth, scrollY: window.scrollY };
  });
  assert.equal(r.scrollY, 0, why + ': first screen');
  assert.ok(r.items.length >= 4, why + ': measured ' + r.items.length);
  for (const it of r.items) {
    assert.ok(it.top >= 0 && it.bottom <= r.nav + 0.5, why + ': ' + it.c + ' above the nav (' + Math.round(it.bottom) + ' vs ' + Math.round(r.nav) + ')');
    assert.ok(it.left >= 0 && it.right <= r.w + 0.5, why + ': ' + it.c + ' inside the screen');
  }
}
// AC10: sizes and the one primary action.
async function layoutRules(page, vp, why) {
  const m = await page.evaluate(() => {
    const b = document.getElementById('bhome'), q = (s) => b.querySelector(s), box = (s) => q(s) ? q(s).getBoundingClientRect() : null, cs = (s) => getComputedStyle(q(s));
    const av = q('.bh-av').firstElementChild.getBoundingClientRect();
    const prim = Array.from(document.querySelectorAll('.btn.primary')).filter((e) => e.offsetParent !== null).length; // F-D28: counted on the whole screen, the board column included
    return { av: [av.width, av.height], head: [parseFloat(cs('.bh-head').fontSize), cs('.bh-head').fontWeight], lineColor: cs('.bh-line').color, muted: getComputedStyle(document.documentElement).getPropertyValue('--muted').trim(),
      radius: parseFloat(cs('.bh-card').borderTopLeftRadius), go: box('.bh-go'), alt: box('.bh-alt'), card: box('.bh-card'), blockW: b.getBoundingClientRect().width, prim,
      goPrimary: q('.bh-go').classList.contains('primary') && q('.bh-go').classList.contains('big'), altPrimary: q('.bh-alt') ? q('.bh-alt').classList.contains('primary') : false };
  });
  if (phone(vp)) assert.ok(m.av[0] >= 96 && m.av[0] <= 120 && m.av[1] >= 96 && m.av[1] <= 120, why + ': avatar 96 to 120px: ' + m.av);
  assert.ok(m.head[0] >= 16 && m.head[0] <= 18 && +m.head[1] === 600, why + ': headline 16 to 18px, 600: ' + m.head);
  assert.ok(m.radius >= 12 && m.radius <= 16, why + ': card radius ' + m.radius);
  assert.equal(m.prim, 1, why + ': exactly one primary button on Home');
  assert.equal(m.goPrimary, true, why + ': the card button is .primary.big');
  assert.ok(m.go.height >= 48, why + ': primary 48px: ' + m.go.height);
  if (phone(vp)) assert.ok(Math.abs(m.go.width - (m.card.width - 2 * 16)) <= 18 || m.go.width >= m.card.width - 40, why + ': primary full width: ' + m.go.width + ' of ' + m.card.width);
  if (m.alt) {
    assert.equal(m.altPrimary, false, why + ': second button is an outline button');
    assert.ok(m.alt.height >= 48, why + ': second button 48px: ' + m.alt.height);
    if (phone(vp)) assert.ok(m.alt.width >= m.blockW - 1, why + ': second button full width');
  }
}

const cases = [
  ['S2b-1: new Beginner Home: no board on phones, Rani’s first line, Lesson 1 of 7, Start lesson, Just play a game, no chip, one screen', async (vp) => {
    const page = await seeded(vp, prof());
    await beginnerHome(page, vp, 'new Beginner');
    const b = await block(page);
    assert.equal(b.head, 'Today you’ll learn how the pieces move.');
    assert.equal(b.line, 'Each piece has its own way. I’ll show you every one.');
    assert.equal(b.kicker, 'Lesson 1 of 7'); assert.equal(b.title, 'How the pieces move');
    assert.deepEqual(b.bar, { text: '0 of 7 lessons done', now: 0, max: 7, fill: '0%' });
    assert.equal(b.button, 'Start lesson'); assert.equal(b.second, 'Just play a game');
    assert.equal(b.chip, null, 'no streak chip at 0 days');
    assert.deepEqual(await tabsShown(page), ['coach', 'path', 'play']);
    assert.equal(await page.locator('#bhome .bh-ic').getAttribute('aria-hidden'), 'true', 'card icon is decorative');
    assert.equal(await page.locator('#bhome .bh-av').count(), 1);
    if (phone(vp)) {
      const nav = await page.locator('.tabs').boundingBox();
      assert.ok(Math.abs(nav.y + nav.height - vp.height) <= 1, 'nav fixed at the bottom');
      await fitsFirstScreen(page, vp, 'S2b-1');
    }
    await layoutRules(page, vp, 'S2b-1');
    await shot(page, vp, 'beginner_home_new');
    await page.locator('#bhome .bh-go').click();
    assert.equal(await st(page, 'mode'), 'lesson'); assert.equal(await page.evaluate(() => window.__coach.st.ls.unit.id), 'rules');
    assert.equal(await st(page, 'tab'), 'path'); assert.equal(await st(page, 'unitOpen'), 'rules');
    assert.equal(await vis(page, '.boardcol'), true, 'the board is back for the lesson');
    return page;
  }],
  ['S2b-2: mid-lesson with a 2 day streak: Now let’s practise., Lesson 4 of 7, bar 3 of 7, Continue opens the practice', async (vp) => {
    const page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board'), { values: { learn: NOW - DAY } }), days: played(0, 1) }));
    await beginnerHome(page, vp, 'mid-lesson');
    const b = await block(page);
    assert.equal(b.head, 'Now let’s practise.'); assert.equal(b.line, 'A few quick ones on the board.');
    assert.equal(b.kicker, 'Lesson 4 of 7'); assert.equal(b.title, 'Piece values and free pieces');
    assert.deepEqual(b.bar, { text: '3 of 7 lessons done', now: 3, max: 7, fill: Math.round(300 / 7) + '%' });
    assert.equal(b.button, 'Continue'); assert.equal(b.second, 'Just play a game');
    assert.equal(b.chip, '2 days'); assert.equal(b.chipLabel, 'Streak: 2 days');
    assert.equal(await page.locator('#bhome .bh-streak svg').getAttribute('aria-hidden'), 'true', 'flame is decorative');
    if (phone(vp)) await fitsFirstScreen(page, vp, 'S2b-2');
    await layoutRules(page, vp, 'S2b-2');
    await shot(page, vp, 'beginner_home_midlesson_streak');
    await page.locator('#bhome .bh-go').click();
    const ses = await page.evaluate(() => { const s = window.__coach.st.ses; return s && { unit: s.unit, part: s.part, kind: s.kind }; });
    assert.deepEqual(ses, { unit: 'values', part: 'practice', kind: 'puzzles' }, 'Continue opens the practice');
    assert.equal(await st(page, 'unitOpen'), 'values');
    return page;
  }],
  ['S2b-3: Karthik (start Board and notation, finished it, 1 day): Lesson 2 of 5, Piece values and free pieces', async (vp) => {
    const page = await seeded(vp, prof({ start: 'board', course: done('board'), days: played(0) }));
    await beginnerHome(page, vp, 'Karthik');
    const b = await block(page);
    assert.equal(b.kicker, 'Lesson 2 of 5'); assert.equal(b.title, 'Piece values and free pieces');
    assert.deepEqual(b.bar, { text: '1 of 5 lessons done', now: 1, max: 5, fill: '20%' });
    assert.equal(b.head, 'Today: what each piece is worth.'); assert.equal(b.line, 'Then you’ll spot free pieces and keep yours safe.');
    assert.equal(b.button, 'Start lesson'); assert.equal(b.chip, '1 day'); assert.equal(b.chipLabel, 'Streak: 1 day');
    await shot(page, vp, 'beginner_home_karthik');
    return page;
  }],
  ['S2b-4 / D44: Back to my game opens the unfinished game on Play, nothing abandoned; Just play a game starts a partner game', async (vp) => {
    let page = await seeded(vp, prof({ course: done('rules') }), { game: GAME_OPEN, tab: 'coach' });
    await beginnerHome(page, vp, 'unfinished game');
    let b = await block(page);
    assert.equal(b.second, 'Back to my game'); assert.equal(b.button, 'Start lesson', 'the card stays on the next lesson');
    if (phone(vp)) await fitsFirstScreen(page, vp, 'S2b-4');
    await shot(page, vp, 'beginner_home_back_to_game');
    const before = await page.evaluate(() => window.__coach.hist());
    await page.locator('#bhome .bh-alt').click();
    assert.equal(await st(page, 'tab'), 'play'); assert.equal(await st(page, 'mode'), 'play');
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), before, 'the same game');
    assert.equal(await vis(page, '#newConfirm'), false, 'no "tap again" warning');
    assert.equal(await vis(page, '#board'), true, 'the game is on the board');
    assert.equal(await page.locator('#modeText').innerText(), 'Your game vs ' + PARTNER + ', you play White');
    await page.context().close();
    page = await seeded(vp, prof({ course: done('rules') }));
    b = await block(page);
    assert.equal(b.second, 'Just play a game');
    await page.evaluate(() => { document.getElementById('levelSel').value = '5'; });
    await page.locator('#bhome .bh-alt').click();
    assert.equal(await st(page, 'tab'), 'play'); assert.equal(await st(page, 'mode'), 'play');
    assert.equal(await st(page, 'level'), 1, 'Rani’s practice partner (Beginner bot)');
    assert.equal(await page.locator('#oppName').innerText(), PARTNER);
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), [], 'a new game');
    return page;
  }],
  ['S2b-5 / D47: Foundations done, partner not beaten: Next step, Beat Rani’s practice partner, Play now, no second button', async (vp) => {
    let page = await seeded(vp, prof({ levelT: NOW - DAY, levelOfferT: NOW - DAY, course: done(...FOUND) }));
    await beginnerHome(page, vp, 'beat');
    let b = await block(page);
    assert.equal(b.head, 'You finished every Foundations lesson!'); assert.equal(b.line, 'Now beat my practice partner.');
    assert.equal(b.kicker, 'Next step'); assert.equal(b.title, 'Beat Rani’s practice partner'); assert.equal(b.bar, null, 'no bar');
    assert.equal(b.button, 'Play now'); assert.equal(b.second, null, 'no second button');
    await layoutRules(page, vp, 'S2b-5');
    if (phone(vp)) await fitsFirstScreen(page, vp, 'S2b-5');
    await shot(page, vp, 'beginner_home_beat_partner');
    await page.locator('#bhome .bh-go').click();
    assert.equal(await st(page, 'tab'), 'play'); assert.equal(await st(page, 'level'), 1, 'a game vs Rani’s practice partner');
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), []);
    await page.context().close();
    page = await seeded(vp, prof({ levelT: NOW - DAY, levelOfferT: NOW - DAY, course: done(...FOUND) }), { game: GAME_OPEN });
    b = await block(page);
    assert.equal(b.button, 'Back to my game'); assert.equal(b.second, null);
    const before = await page.evaluate(() => window.__coach.hist());
    await page.locator('#bhome .bh-go').click();
    assert.equal(await st(page, 'tab'), 'play'); assert.deepEqual(await page.evaluate(() => window.__coach.hist()), before, 'the unfinished game opens');
    return page;
  }],
  ['S2b-6 / D39: partner beaten, Not yet: Practice, Puzzles at your level, Start 10 puzzles; Forks open in Learn; 7 days later Yes = Improver Home', async (vp) => {
    let page = await seeded(vp, prof({ start: 'rules', levelT: NOW - 30 * DAY, levelOfferT: NOW - DAY, course: done(...FOUND), games: [WIN1] }));
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'Not yet was said a day ago');
    await beginnerHome(page, vp, 'keep practising');
    const b = await block(page);
    assert.equal(b.head, 'You know the basics now.'); assert.equal(b.line, 'Keep practising, or move up to Improver any time in Settings.');
    assert.equal(b.kicker, 'Practice'); assert.equal(b.title, 'Puzzles at your level'); assert.equal(b.bar, null);
    assert.equal(b.button, 'Start 10 puzzles'); assert.equal(b.second, 'Just play a game');
    assert.ok(!/Forks|Tactics/.test(b.text), 'Home never points at Tactics');
    await layoutRules(page, vp, 'S2b-6');
    if (phone(vp)) await fitsFirstScreen(page, vp, 'S2b-6');
    await shot(page, vp, 'beginner_home_keep_practising');
    await page.locator('#bhome .bh-go').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'puzzle');
    assert.equal(await page.evaluate(() => window.__coach.st.ses.rated), true, 'puzzles at their level');
    assert.equal(await page.evaluate(() => window.__coach.st.ses.title), 'Puzzles at your level');
    assert.equal(await st(page, 'tab'), 'train');
    await page.locator('#tab-path').click();
    if (await vis(page, '#unitView')) await page.locator('#unitView [data-act="units"]').click();
    assert.equal(await page.locator('#levels [data-unit="fork"]').count(), 1, 'Forks still open in Learn');
    // A week later the offer comes back at app start; Yes gives the Improver Home.
    await page.evaluate(([k]) => { const x = JSON.parse(localStorage.getItem(k)); x.levelOfferT = Date.now() - 8 * 86400000; localStorage.setItem(k, JSON.stringify(x)); localStorage.setItem('suresh-chess-coach.tab', '"coach"'); }, [PKEY]);
    await page.reload(); await page.waitForFunction(() => window.__coach);
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), OFFER_B);
    if (phone(vp)) {
      const n = await page.locator('#raniNote').boundingBox(), t = await page.locator('.tabs').boundingBox();
      assert.ok(n.y + n.height <= t.y + 0.5, 'the offer sits above the nav');
    }
    await shot(page, vp, 'beginner_home_levelup_offer');
    await page.locator('#raniNote [data-act="offeryes"]').click();
    await closeNote(page);
    assert.equal((await getProf(page)).level, 'improver');
    await page.locator('#tab-coach').click();
    await fullHome(page, vp, 'Improver after Yes');
    // F1 (F-D10): the Next step is on the Continue card
    assert.equal((await page.locator('#contCard .bh-title').innerText()).trim(), 'Forks');
    assert.equal(await page.evaluate(() => window.__coach.nextLabel()), 'Learn: Forks');
    return page;
  }],
  ['S2b-7 / D40: Show everything shows the full Home with the board; off brings Rani’s Home back, no reload', async (vp) => {
    const page = await seeded(vp, prof({ course: done('rules') }));
    await beginnerHome(page, vp, 'before');
    await page.locator('#settingsBtn').click();
    await page.locator('#levelCard [data-act="showall"]').click();
    await page.keyboard.press('Escape');
    await fullHome(page, vp, 'Show everything');
    const hero = await page.locator('#stageHero').innerText();
    assert.ok(/Stage 1 of 6/i.test(hero), 'full Home at the Beginner’s stage: ' + hero);
    // F1 (F-D10): the Next step is on the Continue card
    assert.equal((await page.locator('#contCard .bh-title').innerText()).trim(), 'Special rules and draws');
    assert.equal(await page.evaluate(() => window.__coach.nextLabel()), 'Learn: Special rules and draws');
    assert.ok(/Rating band/.test(hero), 'like an Improver at her stage: scores shown');
    assert.ok((await page.locator('#today h3').innerText()).length > 0);
    await shot(page, vp, 'beginner_showall_full_home');
    await page.locator('#settingsBtn').click();
    await page.locator('#levelCard [data-act="showall"]').click();
    await page.keyboard.press('Escape');
    await beginnerHome(page, vp, 'Show everything off');
    assert.equal((await block(page)).kicker, 'Lesson 2 of 7');
    assert.equal(await page.evaluate(() => performance.getEntriesByType('navigation').length), 1, 'no reload');
    return page;
  }],
  ['S2b-8 / AC12 / L9: a v4 Beginner (rating 700, How the pieces move done) gets Lesson 2 of 7 / Special rules and draws', async (vp) => {
    const v4 = { v: 4, theme: null, games: [{ id: 'g1', d: 1700000000000, r: 'L', user: 'w', level: 2, sans: ['e4', 'e5'], ann: {} }], puz: {}, rating: 700, rn: 0, course: { rules: { learn: 1, practice: 1 } }, days: {}, reviewed: [], t: 1700000000000 };
    let page = await seeded(vp, v4);
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), 'You’re set as Beginner. Change it any time in Settings.');
    await closeNote(page);
    const pr = await getProf(page);
    assert.equal(pr.level, 'beginner'); assert.equal(pr.placed, 'derived'); assert.equal(pr.unlockAll, true); assert.equal(pr.start, 'rules');
    await beginnerHome(page, vp, 'v4 Beginner');
    let b = await block(page);
    assert.equal(b.kicker, 'Lesson 2 of 7'); assert.equal(b.title, 'Special rules and draws');
    assert.equal(b.head, 'Today: castling and other special moves.'); assert.equal(b.line, 'And the ways a game can end in a draw.');
    assert.deepEqual(await tabsShown(page), ['coach', 'path', 'play', 'train', 'progress'], 'all tabs stay open');
    await page.context().close();
    // A derived v5 Beginner (unlockAll) gets the same Home.
    page = await seeded(vp, prof({ placed: 'derived', unlockAll: true, levelT: 0, course: { rules: { learn: 1, practice: 1 } } }));
    await beginnerHome(page, vp, 'derived v5 Beginner');
    b = await block(page);
    assert.equal(b.kicker, 'Lesson 2 of 7'); assert.equal(b.title, 'Special rules and draws');
    await page.context().close();
    // v4 rating 950 and 1350: the Improver and Club Home are exactly as before S2b.
    for (const [r, key, lvl] of [[950, 'v4improver', 'improver'], [1350, 'v4club', 'club']]) {
      page = await seeded(vp, Object.assign({}, v4, { rating: r }));
      assert.equal((await getProf(page)).level, lvl);
      await page.locator('#tab-coach').click();
      assert.equal(await homeText(page), beforeText(vp.width + ':' + key), key + ' Home text unchanged');
      await fullHome(page, vp, key);
      if (r === 1350) return page;
      await page.context().close();
    }
  }],
  ['S2b-9 / D41: Settings "Coach and pieces" for Beginner and Club; changes show at once; keyboard, focus trap and scroll', async (vp) => {
    let page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate'), { opening: { learn: NOW - DAY } }) }));
    let b = await block(page);
    assert.equal(b.head, 'Now try it in a real game.'); assert.equal(b.line, 'You’ll play my practice partner.');
    await page.locator('#settingsBtn').click();
    let sheet = page.locator('#settingsSheet');
    await sheet.waitFor({ state: 'visible' });
    assert.ok((await sheet.innerText()).includes('Coach and pieces'), 'section heading');
    assert.equal(await sheet.locator('[data-coach]').count(), 2, 'Queen Rani and Coach Gaja');
    assert.ok((await sheet.locator('[data-set]').count()) >= 2, 'piece sets');
    const dup = await page.evaluate(() => { const ids = Array.from(document.querySelectorAll('[id]')).map((e) => e.id); return ids.filter((x, i) => ids.indexOf(x) !== i); });
    assert.deepEqual(dup, [], 'no duplicate ids');
    await shot(page, vp, 'settings_look_beginner');
    // Keyboard: Tab from the Show everything switch reaches the coach buttons; Enter picks Gaja; focus stays on it.
    await page.locator('#levelCard [data-act="showall"]').focus();
    let reached = false;
    for (let i = 0; i < 4 && !reached; i++) { await page.keyboard.press('Tab'); reached = await page.evaluate(() => document.activeElement && document.activeElement.dataset.coach === 'rani'); }
    assert.ok(reached, 'Tab reaches the coach buttons');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.coach), 'gaja');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => window.Coach3D.get()), 'gaja');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.coach), 'gaja', 'focus stays on the picked coach');
    assert.equal(await sheet.locator('[data-coach="gaja"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate(() => document.activeElement.matches(':focus-visible') && getComputedStyle(document.activeElement).outlineWidth), '3px', 'focus outline');
    b = await block(page);
    assert.equal(b.line, 'You’ll play Rani’s practice partner.', 'D48 at once');
    assert.equal(await page.locator('#bhome .bh-av svg.gaja').count(), 1, 'Gaja on Beginner Home at once');
    // Focus trap: Shift+Tab from the first control wraps to the last, which is a piece set in the new section.
    await page.locator('#settingsSheet .pl-x').focus();
    await page.keyboard.press('Shift+Tab');
    assert.equal(await page.evaluate(() => !!(document.activeElement.dataset.set && document.activeElement.closest('#lookSet'))), true, 'the trap includes the new buttons');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.dataset.act), 'settingsclose', 'and wraps back');
    // A piece set: the board and the sheet update at once.
    const setId = await sheet.locator('[data-set]:not(.on)').first().getAttribute('data-set');
    await sheet.locator('[data-set="' + setId + '"]').click();
    assert.equal(await st(page, 'theme'), setId);
    assert.equal(await sheet.locator('[data-set="' + setId + '"]').getAttribute('aria-pressed'), 'true');
    assert.equal(await page.evaluate((s) => document.activeElement && document.activeElement.dataset.set, setId), setId, 'focus stays on the picked set');
    // The sheet scrolls on a small phone so every set is reachable.
    const sc = await page.evaluate(() => { const p = document.querySelector('#settingsSheet .sheet-panel'); return { sh: p.scrollHeight, ch: p.clientHeight, oy: getComputedStyle(p).overflowY }; });
    if (vp.width === 360) assert.ok(sc.sh > sc.ch && sc.oy === 'auto', 'sheet scrolls: ' + JSON.stringify(sc));
    const last = sheet.locator('[data-set]').last();
    await last.scrollIntoViewIfNeeded(); assert.equal(await last.isVisible(), true);
    await page.keyboard.press('Escape');
    await sheet.waitFor({ state: 'hidden' });
    await page.context().close();
    // Club: the same section; Home keeps its card and follows the sheet at once.
    page = await seeded(vp, prof({ level: 'club', start: 'kq', rating: 1300 }));
    assert.equal(await vis(page, '#lookCard'), true, 'Club Home keeps Coach and pieces');
    sheet = page.locator('#settingsSheet');
    await page.locator('#settingsBtn').click();
    await sheet.waitFor({ state: 'visible' });
    assert.ok((await sheet.innerText()).includes('Coach and pieces'));
    await shot(page, vp, 'settings_look_club');
    await sheet.locator('[data-coach="gaja"]').click();
    assert.equal(await page.locator('#lookCard [data-coach="gaja"]').getAttribute('aria-pressed'), 'true', 'Home’s card follows at once');
    assert.equal(await page.locator('#stageHero svg.gaja').count(), 1, 'the hero shows Gaja at once');
    return page;
  }],
  ['S2b-10: desktop keeps the board left and puts Rani’s Home on the right', async (vp) => {
    const page = await seeded(vp, prof());
    if (oneCol(vp)) { assert.equal(await vis(page, '.boardcol'), false); return page; }
    await beginnerHome(page, vp, 'desktop');
    const board = await page.locator('.boardcol').boundingBox(), home = await page.locator('#bhome').boundingBox();
    assert.ok(home.x >= board.x + board.width, 'Home is right of the board: ' + JSON.stringify([board, home]));
    await layoutRules(page, vp, 'desktop');
    return page;
  }],
  ['S2b-11 / AC11: Improver and Club Home text is identical to before S2b', async (vp) => {
    let page;
    for (const [key, p] of [['improver', prof({ level: 'improver', start: 'fork', rating: 1000 })], ['club', prof({ level: 'club', start: 'kq', rating: 1300 })]]) {
      page = await seeded(vp, p);
      assert.equal(await homeText(page), beforeText(vp.width + ':' + key), key + ' Home text unchanged');
      await fullHome(page, vp, key);
      await shot(page, vp, key + '_home');
      if (key === 'club') return page;
      await page.context().close();
    }
  }],
  ['S2b-12: Improver to Beginner in Settings switches to Rani’s Home at once, and back', async (vp) => {
    const page = await seeded(vp, prof({ level: 'improver', start: 'fork', rating: 1000, course: done('rules') }));
    await fullHome(page, vp, 'Improver');
    await page.locator('#settingsBtn').click();
    await page.locator('#levelCard [data-lvset="beginner"]').click();
    await page.keyboard.press('Escape');
    await beginnerHome(page, vp, 'now Beginner');
    assert.equal((await block(page)).kicker, 'Lesson 2 of 7', 'Beginner from Settings counts from How the pieces move');
    await page.locator('#settingsBtn').click();
    await page.locator('#levelCard [data-lvset="improver"]').click();
    await page.keyboard.press('Escape');
    await fullHome(page, vp, 'Improver again');
    return page;
  }],
  ['AC1 / D38: the board hides only on Beginner Home; Play and Learn show it; a game, lesson and session are untouched', async (vp) => {
    const page = await seeded(vp, prof({ course: done('rules', 'special', 'board') }), { game: GAME_OPEN });
    const saved = await page.evaluate((k) => localStorage.getItem(k), GKEY), hist = await page.evaluate(() => window.__coach.hist());
    await beginnerHome(page, vp, 'Home');
    for (const t of ['play', 'path', 'coach', 'play', 'coach']) {
      await page.locator('#tab-' + t).click();
      assert.equal(await vis(page, '.boardcol'), t !== 'coach' || !oneCol(vp), t + ': board ' + (t === 'coach' && oneCol(vp) ? 'hidden' : 'shown'));
      if (t !== 'coach') assert.equal(await vis(page, '#modebar'), true, t + ': mode bar shown');
    }
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), hist, 'game kept');
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), GKEY), saved, 'nothing saved over the game');
    assert.equal(await st(page, 'mode'), 'play');
    // A lesson: Home and back keeps the step.
    await page.evaluate(() => window.__coach.startPart('values', 'learn'));
    await page.locator('#navNext').click();
    await page.locator('#tab-coach').click();
    assert.equal(await vis(page, '.boardcol'), !oneCol(vp));
    assert.equal(await st(page, 'mode'), 'lesson'); assert.equal(await page.evaluate(() => window.__coach.st.ls.i), 1, 'lesson step kept');
    await page.locator('#tab-path').click();
    assert.equal(await page.evaluate(() => window.__coach.st.ls.i), 1);
    assert.ok(/step 2 of/i.test(await page.locator('#unitView .lessoncard').innerText()), 'still on step 2');
    // A puzzle session (Train is open after 3 lessons): Home and back keeps the item.
    await page.evaluate(() => window.__coach.trainStart('rated'));
    await page.waitForFunction(() => window.__coach.st.mode === 'puzzle');
    const item = await page.evaluate(() => window.__coach.st.ses.items[0].id);
    await page.locator('#tab-coach').click();
    assert.equal(await vis(page, '.boardcol'), !oneCol(vp));
    await page.locator('#tab-train').click();
    assert.equal(await st(page, 'mode'), 'puzzle'); assert.equal(await page.evaluate(() => window.__coach.st.ses.items[0].id), item, 'same session');
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), hist, 'game still kept');
    return page;
  }],
  ['AC8: Home re-renders on a lesson part, a game ending (on Home at desktop), and a cloud merge', async (vp) => {
    // Finishing a lesson part, then coming back to Home.
    let page = await seeded(vp, prof());
    await page.locator('#bhome .bh-go').click();
    await finishLesson(page);
    await page.locator('#tab-coach').click();
    let b = await block(page);
    assert.equal(b.head, 'Now let’s practise.'); assert.equal(b.button, 'Continue'); assert.equal(b.chip, '1 day', 'the lesson counts for the streak');
    await page.context().close();
    // A game ending: Beat state, mate in one. On desktop the board plays next to Home; on phones via Play.
    page = await seeded(vp, prof({ levelT: NOW - DAY, levelOfferT: NOW - DAY, course: done(...FOUND) }), { game: GAME_MATE1, tab: 'coach' });
    b = await block(page);
    assert.equal(b.title, 'Beat Rani’s practice partner'); assert.equal(b.button, 'Back to my game');
    if (oneCol(vp)) await page.locator('#tab-play').click();
    await page.waitForFunction(() => !window.__coach.st.busy);
    await page.locator('#board .sq[data-sq="h5"]').click();
    await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => window.__coach.getProf().games.length === 1, null, { timeout: 20000 });
    if (oneCol(vp)) await page.locator('#tab-coach').click();
    await page.waitForFunction(() => document.querySelector('#bhome .bh-title') && document.querySelector('#bhome .bh-title').textContent === 'Puzzles at your level');
    b = await block(page);
    assert.equal(b.kicker, 'Practice'); assert.equal(b.second, 'Just play a game', 'the game is over: no "Back to my game"');
    await page.context().close();
    // A cloud merge brings a finished lesson: Home moves on without a reload.
    const local = prof();
    page = await seeded(vp, local, { extra: { fn: cloudMock, arg: { prof: Object.assign({}, local, { course: done('rules', 'special'), t: NOW }), hold: true } } });
    assert.equal((await block(page)).kicker, 'Lesson 1 of 7');
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => document.querySelector('#bhome .bh-kick').textContent === 'Lesson 3 of 7');
    assert.equal((await block(page)).title, 'Board and notation');
    return page;
  }],
  ['AC10: dark mode, focus outline and reduced motion on Beginner Home', async (vp) => {
    const page = await seeded(vp, prof({ course: done('rules'), days: played(0, 1, 2) }), { ctx: { colorScheme: 'dark', reducedMotion: 'reduce' } });
    await beginnerHome(page, vp, 'dark');
    const c = await page.evaluate(() => { const g = (s, p) => getComputedStyle(document.querySelector(s))[p]; return { bg: g('body', 'backgroundColor'), card: g('#bhome .bh-card', 'backgroundColor'), head: g('#bhome .bh-head', 'color'), chip: g('#bhome .bh-streak', 'color'), chipBg: g('#bhome .bh-streak', 'backgroundColor') }; });
    assert.equal(c.bg, 'rgb(18, 23, 20)', 'dark page'); assert.equal(c.card, 'rgb(26, 33, 30)', 'dark card');
    assert.equal(c.head, 'rgb(228, 235, 231)', 'light ink');
    const lum = (rgb) => { const v = rgb.match(/\d+/g).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    assert.ok(ratio(c.chip, c.chipBg) >= 4.5, 'streak chip contrast in dark mode: ' + ratio(c.chip, c.chipBg).toFixed(2));
    await shot(page, vp, 'beginner_home_dark');
    // Keyboard focus shows the 3px outline on both buttons.
    await page.locator('#tab-coach').focus();
    for (let i = 0; i < 8 && !(await page.evaluate(() => document.activeElement.classList.contains('bh-go'))); i++) await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => getComputedStyle(document.activeElement).outlineWidth), '3px', 'primary focus outline');
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement.classList.contains('bh-alt') && getComputedStyle(document.activeElement).outlineWidth), '3px', 'second button focus outline');
    const anim = await page.evaluate(() => Array.from(document.querySelectorAll('#bhome, #bhome *')).some((e) => { const s = getComputedStyle(e); return (s.animationName !== 'none' && parseFloat(s.animationDuration) > 0) || parseFloat(s.transitionDuration) > 0; }));
    assert.equal(anim, false, 'nothing moves under reduced motion');
    return page;
  }],
  ['AC10: light mode chip contrast and the Gaja coach on Beginner Home', async (vp) => {
    const page = await seeded(vp, prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate'), { opening: { learn: NOW - DAY } }), days: played(0, 1, 2) }), { coach: 'gaja' });
    const b = await block(page);
    assert.equal(b.line, 'You’ll play Rani’s practice partner.', 'D48');
    assert.equal(b.chip, '3 days');
    assert.equal(await page.locator('#bhome .bh-av svg.gaja').count(), 1, 'Gaja shows');
    const c = await page.evaluate(() => { const e = document.querySelector('#bhome .bh-streak'), s = getComputedStyle(e); return [s.color, s.backgroundColor]; });
    const lum = (rgb) => { const v = rgb.match(/\d+/g).slice(0, 3).map((x) => { x /= 255; return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4); }); return 0.2126 * v[0] + 0.7152 * v[1] + 0.0722 * v[2]; };
    const r = (Math.max(lum(c[0]), lum(c[1])) + 0.05) / (Math.min(lum(c[0]), lum(c[1])) + 0.05);
    assert.ok(r >= 4.5, 'streak chip contrast: ' + r.toFixed(2));
    if (phone(vp)) await fitsFirstScreen(page, vp, 'Gaja');
    await layoutRules(page, vp, 'Gaja');
    await shot(page, vp, 'beginner_home_gaja');
    return page;
  }],
  ['S2b-13 / D49: with a game going, Continue on a lesson game asks first; Back to my game, Start the lesson game, Esc keeps the game', async (vp) => {
    const p = prof({ course: Object.assign(done('rules', 'special', 'board', 'values', 'mate'), { opening: { learn: NOW - DAY } }) });
    let page = await seeded(vp, p, { game: GAME_OPEN });
    let b = await block(page);
    assert.equal(b.head, 'Now try it in a real game.'); assert.equal(b.button, 'Continue'); assert.equal(b.second, 'Back to my game');
    const hist = await page.evaluate(() => window.__coach.hist()), keep = await page.evaluate(([g, k]) => [localStorage.getItem(g), localStorage.getItem(k)], [GKEY, PKEY]);
    const ask = async () => {
      await page.locator('#bhome .bh-go').click();
      await page.waitForSelector('#raniNote:not([hidden])');
      assert.equal(await noteText(page), ASK);
      assert.equal(await st(page, 'goal'), null, 'no lesson game started yet');
      assert.deepEqual(await page.evaluate(() => window.__coach.hist()), hist, 'the old game is still there');
    };
    await ask();
    assert.equal((await page.locator('#raniNote [data-act="askback"]').innerText()).trim(), 'Back to my game');
    assert.equal((await page.locator('#raniNote [data-act="askgo"]').innerText()).trim(), 'Start the lesson game');
    await page.waitForFunction(() => document.activeElement && document.activeElement.dataset.act === 'askback');
    if (phone(vp)) {
      const n = await page.locator('#raniNote').boundingBox(), t = await page.locator('.tabs').boundingBox();
      assert.ok(n.y + n.height <= t.y + 0.5, 'the question sits above the nav');
    }
    await shot(page, vp, 'beginner_home_ask_first');
    // Esc: the question closes, the old game stays, nothing is saved.
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'Esc closes the question');
    assert.equal(await st(page, 'tab'), 'coach'); assert.equal(await st(page, 'mode'), 'play');
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), hist);
    assert.deepEqual(await page.evaluate(([g, k]) => [localStorage.getItem(g), localStorage.getItem(k)], [GKEY, PKEY]), keep, 'nothing saved');
    // Back to my game: the old game on Play.
    await ask();
    await page.locator('#raniNote [data-act="askback"]').click();
    assert.equal(await page.locator('#raniNote').isHidden(), true);
    assert.equal(await st(page, 'tab'), 'play'); assert.deepEqual(await page.evaluate(() => window.__coach.hist()), hist, 'the old game opens');
    assert.equal(await st(page, 'goal'), null);
    // Start the lesson game: as Continue does with no game going.
    await page.locator('#tab-coach').click();
    await ask();
    await page.locator('#raniNote [data-act="askgo"]').click();
    assert.equal(await page.locator('#raniNote').isHidden(), true);
    assert.equal(await st(page, 'tab'), 'play');
    assert.equal(await page.evaluate(() => window.__coach.st.goal && window.__coach.st.goal.unit), 'opening', 'the lesson game starts');
    assert.ok((await page.evaluate(() => window.__coach.hist())).length <= 1, 'a new game (the partner may already have moved)');
    assert.equal(await st(page, 'unitOpen'), 'opening');
    await page.context().close();
    // No game going: Continue starts the lesson game at once.
    page = await seeded(vp, p);
    await page.locator('#bhome .bh-go').click();
    assert.equal(await page.evaluate(() => window.__coach.st.goal && window.__coach.st.goal.unit), 'opening');
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'no question without a game going');
    await page.context().close();
    // Learn's Start button does not change (D49).
    page = await seeded(vp, p, { game: GAME_OPEN });
    await page.locator('#tab-path').click();
    await page.locator('#levels [data-unit="opening"]').click();
    await page.locator('#unitView [data-part="apply"]').click();
    assert.equal(await page.evaluate(() => window.__coach.st.goal && window.__coach.st.goal.unit), 'opening', 'Learn starts the game task directly');
    assert.equal(await page.locator('#raniNote').isHidden(), true);
    return page;
  }],
  ['S2b-4b / D50: Back to my game ends an open puzzle set; the puzzles already answered are kept', async (vp) => {
    const page = await seeded(vp, prof({ course: done('rules', 'special', 'board') }), { game: GAME_OPEN });
    const hist = await page.evaluate(() => window.__coach.hist());
    await page.evaluate(() => window.__coach.trainStart('rated'));
    await page.waitForFunction(() => window.__coach.st.mode === 'puzzle');
    const id = await page.evaluate(() => window.__coach.st.ses.items[0].id);
    await solvePuzzle(page);
    assert.equal((await getProf(page)).puz[id].n, 1, 'the answer is recorded');
    await page.locator('#tab-coach').click();
    assert.equal((await block(page)).second, 'Back to my game');
    await page.locator('#bhome .bh-alt').click();
    assert.equal(await st(page, 'tab'), 'play'); assert.equal(await st(page, 'mode'), 'play');
    assert.equal(await st(page, 'ses'), null, 'the puzzle set ended');
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), hist, 'the old game is on the board');
    assert.equal((await getProf(page)).puz[id].n, 1, 'answered puzzle kept');
    assert.equal(await page.evaluate(([k, i]) => JSON.parse(localStorage.getItem(k)).puz[i].n, [PKEY, id]), 1, 'and saved');
    return page;
  }],
  ['S2b-14 / D51: a sideways phone (915x412, 844x390) has no board on Beginner Home, one centred column, Continue on the first screen; tablets and desktop as D38', async (vp) => {
    if (vp.width !== 915) return newPage(vp); // its viewports are set here; runs once, in the sideways process
    let page;
    const seeds = [['midlesson', prof({ course: Object.assign(done('rules', 'special', 'board'), { values: { learn: NOW - DAY } }), days: played(0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11) })],
      ['practice', prof({ levelOfferT: NOW - DAY, course: done(...FOUND), games: [WIN1], days: played(0, 1) })],
      ['new', prof()]];
    for (const v of [{ width: 915, height: 412 }, { width: 844, height: 390 }]) for (const [k, p] of seeds) {
      page = await seeded(v, p);
      await beginnerHome(page, v, k + ' ' + v.width + 'x' + v.height);
      const r = await page.evaluate(() => {
        const b = (s) => { const e = document.querySelector(s); const x = e.getBoundingClientRect(); return { top: x.top, bottom: x.bottom, left: x.left, right: x.right, width: x.width }; };
        return { go: b('#bhome .bh-go'), card: b('#bhome .bh-card'), hero: b('#bhome .bh-hero'), block: b('#bhome'), w: document.documentElement.clientWidth, h: window.innerHeight, y: window.scrollY };
      });
      const why = k + ' at ' + v.width + 'x' + v.height;
      assert.equal(r.y, 0);
      assert.ok(r.go.top >= 0 && r.go.bottom <= r.h + 0.5, why + ': Continue fully on the first screen (' + Math.round(r.go.bottom) + ' of ' + r.h + ')');
      assert.ok(r.block.width <= 500, why + ': one column, about 480px: ' + r.block.width);
      assert.ok(Math.abs(r.block.left - (r.w - r.block.right)) <= 2, why + ': centred: ' + JSON.stringify(r.block));
      assert.ok(r.hero.bottom <= r.card.top && r.card.bottom <= r.h + 60, why + ': Rani above the card');
      if (k === 'midlesson') await shot(page, v, 'beginner_home_sideways');
      if (v.width === 915 && k === 'new') {
        await page.locator('#tab-play').click();
        assert.equal(await vis(page, '.boardcol'), true, 'Play keeps the board sideways');
        await page.locator('#tab-path').click();
        assert.equal(await vis(page, '.boardcol'), true, 'Learn keeps the board sideways');
        await page.locator('#tab-coach').click();
        assert.equal(await vis(page, '.boardcol'), false);
      }
      await page.context().close();
    }
    // Tablets and desktop keep D38: no board up to 860px wide, the board on wider screens; the full-size Rani.
    for (const v of [{ width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 900 }]) {
      page = await seeded(v, prof());
      assert.equal(await vis(page, '.boardcol'), v.width > 860, v.width + 'x' + v.height + ': board ' + (v.width > 860 ? 'shown' : 'hidden') + ' (D38)');
      const av = await page.locator('#bhome .bh-av').boundingBox();
      assert.ok(av.width >= 96 && av.width <= 120, v.width + 'x' + v.height + ': full-size avatar ' + av.width);
      if (v.width !== 1280) await page.context().close();
    }
    return page;
  }],
  ['F6: under reduced motion Rani is drawn once per mood and size, then stays still', async (vp) => {
    const page = await seeded(vp, prof({ course: done('rules') }), { ctx: { reducedMotion: 'reduce' } });
    await page.waitForFunction(() => window.Coach3D.isReady(), null, { timeout: 20000 });
    await page.waitForTimeout(800);
    const painted = await page.evaluate(() => { const c = document.querySelector('#bhome canvas.q3d'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) n++; return n; });
    assert.ok(painted > 200, 'Rani is drawn on Beginner Home: ' + painted);
    await page.evaluate(() => { window.__draws = 0; const o = CanvasRenderingContext2D.prototype.drawImage; CanvasRenderingContext2D.prototype.drawImage = function () { if (this.canvas && this.canvas.classList.contains('q3d')) window.__draws++; return o.apply(this, arguments); }; });
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => window.__draws), 0, 'no redraws while nothing changes');
    await page.locator('#tab-play').click(); // the Play coach (another size) was drawn once at start, while hidden
    await page.waitForTimeout(1500);
    const playPx = await page.evaluate(() => { const c = document.querySelector('#coachAv canvas.q3d'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) k++; return k; });
    assert.ok(playPx > 200, 'the Play coach is drawn: ' + playPx);
    const n = await page.evaluate(() => window.__draws);
    assert.equal(n, 0, 'showing an already drawn Rani does not redraw her');
    await page.locator('#tab-coach').click();
    await page.locator('#settingsBtn').click();
    await page.locator('#lookSet [data-coach="gaja"]').click();
    await page.locator('#lookSet [data-coach="rani"]').click(); // a new canvas: drawn once
    await page.keyboard.press('Escape');
    await page.waitForFunction((m) => window.__draws > m, n, { timeout: 3000 }); // a new canvas (new mood or size) is drawn
    const m2 = await page.evaluate(() => window.__draws);
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => window.__draws), m2, 'then still again');
    const painted2 = await page.evaluate(() => { const c = document.querySelector('#bhome canvas.q3d'), d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let k = 0; for (let i = 3; i < d.length; i += 4) if (d[i]) k++; return k; });
    assert.ok(painted2 > 200, 'Rani drawn again after a change');
    return page;
  }]
];

// A small static server for www/ (Python's http.server sometimes reset connections when Chromium loads all scripts at once).
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
        results.push('ok   ' + label);
      } catch (e) {
        failures++; results.push('FAIL ' + label + '\n     ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n     ') + (process.env.S2B_STACK ? '\n' + e.stack : ''));
      } finally { if (page) await page.context().close(); }
    }
  } finally { await browser.close(); srv.close(); }
  console.log(results.join('\n'));
  console.log('\n' + (results.length - failures) + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})();
