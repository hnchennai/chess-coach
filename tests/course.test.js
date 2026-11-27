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

// D53: the later levels' course text names the opponent as "Rani's partner" plus its strength name, with no engine words and no
// rating numbers. Every level reads every unit and the methods card.
test('D53: no engine words or rating numbers in any unit, nor on the methods card', () => {
  const texts = [];
  C.UNITS.forEach((u) => { texts.push(u.title, u.goal); (u.lesson || []).forEach((s) => texts.push(s.text)); if (u.apply) texts.push(u.apply.text || ''); });
  C.METHODS.forEach((m) => texts.push(m.how, m.here));
  // kept by D53: the analysis lesson's "turn on the engine" (stage 4 and up, the real tool name for those players)
  for (const t of texts.filter((x) => !/Only then turn on the engine\./.test(x))) {
    assert.ok(!/stockfish|engine/i.test(t), t);
    assert.ok(!/\b(about|~)\s?\d{3,4}\b|\b(1000|1320|1600|2000|2100)\b/.test(t), t);
  }
});

test('D53: the signed lines', () => {
  assert.equal(unit('check2').goal, 'Win against Rani’s partner at Improver level.');
  assert.equal(unit('check2').apply.text, 'Beat Rani’s partner at Improver level. Any color.');
  assert.equal(unit('check3').apply.text, 'Beat Rani’s partner at Club level.');
  assert.ok(unit('check3').lesson[0].text.endsWith('At Club level, Rani’s partner plays like a good club player.'));
  assert.equal(unit('check4').goal, 'Win against Rani’s partner at Strong club level.');
  assert.equal(unit('final').apply.text, 'Beat Rani’s partner at Expert level.');
  const drills = C.UNITS.filter((u) => u.apply && u.apply.type === 'drill' && u.apply.goal === 'mate'); // a hold drill (Philidor): the partner tries to win
  assert.ok(drills.length >= 4);
  for (const u of drills) assert.ok(u.apply.text.endsWith('Rani’s partner defends as well as it can.'), u.apply.text);
  assert.ok(JSON.stringify(C).includes('Italian vs Hungarian Defense'));
  assert.equal(unit('endtheory').apply.text, 'You are Black. Hold the draw for 25 moves with the Philidor defense. Rani’s partner tries to win.');
  assert.ok(unit('structures').lesson[2].text.endsWith('separates a strong club player from an expert.'));
  assert.equal(C.METHODS.find((m) => /small steps/.test(m.name)).how.split('. ')[1], 'The Dutch Steps Method teaches this way, from the first rules all the way to expert level.');
});
