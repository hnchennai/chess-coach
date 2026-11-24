'use strict';
// The scheduled jobs' core (tech spec section 6), with the store, clock, push sending and Auth deletion passed in.
// tick (every 15 minutes): active games past their deadline end on time (the side to move loses, push "over" to
// both); games whose reminder is due get one "remind" push to the side to move (rem = null); invites past their
// 7 days end expired, so they stop counting toward the 10 open games.
// daily (03:30 India time): user docs not seen for 60 days with no open game are deleted with their Auth user.
// deleteMe tombstones are left alone (they hold nothing and TTL removes them).
// Each run is bounded: candidates come in pages with a cursor, at most `max` per kind, and no new candidate is
// taken after `budget` ms of the run (90 s of the 120 s timeout), so a commit is never cut off from its push. Each change runs in its own
// transaction that re-reads the document and re-checks the condition, because a move, an accept or any op by the
// player may land between the query and the change. Logs carry counts and error codes only, never a uid or token.
const game = require('./game');
const { over } = require('./ops');

const PAGE = 100; // candidates per query
const MAX = 200; // candidates per kind per run (a transaction each); the rest waits for the next run
const IDLE_MS = 60 * game.DAY_MS; // daily: IDs not seen for 60 days
const BUDGET_MS = 90 * 1000; // no new candidate after this much of a run (the jobs time out at 120 s)

function makeJobs({ store, now, push, log = console.error, deleteAuthUser, page = PAGE, max = MAX, budget = BUDGET_MS }) {
  let stopAt = Infinity; // set at the start of each run
  async function sendAll(list) {
    for (const p of list) {
      try {
        await push(p);
      } catch (e) {
        log('push failed', p.t, p.g, e && e.code);
      }
    }
  }

  // Walks candidates from query(after, limit) (rows { id, doc } ordered by (doc[key], id)), at most max of them.
  // handle(row) returns true when it changed something. A failing candidate is logged and skipped.
  async function walk(query, key, handle) {
    let after = null;
    let looked = 0;
    let done = 0;
    for (;;) {
      const limit = Math.min(page, max - looked);
      if (limit <= 0) return { done, more: true };
      const rows = await query(after, limit);
      for (const row of rows) {
        if (now() - stopAt > 0) return { done, more: true };
        looked++;
        try {
          if (await handle(row)) done++;
        } catch (e) {
          log('job step failed', { code: e && e.code });
        }
      }
      if (rows.length < limit) return { done, more: false };
      const last = rows[rows.length - 1];
      after = { v: last.doc[key], id: last.id };
    }
  }

  // One game in its own transaction: change(g, ts, id) returns { ng, push } or null to leave it alone
  async function oneGame(id, change) {
    const r = await store.tx(async (t) => {
      const g = await t.game(id);
      const c = g && change(g, now(), id);
      if (!c) return null;
      t.setGame(id, c.ng);
      return c;
    });
    if (!r) return false;
    await sendAll(r.push);
    return true;
  }

  const games = (st, field, upto, change) => walk(
    (after, limit) => store.due(st, field, upto, after, limit), field, (row) => oneGame(row.id, change));

  async function tick() {
    const upto = now();
    stopAt = upto + budget;
    const time = await games('active', 'dl', upto, (g, ts, id) => {
      if (g.st !== 'active' || !game.isLate(g.dl, ts)) return null; // on the deadline is still in time
      return {
        ng: over(g, { r: game.other(game.turnOf(g.moves)), why: 'time' }, ts),
        push: [{ to: g.w, t: 'over', g: id }, { to: g.b, t: 'over', g: id }],
      };
    });
    const remind = await games('active', 'rem', upto, (g, ts, id) => {
      if (g.st !== 'active' || typeof g.rem !== 'number' || g.rem > ts || game.isLate(g.dl, ts)) return null;
      // Not a change the players see, so v and t stay (no extra sync reads)
      return { ng: { ...g, rem: null }, push: [{ to: game.turnOf(g.moves) === 'w' ? g.w : g.b, t: 'remind', g: id }] };
    });
    const expired = await games('invited', 'expireAt', upto, (g, ts, id) => {
      if (g.st !== 'invited' || !(ts > g.expireAt)) return null; // on the expiry time the invite is still good
      return { ng: over(g, { r: null, why: 'expired' }, ts), push: [] };
    });
    return { time: time.done, remind: remind.done, expired: expired.done, more: time.more || remind.more || expired.more };
  }

  // Still idle: a user doc (not a tombstone) not seen for 60 days, with no open game. Reads only.
  async function idle(t, uid) {
    const u = await t.user(uid);
    if (!u || u.gone || !(u.seen < now() - IDLE_MS)) return false;
    return (await t.openCount(uid)) === 0;
  }

  // Check, delete the Auth user (already gone counts as done), then delete the doc in a second transaction that
  // checks again. An Auth failure leaves the doc, so the next run tries again; no Auth user is ever left without a doc.
  async function daily() {
    const start = now();
    stopAt = start + budget;
    const before = start - IDLE_MS;
    const r = await walk((after, limit) => store.idleUsers(before, after, limit), 'seen', async (row) => {
      if (!(await store.tx((t) => idle(t, row.id)))) return false;
      await deleteAuthUser(row.id);
      return store.tx(async (t) => {
        if (!(await idle(t, row.id))) return false;
        t.delUser(row.id);
        return true;
      });
    });
    return { deleted: r.done, more: r.more };
  }

  return { tick, daily };
}

// Deletes an Auth user; one that is already gone counts as done (deleteMe and daily can run again)
function makeAuthDeleter(auth) {
  return async (uid) => {
    try {
      await auth.deleteUser(uid);
    } catch (e) {
      if (!e || e.code !== 'auth/user-not-found') throw e;
    }
  };
}

module.exports = { makeJobs, makeAuthDeleter, PAGE, MAX, IDLE_MS, BUDGET_MS };
