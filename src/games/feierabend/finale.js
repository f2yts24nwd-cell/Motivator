import * as THREE from 'three';
import { canvasTexture, rand, clamp, lerp } from '../../core/gfx.js';
import { sfx, music } from '../../core/audio.js';
import { loadAvatar, buildAvatar, disposeAvatar } from '../../hub/avatar.js';
import { h, mount, clearUI, storeGet, storeSet } from '../../core/ui.js';
import { drawUrkunde } from './urkunde.js';

// Rooftop finale of "Rettet den Feierabend!": Tina X., top saleswoman, walks in and
// hands over the Feierabend-Urkunde to the player's avatar.

const TINA_LOOK = { top: 'kostuem', bottom: 'rock', shoes: 'pumps', acc: 'tuch', suit: 'schwarz', accent: 'gruen', hair: 'lang', hairColor: 'rot', skin: 's3' };
const SPEAKER = 'Tina X. · Top-Verkäuferin';
const RANK_LINES = {
  gold: 'Pünktlich um 17:30 raus und kein Blatt auf dem Stapel? Respekt. Das schaffen hier sonst nur ich und mein CRM.',
  silber: 'Stark. Ein paar Zettel, aber die Extra Meile hast du drauf. Nächstes Mal holst du Gold.',
  bronze: 'Die Low Hanging Fruits hast du mitgenommen. Jetzt noch die Zeitfresser konsequent lassen, dann wird das richtig gut.',
  teilnahme: 'Ehrlich? Dein Schreibtisch sieht aus wie ein Altpapiercontainer. Morgen zeig ich dir, wie man das CRM richtig nutzt.'
};

export class FeierabendFinale {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(38, 1, 0.1, 120);
    this.build();
  }

  build() {
    const s = this.scene;
    s.background = new THREE.Color(0x140a26);
    s.fog = new THREE.Fog(0x140a26, 14, 40);
    s.environment = this.app.gfx.envMap;
    s.environmentIntensity = 0.4;
    s.add(new THREE.HemisphereLight(0xffb0d8, 0x1a0a20, 0.6));
    const spot = new THREE.SpotLight(0xffe6c8, 120, 22, 0.5, 0.6, 1.5);
    spot.position.set(0.5, 8, 5);
    spot.target.position.set(0, 1.2, 0);
    spot.castShadow = true;
    spot.shadow.mapSize.set(1024, 1024);
    spot.shadow.bias = -0.0004;
    s.add(spot, spot.target);
    const pink = new THREE.PointLight(0xff3d9a, 24, 12);
    pink.position.set(-3, 3, -1);
    const cyan = new THREE.PointLight(0x19c3ff, 20, 12);
    cyan.position.set(3.2, 2.6, -1);
    s.add(pink, cyan);

    // rooftop deck
    const deckTex = canvasTexture(512, 512, (g, w, hh) => {
      g.fillStyle = '#1c1830'; g.fillRect(0, 0, w, hh);
      for (let y = 0; y < hh; y += 64) {
        g.fillStyle = `hsl(${rand(250, 270)}, 18%, ${rand(13, 17)}%)`;
        g.fillRect(0, y + 2, w, 60);
      }
    });
    deckTex.wrapS = deckTex.wrapT = THREE.RepeatWrapping;
    deckTex.repeat.set(4, 4);
    const deck = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshPhysicalMaterial({ map: deckTex, roughness: 0.4, clearcoat: 0.6 }));
    deck.rotation.x = -Math.PI / 2;
    deck.receiveShadow = true;
    s.add(deck);
    // glass railing with neon strip
    const glass = new THREE.Mesh(new THREE.BoxGeometry(16, 1.1, 0.05), new THREE.MeshPhysicalMaterial({ color: 0x8fb6ff, transparent: true, opacity: 0.18, roughness: 0.05 }));
    glass.position.set(0, 0.55, -3.2);
    s.add(glass);
    const strip = new THREE.Mesh(new THREE.BoxGeometry(16, 0.05, 0.06), new THREE.MeshBasicMaterial({ color: new THREE.Color(2.4, 0.4, 1.4), toneMapped: false }));
    strip.position.set(0, 1.12, -3.2);
    s.add(strip);

    // evening skyline
    const sky = canvasTexture(2048, 900, (g, w, hh) => {
      const grd = g.createLinearGradient(0, 0, 0, hh);
      grd.addColorStop(0, '#0d0820'); grd.addColorStop(0.55, '#3b1460'); grd.addColorStop(1, '#ff6a6a');
      g.fillStyle = grd; g.fillRect(0, 0, w, hh);
      for (let i = 0; i < 160; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.8})`; g.fillRect(Math.random() * w, Math.random() * hh * 0.45, 2, 2); }
      let x = 0;
      while (x < w) {
        const bw = rand(50, 150), bh = rand(200, 620);
        g.fillStyle = `hsl(${rand(240, 275)}, 35%, ${rand(6, 12)}%)`;
        g.fillRect(x, hh - bh, bw, bh);
        for (let yy = hh - bh + 12; yy < hh - 10; yy += 18) for (let xx = x + 8; xx < x + bw - 8; xx += 14) {
          if (Math.random() < 0.35) { g.fillStyle = Math.random() < 0.75 ? '#ffd27a' : '#7fe3ff'; g.fillRect(xx, yy, 7, 9); }
        }
        x += bw + rand(4, 20);
      }
    });
    const skyMesh = new THREE.Mesh(new THREE.PlaneGeometry(70, 30), new THREE.MeshBasicMaterial({ map: sky, fog: false }));
    skyMesh.position.set(0, 9, -24);
    s.add(skyMesh);

    const neonTex = canvasTexture(1024, 220, (g, w, hh) => {
      g.font = '900 140px system-ui, "Segoe UI", Arial'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#ff3d9a'; g.shadowBlur = 34; g.fillStyle = '#ffd0ea';
      g.fillText('FEIERABEND!', w / 2, hh / 2);
    });
    this.neon = new THREE.Mesh(new THREE.PlaneGeometry(6, 1.3), new THREE.MeshBasicMaterial({ map: neonTex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(2, 2, 2) }));
    this.neon.position.set(0, 4.4, -3.4);
    s.add(this.neon);

    // little stage props: bar table with two drinks
    const tableMat = new THREE.MeshPhysicalMaterial({ color: 0x23203a, metalness: 0.7, roughness: 0.25, clearcoat: 1 });
    const top = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.05, 32), tableMat);
    top.position.set(-3.2, 1.1, -1.2);
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.25, 1.1, 16), tableMat);
    leg.position.set(-3.2, 0.55, -1.2);
    s.add(top, leg);
    for (const dx of [-0.15, 0.15]) {
      const glassM = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.05, 0.22, 16), new THREE.MeshPhysicalMaterial({ color: 0xffc46b, transparent: true, opacity: 0.8, roughness: 0.05, emissive: 0x6b3a00, emissiveIntensity: 0.4 }));
      glassM.position.set(-3.2 + dx, 1.24, -1.2);
      s.add(glassM);
    }

    // Tina X.
    this.tina = buildAvatar(TINA_LOOK);
    this.tina.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    // Tina doesn't carry the default briefcase
    for (const c of [...this.tina.arms[1].children]) if (c.position.y < -0.8) this.tina.arms[1].remove(c);
    s.add(this.tina.root);

    // Urkunde prop in Tina's hand
    this.urkCanvas = document.createElement('canvas');
    drawUrkunde(this.urkCanvas, {});
    this.urkTex = new THREE.CanvasTexture(this.urkCanvas);
    this.urkTex.colorSpace = THREE.SRGBColorSpace;
    this.urkTex.anisotropy = 8;
    this.paper = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.78), new THREE.MeshBasicMaterial({ map: this.urkTex, toneMapped: false, side: THREE.DoubleSide }));
    this.paper.castShadow = true;
    this.tina.arms[0].add(this.paper);

    // confetti
    this.confetti = [];
    const cg = new THREE.PlaneGeometry(0.06, 0.1);
    const cols = [0xffcc4d, 0x19c3ff, 0xff3d9a, 0x3ddc84, 0xffffff];
    for (let i = 0; i < 160; i++) {
      const m = new THREE.Mesh(cg, new THREE.MeshStandardMaterial({ color: cols[i % cols.length], side: THREE.DoubleSide, emissive: cols[i % cols.length], emissiveIntensity: 0.4 }));
      m.visible = false;
      s.add(m);
      this.confetti.push({ m, v: new THREE.Vector3(), w: new THREE.Vector3() });
    }
  }

  enter(stats) {
    this.stats = { score: 0, solved: 0, extraCount: 0, fruits: 0, rank: 'teilnahme', rankName: 'Teilnahme', title: '', line: '', ...(stats || {}) };
    this.name = storeGet('player-name', '');
    this.lines = [
      'Hi, ich bin Tina X. Top-Verkäuferin, vierzehn Quartale in Folge über Plan. Ich hab dir den ganzen Tag zugeschaut.',
      RANK_LINES[this.stats.rank] || RANK_LINES.teilnahme,
      `Hier ist deine Feierabend-Urkunde, Stufe ${this.stats.rankName}. Und jetzt: ab in den Feierabend!`
    ];
    if (this.player) { this.scene.remove(this.player.root); disposeAvatar(this.player); }
    this.player = buildAvatar(loadAvatar());
    this.player.root.position.set(-1.35, 0, 0.6);
    this.player.root.rotation.y = 0.5;
    this.player.root.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    this.scene.add(this.player.root);
    this.tina.root.position.set(5, 0, 0.3);
    this.tina.root.rotation.y = -Math.PI / 2;
    this.redraw();
    this.t = 0;
    this.phase = 'walk';
    music.play('techno');
    music.setIntensity(1);
    this.resize(window.innerWidth, window.innerHeight);
    clearUI();
    mount(h('button.icon-btn.left', { title: 'Zurück zur Spielewelt', onclick: () => { sfx.click(); this.app.goHub(); } }, '⟵'));
    for (const c of this.confetti) c.m.visible = false;
  }

  exit() { clearUI(); clearInterval(this.typer); }

  resize(w, hgt) {
    const aspect = w / hgt;
    this.camera.aspect = aspect;
    this.camera.updateProjectionMatrix();
    const hfov = 2 * Math.atan(Math.tan(THREE.MathUtils.degToRad(this.camera.fov / 2)) * aspect);
    const d = Math.max(7.6, 2.6 / Math.tan(hfov / 2));
    this.camera.position.set(-0.15, 2.4 + (aspect < 1 ? 0.6 : 0), d);
    this.camera.lookAt(-0.15, aspect < 1 ? 1.4 : 1.8, 0);
  }

  redraw() {
    drawUrkunde(this.urkCanvas, { ...this.stats, name: this.name });
    this.urkTex.needsUpdate = true;
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
    document.querySelector('.speech')?.remove();
    const text = h('span');
    const last = i === this.lines.length - 1;
    const btn = h('button.btn' + (last ? '.gold' : '.secondary'), {
      onclick: () => { sfx.click(); if (last) this.showUrkunde(); else this.say(i + 1); }
    }, last ? '📜 Urkunde ansehen' : 'Weiter …');
    mount(h('div.speech.panel.fb-tina', {}, [h('b', {}, SPEAKER), text, h('div.row', {}, btn)]));
    const full = this.lines[i];
    let n = 0;
    clearInterval(this.typer);
    this.typer = setInterval(() => {
      n += 2;
      text.textContent = full.slice(0, n);
      if (n % 6 === 0) sfx.step();
      if (n >= full.length) clearInterval(this.typer);
    }, 26);
    if (last) { this.phase = 'present'; this.t = 0; sfx.win(); music.setIntensity(3); this.burstConfetti(); }
  }

  showUrkunde() {
    document.querySelector('.speech')?.remove();
    const preview = document.createElement('canvas');
    const input = h('input', { type: 'text', maxlength: '40', placeholder: 'Dein Name für die Urkunde', value: this.name });
    const render = () => drawUrkunde(preview, { ...this.stats, name: this.name });
    input.addEventListener('input', () => {
      this.name = input.value;
      storeSet('player-name', this.name);
      render();
      this.redraw();
    });
    render();
    const isIOS = /iPhone|iPad|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const fileName = `Feierabend-Urkunde${this.name ? '-' + this.name.replace(/[^\wäöüÄÖÜß-]+/g, '_') : ''}.png`;
    const download = () => {
      const a = document.createElement('a');
      a.download = fileName;
      a.href = preview.toDataURL('image/png');
      a.click();
    };
    const share = async () => {
      sfx.click();
      try {
        const blob = await new Promise((r) => preview.toBlob(r, 'image/png'));
        const file = new File([blob], fileName, { type: 'image/png' });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: 'Meine Feierabend-Urkunde', text: `${this.stats.score} Minuten gespart bei „Rettet den Feierabend!“ in der itmX Spielewelt.` });
        } else download();
      } catch { /* user cancelled */ }
    };
    mount(h('div.overlay', {}, h('div.cert-wrap.panel', {}, [
      preview,
      h('div.name', {}, [input]),
      h('div.row', {}, [
        h('button.btn.gold', { onclick: () => { sfx.click(); if (isIOS && navigator.canShare) share(); else download(); } }, isIOS ? '⬇ Speichern / Teilen' : '⬇ Als Bild speichern'),
        navigator.share && !isIOS ? h('button.btn.secondary', { onclick: share }, 'Teilen') : null,
        h('button.btn.secondary', { onclick: () => { sfx.click(); this.app.startGame('feierabend'); } }, '↻ Neuer Arbeitstag'),
        h('button.btn.secondary', { onclick: () => { sfx.click(); this.app.goHub(); } }, 'Zur Spielewelt')
      ])
    ])));
  }

  update(dt, time) {
    this.t += dt;
    const T = this.tina;
    const [armL, armR] = T.arms;
    // player: idle, cheers when the Urkunde is handed over
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
      // confident catwalk entrance
      const k = clamp(this.t / 2.2, 0, 1);
      T.root.position.x = lerp(5, 1.0, 1 - Math.pow(1 - k, 2));
      T.body.position.y = Math.abs(Math.sin(this.t * 7)) * 0.05;
      T.legs.forEach((l, i) => { l.rotation.x = Math.sin(this.t * 7 + i * Math.PI) * 0.45 * (1 - k * 0.6); });
      armL.rotation.x = -Math.sin(this.t * 7) * 0.3;
      armR.rotation.x = Math.sin(this.t * 7) * 0.3;
      if (k >= 1) { this.phase = 'talk'; this.t = 0; this.say(0); }
    } else {
      T.root.rotation.y = lerp(T.root.rotation.y, -0.35, 0.08);
      T.body.position.y = lerp(T.body.position.y, 0, 0.2);
      T.legs.forEach((l) => { l.rotation.x = lerp(l.rotation.x, 0, 0.2); });
      // hand on the hip, weight on one leg
      armR.rotation.z = lerp(armR.rotation.z, 0.32, 0.08);
      armR.rotation.x = lerp(armR.rotation.x, 0.1, 0.08);
      T.body.rotation.z = Math.sin(time * 1.2) * 0.02;
      if (this.phase === 'present') {
        armL.rotation.x = lerp(armL.rotation.x, -1.35, 0.08);
        armL.rotation.z = lerp(armL.rotation.z, 0.25, 0.08);
      } else {
        // gesturing while talking
        armL.rotation.x = lerp(armL.rotation.x, -0.4 + Math.sin(time * 4) * 0.25, 0.1);
        armL.rotation.z = lerp(armL.rotation.z, -0.15, 0.1);
      }
      T.neck.rotation.y = Math.sin(time * 1.5) * 0.12;
    }
    // Urkunde: hidden until the hand-over, then held towards the player
    const show = this.phase === 'present';
    this.paper.visible = show;
    if (show) {
      this.paper.scale.setScalar(clamp(this.t / 0.4, 0.01, 1));
      this.paper.position.set(0, -0.85, 0.12);
      this.paper.rotation.set(-armL.rotation.x, -armL.rotation.z * 0.5, 0);
    }
    for (const c of this.confetti) {
      if (!c.m.visible) continue;
      c.m.position.addScaledVector(c.v, dt);
      c.m.position.x += Math.sin(time * 3 + c.w.x) * dt * 0.3;
      c.m.rotation.x += c.w.x * dt; c.m.rotation.y += c.w.y * dt;
      if (c.m.position.y < 0.02) { c.m.position.y = 0.02; c.v.set(0, 0, 0); c.w.set(0, 0, 0); }
    }
    this.neon.material.color.setScalar(Math.random() < 0.02 ? 0.5 : 2 + Math.sin(time * 4) * 0.2);
  }
}
