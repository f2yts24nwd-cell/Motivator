import { drawBrand, roundRect } from '../../core/gfx.js';

const BADGE = {
  gold: ['#ffe08a', '#ffb703'],
  silber: ['#f4f7fb', '#9aa3b0'],
  bronze: ['#f0c08f', '#b0703c'],
  teilnahme: ['#d8dbe3', '#7d8494']
};
const FONT = 'system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif';

function fit(g, text, maxW, weight, size, family = FONT) {
  let px = size;
  g.font = `${weight} ${px}px ${family}`;
  while (g.measureText(text).width > maxW && px > 14) g.font = `${weight} ${--px}px ${family}`;
}

/** The "Feierabend-Urkunde" handed over by Tina X. (3D prop and PNG export). */
export function drawUrkunde(canvas, { name = '', score = 0, solved = 0, extraCount = 0, fruits = 0, rank = 'teilnahme', rankName = 'Teilnahme', title = '', line = '', date = new Date() } = {}) {
  const W = 1600, H = 1131;
  canvas.width = W;
  canvas.height = H;
  const g = canvas.getContext('2d');

  // night-city gradient with neon frame
  const bg = g.createLinearGradient(0, 0, 0, H);
  bg.addColorStop(0, '#120a2a');
  bg.addColorStop(0.55, '#1c0f3a');
  bg.addColorStop(1, '#3a1036');
  g.fillStyle = bg;
  g.fillRect(0, 0, W, H);
  // skyline silhouette
  let x = 0, seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  while (x < W) {
    const bw = 40 + rnd() * 90, bh = 90 + rnd() * 220;
    g.fillStyle = 'rgba(8,5,20,0.75)';
    g.fillRect(x, H - bh, bw, bh);
    for (let yy = H - bh + 10; yy < H - 8; yy += 16) for (let xx = x + 6; xx < x + bw - 6; xx += 12) {
      if (rnd() < 0.25) { g.fillStyle = rnd() < 0.7 ? 'rgba(255,210,122,0.5)' : 'rgba(127,227,255,0.5)'; g.fillRect(xx, yy, 5, 7); }
    }
    x += bw + 4;
  }
  g.save();
  g.shadowColor = '#ff3d9a'; g.shadowBlur = 30;
  g.strokeStyle = '#ff7ac0'; g.lineWidth = 8;
  roundRect(g, 40, 40, W - 80, H - 80, 36); g.stroke();
  g.shadowColor = '#19c3ff';
  g.strokeStyle = '#7fe3ff'; g.lineWidth = 3;
  roundRect(g, 64, 64, W - 128, H - 128, 26); g.stroke();
  g.restore();

  drawBrand(g, 110, 100, 260, 70, { wordmark: true });
  g.textAlign = 'right';
  g.fillStyle = 'rgba(255,255,255,0.7)';
  g.font = `700 30px ${FONT}`;
  g.fillText(date.toLocaleDateString('de-DE'), W - 110, 148);

  g.textAlign = 'center';
  g.fillStyle = '#ffcc4d';
  g.font = `800 30px ${FONT}`;
  g.fillText('ITMX SPIELEWELT  ·  RETTET DEN FEIERABEND!', W / 2, 250);
  g.save();
  g.shadowColor = '#ff3d9a'; g.shadowBlur = 36;
  g.fillStyle = '#fff0f8';
  g.font = `900 120px ${FONT}`;
  g.fillText('Feierabend-Urkunde', W / 2, 375);
  g.restore();

  g.fillStyle = 'rgba(255,255,255,0.8)';
  g.font = `500 34px ${FONT}`;
  g.fillText('Hiermit wird bestätigt, dass', W / 2, 460);
  g.save();
  g.shadowColor = '#19c3ff'; g.shadowBlur = 20;
  g.fillStyle = '#ffffff';
  fit(g, name?.trim() || 'Unbekannte Sales-Legende', W - 400, 800, 92);
  g.fillText(name?.trim() || 'Unbekannte Sales-Legende', W / 2, 570);
  g.restore();
  g.strokeStyle = 'rgba(255,255,255,0.35)'; g.lineWidth = 2;
  g.beginPath(); g.moveTo(400, 600); g.lineTo(W - 400, 600); g.stroke();

  g.fillStyle = 'rgba(255,255,255,0.88)';
  const lines = [
    `${solved} Aufgaben mit itmX customer realtimeXperience erledigt,`,
    `${score} Minuten gespart, ${fruits} Low Hanging Fruits gepflückt und ${extraCount}× die Extra Meile gegangen ist.`
  ];
  lines.forEach((l, i) => { fit(g, l, W - 300, 500, 34); g.fillText(l, W / 2, 668 + i * 50); });

  // rank badge
  const [b0, b1] = BADGE[rank] || BADGE.teilnahme;
  const bx = W / 2, by = 845;
  const grd = g.createLinearGradient(bx - 300, by - 50, bx + 300, by + 50);
  grd.addColorStop(0, b0); grd.addColorStop(1, b1);
  g.fillStyle = grd;
  roundRect(g, bx - 330, by - 52, 660, 104, 52); g.fill();
  g.fillStyle = '#1b1300';
  fit(g, `${rankName}: ${title}`, 600, 900, 46);
  g.fillText(`${rankName}: ${title}`, bx, by + 16);
  g.fillStyle = 'rgba(255,255,255,0.75)';
  fit(g, line, W - 400, 500, 30);
  g.fillText(line, W / 2, 945);

  // signature
  g.textAlign = 'right';
  g.fillStyle = '#ffd0ea';
  g.font = `italic 700 58px "Brush Script MT", "Segoe Script", "Snell Roundhand", cursive`;
  g.fillText('Tina X.', W - 150, 1010);
  g.fillStyle = 'rgba(255,255,255,0.6)';
  g.font = `600 24px ${FONT}`;
  g.fillText('Tina X., Top-Verkäuferin', W - 150, 1044);
}
