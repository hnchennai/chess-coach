# S2a fix round 1

## Suresh's answers to your questions (spec D23 to D28, now in docs/specs/beginner-flow.product.md)
- D23 Beginners (no Show everything) never read "Stockfish" or "the engine" anywhere they can reach (play, review, puzzles, lessons, Blunder check, Progress, Home). The opponent is "Rani's partner"; analysis is Rani speaking as "I". Signed examples:
  - "Exactly what Stockfish would play." -> "Exactly the move I’d play."
  - "Stockfish slightly preferred X" -> "I slightly preferred X."
  - "Engine to move" -> "Rani’s partner to move"
  - "The engine wins this one. ..." -> "Rani’s partner wins this one. ..." (keep the rest of the sentence)
  - "This is Stockfish’s top choice here. ..." -> "This is the best move here. ..."
  - Other lines follow the same rule mechanically: "the engine" as opponent -> "Rani’s partner"; "Stockfish"/"the engine" as the analyser -> "I"/"me" or "the best move". Keep each sentence otherwise identical. List every string you changed (old -> new) in your report so Suresh can see them at merge.
  - Improver and Club: unchanged. Endgame drills (level 3+) may stay as they are if a Beginner cannot reach them; say which.
- D24 "Safe or blunder?" item title for Beginners: "White wants to play this move." (or "Black ..."); the board arrow shows the move. No SAN.
- D25 Locked Beginner (Train not unlocked, no Show everything) Today card heading: "Learn it, then play it". The "All done. Great work!" heading stays.
- D26 Accuracy % (review bar, Progress history, anywhere else) hidden for Beginners unless Show everything. Move grade words stay.
- D27 Keep the curly apostrophe (’) in new copy. Keep "You took a queen." (signed pattern).
- Your open technical question: yes, switch s1.spec.js to the same Node static server you used in s2a (test-only change, no behaviour change).

## More decisions from Suresh (D29 to D32, committed in dfb708a)
- D29 Improver/Club Home at their level: for Improver and Club, use an effective start = the later of the stored `start` and the first unit of `LEVELS[level].courseLevel`, for nextUnit() and everything built on it (Home Next step, Today step 1, roadmap "You are here", Learn's "next" marker). Do NOT change the stored `start`, any lesson, or levelComplete/unlockDone. Unfinished earlier lessons stay open in Learn. Covers v4-migrated players (start 'rules').
- D30 Beginners (no Show everything): stage progress ignores the puzzle-rating milestone (hidden and not required, at every stage). After a stage's lessons, Next step is "Beat Rani’s practice partner" with the existing sub "Play slowly, blunder-check every move, and review the game after." Today step 2 for unlocked Beginners: title "10 puzzles", sub "N of 10 today." (no rating, no "rated"). Remove the unsigned "Ten puzzles a day moves it fastest." line for Beginners.
- D31 Home never suggests lessons before the start point, for every level (your current behaviour; keep it).
- D32 Beginners: keep the chip tip hidden, and also drop SAN from the chip's title and aria-label ("White knight to f3. Tap to see it on the board."). Show everything restores the tip and SAN title.

## Stage 1 (spec compliance) findings to fix
- S1-1 should-fix: derived Improver/Club Home at stage 1 (app.js firstStage ~1595, nextAction ~1598). Fix per D29. Add an e2e: v4 profile rating 1000 with one game -> Home shows stage 2 and Next step "Learn: Forks"; Today step 1 is Forks.
- S1-2 should-fix: unsigned copy "10 rated puzzles" / "Ten puzzles a day moves it fastest." for Beginners (app.js ~1601 and Today step 2 ~1288). Fix per D30.
- S1-3 should-fix: Beginner rating milestone hidden but still required by stageDone (~1590-1591). Fix per D30.
- S1-7 nit: changes that touch Improver/Club visuals: h1 margin-right:auto at every width (head.html ~596), engine pill shapes at every width (~598-601), global .tabs grid change (~603), pullCloud re-rendering every panel (~1758). Keep the pill shapes (accessibility gain, fine). Prove the desktop header and tabs at 1280 look the same as base d743777 for Club and Improver apart from the pill shape (side-by-side screenshots in shots-s2a/base-vs-new/). If anything moved, scope the CSS so it does not. Make sure a full re-render on pull never steals focus or resets scroll, or keep it but say why.
- S1-8 test gaps: run scenario 8 checks at 412 too (nav and Rani note above the nav), not only 360; test the mid-game mode bar "Your game vs Rani’s practice partner, you play White"; test hiding in the 3D view (eval, pill, Moves card stay hidden after toggling 3D, or skip with a reason if WebGL is unavailable headless); test a stale offer being dropped on a Settings level change; the derived Improver Home test above.

## Stage 2b (data and sync) findings to fix
- D-1 should-fix: start trigger runs after a cloud setup error (app.js ~1778, initCloud .catch calls startOfferCheck()). Errors must fail closed (crew lesson L2). Only the genuine "no cloud runtime" branches may run the start check (no `window.claude`, or the account path that means no cloud on purpose). When `use()` or `user.id()` rejects, skip the start offer for this session (or retry and run it only after a real first pull). Add a probe-style e2e: user.id() rejects -> no offer note, nothing changes.
- D-2 should-fix: the lesson trigger is not held while the cloud is unsettled or the level is provisional (markUnit ~942, answerOffer ~1560). When `(cloud.game && !cloud.ready) || prof.provisional`, record "level completed this session" instead of offering. After the first merge settles, offer if the level is unchanged and still complete (ignoring levelOfferT, per D21). Add e2e: slow pull held, finish the last lesson, no offer yet; release a pull with a newer chosen Club level; no offer and the level stays Club. And: release a pull with no level change; the offer appears.
- D-3 nit: `offerChecked` is set before the `Placement.isOpen()` test (~1571-1572), so a retake open at first pull loses the start offer for the session. Set the flag after that test and re-run the check when the level check finishes or is cancelled.
- D-4 nit: a late retried pull can pop the "app start" offer mid-game or mid-lesson (~1759). If the first merge lands while a lesson, puzzle session or game is in progress, hold the start offer until the player next opens Home (or the activity ends).

## Rules for this round
- Test-first: a failing test for each item above before the fix; report red-to-green.
- Commit with explicit paths on crew/s2a-level-ui. Do not stage .crew/ or docs/ (the orchestrator commits those).
- Unit + s2a e2e at 360, 412, 1280 + s1 e2e at 412 and 1280, zero console errors. Refresh the screenshots in shots-s2a/ (same names), plus base-vs-new/ for S1-7.
- Report (max 50 lines): per item red-to-green, files, every engine-word string changed old -> new (D23), any new copy not listed here, deviations, test results, questions.
