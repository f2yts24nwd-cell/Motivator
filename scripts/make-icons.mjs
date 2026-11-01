// Renders the PWA icons from an inline SVG using the preinstalled Playwright Chromium.
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const svg = (pad) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bg" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="#1b2a52"/><stop offset="1" stop-color="#070a14"/></radialGradient>
    <linearGradient id="xl" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2fae63"/><stop offset="1" stop-color="#155c35"/></linearGradient>
    <linearGradient id="hd" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5571"/><stop offset="1" stop-color="#1e2436"/></linearGradient>
  </defs>
  <rect width="512" height="512" fill="url(#bg)"/>
  <g transform="translate(256 256) scale(${pad}) translate(-256 -256)">
    <!-- shattered excel tile -->
    <g transform="translate(150 280) rotate(-8)">
      <path d="M0 0 h90 l-14 60 l24 50 h-100z" fill="url(#xl)"/>
      <path d="M104 0 h96 v110 h-86 l-20 -48z" fill="url(#xl)"/>
      <text x="56" y="86" font-family="Arial Black, Arial" font-weight="900" font-size="96" fill="#fff">X</text>
    </g>
    <g fill="#2fae63"><rect x="110" y="250" width="22" height="22" transform="rotate(30 120 260)"/><rect x="380" y="240" width="18" height="18" transform="rotate(-20 390 250)"/><rect x="400" y="330" width="14" height="14"/></g>
    <g fill="#19c3ff"><circle cx="96" cy="350" r="9"/><circle cx="420" cy="290" r="7"/><circle cx="130" cy="210" r="6"/></g>
    <!-- hammer -->
    <g transform="rotate(-35 256 256)">
      <rect x="244" y="150" width="24" height="250" rx="10" fill="#9a6538"/>
      <rect x="244" y="330" width="24" height="70" rx="10" fill="#141414"/>
      <rect x="150" y="90" width="212" height="96" rx="30" fill="url(#hd)"/>
      <rect x="138" y="84" width="40" height="108" rx="14" fill="#ff2d55"/>
      <rect x="334" y="84" width="40" height="108" rx="14" fill="#ff2d55"/>
      <rect x="196" y="90" width="8" height="96" fill="#19c3ff"/>
      <rect x="308" y="90" width="8" height="96" fill="#19c3ff"/>
    </g>
  </g>
</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage();
const out = new URL('../public/icons/', import.meta.url);
async function render(size, pad, name) {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<html><body style="margin:0">${svg(pad).replace('width="512" height="512"', `width="${size}" height="${size}"`)}</body></html>`);
  const buf = await page.screenshot({ clip: { x: 0, y: 0, width: size, height: size } });
  writeFileSync(new URL(name, out), buf);
}
await render(192, 1, 'icon-192.png');
await render(512, 1, 'icon-512.png');
await render(512, 0.78, 'icon-maskable-512.png');
await render(180, 1, 'apple-touch-icon.png');
await browser.close();
console.log('icons written');
