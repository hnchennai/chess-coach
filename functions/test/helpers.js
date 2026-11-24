'use strict';
// Test kit: the ops on the in-memory store, with a fake clock, repeatable randomness and a push recorder.
const crypto = require('node:crypto');
const { makeOps } = require('../src/ops');
const { MemStore } = require('../src/memstore');
const { makeJobs } = require('../src/jobs');

const T0 = Date.UTC(2026, 10, 24, 6, 0, 0); // 24 Nov 2026, 11:30 IST
const DAY = 24 * 60 * 60 * 1000;

function seededRand(seed) {
  let n = 0;
  return (len) => {
    const out = Buffer.alloc(len);
    let filled = 0;
    while (filled < len) {
      const h = crypto.createHash('sha256').update(seed + ':' + n++).digest();
      filled += h.copy(out, filled, 0, Math.min(h.length, len - filled));
    }
    return out;
  };
}

function setup(opts = {}) {
  const clock = { t: opts.t0 || T0 };
  const pushes = [];
  const store = new MemStore();
  const logs = [];
  const authDeleted = [];
  const deps = {
    store,
    now: () => clock.t,
    rand: opts.rand || seededRand(opts.seed || 'fc1'),
    push: opts.push || (async (p) => { pushes.push(p); }),
    log: (...a) => logs.push(a),
    deleteAuthUser: opts.deleteAuthUser || (async (uid) => { authDeleted.push(uid); }),
  };
  const authLastActive = opts.authLastActive || (async () => null); // no recent sign-in or token refresh
  const ops = makeOps({ ...deps, syncMax: opts.syncMax, deletePage: opts.deletePage });
  const jobs = makeJobs({ ...deps, authLastActive, page: opts.page, max: opts.max });
  const call = (uid, data) => ops.handle(uid ? { uid } : null, data);
  return { ops, jobs, store, clock, pushes, logs, authDeleted, call };
}

// A started game: a invites as White (or col), b accepts. Pushes so far are cleared. Returns the game id.
async function startGame(s, a, b, col = 'w') {
  const inv = await s.call(a, { op: 'invite', col });
  await s.call(b, { op: 'accept', code: inv.code });
  s.pushes.length = 0;
  return inv.games[0].id;
}

// Expect an OpError with this status (and message code)
async function fails(promise, status, message) {
  try {
    await promise;
  } catch (e) {
    if (e.status !== status || (message !== undefined && e.message !== message)) {
      throw new Error(`expected ${status}/${message}, got ${e.status}/${e.message}`);
    }
    return e;
  }
  throw new Error(`expected ${status}/${message}, but the call succeeded`);
}

// Every string anywhere inside a value
function strings(v, out = []) {
  if (typeof v === 'string') out.push(v);
  else if (Array.isArray(v)) v.forEach((x) => strings(x, out));
  else if (v && typeof v === 'object') Object.values(v).forEach((x) => strings(x, out));
  return out;
}

const sha12 = (a, b) => crypto.createHash('sha256').update(a + ':' + b).digest('hex').slice(0, 12);

module.exports = { T0, DAY, setup, startGame, fails, strings, seededRand, sha12 };
