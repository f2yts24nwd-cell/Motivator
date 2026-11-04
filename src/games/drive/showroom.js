import * as THREE from 'three';
import { Reflector } from 'three/examples/jsm/objects/Reflector.js';
import { canvasTexture, drawBrand, clamp } from '../../core/gfx.js';
import { h, mount } from '../../core/ui.js';
import { sfx } from '../../core/audio.js';
import { CarModel } from './cars.js';
import { CARS, COLORS, FINISHES, RIMS, RIM_COLORS, CALIPERS, SPOILERS, PARTS, SCHULTERKLAPPEN, DANNY, say, getMode } from './content.js';

// The itmX Fuhrpark: a dark showroom with a mirror floor, a turntable with an LED ring,
// light columns and the car configurator (paint, rims, ride height, spoiler, body parts).

const FOCUS = {
  body: { az: 1.05, el: 0.14, dist: 7.2, y: 0.7 },
  overview: { az: 0.75, el: 0.2, dist: 7.4, y: 0.7 },
  color: { az: 0.95, el: 0.28, dist: 6.6, y: 0.65 },
  rims: { az: 1.35, el: 0.07, dist: 3.7, y: 0.42, z: 1.2 },
  drop: { az: 1.57, el: 0.02, dist: 5.6, y: 0.45 },
  spoiler: { az: 2.55, el: 0.3, dist: 6.4, y: 0.9 },
  parts: { az: 0.55, el: 0.42, dist: 7.2, y: 0.8 }
};

export class Showroom {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x05070b);
    this.scene.environment = app.gfx.envMap;
    this.scene.environmentIntensity = 0.7;
    this.camera = new THREE.PerspectiveCamera(36, 1, 0.1, 120);
    this.cam = { az: 0.75, el: 0.2, dist: 7.4, y: 0.7, z: 0 };
    this.camT = { ...this.cam };
    this.spin = 0;
    this.drag = null;
    this.idle = 0;
    this.build();
    this.onDown = this.onDown.bind(this);
    this.onMove = this.onMove.bind(this);
    this.onUp = this.onUp.bind(this);
    this.onWheel = this.onWheel.bind(this);
  }

  build() {
    const s = this.scene;
    // mirror floor (dimmed by a glossy dark layer on top)
    const mirror = new Reflector(new THREE.CircleGeometry(40, 48), {
      textureWidth: 1024, textureHeight: 1024, color: 0x5a5e66, clipBias: 0.003
    });
    mirror.rotation.x = -Math.PI / 2;
    s.add(mirror);
    this.mirror = mirror;
    const floorTex = canvasTexture(512, 512, (g, w, hh) => {
      g.fillStyle = '#0d1016'; g.fillRect(0, 0, w, hh);
      g.strokeStyle = 'rgba(255,255,255,0.06)'; g.lineWidth = 2;
      for (let i = 0; i <= 4; i++) { g.beginPath(); g.moveTo(i * w / 4, 0); g.lineTo(i * w / 4, hh); g.stroke(); g.beginPath(); g.moveTo(0, i * hh / 4); g.lineTo(w, i * hh / 4); g.stroke(); }
    });
    floorTex.wrapS = floorTex.wrapT = THREE.RepeatWrapping;
    floorTex.repeat.set(10, 10);
    const floor = new THREE.Mesh(new THREE.CircleGeometry(40, 48), new THREE.MeshStandardMaterial({ map: floorTex, transparent: true, opacity: 0.86, roughness: 0.25, metalness: 0.6 }));
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.004;
    floor.receiveShadow = true;
    s.add(floor);
    // turntable
    this.table = new THREE.Group();
    s.add(this.table);
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(3.7, 3.75, 0.06, 64), new THREE.MeshStandardMaterial({ color: 0x1a1d24, metalness: 0.85, roughness: 0.28 }));
    disc.position.y = 0.03;
    disc.receiveShadow = true;
    this.table.add(disc);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(3.74, 0.025, 8, 96), new THREE.MeshStandardMaterial({ color: 0x50af30, emissive: 0x50af30, emissiveIntensity: 3 }));
    ring.rotation.x = Math.PI / 2;
    ring.position.y = 0.05;
    s.add(ring);
    const ring2 = ring.clone();
    ring2.scale.setScalar(1.06);
    ring2.material = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 0.6 });
    ring2.position.y = 0.01;
    s.add(ring2);
    this.carHolder = new THREE.Group();
    this.carHolder.position.y = 0.06;
    this.table.add(this.carHolder);
    // curved back wall with light columns
    const wall = new THREE.Mesh(new THREE.CylinderGeometry(16, 16, 9, 64, 1, true), new THREE.MeshStandardMaterial({ color: 0x0c0f15, roughness: 0.85, side: THREE.BackSide }));
    wall.position.y = 4.5;
    s.add(wall);
    const colMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xdfe9ff, emissiveIntensity: 2.2 });
    for (let i = 0; i < 20; i++) {
      const a = (i / 20) * Math.PI * 2;
      const col = new THREE.Mesh(new THREE.BoxGeometry(0.12, 7, 0.05), colMat);
      col.position.set(Math.sin(a) * 15.85, 3.8, Math.cos(a) * 15.85);
      col.rotation.y = a;
      s.add(col);
    }
    // ceiling light panels (show up as long highlights in the paint)
    const panMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: 2.4, side: THREE.DoubleSide });
    for (const x of [-2.2, 0, 2.2]) {
      const p = new THREE.Mesh(new THREE.PlaneGeometry(0.35, 9), panMat);
      p.rotation.x = Math.PI / 2;
      p.position.set(x, 6.5, 0);
      s.add(p);
    }
    // the sign
    const signTex = canvasTexture(1024, 256, (g, w, hh) => {
      g.clearRect(0, 0, w, hh);
      drawBrand(g, 30, 40, 180, 176);
      g.fillStyle = '#ffffff';
      g.font = '800 120px "Segoe UI", Arial, sans-serif';
      g.textBaseline = 'middle';
      g.fillText('Fuhrpark', 240, 128);
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.5), new THREE.MeshStandardMaterial({ map: signTex, transparent: true, emissive: 0xffffff, emissiveMap: signTex, emissiveIntensity: 1.2 }));
    sign.position.set(0, 5.2, -15.3);
    s.add(sign);
    // lights
    s.add(new THREE.HemisphereLight(0x9fb4ff, 0x0b0c10, 0.35));
    const key = new THREE.SpotLight(0xffffff, 70, 30, 0.55, 0.6, 1.6);
    key.position.set(2, 10, 3);
    key.target.position.set(0, 0, 0);
    key.castShadow = true;
    key.shadow.mapSize.set(1024, 1024);
    key.shadow.bias = -0.0004;
    key.shadow.camera.near = 4;
    key.shadow.camera.far = 20;
    s.add(key, key.target);
    const rimL = new THREE.SpotLight(0x6aa8ff, 45, 30, 0.6, 0.7, 1.6);
    rimL.position.set(-8, 4, -5);
    s.add(rimL);
    const rimR = new THREE.SpotLight(0xffc48a, 40, 30, 0.6, 0.7, 1.6);
    rimR.position.set(8, 4, -4);
    s.add(rimR);
  }

  // ---------------------------------------------------------------- car
  showCar(carDef, cfg) {
    if (this.model) { this.carHolder.remove(this.model.root); this.model.dispose(); }
    this.model = new CarModel(carDef, cfg);
    this.model.root.traverse((o) => { if (o.isMesh && o.material !== this.model.contactShadow.material) o.castShadow = true; });
    this.carHolder.add(this.model.root);
    this.model.root.scale.setScalar(0.001);
    this.pop = 0;
    return this.model;
  }

  focus(id) {
    const f = FOCUS[id] || FOCUS.overview;
    this.camT = { az: f.az, el: f.el, dist: f.dist, y: f.y, z: f.z || 0 };
    // turn the table so the interesting side faces the camera
    this.idle = -4;
  }

  // ---------------------------------------------------------------- input
  attach() {
    const c = this.app.gfx.renderer.domElement;
    c.addEventListener('pointerdown', this.onDown);
    c.addEventListener('wheel', this.onWheel, { passive: true });
    window.addEventListener('pointermove', this.onMove);
    window.addEventListener('pointerup', this.onUp);
  }
  detach() {
    const c = this.app.gfx.renderer.domElement;
    c.removeEventListener('pointerdown', this.onDown);
    c.removeEventListener('wheel', this.onWheel);
    window.removeEventListener('pointermove', this.onMove);
    window.removeEventListener('pointerup', this.onUp);
  }
  onDown(e) { this.drag = { x: e.clientX, y: e.clientY, id: e.pointerId }; this.idle = 0; }
  onMove(e) {
    if (!this.drag || e.pointerId !== this.drag.id) return;
    const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
    this.drag.x = e.clientX; this.drag.y = e.clientY;
    this.camT.az -= dx * 0.008;
    this.camT.el = clamp(this.camT.el + dy * 0.005, 0.02, 0.9);
    this.idle = 0;
  }
  onUp() { this.drag = null; }
  onWheel(e) { this.camT.dist = clamp(this.camT.dist + e.deltaY * 0.004, 3.2, 11); }

  resize(w, hh) {
    this.camera.aspect = w / hh;
    // phones get a bottom dock (see showroomUI): no sideways shift, lift the car above the dock instead
    this.compact = hh < 520 || w < 700;
    this.camera.fov = w / hh < 1 ? 56 : this.compact ? 40 : 36;
    if (this.compact) this.camera.setViewOffset(w, hh, 0, Math.round((w / hh < 1 ? 0.16 : 0.14) * hh), w, hh);
    else this.camera.clearViewOffset();
    this.camera.updateProjectionMatrix();
    this.wide = w / hh;
  }

  update(dt, time) {
    if (this.model) {
      this.pop = Math.min(1, this.pop + dt * 2.5);
      const k = 1 - Math.pow(1 - this.pop, 3);
      this.model.root.scale.setScalar(0.85 + 0.15 * k);
      this.model.root.position.y = (1 - k) * 0.6;
      this.model.animate(dt, 0, Math.sin(time * 0.6) * 0.12 * (this.camT.az > 1.2 && this.camT.az < 1.5 ? 1 : 0));
    }
    this.idle += dt;
    if (!this.drag && this.idle > 2.5) this.table.rotation.y += dt * 0.18;
    const c = this.cam, t = this.camT;
    const a = 1 - Math.exp(-dt * 4);
    for (const k of ['az', 'el', 'dist', 'y', 'z']) c[k] += (t[k] - c[k]) * a;
    // UI covers the right side in landscape: shift the car to the left of the frame
    const off = this.wide > 1.2 && !this.compact ? 0.95 : 0;
    const target = new THREE.Vector3(off * Math.cos(c.az), c.y, c.z * 0 - off * Math.sin(c.az));
    const dist = c.dist * (this.wide < 1 ? 1.65 : this.compact ? 1.08 : 1);
    this.camera.position.set(target.x + Math.sin(c.az) * Math.cos(c.el) * dist, c.y + Math.sin(c.el) * dist, target.z + Math.cos(c.az) * Math.cos(c.el) * dist);
    this.camera.lookAt(target);
  }
}

// ------------------------------------------------------------------ configurator UI
/**
 * Builds the showroom overlay. opts: { progress, onChange(carId, cfg), onSelect(carId), onDrive(), onBack(), say(text) }
 */
export function showroomUI(room, opts) {
  const P = opts.progress;
  let carId = P.car;
  let tab = 'color';
  const cfgOf = (id) => ({ ...CARS.find((c) => c.id === id).def, ...(P.configs[id] || {}) });
  const isLocked = (car) => car.locked && P.deals.length < car.locked;

  const root = mount(h('div.dr-show'));
  const compactQ = matchMedia('(max-height: 520px), (max-width: 700px)');
  const setCompact = () => root.classList.toggle('compact', compactQ.matches);
  setCompact();
  compactQ.addEventListener?.('change', setCompact);
  const head = h('div.dr-showhead.panel');
  const cars = h('div.dr-cars');
  const tabs = h('div.dr-tabs');
  const pane = h('div.dr-pane');
  const side = h('div.dr-config.panel', {}, [tabs, pane]);
  const driveBtn = h('button.btn.gold.dr-drive', { onclick: () => { sfx.click(); opts.onDrive(); } }, '🚗 Losfahren');
  const msg = h('div.dr-showmsg.panel');
  // phones: compact car switcher at the top and a button that hides all panels to look at the car
  const swName = h('b'), swSub = h('small');
  const step = (d) => {
    sfx.click();
    const i = CARS.findIndex((c) => c.id === carId);
    const next = CARS[(i + d + CARS.length) % CARS.length];
    const lock = isLocked(next);
    if (lock) toast(say(SCHULTERKLAPPEN, getMode()));
    carId = next.id;
    opts.onSelect(carId, cfgOf(carId), lock);
    renderAll();
  };
  const carSw = h('div.dr-carsw.panel', {}, [h('button', { onclick: () => step(-1) }, '◀'), h('div', {}, [swName, swSub]), h('button', { onclick: () => step(1) }, '▶')]);
  const eye = h('button.dr-eye', { title: 'Nur das Auto ansehen', onclick: () => { sfx.click(); root.classList.toggle('clean'); eye.textContent = root.classList.contains('clean') ? '🎛️' : '👁'; } }, '👁');
  root.append(head, side, cars, driveBtn, msg, carSw, eye);

  function toast(text, who = DANNY) {
    msg.replaceChildren(h('div.dr-face', { style: `--c:${who.color}` }, who.ini), h('div', {}, [h('b', {}, who.name), h('span', {}, text)]));
    msg.classList.add('on');
    clearTimeout(toast.t);
    toast.t = setTimeout(() => msg.classList.remove('on'), 6500);
  }
  opts.toast = toast;

  function renderHead() {
    const car = CARS.find((c) => c.id === carId);
    const bar = (label, v) => h('div.dr-stat', {}, [h('small', {}, label), h('i', {}, h('b', { style: `width:${Math.round(clamp(v, 0.05, 1) * 100)}%` }))]);
    head.replaceChildren(
      h('div.kicker', {}, 'itmX Fuhrpark'),
      h('h2', {}, [car.name, h('small', {}, car.sub)]),
      h('p', {}, car.blurb),
      h('div.dr-stats', {}, [
        bar(`Spitze ${car.vmax} km/h`, (car.vmax - 140) / 120),
        bar(`0–100 in ${car.t100.toLocaleString('de-DE')} s`, (9 - car.t100) / 5),
        bar('Handling', (car.grip - 0.7) / 0.2),
        car.ev ? bar(`Akku ${car.range} km Reichweite`, car.range / 12) : bar('Sound', car.id === 'fuenfer' ? 0.95 : car.id === 'sklasse' ? 0.7 : 0.55)
      ])
    );
  }

  function renderCars() {
    cars.replaceChildren(...CARS.map((c) => {
      const lock = isLocked(c);
      const col = COLORS.find((x) => x.id === cfgOf(c.id).color)?.hex || '#888';
      return h(`button.dr-carbtn${c.id === carId ? '.on' : ''}${lock ? '.locked' : ''}`, {
        onclick: () => {
          sfx.click();
          if (lock) { toast(say(SCHULTERKLAPPEN, getMode())); sfx.error(); }
          if (c.id === carId) return;
          carId = c.id;
          opts.onSelect(carId, cfgOf(carId), lock);
          renderAll();
        }
      }, [h('i', { style: `--c:${col}` }), h('b', {}, c.name), h('small', {}, lock ? `🔒 ab ${c.locked} Deals` : c.sub)]);
    }));
  }

  function set(key, value) {
    const cfg = cfgOf(carId);
    cfg[key] = value;
    P.configs[carId] = cfg;
    opts.onChange(carId, cfg);
    renderPane();
    renderCars();
  }
  function togglePart(id) {
    const cfg = cfgOf(carId);
    const parts = new Set(cfg.parts);
    if (parts.has(id)) parts.delete(id); else {
      parts.add(id);
      if (id === 'rack') parts.delete('box');
      if (id === 'box') parts.delete('rack');
    }
    set('parts', [...parts]);
  }

  const BASE_TABS = [['color', '🎨', 'Farbe'], ['rims', '🛞', 'Felgen'], ['drop', '⬇️', 'Fahrwerk'], ['spoiler', '🪽', 'Spoiler'], ['parts', '🧩', 'Anbauteile']];
  function renderTabs() {
    const car = CARS.find((c) => c.id === carId);
    const TABS = car.bodies ? [['body', '🚘', 'Karosserie'], ...BASE_TABS] : BASE_TABS;
    if (!TABS.some(([id]) => id === tab)) tab = 'color';
    tabs.style.gridTemplateColumns = `repeat(${TABS.length}, 1fr)`;
    tabs.replaceChildren(...TABS.map(([id, ic, label]) => h(`button.dr-tab${id === tab ? '.on' : ''}`, { onclick: () => { sfx.click(); tab = id; room.focus(id); renderTabs(); renderPane(); } }, [h('span', {}, ic), h('em', {}, label)])));
  }
  function swatches(list, cur, key, round = true) {
    return h('div.dr-swatches', {}, list.map((c) => h(`button.dr-sw${c.id === cur ? '.on' : ''}${round ? '' : '.sq'}`, { title: c.name, style: `--c:${c.hex}`, onclick: () => { sfx.click(); set(key, c.id); } })));
  }
  function chips(list, cur, key) {
    return h('div.dr-chips', {}, list.map((c) => h(`button.dr-chip${c.id === cur ? '.on' : ''}`, { onclick: () => { sfx.click(); set(key, c.id); } }, c.name)));
  }
  function renderPane() {
    const cfg = cfgOf(carId);
    const name = (list, id) => list.find((x) => x.id === id)?.name || '';
    const rows = [];
    if (tab === 'body') {
      const car = CARS.find((c) => c.id === carId);
      rows.push(h('label', {}, 'Karosserie'), chips(car.bodies, cfg.body || car.bodies[0].id, 'body'));
      rows.push(h('p.dr-note', {}, 'Touring: der Kombi mit flach auslaufendem Dach. Limousine: klassisch mit Stufenheck.'));
    } else if (tab === 'color') {
      rows.push(h('label', {}, ['Lack: ', h('b', {}, name(COLORS, cfg.color))]), swatches(COLORS, cfg.color, 'color'));
      rows.push(h('label', {}, 'Oberfläche'), chips(FINISHES, cfg.finish, 'finish'));
    } else if (tab === 'rims') {
      rows.push(h('label', {}, 'Design'), chips(RIMS, cfg.rim, 'rim'));
      rows.push(h('label', {}, ['Felgenfarbe: ', h('b', {}, name(RIM_COLORS, cfg.rimColor))]), swatches(RIM_COLORS, cfg.rimColor, 'rimColor'));
      rows.push(h('label', {}, ['Bremssättel: ', h('b', {}, name(CALIPERS, cfg.caliper))]), swatches(CALIPERS, cfg.caliper, 'caliper'));
    } else if (tab === 'drop') {
      const val = h('b', {}, `${cfg.drop} mm`);
      const range = h('input.dr-range', { type: 'range', min: 0, max: 60, step: 5, value: cfg.drop });
      range.addEventListener('input', () => { val.textContent = `${range.value} mm`; const c = cfgOf(carId); c.drop = +range.value; P.configs[carId] = c; opts.onChange(carId, c); });
      rows.push(h('label', {}, ['Tieferlegung: ', val]), range);
      rows.push(h('p.dr-note', {}, 'Tiefer heißt: weniger Seitenneigung und etwas mehr Grip in Kurven. Ab 40 mm schleift es an jedem Bordstein.'));
    } else if (tab === 'spoiler') {
      rows.push(h('label', {}, 'Heckspoiler'), chips(SPOILERS, cfg.spoiler, 'spoiler'));
      rows.push(h('p.dr-note', {}, 'Bei Kombi und SUV sitzt der Spoiler an der Dachkante.'));
    } else if (tab === 'parts') {
      rows.push(h('div.dr-parts', {}, PARTS.map((p) => h(`button.dr-part${cfg.parts.includes(p.id) ? '.on' : ''}`, { onclick: () => { sfx.click(); togglePart(p.id); } }, [h('span', {}, p.icon), p.name]))));
    }
    pane.replaceChildren(...rows);
  }
  function renderAll() {
    const c = CARS.find((x) => x.id === carId);
    swName.textContent = c.name;
    swSub.textContent = isLocked(c) ? `🔒 ab ${c.locked} Deals` : c.sub;
    renderHead(); renderCars(); renderTabs(); renderPane(); driveBtn.disabled = isLocked(CARS.find((c) => c.id === carId)); driveBtn.textContent = driveBtn.disabled ? '🔒 Gesperrt' : '🚗 Losfahren'; }
  renderAll();
  return { root, toast, get carId() { return carId; }, refresh: renderAll };
}
