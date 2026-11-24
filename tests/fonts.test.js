// P-D11 (docs/specs/play-listing.product.md): the app's fonts are bundled inside the app instead of loading from Google Fonts,
// so the app looks the same online and offline and makes no request to Google for them.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.join(__dirname, '..');
const WWW = path.join(ROOT, 'www');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const FAMILIES = ['Bodoni Moda', 'IBM Plex Sans', 'IBM Plex Mono', 'Noto Sans Symbols 2'];
const faces = (html) => html.match(/@font-face\s*\{[^}]*\}/g) || [];
const family = (rule) => (/font-family\s*:\s*['"]([^'"]+)['"]/.exec(rule) || [])[1];
const urls = (rule) => [...rule.matchAll(/url\(\s*['"]?([^'")]+)['"]?\s*\)/g)].map((m) => m[1]);

test('neither the source nor the built page loads anything from Google Fonts', () => {
  for (const f of [['src', 'head.html'], ['www', 'index.html']]) {
    const t = read(...f);
    assert.doesNotMatch(t, /fonts\.googleapis/, f.join('/') + ' still names fonts.googleapis');
    assert.doesNotMatch(t, /fonts\.gstatic/, f.join('/') + ' still names fonts.gstatic');
  }
});

test('every font family the CSS uses has local @font-face rules with font-display: swap', () => {
  const rules = faces(read('src', 'head.html'));
  for (const fam of FAMILIES) {
    const own = rules.filter((r) => family(r) === fam);
    assert.ok(own.length > 0, 'no @font-face for ' + fam);
    for (const r of own) assert.match(r, /font-display\s*:\s*swap/, r);
  }
  for (const r of rules) assert.ok(FAMILIES.includes(family(r)), 'unexpected family in ' + r);
});

test('every url() in the @font-face rules is a relative woff2 file that exists under www/', () => {
  const rules = faces(read('src', 'head.html'));
  assert.ok(rules.length > 0, 'no @font-face rules in src/head.html');
  for (const r of rules) {
    const us = urls(r);
    assert.ok(us.length > 0, 'no url() in ' + r);
    for (const u of us) {
      assert.doesNotMatch(u, /^([a-z]+:|\/)/i, 'not a relative URL: ' + u);
      assert.match(u, /\.woff2$/, 'not a woff2 file: ' + u);
      const f = path.join(WWW, u);
      assert.ok(fs.existsSync(f) && fs.statSync(f).size > 0, 'missing file www/' + u);
    }
  }
});

test('the built page carries the same @font-face rules as the source', () => {
  assert.deepStrictEqual(faces(read('www', 'index.html')), faces(read('src', 'head.html')));
});

test('each bundled font family has its SIL Open Font License next to its files', () => {
  const rules = faces(read('src', 'head.html'));
  const dirs = new Set(rules.flatMap(urls).map((u) => path.dirname(u)));
  assert.ok(dirs.size >= FAMILIES.length, 'expected one folder per family');
  for (const d of dirs) {
    const lic = path.join(WWW, d, 'OFL.txt');
    assert.ok(fs.existsSync(lic), 'missing www/' + d + '/OFL.txt');
    assert.match(fs.readFileSync(lic, 'utf8'), /SIL OPEN FONT LICENSE Version 1\.1/i, 'www/' + d + '/OFL.txt is not the OFL 1.1');
  }
});

test('README credits each bundled font with its licence', () => {
  const r = read('README.md');
  for (const fam of FAMILIES) assert.ok(r.includes(fam), 'README does not credit ' + fam);
  assert.match(r, /SIL Open Font License 1\.1/);
});
