# F1 + F2 fix round 2 (small, last round)

Base: c769a6b. All three reviewers said "Safe to ship: yes". Spec now has F-D30 to F-D33. Five small items:

- T1 (F-D31): "Try again" on a lesson game whose goal failed mid-game restarts that lesson game at once, no D49 question. D49 stays for every other path (end cards, Home, Learn). Update the test that expects the question here.
- T2 (F-D32, spec reviewer 1): end-card slots (Learn end, set end, and the desktop strip for them) are hidden while a game is unfinished, like Home and Progress (app.js ~716-718). Test: Improver, day two, paused game of 4 moves, finishes the Learn part of Forks: no slot at 412 and no strip at 1280.
- T3 (UX b): when a lesson game's goal is decided mid-game, the goal card is revealed (same rule as revealEnd: only if the board stays on screen, reduced motion respected) and announced through #endLive, so its main button is not left under the fixed nav at 360. Never at app start.
- T4 (F-D30, UX a): when the goal card has no main button (only "Keep playing"), Hint keeps its filled style, so the screen still has one main action. Test it.
- T5 (F-D33): when the review-finished card's line is "Next lesson: <title>", its button reads "Start next lesson" (signed copy), not "Start lesson".
- T6 (spec reviewer 2): FR-G also asserts the strip's geometry: top at or below the bottom of both columns, width equal to the .app content width.

Not fixing (follow-ups): cloud copy of an old finished game stays unrecorded for other devices; slot visit cache after a merge; newGame not clearing st.busy; focus on resize across the breakpoint; coach picture drawn a frame late in the strip.

Rules as before: test-first with red-to-green, explicit-path commit ending with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`, no push, do not stage .crew/ or docs/, rebuild www/. Final run: unit; f1 at 360, 412, 1280, 915; s1 at 412, 1280; s2a and s2b at 360, 412, 1280 (s2b also 915). Report max 25 lines.
