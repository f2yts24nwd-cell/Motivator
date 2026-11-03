import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, rand, clamp, lerp, drawBrand, roundRect } from '../core/gfx.js';
import { sfx, music, unlockAudio, isMuted, setMuted } from '../core/audio.js';
import { h, mount, clearUI, storeGet, storeSet } from '../core/ui.js';
import { WARDROBE, loadAvatar, saveAvatar, buildAvatar, disposeAvatar } from './avatar.js';
import { GAMES } from '../games/registry.js';
import { buildJukebox, JukeboxPlayer } from './jukebox.js';

const ROOM_W = 26, ROOM_D = 18;

// The walkable 3D sales office: every game is an arcade cabinet.
export class Hub {
  constructor(app) {
    this.app = app;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200);
    this.raycaster = new THREE.Raycaster();
    this.keys = new Set();
    this.obstacles = [];
    this.cabinets = [];
    this.build();
    this.onDown = this.onDown.bind(this);
    this.onKeyDown = (e) => {
      this.keys.add(e.key.toLowerCase());
      if (e.key === 'Enter' && this.nearJuke) this.openJuke();
      else if (e.key === 'Enter' && this.near?.game.available) this.launch(this.near.game);
    };
    this.onKeyUp = (e) => this.keys.delete(e.key.toLowerCase());
  }

  build() {
    const s = this.scene;
    s.background = new THREE.Color(0x0a0d18);
    s.fog = new THREE.Fog(0x0a0d18, 22, 48);
    s.environment = this.app.gfx.envMap;
    s.environmentIntensity = 0.45;
    s.add(new THREE.HemisphereLight(0xbfd4ff, 0x302030, 0.7));
    const sun = new THREE.DirectionalLight(0xffe6c8, 2.2);
    sun.position.set(8, 16, 10);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -16, right: 16, top: 12, bottom: -12, near: 1, far: 50 });
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.03;
    s.add(sun);

    // floor: warm wood planks
    const wood = canvasTexture(1024, 1024, (g, w, hh) => {
      for (let y = 0; y < hh; y += 64) {
        let x = -rand(0, 200);
        while (x < w) {
          const len = rand(220, 420);
          const l = rand(28, 38);
          g.fillStyle = `hsl(28, 35%, ${l}%)`;
          g.fillRect(x, y, len, 64);
          for (let k = 0; k < 14; k++) {
            g.strokeStyle = `rgba(60,30,10,${rand(0.05, 0.18)})`;
            g.lineWidth = rand(1, 3);
            g.beginPath(); const yy = y + rand(4, 60); g.moveTo(x, yy); g.bezierCurveTo(x + len * 0.3, yy + rand(-6, 6), x + len * 0.6, yy + rand(-6, 6), x + len, yy); g.stroke();
          }
          g.fillStyle = 'rgba(0,0,0,0.35)';
          g.fillRect(x, y, 3, 64);
          x += len;
        }
        g.fillStyle = 'rgba(0,0,0,0.4)';
        g.fillRect(0, y, w, 2);
      }
    });
    wood.wrapS = wood.wrapT = THREE.RepeatWrapping;
    wood.repeat.set(4, 3);
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(ROOM_W, ROOM_D), new THREE.MeshPhysicalMaterial({ map: wood, roughness: 0.45, clearcoat: 0.6, clearcoatRoughness: 0.2 }));
    floor.rotation.x = -Math.PI / 2;
    floor.receiveShadow = true;
    s.add(floor);
    this.floor = floor;
    // dark surround so steep phone cameras never look into the void
    const outside = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), new THREE.MeshStandardMaterial({ color: 0x10131d, roughness: 1 }));
    outside.rotation.x = -Math.PI / 2;
    outside.position.y = -0.02;
    s.add(outside);

    // rug in the middle
    const rug = new THREE.Mesh(new THREE.CircleGeometry(4, 64), new THREE.MeshStandardMaterial({
      map: canvasTexture(512, 512, (g, w, hh) => {
        g.fillStyle = '#1b2a4a'; g.beginPath(); g.arc(w / 2, hh / 2, w / 2, 0, Math.PI * 2); g.fill();
        g.strokeStyle = '#19c3ff'; g.lineWidth = 10;
        g.beginPath(); g.arc(w / 2, hh / 2, w / 2 - 30, 0, Math.PI * 2); g.stroke();
        g.globalAlpha = 0.35;
        drawBrand(g, w * 0.15, hh * 0.37, w * 0.7, hh * 0.26, { wordmark: true });
        g.globalAlpha = 1;
      }), roughness: 1
    }));
    rug.rotation.x = -Math.PI / 2;
    rug.position.set(0, 0.01, 1.5);
    rug.receiveShadow = true;
    s.add(rug);

    // walls
    const wallMat = new THREE.MeshStandardMaterial({ color: 0x1e2436, roughness: 0.9 });
    const back = new THREE.Mesh(new THREE.BoxGeometry(ROOM_W, 8, 0.4), wallMat);
    back.position.set(0, 4, -ROOM_D / 2);
    back.receiveShadow = true;
    const left = new THREE.Mesh(new THREE.BoxGeometry(0.4, 8, ROOM_D), wallMat);
    left.position.set(-ROOM_W / 2, 4, 0);
    left.receiveShadow = true;
    const right = left.clone();
    right.position.x = ROOM_W / 2;
    s.add(back, left, right);

    // windows on the right wall (city at dusk)
    const sky = canvasTexture(1024, 512, (g, w, hh) => {
      const grd = g.createLinearGradient(0, 0, 0, hh);
      grd.addColorStop(0, '#1a1f4a'); grd.addColorStop(0.55, '#c85a8a'); grd.addColorStop(1, '#ffb36b');
      g.fillStyle = grd; g.fillRect(0, 0, w, hh);
      let x = 0;
      while (x < w) {
        const bw = rand(30, 90), bh = rand(80, 320);
        g.fillStyle = `hsl(250, 30%, ${rand(10, 18)}%)`;
        g.fillRect(x, hh - bh, bw, bh);
        for (let yy = hh - bh + 8; yy < hh; yy += 14) for (let xx = x + 5; xx < x + bw - 5; xx += 10) if (Math.random() < 0.3) { g.fillStyle = '#ffd98a'; g.fillRect(xx, yy, 5, 7); }
        x += bw + rand(2, 10);
      }
    });
    for (const z of [-4.5, 1.5]) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.6), new THREE.MeshBasicMaterial({ map: sky, color: new THREE.Color(1.4, 1.4, 1.4) }));
      win.position.set(ROOM_W / 2 - 0.21, 3.4, z);
      win.rotation.y = -Math.PI / 2;
      s.add(win);
      const frameMat = new THREE.MeshStandardMaterial({ color: 0x0b0e18, metalness: 0.6, roughness: 0.4 });
      for (const [dy, dz, sy, sz] of [[1.85, 0, 0.12, 5.2], [-1.85, 0, 0.12, 5.2], [0, 2.55, 3.8, 0.12], [0, -2.55, 3.8, 0.12], [0, 0, 3.6, 0.08]]) {
        const bar = new THREE.Mesh(new THREE.BoxGeometry(0.12, sy, sz), frameMat);
        bar.position.set(ROOM_W / 2 - 0.2, 3.4 + dy, z + dz);
        s.add(bar);
      }
    }

    // neon sign over the cabinets
    const signTex = canvasTexture(1400, 300, (g, w, hh) => {
      g.textAlign = 'center'; g.textBaseline = 'middle';
      g.shadowColor = '#19c3ff'; g.shadowBlur = 28;
      g.fillStyle = '#c9f4ff';
      g.font = '900 118px "Segoe UI", Arial';
      g.fillText('SPIELEWELT', 1020, hh / 2);
      g.shadowColor = '#50af30';
      drawBrand(g, 20, 60, 560, 180, { wordmark: true });
    });
    const sign = new THREE.Mesh(new THREE.PlaneGeometry(11, 2.36), new THREE.MeshBasicMaterial({ map: signTex, transparent: true, color: new THREE.Color(2, 2, 2), toneMapped: false, depthWrite: false }));
    sign.position.set(0, 5.4, -ROOM_D / 2 + 0.25);
    s.add(sign);
    this.sign = sign;

    // ceiling light panels (emissive) + a few point lights for warm pools
    for (const x of [-7, 0, 7]) for (const z of [-4, 3]) {
      const pl = new THREE.PointLight(0xffe2c0, 8, 12, 1.8);
      pl.position.set(x, 6.5, z);
      s.add(pl);
    }

    // arcade cabinets
    const n = GAMES.length;
    GAMES.forEach((game, i) => {
      const x = (i - (n - 1) / 2) * 4.2;
      const cab = this.buildCabinet(game);
      cab.group.position.set(x, 0, -ROOM_D / 2 + 1.3);
      s.add(cab.group);
      this.cabinets.push({ ...cab, game, pos: new THREE.Vector3(x, 0, -ROOM_D / 2 + 1.3), front: new THREE.Vector3(x, 0, -ROOM_D / 2 + 3.4) });
      this.obstacles.push({ x, z: -ROOM_D / 2 + 1.3, r: 1.3 });
    });

    // office furniture
    const deskSpots = [[-9, 2.5, 0], [-9, -2, 0], [9, 4.8, Math.PI], [-4.5, 6.2, Math.PI / 2], [4.5, 6.2, -Math.PI / 2]];
    for (const [x, z, r] of deskSpots) this.addDesk(x, z, r);
    for (const [x, z] of [[-12, -8], [12, -8], [-12, 8], [12, 8], [-11.8, 0.3]]) this.addPlant(x, z);
    this.addWhiteboard();
    this.addCoffee(11.6, -1.6);
    this.addJukebox(12.0, 2.6);

    this.player = this.buildPlayer();
    this.avatar = loadAvatar();
    this.applyAvatar(this.avatar);
    s.add(this.player.root);
    this.hand = this.buildSlapHand();
    this.mode = 'walk';
    this.shake = 0;
    this.player.root.position.set(0, 0, 4);
    this.walkTarget = null;

    // click marker
    this.marker = new THREE.Mesh(new THREE.RingGeometry(0.3, 0.42, 40), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.3, 1.8, 2.6), transparent: true, toneMapped: false, depthWrite: false }));
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = 0.02;
    this.marker.visible = false;
    s.add(this.marker);
  }

  buildCabinet(game) {
    const g = new THREE.Group();
    const col = new THREE.Color(game.color);
    const bodyMat = new THREE.MeshPhysicalMaterial({ color: game.available ? 0x151a2c : 0x1a1d26, roughness: 0.35, clearcoat: 1, metalness: 0.2 });
    const body = new THREE.Mesh(new RoundedBoxGeometry(2.2, 3.8, 1.6, 4, 0.08), bodyMat);
    body.position.y = 1.9;
    body.castShadow = true;
    body.receiveShadow = true;
    g.add(body);
    // side stripes
    const stripeMat = new THREE.MeshBasicMaterial({ color: col.clone().multiplyScalar(game.available ? 2.2 : 0.6), toneMapped: false });
    for (const sx of [-1.105, 1.105]) {
      const st = new THREE.Mesh(new THREE.BoxGeometry(0.02, 3.4, 0.08), stripeMat);
      st.position.set(sx, 1.9, 0.6);
      g.add(st);
    }
    // marquee
    const marqueeTex = canvasTexture(768, 192, (c, w, hh) => {
      const grd = c.createLinearGradient(0, 0, w, 0);
      grd.addColorStop(0, '#0b0f1a'); grd.addColorStop(0.5, game.available ? '#16233f' : '#14161d'); grd.addColorStop(1, '#0b0f1a');
      c.fillStyle = grd; c.fillRect(0, 0, w, hh);
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.shadowColor = game.color; c.shadowBlur = 24;
      c.fillStyle = game.available ? '#ffffff' : '#8a90a0';
      const label = game.available ? game.title.toUpperCase() : 'COMING SOON';
      let px = game.title.length > 14 ? 78 : 92;
      c.font = `900 ${px}px "Segoe UI", Arial`;
      while (c.measureText(label).width > w - 40 && px > 30) c.font = `900 ${--px}px "Segoe UI", Arial`;
      c.fillText(label, w / 2, hh / 2);
    });
    const marquee = new THREE.Mesh(new THREE.PlaneGeometry(2.0, 0.5), new THREE.MeshBasicMaterial({ map: marqueeTex, color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false }));
    marquee.position.set(0, 3.45, 0.81);
    g.add(marquee);
    // screen (animated canvas)
    const screenCanvas = document.createElement('canvas');
    screenCanvas.width = 384; screenCanvas.height = 300;
    const screenTex = new THREE.CanvasTexture(screenCanvas);
    screenTex.colorSpace = THREE.SRGBColorSpace;
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 1.33), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) }));
    screen.position.set(0, 2.45, 0.815);
    screen.rotation.x = -0.12;
    g.add(screen);
    // control deck
    const deck = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.25, 0.8), bodyMat);
    deck.position.set(0, 1.45, 1.0);
    deck.rotation.x = 0.25;
    deck.castShadow = true;
    g.add(deck);
    const btnCols = [0xff3b5c, 0xffcc4d, 0x19c3ff, 0x3ddc84];
    btnCols.forEach((c, i) => {
      const b = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.06, 20), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: game.available ? 0.8 : 0.1 }));
      b.position.set(0.1 + i * 0.22, 1.6, 1.05);
      b.rotation.x = 0.25;
      g.add(b);
    });
    const stick = new THREE.Mesh(new THREE.SphereGeometry(0.1, 16, 12), new THREE.MeshStandardMaterial({ color: 0xff3b5c }));
    stick.position.set(-0.6, 1.8, 1.0);
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.25), new THREE.MeshStandardMaterial({ color: 0x222222 }));
    rod.position.set(-0.6, 1.68, 1.0);
    g.add(stick, rod);
    // glow on floor
    const glow = new THREE.Mesh(new THREE.CircleGeometry(1.6, 40), new THREE.MeshBasicMaterial({
      map: canvasTexture(128, 128, (c, w, hh) => { const gr = c.createRadialGradient(w / 2, hh / 2, 0, w / 2, hh / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, hh); }),
      color: col, transparent: true, opacity: game.available ? 0.55 : 0.15, depthWrite: false, blending: THREE.AdditiveBlending
    }));
    glow.rotation.x = -Math.PI / 2;
    glow.position.set(0, 0.015, 1.6);
    g.add(glow);
    const light = new THREE.PointLight(col, game.available ? 10 : 2, 6, 2);
    light.position.set(0, 2.4, 1.6);
    g.add(light);
    // clickable proxy
    body.userData.cabinet = game.id;
    screen.userData.cabinet = game.id;
    marquee.userData.cabinet = game.id;
    return { group: g, screenCanvas, screenTex, glow, light, pickables: [body, screen, marquee, deck] };
  }

  drawScreen(cab, time) {
    const c = cab.screenCanvas.getContext('2d', { willReadFrequently: true });
    const w = cab.screenCanvas.width, hh = cab.screenCanvas.height;
    c.fillStyle = '#05070f';
    c.fillRect(0, 0, w, hh);
    if (cab.game.id === 'whack') {
      // mini attract-mode: 3x3 holes with popping icons and a hammer
      const items = [['#1d6f42', 'X'], ['#0a53b8', 'SAP'], ['#a4373a', 'A'], ['#0a63c9', 'e'], ['#00a1e0', '☁']];
      for (let i = 0; i < 9; i++) {
        const x = 70 + (i % 3) * 122, y = 70 + Math.floor(i / 3) * 85;
        c.fillStyle = '#111729';
        c.beginPath(); c.ellipse(x, y + 22, 42, 12, 0, 0, Math.PI * 2); c.fill();
        const ph = Math.sin(time * 2.2 + i * 1.7);
        if (ph > 0.2) {
          const up = Math.min(1, (ph - 0.2) * 3);
          const [col, txt] = items[i % items.length];
          const friendly = i === 4;
          if (friendly) drawBrand(c, x - 28, y + 18 - 54 * up, 56, 54 * up);
          else {
            c.fillStyle = col;
            roundRect(c, x - 30, y + 18 - 52 * up, 60, 50 * up, 8);
            c.fill();
          }
          if (up > 0.8) {
            c.fillStyle = '#fff';
            c.font = '900 24px "Segoe UI", Arial';
            c.textAlign = 'center'; c.textBaseline = 'middle';
            if (!friendly) c.fillText(txt, x, y - 8);
          }
        }
      }
      const hx = 70 + ((Math.floor(time * 1.3) * 5) % 3) * 122;
      const hy = 30 + ((Math.floor(time * 1.3) * 7) % 3) * 85;
      const sw = (time * 1.3) % 1;
      c.save();
      c.translate(hx + 40, hy + 10);
      c.rotate(-0.9 + (sw < 0.15 ? sw / 0.15 * 0.9 : 0.9 - Math.min(1, (sw - 0.15) * 3) * 0.9));
      c.fillStyle = '#8a5a33'; c.fillRect(-4, 0, 8, 70);
      c.fillStyle = '#ff2d55'; roundRect(c, -28, -18, 56, 24, 8); c.fill();
      c.restore();
      c.fillStyle = Math.sin(time * 6) > 0 ? '#ffcc4d' : '#ffffff';
      c.font = '900 22px "Segoe UI", Arial';
      c.textAlign = 'center';
      c.fillText('PRESS START', w / 2, hh - 18);
    } else if (cab.game.id === 'feierabend') {
      // attract mode: task cards rushing down three neon lanes, clock ticking towards 17:30
      c.strokeStyle = 'rgba(255,61,154,0.55)'; c.lineWidth = 2;
      for (const lx of [-1, 0, 1, 2]) { c.beginPath(); c.moveTo(w / 2 + (lx - 0.5) * 30, 40); c.lineTo(w / 2 + (lx - 0.5) * 150, hh); c.stroke(); }
      const cols = ['#0f6cbd', '#5b5fc7', '#19c3ff', '#50af30', '#ffb000', '#ff3d9a'];
      for (let i = 0; i < 5; i++) {
        const k = ((time * 0.45 + i * 0.37) % 1);
        const lane = (i * 2) % 3 - 1;
        const sc = 0.25 + k * 0.85;
        const x = w / 2 + lane * (30 + k * 110), y = 45 + k * (hh - 110);
        c.fillStyle = cols[i % cols.length];
        roundRect(c, x - 44 * sc, y - 22 * sc, 88 * sc, 44 * sc, 8 * sc); c.fill();
        c.fillStyle = 'rgba(255,255,255,0.85)';
        c.fillRect(x - 30 * sc, y - 6 * sc, 60 * sc, 5 * sc);
        c.fillRect(x - 30 * sc, y + 4 * sc, 40 * sc, 5 * sc);
      }
      const mins = 9 * 60 + Math.floor(((time * 40) % 510));
      c.fillStyle = '#ffffff';
      c.font = '900 34px "Segoe UI", Arial';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText(`${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`, w / 2, 24);
      c.fillStyle = Math.sin(time * 6) > 0 ? '#ffcc4d' : '#ffffff';
      c.font = '900 22px "Segoe UI", Arial';
      c.fillText('PRESS START', w / 2, hh - 18);
    } else if (cab.game.id === 'conversion') {
      // attract mode: numbered transport crates on a conveyor, RC 0 beams, downtime clock
      c.fillStyle = '#1a2032';
      c.beginPath(); c.moveTo(w / 2 - 40, 50); c.lineTo(w / 2 + 40, 50); c.lineTo(w / 2 + 170, hh); c.lineTo(w / 2 - 170, hh); c.fill();
      c.strokeStyle = '#ffb000'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(w / 2 - 40, 50); c.lineTo(w / 2 - 170, hh); c.moveTo(w / 2 + 40, 50); c.lineTo(w / 2 + 170, hh); c.stroke();
      const cols = ['#19c3ff', '#ffb000', '#ff3b5c', '#a46bff', '#50af30', '#ff7ac0'];
      for (let i = 0; i < 4; i++) {
        const k = ((time * 0.35 + i * 0.25) % 1);
        const lane = (i * 2) % 3 - 1;
        const sc = 0.3 + k * 0.8;
        const x = w / 2 + lane * (14 + k * 70), y = 55 + k * (hh - 115);
        const n = (Math.floor(time * 0.35 + i * 0.25) + i) % 6;
        c.fillStyle = cols[n];
        roundRect(c, x - 40 * sc, y - 22 * sc, 80 * sc, 44 * sc, 6 * sc); c.fill();
        c.fillStyle = '#05070d';
        c.font = `900 ${Math.round(30 * sc)}px "Segoe UI", Arial`;
        c.textAlign = 'center'; c.textBaseline = 'middle';
        c.fillText(String(n + 1), x, y + 2 * sc);
        if (k > 0.55 && k < 0.7 && i % 2 === 0) {
          c.fillStyle = 'rgba(61,220,132,0.35)';
          c.fillRect(x - 30 * sc, 0, 60 * sc, y);
          c.fillStyle = '#3ddc84';
          c.font = '900 22px "Segoe UI", Arial';
          c.fillText('RC 0', x, y - 40 * sc);
        }
      }
      c.fillStyle = '#ffe2a0';
      c.font = '900 30px ui-monospace, Menlo, monospace';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      const m = 18 * 60 + Math.floor((time * 60) % 2160);
      c.fillText(`${['Sa', 'So', 'Mo'][Math.floor(m / 1440)]} ${String(Math.floor((m % 1440) / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`, w / 2, 24);
      c.fillStyle = Math.sin(time * 6) > 0 ? '#ffcc4d' : '#ffffff';
      c.font = '900 22px "Segoe UI", Arial';
      c.fillText('PRESS START', w / 2, hh - 18);
    } else if (cab.game.id === 'koenigreich') {
      // attract mode: floating block island, four towers grow block by block, day turns to night
      const cyc = (time * 0.12) % 1;
      const night = cyc > 0.6 ? Math.min(1, (cyc - 0.6) / 0.1) * (cyc > 0.9 ? Math.max(0, (1 - cyc) / 0.1) : 1) : 0;
      const sky = c.createLinearGradient(0, 0, 0, hh);
      sky.addColorStop(0, night > 0.5 ? '#070b22' : '#2f6fd6');
      sky.addColorStop(1, night > 0.5 ? '#1c1440' : '#9fd0ff');
      c.fillStyle = sky; c.fillRect(0, 0, w, hh);
      if (night > 0.5) { c.fillStyle = '#ffffff'; for (let i = 0; i < 30; i++) c.fillRect((i * 97) % w, (i * 53) % 120, 2, 2); }
      const B = 18, ox = w / 2, oy = 200;
      // island: grass top, dirt, tapering underside
      for (let row = 0; row < 5; row++) {
        const n = 13 - row * 3;
        for (let i = 0; i < n; i++) {
          c.fillStyle = row === 0 ? (i % 2 ? '#5fae3c' : '#6cc04a') : row < 2 ? '#8a5a36' : '#6b7280';
          c.fillRect(ox - (n * B) / 2 + i * B, oy + row * B, B - 1, B - 1);
        }
      }
      // keep
      c.fillStyle = '#a7aeb8'; c.fillRect(ox - B, oy - B * 3, B * 2, B * 3);
      c.fillStyle = '#50af30'; c.fillRect(ox - 5, oy - B * 3 - 16, 14, 10);
      // towers grow over time
      const cols = ['#ff5fa8', '#19c3ff', '#ffb000', '#a46bff'];
      const grow = Math.floor((time * 1.6) % 24);
      [-4, -2.5, 2.5, 4].forEach((tx, i) => {
        const hgt = Math.max(0, Math.min(5, grow - i * 1.5));
        c.fillStyle = '#2f6fd6'; c.fillRect(ox + tx * B - B / 2, oy - B, B - 1, B - 1);
        for (let k = 0; k < Math.floor(hgt); k++) { c.fillStyle = cols[i]; c.fillRect(ox + tx * B - B / 2, oy - B * (k + 2), B - 1, B - 1); }
      });
      // crown
      c.fillStyle = '#ffcc33';
      const cy = 46 + Math.sin(time * 3) * 4;
      c.beginPath(); c.moveTo(ox - 26, cy + 16); c.lineTo(ox - 26, cy - 6); c.lineTo(ox - 13, cy + 6); c.lineTo(ox, cy - 12); c.lineTo(ox + 13, cy + 6); c.lineTo(ox + 26, cy - 6); c.lineTo(ox + 26, cy + 16); c.fill();
      if (night > 0.5) {
        // a little excel zombie marches in
        const zx = w - ((time * 40) % (w / 2));
        c.fillStyle = '#2f9e5a'; c.fillRect(zx, oy - 30, 14, 30);
        c.fillStyle = '#ff3b2a'; c.fillRect(zx + 3, oy - 25, 3, 3); c.fillRect(zx + 9, oy - 25, 3, 3);
      }
      c.fillStyle = Math.sin(time * 6) > 0 ? '#ffcc4d' : '#ffffff';
      c.font = '900 22px "Segoe UI", Arial';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('PRESS START', w / 2, hh - 18);
    } else {
      // static noise + question mark
      const img = c.getImageData(0, 0, w, hh);
      for (let i = 0; i < img.data.length; i += 4) { const v = Math.random() * 40; img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255; }
      c.putImageData(img, 0, 0);
      c.fillStyle = cab.game.color;
      c.font = '900 150px "Segoe UI", Arial';
      c.textAlign = 'center'; c.textBaseline = 'middle';
      c.globalAlpha = 0.6 + Math.sin(time * 3) * 0.2;
      c.fillText('?', w / 2, hh / 2);
      c.globalAlpha = 1;
    }
    // scanlines
    c.fillStyle = 'rgba(0,0,0,0.25)';
    for (let y = 0; y < hh; y += 4) c.fillRect(0, y, w, 2);
    cab.screenTex.needsUpdate = true;
  }

  addDesk(x, z, rot) {
    const g = new THREE.Group();
    const top = new THREE.Mesh(new RoundedBoxGeometry(3, 0.12, 1.4, 2, 0.04), new THREE.MeshPhysicalMaterial({ color: 0x9c9384, roughness: 0.55, clearcoat: 0.3 }));
    top.position.y = 1.15;
    top.castShadow = true; top.receiveShadow = true;
    g.add(top);
    const legMat = new THREE.MeshStandardMaterial({ color: 0x2a2f3a, metalness: 0.8, roughness: 0.3 });
    for (const sx of [-1.35, 1.35]) {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.1, 1.2), legMat);
      leg.position.set(sx, 0.55, 0);
      leg.castShadow = true;
      g.add(leg);
    }
    const mon = new THREE.Mesh(new THREE.BoxGeometry(1.3, 0.8, 0.06), new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.4 }));
    mon.position.set(0, 1.85, -0.35);
    mon.castShadow = true;
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.7), new THREE.MeshBasicMaterial({
      map: canvasTexture(256, 150, (c, w, hh) => {
        c.fillStyle = '#0e1a30'; c.fillRect(0, 0, w, hh);
        c.fillStyle = '#19c3ff'; c.font = '700 16px Arial'; c.fillText('Pipeline Q4', 12, 22);
        for (let i = 0; i < 7; i++) { const bh = rand(20, 100); c.fillStyle = i % 2 ? '#3ddc84' : '#19c3ff'; c.fillRect(16 + i * 33, hh - 12 - bh, 22, bh); }
      }), toneMapped: false, color: new THREE.Color(1.2, 1.2, 1.2)
    }));
    scr.position.set(0, 1.85, -0.315);
    const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.12, 0.45), legMat);
    stand.position.set(0, 1.4, -0.38);
    g.add(mon, scr, stand);
    // chair
    const chairMat = new THREE.MeshStandardMaterial({ color: 0x23293a, roughness: 0.7 });
    const seat = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.14, 0.8, 2, 0.05), chairMat);
    seat.position.set(0.2, 0.75, 0.95);
    const backrest = new THREE.Mesh(new RoundedBoxGeometry(0.8, 0.9, 0.12, 2, 0.05), chairMat);
    backrest.position.set(0.2, 1.25, 1.35);
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.7), legMat);
    post.position.set(0.2, 0.38, 0.95);
    seat.castShadow = backrest.castShadow = true;
    g.add(seat, backrest, post);
    // mug + papers
    const mug = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.07, 0.18, 16), new THREE.MeshStandardMaterial({ color: 0x19c3ff }));
    mug.position.set(1.0, 1.3, 0.2);
    const papers = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.06, 0.65), new THREE.MeshStandardMaterial({ color: 0xffffff }));
    papers.position.set(-0.9, 1.24, 0.15);
    papers.rotation.y = 0.2;
    g.add(mug, papers);
    g.position.set(x, 0, z);
    g.rotation.y = rot;
    this.scene.add(g);
    this.obstacles.push({ x, z, r: 1.7 });
  }

  addPlant(x, z) {
    const g = new THREE.Group();
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.35, 0.8, 24), new THREE.MeshPhysicalMaterial({ color: 0xf0ebe0, roughness: 0.3, clearcoat: 1 }));
    pot.position.y = 0.4;
    pot.castShadow = true;
    g.add(pot);
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x2f8f4e, roughness: 0.6, side: THREE.DoubleSide });
    for (let i = 0; i < 14; i++) {
      const leaf = new THREE.Mesh(new THREE.SphereGeometry(0.4, 10, 8), leafMat);
      leaf.scale.set(0.35, 1.3, 0.12);
      const a = (i / 14) * Math.PI * 2;
      leaf.position.set(Math.cos(a) * 0.25, 1.3 + rand(0, 0.5), Math.sin(a) * 0.25);
      leaf.rotation.set(Math.sin(a) * 0.6, a, Math.cos(a) * -0.6);
      leaf.castShadow = true;
      g.add(leaf);
    }
    g.position.set(x, 0, z);
    this.scene.add(g);
    this.obstacles.push({ x, z, r: 0.7 });
  }

  addWhiteboard() {
    const tex = canvasTexture(1024, 600, (c, w, hh) => {
      c.fillStyle = '#f7f8fb'; c.fillRect(0, 0, w, hh);
      c.fillStyle = '#1d3b6e'; c.font = '700 54px "Segoe Print", "Comic Sans MS", cursive';
      c.fillText('A Day in the Life', 40, 80);
      c.fillText('of a Salesman', 40, 145);
      c.font = '400 38px "Segoe Print", "Comic Sans MS", cursive';
      const todo = [['08:00 Kaffee ☕', true], ['09:00 Legacy verschrotten', true], ['11:00 Excel-Listen löschen', false], ['14:00 Kunden begeistern', false], ['17:00 Zertifikat abholen 🏆', false]];
      todo.forEach(([t, done], i) => {
        c.fillStyle = done ? '#2e7d32' : '#c62828';
        c.fillText(`${done ? '☑' : '☐'} ${t}`, 60, 230 + i * 70);
      });
      c.strokeStyle = '#19c3ff'; c.lineWidth = 6;
      c.beginPath(); c.moveTo(700, 520); c.lineTo(780, 430); c.lineTo(850, 470); c.lineTo(960, 260); c.stroke();
      c.beginPath(); c.moveTo(960, 260); c.lineTo(935, 290); c.moveTo(960, 260); c.lineTo(965, 300); c.stroke();
    });
    const wb = new THREE.Mesh(new THREE.BoxGeometry(5, 2.9, 0.08), [
      new THREE.MeshStandardMaterial({ color: 0xaaaaaa }), new THREE.MeshStandardMaterial({ color: 0xaaaaaa }),
      new THREE.MeshStandardMaterial({ color: 0xaaaaaa }), new THREE.MeshStandardMaterial({ color: 0xaaaaaa }),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.25 }), new THREE.MeshStandardMaterial({ color: 0xaaaaaa })
    ]);
    wb.position.set(-ROOM_W / 2 + 0.25, 3.2, -4.6);
    wb.rotation.y = Math.PI / 2;
    this.scene.add(wb);
  }

  addCoffee(x, z) {
    const g = new THREE.Group();
    const body = new THREE.Mesh(new RoundedBoxGeometry(1, 1.6, 0.9, 3, 0.08), new THREE.MeshPhysicalMaterial({ color: 0x1b1b1f, metalness: 0.6, roughness: 0.3, clearcoat: 1 }));
    body.position.y = 1.9;
    body.castShadow = true;
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.1, 1.0), new THREE.MeshStandardMaterial({ color: 0x3a4152 }));
    cab.position.y = 0.55;
    cab.castShadow = true;
    const led = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 0.15), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.4, 2.0, 0.8), toneMapped: false }));
    led.position.set(0, 2.4, 0.46);
    g.add(body, cab, led);
    g.position.set(x, 0, z);
    g.rotation.y = -Math.PI / 2;
    this.scene.add(g);
    this.obstacles.push({ x, z, r: 1.0 });
  }

  addJukebox(x, z) {
    const jb = buildJukebox();
    jb.group.position.set(x, 0, z);
    const rot = -Math.PI / 2 + 0.65; // angled into the room, towards the camera
    jb.group.rotation.y = rot;
    this.scene.add(jb.group);
    this.obstacles.push({ x, z, r: 1.0 });
    const n = new THREE.Vector3(Math.sin(rot), 0, Math.cos(rot));
    this.jukebox = { ...jb, front: new THREE.Vector3(x, 0, z).addScaledVector(n, 1.75), faceYaw: rot + Math.PI };
    this.jbPlayer = new JukeboxPlayer();
  }

  openJuke() {
    this.hidePrompt();
    this.jbPlayer.open();
  }

  showJukePrompt() {
    this.hidePrompt();
    const cur = this.jbPlayer.current;
    this.prompt = mount(h('div.game-prompt.panel', { 'data-id': 'jukebox' }, [
      h('h3', {}, '🎵 Jukebox'),
      h('p', {}, this.jbPlayer.playing ? `Läuft gerade: ${cur.title}` : `Lieder aus der itmX Spielewelt, zum Beispiel „${cur.title}“.`),
      h('button.btn', { onclick: () => { unlockAudio(); this.openJuke(); } }, '🎵 Jukebox öffnen')
    ]));
    if (this.hint) this.hint.style.display = 'none';
    sfx.pop();
  }

  buildPlayer() {
    return { root: new THREE.Group(), phase: 0, speed: 0 };
  }

  applyAvatar(cfg) {
    const pl = this.player;
    if (pl.av) { pl.root.remove(pl.av.root); disposeAvatar(pl.av); }
    const av = buildAvatar(cfg);
    pl.root.add(av.root);
    Object.assign(pl, { av, body: av.body, legs: av.legs, arms: av.arms, neck: av.neck });
  }

  buildSlapHand() {
    const g = new THREE.Group();
    const skin = new THREE.MeshPhysicalMaterial({ color: 0xe9bf9f, roughness: 0.55, sheen: 0.4, sheenColor: new THREE.Color(0xff9a8a) });
    const palm = new THREE.Mesh(new RoundedBoxGeometry(0.62, 0.7, 0.18, 3, 0.07), skin);
    palm.position.y = -0.35;
    g.add(palm);
    for (let i = 0; i < 4; i++) {
      const f = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.42 - Math.abs(i - 1.5) * 0.06, 4, 10), skin);
      f.position.set(-0.23 + i * 0.155, -0.92 + Math.abs(i - 1.5) * 0.03, 0);
      g.add(f);
    }
    const thumb = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.3, 4, 10), skin);
    thumb.position.set(0.38, -0.42, 0.04);
    thumb.rotation.z = 0.7;
    g.add(thumb);
    const cuff = new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.16, 20), new THREE.MeshStandardMaterial({ color: 0xf7f7f5 }));
    cuff.position.y = 0.06;
    cuff.scale.z = 0.55;
    const sleeve = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 3.4, 20), new THREE.MeshPhysicalMaterial({ color: 0x1f2c52, roughness: 0.6, sheen: 0.6 }));
    sleeve.position.y = 1.85;
    sleeve.scale.z = 0.6;
    const link = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.08, 0.05), new THREE.MeshStandardMaterial({ color: 0xd9b45a, metalness: 1, roughness: 0.25 }));
    link.position.set(0, 0.06, 0.16);
    g.add(cuff, sleeve, link);
    g.traverse((o) => { if (o.isMesh) o.castShadow = true; });
    g.scale.setScalar(1.25);
    g.visible = false;
    this.scene.add(g);
    // dizzy stars
    const starTex = canvasTexture(64, 64, (c, w, hh) => {
      c.translate(w / 2, hh / 2); c.fillStyle = '#ffd34d'; c.beginPath();
      for (let i = 0; i < 10; i++) { const r = i % 2 ? 12 : 30, a = (i / 10) * Math.PI * 2 - Math.PI / 2; c.lineTo(Math.cos(a) * r, Math.sin(a) * r); }
      c.fill();
    });
    this.stars = [];
    for (let i = 0; i < 5; i++) {
      const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: starTex, transparent: true, depthWrite: false, toneMapped: false, color: new THREE.Color(1.6, 1.6, 1.6) }));
      sp.scale.setScalar(0.22);
      sp.visible = false;
      this.scene.add(sp);
      this.stars.push(sp);
    }
    return g;
  }

  // ------------------------------------------------------------------ wardrobe
  openWardrobe() {
    if (this.mode === 'wardrobe') return;
    unlockAudio();
    sfx.click();
    this.mode = 'wardrobe';
    this.walkTarget = null;
    this.marker.visible = false;
    this.hidePrompt();
    this.near = null;
    if (this.hint) this.hint.style.display = 'none';
    this.wardrobeBtn.style.display = 'none';
    let tab = this.wardrobeTab || 'top';
    const tabs = h('div.wd-tabs');
    const grid = h('div.wd-grid');
    const nameInput = h('input', { type: 'text', maxlength: '40', placeholder: 'Dein Name (fürs Zertifikat)', value: storeGet('player-name', '') });
    nameInput.addEventListener('input', () => storeSet('player-name', nameInput.value));
    const render = () => {
      tabs.replaceChildren(...WARDROBE.map((c) => h('button.wd-tab' + (c.id === tab ? '.on' : ''), { onclick: () => { tab = c.id; this.wardrobeTab = tab; sfx.click(); render(); } }, c.label)));
      const cat = WARDROBE.find((c) => c.id === tab);
      grid.replaceChildren(...cat.options.map((o) => {
        const on = this.avatar[cat.id] === o.id;
        const btn = h('button.wd-opt' + (on ? '.on' : '') + (cat.swatch ? '.sw' : ''), { onclick: () => this.pickOutfit(cat, o, render) }, cat.swatch
          ? [h('i', { style: `background:#${o.color.toString(16).padStart(6, '0')}` }), o.label]
          : o.label);
        return btn;
      }));
    };
    render();
    this.wardrobe = mount(h('div.wardrobe.panel', {}, [
      h('div.wd-head', {}, [h('strong', {}, 'Dein Business-Look'), h('button.btn', { onclick: () => this.closeWardrobe() }, 'Fertig')]),
      h('div.name', {}, nameInput),
      tabs,
      grid
    ]));
  }

  closeWardrobe() {
    if (this.slap) return;
    sfx.click();
    this.mode = 'walk';
    this.wardrobe?.remove();
    this.wardrobe = null;
    this.wardrobeBtn.style.display = '';
    if (this.hint) this.hint.style.display = '';
  }

  pickOutfit(cat, opt, render) {
    if (this.slap) return;
    if (opt.forbidden) {
      // put it on for a moment ... then the hand comes
      const prev = { ...this.avatar };
      this.applyAvatar({ ...this.avatar, [cat.id]: opt.id });
      this.slap = { t: 0, prev, msg: opt.forbidden, hit: false };
      this.hand.visible = true;
      sfx.whoosh();
      return;
    }
    sfx.click();
    this.avatar[cat.id] = opt.id;
    saveAvatar(this.avatar);
    this.applyAvatar(this.avatar);
    render();
  }

  updateSlap(dt) {
    const S = this.slap;
    if (!S) return;
    S.t += dt;
    const t = S.t;
    const neck = new THREE.Vector3();
    this.player.neck.getWorldPosition(neck);
    const yaw = this.player.root.rotation.y;
    const back = new THREE.Vector3(-Math.sin(yaw), 0, -Math.cos(yaw)); // behind the avatar
    const hand = this.hand;
    hand.rotation.y = yaw;
    const ease = (x) => 1 - Math.pow(1 - clamp(x, 0, 1), 3);
    if (t < 0.45) {
      // comes down from the sky behind the avatar
      const k = ease(t / 0.45);
      hand.position.copy(neck).addScaledVector(back, 0.75).add(new THREE.Vector3(0, lerp(6, 1.25, k), 0));
      hand.rotation.x = -0.15;
    } else if (t < 0.62) {
      // wind-up
      const k = ease((t - 0.45) / 0.17);
      hand.position.copy(neck).addScaledVector(back, lerp(0.75, 1.05, k)).add(new THREE.Vector3(0, 1.25, 0));
      hand.rotation.x = lerp(-0.15, -0.75, k);
    } else if (t < 0.7) {
      // WHAP
      const k = clamp((t - 0.62) / 0.08, 0, 1);
      hand.position.copy(neck).addScaledVector(back, lerp(1.05, 0.42, k)).add(new THREE.Vector3(0, lerp(1.25, 1.0, k), 0));
      hand.rotation.x = lerp(-0.75, 0.25, k);
      if (t >= 0.68 && !S.hit) {
        S.hit = true;
        sfx.slap();
        this.shake = 0.5;
        this.jolt = 0;
        const toast = mount(h('div.slap-toast.panel.passthrough', {}, [h('b', {}, '👋 Nackenklatscher!'), S.msg, h('small', {}, 'So gammlig läuft bei der Arbeit niemand rum. Business-Look, bitte.')]));
        setTimeout(() => toast.remove(), 3600);
      }
    } else if (t < 1.25) {
      if (!S.hit) { S.hit = true; sfx.slap(); this.shake = 0.5; this.jolt = 0; }
      hand.position.copy(neck).addScaledVector(back, 0.42).add(new THREE.Vector3(0, 1.0, 0));
    } else if (t < 1.7) {
      const k = (t - 1.25) / 0.45;
      hand.position.copy(neck).addScaledVector(back, 0.42 + k * 0.6).add(new THREE.Vector3(0, 1.0 + k * k * 7, 0));
    }
    if (S.hit) {
      this.jolt += dt;
      const j = this.jolt;
      this.player.neck.rotation.x = 0.55 * Math.cos(j * 22) * Math.exp(-j * 4.5);
      // dizzy stars
      this.stars.forEach((sp, i) => {
        sp.visible = j < 1.8;
        const a = j * 5 + (i / this.stars.length) * Math.PI * 2;
        sp.position.copy(neck).add(new THREE.Vector3(Math.cos(a) * 0.42, 0.75 + Math.sin(j * 7 + i) * 0.05, Math.sin(a) * 0.42));
      });
    }
    if (t >= 1.9) {
      // outfit is "confiscated" -> back to the previous look
      this.hand.visible = false;
      this.stars.forEach((sp) => (sp.visible = false));
      this.player.neck.rotation.x = 0;
      this.avatar = S.prev;
      this.applyAvatar(this.avatar);
      sfx.whoosh();
      this.slap = null;
    }
  }

  // ------------------------------------------------------------------ lifecycle
  enter() {
    this.resize(window.innerWidth, window.innerHeight);
    const c = this.app.gfx.renderer.domElement;
    c.addEventListener('pointerdown', this.onDown);
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    this.near = null;
    this.nearJuke = false;
    this.mode = 'walk';
    this.buildUI();
    music.play('hub');
    // after a game, step back in front of its cabinet
    if (this.lastGame) {
      const cab = this.cabinets.find((x) => x.game.id === this.lastGame);
      if (cab) { this.player.root.position.copy(cab.front).add(new THREE.Vector3(0, 0, 0.6)); this.player.root.rotation.y = Math.PI; }
    }
    this.walkTarget = null;
    this.camInit = false;
  }

  exit() {
    const c = this.app.gfx.renderer.domElement;
    c.removeEventListener('pointerdown', this.onDown);
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    this.keys.clear();
    this.jbPlayer.close();
    clearUI();
  }

  buildUI() {
    clearUI();
    mount(h('div.hub-title.panel.passthrough', { html: `<img class="brand" src="${import.meta.env.BASE_URL}brand/itmx-logo.png" alt=""> <span>itmX</span> Spielewelt` }));
    const mute = mount(h('button.icon-btn.right', { title: 'Ton an/aus', onclick: () => { setMuted(!isMuted()); mute.textContent = isMuted() ? '🔇' : '🔊'; } }, isMuted() ? '🔇' : '🔊'));
    this.hint = mount(h('div.hub-hint.panel.passthrough', {}, matchMedia('(pointer: coarse)').matches
      ? 'Tippe auf den Boden zum Laufen oder direkt auf einen Automaten.'
      : 'Klicke zum Laufen (oder WASD/Pfeiltasten). Geh zu einem Automaten, um zu spielen.'));
    this.prompt = null;
    mount(h('button.version', {
      title: 'Neueste Version laden',
      onclick: () => { if (confirm(`Version ${__BUILD_ID__}\n\nCache leeren und neueste Version laden?`)) window.__hardReload?.(); }
    }, `v ${__BUILD_ID__} ↻`));
    this.wardrobeBtn = mount(h('button.icon-btn.left.wd-btn', { title: 'Avatar gestalten', onclick: () => this.openWardrobe() }, '👔'));
    this.jbChipTitle = h('b');
    this.jbChip = mount(h('button.jb-chip.panel', { title: 'Jukebox öffnen', onclick: () => { sfx.click(); this.openJuke(); } }, [h('i.kr-eq', {}, [h('em'), h('em'), h('em')]), h('span', {}, [h('small', {}, 'Jukebox'), this.jbChipTitle])]));
  }

  showPrompt(cab) {
    if (this.prompt && this.prompt.dataset.id === cab.game.id) return;
    this.prompt?.remove();
    const g = cab.game;
    this.prompt = mount(h('div.game-prompt.panel', { 'data-id': g.id }, [
      h('h3', {}, g.title),
      h('p', {}, g.tagline),
      g.available
        ? h('button.btn', { onclick: () => this.launch(g) }, '▶ Spielen')
        : h('button.btn.secondary', { disabled: 'true' }, 'Bald verfügbar')
    ]));
    if (this.hint) this.hint.style.display = 'none';
    if (g.available) sfx.pop();
  }

  hidePrompt() {
    if (!this.prompt) return;
    this.prompt.remove();
    this.prompt = null;
    if (this.hint) this.hint.style.display = '';
  }

  launch(game) {
    unlockAudio();
    sfx.click();
    this.lastGame = game.id;
    this.app.startGame(game.id);
  }

  resize(w, hgt) {
    this.camera.aspect = w / hgt;
    this.camera.fov = w / hgt < 1 ? 60 : 45;
    this.camera.updateProjectionMatrix();
  }

  onDown(e) {
    unlockAudio();
    if (this.mode === 'wardrobe') return;
    const r = this.app.gfx.renderer.domElement.getBoundingClientRect();
    const p = new THREE.Vector2(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    this.raycaster.setFromCamera(p, this.camera);
    const jh = this.raycaster.intersectObjects(this.jukebox.pickables, false)[0];
    const picks = this.cabinets.flatMap((c) => c.pickables);
    const hit = this.raycaster.intersectObjects(picks, false)[0];
    if (jh && (!hit || jh.distance < hit.distance)) {
      this.walkTarget = this.jukebox.front.clone();
      this.walkCab = null;
      this.walkJuke = true;
      this.marker.position.set(this.walkTarget.x, 0.02, this.walkTarget.z);
      this.marker.visible = true;
      return;
    }
    this.walkJuke = false;
    if (hit) {
      const cab = this.cabinets.find((c) => c.pickables.includes(hit.object));
      this.walkTarget = cab.front.clone();
      this.walkCab = cab;
      this.marker.position.set(cab.front.x, 0.02, cab.front.z);
      this.marker.visible = true;
      return;
    }
    const f = this.raycaster.intersectObject(this.floor, false)[0];
    if (f) {
      this.walkTarget = new THREE.Vector3(f.point.x, 0, f.point.z);
      this.walkCab = null;
      this.marker.position.set(f.point.x, 0.02, f.point.z);
      this.marker.visible = true;
      this.markerT = 0;
    }
  }

  update(dt, time) {
    const pl = this.player;
    const pos = pl.root.position;
    // keyboard movement (camera-relative: camera looks toward -z)
    const k = this.keys;
    const dir = new THREE.Vector3(
      (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0), 0,
      (k.has('s') || k.has('arrowdown') ? 1 : 0) - (k.has('w') || k.has('arrowup') ? 1 : 0)
    );
    const wardrobe = this.mode === 'wardrobe';
    if (wardrobe) dir.set(0, 0, 0);
    if (dir.lengthSq() > 0) { this.walkTarget = null; this.marker.visible = false; }
    else if (this.walkTarget) {
      dir.subVectors(this.walkTarget, pos).setY(0);
      if (dir.length() < 0.15) {
        this.walkTarget = null;
        this.marker.visible = false;
        if (this.walkCab) pl.root.rotation.y = Math.PI;
        if (this.walkJuke) { pl.root.rotation.y = this.jukebox.faceYaw; this.walkJuke = false; this.openJuke(); }
        dir.set(0, 0, 0);
      }
    }
    const speed = 6.5;
    let moving = false;
    if (dir.lengthSq() > 0) {
      dir.normalize();
      const step = dir.clone().multiplyScalar(speed * dt);
      if (this.walkTarget) step.clampLength(0, pos.distanceTo(this.walkTarget));
      pos.add(step);
      moving = true;
      const want = Math.atan2(dir.x, dir.z);
      let diff = want - pl.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      pl.root.rotation.y += diff * clamp(dt * 14, 0, 1);
    }
    // collisions
    pos.x = clamp(pos.x, -ROOM_W / 2 + 0.8, ROOM_W / 2 - 0.8);
    pos.z = clamp(pos.z, -ROOM_D / 2 + 0.8, ROOM_D / 2 - 0.8);
    for (const o of this.obstacles) {
      const dx = pos.x - o.x, dz = pos.z - o.z;
      const d = Math.hypot(dx, dz);
      const min = o.r + 0.4;
      if (d < min && d > 0.0001) { pos.x = o.x + (dx / d) * min; pos.z = o.z + (dz / d) * min; }
    }
    // walk cycle
    pl.speed = lerp(pl.speed, moving ? 1 : 0, clamp(dt * 10, 0, 1));
    if (moving) {
      const prev = Math.sin(pl.phase);
      pl.phase += dt * 11;
      if (prev * Math.sin(pl.phase) < 0) sfx.step();
    }
    const sw = Math.sin(pl.phase) * 0.6 * pl.speed;
    pl.legs[0].rotation.x = sw;
    pl.legs[1].rotation.x = -sw;
    pl.arms[0].rotation.x = -sw * 0.8;
    pl.arms[1].rotation.x = sw * 0.5;
    pl.body.position.y = Math.abs(Math.cos(pl.phase)) * 0.08 * pl.speed + Math.sin(time * 2) * 0.01;

    // proximity to cabinets
    let near = null;
    // arcade screens animate at ~15 fps; cheaper on phones and looks retro anyway
    this.screenT = (this.screenT || 0) + dt;
    const redraw = this.screenT > 1 / 15;
    if (redraw) this.screenT = 0;
    for (const cab of this.cabinets) {
      const d = Math.hypot(pos.x - cab.front.x, pos.z - cab.front.z);
      if (d < 1.9) near = cab;
      cab.glow.material.opacity = (cab.game.available ? 0.45 : 0.12) + (near === cab ? 0.35 : 0) + Math.sin(time * 3) * 0.05;
      if (redraw) this.drawScreen(cab, time);
    }
    if (wardrobe) near = null;
    // jukebox
    const jbPlaying = this.jbPlayer.playing;
    this.jukebox.setTitle(this.jbPlayer.current.title);
    this.jukebox.update(dt, time, jbPlaying);
    this.jbTick = (this.jbTick || 0) + dt;
    if (this.jbTick > 0.25) {
      this.jbTick = 0;
      this.jbPlayer.tick();
      if (this.jbChip) {
        this.jbChip.classList.toggle('on', jbPlaying && !this.jbPlayer.panel);
        if (jbPlaying) this.jbChipTitle.textContent = this.jbPlayer.current.title;
      }
    }
    const nearJuke = !wardrobe && !near && Math.hypot(pos.x - this.jukebox.front.x, pos.z - this.jukebox.front.z) < 1.7;
    if (nearJuke !== this.nearJuke) {
      this.nearJuke = nearJuke;
      if (nearJuke) { this.near = null; this.showJukePrompt(); } else if (!near) this.hidePrompt();
    }
    if (near !== this.near && !wardrobe && !nearJuke) {
      this.near = near;
      if (near) this.showPrompt(near); else this.hidePrompt();
    }

    // camera follow (or close-up in the wardrobe)
    const camTarget = new THREE.Vector3(pos.x * 0.85, 9.5, pos.z + 11);
    const look = new THREE.Vector3(pos.x * 0.85, 1.6, pos.z - 2.5);
    if (this.camera.aspect < 1) { camTarget.set(pos.x * 0.7, 15, pos.z + 10.5); look.set(pos.x * 0.8, 0.6, pos.z - 1.8); }
    if (this.jbPlayer.panel && !wardrobe) {
      // keep the jukebox visible next to the panel
      if (this.camera.aspect >= 1) { camTarget.x += 2.4; look.x += 3.4; }
      else { camTarget.z += 2; look.z += 2.5; }
    }
    if (wardrobe) {
      // face the camera, turn slowly; frame the avatar next to / above the wardrobe panel
      let diff = Math.sin(time * 0.6) * 0.35 - pl.root.rotation.y;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      if (!this.slap) pl.root.rotation.y += diff * clamp(dt * 4, 0, 1);
      if (this.camera.aspect < 1) { camTarget.set(pos.x + 0.9, 3.2, pos.z + 6.4); look.set(pos.x, 0.25, pos.z); }
      else { camTarget.set(pos.x + 1.0, 2.6, pos.z + 5.2); look.set(pos.x + 1.35, 1.45, pos.z); }
      // during the slap: swing round to a 3/4 side view so the hand + neck are visible
      if (this.slap) { camTarget.x += 3.2; camTarget.z -= 1.6; camTarget.y += 0.6; }
    }
    this.updateSlap(dt);
    if (!this.camInit) { this.camera.position.copy(camTarget); this.camInit = true; }
    this.camera.position.lerp(camTarget, clamp(dt * (wardrobe ? 4 : 3), 0, 1));
    this.shake = Math.max(0, this.shake - dt * 1.6);
    if (this.shake > 0) this.camera.position.add(new THREE.Vector3((Math.random() - 0.5) * this.shake, (Math.random() - 0.5) * this.shake, 0));
    this.camera.lookAt(look);

    if (this.marker.visible) {
      this.markerT = (this.markerT || 0) + dt;
      this.marker.scale.setScalar(1 + Math.sin(this.markerT * 8) * 0.15);
    }
    this.sign.material.color.setScalar(1.5 + Math.sin(time * 2) * 0.12);
  }
}
