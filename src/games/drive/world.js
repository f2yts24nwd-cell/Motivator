import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, drawBrand, roundRect } from '../../core/gfx.js';
import { LIMIT } from './content.js';

// Ludlein: a 5x5 block city (Altstadt, itmX-Zentrale, Messe, Silo-Tower, Gewerbegebiet Süd, Park,
// Schule, Mörtelmeister), an Ausfallstraße to the Autobahn and the Industriepark Ost with Regalriese.
// Everything static is merged into a handful of meshes (one per material) to keep draw calls low.

export const GRID = [-300, -180, -60, 60, 180, 300];
export const RW = 12; // road width
const HALF = RW / 2;
export const CURB = 0.12; // sidewalk height
const rnd = (() => { let s = 7; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; })();
const rr = (a, b) => a + rnd() * (b - a);
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

// block styles, indexed [j][i] (j = row from north (-z) to south, i = column from west)
const BLOCKS = [
  ['altstadt', 'altstadt', 'resi', 'messe', 'messepark'],
  ['altstadt', 'kirche', 'office', 'office', 'silo'],
  ['resi', 'schule', 'zentrale', 'office', 'resi'],
  ['moertel', 'resi', 'office', 'park', 'resi'],
  ['gewerbe', 'fraesfix', 'gewerbe', 'tanke', 'gewerbe']
];
export const blockRect = (i, j) => ({ x0: GRID[i] + HALF, x1: GRID[i + 1] - HALF, z0: GRID[j] + HALF, z1: GRID[j + 1] - HALF });

// ------------------------------------------------------------------ places (missions, chargers, ...)
export const PLACES = {
  spawn: { x: -14, z: 63, heading: Math.PI / 2, name: 'itmX-Zentrale' },
  zentrale: { x: 0, z: 0, name: 'itmX-Zentrale' },
  fraesfix: { x: -120, z: 199, w: 5, l: 7, rot: 0, name: 'Fräsfix Maschinenbau', area: 'Gewerbegebiet Süd' },
  messe: { x: 240, z: -240, r: 70, name: 'Messe Ludlein', area: 'Messegelände' },
  regalriese: { x: 1452, z: -42, w: 5, l: 7, rot: Math.PI / 2, name: 'Regalriese Großhandel', area: 'Industriepark Ost' },
  racestart: { x: 177, z: -80, heading: 0, name: 'Ampel am Silo-Tower', area: 'Silo-Tower' },
  moertel: { x: -188, z: 120, name: 'Mörtelmeister Baustoffe', area: 'Westend' },
  silo: { x: 240, z: -120, name: 'Silo-Tower' }
};
export const CHARGERS = [
  { x: 30, z: 47, rot: 0, name: 'Ladepark itmX-Zentrale' },
  { x: 128, z: 197, rot: 0, name: 'Tankstelle Süd' },
  { x: 1452, z: -88, rot: Math.PI / 2, name: 'Industriepark Ost' }
];
// race route for Cloudius (and the finish)
export const RACE = {
  start: [{ x: 177, z: -80 }, { x: 183, z: -80 }], // player, Cloudius (both heading south, the light is at (180, -60))
  path: [[183, -80], [178, -48], [177, 48], [171, 57], [-172, 57], [-183, 66], [-183, 112]],
  finish: { x: -186, z: 116 }
};
export const LEAD_SPOTS = [
  [200, -205], [230, -260], [262, -220], [285, -280], [205, -285], [250, -195], [292, -195], [215, -240],
  [270, -250], [183, -230], [240, -297], [297, -240], [150, -177], [120, -303]
];
export const BLITZER = [
  { x: -120, z: 69, rot: 0 },
  { x: 365, z: -69, rot: 0 },
  { x: 172.5, z: 4, rot: Math.PI },
  { x: -240, z: -171, rot: 0 },
  { x: 69, z: 120, rot: Math.PI / 2 },
  { x: -51, z: -240, rot: Math.PI / 2 }
];

// ------------------------------------------------------------------ textures
function noiseFill(g, w, h, base, amp, n = 4000) {
  g.fillStyle = base; g.fillRect(0, 0, w, h);
  for (let i = 0; i < n; i++) {
    const v = Math.floor(rnd() * amp);
    g.fillStyle = `rgba(${v > amp / 2 ? 255 : 0},${v > amp / 2 ? 255 : 0},${v > amp / 2 ? 255 : 0},${0.02 + rnd() * 0.05})`;
    g.fillRect(rnd() * w, rnd() * h, 1 + rnd() * 2, 1 + rnd() * 2);
  }
}
function tex(w, h, draw, rep = true) {
  const t = canvasTexture(w, h, draw);
  if (rep) { t.wrapS = t.wrapT = THREE.RepeatWrapping; }
  t.anisotropy = 8;
  return t;
}
function makeTextures() {
  const T = {};
  T.road = tex(256, 512, (g, w, h) => {
    noiseFill(g, w, h, '#3b3e44', 60, 9000);
    g.fillStyle = '#e9e9e4';
    g.fillRect(8, 0, 5, h); g.fillRect(w - 13, 0, 5, h);
    g.fillRect(w / 2 - 3, 0, 6, h * 0.5);
    g.fillStyle = 'rgba(20,20,22,0.25)';
    g.fillRect(w * 0.18, 0, w * 0.12, h); g.fillRect(w * 0.7, 0, w * 0.12, h);
  });
  T.cobble = tex(256, 512, (g, w, h) => {
    g.fillStyle = '#5a5550'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -8 : 0; x < w; x += 16) {
      const v = 95 + Math.floor(rnd() * 40);
      g.fillStyle = `rgb(${v},${v - 6},${v - 12})`;
      roundRect(g, x + 1, y + 1, 14, 14, 4); g.fill();
    }
    g.fillStyle = 'rgba(240,240,235,0.85)';
    g.fillRect(w / 2 - 3, 0, 6, h * 0.5);
  });
  T.asphalt = tex(256, 256, (g, w, h) => noiseFill(g, w, h, '#3b3e44', 60, 6000));
  T.autobahn = tex(512, 512, (g, w, h) => {
    noiseFill(g, w, h, '#45484e', 60, 14000);
    const u = (m) => (m / 26) * w;
    g.fillStyle = '#ecece6';
    for (const m of [1.4, 11.9, 14.1, 24.6]) g.fillRect(u(m) - 2, 0, 4, h);
    for (const m of [4.9, 8.4, 17.6, 21.1]) g.fillRect(u(m) - 2, 0, 4, h * 0.36);
    g.fillStyle = '#3a4a3a'; g.fillRect(u(12.3), 0, u(1.4), h);
  });
  T.sidewalk = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#8f8d88'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 64) for (let x = 0; x < w; x += 64) {
      const v = 140 + Math.floor(rnd() * 24);
      g.fillStyle = `rgb(${v},${v - 2},${v - 6})`; g.fillRect(x + 2, y + 2, 60, 60);
    }
  });
  T.grass = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#4f7a35'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 9000; i++) { const v = rnd(); g.fillStyle = v < 0.5 ? 'rgba(30,60,20,0.18)' : 'rgba(150,190,90,0.14)'; g.fillRect(rnd() * w, rnd() * h, 1, 2 + rnd() * 3); }
  });
  T.field = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#9a8a4a'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 8) { g.fillStyle = x % 16 ? 'rgba(80,60,20,0.25)' : 'rgba(200,180,90,0.25)'; g.fillRect(x, 0, 4, h); }
  });
  // facades: one tile = 2 window bays (6 m) x 1 floor (3.2 m)
  T.office = tex(256, 256, (g, w, h) => {
    const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#5b7fa6'); gr.addColorStop(1, '#2d4766');
    g.fillStyle = '#cfd6de'; g.fillRect(0, 0, w, h);
    for (const x of [6, 134]) { g.fillStyle = gr; g.fillRect(x, 26, 116, 200); g.fillStyle = 'rgba(255,255,255,0.18)'; g.fillRect(x, 26, 50, 200); g.fillStyle = '#9aa3ad'; g.fillRect(x + 56, 26, 4, 200); }
  });
  T.plaster = tex(256, 256, (g, w, h) => {
    noiseFill(g, w, h, '#ffffff', 40, 3000);
    for (const x of [44, 172]) {
      g.fillStyle = '#d9d4cc'; g.fillRect(x - 6, 54, 52, 132);
      g.fillStyle = '#2f3a46'; g.fillRect(x, 60, 40, 120);
      g.fillStyle = 'rgba(255,255,255,0.25)'; g.fillRect(x, 60, 14, 120);
      g.fillStyle = '#f4f1ea'; g.fillRect(x + 18, 60, 4, 120); g.fillRect(x, 112, 40, 4);
      g.fillStyle = '#b9b2a6'; g.fillRect(x - 8, 184, 56, 8);
    }
  });
  T.industrial = tex(256, 256, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 10) { g.fillStyle = 'rgba(0,0,0,0.12)'; g.fillRect(x, 0, 4, h); }
    g.fillStyle = '#2c3540'; g.fillRect(0, 20, w, 40);
    g.fillStyle = 'rgba(255,255,255,0.2)'; g.fillRect(0, 20, w, 10);
  });
  T.roof = tex(128, 128, (g, w, h) => noiseFill(g, w, h, '#ffffff', 40, 1200));
  T.tiles = tex(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.fillRect(0, 0, w, h);
    for (let y = 0; y < h; y += 16) for (let x = (y / 16) % 2 ? -8 : 0; x < w; x += 16) { g.fillStyle = 'rgba(0,0,0,0.18)'; g.fillRect(x, y + 12, 16, 4); g.fillRect(x, y, 2, 16); }
  });
  return T;
}

// ------------------------------------------------------------------ geometry builder (merged quads)
class Geo {
  constructor() { this.p = []; this.n = []; this.uv = []; this.c = []; }
  quad(a, b, c, d, n, uvs, col) {
    // a b c d counter-clockwise seen from outside
    for (const [v, t] of [[a, uvs[0]], [b, uvs[1]], [c, uvs[2]], [a, uvs[0]], [c, uvs[2]], [d, uvs[3]]]) {
      this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]); this.uv.push(t[0], t[1]); this.c.push(col.r, col.g, col.b);
    }
  }
  tri(a, b, c, n, uvs, col) {
    for (const [v, t] of [[a, uvs[0]], [b, uvs[1]], [c, uvs[2]]]) { this.p.push(v[0], v[1], v[2]); this.n.push(n[0], n[1], n[2]); this.uv.push(t[0], t[1]); this.c.push(col.r, col.g, col.b); }
  }
  /** axis-aligned box walls (+ optional top) with world-scaled uvs */
  box(x0, y0, z0, x1, y1, z1, col, { su = 6, sv = 3.2, top = null, walls = true, bottomV = 0 } = {}) {
    const H = y1 - y0;
    if (walls) {
      const v0 = bottomV, v1 = bottomV + H / sv;
      // south (+z)
      this.quad([x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1], [0, 0, 1], [[0, v0], [(x1 - x0) / su, v0], [(x1 - x0) / su, v1], [0, v1]], col);
      // north (-z)
      this.quad([x1, y0, z0], [x0, y0, z0], [x0, y1, z0], [x1, y1, z0], [0, 0, -1], [[0, v0], [(x1 - x0) / su, v0], [(x1 - x0) / su, v1], [0, v1]], col);
      // east (+x)
      this.quad([x1, y0, z1], [x1, y0, z0], [x1, y1, z0], [x1, y1, z1], [1, 0, 0], [[0, v0], [(z1 - z0) / su, v0], [(z1 - z0) / su, v1], [0, v1]], col);
      // west (-x)
      this.quad([x0, y0, z0], [x0, y0, z1], [x0, y1, z1], [x0, y1, z0], [-1, 0, 0], [[0, v0], [(z1 - z0) / su, v0], [(z1 - z0) / su, v1], [0, v1]], col);
    }
    if (top) top.quad([x0, y1, z1], [x1, y1, z1], [x1, y1, z0], [x0, y1, z0], [0, 1, 0], [[x0 / 8, z1 / 8], [x1 / 8, z1 / 8], [x1 / 8, z0 / 8], [x0 / 8, z0 / 8]], top.col || col);
  }
  /** flat rectangle on the ground (y) with uv scale s (m per repeat) */
  rect(x0, z0, x1, z1, y, col, s = 4) {
    this.quad([x0, y, z1], [x1, y, z1], [x1, y, z0], [x0, y, z0], [0, 1, 0], [[x0 / s, z1 / s], [x1 / s, z1 / s], [x1 / s, z0 / s], [x0 / s, z0 / s]], col);
  }
  geometry() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(this.p, 3));
    g.setAttribute('normal', new THREE.Float32BufferAttribute(this.n, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(this.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(this.c, 3));
    return g;
  }
  get empty() { return this.p.length === 0; }
}
const C = (hex) => new THREE.Color(hex);
const WHITE = C('#ffffff');

// ------------------------------------------------------------------ text signs
export function signTexture(lines, { w = 1024, h = 256, bg = '#1b2433', fg = '#ffffff', accent = null, font = 'Segoe UI, Arial, sans-serif', logo = false } = {}) {
  return canvasTexture(w, h, (g) => {
    g.fillStyle = bg; roundRect(g, 0, 0, w, h, 26); g.fill();
    if (accent) { g.fillStyle = accent; g.fillRect(0, h - 22, w, 22); }
    let x = 40;
    if (logo) { drawBrand(g, 30, h * 0.14, h * 0.72, h * 0.72); x = h * 0.72 + 60; }
    g.fillStyle = fg;
    g.textBaseline = 'middle';
    const [l1, l2] = [].concat(lines);
    let size = l2 ? h * 0.38 : h * 0.5;
    g.font = `800 ${size}px ${font}`;
    while (g.measureText(l1).width > w - x - 30 && size > 20) { size -= 4; g.font = `800 ${size}px ${font}`; }
    g.fillText(l1, x, l2 ? h * 0.36 : h * 0.5);
    if (l2) { g.font = `600 ${h * 0.2}px ${font}`; g.globalAlpha = 0.85; g.fillText(l2, x, h * 0.72); g.globalAlpha = 1; }
  });
}
function limitTexture(v) {
  return canvasTexture(128, 128, (g, w, h) => {
    g.fillStyle = '#ffffff'; g.beginPath(); g.arc(w / 2, h / 2, 62, 0, Math.PI * 2); g.fill();
    if (v === Infinity) {
      // "Ende aller Streckenverbote": white disc with five thin black diagonals
      g.strokeStyle = '#333'; g.lineWidth = 3; g.beginPath(); g.arc(w / 2, h / 2, 58, 0, Math.PI * 2); g.stroke();
      g.save(); g.beginPath(); g.arc(w / 2, h / 2, 56, 0, Math.PI * 2); g.clip();
      g.strokeStyle = '#333'; g.lineWidth = 3;
      for (let i = -2; i <= 2; i++) { g.beginPath(); g.moveTo(20 + i * 9, 108 + i * 9); g.lineTo(108 + i * 9, 20 + i * 9); g.stroke(); }
      g.restore();
    } else {
      g.strokeStyle = '#d2131b'; g.lineWidth = 14; g.beginPath(); g.arc(w / 2, h / 2, 54, 0, Math.PI * 2); g.stroke();
      g.fillStyle = '#111'; g.font = `900 ${v >= 100 ? 46 : 58}px "Arial Narrow", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(String(v), w / 2, h / 2 + 3);
    }
  });
}

// ------------------------------------------------------------------ the world
export class World {
  constructor(renderer, { quality = 'high' } = {}) {
    this.scene = new THREE.Scene();
    this.quality = quality;
    this.T = makeTextures();
    this.colliders = [];
    this.roads = []; // straight road segments {ax, az, bx, bz, w, limit, kind}
    this.blocks = [];
    this.animated = [];
    this.buildSky(renderer);
    this.buildGround();
    this.buildCity();
    this.buildAutobahn();
    this.buildIndustriepark();
    this.buildLandscape();
    this.buildStreetFurniture();
    this.buildBlitzer();
    this.buildChargers();
    this.buildIndex();
  }

  // ---------------------------------------------------------------- sky, light
  buildSky(renderer) {
    const s = this.scene;
    const sky = new Sky();
    sky.scale.setScalar(9000);
    const u = sky.material.uniforms;
    u.turbidity.value = 6;
    u.rayleigh.value = 1.6;
    u.mieCoefficient.value = 0.005;
    u.mieDirectionalG.value = 0.82;
    const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 16), THREE.MathUtils.degToRad(-128));
    u.sunPosition.value.copy(sun);
    this.sunDir = sun.clone();
    // environment for reflections: sky + a dark ground
    const envScene = new THREE.Scene();
    const sky2 = new Sky();
    sky2.scale.setScalar(1000);
    sky2.material.uniforms.sunPosition.value.copy(sun);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) sky2.material.uniforms[k].value = u[k].value;
    envScene.add(sky2);
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(900, 24), new THREE.MeshBasicMaterial({ color: 0x3a3a36 }));
    gnd.rotation.x = -Math.PI / 2; gnd.position.y = -5;
    envScene.add(gnd);
    const pm = new THREE.PMREMGenerator(renderer);
    this.env = pm.fromScene(envScene, 0.02).texture;
    pm.dispose();
    s.add(sky);
    s.environment = this.env;
    s.environmentIntensity = 0.75;
    s.fog = new THREE.Fog(0xd6c0a4, 320, 1900);
    s.background = null;
    const hemi = new THREE.HemisphereLight(0xbdd4ff, 0x5a4a3a, 0.75);
    s.add(hemi);
    const sunL = new THREE.DirectionalLight(0xffd2a0, 2.6);
    sunL.castShadow = true;
    const sm = this.quality === 'high' ? 2048 : 1024;
    sunL.shadow.mapSize.set(sm, sm);
    const r = 70;
    Object.assign(sunL.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 10, far: 500 });
    sunL.shadow.bias = -0.0006;
    sunL.shadow.normalBias = 0.05;
    s.add(sunL, sunL.target);
    this.sun = sunL;
  }
  followSun(pos) {
    // keep the shadow camera around the player (snapped to texels to avoid shimmering)
    const step = 2;
    const x = Math.round(pos.x / step) * step, z = Math.round(pos.z / step) * step;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunDir.x * 250, this.sunDir.y * 250, z + this.sunDir.z * 250);
  }

  // ---------------------------------------------------------------- ground
  buildGround() {
    // subdivided so depth interpolation stays precise under the thin road layers
    const g = new THREE.PlaneGeometry(7000, 7000, 70, 70);
    g.rotateX(-Math.PI / 2);
    const t = this.T.grass.clone(); t.needsUpdate = true; t.repeat.set(350, 350);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: t, roughness: 0.95 }));
    m.position.set(600, -0.08, 0);
    m.receiveShadow = true;
    this.scene.add(m);
  }

  // ---------------------------------------------------------------- city
  buildCity() {
    const T = this.T;
    const roadG = new Geo(), cobbleG = new Geo(), asphaltG = new Geo(), walkG = new Geo(), grassG = new Geo(), zebraG = new Geo();
    const officeG = new Geo(), plasterG = new Geo(), indG = new Geo(), roofG = new Geo(), tileG = new Geo();
    roofG.col = C('#8a8d92');
    this.geo = { officeG, plasterG, indG, roofG, tileG, asphaltG, grassG };
    // block rectangles + kinds
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) {
      const r = blockRect(i, j);
      this.blocks.push({ i, j, kind: BLOCKS[j][i], ...r });
    }
    const zone30Blocks = this.blocks.filter((b) => ['altstadt', 'kirche', 'schule'].includes(b.kind));
    const cobbleBlocks = this.blocks.filter((b) => ['altstadt', 'kirche'].includes(b.kind));
    const near = (list, x, z, m) => list.some((b) => x > b.x0 - m && x < b.x1 + m && z > b.z0 - m && z < b.z1 + m);
    // roads
    for (let j = 0; j < 6; j++) for (let i = 0; i < 5; i++) {
      this.addCityRoad(GRID[i], GRID[j], GRID[i + 1], GRID[j], near(zone30Blocks, (GRID[i] + GRID[i + 1]) / 2, GRID[j], 8), near(cobbleBlocks, (GRID[i] + GRID[i + 1]) / 2, GRID[j], 8) ? cobbleG : roadG);
    }
    for (let i = 0; i < 6; i++) for (let j = 0; j < 5; j++) {
      this.addCityRoad(GRID[i], GRID[j], GRID[i], GRID[j + 1], near(zone30Blocks, GRID[i], (GRID[j] + GRID[j + 1]) / 2, 8), near(cobbleBlocks, GRID[i], (GRID[j] + GRID[j + 1]) / 2, 8) ? cobbleG : roadG);
    }
    for (const x of GRID) for (const z of GRID) asphaltG.rect(x - HALF, z - HALF, x + HALF, z + HALF, 0.005, WHITE, 8);
    // crosswalks at the inner intersections
    for (const x of GRID.slice(1, 5)) for (const z of GRID.slice(1, 5)) {
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const cx = x + dx * (HALF + 2.2), cz = z + dz * (HALF + 2.2);
        for (let k = -2; k <= 2; k++) {
          if (dx) zebraG.rect(cx - 1.2, cz + k * 2.2 - 0.5, cx + 1.2, cz + k * 2.2 + 0.5, 0.012, WHITE, 100);
          else zebraG.rect(cx + k * 2.2 - 0.5, cz - 1.2, cx + k * 2.2 + 0.5, cz + 1.2, 0.012, WHITE, 100);
        }
      }
    }
    // sidewalks (curb slabs)
    for (const b of this.blocks) {
      walkG.box(b.x0, 0, b.z0, b.x1, CURB, b.z1, C('#9a9892'), { su: 3, sv: 3, top: null });
      walkG.rect(b.x0, b.z0, b.x1, b.z1, CURB, WHITE, 3);
      this.fillBlock(b);
    }
    const mesh = (geo, mat, { shadow = true, cast = false } = {}) => {
      if (geo.empty) return null;
      const m = new THREE.Mesh(geo.geometry(), mat);
      m.receiveShadow = shadow;
      m.castShadow = cast;
      this.scene.add(m);
      return m;
    };
    const rep = (t) => t;
    mesh(roadG, new THREE.MeshStandardMaterial({ map: rep(T.road), roughness: 0.92 }));
    mesh(cobbleG, new THREE.MeshStandardMaterial({ map: rep(T.cobble), roughness: 0.95 }));
    mesh(asphaltG, new THREE.MeshStandardMaterial({ map: T.asphalt, roughness: 0.92, vertexColors: true }));
    mesh(zebraG, new THREE.MeshStandardMaterial({ color: 0xeeeeea, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2 }));
    mesh(walkG, new THREE.MeshStandardMaterial({ map: T.sidewalk, roughness: 0.9, vertexColors: true }));
    mesh(grassG, new THREE.MeshStandardMaterial({ map: T.grass, roughness: 0.95, vertexColors: true, polygonOffset: true, polygonOffsetFactor: -1 }));
    mesh(officeG, new THREE.MeshStandardMaterial({ map: T.office, roughness: 0.5, metalness: 0.15, vertexColors: true, envMapIntensity: 0.6 }), { cast: true });
    mesh(plasterG, new THREE.MeshStandardMaterial({ map: T.plaster, roughness: 0.85, vertexColors: true }), { cast: true });
    mesh(indG, new THREE.MeshStandardMaterial({ map: T.industrial, roughness: 0.6, metalness: 0.3, vertexColors: true }), { cast: true });
    mesh(roofG, new THREE.MeshStandardMaterial({ map: T.roof, roughness: 0.9, vertexColors: true }), { cast: true });
    mesh(tileG, new THREE.MeshStandardMaterial({ map: T.tiles, roughness: 0.8, vertexColors: true }), { cast: true });
  }

  addCityRoad(ax, az, bx, bz, zone30, geo) {
    const horiz = az === bz;
    const len = horiz ? bx - ax : bz - az;
    const L = len - RW;
    const vRep = 12;
    if (horiz) {
      const z0 = az - HALF, z1 = az + HALF, x0 = ax + HALF, x1 = bx - HALF;
      geo.quad([x0, 0.01, z1], [x1, 0.01, z1], [x1, 0.01, z0], [x0, 0.01, z0], [0, 1, 0], [[1, 0], [1, L / vRep], [0, L / vRep], [0, 0]], WHITE);
    } else {
      const x0 = ax - HALF, x1 = ax + HALF, z0 = az + HALF, z1 = bz - HALF;
      geo.quad([x0, 0.01, z1], [x1, 0.01, z1], [x1, 0.01, z0], [x0, 0.01, z0], [0, 1, 0], [[0, L / vRep], [1, L / vRep], [1, 0], [0, 0]], WHITE);
    }
    this.roads.push({ ax, az, bx, bz, w: RW, limit: zone30 ? LIMIT.zone30 : LIMIT.city, kind: 'city', zone30 });
  }

  addBuilding(geo, x0, z0, x1, z1, h, col, { y0 = CURB, collide = true, roof = true, su = 6, sv = 3.2 } = {}) {
    geo.box(x0, y0, z0, x1, y0 + h, z1, col, { su, sv, top: roof ? this.geo.roofG : null });
    if (collide) this.colliders.push({ t: 'box', x0, z0, x1, z1 });
  }
  gable(x0, z0, x1, z1, y, rh, col, alongX) {
    // pitched roof: ridge along the longer side
    const G = this.geo.tileG;
    const o = 0.5;
    if (alongX) {
      const zm = (z0 + z1) / 2;
      G.quad([x0 - o, y, z1 + o], [x1 + o, y, z1 + o], [x1 + o, y + rh, zm], [x0 - o, y + rh, zm], [0, 0.7, 0.7], [[0, 0], [(x1 - x0) / 4, 0], [(x1 - x0) / 4, 2], [0, 2]], col);
      G.quad([x1 + o, y, z0 - o], [x0 - o, y, z0 - o], [x0 - o, y + rh, zm], [x1 + o, y + rh, zm], [0, 0.7, -0.7], [[0, 0], [(x1 - x0) / 4, 0], [(x1 - x0) / 4, 2], [0, 2]], col);
      const wc = C('#e8e0d0');
      this.geo.plasterG.tri([x1, y, z1], [x1, y, z0], [x1, y + rh, zm], [1, 0, 0], [[0, 0], [0.1, 0], [0.05, 0.1]], wc);
      this.geo.plasterG.tri([x0, y, z0], [x0, y, z1], [x0, y + rh, zm], [-1, 0, 0], [[0, 0], [0.1, 0], [0.05, 0.1]], wc);
    } else {
      const xm = (x0 + x1) / 2;
      G.quad([x1 + o, y, z1 + o], [x1 + o, y, z0 - o], [xm, y + rh, z0 - o], [xm, y + rh, z1 + o], [0.7, 0.7, 0], [[0, 0], [(z1 - z0) / 4, 0], [(z1 - z0) / 4, 2], [0, 2]], col);
      G.quad([x0 - o, y, z0 - o], [x0 - o, y, z1 + o], [xm, y + rh, z1 + o], [xm, y + rh, z0 - o], [-0.7, 0.7, 0], [[0, 0], [(z1 - z0) / 4, 0], [(z1 - z0) / 4, 2], [0, 2]], col);
      const wc = C('#e8e0d0');
      this.geo.plasterG.tri([x0, y, z1], [x1, y, z1], [xm, y + rh, z1], [0, 0, 1], [[0, 0], [0.1, 0], [0.05, 0.1]], wc);
      this.geo.plasterG.tri([x1, y, z0], [x0, y, z0], [xm, y + rh, z0], [0, 0, -1], [[0, 0], [0.1, 0], [0.05, 0.1]], wc);
    }
  }

  fillBlock(b) {
    const { officeG, plasterG, indG, asphaltG, grassG } = this.geo;
    const ix0 = b.x0 + 4, ix1 = b.x1 - 4, iz0 = b.z0 + 4, iz1 = b.z1 - 4; // inner lot
    const W = ix1 - ix0, D = iz1 - iz0;
    const pastel = ['#f2d7b6', '#e9c3c0', '#cfe0c8', '#f4e7b0', '#c9d8ea', '#efe9e0', '#e7cfa8', '#d8c7e6'];
    const officeTint = ['#ffffff', '#e6eef8', '#dfe8e8', '#f2ece4'];
    const add = (geo, x0, z0, x1, z1, h, col, o) => this.addBuilding(geo, x0, z0, x1, z1, h, C(col), o);
    switch (b.kind) {
      case 'altstadt': case 'kirche': {
        // row houses along all four sides, gable roofs, courtyard in the middle
        const depth = 11;
        const rows = [['n', ix0, ix1], ['s', ix0, ix1], ['w', iz0 + depth, iz1 - depth], ['e', iz0 + depth, iz1 - depth]];
        for (const [side, a0, a1] of rows) {
          let a = a0;
          while (a < a1 - 6) {
            const wdt = Math.min(a1 - a, rr(8, 13));
            const hh = rr(9, 14);
            const col = C(pick(pastel));
            const roofCol = C(pick(['#b5523b', '#a4472f', '#8f3c2a', '#6d5a50']));
            let x0, x1, z0, z1;
            if (side === 'n') { x0 = a; x1 = a + wdt; z0 = iz0; z1 = iz0 + depth; }
            if (side === 's') { x0 = a; x1 = a + wdt; z0 = iz1 - depth; z1 = iz1; }
            if (side === 'w') { x0 = ix0; x1 = ix0 + depth; z0 = a; z1 = a + wdt; }
            if (side === 'e') { x0 = ix1 - depth; x1 = ix1; z0 = a; z1 = a + wdt; }
            this.addBuilding(plasterG, x0, z0, x1, z1, hh, col, { roof: false, su: 5.2, sv: 3 });
            this.gable(x0, z0, x1, z1, CURB + hh, rr(3.5, 5), roofCol, side === 'n' || side === 's');
            a += wdt;
          }
        }
        grassG.rect(ix0 + depth, iz0 + depth, ix1 - depth, iz1 - depth, CURB + 0.01, C('#ffffff'), 6);
        this.trees(ix0 + depth + 6, iz0 + depth + 6, ix1 - depth - 6, iz1 - depth - 6, 7);
        if (b.kind === 'kirche') this.church((b.x0 + b.x1) / 2, (b.z0 + b.z1) / 2);
        break;
      }
      case 'resi': {
        const depth = 13;
        for (const side of ['n', 's', 'w', 'e']) {
          const along = side === 'n' || side === 's';
          const a0 = along ? ix0 : iz0 + depth, a1 = along ? ix1 : iz1 - depth;
          let a = a0;
          while (a < a1 - 8) {
            const wdt = Math.min(a1 - a, rr(18, 30));
            const hh = 3.2 * Math.floor(rr(4, 7));
            const col = pick(pastel);
            let x0, x1, z0, z1;
            if (side === 'n') { x0 = a; x1 = a + wdt; z0 = iz0; z1 = iz0 + depth; }
            if (side === 's') { x0 = a; x1 = a + wdt; z0 = iz1 - depth; z1 = iz1; }
            if (side === 'w') { x0 = ix0; x1 = ix0 + depth; z0 = a; z1 = a + wdt; }
            if (side === 'e') { x0 = ix1 - depth; x1 = ix1; z0 = a; z1 = a + wdt; }
            add(plasterG, x0, z0, x1, z1, hh, col);
            a += wdt + (rnd() < 0.3 ? 4 : 0);
          }
        }
        grassG.rect(ix0 + depth, iz0 + depth, ix1 - depth, iz1 - depth, CURB + 0.01, C('#ffffff'), 6);
        this.trees(ix0 + depth + 5, iz0 + depth + 5, ix1 - depth - 5, iz1 - depth - 5, 6);
        break;
      }
      case 'office': {
        const n = 2;
        const cw = W / n, cd = D / n;
        for (let a = 0; a < n; a++) for (let c = 0; c < n; c++) {
          const m = rr(5, 9);
          const x0 = ix0 + a * cw + m, x1 = ix0 + (a + 1) * cw - m, z0 = iz0 + c * cd + m, z1 = iz0 + (c + 1) * cd - m;
          const hh = 3.6 * Math.floor(rr(5, 14));
          add(officeG, x0, z0, x1, z1, hh, pick(officeTint), { su: 6, sv: 3.6 });
          if (rnd() < 0.5) add(officeG, x0 + 4, z0 + 4, x1 - 4, z1 - 4, hh + 7.2, pick(officeTint), { su: 6, sv: 3.6 });
        }
        asphaltG.rect(ix0, iz0, ix1, iz1, CURB + 0.005, C('#9a9a9a'), 8);
        break;
      }
      case 'gewerbe': {
        const halls = rnd() < 0.5 ? 1 : 2;
        for (let k = 0; k < halls; k++) {
          const x0 = ix0 + 8 + k * (W / halls), x1 = ix0 + (k + 1) * (W / halls) - 8;
          const z0 = iz0 + 26, z1 = iz1 - 8;
          add(indG, x0, z0, x1, z1, rr(8, 12), pick(['#d7dde4', '#c9c2b5', '#9fb3c8', '#e2d5c0']), { su: 6, sv: 9 });
        }
        asphaltG.rect(ix0, iz0, ix1, iz1, CURB + 0.005, C('#a0a0a0'), 8);
        break;
      }
      case 'park': {
        grassG.rect(ix0 - 2, iz0 - 2, ix1 + 2, iz1 + 2, CURB + 0.01, C('#ffffff'), 6);
        const pond = new THREE.Mesh(new THREE.CircleGeometry(16, 32), new THREE.MeshStandardMaterial({ color: 0x2a5d7a, roughness: 0.05, metalness: 0.6 }));
        pond.rotation.x = -Math.PI / 2;
        pond.position.set((b.x0 + b.x1) / 2 + 12, CURB + 0.03, (b.z0 + b.z1) / 2 - 8);
        this.scene.add(pond);
        this.colliders.push({ t: 'circle', x: pond.position.x, z: pond.position.z, r: 15 });
        this.trees(ix0 + 4, iz0 + 4, ix1 - 4, iz1 - 4, 34);
        break;
      }
      case 'schule': {
        add(plasterG, ix0 + 10, iz0 + 8, ix1 - 10, iz0 + 30, 9.6, '#f3c46b');
        add(plasterG, ix0 + 10, iz0 + 30, ix0 + 30, iz1 - 30, 9.6, '#f3c46b');
        asphaltG.rect(ix0 + 30, iz0 + 36, ix1 - 8, iz1 - 8, CURB + 0.005, C('#b9a99a'), 8);
        this.sign(['Grundschule Ludlein', 'Langsam fahren!'], (b.x0 + b.x1) / 2, iz0 + 30.2, 0, 11, 12, { bg: '#f3c46b', fg: '#3a2a10' }, 2.6);
        this.trees(ix0 + 36, iz0 + 40, ix1 - 12, iz1 - 12, 5);
        break;
      }
      case 'zentrale': this.zentrale(b); break;
      case 'messe': this.messe(b); break;
      case 'messepark': {
        asphaltG.rect(b.x0 - 0.5, b.z0 - 0.5, b.x1 + 0.5, b.z1 + 0.5, CURB + 0.008, C('#7c7f86'), 8);
        // parking lines
        const lines = new Geo();
        for (let r = 0; r < 4; r++) for (let k = 0; k < 18; k++) lines.rect(b.x0 + 8 + k * 5.4, b.z0 + 14 + r * 24, b.x0 + 8.2 + k * 5.4, b.z0 + 19 + r * 24, CURB + 0.02, WHITE, 100);
        const m = new THREE.Mesh(lines.geometry(), new THREE.MeshStandardMaterial({ color: 0xe8e8e0, roughness: 0.8 }));
        this.scene.add(m);
        this.sign(['Messe Ludlein', 'Parkplatz P1'], b.x0 + 4, b.z1 - 4, Math.PI / 4, 9, 3, { bg: '#0d5aa7' }, 2.2);
        break;
      }
      case 'silo': this.siloTower(b); break;
      case 'moertel': this.moertel(b); break;
      case 'fraesfix': this.fraesfix(b); break;
      case 'tanke': this.tanke(b); break;
      default: break;
    }
  }

  trees(x0, z0, x1, z1, n) {
    this.treeSpots = this.treeSpots || [];
    for (let k = 0; k < n; k++) this.treeSpots.push([rr(x0, x1), rr(z0, z1), rr(0.8, 1.3), CURB]);
  }

  sign(lines, x, z, rot, w, y, opts = {}, hgt = null) {
    const t = signTexture(lines, opts);
    const h = hgt || w / 4;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshStandardMaterial({ map: t, roughness: 0.5, emissive: 0xffffff, emissiveMap: t, emissiveIntensity: 0.35, side: THREE.DoubleSide }));
    m.position.set(x, y, z);
    m.rotation.y = rot;
    this.scene.add(m);
    return m;
  }

  church(cx, cz) {
    const g = this.geo;
    this.addBuilding(g.plasterG, cx - 9, cz - 16, cx + 9, cz + 12, 14, C('#efe6d6'), { roof: false });
    this.gable(cx - 9, cz - 16, cx + 9, cz + 12, CURB + 14, 8, C('#6b5146'), false);
    this.addBuilding(g.plasterG, cx - 5, cz + 12, cx + 5, cz + 22, 30, C('#efe6d6'), { roof: false });
    const spire = new THREE.Mesh(new THREE.ConeGeometry(7.2, 18, 4), new THREE.MeshStandardMaterial({ color: 0x4f7a6a, roughness: 0.6, metalness: 0.3 }));
    spire.position.set(cx, CURB + 30 + 9, cz + 17);
    spire.rotation.y = Math.PI / 4;
    spire.castShadow = true;
    this.scene.add(spire);
  }

  zentrale(b) {
    const g = this.geo;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    // tower
    const x0 = cx - 40, x1 = cx - 8, z0 = cz - 42, z1 = cz - 10;
    this.addBuilding(g.officeG, x0, z0, x1, z1, 64.8, C('#e2f1e0'), { su: 6, sv: 3.6 });
    this.addBuilding(g.officeG, x0 + 4, z0 + 4, x1 - 4, z1 - 4, 72, C('#e2f1e0'), { su: 6, sv: 3.6 });
    // green crown + logo signs
    const crown = new THREE.Mesh(new THREE.BoxGeometry(x1 - x0 - 8, 1.2, z1 - z0 - 8), new THREE.MeshStandardMaterial({ color: 0x50af30, emissive: 0x50af30, emissiveIntensity: 1.2 }));
    crown.position.set((x0 + x1) / 2, CURB + 72.6, (z0 + z1) / 2);
    this.scene.add(crown);
    const logoT = canvasTexture(512, 512, (gg, w, h) => { gg.fillStyle = '#ffffff'; roundRect(gg, 0, 0, w, h, 60); gg.fill(); drawBrand(gg, 60, 60, w - 120, h - 120); });
    const logoM = new THREE.MeshStandardMaterial({ map: logoT, emissive: 0xffffff, emissiveMap: logoT, emissiveIntensity: 0.6 });
    for (const [x, z, r] of [[(x0 + x1) / 2, z1 + 0.1, 0], [x1 + 0.1, (z0 + z1) / 2, Math.PI / 2], [(x0 + x1) / 2, z0 - 0.1, Math.PI], [x0 - 0.1, (z0 + z1) / 2, -Math.PI / 2]]) {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), logoM);
      m.position.set(x, CURB + 56, z);
      m.rotation.y = r;
      this.scene.add(m);
    }
    // Fuhrpark pavilion (glass box, lit inside)
    const px0 = cx + 2, px1 = cx + 46, pz0 = cz - 40, pz1 = cz - 12;
    const glass = new THREE.Mesh(new THREE.BoxGeometry(px1 - px0, 7, pz1 - pz0), new THREE.MeshStandardMaterial({ color: 0x9fc7e0, roughness: 0.05, metalness: 0.9, emissive: 0x2a3a2a, emissiveIntensity: 0.4 }));
    glass.position.set((px0 + px1) / 2, CURB + 3.5, (pz0 + pz1) / 2);
    glass.castShadow = true;
    this.scene.add(glass);
    const proof = new THREE.Mesh(new THREE.BoxGeometry(px1 - px0 + 2, 0.6, pz1 - pz0 + 2), new THREE.MeshStandardMaterial({ color: 0x1b1f26, roughness: 0.5 }));
    proof.position.set((px0 + px1) / 2, CURB + 7.3, (pz0 + pz1) / 2);
    this.scene.add(proof);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(px1 - px0 + 2.1, 0.15, pz1 - pz0 + 2.1), new THREE.MeshStandardMaterial({ color: 0x50af30, emissive: 0x50af30, emissiveIntensity: 2 }));
    strip.position.copy(proof.position).add(new THREE.Vector3(0, -0.3, 0));
    this.scene.add(strip);
    this.colliders.push({ t: 'box', x0: px0, z0: pz0, x1: px1, z1: pz1 });
    this.sign(['itmX Fuhrpark', 'Showroom & Ladepark'], (px0 + px1) / 2, pz1 + 1.2, 0, 14, 9.4, { logo: true, bg: '#101820' }, 3.5);
    // plaza + parking with chargers
    g.asphaltG.rect(b.x0 + 4, cz - 4, b.x1 - 4, b.z1 - 4, CURB + 0.005, C('#c4c0b8'), 6);
    g.grassG.rect(b.x0 + 4, b.z0 + 4, x0 - 4, cz - 6, CURB + 0.01, WHITE, 6);
    this.trees(b.x0 + 6, b.z0 + 6, x0 - 6, cz - 8, 6);
    // a few staff cars parked (decoration handled by traffic module)
    this.parkedSpots = [[cx - 30, cz + 30, 0], [cx - 24, cz + 30, 0], [cx - 18, cz + 30, 0], [cx - 6, cz + 30, 0]];
  }

  messe(b) {
    const g = this.geo;
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const hallMat = new THREE.MeshStandardMaterial({ color: 0xdfe6ee, roughness: 0.35, metalness: 0.5 });
    for (const [x, z, w, d] of [[cx - 22, cz - 10, 38, 70], [cx + 26, cz - 10, 30, 70]]) {
      this.addBuilding(g.indG, x - w / 2, z - d / 2, x + w / 2, z + d / 2, 8, C('#d0dbe8'), { roof: false, su: 6, sv: 9 });
      const roof = new THREE.Mesh(new THREE.CylinderGeometry(w / 2, w / 2, d, 24, 1, false, -Math.PI / 2, Math.PI), hallMat);
      roof.rotation.x = -Math.PI / 2;
      roof.scale.set(1, 1, 0.45);
      roof.position.set(x, CURB + 8, z);
      roof.castShadow = true;
      this.scene.add(roof);
    }
    this.sign(['Messe Ludlein', 'CRM & SAP Expo 2026'], cx, b.z1 - 6, 0, 22, 6, { bg: '#0d5aa7', accent: '#ffcc00' }, 5);
    g.asphaltG.rect(b.x0 + 4, b.z1 - 22, b.x1 - 4, b.z1 - 4, CURB + 0.005, C('#d0ccc4'), 6);
    // flags
    const flagCols = [0x50af30, 0x0d5aa7, 0xffcc00, 0xe8412c];
    for (let k = 0; k < 8; k++) {
      const x = b.x0 + 10 + k * 13, z = b.z1 - 8;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 9, 6), new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 }));
      pole.position.set(x, CURB + 4.5, z);
      this.scene.add(pole);
      const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 3.2), new THREE.MeshStandardMaterial({ color: flagCols[k % 4], side: THREE.DoubleSide, roughness: 0.8 }));
      flag.position.set(x + 0.75, CURB + 7, z);
      this.scene.add(flag);
      this.animated.push((t) => { flag.rotation.y = Math.sin(t * 2 + k) * 0.25; });
      this.colliders.push({ t: 'circle', x, z, r: 0.3 });
    }
  }

  siloTower(b) {
    const cx = (b.x0 + b.x1) / 2, cz = (b.z0 + b.z1) / 2;
    const darkM = new THREE.MeshStandardMaterial({ color: 0x1a1830, roughness: 0.15, metalness: 0.8 });
    const tower = new THREE.Mesh(new THREE.CylinderGeometry(15, 18, 86, 8), darkM);
    tower.position.set(cx, CURB + 43, cz);
    tower.castShadow = true;
    this.scene.add(tower);
    this.colliders.push({ t: 'circle', x: cx, z: cz, r: 18.5 });
    const bandM = new THREE.MeshStandardMaterial({ color: 0x8a6bff, emissive: 0x7a5cff, emissiveIntensity: 2.2 });
    for (let k = 0; k < 6; k++) {
      const band = new THREE.Mesh(new THREE.CylinderGeometry(15.2 + k * 0.45, 15.2 + k * 0.45, 0.5, 8, 1, true), bandM);
      band.position.set(cx, CURB + 80 - k * 13, cz);
      band.scale.setScalar(1 + (5 - k) * 0.012);
      this.scene.add(band);
    }
    // the cloud on top
    const cloudM = new THREE.MeshStandardMaterial({ color: 0xf4f4ff, roughness: 0.9, emissive: 0x6a5cff, emissiveIntensity: 0.15 });
    const cloud = new THREE.Group();
    for (const [x, y, z, r] of [[0, 0, 0, 14], [12, -3, 5, 10], [-12, -2, 3, 11], [5, 4, -9, 10], [-6, -4, -10, 9], [14, -5, -6, 8], [-15, -6, -4, 7]]) {
      const s = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 2), cloudM);
      s.position.set(x, y, z);
      cloud.add(s);
    }
    cloud.position.set(cx, CURB + 98, cz);
    this.scene.add(cloud);
    this.animated.push((t) => { cloud.position.y = CURB + 98 + Math.sin(t * 0.6) * 1.2; cloud.rotation.y = t * 0.05; });
    this.sign(['Cloudius von Silo', 'Cloud-CRM · Jetzt mit noch mehr Schnittstellen!'], cx, cz + 20.5, 0, 22, 8, { bg: '#22183f', fg: '#e6e0ff', accent: '#8a6bff' }, 5);
    this.geo.asphaltG.rect(b.x0 + 4, b.z0 + 4, b.x1 - 4, b.z1 - 4, CURB + 0.005, C('#55546a'), 8);
  }

  moertel(b) {
    const g = this.geo;
    this.addBuilding(g.indG, b.x0 + 10, b.z0 + 10, b.x0 + 60, b.z0 + 42, 10, C('#f2b24a'), { su: 6, sv: 9 });
    this.sign(['Mörtelmeister', 'Baustoffe · Bauzulieferer'], b.x0 + 35, b.z0 + 42.2, 0, 18, 7.4, { bg: '#f2a516', fg: '#2a1a00', accent: '#7a4a00' }, 4.2);
    g.asphaltG.rect(b.x0 + 4, b.z0 + 4, b.x1 - 4, b.z1 - 4, CURB + 0.005, C('#b8afa2'), 8);
    // pallets and sand piles
    const palM = new THREE.MeshStandardMaterial({ color: 0xc8a06a, roughness: 0.9 });
    const sackM = new THREE.MeshStandardMaterial({ color: 0xe8e2d4, roughness: 0.95 });
    for (let k = 0; k < 14; k++) {
      const x = b.x0 + 14 + (k % 7) * 7, z = b.z0 + 56 + Math.floor(k / 7) * 10;
      const p = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.3, 2), palM);
      p.position.set(x, CURB + 0.15, z);
      this.scene.add(p);
      const s = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1 + (k % 3) * 0.4, 1.8), sackM);
      s.position.set(x, CURB + 0.3 + s.geometry.parameters.height / 2, z);
      s.castShadow = true;
      this.scene.add(s);
      this.colliders.push({ t: 'box', x0: x - 1.2, z0: z - 1, x1: x + 1.2, z1: z + 1 });
    }
    for (const [x, z, r] of [[b.x0 + 80, b.z0 + 24, 7], [b.x0 + 92, b.z0 + 44, 5]]) {
      const pile = new THREE.Mesh(new THREE.ConeGeometry(r, r * 0.7, 18), new THREE.MeshStandardMaterial({ color: 0xc9a46a, roughness: 1 }));
      pile.position.set(x, CURB + r * 0.35, z);
      pile.castShadow = true;
      this.scene.add(pile);
      this.colliders.push({ t: 'circle', x, z, r: r * 0.85 });
    }
  }

  fraesfix(b) {
    const g = this.geo;
    // sawtooth hall
    const x0 = b.x0 + 14, x1 = b.x1 - 14, z0 = b.z0 + 34, z1 = b.z1 - 10;
    this.addBuilding(g.indG, x0, z0, x1, z1, 9, C('#9fb3c8'), { su: 6, sv: 9, roof: false });
    const n = 6, step = (z1 - z0) / n;
    for (let k = 0; k < n; k++) {
      const za = z0 + k * step, zb = za + step;
      g.roofG.quad([x0, CURB + 9, zb], [x1, CURB + 9, zb], [x1, CURB + 13, za + step * 0.2], [x0, CURB + 13, za + step * 0.2], [0, 0.6, 0.8], [[0, 0], [1, 0], [1, 1], [0, 1]], C('#7f8a96'));
      g.officeG.quad([x1, CURB + 9, za], [x0, CURB + 9, za], [x0, CURB + 13, za + step * 0.2], [x1, CURB + 13, za + step * 0.2], [0, 0.3, -1], [[0, 0], [(x1 - x0) / 6, 0], [(x1 - x0) / 6, 1], [0, 1]], C('#ffffff'));
    }
    this.sign(['Fräsfix Maschinenbau', 'Präzision seit 1962'], (x0 + x1) / 2, z0 - 0.2, Math.PI, 20, 6.2, { bg: '#0f5b8f', accent: '#19c3ff' }, 4.4);
    const s2 = this.sign(['Fräsfix Maschinenbau', 'Besucherparkplätze'], b.x0 + 30, b.z0 + 6, 0, 9, 3, { bg: '#0f5b8f', accent: '#19c3ff' }, 2.2);
    s2.rotation.y = 0;
    g.asphaltG.rect(b.x0 + 4, b.z0 + 4, b.x1 - 4, z0 - 2, CURB + 0.005, C('#9a9da2'), 8);
    this.parkedLots = (this.parkedLots || []).concat([[b.x0 + 20, b.z0 + 20], [b.x0 + 26, b.z0 + 20], [b.x1 - 30, b.z0 + 20], [b.x1 - 24, b.z0 + 20]]);
  }

  tanke(b) {
    const g = this.geo;
    const cx = b.x0 + 34, cz = b.z0 + 32;
    g.asphaltG.rect(b.x0 + 4, b.z0 + 4, b.x1 - 4, b.z1 - 4, CURB + 0.005, C('#8f9196'), 8);
    const canopy = new THREE.Mesh(new THREE.BoxGeometry(30, 1.2, 18), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.5 }));
    canopy.position.set(cx, CURB + 6, cz);
    canopy.castShadow = true;
    this.scene.add(canopy);
    const band = new THREE.Mesh(new THREE.BoxGeometry(30.2, 0.5, 18.2), new THREE.MeshStandardMaterial({ color: 0x50af30, emissive: 0x50af30, emissiveIntensity: 1.4 }));
    band.position.set(cx, CURB + 5.8, cz);
    this.scene.add(band);
    for (const [dx, dz] of [[-10, -5], [10, -5], [-10, 5], [10, 5]]) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.6, 6, 0.6), new THREE.MeshStandardMaterial({ color: 0xdddddd }));
      p.position.set(cx + dx, CURB + 3, cz + dz);
      this.scene.add(p);
      this.colliders.push({ t: 'circle', x: cx + dx, z: cz + dz, r: 0.6 });
    }
    this.addBuilding(g.plasterG, b.x1 - 40, b.z0 + 14, b.x1 - 10, b.z0 + 34, 4.5, C('#f4f4f4'));
    this.sign(['Tankstelle & E-Laden', 'Kaffee · Snacks · 300 kW'], b.x1 - 25, b.z0 + 34.2, 0, 12, 6.2, { bg: '#1d6b2a', accent: '#a6f07a' }, 3);
  }

  // ---------------------------------------------------------------- autobahn
  buildAutobahn() {
    const pts = [[300, -60], [440, -60], [620, -60], [800, -110], [980, -190], [1160, -150], [1300, -70], [1380, -60], [1420, -60]];
    // Ausfallstraße (70) from the city edge to the autobahn
    const ausG = new Geo();
    ausG.quad([306, 0.01, -54], [440, 0.01, -54], [440, 0.01, -66], [306, 0.01, -66], [0, 1, 0], [[1, 0], [1, 134 / 12], [0, 134 / 12], [0, 0]], WHITE);
    this.roads.push({ ax: 306, az: -60, bx: 440, bz: -60, w: RW, limit: LIMIT.land, kind: 'land' });
    const ausM = new THREE.Mesh(ausG.geometry(), new THREE.MeshStandardMaterial({ map: this.T.road, roughness: 0.92 }));
    ausM.receiveShadow = true;
    this.scene.add(ausM);
    this.colliders.push({ t: 'seg', ax: 306, az: -67.5, bx: 440, bz: -67.5 }, { t: 'seg', ax: 306, az: -52.5, bx: 440, bz: -52.5 });
    const curve = new THREE.CatmullRomCurve3(pts.slice(1, -1).map(([x, z]) => new THREE.Vector3(x, 0, z)), false, 'catmullrom', 0.5);
    this.abCurve = curve;
    const len = curve.getLength();
    this.abLen = len;
    const N = Math.ceil(len / 4);
    const P = curve.getSpacedPoints(N);
    this.abPts = P;
    const g = new Geo();
    const WFULL = 26;
    const widthAt = (d) => {
      const a = Math.min(1, d / 50), b = Math.min(1, (len - d) / 50);
      return 12 + (WFULL - 12) * Math.min(a, b);
    };
    this.abWidthAt = widthAt;
    const rails = { l: [], r: [], m: [] };
    for (let i = 0; i < N; i++) {
      const p0 = P[i], p1 = P[i + 1];
      const d0 = (i / N) * len, d1 = ((i + 1) / N) * len;
      const t0 = this.tangent(i), t1 = this.tangent(i + 1);
      const n0 = new THREE.Vector3(t0.z, 0, -t0.x), n1 = new THREE.Vector3(t1.z, 0, -t1.x); // left normal
      const w0 = widthAt(d0) / 2, w1 = widthAt(d1) / 2;
      const a = [p0.x + n0.x * w0, 0.012, p0.z + n0.z * w0], b2 = [p0.x - n0.x * w0, 0.012, p0.z - n0.z * w0];
      const c = [p1.x - n1.x * w1, 0.012, p1.z - n1.z * w1], d = [p1.x + n1.x * w1, 0.012, p1.z + n1.z * w1];
      const v0 = d0 / 24, v1 = d1 / 24;
      g.quad(b2, c, d, a, [0, 1, 0], [[1, v0], [1, v1], [0, v1], [0, v0]], WHITE);
      if (w0 > 12) {
        rails.l.push([p0.x + n0.x * (w0 + 0.8), p0.z + n0.z * (w0 + 0.8)]);
        rails.r.push([p0.x - n0.x * (w0 + 0.8), p0.z - n0.z * (w0 + 0.8)]);
      }
      if (d0 > 70 && d0 < len - 70) rails.m.push([p0.x, p0.z]);
    }
    const m = new THREE.Mesh(g.geometry(), new THREE.MeshStandardMaterial({ map: this.T.autobahn, roughness: 0.9 }));
    m.receiveShadow = true;
    this.scene.add(m);
    // guard rails + median barrier
    const railG = [], barG = [];
    const addRail = (pts2, h, list, thick) => {
      for (let i = 0; i < pts2.length - 1; i++) {
        const [ax, az] = pts2[i], [bx, bz] = pts2[i + 1];
        const l = Math.hypot(bx - ax, bz - az);
        const geo = new THREE.BoxGeometry(thick, h, l + 0.05);
        geo.rotateY(Math.atan2(bx - ax, bz - az));
        geo.translate((ax + bx) / 2, h / 2 + (thick < 0.3 ? 0.45 : 0), (az + bz) / 2);
        list.push(geo);
        this.colliders.push({ t: 'seg', ax, az, bx, bz });
      }
    };
    addRail(rails.l, 0.32, railG, 0.12);
    addRail(rails.r, 0.32, railG, 0.12);
    addRail(rails.m, 0.85, barG, 0.6);
    if (railG.length) { const rm = new THREE.Mesh(mergeGeometries(railG), new THREE.MeshStandardMaterial({ color: 0xc9ccd1, metalness: 0.85, roughness: 0.35 })); rm.castShadow = true; this.scene.add(rm); }
    if (barG.length) { const bm = new THREE.Mesh(mergeGeometries(barG), new THREE.MeshStandardMaterial({ color: 0xbab6ad, roughness: 0.85 })); bm.castShadow = true; bm.receiveShadow = true; this.scene.add(bm); }
    // big blue signs + billboards
    this.abSign(0.08, ['Industriepark Ost', 'Ludlein-Ost  3 km'], -1);
    this.abSign(0.9, ['Ludlein Zentrum', 'Messe · Altstadt · itmX'], 1);
    this.billboard(0.45, -24, ['itmX crm suite', 'Schnittstellenfrei im SAP.'], { bg: '#ffffff', fg: '#1d2a1a', accent: '#50af30', logo: true });
    this.billboard(0.62, 24, ['Cloudius Cloud-CRM', 'Integration? Kommt nächstes Quartal!'], { bg: '#22183f', fg: '#e6e0ff', accent: '#8a6bff' });
    this.billboard(0.25, 26, ['Hilti', 'Die linke Spur gehört uns.'], { bg: '#c8101a', fg: '#ffffff', accent: '#ffffff' });
    // speed signs
    this.limitSign(this.abPoint(0.03, -15), this.abHeading(0.03), 120);
    this.limitSign(this.abPoint(0.3, -15), this.abHeading(0.3), Infinity);
    this.limitSign(this.abPoint(0.97, 15), this.abHeading(0.97) + Math.PI, 120);
    this.limitSign(this.abPoint(0.7, 15), this.abHeading(0.7) + Math.PI, Infinity);
    this.limitSign(new THREE.Vector3(312, 0, -70), Math.PI / 2, 70);
    this.limitSign(new THREE.Vector3(432, 0, -50), -Math.PI / 2, 70);
    this.limitSign(new THREE.Vector3(296, 0, -50), -Math.PI / 2, 50);
  }
  tangent(i) {
    const P = this.abPts;
    const a = P[Math.max(0, i - 1)], b = P[Math.min(P.length - 1, i + 1)];
    return new THREE.Vector3(b.x - a.x, 0, b.z - a.z).normalize();
  }
  /** point on the autobahn at param t (0..1) shifted by `off` metres to the left (negative = right) */
  abPoint(t, off = 0) {
    const p = this.abCurve.getPointAt(t), tg = this.abCurve.getTangentAt(t);
    return new THREE.Vector3(p.x + tg.z * off, 0, p.z - tg.x * off);
  }
  abHeading(t) { const tg = this.abCurve.getTangentAt(t); return Math.atan2(tg.x, tg.z); }
  abSign(t, lines, side) {
    const p = this.abPoint(t, 0);
    const hdg = this.abHeading(t) + (side < 0 ? 0 : Math.PI);
    const tx = signTexture(lines, { bg: '#1747a6', fg: '#ffffff', w: 1024, h: 384 });
    const board = new THREE.Mesh(new THREE.PlaneGeometry(13, 4.8), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.6, side: THREE.DoubleSide }));
    board.position.set(p.x, 7.5, p.z);
    board.rotation.y = hdg + Math.PI;
    const off = new THREE.Vector3(Math.sin(hdg + Math.PI / 2), 0, Math.cos(hdg + Math.PI / 2)).multiplyScalar(side * 6.5);
    board.position.add(off);
    this.scene.add(board);
    const gantry = new THREE.Mesh(new THREE.BoxGeometry(28, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0xaaaaaa, metalness: 0.8, roughness: 0.4 }));
    gantry.position.set(p.x, 10.1, p.z);
    gantry.rotation.y = hdg + Math.PI / 2;
    this.scene.add(gantry);
    for (const s of [-1, 1]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.5, 10.3, 0.5), gantry.material);
      leg.position.set(p.x + Math.sin(hdg + Math.PI / 2) * 14 * s, 5.15, p.z + Math.cos(hdg + Math.PI / 2) * 14 * s);
      this.scene.add(leg);
    }
  }
  billboard(t, off, lines, opts) {
    const p = this.abPoint(t, off);
    const hdg = this.abHeading(t);
    const tx = signTexture(lines, { ...opts, w: 1024, h: 400 });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(16, 6.25), new THREE.MeshStandardMaterial({ map: tx, roughness: 0.5, emissive: 0xffffff, emissiveMap: tx, emissiveIntensity: 0.25 }));
    m.position.set(p.x, 7, p.z);
    m.rotation.y = hdg + Math.PI + (off < 0 ? 0.35 : -0.35);
    const back = new THREE.Mesh(new THREE.BoxGeometry(16.4, 6.6, 0.3), new THREE.MeshStandardMaterial({ color: 0x333333 }));
    back.position.copy(m.position);
    back.rotation.copy(m.rotation);
    back.translateZ(-0.2);
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 4, 8), back.material);
    pole.position.set(p.x, 2, p.z);
    this.scene.add(m, back, pole);
    const m2 = m.clone();
    m2.rotation.y += Math.PI;
    m2.position.copy(back.position);
    m2.translateZ(-0.2);
    this.scene.add(m2);
  }
  limitSign(pos, heading, v) {
    if (!this.limitMats) this.limitMats = new Map();
    if (!this.limitMats.has(v)) this.limitMats.set(v, new THREE.MeshStandardMaterial({ map: limitTexture(v), roughness: 0.5, transparent: true }));
    const g = new THREE.Group();
    const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 2.6, 6), new THREE.MeshStandardMaterial({ color: 0x9a9da2, metalness: 0.7 }));
    pole.position.y = 1.3;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(0.42, 24), this.limitMats.get(v));
    disc.position.set(0, 2.5, 0.06);
    g.add(pole, disc);
    g.position.copy(pos);
    g.rotation.y = heading + Math.PI; // face oncoming traffic
    this.scene.add(g);
  }

  buildIndustriepark() {
    const g = new Geo();
    // loop road (rectangle) around the Regalriese lot
    const x0 = 1420, x1 = 1600, z0 = -150, z1 = 30;
    const seg = (ax, az, bx, bz) => {
      const horiz = az === bz;
      const L = horiz ? Math.abs(bx - ax) : Math.abs(bz - az);
      if (horiz) g.quad([Math.min(ax, bx) - HALF, 0.01, az + HALF], [Math.max(ax, bx) + HALF, 0.01, az + HALF], [Math.max(ax, bx) + HALF, 0.01, az - HALF], [Math.min(ax, bx) - HALF, 0.01, az - HALF], [0, 1, 0], [[1, 0], [1, L / 12], [0, L / 12], [0, 0]], WHITE);
      else g.quad([ax - HALF, 0.01, Math.max(az, bz) + HALF], [ax + HALF, 0.01, Math.max(az, bz) + HALF], [ax + HALF, 0.01, Math.min(az, bz) - HALF], [ax - HALF, 0.01, Math.min(az, bz) - HALF], [0, 1, 0], [[0, L / 12], [1, L / 12], [1, 0], [0, 0]], WHITE);
      this.roads.push({ ax, az, bx, bz, w: RW, limit: LIMIT.city, kind: 'loop' });
    };
    seg(x0, z0, x1, z0); seg(x0, z1, x1, z1); seg(x0, z0, x0, z1); seg(x1, z0, x1, z1);
    seg(1380, -60, x0, -60); // connector from the autobahn
    const m = new THREE.Mesh(g.geometry(), new THREE.MeshStandardMaterial({ map: this.T.road, roughness: 0.92 }));
    m.receiveShadow = true;
    this.scene.add(m);
    const lot = new Geo();
    lot.rect(x0 + HALF, z0 + HALF, x1 - HALF, z1 - HALF, 0.008, C('#8f9196'), 8);
    const lm = new THREE.Mesh(lot.geometry(), new THREE.MeshStandardMaterial({ map: this.T.asphalt, roughness: 0.92, vertexColors: true }));
    lm.receiveShadow = true;
    this.scene.add(lm);
    // Regalriese warehouse
    const wg = new Geo(), rg = new Geo();
    wg.box(1480, 0, -120, 1585, 16, 0, C('#b7a3e0'), { su: 6, sv: 9, top: rg });
    rg.col = C('#8a8d92');
    this.colliders.push({ t: 'box', x0: 1480, z0: -120, x1: 1585, z1: 0 });
    const wm = new THREE.Mesh(wg.geometry(), new THREE.MeshStandardMaterial({ map: this.T.industrial, roughness: 0.6, metalness: 0.3, vertexColors: true }));
    wm.castShadow = true; wm.receiveShadow = true;
    const rm = new THREE.Mesh(rg.geometry(), new THREE.MeshStandardMaterial({ map: this.T.roof, roughness: 0.9, vertexColors: true }));
    this.scene.add(wm, rm);
    this.sign(['Regalriese', 'Großhandel KG · Wareneingang'], 1479.8, -60, -Math.PI / 2, 30, 12, { bg: '#5b2fa6', accent: '#d6c2ff' }, 7);
    // docks + trucks
    for (let k = 0; k < 5; k++) {
      const truck = new THREE.Mesh(new THREE.BoxGeometry(2.5, 3.6, 12), new THREE.MeshStandardMaterial({ color: k % 2 ? 0xffffff : 0xd9d9d9, roughness: 0.6 }));
      truck.position.set(1470 - 0.5 * 0, 1.8 + 0.2, -110 + k * 4.2 - 200);
      truck.position.set(1500 + k * 16, 2, 8.5);
      truck.rotation.y = 0;
      truck.castShadow = true;
      this.scene.add(truck);
      this.colliders.push({ t: 'box', x0: truck.position.x - 1.25, z0: 2.5, x1: truck.position.x + 1.25, z1: 14.5 });
    }
    this.trees(1610, -160, 1660, 40, 16);
  }

  // ---------------------------------------------------------------- landscape (fields, hills, wind turbines)
  buildLandscape() {
    const fieldM = new THREE.MeshStandardMaterial({ map: this.T.field, roughness: 1, polygonOffset: true, polygonOffsetFactor: -1 });
    const fg = [];
    for (const [x, z, w, d, r] of [[560, 40, 160, 120, 0.1], [720, 70, 200, 140, -0.05], [900, 0, 180, 120, 0.2], [700, -260, 220, 130, 0.05], [1000, -340, 200, 140, -0.1], [1220, 60, 160, 120, 0], [1180, -330, 160, 120, 0.15], [-520, 0, 160, 420, 0], [0, -520, 500, 150, 0], [0, 470, 520, 150, 0]]) {
      const p = new THREE.PlaneGeometry(w, d, 8, 8);
      p.rotateX(-Math.PI / 2);
      p.rotateY(r);
      p.translate(x, -0.04, z);
      fg.push(p);
    }
    const fields = new THREE.Mesh(mergeGeometries(fg), fieldM);
    fields.receiveShadow = true;
    this.scene.add(fields);
    // distant hills
    const hillM = new THREE.MeshStandardMaterial({ color: 0x5e7a52, roughness: 1, flatShading: true });
    const hg = [];
    for (let k = 0; k < 26; k++) {
      const a = (k / 26) * Math.PI * 2;
      const r = 1900 + rr(-200, 300);
      const geo = new THREE.IcosahedronGeometry(1, 1);
      geo.scale(rr(260, 480), rr(90, 220), rr(260, 420));
      geo.translate(600 + Math.cos(a) * r * 1.2, -20, -60 + Math.sin(a) * r);
      hg.push(geo);
    }
    this.scene.add(new THREE.Mesh(mergeGeometries(hg.map((g) => (g.index ? g.toNonIndexed() : g))), hillM));
    // wind turbines
    const tm = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.5 });
    for (const [x, z] of [[760, 150], [840, 210], [930, 130], [1100, -320], [1180, -260], [640, -230]]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 2, 70, 10), tm);
      tower.position.set(x, 35, z);
      tower.castShadow = true;
      const hub = new THREE.Group();
      hub.position.set(x, 70, z + 2);
      const nac = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.4, 6), tm);
      nac.position.set(x, 70, z - 1);
      for (let b = 0; b < 3; b++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.4, 28, 0.4), tm);
        blade.geometry.translate(0, 14, 0);
        blade.rotation.z = (b / 3) * Math.PI * 2;
        hub.add(blade);
      }
      this.scene.add(tower, hub, nac);
      const sp = rr(0.6, 0.9);
      this.animated.push((t) => { hub.rotation.z = t * sp; });
      this.colliders.push({ t: 'circle', x, z, r: 2.5 });
    }
  }

  // ---------------------------------------------------------------- lamps, trees, traffic lights (instanced)
  buildStreetFurniture() {
    // street lamps along every city road (both sides, every ~30 m)
    const lampPos = [];
    for (const r of this.roads) {
      if (r.kind !== 'city' && r.kind !== 'loop') continue;
      const horiz = r.az === r.bz;
      const len = horiz ? Math.abs(r.bx - r.ax) : Math.abs(r.bz - r.az);
      for (let d = 18; d < len - 12; d += 32) {
        for (const s of [-1, 1]) {
          const x = horiz ? Math.min(r.ax, r.bx) + d : r.ax + s * (HALF + 0.9);
          const z = horiz ? r.az + s * (HALF + 0.9) : Math.min(r.az, r.bz) + d;
          lampPos.push([x, z, horiz ? (s > 0 ? Math.PI : 0) : (s > 0 ? -Math.PI / 2 : Math.PI / 2), r.kind === 'loop' ? 0 : CURB]);
        }
      }
    }
    for (let d = 80; d < this.abLen - 80; d += 40) {
      const t = d / this.abLen;
      const p = this.abPoint(t, 0);
      lampPos.push([p.x, p.z, this.abHeading(t), 0, true]);
    }
    const poleG = new THREE.CylinderGeometry(0.08, 0.12, 8, 6);
    poleG.translate(0, 4, 0);
    const armG = new THREE.BoxGeometry(0.12, 0.12, 2.2);
    armG.translate(0, 7.95, 1.0);
    const headG = new THREE.BoxGeometry(0.5, 0.16, 0.9);
    headG.translate(0, 7.85, 2.0);
    const poleM = new THREE.MeshStandardMaterial({ color: 0x5b6068, metalness: 0.7, roughness: 0.4 });
    const headM = new THREE.MeshStandardMaterial({ color: 0xfff3d6, emissive: 0xffd7a0, emissiveIntensity: 1.6 });
    const lampGeo = mergeGeometries([poleG.toNonIndexed(), armG.toNonIndexed()]);
    const im = new THREE.InstancedMesh(lampGeo, poleM, lampPos.length * 2);
    const ih = new THREE.InstancedMesh(headG, headM, lampPos.length * 2);
    const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), one = new THREE.Vector3(1, 1, 1);
    let n = 0;
    for (const [x, z, rot, y, median] of lampPos) {
      const rots = median ? [rot + Math.PI / 2, rot - Math.PI / 2] : [rot];
      for (const r of rots) {
        q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r);
        m4.compose(new THREE.Vector3(x, y, z), q, one);
        im.setMatrixAt(n, m4); ih.setMatrixAt(n, m4); n++;
      }
      this.colliders.push({ t: 'circle', x, z, r: median ? 0.5 : 0.22 });
    }
    im.count = ih.count = n;
    im.castShadow = true;
    this.scene.add(im, ih);
    // trees
    const spots = this.treeSpots || [];
    // street trees along a few avenues
    for (let k = -280; k <= 280; k += 22) {
      if (Math.abs(k - 60) < 14 || Math.abs(k + 60) < 14 || Math.abs(k - 180) < 14 || Math.abs(k + 180) < 14) continue;
      spots.push([k, -60 + HALF + 2.2, 1, CURB], [k, -60 - HALF - 2.2, 1, CURB]);
    }
    const trunkG = new THREE.CylinderGeometry(0.18, 0.28, 3.2, 6);
    trunkG.translate(0, 1.6, 0);
    const crownG = new THREE.IcosahedronGeometry(2.4, 1);
    crownG.scale(1, 1.15, 1);
    crownG.translate(0, 4.6, 0);
    const trunks = new THREE.InstancedMesh(trunkG, new THREE.MeshStandardMaterial({ color: 0x5a4030, roughness: 1 }), spots.length);
    const crowns = new THREE.InstancedMesh(crownG, new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9, flatShading: true }), spots.length);
    const greens = ['#3f7a32', '#4d8a3a', '#5a9440', '#6c9a3c', '#3a6d38'].map((c) => new THREE.Color(c));
    spots.forEach(([x, z, s, y], i) => {
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), rnd() * 6.28);
      m4.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s, s));
      trunks.setMatrixAt(i, m4);
      crowns.setMatrixAt(i, m4);
      crowns.setColorAt(i, pick(greens));
      this.colliders.push({ t: 'circle', x, z, r: 0.45 * s });
    });
    trunks.castShadow = crowns.castShadow = true;
    crowns.receiveShadow = true;
    this.scene.add(trunks, crowns);
    // traffic lights at selected intersections
    this.lights = [];
    const lightNodes = [[1, 1], [2, 1], [3, 1], [1, 2], [3, 2], [2, 3], [3, 3], [1, 4], [4, 3]];
    const housing = new THREE.MeshStandardMaterial({ color: 0x1b1d20, roughness: 0.5 });
    this.lightMats = {
      r: [new THREE.MeshStandardMaterial({ color: 0x330505 }), new THREE.MeshStandardMaterial({ color: 0xff2020, emissive: 0xff1010, emissiveIntensity: 3 })],
      y: [new THREE.MeshStandardMaterial({ color: 0x332605 }), new THREE.MeshStandardMaterial({ color: 0xffc020, emissive: 0xffb000, emissiveIntensity: 3 })],
      g: [new THREE.MeshStandardMaterial({ color: 0x05300f }), new THREE.MeshStandardMaterial({ color: 0x30ff70, emissive: 0x10ff50, emissiveIntensity: 3 })]
    };
    const bulbG = new THREE.CircleGeometry(0.13, 12);
    for (const [i, j] of lightNodes) this.addTrafficLight(GRID[i], GRID[j], housing, bulbG, i * 7 + j * 3);
    // the race start light (south bound on x=180 near the Silo-Tower)
    this.raceLight = this.addTrafficLight(GRID[4], GRID[2], housing, bulbG, 0);
  }

  addTrafficLight(x, z, housing, bulbG, phase) {
    const node = { x, z, phase, groups: { ns: [], ew: [] }, state: { ns: 'g', ew: 'r' } };
    // one pole per corner, facing the approaching traffic of one axis
    const corners = [[1, 1, 'ns', 0], [-1, -1, 'ns', Math.PI], [-1, 1, 'ew', -Math.PI / 2], [1, -1, 'ew', Math.PI / 2]];
    for (const [sx, sz, axis, rot] of corners) {
      const g = new THREE.Group();
      g.position.set(x + sx * (HALF + 0.8), CURB, z + sz * (HALF + 0.8));
      g.rotation.y = rot;
      const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 3.4, 6), housing);
      pole.position.y = 1.7;
      const box = new THREE.Mesh(new THREE.BoxGeometry(0.4, 1.1, 0.25), housing);
      box.position.y = 3.6;
      g.add(pole, box);
      const bulbs = {};
      ['r', 'y', 'g'].forEach((c, k) => {
        const b = new THREE.Mesh(bulbG, this.lightMats[c][0]);
        b.position.set(0, 3.95 - k * 0.35, 0.13);
        g.add(b);
        bulbs[c] = b;
      });
      node.groups[axis].push(bulbs);
      this.scene.add(g); // no collider: corner poles would catch every tight right turn
    }
    this.lights.push(node);
    this.setLight(node, 'ns', 'g');
    this.setLight(node, 'ew', 'r');
    return node;
  }
  setLight(node, axis, state) {
    node.state[axis] = state;
    for (const b of node.groups[axis]) for (const c of ['r', 'y', 'g']) b[c].material = this.lightMats[c][(state === c || (state === 'ry' && (c === 'r' || c === 'y'))) ? 1 : 0];
  }
  updateLights(t) {
    const cycle = 22;
    for (const n of this.lights) {
      if (n.manual) continue;
      const p = (t + n.phase) % cycle;
      const ns = p < 9 ? 'g' : p < 11 ? 'y' : p < 22 ? 'r' : 'r';
      const ew = p < 11 ? 'r' : p < 20 ? 'g' : 'y';
      if (n.state.ns !== ns) this.setLight(n, 'ns', ns);
      if (n.state.ew !== ew) this.setLight(n, 'ew', ew);
    }
  }
  /** state for a car approaching the node from direction (dx, dz) */
  lightFor(x, z, dx, dz) {
    const n = this.lightAt.get(`${x},${z}`);
    if (!n) return null;
    return Math.abs(dz) > Math.abs(dx) ? n.state.ns : n.state.ew;
  }

  // ---------------------------------------------------------------- blitzer + chargers
  buildBlitzer() {
    const bodyM = new THREE.MeshStandardMaterial({ color: 0x8f9298, roughness: 0.5, metalness: 0.5 });
    const glassM = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.1, metalness: 0.8 });
    this.blitzer = BLITZER.map((b) => {
      const g = new THREE.Group();
      const pole = new THREE.Mesh(new THREE.BoxGeometry(0.5, 2.4, 0.5), bodyM);
      pole.position.y = 1.2;
      const head = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.8, 0.6), bodyM);
      head.position.y = 2.6;
      const lens = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.3), glassM);
      lens.position.set(0, 2.7, 0.31);
      const flashM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0 });
      const flash = new THREE.Mesh(new THREE.PlaneGeometry(0.3, 0.18), flashM);
      flash.position.set(0, 2.38, 0.31);
      g.add(pole, head, lens, flash);
      g.position.set(b.x, CURB, b.z);
      g.rotation.y = b.rot;
      g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(g);
      this.colliders.push({ t: 'circle', x: b.x, z: b.z, r: 0.45 });
      return { ...b, group: g, flashM, cool: 0 };
    });
    // the autobahn blitzer
    const p = this.abPoint(0.2, -14.2);
    const g = this.blitzer[0].group.clone();
    g.position.set(p.x, 0, p.z);
    g.rotation.y = this.abHeading(0.2) + Math.PI;
    const flashM = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0 });
    g.children[3].material = flashM;
    this.scene.add(g);
    this.blitzer.push({ x: p.x, z: p.z, group: g, flashM, cool: 0 });
  }

  buildChargers() {
    const baseM = new THREE.MeshStandardMaterial({ color: 0xf2f2f2, roughness: 0.4 });
    const glowM = new THREE.MeshStandardMaterial({ color: 0x50af30, emissive: 0x50af30, emissiveIntensity: 2.2 });
    const bayT = canvasTexture(128, 256, (g, w, h) => {
      g.fillStyle = 'rgba(80,175,48,0.35)'; g.fillRect(0, 0, w, h);
      g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
      g.fillStyle = '#ffffff'; g.font = '900 90px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('⚡', w / 2, h / 2);
    });
    const bayM = new THREE.MeshBasicMaterial({ map: bayT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 });
    for (const c of CHARGERS) {
      const g = new THREE.Group();
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.7, 1.9, 0.45), baseM);
      col.position.set(0, 0.95, -3.8);
      const strip = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.12, 0.47), glowM);
      strip.position.set(0, 1.7, -3.8);
      const bay = new THREE.Mesh(new THREE.PlaneGeometry(3, 6), bayM);
      bay.rotation.x = -Math.PI / 2;
      bay.position.y = 0.03;
      g.add(col, strip, bay);
      g.position.set(c.x, c.z > -1000 && Math.abs(c.x) < 400 ? CURB : 0.01, c.z);
      g.rotation.y = c.rot;
      g.traverse((o) => { if (o.isMesh && o !== bay) o.castShadow = true; });
      this.scene.add(g);
      const p = new THREE.Vector3(0, 0, -3.8).applyAxisAngle(new THREE.Vector3(0, 1, 0), c.rot).add(new THREE.Vector3(c.x, 0, c.z));
      this.colliders.push({ t: 'circle', x: p.x, z: p.z, r: 0.5 });
    }
  }

  // ---------------------------------------------------------------- queries
  buildIndex() {
    // spatial hash for colliders
    this.cell = 24;
    this.hash = new Map();
    const key = (cx, cz) => cx * 100000 + cz;
    for (const c of this.colliders) {
      let x0, z0, x1, z1;
      if (c.t === 'box') { x0 = c.x0; z0 = c.z0; x1 = c.x1; z1 = c.z1; }
      else if (c.t === 'circle') { x0 = c.x - c.r; x1 = c.x + c.r; z0 = c.z - c.r; z1 = c.z + c.r; }
      else { x0 = Math.min(c.ax, c.bx); x1 = Math.max(c.ax, c.bx); z0 = Math.min(c.az, c.bz); z1 = Math.max(c.az, c.bz); }
      for (let cx = Math.floor(x0 / this.cell); cx <= Math.floor(x1 / this.cell); cx++) {
        for (let cz = Math.floor(z0 / this.cell); cz <= Math.floor(z1 / this.cell); cz++) {
          const k = key(cx, cz);
          if (!this.hash.has(k)) this.hash.set(k, []);
          this.hash.get(k).push(c);
        }
      }
    }
    this.hashKey = key;
    this.lightAt = new Map(this.lights.map((n) => [`${n.x},${n.z}`, n]));
    // rough bounds of the drivable world
    this.bounds = { x0: -470, x1: 1720, z0: -470, z1: 400 };
  }
  nearColliders(x, z) {
    const cx = Math.floor(x / this.cell), cz = Math.floor(z / this.cell);
    const out = new Set();
    for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
      const l = this.hash.get(this.hashKey(cx + a, cz + b));
      if (l) for (const c of l) out.add(c);
    }
    return out;
  }
  /** pushes a circle out of all colliders; returns the push normal (or null) */
  collide(p, r) {
    let hit = null;
    for (const c of this.nearColliders(p.x, p.z)) {
      let nx = 0, nz = 0, pen = 0;
      if (c.t === 'box') {
        const qx = Math.max(c.x0, Math.min(p.x, c.x1)), qz = Math.max(c.z0, Math.min(p.z, c.z1));
        let dx = p.x - qx, dz = p.z - qz;
        const d = Math.hypot(dx, dz);
        if (d === 0) {
          // centre inside the box: push out along the shortest axis
          const opts = [[p.x - c.x0, -1, 0], [c.x1 - p.x, 1, 0], [p.z - c.z0, 0, -1], [c.z1 - p.z, 0, 1]].sort((a, b) => a[0] - b[0]);
          nx = opts[0][1]; nz = opts[0][2]; pen = opts[0][0] + r;
        } else if (d < r) { nx = dx / d; nz = dz / d; pen = r - d; }
      } else if (c.t === 'circle') {
        const dx = p.x - c.x, dz = p.z - c.z, d = Math.hypot(dx, dz);
        if (d < r + c.r && d > 1e-6) { nx = dx / d; nz = dz / d; pen = r + c.r - d; }
      } else {
        const ex = c.bx - c.ax, ez = c.bz - c.az;
        const t = Math.max(0, Math.min(1, ((p.x - c.ax) * ex + (p.z - c.az) * ez) / (ex * ex + ez * ez)));
        const qx = c.ax + ex * t, qz = c.az + ez * t;
        const dx = p.x - qx, dz = p.z - qz, d = Math.hypot(dx, dz);
        if (d < r && d > 1e-6) { nx = dx / d; nz = dz / d; pen = r - d; }
      }
      if (pen > 0) {
        p.x += nx * pen; p.z += nz * pen;
        hit = hit || { x: 0, z: 0 };
        hit.x += nx; hit.z += nz;
      }
    }
    // world bounds
    const B = this.bounds;
    if (p.x < B.x0 + r) { p.x = B.x0 + r; hit = { x: 1, z: 0 }; }
    if (p.x > B.x1 - r) { p.x = B.x1 - r; hit = { x: -1, z: 0 }; }
    if (p.z < B.z0 + r) { p.z = B.z0 + r; hit = { x: 0, z: 1 }; }
    if (p.z > B.z1 - r) { p.z = B.z1 - r; hit = { x: 0, z: -1 }; }
    if (hit) { const l = Math.hypot(hit.x, hit.z) || 1; hit.x /= l; hit.z /= l; }
    return hit;
  }
  /** ground height (sidewalk slabs are a little higher than the road) */
  groundAt(x, z) {
    if (x < -300 - HALF || x > 300 + HALF || z < -300 - HALF || z > 300 + HALF) return 0;
    const inBand = (v) => GRID.some((g) => Math.abs(v - g) < HALF);
    if (inBand(x) || inBand(z)) return 0;
    return CURB;
  }
  /** autobahn param t and signed lateral offset (left +) for a point, or null when far away */
  autobahnAt(x, z) {
    if (x < 420 || x > 1440) return null;
    const P = this.abPts;
    let best = Infinity, bi = 0;
    for (let i = 0; i < P.length; i += 3) { const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2; if (d < best) { best = d; bi = i; } }
    for (let i = Math.max(0, bi - 3); i < Math.min(P.length, bi + 4); i++) { const d = (P[i].x - x) ** 2 + (P[i].z - z) ** 2; if (d < best) { best = d; bi = i; } }
    const tg = this.tangent(bi);
    const off = (x - P[bi].x) * tg.z - (z - P[bi].z) * tg.x; // left of the eastbound direction = positive
    return { t: bi / (P.length - 1), off, dist: Math.sqrt(best), tg };
  }
  /** speed limit (km/h) at a point; also tells if the point is on a road */
  limitAt(x, z) {
    const ab = this.autobahnAt(x, z);
    if (ab && Math.abs(ab.off) < 15) {
      const east = ab.off < 0; // right-hand carriageway when driving east
      const lim = east ? (ab.t < 0.3 ? LIMIT.baustelle : LIMIT.frei) : (ab.t > 0.7 ? LIMIT.baustelle : LIMIT.frei);
      return { limit: ab.t < 0.04 || ab.t > 0.96 ? LIMIT.baustelle : lim, onRoad: true, autobahn: true };
    }
    let best = null, bd = Infinity;
    for (const r of this.roads) {
      const ex = r.bx - r.ax, ez = r.bz - r.az;
      const t = Math.max(0, Math.min(1, ((x - r.ax) * ex + (z - r.az) * ez) / (ex * ex + ez * ez)));
      const d = Math.hypot(x - (r.ax + ex * t), z - (r.az + ez * t));
      if (d < bd) { bd = d; best = r; }
    }
    if (best && bd < best.w / 2 + 4) return { limit: best.limit, onRoad: bd < best.w / 2 + 0.5, road: best };
    const inCity = (x > -320 && x < 320 && z > -320 && z < 320) || (x > 1410 && x < 1610 && z > -160 && z < 40);
    return { limit: inCity ? LIMIT.city : LIMIT.land, onRoad: false };
  }
  update(dt, t) {
    this.updateLights(t);
    for (const f of this.animated) f(t);
    for (const b of this.blitzer) {
      if (b.cool > 0) { b.cool -= dt; b.flashM.emissiveIntensity = Math.max(0, b.cool - 2.6) * 30; }
    }
  }
}
