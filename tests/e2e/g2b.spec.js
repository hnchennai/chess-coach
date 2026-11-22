// E2E for slice G2b (docs/specs/board-screens.product.md): G-D19 (a lesson, set or drill in progress is saved on the device),
// G-D20 (one thing waits per tab: a game on Play, a lesson on Learn, a set or drill on Train; opening one never ends another),
// G-D26, scenario 14, criterion 3 for lessons and sets. Design: docs/specs/board-screens.tech.md, section 15.
// Built on the helpers of g2.spec.js.
// Run: G2B_VP=412 node tests/e2e/g2b.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// G2B_VP: 360 | 412 | 1280. G2B_SHOTS=<dir> saves screenshots (412 only). G2B_ONLY=<regex> runs matching cases.
const assert = require('assert/strict');
const path = require('path');
const G = require('./g2.spec.js');
const { newPage, st, hist, savedGame, idle, look, bar, resume, visibleIds, goTab, closeX, move, solvePuzzle, finishLesson, prof, improver, club, PH, WORDS, GAME12, SANS22, NOW } = G;

const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }].filter((v) => !process.env.G2B_VP || String(v.width) === process.env.G2B_VP);
const ONLY = process.env.G2B_ONLY ? new RegExp(process.env.G2B_ONLY) : null;
const SHOTS = process.env.G2B_SHOTS || '';
const RKEY = 'suresh-chess-coach.resume.v1';
const ZT = { play: ['play', 'resumePlay'], learn: ['path', 'resumePath'], train: ['train', 'resumeTrain'] };

const shot = async (page, name) => { if (!SHOTS || page.viewportSize().width !== 412) return; await page.waitForTimeout(350); await page.screenshot({ path: path.join(SHOTS, name + '.png') }); };
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
  ['S14: an unfinished game and an unfinished lesson both wait; opening one does not end the other (wide: D50 still ends the lesson)', async (vp) => {
    const page = await newPage(vp, club(), { game: GAME12, tab: 'play' });
    await lessonTo(page, 'kq', 1);
    const n = await steps(page, 'kq');
    if (!PH(vp)) {
      // wide screens keep D50 exactly: "Stop, resume game" ends the open lesson, and nothing waits anywhere
      await goTab(page, 'play');
      await page.locator('#znote-play [data-act="close"]').click();
      assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, window.__coach.st.ls]), ['play', null], 'wide: the lesson ended');
      assert.deepEqual(await visibleIds(page, '.rs-card, #actBar'), [], 'wide: no Resume card, no Close bar');
      assert.deepEqual(await hist(page), SANS22);
      assert.equal(await rawSaved(page), null, 'wide: nothing is left saved for the lesson that ended');
      // and the lesson starts again at step 1, as before
      await page.evaluate(() => window.__coach.startPart('kq', 'learn'));
      assert.equal(await page.evaluate(() => window.__coach.st.ls.i), 0);
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
  ['G-D19: a rated puzzle answered before a kill is never counted twice after the restore, and never lost', async (vp) => {
    const page = await newPage(vp, club(), {});
    if (!PH(vp)) return page;
    await goTab(page, 'train'); await page.locator('#ratedBtn').click();
    await solvePuzzle(page);
    const pid = (await onBoard(page)).pid, A = await puzStats(page, pid);
    assert.deepEqual([A.n, A.ok, A.rn, A.stored], [1, 1, 1, 1], 'saved in the profile when it was answered');
    assert.deepEqual([(await saved(page)).train.i, (await saved(page)).train.right, (await saved(page)).train.counted], [0, 1, true]);
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement); // killed before "Next"
    assert.deepEqual((await card(page, 'train')).slice(0, 2), [WORDS.puzzles, 'Puzzle 1 of 10']);
    await open(page, 'train'); await puzzleReady(page);
    let B = await onBoard(page);
    assert.deepEqual([B.pid, B.i, B.right, B.wrong, B.done], [pid, 0, 1, 0, false], 'the same puzzle is dealt again with its result kept');
    assert.deepEqual(await puzStats(page, pid), A, 'restoring counts nothing');
    await solvePuzzle(page);
    B = await onBoard(page);
    assert.deepEqual([B.right, B.wrong], [1, 0], 'solving it again does not score again');
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
      await open(page, 'train'); await puzzleReady(page);
      B = await onBoard(page);
      assert.deepEqual([B.pid, B.i, B.right, B.wrong], [p2, 1, 1, 1]);
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
    if (PH(vp)) {
      assert.deepEqual(await card(page, 'train'), [WORDS.puzzles, '2 of 2', 'Safe or blunder?', WORDS.puzzles]);
      assert.equal(await card(page, 'learn'), null);
      await open(page, 'train');
      assert.deepEqual([(await onBoard(page)).quiz, (await onBoard(page)).right], [quiz[1], 1], 'it resumes from the saved entry');
    } else assert.deepEqual(await visibleIds(page, '.rs-card'), [], 'wide: a saved entry shows nothing');
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
    if (PH(vp)) { assert.equal(await card(page, 'train'), null, 'it does not come back'); assert.equal((await card(page, 'learn'))[0], WORDS.lesson); }
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
      // wide: D50 ends a set when the game is opened, and the key follows
      await page.evaluate(() => window.__coach.trainStart('safety'));
      assert.equal((await saved(page)).train.kind, 'safety');
      await goTab(page, 'play'); await page.locator('#znote-play [data-act="close"]').click();
      assert.equal(await rawSaved(page), null, 'wide: ended by "Resume game", cleared');
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
  // ---------- wide screens ----------
  ['Wide (1280): unchanged. A saved key shows nothing and changes nothing there; held upright again, its cards are back', async (vp) => {
    if (PH(vp)) return newPage(vp, club(), {});
    let page = await newPage(vp, club(), {});
    const quiz = await page.evaluate(() => window.__coach.PZ.filter((p) => p.pre && p.last && p.preBest).slice(0, 2).map((p) => p.id));
    const first = async (p) => ({ tab: await st(p, 'tab'), mode: await st(p, 'mode'), panel: await visibleIds(p, '#panel-train > *'), coach: await visibleIds(p, '#panel-coach > *'), cont: await p.evaluate(() => { const b = document.querySelector('#contCard .bh-go'); return b ? b.textContent : null; }) });
    await goTab(page, 'train'); const T0 = await first(page);
    await page.context().close();
    const good = { k: 'set', kind: 'safety', title: 'Safe or blunder?', unit: null, part: null, count: 2, pass: null, rated: false, theme: null, review: false, i: 1, right: 1, wrong: 0, counted: false, items: [[quiz[0], 1], [quiz[1], 0]] };
    const key = { v: 1, learn: LESSON_E(1), train: good };
    page = await newPage(vp, club(), { game: GAME12, tab: 'train', ls: { [RKEY]: JSON.stringify(key) } });
    let L = await look(page);
    assert.deepEqual([L.tab, L.board, L.bar, L.mode], ['train', true, false, 'play'], 'wide: starts on the stored tab with the board, as before');
    assert.deepEqual(await visibleIds(page, '.rs-card, #actBar'), [], 'wide: no Resume card');
    assert.deepEqual((await first(page)).panel, T0.panel, 'wide: Train’s page is as it is without a saved key');
    await goTab(page, 'coach');
    assert.equal(await page.locator('#contCard .bh-go').innerText(), 'Start lesson', 'wide: Home’s Continue card is as before');
    assert.deepEqual(await saved(page), key, 'the key is kept as it is');
    // D50 on wide: a lesson that is opened and then left for the game ends, and starts again at step 1
    await page.locator('#contCard .bh-go').click(); await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    await page.locator('#navNext').click();
    await goTab(page, 'play'); await page.locator('#znote-play [data-act="close"]').click();
    assert.deepEqual(await page.evaluate(() => [window.__coach.st.mode, window.__coach.st.ls]), ['play', null]);
    assert.deepEqual(await visibleIds(page, '.rs-card'), []);
    await goTab(page, 'coach');
    assert.equal(await page.locator('#contCard .bh-go').innerText(), 'Start lesson', 'wide: no "Resume lesson" on Home');
    assert.deepEqual(await saved(page), { v: 1, learn: null, train: good }, 'the lesson that ended is cleared; Train’s entry was not touched');
    // the same device held upright (a phone turned back): Train's card is there
    await page.setViewportSize({ width: 412, height: 915 }); await page.waitForTimeout(200);
    assert.deepEqual(await card(page, 'train'), [WORDS.puzzles, '2 of 2', 'Safe or blunder?', WORDS.puzzles]);
    assert.equal(await card(page, 'learn'), null);
    await page.setViewportSize(vp); await page.waitForTimeout(200);
    assert.deepEqual(await visibleIds(page, '.rs-card'), [], 'wide again: no card');
    return page;
  }]
];

G.run(cases, VIEWPORTS, ONLY);
