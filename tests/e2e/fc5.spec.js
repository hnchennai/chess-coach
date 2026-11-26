// E2E for slice FC5 of friend challenges: push (docs/specs/friend-challenges.product.md FC-D14, scenario 4, criterion 4; tech
// spec section 4). Players in browser contexts on the FC3 harness (tests/e2e/fc3.spec.js): a fake window.Capacitor with App,
// Share and PushNotifications (shaped like @capacitor/push-notifications 8.1.3: permissions, register and its "registration"
// event, createChannel, and events held until a listener comes, as a cold start from a tap), and a fake Firebase running the
// REAL server ops (functions/src/ops.js on memstore), whose push intents { to, t, g } the test hands to the right phone with
// the data FCM would carry ({ t, g }). Nothing reaches the internet.
// Run: FC_VP=412 node tests/e2e/fc5.spec.js. One viewport per process: 360 | 412 | 1280. FC_ONLY=<regex>.
// Not checked here (needs a phone): real FCM delivery (app open, background, killed), the Android permission dialog, the
// notification icon and channel in the system, Doze, and a traffic capture showing no Firebase request before the first
// Challenge or Accept (tech spec open question 2).
process.env.FC_VP = process.env.FC_VP || '';
const assert = require('assert/strict');
const H = require('./fc3.spec.js');
const { player, goPlay, card, challenge, linkOf, acceptSheet, doAccept, frStore } = H;
const { Chess } = require('../../functions/node_modules/chess.js');

const TOK1 = 'fake-fcm:APA91b_token_1', TOK2 = 'fake-fcm:APA91b_token_2', TOK3 = 'fake-fcm:APA91b_token_3';
const CHAN = 'createChannel {"id":"friend","name":"Friend games","importance":4}';
const LISTEN = ['addListener "registration"', 'addListener "pushNotificationReceived"', 'addListener "pushNotificationActionPerformed"'];
const calls = (page) => page.evaluate(() => (window.__fc.push ? window.__fc.push.calls.slice() : null));
const work = (cs) => cs.filter((c) => !c.startsWith('addListener'));
const hellos = (fb, who) => fb.calls.filter((c) => c.who === who && c.url === 'https://fn.fc.test/friend').map((c) => JSON.parse(c.body).data).filter((d) => d.op === 'hello');
const waitFor = async (fn, what, ms) => { const t = Date.now(); for (;;) { if (await fn()) return; if (Date.now() - t > (ms || 8000)) throw new Error('never: ' + what); await new Promise((r) => setTimeout(r, 100)); } };
const reload = async (page) => { await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement); };

// Invite (A plays White), accept by a warm link. Returns { gid, a: A's uid, b: B's uid }.
async function startGame(A, B) {
  const code = await challenge(A, 'w');
  await B.evaluate((u) => window.__fc.open(u), linkOf(code));
  await acceptSheet(B);
  await doAccept(B, null);
  const sa = await frStore(A), sb = await frStore(B);
  const gid = Object.keys(sb.games).find((id) => sb.games[id].st === 'active');
  return { gid, a: sa.uid, b: sb.uid };
}
// SAN moves straight on the server (uids: [white, black])
async function serverMoves(fb, gid, uids, sans) {
  for (const san of sans) {
    const g = fb.store.get('games', gid), c = new Chess(); g.moves.forEach((m) => c.move(m));
    const m = c.move(san); assert.ok(m, 'legal: ' + san);
    await fb.ops.handle({ uid: uids[g.moves.length % 2] }, { op: 'move', g: gid, ply: g.moves.length, from: m.from, to: m.to });
  }
}
// The server's last push intent for uid, as FCM's data { t, g }
const lastPush = (fb, uid) => { const p = fb.pushes.filter((x) => x.to === uid).slice(-1)[0]; assert.ok(p, 'the server sent a push'); return { t: p.t, g: p.g }; };
const rowLine = (page, gid) => page.evaluate((g) => { const r = document.querySelector('#friendCard .fg-row[data-g="' + g + '"] .fg-state'); return r ? r.textContent : null; }, gid);
const boardOf = (page) => page.evaluate(() => ({ mode: window.__coach.st.mode, fid: window.__coach.st.fid, hist: window.__coach.st.fg ? window.__coach.st.fg.history() : null }));
const endTitle = (page) => page.evaluate(() => { const e = document.getElementById('gameEnd'), t = e && !e.hidden && e.querySelector('.ec-title'); return t ? t.textContent : null; });
async function openBoard(page, gid) {
  await goPlay(page);
  await page.locator('#friendCard [data-act="fopen"][data-g="' + gid + '"]').click();
  await page.waitForFunction((g) => window.__coach.st.mode === 'friend' && window.__coach.st.fid === g, gid);
}

const cases = [
  ['FC-D14: no push call before the first Challenge; the first Challenge asks once after the share sheet, makes the channel, registers, and the token goes with hello', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A', push: { perm: 'prompt', answer: 'granted', token: TOK1 } });
    await goPlay(A);
    assert.ok(await card(A), 'the feature is on (test toggle)');
    await A.locator('#friendCard [data-act="fchallenge"]').click();
    assert.deepEqual(await calls(A), [], 'start, Play and the Challenge sheet: the push plugin is not touched');
    await A.keyboard.press('Escape');
    await challenge(A, 'r');
    await waitFor(async () => hellos(fb, 'A').length === 1, 'hello');
    const c1 = await calls(A);
    assert.deepEqual(work(c1), ['requestPermissions 1', CHAN, 'register'], 'asked after the share sheet (1 share made), then the channel, then register');
    assert.deepEqual(c1.filter((c) => c.startsWith('addListener')).sort(), LISTEN.slice().sort(), 'the three listeners, once each');
    assert.ok(c1.indexOf('requestPermissions 1') > Math.max(...LISTEN.map((l) => c1.indexOf(l))), 'the listeners come first');
    assert.deepEqual(hellos(fb, 'A'), [{ op: 'hello', tok: TOK1 }]);
    const s = await frStore(A);
    assert.equal(s.tok, TOK1, 'kept as tok'); assert.equal(s.ask, true, 'asked: kept on the phone');
    assert.equal((await fb.store.getUser(s.uid)).tok, TOK1, 'the server has the token');
    assert.equal(fb.calls.filter((c) => c.who === 'A' && /signUp/.test(c.url)).length, 1, 'one ID, from the Challenge (hello never signs up)');
    await challenge(A, 'b');
    await A.waitForTimeout(600);
    assert.deepEqual(work(await calls(A)), ['requestPermissions 1', CHAN, 'register'], 'a second Challenge asks nothing again');
    assert.equal(hellos(fb, 'A').length, 1, 'and sends no token again');
    return [A];
  }],
  ['FC-D14: the first Accept asks; denied: no channel, no register, no token, the game still works; a restart never asks again', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A', push: { perm: 'granted', token: TOK1 } });
    const B = await player(vp, fb, { who: 'B', push: { perm: 'prompt', answer: 'denied', token: TOK2 } });
    const { gid } = await startGame(A, B);
    await waitFor(async () => (await calls(B)).includes('requestPermissions 0'), 'B asked on Accept');
    await B.waitForTimeout(500);
    assert.deepEqual(work(await calls(B)), ['requestPermissions 0'], 'denied: nothing more');
    assert.equal(hellos(fb, 'B').length, 0, 'no token sent');
    const s = await frStore(B); assert.equal(s.ask, true); assert.equal(s.tok, null);
    assert.equal((await fb.store.getUser(s.uid)).tok || null, null);
    assert.equal(await rowLine(B, gid), 'Their move', 'the game is there and works without push');
    await reload(B);
    await B.waitForTimeout(600);
    assert.deepEqual(work(await calls(B)), ['checkPermissions'], 'a restart checks, never asks again, and does not register while denied');
    assert.equal(hellos(fb, 'B').length, 0);
    return [A, B];
  }],
  ['A later start registers again without asking; the same token sends nothing; a changed token is sent; an unsent one is sent at the next start', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A', push: { perm: 'prompt', answer: 'granted', token: TOK1 } });
    await challenge(A, 'w');
    await waitFor(async () => hellos(fb, 'A').length === 1, 'first hello');
    await reload(A);
    await waitFor(async () => (await calls(A)).includes('register'), 'register at start');
    await A.waitForTimeout(500);
    assert.deepEqual(work(await calls(A)), ['checkPermissions', CHAN, 'register'], 'no prompt at a later start');
    assert.equal(hellos(fb, 'A').length, 1, 'the same token: no hello');
    await A.evaluate((t) => sessionStorage.setItem('__fcm_tok', t), TOK2);
    await reload(A);
    await waitFor(async () => hellos(fb, 'A').length === 2, 'the changed token');
    assert.deepEqual(hellos(fb, 'A')[1], { op: 'hello', tok: TOK2 });
    const uid = (await frStore(A)).uid;
    assert.equal((await fb.store.getUser(uid)).tok, TOK2);
    await A.evaluate((t) => sessionStorage.setItem('__fcm_tok', t), TOK3);
    fb.down = true;
    const n = fb.calls.length;
    await reload(A);
    await waitFor(async () => (await calls(A)).includes('register') && fb.calls.slice(n).some((c) => c.who === 'A'), 'a try while the server is down (the ID token refresh fails first)');
    await A.waitForTimeout(300);
    assert.equal((await frStore(A)).tok, TOK2, 'not sent: the old token stays');
    fb.down = false;
    await reload(A);
    await waitFor(async () => (await frStore(A)).tok === TOK3, 'sent at the next start');
    assert.equal((await fb.store.getUser(uid)).tok, TOK3);
    return [A];
  }],
  ['Scenario 4: a push while the app is open refreshes that game at once: the row on Play, then the open board', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A', push: { perm: 'granted', token: TOK1 } });
    const B = await player(vp, fb, { who: 'B', push: { perm: 'granted', token: TOK2 } });
    const { gid, a, b } = await startGame(A, B);
    await goPlay(B);
    assert.equal(await rowLine(B, gid), 'Their move');
    await serverMoves(fb, gid, [a, b], ['e4']);
    const p1 = lastPush(fb, b); assert.deepEqual(p1, { t: 'move', g: gid });
    await B.evaluate((d) => window.__fc.pushIn(d), p1);
    await B.waitForFunction((g) => { const r = document.querySelector('#friendCard .fg-row[data-g="' + g + '"] .fg-state'); return r && r.textContent.startsWith('Your move'); }, gid, { timeout: 4000 });
    await openBoard(B, gid);
    assert.deepEqual((await boardOf(B)).hist, ['e4']);
    await serverMoves(fb, gid, [a, b], ['e5', 'Nf3']);
    await B.evaluate((d) => window.__fc.pushIn(d), lastPush(fb, b));
    await B.waitForFunction(() => { const h = window.__coach.st.fg && window.__coach.st.fg.history(); return h && h.length === 3; }, null, { timeout: 4000 });
    assert.deepEqual((await boardOf(B)).hist, ['e4', 'e5', 'Nf3'], 'the board shows the friend’s move without waiting for the 60 s timer');
    const n = fb.calls.length;
    await B.evaluate(() => window.__fc.pushIn({ t: 'move', g: 'not-a-game' }));
    await B.evaluate(() => window.__fc.pushIn(null));
    await B.waitForTimeout(400);
    assert.equal(fb.calls.length, n, 'a push without a game id does nothing');
    return [A, B];
  }],
  ['Tap on a notification (app running): opens that game’s board from another tab; a tap after the game ended shows its end card', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A', push: { perm: 'granted', token: TOK1 } });
    const B = await player(vp, fb, { who: 'B', push: { perm: 'granted', token: TOK2 } });
    const { gid, a, b } = await startGame(A, B);
    await B.locator('#tab-coach').click();
    await serverMoves(fb, gid, [a, b], ['d4']);
    await B.evaluate((d) => window.__fc.pushTap(d), lastPush(fb, b));
    await B.waitForFunction((g) => window.__coach.st.mode === 'friend' && window.__coach.st.fid === g && window.__coach.st.fg && window.__coach.st.fg.history().length === 1, gid, { timeout: 6000 });
    assert.deepEqual((await boardOf(B)).hist, ['d4'], 'the friend’s move is there');
    await fb.ops.handle({ uid: a }, { op: 'resign', g: gid });
    const p = lastPush(fb, b); assert.equal(p.t, 'over');
    if (await B.evaluate(() => { const e = document.getElementById('actClose'); return !!e && e.getClientRects().length > 0; })) await B.locator('#actClose').click();
    else await B.locator('#modeExit').click();
    await B.waitForFunction(() => window.__coach.st.mode !== 'friend');
    await B.locator('#tab-coach').click();
    await B.evaluate((d) => window.__fc.pushTap(d), p);
    await B.waitForFunction((g) => window.__coach.st.mode === 'friend' && window.__coach.st.fid === g, gid, { timeout: 6000 });
    await B.waitForFunction(() => { const e = document.getElementById('gameEnd'); return e && !e.hidden && e.querySelector('.ec-title'); }, null, { timeout: 6000 });
    assert.equal(await endTitle(B), 'You win!', 'the end card of the finished game');
    return [A, B];
  }],
  ['Cold start from a tap: the tap waits for the app (held by the plugin) and opens that game', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A', push: { perm: 'granted', token: TOK1 } });
    const B = await player(vp, fb, { who: 'B', push: { perm: 'granted', token: TOK2 } });
    const { gid, a, b } = await startGame(A, B);
    await serverMoves(fb, gid, [a, b], ['c4']);
    await B.evaluate((d) => sessionStorage.setItem('__push_tap', JSON.stringify(d)), lastPush(fb, b));
    await reload(B);
    await B.waitForFunction((g) => window.__coach.st.mode === 'friend' && window.__coach.st.fid === g && window.__coach.st.fg && window.__coach.st.fg.history().length === 1, gid, { timeout: 8000 });
    assert.deepEqual((await boardOf(B)).hist, ['c4']);
    return [A, B];
  }],
  ['No push work where the feature is off: a release build and a phone with the toggle off make no push call, even with an ID and the ask stored', async (vp, fb) => {
    const stored = { v: 1, test: true, uid: 'u-old', rt: 'rt-old', ask: true, tok: TOK1, games: {} };
    const R = await player(vp, fb, { who: 'R', release: true, push: { perm: 'granted' }, store: stored });
    const O = await player(vp, fb, { who: 'O', push: { perm: 'granted' }, store: Object.assign({}, stored, { test: false }) });
    for (const P of [R, O]) {
      await goPlay(P);
      await P.waitForTimeout(500);
      assert.deepEqual(await calls(P), [], 'no push call');
      await P.evaluate(() => window.__fc.pushTap({ t: 'move', g: 'AbCdEfGhIjKlMnOpQrSt' }));
      await P.waitForTimeout(300);
      assert.notEqual(await P.evaluate(() => window.__coach.st.mode), 'friend');
    }
    assert.equal(fb.calls.length, 0, 'no request');
    return [R, O];
  }]
];

if (require.main === module) H.run(cases);
