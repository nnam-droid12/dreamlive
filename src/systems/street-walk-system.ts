import {
  CanvasTexture,
  createSystem,
  Entity,
  Group,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  PlaneGeometry,
  RepeatWrapping,
  Sprite,
  SpriteMaterial,
  SRGBColorSpace,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Ritual } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Palette, PaletteSets } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { bevelBox } from '../scene-assets/lib/hardsurface.js';
import { buildStreetLamp } from '../scene-assets/street-lamp.scene-asset.js';
import { buildTaxi } from '../scene-assets/taxi.scene-asset.js';
import { buildModernTower } from '../scene-assets/lib/modern-tower.js';
import { Rooftop } from '../showcase/rooftop-layout.js';
import { TowerShared } from '../showcase/tower-shared.js';
import { cloudTexture } from '../visuals/soft-sprites.js';
import { WorldKit, WorldSpots } from './lib/world-kit.js';

const cfg = Tuning.street;

/** The street below Bigfoot's window, in the window frame (x out of the window, z along the wall), street level y = 0. */
const ROAD = { x0: 2.4, x1: 4.8 };
const WALK = { x: 1.3, z0: -16, z1: 14 };

/**
 * "Bigfoot walks the streets of New York": the side street at the foot of his
 * tower, at street level. Concrete sidewalks with curbs, asphalt with a
 * dashed lane line and a zebra crossing (a one-way side street), cobra-head street lights, a hydrant, a
 * steaming orange-and-white vent stack, lit shopfronts and yellow cabs
 * rolling by, between towers packed shoulder to shoulder. Bigfoot strolls
 * along and waves.
 * Session.world = 'street' (New York stays: the towers rise all around).
 */
export class StreetWalkSystem extends createSystem({
  director: { required: [Ritual, Session, RoomSlots] },
}) {
  private kit = new WorldKit('street');
  private root!: Group;
  private taxis: { obj: Object3D; x: number; dir: number; speed: number; z: number }[] = [];
  private steam: { s: Sprite; age: number }[] = [];
  private time = 0;
  private placedVersion = -1;
  private at = new Vector3();
  private local = new Vector3();
  private yaw = 0;
  private canyonBuilt = false;

  init(): void {
    this.root = new Group();
    this.root.name = 'StreetSet';
    this.root.visible = false;
    const set = new Group();
    set.position.y = Rooftop.street.y;
    this.root.add(set);
    // Road with lane markings and a zebra crossing (one painted texture), sidewalks with joints, curbs.
    const road = new Mesh(new PlaneGeometry(ROAD.x1 - ROAD.x0, 120), new MeshStandardMaterial({ map: roadTexture(), roughness: 0.9 }));
    road.rotation.x = -Math.PI / 2;
    road.position.set((ROAD.x0 + ROAD.x1) / 2, 0.01, 0);
    const walkTex = sidewalkTexture();
    const pave = new MeshStandardMaterial({ map: walkTex, roughness: 0.85 });
    const curb = new MeshStandardMaterial({ color: Palette.curb, roughness: 0.8 });
    for (const [x0, x1] of [
      [0, ROAD.x0],
      [ROAD.x1, 7.0],
    ]) {
      const w = x1 - x0;
      const slab = new Mesh(bevelBox(w, 0.15, 120, 0.01), pave);
      slab.position.set((x0 + x1) / 2, 0.075, 0);
      const c = new Mesh(bevelBox(0.2, 0.17, 120, 0.02), curb);
      c.position.set(x0 === 0 ? x1 - 0.1 : x0 + 0.1, 0.085, 0);
      set.add(slab, c);
    }
    walkTex.repeat.set(1, 60);
    set.add(road);
    // Street lights along the near sidewalk, arms over the road.
    for (let z = -36; z <= 36; z += 12) {
      const l = buildStreetLamp();
      l.position.set(ROAD.x0 - 0.35, 0.15, z);
      set.add(l);
    }
    // A hydrant on the walk.
    const hydrant = new Mesh(bevelBox(0.26, 0.7, 0.26, 0.1), new MeshStandardMaterial({ color: Palette.hydrant, roughness: 0.5, metalness: 0.3 }));
    hydrant.position.set(ROAD.x0 - 0.5, 0.5, 4.5);
    set.add(hydrant);
    // Lit shopfronts along the street level of the tower opposite (its near face, x = 7).
    const shopTex = shopfrontTexture();
    // ...and on along the block, at the foot of the canyon towers (x = 7.6).
    const shopGeo = new PlaneGeometry(15, 4.6);
    const shopMat = new MeshStandardMaterial({ map: shopTex, emissiveMap: shopTex, emissive: 0xffffff, emissiveIntensity: 0.55, roughness: 0.6 });
    for (const [x, z] of [
      [6.98, 0.5],
      [7.58, 17.5],
      [7.58, 32.5],
      [7.58, -16.5],
      [7.58, -31.5],
    ]) {
      const shops = new Mesh(shopGeo, shopMat);
      shops.rotation.y = -Math.PI / 2;
      shops.position.set(x, 2.45, z);
      set.add(shops);
    }
    // The orange-and-white steam stack over a manhole, and its steam.
    const stack = new Mesh(bevelBox(0.5, 1.4, 0.5, 0.2), new MeshStandardMaterial({ color: Palette.steamStack, roughness: 0.6 }));
    stack.position.set(3.7, 0.7, 9);
    const band = new Mesh(bevelBox(0.52, 0.18, 0.52, 0.2), new MeshStandardMaterial({ color: 0xffffff, roughness: 0.6 }));
    band.position.set(3.7, 1.0, 9);
    set.add(stack, band);
    const puff = cloudTexture(5, 128);
    for (let i = 0; i < 14; i++) {
      const s = new Sprite(new SpriteMaterial({ map: puff, color: 0xffffff, transparent: true, depthWrite: false, opacity: 0 }));
      set.add(s);
      this.steam.push({ s, age: (i / 14) * 4 });
    }
    // Yellow cabs: a one-way side street, the cabs in the far lane (clear of the sidewalk).
    for (let i = 0; i < cfg.taxis; i++) {
      const t = buildTaxi();
      set.add(t);
      this.taxis.push({ obj: t, x: ROAD.x1 - 0.65, dir: 1, speed: cfg.taxiSpeed * (0.8 + (i % 3) * 0.15), z: -50 + i * 33 });
    }
    this.world.createTransformEntity(this.root);
  }

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'windowReady')) return;
    if (d.getValue(RoomSlots, 'windowVersion') !== this.placedVersion) this.place(d);
    const dt = Math.min(realDelta, 0.1);
    if (this.kit.step(d, dt, 3)) this.begin(d);
    const k = this.kit.amount;
    this.root.visible = k > 0.02 && this.kit.on;
    if (!this.root.visible) return;
    if (!this.canyonBuilt && TowerShared.mats) this.buildCanyon();
    this.time += dt;
    for (const t of this.taxis) {
      t.z += t.dir * t.speed * dt;
      if (t.z > 60) t.z = -60;
      if (t.z < -60) t.z = 60;
      t.obj.position.set(t.x, 0, t.z);
      t.obj.rotation.y = t.dir > 0 ? 0 : Math.PI;
    }
    for (const p of this.steam) {
      p.age = (p.age + dt) % 4;
      const a = p.age / 4;
      p.s.position.set(3.7 + Math.sin(p.age * 2 + a * 6) * 0.2 + a * 0.8, 1.5 + a * 4.5, 9 + a * 0.5);
      p.s.scale.setScalar(0.6 + a * 3);
      p.s.material.opacity = Math.sin(Math.PI * a) * 0.55;
    }
    this.walk(d);
  }

  /** Bigfoot strolls down the sidewalk (and stops to wave halfway). */
  private walk(d: Entity): void {
    const len = WALK.z1 - WALK.z0;
    const z = WALK.z0 + Math.min(len, this.time * cfg.walkSpeed);
    const waving = this.time > cfg.waveAt && this.time < cfg.waveAt + 2.5;
    const zz = waving ? WALK.z0 + Math.min(len, cfg.waveAt * cfg.walkSpeed) : z;
    this.local.set(WALK.x, Rooftop.street.y + 0.15, zz);
    this.at.copy(this.local);
    this.root.localToWorld(this.at);
    WorldSpots.walker.copy(this.at);
    // Facing along +z in the frame (down the street).
    const anim = waving ? 'wave' : this.time * cfg.walkSpeed >= len ? 'idle' : 'walk';
    this.kit.placeBigfoot(d, this.at, this.yaw, anim);
    if (this.time > 2.5) this.kit.say(d, 'street-hello', "Good morning, New York! Everybody's staring... is it my fur?", this.at);
  }

  private begin(d: Entity): void {
    this.time = 0;
    this.kit.preload(['street-hello']);
    this.kit.caption(d, 'New York, at street level');
  }

  /**
   * A Manhattan canyon: rows of modern towers packed along both sides of the
   * street (2-4 m apart, 60-200 m tall), with a taller second rank behind, so
   * looking up from the sidewalk there is only a strip of sky. Built once, from
   * the city's own dressed tower materials.
   */
  private buildCanyon(): void {
    this.canyonBuilt = true;
    const mats = TowerShared.mats!;
    const set = this.root.children[0] as Group;
    let seed = 11;
    const rand = () => {
      seed = (seed * 16807) % 2147483647;
      return seed / 2147483647;
    };
    const styles = ['blue', 'dark', 'stone'] as const;
    const row = (xNear: number, side: -1 | 1, z0: number, z1: number, depth: number, hMin: number, hMax: number) => {
      let z = z0;
      while (z < z1) {
        const w = 13 + rand() * 9;
        const h = hMin + rand() * (hMax - hMin);
        const d = depth * (0.85 + rand() * 0.3);
        const t = buildModernTower({ w: d, d: w, h, style: styles[Math.floor(rand() * 3)], setbacks: h > 90, seed: Math.floor(rand() * 1000) }, mats);
        t.position.set(xNear + (side * d) / 2, 0, z + w / 2);
        set.add(t);
        z += w + 2 + rand() * 2;
      }
    };
    // Front rank, both sides, outside his building (z within ±20) and the party tower (z -7..8).
    row(-0.6, -1, -95, -21, 16, 70, 170);
    row(-0.6, -1, 21, 95, 16, 70, 170);
    row(7.6, 1, -95, -9, 16, 60, 200);
    row(7.6, 1, 10, 95, 16, 60, 200);
    // A taller second rank behind, filling the sky above the street.
    row(-24, -1, -90, 90, 18, 110, 230);
    row(28, 1, -90, 90, 18, 110, 230);
  }

  /** The street sits in the window frame, at the foot of his tower. */
  private place(d: Entity): void {
    this.placedVersion = d.getValue(RoomSlots, 'windowVersion') ?? 0;
    const o = d.getVectorView(RoomSlots, 'windowOrigin');
    const out = d.getVectorView(RoomSlots, 'windowOut');
    this.root.position.set(o[0], o[1], o[2]);
    this.root.rotation.set(0, Math.atan2(-out[2], out[0]), 0);
    this.root.updateMatrixWorld(true);
    // Bigfoot's heading down the street: the frame's +z in world space.
    const along = d.getVectorView(RoomSlots, 'windowAlong');
    this.yaw = Math.atan2(along[0], along[2]);
  }
}

/** Asphalt with a dashed white lane line and a zebra crossing (canvas, tiled along the road). */
function roadTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 2048;
  const g = c.getContext('2d')!;
  g.fillStyle = '#2b2c30';
  g.fillRect(0, 0, 256, 2048);
  // Grain.
  for (let i = 0; i < 9000; i++) {
    const v = 30 + Math.floor(Math.random() * 30);
    g.fillStyle = `rgb(${v},${v},${v + 4})`;
    g.fillRect(Math.random() * 256, Math.random() * 2048, 2, 2);
  }
  // A one-way street: white dashed lane line, and a zebra crossing in the middle.
  g.fillStyle = '#e9e9e4';
  for (let y = 0; y < 2048; y += 160) g.fillRect(126, y, 5, 90);
  for (let i = 0; i < 6; i++) g.fillRect(14 + i * 40, 980, 24, 90);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Concrete sidewalk flags with joints. */
function sidewalkTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = '#9d9a94';
  g.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 1400; i++) {
    const v = 140 + Math.floor(Math.random() * 30);
    g.fillStyle = `rgb(${v},${v - 2},${v - 6})`;
    g.fillRect(Math.random() * 128, Math.random() * 128, 2, 2);
  }
  g.fillStyle = '#7d7a75';
  g.fillRect(0, 0, 128, 2);
  g.fillRect(0, 0, 2, 128);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.wrapS = t.wrapT = RepeatWrapping;
  return t;
}

/**
 * A row of shopfronts (canvas): a stone fascia, warm-lit display windows with
 * mullions, doors, awnings in deep colours and a dark base. Unbranded.
 */
function shopfrontTexture(): CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 2048;
  c.height = 628;
  const g = c.getContext('2d')!;
  const W = c.width;
  const H = c.height;
  g.fillStyle = '#6d6259';
  g.fillRect(0, 0, W, H);
  // Upper fascia band.
  g.fillStyle = '#857a6f';
  g.fillRect(0, 0, W, 120);
  g.fillStyle = '#4a423b';
  g.fillRect(0, 118, W, 8);
  const awnings = PaletteSets.shopAwnings;
  const shops = 6;
  const sw = W / shops;
  for (let i = 0; i < shops; i++) {
    const x0 = i * sw + 14;
    const w = sw - 28;
    // Warm interior light, brighter near the top.
    const glow = g.createLinearGradient(0, 200, 0, H - 40);
    glow.addColorStop(0, '#ffe2a6');
    glow.addColorStop(1, '#b8743a');
    g.fillStyle = glow;
    g.fillRect(x0, 200, w, H - 250);
    // Shelves and shapes inside.
    g.fillStyle = 'rgba(70, 40, 20, 0.35)';
    for (let k = 0; k < 4; k++) g.fillRect(x0 + 10, 270 + k * 80, w - 20, 10);
    // Mullions and the door.
    g.fillStyle = '#2b2622';
    for (let k = 0; k <= 4; k++) g.fillRect(x0 + (k * w) / 4 - 4, 200, 8, H - 250);
    g.fillRect(x0, 196, w, 8);
    const door = x0 + (i % 2 ? w * 0.72 : w * 0.06);
    g.fillStyle = '#3a2f27';
    g.fillRect(door, 230, w * 0.2, H - 280);
    g.fillStyle = 'rgba(255, 226, 166, 0.6)';
    g.fillRect(door + 10, 250, w * 0.2 - 20, H - 330);
    // Awning, striped edge.
    const col = `#${awnings[i % awnings.length].toString(16).padStart(6, '0')}`;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x0 - 6, 132);
    g.lineTo(x0 + w + 6, 132);
    g.lineTo(x0 + w + 14, 196);
    g.lineTo(x0 - 14, 196);
    g.closePath();
    g.fill();
    g.fillStyle = 'rgba(0, 0, 0, 0.25)';
    for (let k = 0; k < 10; k++) g.fillRect(x0 + (k * w) / 10, 132, w / 20, 64);
    // Lamp over the shop sign band.
    g.fillStyle = 'rgba(255, 240, 200, 0.9)';
    g.fillRect(x0 + w / 2 - 60, 40, 120, 40);
  }
  // Dark base course.
  g.fillStyle = '#2f2a26';
  g.fillRect(0, H - 50, W, 50);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}
