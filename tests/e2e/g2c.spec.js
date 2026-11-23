// E2E for slice G2c (docs/specs/board-screens.product.md): the phone's back button. G-D9, G-D18 (back acts as Close through
// @capacitor/app), G-D27 (a review opened mid-game goes back to the game), G-D38 (a tab page opens Home; Home leaves the app),
// G-D39 (wide screens never end or park what is on the board), G-D40 (the order), scenario 7. Design: board-screens.tech.md,
// section 16. The native App plugin is replaced by a fake window.Capacitor.Plugins.App that records addListener and
// minimizeApp; a case presses back by calling the recorded backButton listener, as the plugin does on Android.
// Built on the helpers of g2.spec.js.
// Run: G2C_VP=412 node tests/e2e/g2c.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// G2C_VP: 360 | 412 | 1280. G2C_ONLY=<regex> runs matching cases.
const assert = require('assert/strict');
const G = require('./g2.spec.js');
const { newPage, st, hist, look, resume, visibleIds, goTab, closeX, move, solvePuzzle, idle, club, PH, WORDS, GAME12, SANS22, MATE1 } = G;

const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }].filter((v) => !process.env.G2C_VP || String(v.width) === process.env.G2C_VP);
const ONLY = process.env.G2C_ONLY ? new RegExp(process.env.G2C_ONLY) : null;
const RKEY = 'suresh-chess-coach.resume.v1';

// The fake native App plugin. cfg: web (the bridge says this is not the native app), none (no App plugin at all), throws
// (addListener throws), rejects (addListener's promise is rejected), minRejects (minimizeApp's promise is rejected).
// It joins a fake Capacitor that is already there (the ads fake), as the real bridge holds every plugin.
function fakeApp(cfg) {
  const C = cfg || {};
  const A = window.__app = { ls: {}, calls: [] };
  const P = {
    addListener(n, f) {
      A.calls.push('addListener:' + n);
      if (C.throws) throw new Error('addListener failed');
      (A.ls[n] = A.ls[n] || []).push(f);
      return C.rejects ? Promise.reject(new Error('addListener rejected')) : Promise.resolve({ remove() {} });
    },
    minimizeApp() { A.calls.push('minimizeApp'); return C.minRejects ? Promise.reject(new Error('minimizeApp rejected')) : Promise.resolve(); }
  };
  const cap = window.Capacitor || (window.Capacitor = { isNativePlatform: () => !C.web, getPlatform: () => (C.web ? 'web' : 'android'), Plugins: {} });
  cap.Plugins = cap.Plugins || {};
  if (!C.none) cap.Plugins.App = P;
}
const APP = (cfg) => [fakeApp, cfg || {}];
const page0 = (vp, p, o) => newPage(vp, p, Object.assign({ init: APP() }, o || {}));
// The phone's back button: the plugin calls every backButton listener with { canGoBack }.
const back = (page) => page.evaluate(() => {
  const ls = window.__app.ls.backButton || [];
  if (ls.length !== 1) throw new Error('backButton listeners: ' + ls.length);
  ls[0]({ canGoBack: false });
});
const calls = (page) => page.evaluate(() => window.__app.calls.slice());
const mins = async (page) => (await calls(page)).filter((c) => c === 'minimizeApp').length;
const focusId = (page) => page.evaluate(() => (document.activeElement && document.activeElement.id) || null);
const sheetOpen = (page) => page.evaluate(() => !document.getElementById('settingsSheet').hidden);
const noteUp = (page) => page.evaluate(() => { const n = document.getElementById('raniNote'); return !n.hidden && n.getClientRects().length > 0; });
const firstOn = async (page, tab) => (await visibleIds(page, '#panel-' + tab + ' > *'))[0];
// Everything Close decides, in one step: the screen, the tab, what is on the board, what waits, the first card, focus.
const outcome = (page) => page.evaluate((k) => {
  const c = window.__coach.st, de = document.documentElement, on = (e) => !!e && e.getClientRects().length > 0, a = document.activeElement;
  return { scr: de.dataset.scr || null, end: de.dataset.scrend || null, stScr: c.scr, tab: c.tab, mode: c.mode, sans: window.__coach.hist().length, ses: !!c.ses, ls: !!c.ls, rv: !!c.rv,
    // rated puzzles are dealt at random: the ids differ between two pages, their number does not
    park: JSON.stringify(c.park).replace(/"items":\[[^\]]*\]/g, (m) => '"items":' + JSON.parse(m.slice(8)).length),
    saved: (localStorage.getItem(k) || '').replace(/"items":\[[^\]]*\]/g, (m) => '"items":' + JSON.parse(m.slice(8)).length), first: [...document.querySelectorAll('#panel-' + c.tab + ' > *')].filter(on).map((e) => e.id)[0] || null,
    focus: a ? (a.id || a.className) : null, boardOn: on(document.querySelector('.boardcol')) && on(document.getElementById('board')) };
}, RKEY);
// Back and Close from the same start, on two pages: the outcome must be the same.
async function sameAsClose(vp, p, o, setup) {
  const A = await page0(vp, p, o); await setup(A);
  assert.equal((await look(A)).scr, 'act', 'the board screen is open before back');
  const B = await page0(vp, p, o); await setup(B);
  await back(A); await closeX(B);
  const a = await outcome(A), b = await outcome(B);
  assert.deepEqual(a, b, 'back does what Close does');
  assert.equal(await mins(A), 0, 'back closed the board screen and did not leave the app');
  await B.context().close();
  return { page: A, out: a };
}
const startSet = async (page) => {
  await goTab(page, 'train'); await page.locator('#ratedBtn').click();
  await solvePuzzle(page);
  await page.locator('#sessionCard [data-act="next"]').click();
  await page.waitForFunction(() => { const c = window.__coach.st; return c.ses && c.ses.i === 1 && c.pz && !c.pz.done && !c.pz.wait && !c.busy; }, null, { timeout: 20000 });
};
const openGame = async (page) => { await goTab(page, 'play'); await page.locator('#resumePlay .rs-go').click(); await idle(page); };
const lessonAt = async (page, unit, clicks) => {
  await page.evaluate((u) => window.__coach.startPart(u, 'learn'), unit);
  await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
  for (let i = 0; i < clicks; i++) await page.locator('#navNext').click();
};
const startDrill = async (page) => { await goTab(page, 'train'); await page.locator('#drillList [data-drill]').first().click(); await idle(page); };
const toPuzzleStep = async (page) => {
  await page.evaluate(() => window.__coach.openPlacement(false));
  await page.locator('#placement [data-pl-path="knows"]').click();
  await page.waitForFunction(() => window.Placement.peek() && window.Placement.peek().step === 'puzzle');
};

const cases = [
  // ---------- G-D18: the listener ----------
  ['G-D18: in the native app with the App plugin, one backButton listener is added at start, and nothing else is called', async (vp) => {
    const page = await page0(vp, club());
    assert.deepEqual(await calls(page), ['addListener:backButton']);
    assert.equal(await page.evaluate(() => typeof window.__coach.backPressed), 'function', 'exposed on the test hook');
    return page;
  }],

  // ---------- G-D9, G-D40 step 4: on a phone's board screen back is Close ----------
  ['Scenario 7: Meera presses back during a puzzle set: it closes like Close, and "Resume puzzles" is first on Train', async (vp) => {
    if (!PH(vp)) {
      // G-D39: wide, the same press opens Home and the set stays on the board, not parked
      const page = await page0(vp, club()); await startSet(page);
      const pid = await page.evaluate(() => window.__coach.st.pz.p.id);
      await back(page);
      const L = await look(page);
      assert.deepEqual([L.tab, L.mode, L.board], ['coach', 'puzzle', true]);
      assert.deepEqual(await page.evaluate(() => [window.__coach.st.ses.i, window.__coach.st.pz.p.id, window.__coach.st.park.train]), [1, pid, null], 'the same set, the same puzzle, not parked');
      assert.equal(await mins(page), 0);
      return page;
    }
    const { page, out } = await sameAsClose(vp, club(), {}, startSet);
    const L = await look(page);
    assert.deepEqual([L.tab, L.board, L.tabs, L.scr], ['train', false, true, null]);
    assert.equal(out.first, 'resumeTrain', 'first on Train');
    const R = await resume(page, 'resumeTrain');
    assert.deepEqual([R.title, R.button, R.line], [WORDS.puzzles, WORDS.puzzles, 'Puzzle 2 of 10']);
    // and it resumes where it was
    await page.locator('#resumeTrain .rs-go').click();
    assert.deepEqual(await page.evaluate(() => { const s = window.__coach.st.ses; return [s.i, s.right, s.wrong, window.__coach.st.scr]; }), [1, 1, 0, 'act']);
    return page;
  }],
  ['G-D9: back on a game’s board screen is Close: Play with its Resume game card; then Home; then the app leaves (G-D38)', async (vp) => {
    if (!PH(vp)) return page0(vp, club(), { game: GAME12, tab: 'play' }); // wide: no board screen (covered by the G-D39 case)
    const { page } = await sameAsClose(vp, club(), { game: GAME12 }, openGame);
    let L = await look(page);
    assert.deepEqual([L.tab, L.board, L.tabs, L.scr], ['play', false, true, null]);
    const R = await resume(page, 'resumePlay');
    assert.deepEqual([R.title, R.line], [WORDS.game, 'Move 12, your turn']);
    assert.deepEqual(await hist(page), SANS22, 'no move lost');
    await back(page);
    L = await look(page);
    assert.deepEqual([L.tab, L.scr, L.board], ['coach', null, false], 'Play’s page: back opens Home');
    assert.equal(await focusId(page), 'tab-coach', 'focus as a tab tap');
    assert.equal(await mins(page), 0);
    await back(page);
    assert.equal(await mins(page), 1, 'Home: the app goes to the background');
    assert.equal((await look(page)).tab, 'coach', 'and nothing else changed');
    assert.deepEqual(await hist(page), SANS22);
    return page;
  }],
  ['G-D9: back on a lesson’s board screen is Close: Learn with its Resume lesson card', async (vp) => {
    if (!PH(vp)) return page0(vp, club());
    const { page, out } = await sameAsClose(vp, club(), {}, (p) => lessonAt(p, 'kq', 1));
    assert.deepEqual([out.tab, out.scr, out.boardOn], ['path', null, false]);
    const R = await resume(page, 'resumePath');
    assert.deepEqual([R.title, R.line], [WORDS.lesson, 'Lesson · step 2 of ' + (await page.evaluate(() => COURSE.UNITS.filter((x) => x.id === 'kq')[0].lesson.length))]);
    assert.deepEqual(JSON.parse(out.saved).learn, { k: 'lesson', unit: 'kq', i: 1 }, 'it waits, saved at its step');
    return page;
  }],
  ['G-D9: back on a drill’s board screen is Close: Train with its Resume drill card', async (vp) => {
    if (!PH(vp)) return page0(vp, club());
    const { page, out } = await sameAsClose(vp, club(), {}, startDrill);
    assert.deepEqual([out.tab, out.scr, out.first], ['train', null, 'resumeTrain']);
    const R = await resume(page, 'resumeTrain');
    assert.deepEqual([R.title, R.line], [WORDS.drill, 'Endgame drill']);
    return page;
  }],
  ['G-D40: back with an end card up is Close (a finished game): Play, the board screen closed', async (vp) => {
    if (!PH(vp)) return page0(vp, club());
    const setup = async (p) => {
      await openGame(p); await move(p, 'h5', 'f7');
      await p.waitForFunction(() => !document.getElementById('gameEnd').hidden && document.documentElement.dataset.scrend === '1', null, { timeout: 20000 });
    };
    const { page, out } = await sameAsClose(vp, club(), { game: MATE1 }, setup);
    assert.deepEqual([out.tab, out.scr, out.end, out.boardOn], ['play', null, null, false]);
    return page;
  }],
  ['G-D27: back in a review opened mid-game goes back to the game; a second back goes to Play', async (vp) => {
    if (!PH(vp)) return page0(vp, club());
    const page = await page0(vp, club(), { game: GAME12 });
    await openGame(page);
    await page.locator('#reviewBtn').click();
    assert.equal(await st(page, 'mode'), 'review');
    await back(page);
    let L = await look(page);
    assert.deepEqual([L.mode, L.scr, L.tab, L.board], ['play', 'act', 'play', true], 'back on the game');
    assert.deepEqual(await hist(page), SANS22);
    await back(page);
    L = await look(page);
    assert.deepEqual([L.tab, L.scr, L.board], ['play', null, false]);
    assert.equal((await resume(page, 'resumePlay')).title, WORDS.game);
    assert.equal(await mins(page), 0);
    return page;
  }],

  // ---------- G-D38: tab pages ----------
  ['G-D38: back on Learn, Train, Play’s start page or Progress opens Home, as a tab tap; on Home the app leaves (every width)', async (vp) => {
    const page = await page0(vp, club());
    for (const t of ['path', 'train', 'play', 'progress']) {
      await goTab(page, t);
      assert.equal((await look(page)).tab, t);
      await back(page);
      const L = await look(page);
      assert.deepEqual([L.tab, L.panels.includes('coach'), L.scr], ['coach', true, null], t);
      assert.equal(await focusId(page), 'tab-coach', t + ': focus as a tab tap');
      assert.equal(await page.evaluate(() => localStorage.getItem('suresh-chess-coach.tab')), JSON.stringify('coach'), t + ': stored as a tab tap does');
      assert.equal(await mins(page), 0, t + ': the app stays');
    }
    await back(page);
    assert.equal(await mins(page), 1, 'Home: minimizeApp');
    await back(page);
    assert.equal(await mins(page), 2, 'again: no "press again to leave"');
    assert.equal((await look(page)).tab, 'coach');
    return page;
  }],

  // ---------- G-D40 steps 1 to 3: sheets and notes ----------
  ['G-D40: Settings open: back closes it and does nothing else (Home, and over the board)', async (vp) => {
    const page = await page0(vp, club(), { game: GAME12 });
    await page.locator('#settingsBtn').click();
    assert.equal(await sheetOpen(page), true);
    await back(page);
    assert.deepEqual([await sheetOpen(page), (await look(page)).tab, await mins(page)], [false, 'coach', 0], 'Home: the sheet closed, nothing more');
    assert.equal(await focusId(page), 'settingsBtn', 'focus back on the gear, as Esc does');
    if (PH(vp)) await openGame(page); else await goTab(page, 'play'); // wide: the game is already on the board
    const before = await look(page);
    await page.evaluate(() => window.__coach.openSettings());
    assert.equal(await sheetOpen(page), true);
    await back(page);
    const L = await look(page);
    assert.equal(await sheetOpen(page), false);
    assert.deepEqual([L.tab, L.mode, L.scr, L.board], [before.tab, before.mode, before.scr, before.board], 'the board screen (phones) or the game (wide) stays');
    assert.deepEqual(await hist(page), SANS22);
    assert.equal(await mins(page), 0);
    return page;
  }],
  ['G-D40: a note from Rani open: back closes it as Esc does, and nothing else', async (vp) => {
    const page = await page0(vp, club(), { game: GAME12 });
    await goTab(page, 'path');
    await page.evaluate(() => { window.__coach.note('First note.'); window.__coach.note('Second note.'); });
    assert.equal(await noteUp(page), true);
    await back(page);
    assert.match(await page.locator('#raniNote').innerText(), /Second note\./, 'the next note in the queue, as Esc');
    await back(page);
    assert.equal(await noteUp(page), false);
    assert.deepEqual([(await look(page)).tab, await mins(page)], ['path', 0], 'still on Learn');
    if (PH(vp)) {
      await openGame(page);
      await page.evaluate(() => window.__coach.note('Over the board.'));
      await back(page);
      const L = await look(page);
      assert.deepEqual([await noteUp(page), L.scr, L.tab], [false, 'act', 'play'], 'the board screen stays open');
    }
    assert.equal(await mins(page), 0);
    return page;
  }],
  ['G-D40: the level check at the puzzle step: back skips the puzzles as Esc does; where Esc does nothing, back does nothing and never leaves', async (vp) => {
    const A = await page0(vp, club()), B = await page0(vp, club());
    await toPuzzleStep(A); await toPuzzleStep(B);
    await back(A); await B.keyboard.press('Escape');
    const pa = await A.evaluate(() => window.Placement.peek()), pb = await B.evaluate(() => window.Placement.peek());
    assert.deepEqual(pa, pb, 'back = Esc');
    assert.equal(pa.step, 'result', 'the puzzles were skipped');
    await B.context().close();
    // the result step: Esc does nothing there, so back does nothing (the check stays, the app stays)
    await back(A);
    assert.deepEqual(await A.evaluate(() => [window.Placement.isOpen(), window.Placement.peek().step]), [true, 'result']);
    assert.equal(await mins(A), 0, 'never leaves the app from the level check');
    assert.equal(await st(A, 'tab'), 'coach');
    // a retake from Settings: Esc cancels it at the first step, and so does back
    await A.evaluate(() => window.Placement.close());
    await A.evaluate(() => window.__coach.openPlacement(true));
    assert.equal(await A.evaluate(() => window.Placement.isOpen()), true);
    await back(A);
    assert.equal(await A.evaluate(() => window.Placement.isOpen()), false, 'a retake is cancelled, as Esc does');
    assert.equal(await mins(A), 0);
    return A;
  }],

  // ---------- G-D39: wide screens ----------
  ['G-D39: wide (and phones on a tab page): back never ends or parks the lesson or game on the board', async (vp) => {
    const page = await page0(vp, club(), { game: GAME12 });
    if (PH(vp)) {
      // a phone with a lesson waiting on Learn: back from the tab page goes Home and the lesson still waits
      await lessonAt(page, 'kq', 1); await closeX(page);
      await back(page);
      assert.equal(await st(page, 'tab'), 'coach');
      assert.deepEqual(JSON.parse(await page.evaluate((k) => localStorage.getItem(k), RKEY)).learn, { k: 'lesson', unit: 'kq', i: 1 }, 'the lesson still waits at its step');
      assert.equal(await page.locator('#contCard .bh-go').innerText(), WORDS.lesson, 'Home’s Continue card resumes it (G-D37)');
      assert.equal(await mins(page), 0);
      return page;
    }
    await lessonAt(page, 'kq', 1);
    assert.equal((await look(page)).tab, 'path');
    await back(page);
    let L = await look(page);
    assert.deepEqual([L.tab, L.mode, L.board, L.bar], ['coach', 'lesson', true, false], 'Home; the lesson is still on the board');
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.ls.i, window.__coach.st.ls.unit.id, window.__coach.st.park.learn]), [1, 'kq', null], 'at its step, not parked');
    assert.equal(await focusId(page), 'tab-coach');
    assert.equal(await mins(page), 0);
    await back(page);
    assert.equal(await mins(page), 1, 'Home: the app leaves');
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, window.__coach.st.ls.i]), ['lesson', 1], 'and the lesson is untouched');
    // the game on the board (Play): Home, and the game is the same
    await goTab(page, 'play'); await page.locator('#znote-play [data-act="close"]').click();
    assert.equal(await st(page, 'mode'), 'play');
    await back(page);
    L = await look(page);
    assert.deepEqual([L.tab, L.mode, L.board], ['coach', 'play', true]);
    assert.deepEqual(await hist(page), SANS22);
    assert.equal(await page.evaluate(() => window.__coach.st.park.learn.i), 1, 'the lesson waits as it did');
    return page;
  }],

  // ---------- no native app: nothing changes ----------
  ['G-D40: in a browser (no Capacitor) there is no listener and nothing breaks', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12 });
    assert.equal(await page.evaluate(() => typeof window.Capacitor), 'undefined');
    await goTab(page, 'path'); await goTab(page, 'play');
    return page;
  }],
  ['G-D40: Capacitor that is not the native app: addListener is never called', async (vp) => {
    const page = await newPage(vp, club(), { init: APP({ web: true }) });
    assert.deepEqual(await calls(page), []);
    await goTab(page, 'train');
    return page;
  }],
  ['G-D40: the native app without the App plugin (the ads plugin only): no listener, no error', async (vp) => {
    const page = await newPage(vp, club(), { ads: true, init: APP({ none: true }) });
    assert.deepEqual(await calls(page), []);
    assert.equal(await page.evaluate(() => !!window.Capacitor.Plugins.AdMob && !window.Capacitor.Plugins.App), true);
    await goTab(page, 'path'); await goTab(page, 'coach');
    return page;
  }],
  ['G-D40: the App plugin next to the ads plugin: one listener; a plugin that throws or rejects, or a failed minimize, logs nothing', async (vp) => {
    let page = await newPage(vp, club(), { ads: true, init: APP() });
    assert.deepEqual(await calls(page), ['addListener:backButton']);
    await page.context().close();
    page = await newPage(vp, club(), { init: APP({ throws: true }) });
    assert.deepEqual(await calls(page), ['addListener:backButton']);
    await goTab(page, 'path');
    assert.deepEqual(page.errors, []);
    await page.context().close();
    page = await newPage(vp, club(), { init: APP({ rejects: true }) });
    await page.waitForTimeout(100);
    assert.deepEqual(page.errors, []);
    await page.context().close();
    page = await newPage(vp, club(), { init: APP({ minRejects: true }) });
    await back(page);
    await page.waitForTimeout(100);
    assert.equal(await mins(page), 1);
    return page;
  }]
];

G.run(cases, VIEWPORTS, ONLY);
