# F1 + F2 builder brief (flow rework, then tip slot)

Role: Builder for slices F1 and F2. Repo /Users/suresh/code/chess-coach, branch `crew/f1-flow` (already checked out, base main bc00c0a, spec commit 375c06b). Work in this checkout. You have no memory of the planning chat; everything you need is in the files below.

## Read first
- CONSTITUTION.md (must obey; a violation is a blocker), DESIGN.md, .crew/HANDOFF.md, .crew/lessons.md.
- docs/specs/flow-rework.product.md: the whole file. It is the source of business truth, including exact copy. Mockups (for look only): https://claude.ai/artifact/1w7FN46dmJuwkXAT9P551w is private, so follow the spec text and the Beginner card's existing CSS (`.bh-*`).
- docs/specs/beginner-flow.product.md: sections S2a (D17 to D37) and S2b (D38 to D51). Those rules stay true.
- Code: src/js/app.js (one IIFE; `result`, `renderBanner`, session end card near `finishSession`, `nextAction`, `renderBHome`, `renderCoach`, `renderToday`, review mode, `exitMode`, `startPart`, `dayRec`, `streakDays`), src/js/home.js (pure, Node-tested), src/js/profile.js, src/head.html (CSS), src/body.html, scripts/build.sh, tests/*.test.js, tests/e2e/s1.spec.js, s2a.spec.js, s2b.spec.js.
- No stack skills apply (plain JS).

## Key rules from the constitution
- Progress is never lost. Any profile shape change ships a `migrate()` step (prefer no new field: the first-day rule can be derived from `prof.days`, but note that list is trimmed to 60 days and a player with any earlier day is past day one; if you find you need a field, add it with migrate and merge rules and say so).
- Works fully offline. No AI calls. No network request added in these slices. No ads code at all.
- No em dashes in user-facing copy. Curly apostrophe (’) in new copy. Beginners (no Show everything) never see ratings, notation or engine names (`plain()` / `speak()`).
- Source of truth is src/. Run `sh scripts/build.sh` and commit the rebuilt www/ files with src/. Never hand-edit www/.
- Mobile first: 360px wide must work one-handed. Tap targets 44px. Focus outlines. prefers-reduced-motion.
- Commits: explicit paths only (never `git add -A`), small logical commits, each ending with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. Never stage .crew/, docs/, signing files, node_modules. No push, no PR.
- Out of bounds: signing/, keystores, GitHub secrets, puzzle bank (src/js/puzzles.js), course text (course.js, roadmap.js), CONSTITUTION.md, docs/.

## Slice F1 (commit first, on its own)
Acceptance criteria 1 to 5, 12, 13 of the spec, scenarios 1 to 9:
1. Improver and Club Home, and a Beginner with Show everything on: a Continue card first (reuse the Beginner card look), driven by the same result as `nextAction` so the target never differs from today. Kicker, title and button per the spec table. Stage card loses its "Next step" button and sub line. Exactly one primary button on Home.
2. Game result: no box over the board; a result card under the board in Play, per the "After a game" table, including lesson-game cases and the review-finished card.
3. Lesson step and puzzle set end card: per the "After a lesson step or puzzle set" table. Not passed never offers the next step. "Back to the course" and "Close" leave the end card.
4. Every end card has a small "Home" button. D49 ask-first still applies to any main button that would start a lesson game over an unfinished game. D39: a Beginner's end card never names a lesson outside Foundations.
5. Put the "which end card" decision in a pure function (extend home.js or a new pure UMD module added to scripts/build.sh before app.js) and unit-test every table row.

## Slice F2 (after F1 is green, separate commits)
Acceptance criteria 6 to 11, scenarios 10 to 15:
1. Tip slot component: tinted card, coach picture, label "Rani’s tip" / "Gaja’s tip", one tip. Fixed height (min 76px), no layout shift. `role="note"`, not focusable.
2. Places: game end card, session end card, bottom of Home (all levels, under Beginner Home's buttons), bottom of Progress. Nowhere else; never while a lesson, game, puzzle or review is in progress.
3. First-day rule: hidden on the first calendar day; shown from the next day. A clock set backwards must not break anything.
4. Tips: the two lists in the spec, character for character, in a pure module with a unit test that no Beginner tip has notation, digits-as-ratings or engine names and no tip has an em dash. Beginner list for `level === 'beginner'` even with Show everything on. Tip picked once per screen visit (stable across re-renders).
5. Leave one clearly named seam where a later slice can put an ad in the same box (for example a single `renderSlot(el)` function with a comment), but ship no ads code and no network call.

## Method: test-first
- For each criterion write the failing test first, run it (red), then the minimum code (green), then refactor. Report red-to-green evidence: test name, failing message before, passing after.
- Unit: `node --test tests/*.test.js`.
- E2E: create `tests/e2e/f1.spec.js` following s2b.spec.js's pattern (Node static server for www/, profiles seeded via addInitScript into localStorage key `suresh-chess-coach.profile.v1`, `window.__coach` helpers; extend `__coach` only if needed). Use `F1_VP=360|412|1280`, one viewport per process. Cover scenarios 1 to 15, zero console errors, and a check that no request leaves the page origin.
- Playwright is not in the repo. Install it outside the repo: `mkdir -p /private/tmp/claude-501/-Users-suresh-code-chess-coach/b885389f-6f13-4b0c-9715-fd2fdbca9b09/scratchpad/pw && cd` there, `npm init -y`, `npm i playwright@1.63.0` (matches the cached Chromium; if the browser is missing run `npx playwright install chromium`). Then prefix e2e commands with `NODE_PATH=<that folder>/node_modules`. Never npm install inside the repo.
- Always `sh scripts/build.sh` before e2e. Existing suites must stay green: s1 at 412 and 1280, s2a and s2b at 360, 412, 1280 (s2b also 915). Where this spec changes a screen an old test asserts (the game result box, "Back to the course", the stage card's Next step button), move the assertion to the new place and list each moved assertion in your report. Do not weaken or delete any other assertion.
- Screenshots for the UX reviewer: PNGs in `/private/tmp/claude-501/-Users-suresh-code-chess-coach/b885389f-6f13-4b0c-9715-fd2fdbca9b09/scratchpad/shots-f1/` at 360, 412 and 1280: Improver Home, Club Home, Beginner Home with slot, game end card (win, loss), lesson-game passed card, session passed, session not passed, review finished, Progress with slot, first-day Home (no slot), dark mode of one end card.

## Rules
- If the spec does not answer a business question (rule, wording, edge case), do NOT guess: skip that part, finish the rest, and list it under "Questions for the user" with options and a recommendation. Any user-facing string not in the spec is a question, not a decision.
- Purely technical choices are yours; say why.

## Report (max 60 lines)
Files changed; commits; red-to-green evidence per criterion; technical decisions and why; moved assertions; deviations; unit and e2e results per suite and viewport; screenshot paths; questions for the user (business); open technical questions.
