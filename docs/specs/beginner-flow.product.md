# Beginner flow, level check and cloud save (product spec)

Size: L. Status: draft v3, owner decisions in; waiting for Suresh's yes on scenarios.

## Problem
- A new player opens the app and lands straight in a game against "Engine Casual ~700", with "Stockfish 19 ready", a move list and an eval strip. A beginner does not know what any of that means.
- Two competing calls to action ("Train instead" banner and "Start with today's plan on Home"), and the tabs sit at the bottom of a long page, so the next step is hard to find.
- Everyone sees the same interface whether they have never played or are a club player.
- On Android, progress lives only on the phone. Uninstalling or changing phones loses it.

## Goal
- A brand-new player knows what to do in under 5 seconds and finishes a first lesson without help.
- Each player sees an interface that fits their level, and can change it any time.
- Android players keep their progress across reinstalls and phones through their Google Play Games account.

## Levels (one table, used everywhere)
| Level | Who | Puzzle rating band | Course start | Starting rating (new players only) | Opponent in "Just play" |
|---|---|---|---|---|---|
| Beginner | Never played, or knows little more than the moves | under 800 | `rules` (never played, or chosen in Settings) or `board` (knows the moves) | 600 | Beginner bot (about 400) |
| Improver | Knows the rules, plays casually | 800 to 1199 | first level 2 unit | 1000 | Today's rating-based pick |
| Club | Plays often, knows tactics | 1200 and up | first level 3 unit | 1300 | Today's rating-based pick |

## Decisions (assumption register)
| # | Decision | Source |
|---|---|---|
| D1 | Level found by a quick check on first launch (1 question + up to 7 puzzles, under 2 minutes, skippable) | Delegated to Claude |
| D2 | Beginner interface: one clear next step from Rani, extras hidden | Delegated to Claude; layout from the prototype |
| D3 | Cloud save: Play Games sign-in + Saved Games on Android; web unchanged | Delegated to Claude |
| D4 | Three levels as in the table above | Delegated to Claude |
| D5 | Play is never locked | Delegated to Claude |
| D6 | Check puzzles come from the local puzzle bank (no network, no AI) | Constitution |
| D7 | Starting rating per level, only for players with no rated puzzles yet | Delegated to Claude (fixes Club players showing 800) |
| D8 | "Show everything" switch reveals all tabs and elements, without changing level, hints or course | Delegated to Claude |
| D9 | Skipping: at the first question = Beginner who knows the moves; during puzzles = level from answers so far (0 to 2 correct = Beginner, 3+ = Improver); "Try Club?" = 2 harder puzzles, 1+ correct = Club (also when they skip after 1 correct; skip with 0 correct = stays Improver). On a retake from Settings, any Skip, X or Esc cancels and keeps the current level | Confirmed by Suresh |
| D10 | Beginner Home = prototype A, one next step: Rani, one Continue card, "Just play a game" | Confirmed by Suresh |
| D11 | Suresh already has a Play Console account | Confirmed by Suresh |
| D12 | Hints stay unlimited for every level (today's behaviour) | Confirmed by Suresh |
| D13 | Moving up: Rani offers it, nothing changes without a tap. Beginner gets the offer when all level 1 lessons are done; Improver when all level 2 lessons are done. "Not yet" asks again after 7 days | Confirmed by Suresh (offer); timing delegated to Claude |
| D14 | Slice 1 wording signed off: "Settings", "See all tabs, scores and move lists now", "You stopped after N.", "Yes, well spotted!", "Good try. On to the next one.", "5 tiny puzzles, about a minute", "6 puzzles, easy to tricky", "Skip, I'll choose later" | Confirmed by Suresh |
| D15 | A retake that ends as Beginner opens the next lesson, like first launch | Confirmed by Suresh |
| D16 | Web: the check may show for a moment before a slow Claude-account load restores the level; accepted until slice 3 | Confirmed by Suresh |

## Flow
1. First launch (no saved progress on the phone):
   - Android: if this phone has signed in to Play Games before (or Play Games is live for everyone), try sign-in and cloud load first, up to 10 seconds with Rani's "Getting ready" screen, skipped at once when offline. If a cloud save with a level exists, restore it and skip the check.
   - A level answered before any cloud load has happened is provisional: if a cloud save (Play Games, or the Claude account on the web) later brings a level the player chose, the cloud level wins and Rani says "Welcome back, I restored your level".
   - Otherwise Rani says hello and asks "Have you played chess before?"
     - "Never played" -> Beginner, course starts at "How the pieces move". No puzzles.
     - "I know how the pieces move" -> 5 short puzzles (easy to medium).
     - "I play often" -> 6 puzzles (easy to hard).
2. Result screen: "You're starting as an Improver", the three levels with theirs marked, "Start" button, "Choose a different level" link. A Know-the-moves player with 5 of 5 also sees "Try Club?".
3. App opens in the interface for that level.
4. Settings (gear button in the header, every screen) has "Your level" (change level, retake the check), "Show everything", and "Save to Google Play Games" (Android).
5. Players updating from 1.0.7 with any progress are not asked. Their level comes from their puzzle rating band (a player with games but no rated puzzles has the default 800, so becomes Improver), all 5 tabs stay unlocked, and Rani shows once: "You're set as Improver. Change it any time in Settings."

## Interface by level
| Element | Beginner | Improver | Club |
|---|---|---|---|
| Home | Prototype A: Rani, one Continue card, "Just play a game" | Today's 3 steps | Today's 3 steps + rating |
| Tabs | Home, Learn, Play. Train and Progress unlock when 3 lessons from their start point are fully done (learn, practice and apply) | All 5 | All 5 |
| Opponent name | "Rani's practice partner" (no rating) | Name + rating | Name + rating |
| Eval strip | Hidden | Shown | Shown |
| Notation and move list | Hidden. Plain words: "Rani's partner moved a pawn forward" | Shown with visual tips | Shown |
| Engine status pill | Hidden | Hidden | Shown |
| Hints | Unlimited, with arrows | Unlimited (today) | Unlimited (today) |
| 3D view | Available | Available | Available |
| Bottom nav | Fixed at the bottom of the screen on phones, all levels | | |

## Cloud save (Android)
- Signed in: progress loads from the cloud and merges with the phone's copy. Saved after each lesson, puzzle set and game, and when the app goes to the background.
- Not signed in, declined, or offline: everything works on the phone. Settings shows "Saved on this phone only" and a "Save to Google Play Games" button. The automatic prompt is never repeated after a decline.
- Merge never loses progress: completed lessons, games and reviews are combined; level follows the most recent level choice; puzzle rating follows the copy with more rated puzzles.
- Until Suresh publishes the Play Games setup in Play Console, the Play Games button is hidden and there is no first-launch wait. Testers turn it on by tapping the version number in Settings 5 times. Obtainium users never see a failing prompt.
- Web: unchanged.

## Scenarios
1. Given Priya opens the app for the first time and taps "Never played", then she sees her Beginner home with one "Start lesson" action, only Home, Learn and Play tabs, and no ratings, eval strip or notation anywhere.
2. Given Arjun taps "I know how the pieces move" and solves 4 of 5, then he is an Improver, his rating starts at 1000, the course opens at the first level 2 lesson, and all 5 tabs show.
3. Given Meena taps "I play often" and solves 6 of 6, then she is Club, rating 1300, course at level 3, engine pill and ratings visible.
4. Given Karthik taps "I know how the pieces move", solves 2, then taps Skip, then he is a Beginner starting at "Board and notation" and sees "You can take the check again in Settings".
5. Given Arjun solves 5 of 5 and taps "Try Club?", gets 1 of the 2 harder puzzles, then he is Club.
6. Given Priya finishes her first 3 lessons, then Rani says "New: Train" and the Train and Progress tabs appear.
7. Given Priya, signed in to Play Games, reinstalls the app, then within 10 seconds her level, lessons and puzzle rating are back and she is not asked the level question.
8. Given Arjun plays offline on a flight, when he opens the app online again, then the flight's progress is saved to the cloud and nothing from before is lost.
9. Given Meena declines the Play Games prompt, then the app works normally, saves on the phone, never prompts again by itself, and Settings offers "Save to Google Play Games".
10. Given Ravi updates from 1.0.7 with a puzzle rating of 820, then he is not asked, becomes Improver, keeps all 5 tabs, and sees Rani's one-time note.
12. Given Priya finishes the last level 1 lesson, then Rani asks "Ready for Improver?". "Yes" switches her to Improver with all tabs; "Not yet" keeps Beginner and asks again in 7 days.
11. Given Priya switches "Show everything" on, then all tabs, the eval strip and notation appear, her level stays Beginner and her course does not change.

## Acceptance criteria
1. The level check shows only when the phone has no saved progress and no cloud save with a level could be loaded; it never shows again unless started from Settings. A level set before any cloud load is provisional and loses to a chosen cloud level.
2. "Never played" assigns Beginner with zero puzzles and course start `rules`.
3. Scoring: Know-the-moves: 0 to 2 correct = Beginner (start `board`), 3 to 5 = Improver (5 of 5 also offers "Try Club?": 2 harder puzzles, 1+ correct = Club). Play-often: 0 to 2 = Beginner (start `board`), 3 to 4 = Improver, 5 to 6 = Club.
4. Skip at the first question = Beginner starting at `board`. Skip during puzzles = level from the answers so far using rule 3's thresholds for the questions answered (0 to 2 correct = Beginner, 3+ = Improver).
5. The check can be skipped at any step and takes under 2 minutes for a player who answers immediately.
6. Beginner hides eval strip, notation, ratings and engine pill on every screen, including 3D view, puzzles and game review, unless "Show everything" is on.
7. Beginner sees exactly 3 tabs until 3 lessons at or after their start point are fully done (learn, practice and apply), then 5. Example: start `board` needs `board`, `values` and the next lesson. "Show everything" shows all 5 at once.
8. Level, start point and "Show everything" survive restarts, updates and cloud restore, and a level change in Settings updates the interface immediately. Changing level in Settings moves the course start to that level's start point (Beginner: `rules`) without marking or clearing any completed lesson; finished lessons are skipped as usual.
9. New players get the starting rating for their level only if they have no rated puzzles yet, whether the level comes from the check or from Settings (confirmed by Suresh).
10. Bottom nav stays visible at the bottom of the screen on phones (360 to 600px) on every tab.
11. Android: a reinstall with Play Games signed in restores the profile; declining causes no error dialog and no repeated prompt.
12. Merging two profiles never removes a completed lesson, puzzle record or reviewed game. Game history keeps the newest 30 games, as on one phone (confirmed by Suresh).
13. Nothing here needs the network except Play Games sign-in and cloud save.
15. Rani offers the next level when all lessons of the current level are done; the level changes only after the player taps Yes.
14. All new copy follows DESIGN.md: one headline plus at most two short lines, no em dashes.

## Out of scope
- Google login on the web, iOS, leaderboards and achievements, payments, Play Store release, new course content.

## Devil's advocate
- The check can feel like an exam. Rani frames it as "let me see where to start", one puzzle per screen, Skip always visible, 6 puzzles max (7 with "Try Club?").
- Play Games needs a Play Console account ($25, ID check that can take days). Sign-in only works for listed testers until the setup is published, and a public Play Store release for a new personal account needs a closed test (12 testers, 14 days). Cheapest path: ship the level check and new interface first (slices 1 and 2); add cloud save (slice 3) when Play Console is ready.
- Hiding too much can frustrate beginners who are stronger than they said. "Show everything" and instant level changes cover that.
