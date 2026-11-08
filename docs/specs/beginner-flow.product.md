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

## Slice S2a: level-based interface (details)
Status: approved by Suresh (2026-11-08).

### Decisions
| # | Decision | Source |
|---|---|---|
| D17 | Beginners see no move list. Rani's strip under the board says the last move in plain words. In review, the same line for the move you are on | Confirmed by Suresh |
| D18 | Move chips (piece icon + square, tap to see it on the board) stay in Rani's explanations for every level | Confirmed by Suresh |
| D19 | Beginners get no opponent picker: "New game" always plays Rani's practice partner (Beginner bot, about 400). Lesson tasks still pick their own opponent. Show everything or a level change brings the picker back | Confirmed by Suresh |
| D20 | Level-up offer counts lessons from the player's start point. A Beginner who started at "Board and notation" gets it after "The blunder check", without the two skipped lessons | Confirmed by Suresh |
| D21 | When the offer shows: right after the lesson that completes the level, and at app start once 7 days have passed since "Not yet" or since a level change in Settings. One Rani note at a time | Delegated to Claude |
| D22 | Show everything also shows the engine pill and the opponent picker (it reveals every element, as D8 says) | Delegated to Claude |
| D23 | Beginners never read "Stockfish" or "the engine". The opponent is "Rani's partner"; analysis is Rani speaking as "I": "Exactly the move I'd play.", "I slightly preferred ♞ f3.", "Rani's partner to move", "Rani's partner wins this one.", "This is the best move here." Improver and Club unchanged | Confirmed by Suresh |
| D24 | "Safe or blunder?" items for Beginners read "White wants to play this move." (the board arrow shows it), no notation | Confirmed by Suresh |
| D25 | Until Train unlocks, a Beginner's Today card heading is "Learn it, then play it" | Confirmed by Suresh |
| D26 | Accuracy % (review, Progress history) is hidden for Beginners unless Show everything is on. Move grades in words stay | Confirmed by Suresh |
| D27 | New copy uses the app's curly apostrophe (’), as S1 did. Capture sentences follow the signed pattern for every piece ("You took a queen.") | Delegated to Claude |
| D28 | King and queen moves read "Rani's partner moved the queen." / "You moved your queen."; capture plus promotion reads "took your rook and turned a pawn into a queen." | Delegated to Claude (extends the signed pattern) |
| D29 | Improver and Club players updated from 1.0.7 (start "How the pieces move") get Home at their level: Next step, Today and the roadmap start at their level's first unfinished lesson. Their stored start and finished lessons do not change, and unfinished earlier lessons stay open in Learn | Confirmed by Suresh |
| D30 | Beginners' stage progress drops the puzzle-rating goal: a Beginner stage is done when its lessons are done and they beat Rani's partner. Next step after the lessons: "Beat Rani's practice partner" | Confirmed by Suresh |
| D31 | Home never suggests lessons before the player's start point, for every level. Skipped lessons stay open in Learn | Confirmed by Suresh |
| D32 | Beginners see no notation tip on move chips, and the chip's hover title drops the notation ("White knight to f3. Tap to see it on the board."). Tapping still shows the move on the board. Show everything brings the tip back | Confirmed by Suresh |
| D33 | Course text, level 1 only (all levels read it): "the Beginner engine" / "the Casual engine" become "Rani's practice partner" and "(??)" goes, in the Opening principles last step and task, The blunder check task, and the stage 1 method on Home. Later-level course text (checkpoints, endgame drills, "(about 1000)") gets its own course-text pass later | Confirmed by Suresh |

### What each level sees after S2a
| | Beginner | Improver | Club |
|---|---|---|---|
| Eval strip | Hidden | Shown | Shown |
| Engine pill | Hidden | Hidden | Shown, state readable without colour |
| Ratings (opponent tag, puzzle rating, "rated 950", "~700") | Hidden | Shown | Shown |
| Moves card | Hidden, last move in words instead | Shown | Shown |
| Opponent picker | Hidden | Shown | Shown |
| Tabs | 3 until 3 lessons done, then 5 | 5 | 5 |
| Home "Next step" and roadmap | As today (S2b changes Beginner Home) | Start at their level, not at stage 1 | Same |
| Bottom nav on phones (up to 600px) | Fixed at the bottom | Fixed | Fixed |
Show everything turns every "Hidden" above into "Shown" without changing the level.

### New copy (signed off by Suresh)
- Opponent name: "Rani's practice partner" (no rating). Play bar: "Your game vs Rani's practice partner, you play White".
- Last move in words (partner / you):
  - "Rani's partner moved a knight." / "You moved a knight."
  - "Rani's partner moved a pawn forward." / "You moved a pawn forward."
  - "Rani's partner took your bishop." / "You took a bishop."
  - "Rani's partner castled to keep the king safe." / "You castled to keep your king safe."
  - "Rani's partner turned a pawn into a queen." / "You turned a pawn into a queen."
  - Check adds " Check!" at the end. Checkmate: "Checkmate. Rani's partner won." / "Checkmate. You won!"
- Train card for Beginners (after unlock): "Puzzles at your level", "Puzzles picked for you. Solve them to get stronger.", button "Start 10 puzzles".
- Tab unlock (Rani note, once): "New: Train and Progress. Practise with puzzles and see how you're doing."
- Level-up offer (Rani note with two buttons):
  - Beginner: "Ready for Improver? You finished every Foundations lesson. Next come forks, pins and other tactics."
  - Improver: "Ready for Club? You finished every Tactics lesson. Next come endgames and seeing two moves ahead."
  - Buttons: "Yes, move me up" and "Not yet".
  - After Yes: "You're an Improver now. All tabs are open." (Club: "You're Club level now.")
  - After Not yet: "OK. I'll ask again in a week. You can change it any time in Settings."

### Scenarios
1. Given Priya is a new Beginner on a 412px phone, when she opens Play, then she sees the board with no eval strip, no engine pill, "Rani's practice partner" with no rating, no Moves card and no opponent picker, and Home, Learn and Play fixed at the bottom of the screen.
2. Given Priya plays a game, when her partner takes her bishop with check, then Rani's strip says "Rani's partner took your bishop. Check!" and no notation appears anywhere.
3. Given Priya reviews a finished game, when she taps Next, then she sees "You moved a pawn forward." with no eval and no move list.
4. Given Priya started at "How the pieces move", when she finishes "Board and notation" (her third lesson), then Rani says "New: Train and Progress..." and both tabs appear at once. Train shows "Puzzles at your level" with no rating numbers.
5. Given Priya turns on Show everything, then the eval strip, engine pill, ratings, Moves card, opponent picker and all 5 tabs appear at once, and her level stays Beginner. Turning it off hides them again.
6. Given Karthik started at "Board and notation", when he finishes "The blunder check", then Rani asks "Ready for Improver?". "Not yet" keeps everything as it is, and the question comes back at app start 7 days later. "Yes, move me up" makes him Improver with all 5 tabs and Forks as the next lesson; his rating becomes 1000 only if he has no rated puzzles.
7. Given Arjun is an Improver, then the engine pill is hidden but the eval strip, Moves card and ratings show, and Home's next step points at his first unfinished level 2 lesson, not "How the pieces move".
8. Given Meena is Club on a 360px phone, then the engine pill shows its state in words or a shape (not colour alone), the bottom nav stays visible on every tab, and Rani's notes sit above the nav, not over it.
9. Given Priya changes her level to Club in Settings in the middle of a game, then the eval strip, engine pill, ratings and Moves card appear at once and the game carries on.

### Also fixed in S2a (carry-over from S1 review)
- Rani's note no longer covers the bottom nav.
- The level check's close (X) sits in the same corner on every screen.
- Focus returns to a sensible place (not the page body) after the check closes.
- Esc closes only the top layer (Settings), not a move tip behind it.

## Devil's advocate
- The check can feel like an exam. Rani frames it as "let me see where to start", one puzzle per screen, Skip always visible, 6 puzzles max (7 with "Try Club?").
- Play Games needs a Play Console account ($25, ID check that can take days). Sign-in only works for listed testers until the setup is published, and a public Play Store release for a new personal account needs a closed test (12 testers, 14 days). Cheapest path: ship the level check and new interface first (slices 1 and 2); add cloud save (slice 3) when Play Console is ready.
- Hiding too much can frustrate beginners who are stronger than they said. "Show everything" and instant level changes cover that.
