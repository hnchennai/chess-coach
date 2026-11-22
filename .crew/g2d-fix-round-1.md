# G2d fix round 1

The independent review found no blocker and no should-fix. Five small items. Suresh answered: keep saved choices (as built), and yes, change the name in CONSTITUTION.md and package.json.

1. Edge at exactly 500px high: the sideways layout (`max-height: 500px`) and the banner rule (`MIN_HEIGHT = 500`, allowed from 500) both apply, so a banner could sit over the pinned board's last rank. Make them disjoint: the sideways layout applies under 500 only (`max-height: 499.98px`), per G-D32 "under 500px". g2d case at 780x500 (upright layout, banner allowed) and 780x499 (sideways, no banner, no room).
2. Rotation sideways to upright with the column scrolled leaves the upright page scrolled with the board off the top. When the board screen crosses from sideways to upright, scroll to the top. g2d case.
3. src/js/app.js line 1 comment: "Chess Coach v4".
4. CONSTITUTION.md and package.json: "Suresh's Chess Coach" becomes "Chess Coach" (wording only, nothing else in the constitution changes). List what still holds the old name.
5. Write this round to .crew/g2d-fix-round-1.md and commit it.

Gates, one at a time: unit; g2d at 568, 780, 844, 412, 1280; g2 at 412; f3b at 412 and 915; fresh build; ads switch check. One commit, explicit paths, no push.
