// Unit tests for www/js/ads.js: the ad banner's rules (slice F3b, docs/specs/ads.product.md). Pure: no DOM, no plugin.
// Run: node --test tests/ads.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const A = require('../www/js/ads.js');

const REAL = 'ca-app-pub-1437334216467981/6215501975';
const TEST = 'ca-app-pub-3940256099942544/9214589741';
// A second-day player on Home, online, in the Android app, phone upright: the banner may show.
const OK = { slot: true, firstDay: false, activity: false, overlay: false, height: 915, native: true };
const but = (o) => Object.assign({}, OK, o);

test('config: the app ID, both units, and the launch switch is off (A-D8, criterion 10)', () => {
  assert.equal(A.CONFIG.appId, 'ca-app-pub-1437334216467981~3972482016');
  assert.equal(A.CONFIG.unit, REAL);
  assert.equal(A.CONFIG.testUnit, TEST);
  assert.equal(A.CONFIG.live, false, 'the launch switch is off in this slice');
  assert.ok(Object.isFrozen(A.CONFIG), 'the config cannot be changed at run time');
});

test('criterion 10: the switch is one literal line the CI guard can read', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/js/ads.js'), 'utf8');
  assert.equal((src.match(/^\s*live:\s*(true|false)\s*,?\s*(\/\*.*\*\/)?\s*$/gm) || []).length, 1, 'exactly one "live: true|false" line');
  assert.match(src, /^\s*live:\s*false/m);
});

test('criterion 1: the banner may show only when the slot rule allows a slot on this screen', () => {
  assert.equal(A.mayShow(OK), true);
  assert.equal(A.mayShow(but({ slot: false })), false, 'no slot, no banner');
  // nothing else can turn a refused slot into a banner
  [{}, { firstDay: false }, { height: 2000 }, { native: true }].forEach((o) => assert.equal(A.mayShow(but(Object.assign({ slot: false }, o))), false));
});

test('A-D3: none on the first day, none during an activity', () => {
  assert.equal(A.mayShow(but({ firstDay: true })), false);
  assert.equal(A.mayShow(but({ activity: true })), false);
});

test('A-D12: none while a sheet, dialog or offer is open', () => {
  assert.equal(A.mayShow(but({ overlay: true })), false);
});

test('A-D4: none when the screen is shorter than 500px', () => {
  assert.equal(A.mayShow(but({ height: 499 })), false);
  assert.equal(A.mayShow(but({ height: 412 })), false);
  assert.equal(A.mayShow(but({ height: 500 })), true);
  assert.equal(A.mayShow(but({ height: undefined })), false, 'an unknown height fails closed');
});

test('A-D9: none without the native platform (the web version)', () => {
  assert.equal(A.mayShow(but({ native: false })), false);
  assert.equal(A.mayShow(but({ native: undefined })), false);
});

test('mayShow fails closed on a missing or odd state', () => {
  assert.equal(A.mayShow(), false);
  assert.equal(A.mayShow(null), false);
  assert.equal(A.mayShow({}), false);
  assert.equal(A.mayShow({ slot: true, native: true, height: 900 }), false, 'firstDay, activity and overlay must be known (false), not missing');
});

test('criterion 2 / A-D11: the ads start-up may run only from day two, on the native platform, outside an activity', () => {
  const S = { native: true, firstDay: false, level: 'beginner', activity: false, overlay: false };
  assert.equal(A.mayStart(S), true);
  assert.equal(A.mayStart(Object.assign({}, S, { firstDay: true })), false, 'day one: nothing ads-related runs');
  assert.equal(A.mayStart(Object.assign({}, S, { native: false })), false, 'web: nothing runs');
  assert.equal(A.mayStart(Object.assign({}, S, { level: null })), false, 'no level yet (the level check comes first)');
  assert.equal(A.mayStart(Object.assign({}, S, { activity: true })), false, 'A-D7: never during an activity');
  assert.equal(A.mayStart(Object.assign({}, S, { overlay: true })), false);
  assert.equal(A.mayStart(), false);
  assert.equal(A.mayStart({}), false);
});

test('criterion 4: every banner request is non-personalised; the test unit unless live', () => {
  const o = A.bannerOptions({ margin: 56 });
  assert.equal(o.npa, true);
  assert.equal(o.adId, TEST);
  assert.equal(o.isTesting, true);
  assert.equal(o.position, 'BOTTOM_CENTER');
  assert.equal(o.adSize, 'ADAPTIVE_BANNER');
  assert.equal(o.margin, 56);
  assert.equal(A.bannerOptions().margin, 0);
  assert.equal(A.bannerOptions({ margin: -3 }).margin, 0);
  assert.equal(A.bannerOptions({ margin: 56.6 }).margin, 57, 'a whole number of dp');
  assert.notEqual(o.adId, REAL);
});

test('criterion 10: the real unit is used only when the switch is on', () => {
  assert.equal(A.unitFor(false), TEST);
  assert.equal(A.unitFor(true), REAL);
  assert.equal(A.unitFor(undefined), TEST);
  assert.equal(A.unitFor('yes'), TEST, 'only the boolean true turns it on');
  const live = A.bannerOptions({ margin: 0, live: true });
  assert.equal(live.adId, REAL); assert.equal(live.isTesting, false); assert.equal(live.npa, true, 'non-personalised when live too');
});

test('criterion 4: the SDK starts with a PG ceiling and no test-device or child flags', () => {
  const i = A.initOptions();
  assert.equal(i.maxAdContentRating, 'ParentalGuidance');
  assert.deepEqual(Object.keys(i), ['maxAdContentRating']);
});

test('criterion 6 / A-D15: an end card waits 1000ms; Home and Progress do not', () => {
  assert.equal(A.END_DELAY, 1000);
  ['game', 'learn', 'step'].forEach((p) => {
    assert.equal(A.waitLeft(p, 5000, 5000), 1000, p);
    assert.equal(A.waitLeft(p, 5000, 5400), 600);
    assert.equal(A.waitLeft(p, 5000, 5999), 1);
    assert.equal(A.waitLeft(p, 5000, 6000), 0);
    assert.equal(A.waitLeft(p, 5000, 9000), 0);
    assert.equal(A.waitLeft(p, 5000, 4000), 1000, 'a clock that went back never shortens the wait');
    assert.equal(A.waitLeft(p, undefined, 6000), 1000, 'an unknown start waits in full');
  });
  assert.equal(A.waitLeft('home', 5000, 5000), 0);
  assert.equal(A.waitLeft('progress', 5000, 5000), 0);
  assert.equal(A.waitLeft('other', 5000, 5000), 1000, 'an unknown place is treated as an end card');
});

test('criterion 8 / A-D7: the form is needed only when Google says so and has one', () => {
  assert.equal(A.needsForm({ status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false }), true);
  assert.equal(A.needsForm({ status: 'REQUIRED', isConsentFormAvailable: false }), false);
  assert.equal(A.needsForm({ status: 'NOT_REQUIRED', isConsentFormAvailable: true }), false);
  assert.equal(A.needsForm({ status: 'OBTAINED', isConsentFormAvailable: true }), false);
  assert.equal(A.needsForm({ status: 'UNKNOWN' }), false);
  assert.equal(A.needsForm(null), false);
});

test('criterion 8: no ad request until Google says ads can be requested', () => {
  assert.equal(A.canRequest({ canRequestAds: true }), true);
  assert.equal(A.canRequest({ canRequestAds: false }), false);
  assert.equal(A.canRequest({ canRequestAds: 'true' }), false);
  assert.equal(A.canRequest({}), false);
  assert.equal(A.canRequest(null), false);
});

test('criterion 9 / A-D17: "Privacy choices" only when Google reports a choice applies', () => {
  assert.equal(A.hasChoice({ privacyOptionsRequirementStatus: 'REQUIRED' }), true);
  assert.equal(A.hasChoice({ privacyOptionsRequirementStatus: 'NOT_REQUIRED' }), false);
  assert.equal(A.hasChoice({ privacyOptionsRequirementStatus: 'UNKNOWN' }), false);
  assert.equal(A.hasChoice({}), false);
  assert.equal(A.hasChoice(null), false);
});

test('A-D17 and the wording: the two Settings rows, the policy address, no em dashes', () => {
  assert.equal(A.COPY.policy, 'Privacy policy');
  assert.equal(A.COPY.choices, 'Privacy choices');
  assert.equal(A.POLICY_URL, 'https://hnchennai.github.io/privacy.html');
  assert.deepEqual(Object.keys(A.COPY), ['policy', 'choices'], 'no other new copy');
  Object.keys(A.COPY).forEach((k) => assert.ok(!/[–—]/.test(A.COPY[k])));
});

test('A-D16: the banner sits above the fixed tab bar on phones, at the very bottom otherwise', () => {
  assert.equal(A.TAB_BAR, 56);
  assert.equal(A.marginFor(true), 56);
  assert.equal(A.marginFor(false), 0);
});

test('the pure module makes no plugin, DOM or network reference', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/js/ads.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  ['Capacitor', 'document', 'fetch(', 'XMLHttpRequest', 'localStorage', 'console.'].forEach((w) => assert.ok(!src.includes(w), w));
});

// Criterion 14 and the constitution: the licence exception, word for word, and where it is named.
const EXC = 'Additional permission under GNU GPL version 3 section 7: if you modify this program, or any covered work, by linking or combining it with the Google Mobile Ads SDK, the Google User Messaging Platform SDK or the Google Play Billing Library (or modified versions of those libraries), the copyright holder of Chess Coach grants you permission to convey the resulting work. This permission covers the Chess Coach code only. Stockfish is a separate program under plain GPL version 3.';
const LIBS = ['Google Mobile Ads SDK', 'Google User Messaging Platform SDK', 'Google Play Billing Library'];
const read = (f) => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');
const flat = (s) => s.replace(/\s+/g, ' ').trim();

test('criterion 14: LICENSE-EXCEPTION holds the approved wording', () => {
  assert.equal(flat(read('LICENSE-EXCEPTION')), EXC);
});

test('criterion 14: the README names the exception and the three Google libraries', () => {
  const r = read('README.md'), sec = r.slice(r.indexOf('## Licence and source'), r.indexOf('## Credits'));
  assert.ok(sec.includes('`LICENSE-EXCEPTION`'));
  assert.ok(flat(sec).includes(EXC), 'the wording is in the README too');
  LIBS.forEach((l) => assert.ok(sec.includes(l), l));
});

test('criterion 14: the in-app credit names the exception and the libraries, and keeps the Stockfish credit', () => {
  const b = read('src/body.html'), credits = (b.match(/<p class="credit">[\s\S]*?<\/p>/g) || []).join('\n');
  assert.ok(credits.includes('LICENSE-EXCEPTION'));
  LIBS.forEach((l) => assert.ok(credits.includes(l.replace(' SDK', '').replace(' Library', '')), l));
  assert.ok(credits.includes('Analysis by Stockfish 19 (GPLv3, stockfishchess.org) via stockfish.js.'), 'the Stockfish credit stays');
  assert.ok(!/[–—]/.test(credits), 'no dashes in the credits');
});

test('the build ships ads.js before app.js, and the plugin is pinned', () => {
  const b = read('scripts/build.sh');
  assert.match(b, /\btips ads app\b/);
  assert.equal(require('../package.json').dependencies['@capacitor-community/admob'], '8.4.2');
});

test('CI: the app ID goes into the manifest after cap add, and the launch guard is there', () => {
  const w = read('.github/workflows/build-apk.yml');
  assert.ok(w.indexOf('npx cap add android') < w.indexOf('com.google.android.gms.ads.APPLICATION_ID'));
  assert.ok(w.includes(A.CONFIG.appId));
  assert.ok(w.includes('vars.ADS_LIVE'));
  assert.ok(w.indexOf('vars.ADS_LIVE') < w.indexOf('npm install'), 'the guard runs before anything is built');
  assert.ok(!w.includes(REAL), 'the real unit lives in src/js/ads.js only');
});
