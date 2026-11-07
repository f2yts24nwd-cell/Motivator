import * as THREE from 'three';
import { rand, clamp, lerp } from '../../core/gfx.js';
import { sfx, music, unlockAudio, isMuted, setMuted, createNoiseLoop } from '../../core/audio.js';
import { h, mount, clearUI, storeGet, storeSet } from '../../core/ui.js';
import { FX } from './fx.js';
import { buildDanny, buildNPC, tintNPC, buildSAP, buildSpaghetti, buildLastenheft, buildDuck, buildToolbox, screenTexture, buildStraw } from './models.js';
import { buildOffice, buildStage, AW, AD, STAGE } from './office.js';
import * as C from './content.js';
import { EMBLEM_SVG } from './emblem.js';
import { songById } from '../../core/songs.js';

const SONG = songById('frag-den-danny');
import './danny.css';

const pick = C.pick;
const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const TOOL_IDS = C.TOOLS.map((t) => t.id);
const MAX_FIRES = 16;
const FOAM_RANGE = 5.4;
const REACH = 2.3;
const STAGE_CAP = [3, 4, 5, 6, 7];
const STAGE_INTERVAL = [5.6, 4.6, 3.8, 3.1, 2.5];
const STAGE_TYPES = [
  { brand: 3, faul: 3, frage: 3, anforderung: 2 },
  { brand: 2, faul: 3, frage: 3, anforderung: 3, vergessen: 3, code: 3 },
  { brand: 2, faul: 3, frage: 3, anforderung: 3, vergessen: 3, code: 3, sap: 2 },
  { brand: 2, faul: 3, frage: 3, anforderung: 3, vergessen: 3, code: 3, sap: 3 },
  { brand: 3, faul: 3, frage: 3, anforderung: 4, vergessen: 3, code: 4, sap: 3 }
];
const TUTORIAL = ['brand', 'faul', 'frage', 'code', 'anforderung', 'vergessen'];

export class DannyGame {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 220);
    this.raycaster = new THREE.Raycaster();
    this.groundPlane = new THREE.Plane(V(0, 1, 0), 0);
    this.coarse = matchMedia('(pointer: coarse)').matches;
    this.quality = this.coarse ? 0.65 : 1;
    this.keys = new Set();
    this.state = 'idle';
    this.buildWorld();
    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onKeyDown = this.onKeyDown.bind(this);
    this.onKeyUp = (e) => { this.keys.delete(e.key.toLowerCase()); if (e.key === ' ') this.keyFire = false; };
    this.onWheel = (e) => { if (this.state === 'play') this.cycleTool(e.deltaY > 0 ? 1 : -1); };
  }

  // ------------------------------------------------------------------ world
  buildWorld() {
    const s = this.scene;
    s.background = new THREE.Color(0x07090f);
    s.fog = new THREE.Fog(0x07090f, 30, 70);
    s.environment = this.app.gfx.envMap;
    s.environmentIntensity = 0.4;
    s.add(new THREE.HemisphereLight(0xbcd0ff, 0x2a1a18, 0.75));
    const sun = new THREE.DirectionalLight(0xfff0e0, 1.8);
    sun.position.set(6, 18, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(this.coarse ? 1024 : 2048, this.coarse ? 1024 : 2048);
    Object.assign(sun.shadow.camera, { left: -15, right: 15, top: 11, bottom: -11, near: 1, far: 50 });
    sun.shadow.bias = -0.0005;
    sun.shadow.normalBias = 0.03;
    s.add(sun, sun.target);
    this.sun = sun;
    // ceiling light pools
    for (const x of [-7, 0, 7]) for (const z of [-3, 4]) {
      const pl = new THREE.PointLight(0xfff0d8, 5, 11, 1.8);
      pl.position.set(x, 4.5, z);
      s.add(pl);
    }
    this.office = buildOffice(s);
    this.stage = buildStage(s);
    this.danny = buildDanny();
    s.add(this.danny.root);
    // colleagues
    this.npcs = [];
    const addNPC = (seat) => {
      const m = buildNPC(seat.role);
      m.root.position.copy(seat.pos);
      m.root.rotation.y = seat.yaw;
      s.add(m.root);
      const npc = { ...m, seat, standK: 0, state: 'sit', problem: null, wet: 0, soot: 0, react: null, showerCd: 0, hitCd: 0, fall: 0, panic: 0, ph: Math.random() * 6 };
      this.npcs.push(npc);
      return npc;
    };
    for (const seat of this.office.seats) if (seat.role) addNPC(seat);
    for (const seat of this.office.meeting.seats) { const n = addNPC(seat); if (seat.role === 'kunde') this.kunde = n; }
    // the wandering project manager
    const pm = buildNPC('pl');
    s.add(pm.root);
    this.wanderer = { ...pm, seat: null, standK: 1, state: 'walk', problem: null, wet: 0, soot: 0, react: null, showerCd: 0, hitCd: 0, fall: 0, panic: 0, ph: 0, walk: { target: V(), speed: 1.4, wait: 0 } };
    this.npcs.push(this.wanderer);
    // fire light pool
    this.fireLights = [];
    for (let i = 0; i < 6; i++) {
      const l = new THREE.PointLight(0xff7a2a, 0, 7.5, 1.7);
      s.add(l);
      this.fireLights.push(l);
    }
    // aim reticle
    this.reticle = new THREE.Mesh(new THREE.RingGeometry(0.28, 0.38, 32), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.4), transparent: true, opacity: 0.8, depthWrite: false }));
    this.reticle.rotation.x = -Math.PI / 2;
    this.reticle.visible = false;
    s.add(this.reticle);
    // falling-SAP warning ring template
    this.warnGeo = new THREE.RingGeometry(1.1, 1.35, 40);
    this.warnGeo.rotateX(-Math.PI / 2);
    this.fx = new FX(s);
    // pools for the problem objects
    this.saps = []; this.monsters = []; this.docs = []; this.ducks = []; this.pickups = []; this.fires = []; this.straws = [];
    this.duckGeo = buildDuck();
    this.screens = { error: screenTexture('error') };
  }

  // ------------------------------------------------------------------ lifecycle
  enter() {
    const c = this.app.gfx.renderer.domElement;
    c.addEventListener('pointerdown', this.onDown);
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('pointercancel', this.onUp);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    c.addEventListener('wheel', this.onWheel, { passive: true });
    this.best = storeGet('danny-best', 0);
    this.voice = storeGet('danny-voice', true);
    this.songOn = storeGet('danny-song', true);
    this.resize(window.innerWidth, window.innerHeight);
    this.showSafe();
    if (!this.warmed) { this.warmed = true; try { this.app.gfx.renderer.compile(this.scene, this.camera); } catch { /* ignore */ } }
  }

  exit() {
    const c = this.app.gfx.renderer.domElement;
    c.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('pointercancel', this.onUp);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    c.removeEventListener('wheel', this.onWheel);
    c.style.cursor = '';
    this.keys.clear();
    this.stopLoops();
    this.shutUp();
    music.setIntensity(0);
    this.state = 'idle';
    clearUI();
  }

  resize(w, hh) {
    this.camera.aspect = w / hh;
    this.portrait = w / hh < 0.85;
    this.wideMenu = w >= 1100 && hh >= 600;
    this.camera.fov = this.portrait ? 62 : 48;
    this.camera.updateProjectionMatrix();
    this.fx.setScale(this.camera, hh * this.app.gfx.renderer.getPixelRatio());
  }

  stopLoops() {
    this.sprayLoop?.stop(); this.sprayLoop = null;
    this.fireLoop?.stop(); this.fireLoop = null;
  }

  // ------------------------------------------------------------------ speech (optional)
  speak(text, { pitch = 1, rate = 1.08, force = false } = {}) {
    if (!this.voice || isMuted() || !window.speechSynthesis) return;
    const ss = window.speechSynthesis;
    if (ss.speaking && !force) return;
    try {
      ss.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/[„“”"]/g, ''));
      u.lang = 'de-DE';
      const v = ss.getVoices().find((x) => x.lang?.startsWith('de'));
      if (v) u.voice = v;
      u.pitch = pitch; u.rate = rate; u.volume = 0.9;
      ss.speak(u);
    } catch { /* ignore */ }
  }
  shutUp() { try { window.speechSynthesis?.cancel(); } catch { /* ignore */ } }

  // ------------------------------------------------------------------ key safe (code 0815)
  showSafe() {
    this.showMenu(); // sets up stage, music and round state behind the safe
    clearUI();
    this.baseUI();
    this.state = 'safe';
    const CODE = [0, 8, 1, 5];
    const digits = [0, 0, 0, 0];
    let active = 0, tries = 0, opened = false;
    const wheels = digits.map((_, i) => {
      const prev = h('span.p'), cur = h('span.c'), next = h('span.n');
      const el = h('div.dn-wheel', { 'data-i': String(i) }, [h('div.dn-wheel-strip', {}, [prev, cur, next])]);
      return { el, prev, cur, next };
    });
    const render = (i, dir = 0) => {
      const w = wheels[i], d = digits[i];
      w.prev.textContent = String((d + 9) % 10);
      w.cur.textContent = String(d);
      w.next.textContent = String((d + 1) % 10);
      wheels.forEach((x, k) => x.el.classList.toggle('on', k === active));
      if (dir) { w.el.classList.remove('up', 'down'); void w.el.offsetWidth; w.el.classList.add(dir > 0 ? 'up' : 'down'); }
    };
    const turn = (i, dir) => {
      if (opened) return;
      active = i;
      digits[i] = (digits[i] + dir + 10) % 10;
      render(i, dir);
      sfx.click();
      hint.classList.remove('bad');
    };
    wheels.forEach((w, i) => {
      render(i);
      let y0 = 0, moved = false;
      w.el.addEventListener('pointerdown', (e) => { unlockAudio(); y0 = e.clientY; moved = false; w.el.setPointerCapture?.(e.pointerId); e.preventDefault(); });
      w.el.addEventListener('pointermove', (e) => { if (!y0) return; const dy = e.clientY - y0; if (Math.abs(dy) > 22) { turn(i, dy < 0 ? 1 : -1); y0 = e.clientY; moved = true; } });
      w.el.addEventListener('pointerup', (e) => {
        if (!moved && y0) { const r = w.el.getBoundingClientRect(); turn(i, e.clientY < r.top + r.height / 2 ? -1 : 1); }
        y0 = 0;
      });
      w.el.addEventListener('wheel', (e) => { e.preventDefault(); turn(i, e.deltaY > 0 ? 1 : -1); }, { passive: false });
    });
    const hint = h('p.dn-safe-hint', {}, 'Stell den Code ein und drück den Schieber.');
    const door = h('div.dn-safe-door', {}, [h('div.dn-safe-inside', {}, [h('i', {}, '🔑'), h('b', {}, 'WACHE')]), h('div.dn-safe-front', {}, [h('em', {}, 'itmX'), h('small', {}, 'SCHLÜSSELTRESOR · FEUERWACHE')])]);
    const tryOpen = () => {
      if (opened) return;
      unlockAudio();
      slider.classList.remove('push'); void slider.offsetWidth; slider.classList.add('push');
      if (digits.every((d, i) => d === CODE[i])) {
        opened = true;
        sfx.clang(1.1);
        safe.classList.add('open');
        hint.classList.remove('bad');
        hint.textContent = '✔ Richtig! Ganz normale 0815-Arbeitseinstellung. Einsatz frei.';
        setTimeout(() => sfx.powerup(), 350);
        setTimeout(() => { if (this.state === 'safe') this.showMenu(); }, 1700);
      } else {
        tries++;
        sfx.thud();
        setTimeout(() => sfx.error(), 60);
        safe.classList.remove('shake'); void safe.offsetWidth; safe.classList.add('shake');
        hint.classList.add('bad');
        hint.textContent = `✖ Falsch${tries > 1 ? ` (${tries}. Versuch)` : ''}. Tipp: Der Code entspricht deiner Arbeitseinstellung.`;
      }
    };
    const slider = h('button.dn-slider', { title: 'Öffnen', onclick: tryOpen }, h('i'));
    const safe = h('div.dn-safe', {}, [
      h('div.dn-safe-window', {}, [slider, ...wheels.map((w) => w.el)]),
      door
    ]);
    this.safeKeys = (e) => {
      if (opened) return;
      if (/^[0-9]$/.test(e.key)) { digits[active] = +e.key; render(active, 1); sfx.click(); active = Math.min(3, active + 1); render(active); }
      else if (e.key === 'ArrowLeft') { active = Math.max(0, active - 1); render(active); }
      else if (e.key === 'ArrowRight') { active = Math.min(3, active + 1); render(active); }
      else if (e.key === 'ArrowUp') turn(active, -1);
      else if (e.key === 'ArrowDown') turn(active, 1);
      else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); tryOpen(); }
    };
    mount(h('div.overlay.dn-safe-wrap', {}, h('div.dn-safe-stage', {}, [
      h('div.kicker', {}, 'Feuerwache itmX · Zutritt nur für Danny'),
      h('h2', {}, 'Schlüsseltresor'),
      safe,
      hint
    ])));
  }

  // ------------------------------------------------------------------ menu
  /** the Suno song "Frag den Danny" (default) or the synthesized metal soundtrack */
  startMusic() {
    if (this.songOn && SONG) music.playSong(SONG.src, { loop: true });
    else music.play('metal');
  }
  toggleSong() {
    this.songOn = !this.songOn;
    storeSet('danny-song', this.songOn);
    if (!this.songOn) music.stopSong(0.6);
    this.startMusic();
    sfx.click();
    document.querySelectorAll('.dn-songbtn').forEach((b) => this.paintSongBtn(b));
  }
  paintSongBtn(b) {
    b.classList.toggle('off', !this.songOn);
    b.querySelector('b').textContent = this.songOn ? SONG.title : 'Metal-Soundtrack';
  }

  baseUI() {
    clearUI();
    if (SONG) {
      const sb = mount(h('button.dn-songbtn.panel', { title: 'Song oder Metal-Soundtrack', onclick: () => this.toggleSong() }, [
        h('img', { src: SONG.cover, alt: '' }),
        h('span', {}, [h('small', {}, '♪ Musik'), h('b')]),
        h('i.kr-eq', {}, [h('em'), h('em'), h('em')])
      ]));
      this.paintSongBtn(sb);
    }
    mount(h('button.icon-btn.left.dn-top', { title: 'Zurück zur Spielewelt', onclick: () => { sfx.click(); this.app.goHub(); } }, '⟵'));
    const mute = mount(h('button.icon-btn.right.dn-top', { title: 'Ton an/aus', onclick: () => { setMuted(!isMuted()); mute.textContent = isMuted() ? '🔇' : '🔊'; if (isMuted()) this.shutUp(); } }, isMuted() ? '🔇' : '🔊'));
  }

  showMenu() {
    this.state = 'menu';
    this.resetRound();
    this.baseUI();
    music.setIntensity(-1);
    this.startMusic();
    this.placeDannyAtStage();
    this.stage.station.door.position.y = this.stage.station.doorH / 2;
    this.stage.station.door.scale.y = 1;
    this.menuT = 0;
    const voiceBtn = h('button.dn-toggle', { onclick: () => { this.voice = !this.voice; storeSet('danny-voice', this.voice); voiceBtn.textContent = this.voice ? '🗣️ Sprachausgabe: an' : '🤐 Sprachausgabe: aus'; sfx.click(); if (this.voice) this.speak('Frag den Danny!', { force: true }); } }, this.voice ? '🗣️ Sprachausgabe: an' : '🤐 Sprachausgabe: aus');
    const touch = this.coarse;
    mount(h('div.overlay.dn-menu', {}, h('div.card.panel.dn-card', {}, [
      h('div.dn-head', {}, [
        h('div.dn-emblem-wrap', { html: EMBLEM_SVG }),
        h('figure.dn-portrait', {}, [h('img', { src: `${import.meta.env.BASE_URL}danny/danny-3d.webp`, alt: 'Danny' }), h('figcaption', {}, 'Einsatzleiter Danny')])
      ]),
      h('div.kicker', {}, 'Bonusspiel · Feuerwache itmX'),
      h('h1', {}, 'Frag den Danny!'),
      h('p', {}, 'Immer wenn es brennt, kommt Feuerwehrmann Danny. Berater denken nicht, Kunden erfinden Anforderungen, Entwickler hassen ihren Code und irgendwas ist mit SAP. Lösch alles, bevor das Projekt abbrennt. Eine Schicht dauert 3 Minuten.'),
      h('div.dn-tools-legend', {}, C.TOOLS.map((t) => h('div', {}, [h('b', {}, `${t.icon} ${t.name}`), h('span', {}, t.desc), h('kbd', {}, touch ? 'Tippen' : `Taste ${t.key}`)]))),
      h('div.dn-legend', {}, [
        h('div', {}, [h('b', {}, '🔥 Brände, 📄 Anforderungen'), '→ 🧯 Löscher']),
        h('div', {}, [h('b', {}, '💤 Berater denkt nicht, 🐟 vergessen'), '→ ⚡ Denk-Defi']),
        h('div', {}, [h('b', {}, '❓ „DANNY! Kurze Frage …“'), '→ 🦆 Debug-Ente werfen']),
        h('div', {}, [h('b', {}, '🍝 Spaghetti-Code, 🗿 SAP'), '→ 🔨 Hard-Reset-Hammer']),
        h('div', {}, [h('b', {}, '💦 Abreibung'), 'Kollegen duschen gibt Punkte. Den Kunden duschen auch. Kostet aber Nerven.']),
        h('div', {}, [h('b', {}, '🧰 Werkzeugkoffer'), 'Großschlauch, Espresso, Enten, Sprinkler. Und am Hydranten nachfüllen.'])
      ]),
      h('p.dn-controls', {}, touch
        ? 'Steuerung: links ziehen = laufen, rechts gedrückt halten = zielen und benutzen. Werkzeuge unten rechts.'
        : 'Steuerung: WASD/Pfeile laufen, Maus zielen, linke Maustaste benutzen. Werkzeuge 1–4, Mausrad oder Q/E.'),
      this.best ? h('p', {}, `Dein Rekord: ${this.best.toLocaleString('de-DE')} Punkte`) : null,
      h('div.row', {}, [
        h('button.btn.dn-go', { onclick: () => { unlockAudio(); sfx.click(); this.startAlarm(); } }, '🚨 Einsatz!'),
        voiceBtn
      ])
    ])));
  }

  placeDannyAtStage() {
    const d = this.danny;
    d.root.position.copy(STAGE).add(V(3.2, 0, 3.2));
    d.root.rotation.y = -0.5;
    this.setTool('foam');
    this.sun.position.copy(STAGE).add(V(6, 18, 10));
    this.sun.target.position.copy(STAGE);
  }

  startAlarm() {
    if (this.state !== 'menu') return;
    this.state = 'alarm';
    this.alarmT = 0;
    clearUI();
    this.baseUI();
    sfx.siren(3);
    sfx.alarm();
    music.setIntensity(4);
    this.speak('Alarm! Einsatz für Danny!', { force: true, rate: 1.15 });
    mount(h('div.dn-strobe.passthrough'));
    mount(h('div.dn-alarm.passthrough', {}, [h('b', {}, 'ALAAARM!'), h('span', {}, 'Einsatz für Danny')]));
  }

  // ------------------------------------------------------------------ round
  resetRound() {
    for (const f of this.fires) this.removeFire(f, true);
    this.fires.length = 0;
    for (const s of this.saps) { this.scene.remove(s.group); this.scene.remove(s.warn); }
    for (const m of this.monsters) this.scene.remove(m.group);
    for (const d of this.docs) this.scene.remove(d.group);
    for (const d of this.ducks) this.scene.remove(d.mesh);
    for (const p of this.pickups) this.scene.remove(p.group);
    for (const st of this.straws) this.scene.remove(st.group);
    this.straws.length = 0;
    this.strohT = rand(45, 70);
    this.maskT = 0;
    this.danny.mask.visible = false;
    document.querySelectorAll('.dn-meme, .dn-meme-alarm').forEach((e) => e.remove());
    this.saps.length = 0; this.monsters.length = 0; this.docs.length = 0; this.ducks.length = 0; this.pickups.length = 0;
    this.problems = [];
    this.fx.clear();
    for (const npc of this.npcs) {
      npc.problem = null; npc.state = npc === this.wanderer ? 'walk' : 'sit'; npc.wet = 0; npc.soot = 0; npc.react = null; npc.fall = 0; npc.panic = 0; npc.standK = npc.seat ? 0 : 1;
      tintNPC(npc, 0, 0);
      if (npc.hair) npc.hair.scale.y = npc.role === 'berater' ? 0.75 : 0.9;
      if (npc.seat?.desk) npc.seat.desk.screenMat.map = npc.seat.desk.baseMap || npc.seat.desk.screenMat.map;
    }
    for (const seat of this.office.seats) if (seat.desk) { seat.desk.baseMap = seat.desk.baseMap || seat.desk.screenMat.map; seat.desk.screenMat.map = seat.desk.baseMap; }
    this.wanderer.root.position.set(2, 0, 1.6);
    this.wanderer.walk.target.set(2, 0, 1.6);
    this.score = 0; this.combo = 0; this.bestCombo = 0; this.lastSolve = -10;
    this.stats = { fires: 0, solved: 0, showers: 0, zaps: 0, bonks: 0, ducks: 0, kunde: 0 };
    this.escalation = 0;
    this.elapsed = 0; this.timeLeft = C.GAME_TIME; this.stageIdx = 0;
    this.spawnT = 2.2; this.spawned = 0; this.sapForced = false;
    this.pickupT = 16;
    this.pressure = 100; this.ammo = 6;
    this.turbo = 0; this.coffee = 0; this.sprinkler = 0;
    this.toolCd = 0; this.act = null; this.burnCd = 0; this.emptyCd = 0;
    this.firing = false; this.keyFire = false; this.stick = null; this.aimPtr = null;
    this.aim = V(0, 0, 0); this.aimActive = false;
    this.shake = 0; this.hitStop = 0;
    this.timers = [];
    this.bubbles?.forEach((b) => b.el.remove());
    this.bubbles = [];
    this.seenTypes = new Set();
    this.reticle.visible = false;
  }

  beginShift() {
    this.resetRound();
    const d = this.danny;
    d.root.position.copy(this.office.spawn);
    d.root.rotation.y = Math.PI / 2;
    this.sun.position.set(6, 18, 10);
    this.sun.target.position.set(0, 0, 0);
    this.setTool('foam');
    this.buildHUD();
    this.camInit = false;
    this.state = 'count';
    this.office.doorLight.intensity = 30;
    music.setIntensity(0);
    if (!this.sprayLoop) this.sprayLoop = createNoiseLoop('spray');
    if (!this.fireLoop) this.fireLoop = createNoiseLoop('fire');
    const cd = mount(h('div.countdown.dn-count.passthrough'));
    let n = 3;
    const tick = () => {
      if (this.state !== 'count') { cd.remove(); return; }
      cd.replaceChildren(h('span', {}, n > 0 ? String(n) : 'WASSER MARSCH!'));
      sfx.beep(n === 0);
      if (n === 0) {
        this.state = 'play';
        this.say(this.danny.neck, pick(C.DANNY_LINES), 'danny', 3.2);
        this.feed(C.STAGE_LINES[0], 'stage');
        setTimeout(() => cd.remove(), 900);
        return;
      }
      n--;
      setTimeout(tick, 700);
    };
    tick();
  }

  endGame(won) {
    if (this.state !== 'play') return;
    this.state = 'over';
    this.firing = false;
    this.sprayLoop?.set(0);
    this.fireLoop?.set(0);
    music.setIntensity(won ? 3 : -1);
    if (won) sfx.win(); else { sfx.boom(1.4); sfx.lose(); }
    this.shutUp();
    if (this.score > this.best) { this.best = this.score; storeSet('danny-best', this.best); }
    const rank = C.rankFor(this.score);
    const st = this.stats;
    if (!won) for (let i = 0; i < 6; i++) setTimeout(() => { const p = V(rand(-8, 8), 0.2, rand(-5, 5)); if (this.validSpot(p.x, p.z, 0.3)) this.addFire(p, 1.2, null, true); }, i * 120);
    setTimeout(() => {
      if (this.state !== 'over') return;
      document.querySelectorAll('.dn-hud, .dn-esc, .dn-tools, .dn-feed, .dn-stick').forEach((e) => e.remove());
      mount(h('div.overlay.dn-over', {}, h('div.card.panel.dn-card', {}, [
        h('div.dn-emblem-wrap.small', { html: EMBLEM_SVG }),
        h('div.kicker', {}, won ? 'Schichtende · Einsatzbericht' : 'Projekt abgebrannt · Einsatzbericht'),
        h('h1', {}, `${this.score.toLocaleString('de-DE')} Punkte`),
        h('div', {}, h(`span.rank.dn-rank.${rank.id}`, {}, rank.name)),
        h('p', {}, won ? pick(C.WIN_LINES) : pick(C.GAMEOVER_LINES)),
        h('p', {}, rank.line),
        h('div.dn-report', {}, [
          ['🔥 Brände gelöscht', st.fires], ['🛠️ Probleme gelöst', st.solved], ['💦 Kollegen geduscht', st.showers],
          ['⚡ Defi-Einsätze', st.zaps], ['🔨 Hard Resets', st.bonks], ['🦆 Enten geworfen', st.ducks],
          ['🤵 Kunde nass gemacht', st.kunde], ['🔗 Beste Combo', `x${this.bestCombo}`]
        ].map(([k, v]) => h('div', {}, [h('span', {}, k), h('b', {}, String(v))]))),
        h('p', {}, `Rekord: ${this.best.toLocaleString('de-DE')} Punkte`),
        h('div.row', {}, [
          h('button.btn.dn-go', { onclick: () => { sfx.click(); this.state = 'menu'; this.startAlarmFromOver(); } }, '🚨 Nochmal'),
          h('button.btn.secondary', { onclick: () => { sfx.click(); this.showMenu(); } }, 'Zur Feuerwache')
        ])
      ])));
    }, won ? 1400 : 2200);
  }

  startAlarmFromOver() {
    this.resetRound();
    this.placeDannyAtStage();
    this.startAlarm();
  }

  // ------------------------------------------------------------------ HUD
  buildHUD() {
    this.baseUI();
    const stat = (cls, label) => { const strong = h('strong', {}, '0'); const el = h(`div.stat.panel.${cls}`, {}, [h('small', {}, label), strong]); return { el, strong }; };
    this.hud = { score: stat('score', 'Punkte'), time: stat('time', 'Schicht'), stage: stat('stage', 'Alarmstufe'), combo: stat('combo', 'Combo') };
    mount(h('div.hud.dn-hud.passthrough', {}, Object.values(this.hud).map((s) => s.el)));
    this.escBar = h('i');
    this.escEl = mount(h('div.dn-esc.passthrough', {}, [h('small', {}, '🔥 Eskalation'), h('div', {}, this.escBar)]));
    this.feedEl = mount(h('div.dn-feed.passthrough'));
    this.markersEl = mount(h('div.dn-markers.passthrough'));
    this.bubblesEl = mount(h('div.dn-bubbles.passthrough'));
    this.gauge = h('canvas.dn-gauge', { width: '120', height: '120' });
    this.toolBtns = {};
    const btns = C.TOOLS.map((t) => {
      const extra = t.id === 'duck' ? h('em', {}, '6') : t.id === 'foam' ? this.gauge : null;
      const b = h('button.dn-tool', { 'data-tool': t.id, onpointerdown: (e) => { e.stopPropagation(); e.preventDefault(); unlockAudio(); this.setTool(t.id); } }, [h('i', {}, t.icon), h('span', {}, t.short), this.coarse ? null : h('kbd', {}, t.key), extra]);
      this.toolBtns[t.id] = b;
      return b;
    });
    this.toolsEl = mount(h('div.dn-tools', {}, btns));
    this.powerEl = mount(h('div.dn-power.passthrough'));
    if (this.coarse) {
      this.stickEl = mount(h('div.dn-stick.passthrough', {}, h('i')));
      this.stickEl.style.display = 'none';
    }
    this.setTool(this.tool || 'foam');
    this.lastHud = {};
    this.drawGauge(true);
  }

  updateHUD() {
    if (!this.hud) return;
    const set = (k, v) => { if (this.lastHud[k] !== v) { this.lastHud[k] = v; this.hud[k].strong.textContent = v; } };
    set('score', this.score.toLocaleString('de-DE'));
    const tl = Math.max(0, Math.ceil(this.timeLeft));
    set('time', `${Math.floor(tl / 60)}:${String(tl % 60).padStart(2, '0')}`);
    this.hud.time.el.classList.toggle('low', tl <= 15 && this.state === 'play');
    set('stage', `${this.stageIdx + 1} / 5`);
    set('combo', `x${this.mult()}`);
    const e = clamp(this.escalation, 0, 100);
    this.escBar.style.width = `${e}%`;
    this.escEl.classList.toggle('hot', e > 70);
    const duckEm = this.toolBtns.duck.querySelector('em');
    if (duckEm && duckEm.textContent !== String(this.ammo)) duckEm.textContent = String(this.ammo);
    this.toolBtns.duck.classList.toggle('empty', this.ammo <= 0);
    const pw = [];
    if (this.turbo > 0) pw.push(`🚒 Großschlauch ${Math.ceil(this.turbo)} s`);
    if (this.coffee > 0) pw.push(`☕ Espresso ${Math.ceil(this.coffee)} s`);
    const txt = pw.join(' · ');
    if (this.powerEl.textContent !== txt) this.powerEl.textContent = txt;
    this.drawGauge();
  }

  drawGauge(force) {
    const p = this.turbo > 0 ? 100 : this.pressure;
    if (!force && Math.abs(p - (this.gaugeP ?? -1)) < 0.6) return;
    this.gaugeP = p;
    const g = this.gauge.getContext('2d');
    const c = 60;
    g.clearRect(0, 0, 120, 120);
    g.fillStyle = '#121212'; g.beginPath(); g.arc(c, c, 56, 0, 7); g.fill();
    g.fillStyle = '#f4f4f0'; g.beginPath(); g.arc(c, c, 48, 0, 7); g.fill();
    const a0 = Math.PI * 0.8, a1 = Math.PI * 2.2;
    g.lineWidth = 12;
    g.strokeStyle = '#d8242a'; g.beginPath(); g.arc(c, c, 34, a0, a0 + (a1 - a0) * 0.22); g.stroke();
    g.strokeStyle = '#2f9a3a'; g.beginPath(); g.arc(c, c, 34, a0 + (a1 - a0) * 0.24, a0 + (a1 - a0) * 0.86); g.stroke();
    g.strokeStyle = '#d8242a'; g.beginPath(); g.arc(c, c, 34, a0 + (a1 - a0) * 0.88, a1); g.stroke();
    const a = a0 + (a1 - a0) * (0.05 + 0.8 * p / 100);
    g.strokeStyle = '#111'; g.lineWidth = 5; g.lineCap = 'round';
    g.beginPath(); g.moveTo(c, c); g.lineTo(c + Math.cos(a) * 38, c + Math.sin(a) * 38); g.stroke();
    g.fillStyle = '#111'; g.beginPath(); g.arc(c, c, 7, 0, 7); g.fill();
    g.font = '700 13px Arial'; g.textAlign = 'center'; g.fillText('bar', c, c + 30);
    this.toolBtns.foam.classList.toggle('empty', p < 4);
  }

  feed(text, cls = '') {
    if (!this.feedEl) return;
    const el = h(`div.dn-feed-item.${cls || 'info'}`, {}, text);
    this.feedEl.prepend(el);
    while (this.feedEl.children.length > 3) this.feedEl.lastChild.remove();
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 7000);
  }

  popup(pos, text, cls = 'good') {
    const v = pos.clone().project(this.camera);
    if (v.z > 1) return;
    const el = mount(h(`div.popup.dn-pop.${cls}`, {}, text));
    el.style.left = `${(v.x * 0.5 + 0.5) * window.innerWidth}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    setTimeout(() => el.remove(), 950);
  }

  /** speech bubble that follows an object */
  say(obj, text, cls = '', life = 3.4) {
    if (!this.bubblesEl || !text) return;
    const old = this.bubbles.find((b) => b.obj === obj);
    if (old) { old.el.remove(); this.bubbles.splice(this.bubbles.indexOf(old), 1); }
    const max = window.innerWidth < 600 ? 2 : 4;
    // on small screens problem shouts win over chatter
    if (this.bubbles.length >= max && cls !== 'shout' && cls !== 'danny' && cls !== 'kunde' && window.innerWidth < 600) return;
    while (this.bubbles.length >= max) { const b = this.bubbles.shift(); b.el.remove(); }
    const el = h(`div.dn-bubble.${cls || 'npc'}`, {}, text);
    this.bubblesEl.append(el);
    this.bubbles.push({ el, obj, t: 0, life, w: el.offsetWidth || 200, hgt: el.offsetHeight || 40 });
  }

  mult() { return Math.min(5, 1 + Math.floor(Math.max(0, this.combo - 1) / 2)); }

  addScore(base, pos, label, solve = true) {
    if (solve) {
      this.combo = this.elapsed - this.lastSolve < 5 ? this.combo + 1 : 1;
      this.lastSolve = this.elapsed;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      if (this.combo >= 3 && this.combo % 2 === 1) { sfx.combo(this.mult()); this.popup(pos.clone().add(V(0, 1.2, 0)), `COMBO x${this.mult()}`, 'combo'); }
      if (this.combo === 6) this.say(this.danny.neck, pick(C.DANNY_LINES), 'danny', 3);
    }
    const pts = Math.round(base * (solve ? this.mult() : 1));
    this.score = Math.max(0, this.score + pts);
    this.popup(pos, `${label ? label + ' ' : ''}${pts >= 0 ? '+' : ''}${pts}`, pts >= 0 ? 'good' : 'bad');
  }

  /** run fn after `delay` seconds of game time (respects hit-stop) */
  later(delay, fn) { this.timers.push({ t: delay, fn }); }
  runTimers(dt) {
    for (const tm of [...this.timers]) { tm.t -= dt; if (tm.t <= 0) { this.timers.splice(this.timers.indexOf(tm), 1); tm.fn(); } }
  }

  // ------------------------------------------------------------------ tools
  setTool(id) {
    if (!TOOL_IDS.includes(id)) return;
    if (this.tool !== id && this.state === 'play') sfx.click();
    this.tool = id;
    const t = this.danny.tools;
    t.foam.visible = id === 'foam';
    t.defi.forEach((p) => (p.visible = id === 'defi'));
    t.hammer.visible = id === 'hammer';
    t.duck.visible = id === 'duck' && (this.ammo ?? 1) > 0;
    if (this.toolBtns) for (const [k, b] of Object.entries(this.toolBtns)) b.classList.toggle('on', k === id);
    this.act = null;
  }
  cycleTool(d) { const i = TOOL_IDS.indexOf(this.tool); this.setTool(TOOL_IDS[(i + d + TOOL_IDS.length) % TOOL_IDS.length]); }

  // ------------------------------------------------------------------ input
  onKeyDown(e) {
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (this.state === 'safe') { this.safeKeys?.(e); return; }
    if (this.state === 'menu' && e.key === 'Enter') { unlockAudio(); this.startAlarm(); return; }
    if (this.state !== 'play' && this.state !== 'count') return;
    const idx = ['1', '2', '3', '4'].indexOf(e.key);
    if (idx >= 0) this.setTool(TOOL_IDS[idx]);
    if (k === 'q') this.cycleTool(-1);
    if (k === 'e') this.cycleTool(1);
    if (e.key === ' ') { this.keyFire = true; e.preventDefault(); }
  }

  pointerWorld(e) {
    const r = this.app.gfx.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.camera);
    const out = V();
    return this.raycaster.ray.intersectPlane(this.groundPlane, out) ? out : null;
  }

  onDown(e) {
    unlockAudio();
    if (this.state !== 'play' && this.state !== 'count') return;
    const touch = e.pointerType !== 'mouse';
    if (touch && e.clientX < window.innerWidth * 0.42 && !this.stick) {
      this.stick = { id: e.pointerId, ox: e.clientX, oy: e.clientY, dx: 0, dy: 0 };
      if (this.stickEl) { this.stickEl.style.display = ''; this.stickEl.style.left = `${e.clientX}px`; this.stickEl.style.top = `${e.clientY}px`; this.stickEl.firstChild.style.transform = 'translate(-50%,-50%)'; }
      return;
    }
    if (!touch && e.button === 2) { this.cycleTool(1); return; }
    this.aimPtr = e.pointerId;
    const w = this.pointerWorld(e);
    if (w) { this.aim.copy(w); this.aimActive = true; }
    this.firing = true;
    this.aimTouch = touch;
  }

  onMove(e) {
    if (this.stick && e.pointerId === this.stick.id) {
      const dx = e.clientX - this.stick.ox, dy = e.clientY - this.stick.oy;
      const l = Math.hypot(dx, dy), max = 60;
      const k = l > max ? max / l : 1;
      this.stick.dx = (dx * k) / max; this.stick.dy = (dy * k) / max;
      if (this.stickEl) this.stickEl.firstChild.style.transform = `translate(calc(-50% + ${dx * k}px), calc(-50% + ${dy * k}px))`;
      return;
    }
    if (e.pointerType === 'mouse' || e.pointerId === this.aimPtr) {
      const w = this.pointerWorld(e);
      if (w) { this.aim.copy(w); this.aimActive = true; this.lastAimT = performance.now(); }
    }
  }

  onUp(e) {
    if (this.stick && e.pointerId === this.stick.id) { this.stick = null; if (this.stickEl) this.stickEl.style.display = 'none'; return; }
    if (e.pointerId === this.aimPtr || e.pointerType === 'mouse') { this.firing = false; this.aimPtr = null; if (this.aimTouch) this.aimActive = false; }
  }

  // ------------------------------------------------------------------ world queries
  validSpot(x, z, margin = 0.5) {
    if (Math.abs(x) > AW - 0.8 || Math.abs(z) > AD - 0.8) return false;
    for (const b of this.office.aabbs) if (x > b.minX - margin && x < b.maxX + margin && z > b.minZ - margin && z < b.maxZ + margin) return false;
    return true;
  }
  freeSpot(minDist = 2.5) {
    for (let i = 0; i < 60; i++) {
      const x = rand(-AW + 1.5, AW - 1.5), z = rand(-AD + 1.5, AD - 1.5);
      if (!this.validSpot(x, z, 0.9)) continue;
      if (Math.hypot(x - this.danny.root.position.x, z - this.danny.root.position.z) < minDist) continue;
      if (this.saps.some((s) => Math.hypot(s.pos.x - x, s.pos.z - z) < 2.4)) continue;
      return V(x, 0, z);
    }
    return null;
  }
  npcHead(npc) { const p = V(); npc.neck.getWorldPosition(p); return p.add(V(0, 0.2, 0)); }
  npcChest(npc) { const p = V(); npc.neck.getWorldPosition(p); p.y -= 0.35; return p; }

  // ------------------------------------------------------------------ fires
  addFire(pos, intensity = 0.5, problem = null, silent = false) {
    if (this.fires.length >= MAX_FIRES) return null;
    if (this.fires.some((f) => f.pos.distanceTo(pos) < 0.7)) {
      const f = this.fires.find((x) => x.pos.distanceTo(pos) < 0.7);
      f.I = Math.min(1.6, f.I + intensity * 0.5);
      if (problem && !f.problem) f.problem = problem;
      return f;
    }
    const f = { pos: pos.clone(), I: intensity, maxI: intensity, spreadT: 0, emit: 0, smokeT: 0, problem, age: 0 };
    this.fires.push(f);
    this.fx.scorch.add(pos.x, pos.z, { size: 1.6 + intensity, life: 40, grow: 0.3 });
    if (!silent) sfx.ignite();
    return f;
  }
  removeFire(f, quiet) {
    const i = this.fires.indexOf(f);
    if (i >= 0) this.fires.splice(i, 1);
    if (!quiet) { this.fx.steam(f.pos, 14); sfx.steam(); }
  }
  extinguish(f) {
    this.removeFire(f);
    this.stats.fires++;
    if (f.problem && !f.problem.done) this.solveProblem(f.problem, f.pos.clone().add(V(0, 1, 0)), 'foam');
    else this.addScore(Math.round(100 + 80 * f.maxI), f.pos.clone().add(V(0, 1, 0)), '🔥');
  }
  fireRadius(f) { return 0.35 + f.I * 0.55; }

  updateFires(dt, time) {
    const stageK = 1 + this.stageIdx * 0.18;
    let total = 0;
    const dpos = this.danny.root.position;
    for (const f of [...this.fires]) {
      f.age += dt;
      f.I = Math.min(1.6, f.I + 0.03 * dt * stageK);
      f.maxI = Math.max(f.maxI, f.I);
      total += f.I;
      // particles
      f.emit += dt * (20 + f.I * 36) * this.quality;
      while (f.emit > 1) { f.emit--; this.fx.flame(f.pos, f.I); }
      f.smokeT += dt * (3 + f.I * 5) * this.quality;
      while (f.smokeT > 1) { f.smokeT--; this.fx.smoke(f.pos, f.I); }
      if (Math.random() < dt * 4 * f.I) this.fx.ember(f.pos, f.I);
      // spread
      if (f.I > 1.0 && this.state === 'play') {
        f.spreadT += dt;
        if (f.spreadT > 6.5 - this.stageIdx * 0.6) {
          f.spreadT = 0;
          const a = Math.random() * 6.28, r = rand(1.5, 2.6);
          const p = V(f.pos.x + Math.cos(a) * r, 0.05, f.pos.z + Math.sin(a) * r);
          // spread onto a nearby desk if there is one
          const desk = this.office.seats.find((s) => s.top.distanceTo(p) < 1.1);
          if (desk) p.copy(desk.top);
          if (desk || this.validSpot(p.x, p.z, 0.1)) { this.addFire(p, 0.35); if (Math.random() < 0.4) this.feed('Feuer breitet sich aus! Ganz wie das Gerücht über die Budgetkürzung.', 'bad'); }
        }
      }
      // Danny gets singed
      const d = Math.hypot(dpos.x - f.pos.x, dpos.z - f.pos.z);
      const r = this.fireRadius(f) + 0.25;
      if (d < r && this.state === 'play') {
        const push = V(dpos.x - f.pos.x, 0, dpos.z - f.pos.z).normalize().multiplyScalar((r - d) * 0.6 + dt * 3);
        dpos.add(push);
        if (this.burnCd <= 0) {
          this.burnCd = 1.2;
          sfx.scream(1.3);
          this.addScore(-25, dpos.clone().add(V(0, 2.2, 0)), '🔥 Aua!', false);
          this.shake = Math.max(this.shake, 0.25);
        }
      }
      // panic nearby colleagues
      for (const npc of this.npcs) {
        const nd = Math.hypot(npc.root.position.x - f.pos.x, npc.root.position.z - f.pos.z);
        if (nd < 1.6 + f.I * 0.5) { npc.panic = Math.min(1, npc.panic + dt * 2); npc.soot = Math.min(1, npc.soot + dt * 0.04 * f.I); }
      }
    }
    // lights on the strongest fires
    const sorted = [...this.fires].sort((a, b) => b.I - a.I);
    this.fireLights.forEach((l, i) => {
      const f = sorted[i];
      if (!f) { l.intensity = 0; return; }
      l.position.set(f.pos.x, f.pos.y + 1.0 + f.I * 0.4, f.pos.z);
      l.intensity = (7 + f.I * 16) * (0.8 + Math.sin(time * 23 + i * 3) * 0.12 + Math.sin(time * 37 + i) * 0.08);
    });
    this.fireLoop?.set(clamp(total / 4, 0, 1), clamp(total / 6, 0, 1));
    return total;
  }

  // ------------------------------------------------------------------ problems
  freeNPC(filter) {
    const list = this.npcs.filter((n) => n.seat && !n.problem && n.state === 'sit' && n.fall <= 0 && n.role !== 'kunde' && (!filter || filter(n)));
    return list.length ? pick(list) : null;
  }

  spawnNext() {
    let type;
    if (this.spawned < TUTORIAL.length) type = TUTORIAL[this.spawned];
    else if (this.stageIdx >= 2 && !this.sapForced) { type = 'sap'; this.sapForced = true; }
    else {
      const w = STAGE_TYPES[this.stageIdx];
      const sum = Object.values(w).reduce((a, b) => a + b, 0);
      let r = Math.random() * sum;
      for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) { type = k; break; } }
    }
    if (type === 'sap' && this.saps.length >= 2) type = 'brand';
    if (type === 'code' && this.monsters.length >= 3) type = 'frage';
    if (this.spawnProblem(type)) this.spawned++;
  }

  spawnProblem(type) {
    const def = C.PROBLEMS[type];
    const P = { type, def, t: 0, limit: def.limit, done: false, npc: null, pos: V() };
    if (type === 'faul' || type === 'vergessen' || type === 'frage') {
      const npc = this.freeNPC(type === 'frage' ? null : (n) => n.role === 'berater' || n.role === 'pl') || this.freeNPC();
      if (!npc) return false;
      P.npc = npc;
      npc.problem = P;
      npc.state = type === 'faul' ? 'sleep' : type === 'vergessen' ? 'confused' : 'shout';
      this.say(npc.neck, pick(def.say), type === 'frage' ? 'shout' : 'npc', 4);
      if (type === 'frage') this.speak(pick(['Danny!', 'Dannyyy!', 'Danny, kurze Frage!']), { pitch: rand(0.8, 1.4), rate: 1.2, force: true });
      else this.speak(pick(def.say), { pitch: rand(0.7, 1.2) });
    } else if (type === 'code') {
      const npc = this.freeNPC((n) => n.role === 'dev') || this.freeNPC();
      if (!npc) return false;
      P.npc = npc;
      npc.problem = P;
      npc.state = 'despair';
      if (npc.seat.desk) npc.seat.desk.screenMat.map = this.screens.error;
      const m = buildSpaghetti();
      const top = npc.seat.top;
      m.group.position.set(top.x, top.y, top.z - npc.seat.aisle * 0.12);
      m.group.rotation.y = npc.seat.yaw + Math.PI;
      m.group.scale.setScalar(0.05);
      this.scene.add(m.group);
      const mon = { ...m, hp: 2, foamHp: 3, pos: m.group.position.clone(), age: 0, fireT: 0, P, hurt: 0 };
      this.monsters.push(mon);
      P.obj = mon;
      this.say(npc.neck, pick(def.say), 'npc', 4);
      this.speak(pick(def.say), { pitch: 1.15 });
      sfx.ignite();
    } else if (type === 'sap') {
      const p = this.freeSpot(3);
      if (!p) return false;
      const s = buildSAP();
      s.group.position.set(p.x, 16, p.z);
      s.group.rotation.y = rand(-0.5, 0.5);
      this.scene.add(s.group);
      const warn = new THREE.Mesh(this.warnGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.2), transparent: true, depthWrite: false }));
      warn.position.set(p.x, 0.03, p.z);
      this.scene.add(warn);
      const sap = { ...s, warn, pos: p, vy: 0, landed: false, hp: 3, fireT: 2, P, hurt: 0 };
      this.saps.push(sap);
      P.obj = sap;
      sfx.alarm();
      const witness = this.freeNPC() || this.npcs[0];
      this.say(witness.neck, pick(def.say), 'npc', 4);
      this.speak('Irgendwas mit SAP. Frag den Danny.', { pitch: 0.9 });
    } else if (type === 'anforderung') {
      const seat = pick(this.office.seats);
      const doc = buildLastenheft();
      const from = this.office.meeting.door.clone();
      doc.position.copy(from);
      this.scene.add(doc);
      this.docs.push({ group: doc, from, to: seat.top.clone(), t: 0, dur: 1.4, P });
      P.pos.copy(seat.top);
      this.say(this.kunde.neck, pick(def.say), 'kunde', 4.2);
      this.speak(pick(def.say), { pitch: 0.75, rate: 1.0 });
      sfx.whoosh();
    } else if (type === 'stroh') {
      const p = this.freeSpot(2.5);
      if (!p) return false;
      const st = buildStraw();
      st.group.position.set(p.x, 10, p.z);
      this.scene.add(st.group);
      const obj = { ...st, pos: p, vy: 0, landed: false, wet: 0, P, memeT: 0 };
      this.straws.push(obj);
      P.obj = obj;
      P.pos.copy(p);
      P.t = -1.4; // the fall does not count
      sfx.whoosh();
    } else if (type === 'brand') {
      const seat = pick(this.office.seats);
      const p = seat.top.clone();
      if (Math.random() < 0.4) { const fp = this.freeSpot(2); if (fp) p.copy(fp).setY(0.05); }
      P.fire = this.addFire(p, 0.45, P);
      if (!P.fire) return false;
      P.pos.copy(p);
    }
    this.problems.push(P);
    this.feed(`${def.icon} ${pick(def.feed)}`, 'alarm');
    if (!this.seenTypes.has(type) && type !== 'brand') {
      this.seenTypes.add(type);
      const tool = C.TOOLS.find((t) => t.id === def.tool);
      this.feed(`Tipp: ${def.label} → ${tool.icon} ${tool.name}${this.coarse ? '' : ` (Taste ${tool.key})`}`, 'tip');
    }
    this.addMarker(P);
    if (type !== 'anforderung' && type !== 'brand') sfx.alarm();
    return true;
  }

  addMarker(P) {
    const tool = C.TOOLS.find((t) => t.id === P.def.tool);
    const ring = h('i.ring');
    const el = h(`div.dn-marker.t-${P.def.tool}`, {}, [ring, h('b', {}, P.def.icon), h('small', {}, tool.icon), h('u')]);
    this.markersEl?.append(el);
    P.marker = { el, ring };
  }

  problemPos(P) {
    if (P.npc && !P.obj) return this.npcHead(P.npc).add(V(0, 0.7, 0));
    if (P.obj?.group) return P.obj.group.position.clone().add(V(0, P.type === 'sap' ? 2.8 : 1.8, 0));
    if (P.fire) return P.fire.pos.clone().add(V(0, 1.6 + P.fire.I * 0.6, 0));
    return P.pos.clone().add(V(0, 1.8, 0));
  }

  solveProblem(P, pos, tool) {
    if (P.done) return;
    P.done = true;
    const right = tool === P.def.tool;
    const base = right ? P.def.points : Math.round(P.def.points * 0.5);
    this.stats.solved++;
    this.addScore(base, pos, right ? P.def.icon : `${P.def.icon} (falsches Werkzeug)`);
    if (P.npc) {
      const npc = P.npc;
      npc.problem = null;
      npc.state = 'sit';
      if (npc.seat?.desk && npc.seat.desk.baseMap) npc.seat.desk.screenMat.map = npc.seat.desk.baseMap;
      if (P.def.solved.length) this.say(npc.neck, pick(P.def.solved), 'happy', 3.2);
    } else if (P.def.solved.length && Math.random() < 0.7) this.feed(`✅ ${pick(P.def.solved)}`, 'good');
    P.marker?.el.remove();
    const i = this.problems.indexOf(P);
    if (i >= 0) this.problems.splice(i, 1);
    this.escalation = Math.max(0, this.escalation - 4);
  }

  failProblem(P) {
    if (P.done) return;
    P.done = true;
    const npc = P.npc;
    if (npc) { npc.problem = null; npc.state = 'sit'; }
    P.marker?.el.remove();
    const i = this.problems.indexOf(P);
    if (i >= 0) this.problems.splice(i, 1);
    const at = npc ? npc.seat.top.clone() : P.pos.clone();
    if (P.type === 'stroh') this.removeStraw(P.obj, true);
    const f = this.addFire(P.type === 'stroh' ? at.setY(0.05) : at, P.type === 'stroh' ? 1.35 : 0.7);
    if (f) {
      const NP = { type: 'brand', def: C.PROBLEMS.brand, t: 0, limit: 0, done: false, fire: f, pos: at.clone() };
      f.problem = NP;
      this.problems.push(NP);
      this.addMarker(NP);
    }
    this.escalation = Math.min(100, this.escalation + 6);
    this.feed(`🔥 ${P.type === 'stroh' ? C.MEMES.stroh.fail : pick(C.ESCALATED)}`, 'bad');
    this.popup(at.clone().add(V(0, 1.6, 0)), 'ESKALIERT!', 'bad');
    sfx.error();
    this.shake = Math.max(this.shake, 0.3);
  }

  updateProblems(dt) {
    for (const P of [...this.problems]) {
      P.t += dt;
      if (P.limit && P.t > P.limit) { this.failProblem(P); continue; }
      if (P.type === 'brand' && P.fire && !this.fires.includes(P.fire)) { if (!P.done) this.solveProblem(P, P.fire.pos.clone().add(V(0, 1, 0)), 'foam'); }
    }
    this.updateStraws(dt);
    // flying requirement documents
    for (const d of [...this.docs]) {
      d.t += dt / d.dur;
      const k = Math.min(1, d.t);
      d.group.position.lerpVectors(d.from, d.to, k);
      d.group.position.y += Math.sin(k * Math.PI) * 3;
      d.group.rotation.set(k * 8, k * 5, k * 3);
      this.fx.flame(d.group.position, 0.35);
      if (Math.random() < 0.5) this.fx.smoke(d.group.position, 0.3);
      if (d.t >= 1) {
        this.scene.remove(d.group);
        this.docs.splice(this.docs.indexOf(d), 1);
        if (d.P) this.fx.papers.burst(d.to, 0xf4f1e6, 10, { speed: 3, up: 4, size: 0.18 });
        else this.fx.sauceBurst(d.to, 12);
        this.fx.sparks(d.to, 20, 'ember', 4);
        const f = this.addFire(d.to, 0.6, d.P || null);
        if (d.P) {
          d.P.fire = f;
          if (!f) { d.P.done = true; d.P.marker?.el.remove(); this.problems.splice(this.problems.indexOf(d.P), 1); }
        }
        this.shake = Math.max(this.shake, 0.15);
      }
    }
    // spaghetti monsters grow and spit fires
    for (const m of this.monsters) {
      m.age += dt;
      const s = m.age < 1.2 ? (m.age / 1.2) * 0.75 : Math.min(1.35, 0.75 + (m.age - 1.2) * 0.025);
      const hurt = m.hurt > 0 ? 1 + Math.sin(m.hurt * 50) * 0.15 : 1;
      m.hurt = Math.max(0, m.hurt - dt);
      m.group.scale.setScalar(s * hurt);
      m.noodles.forEach((n, i) => { n.rotation.y = Math.sin(m.age * 3 + n.userData.ph) * 0.25; n.rotation.z = Math.sin(m.age * 2.3 + i) * 0.12; });
      m.eyes.position.y = 1.25 + Math.sin(m.age * 4) * 0.08;
      const dp = this.danny.root.position;
      m.eyes.lookAt(dp.x, m.group.position.y + 1.4, dp.z);
      m.fireT += dt;
      if (m.age > 6 && m.fireT > 8 - this.stageIdx * 0.8) {
        m.fireT = 0;
        const target = pick(this.office.seats).top.clone();
        this.docs.push({ group: (() => { const b = new THREE.Mesh(new THREE.SphereGeometry(0.18, 10, 8), new THREE.MeshStandardMaterial({ color: 0x6b3a1e })); this.scene.add(b); return b; })(), from: m.group.position.clone().add(V(0, 1, 0)), to: target, t: 0, dur: 1.1, P: null });
        this.say(m.group, pick(['Fleischbällchen des Todes!', 'Ich bin dein Legacy-Code!', 'Bolognese-Breitseite!', 'Ich wurde 2009 geschrieben und ich bin WÜTEND!']), 'monster', 2.4);
      }
    }
    // SAP monoliths fall, then smoulder
    for (const s of this.saps) {
      if (!s.landed) {
        s.vy -= 30 * dt;
        s.group.position.y += s.vy * dt;
        s.warn.material.opacity = 0.5 + Math.sin(performance.now() / 60) * 0.4;
        s.warn.scale.setScalar(1 + Math.max(0, s.group.position.y) * 0.04);
        if (s.group.position.y <= 0) {
          s.group.position.y = 0;
          s.landed = true;
          this.scene.remove(s.warn);
          sfx.boom(1.2);
          this.shake = 0.9;
          this.hitStop = 0.08;
          this.fx.dust(s.pos, 40, 2);
          this.fx.ring(s.pos, 0xffaa66, 6, 0.6);
          this.fx.stones.burst(s.pos.clone().add(V(0, 0.3, 0)), 0x6e737b, 16, { speed: 6, up: 6, size: 0.16 });
          this.fx.scorch.add(s.pos.x, s.pos.z, { size: 3.2, life: 60, grow: 0 });
          this.fx.boom(s.pos, 0xffaa66, 1.2);
          // knock over people nearby
          for (const npc of this.npcs) if (Math.hypot(npc.root.position.x - s.pos.x, npc.root.position.z - s.pos.z) < 3) this.knockDown(npc);
          const dp = this.danny.root.position;
          const dd = Math.hypot(dp.x - s.pos.x, dp.z - s.pos.z);
          if (dd < 1.6) { dp.add(V(dp.x - s.pos.x, 0, dp.z - s.pos.z).normalize().multiplyScalar(2)); this.addScore(-50, dp.clone().add(V(0, 2.2, 0)), '🗿 Plattgemacht!', false); }
        }
        continue;
      }
      s.fireT -= dt;
      s.mat.emissiveIntensity = 0.06 + Math.sin(performance.now() / 300) * 0.04 + (3 - s.hp) * 0.12;
      if (Math.random() < dt * 6) this.fx.smoke(s.pos.clone().add(V(0, 1.2, 0)), 0.4);
      if (s.fireT <= 0) {
        s.fireT = 9 - this.stageIdx;
        const a = Math.random() * 6.28;
        const p = V(s.pos.x + Math.cos(a) * 1.4, 0.05, s.pos.z + Math.sin(a) * 1.4);
        if (this.validSpot(p.x, p.z, 0)) this.addFire(p, 0.4);
      }
    }
  }

  // ------------------------------------------------------------------ memes
  updateStraws(dt) {
    for (const st of [...this.straws]) {
      if (!st.landed) {
        st.vy -= 22 * dt;
        st.group.position.y += st.vy * dt;
        st.group.rotation.y += dt * 2;
        if (st.group.position.y <= 0) {
          st.group.position.y = 0;
          st.landed = true;
          sfx.thud();
          this.shake = Math.max(this.shake, 0.3);
          this.fx.dust(st.pos, 22, 1.4);
          this.fx.noodles.burst(st.pos.clone().add(V(0, 0.4, 0)), 0xe0bf52, 18, { speed: 4, up: 4, size: 0.05 });
          this.strawMeme(st);
        }
        continue;
      }
      if (st.wet > 0) st.mat.color.setScalar(1 - Math.min(1, st.wet) * 0.45);
      // a fire next to the straw sets it alight right away
      if (!st.P.done && this.fires.some((f) => Math.hypot(f.pos.x - st.pos.x, f.pos.z - st.pos.z) < 1.6 + f.I * 0.4)) this.failProblem(st.P);
    }
  }

  strawMeme(st) {
    const M = C.MEMES.stroh;
    const near = [...this.npcs].filter((n) => n.fall <= 0).sort((a, b) => a.root.position.distanceTo(st.pos) - b.root.position.distanceTo(st.pos));
    const asker = near[0], second = near[1] || near[0];
    this.maskT = 14;
    this.danny.mask.visible = true;
    sfx.whoosh();
    this.say(asker.neck, M.q, 'npc', 3.2);
    this.speak(M.q, { pitch: 1.25, force: true });
    this.later(1.7, () => {
      this.say(second.neck, M.a, 'npc', 3.2);
      this.speak(M.a, { pitch: 0.85, force: true });
      this.memeCard(M.top, M.bottom, '🌾', 'stroh');
    });
    this.later(3.6, () => this.say(this.danny.neck, pick(M.danny), 'danny', 3));
  }

  removeStraw(st, burn) {
    const i = this.straws.indexOf(st);
    if (i < 0) return;
    this.straws.splice(i, 1);
    if (burn) { this.fx.noodles.burst(st.pos.clone().add(V(0, 0.5, 0)), 0xe0bf52, 30, { speed: 6, up: 7, size: 0.05 }); this.fx.sparks(st.pos.clone().add(V(0, 0.5, 0)), 40, 'ember', 6); sfx.ignite(); }
    this.scene.remove(st.group);
  }

  /** classic image macro: picture with Impact text top and bottom */
  memeCard(top, bottom, icon, cls = '') {
    document.querySelectorAll('.dn-meme').forEach((e) => e.remove());
    const el = mount(h(`div.dn-meme.passthrough.${cls}`, {}, [
      h('div.dn-meme-pic', {}, [h('i', {}, icon), h('i.mask', {}, '😷')]),
      h('b.top', {}, top),
      h('b.bottom', {}, bottom)
    ]));
    setTimeout(() => { el.classList.add('out'); setTimeout(() => el.remove(), 500); }, 3600);
  }

  /** the fire brigade ALARM meme: everybody jumps up and screams */
  memeAlarm(stage) {
    const M = C.MEMES.alarm;
    document.querySelectorAll('.dn-meme-alarm').forEach((e) => e.remove());
    const el = mount(h('div.dn-meme-alarm.passthrough', {}, [h('b', {}, M.big), h('span', {}, `ALARMSTUFE ${stage + 1}: ${M.subs[stage % M.subs.length]}`)]));
    setTimeout(() => el.remove(), 1900);
    sfx.siren(1);
    sfx.alarm();
    this.shake = Math.max(this.shake, 0.5);
    this.speak('Alaaarm!', { pitch: 1.3, rate: 0.9, force: true });
    const people = this.npcs.filter((n) => n.fall <= 0);
    people.forEach((n) => { n.react = { type: 'alarm', t: -Math.random() * 0.25 }; });
    for (const n of people.sort(() => Math.random() - 0.5).slice(0, 3)) this.say(n.neck, pick(M.shouts), 'shout', 1.8);
    this.say(this.danny.neck, 'ALAAARM! Danny übernimmt!', 'danny', 2);
  }

  knockDown(npc) {
    if (npc.fall > 0) return;
    npc.fall = 2.2;
    npc.react = null;
    sfx.scream(npc.role === 'kunde' ? 0.8 : rand(0.9, 1.3));
  }

  // ------------------------------------------------------------------ Danny update + tools
  updateDanny(dt, time) {
    const d = this.danny;
    const pos = d.root.position;
    const k = this.keys;
    const dir = V((k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0), 0, (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0));
    let mag = dir.lengthSq() > 0 ? 1 : 0;
    if (this.stick && (this.stick.dx || this.stick.dy)) { dir.set(this.stick.dx, 0, this.stick.dy); mag = Math.min(1, dir.length() * 1.3); }
    if (this.state !== 'play') mag = 0;
    const speed = (this.coffee > 0 ? 8 : 5.4) * mag;
    let moving = false;
    if (mag > 0.05) {
      dir.normalize();
      pos.addScaledVector(dir, speed * dt);
      moving = true;
    }
    const using = (this.firing || this.keyFire) && this.state === 'play';
    // facing: towards the aim point (mouse / held touch), else movement direction
    let face = null;
    const mouseAim = !this.coarse && this.aimActive;
    if ((mouseAim || using) && this.aimActive) face = Math.atan2(this.aim.x - pos.x, this.aim.z - pos.z);
    else if (moving) face = Math.atan2(dir.x, dir.z);
    if (this.assistYaw != null && this.assistT > 0) face = this.assistYaw;
    this.assistT = Math.max(0, (this.assistT || 0) - dt);
    if (face != null) {
      let diff = face - d.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      d.root.rotation.y += diff * clamp(dt * 16, 0, 1);
    }
    // collisions
    this.collide(pos, 0.42);
    // walk animation
    d.phase = (d.phase || 0) + (moving ? dt * (this.coffee > 0 ? 15 : 11) : 0);
    d.speedK = lerp(d.speedK || 0, moving ? 1 : 0, clamp(dt * 10, 0, 1));
    const sw = Math.sin(d.phase) * 0.7 * d.speedK;
    d.legs[0].rotation.x = sw;
    d.legs[1].rotation.x = -sw;
    d.body.position.y = Math.abs(Math.cos(d.phase)) * 0.07 * d.speedK;
    if (moving && Math.sin(d.phase) * Math.sin(d.phase - dt * 11) < 0) sfx.step();
    this.poseArms(dt, time, using);
    // tools
    this.toolCd = Math.max(0, this.toolCd - dt);
    if (this.tool === 'foam') this.updateFoam(dt, time, using);
    else { this.sprayLoop?.set(0); this.pressure = Math.min(100, this.pressure + dt * 7); }
    if (using && this.toolCd <= 0) {
      if (this.tool === 'defi') this.useDefi();
      else if (this.tool === 'hammer') this.useHammer();
      else if (this.tool === 'duck') this.useDuck();
    }
    if (this.act) {
      this.act.t += dt;
      if (this.act.type === 'hammer' && !this.act.hit && this.act.t > 0.14) { this.act.hit = true; this.hammerImpact(); }
      if (this.act.t > this.act.dur) this.act = null;
    }
    // hydrant refill
    const hy = this.office.hydrant.pos;
    const near = Math.hypot(pos.x - hy.x, pos.z - hy.z) < 1.5;
    this.office.hydrant.group.userData.ring.material.opacity = 0.45 + Math.sin(time * 5) * 0.2 + (near ? 0.3 : 0);
    if (near && this.pressure < 100) {
      this.pressure = Math.min(100, this.pressure + dt * 70);
      if (Math.random() < dt * 20) this.fx.splash(hy.clone().add(V(0, 0.8, 0)), 2);
      if (!this.refillMsg) { this.refillMsg = true; this.popup(hy.clone().add(V(0, 2.2, 0)), '💧 Nachfüllen', 'good'); }
    } else this.refillMsg = false;
    this.turbo = Math.max(0, this.turbo - dt);
    this.coffee = Math.max(0, this.coffee - dt);
    this.burnCd = Math.max(0, this.burnCd - dt);
    this.emptyCd = Math.max(0, this.emptyCd - dt);
    // reticle
    this.reticle.visible = this.aimActive && this.state === 'play';
    if (this.reticle.visible) {
      this.reticle.position.set(this.aim.x, 0.04, this.aim.z);
      this.reticle.scale.setScalar(1 + Math.sin(time * 8) * 0.08);
    }
    this.office.doorLight.intensity = Math.max(0, this.office.doorLight.intensity - dt * 12) * (0.6 + 0.4 * Math.abs(Math.sin(time * 9)));
  }

  collide(pos, r) {
    pos.x = clamp(pos.x, -AW + r, AW - r);
    pos.z = clamp(pos.z, -AD + r, AD - r);
    for (const b of this.office.aabbs) {
      const cx = clamp(pos.x, b.minX, b.maxX), cz = clamp(pos.z, b.minZ, b.maxZ);
      const dx = pos.x - cx, dz = pos.z - cz;
      const dd = dx * dx + dz * dz;
      if (dd < r * r) {
        if (dd < 1e-6) { pos.z = b.maxZ + r; continue; }
        const d = Math.sqrt(dd);
        pos.x = cx + (dx / d) * r; pos.z = cz + (dz / d) * r;
      }
    }
    for (const n of this.npcs) {
      const np = n.root.position;
      const dx = pos.x - np.x, dz = pos.z - np.z;
      const d = Math.hypot(dx, dz), min = r + 0.3;
      if (d < min && d > 1e-4) { pos.x = np.x + (dx / d) * min; pos.z = np.z + (dz / d) * min; }
    }
    for (const s of [...this.saps, ...this.straws]) {
      if (!s.landed) continue;
      const dx = pos.x - s.pos.x, dz = pos.z - s.pos.z;
      const d = Math.hypot(dx, dz), min = r + 0.85;
      if (d < min && d > 1e-4) { pos.x = s.pos.x + (dx / d) * min; pos.z = s.pos.z + (dz / d) * min; }
    }
  }

  poseArms(dt, time, using) {
    const d = this.danny;
    const [L, R] = d.arms;
    const a = this.act;
    const sm = (o, x, z = 0) => { o.rotation.x = lerp(o.rotation.x, x, clamp(dt * 18, 0, 1)); o.rotation.z = lerp(o.rotation.z, z, clamp(dt * 18, 0, 1)); };
    const walk = Math.sin(d.phase || 0) * 0.4 * (d.speedK || 0);
    if (this.tool === 'foam') {
      const shake = using && (this.pressure > 0 || this.turbo > 0) ? Math.sin(time * 60) * 0.03 : 0;
      sm(L, -0.75 + shake, 0.35); sm(R, -0.85 + shake, -0.28);
      d.ext.userData.lever.rotation.z = using ? 0.12 : 0;
      d.tools.foam.position.y = 0.42 + shake * 0.4;
    } else if (this.tool === 'defi') {
      if (a?.type === 'defi') { const k = Math.sin(Math.min(1, a.t / a.dur) * Math.PI); sm(L, -1.2 - k * 0.5, 0.15); sm(R, -1.2 - k * 0.5, -0.15); }
      else { sm(L, -1.05 + walk * 0.3, 0.25); sm(R, -1.05 - walk * 0.3, -0.25); }
      const glow = Math.max(0, (a?.type === 'defi' ? 1 - a.t / a.dur : 0)) + (this.toolCd <= 0 ? 0.25 + Math.sin(time * 10) * 0.15 : 0);
      d.tools.defi.forEach((p) => (p.userData.glow.material.opacity = clamp(glow, 0, 1)));
    } else if (this.tool === 'hammer') {
      L.rotation.x = lerp(L.rotation.x, -0.4 + walk, clamp(dt * 12, 0, 1));
      L.rotation.z = lerp(L.rotation.z, 0.15, clamp(dt * 12, 0, 1));
      if (a?.type === 'hammer') {
        const t = a.t;
        R.rotation.x = t < 0.14 ? lerp(-3.0, -0.9, t / 0.14) : lerp(-0.9, -2.4, Math.min(1, (t - 0.14) / 0.3));
        R.rotation.z = -0.1;
      } else sm(R, -2.4 + walk * 0.2, -0.1);
      d.tools.hammer.rotation.x = Math.PI;
    } else if (this.tool === 'duck') {
      sm(L, -0.3 + walk, 0.1);
      if (a?.type === 'duck') { const t = a.t / a.dur; R.rotation.x = t < 0.35 ? lerp(-0.6, -2.8, t / 0.35) : lerp(-2.8, -1.1, Math.min(1, (t - 0.35) / 0.3)); }
      else sm(R, -0.6 - walk, -0.1);
      d.tools.duck.visible = this.ammo > 0 && !(a?.type === 'duck' && a.t > a.dur * 0.45);
    }
  }

  nozzleWorld() { const p = V(); this.danny.ext.userData.nozzle.getWorldPosition(p); return p; }
  forward() { const y = this.danny.root.rotation.y; return V(Math.sin(y), 0, Math.cos(y)); }

  updateFoam(dt, time, using) {
    const turbo = this.turbo > 0;
    const active = using && (turbo || this.pressure > 0);
    if (using && !turbo) {
      this.pressure = Math.max(0, this.pressure - dt * 15);
      if (this.pressure <= 0 && this.emptyCd <= 0) {
        this.emptyCd = 3;
        this.popup(this.danny.root.position.clone().add(V(0, 2.4, 0)), 'Druck leer! Ab zum Hydranten 💧', 'bad');
        this.say(this.danny.neck, pick(['Mir ist der Saft ausgegangen. Passiert den Besten.', 'Leer! Wie das Hirn vom Berater.', 'Kein Druck mehr. Ich bin auch nur ein Mensch.']), 'danny', 2.6);
      }
    } else if (!using) this.pressure = Math.min(100, this.pressure + dt * 7);
    this.sprayLoop?.set(active ? (turbo ? 1 : 0.85) : 0, turbo ? 0.9 : 0.5);
    if (!active) return;
    const from = this.nozzleWorld();
    const fwd = this.forward();
    const range = FOAM_RANGE * (turbo ? 1.7 : 1);
    // aim slightly downward towards the target distance
    let dist = range;
    if (this.aimActive) dist = clamp(Math.hypot(this.aim.x - from.x, this.aim.z - from.z), 1.5, range);
    const dir = fwd.clone();
    dir.y = 0.16 - (1 - dist / range) * 0.5;
    dir.normalize();
    this.foamAcc = (this.foamAcc || 0) + (turbo ? 160 : 95) * this.quality * dt;
    while (this.foamAcc > 1) { this.foamAcc--; this.fx.foam(from, dir, (turbo ? 13 : 9.5) * (0.55 + 0.45 * dist / range), turbo ? 0.16 : 0.11, turbo ? 1.25 : 1); }
    // recoil
    this.danny.root.position.addScaledVector(fwd, -dt * (turbo ? 1.2 : 0.45));
    // cone hits
    const half = turbo ? 0.42 : 0.32;
    const hits = (p, r) => {
      const dx = p.x - from.x, dz = p.z - from.z;
      const d = Math.hypot(dx, dz);
      if (d > range + r) return 0;
      let ang = Math.atan2(dx, dz) - this.danny.root.rotation.y;
      ang = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
      if (ang > half + Math.atan2(r, Math.max(0.3, d))) return 0;
      return 1 - 0.45 * (d / range);
    };
    for (const f of [...this.fires]) {
      const k = hits(f.pos, this.fireRadius(f));
      if (!k) continue;
      f.I -= dt * k * (turbo ? 1.9 : 0.95);
      if (Math.random() < dt * 14) this.fx.steam(f.pos, 1);
      if (f.I <= 0) this.extinguish(f);
    }
    for (const npc of this.npcs) {
      const p = npc.root.position;
      const k = hits(p, 0.45);
      if (!k) continue;
      npc.wet = Math.min(1, npc.wet + dt * 2.2);
      npc.soot = Math.max(0, npc.soot - dt * 0.8);
      npc.panic = 0;
      if (npc.showerCd <= 0) {
        npc.showerCd = 3.2;
        npc.react = { type: 'wet', t: 0 };
        this.stats.showers++;
        sfx.splash();
        const head = this.npcHead(npc);
        this.fx.splash(head, 12);
        if (npc.role === 'kunde') {
          this.stats.kunde++;
          this.addScore(150, head.clone().add(V(0, 0.5, 0)), '💦 Kundendusche', false);
          this.escalation = Math.min(100, this.escalation + 4);
          this.feed('Kunde geduscht. Er nennt es „Change Request“. Wir nennen es Umsatz.', 'warn');
        } else this.addScore(40, head.clone().add(V(0, 0.5, 0)), '💦 Abreibung', false);
        this.say(npc.neck, pick(C.SHOWER[npc.role] || C.SHOWER.berater), 'wet', 2.6);
        if (Math.random() < 0.35) sfx.scream(npc.role === 'kunde' ? 0.75 : rand(0.95, 1.35));
        if (npc.problem && (npc.problem.type === 'faul' || npc.problem.type === 'vergessen')) this.popup(head.clone().add(V(0, 1, 0)), 'Nass, aber immer noch hirntot → ⚡', 'bad');
      }
      // standing people slip on the foam
      if (npc.standK > 0.7 && npc.wet > 0.9 && npc.fall <= 0 && Math.random() < dt * 1.5) { this.knockDown(npc); this.popup(this.npcHead(npc).add(V(0, 0.6, 0)), 'AUSGERUTSCHT!', 'combo'); }
    }
    for (const m of [...this.monsters]) {
      const k = hits(m.pos, 0.8);
      if (!k) continue;
      m.foamHp -= dt * k * 0.6;
      m.hurt = 0.1;
      if (m.foamHp <= 0) this.killMonster(m, 'foam');
    }
    for (const st of [...this.straws]) {
      if (!st.landed || st.P.done) continue;
      const k = hits(st.pos, 0.8);
      if (!k) continue;
      st.wet += dt * k * 0.8;
      if (Math.random() < dt * 10) this.fx.splash(st.pos.clone().add(V(0, 0.8, 0)), 3);
      if (st.wet >= 1) {
        this.solveProblem(st.P, st.pos.clone().add(V(0, 1.6, 0)), 'foam');
        const ref = st;
        this.later(2.5, () => this.removeStraw(ref, false));
      }
    }
    for (const s of this.saps) {
      if (!s.landed) continue;
      if (hits(s.pos, 0.9) && (this.sapMsgT || 0) < this.elapsed - 4) { this.sapMsgT = this.elapsed; this.popup(s.pos.clone().add(V(0, 2.6, 0)), 'SAP ist wasserdicht. Und beratungsresistent. → 🔨', 'bad'); }
    }
  }

  /** best target in front of Danny for melee tools */
  meleeTarget(kinds, reach = REACH) {
    const pos = this.danny.root.position;
    let yaw = this.danny.root.rotation.y;
    if (this.aimActive && (this.firing || !this.coarse)) yaw = Math.atan2(this.aim.x - pos.x, this.aim.z - pos.z);
    const cand = [];
    const add = (kind, obj, p, r, prio) => {
      const dx = p.x - pos.x, dz = p.z - pos.z;
      const d = Math.hypot(dx, dz) - r;
      if (d > reach) return;
      let ang = Math.atan2(dx, dz) - yaw;
      ang = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
      if (ang > 1.25 && d > 0.4) return;
      cand.push({ kind, obj, p, score: d + ang * 1.1 - prio, yaw: Math.atan2(dx, dz) });
    };
    if (kinds.includes('npc')) for (const n of this.npcs) {
      const relevant = n.problem && n.problem.def.tool === this.tool && n.problem.type !== 'code';
      add('npc', n, n.root.position, 0.25, relevant ? 1.5 : 0);
    }
    if (kinds.includes('fire')) for (const f of this.fires) add('fire', f, f.pos, this.fireRadius(f) * 0.6, 0);
    if (kinds.includes('monster')) for (const m of this.monsters) add('monster', m, m.pos, 0.6, 1.6);
    if (kinds.includes('sap')) for (const s of this.saps) if (s.landed) add('sap', s, s.pos, 0.8, 1.8);
    cand.sort((a, b) => a.score - b.score);
    const best = cand[0] || null;
    if (best) { this.assistYaw = best.yaw; this.assistT = 0.25; this.danny.root.rotation.y = best.yaw; }
    return best;
  }

  useDefi() {
    this.toolCd = 0.75;
    this.act = { type: 'defi', t: 0, dur: 0.35 };
    this.stats.zaps++;
    sfx.defi();
    const tgt = this.meleeTarget(['npc', 'fire']);
    const paddles = this.danny.tools.defi.map((p) => { const v = V(); p.getWorldPosition(v); return v; });
    this.later(0.16, () => {
      if (this.state !== 'play') return;
      if (!tgt) {
        const p = this.danny.root.position.clone().addScaledVector(this.forward(), 1.2).setY(1.2);
        this.fx.sparks(p, 16, 'zap', 4);
        paddles.forEach((a) => this.fx.arc(a, p, 0.15));
        return;
      }
      if (tgt.kind === 'fire') {
        const f = tgt.obj;
        f.I = Math.min(1.6, f.I + 0.4);
        this.fx.boom(f.pos, 0xffaa44, 1);
        this.fx.sparks(f.pos.clone().add(V(0, 0.6, 0)), 40, 'spark', 8);
        this.fx.ring(f.pos, 0xff8844, 3, 0.4);
        sfx.boom(0.6);
        this.shake = 0.5;
        const dp = this.danny.root.position;
        dp.add(V(dp.x - f.pos.x, 0, dp.z - f.pos.z).normalize().multiplyScalar(1.4));
        this.addScore(-50, f.pos.clone().add(V(0, 1.8, 0)), '⚡+🔥 Brandbeschleuniger!', false);
        this.say(this.danny.neck, 'Strom und Feuer. Hätte man wissen können.', 'danny', 2.4);
        return;
      }
      const npc = tgt.obj;
      const head = this.npcHead(npc);
      paddles.forEach((a) => { this.fx.arc(a, head, 0.3); this.fx.arc(a, this.npcChest(npc), 0.25); });
      this.fx.sparks(head, 36, 'zap', 6);
      this.fx.boom(head, 0x88bbff, 0.7);
      this.hitStop = 0.05;
      this.shake = Math.max(this.shake, 0.2);
      npc.react = { type: 'zap', t: 0 };
      npc.soot = Math.min(1, npc.soot + 0.65);
      if (npc.problem && (npc.problem.type === 'faul' || npc.problem.type === 'vergessen')) this.solveProblem(npc.problem, head.add(V(0, 0.5, 0)), 'defi');
      else {
        if (npc.hitCd <= 0) { npc.hitCd = 2.5; this.addScore(30, head.clone().add(V(0, 0.5, 0)), '⚡ Abreibung', false); }
        this.say(npc.neck, pick(C.ZAPPED), 'npc', 2.6);
        sfx.scream(rand(0.9, 1.4));
      }
    });
  }

  useHammer() {
    this.toolCd = 0.55;
    this.act = { type: 'hammer', t: 0, dur: 0.45, hit: false };
    sfx.whoosh();
    this.meleeTarget(['sap', 'monster', 'npc', 'fire']);
  }

  hammerImpact() {
    const tgt = this.meleeTarget(['sap', 'monster', 'npc', 'fire']);
    const pos = this.danny.root.position;
    const front = pos.clone().addScaledVector(this.forward(), 1.4);
    this.stats.bonks++;
    if (!tgt) {
      sfx.thud();
      this.fx.dust(front, 10, 0.6);
      this.fx.sparks(front.clone().setY(0.1), 10, 'spark', 3);
      this.shake = Math.max(this.shake, 0.12);
      return;
    }
    this.hitStop = 0.06;
    this.shake = Math.max(this.shake, 0.4);
    if (tgt.kind === 'sap') {
      const s = tgt.obj;
      s.hp--;
      sfx.clang(0.9 + s.hp * 0.1);
      const slab = s.slabs[s.hp];
      const p = s.pos.clone().add(V(0, slab ? slab.position.y : 0.5, 0));
      this.fx.stones.burst(p, 0x6e737b, 14, { speed: 7, up: 6, size: 0.2 });
      this.fx.sparks(p, 30, 'spark', 8);
      this.fx.dust(s.pos, 18, 1.2);
      if (slab) slab.visible = false;
      if (s.hp <= 0) {
        this.scene.remove(s.group);
        this.saps.splice(this.saps.indexOf(s), 1);
        this.fx.ring(s.pos, 0xffffff, 5, 0.5);
        this.fx.boom(s.pos, 0xffffff, 1);
        sfx.smash(0.8);
        this.shake = 0.8;
        this.solveProblem(s.P, s.pos.clone().add(V(0, 2.2, 0)), 'hammer');
      } else this.popup(p.clone().add(V(0, 1.2, 0)), `KRACH! noch ${s.hp}`, 'combo');
    } else if (tgt.kind === 'monster') {
      const m = tgt.obj;
      m.hp--;
      m.hurt = 0.3;
      sfx.splat();
      sfx.thud();
      this.fx.sauceBurst(m.pos.clone().add(V(0, 0.8, 0)), 16);
      this.fx.noodles.burst(m.pos.clone().add(V(0, 0.5, 0)), 0xf0cf72, 8, { speed: 5, up: 5, size: 0.12 });
      if (m.hp <= 0) this.killMonster(m, 'hammer');
      else this.say(m.group, pick(['Aua! Mein Callback!', 'Du kannst mich nicht refactoren!', 'Ich hab Abhängigkeiten! Überall!']), 'monster', 1.8);
    } else if (tgt.kind === 'npc') {
      const npc = tgt.obj;
      sfx.bonk();
      npc.react = { type: 'bonk', t: 0 };
      this.fx.sparks(this.npcHead(npc), 12, 'spark', 3);
      if (npc.hitCd <= 0) { npc.hitCd = 2.5; this.addScore(30, this.npcHead(npc).add(V(0, 0.5, 0)), '🔨 Hard Reset', false); }
      this.say(npc.neck, pick(C.BONKED), 'npc', 2.4);
    } else if (tgt.kind === 'fire') {
      const f = tgt.obj;
      sfx.thud();
      f.I -= 0.2;
      this.fx.sparks(f.pos, 30, 'ember', 6);
      if (f.I <= 0) this.extinguish(f);
    }
  }

  killMonster(m, tool) {
    const i = this.monsters.indexOf(m);
    if (i < 0) return;
    this.monsters.splice(i, 1);
    this.scene.remove(m.group);
    this.fx.noodles.burst(m.pos.clone().add(V(0, 0.6, 0)), 0xf0cf72, 26, { speed: 7, up: 7, size: 0.14 });
    this.fx.sauceBurst(m.pos.clone().add(V(0, 0.8, 0)), 30);
    this.fx.ring(m.pos, 0xff4422, 3, 0.4);
    sfx.splat(); sfx.smash(1.2);
    this.shake = Math.max(this.shake, 0.5);
    this.solveProblem(m.P, m.pos.clone().add(V(0, 1.8, 0)), tool);
  }

  useDuck() {
    if (this.ammo <= 0) {
      this.toolCd = 0.6;
      this.popup(this.danny.root.position.clone().add(V(0, 2.4, 0)), 'Keine Enten mehr! 🧰', 'bad');
      return;
    }
    this.toolCd = 0.45;
    this.act = { type: 'duck', t: 0, dur: 0.4 };
    const pos = this.danny.root.position;
    // aim assist: the nearest asking colleague close to the aim direction
    let yaw = this.danny.root.rotation.y;
    if (this.aimActive) yaw = Math.atan2(this.aim.x - pos.x, this.aim.z - pos.z);
    let target = this.aimActive ? this.aim.clone() : pos.clone().addScaledVector(this.forward(), 6);
    let best = null, bestS = 1e9;
    for (const n of this.npcs) {
      const p = n.root.position;
      const dx = p.x - pos.x, dz = p.z - pos.z, d = Math.hypot(dx, dz);
      if (d > 12) continue;
      let ang = Math.atan2(dx, dz) - yaw;
      ang = Math.abs(Math.atan2(Math.sin(ang), Math.cos(ang)));
      const relevant = n.problem?.type === 'frage';
      if (ang > (relevant ? 0.6 : 0.25)) continue;
      const s = ang * 6 + d * 0.1 - (relevant ? 3 : 0);
      if (s < bestS) { bestS = s; best = n; }
    }
    if (best) { target = this.npcHead(best).add(V(0, -0.15, 0)); yaw = Math.atan2(target.x - pos.x, target.z - pos.z); this.danny.root.rotation.y = yaw; this.assistYaw = yaw; this.assistT = 0.3; }
    this.later(0.14, () => {
      if (this.state !== 'play') return;
      const from = V();
      this.danny.hands[1].getWorldPosition(from);
      const T = clamp(from.distanceTo(target) / 14, 0.25, 0.8);
      const vel = V((target.x - from.x) / T, (target.y - from.y) / T + 0.5 * 18 * T, (target.z - from.z) / T);
      const mesh = this.duckGeo.clone();
      mesh.scale.setScalar(0.8);
      mesh.position.copy(from);
      this.scene.add(mesh);
      this.ducks.push({ mesh, vel, t: 0, bounces: 0, hit: false, spin: rand(8, 14) });
      this.ammo--;
      this.stats.ducks++;
      sfx.quack(1.2);
      if (this.ammo <= 0) this.danny.tools.duck.visible = false;
    });
  }

  updateDucks(dt) {
    for (const d of [...this.ducks]) {
      d.t += dt;
      d.vel.y -= 18 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.spin * dt;
      d.mesh.rotation.y += d.spin * 0.6 * dt;
      if (!d.hit) {
        for (const n of this.npcs) {
          const head = this.npcHead(n);
          if (head.distanceTo(d.mesh.position) < 0.55 || this.npcChest(n).distanceTo(d.mesh.position) < 0.45) {
            d.hit = true;
            d.vel.set(-d.vel.x * 0.2, 4, -d.vel.z * 0.2);
            sfx.quack(0.9);
            sfx.bonk();
            this.fx.sparks(head, 10, 'spark', 3);
            n.react = { type: 'bonk', t: 0 };
            if (n.problem?.type === 'frage') this.solveProblem(n.problem, head.add(V(0, 0.5, 0)), 'duck');
            else { this.say(n.neck, pick(C.DUCKED), 'npc', 2.4); if (n.hitCd <= 0) { n.hitCd = 2; this.addScore(20, head.add(V(0, 0.5, 0)), '🦆 Quak', false); } }
            break;
          }
        }
      }
      if (d.mesh.position.y < 0.05 && d.vel.y < 0) {
        d.mesh.position.y = 0.05;
        d.vel.y *= -0.45; d.vel.x *= 0.6; d.vel.z *= 0.6;
        d.bounces++;
        if (d.bounces === 1) sfx.quack(1.5);
      }
      if (d.t > 2.6) { this.scene.remove(d.mesh); this.ducks.splice(this.ducks.indexOf(d), 1); }
    }
  }

  // ------------------------------------------------------------------ pickups
  updatePickups(dt, time) {
    this.pickupT -= dt;
    if (this.pickupT <= 0 && this.pickups.length < 2) {
      this.pickupT = rand(15, 22);
      const p = this.freeSpot(3);
      if (p) {
        const w = { schlauch: 3, kaffee: 2, enten: this.ammo < 3 ? 5 : 2, sprinkler: this.fires.length > 4 ? 3 : 1 };
        let r = Math.random() * Object.values(w).reduce((a, b) => a + b, 0), type = 'schlauch';
        for (const [k, v] of Object.entries(w)) { r -= v; if (r <= 0) { type = k; break; } }
        const def = C.PICKUPS[type];
        const g = buildToolbox(def.icon);
        g.position.copy(p);
        this.scene.add(g);
        this.pickups.push({ group: g, type, pos: p, t: 0 });
        this.feed(`🧰 Werkzeugkoffer aufgetaucht: ${def.icon} ${def.label}`, 'tip');
        sfx.pop();
      }
    }
    const dp = this.danny.root.position;
    for (const pk of [...this.pickups]) {
      pk.t += dt;
      pk.group.position.y = Math.abs(Math.sin(time * 3)) * 0.15;
      pk.group.rotation.y += dt * 1.5;
      if (Math.hypot(dp.x - pk.pos.x, dp.z - pk.pos.z) < 1.0) {
        this.scene.remove(pk.group);
        this.pickups.splice(this.pickups.indexOf(pk), 1);
        this.collect(pk.type, pk.pos);
      } else if (pk.t > 20) { this.scene.remove(pk.group); this.pickups.splice(this.pickups.indexOf(pk), 1); }
    }
  }

  collect(type, pos) {
    const def = C.PICKUPS[type];
    sfx.powerup();
    this.fx.sparks(pos.clone().add(V(0, 0.6, 0)), 30, 'spark', 5);
    this.popup(pos.clone().add(V(0, 1.8, 0)), `${def.icon} ${def.label}`, 'combo');
    this.say(this.danny.neck, C.PICKUP_LINES[type], 'danny', 2.8);
    this.feed(`${def.icon} ${def.label}: ${def.desc}`, 'good');
    if (type === 'schlauch') { this.turbo = def.time; this.setTool('foam'); }
    if (type === 'kaffee') this.coffee = def.time;
    if (type === 'enten') { this.ammo += 6; if (this.tool === 'duck') this.danny.tools.duck.visible = true; }
    if (type === 'sprinkler') { this.sprinkler = 2.6; sfx.alarm(); this.speak('Sprinkler an!', { force: true }); }
  }

  updateSprinkler(dt) {
    if (this.sprinkler <= 0) return;
    this.sprinkler -= dt;
    const n = Math.round(260 * this.quality * dt);
    const c = this.danny.root.position;
    for (let i = 0; i < n; i++) this.fx.norm.emit(c.x + rand(-13, 13), 5, c.z + rand(-9, 9), 0, -rand(8, 12), 0, { life: 0.6, s0: 0.12, s1: 0.2, kind: 'water' });
    for (const f of [...this.fires]) { f.I -= dt * 1.4; if (f.I <= 0) this.extinguish(f); }
    for (const npc of this.npcs) npc.wet = Math.min(1, npc.wet + dt);
    for (const m of [...this.monsters]) { m.foamHp -= dt * 0.8; if (m.foamHp <= 0) this.killMonster(m, 'foam'); }
  }

  // ------------------------------------------------------------------ colleagues
  updateNPCs(dt, time) {
    for (const n of this.npcs) {
      n.ph += dt;
      n.showerCd = Math.max(0, n.showerCd - dt);
      n.hitCd = Math.max(0, n.hitCd - dt);
      n.wet = Math.max(0, n.wet - dt * 0.12);
      n.soot = Math.max(0, n.soot - dt * 0.05);
      n.panic = Math.max(0, n.panic - dt * 0.6);
      if (n.react) { n.react.t += dt; if (n.react.t > 1.1) n.react = null; }
      const r = n.react;
      const alarmed = n.react?.type === 'alarm' && n.react.t > 0;
      const stand = n.seat ? ((n.state === 'shout' || n.panic > 0.4 || n.fall > 0 || alarmed) ? 1 : 0) : 1;
      n.standK = lerp(n.standK, stand, clamp(dt * 6, 0, 1));
      const b = n.body;
      // base position: seat, pulled out into the aisle when standing
      if (n.seat) {
        n.root.position.copy(n.seat.pos);
        n.root.position.z += n.seat.aisle * 0.5 * n.standK;
      } else this.walkWanderer(n, dt);
      b.position.set(0, lerp(-0.34, 0, n.standK), 0);
      b.rotation.set(0, 0, 0);
      b.scale.set(1, 1, 1);
      const legX = lerp(-1.45, 0, n.standK);
      let walkSw = n.walking ? Math.sin(n.ph * 9) * 0.6 : 0;
      n.legs[0].rotation.x = legX + walkSw;
      n.legs[1].rotation.x = legX - walkSw;
      let aL = -1.05 + Math.sin(time * 13 + n.ph) * 0.07, aR = -1.05 + Math.sin(time * 11 + n.ph * 2) * 0.07, zL = 0.1, zR = -0.1;
      if (n.standK > 0.5) { aL = n.walking ? -walkSw * 0.6 : 0.05; aR = n.walking ? walkSw * 0.6 : 0.05; }
      let neckX = 0, neckZ = 0;
      if (n.state === 'sleep') {
        b.rotation.x = 0.35; neckX = 0.85; aL = -1.35; aR = -1.35;
        if (Math.random() < dt * 1.6) this.fx.zzz(this.npcHead(n).add(V(0.15, 0.3, 0)));
      } else if (n.state === 'confused') {
        neckZ = Math.sin(time * 3 + n.ph) * 0.35;
        aR = -2.7 + Math.sin(time * 14) * 0.15; zR = -0.5;
      } else if (n.state === 'shout') {
        aL = -2.8 + Math.sin(time * 14) * 0.4; aR = -2.8 + Math.sin(time * 14 + 1.5) * 0.4; zL = 0.35; zR = -0.35;
        b.position.y += Math.abs(Math.sin(time * 9)) * 0.12;
        neckX = -0.25;
      } else if (n.state === 'despair') {
        aL = -2.5; aR = -2.5; zL = 0.7; zR = -0.7; neckX = 0.4;
        b.rotation.z = Math.sin(time * 6) * 0.05;
      }
      if (n.panic > 0.4 && n.state !== 'sleep') {
        aL = -2.4 + Math.sin(time * 20 + n.ph) * 0.6; aR = -2.4 + Math.sin(time * 20 + n.ph + 2) * 0.6; zL = 0.5; zR = -0.5;
        b.position.x = Math.sin(time * 30) * 0.03;
        if (Math.random() < dt * 0.15 && this.state === 'play') this.say(n.neck, pick(['ES BRENNT! DANNYYY!', 'Ich hab die Sicherung extra nicht angefasst!', 'Mein Laptop! Da ist das einzige Backup drauf!', 'Das ist bestimmt dieses Burn-out!', 'Rettet die Kaffeemaschine zuerst!']), 'shout', 2.2);
      }
      if (alarmed) {
        const k = Math.sin(Math.min(1, r.t / 1.1) * Math.PI);
        aL = -3.0 + Math.sin(time * 18) * 0.25; aR = -3.0 + Math.sin(time * 18 + 1) * 0.25; zL = 0.4; zR = -0.4;
        b.position.y += Math.abs(Math.sin(r.t * 9)) * 0.35 * k;
        neckX = -0.35;
      }
      if (r?.type === 'wet') { const k = Math.sin(Math.min(1, r.t / 1.1) * Math.PI); aL = lerp(aL, -2.2, k); aR = lerp(aR, -2.0, k); b.rotation.x = -0.25 * k; }
      if (r?.type === 'zap') {
        const k = 1 - r.t / 1.1;
        b.position.x += (Math.random() - 0.5) * 0.12 * k; b.position.y += Math.random() * 0.12 * k;
        zL = 1.4 * k + zL * (1 - k); zR = -1.4 * k + zR * (1 - k); aL = lerp(aL, 0, k); aR = lerp(aR, 0, k);
        if (n.hair) n.hair.scale.y = 0.9 + 0.9 * k;
      } else if (n.hair) n.hair.scale.y = n.role === 'berater' ? 0.75 : 0.9;
      if (r?.type === 'bonk') { const k = Math.sin(Math.min(1, r.t / 0.6) * Math.PI); b.scale.set(1 + 0.25 * k, 1 - 0.35 * k, 1 + 0.25 * k); }
      if (n.fall > 0) {
        n.fall -= dt;
        const t = 2.2 - n.fall;
        const k = t < 0.3 ? t / 0.3 : n.fall < 0.4 ? n.fall / 0.4 : 1;
        b.rotation.x = -1.45 * k;
        b.position.y = lerp(b.position.y, 0.25, k);
        aL = -3 * k; aR = -3 * k; zL = 0.3; zR = -0.3;
        n.legs[0].rotation.x = lerp(legX, -0.4, k); n.legs[1].rotation.x = lerp(legX, 0.2, k);
      }
      n.arms[0].rotation.x = lerp(n.arms[0].rotation.x, aL, clamp(dt * 12, 0, 1));
      n.arms[1].rotation.x = lerp(n.arms[1].rotation.x, aR, clamp(dt * 12, 0, 1));
      n.arms[0].rotation.z = lerp(n.arms[0].rotation.z, zL, clamp(dt * 12, 0, 1));
      n.arms[1].rotation.z = lerp(n.arms[1].rotation.z, zR, clamp(dt * 12, 0, 1));
      n.neck.rotation.x = lerp(n.neck.rotation.x, neckX, clamp(dt * 8, 0, 1));
      n.neck.rotation.z = lerp(n.neck.rotation.z, neckZ, clamp(dt * 8, 0, 1));
      // tint: soot and wetness (only touch the materials when it visibly changes)
      const key = Math.round(n.soot * 20) * 100 + Math.round(n.wet * 20);
      if (key !== n.tintKey) { n.tintKey = key; tintNPC(n, n.soot, n.wet); }
      if (n.wet > 0.3 && Math.random() < dt * 3 * n.wet) this.fx.norm.emit(n.root.position.x + rand(-0.2, 0.2), 1.2, n.root.position.z + rand(-0.2, 0.2), 0, -1, 0, { life: 0.5, s0: 0.06, s1: 0.08, kind: 'water', grav: 10 });
    }
  }

  walkWanderer(n, dt) {
    const w = n.walk;
    const p = n.root.position;
    n.walking = false;
    if (n.fall > 0) return;
    if (w.wait > 0) { w.wait -= dt; return; }
    const d = Math.hypot(w.target.x - p.x, w.target.z - p.z);
    if (d < 0.3) {
      w.wait = rand(0.5, 2.5);
      for (let i = 0; i < 20; i++) {
        const x = rand(-AW + 1.5, AW - 1.5), z = rand(-AD + 1.5, AD - 1.5);
        if (this.validSpot(x, z, 0.7) && x > -6.4) { w.target.set(x, 0, z); break; }
      }
      if (Math.random() < 0.3 && this.state === 'play') this.say(n.neck, pick(['Hat jemand meinen Statusreport gesehen? Er war grün. Gelogen, aber grün.', 'Wir müssen agiler werden! Ich hab ein Post-it gekauft.', 'Kurzes Meeting zum Meeting?', 'Ich hab den Kunden beruhigt. Mit Versprechen.', 'Wer hat das Budget? Ach, verbrannt.']), 'npc', 3);
      return;
    }
    const step = Math.min(d, w.speed * dt * (n.panic > 0.4 ? 2.2 : 1));
    const nx = p.x + ((w.target.x - p.x) / d) * step, nz = p.z + ((w.target.z - p.z) / d) * step;
    if (this.validSpot(nx, nz, 0.25)) { p.x = nx; p.z = nz; } else w.target.copy(p);
    n.root.rotation.y = Math.atan2(w.target.x - p.x, w.target.z - p.z);
    n.walking = true;
  }

  // ------------------------------------------------------------------ DOM anchors
  updateAnchors(dt) {
    const W = window.innerWidth, H = window.innerHeight;
    const v = V();
    for (const P of this.problems) {
      if (!P.marker) continue;
      v.copy(this.problemPos(P)).project(this.camera);
      let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const behind = v.z > 1;
      if (behind) { x = W - x; y = H - y; }
      const m = 34;
      const off = behind || x < m || x > W - m || y < m + 70 || y > H - m - 90;
      const cx = clamp(x, m, W - m), cy = clamp(y, m + 70, H - m - 90);
      P.marker.el.style.transform = `translate(${cx}px, ${cy}px)`;
      P.marker.el.classList.toggle('off', off);
      if (off) P.marker.el.style.setProperty('--ang', `${Math.atan2(y - cy, x - cx)}rad`);
      if (P.limit) {
        const left = 1 - P.t / P.limit;
        P.marker.ring.style.background = `conic-gradient(${left < 0.33 ? '#ff3b2a' : '#ffcc4d'} ${left * 360}deg, rgba(255,255,255,.12) 0)`;
        P.marker.el.classList.toggle('urgent', left < 0.33);
      } else if (P.obj && P.type !== 'brand') {
        const hp = P.type === 'sap' ? P.obj.hp / 3 : P.obj.hp / 2;
        P.marker.ring.style.background = `conic-gradient(#ff7a2a ${hp * 360}deg, rgba(255,255,255,.12) 0)`;
      } else if (P.fire) {
        P.marker.ring.style.background = `conic-gradient(#ff7a2a ${clamp(P.fire.I / 1.6, 0, 1) * 360}deg, rgba(255,255,255,.12) 0)`;
      }
    }
    const top = W < 600 ? 175 : 100;
    const placed = [];
    for (const b of [...this.bubbles]) {
      b.t += dt;
      if (b.t > b.life) { b.el.remove(); this.bubbles.splice(this.bubbles.indexOf(b), 1); continue; }
      b.obj.getWorldPosition(v);
      v.y += b.obj === this.danny.neck ? 0.9 : b.obj.isGroup && !b.obj.parent?.isGroup ? 2.0 : 0.75;
      v.project(this.camera);
      const x = clamp((v.x * 0.5 + 0.5) * W, b.w / 2 + 8, W - b.w / 2 - 8);
      let y = clamp((-v.y * 0.5 + 0.5) * H, top, H - 60);
      // stack bubbles that would overlap (bottom edge is the anchor)
      for (let pass = 0; pass < 3; pass++) {
        for (const o of placed) if (Math.abs(o.x - x) < (o.w + b.w) / 2 + 6 && y > o.y - o.h - 6 && y - b.hgt < o.y + 6) y = o.y - o.h - 8;
      }
      placed.push({ x, y, w: b.w, h: b.hgt });
      b.el.style.transform = `translate(${x}px, ${y}px) translate(-50%, -100%)`;
      b.el.style.opacity = v.z > 1 ? 0 : b.t > b.life - 0.3 ? (b.life - b.t) / 0.3 : 1;
    }
  }

  // ------------------------------------------------------------------ main loop
  update(dt, time) {
    if (this.state === 'menu' || this.state === 'alarm' || this.state === 'safe') { this.updateStage(dt, time); this.fx.update(dt, time); return; }
    if (this.state === 'idle') return;
    if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.12; }
    if (this.state === 'play') {
      this.elapsed += dt;
      this.timeLeft -= dt;
      const st = Math.min(4, Math.floor(this.elapsed / C.STAGE_LEN));
      if (st !== this.stageIdx) {
        this.stageIdx = st;
        this.feed(C.STAGE_LINES[st], 'stage');
        this.memeAlarm(st);
      }
      this.strohT -= dt;
      if (this.strohT <= 0) {
        this.strohT = rand(55, 85);
        if (!this.straws.length) this.spawnProblem('stroh');
      }
      if (this.maskT > 0) { this.maskT -= dt; if (this.maskT <= 0) this.danny.mask.visible = false; }
      this.spawnT -= dt;
      const open = this.problems.length;
      if (this.spawnT <= 0) {
        if (open < STAGE_CAP[this.stageIdx]) this.spawnNext();
        this.spawnT = STAGE_INTERVAL[this.stageIdx] * rand(0.8, 1.2);
      }
      if (this.timeLeft <= 0) { this.timeLeft = 0; this.endGame(true); }
    }
    this.runTimers(dt);
    this.updateDanny(dt, time);
    const total = this.updateFires(dt, time);
    if (this.state === 'play') {
      this.updateProblems(dt);
      this.updatePickups(dt, time);
      this.updateSprinkler(dt);
      const timed = this.problems.filter((p) => p.limit).length;
      const gain = total * 0.6 + timed * 0.15 + this.monsters.length * 0.35 + this.saps.filter((s) => s.landed).length * 0.45;
      this.escalation = clamp(this.escalation + (gain - (this.fires.length === 0 ? 2.5 : 0.5)) * dt, 0, 100);
      if (this.escalation >= 100) { this.feed('💀 Eskalation 100 %. Das Projekt ist abgebrannt.', 'bad'); this.endGame(false); }
      const I = this.escalation > 72 ? 4 : this.stageIdx >= 3 ? 3 : this.stageIdx >= 1 ? 2 : this.fires.length > 2 ? 1 : 0;
      music.setIntensity(I);
    }
    this.updateDucks(dt);
    this.updateNPCs(dt, time);
    for (const led of this.office.leds) if (Math.random() < dt * 3) led.material.color.setRGB(Math.random() < 0.15 ? 2.5 : 0.2, Math.random() < 0.85 ? 2.2 : 0.3, 0.4);
    this.fx.update(dt, time);
    this.updateAnchors(dt);
    this.updateHUD();
    this.updateCamera(dt);
  }

  updateCamera(dt) {
    const p = this.danny.root.position;
    const cx = clamp(p.x, -AW + 5, AW - 5) * (this.portrait ? 0.9 : 0.8);
    const cz = clamp(p.z, -AD + 2, AD - 1);
    const target = this.portrait ? V(cx, 16.5, cz + 8.5) : V(cx, 13, cz + 9.5);
    const look = this.portrait ? V(cx, 0, cz - 0.6) : V(cx, 0, cz - 1.2);
    if (!this.camInit) { this.camera.position.copy(target); this.camInit = true; }
    this.camera.position.lerp(target, clamp(dt * 4, 0, 1));
    this.shake = Math.max(0, this.shake - dt * 1.8);
    if (this.shake > 0) this.camera.position.add(V((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake * 0.6, (Math.random() - 0.5) * this.shake * 0.4));
    this.camera.lookAt(look);
  }

  updateStage(dt, time) {
    const st = this.stage;
    this.menuT += dt;
    // blue lights rotate
    const k = this.state === 'alarm' ? 1 : 0.35;
    const flash = (ph) => Math.max(0, Math.sin(time * 9 + ph)) ** 4;
    st.blueA.intensity = 60 * k * flash(0);
    st.blueB.intensity = 60 * k * flash(Math.PI);
    st.truck.blues.forEach((b, i) => b.material.color.setRGB(0.2, 0.5, 1 + 5 * flash(i * Math.PI)));
    st.station.lamps.forEach((b, i) => b.material.color.setRGB(0.2, 0.5, 1 + 5 * flash(i * Math.PI + 1)));
    const d = this.danny;
    // Danny poses with the extinguisher
    d.body.position.y = Math.sin(time * 2) * 0.01;
    d.legs[0].rotation.x = 0; d.legs[1].rotation.x = 0;
    this.poseArms(dt, time, false);
    d.neck.rotation.y = Math.sin(time * 0.7) * 0.25;
    if (this.state === 'alarm') {
      this.alarmT += dt;
      const door = st.station.door;
      const open = clamp(this.alarmT / 1.1, 0, 1);
      door.scale.y = 1 - open * 0.95;
      door.position.y = st.station.doorH / 2 + st.station.doorH * open * 0.475;
      if (this.alarmT > 0.6) st.truck.group.position.z = -5.6 + (this.alarmT - 0.6) ** 2 * 7;
      d.root.rotation.y = lerp(d.root.rotation.y, Math.PI * 0.75, clamp(dt * 4, 0, 1));
      if (this.alarmT > 0.5) { d.root.position.x += dt * 6; d.phase = (d.phase || 0) + dt * 14; const sw = Math.sin(d.phase) * 0.7; d.legs[0].rotation.x = sw; d.legs[1].rotation.x = -sw; }
      if (this.alarmT > 2.0) {
        document.querySelectorAll('.dn-strobe, .dn-alarm').forEach((e) => e.remove());
        st.truck.group.position.z = -5.6;
        this.beginShift();
        return;
      }
    }
    // camera: slow orbit in front of the station
    const a = Math.sin(this.menuT * 0.25) * 0.35 + (this.portrait ? 0 : 0.25);
    const r = this.portrait ? 19 : 15;
    const shakeK = this.state === 'alarm' ? 0.12 : 0;
    this.camera.position.set(STAGE.x + Math.sin(a) * r + (Math.random() - 0.5) * shakeK, 3.2 + (this.portrait ? 2 : 0), STAGE.z + 6 + Math.cos(a) * r * 0.6);
    this.camera.lookAt(STAGE.x + (this.portrait ? 1.5 : this.wideMenu && this.state === 'menu' ? -4.5 : 1.2), 3.4, STAGE.z);
  }
}
