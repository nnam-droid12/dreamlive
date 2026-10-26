/**
 * DJ act: a rooftop party high above Manhattan. Bigfoot spins behind a real DJ
 * booth; a crowd of silhouettes bounces in the foreground on the beat; string
 * lights sag between poles; lasers sweep the night. Repeated parts are instanced.
 */
import {
  AdditiveBlending,
  CapsuleGeometry,
  Color,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  Quaternion,
  SphereGeometry,
  Texture,
  Vector3,
} from '@iwsdk/core';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { buildDjBooth } from '../scene-assets/dj-booth.scene-asset.js';
import { bevelBox } from '../scene-assets/lib/hardsurface.js';
import { baseScene, DreamTvScene, sparkles } from './common.js';

const BPM = 120;
const CROWD = 34;
const BULB_COLORS = [0xffd27a, 0xff5fb8, 0x35e0ff, 0xb38bff];

/** One partygoer, origin at the feet; `armsUp` adds raised arms. */
function personGeometry(armsUp: boolean) {
  const parts = [new CapsuleGeometry(0.2, 0.62, 4, 10).translate(0, 0.62, 0), new SphereGeometry(0.13, 12, 8).translate(0, 1.32, 0)];
  if (armsUp) {
    for (const s of [-1, 1]) parts.push(new CapsuleGeometry(0.05, 0.5, 3, 6).rotateZ(-s * 0.35).translate(s * 0.28, 1.45, 0));
  }
  return mergeGeometries(parts)!;
}

export function djScene(skyline: Texture | null): DreamTvScene {
  const scene = baseScene(['#14082a', '#4a1f5c'], skyline, -1.5);
  const roof = new Mesh(new PlaneGeometry(24, 16), new MeshStandardMaterial({ color: 0x2a2630, roughness: 0.85 }));
  roof.rotation.x = -Math.PI / 2;
  scene.add(roof);
  // The parapet at the roof edge, the city glowing beyond and below.
  const parapet = new Mesh(bevelBox(24, 0.9, 0.3, 0.03), new MeshStandardMaterial({ color: 0x3a3542, roughness: 0.7 }));
  parapet.position.set(0, 0.45, -4.5);
  scene.add(parapet);

  const booth = buildDjBooth();
  booth.position.set(0, 0, 0.1);
  scene.add(booth);
  const platters: Object3D[] = [];
  booth.traverse((o) => {
    if (o.name === 'Platter') platters.push(o);
  });

  // String lights: sagging strands of bulbs between the roof poles (one draw call).
  const strands = [-3.6, -3.9];
  const perStrand = 22;
  const bulbs = new InstancedMesh(new SphereGeometry(0.05, 8, 6), new MeshBasicMaterial(), strands.length * perStrand);
  const m = new Matrix4();
  const color = new Color();
  let n = 0;
  for (const z of strands) {
    for (let i = 0; i < perStrand; i++) {
      const x = -6 + (12 * i) / (perStrand - 1);
      m.makeTranslation(x, 3.3 - Math.cos((x / 6) * (Math.PI / 2)) * 0.7, z);
      bulbs.setMatrixAt(n, m);
      bulbs.setColorAt(n, color.setHex(BULB_COLORS[i % 4]));
      n++;
    }
  }
  scene.add(bulbs);

  // Lasers: thin additive beams from behind the booth, sweeping the sky.
  const lasers: Mesh[] = [];
  const laserGeo = new CylinderGeometry(0.012, 0.012, 14, 6, 1, true).translate(0, 7, 0);
  for (let i = 0; i < 6; i++) {
    const beam = new Mesh(laserGeo, new MeshBasicMaterial({ color: BULB_COLORS[(i + 1) % 4], transparent: true, opacity: 0.8, blending: AdditiveBlending, depthWrite: false }));
    beam.position.set(-1.5 + (i % 3) * 1.5, 1.2, -1.2);
    scene.add(beam);
    lasers.push(beam);
  }

  // The crowd: dark silhouettes in the foreground, half with arms up, bouncing on the beat.
  const crowdMat = new MeshStandardMaterial({ color: 0x120e1a, roughness: 0.9, emissive: new Color(0x2a0f3a), emissiveIntensity: 0.6 });
  const groups = [new InstancedMesh(personGeometry(false), crowdMat, CROWD / 2), new InstancedMesh(personGeometry(true), crowdMat, CROWD / 2)];
  const spots: Array<{ x: number; z: number; s: number; phase: number }> = [];
  for (let i = 0; i < CROWD; i++) {
    const row = i % 3;
    // Keep a clear lane in the middle so the camera sees Bigfoot over the crowd.
    const u = ((i * 0.618) % 1) * 2 - 1;
    spots.push({
      x: Math.sign(u || 1) * (0.9 + Math.abs(u) * 2.8),
      z: 2.3 + row * 0.5 + ((i * 0.37) % 1) * 0.2,
      s: 0.78 + ((i * 0.53) % 1) * 0.14,
      phase: ((i * 0.29) % 1) * 0.5,
    });
  }
  groups.forEach((g) => scene.add(g));
  const pos = new Vector3();
  const quat = new Quaternion();
  const scl = new Vector3();

  const confetti = sparkles(220, 0.06, 0xffd27a, [10, 6, 6], [0, 3, -1]);
  scene.add(confetti);
  const slot = new Group();
  slot.position.set(0, 0, -0.55);
  scene.add(slot);

  return {
    key: 'dj', scene, slot, eye: [0, 2.3, 4.3], target: [0, 1.35, -0.4], pose: 'dance',
    update(t) {
      const beats = (t * BPM) / 60;
      const hit = Math.pow(1 - (beats % 1), 4);
      platters.forEach((p, i) => (p.rotation.y = t * (i ? -3.5 : 3.5)));
      lasers.forEach((b, i) => {
        b.rotation.z = Math.sin(t * 0.9 + i * 1.3) * 0.9;
        b.rotation.x = -0.35 + Math.sin(t * 0.7 + i) * 0.25;
        (b.material as MeshBasicMaterial).opacity = 0.35 + 0.6 * hit;
      });
      (bulbs.material as MeshBasicMaterial).color.setScalar(0.7 + 0.3 * hit);
      for (let i = 0; i < CROWD; i++) {
        const s = spots[i];
        const bounce = Math.abs(Math.sin((beats + s.phase) * Math.PI)) * 0.12;
        pos.set(s.x, bounce, s.z);
        quat.identity();
        scl.setScalar(s.s);
        m.compose(pos, quat, scl);
        groups[i % 2].setMatrixAt(i >> 1, m);
      }
      groups.forEach((g) => (g.instanceMatrix.needsUpdate = true));
      confetti.position.y = 2 - ((t * 0.6) % 4);
    },
  };
}
