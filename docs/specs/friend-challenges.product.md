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
| FC-D3 | Identity: anonymous, no sign-in. The app gets a hidden ID on the first challenge. Reinstalling or a new phone loses open challenges unless Android restores the app's backup (FC-D30); finished games stay in the phone's history | Suresh, 2026-11-24 (changed 2026-11-25, FC-D30) |
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
| FC-D21 | A friend game that reaches 600 plies (300 moves each) ends automatically as a draw, reason "move limit" | Suresh, 2026-11-24 |
| FC-D22 | When a player deletes their friend game data, a game already past its deadline ends on time (the side that ran out of time loses), as the timer job would have ended it. Every other open game counts as a win for the friend (FC-D17) | Suresh, 2026-11-24 |
| FC-D23 | The wording in "Wording" below (approved list) is used exactly as written, in the app and on the website. Any other text a slice needs is proposed there and used until Suresh approves or changes it. No em dashes anywhere | Suresh, 2026-11-25 |
| FC-D24 | The real Firebase config and the Play signing fingerprints are not available yet. Until they are, the app's `fconfig.js` (project id, API key) and the website's `assetlinks.json` (two fingerprints) hold clearly marked PLACEHOLDERS, the app refuses every friend server call while they are placeholders, and the launch switch `Friends.CONFIG.live` stays off. No test ever calls a real Firebase host | Suresh, 2026-11-25 |
| FC-D25 | The 8 lines proposed in FC3 are approved as written (the Random line, "optional, stays on this phone", the time-left forms, own link, 20 a day, other failure, "Close", the website line), with the time-left rule of FC-D26 | Suresh, 2026-11-25 |
| FC-D26 | Time left never overstates. 48 hours or more: whole days rounded down ("2 days left"). Under 48 hours: whole hours rounded down ("25 hours left", "5 hours left", "1 hour left"), then "under 1 hour left", then "no time left" | Suresh, 2026-11-25 |
| FC-D27 | The Challenge sheet starts on the colour used last time, Random the first time (kept on the phone, in the friend store) | Suresh, 2026-11-25 |
| FC-D28 | The challenger names the friend from the row once the friend has accepted ("Name your friend", same rules). Built in FC4 with the game screen | Suresh, 2026-11-25 |
| FC-D29 | Nicknames and the record against each friend stay on this phone only, never in the cloud save: they live in the device-only friend store (`suresh-chess-coach.friends.v1`), not in the profile. The profile stays v5. Finished friend games still go into the game history (`prof.games`) in FC4 | Suresh, 2026-11-25 |
| FC-D30 | Android's automatic backup may restore the friend store, so a restored backup brings open friend games back. If two phones share an ID, the one that sent `hello` last gets the pushes. No backup rules change | Suresh, 2026-11-25 |

## Wording
Approved by Suresh, 2026-11-25 (FC-D23), letter for letter:
| Where | Text |
|---|---|
| Play card title | Friend games |
| Play card button | Challenge a friend |
| At 10 open games (under the disabled button) | You have 10 friend games open. Finish one to start another. |
| Challenge sheet | Play as; White / Black / Random; button Share link |
| Share text (written on the phone) | Play chess with me in Chess Coach: <link> |
| Row lines | Your move, 2 days left / Their move / Waiting for your friend, until 1 Dec / Not sent yet |
| Row record | W 2 · L 1 · D 0 |
| Row name | the nickname, or Friend |
| Waiting row button | Cancel invite (FC-D18) |
| Accept sheet | A friend challenges you; You play White (or Black); Name your friend (optional, stays on this phone); buttons Accept and Not now |
| Bad, used, cancelled or expired link | This challenge is no longer valid. |
| No internet | Friend games need the internet. Try again when you are online. |
| Website page | A friend challenged you to chess; buttons Get Chess Coach on Google Play and Open in Chess Coach |
| Settings (test builds, switch off) | Friend games (test) |

Approved on 2026-11-25 (FC-D25), proposed in FC3:
| Where | Text |
|---|---|
| Accept sheet, a Random invite | Your colour is picked at random. |
| Accept sheet, under "Name your friend" (a small line) | optional, stays on this phone |
| Time left (FC-D26) | Your move, 3 days left / Your move, 2 days left (48 hours or more, days rounded down) / Your move, 47 hours left ... Your move, 1 hour left (hours rounded down) / Your move, under 1 hour left / Your move, no time left |
| Opening your own link | This is your own challenge. Send the link to a friend. |
| The 20 challenges a day limit | You have sent 20 challenges today. Try again tomorrow. |
| Any other server failure | Something went wrong. Please try again. |
| Waiting row, second button | Share link (the approved button text, reused to send the same link again) |
| Sheet close button (screen readers only) | Close |
| Website page, line under the title (also the link preview text) | Install Chess Coach from Google Play, then tap the link again. |

Proposed in fix round 1, in use until approved (see Open questions):
| Where | Proposed text |
|---|---|
| While a call runs (Share link, Accept, Cancel invite, the Accept sheet loading): the status line under the buttons, also read by screen readers, next to a spinner on the button | One moment. |

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
10. **Delete.** Priya taps Delete my friend game data in Settings. Her ID, push token and server games are deleted; open games end for her opponents as abandoned (a game where someone had already run out of time ends on time instead, FC-D22). Her phone history stays.
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
- Confirmed by Suresh: FC-D1 to FC-D8, FC-D17 to FC-D19, FC-D21, FC-D22 (2026-11-24); FC-D23 (the approved wording) and FC-D24 (placeholders until the real Firebase config and fingerprints exist) (2026-11-25).
- Technical, orchestrator (FC3, tech spec open question 4): the invite link is `https://hnchennai.github.io/c/?c=<code>`, served with HTTP 200 by `c/index.html`.
- Confirmed by Suresh, 2026-11-25 (fix round 1): FC-D25 to FC-D30 (the FC3 proposals, time left rounded down, the last colour first, naming from the row in FC4, nicknames and records on the phone only, backups).
- Proposed by Claude in fix round 1, in use until Suresh answers: "One moment." for a call in progress.
- Proposed by Claude, approved by Suresh on 2026-11-24: FC-D9 to FC-D16 and the beyond-code changes.
- Verified by tool: none yet; Firebase pricing, the Blaze free quotas and the Play deletion rule are checked in readiness.

## Open questions
From FC3 fix round 1 (2026-11-25), for Suresh:
1. The busy line "One moment." (shown and read out while Share link, Accept or Cancel invite runs, and while a challenge link loads). Options: "One moment.", "Sending…", or no words (spinner only, which screen readers would not hear). Recommendation: "One moment."
