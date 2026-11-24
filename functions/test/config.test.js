'use strict';
// Firestore config at the repo root: TTL policies (tech spec sections 5 and 14) and the indexes the jobs need.
// Shape as firebase-tools 15.35.0 validates it (lib/firestore/api.js validateField: collectionGroup, fieldPath,
// indexes required; ttl boolean).
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');

const cfg = require(path.join(__dirname, '..', '..', 'firestore.indexes.json'));

test('TTL on expireAt for games and invites, deployed with the indexes; expireAt itself is not single-field indexed', () => {
  const ttl = cfg.fieldOverrides.filter((f) => f.ttl === true);
  assert.deepEqual(ttl.map((f) => f.collectionGroup).sort(), ['games', 'invites']);
  for (const f of ttl) {
    assert.equal(f.fieldPath, 'expireAt');
    assert.deepEqual(f.indexes, []);
    assert.deepEqual(Object.keys(f).sort(), ['collectionGroup', 'fieldPath', 'indexes', 'ttl']);
  }
});

test('composite indexes for tick: (st, dl), (st, rem) and (st, expireAt) on games', () => {
  const has = (a, b) => cfg.indexes.some((i) => i.collectionGroup === 'games' && i.queryScope === 'COLLECTION'
    && i.fields.length === 2 && i.fields[0].fieldPath === a && i.fields[0].order === 'ASCENDING'
    && i.fields[1].fieldPath === b && i.fields[1].order === 'ASCENDING');
  assert.ok(has('st', 'dl'));
  assert.ok(has('st', 'rem'));
  assert.ok(has('st', 'expireAt'));
});
