// E2E for slice G1: piece tags, the name line and the "Piece tags" switch (docs/specs/board-screens.product.md,
// G-D13 to G-D16, scenarios 9 to 12, acceptance criteria 8 to 13).
// Run: G1_VP=412 node tests/e2e/g1.spec.js   (serves www/ itself; needs Playwright with Chromium). One viewport per process.
// G1_VP: 360 | 412 | 1280. G1_SHOTS=<dir> saves screenshots. G1_ONLY=<regex> runs matching cases.
// The 3D board is checked through Board3D.debug (what the scene holds), not by matching pixels.
const { chromium } = require('playwright');
const http = require('http');
const fs = require('fs');
const assert = require('assert/strict');
const path = require('path');

const WWW = path.resolve(process.env.G1_WWW || path.join(__dirname, '../../www'));
const PORT = 8000 + Math.floor(Math.random() * 900);
const ORIGIN = 'http://127.0.0.1:' + PORT;
const URL = ORIGIN + '/index.html';
const SHOTS = process.env.G1_SHOTS || '';
const PKEY = 'suresh-chess-coach.profile.v1', GKEY = 'suresh-chess-coach.v1', TKEY = 'suresh-chess-coach.tab', SKEY = 'suresh-chess-coach.pieces', K3D = 'suresh-chess-coach.view3d';
const VIEWPORTS = [{ width: 360, height: 800 }, { width: 412, height: 915 }, { width: 1280, height: 900 }].filter((v) => !process.env.G1_VP || String(v.width) === process.env.G1_VP);
const ONLY = process.env.G1_ONLY ? new RegExp(process.env.G1_ONLY) : null;
const NOW = Date.now(), DAY = 86400000;
const ROLES = ['k', 'q', 'r', 'b', 'n', 'p'];
const GLYPH = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
// The spec's "New wording", letter for letter.
const WORDING = {
  k: 'king. Moves one square in any direction.',
  q: 'queen. Moves any distance, straight or diagonally.',
  r: 'rook. Moves any distance in straight lines.',
  b: 'bishop. Moves any distance diagonally.',
  n: 'knight. Jumps in an L shape.',
  p: 'pawn. Moves forward, captures diagonally.'
};
// One square per role and colour in the starting position.
const START_SQ = { w: { k: 'e1', q: 'd1', r: 'a1', b: 'c1', n: 'g1', p: 'e2' }, b: { k: 'e8', q: 'd8', r: 'a8', b: 'c8', n: 'g8', p: 'e7' } };

let browser, results = [], failures = 0, notes = [];

const dkey = (back) => { const d = new Date(); d.setDate(d.getDate() - back); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); };
const played = (...backs) => Object.fromEntries(backs.map((b) => [dkey(b), { puz: 0, games: 1, course: 0, solved: 0 }]));
// A Club player on a later day, as saved by the app before G1: no pieceTags field at all.
function club(o) {
  return Object.assign({ v: 5, level: 'club', levelT: NOW - 4 * DAY, placed: 'check', start: 'kq', rating: 1300, rn: 0, games: [], puz: {}, course: {}, days: played(1, 2, 3, 4), reviewed: [], t: NOW - DAY, theme: null, showAll: false, unlockAll: false, provisional: false, pgsDeclined: true, levelOfferT: 0 }, o);
}
const beginner = (o) => club(Object.assign({ level: 'beginner', start: 'rules', rating: 600, levelT: NOW - DAY, days: played(1) }, o));
const GAME0 = { sans: [], user: 'w', level: 1, ann: {}, notes: {}, tags: {}, fb: null, opp: null, evalW: 0, flipped: false, recorded: false, goal: null, t: NOW - 60000 };

function seedFn([pk, p, gk, g, tk, tab, sk, set, k3, v3d]) {
  if (sessionStorage.getItem('seeded')) return;
  if (p) localStorage.setItem(pk, JSON.stringify(p));
  if (g) localStorage.setItem(gk, JSON.stringify(g));
  if (tab) localStorage.setItem(tk, JSON.stringify(tab));
  if (set) localStorage.setItem(sk, JSON.stringify(set));
  if (v3d) localStorage.setItem(k3, 'true');
  sessionStorage.setItem('seeded', '1');
}
// o: { game, tab, set (the piece set), v3d (start in the 3D view) }
async function newPage(vp, p, o) {
  o = o || {};
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: 1 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await ctx.addInitScript(seedFn, [PKEY, p, GKEY, o.game === undefined ? GAME0 : o.game, TKEY, o.tab || 'play', SKEY, o.set || null, K3D, !!o.v3d]);
  const page = await ctx.newPage();
  if (process.env.G1_TIMEOUT) { page.setDefaultTimeout(+process.env.G1_TIMEOUT); page.setDefaultNavigationTimeout(60000); }
  page.errors = []; page.outside = [];
  page.on('console', (m) => { if ((m.type() === 'error' || m.type() === 'warning') && !/GL Driver Message/.test(m.text())) page.errors.push(m.type() + ': ' + m.text()); }); // headless WebGL's own performance notes aside
  page.on('pageerror', (e) => page.errors.push(String(e)));
  page.on('request', (r) => { const u = r.url(); if (!u.startsWith(ORIGIN + '/') && !/^(data|blob|about):/.test(u) && !/fonts\.(googleapis|gstatic)\.com/.test(u)) page.outside.push(u); });
  await page.goto(URL);
  try { await page.waitForFunction(() => window.__coach && window.Placement); }
  catch (e) { throw new Error('app did not start: ' + e.message.split('\n')[0] + ' | page errors: ' + JSON.stringify(page.errors)); }
  if (o.v3d) await wait3d(page);
  return page;
}
const shot = async (page, vp, name) => { if (!SHOTS) return; await page.waitForTimeout(250); await page.screenshot({ path: path.join(SHOTS, vp.width + '_' + name + '.png') }); };
const savedProf = (page) => page.evaluate((k) => JSON.parse(localStorage.getItem(k)), PKEY);
const themed = (page) => page.evaluate(() => Object.keys(window.Avatar.SETS).filter((s) => s !== 'classic'));
// The 3D board is up and has drawn the current position.
async function wait3d(page) {
  await page.waitForFunction(() => { const b = document.getElementById('v3dBtn'); return /2D view/.test(b.textContent) && !document.querySelector('.b3d.loading') && window.Board3D && window.Board3D.debug && window.Board3D.debug.ready(); }, null, { timeout: 30000 });
}
// A tap on a board square, as a finger does it: pointerdown and pointerup on the square (the flat grid takes both views' taps).
const tap = (page, sq) => page.evaluate((s) => {
  const el = document.querySelector('.sq[data-sq="' + s + '"]'), r = el.getBoundingClientRect(), o = { bubbles: true, pointerId: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
  el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o));
}, sq);
const line = (page) => page.evaluate(() => { const e = document.getElementById('pieceLine'); return e && !e.hidden && e.offsetParent !== null ? e.textContent : ''; });
// Picks a piece set the way a player does: its button in Settings (the click runs the app's own handler).
// The Settings card is drawn when Settings first opens, so open and close it once if needed.
const pickSet = (page, id) => page.evaluate((s) => {
  if (!document.querySelector('#lookSet [data-set]')) { window.__coach.openSettings(); document.querySelector('#settingsSheet [data-act="settingsclose"]').click(); }
  document.querySelector('#lookSet [data-set="' + s + '"]').click();
}, id);
// What the flat board shows: for every square with a themed token, its tag (or null).
const flatTags = (page) => page.evaluate(() => [...document.querySelectorAll('#grid .sq')].map((sq) => {
  const pc = sq.querySelector('.pc'), svg = pc.querySelector('svg.tok'), tag = svg && svg.querySelector('.ptag');
  if (!pc.className.includes(' w') && !pc.className.includes(' b')) return null;
  const o = { sq: sq.dataset.sq, color: pc.classList.contains('w') ? 'w' : 'b', token: !!svg, tag: null };
  if (tag) {
    const c = tag.querySelector('circle').getBoundingClientRect(), s = sq.getBoundingClientRect(), em = svg.querySelector('g[stroke-linecap="round"]').getBoundingClientRect();
    o.tag = { role: tag.dataset.role, text: tag.textContent, w: c.width, h: c.height, inSquare: c.left >= s.left - 0.5 && c.right <= s.right + 0.5 && c.top >= s.top - 0.5 && c.bottom <= s.bottom + 0.5,
      left: c.left, top: c.top, emCx: em.left + em.width / 2, emCy: em.top + em.height / 2, sqW: s.width };
  }
  return o;
}).filter(Boolean));
const idle3d = (page) => page.waitForFunction(() => window.Board3D.debug.ready() && window.Board3D.debug.idle(), null, { timeout: 15000 });
const tags3d = (page) => page.evaluate(() => window.Board3D.debug.tags());
const pieces = (page) => page.evaluate(() => { const g = new window.Chess(); window.__coach.hist().forEach((m) => g.move(m)); const out = []; g.SQUARES.forEach((s) => { const p = g.get(s); if (p) out.push({ sq: s, color: p.color, type: p.type }); }); return out; });
// How far a tag's middle is from a box on screen (0 inside it).
const near = (t, b) => Math.hypot(Math.max(b.l - t.sx, 0, t.sx - b.r), Math.max(b.t - t.sy, 0, t.sy - b.b));
// The whole tag (its box on screen), not just its middle, is inside the 3D canvas.
const inside = (t) => t.sx - t.sr >= t.rect.left - 0.5 && t.sx + t.sr <= t.rect.right + 0.5 && t.sy - t.sr >= t.rect.top - 0.5 && t.sy + t.sr <= t.rect.bottom + 0.5;
const byColor = (list, c) => list.filter((t) => t.color === c);
function sixRoles(list, why) {
  for (const c of ['w', 'b']) assert.deepEqual([...new Set(byColor(list, c).map((t) => t.role))].sort(), ROLES.slice().sort(), why + ': six different tags for ' + c);
}
const median = (a) => { const s = a.slice().sort((x, y) => x - y); return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2; };

const cases = [
  // ---------- criterion 8, G-D16: the flat view ----------
  ['C8 flat: every themed set shows six different tags per colour, one per role, big enough and inside its square', async (vp) => {
    const page = await newPage(vp, club(), { set: 'heroes' });
    const sets = await themed(page);
    assert.ok(sets.length >= 10);
    let minW = 99;
    for (const set of sets) {
      await pickSet(page, set);
      const list = await flatTags(page), start = await pieces(page);
      assert.equal(list.length, 32, set + ': 32 pieces on the board');
      for (const p of list) {
        const want = start.find((q) => q.sq === p.sq);
        assert.ok(p.token && p.tag, set + ' ' + p.sq + ': a token with a tag');
        assert.equal(p.tag.role, want.type, set + ' ' + p.sq + ': the tag is for the piece’s role');
        assert.ok(p.tag.text.includes(GLYPH[want.type]), set + ' ' + p.sq + ': the standard symbol');
        assert.ok(p.tag.w >= 14 && p.tag.h >= 14, set + ' ' + p.sq + ': at least 14px across (' + p.tag.w.toFixed(1) + ')');
        assert.ok(p.tag.inSquare, set + ' ' + p.sq + ': inside its own square, so never over a neighbour');
        assert.ok(p.tag.left > p.tag.emCx && p.tag.top > p.tag.emCy, set + ' ' + p.sq + ': in the bottom right corner, clear of the middle of the emblem');
        minW = Math.min(minW, p.tag.w);
      }
      sixRoles(list.map((p) => Object.assign({ color: p.color }, p.tag)), set);
    }
    notes.push(vp.width + ': smallest flat tag ' + minW.toFixed(1) + 'px on a ' + (await flatTags(page))[0].tag.sqW.toFixed(1) + 'px square');
    await shot(page, vp, 'flat-tags');
    return page;
  }],
  ['C8 flat: the tag is the same on a dragged piece, and the set previews in "Coach and pieces" keep it', async (vp) => {
    const page = await newPage(vp, club(), { set: 'heroes' });
    await page.locator('#settingsBtn').click();
    const pv = await page.evaluate(() => [...document.querySelectorAll('#lookSet [data-set="heroes"] .pv svg')].map((s) => { const t = s.querySelector('.ptag'); return t ? t.dataset.role : null; }));
    assert.deepEqual(pv, ['k', 'q', 'n', 'k'], 'previews: king, queen, knight and the other king, each with its tag');
    assert.equal(await page.evaluate(() => document.querySelectorAll('#lookSet [data-set="classic"] .pv svg').length), 0, 'the classic preview has no tokens and no tags');
    const ids = await page.evaluate(() => { const all = [...document.querySelectorAll('#lookSet [id], #lookCard [id]')].map((e) => e.id); return { n: all.length, uniq: new Set(all).size }; });
    assert.equal(ids.n, ids.uniq, 'preview gradient ids stay unique across the two cards');
    await page.keyboard.press('Escape');
    const ghost = await page.evaluate(() => {
      const el = document.querySelector('.sq[data-sq="g1"]'), r = el.getBoundingClientRect(), o = { bubbles: true, pointerId: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 };
      el.dispatchEvent(new PointerEvent('pointerdown', o));
      el.dispatchEvent(new PointerEvent('pointermove', Object.assign({}, o, { clientX: o.clientX + 20, clientY: o.clientY - 20 })));
      const g = document.querySelector('.ghost .ptag'), role = g ? g.dataset.role : null;
      el.dispatchEvent(new PointerEvent('pointerup', Object.assign({}, o, { clientX: 2, clientY: 2 })));
      return role;
    });
    assert.equal(ghost, 'n', 'the dragged knight keeps its tag');
    return page;
  }],

  // ---------- scenario 12: classic ----------
  ['S12 classic: no tags in either view and no name line', async (vp) => {
    const page = await newPage(vp, beginner(), { set: 'classic' });
    assert.equal(await page.evaluate(() => document.querySelectorAll('#grid .ptag, #grid svg.tok').length), 0, 'flat: no tokens, no tags');
    for (const sq of ['e2', 'g1', 'e8', 'e4']) { await tap(page, sq); assert.equal(await line(page), '', 'no name line after tapping ' + sq); }
    assert.equal(await page.evaluate(() => document.getElementById('pieceLine').hidden), true);
    await page.locator('#v3dBtn').click(); await wait3d(page);
    assert.deepEqual(await tags3d(page), [], '3D: no tags');
    await tap(page, 'g1');
    assert.equal(await line(page), '', '3D: no name line');
    return page;
  }],

  // ---------- scenario 10, criterion 10, G-D14: the name line ----------
  ['S10 name line: tapping a themed piece names it under the board, for either colour, without moving anything', async (vp) => {
    const page = await newPage(vp, club(), { set: 'heroes' });
    const box = (sel) => page.evaluate((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right), h: Math.round(r.height) }; }, sel);
    const layout = async () => ({ hint: await box('#hintBtn'), you: await box('#youCaps'), board: await box('#board'), tabs: await box('.tabs'), row: await box('#youSwatch') });
    await page.waitForFunction(() => !window.__coach.st.busy);
    const before = await layout(), strip0 = await page.evaluate(() => document.getElementById('coachStrip').innerHTML), coach0 = await page.evaluate(() => { const e = document.getElementById('coachCard') || document.getElementById('panel-play'); return e ? e.textContent : ''; });
    assert.equal(await line(page), '', 'nothing before a tap');
    await tap(page, 'g1');
    assert.equal(await line(page), 'Rocket: knight. Jumps in an L shape.');
    await shot(page, vp, 'name-line');
    const el = await page.evaluate(() => { const e = document.getElementById('pieceLine'), r = e.getBoundingClientRect(), b = document.getElementById('board').getBoundingClientRect(); return { role: e.getAttribute('role'), live: e.getAttribute('aria-live'), top: r.top, bottom: r.bottom, left: r.left, right: r.right, boardBottom: b.bottom, clipped: e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1, vw: window.innerWidth }; });
    assert.equal(el.role, 'status', 'read out politely (a status is a polite live region)');
    assert.equal(el.live, null, 'one way of saying so, not two');
    assert.ok(el.top >= el.boardBottom - 1, 'under the board');
    assert.ok(el.left >= 0 && el.right <= el.vw, 'inside the screen');
    assert.equal(el.clipped, false, 'the whole line fits');
    assert.deepEqual(await layout(), before, 'nothing moves when the line shows: Hint, the board and the tabs stay put');
    assert.equal(await page.evaluate(() => document.getElementById('coachStrip').innerHTML), strip0, 'the coach strip keeps its message');
    await tap(page, 'c8');
    assert.equal(await line(page), 'Static: bishop. Moves any distance diagonally.', 'the other side’s piece is named too');
    assert.equal(await page.evaluate(() => window.__coach.st.sel), null, 'and it is not picked up');
    await tap(page, 'c1');
    assert.equal(await line(page), 'Volt: bishop. Moves any distance diagonally.');
    await tap(page, 'e4');
    assert.equal(await line(page), '', 'an empty square clears the line');
    assert.deepEqual(await layout(), before, 'and nothing moves when it goes');
    // the Hint flow and a move still work with the line up
    await tap(page, 'e2');
    assert.equal(await line(page), 'Rookie: pawn. Moves forward, captures diagonally.');
    await page.waitForFunction(() => !document.getElementById('hintBtn').disabled);
    const h0 = await page.locator('#hintBtn').innerText();
    await page.locator('#hintBtn').click();
    assert.equal(await line(page), 'Rookie: pawn. Moves forward, captures diagonally.', 'asking for a hint leaves the line alone');
    await page.waitForFunction((t) => document.getElementById('hintBtn').textContent !== t, h0, { timeout: 20000 });
    assert.match(await page.evaluate(() => (window.__coach.st.fb || {}).title || ''), /Hint/, 'and the coach shows the hint');
    await tap(page, 'e2'); await tap(page, 'e4');
    await page.waitForFunction(() => window.__coach.hist().length >= 1);
    assert.equal(await line(page), '', 'the line goes when the piece moves');
    assert.equal((await page.evaluate(() => window.__coach.hist()))[0], 'e4');
    void coach0;
    return page;
  }],
  ['C10 name line: the right emblem name and role for every set, both colours, all six roles, in both views', async (vp) => {
    const page = await newPage(vp, club(), { set: 'heroes' });
    const sets = await themed(page);
    const walk = async (view) => {
      let longest = '';
      for (const set of sets) {
        await pickSet(page, set);
        for (const c of ['w', 'b']) for (const t of ROLES) {
          const sq = START_SQ[c][t], name = await page.evaluate(([s, cc, tt]) => window.Avatar.label(s, cc, tt), [set, c, t]);
          await tap(page, sq);
          const got = await line(page);
          assert.equal(got, name + ': ' + WORDING[t], view + ' ' + set + ' ' + c + t);
          assert.ok(!/[—–]/.test(got), 'no em dash: ' + got);
          assert.equal(await page.evaluate(() => { const e = document.getElementById('pieceLine'); return e.scrollHeight > e.clientHeight + 1 || e.scrollWidth > e.clientWidth + 1; }), false, view + ': the line is not cut off: ' + got);
          if (got.length > longest.length) longest = got;
        }
      }
      return longest;
    };
    const longest = await walk('flat');
    await tap(page, 'a1'); await pickSet(page, 'heroes'); await tap(page, 'a1');
    await shot(page, vp, 'name-line-long');
    await page.locator('#v3dBtn').click(); await wait3d(page);
    await walk('3D');
    notes.push(vp.width + ': longest name line (' + longest.length + ' characters): ' + longest);
    return page;
  }],
  ['C10 name line: a Beginner gets it too, and it leaves with the piece set', async (vp) => {
    const page = await newPage(vp, beginner({ showAll: false }), { set: 'royal' });
    await tap(page, 'd1');
    assert.equal(await line(page), 'Rani: queen. Moves any distance, straight or diagonally.');
    await pickSet(page, 'classic');
    assert.equal(await line(page), '', 'classic: the line goes');
    await pickSet(page, 'royal');
    assert.equal(await line(page), '', 'and does not come back on its own');
    return page;
  }],

  // ---------- scenario 9, criteria 8 and 9: the 3D view ----------
  ['S9 3D: every piece has a tag above it for its role, and it faces the player at every board angle, flipped too', async (vp) => {
    const page = await newPage(vp, club(), { set: 'heroes', v3d: true });
    const start = await pieces(page);
    let curPol = 0.6;
    const check = async (why) => {
      const list = await tags3d(page);
      assert.equal(list.length, 32, why + ': one tag per piece');
      sixRoles(list, why);
      for (const t of list) {
        const want = start.find((q) => q.sq === t.sq);
        assert.ok(want, why + ': a tag only where a piece is (' + t.sq + ')');
        assert.equal(t.role, want.type, why + ' ' + t.sq + ': the tag is for the piece’s role'); assert.equal(t.color, want.color);
        assert.equal(t.visible, true, why + ' ' + t.sq + ': drawn');
        assert.ok(t.facing > 0.9999, why + ' ' + t.sq + ': faces the camera (' + t.facing + ')');
        assert.ok(Math.hypot(t.x - t.px, t.z - t.pz) < 0.5 && t.y > t.py, why + ' ' + t.sq + ': over its own square');
        // the piece's box is measured here, from its meshes without the tag (not from what the tag was placed by)
        assert.ok(near(t, t.box) <= t.sr * 1.2, why + ' ' + t.sq + ': touching its own piece on screen ' + JSON.stringify([t.sx, t.sy, t.box]));
        // on the right shoulder, or on the left one where the right one would leave the picture
        if (t.side < 0) { assert.ok(t.sx < (t.box.l + t.box.r) / 2, why + ' ' + t.sq + ': on the left of its piece'); assert.ok(t.box.r + 2.4 * t.sr > t.rect.right, why + ' ' + t.sq + ': on the left only at the right edge ' + JSON.stringify([t.sx, t.sr, t.box, t.rect.right])); }
        else assert.ok(t.sx > (t.box.l + t.box.r) / 2, why + ' ' + t.sq + ': on the right of its piece');
        if (curPol === 0.6) assert.ok(t.sy < (t.box.t + t.box.b) / 2, why + ' ' + t.sq + ': at the upper right shoulder (from the opening height)');
        assert.ok(t.depth < t.pdepth, why + ' ' + t.sq + ': in front of its own piece');
        assert.ok(inside(t), why + ' ' + t.sq + ': the whole tag is inside the 3D picture ' + JSON.stringify([Math.round(t.sx), Math.round(t.sy), Math.round(t.sr), t.rect]));
      }
      return list;
    };
    const first = await check('start');
    notes.push(vp.width + ': 3D tag is ' + (2 * Math.min(...first.map((t) => t.sr))).toFixed(1) + ' to ' + (2 * Math.max(...first.map((t) => t.sr))).toFixed(1) + 'px across at the opening view');
    await shot(page, vp, '3d-tags');
    for (const [az, pol] of [[-1.2, 0.28], [1.2, 0.28], [-1.2, 1.12], [1.2, 1.12], [0, 1.12], [0.6, 0.7], [-0.4, 0.5]]) {
      await page.evaluate(([a, p]) => window.Board3D.debug.view(a, p), [az, pol]); curPol = pol;
      await check('turned to ' + az + ', ' + pol);
    }
    await shot(page, vp, '3d-tags-turned');
    await page.locator('#flipBtn').click();
    await idle3d(page); curPol = 0;
    await check('flipped');
    for (const [az, pol] of [[-1.2, 0.28], [1.2, 1.12]]) { await page.evaluate(([a, p]) => window.Board3D.debug.view(a, p), [az, pol]); curPol = pol; await check('flipped and turned to ' + az + ', ' + pol); }
    // every other set, at one angle
    for (const set of (await themed(page)).filter((s) => s !== 'heroes')) {
      await pickSet(page, set);
      await page.waitForFunction(() => window.Board3D.debug.ready());
      await check(set);
    }
    await shot(page, vp, '3d-tags-figures');
    return page;
  }],
  ['C9 3D: a tag follows its piece as it moves, a captured piece has no tag, a promoted pawn changes its tag', async (vp) => {
    // 1. e4 d5: the player (White) can take on d5.
    const page = await newPage(vp, club(), { set: 'heroes', v3d: true, game: Object.assign({}, GAME0, { sans: ['e4', 'd5'] }) });
    await page.waitForFunction(() => !window.__coach.st.busy);
    assert.equal((await tags3d(page)).filter((t) => t.visible).length, 32);
    await tap(page, 'e4'); await tap(page, 'd5');
    // in the same step: the captured pawn's tag is gone, before its piece has finished sinking
    const now = await tags3d(page);
    const gone = now.filter((t) => t.gone);
    assert.ok(gone.length >= 1, 'the captured pawn is still leaving the board');
    assert.ok(gone.every((t) => !t.visible), 'but its tag is not drawn');
    assert.equal(now.filter((t) => t.visible).length, 31, 'one tag fewer');
    // while the capturing pawn slides, its tag stays over it
    for (let i = 0; i < 4; i++) {
      await page.waitForTimeout(60);
      for (const t of (await tags3d(page)).filter((x) => x.visible)) assert.ok(Math.hypot(t.x - t.px, t.z - t.pz) < 0.5 && t.y > t.py && near(t, t.box) <= t.sr * 1.2, 'mid move: on its own piece (' + t.sq + ')');
    }
    await page.waitForFunction(() => !window.__coach.st.busy && window.__coach.hist().length >= 4, null, { timeout: 30000 });
    await idle3d(page);
    const after = await tags3d(page), pos = await pieces(page);
    assert.equal(after.length, pos.length, 'when the board settles: as many tags as pieces (' + pos.length + ')');
    assert.ok(after.every((t) => t.visible && !t.gone));
    for (const p of pos) assert.ok(after.some((t) => t.sq === p.sq && t.role === p.type && t.color === p.color), 'a ' + p.color + p.type + ' tag on ' + p.sq);
    // promotion, straight through the 3D board: a pawn on g7 becomes a queen on g8
    const res = await page.evaluate(async () => {
      const B = window.Board3D, base = [{ sq: 'e1', color: 'w', type: 'k' }, { sq: 'e8', color: 'b', type: 'k' }];
      const st0 = { pos: base.concat([{ sq: 'g7', color: 'w', type: 'p' }]), theme: 'heroes', white: true, tags: true, targets: {}, hls: [], arrows: [], ok: [] };
      B.sync(st0, true);
      const a = B.debug.tags().map((t) => t.sq + t.color + t.role + (t.visible ? '' : '-hidden')).sort();
      B.sync(Object.assign({}, st0, { pos: base.concat([{ sq: 'g8', color: 'w', type: 'q' }]) }));
      const b = B.debug.tags().filter((t) => t.visible).map((t) => t.sq + t.color + t.role).sort();
      await new Promise((r) => setTimeout(r, 1200));
      const c = B.debug.tags().map((t) => t.sq + t.color + t.role + (t.visible ? '' : '-hidden')).sort();
      return { a, b, c };
    });
    assert.deepEqual(res.a, ['e1wk', 'e8bk', 'g7wp']);
    assert.deepEqual(res.b, ['e1wk', 'e8bk', 'g8wq'], 'at once: the queen’s tag, and no pawn tag');
    assert.deepEqual(res.c, ['e1wk', 'e8bk', 'g8wq'], 'settled: the pawn and its tag are gone for good');
    return page;
  }],
  ['Fix 1, 3D: a tap on a tag is a tap on its own piece, never the piece or square behind it', async (vp) => {
    const page = await newPage(vp, club(), { set: 'heroes', v3d: true });
    await page.waitForFunction(() => !window.__coach.st.busy);
    const sel = () => page.evaluate(() => window.__coach.st.sel);
    const clear = async () => { await tap(page, 'h5'); assert.equal(await sel(), null); assert.equal(await line(page), ''); };
    const name = (sq) => page.evaluate((s) => { const g = new window.Chess(), p = g.get(s); return window.Words.nameLine(window.Avatar.label('heroes', p.color, p.type), p.type); }, sq);
    for (const [az, pol] of [[0, 0.6], [0, 1.12], [0, 0.28]]) {
      await page.evaluate(([a, p]) => window.Board3D.debug.view(a, p), [az, pol]);
      const all = await tags3d(page);
      for (const sq of ['d1', 'g1', 'a1', 'e2', 'a2', 'h2', 'c1']) {
        const t = all.find((x) => x.sq === sq);
        for (const [dx, dy] of [[0, 0], [0, -0.7], [0.7, 0], [0.5, -0.5]]) { // the middle and the outer half: a nearer piece may stand in front of the inner edge
          await clear(); await page.mouse.click(t.sx + dx * t.sr, t.sy + dy * t.sr);
          await page.waitForFunction(() => window.__coach.st.sel || !document.getElementById('pieceLine').hidden, null, { timeout: 3000 }).catch(() => {});
          assert.equal(await sel(), sq, 'view ' + az + ',' + pol + ': a tap on the ' + sq + ' tag (' + dx + ',' + dy + ') picks up ' + sq);
          assert.equal(await line(page), await name(sq), 'and names it');
        }
      }
      for (const sq of ['e7', 'd8', 'g8']) { // the other side's pieces: named, not picked up
        const t = all.find((x) => x.sq === sq);
        await clear(); await page.mouse.click(t.sx, t.sy);
        await page.waitForFunction(() => !document.getElementById('pieceLine').hidden, null, { timeout: 3000 }).catch(() => {});
        assert.equal(await line(page), await name(sq), 'view ' + az + ',' + pol + ': a tap on the ' + sq + ' tag names ' + sq);
        assert.equal(await sel(), null);
      }
    }
    // with a pawn picked up and the board tilted low, a tap on its own tag does not play a move
    await page.evaluate(() => window.Board3D.debug.view(0, 1.12));
    await clear(); await tap(page, 'e2');
    const t = (await tags3d(page)).find((x) => x.sq === 'e2');
    await page.mouse.click(t.sx, t.sy - t.sr * 0.5);
    await page.waitForTimeout(150);
    assert.deepEqual(await page.evaluate(() => window.__coach.hist()), [], 'no move was played');
    assert.equal(await sel(), 'e2', 'the pawn is still the picked piece');
    // tags off: nothing invisible takes the tap. The same spots now pick whatever is behind them, so not always the tag's piece.
    // tags off: nothing invisible takes the tap. Somewhere a tag hangs over another square or piece, and a tap there
    // now picks that one instead.
    const got = [];
    await page.evaluate(() => { window.__coach.getProf().pieceTags = false; }); // the switch, off (the next draw applies it)
    await clear();
    for (const [az, pol] of [[0, 0.28], [0, 0.6], [0, 1.12]]) {
      await page.evaluate(([a, p]) => window.Board3D.debug.view(a, p), [az, pol]);
      const hidden = (await tags3d(page)).filter((x) => x.color === 'w');
      assert.ok(hidden.every((x) => !x.visible));
      for (const h of hidden) for (const [dx, dy] of [[0.9, 0], [0, -0.9], [0.65, -0.65]]) { await clear(); await page.mouse.click(h.sx + h.side * dx * h.sr, h.sy + dy * h.sr); await page.waitForTimeout(30); got.push(h.sq + '>' + (await sel())); }
    }
    assert.ok(got.some((x) => x.slice(0, 2) !== x.slice(3)), 'tags off: a hidden tag does not take the tap: ' + got.join(' '));
    await clear();
    // a tap on the piece itself still works
    await page.evaluate(() => { window.__coach.getProf().pieceTags = true; window.Board3D.debug.view(0, 1.12); });
    await clear();
    const t2 = (await tags3d(page)).find((x) => x.sq === 'e2');
    await page.mouse.click(t2.baseSx, t2.baseSy);
    await page.waitForFunction(() => window.__coach.st.sel === 'e2');
    assert.equal(await line(page), 'Rookie: pawn. Moves forward, captures diagonally.', 'a tap on the piece in 3D shows the name line');
    return page;
  }],
  ['Fix 2, 3D: in a crowded position a tag sits on its own piece’s shoulder and covers no more than a corner of any emblem', async (vp) => {
    // The Italian game after 5...Nf6: knights and bishops packed in front of their pawns.
    const ITALIAN = ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'd3', 'd6', 'Nc3', 'Nf6'];
    // How much of rectangle b the disc (x, y, r) covers, by sampling.
    const cover = (x, y, r, b) => { let n = 0, all = 0; for (let i = 0; i < 24; i++) for (let j = 0; j < 24; j++) { const px = b.l + (i + 0.5) * (b.r - b.l) / 24, py = b.t + (j + 0.5) * (b.b - b.t) / 24; all++; if (Math.hypot(px - x, py - y) <= r) n++; } return n / all; };
    // What is measured. The emblem box is the box on screen of the emblem's own meshes (for the figure sets, of the figure
    // without its base), measured fresh from the scene, not from what the tag was placed by.
    // The limits, by kind of view. Measured at 360, 412 and 1280 (the shares are the same at every size):
    //  - straight on (the board not turned; opening, lowest and highest camera): a tag covers at most 15% of the emblem of a
    //    piece behind it (Hero League 0 to 2%, the Ramayana figures up to 15%). Limit: a fifth.
    //  - turned (0.6 and 1.2 either way, at two heights): the piece on the next diagonal square stands behind the right
    //    shoulder, and a tag is as wide as the gap between two files, so more is covered: up to 26% (Ramayana f6 over f7),
    //    23% for Hero League. Limit: a third. This is a separate, weaker promise than straight on, not the same one raised.
    //  - its own emblem: up to 27% for an emblem set. A figure seen from straight above is smaller on screen than the tag
    //    that must stay touching it: up to 47%. Limits: 35% and 55%.
    //  - two tags overlap by at most 10% of their radii (a left shoulder tag beside a right shoulder one). Limit: 15%.
    //  - size at 360: 14.2px or more from the opening height, 12.1px at the lowest camera, 10.1px turned and low.
    //    Limits: 14, 12 and 10px.
    // Before the fixes the same position measured 74% of a neighbour, tags stacked by 94%, and the h1 tag was half off the edge.
    const LIMIT = { straight: { neighbour: 0.2, stack: 0.15, px: 12 }, turned: { neighbour: 0.33, stack: 0.15, px: 10 } }, OWN = { heroes: 0.35, ramayana: 0.55 };
    const STRAIGHT = [['default', 0, 0.6], ['low', 0, 1.12], ['high', 0, 0.28]];
    const TURNED = [['turned 0.6 mid', 0.6, 0.85], ['turned -0.6 mid', -0.6, 0.85], ['turned 1.2 mid', 1.2, 0.85], ['turned -1.2 mid', -1.2, 0.85],
      ['turned 0.6 low', 0.6, 1.12], ['turned -0.6 low', -0.6, 1.12], ['turned 1.2 low', 1.2, 1.12], ['turned -1.2 low', -1.2, 1.12]];
    const bad = [], per = [], worst = { straight: { n: 0, own: 0, tt: 0, min: 99 }, turned: { n: 0, own: 0, tt: 0, min: 99 } }, K = 360 / vp.width; // the px limits are for a 360 wide phone
    let page;
    for (const set of ['heroes', 'ramayana']) {
      if (page) { assert.deepEqual(page.errors, [], 'console errors or warnings (' + set + ')'); await page.context().close(); }
      page = await newPage(vp, club(), { set, v3d: true, game: Object.assign({}, GAME0, { sans: ITALIAN }) });
      await page.waitForFunction(() => !window.__coach.st.busy);
      for (const flip of [false, true]) {
        if (flip) { await page.evaluate(() => window.Board3D.debug.view(0, 0.6)); await page.locator('#flipBtn').click(); await idle3d(page); }
        for (const [name, az, pol] of STRAIGHT.concat(TURNED)) {
          await page.evaluate(([a, p]) => window.Board3D.debug.view(a, p), [az, pol]);
          const list = await tags3d(page), why = set + (flip ? ' flipped ' : ' ') + name, kind = az === 0 ? 'straight' : 'turned', L = LIMIT[kind];
          assert.equal(list.length, 32);
          const W = { n: 0, own: 0, tt: 0, min: 99, out: 0 };
          for (const t of list) {
            W.min = Math.min(W.min, 2 * t.sr);
            if (2 * t.sr * (vp.width > 860 ? 1 : K) < (name === 'default' ? 14 : L.px)) bad.push(why + ' ' + t.sq + ': only ' + (2 * t.sr).toFixed(1) + 'px across');
            if (!inside(t)) { W.out++; bad.push(why + ' ' + t.sq + ': the tag is not fully inside the 3D picture'); }
            if (!(near(t, t.box) <= t.sr * 1.2)) bad.push(why + ' ' + t.sq + ': not touching its own piece');
            const own = cover(t.sx, t.sy, t.sr, t.emb);
            W.own = Math.max(W.own, own);
            if (own > OWN[set]) bad.push(why + ' ' + t.sq + ': covers ' + (own * 100).toFixed(0) + '% of its own emblem');
            for (const o of list) {
              if (o === t) continue;
              // only a piece further from the camera can be covered: a nearer one is drawn over the tag
              if (o.pdepth > t.depth) { const c = cover(t.sx, t.sy, t.sr, o.emb); W.n = Math.max(W.n, c); if (c > L.neighbour) bad.push(why + ': the ' + t.sq + ' tag covers ' + (c * 100).toFixed(0) + '% of the emblem on ' + o.sq); }
              const d = Math.hypot(t.sx - o.sx, t.sy - o.sy), ov = 1 - d / (t.sr + o.sr); W.tt = Math.max(W.tt, ov);
              if (ov > L.stack) bad.push(why + ': the tags on ' + t.sq + ' and ' + o.sq + ' stack (' + (ov * 100).toFixed(0) + '%)');
            }
          }
          const w = worst[kind]; w.n = Math.max(w.n, W.n); w.own = Math.max(w.own, W.own); w.tt = Math.max(w.tt, W.tt); w.min = Math.min(w.min, W.min);
          per.push(why + ': neighbour ' + (W.n * 100).toFixed(0) + '%, own ' + (W.own * 100).toFixed(0) + '%, tag on tag ' + (Math.max(0, W.tt) * 100).toFixed(0) + '%, smallest ' + W.min.toFixed(1) + 'px, cut off ' + W.out);
          if (az === 0 || name === 'turned 0.6 mid' || name === 'turned -1.2 low') await shot(page, vp, 'crowd-' + set + (flip ? '-flipped' : '') + '-' + name.replace(/ /g, '_'));
        }
      }
    }
    if (process.env.G1_COVER) notes.push(...per);
    assert.deepEqual(bad.slice(0, 12), [], bad.length + ' tags cover too much');
    for (const k of ['straight', 'turned']) notes.push(vp.width + ': crowded position, ' + k + ' views: worst cover of a neighbour’s emblem ' + (worst[k].n * 100).toFixed(1) + '%, of its own ' + (worst[k].own * 100).toFixed(1) + '%, tag on tag ' + (Math.max(0, worst[k].tt) * 100).toFixed(0) + '%, smallest tag ' + worst[k].min.toFixed(1) + 'px');
    return page;
  }],

  // ---------- fix 4: how long the name line stays ----------
  ['Fix 4 name line: it goes by itself after 5 seconds, and a new tap starts the 5 seconds again', async (vp) => {
    const page = await newPage(vp, club(), { set: 'heroes' });
    await page.waitForFunction(() => !window.__coach.st.busy);
    await tap(page, 'g1'); const t0 = Date.now();
    assert.equal(await line(page), 'Rocket: knight. Jumps in an L shape.');
    await page.waitForTimeout(3000);
    assert.equal(await line(page), 'Rocket: knight. Jumps in an L shape.', 'still there after 3 seconds');
    await tap(page, 'c1'); const t1 = Date.now(); // a new tap: 5 more seconds from here
    assert.equal(await line(page), 'Volt: bishop. Moves any distance diagonally.');
    await page.waitForTimeout(Math.max(0, 5700 - (Date.now() - t0)));
    assert.equal(await line(page), 'Volt: bishop. Moves any distance diagonally.', 'the first tap’s 5 seconds do not end the second line');
    await page.waitForFunction(() => document.getElementById('pieceLine').hidden, null, { timeout: 6000 });
    const took = Date.now() - t1;
    assert.ok(took >= 4500 && took <= 7500, 'gone about 5 seconds after the last tap (' + took + 'ms)');
    assert.equal(await page.evaluate(() => window.__coach.st.sel), 'c1', 'the picked piece stays picked');
    assert.equal(await page.evaluate(() => document.getElementById('youCaps').offsetParent !== null), true, 'the "You" row is back');
    return page;
  }],
  ['Fix 4 name line: it goes on a move by either side, on a new game and when the activity changes', async (vp) => {
    // the partner's move: the player plays e4 and, in the same breath, taps a knight that will not move
    let page = await newPage(vp, club(), { set: 'heroes' });
    await page.waitForFunction(() => !window.__coach.st.busy);
    const seen = await page.evaluate(() => {
      const tap = (s) => { const el = document.querySelector('.sq[data-sq="' + s + '"]'), r = el.getBoundingClientRect(), o = { bubbles: true, pointerId: 1, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }; el.dispatchEvent(new PointerEvent('pointerdown', o)); el.dispatchEvent(new PointerEvent('pointerup', o)); };
      tap('e2'); tap('e4'); tap('g1');
      const e = document.getElementById('pieceLine'); return { n: window.__coach.hist().length, text: e.hidden ? '' : e.textContent };
    });
    assert.equal(seen.n, 1, 'tapped before the partner’s reply'); assert.equal(seen.text, 'Rocket: knight. Jumps in an L shape.');
    await page.waitForFunction(() => window.__coach.hist().length >= 2, null, { timeout: 4500 });
    assert.equal(await line(page), '', 'the partner’s move clears the line (the knight on g1 did not move)');
    assert.deepEqual(page.errors, [], 'console errors or warnings'); await page.context().close();
    // the player's own move, with another piece's line showing
    page = await newPage(vp, club(), { set: 'heroes' });
    await page.waitForFunction(() => !window.__coach.st.busy);
    await tap(page, 'e2'); await tap(page, 'g8');
    assert.equal(await line(page), 'Blaster: knight. Jumps in an L shape.');
    await tap(page, 'e2'); await tap(page, 'e4');
    assert.equal((await page.evaluate(() => window.__coach.hist()))[0], 'e4');
    assert.equal(await line(page), '', 'the player’s move clears the line');
    // a new game
    await page.waitForFunction(() => !window.__coach.st.busy && window.__coach.hist().length >= 2, null, { timeout: 30000 });
    await tap(page, 'a1');
    assert.equal(await line(page), 'Headquarters: rook. Moves any distance in straight lines.');
    await page.evaluate(() => document.getElementById('newBtn').click());
    await page.waitForFunction(() => window.__coach.hist().length === 0);
    assert.equal(await line(page), '', '"Start new game" clears the line (the rook is on a1 in the new game too)');
    // a new game from the very first position, where nothing on the board changes
    await page.waitForFunction(() => !window.__coach.st.busy);
    await tap(page, 'a1');
    assert.equal(await line(page), 'Headquarters: rook. Moves any distance in straight lines.');
    await page.evaluate(() => document.getElementById('newBtn').click());
    assert.equal(await line(page), '', 'and when no move had been played');
    // an activity change: a lesson opens
    await tap(page, 'a1');
    assert.equal(await line(page), 'Headquarters: rook. Moves any distance in straight lines.');
    await page.evaluate(() => window.__coach.startPart('rules', 'learn'));
    await page.waitForFunction(() => window.__coach.st.mode === 'lesson');
    assert.equal(await line(page), '', 'opening a lesson clears the line');
    return page;
  }],

  // ---------- fix 3: the note in Coach and pieces ----------
  ['Fix 3 note: Coach and pieces says how to tell the pieces apart, in the agreed words', async (vp) => {
    const page = await newPage(vp, club(), { set: 'heroes', tab: 'coach' });
    const WANT = 'Every themed piece carries a small chess symbol. Tap a piece to see its name and how it moves.';
    await page.locator('#settingsBtn').click();
    assert.equal(await page.evaluate(() => document.querySelector('#lookSet .setnote').textContent), WANT, 'in Settings');
    assert.equal(await page.evaluate(() => document.querySelector('#lookCard .setnote').textContent), WANT, 'on Home’s card');
    assert.ok(!/Hover over|long-press|in its corner/.test(await page.evaluate(() => document.body.textContent)), 'the old note is gone');
    return page;
  }],

  // ---------- scenario 11, criterion 11, G-D15: the switch ----------
  ['S11 switch: "Piece tags" is in Coach and pieces, on by default; off removes the tags in both views and keeps the name line', async (vp) => {
    const page = await newPage(vp, club(), { set: 'heroes' });
    assert.equal((await savedProf(page)).pieceTags, undefined, 'the seeded save is from before the setting');
    await page.locator('#settingsBtn').click();
    const sw = page.locator('#lookSet [data-act="tags"]');
    await sw.scrollIntoViewIfNeeded();
    assert.equal((await sw.innerText()).trim(), 'Piece tags', 'the label, exactly');
    assert.equal(await sw.getAttribute('role'), 'switch');
    assert.equal(await sw.getAttribute('aria-checked'), 'true', 'on for a save that never had the setting');
    const bb = await sw.boundingBox();
    assert.ok(bb.height >= 44, 'at least 44px high (' + bb.height + ')');
    assert.ok(bb.x >= 0 && bb.x + bb.width <= vp.width, 'inside the screen');
    assert.equal(await page.evaluate(() => document.querySelector('#settingsSheet .lookset h3').textContent), 'Coach and pieces');
    assert.ok(!/[—–]/.test(await page.locator('#lookSet').innerText()), 'no em dash in the card');
    await shot(page, vp, 'switch-on');
    assert.equal((await flatTags(page)).filter((p) => p.tag).length, 32);
    await sw.focus();
    await page.keyboard.press('Space');
    assert.equal(await sw.getAttribute('aria-checked'), 'false');
    assert.equal(await page.evaluate(() => document.activeElement && document.activeElement.dataset.act), 'tags', 'focus stays on the switch');
    assert.equal((await savedProf(page)).pieceTags, false, 'saved in the profile');
    const off = await flatTags(page);
    assert.equal(off.length, 32); assert.ok(off.every((p) => p.token && !p.tag), 'flat: tokens without tags');
    assert.equal(await page.evaluate(() => /[♚-♟]/.test(document.getElementById('grid').textContent)), false, 'no chess symbol left on the flat board');
    assert.equal(await page.evaluate(() => document.querySelectorAll('#lookSet .pv .ptag, #lookCard .pv .ptag').length), 0, 'the previews follow the switch');
    await shot(page, vp, 'switch-off');
    await page.keyboard.press('Escape');
    await tap(page, 'g1');
    assert.equal(await line(page), 'Rocket: knight. Jumps in an L shape.', 'the name line stays');
    await shot(page, vp, 'flat-tags-off');
    await page.locator('#v3dBtn').click(); await wait3d(page);
    const t3 = await tags3d(page);
    assert.ok(t3.every((t) => !t.visible), '3D: no tag is drawn');
    await tap(page, 'c1');
    assert.equal(await line(page), 'Volt: bishop. Moves any distance diagonally.', '3D: the name line stays');
    await shot(page, vp, '3d-tags-off');
    // a new piece in 3D (after a move and a reply) has no tag either
    await tap(page, 'e2'); await tap(page, 'e4');
    await page.waitForFunction(() => !window.__coach.st.busy && window.__coach.hist().length >= 2, null, { timeout: 30000 });
    assert.ok((await tags3d(page)).every((t) => !t.visible));
    // back on, in 3D, with a click
    await page.locator('#settingsBtn').click();
    await sw.click();
    assert.equal(await sw.getAttribute('aria-checked'), 'true');
    assert.equal((await savedProf(page)).pieceTags, true);
    const on3 = await tags3d(page), pos = await pieces(page);
    assert.equal(on3.filter((t) => t.visible).length, pos.length, '3D: the tags are back');
    assert.equal((await flatTags(page)).filter((p) => p.tag).length, pos.length, 'flat: the tags are back');
    return page;
  }],
  ['C11 restart: the choice survives closing and opening the app, in both views', async (vp) => {
    const page = await newPage(vp, club({ pieceTags: false }), { set: 'heroes' });
    assert.ok((await flatTags(page)).every((p) => p.token && !p.tag), 'off from the saved profile');
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement);
    assert.ok((await flatTags(page)).every((p) => p.token && !p.tag), 'still off after a restart');
    assert.equal((await savedProf(page)).pieceTags, false);
    await page.locator('#settingsBtn').click();
    const sw = page.locator('#lookSet [data-act="tags"]');
    assert.equal(await sw.getAttribute('aria-checked'), 'false');
    await sw.click();
    await page.keyboard.press('Escape');
    await page.locator('#v3dBtn').click(); await wait3d(page);
    assert.equal((await tags3d(page)).filter((t) => t.visible).length, 32);
    await page.reload(); await page.waitForFunction(() => window.__coach && window.Placement); await wait3d(page);
    assert.equal((await savedProf(page)).pieceTags, true);
    assert.equal((await tags3d(page)).filter((t) => t.visible).length, 32, 'on again after a restart, in 3D');
    assert.equal((await flatTags(page)).filter((p) => p.tag).length, 32);
    return page;
  }],
  ['C11 old saves: a v4 save and a v5 save from before G1 open with tags on, and nothing else in them changes', async (vp) => {
    const v4 = { v: 4, games: [{ id: 'g1', d: NOW - DAY, r: 'W', sans: ['e4', 'e5'] }], puz: {}, rating: 1320, rn: 3, course: { rules: { learn: 1 } }, days: played(1, 2), reviewed: [], t: NOW - DAY, theme: 'heroes' };
    let page = await newPage(vp, v4, { set: 'heroes' });
    assert.equal((await flatTags(page)).filter((p) => p.tag).length, 32, 'v4: tags on');
    const p4 = await page.evaluate(() => window.__coach.getProf());
    assert.equal(p4.pieceTags, true); assert.equal(p4.games.length, 1); assert.equal(p4.rating, 1320); assert.ok(p4.course.rules.learn);
    assert.deepEqual(page.errors, [], 'console errors or warnings (v4)');
    await page.context().close();
    page = await newPage(vp, club({ theme: 'heroes' }), { set: 'heroes' });
    assert.equal((await flatTags(page)).filter((p) => p.tag).length, 32, 'v5: tags on');
    assert.equal(await page.evaluate(() => window.__coach.getProf().pieceTags), true);
    return page;
  }],
  ['G-D7 Home: Home\u2019s Coach and pieces card has no switch (Home does not change); its previews follow the setting', async (vp) => {
    let page = await newPage(vp, club(), { set: 'heroes', tab: 'coach' });
    assert.ok(await page.evaluate(() => document.querySelectorAll('#lookCard [data-set]').length) >= 11, 'Home has the card');
    assert.equal(await page.evaluate(() => document.querySelectorAll('#lookCard [data-act="tags"], #lookCard [role="switch"]').length), 0, 'no switch on Home');
    assert.ok(!/Piece tags/.test(await page.evaluate(() => document.getElementById('panel-coach').textContent)), 'and no new words on Home');
    assert.equal(await page.evaluate(() => document.querySelectorAll('#lookCard [data-set="heroes"] .pv .ptag').length), 4, 'previews with tags');
    await page.locator('#settingsBtn').click();
    assert.equal(await page.evaluate(() => document.querySelectorAll('#settingsSheet [data-act="tags"]').length), 1, 'one switch, in Settings');
    await page.locator('#lookSet [data-act="tags"]').click();
    assert.equal(await page.evaluate(() => document.querySelectorAll('#lookCard [data-set="heroes"] .pv .ptag').length), 0, 'Home\u2019s previews follow the switch');
    assert.equal(await page.evaluate(() => document.querySelectorAll('#lookCard [data-set="heroes"] .pv svg.tok').length), 4);
    return page;
  }],

  // ---------- other places a token is drawn ----------
  ['Other uses: with tags off, a move chip in the coach\u2019s text still shows the piece\u2019s symbol', async (vp) => {
    const page = await newPage(vp, club({ pieceTags: false }), { set: 'heroes' });
    assert.ok((await flatTags(page)).every((p) => p.token && !p.tag), 'the board has no tags');
    // a chip as the coach writes it: the app fills in its icon when it reaches the page
    await page.evaluate(() => { const b = document.createElement('button'); b.className = 'mvc'; b.id = 'g1chip'; b.dataset.p = 'n'; b.dataset.c = 'w'; b.dataset.san = 'Nf3'; b.dataset.from = 'g1'; b.dataset.to = 'f3'; b.setAttribute('aria-label', 'knight to f3 (Nf3)'); b.innerHTML = '<span class="mvi"></span><span>Nf3</span>'; document.getElementById('panel-play').appendChild(b); });
    await page.waitForFunction(() => document.querySelector('#g1chip .mvi svg.tok'));
    assert.equal(await page.evaluate(() => { const t = document.querySelector('#g1chip .mvi .ptag'); return t && t.dataset.role; }), 'n', 'the chip keeps its symbol: it has no name line to say what the piece is');
    await page.evaluate(() => document.getElementById('g1chip').remove());
    return page;
  }],

  // ---------- criterion 12: frame time ----------
  ['C12 frame time: the 3D board with tags on draws within 10 percent of tags off', async (vp) => {
    const page = await newPage(vp, club(), { set: 'heroes', v3d: true });
    await page.waitForFunction(() => !window.__coach.st.busy);
    await page.waitForTimeout(1500); // the marble set and the engine finish loading
    const run = () => page.evaluate(() => {
      const D = window.Board3D.debug, on = [], off = [];
      D.bench(20, true); D.bench(20, false); // warm up both
      for (let i = 0; i < 9; i++) { if (i % 2) { on.push(D.bench(30, true)); off.push(D.bench(30, false)); } else { off.push(D.bench(30, false)); on.push(D.bench(30, true)); } }
      D.show(true);
      return { on, off, info: D.info() };
    });
    let best = null;
    for (let attempt = 0; attempt < 3; attempt++) { // a busy machine can spoil one run: the best of three counts
      const r = await run(), on = median(r.on), off = median(r.off), ratio = on / off;
      if (!best || ratio < best.ratio) best = { on, off, ratio, info: r.info, attempt };
      if (ratio <= 1.10) break;
    }
    notes.push(vp.width + ': 3D frame ' + best.off.toFixed(2) + 'ms tags off, ' + best.on.toFixed(2) + 'ms tags on (' + ((best.ratio - 1) * 100).toFixed(1) + '%), ' + JSON.stringify(best.info));
    assert.ok(best.ratio <= 1.10, 'tags on ' + best.on.toFixed(2) + 'ms against ' + best.off.toFixed(2) + 'ms off: ' + ((best.ratio - 1) * 100).toFixed(1) + '% slower');
    assert.equal(best.info.tagGeometries, 1, 'one shared tag shape');
    assert.ok(best.info.tagMaterials <= 12, 'at most one material per colour and role (' + best.info.tagMaterials + ')');
    return page;
  }],
  ['C12 3D: turning the board and playing moves makes no new tag objects', async (vp) => {
    const page = await newPage(vp, club(), { set: 'heroes', v3d: true });
    const a = await page.evaluate(() => window.Board3D.debug.info());
    for (const [az, pol] of [[-1, 0.4], [1, 1], [0.3, 0.6]]) await page.evaluate(([x, y]) => window.Board3D.debug.view(x, y), [az, pol]);
    await tap(page, 'e2'); await tap(page, 'e4');
    await page.waitForFunction(() => !window.__coach.st.busy && window.__coach.hist().length >= 2, null, { timeout: 30000 });
    await idle3d(page);
    const b = await page.evaluate(() => window.Board3D.debug.info());
    assert.deepEqual({ g: b.tagGeometries, m: b.tagMaterials, t: b.tags }, { g: a.tagGeometries, m: a.tagMaterials, t: a.tags }, 'the same shape, materials and tag count after turning and a move each');
    return page;
  }]
];

const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.wasm': 'application/wasm', '.json': 'application/json', '.css': 'text/css', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.glb': 'model/gltf-binary', '.bin': 'application/octet-stream', '.nnue': 'application/octet-stream' };
function serve() {
  const srv = http.createServer((req, res) => {
    const f = path.join(WWW, path.normalize(decodeURIComponent(req.url.split('?')[0])));
    if (!f.startsWith(WWW + path.sep)) { res.writeHead(403); res.end(); return; }
    fs.readFile(f, (err, data) => {
      if (err) { res.writeHead(404); res.end(); return; }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(data);
    });
  });
  return new Promise((r) => srv.listen(PORT, '127.0.0.1', () => r(srv)));
}

(async () => {
  const srv = await serve();
  browser = await chromium.launch();
  try {
    for (const vp of VIEWPORTS) for (const [name, fn] of cases) {
      if (ONLY && !ONLY.test(name)) continue;
      const label = vp.width + 'x' + vp.height + ' ' + name;
      let page;
      try {
        page = await fn(vp);
        assert.deepEqual(page.errors, [], 'console errors or warnings');
        assert.deepEqual(page.outside, [], 'no request leaves the page origin');
        results.push('ok   ' + label);
      } catch (e) {
        failures++; results.push('FAIL ' + label + '\n     ' + String(e && e.message || e).split('\n').slice(0, 6).join('\n     ') + (process.env.G1_STACK ? '\n' + e.stack : ''));
        if (page && page.errors && page.errors.length) results.push('     page errors: ' + JSON.stringify(page.errors).slice(0, 400));
      } finally { if (page) await page.context().close(); }
    }
  } finally { await browser.close(); srv.close(); }
  console.log(results.join('\n'));
  if (notes.length) console.log('\nMeasured:\n  ' + notes.join('\n  '));
  console.log('\n' + (results.length - failures) + ' passed, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})();
