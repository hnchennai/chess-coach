# Handoff: Suresh's Chess Coach

Start any new session with: "Use build-crew, continue from .crew/HANDOFF.md". Read CONSTITUTION.md, DESIGN.md, this file and `.crew/STATE.md` first.

## How the project works
- `src/` is the source of truth: `head.html` (CSS), `body.html` (markup), `js/*.js` (app.js is the main app). Plain JS, no bundler.
- `sh scripts/build.sh` builds `www/` from `src/`. Never edit `www/js` or `www/index.html` by hand.
- `www/` holds everything the app needs offline: `vendor/` (chess.js 0.10.3, Three.js r128, GLTFLoader), `sf/` (Stockfish 19 lite WASM), `models/` (marble set, CC BY 4.0).
- Android: Capacitor 6. GitHub Actions (`.github/workflows/build-apk.yml`) builds and signs on every push. Pushes to `main` publish a GitHub Release `v1.0.<run>` with `.apk` and `.aab`. Suresh installs updates with Obtainium.
- Signing: release key alias `chesscoach`, only in GitHub secrets `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEY_PASSWORD`. Suresh holds the backup. Never commit a keystore.
- Web version: a claude.ai artifact (https://claude.ai/artifact/9TP4qbQZzroJGhDtGWs67L), last published at app 1.0.7 level. It can be republished from a Claude session that has the Artifact tool, using the files in `www/`. Later: host `www/` on GitHub Pages or Cloudflare Pages for selling.
- Puzzle bank: `src/js/puzzles.js` is generated. To rebuild it: `npm i chess.js@0.10.3` in a scratch folder, then `node tools/mkbank.js <(cat data/mined*.jsonl) src/js/puzzles.js`. `tools/miner.js` mined the positions with Stockfish.

## Tests
- Unit: `node --test tests/profile.test.js tests/placement.test.js`
- E2E (Playwright, headless): `S1_VP=412 node tests/e2e/s1.spec.js` and `S1_VP=1280 node tests/e2e/s1.spec.js`. Run the two viewports as separate processes. In a cloud sandbox with software GL, set `S1_TIMEOUT=15000`.
- Every slice: screenshots at 360, 412 and 1280, zero console errors.

## Accounts
| Service | Account | Resource | Notes |
|---|---|---|---|
| GitHub | hnchennai | hnchennai/chess-coach | Actions builds APK; secrets above |
| Claude | Suresh | web artifact above | `db` + `user` capabilities for Claude-account sync |
| Google Play Console | none active | | Old account closed for inactivity (Apr 2024). Suresh will register a new one later; cloud save (S3) waits for it |

## Current work: beginner flow (size L)
Spec: `docs/specs/beginner-flow.product.md` and `.tech.md` (approved by Suresh; decisions D1 to D16).
- S1 level check, profile v5, Settings: built, reviewed twice, fixes in. Branch `crew/s1-level-check`. Remaining before merge: data re-review should-fixes (see STATE.md), then Suresh's merge checkpoint.
- S2a level-based interface, fixed bottom nav, tab unlock, level-up offer: next.
- S2b beginner Home (prototype A: Rani, one Continue card, "Just play a game"): after S2a.
- S3 Play Games cloud save: parked until the new Play Console account exists. Setup steps for Suresh are in the conversation and in the tech spec.

## Decisions log (short)
- No AI calls in the app. Offline first. Original designs only. No em dashes.
- Levels: Beginner, Improver, Club. Level check on first launch; Rani offers level-ups; hints unlimited.
- Prototype canvas of the flow: https://claude.ai/artifact/VozbHkSXBRZg67RNn2EoiR
- Keep the 30-game history cap.

## Working notes
- Background helper agents in remote Claude sessions pause when the session is idle. Keep long builds and reviews inside an active turn, or run them locally in Claude Code.
- Suresh likes short, crisp bullets, plain words, and no em dashes.
