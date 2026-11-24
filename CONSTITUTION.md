# Chess Coach Constitution

Non-negotiables for every change. Short on purpose. Amend only with Suresh's explicit yes.

## Product truths
- Users: people learning chess, from "never played" to Expert (about 2000+). Many are complete beginners on a phone.
- Chess Coach is free on Android (Play Store) and the web, with ads and a one-time Remove ads purchase. The Play Store listing is for ages 13 and older.
- A player's progress must never be lost: course progress, puzzle rating, games and settings survive app updates, restarts and going offline.
- The app works fully offline. The network is only ever optional (cloud save, fonts, ads). The coach's tip always stays in the slot; the ad banner is separate.
- Rani (the queen coach) is the voice of the app: warm, short, plain words.

## Hard rules
- No AI or LLM API calls from the app, ever. All coaching text comes from local rules, the course and Stockfish.
- Original designs only: no copyrighted characters, logos or artwork (no Harry Potter, Marvel, Game of Thrones and similar).
- No em dashes in any user-facing copy. Short sentences, no chess jargon for beginners without a visual explanation.
- The app's own source is published under GPLv3 (Suresh's decision, 2026-11-13), because it ships Stockfish. Every release must match the public source. Nothing private (keys, tokens, personal data) ever goes in the repo.
- The app's own code carries an exception (`LICENSE-EXCEPTION`, Suresh's decisions, 2026-11-19 and 2026-11-24) that allows combining it with Google's Mobile Ads, User Messaging and Play Billing libraries, the Google Play In-App Review Library and the Google Play Core Common library it uses, and the Google Play services libraries they use. Stockfish is never modified and never linked with them.
- Third-party assets keep their licenses and credits: Stockfish (GPLv3, source link in README), Three.js (MIT), chess.js (BSD-2), "A Beautiful Game" marble set (CC BY 4.0).

## Security and privacy
- Signing keys, passwords and tokens never go in git, chat or logs. CI reads them from GitHub secrets.
- Collect the minimum personal data. Cloud save stores only game progress, keyed by the player's Play Games account.
- Ads are one banner strip at the bottom of the screen, above the tab bar, only on screens where the tip slot shows: after an activity ends, and on Home and Progress. Never over or beside the board, never during a lesson, game, puzzle or review, never full screen, never on a player's first day, never on the web version. Ads are non-personalised and rated PG or lower. Before the Play launch, builds show test ads only. No other trackers or analytics without Suresh's explicit yes. Adding or changing an ads SDK is a checkpoint.

## Data rules
- Progress lives in one profile object (`prof`, versioned with `v`). Any shape change ships a `migrate()` step that keeps old saves working.
- Merging two copies of progress (device and cloud) never deletes progress: union of completed work, newest for settings.
- Local storage keys keep the `suresh-chess-coach.` prefix.

## Engineering rules
- Plain HTML, CSS and JavaScript, no build step. Pinned libraries: chess.js 0.10.3, Three.js r128, Stockfish 19 lite (WASM worker).
- Source of truth is `src/` in this repo. `sh scripts/build.sh` builds `www/`, which Capacitor packages and which also runs as an offline static site. Never edit built files in `www/` by hand.
- Android: Capacitor 8 (targets Android 16, API 36), built and signed in GitHub Actions. Version is `1.0.<run number>`.
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
