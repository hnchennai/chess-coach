'use strict';
// The in-memory store behaves like a Firestore transaction where it matters for the ops:
// all reads before any write, and nothing is written when the transaction throws.
const test = require('node:test');
const assert = require('node:assert/strict');
const { MemStore } = require('../src/memstore');

test('a read after a write in the same transaction throws, as in Firestore', async () => {
  const s = new MemStore();
  await assert.rejects(s.tx(async (t) => {
    t.setUser('u', { seen: 1 });
    await t.game('g');
  }), /reads before writes/);
});

test('a transaction that throws writes nothing', async () => {
  const s = new MemStore();
  await assert.rejects(s.tx(async (t) => {
    t.setUser('u', { seen: 1 });
    throw new Error('boom');
  }), /boom/);
  assert.equal(s.size(), 0);
});

test('stored documents are copies: changing a returned object does not change the store', async () => {
  const s = new MemStore();
  await s.tx(async (t) => { t.setGame('g', { uids: ['a', null], st: 'invited', t: 1, moves: [] }); });
  const g = await s.tx(async (t) => t.game('g'));
  g.moves.push('e4');
  assert.deepEqual(s.get('games', 'g').moves, []);
});

test('openCount counts invited and active games of a uid', async () => {
  const s = new MemStore();
  await s.tx(async (t) => {
    t.setGame('g1', { uids: ['a', null], st: 'invited', t: 1 });
    t.setGame('g2', { uids: ['a', 'b'], st: 'active', t: 2 });
    t.setGame('g3', { uids: ['a', 'b'], st: 'over', t: 3 });
    t.setGame('g4', { uids: ['c', null], st: 'invited', t: 4 });
    t.setInvite('CODE000001', { g: 'g1', by: 'a', exp: 9, expireAt: 9 });
  });
  const n = await s.tx(async (t) => t.openCount('a'));
  assert.equal(n, 2);
});

test('newGame refuses to overwrite an existing game (like Firestore create), and nothing is written', async () => {
  const s = new MemStore();
  await s.tx(async (t) => { t.newGame('g', { uids: ['a', null], st: 'invited', t: 1 }); });
  await assert.rejects(s.tx(async (t) => {
    t.setUser('u', { seen: 1 });
    t.newGame('g', { uids: ['b', null], st: 'invited', t: 2 });
  }), /already exists/);
  assert.deepEqual(s.get('games', 'g').uids, ['a', null]);
  assert.equal(s.get('users', 'u'), undefined);
});
