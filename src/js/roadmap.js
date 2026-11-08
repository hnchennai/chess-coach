/* ---------- Roadmap: theory-first path from rules to Expert ---------- */
(function () {
  var C = COURSE, U = C.UNITS;
  function idx(id) { for (var i = 0; i < U.length; i++) if (U[i].id === id) return i; return -1; }

  /* ----- theory first: two new units at the very start ----- */
  var rules = { id: 'rules', level: 1, title: 'How the pieces move', goal: 'Know every piece’s moves without thinking.',
    lesson: [
      { fen: '7k/8/8/8/3R4/8/8/K7 w - - 0 1', arrows: [['d4', 'd8'], ['d4', 'h4'], ['d4', 'd1'], ['d4', 'a4']], text: '<b>Theory first.</b> The <b>rook</b> moves any distance in a straight line: up, down, left or right. It can’t jump over pieces. Worth 5 points.' },
      { fen: '7k/8/8/8/3B4/8/8/K7 w - - 0 1', arrows: [['d4', 'g7'], ['d4', 'a7'], ['d4', 'g1'], ['d4', 'b2']], text: 'The <b>bishop</b> moves any distance diagonally. A bishop stays on its own color for the whole game. Worth 3.' },
      { fen: '7k/8/8/8/3Q4/8/8/K7 w - - 0 1', arrows: [['d4', 'd8'], ['d4', 'g7'], ['d4', 'h4'], ['d4', 'b2']], text: 'The <b>queen</b> moves like a rook and a bishop combined. The strongest piece, worth 9. Don’t lose her cheaply.' },
      { fen: '7k/8/8/8/3N4/8/8/K7 w - - 0 1', arrows: [['d4', 'e6'], ['d4', 'f5'], ['d4', 'f3'], ['d4', 'e2'], ['d4', 'c2'], ['d4', 'b3'], ['d4', 'b5'], ['d4', 'c6']], text: 'The <b>knight</b> jumps in an L: two squares one way, one square sideways. It’s the only piece that jumps over others. Worth 3.' },
      { fen: '7k/8/8/8/8/8/4P3/4K3 w - - 0 1', arrows: [['e2', 'e4'], ['e1', 'd2'], ['e1', 'f1']], text: 'The <b>pawn</b> moves forward one square, or two on its first move. The <b>king</b> moves one square in any direction and can never step into check.' },
      { fen: '7k/8/8/3p4/4P3/8/8/K7 w - - 0 1', arrows: [['e4', 'd5']], text: 'Pawns <b>capture diagonally</b>, one square forward. All other pieces capture the same way they move.' },
      { fen: '7k/8/8/8/3N4/8/8/K7 w - - 0 1', text: 'Now practice: I’ll put a piece on the board and you tap <b>every square it can reach</b>.' }
    ],
    practice: { type: 'reach', count: 6, pass: 5 } };

  var special = { id: 'special', level: 1, title: 'Special rules and draws', goal: 'Castling, en passant, promotion and draws.',
    lesson: [
      { fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1', arrows: [['e1', 'g1'], ['e1', 'c1']], text: '<b>Castling:</b> the king moves two squares toward a rook, and the rook jumps over it. Allowed only if neither piece has moved, the squares between are empty, and the king is not in check, doesn’t pass through check and doesn’t land in check.' },
      { fen: '4k3/8/8/3pP3/8/8/8/4K3 w - d6 0 1', arrows: [['e5', 'd6']], text: '<b>En passant:</b> Black’s pawn just jumped two squares and landed beside White’s pawn. On the very next move only, White may capture it as if it had moved one square: exd6.' },
      { fen: '4k3/1P6/8/8/8/8/8/4K3 w - - 0 1', arrows: [['b7', 'b8']], text: '<b>Promotion:</b> a pawn that reaches the last rank becomes a queen, rook, bishop or knight. Almost always choose a queen.' },
      { fen: 'k7/8/1Q6/8/8/8/8/K7 b - - 0 1', hl: ['a8'], text: '<b>Draws:</b> stalemate (no legal move and not in check), the same position three times, 50 moves with no capture or pawn move, or not enough pieces left to mate (like king against king).' }
    ] };

  var bi = idx('board');
  U.splice(bi, 0, rules, special);

  /* ----- Level 6: Expert ----- */
  C.LEVELS[4].band = 'Advanced · 1600 to 1900';
  C.LEVELS.push({ id: 6, name: 'Expert', band: 'Expert · 1900 to 2100+', blurb: 'Pawn structures, planning, endgame theory, analysing your own games, and playing to win in tournaments.' });
  var fin = U.splice(idx('final'), 1)[0]; fin.level = 6;

  U.push({ id: 'structures', level: 6, title: 'Pawn structures', goal: 'Know the plan from the pawns.',
    lesson: [
      { fen: 'r1bq1rk1/pp2bppp/2n1pn2/8/3P4/2NB1N2/PP3PPP/R1BQ1RK1 w - - 0 9', hl: ['d4'], text: '<b>The pawns tell you the plan.</b> White has an <b>isolated queen’s pawn</b> (IQP) on d4. Plans for White: active pieces, a kingside attack, the d4-d5 break, a knight on e5. Plans for Black: blockade d5, trade pieces, win the pawn in the endgame.' },
      { fen: 'r1bq1rk1/pp1nbppp/2p2n2/3p2B1/3P4/2NBPN2/PPQ2PPP/R3K2R w KQ - 0 9', hl: ['b2', 'a2', 'c6', 'd5'], text: '<b>Carlsbad structure:</b> White’s classic plan is the <b>minority attack</b>: push b4 and b5 to create a weak c6 pawn. Black looks for play on the kingside or with ...Ne4.' },
      { fen: START_FEN(), text: 'Strong players ask “what structure is this?” before “what move?”. Learn 5 or 6 structures from your own openings and their typical plans. That knowledge is most of what separates 1800 from 2000.' }
    ],
    practice: { type: 'puzzles', themes: ['advantage', 'sacrifice', 'discovered', 'pin', 'skewer'], min: 1550, max: 2600, count: 8, pass: 5 } });

  U.push({ id: 'planning', level: 6, title: 'Planning and prophylaxis', goal: 'Make a plan, stop theirs.',
    lesson: [
      { fen: START_FEN(), text: '<b>A simple planning method:</b> 1. What changed with their last move? 2. Where is their king, and where are the weak squares and pawns? 3. Which of my pieces is worst? 4. What does my opponent want? 5. Pick a plan that improves my worst piece or attacks their weakness, and stop their idea if it’s dangerous.' },
      { fen: START_FEN(), text: '<b>Prophylaxis</b> means preventing the opponent’s plan before it happens: a pawn move that takes away a square, a rook that defends in advance, a king move to safety. Experts spend a lot of moves this way.' },
      { fen: START_FEN(), text: '<b>Candidate moves:</b> list 2 or 3 serious options, calculate each to a quiet position, then compare. Check the opponent’s best reply, not the one you hope for.' }
    ],
    practice: { type: 'safety', count: 12, pass: 10, hard: true } });

  U.push({ id: 'endtheory', level: 6, title: 'Endgame theory', goal: 'Hold the draw in the Philidor position.',
    lesson: [
      { fen: '4k3/7r/8/4PK2/8/8/8/R7 b - - 0 1', arrows: [['h7', 'h6']], text: '<b>Philidor defense:</b> keep your rook on your third rank (...Rh6 here) so the enemy king can’t come forward. When the pawn advances to e6, it can no longer shelter the king: swing the rook to the back rank and check from behind.' },
      { fen: '7k/8/6K1/7P/8/8/8/5B2 w - - 0 1', hl: ['h8'], text: '<b>Wrong bishop:</b> with an h-pawn, if your bishop can’t control the queening corner (h8 is dark, this bishop is light-squared), the lone king holds a draw in the corner.' },
      { fen: '8/5k2/8/3b4/8/2B5/4PK2/8 w - - 0 1', text: '<b>Opposite-colored bishops</b> are very drawish in the endgame, even a pawn or two down: the defender blockades on squares the other bishop can’t touch.' },
      { fen: '8/8/8/P7/8/k7/8/R5K1 w - - 0 1', arrows: [['a1', 'a4']], text: '<b>Rooks belong behind passed pawns.</b> Behind your own pawn the rook gains power as the pawn advances. Behind theirs, it holds the pawn back from a distance.' }
    ],
    apply: { type: 'drill', fen: '4k3/7r/8/4PK2/8/8/8/R7 b - - 0 1', goal: 'hold', limit: 25, text: 'You are Black. Hold the draw for 25 moves with the Philidor defense. Stockfish tries to win.' } });

  U.push({ id: 'analysis', level: 6, title: 'Analysing your own games', goal: 'Turn every game into a lesson.',
    lesson: [
      { fen: START_FEN(), text: '<b>The single biggest habit of improving players:</b> analyse every serious game, especially losses. Ten minutes per game is enough.' },
      { fen: START_FEN(), text: '<b>Do it in this order.</b> 1. Right after the game, go through it yourself and note what you were thinking. 2. Only then turn on the engine. 3. Find the turning point: the first move where the evaluation swung. 4. Write one sentence: the lesson from this game.' },
      { fen: START_FEN(), text: 'Look for patterns across games: if three losses came from loose pieces, that is your training plan for the next two weeks. The Progress tab does this counting for you.' }
    ],
    apply: { type: 'reviews', count: 3, text: 'Review 3 finished games to the last move with the coach. Open Progress, tap Review on a game, and step through it.' } });

  U.push({ id: 'tourney', level: 6, title: 'Playing to win', goal: 'Practical skills for serious games.',
    lesson: [
      { fen: START_FEN(), text: '<b>Time:</b> play slow games (at least 15+10 online, longer over the board). Spend time on critical moments: when you have checks or captures, or when the structure is about to change. Play quickly when the move is obvious.' },
      { fen: START_FEN(), text: '<b>Openings:</b> a narrow repertoire you understand beats a wide one you memorised. Know the plans and typical structures, not just 20 moves.' },
      { fen: START_FEN(), text: '<b>Mindset:</b> after a mistake, reset and find the best move from here. Don’t offer or accept draws from fear. Rated games against stronger players teach the most.' }
    ] });

  U.push(fin);

  /* ----- the roadmap ----- */
  C.ROADMAP = [
    { stage: 1, level: 1, name: 'Rules and foundations', band: '0 to 800', target: 900, beat: 1,
      why: 'Theory first: how pieces move, special rules, notation and what pieces are worth. Then the first two skills that decide beginner games: spotting checkmate and not giving pieces away.',
      method: ['Learn one idea, then do 5 to 10 tiny exercises on it right away (the Steps Method way).', 'Name squares and piece moves until it’s automatic. It frees your brain for thinking.', 'Play the Beginner engine with the coach on. Read every explanation.'],
      routine: ['10 min: one lesson step', '10 min: easy puzzles', '3 times a week: one game vs Beginner'],
      resources: [['Lichess Learn (free)', 'https://lichess.org/learn'], ['Steps Method, Step 1 workbook (Brunia and van Wijgerden)', 'https://newinchess.com/the-complete-step-by-step-method-and-all-additional-workbooks'], ['Bobby Fischer Teaches Chess (book)', '']] },
    { stage: 2, level: 2, name: 'Tactics', band: '800 to 1200', target: 1200, beat: 3,
      why: 'At this level most games are decided by tactics. You learn the four patterns that win material (forks, pins, skewers, discovered attacks) and the classic mates.',
      method: ['Theme first, then mixed: solve 20 forks, then 20 pins, then mix them so you must spot the pattern yourself.', 'Repeat missed puzzles on later days (spaced repetition). The Review list does it for you.', 'Blunder check before every move: their threat, my checks, captures and threats.'],
      routine: ['15 min: puzzles (theme of the week)', '5 min: review missed puzzles', '3 times a week: one 15+10 game, then review it'],
      resources: [['1001 Chess Exercises for Beginners (Masetti and Messa)', ''], ['Steps Method, Step 2', 'https://newinchess.com/the-complete-step-by-step-method-and-all-additional-workbooks'], ['Lichess Puzzle Themes (free)', 'https://lichess.org/training/themes']] },
    { stage: 3, level: 3, name: 'Endgames and calculation', band: '1100 to 1400', target: 1400, beat: 4,
      why: 'Capablanca advised learning endgames early: with few pieces you learn what each one can really do. You also start calculating two moves deep without moving pieces.',
      method: ['Drill each basic ending against Stockfish until you can win it every time.', 'Solve mate-in-2 puzzles without touching the pieces. Say the whole line before you move.', 'Play longer games and look for the plan, not just the next move.'],
      routine: ['10 min: one endgame drill', '15 min: calculation puzzles', 'Weekly: 3 slow games, each reviewed'],
      resources: [['Silman’s Complete Endgame Course (organised by rating)', ''], ['Lichess Practice: checkmates and endgames (free)', 'https://lichess.org/practice']] },
    { stage: 4, level: 4, name: 'Strategy and openings', band: '1300 to 1700', target: 1600, beat: 5,
      why: 'Now you need plans. A small opening repertoire you understand, active pieces, pawn structure and how to attack the king.',
      method: ['Play through annotated master games move by move and guess the next move before reading.', 'Drill your repertoire lines until you play them without hints, then learn the plans behind them.', 'Analyse every loss: find the turning point and write one lesson.'],
      routine: ['10 min: opening drill', '15 min: mixed puzzles', '15 min: one annotated master game', 'Weekly: 3 slow games, reviewed'],
      resources: [['Logical Chess: Move by Move (Irving Chernev)', ''], ['Build Up Your Chess 1 (Artur Yusupov)', '']] },
    { stage: 5, level: 5, name: 'Advanced skills', band: '1600 to 1900', target: 1800, beat: 5,
      why: 'Deeper calculation, the rook endgames that come up in half of all games, and defending well when things go wrong.',
      method: ['Woodpecker method: solve the same set of hard puzzles again and again, faster each round, until the patterns are instant.', 'Learn Lucena and Philidor until you can play them blindfold.', 'Before each move, ask what your opponent wants (prophylaxis).'],
      routine: ['20 min: hard puzzles (repeat sets)', '10 min: rook endings', 'Weekly: 2 to 3 long games, deep review'],
      resources: [['The Woodpecker Method (Smith and Tikkanen)', 'https://www.newinchess.com/the-woodpecker-method'], ['Build Up Your Chess 2 and 3 (Yusupov)', '']] },
    { stage: 6, level: 6, name: 'Expert', band: '1900 to 2100+', target: 2000, beat: 6,
      why: 'Expert (2000 to 2199 on the US Chess scale) is about understanding: pawn structures and their plans, endgame theory, and honest analysis of your own games.',
      method: ['Study pawn structures from your own openings and their typical plans.', 'Analyse your games yourself first, then with the engine. Keep a notebook of lessons.', 'Play rated games against stronger players, over the board if you can.'],
      routine: ['20 min: hard puzzles', '20 min: structures or endgame theory', 'Weekly: 2 long rated games, full analysis'],
      resources: [['Chess Structures: A Grandmaster Guide (Flores Rios)', ''], ['Steps Method Steps 5 and 6', 'https://newinchess.com/the-complete-step-by-step-method-and-all-additional-workbooks']] }
  ];

  C.METHODS = [
    { name: 'Learn by doing, in small steps', how: 'One idea, then a handful of exercises right away. Used by the Dutch Steps Method that takes learners from rules to about 2100.', here: 'Every unit is Learn, Practice, Apply.' },
    { name: 'Puzzles by theme, then mixed', how: 'Seeing the same pattern many times builds recognition. Mixing them teaches you to find the pattern yourself.', here: 'Train tab: one theme, or rated mixed puzzles.' },
    { name: 'Spaced repetition', how: 'Puzzles you miss come back after 1, 2, 4, 7 days until they stick. Later, the Woodpecker method repeats whole sets faster each time.', here: 'Review missed puzzles, on your daily plan.' },
    { name: 'Play slow, review every game', how: 'Slow games give you time to think. Reviewing them shows your real weaknesses.', here: 'Play tab with move grades and full review.' },
    { name: 'Endgames early', how: 'With few pieces you learn what each piece can do. Basic endings also win you half-points every month.', here: 'Endgame drills against Stockfish.' },
    { name: 'A coach who explains why', how: 'Feedback right after the move is how skills form fastest.', here: 'Every move graded and explained, with moves you can tap to see on the board.' }
  ];
  function START_FEN() { return C.START; }
})();
