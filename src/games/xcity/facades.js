import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { windowSet, shopSet } from './textures.js';

// Facade builder: turns a lot (footprint + height + style) into detailed architecture.
// All static pieces are merged per material; repeated details (balconies, AC units, awnings)
// are instanced. Three styles: 'stucco' (mid-rise, shops, balconies, fire escapes),
// 'deco' (pastel art-deco hotels on the Ocean Drive with neon trim) and 'tower' (glass high-rise).

const GF = 4.4; // ground floor height (shops)
const FL = 3.3; // upper floor height
const BAY = 3.2; // window bay width

function tintGeo(geo, color) {
  const g = geo.index ? geo.toNonIndexed() : geo;
  const c = new THREE.Color(color);
  const n = g.attributes.position.count;
  const arr = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3));
  if (!g.attributes.uv) g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(n * 2), 2));
  return g;
}
const box = (x, y, z, w, h, d, color) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y + h / 2, z); return tintGeo(g, color); };

/** facade box: UVs so that every face shows a whole number of window bays and floors */
function facadeBox(x, y, z, w, h, d, color, { bay = BAY, floor = FL, uOff = 0, vOff = 0, cols = 8 } = {}) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const floors = Math.max(1, Math.round(h / floor));
  for (let f = 0; f < 6; f++) for (let k = 0; k < 4; k++) {
    const i = f * 4 + k;
    let u = uv.getX(i), v = uv.getY(i);
    if (f === 2 || f === 3) { u = 0.002; v = 0.002; }
    else {
      const span = f < 2 ? d : w;
      const bays = Math.max(1, Math.round(span / bay));
      u = (u * bays) / cols + uOff;
      v = (v * floors) / cols + vOff;
    }
    uv.setXY(i, u, v);
  }
  geo.translate(x, y + h / 2, z);
  return tintGeo(geo, color);
}

export class FacadeBuilder {
  constructor() {
    // geometry is collected per chunk (CHUNK x CHUNK metres) so the GPU can cull what is off screen
    this.chunks = new Map();
    this.setChunk(0, 0);
    this.inst = { balcony: [], ac: [], aviation: [] };
    this.T = { stucco: windowSet('stucco'), glass: windowSet('glass'), shop: shopSet() };
    this.neonSigns = [];
    this.rand = Math.random;
  }
  setChunk(x, z) {
    const key = Math.floor(x / 120) + ',' + Math.floor(z / 120);
    if (!this.chunks.has(key)) this.chunks.set(key, { stucco: [], glass: [], trim: [], metal: [], shop: [], awning: [], roof: [], neon: [] });
    this.lists = this.chunks.get(key);
  }
  r(a = 0, b = 1) { return a + this.rand() * (b - a); }
  pick(a) { return a[Math.floor(this.rand() * a.length)]; }

  // ---------------------------------------------------------------- ground floor shops (all four sides)
  shops(x0, x1, z0, z1, y, { trim = 0xe9e2d6, height = GF } = {}) {
    const S = this.T.shop;
    const sides = [
      { ax: 'x', a: x0, b: x1, c: z1, n: [0, 1] }, { ax: 'x', a: x0, b: x1, c: z0, n: [0, -1] },
      { ax: 'z', a: z0, b: z1, c: x1, n: [1, 0] }, { ax: 'z', a: z0, b: z1, c: x0, n: [-1, 0] }
    ];
    // core of the ground floor, slightly recessed
    this.lists.trim.push(box((x0 + x1) / 2, y, (z0 + z1) / 2, x1 - x0 - 0.5, height, z1 - z0 - 0.5, 0x3a3836));
    for (const s of sides) {
      const len = s.b - s.a;
      const n = Math.max(1, Math.round(len / 7.5));
      const w = len / n;
      for (let k = 0; k < n; k++) {
        const c = s.a + w * (k + 0.5);
        const idx = Math.floor(this.rand() * S.cols * S.rows);
        const cu = (idx % S.cols) / S.cols, cv = 1 - (Math.floor(idx / S.cols) + 1) / S.rows;
        const p = new THREE.PlaneGeometry(w - 0.7, height - 0.3);
        const uv = p.attributes.uv;
        for (let i = 0; i < uv.count; i++) uv.setXY(i, cu + uv.getX(i) / S.cols, cv + uv.getY(i) / S.rows);
        const rot = Math.atan2(s.n[0], s.n[1]);
        p.rotateY(rot);
        const px = s.ax === 'x' ? c : s.c + s.n[0] * 0.02, pz = s.ax === 'x' ? s.c + s.n[1] * 0.02 : c;
        p.translate(px - s.n[0] * 0.25, y + (height - 0.3) / 2 + 0.05, pz - s.n[1] * 0.25);
        this.lists.shop.push(tintGeo(p, 0xffffff));
        // pilasters between shops
        const pil = s.ax === 'x' ? box(s.a + w * k, y, s.c, 0.5, height, 0.5, trim) : box(s.c, y, s.a + w * k, 0.5, height, 0.5, trim);
        this.lists.trim.push(pil);
        // awning (sloped fabric), colour of the shop
        if (this.rand() < 0.7) {
          const aw = new THREE.BoxGeometry(w - 0.9, 0.08, 1.6);
          aw.translate(0, 0, 0.8);
          aw.rotateX(0.32);
          aw.rotateY(rot);
          aw.translate(px, y + height - 0.55, pz);
          this.lists.awning.push(tintGeo(aw, S.colors[idx]));
          // valance stripe
          const va = new THREE.BoxGeometry(w - 0.9, 0.32, 0.04);
          va.translate(0, -0.66, 1.53);
          va.rotateY(rot);
          va.translate(px, y + height - 0.55, pz);
          this.lists.awning.push(tintGeo(va, 0xf4efe6));
        }
      }
      // last pilaster
      this.lists.trim.push(s.ax === 'x' ? box(s.b, y, s.c, 0.5, height, 0.5, trim) : box(s.c, y, s.b, 0.5, height, 0.5, trim));
    }
    // fascia band above the shops
    this.ring(x0, x1, z0, z1, y + height - 0.05, 0.45, 0.25, trim);
  }

  /** horizontal band around a footprint (ledge, cornice) */
  ring(x0, x1, z0, z1, y, h, out, color, list = this.lists.trim) {
    const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    list.push(box(cx, y, z1 + out / 2, w + out * 2, h, out, color), box(cx, y, z0 - out / 2, w + out * 2, h, out, color));
    list.push(box(x1 + out / 2, y, cz, out, h, d, color), box(x0 - out / 2, y, cz, out, h, d, color));
  }
  parapet(x0, x1, z0, z1, y, color, h = 1.0) {
    const t = 0.3, w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    this.lists.trim.push(box(cx, y, z1 - t / 2, w, h, t, color), box(cx, y, z0 + t / 2, w, h, t, color), box(x1 - t / 2, y, cz, t, h, d - 2 * t, color), box(x0 + t / 2, y, cz, t, h, d - 2 * t, color));
    this.lists.roof.push(box(cx, y, cz, w - 0.2, 0.06, d - 0.2, 0x58554f));
  }
  rooftop(x0, x1, z0, z1, y) {
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, w = x1 - x0, d = z1 - z0;
    // stair hut
    this.lists.roof.push(box(cx + this.r(-w / 4, w / 4), y, cz + this.r(-d / 4, d / 4), 3, 2.6, 3.4, 0xb9b1a6));
    // AC / vents
    for (let k = 0; k < Math.floor(this.r(2, 5)); k++) {
      const x = cx + this.r(-w / 2.6, w / 2.6), z = cz + this.r(-d / 2.6, d / 2.6);
      this.lists.metal.push(box(x, y, z, this.r(1.2, 2.4), this.r(0.8, 1.4), this.r(1.2, 2), 0x9aa0a6));
      this.lists.metal.push(box(x, y + 1.2, z, 0.8, 0.12, 0.8, 0x2b2f33));
    }
    // water tank on wooden legs
    if (this.rand() < 0.35) {
      const x = cx + this.r(-w / 3, w / 3), z = cz + this.r(-d / 3, d / 3);
      const t = new THREE.CylinderGeometry(1.4, 1.4, 2.8, 16); t.translate(x, y + 3.6, z); this.lists.roof.push(tintGeo(t, 0x7a5a40));
      const c = new THREE.ConeGeometry(1.5, 0.9, 16); c.translate(x, y + 5.45, z); this.lists.roof.push(tintGeo(c, 0x5c4432));
      for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) this.lists.metal.push(box(x + a * 0.9, y, z + b * 0.9, 0.15, 2.2, 0.15, 0x3b3b3b));
    }
    // antenna
    if (this.rand() < 0.5) { const x = cx + this.r(-w / 3, w / 3), z = cz + this.r(-d / 3, d / 3); this.lists.metal.push(box(x, y, z, 0.08, this.r(3, 7), 0.08, 0x777777)); }
    // solar panels
    if (this.rand() < 0.3) for (let k = 0; k < 4; k++) {
      const p = new THREE.BoxGeometry(1.6, 0.05, 1); p.rotateX(-0.4); p.translate(cx - w / 4 + k * 1.8, y + 0.6, cz + d / 4);
      this.lists.glass.push(tintGeo(p, 0x1c2a44));
    }
  }

  /** balconies + AC units on the upper floors of one face */
  faceDetails(x0, x1, z0, z1, y0, floors, { balconies = 0.3, ac = 0.12 } = {}) {
    const faces = [
      { a: x0, b: x1, c: z1, n: [0, 1] }, { a: x0, b: x1, c: z0, n: [0, -1] },
      { a: z0, b: z1, c: x1, n: [1, 0], z: true }, { a: z0, b: z1, c: x0, n: [-1, 0], z: true }
    ];
    for (const f of faces) {
      const len = f.b - f.a;
      const bays = Math.max(1, Math.round(len / BAY));
      const bw = len / bays;
      const balCols = new Set();
      for (let i = 0; i < bays; i++) if (this.rand() < balconies) balCols.add(i);
      for (let fl = 0; fl < floors; fl++) for (let i = 0; i < bays; i++) {
        const c = f.a + bw * (i + 0.5);
        const y = y0 + fl * FL;
        const rot = Math.atan2(f.n[0], f.n[1]);
        const px = f.z ? f.c : c, pz = f.z ? c : f.c;
        if (balCols.has(i)) this.inst.balcony.push({ x: px, y: y + 0.05, z: pz, rot, w: Math.min(bw - 0.3, 2.8) });
        else if (this.rand() < ac) this.inst.ac.push({ x: px + f.n[0] * 0.3 + (f.z ? 0 : bw * 0.28), y: y + 0.35, z: pz + f.n[1] * 0.3 + (f.z ? bw * 0.28 : 0), rot });
      }
    }
  }

  fireEscape(x, z0, z1, y0, floors, nx) {
    // on a side wall (constant x), zig-zag stairs between floor platforms
    const len = Math.min(8, z1 - z0 - 2), zc = (z0 + z1) / 2;
    for (let fl = 0; fl < floors; fl++) {
      const y = y0 + fl * FL;
      this.lists.metal.push(box(x + nx * 0.7, y, zc, 1.3, 0.08, len, 0x2a2a2c));
      this.lists.metal.push(box(x + nx * 1.33, y, zc, 0.05, 1.0, len, 0x2a2a2c));
      for (const s of [-1, 1]) this.lists.metal.push(box(x + nx * 0.7, y, zc + s * len / 2, 1.3, 1.0, 0.05, 0x2a2a2c));
      if (fl < floors - 1) {
        const st = new THREE.BoxGeometry(0.9, 0.08, Math.hypot(len * 0.8, FL));
        st.rotateX((fl % 2 ? 1 : -1) * Math.atan2(FL, len * 0.8));
        st.translate(x + nx * 0.7, y + FL / 2, zc);
        this.lists.metal.push(tintGeo(st, 0x2a2a2c));
      }
    }
  }

  // ---------------------------------------------------------------- building styles
  stucco(x0, x1, z0, z1, h, color, y = 0.15) {
    const trim = this.pick([0xf3eee5, 0xe6ddd0, 0xffffff, 0xd9cfc0]);
    this.shops(x0, x1, z0, z1, y, { trim });
    const uOff = Math.floor(this.r(0, 8)) / 8, vOff = Math.floor(this.r(0, 8)) / 8;
    const floors = Math.max(1, Math.round((h - GF) / FL));
    const top = y + GF + floors * FL;
    this.lists.stucco.push(facadeBox((x0 + x1) / 2, y + GF, (z0 + z1) / 2, x1 - x0, floors * FL, z1 - z0, color, { uOff, vOff }));
    for (let f = 1; f < floors; f += 1) if (f % 2 === 0 || floors < 4) this.ring(x0, x1, z0, z1, y + GF + f * FL - 0.1, 0.16, 0.1, trim);
    // corner pilasters
    for (const [cx, cz] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) this.lists.trim.push(box(cx, y + GF, cz, 0.6, floors * FL, 0.6, trim));
    // cornice + parapet
    this.ring(x0, x1, z0, z1, top - 0.1, 0.55, 0.45, trim);
    this.parapet(x0 - 0.2, x1 + 0.2, z0 - 0.2, z1 + 0.2, top + 0.45, trim, 0.9);
    this.rooftop(x0, x1, z0, z1, top + 0.45);
    this.faceDetails(x0, x1, z0, z1, y + GF, floors, { balconies: this.rand() < 0.5 ? 0.35 : 0, ac: 0.12 });
    if (this.rand() < 0.3 && floors > 2) this.fireEscape(this.rand() < 0.5 ? x1 : x0, z0, z1, y + GF + FL * 0.05, floors, this.rand() < 0.5 ? 1 : -1);
    return top;
  }

  deco(x0, x1, z0, z1, h, color, y = 0.15, neon = '#ff3d9a') {
    const trim = 0xffffff;
    this.shops(x0, x1, z0, z1, y, { trim, height: GF });
    const floors = Math.max(2, Math.round((h - GF) / FL));
    const top = y + GF + floors * FL;
    const uOff = Math.floor(this.r(0, 8)) / 8;
    this.lists.stucco.push(facadeBox((x0 + x1) / 2, y + GF, (z0 + z1) / 2, x1 - x0, floors * FL, z1 - z0, color, { uOff, bay: 2.6 }));
    // "eyebrow" sun shades over every window row
    for (let f = 0; f < floors; f++) this.ring(x0, x1, z0, z1, y + GF + f * FL + 2.55, 0.12, 0.55, trim);
    // stepped crown + central fin facing the sea (+x)
    const cz = (z0 + z1) / 2, d = z1 - z0;
    this.ring(x0, x1, z0, z1, top - 0.1, 0.7, 0.3, trim);
    this.lists.stucco.push(facadeBox((x0 + x1) / 2 + 1, top + 0.6, cz, (x1 - x0) * 0.55, 2.6, d * 0.55, color, { uOff }));
    this.lists.trim.push(box(x1 + 0.5, y + GF, cz, 1.0, floors * FL + 5, 2.2, trim));
    // neon trim along the cornice and the fin
    const n = new THREE.Color(neon);
    this.lists.neon.push(box((x0 + x1) / 2, top + 0.65, z1 + 0.33, x1 - x0 + 0.6, 0.07, 0.07, n), box((x0 + x1) / 2, top + 0.65, z0 - 0.33, x1 - x0 + 0.6, 0.07, 0.07, n));
    this.lists.neon.push(box(x1 + 0.33, top + 0.65, cz, 0.07, 0.07, d + 0.6, n));
    this.lists.neon.push(box(x1 + 1.02, y + GF, cz + 1.12, 0.06, floors * FL + 5, 0.06, n), box(x1 + 1.02, y + GF, cz - 1.12, 0.06, floors * FL + 5, 0.06, n));
    this.neonSigns.push({ x: x1 + 1.05, y: y + GF + floors * FL * 0.5 + 2, z: cz, h: floors * FL * 0.8, color: neon });
    // rounded balconies on the sea side
    this.faceDetails(x0, x1, z0, z1, y + GF, floors, { balconies: 0.45, ac: 0.05 });
    this.parapet(x0, x1, z0, z1, top + 0.6, trim, 0.6);
    return top;
  }

  tower(x0, x1, z0, z1, h, tint, y = 0.15) {
    const podium = 2;
    const pf = GF + FL;
    // stone podium with lobby shops
    this.shops(x0 - 1, x1 + 1, z0 - 1, z1 + 1, y, { trim: 0xcfc6ba });
    this.lists.trim.push(box((x0 + x1) / 2, y + GF, (z0 + z1) / 2, x1 - x0 + 2, FL, z1 - z0 + 2, 0xd8d0c4));
    this.ring(x0 - 1, x1 + 1, z0 - 1, z1 + 1, y + pf - 0.1, 0.4, 0.3, 0xcfc6ba);
    void podium;
    const shaftH = h - pf;
    const uOff = Math.floor(this.r(0, 8)) / 8;
    this.lists.glass.push(facadeBox((x0 + x1) / 2, y + pf, (z0 + z1) / 2, x1 - x0, shaftH, z1 - z0, tint, { bay: 3, floor: 3.8, uOff }));
    // vertical fins (one per bay) and a spandrel band every 4 floors
    const finCol = this.pick([0xd9dde2, 0x2c3238, 0xb8a27a]);
    const fins = (a, b, c, alongX, nrm) => {
      const n = Math.round((b - a) / 3);
      for (let i = 0; i <= n; i++) {
        const p = a + ((b - a) * i) / n;
        this.lists.metal.push(alongX ? box(p, y + pf, c + nrm * 0.2, 0.14, shaftH, 0.4, finCol) : box(c + nrm * 0.2, y + pf, p, 0.4, shaftH, 0.14, finCol));
      }
    };
    fins(x0, x1, z1, true, 1); fins(x0, x1, z0, true, -1); fins(z0, z1, x1, false, 1); fins(z0, z1, x0, false, -1);
    for (let yy = y + pf + 3.8 * 4; yy < y + h - 4; yy += 3.8 * 4) this.ring(x0, x1, z0, z1, yy, 0.35, 0.22, finCol, this.lists.metal);
    // crown: setback, mechanical floor, antenna, aviation lights
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
    const sw = (x1 - x0) * 0.72, sd = (z1 - z0) * 0.72;
    this.lists.glass.push(facadeBox(cx, y + h, cz, sw, 7.6, sd, tint, { bay: 3, floor: 3.8, uOff }));
    this.lists.metal.push(box(cx, y + h + 7.6, cz, sw * 0.8, 3, sd * 0.8, 0x5b6168));
    this.ring(x0, x1, z0, z1, y + h - 0.2, 0.5, 0.15, finCol, this.lists.metal);
    this.lists.metal.push(box(cx, y + h + 10.6, cz, 0.25, this.r(6, 14), 0.25, 0xcccccc));
    for (const [ax, az] of [[x0, z0], [x1, z0], [x0, z1], [x1, z1]]) this.inst.aviation.push({ x: ax, y: y + h + 0.2, z: az });
    return y + h + 7.6;
  }

  // ---------------------------------------------------------------- build meshes
  build(scene, glassEnv = 1.4) {
    const T = this.T;
    const mats = {
      stucco: new THREE.MeshStandardMaterial({ vertexColors: true, map: T.stucco.map, normalMap: T.stucco.normalMap, roughnessMap: T.stucco.roughnessMap, emissiveMap: T.stucco.emissiveMap, emissive: 0xffd2a0, emissiveIntensity: 0.55, roughness: 1, normalScale: new THREE.Vector2(1, 1) }),
      glass: new THREE.MeshPhysicalMaterial({ vertexColors: true, map: T.glass.map, normalMap: T.glass.normalMap, roughnessMap: T.glass.roughnessMap, emissiveMap: T.glass.emissiveMap, emissive: 0xffe0b0, emissiveIntensity: 0.6, roughness: 0.35, metalness: 0.6, envMapIntensity: glassEnv, clearcoat: 1, clearcoatRoughness: 0.04 }),
      trim: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.78 }),
      metal: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.45, metalness: 0.65 }),
      shop: new THREE.MeshStandardMaterial({ map: T.shop.map, emissiveMap: T.shop.emissiveMap, emissive: 0xffffff, emissiveIntensity: 0.9, roughness: 0.2, metalness: 0.3 }),
      awning: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, side: THREE.DoubleSide }),
      roof: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }),
      neon: new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false })
    };
    mats.neon.color.setScalar(2.4);
    const out = { meshes: [] };
    for (const lists of this.chunks.values()) for (const [k, list] of Object.entries(lists)) {
      if (!list.length) continue;
      const m = new THREE.Mesh(mergeGeometries(list, false), mats[k]);
      m.castShadow = k !== 'neon' && k !== 'shop';
      m.receiveShadow = k !== 'neon';
      scene.add(m);
      out.meshes.push(m);
    }
    out.mats = mats;
    // instanced balconies: slab + glass-and-steel railing
    const bal = (() => {
      const parts = [box(0, 0, 0.7, 1, 0.16, 1.4, 0xf2efe8), box(0, 0.16, 1.38, 1, 0.95, 0.04, 0x9ec3d6), box(0, 1.08, 1.38, 1.04, 0.06, 0.08, 0x3a3a3a)];
      for (const s of [-0.5, 0.5]) parts.push(box(s, 0.16, 0.7, 0.04, 0.95, 1.4, 0x3a3a3a));
      return mergeGeometries(parts);
    })();
    const ac = mergeGeometries([box(0, 0, 0, 0.9, 0.6, 0.55, 0xd8dadc), box(0, 0.1, 0.28, 0.6, 0.4, 0.02, 0x555555)]);
    const place = (all, geo, mat, scaleW) => {
      // one instanced mesh per chunk, so off-screen balconies are culled
      const groups = new Map();
      for (const p of all) { const k = Math.floor(p.x / 120) + ',' + Math.floor(p.z / 120); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(p); }
      for (const list of groups.values()) placeOne(list, geo, mat, scaleW);
    };
    const placeOne = (list, geo, mat, scaleW) => {
      if (!list.length) return;
      const m = new THREE.InstancedMesh(geo, mat, list.length);
      const M = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler();
      list.forEach((p, i) => { e.set(0, p.rot || 0, 0); q.setFromEuler(e); M.compose(new THREE.Vector3(p.x, p.y, p.z), q, new THREE.Vector3(scaleW ? p.w : 1, 1, 1)); m.setMatrixAt(i, M); });
      m.castShadow = true; m.receiveShadow = true;
      m.computeBoundingSphere();
      scene.add(m);
    };
    place(this.inst.balcony, bal, new THREE.MeshPhysicalMaterial({ vertexColors: true, roughness: 0.4, metalness: 0.2, transmission: 0, clearcoat: 0.5 }), true);
    place(this.inst.ac, ac, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.6, metalness: 0.3 }));
    const av = new THREE.InstancedMesh(new THREE.SphereGeometry(0.35, 8, 6), new THREE.MeshBasicMaterial({ color: new THREE.Color(6, 0.3, 0.2), toneMapped: false }), Math.max(1, this.inst.aviation.length));
    this.inst.aviation.forEach((p, i) => av.setMatrixAt(i, new THREE.Matrix4().makeTranslation(p.x, p.y, p.z)));
    scene.add(av);
    out.aviation = av;
    return out;
  }
}
