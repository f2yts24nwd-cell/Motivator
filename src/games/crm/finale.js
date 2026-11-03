import * as THREE from 'three';
import { rand, clamp, lerp } from '../../core/gfx.js';
import { sfx, music } from '../../core/audio.js';
import { loadAvatar, buildAvatar, disposeAvatar } from '../../hub/avatar.js';
import { h, mount, clearUI, storeGet, storeSet } from '../../core/ui.js';
import { drawUrkunde } from './urkunde.js';
import { buildLord, TERRAIN, smoothTex, bake } from './models.js';
import { drawBrand } from '../../core/gfx.js';
import { FINALE, MODULES, TOWER_MODS, say, SONG } from './content.js';
import { songChip } from './songchip.js';

// The throne room: Lord CRM rises from his throne, knights the player's avatar
// (sword taps on both shoulders) and hands over the royal certificate.

export class KoenigreichFinale {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 1, 0.1, 120);
    this.build();
  }

  build() {
    const s = this.scene;
    s.background = new THREE.Color(0x120c14);
    s.fog = new THREE.Fog(0x120c14, 16, 34);
    s.environment = this.app.gfx.envMap;
    s.environmentIntensity = 0.3;
    s.add(new THREE.HemisphereLight(0xffd9b0, 0x1a0e14, 0.55));
    const spot = new THREE.SpotLight(0xfff0d6, 85, 26, 0.6, 0.6, 1.4);
    spot.position.set(3, 9, 5);
    spot.target.position.set(0, 1, -0.6);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004;
    s.add(spot, spot.target);

    const statics = new THREE.Group();
    s.add(statics);
    const box = (w, hh, d, m, x, y, z) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, hh, d), m); o.position.set(x, y, z); o.castShadow = o.receiveShadow = true; statics.add(o); return o; };
    const brick = new THREE.MeshStandardMaterial({ map: TERRAIN.brick(), roughness: 0.8 });
    const plank = new THREE.MeshStandardMaterial({ map: TERRAIN.plank(), roughness: 0.7 });
    const gold = new THREE.MeshStandardMaterial({ color: 0xffcc33, metalness: 0.9, roughness: 0.25 });
    const red = new THREE.MeshStandardMaterial({ color: 0xa3122a, roughness: 0.75 });
    // checker floor of voxel tiles
    for (let x = -7; x <= 7; x++) for (let z = -6; z <= 5; z++) {
      const t = box(1, 0.2, 1, (x + z) % 2 ? brick : plank, x, -0.1, z);
      t.castShadow = false;
    }
    // red carpet
    const carpet = box(1.8, 0.04, 9, red, 0, 0.02, 0);
    carpet.castShadow = false;
    box(0.12, 0.05, 9, gold, -0.95, 0.03, 0); box(0.12, 0.05, 9, gold, 0.95, 0.03, 0);
    // back wall + pillars
    for (let x = -7; x <= 7; x++) for (let y = 0; y < 6; y++) box(1, 1, 1, brick, x, y + 0.5, -6.5);
    for (const x of [-7.5, 7.5]) for (let z = -6; z <= 5; z++) for (let y = 0; y < 6; y++) box(1, 1, 1, brick, x, y + 0.5, z);
    for (const x of [-5, -2.6, 2.6, 5]) { box(0.9, 5.4, 0.9, brick, x, 2.7, -4.6); box(1.1, 0.3, 1.1, gold, x, 5.4, -4.6); }
    // banners with the itmX logo
    const bannerTex = smoothTex('throne-banner', 128, 320, (g, w, hh) => {
      g.fillStyle = '#7a0b1f'; g.fillRect(0, 0, w, hh);
      g.fillStyle = '#a3122a'; g.fillRect(10, 0, w - 20, hh - 40);
      g.beginPath(); g.moveTo(10, hh - 40); g.lineTo(w / 2, hh - 6); g.lineTo(w - 10, hh - 40); g.fill();
      g.fillStyle = '#ffcc33'; g.fillRect(10, 0, w - 20, 12); g.fillRect(10, hh - 52, w - 20, 6);
      drawBrand(g, 24, 110, w - 48, w - 48);
    });
    for (const x of [-3.8, 3.8]) {
      const b = new THREE.Mesh(new THREE.PlaneGeometry(1.3, 3.2), new THREE.MeshStandardMaterial({ map: bannerTex, side: THREE.DoubleSide }));
      b.position.set(x, 3.4, -5.98);
      s.add(b);
    }
    // four module tapestries on the side
    TOWER_MODS.forEach((m, i) => {
      const x = i < 2 ? -6.95 : 6.95;
      const z = i % 2 ? -1.2 : -3.4;
      const t = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.8, 1.1), new THREE.MeshStandardMaterial({ color: MODULES[m].color, emissive: MODULES[m].color, emissiveIntensity: 0.2 }));
      t.position.set(x * 0.991, 2.6, z);
      s.add(t);
    });
    // tall windows with moonlight
    for (const x of [-7.0, 7.0]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 2.2), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.5, 0.75, 1.6), toneMapped: false, side: THREE.DoubleSide }));
      w.position.set(x * 0.991, 3.2, 1.6);
      w.rotation.y = Math.PI / 2;
      s.add(w);
    }
    // dais + throne
    box(4.4, 0.3, 2.6, brick, 0, 0.15, -4.4);
    box(3.4, 0.3, 2.0, red, 0, 0.45, -4.6);
    box(1.6, 0.6, 1.2, red, 0, 0.9, -4.8);
    box(1.8, 2.6, 0.3, red, 0, 2.2, -5.4);
    box(1.9, 0.2, 0.4, gold, 0, 3.55, -5.4);
    for (const x of [-0.95, 0.95]) { box(0.25, 1.1, 1.3, gold, x, 1.2, -4.8); box(0.3, 0.3, 0.3, gold, x, 3.75, -5.4); }
    // torches
    this.flames = [];
    this.torchLights = [];
    for (const x of [-5, 5]) {
      box(0.18, 0.7, 0.18, plank, x, 3.4, -4.1);
      const f = box(0.3, 0.36, 0.3, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.4, 0.3), toneMapped: false }), x, 3.95, -4.1);
      f.castShadow = false;
      this.flames.push(f);
      const l = new THREE.PointLight(0xff8a2a, 20, 12, 1.6);
      l.position.set(x, 4.1, -3.6);
      s.add(l);
      this.torchLights.push(l);
    }
    bake(statics);
    // Lord CRM
    this.lord = buildLord();
    this.lord.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    s.add(this.lord.root);
    // the knighting sword (appears in the left hand)
    this.sword = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.4, 0.03), new THREE.MeshStandardMaterial({ color: 0xdfe8f5, metalness: 1, roughness: 0.15 }));
    blade.position.y = 0.95;
    const guard = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.1), gold);
    guard.position.y = 0.22;
    const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.3, 0.08), red);
    grip.position.y = 0.05;
    this.sword.add(blade, guard, grip);
    this.sword.position.set(0, -0.66, 0.1);
    this.sword.rotation.x = Math.PI / 2;
    this.sword.visible = false;
    this.lord.arms[0].add(this.sword);
    // scroll prop
    this.paperCanvas = document.createElement('canvas');
    drawUrkunde(this.paperCanvas, {});
    this.paperTex = new THREE.CanvasTexture(this.paperCanvas);
    this.paperTex.colorSpace = THREE.SRGBColorSpace;
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.71), new THREE.MeshBasicMaterial({ map: this.paperTex, toneMapped: false, side: THREE.DoubleSide }));
    this.paper.visible = false;
    s.add(this.paper);
    // confetti (voxel cubes)
    this.confetti = [];
    const cg = new THREE.BoxGeometry(0.08, 0.08, 0.08);
    const cols = [0xffcc33, 0xff5fa8, 0x19c3ff, 0xffb000, 0xa46bff, 0x50af30];
    for (let i = 0; i < 180; i++) {
      const m = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], emissive: cols[i % cols.length], emissiveIntensity: 0.4 }));
      m.visible = false;
      s.add(m);
      this.confetti.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3() });
    }
  }

  enter(stats) {
    this.stats = { score: 0, rank: 'teilnahme', rankName: 'Teilnahme', title: 'Knappe des CRM', bauplan: 0, pillars: [0, 0, 0, 0], fundaments: 0, kills: 0, boss: false, mode: 'kunde', ...(stats || {}) };
    const mode = this.stats.mode;
    this.name = storeGet('player-name', '');
    this.lines = [
      say(FINALE.intro, mode),
      say(FINALE.rank[this.stats.rank] || FINALE.rank.teilnahme, mode),
      FINALE.knight,
      FINALE.hand(this.stats.title)
    ];
    if (this.player) { this.scene.remove(this.player.root); disposeAvatar(this.player); }
    this.player = buildAvatar(loadAvatar());
    this.player.root.position.set(-0.25, 0, 0.9);
    this.player.root.rotation.y = Math.PI + 0.25;
    this.player.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.player.root);
    this.lord.root.position.set(0, 0.6, -4.55);
    this.lord.root.rotation.y = 0;
    this.lord.body.position.y = -0.35; // seated
    this.sword.visible = false;
    this.paper.visible = false;
    this.redraw();
    this.t = 0;
    this.phase = 'seated';
    this.kneel = 0;
    music.playSong(SONG.url);
    this.resize(window.innerWidth, window.innerHeight);
    clearUI();
    mount(h('button.icon-btn.left', { title: 'Zurück zur Spielewelt', onclick: () => { sfx.click(); this.app.goHub(); } }, '⟵'));
    mount(h('div.kr-songdock', {}, songChip()));
    for (const c of this.confetti) c.m.visible = false;
    setTimeout(() => sfx.fanfare(), 300);
  }

  exit() { clearUI(); clearInterval(this.typer); }

  resize(w, hgt) {
    const aspect = w / hgt;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
    const d = Math.max(7.6, 2.7 / Math.tan(hfov / 2));
    // three-quarter view: the Lord from the front, the avatar from the side
    this.camera.position.set(d * 0.62, 2.7 + (aspect < 1 ? 0.6 : 0), d * 0.55);
    this.camera.lookAt(-0.4, aspect < 1 ? 1.3 : 1.5, -1.6);
  }

  redraw() {
    drawUrkunde(this.paperCanvas, { ...this.stats, name: this.name });
    this.paperTex.needsUpdate = true;
  }

  burstConfetti() {
    for (const c of this.confetti) {
      c.m.visible = true;
      c.m.position.set(rand(-3.5, 3.5), rand(5, 8), rand(-3, 2));
      c.v.set(rand(-0.4, 0.4), rand(-1.8, -0.9), rand(-0.3, 0.3));
      c.w.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
    }
  }

  say(i) {
    document.querySelector('.speech')?.remove();
    const text = h('span');
    const knight = i === 2;
    const last = i === this.lines.length - 1;
    const btn = h('button.btn' + (last ? '.gold' : knight ? '.gold' : '.secondary'), {
      onclick: () => {
        sfx.click();
        if (last) this.showUrkunde();
        else if (knight) { btn.disabled = true; this.startKnighting(); }
        else this.say(i + 1);
      }
    }, last ? '📜 Urkunde ansehen' : knight ? '⚔️ Niederknien' : 'Weiter …');
    mount(h('div.speech.panel.kr-speech', {}, [h('b', {}, FINALE.speaker), text, h('div.row', {}, btn)]));
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
      sfx.fanfare();
      this.burstConfetti();
    }
  }

  startKnighting() {
    this.phase = 'knight';
    this.t = 0;
    this.taps = 0;
    this.sword.visible = true;
    document.querySelector('.speech')?.remove();
  }

  showUrkunde() {
    document.querySelector('.speech')?.remove();
    const preview = document.createElement('canvas');
    const input = h('input', { type: 'text', maxlength: '40', placeholder: 'Dein Name für die Urkunde', value: this.name });
    const render = () => drawUrkunde(preview, { ...this.stats, name: this.name });
    input.addEventListener('input', () => {
      this.name = input.value;
      storeSet('player-name', this.name);
      render();
      this.redraw();
    });
    render();
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const fileName = `CRM-Urkunde${this.name ? '-' + this.name.replace(/[^\wäöüÄÖÜß-]+/g, '_') : ''}.png`;
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
          await navigator.share({ files: [file], title: 'Meine königliche CRM-Urkunde', text: `${this.stats.score.toLocaleString('de-DE')} Punkte im „CRM-Königreich“ der itmX Spielewelt.` });
        } else download();
      } catch { /* cancelled */ }
    };
    mount(h('div.overlay', {}, h('div.cert-wrap.panel', {}, [
      preview,
      h('div.name', {}, [input]),
      h('div.row', {}, [
        h('button.btn.gold', { onclick: () => { sfx.click(); if (isIOS && navigator.canShare) share(); else download(); } }, isIOS ? '⬇ Speichern / Teilen' : '⬇ Als Bild speichern'),
        navigator.share && !isIOS ? h('button.btn.secondary', { onclick: share }, 'Teilen') : null,
        h('button.btn.secondary', { onclick: () => { sfx.click(); this.app.startGame('koenigreich'); } }, '↻ Neues Königreich'),
        h('button.btn.secondary', { onclick: () => { sfx.click(); this.app.goHub(); } }, 'Zur Spielewelt')
      ])
    ])));
  }

  update(dt, time) {
    this.t += dt;
    const L = this.lord;
    const P = this.player;
    const [armL, armR] = L.arms;
    // torches flicker
    this.flames.forEach((f, i) => { const k = 2.6 + Math.sin(time * 13 + i) * 0.4 + Math.sin(time * 7.7 + i * 2) * 0.3; f.material.color.setRGB(k, k * 0.48, 0.25); f.scale.y = 0.9 + Math.sin(time * 17 + i) * 0.15; this.torchLights[i].intensity = 16 + k * 3; });
    L.xTop.rotation.y += dt * 2;

    if (this.phase === 'seated') {
      // rises from the throne
      const k = clamp((this.t - 0.6) / 0.8, 0, 1);
      L.body.position.y = lerp(-0.35, 0, k);
      if (this.t > 1.5) { this.phase = 'walk'; this.t = 0; }
    } else if (this.phase === 'walk') {
      const k = clamp(this.t / 2.0, 0, 1);
      const e = 1 - Math.pow(1 - k, 2);
      L.root.position.z = lerp(-4.55, -0.55, e);
      L.root.position.y = k < 0.35 ? lerp(0.6, 0, k / 0.35) : 0;
      L.body.position.y = Math.abs(Math.sin(this.t * 7)) * 0.05;
      L.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.t * 7 + i * Math.PI) * 0.45 * (1 - k * 0.7); });
      if (k >= 1) { this.phase = 'talk'; this.t = 0; this.say(0); }
    } else if (this.phase === 'knight') {
      // the avatar kneels, the sword touches the left and the right shoulder
      this.kneel = Math.min(1, this.kneel + dt * 2.5);
      const tt = this.t - 0.5;
      const tap = (c) => Math.exp(-Math.pow((tt - c) / 0.18, 2));
      const side = tt < 1.2 ? -1 : 1;
      armL.rotation.x = lerp(armL.rotation.x, tt > 0 ? -1.5 - tap(0.6) * 0.5 - tap(1.8) * 0.5 : -0.3, 0.12);
      armL.rotation.z = lerp(armL.rotation.z, tt > 0 ? side * 0.45 : 0, 0.08);
      for (const c of [0.6, 1.8]) if (tt >= c && tt - dt < c) {
        sfx.thud(c < 1 ? -0.4 : 0.4);
        sfx.chime();
        const p = new THREE.Vector3(c < 1 ? 0.35 : -0.35, 1.5, 0.9);
        for (let i = 0; i < 18; i++) {
          const cf = this.confetti[(this.taps * 18 + i) % this.confetti.length];
          cf.m.visible = true; cf.m.position.copy(p); cf.v.set(rand(-1.5, 1.5), rand(0.5, 2.5), rand(-1, 1)); cf.w.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
        }
        this.taps++;
      }
      if (tt > 2.7) { this.phase = 'rise'; this.t = 0; this.sword.visible = false; }
    } else if (this.phase === 'rise') {
      this.kneel = Math.max(0, this.kneel - dt * 2.5);
      armL.rotation.x = lerp(armL.rotation.x, -0.2, 0.1);
      armL.rotation.z = lerp(armL.rotation.z, 0, 0.1);
      if (this.t > 0.6) { this.phase = 'talk'; this.t = 0; this.say(3); }
    } else {
      L.body.position.y = lerp(L.body.position.y, 0, 0.2);
      L.legs.forEach((l) => { l.rotation.x = lerp(l.rotation.x, 0, 0.2); });
      L.neck.rotation.y = Math.sin(time * 1.5) * 0.12;
      if (this.phase === 'present') {
        armL.rotation.x = lerp(armL.rotation.x, -1.3, 0.08);
        armR.rotation.x = lerp(armR.rotation.x, -2.4, 0.06);
      } else {
        armL.rotation.x = lerp(armL.rotation.x, -0.4 + Math.sin(time * 4) * 0.25, 0.1);
        armR.rotation.x = lerp(armR.rotation.x, -0.5, 0.1);
      }
    }
    // avatar pose (kneeling)
    if (P) {
      const k = this.kneel;
      P.root.position.y = -k * 0.42;
      P.legs[0].rotation.x = -k * 1.45;
      P.legs[1].rotation.x = k * 0.2;
      P.neck.rotation.x = k * 0.35;
      const cheer = this.phase === 'present';
      P.body.position.y = cheer ? Math.abs(Math.sin(time * 6)) * 0.12 : 0;
      P.arms.forEach((arm, i) => {
        const sgn = i === 0 ? -1 : 1;
        arm.rotation.z = lerp(arm.rotation.z, cheer ? sgn * (2.5 + Math.sin(time * 6 + i) * 0.2) : sgn * 0.05, 0.12);
        arm.rotation.x = lerp(arm.rotation.x, k * -0.3, 0.1);
      });
    }
    // the scroll
    const show = this.phase === 'present';
    this.paper.visible = show;
    if (show) {
      const hand = new THREE.Vector3();
      armL.getWorldPosition(hand);
      this.paper.position.set(hand.x + 0.1, 1.55, hand.z + 0.75);
      this.paper.rotation.set(-0.2, 0.25, 0);
      this.paper.scale.setScalar(clamp(this.t / 0.4, 0.01, 1));
    }
    for (const c of this.confetti) {
      if (!c.m.visible) continue;
      c.v.y -= dt * (c.v.y > -1.2 ? 3 : 0);
      c.m.position.addScaledVector(c.v, dt);
      c.m.position.x += Math.sin(time * 3 + c.w.x) * dt * 0.3;
      c.m.rotation.x += c.w.x * dt; c.m.rotation.y += c.w.y * dt;
      if (c.m.position.y < 0.05) { c.m.position.y = 0.05; c.v.set(0, 0, 0); c.w.set(0, 0, 0); }
    }
  }
}
