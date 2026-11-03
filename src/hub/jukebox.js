import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture } from '../core/gfx.js';
import { sfx, music, unlockAudio } from '../core/audio.js';
import { h, mount, storeGet, storeSet } from '../core/ui.js';
import { SONGS } from '../core/songs.js';

// The office jukebox: a glowing retro 3D model plus a panel with the playlist from core/songs.js.
// Songs play through the music bus (mute applies) one after another; the playlist repeats.

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const fmtTime = (s) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

export function buildJukebox() {
  const g = new THREE.Group();
  const wood = new THREE.MeshPhysicalMaterial({ color: 0x5a2410, roughness: 0.35, clearcoat: 1, clearcoatRoughness: 0.15 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xdfe6f0, metalness: 1, roughness: 0.18 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14100e, roughness: 0.6 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  // body + arched top
  add(new RoundedBoxGeometry(1.7, 1.75, 1.0, 3, 0.08), wood, 0, 0.88, 0);
  // half cylinder: axis along z, rounded side up
  const archGeo = new THREE.CylinderGeometry(0.85, 0.85, 1.0, 40, 1, false, 0, Math.PI);
  archGeo.rotateX(Math.PI / 2);
  archGeo.rotateZ(Math.PI / 2);
  add(archGeo, wood, 0, 1.75, 0);
  // neon tubes: outer arch + two side pillars (colour cycles in update)
  const neonMats = [0, 1, 2].map(() => new THREE.MeshBasicMaterial({ color: 0xff3d9a, toneMapped: false }));
  const tube = add(new THREE.TorusGeometry(0.86, 0.055, 10, 48, Math.PI), neonMats[0], 0, 1.75, 0.51);
  tube.castShadow = false;
  const inner = add(new THREE.TorusGeometry(0.62, 0.04, 10, 48, Math.PI), neonMats[1], 0, 1.75, 0.52);
  inner.castShadow = false;
  for (const x of [-0.86, 0.86]) { const p = add(new THREE.CylinderGeometry(0.055, 0.055, 1.6, 10), neonMats[2], x, 0.95, 0.51); p.castShadow = false; }
  // glass dome with the spinning record behind it
  const glass = add(new THREE.CircleGeometry(0.6, 40, 0, Math.PI), new THREE.MeshPhysicalMaterial({ color: 0x223044, transparent: true, opacity: 0.35, roughness: 0.05, metalness: 0.2, clearcoat: 1 }), 0, 1.75, 0.505);
  glass.castShadow = false;
  const labelTex = canvasTexture(256, 256, (c, w) => {
    c.fillStyle = '#0b0b0d'; c.beginPath(); c.arc(w / 2, w / 2, w / 2, 0, Math.PI * 2); c.fill();
    c.strokeStyle = 'rgba(255,255,255,0.08)'; c.lineWidth = 2;
    for (let r = 40; r < w / 2; r += 6) { c.beginPath(); c.arc(w / 2, w / 2, r, 0, Math.PI * 2); c.stroke(); }
    c.fillStyle = '#50af30'; c.beginPath(); c.arc(w / 2, w / 2, 36, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#fff'; c.font = `900 30px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('X', w / 2, w / 2 + 1);
  });
  const record = add(new THREE.CircleGeometry(0.42, 40), new THREE.MeshStandardMaterial({ map: labelTex, roughness: 0.3, metalness: 0.3 }), 0, 1.9, 0.47);
  record.castShadow = false;
  // title display (canvas, scrolling)
  const dispCanvas = document.createElement('canvas');
  dispCanvas.width = 512; dispCanvas.height = 96;
  const dispTex = new THREE.CanvasTexture(dispCanvas);
  dispTex.colorSpace = THREE.SRGBColorSpace;
  const disp = add(new THREE.PlaneGeometry(1.3, 0.24), new THREE.MeshBasicMaterial({ map: dispTex, toneMapped: false, color: new THREE.Color(1.4, 1.4, 1.4) }), 0, 1.38, 0.505);
  disp.castShadow = false;
  // chrome trim + speaker grille + selector buttons
  add(new THREE.BoxGeometry(1.74, 0.06, 1.04), chrome, 0, 1.2, 0);
  add(new THREE.BoxGeometry(1.74, 0.06, 1.04), chrome, 0, 0.12, 0);
  const grilleTex = canvasTexture(256, 256, (c, w, hh) => {
    c.fillStyle = '#1a0d08'; c.fillRect(0, 0, w, hh);
    for (let y = 8; y < hh; y += 16) for (let x = 8 + ((y / 16) % 2) * 8; x < w; x += 16) { c.fillStyle = '#3a2418'; c.beginPath(); c.arc(x, y, 5, 0, Math.PI * 2); c.fill(); }
  });
  add(new THREE.PlaneGeometry(1.3, 0.8), new THREE.MeshStandardMaterial({ map: grilleTex, roughness: 0.9 }), 0, 0.62, 0.505).castShadow = false;
  const btnCols = [0xff3b5c, 0xffcc4d, 0x19c3ff, 0x3ddc84, 0xa46bff];
  btnCols.forEach((c, i) => add(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 16), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: 0.6 }), -0.4 + i * 0.2, 1.08, 0.52).rotation.x = Math.PI / 2);
  add(new THREE.BoxGeometry(1.4, 0.16, 0.12), dark, 0, 1.08, 0.47);
  // floor glow + light
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({ color: 0xff3d9a, transparent: true, opacity: 0.25, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.015, 0.6);
  g.add(glow);
  const light = new THREE.PointLight(0xff3d9a, 6, 7, 1.8);
  light.position.set(0, 1.6, 1.2);
  g.add(light);
  // floating music notes
  const noteTex = canvasTexture(64, 64, (c) => { c.fillStyle = '#fff'; c.font = `900 52px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('♪', 32, 34); });
  const notes = [0, 1, 2, 3].map((i) => {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: noteTex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(btnCols[i]).multiplyScalar(1.6) }));
    sp.scale.setScalar(0.35);
    g.add(sp);
    return sp;
  });

  const pickables = [];
  g.traverse((o) => { if (o.isMesh && o !== glow) pickables.push(o); });

  let title = '';
  let scroll = 0;
  function drawDisplay(playing) {
    const c = dispCanvas.getContext('2d');
    const w = dispCanvas.width, hh = dispCanvas.height;
    c.fillStyle = '#0a0612'; c.fillRect(0, 0, w, hh);
    c.font = `800 46px ${FONT}`;
    c.textBaseline = 'middle';
    c.fillStyle = playing ? '#ffd27a' : '#8a7fa8';
    const text = playing ? `♪ ${title}   ·   ` : 'JUKEBOX · ANTIPPEN   ·   ';
    const tw = c.measureText(text).width;
    for (let x = -(scroll % tw); x < w; x += tw) c.fillText(text, x, hh / 2 + 2);
    dispTex.needsUpdate = true;
  }
  drawDisplay(false);

  let acc = 0;
  return {
    group: g,
    pickables,
    setTitle(t) { title = t; },
    update(dt, time, playing) {
      record.rotation.z -= dt * (playing ? 3.5 : 0);
      const hue = (time * (playing ? 0.12 : 0.04)) % 1;
      neonMats.forEach((m, i) => m.color.setHSL((hue + i * 0.12) % 1, 1, 0.55).multiplyScalar(playing ? 2.2 + Math.sin(time * 8 + i) * 0.4 : 1.4));
      light.color.setHSL(hue, 1, 0.55);
      light.intensity = playing ? 7 + Math.sin(time * 8) * 2 : 3.5;
      glow.material.color.setHSL(hue, 1, 0.5);
      glow.material.opacity = playing ? 0.3 + Math.sin(time * 8) * 0.08 : 0.16;
      notes.forEach((n, i) => {
        const k = (time * 0.35 + i / notes.length) % 1;
        n.visible = playing;
        n.position.set(Math.sin(time + i * 2) * 0.6 + (i - 1.5) * 0.2, 2.4 + k * 1.6, 0.4);
        n.material.opacity = Math.sin(k * Math.PI);
      });
      acc += dt;
      if (acc > 1 / 20) { acc = 0; scroll += playing ? 4 : 1.5; drawDisplay(playing); }
    }
  };
}

// ------------------------------------------------------------------ playlist logic + panel
export class JukeboxPlayer {
  constructor() {
    this.index = Math.min(storeGet('jukebox-index', 0), SONGS.length - 1);
    this.panel = null;
    music.onSongEnd = (url) => {
      if (SONGS[this.index]?.src !== url) return;
      this.next(true);
    };
  }

  get current() { return SONGS[this.index]; }
  /** is one of the jukebox songs playing right now? */
  get playing() {
    const st = music.songState();
    return st.playing && SONGS.some((s) => s.src === st.url);
  }

  play(i = this.index, restart = false) {
    unlockAudio();
    this.index = (i + SONGS.length) % SONGS.length;
    storeSet('jukebox-index', this.index);
    // one song in the list: loop it, otherwise continue with the next one at the end
    music.playSong(this.current.src, { restart, loop: SONGS.length === 1 });
    this.render();
  }

  pause() {
    music.stopSong(0.6);
    setTimeout(() => { if (!this.playing) music.play('hub'); }, 700);
    this.render();
  }

  toggle() { if (this.playing) this.pause(); else this.play(this.index); }
  next(auto = false) { this.play(this.index + 1, true); if (!auto) sfx.click(); }
  prev() {
    const st = music.songState();
    if (st.t > 4 && this.playing) { music.seekSong(0); return; }
    this.play(this.index - 1, true);
    sfx.click();
  }

  open() {
    if (this.panel) return;
    sfx.pop();
    this.panel = mount(h('div.jb-panel.panel', {}));
    this.render();
  }

  close() {
    this.panel?.remove();
    this.panel = null;
  }

  render() {
    const P = this.panel;
    if (!P) return;
    const cur = this.current;
    const playing = this.playing;
    this.bar = h('i');
    this.timeEl = h('span.jb-time', {}, '0:00 / 0:00');
    const seek = h('div.jb-seek', {
      onclick: (e) => {
        const r = seek.getBoundingClientRect();
        const st = music.songState();
        if (!st.dur || st.url !== cur.src) return;
        music.seekSong(((e.clientX - r.left) / r.width) * st.dur);
        this.tick();
      }
    }, this.bar);
    P.replaceChildren(
      h('div.jb-head', {}, [
        h('div', {}, [h('div.kicker', {}, 'itmX Spielewelt'), h('b', {}, '🎵 Jukebox')]),
        h('button.kr-close', { title: 'Schließen', onclick: () => { sfx.click(); this.close(); } }, '✕')
      ]),
      h(`div.jb-now${playing ? '.on' : ''}`, {}, [
        h('img', { src: cur.cover, alt: '' }),
        h('div', {}, [h('small', {}, playing ? '♪ Läuft gerade' : 'Ausgewählt'), h('b', {}, cur.title), h('span', {}, cur.artist)])
      ]),
      seek,
      this.timeEl,
      h('div.jb-ctrl', {}, [
        h('button', { title: 'Zurück', onclick: () => this.prev() }, '⏮'),
        h('button.jb-play', { title: playing ? 'Pause' : 'Abspielen', onclick: () => { sfx.click(); this.toggle(); } }, playing ? '⏸' : '▶'),
        h('button', { title: 'Weiter', onclick: () => this.next() }, '⏭')
      ]),
      h('div.jb-listhead', {}, `${SONGS.length} ${SONGS.length === 1 ? 'Lied' : 'Lieder'} · weitere folgen`),
      h('div.jb-list', {}, SONGS.map((s, i) => h(`button.jb-song${i === this.index ? '.sel' : ''}`, { onclick: () => { sfx.click(); this.play(i, i !== this.index); } }, [
        h('img', { src: s.cover, alt: '' }),
        h('span', {}, [h('b', {}, [s.title, s.neu ? h('em', {}, 'NEU') : null]), h('small', {}, s.note || s.artist)]),
        h('span.jb-dur', {}, i === this.index && playing ? '♪' : s.duration ? fmtTime(s.duration) : '')
      ])))
    );
    this.tick();
  }

  /** progress bar, called from the hub loop */
  tick() {
    if (!this.panel || !this.bar) return;
    const st = music.songState();
    const mine = st.url === this.current.src;
    const dur = mine && st.dur ? st.dur : this.current.duration || 0;
    const t = mine ? st.t : 0;
    this.bar.style.width = `${dur ? (t / dur) * 100 : 0}%`;
    this.timeEl.textContent = `${fmtTime(t)} / ${fmtTime(dur)}`;
  }
}
