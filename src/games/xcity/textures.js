import * as THREE from 'three';

// Procedural PBR texture sets (albedo + normal + roughness), generated once at start.
// Everything is drawn here: no third-party image files, so there are no asset licences to clear.

const R = (a = 0, b = 1) => a + Math.random() * (b - a);

function canvas(w, h = w) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }
function tex(c, { srgb = true, repeat = true, aniso = 8 } = {}) {
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = aniso;
  return t;
}

/** tileable value noise (fbm), returns Float32Array w*h in 0..1 */
export function fbm(w, h, { scale = 8, oct = 5, seed = Math.random() * 1000 } = {}) {
  const out = new Float32Array(w * h);
  const hash = (x, y, s) => { const n = Math.sin(x * 127.1 + y * 311.7 + s * 74.7) * 43758.5453; return n - Math.floor(n); };
  let amp = 1, tot = 0;
  for (let o = 0; o < oct; o++) {
    const f = scale * 2 ** o;
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const fx = (x / w) * f, fy = (y / h) * f;
      const x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
      const w0 = x0 % f, w1 = (x0 + 1) % f, h0 = y0 % f, h1 = (y0 + 1) % f;
      const a = hash(w0, h0, seed + o), b = hash(w1, h0, seed + o), c = hash(w0, h1, seed + o), d = hash(w1, h1, seed + o);
      out[y * w + x] += ((a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy) * amp;
    }
    tot += amp; amp *= 0.5;
  }
  for (let i = 0; i < out.length; i++) out[i] /= tot;
  return out;
}

/** normal map from a grayscale height canvas (tileable sobel) */
export function normalFromHeight(hc, strength = 2) {
  const w = hc.width, h = hc.height;
  const src = hc.getContext('2d').getImageData(0, 0, w, h).data;
  const c = canvas(w, h);
  const g = c.getContext('2d');
  const img = g.createImageData(w, h);
  const H = (x, y) => src[(((y + h) % h) * w + ((x + w) % w)) * 4] / 255;
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (H(x + 1, y) - H(x - 1, y)) * strength;
    const dy = (H(x, y + 1) - H(x, y - 1)) * strength;
    const l = Math.hypot(dx, dy, 1);
    const i = (y * w + x) * 4;
    img.data[i] = (-dx / l * 0.5 + 0.5) * 255;
    img.data[i + 1] = (dy / l * 0.5 + 0.5) * 255;
    img.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
    img.data[i + 3] = 255;
  }
  g.putImageData(img, 0, 0);
  return tex(c, { srgb: false });
}

function noiseLayer(g, w, h, n, { a = 0.1, light = false, size = [1, 3] } = {}) {
  for (let i = 0; i < n; i++) {
    const v = light ? 255 : 0;
    g.fillStyle = `rgba(${v},${v},${v},${Math.random() * a})`;
    const s = R(size[0], size[1]);
    g.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
}
function fbmToCanvas(arr, w, h, lo, hi, tint = [1, 1, 1]) {
  const c = canvas(w, h), g = c.getContext('2d'), img = g.createImageData(w, h);
  for (let i = 0; i < arr.length; i++) { const v = lo + (hi - lo) * arr[i]; img.data[i * 4] = v * tint[0]; img.data[i * 4 + 1] = v * tint[1]; img.data[i * 4 + 2] = v * tint[2]; img.data[i * 4 + 3] = 255; }
  g.putImageData(img, 0, 0);
  return c;
}

// ------------------------------------------------------------------ asphalt (with cracks, patches, puddles)
export function asphaltSet(S = 1024) {
  const n = fbm(256, 256, { scale: 6, oct: 5 });
  const base = fbmToCanvas(n, 256, 256, 46, 80, [1, 1, 1.04]);
  const c = canvas(S), g = c.getContext('2d');
  g.imageSmoothingEnabled = true;
  g.drawImage(base, 0, 0, S, S);
  // aggregate
  for (let i = 0; i < S * S * 0.06; i++) { const v = R(20, 140); g.fillStyle = `rgba(${v},${v},${v + 4},${R(0.2, 0.6)})`; g.fillRect(Math.random() * S, Math.random() * S, R(1, 2.5), R(1, 2.5)); }
  // repair patches
  const hc = canvas(S), hg = hc.getContext('2d');
  hg.fillStyle = '#808080'; hg.fillRect(0, 0, S, S);
  for (let k = 0; k < 4; k++) {
    const x = R(0, S), y = R(0, S), w = R(60, 220), hh = R(40, 160);
    g.fillStyle = `rgba(20,20,24,${R(0.25, 0.45)})`; g.fillRect(x, y, w, hh);
    hg.fillStyle = '#868686'; hg.fillRect(x, y, w, hh);
  }
  // cracks
  for (let k = 0; k < 14; k++) {
    let x = R(0, S), y = R(0, S), a = R(0, 6.28);
    g.strokeStyle = 'rgba(8,8,10,0.75)'; hg.strokeStyle = '#2a2a2a';
    g.lineWidth = hg.lineWidth = R(1, 2.2);
    g.beginPath(); hg.beginPath(); g.moveTo(x, y); hg.moveTo(x, y);
    for (let s = 0; s < 30; s++) { a += R(-0.6, 0.6); x += Math.cos(a) * 9; y += Math.sin(a) * 9; g.lineTo(x, y); hg.lineTo(x, y); }
    g.stroke(); hg.stroke();
  }
  // oil stains + tyre polish
  for (let k = 0; k < 10; k++) { const x = R(0, S), y = R(0, S), r = R(10, 50); const gr = g.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, 'rgba(10,8,6,0.4)'); gr.addColorStop(1, 'rgba(10,8,6,0)'); g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2); }
  // height: aggregate bumps
  for (let i = 0; i < S * S * 0.05; i++) { const v = R(90, 200); hg.fillStyle = `rgb(${v},${v},${v})`; hg.fillRect(Math.random() * S, Math.random() * S, R(1, 3), R(1, 3)); }
  // roughness: puddles are mirror-smooth
  const rc = canvas(S), rg = rc.getContext('2d');
  rg.fillStyle = 'rgb(225,225,225)'; rg.fillRect(0, 0, S, S);
  noiseLayer(rg, S, S, 20000, { a: 0.2 });
  const pud = fbm(128, 128, { scale: 3, oct: 4 });
  const pc = canvas(128), pg = pc.getContext('2d'), pimg = pg.createImageData(128, 128);
  for (let i = 0; i < pud.length; i++) { const p = Math.max(0, Math.min(1, (pud[i] - 0.6) * 9)); pimg.data[i * 4] = pimg.data[i * 4 + 1] = pimg.data[i * 4 + 2] = 0; pimg.data[i * 4 + 3] = p * 235; }
  pg.putImageData(pimg, 0, 0);
  rg.drawImage(pc, 0, 0, S, S);
  // puddles also darken the albedo a little
  g.globalAlpha = 0.35; g.drawImage(pc, 0, 0, S, S); g.globalAlpha = 1;
  return { map: tex(c), normalMap: normalFromHeight(hc, 3), roughnessMap: tex(rc, { srgb: false }) };
}

// ------------------------------------------------------------------ sidewalk tiles
export function sidewalkSet(S = 512, tile = 4) {
  const c = canvas(S), g = c.getContext('2d');
  const hc = canvas(S), hg = hc.getContext('2d');
  const n = fbm(128, 128, { scale: 5, oct: 4 });
  g.drawImage(fbmToCanvas(n, 128, 128, 168, 205, [1, 0.97, 0.93]), 0, 0, S, S);
  hg.fillStyle = '#9a9a9a'; hg.fillRect(0, 0, S, S);
  const t = S / tile;
  for (let y = 0; y < tile; y++) for (let x = 0; x < tile; x++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? 0 : 255},0,0,0)`;
    const l = R(-10, 10);
    g.fillStyle = `rgba(${128 + l},${124 + l},${118 + l},0.12)`; g.fillRect(x * t, y * t, t, t);
    if (Math.random() < 0.15) { g.fillStyle = 'rgba(60,50,40,0.12)'; g.beginPath(); g.arc(x * t + R(10, t - 10), y * t + R(10, t - 10), R(4, 18), 0, 7); g.fill(); }
  }
  g.strokeStyle = 'rgba(70,66,60,0.55)'; hg.strokeStyle = '#303030'; g.lineWidth = hg.lineWidth = 3;
  for (let i = 0; i <= tile; i++) { for (const gg of [g, hg]) { gg.beginPath(); gg.moveTo(i * t, 0); gg.lineTo(i * t, S); gg.moveTo(0, i * t); gg.lineTo(S, i * t); gg.stroke(); } }
  noiseLayer(g, S, S, 9000, { a: 0.12 });
  noiseLayer(hg, S, S, 6000, { a: 0.4, light: true });
  // gum spots
  for (let i = 0; i < 30; i++) { g.fillStyle = `rgba(40,40,40,${R(0.2, 0.4)})`; g.beginPath(); g.arc(R(0, S), R(0, S), R(1.5, 3.5), 0, 7); g.fill(); }
  const rc = canvas(64), rg = rc.getContext('2d'); rg.fillStyle = 'rgb(220,220,220)'; rg.fillRect(0, 0, 64, 64);
  return { map: tex(c), normalMap: normalFromHeight(hc, 2.5), roughnessMap: tex(rc, { srgb: false }) };
}

// ------------------------------------------------------------------ plaza stone
export function stoneSet(S = 512) {
  const c = canvas(S), g = c.getContext('2d'), hc = canvas(S), hg = hc.getContext('2d');
  g.fillStyle = '#d8ccb8'; g.fillRect(0, 0, S, S); hg.fillStyle = '#a0a0a0'; hg.fillRect(0, 0, S, S);
  const rows = 8, h = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = r % 2 ? -h : 0;
    while (x < S) {
      const w = h * R(1.2, 2);
      const l = R(-14, 10);
      g.fillStyle = `rgb(${214 + l},${202 + l},${182 + l})`; g.fillRect(x + 2, r * h + 2, w - 4, h - 4);
      hg.fillStyle = `rgb(${150 + l},${150 + l},${150 + l})`; hg.fillRect(x + 3, r * h + 3, w - 6, h - 6);
      x += w;
    }
  }
  noiseLayer(g, S, S, 12000, { a: 0.1 });
  noiseLayer(hg, S, S, 8000, { a: 0.5, light: true });
  const rc = canvas(64), rg = rc.getContext('2d'); rg.fillStyle = 'rgb(150,150,150)'; rg.fillRect(0, 0, 64, 64);
  return { map: tex(c), normalMap: normalFromHeight(hc, 3), roughnessMap: tex(rc, { srgb: false }) };
}

// ------------------------------------------------------------------ sand
export function sandSet(S = 512) {
  const n = fbm(256, 256, { scale: 4, oct: 6 });
  const c = fbmToCanvas(n, 256, 256, 200, 236, [1, 0.88, 0.68]);
  const big = canvas(S), g = big.getContext('2d'); g.drawImage(c, 0, 0, S, S);
  noiseLayer(g, S, S, 40000, { a: 0.2, size: [1, 2] });
  noiseLayer(g, S, S, 20000, { a: 0.25, light: true, size: [1, 2] });
  // ripples
  const hc = canvas(S), hg = hc.getContext('2d');
  for (let y = 0; y < S; y += 2) { const v = 128 + Math.sin(y * 0.18 + Math.sin(y * 0.02) * 3) * 40; hg.fillStyle = `rgb(${v},${v},${v})`; hg.fillRect(0, y, S, 2); }
  noiseLayer(hg, S, S, 30000, { a: 0.5, light: true, size: [1, 2] });
  return { map: tex(big), normalMap: normalFromHeight(hc, 1.5) };
}

// ------------------------------------------------------------------ facade window atlas
// 8 x 8 cells, each cell = one window bay (column x floor). Variation: frames, blinds, curtains,
// plants, interior depth gradient, lit rooms (emissive map) and a normal map for frames and sills.
export function windowSet(kind = 'stucco', S = 1024) {
  const N = 8, C = S / N;
  const c = canvas(S), g = c.getContext('2d');
  const e = canvas(S), eg = e.getContext('2d');
  const hc = canvas(S), hg = hc.getContext('2d');
  const glass = kind === 'glass';
  eg.fillStyle = '#000'; eg.fillRect(0, 0, S, S);
  if (glass) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = x * C, py = y * C;
      const gr = g.createLinearGradient(px, py, px + C * 0.6, py + C);
      const hu = R(200, 215), l = R(26, 40);
      gr.addColorStop(0, `hsl(${hu},28%,${l + 14}%)`); gr.addColorStop(1, `hsl(${hu},30%,${l}%)`);
      g.fillStyle = gr; g.fillRect(px, py, C, C);
      // interior hints behind the glass (ceiling lights, desks)
      if (Math.random() < 0.6) { g.fillStyle = 'rgba(255,255,255,0.05)'; g.fillRect(px + 6, py + 8, C - 12, 4); }
      // spandrel band (top 22 %)
      g.fillStyle = `hsl(${hu},18%,${R(18, 24)}%)`; g.fillRect(px, py, C, C * 0.22);
      hg.fillStyle = '#909090'; hg.fillRect(px, py, C, C * 0.22);
      if (Math.random() < 0.3) {
        const warm = Math.random() < 0.8;
        const gr2 = eg.createLinearGradient(px, py + C * 0.22, px, py + C);
        gr2.addColorStop(0, warm ? 'rgba(255,214,150,1)' : 'rgba(170,210,255,1)'); gr2.addColorStop(1, warm ? 'rgba(140,90,40,1)' : 'rgba(60,90,140,1)');
        eg.globalAlpha = R(0.45, 0.95); eg.fillStyle = gr2; eg.fillRect(px + 3, py + C * 0.22 + 2, C - 6, C * 0.78 - 4); eg.globalAlpha = 1;
      }
    }
    // mullions
    g.fillStyle = '#c8d0d8'; hg.fillStyle = '#ffffff';
    for (let i = 0; i <= N; i++) { g.fillRect(i * C - 3, 0, 6, S); hg.fillRect(i * C - 3, 0, 6, S); g.fillRect(0, i * C - 2, S, 4); }
    for (let x = 0; x < N; x++) { g.fillStyle = 'rgba(200,208,216,0.7)'; g.fillRect(x * C + C / 2 - 1, 0, 2, S); }
  } else {
    // plaster wall
    const n = fbm(128, 128, { scale: 6, oct: 4 });
    g.drawImage(fbmToCanvas(n, 128, 128, 226, 250, [1, 0.985, 0.96]), 0, 0, S, S);
    noiseLayer(g, S, S, 16000, { a: 0.06 });
    hg.fillStyle = '#7a7a7a'; hg.fillRect(0, 0, S, S);
    noiseLayer(hg, S, S, 20000, { a: 0.25, light: true });
    // dirt streaks under sills
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = x * C, py = y * C;
      const ww = C * 0.5, wh = C * 0.62, wx = px + (C - ww) / 2, wy = py + C * 0.16;
      // streak
      const st = g.createLinearGradient(0, wy + wh, 0, wy + wh + C * 0.3);
      st.addColorStop(0, 'rgba(70,60,50,0.16)'); st.addColorStop(1, 'rgba(70,60,50,0)');
      g.fillStyle = st; g.fillRect(wx + 4, wy + wh, ww - 8, C * 0.3);
      // frame (raised)
      g.fillStyle = '#f7f5f0'; g.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      hg.fillStyle = '#d8d8d8'; hg.fillRect(wx - 6, wy - 6, ww + 12, wh + 12);
      // recess (glass is deep)
      hg.fillStyle = '#202020'; hg.fillRect(wx, wy, ww, wh);
      // glass with sky reflection + interior
      const gr = g.createLinearGradient(wx, wy, wx + ww, wy + wh);
      gr.addColorStop(0, `hsl(${R(200, 220)},25%,${R(42, 58)}%)`); gr.addColorStop(0.5, `hsl(${R(205, 225)},30%,${R(20, 30)}%)`); gr.addColorStop(1, `hsl(${R(20, 30)},20%,${R(18, 26)}%)`);
      g.fillStyle = gr; g.fillRect(wx, wy, ww, wh);
      const r = Math.random();
      if (r < 0.25) { // blinds
        g.fillStyle = 'rgba(235,228,210,0.85)';
        const bh = wh * R(0.2, 0.9);
        for (let k = 0; k < bh; k += 4) g.fillRect(wx, wy + k, ww, 2.5);
      } else if (r < 0.45) { // curtains
        g.fillStyle = `hsla(${R(0, 360)},35%,${R(55, 75)}%,0.85)`;
        g.fillRect(wx, wy, ww * 0.28, wh); g.fillRect(wx + ww * 0.72, wy, ww * 0.28, wh);
      } else if (r < 0.52) { // plant
        g.fillStyle = '#3b6b2a'; g.beginPath(); g.arc(wx + ww * 0.3, wy + wh * 0.8, 10, 0, 7); g.fill();
      }
      // mullion cross
      g.fillStyle = '#f2efe8'; g.fillRect(wx + ww / 2 - 2, wy, 4, wh); g.fillRect(wx, wy + wh * 0.35, ww, 3);
      // sill
      g.fillStyle = '#e4dfd4'; g.fillRect(wx - 10, wy + wh + 4, ww + 20, 8);
      hg.fillStyle = '#ffffff'; hg.fillRect(wx - 10, wy + wh + 4, ww + 20, 8);
      // lit rooms
      if (Math.random() < 0.32) {
        const warm = Math.random() < 0.85;
        const gr2 = eg.createRadialGradient(wx + ww / 2, wy + wh * 0.3, 2, wx + ww / 2, wy + wh * 0.5, wh);
        gr2.addColorStop(0, warm ? 'rgb(255,220,160)' : 'rgb(150,190,255)'); gr2.addColorStop(1, warm ? 'rgb(150,90,40)' : 'rgb(40,70,140)');
        eg.globalAlpha = R(0.5, 1); eg.fillStyle = gr2; eg.fillRect(wx, wy, ww, wh); eg.globalAlpha = 1;
        if (r < 0.25) { eg.fillStyle = 'rgba(0,0,0,0.5)'; for (let k = 0; k < wh; k += 4) eg.fillRect(wx, wy + k, ww, 1.5); }
      }
    }
  }
  const rc = canvas(S), rg = rc.getContext('2d');
  rg.fillStyle = '#000'; rg.fillRect(0, 0, S, S);
  rg.drawImage(hc, 0, 0); // dark recesses (glass) are smooth, frames and plaster rough
  return { map: tex(c), emissiveMap: tex(e), normalMap: normalFromHeight(hc, glass ? 1.5 : 4), roughnessMap: tex(rc, { srgb: false }) };
}

// ------------------------------------------------------------------ shopfront atlas (ground floors)
const SHOPS = [
  ['CAFÉ SOL', '#2d6a4f', '#ffd166'], ['BÄCKEREI', '#7f4f24', '#ffe8c2'], ['BOUTIQUE', '#111111', '#f1f1f1'], ['APOTHEKE', '#1b7f3a', '#ffffff'],
  ['SURF SHOP', '#0077b6', '#ffe066'], ['PIZZA', '#b5121b', '#ffffff'], ['BAR 24', '#3a0ca3', '#ff4d9a'], ['KIOSK', '#e85d04', '#ffffff'],
  ['GELATO', '#ff8fab', '#ffffff'], ['BUCHLADEN', '#5c4033', '#f4e4c1'], ['SUSHI', '#222222', '#ff5a5f'], ['BLUMEN', '#386641', '#ffd6e0'],
  ['MOBILFUNK', '#023e8a', '#90e0ef'], ['BARBER', '#1d3557', '#e63946'], ['DELI', '#6a994e', '#f2e8cf'], ['TACOS', '#f4a261', '#264653']
];
export function shopSet() {
  const W = 1024, H = 512, cols = 4, rows = 4, cw = W / cols, ch = H / rows;
  const c = canvas(W, H), g = c.getContext('2d'), e = canvas(W, H), eg = e.getContext('2d');
  eg.fillStyle = '#000'; eg.fillRect(0, 0, W, H);
  SHOPS.forEach(([name, bg, fg], i) => {
    const x = (i % cols) * cw, y = Math.floor(i / cols) * ch;
    // fascia with the shop name
    g.fillStyle = bg; g.fillRect(x, y, cw, ch * 0.26);
    g.fillStyle = fg; g.font = `900 ${ch * 0.17}px "Segoe UI", Arial, sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(name, x + cw / 2, y + ch * 0.135);
    eg.fillStyle = fg; eg.font = g.font; eg.textAlign = 'center'; eg.textBaseline = 'middle'; eg.globalAlpha = 0.8; eg.fillText(name, x + cw / 2, y + ch * 0.135); eg.globalAlpha = 1;
    // shop interior seen through the glass: back wall, shelves with goods, pendant lamps, people
    const gy = y + ch * 0.3, gh = ch * 0.66, gx = x + 4, gw = cw - 8;
    const wall = g.createLinearGradient(gx, gy, gx, gy + gh);
    wall.addColorStop(0, '#6b5a48'); wall.addColorStop(0.7, '#3a3029'); wall.addColorStop(1, '#2a221c');
    g.fillStyle = wall; g.fillRect(gx, gy, gw, gh);
    const shelfY = [0.32, 0.55, 0.78];
    for (const sy of shelfY) {
      g.fillStyle = '#2a201a'; g.fillRect(gx + 6, gy + gh * sy, gw - 12, 2);
      for (let k = 0; k < 26; k++) {
        const iw = R(2, 5), ih = R(4, 10);
        g.fillStyle = `hsl(${R(0, 360)},${R(10, 45)}%,${R(35, 70)}%)`;
        g.fillRect(gx + 8 + k * (gw - 16) / 26, gy + gh * sy - ih, iw, ih);
      }
    }
    // counter + silhouettes
    g.fillStyle = '#20180f'; g.fillRect(gx + gw * 0.55, gy + gh * 0.72, gw * 0.4, gh * 0.28);
    for (let k = 0; k < 2; k++) {
      const px = gx + R(10, gw - 20), py = gy + gh * 0.45;
      g.fillStyle = 'rgba(20,15,12,0.85)'; g.beginPath(); g.arc(px, py, 4, 0, 7); g.fill(); g.fillRect(px - 5, py + 4, 10, gh * 0.5);
    }
    // pendant lamps
    for (let k = 0; k < 3; k++) { const lx = gx + gw * (0.2 + k * 0.3); g.fillStyle = '#1a1a1a'; g.fillRect(lx, gy, 1, 8); g.fillStyle = '#ffe6b0'; g.beginPath(); g.arc(lx, gy + 10, 4, 0, 7); g.fill(); }
    // glass reflection: sky gradient + diagonal streaks
    const refl = g.createLinearGradient(gx, gy, gx + gw, gy + gh);
    refl.addColorStop(0, 'rgba(255,220,190,0.28)'); refl.addColorStop(0.5, 'rgba(255,255,255,0.04)'); refl.addColorStop(1, 'rgba(120,150,200,0.18)');
    g.fillStyle = refl; g.fillRect(gx, gy, gw, gh);
    g.save(); g.beginPath(); g.rect(gx, gy, gw, gh); g.clip();
    g.strokeStyle = 'rgba(255,255,255,0.14)'; g.lineWidth = 9;
    for (let k = 0; k < 2; k++) { const sx = gx + R(0, gw); g.beginPath(); g.moveTo(sx, gy); g.lineTo(sx - gh * 0.6, gy + gh); g.stroke(); }
    g.restore();
    // emissive: warm interior light, lamps brightest, goods only softly
    const ig = eg.createLinearGradient(gx, gy, gx, gy + gh);
    ig.addColorStop(0, 'rgb(150,110,70)'); ig.addColorStop(1, 'rgb(60,40,25)');
    eg.fillStyle = ig; eg.globalAlpha = 0.7; eg.fillRect(gx, gy, gw, gh); eg.globalAlpha = 1;
    for (let k = 0; k < 3; k++) { const lx = gx + gw * (0.2 + k * 0.3); const r2 = eg.createRadialGradient(lx, gy + 10, 0, lx, gy + 10, 26); r2.addColorStop(0, 'rgba(255,230,180,1)'); r2.addColorStop(1, 'rgba(255,230,180,0)'); eg.fillStyle = r2; eg.fillRect(lx - 26, gy, 52, 40); }
    // door + frames
    g.fillStyle = '#2b2b2b'; g.fillRect(x + cw * 0.42, gy, 4, gh); g.fillRect(x + cw * 0.62, gy, 4, gh); g.fillRect(gx, gy + gh * 0.5, gw, 2);
    g.fillStyle = 'rgba(255,255,255,0.7)'; g.font = `600 ${ch * 0.05}px Arial`; g.textAlign = 'center'; g.fillText('OPEN', x + cw * 0.52, gy + gh * 0.42);
    eg.fillStyle = '#000'; eg.fillRect(x + cw * 0.42, gy, 4, gh); eg.fillRect(x + cw * 0.62, gy, 4, gh);
    g.fillStyle = '#8a8a8a'; g.fillRect(x, y + ch * 0.96, cw, ch * 0.04);
  });
  const t = tex(c, { repeat: false }), te = tex(e, { repeat: false });
  return { map: t, emissiveMap: te, cols, rows, colors: SHOPS.map((s) => s[1]) };
}

// ------------------------------------------------------------------ misc small textures
export function radial(color = '255,255,255', S = 128) {
  const c = canvas(S), g = c.getContext('2d');
  const gr = g.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  gr.addColorStop(0, `rgba(${color},1)`); gr.addColorStop(0.35, `rgba(${color},0.45)`); gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, S, S);
  return tex(c, { repeat: false });
}

export function leafSet() {
  const c = canvas(256), g = c.getContext('2d');
  for (let i = 0; i < 380; i++) {
    const x = R(8, 248), y = R(8, 248), r = R(5, 12), a = R(0, 6.28);
    g.save(); g.translate(x, y); g.rotate(a);
    g.fillStyle = `hsl(${R(85, 125)},${R(35, 60)}%,${R(20, 42)}%)`;
    g.beginPath(); g.ellipse(0, 0, r, r * 0.45, 0, 0, 7); g.fill();
    g.restore();
  }
  return tex(c, { repeat: false });
}
