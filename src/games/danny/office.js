import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { canvasTexture, drawBrand, rand } from '../../core/gfx.js';
import { buildDesk, buildHydrant, buildFireStation, buildFireTruck } from './models.js';

// The open-plan office of the customer project (the arena) and the fire station (start menu).

export const AW = 12; // arena half width  (x)
export const AD = 8; // arena half depth  (z)

const std = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.7, ...o });

export function buildOffice(scene) {
  const g = new THREE.Group();
  scene.add(g);
  const aabbs = [];
  const box = (minX, maxX, minZ, maxZ) => aabbs.push({ minX, maxX, minZ, maxZ });

  // carpet tiles
  const carpet = canvasTexture(512, 512, (c, w, h) => {
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) {
      c.fillStyle = `hsl(220, 14%, ${(x + y) % 2 ? 20 : 23}%)`;
      c.fillRect(x * 128, y * 128, 128, 128);
      for (let i = 0; i < 260; i++) { c.fillStyle = `rgba(255,255,255,${rand(0.01, 0.05)})`; c.fillRect(x * 128 + rand(0, 128), y * 128 + rand(0, 128), 2, 2); }
      c.strokeStyle = 'rgba(0,0,0,0.35)'; c.lineWidth = 2; c.strokeRect(x * 128, y * 128, 128, 128);
    }
  });
  carpet.wrapS = carpet.wrapT = THREE.RepeatWrapping;
  carpet.repeat.set(AW / 2, AD / 2);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(AW * 2, AD * 2), new THREE.MeshStandardMaterial({ map: carpet, roughness: 0.95 }));
  floor.rotation.x = -Math.PI / 2;
  floor.receiveShadow = true;
  g.add(floor);
  const outside = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), std(0x0b0d14, { roughness: 1 }));
  outside.rotation.x = -Math.PI / 2;
  outside.position.y = -0.03;
  g.add(outside);

  // walls (back + sides), windows in the back wall
  const wallMat = std(0x2a3044, { roughness: 0.9 });
  const back = new THREE.Mesh(new THREE.BoxGeometry(AW * 2 + 0.6, 3.4, 0.3), wallMat);
  back.position.set(0, 1.7, -AD - 0.15);
  back.receiveShadow = true;
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.4, AD * 2), wallMat);
  left.position.set(-AW - 0.15, 1.7, 0);
  left.receiveShadow = true;
  const right = left.clone();
  right.position.x = AW + 0.15;
  g.add(back, left, right);
  const sky = canvasTexture(1024, 256, (c, w, h) => {
    const gr = c.createLinearGradient(0, 0, 0, h);
    gr.addColorStop(0, '#0d1230'); gr.addColorStop(0.6, '#6a2a5a'); gr.addColorStop(1, '#ff8a4a');
    c.fillStyle = gr; c.fillRect(0, 0, w, h);
    let x = 0;
    while (x < w) {
      const bw = rand(30, 80), bh = rand(60, 200);
      c.fillStyle = `hsl(250, 30%, ${rand(8, 14)}%)`; c.fillRect(x, h - bh, bw, bh);
      for (let yy = h - bh + 6; yy < h; yy += 12) for (let xx = x + 4; xx < x + bw - 4; xx += 9) if (Math.random() < 0.3) { c.fillStyle = '#ffd98a'; c.fillRect(xx, yy, 4, 6); }
      x += bw + rand(2, 8);
    }
  });
  for (const x of [-2, 4]) {
    const win = new THREE.Mesh(new THREE.PlaneGeometry(5, 1.7), new THREE.MeshBasicMaterial({ map: sky, color: new THREE.Color(1.3, 1.3, 1.3) }));
    win.position.set(x, 2.1, -AD + 0.01);
    g.add(win);
  }
  // big wall slogan
  const slogan = new THREE.Mesh(new THREE.PlaneGeometry(5.2, 0.7), new THREE.MeshBasicMaterial({
    map: canvasTexture(1024, 140, (c, w, h) => {
      c.font = '900 84px "Arial Black", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillStyle = '#ffffff'; c.fillText('FRAG DEN DANNY', w / 2, h / 2 + 4);
    }), transparent: true, color: new THREE.Color(1.6, 1.6, 1.6)
  }));
  slogan.position.set(1, 3.0, -AD + 0.02);
  g.add(slogan);
  box(-AW - 1, AW + 1, -AD - 1, -AD + 0.1);

  // ---- desk islands
  const seats = [];
  const roles = [['berater', 'dev', 'berater'], ['dev', 'berater', 'pl'], ['berater', 'dev', 'dev'], ['pl', 'berater', 'dev']];
  const females = [[false, true, false], [false, true, true], [false, true, false], [true, false, false]];
  const islands = [[-5.2, -1.3], [1.2, -1.3], [-5.2, 4.3], [1.2, 4.3]];
  islands.forEach(([cx, cz], ii) => {
    let k = 0;
    for (const [dx, dz, rot] of [[-0.82, 0.45, 0], [0.82, 0.45, 0], [-0.82, -0.45, Math.PI], [0.82, -0.45, Math.PI]]) {
      const d = buildDesk();
      d.group.position.set(cx + dx, 0, cz + dz);
      d.group.rotation.y = rot;
      g.add(d.group);
      const dir = rot === 0 ? 1 : -1;
      const top = new THREE.Vector3(cx + dx, 0.82, cz + dz);
      // three of four seats are taken
      const role = k < 3 ? roles[ii][k] : null;
      seats.push({ pos: new THREE.Vector3(cx + dx, 0, cz + dz + dir * 0.78), yaw: rot === 0 ? Math.PI : 0, desk: d, top, role, aisle: dir, female: k < 3 && females[ii][k], island: ii, k });
      k++;
    }
    // partition between the monitors
    const part = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.5, 0.06, 2, 0.02), std(0x50af30, { roughness: 0.9 }));
    part.position.set(cx, 1.05, cz);
    part.castShadow = true;
    g.add(part);
    box(cx - 1.65, cx + 1.65, cz - 0.9, cz + 0.9);
  });

  // ---- meeting room (customer) top left, glass walls
  const glass = new THREE.MeshPhysicalMaterial({ color: 0x9fd0ff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0, depthWrite: false, side: THREE.DoubleSide });
  const frame = std(0x9aa0a8, { metalness: 0.8, roughness: 0.3 });
  const MX = -6.6, MZ = -4.3;
  const addGlass = (x0, x1, z0, z1) => {
    const len = Math.hypot(x1 - x0, z1 - z0);
    const p = new THREE.Mesh(new THREE.PlaneGeometry(len, 2.6), glass);
    p.position.set((x0 + x1) / 2, 1.3, (z0 + z1) / 2);
    p.rotation.y = Math.atan2(-(z1 - z0), x1 - x0);
    p.renderOrder = 4;
    g.add(p);
    for (const [x, z] of [[x0, z0], [x1, z1]]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.08, 2.6, 0.08), frame);
      post.position.set(x, 1.3, z);
      g.add(post);
    }
    const rail = new THREE.Mesh(new THREE.BoxGeometry(len, 0.06, 0.06), frame);
    rail.position.set((x0 + x1) / 2, 2.6, (z0 + z1) / 2);
    rail.rotation.y = p.rotation.y;
    g.add(rail);
  };
  addGlass(-AW, -9.0, MZ, MZ);
  addGlass(-7.6, MX, MZ, MZ);
  addGlass(MX, MX, MZ, -AD);
  box(-AW - 1, -9.0, MZ - 0.12, MZ + 0.12);
  box(-7.6, MX + 0.12, MZ - 0.12, MZ + 0.12);
  box(MX - 0.12, MX + 0.12, -AD - 1, MZ);
  const mtable = new THREE.Mesh(new RoundedBoxGeometry(2.6, 0.08, 1.3, 2, 0.04), std(0x3a2a1e, { roughness: 0.4 }));
  mtable.position.set(-9.3, 0.76, -6.3);
  mtable.castShadow = mtable.receiveShadow = true;
  const mleg = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.3, 0.74, 14), frame);
  mleg.position.set(-9.3, 0.37, -6.3);
  g.add(mtable, mleg);
  box(-10.7, -7.9, -7.05, -5.55);
  const meetSign = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.45), new THREE.MeshBasicMaterial({
    map: canvasTexture(512, 96, (c, w, h) => {
      c.fillStyle = '#0d1424'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#ffcc4d'; c.font = '900 46px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('KUNDE · MEETING', w / 2, h / 2 + 2);
    }), color: new THREE.Color(1.3, 1.3, 1.3)
  }));
  meetSign.position.set(-9.3, 2.85, MZ + 0.02);
  g.add(meetSign);
  const meeting = {
    door: new THREE.Vector3(-8.3, 1.2, MZ),
    seats: [
      { pos: new THREE.Vector3(-8.9, 0, -7.25), yaw: 0, role: 'kunde', aisle: -1, top: new THREE.Vector3(-8.9, 0.82, -6.5) },
      { pos: new THREE.Vector3(-9.9, 0, -5.35), yaw: Math.PI, role: 'pl', aisle: 1, top: new THREE.Vector3(-9.9, 0.82, -6.1) }
    ]
  };

  // ---- server room: racks top right
  const rackMat = std(0x15181f, { metalness: 0.5, roughness: 0.4 });
  const leds = [];
  for (let i = 0; i < 4; i++) {
    const x = 7.4 + i * 1.15;
    const rack = new THREE.Mesh(new RoundedBoxGeometry(1.0, 2.4, 0.9, 2, 0.04), rackMat);
    rack.position.set(x, 1.2, -7.3);
    rack.castShadow = true;
    g.add(rack);
    for (let k = 0; k < 6; k++) {
      const led = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 0.05), new THREE.MeshBasicMaterial({ color: new THREE.Color(0.2, 2.2, 0.6) }));
      led.position.set(x, 0.5 + k * 0.32, -6.84);
      g.add(led);
      leds.push(led);
    }
  }
  box(6.8, 11.9, -8, -6.75);
  const srvSign = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.4), new THREE.MeshBasicMaterial({
    map: canvasTexture(512, 96, (c, w, h) => {
      c.fillStyle = '#0d1424'; c.fillRect(0, 0, w, h);
      c.fillStyle = '#19c3ff'; c.font = '900 46px Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('SERVERRAUM', w / 2, h / 2 + 2);
    }), color: new THREE.Color(1.3, 1.3, 1.3)
  }));
  srvSign.position.set(9.1, 2.85, -AD + 0.02);
  g.add(srvSign);

  // ---- coffee corner + hydrant (refill), bottom right
  const counter = new THREE.Mesh(new RoundedBoxGeometry(3.2, 0.95, 0.8, 2, 0.04), std(0xe8e4dc, { roughness: 0.5 }));
  counter.position.set(10.2, 0.475, 7.4);
  counter.castShadow = counter.receiveShadow = true;
  const machine = new THREE.Mesh(new RoundedBoxGeometry(0.6, 0.7, 0.5, 2, 0.05), std(0x1b1b1f, { metalness: 0.6, roughness: 0.3 }));
  machine.position.set(9.6, 1.3, 7.4);
  machine.castShadow = true;
  g.add(counter, machine);
  box(8.5, 11.9, 6.9, 8);
  const hydrant = buildHydrant();
  hydrant.position.set(10.3, 0, 3.2);
  g.add(hydrant);
  box(9.95, 10.65, 2.85, 3.55);

  // plants
  for (const [x, z] of [[6.2, -7.4], [-11.3, -3.4], [11.4, 5.4]]) {
    const pot = new THREE.Mesh(new THREE.CylinderGeometry(0.34, 0.26, 0.6, 16), std(0xf0ebe0, { roughness: 0.4 }));
    pot.position.set(x, 0.3, z);
    const bush = new THREE.Mesh(new THREE.IcosahedronGeometry(0.6, 1), std(0x2f8f4e, { roughness: 0.8, flatShading: true }));
    bush.position.set(x, 1.05, z);
    bush.scale.y = 1.3;
    pot.castShadow = bush.castShadow = true;
    g.add(pot, bush);
    box(x - 0.4, x + 0.4, z - 0.4, z + 0.4);
  }

  // ---- fire station door on the left wall (Danny enters here)
  const door = new THREE.Mesh(new THREE.BoxGeometry(0.12, 2.4, 1.6), std(0xc4141c, { roughness: 0.4 }));
  door.position.set(-AW + 0.02, 1.2, 1.5);
  g.add(door);
  const doorSign = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 0.5), new THREE.MeshBasicMaterial({
    map: canvasTexture(512, 140, (c, w, h) => {
      c.fillStyle = '#c4141c'; c.fillRect(0, 0, w, h);
      drawBrand(c, 14, 20, 100, 100);
      c.fillStyle = '#fff'; c.font = '900 54px "Arial Black", Arial'; c.textAlign = 'center'; c.textBaseline = 'middle';
      c.fillText('WACHE', w / 2 + 50, h / 2 + 4);
    }), color: new THREE.Color(1.4, 1.4, 1.4)
  }));
  doorSign.position.set(-AW + 0.1, 2.75, 1.5);
  doorSign.rotation.y = Math.PI / 2;
  g.add(doorSign);
  const doorLight = new THREE.PointLight(0x3355ff, 0, 8, 2);
  doorLight.position.set(-AW + 0.8, 2.6, 1.5);
  g.add(doorLight);

  return {
    group: g, floor, aabbs, seats, meeting, leds,
    hydrant: { group: hydrant, pos: new THREE.Vector3(10.3, 0, 3.2) },
    spawn: new THREE.Vector3(-AW + 1.2, 0, 1.5), doorLight
  };
}

/** Fire station facade + fire truck for the start menu, far away from the office. */
export const STAGE = new THREE.Vector3(80, 0, 0);
export function buildStage(scene) {
  const g = new THREE.Group();
  g.position.copy(STAGE);
  scene.add(g);
  const asphalt = new THREE.Mesh(new THREE.PlaneGeometry(60, 40), new THREE.MeshStandardMaterial({
    map: canvasTexture(512, 512, (c, w, h) => {
      c.fillStyle = '#23252b'; c.fillRect(0, 0, w, h);
      for (let i = 0; i < 3000; i++) { c.fillStyle = `rgba(255,255,255,${rand(0.02, 0.08)})`; c.fillRect(rand(0, w), rand(0, h), 2, 2); }
      c.fillStyle = '#e8c23a';
      for (let x = 0; x < w; x += 64) c.fillRect(x, h * 0.5, 36, 8);
    }), roughness: 0.85, metalness: 0.1
  }));
  asphalt.material.map.wrapS = asphalt.material.map.wrapT = THREE.RepeatWrapping;
  asphalt.material.map.repeat.set(4, 3);
  asphalt.rotation.x = -Math.PI / 2;
  asphalt.position.z = 8;
  asphalt.receiveShadow = true;
  g.add(asphalt);
  const station = buildFireStation();
  station.group.position.set(0, 0, -2);
  g.add(station.group);
  const truck = buildFireTruck();
  truck.group.position.set(0, 0, -5.6);
  g.add(truck.group);
  // light inside the garage + blue strobes
  const garage = new THREE.PointLight(0xffe0b0, 14, 12, 2);
  garage.position.set(0, 4, -3.5);
  g.add(garage);
  const blueA = new THREE.PointLight(0x3366ff, 0, 18, 1.6);
  blueA.position.set(-4, 6, 0);
  const blueB = blueA.clone();
  blueB.position.x = 4;
  g.add(blueA, blueB);
  const key = new THREE.SpotLight(0xfff0dd, 220, 40, 0.6, 0.5, 1.4);
  key.position.set(6, 12, 14);
  key.target.position.set(0, 1.5, 0);
  g.add(key, key.target);
  return { group: g, station, truck, blueA, blueB, garage };
}
