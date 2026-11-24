# Friend challenges (tech spec)

Pairs with `friend-challenges.product.md` (FC-D1 to FC-D16, scenarios 1 to 11, criteria 1 to 10). Draft v1, design-only pass, 2026-11-24. No app code changed.
Grounded in `crew/daily-puzzle` at 7fd37f8. Versions and policy facts were checked on npm and the web on 2026-11-24 (sources at the end).

## 0. Key choices
| Topic | Choice |
|---|---|
| Database | Cloud Firestore (Standard), location asia-south1. Not Realtime Database: Firestore has transactions, queries for the timeout job and TTL deletion |
| Server | One callable Cloud Function (2nd gen, Node 22) `friend` with an `op` field, plus two scheduled functions `tick` and `daily`. All in asia-south1 |
| App to Firebase | No Firebase JS SDK. Plain `fetch`: Auth REST for the anonymous ID, the documented callable HTTPS protocol for everything else |
| Who touches the database | Only the functions (Admin SDK). Firestore rules deny every client read and write |
| Push | `@capacitor/push-notifications` 8.1.3 (official, MIT), which links `firebase-messaging` 25.0.1 |
| Share sheet | `@capacitor/share` 8.0.3 (official, MIT) |
| Abuse guard | App Check with Play Integrity via `@capacitor-firebase/app-check` 8.6.0, in its own slice (monitor, then enforce before launch) |
| Links | `https://hnchennai.github.io/c/<code>`, Android App Links, `getLaunchUrl()` and `appUrlOpen` from `@capacitor/app` 8.1.2 |
| Deletion | TTL policies (invites 7 days, finished games 30 days), Delete my friend game data op, a deletion page on the website |
| Launch | Behind a switch (`Friends.CONFIG.live`, off) until slice FC6 and the Play forms are done |

## 1. Current state (read from code)
- One engine game `G`; `st.mode` says what the board shows (`play`, `review`, lessons, sets). Hints, engine bar, think card and "Why the engine played" key off `st.mode === 'play'` (`src/js/app.js` :487, :568, :587, :697).
- Finished games: `finishGame()` (:1528) unshifts `{ id, d, r, user, level, acc, counts, tags, sans, ann }` into `prof.games` (kept to 30). Play tab shows the last 3 in `#recentPlay` (:884). Review is `enterReview()` (:1560).
- Profile is v5 (`src/js/profile.js`), with `migrate()` and a lossless `merge()` for cloud save.
- Native plugins are found through `window.Capacitor.Plugins` (AdMob :1064, App :3076). `ads.js` is loaded only when `window.Capacitor` exists (`scripts/build.sh`), so the web build does no ads work. Same pattern here.
- `android/` is not in git. CI runs `npx cap add android` and then `scripts/android-ads.sh` to patch the manifest and pin Gradle versions, failing if a patch did not apply. Friend games need the same kind of script.
- The Capacitor 8 template already applies the `com.google.gms.google-services` Gradle plugin when `android/app/google-services.json` exists (template `app/build.gradle`), with classpath `google-services:4.4.4`. The main activity is `singleTask`.
- Website repo already has `.nojekyll`, so a `.well-known/` folder is published as is.

## 2. Architecture
```
Phone (WebView JS)                         Firebase, asia-south1
 friends.js (pure)                          Auth (anonymous, legacy Firebase Auth, not Identity Platform)
 fclient.js (fetch glue) --REST signUp-->   identitytoolkit / securetoken
          |--POST callable {op}-------->    friend (Cloud Run function) --Admin SDK--> Firestore
 PushNotifications plugin <--FCM-------     friend / tick send pushes via Admin messaging
 App plugin (links, resume)                 tick (every 15 min): time-outs, 1-day reminders, invite expiry
                                            daily (03:30 IST): idle ID clean-up
                                            TTL: invites, finished games
```
Function settings: `region: 'asia-south1'`, `memory: '256MiB'`, `cpu: 'gcf_gen1'` (a fraction of a vCPU, keeps compute in the free tier; needs `concurrency: 1`), `maxInstances: 20` (a cost ceiling), `timeoutSeconds: 30`, `enforceAppCheck` false until FC6, then true.

## 3. How the app talks to Firebase (decision 2)
| Option | For | Against |
|---|---|---|
| A. Firebase JS compat builds in `www/vendor` | Realtime listeners, offline cache | About 400 KB+ of vendored JS to pin and audit; App Check in a WebView has no Play Integrity provider (reCAPTCHA only, which does not suit the `https://localhost` origin); push still needs a native plugin |
| B. `@capacitor-firebase/*` (Capawesome) for auth, functions, messaging | Native SDKs, Capacitor 8 builds exist (8.6.0, Apache-2.0) | Pulls `firebase-auth` and more Google binaries into the APK and the GPL exception; peer dependency on `firebase` 12 JS |
| **C. Plain REST + callable protocol (chosen)** | Zero new JS libraries; reads and writes go through one function, so rules stay deny-all; small, testable in Chromium | No realtime listener: the app refreshes on push, on resume and on Play tab open (fine for 3-day turns) |

- Anonymous sign-in: `POST https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=KEY` with `{ returnSecureToken: true }`. Refresh: `POST https://securetoken.googleapis.com/v1/token?key=KEY`, `grant_type=refresh_token`. The refresh token is kept in the friend store (section 9), never in the profile.
- Calls: `POST https://asia-south1-<project>.cloudfunctions.net/friend`, `Content-Type: application/json`, `Authorization: Bearer <ID token>`, later `X-Firebase-AppCheck: <token>`, body `{ "data": { "op": ... } }`. Answer `{ result }` or `{ error: { status, message } }`. No other headers are allowed by the protocol.
- Config in `src/js/fconfig.js` (project ID, API key, base URLs). Tests override it with `window.FC_CONFIG` set by Playwright before scripts run, pointing at the emulators.
- Sign-in happens only on the first Challenge or Accept (FC-D3). Before that the app makes no Firebase call.

## 4. Push (decision 2, FC-D14)
- Plugin: `@capacitor/push-notifications` 8.1.3, pinned exactly and checked in CI like `@capacitor/app`. Its Gradle reads `firebaseMessagingVersion` (default 25.0.1); we pin `firebaseMessagingVersion = '25.0.1'` in `variables.gradle` and grep the resolved classpath. CI also fails if `firebase-analytics` appears (constitution: no analytics).
- `google-services.json` goes to `config/google-services.json` in this repo; `scripts/android-friends.sh` copies it to `android/app/`. Firebase says these config values are not secrets ([api-keys]); they are inside every APK anyway. What must be locked down instead: Firestore rules (deny all), App Check enforcement on the function, the API key's API allowlist (Identity Toolkit, Token Service, FCM Registration, Firebase Installations, App Check, Firebase ML not needed), and the function's own checks. No Android app restriction on the key: the REST calls from the WebView cannot carry a trusted package signature.
- Manifest (by script): `firebase_messaging_auto_init_enabled = false` (no token until the player uses the feature); `com.google.firebase.messaging.default_notification_icon` pointing at a new monochrome vector `ic_stat_friend`; `default_notification_channel_id = friend`. `POST_NOTIFICATIONS` comes from the plugin and Firebase manifests; the script checks the merged manifest has it.
- App flow: on the first Challenge or Accept, `requestPermissions()` then `register()`, `createChannel({ id: 'friend', name: 'Friend games', importance: 4 })`; the `registration` event sends the token with op `hello`. Listeners: `pushNotificationReceived` (app open: refresh that game), `pushNotificationActionPerformed` (tap: open the game by `data.g`).
- Server message: `notification { title: 'Chess Coach', body }`, `data { t, g }`, `android { priority: 'high', notification { channelId: 'friend', tag: g } }` (one notification per game, newest wins). Token errors `registration-token-not-registered` delete the stored token.
- Bodies (generic, no nickname): `move` "Your move in a friend game"; `draw` "Your friend offers a draw"; `remind` "1 day left for your move in a friend game"; `over` "A friend game has ended". Nothing else is ever sent (criterion 4).

## 5. Data model (decision 4). No names, no free text.
`users/{uid}`: `{ tok: string|null, seen: ms, inv: { d: 'YYYY-MM-DD' (the day in India, IST) | null, n } }`.
`invites/{code}`: `{ g: gameId, by: uid, exp: ms, expireAt: Timestamp }`. Code: 10 characters, Crockford base32 from `crypto.randomBytes` (50 bits). On accept it is not deleted but replaced by `{ used: true, exp, expireAt }` (no uid) and left to TTL, so a second tap says `used`. Deleted on cancel.
`games/{gameId}` (gameId: 20 random characters, never the code):
```
{ uids: [uid, uid|null], w: uid|null, b: uid|null, by: uid, col: 'w'|'b'|'r', code: string|null (the invite code while invited),
  st: 'invited'|'active'|'over', moves: ['e4', 'e5', ...] (SAN), fen,
  dl: ms (deadline for the side to move), rem: ms|null (reminder due), draw: null|'w'|'b', drawPly: { w, b },
  res: null | { r: 'w'|'b'|'d'|null, why: 'mate'|'resign'|'time'|'stalemate'|'repetition'|'fifty'|'material'|'cap'|'agreed'|'abandoned'|'expired' },
  v: n (bumps on every change), t0, t: ms (updatedAt), expireAt: Timestamp|null }
```
- `why: 'cap'`: the game reached 600 plies (300 moves each) and ends as a draw, "move limit" (FC-D21).
- A cancelled or expired invite ends `{ r: null, why: 'expired' }`: no game was played, so it is not a result. FC4's history and friend record must skip `r: null`.
- `expireAt` is the TTL field: invite expiry while `invited`, end + 30 days when `over`, null while `active`. TTL deletes usually land within 24 hours of expiry and are billed as deletes ([ttl]).
- Indexes: `games` (uids array-contains, t), (uids array-contains, st), (st, dl), (st, rem). TTL policies on `games.expireAt` and `invites.expireAt` (Suresh sets them once; command in FC2).
- The app never sees uids. Each game view carries `opp`: the first 12 hex characters of `sha256(oppUid + ':' + myUid)`, a stable per-pair key for nicknames and the record, useless to anyone else.

## 6. Server ops (callable `friend`)
Every op: needs `auth`; validates `data` strictly (unknown fields, wrong types or long strings fail); reads `users/{uid}` and writes `seen` only when it is 6 hours old or the op writes the user doc anyway. A read alone does not make two transactions conflict; a write does. So every op that can raise a player's open-game count (`invite`, `accept`) always writes that player's user doc: two at once conflict, one retries and sees the new count, and the limits stay race-safe; runs game changes in a Firestore transaction; sends pushes after commit; returns the caller's view of each changed game.
| op | Input | Checks and effect |
|---|---|---|
| `hello` | `{ tok? }` | Upsert user, store push token (FCM characters only, `/^[A-Za-z0-9_:-]{1,4096}$/`); `tok: null` clears it. Returns `{ now }` |
| `invite` | `{ col }` | Open games (invited + active) < 10 (FC-D12, count query); invites today (IST calendar day) < 20. Creates game `invited` and invite; `expireAt` +7 days. Returns game and code. The owner's view of an `invited` game carries `code` (in every answer, sync included), so a lost answer is recovered; nobody else ever sees a code |
| `peek` | `{ code }` | Invite exists, not used, not expired, not mine. Returns `{ now, col, exp }`: my colour (`'r'` for random) and expiry, for the Accept screen |
| `accept` | `{ code }` | As peek, plus my open games < 10. Marks the invite used, fills colours (random by `crypto`), `st: active`, `dl = now + 3 days`, `rem = dl - 1 day`. Push `move` to White if White is the challenger |
| `move` | `{ g, ply, from, to, promo? }` | I am a player, `st` active, my turn, `now <= dl`. Replays `moves` with chess.js 0.10.3 (same rules as the app, needed for repetition), plays the move. `ply` makes it idempotent: if `moves.length === ply + 1` and the last move is the same, return ok without change (offline resend). Clears a draw offer to me. Ends on mate, stalemate, threefold, 50 moves, too few pieces, or 600 plies (draw, `cap`, FC-D21). New `dl`, `rem`. Push `move` or `over` to the opponent |
| `resign` | `{ g }` | Active, I am a player. Ends, push `over` |
| `draw` | `{ g, a: 'offer'|'accept'|'decline' }` | Offer: active, no open offer, at most one offer per own move (`drawPly`). Push `draw`. Accept or decline: an open offer from the opponent |
| `cancel` | `{ g }` | My own `invited` game: ends `{ r: null, why: 'expired' }`, deletes the invite (frees a slot, FC-D18) |
| `sync` | `{ since }` | Games where I am a player and `t > since`, oldest first, at most 25. Returns `{ now, next, more, games }`; the app sends `next` as `since` next time. `t` is taken before the transaction, so `t` order is not commit order: `next = more ? last returned t : now - LAG`, with `LAG` = 2 minutes (longer than the 30 s timeout, so every write with `t <= now - LAG` has committed). Paging always moves forward; the last page goes back to `now - LAG`, which catches late commits as long as a paging chain takes under about 90 s (with at most 10 open games and 20 invites a day, a chain is a few pages). The app only ever sends back the server's `next`, never a cursor it made up. Answers overlap; the app keeps the higher `v` per game. Reads only changed games (at least 1 read per query) |
| `deleteMe` | `{}` | For each of my games: `invited` ends `expired`; `active` ends `abandoned`, friend wins; push `over` to the friend. Then my uid in every game becomes `'x'`, my invites and user doc go, and `admin.auth().deleteUser(uid)` |

Error statuses: `failed-precondition` with message codes `expired`, `used`, `own`, `full`, `limit`, `turn`, `illegal`, `late`, `over`; `not-found`; `invalid-argument`. A `late` move ends the game on time in the same transaction.

Scheduled: `tick` every 15 minutes (`Asia/Kolkata`): active games with `dl <= now` end on `time` (side to move loses), push `over` to both; games with `rem <= now` get push `remind` to the side to move, `rem = null`; `invited` games past expiry end `expired`. `daily` at 03:30: user docs with `seen` older than 60 days and no open game are deleted with their Auth user. Two Cloud Scheduler jobs (3 are free per billing account).

## 7. Security (decision 3)
Firestore rules (shipped): nobody reads or writes anything from a client.
```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} { allow read, write: if false; }
  }
}
```
This is stricter than "only the two players can read". If a later version reads directly, the only extra rule allowed is `match /games/{id} { allow get: if request.auth != null && request.auth.uid in resource.data.uids; }`.
- Fair play (criterion 2): legality, turn and deadline are decided only in `move`, from the stored move list, inside a transaction.
- App Check (recommended, FC6): Play Integrity provider, monitor in the console for a week, then `enforceAppCheck: true`. It is the only real defence against scripts that mint anonymous IDs with the public key. Token TTL 1 day: Play Integrity's standard tier is 10,000 calls a day ([appcheck]), so ask Play to raise the tier past about 5,000 daily players.
- Rate limits: 10 open games, 20 invites a day per ID, one draw offer per own move, `maxInstances: 20` as a hard cost ceiling, 600-ply game cap. Anonymous sign-ups have a per-IP quota in Auth: check it in the console, because many Indian mobile users share carrier IPs.
- Do not upgrade to Identity Platform: its anonymous clean-up deletes accounts 30 days after creation ([anon]), which would kill long games. `daily` does a safer clean-up.
- Push text carries no game data; `data.g` is an opaque ID.

## 8. Invite links (decision 5)
- Link: `https://hnchennai.github.io/c/<code>`. Share text written on the phone, never sent to our server: "Play chess with me in Chess Coach: <link>" (the app's own fixed text, plus whatever the player adds in WhatsApp).
- Website (repo `hnchennai.github.io`, separate PR, Suresh merges):
  - `.well-known/assetlinks.json` with two SHA-256 fingerprints for `com.suresh.chesscoach`: the Play App Signing key and the key that signs GitHub release APKs. Suresh copies both from Play Console > Test and release > App integrity. Nobody reads `signing/` or a keystore. `.nojekyll` already exists, so the dot folder is served; check with `curl -I` that it is 200 and `application/json`, no redirect.
  - `404.html`: GitHub Pages serves it for any missing path ([pages404]). If the path starts with `/c/`, it shows "A friend challenged you to chess" with "Get Chess Coach on Google Play" and "Open in Chess Coach" (an `intent://hnchennai.github.io/c/<code>#Intent;scheme=https;package=com.suresh.chesscoach;end` link for when App Links did not open the app). Other paths show a normal "Page not found".
  - `delete.html` (section 12) and a new privacy section.
- Manifest (by `scripts/android-friends.sh`), inside the main activity:
```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW" />
  <category android:name="android.intent.category.DEFAULT" />
  <category android:name="android.intent.category.BROWSABLE" />
  <data android:scheme="https" android:host="hnchennai.github.io" android:pathPrefix="/c/" />
</intent-filter>
```
- In the app: cold start reads `App.getLaunchUrl()`; a warm app gets `appUrlOpen` (retained until a listener reads it, `AppPlugin.java`). `Friends.parseLink(url)` accepts only that host, path `/c/` and a 10-character code. On the web build, links never reach the app (FC-D4).

## 9. App side (decision 7)
Files:
- `src/js/friends.js`: pure, Node-testable. Store shape, migrate, link parsing, view helpers (status line, time left, record), the send queue's decisions, the launch switch.
- `src/js/fconfig.js` and `src/js/fclient.js`: network glue (auth, callable, push, share, App events). Loaded only inside the native app, the same `document.write` trick as `ads.js` in `scripts/build.sh`.
- `app.js`: a "FRIENDS GLUE" section for the UI only.

Local friend store, key `suresh-chess-coach.friends.v1` (device only, never in cloud save, FC-D3):
`{ v: 1, uid, rt (refresh token), tok, since, games: { id: { me, opp, st, moves, dl, draw, res, v, code, exp, pend: null | { ply, from, to, promo, t } } } }`.

UI:
- Play tab, phones and wide: a "Friend games" card above Recent games, only when `Friends.available()` (native, and live switch on or the test toggle). Rows: nickname (or "Friend"), state line ("Your move, 2 days left", "Their move", "Waiting for your friend, until 1 Dec", "Not sent yet"), and the record "W 2 · L 1 · D 0". Button "Challenge a friend" opens a sheet: Play as White, Black or Random, then Share link. At 10 open games the button says why it is off.
- Accept sheet: "A friend challenges you", your colour, "Name your friend" (optional, max 20 characters, stays on this phone), Accept and Not now.
- Friend board: a new `st.mode = 'friend'` with its own `Chess` instance (`st.fg`), zone `play`. Because hints, eval bar, think card, coach verdicts and Stockfish all check `'play'`, they stay off (criterion 6). The mode bar shows the time left and a status line; controls are Resign (confirm), Offer draw, and Accept or Decline when offered. No undo. The engine game `G` waits as it does during a review (`stow`). `activityOn()` is true during a friend game, so the ads rules keep the banner off (FC-D15).
- End: the normal end card with "Review this game"; the banner may show there as after any game. The game goes into `prof.games` as `{ id: 'f-' + gameId, d, r, user, level: null, fr: opp, ann: {}, tags: {}, sans }`. Empty tags keep friend games out of the weakness stats. No rating change. The history row says "vs Priya (friend)". `dayRec().games++` counts it as a game played.

Profile v6 (data rule): adds `friends: { <opp>: { n: nickname, t: ms, res: { <gameId>: 'w'|'l'|'d' } } }`. `migrate()`: missing or broken reads as `{}`, nicknames trimmed to 20 characters. `merge()`: union of `res` maps per key (never drops a result), nickname from the newer `t`. The record is counted from `res`, so it survives the 30-game history cap. Note: nicknames travel with the player's own cloud save (their Play Games account), never to our server.

Offline queue (FC-D13, decision 6): a move is checked locally with chess.js, shown at once, and saved as `pend` before any network call. Sending runs right after the move, on `online`, on App `resume`, on Play tab render, and every 60 seconds while a game with `pend` is on screen. Only one move can be pending per game (then it is the friend's turn). The server answer replaces the local game. `late`: the game shows lost on time. `over` or `turn`: drop `pend`, sync. Resign and draw actions need the internet and say so.

Clocks (FC-D6): the server's `dl` is the truth; the app shows time left from `dl - (Date.now() + skew)`, with `skew` from `now` in the last answer. The clock never stops offline.

Settings: "Delete my friend game data" (confirm dialog; needs the internet) and a "Friend game ID" line (the first 8 characters of the uid) for email deletion requests. Test builds get a "Friend games (test)" toggle while the switch is off.

## 10. Android build changes
`scripts/android-friends.sh android`, run in CI after `android-ads.sh`, failing on any patch that did not apply: copy `config/google-services.json`; add the intent filter; the three meta-data entries; write `res/drawable/ic_stat_friend.xml`; pin `firebaseMessagingVersion`. `build-apk.yml`: exact-version checks for `@capacitor/push-notifications` 8.1.3, `@capacitor/share` 8.0.3 (and `@capacitor-firebase/app-check` 8.6.0 in FC6); `cap sync` output must list them; Gradle must resolve `firebase-messaging:25.0.1` exactly and no `firebase-analytics`.

## 11. Cost (decision 1)
Blaze free quotas ([pricing]): Firestore 50K reads, 20K writes, 20K deletes a day, 1 GiB; Functions 2M invocations, 400K GB-seconds, 200K CPU-seconds a month; FCM and anonymous Auth free; 3 Scheduler jobs free.
Assumed per daily player: 2 open games, 4 own moves, 6 syncs, 1 hello. That is 11 calls, about 20 reads (a move reads the game and the friend's token; a sync reads changed games only), about 6 writes.
| | 1,000 daily players | 10,000 daily players |
|---|---|---|
| Reads | 20K/day, free | 200K/day, about 4.5M/month over quota |
| Writes | 6K/day, free | 60K/day, about 1.2M/month over quota |
| Calls | 0.33M/month, free | 3.3M/month, 1.3M over at $0.40/M |
| Compute (0.3 s per call, `gcf_gen1`) | far under free | about 165K CPU-s, near the free line |
| Estimate | $0 to $0.20 (build and image storage) | about $3 to $5 a month |
Mumbai Firestore and Tier 2 Cloud Run unit prices did not render from the pricing pages; the 10,000 figure uses about $0.04 per 100K reads and $0.11 per 100K writes. Confirm in the Google Cloud calculator in readiness. The $5 alert is an alert, not a cap; `maxInstances` is the cap. Set the Artifact Registry clean-up policy on first deploy.

## 12. Testing (decision 8)
- Unit (`node --test`, CI): `functions/src/game.js` (legal and illegal moves, wrong turn, promotion, mate, stalemate, threefold, 50 moves, too few pieces, replay, idempotent resend, deadline); `src/js/friends.js` (store migrate, link parsing, queue decisions, time text); `profile.js` v6 migrate and merge (results never lost).
- Emulator (new workflow `.github/workflows/functions.yml`, on changes under `functions/`, `firestore.*`, `src/js/f*.js`): Java 21, Node 22, `npx firebase-tools@15.35.0 emulators:exec --only auth,firestore,functions --project demo-chess-coach "npm test"`. The `demo-` project needs no real Firebase. Tests call the callable over HTTP like the app: scenarios 1, 2, 4 to 7, 10, criteria 1, 2, 5, 9. Rules tests with `@firebase/rules-unit-testing` 5.0.2 (and `firebase` 12.19.0, test only): every client read and write is denied. Time comes from an injected `now()` so `tick` is tested without waiting 3 days. Pushes go to a recording fake.
- Playwright e2e (Chromium, 412 x 915 and 1280 x 900, no console errors): a fake `window.Capacitor` with `PushNotifications`, `App`, `Share` (as `f3b.spec.js` fakes AdMob), `FC_CONFIG` pointing at the emulators, two browser contexts as two players. Covers invite, accept by link, moves both ways, offline queue (`context.setOffline`), draw, resign, time-out, end card, history row and record, no hints or eval during the game, delete. Web build (no Capacitor): no friend card and no request to any Firebase host (criterion 10, scenario 11).
- Phone only (signed APK, Suresh's phone and one more): App Link verification (`adb shell pm get-app-links com.suresh.chesscoach`), link from WhatsApp with the app closed and open, the no-app page, push with the app open, in the background and killed, tap opens the right game, Android 13+ permission prompt, notification icon, delivery in Doze, reinstall (scenario 9), airplane-mode move, App Check token accepted, a traffic capture showing no Firebase traffic before the first challenge, 360px layout.

## 13. Beyond code (drafts for Suresh)
**Constitution** (draft). Replace "The app works fully offline. The network is only ever optional (cloud save, fonts, ads)." with: "The app works fully offline. The network is only ever optional (cloud save, fonts, ads), with one exception: friend challenges on Android need the internet to send and receive moves. Everything else works offline, and the web version never talks to the friend server." Add to Security and privacy: "Friend challenges have no chat, no free text and no public names. The friend server (Firebase, project owned by Suresh, region asia-south1) holds only an anonymous ID, one push token per install, and each game's moves and state. Finished games are deleted after 30 days. Nicknames live only on the phone. Clients never write to the database; every change goes through a server function that checks it." Add to Engineering rules: "Server code lives in `functions/` (Node 22, exact versions) and is tested against the Firebase emulators in CI. Public client config (`google-services.json`, the Firebase API key) is not a secret and may be in the repo; its key is limited to the Firebase APIs in use."

**LICENSE-EXCEPTION** (draft): "Additional permission under GNU GPL version 3 section 7: if you modify this program, or any covered work, by linking or combining it with the Google Mobile Ads SDK, the Google User Messaging Platform SDK, the Google Play Billing Library, the Firebase Android SDKs for Cloud Messaging and App Check (com.google.firebase:firebase-messaging, firebase-appcheck, firebase-appcheck-playintegrity and the Firebase libraries they depend on), the Google Play Integrity library, or the Google Play services libraries those depend on (com.google.android.gms:play-services-*) (or modified versions of those libraries), the copyright holder of Chess Coach grants you permission to convey the resulting work. This permission covers the Chess Coach code only. Stockfish is a separate program under plain GPL version 3." The constitution's licence line names the same list. Server code is GPLv3 too; its npm libraries (firebase-admin Apache-2.0, firebase-functions MIT, chess.js BSD-2) need no exception.

**Privacy policy** (draft section "Friend games (Android app only)"): "If you challenge a friend or accept a challenge, the app connects to our friend game server, run on Google Firebase in Mumbai, India. The server stores: a random ID made for your copy of the app, not linked to your name, email, phone number or Google account; a push token, so we can tell you when it is your move; and each friend game's moves, whose turn it is, the time limit, draw offers and the result. We do not store names, nicknames or messages. The nickname you give a friend stays on your phone. You share the invite link with the app you choose, such as WhatsApp; we do not see your message. Finished games are deleted from the server 30 days after they end; your phone keeps its own copy. To delete your friend game data, open Settings and tap Delete my friend game data, or see How to delete your data. Google processes this data for us as a service provider." Also change "We do not have a server that receives this data" and the "short version" and "Deleting your data" parts to match.

**Deletion page** `delete.html` (draft): title "Delete your Chess Coach friend game data", names "Chess Coach" as on Google Play. In the app: Settings, Delete my friend game data. Without the app: email handnchennai@gmail.com with the subject "Delete friend game data" and your Friend game ID from Settings if you have it; we delete within 7 days. What is deleted: the ID, push token and all games on the server; open games end for your friends. Automatic: games end after 3 days without a move and are deleted 30 days after they end; unused IDs go after 60 days. Play requires a way that does not need the app ([deletion]); email is that way.

**Data safety** (drafts; existing ads rows unchanged):
| Data type | Collected | Shared | Purpose | Optional | Deletable |
|---|---|---|---|---|---|
| User IDs (random friend game ID) | Yes | No | App functionality | Yes | Yes |
| Device or other IDs (push token, Firebase installation ID) | Yes | No | App functionality | Yes | Yes |
| App activity: Other actions (game moves, draw offers, results) | Yes | No | App functionality | Yes | Yes |
Encrypted in transit: Yes. Deletion URL: `https://hnchennai.github.io/delete.html`.

**Content rating** (draft): IARC "Does the app allow users to interact or exchange content with other users?" Yes (turn-based games only, no chat). Shares location: No. Personal information shared: No. Expected result: same age rating, with "Users Interact".

## 14. Slice plan (decision 10). One PR each, shippable, the switch stays off until FC6.
| # | Slice | Cx | Suresh's steps |
|---|---|---|---|
| FC1 | Backend core: `functions/` (game rules with chess.js 0.10.3, ops hello, invite, peek, accept, move, sync, cancel), deny-all rules, indexes, `firebase.json`, emulator CI. No app change | 3 | Before: create project "Chess Coach" in his Google account, Blaze, card, $5 budget alert, Firestore Standard in asia-south1, Anonymous sign-in on, register Android app `com.suresh.chesscoach`, give `google-services.json`. After merge: `firebase deploy --only functions,firestore` from his machine (the agent has no credentials) |
| FC2 | Backend rest: resign, draw, deleteMe, `tick`, `daily`, push sending via a fake in tests, TTL docs | 3 | Deploy; set the two TTL policies (`gcloud firestore fields ttls update expireAt --collection-group=games --enable-ttl`, same for invites); API key allowlist |
| FC3 | App: friend store, auth and callable client, Play card, Challenge and Accept sheets, nickname, share, links (`android-friends.sh`, intent filter, `getLaunchUrl`, `appUrlOpen`), web build untouched. Website PR: `assetlinks.json`, `404.html` | 3 | SHA-256 fingerprints from Play Console; merge the website PR; phone test the links |
| FC4 | App: friend board mode, moves, offline queue, resign, time line, end card, history entry, profile v6 with record | 3 | Phone test a full game with a second phone |
| FC5 | Push: plugin, `google-services.json` in `config/`, manifest meta-data, icon, permission ask, channel, tap opens game; draw offer UI; CI pins and dependency checks; LICENSE-EXCEPTION change | 3 | Yes to the licence change and the new Google library (checkpoint like an ads SDK); phone test push |
| FC6 | Delete my friend game data, Friend game ID line, App Check (monitor, then enforce), website `delete.html` and privacy section, constitution amendment, launch switch on | 3 | Register Play Integrity in App Check, link the Cloud project in Play Console; approve the amendment; update Data safety and content rating; flip the switch (checkpoint) |

Order: FC1 then FC2 (backend can deploy dark), then FC3 to FC6. FC3 and FC2 can run in parallel.
Risks: App Links verification on a `github.io` user domain (fallback: the intent button on the page); FCM delivery on phones with aggressive battery savers (the app syncs on open anyway); Play Integrity quota; anonymous sign-up per-IP quota on carrier NAT; cold starts of about 1 to 3 seconds on the first call (acceptable for turn-based play; `minInstances` costs money, so no); the board code is one 3,000-line file, so the friend mode must reuse `viewGame()` and the review pattern rather than fork it.

## Open technical questions
1. Exact Mumbai unit prices for Firestore and Tier 2 Cloud Run: confirm in the calculator in readiness (the pricing pages did not render for the tool).
2. Does the Firebase start-up provider or `firebase-installations` send anything at app start before `register()`? Needs a traffic capture; if yes, consider removing `FirebaseInitProvider` and initialising on first use.
3. Does `register()` turn FCM auto-init back on for later starts? Read the plugin source in FC5 and test.
4. WhatsApp link previews for a page served with HTTP 404 may be blank. Alternative: `https://hnchennai.github.io/c/#<code>` served by `c/index.html` with status 200 (the intent filter would then need `path="/c/"` and the code read from the fragment).
5. The anonymous sign-up per-IP quota value and whether to raise it (console, Authentication settings).
6. `@capacitor-firebase/app-check` declares a peer dependency on `firebase` 12 (JS). Check that npm installing it does not change `www/`, and that the native token call works without the JS SDK loaded.

## Questions for Suresh (business)
Answered 2026-11-24, see product spec FC-D17 to FC-D20: deleting data resigns open games (friend wins); Cancel invite is in; spending guard is the $5 alert plus instance caps; `google-services.json` is committed; Data safety says no accounts and gives the deletion URL.
