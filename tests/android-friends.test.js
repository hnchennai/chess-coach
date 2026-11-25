// Unit tests for scripts/android-friends.sh (slice FC3, friend-challenges.tech.md sections 8 and 10): the challenge link
// intent filter (Android App Links) on the main activity, on a small fake android/ tree shaped like `npx cap add android`
// makes it, and the --check-merged mode on a fake merged manifest. No Android SDK needed.
// Run: node --test tests/android-friends.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

const SCRIPT = path.join(__dirname, '../scripts/android-friends.sh');
// The Capacitor 8 template's manifest (trimmed): the main activity is singleTask with the launcher filter
const ACT = '        <activity\n            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"\n            android:name=".MainActivity"\n            android:label="@string/title_activity_main"\n            android:theme="@style/AppTheme.NoActionBarLaunch"\n            android:launchMode="singleTask"\n            android:exported="true">\n\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n\n        </activity>\n';
const PROVIDER = '        <provider\n            android:name="androidx.core.content.FileProvider"\n            android:authorities="${applicationId}.fileprovider"\n            android:exported="false"\n            android:grantUriPermissions="true">\n        </provider>\n';
const OTHER = '        <activity android:name=".Other" android:exported="false">\n        </activity>\n';
const man = (acts) => '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n\n    <application\n        android:allowBackup="true"\n        android:label="@string/app_name">\n\n' + acts + PROVIDER + '    </application>\n\n    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>\n';
function tree(m) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fc3-'));
  fs.mkdirSync(path.join(d, 'app/src/main'), { recursive: true });
  if (m != null) fs.writeFileSync(path.join(d, 'app/src/main/AndroidManifest.xml'), m);
  return d;
}
const run = (...a) => { try { return { code: 0, out: cp.execFileSync('sh', [SCRIPT, ...a], { encoding: 'utf8', stdio: 'pipe' }) }; } catch (e) { return { code: e.status, out: String(e.stdout) + String(e.stderr) }; } };
const read = (d) => fs.readFileSync(path.join(d, 'app/src/main/AndroidManifest.xml'), 'utf8');
const count = (s, x) => s.split(x).length - 1;
// The main activity's block, from <activity ... .MainActivity ...> to its </activity>
const mainBlock = (m) => { const x = /<activity\b[^>]*android:name="\.MainActivity"[^>]*>[\s\S]*?<\/activity>/.exec(m); return x ? x[0] : ''; };
const FILTER = /<intent-filter android:autoVerify="true">\s*<action android:name="android\.intent\.action\.VIEW" \/>\s*<category android:name="android\.intent\.category\.DEFAULT" \/>\s*<category android:name="android\.intent\.category\.BROWSABLE" \/>\s*<data android:scheme="https" android:host="hnchennai\.github\.io" android:path="\/c\/" \/>\s*<\/intent-filter>/;

test('android-friends.sh: the App Links filter goes into the main activity (https, hnchennai.github.io, path /c/, autoVerify); safe to run twice', () => {
  const d = tree(man(OTHER + ACT));
  for (let i = 0; i < 2; i++) {
    const r = run(d); assert.equal(r.code, 0, r.out);
    const m = read(d), b = mainBlock(m);
    assert.ok(FILTER.test(b), 'the filter is inside the main activity:\n' + b);
    assert.equal(count(m, 'android:host="hnchennai.github.io"'), 1, 'exactly once');
    assert.equal(count(m, 'android:autoVerify="true"'), 1);
    assert.ok(b.includes('android.intent.category.LAUNCHER'), 'the launcher filter stays');
    assert.ok(!/\.Other[\s\S]*hnchennai/.test(m.split('.MainActivity')[0]), 'not on another activity');
  }
  assert.ok(!read(d).includes('pathPrefix'), 'an exact path, not a prefix (the code is in the query)');
});

test('android-friends.sh: an activity named in full (com.suresh.chesscoach.MainActivity) works too', () => {
  const d = tree(man(ACT.replace('android:name=".MainActivity"', 'android:name="com.suresh.chesscoach.MainActivity"')));
  const r = run(d); assert.equal(r.code, 0, r.out);
  assert.ok(FILTER.test(read(d)));
});

test('android-friends.sh fails loudly when the patch cannot apply', () => {
  assert.notEqual(run(tree(null)).code, 0, 'no manifest');
  const r = run(tree(man(OTHER)));
  assert.notEqual(r.code, 0, 'no main activity');
  assert.match(r.out, /FAILED/);
  assert.notEqual(run(tree(man(ACT.replace('</activity>', '')))).code, 0, 'a main activity that never closes');
  const two = man(ACT + ACT.replace('.MainActivity', '.Main2'));
  const d = tree(two.replace('android:name=".Main2"', 'android:name=".MainActivity"'));
  assert.notEqual(run(d).code, 0, 'two main activities');
  // a filter for the same host somewhere else already: refuse rather than guess
  const e = tree(man(OTHER.replace('</activity>', '<intent-filter><data android:scheme="https" android:host="hnchennai.github.io" /></intent-filter>\n        </activity>') + ACT));
  assert.notEqual(run(e).code, 0, 'the host is already used by another activity');
});

test('android-friends.sh does not add Firebase, push or google-services.json (those are FC5)', () => {
  const d = tree(man(ACT));
  assert.equal(run(d).code, 0);
  const all = fs.readdirSync(path.join(d, 'app'), { recursive: true }).join('\n');
  assert.ok(!all.includes('google-services.json'));
  assert.ok(!/firebase|messaging|POST_NOTIFICATIONS/i.test(read(d)));
  assert.ok(!/firebase|google-services|push-notifications/i.test(fs.readFileSync(SCRIPT, 'utf8').replace(/^#.*$/mg, '')), 'nothing in the script itself');
});

const merged = (d, body) => { const m = path.join(d, 'app/build/intermediates/merged_manifest/release/processReleaseMainManifest'); fs.mkdirSync(m, { recursive: true }); fs.writeFileSync(path.join(m, 'AndroidManifest.xml'), body); };
test('android-friends.sh --check-merged: the merged manifest keeps the verified link filter on the main activity', () => {
  let d = tree(man(ACT)); assert.notEqual(run('--check-merged', d).code, 0, 'nothing built yet');
  assert.equal(run(d).code, 0);
  merged(d, read(d).replace('android:name=".MainActivity"', 'android:name="com.suresh.chesscoach.MainActivity"'));
  const ok = run('--check-merged', d); assert.equal(ok.code, 0, ok.out);
  d = tree(man(ACT)); merged(d, read(d)); assert.notEqual(run('--check-merged', d).code, 0, 'no filter in the merged manifest');
  d = tree(man(ACT)); run(d); merged(d, read(d).replace('android:autoVerify="true"', '')); assert.notEqual(run('--check-merged', d).code, 0, 'not verified');
});
