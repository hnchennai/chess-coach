# G1 fix round 2 (delta re-review of 77a7014, 2026-11-21)

Findings 1, 3, 4 confirmed fixed. Two should-fixes from the new placement. Test-first.

A. The h1 tag hangs off the right edge of the 3D canvas at 360: 34% of it is cut at the opening view, 52% at the highest view (start position and Italian position; see scratchpad/rv/r2_heroes_0_0.6.png and your own 360_crowd-*-default shots). Required: every tag of a piece that is itself on screen is fully inside the canvas at 360, 412 and 1280, at the opening, lowest and highest views, flipped too. For example put the tag on the left shoulder when the right one would leave the canvas, or pull it in. The current test checks only the tag's middle: assert the whole tag box.

B. The occlusion test measures only straight-on views (az 0) and its limits sit just above what was measured. Turned views go over: Ramayana 26% (f6 over f7) at az 0.6 / pol 0.85 and 25% at az -1.2 / pol 1.12; Hero League 23% (g7 over h7) at az -1.2 / pol 1.12. Required: measure at turned views as well (at least az +-0.6 and +-1.2 at two heights). Either improve placement so one honest limit holds everywhere, or keep separate, clearly named limits for "straight-on" and "turned" with the reasoning in a comment; do not just raise one number. Tighten the tag-on-tag limit toward what is measured (9%) with sensible headroom.

Nits if cheap: assert tag size at the views you measure and state the real minimum in a comment (10.4px turned, 12.1px lowest); compute the name line's key per tap rather than a FEN on every render.

Report: red-to-green for A and B, the measured numbers per view and set, pass counts (unit; g1 at 360/412/1280; s2b 412; f3b 412), refreshed screenshot paths, commit hash.
