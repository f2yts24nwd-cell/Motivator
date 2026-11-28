import * as THREE from 'three';
import { GTAOPass } from 'three/examples/jsm/postprocessing/GTAOPass.js';
import { BokehPass } from 'three/examples/jsm/postprocessing/BokehPass.js';
import { storeGet, storeSet } from '../../core/ui.js';

// Quality tiers and the extra post-processing for Ludlein Bay.
//  mobil: phones/tablets – MSAA x2, small shadow map, no mirror water, fewer people/cars
//  hoch:  desktop default – MSAA x4, mirror water, lens flare, depth of field in cutscenes
//  ultra: + ambient occlusion (GTAO), 4k shadows, more traffic and people

export const QUALITIES = [
  { id: 'mobil', label: 'Mobil' },
  { id: 'hoch', label: 'Hoch' },
  { id: 'ultra', label: 'Ultra' }
];
export function defaultQuality() {
  const saved = storeGet('xcity-quality', null);
  if (saved) return saved;
  const phone = matchMedia('(pointer: coarse)').matches || Math.min(screen.width, screen.height) < 700;
  return phone ? 'mobil' : 'hoch';
}
export function saveQuality(q) { storeSet('xcity-quality', q); }

export const BUDGET = {
  mobil: { peds: 60, traffic: 20, parked: 24 },
  hoch: { peds: 110, traffic: 30, parked: 50 },
  ultra: { peds: 160, traffic: 42, parked: 90 }
};

/** add the passes after the render pass; returns a handle to toggle/remove them */
export function attachPost(gfx, scene, camera, quality) {
  const C = gfx.composer;
  const samples = quality === 'mobil' ? 2 : 4;
  for (const rt of [C.renderTarget1, C.renderTarget2]) { rt.samples = samples; rt.dispose(); }
  const added = [];
  let ao = null, dof = null;
  const insertAt = C.passes.indexOf(gfx.renderPass) + 1;
  if (quality === 'ultra') {
    ao = new GTAOPass(scene, camera, window.innerWidth, window.innerHeight);
    ao.output = GTAOPass.OUTPUT.Default;
    ao.blendIntensity = 0.9;
    ao.updateGtaoMaterial({ radius: 1.2, distanceExponent: 1.5, thickness: 2, scale: 1 });
    C.insertPass(ao, insertAt);
    added.push(ao);
  }
  if (quality !== 'mobil') {
    dof = new BokehPass(scene, camera, { focus: 15, aperture: 0.0006, maxblur: 0.008 });
    dof.enabled = false;
    C.insertPass(dof, C.passes.indexOf(gfx.bloom));
    added.push(dof);
  }
  return {
    ao, dof,
    setCamera(cam) { if (ao) ao.camera = cam; if (dof) dof.camera = cam; },
    cinematic(on, focus = 15) {
      if (!dof) return;
      dof.enabled = on;
      dof.uniforms.focus.value = focus;
    },
    resize(w, h) { ao?.setSize(w, h); },
    remove() {
      for (const p of added) { C.removePass(p); p.dispose?.(); }
      for (const rt of [C.renderTarget1, C.renderTarget2]) { rt.samples = 0; rt.dispose(); }
    }
  };
}
export { THREE };
