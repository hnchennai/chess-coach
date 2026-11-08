// E2E for slice S2a (level-based interface, plain move words, fixed bottom nav, tab unlock, level-up offer).
// Run: S2A_VP=412 node tests/e2e/s2a.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// S2A_VP: 360 | 412 | 1280. S2A_SHOTS=<dir> saves screenshots. S2A_ONLY=<regex> runs matching cases.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const assert = require('assert/strict');
const path = require('path');

const WWW = path.resolve(process.env.S2A_WWW || path.join(__dirname, '../../www'));
const PORT = 8000 + Math.floor(Math.random() * 900);
const URL = 'http://127.0.0.1:' + PORT + '/index.html';
const SHOTS = process.env.S2A_SHOTS || '';
const PKEY = 'suresh-chess-coach.profile.v1', GKEY = 'suresh-chess-coach.v1', TKEY = 'suresh-chess-coach.tab';
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }].filter((v) => !process.env.S2A_VP || String(v.width) === process.env.S2A_VP);
const ONLY = process.env.S2A_ONLY ? new RegExp(process.env.S2A_ONLY) : null;
const NOW = Date.now(), DAY = 86400000;
const PARTNER = 'Rani’s practice partner';
const UNLOCK_NOTE = 'New: Train and Progress. Practise with puzzles and see how you’re doing.';
const OFFER_B = 'Ready for Improver? You finished every Foundations lesson. Next come forks, pins and other tactics.';
const OFFER_I = 'Ready for Club? You finished every Tactics lesson. Next come endgames and seeing two moves ahead.';

let browser, results = [], failures = 0;

const DONE = { learn: 1, practice: 1, apply: 1 };
const done = (...ids) => Object.fromEntries(ids.map((id) => [id, Object.assign({}, DONE)]));
function prof(o) {
  return Object.assign({ v: 5, level: 'beginner', levelT: NOW - DAY, placed: 'check', start: 'rules', rating: 600, rn: 0, games: [], puz: {}, course: {}, days: {}, reviewed: [], t: NOW - DAY, theme: null, showAll: false, unlockAll: false, provisional: false, pgsDeclined: false, levelOfferT: 0 }, o);
}
const WHY_CHECK = [{ c: 'threat', h: 'It’s check. Get out of check first: move the king, block the line, or capture the checking piece.' }];
// 1. d4 c6 2. Bd2 Qa5 3. f3 Qxd2+ : the partner takes your bishop with check (S2a scenario 2).
const GAME_CHECK = { sans: ['d4', 'c6', 'Bd2', 'Qa5', 'f3', 'Qxd2+'], user: 'w', level: 1, ann: { 0: 'best', 2: 'good', 4: 'blund' }, notes: { 5: { side: 'e', why: WHY_CHECK, ev: -900 } }, tags: {}, fb: { cls: 'blund', sym: '??', title: 'Blunder', mv: 'You played f3', text: 'This gives away material or position.' }, opp: { san: 'Qxd2+', why: WHY_CHECK }, evalW: -900, flipped: false, recorded: false, goal: null, t: NOW };
const CHIP = '<button type="button" class="mvc" data-from="g1" data-to="f3" data-p="n" data-c="w" data-san="Nf3" title="Nf3: White knight to f3. Tap to see it on the board." aria-label="White knight to f3 (Nf3)"><span class="mvi"></span><span class="mvt">f3</span></button>';
const NOTE_U = (t) => ({ side: 'u', cls: 'best', text: t, ev: 30 });
const NOTE_E = { side: 'e', why: [{ c: 'good', h: 'No direct threat. It’s developing, so keep developing too and get castled.' }], ev: 30 };
const GAME_OPEN = { sans: ['e4', 'e5', 'Nf3', 'Nc6'], user: 'w', level: 2, ann: { 0: 'best', 2: 'best' }, notes: { 0: NOTE_U('This claims space in the center.'), 1: NOTE_E, 2: NOTE_U('This develops your knight.'), 3: NOTE_E }, tags: {}, fb: { cls: 'best', sym: '!', title: 'Best move', mv: 'You played Nf3', text: 'This develops your knight.' }, opp: { san: 'Nc6', why: NOTE_E.why }, evalW: 30, flipped: false, recorded: false, goal: null, t: NOW };

function seedFn([pk, p, gk, g, tk, tab]) {
  if (sessionStorage.getItem('seeded')) return;
  localStorage.setItem(pk, JSON.stringify(p));
  if (g) localStorage.setItem(gk, JSON.stringify(g));
  if (tab) localStorage.setItem(tk, JSON.stringify(tab));
  sessionStorage.setItem('seeded', '1');
}
async function newPage(vp, init, extra) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  if (init) await ctx.addInitScript(init.fn, init.arg);
  if (extra) await ctx.addInitScript(extra.fn, extra.arg);
  const page = await ctx.newPage();
  if (process.env.S2A_TIMEOUT) { page.setDefaultTimeout(+process.env.S2A_TIMEOUT); page.setDefaultNavigationTimeout(60000); }
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.goto(URL);
  try { await page.waitForFunction(() => window.__coach && window.Placement); }
  catch (e) { throw new Error('app did not start: ' + e.message.split('\n')[0] + ' | page errors: ' + JSON.stringify(page.errors)); }
  return page;
}
const seeded = (vp, p, game, tab, extra) => newPage(vp, { fn: seedFn, arg: [PKEY, p, GKEY, game || null, TKEY, tab || null] }, extra);
// Same stand-in for the Claude account runtime as s1.spec.js (window.claude), so the cloud path runs offline.
function cloudMock(arg) {
  if (sessionStorage.getItem('cloudMockSeeded')) { const c = JSON.parse(sessionStorage.getItem('cloudMock')); window.__cloud = c; arg = Object.assign({}, arg, { hold: false, failFirst: false, delay: 0 }); }
  else { sessionStorage.setItem('cloudMockSeeded', '1'); window.__cloud = { prof: arg.prof, game: null, sets: [], gets: 0 }; }
  let release; const gate = new Promise((r) => { release = r; }); window.__release = release; if (!arg.hold) release();
  const keep = () => sessionStorage.setItem('cloudMock', JSON.stringify(window.__cloud));
  const doc = (k) => ({
    get: () => gate.then(() => new Promise((res) => setTimeout(() => { window.__cloud.gets++; res({ exists: !!window.__cloud[k], data: () => JSON.parse(JSON.stringify(window.__cloud[k])) }); }, arg.delay || 0))),
    set: (d) => { window.__cloud[k] = JSON.parse(JSON.stringify(d)); window.__cloud.sets.push({ k, at: Date.now() }); keep(); return Promise.resolve(); }
  });
  window.claude = { use: (n) => Promise.resolve(n === 'db' ? { doc: (p) => doc(/profile$/.test(p) ? 'prof' : 'game') } : { id: () => (arg.idFails ? Promise.reject(new Error('account')) : Promise.resolve('u1')) }) };
}

const getProf = (page) => page.evaluate(() => window.__coach.getProf());
const st = (page, k) => page.evaluate((key) => window.__coach.st[key], k);
const vis = (page, sel) => page.locator(sel).first().isVisible();
const phone = (vp) => vp.width <= 600;
const shot = async (page, vp, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, vp.width + '_' + name + '.png') }); };
const noteText = async (page) => (await page.locator('#raniNote p').innerText()).trim();
async function tabsShown(page) { return page.evaluate(() => ['coach', 'path', 'play', 'train', 'progress'].filter((t) => { const b = document.getElementById('tab-' + t); return b && b.offsetParent !== null; })); }
async function closeNote(page) { if (await vis(page, '#raniNote')) await page.locator('#raniNote [data-act="notedone"]').click(); }
// Everything a Beginner must not see: eval strip, engine pill, Moves card, opponent picker and rating tag.
async function hiddenForBeginner(page, why) {
  for (const sel of ['#evalbar', '#enginePill', '#movesCard', '#oppPick']) assert.equal(await vis(page, sel), false, why + ': ' + sel + ' hidden');
  assert.equal((await page.locator('#oppLevel').innerText()).trim(), '', why + ': no rating tag');
}
async function shownAll(page, why) {
  await page.locator('#tab-play').click();
  for (const sel of ['#evalbar', '#enginePill', '#movesCard', '#oppPick']) assert.equal(await vis(page, sel), true, why + ': ' + sel + ' shown');
  assert.ok(/~\d+|max/.test(await page.locator('#oppLevel').innerText()), why + ': rating tag shown');
}
// No SAN anywhere visible (chips show only a piece icon and a square, like "×d2").
const SAN = /(^|[^\w×-])([KQRBN][a-h]?[1-8]?x?[a-h][1-8]|[a-h]x[a-h][1-8]|O-O)/;
async function finishLesson(page) {
  await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
  for (let i = 0; i < 12 && (await st(page, 'mode')) === 'lesson'; i++) await page.locator('#navNext').click();
  assert.notEqual(await st(page, 'mode'), 'lesson');
}

const cases = [
  ['Scenario 1: Beginner Play: no eval, engine pill, rating, Moves card or picker; partner name; 3 tabs', async (vp) => {
    const page = await seeded(vp, prof());
    await page.locator('#tab-play').click();
    await hiddenForBeginner(page, 'Beginner');
    assert.equal(await page.locator('#oppName').innerText(), PARTNER);
    assert.equal(await page.locator('#modeText').innerText(), 'New game vs ' + PARTNER + ', you play White');
    assert.equal(await vis(page, '#colorSel'), true, 'Play as stays');
    assert.deepEqual(await tabsShown(page), ['coach', 'path', 'play']);
    const nav = await page.locator('.tabs').boundingBox();
    if (phone(vp)) {
      assert.equal(await page.locator('.tabs').evaluate((e) => getComputedStyle(e).position), 'fixed');
      assert.ok(Math.abs(nav.y + nav.height - vp.height) <= 1, 'nav at the bottom: ' + JSON.stringify(nav));
      assert.ok(Math.abs(nav.height - 56) <= 1, 'nav 56px: ' + nav.height);
    } else assert.notEqual(await page.locator('.tabs').evaluate((e) => getComputedStyle(e).position), 'fixed', 'desktop nav unchanged');
    const w = await page.evaluate(() => ['coach', 'path', 'play'].map((t) => document.getElementById('tab-' + t).getBoundingClientRect().width));
    assert.ok(Math.max(...w) - Math.min(...w) <= 1, '3 tabs share the width: ' + w);
    const col = await page.locator('.boardcol').innerText();
    assert.ok(!/~\s?\d|rated \d|Stockfish/.test(col), 'no rating or engine name on the board column: ' + col);
    await page.locator('#newBtn').click();
    assert.equal(await st(page, 'level'), 1, 'New game plays the Beginner bot');
    assert.equal(await page.locator('#oppName').innerText(), PARTNER);
    return page;
  }],
  ['Scenario 2: the partner takes your bishop with check, in plain words, no notation', async (vp) => {
    const page = await seeded(vp, prof({ course: done('rules', 'special') }), GAME_CHECK, 'play');
    await page.locator('#tab-play').click();
    const sentence = 'Rani’s partner took your bishop. Check!';
    assert.equal(await page.locator('#modeText').innerText(), 'Your game vs ' + PARTNER + ', you play White', 'mid-game mode bar');
    if (vp.width <= 860) {
      const strip = await page.locator('#coachStrip').innerText();
      assert.ok(strip.includes(sentence), 'strip: ' + strip);
      assert.ok(!/Engine replied/.test(strip));
      assert.ok(!SAN.test(strip), 'no SAN in the strip: ' + strip);
    }
    assert.equal((await page.locator('#oppHead').textContent()).trim(), sentence, 'Play panel says it too');
    assert.equal(await page.locator('#oppHead').evaluate((e) => getComputedStyle(e).textTransform), 'none', 'a sentence, not shouted in capitals');
    const txt = await page.locator('.app').innerText();
    assert.ok(!SAN.test(txt), 'no notation anywhere: ' + (txt.match(SAN) || [])[0]);
    await hiddenForBeginner(page, 'mid-game');
    await shot(page, vp, 'beginner_play_midgame');
    return page;
  }],
  ['Scenario 3: Beginner review: Next says "You moved a pawn forward.", no eval, no move list', async (vp) => {
    const page = await seeded(vp, prof(), GAME_OPEN, 'play');
    await page.locator('#tab-play').click();
    await page.locator('#reviewBtn').click();
    assert.equal(await st(page, 'mode'), 'review');
    await page.locator('#navFirst').click();
    await page.locator('#navNext').click();
    const where = vp.width <= 860 ? '#coachStrip' : '#coach';
    await page.waitForFunction((s) => document.querySelector(s).innerText.includes('You moved a pawn forward.'), where);
    if (vp.width <= 860) assert.ok((await page.locator('#coachStrip b').innerText()).startsWith('You moved a pawn forward.'), 'strip title is the sentence');
    assert.ok((await page.locator(where).innerText()).includes('Best move'), 'grade words kept');
    await hiddenForBeginner(page, 'review');
    assert.ok(!SAN.test(await page.locator('.app').innerText()), 'no notation in review');
    await shot(page, vp, 'beginner_review');
    await page.locator('#navNext').click();
    await page.waitForFunction((s) => document.querySelector(s).innerText.includes('Rani’s partner moved a pawn forward.'), where);
    await page.locator('#navNext').click();
    await page.waitForFunction((s) => document.querySelector(s).innerText.includes('You moved a knight.'), where);
    return page;
  }],
  ['Scenario 4: the third lesson unlocks Train and Progress with one note; Train has no rating numbers', async (vp) => {
    const page = await seeded(vp, prof({ course: { rules: { learn: 1, practice: 1 }, special: { learn: 1 }, board: { practice: 1 } } }));
    assert.deepEqual(await tabsShown(page), ['coach', 'path', 'play']);
    await page.evaluate(() => window.__coach.startPart('board', 'learn'));
    await finishLesson(page);
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), UNLOCK_NOTE);
    assert.deepEqual(await tabsShown(page), ['coach', 'path', 'play', 'train', 'progress'], 'both tabs at once');
    if (phone(vp)) {
      const n = await page.locator('#raniNote').boundingBox(), t = await page.locator('.tabs').boundingBox();
      assert.ok(n.y + n.height <= t.y + 0.5, 'note sits above the nav');
    }
    await shot(page, vp, 'unlock_note');
    await closeNote(page);
    await page.locator('#tab-train').click();
    const train = await page.locator('#panel-train').innerText();
    assert.equal((await page.locator('#ratedHead').textContent()).trim(), 'Puzzles at your level');
    assert.equal((await page.locator('#ratedLede').textContent()).trim(), 'Puzzles picked for you. Solve them to get stronger.');
    assert.equal((await page.locator('#panel-train [data-train="rated"]').innerText()).trim(), 'Start 10 puzzles');
    assert.ok(!/rated|rating/i.test(train), 'no rating words in Train');
    await page.locator('#panel-train [data-train="rated"]').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'puzzle');
    const ses = await page.locator('#sessionCard').innerText(), bar = await page.locator('#modebar').innerText();
    assert.ok(!/rating|rated \d/i.test(ses + bar), 'no rating in a puzzle: ' + ses + ' | ' + bar);
    await page.reload(); await page.waitForFunction(() => window.__coach);
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'the unlock note shows once');
    return page;
  }],
  ['Scenario 5: Show everything shows every hidden element and all tabs; level stays; off hides again', async (vp) => {
    const page = await seeded(vp, prof());
    await page.locator('#settingsBtn').click();
    await page.locator('#levelCard [data-act="showall"]').click();
    assert.deepEqual(await tabsShown(page), ['coach', 'path', 'play', 'train', 'progress']);
    await page.keyboard.press('Escape');
    await shownAll(page, 'showAll');
    assert.ok(/~\d+/.test(await page.locator('#modeText').innerText()), 'mode bar rating');
    assert.notEqual(await page.locator('#oppName').innerText(), PARTNER, 'real opponent name');
    assert.equal((await getProf(page)).level, 'beginner');
    assert.equal((await getProf(page)).start, 'rules', 'course unchanged');
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'Show everything never shows the unlock note');
    await page.locator('#tab-train').click();
    assert.ok((await page.locator('#panel-train').innerText()).includes('Start 10 rated puzzles'), 'normal Train card with Show everything');
    await shot(page, vp, 'beginner_showall');
    await page.locator('#settingsBtn').click();
    await page.locator('#levelCard [data-act="showall"]').click();
    await page.keyboard.press('Escape');
    assert.equal(await st(page, 'tab'), 'coach', 'a hidden tab falls back to Home');
    assert.deepEqual(await tabsShown(page), ['coach', 'path', 'play']);
    await page.locator('#tab-play').click();
    await hiddenForBeginner(page, 'showAll off');
    return page;
  }],
  ['Scenario 6: level-up offer after The blunder check; Not yet waits a week; Yes = Improver at Forks', async (vp) => {
    const p = prof({ start: 'board', placed: 'check', levelT: NOW - 30 * DAY, levelOfferT: NOW - DAY, course: Object.assign(done('board', 'values', 'mate', 'opening'), { blunder: { practice: 1, apply: 1 } }) });
    let page = await seeded(vp, p);
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'no offer before the level is complete');
    await page.evaluate(() => window.__coach.startPart('blunder', 'learn'));
    await finishLesson(page);
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), OFFER_B, 'offer right after the lesson, even with a recent Not yet');
    assert.equal(await page.locator('#raniNote [data-act="offeryes"]').innerText(), 'Yes, move me up');
    assert.equal(await page.locator('#raniNote [data-act="offerno"]').innerText(), 'Not yet');
    await shot(page, vp, 'levelup_offer');
    await page.locator('#raniNote [data-act="offerno"]').click();
    assert.equal(await noteText(page), 'OK. I’ll ask again in a week. You can change it any time in Settings.');
    let pr = await getProf(page);
    assert.equal(pr.level, 'beginner'); assert.ok(Math.abs(pr.levelOfferT - Date.now()) < 60000, 'levelOfferT = now');
    await page.reload(); await page.waitForFunction(() => window.__coach);
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'not asked again the same week');
    // A week later: the offer comes back at app start.
    await page.evaluate(([k]) => { const x = JSON.parse(localStorage.getItem(k)); x.levelOfferT = Date.now() - 8 * 86400000; localStorage.setItem(k, JSON.stringify(x)); }, [PKEY]);
    await page.reload(); await page.waitForFunction(() => window.__coach);
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), OFFER_B, 'asked again 7 days later at app start');
    await page.locator('#raniNote [data-act="offeryes"]').click();
    pr = await getProf(page);
    assert.equal(pr.level, 'improver'); assert.equal(pr.unlockAll, true); assert.equal(pr.start, 'fork'); assert.equal(pr.placed, 'chosen');
    assert.equal(pr.rating, 1000, 'no rated puzzles: starting rating');
    assert.equal(await noteText(page), 'You’re an Improver now. All tabs are open.');
    assert.equal(await page.evaluate(() => window.__coach.nextUnit().id), 'fork');
    assert.deepEqual(await tabsShown(page), ['coach', 'path', 'play', 'train', 'progress']);
    assert.ok(Object.keys(pr.course).every((id) => ['board', 'values', 'mate', 'opening', 'blunder'].includes(id)), 'no lesson marked or cleared');
    return page;
  }],
  ['Scenario 6b: Yes keeps the rating when there are rated puzzles', async (vp) => {
    const page = await seeded(vp, prof({ start: 'board', levelT: NOW - 9 * DAY, rating: 731, rn: 14, course: done('board', 'values', 'mate', 'opening', 'blunder') }));
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), OFFER_B);
    await page.locator('#raniNote [data-act="offeryes"]').click();
    const pr = await getProf(page);
    assert.equal(pr.level, 'improver'); assert.equal(pr.rating, 731); assert.equal(pr.rn, 14);
    return page;
  }],
  ['Offer queue: the v4 note first, then "Ready for Club?"; Yes = Club', async (vp) => {
    const v4 = { v: 4, theme: null, games: [{ id: 'g1', d: 1700000000000, r: 'W', user: 'w', level: 3, sans: ['e4', 'e5'], ann: {} }], puz: {}, rating: 1000, rn: 0, course: done('fork', 'pin', 'disc', 'patterns', 'check2'), days: {}, reviewed: [], t: 1700000000000 };
    const page = await seeded(vp, v4);
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), 'You’re set as Improver. Change it any time in Settings.', 'one note at a time');
    await page.locator('#raniNote [data-act="notedone"]').click();
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), OFFER_I);
    await page.locator('#raniNote [data-act="offeryes"]').click();
    const pr = await getProf(page);
    assert.equal(pr.level, 'club'); assert.equal(pr.start, 'kq'); assert.equal(pr.rating, 1300, 'no rated puzzles (rn 0): Club starting rating'); assert.equal(pr.unlockAll, true);
    assert.equal(await noteText(page), 'You’re Club level now.');
    await page.locator('#raniNote [data-act="notedone"]').click();
    assert.equal(await page.locator('#raniNote').isHidden(), true);
    return page;
  }],
  ['Scenario 7: Improver: engine pill hidden, eval, Moves card and ratings shown; Home starts at level 2', async (vp) => {
    const page = await seeded(vp, prof({ level: 'improver', start: 'fork', rating: 1000 }));
    assert.equal(await vis(page, '#enginePill'), false, 'engine pill hidden');
    await page.locator('#tab-play').click();
    for (const sel of ['#evalbar', '#movesCard', '#oppPick']) assert.equal(await vis(page, sel), true, sel);
    assert.ok(/~\d+/.test(await page.locator('#oppLevel').innerText()));
    assert.deepEqual(await tabsShown(page), ['coach', 'path', 'play', 'train', 'progress']);
    await shot(page, vp, 'improver_play');
    await page.locator('#tab-coach').click();
    const hero = await page.locator('#stageHero').innerText(), today = await page.locator('#today').innerText(), road = await page.locator('#roadCard .roadrow.cur').innerText();
    assert.ok(hero.includes('Next step: Learn: Forks'), hero);
    assert.ok(!/How the pieces move/.test(hero + today), 'never suggests a unit before the start point');
    assert.ok(today.includes('Forks'), today);
    assert.ok(road.includes('2. Tactics'), 'roadmap: you are here = stage 2: ' + road);
    assert.ok(!/Done/.test(await page.locator('#roadCard .roadrow[data-stage="1"]').innerText()), 'a skipped stage is not marked done');
    return page;
  }],
  ['Club Home starts at stage 3 (Endgames and calculation)', async (vp) => {
    const page = await seeded(vp, prof({ level: 'club', start: 'kq', rating: 1300 }));
    const hero = await page.locator('#stageHero').innerText();
    assert.ok(hero.includes('Mate with king and queen'), hero);
    assert.ok((await page.locator('#roadCard .roadrow.cur').innerText()).includes('3. Endgames and calculation'));
    return page;
  }],
  ['Scenario 8: Club on a phone (360 and 412): engine pill shape + name, nav on every tab, note above the nav', async (vp) => {
    if (!phone(vp)) return newPage(vp);
    const v4 = { v: 4, theme: null, games: [{ id: 'g1', d: 1700000000000, r: 'W', user: 'w', level: 4, sans: ['e4', 'e5'], ann: {} }], puz: {}, rating: 1350, rn: 30, course: {}, days: {}, reviewed: [], t: 1700000000000 };
    const page = await seeded(vp, v4);
    assert.equal((await getProf(page)).level, 'club');
    const pill = page.locator('#enginePill');
    assert.equal(await pill.isVisible(), true);
    const looks = await page.evaluate(() => {
      const p = document.getElementById('enginePill'), i = p.querySelector('i'), keep = p.dataset.state, out = {};
      for (const s of ['loading', 'ready', 'failed']) { p.dataset.state = s; const c = getComputedStyle(i); out[s] = [c.borderRadius, c.borderTopWidth, c.backgroundColor === 'rgba(0, 0, 0, 0)' ? 'hollow' : 'solid', c.transform].join(' '); }
      p.dataset.state = keep; return out;
    });
    assert.equal(new Set(Object.values(looks)).size, 3, 'each state has its own shape: ' + JSON.stringify(looks));
    const name = await pill.getAttribute('aria-label');
    assert.ok(/Stockfish|engine/i.test(name || ''), 'accessible name: ' + name);
    assert.equal(await pill.getAttribute('role'), 'status');
    await page.waitForSelector('#raniNote:not([hidden])');
    const n = await page.locator('#raniNote').boundingBox(), t = await page.locator('.tabs').boundingBox();
    assert.ok(n.y + n.height <= t.y + 0.5, 'note above the nav: ' + JSON.stringify([n, t]));
    await shot(page, vp, 'club_note_above_nav');
    await closeNote(page);
    await page.locator('#tab-play').click(); await page.evaluate(() => window.scrollTo(0, 0));
    await shot(page, vp, 'club_play');
    for (const tab of ['coach', 'path', 'play', 'train', 'progress']) {
      await page.locator('#tab-' + tab).click();
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      const b = await page.locator('.tabs').boundingBox();
      assert.ok(Math.abs(b.y + b.height - vp.height) <= 1, tab + ': nav visible at the bottom');
    }
    const w = await page.evaluate(() => ['coach', 'path', 'play', 'train', 'progress'].map((x) => document.getElementById('tab-' + x).getBoundingClientRect()));
    assert.ok(w.every((r) => r.height >= 44 && r.width >= 44), '44px tap targets');
    assert.ok(Math.max(...w.map((r) => r.width)) - Math.min(...w.map((r) => r.width)) <= 1, '5 tabs share the width');
    return page;
  }],
  ['Scenario 9: Beginner switches to Club mid-game: everything appears at once, game carries on', async (vp) => {
    const page = await seeded(vp, prof({ course: done('rules') }), GAME_OPEN, 'play');
    await page.locator('#tab-play').click();
    await hiddenForBeginner(page, 'before');
    const before = await page.evaluate(() => window.__coach.hist());
    await page.locator('#settingsBtn').click();
    await page.locator('#levelCard [data-lvset="club"]').click();
    for (const sel of ['#evalbar', '#enginePill', '#movesCard', '#oppPick']) assert.equal(await vis(page, sel), true, sel + ' shown at once');
    assert.ok(/~\d+/.test(await page.locator('#oppLevel').innerText()), 'rating tag at once');
    assert.ok(/~\d+/.test(await page.locator('#modeText').innerText()), 'mode bar rating at once');
    assert.equal((await page.locator('#moves').innerText()).includes('Nc6') || (await page.locator('#moves td.clk').count()) === 4, true, 'move list has the game');
    await page.keyboard.press('Escape');
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), before, 'game kept');
    assert.equal(await st(page, 'mode'), 'play');
    assert.deepEqual(await tabsShown(page), ['coach', 'path', 'play', 'train', 'progress']);
    return page;
  }],
  ['Beginner sees no rating numbers on Home, Learn, Progress or Train; Improver sees them', async (vp) => {
    const p = prof({ rating: 637, rn: 9, course: done('rules', 'special', 'board'), games: [{ id: 'g1', d: NOW - DAY, r: 'L', user: 'w', level: 2, acc: 70, counts: {}, tags: { hung: 1 }, sans: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'], ann: {} }], puz: { m1: { n: 2, ok: 1, box: 0, due: 0 } } });
    const page = await seeded(vp, p);
    const bad = /637|~\s?\d|rated \d|rating \d|Rating band|\d{3,4} to \d{3,4}|up to \d|US Chess/i;
    for (const tab of ['coach', 'path', 'play', 'train', 'progress']) {
      await page.locator('#tab-' + tab).click();
      const t = await page.locator('.app').innerText();
      assert.ok(!bad.test(t), tab + ' leaks: ' + (t.match(bad) || [])[0]);
    }
    assert.ok((await page.locator('#history').innerText()).includes(PARTNER), 'past games name the partner');
    await page.locator('#settingsBtn').click(); await page.locator('#levelCard [data-lvset="improver"]').click(); await page.keyboard.press('Escape');
    await page.locator('#tab-coach').click();
    assert.ok(/637/.test(await page.locator('.app').innerText()), 'Improver sees the rating');
    await page.locator('#tab-progress').click();
    assert.ok(/~\d+/.test(await page.locator('#focus').innerText()), 'Improver sees the suggested opponent rating');
    return page;
  }],
  ['Beginner New game plays the partner; Improver and Show everything keep the picker', async (vp) => {
    let page = await seeded(vp, prof());
    await page.locator('#tab-play').click();
    await page.evaluate(() => { document.getElementById('levelSel').value = '5'; });
    await page.locator('#newBtn').click();
    assert.equal(await st(page, 'level'), 1, 'Beginner: Beginner bot');
    await page.context().close();
    page = await seeded(vp, prof({ level: 'improver', start: 'fork', rating: 1000 }));
    await page.locator('#tab-play').click();
    await page.locator('#levelSel').selectOption('4');
    await page.locator('#newBtn').click();
    assert.equal(await st(page, 'level'), 4, 'Improver: the picked opponent');
    await page.context().close();
    page = await seeded(vp, prof({ showAll: true }));
    await page.locator('#tab-play').click();
    await page.locator('#levelSel').selectOption('3');
    await page.locator('#newBtn').click();
    assert.equal(await st(page, 'level'), 3, 'Show everything: the picked opponent');
    return page;
  }],
  ['Locked tabs are unreachable; a Club player on Train who picks Beginner lands on Home', async (vp) => {
    let page = await seeded(vp, prof(), null, 'train');
    assert.equal(await st(page, 'tab'), 'coach', 'saved Train tab falls back to Home');
    assert.equal(await vis(page, '#panel-train'), false);
    await page.context().close();
    page = await seeded(vp, prof({ level: 'club', start: 'kq', rating: 1300 }), null, 'train');
    assert.equal(await st(page, 'tab'), 'train');
    await page.locator('#settingsBtn').click(); await page.locator('#levelCard [data-lvset="beginner"]').click(); await page.keyboard.press('Escape');
    assert.equal(await st(page, 'tab'), 'coach');
    assert.deepEqual(await tabsShown(page), ['coach', 'path', 'play']);
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'no unlock note from a level change');
    return page;
  }],
  ['Settings sheet over the nav; Esc closes only the sheet, a sticky move tip stays', async (vp) => {
    const page = await seeded(vp, prof({ level: 'improver', start: 'fork', rating: 1000 }), GAME_OPEN, 'play');
    await page.locator('#tab-play').click();
    await page.locator('#settingsBtn').click();
    await page.locator('#settingsSheet').waitFor({ state: 'visible' });
    if (phone(vp)) {
      const top = await page.evaluate(() => { const r = document.querySelector('.tabs').getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!(el && el.closest('#settingsSheet')); });
      assert.ok(top, 'the sheet is above the nav');
    }
    await shot(page, vp, 'settings_over_nav');
    await page.keyboard.press('Escape');
    await page.locator('#settingsSheet').waitFor({ state: 'hidden' });
    await page.locator('#movesCard .sanhint .san').click();
    await page.waitForSelector('.santip:not([hidden])');
    await page.evaluate(() => window.__coach.openSettings());
    await page.locator('#settingsSheet').waitFor({ state: 'visible' });
    await page.keyboard.press('Escape');
    await page.locator('#settingsSheet').waitFor({ state: 'hidden' });
    assert.equal(await page.locator('.santip').isVisible(), true, 'the sticky tip behind the sheet is left alone');
    return page;
  }],
  ['Level check: X top right on welcome and result; focus goes to the selected tab after it closes', async (vp) => {
    let page = await newPage(vp);
    await page.locator('[data-pl-path="never"]').click();
    await page.locator('#placement [data-pl="start"]').click();
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'tab-' + (await st(page, 'tab')), 'focus on the selected tab, not body');
    await page.context().close();
    page = await seeded(vp, prof({ level: 'improver', start: 'fork', rating: 1000 }));
    await page.locator('#settingsBtn').click(); await page.locator('#levelCard [data-act="recheck"]').click();
    const xWel = await page.locator('#placement .pl-x').boundingBox();
    await page.locator('[data-pl-path="never"]').click();
    const xRes = await page.locator('#placement .pl-x').boundingBox();
    assert.ok(Math.abs(xWel.x - xRes.x) <= 1 && Math.abs(xWel.y - xRes.y) <= 1, 'same corner: ' + JSON.stringify([xWel, xRes]));
    const card = await page.locator('#placement .pl-card').boundingBox();
    assert.ok(xRes.x + xRes.width > card.x + card.width - 30, 'top right');
    await page.locator('#placement [data-pl="start"]').click();
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'tab-' + (await st(page, 'tab')), 'focus after a retake');
    return page;
  }],
  ['Phone layout: nothing hides behind the nav at the bottom of a page', async (vp) => {
    if (!phone(vp)) return newPage(vp);
    const page = await seeded(vp, prof({ level: 'club', start: 'kq', rating: 1300 }));
    for (const tab of ['coach', 'progress']) {
      await page.locator('#tab-' + tab).click();
      await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
      const last = await page.evaluate((t) => { const els = Array.from(document.querySelectorAll('#panel-' + t + ' > *')).filter((e) => e.offsetParent !== null); return els[els.length - 1].getBoundingClientRect().bottom; }, tab);
      const nav = await page.locator('.tabs').boundingBox();
      assert.ok(last <= nav.y + 0.5, tab + ': last card ends above the nav (' + last + ' vs ' + nav.y + ')');
    }
    return page;
  }],
  ['Sync: the start offer waits for the first cloud pull; the answer is pushed only after it', async (vp) => {
    const local = prof({ start: 'board', levelT: NOW - 9 * DAY, course: done('board', 'values', 'mate', 'opening', 'blunder'), t: NOW - 9 * DAY });
    const cloudProf = Object.assign({}, local, { course: Object.assign({}, local.course, { fork: { learn: 1 } }), t: NOW - 10 * DAY });
    const page = await seeded(vp, local, null, null, { fn: cloudMock, arg: { prof: cloudProf, hold: true } });
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'no offer before the first pull');
    assert.equal(await page.evaluate(() => window.__cloud.sets.length), 0);
    await page.evaluate(() => window.__release());
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), OFFER_B);
    assert.deepEqual((await getProf(page)).course.fork, { learn: 1 }, 'merged first');
    await page.locator('#raniNote [data-act="offerno"]').click();
    await page.waitForFunction(() => window.__cloud.prof && window.__cloud.prof.levelOfferT > 0, null, { timeout: 5000 });
    assert.deepEqual(await page.evaluate(() => window.__cloud.prof.course.fork), { learn: 1 }, 'cloud progress kept');
    return page;
  }],
  // ---------------- Fix round 1 ----------------
  ['S1-8: the 3D view keeps a Beginner’s eval strip, engine pill and Moves card hidden', async (vp) => {
    const page = await seeded(vp, prof(), GAME_OPEN, 'play');
    await page.locator('#tab-play').click();
    await page.locator('#v3dBtn').click();
    await page.waitForFunction(() => { const b = document.getElementById('v3dBtn'); return /2D view|3D unavailable/.test(b.textContent) && !document.querySelector('.b3d.loading'); }, null, { timeout: 20000 });
    await hiddenForBeginner(page, '3D view (' + (await page.locator('#v3dBtn').innerText()) + ')');
    return page;
  }],
  ['S1-8: a Settings level change drops an open level-up offer', async (vp) => {
    const page = await seeded(vp, prof({ start: 'board', levelT: NOW - 9 * DAY, course: done('board', 'values', 'mate', 'opening', 'blunder') }));
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), OFFER_B);
    await page.locator('#settingsBtn').click(); await page.locator('#levelCard [data-lvset="improver"]').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'stale offer dropped');
    const pr = await getProf(page);
    assert.equal(pr.level, 'improver'); assert.equal(pr.unlockAll, false, 'the offer was not applied'); assert.equal(pr.levelOfferT, 0);
    return page;
  }],
  ['S1-1 / D29: a derived Improver (v4, start rules) gets Home at level 2; stored start unchanged', async (vp) => {
    const v4 = { v: 4, theme: null, games: [{ id: 'g1', d: 1700000000000, r: 'L', user: 'w', level: 2, sans: ['e4', 'e5'], ann: {} }], puz: {}, rating: 1000, rn: 0, course: {}, days: {}, reviewed: [], t: 1700000000000 };
    const page = await seeded(vp, v4);
    await closeNote(page);
    const pr = await getProf(page);
    assert.equal(pr.level, 'improver'); assert.equal(pr.start, 'rules', 'stored start unchanged');
    const hero = await page.locator('#stageHero').innerText();
    assert.ok(/Stage 2 of 6/i.test(hero), hero);
    assert.ok(hero.includes('Next step: Learn: Forks'), hero);
    assert.ok((await page.locator('#today .step3').first().innerText()).includes('Forks'), 'Today step 1 is Forks');
    assert.ok((await page.locator('#roadCard .roadrow.cur').innerText()).includes('2. Tactics'));
    await page.locator('#tab-path').click();
    assert.equal(await page.locator('#levels .unitrow.next').getAttribute('data-unit'), 'fork', 'Learn marks Forks as next');
    assert.equal(await page.locator('#levels [data-unit="rules"]').count(), 1, 'earlier lessons stay open in Learn');
    return page;
  }],
  ['S1-2 / S1-3 / D30: a Beginner stage ignores the rating goal; Next step "Beat Rani’s practice partner"; Today "10 puzzles"', async (vp) => {
    let page = await seeded(vp, prof({ start: 'board', levelT: NOW - DAY, levelOfferT: NOW - DAY, rating: 600, course: done('board', 'values', 'mate', 'opening', 'blunder') }));
    const hero = await page.locator('#stageHero').innerText();
    assert.ok(hero.includes('Next step: Beat Rani’s practice partner'), hero);
    assert.ok(hero.includes('Play slowly, blunder-check every move, and review the game after.'));
    assert.ok(/1 of 2 milestones/i.test(hero), 'rating goal not counted: ' + hero.split('\n').filter((l) => /milestone/i.test(l)).join(' | '));
    const miles = await page.locator('#stageCard .miles').innerText();
    assert.ok(miles.includes('Beat Rani’s practice partner') && !/rating|engine/i.test(miles), miles);
    const t2 = await page.locator('#today .step3.z-train').innerText();
    assert.ok(t2.includes('10 puzzles') && t2.includes('0 of 10 today.') && !/rated|rating/i.test(t2), t2);
    assert.ok(!/Ten puzzles a day/.test(await page.locator('.app').innerText()));
    await page.context().close();
    // Lessons done and a win against the partner: stage 1 is done even with a low rating.
    page = await seeded(vp, prof({ start: 'board', levelT: NOW - DAY, levelOfferT: NOW - DAY, rating: 600, course: done('board', 'values', 'mate', 'opening', 'blunder'), games: [{ id: 'g1', d: NOW - DAY, r: 'W', user: 'w', level: 1, sans: ['f3', 'e5', 'g4', 'Qh4#'], ann: {} }] }));
    assert.ok(/Stage 2 of 6/i.test(await page.locator('#stageHero').innerText()), 'stage 1 done without the rating goal');
    return page;
  }],
  ['D25: a locked Beginner’s Today card says "Learn it, then play it"', async (vp) => {
    const page = await seeded(vp, prof());
    assert.equal((await page.locator('#today h3').textContent()).trim(), 'Learn it, then play it');
    return page;
  }],
  ['D26: no accuracy % for a Beginner in review or Progress; Improver keeps it', async (vp) => {
    const g = { id: 'g1', d: NOW - DAY, r: 'L', user: 'w', level: 2, acc: 72, counts: { best: 1, good: 0, inacc: 0, mist: 0, blund: 1 }, tags: {}, sans: ['e4', 'e5', 'Qh5', 'Nc6', 'Bc4', 'Nf6', 'Qxf7#'], ann: { 0: 'best', 2: 'blund' } };
    let page = await seeded(vp, prof({ course: done('rules', 'special', 'board'), games: [g] }), GAME_OPEN, 'play');
    await page.locator('#tab-play').click(); await page.locator('#reviewBtn').click();
    assert.ok(!/accuracy/i.test(await page.locator('#modeText').innerText()), 'review bar');
    await page.locator('#tab-progress').click();
    assert.ok(!/accuracy|\d+%/i.test(await page.locator('#history').innerText()), 'Progress history');
    await page.context().close();
    page = await seeded(vp, prof({ level: 'improver', start: 'fork', rating: 1000, games: [g] }), GAME_OPEN, 'play');
    await page.locator('#tab-play').click(); await page.locator('#reviewBtn').click();
    assert.ok(/Accuracy \d+%/.test(await page.locator('#modeText').innerText()), 'Improver review bar');
    await page.locator('#tab-progress').click();
    assert.ok(/accuracy 72%/.test(await page.locator('#history').innerText()));
    return page;
  }],
  ['D23: a Beginner never reads Stockfish or the engine (play, review, banner, quiz, drill, Progress)', async (vp) => {
    const ENG = /stockfish|engine/i;
    const g = { id: 'g1', d: NOW - DAY, r: 'L', user: 'w', level: 1, acc: 50, counts: {}, tags: { hung: 3, allowedMate: 1 }, sans: ['f3', 'e5', 'g4', 'Qh4#'], ann: {} };
    const graded = Object.assign({}, GAME_OPEN, { fb: { cls: 'best', sym: '!', title: 'Best move', mv: 'You played Nf3', text: 'This develops your knight. Exactly what Stockfish would play.' }, notes: Object.assign({}, GAME_OPEN.notes, { 0: { side: 'u', cls: 'good', text: 'Solid. This claims space in the center. Stockfish slightly preferred ' + CHIP + '.', ev: 20 } }) });
    let page = await seeded(vp, prof({ course: done('rules', 'special', 'board'), games: [g] }), graded, 'play');
    await page.locator('#tab-play').click();
    const vis1 = () => page.locator('.app').innerText();
    assert.ok((await page.locator('#vText').innerText()).includes('Exactly the move I’d play.'));
    assert.ok(!ENG.test(await vis1()), 'play: ' + (await vis1()).match(ENG));
    await page.locator('#reviewBtn').click(); await page.locator('#navFirst').click();
    assert.ok((await page.locator('#vText').innerText()).includes('Every move is explained, yours and Rani’s partner’s.'));
    await page.locator('#navNext').click();
    await page.waitForFunction(() => document.getElementById('vText').innerText.includes('I slightly preferred'));
    assert.ok(!ENG.test(await vis1()), 'review');
    await page.locator('#tab-progress').click();
    const progress = await page.locator('#panel-progress').innerText(), credits = await page.locator('#panel-progress .credit').allInnerTexts();
    assert.ok(progress.includes('where Rani’s partner could take them'), 'Progress weak spot');
    assert.ok(!ENG.test(credits.reduce((t, c) => t.replace(c, ''), progress)), 'Progress (license credits aside)');
    await page.context().close();
    // A lost game: the banner and "Rani's partner to move".
    page = await seeded(vp, prof(), { sans: ['f3', 'e5', 'g4', 'Qh4#'], user: 'w', level: 1, ann: {}, notes: {}, tags: {}, fb: null, opp: null, evalW: 0, t: NOW }, 'play');
    await page.locator('#tab-play').click();
    assert.ok((await page.locator('#banner').innerText()).includes('Rani’s partner wins this one. Review it to find the turning point.'));
    await page.context().close();
    page = await seeded(vp, prof(), { sans: [], user: 'b', level: 1, ann: {}, notes: {}, tags: {}, fb: { cls: 'info', sym: '♙', title: 'Engine to move', mv: 'You play Black', noSan: true }, opp: null, evalW: 0, t: NOW }, 'play');
    await page.locator('#tab-play').click();
    assert.equal((await page.locator('#vTitle').innerText()).trim(), 'Rani’s partner to move');
    await page.context().close();
    // Safe or blunder (D24) and an endgame drill.
    page = await seeded(vp, prof({ course: done('rules', 'special', 'board') }));
    await page.evaluate(() => window.__coach.trainStart('safety'));
    await page.waitForFunction(() => window.__coach.st.mode === 'quiz');
    let sawSafe = false;
    for (let i = 0; i < 8 && !sawSafe; i++) {
      const ses = await page.locator('#sessionCard').innerText();
      assert.ok(/^(White|Black) wants to play this move\.$/m.test(ses), 'D24 title: ' + ses);
      assert.ok(!SAN.test(ses), 'no notation in the quiz: ' + ses);
      await page.locator('#qSafe').click();
      const after = await page.locator('#sessionCard').innerText();
      assert.ok(!ENG.test(after), 'quiz answer: ' + after);
      if (/safe/i.test(await page.evaluate(() => window.__coach.st.ses.msg.title))) sawSafe = /This is the best move here\./.test(after);
      await page.locator('#sessionCard [data-act="next"]').click();
    }
    assert.ok(sawSafe, 'saw a safe item with "This is the best move here."');
    await page.evaluate(() => window.__coach.startPart('kq', 'apply'));
    await page.waitForFunction(() => window.__coach.st.mode === 'drill');
    assert.equal(await page.locator('#oppName').innerText(), PARTNER, 'drill opponent');
    assert.ok((await page.locator('#sessionCard').innerText()).includes('Stuck? Hint shows my idea.'));
    return page;
  }],
  ['D32: a Beginner’s move chips have no notation in title or aria-label; Show everything restores it', async (vp) => {
    const g = Object.assign({}, GAME_OPEN, { fb: { cls: 'good', sym: '✓', title: 'Good move', mv: 'You played Nf3', text: 'Solid. Better was ' + CHIP + '.' } });
    const page = await seeded(vp, prof(), g, 'play');
    await page.locator('#tab-play').click();
    const chip = page.locator('#vText .mvc');
    await page.waitForFunction(() => { const c = document.querySelector('#vText .mvc'); return c && c.dataset.dc; });
    assert.equal(await chip.getAttribute('title'), 'White knight to f3. Tap to see it on the board.');
    assert.equal(await chip.getAttribute('aria-label'), 'White knight to f3');
    await chip.click();
    const tag = await page.locator('#pvTag').innerText();
    assert.ok(!/Nf3/.test(tag) && /White knight to f3/.test(tag), 'preview label: ' + tag);
    assert.equal(await page.locator('.santip').count() === 0 || !(await page.locator('.santip').isVisible()), true, 'no notation tip');
    await page.locator('#settingsBtn').click(); await page.locator('#levelCard [data-act="showall"]').click(); await page.keyboard.press('Escape');
    assert.equal(await page.locator('#vText .mvc').getAttribute('title'), 'Nf3: White knight to f3. Tap to see it on the board.');
    assert.equal(await page.locator('#vText .mvc').getAttribute('aria-label'), 'White knight to f3 (Nf3)');
    return page;
  }],
  ['S1-7: a cloud pull re-render keeps focus and scroll', async (vp) => {
    const club = prof({ level: 'club', start: 'kq', rating: 1300 });
    const page = await seeded(vp, club, null, null, { fn: cloudMock, arg: { prof: club, hold: false } });
    await page.waitForFunction(() => window.__cloud.gets >= 2);
    await page.locator('#roadCard [data-stage="4"]').focus();
    await page.evaluate(() => window.scrollBy(0, -40));
    const y = await page.evaluate(() => window.scrollY), gets = await page.evaluate(() => window.__cloud.gets);
    await page.evaluate(() => { window.__cloud.prof = Object.assign({}, window.__cloud.prof, { course: { kq: { learn: 1 } } }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForFunction((n) => window.__cloud.gets >= n + 2 && window.__coach.getProf().course.kq, gets);
    await page.waitForTimeout(100);
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.stage), '4', 'focus kept');
    assert.ok(Math.abs((await page.evaluate(() => window.scrollY)) - y) <= 2, 'scroll kept');
    return page;
  }],
  ['D-1: a cloud setup error (user.id rejects) shows no start offer and changes nothing', async (vp) => {
    const local = prof({ start: 'board', levelT: NOW - 9 * DAY, course: done('board', 'values', 'mate', 'opening', 'blunder') });
    const page = await seeded(vp, local, null, null, { fn: cloudMock, arg: { prof: null, idFails: true } });
    await page.waitForTimeout(1500);
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'no offer after a failed cloud setup');
    const pr = await getProf(page);
    assert.equal(pr.level, 'beginner'); assert.equal(pr.levelOfferT, 0); assert.equal(pr.levelT, local.levelT);
    return page;
  }],
  ['D-2: the lesson offer waits for the first pull; a newer cloud Club level wins and no offer shows', async (vp) => {
    const local = prof({ start: 'board', levelT: NOW - DAY, levelOfferT: NOW - DAY, course: Object.assign(done('board', 'values', 'mate', 'opening'), { blunder: { practice: 1, apply: 1 } }) });
    const page = await seeded(vp, local, null, null, { fn: cloudMock, arg: { prof: Object.assign({}, local, { level: 'club', start: 'kq', placed: 'chosen', levelT: NOW + 60000 }), hold: true } });
    await page.evaluate(() => window.__coach.startPart('blunder', 'learn'));
    await finishLesson(page);
    await page.waitForTimeout(800);
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'held while the cloud is unsettled');
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => window.__coach.getProf().level === 'club');
    await page.waitForTimeout(800);
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'no offer for a level that changed');
    assert.equal((await getProf(page)).level, 'club');
    return page;
  }],
  ['D-2: the lesson offer waits for the first pull; with no level change it shows after the merge', async (vp) => {
    const local = prof({ start: 'board', levelT: NOW - DAY, levelOfferT: NOW - DAY, course: Object.assign(done('board', 'values', 'mate', 'opening'), { blunder: { practice: 1, apply: 1 } }) });
    const page = await seeded(vp, local, null, null, { fn: cloudMock, arg: { prof: Object.assign({}, local, { t: NOW - 2 * DAY }), hold: true } });
    await page.evaluate(() => window.__coach.startPart('blunder', 'learn'));
    await finishLesson(page);
    await page.waitForTimeout(800);
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'held');
    await page.evaluate(() => window.__release());
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), OFFER_B, 'offered after the merge, ignoring a recent Not yet');
    return page;
  }],
  ['D-2: with no cloud at all a provisional level still gets the lesson offer (Android today)', async (vp) => {
    const page = await seeded(vp, prof({ provisional: true, start: 'board', levelT: NOW - DAY, course: Object.assign(done('board', 'values', 'mate', 'opening'), { blunder: { practice: 1, apply: 1 } }) }));
    await page.evaluate(() => window.__coach.startPart('blunder', 'learn'));
    await finishLesson(page);
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), OFFER_B);
    return page;
  }],
  ['D-3: a retake open at the first pull does not lose the start offer', async (vp) => {
    const local = prof({ start: 'board', levelT: NOW - 9 * DAY, course: done('board', 'values', 'mate', 'opening', 'blunder') });
    const page = await seeded(vp, local, null, null, { fn: cloudMock, arg: { prof: local, hold: true } });
    await page.locator('#settingsBtn').click(); await page.locator('#levelCard [data-act="recheck"]').click();
    assert.equal(await page.evaluate(() => window.Placement.isOpen()), true);
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => window.__cloud.gets >= 2);
    await page.waitForTimeout(500);
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'not over the level check');
    await page.locator('#placement [data-pl="cancel"]').click();
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), OFFER_B, 'offered once the check is closed');
    return page;
  }],
  ['D-4: a late first pull does not pop the start offer mid-lesson; it waits for Home', async (vp) => {
    const local = prof({ start: 'board', levelT: NOW - 9 * DAY, course: done('board', 'values', 'mate', 'opening', 'blunder') });
    const page = await seeded(vp, local, null, null, { fn: cloudMock, arg: { prof: local, hold: true } });
    await page.evaluate(() => window.__coach.startPart('values', 'learn'));
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => window.__cloud.gets >= 2);
    await page.waitForTimeout(800);
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'held during the lesson');
    await page.locator('#tab-coach').click();
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal(await noteText(page), OFFER_B, 'shown when Home opens');
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
        failures++; results.push('FAIL ' + label + '\n     ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n     ') + (process.env.S2A_STACK ? '\n' + e.stack : ''));
      } finally { if (page) await page.context().close(); }
    }
  } finally { await browser.close(); srv.close(); }
  console.log(results.join('\n'));
  console.log('\n' + (results.length - failures) + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})();
