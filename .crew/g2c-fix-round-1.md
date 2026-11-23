# G2c fix round 1 (2026-11-23)

Source: two independent reviews of `9eda17a..dc0377b` (spec; integration, native and UX). Both: safe for a phone test, no blocker. Test-first: each fix gets a case that fails on dc0377b first.

1. SHOULD-FIX (both reviewers). Back leaves a move preview and a sticky move tooltip on screen (412: tap a move chip in the coach text, press back: `.santip` stays over the Play page and `st.pv` stays set; 1280: the tooltip stays over Home). The X and a tab tap clear both through the capture click handler (app.js ~2880). Start `backPressed` with `hideTip(); if (st.pv) endPreview();` so back does what the X or a tab tap does. Add tooltip and preview state to `outcome()` in g2c.spec.js so `sameAsClose` catches it, and add a case with a sticky tooltip open at 412 and 1280.
2. Tests for section 16 step 3: back with an offer note (it comes back at the next app start, nothing saved) and with an "ask" note (the old game is kept), as Esc does.
3. CI: run the sync as `NO_COLOR=1 npx cap sync android` so the version grep does not depend on the CLI's colour detection.
4. Keep: if `backPressed` throws, minimize (back's old behaviour; a game is saved on every move). Add a test for it. Write it in tech section 16 as a technical choice, with: if `addListener` fails on a phone, back does nothing (the plugin swallows it); only the phone test can show this.

Not in this round (logged): back pressed before app.js has loaded is swallowed; Android 11 and older now minimize instead of finishing on Home; predictive back animation never plays (plugin callback always on).

Gates, one at a time: unit; g2c at 360, 412, 1280; g2 at 412; f3b at 412. Fresh build, ads switch check. Commit with explicit paths, this file included. No push.
