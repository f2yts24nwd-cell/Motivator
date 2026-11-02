import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, drawBrand, roundRect } from '../../core/gfx.js';
import { BP_HEADS } from './content.js';

const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

const flameTex = canvasTexture(128, 128, (g, w) => {
  const r = g.createRadialGradient(w / 2, w / 2, 2, w / 2, w / 2, w / 2);
  r.addColorStop(0, 'rgba(255,255,230,1)');
  r.addColorStop(0.25, 'rgba(255,200,60,0.95)');
  r.addColorStop(0.6, 'rgba(255,80,10,0.6)');
  r.addColorStop(1, 'rgba(255,40,0,0)');
  g.fillStyle = r;
  g.fillRect(0, 0, w, w);
});

// ================================================================== the CRX of CRM systems
/**
 * Stylised 80s hatchback in Ludlein livery: wedge nose, Kamm tail, rear spoiler,
 * neon underglow and a ridiculously big exhaust. Front points to +x.
 */
export function buildCRX() {
  const group = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({ color: 0xd3141c, metalness: 0.5, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.05 });
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x0b1324, metalness: 0.2, roughness: 0.05, clearcoat: 1 });
  const black = new THREE.MeshStandardMaterial({ color: 0x111317, roughness: 0.6 });
  const chrome = new THREE.MeshStandardMaterial({ color: 0xe8edf5, metalness: 1, roughness: 0.12 });
  const W = 1.7;

  // body: side profile extruded across the width
  const s = new THREE.Shape();
  s.moveTo(2.0, 0.22);
  s.lineTo(2.08, 0.5);
  s.lineTo(1.95, 0.64);
  s.lineTo(0.72, 0.84);
  s.lineTo(0.05, 1.24);
  s.lineTo(-1.0, 1.2);
  s.lineTo(-1.82, 0.92);
  s.lineTo(-1.98, 0.56);
  s.lineTo(-1.96, 0.22);
  s.lineTo(2.0, 0.22);
  const bodyGeo = new THREE.ExtrudeGeometry(s, { depth: W, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.05, bevelSegments: 3 });
  bodyGeo.translate(0, 0, -W / 2);
  const body = new THREE.Mesh(bodyGeo, paint);
  body.castShadow = true;
  group.add(body);

  // side windows: a slightly wider greenhouse, so it only shows on the flanks
  const wnd = new THREE.Shape();
  wnd.moveTo(0.62, 0.88);
  wnd.lineTo(0.08, 1.17);
  wnd.lineTo(-0.98, 1.13);
  wnd.lineTo(-1.7, 0.92);
  wnd.lineTo(-1.6, 0.86);
  wnd.lineTo(0.62, 0.88);
  const wGeo = new THREE.ExtrudeGeometry(wnd, { depth: W + 0.14, bevelEnabled: false });
  wGeo.translate(0, 0, -(W + 0.14) / 2);
  group.add(new THREE.Mesh(wGeo, glass));
  // windshield + rear glass, laid along the roof slopes and lifted a little off the paint
  const slopeGlass = (x0, y0, x1, y1, width) => {
    const len = Math.hypot(x1 - x0, y1 - y0);
    let a = Math.atan2(y1 - y0, x1 - x0); // slope angle of the edge
    if (Math.cos(a) < 0) a += Math.PI; // keep the face normal pointing up
    const geo = new THREE.PlaneGeometry(len, width);
    geo.rotateX(-Math.PI / 2);
    geo.rotateZ(a);
    const m = new THREE.Mesh(geo, glass);
    const nx = -Math.sin(a), ny = Math.cos(a);
    m.position.set((x0 + x1) / 2 + nx * 0.06, (y0 + y1) / 2 + ny * 0.06, 0);
    return m;
  };
  group.add(slopeGlass(0.72, 0.84, 0.05, 1.24, W - 0.1));
  group.add(slopeGlass(-1.0, 1.2, -1.82, 0.92, W - 0.12));

  // wheels
  const wheels = [];
  const tyreGeo = new THREE.CylinderGeometry(0.37, 0.37, 0.3, 28);
  const rimGeo = new THREE.CylinderGeometry(0.24, 0.24, 0.32, 18);
  for (const x of [1.25, -1.25]) for (const z of [W / 2, -W / 2]) {
    const wg = new THREE.Group();
    const tyre = new THREE.Mesh(tyreGeo, black);
    tyre.rotation.x = Math.PI / 2;
    const rim = new THREE.Mesh(rimGeo, chrome);
    rim.rotation.x = Math.PI / 2;
    wg.add(tyre, rim);
    // spokes so the rotation is visible
    for (let i = 0; i < 3; i++) {
      const sp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.34), black);
      sp.rotation.z = (i / 3) * Math.PI;
      wg.add(sp);
    }
    wg.position.set(x, 0.37, z);
    group.add(wg);
    wheels.push(wg);
  }
  // spoiler
  const spoiler = new THREE.Mesh(new THREE.BoxGeometry(0.36, 0.05, W + 0.1), black);
  spoiler.position.set(-1.78, 1.12, 0);
  spoiler.rotation.z = 0.12;
  group.add(spoiler);
  for (const z of [0.6, -0.6]) {
    const st = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.16, 0.06), black);
    st.position.set(-1.76, 1.02, z);
    group.add(st);
  }
  // lights
  const headMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 2.4, 2.1), toneMapped: false });
  const tailMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(2.8, 0.15, 0.2), toneMapped: false });
  for (const z of [0.55, -0.55]) {
    const hl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.1, 0.42), headMat);
    hl.position.set(2.06, 0.55, z);
    group.add(hl);
    const tl = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.14, 0.5), tailMat);
    tl.position.set(-2.02, 0.7, z);
    group.add(tl);
  }
  // the fat exhaust
  const exhaust = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.17, 0.7, 24, 1, true), chrome);
  exhaust.rotation.z = Math.PI / 2;
  exhaust.position.set(-2.2, 0.3, 0.45);
  exhaust.material.side = THREE.DoubleSide;
  group.add(exhaust);
  const hole = new THREE.Mesh(new THREE.CircleGeometry(0.17, 24), new THREE.MeshBasicMaterial({ color: 0x050505 }));
  hole.rotation.y = -Math.PI / 2;
  hole.position.set(-2.5, 0.3, 0.45);
  group.add(hole);

  // Ludlein livery with the itmX logo on both doors
  const decal = canvasTexture(1024, 256, (g, w, hh) => {
    g.clearRect(0, 0, w, hh);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    g.beginPath(); g.moveTo(0, 170); g.lineTo(w, 120); g.lineTo(w, 150); g.lineTo(0, 200); g.fill();
    g.font = `italic 900 104px ${FONT}`;
    g.textBaseline = 'middle';
    g.lineWidth = 10; g.strokeStyle = '#111';
    g.strokeText('LUDLEIN', 230, 82);
    g.fillStyle = '#ffffff';
    g.fillText('LUDLEIN', 230, 82);
    drawBrand(g, 40, 18, 160, 140);
  });
  for (const side of [1, -1]) {
    const d = new THREE.Mesh(new THREE.PlaneGeometry(3.0, 0.75), new THREE.MeshBasicMaterial({ map: decal, transparent: true, depthWrite: false }));
    d.position.set(0.0, 0.58, side * (W / 2 + 0.056));
    if (side < 0) d.rotation.y = Math.PI;
    group.add(d);
  }
  // underglow
  const glowTex = canvasTexture(256, 128, (g, w, hh) => {
    const r = g.createRadialGradient(w / 2, hh / 2, 4, w / 2, hh / 2, w / 2);
    r.addColorStop(0, 'rgba(80,255,120,0.9)');
    r.addColorStop(1, 'rgba(80,255,120,0)');
    g.fillStyle = r;
    g.fillRect(0, 0, w, hh);
  });
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(5, 2.8), new THREE.MeshBasicMaterial({ map: glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = 0.03;
  group.add(glow);

  // backfire flames
  const flames = [];
  for (let i = 0; i < 3; i++) {
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: flameTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, color: new THREE.Color(2, 1.6, 1.2) }));
    f.position.set(-2.6 - i * 0.35, 0.3, 0.45);
    f.scale.setScalar(0.001);
    group.add(f);
    flames.push(f);
  }
  return { group, wheels, flames, glow };
}

/** Animates wheels and flames. speed: units/s, fire: 0..1 flame strength. */
export function animateCRX(car, dt, time, speed, fire) {
  for (const w of car.wheels) w.rotation.z -= (speed / 0.37) * dt;
  car.flames.forEach((f, i) => {
    const flick = 0.6 + Math.random() * 0.6;
    const s = fire > 0 ? fire * (1.1 - i * 0.25) * flick : 0.001;
    f.scale.setScalar(Math.max(0.001, s));
    f.material.opacity = fire > 0 ? 0.9 - i * 0.2 : 0;
  });
  car.glow.material.opacity = 0.7 + Math.sin(time * 6) * 0.2;
}

// ================================================================== boss: SAP Business Partner
function labelTexture(text, color) {
  return canvasTexture(512, 128, (g, w, hh) => {
    g.font = `900 64px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 12; g.strokeStyle = 'rgba(0,0,0,0.8)';
    g.strokeText(text, w / 2, hh / 2);
    g.fillStyle = color;
    g.fillText(text, w / 2, hh / 2);
  });
}

/** Three-headed master data monster. Each head is a separate target with hit points. */
export function buildBP() {
  const group = new THREE.Group();
  const bodyMat = new THREE.MeshPhysicalMaterial({ color: 0x1c44a8, roughness: 0.4, clearcoat: 0.6, clearcoatRoughness: 0.3 });
  const body = new THREE.Mesh(new THREE.SphereGeometry(1.7, 40, 28), bodyMat);
  body.scale.set(1.25, 1, 0.9);
  body.position.y = 1.6;
  body.castShadow = true;
  group.add(body);
  // belly badge
  const belly = canvasTexture(512, 300, (g, w, hh) => {
    g.fillStyle = '#ffffff';
    g.beginPath(); g.ellipse(w / 2, hh / 2, w / 2 - 6, hh / 2 - 6, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#2456c9';
    g.font = `900 150px ${FONT}`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText('BP', w / 2, hh / 2 - 22);
    g.font = `800 38px ${FONT}`;
    g.fillText('BUSINESS PARTNER', w / 2, hh / 2 + 78);
  });
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(1.9, 1.1), new THREE.MeshStandardMaterial({ map: belly, transparent: true, roughness: 0.6, color: 0xcfd8ea }));
  badge.position.set(0, 1.45, 1.5);
  badge.rotation.x = -0.12;
  group.add(badge);
  // stubby arms
  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 1.9, 2.0, 0.2);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.3, 1.0, 6, 14), bodyMat);
    arm.position.y = -0.6;
    pivot.add(arm);
    const fist = new THREE.Mesh(new THREE.SphereGeometry(0.38, 20, 14), bodyMat);
    fist.position.y = -1.3;
    pivot.add(fist);
    pivot.rotation.z = s * 0.5;
    group.add(pivot);
    arms.push(pivot);
  }
  // feet
  for (const s of [-1, 1]) {
    const f = new THREE.Mesh(new THREE.SphereGeometry(0.55, 20, 12), bodyMat);
    f.scale.set(1, 0.45, 1.3);
    f.position.set(s * 0.9, 0.2, 0.3);
    group.add(f);
  }

  const eyeWhite = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.1, clearcoat: 1 });
  const pupilMat = new THREE.MeshStandardMaterial({ color: 0x050505, roughness: 0.2 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x14080a, roughness: 0.6 });
  const toothMat = new THREE.MeshStandardMaterial({ color: 0xfffbea, roughness: 0.3 });
  const gold = new THREE.MeshStandardMaterial({ color: 0xffc93c, metalness: 1, roughness: 0.2, emissive: 0x5a3a00, emissiveIntensity: 0.4 });
  const heads = BP_HEADS.map((def, i) => {
    const x = (i - 1) * 1.6;
    const y = i === 1 ? 4.35 : 3.75;
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.42, 1.6, 16), bodyMat);
    neck.position.set(x * 0.7, (y + 2.4) / 2, 0);
    neck.rotation.z = -x * 0.25;
    group.add(neck);
    const pivot = new THREE.Group();
    pivot.position.set(x, y, 0.1);
    group.add(pivot);
    const mat = new THREE.MeshPhysicalMaterial({ color: def.color, roughness: 0.3, clearcoat: 1, emissive: def.color, emissiveIntensity: 0 });
    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.78, 32, 24), mat);
    skull.castShadow = true;
    pivot.add(skull);
    // googly eyes
    const pupils = [];
    for (const s of [-1, 1]) {
      const e = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 14), eyeWhite);
      e.position.set(s * 0.28, 0.18, 0.62);
      pivot.add(e);
      const p = new THREE.Mesh(new THREE.SphereGeometry(0.11, 14, 10), pupilMat);
      p.position.set(s * 0.28, 0.15, 0.84);
      pivot.add(p);
      pupils.push(p);
      // angry brows
      const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.07, 0.08), dark);
      b.position.set(s * 0.27, 0.46, 0.68);
      b.rotation.z = s * -0.45;
      pivot.add(b);
    }
    // grumpy mouth with teeth
    const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.06, 8, 18, Math.PI), dark);
    mouth.position.set(0, -0.32, 0.66);
    pivot.add(mouth);
    for (const tx of [-0.12, 0.12]) {
      const t = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.14, 8), toothMat);
      t.position.set(tx, -0.22, 0.7);
      t.rotation.z = Math.PI;
      pivot.add(t);
    }
    if (i === 1) {
      // the middle head wears the "Pflicht" crown
      const crown = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.3, 6, 1, true), gold);
      crown.material.side = THREE.DoubleSide;
      crown.position.y = 0.82;
      pivot.add(crown);
      for (let k = 0; k < 6; k++) {
        const sp = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.22, 6), gold);
        const a = (k / 6) * Math.PI * 2;
        sp.position.set(Math.cos(a) * 0.4, 1.05, Math.sin(a) * 0.4);
        pivot.add(sp);
      }
    }
    const label = new THREE.Sprite(new THREE.SpriteMaterial({ map: labelTexture(def.label, '#' + new THREE.Color(def.color).offsetHSL(0, 0, 0.25).getHexString()), transparent: true, depthWrite: false, toneMapped: false }));
    label.scale.set(2.4, 0.6, 1);
    label.position.set(0, 1.35 + (i === 1 ? 0.3 : 0), 0);
    pivot.add(label);
    return { def, pivot, skull, mat, pupils, neck, label, hp: 4, max: 4, alive: true, hitT: 0, base: new THREE.Vector3(x, y, 0.1) };
  });
  return { group, body, arms, heads, badge };
}

// ================================================================== error card (BP projectile)
const errCache = new Map();
export function errorTexture(text) {
  if (!errCache.has(text)) {
    errCache.set(text, canvasTexture(512, 200, (g, w, hh) => {
      g.fillStyle = '#fff4f4';
      roundRect(g, 4, 4, w - 8, hh - 8, 22); g.fill();
      g.strokeStyle = '#e0201f'; g.lineWidth = 10; g.stroke();
      g.fillStyle = '#e0201f';
      g.beginPath(); g.arc(70, hh / 2, 42, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#fff'; g.font = `900 64px ${FONT}`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText('!', 70, hh / 2 + 3);
      g.textAlign = 'left'; g.fillStyle = '#3a0a0a';
      let size = 46;
      g.font = `800 ${size}px ${FONT}`;
      while (g.measureText(text).width > w - 150 && size > 26) g.font = `800 ${--size}px ${FONT}`;
      g.fillText(text, 128, hh / 2 + 2);
    }));
  }
  return errCache.get(text);
}

// ================================================================== portraits (SVG, HTML side)
/** The all-knowing Product Management oracle. tired: 0..3 (hair loss, eye bags, coffee). */
export function oracleSVG(tired = 0) {
  const hair = Math.max(0, 7 - tired * 2);
  const strands = Array.from({ length: hair }, (_, i) => {
    const x = 70 + i * 10;
    return `<path d="M${x} 50 q${(i % 2 ? 4 : -4)} -14 ${(i % 2 ? 2 : -2)} -22" stroke="#e8e2ff" stroke-width="3" fill="none" stroke-linecap="round"/>`;
  }).join('');
  const bags = tired >= 1 ? `<path d="M84 74 q6 5 12 0 M104 74 q6 5 12 0" stroke="#7a5fb0" stroke-width="2.5" fill="none"/>` : '';
  const bags2 = tired >= 2 ? `<path d="M83 78 q7 6 14 0 M103 78 q7 6 14 0" stroke="#5c4590" stroke-width="2" fill="none"/>` : '';
  const eyes = tired >= 3
    ? '<path d="M84 68 h12 M104 68 h12" stroke="#1b1033" stroke-width="3" stroke-linecap="round"/>'
    : '<circle cx="90" cy="68" r="5" fill="#1b1033"/><circle cx="110" cy="68" r="5" fill="#1b1033"/><circle cx="92" cy="66" r="1.6" fill="#fff"/><circle cx="112" cy="66" r="1.6" fill="#fff"/>';
  const mouth = tired >= 2 ? '<path d="M92 90 q8 -4 16 0" stroke="#1b1033" stroke-width="3" fill="none" stroke-linecap="round"/>' : '<path d="M90 87 q10 9 20 0" stroke="#1b1033" stroke-width="3" fill="none" stroke-linecap="round"/>';
  const cup = tired >= 2 ? '<g transform="translate(140 118)"><rect x="0" y="0" width="20" height="24" rx="3" fill="#fff"/><path d="M20 6 q9 0 9 8 q0 8 -9 8" stroke="#fff" stroke-width="3" fill="none"/><path d="M5 -6 q3 -6 0 -10 M12 -6 q3 -6 0 -10" stroke="#fff" stroke-width="2" fill="none" opacity=".7"/><text x="10" y="17" font-size="9" text-anchor="middle" fill="#7c4dff" font-weight="900">PM</text></g>' : '';
  return `<svg viewBox="0 0 200 200" xmlns="http://www.w3.org/2000/svg">
  <defs><radialGradient id="og" cx="50%" cy="40%" r="60%"><stop offset="0" stop-color="#fff6c8" stop-opacity=".95"/><stop offset="1" stop-color="#ffcc4d" stop-opacity="0"/></radialGradient></defs>
  <circle cx="100" cy="80" r="95" fill="url(#og)"/>
  <ellipse cx="100" cy="30" rx="34" ry="8" fill="none" stroke="#ffd34d" stroke-width="5"/>
  <path d="M60 180 L80 100 h40 L140 180 z" fill="#7c4dff"/>
  <path d="M80 100 L100 140 L120 100" fill="#b39dff"/>
  ${strands}
  <circle cx="100" cy="72" r="26" fill="#f3d2bb"/>
  ${eyes}${bags}${bags2}${mouth}${cup}
  <g fill="#ffffff" opacity=".95"><ellipse cx="60" cy="182" rx="40" ry="16"/><ellipse cx="140" cy="182" rx="44" ry="17"/><ellipse cx="100" cy="174" rx="44" ry="20"/></g>
  </svg>`;
}

/** The consultant, sweating in stages 0..4 (drops, flushed face, armpit stains). */
export function consultantSVG(sweat = 0) {
  const flush = ['#f0c8a8', '#f2b9a0', '#f0a690', '#ec9080', '#e67a70'][Math.min(4, sweat)];
  const stain = sweat >= 2 ? `<ellipse cx="34" cy="96" rx="${4 + sweat * 2}" ry="${6 + sweat * 2.5}" fill="#7d9cc4" opacity=".6"/><ellipse cx="86" cy="96" rx="${4 + sweat * 2}" ry="${6 + sweat * 2.5}" fill="#7d9cc4" opacity=".6"/>` : '';
  const drops = [[38, 30], [82, 28], [30, 50], [90, 48], [60, 18]].slice(0, sweat + (sweat > 0 ? 1 : 0))
    .map(([x, y], i) => `<path class="drop d${i}" d="M${x} ${y} q-4 7 0 10 q4 -3 0 -10z" fill="#7fd3ff" stroke="#fff" stroke-width=".8"/>`).join('');
  const mouth = sweat >= 3 ? '<ellipse cx="60" cy="62" rx="6" ry="5" fill="#3a1010"/>' : sweat >= 1 ? '<path d="M52 63 q8 -5 16 0" stroke="#3a1010" stroke-width="2.5" fill="none" stroke-linecap="round"/>' : '<path d="M52 60 q8 6 16 0" stroke="#3a1010" stroke-width="2.5" fill="none" stroke-linecap="round"/>';
  const brows = sweat >= 2 ? '<path d="M44 36 l10 4 M76 36 l-10 4" stroke="#3a2a1a" stroke-width="3" stroke-linecap="round"/>' : '<path d="M44 38 h10 M66 38 h10" stroke="#3a2a1a" stroke-width="3" stroke-linecap="round"/>';
  return `<svg viewBox="0 0 120 130" xmlns="http://www.w3.org/2000/svg">
  <path d="M14 130 q2 -40 30 -46 h32 q28 6 30 46z" fill="#1f2c52"/>
  <path d="M44 84 L60 112 L76 84z" fill="#f4f6fb"/>
  ${stain}
  <path d="M57 88 h6 l3 26 -6 6 -6 -6z" fill="#b3261e"/>
  <circle cx="60" cy="48" r="28" fill="${flush}"/>
  <path d="M32 44 q2 -26 28 -26 q26 0 28 22 q-14 -10 -34 -8 q-14 2 -22 12z" fill="#4a2f1c"/>
  ${brows}
  <circle cx="49" cy="47" r="7" fill="none" stroke="#222" stroke-width="2"/><circle cx="71" cy="47" r="7" fill="none" stroke="#222" stroke-width="2"/><path d="M56 47 h8" stroke="#222" stroke-width="2"/>
  <circle cx="49" cy="47" r="2.4" fill="#222"/><circle cx="71" cy="47" r="2.4" fill="#222"/>
  ${mouth}${drops}
  </svg>`;
}

// ================================================================== crate geometry (shared)
export function crateGeometry(w, h, d) {
  return new RoundedBoxGeometry(w, h, d, 3, 0.08);
}
