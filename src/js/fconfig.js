/* ---------- Friend challenges (slice FC3): where the friend server is. Loaded only inside the Android app (scripts/build.sh).
   Public client config, not a secret (FC-D20, tech spec section 4): Firebase API keys are inside every APK; safety comes from
   deny-all Firestore rules, the key's API allowlist, App Check (FC6) and the function's own checks.
   PLACEHOLDERS (FC-D24): the real project id and API key come from Suresh's Firebase project. Until they are filled in,
   fclient.js refuses every call (FClient.configured is false), so no build can reach a Firebase host by mistake.
   Tests set window.FC_CONFIG before any script runs; in a test build only (window.CC_BUILD.test, scripts/build.sh) its values
   replace these (tests/e2e/fc3.spec.js points at a fake host). A release build ignores it (FC3 fix round 1, fix 8). ---------- */
(function (root) {
  'use strict';
  var PROJECT = 'PLACEHOLDER-firebase-project-id'; /* FC-D24: Suresh fills this from the Firebase console (Project settings) */
  var base = {
    projectId: PROJECT,
    apiKey: 'PLACEHOLDER_FIREBASE_WEB_API_KEY', /* FC-D24: the project's Web API key, limited to the Firebase APIs in use */
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
