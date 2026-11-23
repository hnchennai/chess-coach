# Board screens and piece tags, G (product spec)

Size: L. Status: approved by Suresh (2026-11-21): decisions, scenarios and wording. G1 shipped in PR #12 (v1.0.44). G2 design pass done; G-D18 to G-D26 added after it.
Builds on: `flow-rework.product.md` (F-D1 to F-D33), `beginner-flow.product.md` (D38), `ads.product.md` (A-D1 to A-D19).

## Problem
- On a phone the board sits at the top of every tab. Switching tabs changes only the part under it, so the tabs do not feel like different places.
- The themed piece sets use emblems (a rocket, a sun, a mask). A player cannot tell which emblem is the bishop, the knight or the king. The small symbol on the base of a 3D piece is too small to read on a phone.

## Goal
- One rule a new player can guess: tabs are menus, the board is a screen you open and close.
- Every themed piece says what it is, at a glance, in both board views.

## Users
- Every level (Beginner, Improver, Club), on a phone first. Tablets and wide screens keep today's layout.

## Slices
| Slice | What | Size |
|---|---|---|
| G1 | Piece tags in the flat and 3D views, the name line for a tapped piece, the Settings switch | M |
| G2a | Phone layout: tab pages without the board, the board screen with the Close bar, tabs back on end cards, Play as a start page, Resume game on Play and every Home, start on Home, the tip and banner rule | L. Design: `board-screens.tech.md` |
| G2b | One thing waits per tab; lessons, sets and drills saved on the device so Resume survives a restart | M |
| G2c | The phone's back button acts as Close (`@capacitor/app`) | S, phone test |
| G2d | Sideways phone: board left, controls right. Classic flat board as the first-time default. The app is named "Chess Coach" | S, phone test |

## Decisions
| # | Decision | Source |
|---|---|---|
| G-D1 | On phones (one-column layout, up to 860px wide) Home, Learn, Train, Play and Progress are full pages with no board | Suresh, 2026-11-21 |
| G-D2 | The board shows only on the activity screen: a game, a lesson, a puzzle set or drill, a review | Suresh, 2026-11-21 |
| G-D3 | The activity screen fills the phone screen. The bottom tabs are hidden. A Close button sits at the top left, with the activity's name and where the player is in it (move number, "Puzzle 3 of 10", lesson step) | Suresh, 2026-11-21 (mockup screen 3) |
| G-D4 | Close saves and leaves at once, with no question. The player lands on the tab the activity belongs to (Learn, Train or Play) | Suresh, 2026-11-21 |
| G-D5 | An unfinished game shows a "Resume game" card first on the Play tab and on Home, under the Continue card. An unfinished lesson or puzzle set shows a Resume card first on its own tab | Suresh, 2026-11-21 (mockup screens 1 and 2) |
| G-D6 | The Play tab is a start page: Resume game (when there is one), New game (colour, opponent, Start new game), then the last three finished games. The full list stays on Progress | Suresh, 2026-11-21 (mockup screen 2) |
| G-D7 | Home for Improver and Club keeps today's cards in today's order (F-D8), without the board above them. Beginner Home is unchanged | Follows from G-D1 |
| G-D8 | End cards (F1) show on the activity screen, under the board, as today. When an end card is on screen the bottom tabs come back, so the player can go anywhere | Delegated to Claude |
| G-D9 | The phone's back button does the same as Close on the activity screen | Delegated to Claude |
| G-D10 | Tablets and wide screens (board left, panel right) do not change, apart from the piece tags | Suresh, 2026-11-21 |
| G-D11 | The tip slot and the ad banner are hidden while the activity screen is open, and never share a screen with a board in use. A saved game that the player has closed no longer hides them on Home, Progress or end cards. This replaces the strict part of F-D17 and F-D32 on phones, from slice G2 | Suresh, 2026-11-21 |
| G-D12 | On phones the banner shows on Home for every level, because Home has no board (A-D19 still holds: never with the board) | Suresh, 2026-11-21 |
| G-D13 | Themed piece sets get a small round tag on every piece with the standard chess symbol for its role. In 3D the tag floats above the piece and always faces the player. In the flat view it sits in the corner of the piece. Classic pieces get no tag | Suresh, 2026-11-21 |
| G-D14 | Tapping a themed piece shows one line under the board: the emblem's name, the role, and how it moves. For example "Rocket: knight. Jumps in an L shape." (Hero League: the rocket is the knight) | Suresh, 2026-11-21 (mockup screen 3); wording delegated to Claude |
| G-D15 | Settings, in "Coach and pieces": a switch "Piece tags", on by default. It turns the tags off in both views. The name line for a tapped piece stays | Suresh, 2026-11-21 |
| G-D16 | The tag is readable at 360px wide: at least 14px across in the flat view, and it never hides the emblem or a neighbour's emblem by more than a corner | Delegated to Claude |
| G-D17 | The level check, Settings and Rani's notes do not change | Scope |
| G-D18 | The phone's back button acts as Close through the official `@capacitor/app` library, pinned. It ships as its own last slice (G2c) with its own phone test. Refines G-D9 | Suresh, 2026-11-21 |
| G-D19 | A lesson in progress and a puzzle set or drill in progress are saved on the device (not in the profile, not in the cloud), so their Resume cards survive an app restart. Slice G2b | Suresh, 2026-11-21 |
| G-D20 | One thing can wait per tab: a game on Play, a lesson on Learn, a set or drill on Train. Opening one never ends another. This replaces D50 on phones. Slice G2b; until then opening the game still ends an open lesson or set, as today | Suresh, 2026-11-21 |
| G-D21 | Every level's Home shows the "Resume game" card while a game is unfinished. Beginner Home's "Back to my game" button is retired. This changes F-D15 for that one button | Suresh, 2026-11-21 |
| G-D22 | The Resume game card's line reads "Move 12, your turn" or "Move 12, engine to move" | Suresh, 2026-11-21 |
| G-D23 | Closing a review returns the player to where it was opened: Progress for a past game opened there, Play for a review opened from a game's end card. Refines G-D4 | Suresh, 2026-11-21 |
| G-D24 | The Close bar has the Settings gear at its top right, so pieces, 3D and Piece tags can be changed without closing | Suresh, 2026-11-21 |
| G-D25 | On a phone the app always opens on Home, whatever tab it was closed on | Suresh, 2026-11-21 |
| G-D26 | A drill's card reads "Resume drill" | Delegated to Claude |
| G-D27 | Closing a review that was opened in the middle of a game returns to that game. A second Close goes to Play | Suresh, 2026-11-21 |
| G-D28 | For a Beginner the Resume game card reads "Move 12, Rani's partner to move" when it is not their move (Beginners never see "engine") | Suresh, 2026-11-21 |
| G-D29 | "Back to my game" is renamed "Resume game" everywhere. When the Continue card's own button is already the game, Home shows no second Resume game card | Suresh, 2026-11-21; second sentence delegated to Claude |
| G-D30 | Resume card lines: "Lesson · step 2 of 5", "Puzzle 3 of 10", "Endgame drill". Close bar for a game: "Your game" with the move line | Suresh, 2026-11-21 |
| G-D31 | On an end card the tip and banner show only if the board on screen is not a game in progress. A move played under an end card ends the end card at once. A drill closes to the tab it was started from | Delegated to Claude (review, 2026-11-22; follows G-D11) |
| G-D32 | Phone held sideways on the board screen (up to 860px wide, under 500px high): the board sits on the left and fills the height under the Close bar. The opponent line, the buttons, Rani's card and everything else sit in a column on its right, which scrolls on its own. Upright phones and wide screens do not change | Suresh, 2026-11-22 (phone test of 1.0.45: the board was very small) |
| G-D33 | A player who has never chosen pieces or a view starts with the classic pieces on the flat (2D) board. A player who has chosen keeps the choice. The themed sets and the 3D view stay in Settings | Suresh, 2026-11-22 |
| G-D34 | The app's name on screen is "Chess Coach" (the header and the page title), not "Suresh's Chess Coach". Saved data is not touched | Suresh, 2026-11-22 |
| G-D35 | Waiting items survive on wide screens too: opening the game or another tab's activity parks a lesson or set instead of ending it. Replaces D50 at every width | Suresh, 2026-11-23 (review found a sideways big phone used the wide layout and lost the waiting set) |
| G-D36 | A game that ends while closed gets a result card first on Play and Home: "Your game ended", the result line, buttons "See the end" and "Review". It goes once opened or when a new game starts | Suresh, 2026-11-23 |
| G-D37 | Home's Continue and Today's steps resume the waiting item when it is the one they would start ("Resume lesson", "Resume puzzles", "Resume drill"); a different one still replaces it with no question | Delegated to Claude (review, 2026-11-23) |
| G-D38 | Back button on a tab page: from Learn, Train, Play's start page or Progress it opens Home; on Home it leaves the app (the app stays in memory, as today). No "press again to leave" | Suresh, 2026-11-23 |
| G-D39 | Back button on wide screens (over 860px): closes a sheet or a note if one is open, else the G-D38 tab rule. It never ends or parks a lesson, set, review or game on the board | Suresh, 2026-11-23 |
| G-D40 | Back button order, every width: Settings open, close it; level check open, do what its Esc does (and nothing more when Esc does nothing); a note from Rani open, close it as Esc does; phone board screen open (end card or not), Close; then G-D38. Not in a browser (no web history handling) | Delegated to Claude, 2026-11-23 |

## New wording (all of it)
- Button, top left of the activity screen: "Close" (spoken label; the button shows an X)
- Card title and button: "Resume game"; card line: "Move 12, your turn" (the real move number)
- Card title and button for a lesson, set or drill: "Resume lesson", "Resume puzzles", "Resume drill"
- Resume game card line when it is not the player's move: "Move 12, engine to move"
- Play tab card heading: "Recent games"
- Settings switch: "Piece tags"
- Name line roles, after the emblem's name and a colon:
  - "king. Moves one square in any direction."
  - "queen. Moves any distance, straight or diagonally."
  - "rook. Moves any distance in straight lines."
  - "bishop. Moves any distance diagonally."
  - "knight. Jumps in an L shape."
  - "pawn. Moves forward, captures diagonally."

## Scenarios
1. Given Priya (Beginner, phone) taps Learn, then Train, then Progress, then each tab is a full page and no board is on screen.
2. Given Arjun (Club, phone) opens the app, then Home shows the Continue card and his other cards with no board, and the tip and banner follow today's first-day rule.
3. Given Arjun taps Play and then "Start new game", then the board fills the screen, the tabs are gone, and Close is at the top left.
4. Given Arjun is on move 12 and taps Close, then he is on the Play tab at once, a "Resume game" card says "Move 12, your turn", and Home shows the same card. Tapping it brings back the same position.
5. Given Arjun closes the app in the middle of a game and opens it next day, then the app opens on Home with the "Resume game" card, not on the board.
6. Given Priya opens a lesson from Learn and finishes it, then the end card shows under the board with the next step, and the tabs are back.
7. Given Meera presses the phone's back button during a puzzle set, then the set closes like Close does, and "Resume puzzles" is first on Train.
8. Given Arjun uses a tablet held sideways (1280 wide), then the board is on the left and the tabs on the right, as today.
9. Given Arjun plays with the Hero League set in 3D, then every piece has a small symbol tag above it that faces him as he turns the board.
10. Given Arjun taps the rocket, then the line under the board reads "Rocket: knight. Jumps in an L shape."
11. Given Arjun turns "Piece tags" off in Settings, then the tags are gone in both views, and tapping a piece still shows the name line.
12. Given Priya uses the classic pieces, then there are no tags and no name line.
13. Failure: given the game screen is open and the app is closed by the system, when Arjun returns, then no move is lost and the game is where he left it.
14. Edge: given Arjun has an unfinished game and an unfinished lesson, then Play shows "Resume game" and Learn shows "Resume lesson", and opening one does not end the other.

## Acceptance criteria
1. At 360x800 and 412x915, with no activity open, the board is not on screen on any of the five tabs.
2. Starting or resuming any activity shows the board and hides the tab bar within one frame. Close, and the back button, hide the board and show the tab bar within one frame.
3. Close never asks a question and never loses a move, a lesson step or a puzzle result.
4. "Resume game" shows on Play and Home exactly while a game is unfinished, with the right move number and side to move.
5. End cards keep every rule of F1 (titles, main button, small buttons). The tab bar is visible whenever an end card is.
6. At 1280x900 every existing suite passes unchanged (f1, s1, s2a, s2b, f3b).
7. The banner and the tip never show while the activity screen is open. A unit test asserts the rule in one function.
8. Each themed set shows six different tags per colour, one per role, in both views. Classic shows none.
9. A 3D tag faces the camera at every board angle and stays above its own piece. No tag is drawn for a captured piece.
10. The name line shows the right emblem name and role for all sets and both colours (a unit test walks every set).
11. "Piece tags" off: no tag in either view, the choice survives an app restart, and old saves default to on (a `migrate()` step).
12. 3D frame time with tags on is within 10 percent of tags off on the test phone size. No console errors.
13. No em dashes in new copy. Every new button is at least 44px high.

## Out of scope
- Tablet and desktop layout. The level check. Course text and puzzle content.
- New themes or new emblem art. Clocks, online play, move sounds.
- Real ads (the launch switch), Remove ads, the Play listing.

## Readiness
| Item | Owner | Status |
|---|---|---|
| Repo `hnchennai/chess-coach`, branch `crew/g-board-screens` | Claude | Ready |
| Playwright at 360, 412, 1280, 915 | Claude | Ready (same setup as F3b) |
| Phone test of each slice before merge | Suresh | Needed for G1 and G2 |
| No new accounts, keys or libraries | | None needed |

## Assumption register
- Confirmed by Suresh: G-D1 to G-D7, G-D10 to G-D15.
- Delegated to Claude: G-D8, G-D9, G-D16, the name line wording.
- Verified by tool: an unfinished game is already saved on every move; themed sets already carry an emblem name and a role per piece; the 3D pieces already carry a small symbol plaque on the base.
- Verified by the design pass: a game survives an app restart; a lesson step, a set's place and a review do not (memory only). Every puzzle result and rating is saved when answered. G-D19 adds the saving.

## Open questions
- None.

## Risks
- G2 moves the board in and out of the page. The 3D view must not be rebuilt each time, or opening a game will feel slow. The design pass covers this.
- Many existing browser checks assume the board is always on screen on phones. They are updated to the new rule, not removed.
