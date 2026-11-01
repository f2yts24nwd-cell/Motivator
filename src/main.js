import * as THREE from 'three';
import './style.css';
import { createRenderer, loadBrandLogo } from './core/gfx.js';
import { Hub } from './hub/hub.js';
import { GAMES } from './games/registry.js';
import { CertificateScene } from './cert/certificate.js';
import { registerSW } from 'virtual:pwa-register';
import { unlockAudio, suspendAudio } from './core/audio.js';

// Offline cache (service worker). New deploys are installed in the background and the page
// reloads itself once they are active. iOS checks rarely on its own, so we ask actively:
// on start, every minute and whenever the app comes back to the foreground.
registerSW({
  immediate: true,
  onRegisteredSW(_url, reg) {
    if (!reg) return;
    const check = () => { if (navigator.onLine !== false) reg.update().catch(() => {}); };
    check();
    setInterval(check, 60 * 1000);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) check(); });
    window.addEventListener('pageshow', check);
  }
});
let reloading = false;
const hadController = !!navigator.serviceWorker?.controller; // first install: no reload needed
navigator.serviceWorker?.addEventListener('controllerchange', () => {
  if (reloading || !hadController) return;
  reloading = true;
  location.reload();
});
window.__BUILD_ID__ = __BUILD_ID__;

async function boot() {
  await loadBrandLogo();
  const gfx = createRenderer(document.getElementById('gl'));
  const games = new Map();
  const extraScenes = new Map();
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
    /** Extra scenes owned by a game (e.g. a finale), created on first use. */
    showScene(key, create, arg) {
      if (!extraScenes.has(key)) extraScenes.set(key, create(app));
      setScene(extraScenes.get(key), arg);
    },
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

  // ---- mobile / iOS hardening ----
  const onResize = () => {
    gfx.resize();
    current?.resize?.(window.innerWidth, window.innerHeight);
  };
  window.addEventListener('resize', onResize);
  window.visualViewport?.addEventListener('resize', onResize);
  // iOS reports the new size slightly after the rotation event
  window.addEventListener('orientationchange', () => { onResize(); setTimeout(onResize, 250); setTimeout(onResize, 700); });
  // block pinch-zoom, double-tap zoom and rubber-band scrolling inside the game
  for (const ev of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(ev, (e) => e.preventDefault(), { passive: false });
  document.addEventListener('dblclick', (e) => e.preventDefault(), { passive: false });
  gfx.renderer.domElement.addEventListener('touchmove', (e) => e.preventDefault(), { passive: false });
  gfx.renderer.domElement.addEventListener('touchstart', (e) => e.preventDefault(), { passive: false });
  gfx.renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
  // WebAudio may only start inside a user gesture on iOS
  for (const ev of ['touchend', 'pointerup', 'click', 'keydown']) window.addEventListener(ev, unlockAudio, { passive: true });

  // deep link: ?game=whack starts a game directly (handy for shortcuts)
  const qs = new URLSearchParams(location.search);
  setScene(hub);
  if (qs.get('game')) app.startGame(qs.get('game'));

  const clock = new THREE.Clock();
  let time = 0;
  // adaptive quality: if frames get slow, lower the render resolution step by step
  let acc = 0, frames = 0, settle = 0;
  const loop = () => {
    const raw = clock.getDelta();
    const dt = Math.min(raw, 1 / 20);
    time += dt;
    current.update(dt, time);
    gfx.composer.render(dt);
    acc += raw; frames++; settle += raw;
    if (acc >= 2) {
      const avg = acc / frames;
      if (settle > 4 && avg > 1 / 45 && gfx.pixelRatio > 1) {
        gfx.setMaxPixelRatio(gfx.pixelRatio - 0.25);
        current?.resize?.(window.innerWidth, window.innerHeight);
        settle = 0;
      }
      acc = 0; frames = 0;
    }
  };
  gfx.renderer.setAnimationLoop(loop);
  // pause rendering + audio while the app is in the background (saves battery on iPhone)
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { gfx.renderer.setAnimationLoop(null); suspendAudio(); }
    else { clock.getDelta(); gfx.renderer.setAnimationLoop(loop); }
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
