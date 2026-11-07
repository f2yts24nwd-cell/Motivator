import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, drawBrand, roundRect } from '../core/gfx.js';
import { brickTexture, buildExtinguisher } from '../games/danny/models.js';

// The bonus game's cabinet in the hub: a small fire station with a roller-door screen,
// rotating blue lights and the DANNY extinguisher hanging next to it.
export function buildFireStationCabinet(game) {
  const g = new THREE.Group();
  const bricks = brickTexture(512, 512);
  bricks.wrapS = bricks.wrapT = THREE.RepeatWrapping;
  bricks.repeat.set(1, 1.6);
  const brick = new THREE.MeshStandardMaterial({ map: bricks, roughness: 0.95 });
  const body = new THREE.Mesh(new RoundedBoxGeometry(2.6, 3.4, 1.6, 3, 0.06), brick);
  body.position.y = 1.7;
  body.castShadow = body.receiveShadow = true;
  g.add(body);
  // gable roof
  const shape = new THREE.Shape();
  shape.moveTo(-1.5, 0); shape.lineTo(0, 0.9); shape.lineTo(1.5, 0); shape.closePath();
  const roof = new THREE.Mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.8, bevelEnabled: false }), new THREE.MeshStandardMaterial({ color: 0x2a2d33, roughness: 0.7 }));
  roof.position.set(0, 3.4, -0.9);
  roof.castShadow = true;
  g.add(roof);
  // sign
  const sign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.5), new THREE.MeshBasicMaterial({
    map: canvasTexture(768, 160, (c, w, h) => {
      c.fillStyle = '#b3121b'; roundRect(c, 0, 0, w, h, 24); c.fill();
      c.strokeStyle = '#fff'; c.lineWidth = 6; roundRect(c, 8, 8, w - 16, h - 16, 18); c.stroke();
      drawBrand(c, 24, 26, 108, 108);
      c.fillStyle = '#fff'; c.font = '900 76px "Arial Black", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('FEUERWACHE', w / 2 + 52, h / 2 + 4);
    }), color: new THREE.Color(1.6, 1.6, 1.6), toneMapped: false
  }));
  sign.position.set(0, 3.12, 0.81);
  g.add(sign);
  // "BONUS" badge in the gable
  const badge = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.34), new THREE.MeshBasicMaterial({
    map: canvasTexture(384, 120, (c, w, h) => {
      c.fillStyle = '#e4ff3a'; roundRect(c, 0, 0, w, h, 60); c.fill();
      c.fillStyle = '#1b2640'; c.font = '900 72px "Arial Black", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('BONUS', w / 2, h / 2 + 4);
    }), transparent: true, color: new THREE.Color(1.5, 1.5, 1.5), toneMapped: false
  }));
  badge.position.set(0, 3.72, 0.92);
  g.add(badge);
  // garage opening = animated screen
  const frame = new THREE.Mesh(new THREE.BoxGeometry(2.0, 1.95, 0.08), new THREE.MeshStandardMaterial({ color: 0xd6dae0, metalness: 0.7, roughness: 0.3 }));
  frame.position.set(0, 1.7, 0.79);
  g.add(frame);
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 384; screenCanvas.height = 360;
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(1.82, 1.72), new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false, color: new THREE.Color(1.3, 1.3, 1.3) }));
  screen.position.set(0, 1.7, 0.835);
  g.add(screen);
  // red base strip + bollards
  const deck = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.5, 0.5), new THREE.MeshPhysicalMaterial({ color: 0xc4141c, roughness: 0.35, clearcoat: 1 }));
  deck.position.set(0, 0.25, 1.0);
  deck.castShadow = true;
  g.add(deck);
  // blue lights on the roof
  const blues = [];
  for (const sx of [-0.95, 0.95]) {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.15, 0.22, 16), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 0.5, 3), toneMapped: false }));
    l.position.set(sx, 3.55, 0.6);
    g.add(l);
    blues.push(l);
  }
  const blueLight = new THREE.PointLight(0x2f6bff, 0, 7, 2);
  blueLight.position.set(0, 3.4, 1.6);
  g.add(blueLight);
  // the extinguisher on a wall bracket at the side
  const ext = buildExtinguisher();
  ext.scale.setScalar(1.05);
  ext.position.set(1.45, 0.55, 0.45);
  ext.rotation.y = -0.5;
  g.add(ext);
  const bracket = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.4), new THREE.MeshStandardMaterial({ color: 0x333333 }));
  bracket.position.set(1.32, 1.25, 0.4);
  g.add(bracket);
  // glow on the floor + light
  const col = new THREE.Color(game.color);
  const glow = new THREE.Mesh(new THREE.CircleGeometry(1.8, 40), new THREE.MeshBasicMaterial({
    map: canvasTexture(128, 128, (c, w, h) => { const gr = c.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2); gr.addColorStop(0, 'rgba(255,255,255,0.8)'); gr.addColorStop(1, 'rgba(255,255,255,0)'); c.fillStyle = gr; c.fillRect(0, 0, w, h); }),
    color: col, transparent: true, opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  glow.rotation.x = -Math.PI / 2;
  glow.position.set(0, 0.015, 1.7);
  g.add(glow);
  const light = new THREE.PointLight(col, 10, 6, 2);
  light.position.set(0, 2.2, 1.7);
  g.add(light);
  for (const m of [body, screen, sign, deck, frame]) m.userData.cabinet = game.id;
  const update = (dt, time) => {
    const f = (ph) => Math.max(0, Math.sin(time * 8 + ph)) ** 4;
    blues[0].material.color.setRGB(0.2, 0.5, 0.8 + 4 * f(0));
    blues[1].material.color.setRGB(0.2, 0.5, 0.8 + 4 * f(Math.PI));
    blueLight.intensity = 14 * Math.max(f(0), f(Math.PI));
    ext.rotation.y = -0.5 + Math.sin(time * 1.2) * 0.08;
  };
  return { group: g, screenCanvas, screenTex, glow, light, pickables: [body, screen, sign, deck, frame], update };
}

/** attract mode on the roller-door screen: Danny foams a burning desk */
export function drawFireStationScreen(c, w, hh, time) {
  const sky = c.createLinearGradient(0, 0, 0, hh);
  sky.addColorStop(0, '#1a0c10'); sky.addColorStop(1, '#3a1410');
  c.fillStyle = sky; c.fillRect(0, 0, w, hh);
  // floor
  c.fillStyle = '#2a2f40'; c.fillRect(0, hh * 0.68, w, hh);
  // desk
  c.fillStyle = '#d9d4c8'; c.fillRect(200, 214, 150, 12);
  c.fillStyle = '#2a2f3a'; c.fillRect(208, 226, 8, 40); c.fillRect(334, 226, 8, 40);
  c.fillStyle = '#121418'; c.fillRect(240, 170, 70, 44);
  c.fillStyle = (Math.floor(time * 3) % 2) ? '#b3121b' : '#0e1a30'; c.fillRect(244, 174, 62, 34);
  // fire on the desk, shrinking while it is being foamed (8 s loop)
  const ph = (time % 8) / 8;
  const fire = ph < 0.25 ? 1 : ph < 0.75 ? 1 - (ph - 0.25) * 2 : 0;
  for (let i = 0; i < 14 * fire; i++) {
    const x = 275 + Math.sin(time * 9 + i * 2.1) * 36 * fire, y = 205 - Math.abs(Math.sin(time * 7 + i)) * 70 * fire;
    const r = (10 + (i % 4) * 6) * fire;
    const gr = c.createRadialGradient(x, y, 0, x, y, r);
    gr.addColorStop(0, 'rgba(255,250,200,0.95)'); gr.addColorStop(0.5, 'rgba(255,140,20,0.8)'); gr.addColorStop(1, 'rgba(255,40,0,0)');
    c.fillStyle = gr; c.beginPath(); c.arc(x, y, r, 0, Math.PI * 2); c.fill();
  }
  // Danny
  const dx = 70, dy = 266;
  c.fillStyle = '#1b2640'; c.fillRect(dx - 16, dy - 92, 32, 50); c.fillRect(dx - 15, dy - 42, 12, 42); c.fillRect(dx + 3, dy - 42, 12, 42);
  c.fillStyle = '#e4ff3a'; c.fillRect(dx - 17, dy - 66, 34, 5); c.fillRect(dx - 17, dy - 52, 34, 5);
  c.fillStyle = '#e8b892'; c.beginPath(); c.arc(dx, dy - 104, 12, 0, Math.PI * 2); c.fill();
  c.fillStyle = '#e6f02a'; c.beginPath(); c.arc(dx, dy - 108, 14, Math.PI, 0); c.fill(); c.fillRect(dx - 17, dy - 109, 34, 4);
  c.fillStyle = '#3a2414'; c.fillRect(dx - 2, dy - 100, 12, 3);
  // extinguisher + spray
  c.fillStyle = '#e8e8e4'; roundRect(c, dx + 14, dy - 80, 16, 36, 6); c.fill();
  c.fillStyle = '#50af30'; c.fillRect(dx + 17, dy - 72, 9, 9);
  c.fillStyle = '#111'; c.fillRect(dx + 24, dy - 86, 14, 7);
  if (ph > 0.15 && ph < 0.8) {
    for (let i = 0; i < 26; i++) {
      const k = ((time * 2.4 + i / 26) % 1);
      const x = dx + 40 + k * 190, y = dy - 82 + Math.sin(k * 3) * -14 + k * k * 30 + Math.sin(i * 7.3) * k * 16;
      c.fillStyle = `rgba(255,255,255,${0.9 - k * 0.5})`;
      c.beginPath(); c.arc(x, y, 3 + k * 9, 0, Math.PI * 2); c.fill();
    }
  }
  c.fillStyle = '#ffffff'; c.font = '900 34px "Arial Black", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
  c.fillText('FRAG DEN DANNY!', w / 2, 34);
  c.fillStyle = Math.sin(time * 6) > 0 ? '#ffcc4d' : '#ff3b1f';
  c.font = '900 24px "Segoe UI", Arial';
  c.fillText('🚨 BONUSSPIEL 🚨', w / 2, hh - 22);
}
