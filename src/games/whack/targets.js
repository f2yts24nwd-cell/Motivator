import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, roundRect, drawBrand } from '../../core/gfx.js';

// Stylized, self-made 3D "heads" that are clearly recognizable as competitor /
// legacy product icons, without using any original logo files.
// Every head gets googly eyes + angry brows. itmX gets a friendly face and a halo.

const texCache = new Map();
function tex(key, w, h, draw) {
  if (!texCache.has(key)) texCache.set(key, canvasTexture(w, h, draw));
  return texCache.get(key);
}

const phys = (o) => new THREE.MeshPhysicalMaterial({ roughness: 0.35, metalness: 0.0, clearcoat: 0.6, clearcoatRoughness: 0.25, ...o });

function font(px, weight = 900) { return `${weight} ${px}px "Segoe UI", Arial, Helvetica, sans-serif`; }

// ---------- eyes ----------
const eyeWhite = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.15, clearcoat: 1 });
const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.3 });
const browMat = new THREE.MeshStandardMaterial({ color: 0x141414, roughness: 0.6 });
const eyeGeo = new THREE.SphereGeometry(0.17, 24, 16);
const pupilGeo = new THREE.SphereGeometry(0.08, 16, 12);
const browGeo = new THREE.BoxGeometry(0.3, 0.07, 0.07);

function addEyes(group, { y = 0.25, z = 0.2, spread = 0.24, mood = 'angry', scale = 1 } = {}) {
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group();
    const yy = Array.isArray(y) ? y[s < 0 ? 0 : 1] : y;
    eye.position.set(s * spread, yy, z);
    eye.scale.setScalar(scale);
    const white = new THREE.Mesh(eyeGeo, eyeWhite);
    white.castShadow = true;
    const pupil = new THREE.Mesh(pupilGeo, pupilMat);
    pupil.position.z = 0.12;
    eye.add(white, pupil);
    group.add(eye);
    eyes.push({ eye, pupil });
    if (mood !== 'none') {
      const brow = new THREE.Mesh(browGeo, browMat);
      brow.position.set(s * spread, yy + 0.2 * scale, z + 0.08);
      brow.rotation.z = mood === 'angry' ? s * -0.45 : s * 0.25;
      brow.scale.setScalar(scale);
      group.add(brow);
    }
  }
  return eyes;
}

// ---------- head builders ----------
function buildSAP() {
  const g = new THREE.Group();
  const shape = new THREE.Shape();
  shape.moveTo(-0.75, -0.45);
  shape.lineTo(-0.75, 0.45);
  shape.lineTo(0.85, 0.45);
  shape.lineTo(-0.05, -0.45);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.3, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 4 });
  geo.translate(0, 0, -0.15);
  const t = tex('sap', 512, 288, (g2, w, h) => {
    const grd = g2.createLinearGradient(0, 0, 0, h);
    grd.addColorStop(0, '#16a8ec');
    grd.addColorStop(1, '#0a53b8');
    g2.fillStyle = grd;
    g2.fillRect(0, 0, w, h);
    g2.fillStyle = '#fff';
    g2.font = font(140, 800);
    g2.textBaseline = 'middle';
    g2.fillText('SAP', 42, h * 0.52);
  }).clone();
  t.needsUpdate = true;
  t.repeat.set(1 / 1.6, 1 / 0.9);
  t.offset.set(0.75 / 1.6, 0.45 / 0.9);
  const face = phys({ map: t });
  const side = phys({ color: 0x0b5fc4 });
  const m = new THREE.Mesh(geo, [face, side]);
  m.castShadow = true;
  g.add(m);
  const eyes = addEyes(g, { y: 0.62, z: 0.08, spread: 0.3 });
  return { group: g, eyes, colors: [0x16a8ec, 0x0a53b8, 0xffffff], goo: 0x1b8cff };
}

function tileHead(key, bg, letter, extra) {
  const g = new THREE.Group();
  const t = tex(key, 512, 512, (c, w, h) => {
    c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    extra?.(c, w, h);
    // front "page" plate like the classic Office icons
    c.fillStyle = 'rgba(0,0,0,0.22)';
    roundRect(c, 40, 120, 300, 300, 26);
    c.fill();
    c.fillStyle = '#fff';
    c.font = font(260, 900);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(letter, 190, 285);
  });
  const side = phys({ color: new THREE.Color(bg).multiplyScalar(0.7) });
  const front = phys({ map: t });
  const geo = new RoundedBoxGeometry(1.25, 1.25, 0.32, 5, 0.12);
  const m = new THREE.Mesh(geo, [side, side, side, side, front, side]);
  m.castShadow = true;
  g.add(m);
  return g;
}

function buildExcel() {
  const g = tileHead('excel', '#1d6f42', 'X', (c, w, h) => {
    c.strokeStyle = 'rgba(255,255,255,0.35)';
    c.lineWidth = 6;
    for (let i = 0; i < 6; i++) {
      c.beginPath(); c.moveTo(260, 70 + i * 75); c.lineTo(w - 30, 70 + i * 75); c.stroke();
    }
    for (let i = 0; i < 3; i++) {
      c.beginPath(); c.moveTo(330 + i * 75, 70); c.lineTo(330 + i * 75, h - 60); c.stroke();
    }
  });
  const eyes = addEyes(g, { y: 0.78, z: 0.05, spread: 0.3 });
  return { group: g, eyes, colors: [0x1d6f42, 0x33c481, 0xffffff], goo: 0x21a366, cells: true };
}

function buildAccess() {
  const g = tileHead('access', '#a4373a', 'A', (c, w) => {
    c.fillStyle = 'rgba(255,255,255,0.3)';
    for (let i = 0; i < 3; i++) {
      c.beginPath();
      c.ellipse(w - 110, 120 + i * 110, 70, 26, 0, 0, Math.PI * 2);
      c.fill();
      c.fillRect(w - 180, 120 + i * 110, 140, 70);
    }
  });
  const eyes = addEyes(g, { y: 0.78, z: 0.05, spread: 0.3 });
  return { group: g, eyes, colors: [0xa4373a, 0xd35a5d, 0xffffff], goo: 0xc0262d };
}

function buildIE() {
  const g = new THREE.Group();
  const t = tex('ie', 512, 512, (c, w, h) => {
    const grd = c.createRadialGradient(w * 0.4, h * 0.35, 20, w / 2, h / 2, w / 2);
    grd.addColorStop(0, '#6cc4ff');
    grd.addColorStop(1, '#0a63c9');
    c.fillStyle = grd;
    c.fillRect(0, 0, w, h);
    c.fillStyle = '#fff';
    c.font = font(400, 700);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('e', w / 2, h * 0.47);
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.3, 48), [phys({ color: 0x0a63c9 }), phys({ map: t }), phys({ color: 0x0a63c9 })]);
  disc.rotation.set(Math.PI / 2, Math.PI / 2, 0); // spin cap so the logo reads upright
  disc.castShadow = true;
  g.add(disc);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.82, 0.07, 16, 64), phys({ color: 0xffb900, emissive: 0x7a4b00, emissiveIntensity: 0.4, metalness: 0.4 }));
  ring.rotation.set(0.2, 0.15, -0.5);
  ring.scale.set(1, 0.42, 1);
  ring.castShadow = true;
  g.add(ring);
  const eyes = addEyes(g, { y: 0.68, z: 0.1, spread: 0.28 });
  return { group: g, eyes, colors: [0x0a63c9, 0x6cc4ff, 0xffb900], goo: 0x1f8fff, spin: ring };
}

function buildClippy() {
  const g = new THREE.Group();
  const pts = [
    [0.18, -0.55], [0.18, 0.45], [0.0, 0.62], [-0.18, 0.45], [-0.18, -0.65], [-0.02, -0.82],
    [0.33, -0.7], [0.36, 0.6], [0.05, 0.86], [-0.28, 0.75], [-0.35, 0.2]
  ].map(([x, y]) => new THREE.Vector3(x, y, 0));
  const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.4);
  const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 160, 0.055, 14), new THREE.MeshStandardMaterial({ color: 0xcfd6df, metalness: 1, roughness: 0.18 }));
  tube.castShadow = true;
  g.add(tube);
  const eyes = addEyes(g, { y: 0.28, z: 0.16, spread: 0.2, scale: 1.25, mood: 'angry' });
  return { group: g, eyes, colors: [0xcfd6df, 0x9aa4b1, 0xffffff], goo: 0xd9e2ec, metal: true };
}

function buildFloppy() {
  const g = new THREE.Group();
  const t = tex('floppy', 512, 512, (c, w, h) => {
    c.fillStyle = '#1b2433';
    c.fillRect(0, 0, w, h);
    // shutter
    const sg = c.createLinearGradient(0, 0, w, 0);
    sg.addColorStop(0, '#9aa5b5'); sg.addColorStop(0.5, '#e6ebf2'); sg.addColorStop(1, '#8b96a6');
    c.fillStyle = sg;
    c.fillRect(130, 0, 250, 170);
    c.fillStyle = '#1b2433';
    c.fillRect(300, 25, 50, 120);
    // label
    c.fillStyle = '#d6d0c0';
    roundRect(c, 70, 250, 372, 230, 14);
    c.fill();
    c.strokeStyle = '#9fb6d6';
    c.lineWidth = 5;
    for (let i = 0; i < 4; i++) { c.beginPath(); c.moveTo(95, 320 + i * 40); c.lineTo(417, 320 + i * 40); c.stroke(); }
    c.fillStyle = '#c0392b';
    c.font = font(46, 800);
    c.textAlign = 'center';
    c.fillText('KUNDEN_FINAL_v7.xls', 256, 300);
  });
  const side = phys({ color: 0x1b2433 });
  const m = new THREE.Mesh(new RoundedBoxGeometry(1.2, 1.2, 0.16, 3, 0.05), [side, side, side, side, phys({ map: t, roughness: 0.5 }), side]);
  m.castShadow = true;
  g.add(m);
  const eyes = addEyes(g, { y: 0.74, z: 0.03, spread: 0.3 });
  return { group: g, eyes, colors: [0x1b2433, 0xe6ebf2, 0xf4f1e6], goo: 0x2b3a55 };
}

function buildCloud() {
  const g = new THREE.Group();
  const mat = phys({ color: 0x00a1e0, roughness: 0.3, clearcoat: 0.8, sheen: 0.5 });
  const blobs = [[-0.42, -0.05, 0.36], [0, 0.18, 0.48], [0.44, 0.0, 0.38], [0.2, -0.22, 0.34], [-0.2, -0.24, 0.34]];
  for (const [x, y, r] of blobs) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(r, 32, 20), mat);
    s.position.set(x, y, 0);
    s.scale.z = 0.6;
    s.castShadow = true;
    g.add(s);
  }
  const t = tex('cloud-label', 512, 160, (c, w, h) => {
    c.fillStyle = '#fff';
    c.font = font(96, 800);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('CRM €€€', w / 2, h / 2);
  });
  const label = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.31), new THREE.MeshBasicMaterial({ map: t, transparent: true, toneMapped: false }));
  label.position.set(0, -0.12, 0.31);
  g.add(label);
  const eyes = addEyes(g, { y: 0.32, z: 0.27, spread: 0.24 });
  return { group: g, eyes, colors: [0x00a1e0, 0x7fd6f7, 0xffffff], goo: 0x00a1e0 };
}

// ---------- itmX: the official logo shape as a real 3D object ----------
// Outline traced from public/brand/itmx-logo.png (766 x 828 px).
const LOGO_W = 766, LOGO_H = 828, LOGO_S = 1.3 / LOGO_H;
const LOGO_TILE = [[0, 152], [766, 2], [766, 828], [0, 828]];
const LOGO_X = [
  [112, 248], [258, 220], [274, 238], [274, 296], [360, 374], [400, 374], [490, 296], [490, 180],
  [505, 168], [637, 142], [654, 160], [654, 352], [560, 440], [560, 465], [654, 548], [654, 700],
  [637, 716], [510, 716], [492, 700], [492, 618], [400, 538], [360, 538], [274, 618], [274, 700],
  [258, 716], [128, 716], [112, 700], [112, 548], [205, 465], [205, 440], [112, 358]
];
function logoShape(pts, radiusPx) {
  const v = pts.map(([x, y]) => new THREE.Vector2((x - LOGO_W / 2) * LOGO_S, (LOGO_H / 2 - y) * LOGO_S));
  const shape = new THREE.Shape();
  const n = v.length;
  for (let i = 0; i < n; i++) {
    const p = v[i], prev = v[(i + n - 1) % n], next = v[(i + 1) % n];
    const r = Math.min(radiusPx * LOGO_S, p.distanceTo(prev) / 2, p.distanceTo(next) / 2);
    const a = p.clone().add(prev.clone().sub(p).normalize().multiplyScalar(r));
    const b = p.clone().add(next.clone().sub(p).normalize().multiplyScalar(r));
    if (i === 0) shape.moveTo(a.x, a.y); else shape.lineTo(a.x, a.y);
    shape.quadraticCurveTo(p.x, p.y, b.x, b.y);
  }
  shape.closePath();
  return shape;
}
const logoTopY = (px) => (LOGO_H / 2 - (152 - (150 * px) / LOGO_W)) * LOGO_S;

function buildItmx() {
  const g = new THREE.Group();
  const green = phys({ color: 0x50af30, roughness: 0.3, clearcoat: 1, clearcoatRoughness: 0.15, emissive: 0x50af30, emissiveIntensity: 0.04 });
  const white = phys({ color: 0xffffff, roughness: 0.25, clearcoat: 1, emissive: 0xffffff, emissiveIntensity: 0.12 });
  const tileGeo = new THREE.ExtrudeGeometry(logoShape(LOGO_TILE, 24), { depth: 0.26, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.03, bevelSegments: 4, curveSegments: 6 });
  tileGeo.translate(0, 0, -0.13);
  const tile = new THREE.Mesh(tileGeo, green);
  tile.castShadow = true;
  const xGeo = new THREE.ExtrudeGeometry(logoShape(LOGO_X, 14), { depth: 0.07, bevelEnabled: true, bevelThickness: 0.025, bevelSize: 0.018, bevelSegments: 3, curveSegments: 4 });
  xGeo.translate(0, 0, 0.15);
  const x = new THREE.Mesh(xGeo, white);
  x.castShadow = true;
  g.add(tile, x);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.04, 12, 48), new THREE.MeshStandardMaterial({ color: 0xffe27a, emissive: 0xffd34d, emissiveIntensity: 2.2 }));
  halo.rotation.x = Math.PI / 2 - 0.3;
  halo.position.y = 1.05;
  g.add(halo);
  // friendly eyes sitting on the slanted top edge
  const sp = 0.23;
  const eyes = addEyes(g, { y: [logoTopY(LOGO_W / 2 - sp / LOGO_S) + 0.06, logoTopY(LOGO_W / 2 + sp / LOGO_S) + 0.06], z: 0.02, spread: sp, mood: 'happy', scale: 0.85 });
  return { group: g, eyes, colors: [0x50af30, 0xffffff, 0x3c8a22], goo: 0x50af30, halo, friendly: true };
}

export const TARGET_TYPES = {
  sap:    { label: 'SAP',          points: 60,  weight: 5, build: buildSAP },
  cloud:  { label: 'Cloud-CRM',    points: 60,  weight: 4, build: buildCloud },
  excel:  { label: 'Excel',        points: 40,  weight: 6, build: buildExcel },
  access: { label: 'Access',       points: 50,  weight: 4, build: buildAccess },
  ie:     { label: 'Internet Explorer', points: 50, weight: 3, build: buildIE },
  floppy: { label: 'Diskette',     points: 30,  weight: 3, build: buildFloppy },
  clippy: { label: 'Karl Klammer', points: 120, weight: 1, build: buildClippy },
  itmx:   { label: 'itmX',         points: -250, weight: 0, build: buildItmx, friendly: true }
};

export function pickEnemyType() {
  const entries = Object.entries(TARGET_TYPES).filter(([, v]) => !v.friendly);
  const total = entries.reduce((s, [, v]) => s + v.weight, 0);
  let r = Math.random() * total;
  for (const [k, v] of entries) { r -= v.weight; if (r <= 0) return k; }
  return 'excel';
}

export function buildTarget(type) {
  const def = TARGET_TYPES[type];
  const built = def.build();
  built.type = type;
  built.def = def;
  return built;
}
