# Chess Coach for Android

This folder turns Chess Coach into an Android app with Capacitor.
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
- This repository holds the complete source of the app's own code for every released build: the web app in `src/` (built into `www/` by `sh scripts/build.sh`), the Android wrapper settings, the build scripts in `scripts/` and the build workflow in `.github/workflows/`. The Android project itself is not stored here: the workflow generates it on every build with Capacitor (`npx cap add android`) and then applies `scripts/android-ads.sh`, `scripts/android-d2.sh` and `scripts/android-friends.sh`. The Android build also links Google's ads, consent and in-app review libraries, and for friend game notifications Firebase Cloud Messaging with the Google Play services libraries it uses. They are not in this repository, and Google's Play services libraries are closed source; the exception below allows that. The web version loads no ads code and no friend games code.
- Exception (see `LICENSE-EXCEPTION`): "Additional permission under GNU GPL version 3 section 7: if you modify this program, or any covered work, by linking or combining it with the Google Mobile Ads SDK, the Google User Messaging Platform SDK, the Google Play Billing Library, the Google Play In-App Review Library and the Google Play Core Common library it uses, the Firebase Android SDKs for Cloud Messaging and App Check (com.google.firebase:firebase-messaging, firebase-appcheck, firebase-appcheck-playintegrity and the Firebase libraries they depend on), the Google Play Integrity library, or the Google Play services libraries those depend on (com.google.android.gms:play-services-*) (or modified versions of those libraries), the copyright holder of Chess Coach grants you permission to convey the resulting work. This permission covers the Chess Coach code only. Stockfish is a separate program under plain GPL version 3." The Android app shows ads, asks Google for its rating sheet, and gets friend game notifications through those Google libraries, which are not free software. Stockfish is never modified and never linked with them: the app talks to the engine by messages.
- The app includes Stockfish, which is also GPLv3. The engine files in `www/sf/` are the unmodified Stockfish.js 19 build. Source: https://github.com/nmrugg/stockfish.js, based on https://github.com/official-stockfish/Stockfish.
- The names "Chess Coach", "Queen Rani" and "Coach Gaja" identify this app. If you publish a changed version, please give it a different name.

## Credits
- Stockfish and Stockfish.js (GPLv3): sources linked above. Nets by Chris Bao (sscg13).
- 3D marble set: "A Beautiful Game", original assets by Moeen Sayed and Mujtaba Sayed for SideFX, from the MaterialX Project (ASWF), glTF by Ed Mackey, CC BY 4.0. Simplified and resized for this app.
- three.js (MIT), chess.js (BSD-2-Clause), Capacitor (MIT)
- Fonts, bundled in `www/fonts/` so the app needs no network for them, each under the SIL Open Font License 1.1 (`OFL.txt` in each font's folder). The files are the latin and symbols subsets served by Google Fonts (fonts.google.com):
  - Bodoni Moda, by Owen Earl (indestructible type*), https://github.com/indestructible-type/Bodoni
  - IBM Plex Sans and IBM Plex Mono, by IBM Corp., Reserved Font Name "Plex", https://github.com/IBM/plex
  - Noto Sans Symbols 2, by the Noto Project Authors, https://github.com/notofonts/symbols
- Android app only, for the ad banner and the consent form (versions pinned in `package.json` and `scripts/android-ads.sh`):
  - `@capacitor-community/admob` 8.4.2 (MIT), the Capacitor plugin for ads.
  - `webview-native-ui` engine 1.0.11 (MIT), pulled in by that plugin (`io.github.webview-native-ui:engine` on Android, `@webview-native-ui/engine` on npm).
  - Google Mobile Ads SDK, `com.google.android.gms:play-services-ads` 25.4.0, and Google User Messaging Platform SDK, `com.google.android.ump:user-messaging-platform` 4.0.0. Closed source, under Google's terms (the Android Software Development Kit License and the Google Play services and AdMob terms). Combined with this app under `LICENSE-EXCEPTION`.
- Android app only, for the daily puzzle reminder and the Play rating ask (versions pinned in `package.json` and `scripts/android-d2.sh`):
  - `@capacitor/local-notifications` 8.3.1 (MIT), the Capacitor plugin for the reminder.
  - `@capacitor-community/in-app-review` 8.0.0 (MIT), the Capacitor plugin for Google's rating sheet.
  - Google Play In-App Review Library, `com.google.android.play:review` 2.0.2, the Google Play Core Common library it uses, and the Google Play services libraries they use. Closed source, under Google's terms. Combined with this app under `LICENSE-EXCEPTION`.
- Android app only, for friend games (versions pinned in `package.json` and `scripts/android-friends.sh`):
  - `@capacitor/share` 8.0.3 (MIT), the Capacitor plugin for sharing a challenge link.
  - `@capacitor/push-notifications` 8.1.3 (MIT), the Capacitor plugin for friend game notifications.
  - Firebase Cloud Messaging, `com.google.firebase:firebase-messaging` 25.0.1, and the Firebase libraries it depends on (Apache-2.0), with the Google Play services libraries they use (closed source, under Google's terms). Combined with this app under `LICENSE-EXCEPTION`. No Firebase Analytics.

## Signing and updates

- The release key (alias `chesscoach`) is never stored in git. The workflow reads it from two repo secrets:
  - `ANDROID_KEYSTORE_BASE64`: the key file, base64 encoded
  - `ANDROID_KEY_PASSWORD`: its password
- Keep a backup of the key file and its password. The Play Store listing needs the same key, and a lost key means users can't update.
- Every push to `main` builds version `1.0.<run number>`, signs it, and publishes a GitHub Release (`v1.0.N`) with the `.apk` (phone) and `.aab` (Play Store).
- Builds of any other branch are test builds (`CC_TEST_BUILD=1`: Settings has the "Friend games (test)" toggle). Never upload a branch build's `.aab` to Play; only `main` builds go to Play.
- Phone auto-updates: install Obtainium and add this repo (with a GitHub token, since the repo is private).

## Developing

- Edit files in `src/`, then run `sh scripts/build.sh` to rebuild `www/`.
- Tests: `node --test tests/*.test.js`, and the browser checks in `tests/e2e/`.
- Handoff notes for the next session: `.crew/HANDOFF.md`.
