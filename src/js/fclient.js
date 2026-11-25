/* ---------- Friend challenges (slice FC3): the client for the friend server. Network glue, loaded only inside the Android
   app (scripts/build.sh, as ads.js), so the web version never has it (FC-D4).
   Tech spec section 3, option C: no Firebase JS SDK. Anonymous sign-in over the Auth REST API (signUp once, then the stored
   refresh token), and the callable function "friend" over fetch with the documented protocol: POST { data: { op, ... } },
   answer { result } or { error: { status, message, details } }. No request is made until the player asks for something
   (Challenge, or a challenge link), and a sync never creates an ID (FC-D3). The device store is Friends.read/KEY.
   make() takes everything it uses (config, fetch, storage, clock), so tests/fclient.test.js runs it in Node with a fake fetch. ---------- */
(function (root, factory) {
  var F = typeof module === 'object' && module.exports ? require('./friends.js') : root.Friends;
  var C = factory(F);
  if (typeof module === 'object' && module.exports) module.exports = C; else root.FClient = C;
})(typeof window !== 'undefined' ? window : this, function (Friends) {
  'use strict';
  var EARLY = 60000;       /* refresh an ID token a minute before it expires */
  var SYNC_PAGES = 10;     /* a bound on one sync's paging chain (10 open games and 20 invites a day: a few pages) */
  var TIMEOUT = 20000;     /* a request that takes longer counts as offline */
  /* Auth answers for a refresh token that can never work again: the Auth user is gone. Any other failure keeps the ID. */
  var DEAD = ['TOKEN_EXPIRED', 'USER_NOT_FOUND', 'USER_DISABLED', 'INVALID_REFRESH_TOKEN'];

  function FcError(code, status, details) { var e = new Error(code); e.code = code; e.status = status || null; if (details) e.details = details; return e; }

  /* Real values only: a placeholder (FC-D24, before Suresh gives the Firebase config) never reaches a network */
  function configured(c) {
    if (!c) return false;
    var keys = ['projectId', 'apiKey', 'authBase', 'tokenBase', 'fnBase'];
    return keys.every(function (k) { return typeof c[k] === 'string' && c[k] && !/PLACEHOLDER/i.test(c[k]); });
  }
  function canon(s) { return typeof s === 'string' ? s.toLowerCase().replace(/_/g, '-') : null; }

  function make(o) {
    var cfg = o.config || {}, fetchFn = o.fetch, storage = o.storage, now = o.now || Date.now, ms = o.timeoutMs || TIMEOUT;
    var store = Friends.read(storage.get());
    var id = null; /* { tok, exp }: the ID token lives in memory only */
    var authP = null, syncP = null;

    function save() { try { storage.set(JSON.stringify(store)); } catch (e) {} }

    /* One request with a time limit. Resolves { status, body } (body null when it is not JSON); a network failure or the
       time limit rejects "offline". */
    function req(url, init) {
      return new Promise(function (resolve, reject) {
        var done = false, timer = setTimeout(function () { if (!done) { done = true; reject(FcError('offline')); } }, ms);
        var p;
        try { p = fetchFn(url, init); } catch (e) { p = Promise.reject(e); }
        Promise.resolve(p).then(function (r) {
          return r.json().then(function (b) { return b; }, function () { return null; }).then(function (b) { return { status: r.status, body: b }; });
        }).then(function (x) { if (!done) { done = true; clearTimeout(timer); resolve(x); } },
          function () { if (!done) { done = true; clearTimeout(timer); reject(FcError('offline')); } });
      });
    }

    function keep(tok, rt, expiresIn, uid) {
      var sec = +expiresIn > 0 ? +expiresIn : 3600;
      id = { tok: tok, exp: now() + sec * 1000 };
      store.rt = rt; store.uid = uid; save();
    }
    function forget() { id = null; store.uid = null; store.rt = null; store.since = 0; store.games = {}; save(); }

    function signUp() {
      return req(cfg.authBase + '/v1/accounts:signUp?key=' + encodeURIComponent(cfg.apiKey), {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true })
      }).then(function (r) {
        var b = r.body;
        if (r.status !== 200 || !b || typeof b.idToken !== 'string' || typeof b.refreshToken !== 'string' || typeof b.localId !== 'string') throw FcError('error');
        keep(b.idToken, b.refreshToken, b.expiresIn, b.localId);
      });
    }
    /* resolves true when there is a fresh ID token; false when the refresh token is dead (the store is then cleared) */
    function refresh() {
      return req(cfg.tokenBase + '/v1/token?key=' + encodeURIComponent(cfg.apiKey), {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: 'grant_type=refresh_token&refresh_token=' + encodeURIComponent(store.rt)
      }).then(function (r) {
        var b = r.body;
        if (r.status === 200 && b && typeof b.id_token === 'string' && typeof b.refresh_token === 'string') {
          keep(b.id_token, b.refresh_token, b.expires_in, typeof b.user_id === 'string' ? b.user_id : store.uid); return true;
        }
        var msg = b && b.error && typeof b.error.message === 'string' ? b.error.message.split(' ')[0].replace(/:$/, '') : '';
        if (r.status === 400 && DEAD.indexOf(msg) > -1) { forget(); return false; }
        throw FcError('error');
      });
    }
    /* A usable ID token. allowSignUp: a player's own action (Challenge, a link); a sync never signs up. */
    function auth(allowSignUp, force) {
      if (!force && id && now() < id.exp - EARLY) return Promise.resolve(true);
      if (authP) return authP;
      authP = (store.rt ? refresh() : Promise.resolve(false)).then(function (ok) {
        if (ok) return true;
        if (!allowSignUp) return false;
        return signUp().then(function () { return true; });
      });
      authP.then(function () { authP = null; }, function () { authP = null; });
      return authP;
    }

    function callOnce(data) {
      return req(cfg.fnBase + '/friend', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + id.tok }, body: JSON.stringify({ data: data })
      });
    }
    /* One op. Resolves the result (its games already in the store), or rejects with e.code: a server message code
       ('used', 'full', ...), 'offline', 'config' or 'error'. */
    function op(name, payload, opts) {
      if (!configured(cfg)) return Promise.reject(FcError('config'));
      var allow = !(opts && opts.signUp === false), data = { op: name };
      Object.keys(payload || {}).forEach(function (k) { data[k] = payload[k]; });
      var t0 = now();
      function attempt(retry) {
        return auth(allow, retry).then(function (ok) {
          if (!ok) return { none: true };
          return callOnce(data).then(function (r) {
            var b = r.body;
            if (r.status === 200 && b && b.result !== undefined) return { result: b.result };
            var err = b && b.error ? b.error : null, st = canon(err && err.status);
            if (st === 'unauthenticated' && !retry) return attempt(true);
            var details = err && err.details;
            if (details && details.games) { var sk = store.skew; Friends.apply(store, details.games, null, null); store.skew = sk; save(); }
            throw FcError(err && typeof err.message === 'string' && err.message ? err.message : 'error', st, details);
          });
        });
      }
      return attempt(false).then(function (x) {
        if (x.none) return null;
        var r = x.result;
        if (r && typeof r === 'object') {
          var skew = store.skew;
          Friends.apply(store, r.games, r.now, Math.round((t0 + now()) / 2));
          if (!(typeof r.now === 'number')) store.skew = skew;
          save();
        }
        return r;
      });
    }

    /* Play tab open and App resume (tech spec section 9). Only with an ID; sends only the server's own next. */
    function sync() {
      if (!store.uid || !store.rt) return null;
      if (syncP) return syncP;
      var pages = 0;
      function page() {
        var since = store.since;
        return op('sync', { since: since }, { signUp: false }).then(function (r) {
          if (!r) return null;
          if (typeof r.next === 'number' && r.next >= 0) { store.since = r.next; save(); }
          if (r.more && ++pages < SYNC_PAGES && store.since !== since) return page();
          return r;
        });
      }
      syncP = page();
      syncP.then(function () { syncP = null; }, function () { syncP = null; });
      return syncP;
    }

    return {
      store: function () { return store; },
      save: save,
      signedIn: function () { return !!(store.uid && store.rt); },
      op: op,
      sync: sync,
      setTest: function (on) { store.test = !!on; save(); },
      remember: function (code) { Friends.remember(store, code); save(); }
    };
  }

  return { make: make, configured: configured };
});
