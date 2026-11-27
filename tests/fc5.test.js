// Unit tests for slice FC5 of friend challenges: push notifications and the real Firebase config (docs/specs/
// friend-challenges.product.md FC-D14, FC-D20, FC-D37, FC-D38; tech spec sections 4, 9 and 10). The pure parts in
// www/js/friends.js (the store's ask flag, a push's game id, the channel), the client's token hand-over in www/js/fclient.js
// (op hello, fetch is a fake: nothing reaches any network), fconfig.js's real project, config/google-services.json, the pins.
// Run: node --test tests/fc5.test.js   (after sh scripts/build.sh)
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), path = require('path'), vm = require('vm');
const F = require('../www/js/friends.js');
const FC = require('../www/js/fclient.js');

const ROOT = path.join(__dirname, '..');
const read = (f) => fs.readFileSync(path.join(ROOT, f), 'utf8');
const T = Date.UTC(2026, 10, 26, 6, 0, 0);
const GID = 'AbCdEfGhIjKlMnOpQrSt';
const TOK = 'dQw4w9WgXcQ:APA91bH_fake-token_0123456789';

test('FC-D14: the store keeps whether this phone was asked for notifications (ask), default false; tok is the token sent', () => {
  assert.equal(F.blank().ask, false);
  assert.equal(F.read(JSON.stringify({ v: 1, ask: true })).ask, true);
  ['yes', 1, null, {}].forEach((x) => assert.equal(F.read(JSON.stringify({ v: 1, ask: x })).ask, false, String(x)));
  assert.equal(F.read(JSON.stringify({ v: 1, tok: TOK })).tok, TOK);
});

test('FC5: a push names its game by data.g (a game id); anything else is no game', () => {
  assert.equal(F.pushGame({ id: 'm1', data: { t: 'move', g: GID } }), GID, 'pushNotificationReceived');
  assert.equal(F.pushGame({ id: 'm1', data: { t: 'over', g: GID, 'google.sent_time': 1 } }), GID, 'a tap carries the intent extras too');
  [null, undefined, {}, { data: null }, { data: { g: 'short' } }, { data: { g: GID + 'x' } }, { data: { g: 7 } }, { data: { g: '../../etc/passwd/xx' } }].forEach((n) => assert.equal(F.pushGame(n), null, JSON.stringify(n)));
});

test('FC5: the notification channel: id friend, the approved name "Friend games", importance 4 (high)', () => {
  assert.deepEqual(F.CHANNEL, { id: 'friend', name: 'Friend games', importance: 4 });
  assert.ok(Object.isFrozen(F.CHANNEL));
  assert.equal(F.CHANNEL.name, F.COPY.card, 'the card title, no new text');
});

test('FC5: tokenOk: FCM token characters only (as the server checks), at most 4096', () => {
  assert.equal(F.tokenOk(TOK), true);
  ['', null, 5, 'a b', 'x'.repeat(4097), 'tok\n', 'é'].forEach((t) => assert.equal(F.tokenOk(t), false, String(t)));
});

// ---------- fclient: the token goes to the server with op hello ----------
function fakeNet(handler) {
  const calls = [];
  const fetch = async (url, init) => {
    calls.push({ url, body: init && init.body });
    const r = await handler(url, init);
    if (r instanceof Error) throw r;
    return { status: r.status, json: async () => r.body };
  };
  return { fetch, calls };
}
function memStorage(raw) { const m = { raw: raw === undefined ? null : raw }; return { get: () => m.raw, set: (v) => { m.raw = v; }, m }; }
const CFG = { projectId: 'demo-test', apiKey: 'test-key', authBase: 'https://auth.fc.test', tokenBase: 'https://token.fc.test', fnBase: 'https://fn.fc.test' };
const signedIn = () => memStorage(JSON.stringify(Object.assign(F.blank(), { uid: 'u1', rt: 'rt-u1' })));
const okNet = () => fakeNet(async (url) => url.startsWith('https://token.fc.test') ? { status: 200, body: { id_token: 'id-u1', refresh_token: 'rt-u1', expires_in: '3600', user_id: 'u1' } } : { status: 200, body: { result: { now: T } } });
const client = (net, st) => FC.make({ config: CFG, fetch: net.fetch, storage: st, now: () => T, timeoutMs: 500 });
const hellos = (net) => net.calls.filter((c) => c.url === 'https://fn.fc.test/friend').map((c) => JSON.parse(c.body).data);

test('sendTok: a new token goes with op hello { tok } and is kept as tok; the same token again sends nothing', async () => {
  const net = okNet(), st = signedIn(), c = client(net, st);
  assert.equal(await c.sendTok(TOK), true);
  assert.deepEqual(hellos(net), [{ op: 'hello', tok: TOK }]);
  assert.equal(F.read(st.m.raw).tok, TOK, 'kept in the friend store');
  assert.equal(await c.sendTok(TOK), false, 'unchanged');
  assert.equal(hellos(net).length, 1);
  assert.equal(await c.sendTok(TOK + 'b'), true, 'a changed token is sent again');
  assert.deepEqual(hellos(net)[1], { op: 'hello', tok: TOK + 'b' });
});

test('sendTok: without an ID nothing is sent and nothing signs up; a bad token is never sent', async () => {
  const net = okNet(), c = client(net, memStorage());
  assert.equal(await c.sendTok(TOK), false);
  const c2 = client(net, signedIn());
  assert.equal(await c2.sendTok('bad token'), false);
  assert.equal(await c2.sendTok(null), false);
  assert.equal(net.calls.length, 0);
});

test('sendTok: offline keeps the old tok, so the next start sends it again', async () => {
  const net = fakeNet(async () => new TypeError('Failed to fetch')), st = signedIn(), c = client(net, st);
  await assert.rejects(c.sendTok(TOK), (e) => e.code === 'offline');
  assert.equal(F.read(st.m.raw).tok, null);
});

test('setAsk: the ask is remembered in the friend store', () => {
  const st = signedIn(), c = client(okNet(), st);
  c.setAsk();
  assert.equal(F.read(st.m.raw).ask, true);
  assert.equal(c.store().ask, true);
});

// ---------- FC-D38: the real Firebase project (public client config, FC-D20) ----------
test('FC-D38: fconfig.js holds the real project chess-coach-100 and its Web API key; a release build uses them', () => {
  const src = read('src/js/fconfig.js');
  assert.ok(!/PLACEHOLDER/.test(src), 'no placeholders left in the app');
  const w = { CC_BUILD: { test: false }, FC_CONFIG: { apiKey: 'fake-key' } };
  vm.runInNewContext(src, { window: w });
  assert.equal(w.FCONFIG.projectId, 'chess-coach-100');
  assert.equal(w.FCONFIG.apiKey, 'AIzaSyDw3xbGs4PFvkQDwL2FjFFMUMKGV2o0vp0');
  assert.equal(w.FCONFIG.fnBase, 'https://asia-south1-chess-coach-100.cloudfunctions.net');
  assert.equal(w.FCONFIG.authBase, 'https://identitytoolkit.googleapis.com');
  assert.equal(w.FCONFIG.tokenBase, 'https://securetoken.googleapis.com');
  assert.equal(FC.configured(w.FCONFIG), true);
  assert.equal(F.CONFIG.live, false, 'the launch switch stays off (FC6)');
});

test('FC-D20: config/google-services.json is the chess-coach-100 Android app com.suresh.chesscoach and holds no secret', () => {
  const raw = read('config/google-services.json'), j = JSON.parse(raw);
  assert.equal(j.project_info.project_id, 'chess-coach-100');
  assert.equal(j.client.length, 1);
  assert.equal(j.client[0].client_info.android_client_info.package_name, 'com.suresh.chesscoach');
  assert.deepEqual(j.client[0].oauth_client, []);
  assert.ok(!/private_key|client_secret|BEGIN|password/i.test(raw), 'no secret');
  assert.ok(!fs.existsSync(path.join(ROOT, '.firebaserc')), 'no .firebaserc (deploys name the project on the command line)');
});

test('FC5 pins: @capacitor/push-notifications 8.1.3 exactly; CI checks it, cap sync, firebase-messaging 25.0.1 and no firebase-analytics', () => {
  const p = JSON.parse(read('package.json'));
  assert.equal(p.dependencies['@capacitor/push-notifications'], '8.1.3');
  assert.equal(p.dependencies['@capacitor/share'], '8.0.3');
  const y = read('.github/workflows/build-apk.yml');
  assert.ok(y.includes("'@capacitor/push-notifications 8.1.3'"), 'npm version check');
  assert.ok(y.includes("'@capacitor/push-notifications@8.1.3'"), 'cap sync lists it');
  assert.ok(y.includes("include ':capacitor-push-notifications'"), 'in the Android project');
  assert.ok(y.includes("'com.google.firebase:firebase-messaging:25.0.1'"), 'Gradle resolves exactly 25.0.1');
  assert.ok(/firebase-messaging:\.\* -> /.test(y), 'and fails if resolution changed it');
  assert.ok(/ANALYTICS='[^'\n]*firebase-analytics/.test(y), 'no firebase-analytics anywhere on the classpath (fix 4 widens the check)');
  assert.ok(/android-friends\.sh --check-merged android/.test(y));
});

// Fix round 1, fix 4: no analytics library on the classpath of either variant the workflow builds. The ads SDK itself pulls in
// play-services-measurement-sdk-api and -measurement-base (checked on Google's Maven, 2026-11-27), so those two stay allowed.
test('Fix 4: CI fails on firebase-analytics and the analytics measurement libraries, on the release and debug classpaths', () => {
  const y = read('.github/workflows/build-apk.yml');
  assert.ok(/:app:dependencies --configuration releaseRuntimeClasspath/.test(y));
  assert.ok(/:app:dependencies --configuration debugRuntimeClasspath/.test(y), 'the debug build (no signing secrets) is checked too');
  const m = /ANALYTICS='([^']+)'/.exec(y); assert.ok(m, 'one pattern for the analytics check');
  const re = new RegExp(m[1]);
  ['+--- com.google.firebase:firebase-analytics:22.1.0', '|    +--- com.google.android.gms:play-services-measurement:22.1.0', '+--- com.google.android.gms:play-services-measurement-api:22.1.0',
    '+--- com.google.android.gms:play-services-measurement-impl:22.1.0', '+--- com.google.android.gms:play-services-measurement-sdk:22.1.0'].forEach((l) => assert.ok(re.test(l), 'fails on ' + l));
  ['|    +--- com.google.android.gms:play-services-measurement-sdk-api:20.1.2', '|    |    \\--- com.google.android.gms:play-services-measurement-base:[20.1.2] -> 20.1.2',
    '+--- com.google.firebase:firebase-measurement-connector:19.0.0', '+--- com.google.firebase:firebase-messaging:25.0.1'].forEach((l) => assert.ok(!re.test(l), 'allows ' + l));
  assert.ok(/for C in release debug/.test(y) && /grep -E -- "\$ANALYTICS"/.test(y), 'run on both classpaths');
});

// Fix round 1, fix 6: a restored backup (FC-D30) can carry ask and tok from another phone; the app resets them
test('resetPush: ask and tok go, so the next Challenge or Accept asks on this phone', () => {
  const st = memStorage(JSON.stringify(Object.assign(F.blank(), { uid: 'u1', rt: 'rt-u1', ask: true, tok: TOK }))), c = client(okNet(), st);
  c.resetPush();
  const s = F.read(st.m.raw);
  assert.equal(s.ask, false); assert.equal(s.tok, null); assert.equal(s.uid, 'u1', 'the ID stays');
});

// A push says the server changed. A sync already running may have been answered before that change, so a fresh sync runs once
// more after it (two fresh asks during one running sync share that one follow-up); a plain sync still shares the running one.
test('sync({ fresh: true }): while a sync runs, one more runs after it; without fresh the running one is shared', async () => {
  let n = 0;
  const net = fakeNet(async (url) => {
    if (url.startsWith('https://token.fc.test')) return { status: 200, body: { id_token: 'id-u1', refresh_token: 'rt-u1', expires_in: '3600', user_id: 'u1' } };
    n++; await new Promise((r) => setTimeout(r, 20)); return { status: 200, body: { result: { now: T, next: T, more: false, games: [] } } };
  });
  const c = client(net, signedIn());
  const a = c.sync(), b = c.sync(), f1 = c.sync({ fresh: true }), f2 = c.sync({ fresh: true });
  assert.equal(a, b, 'a plain sync shares the running one');
  assert.notEqual(f1, a, 'a fresh one does not');
  assert.equal(f1, f2, 'two fresh asks share one follow-up');
  await Promise.all([a, f1]);
  assert.equal(n, 2, 'the running sync, then one more');
  await c.sync({ fresh: true });
  assert.equal(n, 3, 'nothing running: a fresh sync is just a sync');
});
