'use strict';
// The deployed callable: one function "friend" with the settings of tech spec section 2,
// and op errors turned into callable errors (status + message code). Needs no emulator: the calls below
// fail validation before any database access.
const test = require('node:test');
const assert = require('node:assert/strict');

process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || 'demo-chess-coach';
const { friend, tick, daily } = require('../index');
const { HttpsError } = require('firebase-functions/v2/https');

test('one callable "friend" in asia-south1 with the cost settings', () => {
  const ep = friend.__endpoint;
  assert.ok(ep.callableTrigger, 'callable');
  assert.deepEqual(ep.region, ['asia-south1']);
  assert.equal(ep.availableMemoryMb, 256);
  assert.equal(ep.cpu, 'gcf_gen1');
  assert.equal(ep.concurrency, 1);
  assert.equal(ep.maxInstances, 20);
  assert.equal(ep.timeoutSeconds, 30);
});

test('App Check is not enforced yet (FC6 turns it on)', () => {
  assert.notEqual(friend.__endpoint.callableTrigger.enforceAppCheck, true);
});

test('no auth gives an unauthenticated callable error', async () => {
  await assert.rejects(friend.run({ data: { op: 'hello' }, rawRequest: {} }), (e) => {
    assert.ok(e instanceof HttpsError);
    assert.equal(e.code, 'unauthenticated');
    return true;
  });
});

test('bad input gives invalid-argument, with the reason as the message', async () => {
  await assert.rejects(friend.run({ auth: { uid: 'u1' }, data: { op: 'hello', name: 'Priya' }, rawRequest: {} }), (e) => {
    assert.ok(e instanceof HttpsError);
    assert.equal(e.code, 'invalid-argument');
    assert.equal(e.message, 'field name');
    return true;
  });
});

test('tick: every 15 minutes in India time, asia-south1, the cost settings, one instance, no retries', () => {
  const ep = tick.__endpoint;
  assert.deepEqual(ep.scheduleTrigger.schedule, '*/15 * * * *');
  assert.equal(ep.scheduleTrigger.timeZone, 'Asia/Kolkata');
  assert.equal(ep.scheduleTrigger.retryConfig.retryCount, 0);
  assert.deepEqual(ep.region, ['asia-south1']);
  assert.equal(ep.availableMemoryMb, 256);
  assert.equal(ep.cpu, 'gcf_gen1');
  assert.equal(ep.concurrency, 1);
  assert.equal(ep.maxInstances, 1);
  assert.equal(ep.timeoutSeconds, 120);
});

test('daily: 03:30 India time, asia-south1, the cost settings, one instance, no retries', () => {
  const ep = daily.__endpoint;
  assert.deepEqual(ep.scheduleTrigger.schedule, '30 3 * * *');
  assert.equal(ep.scheduleTrigger.timeZone, 'Asia/Kolkata');
  assert.equal(ep.scheduleTrigger.retryConfig.retryCount, 0);
  assert.deepEqual(ep.region, ['asia-south1']);
  assert.equal(ep.availableMemoryMb, 256);
  assert.equal(ep.cpu, 'gcf_gen1');
  assert.equal(ep.concurrency, 1);
  assert.equal(ep.maxInstances, 1);
  assert.equal(ep.timeoutSeconds, 120);
});

test('only these three functions are exported', () => {
  assert.deepEqual(Object.keys(require('../index')).sort(), ['daily', 'friend', 'tick']);
});
