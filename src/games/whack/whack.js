import * as THREE from 'three';
import { canvasTexture, rand, clamp, lerp, easeOutBack, easeInCubic } from '../../core/gfx.js';
import { sfx, unlockAudio, isMuted, setMuted } from '../../core/audio.js';
import { h, mount, clearUI, storeGet, storeSet } from '../../core/ui.js';
import { buildTarget, pickEnemyType, TARGET_TYPES } from './targets.js';
import { Effects } from './effects.js';

export const GAME_TIME = 60;
export const GOAL = 2000;
const MAX_ERRORS = 3;
const BOARD_TOP = 0.5;
const HOLE_R = 0.95;
const DOWN_Y = -1.6;
const UP_Y = BOARD_TOP + 0.72;
const HAMMER_L = 2.1;
// Landscape: wide board. Portrait (phones held upright): taller, narrower board so the
// holes become as large as possible on screen.
const LAYOUTS = {
  landscape: { W: 10.2, D: 7.6, xs: [-3.2, 0, 3.2], zs: [-2.35, 0, 2.35] },
  portrait: { W: 8.5, D: 9.9, xs: [-2.68, 0, 2.68], zs: [-3.3, 0, 3.3] }
};
const HIT_H = UP_Y + 0.62 + 0.42; // head centre when it lands on top of a risen target

export class WhackGame {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    this.camBase = new THREE.Vector3();
    this.camLook = new THREE.Vector3(0, 0, 0.4);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2(0, 0);
    this.plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BOARD_TOP);
    this.state = 'idle';
    this.buildWorld();
    this.effects = new Effects(this.scene, BOARD_TOP);
    this.effects.bounds = this.bounds;
    this.onPointerMove = this.onPointerMove.bind(this);
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onKey = this.onKey.bind(this);
  }

  // ------------------------------------------------------------------ world
  buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color(0x070a14);
    s.fog = new THREE.Fog(0x070a14, 18, 42);
    s.environment = this.app.gfx.envMap;
    s.environmentIntensity = 0.55;

    s.add(new THREE.HemisphereLight(0x8fb6ff, 0x1a1020, 0.6));
    const key = new THREE.DirectionalLight(0xfff1e0, 2.6);
    key.position.set(-5, 12, 7);
    key.castShadow = true;
    key.shadow.mapSize.set(2048, 2048);
    key.shadow.camera.left = -8; key.shadow.camera.right = 8;
    key.shadow.camera.top = 8; key.shadow.camera.bottom = -8;
    key.shadow.camera.near = 1; key.shadow.camera.far = 30;
    key.shadow.bias = -0.0004;
    key.shadow.normalBias = 0.02;
    s.add(key);
    const rimA = new THREE.SpotLight(0x19c3ff, 70, 30, 0.6, 0.6);
    rimA.position.set(-9, 6, -6);
    rimA.target.position.set(0, 0, 0);
    s.add(rimA, rimA.target);
    const rimB = new THREE.SpotLight(0xff3d9a, 55, 30, 0.6, 0.6);
    rimB.position.set(9, 6, -6);
    rimB.target.position.set(0, 0, 0);
    s.add(rimB, rimB.target);

    // floor
    const floorTex = canvasTexture(512, 512, (g, w, hh) => {
      g.fillStyle = '#0c1020'; g.fillRect(0, 0, w, hh);
      g.strokeStyle = 'rgba(25,195,255,0.18)'; g.lineWidth = 3;
      for (let i = 0; i <= 8; i++) {
        g.beginPath(); g.moveTo(i * 64, 0); g.lineTo(i * 64, hh); g.stroke();
        g.beginPath(); g.moveTo(0, i * 64); g.lineTo(w, i * 64); g.stroke();
      }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(10, 10);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), new THREE.MeshPhysicalMaterial({ map: floorTex, roughness: 0.55, metalness: 0.1, clearcoat: 0.25, clearcoatRoughness: 0.4 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -2.2;
    floor.receiveShadow = true;
    s.add(floor);

    // back wall: skyline window + neon sign
    const sky = canvasTexture(2048, 768, (g, w, hh) => {
      const grd = g.createLinearGradient(0, 0, 0, hh);
      grd.addColorStop(0, '#060818'); grd.addColorStop(0.6, '#1b1446'); grd.addColorStop(1, '#ff4f8b');
      g.fillStyle = grd; g.fillRect(0, 0, w, hh);
      for (let i = 0; i < 200; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`; g.fillRect(Math.random() * w, Math.random() * hh * 0.5, 2, 2); }
      let x = 0;
      while (x < w) {
        const bw = rand(50, 140); const bh = rand(150, 560);
        g.fillStyle = `hsl(${rand(220, 260)}, 40%, ${rand(6, 13)}%)`;
        g.fillRect(x, hh - bh, bw, bh);
        for (let yy = hh - bh + 12; yy < hh - 10; yy += 18) {
          for (let xx = x + 8; xx < x + bw - 8; xx += 14) {
            if (Math.random() < 0.35) { g.fillStyle = Math.random() < 0.8 ? '#ffd27a' : '#7fe3ff'; g.fillRect(xx, yy, 7, 9); }
          }
        }
        x += bw + rand(4, 18);
      }
    });
    const win = new THREE.Mesh(new THREE.PlaneGeometry(44, 16.5), new THREE.MeshBasicMaterial({ map: sky, toneMapped: true }));
    win.position.set(0, 5, -16);
    s.add(win);

    const neon = canvasTexture(1024, 256, (g, w, hh) => {
      g.clearRect(0, 0, w, hh);
      g.font = '900 150px "Segoe UI", Arial, sans-serif';
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#19c3ff'; g.shadowBlur = 30;
      g.fillStyle = '#bff2ff';
      g.fillText('HAU DEN LEGACY!', w / 2, hh / 2);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(14, 3.5), new THREE.MeshBasicMaterial({ map: neon, transparent: true, color: new THREE.Color(2.2, 2.2, 2.2), toneMapped: false, depthWrite: false }));
    sign.position.set(0, 6.3, -12);
    s.add(sign);
    this.sign = sign;

    // board with 9 holes; geometry is rebuilt for portrait/landscape (see applyLayout)
    this.holes = [];
    const carbon = canvasTexture(256, 256, (g, w, hh) => {
      g.fillStyle = '#151b2d'; g.fillRect(0, 0, w, hh);
      for (let y = 0; y < hh; y += 16) for (let x = 0; x < w; x += 16) {
        const k = ((x + y) / 16) % 2;
        const grd = g.createLinearGradient(x, y, x + (k ? 16 : 0), y + (k ? 0 : 16));
        grd.addColorStop(0, '#1b2238'); grd.addColorStop(0.5, '#2a3352'); grd.addColorStop(1, '#141a2b');
        g.fillStyle = grd; g.fillRect(x + 1, y + 1, 14, 14);
      }
    });
    carbon.wrapS = carbon.wrapT = THREE.RepeatWrapping;
    carbon.repeat.set(0.6, 0.6);
    this.boardMat = new THREE.MeshPhysicalMaterial({ map: carbon, roughness: 0.45, metalness: 0.3, clearcoat: 1, clearcoatRoughness: 0.08 });
    this.skirtMat = new THREE.MeshStandardMaterial({ color: 0x0b0f1c, roughness: 0.6, metalness: 0.4 });
    this.stripMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 1.6, 2.4), toneMapped: false });

    const pitMat = new THREE.MeshStandardMaterial({ color: 0x05070d, roughness: 1, side: THREE.BackSide });
    const bottomMat = new THREE.MeshStandardMaterial({ color: 0x020306 });
    const pitGeo = new THREE.CylinderGeometry(HOLE_R, HOLE_R, 2.6, 40, 1, true);
    const pitBottom = new THREE.CircleGeometry(HOLE_R, 32);
    const rimGeo = new THREE.TorusGeometry(HOLE_R + 0.02, 0.09, 16, 64);
    const stalkGeo = new THREE.CylinderGeometry(0.3, 0.38, 2.2, 24);
    const stalkMat = new THREE.MeshStandardMaterial({ color: 0x2a3146, roughness: 0.4, metalness: 0.7 });
    for (let i = 0; i < 9; i++) {
      const pit = new THREE.Mesh(pitGeo, pitMat);
      const bottom = new THREE.Mesh(pitBottom, bottomMat);
      bottom.rotation.x = -Math.PI / 2;
      const rimMat = new THREE.MeshPhysicalMaterial({ color: 0x7d879c, metalness: 0.9, roughness: 0.32, emissive: 0x19c3ff, emissiveIntensity: 0.0 });
      const rim = new THREE.Mesh(rimGeo, rimMat);
      rim.rotation.x = Math.PI / 2;
      rim.castShadow = true;
      s.add(pit, bottom, rim);
      const holder = new THREE.Group();
      const stalk = new THREE.Mesh(stalkGeo, stalkMat);
      stalk.position.y = -1.6;
      stalk.castShadow = true;
      holder.add(stalk);
      holder.visible = false;
      holder.position.y = DOWN_Y;
      s.add(holder);
      this.holes.push({ pos: new THREE.Vector3(), pit, bottom, rim, rimMat, holder, state: 'empty', t: 0, cache: {}, target: null, wasHit: false });
    }
    this.applyLayout('landscape');

    this.buildHammer();
  }

  applyLayout(name) {
    if (this.layout === name) return;
    this.layout = name;
    const L = LAYOUTS[name];
    const { W, D } = L;
    this.bounds = { x: W / 2, z: D / 2 };
    if (this.effects) this.effects.bounds = this.bounds;
    if (this.boardGroup) {
      this.scene.remove(this.boardGroup);
      this.boardGroup.traverse((o) => o.geometry?.dispose());
    }
    const g = new THREE.Group();
    const R = 0.7;
    const shape = new THREE.Shape();
    shape.moveTo(-W / 2 + R, -D / 2);
    shape.lineTo(W / 2 - R, -D / 2); shape.quadraticCurveTo(W / 2, -D / 2, W / 2, -D / 2 + R);
    shape.lineTo(W / 2, D / 2 - R); shape.quadraticCurveTo(W / 2, D / 2, W / 2 - R, D / 2);
    shape.lineTo(-W / 2 + R, D / 2); shape.quadraticCurveTo(-W / 2, D / 2, -W / 2, D / 2 - R);
    shape.lineTo(-W / 2, -D / 2 + R); shape.quadraticCurveTo(-W / 2, -D / 2, -W / 2 + R, -D / 2);
    let i = 0;
    for (const z of L.zs) for (const x of L.xs) {
      const hole = new THREE.Path();
      hole.absarc(x, -z, HOLE_R, 0, Math.PI * 2, true);
      shape.holes.push(hole);
      const h = this.holes[i++];
      h.pos.set(x, BOARD_TOP, z);
      h.pit.position.set(x, BOARD_TOP - 1.3, z);
      h.bottom.position.set(x, BOARD_TOP - 2.55, z);
      h.rim.position.set(x, BOARD_TOP + 0.08, z);
      h.holder.position.x = x;
      h.holder.position.z = z;
    }
    const boardGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.5, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 4, curveSegments: 48 });
    boardGeo.rotateX(-Math.PI / 2);
    const board = new THREE.Mesh(boardGeo, this.boardMat);
    board.receiveShadow = true;
    board.castShadow = true;
    const skirtF = new THREE.Mesh(new THREE.BoxGeometry(W, 2.2, 0.2), this.skirtMat);
    skirtF.position.set(0, -1.1, D / 2 - 0.1);
    const skirtB = new THREE.Mesh(skirtF.geometry.clone(), this.skirtMat);
    skirtB.position.set(0, -1.1, -D / 2 + 0.1);
    const skirtL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 2.2, D), this.skirtMat);
    skirtL.position.set(-W / 2 + 0.1, -1.1, 0);
    const skirtR = new THREE.Mesh(skirtL.geometry.clone(), this.skirtMat);
    skirtR.position.set(W / 2 - 0.1, -1.1, 0);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(W + 0.05, 0.06, 0.05), this.stripMat);
    strip.position.set(0, -0.15, D / 2 + 0.02);
    g.add(board, skirtF, skirtB, skirtL, skirtR, strip);
    this.scene.add(g);
    this.boardGroup = g;
    this.board = board;
  }

  buildHammer() {
    const hammer = new THREE.Group();
    const yaw = new THREE.Group();
    const pivot = new THREE.Group();
    yaw.add(pivot);
    hammer.add(yaw);
    pivot.position.set(0, 0, HAMMER_L);
    const handleMat = new THREE.MeshPhysicalMaterial({ color: 0x8a5a33, roughness: 0.55, clearcoat: 0.5 });
    const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.12, HAMMER_L + 0.6, 20), handleMat);
    handle.rotation.x = Math.PI / 2;
    handle.position.z = -HAMMER_L / 2 + 0.3;
    handle.castShadow = true;
    const grip = new THREE.Mesh(new THREE.CylinderGeometry(0.135, 0.135, 0.9, 20), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 }));
    grip.rotation.x = Math.PI / 2;
    grip.position.z = 0.2;
    const headGroup = new THREE.Group();
    headGroup.position.z = -HAMMER_L;
    const headMat = new THREE.MeshPhysicalMaterial({ color: 0x2b3245, metalness: 0.9, roughness: 0.25, clearcoat: 1 });
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 1.25, 40), headMat);
    head.rotation.z = Math.PI / 2;
    head.castShadow = true;
    const capMat = new THREE.MeshPhysicalMaterial({ color: 0xff2d55, roughness: 0.35, clearcoat: 1 });
    for (const sx of [-1, 1]) {
      const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.46, 0.46, 0.18, 40), capMat);
      cap.rotation.z = Math.PI / 2;
      cap.position.x = sx * 0.66;
      cap.castShadow = true;
      headGroup.add(cap);
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.43, 0.035, 10, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 2.0, 3.0), toneMapped: false }));
      band.rotation.y = Math.PI / 2;
      band.position.x = sx * 0.38;
      headGroup.add(band);
    }
    const label = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.24), new THREE.MeshBasicMaterial({
      map: canvasTexture(256, 88, (g, w, hh) => { g.fillStyle = '#fff'; g.font = '900 60px "Segoe UI", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('CRM', w / 2, hh / 2); }),
      transparent: true
    }));
    label.position.set(0, 0.425, 0);
    label.rotation.x = -Math.PI / 2;
    headGroup.add(head, label);
    pivot.add(handle, grip, headGroup);
    this.scene.add(hammer);
    this.hammer = { root: hammer, yaw, pivot, headGroup, pos: new THREE.Vector3(0, HIT_H, 3), target: new THREE.Vector3(0, HIT_H, 3), angle: 0.62, swing: null };
    hammer.scale.setScalar(0.85);
  }

  // ------------------------------------------------------------------ lifecycle
  enter() {
    this.resize(window.innerWidth, window.innerHeight);
    const c = this.app.gfx.renderer.domElement;
    c.addEventListener('pointermove', this.onPointerMove);
    c.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKey);
    this.best = storeGet('whack-best', 0);
    this.prewarm();
    this.showIntro();
  }

  exit() {
    const c = this.app.gfx.renderer.domElement;
    c.removeEventListener('pointermove', this.onPointerMove);
    c.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKey);
    c.style.cursor = '';
    this.resetBoard();
    clearUI();
  }

  resize(w, h) {
    const aspect = w / h;
    const portrait = aspect < 0.9;
    this.applyLayout(portrait ? 'portrait' : 'landscape');
    this.camera.aspect = aspect;
    const { x: hx, z: hz } = this.bounds;
    if (!portrait) {
      // fit board width and depth (with room for the HUD at the top)
      this.camera.fov = 40;
      const vt = Math.tan(THREE.MathUtils.degToRad(20));
      const dW = (hx + 0.6) / (vt * aspect);
      const dD = (hz + 1.4) / vt * 1.05;
      const dist = Math.max(dW, dD, 12);
      // short landscape screens (phone held sideways): steeper view = taller holes
      this.camBase.set(0, h < 500 ? 0.9 : 0.77, h < 500 ? 0.44 : 0.64).normalize().multiplyScalar(dist);
      this.camLook.set(0, 0, 0.5);
    } else {
      // phones held upright: steeper view onto the tall board, fit its width
      this.camera.fov = 50;
      const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
      const dist = (hx + 0.35) / Math.tan(hfov / 2);
      this.camBase.set(0, 0.86, 0.5).normalize().multiplyScalar(dist);
      this.camBase.z += 0.9;
      this.camLook.set(0, 0, -1.6); // tilt up a little so the board sits lower, in thumb reach
    }
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camLook);
  }

  /** Builds every head type for every hole and compiles all shaders up front,
   *  so nothing stutters the first time a head pops up or gets smashed (important on iPhone). */
  prewarm() {
    if (this.warmed) return;
    this.warmed = true;
    for (const hole of this.holes) {
      for (const type of Object.keys(TARGET_TYPES)) {
        if (!hole.cache[type]) {
          const t = buildTarget(type);
          hole.holder.add(t.group);
          hole.cache[type] = t;
        }
        hole.cache[type].group.visible = true;
      }
      hole.holder.visible = true;
    }
    this.effects.warmup(Object.values(this.holes[0].cache));
    this.app.gfx.renderer.compile(this.scene, this.camera);
    for (const hole of this.holes) {
      for (const t of Object.values(hole.cache)) t.group.visible = false;
      hole.holder.visible = false;
    }
    this.effects.clear();
  }

  resetBoard() {
    for (const hole of this.holes) {
      if (hole.target) hole.target.group.visible = false;
      hole.state = 'empty';
      hole.holder.visible = false;
      hole.holder.position.y = DOWN_Y;
      hole.rimMat.emissiveIntensity = 0;
    }
    this.effects.clear();
  }

  // ------------------------------------------------------------------ UI
  baseUI() {
    clearUI();
    mount(h('button.icon-btn.left', { title: 'Zurück zur Spielewelt', onclick: () => { sfx.click(); this.app.goHub(); } }, '⟵'));
    const mute = mount(h('button.icon-btn.right', { title: 'Ton an/aus', onclick: () => { setMuted(!isMuted()); mute.textContent = isMuted() ? '🔇' : '🔊'; } }, isMuted() ? '🔇' : '🔊'));
  }

  showIntro() {
    this.state = 'intro';
    this.resetBoard();
    this.baseUI();
    const enemies = Object.values(TARGET_TYPES).filter((t) => !t.friendly).map((t) => t.label).join(', ');
    mount(h('div.overlay', {}, h('div.card.panel', {}, [
      h('div.kicker', {}, 'Spiel 1 · Legacy Smash'),
      h('h1', {}, 'Hau den Legacy!'),
      h('p', {}, `Hau alles weg, was deinen Vertrieb ausbremst. ${GAME_TIME} Sekunden, Ziel: ${GOAL.toLocaleString('de-DE')} Punkte.`),
      h('div.legend', {}, [
        h('div.bad', {}, [h('b', {}, '✔ Draufhauen'), enemies]),
        h('div.good', {}, [h('b', {}, ['✖ Verschonen: ', h('img.brand', { src: `${import.meta.env.BASE_URL}brand/itmx-logo.png`, alt: '' }), ' itmX']), `Wer itmX trifft, kassiert ${TARGET_TYPES.itmx.points} Punkte und einen Fehler. Nach ${MAX_ERRORS} Fehlern ist Schluss.`]),
        h('div', {}, [h('b', {}, '🔥 Combo'), 'Alle 5 Treffer am Stück steigt der Multiplikator (bis x5).']),
        h('div', {}, [h('b', {}, '🏆 Belohnung'), 'Wer das Ziel schafft, bekommt das Schwetz-Zertifikat für CRM-Expertise.'])
      ]),
      this.best ? h('p', {}, `Dein Rekord: ${this.best.toLocaleString('de-DE')} Punkte`) : null,
      h('div.row', {}, [h('button.btn', { onclick: () => { unlockAudio(); sfx.click(); this.startCountdown(); } }, '▶ Los geht’s')])
    ])));
  }

  buildHUD() {
    this.baseUI();
    const stat = (cls, label) => {
      const strong = h('strong', {}, '0');
      const el = h(`div.stat.panel.${cls}`, {}, [h('small', {}, label), strong]);
      return { el, strong };
    };
    this.hud = { score: stat('score', 'Punkte'), time: stat('time', 'Zeit'), combo: stat('combo', 'Combo'), errors: stat('errors', 'Fehler') };
    mount(h('div.hud.passthrough', {}, Object.values(this.hud).map((s) => s.el)));
    this.goalBar = h('i');
    this.goalEl = mount(h('div.goal.passthrough', {}, this.goalBar));
    this.updateHUD();
  }

  updateHUD() {
    if (!this.hud) return;
    this.hud.score.strong.textContent = this.score.toLocaleString('de-DE');
    const tl = Math.max(0, Math.ceil(this.timeLeft));
    this.hud.time.strong.textContent = `${tl}s`;
    this.hud.time.el.classList.toggle('low', tl <= 10 && this.state === 'play');
    this.hud.combo.strong.textContent = `x${this.multiplier()}`;
    this.hud.errors.strong.textContent = '●'.repeat(this.errors) + '○'.repeat(Math.max(0, MAX_ERRORS - this.errors));
    this.hud.errors.strong.style.color = this.errors ? 'var(--bad)' : '';
    this.goalBar.style.width = `${clamp(this.score / GOAL, 0, 1) * 100}%`;
    this.goalEl.classList.toggle('reached', this.score >= GOAL);
  }

  popup(worldPos, text, cls) {
    const v = worldPos.clone().project(this.camera);
    const x = (v.x * 0.5 + 0.5) * window.innerWidth;
    const y = (-v.y * 0.5 + 0.5) * window.innerHeight;
    const el = mount(h(`div.popup.${cls}`, {}, text));
    el.style.left = `${x}px`;
    el.style.top = `${y}px`;
    setTimeout(() => el.remove(), 950);
  }

  // ------------------------------------------------------------------ flow
  startCountdown() {
    this.score = 0; this.errors = 0; this.combo = 0; this.bestCombo = 0; this.hits = 0;
    this.timeLeft = GAME_TIME; this.elapsed = 0; this.spawnTimer = 0.6;
    this.resetBoard();
    this.buildHUD();
    this.state = 'countdown';
    const cd = mount(h('div.countdown.passthrough'));
    let n = 3;
    const tick = () => {
      if (this.state !== 'countdown') { cd.remove(); return; }
      cd.replaceChildren(h('span', {}, n > 0 ? String(n) : 'HAU!'));
      sfx.beep(n === 0);
      if (n === 0) { this.state = 'play'; setTimeout(() => cd.remove(), 800); return; }
      n--;
      setTimeout(tick, 750);
    };
    tick();
  }

  multiplier() { return Math.min(5, 1 + Math.floor((this.combo || 0) / 5)); }

  endGame(reason) {
    if (this.state !== 'play') return;
    this.state = 'over';
    for (const hole of this.holes) if (hole.state === 'up' || hole.state === 'rising') { hole.state = 'lowering'; hole.t = 0; }
    const won = reason === 'time' && this.score >= GOAL;
    if (this.score > this.best) { this.best = this.score; storeSet('whack-best', this.best); }
    this.updateHUD();
    const stats = { score: this.score, hits: this.hits, bestCombo: this.bestCombo, errors: this.errors };
    if (won) {
      sfx.win();
      for (let i = 0; i < 6; i++) setTimeout(() => {
        const p = new THREE.Vector3(rand(-4, 4), BOARD_TOP + rand(0.5, 2), rand(-2, 2));
        this.effects.sparks(p, [0xffcc4d, 0x19c3ff, 0x3ddc84, 0xff3d9a][i % 4], 50);
        this.effects.shockwave(p, 0xffcc4d);
      }, i * 160);
      setTimeout(() => {
        mount(h('div.overlay', {}, h('div.card.panel', {}, [
          h('div.kicker', {}, 'Ziel erreicht'),
          h('h1', {}, `${this.score.toLocaleString('de-DE')} Punkte!`),
          h('p', {}, `${this.hits} Legacy-Systeme zerlegt · beste Combo ${this.bestCombo} · ${this.errors} Fehler`),
          h('p', {}, 'Da hinten schlurft schon jemand mit deinem Zertifikat an …'),
          h('div.row', {}, [h('button.btn.gold', { onclick: () => { sfx.click(); this.app.showCertificate(stats); } }, '🏆 Zertifikat abholen')])
        ])));
      }, 1300);
    } else {
      sfx.lose();
      const msg = reason === 'errors'
        ? `Du hast ${MAX_ERRORS}× itmX erwischt. Der beste CRM-Partner hat das nicht verdient!`
        : `Noch ${(GOAL - this.score).toLocaleString('de-DE')} Punkte bis zum Schwetz-Zertifikat.`;
      setTimeout(() => {
        mount(h('div.overlay', {}, h('div.card.panel', {}, [
          h('div.kicker', {}, reason === 'errors' ? 'Game over' : 'Zeit abgelaufen'),
          h('h1', {}, `${this.score.toLocaleString('de-DE')} Punkte`),
          h('p', {}, msg),
          h('p', {}, `Rekord: ${this.best.toLocaleString('de-DE')} · beste Combo ${this.bestCombo}`),
          h('div.row', {}, [
            h('button.btn', { onclick: () => { sfx.click(); this.startCountdown(); } }, '↻ Nochmal'),
            h('button.btn.secondary', { onclick: () => { sfx.click(); this.app.goHub(); } }, 'Zur Spielewelt')
          ])
        ])));
      }, 900);
    }
  }

  // ------------------------------------------------------------------ spawning
  difficulty() {
    const p = clamp(this.elapsed / GAME_TIME, 0, 1);
    return {
      interval: lerp(0.85, 0.32, p),
      up: lerp(1.35, 0.62, p),
      rise: lerp(0.22, 0.12, p),
      itmx: lerp(0.18, 0.3, p),
      maxActive: 1 + Math.floor(p * 3.5)
    };
  }

  spawn(forcedType, forcedHole) {
    const d = this.difficulty();
    const active = this.holes.filter((x) => x.state !== 'empty').length;
    if (active >= d.maxActive && !forcedType) return;
    const free = this.holes.filter((x) => x.state === 'empty');
    if (!free.length) return;
    const hole = forcedHole ?? free[Math.floor(Math.random() * free.length)];
    const type = forcedType || (Math.random() < d.itmx ? 'itmx' : pickEnemyType());
    if (hole.target) hole.target.group.visible = false;
    if (!hole.cache[type]) {
      const t = buildTarget(type);
      hole.holder.add(t.group);
      hole.cache[type] = t;
    }
    const t = hole.cache[type];
    t.group.visible = true;
    t.group.scale.setScalar(1);
    t.group.rotation.set(-0.35, 0, 0);
    t.group.position.set(0, 0, 0);
    hole.target = t;
    hole.state = 'rising';
    hole.t = 0;
    hole.riseDur = d.rise;
    hole.upDur = d.up * rand(0.85, 1.2);
    hole.wasHit = false;
    hole.holder.visible = true;
    hole.rimMat.emissive.set(t.friendly ? 0x50af30 : 0xff3b5c);
    sfx.pop();
  }

  updateHoles(dt, time) {
    const hammerHead = new THREE.Vector3();
    this.hammer.headGroup.getWorldPosition(hammerHead);
    for (const hole of this.holes) {
      if (hole.state === 'empty') { hole.rimMat.emissiveIntensity = Math.max(0, hole.rimMat.emissiveIntensity - dt * 4); continue; }
      hole.t += dt;
      let y = DOWN_Y;
      if (hole.state === 'rising') {
        const k = clamp(hole.t / hole.riseDur, 0, 1);
        y = lerp(DOWN_Y, UP_Y, easeOutBack(k));
        if (k >= 1) { hole.state = 'up'; hole.t = 0; }
      } else if (hole.state === 'up') {
        y = UP_Y + Math.sin(time * 6) * 0.04;
        if (hole.t >= hole.upDur && this.state === 'play') { hole.state = 'lowering'; hole.t = 0; }
      } else if (hole.state === 'lowering') {
        const k = clamp(hole.t / 0.22, 0, 1);
        y = lerp(UP_Y, DOWN_Y, easeInCubic(k));
        if (k >= 1) {
          if (!hole.wasHit && hole.target && !hole.target.friendly && this.state === 'play') this.combo = 0;
          hole.state = 'empty';
          hole.holder.visible = false;
          if (hole.target) hole.target.group.visible = false;
          this.updateHUD();
        }
      } else if (hole.state === 'stunned') {
        // itmX got hit: wobble, then sink
        const k = clamp(hole.t / 0.7, 0, 1);
        y = lerp(UP_Y, DOWN_Y, easeInCubic(k));
        hole.target.group.rotation.z = Math.sin(hole.t * 40) * 0.3 * (1 - k);
        if (k >= 1) { hole.state = 'empty'; hole.holder.visible = false; hole.target.group.visible = false; hole.target.group.rotation.z = 0; }
      } else if (hole.state === 'smashed') {
        y = lerp(hole.holder.position.y, DOWN_Y, clamp(dt * 10, 0, 1));
        if (hole.t > 0.35) { hole.state = 'empty'; hole.holder.visible = false; }
      }
      hole.holder.position.y = y;
      const tgt = hole.target;
      const show = hole.state === 'up' || hole.state === 'rising';
      hole.rimMat.emissiveIntensity = lerp(hole.rimMat.emissiveIntensity, show ? 1.4 + Math.sin(time * 10) * 0.4 : 0, clamp(dt * 8, 0, 1));
      if (tgt && tgt.group.visible) {
        if (hole.state === 'up') tgt.group.rotation.z = Math.sin(time * 5 + hole.pos.x) * 0.08;
        if (tgt.halo) { tgt.halo.rotation.z += dt * 2; tgt.halo.position.y = 1.05 + Math.sin(time * 4) * 0.05; }
        if (tgt.spin) tgt.spin.rotation.z += dt * 3;
        // googly eyes follow the hammer
        for (const e of tgt.eyes) {
          const ep = new THREE.Vector3();
          e.eye.getWorldPosition(ep);
          const d = hammerHead.clone().sub(ep);
          d.y *= 0.6;
          d.normalize();
          e.pupil.position.set(d.x * 0.08, clamp(d.y, -0.6, 0.6) * 0.08 + 0.02, 0.12);
        }
      }
    }
  }

  // ------------------------------------------------------------------ input
  setPointer(e) {
    const r = this.app.gfx.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
    const p = new THREE.Vector3();
    if (this.raycaster.ray.intersectPlane(this.plane, p)) {
      p.x = clamp(p.x, -this.bounds.x + 0.2, this.bounds.x - 0.2);
      p.z = clamp(p.z, -this.bounds.z + 0.2, this.bounds.z - 0.2);
      this.hammer.target.set(p.x, HIT_H, p.z);
    }
    return p;
  }

  onPointerMove(e) {
    if (e.pointerType === 'mouse') this.setPointer(e);
  }

  onPointerDown(e) {
    if (this.state !== 'play') { this.setPointer(e); return; }
    e.preventDefault();
    const p = this.setPointer(e);
    // touch: snap hammer immediately to the tap position
    if (e.pointerType !== 'mouse') this.hammer.pos.copy(this.hammer.target);
    this.swing(this.pickHole(p));
  }

  onKey(e) {
    // number pad layout 7-8-9 / 4-5-6 / 1-2-3 for keyboard players
    const map = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8 };
    if (this.state === 'play' && e.key in map) {
      const hole = this.holes[map[e.key]];
      this.hammer.target.set(hole.pos.x, HIT_H, hole.pos.z);
      this.hammer.pos.copy(this.hammer.target);
      this.swing(hole);
    }
  }

  pickHole(p) {
    // prefer direct hits on visible heads
    const meshes = [];
    for (const hole of this.holes) if (hole.target && hole.target.group.visible && (hole.state === 'up' || hole.state === 'rising')) meshes.push(hole.holder);
    const hits = this.raycaster.intersectObjects(meshes, true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !this.holes.find((x) => x.holder === o)) o = o.parent;
      const hole = this.holes.find((x) => x.holder === o);
      if (hole) return hole;
    }
    let best = null, bd = 1.6;
    for (const hole of this.holes) {
      const d = Math.hypot(hole.pos.x - p.x, hole.pos.z - p.z);
      if (d < bd) { bd = d; best = hole; }
    }
    return best;
  }

  swing(hole) {
    if (this.pending) this.impact(this.pending);
    const hm = this.hammer;
    if (hole) hm.target.set(hole.pos.x, HIT_H, hole.pos.z);
    hm.pos.lerp(hm.target, 0.85);
    hm.swing = { t: 0 };
    this.pending = { hole, at: 0.075, point: hm.target.clone() };
    sfx.swing();
  }

  impact(pending) {
    this.pending = null;
    const { hole } = pending;
    const hittable = hole && hole.target && (hole.state === 'up' || (hole.state === 'rising' && hole.t > hole.riseDur * 0.3) || (hole.state === 'lowering' && hole.t < 0.12));
    if (!hittable) {
      const p = pending.point.clone(); p.y = BOARD_TOP;
      sfx.thud();
      this.effects.sparks(p, 0x99a3b8, 10);
      this.effects.shockwave(p, 0x5a6378);
      this.effects.shake = Math.max(this.effects.shake, 0.25);
      if (this.combo > 0) this.popup(p.clone().setY(BOARD_TOP + 1), 'Daneben', 'combo');
      this.combo = 0;
      this.hammer.landAngle = -0.5;
      this.updateHUD();
      return;
    }
    const tgt = hole.target;
    const pos = new THREE.Vector3(hole.pos.x, hole.holder.position.y, hole.pos.z);
    this.hammer.landAngle = 0;
    hole.wasHit = true;
    if (tgt.friendly) {
      this.errors++;
      this.combo = 0;
      this.score = Math.max(0, this.score + tgt.def.points);
      hole.state = 'stunned';
      hole.t = 0;
      sfx.error();
      this.effects.shake = 1.2;
      this.effects.flash(pos, 0xff2040, 80);
      this.effects.sparks(pos, 0xff3b5c, 30);
      this.effects.shockwave(pos, 0xff3b5c);
      this.hitStop = 0.12;
      this.popup(pos.clone().setY(UP_Y + 1.4), `${tgt.def.points}`, 'bad');
      mount(h('div.errflash.passthrough'));
      const dlg = mount(h('div.errdialog.passthrough', {}, [
        h('header', {}, 'itmX.exe – Schwerer Ausnahmefehler'),
        h('div', {}, [h('b', {}, '✕'), h('span', {}, `Fehler ${this.errors}/${MAX_ERRORS}: Du hast deinen besten CRM-Partner gehauen!`)])
      ]));
      setTimeout(() => { dlg.remove(); document.querySelector('.errflash')?.remove(); }, 1300);
      if (this.errors >= MAX_ERRORS) setTimeout(() => this.endGame('errors'), 450);
    } else {
      this.combo++;
      this.hits++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const mult = this.multiplier();
      const pts = tgt.def.points * mult;
      this.score += pts;
      hole.state = 'smashed';
      hole.t = 0;
      tgt.group.visible = false;
      this.effects.shatter(tgt, pos.clone().setY(UP_Y - 0.4));
      this.effects.sparks(pos.clone().setY(UP_Y - 0.2), 0xffffff, 26);
      this.effects.shockwave(pos, tgt.goo);
      this.effects.flash(pos, tgt.goo, 70);
      this.effects.shake = Math.max(this.effects.shake, 0.55 + mult * 0.08);
      this.hitStop = 0.055;
      sfx.smash(rand(0.9, 1.15));
      sfx.splat();
      this.popup(pos.clone().setY(UP_Y + 1.2), `+${pts}`, 'good');
      if (this.combo % 5 === 0 && mult > 1) {
        sfx.combo(mult);
        setTimeout(() => this.popup(pos.clone().setY(UP_Y + 2.2), `COMBO x${mult}!`, 'combo'), 120);
      }
    }
    this.updateHUD();
  }

  // ------------------------------------------------------------------ loop
  update(dt, time) {
    // hit-stop: freeze-frame for juicy impacts
    let wdt = dt;
    if (this.hitStop > 0) { this.hitStop -= dt; wdt = dt * 0.08; }

    if (this.state === 'play') {
      this.elapsed += wdt;
      this.timeLeft -= wdt;
      this.spawnTimer -= wdt;
      if (this.spawnTimer <= 0) {
        this.spawn();
        const d = this.difficulty();
        this.spawnTimer = d.interval * rand(0.75, 1.25);
      }
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.endGame('time'); }
      if (Math.floor(this.timeLeft + wdt) !== Math.floor(this.timeLeft)) this.updateHUD();
    }

    this.updateHoles(wdt, time);
    this.updateHammer(dt);
    this.effects.update(wdt);

    // camera shake
    const sh = this.effects.shake * this.effects.shake * 0.35;
    this.camera.position.set(this.camBase.x + rand(-sh, sh), this.camBase.y + rand(-sh, sh), this.camBase.z + rand(-sh, sh) * 0.5);
    this.camera.lookAt(this.camLook);
    this.sign.material.color.setScalar(2 + Math.sin(time * 3) * 0.2 + (Math.random() < 0.01 ? -1.5 : 0));
  }

  updateHammer(dt) {
    const hm = this.hammer;
    hm.pos.lerp(hm.target, clamp(dt * 18, 0, 1));
    hm.root.position.copy(hm.pos);
    // slight yaw so the handle points toward the player
    hm.yaw.rotation.y = clamp(-hm.pos.x * 0.06, -0.35, 0.35);
    const idle = 0.62;
    if (hm.swing) {
      hm.swing.t += dt;
      const t = hm.swing.t;
      const land = this.pending ? (this.pending.hole && this.pending.hole.target && this.pending.hole.state !== 'empty' ? 0 : -0.5) : (hm.landAngle ?? 0);
      if (t < 0.075) hm.angle = lerp(idle, land, easeInCubic(t / 0.075));
      else if (t < 0.12) hm.angle = land;
      else if (t < 0.32) hm.angle = lerp(land, idle, 1 - Math.pow(1 - (t - 0.12) / 0.2, 2));
      else { hm.angle = idle; hm.swing = null; }
      if (this.pending && t >= this.pending.at) this.impact(this.pending);
    } else {
      hm.angle = lerp(hm.angle, idle, clamp(dt * 10, 0, 1));
    }
    hm.pivot.rotation.x = hm.angle;
    // squash on impact
    const sq = hm.swing && hm.swing.t > 0.075 && hm.swing.t < 0.13 ? 0.82 : 1;
    hm.headGroup.scale.set(1 / Math.sqrt(sq), sq, 1 / Math.sqrt(sq));
  }
}

