/* ---------- Ads (F3b): the banner's rules, its request options and the launch switch. Pure: no DOM, no plugin, no network,
   no storage. The glue that talks to the native ads plugin is in app.js (search "ADS GLUE"). Android app only: on the web
   nothing here is ever acted on (A-D9). Decisions: docs/specs/ads.product.md (A-D1 to A-D18). ---------- */
(function (root, factory) {
  var A = factory();
  if (typeof module === 'object' && module.exports) module.exports = A; else root.Ads = A;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  /* A-D8: THE LAUNCH SWITCH. While live is false every build asks for Google's sample ad only. Turning it on is a checkpoint
     (Suresh's yes), and the build fails unless the repository variable ADS_LIVE is set to yes (.github/workflows). */
  var CONFIG = Object.freeze({
    appId: 'ca-app-pub-1437334216467981~3972482016',
    unit: 'ca-app-pub-1437334216467981/6215501975',
    testUnit: 'ca-app-pub-3940256099942544/9214589741', /* Google's public Android sample banner (adaptive) */
    live: false
  });
  var MIN_HEIGHT = 500;  /* A-D4: no banner on a screen shorter than this (a phone held sideways) */
  var END_DELAY = 1000;  /* A-D15: an end card's banner comes this long after the card, in ms */
  var TAB_BAR = 56;      /* the fixed bottom tab bar on phones, in dp (DESIGN.md); the system bar below it is added natively */
  var POLICY_URL = 'https://hnchennai.github.io/privacy.html';
  var COPY = { policy: 'Privacy policy', choices: 'Privacy choices' }; /* all the new wording (spec) */

  /* THE BANNER RULE (criterion 1). s.slot is the tip slot's own answer for the screen the player is on (app.js slotAllowed
     for the place stripPlace names), so the banner can never show where the slot rule refuses a slot. The other facts can
     only take the banner away. Every fact must be known: a missing one means no banner.
     s: { slot, firstDay, activity, overlay, height, native } */
  function mayShow(s) {
    if (!s || typeof s !== 'object') return false;
    return s.slot === true && s.native === true && s.firstDay === false && s.activity === false && s.overlay === false &&
      typeof s.height === 'number' && s.height >= MIN_HEIGHT;
  }
  /* A-D11, A-D7: when the ads start-up (consent check, then the SDK) may begin. Never on the first day, never before a level
     is set, never during an activity or under a sheet. Until this says yes the app makes no plugin call at all.
     s: { native, firstDay, level, activity, overlay } */
  function mayStart(s) {
    if (!s || typeof s !== 'object') return false;
    return s.native === true && s.firstDay === false && !!s.level && s.activity === false && s.overlay === false;
  }
  function unitFor(live) { return live === true ? CONFIG.unit : CONFIG.testUnit; }
  /* A-D5: the SDK's start options. PG is the highest ad content rating. The names are the plugin's. */
  function initOptions() { return { maxAdContentRating: 'ParentalGuidance' }; }
  /* A-D5, A-D8, A-D16: one banner request. Always non-personalised (npa). The test unit unless the switch is on.
     o: { margin (dp above the bottom edge), live (tests only; the app passes none and gets CONFIG.live) } */
  function bannerOptions(o) {
    o = o || {};
    var live = (o.live === undefined ? CONFIG.live : o.live) === true, m = Math.round(+o.margin);
    return { adId: unitFor(live), adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: m > 0 ? m : 0, npa: true, isTesting: !live };
  }
  /* A-D16: above the tab bar when it is fixed to the bottom (phones), at the very bottom of the screen otherwise. */
  function marginFor(fixedTabs) { return fixedTabs ? TAB_BAR : 0; }
  /* A-D15: how long an end card's banner must still wait, in ms. since: when the card came on screen. Home and Progress
     do not wait. */
  function waitLeft(place, since, now) {
    if (place === 'home' || place === 'progress') return 0;
    var d = +now - +since;
    if (!(d >= 0)) return END_DELAY;
    return d >= END_DELAY ? 0 : END_DELAY - d;
  }
  /* A-D7: Google's answers (the plugin's consent info). */
  function needsForm(info) { return !!info && info.status === 'REQUIRED' && info.isConsentFormAvailable === true; }
  function canRequest(info) { return !!info && info.canRequestAds === true; }
  function hasChoice(info) { return !!info && info.privacyOptionsRequirementStatus === 'REQUIRED'; }

  return { CONFIG: CONFIG, MIN_HEIGHT: MIN_HEIGHT, END_DELAY: END_DELAY, TAB_BAR: TAB_BAR, POLICY_URL: POLICY_URL, COPY: COPY,
    mayShow: mayShow, mayStart: mayStart, unitFor: unitFor, initOptions: initOptions, bannerOptions: bannerOptions, marginFor: marginFor,
    waitLeft: waitLeft, needsForm: needsForm, canRequest: canRequest, hasChoice: hasChoice };
});
