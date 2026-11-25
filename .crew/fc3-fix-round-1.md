# FC3 fix round 1

From two independent reviews of cdf2562 (app) and 003c11c (website): spec + UX, security + Android + server. Both: no blockers, safe behind the switch after these fixes.

## Suresh's decisions (2026-11-25), write into the product spec (decisions table, Wording, assumption register)
- FC-D25: the 8 proposed lines are approved as written (Random line, "optional, stays on this phone", time-left forms, own link, 20 a day, other failure, "Close", website lead line), with the time-left rule changed as below.
- FC-D26: time left never overstates. 48 hours or more: whole days rounded DOWN ("2 days left"). Under 48 hours: whole hours rounded down ("25 hours left", "5 hours left", "1 hour left"), then "under 1 hour left", then "no time left".
- FC-D27: the Challenge sheet starts on the colour used last time, Random the first time (store it on the phone, in the friend store).
- FC-D28: the challenger names the friend from the row once the friend has accepted ("Name your friend", same rules). Built in FC4 with the game screen; FC3 only records the decision.
- FC-D29: nicknames and the per-friend win-loss record stay on this phone only, never in cloud save. Move the `friends` map out of the profile into the device-only friend store (`suresh-chess-coach.friends.v1`), and drop the profile v6 change entirely (profile stays v5, `DERIVE_V` change not needed; the saves in the wild are all v5). Finished friend games still go into `prof.games` history in FC4 as planned. Update tech spec sections 9 and 13 (and the constitution note there) to match.
- FC-D30: Android's automatic backup may restore the friend store, so a restored backup brings open friend games back. FC-D3 now reads "a new phone loses open challenges unless Android restores the app's backup"; if two phones share an ID, the one that sent `hello` last gets the pushes. No backup rules change.

## Fixes
1. Test toggle only in test builds (blocker before real config): Settings shows "Friend games (test)" only when `FClient.configured(FCONFIG)` is true AND the build is a test build. Make the test flag a build-time value: `scripts/build.sh` writes it from an env var (default off), and `build-apk.yml` turns it on only for builds that are not pushes to main (pull_request and branch pushes). Main and release builds never show it. Unit-test the flag in build output and e2e both ways.
2. Repeated link taps: remember a code as handled only after its Accept sheet is dealt with (Accept succeeded, or Not now); a failed or offline peek does not remember it. To avoid replay on an activity recreate, also ignore the same launch URL within 2 minutes (a sessionStorage marker or a timestamp in the friend store). Tests: offline first tap, then online second tap shows the Accept sheet; Not now, then tapping again shows it again only after the window? No: after Not now, a later deliberate tap shows the sheet again (treat Not now as dealt with only for the replay window). Keep it simple and test the three cases.
3. Time left per FC-D26 in `friends.js`, with boundary tests (48 h, 47 h 59 m, 25 h, 1 h, 59 m, 0).
4. Visible progress: a link tap opens the Accept sheet at once in a loading state, then fills it; Share link, Accept and Cancel invite show a visible and spoken busy state while their call runs (`aria-busy`, disabled, a spinner). Reuse any existing pending-button pattern in the app; if a new visible or spoken word is needed, list it under questions with a proposal and use the proposal meanwhile. No double submit.
5. Cancel invite: busy guard; an `over` answer counts as done (no error line); a `used` answer shows no error and the row refreshes as the started game. No confirm step.
6. Lost accept answer (server change, small): keep the game id `g` in the used invite doc (still no uid); in `usableInvite`, when the invite is used and the caller is a player in that game, `accept` returns that game's view as success and `peek` reports it as accepted by you, so a retry succeeds and the nickname is saved. Unit tests in `functions/test` and keep the emulator tests green; update tech spec sections 5 and 6.
7. Screen readers: one persistent `role="status"` live region per sheet; change only its text.
8. Nits: restrict friend keys to `/^[0-9a-f]{12}$/` when reading the friend store; `window.__coach.fr()` returns a copy without `rt`; honour `window.FC_CONFIG` only in test builds (the flag from fix 1).

## Logged, not fixed
- The challenge-link intent filter ships while the feature is dark; with real fingerprints a link opens the app and nothing happens for non-test users until FC6 (the page's install line still shows for people without the app). Phone-test in FC6.
- Website PR waits for the real fingerprints before merge.
