// D33: level 1 course text (read by every level, including Beginners) never says "engine" or "Stockfish". Run: node --test tests/course.test.js
const test = require('node:test');
const assert = require('node:assert/strict');
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
for (const f of ['course', 'roadmap']) vm.runInContext(fs.readFileSync(path.join(__dirname, '../www/js/' + f + '.js'), 'utf8'), ctx);
const C = vm.runInContext('COURSE', ctx);
const unit = (id) => C.UNITS.find((u) => u.id === id);

test('D33: the four signed level 1 lines', () => {
  const op = unit('opening');
  assert.equal(op.lesson[op.lesson.length - 1].text, 'Your task: play a game against Rani’s practice partner and get <b>both knights, both bishops out and castle</b> by move 12. The checklist in the Play tab tracks it.');
  assert.equal(op.apply.text, 'Play Rani’s practice partner. Develop all four minor pieces and castle by move 12.');
  assert.equal(unit('blunder').apply.text, 'Play Rani’s practice partner. Goal: no blunders in your first 20 moves.');
  assert.equal(unit('blunder').apply.level, 2, 'the game still uses the level 2 bot');
  assert.ok(C.ROADMAP[0].method.includes('Play Rani’s practice partner with the coach on. Read every explanation.'));
});

test('D33: no engine words left in level 1 units or the stage 1 method', () => {
  const texts = [];
  C.UNITS.filter((u) => u.level === 1).forEach((u) => { texts.push(u.title, u.goal); (u.lesson || []).forEach((s) => texts.push(s.text)); if (u.apply) texts.push(u.apply.text || ''); });
  texts.push(...C.ROADMAP[0].method);
  for (const t of texts) assert.ok(!/stockfish|engine|\(\?\?\)/i.test(t), t);
});
