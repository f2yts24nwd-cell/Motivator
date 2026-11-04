import * as THREE from 'three';

// Arcade car physics: a kinematic bicycle model with a grip limit (understeer when you push too
// hard), a handbrake drift, engine/brake/drag forces and a fake gearbox for the engine sound.
// heading 0 = +z; positive heading/steer = turning left.

export class Vehicle {
  constructor(car, cfg) {
    this.car = car;
    this.pos = new THREE.Vector3();
    this.heading = 0;
    this.speed = 0; // m/s along the heading
    this.lat = 0; // lateral slip velocity (m/s, + = to the left)
    this.yaw = 0;
    this.steer = 0;
    this.ax = 0;
    this.ay = 0;
    this.y = 0;
    this.vy = 0;
    this.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
    this.vmax = car.vmax / 3.6;
    this.limp = false;
    this.offroad = false;
    this.configure(cfg);
  }
  configure(cfg) {
    const drop = (cfg?.drop || 0) / 1000;
    this.grip = this.car.grip + drop * 1.4;
    this.a0 = (27.78 / this.car.t100) * 1.3;
  }
  get kmh() { return Math.abs(this.speed) * 3.6; }
  get forward() { return new THREE.Vector3(Math.sin(this.heading), 0, Math.cos(this.heading)); }

  /** engine rpm 0..1 and gear (for sound) */
  engine() {
    const v = Math.abs(this.speed);
    if (this.car.ev) return { rpm: Math.min(1, v / this.vmax), gear: 1, load: this.input.throttle };
    const top = this.vmax;
    const gears = [0, 0.16, 0.3, 0.46, 0.62, 0.8, 1.0].map((k) => k * top);
    let g = 1;
    while (g < 6 && v > gears[g] * 0.97) g++;
    const lo = gears[g - 1] * 0.75, hi = gears[g];
    const rpm = Math.min(1, Math.max(0.12, (v - lo) / (hi - lo) * 0.85 + 0.12));
    return { rpm: v < 0.3 ? 0.1 + this.input.throttle * 0.25 : rpm, gear: g, load: this.input.throttle };
  }

  step(dt, { maxSpeed = Infinity, ground = 0 } = {}) {
    const I = this.input;
    const v = this.speed;
    const vmax = Math.min(this.vmax, maxSpeed, this.limp ? 30 / 3.6 : Infinity);
    // ---- steering: less lock at speed, smooth return
    const lock = 0.62 / (1 + Math.abs(v) / 11);
    const want = I.steer * lock;
    this.steer += (want - this.steer) * Math.min(1, dt * (Math.abs(want) > Math.abs(this.steer) ? 7 : 10));
    // ---- longitudinal
    let a = 0;
    if (I.throttle > 0) {
      if (v < -0.4) a += 11 * I.throttle; // braking out of reverse
      else {
        const k = Math.max(0, 1 - Math.pow(Math.max(0, v) / vmax, this.car.ev ? 3 : 2));
        const ev = this.car.ev ? 1.15 : 1;
        a += this.a0 * ev * k * I.throttle;
        if (v > vmax) a -= (v - vmax) * 2;
      }
    }
    if (I.brake > 0) {
      if (v > 0.4) a -= 11 * I.brake;
      else if (I.throttle === 0) a -= (v > -8 ? 5.5 : 0) * I.brake; // reverse
    }
    // drag + rolling resistance (more on grass)
    const roll = this.offroad ? 2.4 : 0.35;
    a -= Math.sign(v) * (roll + 0.00042 * v * v * 1.6);
    if (I.handbrake) a -= Math.sign(v) * 4;
    let nv = v + a * dt;
    if (Math.sign(nv) !== Math.sign(v) && v !== 0 && I.throttle === 0 && !(I.brake > 0 && v <= 0.4)) nv = 0;
    if (I.throttle === 0 && I.brake === 0 && Math.abs(nv) < 0.15) nv = 0;
    this.ax = (nv - v) / Math.max(dt, 1e-4);
    this.speed = nv;
    // ---- lateral / yaw
    const wb = this.car.dims.wb;
    let yawT = this.speed * Math.tan(this.steer) / wb;
    const latMax = this.grip * 9.81 * (this.offroad ? 0.6 : 1);
    const latA = Math.abs(this.speed * yawT);
    if (latA > latMax && !I.handbrake) yawT *= latMax / latA; // understeer
    if (I.handbrake && Math.abs(this.speed) > 4) {
      yawT *= 1.55;
      this.lat += -yawT * this.speed * dt * 0.35;
    }
    this.yaw += (yawT - this.yaw) * Math.min(1, dt * (I.handbrake ? 3 : 9));
    this.heading += this.yaw * dt;
    this.lat *= Math.exp(-dt * (I.handbrake ? 1.2 : 5 * this.grip));
    this.ay = this.speed * this.yaw;
    // ---- integrate position
    const f = this.forward;
    const r = new THREE.Vector3(f.z, 0, -f.x); // left
    this.pos.addScaledVector(f, this.speed * dt).addScaledVector(r, this.lat * dt);
    // ---- curbs: smooth step up/down
    this.vy += ((ground - this.y) * 160 - this.vy * 18) * dt;
    this.y += this.vy * dt;
    if (this.y < ground - 0.02 && ground > 0) this.y = ground - 0.02;
  }

  /** collision response; n = push normal (x, z) */
  bump(n) {
    const f = this.forward;
    const into = f.x * n.x + f.z * n.z; // < 0 when driving into the obstacle
    const impact = Math.abs(this.speed * into);
    if (this.speed * into < 0) {
      // remove the velocity component into the wall, keep sliding along it
      this.speed *= 1 - Math.min(1, Math.abs(into)) * 0.85;
      if (Math.abs(into) > 0.85) this.speed = -this.speed * 0.15;
    }
    return impact;
  }
}
