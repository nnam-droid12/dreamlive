/**
 * Ski act: Bigfoot carves down a snow-covered skyscraper roof high above
 * Manhattan. He stays close to the camera while the run scrolls past: the snow
 * (with its grooming lines) slides toward us, slalom gates rush by, the tower's
 * lit flanks drop away on both sides, and snow falls.
 */
import {
  CanvasTexture,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
} from '@iwsdk/core';
import { buildSkis } from '../scene-assets/skis.scene-asset.js';
import { baseScene, DreamTvScene, sparkles } from './common.js';

const TILT = 0.32;
const RUN_LENGTH = 30;
const SPEED = 6;
const GATES = 8;

/** Groomed snow: soft white with faint corduroy lines and two ski tracks. */
function snowTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#f4f7ff';
    g.fillRect(0, 0, 256, 256);
    g.fillStyle = 'rgba(160, 180, 220, 0.18)';
    for (let x = 0; x < 256; x += 8) g.fillRect(x, 0, 3, 256);
    g.fillStyle = 'rgba(120, 140, 190, 0.25)';
    g.fillRect(100, 0, 6, 256);
    g.fillRect(150, 0, 6, 256);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(2, 6);
  return t;
}

/** A tall lit facade (canvas windows), for the tower's flanks and the city around. */
export function facadeTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#1a2034';
    g.fillRect(0, 0, 128, 512);
    for (let y = 6; y < 512; y += 16) {
      for (let x = 6; x < 128; x += 14) {
        g.fillStyle = (x * 7 + y * 13) % 5 < 2 ? '#ffd88a' : '#2b3550';
        g.fillRect(x, y, 8, 10);
      }
    }
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

export function skiScene(skyline: Texture | null): DreamTvScene {
  const scene = baseScene(['#081230', '#2f4a78'], skyline, -10);
  // The run: a frame tilted so "uphill" rises away from the camera (-Z).
  const run = new Group();
  run.rotation.x = TILT;
  scene.add(run);
  const snowMap = snowTexture();
  const snowMat = new MeshStandardMaterial({ map: snowMap, roughness: 0.9, emissive: new Color(0x9fb8ff), emissiveIntensity: 0.1 });
  const slope = new Mesh(new PlaneGeometry(6, RUN_LENGTH), snowMat);
  slope.rotation.x = -Math.PI / 2;
  slope.position.z = 4 - RUN_LENGTH / 2;
  run.add(slope);

  // The tower's lit flanks fall away below both edges; snow lips along the edges.
  const facade = facadeTexture();
  facade.repeat.set(RUN_LENGTH / 6, 30 / 24);
  const flankMat = new MeshStandardMaterial({ map: facade, emissiveMap: facade, emissive: new Color(0xffffff), emissiveIntensity: 0.75, roughness: 0.6 });
  const lipMat = new MeshStandardMaterial({ color: 0xf4f7ff, roughness: 0.95 });
  for (const s of [-1, 1]) {
    const flank = new Mesh(new PlaneGeometry(RUN_LENGTH, 30), flankMat);
    flank.rotation.y = -s * Math.PI / 2;
    flank.position.set(s * 3, -15, slope.position.z);
    const lip = new Mesh(new CylinderGeometry(0.16, 0.16, RUN_LENGTH, 10), lipMat);
    lip.rotation.x = Math.PI / 2;
    lip.position.set(s * 3, 0.04, slope.position.z);
    run.add(flank, lip);
  }

  // Slalom gates rush past (instanced poles and flags, red/blue alternating).
  const poles = new InstancedMesh(new CylinderGeometry(0.025, 0.025, 1.6, 8).translate(0, 0.8, 0), new MeshStandardMaterial({ roughness: 0.4 }), GATES);
  const flags = new InstancedMesh(new ConeGeometry(0.28, 0.5, 3).rotateZ(-Math.PI / 2).scale(1, 1, 0.08).translate(0.25, 1.35, 0), new MeshStandardMaterial({ roughness: 0.6 }), GATES);
  const col = new Color();
  for (let i = 0; i < GATES; i++) {
    col.setHex(i % 2 ? 0x3d7bff : 0xff3d5a);
    poles.setColorAt(i, col);
    flags.setColorAt(i, col);
  }
  run.add(poles, flags);

  // City towers around, and the moon.
  for (const [x, z, h] of [[-9, -18, 26], [10, -22, 32], [-14, -30, 40], [15, -12, 18]] as const) {
    const tower = new Mesh(new PlaneGeometry(6, h), flankMat);
    tower.position.set(x, h / 2 - 22, z);
    scene.add(tower);
  }
  const moon = new Mesh(new SphereGeometry(1.4, 24, 16), new MeshBasicMaterial({ color: 0xfff2d0 }));
  moon.position.set(5, 11, -24);
  scene.add(moon);
  const snow = sparkles(320, 0.05, 0xffffff, [12, 8, 10], [0, 3, -3]);
  scene.add(snow);

  // Bigfoot on skis, carving in place while the world scrolls.
  const skier = new Group();
  const skis = buildSkis();
  const slot = new Group();
  slot.position.y = 0.075;
  skier.add(skis, slot);
  run.add(skier);
  const m = new Matrix4();
  return {
    key: 'ski', scene, slot, eye: [0, 1.75, 3.7], target: [0, 1.0, -0.6], pose: 'idle',
    update(t) {
      const travel = t * SPEED;
      snowMap.offset.y = -(travel / (RUN_LENGTH / snowMap.repeat.y)) % 1;
      facade.offset.x = (travel / 6) % 1;
      for (let i = 0; i < GATES; i++) {
        const z = 4 - (((i / GATES) * RUN_LENGTH - travel) % RUN_LENGTH + RUN_LENGTH) % RUN_LENGTH;
        m.makeTranslation(i % 2 ? 1.3 : -1.3, 0, z);
        poles.setMatrixAt(i, m);
        flags.setMatrixAt(i, m);
      }
      poles.instanceMatrix.needsUpdate = flags.instanceMatrix.needsUpdate = true;
      const carve = Math.sin(t * 1.6);
      skier.position.set(carve * 0.8, 0, 0);
      skier.rotation.set(0, Math.cos(t * 1.6) * 0.35, -carve * 0.2);
      snow.position.y = -((t * 0.7) % 4);
    },
  };
}
