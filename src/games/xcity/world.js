import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { Water } from 'three/examples/jsm/objects/Water.js';
import { Lensflare, LensflareElement } from 'three/examples/jsm/objects/Lensflare.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, rand, drawBrand } from '../../core/gfx.js';
import { buildXTile, buildBeam } from './xtile.js';
import { NEON } from './content.js';
import { asphaltSet, sidewalkSet, sandSet, stoneSet, normalFromHeight, radial } from './textures.js';
import { FacadeBuilder } from './facades.js';
import { TrafficLights, buildTrees, buildFurniture, buildPier, Boats, Gulls, buildClouds } from './props.js';

// Ludlein Bay: a coastal grid city at golden hour. The X-Platz sits in the exact centre.
export const ROADS = [-200, -120, -40, 40, 120, 200];
export const RW = 14; // road width
export const LANE = 3.2; // lane offset from the road centre (right-hand traffic)
export const PARK = 5.55; // parking lane offset
export const CURB = 0.15;
export const SHORE = 213; // promenade ends, beach starts
export const WATER_X = 251;
const SLOPE = 0.012; // beach slope
export const MAP = { x0: -262, z0: -270, size: 540 };
const SW = 4; // sidewalk width
const WATER_Y = -0.45;

// deterministic random so the city is the same on every visit
let seed = 7;
const srand = (a = 0, b = 1) => { seed = (seed * 16807) % 2147483647; return a + ((seed - 1) / 2147483646) * (b - a); };
const pick = (arr) => arr[Math.floor(srand(0, arr.length - 0.0001))];

function tint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  return g;
}
function plainUV(geo, sx = 1, sz = 1) {
  const p = geo.attributes.position, uv = geo.attributes.uv;
  for (let i = 0; i < p.count; i++) uv.setXY(i, p.getX(i) / sx, p.getZ(i) / sz);
  return geo;
}
const merge = (list) => (list.length ? mergeGeometries(list, false) : null);

function waterNormals(S = 512) {
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d');
  const waves = [];
  for (let i = 0; i < 24; i++) waves.push({ kx: Math.round(rand(-14, 14)), ky: Math.round(rand(1, 14)), a: rand(0.2, 1) / (1 + i * 0.12), p: rand(0, 6.28) });
  const hc = document.createElement('canvas'); hc.width = hc.height = S;
  const hg = hc.getContext('2d'), img = hg.createImageData(S, S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    let h = 0;
    for (const v of waves) h += Math.sin(((v.kx * x + v.ky * y) / S) * Math.PI * 2 + v.p) * v.a;
    const val = 128 + h * 22;
    const i = (y * S + x) * 4; img.data[i] = img.data[i + 1] = img.data[i + 2] = val; img.data[i + 3] = 255;
  }
  hg.putImageData(img, 0, 0);
  void g;
  return normalFromHeight(hc, 2.5);
}

function neonTexture(text, color, vertical = false) {
  const W = vertical ? 256 : 1024, H = vertical ? 1024 : 256;
  return canvasTexture(W, H, (g, w, h) => {
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = color; g.shadowBlur = 30; g.strokeStyle = color; g.lineWidth = 10; g.fillStyle = '#ffffff';
    if (vertical) {
      const letters = text.replace(/\s+/g, '').slice(0, 7).split('');
      const step = h / (letters.length + 0.5);
      g.font = `900 ${Math.min(190, step * 0.9)}px "Segoe UI", Arial, sans-serif`;
      letters.forEach((ch, i) => { const y = step * (i + 0.75); g.shadowBlur = 30; g.strokeText(ch, w / 2, y); g.shadowBlur = 8; g.fillText(ch, w / 2, y); });
    } else {
      g.font = `italic 900 ${text.length > 10 ? 104 : 140}px "Segoe UI", Arial, sans-serif`;
      g.strokeText(text, w / 2, h / 2); g.shadowBlur = 10; g.fillText(text, w / 2, h / 2);
    }
  });
}

export class World {
  constructor(renderer, quality = 'hoch') {
    seed = 7;
    this.quality = quality;
    this.scene = new THREE.Scene();
    this.solids = []; this.circles = []; this.hash = new Map(); this.anim = [];
    this.palmSpots = []; this.treeSpots = []; this.pedLoops = []; this.billboards = [];
    this.parkSpots = [];
    this.F = { hydrants: [], bins: [], benches: [], bollards: [], newsboxes: [], manholes: [], shelters: [], planters: [] };
    this.buildSky(renderer);
    this.buildGround();
    this.buildRoads();
    this.buildBlocks();
    this.buildCoast();
    this.buildPlaza();
    this.buildStreetProps();
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
    u.turbidity.value = 6.5; u.rayleigh.value = 3.4; u.mieCoefficient.value = 0.0028; u.mieDirectionalG.value = 0.8;
    const sun = new THREE.Vector3().setFromSphericalCoords(1, THREE.MathUtils.degToRad(90 - 10), THREE.MathUtils.degToRad(58));
    u.sunPosition.value.copy(sun);
    this.sunDir = sun.clone();
    const envScene = new THREE.Scene();
    const sky2 = new Sky(); sky2.scale.setScalar(1000);
    sky2.material.uniforms.sunPosition.value.copy(sun);
    for (const k of ['turbidity', 'rayleigh', 'mieCoefficient', 'mieDirectionalG']) sky2.material.uniforms[k].value = u[k].value;
    envScene.add(sky2);
    // a fake city ring in the environment so glass and paint reflect buildings, not just sky
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2, h = rand(40, 160);
      const b = new THREE.Mesh(new THREE.BoxGeometry(60, h, 60), new THREE.MeshBasicMaterial({ color: new THREE.Color().setHSL(rand(0.02, 0.1), 0.25, rand(0.12, 0.28)) }));
      b.position.set(Math.cos(a) * 420, h / 2 - 5, Math.sin(a) * 420);
      if (Math.cos(a) < 0.5) envScene.add(b);
    }
    const gnd = new THREE.Mesh(new THREE.CircleGeometry(900, 24), new THREE.MeshBasicMaterial({ color: 0x2a2228 }));
    gnd.rotation.x = -Math.PI / 2; gnd.position.y = -5;
    envScene.add(gnd);
    const pm = new THREE.PMREMGenerator(renderer);
    this.env = pm.fromScene(envScene, 0.02).texture;
    pm.dispose();
    sky.material.fragmentShader = sky.material.fragmentShader.replace('gl_FragColor = vec4( retColor, 1.0 );', 'gl_FragColor = vec4( min( retColor * 0.8, vec3( 1.25, 1.05, 0.95 ) ), 1.0 );');
    s.add(sky);
    this.sky = sky;
    s.environment = this.env;
    s.environmentIntensity = 0.85;
    s.fog = new THREE.FogExp2(0xd98a6a, 0.0012);
    s.add(new THREE.HemisphereLight(0x8fa0ff, 0x6a3a3a, 0.5));
    const sunL = new THREE.DirectionalLight(0xff9d5c, 3.4);
    sunL.castShadow = true;
    const sm = this.quality === 'ultra' ? 4096 : this.quality === 'mobil' ? 1024 : 2048;
    sunL.shadow.mapSize.set(sm, sm);
    const r = this.quality === 'mobil' ? 45 : 70;
    Object.assign(sunL.shadow.camera, { left: -r, right: r, top: r, bottom: -r, near: 10, far: 700 });
    sunL.shadow.bias = -0.0004; sunL.shadow.normalBias = 0.05;
    s.add(sunL, sunL.target);
    this.sun = sunL;
    const disc = new THREE.Mesh(new THREE.CircleGeometry(38, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.2, 1.3, 0.7), toneMapped: false, fog: false }));
    disc.position.copy(sun).multiplyScalar(4000); disc.lookAt(0, 0, 0);
    s.add(disc);
    // lens flare (own procedural sprites)
    const flare = new THREE.PointLight(0xffffff, 0, 0);
    flare.position.copy(sun).multiplyScalar(3900);
    const lf = new Lensflare();
    lf.addElement(new LensflareElement(radial('255,210,160', 256), 520, 0, new THREE.Color(0.9, 0.6, 0.35)));
    for (const [sz, d, c] of [[70, 0.25, [0.3, 0.6, 1]], [110, 0.45, [1, 0.5, 0.3]], [50, 0.62, [0.4, 1, 0.6]], [160, 0.85, [0.6, 0.4, 1]], [90, 1.0, [1, 0.7, 0.3]]]) lf.addElement(new LensflareElement(radial('255,255,255', 128), sz, d, new THREE.Color(...c).multiplyScalar(0.18)));
    flare.add(lf);
    s.add(flare);
    this.clouds = buildClouds(s, sun);
    this.anim.push((t) => { this.clouds.uniforms.time.value = t; });
  }
  followSun(pos) {
    const step = 2;
    const x = Math.round(pos.x / step) * step, z = Math.round(pos.z / step) * step;
    this.sun.target.position.set(x, 0, z);
    this.sun.position.set(x + this.sunDir.x * 300, this.sunDir.y * 300 + 40, z + this.sunDir.z * 300);
  }

  // ---------------------------------------------------------------- ground + roads
  buildGround() {
    const A = asphaltSet(1024);
    for (const t of [A.map, A.normalMap, A.roughnessMap]) t.repeat.set(140, 140);
    const g = new THREE.PlaneGeometry(1400, 1400, 1, 1);
    g.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ map: A.map, normalMap: A.normalMap, roughnessMap: A.roughnessMap, roughness: 1, metalness: 0.05, normalScale: new THREE.Vector2(0.8, 0.8), envMapIntensity: 1.1 }));
    m.position.set(SHORE - 700, 0, 0);
    m.receiveShadow = true;
    this.scene.add(m);
    this.SW = sidewalkSet(512, 4);
    for (const t of [this.SW.map, this.SW.normalMap]) t.repeat.set(1, 1);
  }

  buildRoads() {
    const white = [], yellow = [], cross = [];
    const strip = (list, x, z, w, d) => { const p = new THREE.PlaneGeometry(w, d); p.rotateX(-Math.PI / 2); p.translate(x, 0.02, z); list.push(p); };
    for (const r of ROADS) for (let k = 0; k < ROADS.length - 1; k++) {
      const a = ROADS[k] + RW / 2, b = ROADS[k + 1] - RW / 2, mid = (a + b) / 2, len = b - a;
      for (const vert of [true, false]) {
        const S = (list, off, w, l, c) => vert ? strip(list, r + off, c, w, l) : strip(list, c, r + off, l, w);
        S(yellow, -0.18, 0.14, len - 8, mid); S(yellow, 0.18, 0.14, len - 8, mid);
        // dashed edge of the parking lane
        for (let d = a + 6; d < b - 6; d += 6) { S(white, -4.4, 0.14, 3, d); S(white, 4.4, 0.14, 3, d); }
        // stop lines + zebra crossings
        for (const [end, sgn] of [[a + 2, 1], [b - 2, -1]]) {
          for (let q = -6; q <= 6; q += 1.3) vert ? strip(cross, r + q, end, 0.75, 3.2) : strip(cross, end, r + q, 3.2, 0.75);
          const stopOff = sgn > 0 ? -3.3 : 3.3; // right-hand side of the incoming lane
          vert ? strip(white, r + stopOff, end + sgn * 2.4, 6, 0.45) : strip(white, end + sgn * 2.4, r - stopOff, 0.45, 6);
        }
        // manholes
        this.F.manholes.push(vert ? { x: r + srand(-3, 3), y: 0, z: mid + srand(-20, 20) } : { x: mid + srand(-20, 20), y: 0, z: r + srand(-3, 3) });
      }
    }
    const worn = (c) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.7, polygonOffset: true, polygonOffsetFactor: -2, transparent: true, opacity: 0.9 });
    for (const [list, mat] of [[white, worn(0xe8e6e0)], [yellow, worn(0xe8a92a)], [cross, worn(0xe8e6e0)]]) {
      const m = new THREE.Mesh(merge(list), mat); m.receiveShadow = true; this.scene.add(m);
    }
  }

  // ---------------------------------------------------------------- blocks + buildings
  addSolid(x0, x1, z0, z1) { this.solids.push({ x0, x1, z0, z1 }); }

  buildBlocks() {
    const FB = this.fb = new FacadeBuilder();
    FB.rand = () => srand();
    const plates = [], curbs = [], grass = [];
    const pastel = [0xffc8d6, 0xb0efe2, 0xfff1b8, 0xcad9ff, 0xffd9ad, 0xe9cdff, 0xfdfdfd, 0xbff5c6];
    const stuccoCols = [0xe8dccb, 0xd9c7b0, 0xf0e6d8, 0xcdbba6, 0xe2d0c2, 0xc9b49c, 0xf3d9c4, 0xdcd4c6];
    const glassTint = [0x9bbcd9, 0xa8d6db, 0xbfcbe8, 0x8fb0c8, 0xb2c2cf, 0xd8bf98, 0x9fc8b8];
    const neonCols = ['#ff3d9a', '#19c3ff', '#7dff6a', '#ffb000', '#b56bff'];
    for (let i = 0; i < ROADS.length - 1; i++) for (let j = 0; j < ROADS.length - 1; j++) {
      const x0 = ROADS[i] + RW / 2, x1 = ROADS[i + 1] - RW / 2, z0 = ROADS[j] + RW / 2, z1 = ROADS[j + 1] - RW / 2;
      const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
      const p = new THREE.BoxGeometry(w - 0.5, CURB, d - 0.5); p.translate(cx, CURB / 2, cz); plainUV(p, 6, 6); plates.push(p);
      // granite curb stones
      for (const [bx, bz, bw, bd] of [[cx, z0 + 0.15, w, 0.3], [cx, z1 - 0.15, w, 0.3], [x0 + 0.15, cz, 0.3, d], [x1 - 0.15, cz, 0.3, d]]) { const c = new THREE.BoxGeometry(bw, CURB + 0.02, bd); c.translate(bx, (CURB + 0.02) / 2, bz); curbs.push(tint(c, 0xa9a49c)); }
      this.pedLoops.push({ x0: x0 + 1.8, x1: x1 - 1.8, z0: z0 + 1.8, z1: z1 - 1.8 });
      this.sidewalkProps(x0, x1, z0, z1, i, j);
      if (i === 2 && j === 2) continue; // X-Platz
      const bx0 = x0 + SW, bx1 = x1 - SW, bz0 = z0 + SW, bz1 = z1 - SW;
      const dist = Math.hypot(cx, cz);
      if (i === 2 && j === 1) { this.buildHQ(bx0, bx1, bz0, bz1); continue; }
      if (i === 0 && j === 4) { this.buildSilo(bx0, bx1, bz0, bz1); continue; }
      if (i === 3 && j === 3) { // park with palms and trees
        const gg = new THREE.PlaneGeometry(bx1 - bx0, bz1 - bz0); gg.rotateX(-Math.PI / 2); gg.translate(cx, CURB + 0.02, cz); plainUV(gg, 3, 3); grass.push(gg);
        for (let k = 0; k < 10; k++) this.palmSpots.push([srand(bx0 + 3, bx1 - 3), srand(bz0 + 3, bz1 - 3), CURB, srand(0.8, 1.2)]);
        for (let k = 0; k < 10; k++) this.treeSpots.push({ x: srand(bx0 + 4, bx1 - 4), y: CURB, z: srand(bz0 + 4, bz1 - 4), ry: srand(0, 6), s: srand(1.1, 1.6) });
        for (let k = 0; k < 6; k++) this.F.benches.push({ x: srand(bx0 + 4, bx1 - 4), y: CURB, z: srand(bz0 + 4, bz1 - 4), ry: srand(0, 6) });
        continue;
      }
      const ocean = i === 4;
      const lots = [];
      if (!ocean && dist < 140 && srand() < 0.4) lots.push([bx0, bx1, bz0, bz1]);
      else {
        const mx = (bx0 + bx1) / 2, mz = (bz0 + bz1) / 2, g2 = 1.2;
        lots.push([bx0, mx - g2, bz0, mz - g2], [mx + g2, bx1, bz0, mz - g2], [bx0, mx - g2, mz + g2, bz1], [mx + g2, bx1, mz + g2, bz1]);
      }
      for (const [lx0, lx1, lz0, lz1] of lots) {
        const lw = lx1 - lx0, ld = lz1 - lz0, lcx = (lx0 + lx1) / 2, lcz = (lz0 + lz1) / 2;
        FB.setChunk(lcx, lcz);
        let top;
        if (ocean) top = FB.deco(lx0, lx1, lz0, lz1, srand(14, 24), pick(pastel), CURB, pick(neonCols));
        else if (dist < 150 && srand() < 0.7) {
          const h = srand(34, 80) * (1.25 - dist / 260) + (dist < 90 ? srand(10, 30) : 0);
          const inset = lots.length === 1 ? 6 : 2;
          top = FB.tower(lx0 + inset, lx1 - inset, lz0 + inset, lz1 - inset, h, pick(glassTint), CURB);
          if (srand() < 0.3) this.billboards.push({ x: lcx, y: top + 1, z: lcz, w: Math.min(lw, ld) * 0.6, ry: srand() < 0.5 ? 0 : Math.PI / 2 });
        } else top = FB.stucco(lx0, lx1, lz0, lz1, srand(12, 28), pick(stuccoCols));
        void top;
        this.addSolid(lx0 - 0.3, lx1 + 0.3, lz0 - 0.3, lz1 + 0.3);
      }
    }
    // outer ring: a wall of buildings so the city has an edge (west, north, south)
    const ring = (x0, x1, z0, z1) => {
      for (let x = x0; x < x1; x += 24) for (let z = z0; z < z1; z += 24) {
        const h = srand(14, 50);
        FB.setChunk(x + 12, z + 12);
        if (srand() < 0.35) FB.tower(x + 2, x + 22, z + 2, z + 22, h + 20, pick(glassTint), 0);
        else FB.stucco(x + 1, x + 23, z + 1, z + 23, h * 0.6, pick(stuccoCols), 0);
      }
      this.addSolid(x0, x1, z0, z1);
    };
    ring(-262, -208, -262, 262);
    ring(-208, SHORE - 6, -262, -208);
    ring(-208, SHORE - 6, 208, 262);
    this.facades = FB.build(this.scene);
    // neon fins (vertical signs) on the art-deco hotels
    for (const n of FB.neonSigns) {
      const m = new THREE.MeshBasicMaterial({ map: neonTexture(pick(NEON), n.color, true), transparent: true, color: new THREE.Color(2.2, 2.2, 2.2), toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(2.2, Math.min(n.h, 16)), m);
      p.position.set(n.x + 0.02, n.y, n.z); p.rotation.y = Math.PI / 2;
      this.scene.add(p);
      if (srand() < 0.3) { const ph = srand(0, 6); this.anim.push((t) => { m.opacity = Math.sin(t * 9 + ph) > -0.85 || Math.sin(t * 1.3 + ph) > 0 ? 1 : 0.3; }); }
    }
    const SWm = new THREE.MeshStandardMaterial({ map: this.SW.map, normalMap: this.SW.normalMap, roughness: 0.85, color: 0xf2e8de });
    const pm = new THREE.Mesh(merge(plates), SWm); pm.receiveShadow = true; this.scene.add(pm);
    const cm = new THREE.Mesh(merge(curbs), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 })); cm.receiveShadow = true; this.scene.add(cm);
    if (grass.length) {
      const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
      g.fillStyle = '#4c7f34'; g.fillRect(0, 0, 256, 256);
      for (let k = 0; k < 9000; k++) { g.strokeStyle = `hsl(${rand(80, 110)},${rand(35, 60)}%,${rand(22, 42)}%)`; const x = rand(0, 256), y = rand(0, 256); g.beginPath(); g.moveTo(x, y); g.lineTo(x + rand(-2, 2), y - rand(3, 7)); g.stroke(); }
      const gt = new THREE.CanvasTexture(c); gt.colorSpace = THREE.SRGBColorSpace; gt.wrapS = gt.wrapT = THREE.RepeatWrapping;
      const gm = new THREE.Mesh(merge(grass), new THREE.MeshStandardMaterial({ map: gt, roughness: 1 })); gm.receiveShadow = true; this.scene.add(gm);
    }
    this.buildBillboards();
  }

  sidewalkProps(x0, x1, z0, z1, i, j) {
    // edges of the block facing the four roads; positions measured from the curb
    const F = this.F;
    const edges = [
      { a: x0, b: x1, c: z0, n: [0, -1] }, { a: x0, b: x1, c: z1, n: [0, 1] },
      { a: z0, b: z1, c: x0, n: [-1, 0], z: true }, { a: z0, b: z1, c: x1, n: [1, 0], z: true }
    ];
    const plaza = i === 2 && j === 2;
    for (const e of edges) {
      const pos = (along, inset) => e.z ? { x: e.c - e.n[0] * inset, z: along } : { x: along, z: e.c - e.n[1] * inset };
      const ryOut = Math.atan2(e.n[0], e.n[1]);
      for (let s = e.a + 13; s < e.b - 12; s += 22) {
        const p = pos(s, 1.1); // trees sit between the lamps
        if (!plaza && e.c < 210 && srand() < 0.75) this.treeSpots.push({ x: p.x, y: CURB, z: p.z, ry: srand(0, 6), s: srand(0.85, 1.15) });
      }
      // hydrant near each corner, bins + newspaper boxes near the crossings
      const h = pos(e.a + 6, 0.7); F.hydrants.push({ ...h, y: CURB, ry: ryOut });
      const b = pos(e.b - 6, 0.8); F.bins.push({ ...b, y: CURB });
      if (srand() < 0.5) { const nb = pos(e.b - 7.5, 0.7); F.newsboxes.push({ ...nb, y: CURB, ry: ryOut }); }
      if (!plaza && srand() < 0.35) { const bn = pos((e.a + e.b) / 2 + 3, 3.1); F.benches.push({ ...bn, y: CURB, ry: ryOut }); }
      if (!plaza && srand() < 0.18) { const sh = pos((e.a + e.b) / 2 - 8, 2.2); F.shelters.push({ ...sh, y: CURB, ry: ryOut + Math.PI }); this.circles.push({ x: sh.x, z: sh.z, r: 1.2 }); }
      // parked cars in the parking lane next to this edge
      for (let s = e.a + 6; s < e.b - 6; s += 6.4) {
        if (srand() > 0.42) continue;
        const along = s + 3.2;
        const lane = 7 - PARK; // distance from the curb into the road
        const p = e.z ? { x: e.c + e.n[0] * lane, z: along } : { x: along, z: e.c + e.n[1] * lane };
        // cars park facing the traffic direction of that side (right-hand traffic)
        const heading = e.z ? (e.n[0] > 0 ? 0 : Math.PI) : (e.n[1] > 0 ? -Math.PI / 2 : Math.PI / 2);
        this.parkSpots.push({ x: p.x, z: p.z, heading });
      }
    }
  }

  buildHQ(x0, x1, z0, z1) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2 - 4;
    const w = 36, h = 128;
    this.fb.setChunk(cx, cz);
    this.fb.tower(cx - w / 2, cx + w / 2, cz - w / 2, cz + w / 2, h, 0x8fd9ac, CURB);
    this.addSolid(cx - w / 2 - 2, cx + w / 2 + 2, cz - w / 2 - 2, cz + w / 2 + 2);
    const tex = canvasTexture(512, 512, (g, W, H) => { drawBrand(g, 40, 40, W - 80, H - 80); });
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false });
    for (let k = 0; k < 4; k++) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(16, 16), m);
      const a = (k * Math.PI) / 2;
      p.position.set(cx + Math.sin(a) * (w * 0.36 + 0.5), CURB + h + 3.8, cz + Math.cos(a) * (w * 0.36 + 0.5));
      p.rotation.y = a;
      this.scene.add(p);
    }
    const blink = new THREE.Mesh(new THREE.SphereGeometry(0.8, 10, 8), new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.4, 0.3), toneMapped: false }));
    blink.position.set(cx, CURB + h + 26, cz);
    this.scene.add(blink);
    this.anim.push((t) => { blink.visible = Math.sin(t * 3) > 0.2; });
    // entrance canopy + steps towards the X-Platz
    const can = new THREE.Mesh(new THREE.BoxGeometry(16, 0.4, 6), new THREE.MeshPhysicalMaterial({ color: 0xdedede, metalness: 0.8, roughness: 0.25 }));
    can.position.set(cx, CURB + 5, cz + w / 2 + 3); can.castShadow = true;
    this.scene.add(can);
    this.hq = { x: cx, z: cz };
  }

  buildSilo(x0, x1, z0, z1) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const gt = this.fb.T.glass.map.clone(), gl = this.fb.T.glass.emissiveMap.clone(), gn = this.fb.T.glass.normalMap.clone();
    for (const t of [gt, gl, gn]) { t.repeat.set(5, 3.5); t.needsUpdate = true; }
    const mat = new THREE.MeshPhysicalMaterial({ color: 0x5d6488, roughness: 0.25, metalness: 0.7, map: gt, normalMap: gn, emissiveMap: gl, emissive: 0x9aa3ff, emissiveIntensity: 0.5, clearcoat: 1 });
    const silo = new THREE.Mesh(new THREE.CylinderGeometry(20, 22, 96, 48), mat);
    silo.position.set(cx, CURB + 48, cz); silo.castShadow = true;
    this.scene.add(silo);
    for (let y = 8; y < 96; y += 12) { const r = new THREE.Mesh(new THREE.TorusGeometry(20.6 + (96 - y) / 96 * 1.6, 0.25, 6, 64), new THREE.MeshStandardMaterial({ color: 0x2c3040, metalness: 0.8, roughness: 0.3 })); r.rotation.x = Math.PI / 2; r.position.set(cx, CURB + y, cz); this.scene.add(r); }
    const dome = new THREE.Mesh(new THREE.SphereGeometry(20, 48, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    dome.position.set(cx, CURB + 96, cz);
    this.scene.add(dome);
    const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9aa3ff, emissiveIntensity: 0.35, roughness: 0.9 });
    const cloud = new THREE.Group();
    for (const [x, y, z, r] of [[0, 0, 0, 12], [12, -2, 3, 9], [-12, -2, -2, 9], [5, 4, -6, 8], [-6, 3, 7, 8]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 24, 16), cm); b.position.set(x, y, z); cloud.add(b); }
    cloud.position.set(cx, CURB + 130, cz);
    this.scene.add(cloud);
    this.anim.push((t) => { cloud.position.y = CURB + 130 + Math.sin(t * 0.5) * 2; cloud.rotation.y = t * 0.05; });
    this.circles.push({ x: cx, z: cz, r: 23 });
    this.silo = { x: cx, z: cz };
  }

  buildBillboards() {
    const ads = [
      ['itmX CRM', 'Alle Kundendaten. Ein X.', '#50af30'],
      ['CLOUDIUS', 'Ihre Daten. Unser Silo.', '#6c74d8'],
      ['OCEAN FM', 'Sunset Hits 24/7', '#ff7a59'],
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
      const grp = new THREE.Group();
      const m = new THREE.Mesh(new THREE.PlaneGeometry(b.w, b.w * 0.39), new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, color: new THREE.Color(1.2, 1.2, 1.2) }));
      m.position.y = b.w * 0.2 + 3;
      grp.add(m);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(b.w + 0.4, b.w * 0.39 + 0.4, 0.3), new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.6, roughness: 0.4 }));
      frame.position.set(0, m.position.y, -0.2); grp.add(frame);
      for (const s2 of [-0.3, 0.3]) { const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 3, 8), frame.material); leg.position.set(s2 * b.w, 1.5, -0.2); grp.add(leg); }
      grp.position.set(b.x, b.y, b.z); grp.rotation.y = b.ry;
      grp.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(grp);
    }
  }

  // ---------------------------------------------------------------- coast: promenade, beach, ocean
  buildCoast() {
    const S = this.scene;
    const prom = new THREE.BoxGeometry(SHORE - (ROADS[5] + RW / 2), CURB, 524);
    prom.translate((SHORE + ROADS[5] + RW / 2) / 2, CURB / 2, 0);
    plainUV(prom, 6, 6);
    const pm = new THREE.Mesh(prom, new THREE.MeshStandardMaterial({ map: this.SW.map, normalMap: this.SW.normalMap, color: 0xffe2cc, roughness: 0.85 }));
    pm.receiveShadow = true; S.add(pm);
    for (let z = -250; z <= 250; z += 13) this.palmSpots.push([ROADS[5] + RW / 2 + 3, z, CURB, rand(0.95, 1.25)]);
    for (let z = -244; z <= 244; z += 26) { this.F.benches.push({ x: SHORE - 1.5, y: CURB, z, ry: -Math.PI / 2 }); this.F.bins.push({ x: SHORE - 1, y: CURB, z: z + 4 }); }
    // sea wall railing
    const rail = []; for (let z = -260; z < 260; z += 2.5) { const p = new THREE.BoxGeometry(0.08, 1, 0.08); p.translate(SHORE - 0.3, CURB + 0.5, z); rail.push(p); }
    const top = new THREE.BoxGeometry(0.1, 0.08, 520); top.translate(SHORE - 0.3, CURB + 1, 0); rail.push(top);
    S.add(new THREE.Mesh(merge(rail.map((g) => g.index ? g.toNonIndexed() : g)), new THREE.MeshStandardMaterial({ color: 0xf2f2f2, metalness: 0.6, roughness: 0.3 })));
    // beach
    const sand = sandSet(512);
    for (const t of [sand.map, sand.normalMap]) t.repeat.set(24, 140);
    const bg = new THREE.PlaneGeometry(90, 560, 40, 6);
    bg.rotateX(-Math.PI / 2);
    const p = bg.attributes.position;
    for (let i = 0; i < p.count; i++) { const x = p.getX(i) + 45; p.setY(i, -x * SLOPE + Math.sin(p.getZ(i) * 0.05 + x * 0.1) * 0.05); }
    bg.computeVertexNormals();
    bg.translate(SHORE + 45, 0, 0);
    const beach = new THREE.Mesh(bg, new THREE.MeshStandardMaterial({ map: sand.map, normalMap: sand.normalMap, roughness: 0.95, color: 0xfff4e6 }));
    beach.receiveShadow = true; S.add(beach);
    for (let k = 0; k < 26; k++) this.palmSpots.push([rand(SHORE + 4, SHORE + 22), rand(-240, 240), 0, rand(0.9, 1.3)]);
    // ocean
    const wn = waterNormals(512);
    if (this.quality !== 'mobil') {
      const water = new Water(new THREE.PlaneGeometry(4000, 4000), {
        textureWidth: this.quality === 'ultra' ? 1024 : 512, textureHeight: this.quality === 'ultra' ? 1024 : 512,
        waterNormals: wn, sunDirection: this.sunDir.clone(), sunColor: 0xffc890, waterColor: 0x0a3a4c, distortionScale: 2.2, fog: true, alpha: 1
      });
      water.rotation.x = -Math.PI / 2;
      water.position.set(WATER_X + 2000 - 40, WATER_Y, 0);
      water.material.uniforms.size.value = 6;
      S.add(water);
      // the reflection only needs the big shapes: hide people, cars and small props while it renders
      this.mirrorHide = [];
      const before = water.onBeforeRender.bind(water);
      water.onBeforeRender = (...a) => {
        const hidden = [];
        for (const o of this.mirrorHide) if (o.visible) { o.visible = false; hidden.push(o); }
        before(...a);
        for (const o of hidden) o.visible = true;
      };
      this.water = water;
      this.anim.push((t) => { water.material.uniforms.time.value = t * 0.6; });
    } else {
      wn.repeat.set(260, 260);
      const water = new THREE.Mesh(new THREE.PlaneGeometry(3000, 3000), new THREE.MeshPhysicalMaterial({ color: 0x0a3f55, roughness: 0.1, metalness: 0.2, normalMap: wn, normalScale: new THREE.Vector2(0.25, 0.25), envMapIntensity: 1.6, clearcoat: 1, clearcoatRoughness: 0.05 }));
      water.rotation.x = -Math.PI / 2;
      water.position.set(WATER_X + 1500 - 40, WATER_Y, 0);
      S.add(water);
      this.anim.push((t) => { wn.offset.set(t * 0.012, t * 0.007); });
    }
    // shallow water tint + foam along the shoreline
    const shoreX = SHORE + 0.45 / SLOPE;
    const foamTex = canvasTexture(512, 64, (g, w, h) => {
      for (let i = 0; i < 2400; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.6})`; g.beginPath(); g.arc(Math.random() * w, Math.random() * h, Math.random() * 2.5, 0, 7); g.fill(); }
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(0,0,0,1)'); gr.addColorStop(0.45, 'rgba(0,0,0,0)'); gr.addColorStop(0.6, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,1)');
      g.globalCompositeOperation = 'destination-out'; g.fillStyle = gr; g.fillRect(0, 0, w, h);
    });
    foamTex.wrapS = THREE.RepeatWrapping; foamTex.repeat.set(60, 1);
    const foams = [];
    for (let k = 0; k < 3; k++) {
      const foam = new THREE.Mesh(new THREE.PlaneGeometry(560, 4 + k * 2), new THREE.MeshBasicMaterial({ map: foamTex, transparent: true, depthWrite: false, opacity: 0.8 }));
      foam.rotation.set(-Math.PI / 2, 0, Math.PI / 2);
      foam.position.set(shoreX + k * 5, WATER_Y + 0.03, 0);
      S.add(foam); foams.push(foam);
    }
    this.anim.push((t) => { foams.forEach((f, k) => { const ph = t * 0.7 + k * 2.1; f.position.x = shoreX + k * 6 - Math.sin(ph) * 2.5; f.material.opacity = (0.5 + Math.sin(ph) * 0.4) * (1 - k * 0.25); }); foamTex.offset.x = t * 0.01; });
    // wet sand darkening near the water
    const wet = new THREE.Mesh(new THREE.PlaneGeometry(10, 560), new THREE.MeshStandardMaterial({ color: 0x6b5a44, transparent: true, opacity: 0.35, roughness: 0.25, depthWrite: false }));
    wet.rotation.x = -Math.PI / 2; wet.rotation.z = 0; wet.position.set(shoreX - 4, -(shoreX - 4 - SHORE) * SLOPE + 0.02, 0); S.add(wet);
    // lifeguard huts
    const hutCols = [0xff6fa5, 0x3fd0c9, 0xffd34d];
    [-150, -20, 110].forEach((z, k) => {
      const g = new THREE.Group();
      const hut = new THREE.Mesh(new THREE.BoxGeometry(3.4, 2.4, 3), new THREE.MeshStandardMaterial({ color: hutCols[k], roughness: 0.6 }));
      hut.position.y = 3.6; hut.castShadow = true; g.add(hut);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(3.45, 0.3, 3.05), new THREE.MeshStandardMaterial({ color: 0xffffff })); stripe.position.y = 3.2; g.add(stripe);
      const win = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.8, 2.2), new THREE.MeshStandardMaterial({ color: 0x1d2a36, roughness: 0.1, metalness: 0.5 })); win.position.y = 4.1; g.add(win);
      const roof = new THREE.Mesh(new THREE.ConeGeometry(2.9, 1.2, 4), new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
      roof.position.y = 5.4; roof.rotation.y = Math.PI / 4; roof.castShadow = true; g.add(roof);
      const ramp = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 5), new THREE.MeshStandardMaterial({ color: 0xc9a77a })); ramp.position.set(0, 1.2, -3.6); ramp.rotation.x = -0.45; g.add(ramp);
      for (const [x, zz] of [[-1.4, -1.2], [1.4, -1.2], [-1.4, 1.2], [1.4, 1.2]]) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 2.6), new THREE.MeshStandardMaterial({ color: 0xffffff })); l.position.set(x, 1.3, zz); g.add(l); }
      g.position.set(SHORE + 16, -16 * SLOPE, z);
      S.add(g);
      this.circles.push({ x: SHORE + 16, z, r: 2.4 });
    });
    // umbrellas + towels (instanced, colour per instance)
    const umb = [0xff3d6e, 0x19c3ff, 0xffb000, 0x7dff6a, 0xffffff];
    const towel = [0xff5d8f, 0x3fd0c9, 0xffd166, 0x6a4c9c, 0xffffff];
    const N = 40;
    const canopy = new THREE.InstancedMesh(new THREE.ConeGeometry(1.6, 0.6, 12, 1, true), new THREE.MeshStandardMaterial({ roughness: 0.7, side: THREE.DoubleSide }), N);
    const poleG = new THREE.CylinderGeometry(0.04, 0.04, 2.3, 6); poleG.translate(0, -1.1, 0);
    const poles = new THREE.InstancedMesh(poleG, new THREE.MeshStandardMaterial({ color: 0xeeeeee }), N);
    const twG = new THREE.PlaneGeometry(0.9, 1.8); twG.rotateX(-Math.PI / 2);
    const towels = new THREE.InstancedMesh(twG, new THREE.MeshStandardMaterial({ roughness: 0.95 }), N);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    for (let k = 0; k < N; k++) {
      const x = rand(SHORE + 6, SHORE + 30), z = rand(-235, 235), y = -(x - SHORE) * SLOPE;
      e.set(rand(-0.15, 0.15), rand(0, 6), rand(-0.15, 0.15)); q.setFromEuler(e);
      M.compose(new THREE.Vector3(x, y + 2.2, z), q, one); canopy.setMatrixAt(k, M); poles.setMatrixAt(k, M);
      canopy.setColorAt(k, new THREE.Color(umb[k % 5]));
      e.set(0, rand(-0.5, 0.5), 0); q.setFromEuler(e);
      M.compose(new THREE.Vector3(x + 1.2, y + 0.03, z + 0.5), q, one); towels.setMatrixAt(k, M);
      towels.setColorAt(k, new THREE.Color(towel[k % 5]));
    }
    canopy.castShadow = poles.castShadow = true; towels.receiveShadow = true;
    S.add(canopy, poles, towels);
    // pier + boats + gulls
    this.pier = buildPier(S, SHORE + 26, 62, 80, WATER_Y);
    const boats = new Boats(S, SHORE + 60, WATER_Y);
    const gulls = new Gulls(S, SHORE + 20);
    this.anim.push((t, dt) => { boats.update(dt, t); gulls.update(t); });
    for (const z of [-262, 262]) this.addSolid(SHORE - 6, 400, z - 6, z + 6);
  }

  // ---------------------------------------------------------------- the X-Platz
  buildPlaza() {
    const S = this.scene;
    const stone = stoneSet(512);
    const tex = canvasTexture(2048, 2048, (g, w, h) => {
      // radial stone pattern with the brand X inlaid
      const img = stone.map.image;
      for (let y = 0; y < h; y += 256) for (let x = 0; x < w; x += 256) g.drawImage(img, x, y, 256, 256);
      for (let r = 80; r < w * 0.75; r += 92) { g.strokeStyle = 'rgba(150,130,100,0.35)'; g.lineWidth = 10; g.beginPath(); g.arc(w / 2, h / 2, r, 0, 7); g.stroke(); }
      g.strokeStyle = '#50af30'; g.lineWidth = 26; g.beginPath(); g.arc(w / 2, h / 2, 420, 0, 7); g.stroke();
      g.save(); g.translate(w / 2, h / 2);
      g.fillStyle = 'rgba(70,160,44,0.92)';
      for (const r of [Math.PI / 4, -Math.PI / 4]) { g.save(); g.rotate(r); g.fillRect(-50, -w * 0.62, 100, w * 1.24); g.restore(); }
      g.restore();
    });
    const nm = stone.normalMap.clone(); nm.repeat.set(8, 8); nm.needsUpdate = true;
    const half = 40 - RW / 2;
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(half * 2 - 0.6, half * 2 - 0.6), new THREE.MeshStandardMaterial({ map: tex, normalMap: nm, roughness: 0.45, metalness: 0.05, envMapIntensity: 1.2 }));
    pl.rotation.x = -Math.PI / 2; pl.position.y = CURB + 0.012; pl.receiveShadow = true;
    S.add(pl);
    const marble = new THREE.MeshPhysicalMaterial({ color: 0xf3f0ea, roughness: 0.15, clearcoat: 0.9 });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(3.6, 4.2, 1.6, 64), marble);
    ped.position.y = CURB + 0.8; ped.castShadow = true; ped.receiveShadow = true;
    S.add(ped);
    const step = new THREE.Mesh(new THREE.CylinderGeometry(5, 5.3, 0.3, 64), marble); step.position.y = CURB + 0.15; step.receiveShadow = true; S.add(step);
    // fountain basin with water around the pedestal
    const basin = new THREE.Mesh(new THREE.TorusGeometry(8.5, 0.35, 10, 80), marble); basin.rotation.x = Math.PI / 2; basin.position.y = CURB + 0.35; S.add(basin);
    const pool = new THREE.Mesh(new THREE.RingGeometry(5.3, 8.4, 64), new THREE.MeshPhysicalMaterial({ color: 0x2c8fa6, roughness: 0.05, metalness: 0.1, clearcoat: 1, transparent: true, opacity: 0.85 }));
    pool.rotation.x = -Math.PI / 2; pool.position.y = CURB + 0.45; S.add(pool);
    const jets = [];
    const jetTex = canvasTexture(32, 128, (g, w, h) => { const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0.3)'); g.fillStyle = gr; g.fillRect(0, 0, w, h); for (let i = 0; i < 60; i++) { g.fillStyle = 'rgba(255,255,255,0.9)'; g.fillRect(Math.random() * w, Math.random() * h, 1, 3); } });
    for (let k = 0; k < 16; k++) { const a = (k / 16) * Math.PI * 2; const j = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.07, 2.2, 8, 1, true), new THREE.MeshBasicMaterial({ map: jetTex, color: 0xcfefff, transparent: true, opacity: 0.6, depthWrite: false, blending: THREE.AdditiveBlending })); j.position.set(Math.cos(a) * 7, CURB + 1.5, Math.sin(a) * 7); j.rotation.set(Math.sin(a) * 0.35, 0, -Math.cos(a) * 0.35); S.add(j); jets.push(j); }
    this.anim.push((t) => jets.forEach((j, k) => { j.scale.y = 0.85 + Math.sin(t * 3 + k) * 0.15; }));
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.9, 0.12, 8, 64), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3, 0.5), toneMapped: false }));
    ring.rotation.x = Math.PI / 2; ring.position.y = CURB + 1.3;
    S.add(ring);
    this.pedRing = ring;
    this.circles.push({ x: 0, z: 0, r: 8.8 });
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
    for (let k = 0; k < 12; k++) {
      const a = (k / 12) * Math.PI * 2 + 0.26;
      this.palmSpots.push([Math.cos(a) * 24, Math.sin(a) * 24, CURB, 1.05]);
      this.circles.push({ x: Math.cos(a) * 24, z: Math.sin(a) * 24, r: 0.6 });
      this.F.planters.push({ x: Math.cos(a + 0.26) * 19, y: CURB, z: Math.sin(a + 0.26) * 19, ry: a });
    }
    for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI * 2; this.F.benches.push({ x: Math.cos(a) * 14, y: CURB, z: Math.sin(a) * 14, ry: -a - Math.PI / 2 }); }
    // bollards along the plaza edge (with gaps for the paths)
    for (let s = -30; s <= 30; s += 2.5) {
      if (Math.abs(s) < 5) continue;
      for (const [x, z] of [[s, -31.5], [s, 31.5], [-31.5, s], [31.5, s]]) this.F.bollards.push({ x, y: CURB, z });
    }
  }
  setX(home) {
    this.xHome = home;
    this.xTile.visible = home;
    this.pedRing.material.color.setRGB(home ? 0.6 : 3, home ? 3 : 0.4, home ? 0.5 : 0.3);
  }

  buildStreetProps() {
    this.lights = new TrafficLights(this.scene, ROADS, CURB);
    this.anim.push((t) => this.lights.update(t));
    buildTrees(this.scene, this.treeSpots);
    for (const t of this.treeSpots) this.circles.push({ x: t.x, z: t.z, r: 0.35 });
    buildFurniture(this.scene, this.F);
  }

  // ---------------------------------------------------------------- street lamps + palms (instanced)
  buildLamps() {
    const spots = [];
    for (const r of ROADS) for (let k = 0; k < ROADS.length - 1; k++) {
      const a = ROADS[k] + RW / 2 + 6, b = ROADS[k + 1] - RW / 2 - 6;
      for (let s = a + 2; s <= b; s += 22) {
        spots.push([r + RW / 2 + 0.7, s, -1], [r - RW / 2 - 0.7, s, 1]);
        spots.push([s, r + RW / 2 + 0.7, -2], [s, r - RW / 2 - 0.7, 2]);
      }
    }
    const pole = new THREE.CylinderGeometry(0.08, 0.13, 7, 8); pole.translate(0, 3.5, 0);
    const base = new THREE.CylinderGeometry(0.2, 0.24, 0.6, 8); base.translate(0, 0.3, 0);
    const arm = new THREE.CylinderGeometry(0.05, 0.05, 1.9, 6); arm.rotateZ(Math.PI / 2 - 0.12); arm.translate(0.9, 7.05, 0);
    const housing = new THREE.CylinderGeometry(0.12, 0.38, 0.22, 12); housing.translate(1.75, 7.1, 0);
    const poleGeo = mergeGeometries([pole, base, arm, housing].map((g) => g.index ? g.toNonIndexed() : g));
    const head = new THREE.CircleGeometry(0.3, 12); head.rotateX(Math.PI / 2); head.translate(1.75, 6.98, 0);
    const poles = new THREE.InstancedMesh(poleGeo, new THREE.MeshStandardMaterial({ color: 0x2b2f36, metalness: 0.7, roughness: 0.35 }), spots.length);
    const heads = new THREE.InstancedMesh(head, new THREE.MeshBasicMaterial({ color: new THREE.Color(4, 2.8, 1.6), toneMapped: false, side: THREE.DoubleSide }), spots.length);
    const poolTex = canvasTexture(128, 128, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,190,120,0.5)'); gr.addColorStop(1, 'rgba(255,190,120,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    const poolGeo = new THREE.PlaneGeometry(10, 10); poolGeo.rotateX(-Math.PI / 2); poolGeo.translate(2.4, 0.035, 0);
    const pools = new THREE.InstancedMesh(poolGeo, new THREE.MeshBasicMaterial({ map: poolTex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }), spots.length);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), one = new THREE.Vector3(1, 1, 1);
    spots.forEach(([x, z, dir], i) => {
      const ry = dir === -1 ? Math.PI : dir === 1 ? 0 : dir === -2 ? Math.PI / 2 : -Math.PI / 2;
      e.set(0, ry, 0); q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, CURB, z), q, one);
      poles.setMatrixAt(i, m); heads.setMatrixAt(i, m); pools.setMatrixAt(i, m);
      this.circles.push({ x, z, r: 0.25 });
    });
    poles.castShadow = true;
    this.scene.add(poles, heads, pools);
    this.buildPalms();
  }

  buildPalms() {
    const trunk = new THREE.CylinderGeometry(0.18, 0.32, 9, 10, 18);
    trunk.translate(0, 4.5, 0);
    const tp = trunk.attributes.position;
    for (let i = 0; i < tp.count; i++) {
      const y = tp.getY(i);
      const ring = 1 + 0.08 * Math.max(0, Math.sin(y * 9)); // bark rings
      tp.setX(i, tp.getX(i) * ring + (y * y) * 0.012); tp.setZ(i, tp.getZ(i) * ring);
    }
    trunk.computeVertexNormals();
    const fronds = [];
    for (let k = 0; k < 12; k++) {
      const f = new THREE.PlaneGeometry(1.25, 4.8, 2, 10);
      const p = f.attributes.position;
      for (let i = 0; i < p.count; i++) { const y = p.getY(i) + 2.4; p.setY(i, y); p.setZ(i, -(y * y) * 0.085 - Math.abs(p.getX(i)) * 0.25); }
      f.rotateX(-Math.PI / 2 + 0.3 + (k % 3) * 0.12);
      f.rotateY((k / 12) * Math.PI * 2 + rand(-0.15, 0.15));
      f.translate(0.97, 9, 0);
      fronds.push(f);
    }
    // coconuts
    const nuts = [];
    for (let k = 0; k < 4; k++) { const n = new THREE.SphereGeometry(0.14, 8, 6); n.translate(0.97 + Math.cos(k * 1.6) * 0.22, 8.75, Math.sin(k * 1.6) * 0.22); nuts.push(n); }
    const frondGeo = mergeGeometries(fronds);
    frondGeo.computeVertexNormals();
    const leaf = canvasTexture(128, 512, (g, w, h) => {
      g.strokeStyle = '#7a6a35'; g.lineWidth = 5; g.beginPath(); g.moveTo(w / 2, 0); g.lineTo(w / 2, h); g.stroke();
      for (let y = 6; y < h; y += 5) {
        const len = (w / 2) * Math.sin((y / h) * Math.PI) * 0.97 + 4;
        g.strokeStyle = `hsl(${88 + Math.random() * 30}, ${45 + Math.random() * 20}%, ${22 + Math.random() * 16}%)`; g.lineWidth = 3.2;
        g.beginPath(); g.moveTo(w / 2, y); g.lineTo(w / 2 - len, y + 16); g.moveTo(w / 2, y); g.lineTo(w / 2 + len, y + 16); g.stroke();
      }
    });
    const bark = canvasTexture(64, 256, (g, w, h) => { g.fillStyle = '#7d6247'; g.fillRect(0, 0, w, h); for (let y = 0; y < h; y += 8) { g.fillStyle = `rgba(40,25,10,${0.2 + Math.random() * 0.3})`; g.fillRect(0, y, w, 3); } });
    const tm = new THREE.MeshStandardMaterial({ map: bark, roughness: 0.95 });
    const fm = new THREE.MeshStandardMaterial({ map: leaf, alphaTest: 0.4, side: THREE.DoubleSide, roughness: 0.75 });
    const n = this.palmSpots.length;
    const T = new THREE.InstancedMesh(trunk, tm, n), Fr = new THREE.InstancedMesh(frondGeo, fm, n), Nu = new THREE.InstancedMesh(mergeGeometries(nuts), new THREE.MeshStandardMaterial({ color: 0x5a4a20, roughness: 0.7 }), n);
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    this.palmSpots.forEach(([x, z, y, s], i) => {
      e.set(0, rand(0, Math.PI * 2), 0); q.setFromEuler(e);
      m.compose(new THREE.Vector3(x, y, z), q, new THREE.Vector3(s, s * rand(0.9, 1.15), s));
      T.setMatrixAt(i, m); Fr.setMatrixAt(i, m); Nu.setMatrixAt(i, m);
    });
    T.castShadow = Fr.castShadow = true;
    this.scene.add(T, Fr, Nu);
    // fronds sway in the sea breeze (shader bend on the leaf tips)
    const uT = { value: 0 };
    fm.onBeforeCompile = (sh) => {
      sh.uniforms.uT = uT;
      sh.vertexShader = 'uniform float uT;\n' + sh.vertexShader.replace('#include <begin_vertex>', `#include <begin_vertex>
        float tip = max(0.0, length(transformed.xz) - 1.0);
        transformed.y += sin(uT * 1.6 + float(gl_InstanceID) * 1.7 + transformed.x) * 0.05 * tip;
        transformed.x += sin(uT * 1.1 + float(gl_InstanceID)) * 0.04 * tip;`);
    };
    this.anim.push((t) => { uT.value = t; });
    this.palms = Fr;
  }

  buildSkyline() {
    const list = [];
    for (let k = 0; k < 110; k++) {
      const a = rand(Math.PI * 0.55, Math.PI * 1.45);
      const r = rand(330, 650);
      const h = rand(30, 170);
      const w = rand(18, 42);
      const g = new THREE.BoxGeometry(w, h, w); g.translate(Math.cos(a) * r, h / 2, Math.sin(a) * r);
      const uv = g.attributes.uv;
      for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * w / 24, uv.getY(i) * h / 30);
      list.push(tint(g, 0x6a6280));
    }
    const T = this.fb.T.glass;
    const m = new THREE.Mesh(merge(list), new THREE.MeshStandardMaterial({ vertexColors: true, map: T.map, emissiveMap: T.emissiveMap, emissive: 0xffc890, emissiveIntensity: 0.5, roughness: 0.4, metalness: 0.4 }));
    this.scene.add(m);
  }

  // ---------------------------------------------------------------- collision
  indexSolids() {
    this.hash = new Map();
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
    const P = this.pier;
    if (P && x > P.x0 && x < P.x1 && z > P.z0 && z < P.z1) return P.y;
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
