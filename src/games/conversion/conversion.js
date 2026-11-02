import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, roundRect, rand, clamp, lerp, easeOutBack } from '../../core/gfx.js';
import { sfx, music, unlockAudio, isMuted, setMuted } from '../../core/audio.js';
import { h, mount, clearUI, storeGet, storeSet } from '../../core/ui.js';
import { Effects } from '../whack/effects.js';
import { ConversionFinale } from './finale.js';
import {
  PHASES, PER_PHASE, JUNK, JUNK_OWNERS, FAKE_STAMPS, CONSULTANTS, CONSULTANT_LINES, PM_QUESTIONS, PM_ANSWERS,
  PM_EFFECT, PM_JOKERS, CREW, CREW_TEAMS, CREW_LINES, crewById, BP_LINES, BP_ERRORS, LEARN, rankFor,
  say, poolFor, getMode, setMode
} from './content.js';
import { buildCRX, animateCRX, buildBP, errorTexture, oracleSVG, consultantSVG } from './models.js';

// "Mission RC 0" – the S/4HANA conversion weekend. Transport requests roll down the conveyor;
// import the right ones in the right order (Conversion Kit → Backup → Deinstallation → SUM →
// new itmX CRM → Restore). Mid-conversion the SAP Business Partner crashes the party.

export const GAME_TIME = 90; // seconds for Sat 18:00 → Mon 06:00
const CLOCK_START = 18 * 60, CLOCK_LEN = 36 * 60;
const Z_SPAWN = -30, Z_END = 2.2;
const BELT_Y = 0.5;
const MAX_DUMPS = 5;
const BOSS_FALLBACK = 50; // the BP shows up at the latest after this many seconds
const BOSS_MAX = 24; // after this he leaves on his own
const CRATE_W = 2.3, CRATE_H = 1.3, CRATE_D = 0.9;
const REVEAL_TIME = 8, WEAK_TIME = 7;

const LAYOUTS = {
  landscape: { lanes: [-3.4, 0, 3.4], scale: 1.18, fov: 46, racks: 9.5 },
  portrait: { lanes: [-2.45, 0, 2.45], scale: 1.0, fov: 64, racks: 6.4 }
};
const DAYS = ['Sa', 'So', 'Mo'];
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const transportNo = () => `K9${String(Math.floor(rand(10000, 99999)))}`;

export class ConversionGame {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 220);
    this.camBase = new THREE.Vector3();
    this.camLook = new THREE.Vector3();
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.items = [];
    this.beams = [];
    this.errors = [];
    this.state = 'idle';
    this.speed = 1;
    this.layoutName = null;
    this.mode = getMode();
    this.buildWorld();
    this.effects = new Effects(this.scene, BELT_Y);
    this.effects.bounds = { x: 60, z: 120 };
    this.onPointerDown = this.onPointerDown.bind(this);
    this.onKey = this.onKey.bind(this);
  }

  // ================================================================== world
  buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color(0x050914);
    s.fog = new THREE.Fog(0x050914, 26, 64);
    s.environment = this.app.gfx.envMap;
    s.environmentIntensity = 0.5;

    s.add(new THREE.HemisphereLight(0x8fb0ff, 0x10081a, 0.75));
    const key = new THREE.DirectionalLight(0xfff2e0, 2.2);
    key.position.set(-6, 14, 8);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    Object.assign(key.shadow.camera, { left: -10, right: 10, top: 10, bottom: -10, near: 1, far: 40 });
    key.target.position.set(0, 0, -4);
    key.shadow.bias = -0.0005;
    s.add(key, key.target);
    const rimA = new THREE.SpotLight(0x19c3ff, 90, 50, 0.7, 0.6);
    rimA.position.set(-12, 9, -8);
    const rimB = new THREE.SpotLight(0xffb000, 80, 50, 0.7, 0.6);
    rimB.position.set(12, 9, -8);
    s.add(rimA, rimB);
    this.alarm = new THREE.PointLight(0xff2040, 0, 18, 2);
    this.alarm.position.set(0, 4, -4);
    s.add(this.alarm);

    // ---- raised data-centre floor
    const floorTex = canvasTexture(512, 512, (g, w, hh) => {
      g.fillStyle = '#0b1020'; g.fillRect(0, 0, w, hh);
      for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
        const px = x * 128, py = y * 128;
        g.fillStyle = (x + y) % 3 === 0 ? '#111a30' : '#0e1528';
        g.fillRect(px + 3, py + 3, 122, 122);
        if ((x * 7 + y * 3) % 5 === 0) {
          g.fillStyle = 'rgba(120,170,255,0.18)';
          for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) g.fillRect(px + 14 + i * 13, py + 14 + j * 13, 5, 5);
        }
      }
      g.strokeStyle = 'rgba(25,195,255,0.25)'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * 128, 0); g.lineTo(i * 128, hh); g.stroke(); g.beginPath(); g.moveTo(0, i * 128); g.lineTo(w, i * 128); g.stroke(); }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(16, 30);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(64, 120), new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.5, metalness: 0.4, emissiveMap: floorTex, emissive: new THREE.Color(0.35, 0.4, 0.6) }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.z = -30;
    floor.receiveShadow = true;
    s.add(floor);

    // ---- the transport conveyor
    this.belt = new THREE.Group();
    s.add(this.belt);
    const L = Z_END - Z_SPAWN + 6;
    this.beltL = L;
    this.beltBase = new THREE.Mesh(new THREE.BoxGeometry(1, BELT_Y - 0.04, L), new THREE.MeshStandardMaterial({ color: 0x1a2032, metalness: 0.7, roughness: 0.35 }));
    this.beltBase.position.set(0, (BELT_Y - 0.04) / 2, (Z_SPAWN + Z_END) / 2 - 1);
    this.beltBase.castShadow = this.beltBase.receiveShadow = true;
    this.belt.add(this.beltBase);
    this.rollerTex = canvasTexture(256, 256, (g, w, hh) => {
      g.fillStyle = '#171c2a'; g.fillRect(0, 0, w, hh);
      for (let y = 0; y < hh; y += 32) {
        const grd = g.createLinearGradient(0, y, 0, y + 28);
        grd.addColorStop(0, '#2a3248'); grd.addColorStop(0.5, '#56607a'); grd.addColorStop(1, '#20263a');
        g.fillStyle = grd; g.fillRect(0, y + 2, w, 26);
      }
    });
    this.rollerTex.wrapS = this.rollerTex.wrapT = THREE.RepeatWrapping;
    this.beltTop = new THREE.Mesh(new THREE.PlaneGeometry(1, L), new THREE.MeshStandardMaterial({ map: this.rollerTex, metalness: 0.6, roughness: 0.35 }));
    this.beltTop.rotation.x = -Math.PI / 2;
    this.beltTop.position.set(0, BELT_Y - 0.02, this.beltBase.position.z);
    this.beltTop.receiveShadow = true;
    this.belt.add(this.beltTop);
    // hazard rails
    const hazard = canvasTexture(256, 32, (g, w, hh) => {
      g.fillStyle = '#ffb000'; g.fillRect(0, 0, w, hh);
      g.fillStyle = '#111';
      for (let x = -32; x < w + 32; x += 32) { g.beginPath(); g.moveTo(x, hh); g.lineTo(x + 16, 0); g.lineTo(x + 32, 0); g.lineTo(x + 16, hh); g.fill(); }
    });
    hazard.wrapS = THREE.RepeatWrapping;
    hazard.repeat.set(L / 2, 1);
    this.rails = [-1, 1].map(() => {
      // hazard stripes on the long outer faces (+x / -x), plain metal elsewhere
      const stripe = new THREE.MeshStandardMaterial({ map: hazard, emissiveMap: hazard, emissive: new THREE.Color(0.5, 0.35, 0) });
      const metal = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.7, roughness: 0.4 });
      const r = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.22, L), [stripe, stripe, metal, metal, metal, metal]);
      r.position.set(0, BELT_Y + 0.08, this.beltBase.position.z);
      this.belt.add(r);
      return r;
    });
    // glowing lane separators
    this.laneMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.25, 1.4, 2.2), toneMapped: false, transparent: true, opacity: 0.7 });
    this.laneLines = [0, 1].map(() => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.02, L), this.laneMat);
      m.position.set(0, BELT_Y + 0.005, this.beltBase.position.z);
      this.belt.add(m);
      return m;
    });
    // "PUFFER" pit at the end of the belt
    const pufTex = canvasTexture(1024, 128, (g, w, hh) => {
      g.font = `900 78px ${FONT}`;
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillStyle = '#ffb000'; g.shadowColor = '#ff7a00'; g.shadowBlur = 18;
      g.fillText('▼  P U F F E R  ▼', w / 2, hh / 2);
    });
    this.pufLabel = new THREE.Mesh(new THREE.PlaneGeometry(6, 0.75), new THREE.MeshBasicMaterial({ map: pufTex, transparent: true, depthWrite: false, toneMapped: false }));
    this.pufLabel.rotation.x = -Math.PI / 2;
    this.pufLabel.position.set(0, 0.02, Z_END + 1.4);
    s.add(this.pufLabel);

    // ---- server racks on both sides (two instanced meshes)
    const ledTex = canvasTexture(128, 256, (g, w, hh) => {
      g.fillStyle = '#05070d'; g.fillRect(0, 0, w, hh);
      for (let y = 8; y < hh; y += 14) {
        g.fillStyle = '#141a2a'; g.fillRect(6, y, w - 12, 10);
        for (let x = 12; x < w - 12; x += 12) {
          const r = Math.random();
          if (r < 0.35) { g.fillStyle = r < 0.08 ? '#ffb000' : r < 0.12 ? '#ff3b5c' : r < 0.25 ? '#3ddc84' : '#19c3ff'; g.fillRect(x, y + 3, 4, 4); }
        }
      }
    });
    ledTex.wrapS = ledTex.wrapT = THREE.RepeatWrapping;
    this.ledTex = ledTex;
    const RACKS = 2 * 16;
    this.rackBodies = new THREE.InstancedMesh(new RoundedBoxGeometry(1.3, 3.4, 1.3, 2, 0.05), new THREE.MeshStandardMaterial({ color: 0x151a26, metalness: 0.8, roughness: 0.35 }), RACKS);
    this.rackFronts = new THREE.InstancedMesh(new THREE.PlaneGeometry(1.1, 3.1), new THREE.MeshBasicMaterial({ map: ledTex, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false }), RACKS);
    this.rackBodies.castShadow = true;
    s.add(this.rackBodies, this.rackFronts);

    // ---- data motes
    const N = 220;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) { pos[i * 3] = rand(-20, 20); pos[i * 3 + 1] = rand(0.3, 12); pos[i * 3 + 2] = rand(-50, 6); }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dot = canvasTexture(32, 32, (g, w) => { const r = g.createRadialGradient(16, 16, 0, 16, 16, 16); r.addColorStop(0, '#fff'); r.addColorStop(1, 'rgba(255,255,255,0)'); g.fillStyle = r; g.fillRect(0, 0, w, w); });
    this.motes = new THREE.Points(pg, new THREE.PointsMaterial({ map: dot, size: 0.16, color: 0xffd27a, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
    s.add(this.motes);

    // ---- shared crate parts
    this.crateGeo = new RoundedBoxGeometry(CRATE_W, CRATE_H, CRATE_D, 3, 0.08);
    this.faceGeo = new THREE.PlaneGeometry(CRATE_W - 0.1, CRATE_H - 0.1);
    this.glowTex = canvasTexture(256, 160, (g, w, hh) => {
      g.filter = 'blur(14px)';
      g.fillStyle = '#fff';
      roundRect(g, 26, 26, w - 52, hh - 52, 18);
      g.fill();
    });
    this.glowGeo = new THREE.PlaneGeometry(CRATE_W * 1.4, CRATE_H * 1.6);
    this.beamGeo = new THREE.CylinderGeometry(0.9, 0.9, 30, 24, 1, true);
    this.beamGeo.translate(0, 15, 0);

    // ---- the CRX of CRM systems (drives through on turbo)
    this.car = buildCRX();
    this.car.group.visible = false;
    this.car.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    s.add(this.car.group);

    this.applyLayout('landscape');
  }

  applyLayout(name) {
    if (this.layoutName === name) return;
    this.layoutName = name;
    this.L = LAYOUTS[name];
    const lanes = this.L.lanes;
    const gap = lanes[1] - lanes[0];
    this.halfW = lanes[2] + gap / 2;
    const bw = this.halfW * 2 + 0.3;
    this.beltBase.scale.x = bw;
    this.beltTop.scale.x = bw - 0.1;
    this.rollerTex.repeat.set(1, this.beltL / 1.2);
    this.rails[0].position.x = -bw / 2 - 0.05;
    this.rails[1].position.x = bw / 2 + 0.05;
    this.laneLines[0].position.x = (lanes[0] + lanes[1]) / 2;
    this.laneLines[1].position.x = (lanes[1] + lanes[2]) / 2;
    this.pufLabel.scale.setScalar(name === 'portrait' ? 0.75 : 1);
    // racks
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), sc = new THREE.Vector3(1, 1, 1);
    let i = 0;
    for (const side of [-1, 1]) for (let k = 0; k < 16; k++) {
      const x = side * (this.L.racks + (k % 2) * 0.05);
      const z = 3 - k * 2.9;
      q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -side * Math.PI / 2);
      m.compose(new THREE.Vector3(x, 1.7, z), q, sc);
      this.rackBodies.setMatrixAt(i, m);
      m.compose(new THREE.Vector3(x - side * 0.66, 1.75, z), q, sc);
      this.rackFronts.setMatrixAt(i, m);
      i++;
    }
    this.rackBodies.instanceMatrix.needsUpdate = true;
    this.rackFronts.instanceMatrix.needsUpdate = true;
  }

  // ================================================================== lifecycle
  enter() {
    this.mode = getMode();
    this.resize(window.innerWidth, window.innerHeight);
    const c = this.app.gfx.renderer.domElement;
    c.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('keydown', this.onKey);
    this.best = storeGet('conversion-best', 0);
    this.prewarm();
    this.resetWorld();
    this.showIntro();
    music.play('rush');
    music.setIntensity(-1);
  }

  exit() {
    const c = this.app.gfx.renderer.domElement;
    c.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('keydown', this.onKey);
    this.state = 'idle';
    this.resetWorld();
    clearUI();
    clearTimeout(this.consTimer);
    clearTimeout(this.crewTimer);
    clearInterval(this.typer);
    document.body.classList.remove('cv-paused');
  }

  resize(w, hgt) {
    const aspect = w / hgt;
    const portrait = aspect < 0.9;
    this.applyLayout(portrait ? 'portrait' : 'landscape');
    this.camera.aspect = aspect;
    this.camera.fov = this.L.fov;
    if (portrait) {
      this.camBase.set(0, 10.8, Z_END + 9.2);
      this.camLook.set(0, 0, Z_END - 9.5);
    } else {
      const short = hgt < 500;
      this.camBase.set(0, short ? 7.6 : 7.4, Z_END + (short ? 6.8 : 7.6));
      this.camLook.set(0, short ? -0.8 : -0.2, Z_END - 10.5);
    }
    this.camera.updateProjectionMatrix();
    this.camera.position.copy(this.camBase);
    this.camera.lookAt(this.camLook);
  }

  prewarm() {
    if (this.warmed) return;
    this.warmed = true;
    const far = new THREE.Vector3(300, -50, 0);
    this.effects.shatter({ colors: [0xffffff, 0x19c3ff, 0xff3b5c], goo: 0xff3b5c, cells: true }, far);
    this.effects.sparks(far, 0xffffff, 2);
    this.effects.shockwave(far, 0xffffff);
    this.car.group.visible = true;
    this.car.group.position.copy(far);
    this.app.gfx.renderer.compile(this.scene, this.camera);
    this.car.group.visible = false;
    this.effects.clear();
  }

  resetWorld() {
    for (const it of this.items) this.disposeItem(it);
    this.items.length = 0;
    for (const b of this.beams) this.scene.remove(b.mesh);
    this.beams.length = 0;
    for (const e of this.errors) this.scene.remove(e.sprite);
    this.errors.length = 0;
    if (this.bp) { this.scene.remove(this.bp.group); this.bp = null; }
    if (this.mascot) { this.scene.remove(this.mascot.group); this.mascot = null; }
    this.boss = null;
    this.carRun = null;
    this.car.group.visible = false;
    this.effects?.clear();
    this.alarm.intensity = 0;
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
    const intern = this.mode === 'intern';
    const modeBtn = (id, label, sub) => h(`button.cv-modebtn${this.mode === id ? '.on' : ''}`, {
      onclick: () => { sfx.click(); setMode(id); this.mode = getMode(); this.showIntro(); }
    }, [h('b', {}, label), h('small', {}, sub)]);
    mount(h('div.overlay', {}, h('div.card.panel.cv-intro', {}, [
      h('div.kicker', {}, 'Spiel 3 · Die SAP S/4HANA-Conversion'),
      h('h1', {}, 'Mission RC 0'),
      h('p', {}, intern
        ? 'Downtime-Wochenende, Samstag 18:00 bis Montag 06:00. Die Transporte rollen übers Band, der Berater schwitzt jetzt schon durchs Sakko. Importiere nur, was dran ist. Der Rest fliegt in den Puffer, wo er hingehört.'
        : 'Downtime-Wochenende, Samstag 18:00 bis Montag 06:00. Die Transporte rollen übers Band. Tippe nur die an, die jetzt dran sind, und lass alles andere in den Puffer rollen.'),
      h('div.cv-phaselist', {}, PHASES.map((p, i) => h('span.cv-ph', { style: `--c:${p.color}` }, [h('i', {}, String(i + 1)), p.short]))),
      h('div.legend.cv-legend', {}, [
        h('div', {}, [h('b', {}, '🚦 Return Codes'), 'RC 0 richtige Phase · RC 4 schon erledigt · RC 8 zu früh · RC 12 Müll. Bei 5 Kurzdumps ist das System hinüber.']),
        h('div', {}, [h('b', {}, '👹 Endgegner'), 'Mitten in der Conversion kommt der SAP Business Partner. Fehler abschießen, Köpfe treffen.']),
        h('div', {}, [h('b', {}, '🔮 Product Management'), `Das allwissende Orakel. ${PM_JOKERS}× fragen: Es zeigt die richtigen Transporte oder die Schwachstelle des Bosses.`]),
        h('div', {}, [h('b', {}, '🔥 CRX-Turbo'), 'RC 0 lädt den Turbo. Dann fährt die Ludlein Crew im CRX mit dickem Auspuff durch.'])
      ]),
      h('div.cv-crew', {}, [
        h('div.kicker', {}, 'Die Ludlein Crew · ' + CREW_TEAMS.join(' · ')),
        h('div.cv-crewrow', {}, CREW.map((c) => h('span.cv-crewchip', { style: `--c:${c.color}` }, [h('i', {}, c.ini), c.name])))
      ]),
      h('div.cv-mode', {}, [
        h('div.kicker', {}, 'Humor-Modus'),
        h('div.cv-modes', {}, [
          modeBtn('kunde', '🤝 Kunde & Partner', 'höflich und korrekt'),
          modeBtn('intern', '🌶️ Intern', 'dreckig, nur unter uns')
        ])
      ]),
      this.best ? h('p', {}, `Dein Rekord: ${this.best.toLocaleString('de-DE')} Punkte`) : null,
      h('div.row', {}, [h('button.btn', { onclick: () => { unlockAudio(); sfx.click(); this.startCountdown(); } }, '▶ Downtime starten')])
    ])));
  }

  buildHUD() {
    this.baseUI();
    const stat = (cls, label) => {
      const strong = h('strong', {}, '0');
      return { el: h(`div.stat.panel.${cls}`, {}, [h('small', {}, label), strong]), strong };
    };
    this.hud = { clock: stat('time', 'Downtime'), score: stat('score', 'Punkte'), combo: stat('combo', 'Combo'), dumps: stat('errors', 'ST22') };
    mount(h('div.hud.passthrough', {}, Object.values(this.hud).map((s) => s.el)));
    // phase tracker
    this.phaseChips = PHASES.map((p, i) => h('span.cv-chip', { style: `--c:${p.color}` }, [h('i', {}, String(i + 1)), h('em', {}, p.short)]));
    mount(h('div.cv-phases.passthrough', {}, this.phaseChips));
    // boss hit points (hidden until the boss shows up)
    this.bossBar = h('i');
    this.bossEl = mount(h('div.cv-boss.passthrough', {}, [h('b', {}, 'SAP Business Partner'), h('div.cv-bossbar', {}, this.bossBar), h('span.cv-bossline')]));
    // consultant
    this.consImg = h('div.cv-face', { html: consultantSVG(0) });
    this.consText = h('span.cv-say');
    this.sweatBar = h('i');
    this.consEl = mount(h('div.cv-cons.passthrough', {}, [
      this.consImg,
      h('div.cv-consinfo', {}, [h('b', {}, this.consultant.name), h('small', {}, this.consultant.title), h('div.cv-sweat', { title: 'Schweiß-o-Meter' }, [h('em', {}, 'Schweiß'), h('span', {}, this.sweatBar)])]),
      this.consText
    ]));
    this.sweatLevel = -1;
    // crew callouts
    this.crewIni = h('i');
    this.crewName = h('b');
    this.crewText = h('span');
    this.crewEl = mount(h('div.cv-crewbox.passthrough', {}, [this.crewIni, h('div', {}, [this.crewName, this.crewText])]));
    // controls
    this.pmCount = h('em');
    this.pmBtn = h('button.cv-btn.cv-pm', { title: 'Product Management fragen (Taste Q)', onpointerdown: (e) => { e.preventDefault(); this.askPM(); } }, [h('span.cv-ico', {}, '🔮'), h('span.cv-lbl', {}, 'PM fragen'), this.pmCount]);
    this.turboFill = h('i.cv-fill');
    this.turboBtn = h('button.cv-btn.cv-turbo', { title: 'CRX-Turbo (Leertaste)', onpointerdown: (e) => { e.preventDefault(); this.useTurbo(); } }, [this.turboFill, h('span.cv-ico', {}, '🔥'), h('span.cv-lbl', {}, 'CRX-Turbo')]);
    this.nowNum = h('i');
    this.nowName = h('strong');
    this.nowDots = h('span.cv-dots');
    this.nowEl = h('div.cv-now.panel', {}, [h('small', {}, 'Jetzt importieren'), h('div', {}, [this.nowNum, this.nowName]), this.nowDots]);
    mount(h('div.cv-controls', {}, [this.pmBtn, this.nowEl, this.turboBtn]));
    this.updateHUD();
    this.updatePhaseUI();
  }

  updateHUD() {
    if (!this.hud) return;
    this.hud.clock.strong.textContent = this.clockText();
    this.hud.clock.el.classList.toggle('low', this.elapsed > GAME_TIME - 12 && this.state === 'play');
    this.hud.score.strong.textContent = this.score.toLocaleString('de-DE');
    this.hud.combo.strong.textContent = `x${this.multiplier()}`;
    this.hud.dumps.strong.textContent = '▮'.repeat(this.dumps) + '▯'.repeat(Math.max(0, MAX_DUMPS - this.dumps));
    this.hud.dumps.strong.style.color = this.dumps >= 3 ? 'var(--bad)' : '';
    this.pmCount.textContent = `${this.jokers}×`;
    this.pmBtn.classList.toggle('empty', this.jokers <= 0);
    this.turboFill.style.transform = `scaleY(${clamp(this.turbo, 0, 1)})`;
    this.turboBtn.classList.toggle('ready', this.turbo >= 1);
  }

  updatePhaseUI() {
    if (!this.phaseChips) return;
    this.phaseChips.forEach((c, i) => {
      c.classList.toggle('done', i < this.phase);
      c.classList.toggle('on', i === this.phase);
    });
    const p = PHASES[Math.min(this.phase, PHASES.length - 1)];
    if (this.boss) {
      this.nowEl.style.setProperty('--c', '#5b8cff');
      this.nowEl.querySelector('small').textContent = 'Endgegner';
      this.nowNum.textContent = '!';
      this.nowName.textContent = 'Fehler & Köpfe antippen';
      this.nowDots.textContent = '';
      return;
    }
    this.nowEl.querySelector('small').textContent = 'Jetzt importieren';
    this.nowEl.style.setProperty('--c', p.color);
    this.nowNum.textContent = this.phase >= PHASES.length ? '✓' : String(this.phase + 1);
    this.nowName.textContent = this.phase >= PHASES.length ? 'Go-Live!' : p.short;
    this.nowDots.textContent = this.phase >= PHASES.length ? '' : '●'.repeat(this.phaseCount) + '○'.repeat(Math.max(0, PER_PHASE - this.phaseCount));
  }

  clockText(round = 1) {
    const m = CLOCK_START + CLOCK_LEN * clamp((this.elapsed || 0) / GAME_TIME, 0, 1);
    const day = Math.min(2, Math.floor(m / 1440));
    const mm = m % 1440;
    const min = Math.floor((mm % 60) / round) * round;
    return `${DAYS[day]} ${String(Math.floor(mm / 60)).padStart(2, '0')}:${String(min).padStart(2, '0')}`;
  }

  consultantSay(key, ms = 2200) { this.consultantLine(say(CONSULTANT_LINES[key], this.mode), ms); }

  consultantLine(text, ms = 2200) {
    if (!this.consEl) return;
    this.consText.textContent = text;
    this.consEl.classList.add('talk');
    clearTimeout(this.consTimer);
    this.consTimer = setTimeout(() => this.consEl?.classList.remove('talk'), ms);
  }

  crewSay(entry, ms = 2600) {
    if (!this.crewEl) return;
    const [id, pool] = entry;
    const c = crewById(id);
    this.crewEl.style.setProperty('--c', c.color);
    this.crewIni.textContent = c.ini;
    this.crewName.textContent = c.name;
    this.crewText.textContent = say(pool, this.mode);
    this.crewEl.classList.add('on');
    clearTimeout(this.crewTimer);
    this.crewTimer = setTimeout(() => this.crewEl?.classList.remove('on'), ms);
  }

  popup(worldPos, text, cls) {
    const v = worldPos.clone().project(this.camera);
    const el = mount(h(`div.popup.${cls}`, {}, text));
    el.style.left = `${clamp((v.x * 0.5 + 0.5) * window.innerWidth, 90, window.innerWidth - 90)}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    setTimeout(() => el.remove(), 950);
  }

  banner(big, small, cls = '') {
    document.querySelector('.fb-banner')?.remove();
    const el = mount(h(`div.fb-banner.passthrough${cls}`, {}, [h('b', {}, big), small ? h('span', {}, small) : null]));
    setTimeout(() => el.remove(), cls.includes('quote') ? 3400 : 2200);
  }

  /** SAP-GUI style short dump dialog */
  dumpDialog(rc, it) {
    document.querySelector('.cv-dump')?.remove();
    const title = rc === 12 ? 'ABAP-Laufzeitfehler · Kurzdump' : 'Import mit Fehlern';
    const cause = rc === 12
      ? (it?.fake ? `Transport ${it.no} war ${it.stamp.toLowerCase()}` : `Transport ${it?.no || ''}: „${it?.text || 'unbekannt'}“`)
      : `Phase ${(it?.phase ?? 0) + 1} vor Phase ${this.phase + 1} importiert`;
    const el = mount(h('div.cv-dump.passthrough', {}, [
      h('header', {}, title),
      h('div', {}, [h('b', {}, `RC ${rc}`), h('span', {}, [h('strong', {}, rc === 12 ? 'TRANSPORT_ABGEBROCHEN' : 'REIHENFOLGE_VERLETZT'), h('br'), cause])])
    ]));
    setTimeout(() => el.remove(), 1500);
    mount(h('div.errflash.passthrough'));
    setTimeout(() => document.querySelector('.errflash')?.remove(), 650);
  }

  // ================================================================== flow
  startCountdown() {
    this.mode = getMode();
    this.score = 0; this.combo = 0; this.bestCombo = 0; this.elapsed = 0;
    this.phase = 0; this.phaseCount = 0; this.dumps = 0;
    this.rc = { 0: 0, 4: 0, 8: 0, 12: 0 };
    this.junkOk = 0; this.missedCur = 0;
    this.spawnTimer = 0.8;
    this.jokers = PM_JOKERS; this.tired = 0; this.asked = 0;
    this.turbo = 0; this.turbos = 0;
    this.reveal = 0; this.weak = 0;
    this.bossDone = null; // 'won' | 'left'
    this.bossStartAt = null;
    this.sweat = 0;
    this.headsKilled = 0; this.errorsShot = 0;
    this.consultant = pick(CONSULTANTS);
    this.resetWorld();
    this.buildHUD();
    this.state = 'countdown';
    music.play('rush');
    music.setIntensity(-1);
    const cd = mount(h('div.countdown.passthrough'));
    let n = 3;
    const tick = () => {
      if (this.state !== 'countdown') { cd.remove(); return; }
      cd.replaceChildren(h('span', {}, n > 0 ? String(n) : 'Sa 18:00!'));
      sfx.beep(n === 0);
      if (n === 0) {
        this.state = 'play';
        music.setIntensity(0);
        sfx.drop();
        this.consultantSay('start', 2600);
        setTimeout(() => cd.remove(), 800);
        return;
      }
      n--;
      setTimeout(tick, 650);
    };
    tick();
  }

  multiplier() { return Math.min(4, 1 + Math.floor((this.combo || 0) / 4)); }

  difficulty() {
    const p = clamp(this.elapsed / GAME_TIME, 0, 1);
    return {
      interval: lerp(1.6, 0.95, p),
      life: lerp(7.6, 4.8, p),
      maxActive: 3 + Math.floor(p * 2.2),
      junk: 0.26 + p * 0.08,
      fake: this.elapsed > 26 ? 0.32 : 0
    };
  }

  // ================================================================== crates
  spawn() {
    const lanes = [0, 1, 2].filter((l) => !this.items.some((it) => it.lane === l && it.state === 'fly' && it.k < 0.24));
    if (!lanes.length) return false;
    const d = this.difficulty();
    const cur = this.phase;
    const curOnBelt = this.items.some((it) => it.state === 'fly' && it.kind === 'phase' && it.phase === cur && !it.fake);
    const it = { lane: pick(lanes), k: 0, life: d.life * rand(0.92, 1.08), state: 'fly', t: 0, no: transportNo() };
    const r = Math.random();
    if (!curOnBelt || r > d.junk) {
      it.kind = 'phase';
      const r2 = Math.random();
      let ph = cur;
      if (curOnBelt && r2 < 0.2 && cur < PHASES.length - 1) ph = Math.min(PHASES.length - 1, cur + 1 + (Math.random() < 0.3 ? 1 : 0));
      else if (curOnBelt && r2 < 0.38 && cur > 0) ph = Math.max(0, cur - 1 - (Math.random() < 0.3 ? 1 : 0));
      it.phase = ph;
      it.text = pick(PHASES[ph].flavor);
    } else if (Math.random() < d.fake) {
      // looks like the current phase, but carries a nasty stamp
      it.kind = 'phase';
      it.fake = true;
      it.phase = cur;
      it.text = pick(PHASES[cur].flavor);
      it.stamp = pick(poolFor(FAKE_STAMPS, this.mode));
    } else {
      it.kind = 'junk';
      it.text = pick(poolFor(JUNK, this.mode));
      it.owner = pick(JUNK_OWNERS);
    }
    this.buildCrate(it);
    this.items.push(it);
    this.placeItem(it, 0);
    sfx.pop();
    return true;
  }

  buildCrate(it) {
    const junk = it.kind === 'junk';
    const P = junk ? null : PHASES[it.phase];
    const accent = junk ? '#b9a27a' : P.color;
    const tex = canvasTexture(640, 362, (g, w, hh) => {
      // cardboard / coloured transport box
      const bg = g.createLinearGradient(0, 0, 0, hh);
      if (junk) { bg.addColorStop(0, '#5b4a33'); bg.addColorStop(1, '#3a2e1f'); } else { bg.addColorStop(0, '#152040'); bg.addColorStop(1, '#0a1124'); }
      g.fillStyle = bg;
      roundRect(g, 0, 0, w, hh, 26); g.fill();
      g.strokeStyle = accent; g.lineWidth = 10;
      roundRect(g, 6, 6, w - 12, hh - 12, 22); g.stroke();
      // header line
      g.fillStyle = accent;
      g.fillRect(6, 70, w - 12, 4);
      g.font = `800 34px ui-monospace, Menlo, Consolas, monospace`;
      g.textBaseline = 'middle';
      g.fillText(it.no, 32, 40);
      g.textAlign = 'right';
      g.font = `700 28px ${FONT}`;
      g.fillStyle = 'rgba(255,255,255,0.7)';
      g.fillText(junk ? `von ${it.owner}` : 'Workbench', w - 30, 40);
      g.textAlign = 'left';
      if (junk) {
        const words = it.text.split(' ');
        let size = 58, lines;
        for (;;) {
          g.font = `800 ${size}px ${FONT}`;
          lines = [];
          let line = '';
          for (const wd of words) {
            const test = line ? `${line} ${wd}` : wd;
            if (g.measureText(test).width > w - 70 && line) { lines.push(line); line = wd; } else line = test;
          }
          lines.push(line);
          if (lines.length <= 3 || size <= 34) break;
          size -= 4;
        }
        g.fillStyle = '#fff3dc';
        const top = 118 + (3 - lines.length) * size * 0.5;
        lines.forEach((l, i) => g.fillText(l, 34, top + i * size * 1.12 + size / 2 - 10));
      } else {
        // big phase number + name
        g.fillStyle = accent;
        g.beginPath(); g.arc(104, 206, 74, 0, Math.PI * 2); g.fill();
        g.fillStyle = '#05070d';
        g.font = `900 104px ${FONT}`;
        g.textAlign = 'center';
        g.fillText(String(it.phase + 1), 104, 212);
        g.textAlign = 'left';
        g.fillStyle = '#ffffff';
        let size = 62;
        g.font = `900 ${size}px ${FONT}`;
        while (g.measureText(P.short).width > w - 230 && size > 34) g.font = `900 ${--size}px ${FONT}`;
        g.fillText(P.short, 204, 180);
        g.fillStyle = 'rgba(255,255,255,0.72)';
        size = 32;
        g.font = `700 ${size}px ${FONT}`;
        while (g.measureText(it.text).width > w - 230 && size > 18) g.font = `700 ${--size}px ${FONT}`;
        g.fillText(it.text, 204, 246);
        if (it.fake) {
          g.save();
          g.translate(w / 2 + 40, hh / 2 + 40);
          g.rotate(-0.22);
          g.strokeStyle = 'rgba(255,40,60,0.92)'; g.lineWidth = 8;
          g.font = `900 46px ${FONT}`;
          const sw = g.measureText(it.stamp).width + 40;
          roundRect(g, -sw / 2, -36, sw, 72, 10); g.stroke();
          g.fillStyle = 'rgba(255,40,60,0.92)';
          g.textAlign = 'center';
          g.fillText(it.stamp, 0, 2);
          g.restore();
        }
      }
    });
    const group = new THREE.Group();
    const col = new THREE.Color(junk ? 0x6b5536 : P.color);
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: junk ? col : col.clone().multiplyScalar(0.35), metalness: junk ? 0 : 0.4, roughness: junk ? 0.85 : 0.3, clearcoat: junk ? 0 : 1 });
    const body = new THREE.Mesh(this.crateGeo, bodyMat);
    body.castShadow = true;
    const face = new THREE.Mesh(this.faceGeo, new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, color: new THREE.Color(1.12, 1.12, 1.12) }));
    face.position.z = CRATE_D / 2 + 0.012;
    const glow = new THREE.Mesh(this.glowGeo, new THREE.MeshBasicMaterial({ map: this.glowTex, color: new THREE.Color(accent).multiplyScalar(1.4), transparent: true, opacity: 0.35, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false }));
    glow.position.z = -CRATE_D / 2 - 0.05;
    group.add(glow, body, face);
    group.scale.setScalar(this.L.scale);
    this.scene.add(group);
    Object.assign(it, { obj: group, body, face, glow, tex, color: col.getHex() });
  }

  disposeItem(it) {
    this.scene.remove(it.obj);
    it.tex?.dispose();
    for (const m of [it.body, it.face, it.glow]) m?.material.dispose();
  }

  placeItem(it, time) {
    const x = this.L.lanes[it.lane];
    const z = lerp(Z_SPAWN, Z_END, it.k);
    const s = this.L.scale;
    const shake = it.jitter > 0 ? Math.sin(it.jitter * 80) * 0.15 : 0;
    it.obj.position.set(x + shake, BELT_Y + (CRATE_H / 2) * s + Math.abs(Math.sin(time * 9 + it.lane)) * 0.02, z);
    it.obj.rotation.set(-0.42, 0, Math.sin(time * 1.7 + it.lane) * 0.02);
  }

  /** What the transport system says about importing this crate right now. */
  rcFor(it) {
    if (it.kind === 'junk' || it.fake) return 12;
    if (it.phase === this.phase) return 0;
    return it.phase < this.phase ? 4 : 8;
  }

  importCrate(it, viaTurbo = false) {
    if (!it || it.state !== 'fly') return;
    const rc = this.rcFor(it);
    const pos = it.obj.position.clone();
    this.rc[rc]++;
    if (rc === 0) {
      const prevMult = this.multiplier();
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const gain = (100 + Math.round((1 - it.k) * 60)) * this.multiplier();
      this.score += gain;
      this.turbo = Math.min(1, this.turbo + (viaTurbo ? 0 : 0.17));
      it.state = 'import';
      it.t = 0;
      it.from = pos;
      this.beam(pos, PHASES[it.phase].color);
      this.effects.sparks(pos, 0xffffff, 16);
      this.effects.sparks(pos, new THREE.Color(PHASES[it.phase].color).getHex(), 18);
      this.effects.shockwave(pos.clone().setY(BELT_Y), 0x3ddc84);
      this.popup(pos.clone().setY(pos.y + 1.4), `RC 0 · +${gain}`, 'good');
      if (it.phase === 1) setTimeout(() => this.popup(pos.clone().setY(pos.y + 0.6), `→ ${it.text}`, 'combo'), 120);
      sfx.zap((this.L.lanes[it.lane] || 0) / 4);
      sfx.chime();
      if (this.multiplier() > prevMult) { sfx.combo(this.multiplier()); this.popup(pos.clone().setY(pos.y + 2.2), `COMBO x${this.multiplier()}!`, 'combo'); }
      if (Math.random() < 0.18) this.consultantSay('ok', 1500);
      this.phaseCount++;
      if (this.phaseCount >= PER_PHASE) setTimeout(() => this.advancePhase(), viaTurbo ? 0 : 120);
      else this.updatePhaseUI();
    } else if (rc === 4) {
      this.combo = 0;
      this.score = Math.max(0, this.score - 50);
      it.state = 'import';
      it.t = 0;
      it.from = pos;
      this.beam(pos, '#ffcc4d');
      this.popup(pos.clone().setY(pos.y + 1.4), 'RC 4 · schon erledigt −50', 'combo');
      this.consultantSay('rc4', 1600);
      sfx.thud();
    } else {
      // RC 8 / 12: the import blows up
      this.combo = 0;
      this.score = Math.max(0, this.score - (rc === 12 ? 150 : 100));
      this.smash(it, pos, 0xff3b5c);
      this.popup(pos.clone().setY(pos.y + 1.4), `RC ${rc} · Kurzdump`, 'bad');
      this.dumpDialog(rc, it);
      this.consultantSay(rc === 12 ? 'rc12' : 'rc8', 2000);
      sfx.error();
      this.addDump();
    }
    this.updateHUD();
  }

  addDump() {
    this.dumps++;
    this.sweat = Math.min(4.4, this.sweat + 0.7);
    this.effects.shake = Math.max(this.effects.shake, 1);
    this.alarmT = 1.2;
    if (this.dumps === MAX_DUMPS - 1) setTimeout(() => this.consultantSay('dumps', 2200), 1600);
    this.updateHUD();
    if (this.dumps >= MAX_DUMPS) this.endGame('dumps');
  }

  beam(pos, color) {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(2), transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, side: THREE.DoubleSide });
    const m = new THREE.Mesh(this.beamGeo, mat);
    m.position.set(pos.x, BELT_Y, pos.z);
    m.scale.set(this.L.scale, 1, this.L.scale);
    this.scene.add(m);
    this.beams.push({ mesh: m, t: 0 });
  }

  smash(it, pos, color) {
    it.state = 'gone';
    this.items.splice(this.items.indexOf(it), 1);
    this.effects.shatter({ colors: [color, 0xffffff, it.color, 0x0d1430], goo: color, cells: true }, pos.clone().setY(Math.max(BELT_Y + 0.3, pos.y - 0.5)));
    this.effects.sparks(pos, 0xffffff, 26);
    this.effects.sparks(pos, color, 24);
    this.effects.shockwave(pos.clone().setY(BELT_Y), color);
    this.effects.flash(pos, color, 90);
    this.effects.shake = Math.max(this.effects.shake, 0.7);
    this.hitStop = 0.06;
    sfx.smash(rand(0.9, 1.1), pos.x / 5);
    this.disposeItem(it);
  }

  /** Crates that reach the end of the belt fall into the buffer. */
  dropToBuffer(it) {
    it.state = 'fall';
    it.t = 0;
    it.v = new THREE.Vector3(rand(-0.6, 0.6), 1.5, 4);
    const pos = it.obj.position.clone();
    const rc = this.rcFor(it);
    if (rc === 12) {
      this.junkOk++;
      this.score += 15;
      this.popup(pos.clone().setY(pos.y + 1), '+15 · richtig liegen gelassen', 'combo');
      if (Math.random() < 0.35) this.consultantSay('junkOk', 1400);
      sfx.chime();
    } else if (rc === 0) {
      this.missedCur++;
      this.combo = 0;
      this.popup(pos.clone().setY(pos.y + 1), 'im Puffer liegen geblieben', 'bad');
      if (Math.random() < 0.4) this.consultantSay('missed', 1600);
      sfx.rustle(0.7);
    }
    this.updateHUD();
  }

  advancePhase() {
    if (this.state !== 'play' && this.state !== 'oracle') return;
    if (this.phaseCount < PER_PHASE) return;
    const done = PHASES[this.phase];
    this.phase++;
    this.phaseCount = 0;
    this.score += 250;
    this.updatePhaseUI();
    this.updateHUD();
    if (this.phase >= PHASES.length) { this.endGame('golive'); return; }
    const next = PHASES[this.phase];
    if (done.id === 'uninstall') {
      sfx.sadTrombone();
      this.banner('R.I.P. altes CRM', say(done.done, this.mode), '.gold');
      this.consultantLine(this.mode === 'intern' ? 'Mach’s gut, altes CRM. Ich hab dich nie verstanden.' : 'Mach’s gut, altes CRM. Du warst immer für uns da.', 2600);
    } else {
      sfx.combo(3);
      this.banner(`Phase ${this.phase} geschafft!`, say(done.done, this.mode), '.extra');
    }
    setTimeout(() => {
      if (this.state !== 'play') return;
      this.banner(`Phase ${this.phase + 1}: ${next.short}`, next.name);
      if (next.id === 'sum' && !this.bossDone && !this.boss) {
        setTimeout(() => { if (this.state === 'play' && !this.boss && !this.bossDone) this.startBoss(); }, 1500);
      }
      if (next.id === 'newcrm') {
        this.runCar('arrive');
        this.crewSay(CREW_LINES.arrive[0], 2400);
        setTimeout(() => this.crewSay(CREW_LINES.arrive[1], 2400), 2500);
      }
    }, 2100);
  }

  // ================================================================== boss: SAP Business Partner
  startBoss() {
    if (this.boss || this.bossDone) return;
    // every crate on the belt gets swept off
    for (const it of this.items) {
      if (it.state !== 'fly') continue;
      it.state = 'sweep';
      it.t = 0;
      it.v = new THREE.Vector3((it.obj.position.x || rand(-1, 1)) * 2.5 + rand(-3, 3), rand(5, 9), rand(-2, 2));
      it.w = new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6));
    }
    if (!this.bp) {
      this.bp = buildBP();
      this.bp.group.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(this.bp.group);
    }
    const sc = this.layoutName === 'portrait' ? 0.82 : 1.05;
    this.bp.group.scale.setScalar(sc);
    this.bp.group.position.set(0, -9, -11);
    this.bp.group.visible = true;
    this.boss = { state: 'enter', t: 0, dur: 0, errTimer: 2.2, scale: sc };
    this.bossStartAt = this.elapsed;
    sfx.error();
    sfx.riser(1.2);
    this.effects.shake = 1.4;
    this.alarmT = 2;
    this.banner('ENDGEGNER!', 'SAP Business Partner', '.gold');
    this.consultantSay('boss', 2600);
    this.bossEl.classList.add('on');
    this.bossEl.querySelector('.cv-bossline').textContent = `„${say(BP_LINES.enter, this.mode)}“`;
    this.updateBossBar();
    this.updatePhaseUI();
    music.setIntensity(4);
    this.sweat = Math.min(4.4, this.sweat + 1);
  }

  updateBossBar() {
    if (!this.bp) return;
    const hp = this.bp.heads.reduce((a, hd) => a + Math.max(0, hd.hp), 0);
    const max = this.bp.heads.reduce((a, hd) => a + hd.max, 0);
    this.bossBar.style.transform = `scaleX(${hp / max})`;
  }

  spawnError() {
    const alive = this.bp.heads.filter((hd) => hd.alive);
    if (!alive.length) return;
    const head = pick(alive);
    const from = head.skull.getWorldPosition(new THREE.Vector3());
    const text = pick(poolFor(BP_ERRORS, this.mode));
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: errorTexture(text), transparent: true, depthWrite: false, toneMapped: false }));
    const s = this.layoutName === 'portrait' ? 1 : 1.2;
    sprite.scale.set(2.6 * s, 1.0 * s, 1);
    sprite.position.copy(from);
    this.scene.add(sprite);
    const to = new THREE.Vector3(rand(-this.halfW + 1, this.halfW - 1), 3.0, Z_END - 0.8);
    const life = lerp(3.4, 2.5, clamp((this.boss.dur) / BOSS_MAX, 0, 1));
    this.errors.push({ sprite, from, to, k: 0, life, text });
    head.mouthT = 0.4;
    sfx.whoosh();
  }

  shootError(e) {
    const pos = e.sprite.position.clone();
    this.scene.remove(e.sprite);
    e.sprite.material.dispose();
    this.errors.splice(this.errors.indexOf(e), 1);
    this.errorsShot++;
    const gain = 40 * this.multiplier();
    this.score += gain;
    this.turbo = Math.min(1, this.turbo + 0.07);
    this.effects.sparks(pos, 0xff3b5c, 20);
    this.effects.sparks(pos, 0xffffff, 12);
    this.effects.flash(pos, 0xff6b6b, 40);
    this.popup(pos.clone().setY(pos.y + 0.6), `+${gain} · ${e.text} erledigt`, 'good');
    sfx.smash(1.4, pos.x / 6);
    this.updateHUD();
  }

  hitHead(head, dmg = 1) {
    if (!head.alive || !this.boss || this.boss.state !== 'fight') return;
    const d = dmg * (this.weak > 0 ? 2 : 1);
    head.hp -= d;
    head.hitT = 0.25;
    const pos = head.skull.getWorldPosition(new THREE.Vector3());
    this.effects.sparks(pos, head.def.color, 22);
    this.effects.sparks(pos, 0xffffff, 12);
    this.effects.flash(pos, head.def.color, 60);
    this.effects.shake = Math.max(this.effects.shake, 0.45);
    const gain = 50 * d;
    this.score += gain;
    this.turbo = Math.min(1, this.turbo + 0.03);
    this.popup(pos.clone().setY(pos.y + 1.2), `${this.weak > 0 ? 'Schwachstelle! ' : ''}+${gain}`, this.weak > 0 ? 'combo' : 'good');
    sfx.thud(pos.x / 6);
    if (head.hp <= 0) {
      head.alive = false;
      head.hp = 0;
      this.headsKilled++;
      this.score += 300;
      this.effects.shatter({ colors: [head.def.color, 0xffffff, 0x2456c9], goo: head.def.color, cells: false }, pos.clone().setY(pos.y - 0.6));
      this.effects.shockwave(pos.clone().setY(BELT_Y), head.def.color);
      this.effects.shake = 1.1;
      this.hitStop = 0.08;
      head.pivot.visible = false;
      head.neck.scale.y = 0.45;
      this.popup(pos.clone().setY(pos.y + 2), `${head.def.label} erledigt! +300`, 'combo');
      sfx.smash(0.7, pos.x / 6);
      sfx.splat(pos.x / 6);
      if (this.bp.heads.every((hd) => !hd.alive)) this.defeatBoss();
    }
    this.updateBossBar();
    this.updateHUD();
  }

  defeatBoss() {
    if (!this.boss) return;
    this.boss.state = 'down';
    this.boss.t = 0;
    this.bossDone = 'won';
    this.score += 1000;
    for (const e of [...this.errors]) { this.scene.remove(e.sprite); e.sprite.material.dispose(); }
    this.errors.length = 0;
    sfx.win();
    this.banner('BUSINESS PARTNER BESIEGT!', '+1.000 Punkte', '.extra');
    this.consultantSay('bossDown', 2400);
    this.bossEl.querySelector('.cv-bossline').textContent = `„${BP_LINES.defeat}“`;
    setTimeout(() => {
      if (this.state === 'play' || this.state === 'oracle') this.banner(`„${BP_LINES.defeat}“`, 'Der Business Partner bleibt. Als Freund.', '.gold.quote');
    }, 2300);
    this.updateHUD();
  }

  bossLeaves() {
    if (!this.boss) return;
    this.boss.state = 'leave';
    this.boss.t = 0;
    this.bossDone = 'left';
    for (const e of [...this.errors]) { this.scene.remove(e.sprite); e.sprite.material.dispose(); }
    this.errors.length = 0;
    this.banner('Der Business Partner zieht weiter', 'zum nächsten Projekt …', '.gold');
    this.consultantSay('bossLeft', 2400);
  }

  endBoss() {
    this.bossEl?.classList.remove('on');
    if (this.boss?.state === 'down' && this.bp) {
      // the beaten BP stays as a cute mascot next to the belt
      this.mascot = { group: this.bp.group, base: new THREE.Vector3(this.halfW + 1.6, 0, -6) };
      this.bp.group.scale.setScalar(0.28);
      this.bp.group.position.copy(this.mascot.base);
      this.bp.group.rotation.set(0, -0.5, 0);
      for (const hd of this.bp.heads) { hd.alive = true; hd.pivot.visible = true; hd.neck.scale.y = 1; hd.mat.emissiveIntensity = 0; }
      this.bp = null; // a new one is built if ever needed
    } else if (this.bp) {
      this.bp.group.visible = false;
    }
    this.boss = null;
    this.weak = 0;
    this.updatePhaseUI();
    music.setIntensity(this.phase >= 4 ? 3 : 2);
    this.spawnTimer = 0.8;
    // if the phase changed to SUM during the fight, the conversion continues right away
  }

  updateBoss(dt, time, playing) {
    const B = this.boss;
    if (!B || !this.bp) return;
    const G = this.bp.group;
    if (playing) { B.t += dt; }
    if (B.state === 'enter') {
      const k = clamp(B.t / 1.6, 0, 1);
      G.position.y = lerp(-9, 0, easeOutBack(k));
      this.effects.shake = Math.max(this.effects.shake, 0.4 * (1 - k));
      if (k >= 1) { B.state = 'fight'; B.t = 0; }
    } else if (B.state === 'fight') {
      if (playing) {
        B.dur += dt;
        B.errTimer -= dt;
        if (B.errTimer <= 0) {
          this.spawnError();
          B.errTimer = lerp(1.55, 1.0, clamp(B.dur / BOSS_MAX, 0, 1)) * rand(0.85, 1.15);
        }
        if (B.dur >= BOSS_MAX) this.bossLeaves();
      }
      G.position.x = Math.sin(time * 0.7) * 0.6;
      G.rotation.y = Math.sin(time * 0.9) * 0.12;
    } else if (B.state === 'down') {
      const k = clamp(B.t / 2.4, 0, 1);
      G.scale.set(B.scale * (1 + Math.sin(k * Math.PI) * 0.15), B.scale * lerp(1, 0.6, Math.min(1, k * 2)), B.scale);
      G.rotation.z = Math.sin(B.t * 20) * 0.05 * (1 - k);
      if (B.t > 3.2) this.endBoss();
    } else if (B.state === 'leave') {
      const k = clamp(B.t / 1.6, 0, 1);
      G.position.y = lerp(0, -10, k * k);
      if (k >= 1) this.endBoss();
    }
    if (!this.bp) return;
    // heads: bob, look at the camera, flash on hit
    this.bp.heads.forEach((hd, i) => {
      if (!hd.alive) return;
      hd.pivot.position.y = hd.base.y + Math.sin(time * 2.4 + i * 1.7) * 0.18;
      hd.pivot.position.x = hd.base.x + Math.sin(time * 1.6 + i) * 0.12;
      hd.pivot.rotation.z = Math.sin(time * 2 + i) * 0.12;
      hd.hitT = Math.max(0, (hd.hitT || 0) - dt);
      hd.mat.emissiveIntensity = hd.hitT > 0 ? 1.6 : this.weak > 0 ? 0.35 + Math.sin(time * 10) * 0.25 : 0;
      if (hd.mouthT > 0) { hd.mouthT -= dt; hd.pivot.scale.setScalar(1 + hd.mouthT * 0.4); } else hd.pivot.scale.setScalar(1);
      for (const p of hd.pupils) p.position.y = 0.15 + Math.sin(time * 3 + i) * 0.04;
    });
    this.bp.arms.forEach((a, i) => { a.rotation.z = (i ? 1 : -1) * (0.5 + Math.sin(time * 3 + i) * 0.35); });
  }

  // ================================================================== CRX turbo
  useTurbo() {
    if (this.state !== 'play') return;
    if (this.turbo < 1 || this.carRun) { this.turboBtn?.classList.add('nope'); setTimeout(() => this.turboBtn?.classList.remove('nope'), 300); return; }
    this.turbo = 0;
    this.turbos++;
    this.runCar('turbo');
    this.crewSay(pick(CREW_LINES.turbo), 2200);
    this.updateHUD();
  }

  runCar(mode) {
    const C = this.car;
    const span = this.halfW + 8;
    const z = mode === 'arrive' ? Z_END - 5 : Z_END - 2.2;
    C.group.visible = true;
    C.group.scale.setScalar(this.layoutName === 'portrait' ? 0.75 : 1);
    C.group.position.set(-span, BELT_Y + 0.05, z);
    C.group.rotation.set(0, 0, 0);
    this.carRun = { mode, t: 0, dur: mode === 'golive' ? 2.4 : 1.7, from: -span, to: span, fired: false };
    sfx.rev(this.carRun.dur * 0.75);
    this.effects.shake = Math.max(this.effects.shake, 0.6);
  }

  turboStrike() {
    const posFront = new THREE.Vector3(0, BELT_Y + 1, Z_END - 2);
    this.effects.flash(posFront, 0xff8a00, 120);
    if (this.boss && this.boss.state === 'fight' && this.bp) {
      for (const e of [...this.errors]) this.shootError(e);
      for (const hd of this.bp.heads) if (hd.alive) this.hitHead(hd, 2);
      return;
    }
    for (const it of [...this.items]) {
      if (it.state !== 'fly') continue;
      const rc = this.rcFor(it);
      if (rc === 0) this.importCrate(it, true);
      else {
        // burned, no penalty
        const pos = it.obj.position.clone();
        if (rc === 12) { this.score += 15; this.junkOk++; }
        this.smash(it, pos, 0xff8a00);
      }
    }
    this.updateHUD();
  }

  updateCar(dt, time) {
    const R = this.carRun;
    const C = this.car;
    if (!R) return;
    R.t += dt;
    const k = clamp(R.t / R.dur, 0, 1);
    const e = R.mode === 'arrive' ? (k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2) : k;
    const prevX = C.group.position.x;
    C.group.position.x = lerp(R.from, R.to, e);
    const v = (C.group.position.x - prevX) / Math.max(dt, 1e-4);
    C.group.rotation.z = Math.sin(R.t * 30) * 0.01 + (k < 0.15 ? 0.04 : 0);
    animateCRX(C, dt, time, v, R.mode === 'arrive' && k > 0.35 && k < 0.65 ? 0.6 : 1);
    if (Math.random() < dt * 6) this.effects.sparks(C.group.position.clone().add(new THREE.Vector3(-2.4, -0.2, 0.45)), 0xffa040, 4);
    if (!R.fired && k >= 0.5) {
      R.fired = true;
      if (R.mode === 'turbo') this.turboStrike();
      if (R.mode === 'golive') {
        for (let i = 0; i < 8; i++) setTimeout(() => {
          const p = new THREE.Vector3(rand(-5, 5), rand(2, 6), rand(Z_END - 14, Z_END - 4));
          this.effects.sparks(p, [0xffcc4d, 0x19c3ff, 0x50af30, 0xff3d9a][i % 4], 50);
          this.effects.flash(p, 0xffcc4d, 60);
        }, i * 140);
      }
    }
    if (k >= 1) { C.group.visible = false; this.carRun = null; }
  }

  // ================================================================== Product Management oracle
  askPM() {
    if (this.state !== 'play') return;
    if (this.jokers <= 0) { this.consultantSay('noJoker', 2200); sfx.thud(); return; }
    this.jokers--;
    this.asked++;
    this.state = 'oracle';
    document.body.classList.add('cv-paused');
    music.setIntensity(-1);
    sfx.oracle();
    const bossTime = !!this.boss;
    const question = say(PM_QUESTIONS, this.mode);
    const answer = say(PM_ANSWERS, this.mode);
    const tiredness = this.tired;
    this.tired = Math.min(3, this.tired + 1);
    const text = h('span');
    const btn = h('button.btn.gold', {}, 'Danke, Orakel!');
    const fig = h('div.cv-oraclefig', { html: oracleSVG(tiredness) });
    const box = mount(h('div.overlay.cv-oracle', {}, h('div.card.panel', {}, [
      h('div.kicker', {}, `Product Management · Das allwissende Orakel · noch ${this.jokers}×`),
      fig,
      h('div.cv-q', {}, [h('div.cv-qface', { html: consultantSVG(Math.min(4, Math.floor(this.sweat))) }), h('p', {}, [h('b', {}, `${this.consultant.name}: `), `„${question}“`])]),
      h('p.cv-a', {}, text),
      h('p.cv-effect', {}, bossTime ? PM_EFFECT.boss : PM_EFFECT.crates),
      h('div.row', {}, btn)
    ])));
    // the oracle gets visibly more tired while answering
    setTimeout(() => { fig.innerHTML = oracleSVG(this.tired); }, 1600);
    const full = `„${answer}“`;
    let n = 0;
    clearInterval(this.typer);
    this.typer = setInterval(() => {
      n += 2;
      text.textContent = full.slice(0, n);
      if (n >= full.length) clearInterval(this.typer);
    }, 28);
    btn.addEventListener('click', () => {
      sfx.click();
      clearInterval(this.typer);
      box.remove();
      document.body.classList.remove('cv-paused');
      if (this.state !== 'oracle') return;
      this.state = 'play';
      if (bossTime) this.weak = WEAK_TIME; else this.reveal = REVEAL_TIME;
      music.setIntensity(this.boss ? 4 : 2);
      sfx.drop();
      this.updateHUD();
      if (this.phaseCount >= PER_PHASE) this.advancePhase();
    });
    this.consultantSay('ask', 1800);
    this.updateHUD();
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
    // boss projectiles first, then heads
    if (this.errors.length) {
      const hits = this.raycaster.intersectObjects(this.errors.map((x) => x.sprite), false);
      if (hits.length) { this.shootError(this.errors.find((x) => x.sprite === hits[0].object)); return; }
      // generous fallback: nearest error near the tap
      for (const er of this.errors) {
        const p = er.sprite.position.clone().project(this.camera);
        if (Math.hypot(p.x - this.pointer.x, (p.y - this.pointer.y) / this.camera.aspect) < 0.1) { this.shootError(er); return; }
      }
    }
    if (this.boss && this.boss.state === 'fight' && this.bp) {
      const heads = this.bp.heads.filter((hd) => hd.alive);
      const hits = this.raycaster.intersectObjects(heads.map((hd) => hd.pivot), true);
      if (hits.length) {
        let o = hits[0].object;
        const hd = heads.find((x) => { let p = o; while (p) { if (p === x.pivot) return true; p = p.parent; } return false; });
        if (hd) { this.hitHead(hd); return; }
      }
      return;
    }
    const objs = this.items.filter((it) => it.state === 'fly').map((it) => it.obj);
    const hits = this.raycaster.intersectObjects(objs, true);
    if (hits.length) {
      let o = hits[0].object;
      while (o && !objs.includes(o)) o = o.parent;
      const it = this.items.find((x) => x.obj === o);
      if (it) this.importCrate(it);
    }
  }

  onKey(e) {
    if (this.state !== 'play') return;
    const k = e.key.toLowerCase();
    if (k === 'q' || k === 'p') { this.askPM(); return; }
    if (k === ' ' || k === 't') { e.preventDefault(); this.useTurbo(); return; }
    const n = parseInt(e.key, 10);
    if (n >= 1 && n <= 3) {
      if (this.boss) {
        const hd = this.bp?.heads[n - 1];
        if (this.errors.length) this.shootError(this.errors.reduce((a, b) => (b.k > a.k ? b : a)));
        else if (hd) this.hitHead(hd);
        return;
      }
      // frontmost crate in that lane
      let best = null;
      for (const it of this.items) if (it.state === 'fly' && it.lane === n - 1 && (!best || it.k > best.k)) best = it;
      if (best) this.importCrate(best);
    }
  }

  // ================================================================== end
  endGame(reason) {
    if (this.state !== 'play' && this.state !== 'oracle') return;
    this.state = 'over';
    document.body.classList.remove('cv-paused');
    document.querySelector('.cv-oracle')?.remove();
    clearInterval(this.typer);
    document.querySelector('.cv-controls')?.remove();
    this.consEl?.classList.remove('talk');
    this.bossEl?.classList.remove('on');
    for (const e of this.errors) this.scene.remove(e.sprite);
    this.errors.length = 0;
    if (this.boss && this.bp) this.bp.group.visible = false;
    if (this.boss && !this.bossDone) this.bossDone = 'lost';
    this.boss = null;
    this.reason = reason;
    let delay = 1600;
    if (reason === 'golive') {
      const left = Math.max(0, GAME_TIME - this.elapsed);
      this.bonus = Math.round(left * 25);
      this.score += this.bonus;
      sfx.win();
      music.setIntensity(3);
      this.runCar('golive');
      this.banner('GO-LIVE!', `${this.clockText(10)} · ${this.bonus ? `+${this.bonus.toLocaleString('de-DE')} Bonus für Restzeit` : 'Punktlandung'}`, '.extra');
      this.crewSay(CREW_LINES.golive[0], 2600);
      delay = 2600;
    } else if (reason === 'dumps') {
      sfx.avalanche();
      sfx.lose();
      music.stop(1.2);
      this.effects.shake = 1.6;
      this.alarmT = 3;
      this.banner('SYSTEMSTILLSTAND', 'Fünf Kurzdumps. ST22 ist voll.', '');
      for (const it of [...this.items]) if (it.state === 'fly') this.smash(it, it.obj.position.clone(), 0xff3b5c);
      delay = 2000;
    } else {
      sfx.timeUp();
      this.banner('MONTAG 06:00', 'Die User stehen vor der Tür …', '.gold');
    }
    for (const it of [...this.items]) { this.items.splice(this.items.indexOf(it), 1); this.disposeItem(it); }
    if (this.score > this.best) { this.best = this.score; storeSet('conversion-best', this.best); }
    this.updateHUD();
    setTimeout(() => this.showResults(), delay);
  }

  showResults() {
    if (this.state !== 'over') return;
    const rank = rankFor(this.score);
    const golive = this.reason === 'golive';
    const stats = {
      score: this.score, rc0: this.rc[0], dumps: this.dumps, phases: Math.min(PHASES.length, this.phase),
      boss: this.bossDone || 'none', golive,
      rank: rank.id, rankName: rank.name, rc: rank.rc, title: rank.title, line: rank.line
    };
    music.play('rush');
    music.setIntensity(golive ? 2 : -1);
    const kicker = golive ? `${this.clockText(10)} · Go-Live!` : this.reason === 'dumps' ? `${this.clockText(10)} · Systemstillstand` : 'Montag 06:00 · Downtime vorbei';
    const seen = {
      order: this.rc[8] > 0 || this.rc[4] > 0,
      rc: this.rc[8] + this.rc[12] > 0,
      addon: this.phase >= 3,
      backup: this.phase >= 2,
      sum: this.phase >= 4,
      bp: !!this.bossDone,
      readiness: false,
      mock: false
    };
    const cards = [...LEARN].sort((a, b) => Number(seen[b.id]) - Number(seen[a.id])).map((c) => h(`div.cv-learn${seen[c.id] ? '.seen' : ''}`, {}, [
      h('span.cv-licon', {}, c.icon),
      h('div', {}, [h('b', {}, c.title), seen[c.id] ? h('small', {}, 'heute erlebt') : null, h('p', {}, c.text)])
    ]));
    const intern = this.mode === 'intern';
    const sweatTxt = ['trocken wie ein Keks', 'leicht feucht', 'voller Achselflecken', 'komplett durchgeschwitzt', 'reif für ein frisches Hemd'][Math.min(4, Math.floor(this.sweat))];
    mount(h('div.overlay', {}, h('div.card.panel.cv-result', {}, [
      h('div.kicker', {}, kicker),
      h('h1', {}, `${this.score.toLocaleString('de-DE')} Punkte`),
      h('div', {}, h(`span.rank.${rank.id}`, {}, `${rank.name} · ${rank.rc}: ${rank.title}`)),
      h('p', {}, rank.line),
      h('div.cv-rcs', {}, [
        h('div.rc0', {}, [h('b', {}, String(this.rc[0])), 'RC 0']),
        h('div.rc4', {}, [h('b', {}, String(this.rc[4])), 'RC 4']),
        h('div.rc8', {}, [h('b', {}, String(this.rc[8])), 'RC 8']),
        h('div.rc12', {}, [h('b', {}, String(this.rc[12])), 'RC 12'])
      ]),
      h('div.fb-buzz', {}, [
        h('div', {}, [h('b', {}, `${Math.min(PHASES.length, this.phase)}/6`), 'Phasen']),
        h('div', {}, [h('b', {}, { won: '✓', left: '½', lost: '✗' }[this.bossDone] || '–'), { won: 'BP besiegt', left: 'BP überlebt', lost: 'BP hat gewonnen' }[this.bossDone] || 'kein BP']),
        h('div', {}, [h('b', {}, String(this.asked)), 'PM-Fragen'])
      ]),
      h('p.fb-note', {}, `${this.consultant.name} ist ${sweatTxt}. ${this.junkOk} ${this.junkOk === 1 ? 'Müll-Transport' : 'Müll-Transporte'} richtig liegen gelassen, ${this.turbos}× CRX-Turbo${intern ? ', und der Auspuff ist immer noch heiß.' : '.'}`),
      h('div.kicker', {}, 'Das steckt dahinter'),
      h('div.cv-learns', {}, cards),
      h('div.row', {}, [
        h('button.btn.gold', { onclick: () => { sfx.click(); this.app.showScene('conversion-finale', (a) => new ConversionFinale(a), { ...stats, mode: this.mode }); } }, '🏆 S4 Patent von S4HANNAH abholen'),
        h('button.btn.secondary', { onclick: () => { sfx.click(); this.startCountdown(); } }, '↻ Neue Downtime')
      ])
    ])));
  }

  // ================================================================== loop
  update(dt, time) {
    let wdt = dt;
    if (this.hitStop > 0) { this.hitStop -= dt; wdt = dt * 0.1; }
    const playing = this.state === 'play';

    if (playing) {
      this.elapsed += wdt;
      const p = this.elapsed / GAME_TIME;
      if (!this.boss) {
        this.spawnTimer -= wdt;
        const d = this.difficulty();
        if (this.spawnTimer <= 0) {
          const active = this.items.filter((it) => it.state === 'fly').length;
          if (active < d.maxActive) this.spawn();
          this.spawnTimer = d.interval * rand(0.8, 1.2);
        }
        if (!this.bossDone && this.elapsed >= BOSS_FALLBACK) this.startBoss();
      }
      this.reveal = Math.max(0, this.reveal - wdt);
      this.weak = Math.max(0, this.weak - wdt);
      // sweat: rises with stress, cools down slowly
      const stress = (this.boss ? 0.25 : 0) + (p > 0.8 ? 0.2 : 0);
      this.sweat = clamp(this.sweat + (stress - 0.05) * wdt, 0, 4.4);
      if (p > 0.84 && !this.lateSaid) { this.lateSaid = true; this.consultantSay('hurry', 2400); }
      if (p < 0.84) this.lateSaid = false;
      if (!this.boss) music.setIntensity(this.phase >= 4 || p > 0.8 ? 3 : this.phase >= 2 ? 2 : this.phase >= 1 ? 1 : 0);
      if (this.elapsed >= GAME_TIME) { this.elapsed = GAME_TIME; this.endGame('time'); }
      if (Math.floor((this.elapsed - wdt) * 4) !== Math.floor(this.elapsed * 4)) this.updateHUD();
    }

    // consultant portrait follows the sweat level
    if (this.consImg) {
      const lvl = Math.min(4, Math.floor(this.sweat || 0));
      if (lvl !== this.sweatLevel) { this.sweatLevel = lvl; this.consImg.innerHTML = consultantSVG(lvl); }
      this.sweatBar.style.transform = `scaleX(${clamp((this.sweat || 0) / 4.4, 0, 1)})`;
    }

    // ---- crates
    for (const it of [...this.items]) {
      if (it.state === 'fly') {
        if (playing && !this.boss) it.k += wdt / it.life;
        if (it.jitter > 0) it.jitter -= wdt;
        this.placeItem(it, time);
        // oracle reveal: right ones glow gold, wrong ones red
        const rc = this.rcFor(it);
        if (this.reveal > 0) {
          it.glow.material.opacity = 0.75 + Math.sin(time * 10) * 0.2;
          it.glow.material.color.setRGB(3, rc === 0 ? 2.2 : 0.3, 0.4);
        } else {
          it.glow.material.opacity = it.k > 0.8 ? 0.45 + Math.sin(time * 14) * 0.2 : 0.32;
          it.glow.material.color.set(it.kind === 'junk' ? 0xb9a27a : PHASES[it.phase].color).multiplyScalar(1.4);
        }
        if (playing && !this.boss && it.k >= 1) this.dropToBuffer(it);
      } else if (it.state === 'import') {
        it.t += dt;
        const k = clamp(it.t / 0.55, 0, 1);
        it.obj.position.set(it.from.x, it.from.y + k * k * 12, it.from.z - k * 2);
        it.obj.rotation.y += dt * 10;
        it.obj.scale.setScalar(this.L.scale * (1 - k * 0.6));
        if (k >= 1) { it.state = 'gone'; this.items.splice(this.items.indexOf(it), 1); this.disposeItem(it); }
      } else if (it.state === 'fall' || it.state === 'sweep') {
        it.t += dt;
        it.v.y -= 22 * dt;
        it.obj.position.addScaledVector(it.v, dt);
        if (it.w) { it.obj.rotation.x += it.w.x * dt; it.obj.rotation.y += it.w.y * dt; it.obj.rotation.z += it.w.z * dt; } else it.obj.rotation.x += dt * 3;
        if (it.t > 1.4) { it.state = 'gone'; this.items.splice(this.items.indexOf(it), 1); this.disposeItem(it); }
      }
    }

    // ---- import beams
    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i];
      b.t += dt;
      const k = b.t / 0.6;
      b.mesh.material.opacity = 0.6 * (1 - k);
      b.mesh.scale.x = b.mesh.scale.z = this.L.scale * (1 - k * 0.7);
      if (k >= 1) { this.scene.remove(b.mesh); b.mesh.material.dispose(); this.beams.splice(i, 1); }
    }

    // ---- boss errors flying at the player
    for (let i = this.errors.length - 1; i >= 0; i--) {
      const e = this.errors[i];
      if (playing) e.k += wdt / e.life;
      const k = clamp(e.k, 0, 1);
      e.sprite.position.lerpVectors(e.from, e.to, k);
      e.sprite.position.y += Math.sin(k * Math.PI) * 2.2;
      const s = (this.layoutName === 'portrait' ? 1 : 1.2) * lerp(0.7, 1.25, k);
      e.sprite.scale.set(2.6 * s, 1.0 * s, 1);
      e.sprite.material.rotation = Math.sin(time * 6 + i) * 0.08;
      if (playing && e.k >= 1) {
        this.scene.remove(e.sprite);
        e.sprite.material.dispose();
        this.errors.splice(i, 1);
        this.popup(e.to.clone(), `Treffer: ${e.text}`, 'bad');
        mount(h('div.errflash.passthrough'));
        setTimeout(() => document.querySelector('.errflash')?.remove(), 650);
        sfx.error();
        this.consultantSay('rc12', 1600);
        this.combo = 0;
        this.addDump();
        if (this.state !== 'play') break;
      }
    }

    this.updateBoss(dt, time, playing);
    if (this.mascot) {
      const M = this.mascot.group;
      M.position.y = this.mascot.base.y + Math.abs(Math.sin(time * 3)) * 0.12;
      M.rotation.y = -0.5 + Math.sin(time * 1.2) * 0.2;
    }
    this.updateCar(dt, time);

    // ---- world animation
    const moving = playing && !this.boss;
    const targetSpeed = moving ? 1 + clamp(this.elapsed / GAME_TIME, 0, 1) * 0.8 : 0.0;
    this.speed = lerp(this.speed, targetSpeed, clamp(dt * 3, 0, 1));
    this.rollerTex.offset.y += dt * this.speed * 0.9;
    this.ledTex.offset.y = Math.floor(time * 4) * 0.37;
    this.motes.position.z = ((this.motes.position.z + dt * 0.8) % 20);
    this.alarmT = Math.max(0, (this.alarmT || 0) - dt);
    const danger = playing ? clamp((this.dumps - 2) / 2, 0, 1) * 0.6 : 0;
    this.alarm.intensity = (this.alarmT > 0 ? 1 : danger) * (30 + Math.sin(time * 12) * 20);
    this.laneMat.color.setRGB(this.reveal > 0 ? 2.6 : 0.25, this.reveal > 0 ? 2.0 : 1.4, this.reveal > 0 ? 0.4 : 2.2);

    this.effects.update(wdt);
    const sh = this.effects.shake * this.effects.shake * 0.3;
    if (Math.abs(this.camera.fov - this.L.fov) > 0.05) { this.camera.fov = lerp(this.camera.fov, this.L.fov, clamp(dt * 3, 0, 1)); this.camera.updateProjectionMatrix(); }
    this.camLift = lerp(this.camLift || 0, this.boss ? (this.layoutName === 'portrait' ? 2.2 : 3.2) : 0, clamp(dt * 2.5, 0, 1));
    this.camera.position.set(this.camBase.x + rand(-sh, sh), this.camBase.y + rand(-sh, sh), this.camBase.z + rand(-sh, sh) * 0.5);
    this.camera.lookAt(this.camLook.x, this.camLook.y + this.camLift, this.camLook.z);
  }
}
