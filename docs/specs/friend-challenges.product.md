# Friend challenges (product spec)

Status: approved by Suresh, 2026-11-24 (FC-D1 to FC-D16 and the beyond-code changes). Size L: a design-only pass (tech spec) comes before any code.

## Problem
Chess Coach is single-player. Players who learn together want to play each other. A friend game is also a strong reason to come back every day ("your move"), which helps retention and ad income.

## Goal
Two friends play a turn-based game of chess in the app: one sends a challenge link, the other accepts, and each gets a notification when it is their move. No chat, no public names, nothing to moderate.

## Users
- Any player of any level, from the Play tab (FC-D7). Android only (FC-D4).
- Out of reach: the web version, strangers (no matchmaking), players under 13 (the app is 13+).

## Decisions
| # | Decision | Source |
|---|---|---|
| FC-D1 | Turn-based friend challenges by invite link, with a small server (option B) | Suresh, 2026-11-24 |
| FC-D2 | Backend: Firebase on the pay-as-you-go Blaze plan (sign-in, database, move-check functions, push). A budget alert at $5 a month. Suresh owns the Firebase project and adds the card (checkpoint: costs money) | Suresh, 2026-11-24 |
| FC-D3 | Identity: anonymous, no sign-in. The app gets a hidden ID on the first challenge. Reinstalling or a new phone loses open challenges; finished games stay in the phone's history | Suresh, 2026-11-24 |
| FC-D4 | Android only. The web version stays fully offline | Suresh, 2026-11-24 |
| FC-D5 | Names: the server stores no names. Each player labels the opponent with a nickname that only their own phone sees | Suresh, 2026-11-24 |
| FC-D6 | 3 days per move. A reminder push when 1 day is left. A player who runs out of time loses | Suresh, 2026-11-24 |
| FC-D7 | Everyone can use it, from the Play tab, at any level. Beginner Home does not change | Suresh, 2026-11-24 |
| FC-D8 | A finished friend game goes into the game history with the usual review, unrated, and the record against that friend (won-lost-drawn) shows on the friend's row | Suresh, 2026-11-24 |
| FC-D9 | Invites: the challenger picks White, Black or Random, then shares a link (WhatsApp or any app). An invite can be used once and expires after 7 days. The link opens the app if installed; otherwise a page on hnchennai.github.io says how to get it | Claude, approved by Suresh 2026-11-24 |
| FC-D10 | In a friend game there are no hints, no engine bar and no coach comments until the game ends (fair play). The review afterwards has everything | Claude, approved by Suresh 2026-11-24 |
| FC-D11 | Game actions: move, resign, offer a draw, accept or decline a draw. No takebacks. Normal chess endings (checkmate, stalemate, repetition, 50 moves, too few pieces) end the game automatically | Claude, approved by Suresh 2026-11-24 |
| FC-D12 | At most 10 friend games open at once | Claude, approved by Suresh 2026-11-24 |
| FC-D13 | Every move is checked by the server against the rules and whose turn it is, so a modified app cannot fake a move. Moves need the internet; offline, the app says the move will send when back online | Claude, approved by Suresh 2026-11-24 |
| FC-D14 | Push text is generic: "Your move in a friend game" (the server does not know the nickname). Notifications go through Firebase Cloud Messaging; the app asks for notification permission the first time a challenge is sent or accepted | Claude, approved by Suresh 2026-11-24 |
| FC-D15 | Ads follow the constitution: never during a friend game; the banner may show on the end card after it, as for any game | Constitution |
| FC-D16 | Server data: the anonymous ID, the push token, and each game's moves and state. Finished games are deleted from the server after 30 days (the phone keeps its copy). Settings has "Delete my friend game data", and the website has a page explaining how to ask for deletion (Play requires this) | Claude, approved by Suresh 2026-11-24 |
| FC-D17 | Deleting your friend game data while games are open counts as resigning them: each friend gets a win | Suresh, 2026-11-24 |
| FC-D18 | "Cancel invite" on an invite nobody has accepted yet, so it stops counting toward the 10 open games | Suresh, 2026-11-24 |
| FC-D19 | Spending guard: the $5 budget email alert plus the server instance caps. No automatic billing shut-off | Suresh, 2026-11-24 |
| FC-D20 | `google-services.json` is committed to the public repo (it holds no secret); safety comes from deny-all Firestore rules, API key restrictions and App Check. Data safety says there are no accounts and gives the deletion page URL | Claude (technical), 2026-11-24 |

## Scenarios
1. **Invite.** Priya taps Challenge a friend on Play, picks Random, and shares the link to Ravi on WhatsApp. Her Play tab shows the game as "Waiting for your friend", with an expiry date 7 days ahead.
2. **Accept.** Ravi has the app. He sees Priya's WhatsApp message with the link (the message text is written on Priya's phone and never stored on the server). He taps the link, the app opens on "A friend challenges you", he taps Accept and names the opponent "Priya". Colours are set; White moves first.
3. **No app.** Meena taps a link without the app installed. The page on hnchennai.github.io tells her to install Chess Coach from Google Play, then tap the link again.
4. **Your move.** Ravi moves at 9 am. Priya gets "Your move in a friend game". She opens it from the notification and the board shows Ravi's move.
5. **Time.** Priya does not move for 2 days: a reminder push. After 3 days without a move she loses on time; both phones show the result and the game goes into history.
6. **Fake move.** A modified app sends an illegal move or a move out of turn. The server rejects it and the game does not change.
7. **Draw offer.** Ravi offers a draw. Priya sees it with Accept and Decline; she declines and the game goes on.
8. **Offline.** Priya moves with no internet. The move shows as "Not sent yet" and sends by itself when the phone is online again. Her clock does not stop.
9. **New phone.** Ravi reinstalls the app. His open friend games are gone (FC-D3); Priya's side shows them as waiting until they run out of time.
10. **Delete.** Priya taps Delete my friend game data in Settings. Her ID, push token and server games are deleted; open games end for her opponents as abandoned. Her phone history stays.
11. **Web.** On the web version there is no Challenge a friend button.

## Acceptance criteria (to refine in the tech spec)
1. An invite link creates exactly one game, can be accepted once, and expires after 7 days.
2. The server accepts only legal moves by the player whose turn it is, and only within 3 days of the last move.
3. Both phones show the same position and result.
4. Push arrives for: your move, draw offer, 1 day left, game over. Nothing else.
5. No names or free text are stored on the server; nicknames live only on the phone.
6. No hints, engine bar or coach lines during a friend game.
7. A finished friend game is in history, unrated, with review, and counts in the friend's record.
8. No ads during a friend game; all other ad rules hold.
9. Delete my friend game data removes the player's server data.
10. Everything else in the app still works offline.

## What changes beyond code (each needs Suresh)
- **Constitution amendment:** "The app works fully offline" gets one exception: friend challenges need the internet. Also: no chat, no public names, the server holds only an anonymous ID, push token and games.
- **Licence:** Firebase push and the Google Play services it needs are not GPL. The GPL "additional permission" in the licence (today: the ads SDK and Play Billing) must also name these libraries.
- **Privacy policy:** a new section on friend games (what the server stores, 30-day deletion, how to delete).
- **Play forms:** data safety adds User IDs (anonymous), Device or other IDs (push token) and App activity (game moves), collected for app functionality, not shared, deletable. Content rating: "users interact" becomes Yes.
- **Firebase project:** Suresh creates it in his Google account, Blaze plan with a $5 budget alert, region Mumbai (asia-south1).

## Out of scope
- Chat, emoji reactions, public profiles, matchmaking with strangers, ratings between friends, live games with clocks, tournaments.
- Friend games on the web version.
- Moving games to a new phone (a later Play Games link could do it).

## Assumption register
- Confirmed by Suresh: FC-D1 to FC-D8, FC-D17 to FC-D19 (2026-11-24).
- Proposed by Claude, approved by Suresh on 2026-11-24: FC-D9 to FC-D16 and the beyond-code changes.
- Verified by tool: none yet; Firebase pricing, the Blaze free quotas and the Play deletion rule are checked in readiness.

## Open questions
- None.
