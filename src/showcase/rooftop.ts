/**
 * The Rooftop Party world: the neighbouring high-rise across the street with a
 * DJ party on its roof, the street far below, and filler towers around. Built
 * in the window frame (see rooftop-layout.ts) so the same world stands outside
 * the showcase glass or beyond the headset's dream window. Repeats are instanced.
 */
import {
  AdditiveBlending,
  BoxGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  Group,
  InstancedMesh,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  PointLight,
  Quaternion,
  SphereGeometry,
  Vector3,
} from '@iwsdk/core';
import { personGeometry } from '../dream-tv/dj.js';
import { facadeTexture } from '../dream-tv/ski.js';
import { buildDjBooth } from '../scene-assets/dj-booth.scene-asset.js';
import { bevelBox } from '../scene-assets/lib/hardsurface.js';
import { Rooftop } from './rooftop-layout.js';

const B = Rooftop.building;
const CROWD = 40;
const STREET_CROWD = 60;
const BULB_COLORS = [0xffd27a, 0xff5fb8, 0x35e0ff, 0xb38bff];

export interface RooftopWorld {
  /** Root in window-frame coordinates (place it on the frame). */
  root: Group;
  /** Turntable platters, to spin. */
  platters: Object3D[];
  /** The colored party light over the booth. */
  light: PointLight;
  /** Tints the lasers, dance floor and light (the chosen song's palette). */
  setPalette(colors: readonly number[]): void;
  /** Per frame: beat phase 0..1 (1 = on the kick), party energy 0..1, time. */
  update(t: number, beat: number, energy: number): void;
}

function tower(w: number, d: number, h: number, mat: MeshStandardMaterial): Mesh {
  const m = new Mesh(new BoxGeometry(w, h, d), mat);
  m.position.y = h / 2;
  return m;
}

export function buildRooftop(): RooftopWorld {
  const root = new Group();
  root.name = 'RooftopParty';
  const facade = facadeTexture();
  facade.repeat.set(4, 10);
  const facadeMat = new MeshStandardMaterial({ map: facade, emissiveMap: facade, emissive: new Color(0xffffff), emissiveIntensity: 0.55, roughness: 0.7 });
  const concrete = new MeshStandardMaterial({ color: 0x3a3740, roughness: 0.9 });
  const trim = new MeshStandardMaterial({ color: 0x2a2730, roughness: 0.6 });

  // The neighbouring high-rise: walls with lit windows from the street up to the roof.
  const w = B.farX - B.nearX;
  const d = B.maxZ - B.minZ;
  const body = tower(w, d, B.roofY - B.baseY, facadeMat);
  body.position.set((B.nearX + B.farX) / 2, B.baseY + (B.roofY - B.baseY) / 2, (B.minZ + B.maxZ) / 2);
  root.add(body);
  const roof = new Mesh(new BoxGeometry(w, 0.3, d), concrete);
  roof.position.set(body.position.x, B.roofY - 0.15, body.position.z);
  root.add(roof);
  // Parapet: low on the street side so the party shows, taller elsewhere.
  for (const [x, z, pw, pd, ph] of [
    [B.nearX + 0.12, (B.minZ + B.maxZ) / 2, 0.25, d, 0.55],
    [B.farX - 0.12, (B.minZ + B.maxZ) / 2, 0.25, d, 1.1],
    [(B.nearX + B.farX) / 2, B.minZ + 0.12, w, 0.25, 1.1],
    [(B.nearX + B.farX) / 2, B.maxZ - 0.12, w, 0.25, 1.1],
  ] as const) {
    const p = new Mesh(bevelBox(pw, ph, pd, 0.02), trim);
    p.position.set(x, B.roofY + ph / 2, z);
    root.add(p);
  }

  // A classic wooden water tower at the far corner.
  const wood = new MeshStandardMaterial({ color: 0x6b4a32, roughness: 0.85 });
  const tank = new Group();
  const barrel = new Mesh(new CylinderGeometry(1.3, 1.3, 2.4, 20), wood);
  barrel.position.y = 3.6;
  const cap = new Mesh(new ConeGeometry(1.45, 1.0, 20), wood);
  cap.position.y = 5.3;
  tank.add(barrel, cap);
  for (const [lx, lz] of [[-0.9, -0.9], [0.9, -0.9], [-0.9, 0.9], [0.9, 0.9]]) {
    const leg = new Mesh(new CylinderGeometry(0.07, 0.07, 2.4, 6), trim);
    leg.position.set(lx, 1.2, lz);
    tank.add(leg);
  }
  tank.position.set(B.farX - 3, B.roofY, B.minZ + 3);
  root.add(tank);

  // The stage at the far side of the roof, and the DJ booth on it facing the window (-x).
  const S = Rooftop.stage;
  const stage = new Mesh(bevelBox(S.x1 - S.x0, S.height, S.z1 - S.z0, 0.03), trim);
  stage.position.set((S.x0 + S.x1) / 2, B.roofY + S.height / 2, (S.z0 + S.z1) / 2);
  root.add(stage);
  const booth = buildDjBooth();
  booth.rotation.y = -Math.PI / 2;
  booth.position.copy(Rooftop.booth);
  root.add(booth);
  const platters: Object3D[] = [];
  booth.traverse((o) => {
    if (o.name === 'Platter') platters.push(o);
  });
  // Dance floor: glowing tiles between the near edge and the stage (one draw call).
  const C = Rooftop.crowd;
  const tiles = new InstancedMesh(new BoxGeometry(0.58, 0.04, 0.68), new MeshBasicMaterial(), 36);
  const m = new Matrix4();
  const tilePos: Vector3[] = [];
  for (let i = 0; i < 6; i++) {
    for (let j = 0; j < 6; j++) {
      const p = new Vector3(C.x0 + (C.x1 - C.x0) * ((i + 0.5) / 6), B.roofY + 0.02, C.z0 + (C.z1 - C.z0) * ((j + 0.5) / 6));
      tilePos.push(p);
      m.makeTranslation(p.x, p.y, p.z);
      tiles.setMatrixAt(i * 6 + j, m);
    }
  }
  root.add(tiles);

  // The crowd on the dance floor, facing the DJ.
  const crowdMat = new MeshStandardMaterial({ color: 0x151020, roughness: 0.9, emissive: new Color(0x3a1450), emissiveIntensity: 0.7 });
  const crowd = [new InstancedMesh(personGeometry(false), crowdMat, CROWD / 2), new InstancedMesh(personGeometry(true), crowdMat, CROWD / 2)];
  crowd.forEach((c) => root.add(c));
  const spots = Array.from({ length: CROWD }, (_, i) => ({
    p: new Vector3(C.x0 + ((i * 0.618) % 1) * (C.x1 - C.x0), B.roofY, C.z0 + ((i * 0.377) % 1) * (C.z1 - C.z0)),
    s: 0.85 + ((i * 0.53) % 1) * 0.2,
    phase: ((i * 0.29) % 1) * 0.5,
  }));
  // Everyone faces the stage (+x).
  const faceDj = new Quaternion().setFromAxisAngle(new Vector3(0, 1, 0), Math.PI / 2);

  // String lights criss-crossing above the party.
  const strands = 3;
  const perStrand = 20;
  const bulbs = new InstancedMesh(new SphereGeometry(0.06, 8, 6), new MeshBasicMaterial(), strands * perStrand);
  const color = new Color();
  for (let s = 0; s < strands; s++) {
    const a = new Vector3(B.nearX + 1, B.roofY + 3.2, B.maxZ - 2 - s * 4);
    const b = new Vector3(B.farX - 2, B.roofY + 3.2, B.minZ + 4 + s * 3);
    for (let i = 0; i < perStrand; i++) {
      const k = i / (perStrand - 1);
      const p = new Vector3().lerpVectors(a, b, k);
      p.y -= Math.sin(k * Math.PI) * 0.9;
      m.makeTranslation(p.x, p.y, p.z);
      bulbs.setMatrixAt(s * perStrand + i, m);
      bulbs.setColorAt(s * perStrand + i, color.setHex(BULB_COLORS[i % 4]));
    }
  }
  root.add(bulbs);

  // Lasers from behind the booth, and the party light.
  const lasers: Mesh[] = [];
  const laserGeo = new CylinderGeometry(0.02, 0.02, 30, 6, 1, true).translate(0, 15, 0);
  for (let i = 0; i < 6; i++) {
    const beam = new Mesh(laserGeo, new MeshBasicMaterial({ color: BULB_COLORS[i % 4], transparent: true, opacity: 0.7, blending: AdditiveBlending, depthWrite: false }));
    beam.position.set(S.x1 - 0.3, B.roofY + S.height + 0.3, S.z0 + (S.z1 - S.z0) * ((i + 0.5) / 6));
    root.add(beam);
    lasers.push(beam);
  }
  // A warm key light on the DJ, so Bigfoot reads clearly against the night.
  const key = new PointLight(0xffe2c4, 9, 7, 1.4);
  key.position.set(Rooftop.djSpot.x - 2.2, Rooftop.djSpot.y + 2.6, Rooftop.djSpot.z + 0.6);
  root.add(key);
  const light = new PointLight(0xff5fb8, 0, 24, 1.2);
  light.position.set((C.x0 + C.x1) / 2, B.roofY + 4, (C.z0 + C.z1) / 2);
  root.add(light);

  // Filler towers around, so the gap reads as a Manhattan street canyon.
  for (const [x, z, tw, td, top] of [
    [B.nearX + 4, B.minZ - 9, 10, 8, -3],
    [B.farX + 8, (B.minZ + B.maxZ) / 2, 9, 14, -4],
  ] as const) {
    const t = tower(tw, td, top - B.baseY, facadeMat);
    t.position.set(x, B.baseY + (top - B.baseY) / 2, z);
    root.add(t);
  }
  // Our own building's face below the window, and the ledge he steps onto.
  const ownFace = new Mesh(new PlaneGeometry(40, -B.baseY), facadeMat);
  ownFace.rotation.y = Math.PI / 2;
  ownFace.position.set(0.02, B.baseY / 2 - 0.2, 0);
  const ledge = new Mesh(bevelBox(Rooftop.ledge.depth, 0.18, Rooftop.bay.width + 0.2, 0.02), concrete);
  ledge.name = 'Ledge';
  ledge.position.set(Rooftop.ledge.depth / 2, -0.09, 0);
  root.add(ownFace, ledge);

  // The street ("ground floor") far below: asphalt, lamps, and a crowd looking up.
  const street = new Mesh(new PlaneGeometry(60, 120), new MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.95 }));
  street.rotation.x = -Math.PI / 2;
  street.position.set((Rooftop.street.x0 + Rooftop.street.x1) / 2, B.baseY, -10);
  root.add(street);
  const lamps = new InstancedMesh(new SphereGeometry(0.25, 8, 6), new MeshBasicMaterial({ color: 0xffd8a0 }), 12);
  for (let i = 0; i < 12; i++) {
    m.makeTranslation(i % 2 ? Rooftop.street.x1 : Rooftop.street.x0, B.baseY + 5, -30 + i * 5);
    lamps.setMatrixAt(i, m);
  }
  root.add(lamps);
  const streetCrowd = new InstancedMesh(personGeometry(true), crowdMat, STREET_CROWD);
  for (let i = 0; i < STREET_CROWD; i++) {
    const x = Rooftop.street.x0 + ((i * 0.618) % 1) * (Rooftop.street.x1 - Rooftop.street.x0);
    m.makeTranslation(x, B.baseY, -8 + ((i * 0.377) % 1) * 12);
    streetCrowd.setMatrixAt(i, m);
  }
  root.add(streetCrowd);

  const pos = new Vector3();
  const scl = new Vector3();
  const tile = new Color();
  let palette: readonly number[] = BULB_COLORS;
  return {
    root,
    platters,
    light,
    setPalette(colors) {
      palette = colors;
      lasers.forEach((l, i) => (l.material as MeshBasicMaterial).color.setHex(colors[i % colors.length]));
    },
    update(t, beat, energy) {
      const hit = Math.pow(beat, 4);
      platters.forEach((p, i) => (p.rotation.y = t * (i ? -3.5 : 3.5)));
      for (let i = 0; i < CROWD; i++) {
        const s = spots[i];
        pos.copy(s.p).setY(B.roofY + Math.abs(Math.sin((t * 2 + s.phase) * Math.PI)) * 0.12 * (0.3 + energy));
        scl.setScalar(s.s);
        m.compose(pos, faceDj, scl);
        crowd[i % 2].setMatrixAt(i >> 1, m);
      }
      crowd.forEach((c) => (c.instanceMatrix.needsUpdate = true));
      const step = Math.floor(t * 2);
      for (let i = 0; i < tilePos.length; i++) {
        tiles.setColorAt(i, tile.setHex(palette[(i + step) % palette.length]).multiplyScalar(0.25 + 0.75 * energy * ((i + step) % 3 === 0 ? 1 : 0.35)));
      }
      if (tiles.instanceColor) tiles.instanceColor.needsUpdate = true;
      lasers.forEach((b, i) => {
        b.visible = energy > 0.05;
        b.rotation.z = Math.sin(t * 0.9 + i * 1.3) * 0.7;
        b.rotation.x = Math.sin(t * 0.7 + i) * 0.4;
        (b.material as MeshBasicMaterial).opacity = (0.25 + 0.6 * hit) * energy;
      });
      light.color.setHex(palette[Math.floor(t * 0.5) % palette.length]);
      light.intensity = (14 + 16 * hit) * energy;
    },
  };
}
