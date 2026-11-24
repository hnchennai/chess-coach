# FC2 fix round 2

From the delta re-reviews of 9d5c6bb. Both: safe to deploy dark; the items below close the last gaps before FC6.

## Suresh's decision (2026-11-24)
- FC-D22: when a player deletes their friend game data, a game already past its deadline ends on time (the side that ran out of time loses), as the timer job would have ended it. Every other open game counts as a win for the friend (FC-D17).

## Fixes
1. A deleteMe that fails partway must still finish. Write the tombstone as `{ gone: true, at: now }` with NO `expireAt`; set `expireAt = now + 2 h` only after the games, invites and Auth steps have all succeeded. `daily` finishes any tombstone without `expireAt` whose `at` is older than 1 hour: run the same clean-up (games, invites, Auth user with user-not-found as done), then set `expireAt`. Same 90 s budget. Tests: a deleteMe that throws after the tombstone leaves a tombstone without `expireAt`; daily one hour later finishes it (uid gone from games, invites gone, Auth user gone, `expireAt` set); a tombstone younger than 1 hour is left alone; a finished tombstone is left for TTL. The index or query this needs (e.g. `gone == true` and `at <`) must be in `firestore.indexes.json` if it is composite.
2. `daily` guard for a returning player: before `deleteAuthUser`, read the Auth user and skip if `metadata.lastRefreshTime` (or last sign-in) is within the last day; inject this lookup so tests use a fake. Test. Fix the spec sentence about the accepted window (it is between the check and the Auth delete).
3. Tech spec section 9 (FC6): the app keeps its refresh token until deleteMe returns ok (so it can retry after the 1-hour ID token), then clears the friend store. Section 6: the tombstone lifecycle from fix 1. Section 4: fix the garbled sentence at about line 59 (the "only if it is still the one sent" clause belongs to the token-deletion rule).
4. Product spec: add FC-D22 (wording above) to the decisions table, a line to scenario 10 if needed, and the assumption register (confirmed by Suresh, 2026-11-24).

## Logged, not fixed
- A deleteMe that is never retried and whose daily finish keeps failing on Auth leaves an Auth user with no data; the next daily retries.
