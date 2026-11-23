# Play listing and closed test, F4 prep (product spec)

Status: approved by Suresh, 2026-11-23. Nothing here is uploaded or published by Claude. Every Play Console step is Suresh's (constitution checkpoint).

## Problem
The app is ready for a closed test, but the Play listing, the policy forms and the test plan do not exist yet. Google needs a 14-day closed test with 12 testers before a new personal account can launch, so every day of prep saved is a day off the launch date.

## Goal
When the Play Console account is ready, Suresh pastes text and uploads files from this repo. He does not have to write or design anything on the day.

## Decisions
| # | Decision | Source |
|---|---|---|
| P-D1 | Category: Games, then Board | Suresh, 2026-11-23 |
| P-D2 | Store title "Chess Coach: Learn with Rani" (28 of 30 characters). The phone's icon name stays "Chess Coach" (G2d) | Suresh, 2026-11-23 |
| P-D3 | A personal Play Console account. This means a closed test with at least 12 testers who stay opted in for 14 days in a row before Google allows production. No D-U-N-S is needed, and the AdMob IDs stay as they are | Suresh, 2026-11-23 |
| P-D4 | Launch in all countries and regions | Suresh, 2026-11-23 |
| P-D5 | One listing language: English (United States). Others later | Delegated to Claude |
| P-D6 | 8 phone screenshots, 1080 x 1920 (9:16), each with one short caption above the real app screen. No tablet screenshots yet | Delegated to Claude |
| P-D7 | No word about Remove ads or in-app purchases until F5 ships. "In-app purchases" is answered No for now | Scope (A-D18) |
| P-D8 | Price: Free. Google never lets a free app become paid later, which fits the constitution | Constitution |
| P-D9 | Contact: email handnchennai@gmail.com, website https://hnchennai.github.io/, privacy policy https://hnchennai.github.io/privacy.html. No phone number | Memory, 2026-11-19 |
| P-D10 | The store files live in `store/` in this public repo (text, screenshots, feature graphic, icon), so every listing change is reviewable | Delegated to Claude |
| P-D11 | The app's fonts are bundled inside the app (open licence) instead of loading from Google Fonts. The only network call left on Android is the ads SDK | Suresh, 2026-11-23 |

## Store listing text

**App name** (30 max)
```
Chess Coach: Learn with Rani
```

**Short description** (80 max, this is 73)
```
Learn chess from zero with Rani: lessons, puzzles and games, all offline.
```

**Full description** (4000 max)
```
Learn chess from your very first move with Rani, a friendly queen coach.

Chess Coach takes you step by step from "how do the pieces move?" to club level and beyond. Short lessons, puzzles and real games, all in plain words.

WHAT YOU GET
• A quick level check, so you start in the right place: Beginner, Improver or Club.
• 31 lessons in 6 levels: the board, piece values and checkmate, then forks and pins, endgames, strategy, and up to expert planning and endgame theory.
• 353 puzzles, each one checked by the Stockfish engine.
• Games against a computer partner, from gentle first games up to Stockfish at its strongest setting.
• Review any game move by move and see where it turned.
• Endgame drills, opening lines and "Safe or blunder?" practice.
• Hints are free and unlimited.

MADE FOR BEGINNERS
• Beginners get every move explained in plain words, with no ratings or engine scores.
• Home shows one clear next step.
• Rani offers to move you up a level when you are ready.

YOUR BOARD, YOUR WAY
• A flat board or a 3D board.
• 12 piece sets, from Classic to Ramayana, Mahabharata, Greek Myths, Norse Sagas and Hero League. Tap a themed piece to see its name and how it moves.

WORKS OFFLINE
Everything runs on your phone, including the Stockfish engine. No sign-up and no account.

FAIR ADS
Chess Coach is free. A small banner shows only between activities: never during a game, lesson or puzzle, never over the board, and never on your first day.

FREE SOFTWARE
Chess Coach is open source under the GNU GPL version 3. Source code: https://github.com/hnchennai/chess-coach
```

## Graphics (files in `store/`)
| File | Size | Notes |
|---|---|---|
| `icon-512.png` | 512 x 512, 32-bit PNG (with alpha) | From `assets/icon.png` |
| `feature-graphic.png` | 1024 x 500, 24-bit PNG, no alpha | Icon, "Chess Coach", "Learn with Rani", a board. Nothing important near the edges |
| `screenshots/01.png` to `08.png` | 1080 x 1920 | Caption over the top part, the real app screen below. Taken from the built `www/` with test data, no ad banner |

Screenshot plan (caption, then the screen):
1. "Start from zero with Rani": Beginner Home with Rani's line and the Continue card.
2. "Short lessons in plain words": a Beginner lesson step (how the knight moves) on the board.
3. "353 puzzles with free hints": a puzzle with a hint arrow showing.
4. "Play a partner at your level": a game in progress on the 3D board.
5. "Review every game": the review of a finished game.
6. "Pick your piece set": Hero League pieces with a name line showing.
7. "Start at the right level": the level check.
8. "See how far you have come": the Progress page.

## Policy and app content answers (Play Console, App content page)
| Form | Answer |
|---|---|
| Privacy policy | https://hnchennai.github.io/privacy.html |
| Ads | Yes, the app contains ads |
| App access | All functions are available without special access (no login) |
| Target audience | 13 to 15, 16 to 17, 18 and over. Not under 13 (constitution) |
| Could the listing unintentionally appeal to children? | No. Justification to paste: "Chess Coach is a chess learning app for teens and adults. The store text and screenshots are written for players aged 13 and older, the app has no child-directed content or games for young children, and the privacy policy states that the app is for ages 13 and older." If Google disagrees, it will ask for changes in review; the fallback is to make the listing less toy-like, not to target children |
| Content rating (IARC) | Category: Game. Violence, fear, sex, language, drugs: none. Gambling or simulated gambling: no. Users interact or share content: no. Shares the user's location: no. Digital purchases: no (until F5). Unrestricted internet: no. Expected rating: Everyone / PEGI 3 / IARC 3+ |
| Advertising ID | Yes, the app uses the advertising ID, for advertising (the Google Mobile Ads SDK) |
| Government app, financial features, health, news, COVID-19 | No, none |
| Data safety | See below |

## Data safety answers
Based on Google's own disclosure for the Google Mobile Ads SDK 25.5.0 (developers.google.com/admob/android/privacy/play-data-disclosure). Our app collects nothing itself.

- Does the app collect or share any of the required user data types? **Yes** (through the ads SDK).
- Is all user data encrypted in transit? **Yes** (TLS, per Google).
- Can users ask for their data to be deleted? **No**. There is no account and the app keeps nothing off the phone. Data held by Google is covered by Google's own controls.

| Play data type | Collected | Shared | Optional? | Purposes |
|---|---|---|---|---|
| Location: Approximate location (from the IP address) | Yes | Yes | Required | Advertising or marketing, Analytics, Fraud prevention, security and compliance |
| App activity: App interactions | Yes | Yes | Required | Same |
| App info and performance: Crash logs, Diagnostics | Yes | Yes | Required | Same |
| Device or other IDs | Yes | Yes | Required | Same |

Not collected: name, email, contacts, photos, files, messages, precise location, health, financial info, web history.

## Closed test plan (P-D3)
1. Suresh creates the app in Play Console (Free, Game, title above) and turns on Play App Signing. The upload key is the existing `chesscoach` key; CI already builds the `.aab`.
2. Make a Google Group, for example chess-coach-testers, and add it as the tester list of a closed testing track. Testers need a Google account and an Android phone.
3. Upload the `.aab` from the latest GitHub Release to the closed track and send it for review (first review can take a few days).
4. Invite 15 or more people (spare for drop-outs; one drop-out below 12 restarts the count). Invite text is in `store/tester-invite.md`.
5. Testers install from the Play link, keep the app installed and open it a few times a week for 14 days. Fixes during the test ship as new closed track builds.
6. On day 14 or later, apply for production access. Google asks how testing went; answers to draft are in `store/production-questions.md`.
7. Production release: before this, the real-ads launch switch (A-D8) and registering Suresh's phone as an AdMob test device. Both are separate checkpoints.

## Out of scope
- Uploading anything, creating the app, or changing any Play Console setting (Suresh does it).
- The launch switch for real ads, Remove ads (F5), cloud save (S3).
- Other languages, tablet screenshots, a promo video.

## Readiness
| Item | Owner | Status |
|---|---|---|
| Play Console personal account ($25 one-time, ID check) | Suresh | To do |
| 15 testers with Android phones and Google accounts | Suresh | To do |
| Signed `.aab` from CI | Claude | Ready (every release) |
| Privacy policy live with the ads wording | Claude | Ready (hnchennai.github.io, updated 21 Nov 2026) |
| app-ads.txt live with the AdMob line | Claude | Ready |

## Open questions
- None.

## Assumption register
- Confirmed by Suresh: P-D1 to P-D4, P-D11, and the listing wording as written (2026-11-23).
- Delegated to Claude: P-D5, P-D6, P-D10, the first draft of the listing wording.
- Verified by tool: 31 units in 6 levels (src/js/course.js plus src/js/roadmap.js) and 353 puzzles (src/js/puzzles.js); engine levels from about 400 to full Stockfish (src/js/app.js); 12 piece sets (src/js/avatar.js and src/js/themes.js); the ads SDK data list (Google's page, SDK 25.5.0); the live privacy policy and app-ads.txt.
- Not verified: the 12 testers rule is from Google's help page for personal accounts made after 13 Nov 2023; the exact Play Console form wording can change, so the answers above are checked again on the day.
