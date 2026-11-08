/* ---------- Ramayana 3D figures: original stylised characters built from simple shapes ---------- */
var Rama3D = (function () {
  'use strict';
  var T = null;
  var MAT = {
    gold: [0.25, 0.95], gem: [0.15, 0.2], eye: [0.3, 0], white: [0.35, 0], lip: [0.5, 0], skin: [0.55, 0], cloth: [0.6, 0.02], cloth2: [0.55, 0.05],
    hair: [0.7, 0], fur: [0.85, 0], furL: [0.75, 0], stone: [0.9, 0], stone2: [0.9, 0], wood: [0.7, 0], steel: [0.3, 0.8], deer: [0.35, 0.55], lotus: [0.5, 0],
    saffron: [0.6, 0], tilak: [0.5, 0], horn: [0.5, 0], armor: [0.45, 0.35]
  };

  /* ---------- kit ---------- */
  function Kit(col) { this.p = {}; this.col = col; }
  Kit.prototype.add = function (k, g) { (this.p[k] = this.p[k] || []).push(g); return g; };
  function place(g, x, y, z, rx, ry, rz) { if (rx) g.rotateX(rx); if (ry) g.rotateY(ry); if (rz) g.rotateZ(rz); g.translate(x || 0, y || 0, z || 0); return g; }
  Kit.prototype.sph = function (k, r, x, y, z, sx, sy, sz) { var g = new T.SphereGeometry(r, 14, 10); if (sx) g.scale(sx, sy, sz); return this.add(k, place(g, x, y, z)); };
  Kit.prototype.cyl = function (k, rt, rb, h, x, y, z, rx, ry, rz) { return this.add(k, place(new T.CylinderGeometry(rt, rb, h, 12), x, y, z, rx, ry, rz)); };
  Kit.prototype.cone = function (k, r, h, x, y, z, rx, ry, rz) { return this.add(k, place(new T.ConeGeometry(r, h, 10), x, y, z, rx, ry, rz)); };
  Kit.prototype.box = function (k, w, h, d, x, y, z, rx, ry, rz) { return this.add(k, place(new T.BoxGeometry(w, h, d), x, y, z, rx, ry, rz)); };
  Kit.prototype.tor = function (k, R, r, x, y, z, rx, ry, rz, arc) { return this.add(k, place(new T.TorusGeometry(R, r, 8, 28, arc || Math.PI * 2), x, y, z, rx, ry, rz)); };
  Kit.prototype.lathe = function (k, pts, y) { var g = new T.LatheGeometry(pts.map(function (p) { return new T.Vector2(Math.max(0.0005, p[0]), p[1]); }), 28); g.translate(0, y || 0, 0); return this.add(k, g); };
  Kit.prototype.tube = function (k, pts, r) { var c = new T.CatmullRomCurve3(pts.map(function (p) { return new T.Vector3(p[0], p[1], p[2]); })); return this.add(k, new T.TubeGeometry(c, 20, r, 8, false)); };
  Kit.prototype.dodec = function (k, r, x, y, z, rx, ry) { return this.add(k, place(new T.DodecahedronGeometry(r, 0), x, y, z, rx, ry, 0)); };
  Kit.prototype.limb = function (k, a, b, r1, r2) {
    var A = new T.Vector3(a[0], a[1], a[2]), B = new T.Vector3(b[0], b[1], b[2]), d = B.clone().sub(A), L = d.length();
    var g = new T.CylinderGeometry(r2, r1, L, 10), q = new T.Quaternion().setFromUnitVectors(new T.Vector3(0, 1, 0), d.normalize());
    g.applyMatrix4(new T.Matrix4().compose(A.clone().add(B).multiplyScalar(0.5), q, new T.Vector3(1, 1, 1)));
    return this.add(k, g);
  };
  function armEnd(sh, len, pitch, roll) { return [sh[0] + Math.sin(roll) * len * Math.cos(pitch), sh[1] - Math.cos(roll) * len * Math.cos(pitch) + 0 * pitch, sh[2] + Math.sin(pitch) * len]; }

  /* ---------- faces, heads, crowns ---------- */
  function face(K, y, r, o) {
    var z = r * 0.9, ex = r * 0.36;
    [-1, 1].forEach(function (s) {
      if (o.closed) K.box('eye', r * 0.22, r * 0.05, r * 0.06, s * ex, y + r * 0.08, z, 0, 0, s * -0.15);
      else { K.sph('eye', r * 0.17, s * ex, y + r * 0.08, z, 1, 1.3, 0.5); K.sph('white', r * 0.055, s * ex + r * 0.06, y + r * 0.16, z + r * 0.08); }
      var by = y + r * 0.33, rot = o.brows === 'angry' ? s * 0.45 : o.brows === 'sad' ? -s * 0.35 : 0;
      K.box('hair', r * 0.32, r * 0.07, r * 0.07, s * ex, by - (o.brows === 'angry' ? r * 0.04 : 0), z - r * 0.04, 0, 0, -rot);
    });
    var my = y - r * 0.38;
    if (o.mouth === 'fangs') { K.box('lip', r * 0.4, r * 0.07, r * 0.07, 0, my, z); K.cone('white', r * 0.06, r * 0.16, -r * 0.13, my - r * 0.08, z + r * 0.02, Math.PI); K.cone('white', r * 0.06, r * 0.16, r * 0.13, my - r * 0.08, z + r * 0.02, Math.PI); }
    else if (o.mouth === 'grin') K.tor('lip', r * 0.22, r * 0.06, 0, my + r * 0.12, z - r * 0.02, 0, 0, Math.PI, Math.PI);
    else K.tor('lip', r * 0.17, r * 0.05, 0, my + r * 0.1, z - r * 0.02, 0, 0, Math.PI, Math.PI);
    if (o.mustache) { K.tor('hair', r * 0.2, r * 0.06, -r * 0.16, my + r * 0.16, z, 0, 0, 0.3, Math.PI * 0.7); K.tor('hair', r * 0.2, r * 0.06, r * 0.16, my + r * 0.16, z, 0, Math.PI, 0.3, Math.PI * 0.7); }
    if (o.tilak) K.box('tilak', r * 0.07, r * 0.28, r * 0.05, 0, y + r * 0.52, z + r * 0.02);
  }
  function kireedam(K, x, y, z, s) {
    K.lathe('gold', [[0.13 * s, 0], [0.14 * s, 0.03 * s], [0.12 * s, 0.05 * s], [0.13 * s, 0.09 * s], [0.1 * s, 0.12 * s], [0.105 * s, 0.16 * s], [0.07 * s, 0.19 * s], [0.07 * s, 0.23 * s], [0.04 * s, 0.26 * s], [0.012 * s, 0.33 * s], [0, 0.34 * s]].map(function (p) { return [p[0], p[1]]; }), 0);
    var g = K.p.gold[K.p.gold.length - 1]; g.translate(x, y, z);
    K.sph('gem', 0.024 * s, x, y + 0.06 * s, z + 0.13 * s);
    K.sph('gem', 0.016 * s, x, y + 0.2 * s, z + 0.075 * s);
  }
  function head(K, o) {
    var y = o.y, r = o.r;
    if (o.monkey) {
      K.sph(o.fur, r, 0, y, 0);
      K.sph(o.furL, r * 0.62, 0, y - r * 0.28, r * 0.62, 1.1, 0.8, 0.7);
      K.sph(o.furL, r * 0.52, 0, y + r * 0.12, r * 0.55, 1.35, 0.7, 0.6);
      [-1, 1].forEach(function (s) { K.sph(o.fur, r * 0.3, s * r * 1.02, y + r * 0.1, 0, 0.6, 1, 1); K.sph(o.furL, r * 0.18, s * r * 1.08, y + r * 0.1, r * 0.05, 0.5, 1, 1); });
      face(K, y + r * 0.05, r, { brows: o.brows, mouth: o.mouth || 'smile' });
    } else {
      K.sph(o.skin, r, 0, y, 0);
      if (o.hair !== false) { K.sph('hair', r * 1.03, 0, y + r * 0.04, -r * 0.12, 1, 1, 0.95); var bang = new T.SphereGeometry(r * 1.04, 20, 10, 0, Math.PI * 2, 0, 0.7); bang.translate(0, y + r * 0.02, 0); K.add('hair', bang); }
      [-1, 1].forEach(function (s) { K.sph(o.skin, r * 0.2, s * r * 0.98, y - r * 0.05, 0); if (o.earrings !== false) K.sph('gold', r * 0.11, s * r * 0.98, y - r * 0.3, r * 0.05); });
      face(K, y, r, o);
    }
    if (o.horns) [-1, 1].forEach(function (s) { K.cone('horn', r * 0.17, r * 0.6, s * r * 0.55, y + r * 0.9, 0, 0, 0, -s * 0.5); });
    if (o.crown === 'kiree') kireedam(K, 0, y + r * 0.62, -r * 0.05, r / 0.15);
    if (o.crown === 'tiara') {
      K.tor('gold', r * 0.98, r * 0.07, 0, y + r * 0.45, -r * 0.05, -Math.PI / 2 + 0.35, 0, 0, Math.PI);
      for (var i = -2; i <= 2; i++) K.cone('gold', r * 0.07, r * 0.25, Math.sin(i * 0.45) * r * 0.85, y + r * 0.75 - Math.abs(i) * r * 0.05, Math.cos(i * 0.45) * r * 0.45 - r * 0.05);
      K.sph('gem', r * 0.12, 0, y + r * 0.72, r * 0.42);
      K.sph('hair', r * 0.5, 0, y + r * 0.55, -r * 0.8);
      K.sph('gem', r * 0.08, 0, y + r * 0.58, r * 0.93);
    }
    if (o.crown === 'helm') { K.lathe('armor', [[r * 1.08, 0], [r * 1.1, r * 0.2], [r * 0.85, r * 0.6], [r * 0.4, r * 0.95], [r * 0.08, r * 1.35], [0, r * 1.4]], y + r * 0.1); K.tor('gold', r * 1.06, r * 0.07, 0, y + r * 0.12, 0, Math.PI / 2); K.sph('gem', r * 0.13, 0, y + r * 0.5, r * 0.88); }
  }

  /* ---------- bodies ---------- */
  function body(K, o) {
    var low = o.low, top = o.top || o.skin, belly = o.belly;
    K.lathe(low, [[0, 0], [0.24, 0], [0.25, 0.03], [0.21, 0.2], [0.17, 0.4], [0, 0.42]], 0);
    K.tor('gold', 0.245, 0.016, 0, 0.03, 0, Math.PI / 2);
    if (belly) { K.sph(top, 0.26, 0, 0.55, 0.02, 1, 1, 0.95); K.sph(top, 0.17, 0, 0.74, 0); }
    else K.lathe(top, [[0, 0.4], [0.165, 0.4], [0.18, 0.5], [0.17, 0.58], [0.12, 0.64], [0.06, 0.67], [0, 0.67]], 0);
    K.tor('gold', belly ? 0.25 : 0.168, 0.02, 0, 0.41, 0, Math.PI / 2);
    if (o.thread) K.tor('white', 0.17, 0.007, 0, 0.53, 0.0, 0.15, 0, 0.85);
    if (o.scarf) K.tor(o.scarf, 0.165, 0.026, 0, 0.61, 0, Math.PI / 2 - 0.25);
    if (o.pallu) K.box(o.low, 0.07, 0.36, 0.035, 0.03, 0.55, 0.15, 0, 0, -0.75);
    K.tor('gold', 0.085, 0.012, 0, 0.64, 0.035, Math.PI / 2 - 0.35); K.sph('gem', 0.018, 0, 0.6, 0.12);
    K.cyl(o.skin, 0.05, 0.055, 0.08, 0, 0.69, 0);
    var shY = belly ? 0.66 : 0.6, shX = belly ? 0.25 : 0.17;
    var ends = [];
    [-1, 1].forEach(function (s, i) {
      var a = (o.arms && o.arms[i]) || [0, s * 0.25], sh = [s * shX, shY, 0], e = armEnd(sh, 0.3, a[0], a[1]);
      K.sph(o.armTop || top, 0.055, sh[0], sh[1], sh[2]);
      K.limb(o.arm || o.skin, sh, e, 0.045, 0.04);
      K.tor('gold', 0.04, 0.01, e[0] * 0.92 + sh[0] * 0.08, e[1] * 0.92 + sh[1] * 0.08, e[2] * 0.92, Math.PI / 2 + a[0], 0, a[1]);
      K.sph(o.hand || o.skin, 0.045, e[0], e[1], e[2]);
      ends.push(e);
    });
    return ends;
  }
  function tail(K, key, side) { K.tube(key, [[0, 0.3, -0.18], [side * 0.15, 0.35, -0.3], [side * 0.25, 0.6, -0.28], [side * 0.18, 0.85, -0.2], [side * 0.05, 0.9, -0.15]], 0.028); }
  function bow(K, at, key) {
    var R = 0.3, k = key || 'wood', cx = at[0] + (at[0] < 0 ? R : -R) * 0.55, dir = at[0] < 0 ? Math.PI : 0;
    var g = new T.TorusGeometry(R, 0.016, 6, 24, 2.0); g.rotateZ(dir - 1.0); g.translate(cx, at[1], at[2] + 0.02); K.add(k, g);
    var a = dir - 1.0, b = dir + 1.0;
    K.limb('white', [cx + R * Math.cos(a), at[1] + R * Math.sin(a), at[2] + 0.02], [cx + R * Math.cos(b), at[1] + R * Math.sin(b), at[2] + 0.02], 0.004, 0.004);
  }
  function quiver(K) { K.cyl('wood', 0.05, 0.045, 0.32, 0.08, 0.6, -0.17, 0.25, 0, -0.35); [0, 1, 2].forEach(function (i) { K.cone('saffron', 0.022, 0.07, 0.14 + i * 0.02, 0.8 + i * 0.01, -0.22 + i * 0.015, 0.25, 0, -0.35); }); }
  function mace(K, at, up) { var tip = [at[0] + (up ? 0.05 : 0.0), at[1] + (up ? 0.3 : -0.25), at[2] - (up ? 0.05 : 0)]; K.limb('gold', at, tip, 0.016, 0.016); K.sph('gold', 0.085, tip[0], tip[1], tip[2]); K.tor('gem', 0.088, 0.012, tip[0], tip[1], tip[2], Math.PI / 2); K.cone('gold', 0.025, 0.06, tip[0], tip[1] + (up ? 0.1 : -0.1), tip[2], up ? 0 : Math.PI); }
  function spear(K, at) { K.limb('wood', [at[0], at[1] - 0.35, at[2]], [at[0], at[1] + 0.45, at[2]], 0.013, 0.013); K.cone('steel', 0.035, 0.13, at[0], at[1] + 0.5, at[2]); }
  function sword(K, at) { K.box('steel', 0.04, 0.42, 0.012, at[0], at[1] + 0.25, at[2], 0, 0, -0.2); K.box('gold', 0.12, 0.025, 0.03, at[0] - 0.008, at[1] + 0.04, at[2], 0, 0, -0.2); }
  function lotus(K, at) { for (var i = 0; i < 7; i++) { var a = i / 7 * Math.PI * 2; K.sph('lotus', 0.035, at[0] + Math.cos(a) * 0.035, at[1] + 0.03, at[2] + Math.sin(a) * 0.035, 0.6, 1.2, 0.6); } K.sph('gold', 0.025, at[0], at[1] + 0.05, at[2]); }

  /* ---------- characters ---------- */
  var C = {
    rama: function (K) { var e = body(K, { low: 'cloth', skin: 'skin', thread: 1, scarf: 'cloth', arms: [[0.25, -0.35], [0.9, 0.35]] }); head(K, { y: 0.86, r: 0.17, skin: 'skin', crown: 'kiree', brows: 'calm', tilak: 1 }); bow(K, e[0]); quiver(K); },
    sita: function (K) { var e = body(K, { low: 'cloth', top: 'cloth', skin: 'skin', pallu: 1, arms: [[0.95, -0.55], [0.95, 0.55]] }); head(K, { y: 0.86, r: 0.165, skin: 'skin', crown: 'tiara', brows: 'calm', tilak: 1 }); lotus(K, [(e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2, (e[0][2] + e[1][2]) / 2 + 0.02]); },
    lakshmana: function (K) { var e = body(K, { low: 'cloth', skin: 'skin', thread: 1, scarf: 'cloth2', arms: [[0.25, -0.35], [0.1, 0.3]] }); head(K, { y: 0.86, r: 0.165, skin: 'skin', crown: 'kiree', brows: 'calm', tilak: 1 }); bow(K, e[0]); quiver(K); },
    hanuman: function (K) { var e = body(K, { low: 'cloth', top: 'fur', skin: 'fur', hand: 'furL', arms: [[0.2, -0.3], [0.5, 0.9]] }); head(K, { y: 0.86, r: 0.17, monkey: 1, fur: 'fur', furL: 'furL', crown: 'kiree', brows: 'calm', mouth: 'grin' }); mace(K, e[1], true); tail(K, 'fur', 1); },
    vanara: function (K) { var e = body(K, { low: 'cloth', top: 'fur', skin: 'fur', hand: 'furL', arms: [[0, -0.3], [0.4, 1.9]] }); head(K, { y: 0.86, r: 0.17, monkey: 1, fur: 'fur', furL: 'furL', brows: 'calm', mouth: 'smile' }); K.tor('cloth', 0.165, 0.02, 0, 0.93, 0.0, Math.PI / 2 - 0.2); K.dodec('stone', 0.08, e[1][0], e[1][1] + 0.06, e[1][2], 0.4, 0.3); tail(K, 'fur', -1); },
    setu: function (K) {
      [[-0.15, 0.1, 0.02, 0.13], [0.15, 0.1, -0.02, 0.13], [0, 0.12, 0.12, 0.11], [-0.08, 0.32, 0, 0.13], [0.1, 0.33, 0.03, 0.12], [0, 0.53, 0, 0.13], [0.02, 0.72, 0.02, 0.1]].forEach(function (s, i) { K.dodec(i % 2 ? 'stone2' : 'stone', s[3], s[0], s[1], s[2], i * 0.7, i * 1.1); });
      K.cyl('wood', 0.012, 0.012, 0.4, 0, 0.98, 0); var f = new T.Shape(); f.moveTo(0, 0); f.lineTo(0.22, -0.06); f.lineTo(0, -0.13); f.lineTo(0, 0); var fg = new T.ExtrudeGeometry(f, { depth: 0.01, bevelEnabled: false }); fg.translate(0.01, 1.17, 0); K.add('saffron', fg);
      K.sph('gold', 0.02, 0, 1.19, 0);
    },
    ravana: function (K) {
      var e = body(K, { low: 'cloth', top: 'armor', skin: 'skin', arms: [[0.3, -0.45], [0.2, 0.55]] });
      head(K, { y: 0.88, r: 0.17, skin: 'skin', crown: 'kiree', brows: 'angry', mouth: 'calm', mustache: 1 });
      var spots = [[-0.25, 0.87, -0.06], [0.25, 0.87, -0.06], [-0.42, 0.83, -0.12], [0.42, 0.83, -0.12], [-0.57, 0.78, -0.18], [0.57, 0.78, -0.18], [-0.15, 1.16, -0.15], [0.15, 1.16, -0.15], [0, 1.25, -0.2]];
      spots.forEach(function (p, i) {
        var r = i > 5 ? 0.1 : 0.115, Kh = new Kit(); head(Kh, { y: 0, r: r, skin: 'skin', crown: 'kiree', brows: 'angry', mouth: 'calm', mustache: 1, earrings: false });
        Object.keys(Kh.p).forEach(function (k) { Kh.p[k].forEach(function (g) { g.rotateY(-p[0] * 0.5); g.translate(p[0], p[1], p[2]); K.add(k, g); }); });
      });
      sword(K, e[1]);
    },
    mandodari: function (K) { var e = body(K, { low: 'cloth', top: 'cloth', skin: 'skin', pallu: 1, arms: [[0.95, -0.55], [0.95, 0.55]] }); head(K, { y: 0.86, r: 0.165, skin: 'skin', crown: 'tiara', brows: 'calm' }); K.sph('gem', 0.04, (e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2 + 0.04, (e[0][2] + e[1][2]) / 2 + 0.02); },
    kumbha: function (K) { var e = body(K, { low: 'cloth', top: 'skin', skin: 'skin', belly: 1, arms: [[0.15, -0.3], [0.3, 0.9]] }); head(K, { y: 0.98, r: 0.19, skin: 'skin', brows: 'calm', mouth: 'fangs', closed: 1, horns: 1, hair: true }); var t = [e[1][0] + 0.05, e[1][1] + 0.38, e[1][2] - 0.05]; K.limb('wood', e[1], t, 0.03, 0.06); K.tor('gold', 0.06, 0.015, t[0] - 0.02, t[1] - 0.08, t[2], Math.PI / 2); for (var i = 0; i < 5; i++) K.cone('steel', 0.018, 0.06, t[0] + Math.cos(i * 1.3) * 0.06, t[1] - 0.03 + i * 0.015, t[2] + Math.sin(i * 1.3) * 0.06, Math.PI / 2, i * 1.3, 0); },
    indrajit: function (K) { var e = body(K, { low: 'cloth', top: 'armor', skin: 'skin', arms: [[0.25, -0.35], [0.4, 0.4]] }); head(K, { y: 0.86, r: 0.165, skin: 'skin', crown: 'helm', brows: 'angry', mouth: 'calm', hair: false }); bow(K, e[0], 'armor'); },
    maricha: function (K) {
      K.sph('deer', 0.2, 0, 0.5, 0, 1.45, 0.82, 0.8);
      [[-0.19, 0.08], [0.19, 0.08], [-0.17, -0.08], [0.17, -0.08]].forEach(function (l) { K.limb('deer', [l[0], 0.45, l[1]], [l[0], 0.0, l[1]], 0.03, 0.022); K.sph('hair', 0.025, l[0], 0.01, l[1]); });
      K.limb('deer', [0.2, 0.55, 0.03], [0.27, 0.85, 0.12], 0.07, 0.055);
      K.sph('deer', 0.1, 0.29, 0.92, 0.16, 1, 0.95, 1.25);
      K.sph('eye', 0.018, 0.25, 0.95, 0.27, 1, 1.2, 0.6); K.sph('eye', 0.018, 0.35, 0.95, 0.25, 1, 1.2, 0.6); K.sph('eye', 0.02, 0.3, 0.88, 0.29);
      [-1, 1].forEach(function (s) { K.cone('deer', 0.035, 0.11, 0.29 + s * 0.09, 1.0, 0.13, 0, 0, -s * 0.9);
        K.tube('gold', [[0.29 + s * 0.04, 0.99, 0.13], [0.29 + s * 0.08, 1.12, 0.1], [0.29 + s * 0.14, 1.22, 0.08]], 0.012);
        K.tube('gold', [[0.29 + s * 0.08, 1.1, 0.1], [0.29 + s * 0.04, 1.2, 0.06]], 0.01); K.tube('gold', [[0.29 + s * 0.11, 1.16, 0.09], [0.29 + s * 0.2, 1.2, 0.1]], 0.01); });
      [[-0.15, 0.6, 0.12], [-0.02, 0.62, 0.15], [0.1, 0.6, 0.14], [-0.08, 0.52, 0.16], [0.05, 0.5, 0.16], [-0.2, 0.5, 0.1], [0.0, 0.67, 0.08]].forEach(function (p) { K.sph('white', 0.022, p[0], p[1], p[2]); });
      K.cone('deer', 0.03, 0.08, -0.29, 0.58, 0, 0, 0, 0.9);
    },
    rakshasa: function (K) { var e = body(K, { low: 'cloth', top: 'armor', skin: 'skin', arms: [[0, -0.3], [0.3, 0.35]] }); head(K, { y: 0.86, r: 0.17, skin: 'skin', brows: 'angry', mouth: 'fangs', horns: 1 }); spear(K, e[1]); }
  };
  var CAST = {
    w: { k: ['rama', { skin: '#4d6fae', cloth: '#e8b623', hair: '#1f1712' }], q: ['sita', { skin: '#e3b48b', cloth: '#b3223b', hair: '#1f1712' }], b: ['lakshmana', { skin: '#d9a676', cloth: '#e27a2a', cloth2: '#f2d061', hair: '#1f1712' }],
         n: ['hanuman', { fur: '#c4772e', furL: '#f0c48a', cloth: '#c0262f' }], r: ['setu', { stone: '#b9ad99', stone2: '#a3967f', saffron: '#ff8c1a' }], p: ['vanara', { fur: '#8a5a33', furL: '#e0b48a', cloth: '#c0262f', stone: '#9a917f' }] },
    b: { k: ['ravana', { skin: '#c08a63', cloth: '#2a1a2e', armor: '#7a1630', hair: '#140c0a' }], q: ['mandodari', { skin: '#c99570', cloth: '#13704f', hair: '#140c0a' }], b: ['indrajit', { skin: '#c08a63', cloth: '#26163f', armor: '#3d1f66', hair: '#140c0a' }],
         n: ['maricha', { deer: '#d9a63a' }], r: ['kumbha', { skin: '#7d8f6a', cloth: '#5b1a1a', hair: '#1b1410', horn: '#efe6d2' }], p: ['rakshasa', { skin: '#6f8560', cloth: '#3a2433', armor: '#5a3b26', hair: '#1b1410', horn: '#efe6d2' }] }
  };
  var DEF = { gold: '#e2b54d', gem: '#d0263f', eye: '#1c1310', white: '#fbf6ec', lip: '#a3354a', wood: '#7a4a24', steel: '#c9ccd2', lotus: '#f08fb0', saffron: '#ff8c1a', tilak: '#c41e3a', horn: '#efe6d2', hair: '#1f1712' };

  /* ---------- Royal Ivory: a traditional Indian army in carved ivory style ---------- */
  function turban(K, y, r, plume) {
    K.sph('paint', r * 1.06, 0, y + r * 0.42, -r * 0.04, 1.05, 0.62, 1.05);
    K.tor('paint', r * 0.97, r * 0.17, 0, y + r * 0.32, -r * 0.03, Math.PI / 2);
    K.tor('gold', r * 0.99, r * 0.05, 0, y + r * 0.2, -r * 0.03, Math.PI / 2);
    K.sph('gold', r * 0.15, 0, y + r * 0.55, r * 0.92);
    if (plume) K.tube('white', [[0, y + r * 0.7, r * 0.75], [r * 0.08, y + r * 1.15, r * 0.6], [r * 0.3, y + r * 1.4, r * 0.35]], r * 0.07);
  }
  function rider(K, at, s, o) {
    var R = new Kit();
    var e = body(R, { low: 'paint', top: 'ivory', skin: 'ivory', arms: o.arms || [[0.6, -0.3], [0.4, 0.35]] });
    head(R, { y: 0.86, r: 0.17, skin: 'ivory', brows: 'calm', mustache: o.mustache });
    turban(R, 0.86, 0.17, o.plume);
    if (o.spear) { var h = e[1]; R.limb('steel', [h[0], h[1] - 0.3, h[2]], [h[0], h[1] + 0.5, h[2]], 0.012, 0.012); R.cone('gold', 0.03, 0.1, h[0], h[1] + 0.55, h[2]); }
    if (o.shield) { var l = e[0]; R.cyl('paint2', 0.12, 0.12, 0.025, l[0] - 0.02, l[1] + 0.02, l[2] + 0.04, Math.PI / 2); R.sph('gold', 0.03, l[0] - 0.02, l[1] + 0.02, l[2] + 0.06); R.tor('gold', 0.115, 0.01, l[0] - 0.02, l[1] + 0.02, l[2] + 0.055); }
    if (o.sword) { var w = e[1]; R.box('steel', 0.035, 0.36, 0.012, w[0], w[1] + 0.2, w[2], 0, 0, -0.15); R.box('gold', 0.1, 0.022, 0.03, w[0], w[1] + 0.03, w[2], 0, 0, -0.15); }
    Object.keys(R.p).forEach(function (k) { R.p[k].forEach(function (g) { g.scale(s, s, s); g.translate(at[0], at[1], at[2]); K.add(k, g); }); });
  }
  function legs(K, key, pts, top, r) { pts.forEach(function (p) { K.limb(key, [p[0], top, p[1]], [p[0], 0.02, p[1]], r, r * 0.8); K.tor('gold', r * 0.95, r * 0.25, p[0], 0.06, p[1], Math.PI / 2); }); }
  var R6 = {
    raja: function (K) {
      var e = body(K, { low: 'paint', top: 'ivory', skin: 'ivory', scarf: 'paint2', arms: [[0.3, -0.35], [0.45, 0.45]] });
      head(K, { y: 0.86, r: 0.17, skin: 'ivory', brows: 'calm', mustache: 1 }); turban(K, 0.86, 0.17, true);
      K.box('steel', 0.035, 0.4, 0.012, e[1][0], e[1][1] + 0.22, e[1][2], 0, 0, -0.15); K.box('gold', 0.1, 0.022, 0.03, e[1][0], e[1][1] + 0.03, e[1][2], 0, 0, -0.15);
      K.limb('gold', [0.0, 0.6, -0.24], [0.0, 1.42, -0.24], 0.014, 0.014);
      var dome = new T.SphereGeometry(0.25, 24, 10, 0, Math.PI * 2, 0, Math.PI / 2.4); dome.scale(1, 0.55, 1); dome.translate(0, 1.38, -0.2); K.add('paint', dome);
      K.tor('gold', 0.23, 0.014, 0, 1.42, -0.2, Math.PI / 2);
      for (var i = 0; i < 12; i++) { var a = i / 12 * Math.PI * 2; K.sph('gold', 0.016, Math.cos(a) * 0.23, 1.39, -0.2 + Math.sin(a) * 0.23); }
      K.sph('gold', 0.035, 0, 1.55, -0.2);
    },
    rani: function (K) {
      var e = body(K, { low: 'paint2', top: 'ivory', skin: 'ivory', pallu: 1, arms: [[0.95, -0.55], [0.95, 0.55]] });
      head(K, { y: 0.86, r: 0.165, skin: 'ivory', crown: 'tiara', brows: 'calm' });
      K.sph('paint', 0.2, 0, 0.8, -0.1, 1.05, 1.35, 0.7);
      lotus(K, [(e[0][0] + e[1][0]) / 2, (e[0][1] + e[1][1]) / 2, (e[0][2] + e[1][2]) / 2 + 0.02]);
    },
    gaja: function (K) {
      K.sph('ivory', 0.27, -0.04, 0.5, 0, 1.4, 1, 1);
      legs(K, 'ivory', [[-0.24, 0.13], [0.16, 0.13], [-0.24, -0.13], [0.16, -0.13]], 0.42, 0.075);
      K.sph('ivory', 0.19, 0.33, 0.6, 0, 1, 1.05, 1);
      [-1, 1].forEach(function (s) { K.sph('paint', 0.15, 0.27, 0.62, s * 0.17, 0.3, 1, 0.95); K.sph('eye', 0.022, 0.43, 0.66, s * 0.1); K.cone('white', 0.022, 0.17, 0.48, 0.44, s * 0.08, 0, 0, -2.2); });
      K.tube('ivory', [[0.48, 0.58, 0], [0.56, 0.42, 0.01], [0.55, 0.24, 0.02], [0.6, 0.1, 0.03], [0.66, 0.12, 0.03]], 0.04);
      K.sph('paint', 0.28, -0.04, 0.6, 0, 1.25, 0.6, 1.08);
      K.tor('gold', 0.29, 0.012, -0.04, 0.58, 0, Math.PI / 2);
      K.sph('paint2', 0.06, 0.38, 0.75, 0, 1, 0.5, 1.5);
      K.box('ivory', 0.3, 0.12, 0.28, -0.06, 0.86, 0); K.box('gold', 0.32, 0.02, 0.3, -0.06, 0.93, 0);
      [[-0.18, -0.12], [0.06, -0.12], [-0.18, 0.12], [0.06, 0.12]].forEach(function (p) { K.cyl('gold', 0.008, 0.008, 0.2, p[0], 1.03, p[1]); });
      var dm = new T.SphereGeometry(0.19, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2); dm.scale(1, 0.6, 1); dm.translate(-0.06, 1.12, 0); K.add('paint', dm); K.sph('gold', 0.03, -0.06, 1.25, 0);
      K.tube('ivory', [[-0.42, 0.55, 0], [-0.47, 0.42, 0.02], [-0.46, 0.3, 0.03]], 0.015);
      rider(K, [0.28, 0.62, 0], 0.32, { arms: [[0.5, -0.4], [0.6, 0.4]] });
    },
    ashva: function (K) {
      K.sph('ivory', 0.2, 0, 0.55, 0, 1.5, 0.9, 0.75);
      legs(K, 'ivory', [[-0.2, 0.07], [0.19, 0.07], [-0.2, -0.07], [0.19, -0.07]], 0.5, 0.035);
      K.limb('ivory', [0.2, 0.6, 0], [0.33, 0.84, 0], 0.085, 0.06);
      var hd = new T.SphereGeometry(0.09, 14, 10); hd.scale(1.7, 0.85, 0.8); hd.rotateZ(-0.6); hd.translate(0.41, 0.84, 0); K.add('ivory', hd);
      [-1, 1].forEach(function (s) { K.cone('ivory', 0.022, 0.07, 0.33, 0.95, s * 0.035, 0, 0, -0.3); K.sph('eye', 0.016, 0.39, 0.89, s * 0.06); });
      K.tube('paint', [[0.17, 0.66, 0], [0.24, 0.8, 0], [0.3, 0.92, 0]], 0.03);
      K.tube('paint', [[-0.28, 0.58, 0], [-0.36, 0.45, 0.01], [-0.37, 0.3, 0.02]], 0.03);
      K.box('paint2', 0.3, 0.05, 0.32, -0.02, 0.71, 0); K.tor('gold', 0.06, 0.008, 0.27, 0.66, 0.0, 0, Math.PI / 2, 0);
      K.box('gold', 0.32, 0.015, 0.34, -0.02, 0.69, 0);
      rider(K, [-0.02, 0.62, 0], 0.5, { spear: 1, arms: [[0.5, -0.4], [0.45, 0.45]] });
    },
    ushtra: function (K) {
      K.sph('ivory', 0.19, 0, 0.66, 0, 1.45, 0.85, 0.72);
      K.sph('ivory', 0.13, -0.03, 0.82, 0, 1.1, 0.9, 0.9);
      legs(K, 'ivory', [[-0.18, 0.07], [0.17, 0.07], [-0.18, -0.07], [0.17, -0.07]], 0.6, 0.03);
      K.tube('ivory', [[0.2, 0.66, 0], [0.33, 0.66, 0], [0.4, 0.78, 0], [0.42, 0.93, 0]], 0.045);
      var hd = new T.SphereGeometry(0.07, 14, 10); hd.scale(1.7, 0.9, 0.8); hd.translate(0.47, 0.96, 0); K.add('ivory', hd);
      [-1, 1].forEach(function (s) { K.sph('eye', 0.013, 0.47, 0.99, s * 0.05); });
      K.box('paint', 0.26, 0.04, 0.3, -0.04, 0.88, 0); K.box('gold', 0.27, 0.012, 0.31, -0.04, 0.86, 0);
      K.tor('paint2', 0.05, 0.012, 0.38, 0.75, 0, Math.PI / 2 - 0.4);
      rider(K, [-0.05, 0.8, 0], 0.46, { sword: 1, arms: [[0.5, -0.4], [0.5, 0.5]] });
    },
    sipahi: function (K) {
      var e = body(K, { low: 'paint', top: 'ivory', skin: 'ivory', arms: [[0.6, -0.4], [0.2, 0.3]] });
      head(K, { y: 0.86, r: 0.17, skin: 'ivory', brows: 'calm', mustache: 1 }); turban(K, 0.86, 0.17, false);
      var l = e[0]; K.cyl('paint2', 0.15, 0.15, 0.03, l[0] - 0.02, l[1] + 0.03, l[2] + 0.05, Math.PI / 2); K.sph('gold', 0.04, l[0] - 0.02, l[1] + 0.03, l[2] + 0.07); K.tor('gold', 0.145, 0.012, l[0] - 0.02, l[1] + 0.03, l[2] + 0.065);
      var h = e[1]; K.limb('steel', [h[0], h[1] - 0.35, h[2]], [h[0], h[1] + 0.45, h[2]], 0.013, 0.013); K.cone('gold', 0.035, 0.12, h[0], h[1] + 0.5, h[2]);
    }
  };
  var ROYAL_PAL = {
    w: { ivory: '#e6d5ad', paint: '#b5302c', paint2: '#2f6b4a', gold: '#cf9f3c', hair: '#2a1d14', steel: '#e6dcc5', eye: '#1c1310', white: '#fbf6ec', lip: '#a3354a', lotus: '#d9566f', gem: '#2f6b4a' },
    b: { ivory: '#a8352a', paint: '#efe0c0', paint2: '#1f4d39', gold: '#dcae4c', hair: '#1e1310', steel: '#f0e4c9', eye: '#1c1310', white: '#fbf6ec', lip: '#5a1410', lotus: '#f3d9a8', gem: '#1f4d39' }
  };
  var ROYAL = { k: 'raja', q: 'rani', r: 'gaja', b: 'ushtra', n: 'ashva', p: 'sipahi' };
  MAT.ivory = [0.38, 0.02]; MAT.paint = [0.5, 0.02]; MAT.paint2 = [0.5, 0.02];
  function merge(list) {
    var pos = [], nor = [];
    list.forEach(function (g) { var n = g.index ? g.toNonIndexed() : g; if (!n.attributes.normal) n.computeVertexNormals(); var p = n.attributes.position.array, q = n.attributes.normal.array; for (var i = 0; i < p.length; i++) { pos.push(p[i]); nor.push(q[i]); } if (n !== g) n.dispose(); g.dispose(); });
    var o = new T.BufferGeometry(); o.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); o.setAttribute('normal', new T.Float32BufferAttribute(nor, 3)); o.computeBoundingBox(); return o;
  }
  /* returns [{ geo, color, rough, metal }] for a figure standing at y = 0, about 1 unit tall, facing +z */
  function build(THREE, color, type, set) {
    T = THREE;
    var c = set === 'royal' ? (ROYAL[type] ? [ROYAL[type], ROYAL_PAL[color]] : null) : CAST[color] && CAST[color][type]; if (!c) return null;
    if (set === 'royal') { var K0 = new Kit(); R6[c[0]](K0); return Object.keys(K0.p).map(function (k) { var m = MAT[k] || [0.6, 0], hex = c[1][k] || DEF[k] || '#888888'; return { geo: merge(K0.p[k]), color: hex, rough: m[0], metal: m[1], key: k }; }); }
    var K = new Kit(); C[c[0]](K);
    return Object.keys(K.p).map(function (k) {
      var m = MAT[k] || [0.6, 0], hex = c[1][k] || DEF[k] || '#888888';
      return { geo: merge(K.p[k]), color: hex, rough: m[0], metal: m[1], key: k };
    });
  }
  return { build: build, has: function (set) { return set === 'ramayana' || set === 'royal'; } };
})();
