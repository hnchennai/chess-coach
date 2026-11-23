# G2b fix round 2 (2026-11-23)

Source: delta re-reviews of `2ef547f..d6ac08e`. Both: safe for a phone test, no blocker. Test-first: each fix fails on d6ac08e first. Wide changes only where named.

1. SHOULD-FIX (regression from round 1, item 4). The last square or reach item of a set, counted, then a restart or Close inside the auto-advance wait: "Resume drill · 12 of 12" opens nothing and the card just goes; the part is marked done with no end card. `nextItem`'s skip-ahead calls `finishSession` before the mode and board screen are set. Resume must open the board screen and show the set's normal end card ("Session complete", tabs back, F1 rules, slot as for any set end card). Same for any kind whose last item is restored counted (rated puzzle, opening line, drill).
2. Wide: a game that ended while a lesson or set was on the board. Play's note and the mode bar must not say "paused" or "Resume game" for a finished game. Use the approved wording: note "Your game ended." with the button "See the end" (opens the finished game on the board with its end card, clears `unseen`). Mode bar the same.
3. The ended-game card's line says who won. Use the game's result: "Checkmate. You win!" / "Checkmate. Engine wins." / for a Beginner "Checkmate. Rani's partner wins." (G-D28 pattern; Beginners never see "engine"); draws use the end card's own draw title (e.g. "Stalemate", "Draw by repetition"). If the end card's own title already says the result for a loss, reuse it; otherwise these are the only new lines allowed.
4. Save the counted item's own outcome in the saved entry (one value per counted item: solved or missed), and restore from it, not from the profile's last record. Applies to rated, theme, practice, Review missed and Safe or blunder.
5. Safe or blunder: an answered question restored after Close or a reload comes back answered (its verdict shown, Next ready), as item 4 of round 1 did for puzzles.
6. Today's Train step: when it resumes a waiting set, its title is that set's title (as on Train's Resume card), not the title of a different set.
7. Test `g2b.spec.js` "Item 8: failed write" (around lines 686-688) is timing-bound and flakes at 412. Assert the outcome (the failed write is retried on the next change, and the key ends correct) without depending on how many renders run in one click.

Not in this round: a game recorded `unseen` on another device keeps its card there until opened (accepted); the level check during a drill's engine reply (follow-up).

Gates, one at a time: unit; g2b at 360, 412 (run three times), 915, 1280; g2 at 412 and 1280; s2b at 412 and 1280; f1 at 412. Fresh build, ads switch check. Commit with explicit paths, this file included. No push.
