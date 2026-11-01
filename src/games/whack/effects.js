import * as THREE from 'three';
import { canvasTexture, rand } from '../../core/gfx.js';

// Hit-effects: shattering shards (physics), goo droplets, splat decals on the board,
// shockwave rings, spark bursts and flash lights.

const GRAV = -22;
const shardGeos = [
  new THREE.TetrahedronGeometry(0.16),
  new THREE.BoxGeometry(0.2, 0.2, 0.08),
  new THREE.OctahedronGeometry(0.12),
  new THREE.BoxGeometry(0.28, 0.1, 0.06)
];
const cellGeo = new THREE.BoxGeometry(0.22, 0.14, 0.04);
const dropGeo = new THREE.SphereGeometry(0.07, 10, 8);

const splatTex = canvasTexture(256, 256, (g, w, h) => {
  g.translate(w / 2, h / 2);
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(0, 0, 58, 0, Math.PI * 2);
  g.fill();
  for (let i = 0; i < 22; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = 50 + Math.random() * 60;
    const r = 5 + Math.random() * 16;
    g.beginPath();
    g.arc(Math.cos(a) * d, Math.sin(a) * d, r, 0, Math.PI * 2);
    g.fill();
    // streak towards center
    g.lineWidth = r * 0.9;
    g.strokeStyle = '#fff';
    g.beginPath();
    g.moveTo(Math.cos(a) * 40, Math.sin(a) * 40);
    g.lineTo(Math.cos(a) * d, Math.sin(a) * d);
    g.stroke();
  }
}, { srgb: false });

const sparkTex = canvasTexture(64, 64, (g, w, h) => {
  const grd = g.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
  grd.addColorStop(0, 'rgba(255,255,255,1)');
  grd.addColorStop(0.3, 'rgba(255,255,255,0.6)');
  grd.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = grd;
  g.fillRect(0, 0, w, h);
});

export class Effects {
  constructor(scene, boardY) {
    this.scene = scene;
    this.boardY = boardY;
    this.items = [];
    this.splats = [];
    this.shake = 0;
    this.lights = [];
    // pool of flash lights (avoids shader recompiles from changing light counts)
    for (let i = 0; i < 2; i++) {
      const l = new THREE.PointLight(0xffffff, 0, 8, 2);
      scene.add(l);
      this.lights.push({ light: l, t: 0 });
    }
    this.lightIdx = 0;
  }

  flash(pos, color, intensity = 60) {
    const L = this.lights[this.lightIdx++ % this.lights.length];
    L.light.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0.4));
    L.light.color.set(color);
    L.light.intensity = intensity;
    L.max = intensity;
    L.t = 0.35;
  }

  shatter(target, pos) {
    const { colors, goo, cells, metal } = target;
    const n = 46;
    for (let i = 0; i < n; i++) {
      const col = colors[i % colors.length];
      const mat = new THREE.MeshPhysicalMaterial({
        color: col, roughness: metal ? 0.2 : 0.35, metalness: metal ? 1 : 0, clearcoat: 0.6,
        transparent: true, opacity: 1
      });
      const geo = cells && i % 2 === 0 ? cellGeo : shardGeos[i % shardGeos.length];
      const m = new THREE.Mesh(geo, mat);
      m.castShadow = true;
      m.position.copy(pos).add(new THREE.Vector3(rand(-0.5, 0.5), rand(0, 0.9), rand(-0.2, 0.3)));
      const s = rand(0.6, 1.5);
      m.scale.set(s, s, s);
      const dir = m.position.clone().sub(pos).normalize();
      const speed = rand(4, 10);
      this.scene.add(m);
      this.items.push({
        mesh: m, kind: 'shard', life: rand(1.6, 2.6),
        v: new THREE.Vector3(dir.x * speed, rand(5, 11), dir.z * speed + rand(0, 3)),
        w: new THREE.Vector3(rand(-15, 15), rand(-15, 15), rand(-15, 15)),
        bounce: 0
      });
    }
    this.goo(pos, goo);
  }

  goo(pos, color) {
    const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.05, clearcoat: 1, transmission: 0, emissive: color, emissiveIntensity: 0.25 });
    for (let i = 0; i < 34; i++) {
      const m = new THREE.Mesh(dropGeo, mat);
      m.position.copy(pos).add(new THREE.Vector3(0, 0.5, 0));
      const a = Math.random() * Math.PI * 2;
      const sp = rand(2, 9);
      const s = rand(0.5, 1.6);
      m.scale.set(s, s, s);
      this.scene.add(m);
      this.items.push({
        mesh: m, kind: 'drop', life: 2.5, color,
        v: new THREE.Vector3(Math.cos(a) * sp, rand(4, 13), Math.sin(a) * sp * 0.7 + 1)
      });
    }
    this.splat(pos, color, rand(1.6, 2.4));
  }

  splat(pos, color, size) {
    const mat = new THREE.MeshPhysicalMaterial({
      color, alphaMap: splatTex, transparent: true, roughness: 0.08, clearcoat: 1,
      depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, opacity: 0.95
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size), mat);
    m.rotation.x = -Math.PI / 2;
    m.rotation.z = Math.random() * Math.PI * 2;
    m.position.set(pos.x + rand(-0.2, 0.2), this.boardY + 0.012 + this.splats.length * 0.0005, pos.z + rand(-0.2, 0.2));
    m.scale.setScalar(0.2);
    m.receiveShadow = true;
    this.scene.add(m);
    this.splats.push({ mesh: m, age: 0, life: 6 });
    if (this.splats.length > 24) {
      const old = this.splats.shift();
      this.scene.remove(old.mesh);
      old.mesh.geometry.dispose();
      old.mesh.material.dispose();
    }
  }

  shockwave(pos, color) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(0.4, 0.55, 64),
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(pos.x, this.boardY + 0.05, pos.z);
    this.scene.add(m);
    this.items.push({ mesh: m, kind: 'ring', life: 0.5, max: 0.5 });
  }

  sparks(pos, color, count = 40) {
    const mat = new THREE.SpriteMaterial({ map: sparkTex, color, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, toneMapped: false });
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(mat);
      s.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0));
      const sc = rand(0.15, 0.4);
      s.scale.set(sc, sc, sc);
      const a = Math.random() * Math.PI * 2;
      const e = rand(-0.2, 1);
      const sp = rand(5, 14);
      this.scene.add(s);
      this.items.push({ mesh: s, kind: 'spark', life: rand(0.3, 0.7), v: new THREE.Vector3(Math.cos(a) * sp, e * sp, Math.sin(a) * sp * 0.6) });
    }
  }

  update(dt) {
    this.shake = Math.max(0, this.shake - dt * 2.8);
    for (const L of this.lights) {
      if (L.t > 0) {
        L.t -= dt;
        L.light.intensity = Math.max(0, L.max * (L.t / 0.35));
      } else L.light.intensity = 0;
    }
    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i];
      it.life -= dt;
      const m = it.mesh;
      if (it.kind === 'shard' || it.kind === 'drop') {
        const onBoard = Math.abs(m.position.x) < 5.1 && Math.abs(m.position.z) < 3.8;
        const floor = onBoard ? this.boardY : -2.2;
        it.v.y += GRAV * dt;
        m.position.addScaledVector(it.v, dt);
        if (it.w) { m.rotation.x += it.w.x * dt; m.rotation.y += it.w.y * dt; m.rotation.z += it.w.z * dt; }
        if (m.position.y < floor + 0.06 && it.v.y < 0) {
          if (it.kind === 'drop') {
            if (!it.landed && Math.random() < 0.35) this.splat(m.position, it.color, rand(0.25, 0.6));
            it.landed = true;
            it.life = Math.min(it.life, 0.05);
          } else {
            m.position.y = floor + 0.06;
            it.v.y *= -0.35;
            it.v.x *= 0.6; it.v.z *= 0.6;
            it.w.multiplyScalar(0.6);
          }
        }
        if (it.kind === 'shard' && it.life < 0.5) {
          m.material.opacity = Math.max(0, it.life / 0.5);
          m.scale.multiplyScalar(0.97);
        }
      } else if (it.kind === 'ring') {
        const k = 1 - it.life / it.max;
        m.scale.setScalar(1 + k * 6);
        m.material.opacity = 0.9 * (1 - k);
      } else if (it.kind === 'spark') {
        it.v.multiplyScalar(1 - 3 * dt);
        it.v.y += GRAV * 0.3 * dt;
        m.position.addScaledVector(it.v, dt);
        m.material.opacity = 1;
        m.scale.multiplyScalar(1 - 2.5 * dt);
      }
      if (it.life <= 0) {
        this.scene.remove(m);
        if (it.kind === 'shard' || it.kind === 'ring') m.material.dispose();
        if (it.kind === 'ring') m.geometry.dispose();
        this.items.splice(i, 1);
      }
    }
    for (const s of this.splats) {
      s.age += dt;
      const grow = Math.min(1, s.age / 0.12);
      s.mesh.scale.setScalar(0.2 + 0.8 * (1 - Math.pow(1 - grow, 3)));
      if (s.age > s.life - 1.5) s.mesh.material.opacity = Math.max(0, 0.95 * (s.life - s.age) / 1.5);
    }
    for (let i = this.splats.length - 1; i >= 0; i--) {
      const s = this.splats[i];
      if (s.age > s.life) {
        this.scene.remove(s.mesh);
        s.mesh.geometry.dispose();
        s.mesh.material.dispose();
        this.splats.splice(i, 1);
      }
    }
  }

  clear() {
    for (const it of this.items) this.scene.remove(it.mesh);
    for (const s of this.splats) this.scene.remove(s.mesh);
    this.items.length = 0;
    this.splats.length = 0;
    this.shake = 0;
  }
}
