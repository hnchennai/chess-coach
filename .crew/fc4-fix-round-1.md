# FC4 fix round 1

From two independent reviews of df043fd (spec + UX; correctness + data). One blocker (both found it), the rest should-fix or nits.

## Suresh's decisions (2026-11-25), write into the product spec (decisions, Wording, assumption register)
- FC-D32: all FC4 proposed lines are approved as written (board title, Offer draw / Resign / Decline / Save, "Resign this game?" with Resign and Keep playing, the three draw lines, the end card win, loss and draw lines, the history row, the review lines).
- FC-D33: "Name your friend" shows on a row whenever this phone has no nickname for that friend (challenger or acceptor). This widens FC-D28.
- FC-D34: history shows "vs a friend" when there is no nickname.
- FC-D35: a waiting move shows "Not sent yet, 5 hours left" (the usual FC-D26 time-left part after "Not sent yet, "), on the row and the board.
- FC-D36: finished friend games go into game history and the cloud save like engine games (result plus the anonymous friend key, no name). Nicknames and the W-L-D record stay on the phone (FC-D29 unchanged). Note this in tech spec section 9.

## Fixes
1. BLOCKER: on wide screens the friend board leaves "Start new game" (newCard) showing, and newGame's confirm skips friend mode, so one tap wipes an unfinished engine game with no question (constitution: progress never lost). Hide newCard in friend mode as review does, AND make every path that leaves friend mode for another activity (newGame, startLesson, startSession/sets, Progress review, daily, etc.) go through `frLeave()` so `st.fid`, `st.fg` and the bar state are cleared. E2E at 1280 and 412: an engine game with moves paused, open a friend game, leave it by every route (Close, back, tab, Start new game if reachable), and the engine game's moves are intact; same for a lesson's Resume card.
2. Crossed or stale draw offers: while my move is waiting (`pend`), hide Accept and Decline (the server clears the offer when my move lands). If my offer is refused with `draw` because the friend's offer is open, do not show "You can offer a draw again after your next move."; after the sync show "Your friend offers a draw." with Accept and Decline. Clear the bar message whenever the game's `v` changes. Tests for both.
3. Screen readers: when the turn passes to me while the board is open, announce the row line ("Your move, 2 days left") in the board's live region.
4. FC-D35 in `friends.js` stateLine (row and board), with tests.
5. `frActing` per game id, so a running resign/draw call on one game never writes onto another board after a second row is opened; no double send.
6. `frSettle`: count `dayRec().games++` on the local day the game ended (from the game's end time), not on the day it is recorded; run the first settle after the first cloud pull has finished or failed (so a backup-restored phone does not add an extra active day). Tests.
7. Name sheet: do not focus the text field on open (the keyboard covers Save on phones); focus the sheet title or Save, as the Accept sheet does.
8. Remove the dead `fb` / `data-act="fback"` zone-note branch and its handler.
9. Tests: e2e endings abandoned, cap and stalemate at least once through the real server (memstore) where practical.

## Logged, not fixed
- A move made offline before the deadline but delivered after it loses on time (FC-D6/FC-D13 as specified).
