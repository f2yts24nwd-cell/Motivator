import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, drawBrand, rand, roundRect } from '../../core/gfx.js';

// All 3D models for "Frag den Danny!": Danny + his toolbox, the itmX extinguisher,
// colleagues, desks, SAP monolith, spaghetti-code monster, rubber duck, fire station.

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.6, metalness: 0, ...o });
const phys = (color, o = {}) => new THREE.MeshPhysicalMaterial({ color, roughness: 0.4, clearcoat: 0.6, ...o });
const shadow = (g) => { g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } }); return g; };

// ------------------------------------------------------------------ the extinguisher
let extLabelTex = null;
function extinguisherLabel() {
  if (extLabelTex) return extLabelTex;
  extLabelTex = canvasTexture(1024, 900, (g, w, h) => {
    // speckled granite / hammertone coating
    const img = g.createImageData(w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      let v = 226 + (Math.random() - 0.5) * 22;
      const r = Math.random();
      if (r < 0.06) v = 150 + Math.random() * 45;
      else if (r < 0.1) v = 246 + Math.random() * 9;
      d[i] = v; d[i + 1] = v; d[i + 2] = v - 2; d[i + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    // soft clustering blotches
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(${Math.random() < 0.5 ? '120,120,120' : '255,255,255'},${rand(0.04, 0.12)})`;
      g.beginPath(); g.arc(rand(0, w), rand(0, h), rand(2, 9), 0, Math.PI * 2); g.fill();
    }
    // itmX logo
    const lh = 140, lw = lh * 0.924;
    drawBrand(g, w / 2 - lw / 2 + 4, h * 0.27, lw, lh);
    // DANNY, vertical, reading bottom to top, inline-stripe lettering
    g.save();
    g.translate(w / 2 - 6, h * 0.6);
    g.rotate(-Math.PI / 2);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '900 78px "Arial Black", "Segoe UI", Arial, sans-serif';
    g.lineJoin = 'round';
    g.fillStyle = '#e8e8e4';
    g.fillText('DANNY', 0, 0);
    for (const [lw2, col] of [[15, '#1b1b1b'], [10.5, '#e8e8e4'], [6.5, '#1b1b1b'], [2.6, '#e8e8e4']]) { g.lineWidth = lw2; g.strokeStyle = col; g.strokeText('DANNY', 0, 0); }
    g.restore();
    // small print
    g.fillStyle = '#55585e';
    g.font = '500 22px "Segoe UI", Arial';
    g.textAlign = 'center';
    g.letterSpacing = '6px';
    g.fillText('FEUERWACHE · ITMX', w / 2, h * 0.835);
    // bottom band shadow
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, h * 0.925, w, 6);
  });
  return extLabelTex;
}

let gaugeTex = null;
function gaugeFace() {
  if (gaugeTex) return gaugeTex;
  gaugeTex = canvasTexture(128, 128, (g, w) => {
    const c = w / 2;
    g.fillStyle = '#1a1a1a'; g.beginPath(); g.arc(c, c, 62, 0, 7); g.fill();
    g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(c, c, 54, 0, 7); g.fill();
    g.lineWidth = 16;
    g.strokeStyle = '#d8242a'; g.beginPath(); g.arc(c, c + 10, 34, Math.PI * 1.05, Math.PI * 1.42); g.stroke();
    g.strokeStyle = '#2f9a3a'; g.beginPath(); g.arc(c, c + 10, 34, Math.PI * 1.44, Math.PI * 1.8); g.stroke();
    g.strokeStyle = '#d8242a'; g.beginPath(); g.arc(c, c + 10, 34, Math.PI * 1.82, Math.PI * 1.95); g.stroke();
    g.strokeStyle = '#222'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(c, c + 10); g.lineTo(c + 18, c - 22); g.stroke();
    g.fillStyle = '#222'; g.beginPath(); g.arc(c, c + 10, 7, 0, 7); g.fill();
    g.font = '700 12px Arial'; g.textAlign = 'center'; g.fillText('bar', c + 30, c + 36);
  });
  return gaugeTex;
}

function leverGeo(points, depth) {
  const s = new THREE.Shape();
  points.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 2, curveSegments: 4 });
  geo.translate(0, 0, -depth / 2);
  return geo;
}

/** The white "DANNY" foam extinguisher with the itmX logo (body height ~0.9, nozzle along -x). */
export function buildExtinguisher() {
  const g = new THREE.Group();
  const prof = [[0, 0], [0.1, 0], [0.14, 0.008], [0.158, 0.025], [0.163, 0.05], [0.16, 0.062], [0.166, 0.075], [0.166, 0.09], [0.165, 0.6]];
  for (let i = 1; i <= 12; i++) { const a = (i / 12) * Math.PI / 2; prof.push([0.058 + 0.107 * Math.cos(a), 0.6 + 0.255 * Math.sin(a)]); }
  prof.push([0.057, 0.9]);
  const lathe = new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 64, -Math.PI, Math.PI * 2);
  // petaloid feet at the bottom + UVs by height so the label is undistorted
  const pos = lathe.attributes.position, uv = lathe.attributes.uv;
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
    if (y < 0.06) {
      const phi = Math.atan2(x, z);
      const k = (1 - y / 0.06) * (0.5 - 0.5 * Math.cos(phi * 5));
      pos.setX(i, x * (1 - 0.1 * k)); pos.setZ(i, z * (1 - 0.1 * k));
      pos.setY(i, y + 0.012 * k * (1 - y / 0.06));
    }
    uv.setY(i, y / 0.9);
  }
  lathe.computeVertexNormals();
  const body = new THREE.Mesh(lathe, new THREE.MeshPhysicalMaterial({ map: extinguisherLabel(), roughness: 0.62, clearcoat: 0.35, clearcoatRoughness: 0.5 }));
  g.add(body);
  const chrome = std(0xc9ccd2, { metalness: 1, roughness: 0.22 });
  const black = phys(0x111214, { roughness: 0.35, clearcoat: 0.8 });
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.075, 0.05, 24), chrome);
  collar.position.y = 0.92;
  const valve = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.044, 0.15, 20), chrome);
  valve.position.y = 1.01;
  const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.03, 0.06, 16), std(0x8f949c, { metalness: 0.9, roughness: 0.3 }));
  knob.position.y = 1.11;
  g.add(collar, valve, knob);
  // pressure gauge on the front
  const gauge = new THREE.Mesh(new THREE.CylinderGeometry(0.046, 0.046, 0.024, 28), [chrome, new THREE.MeshBasicMaterial({ map: gaugeFace() }), chrome]);
  gauge.rotation.x = Math.PI / 2;
  gauge.position.set(0.012, 1.0, 0.05);
  g.add(gauge);
  // black nozzle cap on the side (spray outlet, -x)
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.07, 16), chrome);
  neck.rotation.z = Math.PI / 2;
  neck.position.set(-0.07, 1.0, 0);
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.078, 0.07, 0.14, 28), black);
  cap.rotation.z = Math.PI / 2;
  cap.position.set(-0.17, 1.0, 0);
  const capRing = new THREE.Mesh(new THREE.TorusGeometry(0.074, 0.008, 8, 28), black);
  capRing.rotation.y = Math.PI / 2;
  capRing.position.set(-0.24, 1.0, 0);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.05, 24), new THREE.MeshBasicMaterial({ color: 0x020202 }));
  hole.rotation.y = -Math.PI / 2;
  hole.position.set(-0.242, 1.0, 0);
  g.add(neck, cap, capRing, hole);
  // carry handle + squeeze lever (black, swooping to +x)
  const upper = new THREE.Mesh(leverGeo([[-0.02, 0.0], [0.05, 0.03], [0.34, 0.12], [0.36, 0.1], [0.06, -0.005], [-0.02, -0.02]], 0.04), black);
  upper.position.set(0, 1.08, 0);
  const lower = new THREE.Mesh(leverGeo([[0.0, 0.02], [0.12, 0.02], [0.3, -0.08], [0.39, -0.16], [0.37, -0.19], [0.28, -0.12], [0.1, -0.02], [0.0, -0.02]], 0.035), black);
  lower.position.set(0.02, 1.03, 0);
  const pin = new THREE.Mesh(new THREE.TorusGeometry(0.018, 0.004, 6, 16), chrome);
  pin.position.set(0.05, 1.07, 0.03);
  g.add(upper, lower, pin);
  shadow(g);
  const nozzle = new THREE.Object3D();
  nozzle.position.set(-0.26, 1.0, 0);
  g.add(nozzle);
  g.userData.nozzle = nozzle;
  g.userData.lever = lower;
  return g;
}

// ------------------------------------------------------------------ Danny
const textTex = (txt, { w = 512, h = 160, color = '#e9ff3a', font = '900 110px "Arial Black", Arial', bg = null } = {}) => canvasTexture(w, h, (g) => {
  if (bg) { g.fillStyle = bg; g.fillRect(0, 0, w, h); }
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = font;
  g.fillStyle = color;
  g.fillText(txt, w / 2, h / 2 + 4);
});

export function buildDanny() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const navy = phys(0x1b2640, { roughness: 0.75, clearcoat: 0.1, sheen: 0.4, sheenColor: new THREE.Color(0x4060a0) });
  const reflect = std(0xe4ff3a, { emissive: 0xc8e020, emissiveIntensity: 0.35, roughness: 0.4 });
  const silver = std(0xd6dde8, { emissive: 0x8090a0, emissiveIntensity: 0.25, metalness: 0.6, roughness: 0.25 });
  const skin = phys(0xe8b892, { roughness: 0.55, clearcoat: 0, sheen: 0.4, sheenColor: new THREE.Color(0xff9a7a) });
  const boot = phys(0x121212, { roughness: 0.3, clearcoat: 1 });
  const glove = std(0x1a1a1a, { roughness: 0.8 });

  const legs = [];
  for (const sx of [-0.15, 0.15]) {
    const leg = new THREE.Group();
    leg.position.set(sx, 0.92, 0);
    const thigh = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.62, 4, 10), navy);
    thigh.position.y = -0.42;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.138, 0.138, 0.05, 16), reflect);
    band.position.y = -0.58;
    const band2 = new THREE.Mesh(new THREE.CylinderGeometry(0.139, 0.139, 0.02, 16), silver);
    band2.position.y = -0.58;
    const b = new THREE.Mesh(new RoundedBoxGeometry(0.24, 0.2, 0.38, 2, 0.06), boot);
    b.position.set(0, -0.84, 0.06);
    leg.add(thigh, band, band2, b);
    body.add(leg);
    legs.push(leg);
  }
  // jacket
  const torso = new THREE.Mesh(new RoundedBoxGeometry(0.66, 0.78, 0.4, 3, 0.12), navy);
  torso.position.y = 1.3;
  body.add(torso);
  for (const y of [1.08, 1.42]) {
    const s1 = new THREE.Mesh(new RoundedBoxGeometry(0.68, 0.07, 0.42, 2, 0.03), reflect);
    s1.position.y = y;
    const s2 = new THREE.Mesh(new RoundedBoxGeometry(0.685, 0.025, 0.425, 2, 0.01), silver);
    s2.position.y = y;
    body.add(s1, s2);
  }
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.21, 0.1, 18), navy);
  collar.position.y = 1.72;
  body.add(collar);
  const back = new THREE.Mesh(new THREE.PlaneGeometry(0.56, 0.17), new THREE.MeshBasicMaterial({ map: textTex('DANNY'), transparent: true, color: new THREE.Color(1.4, 1.4, 1.4) }));
  back.position.set(0, 1.62, -0.205);
  back.rotation.y = Math.PI;
  body.add(back);
  const patch = new THREE.Mesh(new THREE.PlaneGeometry(0.13, 0.14), new THREE.MeshBasicMaterial({ map: canvasTexture(128, 128, (g, w, h) => drawBrand(g, 4, 4, w - 8, h - 8)), transparent: true }));
  patch.position.set(0.17, 1.58, 0.205);
  body.add(patch);
  // belt
  const belt = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.07, 20), std(0x111111));
  belt.scale.z = 0.62;
  belt.position.y = 0.94;
  const buckle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.07, 0.03), std(0xd8b04a, { metalness: 1, roughness: 0.3 }));
  buckle.position.set(0, 0.94, 0.215);
  body.add(belt, buckle);

  // head
  const neck = new THREE.Group();
  neck.position.y = 1.78;
  body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.21, 24, 18), skin);
  head.scale.set(1, 1.08, 1);
  head.position.y = 0.17;
  neck.add(head);
  const eyeW = std(0xffffff, { roughness: 0.2 });
  const eyeB = std(0x111111, { roughness: 0.2 });
  for (const sx of [-0.075, 0.075]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.035, 12, 10), eyeW);
    e.position.set(sx, 0.2, 0.18);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.018, 10, 8), eyeB);
    p.position.set(sx, 0.2, 0.21);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.022, 0.02), std(0x3a2414));
    brow.position.set(sx, 0.255, 0.195);
    brow.rotation.z = sx > 0 ? -0.25 : 0.25;
    neck.add(e, p, brow);
  }
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), skin);
  nose.position.set(0, 0.15, 0.21);
  neck.add(nose);
  // the moustache. Every firefighter needs one.
  const stache = new THREE.Group();
  for (const sx of [-1, 1]) {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(0.03, 0.1, 4, 8), std(0x3a2414, { roughness: 0.9 }));
    m.rotation.z = Math.PI / 2 + sx * 0.35;
    m.position.set(sx * 0.055, 0.095, 0.2);
    stache.add(m);
  }
  neck.add(stache);
  const grin = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.01, 6, 12, Math.PI), std(0x5a1010));
  grin.rotation.z = Math.PI;
  grin.position.set(0, 0.07, 0.19);
  neck.add(grin);
  // helmet: neon yellow shell, crest, dark visor
  const helmMat = phys(0xe6f02a, { roughness: 0.25, clearcoat: 1, emissive: 0x2a2c00, emissiveIntensity: 0.4 });
  const shell = new THREE.Mesh(new THREE.SphereGeometry(0.255, 28, 16, 0, Math.PI * 2, 0, Math.PI / 2), helmMat);
  shell.scale.set(1, 1.1, 1.12);
  shell.position.y = 0.22;
  const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.285, 0.3, 0.035, 28), helmMat);
  brim.scale.z = 1.15;
  brim.position.set(0, 0.215, -0.01);
  const crest = new THREE.Mesh(new RoundedBoxGeometry(0.06, 0.08, 0.5, 2, 0.025), helmMat);
  crest.position.y = 0.48;
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.26, 24, 10, -Math.PI / 2.6, Math.PI / 1.3, Math.PI / 2.2, Math.PI / 5), new THREE.MeshPhysicalMaterial({ color: 0x223040, roughness: 0.05, metalness: 0.3, transparent: true, opacity: 0.55, clearcoat: 1 }));
  visor.position.set(0, 0.25, 0.03);
  visor.scale.set(1, 1.1, 1.15);
  const helmBand = new THREE.Mesh(new THREE.CylinderGeometry(0.262, 0.262, 0.03, 28, 1, true), silver);
  helmBand.scale.z = 1.12;
  helmBand.position.y = 0.3;
  neck.add(shell, brim, crest, visor, helmBand);

  // arms (pivot at the shoulder; rotation.x < 0 swings forward)
  const arms = [];
  const hands = [];
  for (const sx of [-0.42, 0.42]) {
    const arm = new THREE.Group();
    arm.position.set(sx, 1.58, 0);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.5, 4, 10), navy);
    sleeve.position.y = -0.3;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.106, 0.106, 0.05, 14), reflect);
    band.position.y = -0.42;
    const hand = new THREE.Group();
    hand.position.y = -0.66;
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.1, 14, 10), glove);
    hand.add(gl);
    arm.add(sleeve, band, hand);
    body.add(arm);
    arms.push(arm);
    hands.push(hand);
  }

  // ---- tools
  const tools = {};
  const ext = buildExtinguisher();
  ext.scale.setScalar(0.9);
  // carried in front: nozzle forward (+z), label facing outwards to the right
  ext.rotation.set(0, Math.PI / 2, 0);
  ext.position.set(0.18, 0.42, 0.42);
  body.add(ext);
  tools.foam = ext;
  // defibrillator paddles (one in each hand) + coiled cable
  const paddleMat = std(0xdfe3ea, { metalness: 0.9, roughness: 0.2 });
  const handleMat = phys(0xff8a00, { roughness: 0.4 });
  const defi = [];
  for (const hand of hands) {
    const p = new THREE.Group();
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.045, 0.18, 12), handleMat);
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.11, 0.025, 20), paddleMat);
    plate.position.y = -0.11;
    const glow = new THREE.Mesh(new THREE.CircleGeometry(0.1, 20), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 1.6, 3), transparent: true, opacity: 0, depthWrite: false }));
    glow.rotation.x = Math.PI / 2;
    glow.position.y = -0.125;
    p.add(handle, plate, glow);
    p.rotation.x = -Math.PI / 2;
    p.position.set(0, 0, 0.08);
    p.userData.glow = glow;
    hand.add(p);
    defi.push(p);
  }
  tools.defi = defi;
  // sledgehammer "HARD RESET"
  const hammer = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.04, 1.05, 10), std(0x8a5a33, { roughness: 0.7 }));
  shaft.position.y = 0.4;
  const hhead = new THREE.Mesh(new RoundedBoxGeometry(0.22, 0.22, 0.48, 2, 0.03), [
    std(0x2b2f36, { metalness: 0.9, roughness: 0.35 }), std(0x2b2f36, { metalness: 0.9, roughness: 0.35 }),
    std(0x2b2f36, { metalness: 0.9, roughness: 0.35 }), std(0x2b2f36, { metalness: 0.9, roughness: 0.35 }),
    std(0xffffff, { map: textTex('RESET', { w: 256, h: 128, color: '#ff3b2a', font: '900 64px "Arial Black", Arial', bg: '#2b2f36' }), metalness: 0.4, roughness: 0.4 }),
    std(0x2b2f36, { metalness: 0.9, roughness: 0.35 })
  ]);
  hhead.rotation.y = Math.PI / 2;
  hhead.position.y = 0.92;
  hammer.add(shaft, hhead);
  hammer.position.set(0, 0, 0.02);
  hands[1].add(hammer);
  tools.hammer = hammer;
  // debug duck in the right hand
  const duck = buildDuck();
  duck.scale.setScalar(0.7);
  duck.position.set(0, 0.05, 0.1);
  hands[1].add(duck);
  tools.duck = duck;

  shadow(root);
  back.castShadow = false;
  patch.castShadow = false;
  return { root, body, legs, arms, hands, neck, tools, ext };
}

// ------------------------------------------------------------------ rubber duck
export function buildDuck() {
  const g = new THREE.Group();
  const yel = phys(0xffd21a, { roughness: 0.25, clearcoat: 1 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 14), yel);
  b.scale.set(1, 0.8, 1.25);
  b.position.y = 0.16;
  const tail = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.16, 10), yel);
  tail.rotation.x = -2.2;
  tail.position.set(0, 0.26, -0.24);
  const hd = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), yel);
  hd.position.set(0, 0.38, 0.1);
  const beak = new THREE.Mesh(new THREE.SphereGeometry(0.07, 12, 8), phys(0xff7a00));
  beak.scale.set(1.2, 0.45, 1.3);
  beak.position.set(0, 0.35, 0.23);
  g.add(b, tail, hd, beak);
  for (const sx of [-0.06, 0.06]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.024, 8, 6), std(0x111111, { roughness: 0.1 }));
    e.position.set(sx, 0.42, 0.21);
    g.add(e);
  }
  return shadow(g);
}

// ------------------------------------------------------------------ colleagues
const SKIN = [0xf1c6a5, 0xe0ac82, 0xc68a5e, 0x9a6440, 0x6e4528, 0xf6d2b8];
const HAIR = [0x2a1c12, 0x5a3a20, 0x111111, 0xc9a36a, 0x8a3a1a, 0x9a9a9a];
export const ROLE_LABEL = { berater: 'Berater', dev: 'Entwickler', pl: 'Projektleiter', kunde: 'Kunde' };

export function buildNPC(role) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skinC = SKIN[Math.floor(Math.random() * SKIN.length)];
  const hairC = HAIR[Math.floor(Math.random() * HAIR.length)];
  const look = {
    berater: { top: [0x2f3542, 0x3b4a6b, 0x4a4f57][Math.floor(Math.random() * 3)], shirt: 0xf4f6fa, tie: [0xd8242a, 0x19c3ff, 0x50af30, 0xffb000][Math.floor(Math.random() * 4)], legs: 0x2a2f3a },
    dev: { top: [0x22252e, 0x3a2a4a, 0x1f3a2e, 0x5a1f22][Math.floor(Math.random() * 4)], shirt: null, tie: null, legs: 0x2b3b5a },
    pl: { top: [0x9cc4ff, 0xf1f1f1, 0xffd9a0][Math.floor(Math.random() * 3)], shirt: null, tie: null, legs: 0x4a4038 },
    kunde: { top: 0x15181f, shirt: 0xf4f6fa, tie: 0xb0101a, legs: 0x15181f }
  }[role];
  const mats = [];
  const M = (c, o) => { const m = phys(c, { roughness: 0.6, clearcoat: 0.1, ...o }); mats.push(m); return m; };
  const skin = M(skinC, { roughness: 0.5, clearcoat: 0.02, sheen: 0.3, sheenColor: new THREE.Color(0xff9a7a) });
  const topM = M(look.top, { roughness: role === 'dev' ? 0.95 : 0.6, sheen: 0.4 });
  const legM = M(look.legs);
  const shoeM = M(0x161616, { roughness: 0.3, clearcoat: 1 });
  const legs = [];
  for (const sx of [-0.12, 0.12]) {
    const leg = new THREE.Group();
    leg.position.set(sx, 0.82, 0);
    const l = new THREE.Mesh(new THREE.CapsuleGeometry(0.1, 0.56, 4, 8), legM);
    l.position.y = -0.38;
    const sh = new THREE.Mesh(new RoundedBoxGeometry(0.18, 0.12, 0.3, 2, 0.05), shoeM);
    sh.position.set(0, -0.76, 0.05);
    leg.add(l, sh);
    body.add(leg);
    legs.push(leg);
  }
  const torso = new THREE.Mesh(new RoundedBoxGeometry(0.54, 0.66, 0.32, 3, 0.1), topM);
  torso.position.y = 1.14;
  body.add(torso);
  if (look.shirt) {
    const shirt = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.36), M(look.shirt));
    shirt.position.set(0, 1.27, 0.162);
    body.add(shirt);
    const tie = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.32), M(look.tie, { roughness: 0.3 }));
    tie.position.set(0, 1.25, 0.165);
    body.add(tie);
  }
  if (role === 'dev') {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.06, 8, 16), topM);
    hood.rotation.x = Math.PI / 2;
    hood.position.set(0, 1.47, -0.04);
    body.add(hood);
  }
  if (role === 'pl') {
    const clip = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.34, 0.02), M(0x8a5a33));
    clip.position.set(0.18, 1.08, 0.2);
    clip.rotation.set(-0.3, 0, 0.1);
    body.add(clip);
  }
  const neck = new THREE.Group();
  neck.position.y = 1.5;
  body.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.19, 20, 16), skin);
  head.scale.set(1, 1.1, 1);
  head.position.y = 0.16;
  neck.add(head);
  const eyeW = M(0xffffff, { roughness: 0.2 });
  const eyeB = M(0x111111, { roughness: 0.2 });
  const eyes = [];
  for (const sx of [-0.065, 0.065]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), eyeW);
    e.position.set(sx, 0.2, 0.16);
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.02, 8, 6), eyeB);
    p.position.set(sx, 0.2, 0.195);
    neck.add(e, p);
    eyes.push(e);
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.04, 0.009, 6, 12, Math.PI), M(0x5a1010));
  mouth.rotation.z = Math.PI;
  mouth.position.set(0, 0.07, 0.175);
  neck.add(mouth);
  // hair
  const hairM = M(hairC, { roughness: 0.85 });
  let hair = null;
  if (role !== 'kunde' || Math.random() < 0.3) {
    hair = new THREE.Mesh(new THREE.SphereGeometry(0.2, 18, 10, 0, Math.PI * 2, 0, Math.PI / 2.1), hairM);
    hair.position.y = 0.2;
    hair.scale.set(1.03, role === 'berater' ? 0.75 : 0.9, 1.05);
    hair.rotation.x = -0.25;
    neck.add(hair);
  }
  if (role === 'dev') {
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.21, 0.02, 6, 20, Math.PI), M(0x111111));
    band.position.y = 0.2;
    const cupL = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 14), M(0x111111));
    cupL.rotation.z = Math.PI / 2; cupL.position.set(-0.2, 0.16, 0);
    const cupR = cupL.clone(); cupR.position.x = 0.2;
    neck.add(band, cupL, cupR);
  }
  if (role === 'pl' || (role === 'dev' && Math.random() < 0.5)) {
    const gm = M(0x111111);
    for (const sx of [-0.065, 0.065]) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.008, 6, 14), gm);
      r.position.set(sx, 0.2, 0.2);
      neck.add(r);
    }
  }
  const arms = [];
  for (const sx of [-0.34, 0.34]) {
    const arm = new THREE.Group();
    arm.position.set(sx, 1.4, 0);
    const a = new THREE.Mesh(new THREE.CapsuleGeometry(0.085, 0.44, 4, 8), topM);
    a.position.y = -0.27;
    const h = new THREE.Mesh(new THREE.SphereGeometry(0.075, 10, 8), skin);
    h.position.y = -0.56;
    arm.add(a, h);
    body.add(arm);
    arms.push(arm);
  }
  shadow(root);
  // remember the colours for soot / wet tinting
  for (const m of mats) { m.userData.base = m.color.clone(); m.userData.cc = m.clearcoat; m.userData.rough = m.roughness; }
  return { root, body, legs, arms, neck, head, eyes, hair, mats, role };
}

/** tint 0..1 soot (black), wet 0..1 (darker + glossy) */
export function tintNPC(npc, soot, wet) {
  for (const m of npc.mats) {
    m.color.copy(m.userData.base);
    m.clearcoat = m.userData.cc; m.roughness = m.userData.rough;
    if (wet > 0) { m.color.multiplyScalar(1 - wet * 0.35); m.clearcoat = Math.max(m.userData.cc, 0.02) + wet * 0.9; m.roughness = Math.max(0.15, 0.6 - wet * 0.45); }
    if (soot > 0) m.color.lerp(new THREE.Color(0x0b0b0b), soot * 0.92);
  }
  // eyes stay white in the soot, cartoon style
  for (const e of npc.eyes) e.material.color.setRGB(1, 1, 1);
}

// ------------------------------------------------------------------ desks
const CODE_LINES = ['if (kunde.zufrieden) {', '  return false;', '}', '// TODO: fixen (2017)', 'catch (e) { /* egal */ }', 'while (true) meeting();', 'let budget = 0;', 'SELECT * FROM chaos', 'goto 10;', 'import { panik }'];
export function screenTexture(kind) {
  return canvasTexture(256, 160, (c, w, h) => {
    if (kind === 'error') {
      c.fillStyle = '#b3121b'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#fff'; c.font = '900 34px Arial'; c.textAlign = 'center';
      c.fillText('FEHLER', w / 2, 60);
      c.font = '700 16px Arial'; c.fillText('Frag den Danny', w / 2, 95);
      c.font = '900 40px Arial'; c.fillText('☠', w / 2, 140);
      return;
    }
    if (kind === 'code') {
      c.fillStyle = '#0d1117'; c.fillRect(0, 0, w, h);
      c.font = '13px monospace';
      for (let i = 0; i < 9; i++) { c.fillStyle = ['#ff7b72', '#79c0ff', '#a5d6ff', '#7ee787', '#d2a8ff'][i % 5]; c.fillText(CODE_LINES[(i * 3 + Math.floor(Math.random() * 10)) % CODE_LINES.length], 10, 18 + i * 16); }
      return;
    }
    c.fillStyle = '#0e1a30'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#50af30'; c.fillRect(0, 0, w, 20);
    c.fillStyle = '#fff'; c.font = '700 12px Arial'; c.fillText('itmX CRM · Pipeline', 8, 14);
    for (let i = 0; i < 6; i++) { const bh = rand(18, 100); c.fillStyle = i % 2 ? '#3ddc84' : '#19c3ff'; c.fillRect(14 + i * 38, h - 12 - bh, 26, bh); }
  });
}

let deskMats = null;
export function buildDesk() {
  if (!deskMats) {
    deskMats = {
      top: phys(0xd9d4c8, { roughness: 0.5, clearcoat: 0.3 }),
      leg: std(0x2a2f3a, { metalness: 0.8, roughness: 0.3 }),
      mon: std(0x121418, { roughness: 0.4 }),
      chair: phys(0x23293a, { roughness: 0.7 }),
      key: std(0x30343c)
    };
  }
  const M = deskMats;
  const g = new THREE.Group();
  const top = new THREE.Mesh(new RoundedBoxGeometry(1.6, 0.07, 0.85, 2, 0.02), M.top);
  top.position.y = 0.76;
  g.add(top);
  for (const sx of [-0.74, 0.74]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.74, 0.75), M.leg);
    leg.position.set(sx, 0.37, 0);
    g.add(leg);
  }
  const mon = new THREE.Mesh(new THREE.BoxGeometry(0.78, 0.48, 0.04), M.mon);
  mon.position.set(0, 1.12, -0.28);
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.09, 0.3), M.leg);
  stand.position.set(0, 0.92, -0.3);
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTexture(Math.random() < 0.4 ? 'code' : 'crm'), color: new THREE.Color(1.25, 1.25, 1.25) });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.42), screenMat);
  screen.position.set(0, 1.12, -0.257);
  const kb = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.025, 0.16), M.key);
  kb.position.set(0, 0.805, 0.05);
  const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.045, 0.11, 12), std([0x19c3ff, 0xff3d9a, 0x50af30, 0xffffff][Math.floor(Math.random() * 4)]));
  mug.position.set(0.55, 0.85, 0.05);
  g.add(mon, stand, screen, kb, mug);
  // chair (behind the desk, +z side)
  const seat = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.1, 0.56, 2, 0.04), M.chair);
  seat.position.set(0, 0.48, 0.72);
  const backr = new THREE.Mesh(new RoundedBoxGeometry(0.58, 0.7, 0.1, 2, 0.04), M.chair);
  backr.position.set(0, 0.9, 1.0);
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.42), M.leg);
  post.position.set(0, 0.24, 0.72);
  g.add(seat, backr, post);
  shadow(g);
  screen.castShadow = false;
  return { group: g, screenMat, chair: [seat, backr, post] };
}

// ------------------------------------------------------------------ SAP monolith
let sapTex = null;
export function buildSAP() {
  if (!sapTex) {
    sapTex = canvasTexture(512, 512, (c, w, h) => {
      c.fillStyle = '#6e737b'; c.fillRect(0, 0, w, h);
      const img = c.getImageData(0, 0, w, h);
      for (let i = 0; i < img.data.length; i += 4) { const v = (Math.random() - 0.5) * 30; img.data[i] += v; img.data[i + 1] += v; img.data[i + 2] += v; }
      c.putImageData(img, 0, 0);
      c.strokeStyle = 'rgba(20,20,24,0.7)'; c.lineWidth = 3;
      for (let k = 0; k < 7; k++) { c.beginPath(); let x = rand(0, w), y = rand(0, h); c.moveTo(x, y); for (let j = 0; j < 6; j++) { x += rand(-60, 60); y += rand(-60, 60); c.lineTo(x, y); } c.stroke(); }
      c.fillStyle = '#3d4148'; c.font = '900 150px "Arial Black", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('SAP', w / 2 + 3, h / 2 - 37);
      c.fillStyle = '#9aa0a8'; c.fillText('SAP', w / 2, h / 2 - 40);
      c.font = '700 30px monospace'; c.fillStyle = '#2a2d33';
      c.fillText('Z_TRANSPORT_1998', w / 2, h / 2 + 70);
      c.fillText('NICHT ANFASSEN', w / 2, h / 2 + 110);
    });
  }
  const g = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ map: sapTex, roughness: 0.9, emissive: 0xff3300, emissiveIntensity: 0 });
  const slabs = [];
  const H = [0.9, 0.7, 0.6];
  let y = 0;
  H.forEach((hh, i) => {
    const w = 1.5 - i * 0.12;
    const s = new THREE.Mesh(new RoundedBoxGeometry(w, hh, w, 2, 0.06), mat);
    s.position.y = y + hh / 2;
    s.rotation.y = rand(-0.12, 0.12);
    y += hh;
    g.add(s);
    slabs.push(s);
  });
  shadow(g);
  return { group: g, slabs, mat };
}

// ------------------------------------------------------------------ spaghetti code monster
export function buildSpaghetti() {
  const g = new THREE.Group();
  const noodleMat = phys(0xf0cf72, { roughness: 0.35, clearcoat: 0.8 });
  const noodles = [];
  for (let i = 0; i < 16; i++) {
    const pts = [];
    let a = Math.random() * 6.28;
    for (let k = 0; k < 6; k++) {
      a += rand(-1.4, 1.4);
      const r = rand(0.15, 0.55) * (1 - k * 0.08);
      pts.push(new THREE.Vector3(Math.cos(a) * r, 0.1 + k * rand(0.12, 0.24), Math.sin(a) * r));
    }
    const m = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 24, 0.035, 6), noodleMat);
    m.userData.ph = Math.random() * 6.28;
    g.add(m);
    noodles.push(m);
  }
  const sauce = phys(0xb3170c, { roughness: 0.2, clearcoat: 1 });
  for (let i = 0; i < 5; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(rand(0.12, 0.22), 12, 10), sauce);
    s.scale.y = 0.5;
    s.position.set(rand(-0.3, 0.3), rand(0.6, 1.1), rand(-0.3, 0.3));
    g.add(s);
  }
  const ball = std(0x6b3a1e, { roughness: 0.95 });
  for (let i = 0; i < 4; i++) {
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.13, 10, 8), ball);
    b.position.set(rand(-0.4, 0.4), 0.15, rand(-0.4, 0.4));
    g.add(b);
  }
  // eyes on stalks
  const eyes = new THREE.Group();
  eyes.position.y = 1.25;
  for (const sx of [-0.16, 0.16]) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), std(0xffffff, { roughness: 0.1 }));
    e.position.x = sx;
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.06, 10, 8), std(0x111111, { roughness: 0.1 }));
    p.position.set(sx, 0, 0.1);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.035, 0.04), std(0x6b3a1e));
    brow.position.set(sx, 0.12, 0.08);
    brow.rotation.z = sx > 0 ? 0.45 : -0.45;
    eyes.add(e, p, brow);
  }
  g.add(eyes);
  shadow(g);
  return { group: g, noodles, eyes };
}

// ------------------------------------------------------------------ props
export function buildLastenheft() {
  const g = new THREE.Group();
  const tex = canvasTexture(256, 340, (c, w, h) => {
    c.fillStyle = '#f7f5ee'; c.fillRect(0, 0, w, h);
    c.fillStyle = '#b3121b'; c.font = '900 30px Arial'; c.textAlign = 'center';
    c.fillText('LASTENHEFT', w / 2, 60);
    c.fillStyle = '#333'; c.font = '700 20px Arial';
    c.fillText('v847 · FINAL_final2', w / 2, 95);
    c.fillStyle = '#999';
    for (let i = 0; i < 9; i++) c.fillRect(30, 130 + i * 20, rand(120, 196), 7);
  });
  const doc = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.12, 0.75), [std(0xeeeeee), std(0xeeeeee), new THREE.MeshStandardMaterial({ map: tex }), std(0xeeeeee), std(0xeeeeee), std(0xeeeeee)]);
  g.add(doc);
  return shadow(g);
}

export function buildHydrant() {
  const g = new THREE.Group();
  const red = phys(0xd0141c, { roughness: 0.3, clearcoat: 1 });
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.36, 0.12, 20), red);
  base.position.y = 0.06;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.9, 20), red);
  col.position.y = 0.55;
  const dome = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 10, 0, Math.PI * 2, 0, Math.PI / 2), red);
  dome.position.y = 1.0;
  const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.1, 8), std(0xc9ccd2, { metalness: 1, roughness: 0.3 }));
  cap.position.y = 1.26;
  g.add(base, col, dome, cap);
  for (const sx of [-1, 1]) {
    const n = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 0.16, 14), std(0xc9ccd2, { metalness: 1, roughness: 0.3 }));
    n.rotation.z = Math.PI / 2;
    n.position.set(sx * 0.28, 0.72, 0);
    g.add(n);
  }
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.34), new THREE.MeshBasicMaterial({ map: textTex('NACHFÜLLEN', { w: 512, h: 160, color: '#ffffff', font: '900 64px "Arial Black", Arial', bg: '#c4141c' }), color: new THREE.Color(1.4, 1.4, 1.4) }));
  sign.position.set(0, 1.75, 0);
  g.add(sign);
  const ring = new THREE.Mesh(new THREE.RingGeometry(1.0, 1.15, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 1.4, 3), transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide }));
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.02;
  g.add(ring);
  shadow(g);
  sign.castShadow = false; ring.castShadow = false;
  g.userData.ring = ring;
  g.userData.sign = sign;
  return g;
}

export function buildToolbox(icon) {
  const g = new THREE.Group();
  const red = phys(0xe0241c, { roughness: 0.3, clearcoat: 1, metalness: 0.2 });
  const box = new THREE.Mesh(new RoundedBoxGeometry(0.7, 0.36, 0.38, 2, 0.04), red);
  box.position.y = 0.2;
  const lid = new THREE.Mesh(new RoundedBoxGeometry(0.72, 0.06, 0.4, 2, 0.02), phys(0xb3170c));
  lid.position.y = 0.4;
  const handle = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.025, 8, 16, Math.PI), std(0x111111));
  handle.position.y = 0.43;
  const latch = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.05, 0.02), std(0xc9ccd2, { metalness: 1, roughness: 0.3 }));
  latch.position.set(0, 0.36, 0.195);
  g.add(box, lid, handle, latch);
  const iconSprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: canvasTexture(128, 128, (c, w, h) => {
      c.fillStyle = 'rgba(10,14,26,0.85)'; c.beginPath(); c.arc(w / 2, h / 2, 60, 0, 7); c.fill();
      c.strokeStyle = '#ffcc4d'; c.lineWidth = 6; c.stroke();
      c.font = '70px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(icon, w / 2, h / 2 + 4);
    }), depthWrite: false, transparent: true
  }));
  iconSprite.scale.setScalar(0.75);
  iconSprite.position.y = 1.15;
  g.add(iconSprite);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.5, 3, 20, 1, true), new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.2, 0.3), transparent: true, opacity: 0.18, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
  beam.position.y = 1.5;
  g.add(beam);
  box.castShadow = lid.castShadow = true;
  return g;
}

// ------------------------------------------------------------------ fire station (start menu)
export function brickTexture(w = 1024, h = 512) {
  return canvasTexture(w, h, (c) => {
    c.fillStyle = '#5a1e16'; c.fillRect(0, 0, w, h);
    const bh = 32, bw = 84;
    for (let y = 0; y < h; y += bh) {
      for (let x = -((y / bh) % 2) * bw / 2; x < w; x += bw) {
        c.fillStyle = `hsl(${rand(4, 14)}, ${rand(45, 60)}%, ${rand(26, 36)}%)`;
        c.fillRect(x + 3, y + 3, bw - 6, bh - 6);
      }
    }
  });
}

export function buildFireTruck() {
  const g = new THREE.Group();
  const red = phys(0xd3101a, { roughness: 0.25, clearcoat: 1, metalness: 0.2 });
  const white = phys(0xf2f2f2, { roughness: 0.3 });
  const chrome = std(0xd0d4da, { metalness: 1, roughness: 0.2 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x1a2533, roughness: 0.05, metalness: 0.5, clearcoat: 1 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(2.4, 2.0, 4.6, 3, 0.12), red);
  body.position.set(0, 1.55, -0.8);
  const cab = new THREE.Mesh(new RoundedBoxGeometry(2.4, 1.7, 1.8, 3, 0.18), red);
  cab.position.set(0, 1.4, 2.3);
  const win = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.75, 0.1, 2, 0.05), glass);
  win.position.set(0, 1.85, 3.17);
  win.rotation.x = -0.12;
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.43, 0.18, 6.4), white);
  stripe.position.set(0, 1.0, 0.1);
  const bumper = new THREE.Mesh(new RoundedBoxGeometry(2.5, 0.3, 0.3, 2, 0.08), chrome);
  bumper.position.set(0, 0.55, 3.2);
  g.add(body, cab, win, stripe, bumper);
  // ladder on the roof
  const ladder = new THREE.Group();
  for (const sx of [-0.5, 0.5]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 4.6), chrome); rail.position.x = sx; ladder.add(rail); }
  for (let i = 0; i < 12; i++) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 1, 6), chrome); r.rotation.z = Math.PI / 2; r.position.z = -2.2 + i * 0.4; ladder.add(r); }
  ladder.position.set(0, 2.65, -0.6);
  g.add(ladder);
  // blue lights
  const blues = [];
  for (const sx of [-0.8, 0.8]) {
    const l = new THREE.Mesh(new RoundedBoxGeometry(0.5, 0.2, 0.3, 2, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.5, 4) }));
    l.position.set(sx, 2.35, 2.5);
    g.add(l);
    blues.push(l);
  }
  // wheels
  const tire = std(0x111111, { roughness: 0.9 });
  for (const z of [2.2, -0.6, -2.2]) for (const sx of [-1.15, 1.15]) {
    const w = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 20), tire);
    w.rotation.z = Math.PI / 2;
    w.position.set(sx, 0.55, z);
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.28, 0.42, 12), chrome);
    hub.rotation.z = Math.PI / 2;
    hub.position.copy(w.position);
    g.add(w, hub);
  }
  // side lettering
  const side = textTex('DANNY 1-12', { w: 1024, h: 200, color: '#ffffff', font: '900 120px "Arial Black", Arial' });
  for (const sx of [-1, 1]) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(3.2, 0.62), new THREE.MeshBasicMaterial({ map: side, transparent: true }));
    p.position.set(sx * 1.215, 1.7, -0.8);
    p.rotation.y = sx * Math.PI / 2;
    g.add(p);
    const logo = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.75), new THREE.MeshBasicMaterial({ map: canvasTexture(128, 128, (c, w, h) => drawBrand(c, 4, 4, w - 8, h - 8)), transparent: true }));
    logo.position.set(sx * 1.215, 1.45, 2.3);
    logo.rotation.y = sx * Math.PI / 2;
    g.add(logo);
  }
  shadow(g);
  return { group: g, blues };
}

export function buildFireStation() {
  const g = new THREE.Group();
  const bricks = brickTexture();
  bricks.wrapS = bricks.wrapT = THREE.RepeatWrapping;
  const brickMat = new THREE.MeshStandardMaterial({ map: bricks, roughness: 0.95 });
  const W = 16, H = 7;
  // facade with a big garage opening (built from pieces)
  const left = new THREE.Mesh(new THREE.BoxGeometry(4.5, H, 0.6), brickMat);
  left.position.set(-W / 2 + 2.25, H / 2, 0);
  const right = left.clone();
  right.position.x = W / 2 - 2.25;
  const topB = new THREE.Mesh(new THREE.BoxGeometry(7, 2.2, 0.6), brickMat);
  topB.position.set(0, H - 1.1, 0);
  g.add(left, right, topB);
  for (const m of [left, right, topB]) { m.material = brickMat.clone(); m.material.map = bricks.clone(); m.material.map.repeat.set(m.geometry.parameters.width / 6, m.geometry.parameters.height / 3); m.material.map.needsUpdate = true; }
  // gable roof
  const roofShape = new THREE.Shape();
  roofShape.moveTo(-W / 2 - 0.4, 0); roofShape.lineTo(0, 2.6); roofShape.lineTo(W / 2 + 0.4, 0); roofShape.closePath();
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(roofShape, { depth: 0.8, bevelEnabled: false }), std(0x2a2d33, { roughness: 0.8 }));
  roof.position.set(0, H, -0.4);
  g.add(roof);
  // dark garage interior
  const inside = new THREE.Mesh(new THREE.BoxGeometry(7, H - 2.2, 8), new THREE.MeshStandardMaterial({ color: 0x15171c, roughness: 1, side: THREE.BackSide }));
  inside.position.set(0, (H - 2.2) / 2, -4);
  g.add(inside);
  // roller door (animated up)
  const doorTex = canvasTexture(256, 256, (c, w, h) => {
    c.fillStyle = '#c9ccd2'; c.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) { c.fillStyle = '#9aa0a8'; c.fillRect(0, y, w, 3); }
  });
  doorTex.wrapS = doorTex.wrapT = THREE.RepeatWrapping;
  doorTex.repeat.set(1, 3);
  const door = new THREE.Mesh(new THREE.PlaneGeometry(7, H - 2.2), new THREE.MeshStandardMaterial({ map: doorTex, metalness: 0.6, roughness: 0.4 }));
  door.position.set(0, (H - 2.2) / 2, 0.05);
  g.add(door);
  // sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(9, 1.4), new THREE.MeshBasicMaterial({
    map: canvasTexture(1400, 220, (c, w, h) => {
      c.fillStyle = '#b3121b'; roundRect(c, 0, 0, w, h, 30); c.fill();
      c.strokeStyle = '#ffffff'; c.lineWidth = 10; roundRect(c, 10, 10, w - 20, h - 20, 24); c.stroke();
      drawBrand(c, 40, 34, 150, 150);
      c.fillStyle = '#ffffff'; c.font = '900 120px "Arial Black", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('FEUERWACHE', w / 2 + 70, h / 2 + 6);
    }), color: new THREE.Color(1.5, 1.5, 1.5)
  }));
  sign.position.set(0, H + 0.9, 0.5);
  g.add(sign);
  const num = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.3), new THREE.MeshBasicMaterial({ map: textTex('112', { w: 256, h: 128, color: '#ffffff', font: '900 96px "Arial Black", Arial', bg: '#1b2640' }) }));
  num.position.set(-W / 2 + 2.25, 4.8, 0.31);
  g.add(num);
  const num2 = num.clone();
  num2.material = new THREE.MeshBasicMaterial({ map: textTex('DANNY', { w: 512, h: 160, color: '#e4ff3a', font: '900 100px "Arial Black", Arial', bg: '#1b2640' }) });
  num2.position.x = W / 2 - 2.25;
  g.add(num2);
  // blue lamps on the facade
  const lamps = [];
  for (const sx of [-4.2, 4.2]) {
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.3, 16, 12), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.5, 4) }));
    lamp.position.set(sx, H - 0.2, 0.5);
    g.add(lamp);
    lamps.push(lamp);
  }
  shadow(g);
  return { group: g, door, lamps, doorH: H - 2.2 };
}
