'use strict';
// Push sending through the Admin SDK messaging (tech spec section 4; FC-D14, criterion 4), with a recording fake.
const test = require('node:test');
const assert = require('node:assert/strict');
const { MemStore } = require('../src/memstore');
const { makePushSender, BODIES, message } = require('../src/push');

const U = 'uid-alice-000000000001';
const G = 'abcdefghijABCDEFGHIJ';
const TOK = 'fGx1-ab_c:APA91bH-x_Y';

function kit(sendImpl) {
  const store = new MemStore();
  const sent = [];
  const logs = [];
  const messaging = {
    send: async (m) => {
      sent.push(m);
      if (sendImpl) return sendImpl(m);
      return 'projects/p/messages/1';
    },
  };
  const push = makePushSender({ store, messaging, log: (...a) => logs.push(a) });
  store.put('users', U, { tok: TOK, seen: 1, inv: { d: null, n: 0 } });
  return { store, sent, logs, push };
}

function fcmError(code) {
  const e = new Error('Requested entity was not found. token ' + TOK);
  e.code = code;
  return e;
}

test('the four bodies, exactly; generic, no names, no em dashes', () => {
  assert.deepEqual(BODIES, {
    move: 'Your move in a friend game',
    draw: 'Your friend offers a draw',
    remind: '1 day left for your move in a friend game',
    over: 'A friend game has ended',
  });
  for (const b of Object.values(BODIES)) assert.ok(!/[\u2013\u2014]/.test(b));
});

test('message shape: notification, data { t, g }, high priority on the "friend" channel, tagged by game', () => {
  assert.deepEqual(message(TOK, 'move', G), {
    token: TOK,
    notification: { title: 'Chess Coach', body: 'Your move in a friend game' },
    data: { t: 'move', g: G },
    android: { priority: 'high', notification: { channelId: 'friend', tag: G } },
  });
});

test('each push type goes to the stored token of the recipient', async () => {
  const k = kit();
  for (const t of ['move', 'draw', 'remind', 'over']) await k.push({ to: U, t, g: G });
  assert.deepEqual(k.sent.map((m) => [m.token, m.data.t, m.notification.body]), [
    [TOK, 'move', BODIES.move], [TOK, 'draw', BODIES.draw], [TOK, 'remind', BODIES.remind], [TOK, 'over', BODIES.over],
  ]);
});

test('criterion 4: nothing else is ever sent', async () => {
  const k = kit();
  for (const t of ['hello', 'invite', 'decline', 'expired', '', undefined]) await k.push({ to: U, t, g: G });
  assert.deepEqual(k.sent, []);
  assert.throws(() => message(TOK, 'chat', G));
});

test('no user, no token, or a deleted player ("x"): nothing is sent', async () => {
  const k = kit();
  await k.push({ to: 'uid-nobody-00000000009', t: 'move', g: G });
  await k.push({ to: 'x', t: 'over', g: G });
  await k.push({ to: null, t: 'over', g: G });
  k.store.put('users', U, { tok: null, seen: 1, inv: { d: null, n: 0 } });
  await k.push({ to: U, t: 'move', g: G });
  assert.deepEqual(k.sent, []);
});

test('a token FCM no longer knows is deleted from the user doc (not registered, invalid token, invalid argument)', async () => {
  for (const code of ['messaging/registration-token-not-registered', 'messaging/invalid-registration-token', 'messaging/invalid-argument']) {
    const k = kit(() => { throw fcmError(code); });
    await k.push({ to: U, t: 'move', g: G });
    const u = k.store.get('users', U);
    assert.equal(u.tok, null, code);
    assert.equal(u.seen, 1, 'the rest of the user doc stays');
  }
});

test('other errors keep the token; sending never throws', async () => {
  const k = kit(() => { throw fcmError('messaging/internal-error'); });
  await k.push({ to: U, t: 'move', g: G });
  assert.equal(k.store.get('users', U).tok, TOK);
  assert.equal(k.logs.length, 1);
});

test('a token replaced while the push was in flight is not deleted', async () => {
  let k;
  k = kit(() => {
    k.store.put('users', U, { tok: 'new-token-1', seen: 2, inv: { d: null, n: 0 } });
    throw fcmError('messaging/registration-token-not-registered');
  });
  await k.push({ to: U, t: 'move', g: G });
  assert.equal(k.store.get('users', U).tok, 'new-token-1');
});

test('a user deleted while the push was in flight is not brought back', async () => {
  let k;
  k = kit(() => {
    k.store.data.users.delete(U);
    throw fcmError('messaging/registration-token-not-registered');
  });
  await k.push({ to: U, t: 'move', g: G });
  assert.equal(k.store.get('users', U), undefined);
});

test('logs never carry a uid or a token', async () => {
  const k = kit(() => { throw fcmError('messaging/registration-token-not-registered'); });
  await k.push({ to: U, t: 'move', g: G });
  const k2 = kit(() => { throw fcmError('messaging/server-unavailable'); });
  await k2.push({ to: U, t: 'over', g: G });
  const text = JSON.stringify([k.logs, k2.logs]);
  assert.ok(k.logs.length + k2.logs.length >= 1);
  assert.ok(!text.includes(U), text);
  assert.ok(!text.includes(TOK), text);
  assert.ok(!text.includes('APA91'), text);
});
