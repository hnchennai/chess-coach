'use strict';
// The friend callable's ops: hello, invite, peek, accept, move, sync, cancel (FC1), resign, draw, deleteMe (FC2)
// (tech spec section 6).
// Written against a small data layer (memstore.js for tests, fsstore.js for Firestore), with time, randomness
// and push sending injected. Every op: needs auth, validates strictly, reads users/{uid} and writes seen at most
// every 6 hours. A read alone does not make two transactions conflict; a write does. So every op that can raise a
// player's open-game count (invite, accept) always writes that player's user doc: two at once conflict, one runs
// again and sees the new count, and the 10 open games limit holds. Each op changes games inside one transaction
// (deleteMe: one per page of games), sends push intents after the commit, and returns the caller's view of each
// changed game. The app never sees a uid.
const game = require('./game');
const ids = require('./ids');
const { OpError } = require('./errors');
const { validate } = require('./validate');

const MAX_OPEN = 10; // FC-D12
const MAX_INVITES_A_DAY = 20; // tech spec section 7
const INVITE_MS = 7 * game.DAY_MS; // FC-D9
const KEEP_OVER_MS = 30 * game.DAY_MS; // FC-D16: finished games are deleted 30 days after they end (TTL on expireAt)
const SYNC_MAX = 25; // games per sync answer
const SYNC_LAG_MS = 120000; // sync cursor lag: longer than the 30 s function timeout, so every write with t <= now - lag has committed
const SEEN_EVERY_MS = 6 * 60 * 60 * 1000; // users/{uid}.seen is written at most this often (unless the op writes the user anyway)
const DELETE_PAGE = 50; // deleteMe: games per transaction
const DELETE_MAX_PAGES = 100; // deleteMe: a bound on the loop (20 invites a day for 30 days is about 12 pages)
const GONE = 'x'; // stands for a player who deleted their data
// deleteMe leaves a tombstone users/{uid} (no token, no seen): { gone: true, at } until the clean-up is done, then
// { gone: true, expireAt } with expireAt this far ahead, for TTL. The ID token stays valid for up to an hour after
// the Auth user is deleted, and every op refuses a tombstoned uid instead of bringing data back.
const TOMBSTONE_MS = 2 * 60 * 60 * 1000;
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const ACCEPTOR_COL = { w: 'b', b: 'w', r: 'r' };

// The caller's view of a game: no uids, no push tokens, no internal fields. When the friend deleted their data,
// their uid is 'x' and opp comes from oppx, the key this player had for them, so the record per friend holds.
function view(id, g, uid) {
  const oppUid = g.uids.find((u) => u !== uid) || null;
  return {
    id,
    me: g.w === uid ? 'w' : g.b === uid ? 'b' : g.col, // 'r' only while a random-colour invite waits
    opp: oppUid === GONE ? g.oppx || null : oppUid ? ids.oppKey(oppUid, uid) : null,
    st: g.st,
    moves: g.moves.slice(),
    dl: g.dl,
    draw: g.draw,
    res: g.res,
    v: g.v,
    t: g.t,
    exp: g.st === 'invited' ? g.expireAt : null,
    code: g.st === 'invited' && g.by === uid ? g.code || null : null, // only the owner, only while it waits
  };
}

function colourOf(g, uid) {
  return g.w === uid ? 'w' : g.b === uid ? 'b' : null;
}

// A game ends: no deadline, reminder, offer or code any more; kept 30 days (TTL on expireAt)
function over(g, res, ts) {
  return { ...g, st: 'over', res, dl: null, rem: null, draw: null, code: null, v: g.v + 1, t: ts, expireAt: ts + KEEP_OVER_MS };
}

// deleteMe for one game: an invite ends expired, an active game ends abandoned (the friend wins, push "over" to the
// friend) unless it is already past its deadline (then the side to move loses on time, as tick would end it), a
// finished game keeps its result. Then uid becomes 'x' everywhere in it, and oppx keeps the friend's
// key for this player (see view). Returns { ng, to } with to the friend to push, or null.
function leave(g, uid, ts) {
  const me = colourOf(g, uid);
  const friend = g.uids.find((u) => u && u !== uid && u !== GONE) || null;
  let ng;
  let to = null;
  if (g.st === 'invited') {
    ng = over(g, { r: null, why: 'expired' }, ts);
  } else if (g.st === 'active' && me) {
    const res = game.isLate(g.dl, ts) ? { r: game.other(game.turnOf(g.moves)), why: 'time' } : { r: game.other(me), why: 'abandoned' };
    ng = over(g, res, ts);
    to = friend;
  } else {
    ng = { ...g, v: g.v + 1, t: ts };
  }
  const x = (u) => (u === uid ? GONE : u);
  ng = { ...ng, uids: ng.uids.map(x), w: x(ng.w), b: x(ng.b), by: x(ng.by), oppx: friend ? ids.oppKey(uid, friend) : null };
  return { ng, to };
}

// Sends push intents after a commit; a failure is logged by code only (a message could name a uid or token)
function makeSendAll(push, log) {
  return async function sendAll(list) {
    for (const p of list || []) {
      try {
        await push(p);
      } catch (e) {
        log('push failed', p.t, p.g, e && e.code);
      }
    }
  };
}

// The clean-up after a tombstone is written, shared by deleteMe and daily (which finishes a deleteMe that failed
// partway): games in pages, each page in its own transaction that re-reads every game, pushes after each commit;
// then the invites; then the Auth user (already gone counts as done); last the tombstone gets expireAt, so TTL
// removes it 2 hours later. Any failure leaves the tombstone without expireAt. Safe to run again.
function makeFinisher({ store, now, push, log = console.error, deleteAuthUser, deletePage = DELETE_PAGE }) {
  const sendAll = makeSendAll(push, log);
  return async function finishDelete(uid) {
    for (let page = 0; ; page++) {
      const list = await store.gamesOf(uid, deletePage);
      if (!list.length) break;
      if (page >= DELETE_MAX_PAGES) throw new OpError('internal', 'internal');
      const pushes = await store.tx(async (t) => {
        const ts = now();
        const docs = [];
        for (const id of list) docs.push([id, await t.game(id)]);
        const out = [];
        for (const [id, g] of docs) {
          if (!g || !g.uids.includes(uid)) continue;
          const { ng, to } = leave(g, uid, ts);
          t.setGame(id, ng);
          if (to) out.push({ to, t: 'over', g: id });
        }
        return out;
      });
      await sendAll(pushes);
    }
    for (let page = 0; ; page++) {
      const codes = await store.invitesBy(uid, deletePage);
      if (!codes.length) break;
      if (page >= DELETE_MAX_PAGES) throw new OpError('internal', 'internal');
      await store.tx(async (t) => { for (const c of codes) t.delInvite(c); });
    }
    await deleteAuthUser(uid);
    await store.tx(async (t) => {
      const u = await t.user(uid);
      if (u && u.gone) t.setUser(uid, { gone: true, expireAt: now() + TOMBSTONE_MS });
    });
  };
}

function makeOps({ store, now, rand, push, log = console.error, deleteAuthUser, syncMax = SYNC_MAX, deletePage = DELETE_PAGE }) {
  const sendAll = makeSendAll(push, log);
  const finishDelete = makeFinisher({ store, now, push, log, deleteAuthUser, deletePage });

  // Run fn inside a transaction that reads users/{uid} first and writes it last: when the op changes it
  // (new user, token, invite count) or seen is 6 hours old.
  // fn returns { out } on success or { fail: [status, code], games } for a failure; a failure still commits
  // whatever fn wrote (a late move ends the game on time) and is thrown after the commit.
  async function run(uid, fn, userPatch) {
    const ts = now();
    const res = await store.tx(async (t) => {
      const u = await t.user(uid);
      if (u && u.gone) return { fail: ['not-found', 'not-found'] }; // deleted (fix round 1): no writes at all
      const r = (await fn(t, ts, u)) || {};
      const base = u || { tok: null, seen: ts, inv: { d: null, n: 0 } };
      const patch = { ...(userPatch ? userPatch() : {}), ...(r.user || {}) };
      if (!u || r.writeUser || Object.keys(patch).length || !(ts - u.seen < SEEN_EVERY_MS)) {
        t.setUser(uid, { ...base, ...patch, seen: ts });
      }
      return r;
    });
    await sendAll(res.push);
    if (res.fail) {
      const [status, code] = res.fail;
      throw new OpError(status, code, res.games ? { games: res.games } : undefined);
    }
    return res.out;
  }

  const fail = (code, games) => ({ fail: ['failed-precondition', code], games });
  const notFound = () => ({ fail: ['not-found', 'not-found'] });

  // An invite usable by uid: returns { inv, g }, { mine } (uid already accepted it: a retry after a lost answer, FC3
  // fix round 1; the used invite keeps its game id, never a uid) or a failure
  async function usableInvite(t, code, uid, ts) {
    const inv = await t.invite(code);
    if (!inv) return { bad: notFound() };
    if (inv.used) {
      const ug = typeof inv.g === 'string' ? await t.game(inv.g) : null;
      if (ug && ug.st !== 'invited' && ug.by !== uid && ug.uids.includes(uid)) return { inv, mine: { id: inv.g, g: ug } };
      return { bad: fail('used') };
    }
    const g = await t.game(inv.g);
    if (ts > inv.exp || (g && g.res && g.res.why === 'expired')) return { bad: fail('expired') };
    if (!g || g.st !== 'invited') return { bad: fail('used') };
    if (inv.by === uid) return { bad: fail('own') };
    return { inv, g };
  }

  // resign and draw: my active game, in time. Returns { g, me, opp } or { bad }. A game whose side to move ran
  // out of time ends on time here (the same as a late move) and the op fails "late".
  async function myActiveGame(t, id, uid, ts) {
    const g = await t.game(id);
    if (!g || !g.uids.includes(uid)) return { bad: notFound() };
    const me = colourOf(g, uid);
    if (g.st === 'invited' || !me) return { bad: fail('turn', [view(id, g, uid)]) };
    if (g.st === 'over') return { bad: fail('over', [view(id, g, uid)]) };
    const opp = me === 'w' ? g.b : g.w;
    if (game.isLate(g.dl, ts)) {
      const ng = over(g, { r: game.other(game.turnOf(g.moves)), why: 'time' }, ts);
      t.setGame(id, ng);
      return { bad: { ...fail('late', [view(id, ng, uid)]), push: [{ to: opp, t: 'over', g: id }] } };
    }
    return { g, me, opp };
  }

  const ops = {
    async hello(uid, req) {
      return run(uid, async (t, ts) => ({ out: { now: ts } }), () => ('tok' in req ? { tok: req.tok } : {}));
    },

    async invite(uid, req) {
      return run(uid, async (t, ts, u) => {
        const open = await t.openCount(uid);
        if (open >= MAX_OPEN) return fail('full');
        const day = ids.istDay(ts);
        const n = u && u.inv && u.inv.d === day ? u.inv.n : 0;
        if (n >= MAX_INVITES_A_DAY) return fail('limit');
        // 50-bit codes: a clash with a live invite is very unlikely, but check (one read) and draw again
        let code = null;
        for (let i = 0; i < 5 && !code; i++) {
          const c = ids.newCode(rand);
          if (!(await t.invite(c))) code = c;
        }
        if (!code) return { fail: ['internal', 'internal'] };
        // 119-bit game ids: no read; newGame refuses to overwrite, so a clash fails the transaction instead
        const gid = ids.newGameId(rand);
        const exp = ts + INVITE_MS;
        const g = {
          uids: [uid, null], w: req.col === 'w' ? uid : null, b: req.col === 'b' ? uid : null, by: uid, col: req.col,
          st: 'invited', moves: [], fen: START_FEN, dl: null, rem: null, draw: null, drawPly: { w: -1, b: -1 },
          res: null, v: 1, t0: ts, t: ts, expireAt: exp, code,
        };
        t.newGame(gid, g);
        t.setInvite(code, { g: gid, by: uid, exp, expireAt: exp });
        return { user: { inv: { d: day, n: n + 1 } }, out: { now: ts, code, games: [view(gid, g, uid)] } };
      });
    },

    async peek(uid, req) {
      return run(uid, async (t, ts) => {
        const { bad, inv, g, mine } = await usableInvite(t, req.code, uid, ts);
        if (bad) return bad;
        if (mine) return { out: { now: ts, col: colourOf(mine.g, uid), exp: inv.exp, accepted: true, games: [view(mine.id, mine.g, uid)] } };
        return { out: { now: ts, col: ACCEPTOR_COL[g.col], exp: inv.exp } };
      });
    },

    async accept(uid, req) {
      return run(uid, async (t, ts) => {
        const { bad, inv, g, mine } = await usableInvite(t, req.code, uid, ts);
        if (bad) return bad;
        if (mine) return { out: { now: ts, games: [view(mine.id, mine.g, uid)] } }; // a retry: the same game, nothing changes
        const open = await t.openCount(uid);
        if (open >= MAX_OPEN) return fail('full');
        const by = inv.by;
        const byWhite = g.col === 'w' || (g.col === 'r' && ids.coin(rand));
        const { dl, rem } = game.deadlines(ts);
        const ng = {
          ...g, uids: [by, uid], w: byWhite ? by : uid, b: byWhite ? uid : by,
          st: 'active', dl, rem, v: g.v + 1, t: ts, expireAt: null, code: null,
        };
        t.setGame(inv.g, ng);
        // Kept (not deleted) so a second tap says "used"; it holds no uid and TTL removes it at its expiry. It keeps the game
        // id, so the acceptor's retry after a lost answer gets the game back (FC3 fix round 1).
        t.setInvite(req.code, { used: true, g: inv.g, exp: inv.exp, expireAt: inv.expireAt });
        const push = byWhite ? [{ to: by, t: 'move', g: inv.g }] : [];
        // writeUser: the acceptor's open-game count went up (see the note at the top)
        return { writeUser: true, push, out: { now: ts, games: [view(inv.g, ng, uid)] } };
      });
    },

    async move(uid, req) {
      const mv = { from: req.from, to: req.to };
      if (req.promo !== undefined) mv.promo = req.promo;
      return run(uid, async (t, ts) => {
        const g = await t.game(req.g);
        if (!g || !g.uids.includes(uid)) return notFound();
        const me = colourOf(g, uid);
        if (g.st === 'invited' || !me) return fail('turn', [view(req.g, g, uid)]);
        // An offline resend of a move that is already stored (it may have ended the game)
        if (game.turnOf(g.moves.slice(0, req.ply)) === me && game.isResend(g.moves, req.ply, mv)) {
          return { out: { now: ts, games: [view(req.g, g, uid)] } };
        }
        if (g.st === 'over') return fail('over', [view(req.g, g, uid)]);
        if (req.ply !== g.moves.length || game.turnOf(g.moves) !== me) return fail('turn', [view(req.g, g, uid)]);
        const oppUid = me === 'w' ? g.b : g.w;
        if (game.isLate(g.dl, ts)) {
          const ng = over(g, { r: game.other(me), why: 'time' }, ts);
          t.setGame(req.g, ng);
          return { ...fail('late', [view(req.g, ng, uid)]), push: [{ to: oppUid, t: 'over', g: req.g }] };
        }
        const r = game.play(g.moves, mv);
        if (!r.ok) return fail('illegal', [view(req.g, g, uid)]);
        let ng = { ...g, moves: g.moves.concat(r.san), fen: r.fen, draw: g.draw === game.other(me) ? null : g.draw };
        if (r.end) {
          ng = over(ng, r.end, ts);
        } else {
          ng = { ...ng, ...game.deadlines(ts), v: g.v + 1, t: ts };
        }
        t.setGame(req.g, ng);
        return { push: [{ to: oppUid, t: r.end ? 'over' : 'move', g: req.g }], out: { now: ts, games: [view(req.g, ng, uid)] } };
      });
    },

    async cancel(uid, req) {
      return run(uid, async (t, ts) => {
        const g = await t.game(req.g);
        if (!g || g.by !== uid || !g.uids.includes(uid)) return notFound();
        if (g.st === 'active') return fail('used', [view(req.g, g, uid)]);
        if (g.st === 'over') return fail('over', [view(req.g, g, uid)]);
        const ng = over(g, { r: null, why: 'expired' }, ts);
        t.setGame(req.g, ng);
        if (g.code) t.delInvite(g.code);
        return { out: { now: ts, games: [view(req.g, ng, uid)] } };
      });
    },

    async resign(uid, req) {
      return run(uid, async (t, ts) => {
        const { bad, g, me, opp } = await myActiveGame(t, req.g, uid, ts);
        if (bad) return bad;
        const ng = over(g, { r: game.other(me), why: 'resign' }, ts);
        t.setGame(req.g, ng);
        return { push: [{ to: opp, t: 'over', g: req.g }], out: { now: ts, games: [view(req.g, ng, uid)] } };
      });
    },

    // Offer: no open offer, and at most one offer per own move: drawPly[me] is the ply count at my last offer,
    // and a new offer needs a move of mine played since. Accept or decline: an open offer from the friend.
    // A move clears an offer made to the mover (see move). The clock does not change.
    async draw(uid, req) {
      return run(uid, async (t, ts) => {
        const { bad, g, me, opp } = await myActiveGame(t, req.g, uid, ts);
        if (bad) return bad;
        const id = req.g;
        const no = () => fail('draw', [view(id, g, uid)]);
        let ng;
        let pushes = [];
        if (req.a === 'offer') {
          const last = g.drawPly[me];
          if (g.draw !== null || (last >= 0 && game.ownMoves(me, g.moves.length) <= game.ownMoves(me, last))) return no();
          ng = { ...g, draw: me, drawPly: { ...g.drawPly, [me]: g.moves.length }, v: g.v + 1, t: ts };
          pushes = [{ to: opp, t: 'draw', g: id }];
        } else if (g.draw !== game.other(me)) {
          return no();
        } else if (req.a === 'accept') {
          ng = over(g, { r: 'd', why: 'agreed' }, ts);
          pushes = [{ to: opp, t: 'over', g: id }];
        } else {
          ng = { ...g, draw: null, v: g.v + 1, t: ts }; // no push for a decline (criterion 4)
        }
        t.setGame(id, ng);
        return { push: pushes, out: { now: ts, games: [view(id, ng, uid)] } };
      });
    },

    // Delete my friend game data (FC-D16, FC-D17, FC-D22, scenario 10). First the user doc becomes a tombstone
    // { gone, at } (that write conflicts with any op in flight, which all read the user doc, so they either commit
    // before it and their games are found, or run again and fail not-found). Then finishDelete. Safe to run again:
    // on a tombstone it finishes the clean-up and answers ok. A run that fails partway is finished by daily.
    async deleteMe(uid) {
      const first = now();
      await store.tx(async (t) => {
        const u = await t.user(uid);
        // no expireAt yet: TTL must not remove the tombstone before the clean-up is done (daily finishes it)
        t.setUser(uid, { gone: true, at: u && u.gone && typeof u.at === 'number' ? u.at : first });
      });
      await finishDelete(uid);
      return { now: first };
    },

    // Returns { now, next, more, games }. The app sends next as since on its next sync. t is taken before the
    // transaction, so t order is not commit order. While paging (more), next is the last returned t, so paging
    // always moves forward (games sharing the next game's t are left for the next page). The last page sets
    // next = now - SYNC_LAG_MS, so the following sync reads the last 2 minutes again and catches late commits
    // (safe while a paging chain takes under about 90 s). Answers overlap; the app keeps the higher v per game.
    async sync(uid, req) {
      const ts = await run(uid, async (t, n) => ({ out: n }));
      const lagged = Math.max(0, ts - SYNC_LAG_MS);
      const rows = await store.since(uid, req.since, syncMax + 1);
      let page = rows.slice(0, syncMax);
      const more = rows.length > syncMax;
      let next = lagged;
      if (more) {
        const cut = rows[syncMax].doc.t;
        const kept = page.filter((x) => x.doc.t !== cut);
        if (kept.length) page = kept;
        next = page[page.length - 1].doc.t;
      }
      return { now: ts, next, more, games: page.map((x) => view(x.id, x.doc, uid)) };
    },
  };

  async function handle(auth, data) {
    if (!auth || typeof auth.uid !== 'string' || !auth.uid) throw new OpError('unauthenticated', 'auth');
    const req = validate(data);
    return ops[req.op](auth.uid, req);
  }

  return { handle };
}

module.exports = { makeOps, makeFinisher, view, over, TOMBSTONE_MS, MAX_OPEN, MAX_INVITES_A_DAY, INVITE_MS, KEEP_OVER_MS, SYNC_MAX, SYNC_LAG_MS, SEEN_EVERY_MS };
