'use strict';
// The friend callable's ops for FC1: hello, invite, peek, accept, move, sync, cancel (tech spec section 6).
// Written against a small data layer (memstore.js for tests, fsstore.js for Firestore), with time, randomness
// and push sending injected. Every op: needs auth, validates strictly, touches users/{uid}.seen,
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
const SYNC_MAX = 100;
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
  };
}

function colourOf(g, uid) {
  return g.w === uid ? 'w' : g.b === uid ? 'b' : null;
}

function makeOps({ store, now, rand, push, log = console.error, syncMax = SYNC_MAX }) {
  // Run fn inside a transaction that also touches users/{uid}.seen (written last, after fn's reads and writes).
  // fn returns { out } on success or { fail: [status, code], games } for a failure; a failure still commits
  // whatever fn wrote (a late move ends the game on time) and is thrown after the commit.
  async function run(uid, fn, userPatch) {
    const ts = now();
    const res = await store.tx(async (t) => {
      const u = await t.user(uid);
      const r = (await fn(t, ts, u)) || {};
      const base = u || { tok: null, seen: ts, inv: { d: null, n: 0 } };
      t.setUser(uid, { ...base, ...(userPatch ? userPatch(u, r) : {}), ...(r.user || {}), seen: ts });
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
          res: null, v: 1, t0: ts, t: ts, expireAt: exp,
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
          st: 'active', dl, rem, v: g.v + 1, t: ts, expireAt: null,
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
        const code = await t.inviteOf(req.g);
        const ng = over(g, { r: null, why: 'expired' }, ts);
        t.setGame(req.g, ng);
        if (code) t.delInvite(code);
        return { out: { now: ts, games: [view(req.g, ng, uid)] } };
      });
    },

    async sync(uid, req) {
      const ts = await run(uid, async (t, n) => ({ out: n }));
      const rows = await store.since(uid, req.since, syncMax + 1);
      let page = rows.slice(0, syncMax);
      const more = rows.length > syncMax;
      if (more) {
        // Games sharing the next game's time are left for the next call, so since = last t never skips one
        const cut = rows[syncMax].doc.t;
        const kept = page.filter((x) => x.doc.t !== cut);
        if (kept.length) page = kept;
      }
      return { now: ts, games: page.map((x) => view(x.id, x.doc, uid)), more };
    },
  };

  function over(g, res, ts) {
    return { ...g, st: 'over', res, dl: null, rem: null, draw: null, v: g.v + 1, t: ts, expireAt: ts + KEEP_OVER_MS };
  }

  async function handle(auth, data) {
    if (!auth || typeof auth.uid !== 'string' || !auth.uid) throw new OpError('unauthenticated', 'auth');
    const req = validate(data);
    return ops[req.op](auth.uid, req);
  }

  return { handle };
}

module.exports = { makeOps, view, MAX_OPEN, MAX_INVITES_A_DAY, INVITE_MS, KEEP_OVER_MS, SYNC_MAX };
