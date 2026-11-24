'use strict';
// The Firestore adapter's TTL field: ops use ms numbers, Firestore stores a Timestamp (needed for TTL policies).
const test = require('node:test');
const assert = require('node:assert/strict');
const { Timestamp } = require('firebase-admin/firestore');
const { toDoc, fromSnap } = require('../src/fsstore');

test('expireAt goes to Firestore as a Timestamp and comes back as ms; null stays null', () => {
  const d = toDoc({ st: 'invited', expireAt: 1_800_000_000_123, t: 5 });
  assert.ok(d.expireAt instanceof Timestamp);
  assert.equal(d.expireAt.toMillis(), 1_800_000_000_123);
  assert.equal(d.t, 5);
  assert.equal(toDoc({ st: 'active', expireAt: null }).expireAt, null);
  const back = fromSnap({ exists: true, data: () => ({ ...d }) });
  assert.equal(back.expireAt, 1_800_000_000_123);
  assert.equal(fromSnap({ exists: false }), null);
});
