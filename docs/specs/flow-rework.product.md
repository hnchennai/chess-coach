# Flow rework and tip slot (product spec)

Size: L. Status: approved by Suresh (2026-11-12): scenarios, tips, new copy and the constitution wording.
Mockups: https://claude.ai/artifact/1w7FN46dmJuwkXAT9P551w (approved by Suresh, 2026-11-12).

## Problem
- Beginner Home shows one clear next step. Improver and Club Home still open with six cards and a small "Next step" button inside the first one.
- Activities end without a next step. A game ends with "Review this game" and "New game" in a box over the board. A puzzle set ends with "Back to the course", "Go again" and "Close". None of these starts the next part of the lesson.
- The app is to become free with ads and a paid "Remove ads". There is no place for an ad today, and the constitution forbids ads.

## Goal
- Every screen has one main button, and it is the player's next step.
- The loop runs on its own: learn the lesson, practise it, play it, review the game, next lesson.
- One quiet slot exists for an ad later. Until the ads slice, it shows a tip from Rani.

## Slices
| Slice | What | Ships |
|---|---|---|
| F1 | Flow: end cards with a next step, Continue card for Improver and Club Home | This PR |
| F2 | Tip slot (no ads code), first-day rule, constitution change | This PR, after F1 |
| F3 | Android target upgrade, ads SDK, consent prompt | Later, needs AdMob and a licence check |
| F4 | Play Store listing and closed test | Later, needs the Play Console account |
| F5 | "Remove ads" purchase | Later |

## Decisions
| # | Decision | Source |
|---|---|---|
| F-D1 | The app becomes free with ads and a one-time "Remove ads" purchase. The constitution changes as written below | Confirmed by Suresh |
| F-D2 | Play Store listing is for ages 13 and older. Ads will be non-personalised | Confirmed by Suresh |
| F-D3 | The slot appears in four places: the end card after a game, the end card after a lesson step or puzzle set, the bottom of Home, the bottom of Progress | Confirmed by Suresh |
| F-D4 | The slot never appears on or beside the board, during a lesson, game, puzzle or review, in the level check, in Settings, or full screen | Confirmed by Suresh |
| F-D5 | The slot is hidden for the whole first calendar day a player uses the app. It appears from the next calendar day | Confirmed by Suresh |
| F-D6 | Until slice F3, the slot shows a tip from Rani. Later an ad takes the same space when one loads, and the tip stays as the fallback (offline, no ad) | Confirmed by Suresh |
| F-D7 | After an activity, the main button is the next step in the loop ("Rani picks the next step"). Other choices stay as small buttons | Confirmed by Suresh |
| F-D8 | Improver and Club Home: a Continue card first, then all of today's cards in today's order | Confirmed by Suresh |
| F-D9 | The game result moves from the box over the board into a card under the board, so the final position stays visible | Confirmed by Suresh (mockup screen 1) |
| F-D10 | The Continue card for Improver and Club follows today's "Next step" rule exactly (same lesson, puzzle goal or game goal as today). The stage card loses its own "Next step" button | Confirmed by Suresh (mockup screen 3) |
| F-D11 | Every end card has a small "Home" button | Confirmed by Suresh (mockup) |
| F-D12 | The slot has one fixed height (76px or more), so the page never jumps. The tip is picked once per screen visit and does not change while the player looks at it | Delegated to Claude |
| F-D13 | Tips are split in two lists: Beginner (no notation, no jargon) and Improver/Club. A Beginner with Show everything on still gets Beginner tips | Delegated to Claude |
| F-D14 | With Coach Gaja chosen, the slot label reads "Gaja’s tip" and shows Gaja | Delegated to Claude, same rule as D48 |
| F-D15 | Beginner Home does not change, apart from the slot under its buttons | Confirmed by Suresh (mockup screen 3 notes) |
| F-D16 | "That’s the whole game." and its next-step button show only after the player steps to the last move of a review. A review of a just-finished game still opens on the last move, as today | Confirmed by Suresh |
| F-D17 | The slot is hidden everywhere, Home and Progress included, while a game is unfinished or a lesson, puzzle set, drill, review or level check is open. The review-finished card has no slot | Confirmed by Suresh |
| F-D18 | A lesson game's goal decided before the game ends: the goal card uses the next-step buttons. Passed: main "Start next lesson" (or the next step per the tables), small "Keep playing". Failed: main "Try again", small "Keep playing". "Back to the course" leaves this card too | Confirmed by Suresh |
| F-D19 | Fix in this PR, as its own commit: a game the player ends with their own move was recorded again at every app start. New copies stop. Existing copies in history are left alone | Confirmed by Suresh |
| F-D20 | The Continue card's "Lesson N of M" for a lesson above the player's level counts lessons in that lesson's own stage | Confirmed by Suresh |
| F-D21 | Learn part finished, next part a game or drill: "Next: play it in a real game." / "Play the lesson game", or "Next: one more step." / "Continue", small "Home". Card heading: "Learn" and the lesson title | Confirmed by Suresh |
| F-D22 | Train sets that are not puzzle sets (Safe or blunder?, opening drills) end with main "Go again". A themed puzzle set's "10 more puzzles" starts the same theme. An endgame drill follows the table: failed "Go again", passed the next step | Confirmed by Suresh |
| F-D23 | A lesson part passed while another part of the same lesson is undone: the card names that part ("Next: practise it." / "Start practice", or the matching signed line), never "Next lesson: <same lesson>" | Confirmed by Suresh |

## End cards (F1)

### After a game (card under the board)
| Case | Title and line | Main button | Small buttons |
|---|---|---|---|
| Normal game, any result | Today's title and line | Review this game | New game, Home |
| Lesson game, task passed | Today's title and line, then "Next lesson: <title>" | Start next lesson | Review this game, Home |
| Lesson game, task passed, no lesson left at the player's level | Today's title and line | Review this game | New game, Home |
| Lesson game, task not passed | Today's title and line | Try again | Review this game, Home |
| Review finished (last move reached) | "That’s the whole game." | The player's next step, as the Continue card names it | New game, Home |

### After a lesson step or puzzle set
| Case | Line above the button | Main button | Small buttons |
|---|---|---|---|
| Lesson practice passed, game task next | Next: play it in a real game. | Play the lesson game | Go again, Home |
| Lesson practice passed, drill or other task next | Next: one more step. | Continue | Go again, Home |
| Learn part finished, practice next | Next: practise it. | Start practice | Home |
| Last part of a lesson passed, another lesson at the player's level | Next lesson: <title> | Start next lesson | Go again, Home |
| Last part passed, no lesson left at the player's level | (none) | Home | Go again |
| Not passed | (none; today's "You need N to pass. Have another go.") | Go again | Home |
| Puzzle set from Train (not part of a lesson) | (none) | 10 more puzzles | Home |
| Review of missed puzzles finished | (none) | Home | (none) |

- "Back to the course" and "Close" are removed from the end card. The Learn tab still opens the course.
- A Beginner's end card never names a lesson outside Foundations (D39). When Foundations is done it follows Beginner Home: "Play now" against Rani’s practice partner, or "Start 10 puzzles".
- D49 still holds: a main button that would start a lesson game while another game is unfinished asks first.

## Improver and Club Home (F1)
- Continue card, same look as the Beginner card: kicker, piece icon, title, bar (lessons only), one main button.
- Kicker: "Continue · Lesson N of M" for a lesson, counting lessons of the player's level from their effective start (D29). "Continue" alone for a puzzle or game goal.
- Title and button:

| Today's next step | Title | Button |
|---|---|---|
| A lesson part | lesson title | Start lesson (not started) or Continue (started) |
| Rated puzzles to reach the stage target | Puzzles to reach <target> | Start 10 puzzles |
| Beat the stage opponent | Beat the <name> engine | Play now (or Back to my game with an unfinished game) |
| Roadmap finished | Keep sharp: rated puzzles | Start 10 puzzles |

- The stage card keeps its text, bar and milestones, and loses the "Next step" button and its sub line.
- Today's steps, stage detail, roadmap, coach and pieces and methods cards do not change.

## Tip slot (F2)
- Look: a tinted card, coach picture, label "Rani’s tip", one tip of at most two short lines.
- No network call, no ads code, nothing collected in this slice.
- First-day rule (F-D5): the first day is the earliest day the app has a record for. No slot that day, anywhere.
- Screen readers hear it as a note: "Rani’s tip: <text>". It is not a button and takes no focus.

### Tips (signed off by Suresh)
Beginner:
1. Before you move, look at what their last move attacks.
2. Castle early. A king in the middle is easy to attack.
3. Bring out your knights and bishops before your queen.
4. A free piece is one nobody guards. Take it.
5. Before you let go of a piece, check it is safe on its new square.
6. Pawns can’t move back. Push them with care.
7. Two pieces attacking one square beat one piece guarding it.
8. When you are ahead, swap pieces. The game gets simpler.

Improver and Club:
1. Checks, captures, threats. Look at them in that order, every move.
2. A knight on the edge covers fewer squares. Keep it near the middle.
3. Two attacks at once win a piece. Look for forks every move.
4. Rooks belong on open files. Put one there before your opponent does.
5. A pinned piece is a poor guard. Count it out.
6. In the endgame, the king is a fighting piece. Bring it to the middle.
7. Passed pawns must be pushed. Put a rook behind them.
8. After every game, find the one move where it turned.

## New copy (signed off by Suresh)
- Buttons: "Home", "Keep playing", "Start practice", "Play the lesson game", "Start next lesson", "10 more puzzles", "Try again". Existing: "Review this game", "New game", "Go again", "Continue", "Start lesson", "Play now", "Start 10 puzzles", "Back to my game".
- Lines: "Next: practise it." / "Next: play it in a real game." / "Next: one more step." / "Next lesson: <title>" / "That’s the whole game."
- Continue card: "Continue · Lesson N of M", "Continue", "Puzzles to reach <target>".
- Slot label: "Rani’s tip", "Gaja’s tip".

## Constitution changes (approved by Suresh)
- Product truths. Old: "Suresh's Chess Coach will be sold as a paid game on Android (Play Store) and the web." New: "Suresh's Chess Coach is free on Android (Play Store) and the web, with ads and a one-time Remove ads purchase. The Play Store listing is for ages 13 and older."
- Security and privacy. Old: "No ads SDKs, trackers or analytics without Suresh's explicit yes." New: "Ads are allowed in the ad slot only: after an activity ends, and at the bottom of Home and Progress. Never on or beside the board, never during a lesson, game, puzzle or review, never full screen, never on a player's first day. Ads are non-personalised. No other trackers or analytics without Suresh's explicit yes. Adding or changing an ads SDK is a checkpoint."
- Product truths, the offline line gains: "(cloud save, fonts, ads). With no ad, the slot shows a tip from the coach."

## Scenarios
1. Given Arjun is an Improver whose next step is "Pins and skewers" (1 of 5 Tactics lessons done), when he opens Home on a 412px phone, then the first card reads "Continue · Lesson 2 of 5" / "Pins and skewers" with a bar and "Continue" or "Start lesson". The stage card below has no "Next step" button. Today's steps, stage detail, roadmap, coach and pieces and methods follow in today's order.
2. Given Arjun finished every Tactics lesson and his rating is under the stage target, then the card reads "Continue" / "Puzzles to reach 1200" with "Start 10 puzzles".
3. Given Meena plays a normal game and wins, when the game ends, then the board shows the final position with nothing over it, and a card under it reads "Checkmate. You win!" with the main button "Review this game" and small "New game" and "Home".
4. Given Priya (Beginner) passes the practice of "The blunder check" with 8 of 10, then the end card reads "Session complete", "Next: play it in a real game." and the main button "Play the lesson game", with small "Go again" and "Home". Tapping the main button starts the lesson game against Rani’s practice partner.
5. Given Priya scores 4 of 10 where 7 are needed, then the main button is "Go again" and no next step is offered.
6. Given Arjun finishes the last part of "Forks", then the end card reads "Next lesson: Pins and skewers" with "Start next lesson".
7. Given Meena solves a set of 10 puzzles from Train, then the main button is "10 more puzzles" with small "Home".
8. Given Meena steps to the last move of a review, then a card reads "That’s the whole game." and its main button is her next step, the same one Home's Continue card names.
9. Given Priya has an unfinished game and an end card's main button would start a lesson game, when she taps it, then Rani asks "You have a game going. Finish it first?" (D49).
10. Given Ravi installs the app today, then he sees no tip slot anywhere today. Tomorrow the slot shows at the bottom of Home and Progress and on end cards.
11. Given Priya (Beginner, second day) finishes a game, then the slot under the buttons shows "Rani’s tip" with a Beginner tip, with no notation. The tip does not change while she stays on the card.
12. Given Arjun is in the middle of a lesson, game, puzzle or review, then no slot is visible on that screen, at 360, 412 or 1280 wide.
13. Given the phone is offline, then the slot still shows a tip and nothing tries to reach the network.
14. Given Meena chose Coach Gaja, then the label reads "Gaja’s tip".
15. Given Priya is a Beginner on her second day, then Beginner Home is as in S2b, with the slot under "Just play a game", and Continue still on the first screen at 412x915.

## Acceptance criteria
1. Improver and Club Home (and a Beginner with Show everything on) start with the Continue card; its target equals today's `nextAction` result in every state of the table above.
2. Home has exactly one primary button for every level.
3. The game result box over the board is gone; the result card sits under the board in Play at 360, 412 and 1280, and the final position is fully visible.
4. Every row of both end-card tables is covered by a test that checks the visible title, line, main button and small buttons, and what the main button starts.
5. Not passing never offers the next step.
6. The slot shows only in the four places of F-D3 and never in the places of F-D4.
7. No slot on the first day; slot from the next calendar day. Changing the device clock back never hides progress or breaks the app.
8. The slot's height does not change between tips, and nothing on the page moves when it renders.
9. Beginner tips contain no notation, ratings or engine names. No tip or new copy has an em dash.
10. No network request is added. The app works offline as today.
11. No new profile field without a `migrate()` step. Progress is never lost.
12. S1, S2a and S2b suites stay green, with assertions moved only where this spec changes the screen.
13. Tap targets 44px or more on every new button; keyboard reaches every new button; Esc behaviour unchanged.
14. CONSTITUTION.md carries the new wording above, and nothing else in it changes.

## Out of scope
- Any ads SDK, consent prompt, purchase, Play Store work (F3 to F5).
- Course text, puzzle content, the level check, cloud save.
- The older follow-ups in .crew/STATE.md (tap targets under 44px on old buttons, landscape, keyboard order), unless a changed screen touches them.

## Risks for later slices
- Stockfish is GPLv3. A closed ads SDK in the same app needs a licence check before F3.
- Capacitor 6 targets an older Android level than Play accepts for new apps. F3 starts with the upgrade.
- A new personal Play Console account needs a closed test with 12 testers for 14 days.
