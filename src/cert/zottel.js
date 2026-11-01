import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { canvasTexture, rand } from '../core/gfx.js';

// "Der Zottel": a scruffy, long-haired, unkempt fictional character built from primitives.

export function buildZottel() {
  const root = new THREE.Group();
  const body = new THREE.Group();
  root.add(body);

  const skin = new THREE.MeshPhysicalMaterial({ color: 0xe0b49a, roughness: 0.65, sheen: 0.4, sheenColor: new THREE.Color(0xff9a8a) });
  const hairMat = new THREE.MeshStandardMaterial({ color: 0x4a3423, roughness: 0.55, metalness: 0.05 });
  const beardMat = new THREE.MeshStandardMaterial({ color: 0x5a412b, roughness: 0.9 });
  const jeans = new THREE.MeshStandardMaterial({ color: 0x4d6488, roughness: 0.95 });

  const hoodieTex = canvasTexture(512, 512, (g, w, h) => {
    g.fillStyle = '#6b6a3a'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 3000; i++) { g.fillStyle = `rgba(0,0,0,${Math.random() * 0.08})`; g.fillRect(Math.random() * w, Math.random() * h, 3, 3); }
    // stains
    for (let i = 0; i < 9; i++) {
      g.fillStyle = `rgba(${rand(60, 120)},${rand(40, 70)},20,${rand(0.25, 0.5)})`;
      g.beginPath(); g.ellipse(rand(0, w), rand(0, h), rand(10, 40), rand(8, 28), rand(0, 3), 0, Math.PI * 2); g.fill();
    }
    g.fillStyle = 'rgba(240,230,200,0.85)';
    g.font = '900 54px "Segoe UI", Arial';
    g.textAlign = 'center';
    g.fillText('CRM', w * 0.75, h * 0.42);
    g.font = '700 30px "Segoe UI", Arial';
    g.fillText('SEIT 1998', w * 0.75, h * 0.5);
  });
  const hoodie = new THREE.MeshStandardMaterial({ map: hoodieTex, roughness: 0.95 });

  // legs
  for (const s of [-1, 1]) {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(0.17, 0.95, 6, 14), jeans);
    leg.position.set(s * 0.2, 0.68, 0);
    leg.castShadow = true;
    body.add(leg);
    const shoe = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.16, 0.48), new THREE.MeshStandardMaterial({ color: 0x2b2b2b, roughness: 0.8 }));
    shoe.position.set(s * 0.21, 0.08, 0.1);
    shoe.rotation.y = s * 0.15;
    shoe.castShadow = true;
    body.add(shoe);
  }
  // untied shoelace
  const lace = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.2, 0.16, 0.2), new THREE.Vector3(0.32, 0.05, 0.35), new THREE.Vector3(0.45, 0.01, 0.3), new THREE.Vector3(0.55, 0.01, 0.45)
  ]), 20, 0.012, 6), new THREE.MeshStandardMaterial({ color: 0xd8d0c0 }));
  body.add(lace);

  // torso (a slightly saggy hoodie)
  const torsoGeo = new THREE.CapsuleGeometry(0.42, 0.75, 8, 24);
  const tp = torsoGeo.attributes.position;
  for (let i = 0; i < tp.count; i++) {
    const y = tp.getY(i);
    const k = 1 + (y < 0 ? 0.12 * (-y) : 0) + Math.sin(tp.getX(i) * 9 + y * 7) * 0.015; // belly + wrinkles
    tp.setX(i, tp.getX(i) * k);
    tp.setZ(i, tp.getZ(i) * (k * 0.85 + (tp.getZ(i) > 0 && y < 0 ? 0.08 : 0)));
  }
  torsoGeo.computeVertexNormals();
  const torso = new THREE.Mesh(torsoGeo, hoodie);
  torso.position.y = 1.75;
  torso.castShadow = true;
  body.add(torso);
  const hood = new THREE.Mesh(new THREE.TorusGeometry(0.33, 0.12, 12, 24), hoodie);
  hood.rotation.x = Math.PI / 2 + 0.3;
  hood.position.set(0, 2.32, -0.12);
  body.add(hood);

  // arms
  const makeArm = (side) => {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.5, 2.22, 0);
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.13, 0.5, 6, 12), hoodie);
    upper.position.y = -0.35;
    upper.castShadow = true;
    const elbow = new THREE.Group();
    elbow.position.y = -0.7;
    const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.12, 0.45, 6, 12), hoodie);
    fore.position.y = -0.3;
    fore.castShadow = true;
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.12, 16, 12), skin);
    hand.position.y = -0.65;
    hand.scale.set(1, 1.2, 0.8);
    elbow.add(fore, hand);
    shoulder.add(upper, elbow);
    body.add(shoulder);
    return { shoulder, elbow, hand };
  };
  const armR = makeArm(-1);
  const armL = makeArm(1);

  // coffee mug in the left hand
  const mug = new THREE.Group();
  const mugBody = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.11, 0.24, 20), new THREE.MeshStandardMaterial({ color: 0xbdb5a4, roughness: 0.7 }));
  const mugHandle = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.02, 8, 16), mugBody.material);
  mugHandle.position.x = 0.13;
  mugHandle.rotation.y = Math.PI / 2;
  const coffee = new THREE.Mesh(new THREE.CircleGeometry(0.1, 16), new THREE.MeshStandardMaterial({ color: 0x3b2210, roughness: 0.2 }));
  coffee.rotation.x = -Math.PI / 2;
  coffee.position.y = 0.1;
  mug.add(mugBody, mugHandle, coffee);
  mug.position.set(0, -0.72, 0.08);
  armL.elbow.add(mug);

  // head
  const head = new THREE.Group();
  head.position.y = 2.75;
  body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.36, 32, 24), skin);
  skull.scale.set(0.95, 1.12, 1);
  skull.castShadow = true;
  head.add(skull);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.09, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xe8a08c, roughness: 0.5 }));
  nose.scale.set(0.9, 1, 1.2);
  nose.position.set(0, -0.02, 0.36);
  head.add(nose);
  for (const s of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.SphereGeometry(0.08, 12, 10), skin);
    ear.scale.set(0.5, 1, 0.8);
    ear.position.set(s * 0.34, 0.02, 0);
    head.add(ear);
    // tired, half-closed eyes with bags
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.065, 16, 12), new THREE.MeshPhysicalMaterial({ color: 0xf4efe6, roughness: 0.2, clearcoat: 1 }));
    eye.position.set(s * 0.13, 0.1, 0.3);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.03, 12, 8), new THREE.MeshStandardMaterial({ color: 0x2a1a0c }));
    pupil.position.set(0, -0.012, 0.055);
    eye.add(pupil);
    const lid = new THREE.Mesh(new THREE.SphereGeometry(0.07, 16, 12, 0, Math.PI * 2, 0, Math.PI / 2), skin);
    lid.rotation.x = 0.55;
    eye.add(lid);
    const bag = new THREE.Mesh(new THREE.TorusGeometry(0.055, 0.016, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x9a6a68, roughness: 0.9 }));
    bag.rotation.z = Math.PI;
    bag.position.set(s * 0.13, 0.06, 0.33);
    head.add(eye, bag);
    const brow = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.035, 0.05), hairMat);
    brow.position.set(s * 0.13, 0.21, 0.32);
    brow.rotation.z = s * 0.15;
    head.add(brow);
    head.userData[`lid${s}`] = lid;
  }
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(0.06, 0.015, 8, 16, Math.PI), new THREE.MeshStandardMaterial({ color: 0x6b2b2b }));
  mouth.rotation.z = Math.PI + 0.25;
  mouth.position.set(0.02, -0.15, 0.33);
  head.add(mouth);

  // beard: lumpy displaced half-sphere + scraggly strands
  const beardGeo = new THREE.SphereGeometry(0.37, 32, 20, 0, Math.PI * 2, Math.PI * 0.5, Math.PI * 0.5);
  const bp = beardGeo.attributes.position;
  for (let i = 0; i < bp.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(bp, i);
    const n = 1 + 0.12 * Math.sin(v.x * 30) * Math.cos(v.y * 25) + rand(-0.05, 0.08);
    v.multiplyScalar(n);
    if (v.y < -0.15) v.y *= 1.5; // long chin beard
    bp.setXYZ(i, v.x, v.y, v.z);
  }
  beardGeo.computeVertexNormals();
  const beard = new THREE.Mesh(beardGeo, beardMat);
  beard.position.set(0, -0.02, 0.06);
  beard.scale.set(1, 1, 0.95);
  beard.castShadow = true;
  head.add(beard);

  // long greasy hair: merged tube strands from the scalp down past the shoulders
  const strands = [];
  for (let i = 0; i < 170; i++) {
    const theta = rand(0, Math.PI * 2);
    const phi = rand(0, Math.PI * 0.42);
    const start = new THREE.Vector3(Math.sin(phi) * Math.cos(theta), Math.cos(phi), Math.sin(phi) * Math.sin(theta)).multiplyScalar(0.37);
    start.y *= 1.12;
    if (start.z > 0.2 && start.y < 0.3) continue; // keep the face free
    const out = new THREE.Vector3(start.x, 0, start.z).normalize();
    if (out.z > 0.3) out.z = 0.3; // frontal strands fall to the sides
    const len = rand(0.9, 1.5);
    const pts = [start];
    let p = start.clone();
    for (let k = 1; k <= 6; k++) {
      const t = k / 6;
      p = p.clone().add(new THREE.Vector3(out.x * 0.09 * (1 - t) + rand(-0.04, 0.04), -len / 6, out.z * 0.06 * (1 - t) - 0.015 + rand(-0.04, 0.04)));
      // push strands outside the head/shoulders
      if (p.y > -0.4) {
        const r = Math.hypot(p.x, p.z);
        if (r < 0.4) { p.x *= 0.42 / Math.max(r, 0.01); p.z *= 0.42 / Math.max(r, 0.01); }
      }
      // part the curtain in front of the face
      if (p.y < 0.32 && p.z > -0.08 && Math.abs(p.x) < 0.46) p.x = Math.sign(p.x || 1) * rand(0.46, 0.55);
      pts.push(p);
    }
    strands.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 16, rand(0.012, 0.03), 5));
  }
  const hair = new THREE.Mesh(mergeGeometries(strands), hairMat);
  hair.castShadow = true;
  const hairPivot = new THREE.Group();
  hairPivot.add(hair);
  head.add(hairPivot);
  const scalp = new THREE.Mesh(new THREE.SphereGeometry(0.38, 24, 16, 0, Math.PI * 2, 0, Math.PI * 0.45), hairMat);
  scalp.scale.y = 1.12;
  scalp.rotation.x = -0.2;
  head.add(scalp);

  // flies buzzing around
  const flies = [];
  const flyMat = new THREE.MeshBasicMaterial({ color: 0x111111 });
  const wingMat = new THREE.MeshBasicMaterial({ color: 0xcfe8ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide });
  for (let i = 0; i < 4; i++) {
    const f = new THREE.Group();
    f.add(new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), flyMat));
    for (const s of [-1, 1]) {
      const w = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.025), wingMat);
      w.position.set(s * 0.025, 0.01, 0);
      f.add(w);
    }
    root.add(f);
    flies.push({ f, r: rand(0.5, 0.9), s: rand(2, 4), o: rand(0, 6), y: rand(2.2, 3.1) });
  }

  return { root, body, head, hairPivot, armR, armL, mug, flies };
}
