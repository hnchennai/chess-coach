// E2E for slice D1 of the daily puzzle (docs/specs/daily-puzzle.product.md): the Daily puzzle card on Home. DP-D1, DP-D2,
// DP-D5, DP-D6, DP-D9, the card's wording, scenarios 1, 2, 3, 4 and 9, acceptance criteria 1, 2, 3, 4, 10 and 11.
// Not in this slice (D2): the reminder offer, notifications, the Settings switch and the rating ask.
// Every case runs on the web build (no Capacitor), which is scenario 9: the card works the same there.
// Run: DP_VP=412 node tests/e2e/daily.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// DP_VP: 360 | 412 | 1280. DP_ONLY=<regex> runs matching cases. Built on the helpers of g2.spec.js.
const assert = require('assert/strict');
const G = require('./g2.spec.js');
const { newPage, st, visibleIds, goTab, closeX, solvePuzzle, idle, prof, improver, club, done, played, PH, NOW, DAY, PKEY } = G;

const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }].filter((v) => !process.env.DP_VP || String(v.width) === process.env.DP_VP);
const ONLY = process.env.DP_ONLY ? new RegExp(process.env.DP_ONLY) : null;
const FOUND = ['rules', 'special', 'board', 'values', 'mate', 'opening', 'blunder'];
const dkey = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const TODAY = dkey(0);
// The signed wording, letter for letter (the app's apostrophe).
const W = { kicker: 'Daily puzzle', title: 'Today’s puzzle', line: 'One puzzle at your level. About a minute.', button: 'Solve it',
  solved: 'Solved. A new one tomorrow.', missed: 'Not this time. It’s in your missed puzzles. A new one tomorrow.' };
const BANK = (() => { const c = { window: {} }; require('vm').runInNewContext(require('fs').readFileSync(require('path').join(__dirname, '../../www/js/puzzles.js'), 'utf8'), c); return c.window.PUZZLE_BANK; })();
const WIN1 = { id: 'gw', d: NOW - DAY, r: 'W', user: 'b', level: 1, acc: 80, counts: {}, tags: {}, sans: ['f3', 'e5', 'g4', 'Qh4#'], ann: {} };

// The Daily puzzle card as the player sees it (null when it is not on screen).
const card = (page, sel) => page.evaluate((s) => {
  const el = document.querySelector(s), on = (e) => !!e && e.getClientRects().length > 0; if (!on(el)) return null;
  const tx = (q) => { const e = el.querySelector(q); return on(e) ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
  const bs = [...el.querySelectorAll('button')].filter(on), b = bs[0], r = el.getBoundingClientRect();
  return { kicker: tx('.bh-kick'), title: tx('.bh-title'), line: tx('.dp-line'), button: b ? b.textContent.trim() : null, buttons: bs.length, type: b ? b.getAttribute('type') : null,
    primary: b ? b.classList.contains('primary') : null, bh: b ? b.getBoundingClientRect().height : 0, bw: b ? b.getBoundingClientRect().width : 0,
    heading: !!el.querySelector('h3.bh-title'), icon: el.querySelector('.bh-ic') ? el.querySelector('.bh-ic').getAttribute('aria-hidden') : null,
    top: r.top, bottom: r.bottom, left: r.left, right: r.right, vw: window.innerWidth, scrollW: document.documentElement.scrollWidth, text: el.innerText };
}, sel);
const profNow = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__coach.getProf())));
const saved = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), PKEY);
const reload = async (page) => { await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement); };
const primaries = (page) => page.evaluate(() => [...document.querySelectorAll('#panel-coach .btn.primary')].filter((e) => e.getClientRects().length).length);
// Tap Solve it; the daily puzzle's board comes up.
async function solveIt(page, sel) {
  await page.locator(sel + ' button').click();
  await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && s.opts && s.opts.daily && window.__coach.st.pz; });
}
// After the puzzle: Next, then the end card.
async function toEnd(page) {
  await page.locator('#sessionCard [data-act="next"]').click();
  await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished);
  return page.evaluate(() => {
    const c = document.getElementById('sessionCard'), on = (e) => !!e && e.getClientRects().length > 0, tx = (q) => { const e = c.querySelector(q); return on(e) ? e.textContent.replace(/\s+/g, ' ').trim() : null; };
    return { title: tx('.ec-title'), text: tx('.ec-text'), main: tx('.ec-main'), small: [...c.querySelectorAll('.ec-small')].filter(on).map((b) => b.textContent.trim()), primaries: [...c.querySelectorAll('.btn.primary')].filter(on).length };
  });
}
const goHome = async (page) => { await page.locator('#sessionCard [data-act="home"]').click(); await page.waitForFunction(() => window.__coach.st.tab === 'coach'); };
// A wrong move in puzzle m0 (Ng5-e6+ forks king and queen): Rb1-a1 gives the win away.
const M0 = 'm0', M0_WRONG = ['b1', 'a1'];
async function miss(page) {
  await page.waitForFunction(() => { const z = window.__coach.st.pz; return z && !z.wait && !window.__coach.st.busy; });
  await page.locator('#board .sq[data-sq="' + M0_WRONG[0] + '"]').click();
  await page.locator('#board .sq[data-sq="' + M0_WRONG[1] + '"]').click();
  await page.waitForFunction(() => { const z = window.__coach.st.pz; return z && z.done; }, null, { timeout: 30000 });
}

// A fixed local time, for the clock cases: 25 Nov, h:m:s.
const at = (d, h, m, s) => new Date(2026, 10, d, h, m, s || 0).getTime();
const K25 = '2026-11-25', K26 = '2026-11-26';
const cases = [
  // ---------- AC1, DP-D1, DP-D9, wording, AC11 ----------
  ['AC1: Improver, Club and Show-everything Home show the card under the Continue card, as signed; one-handed; one primary button', async (vp) => {
    let page;
    for (const [who, p] of [['improver', improver({ rating: 1100 })], ['club', club()], ['beginner, Show everything', prof({ showAll: true, unlockAll: true, course: done('rules', 'special') })]]) {
      if (page) await page.context().close();
      page = await newPage(vp, p);
      if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
      const c = await card(page, '#dailyCard');
      assert.ok(c, who + ': the card is on Home');
      assert.deepEqual([c.kicker, c.title, c.line, c.button], [W.kicker, W.title, W.line, W.button], who + ': the signed wording');
      assert.equal(c.buttons, 1); assert.equal(c.type, 'button', who + ': a real button');
      assert.equal(c.heading, true, who + ': its title is a heading'); assert.equal(c.icon, 'true', who + ': the icon is decoration');
      assert.equal(c.primary, false, who + ': the Continue card keeps the one primary button (F-D28)');
      assert.equal(await primaries(page), 1, who + ': exactly one primary button on Home');
      assert.ok(!/—/.test(c.text), who + ': no em dash');
      const ids = (await visibleIds(page, '#panel-coach > *'));
      assert.deepEqual(ids.slice(0, 3), ['contCard', 'dailyCard', 'stageHero'], who + ': DP-D9 under the Continue card');
      if (await page.locator('#homeSlot').isVisible()) assert.equal(ids[ids.length - 1], 'homeSlot', who + ': the tip slot stays last');
      assert.ok(c.bh >= 44, who + ': a thumb-sized button (' + c.bh + ')');
      assert.ok(c.right <= c.vw && c.left >= 0 && c.scrollW <= c.vw, who + ': inside the screen, no sideways scroll');
      const pr = await saved(page);
      assert.equal(pr.daily.d, TODAY, who + ': today’s puzzle is chosen and saved'); assert.equal(pr.daily.r, null);
    }
    return page;
  }],
  ['AC1, scenario 4: Beginner Home shows the card only once Foundations is done (Beat, then Keep practising), under the main card', async (vp) => {
    let page = await newPage(vp, prof({ course: done('rules', 'special'), days: played(1) }));
    assert.equal(await page.locator('#bhome').isVisible(), true);
    assert.equal(await card(page, '.dp-card'), null, 'lesson 3 of 7: one next step only, no daily card');
    assert.equal((await profNow(page)).daily.d, null, 'and no puzzle is picked for it');
    for (const [kind, p] of [['beat', prof({ course: done(...FOUND), days: played(1), unlockAll: true })], ['practice', prof({ course: done(...FOUND), days: played(1), unlockAll: true, games: [WIN1] })]]) {
      await page.context().close();
      page = await newPage(vp, p);
      const c = await card(page, '#dailyBHome');
      assert.ok(c, kind + ': the card is on Beginner Home');
      assert.deepEqual([c.kicker, c.title, c.line, c.button], [W.kicker, W.title, W.line, W.button], kind);
      assert.equal(c.primary, false, kind + ': the main card keeps the one primary button');
      const main = await page.evaluate(() => document.querySelector('#bhome > .bh-card').getBoundingClientRect().bottom);
      assert.ok(c.top >= main, kind + ': under the main card');
      const order = await page.evaluate(() => [...document.querySelectorAll('#bhome > *')].filter((e) => e.getClientRects().length).map((e) => e.id || e.className));
      const mi = order.indexOf('card bh-card'), di = order.indexOf('dailyBHome');
      assert.equal(di, mi + 1, kind + ': directly under the main card: ' + order);
      if (order.includes('btn big bh-alt')) assert.ok(order.indexOf('btn big bh-alt') > di, kind + ': above "Just play a game"');
      assert.ok(c.bh >= 44 && c.right <= c.vw && c.scrollW <= c.vw, kind + ': one-handed, no sideways scroll');
      assert.equal(await page.locator('#homeSlot').evaluate((e) => !e.nextElementSibling), true, kind + ': the tip slot is still the last thing on Home');
    }
    return page;
  }],
  // ---------- scenario 1, AC2, AC3, AC4 (solve) ----------
  ['Scenario 1: Solve it gives one puzzle near the rating; solving counts as one rated puzzle; the card says Solved until midnight', async (vp) => {
    const page = await newPage(vp, improver({ rating: 1100, rn: 25, days: played(1) }));
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    const before = await profNow(page), id = before.daily.id;
    const p = await page.evaluate((i) => window.__coach.PZ.filter((x) => x.id === i)[0], id);
    assert.ok(p && !p.hand && Math.abs(p.rating - 1100) <= 120, 'DP-D2: near the puzzle rating (' + (p && p.rating) + ')');
    assert.ok(!(before.puz[id] && before.puz[id].ok), 'not one already solved');
    await solveIt(page, '#dailyCard');
    const s = await page.evaluate(() => { const s = window.__coach.st.ses; return { count: s.count, id: s.items[0].id, title: s.title }; });
    assert.deepEqual(s, { count: 1, id, title: W.kicker }, 'a 1-puzzle set with today’s puzzle');
    const meta = await page.locator('#sessionCard .meta span').first().innerText();
    assert.equal(meta, W.kicker, 'fix 5: the header says Daily puzzle, not 1 of 1');
    if (PH(vp)) assert.equal(await page.locator('#actPlace').innerText(), W.kicker, 'and so does the Close bar');
    await solvePuzzle(page);
    assert.equal(await page.locator('#sessionCard [data-act="retry"]').count(), 0);
    const e = await toEnd(page);
    assert.equal(e.title, W.title); assert.equal(e.text, W.solved, 'the end card says it was solved');
    assert.equal(e.main, '10 more puzzles', 'DP-D11: the main button'); assert.deepEqual(e.small, ['Home'], 'and a small Home; no "Go again"');
    assert.equal(e.primaries, 1, 'one primary button');
    const after = await saved(page);
    assert.equal(after.rn, before.rn + 1, 'AC3: one rated puzzle'); assert.ok(after.rating > before.rating, 'the puzzle rating goes up');
    assert.equal(after.puz[id].ok, 1);
    assert.deepEqual([after.days[TODAY].puz, after.days[TODAY].solved], [1, 1], 'the day’s puzzle count');
    assert.deepEqual(after.daily, { d: TODAY, id, r: 'solved', n: 1 }, 'the result and the finished count (D2’s hook)');
    await goHome(page);
    let c = await card(page, '#dailyCard');
    assert.deepEqual([c.kicker, c.title, c.line, c.buttons], [W.kicker, W.title, W.solved, 0], 'the card shows the result, with no button');
    const today = await page.locator('#today').innerText();
    assert.ok(/1 of 10 today\./.test(today), 'Today’s Train step: 1 of 10');
    assert.ok(/Streak\s+2 days/.test(today), 'the streak counts today: ' + today.replace(/\s+/g, ' '));
    await reload(page);
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    c = await card(page, '#dailyCard');
    assert.equal(c.line, W.solved, 'scenario 2: still Solved after a restart'); assert.equal((await saved(page)).daily.id, id, 'the same puzzle');
    return page;
  }],
  // ---------- scenario 2, AC2, AC4 ----------
  ['Scenario 2: the same puzzle all day, even after restarts; a new one on the next day', async (vp) => {
    let page = await newPage(vp, club({ daily: { d: dkey(1), id: M0, r: 'solved', n: 3 } }));
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    let c = await card(page, '#dailyCard');
    assert.deepEqual([c.line, c.button], [W.line, W.button], 'yesterday’s result is over: a new puzzle is offered');
    const d1 = (await saved(page)).daily;
    assert.equal(d1.d, TODAY); assert.notEqual(d1.id, M0, 'not yesterday’s puzzle'); assert.equal(d1.r, null); assert.equal(d1.n, 3, 'the finished count is kept');
    await reload(page);
    assert.equal((await saved(page)).daily.id, d1.id, 'after a restart: the same puzzle');
    await solveIt(page, '#dailyCard');
    assert.equal(await page.evaluate(() => window.__coach.st.ses.items[0].id), d1.id);
    return page;
  }],
  // ---------- scenario 3, AC3, AC4 (miss) ----------
  ['Scenario 3: a wrong move counts as one missed rated puzzle, goes to the missed list, and the card says so; no second try', async (vp) => {
    const page = await newPage(vp, improver({ rating: 1000, rn: 25, days: played(1), daily: { d: TODAY, id: M0, r: null, n: 1 } }));
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    const before = await profNow(page);
    await solveIt(page, '#dailyCard');
    await miss(page);
    assert.equal(await page.evaluate(() => window.__coach.st.ses.ok), false, 'it was a miss');
    await page.waitForFunction(() => document.querySelector('#sessionCard [data-act="next"]'));
    assert.equal(await page.locator('#sessionCard [data-act="retry"]').count(), 0, 'one try a day: no "Try again"');
    const e = await toEnd(page);
    assert.equal(e.title, W.title); assert.equal(e.text, W.missed, 'the end card says it was not this time');
    assert.equal(e.main, '10 more puzzles'); assert.deepEqual(e.small, ['Home']);
    const after = await saved(page);
    assert.equal(after.rn, before.rn + 1); assert.ok(after.rating < before.rating, 'the puzzle rating goes down');
    assert.deepEqual([after.puz[M0].n, after.puz[M0].ok, after.puz[M0].box], [1, 0, 0], 'a miss, as in a rated set');
    assert.ok(after.puz[M0].due > Date.now() && after.puz[M0].due <= Date.now() + DAY + 60000, 'in the missed list from tomorrow, as a rated-set miss');
    assert.deepEqual([after.days[TODAY].puz, after.days[TODAY].solved], [1, 0]);
    assert.deepEqual(after.daily, { d: TODAY, id: M0, r: 'missed', n: 2 });
    await goHome(page);
    const c = await card(page, '#dailyCard');
    assert.deepEqual([c.line, c.buttons], [W.missed, 0], 'the missed line until midnight, no second try');
    await reload(page);
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    assert.equal((await card(page, '#dailyCard')).line, W.missed, 'after a restart too');
    return page;
  }],
  // ---------- AC4: leaving mid-puzzle ----------
  ['AC4: leaving mid-puzzle with no result: the card still offers it, and it comes back (also after a restart) and still counts as today’s', async (vp) => {
    const page = await newPage(vp, club({ daily: { d: TODAY, id: M0, r: null, n: 0 } }));
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    await solveIt(page, '#dailyCard');
    await page.waitForFunction(() => { const z = window.__coach.st.pz; return z && !z.wait; });
    if (PH(vp)) await closeX(page); // Close lands on Train, where the puzzle waits (G2b)
    await goTab(page, 'coach');
    let c = await card(page, '#dailyCard');
    assert.deepEqual([c.line, c.button], [W.line, W.button], 'still offered');
    assert.equal((await saved(page)).daily.r, null, 'no result yet');
    await reload(page);
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    c = await card(page, '#dailyCard');
    assert.equal(c.button, W.button, 'after a restart: still offered');
    await solveIt(page, '#dailyCard');
    assert.equal(await page.evaluate(() => window.__coach.st.ses.items[0].id), M0, 'the same puzzle');
    await solvePuzzle(page);
    assert.deepEqual((await saved(page)).daily, { d: TODAY, id: M0, r: 'solved', n: 1 }, 'its result is today’s daily result');
    return page;
  }],
  // ---------- DP-D5, DP-D6: today's daily puzzle stays fresh for its one try ----------
  ['DP-D5: a rated set never deals today’s daily puzzle before it is tried', async (vp) => {
    // every bank puzzle within 120 of m0's rating is solved but m0 and one other, so a rated set would deal m0 half the time
    const near = BANK.filter((p) => Math.abs(p.r - 949) <= 120 && 'm' + p.i !== M0), other = 'm' + near[0].i, puz = {};
    near.slice(1).forEach((p) => { puz['m' + p.i] = { n: 1, ok: 1, box: 5, due: NOW + 30 * DAY }; });
    const page = await newPage(vp, improver({ rating: 949, rn: 25, puz, daily: { d: TODAY, id: M0, r: null, n: 0 } }));
    const ids = await page.evaluate(() => {
      const out = new Set();
      for (let k = 0; k < 40; k++) { window.__coach.trainStart('rated'); out.add(window.__coach.st.ses.items[0].id); }
      return [...out];
    });
    assert.deepEqual(ids, [other], 'never m0 in 40 rated starts');
    return page;
  }]
];

// ---------- fix round 1 ----------
cases.push(
  ['Fix 1: opening Home on a new day keeps prof.t (no profile write before the cloud pull); the pick is still kept on the device', async (vp) => {
    const T = NOW - DAY;
    const page = await newPage(vp, improver({ t: T, daily: { d: dkey(1), id: M0, r: 'solved', n: 1 } }));
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    assert.equal((await card(page, '#dailyCard')).button, W.button);
    const p = await saved(page);
    assert.equal(p.t, T, 'prof.t is not bumped by opening Home');
    assert.equal(p.daily.d, TODAY, 'today’s pick is kept on the device all the same (AC2)');
    await reload(page);
    assert.equal((await saved(page)).daily.id, p.daily.id, 'the same pick after a restart'); assert.equal((await saved(page)).t, T);
    return page;
  }],
  ['Fix 3b: the end card’s "10 more puzzles" starts a rated set', async (vp) => {
    const page = await newPage(vp, club({ daily: { d: TODAY, id: M0, r: null, n: 0 } }));
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    await solveIt(page, '#dailyCard'); await solvePuzzle(page); await toEnd(page);
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && s.rated && s.count === 10; });
    assert.equal(await page.evaluate(() => !!window.__coach.st.ses.opts.daily), false, 'a plain rated set');
    return page;
  }],
  ['Fix 4: a restart after the result is counted but before Next: no double count, and it comes back as it ended', async (vp) => {
    const page = await newPage(vp, club({ rn: 30, days: played(1), daily: { d: TODAY, id: M0, r: null, n: 0 } }));
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    const before = await profNow(page);
    await solveIt(page, '#dailyCard'); await solvePuzzle(page);
    const one = await saved(page);
    assert.equal(one.rn, before.rn + 1);
    await reload(page);
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    assert.equal((await card(page, '#dailyCard')).line, W.solved, 'Home: solved');
    await goTab(page, 'train');
    await page.locator('#resumeTrain .rs-go, #panel-train [data-act="resume"]').first().click();
    await page.waitForFunction(() => window.__coach.st.pz && window.__coach.st.pz.done);
    const e = await toEnd(page);
    assert.equal(e.text, W.solved);
    const two = await saved(page);
    assert.deepEqual([two.rn, two.days[TODAY].puz, two.daily.n, two.puz[M0].n], [one.rn, 1, 1, 1], 'counted once');
    return page;
  }],
  ['Fix 3a / DP-D12: dealt before midnight, solved after: it counts for the day it was dealt; the end card says today’s is on Home', async (vp) => {
    const page = await newPage(vp, club({ days: {}, daily: { d: K25, id: M0, r: null, n: 4 } }), { clock: at(25, 23, 59, 0) });
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    await solveIt(page, '#dailyCard');
    await page.clock.setSystemTime(at(26, 0, 0, 30));
    await solvePuzzle(page);
    const e = await toEnd(page);
    assert.equal(e.text, 'Solved. Today’s new puzzle is on Home.');
    assert.deepEqual((await saved(page)).daily, { d: K25, id: M0, r: 'solved', n: 5 }, 'the dealt day’s record, n up by one');
    await page.locator('#sessionCard [data-act="home"]').click();
    await page.waitForFunction(() => window.__coach.st.tab === 'coach');
    const c = await card(page, '#dailyCard');
    assert.deepEqual([c.line, c.button], [W.line, W.button], 'Home: the new day’s puzzle');
    const d = (await profNow(page)).daily;
    assert.equal(d.d, K26); assert.notEqual(d.id, M0); assert.equal(d.n, 5);
    return page;
  }],
  ['Fix 3a / DP-D12: Home turned over first, then the old one is missed: n goes up, the new day stays to do', async (vp) => {
    const page = await newPage(vp, club({ days: {}, daily: { d: K25, id: M0, r: null, n: 0 } }), { clock: at(25, 23, 59, 0) });
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    await solveIt(page, '#dailyCard');
    await page.waitForFunction(() => { const z = window.__coach.st.pz; return z && !z.wait; });
    if (PH(vp)) await closeX(page);
    await goTab(page, 'coach');
    await page.clock.runFor(120000); // midnight passes on Home
    await page.waitForFunction(() => window.__coach.getProf().daily.d === '2026-11-26');
    await goTab(page, 'train');
    if (PH(vp)) await page.locator('#resumeTrain .rs-go').click(); // wide: it stayed on the board beside the tabs
    await miss(page);
    const e = await toEnd(page);
    assert.equal(e.text, 'Not this time. It’s in your missed puzzles. Today’s new puzzle is on Home.');
    const d = (await saved(page)).daily;
    assert.deepEqual([d.d, d.r, d.n], [K26, null, 1], 'the new day is untouched; one more finished');
    return page;
  }],
  ['Fix 3c: Home turns over at local midnight with no tab switch, and when the app comes back to the front', async (vp) => {
    const page = await newPage(vp, club({ days: {}, daily: { d: K25, id: M0, r: 'solved', n: 1 } }), { clock: at(25, 23, 59, 50) });
    if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
    assert.equal((await card(page, '#dailyCard')).line, W.solved);
    await page.clock.runFor(20000);
    let c = await card(page, '#dailyCard');
    assert.deepEqual([c.line, c.button], [W.line, W.button], 'midnight: the new puzzle, by itself');
    await page.evaluate(() => { const d = window.__coach.getProf().daily; d.r = 'solved'; });
    await page.clock.setSystemTime(at(27, 9, 0, 0)); // the phone slept through the next midnight
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => window.__coach.getProf().daily.d === '2026-11-27');
    c = await card(page, '#dailyCard');
    assert.deepEqual([c.line, c.button], [W.line, W.button], 'back to the front: the new puzzle');
    return page;
  }]
);

if (require.main === module) G.run(cases, VIEWPORTS, ONLY);
