import * as THREE from 'three';
import { trafficGeometry, pedestrianGeometry } from '../drive/cars.js';
import { rand, clamp, canvasTexture } from '../../core/gfx.js';
import { ROADS, RW, LANE, CURB } from './world.js';
import { buildXTile } from './xtile.js';

const N = ROADS.length;
const nodePos = (i, j) => new THREE.Vector3(ROADS[i], 0, ROADS[j]);
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
function neighbors(i, j) {
  const out = [];
  for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const a = i + di, b = j + dj; if (a >= 0 && b >= 0 && a < N && b < N) out.push([a, b]); }
  return out;
}
/** lane start/end points of the road segment between two neighbouring intersections */
export function laneSeg(a, b) {
  const A = nodePos(...a), B = nodePos(...b);
  const f = B.clone().sub(A).normalize();
  const r = new THREE.Vector3(-f.z, 0, f.x);
  const m = RW / 2 + 2.5;
  return { S: A.clone().addScaledVector(f, m).addScaledVector(r, LANE), E: B.clone().addScaledVector(f, -m).addScaledVector(r, LANE), f, r };
}
function bez(p0, p1, p2, t, out) {
  const u = 1 - t;
  return out.set(u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x, 0, u * u * p0.z + 2 * u * t * p1.z + t * t * p2.z);
}

// ------------------------------------------------------------------ ambient traffic (instanced)
const PAINT = [0xf2f2f2, 0x1b1d22, 0xb5182b, 0x2e5fa8, 0x9aa1a8, 0xf0c33c, 0x3fb7a6, 0xff8fb1, 0x6a4c9c, 0xe8e2d0, 0x20412f, 0xff6a2a];

export class Traffic {
  constructor(scene, count = 28) {
    this.kinds = ['kompakt', 'limo', 'suv', 'van'];
    this.meshes = this.kinds.map((k) => {
      const geo = trafficGeometry(k);
      const m = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.3, metalness: 0.45, envMapIntensity: 1.2 }), count);
      m.castShadow = true;
      m.frustumCulled = false;
      m.count = 0;
      m.userData.dims = geo.userData.dims;
      scene.add(m);
      return m;
    });
    this.cars = [];
    const used = new Set();
    for (let k = 0; k < count; k++) {
      let i, j, n;
      do { i = Math.floor(rand(0, N)); j = Math.floor(rand(0, N)); const nb = neighbors(i, j); n = nb[Math.floor(rand(0, nb.length))]; } while (used.has(`${i}${j}${n}`) || (Math.abs(ROADS[i]) < 50 && Math.abs(ROADS[j]) < 50 && k < 4));
      used.add(`${i}${j}${n}`);
      const kind = Math.floor(rand(0, 1) * (Math.random() < 0.15 ? 4 : 3));
      const mesh = this.meshes[kind];
      const car = { kind, idx: mesh.count++, from: [i, j], to: n, next: null, phase: 'seg', d: rand(0, 40), speed: 0, vmax: rand(9, 13), pos: new THREE.Vector3(), heading: 0, stun: 0, r: kind === 3 ? 2.6 : 2.2 };
      mesh.setColorAt(car.idx, new THREE.Color(PAINT[Math.floor(rand(0, PAINT.length))]));
      car.next = this.choose(car.to, car.from);
      this.cars.push(car);
    }
    for (const m of this.meshes) if (m.instanceColor) m.instanceColor.needsUpdate = true;
    this.mtx = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.one = new THREE.Vector3(1, 1, 1);
    this.tmp = new THREE.Vector3();
  }
  choose(at, prev) {
    const nb = neighbors(...at).filter((n) => n[0] !== prev[0] || n[1] !== prev[1]);
    return nb[Math.floor(rand(0, nb.length))];
  }
  /** obstacles: [{pos, r}] other moving things (player, van, cops) */
  update(dt, obstacles) {
    for (const c of this.cars) {
      // look ahead for anything in our lane
      const f = this.tmp.set(Math.sin(c.heading), 0, Math.cos(c.heading));
      let block = Infinity;
      const test = (p, r) => {
        const dx = p.x - c.pos.x, dz = p.z - c.pos.z;
        const ahead = dx * f.x + dz * f.z, lat = Math.abs(dx * f.z - dz * f.x);
        if (ahead > 0 && ahead < 16 && lat < 1.6 + r * 0.6) block = Math.min(block, ahead - r);
      };
      for (const o of obstacles) test(o.pos, o.r);
      for (const o of this.cars) if (o !== c) test(o.pos, 1.5);
      let vt = c.vmax;
      if (c.phase === 'turn') vt = Math.min(vt, 6.5);
      if (block < 12) vt = Math.min(vt, Math.max(0, (block - 4) * 1.4));
      if (c.stun > 0) { c.stun -= dt; vt = 0; }
      c.speed += clamp(vt - c.speed, -12 * dt, 4 * dt);
      this.advance(c, c.speed * dt);
    }
    this.render();
  }
  advance(c, step) {
    const prev = c.pos.clone();
    for (let guard = 0; guard < 3; guard++) {
      if (c.phase === 'seg') {
        const L = laneSeg(c.from, c.to);
        const len = L.S.distanceTo(L.E);
        c.d += step; step = 0;
        if (c.d >= len) { step = c.d - len; c.phase = 'turn'; c.d = 0; continue; }
        c.pos.copy(L.S).addScaledVector(L.f, c.d);
      } else {
        const L1 = laneSeg(c.from, c.to), L2 = laneSeg(c.to, c.next);
        const straight = L1.f.dot(L2.f) > 0.9;
        const P1 = straight ? L1.E.clone().add(L2.S).multiplyScalar(0.5) : nodePos(...c.to).addScaledVector(L1.r, LANE).addScaledVector(L2.r, LANE);
        const len = straight ? L1.E.distanceTo(L2.S) : L1.E.distanceTo(P1) * 1.6;
        c.d += step; step = 0;
        if (c.d >= len) { step = c.d - len; c.phase = 'seg'; c.d = 0; c.from = c.to; c.to = c.next; c.next = this.choose(c.to, c.from); continue; }
        bez(L1.E, P1, L2.S, c.d / len, c.pos);
      }
      break;
    }
    const dx = c.pos.x - prev.x, dz = c.pos.z - prev.z;
    if (dx * dx + dz * dz > 1e-6) {
      const want = Math.atan2(dx, dz);
      c.heading += wrap(want - c.heading) * 0.5;
    }
  }
  render() {
    for (const c of this.cars) {
      this.e.set(0, c.heading, c.shake ? Math.sin(performance.now() * 0.05) * 0.03 : 0);
      this.q.setFromEuler(this.e);
      this.mtx.compose(c.pos, this.q, this.one);
      this.meshes[c.kind].setMatrixAt(c.idx, this.mtx);
    }
    for (const m of this.meshes) m.instanceMatrix.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ pedestrians
const SHIRTS = [0xffffff, 0xff7aa8, 0x3fd0c9, 0xffd34d, 0x7aa8ff, 0xff8a3d, 0x9ef07a, 0xd18cff, 0x222222, 0xe6e0d0];
export class Pedestrians {
  constructor(scene, loops, count = 80) {
    const geo = pedestrianGeometry();
    this.mesh = new THREE.InstancedMesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7 }), count);
    this.mesh.castShadow = true;
    this.mesh.frustumCulled = false;
    scene.add(this.mesh);
    this.peds = [];
    for (let k = 0; k < count; k++) {
      const p = { pos: new THREE.Vector3(), heading: 0, dodge: 0, dodgeV: 0, fall: 0, spin: 0, vy: 0, y: 0, hey: 0, phase: rand(0, 6) };
      if (k < 10) { // tourists around the X-Platz
        const a = rand(0, Math.PI * 2), r = rand(8, 13);
        Object.assign(p, { idle: true, home: new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r) });
        p.pos.copy(p.home);
        p.heading = Math.atan2(-p.home.x, -p.home.z);
      } else if (k < 22) { // beach
        Object.assign(p, { idle: true, home: new THREE.Vector3(rand(216, 238), 0, rand(-220, 220)) });
        p.gy = -(p.home.x - 213) * 0.012 - CURB;
        p.pos.copy(p.home);
        p.heading = Math.PI / 2 + rand(-0.6, 0.6);
      } else {
        const L = loops[Math.floor(rand(0, loops.length))];
        Object.assign(p, { loop: L, per: 2 * (L.x1 - L.x0 + L.z1 - L.z0), s: 0, dir: Math.random() < 0.5 ? 1 : -1, v: rand(1.1, 1.7) });
        p.s = rand(0, p.per);
      }
      this.mesh.setColorAt(k, new THREE.Color(SHIRTS[k % SHIRTS.length]));
      this.peds.push(p);
    }
    this.mesh.instanceColor.needsUpdate = true;
    this.mtx = new THREE.Matrix4(); this.q = new THREE.Quaternion(); this.e = new THREE.Euler(); this.sc = new THREE.Vector3(1, 1, 1);
  }
  loopPos(p, s, out) {
    const L = p.loop, w = L.x1 - L.x0, d = L.z1 - L.z0;
    s = ((s % p.per) + p.per) % p.per;
    let inward;
    if (s < w) { out.set(L.x0 + s, 0, L.z0); inward = [0, 1]; }
    else if (s < w + d) { out.set(L.x1, 0, L.z0 + s - w); inward = [-1, 0]; }
    else if (s < 2 * w + d) { out.set(L.x1 - (s - w - d), 0, L.z1); inward = [0, -1]; }
    else { out.set(L.x0, 0, L.z1 - (s - 2 * w - d)); inward = [1, 0]; }
    return inward;
  }
  /** danger: [{pos, vel(Vector3), r}] fast things; returns list of peds that were hit this frame */
  update(dt, t, danger, onHit) {
    const tmp = new THREE.Vector3();
    this.peds.forEach((p, k) => {
      let base = p.home;
      let inward = [0, 0];
      if (p.loop) {
        if (p.fall <= 0) p.s += p.v * p.dir * dt * (p.dodge > 0.5 ? 0.3 : 1);
        inward = this.loopPos(p, p.s, tmp);
        base = tmp;
        p.heading = Math.atan2(...(p.dir > 0 ? this.dirAt(p) : this.dirAt(p).map((v) => -v)));
      }
      // dodge: jump away from fast cars heading our way
      let want = 0;
      for (const d of danger) {
        const dx = p.pos.x - d.pos.x, dz = p.pos.z - d.pos.z, dist = Math.hypot(dx, dz);
        const sp = d.vel.length();
        if (dist < 9 && sp > 3 && (d.vel.x * dx + d.vel.z * dz) > 0) want = 2.2;
        if (dist < d.r + 0.4 && sp > 4.5 && p.fall <= 0) { // knocked over (comic, gets up again)
          p.fall = 2.4; p.vy = 3 + sp * 0.18; p.spin = 0; p.pushX = (dx / (dist || 1)) * sp * 0.4; p.pushZ = (dz / (dist || 1)) * sp * 0.4;
          onHit?.(p);
        } else if (dist < d.r + 0.3) { p.pos.x += (dx / (dist || 1)) * 0.4; p.pos.z += (dz / (dist || 1)) * 0.4; }
      }
      p.dodge += (want - p.dodge) * Math.min(1, dt * (want > p.dodge ? 9 : 1.2));
      if (want > 0 && p.hey <= 0) { p.hey = 4; p.justDodged = true; } else p.justDodged = false;
      p.hey -= dt;
      if (p.fall > 0) {
        p.fall -= dt;
        p.vy -= 18 * dt; p.y = Math.max(0, p.y + p.vy * dt);
        p.pos.x += (p.pushX || 0) * dt; p.pos.z += (p.pushZ || 0) * dt;
        p.pushX *= 0.95; p.pushZ *= 0.95;
        p.spin = Math.min(Math.PI / 2, p.spin + dt * 7);
        if (p.fall <= 0) { p.y = 0; if (p.loop) p.offset = 0; }
      } else {
        p.spin = Math.max(0, p.spin - dt * 3);
        const tx = base.x + inward[0] * p.dodge, tz = base.z + inward[1] * p.dodge;
        p.pos.x += (tx - p.pos.x) * Math.min(1, dt * 6);
        p.pos.z += (tz - p.pos.z) * Math.min(1, dt * 6);
      }
      const walk = p.loop && p.fall <= 0 ? Math.abs(Math.sin(t * 7 * p.v + p.phase)) * 0.05 : 0;
      this.e.set(-p.spin, p.heading, 0, 'YXZ');
      this.q.setFromEuler(this.e);
      this.mtx.compose(new THREE.Vector3(p.pos.x, CURB + (p.gy || 0) + p.y + walk, p.pos.z), this.q, this.sc);
      this.mesh.setMatrixAt(k, this.mtx);
    });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  dirAt(p) {
    const L = p.loop, w = L.x1 - L.x0, d = L.z1 - L.z0;
    const s = ((p.s % p.per) + p.per) % p.per;
    if (s < w) return [1, 0];
    if (s < w + d) return [0, 1];
    if (s < 2 * w + d) return [-1, 0];
    return [0, -1];
  }
}

// ------------------------------------------------------------------ AI cars (van + security)
function carMesh(kind, color) {
  const geo = trafficGeometry(kind);
  const m = new THREE.Mesh(geo, new THREE.MeshPhysicalMaterial({ vertexColors: true, color, roughness: 0.28, metalness: 0.5, clearcoat: 0.8 }));
  m.castShadow = true;
  return m;
}

export class AICar {
  constructor(scene, kind, color) {
    this.root = new THREE.Group();
    this.mesh = carMesh(kind, color);
    this.root.add(this.mesh);
    scene.add(this.root);
    this.pos = this.root.position;
    this.heading = 0;
    this.speed = 0;
    this.vmax = 18;
    this.r = kind === 'van' ? 2.7 : 2.4;
    this.vel = new THREE.Vector3();
    this.wp = [];
    this.spin = 0;
    this.lean = 0;
  }
  get forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }
  /** steer toward target point, car-like */
  drive(dt, target, vt) {
    const dx = target.x - this.pos.x, dz = target.z - this.pos.z;
    const want = Math.atan2(dx, dz);
    const diff = wrap(want - this.heading);
    const rate = 0.4 + 1.6 * Math.min(1, Math.abs(this.speed) / 8);
    const turn = clamp(diff, -rate * dt, rate * dt);
    this.heading += turn;
    const corner = 1 - Math.min(0.65, Math.abs(diff) / 1.4);
    const v = vt * corner;
    this.speed += clamp(v - this.speed, -14 * dt, 5.5 * dt);
    this.lean += (clamp(turn / Math.max(dt, 1e-3) * this.speed * 0.012, -0.08, 0.08) - this.lean) * Math.min(1, dt * 6);
    this.integrate(dt);
  }
  integrate(dt) {
    const f = this.forward;
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.addScaledVector(f, this.speed * dt);
    if (this.push) { this.pos.x += this.push.x * dt; this.pos.z += this.push.z * dt; this.push.multiplyScalar(Math.exp(-dt * 4)); }
    this.vel.set((this.pos.x - ox) / Math.max(dt, 1e-4), 0, (this.pos.z - oz) / Math.max(dt, 1e-4));
    this.root.rotation.set(0, this.heading, 0);
    this.mesh.rotation.z = -this.lean;
  }
  shove(dx, dz) { if (!this.push) this.push = new THREE.Vector3(); this.push.x += dx; this.push.z += dz; }
}

/** Cloudius' van: follows a fixed loop through the city, with the X strapped to the roof */
export class Van extends AICar {
  constructor(scene, route) {
    super(scene, 'van', 0xffffff);
    // cloud on the roof + the stolen X
    const cm = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0x9aa3ff, emissiveIntensity: 0.4, roughness: 0.9 });
    for (const [x, y, z, r] of [[0, 2.65, 0.6, 0.55], [0.45, 2.55, 0.9, 0.4], [-0.45, 2.55, 0.9, 0.4], [0, 2.55, 0.1, 0.42]]) { const b = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 8), cm); b.position.set(x, y, z); this.root.add(b); }
    // side lettering
    const tex = canvasTexture(512, 128, (g, w, h) => { g.fillStyle = '#4b54b8'; g.font = 'italic 900 64px "Segoe UI", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('☁ SILO-LOGISTIK', w / 2, h / 2); });
    const sm = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 0.85), sm); p.position.set(s * 1.03, 1.35, -0.6); p.rotation.y = s * Math.PI / 2; this.root.add(p); }
    this.x = buildXTile(1.25, { glow: 0.9 });
    this.x.position.set(0, 2.95, -1.5);
    this.root.add(this.x);
    this.route = route; // list of waypoint Vector3
    this.wi = 0;
    this.hp = 100;
    this.vmax = 19;
    this.state = 'parked';
    this.smoke = 0;
  }
  update(dt, t, playerPos) {
    this.x.rotation.y = Math.sin(t * 2) * 0.15;
    if (this.state === 'parked') { this.speed = 0; this.integrate(dt); return; }
    if (this.state === 'wrecked') {
      this.speed *= Math.exp(-dt * 1.8);
      this.heading += this.spin * dt;
      this.spin *= Math.exp(-dt * 2.2);
      this.integrate(dt);
      return;
    }
    let tgt = this.route[this.wi];
    while (this.pos.distanceTo(tgt) < 7) { this.wi = (this.wi + 1) % this.route.length; tgt = this.route[this.wi]; }
    // rubber band: keep the chase exciting
    const dist = this.pos.distanceTo(playerPos);
    let vt = this.vmax;
    if (dist < 18) vt += 5;
    if (dist > 90) vt -= 5;
    if (dist > 150) vt -= 4;
    if (this.wobble > 0) { this.wobble -= dt; vt *= 0.7; }
    this.drive(dt, tgt, vt);
  }
  wreck() { this.state = 'wrecked'; this.spin = (Math.random() < 0.5 ? -1 : 1) * 2.4; }
}

/** Silo-Security SUV: chases the player over the road grid, light bar flashing */
export class Cop extends AICar {
  constructor(scene) {
    super(scene, 'suv', 0x15171c);
    const red = new THREE.MeshBasicMaterial({ color: new THREE.Color(5, 0.3, 0.3), toneMapped: false });
    const blue = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 0.6, 6), toneMapped: false });
    this.bar = [new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.3), red), new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.16, 0.3), blue)];
    this.bar[0].position.set(-0.35, 1.78, -0.3); this.bar[1].position.set(0.35, 1.78, -0.3);
    this.root.add(...this.bar);
    const tex = canvasTexture(512, 128, (g, w, h) => { g.fillStyle = '#ffffff'; g.font = '900 70px "Segoe UI", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('SILO-SECURITY', w / 2, h / 2); });
    const sm = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    for (const s of [1, -1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 0.65), sm); p.position.set(s * 0.95, 0.95, 0); p.rotation.y = s * Math.PI / 2; this.root.add(p); }
    this.vmax = rand(23, 27);
    this.node = null;
    this.target = new THREE.Vector3();
    this.stuck = 0;
    this.reverse = 0;
    this.hitCool = 0;
  }
  nearestNode(p) {
    let best = null, bd = Infinity;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const d = Math.hypot(ROADS[i] - p.x, ROADS[j] - p.z); if (d < bd) { bd = d; best = [i, j]; } }
    return best;
  }
  update(dt, t, player, playerVel, world) {
    this.bar[0].visible = Math.sin(t * 16) > 0;
    this.bar[1].visible = !this.bar[0].visible;
    this.hitCool -= dt;
    if (this.reverse > 0) {
      this.reverse -= dt;
      this.speed += clamp(-6 - this.speed, -14 * dt, 10 * dt);
      this.heading += 1.2 * dt;
      this.integrate(dt);
      world.collide(this.pos, this.r);
      return;
    }
    const d = this.pos.distanceTo(player);
    if (d < 45) {
      // ram: aim at where the player will be
      this.target.copy(player).addScaledVector(playerVel, clamp(d / 30, 0, 0.8));
    } else {
      // navigate the grid: head for the neighbouring intersection that gets closest to the player
      if (!this.node || Math.hypot(ROADS[this.node[0]] - this.pos.x, ROADS[this.node[1]] - this.pos.z) < 9) {
        const here = this.node || this.nearestNode(this.pos);
        const opts = this.node ? neighbors(...here) : [here];
        opts.sort((a, b) => Math.hypot(ROADS[a[0]] - player.x, ROADS[a[1]] - player.z) - Math.hypot(ROADS[b[0]] - player.x, ROADS[b[1]] - player.z));
        this.prevNode = here;
        this.node = opts[0];
      }
      this.target.set(ROADS[this.node[0]], 0, ROADS[this.node[1]]);
    }
    this.drive(dt, this.target, this.vmax);
    const hit = world.collide(this.pos, this.r);
    if (hit) this.speed *= 0.9;
    if (Math.abs(this.speed) < 1.5) this.stuck += dt; else this.stuck = 0;
    if (this.stuck > 1.4) { this.stuck = 0; this.reverse = 1.1; this.node = null; }
  }
}

/** route of the van through the city (lane points), as a closed loop */
export function vanRoute() {
  const L = [[3, 2], [4, 2], [4, 1], [5, 1], [5, 2], [5, 3], [5, 4], [5, 5], [4, 5], [3, 5], [3, 4], [2, 4], [1, 4], [1, 3], [0, 3], [0, 2], [0, 1], [1, 1], [1, 0], [2, 0], [3, 0], [3, 1]];
  const pts = [];
  for (let k = 0; k < L.length; k++) {
    const seg = laneSeg(L[k], L[(k + 1) % L.length]);
    pts.push(seg.S, seg.E);
  }
  return pts;
}
