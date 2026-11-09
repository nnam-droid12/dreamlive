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
import { PartyGuests } from '../characters/party-guests.js';
import { Ritual } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Palette, PaletteSets } from '../config/palette.js';
import { Tuning } from '../config/tuning.js';
import { bevelBox } from '../scene-assets/lib/hardsurface.js';
import { buildStreetLamp } from '../scene-assets/street-lamp.scene-asset.js';
import { buildTaxi } from '../scene-assets/taxi.scene-asset.js';
import { Rooftop } from '../showcase/rooftop-layout.js';
import { cloudTexture } from '../visuals/soft-sprites.js';
import { WorldKit, WorldSpots } from './lib/world-kit.js';

const cfg = Tuning.street;

/** The street below Bigfoot's window, in the window frame (x out of the window, z along the wall), street level y = 0. */
const ROAD = { x0: 2.4, x1: 4.8 };
const WALK = { x: 1.3, z0: -16, z1: 14 };

/**
 * "Bigfoot walks the streets of New York": the side street at the foot of his
 * tower, at street level. Concrete sidewalks with curbs, asphalt with a double
 * yellow line and a zebra crossing, cobra-head street lights, a hydrant, a
 * steaming orange-and-white vent stack, yellow cabs rolling by and people
 * walking the sidewalks. Bigfoot strolls along, waves, and is stared at.
 * Session.world = 'street' (New York stays: the towers rise all around).
 */
export class StreetWalkSystem extends createSystem({
  director: { required: [Ritual, Session, RoomSlots] },
}) {
  private kit = new WorldKit('street');
  private root!: Group;
  private taxis: { obj: Object3D; x: number; dir: number; speed: number; z: number }[] = [];
  private steam: { s: Sprite; age: number }[] = [];
  private people?: PartyGuests;
  private loadingPeople = false;
  private walkers: { x: number; dir: number; z: number; speed: number }[] = [];
  private time = 0;
  private placedVersion = -1;
  private at = new Vector3();
  private local = new Vector3();
  private yaw = 0;

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
    // A hydrant and a litter bin on the walk.
    const hydrant = new Mesh(bevelBox(0.26, 0.7, 0.26, 0.1), new MeshStandardMaterial({ color: Palette.hydrant, roughness: 0.5, metalness: 0.3 }));
    hydrant.position.set(ROAD.x0 - 0.5, 0.5, 4.5);
    const bin = new Mesh(bevelBox(0.55, 0.9, 0.55, 0.12), new MeshStandardMaterial({ color: 0x2f4a3a, roughness: 0.7 }));
    bin.position.set(0.5, 0.6, -6);
    set.add(hydrant, bin);
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
    // Yellow cabs on both lanes.
    for (let i = 0; i < cfg.taxis; i++) {
      const t = buildTaxi();
      const dir = i % 2 ? -1 : 1;
      set.add(t);
      this.taxis.push({ obj: t, x: dir > 0 ? ROAD.x0 + 0.65 : ROAD.x1 - 0.65, dir, speed: cfg.taxiSpeed * (0.8 + (i % 3) * 0.15), z: -50 + i * 33 });
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
    if (!this.people && !this.loadingPeople) void this.loadPeople();
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
    if (this.people) {
      this.people.update(dt, 0, 0, 0);
      this.people.guests.forEach((g, i) => {
        const w = this.walkers[i];
        w.z += w.dir * w.speed * dt;
        if (w.z > 40) w.z = -40;
        if (w.z < -40) w.z = 40;
        g.root.position.set(w.x, 0.15, w.z);
        g.root.rotation.set(0, w.dir > 0 ? 0 : Math.PI, 0);
      });
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

  private async loadPeople(): Promise<void> {
    this.loadingPeople = true;
    const people = new PartyGuests();
    try {
      await people.load(cfg.walkers, PaletteSets.guestOutfits, PaletteSets.guestSkin, ['Walk_Loop', 'Walk_Formal_Loop']);
    } catch {
      return;
    }
    people.guests.forEach((_, i) => {
      const far = i % 2 === 0;
      this.walkers.push({ x: far ? 6.0 : 0.7, dir: far ? 1 : -1, z: -30 + i * 11, speed: 1.2 + (i % 3) * 0.15 });
    });
    (this.root.children[0] as Group).add(people.root);
    this.people = people;
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

/** Asphalt with a double yellow centre line and a zebra crossing (canvas, tiled along the road). */
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
  g.fillStyle = '#e8b931';
  g.fillRect(122, 0, 4, 2048);
  g.fillRect(131, 0, 4, 2048);
  // Zebra crossing in the middle.
  g.fillStyle = '#e9e9e4';
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
