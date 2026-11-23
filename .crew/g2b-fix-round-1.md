# G2b fix round 1 (2026-11-23)

Source: two independent reviews of `f64ffee..2ef547f` (spec; UX, integration and ads), both "safe to go on", no blocker. Plus Suresh's two answers. Test-first: each fix gets a case that fails on 2ef547f first.

## Suresh's answers (2026-11-23)
- G-D35: waiting items survive on wide screens too. Opening the game (or another tab's activity) on a tablet or a sideways phone over 860px parks the lesson or set instead of ending it, with its Resume card when the player comes back. This replaces D50 at every width. Everything else on wide stays as it is.
- G-D36: a game that ends while closed (the engine mates or the game is drawn while the player is elsewhere) gets a result card, first on Play and on Home, in the Resume game card's place. Title "Your game ended", line = the game's own result line as the end card shows it (e.g. "Checkmate. Engine wins."), buttons "See the end" (main; opens the board screen at the final position with the normal game end card, tabs back, F1 rules) and "Review" (opens the review as the end card's Review does). The card goes once the player opens it either way or starts a new game. Survives a reload (the game is already saved; decide the flag from the saved game, no new key if avoidable). On wide, the same card where Resume game shows today, if there is such a place; otherwise wide shows the finished game on the board as today.

## Fixes
1. G-D35 (above). Update D50 cases at 1280 in g2b, g2 and s2b to the new rule, keeping every other wide assertion. Wide Home's "Start lesson" for the waiting lesson now resumes it (same as phones, item 2).
2. Home and Today resume the waiting item instead of restarting it, every width:
   - Home's Continue and Today's Learn step: when the waiting Learn entry is the same unit and part they would start (lesson, practice set or lesson drill), the button reads "Resume lesson" / "Resume puzzles" / "Resume drill" and resumes it at its place.
   - Today's Train step: when a Train set waits, it reads "Resume puzzles" (or "Resume drill") and resumes it.
   - A different unit or part still replaces with no question (G-D20 same-tab rule).
3. G-D36 (above).
4. Restore a counted item in its finished state: a puzzle already solved, or a square, reach or book move already scored, comes back showing its result with "Next" ready, not dealt again unsolved. Missing it can no longer show "comes back in your review list" for a puzzle recorded as solved.
5. New endgame drill (`startDrill`, `openDrill`) clears hints and arrows (resetHints), so no arrow from the game or an old drill shows.
6. Saved-entry validation: counts must satisfy `right + wrong === i + (counted ? 1 : 0)`, and must be within `count`. Unit tests.
7. Tests at 1280 for the busy fix: game engine thinking, open a lesson and a puzzle set: busy false, the board accepts a move, and the engine's reply draws nothing on the lesson or puzzle board.
8. Small:
   - A manual Flip of the game board is restored when the game comes back after a lesson or set used the board.
   - The game's hint text in the coach line is not left over when the hint count resets after parking; it matches the count.
   - `syncResume` retries a failed storage write on the next change of any kind (no tight loop).

## Not in this round (follow-ups)
- The level check opened during a drill's engine reply may get its arrow (also on main).
- Two browser tabs writing the key at once (web only).

## Gates (run one at a time)
- Unit; g2b at 360, 412, 915, 1280; g2 at 360, 412, 1280; g2d at 844; s2b, f1, s2a, g1, s1, f3b at 412 and 1280. Fresh `sh scripts/build.sh`, `sh scripts/check-ads-switch.sh`.
- One or more commits, explicit paths, commit this file too. No push.
