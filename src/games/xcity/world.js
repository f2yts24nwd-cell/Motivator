import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, rand, drawBrand } from '../../core/gfx.js';
import { buildXTile, buildBeam } from './xtile.js';
import { NEON } from './content.js';

// Ludlein Bay: a coastal grid city at golden hour. The X-Platz sits in the exact centre.
export const ROADS = [-200, -120, -40, 40, 120, 200];
export const RW = 14; // road width
export const LANE = 3.2; // lane offset from the road centre (right-hand traffic)
export const CURB = 0.15;
export const SHORE = 213; // promenade ends, beach starts
export const WATER_X = 251;
const SLOPE = 0.012; // beach slope
export const MAP = { x0: -262, z0: -270, size: 540 };
const SW = 4; // sidewalk width

// deterministic random so the city is the same on every visit
let seed = 7;
const srand = (a = 0, b = 1) => { seed = (seed * 16807) % 2147483647; return a + ((seed - 1) / 2147483646) * (b - a); };
const pick = (arr) => arr[Math.floor(srand(0, arr.length - 0.0001))];

// ------------------------------------------------------------------ textures
function windowTextures() {
  const N = 8, C = 64;
  const lit = [];
  for (let i = 0; i < N * N; i++) lit.push(Math.random() < 0.28);
  const glass = canvasTexture(N * C, N * C, (g) => {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const l = 30 + Math.random() * 14;
      g.fillStyle = `hsl(${200 + Math.random() * 20}, 30%, ${l}%)`;
      g.fillRect(x * C, y * C, C, C);
      const gr = g.createLinearGradient(x * C, y * C, x * C + C, y * C + C);
      gr.addColorStop(0, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(0,0,0,0.1)');
      g.fillStyle = gr; g.fillRect(x * C, y * C, C, C);
    }
    g.fillStyle = '#c9d2dc';
    for (let i = 0; i <= N; i++) { g.fillRect(i * C - 2, 0, 4, N * C); g.fillRect(0, i * C - 3, N * C, 6); }
    g.fillStyle = '#c9d2dc'; g.fillRect(0, 0, 10, 10);
  });
  const glassLit = canvasTexture(N * C, N * C, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, N * C, N * C);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (lit[y * N + x]) {
      g.fillStyle = `hsl(${35 + Math.random() * 15}, 90%, ${55 + Math.random() * 20}%)`;
      g.fillRect(x * C + 4, y * C + 6, C - 8, C - 12);
    }
  });
  const stucco = canvasTexture(N * C, N * C, (g) => {
    g.fillStyle = '#f4efe6'; g.fillRect(0, 0, N * C, N * C);
    for (let i = 0; i < 4000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.04})`; g.fillRect(Math.random() * N * C, Math.random() * N * C, 2, 2); }
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      g.fillStyle = '#2c3d4f';
      g.fillRect(x * C + 16, y * C + 14, C - 32, C - 26);
      g.fillStyle = 'rgba(255,255,255,0.25)';
      g.fillRect(x * C + 16, y * C + 14, (C - 32) / 2, C - 26);
      g.fillStyle = '#d9d2c4';
      g.fillRect(x * C + 12, y * C + C - 13, C - 24, 4);
    }
  });
  const stuccoLit = canvasTexture(N * C, N * C, (g) => {
    g.fillStyle = '#000'; g.fillRect(0, 0, N * C, N * C);
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) if (lit[(y * N + x + 17) % (N * N)]) {
      g.fillStyle = `hsl(${30 + Math.random() * 20}, 85%, ${50 + Math.random() * 20}%)`;
      g.fillRect(x * C + 16, y * C + 14, C - 32, C - 26);
    }
  });
  for (const t of [glass, glassLit, stucco, stuccoLit]) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  return { glass, glassLit, stucco, stuccoLit };
}

function noiseTex(w, base, spread, dots = 9000, size = 2) {
  const t = canvasTexture(w, w, (g) => {
    g.fillStyle = base; g.fillRect(0, 0, w, w);
    for (let i = 0; i < dots; i++) {
      const l = Math.random();
      g.fillStyle = `rgba(${l > 0.5 ? 255 : 0},${l > 0.5 ? 255 : 0},${l > 0.5 ? 255 : 0},${Math.random() * spread})`;
      g.fillRect(Math.random() * w, Math.random() * w, size, size);
    }
  });
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function waterNormal() {
  // tileable normal map from a sum of sines
  const w = 256;
  const c = document.createElement('canvas'); c.width = c.height = w;
  const g = c.getContext('2d');
  const img = g.createImageData(w, w);
  const waves = [];
  for (let i = 0; i < 9; i++) waves.push({ kx: Math.floor(rand(1, 7)) * (Math.random() < 0.5 ? -1 : 1), ky: Math.floor(rand(1, 7)), a: rand(0.4, 1), p: rand(0, 6.28) });
  for (let y = 0; y < w; y++) for (let x = 0; x < w; x++) {
    let dx = 0, dy = 0;
    for (const v of waves) {
      const ph = ((v.kx * x + v.ky * y) / w) * Math.PI * 2 + v.p;
      const c2 = Math.cos(ph) * v.a;
      dx += c2 * v.kx; dy += c2 * v.ky;
    }
    const n = new THREE.Vector3(-dx * 0.05, -dy * 0.05, 1).normalize();
    const i = (y * w + x) * 4;
    img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

function neonTexture(text, color) {
  return canvasTexture(1024, 256, (g, w, h) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = `italic 900 ${text.length > 10 ? 104 : 140}px "Segoe UI", Arial, sans-serif`;
    g.shadowColor = color; g.shadowBlur = 30;
    g.strokeStyle = color; g.lineWidth = 12;
    g.strokeText(text, w / 2, h / 2);
    g.shadowBlur = 10;
    g.fillStyle = '#ffffff';
    g.fillText(text, w / 2, h / 2);
  });
}

// ------------------------------------------------------------------ geometry helpers
/** box with UVs in world units (u per window column, v per floor) and a vertex colour */
function cityBox(x, y, z, w, h, d, color, { col = 4, floor = 3.6, uOff = 0, vOff = 0 } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    let u = uv.getX(i), v = uv.getY(i);
    if (f === 2 || f === 3) { u = 0.004; v = 0.996; } // roof: plain wall pixel
    else {
      const span = f < 2 ? d : w;
      u = (u * span) / (col * 8) + uOff;
      v = (v * h) / (floor * 8) + vOff;
    }
    uv.setXY(i, u, v);
  }
  geo.translate(x, y + h / 2, z);
  return tint(geo, color);
}
function tint(geo, color) {
  const c = new THREE.Color(color);
  const n = geo.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return geo;
}
function plainUV(geo, sx = 1, sz = 1) {
  // planar world-space UVs (top view) for ground pieces
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / sx, p.getZ(i) / sz);
  return geo;
}
const merge = (list) => (list.length ? mergeGeometries(list, false) : null);

// ------------------------------------------------------------------ the world
export class World {
  constructor(renderer) {
    seed = 7;
    this.scene = new THREE.Scene();
    this.solids = []; // AABBs {x0,x1,z0,z1}
    this.circles = []; // {x,z,r}
    this.hash = new Map();
    this.anim = [];
    this.T = windowTextures();
    this.buildSky(renderer);
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildCoast();
    this.buildPlaza();
    this.buildLamps();
    this.buildSkyline();
    this.indexSolids();
    this.mapImage = this.renderMap();
  }

  // ---------------------------------------------------------------- sky + light (golden hour)
  buildSky(renderer) {
    const s = this.scene;
    const sky = new Sky();
    sky.scale.setScalar(9000);
    const u = sky.material.uniforms;
    u.turbidity.value = 6.5;
    u.rayleigh.value = 3.4;
    u.mieCoefficient.value = 0.0028;
    u.mieDirectionalG.value = 0.8;
    // the sun sets over the ocean (east = +x, a little south)
    const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 10), THREE.MathUtils.degToRad(58));
    u.sunPosition.value.copy(sun);
    this.sunDir = sun.clone();
    const envScene = new THREE.Scene();
    const sky2 = new Sky();
    sky2.scale.setScalar(1000);
    sky2.material.uniforms.sunPosition.value.copy(sun);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) sky2.material.uniforms[k].value = u[k].value;
    envScene.add(sky2);
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(900, 24), new THREE.MeshBasicMaterial({ color: 0x2a2228 }));
    gnd.rotation.x = -Math.PI / 2; gnd.position.y = -5;
    envScene.add(gnd);
    const pm = new THREE.PMREMGenerator(renderer);
    this.env = pm.fromScene(envScene, 0.02).texture;
    pm.dispose();
    // tame the HDR glow around the low sun so bloom does not wash out the whole frame
    sky.material.fragmentShader = sky.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( min( retColor * 0.8, vec3( 1.25, 1.05, 0.95 ) ), 1.0 );');
    s.add(sky);
    this.sky = sky;
    s.environment = this.env;
    s.environmentIntensity = 0.85;
    s.fog = new THREE.FogExp2(0xd98a6a, 0.0013);
    s.add(new THREE.HemisphereLight(0x8fa0ff, 0x6a3a3a, 0.5));
    const sunL = new THREE.DirectionalLight(0xff9d5c, 3.4);
    sunL.castShadow = true;
    sunL.shadow.mapSize.set(2048, 2048);
    const r = 60;
    Object.assign(sunL.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 10, far: 600 });
    sunL.shadow.bias = -0.0005;
    sunL.shadow.normalBias = 0.06;
    s.add(sunL, sunL.target);
    this.sun = sunL;
    // the visible sun: a glowing disc over the sea
    const disc = new THREE.Mesh(new THREE.CircleGeometry(38, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, 0.7), toneMapped: false, fog: false }));
    disc.position.copy(sun).multiplyScalar(4000);
    disc.lookAt(0, 0, 0);
    s.add(disc);
  }
  followSun(pos) {
    const step = 2;
    const x = Math.round(pos.x / step) * step, z = Math.round(pos.z / step) * step;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunDir.x * 300, this.sunDir.y * 300 + 40, z + this.sunDir.z * 300);
  }

  // ---------------------------------------------------------------- ground + roads
  buildGround() {
    const asphalt = noiseTex(512, '#3b3a3f', 0.12, 14000, 2);
    asphalt.repeat.set(220, 220);
    const g = new THREE.PlaneGeometry(1400, 1400, 20, 20);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: asphalt, roughness: 0.82, metalness: 0.05, color: 0xb8aeb4 }));
    m.position.set(SHORE - 700, 0, 0);
    m.receiveShadow = true;
    this.scene.add(m);
    this.T.concrete = noiseTex(256, '#c9c1b8', 0.08, 3000, 2);
    this.T.concrete.repeat.set(1, 1);
  }

  buildRoads() {
    const white = [], yellow = [], cross = [];
    const lo = ROADS[0], hi = ROADS[ROADS.length - 1];
    const strip = (list, x, z, w, d) => { const p = new THREE.PlaneGeometry(w, d); p.rotateX(-Math.PI / 2); p.translate(x, 0.025, z); list.push(p); };
    for (const r of ROADS) for (let k = 0; k < ROADS.length - 1; k++) {
      const a = ROADS[k] + RW / 2, b = ROADS[k + 1] - RW / 2, mid = (a + b) / 2, len = b - a;
      // vertical road (constant x = r) and horizontal road (constant z = r)
      for (const vert of [true, false]) {
        const S = (list, off, w, l, c) => vert ? strip(list, r + off, c, w, l) : strip(list, c, r + off, l, w);
        S(yellow, -0.18, 0.16, len, mid); S(yellow, 0.18, 0.16, len, mid);
        S(white, -RW / 2 + 0.5, 0.18, len, mid); S(white, RW / 2 - 0.5, 0.18, len, mid);
        // crosswalks at both ends
        for (const end of [a + 2, b - 2]) for (let q = -5; q <= 5; q += 1.4) vert ? strip(cross, r + q, end, 0.8, 3) : strip(cross, end, r + q, 3, 0.8);
      }
    }
    void lo; void hi;
    const mk = (list, color, em = 0) => {
      const m = new THREE.Mesh(merge(list), new THREE.MeshStandardMaterial({ color, roughness: 0.6, emissive: color, emissiveIntensity: em, polygonOffset: true, polygonOffsetFactor: -2 }));
      m.receiveShadow = true;
      this.scene.add(m);
    };
    mk(white, 0xe8e6e0, 0.05);
    mk(yellow, 0xf2b630, 0.08);
    mk(cross, 0xe8e6e0, 0.03);
  }

  // ---------------------------------------------------------------- blocks + buildings
  addSolid(x0, x1, z0, z1) { this.solids.push({ x0, x1, z0, z1 }); }

  buildBlocks() {
    const glass = [], stucco = [], plates = [], grass = [], roofs = [];
    this.palmSpots = [];
    this.neonSpots = [];
    this.pedLoops = [];
    this.billboards = [];
    const pastel = [0xffc2d1, 0xa9f0e4, 0xfff0b3, 0xc7d8ff, 0xffd7a8, 0xe6c8ff, 0xffffff, 0xb8f5c0];
    const concrete = [0xd8d0c4, 0xc9c2bb, 0xe6ded2, 0xbfb6ad, 0xd4c7b5];
    const glassTint = [0x8fb3d9, 0x9ad0d6, 0xb7c6e8, 0x7da6c4, 0xa3b8c9, 0xd1b48c];
    for (let i = 0; i < ROADS.length - 1; i++) for (let j = 0; j < ROADS.length - 1; j++) {
      const x0 = ROADS[i] + RW / 2, x1 = ROADS[i + 1] - RW / 2, z0 = ROADS[j] + RW / 2, z1 = ROADS[j + 1] - RW / 2;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
      // raised sidewalk plate
      const p = new THREE.BoxGeometry(w, CURB, d);
      p.translate(cx, CURB / 2, cz);
      plainUV(p, 4, 4);
      plates.push(p);
      this.pedLoops.push({ x0: x0 + 1.8, x1: x1 - 1.8, z0: z0 + 1.8, z1: z1 - 1.8 });
      if (i === 2 && j === 2) continue; // X-Platz
      const bx0 = x0 + SW, bx1 = x1 - SW, bz0 = z0 + SW, bz1 = z1 - SW;
      const dist = Math.hypot(cx, cz);
      if (i === 2 && j === 1) { this.buildHQ(glass, roofs, bx0, bx1, bz0, bz1); continue; }
      if (i === 0 && j === 4) { this.buildSilo(bx0, bx1, bz0, bz1); continue; }
      if (i === 3 && j === 3) { // a park with palms
        const gg = new THREE.PlaneGeometry(bx1 - bx0, bz1 - bz0); gg.rotateX(-Math.PI / 2); gg.translate(cx, CURB + 0.02, cz); grass.push(gg);
        for (let k = 0; k < 14; k++) this.palmSpots.push([rand(bx0 + 3, bx1 - 3), rand(bz0 + 3, bz1 - 3), CURB, rand(0.8, 1.2)]);
        continue;
      }
      const ocean = i === 4; // Ocean Drive: pastel art deco
      // lots: 2x2 or 1 big
      const lots = [];
      if (!ocean && dist < 140 && srand() < 0.35) lots.push([bx0, bx1, bz0, bz1]);
      else {
        const mx = (bx0 + bx1) / 2, mz = (bz0 + bz1) / 2, g2 = 1.5;
        lots.push([bx0, mx - g2, bz0, mz - g2], [mx + g2, bx1, bz0, mz - g2], [bx0, mx - g2, mz + g2, bz1], [mx + g2, bx1, mz + g2, bz1]);
      }
      for (const [lx0, lx1, lz0, lz1] of lots) {
        const lw = lx1 - lx0, ld = lz1 - lz0, lcx = (lx0 + lx1) / 2, lcz = (lz0 + lz1) / 2;
        if (!ocean && srand() < 0.08) { // small plaza with palms instead of a building
          for (let k = 0; k < 3; k++) this.palmSpots.push([lcx + rand(-lw / 3, lw / 3), lcz + rand(-ld / 3, ld / 3), CURB, rand(0.8, 1.1)]);
          continue;
        }
        const uOff = Math.floor(srand(0, 8)) / 8, vOff = Math.floor(srand(0, 8)) / 8;
        if (ocean) {
          const h = srand(11, 20);
          const c = pick(pastel);
          stucco.push(cityBox(lcx, CURB, lcz, lw, h, ld, c, { col: 3.2, floor: 3.4, uOff, vOff }));
          // art deco: stepped top, cornice bands, a tower piece
          stucco.push(cityBox(lcx, CURB + h, lcz, lw + 0.6, 0.6, ld + 0.6, 0xffffff, { col: 3.2, floor: 3.4 }));
          stucco.push(cityBox(lcx, CURB + h + 0.6, lcz, lw * 0.6, srand(2, 5), ld * 0.6, c, { col: 3.2, floor: 3.4, uOff, vOff }));
          stucco.push(cityBox(lcx + lw / 2 + 0.3, CURB + 3.6, lcz, 0.6, 0.4, ld, 0xffffff, { col: 3.2, floor: 3.4 }));
          this.addSolid(lx0, lx1, lz0, lz1);
          // neon on the sea-facing side
          if (lx1 > (bx0 + bx1) / 2) this.neonSpots.push({ x: lx1 + 0.4, y: CURB + h * 0.55, z: lcz, ry: Math.PI / 2, w: Math.min(ld * 0.8, 16) });
        } else if (dist < 150 && srand() < 0.75) {
          // glass tower
          const h = srand(28, 70) * (1.25 - dist / 260) + (dist < 90 ? srand(10, 30) : 0);
          const c = pick(glassTint);
          const inset = srand(0.5, 2.5);
          glass.push(cityBox(lcx, CURB, lcz, lw - inset, h, ld - inset, c, { col: 3, floor: 3.8, uOff, vOff }));
          // podium + crown
          stucco.push(cityBox(lcx, CURB, lcz, lw, 5, ld, pick(concrete), { col: 4, floor: 5 }));
          if (srand() < 0.6) glass.push(cityBox(lcx, CURB + h, lcz, (lw - inset) * 0.6, srand(4, 14), (ld - inset) * 0.6, c, { col: 3, floor: 3.8, uOff, vOff }));
          roofs.push(cityBox(lcx + srand(-3, 3), CURB + h, lcz + srand(-3, 3), 3, 2, 3, 0x777777));
          this.addSolid(lx0, lx1, lz0, lz1);
          if (srand() < 0.35) this.billboards.push({ x: lcx, y: CURB + h + 1, z: lcz, w: Math.min(lw, ld) * 0.8, ry: srand() < 0.5 ? 0 : Math.PI / 2 });
        } else {
          // stucco mid-rise
          const h = srand(8, 26);
          const c = srand() < 0.5 ? pick(pastel) : pick(concrete);
          stucco.push(cityBox(lcx, CURB, lcz, lw, h, ld, c, { col: 3.5, floor: 3.4, uOff, vOff }));
          stucco.push(cityBox(lcx, CURB + h, lcz, lw + 0.4, 0.5, ld + 0.4, 0xeeeeee, { col: 3.5, floor: 3.4 }));
          roofs.push(cityBox(lcx + srand(-4, 4), CURB + h + 0.5, lcz + srand(-4, 4), 2.5, 1.6, 2.5, 0x8a8a8a));
          if (srand() < 0.4) { // water tank
            const t = new THREE.CylinderGeometry(1.5, 1.5, 3, 12); t.translate(lcx - lw * 0.25, CURB + h + 3, lcz + ld * 0.2); roofs.push(tint(t, 0x6b5546));
          }
          this.addSolid(lx0, lx1, lz0, lz1);
          if (srand() < 0.22) this.neonSpots.push({ x: lcx, y: CURB + Math.min(h - 1, 7), z: lz1 + 0.3, ry: 0, w: Math.min(lw * 0.8, 14) });
        }
      }
    }
    // outer ring: a wall of buildings so the city has an edge (west, north, south)
    const ring = (x0, x1, z0, z1) => {
      for (let x = x0; x < x1; x += 22) for (let z = z0; z < z1; z += 22) {
        const h = srand(14, 55);
        const c = srand() < 0.5 ? pick(concrete) : pick(pastel);
        (srand() < 0.4 ? glass : stucco).push(cityBox(x + 11, 0, z + 11, 20, h, 20, c, { col: 3.5, floor: 3.6, uOff: Math.floor(srand(0, 8)) / 8 }));
      }
      this.addSolid(x0, x1, z0, z1);
    };
    ring(-260, -207, -260, 260);
    ring(-207, SHORE - 6, -260, -207);
    ring(-207, SHORE - 6, 207, 260);
    const S = this.scene;
    const glassMat = new THREE.MeshPhysicalMaterial({
      vertexColors: true, map: this.T.glass, emissiveMap: this.T.glassLit, emissive: 0xffd9a0, emissiveIntensity: 0.6,
      roughness: 0.12, metalness: 0.55, envMapIntensity: 1.5, clearcoat: 0.5
    });
    const stuccoMat = new THREE.MeshStandardMaterial({ vertexColors: true, map: this.T.stucco, emissiveMap: this.T.stuccoLit, emissive: 0xffc890, emissiveIntensity: 0.55, roughness: 0.85 });
    for (const [list, mat] of [[glass, glassMat], [stucco, stuccoMat], [roofs, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 })]]) {
      const m = new THREE.Mesh(merge(list), mat);
      m.castShadow = true; m.receiveShadow = true;
      S.add(m);
    }
    const pm = new THREE.Mesh(merge(plates), new THREE.MeshStandardMaterial({ map: this.T.concrete, roughness: 0.9, color: 0xe2d6cc }));
    pm.receiveShadow = true;
    S.add(pm);
    if (grass.length) {
      const gt = noiseTex(256, '#4f8a3a', 0.18, 6000, 3); gt.repeat.set(8, 8);
      const gm = new THREE.Mesh(merge(grass), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 }));
      gm.receiveShadow = true;
      S.add(gm);
    }
    this.buildNeon();
    this.buildBillboards();
  }

  buildHQ(glass, roofs, x0, x1, z0, z1) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const w = 34, h = 128;
    glass.push(cityBox(cx, CURB, cz - 4, w, h, w, 0x7fd6a0, { col: 2.6, floor: 3.6 }));
    glass.push(cityBox(cx, CURB + h, cz - 4, w * 0.7, 10, w * 0.7, 0x7fd6a0, { col: 2.6, floor: 3.6 }));
    roofs.push(cityBox(cx, CURB, cz - 4, w + 8, 6, w + 8, 0xdedad2));
    this.addSolid(cx - w / 2 - 4, cx + w / 2 + 4, cz - 4 - w / 2 - 4, cz - 4 + w / 2 + 4);
    // glowing itmX logo on all four sides of the crown
    const tex = canvasTexture(512, 512, (g, W, H) => { drawBrand(g, 40, 40, W - 80, H - 80); });
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false });
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), m);
      const a = (k * Math.PI) / 2;
      p.position.set(cx + Math.sin(a) * (w / 2 + 0.3), CURB + h - 14, cz - 4 + Math.cos(a) * (w / 2 + 0.3));
      p.rotation.y = a;
      this.scene.add(p);
    }
    // spire with a blinking light
    const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.8, 30, 8), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 }));
    sp.position.set(cx, CURB + h + 25, cz - 4);
    this.scene.add(sp);
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.4, 0.3), toneMapped: false }));
    blink.position.set(cx, CURB + h + 40.5, cz - 4);
    this.scene.add(blink);
    this.anim.push((t) => { blink.visible = Math.sin(t * 3) > 0.2; });
    this.hq = { x: cx, z: cz };
  }

  buildSilo(x0, x1, z0, z1) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const gt = this.T.glass.clone(), gl = this.T.glassLit.clone();
    for (const t of [gt, gl]) { t.repeat.set(5, 3.5); t.needsUpdate = true; }
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x3d4466, roughness: 0.25, metalness: 0.7, map: gt, emissiveMap: gl, emissive: 0x9aa3ff, emissiveIntensity: 0.5, clearcoat: 1 });
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 96, 40), mat);
    silo.position.set(cx, CURB + 48, cz);
    silo.castShadow = true;
    this.scene.add(silo);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 40, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    dome.position.set(cx, CURB + 96, cz);
    this.scene.add(dome);
    // Cloudius' cloud
    const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9aa3ff, emissiveIntensity: 0.35, roughness: 0.9 });
    const cloud = new THREE.Group();
    for (const [x, y, z, r] of [[0, 0, 0, 12], [12, -2, 3, 9], [-12, -2, -2, 9], [5, 4, -6, 8], [-6, 3, 7, 8]]) {
      const b = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 12), cm); b.position.set(x, y, z); cloud.add(b);
    }
    cloud.position.set(cx, CURB + 130, cz);
    this.scene.add(cloud);
    this.anim.push((t) => { cloud.position.y = CURB + 130 + Math.sin(t * 0.5) * 2; cloud.rotation.y = t * 0.05; });
    this.circles.push({ x: cx, z: cz, r: 23 });
    this.silo = { x: cx, z: cz };
  }

  buildNeon() {
    const colors = ['#ff3d9a', '#19c3ff', '#7dff6a', '#ffb000', '#b56bff', '#ff6a2a'];
    for (const n of this.neonSpots) {
      const text = pick(NEON), color = pick(colors);
      const m = new THREE.MeshBasicMaterial({ map: neonTexture(text, color), transparent: true, color: new THREE.Color(2.2, 2.2, 2.2), toneMapped: false, depthWrite: false });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(n.w, n.w / 4), m);
      p.position.set(n.x, n.y, n.z);
      p.rotation.y = n.ry;
      this.scene.add(p);
      if (srand() < 0.3) { const ph = srand(0, 6); this.anim.push((t) => { m.opacity = Math.sin(t * 9 + ph) > -0.85 || Math.sin(t * 1.3 + ph) > 0 ? 1 : 0.25; }); }
    }
  }

  buildBillboards() {
    const ads = [
      ['itmX CRM', 'Alle Kundendaten. Ein X.', '#50af30'],
      ['CLOUDIUS', 'Ihre Daten. Unser Silo.', '#6c74d8'],
      ['SAP + 365', 'Endlich ein Team.', '#19c3ff'],
      ['LEAD BAR', 'Happy Hour: 2 Leads zum Preis von 1', '#ff3d9a']
    ];
    let k = 0;
    for (const b of this.billboards) {
      const [a, s, c] = ads[k++ % ads.length];
      const tex = canvasTexture(1024, 400, (g, w, h) => {
        const gr = g.createLinearGradient(0, 0, w, h); gr.addColorStop(0, c); gr.addColorStop(1, '#111');
        g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.font = 'italic 900 150px "Segoe UI", Arial'; g.fillText(a, 50, 150);
        g.font = '600 58px "Segoe UI", Arial'; g.fillText(s, 54, 300);
      });
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.w * 0.39), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, color: new THREE.Color(1.25, 1.25, 1.25) }));
      m.position.set(b.x, b.y + b.w * 0.2 + 2, b.z);
      m.rotation.y = b.ry;
      this.scene.add(m);
    }
  }

  // ---------------------------------------------------------------- coast: promenade, beach, ocean
  buildCoast() {
    const S = this.scene;
    // promenade (raised) east of Ocean Drive
    const prom = new THREE.BoxGeometry(SHORE - (ROADS[5] + RW / 2), CURB, 520);
    prom.translate((SHORE + ROADS[5] + RW / 2) / 2, CURB / 2, 0);
    plainUV(prom, 4, 4);
    const pm = new THREE.Mesh(prom, new THREE.MeshStandardMaterial({ map: this.T.concrete, color: 0xf2d9c8, roughness: 0.9 }));
    pm.receiveShadow = true;
    S.add(pm);
    for (let z = -250; z <= 250; z += 13) this.palmSpots.push([ROADS[5] + RW / 2 + 3, z, CURB, rand(0.95, 1.25)]);
    // beach slopes into the water
    const sand = noiseTex(512, '#e8cfa3', 0.12, 12000, 2); sand.repeat.set(30, 30);
    const bg = new THREE.PlaneGeometry(90, 560, 30, 4);
    bg.rotateX(-Math.PI / 2);
    const p = bg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 45; p.setY(i, -x * SLOPE); }
    bg.computeVertexNormals();
    bg.translate(SHORE + 45, 0, 0);
    const beach = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ map: sand, roughness: 1 }));
    beach.receiveShadow = true;
    S.add(beach);
    for (let k = 0; k < 26; k++) this.palmSpots.push([rand(SHORE + 4, SHORE + 22), rand(-240, 240), 0, rand(0.9, 1.3)]);
    // ocean
    const wn = waterNormal();
    wn.repeat.set(260, 260);
    const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshPhysicalMaterial({
      color: 0x0a3f55, roughness: 0.1, metalness: 0.2, normalMap: wn, normalScale: new THREE.Vector2(0.22, 0.22),
      envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.05, transparent: true, opacity: 0.94
    }));
    water.rotation.x = -Math.PI / 2;
    water.position.set(WATER_X + 1500 - 40, -0.45, 0);
    water.receiveShadow = true;
    S.add(water);
    this.water = water;
    // foam along the shoreline
    const foamTex = canvasTexture(256, 64, (g, w, h) => {
      for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.5})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, Math.random() * 3, 0, 7); g.fill(); }
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.5, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    foamTex.wrapS = THREE.RepeatWrapping; foamTex.repeat.set(40, 1);
    const foam = new THREE.Mesh(new THREE.PlaneGeometry(560, 5), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.8 }));
    foam.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
    const shoreX = SHORE + 0.45 / SLOPE; // where the sand meets the water
    foam.position.set(shoreX, -0.4, 0);
    S.add(foam);
    this.anim.push((t) => { wn.offset.set(t * 0.012, t * 0.007); foamTex.offset.x = t * 0.02; foam.position.x = shoreX + Math.sin(t * 0.8) * 1.2; foam.material.opacity = 0.55 + Math.sin(t * 0.8) * 0.25; });
    // lifeguard huts + umbrellas
    const hutCols = [0xff6fa5, 0x3fd0c9, 0xffd34d];
    [-150, -20, 110].forEach((z, k) => {
      const g = new THREE.Group();
      const hut = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 3), new THREE.MeshStandardMaterial({ color: hutCols[k], roughness: 0.6 }));
      hut.position.y = 3.6; hut.castShadow = true; g.add(hut);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.8, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
      roof.position.y = 5.4; roof.rotation.y = Math.PI / 4; g.add(roof);
      for (const [x, zz] of [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6), new THREE.MeshStandardMaterial({ color: 0xffffff })); l.position.set(x, 1.3, zz); g.add(l); }
      g.position.set(SHORE + 16, -16 * SLOPE, z);
      S.add(g);
      this.circles.push({ x: SHORE + 16, z, r: 2.4 });
    });
    const umb = [0xff3d6e, 0x19c3ff, 0xffb000, 0x7dff6a, 0xffffff];
    for (let k = 0; k < 22; k++) {
      const x = rand(SHORE + 6, SHORE + 26), z = rand(-230, 230);
      const c = new THREE.Mesh(new THREE.ConeGeometry(1.6, 0.7, 10), new THREE.MeshStandardMaterial({ color: pick(umb), roughness: 0.7 }));
      c.position.set(x, 2.2 - (x - SHORE) * SLOPE, z); c.castShadow = true;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.3), new THREE.MeshStandardMaterial({ color: 0xeeeeee }));
      pole.position.set(x, 1.1 - (x - SHORE) * SLOPE, z);
      S.add(c, pole);
    }
    // breakwaters at the ends of the beach
    for (const z of [-262, 262]) this.addSolid(SHORE - 6, 400, z - 6, z + 6);
  }

  // ---------------------------------------------------------------- the X-Platz
  buildPlaza() {
    const S = this.scene;
    const tex = canvasTexture(1024, 1024, (g, w, h) => {
      g.fillStyle = '#e9e1d4'; g.fillRect(0, 0, w, h);
      for (let r = 40; r < w * 0.75; r += 46) { g.strokeStyle = r % 92 === 40 ? '#cdbfa8' : '#d9cdb9'; g.lineWidth = 20; g.beginPath(); g.arc(w / 2, h / 2, r, 0, 7); g.stroke(); }
      g.strokeStyle = '#50af30'; g.lineWidth = 14;
      g.beginPath(); g.arc(w / 2, h / 2, 210, 0, 7); g.stroke();
      // a huge inlaid X across the plaza
      g.save(); g.translate(w / 2, h / 2);
      g.fillStyle = 'rgba(80,175,48,0.85)';
      for (const r of [Math.PI / 4, -Math.PI / 4]) { g.save(); g.rotate(r); g.fillRect(-28, -w * 0.62, 56, w * 1.24); g.restore(); }
      g.restore();
      for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.05})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    });
    const half = 40 - RW / 2;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 - 0.2, half * 2 - 0.2), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.55, metalness: 0.05 }));
    pl.rotation.x = -Math.PI / 2;
    pl.position.y = CURB + 0.012;
    pl.receiveShadow = true;
    S.add(pl);
    // pedestal
    const marble = new THREE.MeshPhysicalMaterial({ color: 0xf3f0ea, roughness: 0.2, clearcoat: 0.8 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 1.6, 48), marble);
    ped.position.y = CURB + 0.8; ped.castShadow = true; ped.receiveShadow = true;
    S.add(ped);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.12, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 0.5), toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = CURB + 1.3;
    S.add(ring);
    this.pedRing = ring;
    this.circles.push({ x: 0, z: 0, r: 4.3 });
    // the X itself (stolen at the start)
    this.xTile = buildXTile(3.4, { glow: 0.6 });
    this.xTile.position.set(0, CURB + 4.4, 0);
    S.add(this.xTile);
    this.beam = buildBeam(2.2, 140);
    this.beam.position.set(0, CURB + 1.6 + 70, 0);
    S.add(this.beam);
    this.setX(true);
    this.anim.push((t) => {
      this.xTile.rotation.y = t * 0.6;
      this.xTile.position.y = CURB + 4.4 + Math.sin(t * 1.4) * 0.25;
      this.beam.material.opacity = this.xHome ? 0.55 + Math.sin(t * 2) * 0.1 : 0;
    });
    // palms around the plaza
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + 0.26;
      this.palmSpots.push([Math.cos(a) * 24, Math.sin(a) * 24, CURB, 1.05]);
      this.circles.push({ x: Math.cos(a) * 24, z: Math.sin(a) * 24, r: 0.6 });
    }
    // benches
    const bm = new THREE.MeshStandardMaterial({ color: 0x8b5a2b, roughness: 0.7 });
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      const b = new THREE.Mesh(new THREE.BoxGeometry(3, 0.5, 0.8), bm);
      b.position.set(Math.cos(a) * 14, CURB + 0.45, Math.sin(a) * 14);
      b.rotation.y = -a + Math.PI / 2;
      b.castShadow = true;
      S.add(b);
    }
  }
  setX(home) {
    this.xHome = home;
    this.xTile.visible = home;
    this.pedRing.material.color.setRGB(home ? 0.6 : 3, home ? 3 : 0.4, home ? 0.5 : 0.3);
  }

  // ---------------------------------------------------------------- street lamps + palms (instanced)
  buildLamps() {
    const spots = [];
    for (const r of ROADS) for (let k = 0; k < ROADS.length - 1; k++) {
      const a = ROADS[k] + RW / 2 + 6, b = ROADS[k + 1] - RW / 2 - 6;
      for (let s = a; s <= b; s += 22) {
        spots.push([r + RW / 2 + 0.8, s, -1], [r - RW / 2 - 0.8, s, 1]); // vertical road, both sides; arm points to road
        spots.push([s, r + RW / 2 + 0.8, -2], [s, r - RW / 2 - 0.8, 2]);
      }
    }
    const pole = new THREE.CylinderGeometry(0.09, 0.14, 7, 6); pole.translate(0, 3.5, 0);
    const arm = new THREE.BoxGeometry(1.8, 0.1, 0.1); arm.translate(0.9, 7, 0);
    const poleGeo = mergeGeometries([pole, arm]);
    const head = new THREE.BoxGeometry(0.7, 0.18, 0.35); head.translate(1.7, 6.9, 0);
    const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.7, roughness: 0.4 }), spots.length);
    const heads = new THREE.InstancedMesh(head, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.8, 1.6), toneMapped: false }), spots.length);
    // fake light pools on the road
    const poolTex = canvasTexture(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,190,120,0.55)'); gr.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    const poolGeo = new THREE.PlaneGeometry(9, 9); poolGeo.rotateX(-Math.PI / 2); poolGeo.translate(2.4, 0.04, 0);
    const pools = new THREE.InstancedMesh(poolGeo, new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    spots.forEach(([x, z, dir], i) => {
      const ry = dir === -1 ? Math.PI : dir === 1 ? 0 : dir === -2 ? Math.PI / 2 : -Math.PI / 2;
      e.set(0, ry, 0); q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, CURB, z), q, one);
      poles.setMatrixAt(i, m); heads.setMatrixAt(i, m); pools.setMatrixAt(i, m);
    });
    poles.castShadow = true;
    this.scene.add(poles, heads, pools);
    this.buildPalms();
  }

  buildPalms() {
    // bent trunk + 9 drooping fronds
    const trunk = new THREE.CylinderGeometry(0.18, 0.32, 9, 7, 8);
    trunk.translate(0, 4.5, 0);
    const tp = trunk.attributes.position;
    for (let i = 0; i < tp.count; i++) { const y = tp.getY(i); tp.setX(i, tp.getX(i) + (y * y) * 0.012); }
    trunk.computeVertexNormals();
    const fronds = [];
    for (let k = 0; k < 9; k++) {
      const f = new THREE.PlaneGeometry(1.1, 4.4, 1, 6);
      const p = f.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 2.2; p.setY(i, y); p.setZ(i, -(y * y) * 0.09); }
      f.rotateX(-Math.PI / 2 + 0.35);
      f.rotateY((k / 9) * Math.PI * 2 + rand(-0.2, 0.2));
      f.translate(0.97, 9, 0);
      fronds.push(f);
    }
    const frondGeo = mergeGeometries(fronds);
    frondGeo.computeVertexNormals();
    const leaf = canvasTexture(64, 256, (g, w, h) => {
      g.strokeStyle = '#6b5a2a'; g.lineWidth = 3; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
      for (let y = 6; y < h; y += 6) {
        const len = (w / 2) * Math.sin((y / h) * Math.PI) * 0.95 + 4;
        g.strokeStyle = `hsl(${95 + Math.random() * 25}, 55%, ${24 + Math.random() * 12}%)`; g.lineWidth = 4;
        g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 - len, y + 10); g.moveTo(w / 2, y); g.lineTo(w / 2 + len, y + 10); g.stroke();
      }
    });
    const tm = new THREE.MeshStandardMaterial({ color: 0x8a6b4a, roughness: 0.95, map: noiseTex(64, '#8a6b4a', 0.3, 400, 3) });
    const fm = new THREE.MeshStandardMaterial({ map: leaf, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.8 });
    const n = this.palmSpots.length;
    const T = new THREE.InstancedMesh(trunk, tm, n), F = new THREE.InstancedMesh(frondGeo, fm, n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    this.palmSpots.forEach(([x, z, y, s], i) => {
      e.set(0, rand(0, Math.PI * 2), 0); q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * rand(0.9, 1.15), s));
      T.setMatrixAt(i, m); F.setMatrixAt(i, m);
    });
    T.castShadow = F.castShadow = true;
    this.scene.add(T, F);
    this.palms = F;
  }

  buildSkyline() {
    // far silhouettes behind the city edge (west/north/south), softened by the haze
    const list = [];
    for (let k = 0; k < 90; k++) {
      const a = rand(Math.PI * 0.55, Math.PI * 1.45);
      const r = rand(330, 600);
      const h = rand(30, 150);
      const w = rand(18, 40);
      list.push(cityBox(Math.cos(a) * r, 0, Math.sin(a) * r, w, h, w, 0x5d5470, { col: 1.6, floor: 2, uOff: Math.floor(Math.random() * 8) / 8 }));
    }
    const m = new THREE.Mesh(merge(list), new THREE.MeshStandardMaterial({ vertexColors: true, map: this.T.glass, emissiveMap: this.T.glassLit, emissive: 0xffc890, emissiveIntensity: 0.6, roughness: 0.5, metalness: 0.3 }));
    this.scene.add(m);
  }

  // ---------------------------------------------------------------- collision
  indexSolids() {
    const C = 40;
    const add = (key, o) => { if (!this.hash.has(key)) this.hash.set(key, []); this.hash.get(key).push(o); };
    for (const s of this.solids) for (let x = Math.floor(s.x0 / C); x <= Math.floor(s.x1 / C); x++) for (let z = Math.floor(s.z0 / C); z <= Math.floor(s.z1 / C); z++) add(x + ',' + z, s);
    for (const c of this.circles) for (let x = Math.floor((c.x - c.r) / C); x <= Math.floor((c.x + c.r) / C); x++) for (let z = Math.floor((c.z - c.r) / C); z <= Math.floor((c.z + c.r) / C); z++) add(x + ',' + z, c);
    this.cell = C;
  }
  /** pushes a circle (pos.x/pos.z, radius r) out of all obstacles; returns the push normal or null */
  collide(pos, r) {
    const C = this.cell;
    let nx = 0, nz = 0, hit = false;
    const seen = new Set();
    for (let x = Math.floor((pos.x - r) / C); x <= Math.floor((pos.x + r) / C); x++) for (let z = Math.floor((pos.z - r) / C); z <= Math.floor((pos.z + r) / C); z++) {
      const list = this.hash.get(x + ',' + z);
      if (!list) continue;
      for (const o of list) {
        if (seen.has(o)) continue;
        seen.add(o);
        if (o.r !== undefined) {
          const dx = pos.x - o.x, dz = pos.z - o.z, d = Math.hypot(dx, dz), min = o.r + r;
          if (d < min && d > 1e-4) { const k = (min - d) / d; pos.x += dx * k; pos.z += dz * k; nx += dx / d; nz += dz / d; hit = true; }
        } else {
          const cx = Math.max(o.x0, Math.min(pos.x, o.x1)), cz = Math.max(o.z0, Math.min(pos.z, o.z1));
          let dx = pos.x - cx, dz = pos.z - cz, d = Math.hypot(dx, dz);
          if (d < r) {
            if (d < 1e-4) { // centre inside the box: push out along the shortest axis
              const l = pos.x - o.x0, rr = o.x1 - pos.x, t = pos.z - o.z0, b = o.z1 - pos.z, m = Math.min(l, rr, t, b);
              if (m === l) { dx = -1; dz = 0; pos.x = o.x0 - r; } else if (m === rr) { dx = 1; dz = 0; pos.x = o.x1 + r; } else if (m === t) { dx = 0; dz = -1; pos.z = o.z0 - r; } else { dx = 0; dz = 1; pos.z = o.z1 + r; }
              nx += dx; nz += dz;
            } else { const k = (r - d) / d; pos.x += dx * k; pos.z += dz * k; nx += dx / d; nz += dz / d; }
            hit = true;
          }
        }
      }
    }
    // world bounds
    if (pos.x > WATER_X + 6) { pos.x = WATER_X + 6; nx -= 1; hit = true; }
    return hit ? { x: nx, z: nz } : null;
  }
  groundAt(x, z) {
    if (x > SHORE) return -(x - SHORE) * SLOPE;
    const onRoad = (v) => ROADS.some((r) => Math.abs(v - r) < RW / 2);
    if (x > ROADS[5] + RW / 2) return CURB;
    return onRoad(x) || onRoad(z) ? 0 : CURB;
  }
  inWater(x) { return x > WATER_X - 6; }
  /** is this point inside a building? (used to pull the camera in front of walls) */
  blocked(x, z, y = 0) {
    const list = this.hash.get(Math.floor(x / this.cell) + ',' + Math.floor(z / this.cell));
    if (!list) return false;
    for (const o of list) {
      if (o.r !== undefined) { if (y < 6 && Math.hypot(x - o.x, z - o.z) < o.r) return true; }
      else if (x > o.x0 && x < o.x1 && z > o.z0 && z < o.z1 && y < 60) return true;
    }
    return false;
  }

  // ---------------------------------------------------------------- radar map
  renderMap() {
    const N = 1024, k = N / MAP.size;
    const c = document.createElement('canvas'); c.width = c.height = N;
    const g = c.getContext('2d');
    const X = (x) => (x - MAP.x0) * k, Z = (z) => (z - MAP.z0) * k;
    g.fillStyle = '#2b3140'; g.fillRect(0, 0, N, N);
    g.fillStyle = '#1d5d7a'; g.fillRect(X(WATER_X - 10), 0, N, N);
    g.fillStyle = '#c9b48a'; g.fillRect(X(SHORE), 0, X(WATER_X - 10) - X(SHORE), N);
    g.fillStyle = '#7d8696';
    for (const r of ROADS) {
      g.fillRect(X(r - RW / 2), Z(ROADS[0] - RW / 2), RW * k, (ROADS[5] - ROADS[0] + RW) * k);
      g.fillRect(X(ROADS[0] - RW / 2), Z(r - RW / 2), (ROADS[5] - ROADS[0] + RW) * k, RW * k);
    }
    g.fillRect(X(ROADS[5] - RW / 2), 0, RW * k, N);
    g.fillStyle = '#3a4152';
    for (const s of this.solids) g.fillRect(X(s.x0), Z(s.z0), (s.x1 - s.x0) * k, (s.z1 - s.z0) * k);
    g.fillStyle = '#3f7a3a'; g.fillRect(X(40 + RW / 2 + 4), Z(40 + RW / 2 + 4), (80 - RW - 8) * k, (80 - RW - 8) * k);
    // the X-Platz
    g.fillStyle = '#50af30'; g.beginPath(); g.arc(X(0), Z(0), 26 * k, 0, 7); g.fill();
    g.strokeStyle = '#fff'; g.lineWidth = 5 * k;
    g.beginPath(); g.moveTo(X(-12), Z(-12)); g.lineTo(X(12), Z(12)); g.moveTo(X(12), Z(-12)); g.lineTo(X(-12), Z(12)); g.stroke();
    return c;
  }

  update(dt, t) { for (const f of this.anim) f(t, dt); }

  dispose() {
    this.scene.traverse((o) => { if (o.geometry) o.geometry.dispose(); if (o.material) [].concat(o.material).forEach((m) => { m.map?.dispose(); m.dispose(); }); });
    this.env?.dispose();
  }
}
