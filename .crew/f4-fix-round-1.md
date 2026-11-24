# F4 prep fix round 1 (2026-11-23)

Source: one independent review of `af2fc19..759c2c8` (listing truth, data safety, fonts, images). Verdict: safe to hand to Suresh, no blocker. Fixed by the orchestrator (copy and images only, no app code).

1. Listing and production answers: "Beginners see plain words, not chess notation" was overstated (Foundations lessons name moves like Rd8). Now "Beginners get every move explained in plain words, with no ratings or engine scores." Screenshot 02 now shows the Beginner lesson on the knight (no notation).
2. Production answer: tests run per change before merge, not on every build. Reworded.
3. Tester invite: asks testers to try the level check, a lesson, puzzles with a hint, a game and its review, a piece set and the 3D view, and to send one comment (Google checks engagement).
4. "Could the listing unintentionally appeal to children": one clear answer (No) with the justification text to paste.
5. Icon saved as a 32-bit PNG. "Full strength Stockfish" is now "Stockfish at its strongest setting" (the app ships the lite net).
6. Images: Progress shot scrolled so no line sits under the tab bar; the feature graphic uses the 3D start position (no last-move arrow); the 3D shots wait for the canvas before the settle time.

Kept as is (nits): "free hints" next to "Hint 3 of 3" (3 steps per position, unlimited overall, true); IBM Plex reserved font name (Google's unmodified subsets, common practice).
