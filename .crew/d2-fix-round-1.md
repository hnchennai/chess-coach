# D2 fix round 1

From two independent reviews of 799fe09 (spec + UX, Android + CI) and Suresh's answers on 2026-11-24.

## Suresh's decisions (add to docs/specs/daily-puzzle.product.md as DP-D16 to DP-D21)
- DP-D16: the Settings credit line also names the rating library, matching the licence file.
- DP-D17: on the first solved daily, only Rani's reminder offer shows; the rating ask waits for a later happy moment.
- DP-D18: players who finished dailies before D2 get the offer once, on their next daily.
- DP-D19: the reminder switch and reminders exist only while the Daily puzzle card is offered (Beginners: after Foundations). Before that, no Settings row and no scheduled reminders; any pending ones are cancelled.
- DP-D20: the licence exception also names "the Google Play services libraries they use". LICENSE-EXCEPTION, the constitution line (also give it the 2026-11-24 date), README and the Settings credit.
- DP-D21: the reminder uses the normal notification sound (channel importance stays 3).

## Fixes
1. Reminders must arrive on time on an idle phone: schedule with `allowWhileIdle: true` and `isExactNotification: false` (`setAndAllowWhileIdle(RTC_WAKEUP)`, which needs no exact-alarm permission). Fix the comment that says DP-D15 rules out allowWhileIdle. Update DP-D15's wording to say inexact, wake-while-idle.
2. Solving or missing today's daily also removes an already delivered reminder for today: `removeDeliveredNotifications` for today's id (check the plugin's real API and payload shape in node_modules).
3. Rating ask gating (AC9): the happy flag must belong to the end card it was set for. Clear it whenever any activity starts (newGame, startDrill, restoreEntry, review, as well as startSession and startLesson), and clear the 600 ms timer too. A review end card that itself finished a lesson part counts as a happy moment and may ask. Never ask after a lost game, a failed set or a missed daily.
4. Offer shows once (AC5): once the offer has been shown on an end card, it counts as offered even if the player leaves without answering.
5. DP-D19: renderRemind and rmRun only when the daily card is offered (reuse dailyOffered()).
6. Settings credit line (src/body.html ~188) per DP-D16 and DP-D20, and an ads.test.js check that it matches.
7. Accessibility: give the reminder section an accessible name like the other Settings sections; give the time select a visible label "Time" (or the row's existing label pattern) and disable it while the switch is off.
8. Merged-manifest check also fails on USE_EXACT_ALARM.

## Tests to add
- Happy moment "finished lesson part" asks (AC9).
- No ask after a lost game that follows a happy moment whose end card never asked (the review-then-new-game path).
- No ask when an activity starts within the 600 ms delay.
- Offer counts as shown even when unanswered.
- Beginner before Foundations: no Settings row, no schedule calls, pending reminders cancelled.
- allowWhileIdle true in schedule calls; delivered reminder removed on solving.

## Nits logged, not fixed
- offered and rateT are device-only, so a new phone can be offered again and can ask again within 60 days (Google limits asks anyway).
- Rating sheet opens asynchronously and could land as the next puzzle opens.
