/* ---------- Friend challenges (slice FC3): where the friend server is. Loaded only inside the Android app (scripts/build.sh).
   Public client config, not a secret (FC-D20, tech spec section 4): Firebase API keys are inside every APK; safety comes from
   deny-all Firestore rules, the key's API allowlist, App Check (FC6) and the function's own checks.
   FC-D38 (Suresh, 2026-11-26): Suresh's Firebase project chess-coach-100 and its Web API key (the Browser key, limited to the six
   APIs in functions/README.md step 10, with no Android app restriction: the WebView's REST calls cannot carry a package
   signature). This ends the FC-D24 placeholders for the app. The launch switch (Friends.CONFIG.live) stays off until FC6.
   fclient.js still refuses any config that holds a placeholder (FClient.configured).
   Tests set window.FC_CONFIG before any script runs; in a test build only (window.CC_BUILD.test, scripts/build.sh) its values
   replace these (tests/e2e/fc3.spec.js points at a fake host). A release build ignores it (FC3 fix round 1, fix 8). ---------- */
(function (root) {
  'use strict';
  var PROJECT = 'chess-coach-100'; /* FC-D38 */
  var base = {
    projectId: PROJECT,
    apiKey: 'AIzaSyDw3xbGs4PFvkQDwL2FjFFMUMKGV2o0vp0', /* FC-D38: the project's Web API key, limited to the Firebase APIs in use */
    region: 'asia-south1',
    authBase: 'https://identitytoolkit.googleapis.com',
    tokenBase: 'https://securetoken.googleapis.com',
    fnBase: 'https://asia-south1-' + PROJECT + '.cloudfunctions.net'
  };
  var testBuild = !!(root.CC_BUILD && root.CC_BUILD.test === true);
  var o = testBuild && root.FC_CONFIG && typeof root.FC_CONFIG === 'object' ? root.FC_CONFIG : {};
  Object.keys(o).forEach(function (k) { if (typeof o[k] === 'string') base[k] = o[k]; });
  root.FCONFIG = Object.freeze(base);
})(window);
