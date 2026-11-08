/* ---------- Words: the last move in plain words for Beginners (S2a, D17). Pure: no DOM, no network. ---------- */
(function (root, factory) {
  var W = factory();
  if (typeof module === 'object' && module.exports) module.exports = W; else root.Words = W;
})(typeof window !== 'undefined' ? window : this, function () {
  'use strict';
  var PARTNER = 'Rani’s practice partner';
  var NAME = { p: 'pawn', n: 'knight', b: 'bishop', r: 'rook', q: 'queen', k: 'king' };

  /* m: a chess.js verbose move ({ piece, captured, promotion, flags, san }). mine: true when the player made it. */
  function say(m, mine) {
    if (!m || !m.piece) return '';
    var san = m.san || '', flags = m.flags || '', who = mine ? 'You' : 'Rani’s partner', s;
    if (san.indexOf('#') > -1) return mine ? 'Checkmate. You won!' : 'Checkmate. Rani’s partner won.';
    if (flags.indexOf('k') > -1 || flags.indexOf('q') > -1) s = mine ? 'You castled to keep your king safe.' : 'Rani’s partner castled to keep the king safe.';
    else {
      var took = m.captured ? 'took ' + (mine ? 'a ' : 'your ') + NAME[m.captured] : '';
      var promo = m.promotion ? 'turned a pawn into a ' + NAME[m.promotion] : '';
      var act;
      if (took && promo) act = took + ' and ' + promo;
      else if (took) act = took;
      else if (promo) act = promo;
      else if (m.piece === 'p') act = 'moved a pawn forward';
      else if (m.piece === 'k' || m.piece === 'q') act = 'moved ' + (mine ? 'your ' : 'the ') + NAME[m.piece];
      else act = 'moved a ' + NAME[m.piece];
      s = who + ' ' + act + '.';
    }
    return san.indexOf('+') > -1 ? s + ' Check!' : s;
  }

  return { say: say, PARTNER: PARTNER };
});
