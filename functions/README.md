# Friend challenges server (`functions/`)

The small server for friend challenges (see `docs/specs/friend-challenges.tech.md`). One callable Cloud Function, `friend`, in `asia-south1` (Mumbai), with an `op` field. The app never reads or writes the database itself: `firestore.rules` at the repo root denies every client read and write, and only this function (Admin SDK) touches Firestore.

Ops: `hello`, `invite`, `peek`, `accept`, `move`, `sync`, `cancel` (slice FC1), `resign`, `draw` and `deleteMe` (FC2). Two scheduled functions (FC2): `tick` every 15 minutes (games out of time, 1-day reminders, expired invites) and `daily` at 03:30 India time (IDs not seen for 60 days with no open game are deleted with their Auth user). Pushes go out through Firebase Cloud Messaging with the four fixed texts of the tech spec; under the emulator they are only logged, never sent.

Plain JavaScript (CommonJS), Node 22, no build step. Exact versions only, checked in CI by `scripts/check-pins.js`. Licence: GPL-3.0-only, like the app.

## Files
- `index.js`: the callable `friend`, the scheduled `tick` and `daily`, and their settings (memory, CPU, instance caps).
- `src/game.js`: chess rules on chess.js 0.10.3 (the same version as the app): replay, legal moves, game endings, the 600-ply cap, deadlines. No Firebase.
- `src/ops.js`: the ops. Time, randomness, push sending and Auth deletion are passed in, so tests control them.
- `src/jobs.js`: the core of `tick` and `daily`, with the same injected parts. Bounded work per run: pages of 100, at most 200 candidates of each kind; the rest waits for the next run.
- `src/push.js`: builds and sends the push messages, deletes tokens FCM no longer accepts. Tests use a recording fake.
- `src/validate.js`: strict input checks (unknown fields, wrong types or long strings fail).
- `src/ids.js`: invite codes, game ids, the per-pair opponent key, the day in India for the invite limit.
- `src/fsstore.js` (Firestore) and `src/memstore.js` (in memory, for tests): the same small data interface.

## Tests
Unit tests need no Java and no network:
```
cd functions
npm ci
npm test
```
Emulator tests call the real function over HTTP the way the app will, run the `tick` and `daily` core against the emulator database with a moved clock, and check the deny-all rules. They refuse to start unless the emulator variables are set and the project id starts with `demo-`. They need Java 21 for the Firestore emulator, so they run in GitHub Actions (`.github/workflows/functions.yml`). To run them on a computer that has Java:
```
cd functions
npx firebase-tools@15.35.0 emulators:exec --only auth,firestore,functions --project demo-chess-coach "npm run test:emu"
```
The `demo-` project id means the emulators never talk to a real Firebase project.

## Deploy (Suresh, after the PR is merged)
Run these on your own computer. The repo has no `.firebaserc` and no project id on purpose.
1. Check out `main` and install: `cd functions && npm ci && cd ..`
2. Sign in once: `npx firebase-tools@15.35.0 login`
3. From the repo root, deploy the function, the rules and the indexes:
   `npx firebase-tools@15.35.0 deploy --only functions,firestore --project <your project id>`
4. On the first deploy the tool asks to turn on some Google Cloud APIs: say yes. If it asks about a clean-up policy for container images (Artifact Registry), say yes too (it keeps storage costs near zero).
5. The new indexes take a few minutes to build. Check Firebase console > Firestore > Indexes: all five show "Enabled".
6. TTL (automatic deletion, FC-D16): the deploy in step 3 also sets the three TTL policies, because they are in `firestore.indexes.json` (`fieldOverrides`, `ttl: true` on `expireAt` for `games`, `invites` and `users`). Keeping them in the file means a later `deploy --only firestore` never removes them. Check Firebase console > Firestore > Time-to-live: all three show "Serving" (the first time can take a while). Waiting invites are deleted after their 7 days, finished games 30 days after they end, and the short-lived marker that "Delete my friend game data" leaves (it holds nothing) 2 hours after its clean-up has finished (`daily` finishes a clean-up that stopped partway), usually within a day of that time. If you ever need to set them by hand instead:
   `gcloud firestore fields ttls update expireAt --collection-group=games --enable-ttl --project <your project id>`
   `gcloud firestore fields ttls update expireAt --collection-group=invites --enable-ttl --project <your project id>`
   `gcloud firestore fields ttls update expireAt --collection-group=users --enable-ttl --project <your project id>`
7. The scheduled functions `tick` and `daily` become two Cloud Scheduler jobs (3 are free per billing account). On the first deploy the tool may ask to turn on the Cloud Scheduler API: say yes. Before that, check that no other project on the same billing account already uses the 3 free jobs (Google Cloud console > Cloud Scheduler, in each project), or the two new jobs may cost a little.
8. After the first deploy and once the indexes show "Enabled": in Google Cloud console > Cloud Scheduler, select the `tick` job and click "Force run", then the same for `daily`. Then open Logs Explorer (or Firebase console > Functions > Logs) and check both runs logged a line like `tick { time: 0, ... }` with no error. A missing index shows up there as `FAILED_PRECONDITION: The query requires an index` with a link to create it; the emulator tests cannot catch this.
9. Push: the functions send through the Firebase Cloud Messaging API (V1) with their own service account, no key in the repo. Check Google Cloud console > APIs: "Firebase Cloud Messaging API" is enabled (new Firebase projects have it on).
10. API key allowlist (tech spec section 4): Google Cloud console > APIs & Services > Credentials. Firebase made two keys, and BOTH get the same API restrictions: allow only Identity Toolkit API, Token Service API, Firebase Cloud Messaging API, FCM Registration API, Firebase Installations API and Firebase App Check API.
    - The Browser key (the Web API key in `src/js/fconfig.js`): the app's WebView calls Auth and the function over REST with it. Give it NO Android app restriction (Application restrictions: None): those REST calls cannot carry the app's package signature, so a restriction would refuse every one of them.
    - The Android key (the one in `config/google-services.json`): Firebase Cloud Messaging uses it from the Android library.

The functions stay dark until the app uses them (slice FC3 onwards). `tick` runs every 15 minutes even with no players: each run is a few empty queries (at least one read each), well inside the free quota.
