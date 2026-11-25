// Unit tests for www/js/fclient.js: the friend server client (slice FC3, friend-challenges.tech.md section 3): Anonymous
// Auth over REST (signUp, refresh with the stored refresh token), the callable protocol over fetch, sync with the server's
// next, and the offline and error paths. fetch is a fake: nothing here reaches any network.
// Run: node --test tests/fclient.test.js   (after sh scripts/build.sh)
const test = require('node:test');
const assert = require('node:assert/strict');
const FC = require('../www/js/fclient.js');
const F = require('../www/js/friends.js');

const CFG = { projectId: 'demo-test', apiKey: 'test-key', authBase: 'https://auth.fc.test', tokenBase: 'https://token.fc.test', fnBase: 'https://fn.fc.test' };
const T = Date.UTC(2026, 10, 25, 6, 0, 0);
const GID = 'AbCdEfGhIjKlMnOpQrSt';
const gview = (o) => Object.assign({ id: GID, me: 'w', opp: null, st: 'invited', moves: [], dl: null, draw: null, res: null, v: 1, t: T, exp: T + 7 * 86400000, code: '7K3M9QH2XA' }, o);

// A fake fetch: handlers by URL prefix; every call is recorded.
function fakeNet(handlers) {
  const calls = [];
  const fetch = async (url, init) => {
    const c = { url, method: init && init.method, headers: (init && init.headers) || {}, body: init && init.body };
    calls.push(c);
    for (const [prefix, h] of handlers) {
      if (url.startsWith(prefix)) {
        const r = await h(c);
        if (r instanceof Error) throw r;
        return { ok: r.status === 200, status: r.status, json: async () => { if (r.raw) throw new SyntaxError('bad json'); return r.body; } };
      }
    }
    throw new TypeError('Failed to fetch');
  };
  return { fetch, calls };
}
const signUpOk = (uid) => async () => ({ status: 200, body: { idToken: 'id-' + uid, refreshToken: 'rt-' + uid, expiresIn: '3600', localId: uid } });
const refreshOk = (uid) => async () => ({ status: 200, body: { id_token: 'id2-' + uid, refresh_token: 'rt2-' + uid, expires_in: '3600', user_id: uid } });
function memStorage(raw) { const m = { raw: raw === undefined ? null : raw }; return { get: () => m.raw, set: (v) => { m.raw = v; }, m }; }
function client(net, storage, cfg, clock) {
  const c = clock || { t: T };
  return FC.make({ config: Object.assign({}, CFG, cfg || {}), fetch: net.fetch, storage: storage || memStorage(), now: () => c.t, timeoutMs: 1000 });
}
const fnUrl = 'https://fn.fc.test/friend';

test('No network at all until an op is asked for: making the client and sync with no ID call nothing', async () => {
  const net = fakeNet([]);
  const c = client(net);
  assert.equal(c.signedIn(), false);
  assert.equal(await c.sync(), null, 'sync without an ID is a no-op');
  assert.equal(net.calls.length, 0);
});

test('The first op signs up anonymously (REST signUp), keeps the ID and refresh token, then calls the callable', async () => {
  const net = fakeNet([
    ['https://auth.fc.test/v1/accounts:signUp?key=test-key', signUpOk('u1')],
    [fnUrl, async (c) => ({ status: 200, body: { result: { now: T + 1000, code: '7K3M9QH2XA', games: [gview()] } } })]
  ]);
  const st = memStorage();
  const c = client(net, st);
  const r = await c.op('invite', { col: 'w' });
  assert.equal(r.code, '7K3M9QH2XA');
  assert.equal(net.calls.length, 2);
  const [su, call] = net.calls;
  assert.equal(su.method, 'POST');
  assert.equal(su.headers['Content-Type'], 'application/json');
  assert.deepEqual(JSON.parse(su.body), { returnSecureToken: true });
  assert.equal(call.method, 'POST');
  assert.deepEqual(call.headers, { 'Content-Type': 'application/json', Authorization: 'Bearer id-u1' }, 'only the headers the callable protocol allows');
  assert.deepEqual(JSON.parse(call.body), { data: { op: 'invite', col: 'w' } });
  const saved = F.read(st.m.raw);
  assert.equal(saved.uid, 'u1'); assert.equal(saved.rt, 'rt-u1');
  assert.ok(saved.games[GID], 'the answer’s game is in the store');
  assert.equal(saved.skew, 1000, 'server clock minus phone clock');
  assert.equal(c.signedIn(), true);
});

test('Two ops at once sign up only once', async () => {
  let n = 0;
  const net = fakeNet([
    ['https://auth.fc.test/v1/accounts:signUp', async () => { n++; await new Promise((r) => setTimeout(r, 10)); return signUpOk('u1')(); }],
    [fnUrl, async () => ({ status: 200, body: { result: { now: T, games: [] } } })]
  ]);
  const c = client(net);
  await Promise.all([c.op('hello', {}), c.op('hello', {})]);
  assert.equal(n, 1);
});

test('A later app start refreshes the ID token with the stored refresh token (form encoded), never signs up again', async () => {
  const net = fakeNet([
    ['https://token.fc.test/v1/token?key=test-key', refreshOk('u1')],
    [fnUrl, async () => ({ status: 200, body: { result: { now: T, games: [] } } })]
  ]);
  const st = memStorage(JSON.stringify(Object.assign(F.blank(), { uid: 'u1', rt: 'rt-u1' })));
  const c = client(net, st);
  await c.op('hello', {});
  assert.equal(net.calls.length, 2);
  assert.equal(net.calls[0].headers['Content-Type'], 'application/x-www-form-urlencoded');
  assert.equal(net.calls[0].body, 'grant_type=refresh_token&refresh_token=rt-u1');
  assert.equal(net.calls[1].headers.Authorization, 'Bearer id2-u1');
  assert.equal(F.read(st.m.raw).rt, 'rt2-u1', 'a new refresh token is kept');
});

test('The ID token is reused until it is about to expire', async () => {
  const clock = { t: T };
  const net = fakeNet([
    ['https://auth.fc.test/v1/accounts:signUp', signUpOk('u1')],
    ['https://token.fc.test/v1/token', refreshOk('u1')],
    [fnUrl, async () => ({ status: 200, body: { result: { now: clock.t, games: [] } } })]
  ]);
  const c = client(net, memStorage(), null, clock);
  await c.op('hello', {}); await c.op('hello', {});
  assert.deepEqual(net.calls.map((x) => x.url.split('?')[0]), ['https://auth.fc.test/v1/accounts:signUp', fnUrl, fnUrl]);
  clock.t += 3600000 - 30000; // within the last minute of the hour
  await c.op('hello', {});
  assert.equal(net.calls[3].url.split('?')[0], 'https://token.fc.test/v1/token');
});

test('UNAUTHENTICATED from the callable: refresh once and try again', async () => {
  let first = true;
  const net = fakeNet([
    ['https://token.fc.test/v1/token', refreshOk('u1')],
    [fnUrl, async () => { if (first) { first = false; return { status: 401, body: { error: { status: 'UNAUTHENTICATED', message: 'auth' } } }; } return { status: 200, body: { result: { now: T, games: [] } } }; }]
  ]);
  const c = client(net, memStorage(JSON.stringify(Object.assign(F.blank(), { uid: 'u1', rt: 'rt-u1' }))));
  await c.op('hello', {});
  assert.deepEqual(net.calls.map((x) => x.url.split('?')[0]), ['https://token.fc.test/v1/token', fnUrl, 'https://token.fc.test/v1/token', fnUrl]);
});

test('Callable errors come back as the server’s message code; their games still go into the store', async () => {
  const net = fakeNet([
    ['https://auth.fc.test/v1/accounts:signUp', signUpOk('u1')],
    [fnUrl, async () => ({ status: 400, body: { error: { status: 'FAILED_PRECONDITION', message: 'used', details: { games: [gview({ v: 5 })] } } } })]
  ]);
  const st = memStorage();
  const c = client(net, st);
  await assert.rejects(c.op('peek', { code: '7K3M9QH2XA' }), (e) => e.code === 'used' && e.status === 'failed-precondition');
  assert.equal(F.read(st.m.raw).games[GID].v, 5);
  const net2 = fakeNet([
    ['https://auth.fc.test/v1/accounts:signUp', signUpOk('u1')],
    [fnUrl, async () => ({ status: 404, body: { error: { status: 'NOT_FOUND', message: 'not-found' } } })]
  ]);
  await assert.rejects(client(net2).op('peek', { code: '7K3M9QH2XA' }), (e) => e.code === 'not-found');
  const net3 = fakeNet([
    ['https://auth.fc.test/v1/accounts:signUp', signUpOk('u1')],
    [fnUrl, async () => ({ status: 500, body: { error: { status: 'INTERNAL', message: 'internal' } } })]
  ]);
  await assert.rejects(client(net3).op('hello', {}), (e) => e.code === 'internal');
  const net4 = fakeNet([
    ['https://auth.fc.test/v1/accounts:signUp', signUpOk('u1')],
    [fnUrl, async () => ({ status: 502, raw: true })]
  ]);
  await assert.rejects(client(net4).op('hello', {}), (e) => e.code === 'error', 'an answer that is not JSON');
});

test('Offline: a fetch that fails, or a timeout, is "offline", and nothing is stored', async () => {
  const st = memStorage();
  await assert.rejects(client(fakeNet([]), st).op('invite', { col: 'w' }), (e) => e.code === 'offline');
  assert.equal(F.read(st.m.raw).uid, null);
  const slow = fakeNet([['https://auth.fc.test', () => new Promise(() => {})]]);
  const c = FC.make({ config: CFG, fetch: slow.fetch, storage: memStorage(), now: () => T, timeoutMs: 30 });
  await assert.rejects(c.op('invite', { col: 'w' }), (e) => e.code === 'offline');
});

test('Placeholder config (no real Firebase project yet, FC-D24): refuses before any network call', async () => {
  const net = fakeNet([]);
  for (const cfg of [{ apiKey: 'PLACEHOLDER_API_KEY' }, { projectId: 'PLACEHOLDER-project' }, { fnBase: '' }]) {
    await assert.rejects(client(net, memStorage(), cfg).op('invite', { col: 'w' }), (e) => e.code === 'config');
  }
  assert.equal(net.calls.length, 0);
  assert.equal(FC.configured(Object.assign({}, CFG, { apiKey: 'PLACEHOLDER_API_KEY' })), false);
  assert.equal(FC.configured(CFG), true);
});

test('A dead refresh token (the Auth user is gone): a user action signs up again with a clean store; a sync does not', async () => {
  const dead = async () => ({ status: 400, body: { error: { code: 400, message: 'USER_NOT_FOUND' } } });
  const old = Object.assign(F.blank(), { uid: 'u1', rt: 'rt-u1', since: 50, games: { [GID]: gview() } });
  const net = fakeNet([['https://token.fc.test/v1/token', dead]]);
  const st1 = memStorage(JSON.stringify(old));
  assert.equal(await client(net, st1).sync(), null);
  const s1 = F.read(st1.m.raw);
  assert.equal(s1.uid, null); assert.deepEqual(s1.games, {}); assert.equal(s1.since, 0);
  assert.ok(!net.calls.some((c) => c.url.includes('signUp')), 'a sync never creates an ID');
  const net2 = fakeNet([['https://token.fc.test/v1/token', dead], ['https://auth.fc.test/v1/accounts:signUp', signUpOk('u2')], [fnUrl, async () => ({ status: 200, body: { result: { now: T, games: [] } } })]]);
  const st2 = memStorage(JSON.stringify(old));
  await client(net2, st2).op('hello', {});
  assert.equal(F.read(st2.m.raw).uid, 'u2');
  // any other 400 (a bad API key, say) never throws the ID away
  const net3 = fakeNet([['https://token.fc.test/v1/token', async () => ({ status: 400, body: { error: { code: 400, message: 'API key not valid. Please pass a valid API key.' } } })]]);
  const st3 = memStorage(JSON.stringify(old));
  await assert.rejects(client(net3, st3).op('hello', {}), (e) => e.code === 'error');
  assert.equal(F.read(st3.m.raw).uid, 'u1');
});

test('sync: sends the stored since, keeps the server’s next, follows more, and keeps the higher v', async () => {
  const seen = [];
  const pages = [
    { now: T, next: T - 10, more: true, games: [gview({ v: 3, st: 'active', opp: '0123456789ab', dl: T + 1 })] },
    { now: T, next: T - 120000, more: false, games: [gview({ v: 2 })] }
  ];
  const net = fakeNet([
    ['https://token.fc.test/v1/token', refreshOk('u1')],
    [fnUrl, async (c) => { const d = JSON.parse(c.body).data; seen.push(d); return { status: 200, body: { result: pages.shift() } }; }]
  ]);
  const st = memStorage(JSON.stringify(Object.assign(F.blank(), { uid: 'u1', rt: 'rt-u1', since: 77 })));
  const c = client(net, st);
  await c.sync();
  assert.deepEqual(seen, [{ op: 'sync', since: 77 }, { op: 'sync', since: T - 10 }], 'only ever the server’s next');
  const s = F.read(st.m.raw);
  assert.equal(s.since, T - 120000);
  assert.equal(s.games[GID].v, 3, 'the older view on the later page does not win');
});

test('sync: one at a time (a second call while one runs gets the same promise)', async () => {
  let n = 0;
  const net = fakeNet([
    ['https://token.fc.test/v1/token', refreshOk('u1')],
    [fnUrl, async () => { n++; await new Promise((r) => setTimeout(r, 10)); return { status: 200, body: { result: { now: T, next: T, more: false, games: [] } } }; }]
  ]);
  const c = client(net, memStorage(JSON.stringify(Object.assign(F.blank(), { uid: 'u1', rt: 'rt-u1' }))));
  const a = c.sync(), b = c.sync();
  assert.equal(a, b);
  await a;
  assert.equal(n, 1);
});

test('setTest: the test toggle is kept in the device store', () => {
  const st = memStorage();
  const c = client(fakeNet([]), st);
  c.setTest(true);
  assert.equal(F.read(st.m.raw).test, true);
  assert.equal(c.store().test, true);
});

test('FC-D27, FC-D29, fix 2: the colour, a nickname and the launch link are saved in the device store; a dead ID keeps the names', async () => {
  const st = memStorage(JSON.stringify(Object.assign(F.blank(), { uid: 'u1', rt: 'rt-u1', games: { [GID]: gview() } })));
  const c = client(fakeNet([['https://token.fc.test/v1/token', async () => ({ status: 400, body: { error: { message: 'USER_NOT_FOUND' } } })]]), st);
  c.setCol('b');
  assert.equal(c.name('aaaaaaaaaaaa', ' Priya ', T), true);
  c.setLaunch('https://hnchennai.github.io/c/?c=7K3M9QH2XA', T);
  let s = F.read(st.m.raw);
  assert.equal(s.col, 'b'); assert.equal(s.friends.aaaaaaaaaaaa.n, 'Priya'); assert.equal(s.launch.t, T);
  await c.sync();
  s = F.read(st.m.raw);
  assert.equal(s.uid, null, 'the dead ID is gone');
  assert.equal(s.friends.aaaaaaaaaaaa.n, 'Priya', 'the names and records stay on the phone');
});

// FC4 (tech spec section 9, offline queue): a move is saved as pend before any call; the answer settles it.
test('FC4: queue() saves the pending move at once; a late answer ends the game on time and drops it; offline keeps it', async () => {
  const active = (o) => gview(Object.assign({ st: 'active', opp: '0123456789ab', code: null, exp: null, dl: T + 3 * 86400000, v: 2 }, o));
  let answer = null;
  const net = fakeNet([
    ['https://token.fc.test/v1/token?key=test-key', refreshOk('u1')],
    [fnUrl, async () => answer]
  ]);
  const st = memStorage(JSON.stringify({ v: 1, uid: 'u1', rt: 'rt-u1', games: { [GID]: active() } }));
  const c = client(net, st);
  assert.equal(c.queue(GID, { from: 'e2', to: 'e4' }, T), true);
  assert.equal(net.calls.length, 0, 'no call yet');
  assert.deepEqual(JSON.parse(st.m.raw).games[GID].pend, { ply: 0, from: 'e2', to: 'e4', t: T }, 'saved before any call');
  answer = new TypeError('Failed to fetch');
  const e1 = await c.op('move', F.moveReq(c.store().games[GID])).catch((e) => e);
  assert.equal(e1.code, 'offline');
  assert.equal(c.settleSend(GID, e1), 'keep');
  assert.ok(JSON.parse(st.m.raw).games[GID].pend, 'still waiting');
  answer = { status: 400, body: { error: { status: 'FAILED_PRECONDITION', message: 'late', details: { games: [active({ st: 'over', dl: null, res: { r: 'b', why: 'time' }, v: 3 })] } } } };
  const e2 = await c.op('move', F.moveReq(c.store().games[GID])).catch((e) => e);
  assert.equal(e2.code, 'late');
  assert.equal(c.settleSend(GID, e2), 'done');
  const saved = JSON.parse(st.m.raw).games[GID];
  assert.deepEqual([saved.st, saved.res.why, saved.pend], ['over', 'time', null]);
  assert.equal(c.record(GID), true, 'the record per friend');
  assert.deepEqual(JSON.parse(st.m.raw).friends['0123456789ab'].res, { [GID]: 'l' });
  c.offered(GID);
  assert.equal(JSON.parse(st.m.raw).games[GID].dp, 0);
});
