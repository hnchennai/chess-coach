# Chess Coach Design System

Format follows the DESIGN.md (Google Stitch) layout. Built from the live app. Changes need Suresh's yes.

## 1. Visual theme
Calm study table. Warm wooden board, soft green accents, lots of air. Friendly for beginners, serious enough for club players. Rani, an original queen character, guides the player.

## 2. Colour palette and roles
| Token | Light | Dark | Role |
|---|---|---|---|
| --bg | #ECEFED | #121714 | Page background |
| --surface | #FFFFFF | #1A211E | Cards, sheets, nav bar |
| --ink | #1C2421 | #E4EBE7 | Main text |
| --muted | #5B6662 | #98A49F | Secondary text |
| --line | #D3DAD6 | #2B3531 | Borders, dividers |
| --accent | #1E6B58 | #55C2A2 | Primary buttons, selection, links |
| --accent-soft | #D9EAE4 | #1F3A32 | Tinted panels, chips |
| --sq-light / --sq-dark | #EAD6B2 / #AE7D53 | #D2BD98 / #94673F | Board squares |
| Zone: Learn / Train / Play | blue / purple / green tints | | Which part of the app you are in |
| Move quality | best #17876B, good #4A8A35, inaccuracy #B98A10, mistake #D06A16, blunder #C2352B | | Feedback |

## 3. Typography
- Display: Bodoni Moda 700 (app title, big headings only).
- Body: IBM Plex Sans 400/500/600, 15px base, 16px+ for beginner prompts.
- Mono: IBM Plex Mono for ratings and notation only (hidden for beginners).

## 4. Components
- Buttons: radius 8px. Primary = accent fill. `.big` = 48px tall minimum, full width on phones for the one main action.
- Cards: surface, 1px line border, radius 12px, padding 14 to 16px. Never a card inside a card.
- Coach bubble: Rani avatar (46 to 64px) + speech bubble. One headline + max two short lines.
- Bottom nav: fixed to the bottom on phones, icons + labels, 56px tall, active tab filled with accent.
- Sheets and modals: slide up from the bottom on phones, close with a clear button and Esc.

## 5. Layout and spacing
- Spacing scale: 4, 8, 12, 16, 24, 32.
- Phones: board edge to edge, 16px side padding for everything else, one main action per screen.
- Desktop (860px+): board left (max 600px), coach panel right.

## 6. Depth
Flat cards with 1px borders. One soft shadow only on the board (desktop) and floating sheets.

## 7. Interaction states
Hover darkens border; focus = 3px accent outline; disabled = 45% opacity; loading = Rani "thinking" dots; empty states always say what to do next; errors in plain words with a retry.

## 8. Motion (intensity 3 of 10)
- Piece moves 150 to 200ms ease-out, sheets 220ms, celebrations under 800ms.
- Animate transform and opacity only. Everything stops under `prefers-reduced-motion`.

## 9. Responsive
360px to 1440px. Test at 360, 412 and 1280. Tap targets 44px minimum.

## 10. Accessibility
Text contrast 4.5:1 minimum. Every control reachable by keyboard. Board squares have names for screen readers. Never colour alone for meaning.

## 11. Do and don't
- Do: one clear next step, Rani explains with pictures, praise effort.
- Do: hide numbers and jargon (ratings, eval, notation, engine names) from beginners.
- Don't: stock gradients, emoji spam, walls of text, more than one primary button per screen.
- Don't: copy another app's mascot, layout signature or palette.
