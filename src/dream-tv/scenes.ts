/**
 * The intro world that plays inside the TV (the acts live in surf.ts, dj.ts,
 * ski.ts). Each world is a small, self-lit world with
 * a slot for Bigfoot and a camera framing; DreamTvSystem renders the active one
 * into the TV screen. Bright, playful and readable from across the room.
 */
import {
  Color,
  Group,
  Mesh,
  MeshStandardMaterial,
  SphereGeometry,
  Texture,
} from '@iwsdk/core';
import { baseScene, DreamTvScene, sparkles } from './common.js';

const cloudMat = new MeshStandardMaterial({ color: 0xf6f4ff, roughness: 1, emissive: new Color(0x9fb8ff), emissiveIntensity: 0.18 });

function cloud(scale: number): Group {
  const g = new Group();
  const geo = new SphereGeometry(1, 20, 14);
  const puffs: Array<[number, number, number, number]> = [
    [0, 0, 0, 0.55], [0.55, -0.05, 0.1, 0.42], [-0.55, -0.05, 0, 0.45], [0.2, 0.25, -0.1, 0.4], [-0.25, 0.2, 0.15, 0.38],
  ];
  for (const [x, y, z, r] of puffs) {
    const m = new Mesh(geo, cloudMat);
    m.position.set(x * scale, y * scale, z * scale);
    m.scale.set(r * scale * 1.3, r * scale * 0.8, r * scale);
    g.add(m);
  }
  return g;
}

export function introScene(skyline: Texture | null): DreamTvScene {
  const scene = baseScene(['#0b1030', '#3b3f78'], skyline, 1.5);
  const platform = cloud(1.3);
  platform.position.y = -0.1;
  scene.add(platform);
  const drifting: Group[] = [];
  for (const [x, y, z, s] of [[-4, 2.4, -6, 1], [4.5, 3.2, -8, 1.3], [-6, 0.8, -10, 1.6]] as const) {
    const c = cloud(s);
    c.position.set(x, y, z);
    scene.add(c);
    drifting.push(c);
  }
  const stars = sparkles(260, 0.06, 0xfff8e8, [16, 8, 10], [0, 3, -6]);
  scene.add(stars);
  const slot = new Group();
  slot.position.set(0, 0.32, 0);
  scene.add(slot);
  return {
    key: 'intro', scene, slot, eye: [0, 1.4, 5.2], target: [0, 1.1, 0], pose: 'wave',
    update(t) {
      platform.position.y = -0.1 + Math.sin(t * 0.8) * 0.05;
      slot.position.y = 0.32 + Math.sin(t * 0.8) * 0.05;
      drifting.forEach((c, i) => (c.position.x += Math.sin(t * 0.2 + i) * 0.003));
      stars.rotation.y = t * 0.02;
    },
  };
}
