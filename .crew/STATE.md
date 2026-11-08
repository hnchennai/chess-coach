# Crew state: beginner flow (size L)

- Phase: 4/5, S1 final re-review, then Suresh's merge checkpoint
- Spec: docs/specs/beginner-flow.product.md + .tech.md, approved (D1 to D16)
- Branches:
  - `crew/beginner-flow`: constitution, design, spec
  - `crew/s1-level-check`: S1 build + fix round 1 (bc884d7) + spec answers
  - `crew/move-src`: source moved into `src/`, `scripts/build.sh`, handoff; plus fix round 2 (sync robustness: bad cloud game doc can't block sync; retries continue while not synced)
- Slices:
  - S1 level check, profile v5, Settings: in review. Reviews: spec (1 blocker, fixed), data (1 blocker, fixed; 2 should-fix, fixed in round 2), UX (0 blockers, should-fixes fixed). Waiting on: UX delta re-review and data re-check of round 2.
  - S2a level-based interface: planned
  - S2b beginner Home (prototype A): planned
  - S3 Play Games cloud save: parked (needs new Play Console account)
- Next action: when both re-checks pass, open one PR to main with S1 + source move; Suresh merges; publish web artifact from www/; confirm APK release.
- Open questions for Suresh: none
