import * as THREE from 'three';
import { canvasTexture, rand } from '../../core/gfx.js';

// Particle + effect toolkit for "Frag den Danny!": fire, smoke, foam, steam, sparks,
// electric arcs, debris, floor decals and shockwaves. Everything is pooled.

const softTex = () => canvasTexture(128, 128, (g, w, h) => {
  const gr = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.35, 'rgba(255,255,255,0.75)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
}, { srgb: false });

const puffTex = () => canvasTexture(128, 128, (g, w, h) => {
  // lumpy cloud for smoke and foam
  for (let i = 0; i < 9; i++) {
    const x = w / 2 + rand(-22, 22), y = h / 2 + rand(-22, 22), r = rand(22, 40);
    const gr = g.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,255,255,0.55)');
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  }
}, { srgb: false });

const flameTex = () => canvasTexture(128, 128, (g, w, h) => {
  // a flame tongue: round base, pointed tip, hot centre
  g.filter = 'blur(5px)';
  for (const [sc, a] of [[1, 0.5], [0.72, 0.75], [0.45, 1]]) {
    g.beginPath();
    g.moveTo(64, 118 - 100 * sc);
    g.bezierCurveTo(64 + 46 * sc, 70, 64 + 40 * sc, 116, 64, 118);
    g.bezierCurveTo(64 - 40 * sc, 116, 64 - 46 * sc, 70, 64, 118 - 100 * sc);
    const gr = g.createRadialGradient(64, 92, 2, 64, 86, 50 * sc + 10);
    gr.addColorStop(0, `rgba(255,255,255,${a})`);
    gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr;
    g.fill();
  }
}, { srgb: false });

const VERT = `
  attribute float size;
  attribute float alpha;
  attribute vec3 tint;
  attribute float rot;
  varying float vAlpha;
  varying vec3 vTint;
  varying float vRot;
  uniform float uScale;
  void main() {
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * mv;
    gl_PointSize = size * uScale / -mv.z;
    vAlpha = alpha; vTint = tint; vRot = rot;
  }`;
const FRAG = `
  uniform sampler2D map;
  varying float vAlpha;
  varying vec3 vTint;
  varying float vRot;
  void main() {
    vec2 p = gl_PointCoord - 0.5;
    float c = cos(vRot), s = sin(vRot);
    p = vec2(c * p.x - s * p.y, s * p.x + c * p.y) + 0.5;
    vec4 t = texture2D(map, p);
    gl_FragColor = vec4(vTint * t.rgb, t.a * vAlpha);
    if (gl_FragColor.a < 0.004) discard;
  }`;

// colour ramps (linear HDR colours, > 1 blooms)
const RAMPS = {
  fire(t, out) {
    // yellow core -> orange -> deep red; modest alpha so additive stacking keeps its structure
    if (t < 0.2) { const k = t / 0.2; out.r = 2.2; out.g = 1.3 - k * 0.4; out.b = 0.28 - k * 0.22; }
    else if (t < 0.55) { const k = (t - 0.2) / 0.35; out.r = 2.2 - k * 0.7; out.g = 0.9 - k * 0.7; out.b = 0.05; }
    else { const k = (t - 0.55) / 0.45; out.r = 1.5 - k * 1.3; out.g = 0.2 - k * 0.18; out.b = 0.03; }
    out.a = (t < 0.08 ? t / 0.08 : 1 - Math.pow((t - 0.08) / 0.92, 1.2)) * 0.38;
  },
  smoke(t, out) { const v = 0.04 + t * 0.08; out.r = v; out.g = v; out.b = v * 1.05; out.a = Math.sin(Math.min(1, t) * Math.PI) * 0.62; },
  steam(t, out) { out.r = 0.9; out.g = 0.93; out.b = 1; out.a = Math.sin(Math.min(1, t) * Math.PI) * 0.45; },
  foam(t, out) { out.r = 1.05; out.g = 1.08; out.b = 1.12; out.a = t < 0.8 ? 0.95 : (1 - t) / 0.2 * 0.95; },
  spark(t, out) { out.r = 5; out.g = 3.2 - t * 2; out.b = 1.2 - t; out.a = 1 - t; },
  zap(t, out) { out.r = 2.2; out.g = 3.6; out.b = 6; out.a = 1 - t; },
  water(t, out) { out.r = 0.55; out.g = 0.85; out.b = 1.4; out.a = (1 - t) * 0.8; },
  sauce(t, out) { out.r = 0.65; out.g = 0.06; out.b = 0.03; out.a = t < 0.85 ? 1 : (1 - t) / 0.15; },
  dust(t, out) { out.r = 0.45; out.g = 0.42; out.b = 0.38; out.a = Math.sin(Math.min(1, t) * Math.PI) * 0.5; },
  ember(t, out) { out.r = 4; out.g = 1.2; out.b = 0.15; out.a = (1 - t) * (0.6 + Math.random() * 0.4); },
  zzz(t, out) { out.r = 1.6; out.g = 1.8; out.b = 2.6; out.a = 1 - t; },
  paper(t, out) { out.r = 1; out.g = 1; out.b = 0.95; out.a = 1 - t * t; }
};
const KIND_IDS = Object.keys(RAMPS);

class ParticleSystem {
  constructor(scene, { max, map, blending = THREE.NormalBlending }) {
    this.max = max;
    this.count = 0;
    const geo = new THREE.BufferGeometry();
    this.pos = new Float32Array(max * 3);
    this.tint = new Float32Array(max * 3);
    this.size = new Float32Array(max);
    this.alpha = new Float32Array(max);
    this.rot = new Float32Array(max);
    geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('tint', new THREE.BufferAttribute(this.tint, 3).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('size', new THREE.BufferAttribute(this.size, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('alpha', new THREE.BufferAttribute(this.alpha, 1).setUsage(THREE.DynamicDrawUsage));
    geo.setAttribute('rot', new THREE.BufferAttribute(this.rot, 1).setUsage(THREE.DynamicDrawUsage));
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.geo = geo;
    this.mat = new THREE.ShaderMaterial({
      uniforms: { map: { value: map }, uScale: { value: 600 } },
      vertexShader: VERT, fragmentShader: FRAG,
      transparent: true, depthWrite: false, blending
    });
    this.points = new THREE.Points(geo, this.mat);
    this.points.frustumCulled = false;
    this.points.renderOrder = blending === THREE.AdditiveBlending ? 3 : 2;
    scene.add(this.points);
    // simulation state
    this.vel = new Float32Array(max * 3);
    this.age = new Float32Array(max);
    this.life = new Float32Array(max);
    this.s0 = new Float32Array(max);
    this.s1 = new Float32Array(max);
    this.grav = new Float32Array(max);
    this.drag = new Float32Array(max);
    this.kind = new Uint8Array(max);
    this.spin = new Float32Array(max);
    this.flags = new Uint8Array(max); // 1 = turbulent rise, 2 = sticks to floor (foam)
    this.onLand = null;
  }

  emit(x, y, z, vx, vy, vz, { life = 1, s0 = 0.3, s1 = 0.6, grav = 0, drag = 0, kind = 'smoke', spin = 0, flags = 0, rot = null } = {}) {
    if (this.count >= this.max) return;
    const i = this.count++;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    this.age[i] = 0; this.life[i] = life; this.s0[i] = s0; this.s1[i] = s1;
    this.grav[i] = grav; this.drag[i] = drag; this.kind[i] = KIND_IDS.indexOf(kind);
    this.spin[i] = spin; this.rot[i] = rot ?? Math.random() * 6.28; this.flags[i] = flags;
  }

  kill(i) {
    const j = --this.count;
    if (i === j) return;
    for (const arr of [this.pos, this.vel, this.tint]) { arr[i * 3] = arr[j * 3]; arr[i * 3 + 1] = arr[j * 3 + 1]; arr[i * 3 + 2] = arr[j * 3 + 2]; }
    for (const arr of [this.age, this.life, this.s0, this.s1, this.grav, this.drag, this.kind, this.spin, this.rot, this.flags, this.size, this.alpha]) arr[i] = arr[j];
  }

  update(dt, time) {
    const c = { r: 0, g: 0, b: 0, a: 0 };
    for (let i = 0; i < this.count; i++) {
      this.age[i] += dt;
      const t = this.age[i] / this.life[i];
      if (t >= 1) { this.kill(i); i--; continue; }
      const i3 = i * 3;
      const d = Math.max(0, 1 - this.drag[i] * dt);
      this.vel[i3] *= d; this.vel[i3 + 1] *= d; this.vel[i3 + 2] *= d;
      this.vel[i3 + 1] -= this.grav[i] * dt;
      if (this.flags[i] & 1) {
        // flame/smoke turbulence: curl-ish wobble
        const px = this.pos[i3], pz = this.pos[i3 + 2];
        this.vel[i3] += Math.sin(time * 7 + pz * 3.1 + i) * dt * 1.6;
        this.vel[i3 + 2] += Math.cos(time * 6 + px * 2.7 + i * 0.7) * dt * 1.6;
      }
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      if (this.pos[i3 + 1] < 0.03 && this.vel[i3 + 1] < 0) {
        if (this.flags[i] & 2) {
          // foam hits the floor: becomes a splat decal
          this.onLand?.(this.pos[i3], this.pos[i3 + 2], this.kind[i]);
          this.kill(i); i--; continue;
        }
        this.pos[i3 + 1] = 0.03;
        this.vel[i3 + 1] *= -0.3;
        this.vel[i3] *= 0.6; this.vel[i3 + 2] *= 0.6;
      }
      this.rot[i] += this.spin[i] * dt;
      RAMPS[KIND_IDS[this.kind[i]]](t, c);
      this.tint[i3] = c.r; this.tint[i3 + 1] = c.g; this.tint[i3 + 2] = c.b;
      this.alpha[i] = Math.max(0, c.a);
      this.size[i] = this.s0[i] + (this.s1[i] - this.s0[i]) * t;
    }
    const g = this.geo;
    g.setDrawRange(0, this.count);
    for (const k of ['position', 'tint', 'size', 'alpha', 'rot']) {
      const a = g.attributes[k];
      a.needsUpdate = true;
      a.clearUpdateRanges?.();
      a.addUpdateRange?.(0, this.count * a.itemSize);
    }
  }

  clear() { this.count = 0; this.geo.setDrawRange(0, 0); }
}

/** Flat decals on the floor that slowly shrink away (foam splats, scorch marks, sauce) */
class Decals {
  constructor(scene, { max, color, opacity = 1, map, size = 1, blending = THREE.NormalBlending, y = 0.012 }) {
    const geo = new THREE.PlaneGeometry(1, 1);
    geo.rotateX(-Math.PI / 2);
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ map, color, transparent: true, opacity, depthWrite: false, blending, polygonOffset: true, polygonOffsetFactor: -2 }), max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.count = 0;
    this.items = [];
    this.max = max;
    this.size = size;
    this.y = y;
    this.m = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.s = new THREE.Vector3();
    this.p = new THREE.Vector3();
    scene.add(this.mesh);
  }
  add(x, z, { size = this.size, life = 6, grow = 0.15 } = {}) {
    if (this.items.length >= this.max) this.items.shift();
    this.items.push({ x, z, size: size * rand(0.7, 1.2), age: 0, life, grow, rot: Math.random() * 6.28 });
  }
  update(dt) {
    const it = this.items;
    for (let i = it.length - 1; i >= 0; i--) {
      it[i].age += dt;
      if (it[i].age > it[i].life) it.splice(i, 1);
    }
    const up = new THREE.Vector3(0, 1, 0);
    for (let i = 0; i < it.length; i++) {
      const d = it[i];
      const t = d.age / d.life;
      const k = (Math.min(1, d.age / 0.15) * (1 + d.grow * t)) * (t > 0.75 ? (1 - t) / 0.25 : 1);
      this.q.setFromAxisAngle(up, d.rot);
      this.s.set(d.size * k, 1, d.size * k);
      this.p.set(d.x, this.y + i * 0.00005, d.z);
      this.m.compose(this.p, this.q, this.s);
      this.mesh.setMatrixAt(i, this.m);
    }
    this.mesh.count = it.length;
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  clear() { this.items.length = 0; this.mesh.count = 0; }
}

/** Physical chunks (SAP stone, noodles, paper) */
class Debris {
  constructor(scene, geo, max) {
    const mat = new THREE.MeshStandardMaterial({ roughness: 0.6, metalness: 0.1 });
    this.mesh = new THREE.InstancedMesh(geo, mat, max);
    this.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    this.mesh.count = 0;
    this.max = max;
    this.items = [];
    this.m = new THREE.Matrix4();
    this.e = new THREE.Euler();
    this.q = new THREE.Quaternion();
    this.c = new THREE.Color();
    scene.add(this.mesh);
  }
  burst(pos, color, n, { speed = 6, up = 5, size = 0.18, life = 2.4 } = {}) {
    for (let k = 0; k < n; k++) {
      if (this.items.length >= this.max) this.items.shift();
      const a = Math.random() * Math.PI * 2, sp = rand(0.3, 1) * speed;
      this.items.push({
        p: pos.clone().add(new THREE.Vector3(rand(-0.2, 0.2), rand(0, 0.4), rand(-0.2, 0.2))),
        v: new THREE.Vector3(Math.cos(a) * sp, rand(0.4, 1) * up, Math.sin(a) * sp),
        r: new THREE.Vector3(rand(0, 6), rand(0, 6), rand(0, 6)),
        w: new THREE.Vector3(rand(-12, 12), rand(-12, 12), rand(-12, 12)),
        s: size * rand(0.5, 1.4), age: 0, life: life * rand(0.8, 1.2),
        col: new THREE.Color(color).offsetHSL(0, 0, rand(-0.08, 0.08))
      });
    }
  }
  update(dt) {
    const it = this.items;
    for (let i = it.length - 1; i >= 0; i--) {
      const d = it[i];
      d.age += dt;
      if (d.age > d.life) { it.splice(i, 1); continue; }
      d.v.y -= 18 * dt;
      d.p.addScaledVector(d.v, dt);
      if (d.p.y < d.s * 0.5) { d.p.y = d.s * 0.5; d.v.y *= -0.35; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.6); }
      d.r.addScaledVector(d.w, dt);
    }
    for (let i = 0; i < it.length; i++) {
      const d = it[i];
      const k = d.age > d.life - 0.4 ? Math.max(0.01, (d.life - d.age) / 0.4) : 1;
      this.q.setFromEuler(this.e.set(d.r.x, d.r.y, d.r.z));
      this.m.compose(d.p, this.q, new THREE.Vector3(d.s * k, d.s * k, d.s * k));
      this.mesh.setMatrixAt(i, this.m);
      this.mesh.setColorAt(i, d.col);
    }
    this.mesh.count = it.length;
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }
  clear() { this.items.length = 0; this.mesh.count = 0; }
}

export class FX {
  constructor(scene) {
    this.scene = scene;
    const soft = softTex(), puff = puffTex();
    this.add = new ParticleSystem(scene, { max: 1600, map: soft, blending: THREE.AdditiveBlending });
    this.flames = new ParticleSystem(scene, { max: 1800, map: flameTex(), blending: THREE.AdditiveBlending });
    this.norm = new ParticleSystem(scene, { max: 2400, map: puff });
    this.foamDecals = new Decals(scene, { max: 220, color: 0xf4f7ff, opacity: 0.85, map: puff, size: 0.9, y: 0.014 });
    this.scorch = new Decals(scene, { max: 60, color: 0x000000, opacity: 0.75, map: soft, size: 2.2, y: 0.011 });
    this.sauce = new Decals(scene, { max: 60, color: 0x8a0d06, opacity: 0.9, map: puff, size: 0.8, y: 0.013 });
    this.norm.onLand = (x, z, kind) => {
      if (KIND_IDS[kind] === 'foam') { if (Math.random() < 0.35) this.foamDecals.add(x, z, { size: rand(0.5, 1.1), life: rand(5, 8), grow: 0.4 }); }
      else if (KIND_IDS[kind] === 'sauce') this.sauce.add(x, z, { size: rand(0.3, 0.7), life: 10 });
    };
    this.stones = new Debris(scene, new THREE.DodecahedronGeometry(1, 0), 160);
    this.noodles = new Debris(scene, new THREE.CylinderGeometry(0.12, 0.12, 2.4, 6), 120);
    this.papers = new Debris(scene, new THREE.BoxGeometry(1, 0.04, 1.3), 80);
    // shockwave rings
    this.rings = [];
    const ringGeo = new THREE.RingGeometry(0.8, 1, 48);
    ringGeo.rotateX(-Math.PI / 2);
    for (let i = 0; i < 6; i++) {
      const m = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false;
      scene.add(m);
      this.rings.push({ m, t: 1, life: 0.5, size: 4 });
    }
    // electric arcs
    this.arcs = [];
    for (let i = 0; i < 8; i++) {
      const geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(14 * 3), 3));
      const line = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: new THREE.Color(3, 5, 9), transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      line.frustumCulled = false;
      line.visible = false;
      scene.add(line);
      this.arcs.push({ line, t: 0, a: new THREE.Vector3(), b: new THREE.Vector3() });
    }
    // a big flash light for explosions / zaps
    this.flash = new THREE.PointLight(0xffffff, 0, 14, 2);
    scene.add(this.flash);
    this.flashT = 0;
  }

  setScale(camera, heightPx) {
    const s = heightPx / (2 * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)));
    this.add.mat.uniforms.uScale.value = s;
    this.flames.mat.uniforms.uScale.value = s;
    this.norm.mat.uniforms.uScale.value = s;
  }

  // ---- emitters
  flame(p, k = 1) {
    const r = 0.25 + k * 0.35;
    const a = Math.random() * 6.28, rr = Math.sqrt(Math.random()) * r;
    this.flames.emit(p.x + Math.cos(a) * rr, p.y + rand(0, 0.15), p.z + Math.sin(a) * rr, rand(-0.2, 0.2), rand(2.0, 3.2) * (0.7 + k * 0.4), rand(-0.2, 0.2),
      { life: rand(0.5, 0.9) * (0.8 + k * 0.3), s0: rand(0.55, 0.95) * (0.7 + k * 0.55), s1: 0.18, kind: 'fire', drag: 0.8, flags: 1, spin: rand(-0.6, 0.6), rot: rand(-0.25, 0.25) });
  }
  smoke(p, k = 1) {
    this.norm.emit(p.x + rand(-0.3, 0.3), p.y + 0.6 + k * 0.6, p.z + rand(-0.3, 0.3), rand(-0.3, 0.3), rand(1.2, 2), rand(-0.3, 0.3),
      { life: rand(1.6, 2.6), s0: 0.6 * k + 0.3, s1: 2.2 * k + 0.8, kind: 'smoke', drag: 0.6, flags: 1, spin: rand(-1, 1) });
  }
  ember(p, k = 1) {
    this.add.emit(p.x + rand(-0.4, 0.4) * k, p.y + 0.3, p.z + rand(-0.4, 0.4) * k, rand(-0.6, 0.6), rand(2, 4), rand(-0.6, 0.6),
      { life: rand(0.8, 1.6), s0: 0.08, s1: 0.03, kind: 'ember', drag: 0.4, flags: 1 });
  }
  foam(p, dir, speed, spread, range = 1) {
    const v = dir.clone();
    v.x += rand(-spread, spread); v.y += rand(-spread * 0.6, spread * 0.8); v.z += rand(-spread, spread);
    v.normalize().multiplyScalar(speed * rand(0.85, 1.15) * range);
    this.norm.emit(p.x, p.y, p.z, v.x, v.y, v.z, { life: rand(0.7, 1.0) * range, s0: 0.18, s1: rand(0.7, 1.1) * Math.sqrt(range), kind: 'foam', grav: 5, drag: 0.9, flags: 2, spin: rand(-4, 4) });
  }
  steam(p, n = 6) {
    for (let i = 0; i < n; i++) this.norm.emit(p.x + rand(-0.4, 0.4), p.y + rand(0.2, 0.8), p.z + rand(-0.4, 0.4), rand(-0.5, 0.5), rand(1.5, 3), rand(-0.5, 0.5),
      { life: rand(0.8, 1.4), s0: 0.5, s1: 2, kind: 'steam', drag: 1, flags: 1, spin: rand(-1, 1) });
  }
  sparks(p, n = 30, kind = 'spark', speed = 7) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, e = rand(-0.2, 1.2), sp = rand(0.3, 1) * speed;
      this.add.emit(p.x, p.y, p.z, Math.cos(a) * Math.cos(e) * sp, Math.sin(e) * sp + 1, Math.sin(a) * Math.cos(e) * sp, { life: rand(0.3, 0.7), s0: rand(0.1, 0.22), s1: 0.02, kind, grav: 12, drag: 1.5 });
    }
  }
  splash(p, n = 16) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = rand(1, 3.5);
      this.norm.emit(p.x, p.y, p.z, Math.cos(a) * sp, rand(1.5, 4), Math.sin(a) * sp, { life: rand(0.4, 0.8), s0: 0.12, s1: 0.3, kind: 'water', grav: 14 });
    }
  }
  sauceBurst(p, n = 20) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = rand(1.5, 6);
      this.norm.emit(p.x, p.y, p.z, Math.cos(a) * sp, rand(2, 6), Math.sin(a) * sp, { life: 1.6, s0: 0.25, s1: 0.18, kind: 'sauce', grav: 16, flags: 2 });
    }
  }
  dust(p, n = 20, r = 1.5) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, sp = rand(2, 5);
      this.norm.emit(p.x + Math.cos(a) * r * 0.3, 0.2, p.z + Math.sin(a) * r * 0.3, Math.cos(a) * sp, rand(0.3, 1.5), Math.sin(a) * sp, { life: rand(0.9, 1.6), s0: 0.6, s1: 2.4, kind: 'dust', drag: 2.2, spin: rand(-1, 1) });
    }
  }
  zzz(p) {
    this.add.emit(p.x, p.y, p.z, rand(-0.2, 0.2), 0.7, rand(-0.2, 0.2), { life: 1.4, s0: 0.15, s1: 0.4, kind: 'zzz', flags: 1 });
  }
  ring(p, color = 0xffffff, size = 4, life = 0.5) {
    const r = this.rings.find((x) => x.t >= 1) || this.rings[0];
    r.m.position.set(p.x, 0.05, p.z);
    r.m.material.color.set(color).multiplyScalar(2.5);
    r.t = 0; r.life = life; r.size = size;
    r.m.visible = true;
  }
  arc(a, b, life = 0.25) {
    const s = this.arcs.find((x) => x.t <= 0) || this.arcs[0];
    s.a.copy(a); s.b.copy(b); s.t = life;
    s.line.visible = true;
  }
  boom(p, color = 0xffaa55, power = 1) {
    this.flash.position.set(p.x, p.y + 1.5, p.z);
    this.flash.color.set(color);
    this.flash.intensity = 60 * power;
    this.flashT = 0.25;
  }

  update(dt, time) {
    this.add.update(dt, time);
    this.flames.update(dt, time);
    this.norm.update(dt, time);
    this.foamDecals.update(dt);
    this.scorch.update(dt);
    this.sauce.update(dt);
    this.stones.update(dt);
    this.noodles.update(dt);
    this.papers.update(dt);
    for (const r of this.rings) {
      if (r.t >= 1) continue;
      r.t += dt / r.life;
      const k = Math.min(1, r.t);
      r.m.scale.setScalar(0.3 + k * r.size);
      r.m.material.opacity = 1 - k;
      if (r.t >= 1) r.m.visible = false;
    }
    for (const s of this.arcs) {
      if (s.t <= 0) continue;
      s.t -= dt;
      const arr = s.line.geometry.attributes.position.array;
      const n = arr.length / 3;
      const len = s.a.distanceTo(s.b);
      for (let i = 0; i < n; i++) {
        const k = i / (n - 1);
        const j = i === 0 || i === n - 1 ? 0 : len * 0.18;
        arr[i * 3] = s.a.x + (s.b.x - s.a.x) * k + rand(-j, j);
        arr[i * 3 + 1] = s.a.y + (s.b.y - s.a.y) * k + rand(-j, j);
        arr[i * 3 + 2] = s.a.z + (s.b.z - s.a.z) * k + rand(-j, j);
      }
      s.line.geometry.attributes.position.needsUpdate = true;
      if (s.t <= 0) s.line.visible = false;
    }
    if (this.flashT > 0) { this.flashT -= dt; this.flash.intensity *= Math.pow(0.0005, dt); if (this.flashT <= 0) this.flash.intensity = 0; }
  }

  clear() {
    this.add.clear(); this.flames.clear(); this.norm.clear();
    this.foamDecals.clear(); this.scorch.clear(); this.sauce.clear();
    this.stones.clear(); this.noodles.clear(); this.papers.clear();
    for (const r of this.rings) { r.t = 1; r.m.visible = false; }
    for (const s of this.arcs) { s.t = 0; s.line.visible = false; }
    this.flash.intensity = 0;
  }
}
