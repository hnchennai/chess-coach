/* ---------- Avatar: coach character and themed piece sets (all original artwork) ---------- */
var Avatar = (function () {
  /* ===== Coach: Gaja the elephant, a nod to the elephant of chaturanga ===== */
  var MOODS = {
    neutral: { brow: 'M30 37 q6 -3 12 0 M58 37 q6 -3 12 0', eyes: 'dot', mouth: 'M43 66 q7 4 14 0', blush: 0 },
    happy:   { brow: 'M30 35 q6 -4 12 0 M58 35 q6 -4 12 0', eyes: 'smile', mouth: 'M41 64 q9 9 18 0', blush: 1 },
    proud:   { brow: 'M30 34 q6 -5 12 0 M58 34 q6 -5 12 0', eyes: 'smile', mouth: 'M39 63 q11 12 22 0 z', blush: 1, sparkle: 1 },
    think:   { brow: 'M30 34 q6 -1 12 2 M58 36 q6 -4 12 -2', eyes: 'up', mouth: 'M45 67 h10', blush: 0 },
    worried: { brow: 'M30 38 q6 -5 12 -6 M58 32 q6 1 12 6', eyes: 'dot', mouth: 'M43 69 q7 -5 14 0', blush: 0 },
    shocked: { brow: 'M30 31 q6 -4 12 0 M58 31 q6 -4 12 0', eyes: 'wide', mouth: 'M50 68 m-4 0 a4 5 0 1 0 8 0 a4 5 0 1 0 -8 0', blush: 0 }
  };
  function coach(mood, size) {
    var m = MOODS[mood] || MOODS.neutral, s = size || 64, eyes = '';
    if (m.eyes === 'smile') eyes = '<path d="M33 46 q4 -5 8 0 M59 46 q4 -5 8 0" stroke="#1d2622" stroke-width="2.6" fill="none" stroke-linecap="round"/>';
    else if (m.eyes === 'up') eyes = '<circle cx="37" cy="45" r="4.2" fill="#fff"/><circle cx="63" cy="45" r="4.2" fill="#fff"/><circle cx="38" cy="43" r="2.4" fill="#1d2622"/><circle cx="64" cy="43" r="2.4" fill="#1d2622"/>';
    else if (m.eyes === 'wide') eyes = '<circle cx="37" cy="46" r="5.2" fill="#fff"/><circle cx="63" cy="46" r="5.2" fill="#fff"/><circle cx="37" cy="46" r="2.6" fill="#1d2622"/><circle cx="63" cy="46" r="2.6" fill="#1d2622"/>';
    else eyes = '<circle cx="37" cy="46" r="4.2" fill="#fff"/><circle cx="63" cy="46" r="4.2" fill="#fff"/><circle cx="37.6" cy="46.6" r="2.4" fill="#1d2622"/><circle cx="63.6" cy="46.6" r="2.4" fill="#1d2622"/>';
    return '<svg class="gaja" viewBox="0 0 100 100" width="' + s + '" height="' + s + '" role="img" aria-label="Coach Gaja looking ' + (mood || 'calm') + '">' +
      '<circle cx="50" cy="52" r="47" fill="var(--av-bg)"/>' +
      '<path d="M18 30 C2 34 2 66 20 70 C26 60 26 40 18 30 z" fill="#9aa7b4"/><path d="M82 30 C98 34 98 66 80 70 C74 60 74 40 82 30 z" fill="#9aa7b4"/>' +
      '<path d="M18 33 C8 38 9 62 20 66" fill="none" stroke="#d9a7ae" stroke-width="4" opacity=".7"/><path d="M82 33 C92 38 91 62 80 66" fill="none" stroke="#d9a7ae" stroke-width="4" opacity=".7"/>' +
      '<ellipse cx="50" cy="50" rx="30" ry="28" fill="#aeb9c4"/>' +
      '<path d="M44 58 C42 74 46 86 56 90 C60 91 62 88 59 86 C52 82 52 72 56 60 z" fill="#aeb9c4"/>' +
      '<path d="M40 70 q-6 2 -9 8 M60 70 q6 2 9 8" stroke="#f5efe2" stroke-width="4" stroke-linecap="round" fill="none"/>' +
      '<path d="M30 25 q20 -14 40 0 l-3 6 q-17 -9 -34 0 z" fill="var(--accent)"/><circle cx="50" cy="19" r="3.2" fill="#e8c35a"/>' +
      (m.blush ? '<ellipse cx="30" cy="57" rx="5" ry="3" fill="#e79aa4" opacity=".55"/><ellipse cx="70" cy="57" rx="5" ry="3" fill="#e79aa4" opacity=".55"/>' : '') +
      '<path d="' + m.brow + '" stroke="#5c6670" stroke-width="2.4" fill="none" stroke-linecap="round"/>' + eyes +
      '<path d="' + m.mouth + '" stroke="#1d2622" stroke-width="2.4" fill="' + (/z$/.test(m.mouth) ? '#7a3b45' : 'none') + '" stroke-linecap="round"/>' +
      (m.sparkle ? '<path d="M84 14 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 z M14 82 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 z" fill="#e8c35a"/>' : '') +
      '</svg>';
  }
  function moodFor(cls) { return { best: 'proud', good: 'happy', inacc: 'think', mist: 'worried', blund: 'shocked' }[cls] || 'neutral'; }

  /* ===== Emblem icons (24x24, line style) ===== */
  var I = {
    bow: '<path d="M7 3 C17 7 17 17 7 21"/><path d="M7 3 V21"/><path d="M4 12 H20 M17 9 L20 12 L17 15"/>',
    lotus: '<path d="M12 4 C9 8 9 12 12 16 C15 12 15 8 12 4 z"/><path d="M12 16 C8 15 5 12 4 8 C8 9 10 11 12 16"/><path d="M12 16 C16 15 19 12 20 8 C16 9 14 11 12 16"/><path d="M5 19 H19"/>',
    bridge: '<path d="M3 17 H21"/><path d="M4 17 C6 11 9 9 12 9 C15 9 18 11 20 17"/><path d="M8 17 V13 M12 17 V9 M16 17 V13"/>',
    arrows: '<path d="M5 19 L19 5 M15 5 H19 V9"/><path d="M5 5 L19 19 M15 19 H19 V15"/><path d="M5 19 L4 21 M5 5 L4 3"/>',
    mace: '<circle cx="15" cy="9" r="4.5"/><path d="M12 12 L5 19"/><path d="M4 18 L6 20"/><path d="M15 3.5 V4.5 M20.5 9 H19.5 M18.9 5.1 L18.2 5.8"/>',
    flag: '<path d="M6 21 V4"/><path d="M6 4 H17 L14.5 7.5 L17 11 H6"/>',
    crown10: '<path d="M3 18 L4 8 L7 12 L9 6 L12 11 L15 6 L17 12 L20 8 L21 18 z"/><path d="M3 21 H21"/><circle cx="7" cy="15" r=".8"/><circle cx="12" cy="15" r=".8"/><circle cx="17" cy="15" r=".8"/>',
    jewel: '<path d="M7 4 H17 L21 9 L12 20 L3 9 z"/><path d="M3 9 H21 M9 4 L12 9 L15 4 M12 9 V20"/>',
    fort: '<path d="M4 21 V9 H7 V6 H10 V9 H14 V6 H17 V9 H20 V21 z"/><path d="M10 21 V16 C10 14 14 14 14 16 V21"/>',
    wheel: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M12 4 V10 M12 14 V20 M4 12 H10 M14 12 H20 M6.3 6.3 L10.6 10.6 M13.4 13.4 L17.7 17.7 M17.7 6.3 L13.4 10.6 M10.6 13.4 L6.3 17.7"/>',
    antlers: '<path d="M12 21 V13"/><path d="M12 13 C9 12 7 9 7 5 M7 8 L4 6 M8 11 L5 11"/><path d="M12 13 C15 12 17 9 17 5 M17 8 L20 6 M16 11 L19 11"/><ellipse cx="12" cy="17" rx="3" ry="4"/>',
    spear: '<path d="M6 20 L17 9"/><path d="M15 5 L20 4 L19 9 L16 11 L13 8 z"/>',
    hat: '<path d="M12 2 L6 17 H18 z"/><path d="M3 19 C8 21 16 21 21 19 C18 17 6 17 3 19 z"/><path d="M11 8 l1 -2 1 2 2 .5 -1.5 1.5 .5 2 -2 -1 -2 1 .5 -2 -1.5 -1.5 z"/>',
    orb: '<circle cx="12" cy="10" r="6"/><path d="M9 8 C10 6.5 11.5 6 13 6.3"/><path d="M7 21 H17 L15 16 H9 z"/>',
    tower: '<path d="M7 21 V8 L12 3 L17 8 V21 z"/><path d="M10 21 V17 C10 15 14 15 14 17 V21"/><path d="M11 10 H13 V12 H11 z"/>',
    potion: '<path d="M10 3 H14 M10 3 V8 L5 17 C4 19 5 21 7 21 H17 C19 21 20 19 19 17 L14 8 V3"/><path d="M7.5 15 H16.5"/>',
    wing: '<path d="M4 18 C6 10 12 5 20 4 C19 10 16 15 9 17"/><path d="M8 15 C10 13 13 11 17 8 M7 12 C10 11 12 9 15 7"/><path d="M4 18 L9 17"/>',
    wand: '<path d="M4 20 L15 9"/><path d="M17 3 l1 2.5 2.5 1 -2.5 1 -1 2.5 -1 -2.5 -2.5 -1 2.5 -1 z"/><path d="M20 11 l.6 1.4 1.4 .6 -1.4 .6 -.6 1.4 -.6 -1.4 -1.4 -.6 1.4 -.6 z"/>',
    crown: '<path d="M4 17 L3 7 L8 11 L12 5 L16 11 L21 7 L20 17 z"/><path d="M4 20 H20"/>',
    flame: '<path d="M12 21 C7 21 5 17 6 13 C7 10 9 9 9 6 C12 8 13 10 13 12 C14 11 15 10 15 8 C18 11 19 15 17 18 C16 20 14 21 12 21 z"/><path d="M12 21 C10 21 9 19 10 17 C11 15 12 15 12 13 C14 15 14 17 14 18 C14 20 13 21 12 21"/>',
    castle: '<path d="M3 21 V11 H6 V8 H9 V11 H15 V8 H18 V11 H21 V21 z"/><path d="M9 5 V8 M15 5 V8"/><path d="M10 21 V16 H14 V21"/>',
    swords: '<path d="M4 4 L15 15 M4 4 H7 M4 4 V7"/><path d="M20 4 L9 15 M20 4 H17 M20 4 V7"/><path d="M13 17 L17 13 M7 13 L11 17"/><path d="M16 16 L19 19 M8 16 L5 19"/>',
    dragon: '<path d="M4 18 C5 12 9 8 14 7 L16 4 L17 7 C19 7 20 9 20 10 L17 11 C15 11 14 13 15 16 C12 15 10 16 9 19"/><circle cx="16.8" cy="8.8" r=".7"/><path d="M9 19 L4 18"/>',
    shield: '<path d="M12 3 L20 6 V12 C20 17 16 20 12 21 C8 20 4 17 4 12 V6 z"/><path d="M12 7 V17 M8 11 H16"/>',
    core: '<circle cx="12" cy="12" r="4"/><path d="M12 2 V5 M12 19 V22 M2 12 H5 M19 12 H22 M4.9 4.9 L7 7 M17 17 L19.1 19.1 M19.1 4.9 L17 7 M7 17 L4.9 19.1"/>',
    comet: '<circle cx="16" cy="8" r="3.5"/><path d="M13.5 10.5 L4 20 M12.5 8 L5 13 M16 11.5 L11 19"/>',
    hq: '<path d="M5 21 V5 H19 V21 z"/><path d="M8 8 H10 M14 8 H16 M8 12 H10 M14 12 H16 M10 21 V17 H14 V21"/><path d="M12 5 V2"/>',
    bolt: '<path d="M13 2 L5 13 H11 L10 22 L19 10 H13 z"/>',
    rocket: '<path d="M12 2 C16 5 17 10 16 15 H8 C7 10 8 5 12 2 z"/><circle cx="12" cy="9" r="1.8"/><path d="M8 13 L5 17 L8 17 M16 13 L19 17 L16 17 M10 18 L12 22 L14 18"/>',
    mask: '<path d="M3 9 C6 7 9 8 12 10 C15 8 18 7 21 9 C21 14 18 16 15 15 C13 14.5 12.5 13 12 13 C11.5 13 11 14.5 9 15 C6 16 3 14 3 9 z"/><path d="M6.5 11 C7.5 10 9 10 10 11.5 M17.5 11 C16.5 10 15 10 14 11.5"/>'
  };
  var SETS = {
    classic: { name: 'Classic', note: 'The standard Staunton pieces.' },
    ramayana: { name: 'Ramayana', note: 'Rama’s army against Ravana’s Lanka.',
      w: { k: ['bow', 'Rama'], q: ['lotus', 'Sita'], r: ['bridge', 'Nala’s bridge'], b: ['arrows', 'Lakshmana'], n: ['mace', 'Hanuman'], p: ['flag', 'Vanara warrior'] },
      b: { k: ['crown10', 'Ravana'], q: ['jewel', 'Mandodari'], r: ['fort', 'Kumbhakarna'], b: ['wheel', 'Indrajit'], n: ['antlers', 'Maricha'], p: ['spear', 'Rakshasa warrior'] },
      light: ['#f6e7c6', '#b7791f', '#7a4a0e'], dark: ['#5b1f2a', '#d4a24a', '#f3dfb4'] },
    wizard: { name: 'Wizard Academy', note: 'An original academy of spellcasters.',
      w: { k: ['hat', 'Archmage'], q: ['orb', 'Seer'], r: ['tower', 'Spire'], b: ['potion', 'Alchemist'], n: ['wing', 'Griffin rider'], p: ['wand', 'Apprentice'] },
      b: { k: ['hat', 'Shadow mage'], q: ['orb', 'Dark seer'], r: ['tower', 'Black spire'], b: ['potion', 'Hexer'], n: ['wing', 'Night flyer'], p: ['wand', 'Acolyte'] },
      light: ['#e9e4f7', '#6b4fb8', '#2f1f66'], dark: ['#231a3d', '#a68cf0', '#ece6ff'] },
    dragon: { name: 'Dragon Kingdoms', note: 'An original medieval fantasy war.',
      w: { k: ['crown', 'High King'], q: ['flame', 'Flame queen'], r: ['castle', 'Keep'], b: ['swords', 'Champion'], n: ['dragon', 'Dragon'], p: ['shield', 'Shieldbearer'] },
      b: { k: ['crown', 'Iron King'], q: ['flame', 'Ember queen'], r: ['castle', 'Dark keep'], b: ['swords', 'Blackblade'], n: ['dragon', 'Wyvern'], p: ['shield', 'Raider'] },
      light: ['#eef1e8', '#4d7a3a', '#20381a'], dark: ['#2a2420', '#d0703c', '#f6e2d2'] },
    heroes: { name: 'Hero League', note: 'An original team of superheroes.',
      w: { k: ['core', 'Captain Core'], q: ['comet', 'Comet'], r: ['hq', 'Headquarters'], b: ['bolt', 'Volt'], n: ['rocket', 'Rocket'], p: ['mask', 'Rookie'] },
      b: { k: ['core', 'Overlord'], q: ['comet', 'Eclipse'], r: ['hq', 'Lair'], b: ['bolt', 'Static'], n: ['rocket', 'Blaster'], p: ['mask', 'Henchman'] },
      light: ['#e3f1fb', '#1f6fb2', '#0c2f52'], dark: ['#1a1f2b', '#e0b43a', '#fff4d6'] }
  };
  var GLY = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };
  var cache = {};
  function pals(S, color) {
    var p = color === 'w' ? S.pw : S.pb;
    if (p) return p;
    var o = color === 'w' ? S.light : S.dark;
    return [o[0], o[0], o[1], o[1], o[2], o[1]];
  }
  function piece(set, color, type) {
    var S = SETS[set]; if (!S || set === 'classic' || !S[color]) return null;
    var key = set + color + type; if (cache[key]) return cache[key];
    var e = S[color][type], P = pals(S, color), id = 'tk' + key, royal = type === 'k' || type === 'q';
    var ico = (I[e[0]] || '').replace(/ACC/g, P[5]);
    var g = '<svg class="tok" viewBox="0 0 100 100" aria-hidden="true"><defs>' +
      '<radialGradient id="' + id + 'f" cx="38%" cy="30%" r="75%"><stop offset="0" stop-color="' + P[0] + '"/><stop offset="1" stop-color="' + P[1] + '"/></radialGradient>' +
      '<linearGradient id="' + id + 'r" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="' + P[2] + '"/><stop offset=".5" stop-color="' + P[3] + '"/><stop offset="1" stop-color="' + P[2] + '"/></linearGradient>' +
      '<linearGradient id="' + id + 'g" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>' +
      '</defs><g' + (type === 'p' ? ' transform="translate(50 52) scale(.84) translate(-50 -52)"' : '') + '>' +
      '<ellipse cx="50" cy="57" rx="44" ry="42" fill="rgba(0,0,0,.35)"/>' +
      '<circle cx="50" cy="50" r="45" fill="url(#' + id + 'r)"/>' +
      '<circle cx="50" cy="50" r="45" fill="none" stroke="rgba(0,0,0,.35)" stroke-width="1"/>' +
      '<circle cx="50" cy="50" r="38.5" fill="url(#' + id + 'f)" stroke="rgba(0,0,0,.3)" stroke-width="1"/>' +
      (royal ? '<circle cx="50" cy="50" r="41.8" fill="none" stroke="' + P[0] + '" stroke-width="2.4" stroke-dasharray="0.1 6.55" stroke-linecap="round" opacity=".9"/>' :
        '<circle cx="50" cy="50" r="35" fill="none" stroke="' + P[3] + '" stroke-width="1" opacity=".45"/>') +
      '<g transform="translate(24 24) scale(2.1667)" fill="none" stroke="' + P[4] + '" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">' + ico + '</g>' +
      '<path d="M22 34 A30 30 0 0 1 78 34 C66 26 34 26 22 34 z" fill="url(#' + id + 'g)"/>' +
      (type === 'k' ? '<path d="M35 12 L33 1.5 L42 7 L50 0.5 L58 7 L67 1.5 L65 12 z" fill="url(#' + id + 'r)" stroke="rgba(0,0,0,.45)" stroke-width="1"/><circle cx="50" cy="7.5" r="2.3" fill="' + P[5] + '" stroke="rgba(0,0,0,.4)" stroke-width=".6"/>' : '') +
      (type === 'q' ? '<path d="M50 1 L55 6.5 L50 12 L45 6.5 z" fill="' + P[5] + '" stroke="' + P[2] + '" stroke-width="1.4"/>' : '') +
      '<circle cx="79" cy="79" r="15.5" fill="url(#' + id + 'r)" stroke="rgba(0,0,0,.45)" stroke-width="1"/>' +
      '<circle cx="79" cy="79" r="12.3" fill="' + P[1] + '"/>' +
      '<text x="79" y="86" text-anchor="middle" font-size="19" fill="' + P[4] + '" font-family="\'Noto Sans Symbols 2\',\'Segoe UI Symbol\',sans-serif">' + GLY[type] + '︎</text>' +
      '</g></svg>';
    cache[key] = g; return g;
  }
  function label(set, color, type) { var S = SETS[set]; return S && S[color] ? S[color][type][1] : null; }
  return { coach: coach, moodFor: moodFor, piece: piece, label: label, SETS: SETS, ICONS: I };
})();
