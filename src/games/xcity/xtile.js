import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';

// "Das X": the itmX logo as a 3D object (green tile, white X), shared by the hub portal,
// the monument on the X-Platz and the cargo on Cloudius' van.
const BRAND = 0x50af30;

export function buildXTile(size = 1, { glow = 0.25 } = {}) {
  const g = new THREE.Group();
  const tileMat = new THREE.MeshPhysicalMaterial({
    color: BRAND, emissive: BRAND, emissiveIntensity: glow, roughness: 0.25, metalness: 0.05,
    clearcoat: 1, clearcoatRoughness: 0.08
  });
  const xMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xffffff, emissiveIntensity: glow * 1.6, roughness: 0.3 });
  const tile = new THREE.Mesh(new RoundedBoxGeometry(size, size * 1.08, size * 0.24, 4, size * 0.12), tileMat);
  tile.castShadow = true;
  g.add(tile);
  const barGeo = new RoundedBoxGeometry(size * 0.2, size * 0.86, size * 0.06, 2, size * 0.03);
  for (const face of [1, -1]) for (const r of [Math.PI / 4.6, -Math.PI / 4.6]) {
    const bar = new THREE.Mesh(barGeo, xMat);
    bar.rotation.z = r;
    bar.position.z = face * size * 0.125;
    g.add(bar);
  }
  g.userData = { tileMat, xMat };
  return g;
}

/** soft vertical light beam (additive) */
export function buildBeam(radius = 1, height = 60, color = 0x7dff6a) {
  const c = document.createElement('canvas');
  c.width = 4; c.height = 128;
  const x = c.getContext('2d');
  const gr = x.createLinearGradient(0, 0, 0, 128);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.6, 'rgba(255,255,255,0.35)');
  gr.addColorStop(1, 'rgba(255,255,255,0.9)');
  x.fillStyle = gr; x.fillRect(0, 0, 4, 128);
  const tex = new THREE.CanvasTexture(c);
  const m = new THREE.MeshBasicMaterial({ color, map: tex, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, toneMapped: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.6, radius, height, 24, 1, true), m);
  beam.position.y = height / 2;
  return beam;
}
