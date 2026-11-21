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
