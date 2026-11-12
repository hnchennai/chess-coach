# S2b builder brief (Beginner Home, prototype A)

Role: Builder for slice S2b of the beginner flow. Repo /Users/suresh/code/chess-coach, branch `crew/s2b-beginner-home` (checked out, base 5628dc6 = spec commit on main e9d87cb).

## Read first
- CONSTITUTION.md (pasted below; a violation is a blocker), DESIGN.md, .crew/HANDOFF.md, .crew/lessons.md (L8 to L12).
- docs/specs/beginner-flow.product.md: "Interface by level", the whole "Slice S2a" section (D17 to D37 must stay true), and the whole "Slice S2b: Beginner Home (details)" section. S2b is the source of business truth, including exact copy.
- Code: src/js/app.js (one IIFE ~2080 lines; Home = `renderCoach()` ~l.1712, `renderToday()` ~l.1307, `renderLook()` ~l.1413, `nextAction()`, `stageMiles()`, `bestWinLevel()`, `streakDays()`, `unitDone/unitStarted/nextPart/partDesc`, `plain()`, `applyLevel()/refreshUI()`, `switchTab()`, `newGame()`, click handler ~l.2017, Settings `openSettings()/renderLevelCard()`), src/js/profile.js (pure, UMD, Node-testable), src/js/words.js (UMD example), src/js/avatar.js (`Avatar.coach(mood,size)`), src/js/coach3d.js (`Coach3D.get()` = 'rani' | 'gaja'), src/head.html (CSS; S2a block at the end), src/body.html (`#panel-coach`, `#settingsSheet`), scripts/build.sh (script list), tests/*.test.js, tests/e2e/s2a.spec.js (harness pattern).
- No stack skills apply (plain JS).

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
- Out of bounds: signing/, any keystore, GitHub secrets, puzzle bank (src/js/puzzles.js), course text (lesson/unit text in course.js and roadmap.js).

## Decisions (Suresh, all in the spec)
D38 board hidden on Beginner Home up to 860px wide; D39 Keep practising after Foundations; D40 Show everything = full Home; D41 "Coach and pieces" in Settings for every level; D42 Rani's lines; D43 streak chip from 1 day; D44 "Back to my game"; D45 count from start; D46 Continue card order and button words; D47 "Beat Rani's practice partner" card; D48 Gaja wording. "Beginner Home" below always means level beginner AND showAll off.

## Acceptance criteria
1. Board (D38): on Beginner Home at viewport width <= 860px, the board column (`.boardcol`, incl. mode bar and sync line) is hidden and the Home content sits right under the header. On every other tab, at > 860px, for Improver/Club, or with Show everything, the board shows exactly as today. Switching tab, level or Show everything toggles it at once (no reload). Hiding must not end, reset or save over a running game, lesson or session.
2. Beginner Home content: only a new Beginner Home block in `#panel-coach`: coach avatar (`Avatar.coach`, the chosen coach, Rani or Gaja), speech bubble (headline + one line), streak chip, Continue card, second button. `#stageHero`, `#today`, `#stageCard`, `#roadCard`, `#lookCard`, `#methodsCard` are hidden. Improver, Club, and Beginner with Show everything: today's Home exactly as now, new block hidden (D40).
3. Continue card states (D46, D45, D47, D39). Units = Foundations units (course level 1) at or after `prof.start` in course order.
   - Next unit u = first of those not `unitDone`. Kicker "Lesson N of M" (N = u's position in that list, 1-based; M = list length). Title = u.title. Bar = done count of that list / M, with an accessible text ("3 of 7 lessons done"). Button "Start lesson" if `!unitStarted(u)`, else "Continue"; it runs `startPart(u.id, nextPart(u))` with `st.unitOpen = u.id`.
   - Rani line follows `nextPart(u)`: 'learn' = that lesson's pair below; 'practice' = "Now let’s practise." / "A few quick ones on the board."; 'apply' (game task) = "Now try it in a real game." / "You’ll play my practice partner."
   - No unit left and no win yet (same test as D30 in `stageMiles`: `bestWinLevel() >= Profile.LEVELS.beginner.opp`): kicker "Next step", title "Beat Rani’s practice partner", no bar, button "Play now" = a new game vs Rani's practice partner (as the `recgame` action does for plain()); with an unfinished game the button reads "Back to my game" and opens it. No second button. Rani: "You finished every Foundations lesson!" / "Now beat my practice partner."
   - No unit left and a win: kicker "Practice", title "Puzzles at your level", no bar, button "Start 10 puzzles" = `trainStart('rated')` (signed S2a Train copy). Rani: "You know the basics now." / "Keep practising, or move up to Improver any time in Settings." Home never points a Beginner at a Tactics (level 2) lesson.
   - New-lesson pairs (exact, curly apostrophe ’): rules "Today you’ll learn how the pieces move." / "Each piece has its own way. I’ll show you every one."; special "Today: castling and other special moves." / "And the ways a game can end in a draw."; board "Today you’ll learn to find any square." / "Every square has a name. Soon you’ll know them all."; values "Today: what each piece is worth." / "Then you’ll spot free pieces and keep yours safe."; mate "Today you’ll learn check and checkmate." / "Checkmate wins the game. Let’s spot it in one move."; opening "Today: how to start a game well." / "Bring your pieces out and keep your king safe."; blunder "Today: one quick check before every move." / "It stops most lost pieces."
   - Gaja (D48): when `Coach3D.get() === 'gaja'`, "my practice partner" reads "Rani’s practice partner" in both lines that have it.
   - Card icon: a piece glyph per lesson in a tinted square (your choice, decorative, aria-hidden), like the prototype.
4. Second button (D44): outline button under the card. No unfinished game: "Just play a game" = new game vs Rani's practice partner, Play tab. Unfinished game (same test as today's Today Play step: `G.history().length && !G.game_over()`): "Back to my game" = Play tab with that game on the board; nothing is abandoned, no "tap again" warning. Hidden in the "Beat Rani’s practice partner" state.
5. Streak chip (D43): `streakDays() >= 1` shows "1 day" / "N days" with a small flame icon (aria-hidden) and an accessible name like "Streak: 3 days"; hidden at 0.
6. Show everything (D40): on = full Home exactly as an Improver's (today's renderCoach at the Beginner's stage) with the board; off = Beginner Home back; no reload.
7. Settings "Coach and pieces" (D41): a section in the Settings sheet under the level card for every level, same choices and behaviour as `renderLook()` (render the same markup into a second container; no duplicate ids). Choosing updates at once, including Home's card for Improver/Club. Focus trap, Esc and keyboard reach the new buttons; the sheet scrolls on a 360x800 phone. Improver/Club Home keeps `#lookCard`.
8. Re-render at once on level change in Settings, Show everything, cloud merge (`refreshUI`), finishing a lesson part, a game ending, and coming back to Home.
9. No jargon on Beginner Home (L8): no rating number, "~N", "rated", accuracy %, eval, notation (SAN like Nf3, e4), "Stockfish" or "engine". Only Foundations lesson titles appear ("Board and notation" is a title and is fine).
10. Layout (DESIGN.md + prototype A): avatar about 96 to 120px on phones; bubble = one headline (16 to 18px, 600) + one line (muted); card radius 12 to 16px; primary button `.big` (>= 48px, full width on phones); second button outline, >= 48px; tap targets >= 44px; exactly one primary button on Beginner Home. At 360x800 and 412x915 every element of the block, both buttons included, is fully visible on the first screen above the fixed bottom nav, with no Rani note open. Desktop 1280: board left, the block in the side panel. Dark mode, focus outlines, prefers-reduced-motion. Rani's notes (unlock, level-up offer) still sit above the nav.
11. Improver and Club Home unchanged (D29 behaviour kept): the rendered Home text for an Improver and a Club seed is identical before and after this slice.
12. Migrated profiles (L9): a raw v4 profile (`v: 4`, no level fields; rating 700, some games, `rules` done) migrates to a derived Beginner and gets Beginner Home "Lesson 2 of 7" / "Special rules and draws"; v4 rating 950 gets the unchanged Improver Home; v4 rating 1350 the unchanged Club Home. A derived v5 Beginner with `unlockAll: true` also gets Beginner Home.
13. All new copy exactly as above; no em dashes.

Out of scope: Improver/Club Home changes, Learn/Play/Train/Progress changes, course or puzzle text, hints, cloud save, new profile fields (if you think one is needed, stop and ask under Questions).

## Method: test-first
- Put the state and copy logic in a new pure UMD module `src/js/home.js` (`window.Home` / `module.exports`), e.g. `Home.state(prof, units, unitDone, unitStarted, nextPart, hasWin)` -> { kind: 'lesson'|'beat'|'practice', unit, n, m, done, part, started } and `Home.lines(state, coach)` -> { head, line, kicker, title, button }. Add it to scripts/build.sh before app.js. Unit-test every state and every copy row in `tests/home.test.js` (character for character).
- For each criterion: failing test first (red), then code (green), then refactor. Report red-to-green evidence: test name, failing message before, passing after.
- Unit: `node --test tests/*.test.js` (60 pass on main).
- E2E: new `tests/e2e/s2b.spec.js` following s2a.spec.js (serves www/ itself; seeds localStorage `suresh-chess-coach.profile.v1`, game `suresh-chess-coach.v1`, tab `suresh-chess-coach.tab`; `window.__coach` exposes st, getProf, startPart, trainStart, nextUnit, hist, openSettings; extend only if needed). `S2B_VP=360|412|1280`, one viewport per process. Cover S2b scenarios 1 to 12, AC1 (board hidden on Home <= 860, shown on Play/Learn and at 1280), AC9 jargon scan of the block's text, AC10 first-screen fit at 360 and 412 (bounding boxes vs viewport minus nav), AC11 Improver/Club Home text, AC12 v4 seeds, zero console errors. Seed streak via `prof.days` keys (see `dkey()`); seed a win via `prof.games` ({ r: 'W', level: 1, ... }).
- Playwright is not in the repo. Prefix runs with `NODE_PATH=/private/tmp/claude-501/-Users-suresh--claude-spares-spare-vu0JVv/b885389f-6f13-4b0c-9715-fd2fdbca9b09/scratchpad/pw/node_modules` (Playwright 1.63.0, Chromium cached). Never npm install in the repo.
- Always `sh scripts/build.sh` before e2e. s1.spec.js (412, 1280) and s2a.spec.js (360, 412, 1280) must still pass. If an s2a case asserts old Beginner Home content that S2b replaces (for example D25's Today heading or the stage hero's "Next step" for a Beginner), move that assertion to the new block or to Show everything, and list each changed assertion with the reason in your report. Never weaken a test that guards S2a behaviour outside Home.
- Screenshots for the UX reviewer: PNGs to `/private/tmp/claude-501/-Users-suresh-code-chess-coach/1fa05105-b321-4dd4-96b7-3a73615513f4/scratchpad/shots-s2b/` at 360, 412 and 1280: new Beginner Home, mid-lesson with streak, Karthik, Back to my game, Beat partner, Keep practising, Gaja coach, dark mode Beginner Home, Show everything full Home, Settings with Coach and pieces (Beginner and Club), Improver Home, level-up offer note over Beginner Home.

## Rules
- If the spec does not answer a business question (rule, wording, role, edge case), do NOT guess: skip that part and list it under "Questions for the user" with options and a recommendation.
- No push, no PR, no network beyond tests. Commit on `crew/s2b-beginner-home` in small logical commits with explicit paths, including rebuilt www/ files. Never stage .crew/, node_modules, signing files.
- Offline and prefers-reduced-motion keep working. DESIGN.md rules (tap targets 44px, focus outlines, no colour-only meaning, no card inside a card).
- Never run two e2e processes on the same results/port at once.

## Report (max 60 lines)
Files changed; red-to-green evidence per criterion; technical decisions and why; deviations; changed s2a assertions with reasons; unit and e2e results per viewport (s1, s2a, s2b); screenshot paths; questions for the user (business); open technical questions.
