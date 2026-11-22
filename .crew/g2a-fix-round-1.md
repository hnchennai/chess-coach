# G2a fix round 1 (2026-11-22)

Source: two independent reviews of `1d16df1..HEAD` (spec; UX, integration and ads) plus Suresh's answers.
Method: test-first. Each fix gets a case that fails on d175b56 first. Phones only unless said; wide screens (over 860px) stay unchanged and the 1280 suites must pass with no behaviour edits.

## Suresh's answers (2026-11-21)
- Close on a review opened mid-game returns to the game. As built. Keep.
- Beginner line: "Move 12, Rani's partner to move". As built. Keep.
- "Back to my game" is renamed to "Resume game" everywhere, now (Continue card's play step for every level, Today's Play step, Rani's question button).
- Resume card sub-lines and the Close bar titles are approved as built.

## Fixes
1. BLOCKER. Banner and tip over a live board under a Learn end card (app.js `endUp` / `activityOn`, flow.js `inUse` / `slotOk`).
   - Rule: on an end card the slot is allowed only if the board on screen is not a game in progress (no moves, or over). If the board under the end card is the unfinished saved game: no tip, no banner.
   - A move played on the board under an end card ends the end-card state in the same step: banner and tip hide, tab bar hides, the Close bar reads "Your game" with the move line.
   - While a Learn end card is up, the Close bar must not name the lesson over a board that shows the game; fix the label to match what the board shows.
   - Unit test in flow.test.js for the rule; g2 case that plays a move under the end card and asserts hide in the same step.
2. Banner covers end card buttons (criterion 5 of ads spec). When an end card is revealed and the slot rule allows a banner there, scroll and pad at reveal time as if the banner (its real reported height, else 64px, plus the 8px gap) were already up, so every end card button is above the banner zone and nothing moves when the banner arrives 1 s later. Assert at 360x800 and 412x915 for a game end card and a Learn end card: no button rectangle meets the banner zone.
3. "Start new game" must ask ("Tap again to abandon it") whenever an unfinished game with moves exists, whatever `st.mode` is (today it skips the question when a closed lesson or set is waiting).
4. A waiting lesson or set must survive browsing: "All levels", opening a unit page, and looking at lists on Learn or Train do not end it. Only starting another activity does (until G2b). On the phone board screen, hide the lesson step card's own back button ("‹ unit title"); Close replaces it.
5. Rename "Back to my game" to "Resume game" in all places (see answers). When the Continue card's action is already the game, do not also show the separate Resume game card on that Home (no two buttons for one action). Update s2b and g2 cases; add a g2 case seeded with a Beginner past Foundations with a game going.
6. Drills. On phones a drill started from Train closes to Train and its "Resume drill" card is first on Train. A drill started from Learn stays with Learn. Match G-D20's wording.
7. Home's Continue button for a lesson that is waiting resumes it at its step, and reads "Resume lesson" (every level).
8. Saving. Save the game to storage as soon as a move is made (before grading), and `closeAct` calls `save()`. g2 case: move, reload at once, the move is there.
9. After "Next" in a puzzle set, a lesson step, or a drill item on the phone board screen, scroll so the board's top is just under the Close bar.
10. `newGame` path that returns without clearing `st.busy` (app.js near 1231): clear it, so a new game started during the engine's think is playable.
11. Small:
    - 601 to 860px: the Close bar sits 8px low until scroll. Make it flush.
    - Close bar title: `role="heading" aria-level="1"`, and a label when `#actText` takes focus.
    - 3D context lost and not yet restored: ignore taps on the board until it is drawn again.
    - Remove `Flow.tabsHidden` and its test if the app does not use it, or use it.
    - g2.spec.js:655: record `scrend` at call time so the check can tell an end-card call from a board-screen call.
    - Add same-frame checks for opening a lesson, a set and a review.

## Not in this round (logged as follow-ups)
- A game that ends while closed (engine mates after Close) shows no result card; it is only in Recent games.
- Review open on a phone, widen past 860, tap Home, narrow again: mode stays `review` with no card.
- Close from a past-game review returns to Progress at a clamped scroll.

## Gates
- Unit all green; g2 at 360, 412, 1280; f1, s1, s2a, s2b, f3b, g1 at 1280 and 412; f3b and g1 also at 360. Fresh `sh scripts/build.sh`, `sh scripts/check-ads-switch.sh`.
- Commit on the branch with explicit paths. No push, no PR.
