import { h, mount } from '../../core/ui.js';
import { MAP } from './world.js';
import { WHO, fmtEuro } from './content.js';

// GTA-style HUD (own design): radar with blips, health, wanted stars, money, clock,
// objective line, phone calls, subtitles, big mission banners and the touch controls.
export class Hud {
  constructor(game) {
    this.game = game;
    this.touch = matchMedia('(pointer: coarse)').matches;
    this.root = mount(h('div.xc-hud' + (this.touch ? '.touch' : '')));
    const R = this.root;
    // top right: clock, money, stars
    this.clock = h('div.xc-clock', {}, '18:42');
    this.money = h('div.xc-money', {}, fmtEuro(0));
    this.stars = h('div.xc-stars', {}, Array.from({ length: 5 }, () => h('i', {}, '★')));
    R.append(h('div.xc-tr', {}, [this.clock, this.money, this.stars]));
    // radar + health
    this.radar = h('canvas.xc-radar');
    this.hp = h('i');
    this.zone = h('div.xc-zone');
    R.append(h('div.xc-radar-wrap', { onclick: () => game.toggleMenu?.(true) }, [this.radar, h('div.xc-hp', {}, [this.hp]), this.zone]));
    this.rctx = this.radar.getContext('2d');
    // target bar (van hp / distance)
    this.tName = h('b');
    this.tBar = h('i');
    this.tInfo = h('small');
    this.target = h('div.xc-target', {}, [this.tName, h('div.xc-tbar', {}, [this.tBar]), this.tInfo]);
    R.append(this.target);
    // objective + subtitles + phone
    this.objective = h('div.xc-obj');
    this.sub = h('div.xc-sub');
    R.append(this.sub, this.objective);
    this.call = h('div.xc-call');
    R.append(this.call);
    // speedo
    this.speed = h('div.xc-speed', {}, [h('b', {}, '0'), h('small', {}, 'km/h')]);
    R.append(this.speed);
    // banner
    this.banner = h('div.xc-banner');
    R.append(this.banner);
    // letterbox
    this.lb = h('div.xc-letterbox', {}, [h('i'), h('i')]);
    R.append(this.lb);
    this.skip = h('button.xc-skip', { onclick: () => game.skipCutscene() }, 'Überspringen ▸▸');
    R.append(this.skip);
    // menu button
    R.append(h('button.xc-menu-btn', { title: 'Menü (Esc)', onclick: () => game.toggleMenu() }, '☰'));
    // hint
    this.hint = h('div.xc-hint');
    R.append(this.hint);
    if (this.touch) this.buildTouch();
    this.showTarget(false);
    this.setSpeed(null);
    this.subT = 0;
    this.callT = 0;
    this.bannerT = 0;
  }

  // ---------------------------------------------------------------- touch controls
  buildTouch() {
    const g = this.game;
    const T = g.touch;
    const stick = h('div.xc-stick', {}, [h('i')]);
    const knob = stick.firstChild;
    let id = null, cx = 0, cy = 0;
    stick.addEventListener('pointerdown', (e) => { id = e.pointerId; stick.setPointerCapture(id); const r = stick.getBoundingClientRect(); cx = r.left + r.width / 2; cy = r.top + r.height / 2; move(e); e.stopPropagation(); });
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = (e.clientX - cx) / 50, dy = (e.clientY - cy) / 50;
      const l = Math.hypot(dx, dy); if (l > 1) { dx /= l; dy /= l; }
      T.x = dx; T.y = dy;
      knob.style.transform = `translate(${dx * 40}px, ${dy * 40}px)`;
    };
    stick.addEventListener('pointermove', move);
    const up = (e) => { if (e.pointerId !== id) return; id = null; T.x = 0; T.y = 0; knob.style.transform = ''; };
    stick.addEventListener('pointerup', up);
    stick.addEventListener('pointercancel', up);
    const btn = (cls, label, key, tap) => {
      const b = h('button.xc-tb.' + cls, {}, label);
      b.addEventListener('pointerdown', (e) => { e.stopPropagation(); b.classList.add('on'); if (tap) tap(); else T[key] = true; });
      const off = () => { b.classList.remove('on'); if (!tap) T[key] = false; };
      b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off); b.addEventListener('pointerleave', off);
      return b;
    };
    this.tbEnter = btn('enter', '🚗', null, () => g.toggleVehicle());
    this.tbGas = btn('gas', '▲', 'gas');
    this.tbBrake = btn('brake', '▼', 'brake');
    this.tbHand = btn('hand', 'Ⓗ', 'hand');
    this.tbSprint = btn('sprint', '🏃', 'sprint');
    this.tbJump = btn('jump', '⤒', null, () => g.jump());
    this.tbHorn = btn('horn', '📯', null, () => g.horn());
    this.root.append(stick, h('div.xc-tbs', {}, [this.tbEnter, this.tbHorn, this.tbHand, this.tbSprint, this.tbJump, this.tbBrake, this.tbGas]));
  }
  setMode(mode) {
    this.root.classList.toggle('in-car', mode === 'car');
  }

  // ---------------------------------------------------------------- texts
  setObjective(html) {
    if (this.objHtml === html) return;
    this.objHtml = html;
    this.objective.innerHTML = html || '';
    this.objective.classList.toggle('show', !!html);
    if (html) { this.objective.classList.remove('pop'); void this.objective.offsetWidth; this.objective.classList.add('pop'); }
  }
  say(who, text, dur = 4.2) {
    const w = WHO[who] || { name: who, color: '#fff' };
    this.sub.innerHTML = `<b style="color:${w.color}">${w.name}:</b> ${text}`;
    this.sub.classList.add('show');
    this.subT = dur;
  }
  phone(who, text, dur = 5) {
    const w = WHO[who] || { name: who, color: '#fff', ini: '?' };
    this.call.innerHTML = `<span class="xc-av" style="background:${w.color}">${w.ini}</span><div><b>${w.name}</b><p>${text}</p></div>`;
    this.call.classList.add('show');
    this.callT = dur;
    this.say(who, text, dur);
  }
  showBanner(title, sub = '', cls = '', dur = 3.5) {
    this.banner.className = 'xc-banner show ' + cls;
    this.banner.innerHTML = `<h1>${title}</h1>${sub ? `<p>${sub}</p>` : ''}`;
    this.bannerT = dur;
  }
  hideBanner() { this.banner.classList.remove('show'); this.bannerT = 0; }
  setHint(html) { this.hint.innerHTML = html || ''; this.hint.classList.toggle('show', !!html); }
  cinematic(on) { this.root.classList.toggle('cine', on); }
  showTarget(on, name = '', hp = 1, info = '') {
    this.target.classList.toggle('show', on);
    if (!on) return;
    this.tName.textContent = name;
    this.tBar.style.width = `${Math.max(0, hp) * 100}%`;
    this.tInfo.textContent = info;
  }
  setSpeed(kmh) {
    this.speed.classList.toggle('show', kmh != null);
    if (kmh != null) this.speed.firstChild.textContent = Math.round(kmh);
  }
  setStars(n, flash = false) {
    [...this.stars.children].forEach((s, i) => s.classList.toggle('on', i < n));
    this.stars.classList.toggle('flash', flash && n > 0);
    this.stars.classList.toggle('show', n > 0);
  }
  setMoney(v) { this.money.textContent = fmtEuro(v); }
  setClock(min) {
    const hh = Math.floor(min / 60) % 24, mm = Math.floor(min % 60);
    this.clock.textContent = `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
  }
  setHealth(v) { this.hp.style.width = `${Math.max(0, v)}%`; this.hp.classList.toggle('low', v < 30); }
  setZone(name) { if (this.zoneName !== name) { this.zoneName = name; this.zone.textContent = name; this.zone.classList.remove('pop'); void this.zone.offsetWidth; this.zone.classList.add('pop'); } }

  update(dt) {
    if (this.subT > 0) { this.subT -= dt; if (this.subT <= 0) this.sub.classList.remove('show'); }
    if (this.callT > 0) { this.callT -= dt; if (this.callT <= 0) this.call.classList.remove('show'); }
    if (this.bannerT > 0) { this.bannerT -= dt; if (this.bannerT <= 0) this.banner.classList.remove('show'); }
  }

  // ---------------------------------------------------------------- radar
  drawRadar(map, pos, camYaw, heading, blips, range = 80) {
    const c = this.radar;
    const css = c.clientWidth || 180;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(css * dpr)) { c.width = c.height = Math.round(css * dpr); }
    const g = this.rctx, W = c.width, R = W / 2;
    const k = map.width / MAP.size; // map px per metre
    const s = R / range / k;
    const fx = Math.sin(camYaw), fz = Math.cos(camYaw);
    const rot = -Math.PI / 2 - Math.atan2(fz, fx);
    g.save();
    g.clearRect(0, 0, W, W);
    g.beginPath(); g.arc(R, R, R - 1, 0, Math.PI * 2); g.clip();
    g.fillStyle = '#20242f'; g.fillRect(0, 0, W, W);
    g.translate(R, R); g.rotate(rot); g.scale(s, s);
    g.translate(-(pos.x - MAP.x0) * k, -(pos.z - MAP.z0) * k);
    g.drawImage(map, 0, 0);
    g.restore();
    // blips
    const cos = Math.cos(rot), sin = Math.sin(rot);
    for (const b of blips) {
      let dx = (b.x - pos.x) / range * R, dz = (b.z - pos.z) / range * R;
      let x = dx * cos - dz * sin, y = dx * sin + dz * cos;
      const l = Math.hypot(x, y);
      const edge = R - 10;
      const out = l > edge;
      if (out) { if (!b.edge) continue; x *= edge / l; y *= edge / l; }
      g.save();
      g.translate(R + x, R + y);
      g.fillStyle = b.color; g.strokeStyle = '#000'; g.lineWidth = 2 * (W / 180);
      const sz = (b.size || 6) * (W / 180);
      g.beginPath();
      if (b.shape === 'square') g.rect(-sz, -sz, sz * 2, sz * 2);
      else g.arc(0, 0, sz, 0, Math.PI * 2);
      g.fill(); g.stroke();
      if (b.label) { g.fillStyle = '#fff'; g.font = `900 ${sz * 1.5}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(b.label, 0, 0.5); }
      g.restore();
    }
    // player arrow (heading relative to the camera)
    g.save();
    g.translate(R, R);
    g.rotate(camYaw - heading);
    const a = 9 * (W / 180);
    g.fillStyle = '#fff'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -a); g.lineTo(a * 0.7, a * 0.8); g.lineTo(0, a * 0.4); g.lineTo(-a * 0.7, a * 0.8); g.closePath(); g.fill(); g.stroke();
    g.restore();
    // north marker
    const north = { x: sin, y: -cos }; // world -z on the rotated radar
    g.fillStyle = '#fff'; g.font = `900 ${11 * (W / 180)}px Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('N', R + north.x * (R - 9 * (W / 180)), R + north.y * (R - 9 * (W / 180)));
  }

  destroy() { this.root.remove(); }
}
