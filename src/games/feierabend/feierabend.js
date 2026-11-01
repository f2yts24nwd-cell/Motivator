import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, roundRect, rand, clamp, lerp, easeOutBack } from '../../core/gfx.js';
import { sfx, music, unlockAudio, isMuted, setMuted } from '../../core/audio.js';
import { h, mount, clearUI, storeGet, storeSet } from '../../core/ui.js';
import { buildTarget } from '../whack/targets.js';
import { Effects } from '../whack/effects.js';
import {
  TOOLS, TOOL, TASKS, LASSEN, LEGACY, QUOTE_LASSEN, TIM, BRIEFING_LINES,
  rankForFb, iconSVG, loadIcon
} from './content.js';

// "Rettet den Feierabend!" – tasks rush down a neon data highway towards Tim X.'s deadline.
// Pick the right itmX tool for each one before it lands on the paper stack.

export const DAY_TIME = 90; // seconds for 09:00 → 17:30
const DAY_START = 9 * 60, DAY_END = 17 * 60 + 30;
const Z_SPAWN = -34, Z_DEAD = 2.6;
const MAX_STACK = 5;
const BRIEFING_AT = 24; // seconds into the day (about 11:00)
const EXTRA_TIME = 10;
const CARD_W = 2.5, CARD_H = 1.4;
const BASE = import.meta.env.BASE_URL;

const LAYOUTS = {
  landscape: { lanes: [-3.6, 0, 3.6], cardScale: 1.25, fov: 44 },
  portrait: { lanes: [-2.3, 0, 2.3], cardScale: 0.92, fov: 64 }
};

const fmtClock = (min) => `${String(Math.floor(min / 60)).padStart(2, '0')}:${String(Math.floor(min % 60)).padStart(2, '0')}`;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

export class FeierabendGame {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 220);
    this.camBase = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.items = [];
    this.fruits = [];
    this.bolts = [];
    this.sheets = [];
    this.flying = [];
    this.legacyPool = {};
    this.state = 'idle';
    this.speed = 1;
    this.layoutName = null;
    this.icons = {};
    this.buildWorld();
    this.effects = new Effects(this.scene, 0);
    this.effects.bounds = { x: 60, z: 120 };
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onKey = this.onKey.bind(this);
    this.iconsReady = Promise.all(TOOLS.map(async (t) => { this.icons[t.id] = await loadIcon(t.id, '#ffffff'); }));
    loadIcon('hourglass', '#ffcc4d').then((img) => { this.lassenImg = img; });
  }

  // ================================================================== world
  buildWorld() {
    const s = this.scene;
    this.bg = new THREE.Color(0x0a0716);
    s.background = this.bg;
    s.fog = new THREE.Fog(0x0a0716, 26, 62);
    s.environment = this.app.gfx.envMap;
    s.environmentIntensity = 0.5;

    s.add(new THREE.HemisphereLight(0x9ab8ff, 0x200a24, 0.7));
    const key = new THREE.DirectionalLight(0xfff0e0, 2.2);
    key.position.set(-6, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 });
    key.target.position.set(0, 0, -3);
    key.shadow.bias = -0.0005;
    s.add(key, key.target);
    const rimA = new THREE.SpotLight(0x19c3ff, 90, 50, 0.7, 0.6);
    rimA.position.set(-12, 9, -8);
    const rimB = new THREE.SpotLight(0xff3d9a, 90, 50, 0.7, 0.6);
    rimB.position.set(12, 9, -8);
    s.add(rimA, rimB);
    this.dangerLight = new THREE.PointLight(0xff2040, 0, 12, 2);
    this.dangerLight.position.set(0, 2, Z_DEAD);
    s.add(this.dangerLight);

    // ---- data highway floor (scrolling neon grid)
    this.floorTex = canvasTexture(512, 512, (g, w, hh) => {
      g.fillStyle = '#07060f'; g.fillRect(0, 0, w, hh);
      g.strokeStyle = 'rgba(255,61,154,0.55)'; g.lineWidth = 3;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, hh); g.stroke(); }
      g.strokeStyle = 'rgba(25,195,255,0.45)';
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
      g.fillStyle = 'rgba(25,195,255,0.08)';
      for (let i = 0; i < 70; i++) g.fillRect(Math.random() * w, Math.random() * hh, 3, 14);
    });
    this.floorTex.wrapS = this.floorTex.wrapT = THREE.RepeatWrapping;
    this.floorTex.repeat.set(14, 28);
    const floor = new THREE.Mesh(
      new THREE.PlaneGeometry(56, 112),
      new THREE.MeshStandardMaterial({ map: this.floorTex, emissiveMap: this.floorTex, emissive: new THREE.Color(0.9, 0.9, 1.2), roughness: 0.35, metalness: 0.4 })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -30;
    floor.receiveShadow = true;
    s.add(floor);

    // ---- lane rails and deadline
    this.railMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.8, 2.6), toneMapped: false });
    this.rails = [];
    for (let i = 0; i < 4; i++) {
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.04, Z_DEAD - Z_SPAWN + 4), this.railMat);
      r.position.set(0, 0.03, (Z_SPAWN + Z_DEAD) / 2 - 2);
      s.add(r);
      this.rails.push(r);
    }
    this.deadMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.3, 0.6), toneMapped: false });
    this.deadline = new THREE.Mesh(new THREE.BoxGeometry(12, 0.08, 0.16), this.deadMat);
    this.deadline.position.set(0, 0.05, Z_DEAD);
    s.add(this.deadline);
    const deadTex = canvasTexture(1024, 128, (g, w, hh) => {
      g.font = `900 78px ${FONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ff6b8a';
      g.shadowColor = '#ff2050'; g.shadowBlur = 20;
      g.fillText('◆  D E A D L I N E  ◆', w / 2, hh / 2);
    });
    this.deadLabel = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.75), new THREE.MeshBasicMaterial({ map: deadTex, transparent: true, depthWrite: false, toneMapped: false }));
    this.deadLabel.rotation.x = -Math.PI / 2;
    this.deadLabel.position.set(0, 0.06, Z_DEAD + 0.75);
    s.add(this.deadLabel);

    // ---- neon arches rushing towards the player (speed feeling)
    this.arches = [];
    const archGeoV = new THREE.BoxGeometry(0.1, 4.6, 0.1);
    const archGeoH = new THREE.BoxGeometry(1, 0.1, 0.1);
    this.archMats = [
      new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 0.25, 0.9), toneMapped: false, transparent: true }),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.1, 1.7), toneMapped: false, transparent: true })
    ];
    for (let i = 0; i < 7; i++) {
      const g = new THREE.Group();
      const m = this.archMats[i % 2];
      const l = new THREE.Mesh(archGeoV, m), r = new THREE.Mesh(archGeoV, m), top = new THREE.Mesh(archGeoH, m);
      g.add(l, r, top);
      g.userData = { l, r, top };
      g.position.z = Z_DEAD - 3 - i * 5.5;
      s.add(g);
      this.arches.push(g);
    }

    // ---- skyline + sky (tinted from morning to evening)
    const sky = canvasTexture(2048, 900, (g, w, hh) => {
      const grd = g.createLinearGradient(0, 0, 0, hh);
      grd.addColorStop(0, '#ffffff'); grd.addColorStop(1, '#ffffff');
      g.fillStyle = grd; g.fillRect(0, 0, w, hh);
      let x = 0;
      while (x < w) {
        const bw = rand(50, 150), bh = rand(180, 640);
        g.fillStyle = `hsl(${rand(230, 270)}, 35%, ${rand(5, 12)}%)`;
        g.fillRect(x, hh - bh, bw, bh);
        for (let yy = hh - bh + 12; yy < hh - 10; yy += 18) {
          for (let xx = x + 8; xx < x + bw - 8; xx += 14) {
            if (Math.random() < 0.33) { g.fillStyle = Math.random() < 0.75 ? '#ffd27a' : '#7fe3ff'; g.fillRect(xx, yy, 7, 9); }
          }
        }
        x += bw + rand(4, 20);
      }
    });
    this.skyMat = new THREE.MeshBasicMaterial({ map: sky, fog: false });
    const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(150, 66), this.skyMat);
    skyMesh.position.set(0, 18, -70);
    s.add(skyMesh);
    // sun / moon disc behind the skyline
    this.sun = new THREE.Mesh(new THREE.CircleGeometry(6, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 1.6, 0.6), toneMapped: false, fog: false }));
    this.sun.position.set(-20, 30, -71);
    s.add(this.sun);

    // ---- giant wall clock
    const face = canvasTexture(512, 512, (g, w) => {
      const c = w / 2;
      g.fillStyle = '#0e1226'; g.beginPath(); g.arc(c, c, 250, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#ff3d9a'; g.lineWidth = 12; g.shadowColor = '#ff3d9a'; g.shadowBlur = 24;
      g.beginPath(); g.arc(c, c, 236, 0, Math.PI * 2); g.stroke();
      g.shadowBlur = 0;
      for (let i = 0; i < 60; i++) {
        const a = (i / 60) * Math.PI * 2, big = i % 5 === 0;
        g.strokeStyle = big ? '#ffffff' : 'rgba(255,255,255,0.4)'; g.lineWidth = big ? 10 : 4;
        g.beginPath(); g.moveTo(c + Math.sin(a) * (big ? 180 : 200), c - Math.cos(a) * (big ? 180 : 200)); g.lineTo(c + Math.sin(a) * 218, c - Math.cos(a) * 218); g.stroke();
      }
      g.fillStyle = '#ffcc4d'; g.font = `900 46px ${FONT}`; g.textAlign = 'center';
      g.fillText('FEIERABEND', c, c + 110);
    });
    const clock = new THREE.Group();
    clock.add(new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshBasicMaterial({ map: face, color: new THREE.Color(1.3, 1.3, 1.3), toneMapped: false })));
    const handMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.5, 2.5, 2.5), toneMapped: false });
    const mkHand = (len, wid) => {
      const p = new THREE.Group();
      const m = new THREE.Mesh(new THREE.BoxGeometry(wid, len, 0.05), handMat);
      m.position.y = len / 2 - 0.3;
      p.add(m);
      p.position.z = 0.05;
      clock.add(p);
      return p;
    };
    this.hourHand = mkHand(2.2, 0.28);
    this.minHand = mkHand(3.2, 0.16);
    clock.position.set(13, 12, -40);
    s.add(clock);
    this.clock3d = clock;

    // ---- neon title + buzzword ticker
    const neon = canvasTexture(1400, 220, (g, w, hh) => {
      g.font = `900 132px ${FONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#ff3d9a'; g.shadowBlur = 34;
      g.fillStyle = '#ffd0ea';
      g.fillText('RETTET DEN FEIERABEND!', w / 2, hh / 2);
    });
    this.sign = new THREE.Mesh(new THREE.PlaneGeometry(22, 3.45), new THREE.MeshBasicMaterial({ map: neon, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(2, 2, 2) }));
    this.sign.position.set(-2, 14.5, -42);
    s.add(this.sign);
    const tick = canvasTexture(2048, 128, (g, w, hh) => {
      g.fillStyle = 'rgba(10,6,24,0.85)'; g.fillRect(0, 0, w, hh);
      g.font = `800 64px ${FONT}`; g.textBaseline = 'middle';
      g.fillStyle = '#ffcc4d'; g.shadowColor = '#ffcc4d'; g.shadowBlur = 16;
      g.fillText('LOW HANGING FRUITS  ✦  DIE EXTRA MEILE  ✦  DAS EINE NICHT TUN, DAFÜR DAS ANDERE LASSEN  ✦', 20, hh / 2 + 4);
    });
    tick.wrapS = THREE.RepeatWrapping;
    this.ticker = tick;
    const tickMesh = new THREE.Mesh(new THREE.PlaneGeometry(40, 2.5), new THREE.MeshBasicMaterial({ map: tick, toneMapped: false, color: new THREE.Color(1.5, 1.5, 1.5) }));
    tickMesh.position.set(0, 10.8, -44);
    tick.repeat.set(0.85, 1);
    s.add(tickMesh);

    // ---- floating data motes
    const N = 260;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = rand(-20, 20); pos[i * 3 + 1] = rand(0.3, 14); pos[i * 3 + 2] = rand(-50, 6); }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dot = canvasTexture(32, 32, (g, w) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, '#fff'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
    this.motes = new THREE.Points(pg, new THREE.PointsMaterial({ map: dot, size: 0.18, color: 0x9fe8ff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(this.motes);

    // ---- paper stack (desk + growing pile)
    this.stack = new THREE.Group();
    const deskMat = new THREE.MeshPhysicalMaterial({ color: 0x1b2238, metalness: 0.6, roughness: 0.3, clearcoat: 1 });
    const desk = new THREE.Mesh(new RoundedBoxGeometry(2.2, 0.16, 1.6, 3, 0.05), deskMat);
    desk.position.y = 1.0;
    desk.castShadow = desk.receiveShadow = true;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 1.0, 16), deskMat);
    leg.position.y = 0.5;
    const glowRing = new THREE.Mesh(new THREE.TorusGeometry(1.0, 0.04, 8, 48), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.6, 0.4, 1.4), toneMapped: false }));
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.02;
    this.stack.add(desk, leg, glowRing);
    this.pile = new THREE.Group();
    this.pile.position.y = 1.08;
    this.stack.add(this.pile);
    s.add(this.stack);
    this.paperGeo = new THREE.BoxGeometry(1.35, 0.025, 0.95);
    this.paperMat = new THREE.MeshStandardMaterial({ color: 0xc9c2ae, roughness: 1 });

    // ---- shared card geometry/materials
    this.cardGeo = new RoundedBoxGeometry(CARD_W, CARD_H, 0.14, 3, 0.1);
    this.faceGeo = new THREE.PlaneGeometry(CARD_W - 0.08, CARD_H - 0.08);
    this.glowTex = canvasTexture(256, 160, (g, w, hh) => {
      g.filter = 'blur(14px)';
      g.fillStyle = '#fff';
      roundRect(g, 26, 26, w - 52, hh - 52, 18);
      g.fill();
    });
    this.glowGeo = new THREE.PlaneGeometry(CARD_W * 1.35, CARD_H * 1.55);
    this.barGeo = new THREE.BoxGeometry(CARD_W - 0.2, 0.08, 0.06);

    // ---- low hanging fruit
    this.fruitGeo = new THREE.SphereGeometry(0.34, 32, 24);
    this.fruitMat = new THREE.MeshPhysicalMaterial({ color: 0xffc21a, emissive: 0xff8a00, emissiveIntensity: 0.55, metalness: 0.3, roughness: 0.2, clearcoat: 1 });
    this.leafMat = new THREE.MeshStandardMaterial({ color: 0x50af30, emissive: 0x1f6a10, emissiveIntensity: 0.4 });
    this.stringMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.6, 1.4, 0.6), toneMapped: false });
    const fl = canvasTexture(512, 96, (g, w, hh) => {
      g.font = `900 52px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.lineWidth = 8; g.strokeStyle = 'rgba(40,20,0,0.85)'; g.strokeText('LOW HANGING FRUIT', w / 2, hh / 2);
      g.fillStyle = '#ffd34d'; g.fillText('LOW HANGING FRUIT', w / 2, hh / 2);
    });
    this.fruitLabelMat = new THREE.SpriteMaterial({ map: fl, transparent: true, depthWrite: false, toneMapped: false });

    this.applyLayout('landscape');
  }

  applyLayout(name) {
    if (this.layoutName === name) return;
    this.layoutName = name;
    this.L = LAYOUTS[name];
    const lanes = this.L.lanes;
    const gap = lanes[1] - lanes[0];
    const edges = [lanes[0] - gap / 2, lanes[0] + gap / 2, lanes[1] + gap / 2, lanes[2] + gap / 2];
    this.rails.forEach((r, i) => { r.position.x = edges[i]; });
    this.halfW = edges[3];
    const archW = this.halfW * 2 + 1.2;
    for (const a of this.arches) {
      a.userData.l.position.set(-archW / 2, 2.3, 0);
      a.userData.r.position.set(archW / 2, 2.3, 0);
      a.userData.top.scale.x = archW;
      a.userData.top.position.set(0, 4.6, 0);
    }
    this.deadline.scale.x = (this.halfW * 2 + 0.6) / 12;
    this.deadLabel.scale.setScalar(name === 'portrait' ? 0.75 : 1);
    this.stack.position.set(this.halfW + (name === 'portrait' ? 0.4 : 1.5), 0, Z_DEAD - (name === 'portrait' ? 3.2 : 2.4));
    this.stack.scale.setScalar(name === 'portrait' ? 0.7 : 1);
  }

  // ================================================================== lifecycle
  enter() {
    this.resize(window.innerWidth, window.innerHeight);
    const c = this.app.gfx.renderer.domElement;
    c.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKey);
    this.best = storeGet('feierabend-best', 0);
    this.prewarm();
    this.resetWorld();
    this.showIntro();
    music.play('techno');
    music.setIntensity(-1);
  }

  exit() {
    const c = this.app.gfx.renderer.domElement;
    c.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKey);
    this.state = 'idle';
    this.resetWorld();
    clearUI();
    clearTimeout(this.timTimer);
    clearInterval(this.typer);
    document.body.classList.remove('fb-briefing', 'fb-extra');
  }

  resize(w, hgt) {
    const aspect = w / hgt;
    const portrait = aspect < 0.9;
    this.applyLayout(portrait ? 'portrait' : 'landscape');
    this.camera.aspect = aspect;
    this.camera.fov = this.L.fov;
    // the tool belt covers the bottom of the screen: frame the highway so the deadline
    // sits just above it, with the whole track and the neon sign behind in view
    if (portrait) {
      this.camBase.set(0, 10.5, Z_DEAD + 9.5);
      this.camLook.set(0, 0, Z_DEAD - 9);
    } else {
      const short = hgt < 500;
      this.camBase.set(0, short ? 8.4 : 8.2, Z_DEAD + (short ? 6.6 : 7.4));
      this.camLook.set(0, short ? -1.4 : -0.6, Z_DEAD - 9);
    }
    this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camLook);
  }

  prewarm() {
    if (this.warmed) return;
    this.warmed = true;
    const far = new THREE.Vector3(300, -50, 0);
    for (const type of LEGACY) {
      const t = this.getLegacy(type);
      t.group.position.copy(far);
      t.group.visible = true;
    }
    this.effects.warmup(LEGACY.map((type) => this.legacyPool[type][0]));
    this.effects.shatter({ colors: [0xffffff, 0x19c3ff], goo: 0x19c3ff, cells: true }, far);
    this.app.gfx.renderer.compile(this.scene, this.camera);
    for (const type of LEGACY) for (const t of this.legacyPool[type]) { t.group.visible = false; t.busy = false; }
    this.effects.clear();
  }

  getLegacy(type) {
    const pool = (this.legacyPool[type] ||= []);
    let t = pool.find((x) => !x.busy);
    if (!t) {
      t = buildTarget(type);
      t.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(t.group);
      pool.push(t);
    }
    t.busy = true;
    return t;
  }

  resetWorld() {
    for (const it of this.items) this.disposeItem(it);
    this.items.length = 0;
    for (const f of this.fruits) this.scene.remove(f.group);
    this.fruits.length = 0;
    for (const b of this.bolts) this.scene.remove(b.sprite);
    this.bolts.length = 0;
    for (const p of this.flying) this.scene.remove(p.mesh);
    this.flying.length = 0;
    this.clearPile();
    this.effects?.clear();
    this.dangerLight.intensity = 0;
    this.extra = 0;
    this.applyExtraLook(false);
  }

  clearPile() {
    for (const m of this.sheets) this.pile.remove(m);
    this.sheets.length = 0;
  }

  // ================================================================== UI
  baseUI() {
    clearUI();
    mount(h('button.icon-btn.left', { title: 'Zurück zur Spielewelt', onclick: () => { sfx.click(); this.app.goHub(); } }, '⟵'));
    const mute = mount(h('button.icon-btn.right', { title: 'Ton an/aus', onclick: () => { setMuted(!isMuted()); mute.textContent = isMuted() ? '🔇' : '🔊'; } }, isMuted() ? '🔇' : '🔊'));
  }

  showIntro() {
    this.state = 'intro';
    this.baseUI();
    const toolChips = TOOLS.map((t) => h('span.fb-chip', { style: `--c:${t.color}`, html: `${iconSVG(t.id, t.color, 2)}<em>${t.name}</em>` }));
    mount(h('div.overlay', {}, h('div.card.panel.fb-intro', {}, [
      h('div.fb-introhead', {}, [
        h('img.fb-tim', { src: `${BASE}game2/tim-x.png`, alt: 'Tim X.' }),
        h('div', {}, [h('div.kicker', {}, 'Spiel 2 · Ein Tag im Leben von Tim X.'), h('h1', {}, 'Rettet den Feierabend!')])
      ]),
      h('p', {}, 'Von 09:00 bis 17:30 rasen Aufgaben auf dich zu. Wähle für jede das richtige itmX-Werkzeug, bevor sie die Deadline erreicht. Alles, was durchrutscht, landet als Papier auf dem Stapel. Bei 5 Stapeln kippt er um.'),
      h('div.fb-chips', {}, toolChips),
      h('div.legend.fb-legend', {}, [
        h('div', {}, [h('b', {}, '🍏 Low Hanging Fruits'), 'Goldene Früchte direkt antippen: schnelle Bonus-Minuten.']),
        h('div', {}, [h('b', {}, '🏁 Die Extra Meile'), 'Lange Combo = Extra Meile: doppelte Minuten und volle Beats.']),
        h('div', {}, [h('b', {}, '⏳ Zeitfresser'), `„${QUOTE_LASSEN}“ Was das heißt, erklärt dir Tim X. um 11:00.`])
      ]),
      this.best ? h('p', {}, `Dein Rekord: ${this.best} Minuten gespart`) : null,
      h('div.row', {}, [h('button.btn', { onclick: () => { unlockAudio(); sfx.click(); this.startCountdown(); } }, '▶ Arbeitstag starten')])
    ])));
  }

  buildHUD() {
    this.baseUI();
    const stat = (cls, label) => {
      const strong = h('strong', {}, '0');
      return { el: h(`div.stat.panel.${cls}`, {}, [h('small', {}, label), strong]), strong };
    };
    this.hud = { clock: stat('time', 'Uhrzeit'), score: stat('score', 'Min. gespart'), combo: stat('combo', 'Combo'), stack: stat('errors', 'Papier') };
    mount(h('div.hud.passthrough', {}, Object.values(this.hud).map((s) => s.el)));
    this.dayBar = h('i');
    this.dayEl = mount(h('div.goal.passthrough', {}, [this.dayBar]));
    // Tim X. with his comments
    this.timText = h('span');
    this.timEl = mount(h('div.fb-timbox.passthrough', {}, [h('img', { src: `${BASE}game2/tim-x.png`, alt: '' }), this.timText]));
    // tool belt
    this.toolBtns = {};
    const belt = h('div.fb-belt', {}, TOOLS.map((t, i) => {
      const b = h('button.fb-tool', {
        style: `--c:${t.color}`,
        title: `${t.name} (Taste ${i + 1})`,
        onpointerdown: (e) => { e.preventDefault(); this.useTool(t.id); }
      }, [h('span.fb-ico', { html: iconSVG(t.id, '#ffffff', 1.9) }), h('span.fb-name', {}, t.name), h('kbd', {}, String(i + 1))]);
      this.toolBtns[t.id] = b;
      return b;
    }));
    mount(belt);
    // the targeted task, big and readable above the belt
    this.focusWho = h('small');
    this.focusWhat = h('strong');
    this.focusBar = h('i');
    this.focusEl = mount(h('div.fb-focus.panel.passthrough', {}, [this.focusWho, this.focusWhat, h('div.fb-fbar', {}, this.focusBar)]));
    this.focusIt = undefined;
    this.updateHUD();
  }

  updateHUD() {
    if (!this.hud) return;
    const min = DAY_START + (DAY_END - DAY_START) * clamp(this.elapsed / DAY_TIME, 0, 1);
    this.hud.clock.strong.textContent = fmtClock(min);
    this.hud.clock.el.classList.toggle('low', this.elapsed > DAY_TIME - 12 && this.state === 'play');
    this.hud.score.strong.textContent = String(this.score);
    this.hud.combo.strong.textContent = this.extra > 0 ? `x${this.multiplier()} 🏁` : `x${this.multiplier()}`;
    this.hud.stack.strong.textContent = '▮'.repeat(this.stackCount) + '▯'.repeat(Math.max(0, MAX_STACK - this.stackCount));
    this.hud.stack.strong.style.color = this.stackCount >= 3 ? 'var(--bad)' : '';
    this.dayBar.style.width = `${clamp(this.elapsed / DAY_TIME, 0, 1) * 100}%`;
    this.dayEl.classList.toggle('reached', this.extra > 0);
  }

  tim(text, ms = 2200) {
    if (!this.timEl) return;
    this.timText.textContent = text;
    this.timEl.classList.add('on');
    clearTimeout(this.timTimer);
    this.timTimer = setTimeout(() => this.timEl?.classList.remove('on'), ms);
  }

  popup(worldPos, text, cls) {
    const v = worldPos.clone().project(this.camera);
    const el = mount(h(`div.popup.${cls}`, {}, text));
    el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    setTimeout(() => el.remove(), 950);
  }

  banner(big, small, cls = '') {
    document.querySelector('.fb-banner')?.remove();
    const el = mount(h(`div.fb-banner.passthrough${cls}`, {}, [h('b', {}, big), small ? h('span', {}, small) : null]));
    setTimeout(() => el.remove(), 2200);
  }

  // ================================================================== flow
  startCountdown() {
    this.score = 0; this.combo = 0; this.bestCombo = 0; this.solved = 0; this.missed = 0;
    this.stackCount = 0; this.elapsed = 0; this.spawnTimer = 1.2; this.fruitTimer = rand(7, 10);
    this.extra = 0; this.extraCount = 0; this.nextExtraAt = 6; this.fruitsPicked = 0;
    this.lassenOk = 0; this.lassenBad = 0; this.legacyKilled = 0; this.briefed = false;
    this.used = {};
    this.selected = null;
    this.resetWorld();
    this.buildHUD();
    this.state = 'countdown';
    music.play('techno');
    music.setIntensity(-1);
    const cd = mount(h('div.countdown.passthrough'));
    let n = 3;
    const tick = () => {
      if (this.state !== 'countdown') { cd.remove(); return; }
      cd.replaceChildren(h('span', {}, n > 0 ? String(n) : '09:00!'));
      sfx.beep(n === 0);
      if (n === 0) {
        this.state = 'play';
        music.setIntensity(0);
        sfx.drop();
        this.tim(TIM.start);
        setTimeout(() => cd.remove(), 800);
        return;
      }
      n--;
      setTimeout(tick, 650);
    };
    tick();
  }

  multiplier() {
    const m = Math.min(4, 1 + Math.floor(this.combo / 4));
    return this.extra > 0 ? m * 2 : m;
  }

  difficulty() {
    const p = clamp(this.elapsed / DAY_TIME, 0, 1);
    return {
      interval: lerp(2.5, 1.0, p),
      life: lerp(9.5, 5.0, p),
      maxActive: 2 + Math.floor(p * 2.6),
      legacy: 0.15 + p * 0.08,
      lassen: this.briefed ? 0.15 : 0
    };
  }

  // ================================================================== spawning
  spawn(kind) {
    const d = this.difficulty();
    if (!kind) {
      const r = Math.random();
      kind = r < d.lassen ? 'lassen' : r < d.lassen + d.legacy ? 'legacy' : 'task';
    }
    // pick a lane whose last item already moved on
    const lanes = [0, 1, 2].filter((l) => !this.items.some((it) => it.lane === l && it.k < 0.3));
    if (!lanes.length) return false;
    const lane = pick(lanes);
    const it = { kind, lane, k: 0, life: d.life * (kind === 'legacy' ? 0.85 : 1) * rand(0.92, 1.08), state: 'fly', t: 0, jitter: 0 };
    if (kind === 'legacy') {
      it.target = this.getLegacy(pick(LEGACY));
      it.tool = 'trash';
      it.obj = it.target.group;
      it.obj.visible = true;
      it.obj.scale.setScalar(0.8 * this.L.cardScale);
      it.color = it.target.goo;
    } else {
      const def = kind === 'lassen' ? { tool: null, who: LASSEN.who, what: LASSEN.what } : pick(TASKS.filter((t) => !this.items.some((x) => x.def === t)));
      it.def = def;
      it.tool = def.tool;
      it.text = pick(def.what);
      this.buildCard(it);
    }
    this.items.push(it);
    this.placeItem(it, 0);
    sfx.pop();
    return true;
  }

  buildCard(it) {
    const lassen = it.kind === 'lassen';
    const accent = lassen ? '#ffcc4d' : '#7fdcff';
    const minute = DAY_START + (DAY_END - DAY_START) * clamp(this.elapsed / DAY_TIME, 0, 1);
    const tex = canvasTexture(640, 358, (g, w, hh) => {
      const bg = g.createLinearGradient(0, 0, 0, hh);
      bg.addColorStop(0, lassen ? '#3a2a0e' : '#15224a');
      bg.addColorStop(1, lassen ? '#1c1306' : '#0a1024');
      g.fillStyle = bg;
      roundRect(g, 0, 0, w, hh, 30); g.fill();
      g.strokeStyle = accent; g.lineWidth = 8;
      roundRect(g, 6, 6, w - 12, hh - 12, 26); g.stroke();
      // header
      g.fillStyle = accent;
      g.font = `800 34px ${FONT}`;
      g.textBaseline = 'middle';
      g.fillText(it.def.who.toUpperCase(), 40, 56);
      g.textAlign = 'right';
      g.fillStyle = 'rgba(255,255,255,0.6)';
      g.font = `700 30px ${FONT}`;
      g.fillText(fmtClock(minute), w - 36, 56);
      g.textAlign = 'left';
      if (lassen) {
        // hourglass marks the Zeitfresser
        const img = this.lassenImg;
        if (img) g.drawImage(img, w - 118, hh - 112, 80, 80);
      }
      // body text (wrapped, auto-sized)
      const words = it.text.split(' ');
      let size = 58, lines;
      for (;;) {
        g.font = `800 ${size}px ${FONT}`;
        lines = [];
        let line = '';
        for (const wd of words) {
          const test = line ? `${line} ${wd}` : wd;
          if (g.measureText(test).width > w - (lassen ? 170 : 80) && line) { lines.push(line); line = wd; } else line = test;
        }
        lines.push(line);
        if (lines.length <= 3 || size <= 36) break;
        size -= 4;
      }
      g.fillStyle = '#ffffff';
      const top = 110 + (3 - lines.length) * size * 0.45;
      lines.forEach((l, i) => g.fillText(l, 40, top + i * size * 1.12 + size / 2));
    });
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: lassen ? 0x2a1d08 : 0x0d1430, metalness: 0.4, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.1 });
    const body = new THREE.Mesh(this.cardGeo, bodyMat);
    body.castShadow = true;
    const faceMat = new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.15, 1.15, 1.15) });
    const face = new THREE.Mesh(this.faceGeo, faceMat);
    face.position.z = 0.075;
    const glowMat = new THREE.MeshBasicMaterial({ map: this.glowTex, color: new THREE.Color(accent).multiplyScalar(1.6), transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
    const glow = new THREE.Mesh(this.glowGeo, glowMat);
    glow.position.z = -0.12;
    const barMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.2, 0.8), toneMapped: false });
    const bar = new THREE.Mesh(this.barGeo, barMat);
    bar.position.set(0, -CARD_H / 2 - 0.16, 0.02);
    group.add(glow, body, face, bar);
    group.scale.setScalar(this.L.cardScale);
    this.scene.add(group);
    Object.assign(it, { obj: group, body, face, glow, bar, tex, color: new THREE.Color(accent).getHex() });
  }

  disposeItem(it) {
    if (it.kind === 'legacy') {
      it.obj.visible = false;
      it.target.busy = false;
      return;
    }
    this.scene.remove(it.obj);
    it.tex?.dispose();
    for (const m of [it.body, it.face, it.glow, it.bar]) m?.material.dispose();
  }

  placeItem(it, time) {
    const x = this.L.lanes[it.lane];
    const z = lerp(Z_SPAWN, Z_DEAD, it.k);
    const bob = Math.sin(time * 2.4 + it.lane * 2) * 0.08;
    const shake = it.jitter > 0 ? Math.sin(it.jitter * 80) * 0.18 * it.jitter * 3 : 0;
    if (it.kind === 'legacy') {
      it.obj.position.set(x + shake, 0.15 + bob, z);
      it.obj.rotation.set(-0.2, Math.sin(time * 1.5 + it.lane) * 0.5, Math.sin(time * 3) * 0.12);
    } else {
      const s = this.L.cardScale;
      it.obj.position.set(x + shake, 1.25 * s + 0.35 + bob, z);
      it.obj.rotation.set(-0.62, -x * 0.04, Math.sin(time * 1.7 + it.lane) * 0.03);
    }
  }

  spawnFruit() {
    const g = new THREE.Group();
    const fruit = new THREE.Mesh(this.fruitGeo, this.fruitMat);
    fruit.castShadow = true;
    const leaf = new THREE.Mesh(this.fruitGeo, this.leafMat);
    leaf.scale.set(0.35, 0.12, 0.2);
    leaf.position.set(0.14, 0.36, 0);
    leaf.rotation.z = -0.5;
    const string = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 9, 6), this.stringMat);
    string.position.y = 4.8;
    const label = new THREE.Sprite(this.fruitLabelMat);
    label.scale.set(2.4, 0.45, 1);
    label.position.set(0, 0.85, 0);
    const pivot = new THREE.Group();
    fruit.position.y = -0.0;
    g.add(string, fruit, leaf, label);
    pivot.add(g);
    const x = rand(-this.halfW + 0.6, this.halfW - 0.6);
    const z = rand(Z_DEAD - 9, Z_DEAD - 4);
    pivot.position.set(x, 0, z);
    this.scene.add(pivot);
    this.fruits.push({ group: pivot, inner: g, fruit, t: 0, life: 4.2, x, z, phase: rand(0, 6) });
    this.tim(TIM.fruit, 1800);
    sfx.chime();
  }

  // ================================================================== input
  setRay(e) {
    const r = this.app.gfx.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  onPointerDown(e) {
    if (this.state !== 'play') return;
    e.preventDefault();
    this.setRay(e);
    // fruits first (they are the quick win)
    const fhits = this.raycaster.intersectObjects(this.fruits.map((f) => f.fruit), false);
    if (fhits.length) { this.pickFruit(this.fruits.find((f) => f.fruit === fhits[0].object)); return; }
    // otherwise tapping a card selects it
    const objs = this.items.filter((it) => it.state === 'fly').map((it) => it.obj);
    const hits = this.raycaster.intersectObjects(objs, true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !objs.includes(o)) o = o.parent;
      const it = this.items.find((x) => x.obj === o);
      if (it) { this.selected = this.selected === it ? null : it; this.focusIt = undefined; sfx.click(); }
    } else {
      // generous fallback: nearest fruit within reach of the tap
      for (const f of this.fruits) {
        const p = f.fruit.getWorldPosition(new THREE.Vector3()).project(this.camera);
        if (Math.hypot(p.x - this.pointer.x, (p.y - this.pointer.y) / this.camera.aspect) < 0.09) { this.pickFruit(f); return; }
      }
    }
  }

  onKey(e) {
    if (this.state !== 'play') return;
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 9) this.useTool(TOOLS[n - 1].id);
  }

  pickFruit(f) {
    if (!f || f.picked) return;
    f.picked = true;
    const pos = f.fruit.getWorldPosition(new THREE.Vector3());
    const gain = 8 * (this.extra > 0 ? 2 : 1);
    this.score += gain;
    this.fruitsPicked++;
    this.effects.goo(pos.clone().setY(pos.y - 0.4), 0xffc21a);
    this.effects.sparks(pos, 0xffe08a, 30);
    this.effects.flash(pos, 0xffaa00, 50);
    this.effects.shake = Math.max(this.effects.shake, 0.3);
    sfx.fruit();
    this.popup(pos.clone().setY(pos.y + 1), `+${gain} Min · Low Hanging Fruit!`, 'combo');
    this.scene.remove(f.group);
    this.fruits.splice(this.fruits.indexOf(f), 1);
    this.updateHUD();
  }

  /** Target for a tool press: the selected card, otherwise the one closest to the deadline. */
  currentTarget() {
    const open = this.items.filter((it) => it.state === 'fly' && !it.locked);
    if (this.selected && open.includes(this.selected)) return this.selected;
    let best = null;
    for (const it of open) if (!best || it.k > best.k) best = it;
    return best;
  }

  useTool(id) {
    if (this.state !== 'play') return;
    const btn = this.toolBtns?.[id];
    if (btn) { btn.classList.remove('hit'); void btn.offsetWidth; btn.classList.add('hit'); }
    const it = this.currentTarget();
    if (!it) { sfx.click(); return; }
    const ok = it.tool === id;
    if (ok) it.locked = true;
    if (this.selected === it) this.selected = null;
    // fire a glowing bolt with the tool icon from the belt to the target
    const tool = TOOL[id];
    const sprite = new THREE.Sprite(this.boltMaterial(id));
    sprite.scale.setScalar(1.1);
    const from = new THREE.Vector3(0, -0.9, 0.5).unproject(this.camera);
    const btnRect = btn?.getBoundingClientRect();
    if (btnRect) {
      const nx = ((btnRect.left + btnRect.width / 2) / window.innerWidth) * 2 - 1;
      const ny = -((btnRect.top + btnRect.height / 2) / window.innerHeight) * 2 + 1;
      from.set(nx, ny, 0.6).unproject(this.camera);
    }
    sprite.position.copy(from);
    this.scene.add(sprite);
    this.bolts.push({ sprite, from, it, ok, id, t: 0, dur: 0.16, color: new THREE.Color(tool.color).getHex() });
    sfx.zap((this.L.lanes[it.lane] || 0) / 4);
  }

  boltMaterial(id) {
    this.boltMats ||= {};
    if (!this.boltMats[id]) {
      const tool = TOOL[id];
      const tex = canvasTexture(128, 128, (g, w) => {
        const r = g.createRadialGradient(w / 2, w / 2, 4, w / 2, w / 2, w / 2);
        r.addColorStop(0, tool.color); r.addColorStop(0.55, tool.color + 'aa'); r.addColorStop(1, 'rgba(0,0,0,0)');
        g.fillStyle = r; g.fillRect(0, 0, w, w);
        const img = this.icons[id];
        if (img) g.drawImage(img, 30, 30, 68, 68);
      });
      this.boltMats[id] = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color(1.8, 1.8, 1.8) });
    }
    return this.boltMats[id];
  }

  resolve(b) {
    const it = b.it;
    if (!this.items.includes(it) || it.state !== 'fly') return;
    const pos = it.obj.position.clone();
    const mult = this.multiplier();
    if (b.ok) {
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      this.solved++;
      this.used[b.id] = (this.used[b.id] || 0) + 1;
      if (it.kind === 'legacy') this.legacyKilled++;
      const base = it.kind === 'legacy' ? 3 : 3 + Math.round((1 - it.k) * 5);
      const gain = base * this.multiplier();
      this.score += gain;
      this.smash(it, pos, b.color);
      this.popup(pos.clone().setY(pos.y + 1.2), `+${gain} Min`, 'good');
      setTimeout(() => this.popup(pos.clone().setY(pos.y + 0.4), TOOL[b.id].name, 'combo'), 90);
      if (it.kind === 'legacy' && Math.random() < 0.5) this.tim(pick(TIM.legacy), 1500);
      if (this.combo === this.nextExtraAt && this.extra <= 0) this.startExtraMile();
      else if (this.combo > 0 && this.combo % 4 === 0 && mult < this.multiplier()) {
        sfx.combo(this.multiplier());
        this.popup(pos.clone().setY(pos.y + 2.1), `COMBO x${this.multiplier()}!`, 'combo');
      }
    } else if (it.kind === 'lassen') {
      // the Zeitfresser rule: some things you just leave alone
      this.combo = 0;
      this.lassenBad++;
      this.score = Math.max(0, this.score - 5);
      this.smash(it, pos, 0xffcc4d, true);
      this.popup(pos.clone().setY(pos.y + 1.2), '−5 Min', 'bad');
      this.banner(QUOTE_LASSEN, 'Zeitfresser einfach durchrauschen lassen!', '.gold');
      this.tim(TIM.lassenBad);
      sfx.error();
    } else {
      this.combo = 0;
      this.score = Math.max(0, this.score - 2);
      it.k = Math.min(0.97, it.k + 0.08);
      it.jitter = 0.35;
      this.effects.sparks(pos, 0xff3b5c, 14);
      this.popup(pos.clone().setY(pos.y + 1.2), '−2 Min · falsches Tool', 'bad');
      this.tim(pick(TIM.wrong), 1400);
      sfx.thud();
    }
    this.updateHUD();
  }

  smash(it, pos, color, soft = false) {
    it.state = 'gone';
    this.items.splice(this.items.indexOf(it), 1);
    if (this.selected === it) this.selected = null;
    const shardSrc = it.kind === 'legacy' ? it.target : { colors: [color, 0xffffff, 0x0d1430, it.color], goo: color, cells: true };
    this.effects.shatter(shardSrc, pos.clone().setY(Math.max(0.4, pos.y - 0.5)));
    this.effects.sparks(pos, 0xffffff, soft ? 12 : 30);
    this.effects.sparks(pos, color, soft ? 10 : 26);
    this.effects.shockwave(pos.clone().setY(0), color);
    this.effects.flash(pos, color, soft ? 40 : 90);
    this.effects.shake = Math.max(this.effects.shake, soft ? 0.4 : 0.6 + this.multiplier() * 0.06);
    this.hitStop = soft ? 0.03 : 0.06;
    sfx.smash(rand(0.95, 1.15), pos.x / 5);
    sfx.splat(pos.x / 5);
    this.disposeItem(it);
  }

  // ================================================================== events
  startExtraMile() {
    this.extra = EXTRA_TIME;
    this.extraCount++;
    this.nextExtraAt = this.combo + 12;
    sfx.drop();
    this.banner('DIE EXTRA MEILE!', 'Doppelte Minuten · volle Beats', '.extra');
    this.tim(TIM.extra);
    this.applyExtraLook(true);
    this.effects.shake = 1;
  }

  applyExtraLook(on) {
    this.archMats[0].color.set(on ? new THREE.Color(2.4, 1.6, 0.25) : new THREE.Color(1.6, 0.25, 0.9));
    this.archMats[1].color.set(on ? new THREE.Color(2.4, 1, 0.2) : new THREE.Color(0.2, 1.1, 1.7));
    this.railMat.color.set(on ? new THREE.Color(3, 2.2, 0.4) : new THREE.Color(0.3, 1.8, 2.6));
    document.body.classList.toggle('fb-extra', on);
  }

  /** Mid-morning: Tim X. explains the Zeitfresser rule (music breaks down, the quote drops). */
  startBriefing() {
    this.state = 'briefing';
    this.briefed = true;
    this.selected = null;
    document.body.classList.add('fb-briefing');
    music.setIntensity(-1);
    let i = -1;
    const text = h('span');
    const btn = h('button.btn.secondary', {}, 'Weiter …');
    const bubble = mount(h('div.speech.panel.fb-speech', {}, [
      h('div.fb-speaker', {}, [h('img', { src: `${BASE}game2/tim-x.png`, alt: '' }), h('b', {}, 'Tim X.')]),
      text,
      h('div.row', {}, btn)
    ]));
    const next = () => {
      i++;
      if (i >= BRIEFING_LINES.length) {
        bubble.remove();
        this.endBriefing();
        return;
      }
      const full = BRIEFING_LINES[i];
      const isQuote = full === QUOTE_LASSEN;
      bubble.classList.toggle('quote', isQuote);
      if (isQuote) { this.banner(`„${QUOTE_LASSEN}“`, 'Die goldene Regel für Zeitfresser', '.gold.quote'); sfx.drop(); }
      btn.textContent = i === BRIEFING_LINES.length - 1 ? 'Alles klar, weiter!' : 'Weiter …';
      let n = 0;
      clearInterval(this.typer);
      this.typer = setInterval(() => {
        n += 2;
        text.textContent = full.slice(0, n);
        if (n % 6 === 0) sfx.step();
        if (n >= full.length) clearInterval(this.typer);
      }, 24);
    };
    btn.addEventListener('click', () => { sfx.click(); next(); });
    setTimeout(next, 500);
    sfx.whoosh();
  }

  endBriefing() {
    sfx.riser(1.3);
    setTimeout(() => {
      document.body.classList.remove('fb-briefing');
      if (this.state !== 'briefing') return;
      this.state = 'play';
      sfx.drop();
      this.effects.shake = 0.8;
      music.setIntensity(2);
      this.spawn('lassen');
      this.spawnTimer = 0.9;
    }, 1300);
  }

  addToStack(it) {
    const n = 8;
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(this.paperGeo, this.paperMat);
      m.castShadow = true;
      m.position.set(rand(-0.12, 0.12), this.sheets.length * 0.03 + 0.02, rand(-0.1, 0.1));
      m.rotation.y = rand(-0.35, 0.35);
      m.rotation.z = rand(-0.03, 0.03);
      this.pile.add(m);
      this.sheets.push(m);
    }
    void it;
  }

  missItem(it) {
    it.state = 'tostack';
    it.t = 0;
    it.fromPos = it.obj.position.clone();
    if (this.selected === it) this.selected = null;
  }

  landOnStack(it) {
    this.items.splice(this.items.indexOf(it), 1);
    this.disposeItem(it);
    this.stackCount++;
    this.missed++;
    this.combo = 0;
    this.addToStack(it);
    const top = this.pile.localToWorld(new THREE.Vector3(0, this.sheets.length * 0.03, 0));
    this.effects.sparks(top, 0xfff3d0, 16);
    this.effects.shake = Math.max(this.effects.shake, 0.5);
    sfx.rustle();
    this.popup(top.clone().setY(top.y + 1), 'Papierstapel +1', 'bad');
    this.tim(this.stackCount === MAX_STACK - 1 ? TIM.stack : pick(TIM.miss), 1800);
    this.updateHUD();
    if (this.stackCount >= MAX_STACK) this.endGame('stack');
  }

  // ================================================================== end
  endGame(reason) {
    if (this.state !== 'play') return;
    this.state = 'over';
    this.extra = 0;
    this.applyExtraLook(false);
    for (const b of this.bolts) this.scene.remove(b.sprite);
    this.bolts.length = 0;
    this.updateHUD();
    document.querySelector('.fb-belt')?.remove();
    this.timEl?.classList.remove('on');
    if (this.score > this.best) { this.best = this.score; storeSet('feierabend-best', this.best); }
    const rank = rankForFb(this.score);
    if (reason === 'stack') {
      // paper avalanche: every sheet flies off the pile
      sfx.avalanche();
      music.stop(1.2);
      for (const m of this.sheets) {
        const wp = m.getWorldPosition(new THREE.Vector3());
        this.pile.remove(m);
        m.position.copy(wp);
        this.scene.add(m);
        this.flying.push({ mesh: m, v: new THREE.Vector3(rand(-6, 3), rand(4, 11), rand(-2, 5)), w: new THREE.Vector3(rand(-8, 8), rand(-8, 8), rand(-8, 8)), life: 3 });
      }
      this.sheets.length = 0;
      this.effects.shake = 1.4;
    } else {
      sfx.win();
      music.setIntensity(3);
      for (let i = 0; i < 10; i++) setTimeout(() => {
        const p = new THREE.Vector3(rand(-5, 5), rand(2, 6), rand(Z_DEAD - 14, Z_DEAD - 4));
        this.effects.sparks(p, [0xffcc4d, 0x19c3ff, 0x50af30, 0xff3d9a][i % 4], 50);
        this.effects.flash(p, 0xffcc4d, 60);
      }, i * 140);
      this.banner('FEIERABEND!', '17:30 · pünktlich raus', '.extra');
    }
    // remaining items fade out
    for (const it of [...this.items]) { this.items.splice(this.items.indexOf(it), 1); this.disposeItem(it); }
    setTimeout(() => this.showResults(reason, rank), reason === 'stack' ? 1800 : 1500);
  }

  showResults(reason, rank) {
    if (this.state !== 'over') return;
    music.play('techno');
    music.setIntensity(-1);
    const kicker = reason === 'stack' ? `${this.clockText()} · Die Papierlawine hat dich erwischt` : '17:30 · Feierabend!';
    const learned = TOOLS.map((t) => ({ t, n: this.used[t.id] || 0 })).sort((a, b) => b.n - a.n);
    const cards = learned.map(({ t, n }) => h(`div.fb-learn${n ? '' : '.zero'}`, { style: `--c:${t.color}` }, [
      h('img', { src: `${BASE}game2/thumbs/${t.video}.webp`, alt: '', loading: 'lazy' }),
      h('div', {}, [
        h('b', { html: `${iconSVG(t.id, t.color, 2)} ${t.name}` }),
        h('small', {}, n ? `${n}× eingesetzt` : 'heute nicht genutzt'),
        h('p', {}, t.fact),
        h('a', { href: `https://www.youtube.com/watch?v=${t.video}`, target: '_blank', rel: 'noopener' }, '▶ Video ansehen')
      ])
    ]));
    const hours = (this.score / 60).toLocaleString('de-DE', { maximumFractionDigits: 1 });
    mount(h('div.overlay', {}, h('div.card.panel.fb-result', {}, [
      h('div.kicker', {}, kicker),
      h('h1', {}, `${this.score} Minuten gespart`),
      h('div', {}, h(`span.rank.${rank.id}`, {}, `${rank.name}: ${rank.title}`)),
      h('p', {}, rank.line),
      h('p', {}, `${this.solved} Aufgaben erledigt · ${this.missed} auf Papier · beste Combo ${this.bestCombo} · Rekord ${this.best} Min.`),
      h('div.fb-buzz', {}, [
        h('div', {}, [h('b', {}, String(this.fruitsPicked)), 'Low Hanging Fruits']),
        h('div', {}, [h('b', {}, String(this.extraCount)), 'Extra Meilen']),
        h('div', {}, [h('b', {}, String(this.lassenOk)), 'richtig gelassen'])
      ]),
      h('p.fb-note', {}, `Das sind ${hours} Stunden mehr Zeit fürs Verkaufen. Stell dir vor, jede:r im Vertrieb spart nur zehn Minuten pro Tag …`),
      h('div.kicker', {}, 'Das hast du heute gelernt'),
      h('div.fb-learns', {}, cards),
      h('div.row', {}, [
        h('button.btn', { onclick: () => { sfx.click(); this.startCountdown(); } }, '↻ Neuer Arbeitstag'),
        h('button.btn.secondary', { onclick: () => { sfx.click(); this.app.goHub(); } }, 'Zurück ins Büro')
      ])
    ])));
  }

  clockText() {
    return fmtClock(DAY_START + (DAY_END - DAY_START) * clamp(this.elapsed / DAY_TIME, 0, 1));
  }

  // ================================================================== loop
  update(dt, time) {
    let wdt = dt;
    if (this.hitStop > 0) { this.hitStop -= dt; wdt = dt * 0.1; }
    const playing = this.state === 'play';

    if (playing) {
      this.elapsed += wdt;
      const p = this.elapsed / DAY_TIME;
      if (!this.briefed && this.elapsed >= BRIEFING_AT) this.startBriefing();
      this.spawnTimer -= wdt;
      const d = this.difficulty();
      if (this.spawnTimer <= 0 && this.state === 'play') {
        const active = this.items.filter((it) => it.state === 'fly').length;
        if (active < d.maxActive) this.spawn();
        this.spawnTimer = d.interval * rand(0.8, 1.2) * (this.extra > 0 ? 0.75 : 1);
      }
      this.fruitTimer -= wdt;
      if (this.fruitTimer <= 0) { this.spawnFruit(); this.fruitTimer = rand(9, 13); }
      if (this.extra > 0) {
        this.extra -= wdt;
        if (this.extra <= 0) { this.extra = 0; this.applyExtraLook(false); this.tim(TIM.extraEnd, 1500); this.updateHUD(); }
      }
      if (p > 0.82 && !this.lateSaid) { this.lateSaid = true; this.tim(TIM.late); }
      if (p < 0.82) this.lateSaid = false;
      // soundtrack follows the day
      music.setIntensity(this.extra > 0 || p > 0.85 ? 3 : this.briefed ? 2 : p > 0.1 ? 1 : 0);
      if (this.elapsed >= DAY_TIME) { this.elapsed = DAY_TIME; this.endGame('time'); }
      if (Math.floor((this.elapsed - wdt) * 4) !== Math.floor(this.elapsed * 4)) this.updateHUD();
    }

    // ---- items
    const moving = playing;
    for (const it of [...this.items]) {
      if (it.state === 'fly') {
        if (moving) it.k += wdt / it.life;
        if (it.jitter > 0) it.jitter -= wdt;
        this.placeItem(it, time);
        if (it.bar) {
          const r = clamp(1 - it.k, 0, 1);
          it.bar.scale.x = Math.max(0.001, r);
          it.bar.material.color.setRGB(lerp(3, 0.4, r), lerp(0.3, 2.2, r), lerp(0.4, 0.8, r));
        }
        if (it.glow) {
          const sel = this.selected === it;
          it.glow.material.opacity = sel ? 0.95 + Math.sin(time * 14) * 0.05 : it.k > 0.75 ? 0.5 + Math.sin(time * 16) * 0.3 : 0.45;
          if (sel) it.glow.material.color.setRGB(2.4, 2.4, 2.4);
          else if (it.k > 0.75 && it.kind !== 'lassen') it.glow.material.color.setRGB(3, 0.4, 0.6);
          else it.glow.material.color.set(it.kind === 'lassen' ? 0xffcc4d : 0x7fdcff).multiplyScalar(1.6);
        }
        if (moving && it.k >= 1) {
          if (it.kind === 'lassen') {
            // left alone: exactly right
            it.state = 'gone';
            this.items.splice(this.items.indexOf(it), 1);
            const pos = it.obj.position.clone();
            this.effects.sparks(pos, 0xffcc4d, 24);
            this.disposeItem(it);
            const gain = 4 * (this.extra > 0 ? 2 : 1);
            this.score += gain;
            this.lassenOk++;
            this.popup(pos.clone().setY(pos.y + 1), `+${gain} Min · richtig gelassen!`, 'combo');
            this.tim(TIM.lassenOk, 1600);
            sfx.chime();
            this.updateHUD();
          } else this.missItem(it);
        }
      } else if (it.state === 'tostack') {
        it.t += wdt / 0.45;
        const top = this.pile.localToWorld(new THREE.Vector3(0, this.sheets.length * 0.03 + 0.4, 0));
        const k = clamp(it.t, 0, 1);
        it.obj.position.lerpVectors(it.fromPos, top, k);
        it.obj.position.y += Math.sin(k * Math.PI) * 2;
        it.obj.rotation.x = lerp(-0.3, -Math.PI / 2, k);
        it.obj.rotation.z += wdt * 8;
        it.obj.scale.setScalar(lerp(this.L.cardScale, 0.35, k) * (it.kind === 'legacy' ? 0.8 : 1));
        if (k >= 1) this.landOnStack(it);
      }
    }

    // ---- focus panel: what the next tool press will hit
    if (this.focusEl) {
      const tgt = playing ? this.currentTarget() : null;
      if (tgt !== this.focusIt) {
        this.focusIt = tgt;
        this.focusEl.classList.toggle('on', !!tgt);
        this.focusEl.classList.toggle('lassen', tgt?.kind === 'lassen');
        this.focusEl.classList.toggle('legacy', tgt?.kind === 'legacy');
        if (tgt) {
          const sel = this.selected === tgt ? ' · ausgewählt' : '';
          this.focusWho.textContent = (tgt.kind === 'legacy' ? 'Legacy-Alarm' : tgt.def.who) + sel;
          this.focusWhat.textContent = tgt.kind === 'legacy' ? `${tgt.target.def.label} will zurück in deinen Alltag!` : tgt.text;
        }
      }
      if (tgt) {
        const r = clamp(1 - tgt.k, 0, 1);
        this.focusBar.style.transform = `scaleX(${r})`;
        this.focusEl.classList.toggle('hurry', r < 0.25);
      }
    }

    // ---- bolts
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += dt;
      const k = clamp(b.t / b.dur, 0, 1);
      const to = b.it.obj ? b.it.obj.position : b.from;
      b.sprite.position.lerpVectors(b.from, to, k);
      b.sprite.position.y += Math.sin(k * Math.PI) * 1.2;
      b.sprite.scale.setScalar(lerp(0.9, 1.6, k));
      if (k >= 1) {
        this.scene.remove(b.sprite);
        this.bolts.splice(i, 1);
        this.resolve(b);
      }
    }

    // ---- fruits
    for (let i = this.fruits.length - 1; i >= 0; i--) {
      const f = this.fruits[i];
      if (playing) f.t += wdt;
      const sw = Math.sin(time * 2.2 + f.phase) * 0.22;
      f.inner.rotation.z = sw;
      const appear = clamp(f.t / 0.5, 0, 1);
      const leave = clamp((f.t - f.life + 0.6) / 0.6, 0, 1);
      f.inner.position.y = lerp(9, 1.15, easeOutBack(appear)) + leave * 9;
      f.fruit.rotation.y += dt * 2;
      if (f.t >= f.life) { this.scene.remove(f.group); this.fruits.splice(i, 1); }
    }

    // ---- avalanche paper
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const p = this.flying[i];
      p.life -= dt;
      p.v.y -= 16 * dt;
      p.v.multiplyScalar(1 - 0.6 * dt);
      p.mesh.position.addScaledVector(p.v, dt);
      p.mesh.rotation.x += p.w.x * dt; p.mesh.rotation.y += p.w.y * dt; p.mesh.rotation.z += p.w.z * dt;
      if (p.mesh.position.y < 0.02) { p.mesh.position.y = 0.02; p.v.set(0, 0, 0); p.w.multiplyScalar(0.8); }
      if (p.life <= 0) { this.scene.remove(p.mesh); this.flying.splice(i, 1); }
    }

    // ---- world animation: speed, arches, clock, sky, danger
    const targetSpeed = this.extra > 0 ? 3.2 : playing ? 1 + clamp(this.elapsed / DAY_TIME, 0, 1) * 0.9 : 0.35;
    this.speed = lerp(this.speed, targetSpeed, clamp(dt * 2, 0, 1));
    this.floorTex.offset.y += dt * this.speed * 0.35;
    for (const a of this.arches) {
      a.position.z += dt * this.speed * 6;
      if (a.position.z > Z_DEAD - 1) a.position.z -= 7 * 5.5;
    }
    this.ticker.offset.x += dt * 0.06;
    const dayK = clamp((this.elapsed || 0) / DAY_TIME, 0, 1);
    const minutes = DAY_START + (DAY_END - DAY_START) * dayK;
    this.minHand.rotation.z = -((minutes % 60) / 60) * Math.PI * 2;
    this.hourHand.rotation.z = -(((minutes / 60) % 12) / 12) * Math.PI * 2;
    // morning blue → golden afternoon → violet evening
    const c1 = new THREE.Color(0x5a8cff), c2 = new THREE.Color(0xffa040), c3 = new THREE.Color(0x8a3cff);
    const sky = dayK < 0.6 ? c1.clone().lerp(c2, dayK / 0.6) : c2.clone().lerp(c3, (dayK - 0.6) / 0.4);
    this.skyMat.color.copy(sky).multiplyScalar(0.9);
    this.sun.position.set(lerp(-26, 24, dayK), 30 - Math.sin(dayK * Math.PI) * 6 - dayK * 14, -71);
    this.motes.position.z = ((this.motes.position.z + dt * this.speed * 1.5) % 20);
    const danger = playing ? clamp((this.stackCount - 2) / 2, 0, 1) : 0;
    this.dangerLight.intensity = danger * (20 + Math.sin(time * 8) * 12);
    this.deadMat.color.setRGB(3 + Math.sin(time * 6) * 0.8, 0.3, 0.6);
    this.pile.rotation.z = Math.sin(time * 5) * 0.012 * (this.stackCount || 0);
    this.sign.material.color.setScalar(2 + Math.sin(time * 3) * 0.2 + (Math.random() < 0.008 ? -1.4 : 0));

    this.effects.update(wdt);

    // camera: shake + speed kick during the Extra Meile
    const sh = this.effects.shake * this.effects.shake * 0.3;
    const fovTarget = this.L.fov + (this.extra > 0 ? 7 : 0);
    if (Math.abs(this.camera.fov - fovTarget) > 0.05) {
      this.camera.fov = lerp(this.camera.fov, fovTarget, clamp(dt * 3, 0, 1));
      this.camera.updateProjectionMatrix();
    }
    this.camera.position.set(this.camBase.x + rand(-sh, sh), this.camBase.y + rand(-sh, sh), this.camBase.z + rand(-sh, sh) * 0.5);
    this.camera.lookAt(this.camLook);
  }
}
