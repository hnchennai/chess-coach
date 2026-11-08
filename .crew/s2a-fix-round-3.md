# S2a fix round 3 (small, last round)

All three reviewers said "safe to ship" on 312e09e. Three cheap nits:

- N-1 (UX): on small phones (360x640), a long Beginner strip ends behind the fixed nav when the page is at the top, so the partner's move (D34's last part) is hidden until the player scrolls. The strip height also changes per move, so Play controls jump. Fix: after the partner's move is shown in a Beginner strip on phones (max-width 600px), if the strip's bottom is below the top of the fixed nav, scroll it into view with the nearest edge, but only when that keeps the board's top on screen or the board top is already off screen; never scroll while the player is dragging a piece or has focus in another panel; respect prefers-reduced-motion (instant scroll). Do not change Improver/Club. Add an e2e at 360x640: after a partner capture with a long feedback line, the strip's bottom is above the nav's top.
- N-2 (UX): Progress at 360, the tile label "games W–L–D" wraps after "W–". Keep the label on one line (no-wrap, or shrink the label font a step on narrow phones) without overflow. Check at 360 and 412.
- N-3 (data): a device clock running ahead can bring the level-up offer back after "Not yet" (profile.js lessonOfferDue, ~143-146). Cap the finish time at `now` in `lessonOfferDue` (and anything that compares it). Add a unit test: finish time a day in the future, "Not yet" now, no offer due.

Rules: test-first with red-to-green, explicit paths, no push, do not stage .crew/ or docs/, do not touch the review worktrees. Unit + s2a e2e at 360, 412, 1280 + s1 e2e at 412 and 1280, zero console errors. Report max 20 lines.
