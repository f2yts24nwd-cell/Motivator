import * as THREE from 'three';
import './style.css';
import { createRenderer, loadBrandLogo } from './core/gfx.js';
import { Hub } from './hub/hub.js';
import { GAMES } from './games/registry.js';
import { CertificateScene } from './cert/certificate.js';
import { registerSW } from 'virtual:pwa-register';

registerSW({ immediate: true });

async function boot() {
  await loadBrandLogo();
  const gfx = createRenderer(document.getElementById('gl'));
  const games = new Map();
  let current = null;

  const app = {
    gfx,
    goHub() { setScene(hub); },
    startGame(id) {
      const def = GAMES.find((g) => g.id === id && g.available);
      if (!def) return;
      if (!games.has(id)) games.set(id, def.create(app));
      setScene(games.get(id));
    },
    showCertificate(stats) { setScene(cert, stats); },
    get current() { return current; }
  };

  const hub = new Hub(app);
  const cert = new CertificateScene(app);

  function setScene(next, arg) {
    current?.exit();
    current = next;
    gfx.renderPass.scene = next.scene;
    gfx.renderPass.camera = next.camera;
    next.enter(arg);
    next.resize?.(window.innerWidth, window.innerHeight);
  }

  window.addEventListener('resize', () => {
    gfx.resize();
    current?.resize?.(window.innerWidth, window.innerHeight);
  });

  // deep link: ?game=whack starts a game directly (handy for shortcuts)
  const qs = new URLSearchParams(location.search);
  setScene(hub);
  if (qs.get('game')) app.startGame(qs.get('game'));

  const clock = new THREE.Clock();
  let time = 0;
  gfx.renderer.setAnimationLoop(() => {
    const dt = Math.min(clock.getDelta(), 1 / 20);
    time += dt;
    current.update(dt, time);
    gfx.composer.render(dt);
  });

  document.getElementById('loader').classList.add('hide');
  setTimeout(() => document.getElementById('loader')?.remove(), 600);
  // expose for debugging/automated screenshots
  window.__app = app;
}

boot().catch((err) => {
  console.error(err);
  const l = document.getElementById('loader');
  if (l) l.innerHTML = `<p>Fehler beim Laden: ${String(err.message || err)}</p>`;
});
