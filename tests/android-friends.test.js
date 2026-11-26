// Unit tests for scripts/android-friends.sh (slice FC3, friend-challenges.tech.md sections 8 and 10): the challenge link
// intent filter (Android App Links) on the main activity, on a small fake android/ tree shaped like `npx cap add android`
// makes it, and the --check-merged mode on a fake merged manifest. No Android SDK needed.
// FC5 (sections 4 and 10): push. config/google-services.json into android/app (the Capacitor template applies the Google
// services Gradle plugin when that file exists; the script checks the template still does), firebaseMessagingVersion pinned to
// 25.0.1, the three FCM meta-data entries in <application> (auto-init off, the ic_stat_friend icon, the "friend" channel), the
// icon in res/drawable; --check-merged also checks POST_NOTIFICATIONS, the meta-data, the plugin's service and the generated
// Firebase values.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process');

const SCRIPT = path.join(__dirname, '../scripts/android-friends.sh');
// The Capacitor 8 template's manifest (trimmed): the main activity is singleTask with the launcher filter
const ACT = '        <activity\n            android:configChanges="orientation|keyboardHidden|keyboard|screenSize|locale|smallestScreenSize|screenLayout|uiMode|navigation|density"\n            android:name=".MainActivity"\n            android:label="@string/title_activity_main"\n            android:theme="@style/AppTheme.NoActionBarLaunch"\n            android:launchMode="singleTask"\n            android:exported="true">\n\n            <intent-filter>\n                <action android:name="android.intent.action.MAIN" />\n                <category android:name="android.intent.category.LAUNCHER" />\n            </intent-filter>\n\n        </activity>\n';
const PROVIDER = '        <provider\n            android:name="androidx.core.content.FileProvider"\n            android:authorities="${applicationId}.fileprovider"\n            android:exported="false"\n            android:grantUriPermissions="true">\n        </provider>\n';
const OTHER = '        <activity android:name=".Other" android:exported="false">\n        </activity>\n';
const man = (acts) => '<?xml version="1.0" encoding="utf-8"?>\n<manifest xmlns:android="http://schemas.android.com/apk/res/android">\n\n    <application\n        android:allowBackup="true"\n        android:label="@string/app_name">\n\n' + acts + PROVIDER + '    </application>\n\n    <uses-permission android:name="android.permission.INTERNET" />\n</manifest>\n';
// The rest of the Capacitor 8 template (@capacitor/cli 8.6.2, assets/android-template.tar.gz), trimmed to what the script reads
const VARS = "ext {\n    minSdkVersion = 24\n    compileSdkVersion = 36\n    targetSdkVersion = 36\n    androidxAppCompatVersion = '1.7.1'\n    cordovaAndroidVersion = '14.0.1'\n}";
const ROOTG = "buildscript {\n    dependencies {\n        classpath 'com.android.tools.build:gradle:8.13.0'\n        classpath 'com.google.gms:google-services:4.4.4'\n    }\n}\n";
const APPG = "apply plugin: 'com.android.application'\n\napply from: 'capacitor.build.gradle'\n\ntry {\n    def servicesJSON = file('google-services.json')\n    if (servicesJSON.text) {\n        apply plugin: 'com.google.gms.google-services'\n    }\n} catch(Exception e) {\n    logger.info(\"google-services.json not found, google-services plugin not applied. Push Notifications won't work\")\n}\n";
function tree(m, o) {
  o = o || {};
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'fc3-'));
  fs.mkdirSync(path.join(d, 'app/src/main'), { recursive: true });
  if (m != null) fs.writeFileSync(path.join(d, 'app/src/main/AndroidManifest.xml'), m);
  if (o.vars !== null) fs.writeFileSync(path.join(d, 'variables.gradle'), o.vars || VARS);
  if (o.rootg !== null) fs.writeFileSync(path.join(d, 'build.gradle'), o.rootg || ROOTG);
  if (o.appg !== null) fs.writeFileSync(path.join(d, 'app/build.gradle'), o.appg || APPG);
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

const GSV = '<?xml version="1.0" encoding="utf-8"?>\n<resources>\n    <string name="google_app_id" translatable="false">1:449104716017:android:06ef8beb5868fe5bde0950</string>\n    <string name="project_id" translatable="false">chess-coach-100</string>\n</resources>\n';
// What Gradle makes from the app and its libraries: the merged manifest (with the libraries' POST_NOTIFICATIONS and the push
// plugin's service unless lib is false) and the Google services plugin's values (unless gsv is false)
const merged = (d, body, o) => {
  o = o || {};
  const m = path.join(d, 'app/build/intermediates/merged_manifest/release/processReleaseMainManifest'); fs.mkdirSync(m, { recursive: true });
  const lib = o.lib === false ? '' : '    <uses-permission android:name="android.permission.POST_NOTIFICATIONS" />\n';
  const svc = o.lib === false ? '' : '        <service android:name="com.capacitorjs.plugins.pushnotifications.MessagingService" android:exported="false" />\n';
  fs.writeFileSync(path.join(m, 'AndroidManifest.xml'), body.replace('</application>', svc + '    </application>').replace('</manifest>', lib + '</manifest>'));
  if (o.gsv !== false) { const g = path.join(d, 'app/build/generated/res/processReleaseGoogleServices/values'); fs.mkdirSync(g, { recursive: true }); fs.writeFileSync(path.join(g, 'values.xml'), o.gsv || GSV); }
};
test('android-friends.sh --check-merged: the merged manifest keeps the verified link filter on the main activity', () => {
  let d = tree(man(ACT)); assert.notEqual(run('--check-merged', d).code, 0, 'nothing built yet');
  assert.equal(run(d).code, 0);
  merged(d, read(d).replace('android:name=".MainActivity"', 'android:name="com.suresh.chesscoach.MainActivity"'));
  const ok = run('--check-merged', d); assert.equal(ok.code, 0, ok.out);
  d = tree(man(ACT)); merged(d, read(d)); assert.notEqual(run('--check-merged', d).code, 0, 'no filter in the merged manifest');
  d = tree(man(ACT)); run(d); merged(d, read(d).replace('android:autoVerify="true"', '')); assert.notEqual(run('--check-merged', d).code, 0, 'not verified');
});

// ---------- FC5: push ----------
const REPO = path.join(__dirname, '..');
const GS = path.join(REPO, 'config/google-services.json');
const ICON_SRC = path.join(REPO, 'assets/notification/ic_stat_friend.xml');
const META = [
  ['firebase_messaging_auto_init_enabled', 'android:value="false"'],
  ['com.google.firebase.messaging.default_notification_icon', 'android:resource="@drawable/ic_stat_friend"'],
  ['com.google.firebase.messaging.default_notification_channel_id', 'android:value="friend"']
];
const appBlock = (m) => { const x = /<application\b[\s\S]*<\/application>/.exec(m); return x ? x[0] : ''; };

test('FC5: google-services.json, firebaseMessagingVersion 25.0.1, the three FCM meta-data in <application> and the icon; safe to run twice', () => {
  const d = tree(man(ACT));
  for (let i = 0; i < 2; i++) {
    const r = run(d); assert.equal(r.code, 0, r.out);
    assert.equal(fs.readFileSync(path.join(d, 'app/google-services.json'), 'utf8'), fs.readFileSync(GS, 'utf8'), 'config/google-services.json copied as is');
    const v = fs.readFileSync(path.join(d, 'variables.gradle'), 'utf8');
    assert.equal(count(v, 'firebaseMessagingVersion'), 1);
    assert.match(v, /^\s*firebaseMessagingVersion = '25\.0\.1'$/m);
    assert.match(v, /cordovaAndroidVersion = '14\.0\.1'\n\s*firebaseMessagingVersion = '25\.0\.1'\n\}/, 'inside ext { }');
    const m = read(d), a = appBlock(m);
    for (const [n, val] of META) {
      assert.equal(count(m, 'android:name="' + n + '"'), 1, n + ' exactly once');
      assert.ok(a.includes('<meta-data android:name="' + n + '" ' + val + ' />'), n + ' inside <application> with ' + val);
    }
    assert.equal(fs.readFileSync(path.join(d, 'app/src/main/res/drawable/ic_stat_friend.xml'), 'utf8'), fs.readFileSync(ICON_SRC, 'utf8'));
    assert.ok(FILTER.test(mainBlock(m)), 'the FC3 link filter is still there');
  }
  // the least added: the template applies the Google services plugin itself; the script adds no plugin and no dependency
  assert.equal(fs.readFileSync(path.join(d, 'app/build.gradle'), 'utf8'), APPG);
  assert.equal(fs.readFileSync(path.join(d, 'build.gradle'), 'utf8'), ROOTG);
  assert.ok(!/firebase-analytics|play-services-measurement/.test(fs.readFileSync(SCRIPT, 'utf8').replace(/^#.*$/mg, '')), 'no analytics anywhere in the script');
});

test('FC5: ic_stat_friend is a white-on-transparent vector (a status bar icon: one colour, no gradient, no bitmap)', () => {
  const x = fs.readFileSync(ICON_SRC, 'utf8');
  assert.match(x, /^<\?xml[^>]*\?>\s*(<!--[\s\S]*?-->\s*)?<vector\b/);
  assert.match(x, /android:width="24dp"/); assert.match(x, /android:height="24dp"/); assert.match(x, /android:viewportWidth="24"/); assert.match(x, /android:viewportHeight="24"/);
  const fills = x.match(/android:fillColor="[^"]*"/g) || [];
  assert.ok(fills.length > 0);
  fills.forEach((f) => assert.equal(f, 'android:fillColor="#FFFFFFFF"', 'white only: ' + f));
  assert.ok(!/gradient|bitmap|strokeColor/i.test(x));
  assert.notEqual(x, fs.readFileSync(path.join(REPO, 'assets/notification/ic_stat_daily.xml'), 'utf8'), 'its own icon, not the reminder one');
});

test('FC5 fails loudly when a push patch cannot apply', () => {
  const r1 = run(tree(man(ACT), { vars: null })); assert.notEqual(r1.code, 0, 'no variables.gradle'); assert.match(r1.out, /FAILED/);
  assert.notEqual(run(tree(man(ACT), { vars: 'something else' })).code, 0, 'variables.gradle without ext { }');
  assert.notEqual(run(tree(man(ACT), { vars: VARS.replace('}', "    firebaseMessagingVersion = '25.+'\n}") })).code, 0, 'already set to something else');
  const r2 = run(tree(man(ACT), { appg: "apply plugin: 'com.android.application'\n" })); assert.notEqual(r2.code, 0, 'the template no longer applies the Google services plugin'); assert.match(r2.out, /google-services/);
  assert.notEqual(run(tree(man(ACT), { appg: null })).code, 0, 'no app/build.gradle');
  assert.notEqual(run(tree(man(ACT), { rootg: "buildscript { }\n" })).code, 0, 'no google-services classpath in the root build.gradle');
  const odd = man(ACT).replace('</application>', '        <meta-data android:name="firebase_messaging_auto_init_enabled" android:value="true" />\n    </application>');
  assert.notEqual(run(tree(odd)).code, 0, 'auto-init already set to true: refuse rather than guess');
  const out = man(ACT).replace('</manifest>', '    <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="friend" />\n</manifest>');
  assert.notEqual(run(tree(out)).code, 0, 'a meta-data outside <application>');
});

test('FC5 --check-merged: POST_NOTIFICATIONS, the three meta-data (auto-init off), the push service and the generated Firebase values', () => {
  let d = tree(man(ACT)); assert.equal(run(d).code, 0); merged(d, read(d));
  const ok = run('--check-merged', d); assert.equal(ok.code, 0, ok.out);
  d = tree(man(ACT)); run(d); merged(d, read(d), { lib: false }); assert.notEqual(run('--check-merged', d).code, 0, 'no POST_NOTIFICATIONS, no push service');
  for (const [n] of META) { d = tree(man(ACT)); run(d); merged(d, read(d).replace(new RegExp('\\s*<meta-data android:name="' + n.replace(/\./g, '\\.') + '"[^>]*/>'), '')); assert.notEqual(run('--check-merged', d).code, 0, 'missing ' + n); }
  d = tree(man(ACT)); run(d); merged(d, read(d).replace('android:name="firebase_messaging_auto_init_enabled" android:value="false"', 'android:name="firebase_messaging_auto_init_enabled" android:value="true"'));
  assert.notEqual(run('--check-merged', d).code, 0, 'auto-init on in the merged manifest');
  d = tree(man(ACT)); run(d); merged(d, read(d), { gsv: false }); assert.notEqual(run('--check-merged', d).code, 0, 'the Google services plugin made no values (FirebaseApp would not start)');
  d = tree(man(ACT)); run(d); merged(d, read(d), { gsv: GSV.replace(/chess-coach-100/g, 'other-project') }); assert.notEqual(run('--check-merged', d).code, 0, 'values from another project');
});
