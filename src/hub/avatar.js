import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture } from '../core/gfx.js';
import { storeGet, storeSet } from '../core/ui.js';

// Customizable sales avatar. Business options are fine; "forbidden" options
// (Schlabber-Look) can be picked, but trigger the Nackenklatscher in the hub.

export const WARDROBE = [
  {
    id: 'top', label: 'Oberteil', options: [
      { id: 'anzug', label: 'Anzug & Hemd' },
      { id: 'kostuem', label: 'Blazer & Bluse' },
      { id: 'weste', label: 'Weste & Hemd' },
      { id: 'rolli', label: 'Sakko & Rolli' },
      { id: 'hoodie', label: 'Hoodie', forbidden: 'Hoodie im Kundentermin? Nicht bei uns. Zieh was Anständiges an!' },
      { id: 'unterhemd', label: 'Feinripp-Unterhemd', forbidden: 'Feinripp?! Das ist ein Büro, keine Eckkneipe.' },
      { id: 'hawaii', label: 'Hawaiihemd', forbidden: 'Hawaiihemd? Der Urlaub ist vorbei, der Forecast wartet.' }
    ]
  },
  {
    id: 'bottom', label: 'Hose / Rock', options: [
      { id: 'anzughose', label: 'Anzughose' },
      { id: 'rock', label: 'Bleistiftrock' },
      { id: 'shorts', label: 'Kurze Hose', forbidden: 'Kurze Hosen im Büro? Deine Waden will hier keiner sehen.' },
      { id: 'jogging', label: 'Jogginghose', forbidden: 'Jogginghose heißt Kontrollverlust. Ab in die Anzughose!' }
    ]
  },
  {
    id: 'shoes', label: 'Schuhe', options: [
      { id: 'oxford', label: 'Oxford schwarz' },
      { id: 'loafer', label: 'Loafer braun' },
      { id: 'pumps', label: 'Pumps' },
      { id: 'sandalen', label: 'Sandalen', forbidden: 'Sandalen?! Hier wird Business gemacht, nicht Urlaub.' },
      { id: 'socken', label: 'Socken in Sandalen', forbidden: 'Socken in Sandalen. Ernsthaft? So gammlig läuft hier keiner rum!' },
      { id: 'latschen', label: 'Badelatschen', forbidden: 'Badelatschen? Das Freibad ist zwei Straßen weiter.' }
    ]
  },
  {
    id: 'acc', label: 'Accessoire', options: [
      { id: 'krawatte', label: 'Krawatte' },
      { id: 'fliege', label: 'Fliege' },
      { id: 'tuch', label: 'Einstecktuch' },
      { id: 'ohne', label: 'Ohne' },
      { id: 'goldkette', label: 'Goldkette', forbidden: 'Goldkette? Wir sind ein CRM-Haus, kein Rap-Video!' },
      { id: 'cap', label: 'Basecap', forbidden: 'Basecap verkehrt rum? Im Meeting? Mütze ab, Bro!' },
      { id: 'bauchtasche', label: 'Bauchtasche', forbidden: 'Bauchtasche quer über der Brust. Nein. Einfach nein.' }
    ]
  },
  {
    id: 'suit', label: 'Farbe', swatch: true, options: [
      { id: 'navy', label: 'Navy', color: 0x1f2c52 },
      { id: 'anthrazit', label: 'Anthrazit', color: 0x3a3f4a },
      { id: 'schwarz', label: 'Schwarz', color: 0x16181d },
      { id: 'grau', label: 'Hellgrau', color: 0x7d8494 },
      { id: 'beige', label: 'Beige', color: 0xb59f7f },
      { id: 'bordeaux', label: 'Bordeaux', color: 0x5a1f2b }
    ]
  },
  {
    id: 'accent', label: 'Akzent', swatch: true, options: [
      { id: 'gruen', label: 'itmX-Grün', color: 0x50af30 },
      { id: 'rot', label: 'Rot', color: 0xb3261e },
      { id: 'blau', label: 'Blau', color: 0x1d5fbf },
      { id: 'gelb', label: 'Senf', color: 0xd9a400 },
      { id: 'silber', label: 'Silber', color: 0x9aa3b0 }
    ]
  },
  {
    id: 'hair', label: 'Frisur', options: [
      { id: 'kurz', label: 'Kurz' },
      { id: 'scheitel', label: 'Seitenscheitel' },
      { id: 'dutt', label: 'Dutt' },
      { id: 'lang', label: 'Lang' },
      { id: 'locken', label: 'Locken' },
      { id: 'glatze', label: 'Glatze' }
    ]
  },
  {
    id: 'hairColor', label: 'Haarfarbe', swatch: true, options: [
      { id: 'schwarz', label: 'Schwarz', color: 0x1b1612 },
      { id: 'braun', label: 'Braun', color: 0x4a2f1c },
      { id: 'blond', label: 'Blond', color: 0xc9a25e },
      { id: 'rot', label: 'Rot', color: 0x8e3b1c },
      { id: 'grau', label: 'Grau', color: 0x9b9b9b }
    ]
  },
  {
    id: 'skin', label: 'Hautton', swatch: true, options: [
      { id: 's1', label: 'Hell', color: 0xf3d2bb },
      { id: 's2', label: 'Mittel', color: 0xe0b08f },
      { id: 's3', label: 'Oliv', color: 0xc08e66 },
      { id: 's4', label: 'Braun', color: 0x8d5a3c },
      { id: 's5', label: 'Dunkel', color: 0x5c3a26 }
    ]
  }
];

export const DEFAULT_AVATAR = { top: 'anzug', bottom: 'anzughose', shoes: 'oxford', acc: 'krawatte', suit: 'navy', accent: 'gruen', hair: 'kurz', hairColor: 'braun', skin: 's2' };

export function loadAvatar() {
  const a = { ...DEFAULT_AVATAR, ...storeGet('avatar', {}) };
  // never start in a forbidden outfit
  for (const cat of WARDROBE) {
    const o = cat.options.find((x) => x.id === a[cat.id]);
    if (!o || o.forbidden) a[cat.id] = DEFAULT_AVATAR[cat.id];
  }
  return a;
}
export function saveAvatar(a) { storeSet('avatar', a); }
export function findOption(catId, optId) { return WARDROBE.find((c) => c.id === catId)?.options.find((o) => o.id === optId); }
const col = (catId, optId) => findOption(catId, optId)?.color ?? 0x888888;

// ---------- materials (cached per colour so rebuilding doesn't create new shaders) ----------
const mats = new Map();
function mat(color, kind = 'cloth') {
  const key = `${kind}${color}`;
  if (!mats.has(key)) {
    const c = new THREE.Color(color);
    mats.set(key, kind === 'gloss'
      ? new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.15 })
      : kind === 'metal'
        ? new THREE.MeshStandardMaterial({ color: c, roughness: 0.25, metalness: 1 })
        : kind === 'skin'
          ? new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.6, sheen: 0.3, sheenColor: new THREE.Color(0xff9a8a) })
          : new THREE.MeshPhysicalMaterial({ color: c, roughness: 0.7, sheen: 0.5, sheenColor: c.clone().offsetHSL(0, 0, 0.2) }));
  }
  return mats.get(key);
}
let hawaiiTex = null, ribTex = null;
function hawaiiMat() {
  if (!hawaiiTex) {
    hawaiiTex = canvasTexture(256, 256, (g, w, h) => {
      g.fillStyle = '#0fa3a3'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 26; i++) {
        const x = Math.random() * w, y = Math.random() * h, r = 8 + Math.random() * 12;
        g.fillStyle = ['#ff5a8a', '#ffd23f', '#ff8c2b', '#ffffff'][i % 4];
        for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.256) * r * 0.7, y + Math.sin(k * 1.256) * r * 0.7, r * 0.5, 0, 7); g.fill(); }
        g.fillStyle = '#2f8a3a';
        g.beginPath(); g.ellipse(x + r * 1.4, y + r, r, r * 0.35, 0.6, 0, 7); g.fill();
      }
    });
    hawaiiTex.wrapS = hawaiiTex.wrapT = THREE.RepeatWrapping;
  }
  return new THREE.MeshStandardMaterial({ map: hawaiiTex, roughness: 0.8 });
}
function ribMat() {
  if (!ribTex) {
    ribTex = canvasTexture(64, 64, (g, w, h) => { g.fillStyle = '#f2f0ea'; g.fillRect(0, 0, w, h); g.fillStyle = '#d9d5cb'; for (let x = 0; x < w; x += 4) g.fillRect(x, 0, 2, h); });
    ribTex.wrapS = ribTex.wrapT = THREE.RepeatWrapping;
    ribTex.repeat.set(4, 2);
  }
  return new THREE.MeshStandardMaterial({ map: ribTex, roughness: 0.9 });
}

const shirtWhite = 0xf7f7f5;

export function buildAvatar(cfg) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);
  const suit = col('suit', cfg.suit);
  const accent = col('accent', cfg.accent);
  const skin = mat(col('skin', cfg.skin), 'skin');
  const hairM = mat(col('hairColor', cfg.hairColor), 'gloss');
  const add = (parent, geo, m, x = 0, y = 0, z = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = true; parent.add(o); return o; };

  // ---------------- legs + shoes
  const legs = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.17, 0.95, 0);
    body.add(pivot);
    legs.push(pivot);
    const b = cfg.bottom;
    if (b === 'anzughose') add(pivot, new THREE.CapsuleGeometry(0.135, 0.62, 4, 12), mat(suit), 0, -0.45, 0);
    else if (b === 'jogging') {
      add(pivot, new THREE.CapsuleGeometry(0.16, 0.6, 4, 12), mat(0x8a8d93), 0, -0.44, 0);
      add(pivot, new THREE.BoxGeometry(0.02, 0.7, 0.05), mat(0xffffff), s * 0.16, -0.42, 0);
      add(pivot, new THREE.CylinderGeometry(0.12, 0.12, 0.08, 14), mat(0x6f7278), 0, -0.8, 0);
    } else if (b === 'shorts') {
      add(pivot, new THREE.CylinderGeometry(0.16, 0.17, 0.32, 14), mat(0xb8a47a), 0, -0.14, 0);
      add(pivot, new THREE.CapsuleGeometry(0.1, 0.42, 4, 10), skin, 0, -0.58, 0);
    } else { // rock: slim legs below the skirt
      add(pivot, new THREE.CapsuleGeometry(0.095, 0.62, 4, 10), skin, 0, -0.47, 0);
    }
    const sh = cfg.shoes;
    if (sh === 'oxford' || sh === 'loafer') {
      add(pivot, new RoundedBoxGeometry(0.22, 0.13, 0.38, 2, 0.05), mat(sh === 'oxford' ? 0x0d0d0f : 0x5a3214, 'gloss'), 0, -0.88, 0.07);
      if (sh === 'loafer') add(pivot, new THREE.BoxGeometry(0.14, 0.02, 0.05), mat(0xc9a25e, 'metal'), 0, -0.82, 0.16);
    } else if (sh === 'pumps') {
      const shoe = add(pivot, new RoundedBoxGeometry(0.18, 0.1, 0.34, 2, 0.04), mat(0x0d0d0f, 'gloss'), 0, -0.86, 0.08);
      shoe.rotation.x = -0.2;
      add(pivot, new THREE.CylinderGeometry(0.02, 0.015, 0.14, 8), mat(0x0d0d0f, 'gloss'), 0, -0.9, -0.06);
    } else {
      // sandals / slides / socks in sandals
      const sockOrSkin = sh === 'socken' ? mat(0xffffff) : skin;
      add(pivot, new RoundedBoxGeometry(0.17, 0.08, 0.32, 2, 0.03), sockOrSkin, 0, -0.86, 0.08);
      if (sh === 'socken') add(pivot, new THREE.CylinderGeometry(0.105, 0.105, 0.22, 12), mat(0xffffff), 0, -0.74, 0);
      add(pivot, new THREE.BoxGeometry(0.22, 0.04, 0.4), mat(sh === 'latschen' ? 0x1f6fd1 : 0x6b4423), 0, -0.92, 0.08);
      if (sh === 'latschen') add(pivot, new THREE.BoxGeometry(0.22, 0.05, 0.12), mat(0x1f6fd1), 0, -0.84, 0.12);
      else for (const z of [0.0, 0.16]) add(pivot, new THREE.BoxGeometry(0.2, 0.03, 0.04), mat(0x6b4423), 0, -0.83, z);
    }
  }
  if (cfg.bottom === 'rock') {
    add(body, new THREE.CylinderGeometry(0.33, 0.31, 0.5, 20), mat(suit), 0, 0.82, 0);
  }

  // ---------------- torso
  const top = cfg.top;
  const torsoY = 1.5;
  let sleeve = mat(suit), cuff = mat(shirtWhite), bareForearm = false, shortSleeve = false;
  if (top === 'anzug' || top === 'kostuem' || top === 'rolli') {
    add(body, new THREE.CapsuleGeometry(0.34, 0.6, 6, 16), mat(suit), 0, torsoY, 0);
    const inner = top === 'rolli' ? 0x1b1d22 : top === 'kostuem' ? 0xf1ece4 : shirtWhite;
    const front = add(body, new THREE.PlaneGeometry(0.2, 0.42), mat(inner), 0, 1.66, 0.336);
    front.castShadow = false;
    for (const s of [-1, 1]) {
      const lapel = add(body, new THREE.BoxGeometry(0.07, 0.42, 0.03), mat(new THREE.Color(suit).multiplyScalar(0.75).getHex()), s * 0.11, 1.66, 0.33);
      lapel.rotation.z = s * 0.28;
    }
    for (const y of [1.36, 1.24]) add(body, new THREE.SphereGeometry(0.022, 8, 6), mat(0x111111, 'gloss'), 0, y, 0.34);
    if (top === 'rolli') add(body, new THREE.CylinderGeometry(0.13, 0.15, 0.14, 16), mat(0x1b1d22), 0, 2.02, 0);
    if (top === 'kostuem') add(body, new THREE.SphereGeometry(0.03, 10, 8), mat(0xd9b45a, 'metal'), -0.17, 1.72, 0.32);
  } else if (top === 'weste') {
    add(body, new THREE.CapsuleGeometry(0.33, 0.6, 6, 16), mat(shirtWhite), 0, torsoY, 0);
    const vest = add(body, new THREE.CapsuleGeometry(0.345, 0.5, 6, 16), mat(suit), 0, torsoY - 0.03, 0);
    vest.scale.set(1, 1, 1);
    add(body, new THREE.PlaneGeometry(0.16, 0.3), mat(shirtWhite), 0, 1.7, 0.346).castShadow = false;
    sleeve = mat(shirtWhite);
  } else if (top === 'hoodie') {
    add(body, new THREE.CapsuleGeometry(0.39, 0.58, 6, 16), mat(0x6d7178), 0, torsoY - 0.03, 0);
    const hood = add(body, new THREE.TorusGeometry(0.2, 0.09, 10, 20), mat(0x6d7178), 0, 2.02, -0.14);
    hood.rotation.x = Math.PI / 2 + 0.5;
    add(body, new THREE.BoxGeometry(0.4, 0.18, 0.04), mat(0x5d6168), 0, 1.25, 0.37);
    for (const s of [-1, 1]) add(body, new THREE.CylinderGeometry(0.012, 0.012, 0.28, 6), mat(0xffffff), s * 0.08, 1.8, 0.37);
    sleeve = mat(0x6d7178); cuff = mat(0x5d6168);
  } else if (top === 'unterhemd') {
    const t = add(body, new THREE.CapsuleGeometry(0.36, 0.56, 6, 16), ribMat(), 0, torsoY - 0.03, 0);
    t.scale.set(1.04, 1, 1.12); // slightly saggy belly
    sleeve = skin; cuff = skin; bareForearm = true;
  } else if (top === 'hawaii') {
    add(body, new THREE.CapsuleGeometry(0.35, 0.6, 6, 16), hawaiiMat(), 0, torsoY, 0);
    shortSleeve = true;
  }

  // ---------------- arms
  const arms = [];
  for (const s of [-1, 1]) {
    const pivot = new THREE.Group();
    pivot.position.set(s * 0.45, 1.9, 0);
    body.add(pivot);
    arms.push(pivot);
    if (shortSleeve) {
      add(pivot, new THREE.CylinderGeometry(0.12, 0.13, 0.3, 12), hawaiiMat(), 0, -0.12, 0);
      add(pivot, new THREE.CapsuleGeometry(0.085, 0.46, 4, 10), skin, 0, -0.5, 0);
    } else if (bareForearm) {
      add(pivot, new THREE.CapsuleGeometry(0.09, 0.6, 4, 10), skin, 0, -0.4, 0);
    } else {
      add(pivot, new THREE.CapsuleGeometry(0.1, 0.6, 4, 10), sleeve, 0, -0.4, 0);
      add(pivot, new THREE.CylinderGeometry(0.1, 0.1, 0.06, 12), cuff, 0, -0.74, 0);
    }
    add(pivot, new THREE.SphereGeometry(0.09, 12, 10), skin, 0, -0.82, 0);
  }
  // briefcase (always: it's a sales avatar)
  add(arms[1], new RoundedBoxGeometry(0.5, 0.36, 0.14, 2, 0.04), mat(0x5a3214, 'gloss'), 0, -1.02, 0);
  add(arms[1], new THREE.TorusGeometry(0.06, 0.015, 6, 12, Math.PI), mat(0x2a1a0c), 0, -0.84, 0);

  // ---------------- head (pivot at the neck, used for the slap reaction)
  const neck = new THREE.Group();
  neck.position.y = 2.02;
  body.add(neck);
  add(neck, new THREE.CylinderGeometry(0.1, 0.11, 0.14, 12), skin, 0, 0.02, 0);
  if (top === 'anzug' || top === 'weste') {
    const collar = add(neck, new THREE.CylinderGeometry(0.125, 0.135, 0.07, 14, 1, true), mat(shirtWhite), 0, -0.02, 0);
    collar.material = mat(shirtWhite);
  }
  const head = add(neck, new THREE.SphereGeometry(0.28, 24, 18), skin, 0, 0.3, 0);
  for (const s of [-1, 1]) {
    add(neck, new THREE.SphereGeometry(0.035, 10, 8), mat(0x111111, 'gloss'), s * 0.1, 0.33, 0.25);
    const brow = add(neck, new THREE.BoxGeometry(0.1, 0.022, 0.03), hairM, s * 0.1, 0.41, 0.25);
    brow.rotation.z = s * -0.1;
    add(neck, new THREE.SphereGeometry(0.06, 10, 8), skin, s * 0.28, 0.3, 0).scale.set(0.5, 1, 0.8);
  }
  add(neck, new THREE.SphereGeometry(0.04, 10, 8), skin, 0, 0.27, 0.28);
  const smile = add(neck, new THREE.TorusGeometry(0.07, 0.014, 6, 16, Math.PI), mat(0x7a2a2a), 0, 0.2, 0.25);
  smile.rotation.z = Math.PI;
  // hair
  const hs = cfg.hair;
  if (hs !== 'glatze') {
    if (hs === 'locken') {
      for (let i = 0; i < 26; i++) {
        const a = (i / 26) * Math.PI * 2, r = i % 2 ? 0.27 : 0.2;
        add(neck, new THREE.SphereGeometry(0.09, 10, 8), hairM, Math.cos(a) * r, 0.5 + (i % 3) * 0.04, Math.sin(a) * r - 0.04);
      }
    } else {
      const cap = add(neck, new THREE.SphereGeometry(0.295, 24, 12, 0, Math.PI * 2, 0, Math.PI * 0.5), hairM, 0, 0.34, -0.01);
      cap.rotation.x = -0.25;
    }
    if (hs === 'scheitel') { const f = add(neck, new RoundedBoxGeometry(0.3, 0.08, 0.16, 2, 0.04), hairM, 0.06, 0.55, 0.14); f.rotation.z = -0.25; }
    if (hs === 'dutt') add(neck, new THREE.SphereGeometry(0.12, 14, 10), hairM, 0, 0.6, -0.2);
    if (hs === 'lang') {
      const back = add(neck, new RoundedBoxGeometry(0.56, 0.6, 0.16, 3, 0.07), hairM, 0, 0.12, -0.18);
      back.rotation.x = 0.08;
      for (const s of [-1, 1]) add(neck, new RoundedBoxGeometry(0.1, 0.45, 0.16, 2, 0.04), hairM, s * 0.27, 0.15, -0.02);
    }
  }
  // ---------------- accessories
  const acc = cfg.acc;
  if (acc === 'krawatte' && (top === 'anzug' || top === 'weste')) {
    add(body, new THREE.SphereGeometry(0.035, 8, 6), mat(accent, 'gloss'), 0, 1.86, 0.35);
    const tie = add(body, new THREE.ConeGeometry(0.055, 0.42, 4), mat(accent, 'gloss'), 0, 1.62, 0.355);
    tie.rotation.x = Math.PI;
    tie.scale.z = 0.3;
  } else if (acc === 'fliege' || (acc === 'krawatte' && top === 'kostuem')) {
    for (const s of [-1, 1]) {
      const w = add(body, new THREE.ConeGeometry(0.05, 0.1, 4), mat(accent, 'gloss'), s * 0.05, 1.86, 0.35);
      w.rotation.z = s * Math.PI / 2;
    }
  } else if (acc === 'tuch') {
    const t = add(body, new THREE.ConeGeometry(0.04, 0.06, 3), mat(accent, 'gloss'), 0.17, 1.72, 0.33);
    t.rotation.z = Math.PI;
  } else if (acc === 'goldkette') {
    const chain = add(body, new THREE.TorusGeometry(0.2, 0.025, 8, 28), mat(0xffc93c, 'metal'), 0, 1.86, 0.1);
    chain.rotation.x = Math.PI / 2 - 0.55;
    const pend = add(body, new THREE.CylinderGeometry(0.07, 0.07, 0.02, 20), mat(0xffc93c, 'metal'), 0, 1.6, 0.37);
    pend.rotation.x = Math.PI / 2;
  } else if (acc === 'cap') {
    const c = add(neck, new THREE.SphereGeometry(0.3, 20, 10, 0, Math.PI * 2, 0, Math.PI * 0.5), mat(accent), 0, 0.38, 0);
    c.rotation.x = -0.1;
    add(neck, new THREE.BoxGeometry(0.3, 0.025, 0.24), mat(accent), 0, 0.42, -0.36);
  } else if (acc === 'bauchtasche') {
    const bag = add(body, new RoundedBoxGeometry(0.36, 0.16, 0.12, 2, 0.05), mat(0x2b2b2b), 0.05, 1.55, 0.38);
    bag.rotation.z = -0.5;
    const strap = add(body, new THREE.TorusGeometry(0.4, 0.02, 6, 30), mat(0x2b2b2b), 0, 1.6, 0);
    strap.rotation.set(Math.PI / 2, 0.5, 0);
    strap.scale.set(1, 0.95, 1);
  }

  // soft blob shadow
  const shadow = new THREE.Mesh(new THREE.CircleGeometry(0.5, 24), new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.25, depthWrite: false }));
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.012;
  root.add(shadow);
  return { root, body, legs, arms, neck, head };
}

export function disposeAvatar(av) {
  av.root.traverse((o) => { if (o.isMesh) o.geometry.dispose(); });
}
