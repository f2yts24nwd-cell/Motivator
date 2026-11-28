import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture } from '../../core/gfx.js';
import { leafSet, fbm } from './textures.js';

// Street furniture, traffic lights, trees, pier, boats, gulls and the cloud layer.

const R = (a = 0, b = 1) => a + Math.random() * (b - a);
function tint(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color), n = g.attributes.position.count, arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (g.attributes.uv) g.deleteAttribute('uv');
  return g;
}
const B = (w, h, d, x, y, z, c) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return tint(g, c); };
const C = (r1, r2, h, x, y, z, c, seg = 12) => { const g = new THREE.CylinderGeometry(r1, r2, h, seg); g.translate(x, y, z); return tint(g, c); };

function instanced(scene, geo, mat, items, { shadow = true } = {}) {
  if (!items.length) return null;
  const m = new THREE.InstancedMesh(geo, mat, items.length);
  const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
  items.forEach((p, i) => { e.set(0, p.ry || 0, 0); q.setFromEuler(e); M.compose(new THREE.Vector3(p.x, p.y || 0, p.z), q, new THREE.Vector3(p.s || 1, p.s || 1, p.s || 1)); m.setMatrixAt(i, M); });
  m.castShadow = shadow; m.receiveShadow = true;
  scene.add(m);
  return m;
}
const vc = (o = {}) => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, ...o });

// ------------------------------------------------------------------ traffic signals
const CYCLE = 30;
/** 'g' | 'y' | 'r' for the axis 'ns' (moving along z) or 'ew' (moving along x) */
export function signal(axis, t) {
  const p = ((t % CYCLE) + CYCLE) % CYCLE;
  if (axis === 'ns') return p < 12 ? 'g' : p < 15 ? 'y' : 'r';
  return p < 15 ? 'r' : p < 27 ? 'g' : 'y';
}

export class TrafficLights {
  constructor(scene, roads, curb) {
    const poles = [], heads = [];
    for (const x of roads) for (const z of roads) for (const [fx, fz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
      // approach direction f; pole on the far right corner, arm reaching over the lanes
      const rx = -fz, rz = fx;
      const px = x + rx * 8.4 + fx * 8.4, pz = z + rz * 8.4 + fz * 8.4;
      if (Math.abs(px) > 215 || Math.abs(pz) > 215) continue;
      const ry = Math.atan2(-rx, -rz); // arm points along -r
      poles.push({ x: px, y: curb, z: pz, ry });
      heads.push({ x: px - rx * 5.6, y: curb + 5.2, z: pz - rz * 5.6, ry: Math.atan2(-fx, -fz), axis: fx === 0 ? 'ns' : 'ew' });
    }
    const pole = mergeGeometries([C(0.11, 0.14, 6, 0, 3, 0, 0x2d3136, 8), B(0.12, 0.12, 6, 0, 5.9, 3, 0x2d3136), C(0.2, 0.2, 0.5, 0, 0.25, 0, 0x2d3136, 8)]);
    instanced(scene, pole, vc({ metalness: 0.6, roughness: 0.4 }), poles);
    const head = mergeGeometries([B(0.42, 1.25, 0.32, 0, 0, 0, 0x1b1d20), B(0.6, 1.45, 0.04, 0, 0, -0.17, 0x111111)]);
    instanced(scene, head, vc({ roughness: 0.5 }), heads);
    // bulbs (3 per head), colour updated by the signal cycle
    const bulbs = new THREE.InstancedMesh(new THREE.CircleGeometry(0.13, 16), new THREE.MeshBasicMaterial({ toneMapped: false }), heads.length * 3);
    const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
    heads.forEach((h, i) => {
      [0.38, 0, -0.38].forEach((dy, k) => {
        e.set(0, h.ry, 0); q.setFromEuler(e);
        const off = new THREE.Vector3(0, dy, 0.165).applyQuaternion(q);
        M.compose(new THREE.Vector3(h.x + off.x, h.y + off.y, h.z + off.z), q, new THREE.Vector3(1, 1, 1));
        bulbs.setMatrixAt(i * 3 + k, M);
        bulbs.setColorAt(i * 3 + k, new THREE.Color(0x111111));
      });
    });
    scene.add(bulbs);
    this.bulbs = bulbs; this.heads = heads; this.last = '';
  }
  update(t) {
    const key = signal('ns', t) + signal('ew', t);
    if (key === this.last) return;
    this.last = key;
    const on = { r: new THREE.Color(6, 0.25, 0.15), y: new THREE.Color(6, 3.4, 0.2), g: new THREE.Color(0.2, 5, 1.4) }, off = new THREE.Color(0.08, 0.08, 0.08);
    this.heads.forEach((h, i) => {
      const s = signal(h.axis, t);
      ['r', 'y', 'g'].forEach((c, k) => this.bulbs.setColorAt(i * 3 + k, s === c ? on[c] : off));
    });
    this.bulbs.instanceColor.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ trees (leaf-card crowns)
export function buildTrees(scene, spots) {
  if (!spots.length) return;
  const trunk = (() => {
    const t = new THREE.CylinderGeometry(0.12, 0.2, 4.2, 8, 4); t.translate(0, 2.1, 0);
    const p = t.attributes.position; for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) + Math.sin(p.getY(i) * 1.3) * 0.08);
    t.computeVertexNormals();
    const br = []; for (let k = 0; k < 4; k++) { const b = new THREE.CylinderGeometry(0.05, 0.09, 1.6, 6); b.translate(0, 0.8, 0); b.rotateZ(0.7); b.rotateY(k * 1.6); b.translate(0, 3.4, 0); br.push(b); }
    const pit = new THREE.BoxGeometry(1.4, 0.06, 1.4); pit.translate(0, 0.03, 0);
    return mergeGeometries([tint(t, 0x5a4636), ...br.map((b) => tint(b, 0x5a4636)), tint(pit, 0x3b2f26)]);
  })();
  instanced(scene, trunk, vc({ roughness: 0.95 }), spots);
  // crown: 46 leaf cards on a sphere, normals pointing outwards for soft lighting
  const cards = [];
  for (let k = 0; k < 46; k++) {
    const g = new THREE.PlaneGeometry(1.7, 1.7);
    const dir = new THREE.Vector3(R(-1, 1), R(-0.5, 1), R(-1, 1)).normalize();
    g.lookAt(dir);
    g.rotateZ(R(0, 6.28));
    const c = dir.clone().multiplyScalar(R(0.9, 1.9)).multiply(new THREE.Vector3(1, 0.75, 1));
    g.translate(c.x, c.y + 4.8, c.z);
    const n = g.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, dir.x, dir.y, dir.z);
    cards.push(g);
  }
  const crown = mergeGeometries(cards);
  const m = instanced(scene, crown, new THREE.MeshStandardMaterial({ map: leafSet(), alphaTest: 0.45, side: THREE.DoubleSide, roughness: 0.8, color: 0xd8e8c0 }), spots);
  if (m) { const cols = [0xc8e0a8, 0xe0e8b0, 0xb8d898, 0xf0d8a0]; spots.forEach((_, i) => m.setColorAt(i, new THREE.Color(cols[i % cols.length]))); }
}

// ------------------------------------------------------------------ small street furniture
export function buildFurniture(scene, { hydrants = [], bins = [], benches = [], bollards = [], newsboxes = [], manholes = [], shelters = [], planters = [] }) {
  instanced(scene, mergeGeometries([C(0.15, 0.17, 0.6, 0, 0.3, 0, 0xc8201c), C(0.17, 0.12, 0.12, 0, 0.66, 0, 0xc8201c), C(0.06, 0.06, 0.5, 0, 0.42, 0, 0xd0d0d0).rotateZ(Math.PI / 2), C(0.21, 0.21, 0.06, 0, 0.03, 0, 0x8a1410)]), vc({ roughness: 0.4, metalness: 0.3 }), hydrants);
  instanced(scene, mergeGeometries([C(0.27, 0.24, 0.95, 0, 0.475, 0, 0x2a4a3a, 14), C(0.29, 0.29, 0.06, 0, 0.98, 0, 0x1e2e26, 14)]), vc({ roughness: 0.5, metalness: 0.4 }), bins);
  const bench = [];
  for (let k = 0; k < 4; k++) bench.push(B(1.9, 0.05, 0.1, 0, 0.45, -0.2 + k * 0.13, 0x9a6a3e));
  for (let k = 0; k < 3; k++) bench.push(B(1.9, 0.1, 0.04, 0, 0.62 + k * 0.13, -0.27, 0x9a6a3e));
  for (const s of [-0.8, 0.8]) bench.push(B(0.06, 0.45, 0.5, s, 0.22, 0, 0x2b2b2b), B(0.06, 0.45, 0.05, s, 0.68, -0.28, 0x2b2b2b));
  instanced(scene, mergeGeometries(bench), vc({ roughness: 0.7 }), benches);
  instanced(scene, mergeGeometries([C(0.1, 0.12, 0.9, 0, 0.45, 0, 0x30343a, 10), C(0.11, 0.11, 0.06, 0, 0.7, 0, 0xd8d8d8, 10)]), vc({ metalness: 0.5, roughness: 0.4 }), bollards);
  instanced(scene, mergeGeometries([B(0.5, 0.9, 0.45, 0, 0.45, 0, 0x1f5fa8), B(0.4, 0.3, 0.02, 0, 0.75, 0.23, 0xdddddd)]), vc({ roughness: 0.5 }), newsboxes);
  instanced(scene, mergeGeometries([C(0.36, 0.36, 0.02, 0, 0.012, 0, 0x2c2c2e, 20)]), vc({ roughness: 0.4, metalness: 0.7 }), manholes, { shadow: false });
  instanced(scene, mergeGeometries([B(1.6, 0.5, 1.6, 0, 0.25, 0, 0x8c8478), ...Array.from({ length: 7 }, () => { const g = new THREE.SphereGeometry(R(0.18, 0.3), 8, 6); g.translate(R(-0.5, 0.5), 0.6, R(-0.5, 0.5)); return tint(g, [0xff5d8f, 0xffd166, 0xffffff, 0x3a7d2c, 0x4f9a35][Math.floor(R(0, 5))]); })]), vc({ roughness: 0.8 }), planters);
  // bus shelters with a lit poster
  if (shelters.length) {
    const sh = mergeGeometries([B(4, 0.1, 1.6, 0, 2.6, 0, 0x2b2f35), B(0.08, 2.6, 0.08, -1.95, 1.3, -0.75, 0x2b2f35), B(0.08, 2.6, 0.08, 1.95, 1.3, -0.75, 0x2b2f35), B(0.08, 2.6, 0.08, -1.95, 1.3, 0.75, 0x2b2f35), B(0.08, 2.6, 0.08, 1.95, 1.3, 0.75, 0x2b2f35), B(3.2, 0.06, 0.4, 0, 0.5, -0.5, 0x9a9a9a)]);
    instanced(scene, sh, vc({ metalness: 0.6, roughness: 0.4 }), shelters);
    const glass = new THREE.BoxGeometry(3.9, 2.3, 0.03); glass.translate(0, 1.35, -0.78);
    instanced(scene, glass, new THREE.MeshPhysicalMaterial({ color: 0xaad4e6, roughness: 0.05, transmission: 0, transparent: true, opacity: 0.25, metalness: 0.1 }), shelters, { shadow: false });
    const poster = canvasTexture(256, 512, (g, w, h) => {
      const gr = g.createLinearGradient(0, 0, 0, h); gr.addColorStop(0, '#ff7a59'); gr.addColorStop(1, '#5b2a86'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
      g.fillStyle = '#fff'; g.font = 'italic 900 54px Arial'; g.textAlign = 'center'; g.fillText('SUMMER', w / 2, 130); g.fillText('DEALS', w / 2, 190);
      g.font = '600 22px Arial'; g.fillText('Ludlein Bay Mall', w / 2, 460);
      g.fillStyle = '#ffd166'; g.beginPath(); g.arc(w / 2, 320, 70, 0, 7); g.fill();
    });
    const pg = new THREE.PlaneGeometry(1.1, 1.9); pg.rotateY(Math.PI / 2); pg.translate(1.92, 1.35, 0);
    instanced(scene, pg, new THREE.MeshBasicMaterial({ map: poster, color: new THREE.Color(1.3, 1.3, 1.3), side: THREE.DoubleSide }), shelters, { shadow: false });
  }
}

// ------------------------------------------------------------------ pier, boats, gulls
export function buildPier(scene, x0, z, len = 70, waterY = -0.45) {
  const wood = canvasTexture(256, 256, (g, w, h) => {
    for (let y = 0; y < h; y += 32) { g.fillStyle = `hsl(28,${R(25, 35)}%,${R(36, 46)}%)`; g.fillRect(0, y, w, 30); g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, y + 30, w, 2); for (let k = 0; k < 40; k++) { g.fillStyle = 'rgba(40,20,5,0.15)'; g.fillRect(R(0, w), y + R(0, 30), R(10, 60), 1); } }
  });
  wood.wrapS = wood.wrapT = THREE.RepeatWrapping; wood.repeat.set(len / 4, 2);
  const deck = new THREE.Mesh(new THREE.BoxGeometry(len, 0.3, 6), new THREE.MeshStandardMaterial({ map: wood, roughness: 0.85 }));
  deck.position.set(x0 + len / 2, 1.4, z); deck.castShadow = deck.receiveShadow = true;
  scene.add(deck);
  const posts = [];
  for (let x = x0 + 2; x < x0 + len; x += 5) for (const s of [-2.8, 2.8]) posts.push({ x, y: waterY - 2, z: z + s });
  instanced(scene, C(0.18, 0.2, 4, 0, 2, 0, 0x4a3626, 8), vc({ roughness: 0.9 }), posts);
  const rail = []; for (let x = x0; x < x0 + len; x += 2.5) for (const s of [-2.9, 2.9]) rail.push({ x, y: 1.55, z: z + s });
  instanced(scene, mergeGeometries([B(0.08, 1, 0.08, 0, 0.5, 0, 0xeeeeee), B(2.5, 0.06, 0.06, 1.25, 1, 0, 0xeeeeee)]), vc({ roughness: 0.5 }), rail);
  return { x0, x1: x0 + len, z0: z - 3, z1: z + 3, y: 1.55 };
}

export class Boats {
  constructor(scene, x0, waterY) {
    this.list = [];
    this.waterY = waterY;
    const hullShape = new THREE.Shape();
    hullShape.moveTo(0, -4); hullShape.quadraticCurveTo(1.4, -2.5, 1.3, 2.6); hullShape.lineTo(-1.3, 2.6); hullShape.quadraticCurveTo(-1.4, -2.5, 0, -4);
    const hull = new THREE.ExtrudeGeometry(hullShape, { depth: 1.1, bevelEnabled: true, bevelSize: 0.15, bevelThickness: 0.15, bevelSegments: 2 });
    hull.rotateX(Math.PI / 2); hull.translate(0, 0.9, 0);
    for (let k = 0; k < 9; k++) {
      const g = new THREE.Group();
      const sail = k % 2 === 0;
      const col = [0xffffff, 0xf4f1ea, 0x1d3557, 0xffffff][k % 4];
      const h = new THREE.Mesh(hull, new THREE.MeshPhysicalMaterial({ color: col, roughness: 0.25, clearcoat: 1 }));
      h.castShadow = true; g.add(h);
      const stripe = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.12, 6.4), new THREE.MeshStandardMaterial({ color: [0x19c3ff, 0xff3d6e, 0x50af30][k % 3] })); stripe.position.set(0, 0.55, -0.6); g.add(stripe);
      const deck = new THREE.Mesh(new THREE.BoxGeometry(2.3, 0.1, 5.6), new THREE.MeshStandardMaterial({ color: 0xb98a5a, roughness: 0.8 })); deck.position.set(0, 0.95, -0.7); g.add(deck);
      if (sail) {
        const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 10, 6), new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.7 })); mast.position.set(0, 6, 0.3); g.add(mast);
        const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(0, 8.5); s.lineTo(-3.4, 0); s.lineTo(0, 0);
        const sm = new THREE.Mesh(new THREE.ShapeGeometry(s), new THREE.MeshStandardMaterial({ color: 0xfdfbf5, side: THREE.DoubleSide, roughness: 0.9 }));
        sm.rotation.y = Math.PI / 2; sm.position.set(0, 1.5, 0.2); sm.castShadow = true; g.add(sm);
      } else {
        const cab = new THREE.Mesh(new THREE.BoxGeometry(1.9, 1.1, 2.4), new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.3, clearcoat: 1 })); cab.position.set(0, 1.5, 0.2); g.add(cab);
        const win = new THREE.Mesh(new THREE.BoxGeometry(1.95, 0.4, 2), new THREE.MeshStandardMaterial({ color: 0x1b2633, roughness: 0.1, metalness: 0.6 })); win.position.set(0, 1.7, 0.3); g.add(win);
      }
      const b = { g, x: x0 + R(20, 260), z: R(-240, 240), a: R(0, 6.28), v: R(0.6, 2.4), ph: R(0, 6) };
      scene.add(g);
      this.list.push(b);
    }
  }
  update(dt, t) {
    for (const b of this.list) {
      b.z += Math.cos(b.a) * b.v * dt; b.x += Math.sin(b.a) * b.v * dt * 0.3;
      if (b.z > 260) b.z = -260; if (b.z < -260) b.z = 260;
      b.g.position.set(b.x, this.waterY + Math.sin(t * 1.2 + b.ph) * 0.12, b.z);
      b.g.rotation.set(Math.sin(t * 0.9 + b.ph) * 0.04, b.a, Math.sin(t * 1.1 + b.ph) * 0.05);
    }
  }
}

export class Gulls {
  constructor(scene, cx, n = 24) {
    const body = new THREE.CapsuleGeometry(0.09, 0.35, 2, 6); body.rotateX(Math.PI / 2);
    const wing = new THREE.BufferGeometry();
    wing.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0.1, 0.75, 0.05, -0.05, 0, 0, -0.15, 0, 0, 0.1, 0, 0, -0.15, -0.75, 0.05, -0.05], 3));
    wing.computeVertexNormals();
    this.body = new THREE.InstancedMesh(body, new THREE.MeshStandardMaterial({ color: 0xf4f4f4 }), n);
    this.wing = new THREE.InstancedMesh(wing, new THREE.MeshStandardMaterial({ color: 0xe8e8e8, side: THREE.DoubleSide }), n);
    this.body.frustumCulled = this.wing.frustumCulled = false;
    scene.add(this.body, this.wing);
    this.birds = Array.from({ length: n }, () => ({ c: new THREE.Vector3(cx + R(-30, 60), R(14, 32), R(-200, 200)), r: R(10, 30), w: R(0.25, 0.5) * (Math.random() < 0.5 ? 1 : -1), ph: R(0, 6.28) }));
    this.M = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler();
  }
  update(t) {
    this.birds.forEach((b, i) => {
      const a = t * b.w + b.ph;
      const p = new THREE.Vector3(b.c.x + Math.cos(a) * b.r, b.c.y + Math.sin(a * 2) * 1.5, b.c.z + Math.sin(a) * b.r);
      this.e.set(0, -a + (b.w > 0 ? Math.PI : 0), Math.sign(b.w) * 0.3); this.q.setFromEuler(this.e);
      this.M.compose(p, this.q, new THREE.Vector3(1, 1, 1)); this.body.setMatrixAt(i, this.M);
      const flap = Math.sin(t * 9 + b.ph);
      this.M.compose(p, this.q, new THREE.Vector3(1, 1 + flap * 6, 1)); this.wing.setMatrixAt(i, this.M);
    });
    this.body.instanceMatrix.needsUpdate = this.wing.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ cloud layer (sunset-lit)
export function buildClouds(scene, sunDir) {
  const S = 512;
  const n = fbm(S, S, { scale: 3, oct: 6 });
  const c = document.createElement('canvas'); c.width = c.height = S;
  const g = c.getContext('2d'), img = g.createImageData(S, S);
  for (let i = 0; i < n.length; i++) { const v = Math.max(0, Math.min(1, (n[i] - 0.5) * 3.2)); img.data[i * 4] = img.data[i * 4 + 1] = img.data[i * 4 + 2] = 255; img.data[i * 4 + 3] = v * 255; }
  g.putImageData(img, 0, 0);
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping;
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, fog: false, side: THREE.BackSide,
    uniforms: { map: { value: t }, sun: { value: sunDir.clone().normalize() }, time: { value: 0 } },
    vertexShader: 'varying vec3 vDir; void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `
      uniform sampler2D map; uniform vec3 sun; uniform float time; varying vec3 vDir;
      void main(){
        if (vDir.y < 0.015) discard;
        vec2 uv = vDir.xz / (vDir.y + 0.12) * 0.28 + vec2(time * 0.002, time * 0.001);
        float a = texture2D(map, uv).a;
        float a2 = texture2D(map, uv * 2.3 + 0.37).a;
        float d = a * 0.75 + a2 * 0.35;
        float horizon = smoothstep(0.015, 0.12, vDir.y) * (1.0 - smoothstep(0.35, 0.8, vDir.y));
        float s = max(0.0, dot(normalize(vDir), sun));
        vec3 lit = mix(vec3(0.95, 0.55, 0.5), vec3(1.0, 0.82, 0.55), pow(s, 6.0));
        vec3 shade = vec3(0.42, 0.33, 0.48);
        vec3 col = mix(lit, shade, smoothstep(0.35, 0.95, d)) + vec3(1.0, 0.6, 0.3) * pow(s, 30.0) * 0.6;
        gl_FragColor = vec4(col * 1.6, clamp(d * horizon * 1.2, 0.0, 0.92));
      }`
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(3000, 48, 24), mat);
  dome.renderOrder = -1;
  scene.add(dome);
  return mat;
}
