# Crew state: beginner flow (size L)

- Phase: S2a shipped; next S2b
- Spec: docs/specs/beginner-flow.product.md + .tech.md, approved (D1 to D16); S2a details D17 to D37 approved
- Slices:
  - S1 level check, profile v5, Settings: merged (PR #1), Android v1.0.13, web artifact version 18. Monitor: escape check due 2026-11-15.
  - S2a level-based interface: merged 2026-11-08 (PR #3, squash 61042e2), Android release from main build #20 (v1.0.20). Three reviews safe to ship after 3 fix rounds; 21 more decisions (D17 to D37). Monitor: escape check due 2026-11-15.
  - S2b beginner Home (prototype A): next after S2a. Decide what a long-time Beginner who keeps saying "Not yet" sees (today they move on to stage 3 "Endgames and calculation").
  - S3 Play Games cloud save: parked until Suresh has a new Play Console account. Must plug into S2a's "cloud settled" check for the level-up offer.
- Follow-ups logged in S2a (not done):
  - Course-text pass for later levels: endgame drills "Stockfish defends.", notation in opening drill names, Home methods card "about 2100" and "rated mixed puzzles", "Keep sharp: rated puzzles", checkpoint goals "(about 1000)".
  - Landscape phone: board taller than the screen (pre-existing).
  - Tap targets under 44px: Play controls 39px, Today buttons 36px, unit chips 34px (pre-existing). On 360px phones the Hint button sits under the nav until the player scrolls (taller Beginner strip, D34).
  - CI: Gradle now comes from a signed-in download with a checksum check; still worth caching ~/.gradle/wrapper/dists and adding a package-lock.json.
  - Web artifact (claude.ai) still runs S1 (v1.0.13 build); republish from www/ when Suresh wants the web version updated.
- S2a working files: .crew/s2a-brief.md, s2a-review-briefs.md, s2a-fix-round-1/2/3.md (kept as history).
- Open questions for Suresh: merge this retro PR; republish the web artifact?
