// Unit tests for the build-time test flag (FC3 fix round 1, fix 1 and fix 8): scripts/build.sh writes js/buildflags.js from
// CC_TEST_BUILD (default off); the committed www/ is a release build; fconfig.js honours window.FC_CONFIG only in a test build.
// Run: node --test tests/buildflags.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs'), os = require('os'), path = require('path'), cp = require('child_process'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
function build(env) {
  const out = fs.mkdtempSync(path.join(os.tmpdir(), 'ccb-'));
  cp.execFileSync('sh', [path.join(ROOT, 'scripts/build.sh')], { env: Object.assign({}, process.env, { CC_WWW_OUT: out }, env), stdio: 'pipe' });
  return out;
}
const flag = (dir) => { const w = {}; vm.runInNewContext(fs.readFileSync(path.join(dir, 'js/buildflags.js'), 'utf8'), { window: w }); return JSON.parse(JSON.stringify(w.CC_BUILD)); };

test('fix 1: build.sh writes test: false by default and true only with CC_TEST_BUILD=1', () => {
  const env = Object.assign({}, process.env); delete env.CC_TEST_BUILD;
  assert.deepEqual(flag(build({ CC_TEST_BUILD: '' })), { test: false });
  assert.deepEqual(flag(build({ CC_TEST_BUILD: 'yes' })), { test: false }, 'only exactly 1 turns it on');
  const t = build({ CC_TEST_BUILD: '1' });
  assert.deepEqual(flag(t), { test: true });
  assert.ok(Object.isFrozen((() => { const w = {}; vm.runInNewContext(fs.readFileSync(path.join(t, 'js/buildflags.js'), 'utf8'), { window: w }); return w.CC_BUILD; })()));
  const html = fs.readFileSync(path.join(t, 'index.html'), 'utf8');
  assert.ok(html.indexOf('js/buildflags.js') > -1 && html.indexOf('js/buildflags.js') < html.indexOf('js/fconfig.js'), 'loaded before fconfig.js');
});

test('fix 1: the committed www/ is a release build (main and Play builds never show the test toggle)', () => {
  assert.deepEqual(flag(path.join(ROOT, 'www')), { test: false });
});

test('fix 8: fconfig.js takes window.FC_CONFIG only in a test build', () => {
  const src = fs.readFileSync(path.join(ROOT, 'src/js/fconfig.js'), 'utf8');
  const run = (test) => { const w = { FC_CONFIG: { apiKey: 'fake-key', fnBase: 'https://fn.fc.test' }, CC_BUILD: { test } }; vm.runInNewContext(src, { window: w }); return w.FCONFIG; };
  assert.equal(run(true).apiKey, 'fake-key');
  assert.match(run(false).apiKey, /PLACEHOLDER/);
  assert.match(run(false).fnBase, /cloudfunctions\.net$/);
  const w = { FC_CONFIG: { apiKey: 'x' } }; vm.runInNewContext(src, { window: w });
  assert.match(w.FCONFIG.apiKey, /PLACEHOLDER/, 'no flag at all: a release build');
});
