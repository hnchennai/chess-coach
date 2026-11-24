'use strict';
// Strict input checks for the callable (tech spec section 6): a known op, only its own fields,
// the right types and short strings. Anything else fails with invalid-argument.
const { OpError } = require('./errors');
const { CODE_RE, GAME_RE } = require('./ids');
const { MAX_PLY } = require('./game');

const SQUARE = /^[a-h][1-8]$/;
const FCM_TOKEN = /^[A-Za-z0-9_:-]{1,4096}$/; // FCM registration token characters only

const str = (re) => (v) => typeof v === 'string' && re.test(v);
const oneOf = (...xs) => (v) => xs.includes(v);
const int = (min, max) => (v) => Number.isSafeInteger(v) && v >= min && v <= max;
const token = (v) => v === null || (typeof v === 'string' && FCM_TOKEN.test(v));

// field: [check, required]
const SPEC = {
  hello: { tok: [token, false] },
  invite: { col: [oneOf('w', 'b', 'r'), true] },
  peek: { code: [str(CODE_RE), true] },
  accept: { code: [str(CODE_RE), true] },
  move: {
    g: [str(GAME_RE), true],
    ply: [int(0, MAX_PLY - 1), true],
    from: [str(SQUARE), true],
    to: [str(SQUARE), true],
    promo: [oneOf('q', 'r', 'b', 'n'), false],
  },
  sync: { since: [int(0, Number.MAX_SAFE_INTEGER), true] },
  cancel: { g: [str(GAME_RE), true] },
};

function bad(why) {
  return new OpError('invalid-argument', why);
}

// Returns a clean copy of data (only known fields), or throws invalid-argument.
function validate(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) throw bad('data');
  const op = data.op;
  if (typeof op !== 'string' || !Object.prototype.hasOwnProperty.call(SPEC, op)) throw bad('op');
  const spec = SPEC[op];
  const out = { op };
  for (const k of Object.keys(data)) {
    if (k !== 'op' && !Object.prototype.hasOwnProperty.call(spec, k)) throw bad('field ' + k.slice(0, 20));
  }
  for (const [k, [check, required]] of Object.entries(spec)) {
    if (!Object.prototype.hasOwnProperty.call(data, k)) {
      if (required) throw bad('missing ' + k);
      continue;
    }
    if (!check(data[k])) throw bad('bad ' + k);
    out[k] = data[k];
  }
  return out;
}

module.exports = { validate, SPEC };
