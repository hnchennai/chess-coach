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
  var SHOW_DELAY = 1000; /* A-D15 and AdMob's accidental-tap rule: the banner comes this long after the screen that allows it, in ms */
  var TAB_BAR = 56;      /* the fixed bottom tab bar on phones, in dp (DESIGN.md); the system bar below it is added natively */
  var GAP = 8;           /* clear space between the banner and the tab bar on phones, in dp, so a tap on a tab cannot land on an ad */
  var POLICY_URL = 'https://hnchennai.github.io/privacy.html';
  var COPY = { policy: 'Privacy policy', choices: 'Privacy choices' }; /* all the new wording (spec) */

  /* THE BANNER RULE (criterion 1). s.slot is the tip slot's own answer for the screen the player is on (app.js slotAllowed
     for the place stripPlace names), so the banner can never show where the slot rule refuses a slot. The other facts can
     only take the banner away. Every fact must be known: a missing one means no banner.
     s: { slot, firstDay, activity, overlay, board, height, native }
     A-D19: board = the place is Home and the board is on screen (moved or not). Unknown fails closed. */
  function mayShow(s) {
    if (!s || typeof s !== 'object') return false;
    return s.slot === true && s.native === true && s.firstDay === false && s.activity === false && s.overlay === false && s.board === false &&
      typeof s.height === 'number' && s.height >= MIN_HEIGHT;
  }
  /* A-D11, A-D7: whether the consent check (Google is asked, nothing is shown) runs for this app session. It is asked once,
     at app start (boot), and never again: not on the first day and not before a level is set. A no means no plugin call at
     all until the next app start. An open game does not stop the check: it shows nothing. s: { boot, native, firstDay, level } */
  function mayStart(s) {
    if (!s || typeof s !== 'object') return false;
    return s.boot === true && s.native === true && s.firstDay === false && !!s.level;
  }
  /* A-D7: whether Google's consent form may open now, at the moment Google's answer arrives: only with no activity and no
     sheet, dialog or level check open. Both facts must be known. s: { activity, overlay } */
  function mayForm(s) { return !!s && typeof s === 'object' && s.activity === false && s.overlay === false; }
  function unitFor(on) { return on === true ? CONFIG.unit : CONFIG.testUnit; }
  /* A-D5: the SDK's start options. PG is the highest ad content rating. The names are the plugin's. */
  function initOptions() { return { maxAdContentRating: 'ParentalGuidance' }; }
  /* A-D5, A-D8, A-D16: one banner request. Always non-personalised (npa). The test unit unless the switch is on; the switch
     is read here and nowhere else, and no caller can override it. o: { margin (dp above the bottom edge) } */
  function bannerOptions(o) {
    var real = CONFIG.live === true, m = Math.round(+(o && o.margin));
    return { adId: unitFor(CONFIG.live), adSize: 'ADAPTIVE_BANNER', position: 'BOTTOM_CENTER', margin: m > 0 ? m : 0, npa: true, isTesting: !real };
  }
  /* A-D16: above the tab bar, with a small gap, when it is fixed to the bottom (phones); at the very bottom of the screen otherwise. */
  function marginFor(fixedTabs) { return fixedTabs ? TAB_BAR + GAP : 0; }
  /* A-D14: the page's bottom padding for a banner of the reported height: the banner, and on phones the gap under it. */
  function padFor(height, fixedTabs) { var h = Math.ceil(+height); return h > 0 ? h + (fixedTabs ? GAP : 0) : 0; }
  /* A-D15: how long the banner must still wait, in ms. since: when the screen or card that allows it was drawn, or when the
     sheet or note over it closed. It holds for every appearance: Home, Progress and end cards. */
  function waitLeft(since, now) {
    var d = +now - +since;
    if (!(d >= 0)) return SHOW_DELAY;
    return d >= SHOW_DELAY ? 0 : SHOW_DELAY - d;
  }
  /* A-D7: Google's answers (the plugin's consent info). */
  function needsForm(info) { return !!info && info.status === 'REQUIRED' && info.isConsentFormAvailable === true; }
  function canRequest(info) { return !!info && info.canRequestAds === true; }
  function hasChoice(info) { return !!info && info.privacyOptionsRequirementStatus === 'REQUIRED'; }

  /* TEST BUILDS ONLY: one line for Settings that says where the ads start-up stands and why there is no banner, so a phone
     test can be read without a cable. Nothing is shown once the launch switch is on.
     d: { state, banner, loaded, h, err, info, facts } (app.js ad state and the last facts the banner rule saw) */
  function debugLine(d) {
    if (CONFIG.live === true) return '';
    if (!d || typeof d !== 'object') return 'Ads test: no state';
    function yn(v) { return v === true ? 'yes' : v === false ? 'no' : 'unknown'; }
    var i = d.info, f = d.facts, e = String(d.err || '').slice(0, 200);
    return 'Ads test: state ' + (d.state || 'unknown') + '; banner ' + (d.banner || 'unknown') + '; ' + (d.loaded ? 'ad loaded (' + (+d.h || 0) + ')' : 'no ad loaded') +
      '; consent ' + (i ? (i.status || 'unknown') + ', can request ' + yn(i.canRequestAds) : 'unknown') +
      (f ? '; slot ' + yn(f.slot) + '; first day ' + yn(f.firstDay) + '; activity ' + yn(f.activity) + '; sheet ' + yn(f.overlay) + '; board ' + yn(f.board) + '; height ' + (+f.height || 0) : '') +
      '; ' + (e || 'no error');
  }

  return { CONFIG: CONFIG, MIN_HEIGHT: MIN_HEIGHT, SHOW_DELAY: SHOW_DELAY, TAB_BAR: TAB_BAR, GAP: GAP, POLICY_URL: POLICY_URL, COPY: COPY,
    mayShow: mayShow, mayStart: mayStart, mayForm: mayForm, unitFor: unitFor, initOptions: initOptions, bannerOptions: bannerOptions, marginFor: marginFor, padFor: padFor,
    waitLeft: waitLeft, debugLine: debugLine, needsForm: needsForm, canRequest: canRequest, hasChoice: hasChoice };
});
