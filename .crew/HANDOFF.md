# Handoff: Suresh's Chess Coach

Start any new session with: "Use build-crew, continue from .crew/HANDOFF.md". Read CONSTITUTION.md, DESIGN.md, this file and `.crew/STATE.md` first.

## How the project works
- `src/` is the source of truth: `head.html` (CSS), `body.html` (markup), `js/*.js` (app.js is the main app). Plain JS, no bundler.
- `sh scripts/build.sh` builds `www/` from `src/`. Never edit `www/js` or `www/index.html` by hand.
- `www/` holds everything the app needs offline: `vendor/` (chess.js 0.10.3, Three.js r128, GLTFLoader), `sf/` (Stockfish 19 lite WASM), `models/` (marble set, CC BY 4.0).
- Android: Capacitor 6. GitHub Actions (`.github/workflows/build-apk.yml`) builds and signs on every push. Pushes to `main` publish a GitHub Release `v1.0.<run>` with `.apk` and `.aab`. Suresh installs updates with Obtainium.
- Signing: release key alias `chesscoach`, only in GitHub secrets `ANDROID_KEYSTORE_BASE64` and `ANDROID_KEY_PASSWORD`. Suresh holds the backup. Never commit a keystore.
- Web version: a claude.ai artifact (https://claude.ai/artifact/9TP4qbQZzroJGhDtGWs67L), last published at v1.0.13 (version 18), now loading vendor/ files like Android. It can be republished from a Claude session that has the Artifact tool, using the files in `www/`. Later: host `www/` on GitHub Pages or Cloudflare Pages for selling.
- Puzzle bank: `src/js/puzzles.js` is generated. To rebuild it: `npm i chess.js@0.10.3` in a scratch folder, then `node tools/mkbank.js <(cat data/mined*.jsonl) src/js/puzzles.js`. `tools/miner.js` mined the positions with Stockfish.

## Tests
- Unit: `node --test tests/*.test.js` (profile, placement, words, course).
- E2E (Playwright, headless): `S1_VP=412 node tests/e2e/s1.spec.js`, `S2A_VP=360|412|1280 node tests/e2e/s2a.spec.js`. One viewport per process. Playwright is not in the repo: install it in a scratch folder and set NODE_PATH (on Suresh's Mac, Playwright 1.63.0 matches the cached Chromium). In a cloud sandbox with software GL, set `S1_TIMEOUT=15000`.
- Every slice: screenshots at 360, 412 and 1280, zero console errors.

## Accounts
| Service | Account | Resource | Notes |
|---|---|---|---|
| GitHub | hnchennai | hnchennai/chess-coach | Actions builds APK; secrets above |
| Claude | Suresh | web artifact above | `db` + `user` capabilities for Claude-account sync |
| Google Play Console | none active | | Old account closed for inactivity (Apr 2024). Suresh will register a new one later; cloud save (S3) waits for it |

## Current work: beginner flow (size L)
Spec: `docs/specs/beginner-flow.product.md` and `.tech.md` (approved by Suresh; decisions D1 to D16, plus S2a details D17 to D37).
- S1 level check, profile v5, Settings: shipped (PR #1, Android v1.0.13, web artifact version 18).
- S2a level-based interface: shipped (PR #3, Android v1.0.20). Beginner hides scores, notation and engine words; plain move words; fixed bottom nav; tab unlock; level-up offer; Improver/Club Home at their level; level 1 course text says Rani's practice partner.
- S2b beginner Home (prototype A: Rani, one Continue card, "Just play a game"): next. Also decide what a long-time Beginner who keeps saying "Not yet" sees on Home.
- S3 Play Games cloud save: parked until the new Play Console account exists. Setup steps for Suresh are in the tech spec. It must plug into S2a's "cloud settled" check before the level-up offer.
- Follow-ups: see `.crew/STATE.md` (later-level course text, landscape board, small tap targets, CI install robustness).

## Decisions log (short)
- No AI calls in the app. Offline first. Original designs only. No em dashes.
- Levels: Beginner, Improver, Club. Level check on first launch; Rani offers level-ups; hints unlimited.
- Prototype canvas of the flow: https://claude.ai/artifact/VozbHkSXBRZg67RNn2EoiR
- Keep the 30-game history cap.
- Beginners never see ratings, accuracy %, eval, notation or engine names unless Show everything is on; the Stockfish license credit stays for everyone.
- CI pins sharp 0.33.5 (package.json overrides) because sharp 0.32 downloads its binary from GitHub releases, which can fail.

## Working notes
- Background helper agents in remote Claude sessions pause when the session is idle. Keep long builds and reviews inside an active turn, or run them locally in Claude Code.
- Suresh likes short, crisp bullets, plain words, and no em dashes.
