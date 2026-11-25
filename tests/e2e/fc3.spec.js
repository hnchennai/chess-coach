// E2E for slice FC3 of friend challenges (docs/specs/friend-challenges.product.md FC-D3, FC-D4, FC-D5, FC-D9, FC-D12, FC-D18,
// FC-D23, FC-D24, scenarios 1, 2 and 11; tech spec sections 3, 8 and 9): the Friend games card on Play, Challenge a friend,
// the share sheet, challenge links (cold start and warm), the Accept sheet with the nickname, Cancel invite, the 10 games
// limit, offline, the test toggle in Settings, and the web build.
// The Android plugins are a fake window.Capacitor (App with getLaunchUrl and appUrlOpen, Share recording its calls), and
// window.FC_CONFIG points the app at fake hosts (*.fc.test). Playwright answers those inside the test: Auth signUp and
// refresh with fake tokens, and the callable "friend" with the REAL server code (functions/src/ops.js on its in-memory store,
// functions/src/memstore.js), so two or three browser contexts (players) share one server. Nothing reaches the internet.
// Run: FC_VP=412 node tests/e2e/fc3.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// FC_VP: 360 | 412 | 1280. FC_ONLY=<regex> runs matching cases.
// Not checked here (no phone): App Links verification, the real share sheet, a link from WhatsApp, the real Firebase project.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const assert = require('assert/strict');
const G = require('./g2.spec.js');
const { makeOps } = require('../../functions/src/ops');
const { MemStore } = require('../../functions/src/memstore');

const WWW = process.env.FC_WWW || path.join(__dirname, '..', '..', 'www'); // FC_WWW: another build (red runs against main)
const SHOTS = process.env.FC_SHOTS || ''; // a folder: screenshots of the card and the sheets
const PORT = 8000 + Math.floor(Math.random() * 900);
const ORIGIN = 'http://127.0.0.1:' + PORT;
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }].filter((v) => !process.env.FC_VP || String(v.width) === process.env.FC_VP);
const ONLY = process.env.FC_ONLY ? new RegExp(process.env.FC_ONLY) : null;
const DAY = 86400000;
const FKEY = 'suresh-chess-coach.friends.v1';
const FAKE = /^https:\/\/(auth|token|fn)\.fc\.test\//;
const FIREBASE = /googleapis\.com\/(v1|identitytoolkit)|identitytoolkit|securetoken|cloudfunctions\.net|firebaseio|firestore\.googleapis|firebase/;
// The approved wording (FC-D23), letter for letter.
const W = {
  card: 'Friend games', challenge: 'Challenge a friend', full: 'You have 10 friend games open. Finish one to start another.', playAs: 'Play as', share: 'Share link',
  acceptTitle: 'A friend challenges you', nameLabel: 'Name your friend', accept: 'Accept', notNow: 'Not now', invalid: 'This challenge is no longer valid.',
  offline: 'Friend games need the internet. Try again when you are online.', cancel: 'Cancel invite', setting: 'Friend games (test)', friend: 'Friend', theirMove: 'Their move'
};
const SHARE_RE = /^Play chess with me in Chess Coach: https:\/\/hnchennai\.github\.io\/c\/\?c=([0-9A-HJKMNP-TV-Z]{10})$/;

// ---------- the fake Firebase: Auth REST and the callable, on the real ops ----------
function fakeFirebase() {
  const fb = { off: 0, store: new MemStore(), tokens: new Map(), refresh: new Map(), uids: [], calls: [], down: false };
  const now = () => Date.now() + fb.off;
  const ops = makeOps({ store: fb.store, now, rand: crypto.randomBytes, push: async () => {}, log: () => {}, deleteAuthUser: async () => {} });
  fb.ops = ops;
  const json = (route, status, body) => route.fulfill({ status, contentType: 'application/json', headers: { 'Access-Control-Allow-Origin': '*' }, body: JSON.stringify(body) });
  const STATUS = { 'failed-precondition': 400, 'invalid-argument': 400, 'not-found': 404, unauthenticated: 401, internal: 500 };
  fb.handle = async (route, who) => {
    const r = route.request(), url = r.url();
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'content-type, authorization', 'Access-Control-Allow-Methods': 'POST' } });
    const body = r.postData() || '';
    fb.calls.push({ who, url, body, headers: r.headers() });
    if (fb.down) return route.abort('internetdisconnected');
    if (url.startsWith('https://auth.fc.test/v1/accounts:signUp?key=fake-key')) {
      const uid = 'uid' + (fb.uids.length + 1) + crypto.randomBytes(4).toString('hex'), tok = 'id-' + crypto.randomBytes(8).toString('hex'), rt = 'rt-' + crypto.randomBytes(8).toString('hex');
      fb.uids.push(uid); fb.tokens.set(tok, uid); fb.refresh.set(rt, uid);
      return json(route, 200, { idToken: tok, refreshToken: rt, expiresIn: '3600', localId: uid });
    }
    if (url.startsWith('https://token.fc.test/v1/token?key=fake-key')) {
      const rt = new URLSearchParams(body).get('refresh_token'), uid = fb.refresh.get(rt);
      if (!uid) return json(route, 400, { error: { code: 400, message: 'INVALID_REFRESH_TOKEN' } });
      const tok = 'id-' + crypto.randomBytes(8).toString('hex'); fb.tokens.set(tok, uid);
      return json(route, 200, { id_token: tok, refresh_token: rt, expires_in: '3600', user_id: uid });
    }
    if (url === 'https://fn.fc.test/friend') {
      const h = r.headers(), m = /^Bearer (.+)$/.exec(h.authorization || ''), uid = m && fb.tokens.get(m[1]);
      let data = null; try { data = JSON.parse(body).data; } catch (e) { data = null; }
      try {
        const result = await ops.handle(uid ? { uid } : null, data);
        return json(route, 200, { result });
      } catch (e) {
        const st = e.status || 'internal';
        return json(route, STATUS[st] || 500, { error: { status: st.toUpperCase().replace(/-/g, '_'), message: e.status ? e.message : 'internal', details: e.details } });
      }
    }
    return json(route, 404, { error: { status: 'NOT_FOUND', message: 'no such fake' } });
  };
  return fb;
}

// ---------- the fake Android plugins (run in the page before the app) ----------
function fakeCap(cfg) {
  const C = cfg || {};
  const N = window.__fc = { share: [], ls: {}, launch: C.launch || null };
  window.FC_CONFIG = { projectId: 'demo-fc3', apiKey: 'fake-key', authBase: 'https://auth.fc.test', tokenBase: 'https://token.fc.test', fnBase: 'https://fn.fc.test' };
  const App = {
    addListener(name, f) { (N.ls[name] = N.ls[name] || []).push(f); return Promise.resolve({ remove() {} }); },
    getLaunchUrl() { return Promise.resolve(N.launch ? { url: N.launch } : undefined); },
    minimizeApp() { return Promise.resolve(); }
  };
  const Share = { share(o) { N.share.push(JSON.parse(JSON.stringify(o))); return C.shareCancel ? Promise.reject(new Error('Share canceled')) : Promise.resolve({}); } };
  N.open = (url) => (N.ls.appUrlOpen || []).slice().forEach((f) => f({ url }));
  N.resume = () => (N.ls.resume || []).slice().forEach((f) => f({ isActive: true }));
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { App, Share } };
}
function seed([pk, p, fk, f]) {
  if (sessionStorage.getItem('seeded')) return;
  if (p) localStorage.setItem(pk, JSON.stringify(p));
  if (f) localStorage.setItem(fk, JSON.stringify(f));
  sessionStorage.setItem('seeded', '1');
}

let browser;
// One player: a browser context of its own. o: { native (false: the web build), test (the toggle on), launch (a cold-start link), prof, who }
async function player(vp, fb, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  const who = o.who || 'p';
  await ctx.route(/.*/, (route) => { const u = route.request().url(); if (FAKE.test(u)) return fb.handle(route, who); if (/fonts\.(googleapis|gstatic)\.com/.test(u)) return route.fulfill({ status: 200, contentType: 'text/css', body: '' }); return route.continue(); });
  const store = o.test === false || o.native === false ? null : { v: 1, test: true, games: {} };
  await ctx.addInitScript(seed, [G.PKEY, o.prof || G.improver({ rating: 1100 }), FKEY, store]);
  if (o.native !== false) await ctx.addInitScript(fakeCap, { launch: o.launch || null, shareCancel: !!o.shareCancel });
  const page = await ctx.newPage();
  page.errors = []; page.outside = []; page.fb = []; page.scripts = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message|WebGL context was lost|THREE\.WebGLRenderer: Context (Lost|Restored)/.test(m.text()) && !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(m.text())) page.errors.push(m.type() + ': ' + m.text()); });
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('request', (r) => {
    const u = r.url();
    if (FAKE.test(u)) page.fb.push(u);
    else if (u.startsWith(ORIGIN + '/')) page.scripts.push(u.slice(ORIGIN.length));
    else if (!/^(data|blob|about):/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u)) page.outside.push(u);
  });
  await page.goto(ORIGIN + '/index.html');
  await page.waitForFunction(() => window.__coach && window.Placement);
  return page;
}
const shot = async (page, name) => { if (!SHOTS) return; await page.waitForTimeout(300); await page.screenshot({ path: path.join(SHOTS, page.viewportSize().width + '_' + name + '.png'), fullPage: true }); };
const goPlay = async (page) => { await page.locator('#tab-play').click(); await page.waitForFunction(() => window.__coach.st.tab === 'play'); };
// The card as the player sees it (null when it is not on screen)
const card = (page) => page.evaluate(() => {
  const el = document.getElementById('friendCard'), on = (e) => !!e && e.getClientRects().length > 0;
  if (!on(el)) return null;
  const b = el.querySelector('[data-act="fchallenge"]'), full = el.querySelector('.fg-full'), msg = el.querySelector('.fg-msg');
  const rows = [...el.querySelectorAll('.fg-row')].map((r) => ({ kind: r.dataset.kind, g: r.dataset.g, name: r.querySelector('b').textContent, line: r.querySelector('.fg-state').textContent,
    record: r.querySelector('.fg-rec') ? r.querySelector('.fg-rec').textContent : null, buttons: [...r.querySelectorAll('button')].map((x) => x.textContent),
    minH: Math.min(...[...r.querySelectorAll('button')].map((x) => x.getBoundingClientRect().height), 99) }));
  const box = el.getBoundingClientRect(), recent = document.getElementById('recentPlay');
  return { title: el.querySelector('.eyebrow').textContent, button: b.textContent, disabled: b.disabled, describedBy: b.getAttribute('aria-describedby'), bh: b.getBoundingClientRect().height,
    full: on(full) ? full.textContent : null, msg: on(msg) ? msg.textContent : null, rows, right: box.right, vw: window.innerWidth, scrollW: document.documentElement.scrollWidth,
    aboveRecent: !on(recent) || box.bottom <= recent.getBoundingClientRect().top, text: el.innerText };
});
const sheet = (page) => page.evaluate(() => {
  const el = document.getElementById('friendSheet'), on = (e) => !!e && e.getClientRects().length > 0;
  if (!on(el)) return null;
  const q = (s) => el.querySelector(s), t = (s) => (q(s) ? q(s).textContent : null), msg = q('#fgMsg');
  const p = q('.sheet-panel').getBoundingClientRect();
  return { title: t('#fgTitle'), playAs: t('#fgColLbl'), cols: [...el.querySelectorAll('[data-fcol]')].map((b) => [b.textContent, b.getAttribute('aria-checked')]), col: t('#fgCol'),
    label: q('label[for="fgNick"]') ? q('label[for="fgNick"]').childNodes[0].textContent.trim() : null, hint: t('label[for="fgNick"] small'), max: q('#fgNick') ? q('#fgNick').maxLength : null,
    buttons: [...el.querySelectorAll('.sheet-panel button')].filter(on).map((b) => b.textContent || b.getAttribute('aria-label')), msg: on(msg) ? msg.textContent : null,
    minH: Math.min(...[...el.querySelectorAll('.fg-sheet button, #fgNick')].filter(on).map((b) => b.getBoundingClientRect().height)), left: p.left, right: p.right, vw: window.innerWidth,
    dialog: q('.sheet-panel').getAttribute('role'), modal: q('.sheet-panel').getAttribute('aria-modal'), focusIn: el.contains(document.activeElement) };
});
const shares = (page) => page.evaluate(() => window.__fc.share.slice());
const frStore = (page) => page.evaluate(() => window.__coach.fr());
const noteText = (page) => page.evaluate(() => { const n = document.getElementById('raniNote'); return n && !n.hidden ? n.innerText : null; });
// Challenge a friend as col ('w' | 'b' | 'r'): returns the invite code from the share text
async function challenge(page, col) {
  await goPlay(page);
  await page.locator('#friendCard [data-act="fchallenge"]').click();
  await page.waitForFunction(() => !document.getElementById('friendSheet').hidden);
  if (col) await page.locator('#friendSheet [data-fcol="' + col + '"]').click();
  const n = (await shares(page)).length;
  await page.locator('#friendSheet [data-act="fsend"]').click();
  await page.waitForFunction((k) => window.__fc.share.length > k, n);
  const s = (await shares(page))[n];
  const m = SHARE_RE.exec(s.text); assert.ok(m, 'share text: ' + s.text);
  return m[1];
}
const linkOf = (code) => 'https://hnchennai.github.io/c/?c=' + code;
async function acceptSheet(page) { await page.waitForFunction(() => { const s = document.getElementById('friendSheet'); return s && !s.hidden && document.querySelector('[data-act="faccept"]'); }, null, { timeout: 15000 }); return sheet(page); }
async function doAccept(page, name) {
  if (name != null) await page.locator('#fgNick').fill(name);
  await page.locator('#friendSheet [data-act="faccept"]').click();
  await page.waitForFunction(() => document.getElementById('friendSheet').hidden);
}
async function rowsAfterResume(page, n) {
  await page.evaluate(() => window.__fc.resume());
  await page.waitForFunction((k) => { const c = document.getElementById('friendCard'); return c && c.querySelectorAll('.fg-row').length === k; }, n);
  await page.waitForTimeout(150);
  return (await card(page)).rows;
}
function layoutOk(c, msg) {
  assert.ok(c.right <= c.vw + 0.5, msg + ': the card fits the width');
  assert.ok(c.scrollW <= c.vw, msg + ': no sideways scroll');
  assert.ok(c.bh >= 44, msg + ': the Challenge button is at least 44px high');
  c.rows.forEach((r) => assert.ok(r.minH >= 44, msg + ': row buttons at least 44px high'));
  assert.ok(c.aboveRecent, msg + ': above Recent games');
}

const cases = [
  ['Scenario 11, FC-D4: the web build has no card, loads no friend client and makes no request to any Firebase host', async (vp, fb) => {
    const page = await player(vp, fb, { native: false, prof: G.improver({ rating: 1100, games: [G.PAST()] }) });
    assert.equal(await page.evaluate(() => typeof window.Capacitor), 'undefined');
    await goPlay(page);
    assert.equal(await card(page), null, 'no card');
    assert.equal(await page.evaluate(() => document.getElementById('friendCard').innerHTML), '', 'nothing inside it');
    assert.equal(await page.evaluate(() => typeof window.FClient + typeof window.FCONFIG), 'undefinedundefined', 'no client, no config');
    assert.ok(!page.scripts.some((u) => /fclient|fconfig/.test(u)), 'fclient.js and fconfig.js are never fetched: ' + page.scripts.filter((u) => /\.js$/.test(u)).join(' '));
    await page.evaluate(() => window.__coach.openSettings());
    assert.equal(await page.evaluate(() => { const s = document.getElementById('friendSet'); return s.hidden && s.innerHTML === ''; }), true, 'no test toggle in Settings');
    assert.equal(await page.evaluate(() => window.__coach.fr()), null);
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), FKEY), null, 'nothing stored');
    assert.ok(!(await page.evaluate(() => document.body.innerText)).includes('Friend games'), 'no friend words anywhere');
    assert.equal(page.fb.length, 0); assert.equal(fb.calls.length, 0);
    return [page];
  }],
  ['Tech spec 9: in the app with the switch off the card is hidden until Settings’ "Friend games (test)"; no request before a Challenge', async (vp, fb) => {
    const page = await player(vp, fb, { test: false });
    await goPlay(page);
    assert.equal(await card(page), null, 'switch off, toggle off: no card');
    assert.deepEqual(await page.evaluate(() => Object.keys(window.__fc.ls)), ['backButton'], 'feature off: only the back button (G2c), no App listener from friend games (G-D18)');
    await page.evaluate(() => window.__coach.openSettings());
    const sw = page.locator('#friendSw');
    assert.equal(await sw.innerText(), W.setting);
    assert.equal(await sw.getAttribute('aria-checked'), 'false');
    assert.ok((await sw.boundingBox()).height >= 44);
    await sw.click();
    assert.equal(await sw.getAttribute('aria-checked'), 'true');
    assert.equal((await frStore(page)).test, true, 'kept in the device store');
    assert.deepEqual(await page.evaluate(() => Object.keys(window.__fc.ls).sort()), ['appUrlOpen', 'backButton', 'resume'], 'turned on: the link and resume listeners are added');
    await page.locator('[data-act="settingsclose"]').click();
    const c = await card(page);
    assert.ok(c, 'the card shows');
    assert.equal(c.title, W.card); assert.equal(c.button, W.challenge); assert.deepEqual(c.rows, []);
    layoutOk(c, 'toggle on');
    await page.reload(); await page.waitForFunction(() => window.__coach);
    await goPlay(page);
    assert.ok(await card(page), 'still on after a restart');
    await page.locator('#friendCard [data-act="fchallenge"]').click();
    assert.ok(await sheet(page), 'opening the sheet');
    assert.equal(page.fb.length, 0, 'no request yet: opening the card and the sheet signs nothing up');
    return [page];
  }],
  ['Scenario 1, FC-D9: Challenge a friend: Play as, Share link, the approved share text, a waiting row; the first request is the sign-up', async (vp, fb) => {
    const page = await player(vp, fb, { who: 'A' });
    await goPlay(page);
    await page.evaluate(() => window.__fc.resume()); await page.waitForTimeout(200);
    assert.equal(page.fb.length, 0, 'Play tab open and resume make no request before the first Challenge (no ID yet)');
    await page.locator('#friendCard [data-act="fchallenge"]').click();
    const s = await sheet(page);
    assert.equal(s.title, W.challenge); assert.equal(s.playAs, W.playAs);
    assert.deepEqual(s.cols, [['White', 'false'], ['Black', 'false'], ['Random', 'true']], 'Random is picked to start with');
    assert.equal(s.dialog, 'dialog'); assert.equal(s.modal, 'true'); assert.ok(s.focusIn, 'focus is in the sheet');
    assert.ok(s.minH >= 44, 'buttons at least 44px'); assert.ok(s.left >= 0 && s.right <= s.vw + 0.5, 'the sheet fits');
    await shot(page, 'challenge_sheet');
    await page.locator('#friendSheet [data-fcol="b"]').click();
    assert.deepEqual((await sheet(page)).cols.map((x) => x[1]), ['false', 'true', 'false']);
    await page.keyboard.press('ArrowRight');
    assert.deepEqual((await sheet(page)).cols.map((x) => x[1]), ['false', 'false', 'true'], 'arrow keys move the pick');
    await page.keyboard.press('ArrowLeft');
    await page.locator('#friendSheet [data-act="fsend"]').click();
    await page.waitForFunction(() => window.__fc.share.length === 1);
    const sh = (await shares(page))[0];
    assert.deepEqual(Object.keys(sh), ['text'], 'only the text: the message is written on the phone');
    const m = SHARE_RE.exec(sh.text); assert.ok(m, sh.text);
    assert.equal(await page.evaluate((u) => window.Friends.parseLink(u), linkOf(m[1])), m[1], 'the shared link parses');
    assert.ok(page.fb[0].startsWith('https://auth.fc.test/v1/accounts:signUp'), 'the first request ever is the anonymous sign-up');
    assert.equal(page.fb.length, 2, 'sign-up and invite, nothing else');
    assert.equal(await sheet(page), null, 'the sheet closed');
    const inv = fb.store.get('invites', m[1]); assert.ok(inv, 'the server has the invite');
    const g = fb.store.get('games', inv.g);
    assert.equal(g.col, 'b'); assert.equal(g.st, 'invited');
    const c = await card(page);
    assert.equal(c.rows.length, 1);
    const want = await page.evaluate((e) => window.Friends.dayMonth(e), inv.exp);
    assert.deepEqual([c.rows[0].kind, c.rows[0].name, c.rows[0].line, c.rows[0].record], ['invite', W.friend, 'Waiting for your friend, until ' + want, null]);
    assert.deepEqual(c.rows[0].buttons, [W.share, W.cancel]);
    layoutOk(c, 'with an invite');
    await shot(page, 'card_invite');
    const st = await frStore(page);
    assert.ok(st.uid && st.rt, 'the ID and refresh token are on the device');
    assert.equal(st.games[inv.g].code, m[1]);
    // the waiting row shares the same link again
    await page.locator('#friendCard [data-act="fshare"]').click();
    await page.waitForFunction(() => window.__fc.share.length === 2);
    assert.equal((await shares(page))[1].text, sh.text);
    assert.equal(page.fb.length, 2, 'sharing again needs no request');
    // and the profile never holds the ID or a token (FC-D3: device only)
    const raw = await page.evaluate((k) => localStorage.getItem(k), G.PKEY);
    assert.ok(!raw.includes(st.uid) && !raw.includes(st.rt), 'nothing of the friend store in the profile');
    return [page];
  }],
  ['Scenario 2: accept by a cold-start link: Accept sheet, You play White, the nickname (trimmed, 20 characters) on this phone only, Your move 3 days left', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A' });
    const code = await challenge(A, 'b');
    const B = await player(vp, fb, { who: 'B', launch: linkOf(code) });
    const s = await acceptSheet(B);
    assert.equal(s.title, W.acceptTitle); assert.equal(s.col, 'You play White');
    assert.equal(s.label, W.nameLabel); assert.equal(s.hint, 'optional, stays on this phone'); assert.equal(s.max, 20);
    assert.deepEqual(s.buttons.slice(1), [W.accept, W.notNow]);
    assert.ok(s.minH >= 44);
    await shot(B, 'accept_sheet');
    assert.equal(await B.evaluate(() => window.__coach.st.tab), 'play', 'the app is on Play under the sheet');
    assert.ok(B.fb[0].includes('signUp') && B.fb.length === 2, 'sign-up, then peek');
    await doAccept(B, 'Priyadarshini Ramanathan'); // 24 characters: the field takes 20
    const g = fb.store.get('games', fb.store.get('invites', code) && Object.keys(fb.store.dump().games)[0]);
    assert.equal(g.st, 'active');
    const c = await card(B);
    assert.equal(c.rows.length, 1);
    assert.deepEqual([c.rows[0].kind, c.rows[0].name, c.rows[0].line, c.rows[0].record], ['mine', 'Priyadarshini Ramana', 'Your move, 3 days left', 'W 0 · L 0 · D 0']);
    const p = await B.evaluate(() => window.__coach.getProf());
    const opp = (await frStore(B)).games[c.rows[0].g].opp;
    assert.equal(p.v, 6);
    assert.equal(p.friends[opp].n, 'Priyadarshini Ramana'); assert.deepEqual(p.friends[opp].res, {});
    assert.equal(JSON.parse(await B.evaluate((k) => localStorage.getItem(k), G.PKEY)).friends[opp].n, 'Priyadarshini Ramana', 'saved');
    assert.ok(!fb.calls.some((x) => x.body.includes('Priya')), 'FC-D5: the nickname never goes to the server');
    // the challenger's row turns into "Their move" on resume, named "Friend"
    const ra = await rowsAfterResume(A, 1);
    await A.waitForFunction(() => document.querySelector('#friendCard .fg-row').dataset.kind === 'theirs');
    const ra2 = (await card(A)).rows;
    assert.deepEqual([ra2[0].name, ra2[0].line, ra2[0].record], [W.friend, W.theirMove, 'W 0 · L 0 · D 0'], JSON.stringify(ra));
    // a restart does not bring the same launch link back as a new challenge
    await B.reload(); await B.waitForFunction(() => window.__coach); await B.waitForTimeout(400);
    assert.equal(await sheet(B), null, 'no Accept sheet again for the handled launch link');
    assert.equal(await noteText(B), null, 'and no "no longer valid" note either');
    return [A, B];
  }],
  ['Scenario 2: accept by a warm link (appUrlOpen), a Random invite, no nickname: the row says Friend; the clock follows the server', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A' });
    const code = await challenge(A, 'r');
    const B = await player(vp, fb, { who: 'B' });
    assert.equal(B.fb.length, 0);
    await B.evaluate((u) => window.__fc.open(u), linkOf(code));
    const s = await acceptSheet(B);
    assert.equal(s.col, 'Your colour is picked at random.');
    await doAccept(B, '   ');
    const st = await frStore(B), g = Object.values(st.games)[0];
    const c = await card(B);
    assert.equal(c.rows[0].name, W.friend);
    assert.equal(c.rows[0].line, g.me === 'w' ? 'Your move, 3 days left' : W.theirMove);
    assert.deepEqual((await B.evaluate(() => window.__coach.getProf())).friends, {}, 'no nickname, nothing stored');
    // the server's clock 1 day and an hour ahead: time left counts in server time (skew), not the phone's
    fb.off = DAY + 3600000;
    const mover = g.me === 'w' ? B : A;
    await mover.evaluate(() => window.__fc.resume());
    await mover.waitForFunction(() => { const r = document.querySelector('#friendCard .fg-row[data-kind="mine"] .fg-state'); return r && r.textContent === 'Your move, 2 days left'; }, null, { timeout: 10000 });
    return [A, B];
  }],
  ['Bad and used links say "This challenge is no longer valid."; a bad one needs no request', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A' });
    const code = await challenge(A, 'w');
    const B = await player(vp, fb, { who: 'B' });
    for (const u of ['https://hnchennai.github.io/c/?c=NOTACODE', 'https://example.com/c/?c=' + code, 'https://hnchennai.github.io/c/' + code]) {
      await B.evaluate((x) => window.__fc.open(x), u);
      await B.waitForFunction(() => !document.getElementById('raniNote').hidden);
      assert.ok((await noteText(B)).includes(W.invalid), u);
      await B.evaluate(() => { const b = document.querySelector('#raniNote button'); if (b) b.click(); });
      await B.waitForFunction(() => document.getElementById('raniNote').hidden);
    }
    assert.equal(B.fb.length, 0, 'a bad link is refused on the phone');
    await B.evaluate((u) => window.__fc.open(u), linkOf(code));
    await acceptSheet(B); await doAccept(B, 'Ravi');
    // a third player taps the same (now used) link, warm and cold
    const C = await player(vp, fb, { who: 'C' });
    await C.evaluate((u) => window.__fc.open(u), linkOf(code));
    await C.waitForFunction(() => !document.getElementById('raniNote').hidden, null, { timeout: 10000 });
    assert.ok((await noteText(C)).includes(W.invalid));
    assert.equal(await sheet(C), null, 'no Accept sheet');
    const D = await player(vp, fb, { who: 'D', launch: linkOf(code) });
    await D.waitForFunction(() => !document.getElementById('raniNote').hidden, null, { timeout: 10000 });
    assert.ok((await noteText(D)).includes(W.invalid));
    // a cancelled invite is no longer valid either
    const code2 = await challenge(A, 'w');
    await A.locator('#friendCard .fg-row[data-kind="invite"] [data-act="fcancel"]').click();
    await A.waitForFunction(() => !document.querySelector('#friendCard .fg-row[data-kind="invite"]'));
    await C.evaluate(() => { const b = document.querySelector('#raniNote button'); if (b) b.click(); });
    await C.evaluate((u) => window.__fc.open(u), linkOf(code2));
    await C.waitForFunction(() => !document.getElementById('raniNote').hidden && document.getElementById('raniNote').innerText.includes('no longer valid'), null, { timeout: 10000 });
    return [A, B, C, D];
  }],
  ['Offline: "Friend games need the internet. Try again when you are online." on Share link, on a link, and on Play', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A' });
    await goPlay(A);
    await A.context().setOffline(true);
    await A.locator('#friendCard [data-act="fchallenge"]').click();
    await A.locator('#friendSheet [data-act="fsend"]').click();
    await A.waitForFunction(() => { const m = document.getElementById('fgMsg'); return m && !m.hidden; });
    assert.equal((await sheet(A)).msg, W.offline);
    assert.equal((await shares(A)).length, 0, 'nothing shared');
    assert.equal(A.fb.length, 0);
    await A.keyboard.press('Escape');
    assert.equal(await sheet(A), null, 'Esc closes the sheet');
    await A.evaluate(() => window.__fc.open('https://hnchennai.github.io/c/?c=7K3M9QH2XA'));
    await A.waitForFunction(() => !document.getElementById('raniNote').hidden);
    assert.ok((await noteText(A)).includes(W.offline));
    await A.evaluate(() => { const b = document.querySelector('#raniNote button'); if (b) b.click(); });
    // online again: the challenge works; then offline on resume shows the line on the card
    await A.context().setOffline(false);
    await challenge(A, 'w');
    await A.context().setOffline(true);
    await A.evaluate(() => window.__fc.resume());
    await A.waitForFunction(() => { const m = document.querySelector('#friendCard .fg-msg'); return m && m.textContent; });
    assert.equal((await card(A)).msg, W.offline);
    assert.equal((await card(A)).rows.length, 1, 'the rows stay on screen offline');
    await A.context().setOffline(false);
    await A.evaluate(() => window.__fc.resume());
    await A.waitForFunction(() => !document.querySelector('#friendCard .fg-msg'));
    // the server unreachable while the phone says it is online
    fb.down = true;
    await A.locator('#friendCard [data-act="fchallenge"]').click();
    await A.locator('#friendSheet [data-act="fsend"]').click();
    await A.waitForFunction(() => { const m = document.getElementById('fgMsg'); return m && !m.hidden; }, null, { timeout: 25000 });
    assert.equal((await sheet(A)).msg, W.offline);
    fb.down = false;
    return [A];
  }],
  ['FC-D18: Cancel invite ends the invite on the server and frees its slot', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A' });
    const code = await challenge(A, 'w');
    const gid = fb.store.get('invites', code).g;
    await A.locator('#friendCard [data-act="fcancel"]').click();
    await A.waitForFunction(() => document.querySelectorAll('#friendCard .fg-row').length === 0);
    const g = fb.store.get('games', gid);
    assert.equal(g.st, 'over'); assert.deepEqual(g.res, { r: null, why: 'expired' });
    assert.equal(fb.store.get('invites', code), undefined, 'the invite is gone');
    assert.equal((await frStore(A)).games[gid].st, 'over', 'the device knows');
    const focus = await A.evaluate(() => document.activeElement && document.activeElement.dataset.act);
    assert.equal(focus, 'fchallenge', 'focus goes to Challenge a friend, never to the page');
    return [A];
  }],
  ['FC-D12: at 10 open games the button is off and says why', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A' });
    await challenge(A, 'w');
    const uid = (await frStore(A)).uid;
    for (let i = 0; i < 9; i++) await fb.ops.handle({ uid }, { op: 'invite', col: 'r' });
    await A.evaluate(() => window.__fc.resume());
    await A.waitForFunction(() => document.querySelectorAll('#friendCard .fg-row').length === 10, null, { timeout: 10000 });
    const c = await card(A);
    assert.equal(c.disabled, true);
    assert.equal(c.full, W.full);
    assert.equal(c.describedBy, 'friendFull', 'the button names the reason');
    layoutOk(c, '10 rows');
    await shot(A, 'card_full');
    // the server agrees: an 11th is refused with "full" (shown with the same line)
    await assert.rejects(fb.ops.handle({ uid }, { op: 'invite', col: 'w' }), (e) => e.message === 'full');
    await A.locator('#friendCard .fg-row [data-act="fcancel"]').first().click();
    await A.waitForFunction(() => !document.querySelector('#friendCard [data-act="fchallenge"]').disabled);
    assert.equal((await card(A)).full, null, 'one cancelled: the button is on again');
    return [A];
  }],
  ['Back button and Not now close the Accept sheet; nothing is accepted', async (vp, fb) => {
    const A = await player(vp, fb, { who: 'A' });
    const code = await challenge(A, 'w');
    const B = await player(vp, fb, { who: 'B' });
    await B.evaluate((u) => window.__fc.open(u), linkOf(code));
    await acceptSheet(B);
    assert.equal(await B.evaluate(() => window.__coach.backPressed()), true, 'back is used');
    assert.equal(await sheet(B), null);
    await B.evaluate((u) => window.__fc.open(u), linkOf(code));
    await B.waitForTimeout(3100); // the same link a moment later is a new tap
    await B.evaluate((u) => window.__fc.open(u), linkOf(code));
    await acceptSheet(B);
    await B.locator('#friendSheet [data-act="fclose"]', { hasText: W.notNow }).click();
    assert.equal(await sheet(B), null);
    assert.equal(fb.store.get('games', fb.store.get('invites', code).g).st, 'invited', 'still waiting for a friend');
    assert.equal(await card(B).then((c) => c.rows.length), 0);
    return [A, B];
  }]
];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css', '.wasm': 'application/wasm', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream' };
function serve() {
  const srv = http.createServer((req, res) => {
    const f = path.join(WWW, path.normalize(decodeURIComponent(req.url.split('?')[0])));
    if (!f.startsWith(WWW + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(f, (err, data) => { if (err) { res.writeHead(404); res.end(); return; } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(data); });
  });
  return new Promise((r) => srv.listen(PORT, '127.0.0.1', () => r(srv)));
}
async function run() {
  const srv = await serve();
  browser = await chromium.launch();
  const results = []; let failures = 0;
  try {
    for (const vp of VIEWPORTS) for (const [name, fn] of cases) {
      if (ONLY && !ONLY.test(name)) continue;
      const label = vp.width + 'x' + vp.height + ' ' + name, fb = fakeFirebase();
      let pages = [];
      try {
        pages = await fn(vp, fb);
        for (const p of pages) {
          assert.deepEqual(p.errors, [], 'console errors or warnings');
          assert.deepEqual(p.outside, [], 'no request leaves the page origin and the fake friend server');
          assert.ok(!p.fb.some((u) => FIREBASE.test(u)) && !p.outside.some((u) => FIREBASE.test(u)), 'no real Firebase host');
        }
        results.push('ok   ' + label);
      } catch (e) {
        failures++; results.push('FAIL ' + label + '\n     ' + String(e && e.message || e).split('\n').slice(0, 10).join('\n     ') + (process.env.FC_STACK ? '\n' + e.stack : ''));
        for (const p of pages || []) if (p.errors && p.errors.length) results.push('     page errors: ' + JSON.stringify(p.errors).slice(0, 400));
      } finally { for (const p of browser.contexts()) await p.close(); }
    }
  } finally { await browser.close(); srv.close(); }
  console.log(results.join('\n'));
  console.log('\n' + (results.length - failures) + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
}
run();
