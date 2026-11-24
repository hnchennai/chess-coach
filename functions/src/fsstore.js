'use strict';
// Firestore data layer (Admin SDK) with the same interface as memstore.js.
// Ops see plain ms numbers; here expireAt (the TTL field) becomes a Firestore Timestamp and back.
const { Timestamp } = require('firebase-admin/firestore');

function toDoc(o) {
  if (o && typeof o.expireAt === 'number') return { ...o, expireAt: Timestamp.fromMillis(o.expireAt) };
  return o;
}

function fromSnap(snap) {
  if (!snap.exists) return null;
  const d = snap.data();
  if (d.expireAt instanceof Timestamp) d.expireAt = d.expireAt.toMillis();
  return d;
}

class FsStore {
  constructor(db) {
    this.db = db;
    this.users = db.collection('users');
    this.games = db.collection('games');
    this.invites = db.collection('invites');
  }

  async tx(fn) {
    return this.db.runTransaction(async (tx) => {
      const t = {
        user: async (uid) => fromSnap(await tx.get(this.users.doc(uid))),
        game: async (id) => fromSnap(await tx.get(this.games.doc(id))),
        invite: async (code) => fromSnap(await tx.get(this.invites.doc(code))),
        inviteOf: async (gid) => {
          const q = await tx.get(this.invites.where('g', '==', gid).limit(1));
          return q.empty ? null : q.docs[0].id;
        },
        // Open games (invited + active): two count queries on the (uids, st) index, inside the transaction
        openCount: async (uid) => {
          const mine = this.games.where('uids', 'array-contains', uid);
          const a = await tx.get(mine.where('st', '==', 'invited').count());
          const b = await tx.get(mine.where('st', '==', 'active').count());
          return a.data().count + b.data().count;
        },
        setUser: (uid, doc) => { tx.set(this.users.doc(uid), toDoc(doc)); },
        setGame: (id, doc) => { tx.set(this.games.doc(id), toDoc(doc)); },
        newGame: (id, doc) => { tx.create(this.games.doc(id), toDoc(doc)); },
        setInvite: (code, doc) => { tx.set(this.invites.doc(code), toDoc(doc)); },
        delInvite: (code) => { tx.delete(this.invites.doc(code)); },
      };
      return fn(t);
    });
  }

  // Games where uid is a player and t > since, oldest change first (index: uids array-contains, t)
  async since(uid, since, limit) {
    const q = await this.games.where('uids', 'array-contains', uid).where('t', '>', since).orderBy('t').limit(limit).get();
    return q.docs.map((d) => ({ id: d.id, doc: fromSnap(d) }));
  }
}

module.exports = { FsStore, toDoc, fromSnap };
