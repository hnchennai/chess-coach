# FC1 fix round 1

From two independent reviews of 41879950 (spec compliance; security, data and cost). Both: no blockers, safe to deploy dark once these are done and the emulator workflow is green.

## Suresh's decision (2026-11-24)
- FC-D21: a friend game that reaches 600 plies (300 moves each) ends automatically as a draw, reason "move limit" (`why: 'cap'`).

## Fixes
1. Sync cursor (both reviewers). `ts` is taken before the transaction, so `t` order is not commit order and a `t > since` cursor can skip a game for good. Fix on the server: sync returns `next`, the cursor the client must send as `since` next time: `next = more ? min(lastKeptT, now - LAG) : now - LAG`, with `LAG = 120000` ms (larger than the 30 s function timeout, so every write with `t <= now - LAG` has committed). Results overlap; the client keeps the higher `v` per game. Keep `now` in the answer for the clock skew. Tests: a game whose `t` is older than the cursor's `now` but commits after a sync is returned by the next sync; paging with `more` never loses a game; a repeated game in two answers is harmless.
2. `SYNC_MAX` from 100 to 25 (cost before App Check).
3. `users/{uid}.seen`: still read the user doc on every op (it serialises one player's ops and keeps the limits race-safe), but write `seen` only when it is older than 6 hours or the op writes the user doc anyway. Test: two syncs in a row write the user doc once.
4. Emulator tests must not hang: close the Admin Firestore client (`db.terminate()` in `after`) and add `--test-force-exit` to the `test:emu` script.
5. `hello.tok`: accept only FCM token characters, `/^[A-Za-z0-9_:-]{1,4096}$/`, or null. Test: a token with spaces or other text fails invalid-argument.
6. The owner's view of an `invited` game also carries its `code`, so a lost invite answer can be recovered on the next sync instead of leaving an orphan game. Only the owner ever sees it; never the code of someone else's invite. Test.
7. `index.js`: for unexpected errors log `e.code` and `e.message` only, not `e.stack` (document paths can contain a uid).
8. Remove `firebase-tools` from `functions/package.json` devDependencies (CI uses `npx firebase-tools@15.35.0`); keep the README and scripts working with the npx form, update the lock file and the pins check.
9. Tech spec `docs/specs/friend-challenges.tech.md`:
   - Section 5: `res.why` adds `'cap'` (600 plies, draw, FC-D21); a cancelled invite ends `{ r: null, why: 'expired' }` (FC4's history and record must handle `r: null`: not a result); accepted invites are marked `{ used: true }` and left to TTL instead of deleted (so a second tap says `used`).
   - Section 6: sync returns `{ now, next, more, games }` with the LAG rule from fix 1, at most 25 games; `peek` returns `{ now, col, exp }`; `hello` with `tok: null` clears the token; the owner's invited-game view carries `code`; the invite day is counted in IST; `seen` is written at most every 6 hours.
   - Product spec: add FC-D21 to the decisions table and the assumption register (confirmed by Suresh, 2026-11-24).

## Logged, not fixed in FC1
- Emulator tests use real time; late move, 7-day expiry and 20-a-day are tested only on the in-memory store (shared ops code, low risk).
- Expired invites count toward the 10 open games until FC2's `tick` ends them (dark until then).
- FC2: put TTL (`ttl: true` on `expireAt`) in `firestore.indexes.json` `fieldOverrides` instead of only via gcloud, so a later `deploy --only firestore` does not remove it.
- FC3: add `src/js/f*.js` to the functions workflow paths; show the same "no longer valid" text for not-found and expired codes.
- Workflow actions pinned to `@v4` tags like `build-apk.yml` (no secrets, read-only).
