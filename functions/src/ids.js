'use strict';
// Random ids from an injected byte source (crypto.randomBytes in production), and the per-pair opponent key.
const crypto = require('node:crypto');

const CROCKFORD = '0123456789ABCDEFGHJKMNPQRSTVWXYZ'; // 32 symbols: no I, L, O, U
const ALNUM = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'; // 62 symbols
const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{10}$/;
const GAME_RE = /^[A-Za-z0-9]{20}$/;
const IST_MS = (5 * 60 + 30) * 60 * 1000;

// Invite code: 10 Crockford base32 characters, 5 random bits each (50 bits). 256 is a multiple of 32, so no bias.
function newCode(rand) {
  const b = rand(10);
  let s = '';
  for (let i = 0; i < 10; i++) s += CROCKFORD[b[i] & 31];
  return s;
}

// Game id: 20 characters from 62, by rejection sampling (bytes 248 and up are dropped, so no bias).
function newGameId(rand) {
  let s = '';
  while (s.length < 20) {
    for (const x of rand(32)) {
      if (x < 248 && s.length < 20) s += ALNUM[x % 62];
    }
  }
  return s;
}

// true or false with equal chance
function coin(rand) {
  return (rand(1)[0] & 1) === 1;
}

// A stable key for "my opponent" that only makes sense to me: first 12 hex of sha256(oppUid + ':' + myUid)
function oppKey(oppUid, myUid) {
  return crypto.createHash('sha256').update(oppUid + ':' + myUid).digest('hex').slice(0, 12);
}

// The calendar day in India (Asia/Kolkata has no daylight saving), for the 20 invites a day limit
function istDay(ms) {
  return new Date(ms + IST_MS).toISOString().slice(0, 10);
}

module.exports = { CROCKFORD, CODE_RE, GAME_RE, newCode, newGameId, coin, oppKey, istDay };
