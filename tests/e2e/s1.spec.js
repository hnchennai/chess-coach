// E2E for slice S1 (level check, profile v5, Settings level controls).
// Run: node tests/e2e/s1.spec.js   (serves www/ itself; needs Playwright with Chromium)
const { chromium } = require('playwright');
const { spawn } = require('child_process');
const assert = require('assert/strict');
const path = require('path');
const fs = require('fs');

const WWW = process.env.S1_WWW || path.join(__dirname, '../../www');
const PORT = 8000 + Math.floor(Math.random() * 900);
const URL = 'http://127.0.0.1:' + PORT + '/index.html';
const SHOTS = process.env.S1_SHOTS || '';
const PKEY = 'suresh-chess-coach.profile.v1';
const VIEWPORTS = [{ width: 412, height: 915 }, { width: 1280, height: 900 }].filter((v) => !process.env.S1_VP || String(v.width) === process.env.S1_VP);
const ONLY = process.env.S1_ONLY ? new RegExp(process.env.S1_ONLY) : null;

let browser, results = [], failures = 0;

async function newPage(vp, init) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  if (init) await ctx.addInitScript(init.fn, init.arg);
  const page = await ctx.newPage();
  if (process.env.S1_TIMEOUT) { page.setDefaultTimeout(+process.env.S1_TIMEOUT); page.setDefaultNavigationTimeout(60000); }
  page.errors = [];
  page.on('console', (m) => { if (m.type() === 'error') page.errors.push(m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  await page.goto(URL);
  await page.waitForFunction(() => window.__coach && window.Placement);
  return page;
}
// A stand-in for the Claude account runtime (window.claude), so the cloud path runs offline.
// arg: { prof, hold (wait for window.__release()), failFirst (first profile get rejects), delay (ms before each get answers) }
function cloudMock(arg) {
  if (sessionStorage.getItem('cloudMockSeeded')) { const c = JSON.parse(sessionStorage.getItem('cloudMock')); window.__cloud = c; arg = Object.assign({}, arg, { hold: false, failFirst: false, delay: 0 }); }
  else { sessionStorage.setItem('cloudMockSeeded', '1'); window.__cloud = { prof: arg.prof, game: null, sets: [], gets: 0 }; }
  let release; const gate = new Promise((r) => { release = r; }); window.__release = release; if (!arg.hold) release();
  let failed = false;
  const keep = () => sessionStorage.setItem('cloudMock', JSON.stringify(window.__cloud));
  const doc = (k) => ({
    get: () => gate.then(() => new Promise((res, rej) => setTimeout(() => {
      window.__cloud.gets++;
      if (arg.failFirst && k === 'prof' && !failed) { failed = true; rej(new Error('network')); return; }
      res({ exists: !!window.__cloud[k], data: () => JSON.parse(JSON.stringify(window.__cloud[k])) });
    }, arg.delay || 0))),
    set: (d) => { window.__cloud[k] = JSON.parse(JSON.stringify(d)); window.__cloud.sets.push({ k, at: Date.now() }); keep(); return Promise.resolve(); }
  });
  window.claude = { use: (n) => Promise.resolve(n === 'db' ? { doc: (p) => doc(/profile$/.test(p) ? 'prof' : 'game') } : { id: () => Promise.resolve('u1') }) };
}
const BIG_CLOUD = { v: 5, level: 'club', levelT: 1000, placed: 'chosen', start: 'kq', rating: 1450, rn: 60, games: [{ id: 'gc1', d: 5, r: 'W', sans: ['e4'] }, { id: 'gc2', d: 6, r: 'L', sans: ['d4'] }], puz: { m1: { n: 3, ok: 2 } }, course: { fork: { learn: 1, practice: 1 }, rules: { learn: 1 } }, days: {}, reviewed: ['gc1'], t: 1000 };
async function checkMerged(page) {
  const pr = await prof(page);
  assert.equal(pr.rn, 60); assert.equal(pr.rating, 1450); assert.equal(pr.games.length, 2); assert.deepEqual(pr.course.fork, { learn: 1, practice: 1 });
  assert.equal(pr.level, 'club', 'the provisional check level loses to the chosen cloud level');
  await page.waitForFunction(() => window.__cloud.sets.some((x) => x.k === 'prof'), null, { timeout: 5000 });
  const c = await page.evaluate(() => window.__cloud.prof);
  assert.equal(c.rn, 60, 'cloud rn kept'); assert.equal(c.games.length, 2, 'cloud games kept'); assert.deepEqual(c.course.fork, { learn: 1, practice: 1 }, 'cloud course kept'); assert.deepEqual(c.reviewed, ['gc1']);
}
const prof = (page) => page.evaluate(() => window.__coach.getProf());
const peek = (page) => page.evaluate(() => window.Placement.peek());
const sheetOpen = (page) => page.evaluate(() => window.Placement.isOpen());

async function solve(page) {
  const p = await peek(page);
  assert.equal(p.step, 'puzzle');
  const from = p.sol.slice(0, 2), to = p.sol.slice(2, 4);
  await page.locator('#placement .sq[data-sq="' + from + '"]').click();
  await page.locator('#placement .sq[data-sq="' + to + '"]').click();
  await waitNext(page, p);
}
async function unsure(page) {
  const p = await peek(page);
  await page.locator('#placement [data-pl="unsure"]').click();
  await waitNext(page, p);
}
async function waitNext(page, p) {
  await page.waitForFunction((old) => { const q = window.Placement.peek(); return !q || q.step !== 'puzzle' || q.i !== old.i || q.kind !== old.kind; }, p, { timeout: 5000 });
}
async function answerAll(page, script) { for (const ok of script) { if (ok) await solve(page); else await unsure(page); } }
async function start(page) { await page.locator('#placement [data-pl="start"]').click(); assert.equal(await sheetOpen(page), false); }
const shot = async (page, vp, name) => { if (SHOTS && vp.width === 412) await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };

const cases = [
  ['fresh storage shows Welcome', async (vp) => {
    const page = await newPage(vp);
    await page.waitForSelector('#placement:not([hidden]) .pl-welcome');
    const t = await page.locator('#placement').innerText();
    for (const s of ['Hi, I’m Rani', 'Have you played chess before?', 'Never played', 'I know how the pieces move', 'I play often', 'Skip, I’ll choose later', '5 tiny puzzles, about a minute', '6 puzzles, easy to tricky'])
      assert.ok(t.includes(s), 'welcome shows ' + s);
    assert.ok(!/—/.test(t), 'no em dash');
    await shot(page, vp, 'welcome');
    return page;
  }],
  ['Never played = Beginner at rules, no puzzles', async (vp) => {
    const page = await newPage(vp);
    await page.locator('[data-pl-path="never"]').click();
    const p = await peek(page);
    assert.equal(p.step, 'result'); assert.equal(p.n, 0, 'no puzzles');
    const t = await page.locator('#placement').innerText();
    assert.ok(t.includes('You’re starting as a Beginner'));
    assert.ok(!t.includes('You solved'));
    await start(page);
    const pr = await prof(page);
    assert.equal(pr.level, 'beginner'); assert.equal(pr.start, 'rules'); assert.equal(pr.rating, 600); assert.equal(pr.placed, 'check');
    assert.equal(pr.provisional, true, 'no cloud load here, so provisional');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.level), 'beginner');
    assert.equal(await page.evaluate(() => window.__coach.nextUnit().id), 'rules');
    assert.equal(await page.evaluate(() => window.__coach.st.mode), 'lesson', 'Beginner goes straight into the first lesson');
    assert.equal(await page.evaluate(() => window.__coach.st.ls.unit.id), 'rules');
    assert.equal(await page.evaluate(() => window.__coach.st.tab), 'path');
    return page;
  }],
  ['Know the moves, 3 of 5 = Improver at the first level 2 unit', async (vp) => {
    const page = await newPage(vp);
    await page.locator('[data-pl-path="knows"]').click();
    let p = await peek(page);
    assert.equal(p.n, 5);
    await solve(page);
    await page.waitForFunction(() => !document.querySelector('#placement [data-pl="unsure"]').disabled);
    const t = await page.locator('#placement').innerText();
    assert.ok(t.includes('2 of 5'), 'progress label');
    assert.ok(/You play (White|Black)\./.test(t), 'Rani says which side');
    await shot(page, vp, 'puzzle');
    await answerAll(page, [true, true, false, false]);
    const r = await page.locator('#placement').innerText();
    assert.ok(r.includes('You solved 3 of 5. Nice!'), r);
    assert.ok(r.includes('You’re starting as an Improver'));
    assert.ok(r.includes('You can change this any time in Settings.'));
    assert.equal(await page.locator('[data-pl="club"]').count(), 0, 'no Try Club below 5 of 5');
    await shot(page, vp, 'result');
    await start(page);
    const pr = await prof(page);
    assert.equal(pr.level, 'improver'); assert.equal(pr.start, 'fork'); assert.equal(pr.rating, 1000);
    assert.equal(await page.evaluate(() => window.__coach.nextUnit().id), 'fork');
    assert.equal(Object.keys(pr.course).length, 0, 'nothing marked done');
    assert.equal(await page.evaluate(() => window.__coach.st.tab), 'coach', 'Improver goes to Home');
    assert.equal(await page.evaluate(() => window.__coach.st.mode), 'play');
    return page;
  }],
  ['Know the moves 5 of 5, Try Club, 1 of 2 = Club', async (vp) => {
    const page = await newPage(vp);
    await page.locator('[data-pl-path="knows"]').click();
    await answerAll(page, [true, true, true, true, true]);
    await page.locator('[data-pl="club"]').click();
    const p = await peek(page);
    assert.equal(p.kind, 'club'); assert.equal(p.n, 2);
    await answerAll(page, [false, true]);
    const r = await page.locator('#placement').innerText();
    assert.ok(r.includes('You’re starting as a Club player'), r);
    await start(page);
    const pr = await prof(page);
    assert.equal(pr.level, 'club'); assert.equal(pr.start, 'kq'); assert.equal(pr.rating, 1300);
    return page;
  }],
  ['Play often, 0 of 6 = Beginner at board', async (vp) => {
    const page = await newPage(vp);
    await page.locator('[data-pl-path="often"]').click();
    assert.equal((await peek(page)).n, 6);
    await answerAll(page, [false, false, false, false, false, false]);
    await start(page);
    const pr = await prof(page);
    assert.equal(pr.level, 'beginner'); assert.equal(pr.start, 'board');
    return page;
  }],
  ['Choose a different level on the result screen', async (vp) => {
    const page = await newPage(vp);
    await page.locator('[data-pl-path="never"]').click();
    await page.locator('[data-pl="choose"]').click();
    await page.locator('[data-pl-level="improver"]').click();
    assert.ok((await page.locator('#placement').innerText()).includes('You’re starting as an Improver'));
    await start(page);
    const pr = await prof(page);
    assert.equal(pr.level, 'improver'); assert.equal(pr.placed, 'chosen'); assert.equal(pr.start, 'fork');
    return page;
  }],
  ['Skip at the first question = Beginner at board', async (vp) => {
    const page = await newPage(vp);
    await page.locator('[data-pl="skip0"]').click();
    assert.equal(await sheetOpen(page), false);
    const pr = await prof(page);
    assert.equal(pr.level, 'beginner'); assert.equal(pr.start, 'board');
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.ok((await page.locator('#raniNote').innerText()).includes('You can take the check again in Settings.'));
    assert.equal(await page.evaluate(() => window.__coach.nextUnit().id), 'board');
    assert.equal(await page.evaluate(() => window.__coach.st.mode), 'lesson', 'Skip goes straight into the board lesson');
    assert.equal(await page.evaluate(() => window.__coach.st.ls.unit.id), 'board');
    return page;
  }],
  ['Skip during puzzles after 2 right = Beginner at board', async (vp) => {
    const page = await newPage(vp);
    await page.locator('[data-pl-path="knows"]').click();
    await answerAll(page, [true, true]);
    await page.locator('#placement [data-pl="skip"]').last().click();
    const r = await page.locator('#placement').innerText();
    assert.ok(r.includes('You stopped after 2.'), r);
    assert.ok(!r.includes('You solved'), 'no "solved 2 of 2" next to Beginner');
    assert.ok(r.includes('You’re starting as a Beginner'));
    assert.ok(r.includes('You can take the check again in Settings.'));
    await start(page);
    const pr = await prof(page);
    assert.equal(pr.level, 'beginner'); assert.equal(pr.start, 'board');
    return page;
  }],
  ['v4 player with progress is not asked: Improver + one-time note', async (vp) => {
    const v4 = { v: 4, theme: null, games: [{ id: 'g1', d: 1700000000000, r: 'W', user: 'w', level: 2, sans: ['e4', 'e5'], ann: {} }], puz: {}, rating: 820, rn: 0, course: {}, days: {}, reviewed: [], t: 1700000000000 };
    const page = await newPage(vp, { fn: ([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem('seeded', '1'); } }, arg: [PKEY, v4] });
    assert.equal(await sheetOpen(page), false, 'no level check');
    const pr = await prof(page);
    assert.equal(pr.level, 'improver'); assert.equal(pr.placed, 'derived'); assert.equal(pr.unlockAll, true); assert.equal(pr.start, 'rules');
    assert.equal(pr.games.length, 1, 'game kept'); assert.equal(pr.rating, 820, 'rating kept');
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.equal((await page.locator('#raniNote p').innerText()).trim(), 'You’re set as Improver. Change it any time in Settings.');
    await page.reload(); await page.waitForFunction(() => window.__coach);
    assert.equal(await page.locator('#raniNote').isHidden(), true, 'note shows once');
    assert.equal(await sheetOpen(page), false);
    return page;
  }],
  ['Settings: gear opens the sheet; level change, Show everything, retake cancel', async (vp) => {
    const page = await newPage(vp);
    await page.locator('[data-pl-path="never"]').click();
    await start(page);
    assert.equal(await page.locator('#panel-coach #levelCard').count(), 0, 'level card no longer on Home');
    const gear = page.locator('#settingsBtn');
    assert.equal(await gear.getAttribute('aria-label'), 'Settings');
    const gb = await gear.boundingBox(); assert.ok(gb.width >= 44 && gb.height >= 44, 'gear is 44px');
    await gear.click();
    const sheet = page.locator('#settingsSheet');
    await sheet.waitFor({ state: 'visible' });
    const card = sheet.locator('#levelCard');
    const txt = await sheet.innerText();
    assert.ok(/your level/i.test(txt)); assert.ok(txt.includes('See all tabs, scores and move lists now')); assert.ok(!/notation/i.test(txt));
    await shot(page, vp, 'settings');
    await card.locator('[data-lvset="club"]').click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.level), 'club');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.lvset), 'club', 'focus stays on the picked level');
    let pr = await prof(page);
    assert.equal(pr.level, 'club'); assert.equal(pr.start, 'kq'); assert.equal(pr.placed, 'chosen'); assert.equal(pr.provisional, false, 'Settings picks are never provisional');
    assert.equal(pr.rating, 1300, 'starting rating when no rated puzzles (AC9)');
    assert.equal(await card.locator('[data-lvset="club"]').getAttribute('aria-checked'), 'true');
    await page.keyboard.press('ArrowLeft');
    assert.equal((await prof(page)).level, 'improver', 'arrow keys move the level');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.lvset), 'improver');
    await card.locator('[data-lvset="beginner"]').click();
    pr = await prof(page);
    assert.equal(pr.start, 'rules', 'Beginner from Settings starts at rules');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.showall), undefined);
    await card.locator('[data-act="showall"]').click();
    assert.equal(await page.evaluate(() => document.documentElement.dataset.showall), '1');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.act), 'showall', 'focus stays on the switch');
    assert.equal((await prof(page)).showAll, true);
    assert.equal((await prof(page)).level, 'beginner', 'Show everything keeps the level');
    await page.keyboard.press('Escape');
    await sheet.waitFor({ state: 'hidden' });
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.id), 'settingsBtn', 'focus back on the gear');
    await page.reload(); await page.waitForFunction(() => window.__coach);
    assert.equal(await page.evaluate(() => document.documentElement.dataset.showall), '1', 'survives restart');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.level), 'beginner');
    assert.equal(await sheetOpen(page), false);
    await page.locator('#settingsBtn').click();
    await page.locator('#levelCard [data-act="recheck"]').click();
    assert.equal(await sheetOpen(page), true);
    assert.equal(await page.locator('#settingsSheet').isHidden(), true, 'settings closes for the check');
    await page.locator('#placement [data-pl="cancel"]').click();
    assert.equal(await sheetOpen(page), false);
    assert.equal((await prof(page)).level, 'beginner', 'closing a retake keeps the level');
    return page;
  }],
  ['Retake: Skip, X and Esc cancel and keep the level', async (vp) => {
    const v5 = { v: 5, level: 'club', levelT: 99, placed: 'check', start: 'kq', rating: 1340, rn: 7, games: [], puz: {}, course: {}, days: {}, reviewed: [], t: 99 };
    const page = await newPage(vp, { fn: ([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem('seeded', '1'); } }, arg: [PKEY, v5] });
    const keep = async (what) => { assert.equal(await sheetOpen(page), false, what + ' closes'); const pr = await prof(page); assert.equal(pr.level, 'club', what); assert.equal(pr.levelT, 99, what); assert.equal(pr.start, 'kq', what); };
    const retake = async () => { await page.locator('#settingsBtn').click(); await page.locator('#levelCard [data-act="recheck"]').click(); assert.equal(await sheetOpen(page), true); };
    await retake(); await page.locator('#placement [data-pl="skip0"]').click(); await keep('Skip at the first question');
    await retake(); await page.locator('[data-pl-path="often"]').click(); await page.locator('#placement [data-pl="skip"]').last().click(); await keep('Skip the check');
    await retake(); await page.locator('[data-pl-path="knows"]').click(); await page.locator('#placement .pl-x').click(); await keep('X during puzzles');
    await retake(); await page.locator('[data-pl-path="knows"]').click(); await page.keyboard.press('Escape'); await keep('Esc during puzzles');
    await retake(); await page.locator('[data-pl-path="never"]').click(); await page.keyboard.press('Escape'); await keep('Esc on the result');
    await retake(); await page.locator('[data-pl-path="never"]').click(); await page.locator('#placement [data-pl="cancel"]').click(); await keep('X on the result');
    return page;
  }],
  ['A finished retake sets the new level (rating kept when there are rated puzzles)', async (vp) => {
    const v5 = { v: 5, level: 'beginner', levelT: 99, placed: 'check', start: 'board', rating: 640, rn: 7, games: [], puz: {}, course: { board: { learn: 1, practice: 1 } }, days: {}, reviewed: [], t: 99 };
    const page = await newPage(vp, { fn: ([k, v]) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(k, JSON.stringify(v)); sessionStorage.setItem('seeded', '1'); } }, arg: [PKEY, v5] });
    await page.locator('#settingsBtn').click(); await page.locator('#levelCard [data-act="recheck"]').click();
    await page.locator('[data-pl-path="knows"]').click();
    await answerAll(page, [true, true, true, true, false]);
    await start(page);
    const pr = await prof(page);
    assert.equal(pr.level, 'improver'); assert.equal(pr.start, 'fork'); assert.equal(pr.rating, 640); assert.equal(pr.provisional, false, 'a retake is never provisional');
    assert.deepEqual(pr.course.board, { learn: 1, practice: 1 }, 'lessons untouched');
    return page;
  }],
  ['Try Club: Skip with 0 right stays Improver; Esc after 1 right = Club', async (vp) => {
    let page = await newPage(vp);
    await page.locator('[data-pl-path="knows"]').click();
    await answerAll(page, [true, true, true, true, true]);
    await page.locator('[data-pl="club"]').click();
    await page.locator('#placement [data-pl="skip"]').last().click();
    let r = await page.locator('#placement').innerText();
    assert.ok(r.includes('You’re starting as an Improver'), r);
    assert.ok(r.includes('You can take the check again in Settings.'));
    await start(page);
    assert.equal((await prof(page)).level, 'improver');
    await page.context().close();
    page = await newPage(vp);
    await page.locator('[data-pl-path="knows"]').click();
    await answerAll(page, [true, true, true, true, true]);
    await page.locator('[data-pl="club"]').click();
    await answerAll(page, [true]);
    await page.keyboard.press('Escape');
    r = await page.locator('#placement').innerText();
    assert.ok(r.includes('You’re starting as a Club player'), r);
    await start(page);
    assert.equal((await prof(page)).level, 'club');
    return page;
  }],
  ['Scenario 3: Play often 6 of 6 = Club, rating 1300', async (vp) => {
    const page = await newPage(vp);
    await page.locator('[data-pl-path="often"]').click();
    await answerAll(page, [true, true, true, true, true, true]);
    assert.ok((await page.locator('#placement').innerText()).includes('You solved 6 of 6. Nice!'));
    await start(page);
    const pr = await prof(page);
    assert.equal(pr.level, 'club'); assert.equal(pr.rating, 1300); assert.equal(pr.start, 'kq');
    assert.equal(await page.evaluate(() => window.__coach.st.tab), 'coach', 'Club goes to Home');
    return page;
  }],
  ['Puzzle sheet: one stable live region, focus stays on the board', async (vp) => {
    const page = await newPage(vp);
    await page.locator('[data-pl-path="knows"]').click();
    const live = await page.evaluate(() => { const d = document.querySelector('#placement [role="dialog"]'); const id = d.getAttribute('aria-describedby'); const el = id && document.getElementById(id); if (el) el.__mark = 1; return { id, live: el && el.getAttribute('aria-live') }; });
    assert.ok(live.id, 'dialog has aria-describedby'); assert.equal(live.live, 'polite');
    const p = await peek(page);
    await page.locator('#placement .sq[data-sq="' + p.sol.slice(0, 2) + '"]').click();
    await page.locator('#placement .sq[data-sq="' + p.sol.slice(2, 4) + '"]').click();
    await waitNext(page, p);
    const after = await page.evaluate((id) => { const el = document.getElementById(id); const a = document.activeElement; return { same: !!(el && el.__mark), onBoard: !!(a && a.closest && a.closest('#placement .board')) }; }, live.id);
    assert.ok(after.same, 'live region was not rebuilt');
    assert.ok(after.onBoard, 'focus stays on the board');
    return page;
  }],
  ['Landscape 780x360: the check board and buttons fit', async (vp) => {
    if (vp.width !== 412) return newPage(vp);
    const page = await newPage({ width: 780, height: 360 });
    await page.locator('[data-pl-path="knows"]').click();
    const box = await page.locator('#placement .board').boundingBox();
    const btn = await page.locator('#placement [data-pl="unsure"]').boundingBox();
    assert.ok(box.y >= 0 && box.y + box.height <= 360 + 1, 'board fits: ' + JSON.stringify(box));
    assert.ok(btn.y + btn.height <= 360 + 1, 'buttons visible: ' + JSON.stringify(btn));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'landscape_780x360.png') });
    return page;
  }],
  ['Claude cloud: a chosen cloud level restores on a fresh device and closes the check', async (vp) => {
    const cloudProf = { v: 5, level: 'club', levelT: 1000, placed: 'chosen', start: 'kq', rating: 1400, rn: 12, games: [{ id: 'gc', d: 5, r: 'W', sans: ['e4'] }], puz: {}, course: { fork: { learn: 1 } }, days: {}, reviewed: [], t: 1000 };
    const page = await newPage(vp, { fn: cloudMock, arg: { prof: cloudProf, hold: false } });
    await page.waitForFunction(() => window.__coach.getProf().level === 'club');
    assert.equal(await sheetOpen(page), false, 'check closed');
    const pr = await prof(page);
    assert.equal(pr.start, 'kq'); assert.equal(pr.rating, 1400); assert.equal(pr.provisional, false); assert.equal(pr.games.length, 1);
    await page.waitForSelector('#raniNote:not([hidden])');
    assert.ok((await page.locator('#raniNote').innerText()).includes('Welcome back, I restored your level.'));
    return page;
  }],
  ['Claude cloud: a level answered before the cloud loads is provisional and loses to a chosen cloud level', async (vp) => {
    const cloudProf = { v: 5, level: 'club', levelT: 10, placed: 'chosen', start: 'kq', rating: 1400, rn: 12, games: [], puz: {}, course: {}, days: {}, reviewed: [], t: 10 };
    const page = await newPage(vp, { fn: cloudMock, arg: { prof: cloudProf, hold: true } });
    await page.locator('[data-pl="skip0"]').click();
    let pr = await prof(page);
    assert.equal(pr.level, 'beginner'); assert.equal(pr.provisional, true);
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => window.__coach.getProf().level === 'club');
    pr = await prof(page);
    assert.equal(pr.provisional, false); assert.equal(pr.start, 'kq');
    assert.equal(await page.evaluate(() => document.documentElement.dataset.level), 'club');
    await page.waitForFunction(() => /Welcome back/.test(document.getElementById('raniNote').innerText));
    return page;
  }],
  ['Claude cloud: a provisional level beats a derived cloud level; new level is saved to the cloud', async (vp) => {
    const cloudProf = { v: 4, games: [{ id: 'g9', d: 9, r: 'L', sans: ['d4'] }], puz: {}, rating: 1300, rn: 3, course: {}, days: {}, reviewed: [], t: 5 };
    const page = await newPage(vp, { fn: cloudMock, arg: { prof: cloudProf, hold: true } });
    await page.locator('[data-pl-path="never"]').click();
    await start(page);
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => window.__coach.getProf().provisional === false);
    const pr = await prof(page);
    assert.equal(pr.level, 'beginner'); assert.equal(pr.start, 'rules'); assert.equal(pr.games.length, 1, 'cloud game merged in'); assert.equal(pr.unlockAll, false, 'derived cloud copy does not unlock a chosen Beginner');
    assert.equal(pr.rating, 1300, 'rating follows more rated puzzles');
    await page.waitForFunction(() => window.__cloud.prof && window.__cloud.prof.level === 'beginner', null, { timeout: 5000 });
    return page;
  }],
  ['B1 sync safety: first cloud read fails once, nothing is overwritten', async (vp) => {
    const page = await newPage(vp, { fn: cloudMock, arg: { prof: BIG_CLOUD, failFirst: true, hold: true } });
    await page.locator('[data-pl-path="never"]').click(); await start(page);
    await page.evaluate(() => window.__release());
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => window.__cloud.prof.rn), 60, 'cloud intact while the pull is failing');
    await page.waitForFunction(() => window.__coach.getProf().rn === 60, null, { timeout: 10000 });
    await checkMerged(page);
    return page;
  }],
  ['B1 sync safety: slow first read (2.5s), nothing is overwritten', async (vp) => {
    const page = await newPage(vp, { fn: cloudMock, arg: { prof: BIG_CLOUD, delay: 2500, hold: true } });
    await page.locator('[data-pl-path="never"]').click(); await start(page);
    await page.evaluate(() => window.__release());
    await page.waitForTimeout(1500);
    assert.equal(await page.evaluate(() => window.__cloud.sets.length), 0, 'no push while the read is slow');
    await page.waitForFunction(() => window.__coach.getProf().rn === 60, null, { timeout: 10000 });
    await checkMerged(page);
    return page;
  }],
  ['B1 sync safety: pull released after 1.2s, no push before it', async (vp) => {
    const page = await newPage(vp, { fn: cloudMock, arg: { prof: BIG_CLOUD, hold: true } });
    await page.locator('[data-pl-path="never"]').click(); await start(page);
    await page.waitForTimeout(1200);
    assert.equal(await page.evaluate(() => window.__cloud.sets.length), 0, 'no push before the first pull');
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => window.__coach.getProf().rn === 60, null, { timeout: 10000 });
    await checkMerged(page);
    return page;
  }],
  ['S1 provisional: an offline Settings pick beats an older cloud level', async (vp) => {
    const cloudProf = { v: 5, level: 'beginner', levelT: 10, placed: 'check', start: 'board', rating: 600, rn: 0, games: [], puz: {}, course: {}, days: {}, reviewed: [], t: 10 };
    const v5 = { v: 5, level: 'beginner', levelT: 8, placed: 'check', start: 'board', rating: 600, rn: 0, games: [], puz: {}, course: {}, days: {}, reviewed: [], t: 8 };
    const page = await newPage(vp, { fn: (a) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem(a.k, JSON.stringify(a.v)); sessionStorage.setItem('seeded', '1'); } window.__mockArg = a; }, arg: { k: PKEY, v: v5 } });
    await page.context().addInitScript(cloudMock, { prof: cloudProf, hold: true });
    await page.reload(); await page.waitForFunction(() => window.__coach);
    await page.locator('#settingsBtn').click();
    await page.locator('#levelCard [data-lvset="club"]').click();
    assert.equal((await prof(page)).provisional, false);
    await page.evaluate(() => window.__release());
    await page.waitForFunction(() => window.__cloud.sets.some((x) => x.k === 'prof'), null, { timeout: 10000 });
    assert.equal((await prof(page)).level, 'club');
    assert.equal(await page.evaluate(() => window.__cloud.prof.level), 'club');
    return page;
  }],
  ['Existing app still works: play a move, engine replies; lesson opens; 3D toggle', async (vp) => {
    const page = await newPage(vp);
    await page.locator('[data-pl="skip0"]').click();
    await page.locator('#raniNote [data-act="notedone"]').click();
    await page.locator('#tab-play').click();
    await page.locator('#panel-play [data-act="close"]').click();
    await page.locator('#board .sq[data-sq="e2"]').click();
    await page.locator('#board .sq[data-sq="e4"]').click();
    await page.waitForFunction(() => window.__coach.st.mode === 'play' && !window.__coach.st.busy && document.querySelectorAll('#moves td.clk').length >= 2, null, { timeout: 20000 });
    await page.locator('#tab-path').click();
    if (await page.locator('#levels').isVisible()) await page.locator('#levels [data-unit="board"]').first().click();
    await page.locator('#panel-path [data-part="learn"]:visible').first().click();
    assert.equal(await page.evaluate(() => window.__coach.st.mode), 'lesson');
    await page.locator('#v3dBtn').click();
    await page.waitForFunction(() => { const b = document.getElementById('v3dBtn'); return /2D view|3D unavailable/.test(b.textContent) && !document.querySelector('.b3d.loading'); }, null, { timeout: 20000 });
    return page;
  }]
];

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--bind', '127.0.0.1'], { cwd: WWW, stdio: 'ignore' });
  await new Promise((r) => setTimeout(r, 700));
  browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) for (const [name, fn] of cases) {
      if (ONLY && !ONLY.test(name)) continue;
      const label = vp.width + 'x' + vp.height + ' ' + name;
      let page;
      try {
        page = await fn(vp);
        const errs = page.errors;
        assert.deepEqual(errs, [], 'console errors');
        results.push('ok   ' + label);
      } catch (e) {
        failures++; results.push('FAIL ' + label + '\n     ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n     '));
      } finally { if (page) await page.context().close(); }
    }
  } finally { await browser.close(); srv.kill(); }
  console.log(results.join('\n'));
  console.log('\n' + (results.length - failures) + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})();
