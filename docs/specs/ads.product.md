# Ads banner and consent, F3b (product spec)

Size: M (touches money, privacy and the licence). Status: approved by Suresh (2026-11-19): decisions, scenarios, wording, the constitution change and the licence exception.
Builds on: `docs/specs/flow-rework.product.md` (F-D1 to F-D33). Android only.

## Problem
- The app is to be free with ads and a one-time Remove ads purchase. The slot rules exist (F2), but no ad can show yet.
- An AdMob banner is a native strip fixed to the screen edge. It cannot sit inside the tip box in the page, which the earlier plan assumed (F-D6).
- Google's ads component is closed-source. The app is GPLv3 and ships Stockfish.

## Goal
- A quiet banner earns money on the screens where the tip slot already shows, and nowhere else.
- No player sees an ad on their first day, during an activity, or over the board.
- Until the Play launch, builds show only Google's test ads.

## Users
- Every level (Beginner, Improver, Club), ages 13 and older. Same rules for all levels and for Show everything on or off.

## Decisions
| # | Decision | Source |
|---|---|---|
| A-D1 | The banner is one strip at the bottom of the screen, above the tab bar with an 8px gap. It shows only on screens where the tip slot shows today: Home, Progress and end cards (F-D3) | Suresh, 2026-11-19 |
| A-D2 | Rani's tip stays in the page as it is. The banner is extra, it does not replace the tip. This replaces F-D6 | Follows from A-D1 |
| A-D3 | All slot rules carry over to the banner: none on the first calendar day (F-D5), none during a game, lesson, puzzle set, drill, review or level check (F-D4, F-D17, F-D32), never full screen | Earlier decisions |
| A-D4 | No banner when the phone is held sideways (screen shorter than 500px) | Suresh, 2026-11-19 |
| A-D5 | Ads are non-personalised for everyone, everywhere (F-D2). Highest ad content rating: PG | Suresh, 2026-11-19 |
| A-D6 | The phone's advertising ID stays available to Google's ads (standard setup). The privacy policy says so | Suresh, 2026-11-19 |
| A-D7 | Europe and UK: Google's consent form shows once at app start, from the second day, never during an activity. No ad request is made there until the form allows it. Other countries see no form. Refined after review (2026-11-21): from day two the app asks Google once at each start whether consent applies (nothing is shown). The form opens only if no activity, sheet, level check or question from Rani is open when the answer arrives; otherwise no form and no ads in that session | Suresh, 2026-11-19; refinement delegated to Claude |
| A-D8 | Until Suresh says the Play launch is on, every build shows Google's test ads only. One switch in the build turns on the real ad unit. Flipping it is a checkpoint | Suresh, 2026-11-19 |
| A-D9 | The web version gets no ads and no ads code. Tips only, unchanged | Suresh, 2026-11-19 |
| A-D10 | Licence: the app's own code gains a written exception that allows combining it with Google's ads and billing libraries. Stockfish stays a separate, unmodified engine that the app talks to by messages, with its source linked | Suresh, 2026-11-19. Claude is not a lawyer; small remaining risk noted |
| A-D11 | On the first day nothing ads-related runs at all: no ads start-up, no consent check, no network call | Delegated to Claude (follows F-D5 and "works fully offline") |
| A-D12 | The banner hides while any sheet, dialog or offer is open (Settings, level-up offer, confirm boxes), because a native strip would cover them | Delegated to Claude |
| A-D13 | Offline or no ad available: no strip and no empty gap. The screen looks as it does today | Delegated to Claude |
| A-D14 | When the banner shows, the page gains bottom padding of the banner's height, so the last button or the tip is never covered. Nothing above the bottom of the page moves | Delegated to Claude |
| A-D15 | Every time the banner appears (Home, Progress, end cards, after a sheet or note closes, after a tab change) it waits at least 1 second, so a tap meant for something else cannot land on an ad | Delegated to Claude (AdMob accidental-click rule, lesson L20); widened from end cards only after review, 2026-11-21 |
| A-D16 | Wide screens (tablet, board and panel side by side): the banner is still one strip at the bottom of the screen, never in a column beside the board (F-D27) | Delegated to Claude |
| A-D17 | Settings gains "Privacy policy" (opens https://hnchennai.github.io/privacy.html) for everyone, and "Privacy choices" (reopens Google's form) only where Google says a choice applies | Delegated to Claude (Google requires the second where consent applies) |
| A-D18 | No "Remove ads" button or wording yet. That is F5 | Scope |

## New wording (all of it)
- Settings row: "Privacy policy"
- Settings row: "Privacy choices"
- No other new text. The banner's own "Ad" mark comes from Google.

## Constitution change (approved)
Security and privacy, the ads line.
- Old: "Ads are allowed in the ad slot only: after an activity ends, and at the bottom of Home and Progress. Never on or beside the board, never during a lesson, game, puzzle or review, never full screen, never on a player's first day. Ads are non-personalised."
- New: "Ads are one banner strip at the bottom of the screen, above the tab bar, only on screens where the tip slot shows: after an activity ends, and on Home and Progress. Never over or beside the board, never during a lesson, game, puzzle or review, never full screen, never on a player's first day, never on the web version. Ads are non-personalised and rated PG or lower. Before the Play launch, builds show test ads only."

Hard rules, the licence line gains:
- "The app's own code carries an exception that allows combining it with Google's Mobile Ads, User Messaging and Play Billing libraries. Stockfish is never modified and never linked with them."

## Licence wording (README and a new `LICENSE-EXCEPTION` file)
"Additional permission under GNU GPL version 3 section 7: if you modify this program, or any covered work, by linking or combining it with the Google Mobile Ads SDK, the Google User Messaging Platform SDK or the Google Play Billing Library (or modified versions of those libraries), the copyright holder of Chess Coach grants you permission to convey the resulting work. This permission covers the Chess Coach code only. Stockfish is a separate program under plain GPL version 3."

## Scenarios
1. Given Ravi installs the app today, when he uses it all day, then he sees no banner and the app makes no ads or consent network call.
2. Given Priya (Beginner, second day, India, online) opens Home, then a banner strip shows above the tab bar, Rani's tip is still in the page, and Continue is still on the first screen at 412x915.
3. Given Priya taps Learn and opens a lesson, then the banner is gone before the lesson shows, and it stays gone until the lesson's end card.
4. Given Arjun (Club, day five) finishes a game, then the end card shows at once and the banner appears at least 1 second later, at the bottom of the screen, not touching the board.
5. Given Arjun starts a new game from the end card, then the banner hides straight away.
6. Given Meera is offline on day three, then Home shows the tip and no strip, no gap and no error.
7. Given Lukas (Germany, second day) opens the app, then Google's consent form shows once before any ad is requested. If he refuses, he still gets the app as normal, with whatever ads Google allows without consent, or none.
8. Given Lukas opens Settings later, then "Privacy choices" is there and reopens the form. Priya in India does not see that row. Both see "Privacy policy".
9. Given Priya opens Settings or gets the level-up offer while the banner is showing, then the banner hides until the sheet closes.
10. Given Priya turns her phone sideways on Home, then the banner hides and Continue is on the first screen.
11. Given any build before the Play launch, then the banner is Google's sample ad marked "Test Ad", never a real ad.
12. Given the web version, then nothing changes and the ads rules file is never loaded.

## Acceptance criteria
1. The banner can show only when the tip slot rule allows a slot on the current screen. One function decides both.
2. First day: zero calls to the ads plugin and zero network requests from the app.
3. Banner hidden within one frame of an activity starting, a sheet or dialog opening, the screen becoming shorter than 500px, or leaving a slot screen.
4. Every ad request is non-personalised with a PG ceiling. Test: the request options are asserted in a unit test.
5. With the banner showing at 360, 412 and 1280 wide, no button, tip or tab is covered, and Beginner Home keeps Continue on the first screen at 412x915.
6. Every appearance of the banner is no earlier than 1000ms after the screen or card that allows it is drawn.
7. No ad available or offline: no strip, no reserved space, no console error.
8. Consent: where required, no ad request before the form is answered. The form never opens during an activity or on day one.
9. "Privacy choices" shows only when Google reports that a choice applies. "Privacy policy" always shows.
10. The real ad unit ID is used only when the launch switch is on. It is off in this slice. CI fails if a build has the switch on without the launch flag being set on purpose.
11. Web build: no plugin code path runs, same screens as today (S2b and F1 fixtures still pass).
12. Existing suites stay green: unit, f1, s1, s2a, s2b at their sizes. No em dashes in new copy.
13. The live privacy policy is switched to the ads version before the first build with ads code is released.
14. README, `LICENSE-EXCEPTION` and the in-app credit name the exception and the Google libraries.

## Out of scope
- Remove ads purchase (F5). Play listing, data safety form and closed test (F4).
- Interstitial, rewarded, app-open or native ads. Mediation or other ad networks.
- Web ads. Analytics of any kind.
- Turning on real ads (the launch switch).

## Readiness
| Item | Owner | Status |
|---|---|---|
| AdMob app ID `ca-app-pub-1437334216467981~3972482016` | Suresh | Done |
| Banner unit `ca-app-pub-1437334216467981/6215501975` | Suresh | Done (unused until launch) |
| `app-ads.txt` at https://hnchennai.github.io/app-ads.txt | Claude | Live; AdMob verifies only after the Play listing |
| Privacy policy, ads version | Claude | Drafted, unpublished; goes live with this slice |
| Plugin `@capacitor-community/admob` 8.4.2 (Capacitor 8) | Claude | Checked on npm, 2026-11-19 |
| Europe consent message created in AdMob (Privacy and messaging) | Suresh | To do before launch, not needed for test ads |
| Suresh's phone as an AdMob test device | Suresh | To do before the launch switch |
| AdMob account is personal; entity type of the D-U-N-S organization | Suresh | Open. If a company or LLP, new IDs before launch |

## Assumption register
- Delegated to Claude: A-D11 to A-D17.
- Verified by tool: plugin version, banner positions (top, centre, bottom of screen only), consent and privacy-options calls exist.
- Not verified on a phone: how the banner sits with Android 16 edge to edge and the gesture bar. This slice needs a phone test before merge (lesson L24).

## Risks
- Licence: the exception is common practice, but the Stockfish authors could read the GPL more strictly. Fallback: remove the ads code, which leaves the app plain GPLv3.
- AdMob limits ad serving until the app is on a store and reviewed. Expected; test ads are unaffected.
- A native strip over a web page can lag one frame behind fast changes. Covered by hiding first, showing late (criteria 3 and 6).

## Review record (2026-11-20 to 2026-11-21)
- Two independent reviews (spec; integration, privacy and ads policy) and one delta re-review each. No blocker in the code. Fix rounds: 2.
- Google libraries pinned: play-services-ads 25.4.0, user-messaging-platform 4.0.0, webview-native-ui engine 1.0.11.
- Open until a phone test: day-one network silence (Google's library registers start-up code of its own), banner position with Android 16 edge to edge, the system browser link, and that the ads rules file loads inside the app.
- To turn real ads on later: set `live: true`, update the unit test that asserts it is false, and set the repository variable ADS_LIVE to yes. Checkpoint.
