'use strict';
// The friend callable's ops for FC1: hello, invite, peek, accept, move, sync, cancel (tech spec section 6).
// Written against a small data layer (memstore.js for tests, fsstore.js for Firestore), with time, randomness
// and push sending injected. Every op: needs auth, validates strictly, reads users/{uid} (one player's ops run
// one at a time) and writes seen at most every 6 hours,
// changes games inside one transaction, sends push intents after the commit, and returns the caller's view
// of each changed game. The app never sees a uid.
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
const START_FEN = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
const ACCEPTOR_COL = { w: 'b', b: 'w', r: 'r' };

// The caller's view of a game: no uids, no push tokens, no internal fields.
function view(id, g, uid) {
  const oppUid = g.uids.find((u) => u !== uid) || null;
  return {
    id,
    me: g.w === uid ? 'w' : g.b === uid ? 'b' : g.col, // 'r' only while a random-colour invite waits
    opp: oppUid ? ids.oppKey(oppUid, uid) : null,
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

function makeOps({ store, now, rand, push, log = console.error, syncMax = SYNC_MAX }) {
  // Run fn inside a transaction that reads users/{uid} first and writes it last: when the op changes it
  // (new user, token, invite count) or seen is 6 hours old.
  // fn returns { out } on success or { fail: [status, code], games } for a failure; a failure still commits
  // whatever fn wrote (a late move ends the game on time) and is thrown after the commit.
  async function run(uid, fn, userPatch) {
    const ts = now();
    const res = await store.tx(async (t) => {
      const u = await t.user(uid);
      const r = (await fn(t, ts, u)) || {};
      const base = u || { tok: null, seen: ts, inv: { d: null, n: 0 } };
      const patch = { ...(userPatch ? userPatch() : {}), ...(r.user || {}) };
      if (!u || Object.keys(patch).length || !(ts - u.seen < SEEN_EVERY_MS)) t.setUser(uid, { ...base, ...patch, seen: ts });
      return r;
    });
    for (const p of res.push || []) {
      try {
        await push(p);
      } catch (e) {
        log('push failed', p.t, p.g, e && e.message);
      }
    }
    if (res.fail) {
      const [status, code] = res.fail;
      throw new OpError(status, code, res.games ? { games: res.games } : undefined);
    }
    return res.out;
  }

  const fail = (code, games) => ({ fail: ['failed-precondition', code], games });
  const notFound = () => ({ fail: ['not-found', 'not-found'] });

  // An invite usable by uid: returns { inv, g } or a failure
  async function usableInvite(t, code, uid, ts) {
    const inv = await t.invite(code);
    if (!inv) return { bad: notFound() };
    if (inv.used) return { bad: fail('used') };
    const g = await t.game(inv.g);
    if (ts > inv.exp || (g && g.res && g.res.why === 'expired')) return { bad: fail('expired') };
    if (!g || g.st !== 'invited') return { bad: fail('used') };
    if (inv.by === uid) return { bad: fail('own') };
    return { inv, g };
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
        const { bad, inv, g } = await usableInvite(t, req.code, uid, ts);
        if (bad) return bad;
        return { out: { now: ts, col: ACCEPTOR_COL[g.col], exp: inv.exp } };
      });
    },

    async accept(uid, req) {
      return run(uid, async (t, ts) => {
        const { bad, inv, g } = await usableInvite(t, req.code, uid, ts);
        if (bad) return bad;
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
        // Kept (not deleted) so a second tap says "used"; it holds no uid and TTL removes it at its expiry.
        t.setInvite(req.code, { used: true, exp: inv.exp, expireAt: inv.expireAt });
        const push = byWhite ? [{ to: by, t: 'move', g: inv.g }] : [];
        return { push, out: { now: ts, games: [view(inv.g, ng, uid)] } };
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

    // Returns { now, next, more, games }. The app sends next as since on its next sync. t is taken before the
    // transaction, so t order is not commit order: next stays SYNC_LAG_MS behind now and answers overlap
    // (the app keeps the higher v per game). While paging, next is the last returned t (games sharing the next
    // game's t are left for the next page), never ahead of now - lag unless that would stop the paging.
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
        const last = page[page.length - 1].doc.t;
        next = lagged > req.since ? Math.min(last, lagged) : last;
      }
      return { now: ts, next, more, games: page.map((x) => view(x.id, x.doc, uid)) };
    },
  };

  function over(g, res, ts) {
    return { ...g, st: 'over', res, dl: null, rem: null, draw: null, code: null, v: g.v + 1, t: ts, expireAt: ts + KEEP_OVER_MS };
  }

  async function handle(auth, data) {
    if (!auth || typeof auth.uid !== 'string' || !auth.uid) throw new OpError('unauthenticated', 'auth');
    const req = validate(data);
    return ops[req.op](auth.uid, req);
  }

  return { handle };
}

module.exports = { makeOps, view, MAX_OPEN, MAX_INVITES_A_DAY, INVITE_MS, KEEP_OVER_MS, SYNC_MAX, SYNC_LAG_MS, SEEN_EVERY_MS };
