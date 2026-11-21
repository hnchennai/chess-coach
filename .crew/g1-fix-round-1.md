# G1 fix round 1 (from two independent reviews, 2026-11-21)

Branch crew/g-board-screens, HEAD 6da9bdb. Test-first for each item. Same rules as the brief (no push, explicit paths, rebuild www, trailer).

1. Tap on a 3D tag (should-fix, reproduced). Today a tag ignores taps, so a tap on it lands on the piece BEHIND it: tapping a back-rank tag selects the pawn in front; with a pawn selected and the board tilted low, tapping its own tag plays e3. Required: a tap on a tag acts exactly like a tap on its own piece's square (select it / name it). It must never pick another square. Replace the test that locks in the old behaviour (g1.spec.js ~337-352).

2. 3D tag placement (should-fix, reproduced; G-D16). In a crowded middlegame at the default angle the tags float high and cover the emblem of the piece behind (c6 over c7, f6 over f7), stack along a file, and cover the top of their own emblem. See scratchpad/rv/360_mid_default.png and 360_mid_low.png. Required: move the tag to the piece's upper-right shoulder in screen space, like the corner badge in the flat view: still camera-facing, attached to its piece, drawn in front of its own emblem, covering no more than a corner of its own emblem and reaching as little as possible over neighbours. Keep it at least 14px across at 360. Try it in the crowded Italian-game position at the default angle, the lowest and the highest angle, flipped, for Hero League and the Ramayana figures; keep screenshots in the scratchpad. Add a test that measures, in screen space in that crowded position, how much of each neighbour's emblem box a tag covers, and fails above a small limit you justify. Also make the "above/at its own piece" test non-circular: measure the piece's box freshly in the test (a Box3 that excludes the tag), not userData.top.

3. Settings note (user's decision, 2026-11-21). Replace "Every piece keeps a chess symbol in its corner, so you always know what it is. Hover over a piece (or long-press on a phone) to see its character." with exactly: "Every themed piece carries a small chess symbol. Tap a piece to see its name and how it moves." Check s2b's text checks still pass (update a fixture only if it pins this exact sentence, and say so).

4. Name line lifetime (should-fix, reproduced). It stays over the "You" row and the captured pieces until the next tap, and survives "Start new game". Required: it clears on any move by either side, on a new game, on any activity change, and by itself 5 seconds after it appeared (a new tap on a piece restarts the 5 seconds). Tests for each.

5. Nits, do if cheap: avoid fixed sleeps where a wait-for-condition works; the name line element should not be both role=status and aria-live (keep one). Leave Board3D.debug as is.

Report: red-to-green per item, pass counts for g1 at 360/412/1280 and unit, s2b 412 and f1 412, screenshots paths, commit hash, anything not done.
