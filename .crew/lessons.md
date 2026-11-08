# Build Crew lessons: Chess Coach

## 2026-11-08 chess-coach beginner-flow slice 1 (size L)
Numbers: slices 1, blockers 3 (spec 1, data 2; first two were the same bug), should-fix 17, overridden 0, fix rounds 3 (2 builder, 1 small orchestrator), CI reds 0, corrections after gate 0, escapes 0 so far
Slice scores: S1 = 2 of 3 so far (spec held, CI green first time, first review not clean; escape check due 2026-11-15)
User verdict: Smooth.
- L1 [win][Phase 4] Data reviewer caught a cloud wipe: a push could land before the session's first pull. The bug existed before; the new first-launch save made it likely. Rule: any slice that adds a write on first launch or sign-in gets a sync-race review with a slow, failing and late pull. Scope: crew. Confidence: high.
- L2 [rework][Phase 4] A round-2 fix wrapped a cloud read in try/catch and treated "unreadable" as "empty", opening a new wipe path. Re-review caught it. Rule: sync error handling fails closed (retry, push nothing), never treats an error as empty data. Scope: crew. Confidence: high.
- L3 [win][Phase 0] Independent spec review found 2 blockers before any code (course start point; reinstall overwriting the cloud level). Scope: crew.
- L4 [friction][Phase 3/4] Background agents in a remote session paused while the session was idle: the builder stalled overnight and two reviewers for 40 minutes. Rule: in remote sessions keep long agent work inside an active turn, or run it in Claude Code. Scope: crew. Confidence: high.
- L5 [friction][Phase 1] The web source lived outside git (scratchpad), which blocked moving to Claude Code. Fixed by moving it to src/. Rule: Readiness checks that the source of truth is in the repo. Scope: crew.
- L6 [questions][Phase 0] Builder found 4 business gaps: what Skip does on a retake vs first run, partial skip in a bonus round, whether a manual level pick sets a rating, and a history cap vs "never lose". Rule: for every skip or cancel, ask what it does on first run vs retake. Scope: crew.
- L7 [friction][Phase 1] The Play Console account had been closed for inactivity, found only at setup time. Rule: Readiness checks third-party accounts are active before planning a slice on them. Scope: crew.
