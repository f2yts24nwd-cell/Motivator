import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { findOption } from '../../hub/avatar.js';

// Realistic-proportion people (about 7.5 heads tall) built from smooth primitives.
// The same parts drive two things:
//  - the player: a real joint hierarchy (hips, knees, shoulders, elbows) animated on the CPU
//  - the crowd: one merged geometry per variant, instanced, animated in the vertex shader
// Facing +z, feet on y = 0, +x is the character's left.

export const SLOT = { skin: 0, hair: 1, top: 2, bottom: 3, shoes: 4, shirt: 5, accent: 6 };
// part ids: 0 body, 1/2 thigh L/R, 3/4 shin L/R, 5/6 upper arm L/R, 7/8 forearm L/R
const PIV = { hip: [0.93, 0], knee: [0.5, 0.015], shoulder: [1.42, 0], elbow: [1.15, -0.01] };

function capsuleBetween(a, b, r, segs = 7) {
  const len = a.distanceTo(b);
  const g = new THREE.CapsuleGeometry(r, Math.max(0.001, len - r * 0.6), 2, segs);
  const mid = a.clone().add(b).multiplyScalar(0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  g.applyQuaternion(q);
  g.translate(mid.x, mid.y, mid.z);
  return g;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const at = (g, x, y, z, sx = 1, sy = 1, sz = 1, rx = 0, ry = 0, rz = 0) => { g.scale(sx, sy, sz); g.rotateX(rx); g.rotateY(ry); g.rotateZ(rz); g.translate(x, y, z); return g; };

/**
 * opts: { female, skirt, shorts, sleeveless, hair: 'kurz'|'lang'|'dutt'|'locken'|'glatze'|'scheitel', suit, tie, build (0.9..1.1) }
 * returns [{ geo, part, slot }]
 */
export function humanParts(o = {}) {
  const P = [];
  const add = (geo, part, slot) => { P.push({ geo: geo.index ? geo.toNonIndexed() : geo, part, slot }); };
  const f = !!o.female, b = o.build || 1;
  const sh = f ? 0.17 : 0.2 * b; // shoulder half width
  // ---- legs
  for (const s of [1, -1]) {
    const L = s > 0 ? 0 : 1;
    const hx = s * (f ? 0.088 : 0.095);
    add(capsuleBetween(V(hx, 0.93, 0), V(hx * 0.97, 0.52, 0.01), f ? 0.07 : 0.078 * b), 1 + L, o.skirt ? SLOT.skin : SLOT.bottom);
    add(capsuleBetween(V(hx * 0.97, 0.5, 0.015), V(hx * 0.95, 0.1, -0.01), f ? 0.05 : 0.056), 3 + L, o.shorts || o.skirt ? SLOT.skin : SLOT.bottom);
    if (o.shorts) add(capsuleBetween(V(hx, 0.9, 0), V(hx * 0.97, 0.62, 0.01), 0.088 * b), 1 + L, SLOT.bottom);
    // foot
    add(at(new RoundedBoxGeometry(0.1, 0.075, 0.25, 1, 0.03), hx * 0.95, 0.04, 0.04), 3 + L, SLOT.shoes);
  }
  // ---- pelvis + torso
  add(at(new RoundedBoxGeometry(f ? 0.32 : 0.33 * b, 0.2, 0.21, 2, 0.07), 0, 0.96, 0), 0, SLOT.bottom);
  if (o.skirt) add(at(new THREE.CylinderGeometry(0.17, 0.25, 0.42, 16, 1, true), 0, 0.72, 0, 1, 1, 0.8), 0, SLOT.bottom);
  const torso = new THREE.CapsuleGeometry(0.15, 0.3, 4, 12);
  // taper: broad chest, narrower waist
  const tp = torso.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const k = f ? (y > 0.05 ? 1.08 : 0.86 + (y + 0.3) * 0.5) : (y > 0 ? 1.2 * b : 1.0 + (y + 0.3) * 0.6);
    tp.setX(i, tp.getX(i) * k);
    tp.setZ(i, tp.getZ(i) * (f && y > 0.02 && y < 0.18 ? 0.82 : 0.7));
  }
  torso.computeVertexNormals();
  add(at(torso, 0, 1.24, 0), 0, SLOT.top);
  // shirt V / tie (business look)
  if (o.suit) {
    add(at(new THREE.ConeGeometry(0.06, 0.2, 3), 0, 1.4, 0.11, 1, 1, 0.2, Math.PI, 0, 0), 0, SLOT.shirt);
    if (o.tie) add(at(new THREE.BoxGeometry(0.035, 0.26, 0.01), 0, 1.31, 0.122), 0, SLOT.accent);
  }
  // shoulders (rounded caps)
  for (const s of [1, -1]) add(at(new THREE.SphereGeometry(0.075, 8, 6), s * sh * 0.92, 1.41, 0), 0, SLOT.top);
  // ---- neck + head
  add(at(new THREE.CylinderGeometry(0.05, 0.058, 0.12, 12), 0, 1.53, 0.005), 0, SLOT.skin);
  const head = new THREE.SphereGeometry(0.105, 14, 10);
  const hp = head.attributes.position;
  for (let i = 0; i < hp.count; i++) { // jaw: narrower towards the chin
    const y = hp.getY(i);
    const k = y < -0.02 ? 1 - Math.min(0.28, (-0.02 - y) * 3.2) : 1;
    hp.setX(i, hp.getX(i) * k * 0.9); hp.setZ(i, hp.getZ(i) * (y < -0.02 ? 1 - (-0.02 - y) * 1.2 : 1));
  }
  head.computeVertexNormals();
  add(at(head, 0, 1.665, 0.01, 1, 1.12, 1), 0, SLOT.skin);
  add(at(new THREE.ConeGeometry(0.018, 0.045, 6), 0, 1.66, 0.112, 1, 1, 1, Math.PI / 2 + 0.3, 0, 0), 0, SLOT.skin); // nose
  for (const s of [1, -1]) add(at(new THREE.SphereGeometry(0.022, 8, 6), s * 0.094, 1.665, 0, 0.5, 1, 1), 0, SLOT.skin); // ears
  for (const s of [1, -1]) add(at(new THREE.SphereGeometry(0.011, 8, 6), s * 0.035, 1.685, 0.094), 0, SLOT.shoes); // eyes (dark)
  for (const s of [1, -1]) add(at(new THREE.BoxGeometry(0.035, 0.007, 0.01), s * 0.036, 1.71, 0.1), 0, SLOT.hair); // brows
  // hair
  const hs = o.hair || 'kurz';
  if (hs !== 'glatze') {
    add(at(new THREE.SphereGeometry(0.113, 12, 8, 0, Math.PI * 2, 0, hs === 'kurz' || hs === 'scheitel' ? Math.PI * 0.42 : Math.PI * 0.55), 0, 1.68, -0.005, 0.95, 1.12, 1.04), 0, SLOT.hair);
    add(at(new THREE.SphereGeometry(0.108, 10, 8), 0, 1.65, -0.03, 0.93, 1.05, 0.95), 0, SLOT.hair); // back of head
  }
  if (hs === 'lang') add(at(new RoundedBoxGeometry(0.22, 0.32, 0.08, 2, 0.04), 0, 1.52, -0.08), 0, SLOT.hair);
  if (hs === 'dutt') add(at(new THREE.SphereGeometry(0.055, 12, 8), 0, 1.75, -0.09), 0, SLOT.hair);
  if (hs === 'locken') for (let k = 0; k < 9; k++) { const a = (k / 9) * Math.PI * 2; add(at(new THREE.SphereGeometry(0.045, 8, 6), Math.cos(a) * 0.09, 1.74 + Math.sin(k * 2.1) * 0.02, Math.sin(a) * 0.08 - 0.01), 0, SLOT.hair); }
  // ---- arms
  for (const s of [1, -1]) {
    const L = s > 0 ? 0 : 1;
    const x0 = s * sh, x1 = s * (sh + 0.025), x2 = s * (sh + 0.035);
    add(capsuleBetween(V(x0, 1.42, 0), V(x1, 1.15, -0.01), f ? 0.042 : 0.05 * b), 5 + L, o.sleeveless ? SLOT.skin : SLOT.top);
    add(capsuleBetween(V(x1, 1.15, -0.01), V(x2, 0.9, 0.0), f ? 0.036 : 0.042), 7 + L, o.sleeveless || o.shortSleeve ? SLOT.skin : SLOT.top);
    if (o.suit) add(at(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 10), x2, 0.9, 0), 7 + L, SLOT.shirt); // cuff
    add(at(new THREE.SphereGeometry(0.042, 7, 5), x2, 0.84, 0.01, 0.8, 1.25, 0.95), 7 + L, SLOT.skin); // hand
  }
  return P;
}

// ------------------------------------------------------------------ player rig
const matCache = new Map();
function material(color, kind) {
  const key = kind + color;
  if (!matCache.has(key)) {
    const c = new THREE.Color(color);
    matCache.set(key, kind === 'skin'
      ? new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xff8a7a), sheenRoughness: 0.6 })
      : kind === 'hair' ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.45, metalness: 0.05 })
        : kind === 'shoes' ? new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.3, clearcoat: 0.6 })
          : new THREE.MeshStandardMaterial({ color: c, roughness: 0.82 }));
  }
  return matCache.get(key);
}
const colorOf = (cat, id, fb) => findOption(cat, id)?.color ?? fb;

/** Player built from the hub avatar settings (Kleiderschrank) */
export function buildPlayerRig(cfg) {
  const female = cfg.top === 'kostuem' || cfg.bottom === 'rock' || cfg.hair === 'lang' || cfg.hair === 'dutt';
  const parts = humanParts({ female, skirt: cfg.bottom === 'rock', suit: true, tie: cfg.acc === 'krawatte', hair: cfg.hair });
  const colors = {
    [SLOT.skin]: [colorOf('skin', cfg.skin, 0xe0b08f), 'skin'],
    [SLOT.hair]: [colorOf('hairColor', cfg.hairColor, 0x4a2f1c), 'hair'],
    [SLOT.top]: [colorOf('suit', cfg.suit, 0x1f2c52), 'cloth'],
    [SLOT.bottom]: [colorOf('suit', cfg.suit, 0x1f2c52), 'cloth'],
    [SLOT.shoes]: [cfg.shoes === 'loafer' ? 0x5a3418 : 0x111111, 'shoes'],
    [SLOT.shirt]: [0xf4f4f2, 'cloth'],
    [SLOT.accent]: [colorOf('accent', cfg.accent, 0x50af30), 'cloth']
  };
  const root = new THREE.Group();
  const hips = new THREE.Group(); hips.position.y = PIV.hip[0]; root.add(hips);
  const body = new THREE.Group(); body.position.y = -PIV.hip[0]; hips.add(body); // body parts keep absolute coords
  const mk = (py, pz, parent, oy = 0, oz = 0) => { const g = new THREE.Group(); g.position.set(0, py - oy, pz - oz); parent.add(g); return g; };
  const J = {};
  // spine pivot at the waist so the torso can lean
  const spine = new THREE.Group(); spine.position.y = 1.05; body.add(spine);
  const upper = new THREE.Group(); upper.position.y = -1.05; spine.add(upper);
  J.thigh = [mk(PIV.hip[0], PIV.hip[1], body), mk(PIV.hip[0], PIV.hip[1], body)];
  J.shin = [mk(PIV.knee[0], PIV.knee[1], J.thigh[0], PIV.hip[0], PIV.hip[1]), mk(PIV.knee[0], PIV.knee[1], J.thigh[1], PIV.hip[0], PIV.hip[1])];
  J.upper = [mk(PIV.shoulder[0], PIV.shoulder[1], upper), mk(PIV.shoulder[0], PIV.shoulder[1], upper)];
  J.fore = [mk(PIV.elbow[0], PIV.elbow[1], J.upper[0], PIV.shoulder[0], PIV.shoulder[1]), mk(PIV.elbow[0], PIV.elbow[1], J.upper[1], PIV.shoulder[0], PIV.shoulder[1])];
  // each joint group needs the absolute offset of its pivot to place absolute-coordinate geometry
  const offset = { 1: PIV.hip, 2: PIV.hip, 3: PIV.knee, 4: PIV.knee, 5: PIV.shoulder, 6: PIV.shoulder, 7: PIV.elbow, 8: PIV.elbow };
  const parent = { 1: J.thigh[0], 2: J.thigh[1], 3: J.shin[0], 4: J.shin[1], 5: J.upper[0], 6: J.upper[1], 7: J.fore[0], 8: J.fore[1] };
  // merge per (part, slot)
  const buckets = new Map();
  for (const p of parts) { const k = p.part + ':' + p.slot; if (!buckets.has(k)) buckets.set(k, []); buckets.get(k).push(p.geo); }
  for (const [k, geos] of buckets) {
    const [part, slot] = k.split(':').map(Number);
    const g = mergeGeometries(geos.map((x) => { const y = x.clone(); for (const a of Object.keys(y.attributes)) if (a !== 'position' && a !== 'normal') y.deleteAttribute(a); return y; }));
    const legOrHead = part === 0 ? null : offset[part];
    if (legOrHead) g.translate(0, -legOrHead[0], -legOrHead[1]);
    const [c, kind] = colors[slot];
    const m = new THREE.Mesh(g, material(c, kind));
    m.castShadow = true; m.receiveShadow = true;
    if (part === 0) {
      // legs-region parts (pelvis, skirt) stay on the body, everything above the waist on the spine
      g.computeBoundingBox();
      (g.boundingBox.min.y > 1.0 ? upper : body).add(m);
    } else parent[part].add(m);
  }
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.45, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2; shadow.position.y = 0.015;
  root.add(shadow);
  return { root, hips, spine, J };
}

/** pose the player rig. s: { phase, amount (0 idle .. 1 walk .. 1.8 sprint), air, t } */
export function animateRig(rig, s) {
  const { J } = rig;
  const a = Math.min(1.8, s.amount);
  const run = Math.max(0, a - 1);
  const ph = s.phase;
  const sw = Math.sin(ph) * (0.42 + run * 0.35) * Math.min(1, a);
  for (const i of [0, 1]) {
    const side = i === 0 ? 1 : -1;
    const legA = -sw * side;
    const knee = Math.min(1, a) * (0.35 + run * 0.9) * Math.max(0, Math.cos(ph + (i === 0 ? 0 : Math.PI))) + 0.05;
    J.thigh[i].rotation.x = s.air ? -0.6 + i * 0.5 : legA;
    J.shin[i].rotation.x = s.air ? 0.9 - i * 0.3 : knee;
    J.upper[i].rotation.x = s.air ? -0.4 : sw * side * (0.9 + run * 0.3);
    J.upper[i].rotation.z = side * (0.06 + run * 0.05);
    J.fore[i].rotation.x = -(0.2 + a * 0.25 + run * 0.8);
  }
  const breathe = Math.sin(s.t * 2.2) * 0.008 * (1 - Math.min(1, a));
  rig.hips.position.y = PIV.hip[0] + Math.abs(Math.cos(ph)) * 0.045 * Math.min(1, a) + run * 0.02 + breathe;
  rig.spine.rotation.x = 0.04 + run * 0.18;
  rig.spine.rotation.y = Math.sin(ph) * 0.08 * Math.min(1, a);
  rig.hips.rotation.y = -Math.sin(ph) * 0.06 * Math.min(1, a);
}

// ------------------------------------------------------------------ instanced crowd (GPU animation)
const CROWD_GLSL = /* glsl */`
attribute float part; attribute float slot;
attribute vec3 aSkin; attribute vec3 aHair; attribute vec3 aTop; attribute vec3 aBottom; attribute vec3 aShoe;
attribute vec2 aAnim;
uniform float uTime;
mat3 rx(float a) { float c = cos(a), s = sin(a); return mat3(1.0, 0.0, 0.0, 0.0, c, s, 0.0, -s, c); }
void crowdAnim(inout vec3 p, inout vec3 n) {
  float amp = aAnim.y;
  float ph = uTime * 7.0 + aAnim.x;
  float left = mod(part, 2.0); // odd ids are the left side
  float side = left > 0.5 ? 1.0 : -1.0;
  float sw = sin(ph) * 0.45 * amp * side;
  if (part >= 0.5 && part <= 4.5) {
    if (part >= 2.5) {
      float k = amp * 0.6 * max(0.0, cos(ph + (left > 0.5 ? 0.0 : 3.14159)));
      mat3 R = rx(k);
      p = R * (p - vec3(0.0, ${PIV.knee[0]}, ${PIV.knee[1]})) + vec3(0.0, ${PIV.knee[0]}, ${PIV.knee[1]}); n = R * n;
    }
    mat3 R = rx(-sw);
    p = R * (p - vec3(0.0, ${PIV.hip[0]}, 0.0)) + vec3(0.0, ${PIV.hip[0]}, 0.0); n = R * n;
  } else if (part >= 4.5) {
    if (part >= 6.5) {
      mat3 R = rx(-0.25 - 0.2 * amp);
      p = R * (p - vec3(0.0, ${PIV.elbow[0]}, ${PIV.elbow[1]})) + vec3(0.0, ${PIV.elbow[0]}, ${PIV.elbow[1]}); n = R * n;
    }
    mat3 R = rx(sw * 0.8);
    p = R * (p - vec3(0.0, ${PIV.shoulder[0]}, 0.0)) + vec3(0.0, ${PIV.shoulder[0]}, 0.0); n = R * n;
  }
  p.y += abs(cos(ph)) * 0.035 * amp;
}
`;
function patch(shader, uniforms, withColor) {
  shader.uniforms.uTime = uniforms.uTime;
  shader.vertexShader = CROWD_GLSL + shader.vertexShader;
  if (withColor) {
    shader.vertexShader = shader.vertexShader
      .replace('#include <beginnormal_vertex>', 'vec3 objectNormal = normal; vec3 animPos = position; crowdAnim(animPos, objectNormal);')
      .replace('#include <begin_vertex>', 'vec3 transformed = animPos;');
  } else {
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', 'vec3 transformed = position; vec3 dn = vec3(0.0, 1.0, 0.0); crowdAnim(transformed, dn);');
  }
  if (withColor) {
    shader.vertexShader = shader.vertexShader.replace('#include <color_vertex>', `#include <color_vertex>
      vColor = slot < 0.5 ? aSkin : slot < 1.5 ? aHair : slot < 2.5 ? aTop : slot < 3.5 ? aBottom : slot < 4.5 ? aShoe : slot < 5.5 ? vec3(0.92) : vec3(0.55, 0.08, 0.1);`);
  }
}

/** merged, instanced crowd mesh for one body variant */
export function crowdMesh(opts, count, uniforms) {
  const parts = humanParts(opts);
  const geos = parts.map(({ geo, part, slot }) => {
    const g = geo.clone();
    for (const a of Object.keys(g.attributes)) if (a !== 'position' && a !== 'normal') g.deleteAttribute(a);
    const n = g.attributes.position.count;
    g.setAttribute('part', new THREE.BufferAttribute(new Float32Array(n).fill(part), 1));
    g.setAttribute('slot', new THREE.BufferAttribute(new Float32Array(n).fill(slot), 1));
    g.setAttribute('color', new THREE.BufferAttribute(new Float32Array(n * 3).fill(1), 3));
    return g;
  });
  const geo = mergeGeometries(geos);
  for (const k of ['aSkin', 'aHair', 'aTop', 'aBottom', 'aShoe']) geo.setAttribute(k, new THREE.InstancedBufferAttribute(new Float32Array(count * 3), 3));
  geo.setAttribute('aAnim', new THREE.InstancedBufferAttribute(new Float32Array(count * 2), 2));
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.75 });
  mat.onBeforeCompile = (s) => patch(s, uniforms, true);
  mat.customProgramCacheKey = () => 'crowd';
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  const depth = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking });
  depth.onBeforeCompile = (s) => patch(s, uniforms, false);
  depth.customProgramCacheKey = () => 'crowd-depth';
  mesh.customDepthMaterial = depth;
  mesh.castShadow = true;
  mesh.frustumCulled = false;
  return mesh;
}
