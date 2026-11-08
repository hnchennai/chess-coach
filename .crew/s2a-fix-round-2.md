# S2a fix round 2

## Suresh's answer to your question 1 (D33, committed in bbf4f6a)
Reword exactly these 4 level 1 course lines (Suresh signed the new text; this is the only course text you may touch):
- src/js/course.js, Opening principles last lesson step:
  - old: `Your task: play a game against the Beginner engine and get <b>both knights, both bishops out and castle</b> by move 12. The checklist in the Play tab tracks it.`
  - new: `Your task: play a game against Rani’s practice partner and get <b>both knights, both bishops out and castle</b> by move 12. The checklist in the Play tab tracks it.`
- src/js/course.js, Opening principles apply text:
  - old: `Play the Beginner engine. Develop all four minor pieces and castle by move 12.`
  - new: `Play Rani’s practice partner. Develop all four minor pieces and castle by move 12.`
- src/js/course.js, The blunder check apply text (the game still uses OPP level 2 as today):
  - old: `Play the Casual engine. Goal: no blunders (??) in your first 20 moves.`
  - new: `Play Rani’s practice partner. Goal: no blunders in your first 20 moves.`
- src/js/roadmap.js, stage 1 method:
  - old: `Play the Beginner engine with the coach on. Read every explanation.`
  - new: `Play Rani’s practice partner with the coach on. Read every explanation.`
- Use the curly apostrophe (’) as in the rest of the app copy. Check the file's string quoting so the apostrophe cannot break the JS string.
- Your question 2 ("Keep sharp: rated puzzles", end of roadmap): leave it; logged as a follow-up.
- Everything else in course text stays (later levels get a separate pass).

## Review findings (round 1 re-reviews and UX review)

### Stage 1 delta re-review
- R2-1 should-fix: D30 is not met from stage 2 on (app.js ~1652 milestone, ~1668 Next step). For Beginners (no Show everything), the "beat" milestone and its Next step use OPP[1] (Rani's practice partner, the same bot as New game per D19) at every stage, never OPP[S.beat]. Today a Beginner at stage 2 sees "Beat Rani’s practice partner: not yet" after already beating it, and the button starts an Improver (~1000) game labelled as the partner. Add an e2e for a Beginner at stage 2 (start board, all level 1 and 2 units done, "Not yet" an hour ago, one level 1 win): Home shows the milestone done and does not start an OPP[3] game.
- R2-2 nit: review start line. Change the Beginner version to drop the clumsy double possessive: "Tap Next to step through. Every move is explained." (remove the rest of the sentence for Beginners only). Keep the other mechanical rewrites as they are; the orchestrator lists them for Suresh at merge.
- R2-3 nit: Beginner board-preview tag repeats itself ("White knight to f3 (White knight), from the position it was played in", app.js ~1907). For Beginners make it "White knight to f3, from the position it was played in."
- R2-4 nit: Progress credit line ("Analysis by Stockfish 19 (GPLv3)...") stays for every level: the constitution requires license credits. No change; keep the test's exception and add a one-line code comment saying why.
- R2-5 nit: D32 chips go stale after Show everything or a level change (refreshUI does not re-decorate existing chips; the coach strip cache key skips re-render; app.js ~1389, ~1926-1937). Re-decorate all chips (decorateChips(true)) and invalidate the strip cache in refreshUI. Add an e2e: Beginner with Show everything on, new game, turn it off: strip chip title and aria-label have no SAN.

### Stage 2b (data and sync) delta re-review
All four sync fixes hold (probes A, A2, A3, C, D, F now safe). The D-2 deviation (hold only while the cloud is unsettled) is accepted. Its finding 1 is the same as R2-1 above.
- R2-6 should-fix: an open Settings sheet goes stale after a pull (app.js ~1432, ~1823): refreshUI never re-renders #levelCard. Probe G: cloud brings Club + Show everything while Settings is open; the sheet still shows Beginner and the switch Off, so a tap does the opposite of what the player sees, or moves a Club player down. Fix: refreshUI re-renders the level card when the sheet is open, keeping focus. Add an e2e.
- R2-7 nit: focus can land on the wrong game after a pull (app.js ~1438): focusKey rebuilds from data attributes, and data-review is an index into prof.games, so a merged newer game shifts it and Enter opens the wrong review. Fix: never restore focus by index-keyed attributes (or key by game id). Add a test.
- R2-8b see below.

### Stage 2a UX review (no blockers, safe to ship; Suresh decided D34 to D36, committed)
- U-1 should-fix (D35): when a Rani note with a question (the level-up offer) appears, move keyboard focus to its first button (unless focus is inside the Settings sheet or the level check; then move it when those close). Esc closes the note without writing anything (no levelOfferT change); the offer comes back at the next app start. After Esc, focus returns to the selected tab. Add e2e: start-offer at 412 on Home, focus is on "Yes, move me up" with no Tab presses; Esc hides it and levelOfferT is unchanged.
- U-2 should-fix (D34): Beginner coach strip in play (no Show everything): line 1 bold = your grade ("Blunder.", "Best move." etc.), then your feedback text, then the partner's sentence ("Rani’s partner took your bishop. Check!"). Nothing in those three parts is clamped on phones (the strip may grow); the partner's "why" is not in the strip (it stays in the coach card). Never repeat check (no "Check! It’s check."). Before the first move, or when only one side has moved, show only what exists. Improver/Club strip unchanged. Add e2e at 360: after a graded move and a partner capture with check, all three parts are fully visible (scrollHeight <= clientHeight) and in that order.
- U-4 nit: a level change that locks Train while a puzzle set (or any Train session) is live leaves the session card unreachable and shows "The board is on Rated puzzles, 1 of 10" to a Beginner. On such a change, end the live Train session cleanly (as if the player closed it, nothing lost that a close would keep) and land on Home. Add a test.
- U-6 (D36): Beginner checkmate win banner text "Great finish. Review it." (app.js ~675). Improver/Club unchanged.
- U-7 nit: Progress at 360 for Beginners: with the rating tile hidden, 3 tiles in a 2-column grid orphan "day streak". Lay out the remaining tiles without an orphan.
- U-8 nit: the Play tab's accessible name is "Play The board is here" (live-dot title leaks into the name). Tab names must be just the label; give the live state to screen readers another way (aria-describedby or hidden text after the label is fine).
- Not this round (logged as follow-ups, do nothing): landscape phone board height; tap targets under 44px (Play controls 39px, Today buttons 36px, unit chips 34px); later-level course text (endgame drills "Stockfish defends.", opening drill names with notation, methods card "about 2100" and "rated mixed puzzles").

- R2-8 nit: a held lesson offer is lost if the session ends before the cloud settles (pendingLesson is memory only; app.js ~1613-1621, ~1843). Course parts already store their completion time (markUnit stores Date.now()). Fix without a new field: at a settled start, also offer when the latest completion time among the current level's counted units is later than max(levelOfferT, levelT). Add a unit test in profile.js if you put the helper there.

## Rules for this round
- Test-first: a failing test for each item (R2-1, R2-2, R2-3, R2-5, R2-6, R2-7, R2-8, U-1, U-2, U-4, U-6, U-7, U-8, and D33's 4 course lines) before the fix; report red-to-green.
- Commit with explicit paths on crew/s2a-level-ui. Do not stage .crew/ or docs/.
- Unit + s2a e2e at 360, 412, 1280 + s1 e2e at 412 and 1280, zero console errors. Refresh shots-s2a/ (same names) and add 360_strip_order.png and 412_offer_focus.png.
- Report (max 40 lines): per item red-to-green, files, any new copy not listed here (there should be none), deviations, test results, questions.

## Round 2 re-review notes (accepted, no change)
- Stage 1 delta: safe to ship. Nits accepted: Esc closes every Rani note (harmless, writes nothing); R2-1 test's notEqual(level, 3) is a weak assert but the milestone asserts cover it; U-8 removes the live-dot hover title for every level.
- For S2b: a Beginner who keeps saying "Not yet" moves on to Stage 3 "Endgames and calculation" on Home (follows D30). S2b's Beginner Home should decide what a long-time Beginner sees.
- Data delta 2: safe to ship, no should-fix. Nit: a device clock running ahead can re-show the offer after "Not yet" until real time catches up (profile.js lessonOfferDue). Optional fix: cap the finish time at Date.now(). Do it if a round 3 happens, else follow-up.
