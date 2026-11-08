/* ---------- Queen Rani: a 3D coach drawn with Three.js, original design ---------- */
var Coach3D = (function () {
  'use strict';
  var KEY = 'suresh-chess-coach.coach', coach2d = Avatar.coach;
  var choice = 'rani'; try { choice = localStorage.getItem(KEY) || 'rani'; } catch (e) {}
  var T = null, R = null, scene, cam, Q = {}, ready = false, failed = false, raf = 0, lastT = 0, st = typeof WeakMap !== 'undefined' ? new WeakMap() : null;
  var DPR = Math.min(window.devicePixelRatio || 1, 2);
  /* S2b (DESIGN.md 8): under prefers-reduced-motion Rani holds one still pose (no bob, turn, spin or blink) */
  var RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function still() { return !!(RM && RM.matches); }
  var MOODS = { neutral: 1, happy: 1, proud: 1, think: 1, worried: 1, shocked: 1 };

  function name() { return choice === 'gaja' ? 'Coach Gaja' : 'Queen Rani'; }
  Avatar.coachName = name;
  Avatar.coach = function (mood, size) {
    if (choice === 'gaja' || failed) return coach2d(mood, size);
    mood = MOODS[mood] ? mood : 'neutral'; size = size || 64;
    return '<canvas class="q3d" data-mood="' + mood + '" data-size="' + size + '" width="' + Math.round(size * DPR) + '" height="' + Math.round(size * DPR) + '" style="width:' + size + 'px;height:' + size + 'px" role="img" aria-label="Queen Rani, looking ' + mood + '"></canvas>';
  };

  /* ---------- model ---------- */
  function C(hex) { return new T.Color(hex).convertSRGBToLinear(); }
  function M(hex, rough, metal, extra) { var o = { color: C(hex), roughness: rough, metalness: metal || 0 }; if (extra) for (var k in extra) o[k] = extra[k]; return new T.MeshStandardMaterial(o); }
  function mesh(g, m, x, y, z) { var o = new T.Mesh(g, m); o.position.set(x || 0, y || 0, z || 0); return o; }
  function build() {
    R = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
    R.setPixelRatio(1); R.setSize(256, 256, false); R.setClearColor(0x000000, 0);
    R.outputEncoding = T.sRGBEncoding; R.toneMapping = T.ACESFilmicToneMapping; R.toneMappingExposure = 1.0;
    scene = new T.Scene();
    var es = new T.Scene(), cv = document.createElement('canvas'); cv.width = 32; cv.height = 128; var x = cv.getContext('2d');
    var gr = x.createLinearGradient(0, 0, 0, 128); gr.addColorStop(0, '#fff7ea'); gr.addColorStop(0.5, '#a88f74'); gr.addColorStop(1, '#2a2018'); x.fillStyle = gr; x.fillRect(0, 0, 32, 128);
    es.add(new T.Mesh(new T.SphereGeometry(10, 24, 12), new T.MeshBasicMaterial({ map: new T.CanvasTexture(cv), side: T.BackSide })));
    var lp = new T.Mesh(new T.PlaneGeometry(5, 3), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide })); lp.position.set(5, 6, 6); lp.lookAt(0, 0, 0); es.add(lp);
    var pm = new T.PMREMGenerator(R); scene.environment = pm.fromScene(es, 0.04).texture; pm.dispose();
    scene.add(new T.HemisphereLight(0xfff4e6, 0x40302a, 0.6));
    var key = new T.DirectionalLight(0xfff1dc, 1.3); key.position.set(2, 4, 5); scene.add(key);
    var rim = new T.DirectionalLight(0xc8b4ff, 0.7); rim.position.set(-3, 2, -3); scene.add(rim);
    cam = new T.PerspectiveCamera(30, 1, 0.1, 50); cam.position.set(0, 1.58, 2.95); cam.lookAt(0, 1.43, 0);

    var gown = M('#56298f', 0.42, 0.08), gold = M('#e2b54d', 0.25, 0.95), ivory = M('#f7ecda', 0.42, 0), hair = M('#3a2416', 0.6, 0),
      ink = M('#1c1310', 0.3, 0), white = new T.MeshBasicMaterial({ color: 0xffffff }), ruby = M('#d0263f', 0.15, 0.2), pearl = M('#fff6ea', 0.2, 0.1),
      blush = new T.MeshBasicMaterial({ color: C('#f08aa0'), transparent: true, opacity: 0.55, depthWrite: false }), spark = M('#ffd76a', 0.2, 0.6, { emissive: C('#ffb300'), emissiveIntensity: 0.6 });
    var root = new T.Group(); scene.add(root); Q.root = root;
    var prof = [[0, 0], [0.55, 0], [0.56, 0.06], [0.5, 0.1], [0.52, 0.14], [0.44, 0.2], [0.36, 0.45], [0.28, 0.75], [0.22, 0.95], [0.2, 1.02], [0.28, 1.07], [0.28, 1.1], [0.18, 1.15], [0.12, 1.22], [0, 1.24]];
    root.add(mesh(new T.LatheGeometry(prof.map(function (p) { return new T.Vector2(Math.max(0.001, p[0]), p[1]); }), 40), gown));
    [[0.53, 0.1], [0.44, 0.205], [0.28, 1.085]].forEach(function (t) { var g = new T.TorusGeometry(t[0], 0.022, 10, 48); g.rotateX(Math.PI / 2); root.add(mesh(g, gold, 0, t[1], 0)); });
    for (var i = 0; i < 5; i++) root.add(mesh(new T.SphereGeometry(0.028, 10, 8), gold, 0, 0.42 + i * 0.13, 0.36 - i * 0.032));

    var head = new T.Group(); head.position.set(0, 1.5, 0); root.add(head); Q.head = head;
    head.add(mesh(new T.SphereGeometry(0.34, 32, 24), ivory));
    var back = mesh(new T.SphereGeometry(0.355, 28, 20), hair, 0, 0.03, -0.06); back.scale.set(1.02, 1, 0.92); head.add(back);
    var bang = mesh(new T.SphereGeometry(0.35, 28, 16, 0, Math.PI * 2, 0, 0.75), hair, 0, 0.02, 0.01); head.add(bang);
    var bun = mesh(new T.SphereGeometry(0.14, 16, 12), hair, 0, 0.12, -0.33); head.add(bun);
    var crown = new T.Group(); crown.position.set(0, 0.3, -0.02); crown.rotation.set(-0.12, 0, 0.1); head.add(crown); Q.crown = crown;
    crown.add(mesh(new T.CylinderGeometry(0.22, 0.2, 0.1, 28, 1, true), gold));
    var band = new T.TorusGeometry(0.2, 0.018, 8, 32); band.rotateX(Math.PI / 2); crown.add(mesh(band, gold, 0, -0.05, 0));
    for (var j = 0; j < 8; j++) {
      var a = j / 8 * Math.PI * 2, cx = Math.sin(a) * 0.215, cz = Math.cos(a) * 0.215;
      var cn = new T.ConeGeometry(0.035, j % 2 ? 0.09 : 0.14, 8); crown.add(mesh(cn, gold, cx, 0.05 + (j % 2 ? 0.045 : 0.07), cz));
      crown.add(mesh(new T.SphereGeometry(0.022, 8, 6), j % 2 ? pearl : ruby, cx, 0.05 + (j % 2 ? 0.095 : 0.145), cz));
    }
    crown.add(mesh(new T.SphereGeometry(0.04, 12, 10), ruby, 0, 0, 0.215));

    var face = new T.Group(); face.position.set(0, -0.02, 0); head.add(face);
    Q.eyes = [-1, 1].map(function (s) {
      var e = new T.Group(); e.position.set(s * 0.115, 0.04, 0.3); face.add(e);
      var ball = mesh(new T.SphereGeometry(0.052, 16, 12), ink); ball.scale.set(1, 1.3, 0.55); e.add(ball);
      e.add(mesh(new T.SphereGeometry(0.016, 8, 6), white, 0.018, 0.026, 0.03));
      return e;
    });
    Q.brows = [-1, 1].map(function (s) { var b = mesh(new T.BoxGeometry(0.1, 0.02, 0.02), hair, s * 0.115, 0.15, 0.3); face.add(b); return b; });
    Q.lashes = [-1, 1].map(function (s) { var l = mesh(new T.BoxGeometry(0.03, 0.012, 0.012), ink, s * 0.17, 0.085, 0.27); l.rotation.z = s * 0.6; face.add(l); return l; });
    var smile = new T.TorusGeometry(0.065, 0.016, 8, 20, Math.PI); smile.rotateZ(Math.PI);
    var o = new T.TorusGeometry(0.04, 0.016, 8, 20);
    var flat = new T.BoxGeometry(0.08, 0.018, 0.018);
    var lip = M('#b8394f', 0.4, 0);
    Q.mouth = { smile: mesh(smile, lip, 0, -0.08, 0.315), frown: mesh(smile.clone().rotateZ(Math.PI), lip, 0, -0.13, 0.31), o: mesh(o, lip, 0, -0.12, 0.31), flat: mesh(flat, lip, 0, -0.11, 0.315), grin: mesh(new T.SphereGeometry(0.06, 16, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M('#7a1e30', 0.5, 0), 0, -0.085, 0.3) };
    Q.mouth.grin.scale.set(1.15, 0.9, 0.6);
    Object.keys(Q.mouth).forEach(function (k) { face.add(Q.mouth[k]); });
    Q.cheeks = [-1, 1].map(function (s) { var c = mesh(new T.CircleGeometry(0.05, 16), blush, s * 0.19, -0.05, 0.285); c.rotation.y = s * 0.55; face.add(c); return c; });
    head.add(mesh(new T.SphereGeometry(0.03, 8, 6), gold, -0.33, -0.1, 0.04)); head.add(mesh(new T.SphereGeometry(0.03, 8, 6), gold, 0.33, -0.1, 0.04));

    Q.arms = [-1, 1].map(function (s) {
      var sh = new T.Group(); sh.position.set(s * 0.25, 1.06, 0.02); root.add(sh);
      var sl = new T.CylinderGeometry(0.05, 0.065, 0.36, 12); sl.translate(0, -0.18, 0); sh.add(mesh(sl, gown));
      var cuff = new T.TorusGeometry(0.052, 0.014, 6, 16); cuff.rotateX(Math.PI / 2); sh.add(mesh(cuff, gold, 0, -0.36, 0));
      sh.add(mesh(new T.SphereGeometry(0.058, 14, 10), ivory, 0, -0.41, 0));
      sh.add(mesh(new T.SphereGeometry(0.06, 12, 10), gown, 0, 0, 0));
      return sh;
    });
    Q.sparks = [];
    for (var k = 0; k < 5; k++) { var sp = mesh(new T.OctahedronGeometry(0.045), spark); sp.visible = false; root.add(sp); Q.sparks.push(sp); }
    Q.sweat = mesh(new T.SphereGeometry(0.035, 10, 8), M('#8fd3ff', 0.1, 0, { transparent: true, opacity: 0.85 }), 0.3, 0.12, 0.2); Q.sweat.scale.set(1, 1.4, 1); head.add(Q.sweat);
  }

  /* ---------- poses ---------- */
  var POSE = {
    neutral: { arms: [[0, -0.22], [0, 0.22]], brow: [0, 0, 0], mouth: 'smile', cheeks: 0, tilt: 0 },
    happy: { arms: [[0, -0.25], [0, 2.35]], brow: [0.02, 0.1, 0], mouth: 'grin', cheeks: 1, tilt: 0.06, wave: 1 },
    proud: { arms: [[0, -2.45], [0, 2.45]], brow: [0.03, 0.12, 0], mouth: 'grin', cheeks: 1, tilt: 0, sparks: 1 },
    think: { arms: [[0, -0.22], [-2.0, -0.35]], brow: [0.04, -0.25, 1], mouth: 'flat', cheeks: 0, tilt: 0.16 },
    worried: { arms: [[-1.0, 0.45], [-1.0, -0.45]], brow: [0.02, -0.38, 0], mouth: 'frown', cheeks: 0, tilt: -0.05, sweat: 1 },
    shocked: { arms: [[0, -1.25], [0, 1.25]], brow: [0.07, 0.15, 0], mouth: 'o', cheeks: 0, tilt: 0 }
  };
  function lerp(a, b, t) { return a + (b - a) * t; }
  function pose(mood, t, age) {
    var P = POSE[mood] || POSE.neutral, intro = Math.min(1, age / 0.45), e = intro * intro * (3 - 2 * intro);
    var root = Q.root, bob = Math.sin(t * 1.7) * 0.018;
    root.position.y = bob; root.rotation.set(0, Math.sin(t * 0.55) * 0.22, 0); root.scale.setScalar(1);
    if (age < 0.7) {
      var k = age / 0.7;
      if (mood === 'happy' || mood === 'proud') root.position.y += Math.sin(Math.PI * Math.min(1, k * 1.4)) * 0.14;
      if (mood === 'proud') root.rotation.y += (1 - (1 - k) * (1 - k)) * Math.PI * 2;
      if (mood === 'shocked') { root.position.y += Math.sin(Math.PI * k) * 0.1; root.scale.set(1 + 0.06 * Math.sin(Math.PI * k), 1, 1); }
      if (mood === 'worried') root.rotation.y += Math.sin(k * Math.PI * 6) * 0.12 * (1 - k);
    }
    Q.head.rotation.set(0, 0, P.tilt * e + (mood === 'think' ? Math.sin(t * 1.2) * 0.03 : 0));
    Q.arms.forEach(function (a, i) {
      var tg = P.arms[i], rx = tg[0], rz = tg[1];
      if (P.wave && i === 1) rz += Math.sin(t * 9) * 0.3;
      a.rotation.x = lerp(0, rx, e); a.rotation.z = lerp(i ? 0.22 : -0.22, rz, e);
    });
    Q.brows.forEach(function (b, i) {
      var s = i ? 1 : -1, raise = P.brow[0], ang = P.brow[1], one = P.brow[2] && i === 1 ? 0.04 : 0;
      b.position.y = 0.15 + (raise + one) * e; b.rotation.z = -s * ang * e;
    });
    var blink = (t % 3.7) < 0.12 || mood === 'happy' && false;
    Q.eyes.forEach(function (ey) { ey.scale.y = blink ? 0.12 : (mood === 'shocked' ? 1.25 : mood === 'happy' || mood === 'proud' ? 0.8 : 1); });
    Object.keys(Q.mouth).forEach(function (k) { Q.mouth[k].visible = k === P.mouth; });
    Q.cheeks.forEach(function (c) { c.visible = !!P.cheeks; });
    Q.sweat.visible = !!P.sweat; if (P.sweat) Q.sweat.position.y = 0.12 - ((t * 0.25) % 0.12);
    Q.sparks.forEach(function (sp, i) {
      sp.visible = !!P.sparks; if (!P.sparks) return;
      var a = t * 1.6 + i * Math.PI * 2 / 5; sp.position.set(Math.cos(a) * 0.62, 1.35 + Math.sin(a * 1.3) * 0.35, Math.sin(a) * 0.35); sp.rotation.set(t * 2, t * 3, 0);
      sp.scale.setScalar(0.7 + 0.4 * Math.abs(Math.sin(t * 3 + i)));
    });
  }

  /* ---------- drawing ---------- */
  function visible(c) { if (!c.isConnected || !c.offsetParent) return false; var r = c.getBoundingClientRect(); return r.bottom > 0 && r.top < (window.innerHeight || 800) && r.width > 0; }
  function drawAll(now, force) {
    var list = document.querySelectorAll('canvas.q3d'), t = now / 1000, any = false;
    for (var i = 0; i < list.length; i++) {
      var c = list[i]; if (!force && !visible(c)) continue; any = true;
      var s = st ? st.get(c) : c.__q; if (!s) { s = { born: t }; if (st) st.set(c, s); else c.__q = s; }
      if (still()) pose(c.dataset.mood, 1, 9); else pose(c.dataset.mood, t + i * 0.37, t - s.born);
      R.render(scene, cam);
      var x = c.getContext('2d'); x.clearRect(0, 0, c.width, c.height); x.drawImage(R.domElement, 0, 0, c.width, c.height);
    }
    return any;
  }
  function loop(now) {
    raf = 0; if (!ready || choice !== 'rani') return;
    if (!document.hidden && now - lastT > (still() ? 400 : 33)) { lastT = now; drawAll(now, false); }
    raf = requestAnimationFrame(loop);
  }
  function start() { if (!raf && ready && choice === 'rani') raf = requestAnimationFrame(loop); }
  function fallback() {
    failed = true;
    var list = document.querySelectorAll('canvas.q3d');
    for (var i = 0; i < list.length; i++) { var c = list[i], d = document.createElement('div'); d.innerHTML = coach2d(c.dataset.mood, +c.dataset.size || 64); c.parentNode.replaceChild(d.firstChild, c); }
  }
  function init() {
    if (choice !== 'rani' || ready || failed) return;
    var ok = false; try { var tc = document.createElement('canvas'); ok = !!(tc.getContext('webgl') || tc.getContext('experimental-webgl')); } catch (e) {}
    if (!ok || !window.Board3D || !Board3D.loadThree) { fallback(); return; }
    Board3D.loadThree().then(function (THREE) {
      T = THREE;
      try { build(); } catch (e) { fallback(); return; }
      ready = true; drawAll(performance.now(), true); start();
    }).catch(fallback);
  }
  if (window.MutationObserver) new MutationObserver(function () { if (ready && choice === 'rani') drawAll(performance.now(), false); }).observe(document.documentElement, { childList: true, subtree: true });
  document.addEventListener('visibilitychange', function () { if (!document.hidden) start(); });
  function set(c) {
    choice = c === 'gaja' ? 'gaja' : 'rani'; try { localStorage.setItem(KEY, choice); } catch (e) {}
    if (choice === 'rani') { failed = false; init(); start(); }
  }
  setTimeout(init, 0);
  return { set: set, get: function () { return choice; }, isReady: function () { return ready; } };
})();
