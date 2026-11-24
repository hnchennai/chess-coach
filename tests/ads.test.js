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
const OK = { slot: true, firstDay: false, activity: false, overlay: false, board: false, height: 915, native: true };
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

test('A-D19: none on Home while the board is on screen, moved or not', () => {
  assert.equal(A.mayShow(but({ board: true })), false);
  assert.equal(A.mayShow(but({ board: undefined })), false, 'an unknown board fact fails closed');
  assert.equal(A.mayShow(but({ board: false })), true);
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

test('criterion 2 / A-D11: the consent check runs once at app start, from day two, on the native platform, whatever is open', () => {
  const S = { boot: true, native: true, firstDay: false, level: 'beginner' };
  assert.equal(A.mayStart(S), true);
  assert.equal(A.mayStart(Object.assign({}, S, { boot: false })), false, 'A-D7: asked at app start only, never at a later quiet moment');
  assert.equal(A.mayStart(Object.assign({}, S, { boot: undefined })), false);
  assert.equal(A.mayStart(Object.assign({}, S, { firstDay: true })), false, 'day one: nothing ads-related runs');
  assert.equal(A.mayStart(Object.assign({}, S, { native: false })), false, 'web: nothing runs');
  assert.equal(A.mayStart(Object.assign({}, S, { level: null })), false, 'no level yet (the level check comes first)');
  assert.equal(A.mayStart(Object.assign({}, S, { activity: true, overlay: true })), true, 'the check itself shows nothing, so an open game does not stop it');
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

test('criterion 10: no caller can turn the real unit on: bannerOptions takes no switch', () => {
  [{ live: true }, { live: true, margin: 0 }, { adId: REAL }, { isTesting: false }, { unit: REAL, live: 'yes' }].forEach((x) => {
    const b = A.bannerOptions(x);
    assert.equal(b.adId, TEST, JSON.stringify(x)); assert.equal(b.isTesting, true); assert.equal(b.npa, true);
  });
  assert.equal(A.bannerOptions.length, 1);
});

test('criterion 10: the real unit is used only when the switch is on', () => {
  assert.equal(A.unitFor(false), TEST);
  assert.equal(A.unitFor(true), REAL);
  assert.equal(A.unitFor(undefined), TEST);
  assert.equal(A.unitFor('yes'), TEST, 'only the boolean true turns it on');
  assert.equal(A.unitFor(1), TEST);
});

test('criterion 4: the SDK starts with a PG ceiling and no test-device or child flags', () => {
  const i = A.initOptions();
  assert.equal(i.maxAdContentRating, 'ParentalGuidance');
  assert.deepEqual(Object.keys(i), ['maxAdContentRating']);
});

test('criterion 6 / A-D15: every appearance of the banner waits 1000ms: Home, Progress and end cards alike', () => {
  assert.equal(A.SHOW_DELAY, 1000);
  assert.equal(A.waitLeft.length, 2, 'no place can be exempt');
  assert.equal(A.waitLeft(5000, 5000), 1000);
  assert.equal(A.waitLeft(5000, 5400), 600);
  assert.equal(A.waitLeft(5000, 5999), 1);
  assert.equal(A.waitLeft(5000, 6000), 0);
  assert.equal(A.waitLeft(5000, 9000), 0);
  assert.equal(A.waitLeft(5000, 4000), 1000, 'a clock that went back never shortens the wait');
  assert.equal(A.waitLeft(undefined, 6000), 1000, 'an unknown start waits in full');
  assert.equal(A.waitLeft(NaN, 6000), 1000);
  assert.equal(A.waitLeft(null, 6000), 0, 'null is time zero, long ago');
});

test('criterion 8 / A-D7: the form is needed only when Google says so and has one', () => {
  assert.equal(A.needsForm({ status: 'REQUIRED', isConsentFormAvailable: true, canRequestAds: false }), true);
  assert.equal(A.needsForm({ status: 'REQUIRED', isConsentFormAvailable: false }), false);
  assert.equal(A.needsForm({ status: 'NOT_REQUIRED', isConsentFormAvailable: true }), false);
  assert.equal(A.needsForm({ status: 'OBTAINED', isConsentFormAvailable: true }), false);
  assert.equal(A.needsForm({ status: 'UNKNOWN' }), false);
  assert.equal(A.needsForm(null), false);
});

test('criterion 8 / A-D7: Google’s form may open only when no activity and no sheet is open; every fact must be known', () => {
  assert.equal(A.mayForm({ activity: false, overlay: false }), true);
  assert.equal(A.mayForm({ activity: true, overlay: false }), false, 'never over a lesson, game, puzzle set or review');
  assert.equal(A.mayForm({ activity: false, overlay: true }), false, 'never over Settings, the level check or an offer');
  assert.equal(A.mayForm({ activity: false }), false); assert.equal(A.mayForm({}), false); assert.equal(A.mayForm(null), false); assert.equal(A.mayForm(), false);
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
  assert.equal(A.TAB_BAR, 56); assert.equal(A.GAP, 8);
  assert.equal(A.marginFor(true), 64, 'the tab bar and an 8dp gap, so a tap on a tab cannot land on the ad');
  assert.equal(A.marginFor(false), 0);
});

test('A-D14: the page padding is the banner height, plus the gap on phones; none without a height', () => {
  assert.equal(A.padFor(64, true), 72);
  assert.equal(A.padFor(90, false), 90);
  assert.equal(A.padFor(60.2, true), 69);
  assert.equal(A.padFor(0, true), 0); assert.equal(A.padFor(undefined, true), 0); assert.equal(A.padFor(-5, false), 0);
});

test('the pure module makes no plugin, DOM or network reference', () => {
  const src = fs.readFileSync(path.join(__dirname, '../src/js/ads.js'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');
  ['Capacitor', 'document', 'fetch(', 'XMLHttpRequest', 'localStorage', 'console.'].forEach((w) => assert.ok(!src.includes(w), w));
});

// Criterion 14 and the constitution: the licence exception, word for word, and where it is named.
const EXC = 'Additional permission under GNU GPL version 3 section 7: if you modify this program, or any covered work, by linking or combining it with the Google Mobile Ads SDK, the Google User Messaging Platform SDK, the Google Play Billing Library, or the Google Play In-App Review Library and the Google Play Core Common library it uses (or modified versions of those libraries), the copyright holder of Chess Coach grants you permission to convey the resulting work. This permission covers the Chess Coach code only. Stockfish is a separate program under plain GPL version 3.';
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

// D2 (DP-D14, Suresh 2026-11-24): the exception also names the Play review library and the core library it uses.
test('DP-D14: LICENSE-EXCEPTION, the README and the constitution name the Play In-App Review and Core Common libraries', () => {
  const names = ['Google Play In-App Review Library', 'Google Play Core Common library'];
  names.forEach((l) => assert.ok(flat(read('LICENSE-EXCEPTION')).includes(l), 'LICENSE-EXCEPTION: ' + l));
  const r = read('README.md'), sec = r.slice(r.indexOf('## Licence and source'), r.indexOf('## Credits'));
  names.forEach((l) => assert.ok(flat(sec).includes(l), 'README: ' + l));
  const c = read('CONSTITUTION.md').split('\n').filter((x) => x.includes('LICENSE-EXCEPTION'));
  assert.equal(c.length, 1); names.forEach((l) => assert.ok(c[0].includes(l), 'CONSTITUTION: ' + l));
});

test('criterion 14: the in-app credit names the exception and the libraries, and keeps the Stockfish credit', () => {
  const b = read('src/body.html'), credits = (b.match(/<p class="credit">[\s\S]*?<\/p>/g) || []).join('\n');
  assert.ok(credits.includes('LICENSE-EXCEPTION'));
  LIBS.forEach((l) => assert.ok(credits.includes(l.replace(' SDK', '').replace(' Library', '')), l));
  assert.ok(credits.includes('Analysis by Stockfish 19 (GPLv3, stockfishchess.org) via stockfish.js.'), 'the Stockfish credit stays');
  assert.ok(!/[–—]/.test(credits), 'no dashes in the credits');
});

test('A-D9: the build loads ads.js only where the native bridge is, before app.js; the plugin is pinned', () => {
  const b = read('scripts/build.sh'), html = read('www/index.html');
  assert.ok(!/<script src="js\/ads\.js"><\/script>\s*$/m.test(html), 'no plain script tag for ads.js');
  const line = `<script>if(window.Capacitor)document.write('<script src="js/ads.js"><\\/script>')</script>`;
  assert.equal(html.split(line).length - 1, 1, 'the conditional loader, once');
  assert.ok(html.indexOf('js/tips.js') < html.indexOf(line) && html.indexOf(line) < html.indexOf('js/app.js'), 'after tips, before app');
  assert.equal(html.split('ads.js').length - 1, 1, 'ads.js is named nowhere else in the page');
  assert.ok(b.includes('window.Capacitor'));
  const pkg = require('../package.json');
  assert.equal(pkg.dependencies['@capacitor-community/admob'], '8.4.2');
  assert.equal(pkg.overrides['@webview-native-ui/engine'], PIN.engine, 'the engine the plugin pulls in is pinned for npm too');
});

// ---- CI scripts, executed for real against temp copies ----
const os = require('node:os');
const { spawnSync } = require('node:child_process');
const PIN = { ads: '25.4.0', ump: '4.0.0', engine: '1.0.11' };
const ROOT = path.join(__dirname, '..');
function tmpRepo() {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ads-guard-'));
  ['src/js', 'www/js', 'scripts'].forEach((x) => fs.mkdirSync(path.join(d, x), { recursive: true }));
  fs.copyFileSync(path.join(ROOT, 'src/js/ads.js'), path.join(d, 'src/js/ads.js'));
  fs.copyFileSync(path.join(ROOT, 'src/js/tips.js'), path.join(d, 'src/js/tips.js'));
  fs.copyFileSync(path.join(ROOT, 'src/js/ads.js'), path.join(d, 'www/js/ads.js'));
  fs.copyFileSync(path.join(ROOT, 'scripts/check-ads-switch.sh'), path.join(d, 'scripts/check-ads-switch.sh'));
  return d;
}
function guard(d, env) {
  const e = Object.assign({}, process.env); delete e.ADS_LIVE;
  const r = spawnSync('sh', [path.join(d, 'scripts/check-ads-switch.sh')], { env: Object.assign(e, env || {}), encoding: 'utf8' });
  return { code: r.status, out: r.stdout + r.stderr };
}
const edit = (d, f, fn) => fs.writeFileSync(path.join(d, f), fn(fs.readFileSync(path.join(d, f), 'utf8')));
const liveOn = (d) => ['src/js/ads.js', 'www/js/ads.js'].forEach((f) => edit(d, f, (s) => s.replace(/^(\s*)live: false$/m, '$1live: true')));

test('criterion 10, the guard script: passes with the switch off', () => {
  const d = tmpRepo(), r = guard(d);
  assert.equal(r.code, 0, r.out); assert.match(r.out, /test ads only/);
  assert.equal(guard(d, { ADS_LIVE: 'yes' }).code, 0, 'the variable alone changes nothing');
});
test('criterion 10, the guard script: fails with the switch on and no ADS_LIVE', () => {
  const d = tmpRepo(); liveOn(d);
  assert.match(fs.readFileSync(path.join(d, 'src/js/ads.js'), 'utf8'), /^\s*live: true$/m, 'the test really turned it on');
  const r = guard(d);
  assert.notEqual(r.code, 0, r.out); assert.match(r.out, /ADS_LIVE/);
  assert.notEqual(guard(d, { ADS_LIVE: 'true' }).code, 0, 'only the exact word yes counts');
  assert.notEqual(guard(d, { ADS_LIVE: '' }).code, 0);
});
test('criterion 10, the guard script: passes with the switch on and ADS_LIVE=yes', () => {
  const d = tmpRepo(); liveOn(d);
  const r = guard(d, { ADS_LIVE: 'yes' });
  assert.equal(r.code, 0, r.out); assert.match(r.out, /Real ads are ON/);
});
test('criterion 10, the guard script: fails when the real unit ID appears a second time under src/', () => {
  let d = tmpRepo(); fs.writeFileSync(path.join(d, 'src/js/other.js'), "var u = '" + REAL + "';\n");
  assert.notEqual(guard(d).code, 0, 'in another file');
  d = tmpRepo(); edit(d, 'src/js/ads.js', (s) => s + "\n/* " + REAL + " */\n"); fs.copyFileSync(path.join(d, 'src/js/ads.js'), path.join(d, 'www/js/ads.js'));
  assert.notEqual(guard(d).code, 0, 'twice in ads.js');
  d = tmpRepo(); edit(d, 'src/js/ads.js', (s) => s.replace(REAL, 'ca-app-pub-0000000000000000/0000000000')); fs.copyFileSync(path.join(d, 'src/js/ads.js'), path.join(d, 'www/js/ads.js'));
  assert.notEqual(guard(d).code, 0, 'missing from ads.js');
});
test('criterion 10, the guard script: fails on a second switch line, a stale www copy, or a side door to the real unit', () => {
  let d = tmpRepo(); edit(d, 'src/js/ads.js', (s) => s.replace(/^(\s*)live: false$/m, '$1live: false,\n$1live: true')); fs.copyFileSync(path.join(d, 'src/js/ads.js'), path.join(d, 'www/js/ads.js'));
  assert.notEqual(guard(d, { ADS_LIVE: '' }).code, 0, 'two switch lines');
  d = tmpRepo(); edit(d, 'www/js/ads.js', (s) => s.replace(/^(\s*)live: false$/m, '$1live: true'));
  assert.notEqual(guard(d).code, 0, 'www differs from src');
  d = tmpRepo(); fs.writeFileSync(path.join(d, 'src/js/other.js'), 'var u = Ads.unitFor(true);\n');
  assert.notEqual(guard(d).code, 0, 'unitFor called outside ads.js');
  d = tmpRepo(); fs.writeFileSync(path.join(d, 'src/js/other.js'), 'var u = Ads.CONFIG.unit;\n');
  assert.notEqual(guard(d).code, 0, 'CONFIG.unit read outside ads.js');
});
test('criterion 10: the real unit ID is in src/ exactly once, in ads.js (this repo, now)', () => {
  const r = guard(ROOT, { ADS_SKIP_BUILD: '1' });
  assert.equal(r.code, 0, r.out);
});

const MANIFEST = '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n    <application\n        android:label="@string/app_name">\n        <activity android:name=".MainActivity" />\n    </application>\n    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>\n';
const VARS = "ext {\n    minSdkVersion = 24\n    compileSdkVersion = 36\n    targetSdkVersion = 36\n    androidxAppCompatVersion = '1.7.1'\n}\n";
function tmpAndroid(manifest, vars) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'ads-android-'));
  fs.mkdirSync(path.join(d, 'app/src/main'), { recursive: true });
  if (manifest != null) fs.writeFileSync(path.join(d, 'app/src/main/AndroidManifest.xml'), manifest);
  if (vars != null) fs.writeFileSync(path.join(d, 'variables.gradle'), vars);
  return d;
}
const setup = (d) => { const r = spawnSync('sh', [path.join(ROOT, 'scripts/android-ads.sh'), d], { encoding: 'utf8' }); return { code: r.status, out: r.stdout + r.stderr }; };
const count = (s, x) => s.split(x).length - 1;

test('CI, the Android set-up script: app ID and delayed measurement in the manifest, exact library versions pinned; safe to run twice', () => {
  const d = tmpAndroid(MANIFEST, VARS);
  for (let i = 0; i < 2; i++) {
    const r = setup(d); assert.equal(r.code, 0, r.out);
    const m = fs.readFileSync(path.join(d, 'app/src/main/AndroidManifest.xml'), 'utf8'), v = fs.readFileSync(path.join(d, 'variables.gradle'), 'utf8');
    assert.equal(count(m, '<meta-data android:name="com.google.android.gms.ads.APPLICATION_ID" android:value="' + A.CONFIG.appId + '" />'), 1);
    assert.equal(count(m, '<meta-data android:name="com.google.android.gms.ads.DELAY_APP_MEASUREMENT_INIT" android:value="true" />'), 1, 'A-D11: day one is quiet natively too');
    assert.ok(m.indexOf('<application') < m.indexOf('APPLICATION_ID') && m.indexOf('DELAY_APP_MEASUREMENT_INIT') < m.indexOf('</application>'), 'inside <application>');
    assert.equal(count(v, "playServicesAdsVersion = '" + PIN.ads + "'"), 1);
    assert.equal(count(v, "userMessagingPlatformVersion = '" + PIN.ump + "'"), 1);
    assert.equal(count(v, "nativeUIEngineVersion = '" + PIN.engine + "'"), 1);
    assert.ok(v.trim().endsWith('}') && v.indexOf('nativeUIEngineVersion') < v.lastIndexOf('}'), 'inside the ext block');
    assert.ok(!/[+\[\(]/.test(v.split('\n').filter((l) => /Ads|Messaging|Engine/.test(l)).join('')), 'exact versions, no ranges');
  }
});
test('CI, the Android set-up script: fails loudly when it cannot do its job', () => {
  assert.notEqual(setup(tmpAndroid(MANIFEST.replace('</application>', ''), VARS)).code, 0, 'no </application> to insert before');
  assert.notEqual(setup(tmpAndroid(MANIFEST, null)).code, 0, 'no variables.gradle');
  assert.notEqual(setup(tmpAndroid(MANIFEST, 'buildscript { }\n// nothing here')).code, 0, 'no ext block');
  assert.notEqual(setup(tmpAndroid(MANIFEST, VARS.replace('}', "    playServicesAdsVersion = '25.4.+'\n}"))).code, 0, 'a different version is already set');
  assert.notEqual(setup(tmpAndroid(null, VARS)).code, 0, 'no manifest');
});

test('CI: the workflow calls both scripts in the right places and checks what Gradle resolved', () => {
  const w = read('.github/workflows/build-apk.yml');
  assert.ok(w.includes('vars.ADS_LIVE'));
  assert.ok(w.indexOf('sh scripts/check-ads-switch.sh') > 0 && w.indexOf('sh scripts/check-ads-switch.sh') < w.indexOf('npm install'), 'the guard runs before anything is built');
  const g = w.indexOf('node --test tests/ads.test.js');
  assert.ok(g > w.indexOf('actions/setup-node') && g > w.indexOf('node-version: 22') && g < w.indexOf('npm install'), 'the guard step also runs these unit tests (after Node is set up), so an edit inside ads.js that hands out the real unit fails the build');
  assert.ok(Math.abs(g - w.indexOf('sh scripts/check-ads-switch.sh')) < 200, 'in the same step as the guard script');
  assert.ok(w.indexOf('npx cap add android') < w.indexOf('sh scripts/android-ads.sh android') && w.indexOf('sh scripts/android-ads.sh android') < w.indexOf('npx cap sync android'));
  assert.ok(!w.includes(REAL), 'the real unit lives in src/js/ads.js only');
  ['play-services-ads:' + PIN.ads, 'user-messaging-platform:' + PIN.ump, 'io.github.webview-native-ui:engine:' + PIN.engine].forEach((x) => assert.ok(w.includes(x.replace(/\./g, '\\.')) || w.includes(x), 'resolved version checked: ' + x));
  const s = read('scripts/android-ads.sh');
  assert.ok(s.includes(A.CONFIG.appId) && !s.includes(REAL));
  const r = read('README.md');
  [PIN.ads, PIN.ump, PIN.engine, '@capacitor-community/admob', 'webview-native-ui'].forEach((x) => assert.ok(r.slice(r.indexOf('## Credits')).includes(x), 'README credits: ' + x));
});

test('test builds only: the Settings state line says why there is no banner, and is empty once real ads are on', () => {
  const line = A.debugLine({ state: 'off', banner: 'none', loaded: false, h: 0, err: 'start: Publisher misconfiguration', info: null,
    facts: { slot: true, firstDay: false, activity: false, overlay: false, height: 800, native: true, level: 'beginner' } });
  assert.ok(line.startsWith('Ads test: '));
  ['state off', 'banner none', 'consent unknown', 'slot yes', 'first day no', 'activity no', 'sheet no', 'height 800', 'start: Publisher misconfiguration'].forEach((x) => assert.ok(line.includes(x), x + ' in: ' + line));
  const ok = A.debugLine({ state: 'ready', banner: 'shown', loaded: true, h: 60, err: '', info: { status: 'NOT_REQUIRED', canRequestAds: true }, facts: null });
  assert.ok(ok.includes('state ready') && ok.includes('ad loaded (60)') && ok.includes('consent NOT_REQUIRED, can request yes') && ok.includes('no error'));
  assert.ok(A.debugLine({ err: 'x'.repeat(500) }).length < 420, 'a long error is cut');
  assert.equal(A.debugLine(null), 'Ads test: no state');
  assert.ok(!/[—–]/.test(line + ok));
  const src = read('src/js/ads.js');
  assert.ok(/function debugLine\(d\) \{\s*if \(CONFIG\.live === true\) return '';/.test(src), 'nothing is shown once the launch switch is on');
});
