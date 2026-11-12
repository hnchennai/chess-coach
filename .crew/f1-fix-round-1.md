# F1 + F2 fix round 1

Base: ef92864 on crew/f1-flow. Spec now has F-D16 to F-D29 (docs/specs/flow-rework.product.md, read the decisions table again). Three independent reviews: no blockers, no constitution or data problems, all suites green. Fix everything below.

## Owner decisions since your build (new or changed behaviour)
- A (F-D18): mid-game goal card of a lesson game uses next-step buttons. Passed: main per the tables ("Start next lesson" etc.), small "Keep playing". Failed: main "Try again", small "Keep playing". "Back to the course" leaves that card.
- B (F-D23): a part passed while another part of the same lesson is undone names that part with the signed line ("Next: practise it." / "Start practice", "Next: play it in a real game." / "Play the lesson game", "Next: one more step." / "Continue"), never "Next lesson: <same lesson>".
- C (F-D19): fix the double-recorded game, own commit, own test. userMove saves before finishGame (app.js ~823), and resumeGame's finishGame (~2039) never saves, so a finished snapshot keeps recorded=false and is recorded again at every start. Fix both paths (or have finishGame save). Do not touch existing duplicates in history. Test: end a game with the player's own mating move, reload twice, prof.games length and today's games count stay the same.
- D (F-D24): full result card with buttons on the Play tab only. On other tabs a finished game shows one line under the board (the result title), no buttons.
- E (F-D25): one source for the next step. End cards always name the same step as the Home the player sees: Beginner with Show everything on follows nextAction (full Home) everywhere; Beginner with it off follows Home.state. Remove the `prof.level === 'beginner'` vs `plain()` split (app.js ~729-746, ~1863). Test: Beginner, Show everything on, Foundations done: Home's Continue card, a passed session end card and the review-finished card all name the same step.
- F (F-D26): themed puzzle set ends with main "Go again" (same theme); "10 more puzzles" only for mixed sets.
- G (F-D27): at 860px and wider the slot is one full-width strip below both columns for every place (Home, Progress, game end, session end, learn end). Never in a column beside the board. Phones unchanged. Same visit rule and first-day rule.
- H (F-D28): Hint is `primary` only while a game, puzzle, lesson or drill is in progress; otherwise a plain button. After this, count primaries on the whole visible screen, not only inside #panel-coach: exactly one on Home (every level, with and without a finished game), on Play at game end, on Learn and Train end cards, at 360, 412, 1280. Change the tests to count screen-wide.
- I (F-D29): review-finished card labels the next step ("Next lesson: <title>" where it is a lesson; otherwise the Continue card title).
- Confirmed as built, no change: F-D16, F-D17, F-D20, F-D21, F-D22 (except F).

## Review findings to fix
- R1 (spec 1, data 4; breaks F-D12 and scenario 11): the tip changes and the card re-renders when the game is recorded or a cloud pull lands, because the card key includes prof.games[0].id (app.js ~760-771). Use the game's own identity. Test: end a game with the player's own move on day two; the tip text is identical before and after the game is recorded; revealEnd fires once.
- R2 (spec 2): the main button flips under the finger while the last move is still being graded (normal layout first, then "Start next lesson" / "Try again"). Do not show buttons until the goal state is final (show the title and line, buttons once checkGoal has run), or decide the layout before first render. Test it.
- R3 (data 3): `st.end` outlives its screen. After the Learn end card, opening Train leaves "Rated puzzles" without its primary style; `data-act="units"` does not clear it either. Clear or scope it to the tab it belongs to. Test: Learn end card, switch to Train, Train has its main button.
- R4 (spec 3, AC4): add e2e for the row "practice passed, drill or other task next" ("Next: one more step." / Continue) and for a passed drill end card in the DOM.
- R5 (UX 3): `.tipslot` uses a fixed height with overflow hidden, so a longer tip or a larger system font clips. Use min-height; the tip is fixed per visit so nothing jumps. Check the longest tip at 360 inside an end card with the fallback font.
- R6 (UX 5, 6): end cards are not announced and focus is lost. Give the end cards a polite live region or move focus to the card heading when a card appears through the player's own action (never at app start, never stealing focus from a dragged piece). After an end-card button hides or re-renders its card, send focus to a sensible target (the board region heading, the new card's main button or the selected tab), not body. Keyboard e2e for one game end and one session end.
- R7 (UX 7): the review-finished card is inserted above the Prev/Next controls, which then jump. Put it below #navControls so the controls never move; make sure the fixed nav does not cover it.
- R8 (data 5): at midnight on day one the slot appears inside an open end card, replacing innerHTML and dropping focus. Decide first-day once per card visit.
- R9 (nits): remove dead `st.bannerOff`; on a failed set the coach strip says "Session complete" while the card says "Almost there" (make the strip not contradict the card, existing copy only); add a landscape (915x412) e2e check that an end card's main button and Beginner Home's Continue are reachable, slot not covering them.

## Not changing (logged as follow-ups, do not fix)
- First-day edge cases in tips.js (level change on day 5 with no other record; clock forward or zone change on day one).
- Test realism of jump() in f1.spec.js.

## Rules
- Test-first, red-to-green evidence per item. Explicit-path commits ending with `Co-Authored-By: Claude Fable 5.2 <noreply@anthropic.com>`. C in its own commit. Do not stage .crew/ or docs/. No push. Rebuild www/ and commit it with src/.
- Any wording not in the spec is a question, not a decision.
- Final run: unit; f1 at 360, 412, 1280 (and 915 if you add it); s1 at 412, 1280; s2a at 360, 412, 1280; s2b at 360, 412, 1280, 915. Zero console errors. Playwright: NODE_PATH=/private/tmp/claude-501/-Users-suresh-code-chess-coach/b885389f-6f13-4b0c-9715-fd2fdbca9b09/scratchpad/pw/node_modules. Refresh the screenshots in scratchpad/shots-f1/ (same names) and add 1280 shots showing the slot strip below both columns, and the one-line result on Home.
- Report (max 50 lines): per item red-to-green, commits, files, moved assertions, deviations, results per suite and viewport, questions.
