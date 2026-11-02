import { drawBrand, roundRect } from '../../core/gfx.js';

// "S4 Patent" handed over by Hannah aka S4HANNAH (3D prop and PNG export).

const BADGE = {
  gold: ['#ffe08a', '#ffb703'],
  silber: ['#f4f7fb', '#9aa3b0'],
  bronze: ['#f0c08f', '#b0703c'],
  teilnahme: ['#d8dbe3', '#7d8494']
};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';
const SERIF = 'Georgia, "Times New Roman", serif';

function fit(g, text, maxW, weight, size, family = FONT) {
  let px = size;
  g.font = `${weight} ${px}px ${family}`;
  while (g.measureText(text).width > maxW && px > 14) g.font = `${weight} ${--px}px ${family}`;
}

/** Stable pseudo patent number from name + date, so the same run always gets the same number. */
function patentNo(name, date) {
  let h = 2166136261;
  for (const ch of `${name}|${date.toDateString()}`) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return `S4-RC0-${date.getFullYear()}-${String(Math.abs(h) % 100000).padStart(5, '0')}`;
}

export function drawPatent(canvas, {
  name = '', score = 0, rc0 = 0, dumps = 0, phases = 0, boss = 'none', golive = false,
  rank = 'teilnahme', rankName = 'Teilnahme', rc = 'RC 12', title = '', line = '', date = new Date()
} = {}) {
  const W = 1600, H = 1131;
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');

  // deep navy paper with a fine guilloche pattern
  const bg = g.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#0d1838');
  bg.addColorStop(0.5, '#132554');
  bg.addColorStop(1, '#0b1430');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  g.save();
  g.globalAlpha = 0.09;
  g.strokeStyle = '#ffd34d';
  g.lineWidth = 1.2;
  for (let k = 0; k < 26; k++) {
    g.beginPath();
    for (let a = 0; a <= Math.PI * 2 + 0.01; a += 0.02) {
      const r = 260 + k * 14 + Math.sin(a * 9 + k * 0.4) * 22;
      const x = W / 2 + Math.cos(a) * r * 1.6, y = H / 2 + Math.sin(a) * r * 0.8;
      if (a === 0) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
  }
  g.restore();
  // double gold frame
  g.strokeStyle = '#d9b44a'; g.lineWidth = 10;
  roundRect(g, 36, 36, W - 72, H - 72, 18); g.stroke();
  g.strokeStyle = 'rgba(217,180,74,0.6)'; g.lineWidth = 2;
  roundRect(g, 58, 58, W - 116, H - 116, 12); g.stroke();
  // corner ornaments
  g.fillStyle = '#d9b44a';
  for (const [x, y] of [[58, 58], [W - 58, 58], [58, H - 58], [W - 58, H - 58]]) {
    g.beginPath(); g.arc(x, y, 12, 0, Math.PI * 2); g.fill();
  }

  drawBrand(g, 100, 92, 250, 66, { wordmark: true });
  g.textAlign = 'right';
  g.fillStyle = 'rgba(255,255,255,0.75)';
  g.font = `700 26px ${FONT}`;
  g.fillText(`Patent-Nr. ${patentNo(name || '-', date)}`, W - 100, 118);
  g.fillText(`Erteilt am ${date.toLocaleDateString('de-DE')}`, W - 100, 152);

  g.textAlign = 'center';
  g.fillStyle = '#ffd34d';
  g.font = `800 28px ${FONT}`;
  g.fillText('ITMX SPIELEWELT  ·  MISSION RC 0  ·  SAP S/4HANA CONVERSION', W / 2, 238);
  g.save();
  g.shadowColor = 'rgba(255,211,77,0.6)'; g.shadowBlur = 30;
  g.fillStyle = '#fff7dc';
  g.font = `900 140px ${SERIF}`;
  g.fillText('S4 Patent', W / 2, 372);
  g.restore();

  g.fillStyle = 'rgba(255,255,255,0.82)';
  g.font = `500 32px ${FONT}`;
  g.fillText('Das Patent wird erteilt an', W / 2, 444);
  g.fillStyle = '#ffffff';
  const nm = name?.trim() || 'Unbekannte Conversion-Legende';
  fit(g, nm, W - 420, 800, 86, SERIF);
  g.fillText(nm, W / 2, 540);
  g.strokeStyle = 'rgba(255,211,77,0.5)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(420, 568); g.lineTo(W - 420, 568); g.stroke();

  g.fillStyle = 'rgba(255,255,255,0.9)';
  const bossTxt = { won: 'den SAP Business Partner besiegt', left: 'den SAP Business Partner überlebt', lost: 'vom SAP Business Partner überrollt' }[boss] || 'dem SAP Business Partner aus dem Weg gegangen';
  const lines = [
    `für die Erfindung: ${golive ? 'Go-Live mit dem neuen itmX CRM der Ludlein Crew' : 'Conversion unter verschärften Bedingungen'}.`,
    `${rc0} Transporte mit RC 0 importiert, ${phases} von 6 Phasen geschafft, ${bossTxt},`,
    `${dumps} ${dumps === 1 ? 'Kurzdump' : 'Kurzdumps'} und ${score.toLocaleString('de-DE')} Punkte.`
  ];
  lines.forEach((l, i) => { fit(g, l, W - 300, 500, 32); g.fillText(l, W / 2, 630 + i * 46); });

  // rank badge
  const [b0, b1] = BADGE[rank] || BADGE.teilnahme;
  const bx = W / 2, by = 818;
  const grd = g.createLinearGradient(bx - 300, by - 50, bx + 300, by + 50);
  grd.addColorStop(0, b0); grd.addColorStop(1, b1);
  g.fillStyle = grd;
  roundRect(g, bx - 360, by - 50, 720, 100, 50); g.fill();
  g.fillStyle = '#1b1300';
  const rt = `${rankName} · ${rc}: ${title}`;
  fit(g, rt, 660, 900, 44);
  g.fillText(rt, bx, by + 15);
  g.fillStyle = 'rgba(255,255,255,0.78)';
  fit(g, line, W - 400, 500, 30);
  g.fillText(line, W / 2, 910);

  // seal
  const sx = 250, sy = 950;
  g.save();
  g.translate(sx, sy);
  g.fillStyle = '#b3261e';
  g.beginPath();
  for (let i = 0; i < 48; i++) {
    const a = (i / 48) * Math.PI * 2, r = i % 2 ? 92 : 104;
    g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  g.closePath(); g.fill();
  g.strokeStyle = '#ffd34d'; g.lineWidth = 4;
  g.beginPath(); g.arc(0, 0, 78, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#ffe9a8';
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.font = `900 64px ${FONT}`;
  g.fillText('S4', 0, -6);
  g.font = `800 17px ${FONT}`;
  g.fillText('★ RC 0 ★', 0, 42);
  g.restore();
  // Ludlein stamp
  g.save();
  g.translate(W / 2, 1010);
  g.rotate(-0.05);
  g.strokeStyle = 'rgba(80,175,48,0.85)'; g.lineWidth = 5;
  roundRect(g, -220, -34, 440, 68, 10); g.stroke();
  g.fillStyle = 'rgba(80,175,48,0.9)';
  g.font = `900 30px ${FONT}`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.fillText('LUDLEIN CREW APPROVED', 0, 2);
  g.restore();

  // signature
  g.textAlign = 'right';
  g.textBaseline = 'alphabetic';
  g.fillStyle = '#ffe9a8';
  g.font = `italic 700 62px "Brush Script MT", "Segoe Script", "Snell Roundhand", cursive`;
  g.fillText('S4HANNAH', W - 140, 1000);
  g.fillStyle = 'rgba(255,255,255,0.65)';
  g.font = `600 24px ${FONT}`;
  g.fillText('Hannah, aka S4HANNAH', W - 140, 1036);
}
