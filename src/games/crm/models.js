import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { drawBrand } from '../../core/gfx.js';
import { MODULES, LORD_LOOK } from './content.js';

// Voxel models for "Das CRM-Königreich": pixel-art textures, Lord CRM, the traders,
// the night monsters, feature blocks, resource nodes and legacy junk.
// Everything is built from boxes with procedurally drawn 16×16 textures (original art).

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const PIX = '"Courier New", ui-monospace, Menlo, monospace';

// ------------------------------------------------------------------ texture helpers
const texCache = new Map();
/** Pixel texture with nearest filtering (crisp voxel look). */
export function pixelTex(key, w, h, draw) {
  if (key && texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.magFilter = THREE.NearestFilter;
  t.minFilter = THREE.NearestMipmapLinearFilter;
  t.generateMipmaps = true;
  t.anisotropy = 4;
  if (key) texCache.set(key, t);
  return t;
}
/** Smooth canvas texture (text, signs). */
export function smoothTex(key, w, h, draw) {
  if (key && texCache.has(key)) return texCache.get(key);
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d');
  draw(g, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (key) texCache.set(key, t);
  return t;
}

// deterministic noise so textures look the same every run
let seed = 7;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };
const shade = (hex, f) => {
  const c = new THREE.Color(hex);
  c.r = Math.min(1, c.r * f); c.g = Math.min(1, c.g * f); c.b = Math.min(1, c.b * f);
  return `#${c.getHexString()}`;
};
function noisy(g, w, h, base, spread = 0.18, px = 1) {
  for (let y = 0; y < h; y += px) for (let x = 0; x < w; x += px) {
    g.fillStyle = shade(base, 1 - spread / 2 + rnd() * spread);
    g.fillRect(x, y, px, px);
  }
}

// ------------------------------------------------------------------ terrain textures (16×16)
export const TERRAIN = {
  grassTop: () => pixelTex('grassTop', 16, 16, (g) => {
    noisy(g, 16, 16, '#5fae3c', 0.32);
    for (let i = 0; i < 10; i++) { g.fillStyle = rnd() < 0.5 ? '#7cc94f' : '#4a9230'; g.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1); }
  }),
  grassSide: () => pixelTex('grassSide', 16, 16, (g) => {
    noisy(g, 16, 16, '#8a5a36', 0.3);
    for (let x = 0; x < 16; x++) {
      const d = 3 + Math.floor(rnd() * 3);
      for (let y = 0; y < d; y++) { g.fillStyle = shade('#5fae3c', 0.85 + rnd() * 0.3); g.fillRect(x, y, 1, 1); }
    }
  }),
  dirt: () => pixelTex('dirt', 16, 16, (g) => {
    noisy(g, 16, 16, '#8a5a36', 0.34);
    for (let i = 0; i < 6; i++) { g.fillStyle = '#a8794e'; g.fillRect(Math.floor(rnd() * 15), Math.floor(rnd() * 15), 2, 1); }
  }),
  stone: () => pixelTex('stone', 16, 16, (g) => {
    noisy(g, 16, 16, '#7d8590', 0.26);
    g.fillStyle = '#5d646d';
    for (let i = 0; i < 5; i++) { const x = Math.floor(rnd() * 13), y = Math.floor(rnd() * 15); g.fillRect(x, y, 3, 1); g.fillRect(x + 2, y + 1, 1, 1); }
  }),
  deepStone: () => pixelTex('deepStone', 16, 16, (g) => {
    noisy(g, 16, 16, '#4b4f5c', 0.3);
    g.fillStyle = '#7a5ed6';
    for (let i = 0; i < 3; i++) g.fillRect(Math.floor(rnd() * 15), Math.floor(rnd() * 15), 1, 1);
  }),
  path: () => pixelTex('path', 16, 16, (g) => {
    noisy(g, 16, 16, '#b49a6c', 0.3);
    g.fillStyle = '#8f7a54';
    for (let i = 0; i < 7; i++) g.fillRect(Math.floor(rnd() * 15), Math.floor(rnd() * 15), 2, 2);
  }),
  brick: () => pixelTex('brick', 16, 16, (g) => {
    g.fillStyle = '#6f7682'; g.fillRect(0, 0, 16, 16);
    for (let row = 0; row < 4; row++) {
      const off = row % 2 ? 4 : 0;
      for (let b = -1; b < 3; b++) {
        const x = b * 8 + off;
        g.fillStyle = shade('#a7aeb8', 0.85 + rnd() * 0.25);
        g.fillRect(x + 1, row * 4 + 1, 7, 3);
        g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x + 1, row * 4 + 1, 7, 1);
      }
    }
  }),
  plank: () => pixelTex('plank', 16, 16, (g) => {
    for (let row = 0; row < 4; row++) {
      g.fillStyle = shade('#a5713f', 0.85 + rnd() * 0.25); g.fillRect(0, row * 4, 16, 4);
      g.fillStyle = '#6b4423'; g.fillRect(0, row * 4 + 3, 16, 1);
      g.fillRect((row * 7) % 16, row * 4, 1, 3);
    }
  }),
  log: () => pixelTex('log', 16, 16, (g) => {
    noisy(g, 16, 16, '#6b4a2b', 0.3);
    g.fillStyle = '#4e331c';
    for (let x = 1; x < 16; x += 4) g.fillRect(x, 0, 1, 16);
  }),
  leaves: () => pixelTex('leaves', 16, 16, (g) => {
    noisy(g, 16, 16, '#3f8f3a', 0.45);
    g.fillStyle = '#2c6b2a';
    for (let i = 0; i < 18; i++) g.fillRect(Math.floor(rnd() * 16), Math.floor(rnd() * 16), 1, 1);
  }),
  sand: () => pixelTex('sand', 16, 16, (g) => noisy(g, 16, 16, '#e3cf94', 0.18))
};


// ------------------------------------------------------------------ static batching
/**
 * Merges meshes below `root` that share a material into one mesh per material (fewer draw calls).
 * shallow: only direct children of root (for animated rigs). exclude(o): keep o (and its subtree) as is.
 */
export function bake(root, { shallow = false, exclude = null } = {}) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const groups = new Map();
  const victims = [];
  const skip = new Set();
  root.traverse((o) => {
    if (o === root) return;
    if (skip.has(o.parent) || (exclude && exclude(o))) { skip.add(o); return; }
    if (shallow && o.parent !== root) return;
    if (!o.isMesh || o.isInstancedMesh || o.isSkinnedMesh || Array.isArray(o.material) || o.children.length || !o.visible) return;
    const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    g.applyMatrix4(new THREE.Matrix4().multiplyMatrices(inv, o.matrixWorld));
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal' && k !== 'uv') g.deleteAttribute(k);
    if (!g.attributes.uv || !g.attributes.normal) return;
    g.morphAttributes = {};
    if (!groups.has(o.material)) groups.set(o.material, []);
    groups.get(o.material).push({ g, cast: o.castShadow, recv: o.receiveShadow, ud: o.userData });
    victims.push(o);
  });
  const keep = new Set();
  for (const [mat, list] of groups) {
    if (list.length < 2) { keep.add(mat); continue; }
    const merged = mergeGeometries(list.map((x) => x.g), false);
    if (!merged) { keep.add(mat); continue; }
    const m = new THREE.Mesh(merged, mat);
    m.castShadow = list.some((x) => x.cast);
    m.receiveShadow = list.some((x) => x.recv);
    Object.assign(m.userData, list[0].ud);
    root.add(m);
  }
  for (const o of victims) if (!keep.has(o.material)) o.parent.remove(o);
  return root;
}
/** Bakes every rigid part of a voxel rig separately (limbs stay animatable). */
export function bakeRig(...groups) { for (const g of groups) if (g) bake(g, { shallow: true }); }

// ------------------------------------------------------------------ voxel people
const boxMatCache = new Map();
/** Shared standard materials (same look → same material → can be batched). */
const boxMat = (opts) => {
  const k = Object.entries(opts).map(([a, b]) => `${a}:${b && b.isTexture ? b.uuid : b}`).join('|');
  if (!boxMatCache.has(k)) boxMatCache.set(k, new THREE.MeshStandardMaterial({ roughness: 0.85, metalness: 0, ...opts }));
  return boxMatCache.get(k);
};
function box(w, h, d, mat, x = 0, y = 0, z = 0, parent) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  m.castShadow = true;
  m.receiveShadow = true;
  if (parent) parent.add(m);
  return m;
}

/** 8×8 pixel face on a 64×64 canvas. */
function faceTex(key, { skin, eyes = '#1a1a2a', mouth = '#7a2f2f', beard = null, brows = null, glasses = null, blush = true }) {
  return pixelTex(key, 8, 8, (g) => {
    g.fillStyle = skin; g.fillRect(0, 0, 8, 8);
    g.fillStyle = shade(skin, 0.92); g.fillRect(0, 0, 8, 1);
    // eyes (white + pupil)
    g.fillStyle = '#ffffff'; g.fillRect(1, 3, 2, 1); g.fillRect(5, 3, 2, 1);
    g.fillStyle = eyes; g.fillRect(2, 3, 1, 1); g.fillRect(5, 3, 1, 1);
    if (brows) { g.fillStyle = brows; g.fillRect(1, 2, 2, 1); g.fillRect(5, 2, 2, 1); }
    if (glasses) { g.fillStyle = glasses; g.fillRect(1, 3, 6, 1); g.fillRect(0, 3, 1, 1); g.fillRect(7, 3, 1, 1); }
    if (blush) { g.fillStyle = 'rgba(255,90,90,0.45)'; g.fillRect(1, 4, 1, 1); g.fillRect(6, 4, 1, 1); }
    g.fillStyle = shade(skin, 0.8); g.fillRect(3, 4, 2, 1); // nose
    if (beard) {
      g.fillStyle = beard; g.fillRect(0, 5, 8, 3); g.fillRect(0, 4, 1, 1); g.fillRect(7, 4, 1, 1);
      g.fillStyle = mouth; g.fillRect(3, 5, 2, 1);
    } else {
      g.fillStyle = mouth; g.fillRect(3, 6, 2, 1); g.fillRect(2, 5, 1, 1); g.fillRect(5, 5, 1, 1);
    }
  });
}

/**
 * Generic blocky person. Returns parts for animation.
 * Height ≈ 2.1 units at scale 1. Head 0.62, body 0.8, legs 0.75.
 */
export function buildVoxelPerson({ key, skin, shirt, pants, shoes = '#2b2b2b', hair = null, face = {}, apron = null }) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const skinM = boxMat({ color: skin });
  const shirtM = boxMat({ color: shirt });
  const pantsM = boxMat({ color: pants });
  const shoeM = boxMat({ color: shoes });
  // legs
  const legs = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.17, 0.78, 0);
    body.add(p);
    box(0.3, 0.62, 0.32, pantsM, 0, -0.33, 0, p);
    box(0.32, 0.14, 0.38, shoeM, 0, -0.7, 0.03, p);
    return p;
  });
  // torso
  const torso = box(0.72, 0.82, 0.42, shirtM, 0, 1.2, 0, body);
  if (apron) box(0.6, 0.7, 0.04, boxMat({ color: apron }), 0, 1.12, 0.23, body);
  // arms
  const arms = [-1, 1].map((s) => {
    const p = new THREE.Group();
    p.position.set(s * 0.5, 1.55, 0);
    body.add(p);
    box(0.26, 0.6, 0.28, shirtM, 0, -0.25, 0, p);
    box(0.24, 0.18, 0.26, skinM, 0, -0.63, 0, p);
    return p;
  });
  // head
  const neck = new THREE.Group();
  neck.position.set(0, 1.62, 0);
  body.add(neck);
  const fTex = faceTex(`face-${key}`, { skin, ...face });
  const head = box(0.64, 0.64, 0.64, skinM, 0, 0.33, 0, neck);
  const facePlane = new THREE.Mesh(new THREE.PlaneGeometry(0.64, 0.64), boxMat({ map: fTex }));
  facePlane.position.set(0, 0.33, 0.322);
  neck.add(facePlane);
  if (hair) {
    const hm = boxMat({ color: hair });
    box(0.68, 0.16, 0.68, hm, 0, 0.66, 0, neck);
    box(0.68, 0.42, 0.12, hm, 0, 0.42, -0.29, neck);
  }
  // blob shadow
  const sh = new THREE.Mesh(new THREE.CircleGeometry(0.45, 20), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  sh.rotation.x = -Math.PI / 2;
  sh.position.y = 0.02;
  root.add(sh);
  return { root, body, legs, arms, neck, head, torso };
}

// ------------------------------------------------------------------ Lord CRM
export function buildLord() {
  const L = LORD_LOOK;
  const p = buildVoxelPerson({
    key: 'lord', skin: L.skin, shirt: L.robe, pants: L.robe, shoes: '#3a1a10',
    face: { beard: L.beard, brows: '#d8d2c6', eyes: '#1d2a5a' }
  });
  const ermine = smoothTex('ermine', 64, 64, (g, w, h) => {
    g.fillStyle = L.trim; g.fillRect(0, 0, w, h);
    g.fillStyle = '#1a1a1a';
    for (let i = 0; i < 6; i++) { const x = (i % 3) * 22 + 8 + (i > 2 ? 10 : 0), y = i > 2 ? 40 : 14; g.fillRect(x, y, 4, 8); g.fillRect(x - 2, y + 2, 8, 3); }
  });
  const trimM = boxMat({ map: ermine });
  const goldM = new THREE.MeshStandardMaterial({ color: L.crown, metalness: 0.9, roughness: 0.25, emissive: 0x553300, emissiveIntensity: 0.25 });
  const gemM = new THREE.MeshStandardMaterial({ color: L.gem, emissive: L.gem, emissiveIntensity: 1.2, roughness: 0.2 });
  const redGem = new THREE.MeshStandardMaterial({ color: '#ff2a55', emissive: '#ff2a55', emissiveIntensity: 0.9 });
  const blueGem = new THREE.MeshStandardMaterial({ color: '#3d8bff', emissive: '#3d8bff', emissiveIntensity: 0.9 });
  // long robe skirt over the legs, ermine collar and hem
  box(0.86, 0.72, 0.52, boxMat({ color: L.robe }), 0, 0.55, 0, p.body);
  box(0.9, 0.12, 0.56, trimM, 0, 0.2, 0, p.body);
  box(0.84, 0.2, 0.5, trimM, 0, 1.56, 0, p.body);
  box(0.12, 0.8, 0.02, trimM, 0, 1.15, 0.22, p.body);
  // gold belt with X buckle
  box(0.76, 0.1, 0.46, goldM, 0, 0.95, 0, p.body);
  box(0.14, 0.14, 0.05, gemM, 0, 0.95, 0.24, p.body);
  // cape
  const cape = box(0.9, 1.45, 0.06, boxMat({ color: '#7a0b1f' }), 0, 0.88, -0.27, p.body);
  // beard hanging below the chin
  box(0.5, 0.3, 0.12, boxMat({ color: L.beard }), 0, 0.02, 0.3, p.neck);
  box(0.3, 0.18, 0.1, boxMat({ color: L.beard }), 0, -0.2, 0.3, p.neck);
  // crown
  const crown = new THREE.Group();
  crown.position.set(0, 0.7, 0);
  p.neck.add(crown);
  box(0.72, 0.16, 0.72, goldM, 0, 0, 0, crown);
  for (const [x, z] of [[-0.3, -0.3], [0.3, -0.3], [-0.3, 0.3], [0.3, 0.3], [0, 0.3], [0, -0.3], [-0.3, 0], [0.3, 0]]) box(0.12, 0.2, 0.12, goldM, x, 0.17, z, crown);
  box(0.14, 0.14, 0.04, gemM, 0, 0.02, 0.37, crown);
  box(0.1, 0.1, 0.04, redGem, -0.22, 0.02, 0.37, crown);
  box(0.1, 0.1, 0.04, blueGem, 0.22, 0.02, 0.37, crown);
  box(0.22, 0.12, 0.22, boxMat({ color: '#b3122e' }), 0, 0.12, 0, crown);
  // scepter in the right hand with a green X on top
  const scepter = new THREE.Group();
  scepter.position.set(0, -0.62, 0.12);
  p.arms[1].add(scepter);
  box(0.07, 1.1, 0.07, goldM, 0, 0.25, 0, scepter);
  const xTop = new THREE.Group();
  xTop.position.set(0, 0.9, 0);
  scepter.add(xTop);
  const xa = box(0.08, 0.36, 0.08, gemM, 0, 0, 0, xTop); xa.rotation.z = 0.7;
  const xb = box(0.08, 0.36, 0.08, gemM, 0, 0, 0, xTop); xb.rotation.z = -0.7;
  box(0.16, 0.16, 0.16, goldM, 0, -0.22, 0, xTop);
  p.arms[1].rotation.x = -0.5;
  p.root.scale.setScalar(1.22);
  bakeRig(p.body, p.neck, crown, scepter, xTop, ...p.legs, ...p.arms);
  return { ...p, crown, scepter, xTop, cape, gemM };
}

// ------------------------------------------------------------------ traders
const TRADER_LOOK = {
  mkt: { skin: '#f2c7a5', shirt: '#ff5fa8', pants: '#3a2b5a', hair: '#e8b13c', hat: 'beret', item: 'megaphone' },
  sal: { skin: '#e2b08a', shirt: '#1e3a6e', pants: '#1e2a44', hair: '#3b2a1e', hat: null, item: 'briefcase', tie: '#19c3ff' },
  svc: { skin: '#d9a07a', shirt: '#ffb000', pants: '#2f3b52', hair: '#6b4a2b', hat: 'cap', item: 'wrench' },
  com: { skin: '#c88b62', shirt: '#a46bff', pants: '#2a2340', hair: '#1a1416', hat: 'bun', item: 'cart' },
  core: { skin: '#f0c49a', shirt: '#4a4f5a', pants: '#2b2b2b', hair: '#8b3a1a', hat: null, item: 'hammer', apron: '#5a3a22', beard: '#8b3a1a' },
  rival: { skin: '#efd6c4', shirt: '#b8bfd6', pants: '#8e95ad', hair: '#d6d9e6', hat: null, item: 'cable', glasses: '#111' }
};

export function buildTrader(id) {
  const L = TRADER_LOOK[id];
  const p = buildVoxelPerson({ key: `tr-${id}`, skin: L.skin, shirt: L.shirt, pants: L.pants, hair: L.hair, apron: L.apron, face: { beard: L.beard || null, glasses: L.glasses || null } });
  const col = id === 'rival' ? '#b8bfd6' : MODULES[id]?.color || '#50af30';
  const accent = boxMat({ color: col });
  if (L.tie) box(0.1, 0.5, 0.03, boxMat({ color: L.tie }), 0, 1.22, 0.23, p.body);
  if (L.hat === 'beret') { const b = box(0.74, 0.14, 0.74, accent, 0.06, 0.72, 0, p.neck); b.rotation.z = -0.15; }
  if (L.hat === 'cap') { box(0.7, 0.18, 0.7, accent, 0, 0.72, 0, p.neck); box(0.5, 0.06, 0.3, accent, 0, 0.66, 0.42, p.neck); }
  if (L.hat === 'bun') box(0.3, 0.26, 0.3, boxMat({ color: L.hair }), 0, 0.82, -0.12, p.neck);
  // hand item
  const hand = new THREE.Group();
  hand.position.set(0, -0.68, 0.16);
  p.arms[1].add(hand);
  p.arms[1].rotation.x = -0.9;
  const metal = new THREE.MeshStandardMaterial({ color: 0xc9ced8, metalness: 0.8, roughness: 0.3 });
  if (L.item === 'megaphone') { const m = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.5, 8, 1, true), accent); m.rotation.x = Math.PI / 2; m.position.z = 0.25; hand.add(m); }
  if (L.item === 'briefcase') box(0.46, 0.34, 0.12, boxMat({ color: '#5a3a22' }), 0, -0.15, 0, hand);
  if (L.item === 'wrench') { box(0.08, 0.6, 0.08, metal, 0, 0.1, 0, hand); box(0.24, 0.12, 0.08, metal, 0, 0.42, 0, hand); }
  if (L.item === 'cart') { box(0.5, 0.3, 0.34, accent, 0, -0.1, 0.2, hand); box(0.08, 0.08, 0.36, metal, -0.2, -0.3, 0.2, hand); }
  if (L.item === 'hammer') { box(0.08, 0.6, 0.08, boxMat({ color: '#6b4a2b' }), 0, 0.1, 0, hand); box(0.36, 0.18, 0.2, metal, 0, 0.42, 0, hand); }
  if (L.item === 'cable') {
    const plug = box(0.18, 0.18, 0.26, boxMat({ color: '#e6e6e6' }), 0, 0, 0.1, hand);
    box(0.04, 0.04, 0.12, metal, -0.05, 0, 0.28, plug); box(0.04, 0.04, 0.12, metal, 0.05, 0, 0.28, plug);
  }
  bakeRig(p.body, p.neck, hand, ...p.legs, ...p.arms);
  return { ...p, hand };
}

// ------------------------------------------------------------------ feature blocks
const blockMats = new Map();
/** Materials for a feature block (cached). foreign: rival look. */
export function featureMaterials(f, foreign = false) {
  const key = `${f.id}-${foreign ? 'f' : 'n'}`;
  if (blockMats.has(key)) return blockMats.get(key);
  const base = foreign ? '#8e95ad' : f.id === 'fundament' ? '#2f6fd6' : MODULES[f.mod].color;
  const side = smoothTex(`blk-${key}`, 128, 128, (g, w, h) => {
    // pixel bevel
    const px = 8;
    for (let y = 0; y < h; y += px) for (let x = 0; x < w; x += px) {
      g.fillStyle = shade(base, 0.88 + ((x * 13 + y * 7) % 5) * 0.04);
      g.fillRect(x, y, px, px);
    }
    g.fillStyle = 'rgba(255,255,255,0.35)'; g.fillRect(0, 0, w, px); g.fillRect(0, 0, px, h);
    g.fillStyle = 'rgba(0,0,0,0.35)'; g.fillRect(0, h - px, w, px); g.fillRect(w - px, 0, px, h);
    if (f.id === 'fundament' && !foreign) {
      g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 4;
      for (let r = 1; r < 4; r++) { g.beginPath(); g.moveTo(px, r * 32); g.lineTo(w - px, r * 32); g.stroke(); }
    }
    if (foreign) {
      g.setLineDash([10, 8]); g.strokeStyle = '#ff3b5c'; g.lineWidth = 5; g.strokeRect(14, 14, w - 28, h - 28); g.setLineDash([]);
    }
    // tag text
    const t = f.tag;
    let fs = t.length > 5 ? 26 : t.length > 3 ? 32 : 44;
    g.font = `900 ${fs}px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = 'rgba(0,0,0,0.4)'; g.fillText(t, w / 2 + 3, h / 2 + 3);
    g.fillStyle = '#ffffff'; g.fillText(t, w / 2, h / 2);
    if (foreign) { g.font = `900 22px ${FONT}`; g.fillStyle = '#ffffff'; g.fillText('☁ FREMD', w / 2, h - 26); }
  });
  side.magFilter = THREE.NearestFilter;
  const m = new THREE.MeshStandardMaterial({ map: side, roughness: 0.55, metalness: 0.05, emissive: new THREE.Color(base), emissiveIntensity: 0.12, emissiveMap: side });
  blockMats.set(key, m);
  return m;
}
export const BLOCK = 1.1;
const blockGeo = new THREE.BoxGeometry(BLOCK, BLOCK, BLOCK);
export function buildFeatureBlock(f, foreign = false) {
  const m = new THREE.Mesh(blockGeo, featureMaterials(f, foreign));
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
}

// ------------------------------------------------------------------ resource nodes
export function buildOre() {
  const gems = [[2, 2], [9, 3], [5, 7], [12, 9], [3, 12], [10, 13]];
  const tex = pixelTex('ore', 16, 16, (g) => {
    noisy(g, 16, 16, '#7d8590', 0.26);
    for (const [x, y] of gems) {
      g.fillStyle = '#1f5fd6'; g.fillRect(x, y, 2, 2);
      g.fillStyle = '#8fc0ff'; g.fillRect(x, y, 1, 1);
    }
  });
  const emis = pixelTex('oreE', 16, 16, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, 16, 16);
    for (const [x, y] of gems) { g.fillStyle = '#3d8bff'; g.fillRect(x, y, 2, 2); }
  });
  const m = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: emis, emissive: 0x3d8bff, emissiveIntensity: 0.6, roughness: 0.7 });
  const grp = new THREE.Group();
  const main = box(1, 1, 1, m, 0, 0.5, 0, grp);
  const small = box(0.6, 0.6, 0.6, m, 0.5, 0.3, 0.45, grp);
  small.rotation.y = 0.4;
  return { group: bake(grp), mat: m };
}

export function buildCrystal() {
  const grp = new THREE.Group();
  const rock = box(1, 0.35, 1, new THREE.MeshStandardMaterial({ map: TERRAIN.stone(), roughness: 0.9 }), 0, 0.17, 0, grp);
  const mat = new THREE.MeshPhysicalMaterial({ color: 0x3ddc84, emissive: 0x1aa85a, emissiveIntensity: 0.9, roughness: 0.1, transmission: 0.2, thickness: 0.5, clearcoat: 1 });
  const parts = [];
  for (const [x, z, s, r] of [[0, 0, 1, 0], [0.28, 0.2, 0.7, 0.4], [-0.3, 0.15, 0.6, -0.35], [0.1, -0.3, 0.55, 0.25]]) {
    const c = new THREE.Mesh(new THREE.OctahedronGeometry(0.28, 0), mat);
    c.scale.set(0.8 * s, 2.2 * s, 0.8 * s);
    c.position.set(x, 0.35 + 0.6 * s, z);
    c.rotation.z = r;
    c.castShadow = true;
    grp.add(c);
    parts.push(c);
  }
  return { group: bake(grp), mat };
}

export function buildTree(lead = false) {
  const grp = new THREE.Group();
  const logM = new THREE.MeshStandardMaterial({ map: TERRAIN.log(), roughness: 0.9 });
  const leafM = new THREE.MeshStandardMaterial({ map: TERRAIN.leaves(), roughness: 0.8, color: lead ? 0xc8ffb0 : 0xffffff });
  for (let i = 0; i < 3; i++) box(0.7, 1, 0.7, logM, 0, 0.5 + i, 0, grp);
  box(2.6, 1, 2.6, leafM, 0, 3.2, 0, grp);
  box(1.8, 1, 1.8, leafM, 0, 4.1, 0, grp);
  box(1, 0.6, 1, leafM, 0.3, 4.8, -0.1, grp);
  const fruits = [];
  if (lead) {
    const fm = new THREE.MeshStandardMaterial({ color: 0xffcc33, emissive: 0xffaa00, emissiveIntensity: 1.1, roughness: 0.3, metalness: 0.2 });
    for (const [x, y, z] of [[1.32, 3.0, 0.5], [-1.32, 3.3, -0.3], [0.4, 2.62, 1.32], [-0.5, 2.7, -1.32], [0.95, 4.0, -0.9], [-0.9, 3.9, 0.95]]) {
      const f = box(0.34, 0.34, 0.34, fm, x, y, z, grp);
      fruits.push(f);
    }
  }
  bake(grp, { exclude: (o) => fruits.includes(o) });
  return { group: grp, fruits };
}

// ------------------------------------------------------------------ legacy junk
export function buildLegacy(id) {
  const grp = new THREE.Group();
  const label = (txt, bg, fg = '#fff') => smoothTex(`lg-${id}`, 128, 128, (g, w, h) => {
    g.fillStyle = bg; g.fillRect(0, 0, w, h);
    g.fillStyle = 'rgba(0,0,0,0.25)'; g.fillRect(0, h - 10, w, 10);
    g.font = `900 30px ${PIX}`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillStyle = fg;
    g.fillText(txt, w / 2, h / 2);
  });
  if (id === 'excel') {
    const t = smoothTex('lg-excel', 128, 128, (g, w, h) => {
      g.fillStyle = '#f4fbf6'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#9cc9ad'; g.lineWidth = 2;
      for (let i = 0; i <= w; i += 21) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
      g.fillStyle = '#1f8f4e'; g.fillRect(0, 0, w, 22);
      g.font = `900 22px ${PIX}`; g.fillStyle = '#c0182c'; g.textAlign = 'center'; g.fillText('#BEZUG!', w / 2, 74);
    });
    box(1, 1, 1, boxMat({ map: t }), 0, 0.5, 0, grp);
  } else if (id === 'access') {
    box(0.9, 1, 0.9, boxMat({ map: label('ACCDB', '#a4373a') }), 0, 0.5, 0, grp);
    box(0.9, 0.12, 0.9, boxMat({ color: '#7a2326' }), 0, 1.06, 0, grp);
  } else if (id === 'papier') {
    for (let i = 0; i < 7; i++) { const s = box(0.9, 0.12, 1.1, boxMat({ color: i % 2 ? '#f4efe0' : '#e8e2cf' }), 0, 0.06 + i * 0.13, 0, grp); s.rotation.y = (rnd() - 0.5) * 0.5; }
  } else if (id === 'postfach') {
    box(1.1, 0.6, 0.8, boxMat({ map: TERRAIN.plank() }), 0, 0.3, 0, grp);
    for (let i = 0; i < 6; i++) { const e = box(0.5, 0.04, 0.34, boxMat({ color: '#f1ead2' }), -0.3 + (i % 3) * 0.3, 0.68 + Math.floor(i / 3) * 0.1, (rnd() - 0.5) * 0.3, grp); e.rotation.set(rnd() - 0.5, rnd() * 2, rnd() - 0.5); }
  } else if (id === 'insel') {
    box(1.1, 0.4, 1.1, boxMat({ map: TERRAIN.sand() }), 0, 0.2, 0, grp);
    box(0.5, 0.6, 0.4, boxMat({ map: label('CRM', '#59626f') }), -0.15, 0.7, 0, grp);
    box(0.1, 0.9, 0.1, boxMat({ map: TERRAIN.log() }), 0.35, 0.85, 0.3, grp);
    box(0.6, 0.1, 0.6, boxMat({ map: TERRAIN.leaves() }), 0.35, 1.3, 0.3, grp);
  } else if (id === 'fax') {
    box(1, 0.5, 0.8, boxMat({ color: '#cfc5a8' }), 0, 0.25, 0, grp);
    box(0.7, 0.04, 0.5, boxMat({ color: '#ffffff' }), 0, 0.6, -0.1, grp).rotation.x = -0.5;
    box(0.3, 0.06, 0.25, boxMat({ color: '#3a3a3a' }), 0.25, 0.53, 0.2, grp);
  }
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return bake(grp);
}

// ------------------------------------------------------------------ monsters
function eyePair(parent, y, z, spread = 0.18, size = 0.14, angry = true) {
  const white = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.2, 0.25), toneMapped: false });
  for (const s of [-1, 1]) {
    box(size, size, 0.03, white, s * spread, y, z, parent);
    box(size * 0.55, size * 0.55, 0.04, red, s * spread, y, z + 0.01, parent);
    if (angry) { const b = box(size * 1.3, 0.04, 0.04, new THREE.MeshBasicMaterial({ color: 0x111111 }), s * spread, y + size * 0.7, z + 0.01, parent); b.rotation.z = s * 0.4; }
  }
}

export function buildMonster(type) {
  const grp = new THREE.Group();
  const body = new THREE.Group();
  grp.add(body);
  const parts = { group: grp, body, legs: [], arms: [], type };
  if (type === 'excel') {
    const grid = smoothTex('m-excel', 64, 64, (g, w, h) => {
      g.fillStyle = '#2f9e5a'; g.fillRect(0, 0, w, h);
      g.strokeStyle = 'rgba(255,255,255,0.45)'; g.lineWidth = 2;
      for (let i = 0; i <= w; i += 16) { g.beginPath(); g.moveTo(i, 0); g.lineTo(i, h); g.stroke(); g.beginPath(); g.moveTo(0, i); g.lineTo(w, i); g.stroke(); }
    });
    const m = boxMat({ map: grid });
    box(0.7, 0.8, 0.4, m, 0, 1.15, 0, body);
    const head = box(0.6, 0.6, 0.6, m, 0, 1.85, 0, body);
    eyePair(head, 0.06, 0.31);
    box(0.3, 0.06, 0.02, new THREE.MeshBasicMaterial({ color: 0x0b2a16 }), 0, -0.14, 0.31, head);
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * 0.47, 1.45, 0); body.add(a);
      box(0.22, 0.22, 0.7, m, 0, 0, 0.3, a); parts.arms.push(a);
      const l = new THREE.Group(); l.position.set(s * 0.17, 0.75, 0); body.add(l);
      box(0.26, 0.75, 0.28, boxMat({ color: '#1f6b3c' }), 0, -0.37, 0, l); parts.legs.push(l);
    }
    parts.hitY = 1.4;
  } else if (type === 'postfach') {
    const env = smoothTex('m-env', 64, 64, (g, w, h) => {
      g.fillStyle = '#f1ead2'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#b9ab83'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(0, 0); g.lineTo(w / 2, h * 0.55); g.lineTo(w, 0); g.stroke();
      g.fillStyle = '#c0182c'; g.fillRect(w - 18, 6, 12, 14);
    });
    const shell = box(1.0, 0.45, 0.7, [boxMat({ color: '#e6dcc0' }), boxMat({ color: '#e6dcc0' }), boxMat({ map: env }), boxMat({ color: '#e6dcc0' }), boxMat({ map: env }), boxMat({ color: '#e6dcc0' })], 0, 0.6, 0, body);
    eyePair(shell, 0.08, 0.36, 0.2, 0.13);
    const legM = boxMat({ color: '#3a2f22' });
    for (let i = 0; i < 6; i++) {
      const s = i < 3 ? -1 : 1;
      const l = new THREE.Group(); l.position.set(s * 0.45, 0.5, -0.25 + (i % 3) * 0.25); body.add(l);
      const seg = box(0.5, 0.07, 0.07, legM, s * 0.22, -0.12, 0, l); seg.rotation.z = s * -0.6;
      parts.legs.push(l);
    }
    parts.hitY = 0.7;
  } else if (type === 'silo') {
    const rivet = smoothTex('m-silo', 128, 128, (g, w, h) => {
      g.fillStyle = '#8b939e'; g.fillRect(0, 0, w, h);
      g.fillStyle = '#6c737d';
      for (let y = 0; y < h; y += 32) g.fillRect(0, y, w, 4);
      g.fillStyle = '#c9ced6';
      for (let y = 10; y < h; y += 32) for (let x = 8; x < w; x += 24) g.fillRect(x, y, 4, 4);
      g.font = `900 30px ${FONT}`; g.fillStyle = '#ffcc33'; g.textAlign = 'center'; g.fillText('SILO', w / 2, 80);
    });
    const m = new THREE.MeshStandardMaterial({ map: rivet, metalness: 0.6, roughness: 0.45 });
    const c = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 1.7, 12), m);
    c.position.y = 1.2; c.castShadow = true; body.add(c);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(0.66, 0.5, 12), boxMat({ color: '#6c737d' }));
    cap.position.y = 2.3; cap.castShadow = true; body.add(cap);
    const face = new THREE.Group(); face.position.set(0, 1.55, 0.6); body.add(face);
    eyePair(face, 0, 0.01, 0.2, 0.16);
    for (const s of [-1, 1]) {
      const a = new THREE.Group(); a.position.set(s * 0.72, 1.4, 0); body.add(a);
      box(0.3, 0.8, 0.3, m, 0, -0.3, 0, a); parts.arms.push(a);
      const l = new THREE.Group(); l.position.set(s * 0.25, 0.4, 0); body.add(l);
      box(0.34, 0.45, 0.4, boxMat({ color: '#5a616b' }), 0, -0.2, 0, l); parts.legs.push(l);
    }
    parts.hitY = 1.4;
  } else if (type === 'ghost') {
    const gm = new THREE.MeshStandardMaterial({ color: 0xb9a8ff, emissive: 0x5a3fd6, emissiveIntensity: 0.6, transparent: true, opacity: 0.72, roughness: 0.4 });
    const head = box(0.8, 0.8, 0.8, gm, 0, 1.6, 0, body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1.2, 4), gm);
    tail.rotation.set(Math.PI, Math.PI / 4, 0); tail.position.y = 0.85; body.add(tail);
    const black = new THREE.MeshBasicMaterial({ color: 0x120a2a });
    box(0.16, 0.24, 0.02, black, -0.17, 0.08, 0.41, head);
    box(0.16, 0.24, 0.02, black, 0.17, 0.08, 0.41, head);
    box(0.24, 0.12, 0.02, black, 0, -0.2, 0.41, head);
    parts.hitY = 1.5;
    parts.ghostMat = gm;
  } else if (type === 'boss') {
    const cols = ['#f4efe0', '#2f9e5a', '#cfc5a8', '#a4373a', '#f1ead2', '#7a8a9e'];
    const crackM = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.2), toneMapped: false });
    const cubes = [];
    for (let x = -1; x <= 1; x++) for (let y = 0; y < 3; y++) for (let z = -1; z <= 1; z++) {
      if (Math.abs(x) + Math.abs(z) === 2 && y === 2) continue;
      const c = box(0.95, 0.95, 0.95, boxMat({ color: cols[(x + 1 + y * 3 + (z + 1) * 2) % cols.length] }), x, 0.6 + y, z, body);
      cubes.push(c);
    }
    // glowing cracks
    box(0.08, 2.8, 3.05, crackM, 0.18, 1.6, 0, body).rotation.z = 0.2;
    box(3.05, 0.08, 3.05, crackM, 0, 2.0, 0, body).rotation.x = 0.06;
    const face = new THREE.Group(); face.position.set(0, 2.2, 1.5); body.add(face);
    eyePair(face, 0, 0.01, 0.55, 0.42);
    box(1.2, 0.2, 0.04, new THREE.MeshBasicMaterial({ color: 0x1a0505 }), 0, -0.55, 0.02, face);
    // orbiting paper sheets
    const sheets = [];
    for (let i = 0; i < 8; i++) {
      const s = box(0.5, 0.02, 0.7, boxMat({ color: '#ffffff' }), 0, 0, 0, grp);
      sheets.push(s);
    }
    parts.sheets = sheets;
    parts.cubes = cubes;
    parts.hitY = 1.8;
  }
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  bakeRig(body, ...parts.legs, ...parts.arms);
  return parts;
}

// ------------------------------------------------------------------ props
/** Market stall with striped awning and a sign. */
export function buildStall(color, title, sub) {
  const grp = new THREE.Group();
  const wood = boxMat({ map: TERRAIN.plank() });
  for (const [x, z] of [[-1.3, -0.7], [1.3, -0.7], [-1.3, 0.8], [1.3, 0.8]]) box(0.16, 2.6, 0.16, wood, x, 1.3, z, grp);
  box(2.9, 0.9, 0.7, wood, 0, 0.45, 0.8, grp);
  const stripes = smoothTex(`awn-${color}`, 128, 32, (g, w, h) => {
    for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? '#ffffff' : color; g.fillRect(i * 16, 0, 16, h); }
    g.fillStyle = 'rgba(0,0,0,0.2)'; g.fillRect(0, h - 4, w, 4);
  });
  const aw = box(3.2, 0.12, 2.1, boxMat({ map: stripes }), 0, 2.65, 0.1, grp);
  aw.rotation.x = 0.18;
  // scalloped front edge
  for (let i = 0; i < 8; i++) box(0.4, 0.22, 0.06, boxMat({ color: i % 2 ? '#ffffff' : color }), -1.4 + i * 0.4, 2.42, 1.2, grp);
  const sign = smoothTex(`sign-${title}`, 512, 160, (g, w, h) => {
    g.fillStyle = '#3b2412'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#5a3a22'; g.fillRect(8, 8, w - 16, h - 16);
    g.fillStyle = color; g.fillRect(8, 8, 14, h - 16);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `900 58px ${FONT}`; g.fillStyle = '#fff4d6'; g.fillText(title, w / 2 + 6, h * 0.4);
    g.font = `700 30px ${FONT}`; g.fillStyle = color; g.fillText(sub, w / 2 + 6, h * 0.76);
  });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.75), new THREE.MeshStandardMaterial({ map: sign, roughness: 0.8, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.12 }));
  s.position.set(0, 3.25, 1.12);
  grp.add(s);
  // goods on the counter
  for (let i = 0; i < 4; i++) box(0.34, 0.34, 0.34, boxMat({ color: shade(color, 0.8 + i * 0.12) }), -0.9 + i * 0.6, 1.07, 0.85, grp);
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return bake(grp);
}

/** itmX forge: stone furnace with glowing mouth, anvil and a sign with the logo. */
export function buildForge() {
  const grp = new THREE.Group();
  const brick = boxMat({ map: TERRAIN.brick() });
  box(2.2, 2, 1.6, brick, 0, 1, -0.4, grp);
  box(0.8, 2.2, 0.8, brick, 0.5, 3, -0.6, grp);
  const fire = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.3, 0.3), toneMapped: false });
  box(0.9, 0.6, 0.05, fire, 0, 0.7, 0.41, grp);
  const metal = new THREE.MeshStandardMaterial({ color: 0x3a3f48, metalness: 0.8, roughness: 0.35 });
  box(0.9, 0.3, 0.45, metal, 1.6, 0.85, 0.8, grp);
  box(0.4, 0.55, 0.35, metal, 1.6, 0.35, 0.8, grp);
  const sign = smoothTex('sign-forge', 512, 200, (g, w, h) => {
    g.fillStyle = '#1b2a14'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#26401b'; g.fillRect(8, 8, w - 16, h - 16);
    drawBrand(g, 26, 30, 140, 140);
    g.textAlign = 'left'; g.textBaseline = 'middle';
    g.font = `900 54px ${FONT}`; g.fillStyle = '#eaffdf'; g.fillText('Schmiede', 190, 78);
    g.font = `700 28px ${FONT}`; g.fillStyle = '#7fdc5a'; g.fillText('Fundament & Umtausch', 190, 136);
  });
  const s = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.86), new THREE.MeshStandardMaterial({ map: sign, emissive: 0xffffff, emissiveMap: sign, emissiveIntensity: 0.15 }));
  s.position.set(-0.2, 2.5, 0.42);
  grp.add(s);
  grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
  return { group: bake(grp), fire };
}

/** Floating cloud made of flat white boxes. */
export function buildCloud(scale = 1, opacity = 0.92) {
  const grp = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: opacity < 1, opacity, emissive: 0xffffff, emissiveIntensity: 0.08 });
  const n = 4 + Math.floor(Math.random() * 4);
  for (let i = 0; i < n; i++) {
    const w = 2 + Math.random() * 3, d = 1.5 + Math.random() * 2.5;
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 0.8 + Math.random() * 0.6, d), m);
    b.position.set((Math.random() - 0.5) * 5, Math.random() * 0.4, (Math.random() - 0.5) * 3);
    grp.add(b);
  }
  bake(grp);
  grp.scale.setScalar(scale);
  return { group: grp, mat: m };
}

/** Voxel pickaxe for the player's avatar. */
export function buildPickaxe() {
  const grp = new THREE.Group();
  const wood = boxMat({ map: TERRAIN.log() });
  const head = new THREE.MeshStandardMaterial({ color: 0x9fb8d6, metalness: 0.8, roughness: 0.3 });
  box(0.08, 0.9, 0.08, wood, 0, 0.3, 0, grp);
  box(0.7, 0.12, 0.12, head, 0, 0.74, 0, grp);
  box(0.12, 0.12, 0.12, new THREE.MeshStandardMaterial({ color: 0x50af30, emissive: 0x50af30, emissiveIntensity: 0.8 }), 0, 0.74, 0.08, grp);
  return grp;
}

/** Text sprite (speech bubbles for monsters / labels). */
export function textSprite(text, { color = '#ffffff', bg = 'rgba(10,14,28,0.82)', size = 40, border = null } = {}) {
  const c = document.createElement('canvas');
  const g = c.getContext('2d');
  g.font = `800 ${size}px ${FONT}`;
  const w = Math.ceil(g.measureText(text).width) + size;
  c.width = w; c.height = Math.ceil(size * 1.7);
  g.font = `800 ${size}px ${FONT}`;
  g.fillStyle = bg;
  const r = c.height / 2;
  g.beginPath(); g.moveTo(r, 0); g.arcTo(w, 0, w, c.height, r); g.arcTo(w, c.height, 0, c.height, r); g.arcTo(0, c.height, 0, 0, r); g.arcTo(0, 0, w, 0, r); g.fill();
  if (border) { g.strokeStyle = border; g.lineWidth = 4; g.stroke(); }
  g.fillStyle = color; g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText(text, w / 2, c.height / 2 + 2);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true, toneMapped: false }));
  sp.renderOrder = 10;
  const k = 0.012 * (40 / size);
  sp.scale.set(w * k, c.height * k, 1);
  return sp;
}

/** SVG portrait of Lord CRM for the HUD speech box. */
export function lordSVG() {
  const L = LORD_LOOK;
  return `<svg viewBox="0 0 16 16" shape-rendering="crispEdges" xmlns="http://www.w3.org/2000/svg">
  <rect x="3" y="5" width="10" height="9" fill="${L.skin}"/>
  <rect x="3" y="2" width="10" height="3" fill="${L.crown}"/>
  <rect x="3" y="1" width="2" height="1" fill="${L.crown}"/><rect x="7" y="1" width="2" height="1" fill="${L.crown}"/><rect x="11" y="1" width="2" height="1" fill="${L.crown}"/>
  <rect x="7" y="3" width="2" height="1" fill="${L.gem}"/><rect x="4" y="3" width="1" height="1" fill="#ff2a55"/><rect x="11" y="3" width="1" height="1" fill="#3d8bff"/>
  <rect x="4" y="7" width="3" height="1" fill="#fff"/><rect x="9" y="7" width="3" height="1" fill="#fff"/>
  <rect x="5" y="7" width="1" height="1" fill="#1d2a5a"/><rect x="10" y="7" width="1" height="1" fill="#1d2a5a"/>
  <rect x="4" y="6" width="3" height="1" fill="#d8d2c6"/><rect x="9" y="6" width="3" height="1" fill="#d8d2c6"/>
  <rect x="7" y="8" width="2" height="1" fill="#d9a07a"/>
  <rect x="3" y="9" width="10" height="5" fill="${L.beard}"/><rect x="5" y="14" width="6" height="1" fill="${L.beard}"/>
  <rect x="7" y="10" width="2" height="1" fill="#7a2f2f"/>
  <rect x="1" y="14" width="14" height="2" fill="${L.robe}"/>
</svg>`;
}
