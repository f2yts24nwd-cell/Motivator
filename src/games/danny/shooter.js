import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { rand, clamp, lerp } from '../../core/gfx.js';
import { sfx, music, unlockAudio, createNoiseLoop, playVoice, preloadVoices, stopVoice } from '../../core/audio.js';
import { h, mount, clearUI, storeSet } from '../../core/ui.js';
import { DannyGame } from './danny.js';
import { buildExtinguisher, buildSAP, buildSpaghetti, buildStraw, buildLastenheft } from './models.js';
import * as C from './content.js';
import { EMBLEM_SVG } from './emblem.js';
import VO from './voices.json';

// "Frag den Danny!" as a calm first-person shooter: Danny walks through the office on his own,
// stops at every scene of the fire and you aim with the DANNY extinguisher. No timer, no game over.

const V = (x = 0, y = 0, z = 0) => new THREE.Vector3(x, y, z);
const EYE = 1.75;
const RANGE = 9;
const WALK = 2.6;
const VOICE_URL = (id) => `${import.meta.env.BASE_URL}danny/voice/${id}.mp3`;
const RANKS = [
  { ...C.RANKS[0], min: 7000 },
  { ...C.RANKS[1], min: 5200 },
  { ...C.RANKS[2], min: 3500 },
  { ...C.RANKS[3], min: 0, line: 'Das Büro steht noch. Irgendwie. Du hast schön gespritzt.' }
];
const rankFor = (s) => RANKS.find((r) => s >= r.min);
const POINTS = { fire: 150, sleep: 300, straw: 350, monster: 500, page: 90, ball: 40, spot: 250, forgot: 300, shower: 50, kunde: 200 };

class Abort extends Error {}

export class DannyShooter extends DannyGame {
  constructor(app) {
    super(app);
    this.onWheel = () => {};
    this.buildFPS();
  }

  // ------------------------------------------------------------------ first-person view model
  buildFPS() {
    this.scene.add(this.camera);
    this.camera.near = 0.03;
    const vm = new THREE.Group();
    const ext = buildExtinguisher();
    ext.scale.setScalar(0.6);
    ext.rotation.set(0.1, -Math.PI / 2 + 0.95, 0.06);
    ext.position.set(0, -0.47, 0);
    vm.add(ext);
    const navy = new THREE.MeshPhysicalMaterial({ color: 0x1b2640, roughness: 0.75, sheen: 0.4 });
    const glove = new THREE.Mesh(new THREE.SphereGeometry(0.075, 16, 12), new THREE.MeshStandardMaterial({ color: 0x1a1a1a, roughness: 0.8 }));
    glove.scale.set(1.25, 0.8, 1);
    glove.position.set(0.06, -0.04, 0.02);
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 0.7, 14), navy);
    sleeve.rotation.set(1.2, 0, -0.5);
    sleeve.position.set(0.2, -0.2, 0.3);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.083, 0.083, 0.05, 14), new THREE.MeshStandardMaterial({ color: 0xe4ff3a, emissive: 0xc8e020, emissiveIntensity: 0.35 }));
    band.rotation.copy(sleeve.rotation);
    band.position.set(0.15, -0.15, 0.2);
    vm.add(glove, sleeve, band);
    vm.position.set(0.33, -0.3, -0.7);
    vm.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.renderOrder = 6; } });
    vm.visible = false;
    this.camera.add(vm);
    this.vm = { group: vm, ext, nozzle: ext.userData.nozzle, lever: ext.userData.lever, base: vm.position.clone() };
    this.cross = { x: 0.5, y: 0.52 };
    this.aimYaw = 0; this.aimPitch = 0;
    // touch: free look by swiping (crosshair stays in the middle) + a big spray button
    this.lookYaw = 0; this.lookPitch = 0;
    this.drags = new Map();
    this.camPos = V();
    this.yaw = 0; this.pitch = 0;
    this.hitTargets = [];
    this.balls = []; this.pages = [];
    this.rayc = new THREE.Raycaster();
  }

  resize(w, hh) {
    super.resize(w, hh);
    if (this.fps) {
      this.camera.fov = this.portrait ? 78 : 66;
      this.camera.updateProjectionMatrix();
      this.fx.setScale(this.camera, hh * this.app.gfx.renderer.getPixelRatio());
      // the extinguisher sits further in on narrow screens
      if (this.vm) this.vm.base.set(this.portrait ? 0.2 : 0.33, this.portrait ? -0.36 : -0.3, -0.7);
    }
  }

  // ------------------------------------------------------------------ menu
  showMenu() {
    this.fps = false;
    this.run = {};
    stopVoice();
    if (this.vm) this.vm.group.visible = false;
    this.danny.root.visible = true;
    super.showMenu();
    this.resize(window.innerWidth, window.innerHeight);
    clearUI();
    this.baseUI();
    const touch = this.coarse;
    mount(h('div.overlay.dn-menu', {}, h('div.card.panel.dn-card', {}, [
      h('div.dn-head', {}, [
        h('div.dn-emblem-wrap', { html: EMBLEM_SVG }),
        h('figure.dn-portrait', {}, [h('img', { src: `${import.meta.env.BASE_URL}danny/danny-3d.webp`, alt: 'Danny' }), h('figcaption', {}, 'Einsatzleiter Danny')])
      ]),
      h('div.kicker', {}, 'Bonusspiel · Ego-Einsatz'),
      h('h1', {}, 'Frag den Danny!'),
      h('p', {}, 'Du bist Danny. Mit dem DANNY-Löscher in der Hand läufst du durchs brennende Kundenprojekt: Eingang, Großraumbüro, Entwickler-Insel, Meetingraum, Serverraum, Kaffeeküche. Danny läuft von selbst, du zielst und löschst in Ruhe. Kein Zeitlimit, kein Game over.'),
      h('div.dn-legend', {}, [
        h('div', {}, [h('b', {}, '🔥 Brände & 📄 Lastenheft-Seiten'), 'Draufhalten, bis sie aus sind.']),
        h('div', {}, [h('b', {}, '💤 Berater denkt nicht'), 'Kalte Dusche ins Gesicht. Hilft immer.']),
        h('div', {}, [h('b', {}, '🍝 Spaghetti-Code'), 'Monster und fliegende Fleischbällchen wegspritzen.']),
        h('div', {}, [h('b', {}, '🗿 Irgendwas mit SAP'), 'Die glühenden Risse des Monolithen löschen.']),
        h('div', {}, [h('b', {}, '🌾 Stroh?'), 'Frag nicht. Mach nass.']),
        h('div', {}, [h('b', {}, '💦 Abreibung'), 'Kollegen und Kunde duschen gibt Bonuspunkte.'])
      ]),
      h('p.dn-controls', {}, touch ? 'Steuerung: Wischen zum Umschauen, das Fadenkreuz bleibt in der Mitte. Den roten Löscher-Knopf unten rechts gedrückt halten zum Spritzen. Eine Zielhilfe zieht dich sanft aufs nächste Ziel.' : 'Steuerung: Maus zielt, linke Maustaste (oder Leertaste) spritzt.'),
      this.best ? h('p', {}, `Dein Rekord: ${this.best.toLocaleString('de-DE')} Punkte`) : null,
      h('div.row', {}, [h('button.btn.dn-go', { onclick: () => { unlockAudio(); sfx.click(); this.startAlarm(); } }, '🚨 Einsatz!')])
    ])));
  }

  // ------------------------------------------------------------------ round
  resetRound() {
    super.resetRound();
    for (const t of this.hitTargets || []) t.cleanup?.();
    this.hitTargets = [];
    for (const b of this.balls || []) this.scene.remove(b.mesh);
    for (const p of this.pages || []) this.scene.remove(p.mesh);
    this.balls = []; this.pages = [];
    for (const s of this.saps) { this.scene.remove(s.group); if (s.warn) this.scene.remove(s.warn); }
    for (const m of this.monsters) this.scene.remove(m.group);
    this.saps.length = 0; this.monsters.length = 0;
    this.wanderer.walk.wait = 1e9;
    this.wanderer.root.position.set(-10.8, 0, 7.0); // waits in a corner until the coffee kitchen scene
    this.shots = { spray: 0, on: 0, fires: 0, showers: 0, solved: 0, splats: 0, kunde: 0 };
    this.score = 0;
    this.pressure = 100;
    this.stationIdx = -1;
    this.walk = null;
    this.lookYaw = 0; this.lookPitch = 0; this.btnFire = false;
    this.drags?.clear();
    this.subEl = null;
  }

  beginShift() {
    this.resetRound();
    this.fps = true;
    this.run = {};
    this.danny.root.visible = false;
    this.vm.group.visible = true;
    this.sun.position.set(6, 18, 10);
    this.sun.target.position.set(0, 0, 0);
    this.resize(window.innerWidth, window.innerHeight);
    this.camPos.set(-11.4, EYE, 1.5);
    this.yaw = -Math.PI / 2; this.pitch = -0.05;
    this.buildHUD();
    this.state = 'play';
    this.t0 = performance.now();
    if (!this.sprayLoop) this.sprayLoop = createNoiseLoop('spray');
    if (!this.fireLoop) this.fireLoop = createNoiseLoop('fire');
    preloadVoices(Object.keys(VO.lines).map(VOICE_URL));
    this.office.doorLight.intensity = 30;
    this.script(this.run);
  }

  // ------------------------------------------------------------------ HUD
  buildHUD() {
    this.baseUI();
    const stat = (cls, label) => { const strong = h('strong', {}, '0'); const el = h(`div.stat.panel.${cls}`, {}, [h('small', {}, label), strong]); return { el, strong }; };
    this.hud = { score: stat('score', 'Punkte'), stage: stat('stage', 'Einsatzort'), acc: stat('combo', 'Treffer') };
    mount(h('div.hud.dn-hud.passthrough', {}, Object.values(this.hud).map((s) => s.el)));
    this.feedEl = mount(h('div.dn-feed.passthrough'));
    this.markersEl = mount(h('div.dn-markers.passthrough'));
    this.bubblesEl = mount(h('div.dn-bubbles.passthrough'));
    this.crossEl = mount(h('div.dn-cross.passthrough', {}, [h('i'), h('i'), h('i'), h('i'), h('b')]));
    if (this.coarse) {
      // big spray button for the thumb; works together with a second finger that looks around
      const btn = mount(h('button.dn-firebtn', { 'aria-label': 'Spritzen' }, [h('i', {}, '🧯'), h('span', {}, 'SPRITZEN')]));
      const on = (e) => { e.preventDefault(); e.stopPropagation(); unlockAudio(); this.btnFire = true; btn.classList.add('on'); try { btn.setPointerCapture?.(e.pointerId); } catch { /* not a real pointer */ } };
      const off = (e) => { e.preventDefault?.(); this.btnFire = false; btn.classList.remove('on'); };
      btn.addEventListener('pointerdown', on);
      btn.addEventListener('pointerup', off);
      btn.addEventListener('pointercancel', off);
      btn.addEventListener('lostpointercapture', off);
      btn.addEventListener('contextmenu', (e) => e.preventDefault());
      this.fireBtn = btn;
      this.cross.x = 0.5; this.cross.y = 0.5;
    }
    this.gauge = h('canvas', { width: '120', height: '120' });
    mount(h('div.dn-fpsgauge.passthrough', {}, [this.gauge, h('small', {}, 'Druck')]));
    this.subEl = mount(h('div.dn-sub.passthrough'));
    this.lastHud = {};
    this.drawFpsGauge(true);
  }

  updateHUD() {
    if (!this.hud) return;
    const set = (k, v) => { if (this.lastHud[k] !== v) { this.lastHud[k] = v; this.hud[k].strong.textContent = v; } };
    set('score', this.score.toLocaleString('de-DE'));
    set('stage', `${Math.max(1, this.stationIdx + 1)} / ${this.stations.length}`);
    set('acc', this.shots.spray > 0.5 ? `${Math.round((this.shots.on / this.shots.spray) * 100)} %` : '–');
    this.drawFpsGauge();
  }

  drawFpsGauge(force) {
    const p = this.pressure;
    if (!force && Math.abs(p - (this.gaugeP ?? -1)) < 0.8) return;
    this.gaugeP = p;
    const g = this.gauge.getContext('2d'), c = 60;
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
  }

  /** first-person view through the breathing mask (straw meme) */
  maskView(on) {
    document.querySelectorAll('.dn-maskview').forEach((e) => e.remove());
    if (on) { mount(h('div.dn-maskview.passthrough', {}, [h('i'), h('em')])); sfx.whoosh(); }
  }

  banner(n, name) {
    const el = mount(h('div.dn-banner.passthrough', {}, [h('small', {}, `Einsatzort ${n} / ${this.stations.length}`), h('b', {}, name)]));
    setTimeout(() => el.remove(), 2600);
  }

  // ------------------------------------------------------------------ voice + subtitles
  /** Plays a voice line with subtitle; resolves when it is over. */
  async talk(id, run = this.run, { gap = 0.25 } = {}) {
    const L = VO.lines[id];
    if (!L) return;
    this.check(run);
    this.talking = (this.talking || 0) + 1;
    this.subtitle(L.who, L.text);
    let dur = 0;
    try { dur = await playVoice(VOICE_URL(id)); } catch { dur = 0; }
    if (!dur) dur = Math.max(1.4, L.text.length * 0.06);
    await this.wait(dur + gap, run);
    this.talking--;
    if (!this.talking && this.subEl) this.subEl.classList.remove('on');
  }
  subtitle(who, text) {
    if (!this.subEl) return;
    this.subEl.replaceChildren(h('b', {}, who), h('span', {}, text));
    this.subEl.classList.toggle('danny', who === 'Danny');
    this.subEl.classList.add('on');
  }
  /** a short reaction that never interrupts the story lines */
  quip(id) {
    if (this.talking) return;
    const L = VO.lines[id];
    this.subtitle(L.who, L.text);
    playVoice(VOICE_URL(id), { interrupt: false }).then((d) => setTimeout(() => { if (!this.talking) this.subEl?.classList.remove('on'); }, (d || 1.6) * 1000 + 200));
  }
  wait(sec, run = this.run) { return new Promise((res, rej) => setTimeout(() => (run === this.run && this.state === 'play' ? res() : rej(new Abort())), sec * 1000)); }
  check(run) { if (run !== this.run || this.state !== 'play') throw new Abort(); }
  /** resolves once every target of the current scene is done */
  cleared(run = this.run) {
    return new Promise((res, rej) => {
      const tick = () => {
        if (run !== this.run || this.state !== 'play') return rej(new Abort());
        if (!this.hitTargets.some((t) => !t.done && !t.optional) && !this.saps.some((s) => !s.landed)) return res();
        setTimeout(tick, 150);
      };
      tick();
    });
  }

  // ------------------------------------------------------------------ the story
  get stations() {
    return [
      { name: 'Eingang', at: [-10.2, 1.5], look: [-7.6, 0.4, 0.7], via: [] },
      { name: 'Großraum West', at: [-5.3, 2.75], look: [-5.3, 0.8, -1.1], via: [[-8.2, 1.6], [-7.2, 2.4]] },
      { name: 'Entwickler-Insel', at: [1.7, 2.35], look: [0.5, 1.15, -1.0], via: [[-1.8, 2.3]] },
      { name: 'Meetingraum Kunde', at: [-8.3, -3.55], look: [-8.7, 1.1, -6.9], via: [[-2.0, 1.75], [-2.0, -3.3]] },
      { name: 'Serverraum', at: [5.0, -3.4], look: [8.6, 1.0, -5.6], via: [[-2.0, -3.3]] },
      { name: 'Kaffeeküche', at: [6.4, 3.7], look: [9.8, 1.15, 6.9], via: [[4.6, -1.2], [4.6, 1.6]] }
    ];
  }

  async script(run) {
    try {
      this.memeAlarm(0);
      playVoice(VOICE_URL('alarm_crowd'), { interrupt: false });
      await this.wait(1.6, run);
      // 1 entrance
      await this.goTo(0, run);
      const f0 = this.fireTarget(V(-7.9, 0.05, 0.6), 0.6);
      await this.talk('leit_intro', run);
      await this.talk('danny_intro', run);
      if (!f0.done) { this.feed(this.coarse ? '👉 Wischen zum Zielen, roten Knopf unten rechts gedrückt halten.' : '🖱️ Zielen und linke Maustaste gedrückt halten.', 'tip'); this.talk('danny_tut', run).catch(() => {}); }
      await this.cleared(run);
      await this.finishStation(run);
      // 2 open-plan office: sleeping consultant, desk fires, then the straw
      await this.goTo(1, run);
      const isl = (i, k) => this.office.seats.find((s) => s.island === i && s.k === k);
      const npcAt = (seat) => this.npcs.find((n) => n.seat === seat);
      const lazy = npcAt(isl(0, 0));
      lazy.state = 'sleep';
      await this.talk('berater_lazy', run);
      this.npcTarget(lazy, 'sleep', '💤', () => { lazy.state = 'sit'; this.talk('berater_wake').catch(() => {}); });
      this.fireTarget(isl(0, 1).top.clone(), 0.5);
      this.fireTarget(isl(0, 3).top.clone(), 0.7);
      await this.cleared(run);
      await this.wait(0.8, run);
      const straw = this.strawTarget(V(-5.2, 0.86, -1.3)); // lands right on the desk island
      await this.wait(1.4, run);
      this.maskView(true);
      await this.talk('stroh_q', run, { gap: 0.1 });
      this.memeCard(C.MEMES.stroh.top, C.MEMES.stroh.bottom, '🌾', 'stroh');
      await this.talk('stroh_a', run, { gap: 0.1 });
      await this.talk('danny_stroh', run);
      await this.cleared(run);
      void straw;
      this.maskView(false);
      await this.finishStation(run);
      // 3 developers: spaghetti-code monster throwing meatballs
      await this.goTo(2, run);
      const dev = npcAt(isl(1, 0));
      dev.state = 'despair';
      await this.talk('dev_code', run);
      this.monsterTarget(dev);
      await this.wait(1.5, run);
      await this.talk('monster', run);
      await this.cleared(run);
      dev.state = 'sit';
      await this.talk('dev_done', run);
      await this.talk('pl_frage', run, { gap: 0.15 });
      await this.talk('danny_frage', run);
      await this.finishStation(run);
      // 4 customer meeting room: the requirement specification is burning and flying around
      await this.goTo(3, run);
      await this.talk('kunde_req', run);
      this.fireTarget(V(-9.4, 0.84, -6.3), 0.8);
      for (let i = 0; i < 5; i++) this.pageTarget(i);
      await this.cleared(run);
      await this.talk('danny_req', run);
      await this.finishStation(run);
      // 5 server room boss: SAP monolith
      await this.goTo(4, run);
      await this.talk('sap_witness', run);
      this.sapBoss(V(8.6, 0, -5.3));
      await this.wait(1.6, run);
      await this.talk('danny_sap', run);
      await this.cleared(run);
      await this.talk('danny_sap_done', run);
      await this.finishStation(run);
      // 6 coffee kitchen: the project manager forgot everything
      await this.goTo(5, run);
      const pm = this.wanderer;
      pm.root.position.set(9.0, 0, 6.15);
      pm.root.rotation.y = Math.atan2(this.camPos.x - 9.0, this.camPos.z - 6.15);
      pm.state = 'confused';
      this.fireTarget(V(9.6, 1.68, 7.35), 0.6);
      this.fireTarget(V(10.9, 0.98, 7.3), 0.7);
      await this.talk('pl_forgot', run);
      this.npcTarget(pm, 'forgot', '🐟', () => { pm.state = 'walk'; this.talk('pl_wake').catch(() => {}); });
      await this.cleared(run);
      await this.wait(1.2, run);
      await this.finishStation(run, true);
      await this.talk('danny_end', run);
      this.endGame(true);
    } catch (e) {
      if (!(e instanceof Abort)) console.error(e);
    }
  }

  async finishStation(run, last = false) {
    const secs = (performance.now() - this.stationT0) / 1000;
    const bonus = Math.round(clamp(300 - Math.max(0, secs - 15) * 5, 50, 300));
    this.score += bonus;
    this.feed(`✅ ${this.stations[this.stationIdx].name} gelöscht · Zeitbonus +${bonus}`, 'good');
    sfx.combo(3);
    if (!last) { await this.wait(0.6, run); this.quip(['danny_go', 'danny_go2', 'danny_go3'][this.stationIdx % 3]); await this.wait(0.6, run); }
  }

  /** walk along the waypoints to a station */
  goTo(i, run) {
    const st = this.stations[i];
    const pts = [this.camPos.clone().setY(0), ...st.via.map(([x, z]) => V(x, 0, z)), V(st.at[0], 0, st.at[1])];
    const segs = [];
    let total = 0;
    for (let k = 1; k < pts.length; k++) { const l = pts[k].distanceTo(pts[k - 1]); segs.push(l); total += l; }
    const look = V(...st.look);
    const end = pts[pts.length - 1];
    const lookDir = look.clone().sub(V(end.x, EYE, end.z));
    this.walk = { pts, segs, total, d: 0, yaw: Math.atan2(-lookDir.x, -lookDir.z), pitch: Math.atan2(lookDir.y, Math.hypot(lookDir.x, lookDir.z)) };
    this.stationIdx = i;
    return new Promise((res, rej) => {
      const tick = () => {
        if (run !== this.run || this.state !== 'play') return rej(new Abort());
        if (!this.walk.moving && this.walk.d >= this.walk.total) { this.stationT0 = performance.now(); this.banner(i + 1, st.name); return res(); }
        setTimeout(tick, 100);
      };
      this.walk.moving = true;
      tick();
    });
  }

  // ------------------------------------------------------------------ targets
  addTarget(t) { this.hitTargets.push(t); if (!t.optional) this.addTargetMarker(t); return t; }
  addTargetMarker(t) {
    const ring = h('i.ring');
    const el = h('div.dn-marker.small', {}, [ring, h('b', {}, t.icon)]);
    this.markersEl?.append(el);
    t.marker = { el, ring };
  }
  finish(t, pts, label) {
    if (t.done) return;
    t.done = true;
    t.marker?.el.remove();
    this.score += pts;
    this.shots.solved++;
    this.popup(t.pos(), `${label} +${pts}`, 'good');
    t.onDone?.();
  }

  fireTarget(pos, I) {
    const f = this.addFire(pos, I);
    const t = this.addTarget({
      kind: 'fire', icon: '🔥', f,
      pos: () => f.pos.clone().add(V(0, 0.3 + f.I * 0.35, 0)),
      r: () => 0.45 + f.I * 0.4,
      progress: () => clamp(f.I / Math.max(0.01, f.maxI), 0, 1),
      spray: (dt) => {
        f.I -= dt * 1.05;
        if (Math.random() < dt * 12) this.fx.steam(f.pos, 1);
        if (f.I <= 0) { this.removeFire(f); this.shots.fires++; this.finish(t, POINTS.fire + Math.round(f.maxI * 60), '🔥'); }
      },
      cleanup: () => this.removeFire(f, true)
    });
    return t;
  }

  npcTarget(npc, kind, icon, onDone) {
    let hp = 1.3;
    const t = this.addTarget({
      kind, icon, npc,
      pos: () => this.npcHead(npc).add(V(0, -0.12, 0)),
      r: () => 0.45,
      progress: () => hp / 1.3,
      spray: (dt) => {
        hp -= dt;
        npc.wet = Math.min(1, npc.wet + dt * 2);
        if (Math.random() < dt * 8) this.fx.splash(this.npcHead(npc), 4);
        if (hp <= 0) { npc.react = { type: 'zap', t: 0 }; sfx.splash(); this.finish(t, POINTS[kind] || 300, icon); }
      },
      onDone
    });
    return t;
  }

  strawTarget(pos) {
    const st = buildStraw();
    st.group.position.set(pos.x, 9, pos.z);
    this.scene.add(st.group);
    let y = 9, vy = 0, landed = false, wet = 0;
    sfx.whoosh();
    const t = this.addTarget({
      kind: 'straw', icon: '🌾',
      pos: () => V(pos.x, pos.y + 0.5 + Math.max(0, y - pos.y), pos.z),
      r: () => 0.85,
      progress: () => 1 - wet,
      update: (dt) => {
        if (landed) return;
        vy -= 22 * dt; y += vy * dt;
        st.group.position.y = Math.max(pos.y, y);
        st.group.rotation.y += dt * 2;
        if (y <= pos.y) { landed = true; sfx.thud(); this.shake = 0.3; this.fx.dust(pos, 22, 1.4); this.fx.noodles.burst(pos.clone().add(V(0, 0.4, 0)), 0xe0bf52, 18, { speed: 4, up: 4, size: 0.05 }); }
      },
      spray: (dt) => {
        if (!landed) return;
        wet += dt * 0.7;
        st.mat.color.setScalar(1 - Math.min(1, wet) * 0.45);
        if (Math.random() < dt * 10) this.fx.splash(pos.clone().add(V(0, 0.8, 0)), 3);
        if (wet >= 1) this.finish(t, POINTS.straw, '🌾');
      },
      cleanup: () => this.scene.remove(st.group)
    });
    return t;
  }

  monsterTarget(dev) {
    const m = buildSpaghetti();
    const top = dev.seat.top;
    m.group.position.set(top.x, top.y, top.z - dev.seat.aisle * 0.12);
    m.group.scale.setScalar(0.05);
    this.scene.add(m.group);
    if (dev.seat.desk) dev.seat.desk.screenMat.map = this.screens.error;
    const MAX = 5;
    let hp = MAX, age = 0, ballT = 2.5;
    sfx.ignite();
    const t = this.addTarget({
      kind: 'monster', icon: '🍝',
      pos: () => m.group.position.clone().add(V(0, 0.7 * m.group.scale.x, 0)),
      r: () => 0.75 * m.group.scale.x + 0.2,
      progress: () => hp / MAX,
      update: (dt) => {
        age += dt;
        const target = (0.35 + 0.65 * (hp / MAX)) * Math.min(1, age / 1.2) * 1.15;
        m.group.scale.setScalar(lerp(m.group.scale.x, target, clamp(dt * 4, 0, 1)));
        m.noodles.forEach((n, i) => { n.rotation.y = Math.sin(age * 3 + n.userData.ph) * 0.25; n.rotation.z = Math.sin(age * 2.3 + i) * 0.12; });
        m.eyes.lookAt(this.camera.position);
        ballT -= dt;
        if (ballT <= 0 && age > 2) { ballT = 3.6; this.throwBall(m.group.position.clone().add(V(0, 1.1 * m.group.scale.x, 0))); }
      },
      spray: (dt) => {
        hp -= dt;
        if (Math.random() < dt * 6) this.fx.sauceBurst(m.group.position.clone().add(V(0, 0.6, 0)), 2);
        if (hp <= 0) {
          this.fx.noodles.burst(m.group.position.clone().add(V(0, 0.6, 0)), 0xf0cf72, 26, { speed: 6, up: 6, size: 0.12 });
          this.fx.sauceBurst(m.group.position.clone().add(V(0, 0.8, 0)), 30);
          sfx.splat(); sfx.smash(1.2);
          this.shake = 0.4;
          this.scene.remove(m.group);
          if (dev.seat.desk?.baseMap) dev.seat.desk.screenMat.map = dev.seat.desk.baseMap;
          for (const b of this.balls) b.target.done = true;
          this.finish(t, POINTS.monster, '🍝');
        }
      },
      cleanup: () => this.scene.remove(m.group)
    });
    return t;
  }

  throwBall(from) {
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.14, 12, 10), new THREE.MeshStandardMaterial({ color: 0x6b3a1e, roughness: 0.9 }));
    mesh.position.copy(from);
    mesh.castShadow = true;
    this.scene.add(mesh);
    // slow lob towards Danny's face, ~1.8 s of flight
    const T = 1.9;
    const aim = this.camPos.clone().add(V(rand(-0.3, 0.3), -0.1, 0));
    const vel = aim.clone().sub(from).divideScalar(T);
    vel.y += 0.5 * 6 * T;
    const b = { mesh, vel, t: 0, T };
    b.target = this.addTarget({
      kind: 'ball', icon: '🧆', optional: true,
      pos: () => mesh.position.clone(),
      r: () => 0.35,
      spray: (dt) => { b.hp = (b.hp ?? 0.25) - dt; if (b.hp <= 0) { this.fx.sauceBurst(mesh.position, 10); sfx.splat(); this.finish(b.target, POINTS.ball, '🧆'); } }
    });
    this.balls.push(b);
    sfx.whoosh();
  }

  pageTarget(i) {
    const mesh = buildLastenheft();
    mesh.scale.setScalar(0.55);
    this.scene.add(mesh);
    const c = V(rand(-10.6, -7.4), rand(1.1, 2.1), rand(-6.8, -4.9));
    const ph = Math.random() * 6.28, sp = rand(0.35, 0.6);
    let hp = 0.5;
    const t = this.addTarget({
      kind: 'page', icon: '📄',
      pos: () => mesh.position.clone(),
      r: () => 0.42,
      progress: () => hp / 0.5,
      update: (dt, time) => {
        const k = time * sp + ph;
        mesh.position.set(c.x + Math.sin(k) * 1.1, c.y + Math.sin(k * 1.7) * 0.35, c.z + Math.cos(k * 0.8) * 0.8);
        mesh.rotation.set(Math.sin(k * 2) * 0.8, k, Math.cos(k * 1.3) * 0.6);
        if (Math.random() < dt * 30) this.fx.flame(mesh.position, 0.18);
      },
      spray: (dt) => {
        hp -= dt;
        if (hp <= 0) { this.fx.papers.burst(mesh.position, 0xf4f1e6, 8, { speed: 2, up: 2, size: 0.12 }); this.fx.steam(mesh.position, 6); sfx.steam(); this.scene.remove(mesh); this.finish(t, POINTS.page, '📄'); }
      },
      cleanup: () => this.scene.remove(mesh)
    });
    void i;
    return t;
  }

  sapBoss(pos) {
    const s = buildSAP();
    s.group.position.set(pos.x, 14, pos.z);
    const toCam = Math.atan2(this.camPos.x - pos.x, this.camPos.z - pos.z);
    s.group.rotation.y = toCam;
    this.scene.add(s.group);
    const warn = new THREE.Mesh(this.warnGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(3, 0.4, 0.2), transparent: true, depthWrite: false }));
    warn.position.set(pos.x, 0.03, pos.z);
    this.scene.add(warn);
    const sap = { ...s, pos, warn, vy: 0, landed: false, fireT: 4 };
    this.saps.push(sap);
    sfx.alarm();
    const fwd = V(Math.sin(toCam), 0, Math.cos(toCam));
    const spots = [];
    const spotMat = () => new THREE.MeshBasicMaterial({ color: new THREE.Color(2.0, 0.35, 0.06), transparent: true, depthWrite: false });
    const disc = new THREE.CircleGeometry(0.2, 24);
    [[0.45, -0.3], [1.25, 0.25], [1.85, -0.12]].forEach(([y, side]) => {
      const m = new THREE.Mesh(disc, spotMat());
      const right = V(fwd.z, 0, -fwd.x);
      m.position.copy(pos).addScaledVector(fwd, 0.8 - y * 0.05).addScaledVector(right, side).setY(y);
      m.lookAt(m.position.clone().add(fwd));
      m.visible = false;
      this.scene.add(m);
      spots.push(m);
    });
    let left = 3;
    for (const m of spots) {
      let hp = 1.4;
      const t = this.addTarget({
        kind: 'spot', icon: '🗿',
        pos: () => m.position.clone(),
        r: () => 0.38,
        progress: () => hp / 1.4,
        active: () => sap.landed,
        update: (dt, time) => { m.visible = sap.landed; m.scale.setScalar(1 + Math.sin(time * 6) * 0.12); m.material.opacity = 0.5 + 0.5 * (hp / 1.4); },
        spray: (dt) => {
          if (!sap.landed) return;
          hp -= dt;
          if (Math.random() < dt * 14) this.fx.steam(m.position, 1);
          if (hp <= 0) {
            this.scene.remove(m);
            left--;
            const slab = s.slabs[left];
            if (slab) { this.fx.stones.burst(pos.clone().setY(slab.position.y), 0x6e737b, 14, { speed: 6, up: 5, size: 0.18 }); slab.visible = false; }
            sfx.clang(0.9 + left * 0.1);
            this.hitStop = 0.06;
            this.shake = 0.5;
            if (left <= 0) {
              this.scene.remove(s.group);
              this.saps.splice(this.saps.indexOf(sap), 1);
              this.fx.ring(pos, 0xffffff, 5, 0.5);
              this.fx.boom(pos, 0xffffff, 1);
              sfx.smash(0.8);
              this.shake = 0.8;
              this.score += 500;
              this.popup(pos.clone().add(V(0, 2.2, 0)), 'SAP BESIEGT +500', 'combo');
            }
            this.finish(t, POINTS.spot, '🗿');
          }
        },
        cleanup: () => this.scene.remove(m)
      });
    }
  }

  // ------------------------------------------------------------------ input
  setCross(e) {
    const r = this.app.gfx.renderer.domElement.getBoundingClientRect();
    this.cross.x = clamp((e.clientX - r.left) / r.width, 0, 1);
    this.cross.y = clamp((e.clientY - r.top) / r.height, 0, 1);
  }
  onDown(e) {
    unlockAudio();
    if (this.state !== 'play') return;
    if (e.pointerType !== 'mouse') {
      // touch: swipe to look around
      this.drags.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.lastLookT = performance.now();
      return;
    }
    this.setCross(e);
    this.firing = true;
    this.aimPtr = e.pointerId;
  }
  onMove(e) {
    if (this.state !== 'play') return;
    const d = this.drags.get(e.pointerId);
    if (d) {
      const sens = (this.portrait ? 2.4 : 1.9) / Math.max(window.innerWidth, window.innerHeight);
      this.lookYaw -= (e.clientX - d.x) * sens * 1.6;
      this.lookPitch = clamp(this.lookPitch - (e.clientY - d.y) * sens * 1.3, -0.75, 0.6);
      d.x = e.clientX; d.y = e.clientY;
      this.lastLookT = performance.now();
      return;
    }
    if (e.pointerType === 'mouse' || e.pointerId === this.aimPtr) this.setCross(e);
  }
  onUp(e) {
    this.drags.delete(e.pointerId);
    if (e.pointerId === this.aimPtr || e.pointerType === 'mouse') { this.firing = false; this.aimPtr = null; }
  }

  /** touch aim assist: while spraying, the view drifts onto a target close to the crosshair */
  aimAssist(dt) {
    if (!this.coarse || !this.btnFire) return;
    const camYaw = this.yaw + this.lookYaw, camPitch = this.pitch + this.lookPitch;
    let best = null, bestA = 0.2;
    for (const t of this.hitTargets) {
      if (t.done || (t.active && !t.active())) continue;
      const v = t.pos().sub(this.camPos);
      const ty = Math.atan2(-v.x, -v.z), tp = Math.atan2(v.y, Math.hypot(v.x, v.z));
      let dy = ty - camYaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy));
      const dp = tp - camPitch;
      const a = Math.hypot(dy, dp);
      if (a < bestA) { bestA = a; best = { dy, dp }; }
    }
    if (!best) return;
    // stronger pull the closer you already are, a bit weaker while the thumb is actively swiping
    const swiping = performance.now() - (this.lastLookT || 0) < 120;
    const k = clamp(dt * (swiping ? 2.5 : 5), 0, 1);
    this.lookYaw += best.dy * k;
    this.lookPitch += best.dp * k;
  }
  onKeyDown(e) {
    const k = e.key.toLowerCase();
    this.keys.add(k);
    if (this.state === 'safe') { this.safeKeys?.(e); return; }
    if (this.state === 'menu' && e.key === 'Enter') { unlockAudio(); this.startAlarm(); return; }
    if (e.key === ' ') { this.keyFire = true; e.preventDefault(); }
  }

  // ------------------------------------------------------------------ main loop
  update(dt, time) {
    if (!this.fps || this.state === 'menu' || this.state === 'alarm' || this.state === 'safe' || this.state === 'idle') { super.update(dt, time); return; }
    if (this.hitStop > 0) { this.hitStop -= dt; dt *= 0.15; }
    this.runTimers(dt);
    this.updateWalk(dt, time);
    this.updateCamera(dt, time);
    this.updateTargets(dt, time);
    this.updateSpray(dt, time);
    this.updateFiresFPS(dt, time);
    this.updateBalls(dt);
    for (const s of this.saps) {
      if (s.landed) { s.mat.emissiveIntensity = 0.08 + Math.sin(time * 3) * 0.05; if (Math.random() < dt * 5) this.fx.smoke(s.pos.clone().add(V(0, 1.4, 0)), 0.4); continue; }
      s.vy -= 30 * dt;
      s.group.position.y += s.vy * dt;
      s.warn.material.opacity = 0.5 + Math.sin(time * 18) * 0.4;
      if (s.group.position.y <= 0) {
        s.group.position.y = 0; s.landed = true;
        this.scene.remove(s.warn);
        sfx.boom(1.2); this.shake = 0.9; this.hitStop = 0.08;
        this.fx.dust(s.pos, 40, 2); this.fx.ring(s.pos, 0xffaa66, 6, 0.6);
        this.fx.stones.burst(s.pos.clone().add(V(0, 0.3, 0)), 0x6e737b, 16, { speed: 6, up: 6, size: 0.16 });
        this.fx.boom(s.pos, 0xffaa66, 1.2);
        this.fx.scorch.add(s.pos.x, s.pos.z, { size: 3.2, life: 60, grow: 0 });
        this.fireTarget(s.pos.clone().add(V(-1.3, 0.05, 0.6)), 0.5);
      }
    }
    this.updateNPCs(dt, time);
    for (const led of this.office.leds) if (Math.random() < dt * 3) led.material.color.setRGB(Math.random() < 0.15 ? 2.5 : 0.2, Math.random() < 0.85 ? 2.2 : 0.3, 0.4);
    this.office.doorLight.intensity = Math.max(0, this.office.doorLight.intensity - dt * 10) * (0.6 + 0.4 * Math.abs(Math.sin(time * 9)));
    this.fx.update(dt, time);
    this.updateAnchors(dt);
    this.updateMarkers();
    this.updateHUD();
  }

  updateWalk(dt, time) {
    const w = this.walk;
    if (!w || !w.moving) return;
    w.d = Math.min(w.total, w.d + WALK * dt);
    let d = w.d, k = 0;
    while (k < w.segs.length - 1 && d > w.segs[k]) { d -= w.segs[k]; k++; }
    const a = w.pts[k], b = w.pts[k + 1];
    const p = a.clone().lerp(b, w.segs[k] ? d / w.segs[k] : 1);
    this.camPos.set(p.x, EYE, p.z);
    const left = w.total - w.d;
    // look along the path, turn towards the scene on the last metres
    const dir = b.clone().sub(a);
    let wantYaw = dir.lengthSq() > 1e-6 ? Math.atan2(-dir.x, -dir.z) : w.yaw;
    let wantPitch = -0.04;
    if (left < 2.2) { const kk = 1 - left / 2.2; wantYaw = this.lerpAngle(wantYaw, w.yaw, kk); wantPitch = lerp(wantPitch, w.pitch, kk); }
    this.yaw = this.lerpAngle(this.yaw, wantYaw, clamp(dt * 3, 0, 1));
    this.pitch = lerp(this.pitch, wantPitch, clamp(dt * 3, 0, 1));
    this.bob = (this.bob || 0) + dt * 8.5;
    if (Math.sin(this.bob) * Math.sin(this.bob - dt * 8.5) < 0) sfx.step();
    if (w.d >= w.total) { w.moving = false; }
    void time;
  }
  lerpAngle(a, b, k) { let d = b - a; d = Math.atan2(Math.sin(d), Math.cos(d)); return a + d * k; }

  updateCamera(dt, time) {
    const w = this.walk;
    const walking0 = !!w?.moving;
    if (w && !w.moving) {
      this.yaw = this.lerpAngle(this.yaw, w.yaw, clamp(dt * 3, 0, 1));
      this.pitch = lerp(this.pitch, w.pitch, clamp(dt * 3, 0, 1));
    }
    // gentle look-around towards the crosshair
    if (this.coarse) {
      // crosshair fixed in the middle; the swipe offset slowly returns to the scene while walking
      this.cross.x = 0.5; this.cross.y = 0.5;
      if (walking0) { this.lookYaw = lerp(this.lookYaw, 0, clamp(dt * 2.5, 0, 1)); this.lookPitch = lerp(this.lookPitch, 0, clamp(dt * 2.5, 0, 1)); }
      this.aimAssist(dt);
      this.aimYaw = this.lookYaw; this.aimPitch = this.lookPitch;
    } else {
      const spanX = this.portrait ? 0.32 : 0.5, spanY = 0.3;
      this.aimYaw = lerp(this.aimYaw, -(this.cross.x - 0.5) * spanX, clamp(dt * 4, 0, 1));
      this.aimPitch = lerp(this.aimPitch, -(this.cross.y - 0.5) * spanY, clamp(dt * 4, 0, 1));
    }
    const walking = w?.moving;
    const bob = walking ? Math.sin(this.bob) * 0.035 : Math.sin(time * 1.6) * 0.006;
    this.camera.position.set(this.camPos.x, this.camPos.y + bob, this.camPos.z);
    this.shake = Math.max(0, (this.shake || 0) - dt * 1.8);
    if (this.shake > 0) this.camera.position.add(V((Math.random() - 0.5) * this.shake * 0.15, (Math.random() - 0.5) * this.shake * 0.12, 0));
    this.camera.rotation.set(this.pitch + this.aimPitch, this.yaw + this.aimYaw, walking ? Math.sin(this.bob * 0.5) * 0.01 : 0, 'YXZ');
    this.camera.updateMatrixWorld();
    // view model: sway, walk bob, recoil while spraying
    const vm = this.vm;
    const spraying = this.sprayOn;
    const rec = spraying ? Math.sin(time * 55) * 0.006 : 0;
    vm.group.position.set(vm.base.x + (walking ? Math.cos(this.bob * 0.5) * 0.015 : 0) + rec, vm.base.y + (walking ? Math.abs(Math.sin(this.bob)) * -0.02 : Math.sin(time * 1.6) * 0.006) + rec, vm.base.z + (spraying ? 0.02 : 0));
    vm.group.rotation.set((this.cross.y - 0.5) * -0.15, (this.cross.x - 0.5) * -0.25, 0);
    vm.lever.rotation.z = lerp(vm.lever.rotation.z, spraying ? 0.14 : 0, clamp(dt * 20, 0, 1));
    // crosshair
    if (this.crossEl) {
      this.crossEl.style.transform = `translate(${this.cross.x * window.innerWidth}px, ${this.cross.y * window.innerHeight}px)`;
      this.crossEl.classList.toggle('on', !!this.aimTarget);
      this.crossEl.classList.toggle('fire', !!spraying);
    }
  }

  /** first thing along the aim ray: a target, a colleague (shower) or nothing */
  pick() {
    const ndc = new THREE.Vector2(this.cross.x * 2 - 1, -(this.cross.y * 2 - 1));
    this.rayc.setFromCamera(ndc, this.camera);
    const ray = this.rayc.ray;
    const o = ray.origin, d = ray.direction;
    let best = null, bestT = RANGE;
    const test = (c, r, obj) => {
      const t = c.clone().sub(o).dot(d);
      if (t < 0.3 || t > bestT) return;
      const dist = o.clone().addScaledVector(d, t).distanceTo(c);
      if (dist < r) { bestT = t; best = obj; }
    };
    for (const t of this.hitTargets) if (!t.done && (!t.active || t.active())) test(t.pos(), t.r() * (this.coarse ? 1.6 : 1.15), { target: t });
    // targets win over colleagues standing in front of them; only otherwise you shower someone
    if (!best) for (const n of this.npcs) {
      if (this.hitTargets.some((t) => !t.done && t.npc === n)) continue;
      test(this.npcHead(n).add(V(0, -0.25, 0)), 0.5, { npc: n });
    }
    return { hit: best, dist: bestT, point: o.clone().addScaledVector(d, Math.min(bestT, best ? bestT : 6.5)) };
  }

  updateSpray(dt, time) {
    const want = (this.firing || this.keyFire || this.btnFire) && this.state === 'play';
    const p = this.pick();
    this.aimTarget = p.hit?.target || null;
    const power = this.pressure > 2 ? 1 : 0.45; // never fully empty, just weaker: no stress
    this.sprayOn = want;
    this.sprayLoop?.set(want ? 0.85 * power : 0, 0.5);
    if (!want) { this.pressure = Math.min(100, this.pressure + dt * 16); return; }
    this.pressure = Math.max(0, this.pressure - dt * 7);
    this.shots.spray += dt;
    // foam stream from the nozzle to the aim point
    const from = V();
    this.vm.nozzle.getWorldPosition(from);
    const T = clamp(p.dist / 14, 0.18, 0.5);
    this.foamAcc = (this.foamAcc || 0) + 85 * this.quality * dt;
    while (this.foamAcc > 1) {
      this.foamAcc--;
      const aim = p.point.clone().add(V(rand(-0.12, 0.12), rand(-0.12, 0.12), rand(-0.12, 0.12)));
      const v = aim.sub(from).divideScalar(T);
      v.y += 0.5 * 5 * T;
      this.fx.norm.emit(from.x, from.y, from.z, v.x, v.y, v.z, { life: T * rand(1.3, 2.2), s0: 0.06, s1: rand(0.45, 0.75), kind: 'foam', grav: 5, drag: 0.2, flags: 2, spin: rand(-4, 4) });
    }
    if (!p.hit) return;
    if (p.hit.target) {
      this.shots.on += dt;
      p.hit.target.spray(dt * power, time);
    } else if (p.hit.npc) this.shower(p.hit.npc, dt);
  }

  shower(n, dt) {
    this.shots.on += dt * 0.5;
    n.wet = Math.min(1, n.wet + dt * 2);
    if (n.showerCd > 0) return;
    n.showerCd = 4;
    n.react = { type: 'wet', t: 0 };
    sfx.splash();
    const head = this.npcHead(n);
    this.fx.splash(head, 12);
    this.shots.showers++;
    if (n.role === 'kunde') { this.shots.kunde++; this.score += POINTS.kunde; this.popup(head.add(V(0, 0.5, 0)), `💦 Kundendusche +${POINTS.kunde}`, 'combo'); this.quip('kunde_wet'); return; }
    this.score += POINTS.shower;
    this.popup(head.add(V(0, 0.5, 0)), `💦 Abreibung +${POINTS.shower}`, 'good');
    const id = n.female ? (n.role === 'pl' ? 'wet_pl' : 'wet_frau') : n.role === 'dev' ? pick2('wet_dev', 'wet_dev2') : n.role === 'pl' ? 'wet_pl' : pick2('wet_berater', 'wet_berater2');
    if (id === 'wet_pl' && !n.female) return;
    this.quip(id);
  }

  updateTargets(dt, time) {
    for (const t of this.hitTargets) if (!t.done) t.update?.(dt, time);
    this.hitTargets = this.hitTargets.filter((t) => !t.done);
  }

  updateBalls(dt) {
    for (const b of [...this.balls]) {
      if (b.target.done) { this.scene.remove(b.mesh); this.balls.splice(this.balls.indexOf(b), 1); continue; }
      b.t += dt;
      b.vel.y -= 6 * dt;
      b.mesh.position.addScaledVector(b.vel, dt);
      b.mesh.rotation.x += dt * 6;
      if (b.mesh.position.distanceTo(this.camera.position) < 0.55 || b.t > b.T + 0.4) {
        b.target.done = true;
        this.scene.remove(b.mesh);
        this.balls.splice(this.balls.indexOf(b), 1);
        if (b.t <= b.T + 0.4) this.splat();
      }
    }
  }

  splat() {
    this.shots.splats++;
    sfx.splat();
    this.shake = 0.3;
    const el = mount(h('div.dn-splat.passthrough', {}, Array.from({ length: 7 }, () => h('i', { style: `left:${rand(5, 80)}%;top:${rand(5, 70)}%;width:${rand(14, 30)}vmin;height:${rand(14, 30)}vmin` }))));
    setTimeout(() => el.classList.add('out'), 1800);
    setTimeout(() => el.remove(), 2600);
    if (this.shots.splats === 1) this.quip('danny_splat');
  }

  updateFiresFPS(dt, time) {
    let total = 0;
    for (const f of this.fires) {
      f.I = Math.min(1.2, f.I + 0.008 * dt);
      f.maxI = Math.max(f.maxI, f.I);
      total += f.I;
      f.emit += dt * (20 + f.I * 36) * this.quality;
      while (f.emit > 1) { f.emit--; this.fx.flame(f.pos, f.I); }
      f.smokeT += dt * (3 + f.I * 5) * this.quality;
      while (f.smokeT > 1) { f.smokeT--; this.fx.smoke(f.pos, f.I); }
      if (Math.random() < dt * 4 * f.I) this.fx.ember(f.pos, f.I);
    }
    const sorted = [...this.fires].sort((a, b) => b.I - a.I);
    this.fireLights.forEach((l, i) => {
      const f = sorted[i];
      if (!f) { l.intensity = 0; return; }
      l.position.set(f.pos.x, f.pos.y + 1.0 + f.I * 0.4, f.pos.z);
      l.intensity = (7 + f.I * 16) * (0.8 + Math.sin(time * 23 + i * 3) * 0.12 + Math.sin(time * 37 + i) * 0.08);
    });
    this.fireLoop?.set(clamp(total / 3, 0, 1), clamp(total / 4, 0, 1));
  }

  updateMarkers() {
    const W = window.innerWidth, H = window.innerHeight, v = V();
    for (const t of this.hitTargets) {
      if (!t.marker) continue;
      if (t.done || (t.active && !t.active())) { t.marker.el.style.display = 'none'; continue; }
      t.marker.el.style.display = '';
      v.copy(t.pos()).add(V(0, t.r() + 0.25, 0)).project(this.camera);
      let x = (v.x * 0.5 + 0.5) * W, y = (-v.y * 0.5 + 0.5) * H;
      const behind = v.z > 1;
      if (behind) { x = W - x; y = H - y; }
      const m = 30;
      const off = behind || x < m || x > W - m || y < m + 70 || y > H - m - 60;
      const cx = clamp(x, m, W - m), cy = clamp(y, m + 70, H - m - 60);
      t.marker.el.style.transform = `translate(${cx}px, ${cy}px)`;
      t.marker.el.classList.toggle('off', off);
      if (off) t.marker.el.style.setProperty('--ang', `${Math.atan2(y - cy, x - cx)}rad`);
      const pr = t.progress ? clamp(t.progress(), 0, 1) : 1;
      t.marker.ring.style.background = `conic-gradient(#ff7a2a ${pr * 360}deg, rgba(255,255,255,.12) 0)`;
    }
  }

  // ------------------------------------------------------------------ end
  endGame() {
    if (this.state !== 'play') return;
    this.state = 'over';
    this.firing = false;
    this.sprayLoop?.set(0);
    this.fireLoop?.set(0);
    sfx.win();
    if (this.score > this.best) { this.best = this.score; storeSet('danny-best', this.best); }
    const rank = rankFor(this.score);
    const sh = this.shots;
    const mins = (performance.now() - this.t0) / 60000;
    setTimeout(() => {
      if (this.state !== 'over') return;
      document.querySelectorAll('.dn-hud, .dn-fpsgauge, .dn-cross, .dn-feed, .dn-sub').forEach((e) => e.remove());
      this.vm.group.visible = false;
      mount(h('div.overlay.dn-over', {}, h('div.card.panel.dn-card', {}, [
        h('div.dn-emblem-wrap.small', { html: EMBLEM_SVG }),
        h('div.kicker', {}, 'Schichtende · Einsatzbericht'),
        h('h1', {}, `${this.score.toLocaleString('de-DE')} Punkte`),
        h('div', {}, h(`span.rank.dn-rank.${rank.id}`, {}, rank.name)),
        h('p', {}, pick2(...C.WIN_LINES)),
        h('p', {}, rank.line),
        h('div.dn-report', {}, [
          ['🔥 Brände gelöscht', sh.fires], ['🛠️ Einsätze erledigt', sh.solved], ['🎯 Treffsicherheit', `${sh.spray ? Math.round((sh.on / sh.spray) * 100) : 0} %`],
          ['💦 Kollegen geduscht', sh.showers], ['🤵 Kunde nass gemacht', sh.kunde], ['🧆 Fleischbällchen im Gesicht', sh.splats],
          ['⏱️ Einsatzdauer', `${mins.toFixed(1).replace('.', ',')} min`]
        ].map(([k, val]) => h('div', {}, [h('span', {}, k), h('b', {}, String(val))]))),
        h('p', {}, `Rekord: ${this.best.toLocaleString('de-DE')} Punkte`),
        h('div.row', {}, [
          h('button.btn.dn-go', { onclick: () => { sfx.click(); this.state = 'menu'; this.fps = false; this.danny.root.visible = true; this.resize(window.innerWidth, window.innerHeight); this.startAlarmFromOver(); } }, '🚨 Nochmal'),
          h('button.btn.secondary', { onclick: () => { sfx.click(); this.showMenu(); } }, 'Zur Feuerwache')
        ])
      ])));
    }, 1200);
  }

  exit() {
    this.run = {};
    stopVoice();
    super.exit();
    this.fps = false;
  }
}

function pick2(...a) { return a[Math.floor(Math.random() * a.length)]; }
void RoundedBoxGeometry; void music;
