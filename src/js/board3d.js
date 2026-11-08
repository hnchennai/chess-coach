/* ---------- 3D board: Three.js r128, loaded only when the 3D view is switched on ---------- */
var Board3D = (function () {
  'use strict';
  var URL3 = 'vendor/three.min.js';
  var URLGL = 'vendor/GLTFLoader.js', HEIR = 'models/heirloom.json';
  var heir = null, heirTried = false, heirBoard = null, labels = null;
  var T = null, loading = null, on = false, host = null, opts = {};
  var renderer, scene, cam, boardMesh, texCoords, texPlain, hlGroup, arGroup, pcGroup;
  var pieces = [], state = null, theme = null, white = true;
  var az = 0, azGoal = 0, pol = 0.6, zoom = 1, raf = 0, anims = [], dirty = true, sizeW = 0;
  var geoCache = {}, matCache = {};
  var GLY = { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' };

  function load() {
    if (window.THREE) return Promise.resolve(window.THREE);
    if (loading) return loading;
    loading = new Promise(function (res, rej) {
      var s = document.createElement('script'); s.src = URL3; s.async = true;
      s.onload = function () { window.THREE ? res(window.THREE) : rej(new Error('no THREE')); };
      s.onerror = function () { loading = null; rej(new Error('Could not load the 3D library.')); };
      document.head.appendChild(s);
    });
    return loading;
  }
  function webglOK() { try { var c = document.createElement('canvas'); return !!(window.WebGLRenderingContext && (c.getContext('webgl') || c.getContext('experimental-webgl'))); } catch (e) { return false; } }

  /* ---------- coordinates ---------- */
  var FILES = 'abcdefgh';
  function sqPos(sq) { return { x: FILES.indexOf(sq[0]) - 3.5, z: 3.5 - (+sq[1] - 1) }; }
  function posSq(x, z) { var f = Math.floor(x + 4), r = Math.floor(4 - z); if (f < 0 || f > 7 || r < 0 || r > 7) return null; return FILES[f] + (r + 1); }

  /* ---------- colors ---------- */
  function cssColor(c) {
    if (!c) return '#2f7d5b';
    var m = /var\((--[^)]+)\)/.exec(c);
    if (m) { var v = getComputedStyle(document.documentElement).getPropertyValue(m[1]).trim(); return v || '#2f7d5b'; }
    return c;
  }
  function col(c) { var o = new T.Color(); try { o.setStyle(c); } catch (e) { o.set('#888'); } return o.convertSRGBToLinear(); }
  function mixHex(a, b, t) { var x = new T.Color(a), y = new T.Color(b); return '#' + x.lerp(y, t).getHexString(); }

  /* ---------- materials ---------- */
  function mat(key, make) { return matCache[key] || (matCache[key] = make()); }
  function std(c, rough, metal, extra) { var o = { color: col(c), roughness: rough, metalness: metal }; if (extra) for (var k in extra) o[k] = extra[k]; return new T.MeshStandardMaterial(o); }
  function palette(set, color) {
    var S = Avatar.SETS[set];
    if (!S || set === 'classic') return null;
    var P = color === 'w' ? S.pw : S.pb;
    if (!P) { var o = color === 'w' ? S.light : S.dark; P = [o[0], o[0], o[1], o[1], o[2], o[1]]; }
    return P;
  }
  function mats(set, color) {
    var key = set + color;
    return mat(key, function () {
      if (set === 'classic') {
        var w = color === 'w';
        return { body: std(w ? '#efe3c8' : '#2b211b', w ? 0.42 : 0.3, 0.05), trim: std(w ? '#c9a45a' : '#b48a3c', 0.3, 0.85), felt: std('#2f5d3a', 0.95, 0) };
      }
      var P = palette(set, color);
      return {
        body: std(mixHex(P[0], P[1], 0.55), 0.38, 0.12),
        trim: std(mixHex(P[2], P[3], 0.45), 0.28, 0.9),
        ink: std(color === 'w' ? mixHex(P[2], P[3], 0.6) : mixHex(P[2], P[3], 0.3), 0.25, 0.92),
        acc: std(P[5], 0.32, 0.25),
        felt: std('#2f2a26', 0.95, 0)
      };
    });
  }

  /* ---------- geometry helpers ---------- */
  function merge(list) {
    var pos = [], nor = [];
    list.forEach(function (g) {
      var n = g.index ? g.toNonIndexed() : g;
      if (!n.attributes.normal) n.computeVertexNormals();
      var p = n.attributes.position.array, q = n.attributes.normal.array;
      for (var i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(q[i]); }
      if (n !== g) n.dispose(); g.dispose();
    });
    var out = new T.BufferGeometry();
    out.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    out.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
    out.computeBoundingBox();
    return out;
  }
  function lathe(pts, segs) { return new T.LatheGeometry(pts.map(function (p) { return new T.Vector2(Math.max(0.0001, p[0]), p[1]); }), segs || 40); }
  function arcPts(cx, cy, r, a0, a1, n) { var out = []; for (var i = 0; i <= n; i++) { var a = a0 + (a1 - a0) * i / n; out.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); } return out; }
  function at(g, x, y, z, rx, ry, rz) { if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x, y, z); return g; }
  function base(R) { return [[0, 0], [R, 0], [R, 0.05], [R * 0.97, 0.075], [R * 0.9, 0.085], [R * 0.93, 0.11], [R * 0.86, 0.13], [R * 0.7, 0.16]]; }

  /* ---------- classic Staunton ---------- */
  function staunton(type) {
    var body = [], trim = [];
    if (type === 'p') {
      body.push(lathe(base(0.27).concat([[0.13, 0.27], [0.11, 0.33], [0.19, 0.35], [0.19, 0.37], [0.12, 0.39]], arcPts(0, 0.49, 0.125, -0.9, Math.PI / 2, 14))));
    } else if (type === 'r') {
      body.push(lathe(base(0.31).concat([[0.21, 0.2], [0.19, 0.5], [0.22, 0.54], [0.25, 0.56], [0.25, 0.68], [0.18, 0.68], [0.18, 0.63], [0, 0.63]])));
      for (var i = 0; i < 6; i++) { var a = i * Math.PI / 3; var b = new T.BoxGeometry(0.1, 0.08, 0.075); b.rotateY(-a); b.translate(Math.cos(a) * 0.215, 0.72, Math.sin(a) * 0.215); body.push(b); }
    } else if (type === 'b') {
      body.push(lathe(base(0.3).concat([[0.13, 0.3], [0.1, 0.45], [0.19, 0.47], [0.19, 0.5], [0.11, 0.52], [0.12, 0.56], [0.15, 0.62], [0.15, 0.67], [0.13, 0.73], [0.09, 0.79], [0.04, 0.83], [0, 0.84]])));
      body.push(at(new T.SphereGeometry(0.045, 14, 10), 0, 0.88, 0));
      trim.push(at(new T.BoxGeometry(0.2, 0.025, 0.07), 0.02, 0.69, 0.1, 0, 0, 0.75));
    } else if (type === 'q') {
      body.push(lathe(base(0.34).concat([[0.14, 0.32], [0.11, 0.6], [0.21, 0.62], [0.21, 0.65], [0.13, 0.67], [0.15, 0.72], [0.2, 0.85], [0.21, 0.88], [0.16, 0.89]], arcPts(0, 0.88, 0.16, 0.05, Math.PI / 2, 8))));
      for (var j = 0; j < 9; j++) { var c = j * Math.PI * 2 / 9; trim.push(at(new T.SphereGeometry(0.035, 10, 8), Math.cos(c) * 0.195, 0.905, Math.sin(c) * 0.195)); }
      trim.push(at(new T.SphereGeometry(0.06, 16, 12), 0, 1.07, 0));
    } else if (type === 'k') {
      body.push(lathe(base(0.35).concat([[0.15, 0.34], [0.12, 0.68], [0.23, 0.7], [0.23, 0.73], [0.14, 0.75], [0.16, 0.8], [0.21, 0.94], [0.21, 0.97], [0.15, 0.99], [0.08, 1.02], [0, 1.03]])));
      trim.push(at(new T.BoxGeometry(0.06, 0.24, 0.06), 0, 1.14, 0));
      trim.push(at(new T.BoxGeometry(0.18, 0.06, 0.06), 0, 1.17, 0));
    } else if (type === 'n') {
      body.push(lathe(base(0.31).concat([[0.22, 0.2], [0.22, 0.23], [0, 0.23]])));
      var s = new T.Shape();
      var H = [[0.2, 0], [0.23, 0.18], [0.2, 0.38], [0.13, 0.53], [0.05, 0.62], [0.03, 0.72], [-0.02, 0.63], [-0.12, 0.58], [-0.22, 0.45], [-0.29, 0.34], [-0.28, 0.28], [-0.2, 0.25], [-0.1, 0.28], [-0.05, 0.22], [-0.13, 0.1], [-0.17, 0]];
      s.moveTo(H[0][0], H[0][1]); for (var h = 1; h < H.length; h++) s.lineTo(H[h][0], H[h][1]);
      var head = new T.ExtrudeGeometry(s, { depth: 0.13, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 3, curveSegments: 4 });
      head.translate(0, 0.2, -0.065); body.push(head);
      var mane = new T.Shape(); var M = [[0.2, 0.06], [0.24, 0.2], [0.21, 0.4], [0.14, 0.55], [0.08, 0.6], [0.12, 0.45], [0.16, 0.3], [0.16, 0.1]];
      mane.moveTo(M[0][0], M[0][1]); for (var m = 1; m < M.length; m++) mane.lineTo(M[m][0], M[m][1]);
      var mg = new T.ExtrudeGeometry(mane, { depth: 0.07, bevelEnabled: true, bevelThickness: 0.02, bevelSize: 0.015, bevelSegments: 2 }); mg.translate(0.012, 0.2, -0.035); trim.push(mg);
      trim.push(at(new T.SphereGeometry(0.025, 8, 6), -0.13, 0.67, 0.11)); trim.push(at(new T.SphereGeometry(0.025, 8, 6), -0.13, 0.67, -0.11));
    }
    return { body: merge(body), trim: trim.length ? merge(trim) : null };
  }

  /* ---------- SVG icon -> 3D emblem ---------- */
  function num(s) { return parseFloat(s); }
  function attrs(tag) { var o = {}, re = /([a-z-]+)="([^"]*)"/g, m; while ((m = re.exec(tag))) o[m[1]] = m[2]; return o; }
  function arcToPts(x1, y1, rx, ry, phi, fa, fs, x2, y2) {
    var out = []; if (rx === 0 || ry === 0) return [[x2, y2]];
    var c = Math.cos(phi), s = Math.sin(phi), dx = (x1 - x2) / 2, dy = (y1 - y2) / 2;
    var xp = c * dx + s * dy, yp = -s * dx + c * dy;
    rx = Math.abs(rx); ry = Math.abs(ry);
    var l = xp * xp / (rx * rx) + yp * yp / (ry * ry); if (l > 1) { rx *= Math.sqrt(l); ry *= Math.sqrt(l); }
    var num1 = rx * rx * ry * ry - rx * rx * yp * yp - ry * ry * xp * xp, den = rx * rx * yp * yp + ry * ry * xp * xp;
    var k = Math.sqrt(Math.max(0, num1 / den)) * (fa === fs ? -1 : 1);
    var cxp = k * rx * yp / ry, cyp = -k * ry * xp / rx, cx = c * cxp - s * cyp + (x1 + x2) / 2, cy = s * cxp + c * cyp + (y1 + y2) / 2;
    function ang(ux, uy, vx, vy) { var a = Math.atan2(ux * vy - uy * vx, ux * vx + uy * vy); return a; }
    var t1 = ang(1, 0, (xp - cxp) / rx, (yp - cyp) / ry), dt = ang((xp - cxp) / rx, (yp - cyp) / ry, (-xp - cxp) / rx, (-yp - cyp) / ry);
    if (!fs && dt > 0) dt -= 2 * Math.PI; if (fs && dt < 0) dt += 2 * Math.PI;
    var n = Math.max(6, Math.ceil(Math.abs(dt) / 0.3));
    for (var i = 1; i <= n; i++) { var t = t1 + dt * i / n; out.push([cx + rx * Math.cos(t) * c - ry * Math.sin(t) * s, cy + rx * Math.cos(t) * s + ry * Math.sin(t) * c]); }
    return out;
  }
  function pathSubs(d) {
    var tk = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g) || [], i = 0, cmd = '', x = 0, y = 0, sx = 0, sy = 0, subs = [], cur = null, lc = null;
    function n() { return num(tk[i++]); }
    function start(px, py) { cur = { pts: [[px, py]], corners: [0], closed: false }; subs.push(cur); }
    function add(px, py, corner) { if (!cur) start(x, y); cur.pts.push([px, py]); if (corner) cur.corners.push(cur.pts.length - 1); }
    while (i < tk.length) {
      if (/[a-zA-Z]/.test(tk[i])) cmd = tk[i++];
      var rel = cmd === cmd.toLowerCase(), C = cmd.toUpperCase();
      if (C === 'Z') { if (cur) { cur.closed = true; } x = sx; y = sy; cur = null; continue; }
      if (C === 'M') { x = (rel ? x : 0) + n(); y = (rel ? y : 0) + n(); sx = x; sy = y; start(x, y); cmd = rel ? 'l' : 'L'; lc = null; continue; }
      if (C === 'L') { x = (rel ? x : 0) + n(); y = (rel ? y : 0) + n(); add(x, y, true); lc = null; continue; }
      if (C === 'H') { x = (rel ? x : 0) + n(); add(x, y, true); lc = null; continue; }
      if (C === 'V') { y = (rel ? y : 0) + n(); add(x, y, true); lc = null; continue; }
      if (C === 'C' || C === 'S' || C === 'Q') {
        var x1, y1, x2, y2, ex, ey, ox = rel ? x : 0, oy = rel ? y : 0;
        if (C === 'C') { x1 = ox + n(); y1 = oy + n(); x2 = ox + n(); y2 = oy + n(); }
        else if (C === 'S') { x1 = lc ? 2 * x - lc[0] : x; y1 = lc ? 2 * y - lc[1] : y; x2 = ox + n(); y2 = oy + n(); }
        else { var qx = ox + n(), qy = oy + n(); x1 = x + 2 / 3 * (qx - x); y1 = y + 2 / 3 * (qy - y); ex = 0; }
        ex = ox + n(); ey = oy + n();
        if (C === 'Q') { x2 = ex + 2 / 3 * (qx - ex); y2 = ey + 2 / 3 * (qy - ey); }
        for (var k = 1; k <= 10; k++) { var t = k / 10, u = 1 - t; add(u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * ex, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * ey, k === 10); }
        lc = [x2, y2]; x = ex; y = ey; continue;
      }
      if (C === 'A') {
        var rx = n(), ry = n(), ph = n() * Math.PI / 180, fa = n(), fs = n(), ax = (rel ? x : 0) + n(), ay = (rel ? y : 0) + n();
        var ap = arcToPts(x, y, rx, ry, ph, fa, fs, ax, ay); ap.forEach(function (p, j) { add(p[0], p[1], j === ap.length - 1); });
        x = ax; y = ay; lc = null; continue;
      }
      i++;
    }
    return subs;
  }
  function ellipseSub(cx, cy, rx, ry) { var pts = []; for (var i = 0; i < 28; i++) { var a = i / 28 * Math.PI * 2; pts.push([cx + rx * Math.cos(a), cy + ry * Math.sin(a)]); } return { pts: pts, corners: [], closed: true }; }
  function iconElements(svg) {
    var out = [], re = /<(path|circle|ellipse|rect)\b([^>]*)\/?>/g, m;
    while ((m = re.exec(svg))) {
      var a = attrs(m[2]), subs;
      if (m[1] === 'path') subs = pathSubs(a.d || '');
      else if (m[1] === 'circle') subs = [ellipseSub(num(a.cx), num(a.cy), num(a.r), num(a.r))];
      else if (m[1] === 'ellipse') subs = [ellipseSub(num(a.cx), num(a.cy), num(a.rx), num(a.ry))];
      else { var x = num(a.x), y = num(a.y), w = num(a.width), h = num(a.height); subs = [{ pts: [[x, y], [x + w, y], [x + w, y + h], [x, y + h]], corners: [0, 1, 2, 3], closed: true }]; }
      out.push({ fill: a.fill && a.fill !== 'none', subs: subs });
    }
    return out;
  }
  function emblemGeo(iconSvg, size) {
    var S = size / 24, ink = [], acc = [], R = 0.95 * S;
    function P(p) { return new T.Vector3((p[0] - 12) * S, (24 - p[1]) * S, 0); }
    iconElements(iconSvg).forEach(function (el) {
      el.subs.forEach(function (sb) {
        var pts = sb.pts.filter(function (p, i) { return i === 0 || Math.abs(p[0] - sb.pts[i - 1][0]) + Math.abs(p[1] - sb.pts[i - 1][1]) > 1e-4; });
        if (pts.length < 2) return;
        if (el.fill && pts.length > 2) {
          var sh = new T.Shape(); sh.moveTo((pts[0][0] - 12) * S, (24 - pts[0][1]) * S);
          for (var i = 1; i < pts.length; i++) sh.lineTo((pts[i][0] - 12) * S, (24 - pts[i][1]) * S);
          var eg = new T.ExtrudeGeometry(sh, { depth: 1.5 * S, bevelEnabled: false, curveSegments: 2 }); eg.translate(0, 0, -0.75 * S); acc.push(eg);
        }
        var path = new T.CurvePath(), list = pts.slice(); if (sb.closed) list.push(pts[0]);
        for (var j = 1; j < list.length; j++) path.add(new T.LineCurve3(P(list[j - 1]), P(list[j])));
        ink.push(new T.TubeGeometry(path, Math.max(2, (list.length - 1) * 2), R, 7, false));
        var caps = sb.closed ? sb.corners : sb.corners.concat([0, pts.length - 1]);
        caps.forEach(function (ci) { if (pts[ci]) { var sp = new T.SphereGeometry(R, 8, 6); var v = P(pts[ci]); sp.translate(v.x, v.y, v.z); ink.push(sp); } });
      });
    });
    return { ink: ink.length ? merge(ink) : null, acc: acc.length ? merge(acc) : null };
  }

  /* ---------- themed piece: pedestal + collar + 3D emblem + glyph plaque ---------- */
  var PED = { k: 0.36, q: 0.32, r: 0.26, b: 0.26, n: 0.26, p: 0.16 };
  var EMB = { k: 0.74, q: 0.72, r: 0.68, b: 0.68, n: 0.68, p: 0.56 };
  function themed(set, color, type) {
    var S = Avatar.SETS[set], e = S[color][type], icon = Avatar.ICONS[e[0]] || '', h = PED[type], R = type === 'p' ? 0.27 : 0.31;
    var body = [lathe(base(R).concat([[R * 0.55, 0.18], [R * 0.48, h - 0.04], [R * 0.62, h - 0.02], [R * 0.62, h], [0, h]]))];
    var trim = [at(new T.TorusGeometry(R * 0.6, 0.018, 8, 40), 0, h - 0.01, 0, Math.PI / 2), at(new T.TorusGeometry(R * 0.93, 0.016, 8, 40), 0, 0.1, 0, Math.PI / 2)];
    if (type === 'k') for (var i = 0; i < 8; i++) { var a = i * Math.PI / 4, cn = new T.ConeGeometry(0.03, 0.08, 6); cn.translate(Math.cos(a) * R * 0.6, h + 0.035, Math.sin(a) * R * 0.6); trim.push(cn); }
    if (type === 'q') for (var j = 0; j < 10; j++) { var b = j * Math.PI / 5; trim.push(at(new T.SphereGeometry(0.025, 8, 6), Math.cos(b) * R * 0.6, h + 0.015, Math.sin(b) * R * 0.6)); }
    if (type === 'r') for (var k = 0; k < 6; k++) { var c = k * Math.PI / 3, bx = new T.BoxGeometry(0.06, 0.05, 0.05); bx.rotateY(-c); bx.translate(Math.cos(c) * R * 0.6, h + 0.02, Math.sin(c) * R * 0.6); trim.push(bx); }
    var em = emblemGeo(icon, EMB[type]), lift = h + (type === 'k' || type === 'r' ? 0.03 : 0.01), my = minY(em);
    [em.ink, em.acc].forEach(function (g) { if (g) { g.translate(0, -my, 0); g.computeBoundingBox(); } });
    return { lift: lift, body: merge(body), trim: merge(trim), ink: em.ink, acc: em.acc, plaqueY: 0.1 + (h - 0.1) * 0.55, plaqueZ: R * 0.66 };
  }
  function minY(em) { var m = Infinity; [em.ink, em.acc].forEach(function (g) { if (g) { g.computeBoundingBox(); m = Math.min(m, g.boundingBox.min.y); } }); return m === Infinity ? 0 : m; }

  var glyphTex = {};
  function plaqueMat(set, color, type) {
    var key = set + color + type;
    if (glyphTex[key]) return glyphTex[key];
    var P = palette(set, color), c = document.createElement('canvas'); c.width = c.height = 128;
    var x = c.getContext('2d');
    x.fillStyle = mixHex(P[2], P[3], 0.4); x.beginPath(); x.arc(64, 64, 62, 0, Math.PI * 2); x.fill();
    x.fillStyle = P[1]; x.beginPath(); x.arc(64, 64, 52, 0, Math.PI * 2); x.fill();
    x.fillStyle = P[4]; x.font = '78px "Noto Sans Symbols 2","Segoe UI Symbol","DejaVu Sans",sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(GLY[type] + '︎', 64, 70);
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = 4;
    return (glyphTex[key] = new T.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.1, transparent: true }));
  }

  function geos(set, color, type) {
    var key = set === 'classic' ? 'c' + type : set + color + type;
    if (!geoCache[key]) geoCache[key] = set === 'classic' ? staunton(type) : themed(set, color, type);
    return geoCache[key];
  }
  /* character figures (Ramayana): low pedestal + figure + glyph plaque */
  var FIG_SCALE = { k: 0.86, q: 0.84, r: 0.8, b: 0.8, n: 0.82, p: 0.7 };
  function figurePiece(set, color, type) {
    var key = 'fig' + set + color + type;
    if (!geoCache[key]) {
      var parts = Rama3D.build(T, color, type, set) || [], s = FIG_SCALE[type], R = type === 'p' ? 0.26 : 0.3, h = 0.07;
      parts.forEach(function (pt) { pt.geo.scale(s, s, s); pt.geo.translate(0, h, 0); });
      var ped = lathe([[0, 0], [R, 0], [R, 0.035], [R * 0.95, 0.055], [R * 0.9, h], [0, h]]), trim = new T.TorusGeometry(R * 0.975, 0.012, 8, 40); trim.rotateX(Math.PI / 2); trim.translate(0, 0.035, 0);
      geoCache[key] = { parts: parts, ped: ped, trim: trim, R: R };
    }
    var G = geoCache[key], g = new T.Group(), w = color === 'w';
    var pedM = mat('ped' + color, function () { return std(w ? '#efe3c8' : '#2b211b', 0.4, 0.05); }), trimM = mat('pedtrim', function () { return std('#d9ab48', 0.28, 0.9); });
    function add(geo, m) { var me = new T.Mesh(geo, m); me.castShadow = true; me.receiveShadow = true; g.add(me); }
    add(G.ped, pedM); add(G.trim, trimM);
    G.parts.forEach(function (pt) { add(pt.geo, mat('fig' + pt.key + pt.color + pt.rough, function () { return std(pt.color, pt.rough, pt.metal); })); });
    var pl = new T.Mesh(plaqueGeo || (plaqueGeo = new T.CircleGeometry(0.075, 24)), plaqueMat(set, color, type)); pl.scale.setScalar(0.85); pl.position.set(0, 0.06, G.R + 0.02); pl.rotation.x = -0.5; g.add(pl);
    g.userData.bill = true;
    return g;
  }
  function makePiece(set, color, type) {
    if (set === 'classic' && heir && heir[color + type]) { var hp = heir[color + type].clone(); if (type === 'n') hp.rotation.y = color === 'w' ? -Math.PI / 2 : Math.PI / 2; return hp; }
    if (window.Rama3D && Rama3D.has(set)) return figurePiece(set, color, type);
    var G = geos(set, color, type), M = mats(set, color), g = new T.Group();
    function add(geo, m) { if (!geo) return; var me = new T.Mesh(geo, m); me.castShadow = true; me.receiveShadow = true; g.add(me); }
    add(G.body, M.body); add(G.trim, M.trim);
    if (G.ink || G.acc) { var eg = new T.Group(); eg.position.y = G.lift || 0; g.add(eg); g.userData.emb = eg; var keep = g; g = eg; add(G.ink, M.ink); add(G.acc, M.acc); g = keep; }
    if (set !== 'classic') {
      var pl = new T.Mesh(plaqueGeo || (plaqueGeo = new T.CircleGeometry(0.075, 24)), plaqueMat(set, color, type));
      pl.position.set(0, G.plaqueY, G.plaqueZ + 0.004); pl.rotation.x = -0.12; g.add(pl);
      g.userData.bill = true;
    } else if (type === 'n') {
      g.rotation.y = color === 'w' ? -0.45 : Math.PI - 0.45;
    }
    return g;
  }
  var feltGeo = null, plaqueGeo = null;

  /* ---------- scene ---------- */
  function boardTexture(coords) {
    var N = 1152, c = document.createElement('canvas'); c.width = c.height = N; var x = c.getContext('2d'), u = N / 9, m = u / 2;
    var g = x.createLinearGradient(0, 0, N, N); g.addColorStop(0, '#5a3a22'); g.addColorStop(0.5, '#3e2716'); g.addColorStop(1, '#5a3a22');
    x.fillStyle = g; x.fillRect(0, 0, N, N);
    for (var r = 0; r < 8; r++) for (var f = 0; f < 8; f++) {
      x.fillStyle = (r + f) % 2 === 0 ? '#e6cfa2' : '#9f6f45'; x.fillRect(m + f * u, m + r * u, u, u);
    }
    for (var i = 0; i < 2600; i++) { x.fillStyle = 'rgba(80,50,20,' + (Math.random() * 0.05) + ')'; x.fillRect(m + Math.random() * 8 * u, m + Math.random() * 8 * u, Math.random() * 40 + 6, 1.4); }
    x.strokeStyle = '#c9a45a'; x.lineWidth = 5; x.strokeRect(m - 4, m - 4, 8 * u + 8, 8 * u + 8);
    if (coords) {
      x.fillStyle = '#e9d3a3'; x.font = '600 ' + Math.round(u * 0.3) + 'px sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle';
      for (var k = 0; k < 8; k++) {
        x.fillText(FILES[k], m + (k + 0.5) * u, N - m / 2); x.fillText(String(8 - k), m / 2, m + (k + 0.5) * u);
        x.save(); x.translate(m + (k + 0.5) * u, m / 2); x.rotate(Math.PI); x.fillText(FILES[k], 0, 0); x.restore();
        x.save(); x.translate(N - m / 2, m + (k + 0.5) * u); x.rotate(Math.PI); x.fillText(String(8 - k), 0, 0); x.restore();
      }
    }
    var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding; t.anisotropy = renderer.capabilities.getMaxAnisotropy(); return t;
  }
  function envMap() {
    var es = new T.Scene(), c = document.createElement('canvas'); c.width = 64; c.height = 256; var x = c.getContext('2d');
    var g = x.createLinearGradient(0, 0, 0, 256); g.addColorStop(0, '#fff6e6'); g.addColorStop(0.45, '#b59a7a'); g.addColorStop(0.55, '#4a3a2c'); g.addColorStop(1, '#1a1410');
    x.fillStyle = g; x.fillRect(0, 0, 64, 256);
    var sky = new T.Mesh(new T.SphereGeometry(10, 32, 16), new T.MeshBasicMaterial({ map: new T.CanvasTexture(c), side: T.BackSide })); es.add(sky);
    [[6, 6, 4], [-7, 4, -3], [0, 8, -6]].forEach(function (p) { var l = new T.Mesh(new T.PlaneGeometry(4, 2), new T.MeshBasicMaterial({ color: 0xffffff, side: T.DoubleSide })); l.position.set(p[0], p[1], p[2]); l.lookAt(0, 0, 0); es.add(l); });
    var pm = new T.PMREMGenerator(renderer), rt = pm.fromScene(es, 0.04); pm.dispose(); return rt.texture;
  }
  function build() {
    renderer = new T.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = T.sRGBEncoding; renderer.toneMapping = T.ACESFilmicToneMapping; renderer.toneMappingExposure = 0.95;
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = T.PCFSoftShadowMap;
    scene = new T.Scene(); scene.environment = envMap();
    cam = new T.PerspectiveCamera(32, 1, 0.1, 100);
    scene.add(new T.HemisphereLight(0xfff3dd, 0x3a2a1c, 0.55));
    var sun = new T.DirectionalLight(0xfff0d8, 1.25); sun.position.set(-4, 10, 5); sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024); var sc = sun.shadow.camera; sc.left = -6; sc.right = 6; sc.top = 6; sc.bottom = -6; sc.near = 1; sc.far = 25; sun.shadow.bias = -0.0008; sun.shadow.radius = 3;
    scene.add(sun);
    texCoords = boardTexture(true); texPlain = boardTexture(false);
    var top = new T.MeshStandardMaterial({ map: texCoords, roughness: 0.55, metalness: 0.02 }), side = new T.MeshStandardMaterial({ color: 0x3e2716, roughness: 0.6 });
    boardMesh = new T.Mesh(new T.BoxGeometry(9, 0.35, 9), [side, side, top, side, side, side]); boardMesh.position.y = -0.175; boardMesh.receiveShadow = true; scene.add(boardMesh);
    hlGroup = new T.Group(); arGroup = new T.Group(); pcGroup = new T.Group(); scene.add(hlGroup, arGroup, pcGroup);
    var cv = renderer.domElement; cv.className = 'b3dcanvas'; host.appendChild(cv);
    bindInput(cv);
    if (window.ResizeObserver) new ResizeObserver(function () { if (on) { sizeW = 0; kick(); } }).observe(host);
    loadHeir();
  }
  /* ---------- the wood and marble set: "A Beautiful Game" (MaterialX Project / ASWF, glTF by Ed Mackey, CC BY 4.0), simplified ---------- */
  function script(src) { return new Promise(function (res, rej) { var s = document.createElement('script'); s.src = src; s.async = true; s.onload = res; s.onerror = rej; document.head.appendChild(s); }); }
  function loadHeir() {
    if (heirTried) return; heirTried = true;
    (T.GLTFLoader ? Promise.resolve() : script(URLGL)).then(function () {
      return new Promise(function (res, rej) { new T.GLTFLoader().load(HEIR, res, null, rej); });
    }).then(function (gltf) {
      var root = gltf.scene, S = 16, H = {};
      root.updateMatrixWorld(true);
      var bn = root.getObjectByName('Chessboard');
      if (bn) {
        var b0 = bn.clone(true); bn.matrixWorld.decompose(b0.position, b0.quaternion, b0.scale);
        var b = new T.Group(); b.add(b0); b.rotation.set(0, Math.PI, 0); b.scale.setScalar(S);
        var wrap = new T.Group(); wrap.add(b); wrap.updateMatrixWorld(true);
        var rc = new T.Raycaster(new T.Vector3(0.5, 20, 0.5), new T.Vector3(0, -1, 0)), hit = rc.intersectObject(wrap, true)[0];
        b.position.y = -(hit ? hit.point.y : 0.264);
        var bb = new T.Box3().setFromObject(wrap);
        wrap.traverse(function (o) { if (o.isMesh) { o.receiveShadow = true; o.castShadow = false; } });
        heirBoard = wrap; scene.add(wrap); boardMesh.visible = false;
        buildLabels(Math.max(4.3, Math.min(bb.max.x, bb.max.z)));
      }
      var names = { k: 'King', q: 'Queen', r: 'Castle', b: 'Bishop', n: 'Knight', p: 'Pawn_Body' };
      ['w', 'b'].forEach(function (c) {
        Object.keys(names).forEach(function (t) {
          var nm = names[t] + '_' + c.toUpperCase(), src = root.getObjectByName(nm) || root.getObjectByName(nm + '1');
          if (!src) return;
          var g0 = src.clone(true); src.matrixWorld.decompose(g0.position, g0.quaternion, g0.scale);
          var g = new T.Group(); g.add(g0); g.rotation.set(0, Math.PI, 0); g.scale.setScalar(S);
          var w = new T.Group(); w.add(g); w.updateMatrixWorld(true);
          var box = new T.Box3().setFromObject(w), ctr = box.getCenter(new T.Vector3());
          g.position.set(-ctr.x, -box.min.y, -ctr.z); w.updateMatrixWorld(true);
          w.traverse(function (o) { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
          H[c + t] = w;
        });
      });
      heir = H;
      if (theme === 'classic' && state) { var s = state; theme = null; state = null; sync(s, true); }
      kick();
    }).catch(function () { /* keep the built-in board and pieces */ });
  }
  function buildLabels(edge) {
    labels = new T.Group(); var mid = 4 + Math.min(0.45, (edge - 4) / 2), geo = new T.PlaneGeometry(0.42, 0.42);
    function lab(txt, x, z, rot) {
      var c = document.createElement('canvas'); c.width = c.height = 64; var x2 = c.getContext('2d');
      x2.fillStyle = '#f7e7c2'; x2.shadowColor = 'rgba(0,0,0,.6)'; x2.shadowBlur = 4; x2.font = '700 46px Georgia, serif'; x2.textAlign = 'center'; x2.textBaseline = 'middle'; x2.fillText(txt, 32, 34);
      var t = new T.CanvasTexture(c); t.encoding = T.sRGBEncoding;
      var m = new T.Mesh(geo, new T.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }));
      m.rotation.set(-Math.PI / 2, 0, rot); m.position.set(x, 0.02, z); m.renderOrder = 4; labels.add(m);
    }
    for (var i = 0; i < 8; i++) {
      lab(FILES[i], i - 3.5, mid, 0); lab(FILES[i], i - 3.5, -mid, Math.PI);
      lab(String(i + 1), -mid, 3.5 - i, 0); lab(String(i + 1), mid, 3.5 - i, Math.PI);
    }
    scene.add(labels);
  }

  /* ---------- camera ---------- */
  function fit() {
    if (!host) return false;
    var w = host.clientWidth, h = host.clientHeight || w; if (!w) return false;
    if (w !== sizeW || renderer.domElement.height !== Math.round(h * renderer.getPixelRatio())) { renderer.setSize(w, h, false); renderer.domElement.style.width = '100%'; renderer.domElement.style.height = '100%'; cam.aspect = w / h; cam.updateProjectionMatrix(); sizeW = w; }
    return true;
  }
  var FR = [[-4.05, 0, -4.05], [4.05, 0, -4.05], [-4.05, 0, 4.05], [4.05, 0, 4.05], [-3.5, 1.1, -3.5], [3.5, 1.1, -3.5], [-3.5, 1.1, 3.5], [3.5, 1.1, 3.5], [0, 0, 4.4], [0, 0, -4.4]];
  var vv = null;
  function setCam(d) {
    var a = az + (white ? 0 : Math.PI);
    cam.position.set(d * Math.sin(pol) * Math.sin(a), d * Math.cos(pol), d * Math.sin(pol) * Math.cos(a));
    cam.lookAt(0, 0, 0); cam.updateMatrixWorld();
  }
  function span() {
    vv = vv || new T.Vector3(); var x0 = 9, x1 = -9, y0 = 9, y1 = -9;
    FR.forEach(function (p) { vv.set(p[0], p[1], p[2]).project(cam); x0 = Math.min(x0, vv.x); x1 = Math.max(x1, vv.x); y0 = Math.min(y0, vv.y); y1 = Math.max(y1, vv.y); });
    return { x0: x0, x1: x1, y0: y0, y1: y1 };
  }
  function placeCam() {
    cam.clearViewOffset();
    var lo = 6, hi = 40, sp;
    for (var it = 0; it < 18; it++) { var mid = (lo + hi) / 2; setCam(mid); sp = span(); if (Math.max(-sp.x0, sp.x1) <= 0.995 && sp.y1 - sp.y0 <= 1.94) hi = mid; else lo = mid; }
    setCam(hi * zoom); sp = span();
    var w = renderer.domElement.width, h = renderer.domElement.height, cy = (sp.y1 + sp.y0) / 2;
    cam.setViewOffset(w, h, 0, -cy * h / 2 * Math.min(1, zoom), w, h);
    var ry = Math.atan2(cam.position.x, cam.position.z);
    var tilt = -(Math.PI / 2 - pol) * 0.45;
    pcGroup.children.forEach(function (o) { if (o.userData.bill) { o.rotation.y = ry; if (o.userData.emb) o.userData.emb.rotation.x = tilt; } });
  }

  /* ---------- input ---------- */
  var ptrs = {}, drag = null, pinch0 = 0, ray = null;
  function pick(ev) {
    var r = renderer.domElement.getBoundingClientRect(), v = new T.Vector2(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
    ray = ray || new T.Raycaster(); ray.setFromCamera(v, cam);
    var t = -ray.ray.origin.y / ray.ray.direction.y, ground = null;
    if (t > 0) { var pt = ray.ray.origin.clone().add(ray.ray.direction.clone().multiplyScalar(t)); ground = posSq(pt.x, pt.z); }
    var hits = ray.intersectObjects(pcGroup.children, true), sqs = [];
    hits.forEach(function (h) { var o = h.object; while (o && o.parent !== pcGroup) o = o.parent; if (o && o.userData.sq && sqs.indexOf(o.userData.sq) < 0) sqs.push(o.userData.sq); });
    if (ground && sqs.indexOf(ground) > -1) return ground;
    if (ground && state && state.pos.some(function (q) { return q.sq === ground; })) return ground;
    return sqs[0] || ground;
  }
  function bindInput(cv) {
    cv.style.touchAction = 'none';
    cv.addEventListener('pointerdown', function (e) {
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY }; try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      var ids = Object.keys(ptrs);
      if (ids.length === 1) drag = { x: e.clientX, y: e.clientY, az: az, pol: pol, moved: false };
      else if (ids.length === 2) { var a = ptrs[ids[0]], b = ptrs[ids[1]]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); drag && (drag.moved = true); drag && (drag.d0 = zoom); }
    });
    cv.addEventListener('pointermove', function (e) {
      if (!ptrs[e.pointerId]) { hover(e); return; }
      ptrs[e.pointerId] = { x: e.clientX, y: e.clientY };
      var ids = Object.keys(ptrs);
      if (ids.length === 2 && pinch0 && drag) { var a = ptrs[ids[0]], b = ptrs[ids[1]], d = Math.hypot(a.x - b.x, a.y - b.y); zoom = clamp(drag.d0 * pinch0 / Math.max(20, d), 0.6, 1.25); kick(); return; }
      if (!drag) return;
      var dx = e.clientX - drag.x, dy = e.clientY - drag.y;
      if (!drag.moved && Math.abs(dx) + Math.abs(dy) > 7) drag.moved = true;
      if (drag.moved) { az = azGoal = clamp(drag.az - dx * 0.008, -1.2, 1.2); pol = clamp(drag.pol - dy * 0.006, 0.28, 1.12); kick(); }
    });
    function up(e) {
      var wasTap = drag && !drag.moved && Object.keys(ptrs).length === 1;
      delete ptrs[e.pointerId];
      if (!Object.keys(ptrs).length) { if (wasTap && e.type === 'pointerup') { var s = pick(e); if (s && opts.onTap) opts.onTap(s); } drag = null; pinch0 = 0; }
    }
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up);
    cv.addEventListener('wheel', function (e) { e.preventDefault(); zoom = clamp(zoom * (e.deltaY > 0 ? 1.08 : 0.93), 0.6, 1.25); kick(); }, { passive: false });
  }
  var lastHover = 0;
  function hover(e) {
    var now = Date.now(); if (now - lastHover < 80 || !state) return; lastHover = now;
    var s = pick(e), p = s && state.pos.filter(function (q) { return q.sq === s; })[0], cv = renderer.domElement;
    var lab = p ? (Avatar.label(theme, p.color, p.type) || '') : '';
    cv.title = p ? (lab ? lab + ' (' + ({ k: 'king', q: 'queen', r: 'rook', b: 'bishop', n: 'knight', p: 'pawn' })[p.type] + ')' : '') : '';
    cv.style.cursor = s ? 'pointer' : 'grab';
  }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- highlights & arrows ---------- */
  var hlGeo = null, dotGeo = null, ringGeo = null, hlMats = {};
  function hlMat(c, o) { var k = c + o; return hlMats[k] || (hlMats[k] = new T.MeshBasicMaterial({ color: col(c), transparent: true, opacity: o, depthWrite: false })); }
  function addHl(sq, c, o, kind) {
    var p = sqPos(sq), g = kind === 'dot' ? (dotGeo || (dotGeo = new T.CircleGeometry(0.15, 24))) : kind === 'ring' ? (ringGeo || (ringGeo = new T.RingGeometry(0.38, 0.47, 32))) : (hlGeo || (hlGeo = new T.PlaneGeometry(1, 1)));
    var m = new T.Mesh(g, hlMat(c, o)); m.rotation.x = -Math.PI / 2; m.position.set(p.x, 0.012 + hlGroup.children.length * 0.0004, p.z); m.renderOrder = 2; hlGroup.add(m);
  }
  function clear(g) { while (g.children.length) { var c = g.children.pop(); if (c.geometry && c.userData.own) c.geometry.dispose(); } }
  function drawHl(s) {
    clear(hlGroup);
    if (s.last) { addHl(s.last.from, '#f2c94c', 0.42); addHl(s.last.to, '#f2c94c', 0.5); }
    (s.hls || []).forEach(function (q) { addHl(q, '#3b82c4', 0.45); });
    (s.ok || []).forEach(function (q) { addHl(q, '#2f9e5b', 0.55); });
    if (s.bad) addHl(s.bad, '#d64545', 0.55);
    if (s.check) addHl(s.check, '#e03b3b', 0.6);
    if (s.sel) addHl(s.sel, '#2f9e5b', 0.55);
    Object.keys(s.targets || {}).forEach(function (q) { s.targets[q] === 'cap' ? addHl(q, '#1f6b4a', 0.8, 'ring') : addHl(q, '#1f6b4a', 0.55, 'dot'); });
  }
  function drawArrows(s) {
    clear(arGroup);
    (s.arrows || []).forEach(function (a) {
      if (!a || !a.from || !a.to || a.from === a.to) return;
      var A = sqPos(a.from), B = sqPos(a.to), dx = B.x - A.x, dz = B.z - A.z, L = Math.hypot(dx, dz), ux = dx / L, uz = dz / L;
      var sh = new T.Shape(), w = 0.085, hw = 0.24, hl = 0.36, l0 = 0.18, l1 = L - hl;
      sh.moveTo(l0, -w); sh.lineTo(l1, -w); sh.lineTo(l1, -hw); sh.lineTo(L - 0.04, 0); sh.lineTo(l1, hw); sh.lineTo(l1, w); sh.lineTo(l0, w); sh.lineTo(l0, -w);
      var g = new T.ShapeGeometry(sh), m = new T.Mesh(g, new T.MeshBasicMaterial({ color: col(cssColor(a.color)), transparent: true, opacity: 0.85, depthWrite: false, side: T.DoubleSide }));
      m.userData.own = true; m.rotation.x = -Math.PI / 2; m.rotation.z = Math.atan2(-dz, dx); m.position.set(A.x, 0.03, A.z); m.renderOrder = 3; arGroup.add(m);
      void ux; void uz;
    });
  }

  /* ---------- pieces: diff + animate ---------- */
  function placeObj(o, sq) { var p = sqPos(sq); o.position.set(p.x, 0, p.z); o.userData.sq = sq; }
  function syncPieces(s, instant) {
    if (theme !== s.theme) { pieces.forEach(function (p) { pcGroup.remove(p.obj); }); pieces = []; theme = s.theme; instant = true; }
    var want = s.pos.slice(), keep = [], left = [];
    pieces.forEach(function (p) {
      var i = -1; for (var k = 0; k < want.length; k++) if (want[k].sq === p.sq && want[k].color === p.color && want[k].type === p.type) { i = k; break; }
      if (i > -1) { keep.push(p); want.splice(i, 1); } else left.push(p);
    });
    var next = keep.slice();
    want.forEach(function (w) {
      var best = -1, bd = 99, P = sqPos(w.sq);
      left.forEach(function (p, i) { if (p.color === w.color && p.type === w.type) { var q = sqPos(p.sq), d = Math.hypot(P.x - q.x, P.z - q.z); if (d < bd) { bd = d; best = i; } } });
      if (best > -1 && !instant) {
        var p = left.splice(best, 1)[0], from = sqPos(p.sq); p.sq = w.sq; p.obj.userData.sq = w.sq; next.push(p);
        var isN = p.type === 'n'; anims.push({ o: p.obj, t0: performance.now(), d: 380 + bd * 35, fx: from.x, fz: from.z, tx: P.x, tz: P.z, hop: isN ? 0.55 : 0.12 + Math.min(0.25, bd * 0.03), kind: 'move' });
      } else {
        var o = makePiece(s.theme, w.color, w.type); placeObj(o, w.sq); pcGroup.add(o);
        var np = { obj: o, sq: w.sq, color: w.color, type: w.type }; next.push(np);
        if (!instant) { o.scale.setScalar(0.01); anims.push({ o: o, t0: performance.now() + 200, d: 320, kind: 'grow' }); }
      }
    });
    left.forEach(function (p) {
      if (instant) { pcGroup.remove(p.obj); return; }
      anims.push({ o: p.obj, t0: performance.now() + 220, d: 380, kind: 'drop' });
    });
    pieces = next;
  }
  function ease(t) { return t < 0 ? 0 : t > 1 ? 1 : t * t * (3 - 2 * t); }
  function step(now) {
    var live = [];
    anims.forEach(function (a) {
      var t = (now - a.t0) / a.d, e = ease(t);
      if (a.kind === 'move') { a.o.position.x = a.fx + (a.tx - a.fx) * e; a.o.position.z = a.fz + (a.tz - a.fz) * e; a.o.position.y = Math.sin(Math.PI * Math.min(1, Math.max(0, t))) * a.hop; }
      else if (a.kind === 'grow') { a.o.scale.setScalar(Math.max(0.01, e)); a.o.position.y = (1 - e) * 0.3; }
      else if (a.kind === 'drop') { a.o.scale.setScalar(Math.max(0.01, 1 - e)); a.o.position.y = -0.25 * e; if (t >= 1) pcGroup.remove(a.o); }
      if (t < 1) live.push(a);
    });
    anims = live;
  }
  function kick() { dirty = true; if (!raf) raf = requestAnimationFrame(loop); }
  function loop(now) {
    raf = 0; if (!on) return;
    if (!fit()) return;
    if (Math.abs(azGoal - az) > 0.001 && !drag) { az += (azGoal - az) * 0.18; dirty = true; }
    if (anims.length) { step(now); dirty = true; }
    if (dirty) { placeCam(); renderer.render(scene, cam); dirty = false; }
    if (anims.length || (Math.abs(azGoal - az) > 0.001 && !drag)) raf = requestAnimationFrame(loop);
  }

  /* ---------- public API ---------- */
  function enable(container, o) {
    opts = o || {}; host = container;
    if (!webglOK()) return Promise.reject(new Error('This device does not support 3D graphics.'));
    on = true;
    return load().then(function (THREE) {
      T = THREE; if (!on) return;
      if (!renderer) build(); else if (renderer.domElement.parentNode !== host) host.appendChild(renderer.domElement);
      sizeW = 0; if (state) { var s = state; state = null; sync(s, true); }
      kick();
    });
  }
  function disable() { on = false; if (raf) cancelAnimationFrame(raf); raf = 0; }
  function sync(s, instant) {
    var prev = state; state = s; if (!on || !T || !renderer) return;
    var flip = prev && prev.white !== s.white; white = s.white;
    if (flip) { az = -az; }
    boardMesh.material[2].map = s.coords === false ? texPlain : texCoords;
    if (labels) labels.visible = s.coords !== false;
    syncPieces(s, instant || !prev);
    drawHl(s); drawArrows(s); kick();
  }
  function resize() { sizeW = 0; kick(); }
  window.addEventListener('resize', function () { if (on) resize(); });
  function screenOf(sq, front) { var p = sqPos(sq), v = new T.Vector3(p.x, 0, p.z + (front ? (white ? 0.38 : -0.38) : 0)).project(cam), r = renderer.domElement.getBoundingClientRect(); return { x: r.left + (v.x + 1) / 2 * r.width, y: r.top + (1 - v.y) / 2 * r.height }; }
  return { enable: enable, disable: disable, sync: sync, resize: resize, screenOf: screenOf, loadThree: load, isOn: function () { return on; } };
})();
