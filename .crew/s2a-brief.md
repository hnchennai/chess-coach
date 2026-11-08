# S2a builder brief (level-based interface)

Role: Builder for slice S2a of the beginner flow. Repo /Users/suresh/code/chess-coach, branch `crew/s2a-level-ui` (already checked out, base d743777 on main a4eec97).

## Read first
- CONSTITUTION.md (pasted below, must obey; a violation is a blocker), DESIGN.md, .crew/HANDOFF.md, .crew/lessons.md.
- docs/specs/beginner-flow.product.md: sections "Levels", "Interface by level", acceptance criteria 6, 7, 8, 10, 14, 15, and the whole "Slice S2a: level-based interface (details)" section. That section is the source of business truth for this slice, including the exact copy.
- docs/specs/beginner-flow.tech.md: "Interface by level" and "Sync safety rules".
- Code: src/js/app.js (one IIFE, ~1840 lines), src/js/profile.js (pure, Node-testable), src/head.html (CSS), src/body.html (markup), src/js/placement.js, scripts/build.sh, tests/profile.test.js, tests/e2e/s1.spec.js.
- No stack skills apply (plain JS, no framework).

## Constitution (paste)
- Users: people learning chess, from never played to Expert. Many are complete beginners on a phone. Sold as a paid game (Android, web).
- A player's progress must never be lost: course progress, puzzle rating, games and settings survive updates, restarts and offline.
- Works fully offline. Rani is the voice of the app: warm, short, plain words.
- No AI or LLM API calls. Original designs only. No em dashes in any user-facing copy. Short sentences, no chess jargon for beginners without a visual explanation.
- Secrets never in git, chat or logs. No ads, trackers or analytics.
- Progress lives in one profile object `prof` (versioned `v`). Any shape change ships a `migrate()` step. Merging never deletes progress. Local storage keys keep the `suresh-chess-coach.` prefix.
- Plain HTML, CSS, JS, no build step beyond scripts/build.sh. Pinned libs: chess.js 0.10.3, Three.js r128, Stockfish 19 lite.
- Source of truth is src/. `sh scripts/build.sh` builds www/. Never hand-edit www/js or www/index.html. Commit the rebuilt www/ files together with src/.
- Every slice tested in headless Chromium with Playwright at 412x915 and 1280x900, zero console errors. Mobile first: every screen works one-handed at 360px.
- Commits use explicit paths (never `git add -A`) and end with: `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. One PR per slice.
- Out of bounds: signing/, any keystore, GitHub secrets, puzzle bank content (src/js/puzzles.js), course text (lesson/unit text in course.js and roadmap.js).

## Decisions already made (Suresh)
- D17 Beginners: no Moves card. Rani's coach strip says the last move in plain words; in review, the move you are on.
- D18 Move chips (piece icon + square, tap to preview) stay in Rani's text for every level.
- D19 Beginners: no opponent picker. "New game" always plays OPP[1] (Beginner, ~400), shown as "Rani's practice partner". Lesson apply tasks still choose their own opponent. Show everything or a level change brings the picker back.
- D20 Level-up offer counts units from the player's start point.
- D21 Offer timing: right after the lesson part that completes the level; and at app start when 7 days have passed since max(levelOfferT, levelT). One Rani note at a time (queue).
- D22 Show everything reveals every hidden element, including the engine pill and opponent picker, without changing level, hints or course.
- Hints stay unlimited for every level (no change).

## Acceptance criteria for this slice
1. Visibility by level, driven by `document.documentElement.dataset.level` and `dataset.showall` (already set by `applyLevel()`), plus a JS helper for numbers inside strings:
   - Beginner without showAll: eval strip (#evalbar) hidden, engine pill hidden, Moves card (#movesCard incl. legend and sanhint) hidden, opponent picker (the Opponent label/select in #newCard) hidden, and every rating number hidden: #oppLevel tag, mode bar "(~700)", puzzle mode "rated 950", session meta rated bits, Home Today steps "(~N)" and "Puzzle rating N", streak "Puzzle rating", Stage milestones and nextAction rating text, Progress stats rating tile and "Suggested opponent (~N)", Train rated card numbers. Applies in 3D view, puzzles, lessons and review too.
   - Improver without showAll: only the engine pill is hidden.
   - Club: everything shown. showAll: everything shown for any level.
   - Changing level or showAll in Settings updates every visible screen at once, mid-game too, without losing the game.
2. Beginner (no showAll) opponent: name "Rani's practice partner", no rating tag; mode bar "Your game vs Rani's practice partner, you play White" (or Black). Applies to any opponent while in Beginner mode. Beginner "New game" uses OPP[1]. Improver and Club keep today's picker and default.
3. Last move in words (Beginner, no showAll). Exact copy:
   - partner: "Rani's partner moved a knight." / "Rani's partner moved a pawn forward." / "Rani's partner took your bishop." / "Rani's partner castled to keep the king safe." / "Rani's partner turned a pawn into a queen."
   - you: "You moved a knight." / "You moved a pawn forward." / "You took a bishop." / "You castled to keep your king safe." / "You turned a pawn into a queen."
   - Check appends " Check!". Checkmate replaces the sentence: "Checkmate. Rani's partner won." / "Checkmate. You won!"
   - King and queen (only one each): partner "moved the king" / "moved the queen", you "moved your king" / "moved your queen". Capture plus promotion: "took your rook and turned a pawn into a queen." Underpromotion names the piece. En passant is a pawn capture.
   - In play: the coach strip's "Engine replied Nf6: <why>" becomes "<sentence> <why>". In review: the strip title for a move is the sentence for that ply (user moves "You ...", engine moves "Rani's partner ..."), keeping the grade words (Best move, Mistake...).
   - Put the sentence builder in a new pure module `src/js/words.js` (UMD like profile.js: `window.Words` / `module.exports`), taking a chess.js verbose move plus `mine` boolean, and add it to the script list in scripts/build.sh before app.js. Unit-test every row above in `tests/words.test.js`.
4. Bottom nav fixed on phones (max-width 600px) for every level: `.tabs` fixed to the bottom, 56px tall + `env(safe-area-inset-bottom)`, icons + labels, active tab filled with accent; page content gets matching bottom padding so nothing hides behind it; the 3 or 5 tabs share the width evenly. Rani's note (`.raninote`), the Settings sheet and the level check stay usable: the note sits above the nav, never over it. Desktop layout unchanged.
5. Tab unlock: Beginner without showAll shows only Home (tab-coach), Learn (tab-path) and Play (tab-play) until `Profile.unlockDone(prof, UNITS, unitDone)` is true; Train and Progress tabs and panels are hidden and unreachable (switchTab falls back to coach). When a `markUnit` call flips unlock from false to true (computed with showAll treated as off), show the Rani note "New: Train and Progress. Practise with puzzles and see how you're doing." and the two tabs appear at once. Toggling showAll never shows this note. No new profile field for this (derive it from the transition).
6. Beginner Train card after unlock (no showAll): heading "Puzzles at your level", text "Puzzles picked for you. Solve them to get stronger.", button "Start 10 puzzles". Improver/Club unchanged.
7. Level-up offer:
   - New pure functions in profile.js with unit tests: `levelComplete(p, units, unitDone)` = level is beginner or improver and every unit with `u.level === LEVELS[level].courseLevel` at or after the start index is done (all parts). Club is never complete. `offerDue(p, now)` = levelComplete and `now - Math.max(p.levelOfferT, p.levelT) >= 7 days`.
   - Lesson trigger: when a `markUnit` call flips levelComplete from false to true, show the offer (regardless of levelOfferT).
   - Start trigger: after the profile is loaded at app start (and after the first cloud merge), show the offer when `offerDue` is true and no level check is open.
   - Offer is a Rani note with two buttons. Beginner: "Ready for Improver? You finished every Foundations lesson. Next come forks, pins and other tactics." Improver: "Ready for Club? You finished every Tactics lesson. Next come endgames and seeing two moves ahead." Buttons "Yes, move me up" and "Not yet".
   - Yes: `Profile.setLevel(prof, next, { placed: 'chosen', units: UNITS })` (rating only changes if `rn === 0`, start moves to the new level's start), `unlockAll = true`, save, apply, re-render; then note "You're an Improver now. All tabs are open." or "You're Club level now."
   - Not yet: `levelOfferT = now`, save; note "OK. I'll ask again in a week. You can change it any time in Settings."
   - One Rani note at a time: if a note is open (for example S1's "You're set as Improver" note), queue the next and show it after OK/close.
   - Nothing changes level without a tap.
8. Improver and Club Home: the "Next step", Today's step 1 and the stage roadmap start at the player's level, not stage 1. Use the stage of the start unit (or of nextUnit()) as the first candidate stage; units before the start point are never suggested. Beginner Home unchanged (S2b redoes it).
9. Club engine pill below 400px shows its state without colour alone (a shape or icon difference plus an accessible name).
10. Carry-over fixes: the level check's close X is in the same corner (top right) on welcome and result screens; after the level check closes, focus goes to the selected tab button, not body; Esc in Settings closes only the sheet and leaves a sticky move tip behind it alone.
11. All new copy exactly as above; no em dashes anywhere you add.

Out of scope: Beginner Home redesign (S2b), cloud save (S3), any course or puzzle content change, hint changes, new profile fields (if you think one is needed, stop and ask under Questions).

## Method: test-first
- For each criterion write the failing test first and run it (red), then the minimum code (green), then refactor. Report red-to-green evidence: test name, the failing message before, passing after.
- Unit: `node --test tests/profile.test.js tests/placement.test.js tests/words.test.js`.
- E2E: create `tests/e2e/s2a.spec.js` following s1.spec.js's pattern (it serves www/ itself; seed profiles via addInitScript into localStorage key `suresh-chess-coach.profile.v1`; window.__coach exposes st, getProf, startPart, etc.; extend __coach only if needed). Cover scenarios 1 to 9 of the S2a spec section, the 360px nav check and zero console errors. Use `S2A_VP` like s1's `S1_VP` to run one viewport per process.
- Playwright is not in the repo. Use the copy in the scratchpad: prefix commands with `NODE_PATH=/private/tmp/claude-501/-Users-suresh--claude-spares-spare-vu0JVv/b885389f-6f13-4b0c-9715-fd2fdbca9b09/scratchpad/pw/node_modules` (Playwright 1.63.0, Chromium already cached). Never npm install inside the repo.
- Always `sh scripts/build.sh` before e2e. Run viewports as separate processes. s1.spec.js must still pass at 412 and 1280.
- Screenshots for the UI reviewer: save PNGs to `/private/tmp/claude-501/-Users-suresh--claude-spares-spare-vu0JVv/b885389f-6f13-4b0c-9715-fd2fdbca9b09/scratchpad/shots-s2a/` at 360, 412 and 1280: Beginner play mid-game, Beginner review, unlock note, level-up offer, Improver play, Club play at 360, Beginner with Show everything on, Settings sheet open over the nav.

## Rules
- If the spec does not answer a business question (rule, wording, role, edge case), do NOT guess: skip that part and list it under "Questions for the user" with options and a recommendation.
- No push, no PR, no network calls beyond what tests need. Commit on `crew/s2a-level-ui` in small logical commits with explicit paths, including the rebuilt www/ files. Never stage .crew/ files, node_modules, signing files.
- Keep the app working offline and with prefers-reduced-motion. Follow DESIGN.md (tap targets 44px, focus outlines, no colour-only meaning).
- Sync safety (tech spec): a level-up or offer answer must not push to the cloud before the session's first pull finished (use the existing saveProfile/push path, which already waits).

## Report (max 60 lines)
Files changed; red-to-green evidence per criterion; technical decisions and why; deviations; unit and e2e results per viewport (s1 and s2a); screenshot paths; questions for the user (business); open technical questions.
