/**
 * The dream acts that play inside the TV. Each is a small, self-lit world with
 * a slot for Bigfoot and a camera framing; DreamTvSystem renders the active one
 * into the TV screen. Bright, playful and readable from across the room.
 */
import {
  BoxGeometry,
  BufferAttribute,
  CanvasTexture,
  CapsuleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  DoubleSide,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  SphereGeometry,
  SRGBColorSpace,
  Texture,
  TorusGeometry,
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

export function surfScene(skyline: Texture | null): DreamTvScene {
  const scene = baseScene(['#14204f', '#5a7cc4'], skyline, 2.5);
  const seaGeo = new PlaneGeometry(40, 40, 60, 60);
  seaGeo.rotateX(-Math.PI / 2);
  const sea = new Mesh(seaGeo, new MeshStandardMaterial({ color: 0x2f6fc4, roughness: 0.18, metalness: 0.1 }));
  scene.add(sea);
  const base = (seaGeo.getAttribute('position') as BufferAttribute).array.slice() as Float32Array;
  // The big curling wave behind him: a part-tube of deep blue with a white crest.
  const wave = new Mesh(
    new CylinderGeometry(2.2, 2.2, 14, 40, 1, true, Math.PI * 0.95, Math.PI * 1.1),
    new MeshStandardMaterial({ color: 0x3f8be0, roughness: 0.25, side: DoubleSide, emissive: new Color(0x0b3a7a), emissiveIntensity: 0.4 }),
  );
  wave.rotation.z = Math.PI / 2;
  wave.position.set(0, 1.6, -3.2);
  const crest = new Mesh(new TorusGeometry(2.2, 0.16, 8, 48, Math.PI * 0.5), new MeshStandardMaterial({ color: 0xf4fbff, roughness: 0.6 }));
  crest.rotation.set(0, Math.PI / 2, Math.PI * 0.55);
  crest.position.set(0, 1.6, -3.2);
  crest.scale.set(1, 1, 3.2);
  scene.add(wave, crest);
  const board = new Mesh(new CapsuleGeometry(0.22, 1.5, 6, 12), new MeshStandardMaterial({ color: 0xff7a59, roughness: 0.35 }));
  board.rotation.z = Math.PI / 2;
  board.scale.set(1, 1, 0.25);
  const slot = new Group();
  const rider = new Group();
  rider.add(board);
  board.position.y = 0.05;
  rider.add(slot);
  slot.position.y = 0.12;
  scene.add(rider);
  const spray = sparkles(140, 0.08, 0xffffff, [3, 1.2, 1.5], [0, 0.6, 0]);
  rider.add(spray);
  return {
    key: 'surf', scene, slot, eye: [0, 1.8, 6.2], target: [0, 1.0, -0.5], pose: 'idle',
    update(t) {
      const pos = seaGeo.getAttribute('position') as BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        const x = base[i * 3];
        const z = base[i * 3 + 2];
        pos.setY(i, Math.sin(x * 0.6 + t * 1.6) * 0.18 + Math.sin(z * 0.9 - t * 1.2) * 0.12);
      }
      pos.needsUpdate = true;
      rider.position.set(Math.sin(t * 0.7) * 2.2, 0.25 + Math.sin(t * 1.6) * 0.12, Math.sin(t * 1.4) * 0.5);
      rider.rotation.set(Math.sin(t * 1.6) * 0.08, Math.cos(t * 0.7) * 0.5, Math.sin(t * 1.4) * 0.12);
      spray.rotation.y = t;
    },
  };
}

function gridTexture(line: string, bg: string): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = bg;
    g.fillRect(0, 0, 128, 128);
    g.strokeStyle = line;
    g.lineWidth = 3;
    g.strokeRect(0, 0, 128, 128);
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

export function djScene(skyline: Texture | null): DreamTvScene {
  const scene = baseScene(['#1a0b2e', '#4a1f5c'], skyline, 2);
  const floorTex = gridTexture('#ff5fb8', '#17141f');
  floorTex.repeat.set(14, 14);
  const floor = new Mesh(new PlaneGeometry(20, 20), new MeshStandardMaterial({ map: floorTex, roughness: 0.4, emissive: new Color(0x3a0f2a), emissiveIntensity: 0.6 }));
  floor.rotation.x = -Math.PI / 2;
  scene.add(floor);
  const booth = new Mesh(new BoxGeometry(1.8, 0.95, 0.7), new MeshStandardMaterial({ color: 0x15131c, roughness: 0.5 }));
  booth.position.set(0, 0.475, 0.2);
  const panel = new Mesh(new PlaneGeometry(1.7, 0.6), new MeshBasicMaterial({ color: 0xff5fb8 }));
  panel.position.set(0, 0.5, 0.551);
  scene.add(booth, panel);
  const decks: Mesh[] = [];
  for (const x of [-0.5, 0.5]) {
    const d = new Mesh(new CylinderGeometry(0.22, 0.22, 0.04, 32), new MeshStandardMaterial({ color: 0x222028, emissive: new Color(0x35e0ff), emissiveIntensity: 0.6 }));
    d.position.set(x, 0.97, 0.2);
    scene.add(d);
    decks.push(d);
  }
  // String lights along two sagging strands, and sweeping colored beams.
  const bulbGeo = new SphereGeometry(0.05, 8, 6);
  const bulbColors = [0xffd27a, 0xff5fb8, 0x35e0ff, 0xb38bff];
  const bulbs: Mesh[] = [];
  for (const z of [-2.5, -4.5]) {
    for (let i = 0; i <= 18; i++) {
      const x = -6 + i * (12 / 18);
      const b = new Mesh(bulbGeo, new MeshBasicMaterial({ color: bulbColors[i % 4] }));
      b.position.set(x, 3.4 - Math.cos((x / 6) * (Math.PI / 2)) * 0.6, z);
      scene.add(b);
      bulbs.push(b);
    }
  }
  const beams: Mesh[] = [];
  for (const [x, color] of [[-3, 0xff5fb8], [0, 0x35e0ff], [3, 0xffd27a]] as const) {
    const beam = new Mesh(
      new ConeGeometry(0.9, 7, 24, 1, true),
      new MeshBasicMaterial({ color, transparent: true, opacity: 0.18, depthWrite: false, side: DoubleSide }),
    );
    beam.geometry.translate(0, -3.5, 0);
    beam.position.set(x, 6.5, -3);
    scene.add(beam);
    beams.push(beam);
  }
  const confetti = sparkles(220, 0.07, 0xffd27a, [10, 6, 6], [0, 3, -1]);
  scene.add(confetti);
  const slot = new Group();
  slot.position.set(0, 0, -0.45);
  scene.add(slot);
  return {
    key: 'dj', scene, slot, eye: [0, 2.0, 5.6], target: [0, 1.2, 0], pose: 'dance',
    update(t) {
      decks.forEach((d, i) => (d.rotation.y = t * (i ? -3 : 3)));
      const beat = Math.floor(t * 2.2);
      (panel.material as MeshBasicMaterial).color.setHex(bulbColors[beat % 4]);
      bulbs.forEach((b, i) => b.scale.setScalar((beat + i) % 3 === 0 ? 1.6 : 1));
      beams.forEach((b, i) => (b.rotation.z = Math.sin(t * 1.3 + i * 2) * 0.6));
      confetti.position.y = 2 - ((t * 0.6) % 4);
    },
  };
}

function windowsTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 512;
  const g = c.getContext('2d');
  if (g) {
    g.fillStyle = '#1c2236';
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
  return t;
}

export function skiScene(skyline: Texture | null): DreamTvScene {
  const scene = baseScene(['#0a1430', '#33507a'], skyline, -6);
  const snowMat = new MeshStandardMaterial({ color: 0xf3f7ff, roughness: 0.9, emissive: new Color(0x9fb8ff), emissiveIntensity: 0.12 });
  const slope = new Mesh(new PlaneGeometry(5, 34), snowMat);
  slope.rotation.x = -Math.PI / 2 + 0.38;
  slope.position.set(0, 2.5, -6);
  scene.add(slope);
  const tower = new Mesh(new BoxGeometry(5, 30, 5), new MeshStandardMaterial({ map: windowsTexture(), emissive: new Color(0xffffff), emissiveMap: windowsTexture(), emissiveIntensity: 0.7, roughness: 0.6 }));
  tower.position.set(-5.4, 2, -10);
  const tower2 = tower.clone();
  tower2.position.set(5.6, 0, -14);
  const moon = new Mesh(new SphereGeometry(1.4, 24, 16), new MeshBasicMaterial({ color: 0xfff2d0 }));
  moon.position.set(4, 9, -20);
  scene.add(tower, tower2, moon);
  const snow = sparkles(300, 0.06, 0xffffff, [14, 10, 12], [0, 4, -4]);
  scene.add(snow);
  const skier = new Group();
  const skiMat = new MeshStandardMaterial({ color: 0x35e0ff, roughness: 0.3 });
  for (const x of [-0.18, 0.18]) {
    const ski = new Mesh(new BoxGeometry(0.1, 0.03, 1.5), skiMat);
    ski.position.set(x, 0.02, 0);
    skier.add(ski);
  }
  const slot = new Group();
  slot.position.y = 0.03;
  skier.add(slot);
  scene.add(skier);
  const tilt = 0.38;
  return {
    key: 'ski', scene, slot, eye: [0, 2.2, 6.4], target: [0, 1.2, -1], pose: 'idle',
    update(t) {
      const k = (t * 0.16) % 1;
      const along = -14 + k * 20;
      skier.position.set(Math.sin(t * 1.8) * 1.2, 2.5 - along * Math.sin(tilt) + 0.05, -6 + along * Math.cos(tilt));
      skier.rotation.set(tilt, Math.cos(t * 1.8) * 0.5, -Math.sin(t * 1.8) * 0.25);
      snow.position.y = -((t * 0.5) % 5);
    },
  };
}
