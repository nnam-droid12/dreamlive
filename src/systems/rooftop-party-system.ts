import {
  BackSide,
  BoxGeometry,
  CanvasTexture,
  Color,
  createSystem,
  DoubleSide,
  Entity,
  Group,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  Object3D,
  Path,
  PlaneGeometry,
  Quaternion,
  Shape,
  ShapeGeometry,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
  VisibilityState,
} from '@iwsdk/core';
import { Sound } from '../audio/engine.js';
import type { BigfootRig } from '../characters/bigfoot.js';
import { createYeti } from '../characters/yeti.js';
import { Bigfoot } from '../components/bigfoot.js';
import { DevControls, DreamDirector } from '../components/dream.js';
import { Ritual, RitualPhase } from '../components/ritual.js';
import { Session } from '../components/session.js';
import { RoomSlots } from '../components/stage.js';
import { Palette } from '../config/palette.js';
import { Showcase } from '../config/showcase.js';
import { Tuning } from '../config/tuning.js';
import { dreamDelta, newBeatContext, readBeat } from '../dreams/beat-context.js';
import { SONG_PALETTE, songOf } from '../dreams/chapter_rooftop.js';
import { MemoryStore } from '../memory/store.js';
import { buildRooftop, RooftopWorld } from '../showcase/rooftop.js';
import { frameToWorld, Rooftop } from '../showcase/rooftop-layout.js';
import { buildGift, buildParachuteGift } from '../visuals/goodies.js';

const cfg = Tuning.rooftop;
const GIFT_COLORS = [0xff5fb8, 0xffb45e, 0x35e0ff, 0x3dd68c, 0xb38bff, 0xff6a3d];
const UP = new Vector3(0, 1, 0);
type Faller = { obj: Object3D; age: number; from: Vector3; drift: Vector3; active: boolean };
type Gift = { obj: Object3D; state: 'flying' | 'held' | 'placing' | 'placed'; age: number; from: Vector3; slot: number };
const ease = (t: number) => t * t * (3 - 2 * t);
const clamp01 = (t: number) => Math.max(0, Math.min(1, t));

/**
 * The Rooftop Party: builds the city on the window frame (the taller party tower
 * opposite, Bigfoot's own tower, the street), brings in the Yeti DJ, slides the
 * bedroom glass on cue, keeps the party going, and runs the goodies: parachutes
 * tossed to the street during the party, then gifts thrown across to Bigfoot at
 * his window, which he catches and stacks on his floor (the pile is saved).
 * Outside viewpoints (the tour) get a night sky; on a headset they also hide the
 * real room and show a lit stand-in for Bigfoot's room in his tower.
 */
export class RooftopPartySystem extends createSystem({
  director: { required: [Ritual, DreamDirector, DevControls, Session, RoomSlots] },
  bigfoot: { required: [Bigfoot] },
}) {
  private party?: RooftopWorld;
  private dj?: BigfootRig;
  private loadingDj = false;
  private pane?: Object3D;
  private paneHome = new Vector3();
  private sky?: Mesh;
  private standIn?: Object3D;
  private occluder?: Object3D;
  private beat = newBeatContext();
  private time = 0;
  private energy = cfg.idleEnergy;
  private song = '';
  private fallers: Faller[] = [];
  private gifts: Gift[] = [];
  private lastToss = -1;
  private lastGift = -1;
  private frame = { origin: new Vector3(), out: new Vector3(), along: new Vector3() };
  private djAt = new Vector3();
  private djHand = new Vector3();
  private catchAt = new Vector3();
  private pileAt = new Vector3();
  private tmp = new Vector3();
  private q = new Quaternion();

  update(realDelta: number): void {
    if (this.visibilityState.peek() !== VisibilityState.Visible) return;
    const d = this.queries.director.entities.values().next().value;
    if (!d || !d.getValue(RoomSlots, 'windowReady')) return;
    if (!this.party) this.build(d);
    const delta = dreamDelta(d, realDelta);
    this.time += delta;

    const dreaming = d.getValue(Ritual, 'phase') === RitualPhase.Asleep && readBeat(d, this.beat);
    const roofNight = d.getValue(DreamDirector, 'chapterId') === 'rooftop-party';
    const scene = dreaming && roofNight ? this.beat.scene : '';
    const t = this.beat.time;
    this.glass(d, scene, t);
    this.outside(!!d.getValue(RoomSlots, 'viewOutside'));

    // The party is always on across the street; Bigfoot's visit (or a replay) lifts it.
    const replay = d.getValue(Session, 'replay') ?? '';
    const song = scene.startsWith('party-') && scene !== 'party-wait' ? songOf(scene) : ['disco', 'afro', 'house'].includes(replay) ? replay : this.song || 'afro';
    const live = ['arrive', 'party-wait', 'leap-back', 'gifts'].includes(scene) || scene.startsWith('party-') || ['disco', 'afro', 'house'].includes(replay);
    this.energy += ((live ? 1 : cfg.idleEnergy) - this.energy) * Math.min(1, realDelta * 1.5);
    if (song !== this.song) {
      this.song = song;
      this.party!.setPalette(SONG_PALETTE[song] ?? SONG_PALETTE.afro);
    }
    this.party!.update(this.time, 1 - Sound.beatPhase(this.time, 120), this.energy);
    this.animateDj(scene, t, delta);

    // During the party the DJ tosses goodies off the roof to the street crowd.
    if (scene.startsWith('party-') && scene !== 'party-wait') {
      const n = Math.floor(t / cfg.throwEvery);
      if (n !== this.lastToss) {
        this.lastToss = n;
        this.tossToStreet();
      }
    } else {
      this.lastToss = -1;
    }
    for (const f of this.fallers) if (f.active) this.fall(f, delta);

    // Back home: one gift per cycle, thrown to Bigfoot's hands at the window.
    if (scene === 'gifts' && t >= 1) {
      const n = Math.floor((t - 1) / cfg.giftEvery);
      if (n !== this.lastGift) {
        this.lastGift = n;
        this.throwGift();
      }
    } else {
      this.lastGift = -1;
    }
    for (const g of this.gifts) this.stepGift(g, delta);
  }

  private build(d: Entity): void {
    const f = this.frame;
    f.origin.fromArray(d.getVectorView(RoomSlots, 'windowOrigin'));
    f.out.fromArray(d.getVectorView(RoomSlots, 'windowOut'));
    f.along.fromArray(d.getVectorView(RoomSlots, 'windowAlong'));
    const party = buildRooftop();
    // Window-frame axes → world: local +x = out of the window, +z = along the wall.
    party.root.position.copy(f.origin);
    party.root.rotation.y = Math.atan2(-f.out.z, f.out.x);
    party.setPalette(SONG_PALETTE.afro);
    this.world.createTransformEntity(party.root);
    this.party = party;
    if (!Showcase.enabled) {
      const win = buildDreamWindow();
      party.root.add(win);
      this.occluder = win.getObjectByName('WallOccluder') ?? undefined;
      this.standIn = buildRoomStandIn();
      party.root.add(this.standIn);
    }
    // A night sky around the outside viewpoints (and, on a headset, over the real room).
    // Inside the camera's far plane, centred on the viewer.
    this.sky = new Mesh(new SphereGeometry(90, 24, 12), nightSkyMaterial());
    this.sky.visible = false;
    this.sky.renderOrder = -20;
    this.world.createTransformEntity(this.sky);
    this.pane = this.scene.getObjectByName('SlidingPane') ?? undefined;
    if (this.pane) this.paneHome.copy(this.pane.position);
    frameToWorld(f, Rooftop.djSpot, this.djAt);
    frameToWorld(f, { x: Rooftop.insideSpot.x + 0.35, y: Rooftop.catchHeight, z: Rooftop.insideSpot.z }, this.catchAt);
    frameToWorld(f, Rooftop.pile, this.pileAt);
    // Last nights' gifts are still on the floor.
    const saved = Math.min(cfg.pileMax, MemoryStore.giftPile());
    for (let i = 0; i < saved; i++) {
      const g = this.newGift(i);
      g.state = 'placed';
      this.pileSlot(i, g.obj.position);
      g.obj.rotation.y = (i * 1.9) % (Math.PI * 2);
      g.obj.visible = true;
    }
  }

  /** Slides the glass: open as he reaches it, shut once he is home and inside. */
  private glass(d: Entity, scene: string, t: number): void {
    let open = 0;
    if (scene === 'to-window') open = clamp01((t - 6.8) / 1.4);
    else if (scene === 'to-bed') open = 1 - clamp01((t - 0.2) / 1.2);
    else if (['leap-out', 'arrive', 'party-wait', 'leap-back', 'gifts'].includes(scene) || scene.startsWith('party-')) open = 1;
    d.setValue(RoomSlots, 'windowOpen', open);
    if (this.pane) this.pane.position.copy(this.paneHome).addScaledVector(this.frame.along, -open * (Rooftop.bay.width - 0.1));
  }

  /** Outside viewpoints: the night sky; on a headset, also hide the real room's side. */
  private outside(out: boolean): void {
    if (this.sky) {
      this.sky.visible = out;
      this.player.head.getWorldPosition(this.sky.position);
    }
    if (!Showcase.enabled) {
      this.party!.behind.visible = out;
      if (this.standIn) this.standIn.visible = out;
      if (this.occluder) this.occluder.visible = !out;
    }
  }

  private async loadDj(): Promise<void> {
    const dj = await createYeti();
    this.world.createTransformEntity(dj.root);
    dj.root.position.copy(this.djAt);
    this.dj = dj;
  }

  /** The Yeti DJ: dances at the decks; turns and throws when a goodie or gift leaves his hand. */
  private animateDj(scene: string, t: number, delta: number): void {
    if (!this.dj) {
      if (!this.loadingDj) {
        this.loadingDj = true;
        void this.loadDj();
      }
      return;
    }
    const r = this.dj.root;
    r.position.copy(this.djAt);
    // Facing the crowd (+z along the wall) by default.
    let yaw = Math.atan2(this.frame.along.x, this.frame.along.z);
    let anim: 'dance' | 'dance2' | 'wave' = Math.floor(this.time / 6) % 2 ? 'dance2' : 'dance';
    if (scene === 'gifts' && t >= 1) {
      const u = (t - 1) % cfg.giftEvery;
      yaw = Math.atan2(this.catchAt.x - r.position.x, this.catchAt.z - r.position.z);
      if (u < 0.5 || u > cfg.giftEvery - 0.3) anim = 'wave';
    } else if (scene.startsWith('party-') && scene !== 'party-wait' && t % cfg.throwEvery < 0.5) {
      anim = 'wave';
    }
    r.quaternion.setFromAxisAngle(UP, yaw);
    this.dj.play(anim);
    this.dj.update(delta);
  }

  private handOfDj(out: Vector3): Vector3 {
    return out.copy(this.djAt).addScaledVector(UP, 1.5);
  }

  /** A goodie leaves the DJ's hand, sails out over the street and parachutes down. */
  private tossToStreet(): void {
    let f = this.fallers.find((x) => !x.active);
    if (!f) {
      if (this.fallers.length >= cfg.streetPool) return;
      const obj = buildParachuteGift(GIFT_COLORS[this.fallers.length % GIFT_COLORS.length]);
      this.world.createTransformEntity(obj);
      f = { obj, age: 0, from: new Vector3(), drift: new Vector3(), active: false };
      this.fallers.push(f);
    }
    this.handOfDj(f.from);
    const streetMid = (Rooftop.street.x0 + Rooftop.street.x1) / 2;
    f.drift.copy(this.frame.out).multiplyScalar(-(Rooftop.djSpot.x - streetMid) * (0.9 + Math.random() * 0.2)).addScaledVector(this.frame.along, (Math.random() - 0.5) * 8);
    f.age = 0;
    f.active = true;
    f.obj.visible = true;
    f.obj.position.copy(f.from);
  }

  private fall(f: Faller, delta: number): void {
    f.age += delta;
    const k = Math.min(1, f.age / cfg.throwSec);
    const sink = Math.max(0, f.age - cfg.throwSec);
    f.obj.position.copy(f.from).addScaledVector(f.drift, k);
    f.obj.position.y = f.from.y + Math.sin(Math.PI * Math.min(1, k * 1.2)) * 1.6 - sink * cfg.fallSpeed;
    f.obj.position.addScaledVector(this.frame.along, Math.sin(f.age * 1.3) * 0.06 * sink);
    f.obj.rotation.y += delta * 0.8;
    if (f.obj.position.y < this.frame.origin.y + Rooftop.street.y + 1) {
      f.active = false;
      f.obj.visible = false;
    }
  }

  private newGift(i: number): Gift {
    const obj = buildGift(GIFT_COLORS[i % GIFT_COLORS.length]);
    obj.scale.setScalar(1.3);
    obj.visible = false;
    this.world.createTransformEntity(obj);
    const g: Gift = { obj, state: 'placed', age: 0, from: new Vector3(), slot: i };
    this.gifts.push(g);
    return g;
  }

  /** Heap position i: 9 on the floor, 4 resting on them, 1 on top (a loose pyramid). */
  private pileSlot(i: number, out: Vector3): Vector3 {
    const layer = i < 9 ? 0 : i < 13 ? 1 : 2;
    const n = layer === 0 ? 3 : layer === 1 ? 2 : 1;
    const cell = layer === 0 ? i : layer === 1 ? i - 9 : 0;
    const jitter = ((i * 0.618) % 1) - 0.5;
    const half = (n - 1) / 2;
    out.copy(this.pileAt)
      .addScaledVector(this.frame.out, ((cell % n) - half) * 0.34 + jitter * 0.08)
      .addScaledVector(this.frame.along, (Math.floor(cell / n) - half) * 0.34 - jitter * 0.06);
    out.y = this.pileAt.y + 0.13 + layer * 0.26;
    return out;
  }

  private throwGift(): void {
    const placed = this.gifts.filter((g) => g.state === 'placed').length;
    const slot = Math.min(placed, cfg.pileMax - 1);
    const g = this.newGift(slot);
    g.state = 'flying';
    g.age = 0;
    this.handOfDj(g.from);
    g.obj.position.copy(g.from);
    g.obj.visible = true;
  }

  /** In flight to his hands, held while he turns, set down on the pile. */
  private stepGift(g: Gift, delta: number): void {
    if (g.state === 'placed') return;
    g.age += delta;
    const F = cfg.giftFlightSec;
    if (g.state === 'flying') {
      const k = Math.min(1, g.age / F);
      g.obj.position.lerpVectors(g.from, this.catchAt, ease(k)).addScaledVector(UP, Math.sin(Math.PI * k) * 1.4);
      g.obj.rotation.x += delta * 4;
      g.obj.rotation.y += delta * 3;
      if (k >= 1) {
        g.state = 'held';
        Sound.play('catch', this.catchAt, 0.5);
      }
    } else if (g.state === 'held') {
      g.obj.position.copy(this.catchAt);
      g.obj.quaternion.slerp(this.q.identity(), Math.min(1, delta * 8));
      if (g.age >= F + 0.6) {
        g.state = 'placing';
        g.from.copy(g.obj.position);
      }
    } else {
      const k = clamp01((g.age - F - 0.6) / 0.45);
      this.pileSlot(g.slot, this.tmp);
      g.obj.position.lerpVectors(g.from, this.tmp, ease(k)).addScaledVector(UP, Math.sin(Math.PI * k) * 0.25);
      g.obj.rotation.set(0, (g.slot * 1.9) % (Math.PI * 2), 0);
      if (k >= 1) {
        g.state = 'placed';
        MemoryStore.setGiftPile(Math.min(cfg.pileMax, this.gifts.filter((x) => x.state === 'placed').length));
      }
    }
  }
}

/** A deep night-sky gradient around the viewer, drawn behind everything. */
function nightSkyMaterial(): MeshBasicMaterial {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const g = c.getContext('2d');
  if (g) {
    const grad = g.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, '#04061a');
    grad.addColorStop(0.5, '#1b2350');
    grad.addColorStop(0.62, '#3a2f5c');
    grad.addColorStop(1, '#0b0b14');
    g.fillStyle = grad;
    g.fillRect(0, 0, 4, 256);
  }
  const map = new CanvasTexture(c);
  map.colorSpace = SRGBColorSpace;
  return new MeshBasicMaterial({ map, side: BackSide, depthWrite: false });
}

/**
 * Headset only. The real wall is passthrough, so an invisible depth-writing plane
 * spans the whole wall except the window opening: the rooftop world behind the
 * wall then shows only through the window. Plus a glowing frame and a glass pane
 * that slides open (named like the showcase room's, so the same code drives it).
 * Built in the window frame (x out of the wall, z along it).
 */
function buildDreamWindow(): Group {
  const g = new Group();
  g.name = 'DreamWindow';
  const w = Rooftop.bay.width;
  const sill = 0.15;
  const top = 2.45;
  const shape = new Shape();
  shape.moveTo(-200, -100);
  shape.lineTo(200, -100);
  shape.lineTo(200, 100);
  shape.lineTo(-200, 100);
  shape.lineTo(-200, -100);
  const hole = new Path();
  hole.moveTo(-w / 2, sill);
  hole.lineTo(-w / 2, top);
  hole.lineTo(w / 2, top);
  hole.lineTo(w / 2, sill);
  hole.lineTo(-w / 2, sill);
  shape.holes.push(hole);
  const occluder = new Mesh(new ShapeGeometry(shape), new MeshBasicMaterial({ colorWrite: false, side: DoubleSide }));
  occluder.name = 'WallOccluder';
  occluder.renderOrder = -10;
  occluder.rotation.y = Math.PI / 2;
  occluder.position.x = 0.02;
  g.add(occluder);
  const glow = new MeshBasicMaterial({ color: Palette.lanternGlow });
  for (const [y, z, h, wd] of [[sill, 0, 0.05, w + 0.1], [top, 0, 0.05, w + 0.1], [(sill + top) / 2, -w / 2, top - sill, 0.05], [(sill + top) / 2, w / 2, top - sill, 0.05]] as const) {
    const bar = new Mesh(new BoxGeometry(0.06, h, wd), glow);
    bar.position.set(0, y, z);
    g.add(bar);
  }
  const pane = new Group();
  pane.name = 'SlidingPane';
  const glass = new Mesh(
    new PlaneGeometry(w, top - sill),
    new MeshStandardMaterial({ color: 0x9fb8ff, transparent: true, opacity: 0.18, roughness: 0.05, metalness: 0.6, depthWrite: false, side: DoubleSide }),
  );
  glass.rotation.y = Math.PI / 2;
  pane.add(glass);
  pane.position.set(-0.02, (sill + top) / 2, 0);
  g.add(pane);
  return g;
}

/** Headset only: seen from outside, Bigfoot's room is a warm, lit room behind his window. */
function buildRoomStandIn(): Object3D {
  const room = new Mesh(
    new BoxGeometry(5.5, 3.0, Rooftop.home.glassZ1 - Rooftop.home.glassZ0),
    new MeshStandardMaterial({ color: 0xffd9a8, emissive: new Color(0x8a5a2c), emissiveIntensity: 0.9, roughness: 0.9, side: BackSide }),
  );
  room.name = 'RoomStandIn';
  room.position.set(-2.8, 1.5, (Rooftop.home.glassZ0 + Rooftop.home.glassZ1) / 2);
  room.visible = false;
  return room;
}
