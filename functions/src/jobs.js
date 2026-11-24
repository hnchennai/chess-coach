'use strict';
// The scheduled jobs' core (tech spec section 6), with the store, clock, push sending and Auth deletion passed in.
// tick (every 15 minutes): active games past their deadline end on time (the side to move loses, push "over" to
// both); games whose reminder is due get one "remind" push to the side to move (rem = null); invites past their
// 7 days end expired, so they stop counting toward the 10 open games.
// daily (03:30 India time): user docs not seen for 60 days with no open game are deleted with their Auth user.
// Each run is bounded: candidates come in pages with a cursor, at most `max` per kind. Each change runs in its own
// transaction that re-reads the document and re-checks the condition, because a move, an accept or any op by the
// player may land between the query and the change. Logs carry counts and error codes only, never a uid or token.
const game = require('./game');
const { over } = require('./ops');

const PAGE = 100; // candidates per query
const MAX = 200; // candidates per kind per run (a transaction each); the rest waits for the next run
const IDLE_MS = 60 * game.DAY_MS; // daily: IDs not seen for 60 days

function makeJobs({ store, now, push, log = console.error, deleteAuthUser, page = PAGE, max = MAX }) {
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

  async function daily() {
    const before = now() - IDLE_MS;
    const r = await walk((after, limit) => store.idleUsers(before, after, limit), 'seen', async (row) => {
      const gone = await store.tx(async (t) => {
        const u = await t.user(row.id);
        if (!u || !(u.seen < now() - IDLE_MS)) return false;
        if ((await t.openCount(row.id)) > 0) return false;
        t.delUser(row.id);
        return true;
      });
      if (gone) await deleteAuthUser(row.id);
      return gone;
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

module.exports = { makeJobs, makeAuthDeleter, PAGE, MAX, IDLE_MS };
