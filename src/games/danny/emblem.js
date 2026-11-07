// Fire station emblem ("Feuerwache Danny") as inline SVG, used in the start menu and the hub.
export const EMBLEM_SVG = `
<svg class="dn-emblem" viewBox="0 0 200 200" aria-label="Feuerwache Danny" role="img">
  <defs>
    <linearGradient id="dnRed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff4b37"/><stop offset="1" stop-color="#9c0b10"/></linearGradient>
    <linearGradient id="dnFire" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#ff3b00"/><stop offset=".55" stop-color="#ffb000"/><stop offset="1" stop-color="#fff3a0"/></linearGradient>
    <path id="dnTop" d="M 26 100 A 74 74 0 0 1 174 100"/>
    <path id="dnBot" d="M 22 100 A 78 78 0 0 0 178 100"/>
  </defs>
  <circle cx="100" cy="100" r="97" fill="#1b2640"/>
  <circle cx="100" cy="100" r="97" fill="none" stroke="#e4ff3a" stroke-width="5"/>
  <circle cx="100" cy="100" r="62" fill="url(#dnRed)" stroke="#fff" stroke-width="3"/>
  <text font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="19" letter-spacing="3" fill="#fff"><textPath href="#dnTop" startOffset="50%" text-anchor="middle">FEUERWACHE</textPath></text>
  <text font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="17" letter-spacing="4" fill="#e4ff3a" dominant-baseline="hanging"><textPath href="#dnBot" startOffset="50%" text-anchor="middle">DANNY · itmX</textPath></text>
  <circle cx="18" cy="100" r="4" fill="#e4ff3a"/><circle cx="182" cy="100" r="4" fill="#e4ff3a"/>
  <path class="dn-flame" d="M66 138 C 56 112, 76 102, 72 80 C 84 92, 90 74, 100 54 C 108 76, 126 82, 122 100 C 134 94, 140 112, 134 138 Z" fill="url(#dnFire)"/>
  <path d="M58 140 V110 L100 84 L142 110 V140 Z" fill="#f4f6fa" stroke="#1b2640" stroke-width="3" stroke-linejoin="round"/>
  <rect x="67" y="116" width="27" height="24" fill="#1b2640"/>
  <rect x="106" y="116" width="27" height="24" fill="#1b2640"/>
  <path d="M67 122 H94 M67 128 H94 M67 134 H94 M106 122 H133 M106 128 H133 M106 134 H133" stroke="#3a4a6e" stroke-width="2"/>
  <rect x="91" y="98" width="18" height="12" rx="2" fill="#1b2640"/>
  <text x="100" y="107.5" font-family="Arial Black, Arial" font-weight="900" font-size="9" fill="#e4ff3a" text-anchor="middle">112</text>
  <rect class="dn-blue" x="92" y="74" width="16" height="8" rx="3" fill="#2f7bff"/>
  <path d="M84 72 L78 66 M116 72 L122 66 M100 70 V62" stroke="#7fb0ff" stroke-width="3" stroke-linecap="round" class="dn-blue"/>
  <rect x="52" y="140" width="96" height="5" rx="2" fill="#1b2640"/>
</svg>`;
