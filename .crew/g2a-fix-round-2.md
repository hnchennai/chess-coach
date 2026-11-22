# G2a fix round 2 (2026-11-22)

Source: delta re-reviews of `d175b56..0453989`. Both reviewers: safe for a phone test; round 1 findings all fixed. These are what the fixes left. Test-first, phones only unless said, wide unchanged.

1. SHOULD-FIX. Opening any activity on the phone board screen starts at the top of the page: `newGame`, `enterReview`, the first item of a set, a lesson, a drill, `resumeAct`, and "New game" / "Review this game" / "10 more puzzles" tapped on an end card. Today the banner-room scroll of the end card is left behind (360x800: ranks 8 and 7 hidden under the Close bar after "New game"). g2 case at 360x800 and 360x640 with ads on: after each of those taps the board's top edge is at or below the Close bar's bottom edge.
2. End card scroll is the least that clears the banner. At an end card with a banner coming, scroll only until the last end card button's bottom edge is above the banner zone, never further. If the reviewer's numbers (game end at 360x800: 77px of the board hidden) are already that least amount, say so with the measurement and change nothing.
3. Reserved room is given back when no banner comes: if the ad fails to load while the end card is up (`adLost`, and the retry-wait return in `adShow`), `#adPad` returns to 0 and the card's scroll returns to where it would be with no banner. Recompute `ad.room` before `adPad()`.
4. Today card's Learn step: when that lesson is the one waiting, the button reads "Resume lesson" and resumes at its step (same rule as the Continue card, `Flow.resumesLesson`). Every level.
5. `gid` guard: the grading chain's first `.then` (app.js near 1232) must not write `st.notes`, `st.ann`, `st.evalW` or `st.fb` from an old game's move into a new game. Guard every step of the chain. Unit or g2 case if it can be made deterministic; else explain.
6. The "Tap again to abandon it" question clears when the player leaves the Play tab or closes Settings, so a much later single tap cannot wipe the game.
7. Make the g2 "Fix 2" case and the f3b banner timing cases robust to a loaded machine (wait on the fake plugin's recorded call, not on wall-clock sleeps) without weakening what they assert.

Not in this round (follow-ups, unchanged): a game that ends while closed shows no result card; review left open across a resize; clamped scroll on Close from a past-game review; after a move under a Learn end card the lesson's "Start practice" step is only reachable from Home; bar reads "New game" over a Learn end card with a fresh board.

Gates: run suites one at a time, not in parallel. Unit; g2 at 360, 412, 1280; f3b at 360, 412, 1280; f1, s2a, s2b at 412 and 1280; g1 and s1 at 412. Fresh build, ads switch check. One commit, explicit paths, no push.
