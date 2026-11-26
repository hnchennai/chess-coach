// E2E for slice G2b (docs/specs/board-screens.product.md): G-D19 (a lesson, set or drill in progress is saved on the device),
// G-D20 (one thing waits per tab: a game on Play, a lesson on Learn, a set or drill on Train; opening one never ends another),
// G-D26, scenario 14, criterion 3 for lessons and sets. Design: docs/specs/board-screens.tech.md, section 15.
// Fix round 1 (2026-11-23): G-D35 (what waits survives on wide screens too: D50 is gone at every width), G-D36 (a game that
// ended while closed gets a result card), G-D37 (Home and Today resume what waits), and the review's items 4 to 8.
// Built on the helpers of g2.spec.js.
// Run: G2B_VP=412 node tests/e2e/g2b.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// G2B_VP: 360 | 412 | 915 (a big phone held sideways: the phone layout since G-D41) | 1280. G2B_SHOTS=<dir> saves screenshots (412 and
// 915 only). G2B_ONLY=<regex> runs matching cases.
const assert = require('assert/strict');
const path = require('path');
const G = require('./g2.spec.js');
const { newPage, st, hist, savedGame, idle, look, bar, resume, visibleIds, goTab, closeX, move, solvePuzzle, finishLesson, prof, improver, club, game, PH, WORDS, GAME12, SANS22, NOW, DAY } = G;

const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 915, height: 412 }, { width: 1280, height: 900 }].filter((v) => !process.env.G2B_VP || String(v.width) === process.env.G2B_VP);
const ONLY = process.env.G2B_ONLY ? new RegExp(process.env.G2B_ONLY) : null;
const SHOTS = process.env.G2B_SHOTS || '';
const RKEY = 'suresh-chess-coach.resume.v1';
const ZT = { play: ['play', 'resumePlay'], learn: ['path', 'resumePath'], train: ['train', 'resumeTrain'] };

const shot = async (page, name) => { const w = page.viewportSize().width; if (!SHOTS || (w !== 412 && w !== 915)) return; await page.waitForTimeout(350); await page.screenshot({ path: path.join(SHOTS, name + (w === 915 ? '_915x412' : '') + '.png') }); };
// The saved key, as it is on the device right now (null: the key is not there).
const saved = (page) => page.evaluate((k) => { const r = localStorage.getItem(k); return r == null ? null : JSON.parse(r); }, RKEY);
const rawSaved = (page) => page.evaluate((k) => localStorage.getItem(k), RKEY);
// A Resume card as [title, line, the small line above, button], on its own tab (null: no card).
const card = async (page, zone) => { await goTab(page, ZT[zone][0]); const r = await resume(page, ZT[zone][1]); return r && [r.title, r.line, r.kick, r.button]; };
const cards = async (page) => ({ play: await card(page, 'play'), learn: await card(page, 'learn'), train: await card(page, 'train') });
const open = async (page, zone) => { await goTab(page, ZT[zone][0]); await page.locator('#' + ZT[zone][1] + ' .rs-go').click(); };
const next = async (page) => { const i = await page.evaluate(() => window.__coach.st.ses.i); await page.locator('#sessionCard [data-act="next"]').click(); await page.waitForFunction((k) => { const c = window.__coach.st; return c.ses && (c.ses.i > k || c.ses.finished); }, i); };
// What is on the board, in plain data.
const onBoard = (page) => page.evaluate(() => {
  const c = window.__coach.st, s = c.ses;
  if (c.mode === 'lesson' && c.ls) return { mode: 'lesson', unit: c.ls.unit.id, i: c.ls.i, fen: c.ls.g.fen(), arrows: c.arrows.length, want: (c.ls.unit.lesson[c.ls.i].arrows || []).length };
  if (s && c.mode !== 'play') return { mode: c.mode, kind: s.kind, i: s.i, right: s.right, wrong: s.wrong, count: s.count, title: s.title, pid: c.pz ? c.pz.p.id : null, step: c.pz ? c.pz.step : null, done: c.pz ? c.pz.done : null,
    fen: c.dr ? c.dr.g.fen() : null, moves: c.dr ? c.dr.moves : null, line: c.bk ? c.bk.line.id : null, quiz: c.qz ? c.qz.it.p.id + (c.qz.it.blunder ? '!' : '') : null };
  return { mode: c.mode, sans: window.__coach.hist().length };
});
const puzzleReady = (page) => page.waitForFunction(() => { const c = window.__coach.st; return c.mode === 'puzzle' && c.pz && !c.pz.wait && !c.pz.done && !c.busy; }, null, { timeout: 20000 });
const puzStats = (page, id) => page.evaluate((i) => { const p = window.__coach.getProf(), r = p.puz[i] || { n: 0, ok: 0 }; return { n: r.n, ok: r.ok, rating: p.rating, rn: p.rn, stored: (JSON.parse(localStorage.getItem('suresh-chess-coach.profile.v1')).puz[i] || { n: 0 }).n }; }, id);
// Two puzzles of two or more own moves, made "missed and due", so that "Review missed" deals exactly them.
const dueMulti = (page) => page.evaluate(() => {
  const ps = window.__coach.PZ.filter((p) => !p.hand && p.sol.length >= 3 && p.sol.indexOf('*') === -1).slice(0, 2), pr = window.__coach.getProf();
  ps.forEach((p) => { pr.puz[p.id] = { n: 1, ok: 0, box: 0, due: Date.now() - 1000 }; });
  return ps.map((p) => p.id);
});
const lessonTo = async (page, unit, clicks) => {
  await page.evaluate((u) => window.__coach.startPart(u, 'learn'), unit);
  await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
  for (let i = 0; i < clicks; i++) await page.locator('#navNext').click();
};
const ratedToTwo = async (page) => {
  await goTab(page, 'train'); await page.locator('#ratedBtn').click();
  await solvePuzzle(page); await next(page); await puzzleReady(page);
  return page.evaluate(() => window.__coach.st.pz.p.id);
};
const steps = (page, unit) => page.evaluate((u) => COURSE.UNITS.filter((x) => x.id === u)[0].lesson.length, unit); // COURSE is the page's own global
const perms = (a) => a.length < 2 ? [a] : a.flatMap((x, i) => perms(a.slice(0, i).concat(a.slice(i + 1))).map((p) => [x].concat(p)));
const LESSON_E = (i) => ({ k: 'lesson', unit: 'kq', i });

const cases = [
  // ---------- scenario 14, G-D20 ----------
  ['S14: an unfinished game and an unfinished lesson both wait; opening one does not end the other (G-D35: wide screens too)', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    await lessonTo(page, 'kq', 1);
    const n = await steps(page, 'kq');
    if (!PH(vp)) {
      // G-D35 replaces D50 on wide screens: "Resume game" (the note on Play) parks the open lesson; it waits on Learn
      await goTab(page, 'play');
      await page.locator('#znote-play [data-act="close"]').click();
      assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, window.__coach.st.ls]), ['play', null], 'wide: the game is on the board');
      assert.deepEqual(await visibleIds(page, '#actBar'), [], 'wide: no Close bar, as before');
      assert.deepEqual(await hist(page), SANS22);
      assert.deepEqual(await saved(page), { v: 1, learn: LESSON_E(1), train: null }, 'wide: the lesson waits, saved at its step');
      await goTab(page, 'path');
      const R = await resume(page, 'resumePath');
      assert.deepEqual([R.title, R.line, R.kick, R.button], [WORDS.lesson, 'Lesson · step 2 of ' + n, 'Mate with king and queen', WORDS.lesson], 'wide: its Resume card on Learn');
      await shot(page, 'fix1_wide_learn_resume');
      // Home's Continue card resumes it at its step (G-D37), and the game is not touched
      await goTab(page, 'coach');
      assert.equal(await page.locator('#contCard .bh-go').innerText(), WORDS.lesson);
      await page.locator('#contCard .bh-go').click();
      assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, window.__coach.st.ls.unit.id, window.__coach.st.ls.i, window.__coach.st.tab]), ['lesson', 'kq', 1, 'path'], 'criterion 3: the same step');
      assert.equal(await resume(page, 'resumePath'), null, 'no card for what is on the board');
      assert.deepEqual(await hist(page), SANS22);
      assert.deepEqual(page.dialogs, [], 'never a question');
      return page;
    }
    await closeX(page);
    const want = { play: [WORDS.game, 'Move 12, your turn', null, WORDS.game], learn: [WORDS.lesson, 'Lesson · step 2 of ' + n, 'Mate with king and queen', WORDS.lesson], train: null };
    assert.deepEqual(await cards(page), want, 'Play shows "Resume game" and Learn shows "Resume lesson"');
    // opening the game does not end the lesson
    await open(page, 'play');
    let L = await look(page);
    assert.deepEqual([L.mode, L.scr, L.tab, L.board, L.tabs], ['play', 'act', 'play', true, false]);
    assert.deepEqual(await hist(page), SANS22);
    assert.equal((await bar(page)).place, 'Move 12, your turn');
    await closeX(page);
    assert.deepEqual(await cards(page), want, 'G-D20: both still wait after the game was opened');
    assert.deepEqual(await saved(page), { v: 1, learn: LESSON_E(1), train: null }, 'the waiting lesson is saved');
    // opening the lesson does not end the game, and it comes back at its step
    await open(page, 'learn');
    L = await look(page);
    assert.deepEqual([L.mode, L.scr, L.tab, L.board, L.tabs], ['lesson', 'act', 'path', true, false]);
    let B = await onBoard(page);
    assert.deepEqual([B.unit, B.i, B.arrows], ['kq', 1, B.want], 'criterion 3: the same step, shown again with its own arrows');
    assert.equal((await bar(page)).place, 'Lesson · step 2 of ' + n);
    await page.locator('#navNext').click();
    await closeX(page);
    want.learn[1] = 'Lesson · step 3 of ' + n;
    assert.deepEqual(await cards(page), want);
    await open(page, 'play');
    assert.deepEqual(await hist(page), SANS22, 'no move was lost');
    await move(page, 'a2', 'a3'); await page.waitForFunction(() => window.__coach.hist().length === 24, null, { timeout: 30000 }); await idle(page);
    await closeX(page);
    want.play[1] = 'Move 13, your turn';
    assert.deepEqual(await cards(page), want);
    // Home: the game's card and the lesson's button
    await goTab(page, 'coach');
    assert.equal((await resume(page, 'resumeHome')).line, 'Move 13, your turn');
    assert.equal(await page.locator('#contCard .bh-go').innerText(), WORDS.lesson, 'the Continue card resumes the waiting lesson');
    assert.deepEqual(page.dialogs, [], 'never a question');
    return page;
  }],
  // ---------- G-D20: a game, a lesson and a set all wait; each is resumed in every order; then an app restart ----------
  ['G-D20: a game, a lesson and a puzzle set all wait at once; resumed in every order nothing is lost; the same after a restart', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    if (!PH(vp)) return page;
    await lessonTo(page, 'kq', 1); await closeX(page);
    const n = await steps(page, 'kq');
    const pid = await ratedToTwo(page);
    assert.deepEqual((await look(page)).scr, 'act');
    await closeX(page);
    const want = { play: [WORDS.game, 'Move 12, your turn', null, WORDS.game], learn: [WORDS.lesson, 'Lesson · step 2 of ' + n, 'Mate with king and queen', WORDS.lesson], train: [WORDS.puzzles, 'Puzzle 2 of 10', 'Rated puzzles', WORDS.puzzles] };
    assert.deepEqual(await cards(page), want, 'starting the set on Train did not end the lesson on Learn');
    const S0 = await saved(page);
    assert.deepEqual(S0.learn, LESSON_E(1));
    assert.deepEqual([S0.train.k, S0.train.kind, S0.train.i, S0.train.right, S0.train.wrong, S0.train.rated, S0.train.items.length, S0.train.items[1]], ['set', 'puzzles', 1, 1, 0, true, 2, pid]);
    const st0 = await puzStats(page, S0.train.items[0]);
    const check = async (z, why) => {
      const L = await look(page), B = await onBoard(page);
      assert.deepEqual([L.scr, L.tab, L.board, L.tabs, L.header], ['act', ZT[z][0], true, false, false], why + ': the board screen, no tabs, no header');
      assert.deepEqual(await visibleIds(page, '#homeSlot, #progSlot, #slotStrip'), [], why + ': no tip while the board screen is open');
      if (z === 'play') { assert.equal(B.mode, 'play', why); assert.deepEqual(await hist(page), SANS22, why + ': the game, every move'); assert.equal((await bar(page)).place, 'Move 12, your turn'); }
      if (z === 'learn') assert.deepEqual([B.mode, B.unit, B.i, B.arrows], ['lesson', 'kq', 1, B.want], why + ': the lesson at its step');
      if (z === 'train') {
        await puzzleReady(page); const P = await onBoard(page);
        assert.deepEqual([P.mode, P.kind, P.i, P.right, P.wrong, P.count, P.pid, P.step, P.done], ['puzzle', 'puzzles', 1, 1, 0, 10, pid, 0, false], why + ': the same puzzle, dealt again, the same score');
        assert.equal((await bar(page)).place, 'Puzzle 2 of 10');
      }
    };
    for (const order of perms(['play', 'learn', 'train'])) {
      for (const z of order) { await open(page, z); await check(z, order.join(' > ') + ' / ' + z); await closeX(page); }
      assert.deepEqual(await cards(page), want, order.join(' > ') + ': all three still wait, at the same place');
    }
    assert.deepEqual(await saved(page), S0, 'the saved key did not change by opening and closing');
    assert.deepEqual(await puzStats(page, S0.train.items[0]), st0, 'no result was counted again');
    // Home
    await goTab(page, 'coach');
    assert.deepEqual([(await resume(page, 'resumeHome')).title, await page.locator('#contCard .bh-go').innerText(), await page.locator('#today .step3.z-learn .zb').innerText()], [WORDS.game, WORDS.lesson, WORDS.lesson]);
    await shot(page, 'before_home'); await goTab(page, 'path'); await shot(page, 'before_learn'); await goTab(page, 'train'); await shot(page, 'before_train'); await goTab(page, 'play'); await shot(page, 'before_play');
    // ---- the app is closed and opened again ----
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    let L = await look(page);
    assert.deepEqual([L.tab, L.scr, L.board, L.tabs], ['coach', null, false, true], 'G-D25: the app still opens on Home');
    assert.deepEqual([(await resume(page, 'resumeHome')).title, await page.locator('#contCard .bh-go').innerText(), await page.locator('#today .step3.z-learn .zb').innerText()], [WORDS.game, WORDS.lesson, WORDS.lesson], 'Home after a restart');
    assert.deepEqual(await saved(page), S0, 'reading the key does not change it');
    await shot(page, 'after_home');
    assert.deepEqual(await cards(page), want, 'the same three cards, the same titles and lines, after a restart');
    await goTab(page, 'path'); await shot(page, 'after_learn'); await goTab(page, 'train'); await shot(page, 'after_train'); await goTab(page, 'play'); await shot(page, 'after_play');
    for (const z of ['train', 'play', 'learn']) { await open(page, z); await check(z, 'after a restart / ' + z); await closeX(page); }
    assert.deepEqual(await cards(page), want);
    // Home's Continue button resumes the saved lesson at its step
    await goTab(page, 'coach'); await page.locator('#contCard .bh-go').click();
    await check('learn', 'Continue after a restart');
    await closeX(page); await goTab(page, 'coach'); await page.locator('#today .step3.z-learn .zb').click();
    await check('learn', 'Today’s Learn step after a restart');
    return page;
  }],
  // ---------- G-D20: the same tab: the newest wins, with no question ----------
  ['G-D20: a new activity on the same tab replaces the one waiting there, with no question; the other tabs keep theirs', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    if (!PH(vp)) return page;
    await lessonTo(page, 'kq', 2); await closeX(page);
    await ratedToTwo(page); await closeX(page);
    // Learn: another lesson
    await goTab(page, 'path'); await page.locator('#levels [data-unit="kr"]').click(); await page.locator('#unitView [data-part="learn"]').click();
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.ls.unit.id, window.__coach.st.ls.i]), ['kr', 0]);
    await closeX(page);
    let C = await cards(page);
    assert.deepEqual([C.learn[0], C.learn[2]], [WORDS.lesson, 'Mate with king and rook'], 'Learn: the new lesson');
    assert.deepEqual([C.train[1], C.play[1]], ['Puzzle 2 of 10', 'Move 12, your turn'], 'Train and Play keep theirs');
    assert.deepEqual((await saved(page)).learn, { k: 'lesson', unit: 'kr', i: 0 });
    // Learn: a drill started as a lesson's task replaces the lesson there
    await page.evaluate(() => window.__coach.startPart('kq', 'apply')); await idle(page);
    assert.equal((await look(page)).tab, 'path'); await closeX(page);
    C = await cards(page);
    assert.deepEqual([C.learn[0], C.learn[1]], [WORDS.drill, 'Endgame drill'], 'G-D26: a drill started from Learn waits on Learn');
    assert.deepEqual([C.train[1], C.play[1]], ['Puzzle 2 of 10', 'Move 12, your turn']);
    // Train: another set, while Learn's drill waits (parked, not on the board)
    await goTab(page, 'train'); await page.locator('#panel-train [data-train="safety"]').click(); await closeX(page);
    C = await cards(page);
    assert.deepEqual([C.train[0], C.train[2]], [WORDS.puzzles, 'Safe or blunder?'], 'Train: the new set');
    assert.deepEqual([C.learn[0], C.play[1]], [WORDS.drill, 'Move 12, your turn'], 'Learn and Play keep theirs');
    // Train: the same drill from Train's list waits on Train; both drills wait
    await page.locator('#drillList [data-drill]').first().click(); await idle(page); await closeX(page);
    C = await cards(page);
    assert.deepEqual([C.train[0], C.learn[0], C.play[0]], [WORDS.drill, WORDS.drill, WORDS.game]);
    const S = await saved(page);
    assert.deepEqual([S.learn.kind, S.learn.unit, S.train.kind, S.train.unit], ['drill', 'kq', 'drill', 'kq']);
    // a new game replaces the game: the question it always asked (D49) is on Play's page, and the lesson and set are not touched
    assert.deepEqual(page.dialogs, [], 'no question was asked');
    return page;
  }],
  // ---------- parked in the middle of a wait: late timers and engine replies ----------
  ['Parked in the middle of a puzzle’s reply: the late reply writes nothing on the game’s board, and Resume deals the puzzle again', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    if (!PH(vp)) return page;
    await goTab(page, 'train');
    const ids = await dueMulti(page);
    assert.equal(ids.length, 2);
    await page.evaluate(() => window.__coach.trainStart('review'));
    await puzzleReady(page);
    const P0 = await onBoard(page), mv = await page.evaluate(() => window.__coach.st.pz.p.sol[0]);
    assert.deepEqual([P0.count, P0.i, ids.includes(P0.pid)], [2, 0, true]);
    await page.locator('#board .sq[data-sq="' + mv.slice(0, 2) + '"]').click(); await page.locator('#board .sq[data-sq="' + mv.slice(2, 4) + '"]').click();
    // in one step, while the puzzle waits for "their" reply: Close, Play, Resume game
    const R = await page.evaluate(() => {
      const c = window.__coach.st, waiting = !!(c.pz && c.pz.wait && c.pz.step === 1);
      window.__coach.closeAct(); document.getElementById('tab-play').click(); document.querySelector('#resumePlay .rs-go').click();
      return { waiting, mode: c.mode, scr: document.documentElement.dataset.scr || null, arrows: JSON.stringify(c.arrows), busy: c.busy };
    });
    assert.equal(R.waiting, true, 'the case is in the middle of the reply wait');
    assert.deepEqual([R.mode, R.scr, R.busy], ['play', 'act', false]);
    await page.waitForTimeout(1500); // the reply's timer has run by now
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, JSON.stringify(window.__coach.st.arrows), window.__coach.st.busy]), ['play', R.arrows, false], 'the puzzle’s late reply drew nothing on the game’s board');
    assert.deepEqual(await hist(page), SANS22);
    await move(page, 'a2', 'a3'); await page.waitForFunction(() => window.__coach.hist().length === 24, null, { timeout: 30000 }); await idle(page);
    await closeX(page);
    assert.deepEqual(await card(page, 'train'), [WORDS.puzzles, 'Puzzle 1 of 2', 'Review missed puzzles', WORDS.puzzles]);
    await open(page, 'train'); await puzzleReady(page);
    let P = await onBoard(page);
    assert.deepEqual([P.pid, P.step, P.done, P.i, P.right, P.wrong], [P0.pid, 0, false, 0, 0, 0], 'the same puzzle from its first move, nothing counted yet');
    await solvePuzzle(page);
    P = await onBoard(page);
    assert.deepEqual([P.right, P.wrong, P.done], [1, 0, true], 'not frozen: it could be solved');
    assert.deepEqual([(await puzStats(page, P0.pid)).n, (await puzStats(page, P0.pid)).stored], [2, 2], 'one result, once (it had one miss before)');
    return page;
  }],
  ['Parked while the engine thinks: the game’s late reply writes nothing into the lesson; the game has the reply when it is opened again', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    if (!PH(vp)) return page;
    await lessonTo(page, 'kq', 1); await closeX(page);
    await open(page, 'play'); await idle(page);
    await page.locator('#board .sq[data-sq="a2"]').click(); await page.locator('#board .sq[data-sq="a3"]').click();
    await page.waitForFunction(() => window.__coach.hist().length === 23);
    const R = await page.evaluate(() => {
      const c = window.__coach.st, thinking = c.busy && window.__coach.hist().length === 23;
      window.__coach.closeAct(); document.getElementById('tab-path').click(); document.querySelector('#resumePath .rs-go').click();
      return { thinking, mode: c.mode, scr: document.documentElement.dataset.scr || null, arrows: JSON.stringify(c.arrows), busy: c.busy, i: c.ls && c.ls.i, hidden: document.getElementById('thinking').hidden };
    });
    assert.equal(R.thinking, true, 'the case is in the middle of the engine’s think');
    assert.deepEqual([R.mode, R.scr, R.i], ['lesson', 'act', 1]);
    assert.deepEqual([R.busy, R.hidden], [false, true], 'the lesson does not wait for the game’s engine');
    await page.waitForFunction(() => window.__coach.hist().length === 24, null, { timeout: 30000 }); // the reply lands under the lesson
    // the reply is saved once it is explained (as before G2b), all of it under the lesson
    await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).sans.length === 24 && !window.__coach.st.gb, G.GKEY, { timeout: 30000 });
    await page.waitForTimeout(300);
    const B = await onBoard(page);
    assert.deepEqual([B.mode, B.unit, B.i, B.arrows], ['lesson', 'kq', 1, B.want]);
    assert.equal(await page.evaluate(() => JSON.stringify(window.__coach.st.arrows)), R.arrows, 'the engine’s late reply drew nothing on the lesson’s board');
    assert.equal(await st(page, 'busy'), false);
    assert.equal((await savedGame(page)).sans.length, 24, 'the reply is saved');
    assert.equal((await bar(page)).name, 'Mate with king and queen', 'the Close bar still names the lesson');
    await page.locator('#navNext').click();
    assert.equal((await onBoard(page)).i, 2, 'the lesson goes on');
    await closeX(page);
    assert.equal((await card(page, 'play'))[1], 'Move 13, your turn');
    await open(page, 'play'); await idle(page);
    const last = await page.evaluate(() => { const c = window.__coach.st; return { n: window.__coach.hist().length, arrows: c.arrows.length, busy: c.busy, mode: c.mode }; });
    assert.deepEqual(last, { n: 24, arrows: 1, busy: false, mode: 'play' }, 'the game shows the engine’s reply and it is the player’s move');
    await move(page, 'a3', 'a4');
    assert.equal((await hist(page))[24], 'a4', 'the game goes on');
    return page;
  }],
  ['Parked while a drill’s engine move is on its way: nothing lands on the game; Resume keeps the position and asks the engine again', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    if (!PH(vp)) return page;
    await goTab(page, 'train'); await page.locator('#drillList [data-drill]').first().click(); await idle(page);
    await page.locator('#board .sq[data-sq="b1"]').click(); await page.locator('#board .sq[data-sq="b5"]').click();
    const R = await page.evaluate(() => {
      const c = window.__coach.st, thinking = c.busy && c.dr && c.dr.moves === 1 && c.dr.g.turn() === 'b';
      window.__coach.closeAct(); document.getElementById('tab-play').click(); document.querySelector('#resumePlay .rs-go').click();
      return { thinking, mode: c.mode, arrows: JSON.stringify(c.arrows), busy: c.busy };
    });
    assert.equal(R.thinking, true, 'the case is in the middle of the drill’s engine move');
    assert.deepEqual([R.mode, R.busy], ['play', false], 'the game is the player’s to move at once');
    const S = await saved(page);
    assert.deepEqual([S.train.kind, S.train.drill.moves, S.train.drill.fen.split(' ')[1]], ['drill', 1, 'b'], 'saved with the engine to move');
    await page.waitForTimeout(2000);
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, JSON.stringify(window.__coach.st.arrows), window.__coach.st.busy]), ['play', R.arrows, false], 'the drill’s late engine move drew nothing on the game’s board');
    await closeX(page);
    assert.deepEqual(await card(page, 'train'), [WORDS.drill, 'Endgame drill', 'Mate with king and queen', WORDS.drill]);
    await open(page, 'train'); await idle(page);
    await page.waitForFunction(() => { const d = window.__coach.st.dr; return d && d.g.turn() === 'w'; }, null, { timeout: 20000 });
    const D = await onBoard(page);
    assert.deepEqual([D.mode, D.kind, D.moves], ['drill', 'drill', 1], 'the same drill, the move kept');
    assert.match(D.fen, /^\S+ w /, 'the engine was asked again and has replied');
    assert.equal(await page.evaluate(() => { const g = window.__coach.st.dr.g; return g.get('b5') && g.get('b5').type; }), 'q', 'the queen is where the player put it');
    assert.match((await bar(page)).name, /move 1 of \d+$/);
    return page;
  }],
  // ---------- G-D19: restart with each kind waiting ----------
  ['G-D19: each kind survives an app restart: the same card (title, line, button) and the same place when resumed', async (vp) => {
    const KINDS = [
      ['rated puzzles', 'train', async (page) => { await ratedToTwo(page); }, [WORDS.puzzles, 'Puzzle 2 of 10']],
      ['a themed set', 'train', async (page) => { await goTab(page, 'train'); await page.locator('#themeList [data-theme]').first().click(); await solvePuzzle(page); await next(page); await puzzleReady(page); }, [WORDS.puzzles, /^Puzzle 2 of \d+$/]],
      ['Safe or blunder', 'train', async (page) => { await goTab(page, 'train'); await page.locator('#panel-train [data-train="safety"]').click(); await page.locator('#qSafe').click(); await next(page); }, [WORDS.puzzles, '2 of 10']],
      ['an opening drill', 'train', async (page) => { await goTab(page, 'train'); await page.locator('#bookList [data-book]').nth(1).click(); await page.waitForFunction(() => window.__coach.st.bk && !window.__coach.st.bk.wait); }, [WORDS.drill, '1 of 1']],
      ['an endgame drill from Train', 'train', async (page) => { await goTab(page, 'train'); await page.locator('#drillList [data-drill]').first().click(); await idle(page); await page.locator('#board .sq[data-sq="b1"]').click(); await page.locator('#board .sq[data-sq="b5"]').click(); await page.waitForFunction(() => { const c = window.__coach.st; return c.dr.moves === 1 && c.dr.g.turn() === 'w' && !c.busy; }, null, { timeout: 20000 }); }, [WORDS.drill, 'Endgame drill']],
      ['a lesson', 'learn', async (page) => { await lessonTo(page, 'kq', 2); }, [WORDS.lesson, /^Lesson · step 3 of \d+$/]],
      ['a lesson’s board drill', 'learn', async (page) => { await page.evaluate(() => window.__coach.startPart('board', 'practice')); await page.locator('#board .sq[data-sq="e4"]').click(); await page.waitForFunction(() => window.__coach.st.ses.i === 1, null, { timeout: 5000 }); }, [WORDS.drill, '2 of 12']],
      ['a lesson’s practice puzzles', 'learn', async (page) => { await page.evaluate(() => window.__coach.startPart('fork', 'practice')); await solvePuzzle(page); await next(page); await puzzleReady(page); }, [WORDS.puzzles, /^Puzzle 2 of \d+$/]],
      ['a lesson’s endgame drill', 'learn', async (page) => { await page.evaluate(() => window.__coach.startPart('kr', 'apply')); await idle(page); }, [WORDS.drill, 'Endgame drill']]
    ];
    let page;
    for (const [name, zone, start, words] of KINDS) {
      if (page) { assert.deepEqual(page.errors, [], name); await page.context().close(); }
      page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
      if (!PH(vp)) return page;
      await start(page);
      const B0 = await onBoard(page);
      await closeX(page);
      const C0 = await card(page, zone);
      assert.equal(C0[0], words[0], name + ': title'); assert.equal(C0[3], words[0], name + ': button');
      if (words[1] instanceof RegExp) assert.match(C0[1], words[1], name); else assert.equal(C0[1], words[1], name + ': line');
      const S0 = await saved(page);
      assert.ok(S0 && S0[zone] && !S0[zone === 'learn' ? 'train' : 'learn'], name + ': saved under its own tab only');
      await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
      const L = await look(page);
      assert.deepEqual([L.tab, L.scr, L.board], ['coach', null, false], name + ': opens on Home');
      assert.deepEqual(await card(page, zone), C0, name + ': the same card after a restart');
      assert.deepEqual(await card(page, zone === 'learn' ? 'train' : 'learn'), null, name + ': no card on the other tab');
      assert.equal((await card(page, 'play'))[1], 'Move 12, your turn', name + ': the game waits too');
      await open(page, zone);
      await page.waitForFunction(() => !window.__coach.st.busy && !(window.__coach.st.pz && window.__coach.st.pz.wait) && !(window.__coach.st.bk && window.__coach.st.bk.wait), null, { timeout: 20000 });
      const B1 = await onBoard(page), L1 = await look(page);
      assert.deepEqual([L1.scr, L1.tab, L1.board], ['act', ZT[zone][0], true], name + ': the board screen on its own tab');
      const same = (b) => b.mode === 'lesson' ? [b.mode, b.unit, b.i, b.fen] : [b.mode, b.kind, b.i, b.right, b.wrong, b.count, b.title, b.pid, b.fen, b.moves, b.line, b.kind === 'safety' ? b.quiz : null];
      assert.deepEqual(same(B1), same(B0), name + ': the same place, the same score');
      assert.deepEqual(await saved(page), S0, name + ': resumed, it is saved as it was');
    }
    return page;
  }],
  ['G-D19: a system kill right after a step change (no Close): the new step and the new result are already saved', async (vp) => {
    let page = await newPage(vp, improver(), {});
    if (!PH(vp)) return page;
    // a lesson: Next, and the app dies
    await page.locator('#contCard .bh-go').click(); await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    const unit = await page.evaluate(() => window.__coach.st.ls.unit.id);
    await page.locator('#navNext').click(); await page.locator('#navNext').click();
    assert.deepEqual((await saved(page)).learn, { k: 'lesson', unit, i: 2 }, 'written with the step, before any Close');
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    assert.equal((await look(page)).tab, 'coach');
    assert.equal(await page.locator('#contCard .bh-go').innerText(), WORDS.lesson, 'Home’s Continue card reads Resume lesson after the kill');
    assert.match((await card(page, 'learn'))[1], /^Lesson · step 3 of \d+$/);
    await goTab(page, 'coach'); await page.locator('#contCard .bh-go').click();
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.ls.unit.id, window.__coach.st.ls.i, document.documentElement.dataset.scr]), [unit, 2, 'act']);
    // a set: the moment an item changes
    await closeX(page); await goTab(page, 'train'); await page.locator('#panel-train [data-train="safety"]').click();
    await page.locator('#qBlunder').click();
    let S = await saved(page);
    assert.deepEqual([S.train.i, S.train.right + S.train.wrong, S.train.counted], [0, 1, true], 'the answer is saved with the item marked as counted');
    await next(page);
    S = await saved(page);
    assert.deepEqual([S.train.i, S.train.right + S.train.wrong, S.train.counted], [1, 1, false], 'the next item is saved the moment it is dealt');
    const q = (await onBoard(page)).quiz;
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    assert.deepEqual((await card(page, 'train')).slice(0, 2), [WORDS.puzzles, '2 of 10']);
    assert.match((await card(page, 'learn'))[1], /^Lesson · step 3 of \d+$/, 'the lesson still waits too');
    await open(page, 'train');
    const B = await onBoard(page);
    assert.deepEqual([B.kind, B.i, B.right + B.wrong, B.quiz], ['safety', 1, 1, q], 'the same question');
    return page;
  }],
  // ---------- no double count ----------
  // Fix round 1, item 4: a counted item comes back in its finished state, showing its result with "Next" ready (it was dealt
  // again unsolved before, and a miss on that second try could say "comes back in your review list" for a solved puzzle)
  ['G-D19: a rated puzzle answered before a kill is never counted twice after the restore, and never lost; it comes back finished', async (vp) => {
    const page = await newPage(vp, club(), {});
    if (!PH(vp)) return page;
    const sesMsg = () => page.evaluate(() => { const c = document.getElementById('sessionCard'); return { title: (c.querySelector('h3') || {}).textContent || null, next: !!c.querySelector('[data-act="next"]'), retry: !!c.querySelector('[data-act="retry"]'), text: c.textContent }; });
    await goTab(page, 'train'); await page.locator('#ratedBtn').click();
    await solvePuzzle(page);
    const pid = (await onBoard(page)).pid, A = await puzStats(page, pid);
    assert.deepEqual([A.n, A.ok, A.rn, A.stored], [1, 1, 1, 1], 'saved in the profile when it was answered');
    assert.deepEqual([(await saved(page)).train.i, (await saved(page)).train.right, (await saved(page)).train.counted], [0, 1, true]);
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement); // killed before "Next"
    assert.deepEqual((await card(page, 'train')).slice(0, 2), [WORDS.puzzles, 'Puzzle 1 of 10']);
    await open(page, 'train');
    let B = await onBoard(page);
    assert.deepEqual([B.pid, B.i, B.right, B.wrong, B.done], [pid, 0, 1, 0, true], 'the same puzzle, already solved, with its result kept');
    let M = await sesMsg();
    assert.deepEqual([M.title, M.next, M.retry], ['Solved!', true, false], 'it shows its result with Next ready');
    assert.equal(/review list/.test(M.text), false, 'never "comes back in your review list" for a solved puzzle');
    assert.deepEqual(await puzStats(page, pid), A, 'restoring counts nothing');
    assert.deepEqual(await saved(page), { v: 1, learn: null, train: (await saved(page)).train }, 'still saved');
    assert.deepEqual([(await saved(page)).train.i, (await saved(page)).train.counted], [0, true], 'as counted');
    await shot(page, 'fix1_restored_solved');
    let B2 = await onBoard(page);
    assert.deepEqual([B2.right, B2.wrong], [1, 0], 'no score twice');
    assert.deepEqual(await puzStats(page, pid), A, 'no second result, no second rating change');
    // a wrong answer, then a kill: the miss stays one miss
    await next(page); await puzzleReady(page);
    const p2 = (await onBoard(page)).pid, bad = await page.evaluate(() => {
      const c = window.__coach.st, g = c.pz.g, want = c.pz.p.sol[0], ms = g.moves({ verbose: true });
      const m = ms.filter((x) => x.from + x.to !== want.slice(0, 4) && !x.captured && x.san.indexOf('+') < 0 && x.san.indexOf('#') < 0 && x.piece === 'k')[0] || ms.filter((x) => x.from + x.to !== want.slice(0, 4) && !x.captured && x.san.indexOf('#') < 0 && x.san.indexOf('+') < 0)[0];
      return m ? m.from + m.to : null;
    });
    assert.ok(bad, 'a wrong move exists');
    await page.locator('#board .sq[data-sq="' + bad.slice(0, 2) + '"]').click(); await page.locator('#board .sq[data-sq="' + bad.slice(2, 4) + '"]').click();
    await page.waitForFunction(() => window.__coach.st.pz.done, null, { timeout: 30000 });
    B = await onBoard(page);
    if (B.wrong === 1) { // (a quiet move that also wins counts as solved; then there is no miss to check)
      const M = await puzStats(page, p2);
      assert.deepEqual([M.n, M.ok], [1, 0]);
      await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
      assert.deepEqual((await card(page, 'train')).slice(0, 2), [WORDS.puzzles, 'Puzzle 2 of 10']);
      await open(page, 'train');
      B = await onBoard(page);
      assert.deepEqual([B.pid, B.i, B.right, B.wrong, B.done], [p2, 1, 1, 1, true], 'the missed puzzle comes back missed');
      const F2 = await sesMsg();
      assert.deepEqual([F2.title, F2.next, F2.retry], ['Not quite', true, true], 'its result, with Next and Try again, as when it was missed');
      assert.equal(/review list/.test(F2.text), true, 'a miss does come back in the review list');
      assert.equal(await page.evaluate(() => window.__coach.st.arrows.length), 1, 'the winning move is shown');
      await page.locator('#sessionCard [data-act="retry"]').click(); await puzzleReady(page);
      await solvePuzzle(page);
      B = await onBoard(page);
      assert.deepEqual([B.right, B.wrong], [1, 1], 'a second try after the restore changes no score');
      assert.deepEqual(await puzStats(page, p2), M, 'and no rating');
    }
    const r = (await onBoard(page)).right;
    await next(page); await puzzleReady(page);
    await solvePuzzle(page);
    assert.equal((await onBoard(page)).right, r + 1, 'the next puzzle counts as usual');
    assert.equal((await puzStats(page, pid)).rn, 3, 'three puzzles, three results');
    return page;
  }],
  // ---------- fail safe ----------
  ['G-D19 fails safe: a corrupt, stale or unknown saved entry is dropped silently: no error, no card, and the key is cleaned', async (vp) => {
    const GOOD_SET = { k: 'set', kind: 'safety', title: 'Safe or blunder?', unit: null, part: null, count: 2, pass: null, rated: false, theme: null, review: false, i: 1, right: 1, wrong: 0, counted: false };
    let page = await newPage(vp, club(), {});
    const quiz = await page.evaluate(() => window.__coach.PZ.filter((p) => p.pre && p.last && p.preBest).slice(0, 2).map((p) => p.id));
    await page.context().close();
    const good = Object.assign({ items: [[quiz[0], 1], [quiz[1], 0]] }, GOOD_SET);
    const BAD = [
      ['not JSON', '{not json'], ['a string', '"hello"'], ['a number', '42'], ['an array', '[1,2]'], ['null', 'null'],
      ['another version', JSON.stringify({ v: 2, learn: LESSON_E(1), train: good })],
      ['no version', JSON.stringify({ learn: LESSON_E(1) })],
      ['a lesson that is gone', JSON.stringify({ v: 1, learn: { k: 'lesson', unit: 'no-such-unit', i: 0 }, train: null })],
      ['a step the lesson no longer has', JSON.stringify({ v: 1, learn: LESSON_E(99), train: null })],
      ['puzzles that are gone', JSON.stringify({ v: 1, learn: null, train: Object.assign({}, good, { kind: 'puzzles', title: 'Rated puzzles', rated: true, items: ['zz1', 'zz2'] }) })],
      ['an unknown kind', JSON.stringify({ v: 1, learn: { k: 'review', id: 'g1' }, train: Object.assign({}, good, { kind: 'placement' }) })],
      ['broken numbers', JSON.stringify({ v: 1, learn: { k: 'lesson', unit: 'kq', i: '1' }, train: Object.assign({}, good, { i: 7 }) })],
      ['the wrong shapes', JSON.stringify({ v: 1, learn: 'kq', train: 7 })]
    ];
    for (const [name, raw] of BAD) {
      page = await newPage(vp, club(), { game: GAME12, ls: { [RKEY]: raw } });
      assert.deepEqual(page.errors, [], name + ': no error');
      assert.equal(await rawSaved(page), null, name + ': the bad key is removed');
      assert.deepEqual(await visibleIds(page, '#resumePath, #resumeTrain'), [], name);
      await goTab(page, 'path'); assert.deepEqual(await visibleIds(page, '#resumePath'), [], name + ': no card on Learn');
      await goTab(page, 'train'); assert.deepEqual(await visibleIds(page, '#resumeTrain'), [], name + ': no card on Train');
      await goTab(page, 'coach'); assert.notEqual(await page.locator('#contCard .bh-go').innerText(), WORDS.lesson, name + ': Home does not offer a lesson that is not there');
      assert.deepEqual(await hist(page), SANS22, name + ': the game is not touched');
      assert.deepEqual(page.errors, [], name); assert.deepEqual(page.dialogs, [], name);
      await page.context().close();
    }
    // one good entry beside a bad one: the good one is kept (and shown on a phone), the bad one is dropped
    page = await newPage(vp, club(), { ls: { [RKEY]: JSON.stringify({ v: 1, learn: { k: 'lesson', unit: 'gone', i: 0 }, train: Object.assign({ junk: '<img src=x onerror=alert(1)>' }, good) }) } });
    assert.deepEqual(await saved(page), { v: 1, learn: null, train: good }, 'cleaned: the stale lesson is gone, unknown fields are gone');
    // G-D35: the same at every width (a wide screen shows the card too)
    assert.deepEqual(await card(page, 'train'), [WORDS.puzzles, '2 of 2', 'Safe or blunder?', WORDS.puzzles]);
    assert.equal(await card(page, 'learn'), null);
    await open(page, 'train');
    assert.deepEqual([(await onBoard(page)).quiz, (await onBoard(page)).right], [quiz[1], 1], 'it resumes from the saved entry');
    assert.deepEqual(page.errors, []); await page.context().close();
    // a Beginner whose Train tab is still locked cannot open a saved set: dropped. The lesson is kept.
    page = await newPage(vp, prof(), { ls: { [RKEY]: JSON.stringify({ v: 1, learn: LESSON_E(1), train: good }) } });
    assert.deepEqual(await saved(page), { v: 1, learn: LESSON_E(1), train: null }, 'another level’s content the player cannot open is dropped');
    assert.deepEqual(page.errors, []); await page.context().close();
    // the level changes while both wait (Settings; a sign-in merge takes the same path): Train's entry goes, Learn's stays
    page = await newPage(vp, club(), { ls: { [RKEY]: JSON.stringify({ v: 1, learn: LESSON_E(1), train: good }) } });
    assert.deepEqual(await saved(page), { v: 1, learn: LESSON_E(1), train: good });
    await page.evaluate(() => window.__coach.openSettings());
    await page.locator('#levelCard [data-lvset="beginner"]').click();
    assert.deepEqual(await saved(page), { v: 1, learn: LESSON_E(1), train: null }, 'the level change dropped what can no longer be opened');
    await page.locator('#levelCard [data-lvset="club"]').click();
    await page.locator('#settingsSheet [data-act="settingsclose"]').first().click();
    assert.equal(await card(page, 'train'), null, 'it does not come back'); assert.equal((await card(page, 'learn'))[0], WORDS.lesson);
    return page;
  }],
  // ---------- cleared when finished, replaced or abandoned ----------
  ['G-D19: finishing, replacing or ending what waits clears it from the saved key', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    // a lesson: saved while open, gone when it is finished
    await lessonTo(page, 'kq', 1);
    assert.deepEqual(await saved(page), { v: 1, learn: LESSON_E(1), train: null });
    await finishLesson(page);
    assert.equal(await rawSaved(page), null, 'the finished lesson is not saved');
    if (!PH(vp)) {
      // G-D35: wide too: opening the game parks a set and the key keeps it; a new set on Train replaces it
      await page.evaluate(() => window.__coach.trainStart('safety'));
      assert.equal((await saved(page)).train.kind, 'safety');
      await goTab(page, 'play'); await page.locator('#znote-play [data-act="close"]').click();
      assert.equal(await st(page, 'mode'), 'play');
      assert.equal((await saved(page)).train.kind, 'safety', 'wide: parked by "Resume game", still saved');
      await page.evaluate(() => window.__coach.trainStart('rated')); await puzzleReady(page);
      assert.deepEqual([(await saved(page)).train.kind, (await saved(page)).train.rated], ['puzzles', true], 'wide: replaced on its own tab');
      return page;
    }
    await goTab(page, 'path'); assert.equal(await resume(page, 'resumePath'), null);
    // a set: saved while it runs, gone when its last item is done
    await goTab(page, 'train');
    const ids = await dueMulti(page);
    await page.evaluate(() => window.__coach.trainStart('review'));
    await puzzleReady(page);
    assert.deepEqual([(await saved(page)).train.review, (await saved(page)).train.count, (await saved(page)).train.items.slice().sort()], [true, 2, ids.slice().sort()]);
    await solvePuzzle(page); await next(page); await puzzleReady(page); await solvePuzzle(page);
    assert.equal((await saved(page)).train.i, 1);
    await page.locator('#sessionCard [data-act="next"]').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished);
    assert.equal(await rawSaved(page), null, 'the finished set is not saved');
    await goTab(page, 'coach'); await goTab(page, 'train'); assert.equal(await resume(page, 'resumeTrain'), null);
    // replaced: the newest on a tab is the one that is saved
    await lessonTo(page, 'kq', 2); await closeX(page);
    await lessonTo(page, 'kr', 1);
    assert.deepEqual((await saved(page)).learn, { k: 'lesson', unit: 'kr', i: 1 });
    await closeX(page);
    await goTab(page, 'train'); await page.locator('#ratedBtn').click(); await puzzleReady(page); await closeX(page);
    await page.locator('#panel-train [data-train="safety"]').click();
    let S = await saved(page);
    assert.deepEqual([S.learn.unit, S.train.kind], ['kr', 'safety']);
    // an endgame drill that ends (out of moves) is over: cleared, and its card is gone
    await closeX(page); await page.locator('#drillList [data-drill]').first().click(); await idle(page);
    assert.equal((await saved(page)).train.kind, 'drill');
    await page.evaluate(() => { const d = window.__coach.st.dr; d.moves = d.limit - 1; });
    await page.locator('#board .sq[data-sq="a1"]').click(); await page.locator('#board .sq[data-sq="a2"]').click();
    await page.waitForFunction(() => window.__coach.st.dr && window.__coach.st.dr.done, null, { timeout: 20000 });
    S = await saved(page);
    assert.deepEqual([S.learn.unit, S.train], ['kr', null], 'the ended drill is cleared; the lesson on Learn still waits');
    assert.deepEqual(page.dialogs, []);
    return page;
  }],
  // ---------- fix round 1, item 4: a square, and an opening line, already scored come back finished ----------
  ['Item 4: a board-drill square and an opening line already scored before a kill are not dealt again unanswered', async (vp) => {
    let page = await newPage(vp, club(), {});
    if (!PH(vp)) return page;
    // the board drill: a wrong tap is scored at once; the next square is dealt 1.5 seconds later. Killed in between.
    await page.evaluate(() => window.__coach.startPart('board', 'practice'));
    await page.waitForFunction(() => window.__coach.st.sq && !window.__coach.st.sq.done);
    const wrong = await page.evaluate(() => { const t = window.__coach.st.sq.target; return t === 'a1' ? 'h8' : 'a1'; });
    await page.locator('#board .sq[data-sq="' + wrong + '"]').click();
    let S = await saved(page);
    assert.deepEqual([S.learn.i, S.learn.right, S.learn.wrong, S.learn.counted], [0, 0, 1, true], 'the miss is saved, counted');
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    await open(page, 'learn');
    let B = await onBoard(page);
    assert.deepEqual([B.kind, B.i, B.right, B.wrong], ['squares', 1, 0, 1], 'the next square is dealt: the scored one is not asked again');
    assert.equal(await page.evaluate(() => window.__coach.st.sq.done), false);
    assert.deepEqual([(await saved(page)).learn.i, (await saved(page)).learn.counted], [1, false]);
    await page.context().close();
    // an opening line played to its end: "Line complete" with Next; killed before Next
    page = await newPage(vp, club(), {});
    await goTab(page, 'train'); await page.locator('#bookList [data-book]').nth(1).click();
    for (let k = 0; k < 40; k++) {
      await page.waitForFunction(() => { const b = window.__coach.st.bk; return b && (b.done || (!b.wait && b.g.turn() === b.side)); }, null, { timeout: 10000 });
      const mv = await page.evaluate(() => { const b = window.__coach.st.bk; if (b.done) return null; const g = new window.Chess(b.g.fen()), m = g.move(b.line.moves[b.ply]); return m.from + m.to; });
      if (!mv) break;
      await page.locator('#board .sq[data-sq="' + mv.slice(0, 2) + '"]').click(); await page.locator('#board .sq[data-sq="' + mv.slice(2, 4) + '"]').click();
    }
    const L0 = await page.evaluate(() => { const b = window.__coach.st.bk; return { fen: b.g.fen(), line: b.line.id }; });
    S = await saved(page);
    assert.deepEqual([S.train.kind, S.train.i, S.train.right, S.train.counted], ['book', 0, 1, true]);
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    await open(page, 'train');
    B = await onBoard(page);
    assert.deepEqual([B.mode, B.line, B.right, B.wrong], ['book', L0.line, 1, 0]);
    const R = await page.evaluate(() => { const b = window.__coach.st.bk, c = document.getElementById('sessionCard'); return { done: b.done, fen: b.g.fen(), title: c.querySelector('h3').textContent, next: !!c.querySelector('[data-act="next"]') }; });
    assert.deepEqual(R, { done: true, fen: L0.fen, title: 'Line complete, no mistakes', next: true }, 'the line comes back complete, Next ready (round 2: with its own outcome, saved)');
    await page.locator('#sessionCard [data-act="next"]').click();
    await page.waitForFunction(() => window.__coach.st.ses.finished);
    assert.deepEqual([await page.evaluate(() => window.__coach.st.ses.right), await rawSaved(page)], [1, null], 'Next ends the set with its one result');
    assert.equal((await G.endCard(page, '#sessionCard')).title, 'Session complete', 'round 2, item 1: its end card');
    return page;
  }],
  // ---------- fix round 2 ----------
  ['Round 2, item 1: the last item of a set, counted, then a restart or a Close inside the wait: Resume shows the set’s end card', async (vp) => {
    let page = await newPage(vp, club(), {});
    if (!PH(vp)) return page;
    const toLast = async () => {
      await page.evaluate(() => window.__coach.startPart('board', 'practice'));
      await page.waitForFunction(() => window.__coach.st.sq && !window.__coach.st.sq.done);
      await page.evaluate(() => { const s = window.__coach.st.ses; s.i = s.count - 1; s.right = s.count - 1; }); // the last square, all right so far
      const t = await page.evaluate(() => { const x = window.__coach.st.sq.target; return x === 'a1' ? 'h8' : 'a1'; });
      await page.locator('#board .sq[data-sq="' + t + '"]').click(); // a miss: the end comes 1.5 seconds later
    };
    const endShown = async (why) => {
      const L = await look(page), E = await G.endCard(page, '#sessionCard');
      assert.deepEqual([L.scr, L.tab, L.board, L.tabs, L.end, E.shown, E.title], ['act', 'path', true, true, '1', true, 'Session complete'], why + ': the board screen with the set’s end card, the tabs back');
    };
    // a restart in the wait
    await toLast();
    const S = await saved(page);
    assert.deepEqual([S.learn.i, S.learn.counted, S.learn.count], [11, true, 12]);
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    assert.deepEqual((await card(page, 'learn')).slice(0, 2), [WORDS.drill, '12 of 12']);
    await open(page, 'learn');
    await endShown('after a restart');
    await shot(page, 'fix2_last_item_end');
    // a Close in the wait: the set ends on its own while closed; its card stays and opens the end card
    await closeX(page); await goTab(page, 'coach');
    await toLast();
    await closeX(page);
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished, null, { timeout: 5000 });
    assert.deepEqual((await card(page, 'learn')).slice(0, 2), [WORDS.drill, '12 of 12'], 'the card stays until the end card is seen');
    await open(page, 'learn');
    await endShown('after a Close');
    await closeX(page);
    assert.equal(await card(page, 'learn'), null, 'seen: it is gone');
    await page.context().close();
    // a puzzle set: the last puzzle solved, a restart before Next: it comes back solved; Next shows the end card
    page = await newPage(vp, club(), {});
    await goTab(page, 'train');
    await dueMulti(page);
    await page.evaluate(() => window.__coach.trainStart('review'));
    await puzzleReady(page); await solvePuzzle(page); await next(page); await puzzleReady(page); await solvePuzzle(page);
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    await open(page, 'train');
    assert.deepEqual([(await onBoard(page)).done, (await onBoard(page)).i], [true, 1]);
    await page.locator('#sessionCard [data-act="next"]').click();
    const E = await G.endCard(page, '#sessionCard'), L = await look(page);
    assert.deepEqual([E.shown, E.title, L.scr, L.tabs], [true, 'Session complete', 'act', true]);
    return page;
  }],
  ['Round 2, items 4 and 5: a counted item comes back as the saved entry says (not the profile); Safe or blunder comes back answered', async (vp) => {
    let page = await newPage(vp, club(), {});
    if (!PH(vp)) return page;
    await goTab(page, 'train'); await page.locator('#ratedBtn').click(); await solvePuzzle(page);
    const pid = (await onBoard(page)).pid;
    assert.deepEqual([(await saved(page)).train.counted, (await saved(page)).train.ok], [true, true], 'the outcome is saved with the item');
    // the profile's record of that puzzle changes meanwhile (another set, or a merge): the set's own outcome wins
    await page.evaluate(([k, id]) => { const p = JSON.parse(localStorage.getItem(k)); p.puz[id].box = 0; localStorage.setItem(k, JSON.stringify(p)); }, [G.PKEY, pid]);
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    await open(page, 'train');
    assert.equal(await page.evaluate(() => document.querySelector('#sessionCard h3').textContent), 'Solved!', 'as the set recorded it');
    await page.context().close();
    // Safe or blunder: answered, then a reload; and answered, then Close and Resume
    page = await newPage(vp, club(), {});
    await goTab(page, 'train'); await page.locator('#panel-train [data-train="safety"]').click();
    const q = await page.evaluate(() => ({ id: window.__coach.st.qz.it.p.id, blunder: window.__coach.st.qz.it.blunder }));
    await page.locator(q.blunder ? '#qSafe' : '#qBlunder').click(); // the wrong answer
    const A = await page.evaluate(() => ({ title: document.querySelector('#sessionCard h3').textContent, arrows: JSON.stringify(window.__coach.st.arrows) }));
    assert.deepEqual([(await saved(page)).train.counted, (await saved(page)).train.ok], [true, false]);
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    await open(page, 'train');
    const R = await page.evaluate(() => { const c = window.__coach.st; return { answered: c.qz.answered, id: c.qz.it.p.id, title: document.querySelector('#sessionCard h3').textContent, next: !!document.querySelector('#sessionCard [data-act="next"]'), quiz: !document.getElementById('quizControls').hidden, arrows: JSON.stringify(c.arrows), right: c.ses.right, wrong: c.ses.wrong }; });
    assert.deepEqual(R, { answered: true, id: q.id, title: A.title, next: true, quiz: false, arrows: A.arrows, right: 0, wrong: 1 }, 'its verdict, Next ready, nothing counted again');
    return page;
  }],
  ['Round 2, item 6: Today’s Train step, when it resumes a set, names that set', async (vp) => {
    const page = await newPage(vp, club(), {});
    await goTab(page, 'train'); await page.locator('#panel-train [data-train="safety"]').click();
    if (PH(vp)) await closeX(page);
    await goTab(page, 'coach');
    assert.deepEqual(await page.evaluate(() => { const s = document.querySelector('#today .step3.z-train'); return [s.querySelector('.st').textContent, s.querySelector('.zb').textContent]; }), ['Safe or blunder?', WORDS.puzzles]);
    return page;
  }],
  // ---------- fix round 1, item 5 ----------
  ['Item 5: a new endgame drill starts with no arrow or highlight from the game or an old drill', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    if (PH(vp)) await open(page, 'play');
    await idle(page);
    assert.equal(await page.evaluate(() => window.__coach.st.arrows.length), 1, 'the game shows the engine’s last move');
    if (PH(vp)) await closeX(page);
    await goTab(page, 'train'); await page.locator('#drillList [data-drill]').first().click(); await idle(page);
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, window.__coach.st.arrows.length, window.__coach.st.hls.length, window.__coach.st.hintLvl]), ['drill', 0, 0, 0], 'a clean board');
    // a drill's arrow does not carry into the next drill either
    await page.locator('#board .sq[data-sq="b1"]').click(); await page.locator('#board .sq[data-sq="b5"]').click();
    await page.waitForFunction(() => { const c = window.__coach.st; return c.dr.g.turn() === 'w' && !c.busy && c.arrows.length === 1; }, null, { timeout: 20000 });
    await page.evaluate(() => window.__coach.startPart('kq', 'apply')); await idle(page);
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, window.__coach.st.dr.moves, window.__coach.st.arrows.length]), ['drill', 0, 0]);
    return page;
  }],
  // ---------- fix round 1, item 7: the busy fix on a wide screen ----------
  ['Item 7 (wide): the game’s engine thinking never locks a lesson or a puzzle set opened meanwhile, and its reply draws nothing there', async (vp) => {
    const page = await newPage(vp, club(), { game: game(SANS22, { level: 4 }), tab: 'play' }); // level 4 and up: Stockfish (Brain.play) replies
    if (PH(vp)) return page; // the phone cases are above
    await idle(page);
    // the engine's reply is held back 2.5 seconds, so it lands while something else is on the board
    const slow = () => page.evaluate(() => { const o = window.Brain.play; window.Brain.play = function () { const a = arguments; return new Promise((r) => setTimeout(() => o.apply(window.Brain, a).then(r), 2500)); }; });
    const think = async (from, to, n) => { await move(page, from, to); await page.waitForFunction((k) => window.__coach.hist().length === k && window.__coach.st.gb, n, { timeout: 30000 }); };
    await slow();
    // a lesson
    await think('a2', 'a3', 23);
    const A = await page.evaluate(() => { window.__coach.startPart('kq', 'learn'); const c = window.__coach.st; return { mode: c.mode, busy: c.busy, arrows: JSON.stringify(c.arrows) }; });
    assert.deepEqual([A.mode, A.busy], ['lesson', false], 'the lesson is not locked by the game’s engine');
    await page.locator('#navNext').click();
    assert.equal(await page.evaluate(() => window.__coach.st.ls.i), 1, 'the lesson goes on');
    const arrows1 = await page.evaluate(() => JSON.stringify(window.__coach.st.arrows));
    await page.waitForFunction(() => window.__coach.hist().length === 24 && !window.__coach.st.gb, null, { timeout: 30000 });
    await page.waitForTimeout(300);
    assert.deepEqual([await st(page, 'mode'), await page.evaluate(() => JSON.stringify(window.__coach.st.arrows))], ['lesson', arrows1], 'the reply drew nothing on the lesson’s board');
    // a puzzle set
    await goTab(page, 'play'); await page.locator('#znote-play [data-act="close"]').click(); await idle(page);
    await think('a3', 'a4', 25);
    await page.evaluate(() => window.__coach.trainStart('rated'));
    await puzzleReady(page); // not busy: the board takes a move
    assert.equal(await st(page, 'busy'), false);
    await solvePuzzle(page);
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.pz.done, window.__coach.st.ses.right]), [true, 1], 'the puzzle board took the moves');
    const arrows2 = await page.evaluate(() => JSON.stringify(window.__coach.st.arrows));
    await page.waitForFunction(() => window.__coach.hist().length === 26 && !window.__coach.st.gb, null, { timeout: 30000 });
    await page.waitForTimeout(300);
    assert.deepEqual([await st(page, 'mode'), await page.evaluate(() => JSON.stringify(window.__coach.st.arrows))], ['puzzle', arrows2], 'the reply drew nothing on the puzzle’s board');
    return page;
  }],
  // ---------- fix round 1, item 8 ----------
  ['Item 8: the game’s own Flip comes back with the game, and a hint’s words do not outlive the hint count', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    const toGame = async () => { if (PH(vp)) { await closeX(page); await open(page, 'play'); } else { await goTab(page, 'play'); await page.locator('#znote-play [data-act="close"]').click(); } await idle(page); };
    if (PH(vp)) await open(page, 'play');
    await idle(page);
    await page.locator('#flipBtn').click();
    assert.equal(await st(page, 'flipped'), true);
    // a lesson and a set use the board, unflipped
    if (PH(vp)) await closeX(page);
    await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
    assert.equal(await st(page, 'flipped'), false, 'the lesson’s board is not flipped');
    await toGame();
    assert.equal(await st(page, 'flipped'), true, 'the game comes back flipped');
    if (PH(vp)) await closeX(page);
    await page.evaluate(() => window.__coach.trainStart('rated')); await puzzleReady(page);
    assert.equal(await st(page, 'flipped'), false);
    await toGame();
    assert.equal(await st(page, 'flipped'), true, 'again after a set');
    assert.equal((await savedGame(page)).flipped, true, 'and saved so');
    // a hint, then the board changes hands: the coach line does not keep "Hint 1" while the count is back to 0
    await page.locator('#hintBtn').click();
    await page.waitForFunction(() => window.__coach.st.hintLvl === 1 && !window.__coach.st.busy, null, { timeout: 20000 });
    const before = await page.evaluate(() => window.__coach.st.fb.title);
    assert.match(before, /^Hint 1/);
    if (PH(vp)) await closeX(page);
    await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
    await toGame();
    const after = await page.evaluate(() => ({ lvl: window.__coach.st.hintLvl, title: document.getElementById('vTitle').textContent, fb: window.__coach.st.fb && window.__coach.st.fb.title }));
    assert.equal(after.lvl, 0, 'the hint count was reset');
    assert.ok(!/^Hint/.test(after.title) && !/^Hint/.test(after.fb || ''), 'the coach line matches it: ' + JSON.stringify(after));
    // the next Hint starts at the first again
    await page.locator('#hintBtn').click();
    await page.waitForFunction(() => window.__coach.st.hintLvl === 1 && !window.__coach.st.busy, null, { timeout: 20000 });
    assert.match(await page.evaluate(() => document.getElementById('vTitle').textContent), /^Hint 1/);
    return page;
  }],
  // Round 2, item 7: the outcome only (a failed write is tried again on a later change; the key ends right), never how many
  // renders one click makes (the game's own analysis may render in between)
  ['Item 8: a failed write of the saved key is tried again on the next change of any kind', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    await lessonTo(page, 'kq', 1);
    assert.deepEqual((await saved(page)).learn, LESSON_E(1));
    // the device refuses to write the key while __block is on (storage full)
    await page.evaluate((k) => { const o = Storage.prototype.setItem; window.__n = 0; window.__block = true; Storage.prototype.setItem = function (a, b) { if (a === k && window.__block) { window.__n++; throw new Error('QuotaExceededError'); } return o.call(this, a, b); }; }, RKEY);
    const change = async () => { await page.evaluate(() => window.__coach.openSettings()); await page.locator('#settingsSheet [data-act="tags"]').click(); await page.locator('#settingsSheet [data-act="tags"]').click(); await page.locator('#settingsSheet [data-act="settingsclose"]').first().click(); };
    for (const [step, why] of [[2, 'once'], [3, 'again, after more failures']]) {
      await page.locator('#navNext').click();
      await page.waitForTimeout(600);
      const n = await page.evaluate(() => window.__n);
      assert.ok(n >= 1 && n < 50, why + ': tried, and not in a loop: ' + n);
      assert.equal((await saved(page)).learn.i, step - 1, why + ': the old step is still on the device');
      await page.evaluate(() => { window.__block = false; });
      await change(); // a change that does not change the entry (the Piece tags switch, on and off)
      assert.deepEqual((await saved(page)).learn, LESSON_E(step), why + ': the next change writes the right step');
      await page.evaluate(() => { window.__block = true; window.__n = 0; });
    }
    assert.deepEqual(page.errors, []);
    return page;
  }],
  // ---------- G-D36: a game that ended while it was closed ----------
  ['G-D36: the engine mates while the game is closed: "Your game ended" first on Play and Home, through a restart; See the end opens the end card once', async (vp) => {
    const page = await newPage(vp, club(), { game: game(['f3', 'e5'], { level: 4 }), tab: 'play' }); // level 4 and up: Stockfish (Brain.play) replies
    if (PH(vp)) await open(page, 'play');
    await idle(page);
    // the engine's reply (the mate) is held back 2 seconds; the player leaves the game in that time
    await page.evaluate(() => { window.Brain.play = () => new Promise((r) => setTimeout(() => r('d8h4'), 2000)); });
    await move(page, 'g2', 'g4');
    await page.waitForFunction(() => window.__coach.st.gb, null, { timeout: 30000 });
    if (PH(vp)) await closeX(page);
    else await page.evaluate(() => window.__coach.trainStart('rated')); // wide: a set takes the board
    await page.waitForFunction(() => window.__coach.hist().length === 4, null, { timeout: 30000 });
    await page.waitForFunction((k) => JSON.parse(localStorage.getItem(k)).recorded === true, G.GKEY, { timeout: 10000 });
    if (!PH(vp)) {
      // wide: no card anywhere (there is no Resume game card on wide); the finished game is on the board as today
      assert.deepEqual(await visibleIds(page, '#resumePlay, #resumeHome'), []);
      await goTab(page, 'play'); await shot(page, 'fix1_ended_play');
      // round 2, item 2: the note and the mode bar never call a finished game paused or offer to resume it
      const Z = await page.evaluate(() => ({ note: document.getElementById('znote-play').innerText, btns: [...document.querySelectorAll('#znote-play button')].map((b) => b.textContent), bar: document.getElementById('modeExit').textContent }));
      assert.ok(/Your game ended\./.test(Z.note) && !/paused/.test(Z.note), 'the note: ' + Z.note);
      assert.deepEqual([Z.btns[0], Z.bar], ['See the end', 'See the end'], 'the note’s button and the mode bar');
      await goTab(page, 'train');
      assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('#znote-train button')].map((b) => b.textContent)).then((b) => b.filter((t) => /Resume game/.test(t))), [], 'no "Resume game" for a finished game on any note');
      await goTab(page, 'play');
      await page.locator('#znote-play [data-act="close"]').click();
      const c = await G.endCard(page, '#gameEnd');
      assert.deepEqual([c.shown, c.title, c.main], [true, 'Checkmate', 'Review this game'], 'wide: the end card, as today');
      assert.equal(await page.evaluate(() => window.__coach.st.unseen), false, 'seen');
      await shot(page, 'fix1_see_the_end');
      await goTab(page, 'coach');
      assert.deepEqual(await visibleIds(page, '.rs-card'), []);
      await shot(page, 'fix1_ended_home');
      return page;
    }
    const ENDED = ['Your game ended', 'Checkmate. Engine wins.', null, 'See the end']; // round 2, item 3: the line says who won
    const C = await cards(page);
    assert.deepEqual(C.play, ENDED, 'Play: the result card, the end card’s own line');
    await goTab(page, 'play');
    const P = await resume(page, 'resumePlay');
    assert.equal(P.primary, true, 'See the end is Play’s main button');
    assert.equal(await page.locator('#newBtn').evaluate((b) => b.classList.contains('primary')), false, 'one main button on Play');
    assert.deepEqual(await page.locator('#resumePlay button').evaluateAll((bs) => bs.map((b) => [b.textContent, b.getBoundingClientRect().height >= 44])), [['See the end', true], ['Review', true]]);
    assert.equal((await visibleIds(page, '#panel-play > *'))[0], 'resumePlay', 'first on Play');
    await shot(page, 'fix1_ended_play');
    await goTab(page, 'coach');
    const H = await resume(page, 'resumeHome');
    assert.deepEqual([H.title, H.line, H.button, H.primary], ['Your game ended', 'Checkmate. Engine wins.', 'See the end', false], 'Home: the same card, under the Continue card');
    assert.ok(!/Resume game/.test(await G.text(page)), 'no Resume game for a finished game');
    await shot(page, 'fix1_ended_home');
    // through a restart
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    assert.equal((await look(page)).tab, 'coach');
    assert.deepEqual((await resume(page, 'resumeHome')).title, 'Your game ended', 'Home, after a restart');
    assert.deepEqual((await cards(page)).play, ENDED, 'Play, after a restart');
    // See the end: the board screen at the final position, the game's end card, the tabs back (F1)
    await goTab(page, 'play'); await page.locator('#resumePlay .rs-go').click();
    const L = await look(page);
    assert.deepEqual([L.mode, L.scr, L.tab, L.board, L.tabs], ['play', 'act', 'play', true, true]);
    assert.deepEqual(await hist(page), ['f3', 'e5', 'g4', 'Qh4#']);
    const E = await G.endCard(page, '#gameEnd');
    assert.deepEqual([E.shown, E.title, E.main, E.small], [true, 'Checkmate', 'Review this game', ['New game', 'Home']]);
    await shot(page, 'fix1_see_the_end');
    await closeX(page);
    assert.deepEqual(await cards(page), { play: null, learn: null, train: null }, 'opened once: the card is gone');
    await goTab(page, 'coach'); assert.equal(await resume(page, 'resumeHome'), null);
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    assert.equal(await resume(page, 'resumeHome'), null, 'and it stays gone after a restart');
    assert.deepEqual(page.dialogs, []);
    return page;
  }],
  ['G-D36: Review opens the review and the card goes; a new game ends it too; a game whose own last move ended it before a kill gets the card; Beginner Home', async (vp) => {
    const OVER = ['f3', 'e5', 'g4', 'Qh4#'];
    let page = await newPage(vp, club(), { game: game(OVER, { recorded: true, unseen: true }), tab: 'play' });
    if (!PH(vp)) { assert.deepEqual(await visibleIds(page, '.rs-card'), [], 'wide: no card'); return page; }
    await goTab(page, 'play');
    await page.locator('#resumePlay button', { hasText: 'Review' }).click();
    let L = await look(page);
    assert.deepEqual([L.mode, L.scr, L.tab], ['review', 'act', 'play'], 'the review of this game, as the end card’s Review');
    assert.equal(await page.evaluate(() => window.__coach.st.rv.past), false);
    await closeX(page);
    assert.equal(await resume(page, 'resumePlay'), null, 'opened: the card is gone');
    assert.equal((await savedGame(page)).unseen, false, 'and saved so');
    await page.context().close();
    // a new game
    page = await newPage(vp, club(), { game: game(OVER, { recorded: true, unseen: true }), tab: 'play' });
    await goTab(page, 'play');
    assert.equal((await resume(page, 'resumePlay')).title, 'Your game ended');
    await page.locator('#newBtn').click();
    assert.deepEqual(await hist(page), []);
    await closeX(page);
    assert.equal(await resume(page, 'resumePlay'), null, 'a new game with no move yet: no card at all');
    assert.ok(!/Your game ended/.test(await G.text(page)), 'the old result is gone');
    assert.equal((await savedGame(page)).unseen, false);
    await page.context().close();
    // the player's own mating move was saved, then the app was killed before it was checked: the next start finishes the game
    page = await newPage(vp, club(), { game: game(['e4', 'e5', 'Bc4', 'Nc6', 'Qh5', 'Nf6', 'Qxf7#'], { recorded: false }), tab: 'play' });
    assert.equal(await page.evaluate(() => window.__coach.getProf().games.length), 1, 'recorded at start');
    const H = await resume(page, 'resumeHome');
    assert.deepEqual([H.title, H.line], ['Your game ended', 'Checkmate. You win!']);
    await page.context().close();
    // Beginner Home: the card under the Continue card, in Resume game's place; Beginner words
    page = await newPage(vp, prof(), { game: game(OVER, { recorded: true, unseen: true }), tab: 'play' });
    const B = await page.evaluate(() => { const e = document.querySelector('#bhome .rs-card'); return e && e.getClientRects().length ? { title: e.querySelector('.bh-title').textContent, line: e.querySelector('.rs-line').textContent, go: e.querySelector('.rs-go').textContent } : null; });
    assert.deepEqual(B, { title: 'Your game ended', line: 'Checkmate. Rani’s partner wins.', go: 'See the end' }, 'G-D28: a Beginner never reads "engine"');
    await page.locator('#bhome .rs-go').click();
    const E = await G.endCard(page, '#gameEnd');
    assert.deepEqual([E.shown, E.title], [true, 'Checkmate']);
    assert.match(await page.locator('#gameEnd .ec-text').innerText(), /Rani’s partner wins/, 'the end card in a Beginner’s words');
    return page;
  }],
  // ---------- G-D37: Home and Today resume what waits ----------
  ['G-D37: Home’s Continue and Today’s Learn step resume a waiting practice set or drill; Today’s Train step resumes a waiting set', async (vp) => {
    const away = async (page) => { if (PH(vp)) await closeX(page); await goTab(page, 'coach'); };
    const homeBtns = (page) => page.evaluate(() => [document.querySelector('#contCard .bh-go').textContent, document.querySelector('#today .step3.z-learn .zb').textContent, (document.querySelector('#today .step3.z-train .zb') || {}).textContent || null]);
    // a lesson's practice puzzles
    let page = await newPage(vp, improver({ course: { fork: { learn: NOW - DAY } } }), {});
    await goTab(page, 'coach');
    assert.deepEqual((await homeBtns(page)).slice(0, 2), ['Continue', 'Start lesson'], 'nothing waits yet');
    await page.locator('#contCard .bh-go').click();
    await puzzleReady(page);
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.ses.unit, window.__coach.st.ses.part]), ['fork', 'practice']);
    await solvePuzzle(page); await next(page); await puzzleReady(page);
    const P0 = await onBoard(page);
    await away(page);
    assert.deepEqual(await homeBtns(page), [WORDS.puzzles, WORDS.puzzles, 'Start training'], 'Resume puzzles on the Continue card and the Learn step');
    await shot(page, 'fix1_home_practice_waits');
    await page.locator('#contCard .bh-go').click(); await puzzleReady(page);
    let B = await onBoard(page);
    assert.deepEqual([B.kind, B.i, B.right, B.pid], ['puzzles', 1, 1, P0.pid], 'resumed at its place, not started again');
    await away(page);
    await page.locator('#today .step3.z-learn .zb').click(); await puzzleReady(page);
    B = await onBoard(page);
    assert.deepEqual([B.i, B.right, B.pid], [1, 1, P0.pid], 'Today’s Learn step too');
    // Today's Train step: a set waiting on Train
    await away(page);
    await goTab(page, 'train'); await page.locator('#ratedBtn').click(); await puzzleReady(page);
    const T0 = await onBoard(page);
    await away(page);
    assert.deepEqual(await homeBtns(page), [WORDS.puzzles, WORDS.puzzles, WORDS.puzzles], 'Learn’s practice and Train’s set both wait');
    await shot(page, 'fix1_today_train_waits');
    await page.locator('#today .step3.z-train .zb').click(); await puzzleReady(page);
    B = await onBoard(page);
    assert.deepEqual([B.kind, B.i, B.pid, await st(page, 'tab')], ['puzzles', 0, T0.pid, 'train'], 'Today’s Train step resumes it');
    // a drill on Train
    await away(page); await goTab(page, 'train'); await page.locator('#drillList [data-drill]').first().click(); await idle(page);
    await away(page);
    assert.equal((await homeBtns(page))[2], WORDS.drill, 'a drill waiting on Train: Resume drill');
    assert.deepEqual(page.dialogs, []);
    await page.context().close();
    // a lesson's drill: the Continue card resumes it, keeping its moves
    page = await newPage(vp, club({ course: { kq: { learn: NOW - DAY } } }), {});
    await goTab(page, 'coach');
    await page.locator('#contCard .bh-go').click(); await idle(page);
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, window.__coach.st.ses.part]), ['drill', 'apply']);
    await page.locator('#board .sq[data-sq="b1"]').click(); await page.locator('#board .sq[data-sq="b5"]').click();
    await page.waitForFunction(() => { const c = window.__coach.st; return c.dr.moves === 1 && c.dr.g.turn() === 'w' && !c.busy; }, null, { timeout: 20000 });
    const fen = await page.evaluate(() => window.__coach.st.dr.g.fen());
    await away(page);
    assert.deepEqual((await homeBtns(page)).slice(0, 2), [WORDS.drill, WORDS.drill]);
    await page.locator('#contCard .bh-go').click(); await idle(page);
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, window.__coach.st.dr.moves, window.__coach.st.dr.g.fen()]), ['drill', 1, fen], 'the same drill, its move kept');
    // another part of a lesson still replaces what waits, with no question (G-D20)
    await away(page);
    await page.evaluate(() => window.__coach.startPart('kr', 'learn'));
    assert.deepEqual((await saved(page)).learn, { k: 'lesson', unit: 'kr', i: 0 });
    await away(page);
    assert.notEqual((await homeBtns(page))[0], WORDS.drill, 'the drill no longer waits');
    assert.deepEqual(page.dialogs, []);
    return page;
  }],
  // ---------- wide screens (G-D35) ----------
  ['Wide (1280): G-D35. A saved key shows its Resume cards on Learn and Train; Home resumes the lesson; the game opened over one parks it; the rest as before', async (vp) => {
    if (PH(vp)) return newPage(vp, club(), {});
    let page = await newPage(vp, club(), {});
    const quiz = await page.evaluate(() => window.__coach.PZ.filter((p) => p.pre && p.last && p.preBest).slice(0, 2).map((p) => p.id));
    const first = async (p) => ({ tab: await st(p, 'tab'), mode: await st(p, 'mode'), panel: await visibleIds(p, '#panel-train > *'), coach: await visibleIds(p, '#panel-coach > *'), cont: await p.evaluate(() => { const b = document.querySelector('#contCard .bh-go'); return b ? b.textContent : null; }) });
    await goTab(page, 'train'); const T0 = await first(page);
    await page.context().close();
    const good = { k: 'set', kind: 'safety', title: 'Safe or blunder?', unit: null, part: null, count: 2, pass: null, rated: false, theme: null, review: false, i: 1, right: 1, wrong: 0, counted: false, items: [[quiz[0], 1], [quiz[1], 0]] };
    const key = { v: 1, learn: LESSON_E(1), train: good };
    page = await newPage(vp, club(), { game: GAME12, tab: 'train', ls: { [RKEY]: JSON.stringify(key) } });
    const n = await steps(page, 'kq');
    let L = await look(page);
    assert.deepEqual([L.tab, L.board, L.bar, L.mode], ['train', true, false, 'play'], 'wide: starts on the stored tab with the board, as before');
    assert.deepEqual(await visibleIds(page, '#actBar'), [], 'wide: no Close bar');
    let R = await resume(page, 'resumeTrain');
    assert.deepEqual([R.title, R.line, R.kick, R.button], [WORDS.puzzles, '2 of 2', 'Safe or blunder?', WORDS.puzzles], 'G-D35: Train’s Resume card');
    assert.deepEqual((await first(page)).panel.filter((id) => id !== 'resumeTrain'), T0.panel, 'the rest of Train’s page is as it is without a saved key');
    await shot(page, 'fix1_wide_train_resume');
    await goTab(page, 'path');
    R = await resume(page, 'resumePath');
    assert.deepEqual([R.title, R.line, R.kick, R.button], [WORDS.lesson, 'Lesson · step 2 of ' + n, 'Mate with king and queen', WORDS.lesson], 'G-D35: Learn’s Resume card');
    await goTab(page, 'coach');
    assert.equal(await page.locator('#contCard .bh-go').innerText(), WORDS.lesson, 'G-D37: Home’s Continue card resumes the waiting lesson on wide too');
    assert.equal(await page.locator('#today .step3.z-learn .zb').innerText(), WORDS.lesson, 'and Today’s Learn step');
    assert.equal(await page.locator('#today .step3.z-train .zb').innerText(), WORDS.puzzles, 'Today’s Train step resumes the set');
    assert.deepEqual(await saved(page), key, 'the key is kept as it is');
    // the lesson comes back at its step; the game is not touched
    await page.locator('#contCard .bh-go').click();
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, window.__coach.st.ls.i, window.__coach.st.tab]), ['lesson', 1, 'path']);
    await page.locator('#navNext').click();
    // opening the game over it parks it at its new step (D50 ended it here before)
    await goTab(page, 'play'); await page.locator('#znote-play [data-act="close"]').click();
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, window.__coach.st.ls]), ['play', null]);
    assert.deepEqual(await hist(page), SANS22);
    assert.deepEqual(await saved(page), { v: 1, learn: LESSON_E(2), train: good }, 'the lesson waits at step 3; Train’s entry was not touched');
    assert.equal((await card(page, 'learn'))[1], 'Lesson · step 3 of ' + n);
    // Train's set resumes at its place, from its card
    await open(page, 'train');
    assert.deepEqual([(await onBoard(page)).quiz, (await onBoard(page)).right, (await onBoard(page)).i], [quiz[1], 1, 1], 'the same question, the same score');
    assert.equal(await resume(page, 'resumeTrain'), null, 'no card for what is on the board');
    // a lesson opened from Learn's list while the set is on the board: the set waits (it did end here before)
    await page.evaluate(() => window.__coach.startPart('kr', 'learn'));
    assert.deepEqual((await saved(page)).train, good, 'the set waits');
    assert.deepEqual((await saved(page)).learn, { k: 'lesson', unit: 'kr', i: 0 }, 'the newest lesson on Learn replaced the old one, with no question');
    // the same device held upright (a phone turned back): the cards are there as on any phone
    await goTab(page, 'play'); await page.locator('#znote-play [data-act="close"]').click();
    await goTab(page, 'coach'); // (the game on a wide board is the open activity: turned upright on Play it would be the board screen)
    await page.setViewportSize({ width: 412, height: 915 }); await page.waitForTimeout(200);
    assert.deepEqual(await card(page, 'train'), [WORDS.puzzles, '2 of 2', 'Safe or blunder?', WORDS.puzzles]);
    assert.equal((await card(page, 'learn'))[2], 'Mate with king and rook');
    await page.setViewportSize(vp); await page.waitForTimeout(200);
    assert.equal((await card(page, 'train'))[0], WORDS.puzzles, 'wide again: the card is still there');
    assert.deepEqual(page.dialogs, []);
    return page;
  }]
];

G.run(cases, VIEWPORTS, ONLY);
