import * as THREE from 'three';
import { rand, clamp, lerp, easeOutBack } from '../../core/gfx.js';
import { sfx, music, unlockAudio, isMuted, setMuted, primeSong } from '../../core/audio.js';
import { h, mount, clearUI, storeGet, storeSet } from '../../core/ui.js';
import { loadAvatar, buildAvatar, disposeAvatar } from '../../hub/avatar.js';
import { Effects } from '../whack/effects.js';
import {
  getMode, setMode, say, DAYS, TOTAL_TIME, RES, RES_IDS, MODULES, TOWER_MODS, FEATURES, featureById, TRADERS, traderById,
  LEGACY, legacyById, RIVAL, CUSTOMERS, MONSTERS, NIGHTS, LORD, PTS, rankFor, LEARN, SONG
} from './content.js';
import { World, R, CASTLE, TOWERS, LORD_POS, SPAWN, STALLS, RIVAL_POS, LEGACY_SPOTS } from './world.js';
import { buildLord, buildTrader, buildFeatureBlock, buildLegacy, buildMonster, buildPickaxe, buildCloud, textSprite, lordSVG, BLOCK } from './models.js';
import { KoenigreichFinale } from './finale.js';
import { songChip } from './songchip.js';

// "Das CRM-Königreich" – a floating block island. By day: mine SAP ore, customer-data crystals
// and lead fruit, trade with the module traders and build the CRM castle (SAP foundation +
// Marketing, Sales, Service and Commerce towers) to fit each day's customer. By night: the
// legacy monsters attack and the towers defend themselves. Three days, three nights.

const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const fmt = (n) => n.toLocaleString('de-DE');
const costText = (cost) => Object.entries(cost).map(([k, v]) => `${v}${RES[k].icon}`).join(' ');
const MON_COLORS = {
  excel: [0x2f9e5a, 0x1f6b3c, 0xffffff], postfach: [0xf1ead2, 0xe6dcc0, 0xc0182c], silo: [0x8b939e, 0x6c737d, 0xffcc33],
  ghost: [0xb9a8ff, 0x5a3fd6, 0xffffff], boss: [0xf4efe0, 0x2f9e5a, 0xcfc5a8, 0xa4373a, 0xff3b2a]
};

// ------------------------------------------------------------------ voxel debris (instanced)
class Debris {
  constructor(scene, max = 600) {
    this.max = max;
    this.im = new THREE.InstancedMesh(new THREE.BoxGeometry(0.16, 0.16, 0.16), new THREE.MeshStandardMaterial({ roughness: 0.7 }), max);
    this.im.count = 0;
    this.im.frustumCulled = false;
    this.im.castShadow = true;
    this.im.setColorAt(0, new THREE.Color());
    scene.add(this.im);
    this.parts = [];
    this.m4 = new THREE.Matrix4();
    this.q = new THREE.Quaternion();
    this.e = new THREE.Euler();
    this.s = new THREE.Vector3();
  }
  burst(pos, colors, n = 14, { speed = 4, up = 6, size = 1, spread = 0.4, life = 1.2 } = {}) {
    for (let i = 0; i < n && this.parts.length < this.max; i++) {
      const a = Math.random() * Math.PI * 2;
      const sp = speed * (0.4 + Math.random());
      this.parts.push({
        p: pos.clone().add(new THREE.Vector3(rand(-spread, spread), rand(-spread, spread) * 0.5, rand(-spread, spread))),
        v: new THREE.Vector3(Math.cos(a) * sp, up * (0.5 + Math.random()), Math.sin(a) * sp),
        r: new THREE.Vector3(Math.random() * 6, Math.random() * 6, Math.random() * 6),
        w: new THREE.Vector3(rand(-12, 12), rand(-12, 12), rand(-12, 12)),
        life: life * (0.7 + Math.random() * 0.6), s: size * (0.6 + Math.random() * 0.8),
        c: new THREE.Color(colors[i % colors.length])
      });
    }
  }
  update(dt) {
    const P = this.parts;
    for (let i = P.length - 1; i >= 0; i--) {
      const d = P[i];
      d.life -= dt;
      if (d.life <= 0) { P.splice(i, 1); continue; }
      d.v.y -= 22 * dt;
      d.p.addScaledVector(d.v, dt);
      d.r.addScaledVector(d.w, dt);
      const onIsland = d.p.x * d.p.x + d.p.z * d.p.z < R * R;
      if (d.p.y < 0.08 && onIsland && d.v.y < 0) {
        d.p.y = 0.08; d.v.y *= -0.3; d.v.x *= 0.6; d.v.z *= 0.6; d.w.multiplyScalar(0.5);
      }
    }
    const n = P.length;
    for (let i = 0; i < n; i++) {
      const d = P[i];
      this.q.setFromEuler(this.e.set(d.r.x, d.r.y, d.r.z));
      const k = d.s * Math.min(1, d.life * 3);
      this.m4.compose(d.p, this.q, this.s.set(k, k, k));
      this.im.setMatrixAt(i, this.m4);
      this.im.setColorAt(i, d.c);
    }
    this.im.count = n;
    this.im.instanceMatrix.needsUpdate = true;
    if (this.im.instanceColor) this.im.instanceColor.needsUpdate = true;
  }
  clear() { this.parts.length = 0; this.im.count = 0; }
}

export class KoenigreichGame {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xb5e0ff, 48, 130);
    this.scene.environment = app.gfx.envMap;
    this.scene.environmentIntensity = 0.35;
    this.camera = new THREE.PerspectiveCamera(48, 1, 0.1, 700);
    this.raycaster = new THREE.Raycaster();
    this.pointer = new THREE.Vector2();
    this.world = new World(this.scene, app.gfx.envMap);
    this.effects = new Effects(this.scene, 0);
    this.effects.bounds = { x: 40, z: 40 };
    this.debris = new Debris(this.scene);
    this.state = 'idle';
    this.mode = getMode();
    this.camAz = 0;
    this.camEl = 0.8;
    this.zoom = 1;
    this.camFocus = new THREE.Vector3(0, 0, -1);
    this.flying = [];
    this.projectiles = [];
    this.bolts = [];
    this.monsters = [];
    this.falling = [];
    this.junk = [];
    this.buildCast();
    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onKey = this.onKey.bind(this);
    this.onWheel = this.onWheel.bind(this);
  }

  // ================================================================== characters
  buildCast() {
    const s = this.scene;
    // Lord CRM in front of the keep
    this.lord = buildLord();
    this.lord.root.position.copy(LORD_POS);
    s.add(this.lord.root);
    this.lord.root.traverse((o) => { if (o.isMesh) o.userData.lord = true; });
    // traders in their stalls
    this.traders = {};
    for (const T of TRADERS) {
      const p = buildTrader(T.id);
      const S = STALLS[T.id];
      const off = T.id === 'core' ? new THREE.Vector3(1.0, 0, 1.6) : new THREE.Vector3(0, 0, -0.1);
      off.applyAxisAngle(new THREE.Vector3(0, 1, 0), S.rot);
      p.root.position.copy(S.pos).add(off);
      p.root.rotation.y = S.rot;
      s.add(p.root);
      this.traders[T.id] = p;
      const tag = (o) => { if (o.isMesh) o.userData.trader = T.id; };
      p.root.traverse(tag);
      this.world.stalls[T.id].group.traverse(tag);
    }
    // the rival on his cloud
    this.rivalCloud = buildCloud(0.55, 1);
    this.rivalCloud.group.position.copy(RIVAL_POS).add(new THREE.Vector3(0, -0.45, 0));
    s.add(this.rivalCloud.group);
    this.rival = buildTrader('rival');
    this.rival.root.position.copy(RIVAL_POS);
    this.rival.root.rotation.y = -Math.PI / 2 - 0.3;
    s.add(this.rival.root);
    this.rival.root.traverse((o) => { if (o.isMesh) o.userData.rival = true; });
    this.rivalCloud.group.traverse((o) => { if (o.isMesh) o.userData.rival = true; });
    const sign = textSprite('☁ Cloudius’ Wolken-Deals', { color: '#e6e9ff', bg: 'rgba(80,70,140,0.85)', size: 44, border: '#b8bfd6' });
    sign.position.copy(RIVAL_POS).add(new THREE.Vector3(0, 3.0, 0));
    s.add(sign);
    this.rivalSign = sign;
    // the "interface" cable from the cloud to the island
    const from = RIVAL_POS.clone().add(new THREE.Vector3(-0.6, 0.2, 0)), to = new THREE.Vector3(12.8, 0.1, -1.2);
    const cable = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, from.distanceTo(to), 6), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    cable.position.copy(from).lerp(to, 0.5);
    cable.lookAt(to); cable.rotateX(Math.PI / 2);
    s.add(cable);
  }

  // ================================================================== lifecycle
  enter() {
    this.mode = getMode();
    this.resize(window.innerWidth, window.innerHeight);
    const c = this.app.gfx.renderer.domElement;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
    window.addEventListener('keydown', this.onKey);
    this.best = storeGet('crm-best', 0);
    this.spawnPlayer();
    this.resetWorld();
    this.prewarm();
    this.showIntro();
    music.play('kingdom');
    music.setIntensity(-1);
  }

  exit() {
    const c = this.app.gfx.renderer.domElement;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
    window.removeEventListener('keydown', this.onKey);
    this.state = 'idle';
    this.resetWorld();
    clearUI();
    clearTimeout(this.lordTimer);
    clearTimeout(this.hintTimer);
  }

  resize(w, hgt) {
    const aspect = w / hgt;
    this.portrait = aspect < 0.9;
    this.camera.aspect = aspect;
    this.camera.fov = this.portrait ? 58 : 46;
    this.camera.updateProjectionMatrix();
    this.camDist = this.portrait ? 30 : hgt < 500 ? 25 : 27;
  }

  spawnPlayer() {
    if (this.player) { this.scene.remove(this.player.root); disposeAvatar(this.player); }
    this.player = buildAvatar(loadAvatar());
    this.player.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.pickaxe = buildPickaxe();
    this.pickaxe.position.set(0, -0.62, 0.1);
    this.pickaxe.rotation.x = Math.PI / 2;
    this.player.arms[1].add(this.pickaxe);
    this.player.root.position.copy(SPAWN);
    this.player.root.rotation.y = Math.PI;
    this.scene.add(this.player.root);
    this.walk = null;
    this.act = null;
    this.walkPh = 0;
  }

  prewarm() {
    if (this.warmed) return;
    this.warmed = true;
    const far = new THREE.Vector3(0, -80, 0);
    this.effects.sparks(far, 0xffffff, 2);
    this.effects.shockwave(far, 0xffffff);
    this.effects.flash(far, 0xffffff, 1);
    const tmp = [];
    for (const type of Object.keys(MONSTERS)) { const m = buildMonster(type); m.group.position.copy(far); this.scene.add(m.group); tmp.push(m.group); }
    for (const f of FEATURES.slice(0, 4)) { const b = buildFeatureBlock(f, false); b.position.copy(far); this.scene.add(b); tmp.push(b); }
    this.world.setCycle(Math.PI * 0.35);
    this.app.gfx.renderer.compile(this.scene, this.camera);
    for (const o of tmp) this.scene.remove(o);
    this.effects.clear();
  }

  resetWorld() {
    for (const f of this.flying) this.scene.remove(f.mesh);
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    for (const b of this.bolts) this.scene.remove(b.mesh);
    for (const m of this.monsters) this.removeMonster(m);
    for (const f of this.falling) this.scene.remove(f.mesh);
    for (const j of this.junk) this.scene.remove(j.group);
    this.flying.length = 0; this.projectiles.length = 0; this.bolts.length = 0; this.monsters.length = 0; this.falling.length = 0; this.junk.length = 0;
    if (this.towers) for (const st of this.towers) for (const e of st) this.scene.remove(e.mesh);
    this.towers = [[], [], [], []];
    this.built = new Map();
    for (const br of this.world.bridges) br.visible = false;
    this.world.kiCrystal.visible = false;
    this.world.kiLight.intensity = 0;
    this.world.biBanner.visible = false;
    this.world.biBanner2.visible = false;
    for (const n of this.world.nodes) this.reviveNode(n, true);
    this.debris.clear();
    this.effects.clear();
    this.walk = null;
    this.act = null;
    if (this.player) { this.player.root.position.copy(SPAWN); this.player.root.rotation.y = Math.PI; }
    this.world.setCycle(Math.PI * 0.35);
    this.lordState = null;
  }

  // ================================================================== UI helpers
  baseUI() {
    clearUI();
    mount(h('button.icon-btn.left', { title: 'Zurück zur Spielewelt', onclick: () => { sfx.click(); this.app.goHub(); } }, '⟵'));
    const mute = mount(h('button.icon-btn.right', { title: 'Ton an/aus', onclick: () => { setMuted(!isMuted()); mute.textContent = isMuted() ? '🔇' : '🔊'; } }, isMuted() ? '🔇' : '🔊'));
  }

  showIntro() {
    this.state = 'intro';
    this.baseUI();
    const modeBtn = (id, label, sub) => h(`button.cv-modebtn${this.mode === id ? '.on' : ''}`, {
      onclick: () => { sfx.click(); setMode(id); this.mode = getMode(); this.showIntro(); }
    }, [h('b', {}, label), h('small', {}, sub)]);
    mount(h('div.overlay', {}, h('div.card.panel.kr-intro', {}, [
      h('div.kr-introhead', {}, [
        h('div.kr-lordface.big', { html: lordSVG() }),
        h('div', {}, [h('div.kicker', {}, 'Spiel 4 · Bau dir das ideale CRM'), h('h1', {}, 'Das CRM-Königreich')])
      ]),
      h('p.kr-quote', {}, [h('b', {}, 'Lord CRM: '), say(LORD.intro, this.mode)]),
      h('div.legend.kr-legend', {}, [
        h('div', {}, [h('b', {}, '⛏️ Abbauen'), 'SAP-Erz im Westen, Kundendaten-Kristalle im Osten, Leads an den goldenen Bäumen. Einfach antippen.']),
        h('div', {}, [h('b', {}, '🤝 Handeln'), 'Bei Marketing, Sales, Service, Commerce und in der itmX-Schmiede. Legacy-Schrott wird dort umgetauscht.']),
        h('div', {}, [h('b', {}, '🏰 Bauen'), 'Jedes Feature wird ein Block im passenden Turm. Erst das SAP-Fundament, dann wackelt nichts.']),
        h('div', {}, [h('b', {}, '🌙 Verteidigen'), 'Nachts greifen Excel-Zombies & Co. an. Antippen! Hohe Türme schießen mit.'])
      ]),
      h('div.kr-custrow', {}, CUSTOMERS.map((c, i) => h('span.kr-custchip', { style: `--c:${c.color}` }, [h('i', {}, c.icon), h('span', {}, [h('b', {}, `Tag ${i + 1}`), c.branche])]))),
      h('p.kr-warn', {}, ['☁️ ', h('b', {}, RIVAL.name), ' bietet billige Fremd-Blöcke an. Die zählen nur halb und wackeln.']),
      h('div.cv-mode', {}, [
        h('div.kicker', {}, 'Humor-Modus'),
        h('div.cv-modes', {}, [modeBtn('kunde', '🤝 Kunde & Partner', 'höflich und korrekt'), modeBtn('intern', '🌶️ Intern', 'frech, nur unter uns')])
      ]),
      this.best ? h('p', {}, `Dein Rekord: ${fmt(this.best)} Punkte`) : null,
      h('div.row', {}, [h('button.btn.gold', { onclick: () => { unlockAudio(); primeSong(SONG.url); sfx.click(); this.startRun(); } }, '▶ Königreich betreten')])
    ])));
  }

  buildHUD() {
    this.baseUI();
    const stat = (cls, label) => {
      const strong = h('strong', {}, '0');
      const small = h('small', {}, label);
      return { el: h(`div.stat.panel.${cls}`, {}, [small, strong]), strong, small };
    };
    this.hud = { clock: stat('time', 'Tag 1'), score: stat('score', 'Punkte'), blocks: stat('combo', 'Burg') };
    mount(h('div.hud.passthrough.kr-hud', {}, Object.values(this.hud).map((s) => s.el)));
    // Lord CRM speech box
    this.lordText = h('span');
    this.lordEl = mount(h('div.kr-lordbox.passthrough', {}, [h('div.kr-lordface', { html: lordSVG() }), h('div', {}, [h('b', {}, 'Lord CRM'), this.lordText])]));
    // customer card
    this.custEl = mount(h('div.kr-cust.panel', { onclick: () => { if (this.portrait) this.custEl.classList.toggle('open'); } }));
    // inventory + actions
    this.resEls = {};
    const resChips = RES_IDS.map((id) => {
      const n = h('b', {}, '0');
      const el = h('span.kr-res', { style: `--c:${RES[id].color}`, title: `${RES[id].name}: ${RES[id].hint}` }, [h('i', {}, RES[id].icon), n]);
      this.resEls[id] = { el, n };
      return el;
    });
    this.legacyEl = h('span.kr-legacy');
    this.tradeBtn = h('button.kr-tradebtn', { onclick: () => { sfx.click(); if (this.tradeOpen) this.closeTrade(); else this.openTrade(this.lastTrader || 'core', false); } }, [h('span', {}, '🤝'), h('em', {}, 'Handeln')]);
    this.barEl = mount(h('div.kr-bar.panel', {}, [h('div.kr-resrow', {}, [...resChips, this.legacyEl]), this.tradeBtn]));
    // boss bar (reuses the game-3 styles)
    this.bossBar = h('i');
    this.bossEl = mount(h('div.cv-boss.passthrough.kr-boss', {}, [h('b', {}, 'Der Medienbruch'), h('div.cv-bossbar', {}, this.bossBar), h('span.cv-bossline')]));
    this.updateHUD();
    this.renderCustomer();
    this.updateInventory();
  }

  updateHUD() {
    if (!this.hud) return;
    const D = DAYS[this.dayIdx] || DAYS[2];
    const len = this.phase === 'day' ? D.day : D.night;
    const left = Math.max(0, Math.ceil(len - this.phaseT));
    this.hud.clock.small.textContent = this.phase === 'day' ? `☀️ Tag ${this.dayIdx + 1}` : `🌙 Nacht ${this.dayIdx + 1}`;
    this.hud.clock.strong.textContent = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
    this.hud.clock.el.classList.toggle('low', left <= 8 && this.state === 'play');
    this.hud.clock.el.classList.toggle('night', this.phase === 'night');
    this.hud.score.strong.textContent = fmt(this.score);
    const blocks = this.towers.reduce((s, t) => s + t.length, 0) + ['m365', 'ki', 'bi'].filter((id) => this.built.has(id)).length;
    this.hud.blocks.strong.textContent = `🧱 ${blocks}`;
  }

  updateInventory() {
    if (!this.resEls) return;
    for (const id of RES_IDS) {
      const r = this.resEls[id];
      if (r.n.textContent !== String(this.inv[id])) {
        r.n.textContent = String(this.inv[id]);
        r.el.classList.remove('bump'); void r.el.offsetWidth; r.el.classList.add('bump');
      }
    }
    this.legacyEl.replaceChildren(...LEGACY.filter((l) => this.legacy[l.id] > 0).map((l) => h('span.kr-lg', { title: `${l.name} → zur Schmiede bringen` }, [l.icon, this.legacy[l.id] > 1 ? h('small', {}, `×${this.legacy[l.id]}`) : null])));
    this.tradeBtn.classList.toggle('closed', this.phase === 'night');
    this.tradeBtn.querySelector('em').textContent = this.phase === 'night' ? 'Nacht' : 'Handeln';
    if (this.tradeOpen) this.renderTrade();
  }

  /** 0 = open, 0.5 = foreign block, 1 = fulfilled with an itmX block */
  wishState(id) {
    const b = this.built.get(id);
    if (!b) return 0;
    return b.foreign ? 0.5 : 1;
  }

  renderCustomer() {
    if (!this.custEl) return;
    const idx = Math.min(this.dayIdx, CUSTOMERS.length - 1);
    const C = CUSTOMERS[idx];
    const states = C.wishes.map((id) => this.wishState(id));
    const done = states.filter((s) => s > 0).length;
    const rows = C.wishes.map((id, i) => {
      const f = featureById(id);
      const st = states[i];
      return h(`div.kr-wish${st === 1 ? '.ok' : st ? '.half' : ''}`, { style: `--c:${MODULES[f.mod].color}` }, [
        h('i', {}, st === 1 ? '✓' : st ? '½' : f.icon),
        h('span', {}, [h('b', {}, f.name), h('small', {}, `${MODULES[f.mod].name}${f.mod === 'core' ? ' · Schmiede' : ''}`)])
      ]);
    });
    const prev = CUSTOMERS.slice(0, idx).map((c) => {
      const n = c.wishes.filter((id) => this.wishState(id) > 0).length;
      return h('span.kr-prev', { style: `--c:${c.color}` }, `${c.icon} ${n}/5`);
    });
    this.custEl.style.setProperty('--c', C.color);
    this.custEl.classList.toggle('night', this.phase === 'night');
    this.custEl.replaceChildren(
      h('div.kr-custhead', {}, [h('span.kr-custicon', {}, C.icon), h('div', {}, [h('small', {}, `Kunde des Tages · ${C.branche}`), h('b', {}, C.name)]), h('em.kr-count', {}, `${done}/5`)]),
      h('div.kr-wishes', {}, rows),
      ...(prev.length ? [h('div.kr-prevrow', {}, prev)] : [])
    );
  }

  lordSay(pool, ms = 3200) {
    if (!this.lordEl) return;
    this.lordText.textContent = typeof pool === 'string' ? pool : say(pool, this.mode);
    this.lordEl.classList.add('on');
    this.lordWave = 1.2;
    clearTimeout(this.lordTimer);
    this.lordTimer = setTimeout(() => this.lordEl?.classList.remove('on'), ms);
  }

  popup(worldPos, text, cls = 'good') {
    const v = worldPos.clone().project(this.camera);
    if (v.z > 1) return;
    const el = mount(h(`div.popup.${cls}`, {}, text));
    el.style.left = `${clamp((v.x * 0.5 + 0.5) * window.innerWidth, 70, window.innerWidth - 70)}px`;
    el.style.top = `${(-v.y * 0.5 + 0.5) * window.innerHeight}px`;
    setTimeout(() => el.remove(), 950);
  }

  banner(big, small, cls = '') {
    document.querySelector('.fb-banner')?.remove();
    const el = mount(h(`div.fb-banner.passthrough${cls}`, {}, [h('b', {}, big), small ? h('span', {}, small) : null]));
    setTimeout(() => el.remove(), 2400);
  }

  hint(text, ms = 3200) {
    document.querySelector('.kr-hint')?.remove();
    const el = mount(h('div.kr-hint.passthrough', {}, text));
    clearTimeout(this.hintTimer);
    this.hintTimer = setTimeout(() => el.remove(), ms);
  }

  // ================================================================== run flow
  startRun() {
    this.mode = getMode();
    this.resetWorld();
    this.score = 0;
    this.inv = { sap: 3, data: 2, lead: 2 }; // small start budget from the king's treasury
    this.legacy = Object.fromEntries(LEGACY.map((l) => [l.id, 0]));
    this.dayIdx = 0;
    this.phase = 'day';
    this.phaseT = 0;
    this.elapsed = 0;
    this.stats = { mined: 0, kills: 0, lost: 0, held: 0, legacy: 0, foreign: 0, boss: false, verdicts: [] };
    this.tradeOpen = null;
    this.lastTrader = null;
    this.saidWobbly = false;
    this.rivalOffers = [];
    this.spawnJunk(4);
    this.buildHUD();
    this.state = 'countdown';
    music.play('kingdom');
    music.setIntensity(-1);
    const cd = mount(h('div.countdown.passthrough'));
    let n = 3;
    const tick = () => {
      if (this.state !== 'countdown') { cd.remove(); return; }
      cd.replaceChildren(h('span', {}, n > 0 ? String(n) : 'Tag 1!'));
      sfx.beep(n === 0);
      if (n === 0) {
        this.state = 'play';
        this.startDay();
        setTimeout(() => cd.remove(), 800);
        return;
      }
      n--;
      setTimeout(tick, 650);
    };
    tick();
  }

  startDay() {
    this.phase = 'day';
    this.phaseT = 0;
    music.setIntensity(0);
    const C = CUSTOMERS[this.dayIdx];
    this.rollRivalOffers();
    this.renderCustomer();
    this.updateInventory();
    sfx.morning();
    this.banner(`Tag ${this.dayIdx + 1}`, `${C.icon} ${C.name} · ${C.branche}`, '.gold');
    this.lordSay(LORD.dayStart[this.dayIdx], 3000);
    setTimeout(() => { if (this.state === 'play' && this.phase === 'day') this.lordSay(`${C.who}: „${say(C.hello, this.mode)}“`, 5200); }, 3200);
    if (this.dayIdx === 0) setTimeout(() => this.hint('Tipp: Erz, Kristalle oder goldene Bäume antippen. Gezogen wird mit dem Finger, die Kamera dreht sich.', 5200), 900);
  }

  startNight() {
    this.phase = 'night';
    this.phaseT = 0;
    this.closeTrade();
    this.dayVerdict();
    const list = [];
    for (const [type, count] of NIGHTS[this.dayIdx]) for (let i = 0; i < count; i++) list.push(type);
    shuffle(list);
    const bi = list.indexOf('boss');
    if (bi > 0) { list.splice(bi, 1); list.splice(1, 0, 'boss'); }
    this.spawnQueue = list;
    this.spawnTimer = 1.4;
    this.spawnEvery = (DAYS[this.dayIdx].night - 10) / list.length;
    music.setIntensity(NIGHTS[this.dayIdx].some(([t]) => t === 'boss') ? 4 : 3);
    sfx.gong();
    this.banner(`Nacht ${this.dayIdx + 1}`, 'Die Legacy-Monster kommen!', '');
    this.lordSay(LORD.night, 3600);
    this.act = null;
    this.updateInventory();
    this.renderCustomer();
  }

  /** At dusk the customer of the day judges the castle. */
  dayVerdict() {
    const C = CUSTOMERS[this.dayIdx];
    let pts = 0, full = 0;
    for (const id of C.wishes) {
      const s = this.wishState(id);
      if (s === 1) { pts += PTS.wish; full++; } else if (s) pts += PTS.wish / 2;
    }
    const happy = full === C.wishes.length;
    if (happy) pts += PTS.happy;
    this.score += pts;
    this.stats.verdicts.push({ id: C.id, full, part: C.wishes.filter((id) => this.wishState(id) === 0.5).length, pts });
    const done = C.wishes.filter((id) => this.wishState(id) > 0).length;
    this.banner(happy ? 'Kunde begeistert!' : `${done}/5 Wünsche erfüllt`, `${C.icon} ${C.name} · +${fmt(pts)} Punkte`, happy ? '.extra' : '.gold');
    if (happy) { this.lordSay(LORD.customerHappy, 3000); sfx.fanfare(); } else this.lordSay(LORD.dusk, 3000);
    this.updateHUD();
  }

  endDayCycle() {
    // dawn: remaining monsters flee
    for (const m of [...this.monsters]) { this.debris.burst(m.group.position.clone().add(new THREE.Vector3(0, 1, 0)), MON_COLORS[m.type], 8); this.removeMonster(m); }
    this.monsters.length = 0;
    this.bossEl?.classList.remove('on');
    if (this.dayIdx >= DAYS.length - 1) { this.endGame(); return; }
    this.dayIdx++;
    this.spawnJunk(2);
    this.lordSay(LORD.dawn, 2400);
    this.startDay();
  }

  endGame() {
    if (this.state !== 'play') return;
    this.state = 'over';
    this.closeTrade();
    this.act = null;
    this.walk = null;
    this.bossEl?.classList.remove('on');
    for (const m of [...this.monsters]) { this.debris.burst(m.group.position.clone().add(new THREE.Vector3(0, 1, 0)), MON_COLORS[m.type], 10); this.removeMonster(m); }
    this.monsters.length = 0;
    for (const p of this.projectiles) this.scene.remove(p.mesh);
    this.projectiles.length = 0;
    // final evaluation
    const wishes = CUSTOMERS.flatMap((c) => c.wishes);
    let wishPts = 0, wishDone = 0;
    for (const id of wishes) { const s = this.wishState(id); wishPts += s * 120; wishDone += s; }
    const fundaments = this.towers.filter((t) => t.some((e) => e.f.id === 'fundament')).length;
    const pillars = this.towers.map((t) => t.filter((e) => e.f.id !== 'fundament').length);
    const foreign = [...this.built.values()].filter((b) => b.foreign).length;
    const bonus = [];
    bonus.push(['Bauplan aller Kunden', Math.round(wishPts)]);
    if (fundaments === 4) bonus.push(['SAP-Fundament unter allen Türmen', PTS.fundamentAll]);
    if (pillars.every((n) => n >= 3)) bonus.push(['Alle vier Säulen stark', PTS.pillars]);
    if (foreign === 0 && this.built.size > 0) bonus.push(['100 % itmX, keine Fremd-Blöcke', PTS.pure]);
    for (const [, p] of bonus) this.score += p;
    this.final = { wishes: wishes.length, wishDone, fundaments, pillars, foreign, bonus };
    if (this.score > this.best) { this.best = this.score; storeSet('crm-best', this.best); }
    this.updateHUD();
    sfx.fanfare();
    music.playSong(SONG.url, { restart: true });
    this.banner('Das Königreich steht!', `${fmt(this.score)} Punkte`, '.extra');
    for (const el of ['.kr-bar', '.kr-cust', '.kr-trade']) document.querySelector(el)?.remove();
    setTimeout(() => this.showResults(), 2600);
  }

  showResults() {
    if (this.state !== 'over') return;
    const rank = rankFor(this.score);
    const F = this.final;
    const bauplan = Math.round((F.wishDone / F.wishes) * 100);
    const stats = {
      score: this.score, rank: rank.id, rankName: rank.name, title: rank.title, line: rank.line,
      bauplan, pillars: F.pillars, fundaments: F.fundaments, kills: this.stats.kills, foreign: F.foreign, boss: this.stats.boss,
      customers: CUSTOMERS.map((c) => ({ name: c.name, icon: c.icon, n: c.wishes.filter((id) => this.wishState(id) > 0).length }))
    };
    const seen = {
      sap: F.fundaments > 0, '360': this.built.has('kontakt'), mkt: F.pillars[0] > 0, sal: F.pillars[1] > 0, svc: F.pillars[2] > 0, com: F.pillars[3] > 0,
      m365: this.built.has('m365'), ki: this.built.has('ki') || this.built.has('voice'), legacy: this.stats.legacy > 0, branchen: true
    };
    const cards = [...LEARN].sort((a, b) => Number(seen[b.id]) - Number(seen[a.id])).map((c) => h(`div.cv-learn${seen[c.id] ? '.seen' : ''}`, {}, [
      h('span.cv-licon', {}, c.icon),
      h('div', {}, [
        h('b', {}, c.title), seen[c.id] ? h('small', {}, 'heute gebaut') : null, h('p', {}, c.text),
        c.video ? h('a.kr-vid', { href: `https://www.youtube.com/watch?v=${c.video}`, target: '_blank', rel: 'noopener' }, '▶ Video auf YouTube') : null
      ])
    ]));
    const towerRow = TOWER_MODS.map((m, i) => h('div', { style: `--c:${MODULES[m].color}` }, [h('b', {}, String(F.pillars[i])), MODULES[m].name]));
    mount(h('div.overlay', {}, h('div.card.panel.cv-result.kr-result', {}, [
      songChip(),
      h('div.kicker', {}, 'Drei Tage, drei Nächte · Das Königreich steht'),
      h('h1', {}, `${fmt(this.score)} Punkte`),
      h('div', {}, h(`span.rank.${rank.id}`, {}, `${rank.name} · ${rank.title}`)),
      h('p', {}, rank.line),
      h('div.kr-towers', {}, towerRow),
      h('div.kr-custres', {}, stats.customers.map((c, i) => h('div', {}, [
        h('span', {}, `${c.icon} ${c.name}`),
        h('div.kr-meter', {}, h('i', { style: `width:${c.n * 20}%;background:${CUSTOMERS[i].color}` })),
        h('b', {}, `${c.n}/5`)
      ]))),
      h('div.fb-buzz', {}, [
        h('div', {}, [h('b', {}, `${bauplan} %`), 'Bauplan']),
        h('div', {}, [h('b', {}, `${F.fundaments}/4`), 'SAP-Fundament']),
        h('div', {}, [h('b', {}, String(this.stats.kills)), 'Monster besiegt']),
        h('div', {}, [h('b', {}, String(this.stats.lost)), 'Blöcke geklaut'])
      ]),
      h('div.kr-bonus', {}, F.bonus.map(([t, p]) => h('div', {}, [h('span', {}, t), h('b', {}, `+${fmt(p)}`)]))),
      h('p.fb-note', {}, `${this.stats.legacy} Altlasten entsorgt, ${F.foreign} Fremd-${F.foreign === 1 ? 'Block' : 'Blöcke'} von Cloudius verbaut${this.stats.boss ? ', der Medienbruch ist besiegt.' : '.'}`),
      h('div.kicker', {}, 'Das steckt dahinter'),
      h('div.cv-learns', {}, cards),
      h('div.row', {}, [
        h('button.btn.gold', { onclick: () => { sfx.click(); music.playSong(SONG.url); this.app.showScene('crm-finale', (a) => new KoenigreichFinale(a), { ...stats, mode: this.mode }); } }, '👑 Ritterschlag bei Lord CRM'),
        h('button.btn.secondary', { onclick: () => { sfx.click(); this.startRun(); } }, '↻ Neues Königreich')
      ])
    ])));
  }

  // ================================================================== island content
  spawnJunk(n) {
    const used = new Set(this.junk.filter((j) => j.alive).map((j) => j.spot));
    const free = shuffle(LEGACY_SPOTS.map((_, i) => i).filter((i) => !used.has(i)));
    for (let k = 0; k < n && k < free.length; k++) {
      const spot = free[k];
      const L = pick(LEGACY);
      const grp = buildLegacy(L.id);
      const [x, z] = LEGACY_SPOTS[spot];
      grp.position.set(x, 0, z);
      grp.rotation.y = Math.random() * Math.PI * 2;
      this.scene.add(grp);
      const j = { id: L.id, group: grp, pos: new THREE.Vector3(x, 0, z), hp: 2, alive: true, spot, pop: 0 };
      grp.traverse((o) => { if (o.isMesh) o.userData.junk = j; });
      grp.scale.setScalar(0.01);
      this.junk.push(j);
    }
  }

  reviveNode(n, instant = false) {
    n.alive = true;
    n.hp = n.maxHp;
    n.respawn = 0;
    n.grow = instant ? 1 : 0;
    n.group.scale.setScalar(instant ? 1 : 0.01);
    n.group.visible = true;
    if (n.kind === 'lead') { n.fruitsLeft = n.fruits.length; for (const f of n.fruits) f.visible = true; n.group.scale.setScalar(1); n.grow = 1; }
  }

  rollRivalOffers() {
    const C = CUSTOMERS[this.dayIdx];
    const want = C.wishes.filter((id) => !this.built.has(id) && featureById(id).mod !== 'core');
    const rest = shuffle(FEATURES.filter((f) => f.mod !== 'core' && !this.built.has(f.id) && !want.includes(f.id)).map((f) => f.id));
    this.rivalOffers = [...shuffle(want).slice(0, 3), ...rest].slice(0, 4);
  }

  // ================================================================== trading
  canAfford(cost) { return Object.entries(cost).every(([k, v]) => this.inv[k] >= v); }
  spend(cost) { for (const [k, v] of Object.entries(cost)) this.inv[k] -= v; }

  openTrade(id, walkThere = true) {
    if (this.state !== 'play') return;
    if (this.phase === 'night') { this.hint('Nachts haben die Händler geschlossen. Verteidige die Burg!'); sfx.error(); return; }
    this.tradeOpen = id;
    this.lastTrader = id;
    const T = id === 'rival' ? RIVAL : traderById(id);
    this.tradeHello = say(T.hello, this.mode);
    if (walkThere) {
      const target = id === 'rival' ? new THREE.Vector3(12.4, 0, -1.2) : STALLS[id].pos.clone().add(new THREE.Vector3(0, 0, 2.2).applyAxisAngle(new THREE.Vector3(0, 1, 0), STALLS[id].rot));
      this.walkTo(target, 0.3);
    }
    this.traderNod = { id, t: 0 };
    sfx.pop();
    this.renderTrade();
  }

  closeTrade() {
    this.tradeOpen = null;
    document.querySelector('.kr-trade')?.remove();
    this.tradeBtn?.classList.remove('on');
    this.custEl?.classList.remove('behind');
  }

  renderTrade() {
    const id = this.tradeOpen;
    if (!id) return;
    document.querySelector('.kr-trade')?.remove();
    this.tradeBtn?.classList.add('on');
    this.custEl?.classList.add('behind');
    const isRival = id === 'rival';
    const T = isRival ? null : traderById(id);
    const col = isRival ? '#b8bfd6' : MODULES[T.mod].color;
    const wishes = new Set(CUSTOMERS[this.dayIdx].wishes);
    const allWishes = new Set(CUSTOMERS.slice(0, this.dayIdx + 1).flatMap((c) => c.wishes));
    const costChips = (cost, extra = null) => h('span.kr-cost', {}, [
      extra,
      ...Object.entries(cost).map(([k, v]) => h(`span.kr-c${this.inv[k] >= v ? '' : '.no'}`, { style: `--c:${RES[k].color}` }, `${v}${RES[k].icon}`))
    ]);
    const rows = [];
    const featureRow = (f, foreign = false) => {
      const isBuilt = this.built.has(f.id) && f.id !== 'fundament';
      const cost = foreign ? this.rivalCost(f) : f.cost;
      const fundLeft = f.id === 'fundament' ? 4 - this.towers.filter((t) => t.some((e) => e.f.id === 'fundament')).length : 0;
      const done = isBuilt || (f.id === 'fundament' && fundLeft <= 0);
      const ok = !done && this.canAfford(cost);
      const wished = wishes.has(f.id) ? 'heute' : allWishes.has(f.id) ? 'Kunde' : null;
      return h(`div.kr-offer${done ? '.done' : ''}${foreign ? '.foreign' : ''}`, { style: `--c:${foreign ? '#b8bfd6' : MODULES[f.mod].color}` }, [
        h('span.kr-oico', {}, f.icon),
        h('div.kr-otext', {}, [
          h('b', {}, [f.name, wished ? h('em.kr-want', {}, wished === 'heute' ? '★ Kundenwunsch' : '☆ Wunsch') : null, f.id === 'fundament' ? h('em.kr-want.blue', {}, `${4 - fundLeft}/4`) : null]),
          h('small', {}, foreign ? RIVAL.warn : f.desc)
        ]),
        done ? h('span.kr-built', {}, '✓ gebaut') : h('button.kr-buy', { ...(ok ? {} : { disabled: '' }), onclick: (e) => { e.stopPropagation(); this.buy(f, foreign); } }, [costChips(cost), h('span', {}, 'Bauen')])
      ]);
    };
    if (isRival) {
      for (const fid of this.rivalOffers) { const f = featureById(fid); if (f) rows.push(featureRow(f, true)); }
      if (!rows.length) rows.push(h('p.kr-empty', {}, 'Ausverkauft. Cloudius hat schon alles verkauft. Zweimal.'));
    } else {
      if (T.swap) {
        const ok = this.canAfford(T.swap.give);
        rows.push(h('div.kr-offer.swap', { style: `--c:${col}` }, [
          h('span.kr-oico', {}, '🔄'),
          h('div.kr-otext', {}, [h('b', {}, 'Tauschen'), h('small', {}, `${costText(T.swap.give)} gegen ${costText(T.swap.get)}`)]),
          h('button.kr-buy', { ...(ok ? {} : { disabled: '' }), onclick: (e) => { e.stopPropagation(); this.swap(T.swap); } }, [costChips(T.swap.give), h('span', {}, 'Tauschen')])
        ]));
      }
      if (id === 'core') {
        for (const L of LEGACY) {
          const have = this.legacy[L.id] > 0;
          const target = featureById(L.to);
          const targetDone = this.built.has(L.to) && L.to !== 'fundament' || (L.to === 'fundament' && this.towers.every((t) => t.some((e) => e.f.id === 'fundament')));
          if (!have) continue;
          const ok = this.canAfford(L.extra);
          rows.push(h('div.kr-offer.legacy', { style: `--c:${L.color}` }, [
            h('span.kr-oico', {}, L.icon),
            h('div.kr-otext', {}, [
              h('b', {}, targetDone ? `${L.name} einschmelzen` : `${L.name} → ${target.name}`),
              h('small', {}, targetDone ? `Schon gebaut. Xaver schmilzt es ein: +2${RES.sap.icon}` : L.line)
            ]),
            h('button.kr-buy', { ...(ok || targetDone ? {} : { disabled: '' }), onclick: (e) => { e.stopPropagation(); this.tradeLegacy(L, targetDone); } }, [costChips(targetDone ? {} : L.extra, h('span.kr-c', {}, L.icon)), h('span', {}, 'Umtauschen')])
          ]));
        }
      }
      for (const f of FEATURES.filter((x) => x.mod === T.mod)) rows.push(featureRow(f));
    }
    const tabs = [...TRADERS.map((t) => ({ id: t.id, label: t.id === 'core' ? 'Schmiede' : MODULES[t.mod].name, col: MODULES[t.mod].color })), { id: 'rival', label: '☁ Cloudius', col: '#b8bfd6' }];
    const panel = h('div.kr-trade.panel', { style: `--c:${col}` }, [
      h('div.kr-tabs', {}, tabs.map((t) => h(`button.kr-tab${t.id === id ? '.on' : ''}`, { style: `--c:${t.col}`, onclick: (e) => { e.stopPropagation(); sfx.click(); this.openTrade(t.id, false); } }, t.label))),
      h('div.kr-thead', {}, [
        h('div', {}, [h('b', {}, isRival ? RIVAL.name : T.name), h('small', {}, isRival ? RIVAL.role : T.role)]),
        h('button.kr-close', { title: 'Schließen', onclick: (e) => { e.stopPropagation(); sfx.click(); this.closeTrade(); } }, '✕')
      ]),
      h('p.kr-hello', {}, `„${this.tradeHello}“`),
      h('div.kr-offers', {}, rows)
    ]);
    // keep the scroll position when re-rendering
    const old = this.tradeScroll || 0;
    mount(panel);
    const list = panel.querySelector('.kr-offers');
    if (this.tradeScrollId === id) list.scrollTop = old;
    this.tradeScrollId = id;
    list.addEventListener('scroll', () => { this.tradeScroll = list.scrollTop; }, { passive: true });
  }

  rivalCost(f) {
    const [k] = Object.keys(f.cost);
    return { [k]: 1 };
  }

  swap(sw) {
    if (!this.canAfford(sw.give)) return;
    this.spend(sw.give);
    for (const [k, v] of Object.entries(sw.get)) this.inv[k] += v;
    sfx.coin(1);
    this.updateInventory();
  }

  tradeLegacy(L, melt) {
    if (this.legacy[L.id] <= 0) return;
    if (melt) {
      this.legacy[L.id]--;
      this.inv.sap += 2;
      sfx.coin(2);
      this.forgeBurst();
      this.updateInventory();
      return;
    }
    if (!this.canAfford(L.extra)) return;
    this.legacy[L.id]--;
    this.spend(L.extra);
    this.forgeBurst();
    this.lordSay(L.line, 3400);
    this.build(featureById(L.to), false, STALLS.core.pos.clone().add(new THREE.Vector3(0, 2.5, 0)));
  }

  forgeBurst() {
    const p = STALLS.core.pos.clone().add(new THREE.Vector3(0, 1, 0.6));
    this.effects.sparks(p, 0xff8a2a, 30);
    this.effects.flash(p, 0xff8a2a, 40);
    sfx.mine(0);
  }

  buy(f, foreign) {
    const cost = foreign ? this.rivalCost(f) : f.cost;
    if (!this.canAfford(cost)) { this.lordSay(LORD.poor, 2400); sfx.error(); return; }
    if (this.built.has(f.id) && f.id !== 'fundament') return;
    this.spend(cost);
    sfx.coin(0);
    const from = foreign ? RIVAL_POS.clone().add(new THREE.Vector3(0, 1.5, 0)) : STALLS[MODULES[f.mod].tower >= 0 ? f.mod : 'core'].pos.clone().add(new THREE.Vector3(0, 2.6, 0.5));
    if (foreign) { this.rivalOffers = this.rivalOffers.filter((x) => x !== f.id); this.stats.foreign++; this.lordSay(LORD.foreign, 3000); }
    this.build(f, foreign, from);
  }

  // ================================================================== building
  build(f, foreign, from) {
    if (f.id === 'fundament') {
      const free = this.towers.map((t, i) => ({ i, n: t.length, has: t.some((e) => e.f.id === 'fundament') })).filter((x) => !x.has);
      if (!free.length) { this.inv.sap += 2; this.updateInventory(); return; }
      free.sort((a, b) => b.n - a.n);
      const t = free[0].i;
      const mesh = buildFeatureBlock(f, false);
      this.scene.add(mesh);
      const entry = { f, foreign: false, mesh, landed: false, wob: 0 };
      this.towers[t].unshift(entry);
      for (const e of this.towers[t]) e.wobbly = false;
      this.fly(mesh, from, this.world.towerSlot(t, 0), () => this.landed(entry, t));
      this.markBuilt(f, false);
      return;
    }
    if (f.mod === 'core') {
      const mesh = buildFeatureBlock(f, foreign);
      this.scene.add(mesh);
      const to = CASTLE.clone().add(new THREE.Vector3(0, 4.4, 0));
      this.markBuilt(f, foreign);
      this.fly(mesh, from, to, () => {
        this.scene.remove(mesh);
        this.coreBuilt(f);
      });
      return;
    }
    const t = MODULES[f.mod].tower;
    const st = this.towers[t];
    const mesh = buildFeatureBlock(f, foreign);
    this.scene.add(mesh);
    const hasF = st.some((e) => e.f.id === 'fundament');
    const entry = { f, foreign, mesh, landed: false, wobbly: foreign || !hasF, wob: 0 };
    st.push(entry);
    this.markBuilt(f, foreign);
    this.fly(mesh, from, this.world.towerSlot(t, st.length - 1), () => this.landed(entry, t));
  }

  markBuilt(f, foreign) {
    if (f.id !== 'fundament') this.built.set(f.id, { foreign });
    this.renderCustomer();
    this.updateInventory();
    this.updateHUD();
  }

  fly(mesh, from, to, done) {
    mesh.position.copy(from);
    this.flying.push({ mesh, from: from.clone(), to, t: 0, dur: 0.75 + from.distanceTo(to) * 0.025, done });
    sfx.whoosh();
  }

  landed(entry, t) {
    entry.landed = true;
    const pos = entry.mesh.position.clone();
    sfx.place();
    this.effects.shockwave(new THREE.Vector3(pos.x, pos.y - BLOCK / 2 + 0.05, pos.z), entry.foreign ? 0xb8bfd6 : new THREE.Color(MODULES[entry.f.mod].color).getHex());
    this.debris.burst(pos.clone().add(new THREE.Vector3(0, -0.4, 0)), [0xd8c7a0, 0xb49a6c, new THREE.Color(entry.foreign ? '#b8bfd6' : MODULES[entry.f.mod].color).getHex()], 14, { speed: 3, up: 4 });
    this.effects.shake = Math.max(this.effects.shake, 0.35);
    this.score += PTS.build;
    this.popup(pos.clone().add(new THREE.Vector3(0, 1, 0)), `+${PTS.build}`, 'good');
    const isWish = CUSTOMERS.some((c) => c.wishes.includes(entry.f.id));
    if (isWish) {
      setTimeout(() => { this.popup(pos.clone().add(new THREE.Vector3(0, 1.8, 0)), entry.foreign ? '½ Wunsch' : '★ Wunsch erfüllt!', 'combo'); sfx.chime(); }, 250);
      this.effects.sparks(pos, 0xffcc4d, 30);
    }
    if (entry.f.id === 'fundament') this.lordSay(LORD.fundament, 3000);
    else if (entry.wobbly && !entry.foreign && !this.saidWobbly) { this.saidWobbly = true; this.lordSay(LORD.wobbly, 3200); }
    else if (!entry.foreign && Math.random() < 0.45) this.lordSay(LORD.built, 2200);
    this.lordCheer = 1;
    this.updateHUD();
  }

  coreBuilt(f) {
    const top = CASTLE.clone().add(new THREE.Vector3(0, 4.4, 0));
    sfx.place();
    this.effects.shockwave(top, 0x50af30);
    this.effects.sparks(top, 0x9b4dff, 40);
    this.effects.flash(top, 0x50af30, 60);
    this.score += PTS.build;
    this.popup(top, `+${PTS.build}`, 'good');
    if (f.id === 'm365') { for (const b of this.world.bridges) { b.visible = true; b.scale.set(1, 1, 0.01); } this.bridgeGrow = 0; }
    if (f.id === 'ki') { this.world.kiCrystal.visible = true; this.world.kiLight.intensity = 12; }
    if (f.id === 'bi') { this.world.biBanner.visible = true; this.world.biBanner2.visible = true; }
    if (CUSTOMERS.some((c) => c.wishes.includes(f.id))) setTimeout(() => { this.popup(top.clone().add(new THREE.Vector3(0, 1, 0)), '★ Wunsch erfüllt!', 'combo'); sfx.chime(); }, 250);
    this.lordSay(LORD.built, 2200);
    this.lordCheer = 1;
    this.updateHUD();
  }

  /** A monster takes the top block of a tower. Returns 'stolen' | 'held' | 'none'. */
  stealFrom(t) {
    const st = this.towers[t];
    let idx = -1;
    for (let i = st.length - 1; i >= 0; i--) if (st[i].f.id !== 'fundament' && st[i].landed) { idx = i; break; }
    if (idx < 0) return 'none';
    const e = st[idx];
    const hasF = st.some((x) => x.f.id === 'fundament');
    if (hasF && !e.foreign && Math.random() < 0.45) return 'held';
    st.splice(idx, 1);
    this.built.delete(e.f.id);
    const dir = new THREE.Vector3(e.mesh.position.x, 0, e.mesh.position.z).normalize();
    this.falling.push({ mesh: e.mesh, v: new THREE.Vector3(dir.x * 6 + rand(-1, 1), 7, dir.z * 6 + rand(-1, 1)), w: new THREE.Vector3(rand(-6, 6), rand(-6, 6), rand(-6, 6)), t: 0 });
    this.score += PTS.lost;
    this.stats.lost++;
    this.renderCustomer();
    this.updateHUD();
    return 'stolen';
  }

  // ================================================================== mining
  walkTo(target, stop = 0.2, then = null) {
    this.walk = { to: target.clone().setY(0), stop, then };
    this.act = null;
  }

  tapNode(n) {
    if (!n.alive || n.grow < 1) return;
    this.walkTo(n.pos, n.kind === 'lead' ? 1.9 : 1.25, () => { this.act = { node: n, t: 0, hits: 0 }; });
  }

  tapJunk(j) {
    if (!j.alive) return;
    this.walkTo(j.pos, 1.25, () => { this.act = { junk: j, t: 0, hits: 0 }; });
  }

  hitTarget() {
    const A = this.act;
    if (!A) return;
    if (A.junk) {
      const j = A.junk;
      if (!j.alive) { this.act = null; return; }
      j.hp--;
      j.shake = 0.25;
      sfx.mine(0);
      const L = legacyById(j.id);
      this.debris.burst(j.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), [new THREE.Color(L.color).getHex(), 0xffffff], 6, { speed: 2.5, up: 4 });
      if (j.hp <= 0) {
        j.alive = false;
        this.scene.remove(j.group);
        this.debris.burst(j.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), [new THREE.Color(L.color).getHex(), 0xffffff, 0xdddddd], 26, { speed: 4, up: 7 });
        this.effects.sparks(j.pos.clone().add(new THREE.Vector3(0, 0.6, 0)), 0xffffff, 20);
        sfx.smash(1.2);
        this.legacy[j.id]++;
        this.stats.legacy++;
        this.score += PTS.legacy;
        this.popup(j.pos.clone().add(new THREE.Vector3(0, 1.4, 0)), `${L.icon} ${L.name}`, 'combo');
        if (this.stats.legacy === 1 || Math.random() < 0.4) this.lordSay(LORD.legacy, 3000);
        this.updateInventory();
        this.act = null;
      }
      return;
    }
    const n = A.node;
    if (!n.alive) { this.act = null; return; }
    n.hp--;
    n.shake = 0.22;
    const top = n.pos.clone().add(new THREE.Vector3(0, n.kind === 'lead' ? 3 : 0.8, 0));
    if (n.kind === 'lead') {
      // shake the tree, two golden leads drop
      sfx.rustle(0.8);
      let got = 0;
      for (const f of n.fruits) if (f.visible && got < 2) { f.visible = false; got++; n.fruitsLeft--; const wp = new THREE.Vector3(); f.getWorldPosition(wp); this.debris.burst(wp, [0xffcc33, 0xffe680], 5, { speed: 1.5, up: 2 }); }
      this.gain('lead', got, top);
      sfx.fruit();
      if (n.fruitsLeft <= 0) { n.alive = false; n.respawn = 15; }
      n.hp = n.maxHp;
      this.act = null;
      return;
    }
    sfx.mine(clamp(n.pos.x / 14, -1, 1));
    const cols = n.kind === 'sap' ? [0x7d8590, 0x3d8bff, 0x8fc0ff] : [0x3ddc84, 0xa8ffc8, 0x7d8590];
    this.debris.burst(top, cols, 6, { speed: 2.5, up: 4 });
    this.effects.sparks(top, n.kind === 'sap' ? 0x8fc0ff : 0x7dffb0, 8);
    if (n.hp <= 0) {
      n.alive = false;
      n.respawn = 14;
      n.shrink = 1;
      this.debris.burst(top, cols, 22, { speed: 4, up: 6 });
      this.effects.flash(top, n.kind === 'sap' ? 0x3d8bff : 0x3ddc84, 30);
      sfx.smash(n.kind === 'sap' ? 1.1 : 1.5);
      this.gain(n.kind, 2, top);
      this.act = null;
    }
  }

  gain(kind, n, from) {
    if (n <= 0) return;
    this.inv[kind] += n;
    this.stats.mined += n;
    this.score += PTS.mine * n;
    this.popup(from.clone().add(new THREE.Vector3(0, 0.6, 0)), `+${n} ${RES[kind].icon}`, 'good');
    // little cubes fly to the player
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.28, 0.28), new THREE.MeshBasicMaterial({ color: new THREE.Color(RES[kind].color).multiplyScalar(2), toneMapped: false }));
      this.scene.add(m);
      this.flying.push({ mesh: m, from: from.clone().add(new THREE.Vector3(rand(-0.3, 0.3), 0, rand(-0.3, 0.3))), to: null, follow: true, t: -i * 0.08, dur: 0.5, done: () => { this.scene.remove(m); m.geometry.dispose(); m.material.dispose(); sfx.coin(i); } });
    }
    this.updateInventory();
    this.updateHUD();
  }

  // ================================================================== night: monsters
  spawnMonster(type) {
    const def = MONSTERS[type];
    const parts = buildMonster(type);
    const a = Math.random() * Math.PI * 2;
    const r = R - 1.2;
    const pos = new THREE.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r);
    // keep them away from the rival's cloud (east) a bit
    parts.group.position.copy(pos).setY(-2.5);
    this.scene.add(parts.group);
    const hit = new THREE.Mesh(new THREE.BoxGeometry(1.6 * def.size, 2.4 * def.size, 1.6 * def.size), new THREE.MeshBasicMaterial({ visible: false }));
    hit.position.y = 1.2 * def.size;
    parts.group.add(hit);
    const m = { type, def, ...parts, hit, pos, hp: def.hp, max: def.hp, state: 'rise', t: 0, hitT: 0, ph: Math.random() * 6, talk: null };
    parts.group.traverse((o) => { if (o.isMesh) o.userData.monster = m; });
    this.monsters.push(m);
    this.pickTarget(m);
    if (def.boss || Math.random() < 0.35) this.monsterSay(m, say(def.lines, this.mode));
    if (def.boss) {
      sfx.roar(true);
      this.lordSay(LORD.boss, 3200);
      this.effects.shake = 1.2;
      this.bossEl.classList.add('on');
      this.bossEl.querySelector('.cv-bossline').textContent = say(def.lines, this.mode);
      this.updateBossBar(m);
    } else if (Math.random() < 0.4) sfx.roar(false);
  }

  monsterSay(m, text) {
    if (m.talk) { m.group.remove(m.talk); m.talk.material.map.dispose(); m.talk.material.dispose(); }
    const sp = textSprite(text, { color: '#ffe0e0', bg: 'rgba(40,6,12,0.85)', size: 40, border: '#ff3b5c' });
    sp.position.y = (m.def.boss ? 4.8 : 2.8 * m.def.size) / 1;
    m.group.add(sp);
    m.talk = sp;
    m.talkT = 2.4;
  }

  updateBossBar(m) {
    this.bossBar.style.transform = `scaleX(${clamp(m.hp / m.max, 0, 1)})`;
  }

  pickTarget(m) {
    // foreign blocks attract monsters, otherwise the nearest tower with blocks, else the keep
    const p = m.group.position;
    let best = -1, bd = Infinity;
    const foreignTowers = this.towers.map((t, i) => (t.some((e) => e.foreign) ? i : -1)).filter((i) => i >= 0);
    const cands = foreignTowers.length && Math.random() < 0.75 ? foreignTowers : this.towers.map((t, i) => (t.some((e) => e.f.id !== 'fundament') ? i : -1)).filter((i) => i >= 0);
    for (const i of cands) { const d = TOWERS[i].distanceTo(p); if (d < bd) { bd = d; best = i; } }
    m.target = best;
    const base = best >= 0 ? TOWERS[best] : CASTLE;
    const dir = p.clone().sub(base).setY(0).normalize();
    m.goal = base.clone().addScaledVector(dir, (best >= 0 ? 1.0 : 1.9) + m.def.size * 0.5).setY(0);
  }

  damage(m, dmg, color = 0xffffff) {
    if (m.state === 'dying' || m.state === 'gone') return;
    m.hp -= dmg;
    m.hitT = 0.16;
    const hp = m.group.position.clone().add(new THREE.Vector3(0, m.hitY || 1.2, 0));
    this.effects.sparks(hp, color, 10);
    this.debris.burst(hp, MON_COLORS[m.type], 4, { speed: 2.5, up: 3 });
    if (m.def.boss) this.updateBossBar(m);
    if (m.hp <= 0) this.killMonster(m);
  }

  killMonster(m) {
    m.state = 'dying';
    m.t = 0;
    const p = m.group.position.clone().add(new THREE.Vector3(0, m.hitY || 1.2, 0));
    this.debris.burst(p, MON_COLORS[m.type], m.def.boss ? 90 : 20 + m.def.size * 8, { speed: m.def.boss ? 8 : 4.5, up: m.def.boss ? 11 : 7, size: m.def.boss ? 1.8 : 1.1, life: m.def.boss ? 2.2 : 1.3 });
    this.effects.shockwave(p.clone().setY(0.1), m.def.boss ? 0xff3b2a : 0xffffff);
    this.effects.flash(p, m.def.boss ? 0xff7a2a : 0xffffff, m.def.boss ? 120 : 30);
    this.score += m.def.pts;
    this.stats.kills++;
    this.popup(p, `+${m.def.pts}`, m.def.boss ? 'combo' : 'good');
    if (m.def.boss) {
      sfx.smash(0.6); sfx.fanfare();
      this.stats.boss = true;
      this.effects.shake = 2;
      this.hitStop = 0.25;
      this.bossEl.classList.remove('on');
      this.banner('MEDIENBRUCH BESIEGT!', `+${fmt(m.def.pts)} Punkte`, '.extra');
      this.lordSay(LORD.bossDown, 3400);
    } else sfx.smash(m.type === 'silo' ? 0.7 : 1.3, clamp(p.x / 14, -1, 1));
  }

  removeMonster(m) {
    this.scene.remove(m.group);
    m.group.traverse((o) => { if (o.isSprite) { o.material.map?.dispose(); o.material.dispose(); } });
    m.state = 'gone';
  }

  /** Lightning bolt between two points (KI crystal, player tap). */
  bolt(from, to, color) {
    const len = from.distanceTo(to);
    const segs = 6;
    const grp = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(3), toneMapped: false, transparent: true });
    let a = from.clone();
    for (let i = 1; i <= segs; i++) {
      const b = from.clone().lerp(to, i / segs);
      if (i < segs) b.add(new THREE.Vector3(rand(-0.35, 0.35), rand(-0.35, 0.35), rand(-0.35, 0.35)));
      const s = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.09, a.distanceTo(b)), mat);
      s.position.copy(a).lerp(b, 0.5);
      s.lookAt(b);
      grp.add(s);
      a = b;
    }
    void len;
    this.scene.add(grp);
    this.bolts.push({ mesh: grp, mat, t: 0 });
  }

  fireTower(t, m) {
    const st = this.towers[t];
    const from = this.world.towerSlot(t, Math.max(0, st.length - 1)).add(new THREE.Vector3(0, BLOCK * 0.7, 0));
    const col = new THREE.Color(MODULES[TOWER_MODS[t]].color);
    const mesh = new THREE.Mesh(this.projGeo || (this.projGeo = new THREE.BoxGeometry(0.3, 0.3, 0.3)), this.projMat(t, col));
    mesh.position.copy(from);
    this.scene.add(mesh);
    this.projectiles.push({ mesh, target: m, speed: 17, col: col.getHex() });
  }

  projMat(t, col) {
    this.projMats ||= [];
    return (this.projMats[t] ||= new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(3), toneMapped: false }));
  }

  // ================================================================== input
  setRay(e) {
    const r = this.app.gfx.renderer.domElement.getBoundingClientRect();
    this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);
  }

  onDown(e) {
    this.drag = { x: e.clientX, y: e.clientY, id: e.pointerId, moved: false, az: this.camAz, el: this.camEl };
  }

  onMove(e) {
    const D = this.drag;
    if (!D || D.id !== e.pointerId) return;
    const dx = e.clientX - D.x, dy = e.clientY - D.y;
    if (!D.moved && Math.hypot(dx, dy) > 12) D.moved = true;
    if (D.moved) {
      this.camAz = D.az - dx * 0.0065;
      this.camEl = clamp(D.el + dy * 0.004, 0.42, 1.3);
    }
  }

  onUp(e) {
    const D = this.drag;
    this.drag = null;
    if (!D || D.id !== e.pointerId || D.moved) return;
    if (e.target !== this.app.gfx.renderer.domElement) return;
    this.tap(e);
  }

  onWheel(e) { this.zoom = clamp(this.zoom + e.deltaY * 0.0008, 0.65, 1.35); }

  tap(e) {
    if (this.state !== 'play') return;
    this.setRay(e);
    // night: generous screen-space hit test for monsters
    if (this.phase === 'night' && this.monsters.length) {
      let best = null, bd = this.portrait ? 70 : 85;
      const v = new THREE.Vector3();
      for (const m of this.monsters) {
        if (m.state === 'dying' || m.state === 'gone') continue;
        v.copy(m.group.position).add(new THREE.Vector3(0, (m.hitY || 1.2), 0)).project(this.camera);
        const sx = (v.x * 0.5 + 0.5) * window.innerWidth, sy = (-v.y * 0.5 + 0.5) * window.innerHeight;
        const d = Math.hypot(sx - e.clientX, sy - e.clientY) - (m.def.boss ? 70 : m.def.size * 12);
        if (d < bd) { bd = d; best = m; }
      }
      if (best) { this.tapMonster(best); return; }
    }
    const objs = [this.world.ground, ...this.world.nodes.map((n) => n.group), ...this.junk.filter((j) => j.alive).map((j) => j.group), this.lord.root, this.rival.root, this.rivalCloud.group, ...Object.values(this.traders).map((t) => t.root), ...Object.values(this.world.stalls).map((s) => s.group), ...this.monsters.map((m) => m.group)];
    const hits = this.raycaster.intersectObjects(objs, true);
    for (const hit of hits) {
      const u = hit.object.userData;
      if (u.monster) { this.tapMonster(u.monster); return; }
      if (u.node) { if (u.node.alive) { this.tapNode(u.node); return; } continue; }
      if (u.junk) { this.tapJunk(u.junk); return; }
      if (u.trader) { this.openTrade(u.trader, true); return; }
      if (u.rival) { this.openTrade('rival', true); return; }
      if (u.lord) { this.lordSay(this.phase === 'night' ? LORD.night : pick([LORD.poor, LORD.built, LORD.wobbly, LORD.fundament]), 2600); sfx.pop(); return; }
      if (hit.object === this.world.ground) {
        const p = hit.point;
        if (Math.hypot(p.x, p.z) < R - 0.8) {
          this.walkTo(p, 0.1);
          this.marker(p);
        }
        return;
      }
    }
  }

  tapMonster(m) {
    if (m.state === 'dying' || m.state === 'gone') return;
    const p = m.group.position.clone().add(new THREE.Vector3(0, m.hitY || 1.2, 0));
    this.bolt(p.clone().add(new THREE.Vector3(rand(-1, 1), 9, rand(-1, 1))), p, 0x9fe8ff);
    sfx.zap(clamp(p.x / 14, -1, 1));
    this.damage(m, 1, 0x9fe8ff);
    // the avatar points at it
    this.pointT = 0.3;
  }

  marker(p) {
    const ring = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 20), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthWrite: false }));
    ring.rotation.x = -Math.PI / 2;
    ring.position.set(p.x, 0.05, p.z);
    this.scene.add(ring);
    this.bolts.push({ mesh: ring, mat: ring.material, t: 0, ring: true });
  }

  onKey(e) {
    if (this.state !== 'play') return;
    if (e.key === 'Escape') this.closeTrade();
    if (e.key === 'h' || e.key === 'H' || e.key === 't' || e.key === 'T') { if (this.tradeOpen) this.closeTrade(); else this.openTrade(this.lastTrader || 'core', false); }
    const ids = ['mkt', 'sal', 'svc', 'com', 'core', 'rival'];
    if (/^[1-6]$/.test(e.key) && this.phase === 'day') this.openTrade(ids[Number(e.key) - 1], false);
  }

  // ================================================================== loop
  cycleAngle() {
    if (this.state !== 'play' && this.state !== 'over') return Math.PI * 0.32;
    const D = DAYS[Math.min(this.dayIdx, 2)];
    if (this.state === 'over') return Math.PI * 0.5;
    if (this.phase === 'day') return lerp(0.08 * Math.PI, 1.0 * Math.PI, clamp(this.phaseT / D.day, 0, 1));
    return lerp(1.0 * Math.PI, 2.08 * Math.PI, clamp(this.phaseT / D.night, 0, 1));
  }

  update(dt, time) {
    let wdt = dt;
    if (this.hitStop > 0) { this.hitStop -= dt; wdt = dt * 0.15; }
    const playing = this.state === 'play';
    if (playing) {
      this.phaseT += wdt;
      this.elapsed += wdt;
      const D = DAYS[this.dayIdx];
      if (this.phase === 'day') {
        const left = D.day - this.phaseT;
        if (left < 8 && !this.duskSaid) { this.duskSaid = true; this.lordSay(LORD.dusk, 3000); music.setIntensity(2); }
        else if (this.phaseT > 12 && !this.busy) { this.busy = true; music.setIntensity(1); }
        if (this.phaseT >= D.day) { this.duskSaid = false; this.busy = false; this.startNight(); }
      } else {
        this.spawnTimer -= wdt;
        if (this.spawnQueue.length && this.spawnTimer <= 0) { this.spawnMonster(this.spawnQueue.shift()); if (this.spawnQueue.length && this.spawnQueue[0] !== 'boss' && Math.random() < 0.4) this.spawnMonster(this.spawnQueue.shift()); this.spawnTimer = this.spawnEvery * rand(0.7, 1.2); }
        if (this.phaseT >= D.night) this.endDayCycle();
      }
      if (Math.floor((this.phaseT - wdt) * 4) !== Math.floor(this.phaseT * 4)) this.updateHUD();
    }
    this.world.setCycle(this.cycleAngle());
    this.world.update(dt, time);
    this.updatePlayer(wdt, time);
    this.updateCast(dt, time);
    this.updateNodes(dt);
    this.updateFlying(wdt);
    this.updateTowers(wdt, time);
    this.updateMonsters(wdt, time, playing);
    this.updateProjectiles(wdt);
    this.debris.update(wdt);
    this.effects.update(wdt);
    this.updateCamera(dt, time);
  }

  updatePlayer(dt, time) {
    const P = this.player;
    if (!P) return;
    const pos = P.root.position;
    let moving = false;
    if (this.walk) {
      const to = this.walk.to;
      const dx = to.x - pos.x, dz = to.z - pos.z;
      const d = Math.hypot(dx, dz);
      if (d > this.walk.stop + 0.02) {
        const step = Math.min(7.2 * dt, d - this.walk.stop);
        pos.x += (dx / d) * step; pos.z += (dz / d) * step;
        const yaw = Math.atan2(dx, dz);
        let dy = yaw - P.root.rotation.y;
        while (dy > Math.PI) dy -= Math.PI * 2;
        while (dy < -Math.PI) dy += Math.PI * 2;
        P.root.rotation.y += dy * clamp(dt * 14, 0, 1);
        moving = true;
      } else {
        const then = this.walk.then;
        this.walk = null;
        then?.();
      }
    }
    // keep on the island
    const r = Math.hypot(pos.x, pos.z);
    if (r > R - 1) pos.multiplyScalar((R - 1) / r);
    if (moving) this.walkPh += dt * 12;
    const sw = moving ? Math.sin(this.walkPh) : 0;
    P.legs.forEach((l, i) => { l.rotation.x = lerp(l.rotation.x, sw * 0.6 * (i ? -1 : 1), 0.4); });
    P.body.position.y = moving ? Math.abs(Math.sin(this.walkPh)) * 0.06 : 0;
    // mining swing
    const armR = P.arms[1], armL = P.arms[0];
    if (this.act) {
      const A = this.act;
      const target = A.node ? A.node.pos : A.junk.pos;
      const yaw = Math.atan2(target.x - pos.x, target.z - pos.z);
      P.root.rotation.y = yaw;
      A.t += dt;
      const k = (A.t % 0.32) / 0.32;
      armR.rotation.x = k < 0.55 ? lerp(0.2, -2.6, k / 0.55) : lerp(-2.6, 0.5, (k - 0.55) / 0.45);
      if (Math.floor((A.t - dt) / 0.32 - 0.6) !== Math.floor(A.t / 0.32 - 0.6) && A.t > 0.1) this.hitTarget();
      if (A.t > 4) this.act = null;
    } else if (this.pointT > 0) {
      this.pointT -= dt;
      armR.rotation.x = lerp(armR.rotation.x, -2.4, 0.4);
    } else {
      armR.rotation.x = lerp(armR.rotation.x, moving ? -sw * 0.5 : 0, 0.25);
    }
    armL.rotation.x = lerp(armL.rotation.x, moving ? sw * 0.5 : 0, 0.25);
    void time;
  }

  updateCast(dt, time) {
    const L = this.lord;
    const toP = this.player.root.position.clone().sub(L.root.position);
    L.root.rotation.y = lerp(L.root.rotation.y, clamp(Math.atan2(toP.x, toP.z), -0.9, 0.9), 0.05);
    L.body.position.y = Math.sin(time * 1.8) * 0.03;
    L.neck.rotation.z = Math.sin(time * 0.9) * 0.05;
    this.lordWave = Math.max(0, (this.lordWave || 0) - dt);
    this.lordCheer = Math.max(0, (this.lordCheer || 0) - dt);
    const wave = this.lordWave > 0 ? Math.sin(time * 10) * 0.3 : 0;
    L.arms[0].rotation.z = lerp(L.arms[0].rotation.z, this.lordCheer > 0 ? -2.6 : this.lordWave > 0 ? -1.4 + wave : -0.1, 0.15);
    L.arms[1].rotation.x = lerp(L.arms[1].rotation.x, this.lordCheer > 0 ? -2.2 : -0.5, 0.12);
    L.xTop.rotation.y += dt * 2;
    L.gemM.emissiveIntensity = 1.2 + Math.sin(time * 4) * 0.4;
    for (const [id, T] of Object.entries(this.traders)) {
      const active = this.tradeOpen === id;
      T.body.position.y = Math.abs(Math.sin(time * (active ? 7 : 2) + id.length)) * (active ? 0.08 : 0.025);
      T.arms[0].rotation.z = lerp(T.arms[0].rotation.z, active ? -2.2 + Math.sin(time * 9) * 0.3 : -0.08, 0.15);
      T.neck.rotation.y = Math.sin(time * 0.8 + id.length) * 0.25;
    }
    // the rival bobs on his cloud and rubs his hands
    const bob = Math.sin(time * 1.4) * 0.25;
    this.rival.root.position.y = RIVAL_POS.y + bob;
    this.rivalCloud.group.position.y = RIVAL_POS.y - 0.45 + bob;
    this.rivalSign.position.y = RIVAL_POS.y + 3.0 + bob;
    this.rival.arms[0].rotation.x = -1.0 + Math.sin(time * 8) * 0.25;
    this.rival.arms[1].rotation.x = -1.0 - Math.sin(time * 8) * 0.25;
  }

  updateNodes(dt) {
    for (const n of this.world.nodes) {
      if (n.shake > 0) { n.shake -= dt; n.group.position.x = n.pos.x + Math.sin(n.shake * 90) * 0.06; } else n.group.position.x = n.pos.x;
      if (!n.alive) {
        if (n.kind !== 'lead' && n.shrink > 0) { n.shrink = Math.max(0, n.shrink - dt * 5); n.group.scale.setScalar(Math.max(0.01, n.shrink)); if (n.shrink <= 0) n.group.visible = false; }
        n.respawn -= dt;
        if (n.respawn <= 0) {
          if (n.kind === 'lead') { this.reviveNode(n); for (const f of n.fruits) f.scale.setScalar(0.01); n.fruitGrow = 0; }
          else this.reviveNode(n);
        }
      } else if (n.grow < 1) {
        n.grow = Math.min(1, n.grow + dt * 2.2);
        n.group.scale.setScalar(Math.max(0.01, easeOutBack(n.grow)));
      }
      if (n.kind === 'lead' && n.fruitGrow !== undefined && n.fruitGrow < 1) {
        n.fruitGrow = Math.min(1, n.fruitGrow + dt * 1.5);
        for (const f of n.fruits) f.scale.setScalar(Math.max(0.01, easeOutBack(n.fruitGrow)));
      }
    }
    for (const j of this.junk) {
      if (!j.alive) continue;
      if (j.pop < 1) { j.pop = Math.min(1, j.pop + dt * 2); j.group.scale.setScalar(Math.max(0.01, easeOutBack(j.pop))); }
      if (j.shake > 0) { j.shake -= dt; j.group.rotation.z = Math.sin(j.shake * 80) * 0.08; } else j.group.rotation.z = 0;
    }
  }

  updateFlying(dt) {
    for (let i = this.flying.length - 1; i >= 0; i--) {
      const F = this.flying[i];
      F.t += dt;
      if (F.t < 0) { F.mesh.visible = false; continue; }
      F.mesh.visible = true;
      const k = clamp(F.t / F.dur, 0, 1);
      const to = F.follow ? this.player.root.position.clone().add(new THREE.Vector3(0, 1.4, 0)) : F.to;
      const e = F.follow ? k * k : 1 - Math.pow(1 - k, 2);
      F.mesh.position.lerpVectors(F.from, to, e);
      F.mesh.position.y += Math.sin(k * Math.PI) * (F.follow ? 1.2 : 3.5);
      F.mesh.rotation.y += dt * 8;
      F.mesh.rotation.x += dt * (F.follow ? 6 : 3);
      if (k >= 1) {
        if (!F.follow) F.mesh.rotation.set(0, 0, 0);
        this.flying.splice(i, 1);
        F.done?.();
      }
    }
    // stolen blocks tumble off the island
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i];
      f.t += dt;
      f.v.y -= 20 * dt;
      f.mesh.position.addScaledVector(f.v, dt);
      f.mesh.rotation.x += f.w.x * dt; f.mesh.rotation.y += f.w.y * dt; f.mesh.rotation.z += f.w.z * dt;
      if (f.t > 3) { this.scene.remove(f.mesh); this.falling.splice(i, 1); }
    }
    if (this.bridgeGrow !== undefined && this.bridgeGrow < 1) {
      this.bridgeGrow = Math.min(1, this.bridgeGrow + dt * 1.6);
      for (const b of this.world.bridges) b.scale.z = Math.max(0.01, easeOutBack(this.bridgeGrow));
    }
  }

  updateTowers(dt, time) {
    // blocks settle into their slots, wobbly ones sway
    for (let t = 0; t < 4; t++) {
      const st = this.towers[t];
      st.forEach((e, i) => {
        if (!e.landed) return;
        const slot = this.world.towerSlot(t, i);
        e.mesh.position.y = lerp(e.mesh.position.y, slot.y, clamp(dt * 10, 0, 1));
        const sway = e.wobbly ? Math.sin(time * 3.2 + i * 0.7 + t) * 0.035 * (1 + i * 0.4) : 0;
        e.mesh.position.x = slot.x + sway * 2;
        e.mesh.position.z = slot.z;
        e.mesh.rotation.z = sway;
      });
    }
    // night defence: towers shoot, the KI crystal throws lightning
    if (this.phase !== 'night' || this.state !== 'play') return;
    this.towerCd ||= [0, 0, 0, 0];
    const alive = this.monsters.filter((m) => m.state === 'walk' || m.state === 'attack');
    if (!alive.length) return;
    const m365 = this.built.has('m365');
    for (let t = 0; t < 4; t++) {
      const st = this.towers[t];
      const n = st.filter((e) => e.landed).length;
      if (!n) continue;
      this.towerCd[t] -= dt;
      if (this.towerCd[t] > 0) continue;
      const hasF = st.some((e) => e.f.id === 'fundament');
      const range = 7 + n * 0.7 + (hasF ? 2 : 0);
      let best = null, bd = range;
      for (const m of alive) { const d = m.group.position.distanceTo(TOWERS[t]); if (d < bd) { bd = d; best = m; } }
      if (!best) continue;
      this.fireTower(t, best);
      this.towerCd[t] = (2.6 / (0.5 + 0.18 * n)) * (m365 ? 0.75 : 1);
    }
    if (this.built.has('ki')) {
      this.kiCd = (this.kiCd || 0) - dt;
      if (this.kiCd <= 0) {
        let best = null;
        for (const m of alive) if (m.group.position.distanceTo(CASTLE) < 13 && (!best || m.hp > best.hp)) best = m;
        if (best) {
          const p = best.group.position.clone().add(new THREE.Vector3(0, best.hitY || 1.2, 0));
          this.bolt(this.world.kiCrystal.position.clone(), p, 0xb47bff);
          sfx.zap(0);
          this.damage(best, 2, 0xb47bff);
          this.kiCd = 2.0;
        }
      }
    }
  }

  updateProjectiles(dt) {
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      const m = p.target;
      const tgt = m.group.position.clone().add(new THREE.Vector3(0, m.hitY || 1.2, 0));
      const d = p.mesh.position.distanceTo(tgt);
      if (m.state === 'dying' || m.state === 'gone' || d < 0.4) {
        if (d < 0.6 && m.state !== 'dying' && m.state !== 'gone') this.damage(m, 1, p.col);
        this.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        continue;
      }
      p.mesh.position.addScaledVector(tgt.sub(p.mesh.position).normalize(), Math.min(d, p.speed * dt));
      p.mesh.rotation.x += dt * 12; p.mesh.rotation.y += dt * 9;
    }
    for (let i = this.bolts.length - 1; i >= 0; i--) {
      const b = this.bolts[i];
      b.t += dt;
      const life = b.ring ? 0.5 : 0.18;
      b.mat.opacity = 1 - b.t / life;
      if (b.ring) b.mesh.scale.setScalar(1 + b.t * 3);
      if (b.t >= life) { this.scene.remove(b.mesh); b.mesh.traverse((o) => o.geometry?.dispose()); b.mat.dispose(); this.bolts.splice(i, 1); }
    }
  }

  updateMonsters(dt, time, playing) {
    for (let i = this.monsters.length - 1; i >= 0; i--) {
      const m = this.monsters[i];
      const G = m.group;
      m.t += dt;
      if (m.talk) { m.talkT -= dt; if (m.talkT <= 0) { G.remove(m.talk); m.talk.material.map.dispose(); m.talk.material.dispose(); m.talk = null; } }
      if (m.hitT > 0) { m.hitT -= dt; G.scale.setScalar(1 + m.hitT * 1.6); } else if (m.state !== 'dying') G.scale.setScalar(1);
      if (m.state === 'rise') {
        G.position.set(m.pos.x, lerp(-2.5, 0, clamp(m.t / 0.8, 0, 1)), m.pos.z);
        if (m.t >= 0.8) { m.state = 'walk'; m.t = 0; }
      } else if (m.state === 'walk') {
        if (!playing) continue;
        if (m.target >= 0 && !this.towers[m.target].some((e) => e.f.id !== 'fundament') && Math.random() < 0.02) this.pickTarget(m);
        const dx = m.goal.x - G.position.x, dz = m.goal.z - G.position.z;
        const d = Math.hypot(dx, dz);
        const sp = m.def.speed * (m.slow > 0 ? 0.4 : 1);
        if (d > 0.15) {
          const s = Math.min(sp * dt, d);
          G.position.x += (dx / d) * s; G.position.z += (dz / d) * s;
          G.rotation.y = Math.atan2(dx, dz);
        } else { m.state = 'attack'; m.t = 0; }
        const ph = time * (m.type === 'postfach' ? 18 : 8) + m.ph;
        m.legs.forEach((l, k) => { l.rotation.x = Math.sin(ph + k * Math.PI) * 0.55; });
        m.arms.forEach((a, k) => { a.rotation.x = (m.type === 'excel' ? -0.2 : 0) + Math.sin(ph + k) * 0.15; });
        G.position.y = m.def.fly ? 0.6 + Math.sin(time * 3 + m.ph) * 0.25 : Math.abs(Math.sin(ph)) * 0.06;
      } else if (m.state === 'attack') {
        if (!playing) continue;
        const ph = time * 14;
        m.arms.forEach((a, k) => { a.rotation.x = -1.6 + Math.sin(ph + k * Math.PI) * 0.6; });
        G.position.y = m.def.fly ? 0.6 : Math.abs(Math.sin(ph)) * 0.12;
        const wait = m.def.boss ? 1.7 : 1.1;
        if (m.t >= wait) {
          m.t = 0;
          const res = m.target >= 0 ? this.stealFrom(m.target) : 'none';
          if (res === 'held') {
            this.stats.held++;
            this.lordSay(LORD.held, 1800);
            this.effects.shockwave(TOWERS[m.target].clone().setY(0.1), 0x2f6fd6);
            this.effects.sparks(G.position.clone().add(new THREE.Vector3(0, 1, 0)), 0x5aa0ff, 20);
            sfx.thud(0);
            // knocked back
            const back = G.position.clone().sub(TOWERS[m.target]).setY(0).normalize();
            G.position.addScaledVector(back, 2.2);
            m.state = 'walk';
            this.damage(m, 1, 0x5aa0ff);
          } else if (res === 'stolen') {
            this.lordSay(LORD.stolen, 2000);
            sfx.error();
            mount(h('div.errflash.passthrough'));
            setTimeout(() => document.querySelector('.errflash')?.remove(), 650);
            this.effects.shake = 0.8;
            if (!m.def.boss) { this.debris.burst(G.position.clone().add(new THREE.Vector3(0, 1, 0)), MON_COLORS[m.type], 10); this.removeMonster(m); }
            else this.pickTarget(m), m.state = 'walk';
          } else {
            // nothing to steal: rattles the keep
            this.effects.shake = 0.5;
            sfx.thud(0);
            this.score = Math.max(0, this.score - 30);
            this.popup(G.position.clone().add(new THREE.Vector3(0, 2, 0)), '-30', 'bad');
            if (!m.def.boss) { this.debris.burst(G.position.clone().add(new THREE.Vector3(0, 1, 0)), MON_COLORS[m.type], 10); this.removeMonster(m); }
            else this.pickTarget(m);
          }
          this.updateHUD();
        }
      } else if (m.state === 'dying') {
        const k = clamp(m.t / 0.35, 0, 1);
        G.scale.setScalar(Math.max(0.01, 1 - k));
        G.rotation.y += dt * 20;
        if (k >= 1) this.removeMonster(m);
      }
      if (m.def.boss && m.sheets) {
        m.sheets.forEach((s, k) => {
          const a = time * 1.5 + (k / m.sheets.length) * Math.PI * 2;
          s.position.set(Math.cos(a) * 2.6, 1.6 + Math.sin(time * 2 + k) * 0.8, Math.sin(a) * 2.6);
          s.rotation.set(time * 2 + k, a, 0.3);
        });
      }
      if (m.ghostMat) m.ghostMat.opacity = 0.55 + Math.sin(time * 5 + m.ph) * 0.2;
      if (m.state === 'gone') this.monsters.splice(i, 1);
    }
  }

  updateCamera(dt, time) {
    const night = this.phase === 'night' && this.state === 'play';
    let want;
    if (this.state === 'intro' || this.state === 'idle') {
      this.camAz += dt * 0.07;
      want = new THREE.Vector3(0, 0, -1);
    } else if (night) want = new THREE.Vector3(0, 0, -4.5);
    else {
      const p = this.player.root.position;
      want = new THREE.Vector3(p.x * 0.6, 0, p.z * 0.6 - 1.5);
    }
    this.camFocus.lerp(want, clamp(dt * 2.2, 0, 1));
    const dist = (this.state === 'intro' ? this.camDist * 1.25 : this.camDist * (night ? 1.08 : 1)) * this.zoom;
    const el = this.camEl;
    const sh = this.effects.shake * this.effects.shake * 0.25;
    this.camera.position.set(
      this.camFocus.x + Math.sin(this.camAz) * Math.cos(el) * dist + rand(-sh, sh),
      this.camFocus.y + Math.sin(el) * dist + rand(-sh, sh),
      this.camFocus.z + Math.cos(this.camAz) * Math.cos(el) * dist + rand(-sh, sh)
    );
    this.camera.lookAt(this.camFocus.x, this.camFocus.y + 1.2, this.camFocus.z);
    void time;
  }
}
