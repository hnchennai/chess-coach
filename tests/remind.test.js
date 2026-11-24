// Unit tests for www/js/remind.js: the daily puzzle reminder and the Play rating ask (docs/specs/daily-puzzle.product.md,
// slice D2: DP-D3, DP-D4, DP-D7, DP-D8, DP-D13, DP-D15, wording, scenarios 5 to 8, acceptance criteria 5, 6, 8, 9).
// Run: node --test tests/remind.test.js   (after sh scripts/build.sh)
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../www/js/remind.js');

const DAY = 86400000;
const at = (y, m, d, h, mi) => new Date(y, m, d, h, mi || 0, 0, 0);
const stamp = (it) => [it.at.getFullYear(), it.at.getMonth() + 1, it.at.getDate(), it.at.getHours(), it.at.getMinutes(), it.at.getSeconds()].join('-');

test('DP-D13: hours 6 am to 10 pm on the hour (17 choices), default 7 pm', () => {
  assert.deepEqual(R.HOURS, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
  assert.equal(R.HOURS.length, 17);
  assert.equal(R.DEFAULT_HOUR, 19);
});

test('hour labels: "6 am", "12 pm", "7 pm", "10 pm"', () => {
  assert.equal(R.label(6), '6 am');
  assert.equal(R.label(11), '11 am');
  assert.equal(R.label(12), '12 pm');
  assert.equal(R.label(13), '1 pm');
  assert.equal(R.label(19), '7 pm');
  assert.equal(R.label(22), '10 pm');
  R.HOURS.forEach((h) => assert.ok(!/—/.test(R.label(h)), 'no em dash'));
});

test('DP-D7: today not done and before the hour: 7 reminders, today to today+6, each at hour:00 local', () => {
  const p = R.plan(at(2026, 10, 25, 8, 0), 19, false);
  assert.equal(p.length, 7);
  assert.deepEqual(p.map(stamp), ['2026-11-25-19-0-0', '2026-11-26-19-0-0', '2026-11-27-19-0-0', '2026-11-28-19-0-0', '2026-11-29-19-0-0', '2026-11-30-19-0-0', '2026-12-1-19-0-0']);
  assert.deepEqual(p.map((x) => x.day), ['2026-11-25', '2026-11-26', '2026-11-27', '2026-11-28', '2026-11-29', '2026-11-30', '2026-12-1'], 'day: the app’s day key');
  p.forEach((x) => assert.ok(x.at instanceof Date));
});

test('AC6, scenario 6: today already done: no reminder today, the next 6 days only', () => {
  const p = R.plan(at(2026, 10, 27, 8, 0), 19, true);
  assert.equal(p.length, 6);
  assert.equal(stamp(p[0]), '2026-11-28-19-0-0');
  assert.equal(stamp(p[5]), '2026-12-3-19-0-0', 'still inside today..today+6');
});

test('DP-D7: the hour has passed today: no reminder today; at the exact hour too', () => {
  assert.equal(R.plan(at(2026, 10, 25, 19, 30), 19, false).length, 6);
  assert.equal(stamp(R.plan(at(2026, 10, 25, 19, 30), 19, false)[0]), '2026-11-26-19-0-0');
  assert.equal(R.plan(at(2026, 10, 25, 19, 0), 19, false).length, 6, 'at 19:00:00 it is no longer ahead');
  assert.equal(R.plan(at(2026, 10, 25, 18, 59), 19, false).length, 7, 'a minute before: today still counts');
  assert.equal(R.plan(at(2026, 10, 25, 23, 0), 6, true).length, 6);
});

test('month and year rollover', () => {
  const p = R.plan(at(2026, 11, 29, 7, 0), 6, true); // 29 Dec, 6 am, done
  assert.deepEqual(p.map(stamp), ['2026-12-30-6-0-0', '2026-12-31-6-0-0', '2027-1-1-6-0-0', '2027-1-2-6-0-0', '2027-1-3-6-0-0', '2027-1-4-6-0-0']);
  const f = R.plan(at(2028, 1, 27, 9, 0), 22, false); // leap year: 27 Feb 2028
  assert.deepEqual(f.map((x) => x.day), ['2028-2-27', '2028-2-28', '2028-2-29', '2028-3-1', '2028-3-2', '2028-3-3', '2028-3-4']);
});

test('IDs: yyyymmdd numbers, unique, stable between runs, int32-safe', () => {
  const a = R.plan(at(2026, 10, 25, 8, 0), 19, false), b = R.plan(at(2026, 10, 25, 12, 0), 7, true);
  assert.deepEqual(a.map((x) => x.id), [20261125, 20261126, 20261127, 20261128, 20261129, 20261130, 20261201]);
  assert.equal(new Set(a.map((x) => x.id)).size, 7, 'unique');
  assert.deepEqual(b.map((x) => x.id), a.slice(1).map((x) => x.id), 'the same day keeps the same id, whatever the hour or the start');
  a.forEach((x) => { assert.ok(Number.isInteger(x.id)); assert.ok(x.id > 0 && x.id <= 2147483647, 'fits a Java int'); });
  assert.equal(R.id(at(2099, 11, 31, 22)), 20991231);
});

test('DST-safe: every reminder is at hour:00 local time, also across a clock change', () => {
  // Whatever time zone the test runs in, local dates are built with new Date(y, m, d, hour): never "+ 24 hours".
  for (const [y, m, d] of [[2026, 2, 26], [2026, 9, 23], [2026, 2, 6], [2026, 10, 1]]) { // late March, late October, early March, early November
    const p = R.plan(at(y, m, d, 5, 0), 19, false);
    assert.equal(p.length, 7);
    p.forEach((x, i) => {
      assert.equal(x.at.getHours(), 19); assert.equal(x.at.getMinutes(), 0);
      const want = new Date(y, m, d + i); assert.equal(x.at.getDate(), want.getDate(), 'one per calendar day');
    });
  }
});

test('plan: a broken hour falls back to 7 pm; a bad date gives nothing', () => {
  assert.equal(R.plan(at(2026, 10, 25, 8), 'x', false)[0].at.getHours(), 19);
  assert.equal(R.plan(at(2026, 10, 25, 8), 3, false)[0].at.getHours(), 19, 'outside 6..22');
  assert.equal(R.plan(at(2026, 10, 25, 8), 6.5, false)[0].at.getHours(), 19);
  assert.deepEqual(R.plan(new Date(NaN), 19, false), []);
});

test('DP-D4 shouldAsk: from the 3rd active day; then at most once every 60 days', () => {
  const now = Date.UTC(2026, 10, 24, 12);
  assert.equal(R.shouldAsk(2, 0, now), false, '2 active days: no');
  assert.equal(R.shouldAsk(3, 0, now), true, '3 active days, never asked: yes');
  assert.equal(R.shouldAsk(30, 0, now), true);
  assert.equal(R.shouldAsk(3, now - 59 * DAY, now), false, '59 days after the last ask: no');
  assert.equal(R.shouldAsk(3, now - 60 * DAY, now), true, '60 days: yes');
  assert.equal(R.shouldAsk(3, now - 60 * DAY + 1, now), false, 'a moment short of 60 days: no');
  assert.equal(R.shouldAsk(3, now, now), false, 'the same day: no second ask');
  assert.equal(R.shouldAsk(2, now - 90 * DAY, now), false, 'never with fewer than 3 days');
  assert.equal(R.shouldAsk(NaN, 0, now), false);
});

test('activeDays: days with a puzzle, a game or a lesson part (as streakDays), today included', () => {
  assert.equal(R.activeDays(null), 0);
  assert.equal(R.activeDays({}), 0);
  const days = { '2026-11-20': { puz: 1, games: 0, course: 0, solved: 0 }, '2026-11-21': { puz: 0, games: 0, course: 0, solved: 0 }, '2026-11-22': { puz: 0, games: 1, course: 0, solved: 0 }, '2026-11-24': { puz: 0, games: 0, course: 1, solved: 0 } };
  assert.equal(R.activeDays(days), 3, 'scenario 8: 20, 22 and 24 Nov; the empty 21st does not count');
  assert.equal(R.activeDays({ a: null, b: 'x', c: { solved: 3 } }), 0, 'broken or empty entries never count');
});

test('settings: a missing or broken value reads as off, 7 pm, not offered, never asked', () => {
  const D = { on: false, hour: 19, offered: false, rateT: 0 };
  for (const raw of [null, undefined, '', 'nope', '{', '42', 'null', '[]', '"x"']) assert.deepEqual(R.read(raw), D, String(raw));
  assert.deepEqual(R.read(JSON.stringify({ on: true, hour: 8, offered: true, rateT: 123 })), { on: true, hour: 8, offered: true, rateT: 123 });
  assert.deepEqual(R.read(JSON.stringify({ on: 'yes', hour: 25, offered: 1, rateT: -5 })), D, 'every field checked on its own');
  assert.deepEqual(R.read(JSON.stringify({ on: true, hour: 6.5 })), { on: true, hour: 19, offered: false, rateT: 0 });
  assert.equal(R.KEY, 'suresh-chess-coach.remind', 'the constitution’s key prefix');
});

test('AC5: the offer shows only on Android, only from the first finished daily, only until it is answered', () => {
  assert.equal(R.offerShows(true, false, 1), true);
  assert.equal(R.offerShows(true, false, 5), true, 'a player who already had daily puzzles before D2');
  assert.equal(R.offerShows(true, false, 0), false, 'before the first daily is finished');
  assert.equal(R.offerShows(true, true, 1), false, 'answered: never again');
  assert.equal(R.offerShows(false, false, 1), false, 'the web: never');
});

test('AC8: tapping a reminder opens today’s daily puzzle when the card offers Solve it, else Home', () => {
  assert.equal(R.tapTo('todo'), 'daily');
  assert.equal(R.tapTo('solved'), 'home');
  assert.equal(R.tapTo('missed'), 'home');
  assert.equal(R.tapTo(undefined), 'home');
});

test('wording, as signed, with no em dash', () => {
  assert.equal(R.TITLE, 'Your daily puzzle is ready');
  assert.equal(R.BODY, 'One puzzle, about a minute. Keep your streak going.');
  assert.deepEqual(R.OFFER, { line: 'Want me to remind you each evening?', yes: 'Yes, remind me', no: 'No thanks' });
  assert.equal(R.SETTING, 'Daily puzzle reminder');
  assert.equal(R.DENIED, 'Notifications are off for Chess Coach. Turn them on in your phone’s settings.');
  [R.TITLE, R.BODY, R.OFFER.line, R.OFFER.yes, R.OFFER.no, R.SETTING, R.DENIED].forEach((s) => assert.ok(!/—/.test(s)));
});

test('notifications: the channel and each reminder ask for nothing exact (DP-D15)', () => {
  const p = R.plan(at(2026, 10, 25, 8, 0), 19, false), n = R.notifications(p);
  assert.equal(n.length, 7);
  n.forEach((x, i) => {
    assert.equal(x.id, p[i].id); assert.equal(x.title, R.TITLE); assert.equal(x.body, R.BODY); assert.equal(x.channelId, 'daily');
    assert.equal(x.schedule.at.getTime(), p[i].at.getTime());
    assert.ok(!('allowWhileIdle' in x.schedule) && !('allowWhileIdle' in x), 'never allowWhileIdle');
    assert.equal(x.isExactNotification, false, 'inexact outright: the plugin otherwise opens Android’s "Alarms and reminders" screen');
    assert.ok(!('isExactMandatory' in x));
    assert.ok(!('repeats' in x.schedule) && !('every' in x.schedule), 'one-off reminders');
  });
  assert.deepEqual(R.CHANNEL, { id: 'daily', name: 'Daily puzzle reminder', importance: 3 });
});
