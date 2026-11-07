# Chess Coach Constitution

Non-negotiables for every change. Short on purpose. Amend only with Suresh's explicit yes.

## Product truths
- Users: people learning chess, from "never played" to Expert (about 2000+). Many are complete beginners on a phone.
- Suresh's Chess Coach will be sold as a paid game on Android (Play Store) and the web.
- A player's progress must never be lost: course progress, puzzle rating, games and settings survive app updates, restarts and going offline.
- The app works fully offline. The network is only ever optional (cloud save, fonts).
- Rani (the queen coach) is the voice of the app: warm, short, plain words.

## Hard rules
- No AI or LLM API calls from the app, ever. All coaching text comes from local rules, the course and Stockfish.
- Original designs only: no copyrighted characters, logos or artwork (no Harry Potter, Marvel, Game of Thrones and similar).
- No em dashes in any user-facing copy. Short sentences, no chess jargon for beginners without a visual explanation.
- Third-party assets keep their licenses and credits: Stockfish (GPLv3, source link in README), Three.js (MIT), chess.js (BSD-2), "A Beautiful Game" marble set (CC BY 4.0).

## Security and privacy
- Signing keys, passwords and tokens never go in git, chat or logs. CI reads them from GitHub secrets.
- Collect the minimum personal data. Cloud save stores only game progress, keyed by the player's Play Games account.
- No ads SDKs, trackers or analytics without Suresh's explicit yes.

## Data rules
- Progress lives in one profile object (`prof`, versioned with `v`). Any shape change ships a `migrate()` step that keeps old saves working.
- Merging two copies of progress (device and cloud) never deletes progress: union of completed work, newest for settings.
- Local storage keys keep the `suresh-chess-coach.` prefix.

## Engineering rules
- Plain HTML, CSS and JavaScript, no build step. Pinned libraries: chess.js 0.10.3, Three.js r128, Stockfish 19 lite (WASM worker).
- Source of truth for the web build lives in the scratchpad `t/` folder and is built with `build.sh`; `www/` in this repo is the synced Android copy with offline `vendor/` paths.
- Android: Capacitor 6, built and signed in GitHub Actions. Version is `1.0.<run number>`.
- Every slice is tested in headless Chromium with Playwright at phone size (412 x 915) and desktop (1280 x 900) before review. No console errors.
- Mobile first: every screen must work one-handed at 360px wide.
- Commits use explicit paths (never `git add -A` on mixed work) and end with the Claude co-author trailer. One PR per slice, squash merge.

## Checkpoints (always ask Suresh)
- Merging to main (this ships a phone update to everyone on Obtainium).
- Publishing to the Play Store or changing Play Console / Play Games settings.
- Anything that costs money or deletes a player's data.
- Product decisions, wording of the course, and amendments to this file.

## Out of bounds
- `signing/`, any `.jks` or keystore file, GitHub secrets.
- The puzzle bank content and course text, unless the slice is about them.
