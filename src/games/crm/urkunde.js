import { drawBrand } from '../../core/gfx.js';
import { MODULES, TOWER_MODS } from './content.js';

// Royal certificate handed over by Lord CRM: parchment, gold frame, crown, wax seal.

const SERIF = 'Georgia, "Times New Roman", serif';
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const SEAL = { gold: ['#ffe08a', '#c98a00'], silber: ['#f4f7fb', '#8d97a6'], bronze: ['#f0c08f', '#9a5d2c'], teilnahme: ['#e3c9c9', '#8e3b3b'] };

function fit(g, text, maxW, weight, size, family = SERIF) {
  let px = size;
  g.font = `${weight} ${px}px ${family}`;
  while (g.measureText(text).width > maxW && px > 14) g.font = `${weight} ${--px}px ${family}`;
}

function crown(g, cx, cy, s, fill = '#d9a400') {
  g.save();
  g.translate(cx, cy);
  g.fillStyle = fill;
  g.strokeStyle = '#7a5600';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(-s, s * 0.5);
  g.lineTo(-s, -s * 0.3);
  g.lineTo(-s * 0.5, s * 0.05);
  g.lineTo(0, -s * 0.6);
  g.lineTo(s * 0.5, s * 0.05);
  g.lineTo(s, -s * 0.3);
  g.lineTo(s, s * 0.5);
  g.closePath();
  g.fill(); g.stroke();
  g.fillRect(-s, s * 0.5, s * 2, s * 0.22);
  g.strokeRect(-s, s * 0.5, s * 2, s * 0.22);
  for (const [x, y, c] of [[-s, -s * 0.36, '#ff2a55'], [0, -s * 0.68, '#50af30'], [s, -s * 0.36, '#3d8bff']]) {
    g.fillStyle = c; g.beginPath(); g.arc(x, y, s * 0.13, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

export function drawUrkunde(canvas, {
  name = '', score = 0, rank = 'teilnahme', rankName = 'Teilnahme', title = 'Knappe des CRM',
  bauplan = 0, pillars = [0, 0, 0, 0], fundaments = 0, kills = 0, boss = false, date = new Date()
} = {}) {
  const W = 1600, H = 1131;
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');

  // parchment
  const bg = g.createRadialGradient(W / 2, H / 2, 100, W / 2, H / 2, W * 0.7);
  bg.addColorStop(0, '#fbf1d6');
  bg.addColorStop(0.7, '#f0dcaa');
  bg.addColorStop(1, '#cfa865');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // fibres and stains (seeded so it looks the same every time)
  let s = 11;
  const r = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
  g.globalAlpha = 0.07;
  for (let i = 0; i < 900; i++) { g.fillStyle = r() < 0.5 ? '#8a5a20' : '#ffffff'; g.fillRect(r() * W, r() * H, 1 + r() * 40, 1); }
  for (let i = 0; i < 9; i++) {
    const x = r() * W, y = r() * H, rad = 40 + r() * 110;
    const st = g.createRadialGradient(x, y, 0, x, y, rad);
    st.addColorStop(0, 'rgba(122,74,16,0.07)'); st.addColorStop(1, 'rgba(122,74,16,0)');
    g.fillStyle = st; g.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  g.globalAlpha = 1;
  // burnt edge
  const edge = g.createLinearGradient(0, 0, 0, H);
  edge.addColorStop(0, 'rgba(110,60,10,0.35)'); edge.addColorStop(0.08, 'rgba(110,60,10,0)'); edge.addColorStop(0.92, 'rgba(110,60,10,0)'); edge.addColorStop(1, 'rgba(110,60,10,0.35)');
  g.fillStyle = edge; g.fillRect(0, 0, W, H);

  // ornamental double frame
  g.strokeStyle = '#a8780f'; g.lineWidth = 10; g.strokeRect(40, 40, W - 80, H - 80);
  g.strokeStyle = 'rgba(168,120,15,0.6)'; g.lineWidth = 3; g.strokeRect(62, 62, W - 124, H - 124);
  // corner ornaments: little voxel blocks in the module colours
  const cols = TOWER_MODS.map((m) => MODULES[m].color);
  [[62, 62], [W - 62, 62], [62, H - 62], [W - 62, H - 62]].forEach(([x, y], i) => {
    g.save(); g.translate(x, y); g.rotate(Math.PI / 4);
    g.fillStyle = cols[i]; g.fillRect(-20, -20, 40, 40);
    g.strokeStyle = '#7a5600'; g.lineWidth = 3; g.strokeRect(-20, -20, 40, 40);
    g.restore();
  });

  // header
  crown(g, W / 2, 135, 56);
  g.textAlign = 'center';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#7a1020';
  g.font = `700 28px ${SERIF}`;
  g.fillText('K Ö N I G R E I C H   D E R   K U N D E N B E Z I E H U N G', W / 2, 242);
  g.fillStyle = '#3b2108';
  g.font = `italic 700 82px ${SERIF}`;
  g.fillText('Königliche Urkunde', W / 2, 330);
  g.font = `600 30px ${SERIF}`;
  g.fillStyle = '#5a3a14';
  g.fillText('Kraft der Krone wird zum Ritter des CRM geschlagen', W / 2, 384);

  // name
  const nm = name.trim() || 'Unbekannte:r Baumeister:in';
  fit(g, nm, W - 420, 'italic 700', 92);
  g.fillStyle = '#1d1206';
  g.fillText(nm, W / 2, 492);
  g.strokeStyle = '#a8780f'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(W / 2 - 420, 516); g.lineTo(W / 2 + 420, 516); g.stroke();

  // title
  g.font = `600 32px ${SERIF}`;
  g.fillStyle = '#5a3a14';
  g.fillText('und erhoben zum Rang', W / 2, 568);
  fit(g, title, W - 500, '800', 58);
  g.fillStyle = '#7a1020';
  g.fillText(title, W / 2, 636);

  // achievements
  g.font = `500 27px ${SERIF}`;
  g.fillStyle = '#3b2108';
  const lines = [
    `Bauplan erfüllt: ${bauplan} %   ·   SAP-Fundament: ${fundaments}/4   ·   Legacy-Monster besiegt: ${kills}`,
    `Türme: ${TOWER_MODS.map((m, i) => `${MODULES[m].name} ${pillars[i] || 0}`).join('  ·  ')}${boss ? '   ·   Bezwinger:in des Medienbruchs' : ''}`
  ];
  lines.forEach((l, i) => { fit(g, l, W - 360, '500', 27); g.fillText(l, W / 2, 704 + i * 42); });
  g.font = `700 34px ${SERIF}`;
  g.fillStyle = '#1d1206';
  g.fillText(`${score.toLocaleString('de-DE')} Punkte`, W / 2, 810);

  // signature
  g.textAlign = 'left';
  g.font = `italic 400 62px "Brush Script MT", "Segoe Script", cursive, ${SERIF}`;
  g.fillStyle = '#1b2a5a';
  g.fillText('Lord CRM', 190, 960);
  g.strokeStyle = '#5a3a14'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(180, 978); g.lineTo(560, 978); g.stroke();
  g.font = `600 22px ${SERIF}`; g.fillStyle = '#5a3a14';
  g.fillText('Lord CRM, Herrscher des Königreichs', 180, 1010);
  g.textAlign = 'right';
  g.font = `600 26px ${SERIF}`;
  g.fillText(date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }), W - 180, 960);
  g.beginPath(); g.moveTo(W - 520, 978); g.lineTo(W - 180, 978); g.stroke();
  g.font = `600 22px ${SERIF}`;
  g.fillText('Gegeben im Thronsaal', W - 180, 1010);

  // wax seal with the itmX logo + rank
  const [hi, lo] = SEAL[rank] || SEAL.teilnahme;
  const sx = W / 2, sy = 965, sr = 92;
  g.save();
  g.fillStyle = '#9b1c26';
  g.beginPath();
  for (let i = 0; i < 28; i++) { const a = (i / 28) * Math.PI * 2, rr = sr + (i % 2 ? 8 : -2); g.lineTo(sx + Math.cos(a) * rr, sy + Math.sin(a) * rr); }
  g.closePath(); g.fill();
  const sg = g.createRadialGradient(sx - 25, sy - 25, 10, sx, sy, sr);
  sg.addColorStop(0, hi); sg.addColorStop(1, lo);
  g.fillStyle = sg;
  g.beginPath(); g.arc(sx, sy, sr - 14, 0, Math.PI * 2); g.fill();
  g.strokeStyle = 'rgba(0,0,0,0.25)'; g.lineWidth = 3; g.beginPath(); g.arc(sx, sy, sr - 24, 0, Math.PI * 2); g.stroke();
  drawBrand(g, sx - 34, sy - 58, 68, 68);
  g.textAlign = 'center';
  g.font = `900 22px ${FONT}`;
  g.fillStyle = '#2a1a06';
  g.fillText(rankName.toUpperCase(), sx, sy + 44);
  g.restore();
}
