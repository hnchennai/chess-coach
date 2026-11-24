# Friend challenges server (`functions/`)

The small server for friend challenges (see `docs/specs/friend-challenges.tech.md`). One callable Cloud Function, `friend`, in `asia-south1` (Mumbai), with an `op` field. The app never reads or writes the database itself: `firestore.rules` at the repo root denies every client read and write, and only this function (Admin SDK) touches Firestore.

Slice FC1 has the ops `hello`, `invite`, `peek`, `accept`, `move`, `sync` and `cancel`. Pushes are not sent yet: the ops hand push intents to a function that only logs them (FC2 plugs in Firebase Cloud Messaging). `resign`, `draw`, `deleteMe` and the scheduled jobs `tick` and `daily` come in FC2.

Plain JavaScript (CommonJS), Node 22, no build step. Exact versions only, checked in CI by `scripts/check-pins.js`. Licence: GPL-3.0-only, like the app.

## Files
- `index.js`: the callable `friend` and its settings (memory, CPU, instance cap).
- `src/game.js`: chess rules on chess.js 0.10.3 (the same version as the app): replay, legal moves, game endings, the 600-ply cap, deadlines. No Firebase.
- `src/ops.js`: the ops. Time, randomness and push sending are passed in, so tests control them.
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
Emulator tests call the real function over HTTP the way the app will, and check the deny-all rules. They need Java 21 for the Firestore emulator, so they run in GitHub Actions (`.github/workflows/functions.yml`). To run them on a computer that has Java:
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
5. The new indexes take a few minutes to build. Check Firebase console > Firestore > Indexes: all four show "Enabled".

The function stays dark until the app uses it (slice FC3 onwards). Nothing in this slice costs money beyond the Blaze free quota.
