import * as THREE from 'three';
import { boardSnapshot } from '../plantafel/app.js';
import { ensureFonts, FONT_UI, FONT_NUM } from '../plantafel/fonts.js';

// The plan board in the office: a mobile whiteboard on castors. Its face shows the real plan
// of the next working day (same data as the Plantafel app). Tapping it opens the app.

const TW = 1200, TH = 800;
const C = { bg: '#F4F6F5', ink: '#121816', mute: '#64706B', line: '#D1D8D5', soft: '#E2E7E5', accent: '#2C44DE', warn: '#B4650C' };

function fit(c, text, maxW) {
  if (c.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && c.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}

function drawBoard(c, s) {
  c.clearRect(0, 0, TW, TH);
  const g = c.createLinearGradient(0, 0, TW, TH);
  g.addColorStop(0, '#FAFBFB'); g.addColorStop(0.55, C.bg); g.addColorStop(1, '#E9EDEB');
  c.fillStyle = g; c.fillRect(0, 0, TW, TH);
  c.textBaseline = 'alphabetic';

  // eyebrow + cobalt magnet
  c.fillStyle = C.mute; c.font = `500 26px ${FONT_NUM}`;
  c.fillText(`PLANTAFEL · KW ${s.kw}`, 104, 82);
  c.fillStyle = C.accent; c.font = `600 24px ${FONT_NUM}`;
  c.textAlign = 'right'; c.fillText('ANTIPPEN ZUM ÖFFNEN', TW - 104, 82); c.textAlign = 'left';

  // day
  c.fillStyle = C.ink; c.font = `800 96px ${FONT_UI}`;
  c.fillText(s.label, 60, 182);
  const lw = c.measureText(s.label).width;
  c.fillStyle = C.mute; c.font = `500 34px ${FONT_UI}`;
  c.fillText(s.label === s.weekday ? s.date : `${s.weekday}, ${s.date}`, 60 + lw + 24, 180);
  c.font = `400 26px ${FONT_NUM}`;
  c.fillText(s.meta, 64, 232);

  // the thread
  const top = 290, bottom = 662;
  const shown = s.stops.slice(0, 6);
  if (!shown.length) {
    c.fillStyle = C.ink; c.font = `800 60px ${FONT_UI}`;
    c.fillText('Noch frei.', 64, 420);
    c.fillStyle = C.mute; c.font = `400 32px ${FONT_UI}`;
    c.fillText('Tippe die Tafel an und sag, wen du sehen willst.', 64, 476);
  } else {
    const rows = shown.length + 2;
    const step = Math.min(66, (bottom - top) / (rows - 1));
    const lx = 196;
    const ys = Array.from({ length: rows }, (_, i) => top + i * step);
    c.strokeStyle = C.ink; c.lineWidth = 4; c.lineCap = 'round';
    c.beginPath(); c.moveTo(lx, ys[0]); c.lineTo(lx, ys[rows - 1]); c.stroke();
    const row = (y, time, label, sub, kind, st = {}) => {
      c.textAlign = 'right'; c.fillStyle = kind === 'end' || st.done ? C.mute : C.ink; c.font = `${kind === 'end' ? 400 : 500} 28px ${FONT_NUM}`;
      if (time) c.fillText(time, lx - 34, y + 10);
      c.textAlign = 'left';
      if (kind === 'end') { c.fillStyle = C.ink; c.beginPath(); c.arc(lx, y, 8, 0, Math.PI * 2); c.fill(); }
      else {
        c.fillStyle = st.cur ? C.accent : st.done ? C.mute : C.bg;
        c.strokeStyle = st.cur ? C.accent : st.done ? C.mute : C.ink; c.lineWidth = 4;
        c.beginPath();
        if (st.fix) c.roundRect ? c.roundRect(lx - 13, y - 13, 26, 26, 5) : c.rect(lx - 13, y - 13, 26, 26);
        else c.arc(lx, y, 13, 0, Math.PI * 2);
        c.fill(); c.stroke();
      }
      c.fillStyle = kind === 'end' || st.done ? C.mute : C.ink;
      c.font = kind === 'end' ? `400 28px ${FONT_UI}` : `700 36px ${FONT_UI}`;
      const t = fit(c, label, 560);
      c.fillText(t, lx + 40, y + 12);
      if (sub) {
        const w = c.measureText(t).width;
        c.fillStyle = C.mute; c.font = `400 28px ${FONT_UI}`;
        c.fillText(fit(c, sub, TW - (lx + 40 + w + 18) - 64), lx + 40 + w + 18, y + 12);
      }
    };
    row(ys[0], s.depart, 'Abfahrt · Büro Offenbach', '', 'end');
    shown.forEach((st, i) => row(ys[i + 1], st.t, st.name, st.ort, 'stop', st));
    const more = s.stops.length - shown.length;
    row(ys[rows - 1], s.home, more > 0 ? `+${more} weitere · zurück` : 'Zurück', '', 'end');
  }

  // AI line
  const y0 = 690;
  c.fillStyle = C.soft;
  c.beginPath(); c.roundRect ? c.roundRect(48, y0, TW - 96, 70, 20) : c.rect(48, y0, TW - 96, 70); c.fill();
  c.fillStyle = s.warn ? C.warn : C.accent;
  c.beginPath(); c.arc(84, y0 + 35, 9, 0, Math.PI * 2); c.fill();
  c.fillStyle = C.ink; c.font = `500 28px ${FONT_UI}`;
  c.fillText(fit(c, s.insight, TW - 96 - 80), 110, y0 + 45);
}

export function buildPlanBoard() {
  const g = new THREE.Group();
  const alu = new THREE.MeshStandardMaterial({ color: 0xc9d0d6, metalness: 0.85, roughness: 0.32 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f27, roughness: 0.6 });
  const cobalt = new THREE.MeshStandardMaterial({ color: 0x2c44de, emissive: 0x2c44de, emissiveIntensity: 0.5, roughness: 0.4 });
  const add = (geo, mat, x, y, z) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true; g.add(m); return m; };

  const BW = 3.0, BH = 2.0, CY = 2.45;
  // board face
  const canvas = document.createElement('canvas');
  canvas.width = TW; canvas.height = TH;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  // unlit and slightly dimmed: stays readable and does not trigger the bloom pass
  const faceMat = new THREE.MeshBasicMaterial({ map: tex, color: new THREE.Color(0.74, 0.74, 0.74) });
  const face = add(new THREE.PlaneGeometry(BW, BH), faceMat, 0, CY, 0.031);
  face.castShadow = false;
  add(new THREE.BoxGeometry(BW, BH, 0.06), dark, 0, CY, 0);
  // aluminium frame
  const f = 0.06;
  add(new THREE.BoxGeometry(BW + f * 2, f, 0.1), alu, 0, CY + BH / 2 + f / 2, 0);
  add(new THREE.BoxGeometry(BW + f * 2, f, 0.1), alu, 0, CY - BH / 2 - f / 2, 0);
  add(new THREE.BoxGeometry(f, BH, 0.1), alu, -BW / 2 - f / 2, CY, 0);
  add(new THREE.BoxGeometry(f, BH, 0.1), alu, BW / 2 + f / 2, CY, 0);
  // pen tray with two markers
  add(new THREE.BoxGeometry(1.2, 0.05, 0.16), alu, 0.6, CY - BH / 2 - 0.09, 0.08);
  const pen = new THREE.CylinderGeometry(0.022, 0.022, 0.32, 10); pen.rotateZ(Math.PI / 2);
  add(pen, dark, 0.35, CY - BH / 2 - 0.045, 0.1);
  add(pen, cobalt, 0.78, CY - BH / 2 - 0.045, 0.1);
  // stand: two posts, feet, castors
  for (const x of [-BW / 2 - 0.16, BW / 2 + 0.16]) {
    add(new THREE.CylinderGeometry(0.035, 0.035, 3.45, 12), alu, x, 1.82, 0);
    add(new THREE.BoxGeometry(0.06, 0.06, 0.06), alu, x - Math.sign(x) * 0.06, CY, 0); // clamp
    add(new THREE.BoxGeometry(0.08, 0.06, 1.1), alu, x, 0.13, 0);
    for (const z of [-0.5, 0.5]) {
      const w = add(new THREE.CylinderGeometry(0.06, 0.06, 0.05, 14), dark, x, 0.06, z);
      w.rotation.z = Math.PI / 2;
    }
  }
  add(new THREE.CylinderGeometry(0.025, 0.025, BW + 0.32, 10), alu, 0, 0.5, 0).rotation.z = Math.PI / 2;
  // cobalt magnets in the corners
  for (const [x, y] of [[-BW / 2 + 0.14, CY + BH / 2 - 0.14], [BW / 2 - 0.14, CY + BH / 2 - 0.14]]) {
    add(new THREE.CylinderGeometry(0.06, 0.06, 0.04, 16), cobalt, x, y, 0.05).rotation.x = Math.PI / 2;
  }
  // floor glow so the board is easy to find
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.7, 40), new THREE.MeshBasicMaterial({ color: 0x4a62ff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.015, 0.9);
  g.add(glow);

  const pickables = [];
  g.traverse((o) => { if (o.isMesh && o !== glow) pickables.push(o); });

  const ctx = canvas.getContext('2d');
  function refresh() {
    try { drawBoard(ctx, boardSnapshot()); tex.needsUpdate = true; } catch (e) { console.warn('Plantafel', e); }
  }
  refresh();
  ensureFonts().then(refresh);

  return {
    group: g,
    pickables,
    refresh,
    update(dt, time, near) {
      glow.material.opacity = (near ? 0.42 : 0.18) + Math.sin(time * 2.2) * 0.05;
    }
  };
}
