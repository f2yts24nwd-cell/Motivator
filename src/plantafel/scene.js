import * as THREE from 'three';
import { music } from '../core/audio.js';
import { storeSet } from '../core/ui.js';
import { createPlantafel } from './app.js';

/**
 * Die Plantafel als Vollbild-Ebene über der Spielewelt (wie Lead Rush).
 * `overlay = true`: main.js rendert die 3D-Szene nicht, solange die Tafel offen ist.
 * Die Tafel merkt sich, dass sie offen war, und öffnet sich beim nächsten App-Start direkt wieder.
 */
export class PlantafelScene {
  constructor(app) {
    this.app = app;
    this.overlay = true;
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.1, 10);
    this.ui = createPlantafel({
      onExit: () => {
        storeSet('plantafel-open', false);
        this.app.goHub();
      }
    });
  }

  enter() {
    storeSet('plantafel-open', true);
    music.stop(0.6); // ruhig planen; ein laufender Jukebox-Song spielt weiter
    document.body.append(this.ui.host);
    this.ui.mount();
  }

  exit() {
    this.ui.unmount();
    this.ui.host.remove();
  }

  update() {}

  resize() {
    this.ui.resize();
  }
}
