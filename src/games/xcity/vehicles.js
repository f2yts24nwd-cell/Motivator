import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { CarModel, trafficGeometry } from '../drive/cars.js';
import { carById } from '../drive/content.js';

// Detailed traffic: the full procedural car models from "Ludlein Drive", baked into one
// geometry per material and drawn instanced (each car type = a handful of draw calls).
// Brand-free: own model names, no lettering, fictional plates.

const SPECS = [
  { from: 'fuenfer', name: 'Kombi GT', body: 'touring' },
  { i5: true },
  { from: 'sklasse', name: 'Executive' },
  { from: 'skoda', name: 'E-Crossover', ev: true },
  { from: 'volvo', name: 'Nordic Kombi' },
  { from: 'passat', name: 'Firmenkombi' },
  { id: 'kompakt', type: 'wagon', style: 'kompakt', dims: { L: 4.2, W: 1.8, H: 1.48, wb: 2.63, wr: 0.33, belt: 0.98, hood: 0.86 } },
  { id: 'suv', type: 'suv', style: 'suvT', dims: { L: 4.6, W: 1.88, H: 1.68, wb: 2.75, wr: 0.37, belt: 1.08, hood: 0.96 } }
];

/** electric business saloon in the style of the current 5-series generation (no logos, no lettering) */
export function i5Def(plate = 'BI-KS 24') {
  return {
    id: 'i5', name: 'Business-Limousine elektrisch', type: 'sedan', style: 'i5', ev: true, plate,
    vmax: 215, t100: 6.0, grip: 0.88,
    dims: { L: 5.06, W: 1.9, H: 1.505, wb: 3.0, wr: 0.37, belt: 0.95, hood: 0.8 },
    def: { color: 'weiss', finish: 'uni', rim: 'aero', rimColor: 'anthrazit', caliper: 'blau', drop: 10, spoiler: 'none', parts: [] }
  };
}

/** car definition without any brand features (used for traffic and the player's cars) */
export function brandFree(id, extra = {}) {
  const base = carById(id);
  // no lettered roof boxes or brand cases
  const def = base.def ? { ...base.def, parts: (base.def.parts || []).filter((p) => p !== 'rack') } : base.def;
  return { ...base, def, hilti: false, cloud: false, plate: extra.plate || 'LB-' + Math.floor(100 + Math.random() * 899), ...extra };
}

function specDef(s) {
  if (s.i5) return i5Def('BI-' + ['AB', 'CD', 'EV', 'KS'][Math.floor(Math.random() * 4)] + ' ' + Math.floor(10 + Math.random() * 989));
  if (s.from) return brandFree(s.from, { name: s.name });
  return { id: s.id, name: s.id, type: s.type, style: s.style, dims: s.dims, plate: 'LB-' + Math.floor(100 + Math.random() * 899), vmax: 180, t100: 9, grip: 0.8, def: { color: 'weiss', finish: 'metallic', rim: 'fuenf', rimColor: 'silber', caliper: 'grau', drop: 0, spoiler: 'none', parts: [] } };
}

/** bake a CarModel into [{ geometry, material, isPaint }] (handles mirrored wheels) */
function bake(model) {
  const root = model.root;
  root.updateMatrixWorld(true);
  const buckets = new Map();
  root.traverse((o) => {
    if (!o.isMesh || !o.visible) return;
    let g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
    for (const k of Object.keys(g.attributes)) if (!['position', 'normal', 'uv'].includes(k)) g.deleteAttribute(k);
    if (!g.attributes.uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2));
    if (!g.attributes.normal) g.computeVertexNormals();
    g.applyMatrix4(o.matrixWorld);
    if (o.matrixWorld.determinant() < 0) { // mirrored: flip triangle winding
      for (const name of ['position', 'normal', 'uv']) {
        const a = g.attributes[name], n = a.itemSize;
        for (let t = 0; t < a.count; t += 3) for (let c = 0; c < n; c++) { const v1 = a.array[(t + 1) * n + c]; a.array[(t + 1) * n + c] = a.array[(t + 2) * n + c]; a.array[(t + 2) * n + c] = v1; }
      }
    }
    if (!buckets.has(o.material)) buckets.set(o.material, []);
    buckets.get(o.material).push(g);
  });
  const out = [];
  for (const [mat, geos] of buckets) out.push({ geometry: mergeGeometries(geos), material: mat, isPaint: mat === model.paint });
  return out;
}

const LOD_KIND = ['limo', 'limo', 'limo', 'suv', 'kompakt', 'kompakt', 'kompakt', 'suv'];

/**
 * All traffic + parked cars. Every frame the visible cars are packed into the instance
 * buffers: close ones use the detailed model, far ones a light model, off-screen ones nothing.
 */
export class Fleet {
  constructor(scene, capacityPerType = 8, { near = 70, far = 260 } = {}) {
    this.near = near; this.far = far;
    this.types = [];
    this.handles = [];
    for (const s of SPECS) {
      const def = specDef(s);
      const model = new CarModel(def, { ...def.def, body: s.body || def.def?.body, color: 'weiss' });
      const parts = bake(model);
      const meshes = parts.map((p) => {
        let mat = p.material;
        if (p.isPaint) { mat = p.material.clone(); mat.color.set(0xffffff); }
        const m = new THREE.InstancedMesh(p.geometry, mat, capacityPerType);
        m.count = 0;
        m.castShadow = !mat.transparent;
        m.receiveShadow = true;
        m.frustumCulled = false;
        if (p.isPaint) m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(capacityPerType * 3).fill(1), 3);
        scene.add(m);
        return { m, paint: p.isPaint };
      });
      this.types.push({ def, meshes, used: 0, cap: capacityPerType, dims: def.dims });
    }
    // light LOD models (one draw call each, vertex coloured body tinted per instance)
    const total = capacityPerType * SPECS.length;
    this.lod = {};
    for (const k of ['limo', 'kompakt', 'suv']) {
      const g = trafficGeometry(k);
      const m = new THREE.InstancedMesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.45, envMapIntensity: 1.2 }), total);
      m.count = 0; m.frustumCulled = false; m.castShadow = false;
      m.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(total * 3).fill(1), 3);
      scene.add(m);
      this.lod[k] = m;
    }
    this.M = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.one = new THREE.Vector3(1, 1, 1);
    this.frustum = new THREE.Frustum(); this.pv = new THREE.Matrix4(); this.sphere = new THREE.Sphere(new THREE.Vector3(), 3.2);
    this.col = new THREE.Color();
  }
  /** reserve one car; returns a handle or null when that type is full */
  alloc(type = Math.floor(Math.random() * this.types.length), color = 0xffffff) {
    let ti = type;
    if (this.types[ti].used >= this.types[ti].cap) { ti = this.types.findIndex((x) => x.used < x.cap); if (ti < 0) return null; }
    const t = this.types[ti];
    t.used++;
    const h = { t, ti, color: new THREE.Color(color), pos: new THREE.Vector3(), heading: 0, roll: 0, len: t.dims.L };
    this.handles.push(h);
    return h;
  }
  set(h, pos, heading, roll = 0) { h.pos.copy(pos); h.heading = heading; h.roll = roll; }
  /** pack the visible cars into the instance buffers (call once per frame) */
  commit(camera) {
    this.pv.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
    this.frustum.setFromProjectionMatrix(this.pv);
    const cx = camera.position.x, cz = camera.position.z;
    for (const t of this.types) t.n = 0;
    for (const k in this.lod) this.lod[k].count = 0;
    for (const h of this.handles) {
      const d = Math.hypot(h.pos.x - cx, h.pos.z - cz);
      if (d > this.far) continue;
      this.sphere.center.set(h.pos.x, 1, h.pos.z);
      // keep close cars even when just off screen (their shadows can still be visible)
      if (d > 25 && !this.frustum.intersectsSphere(this.sphere)) continue;
      this.e.set(0, h.heading, h.roll); this.q.setFromEuler(this.e);
      this.M.compose(h.pos, this.q, this.one);
      if (d < this.near) {
        const i = h.t.n++;
        for (const { m, paint } of h.t.meshes) { m.setMatrixAt(i, this.M); if (paint) m.setColorAt(i, h.color); }
      } else {
        const m = this.lod[LOD_KIND[h.ti]];
        const i = m.count++;
        m.setMatrixAt(i, this.M); m.setColorAt(i, h.color);
      }
    }
    for (const t of this.types) for (const { m, paint } of t.meshes) { m.count = t.n; m.instanceMatrix.needsUpdate = true; if (paint) m.instanceColor.needsUpdate = true; }
    for (const k in this.lod) { this.lod[k].instanceMatrix.needsUpdate = true; this.lod[k].instanceColor.needsUpdate = true; }
  }
  meshes() { return [...this.types.flatMap((t) => t.meshes.map((x) => x.m)), ...Object.values(this.lod)]; }
}

export const PAINTS = [0xf2f2f2, 0x16181c, 0x8e1622, 0x1e4fa0, 0x9aa1a8, 0xd9b23a, 0x2f9a8c, 0xe07aa0, 0x4a3a7c, 0xe6dfcc, 0x23402f, 0xe8641b, 0x5d6268, 0xb9bdc2, 0x0f5560, 0x6b1a24];
