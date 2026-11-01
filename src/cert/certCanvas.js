import { drawBrand, roundRect } from '../core/gfx.js';

// Renders the "Schwetz-Zertifikat" onto a canvas (used for the 3D prop and the PNG download).
export function drawCertificate(canvas, { name = '', score = 0, hits = 0, bestCombo = 0, date = new Date() } = {}) {
  const W = 1600, H = 1131;
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');
  const rng = mulberry(1234);

  // parchment
  const bg = g.createRadialGradient(W / 2, H / 2, 200, W / 2, H / 2, W * 0.75);
  bg.addColorStop(0, '#fbf3dc');
  bg.addColorStop(1, '#e6d3a3');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  for (let i = 0; i < 2500; i++) {
    g.fillStyle = `rgba(120,90,40,${rng() * 0.05})`;
    g.fillRect(rng() * W, rng() * H, 2 + rng() * 3, 2 + rng() * 3);
  }

  // borders
  g.strokeStyle = '#7a5a1e';
  g.lineWidth = 10;
  g.strokeRect(40, 40, W - 80, H - 80);
  g.lineWidth = 3;
  g.strokeRect(62, 62, W - 124, H - 124);
  g.fillStyle = '#7a5a1e';
  for (const [x, y] of [[62, 62], [W - 62, 62], [62, H - 62], [W - 62, H - 62]]) {
    g.beginPath(); g.arc(x, y, 16, 0, Math.PI * 2); g.fill();
  }

  // coffee ring (it's the Zottel's certificate after all)
  g.save();
  g.strokeStyle = 'rgba(110,65,20,0.28)';
  g.lineWidth = 16;
  g.beginPath(); g.arc(W - 270, 250, 95, 0.3, Math.PI * 1.85); g.stroke();
  g.lineWidth = 5;
  g.beginPath(); g.arc(W - 268, 252, 82, 0, Math.PI * 2); g.stroke();
  g.fillStyle = 'rgba(110,65,20,0.12)';
  g.beginPath(); g.arc(W - 330, 330, 22, 0, Math.PI * 2); g.fill();
  // crumbs
  for (let i = 0; i < 40; i++) {
    g.fillStyle = `rgba(150,100,40,${0.2 + rng() * 0.4})`;
    g.beginPath(); g.arc(180 + rng() * 260, H - 260 + rng() * 120, 2 + rng() * 4, 0, Math.PI * 2); g.fill();
  }
  g.restore();

  g.textAlign = 'center';
  g.fillStyle = '#3b2a0c';
  g.font = '700 34px Georgia, "Times New Roman", serif';
  g.fillText('— itmX Spielewelt · Legacy Smash —', W / 2, 160);
  g.font = '900 104px Georgia, "Times New Roman", serif';
  g.fillStyle = '#6b4a10';
  g.fillText('Schwetz-Zertifikat', W / 2, 285);
  g.font = 'italic 40px Georgia, serif';
  g.fillStyle = '#3b2a0c';
  g.fillText('für herausragende CRM-Expertise', W / 2, 350);

  g.font = '32px Georgia, serif';
  g.fillText('Hiermit wird feierlich (und etwas verkrümelt) bescheinigt, dass', W / 2, 450);
  g.font = '700 82px "Brush Script MT", "Segoe Script", Georgia, cursive';
  g.fillStyle = '#1d3b6e';
  g.fillText(name?.trim() || 'Unbekannte Sales-Legende', W / 2, 560);
  g.strokeStyle = 'rgba(59,42,12,0.5)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(380, 590); g.lineTo(W - 380, 590); g.stroke();

  g.fillStyle = '#3b2a0c';
  g.font = '32px Georgia, serif';
  const lines = [
    `${hits} Legacy-Systeme mit dem CRM-Hammer zerlegt und dabei`,
    `${score.toLocaleString('de-DE')} Punkte erzielt hat (beste Combo: ${bestCombo}).`,
    'Excel-Listen, Disketten und Karl Klammer zittern ab sofort.'
  ];
  lines.forEach((l, i) => g.fillText(l, W / 2, 665 + i * 48));

  // seal
  const sx = W / 2, sy = 905;
  g.save();
  g.translate(sx, sy);
  g.fillStyle = '#b8860b';
  for (let i = 0; i < 24; i++) {
    g.rotate(Math.PI / 12);
    g.beginPath(); g.moveTo(0, -105); g.lineTo(18, -82); g.lineTo(-18, -82); g.fill();
  }
  const sg = g.createRadialGradient(-20, -20, 10, 0, 0, 90);
  sg.addColorStop(0, '#ffe08a'); sg.addColorStop(1, '#b8860b');
  g.fillStyle = sg;
  g.beginPath(); g.arc(0, 0, 86, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#7a5a1e'; g.lineWidth = 4;
  g.beginPath(); g.arc(0, 0, 70, 0, Math.PI * 2); g.stroke();
  g.fillStyle = '#5a3d05';
  g.font = '900 46px Georgia, serif';
  g.fillText('CRM', 0, 4);
  g.font = '700 18px Georgia, serif';
  g.fillText('GEPRÜFT', 0, 34);
  g.restore();

  // signature + date
  g.fillStyle = '#3b2a0c';
  g.font = '28px Georgia, serif';
  g.textAlign = 'left';
  g.fillText(date.toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' }), 170, 960);
  g.beginPath(); g.moveTo(170, 975); g.lineTo(520, 975); g.stroke();
  g.font = '22px Georgia, serif';
  g.fillText('Datum', 170, 1005);

  g.textAlign = 'right';
  g.strokeStyle = '#1d3b6e';
  g.lineWidth = 4;
  g.beginPath();
  let x = W - 520, y = 950;
  g.moveTo(x, y);
  for (let i = 0; i < 14; i++) {
    x += 22; y = 950 + Math.sin(i * 1.7) * 26 + (rng() - 0.5) * 18;
    g.quadraticCurveTo(x - 10, y - 30 * rng(), x, y);
  }
  g.stroke();
  g.strokeStyle = 'rgba(59,42,12,0.5)';
  g.lineWidth = 2;
  g.beginPath(); g.moveTo(W - 520, 975); g.lineTo(W - 170, 975); g.stroke();
  g.fillStyle = '#3b2a0c';
  g.font = '22px Georgia, serif';
  g.fillText('Der Zottel, i. A. des Schwetz-Komitees', W - 170, 1005);

  // presented-by badge with the itmX logo
  g.fillStyle = '#0d1424';
  roundRect(g, W / 2 - 120, H - 130, 240, 68, 14);
  g.fill();
  drawBrand(g, W / 2 - 105, H - 122, 210, 52, { wordmark: true });
  return canvas;
}

function mulberry(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
