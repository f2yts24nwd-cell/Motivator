import * as THREE from 'three';
import { canvasTexture, rand, clamp, lerp } from '../../core/gfx.js';
import { sfx, music } from '../../core/audio.js';
import { loadAvatar, buildAvatar, disposeAvatar } from '../../hub/avatar.js';
import { h, mount, clearUI, storeGet, storeSet } from '../../core/ui.js';
import { drawPatent } from './patent.js';
import { buildCRX, animateCRX } from './models.js';
import { HANNAH, say } from './content.js';

// Go-Live lounge in the data centre: the Ludlein CRX is parked with its exhaust glowing,
// Hannah aka S4HANNAH walks in and hands over the S4 Patent to the player's avatar.

export class ConversionFinale {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.build();
  }

  build() {
    const s = this.scene;
    s.background = new THREE.Color(0x060a16);
    s.fog = new THREE.Fog(0x060a16, 14, 40);
    s.environment = this.app.gfx.envMap;
    s.environmentIntensity = 0.45;
    s.add(new THREE.HemisphereLight(0x9ab8ff, 0x10081a, 0.6));
    const spot = new THREE.SpotLight(0xfff0dc, 130, 22, 0.55, 0.6, 1.5);
    spot.position.set(0.5, 8, 5);
    spot.target.position.set(0, 1.2, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004;
    s.add(spot, spot.target);
    const gold = new THREE.PointLight(0xffb000, 26, 12);
    gold.position.set(-3.5, 3, -1);
    const blue = new THREE.PointLight(0x19c3ff, 22, 12);
    blue.position.set(3.4, 2.6, -1);
    s.add(gold, blue);

    // glossy data-centre floor
    const floorTex = canvasTexture(512, 512, (g, w, hh) => {
      g.fillStyle = '#0c1222'; g.fillRect(0, 0, w, hh);
      g.strokeStyle = 'rgba(25,195,255,0.25)'; g.lineWidth = 3;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, hh); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshPhysicalMaterial({ map: floorTex, roughness: 0.3, metalness: 0.4, clearcoat: 0.8 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);

    // row of server racks behind
    const ledTex = canvasTexture(128, 256, (g, w, hh) => {
      g.fillStyle = '#05070d'; g.fillRect(0, 0, w, hh);
      for (let y = 8; y < hh; y += 14) {
        g.fillStyle = '#141a2a'; g.fillRect(6, y, w - 12, 10);
        for (let x = 12; x < w - 12; x += 12) if (Math.random() < 0.35) { g.fillStyle = Math.random() < 0.6 ? '#3ddc84' : '#19c3ff'; g.fillRect(x, y + 3, 4, 4); }
      }
    });
    ledTex.wrapS = ledTex.wrapT = THREE.RepeatWrapping;
    this.ledTex = ledTex;
    const rackMat = new THREE.MeshStandardMaterial({ color: 0x151a26, metalness: 0.8, roughness: 0.35 });
    const frontMat = new THREE.MeshBasicMaterial({ map: ledTex, color: new THREE.Color(1.5, 1.5, 1.5), toneMapped: false });
    for (let i = -5; i <= 5; i++) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(1.2, 3.2, 1.2), rackMat);
      r.position.set(i * 1.3, 1.6, -4.4);
      s.add(r);
      const f = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 2.9), frontMat);
      f.position.set(i * 1.3, 1.65, -3.79);
      s.add(f);
    }

    const neonTex = canvasTexture(1024, 220, (g, w, hh) => {
      g.font = '900 150px system-ui, "Segoe UI", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#3ddc84'; g.shadowBlur = 34; g.fillStyle = '#d6ffe4';
      g.fillText('GO-LIVE!', w / 2, hh / 2);
    });
    this.neon = new THREE.Mesh(new THREE.PlaneGeometry(5.6, 1.2), new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(2, 2, 2) }));
    this.neon.position.set(0, 4.1, -3.7);
    s.add(this.neon);

    // the Ludlein CRX, parked with its tail towards the scene
    this.car = buildCRX();
    this.car.group.position.set(-4.3, 0, -1.0);
    this.car.group.rotation.y = 2.35; // tail and fat exhaust towards the stage
    this.car.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    s.add(this.car.group);
    this.fireT = 0;

    // Hannah aka S4HANNAH
    this.hannah = buildAvatar(HANNAH.look);
    this.hannah.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    for (const c of [...this.hannah.arms[1].children]) if (c.position.y < -0.8) this.hannah.arms[1].remove(c);
    s.add(this.hannah.root);

    // patent prop
    this.patCanvas = document.createElement('canvas');
    drawPatent(this.patCanvas, {});
    this.patTex = new THREE.CanvasTexture(this.patCanvas);
    this.patTex.colorSpace = THREE.SRGBColorSpace;
    this.patTex.anisotropy = 8;
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.78), new THREE.MeshBasicMaterial({ map: this.patTex, toneMapped: false, side: THREE.DoubleSide }));
    this.hannah.arms[0].add(this.paper);

    // confetti
    this.confetti = [];
    const cg = new THREE.PlaneGeometry(0.06, 0.1);
    const cols = [0xffcc4d, 0x19c3ff, 0x3ddc84, 0xff7ac0, 0xffffff];
    for (let i = 0; i < 160; i++) {
      const m = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, emissive: cols[i % cols.length], emissiveIntensity: 0.4 }));
      m.visible = false;
      s.add(m);
      this.confetti.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3() });
    }
  }

  enter(stats) {
    this.stats = { score: 0, rc0: 0, dumps: 0, phases: 0, boss: 'none', golive: false, rank: 'teilnahme', rankName: 'Teilnahme', rc: 'RC 12', title: '', line: '', mode: 'kunde', ...(stats || {}) };
    const mode = this.stats.mode;
    this.name = storeGet('player-name', '');
    this.lines = [
      say(HANNAH.intro, mode),
      say(HANNAH.rank[this.stats.rank] || HANNAH.rank.teilnahme, mode),
      HANNAH.hand(this.stats.rankName)
    ];
    if (this.player) { this.scene.remove(this.player.root); disposeAvatar(this.player); }
    this.player = buildAvatar(loadAvatar());
    this.player.root.position.set(-1.35, 0, 0.6);
    this.player.root.rotation.y = 0.5;
    this.player.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.player.root);
    this.hannah.root.position.set(5, 0, 0.3);
    this.hannah.root.rotation.y = -Math.PI / 2;
    this.redraw();
    this.t = 0;
    this.phase = 'walk';
    music.play('rush');
    music.setIntensity(1);
    this.resize(window.innerWidth, window.innerHeight);
    clearUI();
    mount(h('button.icon-btn.left', { title: 'Zurück zur Spielewelt', onclick: () => { sfx.click(); this.app.goHub(); } }, '⟵'));
    for (const c of this.confetti) c.m.visible = false;
    setTimeout(() => sfx.rev(1.2), 400);
    this.fireT = 1.6;
  }

  exit() { clearUI(); clearInterval(this.typer); }

  resize(w, hgt) {
    const aspect = w / hgt;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
    const d = Math.max(7.6, 2.6 / Math.tan(hfov / 2));
    this.camera.position.set(-0.15, 2.4 + (aspect < 1 ? 0.6 : 0), d);
    this.camera.lookAt(-0.15, aspect < 1 ? 1.4 : 1.8, 0);
  }

  redraw() {
    drawPatent(this.patCanvas, { ...this.stats, name: this.name });
    this.patTex.needsUpdate = true;
  }

  burstConfetti() {
    for (const c of this.confetti) {
      c.m.visible = true;
      c.m.position.set(rand(-3, 3), rand(5, 8), rand(-1.5, 2));
      c.v.set(rand(-0.4, 0.4), rand(-1.6, -0.8), rand(-0.3, 0.3));
      c.w.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
    }
  }

  say(i) {
    document.querySelector('.speech')?.remove();
    const text = h('span');
    const last = i === this.lines.length - 1;
    const btn = h('button.btn' + (last ? '.gold' : '.secondary'), {
      onclick: () => { sfx.click(); if (last) this.showPatent(); else this.say(i + 1); }
    }, last ? '📜 Patent ansehen' : 'Weiter …');
    mount(h('div.speech.panel.cv-hannah', {}, [h('b', {}, HANNAH.speaker), text, h('div.row', {}, btn)]));
    const full = this.lines[i];
    let n = 0;
    clearInterval(this.typer);
    this.typer = setInterval(() => {
      n += 2;
      text.textContent = full.slice(0, n);
      if (n % 6 === 0) sfx.step();
      if (n >= full.length) clearInterval(this.typer);
    }, 26);
    if (last) {
      this.phase = 'present';
      this.t = 0;
      sfx.win();
      music.setIntensity(3);
      this.burstConfetti();
      this.fireT = 2.4;
      setTimeout(() => sfx.rev(1.4), 600);
    }
  }

  showPatent() {
    document.querySelector('.speech')?.remove();
    const preview = document.createElement('canvas');
    const input = h('input', { type: 'text', maxlength: '40', placeholder: 'Dein Name für das Patent', value: this.name });
    const render = () => drawPatent(preview, { ...this.stats, name: this.name });
    input.addEventListener('input', () => {
      this.name = input.value;
      storeSet('player-name', this.name);
      render();
      this.redraw();
    });
    render();
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const fileName = `S4-Patent${this.name ? '-' + this.name.replace(/[^\wäöüÄÖÜß-]+/g, '_') : ''}.png`;
    const download = () => {
      const a = document.createElement('a');
      a.download = fileName;
      a.href = preview.toDataURL('image/png');
      a.click();
    };
    const share = async () => {
      sfx.click();
      try {
        const blob = await new Promise((r) => preview.toBlob(r, 'image/png'));
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Mein S4 Patent', text: `${this.stats.score.toLocaleString('de-DE')} Punkte bei „Mission RC 0“ in der itmX Spielewelt.` });
        } else download();
      } catch { /* user cancelled */ }
    };
    mount(h('div.overlay', {}, h('div.cert-wrap.panel', {}, [
      preview,
      h('div.name', {}, [input]),
      h('div.row', {}, [
        h('button.btn.gold', { onclick: () => { sfx.click(); if (isIOS && navigator.canShare) share(); else download(); } }, isIOS ? '⬇ Speichern / Teilen' : '⬇ Als Bild speichern'),
        navigator.share && !isIOS ? h('button.btn.secondary', { onclick: share }, 'Teilen') : null,
        h('button.btn.secondary', { onclick: () => { sfx.click(); this.app.startGame('conversion'); } }, '↻ Neue Downtime'),
        h('button.btn.secondary', { onclick: () => { sfx.click(); this.app.goHub(); } }, 'Zur Spielewelt')
      ])
    ])));
  }

  update(dt, time) {
    this.t += dt;
    const T = this.hannah;
    const [armL, armR] = T.arms;
    if (this.player) {
      const P = this.player;
      const cheer = this.phase === 'present';
      P.body.position.y = cheer ? Math.abs(Math.sin(time * 6)) * 0.12 : Math.sin(time * 2) * 0.01;
      P.arms.forEach((arm, i) => {
        const sgn = i === 0 ? -1 : 1;
        arm.rotation.z = lerp(arm.rotation.z, cheer ? sgn * (2.5 + Math.sin(time * 6 + i) * 0.2) : sgn * 0.05, 0.12);
      });
      P.neck.rotation.y = lerp(P.neck.rotation.y, this.phase === 'walk' ? 0.6 : 0.25, 0.05);
    }
    if (this.phase === 'walk') {
      const k = clamp(this.t / 2.2, 0, 1);
      T.root.position.x = lerp(5, 1.0, 1 - Math.pow(1 - k, 2));
      T.body.position.y = Math.abs(Math.sin(this.t * 7)) * 0.05;
      T.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.t * 7 + i * Math.PI) * 0.45 * (1 - k * 0.6); });
      armL.rotation.x = -Math.sin(this.t * 7) * 0.3;
      armR.rotation.x = Math.sin(this.t * 7) * 0.3;
      if (k >= 1) { this.phase = 'talk'; this.t = 0; this.say(0); }
    } else {
      T.root.rotation.y = lerp(T.root.rotation.y, -0.35, 0.08);
      T.body.position.y = lerp(T.body.position.y, 0, 0.2);
      T.legs.forEach((l) => { l.rotation.x = lerp(l.rotation.x, 0, 0.2); });
      armR.rotation.z = lerp(armR.rotation.z, 0.32, 0.08);
      armR.rotation.x = lerp(armR.rotation.x, 0.1, 0.08);
      T.body.rotation.z = Math.sin(time * 1.2) * 0.02;
      if (this.phase === 'present') {
        armL.rotation.x = lerp(armL.rotation.x, -1.35, 0.08);
        armL.rotation.z = lerp(armL.rotation.z, 0.25, 0.08);
      } else {
        armL.rotation.x = lerp(armL.rotation.x, -0.4 + Math.sin(time * 4) * 0.25, 0.1);
        armL.rotation.z = lerp(armL.rotation.z, -0.15, 0.1);
      }
      T.neck.rotation.y = Math.sin(time * 1.5) * 0.12;
    }
    const show = this.phase === 'present';
    this.paper.visible = show;
    if (show) {
      this.paper.scale.setScalar(clamp(this.t / 0.4, 0.01, 1));
      this.paper.position.set(0, -0.85, 0.12);
      this.paper.rotation.set(-armL.rotation.x, -armL.rotation.z * 0.5, 0);
    }
    // the parked CRX revs now and then, flames out of the fat exhaust
    this.fireT = Math.max(0, this.fireT - dt);
    animateCRX(this.car, dt, time, 0, this.fireT > 0 ? 0.8 + Math.sin(time * 30) * 0.2 : 0);
    this.car.group.position.y = this.fireT > 0 ? Math.abs(Math.sin(time * 40)) * 0.015 : 0;
    for (const c of this.confetti) {
      if (!c.m.visible) continue;
      c.m.position.addScaledVector(c.v, dt);
      c.m.position.x += Math.sin(time * 3 + c.w.x) * dt * 0.3;
      c.m.rotation.x += c.w.x * dt; c.m.rotation.y += c.w.y * dt;
      if (c.m.position.y < 0.02) { c.m.position.y = 0.02; c.v.set(0, 0, 0); c.w.set(0, 0, 0); }
    }
    this.ledTex.offset.y = Math.floor(time * 4) * 0.37;
    this.neon.material.color.setScalar(Math.random() < 0.02 ? 0.5 : 2 + Math.sin(time * 4) * 0.2);
  }
}
