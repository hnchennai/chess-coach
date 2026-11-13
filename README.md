# Chess Coach for Android

This folder turns Suresh's Chess Coach into an Android app with Capacitor.
The whole app works offline: Stockfish, the 3D board, puzzles and lessons are inside `www/`.

## Build in the cloud (no Android Studio needed)
1. Fork or copy this repository on GitHub.
2. Upload everything in this folder, including the hidden `.github` folder.
3. Open the repository's **Actions** tab. The "Build Android app" run starts on its own (about 5 to 8 minutes).
4. Open the finished run and download **chess-coach-apk** under Artifacts. Unzip it to get `app-debug.apk`.
5. Copy the APK to your phone and open it. Allow "Install unknown apps" when Android asks.

## Build on your computer
1. Install Node.js 20 and Android Studio.
2. In this folder run: `npm install`, `npx cap add android`, `npx capacitor-assets generate --android`, `npx cap sync android`
3. Run `npx cap open android`, then in Android Studio choose Build > Build APK(s).

## Licence and source
- Chess Coach is free software under the GNU General Public License, version 3 (see `LICENSE`). You may use, study, change and share it under those terms. It comes with no warranty.
- This repository is the complete source for every released build: the web app in `src/` (built into `www/` by `sh scripts/build.sh`), the Android wrapper settings, and the build workflow in `.github/workflows/`.
- The app includes Stockfish, which is also GPLv3. The engine files in `www/sf/` are the unmodified Stockfish.js 19 build. Source: https://github.com/nmrugg/stockfish.js, based on https://github.com/official-stockfish/Stockfish.
- The names "Chess Coach", "Queen Rani" and "Coach Gaja" identify this app. If you publish a changed version, please give it a different name.

## Credits
- Stockfish and Stockfish.js (GPLv3): sources linked above. Nets by Chris Bao (sscg13).
- 3D marble set: "A Beautiful Game", original assets by Moeen Sayed and Mujtaba Sayed for SideFX, from the MaterialX Project (ASWF), glTF by Ed Mackey, CC BY 4.0. Simplified and resized for this app.
- three.js (MIT), chess.js (BSD-2-Clause), Capacitor (MIT)

## Signing and updates

- The release key (alias `chesscoach`) is never stored in git. The workflow reads it from two repo secrets:
  - `ANDROID_KEYSTORE_BASE64`: the key file, base64 encoded
  - `ANDROID_KEY_PASSWORD`: its password
- Keep a backup of the key file and its password. The Play Store listing needs the same key, and a lost key means users can't update.
- Every push to `main` builds version `1.0.<run number>`, signs it, and publishes a GitHub Release (`v1.0.N`) with the `.apk` (phone) and `.aab` (Play Store).
- Phone auto-updates: install Obtainium and add this repo (with a GitHub token, since the repo is private).

## Developing

- Edit files in `src/`, then run `sh scripts/build.sh` to rebuild `www/`.
- Tests: `node --test tests/*.test.js`, and the browser checks in `tests/e2e/`.
- Handoff notes for the next session: `.crew/HANDOFF.md`.
