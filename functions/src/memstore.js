'use strict';
// In-memory data layer with the same interface as fsstore.js, for fast local tests (no Java, no network).
// Like a Firestore transaction: all reads before any write, writes staged and applied only on success.
// Times are plain ms numbers here; fsstore.js turns expireAt into a Firestore Timestamp.

const COLS = ['users', 'games', 'invites'];
const copy = (v) => (v === undefined ? undefined : JSON.parse(JSON.stringify(v)));

class MemStore {
  constructor() {
    this.data = { users: new Map(), games: new Map(), invites: new Map() };
  }

  async tx(fn) {
    const writes = [];
    const read = (f) => async (...a) => {
      if (writes.length) throw new Error('Firestore transactions need all reads before writes');
      return f(...a);
    };
    const get = (col, id) => (this.data[col].has(id) ? copy(this.data[col].get(id)) : null);
    const t = {
      user: read((uid) => get('users', uid)),
      game: read((id) => get('games', id)),
      invite: read((code) => get('invites', code)),
      inviteOf: read((gid) => {
        for (const [code, inv] of this.data.invites) if (inv.g === gid) return code;
        return null;
      }),
      openCount: read((uid) => {
        let n = 0;
        for (const g of this.data.games.values()) {
          if (g.uids.includes(uid) && (g.st === 'invited' || g.st === 'active')) n++;
        }
        return n;
      }),
      setUser: (uid, doc) => writes.push(['users', uid, copy(doc)]),
      setGame: (id, doc) => writes.push(['games', id, copy(doc)]),
      newGame: (id, doc) => writes.push(['games', id, copy(doc), 'create']),
      setInvite: (code, doc) => writes.push(['invites', code, copy(doc)]),
      delInvite: (code) => writes.push(['invites', code, undefined]),
    };
    const out = await fn(t);
    for (const [col, id, , mode] of writes) {
      if (mode === 'create' && this.data[col].has(id)) throw new Error(`${col}/${id} already exists`);
    }
    for (const [col, id, doc] of writes) {
      if (doc === undefined) this.data[col].delete(id);
      else this.data[col].set(id, doc);
    }
    return out;
  }

  // Games where uid is a player and t > since, oldest change first, at most limit
  async since(uid, since, limit) {
    return [...this.data.games.entries()]
      .filter(([, g]) => g.uids.includes(uid) && g.t > since)
      .sort((a, b) => a[1].t - b[1].t)
      .slice(0, limit)
      .map(([id, g]) => ({ id, doc: copy(g) }));
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

module.exports = { MemStore };
