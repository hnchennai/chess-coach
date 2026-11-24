'use strict';
// Talks to the emulators the way the app will (tech spec section 3): Auth REST sign-up for an anonymous ID token,
// then POST { data: { op, ... } } to the callable with Authorization: Bearer. Run inside
// `firebase emulators:exec --only auth,firestore,functions --project demo-chess-coach`.
const PROJECT = process.env.GCLOUD_PROJECT || 'demo-chess-coach';
const AUTH_HOST = process.env.FIREBASE_AUTH_EMULATOR_HOST || '127.0.0.1:9099';
const FN_ORIGIN = process.env.FUNCTIONS_EMULATOR_ORIGIN || 'http://127.0.0.1:5001';
const FRIEND_URL = `${FN_ORIGIN}/${PROJECT}/asia-south1/friend`;

// A new anonymous player: { token, uid }
async function signUp() {
  const r = await fetch(`http://${AUTH_HOST}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=demo-api-key`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ returnSecureToken: true }),
  });
  const j = await r.json();
  if (!r.ok || !j.idToken || !j.localId) throw new Error('sign-up failed: ' + JSON.stringify(j));
  return { token: j.idToken, uid: j.localId };
}

// Returns { http, result } or { http, error: { status, message, details } } as the callable protocol answers
async function call(token, data) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = 'Bearer ' + token;
  const r = await fetch(FRIEND_URL, { method: 'POST', headers, body: JSON.stringify({ data }) });
  const text = await r.text();
  let j;
  try {
    j = JSON.parse(text);
  } catch (e) {
    throw new Error(`not JSON from the callable (HTTP ${r.status}): ${text.slice(0, 300)}`);
  }
  return { http: r.status, ...j };
}

// The call must succeed; returns its result
async function ok(token, data) {
  const r = await call(token, data);
  if (r.error || !('result' in r)) throw new Error(`${data.op} failed: ${JSON.stringify(r)}`);
  return r.result;
}

// The call must fail with this canonical status (e.g. FAILED_PRECONDITION) and message code
async function err(token, data, status, message) {
  const r = await call(token, data);
  if (!r.error) throw new Error(`${data.op} should fail with ${status}/${message}, got ${JSON.stringify(r)}`);
  if (r.error.status !== status || (message !== undefined && r.error.message !== message)) {
    throw new Error(`${data.op}: expected ${status}/${message}, got ${r.error.status}/${r.error.message}`);
  }
  return r.error;
}

module.exports = { PROJECT, FRIEND_URL, signUp, call, ok, err };
