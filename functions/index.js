'use strict';
// Chess Coach friend challenges (tech spec sections 2, 4 and 6): the callable "friend" with all its ops, and the
// scheduled jobs "tick" (every 15 minutes) and "daily" (03:30 India time). Pushes go out through Firebase Cloud
// Messaging; under the emulator they are only logged, so no test ever reaches real FCM.
const crypto = require('node:crypto');
const { onCall } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const logger = require('firebase-functions/logger');
const { initializeApp } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');
const { getMessaging } = require('firebase-admin/messaging');
const { getAuth } = require('firebase-admin/auth');
const { makeOps } = require('./src/ops');
const { makeJobs, makeAuthDeleter, makeAuthLastActive } = require('./src/jobs');
const { makePushSender } = require('./src/push');
const { FsStore } = require('./src/fsstore');
const { makeHandler } = require('./src/callable');

initializeApp();

const logError = (...a) => logger.error(...a);

// Under the Functions emulator nothing is sent: the message type is logged instead
const emulatorMessaging = {
  send: async (m) => {
    logger.info('push not sent (emulator)', { t: m.data.t });
    return 'emulator';
  },
};

let deps = null;
function getDeps() {
  if (!deps) {
    const store = new FsStore(getFirestore());
    const messaging = process.env.FUNCTIONS_EMULATOR === 'true' ? emulatorMessaging : getMessaging();
    deps = {
      store,
      now: Date.now,
      push: makePushSender({ store, messaging, log: logError }),
      log: logError,
      deleteAuthUser: makeAuthDeleter(getAuth()),
    };
  }
  return deps;
}

let ops = null;
function getOps() {
  if (!ops) ops = makeOps({ ...getDeps(), rand: crypto.randomBytes });
  return ops;
}

let jobs = null;
function getJobs() {
  if (!jobs) jobs = makeJobs({ ...getDeps(), authLastActive: makeAuthLastActive(getAuth()) });
  return jobs;
}

const REGION = 'asia-south1';
const COST = {
  region: REGION,
  memory: '256MiB',
  cpu: 'gcf_gen1', // a fraction of a vCPU, needs concurrency 1
  concurrency: 1,
};

exports.friend = onCall({
  ...COST,
  maxInstances: 20, // the hard cost ceiling
  timeoutSeconds: 30,
  enforceAppCheck: false, // true from FC6
}, makeHandler(getOps, logError));

// Scheduled jobs: one instance, no retries (the next run picks up anything left), a bounded amount of work per run
const JOB = {
  ...COST,
  timeZone: 'Asia/Kolkata',
  maxInstances: 1,
  timeoutSeconds: 120,
  retryCount: 0,
};

exports.tick = onSchedule({ ...JOB, schedule: '*/15 * * * *' }, async () => {
  logger.info('tick', await getJobs().tick()); // counts only
});

exports.daily = onSchedule({ ...JOB, schedule: '30 3 * * *' }, async () => {
  logger.info('daily', await getJobs().daily()); // counts only
});
