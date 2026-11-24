/* ---------- Daily puzzle reminder and the Play rating ask (docs/specs/daily-puzzle.product.md, slice D2): DP-D3, DP-D4,
   DP-D7, DP-D8, DP-D13, DP-D15 and the signed wording. Pure: no DOM, no plugin, no clock (the app passes the time).
   The app (app.js) does the plugin calls, only inside the Android app; the web version never uses any of this. ---------- */
(function (root, factory) {
  var R = factory();
  if (typeof module === 'object' && module.exports) module.exports = R; else root.Remind = R;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  /* Signed wording (spec "Wording"), in the app's apostrophe style. */
  var TITLE = 'Your daily puzzle is ready', BODY = 'One puzzle, about a minute. Keep your streak going.';
  var OFFER = { line: 'Want me to remind you each evening?', yes: 'Yes, remind me', no: 'No thanks' };
  var SETTING = 'Daily puzzle reminder', DENIED = 'Notifications are off for Chess Coach. Turn them on in your phone’s settings.';
  /* Android notification channel (importance 3: default, makes a sound, no pop-over) */
  var CHANNEL = { id: 'daily', name: 'Daily puzzle reminder', importance: 3 };
  /* Device-only settings (notification permission is per phone, so never in prof and never cloud-synced) */
  var KEY = 'suresh-chess-coach.remind';
  /* DP-D13: every hour on the hour, 6 am to 10 pm; default 7 pm */
  var HOURS = [], DEFAULT_HOUR = 19, DAYS = 7, DAY_MS = 86400000, RATE_GAP = 60 * DAY_MS, RATE_DAYS = 3;
  for (var h = 6; h <= 22; h++) HOURS.push(h);

  function hourOk(h) { return typeof h === 'number' && HOURS.indexOf(h) > -1; }
  function label(h) { return (h % 12 || 12) + (h < 12 ? ' am' : ' pm'); }
  /* The app's day key (as Daily.key and prof.days): month 1-based, no padding */
  function dkey(d) { return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  /* A reminder's id: its local date as yyyymmdd. Stable for a day whatever the hour, unique, fits a Java int. */
  function id(d) { return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate(); }

  /* DP-D7: the reminders for the next 7 local days (today..today+6) at hour:00. Today is skipped when its daily puzzle is
     done or the time has passed. Dates are built from the calendar (new Date(y, m, d + i, hour)), never by adding hours,
     so a clock change never moves a reminder off the hour. */
  function plan(now, hour, todayDone) {
    if (!(now instanceof Date) || isNaN(now.getTime())) return [];
    var hr = hourOk(hour) ? hour : DEFAULT_HOUR, out = [];
    for (var i = 0; i < DAYS; i++) {
      var at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, hr, 0, 0, 0);
      if (i === 0 && (todayDone || at.getTime() <= now.getTime())) continue;
      out.push({ id: id(at), at: at, day: dkey(at) });
    }
    return out;
  }
  /* What LocalNotifications.schedule takes. DP-D15: inexact only, so no allowWhileIdle and nothing that repeats.
     isExactNotification false: the plugin's default (true) would open Android's "Alarms and reminders" screen when the app
     may not set exact alarms, which is always (the build removes SCHEDULE_EXACT_ALARM). */
  function notifications(list) {
    return (list || []).map(function (x) { return { id: x.id, title: TITLE, body: BODY, channelId: CHANNEL.id, isExactNotification: false, schedule: { at: x.at } }; });
  }

  /* DP-D4: days with any activity (a puzzle, a game or a lesson part, as the streak counts them) */
  function activeDays(days) {
    var n = 0;
    if (!days || typeof days !== 'object') return 0;
    Object.keys(days).forEach(function (k) { var r = days[k]; if (r && typeof r === 'object' && (r.puz || r.games || r.course)) n++; });
    return n;
  }
  /* DP-D4: from the 3rd active day, then at most once every 60 days */
  function shouldAsk(active, lastAskT, now) {
    if (!(active >= RATE_DAYS)) return false;
    var t = +lastAskT || 0;
    return !t || now - t >= RATE_GAP;
  }

  /* The device settings, from the raw stored string. Anything missing or broken reads as the default, field by field. */
  function read(raw) {
    var o = null;
    try { o = typeof raw === 'string' && raw ? JSON.parse(raw) : null; } catch (e) { o = null; }
    if (!o || typeof o !== 'object' || Array.isArray(o)) o = {};
    return { on: o.on === true, hour: hourOk(o.hour) ? o.hour : DEFAULT_HOUR, offered: o.offered === true, rateT: typeof o.rateT === 'number' && o.rateT > 0 && isFinite(o.rateT) ? o.rateT : 0 };
  }

  /* AC5, DP-D3: Rani's offer on the daily puzzle's end card: Android only, from the first finished daily, until answered */
  function offerShows(android, offered, n) { return !!android && !offered && (+n || 0) >= 1; }
  /* AC8, DP-D8: where a tapped reminder goes: today's puzzle while the card offers "Solve it", else Home */
  function tapTo(state) { return state === 'todo' ? 'daily' : 'home'; }

  return { TITLE: TITLE, BODY: BODY, OFFER: OFFER, SETTING: SETTING, DENIED: DENIED, CHANNEL: CHANNEL, KEY: KEY, HOURS: HOURS, DEFAULT_HOUR: DEFAULT_HOUR, RATE_GAP: RATE_GAP,
    label: label, id: id, plan: plan, notifications: notifications, activeDays: activeDays, shouldAsk: shouldAsk, read: read, offerShows: offerShows, tapTo: tapTo };
});
