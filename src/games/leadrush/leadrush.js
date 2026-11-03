import * as THREE from 'three';
import { music, isMuted, setMuted } from '../../core/audio.js';
import { storeGet } from '../../core/ui.js';
import { createLeadRush } from './engine.js';

const BASE = import.meta.env.BASE_URL;

/**
 * Spiel 5: Lead Rush. Ein 2D-Runner, der als Vollbild-Ebene über der Spielewelt liegt.
 * `overlay = true` sagt main.js, dass die 3D-Szene solange nicht gerendert werden muss.
 */
export class LeadRushGame {
  constructor(app) {
    this.app = app;
    this.overlay = true;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x0b1a30);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    this.engine = createLeadRush({
      onExit: () => this.app.goHub(),
      isMuted,
      setMuted,
      playerName: () => storeGet('player-name', ''),
      logoUrl: BASE + 'brand/itmx-logo.png',
      wordmarkUrl: BASE + 'leadrush/itmx-wordmark.png'
    });
  }

  enter() {
    music.stop(0.6);
    music.stopSong?.(0.6);
    document.body.append(this.engine.host);
    this.engine.mount();
  }

  exit() {
    this.engine.unmount();
    this.engine.host.remove();
  }

  update(dt) {
    this.engine.frame(dt);
  }

  resize() {
    this.engine.resize();
  }
}
