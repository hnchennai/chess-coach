# Daily puzzle, reminder and rating ask (product spec)

Status: approved by Suresh, 2026-11-24 (spec, DP-D5 to DP-D10 and wording).

## Problem
Ad income and Play ranking both depend on players coming back. The app has a streak but no reason to open it on a busy day, and no way to ask happy players for a Play rating, which drives where the app shows up in Play search.

## Goal
- A small daily habit: one puzzle a day at the player's level, with an optional evening reminder.
- More Play ratings, asked at a happy moment, never in the way.

## Users
- Improver and Club players (and anyone with Show everything on): the Daily puzzle card from day one.
- Beginners: the card appears once their Foundations lessons are done (Beginner Home states "beat" and "practice"). Until then Beginner Home keeps one next step.
- Android app: reminder and rating ask. Web version: daily puzzle only.

## Decisions
| # | Decision | Source |
|---|---|---|
| DP-D1 | Who sees the Daily puzzle card: Improver and Club now, Beginners after Foundations | Suresh, 2026-11-24 |
| DP-D2 | Which puzzle: one at the player's level, picked near their puzzle rating, unsolved ones first. The same puzzle all day; a new one at local midnight | Suresh, 2026-11-24 |
| DP-D3 | Reminder: offered once, by Rani, after the first daily puzzle. Off unless the player says yes. Default 7 pm, can be changed or turned off in Settings | Suresh, 2026-11-24 |
| DP-D4 | Rating ask: from the 3rd day with any activity, at the next happy moment (a won game, a finished lesson part, a solved daily puzzle), then at most once every 60 days. Never a "Do you like the app?" question first (Play policy) | Suresh, 2026-11-24 |
| DP-D5 | The daily puzzle is one rated puzzle, like a puzzle in a rated set: it counts toward Today's 10 puzzles, the streak and the puzzle rating, and a miss goes into Review missed puzzles. Hints work as usual | Claude, approved by Suresh 2026-11-24 |
| DP-D6 | One try per day. After a solve or a miss the card shows the result until midnight | Claude, approved by Suresh 2026-11-24 |
| DP-D7 | Reminders are set for the next 7 days each time the app opens. A day whose daily puzzle is already done gets no reminder. If the player does not open the app for 7 days, the reminders stop on their own | Claude, approved by Suresh 2026-11-24 |
| DP-D8 | Tapping the reminder opens the app straight into today's daily puzzle (or the card, if it is already done) | Claude, approved by Suresh 2026-11-24 |
| DP-D9 | Where the card sits: on Improver and Club Home, under the Continue card. On Beginner Home, under the main card | Claude, approved by Suresh 2026-11-24 |
| DP-D10 | Two new Android plugins, both free (MIT), no network of their own: `@capacitor/local-notifications` 8.3.1 (official) and `@capacitor-community/in-app-review` 8.0.0 (uses Google's Play review library). Pinned to exact versions | Claude, approved by Suresh 2026-11-24 |
| DP-D11 | The daily puzzle's end card: title "Today's puzzle" and the card's result line, main button "10 more puzzles" (a rated set at the player's level), small button "Home" | Suresh, 2026-11-24 |
| DP-D12 | A daily puzzle finished after midnight counts as the daily of the day it was dealt; its end card ends with "Today's new puzzle is on Home." instead of "A new one tomorrow." | Claude, from the review, 2026-11-24 |

## Wording (draft, needs Suresh's yes)
- Card: kicker "Daily puzzle", title "Today's puzzle", line "One puzzle at your level. About a minute.", button "Solve it".
- Card when solved: "Solved. A new one tomorrow." Card when missed: "Not this time. It's in your missed puzzles. A new one tomorrow."
- Rani's reminder offer, on the first daily puzzle's end card: "Want me to remind you each evening?" Buttons "Yes, remind me" and "No thanks".
- Notification: title "Your daily puzzle is ready", text "One puzzle, about a minute. Keep your streak going."
- Settings: "Daily puzzle reminder" switch and a time choice. If Android blocks notifications: "Notifications are off for Chess Coach. Turn them on in your phone's settings."

## Scenarios
1. **Solve.** Priya is an Improver with puzzle rating 1100. On 25 Nov Home shows the Daily puzzle card under the Continue card. She taps Solve it, gets a puzzle rated about 1100, and solves it. The end card says she solved it. Home's card now shows "Solved. A new one tomorrow.", Today's Train step shows 1 of 10, and her streak counts the day.
2. **Same day.** Priya opens the app again at 9 pm on 25 Nov. The card still shows Solved; there is no second daily puzzle. On 26 Nov after midnight the card offers a new puzzle.
3. **Miss.** On 26 Nov Priya plays a wrong move. The end card says it was not this time, the puzzle goes into Review missed puzzles, and the card shows the missed line until midnight. No second try today.
4. **Beginner.** Arun is a Beginner on Foundations lesson 3 of 7. Beginner Home shows only his next lesson, no daily card. When he finishes the Foundations lessons, the Daily puzzle card appears under the main card.
5. **Reminder offer.** After Priya's first daily puzzle, Rani asks "Want me to remind you each evening?" She taps Yes, remind me. Android asks for notification permission; she allows it. Reminders are set for 7 pm. If she had denied it, the Settings switch shows off with the "Notifications are off" line. If she had tapped No thanks, Rani never asks again and the Settings switch stays off.
6. **Reminder skipped.** Priya solves the 27 Nov puzzle at 8 am: no reminder that evening. On 28 Nov she has not opened the app by 7 pm: the reminder comes. She taps it and the app opens on that day's puzzle.
7. **Reminders stop.** Priya stops using the app after 28 Nov. Reminders come on the next days up to 4 Dec, then stop. Opening the app again sets them up again.
8. **Rating ask.** Meena first used the app on 20 Nov and was active on 20, 22 and 24 Nov. On 24 Nov she wins a game; after the end card shows, Google's rating sheet may appear (Google decides). Later the same day she solves the daily puzzle: no second ask. The next ask is no earlier than 23 Jan.
9. **Web.** On the web version the Daily puzzle card works the same. There is no reminder offer, no reminder setting and no rating ask.

## Acceptance criteria
1. The card shows for non-Beginner Home, and for Beginner Home only in the "beat" and "practice" states.
2. The daily puzzle is chosen from the player's puzzle rating, prefers puzzles not yet solved, and stays the same for the whole local day, even after restarts.
3. Solving or missing it updates the day's puzzle count, the streak, the puzzle rating and the missed list exactly as one rated puzzle does.
4. One try per day; the card shows the right result state until local midnight.
5. The reminder offer shows once, only on Android, only after the first daily puzzle, and never again after either answer.
6. With the reminder on, notifications are set at the chosen time for the next 7 days, skipping any day already done; solving today's puzzle cancels today's reminder.
7. Turning the switch off cancels all reminders. A denied permission leaves the switch off and shows the phone-settings line.
8. Tapping a reminder opens today's daily puzzle, or Home if it is done.
9. The rating ask happens only on Android, only from the 3rd active day, only right after a happy moment's end card, at most once per 60 days, and never during a lesson, game or puzzle.
10. Old saves keep working (profile migrate), and nothing is lost.
11. No console errors at 360, 412 and 1280 wide; the card works one-handed at 360.

## Out of scope
- Multiplayer and friend challenges (separate spec, after launch).
- Sharing the daily puzzle, a puzzle history calendar, streak freezes.
- Any change to the ads.

## Assumption register
- Confirmed by Suresh: DP-D1 to DP-D4 (2026-11-24).
- Proposed by Claude, approved by Suresh on 2026-11-24: DP-D5 to DP-D10 and all wording.
- Verified by tool: the bank has 353 puzzles rated 741 to 1905 (median about 994); the streak counts any day with a puzzle, game or lesson (`streakDays` in src/js/app.js); both plugin versions exist on npm with Capacitor 8 support.
- Not verified yet: that Google's review library adds nothing to the data safety form (to check in readiness).

## Open questions
- None.
