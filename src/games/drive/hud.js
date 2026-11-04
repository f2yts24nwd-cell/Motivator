import { h, mount } from '../../core/ui.js';
import { sfx, isMuted, setMuted } from '../../core/audio.js';
import { CALLERS, fmtEuro } from './content.js';
import { songById } from '../../core/songs.js';

// Driving HUD: speed + speed limit sign, quota bar, mission bar, hands-free call box with answer
// buttons, heading-up minimap, touch pedals and tool buttons.

const MAP = { x0: -470, x1: 1720, z0: -470, z1: 400 };

export function renderStaticMap(world) {
  const W = MAP.x1 - MAP.x0, H = MAP.z1 - MAP.z0;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const g = c.getContext('2d');
  const X = (x) => x - MAP.x0, Z = (z) => z - MAP.z0;
  g.fillStyle = '#1e3320'; g.fillRect(0, 0, W, H);
  // blocks
  for (const b of world.blocks) {
    const col = { park: '#2f5d2b', messepark: '#3c4250', altstadt: '#5a4a44', kirche: '#5a4a44', zentrale: '#2c4a2a', silo: '#3a2f5c', gewerbe: '#3d4450', fraesfix: '#24435c', moertel: '#5c4a2a', tanke: '#3d4450' }[b.kind] || '#3a404a';
    g.fillStyle = col;
    g.fillRect(X(b.x0), Z(b.z0), b.x1 - b.x0, b.z1 - b.z0);
  }
  // buildings
  g.fillStyle = 'rgba(255,255,255,0.13)';
  for (const cl of world.colliders) if (cl.t === 'box' && cl.x1 - cl.x0 > 4) g.fillRect(X(cl.x0), Z(cl.z0), cl.x1 - cl.x0, cl.z1 - cl.z0);
  // roads
  g.strokeStyle = '#c9ccd2'; g.lineCap = 'square';
  for (const r of world.roads) {
    g.lineWidth = r.w;
    g.strokeStyle = r.zone30 ? '#e8c27a' : r.kind === 'land' ? '#f0d58a' : '#c9ccd2';
    g.beginPath(); g.moveTo(X(r.ax), Z(r.az)); g.lineTo(X(r.bx), Z(r.bz)); g.stroke();
  }
  // autobahn
  g.strokeStyle = '#f2b84b'; g.lineWidth = 22; g.lineJoin = 'round';
  g.beginPath();
  world.abPts.forEach((p, i) => (i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))));
  g.stroke();
  g.strokeStyle = '#8a6a2a'; g.lineWidth = 2;
  g.beginPath();
  world.abPts.forEach((p, i) => (i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))));
  g.stroke();
  // labels
  g.fillStyle = 'rgba(255,255,255,0.75)'; g.font = '700 22px system-ui, Arial'; g.textAlign = 'center';
  for (const [t, x, z] of [['Altstadt', -180, -250], ['Messe', 180, -250], ['Zentrale', 0, 30], ['Silo-Tower', 240, -150], ['Gewerbegebiet Süd', 0, 260], ['Westend', -240, 120], ['Industriepark Ost', 1510, -60], ['A-CRM', 900, -220]]) g.fillText(t, X(x), Z(z));
  return c;
}

export class Hud {
  constructor(game) {
    this.game = game;
    const root = this.root = mount(h('div.dr-hud'));
    const btn = (cls, title, text, fn) => h(`button.${cls}`, { title, onclick: (e) => { e.stopPropagation(); sfx.click(); fn(); } }, text);
    root.append(btn('icon-btn.left', 'Zurück zur Spielewelt', '⟵', () => game.app.goHub()));
    this.muteBtn = btn('icon-btn.right', 'Ton an/aus', isMuted() ? '🔇' : '🔊', () => { setMuted(!isMuted()); this.muteBtn.textContent = isMuted() ? '🔇' : '🔊'; game.engineMute?.(isMuted()); });
    this.muteBtn.style.right = 'calc(172px + env(safe-area-inset-right))';
    root.append(this.muteBtn);
    this.limitEl = h('div.dr-limit.passthrough', {}, '50');
    root.append(this.limitEl);
    // quota
    this.quotaTxt = h('b', {}, '0 €');
    this.provTxt = h('b', {}, '0 €');
    this.quotaBar = h('b');
    root.append(h('div.dr-quota.panel.passthrough', {}, [h('small', {}, [h('span', {}, ['Quartal ', this.quotaTxt]), h('span', {}, ['Provision ', this.provTxt])]), h('i', {}, this.quotaBar)]));
    // mission bar
    this.mIcon = h('span.dr-mi'); this.mTitle = h('b'); this.mSub = h('span'); this.mTime = h('div.dr-mt');
    this.missionEl = h('div.dr-mission.panel', {}, [this.mIcon, h('div', {}, [this.mTitle, this.mSub]), this.mTime, h('button.dr-abort', { title: 'Auftrag abbrechen', onclick: () => { sfx.click(); game.abortMission(); } }, '✕')]);
    root.append(this.missionEl);
    // call box
    this.callEl = h('div.dr-call.panel');
    root.append(this.callEl);
    // speedo
    this.spdNum = h('strong', {}, '0');
    this.batBar = h('b');
    this.batTxt = h('span', {}, '');
    this.batEl = h('div.dr-bat', {}, ['🔋', h('i', {}, this.batBar), this.batTxt]);
    this.speedo = h('div.dr-speedo.panel.passthrough', {}, [this.spdNum, h('small', {}, 'km/h'), this.batEl]);
    root.append(this.speedo);
    // minimap
    this.mapC = h('canvas', { width: 300, height: 300 });
    root.append(h('button.dr-map.panel', { title: 'Karte & Aufträge', onclick: () => { sfx.click(); game.openBoard(); } }, this.mapC));
    // tools
    this.tools = h('div.dr-tools', {}, [
      btn('dr-tool', 'Aufträge (Bordcomputer)', '📱', () => game.openBoard()),
      btn('dr-tool', 'Kamera wechseln (C)', '🎥', () => game.nextCamera()),
      btn('dr-tool', 'Hupe (H)', '📯', () => game.honk()),
      btn('dr-tool', 'Autoradio an/aus (P)', '📻', () => game.toggleRadio()),
      btn('dr-tool', 'Abschleppen (R)', '↺', () => game.resetCar())
    ]);
    root.append(this.tools);
    // touch controls
    const pad = (cls, label, key) => {
      const el = h(`div.dr-pad.${cls}`, {}, label);
      const on = (e) => { e.preventDefault(); el.classList.add('on'); game.touch[key] = true; try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ } };
      const off = (e) => { e.preventDefault(); el.classList.remove('on'); game.touch[key] = false; };
      el.addEventListener('pointerdown', on);
      el.addEventListener('pointerup', off);
      el.addEventListener('pointercancel', off);
      el.addEventListener('lostpointercapture', off);
      return el;
    };
    this.left = h('div.dr-ctl.l', {}, [pad('', '◀', 'left'), pad('', '▶', 'right')]);
    this.right = h('div.dr-ctl.r', {}, [pad('brake', '▼', 'brake'), pad('gas', '▲', 'gas')]);
    root.append(this.left, this.right);
    this.setSteerMode(game.P.steer);
    // car radio: "now playing" chip, tap toggles
    const song = songById('crm-cruise');
    this.radioEl = h('button.dr-radio', { title: 'Autoradio an/aus', onclick: (e) => { e.stopPropagation(); sfx.click(); game.toggleRadio(); } }, [
      h('img', { src: song.cover, alt: '' }),
      h('span', {}, [h('small', {}, '📻 Autoradio'), h('b', {}, song.title)]),
      h('i.dr-eq', {}, [h('em'), h('em'), h('em')])
    ]);
    root.append(this.radioEl);
    this.flashEl = h('div.dr-flash');
    root.append(this.flashEl);
    this.rotateEl = h('div.dr-rotate', {}, h('div', {}, [h('div', {}, '📱'), h('p', {}, 'Bitte quer halten. Ludlein fährt sich im Querformat am besten.')]));
    root.append(this.rotateEl);
    if (matchMedia('(pointer: coarse)').matches) this.rotateEl.classList.add('want');
    else { this.left.style.display = 'none'; this.right.style.display = 'none'; }
    this.staticMap = renderStaticMap(game.world);
    this.lastLimit = null;
  }

  radio(on) { this.radioEl.classList.toggle('off', !on); }

  setSteerMode(mode) { this.left.classList.toggle('tilt', mode === 'tilt'); }

  speed(kmh, limit, over) {
    const v = Math.round(kmh);
    if (this._v !== v) { this._v = v; this.spdNum.textContent = String(v); }
    this.speedo.classList.toggle('over', over);
    if (this.lastLimit !== limit) {
      this.lastLimit = limit;
      const free = limit === Infinity;
      this.limitEl.classList.toggle('free', free);
      this.limitEl.textContent = free ? '' : String(limit);
      this.limitEl.animate([{ transform: 'scale(1.35)' }, { transform: 'scale(1)' }], { duration: 300 });
    }
    this.limitEl.classList.toggle('over', over);
  }
  battery(p, charging) {
    if (p == null) { this.batEl.style.display = 'none'; return; }
    this.batEl.style.display = '';
    this.batBar.style.width = `${Math.round(p * 100)}%`;
    this.batTxt.textContent = charging ? `Lädt ${Math.round(p * 100)} %` : `${Math.round(p * 100)} %`;
    this.batEl.classList.toggle('low', p < 0.2);
  }
  quota(rev, quota, prov) {
    this.quotaTxt.textContent = `${fmtEuro(rev)} / ${fmtEuro(quota)}`;
    this.provTxt.textContent = fmtEuro(prov);
    this.quotaBar.style.width = `${Math.min(100, (rev / quota) * 100)}%`;
  }
  mission(m) {
    this.missionEl.classList.toggle('on', !!m);
    if (!m) return;
    this.mIcon.textContent = m.icon;
    this.mTitle.textContent = m.title;
    this.mSub.textContent = m.sub || '';
    this.mTime.textContent = m.time ?? '';
    this.mTime.classList.toggle('low', !!m.low);
  }

  /**
   * Hands-free call. opts: { answers: [..], ok, timeout, onAnswer(i, correct), duration }
   */
  call(who, text, opts = {}) {
    // never interrupt an open question: queue plain calls until it is answered
    if (this.answerKeys && !opts.answers) { (this.queue = this.queue || []).push([who, text, opts]); return; }
    const c = CALLERS[who] || CALLERS.navi;
    clearTimeout(this.callTimer);
    cancelAnimationFrame(this.callRaf);
    sfx.ring();
    const kids = [h('div.dr-face', { style: `--c:${c.color}` }, c.ini), h('div', { style: 'flex:1' }, [h('b', {}, [c.name, h('em', {}, c.role)]), h('p', {}, text)])];
    this.callEl.replaceChildren(...kids);
    this.callEl.classList.add('on');
    const body = kids[1];
    if (opts.answers) {
      let done = false;
      const bar = h('b');
      const finish = (i) => {
        if (done) return;
        done = true;
        cancelAnimationFrame(this.callRaf);
        const right = i === opts.ok;
        buttons.forEach((b, k) => b.classList.add(k === opts.ok ? 'ok' : k === i ? 'no' : 'x'));
        opts.onAnswer?.(i, right);
        this.answerKeys = null;
        this.callTimer = setTimeout(() => {
          this.callEl.classList.remove('on');
          const next = this.queue?.shift();
          if (next) this.call(...next);
        }, 1800);
      };
      const buttons = opts.answers.map((a, i) => h('button', { onclick: (e) => { e.stopPropagation(); sfx.click(); finish(i); } }, `${'ABC'[i]}  ${a}`));
      body.append(h('div.dr-ans', {}, buttons));
      if (opts.timeout) {
        body.append(h('div.dr-tbar', {}, bar));
        const t0 = performance.now();
        const tick = () => {
          const k = 1 - (performance.now() - t0) / (opts.timeout * 1000);
          bar.style.width = `${Math.max(0, k) * 100}%`;
          if (k <= 0) finish(-1); else this.callRaf = requestAnimationFrame(tick);
        };
        tick();
      }
      this.answerKeys = (i) => finish(i);
    } else {
      this.answerKeys = null;
      const dur = opts.duration || Math.min(9000, 2600 + text.length * 45);
      this.callTimer = setTimeout(() => this.callEl.classList.remove('on'), dur);
    }
  }
  hideCall() { clearTimeout(this.callTimer); cancelAnimationFrame(this.callRaf); this.callEl.classList.remove('on'); this.answerKeys = null; this.queue = []; }

  toast(text, sub = '') {
    const el = h('div.dr-toast', {}, [text, sub ? h('small', {}, sub) : null]);
    this.root.append(el);
    setTimeout(() => el.remove(), 1700);
  }
  flash() {
    this.flashEl.classList.add('on');
    requestAnimationFrame(() => requestAnimationFrame(() => this.flashEl.classList.remove('on')));
  }
  countdown(state) {
    this.cd?.remove();
    this.cd = null;
    if (!state) return;
    const cls = { r: ['r', '', ''], y: ['r', 'y', ''], g: ['', '', 'g'] }[state];
    this.cd = h('div.dr-countdown', {}, cls.map((c) => h(`i${c ? '.' + c : ''}`)));
    this.root.append(this.cd);
  }

  /** heading-up minimap */
  drawMap(px, pz, heading, speed, markers) {
    const g = this.mapC.getContext('2d');
    const S = this.mapC.width;
    const radius = 170 + Math.min(1, speed / 45) * 170;
    const k = (S / 2) / radius;
    g.save();
    g.fillStyle = '#1e3320'; g.fillRect(0, 0, S, S);
    g.translate(S / 2, S / 2);
    g.rotate(heading - Math.PI);
    g.scale(k, k);
    g.translate(-(px - MAP.x0), -(pz - MAP.z0));
    g.drawImage(this.staticMap, 0, 0);
    g.restore();
    // markers
    const cos = Math.cos(heading - Math.PI), sin = Math.sin(heading - Math.PI);
    for (const m of markers) {
      const dx = (m.x - px) * k, dz = (m.z - pz) * k;
      let sx = dx * cos - dz * sin, sy = dx * sin + dz * cos;
      const d = Math.hypot(sx, sy);
      const edge = S / 2 - 16;
      const out = d > edge;
      if (out) { if (!m.edge) continue; sx *= edge / d; sy *= edge / d; }
      g.save();
      g.translate(S / 2 + sx, S / 2 + sy);
      g.fillStyle = m.color || '#ffcc4d';
      g.beginPath(); g.arc(0, 0, out ? 10 : m.r || 12, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#111'; g.lineWidth = 3; g.stroke();
      if (m.icon) { g.font = `${out ? 14 : 18}px system-ui`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.icon, 0, 1); }
      g.restore();
    }
    // the player arrow
    g.save();
    g.translate(S / 2, S / 2);
    g.fillStyle = '#ffffff'; g.strokeStyle = '#50af30'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(0, -16); g.lineTo(11, 12); g.lineTo(0, 6); g.lineTo(-11, 12); g.closePath(); g.fill(); g.stroke();
    g.restore();
  }

  /** whole map for the mission board */
  bigMap(canvas, px, pz, markers) {
    const g = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const sm = this.staticMap;
    const k = Math.min(W / sm.width, H / sm.height);
    const ox = (W - sm.width * k) / 2, oy = (H - sm.height * k) / 2;
    g.fillStyle = '#0b1220'; g.fillRect(0, 0, W, H);
    g.drawImage(sm, ox, oy, sm.width * k, sm.height * k);
    const P = (x, z) => [ox + (x - MAP.x0) * k, oy + (z - MAP.z0) * k];
    for (const m of markers) {
      const [x, y] = P(m.x, m.z);
      g.fillStyle = m.color || '#ffcc4d';
      g.beginPath(); g.arc(x, y, m.r || 15, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#111'; g.lineWidth = 3; g.stroke();
      if (m.icon) { g.font = '18px system-ui'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(m.icon, x, y + 1); }
    }
    const [x, y] = P(px, pz);
    g.fillStyle = '#fff'; g.beginPath(); g.arc(x, y, 9, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#50af30'; g.lineWidth = 4; g.stroke();
  }

  destroy() { clearTimeout(this.callTimer); cancelAnimationFrame(this.callRaf); this.root.remove(); }
}
