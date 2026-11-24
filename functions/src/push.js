'use strict';
// Push sending (tech spec section 4; FC-D14, criterion 4). Ops and jobs hand over intents { to: uid, t, g };
// this looks up the recipient's token and sends one FCM message through the Admin SDK messaging (passed in, so
// tests use a recording fake). Only the four types below are ever sent. A token FCM no longer accepts is deleted
// from the user doc. Sending never throws, and logs carry the type, game id and error code only (no uid, no token).

// Generic text: the server knows no names (FC-D5, FC-D14). No em dashes (constitution).
const BODIES = Object.freeze({
  move: 'Your move in a friend game',
  draw: 'Your friend offers a draw',
  remind: '1 day left for your move in a friend game',
  over: 'A friend game has ended',
});

// FCM errors that mean the stored token is no good. invalid-argument is included because the rest of the message
// is fixed, so a bad token is its only likely cause.
const DEAD_TOKEN = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

const known = (t) => typeof t === 'string' && Object.prototype.hasOwnProperty.call(BODIES, t);

// One notification per game on the phone (tag = game id, the newest wins), on the "friend" channel
function message(token, t, g) {
  if (!known(t)) throw new Error('unknown push type');
  return {
    token,
    notification: { title: 'Chess Coach', body: BODIES[t] },
    data: { t, g },
    android: { priority: 'high', notification: { channelId: 'friend', tag: g } },
  };
}

function makePushSender({ store, messaging, log = console.error }) {
  // Returns true when FCM took the message
  return async function send(p) {
    if (!p || !known(p.t) || typeof p.g !== 'string' || typeof p.to !== 'string' || !p.to || p.to === 'x') return false;
    const info = { t: p.t, g: p.g };
    try {
      const u = await store.getUser(p.to);
      const tok = u && u.tok;
      if (!tok) return false;
      try {
        await messaging.send(message(tok, p.t, p.g));
        return true;
      } catch (e) {
        const code = e && e.code;
        if (!DEAD_TOKEN.has(code)) {
          log('push failed', { ...info, code });
          return false;
        }
        // Delete it only if it is still the stored token (the app may have sent a new one meanwhile), and never
        // bring back a user doc that was deleted meanwhile
        await store.tx(async (t) => {
          const cur = await t.user(p.to);
          if (cur && cur.tok === tok) t.setUser(p.to, { ...cur, tok: null });
        });
        log('push token dropped', { ...info, code });
        return false;
      }
    } catch (e) {
      log('push failed', { ...info, code: e && e.code });
      return false;
    }
  };
}

module.exports = { makePushSender, message, BODIES };
