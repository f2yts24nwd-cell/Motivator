import * as THREE from 'three';
import { canvasTexture, rand } from '../../core/gfx.js';

// Sprite particles: smoke, sparks, fireworks, dust. One pool, each sprite its own material
// (cheap enough at this count and lets every particle fade on its own).
export class Particles {
  constructor(scene, count = 220) {
    this.scene = scene;
    const soft = canvasTexture(64, 64, (g, w) => { const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,0.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); });
    const smoke = canvasTexture(128, 128, (g, w) => {
      for (let i = 0; i < 14; i++) { const x = rand(30, 98), y = rand(30, 98), r = rand(16, 34); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = gr; g.fillRect(0, 0, w, w); }
    });
    this.tex = { soft, smoke };
    this.pool = [];
    for (let i = 0; i < count; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: soft, transparent: true, depthWrite: false }));
      s.visible = false;
      scene.add(s);
      this.pool.push({ s, life: 0, max: 1, v: new THREE.Vector3(), g: 0, grow: 0, drag: 0 });
    }
    this.i = 0;
  }
  emit(pos, { n = 1, color = 0xffffff, size = 1, life = 1, speed = 3, up = 0, gravity = 0, grow = 0, additive = false, smoke = false, opacity = 1, spread = 1, drag = 0 } = {}) {
    for (let k = 0; k < n; k++) {
      const p = this.pool[this.i++ % this.pool.length];
      const m = p.s.material;
      m.map = smoke ? this.tex.smoke : this.tex.soft;
      m.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
      m.color.set(color);
      if (additive) m.color.multiplyScalar(3);
      m.toneMapped = !additive;
      m.opacity = opacity;
      m.rotation = rand(0, 6.28);
      p.base = opacity;
      p.s.position.copy(pos);
      p.v.set(rand(-1, 1) * spread, rand(-1, 1) * spread * 0.5 + up, rand(-1, 1) * spread).normalize().multiplyScalar(speed * rand(0.4, 1));
      p.v.y += up;
      p.life = p.max = life * rand(0.7, 1.2);
      p.g = gravity; p.grow = grow; p.drag = drag;
      p.size = size * rand(0.7, 1.3);
      p.s.scale.setScalar(p.size);
      p.s.visible = true;
    }
  }
  sparks(pos, n = 18) { this.emit(pos, { n, color: 0xffb040, size: 0.25, life: 0.5, speed: 9, up: 2, gravity: 14, additive: true }); }
  firework(pos, color) {
    this.emit(pos, { n: 46, color, size: 1.1, life: 1.6, speed: 16, gravity: 5, additive: true, drag: 1.6 });
    this.emit(pos, { n: 10, color: 0xffffff, size: 2.4, life: 0.35, speed: 2, additive: true });
  }
  update(dt) {
    for (const p of this.pool) {
      if (p.life <= 0) continue;
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; continue; }
      p.v.y -= p.g * dt;
      if (p.drag) p.v.multiplyScalar(Math.exp(-p.drag * dt));
      p.s.position.addScaledVector(p.v, dt);
      p.size += p.grow * dt;
      p.s.scale.setScalar(p.size);
      const k = p.life / p.max;
      p.s.material.opacity = p.base * Math.min(1, k * 2.2);
    }
  }
}
