# FC1 fix round 2

From the delta re-reviews of 06a78ea. Both: safe to deploy dark after these two and a green emulator run.

## Fixes
1. `accept` must always write `users/{uid}` (for example `seen: ts`), like `invite`, so two accepts at once by one player conflict and the 10-open-games limit (FC-D12) stays race-safe. Rule: every op that can raise a player's open-game count writes that player's user doc. Correct the comment at the top of `ops.js` and the sentence in tech spec section 6 (a read alone does not serialise; the write does). Test: in the in-memory store, two accepts that interleave (both read before either commits) for a player at 9 open games end with at most 10 open games (one fails `full` or retries and fails `full`).
2. Sync paging stalls when more than 25 of a player's games changed in the last 2 minutes. Use `next = more ? lastReturnedT : now - LAG` (paging always moves forward; the last page goes back to `now - LAG`, which catches late commits while a paging chain takes under about 90 s; with at most 10 open games and 20 invites a day that is at most a few pages). Test with a clock that moves between calls: 30+ games changed within 2 minutes, paging finishes in ceil(n/25) calls and returns every game. Tech spec section 6: state the rule, the 90 s bound, and that the client only ever sends back the server's `next`, never a cursor it made up.

## Logged, not fixed
- `callable.js` logs `e.message`, which can name a game document id (not a uid). Acceptable.
- 26+ games sharing one `t` on a page boundary can skip the extras. Very unlikely.
- CI's `npx firebase-tools@15.35.0` resolves its own dependencies without a lock file (pinned version, no secrets).
