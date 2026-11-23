# Board screens, slice G2: phone layout (tech spec)

Pairs with `board-screens.product.md` (G-D1 to G-D12, G-D17; scenarios 1 to 8, 13, 14; criteria 1 to 7). Draft v1, design-only pass. No production code was changed.
Grounded in the code at `main` b752057 (G1 merged). Line numbers are `src/js/app.js` unless a file is named.
"Phone" below means the one-column layout (up to 860px wide). "Wide" means board left, panel right (`wide()`, :757).

## 1. Current state (read from code)

### State
- `st` (:34 to :39) has no idea of "a screen". `st.tab` is the selected tab. `st.mode` says what the board shows: `play` (the default, always backed by the one game `G`), `review`, `lesson`, `puzzle`, `quiz`, `squares`, `reach`, `drill`, `book`, `placement` (`viewGame()` :392).
- The game never goes away. `G` plus `snapshot()` (:2288) is saved on every move (:1093, :1120, :1127), take back (:1157), flip (:2490), new game (:1172), game end (:1235). `gameOn()` (:2166) = at least one move and not over.
- One other activity can be live at a time: `st.ls` (lesson), or `st.ses` with `st.pz` / `st.qz` / `st.sq` / `st.rc` / `st.dr` / `st.bk` (sets and drills), or `st.rv` (review). Every start calls `clearSession()` (:1285) first: `startLesson` :1633, `startSession` :1321, `enterReview` :1257, `newGame` :1163.
- Zones: `zoneOf()` (:576) maps the mode to `learn | train | play`; `ZTAB` (:575) maps a zone to its tab. `renderZones()` (:588) puts a live dot on that tab and, on the other two, a `znote` ("The board is on Lesson: X." with "Continue Learn" / "Stop, back to my game", :597 to :599).
- Leaving: `exitMode(toGame)` (:1286) always ends the lesson, set or review (`clearSession`), then goes to Home (`'home'`), Play (`true`) or the activity's tab. `#modeExit` (:2493) is "Train instead" in a game, "Back to my game" / "Close review" otherwise (:610, :627).
- End cards: game result in `#gameEnd` under the board, full only on Play (`endFull`, :994 to :1018; one line elsewhere, F-D24 :1003); review finished in `#reviewEnd` (:1031); set end inside `#sessionCard` (`sesEnded()` :1054); Learn part end in `#learnEnd` with `st.end = { unit }` and the mode already back on `play` (:1646, :1672).
- Beginner Home: `syncHomeMode()` (:2170) sets `html[data-bhome]`; CSS hides `.boardcol` up to 860px (`src/head.html`:634) and on short screens (:661 to :664). State is untouched.

### Layout
- `.app` is a two-column grid; one column up to 860px (`src/head.html`:47, :48). `.boardcol` (`src/body.html`:9) holds the mode bar, both player rows, the board, the coach strip, `#gameEnd`, the three control rows and `#reviewEnd`. `.side` (:55) holds the tab bar and the five panels.
- The tab bar is fixed to the bottom only up to 600px (`src/head.html`:622 to :626). From 601 to 860px it sits inline at the top of `.side`, under the board.
- In-game content is in `#panel-play`: `#goalCard`, `#coach`, `#oppCard` ("Why the engine played"), `#thinkCard`, `#movesCard`, `#newCard` (`src/body.html`:85 to :117). A lesson's step card is drawn into `#unitView` in `#panel-path` (:1683). `#sessionCard` is moved into the panel of its zone on every render (:1302).
- The level check already moves `#board` into its own full-screen sheet and back (`PL_HOST.mountBoard` :1892, `endBoard` :1904).

### App start, back button
- `start()` (:2574) restores the saved game, then `switchTab(stored tab)` unless the stored tab is Learn (:2585). So a player who left on Play starts on Play, inside the game. The key is `suresh-chess-coach.tab`, written on every tab change (:2281).
- There is no back-button code. `package.json` has only `@capacitor/core`, `@capacitor/android` and the AdMob plugin. Capacitor 8's `BridgeActivity`, `Bridge` and `CapacitorWebView` have no back handling (read from the 8.x source); only the separate `@capacitor/app` plugin registers one. Today the hardware back button leaves the app.

## 2. New model (answers to question 1)

### One new state field
- `st.scr`: `'tabs'` (a tab page) or `'act'` (the activity screen). Kept in memory only, never stored, set the same way at every width. Wide screens ignore it.
- Derived, in one place:
  - `actOpen()` = `!wide() && st.scr === 'act'`
  - `endUp()` = `!!(endFull || reviewDone() || sesEnded() || st.end)` (an end card is on screen; all four exist today)
  - tabs hidden = `actOpen() && !endUp()`
- `syncScreen()` (next to `syncHomeMode()`, called from `switchTab()` and `render()`) writes `html[data-act]` and `html[data-actend]`. It also holds the safety rule: `st.scr === 'act'` is only kept while `st.tab === ZTAB[zoneOf()]` or `st.end` is set; otherwise it falls back to `'tabs'`. This makes a dead end (activity screen with nothing on it) impossible, whatever path changed the tab.
- `st.mode`, `st.tab`, `zoneOf`, `ZTAB`, `endFull`, `st.end`, `syncHomeMode` keep their meaning. `st.tab` is always the activity's own tab while the screen is open (every start already calls `switchTab` to it: :1172, :1262, :1323, :1635).

### What changes, item by item
| Item | Phones | Wide |
|---|---|---|
| `st.tab` | Same meaning. Start rule changes (section 6) | Unchanged |
| `st.mode`, `st.ses`, `st.ls` | G2a: unchanged (one live lesson or set, plus the game). G2b: a closed lesson or set is parked (below) | Unchanged |
| `zoneOf`, `ZTAB` | Unchanged. Close uses them for the landing tab (G-D4) | Unchanged |
| `znote` notes, tab live dot | Never shown (a tab page has no board to point at). Resume cards replace them | Unchanged |
| `#modebar`, `#modeExit` | Hidden. The Close bar replaces them | Unchanged |
| `exitMode` | `'home'` and `true` also set `st.scr`. G2b: "back to my game" parks the lesson or set instead of ending it (changes D50 on phones, see questions) | Unchanged |
| `endFull`, `st.end`, `sesEnded`, `reviewDone` | Unchanged; they feed `endUp()` | Unchanged |
| `syncHomeMode`, `data-bhome` | Kept. Up to 860px it is now covered by the general rule; it still serves the short-screen rule (`src/head.html`:661) | Unchanged |
| `.boardcol`, `.side` | CSS only: shown or hidden by `data-act` (section 3). No element moves | Unchanged |
| `inActivity()` (:2094), `hintMain()` (:482) | Read `actOpen()` instead of `st.tab` guesses | Unchanged |

### Transitions
| Event | `st.scr` | `st.tab` | What else |
|---|---|---|---|
| Start new game (Play, Home "Play now", lesson game) | act | play | `newGame()` as today. D49 question and the "Tap again to abandon it" note unchanged |
| Resume game (card on Play or Home) | act | play | No state change in G2a if the game is the live mode; otherwise as "Back to my game" today. G2b: parks a live lesson or set first |
| Open lesson, or a lesson part | act | path | `startLesson` / `startSession` as today |
| Start puzzle set or drill from Train | act | train | `startSession` / `startDrill` as today |
| Resume lesson, Resume puzzles | act | path / train | G2a: only the screen opens (the lesson or set never left memory). G2b: restores the parked one |
| Open review (Review button, a move in the list, a past game) | act | play | `enterReview` as today |
| Close (X) | tabs | `ZTAB[zoneOf()]` | Game: nothing to do, it is saved on every move. Lesson or set: kept (G2a live, G2b parked). Review of a past game: ends. Review of the live game: see questions |
| Phone back button | as Close | as Close | Same function as Close. With a sheet or a note from Rani open it closes that first. Not on the activity screen: leaves the app, as today |
| End card appears | act | same | `data-actend` set: tab bar back, tip slot and banner allowed (section 8) |
| End card main button (next step) | act | new activity's tab | The start functions above |
| End card "Home" | tabs | coach | `exitMode('home')` |
| End card "Review this game", "New game", "Go again", "Try again", "Keep playing" | act | same | As today |
| Tab tap (only possible on a tab page or with an end card up) | tabs | tapped tab | From an end card: the finished set, `st.end` or the finished review is dropped (it is over). A finished game stays as `G` and shows no Resume card |
| App restart | tabs | section 6 | Game restored from storage. G2a: no lesson or set. Never restarts on the activity screen |
| Window turns wide, or back | unchanged | unchanged | The resize handler (:790) already re-renders; `syncScreen()` joins it |

### Parking (G2b, scenario 14)
As built: see section 15. It departs from the draft below in one point: a parked entry is plain data (the same entry that is saved), not the live fields.
- `st.park = { learn: null, train: null }`. A parked entry is the fields `clearSession()` wipes plus the shared ones the level check already saves in `st.plPrev` (:1898): `mode, ses, ls, pz, qz, sq, rc, dr, bk, flipped, arrows, hls, flash, hintLvl`.
- Park when the game or another activity is opened over a live lesson or set. Restore on Resume.
- Risk and rule: about eight timers and engine callbacks in the set code check identity (`st.pz !== pz`, `st.ses === s`, `st.dr === D`, `st.bk !== B`: :1385, :1512, :1543, :1548, :1568, :1602) and give up when the reference is gone. A set parked in the middle of a wait would come back frozen. So Resume re-deals the current item: lesson shows step `i` again; puzzle, quiz, square, reach and book items restart item `i` with the score and the "already counted" flag kept; an endgame drill keeps its position and asks the engine again if it is the engine's turn (as `resumeGame()` :2317 does for the game).

## 3. Layout on phones (question 2)

### Approach: two root attributes, CSS only, nothing moves
- All rules sit inside `@media (max-width: 860px)`, the same query as D38 (`src/head.html`:634), so wide screens cannot be touched by them.
- Tab pages: `html:not([data-act]) .boardcol { display: none }`. In `#panel-play` the in-game cards (`#goalCard`, `#coach`, `#oppCard`, `#thinkCard`, `#movesCard`, `#znote-*`) are hidden; `#sessionCard` and a lesson's `#unitView` step card are hidden on Learn and Train.
- Activity screen: `html[data-act]` shows `.boardcol`, hides `header`, hides `.tabs` unless `html[data-actend]`, and inside the one visible panel hides everything that is a menu: `#newCard`, the new Resume and Recent games cards, `#levels`, the unit card, Train's four start cards.
- So the in-game Play content stays where it is, in `#panel-play`, and simply follows the board in the one column, as it does today. Same for a lesson's step card (`#unitView`) and a set's `#sessionCard`. No DOM order change at any width.
- Play as a start page (G-D6): two new elements in `#panel-play`, phone-only by CSS: `#resumeGame` and `#recentPlay` (heading "Recent games", the first three of `prof.games`, the same row markup and `data-review` handler as Progress, :2259 and :2533). `.panel` is a flex column (`src/head.html`:145), so the order Resume, New game, Recent games is set with CSS `order`; the DOM order that wide screens show does not change.
- Home (G-D5, G-D7): `#resumeGame` markup is also drawn under `#contCard`. Resume lesson sits first in `#panel-path`, Resume puzzles first in `#panel-train`.

### Close bar
- New element `#actBar`, first child of `.wrap`, shown only with `data-act` on phones: a 44px Close button (X, `aria-label="Close"`), then the activity's name and place. The text comes from `renderMode()` (:602), which already builds it: "Your game vs ...", "Puzzle 3 of 10" (`zoneLabel()` :584), "Lesson · step 2 of 5" (:1684), "Move 12" for a review (:618).
- `position: sticky; top: 0` so Close stays reachable when the player scrolls down to Moves. `#modebar` is hidden on phones while it shows.
- The header (title, engine pill, settings gear) is hidden during an activity. This gives back about 40px, and hiding the tabs another 56px. Settings is reached by closing first (see questions).

### Scrolling
- The activity screen is the normal page, not a fixed overlay. `revealEnd()` (:1042), `revealStrip()` (:1798), the ad padding box and the 3D sizing all rely on window scroll.
- Open: remember the tab page's `scrollY`, then scroll to the top. Close: restore it.

### Safe areas, Android 16 edge to edge
- The two `.wrap` `padding-block` rules keep their top inset; `tests/insets.test.js` stays green. Trap (lesson L24): any new `.wrap` rule that sets `padding-block` or `padding` must carry `env(safe-area-inset-top)`. Use `padding-bottom` for the bottom.
- The sticky bar must not slide under the status bar: it carries its own `env(safe-area-inset-top)` and a solid background. Add a unit test in `tests/insets.test.js` for the `#actBar` rule.
- With the tabs hidden, `.wrap` bottom padding drops to `28px + env(safe-area-inset-bottom)` and Rani's note (`src/head.html`:626) drops with it. Both return with an end card.
- Needs a phone test (as F3b did): the bar under the clock, the gesture bar under the last button.

### Landscape and small tablets
- A phone held sideways that is wider than 860px (915x412) is "wide" today and stays unchanged (G-D10).
- G2d replaces the next rule: see section 14 (board left, column right).
- A sideways phone up to 860px wide (780x360, 667x375) is one column, so G2 applies. Tab pages gain the most (no board). On the activity screen the board would be wider than the screen is tall, as it is today (a logged follow-up). G2a adds one rule: on screens under 500px high the board row is capped to the screen height minus the Close bar and centred, so the whole board is visible and the cards scroll under it. Board left, cards right is out of scope.
- 601 to 860px: the tab bar is inline, so when an end card brings it back the panel under the board shifts down by the bar's height. Accepted for G2; noted as a follow-up.

### Focus and screen readers
- Open: focus moves to the bar's text (`tabindex="-1"`), so a screen reader reads the activity's name and place. Close is the control just before it.
- Close: focus moves to the Resume card's button on the landing tab, or to the selected tab when there is no card. The card's own heading ("Resume game") is what is read. No new spoken text is needed.
- Hidden tabs are `display: none`, so they leave the tab order. `focusTab()` (:1887) already skips a hidden tab.
- End cards keep `cardShown()` (:982): read once, heading focused. Esc is unchanged.

## 4. The 3D board (question 3)

- Approach: hide and show `.boardcol` with CSS. Never call `Board3D.disable()`, never remove the canvas, never rebuild.
- Why this works today (read from `src/js/board3d.js`): rendering is on demand (`kick()` :597). With the host hidden `fit()` returns false at zero width (:431) and the loop stops without drawing (:600). `sync()` still records the newest position (:621). A `ResizeObserver` on the host (:369) kicks a redraw when it gets a size again. `build()` runs once (:614).
- D38 already does exactly this: a Beginner with the 3D view on starts on Home with the board column hidden, and the board draws when they tap Play.
- Evidence (probe, headless Chromium, 412x915, 3D on, five hide and show rounds): the same canvas element, the WebGL context never lost, zero `webglcontextlost` events, a position changed while hidden was drawn on show, about 25ms to the second frame after showing, no console errors.
- To hit "within one frame" (criterion 2): `syncScreen()` calls `Board3D.resize()` (:630) right after it flips the attribute, so the first painted frame is already the right position, not the old one.
- Risk: `board3d.js` has no `webglcontextlost` handler. Android WebView can drop the context of a canvas that stays hidden for a long time or under memory pressure. G2 hides the board far more than D38 did. Add a small handler in G2a: on loss, keep the page alive; on restore, rebuild the environment map and redraw; if that fails, fall back to the flat board (`set3d(false, true)`, the path at :530). Testable in Chromium with the `WEBGL_lose_context` extension. Not verified on a real phone.
- The flat board is plain DOM and has no such risk.

## 5. Persistence (question 4)

| Activity | Survives an app restart today | Evidence |
|---|---|---|
| Game | Yes, to the last move, including whose turn it is. If the engine was thinking it thinks again | :1093, :1120, :2305, :2317 |
| Lesson (Learn part) | No. `st.ls` (lesson and step) is memory only. Progress is written only when the last step is finished | :1634, :1646 |
| Puzzle set, Safe or blunder, drills | No. `st.ses` (place, score, the items) is memory only. Each puzzle's result and the rating are saved the moment it is answered | :1322, :1462, :1493 |
| Review | No (`st.rv`). A past game can be opened again from the list | :1261 |

- What G2 can promise with no new storage:
  - "Resume game": always, across restarts (scenarios 4, 5, 13).
  - "Resume lesson" and "Resume puzzles": until the app is closed or Android clears it from memory. After that the card is simply not there; the lesson starts at step 1 again and a new set starts at 1 of 10. No puzzle result and no rating change is ever lost. A stale card can never show, because the card is drawn from memory.
  - The product spec already accepts this fallback in its assumption register. It must be said plainly, because Android often clears a background app within minutes.
- Built in G2b (G-D19), see section 15 for the exact shape. The draft estimate was: one new local key, `suresh-chess-coach.resume.v1`, outside `prof`. So no profile shape change and no `migrate()` step; it is local to the device, like the tab key. Lesson: `{ unit, i }`, about 15 lines. Set: `{ kind, title, unit, part, i, right, wrong, item ids, counted }`, rebuilt through the same "re-deal item i" path as parking; `opts.pick` is a function (:2235) and is rebuilt from the kind. About 80 lines plus tests. Complexity 2 on top of G2b. Not synced to the cloud.
- If it were put in `prof` instead: `Profile.V` 5 to 6 (`src/js/profile.js`:7), a `migrate()` default, a `merge()` rule (newest wins), fixtures in `tests/profile.test.js`. Not recommended: it is device state, not progress.

## 6. App start (question 5)

- Today: stored tab restored unless it is Learn (:2585).
- New, phones only (read `wide()` once in `start()`): a stored `play` is treated like `path` and opens Home. `st.scr` starts as `'tabs'` and is never stored. Home then shows the Resume game card (scenario 5). `resumeGame()` still runs, so an engine reply that was pending is played in the background and the card's line is correct.
- The key `suresh-chess-coach.tab` keeps its name and its writer. No new key.
- Wide screens: unchanged (a wide player still starts on Play in the game; every 1280 test that seeds the Play tab keeps passing).
- A game that had already ended before the restart: on phones its result card is not shown again (there is no screen for it). It is in Recent games. Wide: as today.
- Whether Train and Progress should still be restored on phones is a question below.

## 7. Back button (question 6)

- Android: it cannot be done with no native code at all, because nothing in Capacitor's core listens for back. Two ways:
  - A (recommended): add the official `@capacitor/app` plugin, pinned to an exact 8.x version (MIT, no Google library, no permission, no network). JS: `Capacitor.Plugins.App.addListener('backButton', ...)` calls one function `backPressed()`. If it returns false, `App.minimizeApp()`, which is what back does today. Without the listener the plugin would swallow back on tab pages, so the listener is required.
  - B: no plugin; a CI script patches the generated `MainActivity` (as `scripts/android-ads.sh` patches the manifest). More fragile, and Android 16's predictive back makes it easy to get wrong.
- `backPressed()`: activity screen open, close it (same code as the X); Settings sheet open, close it; a question from Rani open, the same as Esc; otherwise false.
- Web build: the History API. Opening the activity screen pushes one entry; `popstate` calls `backPressed()`; Close by the X steps the history back so entries never pile up. Wrapped in try and catch and skipped inside an iframe (a claude.ai artifact), where history is not ours to use.
- It is its own slice (G2c) because it is the only native change and cannot be proven in Chromium.

## 8. Tip slot and ads (question 7)

### The change
```
boardBusy()  = mode is lesson or review, or a set not ended, or gameOn()        (today's activityOn without the level check)
activityOn() = Placement.isOpen() || (wide() ? boardBusy() : actOpen() && !endUp())
slotAllowed(place, visit):
  first-day rule as today
  home, progress:  !activityOn()
  end cards:       wide() ? !gameOn() : true
```
- `adBoard()` (:835) does not change at all. It already asks "is `.boardcol` drawn on Home". On phones Home no longer draws it, so G-D12 (banner on Home for every level) follows with no new rule, and A-D19 still holds by the same test.
- `adFacts()` (:836) keeps its shape: `slot` from `slotAllowed`, `activity` from `activityOn`, `board` from `adBoard`. `stripPlace()` (:773) is unchanged. `ADS.mayShow` in `src/js/ads.js` is unchanged.
- "One function decides both" holds: `slotAllowed` is still the only gate for the tip, and the banner still needs it to say yes first.
- Criterion 7 asks for a unit test of the rule in one function. Today the rule lives inside the app closure and cannot be tested in Node. Move the two expressions into the pure module as `Flow.inUse({ wide, open, end, busy, check })` and `Flow.slotOk({ place, day, inUse, wide, gameOn })`; `app.js` only feeds them. Tests go in `tests/flow.test.js`.
- A fresh game with no move, open on the activity screen, hides both (`actOpen() && !endUp()` is true). This is A-D19's point, kept.
- Unchanged: the first-day rule, the 1 second rule (`adSync` restarts its clock whenever the banner becomes allowed, :881 to :887, so landing on Home after Close waits a full second), sheets and notes (A-D12), no banner under 500px high (A-D4), the review-finished card has no slot (F-D17, last sentence).

### Rules replaced on phones
| Rule | Today | Phones from G2 | Wide |
|---|---|---|---|
| F-D17 (strict part) | No slot on Home or Progress while a game is unfinished or any activity is open | No slot only while the activity screen is open. A closed, saved game or lesson does not count | Kept as today |
| F-D32 | An end card has no slot while a game is unfinished | The slot shows on every end card (after day one) | Kept as today |
| A-D3 | The banner follows F-D17 and F-D32 | Follows the two lines above | Kept as today |
| A-D19 | No banner on Home while the board is on screen | Holds, and is now always satisfied on Home | Kept as today |
| F-D24 | One-line result off the Play tab | Cannot occur (no board off the activity screen) | Kept |
| D-4 (:2094) | A late offer from Rani waits for Home or the activity's end | Waits while the activity screen is open without an end card | Kept |
| D50 | "Back to my game" ends an open lesson or set | G2b: keeps it for Resume | Kept |
- Wide screens keep the strict rule. This is not a new product choice: G-D11 says "never share a screen with a board in use", and on a wide screen the board is always on screen. It is also what criterion 6 needs (f1 and f3b at 1280 assert the strict rule).

## 9. Tests (question 8)

### Existing suites at phone sizes
Counts are estimates from reading and pattern matching. The suites were not run.
| Suite | Cases | Need a change at 360 / 412 | Why |
|---|---|---|---|
| `f1.spec.js` | 41 | about 28 (about 10 by hand) | 21 cases seed the Play tab and expect to start in the game; end cards after a restart; `#modeExit` clicks (4); the strict slot rule; "Back to my game" on Home |
| `s2a.spec.js` | 47 | about 19 (mostly one helper) | 18 seed the Play tab; tab taps with the board in view |
| `s2b.spec.js` | 22 | about 8 (about 5 by hand) | D44 and D50 "Back to my game"; D38 board checks become true for every level |
| `f3b.spec.js` | 24 | about 9 (by hand) | A-D19 cases for Improver and Club Home flip on phones; banner hides on "activity start" now means the screen opening |
| `g1.spec.js` | 21 | about 20 (one helper line) | Every case seeds the Play tab with a zero-move game and needs the board |
| `s1.spec.js` | 24 | 2 | The level check owns its own board; only the two cases that land in a lesson or game after it |
- Most changes are one helper per suite: after load at a phone size, `toBoard(page)` taps Play and then "Resume game" (or "Start new game" for a zero-move seed).
- Assertions are moved to the new rule, never deleted (product spec, Risks).

### Criterion 6 (every suite unchanged at 1280)
- Achievable, on one condition: every G2 behaviour is gated on phone layout (CSS media query, or `wide()` at the moment of use), including the start tab, the Resume and Recent games cards, parking and the slot rule. The design above does that.
- Two cases resize inside the 1280 run and need a look, not a rewrite: `f1` slot strip case (:1249 to :1254, 1280 to 500x900 with a Learn end card: passes under this design, because `st.scr` is tracked at every width) and `f3b` MOVE / A-D16 (:659 to :672, Progress at 1280 to 412: passes, Progress has no board).
- `s2b` S2b-14 and the `s1` landscape case run only in the phone or sideways process.

### New suite `tests/e2e/g2.spec.js` (360x800, 412x915, 1280x900; one case at 780x360)
| # | Case | Scenario | Criterion |
|---|---|---|---|
| 1 | Each of the five tabs, three levels, no activity: `.boardcol` not rendered; tab bar visible | 1, 2 | 1 |
| 2 | Club Home: Continue card first, cards in F-D8 order, no board; first-day and day-two tip and banner | 2 | 1, 7 |
| 3 | Play, "Start new game": board on screen, tab bar and header gone, Close top left, bar text; measured in the same frame as the tap | 3 | 2 |
| 4 | Play 12 moves, Close: Play tab at once, card "Resume game" / "Move 12, your turn", same card on Home under Continue; tap brings the same position | 4 | 2, 3, 4 |
| 5 | Reload in mid-game: opens on Home with the card, not the board; stored tab `play` ignored on phones | 5 | 4 |
| 6 | Reload while the engine was to move: no move lost, engine replies, card line right | 13 | 3, 4 |
| 7 | Lesson from Learn to its last step: end card under the board, tab bar back, slot rules; main button starts the next part | 6 | 5 |
| 8 | Every end card row of F1 on the activity screen: titles, main and small buttons unchanged; tab bar visible each time | 6 | 5 |
| 9 | Puzzle set, back (history back on the web build): set closes, "Resume puzzles" first on Train, resume shows the same puzzle number and score | 7 | 2, 3 |
| 10 | Close during each wait (puzzle reply, auto-advance, drill engine move): resume is never frozen | 7 | 3 |
| 11 | Game and lesson both unfinished: Play shows "Resume game", Learn shows "Resume lesson"; opening one keeps the other (G2b) | 14 | 3, 4 |
| 12 | Game finished: no Resume card on Play or Home; "Recent games" shows at most three; tap opens the review | 4 | 4 |
| 13 | 1280x900: board left, panel right, no Close bar, no Resume or Recent cards, znotes and "Train instead" as today, starts on the stored Play tab | 8 | 6 |
| 14 | Tip and banner: hidden for the whole time the activity screen is open (fresh board included); shown on Home, Progress and end cards with a saved closed game; banner waits 1 second after Close | 2, 4 | 7 |
| 15 | 3D on: canvas element and context identical across 10 open and close rounds; position right in the first frame; forced context loss recovers or falls back to flat | 3, 4 | 2 |
| 16 | Focus: bar text on open, Resume button on close, never the page body; keyboard reaches Close; Close is 44px | 3, 4 | 2 |
| 17 | 780x360: tab pages have no board; on the activity screen the whole board fits the height | 1, 3 | 1 |
| 18 | Resize 412 to 1280 and back with the screen open, closed and on an end card: nothing lost, no dead end | 8 | 6 |
| 19 | No console errors, no outside request, no em dash in any new string | all | 13 |
- Unit: `tests/flow.test.js` (the `inUse` and `slotOk` tables for phone and wide, the resume line, the start-tab rule), `tests/insets.test.js` (the Close bar rule).

## 10. Slices (question 9)

| # | Slice | Complexity | Files | Ships on its own |
|---|---|---|---|---|
| G2a | Tab pages without the board; the activity screen with the Close bar; tabs back on end cards; Play start page; "Resume game" on Play and Home; "Resume lesson" and "Resume puzzles" (the lesson or set stays live in memory); start on Home; tip and ads rule; 3D context handler; landscape cap; web back | 4 | `src/head.html`, `src/body.html`, `src/js/app.js`, `src/js/flow.js`, `src/js/board3d.js`, `tests/flow.test.js`, `tests/insets.test.js`, all six e2e suites, new `g2.spec.js`, rebuilt `www/` | Yes. Every activity can be opened, closed and resumed. Not yet met: scenario 14 (opening the game still ends a live lesson or set, which is today's D50) |
| G2b | Parking: the game, one lesson and one Train set can all be unfinished at once; Resume re-deals the current item; D50 changes on phones. Optional with a yes: lesson step and set survive a restart (`resume.v1`) | 3 (4 with the optional part) | `src/js/app.js`, `g2.spec.js`, `s2b.spec.js`, `www/` | Yes |
| G2c | Android back button = Close: `@capacitor/app` pinned, the listener, a CI check of the pinned version | 2 | `package.json`, `src/js/app.js`, `.github/workflows/build-apk.yml`, `www/` | Yes. Needs a phone test and a yes for the new library |
- Order is by risk, highest first: G2a carries the layout, the 3D question and nearly all test changes. G2c is small but can only be proven on a phone.
- No half-state: in G2a the board is reachable from Play ("Start new game", "Resume game"), from every lesson and set start, and the safety rule in `syncScreen()` removes any screen with nothing on it.

### Rollout traps
- Merging to main ships to every Obtainium phone. G2a moves everything a player knows. A phone test before merge is in the product readiness table.
- No stored data changes shape in G2a. Old saved games and the old tab key work as they are. Rolling back is safe.
- `www/` is tracked and built by `sh scripts/build.sh`. Each PR rebuilds it; the e2e suites serve `www/`, so a stale build tests the old app.
- The 1280 runs are the guard for G-D10. Run them first after every change.
- G2c adds a native dependency: the Gradle step should fail if the resolved version differs, as the ads libraries do.
- The ads banner is live in test mode. After G2a, Improver and Club phones see the banner on Home for the first time (G-D12). Check it on the phone with the edge-to-edge gesture bar.

## 11. Technical choices made here
- One field (`st.scr`) plus derived functions, rather than a new mode. The board's mode stays the single truth for what is on the board.
- CSS attributes on the root, in the D38 pattern. No element is moved, so wide screens are untouched by construction.
- The activity screen is the scrolling page, not a fixed overlay.
- The Close bar is sticky. The header is hidden during an activity.
- The slot rule moves into `flow.js` so it can be unit tested (criterion 7).
- The tab bar follows the end card exactly: in a finished review, stepping back from the last move hides it again.
- Leaving an end card by a tab tap drops the finished set or Learn end card on phones.
- A finished game is not shown again after a restart on phones.
- Resume re-deals the current item instead of trying to thaw timers.
- No live dot on tabs on phones; the Resume cards carry that job.
- Wide screens keep F-D17 and F-D32 as they are.

## 12. Questions for the user
1. Android back button. It needs native code; the product spec's readiness table says "no new libraries".
   - A: add the official `@capacitor/app` plugin, pinned (recommended). B: patch the generated Android project in CI. C: leave Android back as today in G2 (it leaves the app; the game is saved).
2. Lesson and puzzle set after a restart. Today neither survives.
   - A: accept "until the app is closed" (already in the spec's assumptions). B: also save the lesson step and the set's place on the device, in G2b (recommended: Android clears background apps often, and the cost is small). Not synced to other devices either way.
3. Can a lesson and a Train set both be waiting, as well as the game?
   - A: yes, one per tab (recommended; it matches "opening one does not end the other"). B: only one besides the game; starting another replaces it without asking.
4. Home with a game going. Today Beginner Home's second button, and the Continue card when its step is "beat the engine", read "Back to my game". G-D5 adds a "Resume game" card under Continue; G-D7 says Beginner Home is unchanged.
   - A: Improver and Club get the card; Beginner Home keeps its button and gets no card (recommended; it keeps Continue on the first screen). B: every Home gets the card and "Back to my game" goes away. C: A, and the old button text becomes "Resume game" everywhere.
   - Also confirm: on phones this button no longer ends an open lesson or set (D50); it keeps it for Resume.
5. Wording gaps on the Resume cards.
   - The approved line is "Move 12, your turn". While the engine is still to move: "Move 12, their turn" (recommended), or hide the second half.
   - Lesson card line: the lesson's title and "Step 2 of 5". Puzzle card line: the set's title and "3 of 10". Both reuse text the app already shows. OK?
   - A closed "Safe or blunder?" set, opening drill or endgame drill: button "Resume puzzles" for all (A), or "Resume drill" for the two drills (B, recommended, new wording).
6. Closing a review.
   - Opened from inside a game in progress: Close goes back to the game (recommended, as "Back to my game" does today), or to the Play tab.
   - A past game opened from Progress: Close lands on Play, per G-D4 (recommended; Play now has Recent games too), or back on Progress.
7. Settings during an activity. The gear and the engine status are in the header, which the activity screen hides.
   - A: not reachable until Close (recommended, if mockup screen 3 shows only Close and the name). B: a gear at the right end of the Close bar.
8. App start on phones when the player left on Train or Progress.
   - A: always open on Home (recommended: one rule). B: restore Train and Progress as today; only Play and Learn open Home.

## 13. Risks and what could not be determined
- Not seen: the G mockup (screens 1 to 3). The product spec names it without a link. Questions 4 and 7 depend on it.
- Not verified on a phone: that Android keeps the WebGL context of a hidden canvas for long periods; the sticky bar under the status bar on Android 16; the banner on Improver Home with the gesture bar.
- Back handling in Capacitor 8 was read from source (no `node_modules` here), not run.
- Test counts are estimates; the browser suites were not run in this pass.
- Whether a claude.ai artifact frame allows `history.pushState` is unknown; the design skips history inside a frame.
- The engine's reply to a closed game already writes shared fields (`st.arrows`, `st.busy`, :1117) while another activity is on the board. This exists today; parking in G2b must save and restore those fields around it.
- G2a touches about 85 existing e2e cases across six suites. The helper approach keeps the edits small, but this is the largest part of the work and the likeliest source of fix rounds.

## 14. Slice G2d: sideways phone, first-time look, the name (G-D32 to G-D34)

### Sideways board screen (G-D32)
- One media query, `(max-width: 860px) and (max-height: 499.98px)` (under 500px: from 500px a banner is allowed), and every rule under `html[data-scr]`. Upright phones and wide screens match none of it. It replaces the G2a rule that only capped the board row.
- The board (`.boardrow > .board`) is `position: fixed` under the Close bar. Its side is `--bs`: the screen height less the bar (49px here, Close still 44px), 8px above and below and the top and bottom safe areas, and never more than `60vw`.
- `.app` gets `padding-left: var(--bs) + 12px`. So the rest of `.boardcol` (opponent line, eval strip, coach strip, the You line with the piece name line, `#gameEnd`, the buttons, `#reviewEnd`) and then `.side` (the tabs when an end card is up, Rani's card, the moves, a lesson's step card, `#sessionCard`, `#learnEnd`) form one column on the right, in DOM order. Nothing moves in the DOM.
- The column is the page: it scrolls under the sticky bar and the board stays put. So `revealEnd()`, `boardUp()` and the open and close scroll keep working. `boardRoom(el)` in `app.js` is the one change: with a pinned board the scroll limit is the card's own top (it stays under the bar), not the board's top.
- `.app` stays a one-column grid, because `wide()` reads its column count. `.boardcol` keeps its box, because `adBoard()` reads it.
- The eval bar becomes the thin level strip an upright phone has, at the top of the column.
- Up to 600px wide the fixed tab bar that an end card brings back spans the column only, so it never covers the board. From 601px it is inline in the column, as before.
- 3D: the canvas host is inside `#board`. Its `ResizeObserver` and the window `resize` handler call `resize()`; nothing is rebuilt. The e2e case turns the screen both ways and checks the same canvas element, a live context and a drawing buffer of the board's size.
- 915x412 is the wide layout and is untouched. There the board is 578px on a 412px screen, as before G2 (a follow-up, not this slice).

### First-time look (G-D33)
- `Flow.firstLook({ pieces, theme, v3d }, has)` is the one rule, used once in `start()`: the set saved on this device, else the set the profile carries, else `classic`; 3D only when the saved view is exactly `true`.
- No profile shape change and no `migrate()` step. `prof.theme` stays `null` until the player picks a set.
- Read from the code at 415dd04: a truly empty install already started with classic and flat. A themed set could only come from a saved choice: the device key, or `prof.theme` restored from the cloud save (`afterMerge`). The one change in behaviour is that a profile's set now also applies when the device key is missing.

### The name (G-D34)
- `src/body.html` h1 and `src/head.html` title read "Chess Coach". Storage keys, the app id and code comments are unchanged.

## 15. Slice G2b: one thing waits per tab, saved on the device (G-D19, G-D20, G-D26)

### Decisions taken (orchestrator, 2026-11-22)
- One waiting item per tab: the game on Play, a lesson or a drill started from Learn on Learn, a set or drill on Train. The newest wins on its own tab, with no question.
- Saved items never expire by time. They go when finished, replaced, ended, or no longer valid.
- Parking is for phones only. Wide screens keep D50: opening the game ends an open lesson or set. (Replaced by G-D35 in fix round 1: parking is at every width, see below.)
- The saved key is read and written at every width. A phone turned upright again shows its cards.
- A level change (Settings, the level check, a sign-in merge) drops a saved entry the player can no longer open. Today that is a set on Train while Train is locked for a Beginner.

### Model
- On the board, as before: at most one lesson, set or drill (`st.ls`, `st.ses`). Close (X) leaves it there (G2a).
- New: `st.park = { learn, train }`. When the game, a review, or another tab's activity takes the board, the one on the board is parked: turned into one plain entry (`liveEntry()`), and the board is cleared. `stow(to)` is the one place; the rule is `Flow.onOpen` (park, end or none).
- Resume of a parked entry (`restoreEntry`) deals the current item again: a lesson shows its step; a puzzle, question, square, piece or opening line starts that item again; an endgame drill keeps its position and asks the engine again when it is its move. Nothing is thawed.
- A restart and a parked item use the same entry and the same restore path. At app start `loadResume()` fills `st.park` from the key.
- Resume cards, Home's Continue card and Today's Learn step all read `waitOn(zone)`: the entry of what is on the board, else the parked one.

### The saved key
- `suresh-chess-coach.resume.v1`, local storage, outside `prof`: no profile shape change, no `migrate()`, never synced.
- Shape: `{ v: 1, learn: entry | null, train: entry | null }`. The key is removed when both are null.
- Lesson entry: `{ k: 'lesson', unit, i }`.
- Set entry: `{ k: 'set', kind, title, unit, part, count, pass, rated, theme, review, i, right, wrong, counted, items }`, plus `drill: { fen, moves }` for an endgame drill.
  - `kind`: `puzzles`, `safety`, `squares`, `reach`, `book`, `drill`.
  - `items`: puzzle ids (dealt so far for a rated set, all of them for a fixed set), `[id, 0 | 1]` pairs for Safe or blunder, opening line ids, empty for the rest.
  - `counted`: the current item's result is already in the score and the profile (`ses.cnt`), so an item dealt again never counts twice.
- Written by `syncResume()` at the end of every `render()`, only when the text changed. Every step, item and result change is drawn through `render()` in the same step as the change, so a kill right after it finds it saved. Close renders too.
- Cleared (entry null) when the lesson or set is finished, replaced on its tab, ended (D50 on wide, Train locking), or fails the check.
- Fail safe: `Flow.readResume` and `Flow.entryOk` accept only version 1 and only entries whose unit, part kind, step, counts, puzzle ids, opening lines and drill position are all valid now. Anything else is dropped with no error and no card, and the key is rewritten clean. The check runs at start, on a level change and again at the moment of Resume.

### Late replies (risk notes of sections 2 and 13)
- `st.busy` is now a getter over two flags: `st.gb` (the game's move check and engine reply) and `st.ab` (the lesson, set or drill on the board). The game's chain writes `st.gb` only, and draws its arrow only when the game is on the board.
- `clearSession()` raises `boardId` and clears `st.ab`. Late callbacks of a set check that their own object is still on the board (`st.pz !== P`, `st.dr !== D`, `st.bk !== B`) or the `boardId` they started with (Hint), and give up otherwise.
- This applies at every width. It changes no rule on wide screens; it removes a race that was there (a puzzle that stayed locked until the game's engine replied, an engine arrow on a lesson's board).

### Departures from the draft above
- A parked entry is plain data, not the live fields plus `flipped, arrows, hls, flash, hintLvl`. Those are rebuilt by dealing the item again.
- The entry also carries `count, pass, rated, theme, review` and, for a drill, its position, so "Go again" and the end card work after a restart.
- The rules live in `flow.js` (`onOpen`, `entryOf`, `entryOk`, `readResume`, `writeResume`, `resumeCard`, `waitingLesson`) with unit tests; `g2b.spec.js` is its own suite built on `g2.spec.js`'s helpers.

### Fix round 1 (2026-11-23: G-D35 to G-D37 and the review's items 4 to 8)
- G-D35: `Flow.onOpen` no longer reads the width: opening the game, a review or another tab's activity parks a lesson or set on wide screens too (D50 is gone). On wide, Learn and Train show the Resume card of what is parked (not of what is on the board, which sits beside the panel). Tapping a lesson in Learn's list while something is on the wide board parks it too (it ended before). `Flow.drillZone` is the same at every width, so a drill from Train's list waits on Train there too. The wide note's second button read "Stop, resume game"; it no longer stops anything, so it reads "▶ Resume game", as on Play's note.
- G-D36: the saved game (`suresh-chess-coach.v1`, not the profile) gets one field, `unseen`, set when the game ends while it is not on screen (`Flow.endsUnseen`: phones, not the game on the board screen; wide, not the game on the board). Absent in older saves, so an old finished game shows no card. `Flow.endedCard` draws the card on phones only, in Resume game's place on Play, Home and Beginner Home: the title, the end card's own title as the line, "See the end" (`data-act="resume" data-z="play"`, as Resume game) and "Review" (the end card's `data-act="review"`). It goes (`seenEnd`, saved without a new time stamp) when the game's full end card is drawn, when the game's review opens, or with a new game.
- G-D37: `Flow.waitingPart` (was `waitingLesson`) also returns a lesson's practice set or task that waits on Learn, with its kind, so Home's Continue card, Beginner Home's card and Today's Learn step read "Resume lesson", "Resume puzzles" or "Resume drill" and resume it. Today's Train step resumes what waits on Train. At every width (on wide this may be what is on the board).
- Item 4: an entry whose current item is counted comes back finished: a puzzle with its result as the profile recorded it (a miss sets the box to 0, a solve to 1 or more), "Solved!" or the miss with the winning move and Try again; an opening line complete; a square or a piece drill moves on to the next item (its own timer did that, and went with the old board). The quiz of Safe or blunder is dealt again as before (it never counts twice).
- Item 5: `openDrill` resets the hints, arrows and selection.
- Item 6: `entryOk` requires `right + wrong === i + (counted ? 1 : 0)` and no more results than items.
- Item 8: `st.flipped` is a getter over `st.gf` (the game, a review; saved as `flipped`) and `st.af` (everything else); a hint's words on the game's coach line go back to what they were before the first hint when the count is back to 0; `syncResume` marks a write done only when it succeeded.

### Known limits
- The engine's reply to a closed game is saved once it is explained (as before); after a kill in between, the engine thinks again.
- Not verified on a phone: a real system kill of the WebView. The browser cases reload the page, which exercises the same read path.
- A counted Safe or blunder question is dealt again (no result is lost or counted twice; the answer given before is not known).
