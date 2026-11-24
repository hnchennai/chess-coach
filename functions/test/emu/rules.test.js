'use strict';
// Firestore rules (tech spec section 7): no client can read or write anything, signed in or not,
// player of the game or not. Uses @firebase/rules-unit-testing on the Firestore emulator.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { initializeTestEnvironment, assertFails, assertSucceeds } = require('@firebase/rules-unit-testing');
const {
  doc, getDoc, setDoc, updateDoc, deleteDoc, getDocs, collection, query, where, addDoc,
} = require('firebase/firestore');

const RULES = fs.readFileSync(path.join(__dirname, '..', '..', '..', 'firestore.rules'), 'utf8');
const ALICE = 'rules-alice';
const BOB = 'rules-bob';
const GAME = 'rulesGameAAAAAAAAAAA';
const CODE = 'RULES00001';
let env;

test.before(async () => {
  env = await initializeTestEnvironment({ projectId: process.env.GCLOUD_PROJECT || 'demo-chess-coach', firestore: { rules: RULES } });
  await env.withSecurityRulesDisabled(async (ctx) => {
    const db = ctx.firestore();
    await setDoc(doc(db, 'users', ALICE), { tok: 'tok-a', seen: 1, inv: { d: null, n: 0 } });
    await setDoc(doc(db, 'games', GAME), { uids: [ALICE, BOB], w: ALICE, b: BOB, st: 'active', moves: [], t: 1 });
    await setDoc(doc(db, 'invites', CODE), { g: GAME, by: ALICE, exp: 1 });
  });
});

test.after(async () => {
  if (env) await env.cleanup();
});

function contexts() {
  return [
    ['signed out', env.unauthenticatedContext()],
    ['a player (alice)', env.authenticatedContext(ALICE)],
    ['the other player (bob)', env.authenticatedContext(BOB)],
    ['a stranger', env.authenticatedContext('rules-stranger')],
  ];
}

test('the seeded documents exist (so the denials below are real)', async () => {
  await env.withSecurityRulesDisabled(async (ctx) => {
    await assertSucceeds(getDoc(doc(ctx.firestore(), 'games', GAME)));
    assert.equal((await getDoc(doc(ctx.firestore(), 'games', GAME))).exists(), true);
  });
});

test('every client read is denied: get, list and queries on every collection', async () => {
  for (const [, ctx] of contexts()) {
    const db = ctx.firestore();
    await assertFails(getDoc(doc(db, 'games', GAME)));
    await assertFails(getDoc(doc(db, 'users', ALICE)));
    await assertFails(getDoc(doc(db, 'invites', CODE)));
    await assertFails(getDoc(doc(db, 'other', 'x')));
    await assertFails(getDocs(collection(db, 'games')));
    await assertFails(getDocs(collection(db, 'users')));
    await assertFails(getDocs(collection(db, 'invites')));
    await assertFails(getDocs(query(collection(db, 'games'), where('uids', 'array-contains', ALICE))));
  }
});

test('every client write is denied: create, update, delete on every collection', async () => {
  for (const [, ctx] of contexts()) {
    const db = ctx.firestore();
    await assertFails(setDoc(doc(db, 'games', 'newGameAAAAAAAAAAAAA'), { uids: [ALICE, null], st: 'invited' }));
    await assertFails(updateDoc(doc(db, 'games', GAME), { moves: ['e4'] }));
    await assertFails(deleteDoc(doc(db, 'games', GAME)));
    await assertFails(setDoc(doc(db, 'users', ALICE), { tok: 'stolen' }));
    await assertFails(updateDoc(doc(db, 'users', ALICE), { tok: 'stolen' }));
    await assertFails(deleteDoc(doc(db, 'users', ALICE)));
    await assertFails(setDoc(doc(db, 'invites', 'RULES00002'), { g: GAME, by: ALICE, exp: 1 }));
    await assertFails(deleteDoc(doc(db, 'invites', CODE)));
    await assertFails(addDoc(collection(db, 'anything'), { a: 1 }));
  }
});
