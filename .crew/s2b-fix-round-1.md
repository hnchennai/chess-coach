# S2b fix round 1 (from Stage 1 + UX reviews at 2c6dc29, and Suresh's answers)

Spec updated in commit on this branch: D49, D50, D51 and scenarios 13, 14 in docs/specs/beginner-flow.product.md (read them). Test-first as before: failing test, then code, then green; report red-to-green per item.

## Business decisions (Suresh, confirmed)
F1 (D49) Ask before dropping a game. On Beginner Home only: when a game is unfinished (`G.history().length && !G.game_over()`) and the Continue card's next part is a lesson game (apply part of `opening` or `blunder`), tapping Continue does NOT start the task. Instead Rani's note (the existing one-at-a-time queue, question style like the level-up offer: takes keyboard focus, sits above the nav) says exactly "You have a game going. Finish it first?" with buttons "Back to my game" (opens the old game on Play, same as the second button) and "Start the lesson game" (starts the lesson game as Continue does today). Esc or closing keeps the old game and does nothing else; nothing is saved. Learn's Start buttons and every other path are unchanged. Unit-test the copy in home.test.js; e2e = scenario 13.
F2 (D50) Keep "Back to my game" ending an open lesson or puzzle set (no change). Add a short code comment that this is D50, and one e2e assertion that puzzle results already answered are kept.
F3 (D51) Sideways phones: Beginner Home also hides the board when the viewport height is 500px or less (any width), and Rani, the card and both buttons sit in one centred column (max about 480px) so the Continue button is fully on the first screen at 915x412 and 844x390. Desktop (1280x900) and tablet (768x1024, 1024x768) keep today's behaviour from D38. Learn and Play unchanged. e2e = scenario 14 at 915x412 (add a viewport or a case that sets it).

## Review findings to fix
F4 [should-fix, Stage 1] tests/e2e/s2a.spec.js, case S1-2/S1-3/D30 and case R2-1: restore the dropped S2a guards on a Show everything (`showAll: true`) Beginner seed, where the full Home shows: stage hero line "Play slowly, blunder-check every move, and review the game after.", "1 of 2 milestones" (rating goal not counted), stage card milestones without /rating|engine/i, Today "10 puzzles" / "0 of 10 today." and no "rated" (only if still true with showAll; if Show everything is meant to show rating words there, say so and do not invent an assertion), and R2-1's roadmap "stage 2: level 1 win counts" milestone and "stage 2 is done" hero checks. Keep the new #bhome assertions too. If an old assertion no longer holds under showAll by design (D8/D22 reveal ratings), report which and why instead of forcing it.
F5 [nit, Stage 1] tests/home.test.js: assert every Foundations (course level 1) unit id in the real course (load course.js + roadmap.js like the other unit tests) has a PAIRS entry, so a new lesson cannot silently fall back to title-only.
F6 [nit, UX] src/js/coach3d.js: under prefers-reduced-motion, draw once per mood/size change instead of redrawing every 400 ms. Keep mood changes working.

## Not in this round (logged as follow-ups by the orchestrator)
- Keyboard order: tab bar before the Home panel in the DOM (pre-existing since the S2a fixed nav).
- h1 reachable by Tab with no outline (check only: if it is tabbable by accident and the fix is one attribute, include it and say so; otherwise leave it).
- Desktop: board's green Hint button plus Home's primary button (pre-existing).

## Then
- `sh scripts/build.sh`; unit tests; s2b at 360, 412, 1280 (+ the sideways case); s2a at 360, 412, 1280; s1 at 412, 1280. One e2e process at a time. Zero console errors.
- Refresh affected screenshots in shots-s2b (add 915x412 sideways Beginner Home and the ask-first note at 360 and 412).
- Commit with explicit paths (src, tests, scripts, rebuilt www); never stage .crew/. Report max 40 lines: red-to-green per item, test results per viewport, any deviation.
