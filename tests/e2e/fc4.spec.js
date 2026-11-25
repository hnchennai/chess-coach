// E2E for slice FC4 of friend challenges: the friend board (docs/specs/friend-challenges.product.md FC-D6, FC-D8, FC-D10,
// FC-D11, FC-D13, FC-D15, FC-D21, FC-D26, FC-D28, FC-D29, scenarios 4, 5, 7, 8, criteria 3, 6, 7, 8; tech spec section 9).
// Two players in two browser contexts on the FC3 harness (tests/e2e/fc3.spec.js): a fake window.Capacitor (App, Share, and here
// AdMob as in f3b.spec.js), and a fake Firebase that runs the REAL server ops (functions/src/ops.js on memstore) with its own
// clock (fb.off moves the server's time). Nothing reaches the internet.
// Run: FC_VP=412 node tests/e2e/fc4.spec.js (or DP_VP=412). One viewport per process: 360 | 412 | 1280. FC_ONLY=<regex>.
// Not checked here (no phone): push (FC5), a real second phone, the real Firebase project.
process.env.FC_VP = process.env.FC_VP || process.env.DP_VP || '';
const assert = require('assert/strict');
const H = require('./fc3.spec.js');
const { player, goPlay, card, sheet, challenge, linkOf, acceptSheet, doAccept, frStore, shot, DAY, G } = H;

// The ads plugin, as f3b.spec.js fakes it (a smaller copy): consent not required, a banner that loads at once. It records every
// call to show or bring back the banner with whether a friend game was in progress on the board at that moment.
function fakeAds() {
  const A = window.__ad = { calls: [], ls: {}, view: false, visible: false, loaded: false };
  const fire = (n, d) => (A.ls[n] || []).slice().forEach((f) => f(d));
  const live = () => { const c = window.__coach; if (!c || c.st.mode !== 'friend') return false; const e = document.getElementById('gameEnd'); return !e || e.hidden; };
  const rec = (m) => A.calls.push({ m, live: live() });
  const size = (on) => fire('bannerAdSizeChanged', on ? { width: Math.min(window.innerWidth, 728), height: 64 } : { width: 0, height: 0 });
  window.Capacitor.Plugins.AdMob = {
    addListener(n, f) { (A.ls[n] = A.ls[n] || []).push(f); return Promise.resolve({ remove() {} }); },
    requestConsentInfo() { rec('requestConsentInfo'); return Promise.resolve({ status: 'NOT_REQUIRED', isConsentFormAvailable: false, canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' }); },
    showConsentForm() { return Promise.resolve({ status: 'OBTAINED', canRequestAds: true, privacyOptionsRequirementStatus: 'NOT_REQUIRED' }); },
    showPrivacyOptionsForm() { return Promise.resolve(); },
    initialize() { rec('initialize'); return Promise.resolve(); },
    showBanner() { rec('showBanner'); if (A.view) return Promise.resolve(); A.view = A.visible = true; setTimeout(() => { if (!A.view) return; A.loaded = true; size(true); fire('bannerAdLoaded', {}); }, 30); return Promise.resolve(); },
    hideBanner() { rec('hideBanner'); if (!A.view) return Promise.reject(new Error('never shown')); A.visible = false; setTimeout(() => size(false), 0); return Promise.resolve(); },
    resumeBanner() { rec('resumeBanner'); if (A.view) { A.visible = true; setTimeout(() => size(true), 0); } return Promise.resolve(); },
    removeBanner() { rec('removeBanner'); A.view = A.visible = A.loaded = false; setTimeout(() => size(false), 0); return Promise.resolve(); }
  };
}
// Every message the page sends to a Web Worker (Stockfish runs in one)
function countWorker() {
  const W = window.Worker; window.__wk = 0;
  window.Worker = function (u, o) { const w = new W(u, o), pm = w.postMessage.bind(w); w.postMessage = function (m) { window.__wk++; return pm(m); }; return w; };
  window.Worker.prototype = W.prototype;
}
const EXTRA = [[fakeAds, null], [countWorker, null]];
const who = (name, o) => Object.assign({ who: name, extra: EXTRA }, o || {});

// The engine is settled (Stockfish ready or failed, the boot analysis done), then every engine call is counted
async function engineQuiet(page) {
  await page.waitForFunction(() => window.Brain && Brain.state() !== 'loading' && (window.__coach.st.think || Brain.state() === 'failed'), null, { timeout: 30000 }).catch(() => {});
  await page.waitForTimeout(400);
  await page.evaluate(() => {
    if (window.__engN !== undefined) return;
    window.__engN = 0;
    ['analyse', 'play'].forEach((k) => { const f = Brain[k]; Brain[k] = function () { window.__engN++; return f.apply(Brain, arguments); }; });
    const ea = Eng.analyze; Eng.analyze = function () { window.__engN++; return ea.apply(Eng, arguments); };
  });
}
const engine = (page) => page.evaluate(() => ({ calls: window.__engN, posts: window.__wk }));

// Invite (A plays col), accept by a warm link (B names A nameA, or not). Returns the game id.
async function startGame(A, B, col, nameA) {
  const code = await challenge(A, col);
  await B.evaluate((u) => window.__fc.open(u), linkOf(code));
  await acceptSheet(B);
  await doAccept(B, nameA == null ? null : nameA);
  const st = await frStore(B);
  return Object.keys(st.games).find((id) => st.games[id].st === 'active');
}
const refresh = (page) => page.evaluate(() => window.__fc.resume());
const tick = (page) => page.evaluate(() => window.__coach.frTick());
// The row for a game on Play's card, once it says line (or any line)
async function row(page, gid, line) {
  await goPlay(page);
  await page.waitForFunction(([g, l]) => { const r = document.querySelector('#friendCard .fg-row[data-g="' + g + '"] .fg-state'); return r && (!l || r.textContent === l); }, [gid, line], { timeout: 15000 });
  return (await card(page)).rows.find((r) => r.g === gid);
}
async function openBoard(page, gid) {
  await goPlay(page);
  await page.locator('#friendCard [data-act="fopen"][data-g="' + gid + '"]').click();
  await page.waitForFunction((g) => window.__coach.st.mode === 'friend' && window.__coach.st.fid === g, gid);
}
const sq = (page, s) => page.locator('#grid .sq[data-sq="' + s + '"]').click();
async function move(page, from, to) { await sq(page, from); await sq(page, to); }
const fen = (page) => page.evaluate(() => window.__coach.st.fg ? window.__coach.st.fg.fen() : null);
const hist = (page) => page.evaluate(() => window.__coach.st.fg ? window.__coach.st.fg.history() : null);
// Whose move and time: the Close bar on phones, the mode bar on wide screens
const words = (page) => page.evaluate(() => {
  const on = (id) => { const e = document.getElementById(id); return !!e && e.getClientRects().length > 0; };
  return on('actBar') ? [document.getElementById('actName').textContent, document.getElementById('actPlace').textContent] : document.getElementById('modeText').textContent.split(': ');
});
const waitWords = (page, place, ms) => page.waitForFunction((p) => { const on = (e) => !!e && e.getClientRects().length > 0, b = document.getElementById('actBar'); const t = on(b) ? document.getElementById('actPlace').textContent : document.getElementById('modeText').textContent.split(': ')[1]; return t === p; }, place, { timeout: ms || 15000 });
// Ticks (the 60 s refresh) until cond holds in the page: a sync already in flight when a tick comes may predate the change
async function tickFor(page, cond, arg) {
  for (let i = 0; i < 6; i++) { await tick(page); if (await page.waitForFunction(cond, arg, { timeout: 2500 }).then(() => true, () => false)) return; }
  throw new Error('tickFor: never true: ' + String(cond).slice(0, 120));
}
async function tickUntil(page, place) {
  for (let i = 0; i < 6; i++) { await tick(page); if (await waitWords(page, place, 2500).then(() => true, () => false)) return; }
  throw new Error('the line never became ' + place);
}
// The friend board's controls
const fbar = (page) => page.evaluate(() => {
  const el = document.getElementById('friendBar'), on = (e) => !!e && e.getClientRects().length > 0;
  if (!on(el)) return null;
  const bs = [...el.querySelectorAll('button')].filter(on);
  return { msg: document.getElementById('fbMsg').textContent, buttons: bs.map((b) => b.textContent + (b.disabled ? ' (off)' : '')), minH: Math.min(99, ...bs.map((b) => b.getBoundingClientRect().height)),
    right: el.getBoundingClientRect().right, vw: window.innerWidth, scrollW: document.documentElement.scrollWidth, ask: el.querySelector('.fg-ask') ? el.querySelector('.fg-ask').textContent : null };
});
const fbClick = (page, act) => page.locator('#friendBar [data-act="' + act + '"]').click();
// Criterion 6 and FC-D10: nothing from the coach or the engine on the board while a friend game is in progress
const coachOff = (page) => page.evaluate(() => {
  const on = (id) => { const e = document.getElementById(id); return !!e && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden' && e.style.visibility !== 'hidden'; };
  return { hint: on('hintBtn'), undo: on('undoBtn'), review: on('reviewBtn'), eval: on('evalbar'), think: on('thinkCard'), coach: on('coach'), opp: on('oppCard'), goal: on('goalCard'), strip: document.getElementById('coachStrip').textContent.trim() };
});
const OFF = { hint: false, undo: false, review: false, eval: false, think: false, coach: false, opp: false, goal: false, strip: '' };
const banner = (page) => page.evaluate(() => ({ shown: !!(window.__ad.view && window.__ad.visible && window.__ad.loaded), liveShows: window.__ad.calls.filter((c) => (c.m === 'showBanner' || c.m === 'resumeBanner') && c.live).length }));
// The end card under the board
const endCard = (page) => page.evaluate(() => {
  const el = document.getElementById('gameEnd'), on = (e) => !!e && e.getClientRects().length > 0;
  if (!on(el)) return null;
  const t = (q) => (el.querySelector(q) ? el.querySelector(q).textContent : null);
  return { title: t('.ec-title'), text: t('.ec-text'), buttons: [...el.querySelectorAll('button')].filter(on).map((b) => b.textContent) };
});
const waitEnd = (page) => page.waitForFunction(() => { const e = document.getElementById('gameEnd'); return e && !e.hidden && e.querySelector('.ec-title'); }, null, { timeout: 15000 });
const profOf = (page) => page.evaluate(() => window.__coach.getProf());
const today = () => { const d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const W4 = {
  resign: 'Resign', resignAsk: 'Resign this game?', keep: 'Keep playing', offerDraw: 'Offer draw', accept: 'Accept', decline: 'Decline',
  drawOffered: 'Your friend offers a draw.', drawSent: 'You offered a draw.', name: 'Name your friend', save: 'Save', notNow: 'Not now', review: 'Review this game', home: 'Home',
  offline: 'Friend games need the internet. Try again when you are online.', notSent: 'Not sent yet', theirMove: 'Their move', lossText: 'Your friend wins this one. Review it to find the turning point.'
};
const phone = (vp) => vp.width <= 860;
// The history rows (Play's Recent games on phones, Progress on wide screens)
async function historyRows(page, vp) {
  if (phone(vp)) {
    if (await page.evaluate(() => !!document.documentElement.dataset.scr)) { await page.locator('#actClose').click(); }
    await goPlay(page);
    return page.evaluate(() => [...document.querySelectorAll('#recentPlay .hrow')].map((r) => ({ text: r.innerText.replace(/\s+/g, ' '), friend: r.dataset.friend === '1' })));
  }
  await page.locator('#tab-progress').click();
  return page.evaluate(() => [...document.querySelectorAll('#history .hrow')].map((r) => ({ text: r.innerText.replace(/\s+/g, ' '), friend: r.dataset.friend === '1' })));
}
function layoutOk(b, msg) {
  assert.ok(b.right <= b.vw + 0.5, msg + ': the controls fit the width');
  assert.ok(b.scrollW <= b.vw, msg + ': no sideways scroll');
  assert.ok(b.minH >= 44, msg + ': buttons at least 44px high');
}

const cases = [
  ['Scenario 4, criteria 3, 6, 7, 8: a full short game both ways ending in mate; no hints, eval bar, think card, coach line, Stockfish or banner during it; the end card, Review this game, the history row and the record', async (vp, fb) => {
    const A = await player(vp, fb, who('A')), B = await player(vp, fb, who('B'));
    const gid = await startGame(A, B, 'w', 'Asha');
    await engineQuiet(A); await engineQuiet(B);
    const e0 = [await engine(A), await engine(B)];
    // A (White) opens the game from its row
    await refresh(A);
    const r0 = await row(A, gid, 'Your move, 2 days left');
    assert.deepEqual([r0.kind, r0.name, r0.record], ['mine', 'Friend', 'W 0 · L 0 · D 0']);
    await openBoard(A, gid);
    assert.deepEqual(await words(A), ['Friend game', 'Your move, 2 days left']);
    assert.deepEqual(await coachOff(A), OFF, 'criterion 6: no hint, eval bar, think card, coach line');
    assert.equal((await banner(A)).shown, false, 'FC-D15: no banner during a friend game');
    assert.equal(await A.evaluate(() => document.getElementById('oppName').textContent), 'Friend');
    const b0 = await fbar(A);
    assert.deepEqual(b0.buttons, [W4.offerDraw, W4.resign, W4.name]);
    layoutOk(b0, 'A');
    await shot(A, 'fc4_board_A');
    await move(A, 'f2', 'f3');
    assert.deepEqual(await hist(A), ['f3'], 'shown at once');
    await A.waitForFunction(() => window.__coach.fr().games[window.__coach.st.fid].moves.length === 1, null, { timeout: 10000 });
    await waitWords(A, W4.theirMove);
    assert.deepEqual(fb.store.get('games', gid).moves, ['f3'], 'the server has it');
    // B (Black) sees it
    await refresh(B);
    const rb = await row(B, gid, 'Your move, 2 days left');
    assert.equal(rb.name, 'Asha', 'B named A on accepting');
    await openBoard(B, gid);
    assert.deepEqual(await hist(B), ['f3']);
    assert.deepEqual(await words(B), ['Friend game vs Asha', 'Your move, 2 days left']);
    assert.equal(await B.evaluate(() => window.__coach.st.flipped ? 'flipped' : document.querySelector('#grid .sq').dataset.sq), 'h1', 'Black sees the board from its own side');
    await move(B, 'e7', 'e5');
    await B.waitForFunction(() => window.__coach.fr().games[window.__coach.st.fid].moves.length === 2, null, { timeout: 10000 });
    // A gets it while the board is open (the 60 s refresh), and plays on
    await tickFor(A, () => window.__coach.st.fg.history().length === 2);
    await move(A, 'g2', 'g4');
    await A.waitForFunction(() => window.__coach.fr().games[window.__coach.st.fid].moves.length === 3, null, { timeout: 10000 });
    assert.deepEqual(await coachOff(A), OFF);
    await tickFor(B, () => window.__coach.st.fg.history().length === 3);
    assert.equal(await fen(A), await fen(B), 'criterion 3: the same position on both phones');
    await move(B, 'd8', 'h4');
    await waitEnd(B);
    assert.deepEqual(await endCard(B), { title: 'Checkmate. You win!', text: 'Great finish. Review it.', buttons: [W4.review, W4.home] });
    await tickFor(A, () => { const e = document.getElementById('gameEnd'); return e && !e.hidden && !!e.querySelector('.ec-title'); });
    assert.deepEqual(await endCard(A), { title: 'Checkmate', text: W4.lossText, buttons: [W4.review, W4.home] });
    assert.equal(await fen(A), await fen(B));
    assert.deepEqual(fb.store.get('games', gid).res, { r: 'b', why: 'mate' });
    // No engine call and no message to the Stockfish worker during the game (criterion 6); no banner while it was in progress (FC-D15)
    const e1 = [await engine(A), await engine(B)];
    assert.deepEqual(e1, e0, 'no Stockfish during the friend game');
    assert.equal((await banner(A)).liveShows, 0); assert.equal((await banner(B)).liveShows, 0);
    // The end card may show the banner, as after any game (FC-D15)
    await A.waitForFunction(() => window.__ad.view && window.__ad.visible && window.__ad.loaded, null, { timeout: 8000 });
    await shot(A, 'fc4_end_A');
    // History (exactly once, unrated, counts as a game today) and the record (FC-D29: on the phone, not in the profile)
    for (const [P, r, rec] of [[A, 'L', 'l'], [B, 'W', 'w']]) {
      await refresh(P); await P.waitForTimeout(300);
      const pr = await profOf(P), fg = pr.games.filter((g) => g.id === 'f-' + gid);
      assert.equal(fg.length, 1, 'once, even after more syncs');
      assert.deepEqual([fg[0].r, fg[0].level, fg[0].sans, fg[0].tags, fg[0].ann], [r, null, ['f3', 'e5', 'g4', 'Qh4#'], {}, {}]);
      assert.equal(pr.days[today()].games, 1, 'a game played today');
      assert.equal(pr.rating, 1100, 'no rating change');
      const st = await frStore(P);
      assert.equal(st.friends[fg[0].fr].res[gid], rec);
      assert.ok(!JSON.stringify(pr).includes('Asha'), 'no nickname in the profile');
    }
    // Review this game: everything, engine included (FC-D10)
    await A.locator('#gameEnd [data-act="freview"]').click();
    await A.waitForFunction(() => window.__coach.st.mode === 'review' && window.__coach.st.rv.fr);
    assert.equal(await A.evaluate(() => window.__coach.st.rv.sans.length), 4);
    await A.locator('#navNext').click(); await A.locator('#navNext').click();
    await A.waitForFunction(() => /Your friend played e5/.test(document.getElementById('coachStrip').textContent), null, { timeout: 30000 });
    assert.ok((await engine(A)).calls > e1[0].calls, 'the review uses the engine');
    // The history rows: "vs Asha (friend)" on B, "vs a friend" on A (no nickname given)
    const ha = await historyRows(A, vp), hb = await historyRows(B, vp);
    assert.match(ha[0].text, /^Lost .* · vs a friend · White 2 moves/); assert.ok(ha[0].friend);
    assert.match(hb[0].text, /^Won .* · vs Asha \(friend\) · Black 2 moves/);
    // A new game with the same friend: the row shows the record
    const gid2 = await startGame(A, B, 'b', null);
    await refresh(A);
    const r2 = await row(A, gid2);
    assert.equal(r2.record, 'W 0 · L 1 · D 0');
    assert.equal((await row(B, gid2)).record, 'W 1 · L 0 · D 0');
    return [A, B];
  }],
  ['Scenario 8, FC-D13: offline the move shows "Not sent yet", the clock goes on, and it sends when back online; a resend already applied counts once', async (vp, fb) => {
    const A = await player(vp, fb, who('A')), B = await player(vp, fb, who('B'));
    const gid = await startGame(A, B, 'w', 'Asha');
    await refresh(A); await row(A, gid, 'Your move, 2 days left');
    await openBoard(A, gid);
    await A.context().setOffline(true);
    await move(A, 'e2', 'e4');
    assert.deepEqual(await hist(A), ['e4'], 'shown at once');
    await waitWords(A, W4.notSent);
    assert.equal((await frStore(A)).games[gid].pend.to, 'e4', 'saved as pend');
    assert.deepEqual(fb.store.get('games', gid).moves, [], 'not on the server');
    assert.equal(await A.evaluate(() => window.__coach.st.fg.turn()), 'b', 'only one pending move: no move for White now');
    await tick(A); await A.waitForTimeout(200);
    assert.deepEqual(fb.store.get('games', gid).moves, [], 'still offline');
    if (phone(vp)) {
      await A.locator('#actClose').click();
      const r = await row(A, gid);
      assert.deepEqual([r.kind, r.line], ['theirs', W4.notSent], 'the row says so too');
    }
    await A.context().setOffline(false);
    await A.waitForFunction(() => !window.__coach.fr().games[Object.keys(window.__coach.fr().games)[0]].pend, null, { timeout: 15000 });
    assert.deepEqual(fb.store.get('games', gid).moves, ['e4'], 'sent by itself once online');
    await refresh(B);
    await openBoard(B, gid);
    assert.deepEqual(await hist(B), ['e4'], 'the friend sees it');
    // A resend of a move the server already has: its answer is lost, the move stays "Not sent yet", the resend counts once
    fb.lose = 'move';
    await move(B, 'e7', 'e5');
    await waitWords(B, W4.notSent);
    assert.deepEqual(fb.store.get('games', gid).moves, ['e4', 'e5'], 'the server has it');
    await tickUntil(B, W4.theirMove);
    assert.deepEqual(fb.store.get('games', gid).moves, ['e4', 'e5'], 'counted once');
    assert.equal((await frStore(B)).games[gid].pend, null);
    return [A, B];
  }],
  ['Scenario 7, FC-D11: offer a draw, decline, no second offer before an own move, then offer and accept: a draw for both', async (vp, fb) => {
    const A = await player(vp, fb, who('A')), B = await player(vp, fb, who('B'));
    const gid = await startGame(A, B, 'w', 'Asha');
    await refresh(A); await row(A, gid, 'Your move, 2 days left');
    await openBoard(A, gid);
    await move(A, 'e2', 'e4');
    await waitWords(A, W4.theirMove);
    await fbClick(A, 'foffer');
    await A.waitForFunction((t) => document.getElementById('fbMsg').textContent === t, W4.drawSent, { timeout: 10000 });
    assert.deepEqual((await fbar(A)).buttons, [W4.offerDraw + ' (off)', W4.resign, W4.name]);
    assert.equal(fb.store.get('games', gid).draw, 'w');
    await refresh(B);
    await openBoard(B, gid);
    await B.waitForFunction((t) => document.getElementById('fbMsg').textContent === t, W4.drawOffered, { timeout: 10000 });
    const bb = await fbar(B);
    assert.deepEqual(bb.buttons, [W4.accept, W4.decline, W4.resign]);
    layoutOk(bb, 'B');
    await shot(B, 'fc4_draw_B');
    await fbClick(B, 'fdecline');
    await B.waitForFunction(() => document.getElementById('fbMsg').textContent === '' && !!document.querySelector('#friendBar [data-act="foffer"]'), null, { timeout: 10000 });
    assert.equal(fb.store.get('games', gid).draw, null, 'declined, the game goes on');
    await tickFor(A, () => document.getElementById('fbMsg').textContent === '');
    assert.equal((await fbar(A)).buttons[0], W4.offerDraw + ' (off)', 'one offer per own move');
    await move(B, 'e7', 'e5');
    await tickFor(A, () => window.__coach.st.fg.history().length === 2);
    assert.equal((await fbar(A)).buttons[0], W4.offerDraw + ' (off)', 'still not: no own move since');
    await move(A, 'g1', 'f3');
    await waitWords(A, W4.theirMove);
    assert.equal((await fbar(A)).buttons[0], W4.offerDraw, 'after an own move');
    await fbClick(A, 'foffer');
    await A.waitForFunction((t) => document.getElementById('fbMsg').textContent === t, W4.drawSent, { timeout: 10000 });
    await tickFor(B, (t) => document.getElementById('fbMsg').textContent === t, W4.drawOffered);
    await fbClick(B, 'fdaccept');
    await waitEnd(B);
    assert.deepEqual(await endCard(B), { title: 'Draw', text: 'You both agreed to a draw.', buttons: [W4.review, W4.home] });
    await tickFor(A, () => { const e = document.getElementById('gameEnd'); return e && !e.hidden && !!e.querySelector('.ec-title'); });
    assert.equal((await endCard(A)).text, 'You both agreed to a draw.');
    assert.equal((await profOf(A)).games[0].r, 'D');
    assert.equal(Object.values((await frStore(B)).friends)[0].res[gid], 'd');
    return [A, B];
  }],
  ['Resign asks first; Keep playing goes back; offline it says the approved line; Resign ends it: "You resigned", the friend wins', async (vp, fb) => {
    const A = await player(vp, fb, who('A')), B = await player(vp, fb, who('B'));
    const gid = await startGame(A, B, 'w', 'Asha');
    await refresh(B); await row(B, gid, 'Their move');
    await openBoard(B, gid);
    assert.equal(await B.evaluate(() => window.__coach.st.fg.turn()), 'w');
    await fbClick(B, 'fresign');
    let b = await fbar(B);
    assert.deepEqual([b.ask, b.buttons], [W4.resignAsk, [W4.resign, W4.keep]]);
    assert.equal(await B.evaluate(() => document.activeElement.dataset.act), 'fresignno', 'focus on the safe choice');
    await fbClick(B, 'fresignno');
    b = await fbar(B);
    assert.deepEqual([b.ask, b.buttons], [null, [W4.offerDraw, W4.resign]]);
    await B.context().setOffline(true);
    await fbClick(B, 'fresign'); await fbClick(B, 'fresignyes');
    await B.waitForFunction((t) => document.getElementById('fbMsg').textContent === t, W4.offline);
    assert.equal(fb.store.get('games', gid).st, 'active', 'nothing sent');
    await B.context().setOffline(false);
    await fbClick(B, 'fresign'); await fbClick(B, 'fresignyes');
    await waitEnd(B);
    assert.deepEqual(await endCard(B), { title: 'You resigned', text: W4.lossText, buttons: [W4.review, W4.home] });
    assert.deepEqual(fb.store.get('games', gid).res, { r: 'w', why: 'resign' });
    // A (Play page, no board open) gets the win into the history
    await refresh(A);
    await A.waitForFunction(() => window.__coach.getProf().games.length === 1, null, { timeout: 10000 });
    assert.deepEqual((await profOf(A)).games.map((g) => [g.r, g.id]), [['W', 'f-' + gid]]);
    assert.equal((await card(A)).rows.length, 0, 'a finished game leaves the card');
    return [A, B];
  }],
  ['Scenario 5, FC-D6, FC-D26: the time line follows the server clock; a move after the deadline shows the game lost on time on both phones', async (vp, fb) => {
    const A = await player(vp, fb, who('A')), B = await player(vp, fb, who('B'));
    const gid = await startGame(A, B, 'w', null);
    fb.off = 2 * DAY + 60000;
    await refresh(A);
    await row(A, gid, 'Your move, 23 hours left');
    await openBoard(A, gid);
    assert.deepEqual(await words(A), ['Friend game', 'Your move, 23 hours left']);
    fb.off = 3 * DAY + 60000;
    await tickUntil(A, 'Your move, no time left'); // a sync already in flight may still carry the old server time
    await move(A, 'e2', 'e4');
    await waitEnd(A);
    assert.deepEqual(await endCard(A), { title: 'Out of time', text: W4.lossText, buttons: [W4.review, W4.home] });
    assert.deepEqual(fb.store.get('games', gid).res, { r: 'b', why: 'time' });
    assert.deepEqual(await hist(A), [], 'the late move is not in the game');
    assert.equal((await profOf(A)).games[0].r, 'L');
    await refresh(B);
    await B.waitForFunction(() => window.__coach.getProf().games.length === 1, null, { timeout: 10000 });
    assert.equal((await profOf(B)).games[0].r, 'W');
    return [A, B];
  }],
  ['FC-D28: Name your friend from the row and from the board; the name stays on this phone, the server never sees it', async (vp, fb) => {
    const A = await player(vp, fb, who('A')), B = await player(vp, fb, who('B'));
    const gid = await startGame(A, B, 'w', null);
    await refresh(A);
    const r = await row(A, gid);
    assert.deepEqual(r.buttons.slice(1), [W4.name], 'the row offers it once the friend has accepted');
    await A.locator('#friendCard .fg-row [data-act="fname"]').click();
    await A.waitForFunction(() => !document.getElementById('friendSheet').hidden);
    const s = await sheet(A);
    assert.deepEqual([s.title, s.label, s.hint, s.max], [W4.name, W4.name, 'optional, stays on this phone', 20]);
    assert.deepEqual(s.buttons.slice(1), [W4.save, W4.notNow]);
    assert.equal(await A.evaluate(() => document.activeElement.id), 'fgNick');
    await A.locator('#fgNick').fill('Ravi Kumar the Great Friend');
    await A.locator('#friendSheet [data-act="fsave"]').click();
    await A.waitForFunction(() => document.getElementById('friendSheet').hidden);
    const r2 = (await card(A)).rows.find((x) => x.g === gid);
    assert.equal(r2.name, 'Ravi Kumar the Great');
    assert.deepEqual(r2.buttons.length, 1, 'no Name button once named');
    // B names A from the board
    await refresh(B);
    await openBoard(B, gid);
    await fbClick(B, 'fname');
    await B.locator('#fgNick').fill('Asha');
    await B.keyboard.press('Enter');
    await B.waitForFunction(() => document.getElementById('friendSheet').hidden);
    assert.deepEqual(await words(B), ['Friend game vs Asha', W4.theirMove]);
    assert.deepEqual((await fbar(B)).buttons, [W4.offerDraw, W4.resign]);
    assert.ok(!fb.calls.some((c) => /Ravi|Asha/.test(c.body)), 'no name ever reaches the server');
    assert.ok(!(await A.evaluate(() => localStorage.getItem('suresh-chess-coach.profile.v1') || '')).includes('Ravi'), 'not in the profile');
    return [A, B];
  }],
  ['Close leaves the friend board for its row (phones, also the back button) or goes back to the engine game (wide), which waited untouched', async (vp, fb) => {
    const A = await player(vp, fb, who('A', { prof: G.improver({ rating: 1100 }) })), B = await player(vp, fb, who('B'));
    const gid = await startGame(A, B, 'w', null);
    await refresh(A); await row(A, gid);
    await openBoard(A, gid);
    assert.equal(await A.evaluate(() => window.__coach.hist().length), 0, 'the engine game is untouched');
    if (phone(vp)) {
      await A.locator('#actClose').click();
      await A.waitForFunction(() => window.__coach.st.mode === 'play' && !document.documentElement.dataset.scr);
      assert.equal(await A.evaluate(() => document.activeElement && document.activeElement.dataset.act), 'fopen', 'focus back on the row');
      await openBoard(A, gid);
      assert.equal(await A.evaluate(() => window.__coach.backPressed()), true);
      await A.waitForFunction(() => window.__coach.st.mode === 'play');
    } else {
      await A.locator('#modeExit').click();
      await A.waitForFunction(() => window.__coach.st.mode === 'play');
      assert.equal(await A.evaluate(() => document.getElementById('modeText').textContent.startsWith('New game')), true, 'the engine game is back');
    }
    return [A, B];
  }],
  ['Scenario 11, FC-D4: the web build has no friend board or controls and makes no friend request; a friend game synced into the history reads "vs a friend" and opens its review', async (vp, fb) => {
    const fg = { id: 'f-AbCdEfGhIjKlMnOpQrSt', d: Date.now() - 60000, r: 'W', user: 'b', level: null, fr: '0123456789ab', ann: {}, tags: {}, sans: ['f3', 'e5', 'g4', 'Qh4#'] };
    const P = await player(vp, fb, { who: 'web', native: false, prof: G.improver({ rating: 1100, games: [fg] }) });
    assert.equal(await P.evaluate(() => !!window.FClient || !!window.FCONFIG || window.__coach.fr() !== null), false, 'no friend client on the web');
    const rows = await historyRows(P, vp);
    assert.equal(rows.length, 1);
    assert.match(rows[0].text, /^Won .* · vs a friend · Black 2 moves/);
    assert.equal(await P.evaluate(() => document.getElementById('friendCard').hidden && document.getElementById('friendBar').hidden), true);
    await P.locator((phone(vp) ? '#recentPlay' : '#history') + ' [data-review="0"]').click();
    await P.waitForFunction(() => window.__coach.st.mode === 'review' && window.__coach.st.rv.fr === '0123456789ab');
    assert.equal(await P.evaluate(() => document.getElementById('oppName').textContent), 'Friend');
    assert.deepEqual(P.fb, [], 'no request to any friend host');
    assert.equal(fb.calls.length, 0);
    return [P];
  }]
];

if (require.main === module) H.run(cases);
