// The app draws edge to edge on Android 16, so every rule that sets the page's
// top padding must add the status bar inset, or the title slides under the clock.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

test('every .wrap padding-block rule keeps the top safe-area inset', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'head.html'), 'utf8');
  const rules = css.match(/\.wrap\s*\{[^}]*\}/g) || [];
  const tops = rules.filter(r => /padding-block\s*:|padding-top\s*:|padding\s*:/.test(r));
  assert.ok(tops.length >= 2, 'expected the base rule and the phone rule');
  for (const r of tops) assert.match(r, /env\(safe-area-inset-top\)/, r);
});

// G2a: the sticky Close bar of the board screen sits at the very top of the page, so it carries the status bar inset itself.
test('the Close bar rule keeps the top safe-area inset and has a solid background', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'head.html'), 'utf8');
  const rules = css.match(/\.actbar\s*\{[^}]*\}/g) || [];
  assert.ok(rules.length >= 1, 'expected a .actbar rule');
  const main = rules.find(r => /position\s*:\s*sticky/.test(r));
  assert.ok(main, 'the bar is sticky');
  assert.match(main, /padding(-top)?\s*:[^;]*env\(safe-area-inset-top\)/);
  assert.match(main, /background\s*:\s*var\(--bg\)/);
  assert.match(main, /top\s*:\s*0/);
});

// G2d (G-D32): on a phone held sideways the board is pinned under the Close bar. It is placed against the screen, not the
// page, so it carries the insets itself: the status bar above, the camera cutout on the left, the gesture bar below.
test('the sideways board is pinned clear of the safe areas, and every Close bar padding keeps the top inset', () => {
  const css = fs.readFileSync(path.join(__dirname, '..', 'src', 'head.html'), 'utf8');
  const pinned = (css.match(/\.boardrow > \.board\s*\{[^}]*\}/g) || []);
  const main = pinned.find(r => /position\s*:\s*fixed/.test(r));
  assert.ok(main, 'expected the pinned board rule');
  assert.match(main, /top\s*:[^;]*env\(safe-area-inset-top\)/);
  assert.match(main, /left\s*:[^;]*env\(safe-area-inset-left\)/);
  for (const r of pinned.filter(r => /left\s*:/.test(r))) assert.match(r, /left\s*:[^;]*env\(safe-area-inset-left\)/, r);
  const size = css.match(/--bs\s*:\s*min\([^;]*;/);
  assert.ok(size, 'expected the board size');
  assert.match(size[0], /env\(safe-area-inset-top\)/);
  assert.match(size[0], /env\(safe-area-inset-bottom\)/);
  assert.match(size[0], /60vw/, 'never wider than 60 percent of the screen');
  for (const r of (css.match(/\.actbar\s*\{[^}]*\}/g) || []).filter(r => /padding(-top)?\s*:/.test(r))) assert.match(r, /padding(-top)?\s*:[^;]*env\(safe-area-inset-top\)/, r);
});
