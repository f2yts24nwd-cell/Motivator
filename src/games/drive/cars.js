import * as THREE from 'three';
import { mergeGeometries, mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, roundRect } from '../../core/gfx.js';
import { COLORS, RIM_COLORS, CALIPERS } from './content.js';

// Procedural cars for "Ludlein Drive". Each car is built from its side silhouette (extruded with
// rounded edges, then bent into shape: rounded nose in plan view, tumblehome, tucked sills),
// a tinted glass greenhouse with a painted roof, and style-specific lights, grilles and details.
// No manufacturer logos: the cars are recognisable by proportions and light signatures only.
//
// Local frame: car faces +z, x is the width, y is up, origin on the ground between the axles.

const BEVEL = 0.05;
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const colorHex = (list, id, fb) => (list.find((c) => c.id === id) || list.find((c) => c.id === fb) || list[0]);

// ------------------------------------------------------------------ shape parameters per style
const STYLE = {
  fuenfer: { hoodLen: 1.56, ws: 0.86, trunk: 0.98, rw: 0.8, roofEnd: 0.36, roofDrop: 0.07, cl: 0.14, rise: 0.04 },
  sklasse: { hoodLen: 1.62, ws: 0.88, trunk: 1.02, rw: 0.84, cl: 0.15, rise: 0.03 },
  skoda: { hoodLen: 1.2, ws: 0.82, roofEnd: 0.34, cl: 0.19, rise: 0.05, roofDrop: 0.07 },
  volvo: { hoodLen: 1.44, ws: 0.92, roofEnd: 0.4, cl: 0.13, rise: 0.05, roofDrop: 0.08 },
  passat: { hoodLen: 1.32, ws: 0.8, roofEnd: 0.27, cl: 0.15, rise: 0.03, roofDrop: 0.02 },
  // simple shapes for traffic
  kompakt: { hoodLen: 1.0, ws: 0.8, roofEnd: 0.2, cl: 0.14, rise: 0.05, roofDrop: 0.05 },
  limo: { hoodLen: 1.3, ws: 0.82, trunk: 0.9, rw: 0.8, cl: 0.14, rise: 0.04 },
  suvT: { hoodLen: 1.15, ws: 0.75, roofEnd: 0.28, cl: 0.2, rise: 0.04, roofDrop: 0.03 }
};

/** Computes the silhouette of a car (body + greenhouse) as 2D point lists (u = z, v = y). */
export function silhouette(dims, styleId, type) {
  const S = STYLE[styleId];
  const { L, H, wb, wr } = dims;
  const belt = dims.belt, hood = dims.hood;
  const zf = L / 2, zr = -L / 2;
  const ovF = (L - wb) * 0.44;
  const fa = zf - ovF, ra = fa - wb;
  const cl = S.cl;
  const ar = wr + 0.1;
  const zA = zf - S.hoodLen;
  const wagon = type !== 'sedan';
  const zC = wagon ? zr + 0.16 : zr + S.trunk;
  const roofY = H - 0.06;
  const zW = zA - S.ws;
  const zRB = wagon ? zr + S.roofEnd : zC + S.rw;
  const P = [];
  // front, from the bottom up
  P.push([zf - 0.24, cl + 0.02], [zf - 0.06, 0.28], [zf - 0.005, 0.44], [zf, 0.56], [zf - 0.03, hood - 0.12], [zf - 0.1, hood - 0.055], [zf - 0.3, hood - 0.012]);
  P.push([zf - S.hoodLen * 0.62, hood + (belt - hood) * 0.3], [zA + 0.08, belt - 0.01], [zA, belt]);
  // belt line to the back
  P.push([zC, belt + S.rise]);
  if (wagon) {
    P.push([zr + 0.06, belt + S.rise - 0.02], [zr, belt - 0.08], [zr + 0.005, 0.52], [zr + 0.04, 0.34], [zr + 0.2, cl + 0.03]);
  } else {
    P.push([zr + 0.4, belt + S.rise + 0.03], [zr + 0.1, belt + S.rise + 0.035], [zr + 0.01, belt - 0.06], [zr, 0.6], [zr + 0.02, 0.4], [zr + 0.06, 0.3], [zr + 0.22, cl + 0.03]);
  }
  // bottom with wheel arches (rear to front)
  const arch = (c) => {
    const th0 = Math.asin(Math.max(-0.95, (cl - wr) / ar));
    const n = 14;
    for (let i = 0; i <= n; i++) {
      const th = Math.PI - th0 - (Math.PI - 2 * th0) * (i / n);
      P.push([c + ar * Math.cos(th), wr + ar * Math.sin(th)]);
    }
  };
  arch(ra);
  arch(fa);
  // greenhouse
  const G = [];
  const mid = (a, b, t) => a + (b - a) * t;
  G.push([zA + 0.02, belt - 0.06], [zA, belt], [mid(zA, zW, 0.55), mid(belt, roofY, 0.7)], [zW, roofY - 0.01], [zW - 0.18, roofY]);
  const roofBack = roofY - (S.roofDrop || 0);
  if (wagon) {
    G.push([zRB + 0.3, roofBack + 0.004], [zRB + 0.05, roofBack - 0.01], [zRB, roofBack - 0.04], [zr + 0.16 + 0.03, belt + S.rise + 0.06], [zr + 0.16, belt + S.rise - 0.02], [zr + 0.2, belt - 0.06]);
  } else {
    G.push([zRB + 0.22, roofY - 0.012], [zRB + 0.02, roofY - 0.05], [mid(zRB, zC, 0.5), mid(roofY, belt, 0.62)], [zC, belt + S.rise + 0.02], [zC - 0.02, belt - 0.04]);
  }
  return { body: P, green: G, fa, ra, ar, cl, zA, zW, zC, zRB, roofY, roofBack, zf, zr, belt, hood, wagon };
}

// cross-section width factor of the body at height y
function widthFactor(y, belt) {
  const tuck = Math.pow(Math.min(1, Math.max(0, (0.38 - y) / 0.26)), 1.5) * 0.05;
  const tumble = smooth(belt - 0.34, belt + 0.03, y) * 0.075;
  const shoulder = Math.exp(-Math.pow((y - (belt - 0.28)) / 0.06, 2)) * 0.012;
  return 1 - tuck - tumble + shoulder;
}
const NOSE = 0.22; // plan-view rounding at the ends (m)
function planOffset(nx, z, L) {
  const t = smooth(L / 2 - 1.0, L / 2 - 0.05, Math.abs(z));
  return Math.sign(z) * NOSE * Math.pow(Math.abs(nx), 4) * (0.35 + 0.65 * t);
}

function extrudeProfile(pts, width, { bevel = BEVEL, steps = 12, segs = 3 } = {}) {
  const shape = new THREE.Shape(pts.map(([u, v]) => new THREE.Vector2(u, v)));
  const g = new THREE.ExtrudeGeometry(shape, { depth: width - 2 * bevel, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelSegments: segs, curveSegments: 6, steps });
  // shape (u, v) extruded along z  ->  car (x = across, y, z = u)
  g.rotateY(-Math.PI / 2);
  g.translate((width - 2 * bevel) / 2, 0, 0);
  return g;
}

// smooth shading: weld the extrusion's vertices before computing normals
function smoothed(g) {
  g.deleteAttribute('uv');
  g.deleteAttribute('normal');
  const m = mergeVertices(g, 1e-4);
  g.dispose();
  m.computeVertexNormals();
  return m;
}

function buildBodyGeometry(sil, dims, opts = {}) {
  const g = extrudeProfile(sil.body, dims.W, opts);
  const p = g.attributes.position;
  const hw = dims.W / 2;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = Math.max(-1, Math.min(1, x / hw));
    z -= planOffset(nx, z, dims.L);
    x *= widthFactor(y, sil.belt);
    p.setXYZ(i, x, y, z);
  }
  return smoothed(g);
}

function buildGreenGeometry(sil, dims, opts = {}) {
  const wBelt = dims.W * widthFactor(sil.belt, sil.belt) * 0.955;
  const g = extrudeProfile(sil.green, wBelt, { bevel: 0.035, ...opts });
  const p = g.attributes.position;
  const hw = wBelt / 2;
  const span = sil.roofY - sil.belt;
  const zMid = (sil.zW + sil.zRB) / 2;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const nx = Math.max(-1, Math.min(1, x / hw));
    const t = Math.max(0, Math.min(1, (y - sil.belt) / span));
    x *= 1 - 0.19 * Math.pow(t, 1.2);
    const endT = smooth(0, 1, Math.abs(z - zMid) / (dims.L * 0.35));
    z -= Math.sign(z - zMid) * 0.12 * Math.pow(Math.abs(nx), 3) * endT;
    p.setXYZ(i, x, y, z);
  }
  return { geo: smoothed(g), wBelt };
}

// ------------------------------------------------------------------ materials
function paintMaterial(colorId, finish) {
  const c = colorHex(COLORS, colorId, 'silber');
  const m = new THREE.MeshPhysicalMaterial({ color: c.hex, clearcoat: 1, clearcoatRoughness: 0.08 });
  setFinish(m, finish);
  return m;
}
function setFinish(m, finish) {
  m.iridescence = 0;
  if (finish === 'metallic') { m.metalness = 0.62; m.roughness = 0.34; m.clearcoat = 1; m.clearcoatRoughness = 0.08; }
  else if (finish === 'matt') { m.metalness = 0.15; m.roughness = 0.72; m.clearcoat = 0; }
  else if (finish === 'chamaeleon') { m.metalness = 0.75; m.roughness = 0.28; m.clearcoat = 1; m.clearcoatRoughness = 0.03; m.iridescence = 1; m.iridescenceIOR = 1.9; m.iridescenceThicknessRange = [250, 900]; }
  else { m.metalness = 0.05; m.roughness = 0.3; m.clearcoat = 1; m.clearcoatRoughness = 0.04; }
  m.needsUpdate = true;
}

let SHARED = null;
function shared() {
  if (SHARED) return SHARED;
  SHARED = {
    glass: new THREE.MeshPhysicalMaterial({ color: 0x06090d, metalness: 0.3, roughness: 0.06, clearcoat: 1, clearcoatRoughness: 0.03, envMapIntensity: 0.9 }),
    chrome: new THREE.MeshStandardMaterial({ color: 0xf4f6f8, metalness: 1, roughness: 0.07 }),
    black: new THREE.MeshStandardMaterial({ color: 0x0c0c0d, roughness: 0.5, metalness: 0.2 }),
    gloss: new THREE.MeshStandardMaterial({ color: 0x050607, roughness: 0.12, metalness: 0.4 }),
    carbon: new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.28, metalness: 0.5 }),
    rubber: new THREE.MeshStandardMaterial({ color: 0x151516, roughness: 0.9, metalness: 0 }),
    disc: new THREE.MeshStandardMaterial({ color: 0x8d9097, roughness: 0.38, metalness: 0.9 }),
    head: new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xf4f8ff, emissiveIntensity: 1.6, roughness: 0.2 }),
    lens: new THREE.MeshStandardMaterial({ color: 0x1a1d22, roughness: 0.08, metalness: 0.6 }),
    amber: new THREE.MeshStandardMaterial({ color: 0xffa21f, emissive: 0xff8a00, emissiveIntensity: 0.4 }),
    tailHouse: new THREE.MeshStandardMaterial({ color: 0x3a0306, roughness: 0.12, metalness: 0.3 }),
    liner: new THREE.MeshStandardMaterial({ color: 0x0a0a0b, roughness: 0.95, side: THREE.DoubleSide }),
    shadow: null
  };
  SHARED.shadow = new THREE.MeshBasicMaterial({
    map: canvasTexture(128, 128, (g, w, h) => {
      const gr = g.createRadialGradient(w / 2, h / 2, 4, w / 2, h / 2, w / 2);
      gr.addColorStop(0, 'rgba(0,0,0,0.75)'); gr.addColorStop(0.55, 'rgba(0,0,0,0.42)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, w, h);
    }), transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2
  });
  return SHARED;
}

const plateTex = new Map();
function plateMaterial(text) {
  if (plateTex.has(text)) return plateTex.get(text);
  const t = canvasTexture(512, 112, (g, w, h) => {
    g.fillStyle = '#111'; roundRect(g, 0, 0, w, h, 14); g.fill();
    g.fillStyle = '#f7f7f2'; roundRect(g, 4, 4, w - 8, h - 8, 11); g.fill();
    g.fillStyle = '#1b3fa6'; roundRect(g, 4, 4, 58, h - 8, 11); g.fill(); g.fillRect(40, 4, 22, h - 8);
    g.strokeStyle = '#ffcc00'; g.lineWidth = 3;
    for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; g.beginPath(); g.arc(33 + Math.cos(a) * 15, 38 + Math.sin(a) * 15, 2, 0, Math.PI * 2); g.stroke(); }
    g.fillStyle = '#fff'; g.font = 'bold 26px Arial'; g.textAlign = 'center'; g.fillText('D', 33, 92);
    g.fillStyle = '#111'; g.font = 'bold 74px "DIN Alternate", "Arial Narrow", Arial, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 290, 60);
  });
  const m = new THREE.MeshStandardMaterial({ map: t, roughness: 0.4, metalness: 0.2 });
  plateTex.set(text, m);
  return m;
}

let flameTex = null;
function flameTexture() {
  if (flameTex) return flameTex;
  flameTex = canvasTexture(128, 128, (g, w, h) => {
    const gr = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    gr.addColorStop(0, 'rgba(220,235,255,1)'); gr.addColorStop(0.18, 'rgba(120,170,255,0.95)');
    gr.addColorStop(0.35, 'rgba(255,200,90,0.9)'); gr.addColorStop(0.65, 'rgba(255,90,20,0.55)'); gr.addColorStop(1, 'rgba(255,40,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, w, h);
  });
  return flameTex;
}

let hiltiMat = null;
function hiltiMaterial() {
  if (hiltiMat) return hiltiMat;
  const t = canvasTexture(1024, 256, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#ffffff';
    g.font = '900 210px "Arial Black", "Helvetica Neue", Arial, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.save(); g.translate(w / 2, h / 2 + 8); g.transform(1, 0, -0.12, 1, 0, 0); g.fillText('HILTI', 0, 0); g.restore();
  });
  hiltiMat = new THREE.MeshStandardMaterial({ map: t, transparent: true, roughness: 0.3, metalness: 0.1, polygonOffset: true, polygonOffsetFactor: -2, depthWrite: false });
  return hiltiMat;
}
let stripeMat = null;
function stripeMaterial() {
  if (stripeMat) return stripeMat;
  const t = canvasTexture(64, 64, (g, w, h) => {
    g.clearRect(0, 0, w, h);
    g.fillStyle = '#50af30'; g.fillRect(4, 0, 22, h); g.fillRect(w - 26, 0, 22, h);
    g.fillStyle = '#ffffff'; g.fillRect(26, 0, 2, h); g.fillRect(w - 28, 0, 2, h);
  });
  stripeMat = new THREE.MeshPhysicalMaterial({ map: t, transparent: true, roughness: 0.25, clearcoat: 1, polygonOffset: true, polygonOffsetFactor: -3, depthWrite: false });
  return stripeMat;
}

// ------------------------------------------------------------------ geometry helpers
function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function rbox(w, h, d, r, mat) {
  // rounded box via extrusion of a rounded rectangle (w x h), depth d along z
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  r = Math.min(r, w / 2, h / 2);
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r); s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h); s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -d / 2);
  return new THREE.Mesh(g, mat);
}
function polyMesh(pts, depth, mat) {
  const s = new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y)));
  const g = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -depth / 2);
  return new THREE.Mesh(g, mat);
}
function rod(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, d.length(), 8), mat);
  m.position.copy(a).addScaledVector(d, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  return m;
}

/** Bakes all meshes below `group` into one mesh per material (fewer draw calls). */
export function mergeByMaterial(group, { keep = () => false } = {}) {
  group.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(group.matrixWorld).invert();
  const buckets = new Map();
  const remove = [];
  group.traverse((o) => {
    if (!o.isMesh || o === group || keep(o)) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    const key = o.material;
    if (!buckets.has(key)) buckets.set(key, { geos: [], cast: false });
    const b = buckets.get(key);
    b.geos.push(g);
    b.cast = b.cast || o.castShadow;
    remove.push(o);
  });
  for (const o of remove) { o.parent.remove(o); }
  const out = [];
  for (const [mat, b] of buckets) {
    const merged = mergeGeometries(b.geos, false);
    for (const g of b.geos) g.dispose();
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = b.cast;
    group.add(m);
    out.push(m);
  }
  return out;
}

// ------------------------------------------------------------------ wheels
function rimGeometry(design, R, depth) {
  const parts = [];
  const add = (g, rx = 0, rz = 0, ry = 0, x = 0, y = 0, z = 0) => {
    g.rotateZ(rz); g.rotateX(rx); g.rotateY(ry); g.translate(x, y, z);
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  // the rim face lies in the y/z plane and looks along +x
  const spoke = (len, w0, w1, thick, ang, tilt = 0, twist = 0) => {
    const s = new THREE.Shape();
    s.moveTo(-w0 / 2, 0); s.lineTo(w0 / 2, 0); s.lineTo(w1 / 2, len); s.lineTo(-w1 / 2, len); s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: thick, bevelEnabled: false });
    g.translate(0, 0.035, -thick / 2);
    g.rotateY(twist);
    g.rotateY(Math.PI / 2); // face along +x
    g.rotateZ(tilt);
    g.rotateX(ang);
    parts.push(g.index ? g.toNonIndexed() : g);
  };
  const L = R - 0.04;
  if (design === 'fuenf') for (let i = 0; i < 5; i++) spoke(L, 0.085, 0.06, 0.035, (i / 5) * Math.PI * 2, 0.05);
  if (design === 'doppel') for (let i = 0; i < 5; i++) for (const o of [-0.13, 0.13]) spoke(L, 0.04, 0.03, 0.03, (i / 5) * Math.PI * 2 + o * 0.6, 0.04, 0);
  if (design === 'viel') for (let i = 0; i < 10; i++) spoke(L, 0.03, 0.022, 0.03, (i / 10) * Math.PI * 2, 0.03);
  if (design === 'turbine') for (let i = 0; i < 14; i++) spoke(L, 0.05, 0.04, 0.012, (i / 14) * Math.PI * 2, 0.02, 0.9);
  if (design === 'mesh') {
    for (let i = 0; i < 10; i++) { spoke(L, 0.022, 0.02, 0.025, (i / 10) * Math.PI * 2 + 0.16, 0.03); spoke(L, 0.022, 0.02, 0.025, (i / 10) * Math.PI * 2 - 0.16, 0.03); }
    add(new THREE.TorusGeometry(R * 0.55, 0.012, 6, 30), 0, 0, Math.PI / 2, 0.01);
  }
  if (design === 'aero') {
    const disc = new THREE.CylinderGeometry(R - 0.01, R - 0.01, 0.02, 40);
    add(disc, 0, Math.PI / 2, 0, 0.005);
  }
  // hub + lip
  add(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 20), 0, Math.PI / 2, 0, 0.0);
  add(new THREE.TorusGeometry(R - 0.008, 0.011, 6, 40), 0, 0, Math.PI / 2, 0.006);
  return mergeGeometries(parts.map((g) => { for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k); return g; }), false);
}

function tireGeometry(R, Ri, w) {
  const h = w / 2;
  // sidewall -> shoulder -> tread -> shoulder -> sidewall
  const prof = [new THREE.Vector2(Ri, -h * 0.92), new THREE.Vector2(Ri + 0.015, -h), new THREE.Vector2(R - 0.035, -h), new THREE.Vector2(R - 0.008, -h * 0.82), new THREE.Vector2(R, -h * 0.5), new THREE.Vector2(R, h * 0.5), new THREE.Vector2(R - 0.008, h * 0.82), new THREE.Vector2(R - 0.035, h), new THREE.Vector2(Ri + 0.015, h), new THREE.Vector2(Ri, h * 0.92)];
  const g = new THREE.LatheGeometry(prof, 36);
  g.rotateZ(Math.PI / 2); // axis along x
  return g;
}

function buildWheel(cfg, dims, rimMat, caliperMat, left) {
  const S = shared();
  const R = dims.wr, w = 0.245;
  const Ri = R * 0.75;
  const pivot = new THREE.Group();
  const spin = new THREE.Group();
  pivot.add(spin);
  const tire = new THREE.Mesh(tireGeometry(R, Ri, w), S.rubber);
  tire.castShadow = true;
  spin.add(tire);
  const face = new THREE.Group();
  const rim = new THREE.Mesh(rimGeometry(cfg.rim, Ri, w), rimMat);
  rim.position.x = w * 0.3;
  rim.castShadow = true;
  face.add(rim);
  // barrel (inner rim) and dark back so the gaps between the spokes look deep
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(Ri, Ri, w * 0.85, 30, 1, true), rimMat);
  barrel.rotation.z = Math.PI / 2;
  face.add(barrel);
  const back = new THREE.Mesh(new THREE.CircleGeometry(Ri, 30), S.black);
  back.rotation.y = Math.PI / 2;
  back.position.x = -w * 0.3;
  face.add(back);
  if (cfg.rim === 'aero') {
    // dark aero slots
    for (let i = 0; i < 5; i++) {
      const slot = box(0.005, 0.1, 0.035, S.gloss);
      const a = (i / 5) * Math.PI * 2 + 0.3;
      slot.position.set(w * 0.3 + 0.017, Math.cos(a) * Ri * 0.62, Math.sin(a) * Ri * 0.62);
      slot.rotation.x = a;
      face.add(slot);
    }
  }
  spin.add(face);
  // brake disc + caliper (do not spin)
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(Ri * 0.82, Ri * 0.82, 0.03, 28), S.disc);
  disc.rotation.z = Math.PI / 2;
  disc.position.x = w * 0.05;
  spin.add(disc);
  const cal = rbox(0.05, Ri * 0.55, 0.12, 0.02, caliperMat);
  cal.rotation.y = Math.PI / 2;
  cal.position.set(w * 0.12, Ri * 0.5, -Ri * 0.38);
  cal.rotation.x = -0.6;
  pivot.add(cal);
  if (left) pivot.rotation.y = 0; // faces are mirrored with the scale below
  const holder = new THREE.Group();
  holder.add(pivot);
  if (left) holder.scale.x = -1;
  return { holder, pivot, spin };
}

// ------------------------------------------------------------------ the car model
export class CarModel {
  /**
   * car: entry from CARS (or a traffic/rival spec), cfg: tuning config.
   */
  constructor(car, cfg = {}) {
    this.car = car;
    this.cfg = { ...car.def, ...cfg, parts: [...(cfg.parts || car.def?.parts || [])] };
    this.root = new THREE.Group();
    this.body = new THREE.Group();
    this.root.add(this.body);
    this.paint = paintMaterial(this.cfg.color, this.cfg.finish);
    this.tail = new THREE.MeshStandardMaterial({ color: 0xff1a22, emissive: 0xff0712, emissiveIntensity: 1.3, roughness: 0.25 });
    this.reverse = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0, roughness: 0.2 });
    const rc = colorHex(RIM_COLORS, this.cfg.rimColor, 'silber');
    this.rimMat = new THREE.MeshStandardMaterial({ color: rc.hex, metalness: rc.metal, roughness: rc.rough });
    this.caliperMat = new THREE.MeshStandardMaterial({ color: colorHex(CALIPERS, this.cfg.caliper, 'grau').hex, roughness: 0.35, metalness: 0.3 });
    // cars with selectable bodies (Fünfer: Touring / Limousine)
    this.type = car.bodies ? (car.bodies.find((b) => b.id === this.cfg.body) || car.bodies[0]).type : car.type;
    this.sil = silhouette(car.dims, car.style, this.type);
    this.wheels = [];
    this.buildBody();
    this.buildWheels();
    this.buildExtras();
    this.applyDrop();
    // soft contact shadow
    const sh = new THREE.Mesh(new THREE.PlaneGeometry(car.dims.W * 1.35, car.dims.L * 1.18), shared().shadow);
    sh.rotation.x = -Math.PI / 2;
    sh.position.y = 0.012;
    sh.renderOrder = -1;
    this.root.add(sh);
    this.contactShadow = sh;
    this.susp = { pitch: 0, roll: 0, vp: 0, vr: 0, h: 0, vh: 0 };
  }

  // ---------------------------------------------------------------- body + greenhouse
  buildBody() {
    const S = shared(), car = this.car, d = car.dims, sil = this.sil;
    const g = this.staticGroup = new THREE.Group();
    this.body.add(g);
    const body = new THREE.Mesh(buildBodyGeometry(sil, d), this.paint);
    body.castShadow = true;
    g.add(body);
    const { geo, wBelt } = buildGreenGeometry(sil, d);
    const green = new THREE.Mesh(geo, S.glass);
    green.castShadow = true;
    g.add(green);
    geo.computeBoundingBox();
    const top = geo.boundingBox.max.y;
    this.roofTop = top;
    const hwTop = (wBelt / 2) * 0.81;
    // painted roof panel
    const zf = sil.zW - 0.16, zb = sil.wagon ? sil.zRB + 0.12 : sil.zRB + 0.16;
    const roofBackY = sil.wagon ? top - (STYLE[car.style].roofDrop || 0) : top;
    const roof = polyMesh([[zb, roofBackY - 0.055], [zb - 0.05, roofBackY + 0.004], [zf + 0.06, top + 0.006], [zf, top - 0.05]], hwTop * 2 - 0.02, this.paint);
    roof.rotation.y = -Math.PI / 2;
    roof.castShadow = true;
    g.add(roof);
    // A-pillars
    const hwBelt = wBelt / 2;
    for (const s of [-1, 1]) {
      g.add(rod(new THREE.Vector3(s * hwBelt * 0.985, sil.belt + 0.01, sil.zA + 0.02), new THREE.Vector3(s * hwTop * 1.0, top - 0.02, sil.zW - 0.1), 0.03, this.paint));
      if (sil.wagon) g.add(rod(new THREE.Vector3(s * hwBelt * 0.985, sil.belt + 0.04, sil.zr + 0.2), new THREE.Vector3(s * hwTop, roofBackY - 0.03, sil.zRB + 0.02), 0.045, this.paint));
      // window trim along the belt
      const trimMat = ['volvo', 'sklasse', 'passat'].includes(car.style) ? S.chrome : S.gloss;
      const tl = (sil.zA - 0.05) - (sil.zC + (sil.wagon ? 0.12 : 0.02));
      const trim = box(0.02, 0.018, tl, trimMat, s * hwBelt * 0.99, sil.belt + 0.012, sil.zC + (sil.wagon ? 0.12 : 0.02) + tl / 2);
      g.add(trim);
      // B-pillar
      const bz = (sil.zA + (sil.wagon ? sil.zRB : sil.zC)) / 2 - 0.05;
      const bp = box(0.02, top - sil.belt - 0.04, 0.09, S.gloss, s * (hwBelt * 0.92), (top + sil.belt) / 2 - 0.01, bz);
      bp.rotation.z = s * 0.1;
      g.add(bp);
      this.bz = bz;
    }
    // wheel arch liners
    for (const c of [sil.fa, sil.ra]) {
      const l = new THREE.Mesh(new THREE.CylinderGeometry(sil.ar - 0.06, sil.ar - 0.06, d.W - 0.16, 20, 1, true, -Math.PI / 2 - 1.1, 2.2 + Math.PI * 0.0), S.liner);
      l.rotation.z = Math.PI / 2;
      l.position.set(0, d.wr, c);
      g.add(l);
    }
    // SUV: black plastic cladding around the wheel arches
    if (this.type === 'suv') {
      for (const s of [-1, 1]) for (const c of [sil.fa, sil.ra]) {
        const cl = new THREE.Mesh(new THREE.TorusGeometry(sil.ar - 0.03, 0.045, 6, 24, Math.PI * 1.15), S.black);
        cl.rotation.y = Math.PI / 2;
        cl.rotation.x = 0;
        cl.rotation.order = 'YXZ';
        cl.rotation.z = -Math.PI * 0.075;
        cl.position.set(s * ((d.W / 2) * widthFactor(0.5, sil.belt) - 0.01), d.wr, c);
        g.add(cl);
      }
    }
    // door lines + handles + sills
    const xs = (y) => (d.W / 2) * widthFactor(y, sil.belt) + 0.004;
    const doorZ = [sil.fa - sil.ar - 0.04, this.bz - 0.02, sil.ra + sil.ar + 0.02];
    for (const s of [-1, 1]) {
      for (const z of doorZ) {
        const ln = box(0.006, sil.belt - 0.42, 0.008, S.black, s * xs(0.62), (sil.belt + 0.4) / 2, z);
        g.add(ln);
      }
      for (const z of [this.bz + 0.3, sil.ra + sil.ar + 0.32]) {
        const hd = box(0.022, 0.028, 0.2, ['sklasse', 'volvo'].includes(car.style) ? S.chrome : this.paint, s * (xs(sil.belt - 0.14) + 0.006), sil.belt - 0.14, z);
        g.add(hd);
      }
      // dark sill
      g.add(box(0.03, 0.07, (sil.fa - sil.ar) - (sil.ra + sil.ar) - 0.02, S.black, s * (xs(0.25) - 0.01), sil.cl + 0.08, ((sil.fa - sil.ar) + (sil.ra + sil.ar)) / 2));
      // mirror
      const mir = rbox(0.2, 0.12, 0.13, 0.04, this.paint);
      mir.position.set(s * (hwBelt + 0.11), sil.belt + 0.08, sil.zA - 0.16);
      g.add(mir);
      g.add(box(0.12, 0.03, 0.05, S.black, s * (hwBelt + 0.03), sil.belt + 0.05, sil.zA - 0.16));
    }
    // lower bumper intake + rear valance
    this.buildFront(g);
    this.buildRear(g);
    // plates
    const plate = plateMaterial(car.plate || 'LU-X 1');
    const fp = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.114), plate);
    this.placeFront(fp, 0, 0.36, 0.012);
    g.add(fp);
    const rp = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.114), plate);
    this.placeRear(rp, 0, sil.wagon ? 0.66 : 0.68, 0.012);
    g.add(rp);
    if (car.hilti) this.buildHilti(g);
    if (car.cloud) this.buildCloud(g);
    mergeByMaterial(g);
  }

  // front/back surface of the body at (x, y)
  surfZ(y, front) {
    const P = this.sil.body;
    let best = front ? -Infinity : Infinity;
    for (let i = 0; i < P.length; i++) {
      const [z1, y1] = P[i], [z2, y2] = P[(i + 1) % P.length];
      if ((y < Math.min(y1, y2)) || (y > Math.max(y1, y2)) || y1 === y2) continue;
      if (front && z1 < 0 && z2 < 0) continue;
      if (!front && z1 > 0 && z2 > 0) continue;
      const z = z1 + (z2 - z1) * (y - y1) / (y2 - y1);
      if (front ? z > best : z < best) best = z;
    }
    return best;
  }
  place(mesh, x, y, out, front) {
    const d = this.car.dims;
    const eps = 0.01;
    const z0 = this.surfZ(y, front);
    const dz = (this.surfZ(y + eps, front) - this.surfZ(y - eps, front)) / (2 * eps);
    const sgn = front ? 1 : -1;
    const hw = (d.W / 2) * widthFactor(y, this.sil.belt);
    const nx = Math.min(1, Math.abs(x) / hw);
    const zs = z0 + sgn * BEVEL - planOffset(Math.sign(x) * nx, z0, d.L) * (front ? 1 : 1);
    // slope of the plan curve
    const dnx = 0.001;
    const g1 = planOffset(Math.min(1, nx + dnx), z0, d.L), g0 = planOffset(Math.max(0, nx - dnx), z0, d.L);
    const slope = -((g1 - g0) / (2 * dnx * hw)) * Math.sign(x || 1);
    mesh.rotation.order = 'YXZ';
    if (front) {
      mesh.rotation.y = Math.atan2(-slope, 1);
      mesh.rotation.x = -Math.atan2(-dz, 1);
    } else {
      mesh.rotation.y = Math.PI + Math.atan2(slope, 1) * -1;
      mesh.rotation.x = -Math.atan2(dz, 1);
    }
    const n = new THREE.Vector3(0, 0, 1).applyEuler(mesh.rotation);
    mesh.position.set(x, y, zs).addScaledVector(n, out);
  }
  placeFront(m, x, y, out = 0.006) { this.place(m, x, y, out, true); }
  placeRear(m, x, y, out = 0.006) { this.place(m, x, y, out, false); }

  buildFront(g) {
    const S = shared(), st = this.car.style, d = this.car.dims, sil = this.sil;
    const yH = sil.hood - 0.15; // headlight height
    const hx = d.W / 2 - 0.3;
    const lamp = (x, w, h, r) => { const m = rbox(w, h, 0.03, r, S.lens); this.placeFront(m, x, yH, 0.0); return m; };
    const bar = (x, y, w, h, mat = S.head, rz = 0, r = 0.008) => { const m = rbox(w, h, 0.02, r, mat); this.placeFront(m, x, y, 0.016); m.rotation.z += rz; return m; };
    // lower intake
    const intake = rbox(d.W * 0.56, 0.12, 0.04, 0.04, S.gloss);
    this.placeFront(intake, 0, 0.26, 0.0);
    g.add(intake);
    for (const s of [-1, 1]) {
      const side = rbox(0.2, 0.09, 0.04, 0.03, S.gloss);
      this.placeFront(side, s * (d.W / 2 - 0.26), 0.3, -0.002);
      g.add(side);
    }
    if (st === 'fuenfer') {
      for (const s of [-1, 1]) {
        g.add(lamp(s * hx, 0.42, 0.1, 0.03));
        g.add(bar(s * (hx + 0.02), yH + 0.025, 0.3, 0.018));
        g.add(bar(s * (hx - 0.13), yH - 0.005, 0.018, 0.06));
        g.add(bar(s * (hx + 0.11), yH - 0.005, 0.018, 0.06));
        // kidney grille
        const kid = rbox(0.21, 0.19, 0.03, 0.06, S.chrome);
        this.placeFront(kid, s * 0.125, yH - 0.07, 0.004);
        g.add(kid);
        const inner = rbox(0.18, 0.16, 0.03, 0.05, S.gloss);
        this.placeFront(inner, s * 0.125, yH - 0.07, 0.012);
        g.add(inner);
        for (let i = 0; i < 6; i++) g.add(bar(s * (0.06 + i * 0.026), yH - 0.07, 0.008, 0.15, S.chrome));
      }
    } else if (st === 'sklasse') {
      for (const s of [-1, 1]) {
        g.add(lamp(s * hx, 0.46, 0.13, 0.04));
        for (let i = 0; i < 3; i++) g.add(bar(s * (hx + 0.12 - i * 0.1), yH + 0.0, 0.05, 0.05, S.head, 0, 0.02));
        g.add(bar(s * hx, yH + 0.05, 0.36, 0.014));
      }
      const fr = rbox(0.64, 0.27, 0.04, 0.05, S.chrome);
      this.placeFront(fr, 0, yH - 0.05, 0.006);
      g.add(fr);
      const inn = rbox(0.58, 0.22, 0.03, 0.04, S.gloss);
      this.placeFront(inn, 0, yH - 0.05, 0.016);
      g.add(inn);
      for (let i = 0; i < 5; i++) g.add(bar(0, yH - 0.13 + i * 0.04, 0.58, 0.012, S.chrome));
    } else if (st === 'skoda') {
      for (const s of [-1, 1]) {
        g.add(lamp(s * hx, 0.4, 0.07, 0.025));
        for (let i = 0; i < 4; i++) g.add(bar(s * (hx + 0.12 - i * 0.075), yH, 0.05, 0.035, S.head, 0, 0.012));
      }
      const deck = rbox(d.W * 0.5, 0.2, 0.03, 0.06, S.gloss);
      this.placeFront(deck, 0, yH - 0.08, 0.004);
      g.add(deck);
      g.add(bar(0, yH + 0.02, d.W * 0.5, 0.012));
      for (let i = -6; i <= 6; i++) g.add(bar(i * 0.06, yH - 0.08, 0.012, 0.13, S.lens));
    } else if (st === 'volvo') {
      for (const s of [-1, 1]) {
        g.add(lamp(s * hx, 0.38, 0.12, 0.05));
        g.add(bar(s * (hx + 0.02), yH + 0.012, 0.24, 0.016)); // the "hammer"
        g.add(bar(s * (hx - 0.06), yH - 0.02, 0.016, 0.06));
      }
      const gr = rbox(0.62, 0.22, 0.03, 0.04, S.chrome);
      this.placeFront(gr, 0, yH - 0.05, 0.004);
      g.add(gr);
      const gi = rbox(0.57, 0.18, 0.03, 0.03, S.gloss);
      this.placeFront(gi, 0, yH - 0.05, 0.012);
      g.add(gi);
      for (let i = -9; i <= 9; i++) g.add(bar(i * 0.03, yH - 0.05, 0.007, 0.17, S.chrome));
    } else if (st === 'passat') {
      for (const s of [-1, 1]) g.add(lamp(s * hx, 0.42, 0.085, 0.025));
      g.add(bar(0, yH + 0.02, d.W - 0.34, 0.012));
      const gr = rbox(0.7, 0.07, 0.03, 0.02, S.gloss);
      this.placeFront(gr, 0, yH - 0.02, 0.004);
      g.add(gr);
      for (const s of [-1, 1]) g.add(bar(s * (hx - 0.04), yH - 0.01, 0.22, 0.03, S.head));
    } else {
      // generic (traffic, rival)
      for (const s of [-1, 1]) { g.add(lamp(s * hx, 0.36, 0.09, 0.03)); g.add(bar(s * hx, yH, 0.26, 0.02)); }
      const gr = rbox(0.6, 0.14, 0.03, 0.04, S.gloss);
      this.placeFront(gr, 0, yH - 0.05, 0.004);
      g.add(gr);
      if (this.car.accent) g.add(bar(0, yH + 0.03, d.W - 0.4, 0.014, new THREE.MeshStandardMaterial({ color: this.car.accent, emissive: this.car.accent, emissiveIntensity: 2 })));
    }
  }

  buildRear(g) {
    const S = shared(), st = this.car.style, d = this.car.dims, sil = this.sil;
    const yT = sil.wagon ? sil.belt - 0.14 : sil.belt - 0.12;
    const tx = d.W / 2 - 0.26;
    const house = (x, y, w, h, r = 0.02) => { const m = rbox(w, h, 0.03, r, S.tailHouse); this.placeRear(m, x, y, 0.0); g.add(m); };
    const red = (x, y, w, h, r = 0.006) => { const m = rbox(w, h, 0.02, r, this.tail); this.placeRear(m, x, y, 0.014); this.lightGroup.add(m); };
    this.lightGroup = new THREE.Group();
    this.body.add(this.lightGroup);
    if (st === 'fuenfer') {
      for (const s of [-1, 1]) { house(s * tx, yT, 0.44, 0.13); red(s * (tx + 0.04), yT + 0.035, 0.32, 0.018); red(s * (tx - 0.11), yT - 0.01, 0.018, 0.08); }
    } else if (st === 'sklasse') {
      for (const s of [-1, 1]) { house(s * tx, yT, 0.48, 0.12); for (let i = 0; i < 3; i++) red(s * tx, yT - 0.035 + i * 0.035, 0.4, 0.012); }
    } else if (st === 'skoda') {
      for (const s of [-1, 1]) { house(s * tx, yT, 0.42, 0.13); red(s * (tx + 0.05), yT + 0.04, 0.3, 0.016); red(s * (tx + 0.05), yT - 0.04, 0.3, 0.016); red(s * (tx + 0.19), yT, 0.016, 0.09); }
      house(0, yT + 0.02, d.W - 0.96, 0.03);
      red(0, yT + 0.02, d.W - 0.98, 0.01);
    } else if (st === 'volvo') {
      for (const s of [-1, 1]) {
        house(s * (d.W / 2 - 0.12), yT + 0.02, 0.16, 0.3);
        red(s * (d.W / 2 - 0.1), yT + 0.06, 0.02, 0.26);
        red(s * (d.W / 2 - 0.17), yT - 0.1, 0.14, 0.018);
      }
    } else if (st === 'passat') {
      for (const s of [-1, 1]) { house(s * tx, yT, 0.42, 0.11); red(s * (tx + 0.02), yT + 0.01, 0.34, 0.03); }
      house(0, yT + 0.02, d.W - 0.92, 0.035);
      red(0, yT + 0.02, d.W - 0.94, 0.012);
    } else {
      for (const s of [-1, 1]) { house(s * tx, yT, 0.38, 0.12); red(s * tx, yT, 0.3, 0.03); }
    }
    // reverse lights
    for (const s of [-1, 1]) { const m = rbox(0.07, 0.03, 0.02, 0.01, this.reverse); this.placeRear(m, s * (tx - 0.12), yT - 0.07, 0.014); this.lightGroup.add(m); }
    // rear valance + exhaust
    const val = rbox(d.W * 0.7, 0.1, 0.04, 0.03, S.black);
    this.placeRear(val, 0, 0.3, 0.0);
    g.add(val);
    this.exhausts = [];
    if (!this.car.ev) for (const s of [-1, 1]) {
      this.exhausts.push(new THREE.Vector3(s * (d.W / 2 - 0.42), 0.26, sil.zr - 0.02));
      this.baseExhausts = this.exhausts;
      const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.12, 14, 1, true), S.chrome);
      tip.rotation.x = Math.PI / 2;
      tip.position.set(s * (d.W / 2 - 0.42), 0.26, sil.zr + 0.06);
      g.add(tip);
    }
    mergeByMaterial(this.lightGroup);
  }

  buildHilti(g) {
    const d = this.car.dims, sil = this.sil;
    const xs = (d.W / 2) * widthFactor(0.62, sil.belt) + 0.012;
    for (const s of [-1, 1]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 0.4), hiltiMaterial());
      m.position.set(s * xs, 0.63, (sil.fa + sil.ra) / 2 - 0.05);
      m.rotation.y = s * Math.PI / 2;
      g.add(m);
    }
    const r = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.15), hiltiMaterial());
    this.placeRear(r, 0, sil.belt - 0.28, 0.01);
    g.add(r);
  }

  buildCloud(g) {
    // Cloudius: a fluffy cloud on the roof
    const m = new THREE.MeshStandardMaterial({ color: 0xf2f4ff, roughness: 0.85, emissive: 0x6a5cff, emissiveIntensity: 0.12 });
    const c = new THREE.Group();
    for (const [x, y, z, r] of [[0, 0.12, 0, 0.32], [0.28, 0.06, 0.2, 0.24], [-0.28, 0.06, 0.15, 0.26], [0.1, 0.08, -0.32, 0.27], [-0.15, 0.04, -0.4, 0.2], [0.25, 0.03, -0.15, 0.2]]) {
      const s = new THREE.Mesh(new THREE.SphereGeometry(r, 14, 10), m);
      s.position.set(x, y, z);
      c.add(s);
    }
    c.position.set(0, this.roofTop + 0.05, (this.sil.zW + this.sil.zRB) / 2);
    this.cloud = c;
    this.root.add(c);
  }

  // ---------------------------------------------------------------- wheels
  buildWheels() {
    for (const w of this.wheels) this.root.remove(w.holder);
    this.wheels = [];
    const d = this.car.dims, sil = this.sil;
    const xw = d.W / 2 - 0.15;
    const spots = [[1, sil.fa, true], [-1, sil.fa, true], [1, sil.ra, false], [-1, sil.ra, false]];
    for (const [s, z, front] of spots) {
      const w = buildWheel(this.cfg, d, this.rimMat, this.caliperMat, s < 0);
      w.holder.position.set(s * xw, d.wr, z);
      w.front = front;
      this.root.add(w.holder);
      this.wheels.push(w);
    }
  }

  // ---------------------------------------------------------------- tuning parts
  buildExtras() {
    if (this.extras) { this.body.remove(this.extras); this.extras.traverse((o) => o.geometry?.dispose()); }
    const S = shared(), d = this.car.dims, sil = this.sil, cfg = this.cfg;
    const e = this.extras = new THREE.Group();
    this.body.add(e);
    const has = (p) => cfg.parts.includes(p);
    this.exhausts = this.baseExhausts || [];
    const xs = (y) => (d.W / 2) * widthFactor(y, sil.belt);
    if (has('splitter')) {
      const sp = box(d.W * 0.86, 0.022, 0.16, S.carbon, 0, sil.cl + 0.02, sil.zf - 0.2);
      e.add(sp);
      for (const s of [-1, 1]) e.add(box(0.02, 0.06, 0.16, S.carbon, s * d.W * 0.43, sil.cl + 0.05, sil.zf - 0.2));
    }
    if (has('skirts')) {
      for (const s of [-1, 1]) {
        const len = (sil.fa - sil.ar) - (sil.ra + sil.ar) - 0.04;
        const sk = rbox(0.07, 0.07, len, 0.02, S.carbon);
        sk.position.set(s * (xs(0.25) + 0.015), sil.cl + 0.03, ((sil.fa - sil.ar) + (sil.ra + sil.ar)) / 2);
        e.add(sk);
      }
    }
    if (has('diffusor')) {
      const df = box(d.W * 0.66, 0.06, 0.24, S.carbon, 0, sil.cl + 0.04, sil.zr + 0.16);
      e.add(df);
      for (let i = -2; i <= 2; i++) e.add(box(0.012, 0.1, 0.24, S.carbon, i * 0.18, sil.cl + 0.07, sil.zr + 0.16));
      this.exhausts = [];
      if (!this.car.ev) for (const s of [-1, 1]) for (const o of [0, 0.11]) {
        this.exhausts.push(new THREE.Vector3(s * (d.W / 2 - 0.36 - o), 0.24, sil.zr - 0.03));
        const tip = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.14, 16, 1, true), S.chrome);
        tip.rotation.x = Math.PI / 2;
        tip.position.set(s * (d.W / 2 - 0.36 - o), 0.24, sil.zr + 0.05);
        e.add(tip);
        const inn = new THREE.Mesh(new THREE.CircleGeometry(0.04, 14), S.black);
        inn.position.set(s * (d.W / 2 - 0.36 - o), 0.24, sil.zr + 0.08);
        inn.rotation.y = Math.PI;
        e.add(inn);
      }
    }
    if (has('stripes')) {
      const M = stripeMaterial();
      const hoodA = new THREE.Vector3(0, sil.hood + 0.0, sil.zf - 0.3), hoodB = new THREE.Vector3(0, sil.belt + 0.0, sil.zA);
      const hl = hoodA.distanceTo(hoodB);
      const h1 = new THREE.Mesh(new THREE.PlaneGeometry(0.42, hl), M);
      h1.position.copy(hoodA).lerp(hoodB, 0.5).add(new THREE.Vector3(0, BEVEL + 0.012, 0));
      h1.rotation.x = -Math.PI / 2 - Math.atan2(hoodB.y - hoodA.y, hoodA.z - hoodB.z);
      e.add(h1);
      const rl = (sil.zW - 0.2) - (sil.zRB + 0.15);
      const r1 = new THREE.Mesh(new THREE.PlaneGeometry(0.42, rl), M);
      r1.rotation.x = -Math.PI / 2;
      r1.position.set(0, this.roofTop + 0.012, (sil.zW - 0.2 + sil.zRB + 0.15) / 2);
      e.add(r1);
      if (!sil.wagon) {
        const tl = sil.zC - (sil.zr + 0.12);
        const t1 = new THREE.Mesh(new THREE.PlaneGeometry(0.42, tl), M);
        t1.rotation.x = -Math.PI / 2;
        t1.position.set(0, sil.belt + STYLE[this.car.style].rise + 0.035 + BEVEL, (sil.zC + sil.zr + 0.12) / 2);
        e.add(t1);
      }
    }
    // spoilers
    const sp = cfg.spoiler;
    const roofSpoiler = sil.wagon;
    const yBase = roofSpoiler ? this.roofTop - (STYLE[this.car.style].roofDrop || 0) : sil.belt + STYLE[this.car.style].rise + 0.06 + BEVEL;
    const zBase = roofSpoiler ? sil.zRB + 0.04 : sil.zr + 0.16;
    const wSp = roofSpoiler ? d.W * 0.72 : d.W * 0.86;
    if (sp === 'lip') {
      // local x maps to +z (forward): the lip reaches 0.22 m back from its anchor and is tallest at the back
      const lip = polyMesh([[0, 0], [-0.22, 0], [-0.21, 0.045], [-0.02, 0.012]], wSp, this.paint);
      lip.rotation.y = -Math.PI / 2;
      lip.position.set(0, yBase - 0.03, roofSpoiler ? zBase : zBase + 0.16);
      e.add(lip);
    } else if (sp === 'wing' || sp === 'gt') {
      const gt = sp === 'gt';
      const hgt = gt ? 0.3 : 0.15;
      const depth = gt ? 0.34 : 0.26;
      const wing = polyMesh([[0, 0], [depth, 0.03], [depth, 0.05], [0.04, 0.035], [0, 0.015]], wSp * (gt ? 1.04 : 0.95), S.carbon);
      wing.rotation.y = -Math.PI / 2;
      wing.position.set(0, yBase + hgt, zBase + depth * 0.4);
      e.add(wing);
      for (const s of [-1, 1]) {
        const strut = box(0.025, hgt + 0.02, 0.1, S.carbon, s * wSp * 0.3, yBase + hgt / 2 - 0.01, zBase + 0.03);
        strut.rotation.x = gt ? 0.25 : 0.1;
        e.add(strut);
        if (gt) e.add(box(0.012, 0.16, depth + 0.06, S.carbon, s * wSp * 0.52, yBase + hgt + 0.02, zBase - depth * 0.1));
      }
    }
    // roof rack, Hilti case, roof box
    if (has('rack') || has('box')) {
      const top = this.roofTop;
      const hwR = this.roofHalf();
      const zA = sil.zW - 0.25, zB = sil.zRB + 0.2;
      for (const s of [-1, 1]) e.add(box(0.035, 0.035, zA - zB, S.chrome, s * hwR * 0.9, top + 0.04, (zA + zB) / 2));
      for (const z of [zA - 0.25, zB + 0.25]) e.add(box(hwR * 1.9, 0.03, 0.06, S.black, 0, top + 0.07, z));
    }
    if (has('rack')) {
      const top = this.roofTop;
      const caseMat = new THREE.MeshStandardMaterial({ color: 0xd2051e, roughness: 0.45 });
      const c = rbox(0.62, 0.22, 1.0, 0.04, caseMat);
      c.position.set(0, top + 0.2, (sil.zW + sil.zRB) / 2 - 0.05);
      e.add(c);
      for (const s of [-1, 1]) {
        const t = new THREE.Mesh(new THREE.PlaneGeometry(0.75, 0.19), hiltiMaterial());
        t.position.set(s * 0.312, top + 0.2, (sil.zW + sil.zRB) / 2 - 0.05);
        t.rotation.y = s * Math.PI / 2;
        e.add(t);
      }
      e.add(box(0.64, 0.025, 0.06, S.black, 0, top + 0.3, (sil.zW + sil.zRB) / 2 - 0.05));
    } else if (has('box')) {
      const top = this.roofTop;
      const geo = new THREE.SphereGeometry(1, 24, 12);
      geo.scale(0.42, 0.16, 0.95);
      const b = new THREE.Mesh(geo, S.gloss);
      b.position.set(0, top + 0.18, (sil.zW + sil.zRB) / 2 - 0.05);
      b.castShadow = true;
      e.add(b);
    }
    e.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  }
  roofHalf() { return (this.car.dims.W * widthFactor(this.sil.belt, this.sil.belt) * 0.955 / 2) * 0.81; }

  applyDrop() {
    this.dropM = (this.cfg.drop || 0) / 1000;
    this.body.position.y = -this.dropM;
  }

  /** Apply a changed tuning config (only rebuilds what is needed). */
  apply(cfg) {
    const old = this.cfg;
    this.cfg = { ...old, ...cfg, parts: [...(cfg.parts || old.parts)] };
    const c = this.cfg;
    if (c.color !== old.color) this.paint.color.set(colorHex(COLORS, c.color, 'silber').hex);
    if (c.finish !== old.finish) setFinish(this.paint, c.finish);
    if (c.rimColor !== old.rimColor) {
      const rc = colorHex(RIM_COLORS, c.rimColor, 'silber');
      this.rimMat.color.set(rc.hex); this.rimMat.metalness = rc.metal; this.rimMat.roughness = rc.rough;
    }
    if (c.caliper !== old.caliper) this.caliperMat.color.set(colorHex(CALIPERS, c.caliper, 'grau').hex);
    if (c.rim !== old.rim) this.buildWheels();
    if (c.spoiler !== old.spoiler || c.parts.join() !== old.parts.join()) this.buildExtras();
    if (c.drop !== old.drop) this.applyDrop();
  }

  /** exhaust flames (full throttle shifts, lift-off at high revs). k: 0..1 size */
  flame(k = 1) {
    if (!this.exhausts?.length) return;
    if (!this.flames) {
      this.flames = [];
      const mat = new THREE.SpriteMaterial({ map: flameTexture(), blending: THREE.AdditiveBlending, depthWrite: false, transparent: true });
      for (let i = 0; i < 16; i++) { const sp = new THREE.Sprite(mat.clone()); sp.visible = false; this.body.add(sp); this.flames.push({ sp, life: 0, max: 0.2, base: null, s: 1, off: 0 }); }
      this.flameLight = new THREE.PointLight(0xff7a2a, 0, 6, 2);
      this.body.add(this.flameLight);
    }
    // a short jet per tail pipe: hot blue core at the pipe, orange tongues further back
    for (const ex of this.exhausts) {
      const life = 0.12 + Math.random() * 0.14 * k;
      const s0 = (0.32 + Math.random() * 0.3) * (0.6 + k * 0.6);
      for (const off of [0, 1, 2]) {
        const f = this.flames.find((q) => q.life <= 0) || this.flames[0];
        f.life = f.max = life * (1 - off * 0.15);
        f.base = ex; f.off = off; f.s = s0 * (1 - off * 0.22);
        f.sp.visible = true;
      }
    }
    this.flameLight.position.copy(this.exhausts[0]).setX(0).add(new THREE.Vector3(0, 0.1, -0.6));
    this.flameLight.intensity = 2.5 * k;
  }
  updateFlames(dt) {
    if (!this.flames) return;
    for (const f of this.flames) {
      if (f.life <= 0) continue;
      f.life -= dt;
      const t = 1 - Math.max(0, f.life) / f.max; // 0 -> 1
      const len = f.s * (0.6 + t * 0.9);
      f.sp.position.copy(f.base).add(new THREE.Vector3(0, 0.02 * t + f.off * 0.015, -len * (0.3 + f.off * 0.42)));
      f.sp.scale.set(len * 0.75, len * 0.75, 1);
      f.sp.material.opacity = Math.max(0, 1 - t * t);
      if (f.life <= 0) f.sp.visible = false;
    }
    this.flameLight.intensity *= Math.exp(-dt * 18);
  }

  setBrake(on) { this.tail.emissiveIntensity = on ? 4.5 : 1.3; }
  setReverse(on) { this.reverse.emissiveIntensity = on ? 2.5 : 0; }

  /**
   * Visual update: wheel spin + steering + body motion from the physics.
   * speed m/s (signed), steer rad, ax/ay accelerations (m/s^2, local forward/right)
   */
  animate(dt, speed, steer, ax = 0, ay = 0) {
    const d = this.car.dims;
    const spin = speed / d.wr * dt;
    for (const w of this.wheels) {
      w.spin.rotation.x += spin * (w.holder.scale.x < 0 ? 1 : 1);
      if (w.front) w.pivot.rotation.y = steer * (w.holder.scale.x < 0 ? -1 : 1);
    }
    // spring-damper on pitch and roll; lowered cars roll less
    const s = this.susp;
    const stiff = 1 + (this.dropM || 0) * 12;
    const tp = -ax * 0.0045 / stiff, tr = ay * 0.006 / stiff;
    s.vp += ((tp - s.pitch) * 90 - s.vp * 11) * dt;
    s.vr += ((tr - s.roll) * 80 - s.vr * 10) * dt;
    s.pitch += s.vp * dt;
    s.roll += s.vr * dt;
    this.body.rotation.x = s.pitch;
    this.body.rotation.z = s.roll;
    this.updateFlames(dt);
    if (this.cloud) { this.cloud.position.y = this.roofTop + 0.05 + Math.sin(performance.now() / 400) * 0.03; }
  }

  dispose() {
    this.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
    this.paint.dispose(); this.tail.dispose(); this.reverse.dispose(); this.rimMat.dispose(); this.caliperMat.dispose();
  }
}

// ------------------------------------------------------------------ traffic cars (instanced, one draw call per shape)
const TRAFFIC_SPECS = {
  kompakt: { type: 'wagon', style: 'kompakt', dims: { L: 4.2, W: 1.8, H: 1.48, wb: 2.63, wr: 0.33, belt: 0.98, hood: 0.86 } },
  limo: { type: 'sedan', style: 'limo', dims: { L: 4.8, W: 1.84, H: 1.45, wb: 2.85, wr: 0.34, belt: 0.96, hood: 0.84 } },
  suv: { type: 'suv', style: 'suvT', dims: { L: 4.6, W: 1.88, H: 1.68, wb: 2.75, wr: 0.37, belt: 1.08, hood: 0.96 } }
};
export const TRAFFIC_TYPES = Object.keys(TRAFFIC_SPECS).concat(['van']);

function colored(geo, hex) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  for (const k of Object.keys(g.attributes)) if (!['position', 'normal'].includes(k)) g.deleteAttribute(k);
  const c = new THREE.Color(hex);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
const xf = (geo, x, y, z, rx = 0, ry = 0, rz = 0) => { geo.rotateX(rx); geo.rotateY(ry); geo.rotateZ(rz); geo.translate(x, y, z); return geo; };

/** One merged geometry with vertex colors (white body tinted per instance, dark glass/tires). */
export function trafficGeometry(kind) {
  const parts = [];
  let dims;
  if (kind === 'van') {
    dims = { L: 5.4, W: 2.0, H: 2.35, wr: 0.36 };
    parts.push(colored(xf(new THREE.BoxGeometry(2.0, 1.75, 4.1), 0, 1.3, -0.55), 0xffffff));
    parts.push(colored(xf(new THREE.BoxGeometry(1.96, 0.9, 1.2), 0, 0.85, 2.05), 0xffffff));
    parts.push(colored(xf(new THREE.BoxGeometry(1.9, 0.7, 0.9), 0, 1.65, 1.75, -0.5), 0x10151c));
    parts.push(colored(xf(new THREE.BoxGeometry(2.02, 0.5, 1.0), 0, 1.75, 1.2), 0x10151c));
    parts.push(colored(xf(new THREE.BoxGeometry(1.9, 0.12, 0.05), 0, 0.85, 2.66), 0xfff6dd));
    parts.push(colored(xf(new THREE.BoxGeometry(1.9, 0.1, 0.05), 0, 1.0, -2.62), 0xff2020));
    parts.push(colored(xf(new THREE.BoxGeometry(2.04, 0.35, 3.6), 0, 1.5, -0.6), 0xf2c200));
    for (const [x, z] of [[0.9, 1.75], [-0.9, 1.75], [0.9, -1.75], [-0.9, -1.75]]) parts.push(colored(xf(new THREE.CylinderGeometry(0.36, 0.36, 0.26, 14), x, 0.36, z, 0, 0, Math.PI / 2), 0x151515));
  } else {
    const spec = TRAFFIC_SPECS[kind];
    dims = spec.dims;
    const sil = silhouette(dims, spec.style, spec.type);
    parts.push(colored(buildBodyGeometry(sil, dims, { steps: 5, segs: 1 }), 0xffffff));
    parts.push(colored(buildGreenGeometry(sil, dims, { steps: 3, segs: 1 }).geo, 0x0e1319));
    const hx = dims.W / 2 - 0.3;
    for (const s of [-1, 1]) {
      parts.push(colored(xf(new THREE.BoxGeometry(0.36, 0.08, 0.05), s * hx, sil.hood - 0.14, sil.zf - 0.06), 0xfff6dd));
      parts.push(colored(xf(new THREE.BoxGeometry(0.34, 0.08, 0.05), s * hx, sil.belt - 0.12, sil.zr + 0.04), 0xff1a1a));
    }
    parts.push(colored(xf(new THREE.BoxGeometry(dims.W * 0.6, 0.14, 0.05), 0, 0.3, sil.zf - 0.04), 0x111111));
    for (const s of [-1, 1]) for (const z of [sil.fa, sil.ra]) {
      parts.push(colored(xf(new THREE.CylinderGeometry(dims.wr, dims.wr, 0.24, 16), s * (dims.W / 2 - 0.15), dims.wr, z, 0, 0, Math.PI / 2), 0x161616));
      parts.push(colored(xf(new THREE.CylinderGeometry(dims.wr * 0.62, dims.wr * 0.62, 0.25, 12), s * (dims.W / 2 - 0.14), dims.wr, z, 0, 0, Math.PI / 2), 0x9a9ea5));
    }
  }
  const g = mergeGeometries(parts, false);
  g.userData.dims = dims;
  return g;
}

/** Pedestrian geometry (vertex colors; shirt is white and tinted per instance). */
export function pedestrianGeometry() {
  const parts = [];
  parts.push(colored(xf(new THREE.CapsuleGeometry(0.2, 0.55, 3, 8), 0, 1.15, 0), 0xffffff));
  parts.push(colored(xf(new THREE.SphereGeometry(0.13, 10, 8), 0, 1.68, 0), 0xe8b48f));
  parts.push(colored(xf(new THREE.SphereGeometry(0.135, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.72, -0.01), 0x3a2a1c));
  parts.push(colored(xf(new THREE.CapsuleGeometry(0.085, 0.62, 2, 6), 0.1, 0.42, 0), 0x2a3140));
  parts.push(colored(xf(new THREE.CapsuleGeometry(0.085, 0.62, 2, 6), -0.1, 0.42, 0), 0x2a3140));
  return mergeGeometries(parts, false);
}
