'use strict';
// Chess Coach friend challenges: the callable "friend" (tech spec sections 2 and 6).
// FC1 ops: hello, invite, peek, accept, move, sync, cancel. Pushes are only recorded in the log here;
// FC2 replaces recordPush with Firebase Cloud Messaging.
const crypto = require('node:crypto');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { makeOps } = require('./src/ops');
const { FsStore } = require('./src/fsstore');
const { OpError } = require('./src/errors');

initializeApp();

// A push intent: { to: uid, t: 'move'|'over', g: gameId }. Logged without the uid.
async function recordPush(p) {
  logger.info('push intent', { t: p.t, g: p.g });
}

let ops = null;
function getOps() {
  if (!ops) {
    ops = makeOps({
      store: new FsStore(getFirestore()),
      now: Date.now,
      rand: crypto.randomBytes,
      push: recordPush,
      log: (...a) => logger.error(...a),
    });
  }
  return ops;
}

exports.friend = onCall({
  region: 'asia-south1',
  memory: '256MiB',
  cpu: 'gcf_gen1', // a fraction of a vCPU, needs concurrency 1
  concurrency: 1,
  maxInstances: 20, // the hard cost ceiling
  timeoutSeconds: 30,
  enforceAppCheck: false, // true from FC6
}, async (request) => {
  try {
    return await getOps().handle(request.auth, request.data);
  } catch (e) {
    if (e instanceof OpError) throw new HttpsError(e.status, e.message, e.details);
    logger.error('friend op failed', e && e.stack);
    throw new HttpsError('internal', 'internal');
  }
});
