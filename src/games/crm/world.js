import * as THREE from 'three';
import { drawBrand } from '../../core/gfx.js';
import { TERRAIN, buildOre, buildCrystal, buildTree, buildStall, buildForge, buildCloud, smoothTex, bake, BLOCK } from './models.js';
import { MODULES, TOWER_MODS, TRADERS } from './content.js';

// The floating block island: terrain (instanced voxels), sky dome with sun/moon/stars,
// clouds, the castle plaza with four tower slots, the market village and resource spots.

export const R = 14.5;
export const CASTLE = new THREE.Vector3(0, 0, -6.2);
export const TOWERS = [
  new THREE.Vector3(-2.9, 0, -9.1), // marketing
  new THREE.Vector3(2.9, 0, -9.1), // sales
  new THREE.Vector3(-2.9, 0, -3.3), // service
  new THREE.Vector3(2.9, 0, -3.3) // commerce
];
export const LORD_POS = new THREE.Vector3(0, 0, -1.6);
export const SPAWN = new THREE.Vector3(0, 0, 3.2);
export const STALLS = {
  mkt: { pos: new THREE.Vector3(-8.2, 0, 5.4), rot: 0.55 },
  sal: { pos: new THREE.Vector3(-4.2, 0, 8.6), rot: 0.25 },
  core: { pos: new THREE.Vector3(0, 0, 10.2), rot: 0 },
  svc: { pos: new THREE.Vector3(4.2, 0, 8.6), rot: -0.25 },
  com: { pos: new THREE.Vector3(8.2, 0, 5.4), rot: -0.55 }
};
export const RIVAL_POS = new THREE.Vector3(16.8, 1.2, -1.5);
export const ORE_SPOTS = [[-10.2, -4.2], [-11.4, -0.8], [-9.0, 1.8], [-10.6, 4.2], [-8.0, -1.8], [-12.2, 2.0]];
export const CRYSTAL_SPOTS = [[9.0, -4.4], [10.6, -1.4], [8.4, 1.2], [11.2, 2.2], [9.6, -7.0], [11.9, -4.6]];
export const LEADTREE_SPOTS = [[-6.6, -11.2], [6.8, -11.0], [-6.0, 2.0], [6.4, 2.6], [-9.8, 7.8]];
export const DECOTREE_SPOTS = [[9.6, 8.4], [-2.0, -12.6], [3.6, -12.4], [-11.4, -7.4], [11.6, -8.2]];
export const LEGACY_SPOTS = [[-4.0, 4.4], [4.6, 4.8], [-6.8, -6.4], [7.0, -7.2], [-2.8, 12.0], [3.0, 12.0], [-10.4, 6.6], [11.0, 5.2], [0, -12.0], [-4.6, -12.0]];

const key = (x, y, z) => `${x},${y},${z}`;
const clamp01 = (v) => Math.max(0, Math.min(1, v));
function hash(x, z) { const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453; return s - Math.floor(s); }
function vnoise(x, z) {
  const xi = Math.floor(x), zi = Math.floor(z), xf = x - xi, zf = z - zi;
  const u = xf * xf * (3 - 2 * xf), v = zf * zf * (3 - 2 * zf);
  const a = hash(xi, zi), b = hash(xi + 1, zi), c = hash(xi, zi + 1), d = hash(xi + 1, zi + 1);
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}

export class World {
  constructor(scene, envMap) {
    this.scene = scene;
    this.group = new THREE.Group();
    scene.add(this.group);
    this.envMap = envMap;
    this.pathCells = new Set();
    this.buildPaths();
    this.buildTerrain();
    this.buildSky();
    this.buildClouds();
    this.buildCastle();
    this.buildVillage();
    this.buildNodes();
    this.buildLanterns();
    this.buildWaterfall();
    this.buildFloaters();
  }

  // ------------------------------------------------------------------ paths (cells that get the path texture)
  buildPaths() {
    const line = (x0, z0, x1, z1) => {
      const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) * 2);
      for (let i = 0; i <= n; i++) {
        const x = Math.round(x0 + (x1 - x0) * i / n), z = Math.round(z0 + (z1 - z0) * i / n);
        this.pathCells.add(`${x},${z}`);
        if (Math.abs(x1 - x0) < Math.abs(z1 - z0)) this.pathCells.add(`${x + 1},${z}`); else this.pathCells.add(`${x},${z + 1}`);
      }
    };
    line(0, -1, 0, 9);
    line(0, 6, -8, 5);
    line(0, 6, 8, 5);
    line(0, 4, -9, 0);
    line(0, 3, 9, -1);
  }

  isPlaza(x, z) { return x >= -4 && x <= 4 && z >= -11 && z <= -2; }

  // ------------------------------------------------------------------ terrain
  buildTerrain() {
    const cells = new Map();
    const occ = new Set();
    const blocks = { grass: [], dirt: [], stone: [], deep: [], path: [], brick: [], sand: [] };
    const add = (type, x, y, z) => { blocks[type].push([x, y, z]); occ.add(key(x, y, z)); };
    for (let x = -16; x <= 16; x++) for (let z = -16; z <= 16; z++) {
      const r = Math.hypot(x, z) + (vnoise(x * 0.35, z * 0.35) - 0.5) * 2.6;
      if (r > R) continue;
      const edge = 1 - r / R;
      const depth = Math.floor(2 + Math.pow(edge, 0.75) * 11 + vnoise(x * 0.5 + 9, z * 0.5) * 3);
      // hills at the fringe (west rocks, north, east outcrops)
      let hill = 0;
      if (x <= -13 && Math.abs(z) < 7) hill = 1 + Math.floor(vnoise(x * 0.6, z * 0.6) * 3);
      else if (z <= -12 && Math.abs(x) > 4.5) hill = Math.floor(vnoise(x * 0.5, z * 0.5) * 2.6);
      else if (x >= 12.5 && z < 0) hill = Math.floor(vnoise(x * 0.7, z * 0.7) * 2.4);
      cells.set(`${x},${z}`, { depth, hill });
      const top = this.isPlaza(x, z) ? 'brick' : this.pathCells.has(`${x},${z}`) ? 'path' : (r > R - 1.2 && hash(x, z) < 0.5) ? 'sand' : 'grass';
      for (let y = hill; y > -depth; y--) {
        let t;
        if (y === hill) t = hill > 0 ? (y === hill ? 'grass' : 'stone') : top;
        else if (y > -3 && hill === 0) t = top === 'brick' ? 'stone' : 'dirt';
        else if (y > 0) t = 'stone';
        else if (y < -depth + 3) t = 'deep';
        else t = 'stone';
        add(t, x, y, z);
      }
    }
    this.cells = cells;
    const tm = (map, opts = {}) => new THREE.MeshStandardMaterial({ map, roughness: 0.92, ...opts });
    const grassSide = tm(TERRAIN.grassSide());
    const mats = {
      grass: [grassSide, grassSide, tm(TERRAIN.grassTop()), tm(TERRAIN.dirt()), grassSide, grassSide],
      dirt: tm(TERRAIN.dirt()),
      stone: tm(TERRAIN.stone()),
      deep: tm(TERRAIN.deepStone(), { emissive: 0x2a1f5a, emissiveIntensity: 0.25 }),
      path: tm(TERRAIN.path()),
      brick: tm(TERRAIN.brick(), { roughness: 0.75 }),
      sand: tm(TERRAIN.sand())
    };
    // Voxel mesher: only faces next to an empty cell are emitted, one mesh per texture.
    const FACES = [
      { n: [1, 0, 0], v: [[1, 0, 1], [1, 0, 0], [1, 1, 0], [1, 1, 1]], side: true },
      { n: [-1, 0, 0], v: [[0, 0, 0], [0, 0, 1], [0, 1, 1], [0, 1, 0]], side: true },
      { n: [0, 1, 0], v: [[0, 1, 1], [1, 1, 1], [1, 1, 0], [0, 1, 0]], top: true },
      { n: [0, -1, 0], v: [[0, 0, 0], [1, 0, 0], [1, 0, 1], [0, 0, 1]], bottom: true },
      { n: [0, 0, 1], v: [[0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1]], side: true },
      { n: [0, 0, -1], v: [[1, 0, 0], [0, 0, 0], [0, 1, 0], [1, 1, 0]], side: true }
    ];
    const UV = [[0, 0], [1, 0], [1, 1], [0, 1]];
    const texFor = (type, f) => {
      if (type === 'grass') return f.top ? 'grassTop' : f.bottom ? 'dirt' : 'grassSide';
      return type;
    };
    const buf = {};
    const get = (k) => (buf[k] ||= { p: [], n: [], uv: [], c: [], i: [] });
    for (const [type, list] of Object.entries(blocks)) {
      for (const [x, y, z] of list) {
        const tint = 0.88 + hash(x * 3 + y, z * 5 - y) * 0.2;
        for (const f of FACES) {
          if (occ.has(key(x + f.n[0], y + f.n[1], z + f.n[2]))) continue;
          const B = get(texFor(type, f));
          const base = B.p.length / 3;
          // darker towards the bottom of the island, undersides darker still
          const depthK = clamp01(1 + y * 0.035);
          const shadeK = tint * (f.bottom ? 0.55 : f.side ? 0.92 : 1) * (0.55 + 0.45 * depthK);
          for (let k = 0; k < 4; k++) {
            const c = f.v[k];
            B.p.push(x - 0.5 + c[0], y - 1 + c[1], z - 0.5 + c[2]);
            B.n.push(...f.n);
            B.uv.push(...UV[k]);
            B.c.push(shadeK, shadeK, shadeK);
          }
          B.i.push(base, base + 1, base + 2, base, base + 2, base + 3);
        }
      }
    }
    const faceMats = {
      grassTop: mats.grass[2], grassSide: mats.grass[0], dirt: mats.dirt, stone: mats.stone, deep: mats.deep, path: mats.path, brick: mats.brick, sand: mats.sand
    };
    this.terrainMeshes = [];
    for (const [k, B] of Object.entries(buf)) {
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3));
      g.setAttribute('normal', new THREE.Float32BufferAttribute(B.n, 3));
      g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
      g.setAttribute('color', new THREE.Float32BufferAttribute(B.c, 3));
      g.setIndex(B.i);
      g.computeBoundingSphere();
      const mat = faceMats[k];
      mat.vertexColors = true;
      const mesh = new THREE.Mesh(g, mat);
      mesh.receiveShadow = true;
      mesh.castShadow = k !== 'deep';
      this.group.add(mesh);
      this.terrainMeshes.push(mesh);
    }
    const m4 = new THREE.Matrix4();
    const col = new THREE.Color();
    // invisible walk plane for raycasts
    this.ground = new THREE.Mesh(new THREE.CircleGeometry(R + 0.5, 48), new THREE.MeshBasicMaterial({ visible: false }));
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = 0.001;
    this.group.add(this.ground);
    // flowers and grass tufts
    const flowerCols = [0xff5fa8, 0xffcc4d, 0x19c3ff, 0xffffff, 0xa46bff];
    const fg = new THREE.BoxGeometry(0.14, 0.14, 0.14);
    const sg = new THREE.BoxGeometry(0.05, 0.3, 0.05);
    const stemM = new THREE.MeshStandardMaterial({ color: 0x3f8f3a });
    const pts = [];
    for (let i = 0; i < 90; i++) {
      const a = hash(i, 3) * Math.PI * 2, r = 3 + hash(i, 7) * (R - 4.5);
      const x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (this.isPlaza(Math.round(x), Math.round(z)) || this.pathCells.has(`${Math.round(x)},${Math.round(z)}`)) continue;
      if (Math.abs(x) > 11.5 || (z > 4 && Math.abs(x) < 10 && z < 12)) continue;
      pts.push([x, z, flowerCols[i % flowerCols.length]]);
    }
    const stems = new THREE.InstancedMesh(sg, stemM, pts.length);
    const heads = new THREE.InstancedMesh(fg, new THREE.MeshStandardMaterial({ roughness: 0.6 }), pts.length);
    pts.forEach(([x, z, c], i) => {
      m4.makeTranslation(x, 0.15, z); stems.setMatrixAt(i, m4);
      m4.makeTranslation(x, 0.34, z); heads.setMatrixAt(i, m4);
      heads.setColorAt(i, col.set(c));
    });
    this.group.add(stems, heads);
  }

  // ------------------------------------------------------------------ sky dome, sun, moon, stars
  buildSky() {
    this.skyU = {
      top: { value: new THREE.Color() }, horizon: { value: new THREE.Color() }, bottom: { value: new THREE.Color() },
      sunDir: { value: new THREE.Vector3(0, 1, 0) }, sunCol: { value: new THREE.Color(1, 0.8, 0.5) }, moonDir: { value: new THREE.Vector3(0, -1, 0) }, night: { value: 0 }
    };
    const sky = new THREE.Mesh(new THREE.SphereGeometry(300, 32, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
      vertexShader: 'varying vec3 vDir; void main(){ vDir = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: `
        uniform vec3 top; uniform vec3 horizon; uniform vec3 bottom; uniform vec3 sunDir; uniform vec3 sunCol; uniform vec3 moonDir; uniform float night;
        varying vec3 vDir;
        void main(){
          vec3 d = normalize(vDir);
          float h = d.y;
          vec3 c = h > 0.0 ? mix(horizon, top, pow(clamp(h,0.0,1.0), 0.55)) : mix(horizon, bottom, pow(clamp(-h,0.0,1.0), 0.45));
          float s = max(dot(d, normalize(sunDir)), 0.0);
          c += sunCol * (pow(s, 900.0) * 6.0 + pow(s, 40.0) * 0.5 + pow(s, 6.0) * 0.18);
          float m = max(dot(d, normalize(moonDir)), 0.0);
          c += vec3(0.75, 0.82, 1.0) * (smoothstep(0.9993, 0.9996, m) * 2.2 + pow(m, 60.0) * 0.25) * night;
          gl_FragColor = vec4(c, 1.0);
        }`
    }));
    sky.renderOrder = -10;
    this.sky = sky;
    this.scene.add(sky);
    // stars
    const N = 900;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const u = Math.random(), v = Math.random() * 0.95;
      const th = u * Math.PI * 2, ph = Math.acos(1 - v);
      pos[i * 3] = Math.sin(ph) * Math.cos(th) * 280;
      pos[i * 3 + 1] = Math.cos(ph) * 280 - 20;
      pos[i * 3 + 2] = Math.sin(ph) * Math.sin(th) * 280;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dot = smoothTex('stardot', 32, 32, (g, w) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, '#fff'); r.addColorStop(0.4, 'rgba(255,255,255,.6)'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
    this.stars = new THREE.Points(sg, new THREE.PointsMaterial({ map: dot, size: 2.6, sizeAttenuation: true, transparent: true, opacity: 0, depthWrite: false, fog: false, color: 0xdfe8ff, blending: THREE.AdditiveBlending }));
    this.scene.add(this.stars);

    // lights
    this.hemi = new THREE.HemisphereLight(0xbfdcff, 0x4a3a2a, 0.9);
    this.scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xfff2dc, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    Object.assign(this.sun.shadow.camera, { left: -19, right: 19, top: 19, bottom: -19, near: 1, far: 90 });
    this.sun.shadow.bias = -0.0006;
    this.sun.shadow.normalBias = 0.03;
    this.sun.target.position.set(0, 0, 0);
    this.scene.add(this.sun, this.sun.target);
  }

  // ------------------------------------------------------------------ clouds
  buildClouds() {
    this.clouds = [];
    for (let i = 0; i < 16; i++) {
      const below = i < 7;
      const c = buildCloud(below ? 2.2 + Math.random() * 1.5 : 1 + Math.random() * 0.8, below ? 0.95 : 0.85);
      const a = (i / 16) * Math.PI * 2 + Math.random() * 0.4;
      const r = below ? 18 + Math.random() * 30 : 24 + Math.random() * 30;
      c.group.position.set(Math.cos(a) * r, below ? -16 - Math.random() * 10 : 9 + Math.random() * 12, Math.sin(a) * r);
      this.scene.add(c.group);
      this.clouds.push({ ...c, a, r, speed: (below ? 0.006 : 0.012) * (0.6 + Math.random()) });
    }
  }

  // ------------------------------------------------------------------ castle
  buildCastle() {
    const C = CASTLE;
    const g = new THREE.Group();
    this.group.add(g);
    this.castle = g;
    const brick = new THREE.MeshStandardMaterial({ map: TERRAIN.brick(), roughness: 0.8 });
    const darkBrick = new THREE.MeshStandardMaterial({ map: TERRAIN.brick(), roughness: 0.8, color: 0x9aa0aa });
    const b = (w, h, d, x, y, z, m = brick) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; g.add(o); return o; };
    // keep (2×2×3) with battlements
    b(2.4, 3.4, 2.4, C.x, 1.7, C.z);
    for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1], [0, 1], [-1, 0], [1, 0]]) b(0.5, 0.5, 0.5, C.x + x * 1.0, 3.65, C.z + z * 1.0, darkBrick);
    // gate
    const gateTex = smoothTex('gate', 64, 96, (gg, w, h) => {
      gg.fillStyle = '#2a1a0e'; gg.fillRect(0, 0, w, h);
      gg.fillStyle = '#5a3a22'; for (let x = 4; x < w; x += 12) gg.fillRect(x, 0, 8, h);
      gg.fillStyle = '#1a1006'; gg.fillRect(0, 30, w, 4); gg.fillRect(0, 70, w, 4);
      gg.fillStyle = '#c9a25e'; gg.fillRect(w - 18, 50, 6, 6);
    });
    const gate = new THREE.Mesh(new THREE.PlaneGeometry(0.95, 1.5), new THREE.MeshStandardMaterial({ map: gateTex }));
    gate.position.set(C.x, 0.75, C.z + 1.21);
    g.add(gate);
    // banner with the itmX logo
    const bannerTex = smoothTex('banner', 128, 256, (gg, w, h) => {
      gg.fillStyle = '#1d6b2a'; gg.fillRect(0, 0, w, h);
      gg.fillStyle = '#50af30'; gg.fillRect(8, 0, w - 16, h - 30);
      gg.beginPath(); gg.moveTo(8, h - 30); gg.lineTo(w / 2, h - 4); gg.lineTo(w - 8, h - 30); gg.fill();
      gg.fillStyle = '#ffcc33'; gg.fillRect(8, 0, w - 16, 10);
      drawBrand(gg, 22, 70, w - 44, w - 44);
    });
    for (const s of [-1, 1]) {
      const bn = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 1.24), new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide, roughness: 0.9 }));
      bn.position.set(C.x + s * 0.85, 2.3, C.z + 1.22);
      g.add(bn);
    }
    // flag pole
    b(0.08, 1.6, 0.08, C.x, 4.6, C.z, new THREE.MeshStandardMaterial({ color: 0xcccccc, metalness: 0.8, roughness: 0.3 }));
    this.flag = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.55, 8, 2), new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide }));
    this.flag.position.set(C.x + 0.47, 5.1, C.z);
    g.add(this.flag);
    this.flagBase = this.flag.geometry.attributes.position.array.slice();

    // tower slots: glowing pads with labels
    this.pads = TOWER_MODS.map((mod, i) => {
      const P = TOWERS[i];
      const col = new THREE.Color(MODULES[mod].color);
      const pad = new THREE.Mesh(new THREE.RingGeometry(0.7, 0.86, 4, 1), new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(2), toneMapped: false, transparent: true, opacity: 0.8 }));
      pad.rotation.x = -Math.PI / 2; pad.rotation.z = Math.PI / 4;
      pad.position.set(P.x, 0.03, P.z);
      g.add(pad);
      const labelTex = smoothTex(`pad-${mod}`, 256, 64, (gg, w, h) => {
        gg.font = '900 40px system-ui, Arial'; gg.textAlign = 'center'; gg.textBaseline = 'middle';
        gg.fillStyle = 'rgba(0,0,0,.55)'; gg.fillText(MODULES[mod].name.toUpperCase(), w / 2 + 2, h / 2 + 2);
        gg.fillStyle = MODULES[mod].color; gg.fillText(MODULES[mod].name.toUpperCase(), w / 2, h / 2);
      });
      const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTex, transparent: true, depthWrite: false, toneMapped: false }));
      label.scale.set(2.2, 0.55, 1);
      label.position.set(P.x, 1.0, P.z);
      g.add(label);
      return { pad, label, base: P };
    });

    // Microsoft 365 bridges from the keep to every tower (hidden until built)
    this.bridges = [];
    const bm = new THREE.MeshStandardMaterial({ color: 0x5ab0ff, emissive: 0x2f7bff, emissiveIntensity: 0.9, roughness: 0.3, transparent: true, opacity: 0.9 });
    for (const P of TOWERS) {
      const from = new THREE.Vector3(C.x, 3.0, C.z), to = new THREE.Vector3(P.x, 3.0, P.z);
      const len = from.distanceTo(to) - 1.6;
      const br = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.16, len), bm);
      br.position.copy(from).lerp(to, 0.5);
      br.lookAt(to);
      br.visible = false;
      g.add(br);
      this.bridges.push(br);
    }
    // KI crystal on the keep
    this.kiCrystal = new THREE.Mesh(new THREE.OctahedronGeometry(0.55, 0), new THREE.MeshPhysicalMaterial({ color: 0xc58bff, emissive: 0x9b4dff, emissiveIntensity: 1.6, roughness: 0.05, clearcoat: 1 }));
    this.kiCrystal.position.set(C.x, 5.0, C.z);
    this.kiCrystal.scale.set(0.9, 1.4, 0.9);
    this.kiCrystal.visible = false;
    g.add(this.kiCrystal);
    this.kiLight = new THREE.PointLight(0xb47bff, 0, 14, 2);
    this.kiLight.position.set(C.x, 5.2, C.z);
    g.add(this.kiLight);
    // Power BI banner on the keep
    const biTex = smoothTex('bi', 256, 160, (gg, w, h) => {
      gg.fillStyle = '#10182c'; gg.fillRect(0, 0, w, h);
      gg.strokeStyle = '#2a3a5c'; gg.lineWidth = 2; for (let y = 30; y < h; y += 30) { gg.beginPath(); gg.moveTo(10, y); gg.lineTo(w - 10, y); gg.stroke(); }
      const bars = [40, 70, 55, 95, 80, 120];
      bars.forEach((v, i) => { gg.fillStyle = ['#ffcc33', '#19c3ff', '#3ddc84', '#ff5fa8', '#a46bff', '#ffb000'][i]; gg.fillRect(18 + i * 38, h - 10 - v, 26, v); });
      gg.strokeStyle = '#ffffff'; gg.lineWidth = 4; gg.beginPath(); bars.forEach((v, i) => { const x = 31 + i * 38, y = h - 20 - v; if (i) gg.lineTo(x, y); else gg.moveTo(x, y); }); gg.stroke();
    });
    this.biBanner = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.06), new THREE.MeshBasicMaterial({ map: biTex, toneMapped: false, side: THREE.DoubleSide }));
    this.biBanner.position.set(C.x, 2.55, C.z - 1.22);
    this.biBanner.rotation.y = Math.PI;
    this.biBanner.visible = false;
    g.add(this.biBanner);
    this.biBanner2 = this.biBanner.clone();
    this.biBanner2.position.set(C.x + 1.22, 2.55, C.z);
    this.biBanner2.rotation.y = Math.PI / 2;
    g.add(this.biBanner2);
    bake(g, { exclude: (o) => o === this.flag || o === this.kiCrystal || o === this.biBanner || o === this.biBanner2 || this.bridges.includes(o) });
  }

  /** World position of block #i on tower t. */
  towerSlot(t, i) {
    const P = TOWERS[t];
    return new THREE.Vector3(P.x, BLOCK / 2 + i * BLOCK, P.z);
  }

  // ------------------------------------------------------------------ village
  buildVoxelFence() { /* reserved */ }

  buildVillage() {
    this.stalls = {};
    for (const T of TRADERS) {
      const S = STALLS[T.id];
      let grp, fire = null;
      if (T.id === 'core') { const f = buildForge(); grp = f.group; fire = f.fire; }
      else grp = buildStall(MODULES[T.mod].color, T.name, T.role);
      grp.position.copy(S.pos);
      grp.rotation.y = S.rot;
      this.group.add(grp);
      this.stalls[T.id] = { group: grp, fire };
    }
    this.forgeLight = new THREE.PointLight(0xff8a2a, 14, 9, 2);
    this.forgeLight.position.copy(STALLS.core.pos).add(new THREE.Vector3(0, 1, 1.4));
    this.group.add(this.forgeLight);
  }

  // ------------------------------------------------------------------ resource nodes
  buildNodes() {
    this.nodes = [];
    const place = (obj, x, z, extra) => {
      obj.group.position.set(x, 0, z);
      obj.group.rotation.y = hash(x, z) * Math.PI * 2;
      this.group.add(obj.group);
      const n = { ...obj, ...extra, pos: new THREE.Vector3(x, 0, z), alive: true, respawn: 0, hp: extra.maxHp };
      obj.group.traverse((o) => { if (o.isMesh) o.userData.node = n; });
      this.nodes.push(n);
      return n;
    };
    for (const [x, z] of ORE_SPOTS) place(buildOre(), x, z, { kind: 'sap', maxHp: 3 });
    for (const [x, z] of CRYSTAL_SPOTS) place(buildCrystal(), x, z, { kind: 'data', maxHp: 3 });
    for (const [x, z] of LEADTREE_SPOTS) {
      const t = buildTree(true);
      const n = place(t, x, z, { kind: 'lead', maxHp: 1 });
      n.fruitsLeft = t.fruits.length;
    }
    for (const [x, z] of DECOTREE_SPOTS) {
      const t = buildTree(false);
      t.group.position.set(x, 0, z);
      t.group.rotation.y = hash(z, x) * 6;
      this.group.add(t.group);
    }
  }

  // ------------------------------------------------------------------ lanterns (glow at night)
  buildLanterns() {
    this.lanternMat = new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb347, emissiveIntensity: 0.2 });
    const post = new THREE.MeshStandardMaterial({ map: TERRAIN.log() });
    const spots = [[1.6, 0.2], [-1.6, 0.2], [1.6, 5.4], [-1.6, 5.4], [-4.6, -1.2], [4.6, -1.2], [-4.6, -10.8], [4.6, -10.8], [-5.2, 6.2], [5.2, 6.2]];
    const pg = new THREE.BoxGeometry(0.14, 1.6, 0.14), lg = new THREE.BoxGeometry(0.34, 0.34, 0.34);
    const lanterns = new THREE.Group();
    for (const [x, z] of spots) {
      const p = new THREE.Mesh(pg, post); p.position.set(x, 0.8, z); p.castShadow = true;
      const l = new THREE.Mesh(lg, this.lanternMat); l.position.set(x, 1.75, z);
      lanterns.add(p, l);
    }
    this.group.add(bake(lanterns));
    this.villageLight = new THREE.PointLight(0xffc36b, 0, 16, 1.6);
    this.villageLight.position.set(0, 3, 4);
    this.group.add(this.villageLight);
  }

  // ------------------------------------------------------------------ waterfall over the southern edge
  buildWaterfall() {
    const tex = smoothTex('water', 64, 256, (g, w, h) => {
      for (let y = 0; y < h; y += 4) for (let x = 0; x < w; x += 4) {
        const v = 0.75 + Math.random() * 0.25;
        g.fillStyle = `rgba(${Math.round(90 * v)},${Math.round(170 * v)},${Math.round(255 * v)},${0.7 + Math.random() * 0.25})`;
        g.fillRect(x, y, 4, 4);
      }
      g.fillStyle = 'rgba(255,255,255,0.7)';
      for (let i = 0; i < 40; i++) g.fillRect(Math.floor(Math.random() * 16) * 4, Math.floor(Math.random() * 64) * 4, 4, 12);
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.magFilter = THREE.NearestFilter;
    this.waterTex = tex;
    const wm = new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0.85, roughness: 0.1, metalness: 0.1, emissive: 0x2a6fd6, emissiveIntensity: 0.25, side: THREE.DoubleSide });
    // pond
    const pondTex = tex.clone(); pondTex.repeat.set(1, 0.4); pondTex.needsUpdate = true;
    this.pond = new THREE.Mesh(new THREE.PlaneGeometry(3, 2.4), new THREE.MeshStandardMaterial({ map: tex, transparent: true, opacity: 0.8, roughness: 0.05, metalness: 0.2, emissive: 0x2a6fd6, emissiveIntensity: 0.2 }));
    this.pond.rotation.x = -Math.PI / 2;
    this.pond.position.set(-6.8, 0.04, 11.2);
    this.group.add(this.pond);
    // fall
    const fall = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 16), wm);
    fall.position.set(-7.5, -8, 13.1);
    fall.rotation.y = -0.55;
    this.group.add(fall);
    this.fall = fall;
  }

  // ------------------------------------------------------------------ small floating rocks around the island
  buildFloaters() {
    this.floaters = [];
    const gm = [new THREE.MeshStandardMaterial({ map: TERRAIN.grassSide() }), new THREE.MeshStandardMaterial({ map: TERRAIN.grassSide() }), new THREE.MeshStandardMaterial({ map: TERRAIN.grassTop() }), new THREE.MeshStandardMaterial({ map: TERRAIN.dirt() }), new THREE.MeshStandardMaterial({ map: TERRAIN.grassSide() }), new THREE.MeshStandardMaterial({ map: TERRAIN.grassSide() })];
    const sm = new THREE.MeshStandardMaterial({ map: TERRAIN.stone() });
    for (let i = 0; i < 7; i++) {
      const grp = new THREE.Group();
      const s = 1 + Math.random() * 1.6;
      const top = new THREE.Mesh(new THREE.BoxGeometry(2 * s, 1, 2 * s), gm); grp.add(top);
      const mid = new THREE.Mesh(new THREE.BoxGeometry(1.3 * s, 1, 1.3 * s), sm); mid.position.y = -1; grp.add(mid);
      const bot = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 1, 0.6 * s), sm); bot.position.y = -2; grp.add(bot);
      const a = (i / 7) * Math.PI * 2 + 0.3;
      const r = 21 + Math.random() * 10;
      grp.position.set(Math.cos(a) * r, -3 + Math.random() * 9, Math.sin(a) * r);
      grp.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
      bake(grp);
      this.scene.add(grp);
      this.floaters.push({ grp, base: grp.position.y, ph: Math.random() * 6 });
    }
  }

  // ------------------------------------------------------------------ day/night
  /**
   * cyc: sun angle in radians (0 = sunrise east, π/2 noon, π = sunset, 3π/2 midnight).
   */
  setCycle(cyc) {
    const e = Math.sin(cyc);
    const sunDir = new THREE.Vector3(Math.cos(cyc), Math.sin(cyc), 0.35).normalize();
    const dayK = THREE.MathUtils.smoothstep(e, -0.12, 0.3);
    const duskK = Math.max(0, 1 - Math.abs(e) / 0.28); // around the horizon
    this.night = 1 - dayK;
    const lerp3 = (a, b, c, k1, k2) => new THREE.Color(a).lerp(new THREE.Color(b), k1).lerp(new THREE.Color(c), k2);
    // night → day, then the dusk tint on top
    const top = lerp3('#05081a', '#1f5fcf', '#1f5fcf', dayK, 0);
    const hor = lerp3('#141c3e', '#7fbfff', '#7fbfff', dayK, 0);
    const bot = lerp3('#060915', '#a9d4ff', '#a9d4ff', dayK, 0);
    hor.lerp(new THREE.Color('#ff9455'), duskK * 0.85);
    top.lerp(new THREE.Color('#33407e'), duskK * 0.5);
    bot.lerp(new THREE.Color('#7a5a7a'), duskK * 0.5);
    this.skyU.top.value.copy(top);
    this.skyU.horizon.value.copy(hor);
    this.skyU.bottom.value.copy(bot);
    this.skyU.sunDir.value.copy(sunDir);
    this.skyU.sunCol.value.set(e > -0.05 ? 0xffd9a0 : 0x000000).lerp(new THREE.Color(0xff6a2a), duskK * 0.7);
    this.skyU.moonDir.value.copy(sunDir).negate();
    this.skyU.night.value = this.night;
    if (this.scene.fog) this.scene.fog.color.copy(hor).lerp(bot, 0.5);
    this.stars.material.opacity = this.night * 0.95;
    // sun by day, moon by night (same light)
    const lightDir = e > -0.02 ? sunDir : sunDir.clone().negate();
    this.sun.position.copy(lightDir).multiplyScalar(45);
    this.sun.intensity = e > -0.02 ? 0.25 + 2.5 * dayK : 0.55 * this.night;
    this.sun.color.set(e > -0.02 ? 0xfff2dc : 0x9fb6ff).lerp(new THREE.Color(0xffa060), e > -0.02 ? duskK * 0.6 : 0);
    this.hemi.intensity = 0.32 + 0.6 * dayK;
    this.hemi.color.set(0x5d78c8).lerp(new THREE.Color(0xbfdcff), dayK);
    this.hemi.groundColor.set(0x1a1424).lerp(new THREE.Color(0x4a3a2a), dayK);
    this.lanternMat.emissiveIntensity = 0.2 + this.night * 3.2;
    this.villageLight.intensity = this.night * 18;
    for (const c of this.clouds) c.mat.color.setScalar(0.35 + 0.65 * dayK).lerp(new THREE.Color(0xffb08a), duskK * 0.4);
  }

  update(dt, time) {
    for (const c of this.clouds) {
      c.a += c.speed * dt;
      c.group.position.x = Math.cos(c.a) * c.r;
      c.group.position.z = Math.sin(c.a) * c.r;
    }
    for (const f of this.floaters) { f.grp.position.y = f.base + Math.sin(time * 0.6 + f.ph) * 0.4; f.grp.rotation.y += dt * 0.03; }
    this.waterTex.offset.y = (time * 0.6) % 1;
    this.stars.rotation.y = time * 0.005;
    // waving flag
    const p = this.flag.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = this.flagBase[i * 3];
      p.setZ(i, Math.sin(time * 5 + x * 5) * 0.08 * (x + 0.45));
    }
    p.needsUpdate = true;
    if (this.kiCrystal.visible) { this.kiCrystal.rotation.y += dt * 1.2; this.kiCrystal.position.y = 5.0 + Math.sin(time * 2) * 0.15; }
    const fire = this.stalls.core.fire;
    if (fire) { const f = 2.6 + Math.sin(time * 13) * 0.4 + Math.sin(time * 7.3) * 0.3; fire.color.setRGB(f, f * 0.45, 0.25); this.forgeLight.intensity = 10 + f * 3; }
    for (const pd of this.pads) pd.pad.material.opacity = 0.5 + Math.sin(time * 3) * 0.25;
  }
}
