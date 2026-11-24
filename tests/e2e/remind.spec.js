// E2E for slice D2 of the daily puzzle (docs/specs/daily-puzzle.product.md): the daily puzzle reminder and the Play rating ask.
// DP-D3, DP-D4, DP-D7, DP-D8, DP-D13, DP-D15, the wording, scenarios 5 to 9, acceptance criteria 5 to 9 and 11.
// The Android plugins are replaced by a fake window.Capacitor (isNativePlatform true, getPlatform 'android') with
// LocalNotifications, InAppReview and App, which records every call. The last case has no Capacitor at all: the web version.
// Run: DP_VP=412 node tests/e2e/remind.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// DP_VP: 360 | 412 | 1280. DP_ONLY=<regex> runs matching cases. Built on the helpers of g2.spec.js.
// Not checked here (no phone): real notifications, Android's permission question, Google's rating sheet, the Android build.
const assert = require('assert/strict');
const G = require('./g2.spec.js');
const { newPage, st, goTab, solvePuzzle, finishLesson, improver, prof, done, game, PH, PKEY, MATE1 } = G;

const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }].filter((v) => !process.env.DP_VP || String(v.width) === process.env.DP_VP);
const ONLY = process.env.DP_ONLY ? new RegExp(process.env.DP_ONLY) : null;
const RKEY = 'suresh-chess-coach.remind';
const DAYMS = 86400000;
// The signed wording, letter for letter (the app's apostrophe).
const W = { title: 'Your daily puzzle is ready', body: 'One puzzle, about a minute. Keep your streak going.', offer: 'Want me to remind you each evening?', yes: 'Yes, remind me', no: 'No thanks',
  setting: 'Daily puzzle reminder', denied: 'Notifications are off for Chess Coach. Turn them on in your phone’s settings.', solved: 'Solved. A new one tomorrow.' };
const HOURS = ['6 am', '7 am', '8 am', '9 am', '10 am', '11 am', '12 pm', '1 pm', '2 pm', '3 pm', '4 pm', '5 pm', '6 pm', '7 pm', '8 pm', '9 pm', '10 pm'];

// A fixed local time: 2026-11-<d> h:m:s. The profile's days are keyed to it.
const at = (d, h, m, s) => new Date(2026, 10, d, h, m || 0, s || 0).getTime();
const K = (d) => '2026-11-' + d;
const active = (...ds) => Object.fromEntries(ds.map((d) => [K(d), { puz: 1, games: 0, course: 0, solved: 1 }]));
const T10 = at(25, 10, 0); // 25 Nov, 10 am: today's 7 pm is still ahead

// The fake native plugins. cfg: perm (what checkPermissions says: 'granted' | 'denied' | 'prompt'), reqTo (what Android's
// question ends in), coldTap (a tapped reminder launched the app: handed over when the listener is added), reviewFails,
// pending (ids of reminders already set by an earlier run of the app).
function fakeNative(cfg) {
  const C = cfg || {};
  const N = window.__rm = { calls: [], pending: (C.pending || []).map((id) => ({ id, title: 'old' })), ls: {}, perm: C.perm || 'prompt', reqTo: C.reqTo || 'granted' };
  const now = () => { const c = window.__coach, s = c && c.st; return s ? { mode: s.mode, ses: s.ses ? { finished: !!s.ses.finished, end: !!s.ses.end, daily: !!(s.ses.opts && s.ses.opts.daily) } : null, tab: s.tab } : null; };
  const rec = (m, a) => { N.calls.push({ m, a: a === undefined ? null : a, t: Date.now(), at: now() }); };
  const note = (n) => { const d = n.schedule && n.schedule.at; return { id: n.id, title: n.title, body: n.body, channelId: n.channelId, isExactNotification: n.isExactNotification, keys: Object.keys(n).sort(), skeys: Object.keys(n.schedule || {}).sort(),
    allowWhileIdle: n.schedule.allowWhileIdle, date: d instanceof Date, h: d.getHours(), mi: d.getMinutes(), s: d.getSeconds(), day: d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate() }; };
  const fire = (name, d) => (N.ls[name] || []).slice().forEach((f) => f(d));
  const LocalNotifications = {
    checkPermissions() { rec('checkPermissions'); return Promise.resolve({ display: N.perm }); },
    requestPermissions() { rec('requestPermissions'); N.perm = N.reqTo; return Promise.resolve({ display: N.perm }); },
    createChannel(o) { rec('createChannel', JSON.parse(JSON.stringify(o))); return Promise.resolve(); },
    getPending() { rec('getPending'); return Promise.resolve({ notifications: N.pending.map((n) => ({ id: n.id, title: n.title })) }); },
    removeDeliveredNotifications(o) { rec('removeDeliveredNotifications', (o.notifications || []).map((n) => n.id)); return Promise.resolve(); },
    cancel(o) { const ids = (o.notifications || []).map((n) => n.id); rec('cancel', ids); N.pending = N.pending.filter((n) => !ids.includes(n.id)); return Promise.resolve(); },
    schedule(o) {
      const list = o.notifications.map(note); rec('schedule', list);
      if (N.perm !== 'granted') return Promise.reject(new Error('Notifications not enabled'));
      list.forEach((n) => { N.pending = N.pending.filter((p) => p.id !== n.id).concat([n]); });
      return Promise.resolve({ notifications: list.map((n) => ({ id: n.id })) });
    },
    addListener(name, f) {
      rec('addListener', name); (N.ls[name] = N.ls[name] || []).push(f);
      if (name === 'localNotificationActionPerformed' && C.coldTap) setTimeout(() => f({ actionId: 'tap', notification: { id: 20261125 } }), 0);
      return Promise.resolve({ remove() {} });
    }
  };
  const InAppReview = { requestReview() { rec('requestReview'); return C.reviewFails ? Promise.reject(new Error('no Play Store')) : Promise.resolve(); } };
  const App = { addListener(name, f) { (N.ls['app:' + name] = N.ls['app:' + name] || []).push(f); return Promise.resolve({ remove() {} }); }, minimizeApp() { return Promise.resolve(); } };
  N.tap = () => fire('localNotificationActionPerformed', { actionId: 'tap', notification: { id: 1 } });
  N.resume = () => fire('app:resume', { isActive: true });
  window.Capacitor = { isNativePlatform: () => true, getPlatform: () => 'android', Plugins: { LocalNotifications, InAppReview, App } };
}
// o: { native (fake config, or false for the web), remind (the device setting, as stored), clock, game, tab }
async function open(vp, p, o) {
  o = o || {};
  const ls = {}; if (o.remind !== undefined) ls[RKEY] = typeof o.remind === 'string' ? o.remind : JSON.stringify(o.remind);
  const page = await newPage(vp, p, { clock: o.clock == null ? T10 : o.clock, ls, game: o.game, tab: o.tab, init: o.native === false ? undefined : [fakeNative, o.native || {}] });
  if (o.native !== false) await settle(page);
  return page;
}
const calls = (page, m) => page.evaluate((x) => window.__rm.calls.filter((c) => !x || c.m === x), m);
const pending = (page) => page.evaluate(() => window.__rm.pending.map((n) => n.id).sort());
const stored = (page) => page.evaluate((k) => { const r = localStorage.getItem(k); return r == null ? null : JSON.parse(r); }, RKEY);
const profNow = (page) => page.evaluate(() => JSON.parse(JSON.stringify(window.__coach.getProf())));
// The reminder work is a chain of promises: wait until nothing new has been called for a moment.
async function settle(page) {
  let n = -1;
  if (!(await page.evaluate(() => !!window.__rm))) return; // the web: no fake plugins
  for (let i = 0; i < 40; i++) { const k = await page.evaluate(() => window.__rm.calls.length); if (k === n) return; n = k; await page.waitForTimeout(150); }
}
const lastSchedule = async (page) => { const s = await calls(page, 'schedule'); return s.length ? s[s.length - 1].a : null; };
const ids = (from, n) => { const out = []; const d = new Date(2026, 10, from); for (let i = 0; i < n; i++) { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate() + i); out.push(x.getFullYear() * 10000 + (x.getMonth() + 1) * 100 + x.getDate()); } return out; };
// Every reminder as signed: the title, the text, the channel, inexact, at hh:00 on its own day.
function checkList(list, first, n, hour, msg) {
  assert.deepEqual(list.map((x) => x.id), ids(first, n), msg + ': ids, one per day, from the ' + first + 'th');
  list.forEach((x) => {
    assert.equal(x.title, W.title, msg); assert.equal(x.body, W.body, msg); assert.equal(x.channelId, 'daily', msg);
    assert.equal(x.isExactNotification, false, msg + ': inexact (DP-D15)');
    assert.equal(x.allowWhileIdle, true, msg + ': wakes an idle phone (fix 1)'); assert.ok(!x.keys.includes('allowWhileIdle'), msg);
    assert.deepEqual(x.skeys, ['allowWhileIdle', 'at'], msg + ': a one-off time, nothing that repeats');
    assert.equal(x.date, true); assert.deepEqual([x.h, x.mi, x.s], [hour, 0, 0], msg + ': on the hour');
    const [y, m, d] = x.day.split('-').map(Number);
    assert.equal(x.id, y * 10000 + m * 100 + d, msg + ': the id is its own day');
  });
}

// The daily puzzle, from Home's card to its end card.
async function solveDaily(page, wrong) {
  if ((await st(page, 'tab')) !== 'coach') await goTab(page, 'coach');
  await page.locator('#dailyCard [data-act="daily"]').click();
  await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && s.opts && s.opts.daily && window.__coach.st.pz; });
  if (wrong) {
    await page.waitForFunction(() => { const z = window.__coach.st.pz; return z && !z.wait && !window.__coach.st.busy; });
    await page.locator('#board .sq[data-sq="b1"]').click(); await page.locator('#board .sq[data-sq="a1"]').click(); // m0: gives the win away
    await page.waitForFunction(() => { const z = window.__coach.st.pz; return z && z.done; }, null, { timeout: 30000 });
  } else await solvePuzzle(page);
}
async function toEnd(page) {
  await page.locator('#sessionCard [data-act="next"]').click();
  await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.ses.finished);
}
// Rani's offer on the end card, as the player sees it (null when it is not there).
const offer = (page) => page.evaluate(() => {
  const el = document.querySelector('#sessionCard .rm-offer'), on = (e) => !!e && e.getClientRects().length > 0; if (!on(el)) return null;
  const r = el.getBoundingClientRect(), b = document.getElementById('board'), br = on(b) ? b.getBoundingClientRect() : null, bs = [...el.querySelectorAll('button')].filter(on);
  const c = document.getElementById('sessionCard'), tx = (q) => { const e = c.querySelector(q); return on(e) ? e.textContent.trim() : null; };
  return { line: el.querySelector('p').textContent, buttons: bs.map((x) => x.textContent), types: bs.map((x) => x.getAttribute('type')), primary: bs.some((x) => x.classList.contains('primary')),
    minH: Math.min(...bs.map((x) => x.getBoundingClientRect().height)), left: r.left, right: r.right, top: r.top, bottom: r.bottom, vw: window.innerWidth, scrollW: document.documentElement.scrollWidth,
    overBoard: !!br && !(r.bottom <= br.top || r.top >= br.bottom || r.right <= br.left || r.left >= br.right), text: el.innerText,
    main: tx('.ec-main'), smalls: [...c.querySelectorAll('.ec-small')].filter(on).map((x) => x.textContent.trim()), endText: tx('.ec-text') };
});
// The Settings row, as the player sees it.
async function settings(page) {
  await page.evaluate(() => window.__coach.openSettings());
  await page.waitForFunction(() => !document.getElementById('settingsSheet').hidden);
  await settle(page);
  return page.evaluate(() => {
    const box = document.getElementById('remindSet'), on = (e) => !!e && e.getClientRects().length > 0;
    if (!on(box)) return { shown: false, html: box ? box.innerHTML : null };
    const sw = box.querySelector('[role="switch"]'), sel = box.querySelector('select'), off = box.querySelector('.rm-off'), r = box.getBoundingClientRect();
    return { shown: true, title: sw.querySelector('b').textContent, checked: sw.getAttribute('aria-checked'), swH: sw.getBoundingClientRect().height, selH: sel.getBoundingClientRect().height,
      value: sel.value, label: sel.options[sel.selectedIndex].textContent, options: [...sel.options].map((x) => x.textContent), values: [...sel.options].map((x) => +x.value),
      selLabel: sel.labels && sel.labels.length ? sel.labels[0].textContent : null, selOn: on(sel.labels && sel.labels[0]), disabled: sel.disabled,
      name: box.getAttribute('aria-labelledby') ? box.getAttribute('aria-labelledby').split(' ').map((i) => document.getElementById(i).textContent).join(' ') : box.getAttribute('aria-label'),
      off: on(off) ? off.textContent : null, right: r.right, vw: window.innerWidth, text: box.innerText };
  });
}
const closeSettings = (page) => page.locator('[data-act="settingsclose"]').click();
const noReview = async (page, ms, msg) => { await page.waitForTimeout(ms); assert.equal((await calls(page, 'requestReview')).length, 0, msg); };

const cases = [
  // ---------- AC5, scenario 5 (yes, allowed), DP-D3, AC6, AC11 ----------
  ['AC5, scenario 5: after the first daily puzzle Rani offers the reminder; Yes and allowed sets 7 pm for the next days (today is done)', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: active(24) }), { native: { perm: 'prompt', reqTo: 'granted' } });
    assert.deepEqual((await calls(page, 'schedule')).length + (await calls(page, 'requestPermissions')).length, 0, 'off by default: nothing set, nothing asked at start');
    assert.equal((await calls(page, 'addListener')).map((c) => c.a).includes('localNotificationActionPerformed'), true, 'the tap listener is there from start-up');
    await solveDaily(page); await toEnd(page);
    const o = await offer(page);
    assert.ok(o, 'the offer is on the daily puzzle’s end card');
    assert.equal(o.line, W.offer); assert.deepEqual(o.buttons, [W.yes, W.no]); assert.deepEqual(o.types, ['button', 'button']);
    assert.equal(o.primary, false, 'the end card keeps its one main button');
    assert.equal(o.main, '10 more puzzles', 'DP-D11 buttons stay'); assert.deepEqual(o.smalls, ['Home']); assert.equal(o.endText, W.solved);
    assert.ok(o.minH >= 44, 'thumb-sized buttons (' + o.minH + ')');
    assert.ok(o.left >= 0 && o.right <= o.vw && o.scrollW <= o.vw, 'inside the screen, no sideways scroll at ' + vp.width);
    assert.equal(o.overBoard, false, 'never over the board');
    assert.ok(!/—/.test(o.text), 'no em dash');
    assert.equal((await calls(page, 'requestReview')).length, 0, 'no rating ask under the offer (2 active days anyway)');
    await page.locator('#sessionCard [data-act="rmyes"]').click();
    await settle(page);
    assert.equal(await offer(page), null, 'answered: the offer goes');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.classList.contains('ec-main')), true, 'focus goes to the main button');
    assert.equal((await calls(page, 'requestPermissions')).length, 1, 'Android is asked for permission');
    assert.deepEqual((await calls(page, 'createChannel')).map((c) => c.a), [{ id: 'daily', name: 'Daily puzzle reminder', importance: 3 }], 'one channel');
    checkList(await lastSchedule(page), 26, 6, 19, 'today is done: 26 Nov to 1 Dec at 7 pm');
    assert.deepEqual(await pending(page), ids(26, 6));
    assert.deepEqual(await stored(page), { on: true, hour: 19, offered: true, rateT: 0 });
    const s = await settings(page);
    assert.deepEqual([s.shown, s.checked, s.value, s.label, s.off], [true, 'true', '19', '7 pm', null], 'Settings: on, 7 pm, no warning');
    await closeSettings(page);
    await page.locator('#sessionCard .ec-main').click();
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && s.rated && !s.finished; });
    return page;
  }],
  ['AC5: No thanks asks nothing and sets nothing; Rani never asks again on this phone (next day’s daily puzzle)', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: active(24) }), { native: { perm: 'prompt' } });
    await solveDaily(page); await toEnd(page);
    assert.ok(await offer(page));
    await page.locator('#sessionCard [data-act="rmno"]').click();
    await settle(page);
    assert.equal(await offer(page), null);
    assert.equal((await calls(page, 'requestPermissions')).length + (await calls(page, 'schedule')).length, 0, 'no permission question, no reminder');
    assert.deepEqual(await stored(page), { on: false, hour: 19, offered: true, rateT: 0 });
    const s = await settings(page);
    assert.deepEqual([s.checked, s.off], ['false', null], 'Settings: off, no warning');
    await closeSettings(page);
    await page.locator('#sessionCard [data-act="home"]').click();
    await page.clock.setSystemTime(at(26, 10, 0));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => window.__coach.getProf().daily.d === '2026-11-26');
    await solveDaily(page); await toEnd(page);
    assert.equal((await profNow(page)).daily.n, 2);
    assert.equal(await offer(page), null, 'the second daily puzzle: no offer');
    return page;
  }],
  ['AC5: no offer before a daily puzzle is finished, nor on another end card; a player with earlier daily puzzles gets it on the next one', async (vp) => {
    let page = await open(vp, improver({ rating: 1100, days: active(24), unlockAll: true }), { native: {} });
    await goTab(page, 'train'); await page.locator('#ratedBtn').click();
    await page.waitForFunction(() => window.__coach.st.ses && window.__coach.st.pz);
    for (let i = 0; i < 10; i++) {
      await solvePuzzle(page);
      await page.locator('#sessionCard [data-act="next"]').click();
      await page.waitForFunction((k) => { const s = window.__coach.st.ses; return s.finished || s.i > k; }, i);
      if (await page.evaluate(() => window.__coach.st.ses.finished)) break;
    }
    assert.equal(await page.locator('#sessionCard .rm-offer').count(), 0, 'a rated set’s end card: no offer');
    await page.context().close();
    page = await open(vp, improver({ rating: 1100, days: active(24), daily: { d: K(24), id: 'm0', r: 'missed', n: 4 } }), { native: {} });
    await solveDaily(page); await toEnd(page);
    assert.ok(await offer(page), 'from the first finished daily on: shown on the next one');
    return page;
  }],
  // ---------- scenario 5 (denied), AC7 ----------
  ['Scenario 5, AC7: Yes but Android says no: the reminder stays off and Settings says notifications are off', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: active(24) }), { native: { perm: 'prompt', reqTo: 'denied' } });
    await solveDaily(page); await toEnd(page);
    await page.locator('#sessionCard [data-act="rmyes"]').click();
    await settle(page);
    assert.equal((await calls(page, 'requestPermissions')).length, 1);
    assert.equal((await calls(page, 'schedule')).length, 0, 'nothing set');
    assert.deepEqual(await stored(page), { on: false, hour: 19, offered: true, rateT: 0 });
    assert.equal(await offer(page), null, 'answered: never again');
    const s = await settings(page);
    assert.equal(s.checked, 'false', 'the switch shows off');
    assert.equal(s.off, W.denied, 'the phone-settings line');
    assert.ok(!/—/.test(s.text));
    return page;
  }],
  ['AC7, DP-D13: the Settings switch sets 7 days at 7 pm; a new time sets them again; off cancels all', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: active(24) }), { native: { perm: 'granted' }, remind: { offered: true } });
    assert.equal((await calls(page, 'schedule')).length, 0, 'off: nothing set at start');
    let s = await settings(page);
    assert.equal(s.shown, true);
    assert.equal(s.title, W.setting); assert.equal(s.name, W.setting, 'fix 7: the section has a name, like the other Settings sections');
    assert.deepEqual([s.selLabel, s.selOn], ['Time', true], 'fix 7: the time choice has a visible label');
    assert.equal(s.disabled, true, 'fix 7: no time choice while the reminder is off');
    assert.deepEqual(s.options, HOURS, '17 choices, 6 am to 10 pm'); assert.deepEqual(s.values, [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]);
    assert.deepEqual([s.checked, s.value, s.label, s.off], ['false', '19', '7 pm', null]);
    assert.ok(s.swH >= 43.5 && s.selH >= 43.5, 'thumb-sized (' + s.swH + ', ' + s.selH + ')'); assert.ok(s.right <= s.vw, 'inside the screen');
    await page.locator('#remindSw').click(); await settle(page);
    assert.equal((await calls(page, 'requestPermissions')).length, 0, 'already allowed: no question');
    checkList(await lastSchedule(page), 25, 7, 19, 'not done yet and before 7 pm: today and 6 more days');
    assert.deepEqual(await pending(page), ids(25, 7));
    assert.deepEqual([(await settings(page)).checked, (await settings(page)).disabled], ['true', false], 'on: the time can be chosen');
    let n = (await calls(page, 'schedule')).length;
    await page.locator('#remindHour').selectOption('20'); await settle(page);
    assert.equal((await calls(page, 'schedule')).length, n + 1);
    assert.deepEqual((await calls(page, 'cancel')).pop().a.sort(), ids(25, 7), 'the old ones are cancelled first');
    checkList(await lastSchedule(page), 25, 7, 20, '8 pm');
    assert.deepEqual(await pending(page), ids(25, 7));
    await page.locator('#remindHour').selectOption('6'); await settle(page);
    checkList(await lastSchedule(page), 26, 6, 6, '6 am has passed today: from tomorrow');
    assert.deepEqual((await stored(page)).hour, 6);
    n = (await calls(page, 'schedule')).length;
    await page.locator('#remindSw').click(); await settle(page);
    assert.equal((await calls(page, 'schedule')).length, n, 'off: nothing new');
    assert.deepEqual(await pending(page), [], 'AC7: off cancels every reminder');
    assert.deepEqual(await stored(page), { on: false, hour: 6, offered: true, rateT: 0 });
    s = await settings(page);
    assert.deepEqual([s.checked, s.label, s.disabled], ['false', '6 am', true], 'the time is kept');
    return page;
  }],
  ['AC7: turning the switch on when Android says no leaves it off with the line; on in storage but blocked shows the line too', async (vp) => {
    let page = await open(vp, improver({ rating: 1100, days: active(24) }), { native: { perm: 'prompt', reqTo: 'denied' }, remind: { offered: true } });
    let s = await settings(page); assert.equal(s.off, null, 'not asked yet: no line');
    await page.locator('#remindSw').click(); await settle(page);
    assert.equal((await calls(page, 'requestPermissions')).length, 1);
    s = await settings(page);
    assert.deepEqual([s.checked, s.off], ['false', W.denied], 'back off, with the line');
    assert.equal((await calls(page, 'schedule')).length, 0);
    await page.context().close();
    page = await open(vp, improver({ rating: 1100, days: active(24) }), { native: { perm: 'denied' }, remind: { on: true, offered: true } });
    assert.equal((await calls(page, 'schedule')).length, 0, 'blocked: nothing set');
    s = await settings(page);
    assert.deepEqual([s.checked, s.off], ['true', W.denied], 'on, but Android blocks it: the line');
    return page;
  }],
  // ---------- AC6, DP-D7, scenario 6 and 7 ----------
  ['AC6, scenario 6: with the reminder on, the app sets 7 days at start; solving today’s puzzle takes today’s reminder away; resume sets them again', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: active(24) }), { native: { perm: 'granted' }, remind: { on: true, offered: true, hour: 19 } });
    checkList(await lastSchedule(page), 25, 7, 19, 'start-up');
    assert.deepEqual(await pending(page), ids(25, 7));
    await solveDaily(page); await settle(page);
    checkList(await lastSchedule(page), 26, 6, 19, 'today is done');
    assert.deepEqual(await pending(page), ids(26, 6), 'today’s reminder is gone');
    assert.deepEqual((await calls(page, 'removeDeliveredNotifications')).map((c) => c.a), [[20261125]], 'fix 2: one already on the screen is taken away too');
    await toEnd(page);
    assert.equal(await offer(page), null, 'already answered: no offer');
    const n = (await calls(page, 'schedule')).length;
    await page.evaluate(() => window.__rm.resume()); await settle(page);
    assert.equal((await calls(page, 'schedule')).length, n + 1, 'App resume sets them again');
    checkList(await lastSchedule(page), 26, 6, 19, 'resume');
    return page;
  }],
  ['DP-D7: at local midnight the next 7 days are set again', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: active(24), daily: { d: K(25), id: 'm0', r: 'solved', n: 1 } }), { native: { perm: 'granted' }, remind: { on: true, offered: true, hour: 21 }, clock: at(25, 23, 59, 30) });
    checkList(await lastSchedule(page), 26, 6, 21, 'before midnight, today done');
    await page.clock.runFor(40000); await settle(page);
    checkList(await lastSchedule(page), 26, 7, 21, 'after midnight: 26 Nov to 2 Dec');
    assert.deepEqual(await pending(page), ids(26, 7));
    return page;
  }],
  // ---------- AC8, DP-D8 ----------
  ['AC8, DP-D8: a tapped reminder opens today’s daily puzzle; Home once it is done; also when the tap starts the app', async (vp) => {
    let page = await open(vp, improver({ rating: 1100, days: active(24) }), { native: { perm: 'granted' }, remind: { on: true, offered: true }, tab: 'progress' });
    await page.evaluate(() => window.__rm.tap());
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && s.opts && s.opts.daily && window.__coach.st.pz; });
    assert.equal(await st(page, 'tab'), 'train');
    if (PH(vp)) assert.equal(await st(page, 'scr'), 'act', 'phones: straight onto the board screen');
    await page.context().close();
    page = await open(vp, improver({ rating: 1100, days: active(24), daily: { d: K(25), id: 'm0', r: 'solved', n: 1 }, unlockAll: true }), { native: { perm: 'granted' }, remind: { on: true, offered: true }, tab: 'progress' });
    await page.evaluate(() => window.__rm.tap());
    await page.waitForFunction(() => window.__coach.st.tab === 'coach');
    assert.equal(await st(page, 'ses'), null, 'done today: Home, nothing started');
    await page.context().close();
    page = await open(vp, improver({ rating: 1100, days: active(24) }), { native: { perm: 'granted', coldTap: true }, remind: { on: true, offered: true }, tab: 'progress' });
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && s.opts && s.opts.daily && window.__coach.st.pz; });
    assert.equal(await st(page, 'tab'), 'train', 'a cold start opens the daily puzzle');
    return page;
  }],
  // ---------- AC9, DP-D4, scenario 8 ----------
  ['AC9, scenario 8: on the 3rd active day Google’s sheet is asked for right after the solved daily’s end card, once; a won game later that day asks nothing', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: Object.assign(active(20), active(22)), games: [] }), { native: {}, remind: { offered: true }, game: MATE1 });
    await solveDaily(page);
    await noReview(page, 1200, 'never with the puzzle still on screen (before its end card)');
    await toEnd(page);
    await page.waitForFunction(() => window.__rm.calls.some((c) => c.m === 'requestReview'), null, { timeout: 5000 });
    const r = (await calls(page, 'requestReview'));
    assert.equal(r.length, 1);
    assert.equal(r[0].at.ses && r[0].at.ses.finished, true, 'asked with the end card up, nothing in play');
    const rs = await stored(page);
    assert.ok(Math.abs(rs.rateT - r[0].t) < 2000, 'the time is saved (before the call)');
    // a won game, later the same day
    await page.locator('#sessionCard [data-act="home"]').click();
    await goTab(page, 'play');
    const b = page.locator('#resumePlay .rs-go'); if (await b.isVisible()) await b.click();
    await page.waitForFunction(() => !window.__coach.st.busy);
    await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => { const e = document.getElementById('gameEnd'); return e && !e.hidden && e.querySelector('[data-act="review"]'); }, null, { timeout: 30000 });
    await page.waitForTimeout(1500);
    assert.equal((await calls(page, 'requestReview')).length, 1, 'no second ask within 60 days');
    return page;
  }],
  ['AC9: a won game on the 3rd active day asks; a failed review of the request never asks again the same day', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: Object.assign(active(20), active(22)), games: [] }), { native: { reviewFails: true }, remind: { offered: true }, game: MATE1 });
    await goTab(page, 'play');
    const b = page.locator('#resumePlay .rs-go'); if (await b.isVisible()) await b.click();
    await page.waitForFunction(() => !window.__coach.st.busy);
    await page.locator('#board .sq[data-sq="h5"]').click(); await page.locator('#board .sq[data-sq="f7"]').click();
    await page.waitForFunction(() => window.__rm.calls.some((c) => c.m === 'requestReview'), null, { timeout: 30000 });
    const r = await calls(page, 'requestReview');
    assert.equal(r[0].at.mode, 'play'); assert.equal(r[0].at.ses, null);
    assert.equal(await page.evaluate(() => { const e = document.getElementById('gameEnd'); return !e.hidden && e.getClientRects().length > 0; }), true, 'after the game’s end card shows');
    assert.ok((await stored(page)).rateT > 0, 'saved even though the request failed');
    await solveDaily(page); await toEnd(page);
    await page.waitForTimeout(1500);
    assert.equal((await calls(page, 'requestReview')).length, 1, 'not again the same day');
    return page;
  }],
  ['AC9: not before the 3rd active day, not after a missed daily, not 59 days after the last ask; 60 days after, yes', async (vp) => {
    let page = await open(vp, improver({ rating: 1100, days: active(24) }), { native: {}, remind: { offered: true } });
    await solveDaily(page); await toEnd(page);
    await noReview(page, 1500, '2 active days: no');
    await page.context().close();
    page = await open(vp, improver({ rating: 1100, days: Object.assign(active(20), active(22)), daily: { d: K(25), id: 'm0', r: null, n: 1 } }), { native: {}, remind: { offered: true } });
    await solveDaily(page, true); await toEnd(page);
    await noReview(page, 1500, 'a missed puzzle is not a happy moment');
    await page.context().close();
    page = await open(vp, improver({ rating: 1100, days: Object.assign(active(20), active(22)) }), { native: {}, remind: { offered: true, rateT: T10 - 59 * DAYMS } });
    await solveDaily(page); await toEnd(page);
    await noReview(page, 1500, '59 days after the last ask: no');
    await page.context().close();
    page = await open(vp, improver({ rating: 1100, days: Object.assign(active(20), active(22)) }), { native: {}, remind: { offered: true, rateT: T10 - 60 * DAYMS } });
    await solveDaily(page); await toEnd(page);
    await page.waitForFunction(() => window.__rm.calls.some((c) => c.m === 'requestReview'), null, { timeout: 5000 });
    assert.equal((await calls(page, 'requestReview')).length, 1, '60 days: yes');
    return page;
  }],

  // ---------- fix round 1 ----------
  ['Fix 4, AC5: the offer counts as shown once it is on an end card, even when the player leaves without answering', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: active(24) }), { native: { perm: 'prompt' } });
    await solveDaily(page); await toEnd(page);
    assert.ok(await offer(page));
    assert.equal((await stored(page)).offered, true, 'counted as offered as soon as it shows');
    await page.locator('#sessionCard [data-act="home"]').click();
    await page.clock.setSystemTime(at(26, 10, 0));
    await page.evaluate(() => document.dispatchEvent(new Event('visibilitychange')));
    await page.waitForFunction(() => window.__coach.getProf().daily.d === '2026-11-26');
    await solveDaily(page); await toEnd(page);
    assert.equal(await offer(page), null, 'never again');
    assert.equal((await calls(page, 'requestPermissions')).length, 0);
    return page;
  }],
  ['DP-D17: on the first solved daily puzzle only Rani’s offer shows, even on the 3rd active day; the rating ask waits', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: Object.assign(active(20), active(22)) }), { native: { perm: 'prompt' } });
    await solveDaily(page); await toEnd(page);
    assert.ok(await offer(page));
    await noReview(page, 1500, 'no sheet with the offer up');
    await page.locator('#sessionCard [data-act="rmno"]').click();
    await noReview(page, 1200, 'nor right after it is answered');
    return page;
  }],
  ['DP-D19, fix 5: a Beginner before Foundations has no reminder row and no reminders; any set earlier are cancelled', async (vp) => {
    const page = await open(vp, prof({ course: done('rules', 'special'), days: active(24) }), { native: { perm: 'granted', pending: [20261126, 20261127] }, remind: { on: true, offered: true } });
    assert.equal((await calls(page, 'schedule')).length, 0, 'nothing set');
    assert.deepEqual(await pending(page), [], 'the earlier ones are cancelled');
    const s = await settings(page);
    assert.equal(s.shown, false, 'no Settings row');
    return page;
  }],
  ['AC9, fix 3: a newly finished lesson part is a happy moment: the Learn end card asks', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: Object.assign(active(20), active(22)) }), { native: {}, remind: { offered: true } });
    await page.evaluate(() => window.__coach.startPart('fork', 'learn'));
    await finishLesson(page);
    await page.waitForFunction(() => { const e = document.getElementById('learnEnd'); return e && !e.hidden; });
    await page.waitForFunction(() => window.__rm.calls.some((c) => c.m === 'requestReview'), null, { timeout: 5000 });
    assert.equal((await calls(page, 'requestReview')).length, 1);
    return page;
  }],
  ['AC9, fix 3: a lesson part finished mid-game, then the game is lost: the lost game’s end card never asks', async (vp) => {
    // Rani's develop task: four minor pieces out; castling now finishes it. Then Black mates at once (Qxh2#; level 3 always finds a mate in one).
    const sans = ['e4', 'e5', 'Nc3', 'Nh6', 'Bc4', 'Qh4', 'Nge2', 'Ng4', 'd3', 'a6', 'Be3', 'a5'];
    const g = game(sans, { level: 3, goal: { type: 'develop', unit: 'opening', status: 'active', progress: '' } });
    const page = await open(vp, prof({ level: 'beginner', course: done('rules', 'special', 'board', 'values', 'mate'), days: Object.assign(active(20), active(22)), unlockAll: true }), { native: {}, remind: { offered: true }, game: g, tab: 'play' });
    if ((await st(page, 'tab')) !== 'play') await goTab(page, 'play');
    const b = page.locator('#resumePlay .rs-go'); if (await b.isVisible()) await b.click();
    await page.waitForFunction(() => !window.__coach.st.busy);
    await page.locator('#board .sq[data-sq="e1"]').click(); await page.locator('#board .sq[data-sq="g1"]').click();
    await page.waitForFunction(() => { const p = window.__coach.getProf(); return p.course.opening && p.course.opening.apply; }, null, { timeout: 30000 });
    await page.waitForFunction(() => window.__coach.hist().slice(-1)[0] === 'Qxh2#', null, { timeout: 30000 });
    await page.waitForFunction(() => { const e = document.getElementById('gameEnd'); return e && !e.hidden && e.getClientRects().length > 0; }, null, { timeout: 30000 });
    await noReview(page, 1500, 'a lost game is never a happy moment');
    return page;
  }],
  ['AC9, fix 3: an activity started within the moment after the end card stops the ask', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: Object.assign(active(20), active(22)) }), { native: {}, remind: { offered: true } });
    await solveDaily(page); await toEnd(page);
    await page.locator('#sessionCard .ec-main').click(); // "10 more puzzles", at once
    await page.waitForFunction(() => { const s = window.__coach.st.ses; return s && s.rated && !s.finished; });
    await noReview(page, 1500, 'the next set started first: no sheet over it');
    return page;
  }],
  // ---------- scenario 9: the web ----------
  ['Scenario 9: on the web there is no offer, no reminder setting, no rating ask and no plugin', async (vp) => {
    const page = await open(vp, improver({ rating: 1100, days: Object.assign(active(20), active(22)) }), { native: false });
    assert.equal(await page.evaluate(() => typeof window.Capacitor), 'undefined');
    await solveDaily(page); await toEnd(page);
    await page.waitForTimeout(1200);
    assert.equal(await page.locator('#sessionCard .rm-offer').count(), 0, 'no offer');
    const s = await settings(page);
    assert.equal(s.shown, false, 'no Settings row'); assert.equal(s.html, '', 'nothing inside it either');
    assert.equal(await page.evaluate((k) => localStorage.getItem(k), RKEY), null, 'nothing stored');
    assert.ok(!(await page.evaluate(() => document.body.innerText)).includes('remind'), 'no reminder words anywhere');
    return page;
  }]
];

if (require.main === module) G.run(cases, VIEWPORTS, ONLY);
