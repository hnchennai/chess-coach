/* ---------- The course: levels, units, lessons, drills ---------- */
var COURSE = (function () {
  var START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';
  var LEVELS = [
    { id: 1, name: 'Foundations', band: 'Beginner · up to 800', blurb: 'Read the board, win free pieces, deliver checkmate, and stop giving pieces away.' },
    { id: 2, name: 'Tactics', band: 'Improver · 800 to 1200', blurb: 'The four tactics that win most games at club level, plus the classic mating patterns.' },
    { id: 3, name: 'Endgames and calculation', band: 'Club · 1100 to 1400', blurb: 'Checkmate with king and queen or rook, king and pawn endings, and seeing two moves ahead.' },
    { id: 4, name: 'Strategy', band: 'Strong club · 1300 to 1700', blurb: 'A real opening repertoire, active pieces, pawn structure, and how to attack the king.' },
    { id: 5, name: 'Advanced', band: 'Expert path · 1600 and up', blurb: 'Deep calculation, rook endgames every player must know, defense, and converting wins.' }
  ];
  var U = [];
  function unit(o) { U.push(o); }

  /* ===== Level 1 ===== */
  unit({ id: 'board', level: 1, title: 'Board and notation', goal: 'Name any square in two seconds.',
    lesson: [
      { fen: START, hl: ['a1', 'h1', 'a8', 'h8'], text: 'The board has 8 <b>files</b> (columns a to h) and 8 <b>ranks</b> (rows 1 to 8). White always starts on ranks 1 and 2. A light square sits in each player’s right corner.' },
      { fen: START, arrows: [['e2', 'e4']], hl: ['e4'], text: 'Every square has a name: file letter, then rank number. This pawn goes from <b>e2</b> to <b>e4</b>. We just write <b>e4</b>.' },
      { fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', arrows: [['g1', 'f3']], text: 'Pieces use a capital letter: <b>K</b> king, <b>Q</b> queen, <b>R</b> rook, <b>B</b> bishop, <b>N</b> knight. Pawns get no letter. <b>Nf3</b> means knight to f3.' },
      { fen: 'rnbqkbnr/ppp1pppp/8/3p4/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2', arrows: [['e4', 'd5']], text: '<b>x</b> means capture. A pawn capture names the file it came from: <b>exd5</b> is the e-pawn taking on d5. <b>+</b> is check, <b>#</b> is checkmate, <b>O-O</b> is castling short.' },
      { fen: START, text: 'Now practice. I’ll name a square and you tap it. Try to answer without reading the little letters on the edge.' }
    ],
    practice: { type: 'squares', count: 12, pass: 10 } });

  unit({ id: 'values', level: 1, title: 'Piece values and free pieces', goal: 'Never miss a free piece, never give one away.',
    lesson: [
      { fen: START, text: 'Piece values: <b>pawn 1</b>, <b>knight 3</b>, <b>bishop 3</b>, <b>rook 5</b>, <b>queen 9</b>. The king is priceless. Trading a knight for a bishop is even. Giving a rook for a knight loses 2 points.' },
      { fen: 'r1bqkb1r/pppp1ppp/5n2/4n3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 1', hl: ['e5'], arrows: [['f3', 'e5']], text: 'A piece is <b>hanging</b> when it’s attacked and not defended. Black’s knight on e5 has no defender. <b>Nxe5</b> wins it for free.' },
      { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', hl: ['e5'], arrows: [['f3', 'e5']], text: 'Here e5 is attacked once (by Nf3) and defended once (by Nc6). Nxe5 Nxe5 just loses the knight for a pawn. <b>Count attackers and defenders before you capture.</b>' },
      { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3', text: 'Rule of thumb: if you have <b>more attackers</b> than they have defenders, and you take with your <b>cheapest piece first</b>, you usually win material.' }
    ],
    practice: { type: 'puzzles', themes: ['hanging'], max: 1050, count: 6, pass: 5, extra: ['free1'] } });

  unit({ id: 'mate', level: 1, title: 'Check and checkmate', goal: 'Spot checkmate in one, every time.',
    lesson: [
      { fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1', arrows: [['a1', 'a8']], text: '<b>Check</b> means the king is attacked. After Ra8+, Black must get out of check. There are three ways: <b>move</b> the king, <b>block</b> the line, or <b>capture</b> the checking piece.' },
      { fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', arrows: [['d1', 'd8']], hl: ['f7', 'g7', 'h7'], text: '<b>Checkmate</b> is check with no way out. Here Rd8 is mate: the king’s own pawns block its escape. This is the famous <b>back-rank mate</b>.' },
      { fen: 'k7/8/1Q6/8/8/8/8/K7 b - - 0 1', hl: ['a8'], text: 'Careful: this is <b>stalemate</b>. Black is not in check but has no legal move, so the game is a <b>draw</b>. When you’re winning, always leave the enemy king a square until you can mate.' },
      { fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1', arrows: [['h5', 'f7']], text: 'Look at <b>every check</b> before you move. Qxf7 is checkmate: the bishop on c4 protects the queen, and the king can’t escape.' }
    ],
    practice: { type: 'puzzles', themes: ['mateIn1'], max: 1150, count: 8, pass: 6, extra: ['mate1', 'mate2', 'mate4', 'mate5'] } });

  unit({ id: 'opening', level: 1, title: 'Opening principles', goal: 'Developed and castled by move 12.',
    lesson: [
      { fen: START, arrows: [['e2', 'e4'], ['d2', 'd4']], text: '<b>1. Grab the center.</b> Pawns on e4 and d4 (or e5 and d5 as Black) control the middle and open lines for your bishops and queen.' },
      { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', arrows: [['g1', 'f3'], ['f1', 'c4']], text: '<b>2. Develop knights and bishops.</b> Knights toward the center (f3, c3), bishops to open diagonals. Each move should bring a new piece into play.' },
      { fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5', arrows: [['e1', 'g1']], text: '<b>3. Castle early.</b> Usually by move 8 to 10. Your king hides behind pawns and your rook comes toward the center.' },
      { fen: 'r1bqkbnr/pppp1p1p/2n3p1/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 4', arrows: [['g6', 'h5']], text: '<b>4. Don’t bring the queen out early.</b> Here the queen gets chased by a pawn and Black gains time. Knights and bishops first, queen later.' },
      { fen: START, text: 'Your task: play a game against the Beginner engine and get <b>both knights, both bishops out and castle</b> by move 12. The checklist in the Play tab tracks it.' }
    ],
    apply: { type: 'game', level: 1, goal: 'develop', text: 'Play the Beginner engine. Develop all four minor pieces and castle by move 12.' } });

  unit({ id: 'blunder', level: 1, title: 'The blunder check', goal: 'Stop losing pieces to one-move tricks.',
    lesson: [
      { fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', arrows: [['h5', 'f7'], ['c4', 'f7']], text: 'Every move, ask first: <b>what does my opponent’s last move threaten?</b> Here White threatens Qxf7 checkmate. Black must deal with it.' },
      { fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3', arrows: [['g7', 'g6']], text: '...g6 blocks the attack and hits the queen. Defending with a move that also <b>attacks</b> is the best kind of defense.' },
      { fen: START, text: 'The 10-second blunder check: <b>1.</b> What does their move attack? <b>2.</b> My checks, captures, threats. <b>3.</b> After my move, can they take anything for free?' },
      { fen: START, text: 'Practice: I’ll show you real positions and a move someone wants to play. You decide: <b>safe</b> or <b>blunder</b>?' }
    ],
    practice: { type: 'safety', count: 10, pass: 8 },
    apply: { type: 'game', level: 2, goal: 'noBlunder', text: 'Play the Casual engine. Goal: no blunders (??) in your first 20 moves.' } });

  /* ===== Level 2 ===== */
  unit({ id: 'fork', level: 2, title: 'Forks', goal: 'Attack two things at once.',
    lesson: [
      { fen: '3q3k/6pp/8/4N3/8/8/6PP/6K1 w - - 0 1', arrows: [['e5', 'f7']], text: 'A <b>fork</b> is one piece attacking two targets. Nf7+ checks the king and attacks the queen. Black must move the king, then the queen falls.' },
      { fen: '3q3k/5Npp/8/8/8/8/6PP/6K1 b - - 1 1', arrows: [['f7', 'h8'], ['f7', 'd8']], text: 'Knights are the best forkers: they jump, and their odd move pattern is easy to miss. <b>Checks plus attacks</b> are the deadliest forks.' },
      { fen: '7k/8/2n1b3/8/2PP4/8/8/4K3 w - - 0 1', arrows: [['d4', 'd5']], text: 'Pawns fork too. d5 hits the knight and the bishop, and the c4 pawn protects d5. One piece will fall.' },
      { fen: '7k/8/2n1b3/8/2PP4/8/8/4K3 w - - 0 1', text: 'How to find forks: look for enemy pieces that are <b>undefended</b> or <b>more valuable</b> than your attacker, then find a square that hits two of them.' }
    ],
    practice: { type: 'puzzles', themes: ['fork'], min: 600, max: 1500, count: 8, pass: 6, extra: ['fork1', 'pfork1'] } });

  unit({ id: 'pin', level: 2, title: 'Pins and skewers', goal: 'Use lines to win pieces.',
    lesson: [
      { fen: '6k1/pp4pp/8/3q4/2B5/1P6/P5PP/6K1 b - - 1 1', arrows: [['c4', 'g8']], hl: ['d5'], text: 'A <b>pin</b>: the queen can’t move away because the king is behind it. Bc4 wins the queen for a bishop.' },
      { fen: '8/7q/8/8/4k3/8/2B5/K7 b - - 1 1', arrows: [['c2', 'h7']], text: 'A <b>skewer</b> is a pin in reverse: attack the valuable piece first. Bc2+ checks the king; when it moves, Bxh7 takes the queen.' },
      { fen: 'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 5', arrows: [['b4', 'e1']], hl: ['c3'], text: 'Pins happen every game. Here the knight on c3 is pinned to the king. A pinned piece is a <b>bad defender</b> and a target to pile up on.' },
      { fen: 'r1bqk2r/pppp1ppp/2n2n2/4p3/1bB1P3/2NP1N2/PPP2PPP/R1BQK2R w KQkq - 0 5', text: 'To find them: look for two enemy pieces on the same <b>line</b> (rank, file or diagonal) and ask if a bishop, rook or queen can get onto it.' }
    ],
    practice: { type: 'puzzles', themes: ['pin', 'skewer'], min: 600, max: 1600, count: 8, pass: 6, extra: ['pin1', 'skewer1'] } });

  unit({ id: 'disc', level: 2, title: 'Discovered attacks', goal: 'Move one piece, attack with another.',
    lesson: [
      { fen: '4k3/pp4pp/8/8/2q1N3/8/PP3PPP/4R1K1 w - - 0 1', arrows: [['e1', 'e8'], ['e4', 'd6']], text: 'The knight blocks the rook. When it moves, the rook gives check: a <b>discovered check</b>. Nd6+ also attacks the queen on c4, so Black loses it.' },
      { fen: '4k3/pp4pp/8/8/2q1N3/8/PP3PPP/4R1K1 w - - 0 1', text: 'Discovered attacks are powerful because <b>two pieces attack at once</b> and the opponent can only answer one. The moving piece can go anywhere, even somewhere it can be captured.' },
      { fen: '4k3/pp4pp/8/8/2q1N3/8/PP3PPP/4R1K1 w - - 0 1', text: 'Watch for your own pieces lined up behind each other aiming at their king or queen. That’s a loaded gun.' }
    ],
    practice: { type: 'puzzles', themes: ['discovered', 'discoveredCheck'], min: 600, max: 1700, count: 6, pass: 4, extra: ['disc1'] } });

  unit({ id: 'patterns', level: 2, title: 'Mating patterns', goal: 'Recognize the finish in a flash.',
    lesson: [
      { fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', arrows: [['d1', 'd8']], text: '<b>Back rank:</b> the king is trapped by its own pawns. Prevent it in your games with a little escape square like h3 (luft).' },
      { fen: 'r4rk1/ppp2pp1/8/7Q/8/3B4/PPP2PPP/6K1 w - - 0 1', arrows: [['h5', 'h7'], ['d3', 'h7']], text: '<b>Queen + bishop battery:</b> the bishop supports the queen next to the king. Qh7 is mate.' },
      { fen: '6rk/5Npp/8/8/8/8/8/6K1 b - - 0 1', hl: ['h8'], text: '<b>Smothered mate:</b> the king is surrounded by its own pieces and a knight gives the final check.' },
      { fen: '6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1', arrows: [['b1', 'b8']], text: '<b>Ladder:</b> one rook guards a rank, the other checks on the next. Works with queen and rook too.' }
    ],
    practice: { type: 'puzzles', themes: ['mateIn1', 'mateIn2'], min: 700, max: 1500, count: 8, pass: 6, extra: ['mate3'] } });

  unit({ id: 'check2', level: 2, title: 'Checkpoint: tactics in a real game', goal: 'Win against the Improver engine.',
    lesson: [
      { fen: START, text: 'Time to use it. Against the <b>Improver</b> engine, look for forks, pins and loose pieces on every move. The <b>Think it through</b> panel counts your checks and captures for you.' }
    ],
    apply: { type: 'game', level: 3, goal: 'win', text: 'Beat the Improver engine (about 1000). Any color.' } });

  /* ===== Level 3 ===== */
  unit({ id: 'kq', level: 3, title: 'Mate with king and queen', goal: 'Checkmate a lone king in under 20 moves.',
    lesson: [
      { fen: '8/8/8/4k3/8/8/8/KQ6 w - - 0 1', text: 'The method: use the queen to make a <b>box</b> around the enemy king, shrink it step by step, then bring your king up to help.' },
      { fen: '8/8/8/4k3/8/3Q4/8/K7 b - - 1 1', hl: ['d3'], text: 'A knight’s move away from the king is the perfect queen distance: it cuts off the king without giving check, so the box shrinks every move.' },
      { fen: 'k7/2Q5/1K6/8/8/8/8/8 b - - 0 1', hl: ['a8'], text: 'Careful near the edge: here Black has no moves and isn’t in check. <b>Stalemate, draw!</b> When the king is boxed on the edge, bring your king closer first.' },
      { fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1', arrows: [['h1', 'h8']], text: 'Final step: with your king one knight’s jump away (like b6 vs a8), the queen mates on the edge.' }
    ],
    apply: { type: 'drill', fen: '8/8/8/4k3/8/8/8/KQ6 w - - 0 1', goal: 'mate', limit: 20, text: 'Checkmate the lone king within 20 moves. Stockfish defends.' } });

  unit({ id: 'kr', level: 3, title: 'Mate with king and rook', goal: 'Checkmate with a rook in under 30 moves.',
    lesson: [
      { fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', text: 'A rook alone can’t mate. You need your king. The rook cuts the enemy king off on a rank or file; your king walks up to face it.' },
      { fen: '8/8/4k3/8/4K3/8/8/R7 w - - 0 1', arrows: [['a1', 'a6']], text: 'When the kings face each other (opposition), a rook check pushes the enemy king back one rank: Ra6+ sends it to the 7th. Repeat until it reaches the edge.' },
      { fen: '4k3/8/4K3/8/8/8/8/R7 w - - 0 1', arrows: [['a1', 'a8']], text: 'Kings facing, enemy king on the edge: Ra8 is checkmate.' },
      { fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', text: 'If you need to “waste a move” to get the opposition, slide the rook along the line it is guarding.' }
    ],
    apply: { type: 'drill', fen: '8/8/8/4k3/8/8/8/R3K3 w - - 0 1', goal: 'mate', limit: 30, text: 'Checkmate with king and rook within 30 moves. Stockfish defends.' } });

  unit({ id: 'kp', level: 3, title: 'King and pawn endings', goal: 'Know when a pawn queens.',
    lesson: [
      { fen: '4k3/8/8/8/8/4K3/4P3/8 w - - 0 1', text: 'In king and pawn endings, <b>the king leads the pawn</b>, not the other way round. Get your king in front of your pawn.' },
      { fen: '4k3/8/4K3/8/4P3/8/8/8 w - - 0 1', hl: ['d6', 'e6', 'f6'], text: '<b>Key squares:</b> if your king reaches the squares two ranks in front of the pawn (d6, e6, f6 here), the pawn queens no matter who moves.' },
      { fen: '8/8/4k3/8/4K3/4P3/8/8 w - - 0 1', text: '<b>Opposition:</b> kings facing with one square between them. The side NOT to move has the opposition and wins the standoff.' },
      { fen: '8/8/8/8/k7/8/5P2/7K w - - 0 1', hl: ['f2'], text: '<b>Square rule:</b> draw a square from the pawn to its queening rank. If the enemy king can step into it, it catches the pawn. Here it can’t.' }
    ],
    apply: { type: 'drill', fen: '4k3/8/4K3/8/4P3/8/8/8 w - - 0 1', goal: 'mate', limit: 40, text: 'Win this: queen the pawn, then checkmate. Stockfish defends.' } });

  unit({ id: 'calc', level: 3, title: 'Mate in two and calculation', goal: 'See two moves ahead.',
    lesson: [
      { fen: START, text: '<b>Calculating:</b> list forcing moves first (checks, captures, threats). For each, picture their best reply, then your next move. Don’t move a piece in your head and forget it’s moved.' },
      { fen: START, text: 'Use the board in your head, not your hand. In the puzzles, try to see the whole line before you touch a piece.' }
    ],
    practice: { type: 'puzzles', themes: ['mateIn2', 'advantage', 'fork', 'skewer', 'discovered'], min: 1100, max: 1600, count: 8, pass: 5 } });

  unit({ id: 'check3', level: 3, title: 'Checkpoint: beat a club player', goal: 'Win against the Club engine.',
    lesson: [{ fen: START, text: 'Combine it all: develop, castle, blunder-check every move, hunt for tactics, and convert in the endgame. The Club engine plays about 1320.' }],
    apply: { type: 'game', level: 4, goal: 'win', text: 'Beat the Club engine (about 1320).' } });

  /* ===== Level 4 ===== */
  unit({ id: 'rep', level: 4, title: 'Your opening repertoire', goal: 'Play your openings from memory.',
    lesson: [
      { fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/2B1P3/5N2/PPPP1PPP/RNBQK2R b KQkq - 3 3', arrows: [['c4', 'f7']], text: '<b>As White: the Italian Game.</b> 1.e4 e5 2.Nf3 Nc6 3.Bc4. The bishop eyes f7. Plans: c3 and d3 (or d4), castle, Re1, and slowly build.' },
      { fen: 'r1bqk1nr/pppp1ppp/2n5/2b1p3/2B1P3/5N2/PPPP1PPP/RNBQK2R w KQkq - 4 4', text: '<b>As Black vs 1.e4:</b> answer 1...e5 and develop the mirror way: ...Nc6, ...Bc5 or ...Nf6, castle. Against 3.Bb5 (Ruy Lopez) play 3...a6 and 4...Nf6.' },
      { fen: 'rnbqkb1r/ppp2ppp/4pn2/3p4/2PP4/2N5/PP2PPPP/R1BQKBNR w KQkq - 2 4', text: '<b>As Black vs 1.d4:</b> the Queen’s Gambit Declined. 1...d5 2.c4 e6 3.Nc3 Nf6, then ...Be7 and castle. Solid and easy to play.' },
      { fen: START, text: 'Drill each line until you can play it without help. If you play a different move, I’ll show you the book move and why.' }
    ],
    apply: { type: 'book', lines: 'all', text: 'Play through your repertoire lines from memory. 3 lines without a mistake to pass.' } });

  unit({ id: 'activity', level: 4, title: 'Active pieces', goal: 'Every piece has a job.',
    lesson: [
      { fen: 'r2q1rk1/pp2bppp/2n1p3/3pP3/3N4/2P5/PP3PPP/R1BQR1K1 w - - 0 12', hl: ['d4'], text: '<b>Outposts:</b> a knight on a square enemy pawns can’t attack (like d4 here) is a monster. Look for holes in their pawn chain.' },
      { fen: 'r4rk1/pp3ppp/2p5/8/8/2P5/PP3PPP/R3R1K1 w - - 0 20', arrows: [['e1', 'e7']], text: '<b>Rooks on open files.</b> A file with no pawns is a highway. A rook on the 7th rank attacks pawns and traps the king.' },
      { fen: 'r1bq1rk1/pp3ppp/2n1p3/2bpP3/8/2P2N2/PP1B1PPP/RN1QKB1R w KQ - 0 9', hl: ['c8'], text: '<b>Good and bad bishops.</b> Black’s c8 bishop is blocked by its own pawns on light squares. Trade your bad pieces, keep your good ones.' },
      { fen: START, text: 'When there’s no tactic, ask: <b>which of my pieces is worst?</b> Improve it. This one question wins many quiet positions.' }
    ],
    practice: { type: 'puzzles', themes: ['advantage', 'fork', 'pin', 'discovered'], min: 1200, max: 1700, count: 6, pass: 4 } });

  unit({ id: 'pawns', level: 4, title: 'Pawn structure', goal: 'Make pawns your strength.',
    lesson: [
      { fen: '8/5k2/8/1P6/8/8/5K2/8 w - - 0 1', hl: ['b5'], text: '<b>Passed pawn:</b> no enemy pawns in front of it or on the next files. It must be pushed. “Passed pawns must be pushed.”' },
      { fen: 'r1bq1rk1/pp3ppp/2n1pn2/8/3P4/2NB1N2/PP3PPP/R2Q1RK1 w - - 0 10', hl: ['d4'], text: '<b>Isolated pawn:</b> no friendly pawns next to it. It gives space and attacking chances, but in the endgame it becomes a target.' },
      { fen: 'rnbqkb1r/pp3ppp/2p2n2/8/8/2P2N2/P1PP1PPP/R1BQKB1R w KQkq - 0 6', hl: ['c2', 'c3'], text: '<b>Doubled pawns</b> can’t protect each other. Avoid them unless you get something back, like an open file.' },
      { fen: START, text: 'Rooks belong <b>behind</b> passed pawns, yours or theirs. And in endgames, an extra passed pawn on the side away from the kings often decides the game.' }
    ],
    practice: { type: 'puzzles', themes: ['promotion', 'advantage'], min: 1000, max: 1800, count: 6, pass: 4 } });

  unit({ id: 'attack', level: 4, title: 'Attacking the king', goal: 'Build and finish an attack.',
    lesson: [
      { fen: 'r1bq1rk1/ppp2ppp/2np1n2/2b1p3/2B1P3/2NP1N2/PPP2PPP/R1BQ1RK1 w - - 0 7', text: '<b>Attack where you have more pieces.</b> Count the pieces near their king against the defenders. If you have more, attack. If not, improve first.' },
      { fen: 'r4rk1/ppp2pp1/8/7Q/8/3B4/PPP2PPP/6K1 w - - 0 1', arrows: [['d3', 'h7'], ['h5', 'h7']], text: '<b>Open lines to the king.</b> Bishops on the diagonals toward h7, rooks on open files, the queen joining last.' },
      { fen: START, text: '<b>Sacrifices</b> work when they open the king and you can bring more pieces than they can defend. Always calculate the forcing replies first.' }
    ],
    practice: { type: 'puzzles', themes: ['sacrifice', 'mateIn2', 'mateIn3'], min: 1100, max: 1900, count: 6, pass: 4 } });

  unit({ id: 'check4', level: 4, title: 'Checkpoint: strong club', goal: 'Beat a 1600 engine.',
    lesson: [{ fen: START, text: 'Play your repertoire, keep your pieces active, and attack where you’re stronger. Review the game afterwards with the coach.' }],
    apply: { type: 'game', level: 5, goal: 'win', text: 'Beat the Strong club engine (about 1600).' } });

  /* ===== Level 5 ===== */
  unit({ id: 'calc2', level: 5, title: 'Deep calculation', goal: 'Solve 3-move combinations.',
    lesson: [
      { fen: START, text: 'Strong players calculate <b>candidate moves</b>: list 2 or 3 serious options, then look at each one to the end of the forcing line before choosing.' },
      { fen: START, text: 'Check your final position: is it really winning, or did you miss a check or a counter-attack? Strong players double-check before they move.' }
    ],
    practice: { type: 'puzzles', themes: ['mateIn3', 'sacrifice', 'advantage', 'discovered', 'skewer'], min: 1500, max: 2400, count: 8, pass: 5 } });

  unit({ id: 'rook', level: 5, title: 'Rook endgames', goal: 'Win Lucena, hold Philidor.',
    lesson: [
      { fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', text: '<b>Lucena position:</b> your pawn is on the 7th, your king in front of it. Plan: cut off their king with a rook check (Rd1+), then <b>build a bridge</b> with your rook on the 4th rank to block checks.' },
      { fen: '1K1k4/1P6/8/8/8/8/r7/3R4 b - - 1 1', arrows: [['d1', 'd4']], text: 'After Rd1+ Ke7, play Rd4! Then the king walks out and, when the checks come, the rook steps in front as a shield: the bridge.' },
      { fen: '4k3/7r/8/4PK2/8/8/8/R7 b - - 0 1', arrows: [['h7', 'h6']], text: '<b>Philidor defense:</b> put your rook on the 6th rank (...Rh6) so their king can’t advance. When the pawn moves to the 6th, swing the rook to the back and check from behind.' }
    ],
    apply: { type: 'drill', fen: '1K1k4/1P6/8/8/8/8/r7/2R5 w - - 0 1', goal: 'mate', limit: 40, text: 'Win the Lucena position: promote and checkmate. Stockfish defends.' } });

  unit({ id: 'defense', level: 5, title: 'Defense and prophylaxis', goal: 'See their idea before they play it.',
    lesson: [
      { fen: START, text: '<b>Prophylaxis:</b> before your move, ask “what would they play if it were their turn?” Then stop it, if it’s dangerous.' },
      { fen: START, text: 'When defending, <b>trade attackers</b>, give your king air, and look for counter-threats. The best defense often attacks something.' },
      { fen: START, text: 'Practice: harder safe-or-blunder positions from real games. Look for the hidden reply.' }
    ],
    practice: { type: 'safety', count: 12, pass: 10, hard: true } });

  unit({ id: 'final', level: 5, title: 'Final checkpoint', goal: 'Beat a 2000 engine.',
    lesson: [{ fen: START, text: 'Everything together. Openings from memory, blunder checks, tactics, plans and endgame technique. Beat the Expert engine to finish the course.' }],
    apply: { type: 'game', level: 6, goal: 'win', text: 'Beat the Expert engine (about 2000).' } });

  var BOOK = [
    { id: 'it1', side: 'w', name: 'Italian: Giuoco Piano', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O', 'Re1'] },
    { id: 'it2', side: 'w', name: 'Italian: Two Knights', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Nf6', 'd3', 'Be7', 'O-O', 'O-O', 'Re1', 'd6', 'c3'] },
    { id: 'it3', side: 'w', name: 'Italian vs ...Be7', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Be7', 'd4', 'd6', 'd5', 'Nb8', 'Nc3', 'Nf6', 'O-O'] },
    { id: 'b1', side: 'b', name: 'Black vs Italian', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bc4', 'Bc5', 'c3', 'Nf6', 'd3', 'd6', 'O-O', 'O-O'] },
    { id: 'b2', side: 'b', name: 'Black vs Ruy Lopez', moves: ['e4', 'e5', 'Nf3', 'Nc6', 'Bb5', 'a6', 'Ba4', 'Nf6', 'O-O', 'Be7', 'Re1', 'b5', 'Bb3', 'd6'] },
    { id: 'b3', side: 'b', name: 'Black: Queen’s Gambit Declined', moves: ['d4', 'd5', 'c4', 'e6', 'Nc3', 'Nf6', 'Bg5', 'Be7', 'e3', 'O-O', 'Nf3', 'h6'] },
    { id: 'b4', side: 'b', name: 'Black vs London', moves: ['d4', 'd5', 'Bf4', 'Nf6', 'e3', 'e6', 'Nf3', 'c5', 'c3', 'Nc6'] }
  ];

  var PUZ = [
    { id: 'mate1', name: 'Back-rank mate', fen: '6k1/5ppp/8/8/8/8/5PPP/3R2K1 w - - 0 1', sol: ['d1d8'], themes: ['mateIn1', 'backRank'], rating: 600 },
    { id: 'mate2', name: 'Scholar’s mate', fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR w KQkq - 0 1', sol: ['h5f7'], themes: ['mateIn1'], rating: 600 },
    { id: 'mate3', name: 'Queen + bishop on h7', fen: 'r4rk1/ppp2pp1/8/7Q/8/3B4/PPP2PPP/6K1 w - - 0 1', sol: ['h5h7'], themes: ['mateIn1'], rating: 700 },
    { id: 'mate4', name: 'Rook ladder', fen: '6k1/R7/8/8/8/8/8/1R4K1 w - - 0 1', sol: ['b1b8'], themes: ['mateIn1'], rating: 600 },
    { id: 'mate5', name: 'Queen box', fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1', sol: ['h1h8'], themes: ['mateIn1'], rating: 700 },
    { id: 'fork1', name: 'Knight fork', fen: '3q3k/6pp/8/4N3/8/8/6PP/6K1 w - - 0 1', sol: ['e5f7'], themes: ['fork'], rating: 750 },
    { id: 'pfork1', name: 'Pawn fork', fen: '7k/8/2n1b3/8/2PP4/8/8/4K3 w - - 0 1', sol: ['d4d5'], themes: ['fork'], rating: 700 },
    { id: 'free1', name: 'Free piece', fen: 'r1bqkb1r/pppp1ppp/5n2/4n3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 1', sol: ['f3e5'], themes: ['hanging'], rating: 500 },
    { id: 'pin1', name: 'Pin the queen', fen: '6k1/pp4pp/8/3q4/8/1P6/P5PP/5BK1 w - - 0 1', sol: ['f1c4'], themes: ['pin'], rating: 900 },
    { id: 'skewer1', name: 'Skewer', fen: '8/7q/8/8/4k3/8/8/K2B4 w - - 0 1', sol: ['d1c2', '*', 'c2h7'], themes: ['skewer'], rating: 900 },
    { id: 'disc1', name: 'Discovered check', fen: '4k3/pp4pp/8/8/2q1N3/8/PP3PPP/4R1K1 w - - 0 1', sol: ['e4d6'], alt: ['e4d2'], themes: ['discoveredCheck'], rating: 950 }
  ];

  return { START: START, LEVELS: LEVELS, UNITS: U, BOOK: BOOK, PUZ: PUZ };
})();
