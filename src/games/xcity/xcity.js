import * as THREE from 'three';
import './xcity.css';
import { clamp, lerp, rand } from '../../core/gfx.js';
import { sfx, music, isMuted, setMuted, unlockAudio, createEngineSound } from '../../core/audio.js';
import { h, mount, clearUI, storeGet, storeSet } from '../../core/ui.js';
import { loadAvatar, buildAvatar } from '../../hub/avatar.js';
import { CarModel } from '../drive/cars.js';
import { carById } from '../drive/content.js';
import { Vehicle } from '../drive/vehicle.js';
import { World, ROADS, CURB, LANE } from './world.js';
import { Traffic, Pedestrians, Van, Cop, vanRoute } from './actors.js';
import { Particles } from './fx.js';
import { Hud } from './hud.js';
import { buildXTile, buildBeam } from './xtile.js';
import { createGradePass } from './grade.js';
import { INTRO, LINES, CHASE_CALLS, HIT_LINES, ESCAPE_CALLS, COP_HIT, FAIL, PASSED, CARD, PLACE_NAMES, fmtEuro } from './content.js';

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const V3 = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const SAVE = 'xcity';

// Parked cars you can take (any of them, GTA style).
const PARKED = [
  { id: 'fuenfer', x: -6, z: 40 - LANE, h: -Math.PI / 2, cfg: { color: 'blau', finish: 'metallic', drop: 30, spoiler: 'lip', parts: ['stripes'] }, main: true },
  { id: 'passat', x: ROADS[5] - LANE, z: -18, h: Math.PI },
  { id: 'volvo', x: -40 - LANE, z: 12, h: 0 },
  { id: 'skoda', x: 80, z: 120 + LANE, h: Math.PI / 2 }
];

export class XCityGame {
  constructor(app) {
    this.app = app;
    this.world = new World(app.gfx.renderer);
    this.scene = this.world.scene;
    this.camera = new THREE.PerspectiveCamera(60, 1, 0.3, 6000);
    this.keys = new Set();
    this.touch = { x: 0, y: 0, gas: false, brake: false, hand: false, sprint: false };
    this.camYaw = 0; this.camPitch = 0.22; this.camDrag = 0; this.camMode = 0;
    this.fx = new Particles(this.scene);
    this.traffic = new Traffic(this.scene, 30);
    this.peds = new Pedestrians(this.scene, this.world.pedLoops, 90);
    this.route = vanRoute();
    this.buildPlayer();
    this.buildCars();
    this.buildMarkers();
    this.onKey = this.onKey.bind(this);
    this.onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onWheel = (e) => { this.zoom = clamp((this.zoom || 1) + Math.sign(e.deltaY) * 0.12, 0.6, 1.8); };
  }

  // ================================================================== setup
  buildPlayer() {
    const av = buildAvatar(loadAvatar());
    const box = new THREE.Box3().setFromObject(av.root);
    const s = 1.8 / Math.max(0.5, box.max.y - box.min.y);
    av.root.scale.setScalar(s);
    const root = new THREE.Group();
    root.add(av.root);
    this.scene.add(root);
    this.P = { root, av, pos: root.position, heading: 0, vy: 0, y: CURB, phase: 0, speed: 0, health: 100, hitCool: 0 };
    // the X on Tim's back while on foot
    this.carryX = buildXTile(0.55, { glow: 0.9 });
    this.carryX.visible = false;
    this.scene.add(this.carryX);
  }
  buildCars() {
    this.cars = PARKED.map((p) => {
      const def = carById(p.id);
      const model = new CarModel(def, { ...def.def, ...(p.cfg || {}) });
      model.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
      this.scene.add(model.root);
      const V = new Vehicle(def, model.cfg);
      return { def, model, V, spawn: p, main: !!p.main };
    });
  }
  buildMarkers() {
    // mission checkpoint: glowing ring + beam
    const ringM = new THREE.MeshBasicMaterial({ color: new THREE.Color(0.6, 3.2, 0.6), transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false, side: THREE.DoubleSide });
    this.check = new THREE.Group();
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(9, 9, 1.6, 48, 1, true), ringM);
    ring.position.y = 0.8;
    this.check.add(ring, buildBeam(1.2, 40, 0x7dff6a));
    this.check.visible = false;
    this.scene.add(this.check);
    // marker over the car you should take / the X to grab (bouncing arrow)
    const arrow = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 4), new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 2.6, 0.4), toneMapped: false }));
    arrow.rotation.x = Math.PI;
    this.arrow = arrow;
    arrow.visible = false;
    this.scene.add(arrow);
  }

  // ================================================================== lifecycle
  enter() {
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    const c = this.app.gfx.renderer.domElement;
    c.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    c.addEventListener('wheel', this.onWheel, { passive: true });
    const G = this.app.gfx;
    G.renderer.toneMappingExposure = 0.9;
    G.bloom.strength = 0.2;
    G.bloom.threshold = 0.97;
    if (!this.grade) this.grade = createGradePass();
    G.composer.addPass(this.grade);
    this.save = storeGet(SAVE, { money: 0, best: null, done: 0 });
    this.buildUI();
    music.play('xcity');
    this.startMission(!!this.save.done && this.introSeen);
    this.introSeen = true;
  }
  exit() {
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    const c = this.app.gfx.renderer.domElement;
    c.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    c.removeEventListener('wheel', this.onWheel);
    this.engine?.stop(); this.engine = null;
    this.app.gfx.composer.removePass(this.grade);
    this.app.gfx.renderer.toneMappingExposure = 1.05;
    this.app.gfx.bloom.strength = 0.42;
    this.app.gfx.bloom.threshold = 0.92;
    this.keys.clear();
    this.hud?.destroy();
    clearUI();
  }
  resize(w, hh) {
    this.camera.aspect = w / hh;
    this.baseFov = w / hh < 1 ? 72 : 60;
    this.camera.updateProjectionMatrix();
  }

  buildUI() {
    clearUI();
    this.hud = new Hud(this);
    const mute = mount(h('button.icon-btn.right.xc-mute', { title: 'Ton an/aus', onclick: () => { setMuted(!isMuted()); this.engine?.mute(isMuted()); mute.textContent = isMuted() ? '🔇' : '🔊'; } }, isMuted() ? '🔇' : '🔊'));
    this.hud.setMoney(this.save.money);
    this.hud.setHint(this.hud.touch ? '' : '<kbd>WASD</kbd> laufen/fahren · <kbd>Shift</kbd> sprinten · <kbd>F</kbd> ein/aussteigen · <kbd>Leertaste</kbd> springen/Handbremse · <kbd>Maus ziehen</kbd> Kamera · <kbd>C</kbd> Kameraperspektive · <kbd>H</kbd> Hupe');
    setTimeout(() => this.hud?.setHint(''), 14000);
  }

  // ================================================================== mission
  resetWorld() {
    const W = this.world;
    W.setX(false);
    // player at the X-Platz, facing the Dienstwagen
    this.mode = 'foot';
    this.P.pos.set(-4, CURB, 26);
    this.P.heading = 0;
    this.P.root.visible = true;
    this.P.health = 100;
    this.P.vy = 0;
    this.camYaw = 0;
    this.active = null;
    this.engine?.stop(); this.engine = null;
    for (const c of this.cars) {
      const s = c.spawn;
      c.V.pos.set(s.x, 0, s.z); c.V.heading = s.h; c.V.speed = 0; c.V.lat = 0; c.V.yaw = 0; c.V.steer = 0;
      c.V.input = { throttle: 0, brake: 0, steer: 0, handbrake: 0 };
      c.model.root.position.copy(c.V.pos); c.model.root.rotation.y = s.h;
    }
    // van waiting at the itmX-Zentrale with the X on the roof
    if (this.van) this.scene.remove(this.van.root);
    this.van = new Van(this.scene, this.route);
    this.van.pos.set(-6, 0, -40 + LANE);
    this.van.heading = Math.PI / 2;
    this.van.integrate(0.016);
    this.van.x.visible = true;
    for (const c of this.cops || []) this.scene.remove(c.root);
    this.cops = [];
    this.hasX = false;
    this.carryX.visible = false;
    this.flyX = null;
    this.check.visible = false;
    this.stats = { t: 0, rams: 0, top: 0, knocked: 0, honks: 0 };
    this.timeScale = 1;
    this.clockMin = 18 * 60 + 42;
    this.hud.setStars(0);
    this.hud.showTarget(false);
    this.hud.hideBanner();
    this.closePanel();
  }
  startMission(skipIntro) {
    this.resetWorld();
    this.callIdx = 0;
    if (skipIntro) { this.setPhase('getcar'); return; }
    this.setPhase('intro');
  }
  setPhase(p) {
    this.phase = p;
    this.phaseT = 0;
    this.callIdx = 0;
    const H = this.hud;
    H.cinematic(p === 'intro' || p === 'finale');
    if (p === 'intro') { music.setIntensity(-1); this.introLine = 0; H.setObjective(''); this.fromIntro = true; }
    if (p === 'getcar') {
      music.setIntensity(0);
      H.setObjective(LINES.getcar);
      if (!this.fromIntro) H.showBanner('LUDLEIN BAY', 'OPERATION X', 'title', 3.2);
      this.fromIntro = false;
      if (!this.hud.touch) setTimeout(() => this.phase === 'getcar' && H.say('tim', 'Mein Dienstwagen. Na dann.', 3), 3500);
    }
    if (p === 'chase') {
      music.setIntensity(1);
      this.van.state = 'driving';
      sfx.horn(true);
      H.setObjective(LINES.chase);
      H.showBanner('VERFOLGUNGSJAGD', 'Cloudius haut ab!', 'small', 2.2);
      this.escapeT = 0;
    }
    if (p === 'wrecked') {
      this.van.wreck();
      this.timeScale = 0.3;
      sfx.crunch(2); sfx.boom?.(1);
      H.showBanner('VAN GESTOPPT', '', 'small', 2);
      H.showTarget(false);
      H.say('cloudius', 'Nein! Mein Silo! Meine … Wolke!', 3.5);
    }
    if (p === 'grab') { this.timeScale = 1; H.setObjective(LINES.grab); }
    if (p === 'escape') {
      music.setIntensity(2);
      H.setObjective(LINES.escape);
      H.setStars(3, true);
      H.showBanner('SILO-ALARM', '★★★', 'wanted', 2.4);
      this.spawnCops();
      this.check.position.set(0, CURB, 0);
      this.check.visible = true;
      sfx.siren(3);
      this.sirenT = 3.6;
    }
    if (p === 'finale') {
      music.setIntensity(0);
      this.check.visible = false;
      H.setObjective('');
      H.setStars(0);
      H.showTarget(false);
      this.finaleFrom = (this.mode === 'car' ? this.active.model.root.position.clone().add(V3(0, 2.2, 0)) : this.P.pos.clone().add(V3(0, 1.6, 0)));
      this.hasX = false;
      this.carryX.visible = false;
      this.flyX = buildXTile(0.55, { glow: 1 });
      this.flyX.position.copy(this.finaleFrom);
      this.scene.add(this.flyX);
      for (const c of this.cops) c.retreat = true;
      sfx.whoosh();
    }
    if (p === 'free') {
      H.setObjective(LINES.free);
      setTimeout(() => this.phase === 'free' && H.setObjective(''), 7000);
      music.setIntensity(0);
    }
  }
  skipCutscene() {
    if (this.phase === 'intro') this.setPhase('getcar');
    else if (this.phase === 'finale' && this.phaseT > 1) this.finishFinale();
  }

  spawnCops() {
    const spots = [];
    for (const x of ROADS) for (const z of ROADS) { const d = Math.hypot(x - this.focus().x, z - this.focus().z); if (d > 110 && d < 260) spots.push([x, z]); }
    spots.sort(() => Math.random() - 0.5);
    for (let k = 0; k < 3; k++) {
      const c = new Cop(this.scene);
      const [x, z] = spots[k % spots.length];
      c.pos.set(x, 0, z);
      c.heading = Math.atan2(this.focus().x - x, this.focus().z - z);
      c.integrate(0.016);
      this.cops.push(c);
    }
  }

  focus() { return this.mode === 'car' ? this.active.V.pos : this.P.pos; }
  focusVel() {
    if (this.mode === 'car') return this.active.V.forward.multiplyScalar(this.active.V.speed);
    return this.footVel || V3();
  }

  // ================================================================== input
  onKey(e) {
    const k = e.key.toLowerCase();
    if (this.panel && k !== 'escape') return;
    this.keys.add(k);
    unlockAudio();
    if (k === 'f' || k === 'enter') { if (this.phase === 'intro') this.skipCutscene(); else this.toggleVehicle(); }
    if (k === ' ' && this.mode === 'foot') this.jump();
    if (k === 'c') this.camMode = (this.camMode + 1) % 3;
    if (k === 'h') this.horn();
    if (k === 'escape') this.toggleMenu();
    if (k === 'm') { setMuted(!isMuted()); this.engine?.mute(isMuted()); }
    if ([' ', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'].includes(k)) e.preventDefault();
  }
  onDown(e) {
    unlockAudio();
    this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY };
  }
  onMove(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX; this.drag.y = e.clientY;
    this.camYaw -= dx * 0.006;
    this.camPitch = clamp(this.camPitch + dy * 0.004, -0.15, 1.1);
    this.camDrag = 2.2;
  }
  onUp(e) { if (this.drag && e.pointerId === this.drag.id) this.drag = null; }
  axis() {
    const k = this.keys, T = this.touch;
    let x = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
    let y = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
    if (Math.abs(T.x) > 0.05 || Math.abs(T.y) > 0.05) { x = T.x; y = -T.y; }
    return { x, y };
  }
  jump() { if (this.mode === 'foot' && this.P.y <= this.groundY() + 0.02) { this.P.vy = 5.2; sfx.whoosh(); } }
  horn() { if (this.mode === 'car') { sfx.horn(); this.stats.honks++; this.hornT = 0.6; } }

  toggleVehicle() {
    if (this.panel || this.phase === 'intro' || this.phase === 'finale' || this.entering) return;
    if (this.mode === 'car') return this.exitCar();
    // nearest car within reach
    let best = null, bd = 4.6;
    for (const c of this.cars) { const d = c.V.pos.distanceTo(this.P.pos); if (d < bd) { bd = d; best = c; } }
    if (!best) { this.hud.say('tim', 'Hier ist kein Auto. Geh näher ran.', 2); return; }
    const left = V3(Math.cos(best.V.heading), 0, -Math.sin(best.V.heading)); // left side of the car
    this.entering = { car: best, t: 0, from: this.P.pos.clone(), to: best.V.pos.clone().addScaledVector(left, 1.25).setY(this.P.pos.y) };
  }
  enterCar(car) {
    this.entering = null;
    this.mode = 'car';
    this.active = car;
    this.P.root.visible = false;
    this.engine = createEngineSound(car.def.ev ? 'ev' : 'ice');
    if (isMuted()) this.engine?.mute(true);
    sfx.rev?.(0.8);
    this.camYaw = car.V.heading;
    this.hud.setMode('car');
    if (this.phase === 'getcar') setTimeout(() => this.phase === 'getcar' && this.setPhase('chase'), 1200);
  }
  exitCar() {
    const car = this.active;
    if (Math.abs(car.V.speed) > 9) { this.hud.say('tim', 'Bei dem Tempo? Erst mal bremsen.', 1.8); return; }
    const V = car.V;
    const left = V3(Math.cos(V.heading), 0, -Math.sin(V.heading));
    this.P.pos.copy(V.pos).addScaledVector(left, 1.5);
    this.world.collide(this.P.pos, 0.4);
    this.P.pos.y = this.groundY();
    this.P.heading = V.heading;
    this.P.root.visible = true;
    V.input = { throttle: 0, brake: 0, steer: 0, handbrake: 1 };
    this.engine?.stop(); this.engine = null;
    this.mode = 'foot';
    this.active = null;
    this.hud.setMode('foot');
    this.hud.setSpeed(null);
  }

  // ================================================================== menu / panels
  toggleMenu(force) {
    if (this.panel && this.panel.dataset.kind === 'menu') { this.closePanel(); return; }
    if (this.panel || force === false) return;
    this.openPanel('menu', [
      h('h2', {}, 'Ludlein Bay'),
      h('p.xc-muted', {}, 'Operation X · ein Auftrag aus der itmX Spielewelt'),
      h('button.btn', { onclick: () => this.closePanel() }, '▶ Weiter'),
      h('button.btn.secondary', { onclick: () => { this.closePanel(); this.startMission(true); } }, '↻ Auftrag neu starten'),
      h('button.btn.secondary', { onclick: () => { this.closePanel(); this.introSeen = false; this.startMission(false); } }, '🎬 Intro ansehen'),
      h('div.xc-keys', { html: this.hud.touch
        ? 'Links: Stick zum Laufen/Lenken · rechts: 🚗 ein/aussteigen, ▲ Gas, ▼ Bremse/Rückwärts, Ⓗ Handbremse, 🏃 Sprint, ⤒ Springen · Wischen auf dem Bild dreht die Kamera.'
        : '<kbd>W A S D</kbd> laufen/fahren · <kbd>Shift</kbd> sprinten · <kbd>Leertaste</kbd> springen/Handbremse · <kbd>F</kbd> ein/aussteigen · <kbd>C</kbd> Kamera · <kbd>H</kbd> Hupe · <kbd>M</kbd> Ton · Maus ziehen: Kamera · Mausrad: Zoom' }),
      h('button.btn.secondary', { onclick: () => this.app.goHub() }, '⌂ Zur Spielewelt')
    ]);
  }
  openPanel(kind, children) {
    this.closePanel();
    this.panel = mount(h('div.xc-panel-wrap', { 'data-kind': kind }, [h('div.xc-panel.panel', {}, children)]));
    this.panel.dataset.kind = kind;
  }
  closePanel() { this.panel?.remove(); this.panel = null; }

  fail(kind) {
    if (this.phase === 'failed') return;
    const f = FAIL[kind];
    this.phase = 'failed';
    this.phaseT = 0;
    this.timeScale = 0.4;
    sfx.lose();
    this.hud.showBanner(f.title, f.sub, 'fail', 4);
    this.hud.setObjective('');
    this.hud.showTarget(false);
    setTimeout(() => {
      this.timeScale = 1;
      this.openPanel('fail', [
        h('h2.xc-red', {}, f.title),
        h('p', {}, f.sub),
        h('button.btn', { onclick: () => { this.closePanel(); this.startMission(true); } }, '↻ Nochmal versuchen'),
        h('button.btn.secondary', { onclick: () => this.app.goHub() }, '⌂ Zur Spielewelt')
      ]);
    }, 2600);
  }

  finishFinale() {
    if (this.phase !== 'finale') return;
    this.world.setX(true);
    if (this.flyX) { this.scene.remove(this.flyX); this.flyX = null; }
    const t = this.stats.t;
    const first = !this.save.done;
    this.save.done = (this.save.done || 0) + 1;
    this.save.money += PASSED.reward;
    const best = this.save.best == null || t < this.save.best;
    if (best) this.save.best = t;
    storeSet(SAVE, this.save);
    this.hud.setMoney(this.save.money);
    this.setPhase('free');
    for (const c of this.cops) this.scene.remove(c.root);
    this.cops = [];
    const fmtT = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
    this.openPanel('passed', [
      h('h2.xc-gold', {}, PASSED.title),
      h('p', {}, PASSED.sub),
      h('div.xc-stats', {}, [
        h('div', {}, [h('small', {}, 'Belohnung'), h('b', {}, '+ ' + fmtEuro(PASSED.reward))]),
        h('div', {}, [h('small', {}, 'Zeit'), h('b', {}, fmtT(t) + (best ? ' ★' : ''))]),
        h('div', {}, [h('small', {}, 'Rammstöße'), h('b', {}, String(this.stats.rams))]),
        h('div', {}, [h('small', {}, 'Spitze'), h('b', {}, `${Math.round(this.stats.top)} km/h`)]),
        h('div', {}, [h('small', {}, 'Gesundheit'), h('b', {}, `${Math.round(this.P.health)} %`)]),
        h('div', {}, [h('small', {}, 'Umgeschubste'), h('b', {}, String(this.stats.knocked))])
      ]),
      h('div.xc-card', {}, [h('small', {}, first ? 'Neue Lernkarte' : 'Lernkarte'), h('h3', {}, CARD.title), h('p', {}, CARD.text), h('a', { href: CARD.link, target: '_blank', rel: 'noopener' }, 'Mehr auf itmx.de ↗')]),
      h('button.btn', { onclick: () => { this.closePanel(); } }, '🌴 Freie Fahrt durch Ludlein Bay'),
      h('button.btn.secondary', { onclick: () => { this.closePanel(); this.startMission(true); } }, '↻ Auftrag nochmal'),
      h('button.btn.secondary', { onclick: () => this.app.goHub() }, '⌂ Zur Spielewelt')
    ]);
  }

  // ================================================================== update
  groundY() { return this.world.groundAt(this.P.pos.x, this.P.pos.z); }

  update(rawDt, time) {
    const paused = this.panel && this.panel.dataset.kind === 'menu';
    const dt = paused ? 0 : rawDt * this.timeScale;
    this.phaseT += dt;
    if (!['intro', 'finale', 'failed', 'free'].includes(this.phase)) this.stats.t += dt;
    this.clockMin += dt * 0.5;
    this.world.update(dt, time);
    if (this.grade) this.grade.uniforms.time.value = time % 10;
    this.fx.update(dt);
    if (this.phase === 'intro') { this.updateIntro(dt, time); this.updateAmbient(dt, time); this.hud.update(rawDt); return; }
    if (this.entering) this.updateEntering(dt);
    else if (this.mode === 'foot') this.updateFoot(dt, time);
    this.updateCars(dt);
    this.updateAmbient(dt, time);
    this.updateMission(dt, time);
    this.updateCamera(rawDt, dt);
    this.updateHud(dt, time);
    this.hud.update(rawDt);
  }

  updateEntering(dt) {
    const E = this.entering;
    E.t += dt / 0.45;
    const k = Math.min(1, E.t);
    this.P.pos.lerpVectors(E.from, E.to, k);
    const want = Math.atan2(E.car.V.pos.x - this.P.pos.x, E.car.V.pos.z - this.P.pos.z);
    this.P.heading += wrap(want - this.P.heading) * Math.min(1, dt * 12);
    this.animateAvatar(dt, 1);
    this.P.root.rotation.y = this.P.heading;
    if (E.t >= 1) this.enterCar(E.car);
  }

  updateFoot(dt) {
    const P = this.P, k = this.keys;
    const a = this.axis();
    const sprint = k.has('shift') || this.touch.sprint;
    const len = Math.min(1, Math.hypot(a.x, a.y));
    const speed = (sprint ? 7.8 : 4.4) * len;
    const vel = V3();
    if (len > 0.05) {
      // camera-relative movement
      const fw = V3(Math.sin(this.camYaw), 0, Math.cos(this.camYaw));
      const rt = V3(-fw.z, 0, fw.x);
      const dir = fw.multiplyScalar(a.y).addScaledVector(rt, a.x).normalize();
      vel.copy(dir).multiplyScalar(speed);
      const want = Math.atan2(dir.x, dir.z);
      P.heading += wrap(want - P.heading) * Math.min(1, dt * 12);
    }
    P.pos.addScaledVector(vel, dt);
    // cars are solid for pedestrians too
    for (const c of this.allCars()) {
      const dx = P.pos.x - c.pos.x, dz = P.pos.z - c.pos.z, d = Math.hypot(dx, dz), min = (c.r || 2.2) * 0.85 + 0.4;
      if (d < min && d > 1e-3) { P.pos.x += (dx / d) * (min - d); P.pos.z += (dz / d) * (min - d); }
    }
    this.world.collide(P.pos, 0.4);
    // gravity + ground
    const gy = this.groundY();
    P.vy -= 16 * dt;
    P.y += P.vy * dt;
    if (P.y < gy) { P.y = gy; P.vy = 0; }
    P.pos.y = P.y;
    this.footVel = vel;
    this.animateAvatar(dt, speed / 4.4, sprint);
    P.root.rotation.y = P.heading;
  }
  animateAvatar(dt, amount, sprint = false) {
    const P = this.P, av = P.av;
    P.speed = lerp(P.speed, Math.min(1.6, amount), Math.min(1, dt * 10));
    if (amount > 0.05) {
      const prev = Math.sin(P.phase);
      P.phase += dt * (sprint ? 13 : 9.5);
      if (prev * Math.sin(P.phase) < 0 && P.y <= this.groundY() + 0.05) sfx.step();
    }
    const sw = Math.sin(P.phase) * 0.7 * Math.min(1, P.speed);
    av.legs[0].rotation.x = sw; av.legs[1].rotation.x = -sw;
    av.arms[0].rotation.x = -sw * 0.9; av.arms[1].rotation.x = sw * 0.9;
    av.body.position.y = Math.abs(Math.cos(P.phase)) * 0.08 * Math.min(1, P.speed);
    av.body.rotation.x = sprint ? 0.12 * Math.min(1, P.speed) : 0;
  }

  allCars() {
    const out = [];
    for (const c of this.cars) out.push({ pos: c.V.pos, r: 2.3, ref: c, type: 'car' });
    if (this.van) out.push({ pos: this.van.pos, r: this.van.r, ref: this.van, type: 'van' });
    for (const c of this.cops) out.push({ pos: c.pos, r: c.r, ref: c, type: 'cop' });
    for (const c of this.traffic.cars) out.push({ pos: c.pos, r: c.r, ref: c, type: 'traffic' });
    return out;
  }

  updateCars(dt) {
    const k = this.keys, T = this.touch;
    for (const car of this.cars) {
      const V = car.V;
      if (car === this.active && !this.entering && this.phase !== 'finale') {
        const a = this.axis();
        const gas = k.has('w') || k.has('arrowup') || T.gas || (T.y < -0.5 && !T.brake && false);
        const brake = k.has('s') || k.has('arrowdown') || T.brake;
        V.input.throttle = gas ? 1 : 0;
        V.input.brake = brake ? 1 : 0;
        V.input.steer = -clamp(a.x, -1, 1);
        V.input.handbrake = k.has(' ') || T.hand ? 1 : 0;
      } else if (car === this.active) {
        V.input = { throttle: 0, brake: V.speed > 0.5 ? 1 : 0, steer: 0, handbrake: 1 };
      } else {
        V.input.throttle = 0; V.input.brake = Math.abs(V.speed) > 0.2 ? 0.6 : 0; V.input.steer = 0;
      }
      V.offroad = V.pos.x > 214;
      V.step(dt, { ground: this.world.groundAt(V.pos.x, V.pos.z) });
      this.collideCar(car, dt);
      const M = car.model;
      M.root.position.set(V.pos.x, V.y, V.pos.z);
      M.root.rotation.y = V.heading;
      M.animate(dt, V.speed, V.steer, V.ax, V.ay);
      M.setBrake(V.input.brake > 0 && V.speed > 0.3);
      M.setReverse(V.speed < -0.3);
      if (car === this.active) {
        const e = V.engine();
        this.engine?.update(e.rpm, e.load, Math.abs(V.speed));
        this.stats.top = Math.max(this.stats.top, V.kmh);
        if (V.input.handbrake && Math.abs(V.speed) > 10 && Math.random() < 0.5) this.fx.emit(V.pos.clone().addScaledVector(V.forward, -2).setY(0.3), { color: 0xcccccc, size: 1.4, life: 0.9, speed: 1, up: 0.6, grow: 2.2, smoke: true, opacity: 0.5 });
      }
    }
  }

  collideCar(car, dt) {
    const V = car.V;
    const f = V.forward;
    // walls: three circles along the body
    let nx = 0, nz = 0, hit = false;
    for (const off of [1.55, 0, -1.55]) {
      const p = V3(V.pos.x + f.x * off, 0, V.pos.z + f.z * off);
      const ox = p.x, oz = p.z;
      const n = this.world.collide(p, 1.05);
      if (n) { V.pos.x += p.x - ox; V.pos.z += p.z - oz; nx += n.x; nz += n.z; hit = true; }
    }
    const isPlayer = car === this.active;
    if (hit) {
      const l = Math.hypot(nx, nz) || 1;
      const impact = V.bump({ x: nx / l, z: nz / l });
      if (impact > 4 && isPlayer) { sfx.crunch(Math.min(2, impact / 10)); this.shake = Math.min(0.5, impact * 0.025); if (impact > 8) this.fx.sparks(V.pos.clone().addScaledVector(V3(nx / l, 0, nz / l), -2).setY(0.6), 10); }
    }
    // other vehicles
    const vel = f.clone().multiplyScalar(V.speed);
    for (const o of this.allCars()) {
      if (o.ref === car) continue;
      const dx = V.pos.x - o.pos.x, dz = V.pos.z - o.pos.z, d = Math.hypot(dx, dz), min = 2.25 + o.r * 0.95;
      if (d >= min || d < 1e-3) continue;
      const n = { x: dx / d, z: dz / d };
      const ov = min - d;
      const ovel = o.ref.vel || (o.type === 'car' ? o.ref.V.forward.multiplyScalar(o.ref.V.speed) : o.type === 'traffic' ? V3(Math.sin(o.ref.heading) * o.ref.speed, 0, Math.cos(o.ref.heading) * o.ref.speed) : V3());
      const rel = -((vel.x - ovel.x) * n.x + (vel.z - ovel.z) * n.z); // closing speed
      if (o.type === 'car') { o.ref.V.pos.x -= n.x * ov * 0.5; o.ref.V.pos.z -= n.z * ov * 0.5; V.pos.x += n.x * ov * 0.5; V.pos.z += n.z * ov * 0.5; if (rel > 1) o.ref.V.speed += 0; }
      else if (o.type === 'van' || o.type === 'cop') { V.pos.x += n.x * ov * 0.6; V.pos.z += n.z * ov * 0.6; o.ref.pos.x -= n.x * ov * 0.4; o.ref.pos.z -= n.z * ov * 0.4; if (rel > 1) o.ref.shove(-n.x * rel * 0.5, -n.z * rel * 0.5); }
      else { V.pos.x += n.x * ov; V.pos.z += n.z * ov; if (rel > 2) { o.ref.stun = 2.5; } }
      if (rel > 0.5) V.bump(n);
      if (!isPlayer) continue;
      if (rel > 3) { sfx.crunch(Math.min(2, rel / 9)); this.shake = Math.min(0.6, rel * 0.03); this.fx.sparks(V.pos.clone().addScaledVector(V3(n.x, 0, n.z), -2.2).setY(0.8), 8 + rel); }
      if (o.type === 'van') this.ramVan(rel);
      if (o.type === 'cop' && rel > 2.5) this.hurt(Math.min(14, 4 + rel * 0.6), o.ref);
      if (o.type === 'traffic' && rel > 3 && (this.hornCool || 0) <= 0) { this.hornCool = 2; setTimeout(() => sfx.horn(true), 250); }
    }
    this.hornCool = (this.hornCool || 0) - dt;
  }

  ramVan(rel) {
    const van = this.van;
    if (this.phase !== 'chase' || van.state !== 'driving' || rel < 2.5 || (this.ramCool || 0) > 0) return;
    this.ramCool = 0.45;
    const dmg = Math.min(34, rel * 2.3);
    van.hp -= dmg;
    van.wobble = 1;
    this.stats.rams++;
    if ((this.hitLineCool || 0) <= 0) { this.hud.say('cloudius', HIT_LINES[Math.floor(rand(0, HIT_LINES.length))], 2.4); this.hitLineCool = 3.2; }
    if (van.hp <= 0) { van.hp = 0; this.setPhase('wrecked'); }
  }
  hurt(n, src) {
    if (this.P.hitCool > 0 || this.phase === 'finale' || this.phase === 'free') return;
    this.P.hitCool = 1.1;
    this.P.health -= n;
    this.hud.setHealth(this.P.health);
    this.shake = 0.6;
    if (src && (this.copLineCool || 0) <= 0) { this.hud.say('funk', COP_HIT[Math.floor(rand(0, COP_HIT.length))].replace('Silo-Security: ', ''), 2.4); this.copLineCool = 5; }
    document.body.classList.add('xc-hit'); setTimeout(() => document.body.classList.remove('xc-hit'), 180);
    if (this.P.health <= 0) this.fail('wasted');
  }

  updateAmbient(dt, time) {
    const obstacles = [{ pos: this.focus(), r: 2.2 }];
    for (const c of this.cars) if (c !== this.active) obstacles.push({ pos: c.V.pos, r: 2.2 });
    if (this.van) obstacles.push({ pos: this.van.pos, r: 2.6 });
    for (const c of this.cops) obstacles.push({ pos: c.pos, r: 2.4 });
    if (this.mode === 'foot') obstacles[0].r = 0.8;
    this.traffic.update(dt, obstacles);
    const danger = [];
    if (this.mode === 'car') danger.push({ pos: this.active.V.pos, vel: this.active.V.forward.multiplyScalar(this.active.V.speed), r: 2.3 });
    if (this.van && this.van.state === 'driving') danger.push({ pos: this.van.pos, vel: this.van.vel, r: 2.5 });
    for (const c of this.cops) danger.push({ pos: c.pos, vel: c.vel, r: 2.3 });
    if (this.mode === 'foot') danger.push({ pos: this.P.pos, vel: this.footVel || V3(), r: 0.5 });
    this.peds.update(dt, time, danger, (p) => { void p; if (this.mode === 'car') { this.stats.knocked++; sfx.bonk(); } });
    // the van + cops
    if (this.van && this.phase !== 'intro') this.van.update(dt, time, this.focus());
    else if (this.van) this.van.update(dt, time, V3(9999, 0, 9999));
    for (const c of this.cops) {
      if (c.retreat) { c.speed *= Math.exp(-dt * 2); c.integrate(dt); c.bar[0].visible = c.bar[1].visible = false; continue; }
      c.update(dt, time, this.focus(), this.focusVel(), this.world);
      // on foot: cops can run you over
      if (this.mode === 'foot' && c.pos.distanceTo(this.P.pos) < c.r + 0.5 && Math.abs(c.speed) > 4) { this.hurt(12, c); this.P.vy = 4; const d = this.P.pos.clone().sub(c.pos).setY(0).normalize(); this.P.pos.addScaledVector(d, 1.2); }
    }
    // van smoke when damaged
    if (this.van && this.van.hp < 60 && Math.random() < (this.van.hp < 25 ? 0.6 : 0.25) * (dt > 0 ? 1 : 0)) {
      const p = this.van.pos.clone().addScaledVector(this.van.forward, 2).setY(1.6);
      this.fx.emit(p, { color: this.van.hp < 25 ? 0x333333 : 0x999999, size: 1.2, life: 1.6, speed: 1, up: 2.2, grow: 2.5, smoke: true, opacity: 0.6 });
    }
    if (this.van && this.van.state === 'wrecked' && Math.random() < 0.3) this.fx.emit(this.van.pos.clone().addScaledVector(this.van.forward, 2).setY(1.6), { color: 0xff7a2a, size: 0.8, life: 0.5, speed: 1, up: 2, additive: true });
  }

  updateMission(dt, time) {
    const H = this.hud;
    const ph = this.phase;
    const fp = this.focus();
    this.arrow.visible = false;
    this.P.hitCool -= dt;
    this.ramCool = (this.ramCool || 0) - dt;
    this.hitLineCool = (this.hitLineCool || 0) - dt;
    this.copLineCool = (this.copLineCool || 0) - dt;
    if (ph === 'getcar') {
      const car = this.cars.find((c) => c.main);
      this.arrow.visible = this.mode === 'foot';
      this.arrow.position.set(car.V.pos.x, 2.8 + Math.sin(time * 4) * 0.3, car.V.pos.z);
      this.arrow.rotation.y = time * 2;
      if (this.phaseT > 6 && this.mode === 'foot') H.setObjective(LINES.getcar + '<small>' + (H.touch ? 'Geh hin und tipp auf 🚗' : 'Geh hin und drück <kbd>F</kbd>') + '</small>');
    }
    if (ph === 'chase') {
      const d = this.van.pos.distanceTo(fp);
      H.showTarget(true, "Cloudius' Van", this.van.hp / 100, `${Math.round(d)} m`);
      if (this.mode === 'foot') H.setObjective(LINES.backToCar); else H.setObjective(LINES.chase);
      const call = CHASE_CALLS[this.callIdx];
      if (call && this.phaseT > call.at) { H.phone(call.who, call.text, 4.2); this.callIdx++; }
      if (d > 230) { this.escapeT += dt; if (this.escapeT > 1 && this.escapeT - dt <= 1) H.say('danny', 'Er entwischt dir! Gas!', 2.5); if (this.escapeT > 7) this.fail('escaped'); }
      else this.escapeT = Math.max(0, this.escapeT - dt * 2);
    }
    if (ph === 'wrecked' && this.phaseT > 0.6) this.setPhase('grab');
    if (ph === 'grab') {
      const back = this.van.pos.clone().addScaledVector(this.van.forward, -1.5);
      this.arrow.visible = true;
      this.arrow.position.set(this.van.pos.x, 5 + Math.sin(time * 4) * 0.3, this.van.pos.z);
      if (this.mode === 'car') H.setObjective(LINES.grab + '<small>' + (H.touch ? '🚗 zum Aussteigen' : '<kbd>F</kbd> zum Aussteigen') + '</small>');
      else if (this.P.pos.distanceTo(back) < 3.4 || this.P.pos.distanceTo(this.van.pos) < 3.4) {
        this.van.x.visible = false;
        this.hasX = true;
        sfx.powerup?.(); sfx.coin?.(3);
        this.fx.emit(this.P.pos.clone().setY(1.8), { n: 30, color: 0x7dff6a, size: 0.5, life: 0.8, speed: 5, additive: true });
        H.showBanner('DAS X', 'gesichert', 'small', 1.8);
        this.setPhase('escape');
      } else H.setObjective(LINES.grab);
    }
    if (ph === 'escape') {
      const call = ESCAPE_CALLS[this.callIdx];
      if (call && this.phaseT > call.at) { H.phone(call.who, call.text, 4.2); this.callIdx++; }
      H.setObjective(this.mode === 'foot' && fp.length() > 60 ? LINES.escape + '<small>Schneller geht es mit einem Auto.</small>' : LINES.escape);
      this.sirenT -= dt;
      const near = this.cops.some((c) => c.pos.distanceTo(fp) < 140);
      if (this.sirenT <= 0 && near) { sfx.siren(3); this.sirenT = 3.7; }
      H.setStars(3, near);
      if (Math.hypot(fp.x, fp.z) < 10.5) this.setPhase('finale');
    }
    if (ph === 'finale') {
      // the X flies from the player onto the pedestal
      if (this.flyX) {
        const k = Math.min(1, this.phaseT / 2.2);
        const e = k * k * (3 - 2 * k);
        const to = V3(0, CURB + 4.4, 0);
        this.flyX.position.lerpVectors(this.finaleFrom, to, e);
        this.flyX.position.y += Math.sin(e * Math.PI) * 8;
        this.flyX.scale.setScalar(lerp(1, 6.2, e));
        this.flyX.rotation.y = time * 6;
        if (k >= 1) {
          this.scene.remove(this.flyX); this.flyX = null;
          this.world.setX(true);
          sfx.win(); sfx.fanfare?.();
          this.shake = 0.4;
          this.hud.showBanner(PASSED.title, '+ ' + fmtEuro(PASSED.reward), 'passed', 5);
          this.fireworks = 4.5;
        }
      }
      if (this.fireworks > 0) {
        this.fireworks -= dt;
        if (Math.random() < dt * 5) this.fx.firework(V3(rand(-40, 40), rand(35, 70), rand(-40, 40)), [0xff3d9a, 0x19c3ff, 0x7dff6a, 0xffb000, 0xb56bff][Math.floor(rand(0, 5))]);
      }
      if (this.phaseT > 7.5) this.finishFinale();
    }
    // carried X
    if (this.hasX) {
      this.carryX.visible = true;
      if (this.mode === 'car') {
        const R = this.active.model.root;
        this.carryX.position.copy(R.position).add(V3(0, (this.active.model.roofTop || 1.4) + 0.55, 0)).addScaledVector(this.active.V.forward, -0.6);
        this.carryX.rotation.y = this.active.V.heading;
        this.carryX.scale.setScalar(1.2);
      } else {
        const f = V3(Math.sin(this.P.heading), 0, Math.cos(this.P.heading));
        this.carryX.position.copy(this.P.pos).add(V3(0, 1.35, 0)).addScaledVector(f, -0.32);
        this.carryX.rotation.y = this.P.heading;
        this.carryX.scale.setScalar(1);
      }
    }
    this.check.children[0].material.opacity = 0.55 + Math.sin(time * 4) * 0.25;
  }

  // ================================================================== camera
  updateIntro(dt, time) {
    const t = this.phaseT;
    const C = this.camera;
    const H = this.hud;
    const line = INTRO[this.introLine];
    if (line && t > line.t) { H.say(line.who, line.text, 4.2); this.introLine++; }
    if (t > 0.8 && !this.introTitle) { this.introTitle = true; H.showBanner('LUDLEIN BAY', 'OPERATION X', 'title', 3.4); }
    let pos, look;
    if (t < 4.2) { // over the ocean, gliding towards the skyline
      const k = t / 4.2;
      pos = V3(lerp(420, 300, k), lerp(40, 26, k), lerp(-120, -60, k));
      look = V3(0, 30, -20);
    } else if (t < 8.6) { // the empty pedestal on the X-Platz
      const a = (t - 4.2) * 0.35 + 0.6;
      pos = V3(Math.sin(a) * 15, 4.5, Math.cos(a) * 15);
      look = V3(0, 2.4, 0);
    } else if (t < 12.4) { // Cloudius' van at the itmX-Zentrale
      const k = (t - 8.6) / 3.8;
      const v = this.van.pos;
      pos = V3(v.x + lerp(-10, -5, k), lerp(2.2, 3.4, k), v.z + lerp(8, 7, k));
      look = V3(v.x + 1, 2.2, v.z);
    } else { // over Tim's shoulder towards the Dienstwagen
      const k = Math.min(1, (t - 12.4) / 3.6);
      const p = this.P.pos;
      pos = V3(p.x + lerp(4, 0.8, k), lerp(3.2, 2.4, k), p.z - lerp(-2, 4.2, k));
      look = V3(p.x - 2, 1.4, p.z + 10);
    }
    if (!this.introCam) this.introCam = { pos: pos.clone(), look: look.clone() };
    const cut = Math.abs(t - 4.2) < dt * 1.5 || Math.abs(t - 8.6) < dt * 1.5 || Math.abs(t - 12.4) < dt * 1.5;
    if (cut) { this.introCam.pos.copy(pos); this.introCam.look.copy(look); }
    this.introCam.pos.lerp(pos, Math.min(1, dt * 3));
    this.introCam.look.lerp(look, Math.min(1, dt * 3));
    C.position.copy(this.introCam.pos);
    C.lookAt(this.introCam.look);
    C.fov = this.baseFov || 60; C.updateProjectionMatrix();
    this.P.root.rotation.y = this.P.heading;
    this.animateAvatar(dt, 0);
    this.world.followSun(t < 4.2 ? V3(150, 0, -40) : t < 8.6 ? V3() : t < 12.4 ? this.van.pos : this.P.pos);
    for (const car of this.cars) car.model.animate(dt, 0, 0, 0, 0);
    if (t > 16.2) { this.introCam = null; this.introTitle = false; this.setPhase('getcar'); }
  }

  updateCamera(rawDt, dt) {
    const C = this.camera;
    const W = this.world;
    this.camDrag -= rawDt;
    let target, dist, height, fov = this.baseFov || 60;
    const zoom = this.zoom || 1;
    if (this.phase === 'finale') {
      // orbit the pedestal
      const a = this.phaseT * 0.35 + 0.4;
      const d = lerp(22, 30, Math.min(1, this.phaseT / 7));
      C.position.lerp(V3(Math.sin(a) * d, 7 + this.phaseT * 0.8, Math.cos(a) * d), Math.min(1, rawDt * 2.5));
      C.lookAt(0, 5, 0);
      C.fov = fov; C.updateProjectionMatrix();
      W.followSun(V3());
      return;
    }
    if (this.mode === 'car') {
      const V = this.active.V;
      target = V3(V.pos.x, V.y + 1.25, V.pos.z);
      // camera swings behind the car unless the player is looking around
      if (this.camDrag <= 0) {
        const back = V.speed < -1 ? V.heading + Math.PI : V.heading;
        this.camYaw += wrap(back - this.camYaw) * Math.min(1, rawDt * (Math.abs(V.speed) > 2 ? 3.2 : 1));
        this.camPitch += (0.2 - this.camPitch) * Math.min(1, rawDt * 2);
      }
      const sp = Math.abs(V.speed);
      dist = ([7.2, 11, 0.01][this.camMode] + sp * 0.045) * (this.camMode === 2 ? 1 : zoom);
      height = this.camMode === 1 ? 1.2 : 0.5;
      fov += Math.min(16, sp * 0.32);
      if (this.camMode === 2) { // bonnet cam
        const f = V.forward;
        C.position.set(V.pos.x + f.x * 0.6, V.y + 1.35, V.pos.z + f.z * 0.6);
        C.lookAt(V.pos.x + f.x * 20, V.y + 1.1, V.pos.z + f.z * 20);
        C.fov = fov; C.updateProjectionMatrix();
        W.followSun(V.pos);
        return;
      }
    } else {
      target = V3(this.P.pos.x, this.P.y + 1.55, this.P.pos.z);
      const moving = (this.footVel?.lengthSq() || 0) > 1;
      if (this.camDrag <= 0 && moving && !this.hud.touch) this.camYaw += wrap(this.P.heading - this.camYaw) * Math.min(1, rawDt * 0.8);
      dist = 4.6 * zoom;
      height = 0.35;
    }
    const cp = Math.cos(this.camPitch), sp2 = Math.sin(this.camPitch);
    const dir = V3(-Math.sin(this.camYaw) * cp, sp2, -Math.cos(this.camYaw) * cp);
    // pull the camera in front of walls
    let d = dist;
    for (let s = 1.2; s <= dist; s += 0.8) {
      const p = target.clone().addScaledVector(dir, s);
      if (W.blocked(p.x, p.z, p.y)) { d = Math.max(1.2, s - 0.8); break; }
    }
    const want = target.clone().addScaledVector(dir, d);
    want.y = Math.max(want.y + height, W.groundAt(want.x, want.z) + 0.5);
    if (!this.camInit) { C.position.copy(want); this.camInit = true; }
    C.position.lerp(want, Math.min(1, rawDt * (this.mode === 'car' ? 9 : 12)));
    this.shake = Math.max(0, (this.shake || 0) - rawDt * 1.8);
    if (this.shake > 0) C.position.add(V3(rand(-1, 1) * this.shake * 0.4, rand(-1, 1) * this.shake * 0.4, rand(-1, 1) * this.shake * 0.4));
    C.lookAt(target);
    C.fov += (fov - C.fov) * Math.min(1, rawDt * 3);
    C.updateProjectionMatrix();
    W.followSun(target);
    void dt;
  }

  updateHud(dt, time) {
    const H = this.hud;
    H.setClock(this.clockMin);
    H.setHealth(this.P.health);
    const fp = this.focus();
    if (this.mode === 'car') H.setSpeed(this.active.V.kmh); else H.setSpeed(null);
    // zone name
    let zone = PLACE_NAMES[0], zd = Infinity;
    for (const p of PLACE_NAMES) { const d = Math.hypot(fp.x - p.x, fp.z - p.z); if (d < zd) { zd = d; zone = p; } }
    if (fp.x > 205) zone = { name: 'Ludlein Beach' };
    H.setZone(zone.name);
    // radar at ~20 fps
    this.radarT = (this.radarT || 0) - dt;
    if (this.radarT > 0) return;
    this.radarT = 0.05;
    const blips = [];
    blips.push({ x: 0, z: 0, color: '#50af30', label: 'X', size: 7, edge: true, shape: 'square' });
    for (const c of this.cars) if (c !== this.active) blips.push({ x: c.V.pos.x, z: c.V.pos.z, color: c.main && this.phase === 'getcar' ? '#ffd400' : '#9fb4ff', size: c.main && this.phase === 'getcar' ? 6 : 3.5, edge: c.main && this.phase === 'getcar' });
    if (this.van && ['chase', 'wrecked', 'grab'].includes(this.phase)) blips.push({ x: this.van.pos.x, z: this.van.pos.z, color: this.phase === 'chase' ? '#ff3b3b' : '#7dff6a', size: 7, edge: true });
    for (const c of this.cops) blips.push({ x: c.pos.x, z: c.pos.z, color: Math.sin(time * 12) > 0 ? '#ff3b3b' : '#3b7bff', size: 5, edge: true });
    if (this.phase === 'escape') blips.push({ x: 0, z: 0, color: '#ffd400', size: 8, edge: true });
    const heading = this.mode === 'car' ? this.active.V.heading : this.P.heading;
    const range = this.mode === 'car' ? 90 + Math.min(80, this.active.V.kmh * 0.5) : 70;
    H.drawRadar(this.world.mapImage, fp, this.camYaw, heading, blips, range);
  }
}
