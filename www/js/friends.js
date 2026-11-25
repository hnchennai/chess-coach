/* ---------- Friend challenges (slice FC3): the device store, invite links, the rows on Play and the launch switch.
   Pure: no DOM, no plugin, no network, no clock (the app passes the time). Decisions: docs/specs/friend-challenges.product.md
   (FC-D1 to FC-D24, Wording) and friend-challenges.tech.md sections 8 and 9. The network glue is fclient.js (Android app only);
   the UI glue is in app.js (search "FRIENDS GLUE"). On the web this file is loaded but nothing in it is ever acted on (FC-D4). ---------- */
(function (root, factory) {
  var F = factory();
  if (typeof module === 'object' && module.exports) module.exports = F; else root.Friends = F;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  /* THE LAUNCH SWITCH (tech spec section 0). Off until slice FC6 and the Play forms are done; turning it on is a checkpoint
     (Suresh's yes). While it is off only a test build's "Friend games (test)" toggle shows the feature. */
  var CONFIG = Object.freeze({ live: false });
  /* Device only, never in the profile or the cloud save (FC-D3, FC-D29): the ID, the games, and the nicknames and records per
     friend. A new phone or a reinstall starts with a new ID, unless Android restores the app's backup (FC-D30). */
  var KEY = 'suresh-chess-coach.friends.v1';
  var MAX_OPEN = 10; /* FC-D12 */
  var NICK_MAX = 20;
  var HOST = 'hnchennai.github.io', PATH = '/c/';
  var CODE_RE = /^[0-9A-HJKMNP-TV-Z]{10}$/;  /* 10 Crockford base32 characters (functions/src/ids.js) */
  var GAME_RE = /^[A-Za-z0-9]{20}$/;
  var OPP_RE = /^[0-9a-f]{12}$/;
  var SQ_RE = /^[a-h][1-8]$/;
  var DAY = 86400000, HOUR = 3600000;
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var LINKS_KEPT = 10;
  var REPLAY_MS = 120000; /* fix 2: the same launch link again within 2 minutes is an activity recreate, not a new tap */

  /* FC-D23, FC-D25: the approved wording (Suresh, 2026-11-25), letter for letter. Lines marked "proposed" are listed in the
     product spec's Wording section and wait for his approval. No em dashes. */
  var COPY = Object.freeze({
    card: 'Friend games',
    challenge: 'Challenge a friend',
    full: 'You have 10 friend games open. Finish one to start another.',
    playAs: 'Play as', white: 'White', black: 'Black', random: 'Random',
    share: 'Share link',
    shareText: 'Play chess with me in Chess Coach: ',
    yourMove: 'Your move', theirMove: 'Their move', waiting: 'Waiting for your friend', until: 'until ', notSent: 'Not sent yet',
    friend: 'Friend',
    acceptTitle: 'A friend challenges you', youPlay: 'You play ',
    nameLabel: 'Name your friend', nameHint: 'optional, stays on this phone',
    accept: 'Accept', notNow: 'Not now',
    invalid: 'This challenge is no longer valid.',
    offline: 'Friend games need the internet. Try again when you are online.',
    cancel: 'Cancel invite', /* FC-D18 */
    setting: 'Friend games (test)',
    /* FC-D25 (approved 2026-11-25): */
    randomCol: 'Your colour is picked at random.',
    own: 'This is your own challenge. Send the link to a friend.',
    limit: 'You have sent 20 challenges today. Try again tomorrow.',
    error: 'Something went wrong. Please try again.',
    close: 'Close',
    left: { none: 'no time left', underHour: 'under 1 hour left', hour: ' hour left', hours: ' hours left', days: ' days left' },
    /* FC-D31 (approved 2026-11-25): what the busy state says (a live region) while a call runs */
    busy: 'One moment.',
    /* FC4, proposed (not yet approved; listed in the product spec's Wording section): the friend board, its controls, draw
       offers, the name sheet, the history row and the end card. Reuses the app's own lines where they fit. */
    board: 'Friend game', vs: ' vs ',
    resign: 'Resign', resignAsk: 'Resign this game?', keep: 'Keep playing',
    offerDraw: 'Offer draw', decline: 'Decline',
    drawOffered: 'Your friend offers a draw.', drawSent: 'You offered a draw.', drawLater: 'You can offer a draw again after your next move.',
    save: 'Save',
    rvTitle: 'Your friend\u2019s move', rvPlayed: 'Your friend played ', rvText: 'Here is what the move does.',
    histVs: 'vs ', histTag: ' (friend)', histFriend: 'vs a friend',
    winTitle: 'You win!', mateWin: 'Checkmate. You win!', mateLoss: 'Checkmate', resigned: 'You resigned', outOfTime: 'Out of time', draw: 'Draw', stalemate: 'Stalemate',
    winText: 'Great finish. Review it.', lossText: 'Your friend wins this one. Review it to find the turning point.',
    why: { resign: 'Your friend resigned.', time: 'Your friend ran out of time.', abandoned: 'Your friend left the game.', agreed: 'You both agreed to a draw.',
      stalemate: 'No legal moves and no check, so it\u2019s a draw.', repetition: 'The same position came up three times.', fifty: '50 moves without a capture or pawn move.',
      material: 'Not enough pieces left to checkmate.', cap: 'The game reached the move limit.' }
  });

  function isObj(x) { return !!x && typeof x === 'object' && !Array.isArray(x); }
  function num(x) { return typeof x === 'number' && isFinite(x); }

  /* col: the colour picked last in the Challenge sheet (FC-D27); launch: the last launch link shown and when (fix 2);
     friends: { <opp>: { n: nickname, t: ms, res: { <gameId>: 'w'|'l'|'d' } } } (FC-D29; FC4 fills res) */
  function blank() { return { v: 1, uid: null, rt: null, tok: null, since: 0, skew: 0, test: false, col: 'r', launch: null, links: [], friends: {}, games: {} }; }

  function normFriend(x) {
    var res = {}, r = isObj(x.res) ? x.res : {};
    Object.keys(r).forEach(function (g) { if (r[g] === 'w' || r[g] === 'l' || r[g] === 'd') res[g] = r[g]; });
    var t = +x.t;
    return { n: nick(x.n), t: t > 0 && isFinite(t) ? t : 0, res: res };
  }

  /* One game as the app keeps it: the server's view (functions/src/ops.js view()) plus pend (FC4's unsent move). null if broken. */
  function normGame(id, g) {
    if (!GAME_RE.test(id) || !isObj(g)) return null;
    var st = g.st, me = g.me;
    if (st !== 'invited' && st !== 'active' && st !== 'over') return null;
    if (me !== 'w' && me !== 'b' && me !== 'r') return null;
    if (!Array.isArray(g.moves) || !g.moves.every(function (m) { return typeof m === 'string' && m.length > 0 && m.length < 10; })) return null;
    if (!num(g.v) || !num(g.t)) return null;
    var p = g.pend, pend = null;
    if (isObj(p) && num(p.ply) && p.ply >= 0 && SQ_RE.test(p.from) && SQ_RE.test(p.to) && num(p.t)) {
      pend = { ply: p.ply, from: p.from, to: p.to, t: p.t };
      if (p.promo === 'q' || p.promo === 'r' || p.promo === 'b' || p.promo === 'n') pend.promo = p.promo;
    }
    var dp = num(g.dp) && g.dp >= 0 && g.dp === Math.floor(g.dp) ? g.dp : null; /* FC4: the ply count at my last draw offer (as the server's drawPly) */
    var res = isObj(g.res) && (g.res.r === 'w' || g.res.r === 'b' || g.res.r === 'd' || g.res.r === null) && typeof g.res.why === 'string' ? { r: g.res.r, why: g.res.why } : null;
    return {
      id: id, me: me, opp: typeof g.opp === 'string' && OPP_RE.test(g.opp) ? g.opp : null, st: st, moves: g.moves.slice(),
      dl: num(g.dl) ? g.dl : null, draw: g.draw === 'w' || g.draw === 'b' ? g.draw : null, res: res, v: g.v, t: g.t,
      exp: num(g.exp) ? g.exp : null, code: typeof g.code === 'string' && CODE_RE.test(g.code) ? g.code : null, pend: pend, dp: dp
    };
  }

  /* The store from its stored string (or an object). Anything missing or broken reads as blank, field by field; a broken
     game is dropped. Never throws. */
  function read(raw) {
    var o = null;
    if (isObj(raw)) o = raw;
    else { try { o = typeof raw === 'string' && raw ? JSON.parse(raw) : null; } catch (e) { o = null; } }
    var s = blank();
    if (!isObj(o)) return s;
    if (typeof o.uid === 'string' && o.uid) s.uid = o.uid;
    if (typeof o.rt === 'string' && o.rt) s.rt = o.rt;
    if (typeof o.tok === 'string' && o.tok) s.tok = o.tok;
    if (num(o.since) && o.since >= 0) s.since = o.since;
    if (num(o.skew)) s.skew = o.skew;
    s.test = o.test === true;
    if (o.col === 'w' || o.col === 'b' || o.col === 'r') s.col = o.col;
    if (isObj(o.launch) && typeof o.launch.url === 'string' && o.launch.url.length <= 2000 && num(o.launch.t)) s.launch = { url: o.launch.url, t: o.launch.t };
    if (isObj(o.friends)) Object.keys(o.friends).forEach(function (k) { if (OPP_RE.test(k) && isObj(o.friends[k])) s.friends[k] = normFriend(o.friends[k]); });
    if (Array.isArray(o.links)) s.links = o.links.filter(function (c) { return typeof c === 'string' && CODE_RE.test(c); }).slice(-LINKS_KEPT);
    if (isObj(o.games)) Object.keys(o.games).forEach(function (id) { var g = normGame(id, o.games[id]); if (g) s.games[id] = g; });
    return s;
  }

  /* Server answers go into the store: answers overlap, so per game the higher v wins (tech spec section 6, sync).
     serverNow and localNow give the skew between the phone's clock and the server's (section 9, clocks). */
  function apply(s, games, serverNow, localNow) {
    (Array.isArray(games) ? games : []).forEach(function (v) {
      if (!isObj(v) || typeof v.id !== 'string') return;
      var g = normGame(v.id, v); if (!g) return;
      var old = s.games[g.id];
      if (old && old.v > g.v) return;
      /* FC4: the move waiting to be sent stays only while the server's game is still active and does not have it yet (my
         turn at that ply); anything else (the move arrived, the game ended) drops it. dp is this phone's own (the view has none). */
      g.pend = old && keepsPend(g, old.pend) ? old.pend : null;
      g.dp = old ? old.dp : null;
      s.games[g.id] = g;
    });
    s.skew = num(serverNow) && num(localNow) ? serverNow - localNow : 0;
    return s;
  }

  /* The invite link (orchestrator's decision for tech spec open question 4): served with HTTP 200 by c/index.html on the
     website, the code in the query so the page and Android's intent fallback can both read it. */
  function link(code) {
    if (!CODE_RE.test(code)) throw new Error('bad invite code');
    return 'https://' + HOST + PATH + '?c=' + code;
  }
  function shareText(code) { return COPY.shareText + link(code); }

  /* Only https://hnchennai.github.io/c/?c=<code>: no other scheme, host, port, user, path, or a second code. Returns the code or null. */
  function parseLink(url) {
    if (typeof url !== 'string' || url.length > 2000) return null;
    var m = /^https:\/\/([^/?#]+)(\/[^?#]*)?(\?[^#]*)?(#.*)?$/i.exec(url);
    if (!m || m[1].toLowerCase() !== HOST || m[2] !== PATH || !m[3]) return null;
    var found = null, n = 0;
    m[3].slice(1).split('&').forEach(function (kv) {
      var i = kv.indexOf('='), k = i < 0 ? kv : kv.slice(0, i);
      if (k === 'c') { n++; found = i < 0 ? '' : kv.slice(i + 1); }
    });
    return n === 1 && CODE_RE.test(found) ? found : null;
  }

  /* Tech spec section 9: the feature shows only in the Android app, and only with the launch switch on or the test toggle. */
  function available(o) {
    if (!isObj(o) || o.native !== true) return false;
    return (o.live === undefined ? CONFIG.live : o.live === true) || o.test === true;
  }

  function isOpen(g) { return g.st === 'invited' || g.st === 'active'; }
  function openCount(s) { return Object.keys(s.games).filter(function (id) { return isOpen(s.games[id]); }).length; }
  function canChallenge(s) { return openCount(s) < MAX_OPEN; }
  function turnOf(g) { return g.moves.length % 2 === 0 ? 'w' : 'b'; }

  /* FC-D26: time left never overstates. From 48 hours: whole days rounded down; under 48 hours: whole hours rounded down;
     then "under 1 hour left"; then "no time left". */
  function timeLeft(ms) {
    var L = COPY.left;
    if (!(ms > 0)) return L.none;
    if (ms >= 2 * DAY) return Math.floor(ms / DAY) + L.days;
    if (ms >= HOUR) { var h = Math.floor(ms / HOUR); return h + (h === 1 ? L.hour : L.hours); }
    return L.underHour;
  }
  function dayMonth(ms) { var d = new Date(ms); return d.getDate() + ' ' + MONTHS[d.getMonth()]; }

  /* A row's line. now: the phone's clock; skew: server minus phone (store.skew), so time left counts in server time. */
  function stateLine(g, now, skew) {
    var t = now + (num(skew) ? skew : 0);
    if (g.st === 'invited') return COPY.waiting + (g.exp != null ? ', ' + COPY.until + dayMonth(g.exp) : '');
    if (g.pend) return COPY.notSent;
    if (turnOf(g) === g.me) return COPY.yourMove + (g.dl != null ? ', ' + timeLeft(g.dl - t) : '');
    return COPY.theirMove;
  }

  function recordText(res) {
    var n = { w: 0, l: 0, d: 0 };
    if (isObj(res)) Object.keys(res).forEach(function (k) { if (n[res[k]] !== undefined) n[res[k]]++; });
    return 'W ' + n.w + ' · L ' + n.l + ' · D ' + n.d;
  }

  function nick(s) {
    if (typeof s !== 'string') return '';
    return Array.from(s.replace(/[\u0000-\u001f\u007f]/g, '').trim()).slice(0, NICK_MAX).join('').trim();
  }
  function youPlay(c) { return c === 'w' ? COPY.youPlay + COPY.white : c === 'b' ? COPY.youPlay + COPY.black : COPY.randomCol; }

  /* The rows on Play's card: open games only (a finished game goes to the history in FC4). Your move first (least time
     first), then their move, then invites (soonest expiry first). Names and records from s.friends (FC-D29). */
  function rows(s, now) {
    var f = isObj(s.friends) ? s.friends : {}, list = [];
    Object.keys(s.games).forEach(function (id) {
      var g = s.games[id]; if (!isOpen(g)) return;
      var kind = g.st === 'invited' ? 'invite' : turnOf(g) === g.me && !g.pend ? 'mine' : 'theirs';
      var fr = g.opp && isObj(f[g.opp]) ? f[g.opp] : null;
      list.push({ id: id, kind: kind, name: fr && fr.n ? fr.n : COPY.friend, line: stateLine(g, now, s.skew),
        record: g.opp ? recordText(fr && fr.res) : null, code: g.code, me: g.me, key: kind === 'invite' ? g.exp || 0 : g.dl || 0, needsName: needsName(s, g) });
    });
    var order = { mine: 0, theirs: 1, invite: 2 };
    list.sort(function (a, b) { return order[a.kind] - order[b.kind] || a.key - b.key || (a.id < b.id ? -1 : 1); });
    return list;
  }

  /* A failure (a server message code, 'offline' or 'bad-link') as the line the player reads */
  function errorText(code) {
    if (code === 'expired' || code === 'used' || code === 'not-found' || code === 'bad-link') return COPY.invalid;
    if (code === 'full') return COPY.full;
    if (code === 'offline') return COPY.offline;
    if (code === 'own') return COPY.own;
    if (code === 'limit') return COPY.limit;
    return COPY.error;
  }

  /* A launch link already handled (a recreated activity hands the same launch link over again) */
  function remember(s, code) {
    if (!CODE_RE.test(code)) return s;
    s.links = s.links.filter(function (c) { return c !== code; }).concat([code]).slice(-LINKS_KEPT);
    return s;
  }

  /* FC-D29: a nickname for one friend key, on this phone only. Keeps the record. An empty name or a bad key changes nothing. */
  function name(s, opp, n, now) {
    var v = nick(n);
    if (!v || typeof opp !== 'string' || !OPP_RE.test(opp)) return false;
    var old = isObj(s.friends[opp]) ? s.friends[opp] : null;
    s.friends[opp] = { n: v, t: now, res: old ? old.res : {} };
    return true;
  }
  /* Fix 2: the same launch link again within 2 minutes of showing it */
  function replayed(s, url, now) { return !!s.launch && s.launch.url === url && now - s.launch.t >= 0 && now - s.launch.t < REPLAY_MS; }
  /* Fix 8: the store without the refresh token (for window.__coach and debugging) */
  function safeCopy(s) { var c = JSON.parse(JSON.stringify(s)); delete c.rt; return c; }

  /* ---------- FC4: the friend board (tech spec section 9). Moves wait in the store as pend before any call (FC-D13). ---------- */
  function keepsPend(g, p) { return !!p && g.st === 'active' && g.moves.length === p.ply && turnOf(g) === g.me; }
  /* A move on my turn becomes the game's one pending move. mv: { from, to, promo? } (checked for legality by the app's chess.js). */
  function queue(s, id, mv, now) {
    var g = s.games[id];
    if (!g || g.st !== 'active' || g.pend || turnOf(g) !== g.me || !isObj(mv) || !SQ_RE.test(mv.from) || !SQ_RE.test(mv.to)) return false;
    var p = { ply: g.moves.length, from: mv.from, to: mv.to, t: num(now) ? now : 0 };
    if (mv.promo === 'q' || mv.promo === 'r' || mv.promo === 'b' || mv.promo === 'n') p.promo = mv.promo;
    g.pend = p;
    return true;
  }
  function sendable(g) { return !!g && g.st === 'active' && !!g.pend && keepsPend(g, g.pend); }
  function toSend(s) { return Object.keys(s.games).filter(function (id) { return sendable(s.games[id]); }).sort(); }
  /* The move op's data: { g, ply, from, to, promo? } (functions/src/validate.js) */
  function moveReq(g) { var p = g.pend, r = { g: g.id, ply: p.ply, from: p.from, to: p.to }; if (p.promo) r.promo = p.promo; return r; }
  /* What an answer to a move does. err: null (ok) or { code, status } (fclient.js). 'keep': try again later (offline, the server
     failed); 'done': nothing more (ok, or late: the answer's game shows the time loss); 'sync': the move can never go in (the game
     ended, it is not my turn, the move or request is refused), so it is dropped and the game is synced. */
  function settleSend(s, id, err) {
    var g = s.games[id]; if (!g) return 'done';
    if (!err) return 'done';
    var st = err.status, c = err.code;
    if (st === 'failed-precondition' || st === 'not-found' || st === 'invalid-argument') { g.pend = null; return c === 'late' ? 'done' : 'sync'; }
    return 'keep';
  }
  /* A finished game from my side: { r: 'W' | 'L' | 'D', why }, or null (still open, or a cancelled or expired invite: no result) */
  function outcome(g) {
    if (!g || g.st !== 'over' || !g.res || g.res.r === null || (g.me !== 'w' && g.me !== 'b')) return null;
    return { r: g.res.r === 'd' ? 'D' : g.res.r === g.me ? 'W' : 'L', why: g.res.why };
  }
  /* The end card's title and line for each ending (the app's own lines where they fit) */
  function endCopy(g) {
    var o = outcome(g), C = COPY; if (!o) return null;
    if (o.r === 'W') return o.why === 'mate' ? { title: C.mateWin, text: C.winText } : { title: C.winTitle, text: C.why[o.why] || C.winText };
    /* a loss by "abandoned" cannot reach this phone (the one who leaves loses its store); it counts as resigning (FC-D17) */
    if (o.r === 'L') return { title: o.why === 'mate' ? C.mateLoss : o.why === 'time' ? C.outOfTime : C.resigned, text: C.lossText };
    return { title: o.why === 'stalemate' ? C.stalemate : C.draw, text: C.why[o.why] || '' };
  }
  /* FC-D29: the record per friend, on this phone only: friends[opp].res[gameId]. Counted once per game (a game seen again in a
     later sync changes nothing), never for r: null. A friend with no nickname gets an entry for the record. */
  function recorded(s, g) { var f = g && g.opp && isObj(s.friends) ? s.friends[g.opp] : null; return !!(f && isObj(f.res) && f.res[g.id]); }
  function record(s, id) {
    var g = s.games[id], o = outcome(g);
    if (!o || !g.opp || !OPP_RE.test(g.opp) || recorded(s, g)) return false;
    var f = isObj(s.friends[g.opp]) ? s.friends[g.opp] : (s.friends[g.opp] = { n: '', t: 0, res: {} });
    f.res[id] = o.r === 'W' ? 'w' : o.r === 'L' ? 'l' : 'd';
    return true;
  }
  function toRecord(s) { return Object.keys(s.games).filter(function (id) { var g = s.games[id]; return !!outcome(g) && !!g.opp && !recorded(s, g); }).sort(); }
  /* Tech spec section 9: the finished game for prof.games. Unrated (level null), empty tags (out of the weakness stats), the
     friend's key (fr) and never the nickname (FC-D29: names stay on this phone). */
  function entry(g) {
    var o = outcome(g); if (!o) return null;
    return { id: 'f-' + g.id, d: g.t, r: o.r, user: g.me, level: null, fr: g.opp, ann: {}, tags: {}, sans: g.moves.slice() };
  }
  function nickOf(s, opp) { var f = s && isObj(s.friends) && typeof opp === 'string' ? s.friends[opp] : null; return f && f.n ? f.n : ''; }
  function histName(s, opp) { var n = nickOf(s, opp); return n ? COPY.histVs + n + COPY.histTag : COPY.histFriend; }
  function oppName(s, g) { return nickOf(s, g && g.opp) || COPY.friend; }
  function boardTitle(s, g) { var n = nickOf(s, g && g.opp); return COPY.board + (n ? COPY.vs + n : ''); }
  /* The friend board's state line: the row's line while it is open (FC-D26 time left), the result's title once it is over */
  function boardLine(g, now, skew) { var e = endCopy(g); return e ? e.title : stateLine(g, now, skew); }
  /* FC-D11 draw offers: as the server, one offer per own move (dp: the ply count at my last offer) and none while one is open */
  function ownMoves(c, n) { return c === 'w' ? Math.ceil(n / 2) : Math.floor(n / 2); }
  function canOffer(g) {
    if (!g || g.st !== 'active' || g.draw !== null || (g.me !== 'w' && g.me !== 'b')) return false;
    return !(g.dp != null && ownMoves(g.me, g.moves.length) <= ownMoves(g.me, g.dp));
  }
  function offered(s, id) { var g = s.games[id]; if (g) g.dp = g.moves.length; }
  function offerFrom(g) { return !g || !g.draw || g.st !== 'active' ? null : g.draw === g.me ? 'me' : 'friend'; }
  function drawLine(g) { var f = offerFrom(g); return f === 'friend' ? COPY.drawOffered : f === 'me' ? COPY.drawSent : null; }
  /* FC-D28: "Name your friend" once the friend has accepted and has no nickname on this phone */
  function needsName(s, g) { return !!g && g.st !== 'invited' && !!g.opp && OPP_RE.test(g.opp) && !nickOf(s, g.opp); }

  return { CONFIG: CONFIG, name: name,
    queue: queue, sendable: sendable, toSend: toSend, moveReq: moveReq, settleSend: settleSend, outcome: outcome, endCopy: endCopy, recorded: recorded, record: record,
    toRecord: toRecord, entry: entry, histName: histName, oppName: oppName, boardTitle: boardTitle, boardLine: boardLine, canOffer: canOffer, offered: offered,
    offerFrom: offerFrom, drawLine: drawLine, needsName: needsName, turnOf: turnOf, replayed: replayed, safeCopy: safeCopy, REPLAY_MS: REPLAY_MS, KEY: KEY, MAX_OPEN: MAX_OPEN, NICK_MAX: NICK_MAX, COPY: COPY, CODE_RE: CODE_RE,
    blank: blank, read: read, apply: apply, link: link, shareText: shareText, parseLink: parseLink, available: available,
    openCount: openCount, canChallenge: canChallenge, timeLeft: timeLeft, dayMonth: dayMonth, stateLine: stateLine,
    recordText: recordText, nick: nick, youPlay: youPlay, rows: rows, errorText: errorText, remember: remember };
});
