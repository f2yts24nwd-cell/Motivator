import * as THREE from 'three';
import { canvasTexture, rand, clamp, lerp } from '../core/gfx.js';
import { sfx, music } from '../core/audio.js';
import { loadAvatar, buildAvatar, disposeAvatar } from '../hub/avatar.js';
import { RANKS } from '../games/whack/ranks.js';
import { h, mount, clearUI, storeGet, storeSet } from '../core/ui.js';
import { buildSchwetz } from './schwetz.js';
import { drawCertificate } from './certCanvas.js';

const SPEAKER = 'Dumêz G. Schwetz';
const RANK_LINES = {
  gold: 'Alter … ich hab gesehen, wie du die Legacy-Systeme zerlegt hast. So was gab’s seit 1998 nicht mehr.',
  silber: 'Nicht schlecht. Excel hat geweint, SAP hat kurz überlegt zu kündigen.',
  bronze: 'Okay, ein paar Disketten hast du erwischt. Respekt … irgendwie.',
  teilnahme: 'Ehrlich gesagt hab ich in der Zeit mehr Chips gegessen als du gehauen hast. Aber egal, Urkunde ist Urkunde.'
};
const linesFor = (rank) => [
  'Moin … *schlurf* … Dumêz G. Schwetz mein Name. Ich bin hier für die Zertifikate zuständig.',
  RANK_LINES[rank.id],
  `Hier. Dein Schwetz-Zertifikat, Stufe ${rank.name}. Is’ nur ’n bisschen vollgekrümelt, sorry.`
];

export class CertificateScene {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
    this.build();
  }

  build() {
    const s = this.scene;
    s.background = new THREE.Color(0x0d0a12);
    s.fog = new THREE.Fog(0x0d0a12, 8, 20);
    s.environment = this.app.gfx.envMap;
    s.environmentIntensity = 0.35;
    s.add(new THREE.HemisphereLight(0xffd8b0, 0x201018, 0.5));
    const spot = new THREE.SpotLight(0xffe2b8, 110, 20, 0.45, 0.6, 1.6);
    spot.position.set(1.5, 7, 4);
    spot.target.position.set(0, 1.5, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(2048, 2048);
    spot.shadow.bias = -0.0003;
    s.add(spot, spot.target);
    const rim = new THREE.PointLight(0xff3d9a, 18, 10);
    rim.position.set(-2.5, 3, -1.5);
    s.add(rim);
    const rim2 = new THREE.PointLight(0x19c3ff, 14, 10);
    rim2.position.set(2.8, 2.5, -1.5);
    s.add(rim2);

    const concrete = canvasTexture(512, 512, (g, w, hh) => {
      g.fillStyle = '#2a2730'; g.fillRect(0, 0, w, hh);
      for (let i = 0; i < 6000; i++) { g.fillStyle = `rgba(${Math.random() < 0.5 ? '0,0,0' : '255,255,255'},${Math.random() * 0.06})`; g.fillRect(Math.random() * w, Math.random() * hh, 2, 2); }
    });
    concrete.wrapS = concrete.wrapT = THREE.RepeatWrapping;
    concrete.repeat.set(6, 6);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), new THREE.MeshStandardMaterial({ map: concrete, roughness: 0.85 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);

    const brick = canvasTexture(512, 512, (g, w, hh) => {
      g.fillStyle = '#2b1d1d'; g.fillRect(0, 0, w, hh);
      for (let y = 0; y < hh; y += 32) for (let x = (y / 32) % 2 ? -32 : 0; x < w; x += 64) {
        g.fillStyle = `hsl(${rand(5, 18)}, ${rand(25, 40)}%, ${rand(18, 26)}%)`;
        g.fillRect(x + 2, y + 2, 60, 28);
      }
    });
    brick.wrapS = brick.wrapT = THREE.RepeatWrapping;
    brick.repeat.set(5, 2.5);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(24, 10), new THREE.MeshStandardMaterial({ map: brick, roughness: 0.9, color: 0x9a8a8a }));
    wall.position.set(0, 5, -3);
    wall.receiveShadow = true;
    s.add(wall);

    // flickering neon
    const neon = canvasTexture(1024, 256, (g, w, hh) => {
      g.font = '900 120px "Segoe UI", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#ff3d9a'; g.shadowBlur = 30; g.fillStyle = '#ffd0ea';
      g.fillText('CRM-EXPERTE', w / 2, hh / 2);
    });
    this.neon = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.25), new THREE.MeshBasicMaterial({ map: neon, transparent: true, color: new THREE.Color(2, 2, 2), toneMapped: false, depthWrite: false }));
    this.neon.position.set(0, 4.6, -2.9);
    s.add(this.neon);

    // props: pizza box + crumpled paper
    const pizza = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.07, 0.8), new THREE.MeshStandardMaterial({ color: 0xc9a46b, roughness: 0.9 }));
    pizza.position.set(-2.9, 0.035, 1.6);
    pizza.rotation.y = 0.4;
    pizza.castShadow = true;
    s.add(pizza);
    for (let i = 0; i < 5; i++) {
      const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(0.1, 0), new THREE.MeshStandardMaterial({ color: 0x9a978f, flatShading: true, roughness: 1 }));
      ball.position.set(rand(-2.5, 2.5), 0.08, rand(-1.5, 1.5));
      ball.castShadow = true;
      s.add(ball);
    }

    this.z = buildSchwetz();
    this.z.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    s.add(this.z.root);

    // certificate prop
    this.certCanvas = document.createElement('canvas');
    drawCertificate(this.certCanvas, {});
    this.certTex = new THREE.CanvasTexture(this.certCanvas);
    this.certTex.colorSpace = THREE.SRGBColorSpace;
    this.certTex.anisotropy = 8;
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.78), new THREE.MeshStandardMaterial({ map: this.certTex, color: 0xb8b8b8, roughness: 0.9, side: THREE.DoubleSide }));
    this.paper.castShadow = true;
    this.z.armR.elbow.add(this.paper);

    // confetti
    this.confetti = [];
    const cg = new THREE.PlaneGeometry(0.06, 0.1);
    const cols = [0xffcc4d, 0x19c3ff, 0xff3d9a, 0x3ddc84, 0xffffff];
    for (let i = 0; i < 160; i++) {
      const m = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, emissive: cols[i % cols.length], emissiveIntensity: 0.3 }));
      m.visible = false;
      s.add(m);
      this.confetti.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3() });
    }
  }

  enter(stats) {
    this.stats = { rank: 'teilnahme', score: 0, hits: 0, bestCombo: 0, ...(stats || {}) };
    this.rank = RANKS.find((r) => r.id === this.stats.rank) || RANKS[RANKS.length - 1];
    this.lines = linesFor(this.rank);
    // the player's own avatar receives the certificate
    if (this.player) { this.scene.remove(this.player.root); disposeAvatar(this.player); }
    this.player = buildAvatar(loadAvatar());
    this.player.root.position.set(-1.35, 0, 0.6);
    this.player.root.rotation.y = 0.5;
    this.player.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.player.root);
    music.play('cert');
    this.name = storeGet('player-name', '');
    this.t = 0;
    this.phase = 'walk';
    this.lineIdx = -1;
    this.z.root.position.set(4.5, 0, 0.3);
    this.z.root.rotation.y = -Math.PI / 2;
    this.redrawCert();
    this.resize(window.innerWidth, window.innerHeight);
    clearUI();
    mount(h('button.icon-btn.left', { title: 'Zurück zur Spielewelt', onclick: () => { sfx.click(); this.app.goHub(); } }, '⟵'));
    for (const c of this.confetti) c.m.visible = false;
  }

  exit() { clearUI(); }

  resize(w, hgt) {
    const aspect = w / hgt;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    // keep both the player avatar (left) and Dumêz G. Schwetz (right) in frame
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
    const d = Math.max(7.6, 2.5 / Math.tan(hfov / 2));
    this.camera.position.set(-0.15, 2.4 + (aspect < 1 ? 0.6 : 0), d);
    this.camera.lookAt(-0.15, aspect < 1 ? 1.4 : 1.8, 0);
  }

  redrawCert() {
    drawCertificate(this.certCanvas, { ...this.stats, name: this.name });
    this.certTex.needsUpdate = true;
  }

  burstConfetti() {
    for (const c of this.confetti) {
      c.m.visible = true;
      c.m.position.set(rand(-3, 3), rand(5, 8), rand(-1.5, 2));
      c.v.set(rand(-0.4, 0.4), rand(-1.6, -0.8), rand(-0.3, 0.3));
      c.w.set(rand(-6, 6), rand(-6, 6), rand(-6, 6));
    }
  }

  say(i) {
    this.lineIdx = i;
    document.querySelector('.speech')?.remove();
    const text = h('span');
    const last = i === this.lines.length - 1;
    const btn = h('button.btn' + (last ? '.gold' : '.secondary'), {
      onclick: () => {
        sfx.click();
        if (last) this.showCertificate();
        else this.say(i + 1);
      }
    }, last ? '📜 Zertifikat ansehen' : 'Weiter …');
    mount(h('div.speech.panel', {}, [h('b', {}, SPEAKER), text, h('div.row', {}, btn)]));
    // typewriter
    const full = this.lines[i];
    let n = 0;
    clearInterval(this.typer);
    this.typer = setInterval(() => {
      n += 2;
      text.textContent = full.slice(0, n);
      if (n % 6 === 0) sfx.step();
      if (n >= full.length) clearInterval(this.typer);
    }, 28);
    if (last) { this.phase = 'present'; this.t = 0; sfx.win(); this.burstConfetti(); }
  }

  showCertificate() {
    document.querySelector('.speech')?.remove();
    const preview = document.createElement('canvas');
    const input = h('input', { type: 'text', maxlength: '40', placeholder: 'Dein Name für das Zertifikat', value: this.name });
    const render = () => drawCertificate(preview, { ...this.stats, name: this.name });
    input.addEventListener('input', () => {
      this.name = input.value;
      storeSet('player-name', this.name);
      render();
      this.redrawCert();
    });
    render();
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const download = () => {
      sfx.click();
      // iOS: the share sheet offers "Bild sichern" (save to Photos), downloads are clumsy there
      if (isIOS && navigator.canShare) { share(); return; }
      const a = document.createElement('a');
      a.download = `Schwetz-Zertifikat${this.name ? '-' + this.name.replace(/[^\wäöüÄÖÜß-]+/g, '_') : ''}.png`;
      a.href = preview.toDataURL('image/png');
      a.click();
    };
    const share = async () => {
      sfx.click();
      try {
        const blob = await new Promise((r) => preview.toBlob(r, 'image/png'));
        const file = new File([blob], 'Schwetz-Zertifikat.png', { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Mein Schwetz-Zertifikat', text: `${this.stats.score} Punkte bei „Hau den Legacy!“ in der itmX Spielewelt.` });
        } else {
          const a = document.createElement('a');
          a.download = 'Schwetz-Zertifikat.png';
          a.href = preview.toDataURL('image/png');
          a.click();
        }
      } catch { /* user cancelled */ }
    };
    mount(h('div.overlay', {}, h('div.cert-wrap.panel', {}, [
      preview,
      h('div.name', {}, [input]),
      h('div.row', {}, [
        h('button.btn.gold', { onclick: download }, isIOS ? '⬇ Speichern / Teilen' : '⬇ Als Bild speichern'),
        navigator.share && !isIOS ? h('button.btn.secondary', { onclick: share }, 'Teilen') : null,
        h('button.btn.secondary', { onclick: () => { sfx.click(); this.app.startGame('whack'); } }, '↻ Nochmal spielen'),
        h('button.btn.secondary', { onclick: () => { sfx.click(); this.app.goHub(); } }, 'Zur Spielewelt')
      ])
    ])));
  }

  update(dt, time) {
    const z = this.z;
    this.t += dt;
    // player avatar: idle sway, cheers once the certificate is presented
    if (this.player) {
      const P = this.player;
      const cheer = this.phase === 'present';
      P.body.position.y = cheer ? Math.abs(Math.sin(time * 6)) * 0.12 : Math.sin(time * 2) * 0.01;
      P.arms.forEach((arm, i) => {
        const s = i === 0 ? -1 : 1;
        arm.rotation.z = lerp(arm.rotation.z, cheer ? s * (2.5 + Math.sin(time * 6 + i) * 0.2) : s * 0.05, 0.12);
      });
      P.neck.rotation.y = lerp(P.neck.rotation.y, this.phase === 'walk' ? 0.6 : 0.25, 0.05);
    }
    if (this.phase === 'walk') {
      const k = clamp(this.t / 2.6, 0, 1);
      z.root.position.x = lerp(4.5, 0.95, k);
      z.body.position.y = Math.abs(Math.sin(this.t * 7)) * 0.06;
      z.body.rotation.z = Math.sin(this.t * 7) * 0.05;
      z.armR.shoulder.rotation.x = Math.sin(this.t * 7) * 0.4;
      z.armL.shoulder.rotation.x = -Math.sin(this.t * 7) * 0.4 - 0.2;
      if (Math.sin(this.t * 7) * Math.sin((this.t - dt) * 7) < 0) sfx.step();
      if (k >= 1) { this.phase = 'turn'; this.t = 0; }
    } else if (this.phase === 'turn') {
      const k = clamp(this.t / 0.6, 0, 1);
      z.root.rotation.y = lerp(-Math.PI / 2, -0.3, k);
      z.body.position.y = lerp(z.body.position.y, 0, 0.2);
      z.armR.shoulder.rotation.x = lerp(z.armR.shoulder.rotation.x, 0, 0.2);
      z.armL.shoulder.rotation.x = lerp(z.armL.shoulder.rotation.x, -0.4, 0.2);
      z.armL.elbow.rotation.x = lerp(z.armL.elbow.rotation.x, -1.3, 0.2);
      if (k >= 1) { this.phase = 'talk'; this.t = 0; this.say(0); }
    } else if (this.phase === 'talk') {
      // scratches his head while talking
      z.armR.shoulder.rotation.x = lerp(z.armR.shoulder.rotation.x, -2.6, 0.06);
      z.armR.shoulder.rotation.z = lerp(z.armR.shoulder.rotation.z, -0.5, 0.06);
      z.armR.elbow.rotation.x = -0.9 + Math.sin(time * 14) * 0.25;
    } else if (this.phase === 'present') {
      z.armR.shoulder.rotation.x = lerp(z.armR.shoulder.rotation.x, -1.25, 0.08);
      z.armR.shoulder.rotation.z = lerp(z.armR.shoulder.rotation.z, 0.25, 0.08);
      z.armR.elbow.rotation.x = lerp(z.armR.elbow.rotation.x, -0.25, 0.08);
    }
    // the certificate is only visible once he presents it
    const showPaper = this.phase === 'present';
    this.paper.visible = showPaper;
    if (showPaper) {
      const sx = clamp(this.t / 0.4, 0.01, 1);
      this.paper.scale.setScalar(sx);
      this.paper.position.set(0.05, -0.8, 0.08);
      // counter-rotate so the paper faces the camera whatever the arm does
      this.paper.rotation.set(-(z.armR.shoulder.rotation.x + z.armR.elbow.rotation.x), 0, -0.12);
    }
    // idle life: breathing, head bob, sleepy blink, hair sway, coffee sip
    z.head.rotation.z = Math.sin(time * 1.3) * 0.06;
    z.head.rotation.x = Math.sin(time * 0.9) * 0.04 - 0.05;
    z.hairPivot.rotation.z = Math.sin(time * 1.7) * 0.03;
    z.hairPivot.rotation.x = Math.sin(time * 1.1) * 0.03;
    const blink = (time % 3.4) < 0.15 ? 1.4 : 0.55;
    z.head.userData['lid-1'].rotation.x = blink;
    z.head.userData.lid1.rotation.x = blink;
    for (const f of z.flies) {
      const a = time * f.s + f.o;
      f.f.position.set(Math.cos(a) * f.r + Math.sin(a * 2.3) * 0.1, f.y + Math.sin(a * 3.1) * 0.15, Math.sin(a) * f.r * 0.7);
      f.f.children[1].rotation.y = Math.sin(time * 90) * 0.8;
      f.f.children[2].rotation.y = -Math.sin(time * 90) * 0.8;
    }
    for (const c of this.confetti) {
      if (!c.m.visible) continue;
      c.m.position.addScaledVector(c.v, dt);
      c.m.position.x += Math.sin(time * 3 + c.w.x) * dt * 0.3;
      c.m.rotation.x += c.w.x * dt; c.m.rotation.y += c.w.y * dt;
      if (c.m.position.y < 0.02) { c.m.position.y = 0.02; c.v.set(0, 0, 0); c.w.set(0, 0, 0); }
    }
    this.neon.material.color.setScalar(Math.random() < 0.03 ? 0.4 : 2 + Math.sin(time * 4) * 0.2);
  }
}
