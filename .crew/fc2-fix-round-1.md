# FC2 fix round 1

From two independent reviews of 1447de7 (spec compliance; security, data and cost). Both: no blockers, safe to deploy dark. The functions workflow (emulators) was green on 1447de7.

## Fixes
1. deleteMe can be undone for up to an hour (both reviewers). The ID token stays valid after the Auth user is deleted, and `run` recreates a missing `users/{uid}`, so a late sync, resend, `hello{tok}` or an in-flight `invite` brings back data (criterion 9). Fix: deleteMe first writes a tombstone `users/{uid} = { gone: true, expireAt: now + 2 h }` (no token, no seen) in a transaction; `run` refuses every op for a uid with a tombstone (`not-found`, and never recreates the doc); only then scan games and invites, then delete the Auth user. Ops already in flight conflict with the tombstone write (invite and accept write the user doc). Add a TTL fieldOverride on `users.expireAt`. `daily` must skip tombstones (they hold nothing and expire on their own). deleteMe on a tombstoned uid (client retry) still finishes the clean-up and returns ok. Tests: an op after deleteMe fails and writes nothing; an invite that interleaves with deleteMe leaves no game holding the uid; retry is harmless.
2. `daily` can strand an Auth user: check inside a transaction, delete the Auth user (user-not-found counts as done), then delete the doc in a second transaction that re-checks `seen` and the open-game count. Test: an Auth failure leaves the doc so the next run retries.
3. `tick` time budget: stop taking new candidates after about 90 s of the 120 s timeout (inject the clock), so a commit is never left without its push. Test with a fake clock.
4. Push: only `registration-token-not-registered` and `invalid-registration-token` delete a stored token; `invalid-argument` is only logged. Test.
5. deleteMe on an active game already past its deadline applies the time rule first (side to move loses on `time`, as tick and the ops do), instead of `abandoned`. Test both sides.
6. `test/emu/jobs.test.js` comment: the emulator does not enforce composite indexes, so do not claim it checks them. README deploy steps: after the first deploy, run `tick` and `daily` once from the Cloud Scheduler console and check their logs for index errors; also check that no other project on the same billing account already uses the 3 free Scheduler jobs.
7. Tech spec: section 6 deleteMe tombstone rule; section 9 or 14 (FC6): the app stops all friend calls and clears its friend store before calling deleteMe and treats it as the last call; note that anonymous Auth users that never called an op have no user doc and are not cleaned (no personal data, accepted until App Check).

## Logged, not fixed
- `daily` vs a returning player in the milliseconds between the doc delete and the Auth delete. Accepted.
- Emulator run starts tick and daily without Pub/Sub; jobs are tested through the jobs core directly.
