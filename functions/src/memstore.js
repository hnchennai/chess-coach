'use strict';
// In-memory data layer with the same interface as fsstore.js, for fast local tests (no Java, no network).
// Like a Firestore transaction: all reads before any write, writes staged and applied only on success, and a
// transaction whose read documents were changed by another commit runs again (up to 5 times, then 'aborted').
// Like Firestore, query results (openCount, since) are not protected against new matches: only document reads are.
// Times are plain ms numbers here; fsstore.js turns expireAt into a Firestore Timestamp.

const COLS = ['users', 'games', 'invites'];
const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

class MemStore {
  constructor() {
    this.data = { users: new Map(), games: new Map(), invites: new Map() };
    this.writeLog = []; // [collection, id] of every committed write, for tests
    this.ver = new Map(); // 'col/id' -> version, bumped on every committed write
    this.barrier = null;
  }

  // Test hook: the next n transactions wait before committing until all n have read everything
  commitBarrier(n) {
    let release;
    const all = new Promise((r) => { release = r; });
    this.barrier = { n, waiting: 0, all, release };
  }

  async tx(fn) {
    for (let attempt = 0; attempt < 5; attempt++) {
      const r = await this.attempt(fn);
      if (r.ok) return r.out;
    }
    throw new Error('aborted: too much contention');
  }

  async attempt(fn) {
    const writes = [];
    const seen = new Map(); // 'col/id' -> version when read
    const read = (f) => async (...a) => {
      if (writes.length) throw new Error('Firestore transactions need all reads before writes');
      return f(...a);
    };
    const get = (col, id) => {
      seen.set(col + '/' + id, this.ver.get(col + '/' + id) || 0);
      return this.data[col].has(id) ? copy(this.data[col].get(id)) : null;
    };
    const t = {
      user: read((uid) => get('users', uid)),
      game: read((id) => get('games', id)),
      invite: read((code) => get('invites', code)),
      openCount: read((uid) => {
        let n = 0;
        for (const g of this.data.games.values()) {
          if (g.uids.includes(uid) && (g.st === 'invited' || g.st === 'active')) n++;
        }
        return n;
      }),
      setUser: (uid, doc) => writes.push(['users', uid, copy(doc)]),
      delUser: (uid) => writes.push(['users', uid, undefined]),
      setGame: (id, doc) => writes.push(['games', id, copy(doc)]),
      newGame: (id, doc) => writes.push(['games', id, copy(doc), 'create']),
      setInvite: (code, doc) => writes.push(['invites', code, copy(doc)]),
      delInvite: (code) => writes.push(['invites', code, undefined]),
    };
    const out = await fn(t);
    const b = this.barrier;
    if (b) {
      if (++b.waiting >= b.n) {
        this.barrier = null;
        b.release();
      }
      await b.all;
    }
    // From here to the end runs without awaiting, so the check and the writes are atomic
    for (const [key, v] of seen) if ((this.ver.get(key) || 0) !== v) return { ok: false };
    for (const [col, id, , mode] of writes) {
      if (mode === 'create' && this.data[col].has(id)) throw new Error(`${col}/${id} already exists`);
    }
    for (const [col, id, doc] of writes) {
      this.writeLog.push([col, id]);
      this.ver.set(col + '/' + id, (this.ver.get(col + '/' + id) || 0) + 1);
      if (doc === undefined) this.data[col].delete(id);
      else this.data[col].set(id, doc);
    }
    return { ok: true, out };
  }

  // Games where uid is a player and t > since, oldest change first, at most limit
  async since(uid, since, limit) {
    return [...this.data.games.entries()]
      .filter(([, g]) => g.uids.includes(uid) && g.t > since)
      .sort((a, b) => a[1].t - b[1].t)
      .slice(0, limit)
      .map(([id, g]) => ({ id, doc: copy(g) }));
  }

  // A user doc outside a transaction (push sending reads the token), or null
  async getUser(uid) {
    return this.data.users.has(uid) ? copy(this.data.users.get(uid)) : null;
  }

  // Ids of games where uid is a player, at most limit (deleteMe)
  async gamesOf(uid, limit) {
    return [...this.data.games.entries()].filter(([, g]) => g.uids.includes(uid)).slice(0, limit).map(([id]) => id);
  }

  // Codes of invites made by uid, at most limit (deleteMe)
  async invitesBy(uid, limit) {
    return [...this.data.invites.entries()].filter(([, i]) => i.by === uid).slice(0, limit).map(([id]) => id);
  }

  // Games in state st whose field (a number; null never matches, as in Firestore) is <= upto, ordered by
  // (field, id), after the cursor { v, id }, at most limit (tick)
  async due(st, field, upto, after, limit) {
    return sorted([...this.data.games.entries()]
      .filter(([, g]) => g.st === st && typeof g[field] === 'number' && g[field] <= upto), field, after, limit);
  }

  // Users with seen < before, ordered by (seen, id), after the cursor { v, id }, at most limit (daily)
  async idleUsers(before, after, limit) {
    return sorted([...this.data.users.entries()].filter(([, u]) => typeof u.seen === 'number' && u.seen < before), 'seen', after, limit);
  }

  // deleteMe tombstones not finished yet ({ gone, at } with no expireAt) with at < before, ordered by (at, id) (daily)
  async tombstones(before, after, limit) {
    return sorted([...this.data.users.entries()].filter(([, u]) => typeof u.at === 'number' && u.at < before), 'at', after, limit);
  }

  // Test helpers
  get(col, id) { return copy(this.data[col].get(id)); }
  put(col, id, doc) { this.data[col].set(id, copy(doc)); }
  count(col) { return this.data[col].size; }
  size() { return COLS.reduce((n, c) => n + this.data[c].size, 0); }
  dump() {
    const out = {};
    for (const c of COLS) out[c] = Object.fromEntries([...this.data[c]].map(([k, v]) => [k, copy(v)]));
    return out;
  }
}

function sorted(rows, field, after, limit) {
  const key = ([id, d]) => [d[field], id];
  const cmp = (a, b) => (a[0] - b[0]) || (a[1] < b[1] ? -1 : a[1] > b[1] ? 1 : 0);
  return rows
    .sort((a, b) => cmp(key(a), key(b)))
    .filter((r) => !after || cmp(key(r), [after.v, after.id]) > 0)
    .slice(0, limit)
    .map(([id, d]) => ({ id, doc: copy(d) }));
}

module.exports = { MemStore };
