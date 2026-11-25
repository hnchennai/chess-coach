// Unit tests for slice FC4 of friend challenges: the friend board's pure rules in www/js/friends.js (the send queue, the
// record per friend, the history entry, the end card lines, draw offers, naming from the row) and the profile's handling of
// friend games in prof.games (docs/specs/friend-challenges.product.md FC-D6, FC-D8, FC-D10, FC-D11, FC-D13, FC-D21, FC-D22,
// FC-D28, FC-D29, scenarios 5, 7, 8; tech spec sections 6 and 9).
// Run: node --test tests/fc4.test.js   (after sh scripts/build.sh)
const test = require('node:test');
const assert = require('node:assert/strict');
const F = require('../www/js/friends.js');
const P = require('../www/js/profile.js');

const DAY = 86400000;
const T = Date.UTC(2026, 10, 25, 6, 0, 0);
const GID = 'AbCdEfGhIjKlMnOpQrSt', GID2 = 'ZZZZZZZZZZZZZZZZZZZ1';
const OPP = '0123456789ab';
const view = (o) => Object.assign({ id: GID, me: 'w', opp: OPP, st: 'active', moves: [], dl: T + 3 * DAY, draw: null, res: null, v: 2, t: T, exp: null, code: null }, o);
const store = (games, friends) => { const s = F.blank(); (games || []).forEach((g) => { s.games[g.id] = F.read({ games: { [g.id]: g } }).games[g.id]; }); s.friends = friends || {}; return s; };
const over = (o, res) => view(Object.assign({ st: 'over', dl: null, res, v: 9 }, o));

test('queue: a legal-looking move on my turn becomes the one pending move, saved before any call', () => {
  const s = store([view()]);
  assert.equal(F.queue(s, GID, { from: 'e2', to: 'e4' }, T + 5), true);
  assert.deepEqual(s.games[GID].pend, { ply: 0, from: 'e2', to: 'e4', t: T + 5 });
  assert.equal(F.queue(s, GID, { from: 'd2', to: 'd4' }, T + 6), false, 'only one pending move per game');
  assert.deepEqual(s.games[GID].pend, { ply: 0, from: 'e2', to: 'e4', t: T + 5 });
  assert.equal(F.read(JSON.stringify(s)).games[GID].pend.to, 'e4', 'it survives a restart');
  const s2 = store([view({ moves: ['e4'] })]);
  assert.equal(F.queue(s2, GID, { from: 'e7', to: 'e5' }, T), false, 'not my turn');
  const s3 = store([view({ me: 'b', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4'] })]);
  assert.equal(F.queue(s3, GID, { from: 'b7', to: 'b8', promo: 'n' }, T), true);
  assert.equal(s3.games[GID].pend.promo, 'n');
  assert.equal(F.queue(store([over({}, { r: 'w', why: 'resign' })]), GID, { from: 'e2', to: 'e4' }, T), false, 'a finished game');
  assert.equal(F.queue(store([view({ st: 'invited', me: 'r', opp: null })]), GID, { from: 'e2', to: 'e4' }, T), false, 'an invite');
  assert.equal(F.queue(store([view()]), GID, { from: 'e2', to: 'x9' }, T), false, 'a bad square');
  assert.equal(F.queue(store([view()]), 'nope', { from: 'e2', to: 'e4' }, T), false, 'no such game');
});

test('sendable and moveReq: what goes to the server (move with ply), and only while it still fits the game', () => {
  const s = store([view()]);
  F.queue(s, GID, { from: 'e2', to: 'e4' }, T);
  assert.equal(F.sendable(s.games[GID]), true);
  assert.deepEqual(F.moveReq(s.games[GID]), { g: GID, ply: 0, from: 'e2', to: 'e4' });
  const p = store([view({ me: 'b', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4'] })]);
  F.queue(p, GID, { from: 'b7', to: 'b8', promo: 'q' }, T);
  assert.deepEqual(F.moveReq(p.games[GID]), { g: GID, ply: 7, from: 'b7', to: 'b8', promo: 'q' });
  assert.deepEqual(F.toSend(s), [GID]);
  assert.equal(F.sendable(view()), false, 'nothing pending');
  assert.deepEqual(F.toSend(store([view()])), []);
});

test('apply: the server answer replaces the local game (higher v wins); pend stays only while the move is not in yet', () => {
  const s = store([view({ v: 2 })]);
  F.queue(s, GID, { from: 'e2', to: 'e4' }, T);
  F.apply(s, [view({ v: 3, draw: 'b' })], T, T); // the friend offered a draw meanwhile: my move is still not in
  assert.equal(s.games[GID].pend.to, 'e4', 'kept');
  assert.equal(s.games[GID].draw, 'b');
  F.apply(s, [view({ v: 4, moves: ['e4'] })], T, T); // the move arrived (a resend that was already applied, or the answer)
  assert.equal(s.games[GID].pend, null, 'dropped');
  const s2 = store([view({ v: 2 })]);
  F.queue(s2, GID, { from: 'e2', to: 'e4' }, T);
  F.apply(s2, [over({ v: 3 }, { r: 'b', why: 'time' })], T, T);
  assert.equal(s2.games[GID].pend, null, 'a finished game has nothing to send');
  const s3 = store([view({ v: 5 })]);
  F.queue(s3, GID, { from: 'e2', to: 'e4' }, T);
  F.apply(s3, [view({ v: 4 })], T, T);
  assert.equal(s3.games[GID].v, 5, 'an older answer changes nothing');
  assert.equal(s3.games[GID].pend.to, 'e4');
});

test('settleSend: what each answer to a move does (ok, offline, late, over, turn, illegal, not-found)', () => {
  const mk = () => { const s = store([view()]); F.queue(s, GID, { from: 'e2', to: 'e4' }, T); return s; };
  let s = mk();
  assert.equal(F.settleSend(s, GID, null), 'done');
  s = mk();
  assert.equal(F.settleSend(s, GID, { code: 'offline' }), 'keep'); assert.ok(s.games[GID].pend, 'offline keeps it for the next try');
  s = mk();
  assert.equal(F.settleSend(s, GID, { code: 'error', status: 'internal' }), 'keep'); assert.ok(s.games[GID].pend);
  s = mk();
  assert.equal(F.settleSend(s, GID, { code: 'error', status: 'unauthenticated' }), 'keep');
  s = mk();
  assert.equal(F.settleSend(s, GID, { code: 'late', status: 'failed-precondition' }), 'done'); assert.equal(s.games[GID].pend, null, 'late: the game shows lost on time');
  for (const code of ['over', 'turn', 'illegal']) {
    s = mk();
    assert.equal(F.settleSend(s, GID, { code, status: 'failed-precondition' }), 'sync', code); assert.equal(s.games[GID].pend, null, code + ': dropped');
  }
  s = mk();
  assert.equal(F.settleSend(s, GID, { code: 'not-found', status: 'not-found' }), 'sync'); assert.equal(s.games[GID].pend, null);
  s = mk();
  assert.equal(F.settleSend(s, GID, { code: 'bad ply', status: 'invalid-argument' }), 'sync'); assert.equal(s.games[GID].pend, null);
  assert.equal(F.settleSend(store([]), GID, null), 'done', 'a game that is gone');
});

test('outcome and endCopy: every ending from my side, in plain words (no em dashes)', () => {
  const cases = [
    [{ r: 'w', why: 'mate' }, 'W', 'Checkmate. You win!', 'Great finish. Review it.'],
    [{ r: 'b', why: 'mate' }, 'L', 'Checkmate', 'Your friend wins this one. Review it to find the turning point.'],
    [{ r: 'w', why: 'resign' }, 'W', 'You win!', 'Your friend resigned.'],
    [{ r: 'b', why: 'resign' }, 'L', 'You resigned', 'Your friend wins this one. Review it to find the turning point.'],
    [{ r: 'w', why: 'time' }, 'W', 'You win!', 'Your friend ran out of time.'],
    [{ r: 'b', why: 'time' }, 'L', 'Out of time', 'Your friend wins this one. Review it to find the turning point.'],
    [{ r: 'w', why: 'abandoned' }, 'W', 'You win!', 'Your friend left the game.'],
    [{ r: 'd', why: 'agreed' }, 'D', 'Draw', 'You both agreed to a draw.'],
    [{ r: 'd', why: 'stalemate' }, 'D', 'Stalemate', 'No legal moves and no check, so it’s a draw.'],
    [{ r: 'd', why: 'repetition' }, 'D', 'Draw', 'The same position came up three times.'],
    [{ r: 'd', why: 'fifty' }, 'D', 'Draw', '50 moves without a capture or pawn move.'],
    [{ r: 'd', why: 'material' }, 'D', 'Draw', 'Not enough pieces left to checkmate.'],
    [{ r: 'd', why: 'cap' }, 'D', 'Draw', 'The game reached the move limit.']
  ];
  for (const [res, r, title, text] of cases) {
    const g = over({}, res);
    assert.deepEqual(F.outcome(g), { r, why: res.why }, res.why);
    assert.deepEqual(F.endCopy(g), { title, text }, res.why);
    assert.ok(!/—/.test(title + text), 'no em dash');
  }
  assert.deepEqual(F.outcome(over({ me: 'b' }, { r: 'b', why: 'resign' })), { r: 'W', why: 'resign' }, 'as Black');
  assert.equal(F.outcome(view()), null, 'still going');
  assert.equal(F.outcome(over({ me: 'r', opp: null }, { r: null, why: 'expired' })), null, 'a cancelled or expired invite is no result');
  assert.equal(F.endCopy(view()), null);
});

test('FC-D29: the record per friend is counted once per game, on this phone, and never for r: null', () => {
  const s = store([over({}, { r: 'w', why: 'mate' }), over({ id: GID2, v: 4 }, { r: 'd', why: 'agreed' })], { [OPP]: { n: 'Priya', t: T, res: {} } });
  assert.equal(F.recorded(s, s.games[GID]), false);
  assert.equal(F.record(s, GID), true);
  assert.equal(F.record(s, GID), false, 'seen again in a later sync: not counted twice');
  assert.equal(F.record(s, GID2), true);
  assert.deepEqual(s.friends[OPP], { n: 'Priya', t: T, res: { [GID]: 'w', [GID2]: 'd' } });
  assert.equal(F.recordText(s.friends[OPP].res), 'W 1 · L 0 · D 1');
  assert.equal(F.recorded(s, s.games[GID]), true);
  const s2 = store([over({ opp: 'abcdefabcdef' }, { r: 'b', why: 'time' })]);
  assert.equal(F.record(s2, GID), true, 'a friend with no nickname gets an entry for the record');
  assert.deepEqual(s2.friends.abcdefabcdef, { n: '', t: 0, res: { [GID]: 'l' } });
  assert.equal(F.read(JSON.stringify(s2)).friends.abcdefabcdef.res[GID], 'l', 'it survives a restart');
  const s3 = store([over({ me: 'r', opp: null, st: 'over' }, { r: null, why: 'expired' }), view({ id: GID2 })]);
  assert.equal(F.record(s3, GID), false, 'a cancelled invite');
  assert.equal(F.record(s3, GID2), false, 'an open game');
  assert.deepEqual(s3.friends, {});
  assert.deepEqual(F.toRecord(s), [], 'nothing left to record');
  assert.deepEqual(F.toRecord(store([over({}, { r: 'w', why: 'mate' })])), [GID]);
});

test('Tech spec 9: the history entry for prof.games: f-<id>, unrated (level null), the friend key, empty tags and notes', () => {
  const g = over({ me: 'b', moves: ['f3', 'e5', 'g4', 'Qh4#'], t: T + 1000 }, { r: 'b', why: 'mate' });
  assert.deepEqual(F.entry(g), { id: 'f-' + GID, d: T + 1000, r: 'W', user: 'b', level: null, fr: OPP, ann: {}, tags: {}, sans: ['f3', 'e5', 'g4', 'Qh4#'] });
  assert.equal(F.entry(over({ me: 'r', opp: null }, { r: null, why: 'expired' })), null, 'never for r: null');
  assert.equal(F.entry(view()), null, 'never for an open game');
});

test('History row and board title: the nickname stays on this phone', () => {
  const s = store([], { [OPP]: { n: 'Priya', t: T, res: {} }, abcdefabcdef: { n: '', t: 0, res: {} } });
  assert.equal(F.histName(s, OPP), 'vs Priya (friend)');
  assert.equal(F.histName(s, 'abcdefabcdef'), 'vs a friend');
  assert.equal(F.histName(s, 'ffffffffffff'), 'vs a friend');
  assert.equal(F.histName(null, OPP), 'vs a friend', 'the web version has no friend store');
  assert.equal(F.boardTitle(s, view()), 'Friend game vs Priya');
  assert.equal(F.boardTitle(s, view({ opp: 'abcdefabcdef' })), 'Friend game');
  assert.equal(F.oppName(s, view()), 'Priya');
  assert.equal(F.oppName(s, view({ opp: 'abcdefabcdef' })), 'Friend');
});

test('boardLine: whose move and time left (FC-D26), Not sent yet, then the result', () => {
  const s = store([view()]);
  assert.equal(F.boardLine(s.games[GID], T, 0), 'Your move, 3 days left');
  assert.equal(F.boardLine(s.games[GID], T + 2 * DAY, 0), 'Your move, 24 hours left', 'the clock never stops (FC-D6)');
  F.queue(s, GID, { from: 'e2', to: 'e4' }, T);
  assert.equal(F.boardLine(s.games[GID], T, 0), 'Not sent yet');
  assert.equal(F.boardLine(view({ moves: ['e4'] }), T, 0), 'Their move');
  assert.equal(F.boardLine(over({}, { r: 'b', why: 'time' }), T, 0), 'Out of time');
});

test('FC-D11: draw offers: one per own move (as the server), the lines for an offer made and received', () => {
  const s = store([view({ moves: ['e4', 'e5'] })]);
  const g = () => s.games[GID];
  assert.equal(F.canOffer(g()), true);
  F.offered(s, GID);
  assert.equal(g().dp, 2);
  F.apply(s, [view({ moves: ['e4', 'e5'], draw: 'w', v: 3 })], T, T);
  assert.equal(g().dp, 2, 'kept across server answers');
  assert.equal(F.canOffer(g()), false, 'an offer is open');
  assert.equal(F.drawLine(g()), 'You offered a draw.');
  F.apply(s, [view({ moves: ['e4', 'e5'], draw: null, v: 4 })], T, T); // declined
  assert.equal(F.canOffer(g()), false, 'not again before my next move');
  F.apply(s, [view({ moves: ['e4', 'e5', 'Nf3', 'Nc6'], v: 6 })], T, T);
  assert.equal(F.canOffer(g()), true, 'after my next move');
  assert.equal(F.read(JSON.stringify(s)).games[GID].dp, 2, 'dp survives a restart');
  const b = view({ me: 'b', moves: ['e4'], draw: 'w' });
  assert.equal(F.drawLine(b), 'Your friend offers a draw.');
  assert.equal(F.canOffer(b), false, 'an offer is open');
  assert.equal(F.drawLine(view()), null);
  assert.equal(F.canOffer(over({}, { r: 'w', why: 'mate' })), false);
  assert.equal(F.offerFrom(b), 'friend'); assert.equal(F.offerFrom(view({ draw: 'w' })), 'me'); assert.equal(F.offerFrom(view()), null);
});

test('FC-D28: Name your friend shows once the friend has accepted and has no nickname here; the rows say so', () => {
  const s = store([view(), view({ id: GID2, opp: 'abcdefabcdef', moves: ['e4'] }), view({ id: 'YYYYYYYYYYYYYYYYYYY1', me: 'r', opp: null, st: 'invited', dl: null, exp: T + 7 * DAY, code: '7K3M9QH2XA' })], { abcdefabcdef: { n: 'Ravi', t: T, res: {} } });
  assert.equal(F.needsName(s, s.games[GID]), true);
  assert.equal(F.needsName(s, s.games[GID2]), false, 'named');
  assert.equal(F.needsName(s, s.games.YYYYYYYYYYYYYYYYYYY1), false, 'an invite has no friend yet');
  const rows = F.rows(s, T);
  assert.deepEqual(rows.map((r) => [r.kind, r.name, !!r.needsName]), [['mine', 'Friend', true], ['theirs', 'Ravi', false], ['invite', 'Friend', false]]);
  F.name(s, OPP, '  Priya  ', T);
  assert.equal(F.needsName(s, s.games[GID]), false);
  assert.equal(F.rows(s, T)[0].name, 'Priya');
});

test('FC4 wording: the new lines are short, plain and have no em dashes', () => {
  const C = F.COPY;
  for (const k of ['board', 'resign', 'resignAsk', 'keep', 'offerDraw', 'decline', 'drawOffered', 'drawSent', 'drawLater', 'save', 'histFriend', 'winText', 'lossText']) {
    assert.equal(typeof C[k], 'string', k);
    assert.ok(C[k].length > 0 && C[k].length <= 70, k);
    assert.ok(!/—/.test(C[k]), k + ': no em dash');
  }
  assert.equal(C.keep, 'Keep playing', 'the app’s own line');
});

test('Data rule: a friend game in prof.games survives migrate() and merge() (unions never lose a game; no new profile version)', () => {
  const fg = { id: 'f-' + GID, d: T, r: 'W', user: 'w', level: null, fr: OPP, ann: {}, tags: {}, sans: ['e4', 'e5'] };
  const eg = { id: 'g1', d: T - 1000, r: 'L', user: 'b', level: 3, acc: 70, counts: {}, tags: { hung: 1 }, sans: ['e4'], ann: {} };
  const p = P.migrate({ v: 5, level: 'improver', games: [fg, eg] });
  assert.equal(P.V, 5, 'FC-D29: the profile stays v5');
  assert.deepEqual(p.games[0], fg, 'kept as it is');
  const local = P.migrate({ v: 5, level: 'improver', games: [fg], t: 2 });
  const cloud = P.migrate({ v: 5, level: 'improver', games: [eg, Object.assign({}, fg)], t: 1 });
  const m = P.merge(local, cloud);
  assert.deepEqual(m.games.map((g) => g.id), ['f-' + GID, 'g1'], 'one copy of the friend game, and the engine game');
  assert.equal(m.games[0].fr, OPP);
  assert.equal(m.games[0].level, null);
  assert.ok(!('n' in m.games[0]) && !JSON.stringify(m).includes('Priya'), 'no nickname in the profile (FC-D29)');
});
