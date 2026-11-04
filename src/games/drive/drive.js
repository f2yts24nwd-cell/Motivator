import * as THREE from 'three';
import './drive.css';
import { sfx, music, isMuted, setMuted, unlockAudio, primeSong, createEngineSound } from '../../core/audio.js';
import { SONGS } from '../../core/songs.js';
import { h, mount, clearUI } from '../../core/ui.js';
import { canvasTexture } from '../../core/gfx.js';
import { Showroom, showroomUI } from './showroom.js';
import { CarModel } from './cars.js';
import { Vehicle } from './vehicle.js';
import { World, PLACES, CHARGERS, RACE, LEAD_SPOTS } from './world.js';
import { Traffic } from './traffic.js';
import { Hud } from './hud.js';
import {
  loadProgress, saveProgress, carById, CARS, MISSIONS, missionById, MISSION_LINES, LINES, CALLERS, QUOTA, BLITZ_FINE,
  getMode, setMode, say, fmtEuro, SCHULTERKLAPPEN
} from './content.js';

// Spiel 6: "Ludlein Drive". Showroom (itmX Fuhrpark) -> open city with missions.
// Everything happens from inside the car: calls via hands-free, answers via buttons or keys 1-3.

const CAMS = ['chase', 'far', 'hood'];
const BRIEFER = { fraesfix: 'danny', messe: 'karla', regalriese: 'palette', rennen: 'danny' };
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

function beamTexture() {
  return canvasTexture(64, 256, (g, w, hh) => {
    const gr = g.createLinearGradient(0, 0, 0, hh);
    gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.6, 'rgba(255,255,255,0.35)'); gr.addColorStop(1, 'rgba(255,255,255,0.85)');
    g.fillStyle = gr; g.fillRect(0, 0, w, hh);
  });
}
function iconTexture(icon, color) {
  return canvasTexture(128, 128, (g, w, hh) => {
    g.fillStyle = color; g.beginPath(); g.arc(w / 2, hh / 2, 58, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#ffffff'; g.lineWidth = 6; g.stroke();
    g.font = '64px system-ui, "Apple Color Emoji", "Segoe UI Emoji"'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(icon, w / 2, hh / 2 + 4);
  });
}

export class DriveGame {
  constructor(app) {
    this.app = app;
    this.room = new Showroom(app);
    this.scene = this.room.scene;
    this.camera = this.room.camera;
    this.mode = 'idle';
    this.touch = { left: false, right: false, gas: false, brake: false };
    this.keys = new Set();
    this.tilt = 0;
    this.camMode = 0;
    this.onKey = this.onKey.bind(this);
    this.onKeyUp = this.onKeyUp.bind(this);
    this.onMotion = this.onMotion.bind(this);
  }

  // ================================================================== scene plumbing
  useScene(scene, camera) {
    this.scene = scene;
    this.camera = camera;
    this.app.gfx.renderPass.scene = scene;
    this.app.gfx.renderPass.camera = camera;
    this.resize(window.innerWidth, window.innerHeight);
  }
  enter() {
    this.P = loadProgress();
    window.addEventListener('keydown', this.onKey);
    window.addEventListener('keyup', this.onKeyUp);
    this.showShowroom(true);
  }
  exit() {
    this.radioHooks(false);
    window.removeEventListener('keydown', this.onKey);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('devicemotion', this.onMotion);
    this.room.detach();
    this.engine?.stop();
    this.engine = null;
    this.hud?.destroy();
    this.hud = null;
    if (this.M) this.endMission();
    this.mode = 'idle';
    clearUI();
  }
  resize(w, hh) {
    this.room.resize(w, hh);
    if (this.cam) {
      this.cam.aspect = w / hh;
      this.cam.updateProjectionMatrix();
    }
  }

  // ================================================================== showroom
  showShowroom(first = false) {
    this.mode = 'showroom';
    this.radioHooks(false);
    this.engine?.stop();
    this.engine = null;
    this.hud?.destroy();
    this.hud = null;
    clearUI();
    this.useScene(this.room.scene, this.room.camera);
    this.room.attach();
    mount(h('button.icon-btn.left', { title: 'Zurück zur Spielewelt', onclick: () => { sfx.click(); this.app.goHub(); } }, '⟵'));
    const mute = mount(h('button.icon-btn.right', { title: 'Ton an/aus', onclick: () => { setMuted(!isMuted()); mute.textContent = isMuted() ? '🔇' : '🔊'; } }, isMuted() ? '🔇' : '🔊'));
    const car = carById(this.P.car);
    const locked = car.locked && this.P.deals.length < car.locked;
    const startCar = locked ? CARS[0] : car;
    if (locked) this.P.car = startCar.id;
    this.room.showCar(startCar, this.P.configs[startCar.id]);
    this.room.focus('overview');
    this.ui = showroomUI(this.room, {
      progress: this.P,
      onSelect: (id, cfg, lock) => {
        if (!lock) { this.P.car = id; saveProgress(this.P); }
        this.room.showCar(carById(id), cfg);
      },
      onChange: (id, cfg) => {
        // a different body needs a new model, everything else is applied in place
        if (this.room.model && (this.room.model.cfg.body || null) !== (cfg.body || null) && carById(id).bodies) this.room.showCar(carById(id), cfg);
        else this.room.model?.apply(cfg);
        saveProgress(this.P);
      },
      onDrive: () => { unlockAudio(); if (this.P.radio !== false) primeSong(this.radioSong().src); this.startDrive(); }
    });
    // humor mode switch in the head panel
    const modeBtn = mount(h('button.dr-tool.big', { style: 'position:absolute;left:calc(64px + env(safe-area-inset-left));top:calc(12px + env(safe-area-inset-top));', title: 'Humor-Modus', onclick: () => { sfx.click(); setMode(getMode() === 'intern' ? 'kunde' : 'intern'); modeBtn.textContent = getMode() === 'intern' ? '🌶️ Intern' : '🤝 Kunde & Partner'; } }, getMode() === 'intern' ? '🌶️ Intern' : '🤝 Kunde & Partner'));
    music.play('drive');
    music.setIntensity(-1);
    if (first && !this.P.introSeen) {
      setTimeout(() => this.ui?.toast(say(LINES.intro)), 600);
      this.P.introSeen = true;
      saveProgress(this.P);
    } else if (first) {
      setTimeout(() => this.ui?.toast(`Willkommen zurück! ${this.P.deals.length} von ${MISSIONS.length} Deals im Sack, ${fmtEuro(this.revenue())} Umsatz.`), 500);
    }
  }
  revenue() { return this.P.deals.reduce((s, id) => s + (missionById(id)?.reward || 0), 0); }

  // ================================================================== driving
  startDrive() {
    const car = carById(this.ui.carId);
    if (car.locked && this.P.deals.length < car.locked) { this.ui.toast(say(SCHULTERKLAPPEN)); return; }
    this.P.car = car.id;
    saveProgress(this.P);
    this.room.detach();
    if (!this.world) {
      clearUI();
      mount(h('div.overlay.dr-ov', {}, h('div.card.panel', {}, [h('div.spinner', { style: 'margin:0 auto 12px' }), h('h2', {}, 'Ludlein wird geladen …'), h('p', {}, 'Straßen asphaltieren, Blitzer aufstellen, Cloudius bremsen.')])));
      setTimeout(() => { this.buildWorld(); this.beginDrive(car); }, 60);
      return;
    }
    this.beginDrive(car);
  }

  buildWorld() {
    const mobile = matchMedia('(pointer: coarse)').matches || window.devicePixelRatio > 2.5;
    this.world = new World(this.app.gfx.renderer, { quality: mobile ? 'low' : 'high' });
    this.traffic = new Traffic(this.world, this.world.scene);
    this.traffic.onHonk = (c) => { const d = Math.hypot(c.x - this.V.pos.x, c.z - this.V.pos.z); if (d < 30) { sfx.horn(true); } };
    this.traffic.onPed = (p, x, z) => this.traffic.bubble(x, 2.6, z, LINES.pedestrian[Math.floor(Math.random() * LINES.pedestrian.length)]);
    this.cam = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 0.3, 6000);
    this.buildBeacons();
    // compile shaders once to avoid hitches on the first frames
    this.app.gfx.renderer.compile(this.world.scene, this.cam);
  }

  beginDrive(car) {
    const W = this.world;
    clearUI();
    if (this.player) { W.scene.remove(this.player.root); this.player.dispose(); }
    const cfg = { ...car.def, ...(this.P.configs[car.id] || {}) };
    this.player = new CarModel(car, cfg);
    this.player.root.traverse((o) => { if (o.isMesh && o.material !== this.player.contactShadow.material) o.castShadow = true; });
    W.scene.add(this.player.root);
    this.V = new Vehicle(car, cfg);
    const S = PLACES.spawn;
    this.V.pos.set(S.x, 0, S.z);
    this.V.heading = S.heading;
    this.camH = S.heading;
    this.camPos = null;
    this.battery = car.ev ? (this.battery ?? 1) : null;
    this.lowWarned = false;
    this.mode = 'drive';
    this.useScene(W.scene, this.cam);
    this.hud = new Hud(this);
    this.hud.quota(this.revenue(), QUOTA, this.P.provision);
    this.engine = createEngineSound(car.ev ? 'ev' : 'ice');
    if (isMuted()) this.engine?.mute(true);
    this.radioHooks(true);
    this.applyRadio();
    this.updateBeacons();
    if (this.P.steer === 'tilt') this.enableTilt(false);
    setTimeout(() => this.hud?.call('danny', say(LINES.start)), 700);
    this.bumpCool = 0;
    this.shake = 0;
  }
  engineMute(m) { this.engine?.mute(m); }

  // ---------------------------------------------------------------- car radio: every jukebox song, on by default
  radioSong() {
    const i = Math.max(0, SONGS.findIndex((x) => x.id === this.P.radioSong));
    return SONGS[i];
  }
  /** take over the song callbacks while driving (the office jukebox has its own) */
  radioHooks(on) {
    if (on) {
      if (!this.savedHooks) this.savedHooks = { end: music.onSongEnd, err: music.onSongError };
      music.onSongEnd = (url) => { if (this.mode !== 'showroom' && url === this.radioSong().src) this.radioStep(1); };
      music.onSongError = (url) => { if (url === this.radioSong().src) this.hud?.toast('📻 Kein Empfang', 'Song konnte nicht geladen werden'); };
    } else if (this.savedHooks) {
      music.onSongEnd = this.savedHooks.end;
      music.onSongError = this.savedHooks.err;
      this.savedHooks = null;
    }
  }
  applyRadio(restart = false) {
    const on = this.P.radio !== false;
    const song = this.radioSong();
    if (on) music.playSong(song.src, { restart, loop: SONGS.length === 1 });
    else { music.stopSong(0.6); music.play('drive'); music.setIntensity(this.M ? (this.M.phase === 'race' ? 2 : 1) : 0); }
    this.hud?.radio(on, song);
  }
  radioPlay(id) {
    this.P.radioSong = id;
    this.P.radio = true;
    saveProgress(this.P);
    this.applyRadio(true);
    this.hud?.toast(`📻 ${this.radioSong().title}`);
  }
  radioStep(d) {
    const i = SONGS.indexOf(this.radioSong());
    this.radioPlay(SONGS[(i + d + SONGS.length) % SONGS.length].id);
  }
  toggleRadio() {
    this.P.radio = this.P.radio === false;
    saveProgress(this.P);
    this.applyRadio();
    if (this.P.radio) this.hud?.toast(`📻 ${this.radioSong().title}`);
  }

  // ---------------------------------------------------------------- beacons (mission markers in the world)
  buildBeacons() {
    const beamT = beamTexture();
    this.beacons = {};
    const cols = { fraesfix: '#19c3ff', messe: '#ff5fa8', regalriese: '#a46bff', rennen: '#ffb000' };
    for (const m of MISSIONS) {
      const p = this.missionPlace(m);
      const g = new THREE.Group();
      const beam = new THREE.Mesh(new THREE.CylinderGeometry(3.4, 3.4, 140, 20, 1, true), new THREE.MeshBasicMaterial({ map: beamT, color: cols[m.id], transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
      beam.position.y = 70;
      const icon = new THREE.Sprite(new THREE.SpriteMaterial({ map: iconTexture(m.icon, cols[m.id]), depthWrite: false, fog: false }));
      icon.scale.set(8, 8, 1);
      icon.position.y = 13;
      g.add(beam, icon);
      g.position.set(p.x, 0, p.z);
      this.world.scene.add(g);
      this.beacons[m.id] = { g, icon, beam };
    }
    // the active target: a glowing parking box + golden beam
    const boxT = canvasTexture(128, 192, (g, w, hh) => {
      g.strokeStyle = '#ffcc4d'; g.lineWidth = 10; g.strokeRect(5, 5, w - 10, hh - 10);
      g.fillStyle = 'rgba(255,204,77,0.25)'; g.fillRect(5, 5, w - 10, hh - 10);
      g.fillStyle = '#ffcc4d'; g.font = '900 72px Arial'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('P', w / 2, hh / 2);
    });
    this.targetBox = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: boxT, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6 }));
    this.targetBox.rotation.x = -Math.PI / 2;
    this.targetBox.visible = false;
    this.world.scene.add(this.targetBox);
    this.targetBeam = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 1.6, 120, 16, 1, true), new THREE.MeshBasicMaterial({ map: beamT, color: 0xffcc4d, transparent: true, opacity: 0.7, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    this.targetBeam.position.y = 60;
    this.targetBeam.visible = false;
    this.world.scene.add(this.targetBeam);
    // lead rings (pool)
    this.rings = [];
    const ringM = new THREE.MeshStandardMaterial({ color: 0xffd34d, emissive: 0xffb000, emissiveIntensity: 2.2, metalness: 0.6, roughness: 0.3 });
    for (let i = 0; i < 10; i++) {
      const r = new THREE.Mesh(new THREE.TorusGeometry(1.6, 0.22, 10, 32), ringM);
      r.visible = false;
      this.world.scene.add(r);
      this.rings.push(r);
    }
    // navigation arrow above the car
    const shape = new THREE.Shape();
    shape.moveTo(0, 1.1); shape.lineTo(0.75, -0.2); shape.lineTo(0.25, -0.2); shape.lineTo(0.25, -0.9); shape.lineTo(-0.25, -0.9); shape.lineTo(-0.25, -0.2); shape.lineTo(-0.75, -0.2); shape.closePath();
    const ag = new THREE.ExtrudeGeometry(shape, { depth: 0.18, bevelEnabled: false });
    ag.rotateX(-Math.PI / 2);
    ag.translate(0, 0, 0);
    this.arrow = new THREE.Mesh(ag, new THREE.MeshStandardMaterial({ color: 0x50af30, emissive: 0x50af30, emissiveIntensity: 1.4, transparent: true, opacity: 0.9 }));
    this.arrow.visible = false;
    this.world.scene.add(this.arrow);
  }
  missionPlace(m) {
    if (m.id === 'rennen') return PLACES.racestart;
    return PLACES[m.place];
  }
  updateBeacons() {
    for (const m of MISSIONS) {
      const b = this.beacons[m.id];
      const done = this.P.deals.includes(m.id);
      b.g.visible = !this.M;
      b.beam.material.opacity = done ? 0.18 : 0.55;
      b.icon.material.opacity = done ? 0.55 : 1;
    }
  }

  // ================================================================== input
  onKey(e) {
    if (this.mode === 'showroom' || this.mode === 'idle') return;
    const k = e.key.toLowerCase();
    if (['arrowup', 'arrowdown', 'arrowleft', 'arrowright', ' '].includes(k) || k === 'tab') e.preventDefault();
    this.keys.add(k);
    if (e.repeat) return;
    if (k === 'c') this.nextCamera();
    if (k === 'h') this.honk();
    if (k === 'p') this.toggleRadio();
    if (k === 'n') this.radioStep(1);
    if (k === 'r' && this.mode === 'drive') this.resetCar();
    if (k === 'm' || k === 'tab') { if (this.mode === 'board') this.closeOverlay(); else if (this.mode === 'drive') this.openBoard(); }
    if (k === 'escape') { if (this.mode === 'board') this.closeOverlay(); else if (this.mode === 'drive') this.openBoard(); }
    if (['1', '2', '3'].includes(k)) {
      const i = +k - 1;
      if (this.quizKeys) this.quizKeys(i);
      else if (this.hud?.answerKeys) this.hud.answerKeys(i);
    }
    if (k === 'enter' && this.enterAction) this.enterAction();
  }
  onKeyUp(e) { this.keys.delete(e.key.toLowerCase()); }
  readInput() {
    const K = this.keys, T = this.touch;
    const I = this.V.input;
    const up = K.has('w') || K.has('arrowup') || T.gas;
    const down = K.has('s') || K.has('arrowdown') || T.brake;
    let steer = 0;
    if (K.has('a') || K.has('arrowleft') || T.left) steer += 1;
    if (K.has('d') || K.has('arrowright') || T.right) steer -= 1;
    if (this.P.steer === 'tilt' && this.tiltOn) steer = Math.max(-1, Math.min(1, this.tilt));
    I.throttle = up ? 1 : 0;
    I.brake = down ? 1 : 0;
    I.steer = steer;
    I.handbrake = K.has(' ') ? 1 : 0;
    if (this.locked) { I.throttle = 0; I.brake = 1; }
  }
  enableTilt(ask = true) {
    const go = () => { window.addEventListener('devicemotion', this.onMotion); this.tiltOn = true; };
    const D = window.DeviceMotionEvent;
    if (ask && D && typeof D.requestPermission === 'function') D.requestPermission().then((r) => { if (r === 'granted') go(); }).catch(() => {});
    else go();
  }
  onMotion(e) {
    const g = e.accelerationIncludingGravity;
    if (!g) return;
    const ang = (screen.orientation && screen.orientation.angle) ?? window.orientation ?? 90;
    const raw = ang === 90 ? -g.y : ang === 270 || ang === -90 ? g.y : -g.x;
    const v = (raw / 4.2) * (this.P.tiltInvert ? -1 : 1);
    this.tilt = Math.abs(v) < 0.06 ? 0 : v;
  }
  nextCamera() { this.camMode = (this.camMode + 1) % CAMS.length; this.camPos = null; }
  honk() {
    if (!this.V) return;
    sfx.horn();
    for (const p of this.traffic.peds) {
      if (Math.hypot(p.x - this.V.pos.x, p.z - this.V.pos.z) < 14 && Math.random() < 0.4) { this.traffic.bubble(p.x, 2.6, p.z, LINES.honk[Math.floor(Math.random() * 3)]); break; }
    }
  }
  resetCar() {
    if (!this.V || this.mode !== 'drive') return;
    const p = this.V.pos;
    const ab = this.world.autobahnAt(p.x, p.z);
    if (ab && ab.dist < 40) {
      const east = ab.off < 0;
      const q = this.world.abPoint(ab.t, east ? -6.35 : 6.35);
      this.V.pos.set(q.x, 0, q.z);
      this.V.heading = this.world.abHeading(ab.t) + (east ? 0 : Math.PI);
    } else {
      // nearest city road, right lane, along the road
      let best = null, bd = Infinity;
      for (const r of this.world.roads) {
        const ex = r.bx - r.ax, ez = r.bz - r.az;
        const t = Math.max(0.1, Math.min(0.9, ((p.x - r.ax) * ex + (p.z - r.az) * ez) / (ex * ex + ez * ez)));
        const x = r.ax + ex * t, z = r.az + ez * t;
        const d = Math.hypot(p.x - x, p.z - z);
        if (d < bd) { bd = d; best = { x, z, ex, ez }; }
      }
      const l = Math.hypot(best.ex, best.ez);
      const fx = best.ex / l, fz = best.ez / l;
      this.V.pos.set(best.x - fz * 3, 0, best.z + fx * 3);
      this.V.heading = Math.atan2(fx, fz);
    }
    this.V.speed = 0; this.V.lat = 0; this.V.yaw = 0;
    this.camPos = null;
    this.hud.call('navi', say(LINES.reset), { duration: 2500 });
  }

  // ================================================================== frame
  update(dt, time) {
    if (this.mode === 'showroom') { this.room.update(dt, time); return; }
    if (!this.world || !this.V) return;
    const W = this.world;
    W.update(dt, time);
    if (this.mode === 'drive') {
      this.readInput();
      this.stepCar(dt);
      this.traffic.update(dt, { pos: this.V.pos, speed: this.V.speed, ab: this.abInfo });
      this.stepMission(dt, time);
      this.checkBlitzer();
      this.stepBattery(dt);
    } else {
      this.player.animate(dt, 0, this.V.steer, 0, 0);
    }
    this.updateCamera(dt);
    this.updateMarkers(dt, time);
    this.updateHud(dt);
    W.followSun(this.V.pos);
  }

  stepCar(dt) {
    const V = this.V, W = this.world;
    const info = W.limitAt(V.pos.x, V.pos.z);
    this.limitInfo = info;
    this.abInfo = info.autobahn ? W.autobahnAt(V.pos.x, V.pos.z) : null;
    const inLot = V.pos.x > 1420 && V.pos.x < 1600 && V.pos.z > -150 && V.pos.z < 30;
    const ground = W.groundAt(V.pos.x, V.pos.z);
    V.offroad = !info.onRoad && ground === 0 && !inLot && !info.autobahn;
    V.limp = this.battery != null && this.battery <= 0;
    V.step(dt, { ground });
    this.laneAssist(dt, info);
    // collisions: three circles along the car + traffic bodies
    const car = V.car.dims;
    const r = car.W / 2;
    const f = V.forward;
    const offs = [car.L / 2 - r, 0, -(car.L / 2 - r)];
    let push = null;
    const bodies = this.traffic.bodies();
    for (const o of offs) {
      const c = new THREE.Vector3(V.pos.x + f.x * o, 0, V.pos.z + f.z * o);
      const before = c.clone();
      let n = W.collide(c, r);
      for (const b of bodies) {
        const dx = c.x - b.x, dz = c.z - b.z, d = Math.hypot(dx, dz);
        if (d < r + b.r && d > 1e-4) {
          const pen = r + b.r - d;
          c.x += (dx / d) * pen; c.z += (dz / d) * pen;
          n = n || { x: 0, z: 0 };
          n.x += dx / d; n.z += dz / d;
          if (b.car && b.car.honk <= 0) { b.car.honk = 5; sfx.horn(true); }
        }
      }
      if (n) {
        V.pos.x += c.x - before.x; V.pos.z += c.z - before.z;
        push = push || { x: 0, z: 0 };
        push.x += n.x; push.z += n.z;
      }
    }
    if (push) {
      const l = Math.hypot(push.x, push.z) || 1;
      const impact = V.bump({ x: push.x / l, z: push.z / l });
      if (impact > 3) {
        sfx.crunch(Math.min(2, impact / 10));
        this.shake = Math.min(0.6, impact * 0.03);
        if (impact > 7 && this.bumpCool <= 0) { this.bumpCool = 12; this.hud.toast(say(LINES.bump)); }
      }
    }
    this.bumpCool -= dt;
    // visual
    this.player.root.position.set(V.pos.x, V.y, V.pos.z);
    this.player.root.rotation.y = V.heading;
    this.player.animate(dt, V.speed, V.steer, V.ax, V.ay);
    this.player.setBrake(V.input.brake > 0 && V.speed > 0.3);
    this.player.setReverse(V.speed < -0.3);
    // sound + exhaust flames: upshift at full throttle = bang + flames, lift-off at high revs = crackle + small flames
    const e = V.engine();
    this.engine?.update(e.rpm, e.load, Math.abs(V.speed));
    if (!V.car.ev) {
      const full = V.input.throttle > 0 && V.speed > 8;
      if (this.lastGear && e.gear > this.lastGear && full && this.lastRpm > 0.55) { this.player.flame(1); this.engine?.bang(1); }
      if (this.lastThrottle > 0 && V.input.throttle === 0 && this.lastRpm > 0.6 && V.speed > 10) {
        this.player.flame(0.5);
        if (Math.random() < 0.6) setTimeout(() => { if (this.mode === 'drive') { this.player.flame(0.4); this.engine?.bang(0.3); } }, 180 + Math.random() * 250);
      }
      this.lastGear = e.gear; this.lastRpm = e.rpm; this.lastThrottle = V.input.throttle;
    }
  }

  /** without steering input the car gently lines up with the road (and follows autobahn curves) */
  laneAssist(dt, info) {
    const V = this.V;
    if (Math.abs(V.input.steer) > 0.05 || Math.abs(V.speed) < 4 || V.input.handbrake) return;
    let dir = null;
    if (this.abInfo && Math.abs(this.abInfo.off) < 14) dir = Math.atan2(this.abInfo.tg.x, this.abInfo.tg.z);
    else if (info.road && info.onRoad) dir = Math.atan2(info.road.bx - info.road.ax, info.road.bz - info.road.az);
    if (dir == null) return;
    const fwd = V.speed < 0 ? V.heading + Math.PI : V.heading;
    let best = null;
    for (const d of [dir, dir + Math.PI]) {
      let dh = d - fwd;
      while (dh > Math.PI) dh -= Math.PI * 2;
      while (dh < -Math.PI) dh += Math.PI * 2;
      if (best == null || Math.abs(dh) < Math.abs(best)) best = dh;
    }
    if (Math.abs(best) < 0.3) V.heading += best * Math.min(1, dt * 2.4);
  }

  updateCamera(dt) {
    const V = this.V;
    const mode = CAMS[this.camMode];
    let dh = V.heading - this.camH;
    while (dh > Math.PI) dh -= Math.PI * 2;
    while (dh < -Math.PI) dh += Math.PI * 2;
    this.camH += dh * Math.min(1, dt * (mode === 'hood' ? 20 : 3.2));
    const fx = Math.sin(this.camH), fz = Math.cos(this.camH);
    const kmh = V.kmh;
    let pos, look;
    if (mode === 'hood') {
      const hf = V.forward;
      pos = new THREE.Vector3(V.pos.x + hf.x * 0.4, V.y + 1.28, V.pos.z + hf.z * 0.4);
      look = new THREE.Vector3(V.pos.x + hf.x * 20, V.y + 1.0, V.pos.z + hf.z * 20);
    } else {
      const far = mode === 'far';
      const dist = (far ? 10.5 : 6.6) + Math.min(2.5, kmh * 0.012);
      const ht = far ? 4.2 : 2.25;
      pos = new THREE.Vector3(V.pos.x - fx * dist, V.y + ht, V.pos.z - fz * dist);
      look = new THREE.Vector3(V.pos.x + fx * 3, V.y + 1.0, V.pos.z + fz * 3);
    }
    if (!this.camPos || mode === 'hood') this.camPos = pos.clone();
    else this.camPos.lerp(pos, 1 - Math.exp(-dt * 10));
    this.cam.position.copy(this.camPos);
    if (this.shake > 0) {
      this.cam.position.x += (Math.random() - 0.5) * this.shake;
      this.cam.position.y += (Math.random() - 0.5) * this.shake;
      this.shake = Math.max(0, this.shake - dt * 1.5);
    }
    this.cam.lookAt(look);
    const fov = (mode === 'hood' ? 66 : 58) + Math.min(16, kmh * 0.07);
    if (Math.abs(this.cam.fov - fov) > 0.05) { this.cam.fov += (fov - this.cam.fov) * Math.min(1, dt * 3); this.cam.updateProjectionMatrix(); }
    this.player.root.visible = mode !== 'hood';
  }

  updateMarkers(dt, time) {
    const V = this.V;
    for (const id in this.beacons) {
      const b = this.beacons[id];
      b.icon.position.y = 13 + Math.sin(time * 2 + id.length) * 0.8;
      // the suggested mission pulses
      const sug = !this.M && this.suggestId === id;
      b.icon.scale.setScalar(sug ? 8 + Math.sin(time * 5) * 1.2 : 7);
    }
    this.updateRoute(dt);
    const tgt = this.navTarget();
    if (tgt && this.mode !== 'showroom') {
      const dx = tgt.x - V.pos.x, dz = tgt.z - V.pos.z;
      this.arrow.visible = false; // the route line on the road replaces the floating arrow
      this.arrow.position.set(V.pos.x, V.y + this.player.roofTop + 1.4 + Math.sin(time * 3) * 0.1, V.pos.z);
      this.arrow.rotation.y = Math.atan2(dx, dz);
    } else this.arrow.visible = false;
    for (const r of this.rings) if (r.visible) { r.rotation.y += dt * 2; r.position.y = 1.9 + Math.sin(time * 3 + (r.userData.k || 0)) * 0.25; }
  }

  updateHud() {
    const V = this.V, H = this.hud;
    if (!H) return;
    const lim = this.limitInfo?.limit ?? 50;
    const over = V.kmh > lim + 3;
    H.speed(V.kmh, lim, over);
    H.battery(this.battery, this.charging);
    // minimap markers
    const marks = [];
    const t = this.target();
    if (t) marks.push({ x: t.x, z: t.z, color: '#ffcc4d', icon: '★', edge: true });
    if (!this.M) for (const m of MISSIONS) { const p = this.missionPlace(m); marks.push({ x: p.x, z: p.z, color: this.P.deals.includes(m.id) ? '#3ddc84' : '#ffffff', icon: m.icon, edge: !this.P.deals.includes(m.id), r: 13 }); }
    if (this.battery != null) for (const c of CHARGERS) marks.push({ x: c.x, z: c.z, color: '#50af30', icon: '⚡', edge: this.battery < 0.3, r: 11 });
    if (this.M?.def.kind === 'collect' && this.M.phase === 'collect') for (const r of this.rings) if (r.visible) marks.push({ x: r.position.x, z: r.position.z, color: '#ffb000', r: 7 });
    if (this.traffic.rival.root.visible) marks.push({ x: this.traffic.R.x, z: this.traffic.R.z, color: '#9a7bff', icon: '☁', r: 10 });
    H.drawMap(V.pos.x, V.pos.z, V.heading, Math.abs(V.speed), marks, this.routePts);
    // mission bar
    const M = this.M;
    if (M) {
      const d = this.target() ? Math.round(Math.hypot(this.target().x - V.pos.x, this.target().z - V.pos.z)) : 0;
      let time = '', sub = '', low = false;
      if (M.def.kind === 'visit') { time = fmtTime(Math.max(0, M.t)); low = M.t < 15; sub = M.phase === 'park' ? 'In die Besucherbox einparken und anhalten' : `${PLACES[M.def.place].name} · ${d} m`; }
      if (M.def.kind === 'collect') { if (M.phase === 'collect') { time = fmtTime(Math.max(0, M.t)); low = M.t < 15; sub = `Leads: ${M.got} / ${M.def.count}`; } else sub = `Zum Messegelände · ${d} m`; }
      if (M.def.kind === 'race') {
        if (M.phase === 'race') { time = fmtTime(M.t); const cd = Math.round(Math.hypot(RACE.finish.x - this.traffic.R.x, RACE.finish.z - this.traffic.R.z)); sub = `Ziel ${d} m · Cloudius ${cd} m`; }
        else sub = M.phase === 'countdown' ? 'Gleich wird es grün …' : `Zur Ampel am Silo-Tower · ${d} m`;
      }
      H.mission({ icon: M.def.icon, title: M.def.title, sub, time, low });
    } else {
      const m = this.suggestion();
      const p = this.missionPlace(m);
      const d = Math.round(Math.hypot(p.x - V.pos.x, p.z - V.pos.z));
      const done = this.P.deals.includes(m.id);
      H.mission({ icon: m.icon, title: `${done ? 'Nochmal' : 'Nächster Auftrag'}: ${m.title}`, sub: `${d} m · der gelben Linie folgen oder ▶ Start`, suggest: true });
    }
  }

  /** with no mission running: the nearest open mission (or the one chosen with ⇄) */
  suggestion() {
    const open = MISSIONS.filter((m) => !this.P.deals.includes(m.id));
    const list = open.length ? open : MISSIONS;
    if (!this.suggestId || !list.some((m) => m.id === this.suggestId)) {
      const V = this.V;
      let best = list[0], bd = Infinity;
      for (const m of list) { const p = this.missionPlace(m); const d = Math.hypot(p.x - V.pos.x, p.z - V.pos.z); if (d < bd) { bd = d; best = m; } }
      this.suggestId = best.id;
    }
    return missionById(this.suggestId);
  }
  nextSuggestion() {
    const open = MISSIONS.filter((m) => !this.P.deals.includes(m.id));
    const list = open.length ? open : MISSIONS;
    const i = list.findIndex((m) => m.id === this.suggestId);
    this.suggestId = list[(i + 1) % list.length].id;
    this.routeKey = null;
  }
  startSuggested() { if (!this.M && this.mode === 'drive') this.startMission(this.suggestion().id); }
  navTarget() {
    if (this.M) return this.target();
    const p = this.missionPlace(this.suggestion());
    return { x: p.x, z: p.z };
  }
  /** glowing route line on the road to the current navigation target */
  updateRoute(dt) {
    const W = this.world, V = this.V;
    const t = this.navTarget();
    if (!this.routeMesh) {
      const tex = canvasTexture(64, 128, (g, w, hh) => {
        g.clearRect(0, 0, w, hh);
        g.fillStyle = 'rgba(255,211,77,0.35)'; g.fillRect(8, 0, w - 16, hh);
        g.strokeStyle = 'rgba(255,255,255,0.95)'; g.lineWidth = 9; g.lineCap = 'round'; g.lineJoin = 'round';
        g.beginPath(); g.moveTo(14, 84); g.lineTo(w / 2, 40); g.lineTo(w - 14, 84); g.stroke();
      });
      tex.wrapT = THREE.RepeatWrapping;
      this.routeTex = tex;
      this.routeMesh = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.MeshBasicMaterial({ map: tex, color: 0xffd34d, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -8, fog: false, side: THREE.DoubleSide }));
      this.routeMesh.frustumCulled = false;
      W.scene.add(this.routeMesh);
    }
    this.routeTex.offset.y -= dt * 1.2;
    if (!t || (this.M && this.M.def.kind === 'collect' && this.M.phase === 'collect')) { this.routeMesh.visible = false; this.routePts = null; return; }
    this.routeMesh.visible = true;
    const key = `${Math.round(t.x)},${Math.round(t.z)}`;
    this.routeT = (this.routeT || 0) - dt;
    // re-plan when the target changes, regularly, and quickly when the player leaves the line
    let off = 0;
    if (this.routePts) {
      let bd = Infinity;
      for (let i = 0; i < Math.min(this.routePts.length - 1, 40); i++) {
        const [ax, az] = this.routePts[i], [bx, bz] = this.routePts[i + 1];
        const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1;
        const u = Math.max(0, Math.min(1, ((V.pos.x - ax) * ex + (V.pos.z - az) * ez) / l2));
        bd = Math.min(bd, Math.hypot(V.pos.x - (ax + ex * u), V.pos.z - (az + ez * u)));
      }
      off = bd;
    }
    if (key !== this.routeKey || this.routeT <= 0 || off > 14) {
      this.routeKey = key;
      this.routeT = off > 14 ? 0.8 : 4;
      this.routePts = W.route(V.pos.x, V.pos.z, t.x, t.z);
    }
    // draw it from the car on: drop the part already driven (5x per second)
    this.routeDraw = (this.routeDraw || 0) - dt;
    if (this.routeDraw <= 0 && this.routePts) {
      this.routeDraw = 0.2;
      const P = this.routePts;
      let bi = 0, bd = Infinity;
      for (let i = 0; i < Math.min(P.length - 1, 60); i++) {
        const [ax, az] = P[i], [bx, bz] = P[i + 1];
        const ex = bx - ax, ez = bz - az, l2 = ex * ex + ez * ez || 1;
        const u = Math.max(0, Math.min(1, ((V.pos.x - ax) * ex + (V.pos.z - az) * ez) / l2));
        const d = Math.hypot(V.pos.x - (ax + ex * u), V.pos.z - (az + ez * u));
        if (d < bd) { bd = d; bi = i; }
      }
      const f = V.forward;
      this.buildRouteGeometry([[V.pos.x + f.x * 0.5, V.pos.z + f.z * 0.5], ...P.slice(bi + 1)]);
    }
  }
  buildRouteGeometry(pts) {
    const W = this.world;
    const pos = [], uv = [], idx = [];
    let v = 0;
    const half = 0.8;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
      let dx = b[0] - a[0], dz = b[1] - a[1];
      const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
      if (i > 0) v += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) / 2.4;
      const y = W.groundAt(pts[i][0], pts[i][1]) + 0.05;
      pos.push(pts[i][0] - dz * half, y, pts[i][1] + dx * half, pts[i][0] + dz * half, y, pts[i][1] - dx * half);
      uv.push(1, v, 0, v);
      if (i > 0) { const k = (i - 1) * 2; idx.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
    }
    const g = this.routeMesh.geometry;
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.setIndex(idx);
    g.computeBoundingSphere();
  }

  target() {
    const M = this.M;
    if (!M) return null;
    const d = M.def;
    if (d.kind === 'visit') return PLACES[d.place];
    if (d.kind === 'collect') {
      if (M.phase !== 'collect') return PLACES.messe;
      // nearest remaining lead
      let best = null, bd = Infinity;
      for (const r of this.rings) if (r.visible) { const dd = r.position.distanceTo(this.V.pos); if (dd < bd) { bd = dd; best = { x: r.position.x, z: r.position.z }; } }
      return best;
    }
    if (d.kind === 'race') return M.phase === 'race' ? RACE.finish : PLACES.racestart;
    return null;
  }

  // ================================================================== blitzer + battery
  checkBlitzer() {
    const V = this.V;
    for (const b of this.world.blitzer) {
      if (b.cool > 0) continue;
      const d = Math.hypot(b.x - V.pos.x, b.z - V.pos.z);
      if (d > 14) continue;
      const lim = this.limitInfo.limit;
      if (V.kmh > lim + 3) {
        b.cool = 3;
        sfx.blitz();
        this.hud.flash();
        this.P.provision = Math.max(0, this.P.provision - BLITZ_FINE);
        saveProgress(this.P);
        this.hud.quota(this.revenue(), QUOTA, this.P.provision);
        this.hud.toast('📸 Geblitzt!', `${Math.round(V.kmh)} statt ${lim} km/h · −${BLITZ_FINE} € Provision`);
        if (this.M?.def.kind === 'race' && this.M.phase === 'race') { this.failMission(say(MISSION_LINES.raceBlitz)); return; }
        setTimeout(() => this.hud?.call('danny', say(LINES.blitz)), 900);
      }
    }
  }
  stepBattery(dt) {
    if (this.battery == null) return;
    const V = this.V;
    const v = Math.abs(V.speed);
    const drain = (v * dt) / (V.car.range * 1000) * (1 + Math.pow(v / 28, 2) * 0.8);
    this.battery = Math.max(0, this.battery - drain);
    // charging bay?
    this.charging = false;
    for (const c of CHARGERS) {
      if (Math.hypot(c.x - V.pos.x, c.z - V.pos.z) < 2.8 && v < 0.6 && this.battery < 1) {
        this.charging = true;
        const before = this.battery;
        this.battery = Math.min(1, this.battery + dt * 0.14);
        if (Math.floor(before * 20) !== Math.floor(this.battery * 20)) sfx.charge(this.battery);
        if (this.battery >= 1) { this.hud.call('navi', say(LINES.charged), { duration: 3000 }); this.lowWarned = false; this.emptyWarned = false; }
      }
    }
    if (this.battery < 0.15 && !this.lowWarned) { this.lowWarned = true; this.hud.call('navi', say(LINES.lowBattery)); }
    if (this.battery <= 0 && !this.emptyWarned) { this.emptyWarned = true; this.hud.call('navi', say(LINES.emptyBattery)); }
  }

  // ================================================================== missions
  startMission(id) {
    const def = missionById(id);
    if (this.M) this.endMission();
    this.M = { def, phase: 'go', t: def.time, got: 0, bonus: 0, correct: 0, start: performance.now() };
    const who = BRIEFER[id] || 'danny';
    this.hud.call(who, say(def.brief), { duration: 9000 });
    music.setIntensity(1);
    if (def.kind === 'visit') {
      const p = PLACES[def.place];
      this.targetBox.scale.set(p.w, p.l, 1);
      this.targetBox.rotation.z = p.rot || 0;
      this.targetBox.position.set(p.x, this.world.groundAt(p.x, p.z) + 0.03, p.z);
      this.targetBox.visible = true;
    }
    if (def.kind === 'race') this.traffic.rivalReset();
    this.updateBeacons();
  }
  endMission() {
    if (this.M) this.lastBeacon = this.M.def.id; // leave the marker before it can start again
    this.M = null;
    this.targetBox.visible = false;
    this.targetBeam.visible = false;
    for (const r of this.rings) r.visible = false;
    this.traffic.rivalHide();
    this.world.raceLight.manual = false;
    this.locked = false;
    this.hud?.countdown(null);
    music.setIntensity(0);
    this.updateBeacons();
  }
  abortMission() {
    if (!this.M) return;
    this.endMission();
    this.hud.call('danny', say(MISSION_LINES.abort), { duration: 3500 });
  }

  stepMission(dt, time) {
    const V = this.V;
    const M = this.M;
    // drive into a beacon to start its mission
    if (!M) {
      for (const m of MISSIONS) {
        const p = this.missionPlace(m);
        if (Math.hypot(p.x - V.pos.x, p.z - V.pos.z) < 7 && this.lastBeacon !== m.id) { this.lastBeacon = m.id; this.startMission(m.id); return; }
      }
      if (this.lastBeacon) { const p = this.missionPlace(missionById(this.lastBeacon)); if (Math.hypot(p.x - V.pos.x, p.z - V.pos.z) > 30) this.lastBeacon = null; }
      return;
    }
    const d = M.def;
    const tgt = this.target();
    const dist = tgt ? Math.hypot(tgt.x - V.pos.x, tgt.z - V.pos.z) : Infinity;
    if (tgt && !(d.kind === 'collect' && M.phase === 'collect')) {
      this.targetBeam.visible = true;
      this.targetBeam.position.set(tgt.x, 60, tgt.z);
    } else this.targetBeam.visible = false;
    if (d.kind === 'visit') {
      M.t -= dt;
      if (M.t <= 0) { this.failMission(say(MISSION_LINES.late)); return; }
      if (M.phase === 'go' && dist < 32) { M.phase = 'park'; this.hud.call('navi', say(MISSION_LINES.arrive), { duration: 4000 }); }
      if (d.voice && !M.voiceAsked && this.abInfo && this.abInfo.t > 0.33 && this.abInfo.off < 0) {
        M.voiceAsked = true;
        const q = d.voiceQ;
        this.hud.call('navi', q.q, { answers: q.a, ok: q.ok, timeout: 15, onAnswer: (i, ok) => { if (ok) { M.bonus += 150; sfx.coin(2); this.hud.toast('🎙️ Bericht erfasst', '+150 € Provision'); } else sfx.error(); } });
      }
      if (M.phase === 'park') {
        const p = PLACES[d.place];
        const dx = V.pos.x - p.x, dz = V.pos.z - p.z, r = p.rot || 0;
        const lx = dx * Math.cos(r) - dz * Math.sin(r), lz = dx * Math.sin(r) + dz * Math.cos(r);
        const inside = Math.abs(lx) < p.w / 2 && Math.abs(lz) < p.l / 2;
        this.targetBox.material.opacity = inside ? 1 : 0.7 + Math.sin(time * 6) * 0.3;
        if (inside && Math.abs(V.speed) < 0.8) this.customerTalk();
      }
    } else if (d.kind === 'collect') {
      if (M.phase === 'go' && dist < 95) {
        M.phase = 'collect';
        M.t = d.time;
        const spots = [...LEAD_SPOTS].sort(() => Math.random() - 0.5).slice(0, d.count);
        spots.forEach(([x, z], i) => { const r = this.rings[i]; r.position.set(x, 1.9, z); r.visible = true; r.userData.k = i; });
        this.hud.call('karla', 'Da sind sie! Fahr durch die goldenen Ringe, jeder ist ein Lead.', { duration: 4000 });
        music.setIntensity(2);
      }
      if (M.phase === 'collect') {
        M.t -= dt;
        for (const r of this.rings) {
          if (r.visible && r.position.distanceTo(new THREE.Vector3(V.pos.x, 1.9, V.pos.z)) < 3.6) {
            r.visible = false;
            M.got++;
            sfx.coin(M.got);
            this.hud.toast(MISSION_LINES.lead[M.got % MISSION_LINES.lead.length], `${M.got} / ${d.count}`);
            if (M.got >= d.count) { this.winMission(); return; }
          }
        }
        if (M.t <= 0) this.failMission(say(MISSION_LINES.collectTimeout));
      }
    } else if (d.kind === 'race') {
      if (M.phase === 'go') {
        if (dist < 40 && !M.readySaid) { M.readySaid = true; this.hud.call('cloudius', say(MISSION_LINES.cloudiusTaunt), { duration: 4000 }); setTimeout(() => this.M === M && this.hud.call('navi', say(MISSION_LINES.raceReady), { duration: 4000 }), 4200); }
        const s = RACE.start[0];
        if (Math.hypot(s.x - V.pos.x, s.z - V.pos.z) < 6 && Math.abs(V.speed) < 1) this.startCountdown();
      } else if (M.phase === 'race') {
        M.t += dt;
        M.tauntT = (M.tauntT ?? 9) - dt;
        if (M.tauntT <= 0) { M.tauntT = 14; this.hud.call('cloudius', say(MISSION_LINES.cloudiusTaunt), { duration: 3500 }); }
        if (Math.hypot(RACE.finish.x - V.pos.x, RACE.finish.z - V.pos.z) < 10) {
          const R = this.traffic.R;
          M.margin = Math.max(0, Math.hypot(RACE.finish.x - R.x, RACE.finish.z - R.z) / Math.max(5, R.speed || 10));
          this.winMission();
          return;
        }
        if (this.traffic.R.done) this.failMission(say(MISSION_LINES.raceLost));
      }
    }
  }

  startCountdown() {
    const M = this.M;
    M.phase = 'countdown';
    this.locked = true;
    const W = this.world;
    W.raceLight.manual = true;
    W.setLight(W.raceLight, 'ns', 'r');
    W.setLight(W.raceLight, 'ew', 'r');
    this.traffic.clearArea(100, -120, 260, 120);
    this.traffic.clearArea(-260, 20, 260, 140);
    // snap the player neatly next to Cloudius
    const s = RACE.start[0];
    this.V.pos.set(s.x, 0, s.z); this.V.heading = 0; this.V.speed = 0;
    this.hud.countdown('r');
    sfx.beep();
    music.setIntensity(-1);
    setTimeout(() => { if (this.M !== M) return; this.hud.countdown('y'); W.setLight(W.raceLight, 'ns', 'ry'); sfx.beep(); }, 1500);
    setTimeout(() => {
      if (this.M !== M) return;
      this.hud.countdown('g');
      W.setLight(W.raceLight, 'ns', 'g');
      sfx.beep(true);
      this.locked = false;
      M.phase = 'race';
      M.t = 0;
      this.traffic.rivalStart();
      music.setIntensity(2);
      this.hud.toast(say(MISSION_LINES.raceGo));
      setTimeout(() => this.M === M && this.hud.call('cloudius', say(MISSION_LINES.cloudiusLag), { duration: 3000 }), 400);
      setTimeout(() => this.hud?.countdown(null), 1200);
    }, 2900);
  }

  // ---------------------------------------------------------------- customer conversation (modal)
  customerTalk() {
    const M = this.M, d = M.def;
    this.mode = 'dialog';
    this.V.speed = 0;
    const who = CALLERS[d.customer];
    let i = 0;
    const card = h('div.card.panel.dr-result');
    const ov = mount(h('div.overlay.dr-ov', {}, card));
    const ask = () => {
      const q = d.quiz[i];
      const buttons = q.a.map((a, k) => h('button.dr-chip', { style: 'display:block;width:100%;text-align:left;margin:6px 0;border-radius:12px;padding:10px 12px', onclick: () => answer(k) }, `${'ABC'[k]}  ${a}`));
      const answer = (k) => {
        if (this.quizKeys == null) return;
        this.quizKeys = null;
        const ok = k === q.ok;
        if (ok) { M.correct++; sfx.coin(M.correct); } else sfx.error();
        buttons.forEach((b, n) => { b.style.boxShadow = n === q.ok ? 'inset 0 0 0 2px #3ddc84' : n === k ? 'inset 0 0 0 2px #ff3b5c' : ''; b.disabled = true; });
        fb.textContent = ok ? say(MISSION_LINES.right) : say(MISSION_LINES.wrong);
        setTimeout(() => { i++; if (i < d.quiz.length) ask(); else finish(); }, 1300);
      };
      const fb = h('p', { style: 'min-height:1.4em;font-weight:700;color:#fff' });
      card.replaceChildren(
        h('div', { style: 'display:flex;gap:12px;align-items:center;text-align:left' }, [h('div.dr-face', { style: `--c:${who.color};width:52px;height:52px;font-size:18px` }, who.ini), h('div', {}, [h('div.kicker', {}, `Kundengespräch · Frage ${i + 1} von ${d.quiz.length}`), h('h2', { style: 'margin:2px 0' }, who.name), h('small', { style: 'color:var(--muted)' }, who.role)])]),
        h('p', { style: 'color:#fff;font-size:16px;text-align:left' }, q.q),
        ...buttons, fb
      );
      this.quizKeys = answer;
    };
    const finish = () => {
      ov.remove();
      this.quizKeys = null;
      this.mode = 'drive';
      const need = d.quiz.length >= 3 ? 2 : 1;
      if (M.correct >= need) this.winMission();
      else this.failMission(`${who.name} möchte noch überlegen. ${M.correct} von ${d.quiz.length} Antworten haben überzeugt. Versuch es nochmal!`);
    };
    ask();
  }

  winMission() {
    const M = this.M, d = M.def;
    const first = !this.P.deals.includes(d.id);
    const before = this.P.deals.length;
    if (first) this.P.deals.push(d.id);
    let bonus = M.bonus + M.correct * 50;
    if (d.kind === 'visit') bonus += Math.round(Math.max(0, M.t) * 4);
    if (d.kind === 'collect') bonus += Math.round(Math.max(0, M.t) * 5);
    if (d.kind === 'race') bonus += Math.round((M.margin || 0) * 40);
    const prov = d.prov + bonus;
    this.P.provision += prov;
    this.P.wins++;
    const secs = d.kind === 'race' ? M.t : (performance.now() - M.start) / 1000;
    if (!this.P.best[d.id] || secs < this.P.best[d.id]) this.P.best[d.id] = Math.round(secs * 10) / 10;
    saveProgress(this.P);
    sfx.win();
    this.endMission();
    this.hud.quota(this.revenue(), QUOTA, this.P.provision);
    const unlocked = before < 3 && this.P.deals.length >= 3;
    const finale = this.P.deals.length >= MISSIONS.length && !this.P.finale;
    this.showResult({
      win: true, title: first ? 'Deal gewonnen!' : 'Nochmal gewonnen!', text: say(d.win), big: first ? `+ ${fmtEuro(d.reward)}` : `+ ${fmtEuro(prov)} Provision`,
      kpis: [['Provision', `+ ${fmtEuro(prov)}`], ['Zeit', fmtTime(secs)], ['Quartal', `${fmtEuro(this.revenue())} / ${fmtEuro(QUOTA)}`]],
      learn: d.learn,
      after: () => {
        if (unlocked) setTimeout(() => this.hud?.call('danny', say(LINES.sklasseUnlocked), { duration: 8000 }), 400);
        if (finale) { this.P.finale = true; saveProgress(this.P); this.showFinale(); }
      }
    });
  }
  failMission(text) {
    const M = this.M;
    const id = M.def.id;
    sfx.lose?.();
    this.endMission();
    this.showResult({ win: false, title: 'Nicht geklappt', text, retry: id });
  }

  showResult({ win, title, text, big, kpis, learn, retry, after }) {
    this.mode = 'result';
    this.V.speed = 0;
    this.hud.hideCall();
    const close = () => { ov.remove(); this.enterAction = null; this.mode = 'drive'; after?.(); };
    const buttons = [];
    if (retry) buttons.push(h('button.btn.gold', { onclick: () => { sfx.click(); close(); this.startMission(retry); } }, '↻ Nochmal'));
    buttons.push(h(`button.btn${retry ? '.secondary' : '.gold'}`, { onclick: () => { sfx.click(); close(); } }, retry ? 'Später' : '🚗 Weiterfahren'));
    if (!retry) buttons.push(h('button.btn.secondary', { onclick: () => { sfx.click(); close(); this.openBoard(); } }, '📱 Aufträge'));
    const card = h('div.card.panel.dr-result', {}, [
      h('div.kicker', {}, win ? 'Auftrag erledigt' : 'Auftrag gescheitert'),
      h('h1', {}, title),
      big ? h('div.dr-big', {}, big) : null,
      h('p', {}, text),
      kpis ? h('div.dr-kpis', {}, kpis.map(([k, v]) => h('div', {}, [h('b', {}, v), k]))) : null,
      learn ? h('div.dr-learn', {}, [h('b', {}, `${learn.icon} ${learn.title}`), h('p', {}, learn.text), learn.video ? h('a', { href: `https://www.youtube.com/watch?v=${learn.video}`, target: '_blank', rel: 'noopener' }, '▶ Video bei itmX ansehen') : null]) : null,
      h('div.row', {}, buttons)
    ]);
    const ov = mount(h('div.overlay.dr-ov', {}, card));
    this.enterAction = () => buttons[0].click();
  }

  showFinale() {
    this.mode = 'result';
    sfx.fanfare?.();
    music.setIntensity(2);
    const card = h('div.card.panel.dr-result', {}, [
      h('div.kicker', {}, 'Quartalsende'),
      h('h1', {}, '🏆 Quartalsziel erreicht!'),
      h('div.dr-big', {}, fmtEuro(this.revenue())),
      h('p', {}, say(LINES.finale)),
      h('div.dr-kpis', {}, [h('div', {}, [h('b', {}, fmtEuro(this.P.provision)), 'Provision']), h('div', {}, [h('b', {}, String(this.P.wins)), 'Aufträge erledigt']), h('div', {}, [h('b', {}, '🔓'), 'S-Klasse frei'])]),
      h('p', {}, 'Ludlein bleibt offen: Fahr weiter, verbessere deine Zeiten oder probier die S-Klasse aus.'),
      h('div.row', {}, [
        h('button.btn.gold', { onclick: () => { sfx.click(); ov.remove(); this.mode = 'drive'; } }, '🚗 Weiterfahren'),
        h('button.btn.secondary', { onclick: () => { sfx.click(); ov.remove(); this.showShowroom(); } }, '🏁 Zum Fuhrpark')
      ])
    ]);
    const ov = mount(h('div.overlay.dr-ov', {}, card));
    this.hud.call('danny', say(LINES.finale), { duration: 9000 });
  }

  // ---------------------------------------------------------------- Bordcomputer (mission board + map)
  openBoard() {
    if (this.mode !== 'drive') return;
    this.mode = 'board';
    const canvas = h('canvas.dr-bigmap', { width: 1100, height: 440 });
    const cards = MISSIONS.map((m) => {
      const done = this.P.deals.includes(m.id);
      const active = this.M?.def.id === m.id;
      const best = this.P.best[m.id];
      return h(`button.dr-mcard${done ? '.done' : ''}`, { onclick: () => { sfx.click(); this.closeOverlay(); this.startMission(m.id); } }, [
        h('span.dr-mic', {}, m.icon),
        h('b', {}, m.title),
        h('p', {}, m.short),
        h('div.dr-mfoot', {}, [h('span', {}, fmtEuro(m.reward)), done ? h('span.ok', {}, '✓ gewonnen') : h('span', {}, 'offen'), best ? h('span', {}, `Bestzeit ${fmtTime(best)}`) : null, active ? h('span', {}, '▶ läuft') : null])
      ]);
    });
    const steerBtn = h('button.btn.secondary', { onclick: () => {
      sfx.click();
      this.P.steer = this.P.steer === 'tilt' ? 'buttons' : 'tilt';
      saveProgress(this.P);
      if (this.P.steer === 'tilt') this.enableTilt(true);
      this.hud.setSteerMode(this.P.steer);
      steerBtn.textContent = `Lenken: ${this.P.steer === 'tilt' ? 'Neigen' : 'Tasten'}`;
    } }, `Lenken: ${this.P.steer === 'tilt' ? 'Neigen' : 'Tasten'}`);
    const invBtn = h('button.btn.secondary', { onclick: () => { sfx.click(); this.P.tiltInvert = !this.P.tiltInvert; saveProgress(this.P); invBtn.textContent = `Neigen umkehren: ${this.P.tiltInvert ? 'an' : 'aus'}`; } }, `Neigen umkehren: ${this.P.tiltInvert ? 'an' : 'aus'}`);
    const touch = matchMedia('(pointer: coarse)').matches;
    const card = h('div.card.panel.dr-board', {}, [
      h('div.dr-bhead', {}, [h('div.dr-face', { style: '--c:#50af30' }, 'X'), h('div', {}, [h('div.kicker', {}, 'Bordcomputer · itmX CRM mobil'), h('h2', {}, 'Aufträge in Ludlein'), h('p', {}, `Quartal: ${fmtEuro(this.revenue())} von ${fmtEuro(QUOTA)} · Provision ${fmtEuro(this.P.provision)} · ${this.P.deals.length}/${MISSIONS.length} Deals`)]), h('button.icon-btn', { style: 'position:static', onclick: () => { sfx.click(); this.closeOverlay(); } }, '✕')]),
      canvas,
      h('div.dr-board-grid', {}, cards),
      h('p', { style: 'font-size:12px;color:var(--muted);margin:10px 0' }, touch ? 'Pedale rechts, Lenkung links. Oder Lenken per Neigen. Tipp auf die Minikarte öffnet den Bordcomputer.' : 'W/S oder Pfeile: Gas/Bremse · A/D: lenken · Leertaste: Handbremse · C: Kamera · H: Hupe · P: Radio an/aus · N: nächster Song · R: Abschleppen · M: Bordcomputer · 1–3: Antworten'),
      h('div.row', {}, [h('button.btn.gold', { onclick: () => { sfx.click(); this.closeOverlay(); } }, '🚗 Weiterfahren'), touch ? steerBtn : null, touch && this.P.steer === 'tilt' ? invBtn : null, this.M ? h('button.btn.secondary', { onclick: () => { sfx.click(); this.closeOverlay(); this.abortMission(); } }, 'Auftrag abbrechen') : null, h('button.btn.secondary', { onclick: () => { sfx.click(); this.closeOverlay(); if (this.M) this.endMission(); this.showShowroom(); } }, '🏁 Zum Fuhrpark')])
    ]);
    this.boardEl = mount(h('div.overlay.dr-ov', { onclick: (e) => { if (e.target === this.boardEl) this.closeOverlay(); } }, card));
    const marks = MISSIONS.map((m) => { const p = this.missionPlace(m); return { x: p.x, z: p.z, icon: m.icon, color: this.P.deals.includes(m.id) ? '#3ddc84' : '#ffcc4d', r: 17 }; });
    if (this.battery != null) for (const c of CHARGERS) marks.push({ x: c.x, z: c.z, icon: '⚡', color: '#50af30', r: 13 });
    this.hud.bigMap(canvas, this.V.pos.x, this.V.pos.z, marks);
  }
  /** test helper: simulate `sec` seconds with the given keys held (no rendering) */
  debugSim(sec, keys = [], dt = 1 / 30) {
    const before = new Set(this.keys);
    this.keys = new Set(keys);
    this.simT = this.simT || 0;
    for (let t = 0; t < sec; t += dt) { this.simT += dt; this.update(dt, this.simT); }
    this.keys = before;
    const V = this.V;
    return { x: +V.pos.x.toFixed(1), z: +V.pos.z.toFixed(1), kmh: Math.round(V.kmh), h: +V.heading.toFixed(2), mode: this.mode, lim: this.limitInfo?.limit, phase: this.M?.phase, mission: this.M?.def.id, bat: this.battery, prov: this.P.provision, deals: this.P.deals.join() };
  }
  closeOverlay() {
    this.boardEl?.remove();
    this.boardEl = null;
    if (this.mode === 'board') this.mode = 'drive';
  }
}
