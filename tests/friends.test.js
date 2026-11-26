// Unit tests for www/js/friends.js: friend challenges, slice FC3 (docs/specs/friend-challenges.product.md FC-D3, FC-D5, FC-D9,
// FC-D12, FC-D18, FC-D23, FC-D24 and the Wording section; tech spec sections 8 and 9).
// Run: node --test tests/friends.test.js   (after sh scripts/build.sh)
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../www/js/friends.js');

const DAY = 86400000, HOUR = 3600000;
const T = Date.UTC(2026, 10, 25, 6, 0, 0); // 25 Nov 2026, 11:30 IST
const GID = 'AbCdEfGhIjKlMnOpQrSt', GID2 = 'ZZZZZZZZZZZZZZZZZZZ1';
const CODE = '7K3M9QH2XA';
// A game as the server's view gives it (functions/src/ops.js view())
const view = (o) => Object.assign({ id: GID, me: 'w', opp: '0123456789ab', st: 'active', moves: [], dl: T + 3 * DAY, draw: null, res: null, v: 2, t: T, exp: null, code: null }, o);
const invite = (o) => view(Object.assign({ me: 'r', opp: null, st: 'invited', dl: null, v: 1, exp: T + 7 * DAY, code: CODE }, o));

test('FC-D24: the launch switch is off (FC6 turns it on, with Suresh’s yes)', () => {
  assert.equal(F.CONFIG.live, false);
  assert.ok(Object.isFrozen(F.CONFIG));
});

test('FC-D23: the approved wording, letter for letter', () => {
  const C = F.COPY;
  assert.equal(C.card, 'Friend games');
  assert.equal(C.challenge, 'Challenge a friend');
  assert.equal(C.full, 'You have 10 friend games open. Finish one to start another.');
  assert.equal(C.playAs, 'Play as');
  assert.deepEqual([C.white, C.black, C.random], ['White', 'Black', 'Random']);
  assert.equal(C.share, 'Share link');
  assert.equal(C.acceptTitle, 'A friend challenges you');
  assert.equal(C.nameLabel, 'Name your friend');
  assert.equal(C.accept, 'Accept');
  assert.equal(C.notNow, 'Not now');
  assert.equal(C.invalid, 'This challenge is no longer valid.');
  assert.equal(C.offline, 'Friend games need the internet. Try again when you are online.');
  assert.equal(C.cancel, 'Cancel invite');
  assert.equal(C.setting, 'Friend games (test)');
  assert.equal(C.friend, 'Friend');
  assert.equal(F.shareText(CODE), 'Play chess with me in Chess Coach: https://hnchennai.github.io/c/?c=' + CODE);
  assert.equal(F.youPlay('w'), 'You play White');
  assert.equal(F.youPlay('b'), 'You play Black');
});

test('No em dash or en dash in any user-facing text', () => {
  const all = Object.values(F.COPY).join('\n') + F.youPlay('r') + F.shareText(CODE);
  assert.ok(!/[–—]/.test(all), all);
});

test('link(code): the invite link (orchestrator decision: query, not path or fragment)', () => {
  assert.equal(F.link(CODE), 'https://hnchennai.github.io/c/?c=7K3M9QH2XA');
  assert.throws(() => F.link('bad'));
});

test('parseLink: accepts only https, the exact host, path /c/ and a 10-character Crockford base32 code', () => {
  assert.equal(F.parseLink('https://hnchennai.github.io/c/?c=' + CODE), CODE);
  assert.equal(F.parseLink(F.link(CODE)), CODE);
  assert.equal(F.parseLink('https://hnchennai.github.io/c/?c=' + CODE + '&utm=x'), CODE, 'other parameters are ignored');
  assert.equal(F.parseLink('https://hnchennai.github.io/c/?c=' + CODE + '#x'), CODE);
  assert.equal(F.parseLink('https://HNCHENNAI.github.io/c/?c=' + CODE), CODE, 'host names are case-insensitive');
  const bad = [
    null, undefined, 42, '', 'not a url',
    'http://hnchennai.github.io/c/?c=' + CODE, // not https
    'https://evil.example/c/?c=' + CODE,
    'https://hnchennai.github.io.evil.example/c/?c=' + CODE,
    'https://evil.hnchennai.github.io/c/?c=' + CODE,
    'https://user@hnchennai.github.io/c/?c=' + CODE,
    'https://hnchennai.github.io:8443/c/?c=' + CODE,
    'https://hnchennai.github.io/c?c=' + CODE, // path must be exactly /c/
    'https://hnchennai.github.io/c/x?c=' + CODE,
    'https://hnchennai.github.io/c/' + CODE, // the old path form
    'https://hnchennai.github.io/c/#' + CODE, // fragment form
    'https://hnchennai.github.io/c/?c=' + CODE.toLowerCase(), // codes are upper case
    'https://hnchennai.github.io/c/?c=7K3M9QH2X', // 9 characters
    'https://hnchennai.github.io/c/?c=7K3M9QH2XAB', // 11
    'https://hnchennai.github.io/c/?c=7K3M9QH2XI', // I is not Crockford
    'https://hnchennai.github.io/c/?c=7K3M9QH2XL',
    'https://hnchennai.github.io/c/?c=7K3M9QH2XO',
    'https://hnchennai.github.io/c/?c=7K3M9QH2XU',
    'https://hnchennai.github.io/c/?c=' + CODE + '&c=0000000000', // two codes: refuse
    'https://hnchennai.github.io/c/?code=' + CODE,
    'intent://hnchennai.github.io/c/?c=' + CODE + '#Intent;scheme=https;package=com.suresh.chesscoach;end',
    'x'.repeat(3000)
  ];
  bad.forEach((u) => assert.equal(F.parseLink(u), null, String(u).slice(0, 80)));
});

test('available(): native Android, and the launch switch or the test toggle', () => {
  assert.equal(F.available({ native: true, test: false }), false, 'switch off, toggle off');
  assert.equal(F.available({ native: true, test: true }), true, 'the test toggle');
  assert.equal(F.available({ native: false, test: true }), false, 'the web: never');
  assert.equal(F.available({ native: true, test: false, live: true }), true, 'the switch on (FC6)');
  assert.equal(F.available({ native: false, live: true }), false);
  assert.equal(F.available(null), false);
  assert.equal(F.available({ native: 'yes', test: 1 }), false, 'only real booleans count');
});

test('Store: blank shape, device only', () => {
  assert.equal(F.KEY, 'suresh-chess-coach.friends.v1');
  assert.deepEqual(F.blank(), { v: 1, uid: null, rt: null, tok: null, ask: false, since: 0, skew: 0, test: false, col: 'r', launch: null, links: [], friends: {}, games: {} }); /* FC5: ask */
});

test('Store migrate: missing, broken or foreign data reads as blank, field by field', () => {
  [null, undefined, '', 'not json', '[]', '42', '"x"', JSON.stringify({ v: 1, games: [] })].forEach((raw) => {
    const s = F.read(raw);
    assert.deepEqual(s.games, {}, String(raw));
    assert.equal(s.uid, null);
  });
  const s = F.read(JSON.stringify({ v: 1, uid: 12, rt: '', since: -5, skew: 'x', test: 'yes', links: 'x', games: null }));
  assert.deepEqual(s, F.blank());
  const ok = F.read(JSON.stringify({ v: 1, uid: 'u1', rt: 'r1', tok: null, since: 99, skew: -1200, test: true, links: [CODE, 'bad', 7], games: {} }));
  assert.equal(ok.uid, 'u1'); assert.equal(ok.rt, 'r1'); assert.equal(ok.since, 99); assert.equal(ok.skew, -1200); assert.equal(ok.test, true);
  assert.deepEqual(ok.links, [CODE], 'only real codes are kept');
  assert.equal(F.read(JSON.stringify(F.blank())).v, 1);
});

test('Store migrate: a good game is kept, a broken one is dropped, never thrown', () => {
  const good = view({ moves: ['e4'], me: 'b' });
  const raw = JSON.stringify({ v: 1, uid: 'u', games: {
    [GID]: good,
    [GID2]: { me: 'x' }, // broken
    short: view({ id: 'short' }),
    ['A'.repeat(20)]: 'nope'
  } });
  const s = F.read(raw);
  assert.deepEqual(Object.keys(s.games), [GID]);
  const g = s.games[GID];
  assert.equal(g.me, 'b'); assert.deepEqual(g.moves, ['e4']); assert.equal(g.st, 'active'); assert.equal(g.pend, null);
  // a pending move (FC4) is kept as it is when its shape is right
  const p = F.read(JSON.stringify({ v: 1, games: { [GID]: Object.assign({}, good, { pend: { ply: 1, from: 'e7', to: 'e5', t: T } }) } }));
  assert.deepEqual(p.games[GID].pend, { ply: 1, from: 'e7', to: 'e5', t: T });
  const q = F.read(JSON.stringify({ v: 1, games: { [GID]: Object.assign({}, good, { pend: 'x' }) } }));
  assert.equal(q.games[GID].pend, null);
});

test('apply(): answers overlap, the higher v wins per game, and the server clock sets the skew', () => {
  const s = F.blank();
  F.apply(s, [view({ v: 3, moves: ['e4'] })], T + 5000, T);
  assert.equal(s.games[GID].v, 3);
  assert.equal(s.skew, 5000, 'server now minus local now');
  F.apply(s, [view({ v: 2, moves: [] })], T, T);
  assert.deepEqual(s.games[GID].moves, ['e4'], 'an older view never replaces a newer one');
  F.apply(s, [view({ v: 4, moves: ['e4', 'e5'] })], T, T);
  assert.deepEqual(s.games[GID].moves, ['e4', 'e5']);
  F.apply(s, [{ id: 'bad' }, null, 7], T, T);
  assert.deepEqual(Object.keys(s.games), [GID], 'a broken view is ignored');
  F.apply(s, [], undefined, T);
  assert.equal(s.skew, 0, 'no server time: no skew');
});

test('openCount and canChallenge: FC-D12, at most 10 open (invited and active) games', () => {
  const s = F.blank();
  for (let i = 0; i < 9; i++) s.games['G'.repeat(19) + i] = view({ id: 'G'.repeat(19) + i, st: i % 2 ? 'active' : 'invited' });
  s.games['H'.repeat(20)] = view({ id: 'H'.repeat(20), st: 'over', res: { r: 'w', why: 'mate' } });
  assert.equal(F.openCount(s), 9);
  assert.equal(F.canChallenge(s), true);
  s.games['J'.repeat(20)] = view({ id: 'J'.repeat(20) });
  assert.equal(F.openCount(s), 10);
  assert.equal(F.canChallenge(s), false);
});

test('FC-D26 timeLeft: never overstates: whole days rounded down from 48 hours, then whole hours rounded down', () => {
  const MIN = 60000;
  assert.equal(F.timeLeft(3 * DAY), '3 days left');
  assert.equal(F.timeLeft(3 * DAY - 1), '2 days left', 'just after a move: 2 days, never 3');
  assert.equal(F.timeLeft(2 * DAY + 1), '2 days left');
  assert.equal(F.timeLeft(48 * HOUR), '2 days left');
  assert.equal(F.timeLeft(47 * HOUR + 59 * MIN), '47 hours left');
  assert.equal(F.timeLeft(25 * HOUR), '25 hours left');
  assert.equal(F.timeLeft(DAY), '24 hours left');
  assert.equal(F.timeLeft(5 * HOUR + 59 * MIN), '5 hours left');
  assert.equal(F.timeLeft(2 * HOUR - 1), '1 hour left');
  assert.equal(F.timeLeft(HOUR), '1 hour left');
  assert.equal(F.timeLeft(59 * MIN), 'under 1 hour left');
  assert.equal(F.timeLeft(1), 'under 1 hour left');
  assert.equal(F.timeLeft(0), 'no time left');
  assert.equal(F.timeLeft(-5), 'no time left');
});

test('dayMonth: "1 Dec" in local time', () => {
  assert.equal(F.dayMonth(new Date(2026, 11, 1, 23, 59).getTime()), '1 Dec');
  assert.equal(F.dayMonth(new Date(2027, 0, 9, 0, 1).getTime()), '9 Jan');
  assert.equal(F.dayMonth(new Date(2026, 4, 31, 12).getTime()), '31 May');
});

test('stateLine: the approved row lines', () => {
  const now = T; // local clock, no skew
  assert.equal(F.stateLine(view({ me: 'w', moves: [] }), now, 0), 'Your move, 3 days left');
  assert.equal(F.stateLine(view({ me: 'w', moves: [], dl: T + 3 * DAY - 60000 }), now, 0), 'Your move, 2 days left', 'a minute after the move');
  assert.equal(F.stateLine(view({ me: 'b', moves: [] }), now, 0), 'Their move');
  assert.equal(F.stateLine(view({ me: 'b', moves: ['e4'], dl: T + 2 * DAY }), now, 0), 'Your move, 2 days left');
  assert.equal(F.stateLine(view({ me: 'w', moves: ['e4'] }), now, 0), 'Their move');
  const exp = new Date(2026, 11, 1, 18, 0).getTime();
  assert.equal(F.stateLine(invite({ exp }), now, 0), 'Waiting for your friend, until 1 Dec');
  assert.equal(F.stateLine(view({ me: 'b', moves: ['e4'], pend: { ply: 1, from: 'e7', to: 'e5', t: T } }), now, 0), 'Not sent yet, 3 days left', 'FC-D35 (FC4 fix round 1): with the time left');
});

test('stateLine: time left counts from the server clock (skew), never from the phone alone', () => {
  // the phone is 1 day behind the server: the server's deadline is 2 days away in server time
  const g = view({ me: 'w', dl: T + 2 * DAY });
  assert.equal(F.stateLine(g, T - DAY, DAY), 'Your move, 2 days left');
  assert.equal(F.stateLine(g, T - DAY, 0), 'Your move, 3 days left', 'without the skew the phone would be wrong');
});

test('recordText: W · L · D from a res map', () => {
  assert.equal(F.recordText({ a: 'w', b: 'w', c: 'l', d: 'x' }), 'W 2 · L 1 · D 0');
  assert.equal(F.recordText({}), 'W 0 · L 0 · D 0');
  assert.equal(F.recordText(null), 'W 0 · L 0 · D 0');
  assert.equal(F.recordText({ a: 'd', b: 'd', c: 'l' }), 'W 0 · L 1 · D 2');
});

test('nick(): trimmed, control characters out, at most 20 characters', () => {
  assert.equal(F.nick('  Priya  '), 'Priya');
  assert.equal(F.nick('A'.repeat(25)), 'A'.repeat(20));
  assert.equal(F.nick('Ra\u0000vi\n'), 'Ravi');
  assert.equal(F.nick('😀'.repeat(25)), '😀'.repeat(20), 'an emoji is one character');
  assert.equal(F.nick(''), '');
  assert.equal(F.nick('   '), '');
  assert.equal(F.nick(null), '');
  assert.equal(F.nick(42), '');
});

test('rows(): open games only, my move first, then their move, then invites; names from the friend store (FC-D29)', () => {
  const s = F.blank();
  const A = 'A'.repeat(20), B = 'B'.repeat(20), C = 'C'.repeat(20), D = 'D'.repeat(20), E = 'E'.repeat(20);
  F.apply(s, [
    invite({ id: A, exp: new Date(2026, 11, 2, 9).getTime() }),
    view({ id: B, me: 'b', opp: 'aaaaaaaaaaaa', moves: [] }), // their move
    view({ id: C, me: 'w', opp: 'bbbbbbbbbbbb', moves: [], dl: T + DAY }), // my move, 1 day
    view({ id: D, me: 'w', opp: 'cccccccccccc', moves: [], dl: T + 3 * DAY }), // my move, 3 days
    view({ id: E, st: 'over', res: { r: 'w', why: 'mate' } })
  ], T, T);
  s.friends = { bbbbbbbbbbbb: { n: 'Priya', t: 1, res: { x: 'w', y: 'l' } }, aaaaaaaaaaaa: { n: '', t: 1, res: {} } };
  const r = F.rows(s, T);
  assert.deepEqual(r.map((x) => x.id), [C, D, B, A]);
  assert.deepEqual(r.map((x) => x.kind), ['mine', 'mine', 'theirs', 'invite']);
  assert.deepEqual(r.map((x) => x.name), ['Priya', 'Friend', 'Friend', 'Friend']);
  assert.equal(r[0].line, 'Your move, 24 hours left');
  assert.equal(r[0].record, 'W 1 · L 1 · D 0');
  assert.equal(r[3].line, 'Waiting for your friend, until 2 Dec');
  assert.equal(r[3].record, null, 'an invite has no friend yet, so no record');
  assert.equal(r[3].code, CODE);
});

test('errorText(): server codes to the approved lines', () => {
  ['expired', 'used', 'not-found', 'bad-link'].forEach((c) => assert.equal(F.errorText(c), F.COPY.invalid, c));
  assert.equal(F.errorText('full'), F.COPY.full);
  assert.equal(F.errorText('offline'), F.COPY.offline);
  assert.equal(F.errorText('own'), F.COPY.own);
  assert.equal(F.errorText('limit'), F.COPY.limit);
  assert.equal(F.errorText('internal'), F.COPY.error);
  assert.equal(F.errorText('anything else'), F.COPY.error);
});

test('remember(): handled launch links, at most 10, newest last', () => {
  const s = F.blank();
  for (let i = 0; i < 12; i++) F.remember(s, '00000000' + String(i).padStart(2, '0').replace(/1/g, '1'));
  assert.equal(s.links.length, 10);
  F.remember(s, CODE); F.remember(s, CODE);
  assert.equal(s.links.filter((c) => c === CODE).length, 1);
  assert.equal(s.links[s.links.length - 1], CODE);
});

test('FC-D29: nicknames and records live in the friend store: migrate keeps good entries, trims names, drops bad keys and results', () => {
  const raw = JSON.stringify({ v: 1, friends: {
    aaaaaaaaaaaa: { n: '  Priyadarshini Ramanathan  ', t: 5, res: { g1: 'w', g2: 'l', g3: 'd', g4: 'x' } },
    'AAAAAAAAAAAA': { n: 'upper', t: 1, res: {} },
    'short': { n: 'x', t: 1, res: {} },
    '__proto__': { n: 'x', t: 1, res: {} },
    bbbbbbbbbbbb: 'broken',
    cccccccccccc: { n: 42, t: 'x', res: 'x' }
  } });
  const s = F.read(raw);
  assert.deepEqual(Object.keys(s.friends).sort(), ['aaaaaaaaaaaa', 'cccccccccccc']);
  assert.equal(s.friends.aaaaaaaaaaaa.n, 'Priyadarshini Ramana');
  assert.deepEqual(s.friends.aaaaaaaaaaaa.res, { g1: 'w', g2: 'l', g3: 'd' });
  assert.deepEqual(s.friends.cccccccccccc, { n: '', t: 0, res: {} });
  [null, 'x', [], 7].forEach((f) => assert.deepEqual(F.read(JSON.stringify({ v: 1, friends: f })).friends, {}));
});

test('FC-D29 name(): sets a nickname for a friend key, keeps the record; an empty name changes nothing; a bad key is refused', () => {
  const s = F.blank();
  s.friends.aaaaaaaaaaaa = { n: 'Old', t: 1, res: { g1: 'w' } };
  assert.equal(F.name(s, 'aaaaaaaaaaaa', '  Priya  ', 50), true);
  assert.deepEqual(s.friends.aaaaaaaaaaaa, { n: 'Priya', t: 50, res: { g1: 'w' } });
  assert.equal(F.name(s, 'bbbbbbbbbbbb', '   ', 60), false);
  assert.equal(s.friends.bbbbbbbbbbbb, undefined);
  assert.equal(F.name(s, 'bbbbbbbbbbbb', 'Ravi', 60), true);
  assert.deepEqual(s.friends.bbbbbbbbbbbb, { n: 'Ravi', t: 60, res: {} });
  assert.equal(F.name(s, 'NOTAKEY', 'x', 1), false);
  assert.equal(F.name(s, '__proto__', 'x', 1), false);
});

test('FC-D27: the colour used last time is kept on the phone; Random the first time; anything else reads as Random', () => {
  assert.equal(F.blank().col, 'r');
  assert.equal(F.read(JSON.stringify({ v: 1, col: 'b' })).col, 'b');
  assert.equal(F.read(JSON.stringify({ v: 1, col: 'x' })).col, 'r');
});

test('Fix 2: the last launch link and when it was handled (replay guard on an activity recreate)', () => {
  const s = F.read(JSON.stringify({ v: 1, launch: { url: 'https://hnchennai.github.io/c/?c=' + CODE, t: T } }));
  assert.deepEqual(s.launch, { url: 'https://hnchennai.github.io/c/?c=' + CODE, t: T });
  assert.equal(F.replayed(s, 'https://hnchennai.github.io/c/?c=' + CODE, T + 119999), true, 'within 2 minutes');
  assert.equal(F.replayed(s, 'https://hnchennai.github.io/c/?c=' + CODE, T + 120001), false, 'after 2 minutes');
  assert.equal(F.replayed(s, 'https://hnchennai.github.io/c/?c=0000000000', T + 1), false, 'another link');
  assert.equal(F.read(JSON.stringify({ v: 1, launch: { url: 7, t: 'x' } })).launch, null);
});

test('Fix 8: a copy of the store without the refresh token, for tests and debugging', () => {
  const s = Object.assign(F.blank(), { uid: 'u1', rt: 'secret' });
  const c = F.safeCopy(s);
  assert.equal(c.rt, undefined); assert.equal(c.uid, 'u1');
  assert.equal(s.rt, 'secret', 'the store itself is unchanged');
});
