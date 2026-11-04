import * as THREE from 'three';
import { trafficGeometry, pedestrianGeometry, CarModel } from './cars.js';
import { GRID, RW, CURB, blockRect, RACE } from './world.js';
import { CARS } from './content.js';

// City traffic on the road grid (right-hand traffic, obeys the traffic lights), autobahn traffic in
// three lanes per direction, pedestrians on the sidewalks (they jump aside, nobody gets hurt) and
// Cloudius, the rival, who drives the race route.

const HALF = RW / 2;
const LANE = 3;
const PAINT = ['#e9ecef', '#1c1f24', '#8a9099', '#b31b1b', '#1d4fa8', '#2f6b3a', '#c9c3b5', '#5a6b7c', '#f2f2f2', '#0f2f5a', '#7a1f2b', '#d9d4c7'];
const SHIRTS = ['#e63946', '#457b9d', '#f1faee', '#2a9d8f', '#e9c46a', '#264653', '#f4a261', '#8d99ae', '#50af30', '#ffffff', '#6d597a', '#b5838d'];
const rnd = Math.random;
const pick = (a) => a[Math.floor(rnd() * a.length)];

function bezier(a, c, b, n, out) {
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
}

export class Traffic {
  constructor(world, scene) {
    this.world = world;
    this.scene = scene;
    this.cars = [];
    this.ab = [];
    this.peds = [];
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.v = new THREE.Vector3();
    this.one = new THREE.Vector3(1, 1, 1);
    this.yAxis = new THREE.Vector3(0, 1, 0);
    this.buildMeshes();
    this.spawnCity(24);
    this.spawnAutobahn(16);
    this.spawnParked();
    this.spawnPeds(90);
    this.buildRival();
  }

  buildMeshes() {
    const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.32, metalness: 0.45 });
    this.kinds = {};
    for (const k of ['kompakt', 'limo', 'suv', 'van']) {
      const geo = trafficGeometry(k);
      const im = new THREE.InstancedMesh(geo, mat, 40);
      im.count = 0;
      im.castShadow = true;
      im.frustumCulled = false;
      im.setColorAt(0, new THREE.Color());
      this.scene.add(im);
      this.kinds[k] = { im, dims: geo.userData.dims, n: 0 };
    }
    const pm = new THREE.InstancedMesh(pedestrianGeometry(), new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.8 }), 160);
    pm.count = 0;
    pm.castShadow = true;
    pm.frustumCulled = false;
    pm.setColorAt(0, new THREE.Color());
    this.scene.add(pm);
    this.pedMesh = pm;
    // speech bubbles (a small pool of sprites)
    this.bubbles = [];
    for (let i = 0; i < 4; i++) {
      const c = document.createElement('canvas');
      c.width = 256; c.height = 96;
      const t = new THREE.CanvasTexture(c);
      t.colorSpace = THREE.SRGBColorSpace;
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, depthTest: false, transparent: true }));
      s.scale.set(2.6, 0.98, 1);
      s.visible = false;
      s.renderOrder = 10;
      this.scene.add(s);
      this.bubbles.push({ s, c, t, life: 0 });
    }
  }
  slot(kind) {
    const K = this.kinds[kind];
    const i = K.n++;
    K.im.count = K.n;
    return i;
  }
  bubble(x, y, z, text) {
    const b = this.bubbles.find((q) => q.life <= 0) || this.bubbles[0];
    const g = b.c.getContext('2d');
    g.clearRect(0, 0, 256, 96);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.roundRect(4, 4, 248, 66, 22); g.fill();
    g.beginPath(); g.moveTo(110, 68); g.lineTo(128, 92); g.lineTo(140, 68); g.fill();
    g.fillStyle = '#111'; g.font = '800 34px system-ui, Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(text, 128, 38);
    b.t.needsUpdate = true;
    b.s.position.set(x, y, z);
    b.s.visible = true;
    b.life = 1.6;
  }

  // ---------------------------------------------------------------- city traffic
  neighbors(i, j) {
    const out = [];
    if (i > 0) out.push([i - 1, j]);
    if (i < 5) out.push([i + 1, j]);
    if (j > 0) out.push([i, j - 1]);
    if (j < 5) out.push([i, j + 1]);
    return out;
  }
  spawnCity(n) {
    for (let k = 0; k < n; k++) {
      const kind = pick(['kompakt', 'kompakt', 'limo', 'limo', 'suv', 'suv', 'van']);
      const i = Math.floor(rnd() * 6), j = Math.floor(rnd() * 6);
      const nb = pick(this.neighbors(i, j));
      const car = { kind, idx: this.slot(kind), from: [i, j], to: nb, pts: [], seg: 0, u: 0, speed: 8, x: 0, z: 0, h: 0, color: new THREE.Color(pick(PAINT)), stop: -1, honk: 0 };
      this.kinds[kind].im.setColorAt(car.idx, car.color);
      this.planLeg(car, true);
      car.seg = Math.floor(rnd() * 2);
      this.cars.push(car);
    }
  }
  laneLine(a, b) {
    const ax = GRID[a[0]], az = GRID[a[1]], bx = GRID[b[0]], bz = GRID[b[1]];
    const dx = Math.sign(bx - ax), dz = Math.sign(bz - az);
    const rx = -dz, rz = dx; // right-hand side
    return {
      s: [ax + dx * (HALF + 1) + rx * LANE, az + dz * (HALF + 1) + rz * LANE],
      e: [bx - dx * (HALF + 1) + rx * LANE, bz - dz * (HALF + 1) + rz * LANE],
      dx, dz, rx, rz, node: [bx, bz]
    };
  }
  planLeg(car, first = false) {
    // append: lane from `from` to `to`, then the turn into the next street
    const L = this.laneLine(car.from, car.to);
    if (first) car.pts.push(L.s);
    car.pts.push(L.e);
    car.stop = car.pts.length - 1; // index of the stop line point
    car.stopNode = L.node;
    car.stopDir = [L.dx, L.dz];
    const opts = this.neighbors(...car.to).filter(([a, b]) => !(a === car.from[0] && b === car.from[1]));
    // prefer going straight a bit more often
    let next = pick(opts);
    const straight = opts.find(([a, b]) => Math.sign(a - car.to[0]) === L.dx && Math.sign(b - car.to[1]) === L.dz);
    if (straight && rnd() < 0.45) next = straight;
    const N = this.laneLine(car.to, next);
    const ctrl = (N.dx === L.dx && N.dz === L.dz) ? [(L.e[0] + N.s[0]) / 2, (L.e[1] + N.s[1]) / 2] : [L.node[0] + L.rx * LANE + N.rx * LANE, L.node[1] + L.rz * LANE + N.rz * LANE];
    bezier(L.e, ctrl, N.s, 6, car.pts);
    car.turnEnd = car.pts.length - 1;
    car.from = car.to;
    car.to = next;
    car.zone30 = this.world.limitAt((L.s[0] + L.e[0]) / 2, (L.s[1] + L.e[1]) / 2).limit <= 30;
  }

  // ---------------------------------------------------------------- autobahn traffic
  spawnAutobahn(n) {
    const len = this.world.abLen;
    for (let k = 0; k < n; k++) {
      const kind = pick(['kompakt', 'limo', 'limo', 'suv', 'suv', 'van']);
      const dir = k % 2 ? 1 : -1;
      const lane = kind === 'van' ? 0 : Math.floor(rnd() * 3);
      const car = { kind, idx: this.slot(kind), dir, lane, s: 60 + rnd() * (len - 120), speed: 0, color: new THREE.Color(pick(PAINT)) };
      car.base = [30, 36, 44][lane] * (kind === 'van' ? 0.85 : 1) + rnd() * 4;
      car.speed = car.base;
      this.kinds[kind].im.setColorAt(car.idx, car.color);
      this.ab.push(car);
    }
    // the legendary red Hilti-Passat in the left lane
    const hilti = new CarModel(CARS.find((c) => c.id === 'passat'), {});
    hilti.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(hilti.root);
    this.hilti = { model: hilti, dir: 1, lane: 2, s: len * 0.4, speed: 55, base: 57, hilti: true };
    this.ab.push(this.hilti);
  }
  abLaneOffset(dir, lane) {
    const o = [9.85, 6.35, 2.85][lane];
    return dir > 0 ? -o : o;
  }

  spawnParked() {
    const spots = [[-30, 30, 0], [-24, 30, 0], [-18, 30, 0], [-6, 30, 0], [-150, 200, 0], [-144, 200, 0], [-90, 200, 0], [-84, 200, 0],
      [196, -270, 0], [207, -270, 0], [229, -246, 0], [262, -222, 0], [278, -270, 0], [218, -198, 0], [1460, -120, Math.PI / 2], [1460, 10, Math.PI / 2], [1500, -135, 0]];
    for (const [x, z, r] of spots) {
      const kind = pick(['kompakt', 'limo', 'suv']);
      const idx = this.slot(kind);
      const y = this.world.groundAt(x, z);
      this.q.setFromAxisAngle(this.yAxis, r + (rnd() < 0.5 ? Math.PI : 0));
      this.m4.compose(this.v.set(x, y, z), this.q, this.one);
      this.kinds[kind].im.setMatrixAt(idx, this.m4);
      this.kinds[kind].im.setColorAt(idx, new THREE.Color(pick(PAINT)));
      this.world.colliders.push({ t: 'box', x0: x - 1, z0: z - 2.3, x1: x + 1, z1: z + 2.3 });
    }
    this.world.buildIndex();
  }

  // ---------------------------------------------------------------- pedestrians
  spawnPeds(n) {
    const blocks = [];
    for (let j = 0; j < 5; j++) for (let i = 0; i < 5; i++) blocks.push(blockRect(i, j));
    for (let k = 0; k < n; k++) {
      const b = pick(blocks);
      const r = { x0: b.x0 + 1.4, x1: b.x1 - 1.4, z0: b.z0 + 1.4, z1: b.z1 - 1.4 };
      const per = 2 * (r.x1 - r.x0 + r.z1 - r.z0);
      const p = { r, per, s: rnd() * per, dir: rnd() < 0.5 ? 1 : -1, speed: 1.1 + rnd() * 0.6, dodge: 0, dodgeT: 0, phase: rnd() * 6, idx: k, x: 0, z: 0, h: 0, cool: 0 };
      this.pedMesh.setColorAt(k, new THREE.Color(pick(SHIRTS)));
      this.peds.push(p);
    }
    // a crowd at the Messe exit
    for (let k = 0; k < 16; k++) {
      const p = { crowd: true, x: 70 + rnd() * 100, z: -190 + rnd() * 6, h: rnd() * 6, phase: rnd() * 6, idx: this.peds.length, speed: 0, dodge: 0, dodgeT: 0, cool: 0, bx: 0, bz: 0 };
      p.bx = p.x; p.bz = p.z;
      this.pedMesh.setColorAt(p.idx, new THREE.Color(pick(SHIRTS)));
      this.peds.push(p);
    }
    this.pedMesh.count = this.peds.length;
  }
  pedPos(p) {
    const { r } = p;
    const w = r.x1 - r.x0, d = r.z1 - r.z0;
    let s = ((p.s % p.per) + p.per) % p.per;
    // perimeter: north edge (w), east (d), south (w), west (d); inward normal for dodging
    if (s < w) return [r.x0 + s, r.z0, 0, 1, Math.PI / 2];
    s -= w;
    if (s < d) return [r.x1, r.z0 + s, -1, 0, 0];
    s -= d;
    if (s < w) return [r.x1 - s, r.z1, 0, -1, -Math.PI / 2];
    s -= w;
    return [r.x0, r.z1 - s, 1, 0, Math.PI];
  }

  // ---------------------------------------------------------------- Cloudius
  buildRival() {
    const spec = {
      id: 'cloudius', name: 'Cloudius', type: 'suv', style: 'suvT', plate: 'CLOUD 1', accent: 0x9a7bff, cloud: true,
      dims: { L: 4.9, W: 1.95, H: 1.7, wb: 2.95, wr: 0.39, belt: 1.1, hood: 0.98 },
      def: { color: 'violett', finish: 'chamaeleon', rim: 'turbine', rimColor: 'schwarz', caliper: 'blau', drop: 0, spoiler: 'none', parts: [] }
    };
    this.rival = new CarModel(spec, {});
    this.rival.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.rival.root.visible = false;
    this.scene.add(this.rival.root);
    this.R = { x: 0, z: 0, h: 0, speed: 0, seg: 0, active: false, done: false, lag: 0 };
  }
  rivalReset() {
    const [ax, az] = RACE.path[0];
    Object.assign(this.R, { x: ax, z: az, h: 0, speed: 0, seg: 0, active: false, done: false, lag: 1.1, dist: 0 });
    this.rival.root.visible = true;
    this.rival.root.position.set(ax, 0, az);
    this.rival.root.rotation.y = 0;
  }
  rivalHide() { this.rival.root.visible = false; this.R.active = false; }
  rivalStart() { this.R.active = true; }
  updateRival(dt) {
    const R = this.R;
    if (!this.rival.root.visible) return;
    if (R.active && !R.done) {
      if (R.lag > 0) { R.lag -= dt; }
      else {
        const P = RACE.path;
        const [tx, tz] = P[R.seg + 1];
        const dx = tx - R.x, dz = tz - R.z;
        const d = Math.hypot(dx, dz);
        // corner ahead? slow down; school zone 30, elsewhere 50 (he stays a hair below)
        const lim = this.world.limitAt(R.x, R.z).limit;
        let target = (lim / 3.6) * 0.93;
        const nextTurn = R.seg + 2 < P.length;
        if (nextTurn && d < 22) target = Math.min(target, 6.2 + d * 0.32);
        const acc = target > R.speed ? 2.6 : -5;
        R.speed = target > R.speed ? Math.min(target, R.speed + acc * dt) : Math.max(target, R.speed + acc * dt);
        const step = R.speed * dt;
        if (d <= step || d < 0.5) {
          R.x = tx; R.z = tz; R.seg++;
          if (R.seg >= P.length - 1) { R.done = true; R.speed = 0; }
        } else {
          R.x += (dx / d) * step; R.z += (dz / d) * step;
          const want = Math.atan2(dx, dz);
          let dh = want - R.h;
          while (dh > Math.PI) dh -= Math.PI * 2;
          while (dh < -Math.PI) dh += Math.PI * 2;
          R.h += dh * Math.min(1, dt * 5);
        }
        R.dist += step;
      }
    }
    const y = this.world.groundAt(R.x, R.z);
    this.rival.root.position.set(R.x, y, R.z);
    this.rival.root.rotation.y = R.h;
    this.rival.animate(dt, R.speed, 0, 0, 0);
  }

  // ---------------------------------------------------------------- update
  obstacleAhead(x, z, hx, hz, others, self, range = 20) {
    // nearest obstacle in the driving direction within a narrow corridor
    let best = range;
    for (const o of others) {
      if (o === self) continue;
      const dx = o.x - x, dz = o.z - z;
      const along = dx * hx + dz * hz;
      if (along <= 0 || along > best) continue;
      const lat = Math.abs(-dx * hz + dz * hx);
      if (lat < 2.1) best = along;
    }
    return best;
  }

  update(dt, player) {
    const W = this.world;
    const obstacles = [];
    for (const c of this.cars) obstacles.push(c);
    if (player) obstacles.push({ x: player.pos.x, z: player.pos.z });
    if (this.rival.root.visible) obstacles.push({ x: this.R.x, z: this.R.z });
    // city cars
    for (const c of this.cars) {
      if (c.pts.length - c.seg < 10) this.planLeg(c);
      // trim consumed points
      if (c.seg > 20) { c.pts.splice(0, 16); c.seg -= 16; c.stop -= 16; c.turnEnd -= 16; }
      const a = c.pts[c.seg], b = c.pts[c.seg + 1];
      const sx = b[0] - a[0], sz = b[1] - a[1];
      const sl = Math.hypot(sx, sz) || 0.001;
      const hx = sx / sl, hz = sz / sl;
      let target = c.zone30 ? 7.5 : 12;
      if (c.seg >= c.stop && c.seg < c.turnEnd) target = 6;
      // red light ahead?
      if (c.seg < c.stop) {
        const st = c.pts[c.stop];
        const dStop = Math.hypot(st[0] - c.x, st[1] - c.z);
        const state = W.lightFor(c.stopNode[0], c.stopNode[1], c.stopDir[0], c.stopDir[1]);
        if (state && state !== 'g' && dStop < 40) target = Math.min(target, Math.max(0, (dStop - 1.5) * 0.9));
      }
      const ahead = this.obstacleAhead(c.x, c.z, hx, hz, obstacles, c, 22);
      if (ahead < 22) target = Math.min(target, Math.max(0, (ahead - 6.5) * 1.1));
      if (player && ahead < 8 && Math.hypot(player.pos.x - c.x, player.pos.z - c.z) < 9 && c.honk <= 0 && player.speed > 1) {
        c.honk = 6;
        this.onHonk?.(c);
      }
      c.honk -= dt;
      c.speed += Math.max(-9 * dt, Math.min(3 * dt, target - c.speed));
      let move = c.speed * dt;
      // advance along the polyline
      while (move > 0) {
        const p = c.pts[c.seg], q = c.pts[c.seg + 1];
        const l = Math.hypot(q[0] - p[0], q[1] - p[1]);
        if (c.u + move < l) { c.u += move; move = 0; }
        else { move -= l - c.u; c.u = 0; c.seg++; if (c.seg >= c.pts.length - 1) this.planLeg(c); }
      }
      const p = c.pts[c.seg], q = c.pts[c.seg + 1];
      const l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1;
      c.x = p[0] + (q[0] - p[0]) * (c.u / l);
      c.z = p[1] + (q[1] - p[1]) * (c.u / l);
      const want = Math.atan2(q[0] - p[0], q[1] - p[1]);
      let dh = want - c.h;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      c.h += dh * Math.min(1, dt * 8);
      this.q.setFromAxisAngle(this.yAxis, c.h);
      this.m4.compose(this.v.set(c.x, 0, c.z), this.q, this.one);
      this.kinds[c.kind].im.setMatrixAt(c.idx, this.m4);
    }
    // autobahn cars
    const len = W.abLen;
    for (const c of this.ab) {
      let target = c.base;
      // keep distance to the car ahead in the same lane (and to the player)
      let gap = 60;
      for (const o of this.ab) {
        if (o === c || o.dir !== c.dir || o.lane !== c.lane) continue;
        const d = (o.s - c.s) * c.dir;
        if (d > 0 && d < gap) gap = d;
      }
      if (player && player.ab && Math.abs(player.ab.off - this.abLaneOffset(c.dir, c.lane)) < 2.2) {
        const d = (player.ab.t * len - c.s) * c.dir;
        if (d > 0 && d < gap) gap = d;
      }
      if (gap < 45) target = Math.min(target, (gap - 12) * 1.2);
      c.speed += Math.max(-10 * dt, Math.min(3 * dt, target - c.speed));
      c.s += c.speed * c.dir * dt;
      if (c.s > len - 60 || c.s < 60) c.s = c.dir > 0 ? 62 : len - 62;
      const t = c.s / len;
      const off = this.abLaneOffset(c.dir, c.lane);
      const pos = W.abPoint(t, off);
      const h = W.abHeading(t) + (c.dir < 0 ? Math.PI : 0);
      c.x = pos.x; c.z = pos.z;
      if (c.hilti) {
        c.model.root.position.set(pos.x, 0, pos.z);
        c.model.root.rotation.y = h;
        c.model.animate(dt, c.speed, 0, 0, 0);
        // in the unlimited part he really flies
        c.base = t > 0.32 && t < 0.95 ? 64 : 33;
      } else {
        this.q.setFromAxisAngle(this.yAxis, h);
        this.m4.compose(this.v.set(pos.x, 0, pos.z), this.q, this.one);
        this.kinds[c.kind].im.setMatrixAt(c.idx, this.m4);
      }
    }
    for (const k of Object.values(this.kinds)) { k.im.instanceMatrix.needsUpdate = true; if (k.im.instanceColor) k.im.instanceColor.needsUpdate = true; }
    // pedestrians
    for (const p of this.peds) {
      let x, z, h;
      if (p.crowd) {
        p.phase += dt;
        x = p.bx + Math.sin(p.phase * 0.3) * 2; z = p.bz;
        h = p.h + Math.sin(p.phase * 0.5) * 0.5;
        p.x = x; p.z = z;
      } else {
        p.s += p.dir * p.speed * dt * (p.dodge > 0.5 ? 0.3 : 1);
        p.phase += dt * p.speed * 5;
        const [px, pz, nx, nz, rot] = this.pedPos(p);
        x = px + nx * p.dodge * 2.6; z = pz + nz * p.dodge * 2.6;
        h = rot + (p.dir < 0 ? Math.PI : 0);
        p.x = x; p.z = z;
        if (player) {
          const d = Math.hypot(player.pos.x - x, player.pos.z - z);
          if (d < 6 && Math.abs(player.speed) > 1.5) {
            if (p.dodgeT <= 0 && p.cool <= 0 && Math.abs(player.speed) > 3) { this.onPed?.(p, x, z); p.cool = 8; }
            p.dodgeT = 2.2;
          }
        }
        p.cool -= dt;
        p.dodgeT -= dt;
        p.dodge += ((p.dodgeT > 0 ? 1 : 0) - p.dodge) * Math.min(1, dt * (p.dodgeT > 0 ? 9 : 2));
      }
      const bob = Math.abs(Math.sin(p.phase)) * 0.06 + p.dodge * Math.max(0, Math.sin(Math.min(1, p.dodgeT / 2.2) * Math.PI)) * 0.5;
      this.q.setFromAxisAngle(this.yAxis, h);
      this.m4.compose(this.v.set(x, CURB + bob, z), this.q, this.one);
      this.pedMesh.setMatrixAt(p.idx, this.m4);
    }
    this.pedMesh.instanceMatrix.needsUpdate = true;
    if (this.pedMesh.instanceColor) this.pedMesh.instanceColor.needsUpdate = true;
    for (const b of this.bubbles) {
      if (b.life > 0) { b.life -= dt; b.s.position.y += dt * 0.4; b.s.material.opacity = Math.min(1, b.life * 2); if (b.life <= 0) b.s.visible = false; }
    }
    this.updateRival(dt);
  }

  /** circles for collisions with the player: [{x, z, r, car}] */
  bodies() {
    const out = [];
    for (const c of this.cars) {
      const hx = Math.sin(c.h), hz = Math.cos(c.h);
      out.push({ x: c.x + hx * 1.2, z: c.z + hz * 1.2, r: 1.0, car: c }, { x: c.x - hx * 1.2, z: c.z - hz * 1.2, r: 1.0, car: c });
    }
    for (const c of this.ab) {
      const h = this.world.abHeading(c.s / this.world.abLen);
      const hx = Math.sin(h), hz = Math.cos(h);
      out.push({ x: c.x + hx * 1.2, z: c.z + hz * 1.2, r: 1.0, car: c }, { x: c.x - hx * 1.2, z: c.z - hz * 1.2, r: 1.0, car: c });
    }
    if (this.rival.root.visible) {
      const hx = Math.sin(this.R.h), hz = Math.cos(this.R.h);
      out.push({ x: this.R.x + hx * 1.3, z: this.R.z + hz * 1.3, r: 1.05 }, { x: this.R.x - hx * 1.3, z: this.R.z - hz * 1.3, r: 1.05 });
    }
    return out;
  }

  /** remove city cars from an area (used before the race) */
  clearArea(x0, z0, x1, z1) {
    for (const c of this.cars) {
      if (c.x > x0 && c.x < x1 && c.z > z0 && c.z < z1) {
        // teleport to a far node
        c.from = [0, 5]; c.to = [1, 5]; c.pts = []; c.seg = 0; c.u = 0; c.speed = 0;
        this.planLeg(c, true);
        c.x = c.pts[0][0]; c.z = c.pts[0][1];
      }
    }
  }
}
