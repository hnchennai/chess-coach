# Crew state: beginner flow (size L)

- Phase: S1, S2a and S2b shipped. S3 parked.
- Spec: docs/specs/beginner-flow.product.md + .tech.md, approved (D1 to D16); S2a details D17 to D37 and S2b details D38 to D51 approved
- Slices:
  - S1 level check, profile v5, Settings: merged (PR #1), Android v1.0.13, web artifact version 18. Escape check 2026-11-17: 0 escapes.
  - S2a level-based interface: merged 2026-11-08 (PR #3, squash 61042e2), Android release from main build #20 (v1.0.20); web artifact version 19. Three reviews safe to ship after 3 fix rounds; 21 more decisions (D17 to D37). Escape check 2026-11-17: 0 escapes.
  - S2b beginner Home (prototype A): PR #5 open 2026-11-08, branch crew/s2b-beginner-home, merge is Suresh's call. 14 decisions (D38 to D51), 12 questions in 5 rounds, all recommended options. Long-time "Not yet" Beginner: Keep practising (D39). Two reviews (spec, UX) safe to ship after 1 fix round. CI green first time (runs 42493933967, 42493990368). Escape check 2026-11-17: 0 escapes.
  - S3 Play Games cloud save: parked until Suresh has a new Play Console account. Must plug into S2a's "cloud settled" check for the level-up offer.
- Follow-ups (not done):
  - Course-text pass for later levels: endgame drills "Stockfish defends.", notation in opening drill names, Home methods card "about 2100" and "rated mixed puzzles", "Keep sharp: rated puzzles", checkpoint goals "(about 1000)".
  - Landscape phone: board taller than the screen on Learn and Play (pre-existing; Beginner Home fixed in S2b, D51).
  - Keyboard order: on phones the fixed nav comes before the page in the DOM, so Tab reaches Home, Learn, Play before Home's Continue (since S2a).
  - Desktop: the board's green Hint button and Home's primary button both look primary (pre-existing).
  - Tactics and later course text for Beginners who open those lessons from Learn: notation (Nf7+, Bxh7) and "the Improver engine (about 1000)".
  - Tap targets under 44px: Play controls 39px, Today buttons 36px, unit chips 34px (pre-existing). On 360px phones the Hint button sits under the nav until the player scrolls (taller Beginner strip, D34).
  - CI: Gradle now comes from a signed-in download with a checksum check; still worth caching ~/.gradle/wrapper/dists and adding a package-lock.json.
  - Web artifact (claude.ai) republished as version 19 with S2a (index.html, js/app.js, course.js, profile.js, roadmap.js, words.js). After S2b merges it needs another republish, including the new js/home.js.
- Working files kept as history: .crew/s2a-brief.md, s2a-review-briefs.md, s2a-fix-round-1/2/3.md; .crew/s2b-brief.md, s2b-review-briefs.md, s2b-fix-round-1.md.
- S2b merged 2026-11-12 (PR #5, bc00c0a), Android v1.0.26, web artifact version 20.

## Flow rework and tip slot (size L), spec docs/specs/flow-rework.product.md
- Phase: F1 + F2 merged 2026-11-12 (PR #6, b4a0b2b), Android v1.0.28, web artifact version 21. Escape check run early on 2026-11-17: 0 escapes so far; look once more on or after 2026-11-19.
- Constitution changed (approved by Suresh): free with ads and a one-time Remove ads purchase, 13 and older, ads only in the ad slot.
- F1 flow: Continue card on Improver and Club Home, result card under the board (Play only), end cards with a next step, review-finished card. F2: tip slot (no ads code), first-day rule, desktop strip below both columns. Also F-D19: a finished game is recorded once.
- 33 decisions (F-D1 to F-D33), 21 questions in 7 rounds. Three reviews (spec, UX, data) safe to ship after 2 fix rounds.
- Next slices: F3b ads SDK + consent (needs AdMob IDs and a website for the privacy policy and app-ads.txt); F4 Play listing and closed test (needs the Play Console account, 12 testers for 14 days); F5 Remove ads purchase.
- Follow-ups (not done):
  - A finished game saved by a version before F-D19 stays unrecorded in the cloud copy, so each other device records it once more. Idea: push the game when local and cloud time stamps match but `recorded` differs.
  - Take back after a finished game clears "recorded", so finishing again adds a second history row (existing).
  - First-day rule edge cases: level change on a later day with no other record hides the slot that day; clock forward or zone change on day one shows it.
  - Slot visit cache after a cloud merge; newGame does not clear st.busy; focus lost when a window crosses the 860px breakpoint with an end card open; coach picture in the strip can draw a frame late.
  - f1.spec.js fast-forwards sets with jump(); at 915 only the LAND case runs.

## F3a Android target and licence, 2026-11-13 to 2026-11-17
- Licence: Suresh chose to publish the source under GPLv3 because the app ships Stockfish. PR #9 merged 2026-11-13 (5e423c2), Android v1.0.33, web artifact version 22. Repository made public on 2026-11-14 on Suresh's instruction.
- F3a: Capacitor 6 to 8, target Android 16 (API 36), Node 22, JDK 21, CI fails if the target is below 36. PR #8 merged 2026-11-17 (208baf9), Android v1.0.36. No ads code.
- Phone test before merge found one fault: the title drew under the status bar, because the phone-width `.wrap` rule reset the top padding and dropped the inset. Fixed with a test (tests/insets.test.js). Suresh confirmed build 1.0.35 on his phone (title, tabs, progress kept). Level check and Settings screens were not looked at on the phone.
- Escape checks on 2026-11-17 (main at 208baf9): no issues filed, nothing reported by Suresh from daily use of v1.0.33, unit 122 pass, e2e at 360, 412 and 1280 green (results in the retro PR).
- Follow-ups (not done):
  - Web artifact is one CSS change behind main (the inset fix; no visible change in a browser).
  - From Suresh's screenshots, not confirmed as faults: the Learn tab stays highlighted while a Play game is on the board; the captured-pieces count is cut off at "+1:".
  - Public repository: require approval before outside contributors' workflow runs (Suresh's setting).
  - Escape check for F3a due 2026-11-24.
